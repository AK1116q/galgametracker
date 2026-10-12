import { flushSync } from "react-dom";
import "./transitions.css";

type TransitionOptions = { shareDisc?: boolean; discGameId?: string };
type DiscSnapshot = { bounds: DOMRect; copy: HTMLElement };
let active: ViewTransition | undefined;
let generation = 0;
let dispose: (() => void) | undefined;

const motion = () => matchMedia("(prefers-reduced-motion: reduce)");

function visibleDisc(gameId?: string) {
  const element = document.querySelector<HTMLElement>(
    '.app-shell[data-view="library"] .disc-hit > .disc-face, .app-shell[data-view="game"] .turntable__platter > .disc-face',
  );
  if (!element || (gameId && element.dataset.gameId !== gameId)) return;
  const bounds = element.getBoundingClientRect();
  if (bounds.bottom <= 0 || bounds.top >= innerHeight || !bounds.width) return;
  return element;
}

/** Snapshot only the viewport and the selected disc, never an entire long guide. */
export function pageTransition(
  update: () => void,
  options: TransitionOptions = {},
) {
  active?.skipTransition();
  dispose?.();
  active = undefined;
  dispose = undefined;
  const request = ++generation;
  if (document.hidden || motion().matches) {
    flushSync(update);
    return;
  }

  const source = options.shareDisc
    ? visibleDisc(options.discGameId)
    : undefined;
  const root = document.documentElement;
  const names = new Map<HTMLElement, string>();
  const animations: Animation[] = [];
  const cleanups: (() => void)[] = [];
  let finished = false;
  function name(element: HTMLElement) {
    names.set(element, element.style.viewTransitionName);
    element.style.viewTransitionName = "travelling-disc";
  }
  function cleanup() {
    if (finished) return;
    finished = true;
    names.forEach((previous, element) => {
      element.style.viewTransitionName = previous;
    });
    animations.forEach((animation) => animation.cancel());
    cleanups.forEach((clear) => clear());
    if (request === generation) {
      delete root.dataset.pageTransition;
      active = undefined;
      dispose = undefined;
    }
  }
  const stop = () => {
    if (document.hidden || preference.matches) {
      active?.skipTransition();
      cleanup();
    }
  };
  const preference = motion();
  document.addEventListener("visibilitychange", stop);
  preference.addEventListener("change", stop);
  cleanups.push(() => {
    document.removeEventListener("visibilitychange", stop);
    preference.removeEventListener("change", stop);
  });
  dispose = cleanup;
  root.dataset.pageTransition = source ? "disc" : "page";

  if (document.startViewTransition) {
    if (source) name(source);
    const transition = document.startViewTransition(() => {
      // A rapid second navigation supersedes a still-pending first snapshot.
      if (request !== generation) return;
      flushSync(update);
      if (finished) return;
      const destination = source ? visibleDisc(options.discGameId) : undefined;
      if (destination) name(destination);
      else root.dataset.pageTransition = "page";
    });
    active = transition;
    // Skipping rejects ready, but the DOM update must still run.
    void transition.ready.catch(() => {});
    void transition.finished.then(cleanup, cleanup);
    return;
  }

  // Older engines retain the same navigation and a compositor-only FLIP transfer.
  const snapshot: DiscSnapshot | undefined = source
    ? {
        bounds: source.getBoundingClientRect(),
        copy: source.cloneNode(true) as HTMLElement,
      }
    : undefined;
  flushSync(update);
  const destination = snapshot ? visibleDisc(options.discGameId) : undefined;
  // Never promote .app-shell/main: a complete route can be tens of screens tall.
  // Only a few small, visible pieces receive transient compositor layers.
  const pieces = [
    ...document.querySelectorAll<HTMLElement>(
      ".main-content :is(.back-link, .page-heading, .chapter-picker, .target-picker, .guide-title, .settings-section, .saved-section, .disc-credits, .disc-info)",
    ),
  ]
    .filter((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.height <= innerHeight &&
        bounds.width * bounds.height <= innerWidth * innerHeight * 0.55 &&
        bounds.top < innerHeight &&
        bounds.bottom > 0
      );
    })
    .slice(0, 3);
  for (const element of pieces) {
    animations.push(
      element.animate(
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 340, easing: "cubic-bezier(.2,.8,.2,1)" },
      ),
    );
  }
  if (snapshot && destination) {
    const target = destination.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.className = "disc-transfer-fallback";
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, {
      left: `${snapshot.bounds.left}px`,
      top: `${snapshot.bounds.top}px`,
      width: `${snapshot.bounds.width}px`,
      height: `${snapshot.bounds.height}px`,
    });
    snapshot.copy.removeAttribute("data-game-id");
    snapshot.copy.style.viewTransitionName = "none";
    overlay.append(snapshot.copy);
    document.body.append(overlay);
    const oldVisibility = destination.style.visibility;
    destination.style.visibility = "hidden";
    const transform = `translate(${target.left - snapshot.bounds.left}px, ${target.top - snapshot.bounds.top}px) scale(${target.width / snapshot.bounds.width}, ${target.height / snapshot.bounds.height})`;
    animations.push(
      overlay.animate(
        [{ transform: "translate(0, 0) scale(1)" }, { transform }],
        { duration: 720, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" },
      ),
    );
    cleanups.push(() => {
      destination.style.visibility = oldVisibility;
      overlay.remove();
    });
  }
  void Promise.allSettled(
    animations.map((animation) => animation.finished),
  ).then(cleanup);
}
