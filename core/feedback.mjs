// Deliberately accepts guide data only: never include sessions or browser state.
export function guideFeedbackUrl(pack, routeId, choiceId) {
  const route = pack.routes.find((r) => r.id === routeId);
  if (!route) throw new Error("路线不存在");
  const choice = choiceId
    ? pack.choices.find((c) => c.id === choiceId)
    : undefined;
  if (choiceId && !choice) throw new Error("攻略步骤不存在");
  const chapter =
    pack.game.id === "white-album-2"
      ? pack.release.id === "wa2-pc-cc"
        ? "cc"
        : pack.release.id === "wa2-pc-coda"
          ? "coda"
          : "other"
      : "other";
  const link = new URL("https://galgametracker.pages.dev/");
  link.search = new URLSearchParams({
    view: "game",
    game: pack.game.id,
    chapter,
    target: `${pack.id}@${pack.revision}/${routeId}`,
  }).toString();
  const plain = (value) =>
    String(value)
      .replace(/[\r\n<>`]/g, " ")
      .slice(0, 160);
  const body = [
    "## 攻略位置",
    `作品：${plain(pack.game.title)}`,
    `适用版本：${plain(pack.release.label)}`,
    `攻略包：${plain(pack.id)} · revision ${pack.revision}`,
    `路线 ID：${plain(routeId)}`,
    choice
      ? `步骤 ID：${plain(choice.id)} · ${plain(choice.locator)}`
      : "范围：整条路线",
    `攻略链接：${link.href}`,
    "",
    "<details>",
    "<summary>路线与步骤信息（可能含剧透）</summary>",
    "",
    `目标：${plain(route.safeLabel)}`,
    ...(choice ? [`步骤提示：${plain(choice.prompt)}`] : []),
    "",
    "</details>",
    "",
    "## 我实际使用的游戏版本、平台与汉化补丁",
    "请填写：",
    "",
    "## 错误位置与预期情况",
    "请填写：",
    "",
    "<details>",
    "<summary>实际选项、前置条件、复现步骤或截图（可能含剧透）</summary>",
    "",
    "请填写：",
    "",
    "</details>",
    "",
    "## 可供核对的来源",
    "请填写：",
    "",
    "此反馈提交后将公开显示。请勿附上账号、密钥或完整的个人备份。",
  ].join("\n");
  const url = new URL("https://github.com/AK1116q/galgametracker/issues/new");
  url.search = new URLSearchParams({
    title: `[攻略纠错] ${plain(pack.game.title)} · ${choice ? "步骤信息" : "路线信息"}`,
    body,
  }).toString();
  return url.href;
}
