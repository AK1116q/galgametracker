import { useEffect, useRef, useState } from "react";
import { X, ArrowUpRight, MusicNotes } from "@phosphor-icons/react";
import "./music.css";

const tracks = [
  {
    id: "24QGd-mX9bU",
    title: "コネクト · SACRA BLUE BEATS Mix",
    note: "《魔法少女小圆》主题曲 · 官方器乐改编",
    source: "https://www.sonymusic.co.jp/artist/claris/info/543384",
  },
  {
    id: "zSLty7g3w30",
    title: "光放て！",
    note: "《ATRI》游戏 OP · 柳麻美",
    source: "https://prtimes.jp/main/html/rd/p/000002427.000016356.html",
  },
  {
    id: "ZRtdQ81jPUQ",
    title: "アイドル / Idol",
    note: "《我推的孩子》OP · YOASOBI",
    source: "https://prtimes.jp/main/html/rd/p/000000672.000055377.html",
  },
];

export default function MusicDock({ close }: { close: () => void }) {
  const [selected, setSelected] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const track = tracks[selected];
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  return (
    <aside
      className="music-dock"
      aria-label="动漫音乐播放器"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <div className="music-heading">
        <h2>
          <MusicNotes size={18} />
          动漫音乐
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
      <label className="music-select">
        选择曲目
        <select
          value={selected}
          onChange={(e) => {
            setSelected(Number(e.target.value));
            setLoaded(false);
          }}
        >
          {tracks.map((item, i) => (
            <option key={item.id} value={i}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <p className="music-note">{track.note}</p>
      {loaded ? (
        <iframe
          key={track.id}
          title={`${track.title} · YouTube 官方视频`}
          src={`https://www.youtube-nocookie.com/embed/${track.id}?playsinline=1&autoplay=0&rel=0`}
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <div className="music-load">
          <MusicNotes size={30} />
          <button className="button primary" onClick={() => setLoaded(true)}>
            加载官方播放器
          </button>
          <p>加载后连接 YouTube，点击播放器开始播放。</p>
        </div>
      )}
      <div className="music-links">
        <a
          href={`https://www.youtube.com/watch?v=${track.id}`}
          target="_blank"
          rel="noreferrer"
        >
          无法播放？打开原视频
          <ArrowUpRight size={13} />
        </a>
        <a href={track.source} target="_blank" rel="noreferrer">
          官方来源
        </a>
      </div>
    </aside>
  );
}
