import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Runs before the app module or stylesheet downloads. Keep this dependency-free.
function bootstrapStartup(artwork) {
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const selected = params.get("game") || history.state?.galgameLibrarySelection;
  const cover = Object.hasOwn(artwork, selected)
    ? artwork[selected]
    : artwork["white-album-2"];
  root.style.setProperty("--startup-art", `url("${cover.src}")`);
  root.style.setProperty("--startup-position", cover.position);
  root.dataset.startup = "loading";
  const preload = document.createElement("link");
  preload.rel = "preload";
  preload.as = "image";
  preload.href = cover.src;
  preload.fetchPriority = "high";
  document.head.append(preload);

  let timer;
  const stylesheet = (event) => {
    const target = event.target;
    if (
      target instanceof HTMLLinkElement &&
      target.hasAttribute("data-startup-style")
    ) {
      target.media = "all";
    }
  };
  const visibility = () => {
    root.toggleAttribute("data-startup-paused", document.hidden);
  };
  const finish = (failed = false) => {
    clearTimeout(timer);
    window.removeEventListener("archive:ready", ready);
    window.removeEventListener("error", error, true);
    document.removeEventListener("visibilitychange", visibility);
    root.removeAttribute("data-startup-paused");
    if (failed) root.dataset.startup = "failed";
    else {
      window.removeEventListener("load", stylesheet, true);
      root.removeAttribute("data-startup");
      document.getElementById("startup-screen")?.remove();
      document.getElementById("startup-failure")?.remove();
      root.style.removeProperty("--startup-art");
      root.style.removeProperty("--startup-position");
    }
  };
  const ready = () => finish();
  const error = (event) => {
    const target = event.target;
    if (
      (target instanceof HTMLScriptElement && target.type === "module") ||
      (target instanceof HTMLLinkElement && target.rel === "stylesheet")
    ) {
      if (target instanceof HTMLLinkElement)
        target.dataset.startupFailed = "true";
      // Keep the ready listener: a delayed app may still recover after a CSS failure.
      fail();
    }
  };
  const fail = () => {
    finish(true);
    window.addEventListener("archive:ready", ready, { once: true });
  };
  timer = setTimeout(fail, 12000);
  window.addEventListener("archive:ready", ready, { once: true });
  window.addEventListener("error", error, true);
  window.addEventListener("load", stylesheet, true);
  document.addEventListener("visibilitychange", visibility);
  visibility();
}

const covers = JSON.parse(readFileSync("src/covers.json", "utf8"));
const artwork = Object.fromEntries(
  Object.entries(covers).map(([id, cover]) => [
    id,
    {
      src: cover.disc?.src ?? cover.src,
      position: cover.disc?.position ?? "50% 32%",
    },
  ]),
);
export const startupScript = `(${bootstrapStartup.toString()})(${JSON.stringify(artwork).replaceAll("<", "\\u003c")});`;
export const startupHash = createHash("sha256")
  .update(startupScript)
  .digest("base64");
const criticalStyles = ["disc-layout", "disc-artwork", "startup"]
  .map((name) => readFileSync(`src/${name}.css`, "utf8"))
  .join("\n");

export function withStartup(html) {
  return (
    html
      // Before Vite's resource links, so failed requests cannot escape the watchdog.
      .replace(
        /(<meta charset="UTF-8"\s*\/?>)/,
        `$1<style>${criticalStyles}</style><script>${startupScript}</script>`,
      )
      .replace(
        /<link\b[^>]*rel="stylesheet"[^>]*>/g,
        (link) =>
          `${link.replace("<link", '<link media="print" data-startup-style')}<noscript>${link}</noscript>`,
      )
      .replace(
        "<body>",
        `<body>
      <div id="startup-screen" role="status" aria-label="正在加载作品">
        <div id="startup-position"><div id="startup-disc" class="disc-face" aria-hidden="true">
          <div class="startup-art"></div><div class="disc-print"></div><div class="disc-sheen"></div><div class="disc-hub"></div>
        </div></div>
        <span>光盘正在旋转，随后进入作品首页</span>
      </div>
      <div id="startup-failure" role="status">互动界面暂未加载，仍可查看下方基础攻略。<a href="">重新加载</a></div>`,
      )
  );
}
