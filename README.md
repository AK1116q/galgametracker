# Galgame Tracker

中文 Galgame 无剧透路线助手。帮助正在游玩的玩家选择目标、定位当前选项、查看推荐并记录进度。

当前阶段：**开发准备**。包含产品方案、路线数据契约、虚构数据和自动校验；尚无用户界面、真实游戏攻略或线上服务。

## 从这里开始

- [对话结论与决策边界](docs/brief.md)
- [V0.1 产品范围与用户流程](docs/product.md)
- [数据模型与技术方案](docs/architecture.md)
- [数据采集、录入与审核](docs/content-workflow.md)
- [竞品与数据源初查](docs/research.md)
- [开发任务与验收标准](docs/backlog.md)

## 本地检查

安装 Node.js 24 后执行：

```sh
npm ci
npm run check
```

`check` 校验示例数据结构、引用关系与发布条件，并运行校验器的回归测试。为攻略录入做准备，不是路线推荐引擎。

## 目录

```text
docs/                       产品、技术、内容和验证计划
schemas/route-pack.schema.json  路线包 v0.1 数据契约
data/examples/              明确标注为虚构的样例
scripts/                   数据校验工具
tests/                     非法数据与发布门槛测试
.github/                   CI 与问题模板
```

首发游戏和具体版本尚未选定。《白色相簿2》等作品只在讨论中作为候选，不代表已支持。产品名称暂用目录名；代码与数据的对外授权方式待定。
