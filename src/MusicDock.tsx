import { useEffect, useRef, useState } from "react";
import { X, ArrowUpRight, MusicNotes } from "@phosphor-icons/react";
import { musicTracks } from "./music-tracks";
import { loadYouTube, type Player } from "./youtube-player";
import "./music.css";

export default function MusicDock({
  gameId,
  close,
}: {
  gameId: string;
  close: () => void;
}) {
  const [settledGame, setSettledGame] = useState(gameId);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [volume, setVolume] = useState(35);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const intent = useRef(true);
  const switching = useRef(false);
  const track = musicTracks[settledGame];
  const latestTrack = useRef(track);
  latestTrack.current = track;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setSettledGame(gameId), 450);
    return () => clearTimeout(timer);
  }, [gameId]);

  useEffect(() => {
    if (!enabled || !mount.current) return;
    let disposed = false;
    let instance: Player | undefined;
    let timeout: number | undefined;
    setReady(false);
    setFailed(false);
    setStatus("正在连接官方播放器…");
    loadYouTube()
      .then((api) => {
        if (disposed || !mount.current) return;
        const element = document.createElement("div");
        mount.current.replaceChildren(element);
        instance = new api.Player(element, {
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "210",
          videoId: latestTrack.current?.id || "",
          playerVars: {
            playsinline: 1,
            autoplay: 0,
            rel: 0,
            origin: location.origin,
          },
          events: {
            onReady: () => {
              if (disposed || !instance) return;
              clearTimeout(timeout);
              player.current = instance;
              instance.setVolume(volumeRef.current);
              instance.getIframe().title = "作品音乐 · YouTube 官方播放器";
              setReady(true);
            },
            onStateChange: ({ data }) => {
              if (disposed) return;
              setPlaying(data === 1);
              if (data === 1) {
                switching.current = false;
                intent.current = true;
                setFailed(false);
                setStatus("正在播放 · 随作品切换");
              }
              if (data === 2 && !switching.current) {
                intent.current = false;
                setStatus("已暂停 · 切换作品也保持暂停");
              }
              if (data === 0) setStatus("播放结束 · 可重播或切换作品");
            },
            onAutoplayBlocked: () => {
              if (disposed) return;
              switching.current = false;
              intent.current = false;
              setPlaying(false);
              setStatus("浏览器阻止了自动播放，请点击播放。");
            },
            onError: () => {
              if (disposed) return;
              switching.current = false;
              setPlaying(false);
              setFailed(true);
              setStatus("此曲暂时无法播放，可重试或打开原视频。");
            },
          },
        });
        timeout = window.setTimeout(() => {
          if (!disposed) {
            setFailed(true);
            setStatus("播放器连接超时，请重试或打开原视频。");
          }
        }, 15000);
      })
      .catch(() => {
        if (!disposed) {
          setFailed(true);
          setStatus("无法连接 YouTube，请检查网络或打开原视频。");
        }
      });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      instance?.destroy();
      player.current = null;
    };
  }, [enabled, retry]);

  useEffect(() => {
    if (!ready || !player.current) return;
    if (!track) {
      switching.current = false;
      player.current.pauseVideo();
      setStatus("这部作品暂未收录音乐。");
      return;
    }
    setFailed(false);
    switching.current = intent.current;
    setPlaying(false);
    if (intent.current) {
      setStatus("正在切换曲目…");
      player.current.loadVideoById(track.id);
    } else {
      setStatus("已暂停 · 切换作品也保持暂停");
      player.current.cueVideoById(track.id);
    }
  }, [ready, track]);

  return (
    <aside
      className="music-dock"
      aria-label="动漫音乐播放器"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <div className="music-heading">
        <h2>
          <MusicNotes size={18} />
          作品音乐
        </h2>
        <button
          ref={closeRef}
          className="icon-button"
          aria-label="关闭音乐并停止播放"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <strong className="music-track">{track?.title || "暂未收录音乐"}</strong>
      <p className="music-note">{track?.note || "可以切换到其他作品。"}</p>
      {enabled ? (
        <>
          <div ref={mount} className="music-player" />
          <p className="music-status" role="status">
            {status}
          </p>
          {failed && (
            <button
              className="button secondary"
              onClick={() => setRetry((value) => value + 1)}
            >
              重试播放器
            </button>
          )}
          <div className="music-controls">
            <button
              className="button secondary"
              disabled={!ready || !track}
              onClick={() => {
                intent.current = !playing;
                switching.current = false;
                if (playing) {
                  player.current?.pauseVideo();
                  setPlaying(false);
                  setStatus("已暂停 · 切换作品也保持暂停");
                } else {
                  player.current?.playVideo();
                  setStatus("正在请求播放…");
                }
              }}
            >
              {playing ? "暂停音乐" : "播放音乐"}
            </button>
            <label>
              音量{" "}
              <input
                aria-label="音乐音量"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setVolume(value);
                  player.current?.setVolume(value);
                }}
              />
            </label>
          </div>
        </>
      ) : (
        <div className="music-load">
          <MusicNotes size={30} />
          <button
            className="button primary"
            disabled={!track}
            onClick={() => setEnabled(true)}
          >
            开启音乐
          </button>
          <p>连接 YouTube，播放当前作品的曲目。之后随中央光盘自动换曲。</p>
        </div>
      )}
      {track && (
        <div className="music-links">
          <a
            href={`https://www.youtube.com/watch?v=${track.id}`}
            target="_blank"
            rel="noreferrer"
          >
            打开原视频
            <ArrowUpRight size={13} />
          </a>
          <a href={track.source} target="_blank" rel="noreferrer">
            官方来源
          </a>
        </div>
      )}
    </aside>
  );
}
