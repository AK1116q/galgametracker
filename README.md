# 路线手记 · Galgame Tracker

面向小规模中文 Galgame 玩家的无剧透路线助手。

**[打开 Web 试用版](https://galgametracker.pages.dev)** · [WA2 资料核对](docs/wa2-research.md) · [部署与维护](docs/deployment.md)

## 已实现

- 游戏库、中文别名搜索、版本和目标路线选择。
- 当前选项逐步展开、推荐提示、真实选择记录；偏离路径时暂停。
- 本机保存、恢复、回档撤销和显式通关确认。
- 私人攻略表单、JSON 修订、导入导出和备份冲突保护。
- Cloudflare Pages 静态托管，无需注册或云数据库。

内置《白色相簿2》PC 原版 CC 雪菜路线，16 个选择节点。状态为**资料已交叉核对、待实机验证**。中文是自行概述的语义提示，不保证逐字匹配某个汉化补丁。其余角色、Coda 和 Extended Edition 的具体版本适配尚未验证。

## 本地运行

Node.js 24：

```sh
npm ci
npm run dev
```

```sh
npm run check        # 数据校验、领域测试、TypeScript 检查与生产构建
npm run test:e2e     # 桌面与手机浏览器流程测试
npm run deploy      # 使用本机 Cloudflare 登录发布
```

Windows 浏览器测试使用本机 Edge；Linux 先运行 `npx playwright install chromium`。

## 目录

| 目录 | 内容 |
|---|---|
| `src` | React + TypeScript Web 界面 |
| `core` | 数据校验、路线引擎、记录重放、备份和录入适配 |
| `data/wa2` | 有来源和核对说明的 WA2 路线 |
| `data/examples` | 虚构测试场景，与真实攻略分开 |
| `schemas` | 路线包数据契约 |
| `tests` / `e2e` | 领域测试、桌面和手机流程测试 |
| `docs` | 产品、内容维护、研究和部署记录 |

## 当前边界

私人攻略和记录只存本机，不自动上传公共库。换设备、换网站域名或清除浏览器数据前需导出备份。旧进度绑定旧攻略 revision，导入相同版本但不同内容会拒绝覆盖。

没有游戏本体、游戏 CG 或资源下载，也没有社交、云同步、付费功能。小程序留待后续，共享领域逻辑已与 Web 界面分离。

GitHub 仓库保持私有。Actions 自动检查；生产部署当前由已登录的本机执行，不存储个人 OAuth 凭据到 GitHub。

## 项目文档

- [最初对话结论](docs/brief.md)
- [产品范围与用户流程](docs/product.md)
- [数据模型与技术实现](docs/architecture.md)
- [内容录入与审核规范](docs/content-workflow.md)
- [竞品初查](docs/research.md) / [本次 WA2 研究与差异](docs/wa2-research.md)
- [任务进展](docs/backlog.md)
