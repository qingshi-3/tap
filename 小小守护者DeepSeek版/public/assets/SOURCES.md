# DeepSeek 版《小小守护者》实际使用素材

由 `games/deepseek-little-guardians/tools/import-assets.py` 生成；源库全部只读，本脚本不修改、删除或移动任何源文件。
单位帧取自 `output/duelyst-unit-library` 已还原旋转/裁切的原像素 PNG，按 sourceId 无损排入 `public/assets/atlases/<sourceId>.png`；
atlas rect 保留每帧完整原画布，不缩放、不裁透明区、不重绘 RGBA 像素，写入后逐帧 crop 比对解码像素与原 PNG 相等。
`width`/`height` 为帧画布，`offset` 恒为 `[0,0]`；`duration` 取 bindings.json 的 `frame_delay`（秒），未猜测。
`anchor` 为该单位 `idle`+`walk` 全部帧不透明像素（alpha > 0）并集 bbox 的底部中心 `[round((minX+maxX+1)/2), maxY+1]`，逐单位实算；
按 SPEC 2026-10-15 修订**不把 `attack` 计入**（攻击帧常有扑击/下劈等低于站立基准的像素，计入会让单位整体抬高、看起来悬空）。
地景取自 `C:/Users/qs/Desktop/游戏素材/MiniWorldSprites` 的 16×16 原格，只做裁切，不改像素。
**本版 `manifest.ui` 固定为 `{}`**：界面全部由主 Agent 用 Canvas + SVG + CSS 代码绘制，不导出任何 UI 位图。

## 未读取的来源（按任务约束排除）

- `output/fantasy-ui-library`、Tiny Swords、Fantasy Battle Pack、`C:/Users/qs/asset/**`：本次一律未打开、未引用。

## 单位映射与动作

