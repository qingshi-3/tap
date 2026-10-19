# 小小守护者素材来源

基础导入脚本 `tools/import-assets.py` 只读取源库，复制单位PNG、少量M4A与旧皮肤/地景。当前运行manifest的UI和部分地景已由 `tools/import-generated-ui.py`、`tools/import-generated-world.py` 覆盖；下文区分当前来源与遗留后备，不将旧导入条目全部视为正在渲染。
动画帧为单位库已还原旋转和裁切的原像素PNG，按sourceId无损排入一张atlas；未使用总览或preview代替游戏素材。
atlas rect保留每帧完整原画布，不缩放、不裁透明区、不改变RGBA像素。535帧仅引用12张单位图，减少手机宿主请求。
width/height为导出帧画布；offset=[0,0]，没有再次裁切。时长取bindings的frame_delay（秒）。

## 单位映射与动作

| 游戏ID | 源ID / 原单位 | 来源绑定 | idle/walk/attack帧数与秒/帧 |
|---|---|---|---|
| shield-1 | f1_silverguardsquire / Silverguard Squire | sdk/cards/factory/core/faction1.coffee:214 | 10 × 0.08 / 8 × 0.08 / 13 × 0.08 |
| shield-2 | f1_tank / Silverguard Knight | sdk/cards/factory/core/faction1.coffee:304 | 11 × 0.08 / 8 × 0.07 / 19 × 0.08 |
| shield-3 | f1_ironcliffeguardian / Ironcliffe Guardian | sdk/cards/factory/core/faction1.coffee:518 | 18 × 0.08 / 8 × 0.08 / 18 × 0.08 |
| archer-1 | f1_backlinearcher / Solpiercer | sdk/cards/factory/firstwatch/faction1.coffee:132 | 12 × 0.08 / 8 × 0.08 / 24 × 0.08 |
| archer-2 | f1_ranged / Rogue Warden | sdk/cards/factory/core/neutral.coffee:509 | 10 × 0.08 / 8 × 0.07 / 15 × 0.08 |
| archer-3 | neutral_arrowwhistler / Arrow Whistler | sdk/cards/factory/monthly/m7_warmasters.coffee:45 | 18 × 0.08 / 8 × 0.08 / 31 × 0.08 |
| engineer | neutral_artificer / Lost Artificer | sdk/cards/factory/wartech/neutral.coffee:105 | 14 × 0.08 / 8 × 0.08 / 51 × 0.08 |
| grunt | neutral_ghoulie / Ghoulie | sdk/cards/factory/unity/neutral.coffee:60 | 14 × 0.08 / 8 × 0.08 / 17 × 0.08 |
| siege | neutral_golemstone / Golem Vanquisher | sdk/cards/factory/core/neutral.coffee:1766 | 14 × 0.08 / 8 × 0.07 / 13 × 0.08 |
| flyer | f1_gryphinox / Gryphon Fledgling | sdk/cards/factory/coreshatter/faction1.coffee:170 | 8 × 0.08 / 7 × 0.08 / 34 × 0.08 |
| boss | boss_borealjuggernaut / Boreal Juggernaut | sdk/cards/factory/misc/bosses.coffee:151 | 16 × 0.08 / 8 × 0.08 / 26 × 0.08 |
| hero | f1_general / Argeon Highmayne | sdk/cards/factory/core/faction1.coffee:81 | 11 × 0.08 / 8 × 0.08 / 23 × 0.08 |

## 当前生成地景

2026-10-14由image_gen生成 `output/art-concepts/generated-ui/environment.png` 与 `grass.png`。`tools/import-generated-world.py` 裁切独立环境对象、保留RGBA并缩至运行尺寸，草地缩为512×512；不修改生成原图。输出为 `world-generated/skin.json` 及PNG，并将下列条目写入运行 `manifest.json`：

| manifest ID | 当前运行文件 |
|---|---|
| grassBackdrop | assets/world-generated/grass.png |
| keep | assets/world-generated/keep.png |
| tower | assets/world-generated/tower.png |
| wall | assets/world-generated/wall.png |
| slow | assets/world-generated/slow.png |
| tree | assets/world-generated/tree.png |
| rock | assets/world-generated/rock.png |

