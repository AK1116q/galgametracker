/** Continue the already visible HTML disc at its current angle, then retire it. */
export function startupAngle(): number | null {
  if (document.documentElement.dataset.startup !== "loading") return null;
  const disc = document.getElementById("startup-disc");
  if (!disc) return null;
  const matrix = new DOMMatrixReadOnly(getComputedStyle(disc).transform);
  return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
}

export function finishStartup() {
  window.dispatchEvent(new Event("archive:ready"));
}

/** The critical HTML shell can paint while full styles download without blocking it. */
export function startupStylesReady(): Promise<void> {
  return Promise.all(
    [
      ...document.querySelectorAll<HTMLLinkElement>("link[data-startup-style]"),
    ].map((link) => {
      if (link.dataset.startupFailed)
        return Promise.reject(new Error("Stylesheet unavailable"));
      if (link.sheet) {
        // A cached stylesheet can have a sheet before its load event dispatches.
        // Activate it here too; retiring the shell must not leave print-only CSS.
        link.media = "all";
        return Promise.resolve();
      }
      return new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          link.removeEventListener("load", loaded);
          link.removeEventListener("error", failed);
        };
        const loaded = () => {
          link.media = "all";
          cleanup();
          resolve();
        };
        const failed = () => {
          cleanup();
          reject(new Error("Stylesheet unavailable"));
        };
        link.addEventListener("load", loaded, { once: true });
        link.addEventListener("error", failed, { once: true });
      });
    }),
  ).then(() => {});
}