| 游戏ID | sourceId / 原单位 | 来源绑定 | idle/walk/attack（帧数 × 秒/帧） | 帧数 | anchor | atlas |
|---|---|---|---|---|---|---|
| shield-1 | f1_silverguardsquire / Silverguard Squire | sdk/cards/factory/core/faction1.coffee:214 | 10 × 0.08 / 8 × 0.08 / 13 × 0.08 | 31 | [44, 64] | `assets/atlases/f1_silverguardsquire.png` (18449 B) |
| shield-2 | f1_tank / Silverguard Knight | sdk/cards/factory/core/faction1.coffee:304 | 11 × 0.08 / 8 × 0.07 / 19 × 0.08 | 38 | [40, 64] | `assets/atlases/f1_tank.png` (27144 B) |
| shield-3 | f1_ironcliffeguardian / Ironcliffe Guardian | sdk/cards/factory/core/faction1.coffee:518 | 18 × 0.08 / 8 × 0.08 / 18 × 0.08 | 44 | [42, 64] | `assets/atlases/f1_ironcliffeguardian.png` (32072 B) |
| archer-1 | f1_backlinearcher / Solpiercer | sdk/cards/factory/firstwatch/faction1.coffee:132 | 12 × 0.08 / 8 × 0.08 / 24 × 0.08 | 44 | [60, 104] | `assets/atlases/f1_backlinearcher.png` (47077 B) |
| archer-2 | f1_ranged / Rogue Warden | sdk/cards/factory/core/neutral.coffee:509 | 10 × 0.08 / 8 × 0.07 / 15 × 0.08 | 33 | [44, 64] | `assets/atlases/f1_ranged.png` (16220 B) |
| archer-3 | neutral_arrowwhistler / Arrow Whistler | sdk/cards/factory/monthly/m7_warmasters.coffee:45 | 18 × 0.08 / 8 × 0.08 / 31 × 0.08 | 57 | [48, 85] | `assets/atlases/neutral_arrowwhistler.png` (67644 B) |
| mage-1 | f1_sunwisp / Sun Wisp | sdk/cards/factory/shimzar/faction1.coffee:133 | 10 × 0.08 / 10 × 0.08 / 25 × 0.08 | 45 | [52, 84] | `assets/atlases/f1_sunwisp.png` (23764 B) |
| mage-2 | f2_geomancer / Geomancer | sdk/cards/factory/bloodstorm/faction2.coffee:84 | 14 × 0.08 / 8 × 0.08 / 32 × 0.08 | 54 | [44, 85] | `assets/atlases/f2_geomancer.png` (74812 B) |
| mage-3 | f3_pyromancer / Pyromancer | sdk/cards/factory/core/faction3.coffee:277 | 14 × 0.08 / 8 × 0.08 / 12 × 0.08 | 34 | [43, 64] | `assets/atlases/f3_pyromancer.png` (21372 B) |
| spear-1 | f1_sunforgelancer / Sunforge Lancer | sdk/cards/factory/shimzar/faction1.coffee:200 | 13 × 0.08 / 8 × 0.08 / 26 × 0.08 | 47 | [60, 85] | `assets/atlases/f1_sunforgelancer.png` (38500 B) |
| spear-2 | f1_peacekeeper / Peacekeeper | sdk/cards/factory/unity/faction1.coffee:150 | 14 × 0.08 / 8 × 0.08 / 19 × 0.08 | 41 | [40, 84] | `assets/atlases/f1_peacekeeper.png` (45673 B) |
| spear-3 | f3_dervish / Wind Dervish | sdk/cards/factory/core/faction3.coffee:488 | 12 × 0.08 / 8 × 0.08 / 13 × 0.08 | 33 | [39, 62] | `assets/atlases/f3_dervish.png` (18237 B) |
| rider-1 | f5_dreadnaught / Dreadnought | sdk/cards/factory/shimzar/faction5.coffee:228 | 16 × 0.08 / 8 × 0.08 / 26 × 0.08 | 50 | [68, 105] | `assets/atlases/f5_dreadnaught.png` (95014 B) |
| rider-2 | neutral_windrunner / Wind Runner | sdk/cards/factory/monthly/m1_movement.coffee:78 | 8 × 0.08 / 8 × 0.08 / 20 × 0.08 | 36 | [40, 86] | `assets/atlases/neutral_windrunner.png` (31580 B) |
| rider-3 | f6_fenrirwarmaster / Fenrir Warmaster | sdk/cards/factory/core/faction6.coffee:221 | 12 × 0.08 / 8 × 0.08 / 19 × 0.08 | 39 | [44, 84] | `assets/atlases/f6_fenrirwarmaster.png` (36455 B) |
| engineer | neutral_artificer / Lost Artificer | sdk/cards/factory/wartech/neutral.coffee:105 | 14 × 0.08 / 8 × 0.08 / 51 × 0.08 | 73 | [62, 84] | `assets/atlases/neutral_artificer.png` (70595 B) |
| captain | neutral_captainhankheart / Captain Hank Hart | sdk/cards/factory/core/neutral.coffee:3190 | 12 × 0.08 / 6 × 0.08 / 19 × 0.08 | 37 | [38, 84] | `assets/atlases/neutral_captainhankheart.png` (25735 B) |
| ranger | neutral_jaxtruesight / Jax Truesight | sdk/cards/factory/core/neutral.coffee:1482 | 14 × 0.08 / 8 × 0.08 / 21 × 0.08 | 43 | [47, 84] | `assets/atlases/neutral_jaxtruesight.png` (37118 B) |
| grunt | neutral_ghoulie / Ghoulie | sdk/cards/factory/unity/neutral.coffee:60 | 14 × 0.08 / 8 × 0.08 / 17 × 0.08 | 39 | [50, 94] | `assets/atlases/neutral_ghoulie.png` (36037 B) |
| siege | neutral_golemstone / Golem Vanquisher | sdk/cards/factory/core/neutral.coffee:1766 | 14 × 0.08 / 8 × 0.07 / 13 × 0.08 | 35 | [48, 64] | `assets/atlases/neutral_golemstone.png` (12526 B) |
| flyer | f1_gryphinox / Gryphon Fledgling | sdk/cards/factory/coreshatter/faction1.coffee:170 | 8 × 0.08 / 7 × 0.08 / 34 × 0.08 | 49 | [52, 85] | `assets/atlases/f1_gryphinox.png` (47572 B) |
| boss | boss_borealjuggernaut / Boreal Juggernaut | sdk/cards/factory/misc/bosses.coffee:151 | 16 × 0.08 / 8 × 0.08 / 26 × 0.08 | 50 | [68, 105] | `assets/atlases/boss_borealjuggernaut.png` (96643 B) |
| healer | neutral_healingmystic / Healing Mystic | sdk/cards/factory/core/neutral.coffee:2923 | 14 × 0.08 / 8 × 0.08 / 16 × 0.08 | 38 | [53, 93] | `assets/atlases/neutral_healingmystic.png` (42040 B) |
| armored | neutral_ironclad / Ironclad | sdk/cards/factory/monthly/m13_november_monthlies.coffee:107 | 16 × 0.08 / 10 × 0.08 / 39 × 0.08 | 65 | [85, 124] | `assets/atlases/neutral_ironclad.png` (119832 B) |
| splitter | f4_ooz / Ooz | sdk/cards/factory/shimzar/faction4.coffee:130 | 12 × 0.08 / 8 × 0.08 / 22 × 0.08 | 42 | [49, 84] | `assets/atlases/f4_ooz.png` (24851 B) |
| raider | neutral_bloodletter / Decimus | sdk/cards/factory/monthly/m13_november_monthlies.coffee:140 | 22 × 0.08 / 8 × 0.08 / 40 × 0.08 | 70 | [66, 122] | `assets/atlases/neutral_bloodletter.png` (102314 B) |

