# 音乐来源与加载方式

2026-09-18 核对：只嵌入发布方公开的视频，不复制、下载或托管音频，不声称获得歌曲再分发授权。

| 曲目                                            | 发布方来源                                                                             | 视频                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| コネクト · SACRA BLUE BEATS Mix（官方器乐改编） | [Sony Music](https://www.sonymusic.co.jp/artist/claris/info/543384)                    | [官方视频](https://www.youtube.com/watch?v=24QGd-mX9bU) |
| 光放て！（ATRI 游戏 OP）                        | [Aniplex 新闻稿](https://prtimes.jp/main/html/rd/p/000002427.000016356.html)           | [官方视频](https://www.youtube.com/watch?v=zSLty7g3w30) |
| アイドル / Idol                                 | [The Orchard Japan 新闻稿](https://prtimes.jp/main/html/rd/p/000000672.000055377.html) | [官方视频](https://www.youtube.com/watch?v=ZRtdQ81jPUQ) |

音乐面板按需加载；初次访问不请求 YouTube、外部封面或播放器脚本。点击“加载官方播放器”后才创建 `youtube-nocookie.com` iframe，随后由用户点击播放。遵循 [YouTube 嵌入说明](https://support.google.com/youtube/answer/171780?hl=en)，保留可见播放器与原生控制，不做隐藏音频抽取。

站内切换攻略不会重建播放器；关闭面板或切换曲目会销毁旧 iframe，停止播放。刷新后不会自动加载或播放。播放器可自行调音量、暂停和使用平台允许的画中画。

增强隐私模式不等于匿名：启用播放器后仍会连接 YouTube，播放可能有平台广告、登录或地区限制。无法嵌入时提供原视频链接；网站本身不代理绕过限制，也不使用收费音乐 API。
