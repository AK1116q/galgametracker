# 新增五部作品：资料核对记录

核对日期：2026-09-18。范围为 PC / Steam 主线，新增 26 条目标路径。不包括 AFTER、差分 CG、全成就。每个数据包内提供来源链接和版本边界。

这是公开资料交叉核对，不是运行游戏验证。自动化测试验证数据结构、路径终止、已知条件与前置保护，不能证明实际游戏一定达到结局。不得将 `source_checked` 改成 `verified`，除非有具体版本的通关证据。

| 作品 | 覆盖 | 核对来源 |
| --- | --- | --- |
| ATRI | 正向结局、BE、TE | [GameLine](https://gameline.jp/atri/)、[LMC117](https://steamcommunity.com/sharedfiles/filedetails/?id=2134692491) |
| 千恋＊万花 | 六角色、通常结局 | [誠也](https://seiya-saiga.com/game/yuzu-soft/senrenbanka.html)、[Chuee](https://steamcommunity.com/sharedfiles/filedetails/?id=1997093244) |
| 魔女的夜宴 | 宁宁前后篇、爱瑠、䌷、憧子、和奏、通常结局 | [誠也](https://seiya-saiga.com/game/yuzu-soft/sothewitch.html)、[Chuee](https://steamcommunity.com/sharedfiles/filedetails/?id=1546374480) |
| RIDDLE JOKER | 五角色、二周目通常结局选法 | [誠也](https://seiya-saiga.com/game/yuzu-soft/riddlejoker.html)、[Chuee](https://steamcommunity.com/sharedfiles/filedetails/?id=2323376164) |
| 沙耶之歌 | 三结局 | [日文游玩记录](https://hamumamire.blog105.fc2.com/blog-entry-517.html)、[宇脩zxy](https://www.bilibili.com/opus/1014191282114789378) |

## 关键校正

- ATRI：日文攻略把正向结局称 Normal，中文攻略称 HE，合并为同一个目标。前两项也决定最后能否捡鞋，不能只给最后一项。TE 要先看两种结局，再从标题菜单进入，作为操作步骤展示。
- 千恋：茉子／丛雨的外出安排不进入钓鱼问题，因此各 7 步；小春／芦花需要先通关任一主角路线。采用两份来源一致的完整新游戏路径，不拼接来自不同好感度起点的局部存档。
- 魔宴：从存档起点继承前面的选项。宁宁前篇不能当作后半篇完成；RESTART 是标题入口。和奏的前置若使用宁宁，必须完成后半篇。爱瑠分支的外出提示仅列出已核对的目标项，未编造其余选项。
- RIDDLE JOKER：两份原始攻略均写千咲在任一其他角色通关后开放；[OtakuLair](https://www.otakulair.com/english-visual-novel-walkthroughs/riddle-joker-walkthrough-yuzusoft-nekonyan/) 写四线完成，且注明参考誠也，不能作为独立支持。采用誠也与 Chuee 一致的条件。七海追加问题首周目不出现；通常结局仅提供已核对的含追加问题的二周目路径，要求前置，不能跳过此条件宣称首周目可用。
- 沙耶：两处分支；第一处分支选择恢复便不进入第二处。编号仅用于本站识别，隐藏结局剧情。

资料能支持选项含义，却不能确认所有汉化的排列顺序，因此新攻略不显示“第 N 项”。路线树在偏离所收录选法后停止记录导航，不计算未经证实的好感度或结局。

`scripts/build-catalog.mjs` 保存人工核对后的简明分支事实，生成 `data/catalog` 数据；不是自动抓取、文本拼凑或游戏模拟器。后续修正发布时须增加 revision，保留旧数据供已有存档引用。
