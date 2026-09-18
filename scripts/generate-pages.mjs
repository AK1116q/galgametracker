import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { guidePath } from "../core/guide.mjs";
import { reviewInfo } from "../core/guide-info.mjs";
import { routeIssues } from "../core/evidence.mjs";
import {
  routePathname,
  routeTitle,
  routeDescription,
  SITE_ORIGIN,
} from "../core/urls.mjs";

// A build-time HTML fallback from the same immutable packs as the interactive UI.
// No browser histories, user imports, or sessions are read by this generator.
const packs = ["wa2", "catalog"].flatMap((dir) =>
  readdirSync(`data/${dir}`)
    .filter((f) => f.endsWith(".route.json"))
    .map((f) => JSON.parse(readFileSync(`data/${dir}/${f}`, "utf8"))),
);
const template = readFileSync("dist/index.html", "utf8");
if (!template.includes('<div id="root"></div>'))
  throw new Error("Missing Vite root placeholder");
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function page(title, description, path, content) {
  const url = SITE_ORIGIN + path;
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/,
      `<meta name="description" content="${escape(description)}">`,
    )
    .replace(
      "</head>",
      `<link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:type" content="website"></head>`,
    )
    .replace(
      '<div id="root"></div>',
      `<div id="root"><div class="app-shell reading-mode"><main class="main-content static-guide">${content}</main></div></div>`,
    );
}
const links = [];
for (const pack of packs)
  for (const route of pack.routes) {
    const path = routePathname(pack, route.id);
    const title = routeTitle(pack, route);
    const guide = guidePath(pack, route.id);
    const status = reviewInfo(pack, route.id);
    const required = route.requiredEndingIds
      .map((id) => pack.endings.find((e) => e.id === id)?.safeLabel ?? id)
      .join("、");
    const content = `<a href="/">返回游戏库</a><h1>${escape(title)}</h1><p>${escape(pack.release.label)}</p><p>${escape(status.label)} · 核对记录 ${escape(status.date)}</p><p>前置：${escape(required || "本路线未列出前置结局，参阅下方说明")}</p><p>中文为含义提示，未确认具体汉化补丁。开启 JavaScript 后可使用书签和进度记录。</p>
    <ul>${(pack.notes ?? []).map((n) => `<li>${escape(n)}</li>`).join("")}</ul>
    ${routeIssues(pack, route.id)
      .map((issue) => `<p>待核验：${escape(issue.summary)}</p>`)
      .join("")}
    <ol class="route-tree">${guide.nodes.map(({ choice, optionId }) => `<li class="tree-step"><h2>${escape(choice.locator)}</h2><p>${escape(choice.prompt)}</p><ul>${choice.options.map((option, index) => `<li${option.id === optionId ? ' class="target-option"' : ""}>${option.id === optionId ? "按此路径选择：" : "其他选项："}${choice.kind !== "instruction" && choice.orderKnown !== false ? `第 ${index + 1} 项 · ` : ""}${escape(option.text)}</li>`).join("")}</ul>${choice.skipTo ? "<p>此步骤在部分周目可能不出现，以游戏画面为准。</p>" : ""}</li>`).join("")}</ol>
    <p>目标：${escape(pack.endings.find((e) => e.id === guide.destination.id)?.safeLabel ?? "后续规则不足")}</p>
    <h2>来源</h2><ul>${pack.sources.map((s) => `<li>${s.reference.startsWith("https://") ? `<a href="${escape(s.reference)}">${escape(s.id)}</a>` : escape(s.reference)}</li>`).join("")}</ul><a href="/">查看其他攻略</a>`;
    const file = resolve("dist", "." + path, "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      page(title, routeDescription(pack, route), path, content),
    );
    links.push({ path, title });
  }
writeFileSync(
  "dist/index.html",
  page(
    "偷吃猫娘达咩哟的galgame攻略收集站",
    "按作品、篇章和目标结局查询 Galgame 攻略，核对版本、查找选项与存档安排。",
    "/",
    `<h1>Galgame 攻略目录</h1><p>按作品与目标结局查找攻略。中文为含义提示，来源及核验范围见各路线。</p><ul>${links.map((l) => `<li><a href="${escape(l.path)}">${escape(l.title)}</a></li>`).join("")}</ul>`,
  ),
);
writeFileSync(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["/", ...links.map((l) => l.path)].map((p) => `<url><loc>${escape(SITE_ORIGIN + p)}</loc></url>`).join("")}</urlset>`,
);
writeFileSync(
  "dist/robots.txt",
  `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`,
);
console.log(
  `Generated ${links.length} public route pages, catalog, sitemap and robots.txt.`,
);
