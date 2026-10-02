import { useEffect } from "react";

/** One delegated listener; feedback never delays the button's action. */
export function useInteractionMotion() {
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const running = new Map<HTMLElement, Animation>();
    function play(el: HTMLElement, frames: Keyframe[], duration = 180) {
      running.get(el)?.cancel();
      const animation = el.animate(frames, {
        duration,
        easing: "cubic-bezier(.2,.8,.2,1)",
      });
      running.set(el, animation);
      void animation.finished
        .catch(() => {})
        .then(() => {
          if (running.get(el) === animation) running.delete(el);
        });
    }
    const click = (event: MouseEvent) => {
      if (media.matches || !(event.target instanceof Element)) return;
      const el = event.target.closest<HTMLElement>("button, a, summary");
      if (!el || el.matches(":disabled, [aria-disabled=true], .optical-disc"))
        return;
      // Individual scale does not replace existing transforms (e.g. centered navigation).
      play(el, [{ scale: ".97" }, { scale: "1" }]);
    };
    const toggle = (event: Event) => {
      const el = event.target;
      if (media.matches || !(el instanceof HTMLDetailsElement) || !el.open)
        return;
      // Only animate small visible children, not a potentially enormous evidence panel.
      [...el.children]
        .filter((child) => child.tagName !== "SUMMARY")
        .slice(0, 3)
        .forEach((child) => {
          if (
            child instanceof HTMLElement &&
            child.getBoundingClientRect().top < innerHeight
          )
            play(child, [{ opacity: 0 }, { opacity: 1 }], 160);
        });
    };
    const stop = () => {
      if (media.matches || document.hidden) {
        running.forEach((animation) => animation.cancel());
        running.clear();
      }
    };
    document.addEventListener("click", click, true);
    document.addEventListener("toggle", toggle, true);
    document.addEventListener("visibilitychange", stop);
    media.addEventListener("change", stop);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("toggle", toggle, true);
      document.removeEventListener("visibilitychange", stop);
      media.removeEventListener("change", stop);
      running.forEach((animation) => animation.cancel());
    };
  }, []);
}
