# UI 来源

## 游戏封面

按所有者要求，六部作品使用 Bangumi 游戏条目封面，2026-09-18 查询并保存原图至 `public/images/covers`。条目、图片 URL 和原始尺寸记录在 `src/covers.json`，游戏库提供对应条目链接。封面版权归各作品权利人，不包含在项目代码 MIT 许可内。WA2 使用 PC 终章条目封面，ATRI 使用游戏条目而非动画条目。

## 参考界面

2026-09-24：当前界面参考 [Ravi Klaassens 的 A24 实验站](https://a24.raviklaassens.com/)的光盘陈列、斜向构图、浅色纹理和排版。查询作者及项目公开信息、检查站点交付脚本后，未找到可确认授权复用的项目源码仓库。本站 `DiscLibrary.tsx`、`discs.css`、`editorial.css` 和页面过渡为独立实现，没有复制该站脚本、电影盘面、字体或品牌素材。公开可访问的压缩脚本不等于开源许可。

光盘印刷图案仍使用上文列明的本地 Bangumi 游戏封面，以 CSS 透视、圆孔遮罩和金属渐变合成。没有引入 WebGL、外部动画 SDK、字体服务或新增第三方请求。

### 历史设计来源

上一版按仓库所有者要求，背景与开场动效改编自 AK1116q/onedrive-cf-index-ng。当前已替换该背景及动效，保留其 MIT 许可作为历史归属记录。仓库中的旧猫娘背景素材不再被当前页面加载，不代表为游戏封面取得额外授权。

MIT License

Copyright (c) 2021 Spencer Woo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
