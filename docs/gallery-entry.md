# 首页制作信息与入场动画（2026-10-11）

首页左上角展示制作品牌与原版发行年份，不使用 Steam 移植版或国际版的发行年份。各作品条目来源保存在 `src/gallery-metadata.json` 的 `production` 中。

| 作品 | 制作 | 原版年份 |
| --- | --- | --- |
| [WHITE ALBUM2 -closing chapter-](https://bgm.tv/subject/22290) | Leaf / AQUAPLUS | 2010–2011 |
| [ATRI -My Dear Moments-](https://bgm.tv/subject/297264) | Frontwing × 枕 | 2020 |
| [千恋＊万花](https://bgm.tv/subject/172612) | Yuzusoft | 2016 |
| [サノバウィッチ](https://bgm.tv/subject/113290) | Yuzusoft | 2015 |
| [RIDDLE JOKER](https://bgm.tv/subject/231798) | Yuzusoft | 2018 |
| [沙耶の唄](https://bgm.tv/subject/851) | Nitroplus | 2003 |
| [planetarian ～ちいさなほしのゆめ～](https://bgm.tv/subject/859) | Key | 2004 |
| [narcissu](https://bgm.tv/subject/1167) | ステージなな | 2005 |
| [eden* They were only two, on the planet.](https://bgm.tv/subject/2288) | minori | 2009 |
| [終のステラ](https://bgm.tv/subject/317675) | Key | 2022 |
| [喫茶ステラと死神の蝶](https://bgm.tv/subject/289599) | Yuzusoft | 2019 |
| [魔法使いの夜](https://bgm.tv/subject/5418) | TYPE-MOON | 2012 |
| [グリザイアの果実 -LE FRUIT DE LA GRISAIA-](https://bgm.tv/subject/10869) | Frontwing | 2011 |
| [蒼の彼方のフォーリズム](https://bgm.tv/subject/76912) | sprite | 2014 |
| [DRACU-RIOT!](https://bgm.tv/subject/25370) | Yuzusoft | 2012 |
| [のーぶる☆わーくす](https://bgm.tv/subject/10106) | Yuzusoft | 2010 |

白色相簿 2 包含 IC 与 CC / Coda，显示 2010–2011：[IC 官方产品页](https://leaf.aquaplus.jp/product/wa2ic/product.html)记载 2010-03-26；[CC 官方产品页](https://leaf.aquaplus.jp/product/wa2cc/product.html)记载 2011-12-22。ATRI 制作为 Frontwing × 枕，ANIPLEX.EXE 为发行方。

参考 [A24](https://a24.raviklaassens.com/) 实际刷新过程，使用当前游戏的盘面从较小、倾斜的姿态展开，再显示周围光盘与信息。没有跳过按钮，也没有模拟百分比。优先等待当前图片解码，最多等待 1200 毫秒，再播放 1500 毫秒的入场；减少动态效果设置会直接显示内容。

公司、年份和下方标题共用已经稳定的作品状态：先淡出旧内容，再替换文本，停止滚动后淡入。刷新入场期间暂时禁用主内容操作，完成后恢复；每次刷新重新播放。动画使用 transform 与 opacity，完成后不保留循环或持续帧更新。