## 地景裁切（平均色/不透明占比/颜色数均为该格实测值，colors=1 表示纯色无细节）

| 游戏ID | MiniWorldSprites 源文件 | rect x,y,w,h | 实测平均色 | 不透明 | colors |
|---|---|---|---|---|---|
| grass | Ground/Grass.png | [16, 0, 16, 16] | (195, 214, 87) | 100.0% | 1 |
| water | Ground/Grass.png | [0, 0, 16, 16] | (78, 188, 185) | 100.0% | 1 |
| waterDeep | Ground/Shore.png | [64, 0, 16, 16] | (66, 172, 175) | 100.0% | 1 |
| shore | Ground/Shore.png | [0, 0, 16, 16] | (231, 213, 147) | 100.0% | 1 |
| deadGrass | Ground/DeadGrass.png | [16, 0, 16, 16] | (184, 180, 125) | 100.0% | 4 |
| grassDetail | Ground/TexturedGrass.png | [16, 0, 16, 16] | (195, 215, 89) | 100.0% | 3 |
| grassTuft | Ground/TexturedGrass.png | [32, 16, 16, 16] | (178, 212, 86) | 100.0% | 3 |
| tree | Nature/Trees.png | [16, 0, 16, 16] | (127, 161, 85) | 48.4% | 6 |
| rock | Nature/Rocks.png | [0, 0, 16, 16] | (169, 170, 173) | 47.7% | 4 |
| keep | Buildings/Wood/Keep.png | [0, 0, 32, 32] | (159, 141, 120) | 95.5% | 13 |
| tower | Buildings/Wood/Tower.png | [16, 16, 16, 16] | (170, 160, 150) | 95.3% | 11 |
| wall | Buildings/Enemy/SpearWall.png | [0, 0, 16, 16] | (154, 130, 104) | 96.5% | 11 |
| slow | Nature/Wheatfield.png | [16, 0, 16, 16] | (190, 230, 115) | 63.7% | 4 |
| bridge | Miscellaneous/Bridge.png | [48, 16, 16, 16] | (195, 147, 86) | 100.0% | 3 |

