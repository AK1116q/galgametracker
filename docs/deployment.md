# Web 部署与维护

本项目为 React + Vite 静态 Web 应用。核心导航在浏览器运行，进度、草稿和私人攻略存放本机，不需要购买数据库或服务器。

## 当前方案

- 使用用户现有 Cloudflare 账号的 Pages 项目 `galgametracker`。
- 生产网址：<https://galgametracker.pages.dev>。
- 源码在 GitHub 公开仓库 `AK1116q/galgametracker`，已由所有者明确授权公开。
- 托管站点为公开可访问的试用站，私人记录不会上传；网站也没有注册、支付或公开投稿功能。
- 采用 Direct Upload。GitHub Actions 自动检查代码，不自动部署；从本机执行 `npm run deploy` 发布通过检查的构建。

`wrangler.jsonc` 保存构建目录和项目名，不包含密钥。Cloudflare 登录由本机 Wrangler 管理，不把 OAuth token 或 refresh token 上传到 GitHub。

## 再次发布

```sh
npm ci
npm run check
npm run test:e2e
npm run deploy
```

首次在另一台电脑发布需要通过 `npx wrangler login` 完成自己的账号授权。部署脚本只使用已存在的 Pages 项目，不覆盖其他项目。

浏览器测试在 Windows 使用本机 Edge；Linux CI 安装 Chromium。开发预览：`npm run dev`。

## 域名

当前可使用 pages.dev 地址，无需先买域名。将来已有域名时，在 Pages 项目的 Custom domains 添加域名，再按平台提供的 DNS 记录设置；根域名和子域名的要求不同，不预先改用户已有 DNS。参见 [Cloudflare 自定义域名文档](https://developers.cloudflare.com/pages/configuration/custom-domains/)。

网站地址改变会改变浏览器存储所属的 origin；迁移域名前让用户导出备份，新地址导入。不能假设旧网址的进度会自动跟随。

## 后续自动部署

若希望 GitHub 推送后自动上线，可以为 GitHub Actions 单独配置最小范围的 Cloudflare API token 和 account ID。当前未创建或持久化这类凭证，也未把个人 OAuth 凭证当长期部署密钥。

相关官方资料：[Vite 构建与 Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/)、[Pages Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)。本项目已选择 Direct Upload，不把“创建 Git 项目”的步骤误用于当前项目。

## 范围与实际限制

- 本地记录需要定期备份；清除浏览器数据会丢失记录。
- 不承诺 Cloudflare 免费子域名或海外节点在所有大陆网络稳定访问，需目标用户实测。
- 本次没有购买域名、付费服务或变更任何已有站点。
- 所有者于 2026-09-18 选择先保留游客功能，账户与发信服务暂缓；无需付费开通。工作台入口已删除，收藏、浏览与进度仍可在本机保存和导出。
