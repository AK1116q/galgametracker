export const SITE_ORIGIN = "https://galgametracker.pages.dev";
export function chapterFor(pack) {
  return pack.game.id === "white-album-2"
    ? pack.release.id === "wa2-pc-cc"
      ? "cc"
      : pack.release.id === "wa2-pc-coda"
        ? "coda"
        : "other"
    : "other";
}
export function routePathname(pack, routeId) {
  return `/guides/${[pack.game.id, pack.id, String(pack.revision), routeId].map(encodeURIComponent).join("/")}/`;
}
export function routeFromPath(pathname, packs) {
  try {
    const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts.length !== 5 || parts[0] !== "guides") return;
    const pack = packs.find(
      (p) =>
        !p.synthetic &&
        p.game.id === parts[1] &&
        p.id === parts[2] &&
        String(p.revision) === parts[3],
    );
    const route = pack?.routes.find((r) => r.id === parts[4]);
    if (pack && route) return { pack, route };
  } catch {
    /* Malformed shared URLs are not executable or valid route targets. */
  }
}
export function routeTitle(pack, route) {
  return `${pack.game.title} · ${route.safeLabel}攻略`;
}
export function routeDescription(pack, route) {
  const required = route.requiredEndingIds
    .map((id) => pack.endings.find((e) => e.id === id)?.safeLabel ?? id)
    .join("、");
  return `${pack.release.label}。按步骤查找选项、存档提示和来源。${required ? `前置：${required}。` : ""}中文为含义提示，核验范围见正文。`;
}
