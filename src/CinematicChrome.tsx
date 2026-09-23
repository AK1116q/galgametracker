import { useEffect, useState } from "react";
import "./cinematic.css";
export default function CinematicChrome() {
  const [intro, setIntro] = useState(() => {
    try {
      return !matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!intro) return;
    const timer = setTimeout(() => setIntro(false), 1850);
    return () => clearTimeout(timer);
  }, [intro]);
  useEffect(() => {
    const update = () => {
      document.documentElement.dataset.motion = document.hidden
        ? "paused"
        : "running";
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return (
    <>
      <div className="archive-background" aria-hidden="true" />
      {intro && (
        <div className="archive-intro" aria-label="开场动画">
          <button
            className="archive-intro__skip"
            onClick={() => setIntro(false)}
          >
            跳过动画
          </button>
          <div className="archive-intro__content">
            <div className="archive-intro__eyebrow">GALGAME ARCHIVE</div>
            <div className="archive-intro__title">
              偷吃猫娘达咩哟的
              <br />
              galgame攻略收集站
            </div>
            <div className="archive-intro__line">
              <span />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
