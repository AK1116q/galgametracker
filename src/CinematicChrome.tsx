import { useEffect, useLayoutEffect, useState } from "react";
import "./cinematic.css";

export default function CinematicChrome({
  onIntroChange,
}: {
  onIntroChange: (active: boolean) => void;
}) {
  const [phase, setPhase] = useState<"loading" | "spinning" | "done">(() =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? "done" : "loading",
  );
  useLayoutEffect(() => {
    onIntroChange(phase !== "done");
  }, [phase, onIntroChange]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const leave = () => setPhase("done");
    const stop = () => {
      if (media.matches) leave();
    };
    media.addEventListener("change", stop);
    // History navigation can replace the shelf while its animations are paused.
    // Never carry that shelf's input shield into a different page or a BFCache restore.
    window.addEventListener("popstate", leave);
    window.addEventListener("pagehide", leave);
    return () => {
      media.removeEventListener("change", stop);
      window.removeEventListener("popstate", leave);
      window.removeEventListener("pagehide", leave);
    };
  }, []);
  useEffect(() => {
    if (phase !== "loading") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const image = document.querySelector<HTMLImageElement>(
      ".disc-hit > .disc-face img",
    );
    // The real selected disc is already mounted. Wait briefly for its artwork, never for a second copy.
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, 400);
    });
    void Promise.race([image?.decode().catch(() => {}), deadline]).then(() => {
      if (!cancelled) setPhase("spinning");
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase]);
  useLayoutEffect(() => {
    if (phase !== "spinning") return;
    const disc = document.querySelector<HTMLElement>(".disc-hit");
    const face = disc?.querySelector<HTMLElement>(":scope > .disc-face");
    if (!disc || !face) {
      // Deep links open their destination directly; the entrance belongs to the home shelf.
      setPhase("done");
      return;
    }
    let cancelled = false;
    const animations: Animation[] = [];
    const play = (
      element: HTMLElement,
      id: string,
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions,
    ) => {
      const animation = element.animate(keyframes, {
        fill: "both",
        ...options,
      });
      animation.id = id;
      animations.push(animation);
      if (document.hidden) animation.pause();
      return animation;
    };
    // Rotate the actual artwork inside its existing 3D pose, then leave that same DOM in place.
    play(
      face,
      "archive-spin",
      [{ transform: "rotateZ(-1800deg)" }, { transform: "rotateZ(0deg)" }],
      { duration: 2600, easing: "cubic-bezier(0.2, 0.72, 0.26, 1)" },
    );
    play(
      disc,
      "archive-position",
      [
        {
          transform:
            "translate3d(0,0,0) scale(0.72) rotateX(0deg) rotateY(0deg) rotateZ(0deg)",
        },
        { transform: disc.style.transform || getComputedStyle(disc).transform },
      ],
      { duration: 2600, easing: "cubic-bezier(0.22, 0.8, 0.28, 1)" },
    );
    play(face, "archive-cover", [{ opacity: 0.2 }, { opacity: 1 }], {
      duration: 220,
      easing: "ease-out",
    });
    document
      .querySelectorAll<HTMLElement>(
        ".optical-disc:not(.disc-hit) > .disc-face",
      )
      .forEach((element) => {
        play(element, "archive-neighbor", [{ opacity: 0 }, { opacity: 1 }], {
          duration: 750,
          delay: 1450,
          easing: "ease-out",
        });
      });
    document
      .querySelectorAll<HTMLElement>(
        ".disc-credits, .disc-info, .disc-catalog, .disc-pagination",
      )
      .forEach((element) => {
        play(
          element,
          "archive-interface",
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: 600,
            delay: 1950,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        );
      });
    const visibility = () => {
      animations.forEach((animation) => {
        if (animation.playState === "finished") return;
        if (document.hidden) animation.pause();
        else animation.play();
      });
    };
    document.addEventListener("visibilitychange", visibility);
    // Finished promises respect paused/background time; no timeout can cut the spin short.
    const finish = () => {
      if (!cancelled) setPhase("done");
    };
    // A browser/route interruption can cancel a running animation. It must
    // release the input shield just like a normal completion, not strand it.
    void Promise.all(animations.map((animation) => animation.finished)).then(
      finish,
      finish,
    );
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", visibility);
      animations.forEach((animation) => animation.cancel());
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
          <span className="sr-only">光盘正在旋转，随后进入作品首页</span>
        </div>
      )}
    </>
  );
}
