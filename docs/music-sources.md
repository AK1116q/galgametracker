# 作品音乐与来源

2026-09-27 核对。歌曲通过可见的 YouTube 官方播放器嵌入，不下载、抽取或重新托管音频。

| 作品 | 曲目 | 来源 / 发布方 | 视频 ID |
| --- | --- | --- | --- |
| 白色相簿2 | 届かない恋 / 上原れな | [King Records 单曲页](https://www.kingrecords.co.jp/cs/g/gKICM-4033/)确认 IC OP；YouTube Rena Uehara - Topic，Space Shower FUGA 分发，F.I.X. RECORDS | [VdOUggE_Yoo](https://www.youtube.com/watch?v=VdOUggE_Yoo) |
| ATRI | 光放て！ / 柳麻美 | [游戏官方公告](https://atri-mdm.com/news/?id=53509)，Aniplex 官方频道 | [zSLty7g3w30](https://www.youtube.com/watch?v=zSLty7g3w30) |
| 千恋＊万花 | 恋ひ恋ふ縁 / KOTOKO | [柚子社官网 OP 嵌入](https://www.yuzu-soft.com/products/senren/movie.html)，官方频道视频说明确认曲名与演唱 | [IazpFBFRvl8](https://www.youtube.com/watch?v=IazpFBFRvl8) |
| 魔女的夜宴 | 恋せよ乙女！ / 米倉千尋 | [柚子社官网 OP 嵌入](https://www.yuzu-soft.com/products/sothewitch/movie.html)，[歌手官方博客](https://blog.excite.co.jp/yonekurachihiro/21603928/)确认曲名与演唱 | [W7ARsYs-Gq0](https://www.youtube.com/watch?v=W7ARsYs-Gq0) |
| RIDDLE JOKER | astral ability / 橋本みゆき、佐咲紗花 | [柚子社官网 OP 嵌入](https://www.yuzu-soft.com/products/riddle/movie.html)，官方频道说明确认演唱 | [0EJ7HvJYe1M](https://www.youtube.com/watch?v=0EJ7HvJYe1M) |
| 沙耶之歌 | 沙耶の唄 / いとうかなこ | [Nitroplus 配信页](https://www.nitroplus.co.jp/goods/music/works/06saya/)确认 ED；Ito Kanako - Topic，NexTone 分发 | [mgk8XTe2lEw](https://www.youtube.com/watch?v=mgk8XTe2lEw) |

## 行为与隐私

- 初次访问不请求 YouTube。打开音乐面板也不连接第三方；点击「开启音乐」后才加载官方 IFrame API 与 `youtube-nocookie.com` 播放器。
- 首次开启尝试播放当前作品；首页中央作品稳定 450ms 后换曲。进入作品页/进度页会跟随该作品，查看记录或设置保持原曲。切篇章只移动唱臂，不强制重播同一首歌。
- 使用同一播放器实例切歌，避免双重播放。用户暂停后，换曲只准备曲目，保持暂停。音量跨换曲保留。关闭面板销毁播放器，刷新后需要重新开启。
- 保留可见播放器和原生控制，不提供隐藏播放器或后台音频抽取。遵循 [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)。额外播放/暂停与音量按钮使用公开 API。
- 浏览器可能阻止有声自动播放，提示再次点击播放；网络失败、嵌入禁用、地区或登录限制提供重试和原视频链接。不能保证所有地区都可播放，尤其无法连接 YouTube 的网络。
- CSP 只为主动启用的官方 API 增加 `script-src https://www.youtube.com`，iframe 仍仅允许隐私增强域名。无第三方音乐 API 费用或密钥。
- 隐私增强模式不等于匿名：启用后仍会连接 YouTube，可能包含广告、登录及平台数据处理。本站不复制曲目、不声称拥有再分发权。

## 唱盘动画

作品页唱臂表示篇章位置，不冒充实际音频时间或阅读百分比。唱盘与首页共用封面组件；切篇章抬臂、移动、落臂。旋转可以暂停，后台页面暂停，系统减少动态效果时取消旋转和位移动画。
