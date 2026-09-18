# 路线页面与搜索发现

2026-09-19：为现有 36 条公开路线生成固定路径 `/guides/{game}/{pack}/{revision}/{route}/`。旧 query 链接仍可打开；新复制链接只包含路线信息，不包含 session、收藏或书签。

`npm run build` 在 Vite 构建后运行 `scripts/generate-pages.mjs`，从同一份路线数据输出：

- 36 个包含路线正文、前置、状态和来源的 HTML 页面。
- 首页的可点击攻略目录、`sitemap.xml` 与 `robots.txt`。
- 每条路线的独立标题、摘要、canonical 和 Open Graph 元信息。

没有 JavaScript 时仍可阅读静态正文；加载后由现有 React 界面提供书签、搜索和进度功能。没有按访客或机器人分发不同内容。浏览器测试现在使用构建产物的预览服务（4174），覆盖无 JavaScript 正文、链接、后退及旧链接兼容。

说明：这是改善抓取与分享的基础，并不代表已被收录、已验证搜索排名或已关联 Search Console。用户没有 Google 账号，未要求注册或付费，也未代为开通账号。

参考：[Google JavaScript SEO 基础](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)、[canonical 说明](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)、[Cloudflare Pages 静态页面服务](https://developers.cloudflare.com/pages/configuration/serving-pages/)。
