import { useEffect, useLayoutEffect, useState } from "react";
import GlyphRain from "./GlyphRain";
import "./cinematic.css";

export default function CinematicChrome({
  onIntroChange,
}: {
  onIntroChange: (active: boolean) => void;
}) {
  const [phase, setPhase] = useState<"loading" | "revealing" | "done">(() =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? "done" : "loading",
  );
  useLayoutEffect(() => {
    onIntroChange(phase !== "done");
  }, [phase, onIntroChange]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      if (media.matches) setPhase("done");
    };
    media.addEventListener("change", stop);
    return () => media.removeEventListener("change", stop);
  }, []);
  useEffect(() => {
    if (phase === "done") return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });
    if (phase === "loading") {
      const image = document.querySelector<HTMLImageElement>(
        ".disc-hit .disc-face img",
      );
      // Decode the selected cover before revealing it, with a bounded wait on slow networks.
      void Promise.all([
        delay(1100),
        Promise.race([image?.decode().catch(() => {}), delay(1400)]),
      ]).then(() => {
        if (!cancelled) setPhase("revealing");
      });
    } else {
      void delay(1200).then(() => {
        if (!cancelled) setPhase("done");
      });
    }
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [phase]);
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
      {phase !== "done" && (
        <div className="archive-intro" data-phase={phase} aria-label="开场动画">
          <div className="archive-intro__rain" aria-hidden="true">
            <GlyphRain />
            <div className="archive-intro__label">
              <span>GALGAME ARCHIVE</span>
              <small>读取光盘</small>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