`world-slicing.json` 保留源图SHA256、切片区域、有效边界和导出尺寸。草地背景存在时，渲染跳过旧普通草地格图；树、岩石和建筑使用上表生成素材。当前美术接入仍不等于用户已认可成品。

## MiniWorldSprites遗留与后备裁切

下表记录基础导入来源。keep、tower、wall、slow、tree、rock已由上表覆盖；grass、grassDetail、grassFlowers、path、water仍保留在manifest中，普通草地当前由grassBackdrop替代，未覆盖水格按地图使用。原文件留作遗留与后备。

| 游戏ID | MiniWorldSprites源文件 | rect x,y,w,h |
|---|---|---|
| grass | Ground/Grass.png | [16, 0, 16, 16] |
| grassDetail | Ground/TexturedGrass.png | [0, 0, 16, 16] |
| grassFlowers | Ground/TexturedGrass.png | [32, 16, 16, 16] |
| path | Ground/Grass.png | [48, 0, 16, 16] |
| water | Ground/Grass.png | [0, 0, 16, 16] |
| tree | Nature/Trees.png | [16, 0, 16, 16] |
| rock | Nature/Rocks.png | [0, 0, 16, 16] |
| keep | Buildings/Wood/Keep.png | [0, 0, 32, 32] |
| tower | Buildings/Wood/Tower.png | [0, 16, 16, 16] |
| wall | Buildings/Enemy/SpearWall.png | [0, 0, 16, 16] |
| slow | Nature/Wheatfield.png | [16, 0, 16, 16] |

旧wall使用一段原SpearWall，旧slow使用一格Wheatfield地形标识；当前这两个ID已指向生成素材。

## UI

2026-10-14用户要求UI全部自行AI生成。当前皮肤由image_gen生成：暖红木宽/方按钮正常、按下、禁用状态，深木面板及16种图标。导出清单为 `ui-generated/skin.json`，运行引用由脚本写入 `manifest.json` 的ui字段，不再引用CraftPix皮肤。招募卡面仍引用Duelyst原单位帧，建筑卡面引用当前生成地景，不重绘单位。

生成原图与SHA256、切片区域保留在游戏`output/art-concepts/generated-ui/`；可通过`tools/import-generated-ui.py`重建。仅裁取独立元素并缩至运行尺寸，未改源图。

## 音效

- attack: sfx_f1tank_attack_swing；sdk/cards/factory/core/faction1.coffee:304。游戏共用该已验证事件音效，未复制全部单位声音。
- hit: sfx_f1tank_hit；sdk/cards/factory/core/faction1.coffee:304。游戏共用该已验证事件音效，未复制全部单位声音。
- death: sfx_f1tank_death；sdk/cards/factory/core/faction1.coffee:304。游戏共用该已验证事件音效，未复制全部单位声音。

## 原始来源与许可记录

- 单位：`output/duelyst-unit-library`，追溯到用户的 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main`。用户2026-10-10明确确认这套素材可商用；本记录不另行推断其他库授权。
- 当前UI与生成地景：image_gen于2026-10-14生成，原图及导出记录见游戏 `output/art-concepts/generated-ui/`；以用户喜欢的 `output/art-concepts/user-style-reference.png` 截图为视觉方向参考。此前 `buildings-v1.png`、`palisade-rustic-v2.png` 为候选历史，不是当前运行图集。
- 旧UI：`output/fantasy-ui-library`，源 `C:/Users/qs/asset/UI/craftpix-net-260778-mobile-fantasy-game-interface/mobile_fantasy_game_interface.psd`。原包license.txt记录 https://craftpix.net/file-licenses/；旧按下态采用该用户库已编辑导出的版本，未改原PSD。此来源仅追溯旧版本/遗留文件，当前运行UI不引用。
- MiniWorldSprites遗留/后备地景：用户指定 `C:/Users/qs/Desktop/游戏素材/MiniWorldSprites`。该本地目录未检出独立LICENSE/README，保留用户指定来源事实，不编造额外许可核验；当前覆盖关系见上表。
- 源素材库与生成原图只读；导出脚本仅写入本游戏运行资源与切片记录，不修改、删除或覆盖源库。
