# 五试炼 Boss 真实素材短音（2026-10-12，替代被否定的程序纯音）

用户否定上一轮程序纯音为“蚊子叫”。当前15份 `audio/trial-*.m4a` 已全部替换为下列成熟CC0录制／制作音效的短段，不使用振荡器、音高扫描、变调、8bit音库或旧程序音垫底。原 `output/trial-audio/` 试听、PCM、manifest仅为**退役历史**，不代表当前运行素材；旧程序生成脚本由主责封存。

## 来源与授权证据

- StarNinjas [20 Sword Sound Effects](https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes)，CC0 1.0。实际使用 sword.4.ogg。作者描述刀刃实录；以原剑攻击素材作为盾斩。
- artisticdude [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack)，CC0 1.0。木棒／衣架挥空实录，使用 swish-7/8/9.wav；其中魂绑定只倒放原气流，不变调。
- Kenney [Impact Sounds](https://kenney.nl/assets/impact-sounds)，CC0 1.0。使用 Metal、Mining、Soft、Glass 碰撞素材。Glass heavy映射玻璃爆裂反馈，不冒称原片就是完整玻璃打碎录音。
- Vehicle / Ján Schupke [Tinysized SFX](https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx)，CC0 1.0，自然录音；使用 compressed-air-spray-01.wav，蓄力只倒放，不变调。

源ZIP、安全解压副本与来源网页保存在 `output/trial-audio-rework/sources/`；Kenney包内 `impact/License.txt`、Vehicle包内 `tiny/readme.txt` 为额外许可证证据。作者、页面、实际下载URL、每层原片SHA与字节数、完整处理参数和最终SHA详见 `output/trial-audio-rework/manifest.json`。未修改源库。

## 处理与技术检查

复现脚本 `tools/prepare-trial-foley.py`，使用numpy及游戏已有FFmpeg；44.1kHz单声道AAC80kbps。逐事件裁短、去静默／低频、控制尖锐频段、短包络与淡入淡出；仅rift-cut/prism-out有两层，副层增益15%／20%。无硬削波、动态硬压或拉长金属响尾；最终低频30Hz清理仅去DC／rumble。保留自然瞬态，整体RMS不达约-24至-20的撞击标为例外，同时列活跃段RMS；不为统一数值把素材变为连续噪音。

每个最终AAC都解码复核峰值、全段RMS、活跃段RMS、时长及均值。15份合计54,001字节，峰值-8.01至-6.30dBFS，全段RMS-26.21至-21.74dBFS，时长0.186至0.418秒。未调整runtime主音量或接口路径。

| 文件 | 原片（相对于sources） | 实际解码时长 | 峰值dBFS | 全段RMS dBFS |
| --- | --- | --- | --- | --- |
| trial-shield-ready.m4a | impact/Audio/impactMetal_light_000.ogg | 0.209s | -6.64 | -23.82 |
| trial-shield-slash.m4a | sword/sword - StarNinjas/sword.4.ogg | 0.302s | -7.07 | -22.17 |
| trial-wind-charge.m4a | swishes/swishes/swish-8.wav | 0.186s | -8.01 | -21.88 |
| trial-wind-dash.m4a | swishes/swishes/swish-9.wav | 0.209s | -6.63 | -23.34 |
| trial-wind-land.m4a | impact/Audio/impactMining_000.ogg | 0.325s | -6.66 | -23.74 |
| trial-soul-bind.m4a | swishes/swishes/swish-9.wav | 0.209s | -6.30 | -22.73 |
| trial-soul-pulse.m4a | impact/Audio/impactSoft_heavy_002.ogg | 0.255s | -6.85 | -21.74 |
| trial-soul-break.m4a | impact/Audio/impactMining_004.ogg | 0.186s | -6.34 | -24.28 |
| trial-rift-mark.m4a | impact/Audio/impactGlass_light_001.ogg | 0.209s | -6.62 | -24.88 |
| trial-rift-burst.m4a | impact/Audio/impactGlass_heavy_000.ogg | 0.232s | -7.32 | -25.88 |
| trial-rift-cut.m4a | swishes/swishes/swish-7.wav + impact/Audio/impactGlass_light_002.ogg | 0.232s | -7.00 | -22.81 |
| trial-prism-in.m4a | tiny/sfx-cc0/compressed-air-spray-01.wav | 0.302s | -7.66 | -26.21 |
| trial-prism-out.m4a | impact/Audio/impactGlass_medium_002.ogg + impact/Audio/impactMining_001.ogg | 0.325s | -6.79 | -25.67 |
| trial-prism-charge.m4a | tiny/sfx-cc0/compressed-air-spray-01.wav | 0.418s | -6.67 | -24.83 |
| trial-prism-break.m4a | impact/Audio/impactGlass_heavy_003.ogg | 0.232s | -6.43 | -25.49 |

## 试听与边界

`output/trial-audio-rework/five-representatives.wav` 为约12秒五代表：真实剑斩→快挥空→石碎击→玻璃重击→打断玻璃；`all-fifteen.wav` 为20秒全部15项。cue时间顺序见 `cue-order.txt`。原PCM仅在输出目录，不入包。

**Agent未耳听**，没有播放扬声器、上传或打包。指标只说明技术检查，不据此宣布好听；当前应由用户试听评估质感，真实浏览器出招验证由主责另行负责。
