import { useEffect, useRef, useState } from "react";
import covers from "./covers.json";
import "./discs.css";

type Work = { id: string; title: string; routes: number };
const art = covers as Record<string, { src: string }>;
const pad = (n: number) => String(n).padStart(2, "0");

/** Compositor-only disc motion. No React renders or layout reads inside a frame. */
export default function DiscLibrary({
  games,
  onOpen,
  initialId,
}: {
  games: Work[];
  onOpen: (id: string) => void;
  initialId?: string;
}) {
  const [selectedId, select] = useState(initialId || games[0]?.id);
  const selected = Math.max(
    0,
    games.findIndex((g) => g.id === selectedId),
  );
  const current = games[selected];
  const stage = useRef<HTMLDivElement>(null);
  const discs = useRef<(HTMLDivElement | null)[]>([]);
  const position = useRef(selected);
  const target = useRef(selected);
  const wake = useRef<() => void>(() => {});
  const gesture = useRef<{ x: number; y: number; width: number } | null>(null);
  const dragged = useRef(false);
  const selectRef = useRef<(direction: number) => void>(() => {});
  selectRef.current = (direction) => {
    const next = Math.max(0, Math.min(games.length - 1, selected + direction));
    if (games[next]) select(games[next].id);
  };
  const ids = games.map((g) => g.id).join("|");

  useEffect(() => {
    target.current = selected;
    wake.current();
  }, [selected, ids]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      last = 0,
      visible = true;
    let width = element.clientWidth,
      height = element.clientHeight;
    const draw = () => {
      const mobile = width < 660;
      discs.current.forEach((disc, index) => {
        if (!disc) return;
        const distance = index - position.current;
        const active = Math.abs(distance) < 2.3;
        disc.style.visibility = active ? "visible" : "hidden";
        if (!active) return;
        const x = distance * width * (mobile ? 0.91 : 0.35);
        const y = distance * height * (mobile ? -0.13 : -0.24);
        const scale = Math.max(0.55, 1 - Math.abs(distance) * 0.24);
        disc.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale}) rotateX(24deg) rotateY(-24deg) rotateZ(${-24 + distance * 13}deg)`;
        disc.style.opacity = String(Math.min(1, 2.3 - Math.abs(distance)));
        disc.style.zIndex = String(10 - Math.round(Math.abs(distance) * 2));
      });
    };
    const tick = (time: number) => {
      frame = 0;
      const elapsed = Math.min(40, last ? time - last : 16.67);
      last = time;
      position.current +=
        (target.current - position.current) * (1 - Math.exp(-elapsed / 115));
      if (Math.abs(target.current - position.current) < 0.0008)
        position.current = target.current;
      draw();
      if (position.current !== target.current && visible && !document.hidden)
        frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (media.matches) {
        position.current = target.current;
        draw();
      } else if (!frame && visible && !document.hidden) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    wake.current = start;
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      draw();
    });
    resize.observe(element);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    intersection.observe(element);
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else start();
    };
    // A wheel gesture changes one work, including trackpad momentum tails.
    let lastWheel = 0,
      total = 0,
      consumed = false;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX))
        return;
      const direction = Math.sign(event.deltaY);
      const now = performance.now();
      const atEdge =
        direction < 0
          ? target.current === 0
          : target.current === games.length - 1;
      if (atEdge && now - lastWheel > 170) return; // Let a fresh gesture leave the library.
      event.preventDefault();
      if (now - lastWheel > 170) {
        total = 0;
        consumed = false;
      }
      total += event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      if (!consumed && Math.abs(total) > 12) {
        selectRef.current(direction);
        consumed = true;
      }
      lastWheel = now;
    };
    element.addEventListener("wheel", wheel, { passive: false });
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", start);
    draw();
    start();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      element.removeEventListener("wheel", wheel);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", start);
      wake.current = () => {};
    };
  }, [ids]);

  if (!current) return null;
  return (
    <section className="disc-library" aria-label="光盘游戏库">
      <div
        className="disc-stage"
        ref={stage}
        tabIndex={0}
        aria-label="光盘浏览，左右方向键切换作品，回车查看攻略"
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (
            ["ArrowRight", "ArrowLeft", "Home", "End", "Enter"].includes(
              event.key,
            )
          )
            event.preventDefault();
          if (event.key === "ArrowRight") selectRef.current(1);
          if (event.key === "ArrowLeft") selectRef.current(-1);
          if (event.key === "Home") select(games[0].id);
          if (event.key === "End") select(games[games.length - 1].id);
          if (event.key === "Enter") onOpen(current.id);
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          if ((event.target as HTMLElement).closest(".disc-bottom")) return;
          dragged.current = false;
          gesture.current = {
            x: event.clientX,
            y: event.clientY,
            width: event.currentTarget.clientWidth,
          };
          (event.target as HTMLElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const origin = gesture.current;
          if (!origin) return;
          const dx = event.clientX - origin.x;
          const dy = event.clientY - origin.y;
          if (Math.abs(dx) <= 8 || Math.abs(dx) < Math.abs(dy)) return;
          target.current = Math.max(
            0,
            Math.min(
              games.length - 1,
              selected -
                dx / (origin.width * (origin.width < 660 ? 0.91 : 0.35)),
            ),
          );
          wake.current();
        }}
        onPointerCancel={() => {
          gesture.current = null;
          dragged.current = true;
          target.current = selected;
          wake.current();
        }}
        onPointerUp={(event) => {
          if (!gesture.current) return;
          const dx = event.clientX - gesture.current.x;
          const dy = event.clientY - gesture.current.y;
          gesture.current = null;
          dragged.current = Math.abs(dx) > 8 || Math.abs(dy) > 8;
          target.current = selected;
          wake.current();
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy))
            selectRef.current(dx < 0 ? 1 : -1);
        }}
      >
        <div className="disc-info" key={current.id}>
          <span className="disc-kicker">GALGAME / {pad(selected + 1)}</span>
          <h2>{current.title}</h2>
          <dl>
            <div>
              <dt>攻略</dt>
              <dd>{current.routes} 条路线</dd>
            </div>
            <div>
              <dt>平台</dt>
              <dd>PC</dd>
            </div>
            <div>
              <dt>使用</dt>
              <dd>选作品 → 篇章 → 结局</dd>
            </div>
          </dl>
        </div>
        <div className="disc-scene" aria-hidden="true">
          {games.map((game, index) => (
            <div
              className="optical-disc"
              key={game.id}
              ref={(el) => {
                discs.current[index] = el;
              }}
            >
              <div className="disc-face">
                {art[game.id] && (
                  <img
                    src={art[game.id].src}
                    alt=""
                    draggable={false}
                    decoding="async"
                    fetchPriority={index === 0 ? "high" : "auto"}
                  />
                )}
                <div className="disc-print">
                  <span>GALGAME ARCHIVE</span>
                  <strong>{game.title}</strong>
                  <small>PC / GUIDE COLLECTION / {pad(index + 1)}</small>
                </div>
                <div className="disc-sheen" />
                <div className="disc-hub" />
              </div>
            </div>
          ))}
        </div>
        <button
          className="disc-hit"
          aria-label={`打开当前光盘：${current.title}`}
          onClick={() => {
            if (!dragged.current) onOpen(current.id);
          }}
        />
        <div className="disc-bottom">
          <div className="disc-navigation">
            <button
              aria-label="上一部作品"
              disabled={selected === 0}
              onClick={() => selectRef.current(-1)}
            >
              ←
            </button>
            <span aria-live="polite" aria-atomic="true">
              {pad(selected + 1)} <i>/ {pad(games.length)}</i>
              <span className="sr-only"> {current.title}</span>
            </span>
            <button
              aria-label="下一部作品"
              disabled={selected === games.length - 1}
              onClick={() => selectRef.current(1)}
            >
              →
            </button>
          </div>
          <button className="disc-open" onClick={() => onOpen(current.id)}>
            查看攻略 <span>↗</span>
          </button>
          <a className="disc-index-link" href="#game-index">
            作品目录 ↓
          </a>
        </div>
        <span className="disc-hint">滚轮或左右滑动切换作品</span>
      </div>
      <div className="disc-index" id="game-index">
        <div className="disc-index-heading">
          <h2>作品目录</h2>
          <span>{pad(games.length)} WORKS</span>
        </div>
        {games.map((game, index) => (
          <button
            key={game.id}
            aria-label={`选择作品：${game.title}`}
            className="disc-index-row"
            onClick={() => onOpen(game.id)}
          >
            <span className="disc-index-number">{pad(index + 1)}</span>
            {art[game.id] && (
              <img
                src={art[game.id].src}
                alt=""
                loading="lazy"
                width="44"
                height="60"
              />
            )}
            <strong>{game.title}</strong>
            <span className="disc-index-count">{game.routes} 条路线</span>
            <span>↗</span>
          </button>
        ))}
      </div>
    </section>
  );
}
