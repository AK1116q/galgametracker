import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import covers from "./covers.json";
import metadata from "./gallery-metadata.json";
import "./discs.css";

type Work = { id: string; title: string; routes: number };
const art = covers as Record<
  string,
  { src: string; disc?: { src: string; position: string } }
>;
const pad = (n: number) => String(n).padStart(2, "0");
const PAGE_SIZE = 8;
const reviews = metadata as Record<
  string,
  {
    score: number;
    votes: number;
    url: string;
    checkedAt: string;
    comment: string;
    scope: string;
  }
>;

/** Compositor-only disc motion. No React renders or layout reads inside a frame. */
export default function DiscLibrary({
  games: allGames,
  onOpen,
  initialId,
  onSelectionChange,
  paused = false,
}: {
  games: Work[];
  onOpen: (id: string) => void;
  initialId?: string;
  onSelectionChange?: (id: string) => void;
  paused?: boolean;
}) {
  const [page, setPage] = useState(() =>
    Math.floor(
      Math.max(
        0,
        allGames.findIndex((g) => g.id === initialId),
      ) / PAGE_SIZE,
    ),
  );
  const pageCount = Math.ceil(allGames.length / PAGE_SIZE);
  const games = allGames.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const [flight, setFlight] = useState<"idle" | "out" | "in">("idle");
  const flightRef = useRef(false);
  const animations = useRef<Animation[]>([]);
  const alive = useRef(true);
  const [browsing, setBrowsing] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  function activity() {
    setBrowsing(true);
    clearTimeout(settleTimer.current);
    const settle = () => {
      if (
        gesture.current ||
        Math.abs(position.current - target.current) > 0.002
      ) {
        settleTimer.current = setTimeout(settle, 100);
      } else setBrowsing(false);
    };
    settleTimer.current = setTimeout(settle, 420);
  }
  useEffect(() => {
    alive.current = true;
    const reveal = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        clearTimeout(settleTimer.current);
        setBrowsing(false);
      }
    };
    document.addEventListener("keydown", reveal);
    return () => {
      alive.current = false;
      clearTimeout(settleTimer.current);
      animations.current.forEach((a) => a.cancel());
      document.removeEventListener("keydown", reveal);
    };
  }, []);
  const [selectedId, select] = useState(initialId || games[0]?.id);
  const selected = Math.max(
    0,
    games.findIndex((g) => g.id === selectedId),
  );
  const current = games[selected];
  const [caption, setCaption] = useState(current);
  useLayoutEffect(() => {
    // Keep the outgoing text intact while it fades; swap before the reveal paints.
    if (!browsing && flight === "idle") setCaption(current);
  }, [current, browsing, flight]);
  useEffect(() => {
    if (current) onSelectionChange?.(current.id);
  }, [current?.id, onSelectionChange]);
  const stage = useRef<HTMLDivElement>(null);
  const discs = useRef<(HTMLButtonElement | null)[]>([]);
  const hover = useRef({ index: -1, x: 0, y: 0 });
  const hoverBox = useRef<DOMRect | null>(null);
  const position = useRef(selected);
  const target = useRef(selected);
  const wake = useRef<() => void>(() => {});
  const suspended = useRef(paused);
  suspended.current = paused || flight !== "idle";
  useEffect(() => {
    wake.current();
  }, [paused, flight]);
  const gesture = useRef<{ x: number; y: number; width: number } | null>(null);
  const dragged = useRef(false);
  const selectRef = useRef<(direction: number) => void>(() => {});
  selectRef.current = (direction) => {
    if (flightRef.current) return;
    const next = Math.max(0, Math.min(games.length - 1, selected + direction));
    if (games[next] && next !== selected) {
      activity();
      select(games[next].id);
    }
  };
  const ids = games.map((g) => g.id).join("|");

  useEffect(() => {
    target.current = selected;
    wake.current();
  }, [selected, ids]);

  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    discs.current.length = games.length;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      last = 0,
      visible = true;
    let width = element.clientWidth,
      height = element.clientHeight;
    const springs = games.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
    // Avoid repeated style invalidation for unchanged or offscreen discs.
    const written = new WeakMap<HTMLElement, Record<string, string>>();
    const style = (
      el: HTMLElement,
      property:
        "visibility" | "transform" | "opacity" | "zIndex" | "willChange",
      value: string,
    ) => {
      let previous = written.get(el);
      if (!previous) {
        previous = {};
        written.set(el, previous);
      }
      if (previous[property] !== value) {
        el.style[property] = value;
        previous[property] = value;
      }
    };
    const draw = () => {
      const mobile = width < 660;
      discs.current.forEach((disc, index) => {
        if (!disc) return;
        const distance = index - position.current;
        const active = Math.abs(distance) < 2.3;
        style(disc, "visibility", active ? "visible" : "hidden");
        style(
          disc,
          "willChange",
          active && frame && !media.matches ? "transform" : "auto",
        );
        const over = String(active && hover.current.index === index);
        if (disc.dataset.hovered !== over) disc.dataset.hovered = over;
        if (!active) return;
        const x = distance * width * (mobile ? 0.91 : 0.35);
        // Keep the trailing disc above the wide title/review band.
        const y =
          distance * height * (mobile ? -0.13 : distance < 0 ? -0.06 : -0.24);
        const scale = Math.max(0.55, 1 - Math.abs(distance) * 0.24);
        const spring = springs[index];
        const rx = media.matches ? 0 : spring.x;
        const ry = media.matches ? 0 : spring.y;
        style(
          disc,
          "transform",
          `translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) scale(${scale.toFixed(5)}) rotateX(${(24 + rx).toFixed(4)}deg) rotateY(${(-24 + ry).toFixed(4)}deg) rotateZ(${(-24 + distance * 13 + ry * 0.16).toFixed(4)}deg)`,
        );
        style(disc, "opacity", String(Math.min(1, 2.3 - Math.abs(distance))));
        style(disc, "zIndex", String(10 - Math.round(Math.abs(distance) * 2)));
      });
    };
    const tick = (time: number) => {
      frame = 0;
      // On high-refresh screens, avoid simulating 240+ times per second.
      // Keep up to 120 Hz on desktop and 60 Hz on narrow mobile layouts.
      if (last && time - last < (width < 660 ? 15 : 7.5)) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const elapsed = Math.min(40, last ? time - last : 16.67);
      last = time;
      position.current +=
        (target.current - position.current) * (1 - Math.exp(-elapsed / 115));
      if (Math.abs(target.current - position.current) < 0.0008)
        position.current = target.current;
      let moving = false;
      // Semi-implicit damped springs, sub-stepped to remain stable on slow frames.
      const steps = Math.ceil(elapsed / 8);
      const dt = elapsed / steps / 1000;
      for (let step = 0; step < steps; step++)
        springs.forEach((spring, index) => {
          const over = hover.current.index === index;
          const tx = over ? hover.current.y * -9 : 0;
          const ty = over ? hover.current.x * 11 : 0;
          spring.vx += ((tx - spring.x) * 190 - spring.vx * 17) * dt;
          spring.vy += ((ty - spring.y) * 190 - spring.vy * 17) * dt;
          spring.x += spring.vx * dt;
          spring.y += spring.vy * dt;
          if (
            Math.abs(tx - spring.x) +
              Math.abs(ty - spring.y) +
              Math.abs(spring.vx) +
              Math.abs(spring.vy) >
            0.012
          )
            moving = true;
          else {
            spring.x = tx;
            spring.y = ty;
            spring.vx = 0;
            spring.vy = 0;
          }
        });
      if (
        (moving || position.current !== target.current) &&
        visible &&
        !document.hidden &&
        !suspended.current
      )
        frame = requestAnimationFrame(tick);
      draw();
    };
    const start = () => {
      if (suspended.current || document.hidden || media.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      if (media.matches) {
        position.current = target.current;
        draw();
      } else if (!frame && visible && !document.hidden && !suspended.current) {
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
      if (flightRef.current) {
        event.preventDefault();
        return;
      }
      activity();
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

  async function changePage(next: number) {
    if (flightRef.current || next === page || next < 0 || next >= pageCount)
      return;
    flightRef.current = true;
    clearTimeout(settleTimer.current);
    hover.current = { index: -1, x: 0, y: 0 };
    gesture.current = null;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nextGames = allGames.slice(next * PAGE_SIZE, (next + 1) * PAGE_SIZE);
    // Decode only the incoming focal artwork; a slow image must not trap navigation.
    const preload = nextGames.slice(0, 3).map((game) => {
      if (!art[game.id]) return Promise.resolve();
      const image = new Image();
      image.src = art[game.id].disc?.src ?? art[game.id].src;
      return image.decode().catch(() => {});
    });
    const play = (
      el: HTMLElement,
      frames: Keyframe[],
      duration: number,
      easing: string,
      delay = 0,
    ) => {
      const animation = el.animate(frames, {
        duration,
        easing,
        delay,
        fill: "both",
      });
      animations.current.push(animation);
      return animation.finished.catch(() => {});
    };
    flushSync(() => {
      setBrowsing(false);
      setFlight("out");
    });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!reduced) {
        const outgoing = discs.current
          .filter((disc): disc is HTMLButtonElement => disc !== null)
          .map((disc, index) => {
            const pose = disc.style.transform;
            return play(
              disc,
              [
                { transform: pose, opacity: disc.style.opacity },
                {
                  transform: `${pose} rotateY(${next > page ? 90 : -90}deg) scale(${index === selected ? 1.45 : 0})`,
                  opacity: index === selected ? 1 : 0,
                },
              ],
              500,
              "cubic-bezier(.55,.055,.675,.19)",
            );
          });
        await Promise.all([
          ...outgoing,
          Promise.race([
            Promise.all(preload),
            new Promise<void>((resolve) => {
              timeout = setTimeout(resolve, 900);
            }),
          ]),
        ]);
      }
      if (!alive.current) return;
      animations.current.forEach((a) => a.cancel());
      animations.current = [];
      position.current = target.current = 0;
      flushSync(() => {
        setPage(next);
        select(nextGames[0].id);
        setFlight("in");
      });
      if (!reduced) {
        await Promise.all(
          discs.current
            .filter((disc): disc is HTMLButtonElement => disc !== null)
            .slice(0, 3)
            .map((disc, index) => {
              const pose = disc.style.transform;
              return play(
                disc,
                [
                  {
                    transform: `${pose} rotateY(${next > page ? -90 : 90}deg) scale(${index === 0 ? 1.45 : 0})`,
                    opacity: index === 0 ? 1 : 0,
                  },
                  { transform: pose, opacity: disc.style.opacity },
                ],
                index === 0 ? 1050 : 890,
                index === 0 ? "cubic-bezier(.215,.61,.355,1)" : "linear",
                index === 0 ? 0 : 290,
              );
            }),
        );
      }
    } finally {
      clearTimeout(timeout);
      animations.current.forEach((a) => a.cancel());
      animations.current = [];
      flightRef.current = false;
      if (alive.current) setFlight("idle");
    }
  }

  if (!current || !caption) return null;
  return (
    <section
      className="disc-library"
      aria-label="光盘游戏库"
      data-browsing={browsing || flight !== "idle"}
      data-flight={flight}
      data-page={page + 1}
    >
      <div
        className="disc-stage"
        ref={stage}
        tabIndex={0}
        aria-label="光盘浏览，左右方向键切换作品，回车查看攻略"
        onKeyDown={(event) => {
          if (flightRef.current) return;
          if (
            event.target !== event.currentTarget &&
            !(event.target as HTMLElement).classList.contains("optical-disc")
          )
            return;
          if (
            [
              "ArrowRight",
              "ArrowLeft",
              "Home",
              "End",
              "Enter",
              "PageDown",
              "PageUp",
            ].includes(event.key)
          )
            event.preventDefault();
          if (event.key === "ArrowRight") selectRef.current(1);
          if (event.key === "ArrowLeft") selectRef.current(-1);
          if (event.key === "Home") {
            activity();
            select(games[0].id);
          }
          if (event.key === "End") {
            activity();
            select(games[games.length - 1].id);
          }
          if (event.key === "PageDown") void changePage(page + 1);
          if (event.key === "PageUp") void changePage(page - 1);
          if (event.key === "Enter") onOpen(current.id);
        }}
        onPointerDown={(event) => {
          if (flightRef.current) return;
          if (!event.isPrimary || event.button !== 0) return;
          if (
            (event.target as HTMLElement).closest(
              ".disc-bottom, .disc-info, .disc-pagination",
            )
          )
            return;
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
          activity();
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
        <div className="disc-info">
          <h2>{caption.title}</h2>
          {reviews[caption.id] ? (
            <div className="disc-review">
              <a
                className="disc-rating"
                href={reviews[caption.id].url}
                target="_blank"
                rel="noreferrer"
                title={`${reviews[caption.id].scope} · ${reviews[caption.id].votes} 人评分 · 更新于 ${reviews[caption.id].checkedAt}`}
              >
                <strong>{reviews[caption.id].score.toFixed(1)}</strong>
                <span>
                  Bangumi{caption.id === "white-album-2" ? " · CC" : ""}
                  <small>
                    {reviews[caption.id].votes.toLocaleString("zh-CN")} 人评分 ·{" "}
                    {reviews[caption.id].checkedAt}
                  </small>
                </span>
              </a>
              <p className="disc-comment">
                <span>本站简评</span>
                {reviews[caption.id].comment}
              </p>
            </div>
          ) : (
            <p className="disc-comment">Bangumi 评分暂未收录</p>
          )}
        </div>
        <div className="disc-scene" inert={flight !== "idle"}>
          {games.map((game, index) => (
            <button
              className={`optical-disc ${index === selected ? "disc-hit" : ""}`}
              key={game.id}
              aria-label={`${index === selected ? "打开当前光盘" : "切换到作品"}：${game.title}`}
              tabIndex={index === selected ? 0 : -1}
              onClick={() => {
                if (!dragged.current) {
                  if (index === selected) onOpen(game.id);
                  else {
                    activity();
                    select(game.id);
                  }
                }
              }}
              onPointerEnter={(event) => {
                if (event.pointerType === "touch") return;
                hoverBox.current = event.currentTarget.getBoundingClientRect();
                hover.current = { index, x: 0.15, y: -0.1 };
                wake.current();
              }}
              onPointerMove={(event) => {
                const box = hoverBox.current;
                if (event.pointerType === "touch" || gesture.current || !box)
                  return;
                hover.current = {
                  index,
                  x: Math.max(
                    -1,
                    Math.min(
                      1,
                      ((event.clientX - box.left) / box.width) * 2 - 1,
                    ),
                  ),
                  y: Math.max(
                    -1,
                    Math.min(
                      1,
                      ((event.clientY - box.top) / box.height) * 2 - 1,
                    ),
                  ),
                };
                wake.current();
              }}
              onPointerLeave={() => {
                hover.current = { index: -1, x: 0, y: 0 };
                wake.current();
              }}
              onFocus={(event) => {
                if (event.currentTarget.matches(":focus-visible")) {
                  hover.current = { index, x: 0, y: 0 };
                  wake.current();
                }
              }}
              onBlur={() => {
                hover.current = { index: -1, x: 0, y: 0 };
                wake.current();
              }}
              ref={(el) => {
                discs.current[index] = el;
              }}
            >
              <svg
                className="disc-ink"
                viewBox="0 0 600 600"
                aria-hidden="true"
              >
                <path
                  pathLength="1000"
                  d="M111 69 C208 -8 369 -2 462 57 C557 113 605 243 581 354 C557 475 459 578 339 588 C210 604 94 551 36 435 C-15 330 4 197 75 111 C84 99 97 82 111 69"
                />
                <path
                  pathLength="1000"
                  d="M478 91 C402 10 260 -10 149 50 C42 108 -9 233 20 355 C44 479 141 575 264 589 C387 606 512 534 564 423 C614 313 584 175 495 108"
                />
              </svg>
              <DiscArtwork
                game={game}
                index={index}
                loadArt={Math.abs(index - selected) < 3}
              />
            </button>
          ))}
        </div>
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
        </div>
        <nav className="disc-pagination" aria-label="作品分页">
          {Array.from({ length: pageCount }, (_, n) => (
            <button
              key={n}
              aria-label={`第 ${n + 1} 页作品`}
              aria-current={n === page ? "page" : undefined}
              disabled={flight !== "idle"}
              onClick={() => void changePage(n)}
            >
              <span className="page-dot" aria-hidden="true" />
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}

export function GameIndex({
  games,
  onOpen,
}: {
  games: Work[];
  onOpen: (id: string) => void;
}) {
  return (
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
  );
}

export function DiscArtwork({
  game,
  index = 0,
  loadArt = true,
}: {
  game: { id: string; title: string };
  index?: number;
  loadArt?: boolean;
}) {
  const cover = art[game.id];
  return (
    <div className="disc-face" aria-hidden="true">
      {loadArt && art[game.id] && (
        <img
          src={cover.disc?.src ?? cover.src}
          style={{ objectPosition: cover.disc?.position }}
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
  );
}
