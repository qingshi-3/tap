# 秘境资源

`chest-open.png` 与 `chest-open.json` 来自 pixelfx `pickups/chest-open` 原效果，MIT，原库 https://github.com/patch-gg/pixelfx 。效果作者注明收取闪光参考 Sprite Fusion pickup，MIT，Copyright 2026 Hugo Duprez，https://www.spritefusion.com/pixel-art-vfx/pickup 。

使用现有本地 pixelfx checkout，通过 `tools/render-roguelike-reward.mjs` 调用原库实际渲染并导出，源库保持只读。候选与工具运行检查包含 fire/torch、pickups/collect-burst、pickups/chest-open，接触表位于 `output/roguelike/pixelfx/`。

实际查看后选择带实体木箱、金币与宝石的 chest-open，作为已保存奖励的局部反馈。以15fps导出完整序列，游戏内压缩至1100ms单次播放，仅在奖励成功保存后出现。减少动态、隐藏页面及离开秘境时清理播放。使用预渲染图集，运行时无粒子模拟。

## 遗物与战斗等级图标（2026-11-05）

21张静态PNG复用用户于2026-10-10明确授权可直接商用的Duelyst素材库：`C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/resources/`。原库保持只读。

导出入口 `tools/export-roguelike-icons.mjs [source-root]` 使用原PNG和同名plist的实际帧信息，还原静态`_000.png`常态帧及其透明画布。战斗等级使用原作同系列bronze/gold/elite独立徽章，保留透明轮廓后缩小至128×80以内。图标合计70,444字节。

逐件源文件、实际帧名/裁取坐标、输出尺寸与SHA-256记录在 [`icons/manifest.json`](icons/manifest.json)。UI映射为 `dist/js/roguelike-icons.js` 的 `RELIC_ICONS`、`ROUTE_ICONS`。接触表为 `output/roguelike/ui/icon-contact-sheet.png`；遗物采用原像素图，等级徽章沿用原绘制风格。

| 遗物ID | 原库icons/中的图集 | 视觉语义 |
| --- | --- | --- |
| scout-lantern | artifact_f1_dawnseye | 照明与视野 |
| ember-pouch | bossspell_livingflame | 余烬火焰 |
| hearth-stone | boss_christmas_coal | 暖炉炭石 |
| bone-banner | artifact_f1_ironbanner | 战旗 |
| field-kit | icon_f1_sundropelixir | 治疗药瓶 |
| iron-seed | icon_f5_eggzactly | 种子般的卵与成长符号 |
| war-drum | icon_f1_rally | 鼓舞友军 |
| wing-boots | generalspell_f6_warbird | 羽翼与飞行 |
| oath-shield | artifact_f1_shieldofphalanx | 守护盾牌 |
| sun-chalice | artifact_f5_thegibblecup | 圣杯 |
| sun-script | artifact_f4_soulgrimwar | 书页与典籍 |
| sun-hammer | artifact_f5_godhammer | 锤 |
| rune-nest | icon_f4_nethersummoning | 符文召唤阵 |
| echo-crystal | icon_f6_hailstoneprison | 晶体 |
| storm-bell | boss_christmas_jinglebells | 铃 |
| mourning-quill | icon_neutral_brilliantplume | 羽毛 |
| soul-bowl | icon_f4_voidpulse | 灵魂汲取 |
| grave-candle | bossspell_restoringlight | 灵魂烛光与恢复符号 |

三种战斗等级依次对应 `season_rewards/season_rank_bronze.png`（稳妥）、`season_rank_gold.png`（精英）、`season_rank_elite.png`（首领）。所有图片属于呈现层。
