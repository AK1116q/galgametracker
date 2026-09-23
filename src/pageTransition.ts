import { flushSync } from "react-dom";

let active: ViewTransition | undefined;
let generation = 0;

/** Short viewport snapshots; no animation layer covering an entire long guide. */
export function pageTransition(update: () => void) {
  const request = ++generation;
  active?.skipTransition();
  if (
    !document.startViewTransition ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }
  active = document.startViewTransition(() => {
    // A rapid second navigation supersedes a still-pending first snapshot.
    if (request === generation) flushSync(update);
  });
  // Skipping an animation rejects ready, but does not cancel the DOM update.
  void active.ready.catch(() => {});
  void active.finished.finally(() => {
    if (request === generation) active = undefined;
  });
}