2026-10-15 修正一：初版把 `Grass.png` 的格子认错，`water` 与 `grass` 指向同一 rect（都是 `[0,0]`），地图上水草同色。
按逐格实测平均色重新指派：`grass`=[16,0]=(195,214,87) 黄绿草地、`water`=[0,0]=(78,188,185) 青色水面。
`path` 已删除（它指向 `Grass.png[48,0]`=(230,211,145) 暖沙色，与「道路」语义不符），道路改由 `deadGrass` 表达。
`shore` 取 `Ground/Shore.png[0,0]`=(231,213,147)（该文件是沙→水渐变条，[48,0] 实测与水面同色，不能用作岸）。
2026-10-15 修正二：所有地块变体必须 `colors > 1`，否则变体在画面里看不出来。
`grassDetail` 由 TexturedGrass[0,0]（colors=1，与 `grass` 平均色完全相同）改为 [16,0]（colors=3）；
`deadGrass` 由 DeadGrass[0,0]（colors=1 纯色）改为 [16,0]（colors=4，带草茬，道路一眼可读）；
`grassFlowers` **改名为 `grassTuft`**——该格实测是草丛纹理不是花，旧键已不保留，渲染层需改键名。
2026-10-15 修正三：新增 `waterDeep`。**`Cliff-Water.png` 里没有可用的水面格**，实测它是「悬崖小岛」图：
  整张 80×96（5×6 格、26 格不透明）中水只是小岛四周 3~7px 的留白；穷举全部 16×16 窗口（任意偏移共 5265 个），
  不透明覆盖率 100% 的窗口里水色占比最高仅 91%（且横跨两个动画帧、底部带悬崖弧线），网格对齐格最好是 `[0,0]` 水色占比 74%（右下 26% 是悬崖角）。
  故按后备方案取 `Ground/Shore.png[64,0]`=(66,172,175) 作 `waterDeep`：同水色系、比 `water`=(78,188,185) 更深，用于深浅层次；
  代价是该格 `colors=1`，只提供明度层次、不提供纹理（`Shore.png` 全 5 格都是 colors=1）。
`bridge` 取 `Miscellaneous/Bridge.png` 中横向桥的整格桥面（该图 80×48，桥体不落在 16 网格上，故按 16×16 裁出桥面中心格；裁切范围已断言在图内）。

## 音效

- `attack` → `attack`：sfx_f1tank_attack_swing（sdk/cards/factory/core/faction1.coffee:304），已验证事件，取自 `f1_tank`，全游戏共用。
- `hit` → `receiveDamage`：sfx_f1tank_hit（sdk/cards/factory/core/faction1.coffee:304），已验证事件，取自 `f1_tank`，全游戏共用。
- `death` → `death`：sfx_f1tank_death（sdk/cards/factory/core/faction1.coffee:304），已验证事件，取自 `f1_tank`，全游戏共用。

未产出 `wave`/`victory`/`defeat`：`output/duelyst-unit-library` 全部 689 份 `audio_bindings.json` 的语义事件只有
`apply`/`walk`/`attack`/`receiveDamage`/`attackDamage`/`death`，不存在已核验的波次或胜负音效，按契约不编造。

## 原始来源与许可记录

- 单位与音效：`output/duelyst-unit-library`，追溯到用户本地 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main`。用户在 2026-10-10 明确确认这套素材可商用。
- 地景：用户本次指定 `C:/Users/qs/Desktop/游戏素材/MiniWorldSprites`。该目录未检出独立 LICENSE/README，保留用户指定来源事实，不编造额外许可核验。
- 参考实现：`games/little-guardians-h5/tools/import-assets.py`（atlas 排布、逐帧比对、报告结构沿用；本版去掉 UI 并扩充单位键与 anchor）。
- 源库全只读；本脚本不修改、删除、移动或覆盖任何源素材。
