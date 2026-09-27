import { useEffect, useState, type CSSProperties } from "react";
import { DiscArtwork } from "./DiscLibrary";

/** Chapter position, not a representation of audio playback or reading progress. */
export default function Turntable({
  game,
  chapters,
  chapter,
}: {
  game: { id: string; title: string };
  chapters: { id: string; label: string }[];
  chapter: string;
}) {
  const index = chapters.findIndex((item) => item.id === chapter);
  const angle =
    index < 0 ? -8 : 14 + (index / Math.max(1, chapters.length - 1)) * 24;
  const [moving, setMoving] = useState(true);
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return (
    <aside
      className="turntable"
      aria-label={`${game.title} · 篇章唱盘`}
      data-chapter={chapter || "parked"}
      data-spinning={moving && visible && index >= 0}
      style={{ "--arm-angle": `${angle}deg` } as CSSProperties}
    >
      <div className="turntable__deck" aria-hidden="true">
        <div className="turntable__platter">
          <DiscArtwork game={game} />
          <div className="turntable__grooves" />
        </div>
        <div className="turntable__spindle" />
        <svg className="turntable__arm" viewBox="0 0 500 480">
          <circle cx="430" cy="70" r="27" fill="#d5d5d0" stroke="#a3a49e" />
          <circle cx="430" cy="70" r="18" fill="#33352f" />
          <g className="turntable__swing">
            <g className="turntable__lift" key={chapter}>
              <path
                d="M430 40 V325 L430 372"
                fill="none"
                stroke="#181b18"
                strokeWidth="13"
                strokeLinecap="round"
              />
              <path
                d="M427 40 V325 L427 367"
                fill="none"
                stroke="#c9cbc5"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path d="M426 44 V323" stroke="#fbfcf8" strokeWidth="2" />
              <rect
                x="416"
                y="354"
                width="27"
                height="36"
                rx="3"
                fill="#292c27"
              />
              <path d="M443 362 L452 356" stroke="#969b91" strokeWidth="3" />
              <path d="M429 389 V396" stroke="#aaa" strokeWidth="2" />
              <rect
                x="413"
                y="18"
                width="34"
                height="28"
                rx="3"
                fill="#64675f"
              />
              <path
                d="M417 23 H443 M417 29 H443 M417 35 H443"
                stroke="#979b92"
              />
            </g>
          </g>
          <circle cx="430" cy="70" r="8" fill="#e5e7df" stroke="#888d81" />
        </svg>
      </div>
      <div className="turntable__caption">
        <div>
          <span className="turntable__number">
            {index < 0 ? "—" : String(index + 1).padStart(2, "0")}
          </span>
          <span>{chapters[index]?.label || "选择篇章"}</span>
        </div>
        <button
          type="button"
          aria-pressed={!moving}
          onClick={() => setMoving(!moving)}
          aria-label={moving ? "暂停唱盘动画" : "继续唱盘动画"}
        >
          {moving ? "Ⅱ" : "▷"}
        </button>
      </div>
      <span className="turntable__legend">篇章唱盘</span>
    </aside>
  );
}
