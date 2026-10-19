# Duelyst 资源来源

## P3 木刻羊皮控件（2026-10-15，当前采用）

用户看过三组像素与两组非像素控件概念后选定 P3「木刻羊皮」，覆盖全游戏及隐藏弹窗，替代此前 B 宝石材质。以下由内置 `image_gen` 按 P3 参考生成完整透明木框素材，不由宝石图染色得到；原徽章、人物、原卡框、单位、地图和动态背景保留。

| 包内资源 | 用途 |
| --- | --- |
| `ui/generated/woodland-p3-1.webp` | 蜜金木面、深胡桃木框，主要操作 |
| `ui/generated/woodland-p3-2.webp` | 栗木面、深胡桃木框，普通操作 |
| `ui/generated/woodland-p3-3.webp` | 绿布、木框，阵营入口与部分施法操作 |
| `ui/generated/woodland-p3-4.webp` | 浅米羊皮纸、木框，弹窗与阅读区域 |

原始四格透明素材保留在 `../../output/p3-ui/woodland-p3-source.png`；生成原件为 `C:/Users/qs/.codex/generated_images/01a13b7c-6634-76a1-9946-fffe91f3011f/exec-d2d2b811-f5b0-467e-9a46-775faf31207d.png`。参考为同目录 `exec-9fba64c8-cf70-426f-8434-fb3ede70ff39.png` 的 P3 第三排。按四格切分、裁透明边，最近邻规范为384×384并无损转换为WebP，九宫slice64 fill复用完整面与木框，文字及徽章由界面绘制。未修改源素材库。

本次沿用用户“不做任何验证”的要求：完成资源处理与界面接入，未运行测试、构建、截图或浏览器验收。保留的 B 素材与历史检查不代表 P3 效果或验收结论。

## B 阵营宝石控件（2026-10-15）

用户选定三组控件概念中的 B「阵营宝石」，要求替换全游戏 UI，包含胜败结算等隐藏弹窗。以下完整彩色控件美术由内置 `image_gen` 参考用户选定的 B 概念生成，保留金属包边、宝石厚度与透明切角；原徽章、人物、卡牌原框、单位和动态背景继续使用既有素材。

| 包内资源 | 用途 |
| --- | --- |
| `ui/generated/gemstone-b-1.webp` | 金色／琥珀阵营底座 |
| `ui/generated/gemstone-b-2.webp` | 红宝石阵营底座 |
| `ui/generated/gemstone-b-3.webp` | 青色宝石阵营底座 |
| `ui/generated/gemstone-b-4.webp` | 紫水晶阵营底座 |
| `ui/generated/gemstone-b-5.webp` | 翡翠阵营底座 |
| `ui/generated/gemstone-b-6.webp` | 冰蓝宝石阵营底座 |
| `ui/generated/gemstone-b-7.webp` | 金色主要操作面／边一体控件 |
| `ui/generated/gemstone-b-8.webp` | 青色普通操作及弹窗面／边一体控件 |
| `ui/generated/gemstone-b-9.webp` | 紫色招募、魔法操作及弹窗面／边一体控件 |

原始透明九格素材保留在 `../../output/gemstone-ui/gemstone-b-source.png`；生成原件为 `C:/Users/qs/.codex/generated_images/01a13b7c-6634-76a1-9946-fffe91f3011f/exec-205f8358-ad87-456b-9ce1-71e0adc09505.png`，B 概念参考为同目录 `exec-ae7fe0ba-d567-4ed8-93eb-b6fabe50e176.png` 的中排。素材按九格拆分、裁透明边，分别规范为384×384的无损WebP；CSS九宫切片64 fill，按钮内绘10px、面板18px，文字和图标仍由实际界面绘制。未改写源素材库。

早期白色纹理 `ui/generated/gemstone-facets.png` 的染色方案已被用户否定，不能作为最终 B 美术效果。此次完成接入时用户明确要求不做任何验证，最终渲染、交互及手机／宿主表现未验收；历史处理记录不代表新版验证通过。

## 地形与界面材质（2026-10-13）

用户要求生成与Duelyst整体美术适配的障碍物和UI素材。以下由内置`image_gen`生成，不改动原素材库；完整提示词、原图路径与处理记录见`../../output/quality-audit/generated-assets.md`。地形使用透明PNG；UI材质压缩为WebP，文字与状态仍由界面绘制。

| 包内资源 | 用途与处理 |
| --- | --- |
| `tiles/wall-barricade-v2.png` | 暖灰低矮石墙；生成透明图裁边后nearest缩至384×175，107477字节；按棋格宽90%绘制，足点跟随棋盘透视与拖动 |
| `tiles/rough-debris-v2.png` | 低矮碎石；生成透明图裁边后nearest缩至384×150，93912字节；透视投射到可通行碎石格 |
| `ui/generated/forged-button.webp` | 实心靛蓝锻造金属按钮；生成透明图裁边缩至640×127、WebP质量88，22508字节；不包含文字 |
| `ui/generated/slate-panel.webp` | 深蓝板岩面板纹理；生成原图缩至512×512、WebP质量83，8480字节；供面板与小控件复用 |

原`tiles/tile_wall.png`仍保留来源记录，当前墙格不再把它当作双层地面纹理使用。广告成功奖励图标继续复用原金币/宝珠图，光晕与星芒由CSS局部绘制，不生成全屏闪光。

## 中文界面字体（2026-10-12）

- `fonts/luxiang-ui.woff2`：Noto Sans SC 的本地变量字体子集，修改后内部名称为 Luxiang UI，界面使用 400–600 字重；离线可用，不请求第三方字体服务。数字卡面与战场继续使用原有 Lato。
- 上游：[Google Fonts / Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc)，原文件 `NotoSansSC[wght].ttf` SHA256：`a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da`。
- 许可：SIL Open Font License 1.1，原许可随包保存为 `licenses/NotoSansSC-OFL.txt`；上游版权及许可记录也保留于字体内部。
- 字符范围由 `dist` 中 HTML、JS、CSS 文本生成，未包含的动态文本回退系统中文字体。新增中文文案后可运行 `python tools/build-ui-font.py <上游TTF路径>` 更新，需 fontTools 与 brotli；上游文件不随游戏打包。

2026-10-12：商店宣传图同步新名称《炉乡远征》，以内置imagegen编辑既有授权英雄合成图，仅要求更换标题并保留人物与构图。产物在 `../../platform/store-banner-luxiang.jpg`，完整来源与提示词见 `../../platform/store-materials.md` 的“当前名称与宣传图”节；宣传素材不进入H5包体，源素材库未修改。

源目录：`C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main`。用户于 2026-10-10 确认该目录素材可用于商业项目。源工程根目录的 CC0-1.0 许可文本随包保存在 `licenses/CC0-1.0.txt`。

| 包内资源 | 原工程来源 |
| --- | --- |
| `metagame/original/menu-frostfire.jpg` | `app/original_resources/scenes/frostfire/background.jpg`；2026-10-13使用的历史固定主页冰火城堡暮色背景；现已由30张随机背景池替代，旧资源保留，原图直接复用，不修改源素材 |
| `units/*.png` | `app/original_resources/units/` 中对应的 F1 单位图集 |
| `units/*.plist` | `app/resources/units/` 中对应的 F1 图集帧定义 |
| `spells/roar.png` | `app/original_resources/icons/generalspell_f1_roar.png`，按 `app/resources/icons/generalspell_f1_roar.plist` 的 idle 第 0 帧裁切：`105,0,34,34`；狮王怒吼 |
| `spells/heal.png` | `app/original_resources/icons/icon_f1_sundropelixir.png`，按对应 plist 第 0 帧裁切：`49,49,48,48`；日耀圣露 |
| `spells/strike.png` | `app/original_resources/icons/icon_f1_truestrike.png`，按对应 plist 第 0 帧裁切：`49,196,48,48`；真理打击 |
| `spells/tempest.png` | `app/original_resources/icons/icon_f1_tempest.png`，按对应 plist 第 0 帧裁切：`49,147,48,48`；风暴 |
| `spells/bond.png` | `app/original_resources/icons/icon_f1_divinebond.png`，按对应 plist 第 0 帧裁切：`98,49,48,48`；神圣联结 |
| `tiles/*` | `app/original_resources/tiles/` |
| `tiles/tile_wall.png` | `app/original_resources/tiles/tile_wall.png`；远征石墙地形；SHA256 `09C4FAA2412A25889B7F8A53307E2DF468D028833A4F6112CABD2166C1BDA799` |
| `tiles/tile_box.png` | `app/original_resources/tiles/tile_box.png`；地图格选中框 |
| `tiles/tile_path_attack.png` | `app/original_resources/tiles/tile_path_attack.png`；攻击路径指示 |
| `tiles/tile_spell.png` | `app/original_resources/tiles/tile_spell.png`；法术合法目标与当前落点指示 |
| `tiles/tile_path_move_start.png`、`tile_path_move_straight.png`、`tile_path_move_straight_from_start.png`、`tile_path_move_corner.png`、`tile_path_move_corner_from_start.png`、`tile_path_move_end.png`、`tile_path_move_end_from_start.png` | `app/original_resources/tiles/` 中对应同名普通 128px 文件；移动路径的起点、直线、转角与终点指示 |
| `tiles/tile_merged_large_0@2x.png`、`tile_merged_large_01@2x.png`、`tile_merged_large_0123@2x.png`、`tile_merged_large_013@2x.png`、`tile_merged_large_03@2x.png`、`tile_merged_large_0_seam@2x.png` | `app/original_resources/tiles/` 中对应同名文件；按相邻地图格组合拼接连片范围，其中 `_seam` 用于接缝衔接 |
| `fx/fx_teleportrecallblue.png`、`fx_teleportrecallblue.plist` | `app/resources/fx/` 中对应同名文件；中立随从召唤的亮蓝显现粒子，14 帧 |
| `fx/fx_swirl.png`、`fx_swirl.plist` | `app/resources/fx/` 中对应同名文件；中立随从召唤的蓝色椭圆光环，7 帧 |
| `fx/fx_smoke2.png`、`fx_smoke2.plist` | `app/resources/fx/` 中对应同名文件；中立随从召唤的地面烟雾，8 帧 |
| `maps/background.jpg`、`maps/midground.png`、`maps/foreground.png` | `app/original_resources/maps/redrock/` |
| `maps/battle-redrock-background.jpg` | `app/original_resources/maps/redrock/background.jpg` |
| `maps/battle-redrock-middleground.png` | `app/original_resources/maps/redrock/midground.png` |
| `maps/battle-redrock-foreground.png` | `app/original_resources/maps/redrock/foreground.png` |
| `maps/battlemap7_background.png` | `app/original_resources/maps/battlemap7_background.png` |
| `maps/battlemap7_middleground.png` | `app/original_resources/maps/battlemap7_middleground.png` |
| `maps/battlemap7_foreground.png` | `app/original_resources/maps/battlemap7_foreground.png` |
| `maps/battlemap2_background.png` | `app/original_resources/maps/battlemap2_background.png`；battlemap2 战场背景层 |
| `maps/battlemap2_middleground.png` | `app/original_resources/maps/battlemap2_middleground.png`；battlemap2 战场中景层 |
| `maps/battlemap2_foreground_001.png` | `app/original_resources/maps/battlemap2_foreground_001.png`；battlemap2 战场前景层之一 |
| `maps/battlemap2_foreground_002.png` | `app/original_resources/maps/battlemap2_foreground_002.png`；battlemap2 战场前景层之二 |
| `generals/*` | `app/original_resources/generals/` |
| `card-backgrounds/*` | `app/original_resources/card_backgrounds/` |
| `card-backgrounds/f1-unit.png` | `app/original_resources/card_backgrounds/f1_unit.png` |
| `card-backgrounds/f1-spell.png` | `app/original_resources/card_backgrounds/f1_spell.png` |
| `card-backgrounds/neutral-unit.png` | `app/original_resources/card_backgrounds/neutral_unit.png`；中立单位卡牌框 |
| `ui/card-frame.png` | `app/original_resources/ui/card_background@2x.png` |
| `ui/card-frame-highlight.png` | `app/original_resources/ui/card_background_highlight@2x.png` |
| `ui/card-frame-disabled.png` | `app/original_resources/ui/card_background_disabled@2x.png` |
| `ui/card-frame-replaced.png` | `app/original_resources/ui/card_background_replaced@2x.png` |
| `ui/end-turn-player.png` | `app/original_resources/ui/button_end_turn_mine@2x.png` |
| `ui/end-turn-enemy.png` | `app/original_resources/ui/button_end_turn_enemy@2x.png` |
| `ui/icon-mana.png` | `app/original_resources/ui/icon_mana@2x.png` |
| `ui/icon-mana-inactive.png` | `app/original_resources/ui/icon_mana_inactive@2x.png` |
| `ui/icon-health.png` | `app/original_resources/ui/icon_general_hp@2x.png` |
| `ui/icon_atk.png`、`ui/icon_atk_bw.png`、`ui/icon_hp.png`、`ui/icon_hp_bw.png` | `app/resources/ui/` 中对应同名文件；原版 `StatsNode` 的单位攻血前景图标（己方彩色、敌方黑白） |
| `ui/icon-deck.png` | `app/original_resources/ui/icon_deck@2x.png` |
| `ui/portrait-frame.png` | `app/original_resources/generals/general_portrait_border@2x.png` |
| `ui/portrait-frame-highlight.png` | `app/original_resources/generals/general_portrait_border_highlight@2x.png` |
| `ui/bottom_bar_background.png` | `app/original_resources/ui/bottom_bar_background.png` |
| `metagame/lionheart-gate.jpg` | `app/resources/challenges/gate_000@2x.jpg`；狮心试炼章节主视觉 |
| `metagame/challenge-frame.png` | `app/resources/ui/frame_quest_challenge@2x.png`；章节挑战徽记边框 |
| `metagame/menu-center.png` | `app/resources/ui/symbol_main_menu_center@2x.png`；原版主菜单中心装饰 |
| `metagame/original/play-background.jpg` | `app/resources/play/play_background.jpg`；原版挑战/对战模式选择的 1280×720 全屏背景 |
| `metagame/original/vignette.png` | `app/resources/ui/vignette.png`；原版商店覆盖全屏的 1280×720 暗角层 |
| `metagame/original/button-primary.png`、`button-primary-glow.png` | `app/resources/ui/button_primary.png`、`button_primary_glow.png`；原版 174×54 主操作按钮及悬停/聚焦态，按高度等比缩放整图使用 |
| `metagame/original/button-cancel.png`、`button-cancel-glow.png` | `app/resources/ui/button_cancel.png`、`button_cancel_glow.png`；原版 174×58 取消操作按钮及悬停/聚焦态，按高度等比缩放整图使用 |
| `metagame/original/button-back-corner.png`、`button-back-corner-glow.png` | `app/resources/ui/button_back_corner.png`、`button_back_corner_glow.png`；原版商店与收藏页左上返回角标，CSS 触控盒 90×90 |
| `metagame/original/button-close.png` | `app/resources/ui/button_close.png`；原版通用关闭图标，62×62；普通弹窗使用 62×62 触控盒并按高度等比显示 |
| `metagame/original/paging-button.png`、`paging-arrow.png` | `app/resources/ui/sliding_panel/sliding_panel_paging_button.png`、`sliding_panel_paging_button_text.png`；原版收藏页左右翻页底座（155×155）与左箭头（71×69），右箭头由 CSS `scaleX(-1)` 镜像 |
| `metagame/original/dialogue-border.png` | `app/resources/ui/dialogue_border.png`；挑战列表 65×65 图标槽内使用的圆形边框底图 |
| `metagame/original/challenge-gate-000.jpg`、`challenge-gate-001.jpg`、`challenge-gate-002.jpg` | `app/resources/challenges/gate_000.jpg`、`gate_001.jpg`、`gate_002.jpg`；原版 316×580 挑战章节主视觉 |
| `metagame/original/crest-f1.png` | `app/resources/crests/crest_f1.png`；原版白银阵营徽记，用作章节及导航图标 |
| `metagame/original/crest-f1-deck-select.png` | `app/resources/crests/crest_f1_deck_select.png`；原版狮心阵营牌组预览徽记，430×558 |
| `metagame/original/shop-product-bg.png` | `app/resources/shop/product_bg.png`；原版商店商品面板底图，224×278 |
| `metagame/original/shop-tab-card-backs.png` | `app/resources/shop/menu_icon_card_backs.png`；原版商店卡背分类页签图标，68×72 |
| `metagame/original/unit-shadow.png` | `app/resources/ui/unit_shadow.png`；原版商店商品图标下方 96×48 投影 |
| `fonts/*` | `app/resources/fonts/` |
| `licenses/CC0-1.0.txt` | 工程根目录 `LICENSE` |

当前 13 张卡牌的名称、费用、属性和基础效果依据原工程 `app/sdk/cards/cardsLookup.coffee` 与 `app/sdk/cards/factory/core/faction1.coffee` 摘录。玩法使用本地 H5 实现；卡面与局外 UI 参考并适配原版客户端模板和样式，不引入原服务端。后续添加资源时在此表补充对应来源。

<!-- sync-effects:begin -->

## 原版单位数值与资源来源

单位 ID 对应原工程 `app/sdk/cards/cardsLookup.coffee`；费用、攻击和生命直接读取下表中的原工厂。机制保留原工厂定义；H5 的确定性表现差异在游戏任务记录中说明。详细原机制与动画审计由 `.unit-fx-audit.json` 保存。

| 原版 ID / 工厂名称 | 费用 / 攻击 / 生命 | 原工程工厂 |
| --- | --- | --- |
| 1 / General | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction1.coffee` |
| 8 / LysianBrawler | 4 / 4 / 4 | `app/sdk/cards/factory/core/faction1.coffee` |
| 9 / WindbladeAdept | 2 / 2 / 3 | `app/sdk/cards/factory/core/faction1.coffee` |
| 10 / SunstoneTemplar | 2 / 1 / 4 | `app/sdk/cards/factory/core/faction1.coffee` |
| 11 / SilverguardKnight | 3 / 1 / 5 | `app/sdk/cards/factory/core/faction1.coffee` |
| 12 / ArclyteSentinel | 3 / 2 / 4 | `app/sdk/cards/factory/core/faction1.coffee` |
| 13 / WindbladeCommander | 5 / 0 / 8 | `app/sdk/cards/factory/core/faction1.coffee` |
| 14 / SilverguardSquire | 1 / 1 / 4 | `app/sdk/cards/factory/core/faction1.coffee` |
| 15 / Lightchaser | 2 / 3 / 2 | `app/sdk/cards/factory/core/faction1.coffee` |
| 16 / SuntideMaiden | 4 / 3 / 6 | `app/sdk/cards/factory/core/faction1.coffee` |
| 17 / IroncliffeGuardian | 5 / 3 / 10 | `app/sdk/cards/factory/core/faction1.coffee` |
| 18 / ElyxStormblade | 6 / 7 / 7 | `app/sdk/cards/factory/core/faction1.coffee` |
| 21 / AzuriteLion | 2 / 2 / 3 | `app/sdk/cards/factory/core/faction1.coffee` |
| 22 / Sunriser | 4 / 3 / 4 | `app/sdk/cards/factory/core/faction1.coffee` |
| 23 / AltGeneral | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction1.coffee` |
| 101 / General | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction2.coffee` |
| 108 / Heartseeker | 1 / 1 / 1 | `app/sdk/cards/factory/core/faction2.coffee` |
| 109 / Widowmaker | 3 / 2 / 3 | `app/sdk/cards/factory/core/faction2.coffee` |
| 110 / KaidoAssassin | 2 / 2 / 3 | `app/sdk/cards/factory/core/faction2.coffee` |
| 111 / ScarletViper | 5 / 2 / 5 | `app/sdk/cards/factory/core/faction2.coffee` |
| 112 / GoreHorn | 3 / 3 / 3 | `app/sdk/cards/factory/core/faction2.coffee` |
| 113 / OnyxBear | 1 / 0 / 2 | `app/sdk/cards/factory/core/faction2.coffee` |
| 114 / JadeOgre | 3 / 4 / 3 | `app/sdk/cards/factory/core/faction2.coffee` |
| 115 / ChakriAvatar | 2 / 1 / 2 | `app/sdk/cards/factory/core/faction2.coffee` |
| 116 / MageOfFourWinds | 4 / 4 / 4 | `app/sdk/cards/factory/core/faction2.coffee` |
| 117 / CelestialPhantom | 3 / 1 / 5 | `app/sdk/cards/factory/core/faction2.coffee` |
| 119 / HamonBlademaster | 5 / 8 / 8 | `app/sdk/cards/factory/core/faction2.coffee` |
| 120 / KeshraiFanblade | 4 / 5 / 3 | `app/sdk/cards/factory/core/faction2.coffee` |
| 121 / TuskBoar | 2 / 2 / 3 | `app/sdk/cards/factory/core/faction2.coffee` |
| 122 / LanternFox | 3 / 2 / 3 | `app/sdk/cards/factory/core/faction2.coffee` |
| 123 / AltGeneral | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction2.coffee` |
| 130 / BattlePanddo | 3 / 2 / 4 | `app/sdk/cards/factory/shimzar/faction2.coffee` |
| 201 / General | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction3.coffee` |
| 208 / WindShrike | 4 / 4 / 3 | `app/sdk/cards/factory/core/faction3.coffee` |
| 209 / StarfireScarab | 5 / 4 / 6 | `app/sdk/cards/factory/core/faction3.coffee` |
| 210 / SandHowler | 3 / 3 / 3 | `app/sdk/cards/factory/core/faction3.coffee` |
| 211 / Dunecaster | 2 / 2 / 1 | `app/sdk/cards/factory/core/faction3.coffee` |
| 212 / OrbWeaver | 3 / 2 / 2 | `app/sdk/cards/factory/core/faction3.coffee` |
| 213 / Pyromancer | 2 / 2 / 1 | `app/sdk/cards/factory/core/faction3.coffee` |
| 214 / BrazierRedSand | 2 / 0 / 6 | `app/sdk/cards/factory/core/faction3.coffee` |
| 215 / BrazierGoldenFlame | 3 / 0 / 6 | `app/sdk/cards/factory/core/faction3.coffee` |
| 216 / BrazierDuskWind | 2 / 0 / 4 | `app/sdk/cards/factory/core/faction3.coffee` |
| 217 / Dervish | 2 / 2 / 2 | `app/sdk/cards/factory/core/faction3.coffee` |
| 219 / MirrorMaster | 4 / 1 / 1 | `app/sdk/cards/factory/core/faction3.coffee` |
| 220 / AymaraHealer | 6 / 5 / 5 | `app/sdk/cards/factory/core/faction3.coffee` |
| 221 / PortalGuardian | 3 / 0 / 8 | `app/sdk/cards/factory/core/faction3.coffee` |
| 223 / AltGeneral | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction3.coffee` |
| 225 / IronDervish | 1 / 2 / 2 | `app/sdk/cards/factory/core/faction3.coffee` |
| 301 / General | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction4.coffee` |
| 308 / AbyssalCrawler | 1 / 2 / 1 | `app/sdk/cards/factory/core/faction4.coffee` |
| 309 / AbyssalJuggernaut | 4 / 3 / 3 | `app/sdk/cards/factory/core/faction4.coffee` |
| 310 / BloodmoonPriestess | 4 / 3 / 3 | `app/sdk/cards/factory/core/faction4.coffee` |
| 311 / ShadowWatcher | 3 / 2 / 2 | `app/sdk/cards/factory/core/faction4.coffee` |
| 312 / DeepfireDevourer | 4 / 4 / 4 | `app/sdk/cards/factory/core/faction4.coffee` |
| 313 / DarkSiren | 2 / 3 / 2 | `app/sdk/cards/factory/core/faction4.coffee` |
| 314 / VorpalReaver | 6 / 6 / 6 | `app/sdk/cards/factory/core/faction4.coffee` |
| 315 / Wraithling | 1 / 1 / 1 | `app/sdk/cards/factory/core/faction4.coffee` |
| 316 / DarkspineElemental | 2 / 1 / 4 | `app/sdk/cards/factory/core/faction4.coffee` |
| 317 / GloomChaser | 2 / 2 / 2 | `app/sdk/cards/factory/core/faction4.coffee` |
| 318 / SharianShadowdancer | 5 / 4 / 4 | `app/sdk/cards/factory/core/faction4.coffee` |
| 319 / NightsorrowAssassin | 3 / 2 / 1 | `app/sdk/cards/factory/core/faction4.coffee` |
| 320 / SpectralRevenant | 8 / 6 / 6 | `app/sdk/cards/factory/core/faction4.coffee` |
| 321 / BlackSolus | 5 / 4 / 7 | `app/sdk/cards/factory/core/faction4.coffee` |
| 323 / AltGeneral | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction4.coffee` |
| 401 / General | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction5.coffee` |
| 402 / EarthWalker | 3 / 3 / 3 | `app/sdk/cards/factory/core/faction5.coffee` |
| 403 / Grimrock | 4 / 3 / 4 | `app/sdk/cards/factory/core/faction5.coffee` |
| 404 / Kolossus | 5 / 1 / 7 | `app/sdk/cards/factory/core/faction5.coffee` |
| 405 / MakantorWarbeast | 6 / 4 / 4 | `app/sdk/cards/factory/core/faction5.coffee` |
| 406 / Phalanxar | 2 / 6 / 1 | `app/sdk/cards/factory/core/faction5.coffee` |
| 407 / Elucidator | 4 / 5 / 4 | `app/sdk/cards/factory/core/faction5.coffee` |
| 408 / UnstableLeviathan | 7 / 11 / 11 | `app/sdk/cards/factory/core/faction5.coffee` |
| 410 / PrimordialGazer | 3 / 2 / 2 | `app/sdk/cards/factory/core/faction5.coffee` |
| 411 / Egg | 0 / 0 / 1 | `app/sdk/cards/factory/core/faction5.coffee` |
| 412 / YoungSilithar | 2 / 2 / 3 | `app/sdk/cards/factory/core/faction5.coffee` |
| 413 / VeteranSilithar | 4 / 4 / 4 | `app/sdk/cards/factory/core/faction5.coffee` |
| 414 / SilitharElder | 7 / 7 / 7 | `app/sdk/cards/factory/core/faction5.coffee` |
| 415 / SpiritHarvester | 5 / 5 / 5 | `app/sdk/cards/factory/core/faction5.coffee` |
| 417 / Vindicator | 3 / 1 / 3 | `app/sdk/cards/factory/core/faction5.coffee` |
| 418 / AltGeneral | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction5.coffee` |
| 501 / General | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction6.coffee` |
| 503 / FenrirWarmaster | 3 / 3 / 2 | `app/sdk/cards/factory/core/faction6.coffee` |
| 504 / GhostWolf | 2 / 3 / 2 | `app/sdk/cards/factory/core/faction6.coffee` |
| 505 / CrystalCloaker | 2 / 2 / 3 | `app/sdk/cards/factory/core/faction6.coffee` |
| 506 / CrystalWisp | 2 / 1 / 1 | `app/sdk/cards/factory/core/faction6.coffee` |
| 507 / ArcticRhyno | 5 / 6 / 5 | `app/sdk/cards/factory/core/faction6.coffee` |
| 508 / PrismaticGiant | 6 / 4 / 8 | `app/sdk/cards/factory/core/faction6.coffee` |
| 509 / IceDrake | 4 / 4 / 8 | `app/sdk/cards/factory/core/faction6.coffee` |
| 510 / WyrBeast | 1 / 2 / 1 | `app/sdk/cards/factory/core/faction6.coffee` |
| 511 / WolfRaven | 3 / 1 / 4 | `app/sdk/cards/factory/core/faction6.coffee` |
| 512 / BoreanBear | 2 / 1 / 3 | `app/sdk/cards/factory/core/faction6.coffee` |
| 513 / Razorback | 4 / 4 / 3 | `app/sdk/cards/factory/core/faction6.coffee` |
| 514 / AncientGrove | 7 / 7 / 7 | `app/sdk/cards/factory/core/faction6.coffee` |
| 515 / VoiceoftheWind | 4 / 4 / 4 | `app/sdk/cards/factory/core/faction6.coffee` |
| 516 / Treant | 1 / 1 / 1 | `app/sdk/cards/factory/core/faction6.coffee` |
| 517 / HearthSister | 2 / 3 / 2 | `app/sdk/cards/factory/core/faction6.coffee` |
| 518 / WaterBear | 1 / 2 / 2 | `app/sdk/cards/factory/core/faction6.coffee` |
| 519 / SnowElemental | 3 / 2 / 3 | `app/sdk/cards/factory/core/faction6.coffee` |
| 520 / WolfAspect | 2 / 3 / 3 | `app/sdk/cards/factory/core/faction6.coffee` |
| 523 / GravityWell | 1 / 0 / 1 | `app/sdk/cards/factory/core/faction6.coffee` |
| 525 / BonechillBarrier | 1 / 0 / 2 | `app/sdk/cards/factory/core/faction6.coffee` |
| 526 / ArcticDisplacer | 5 / 10 / 4 | `app/sdk/cards/factory/core/faction6.coffee` |
| 527 / AltGeneral | 0 / 2 / 25 | `app/sdk/cards/factory/core/faction6.coffee` |
| 533 / IceDryad | 3 / 3 / 3 | `app/sdk/cards/factory/shimzar/faction6.coffee` |
| 10001 / SpottedDragonlark | 1 / 2 / 1 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10012 / SaberspineTiger | 4 / 3 / 2 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10013 / PhaseHound | 3 / 4 / 3 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10016 / RepulsionBeast | 3 / 2 / 2 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10017 / FireSpitter | 4 / 3 / 2 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10018 / KomodoCharger | 1 / 1 / 3 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10019 / PlanarScout | 1 / 2 / 1 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10020 / EphemeralShroud | 2 / 1 / 1 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10021 / ValeHunter | 2 / 1 / 2 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10204 / BrightmossGolem | 5 / 4 / 9 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10207 / StormmetalGolem | 6 / 8 / 8 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10301 / SunSeer | 3 / 2 / 4 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10306 / Lightbender | 4 / 3 / 3 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10307 / Serpenti | 6 / 7 / 4 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10958 / DaggerKiri | 5 / 2 / 8 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10959 / DancingBlades | 5 / 4 / 6 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10973 / LuxIgnis | 5 / 2 / 5 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10978 / HailstoneGolem | 4 / 4 / 6 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10979 / Maw | 2 / 2 / 2 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10981 / HealingMystic | 2 / 2 / 3 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10982 / VoidHunter | 3 / 4 / 2 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10984 / FirstSwordofAkrane | 6 / 7 / 7 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10986 / Eclipse | 6 / 3 / 7 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10994 / ZenRui | 6 / 4 / 4 | `app/sdk/cards/factory/core/neutral.coffee` |
| 10995 / EmeraldRejuvenator | 4 / 4 / 4 | `app/sdk/cards/factory/core/neutral.coffee` |
| 11023 / Bonereaper | 6 / 2 / 9 | `app/sdk/cards/factory/monthly/m5_provoke.coffee` |
| 11026 / WarTalon | 7 / 4 / 9 | `app/sdk/cards/factory/monthly/m5_provoke.coffee` |
| 11030 / SunsetParagon | 5 / 3 / 2 | `app/sdk/cards/factory/monthly/m6_forcefield.coffee` |
| 11032 / Bloodletter | 6 / 4 / 6 | `app/sdk/cards/factory/core/neutral.coffee` |
| 19026 / RockPulverizer | 2 / 1 / 4 | `app/sdk/cards/factory/core/neutral.coffee` |
| 19027 / PrimusShieldmaster | 4 / 3 / 6 | `app/sdk/cards/factory/core/neutral.coffee` |
| 19033 / PutridMindflayer | 3 / 2 / 4 | `app/sdk/cards/factory/core/neutral.coffee` |
| 19034 / FlameWing | 4 / 5 / 4 | `app/sdk/cards/factory/core/neutral.coffee` |
| 19037 / PrimusFist | 2 / 2 / 3 | `app/sdk/cards/factory/core/neutral.coffee` |
| 19040 / PiercingMantis | 2 / 2 / 2 | `app/sdk/cards/factory/core/neutral.coffee` |
| 19042 / FrostboneNaga | 4 / 3 / 3 | `app/sdk/cards/factory/core/neutral.coffee` |
| 19047 / MirkbloodDevourer | 3 / 2 / 4 | `app/sdk/cards/factory/core/neutral.coffee` |
| 19049 / Sojourner | 3 / 1 / 5 | `app/sdk/cards/factory/core/neutral.coffee` |
| 19050 / AzureHornShaman | 2 / 1 / 4 | `app/sdk/cards/factory/core/neutral.coffee` |
| 19052 / BloodtearAlchemist | 1 / 2 / 1 | `app/sdk/cards/factory/core/neutral.coffee` |

原工程缺失的特效配方：

- 113 / OnyxBear：原工厂引用 `FX.Cards.Faction2.OnyxBear`，但源 `app/data/fx.js` 没有该配方。H5 保留原阵营公共配方。自身原动画和音效不替换。
- 130 / BattlePanddo：原工厂引用 `FX.Cards.Faction2.BattlePanddo`，但源 `app/data/fx.js` 没有该配方。H5 保留原阵营公共配方。自身原动画和音效不替换。
- 216 / BrazierDuskWind：原工厂引用 `FX.Cards.Faction3.BrazierDuskWind`，但源 `app/data/fx.js` 没有该配方。H5 复用 `FX.Cards.Faction3.BrazierRedSand`。自身原动画和音效不替换。
- 506 / CrystalWisp：原工厂引用 `FX.Cards.Faction6.CrystalWisp`，但源 `app/data/fx.js` 没有该配方。H5 保留原阵营公共配方。自身原动画和音效不替换。
- 509 / IceDrake：原工厂引用 `FX.Cards.Neutral.IceDrake`，但源 `app/data/fx.js` 没有该配方。H5 保留原阵营公共配方。自身原动画和音效不替换。
- 512 / BoreanBear：原工厂引用 `FX.Cards.Faction6.BoreanBear`，但源 `app/data/fx.js` 没有该配方。H5 保留原阵营公共配方。自身原动画和音效不替换。
- 518 / WaterBear：原工厂引用 `FX.Cards.Faction6.WaterBear`，但源 `app/data/fx.js` 没有该配方。H5 保留原阵营公共配方。自身原动画和音效不替换。
- 523 / GravityWell：原工厂引用 `FX.Cards.Faction6.GravityWell`，但源 `app/data/fx.js` 没有该配方。H5 保留原阵营公共配方。自身原动画和音效不替换。
- 525 / BonechillBarrier：原工厂引用 `FX.Cards.Faction6.BonechillBarrier`，但源 `app/data/fx.js` 没有该配方。H5 保留原阵营公共配方。自身原动画和音效不替换。
- 10018 / KomodoCharger：原工厂引用 `FX.Cards.Neutral.KomodoCharger`，但源 `app/data/fx.js` 没有该配方。H5 保留原阵营公共配方。自身原动画和音效不替换。
- 10978 / HailstoneGolem：原工厂引用 `FX.Cards.Neutral.HailstoneGolem`，但源 `app/data/fx.js` 没有该配方。H5 保留原阵营公共配方。自身原动画和音效不替换。
- 19037 / PrimusFist：原工厂引用 `undefined`，但源 `app/data/fx.js` 没有该配方。H5 保留原阵营公共配方。自身原动画和音效不替换。

## 特效同步资源

以下文件由 `node tools/sync-effects.mjs` 从只读源工程同步，并以 SHA256 核对。

| 包内资源 | 原工程来源 | SHA256 |
| --- | --- | --- |
| `card-backgrounds/f1-spell.png` | `app/resources/card_backgrounds/f1_spell.png` | `57addfd0a737bf05783d220f1447fc57e2f8e8d3ebd890ac00b7366ec35f5741` |
| `card-backgrounds/f1-unit.png` | `app/resources/card_backgrounds/f1_unit.png` | `702583458f892603b8ed3d9c94ab7e307a48e2c9ba9bd0eef728ce610005df17` |
| `card-backgrounds/f2-spell.png` | `app/resources/card_backgrounds/f2_spell.png` | `511b88e56f2c54a8428e0b16ca623f2b4e512db31c83ecd63cb4c8cbe7dc65d3` |
| `card-backgrounds/f2-unit.png` | `app/resources/card_backgrounds/f2_unit.png` | `a9e801bb87cc8003f65814df2c857be4f7a75bd6fbba3bc0931a0107767b2916` |
| `card-backgrounds/f3-spell.png` | `app/resources/card_backgrounds/f3_spell.png` | `5405845eabbde46f1d46c3986e47fce0f3e07693059086eb0ede6fe2ae033d39` |
| `card-backgrounds/f3-unit.png` | `app/resources/card_backgrounds/f3_unit.png` | `39e9f599b88dcb81e273abe5fbddf4b9482569829cc2bfded83fe510111dead5` |
| `card-backgrounds/f4-spell.png` | `app/resources/card_backgrounds/f4_spell.png` | `497c8c17263e73acc5622c699b1e3a43de8a1fc64d00d5cecbb4e1f82c8f7e30` |
| `card-backgrounds/f4-unit.png` | `app/resources/card_backgrounds/f4_unit.png` | `26f6593b489f4b8b8931d30076eacc1b50359ad0205607e7727d009e408840f5` |
| `card-backgrounds/f5-spell.png` | `app/resources/card_backgrounds/f5_spell.png` | `d42f4ee97d5fa35137ef6c097ec5bd17e3bd812cd8f59f4596fc670097809dc9` |
| `card-backgrounds/f5-unit.png` | `app/resources/card_backgrounds/f5_unit.png` | `d161f2b18e4eba835acf25dc4a384d41af1fb331d68ca99cbcbd8d547612be0b` |
| `card-backgrounds/f6-spell.png` | `app/resources/card_backgrounds/f6_spell.png` | `7771c72f4de75a741fa2a04c773144ad1b611118c192eeaca19603c3f2585298` |
| `card-backgrounds/f6-unit.png` | `app/resources/card_backgrounds/f6_unit.png` | `7945a7a2e256038dc787388caec99689b81ba5a808d9321f7d3e1aa5470bb084` |
| `card-backgrounds/stats_hp_simple_bg.png` | `app/resources/card_backgrounds/stats_hp_simple_bg.png` | `203e3f5d61ff9e3b56068f616889ebeb6ed1120060011a34e642e9d61f679628` |
| `crests/crest_f1.png` | `app/resources/crests/crest_f1.png` | `e3159a48d3564b77bc59f340589e349d3c16c66539e9a8d9c297a7d1b398a1ef` |
| `crests/crest_f2.png` | `app/resources/crests/crest_f2.png` | `2f512057e5d498d1774b6588db691f496580ccc85959ded46c883b10a731246a` |
| `crests/crest_f3.png` | `app/resources/crests/crest_f3.png` | `dbf836704f124f1f0ee772516e60327121eada798a04908d26a6af03e001cc06` |
| `crests/crest_f4.png` | `app/resources/crests/crest_f4.png` | `6e392cd5921a0829345d428aafe4ddb5457e04bb1a86b75667ec79255c01b95d` |
| `crests/crest_f5.png` | `app/resources/crests/crest_f5.png` | `5e72539eea32152dde5813984055d7fa8d3933d78f01d10e0eff9e1ddc5c1412` |
| `crests/crest_f6.png` | `app/resources/crests/crest_f6.png` | `cdba08610bfd4419e118fbf64fb368bd56991593294a59e1425e8fab7da68888` |
| `decals/artifact.png` | `app/resources/decals/artifact.png` | `db3350d0ff48f1a0918e5e07e428698412d327f6328f0ca2445b7ccde4247c04` |
| `decals/banded.png` | `app/resources/decals/banded.png` | `db3350d0ff48f1a0918e5e07e428698412d327f6328f0ca2445b7ccde4247c04` |
| `decals/provoke.png` | `app/resources/decals/provoke.png` | `40a3fdb7b8e1e37e90cc59047b252c5ff9007c776127afa1a2712878bf9b5cbd` |
| `fonts/Lato-Bold.ttf` | `app/resources/fonts/Lato-Bold.ttf` | `14f7de6b616950395062902eb8f70f01c0a901223db5d40f2a05728ac4a830f6` |
| `fx/circleswirls.plist` | `app/resources/particles/circleswirls.plist` | `a7f8739a930c1add9a97d56f13c37f2620e66439579bcd24659904100da522d7` |
| `fx/dotsquaregreen.plist` | `app/resources/particles/dotsquaregreen.plist` | `77e6c34f2a201b6c2135c264109b5d42245114ac622788b5202ea3b356da8cfd` |
| `fx/f3_fx_entropicdecay.plist` | `app/resources/fx/f3_fx_entropicdecay.plist` | `3af7d42d686125c22466f6ad1a6deb48256a05387bc7ad2f11f7a98f32b60def` |
| `fx/f3_fx_entropicdecay.png` | `app/resources/fx/f3_fx_entropicdecay.png` | `5ac59be2adbe8d064192231d4cce1e0d395223bc54217aab3b8c8ce4d1e05851` |
| `fx/fx_animalslash.plist` | `app/resources/fx/fx_animalslash.plist` | `9e7544f48adb3558c89aab186a32d265aaf0f827e49a9305bf5c96eb5752a402` |
| `fx/fx_animalslash.png` | `app/resources/fx/fx_animalslash.png` | `cb17be38571b2fd42584145f6358100f8c2d1ceac10e7b5ffff09278823ad4ac` |
| `fx/fx_bladestorm.plist` | `app/resources/fx/fx_bladestorm.plist` | `48a2aaa3ad39f88a5a076b76131ee423207ac04687a84e6cd49b3208d9f28505` |
| `fx/fx_bladestorm.png` | `app/resources/fx/fx_bladestorm.png` | `4acbfb0fef35bdee7fbc9e99827e40983c472b762d8b9746fa195dfc3fdb1e99` |
| `fx/fx_blood_explosion.plist` | `app/resources/fx/fx_blood_explosion.plist` | `7f6f18036928ace38d04c6b1203d3e9e82bf75b469d6882b2bbae7c922a9f712` |
| `fx/fx_blood_explosion.png` | `app/resources/fx/fx_blood_explosion.png` | `d113a48c17716aba026196b5727f35d0331fe89292c7803054d2709a5e1aba6f` |
| `fx/fx_bloodground.plist` | `app/resources/fx/fx_bloodground.plist` | `2ee73dfda709005dfe737e878278be8bae4f47fcf283860c8ba7d1f5c2ff540d` |
| `fx/fx_bloodground.png` | `app/resources/fx/fx_bloodground.png` | `3d5f94be4b1df904db81426dbf532c44a472494760d86ca70fae8d9a018f5138` |
| `fx/fx_blueplasma_vertical.plist` | `app/resources/fx/fx_blueplasma_vertical.plist` | `427309b8bb7c9bea6bd21d42bc7a6e8dcff0a1ca5a00703c3a784195aff69b6e` |
| `fx/fx_blueplasma_vertical.png` | `app/resources/fx/fx_blueplasma_vertical.png` | `694580247e08a2e092e5195f2f95d3cb158c1e08a0f7696206751d51c4a4b9ce` |
| `fx/fx_bluewatersplash.plist` | `app/resources/fx/fx_bluewatersplash.plist` | `860c4f7dbd454774a80bc1e12bb27986d0c03cd13ee4f85b429d7af0163b3fe8` |
| `fx/fx_bluewatersplash.png` | `app/resources/fx/fx_bluewatersplash.png` | `24e1b2a9ea0084cb91d6b8df986938008dd658842995c147822b94f137768f55` |
| `fx/fx_buff.plist` | `app/resources/fx/fx_buff.plist` | `d3b758e60d0bf6ae6139853e7d801c131e4eb3540ea21d5a37c290216cfa1721` |
| `fx/fx_buff.png` | `app/resources/fx/fx_buff.png` | `d2063dbd8e5c7de8c2a48802157ff3de58efda2bf9ed7e8a2b85ce2a8b905bf4` |
| `fx/fx_chainlightning.plist` | `app/resources/fx/fx_chainlightning.plist` | `fdfaa79c07a4eb96b45184fa7593813fe909dfada0628f2c6547e8c71d06d527` |
| `fx/fx_chainlightning.png` | `app/resources/fx/fx_chainlightning.png` | `8b96b0fe8e8b224b5c7d3a62454c0df6ebd642a6de7e7b9c5a3b56cd396f21ad` |
| `fx/fx_clawslash.plist` | `app/resources/fx/fx_clawslash.plist` | `e9416e6482739220377e16cc67a5573b55b8532bc2e4532f61109a7951a2b0e6` |
| `fx/fx_clawslash.png` | `app/resources/fx/fx_clawslash.png` | `9e7dff7eef76200d2441c8dc83098844d678eabbefd4867a9afe77d1ca8efbaa` |
| `fx/fx_cleanse.plist` | `app/resources/fx/fx_cleanse.plist` | `ba59b907cd185cc9986aac6192ea585974852a991c5077f472574fa948d87b68` |
| `fx/fx_cleanse.png` | `app/resources/fx/fx_cleanse.png` | `3954bdd1a4a1bbee946172c508b3ffd936cd003f6a010a962b64dadf69a406d7` |
| `fx/fx_collision.plist` | `app/resources/fx/fx_collision.plist` | `25a0eb461afa45c8b4b3fb27672974f85847fac0bcb8ab84f1189552a44c62fb` |
| `fx/fx_collision.png` | `app/resources/fx/fx_collision.png` | `8e614bec63ad79ebcae9c90ac65f10265b5399973462f2bd1bf9ec0a9c6936bd` |
| `fx/fx_collisionsparkgreen.plist` | `app/resources/fx/fx_collisionsparkgreen.plist` | `c103cea409a856d68fcc213e73dc93d79cea20d97997ae12022ebb1b79e2e432` |
| `fx/fx_collisionsparkgreen.png` | `app/resources/fx/fx_collisionsparkgreen.png` | `26259d51456dbea30294bb2877385cbbd63de3cc1c020d64168192aefded3ec0` |
| `fx/fx_collisionsparkpurple.plist` | `app/resources/fx/fx_collisionsparkpurple.plist` | `65bd4a429d4ef7e987eedda094ea12275729ba68fafde872da38fd00d6fe28b0` |
| `fx/fx_collisionsparkpurple.png` | `app/resources/fx/fx_collisionsparkpurple.png` | `4a0ec27db894fed6f5b893fdf97d4a27a529374d8d897748679775bbb4749ee6` |
| `fx/fx_collisionsparkred.plist` | `app/resources/fx/fx_collisionsparkred.plist` | `90587c78f4d5b67e1aecbb2a32e52f7a1138413d0e917b4374352436810b090f` |
| `fx/fx_collisionsparkred.png` | `app/resources/fx/fx_collisionsparkred.png` | `059ca08703dbb6a2e6cae9144166ea003a4398dc8965aa7707c8b8684ec29762` |
| `fx/fx_crossslash_x.plist` | `app/resources/fx/fx_crossslash_x.plist` | `8f5388a82c0663ed0acdd27645d81dcedbe2a2d505a64af4b31819f2a35311f2` |
| `fx/fx_crossslash_x.png` | `app/resources/fx/fx_crossslash_x.png` | `1aa6ec36e221bcad3a47d7d9bfae2687deb0021acf13b72ecf238903f875ceb6` |
| `fx/fx_disintegrate.plist` | `app/resources/fx/fx_disintegrate.plist` | `e33fbc8c418529cfb703b2eae8508f8c59a98670d2a34bd8518f90ccab1b4514` |
| `fx/fx_disintegrate.png` | `app/resources/fx/fx_disintegrate.png` | `b7aef41d48172c4830fcb2d5ca8d78423ca2b0cf883d387eb8cd7f56a5ff98f9` |
| `fx/fx_energyhaloground.plist` | `app/resources/fx/fx_energyhaloground.plist` | `eb276ba93206d798ca0a9dac80315b3207a3f701c938781237e9e8b52b018db4` |
| `fx/fx_energyhaloground.png` | `app/resources/fx/fx_energyhaloground.png` | `e30845281079d25c5661d658f41105ab4e36bb32df5ec508a0b445e501713368` |
| `fx/fx_explosionblue.plist` | `app/resources/fx/fx_explosionblue.plist` | `3352c879036cda0de142e1e8ece158ab9c056f76600f483553f745c9ce20c341` |
| `fx/fx_explosionblue.png` | `app/resources/fx/fx_explosionblue.png` | `5ed05c18bfe83c3b8137a44b8b34181971006d509950187ed58f69e3df17d595` |
| `fx/fx_explosionblueelectrical.plist` | `app/resources/fx/fx_explosionblueelectrical.plist` | `4a19a109ccd1c31a2c4aee60b8dc759ed7a996f59e37c778a1a3f10273d5f619` |
| `fx/fx_explosionblueelectrical.png` | `app/resources/fx/fx_explosionblueelectrical.png` | `f611a914b1cd31ebd6383f08d2af96d31741c3fcb143a8dd3a276a8839ff4b53` |
| `fx/fx_explosiongreenelectrical.plist` | `app/resources/fx/fx_explosiongreenelectrical.plist` | `67c27df476273daba6e1176ca2528397bc50685c31e117ab0901c78922d77fd8` |
| `fx/fx_explosiongreenelectrical.png` | `app/resources/fx/fx_explosiongreenelectrical.png` | `b88f698b9cbc430514959006394bd5c797bd1c9cdeedd3b4486177ab588d0c5c` |
| `fx/fx_explosionorangesmoke.plist` | `app/resources/fx/fx_explosionorangesmoke.plist` | `c387865ac4ff6911f6defec4bf52d6a410352d12365cdb23abce8eb25f639863` |
| `fx/fx_explosionorangesmoke.png` | `app/resources/fx/fx_explosionorangesmoke.png` | `524b591cd9f3fa634112a8b17feeb45fd684c650e29c7a6e45587dc752437a01` |
| `fx/fx_explosionpurplesmoke.plist` | `app/resources/fx/fx_explosionpurplesmoke.plist` | `835388c55da710c2a6756fc9ae9e8d5ba1923cc7a7af9bb8ab8acbd859f37c3f` |
| `fx/fx_explosionpurplesmoke.png` | `app/resources/fx/fx_explosionpurplesmoke.png` | `5501d1975ebc4fb06f1e754adefd153c95e3231a3b51358cfe2ac95b847ae475` |
| `fx/fx_explosionredelectrical.plist` | `app/resources/fx/fx_explosionredelectrical.plist` | `e8269031acd8c839be175d4acb997fe2aacad77570892dc2cc1a32a996f088b8` |
| `fx/fx_explosionredelectrical.png` | `app/resources/fx/fx_explosionredelectrical.png` | `ce7c8fc5aac89241790d9808d415bab4dbe6348960cde636b0a9188f3456fd9d` |
| `fx/fx_explosionyellowelectrical.plist` | `app/resources/fx/fx_explosionyellowelectrical.plist` | `44034e2ed58277d8185deb5ab7aa438363d8744de620721d931344e3ecd222e8` |
| `fx/fx_explosionyellowelectrical.png` | `app/resources/fx/fx_explosionyellowelectrical.png` | `e0d4f1ceab82b7c53d6482adc3c4034e4632f4192ccf71a48f3fa2ac4648bb52` |
| `fx/fx_f1_bbs_roar.plist` | `app/resources/fx/fx_f1_bbs_roar.plist` | `e6d35be1bd3e2a37deaba5a2507012030626658ce6c76279afa86a13192fa1ce` |
| `fx/fx_f1_bbs_roar.png` | `app/resources/fx/fx_f1_bbs_roar.png` | `1d1a5a45fc8c87e476f22a895c38a3c7e1b70de339cc7409b87a852dba45210a` |
| `fx/fx_f1_casterprojectile.plist` | `app/resources/fx/fx_f1_casterprojectile.plist` | `6638c6ef5becfeb51c4e0304b6ab3daa809ed8d55af801633f821093f4e3dbda` |
| `fx/fx_f1_casterprojectile.png` | `app/resources/fx/fx_f1_casterprojectile.png` | `60a0aea43c4f5e9296f6c7de6183cd6785c3681d93bb2a83ce2b300dfab7aa09` |
| `fx/fx_f1_divinebond.plist` | `app/resources/fx/fx_f1_divinebond.plist` | `b3f1211b301b1ed9bbbfd9546f8fc480194c9de0308a8665c94ad4cba0a050c1` |
| `fx/fx_f1_divinebond.png` | `app/resources/fx/fx_f1_divinebond.png` | `dcaf17e76813432fba82af02893922ef1c6c7eb62b7fd4c949bdc43722036de3` |
| `fx/fx_f1_inmolation.plist` | `app/resources/fx/fx_f1_inmolation.plist` | `254a934a5829a26eae8fdf1a9e461d3ddb2aefbdb26a2b67b6fbbb479dfdbd2e` |
| `fx/fx_f1_inmolation.png` | `app/resources/fx/fx_f1_inmolation.png` | `45403e966d987bff25a9a4b565ae71faf944dfb03c6704133cddbe98124e4198` |
| `fx/fx_f1_martyrdom.plist` | `app/resources/fx/fx_f1_martyrdom.plist` | `08835b44f9fb8554586112566509fd8fc19de4d7dfe1ddb1f56c8527f0a37d79` |
| `fx/fx_f1_martyrdom.png` | `app/resources/fx/fx_f1_martyrdom.png` | `7d55d6edffa32d7be5219136d700a86db542793375660fd58d09aa25934baba1` |
| `fx/fx_f1_sunbloom.plist` | `app/resources/fx/fx_f1_sunbloom.plist` | `d54c052310a6cf0308d46e6dfd7dfa56b4dfaacd0c08747823656f878dd4188d` |
| `fx/fx_f1_sunbloom.png` | `app/resources/fx/fx_f1_sunbloom.png` | `e708928433a7cb3815be553724c88fc0bf40a691eb8c1cfb3c5ae052fce36af7` |
| `fx/fx_f1_truestrike.plist` | `app/resources/fx/fx_f1_truestrike.plist` | `d411630952ae8a22158fcfc48e904ec77e31e3239660c331bd46b3ab3ce9bf4d` |
| `fx/fx_f1_truestrike.png` | `app/resources/fx/fx_f1_truestrike.png` | `22964d74c0792b5d9de5ffb57c1f4adac29137bd6887235cd9a8c30556de9766` |
| `fx/fx_f2_eightgates_purpleflame.plist` | `app/resources/fx/fx_f2_eightgates_purpleflame.plist` | `e47738e554d5f8f7fcfc41d9fb4750e27a3761771893f05c2da7492599f6aa79` |
| `fx/fx_f2_eightgates_purpleflame.png` | `app/resources/fx/fx_f2_eightgates_purpleflame.png` | `57d7881a6f0111db51fe798edd94175300aa27df28337f904c0ba0b409e6dad3` |
| `fx/fx_f2_heavenseclipse.plist` | `app/resources/fx/fx_f2_heavenseclipse.plist` | `5d3a12144f06c826ffdcec88eb7370d63ae83b1d73bfb44376a2f4de690e4c81` |
| `fx/fx_f2_heavenseclipse.png` | `app/resources/fx/fx_f2_heavenseclipse.png` | `6267fe4ca21f5864f7fb478d12788ffc966ec147fd77fb976dc93335c6b83fa5` |
| `fx/fx_f2_innerfocus.plist` | `app/resources/fx/fx_f2_innerfocus.plist` | `726ee3ca00edf96356762dc844fe2e70c2b8e7bcc55d8d0f0eca351c10a0d46f` |
| `fx/fx_f2_innerfocus.png` | `app/resources/fx/fx_f2_innerfocus.png` | `6877f6754149e3a89ee79686174d65e05e4d1e9ad8432a25bcb860caa55f75ee` |
| `fx/fx_f2_killingedge.plist` | `app/resources/fx/fx_f2_killingedge.plist` | `905066a47a80d1f7380b8bf3ba15d49b811b34cd92c516ef5fdf02f2e4dc1e56` |
| `fx/fx_f2_killingedge.png` | `app/resources/fx/fx_f2_killingedge.png` | `7c93ba27e87702c8600e3d01ccbdd3d552c3c4ac624473eb33913e2055a220fa` |
| `fx/fx_f2_mistdragonseal.plist` | `app/resources/fx/fx_f2_mistdragonseal.plist` | `3dff57a2346e1146193c8e2ce4a5e2b957610b60e24b2e7e4584adee303dbe86` |
| `fx/fx_f2_mistdragonseal.png` | `app/resources/fx/fx_f2_mistdragonseal.png` | `c4812325df26883e847148308ba1e2cd91777590ee81a8c2ae36f5f81fa20d8c` |
| `fx/fx_f2_onyxbearseal.plist` | `app/resources/fx/fx_f2_onyxbearseal.plist` | `e3c3b23936d591ee27418dc545b5e5d03c20deab67b8b9d38e7d0ce4241632c0` |
| `fx/fx_f2_onyxbearseal.png` | `app/resources/fx/fx_f2_onyxbearseal.png` | `58e481982103ab0f2f7cb1aade9eb8d8a2c571b63b37f37c997b79c9651cab73` |
| `fx/fx_f2_phoenixfire.plist` | `app/resources/fx/fx_f2_phoenixfire.plist` | `bcafcb49d3916c34597d3307c6840231503811e5b0b10b4a6eb06b541f82e64f` |
| `fx/fx_f2_phoenixfire.png` | `app/resources/fx/fx_f2_phoenixfire.png` | `2bfb95e84d86dbd83973bef255da7030d68ea871637c25ecbb5024afe5872226` |
| `fx/fx_f2_teleport.plist` | `app/resources/fx/fx_f2_teleport.plist` | `84cc3583be0220f54607d141ed3f385f8805248a7a542186898316307cacaff9` |
| `fx/fx_f2_teleport.png` | `app/resources/fx/fx_f2_teleport.png` | `28ce0d1153ec618994a2ee915eadafb1f79d861397e59c658f0527cffe02422c` |
| `fx/fx_f2_twinstrike_part2.plist` | `app/resources/fx/fx_f2_twinstrike_part2.plist` | `3b44ed56578ffc9a489c019607823d9ba4526f3a4115c1fda8b44bea8dc9b2e1` |
| `fx/fx_f2_twinstrike_part2.png` | `app/resources/fx/fx_f2_twinstrike_part2.png` | `5d8d0bead3d82619f6e92ef175fde603fe5180b6fde6a28a0361e1e5fc598152` |
| `fx/fx_f2_twinstrike.plist` | `app/resources/fx/fx_f2_twinstrike.plist` | `847beef2b7785293af83a63761b388e80187fd840819d9e47d78dca3377abf48` |
| `fx/fx_f2_twinstrike.png` | `app/resources/fx/fx_f2_twinstrike.png` | `8c221b9d590ced9cea289a8a711eef93780490395d3f7ed644da3a684aced44b` |
| `fx/fx_f2.plist` | `app/resources/fx/fx_f2.plist` | `5474c279297b53bc1698dea5c682ea0cd01fa3f5b4ec540fa062ee87dac969fc` |
| `fx/fx_f2.png` | `app/resources/fx/fx_f2.png` | `7d952965971226fb78d5860ba8d508b900db4c19c1ba5659b28bd93b54ecbec4` |
| `fx/fx_f3_blaststarfire.plist` | `app/resources/fx/fx_f3_blaststarfire.plist` | `b3409bf98c29192bb234b6d44eaf88b4688365fdb1640a86b043d1c602c2e490` |
| `fx/fx_f3_blaststarfire.png` | `app/resources/fx/fx_f3_blaststarfire.png` | `c444e15b3ae984c2bb6057bd08fca92202fd055f53277e0c8b1c11d8189fe24d` |
| `fx/fx_f3_boneswarm.plist` | `app/resources/fx/fx_f3_boneswarm.plist` | `9d56127dcef5a0d2b7bc6c2964f8858f1b7998c04f706d127f4603babe59da97` |
| `fx/fx_f3_boneswarm.png` | `app/resources/fx/fx_f3_boneswarm.png` | `3675c9406e234b71aaa8a49c7979e35fa0038a35c64eeb8aaec7378b3b4caeaf` |
| `fx/fx_f3_cosmicflesh.plist` | `app/resources/fx/fx_f3_cosmicflesh.plist` | `cc74d5ab885da171a4e8e301fc606a55be499d1782fb488dd54f178cd8e399a8` |
| `fx/fx_f3_cosmicflesh.png` | `app/resources/fx/fx_f3_cosmicflesh.png` | `a9ed7e115d5d40f3a4cbce3f9b9e2a99c094e392edabdc59228ec7e3afc33062` |
| `fx/fx_f4_daemoniclure.plist` | `app/resources/fx/fx_f4_daemoniclure.plist` | `7b922420a35c385d5113929d3feca2ce6c2e8945b63b7a5ddceb909225e8b4c1` |
| `fx/fx_f4_daemoniclure.png` | `app/resources/fx/fx_f4_daemoniclure.png` | `e66f3ae66ceb0610104e9539215babcf4622806e75f0eee430957f0319ecc04d` |
| `fx/fx_f4_darkfiresacrifice.plist` | `app/resources/fx/fx_f4_darkfiresacrifice.plist` | `47f86000dcf983a9ce25a69bfcba80a39d05061abe2b543c41927a6e2bb4792a` |
| `fx/fx_f4_darkfiresacrifice.png` | `app/resources/fx/fx_f4_darkfiresacrifice.png` | `9042c3bc0b6a907d4642c6fadeabfd6a8f8182ad006007081dbd005ea1364201` |
| `fx/fx_f4_darkfiretransformation.plist` | `app/resources/fx/fx_f4_darkfiretransformation.plist` | `f713ba6cf32fe69e59e4c03add1a12b6a7a9f1ea5c4e43a91403b8e19ba2b0f1` |
| `fx/fx_f4_darkfiretransformation.png` | `app/resources/fx/fx_f4_darkfiretransformation.png` | `3474066254f3e85943d89237aaa2a08693d62614e7f42c69ae739dc977f07f57` |
| `fx/fx_f4_deathfire_crescendo.plist` | `app/resources/fx/fx_f4_deathfire_crescendo.plist` | `e51d53013d9849bd7ba60326750cdbdcab35ab6cd8c5b29b99a9ccf58ed473e6` |
| `fx/fx_f4_deathfire_crescendo.png` | `app/resources/fx/fx_f4_deathfire_crescendo.png` | `a2ddf7490b7f4198750edcee9fbdbca235709533baa270e76ba51aa4101588ca` |
| `fx/fx_f4_riteundervault.plist` | `app/resources/fx/fx_f4_riteundervault.plist` | `5d7df3dbbc55b960b5caa3951d737c3c0eb82f7af814f3c9377ceedfc36c46d7` |
| `fx/fx_f4_riteundervault.png` | `app/resources/fx/fx_f4_riteundervault.png` | `b20f2d2706b5eb1e3e6ffce3b43a32f718efa6aaffbf42c3df3103244e4f85e1` |
| `fx/fx_f4_shadownova.plist` | `app/resources/fx/fx_f4_shadownova.plist` | `4acd4fea75a9de5a6571784370a2818ce93cc75c0a28d2eacc83e42f0656fe0d` |
| `fx/fx_f4_shadownova.png` | `app/resources/fx/fx_f4_shadownova.png` | `2eb8ba3ec429471cb602d08bd4dd6775b5207912c829677aac92689e2da6bcbc` |
| `fx/fx_f4_voidpulse.plist` | `app/resources/fx/fx_f4_voidpulse.plist` | `3bee2ff950b8ecab1bc6be18e63dbbf23fc20820ee5083e4400bbc73e860a403` |
| `fx/fx_f4_voidpulse.png` | `app/resources/fx/fx_f4_voidpulse.png` | `ee1c3156508a056756d84e9eb79673fa08b1d19576af00417edff31b1ea6238c` |
| `fx/fx_f5_amplification.plist` | `app/resources/fx/fx_f5_amplification.plist` | `670ff51bc6b9e4b69b4d530c111518910c4eb150556a12785b8f5c1e03cb7f18` |
| `fx/fx_f5_amplification.png` | `app/resources/fx/fx_f5_amplification.png` | `c83c8492c8d211122d826b660fd3985efd02a870901d52fee57c45e8e792b1bf` |
| `fx/fx_f5_earthsphere_blue.plist` | `app/resources/fx/fx_f5_earthsphere_blue.plist` | `e69b1911de6fb2082bbc8e3b7dea80d06142afff2926cbd4eba65c9e7e26d733` |
| `fx/fx_f5_earthsphere_blue.png` | `app/resources/fx/fx_f5_earthsphere_blue.png` | `a36bdd1c482ca6c2513ea222d611f766c32efa610da56679f4a40cf7b9c66f25` |
| `fx/fx_f5_earthsphere.plist` | `app/resources/fx/fx_f5_earthsphere.plist` | `fa657a953d7a76bfc6fb1a5f55e2480cf477ba4db82e3f1863e05205955b60f3` |
| `fx/fx_f5_earthsphere.png` | `app/resources/fx/fx_f5_earthsphere.png` | `facb85558462efc2fc8d8485e3d818f277fd05e49caf25b63aaab58d5271678a` |
| `fx/fx_f5_flashreincarnation.plist` | `app/resources/fx/fx_f5_flashreincarnation.plist` | `81c2e3548b7842202999d6e868d74c8e92ba6973d8db33f801e1721cf23d562d` |
| `fx/fx_f5_flashreincarnation.png` | `app/resources/fx/fx_f5_flashreincarnation.png` | `57285fceeccb754627d6e44e392db83bdedd723279cac760ac9e4bd4c03d51ce` |
| `fx/fx_f5_kinectequilibrium.plist` | `app/resources/fx/fx_f5_kinectequilibrium.plist` | `ba9ea2c27e558d6be490d60c42266abc94cc15a5d838c16affe53095f94f28f7` |
| `fx/fx_f5_kinectequilibrium.png` | `app/resources/fx/fx_f5_kinectequilibrium.png` | `dbe1dd8b76dd48fd90dd48761cbe30bec95786157822a576d3e97941328998d5` |
| `fx/fx_f5_manaburn.plist` | `app/resources/fx/fx_f5_manaburn.plist` | `c5a780316f6d0649f57cca257b1758ba2b15f5dde50c2bb3757a2b870ad63b75` |
| `fx/fx_f5_manaburn.png` | `app/resources/fx/fx_f5_manaburn.png` | `cf2020933718744157eeea6488874c250a15c55fea509d501debc5cf524e5ded` |
| `fx/fx_f5_naturalselection.plist` | `app/resources/fx/fx_f5_naturalselection.plist` | `cf1ac7818738faa7dfe499b20b8a69dc9edd9ae098cc35cc9d4d069341c3eeab` |
| `fx/fx_f5_naturalselection.png` | `app/resources/fx/fx_f5_naturalselection.png` | `e7e5f43b48d32236d04cc9a44264542e5729792084f1c313c31945d5902cd33d` |
| `fx/fx_f6_chromaticcold.plist` | `app/resources/fx/fx_f6_chromaticcold.plist` | `d787db28d85269793cf4add0df77c9975457b9f93055e7477f77926bd2e354b7` |
| `fx/fx_f6_chromaticcold.png` | `app/resources/fx/fx_f6_chromaticcold.png` | `cc530895c2c94cd241e5d87c1dc6ae7d12dd9ab5d115cdee09bc0c1402d85be0` |
| `fx/fx_f6_cryogenesis.plist` | `app/resources/fx/fx_f6_cryogenesis.plist` | `74bb880fca896e32ef979f870bb10b87716614eaca7f663fbc29068dec9de75e` |
| `fx/fx_f6_cryogenesis.png` | `app/resources/fx/fx_f6_cryogenesis.png` | `6cd9ab43881c2fb75a52817160a118229bec6fca125b9bedd40509656614bd89` |
| `fx/fx_f6_spiritofthewild.plist` | `app/resources/fx/fx_f6_spiritofthewild.plist` | `8e3b724e5aa8cb477a8dd0654d02b1781a3095d1fbeb87e72533d521c049969a` |
| `fx/fx_f6_spiritofthewild.png` | `app/resources/fx/fx_f6_spiritofthewild.png` | `f1b4e6ba62d1385319abe2881174b9be3b32c3bedd62528a420568571ad788fd` |
| `fx/fx_fairiefire.plist` | `app/resources/fx/fx_fairiefire.plist` | `58189ae8d293bb2e694f06c81e0e9650d42ee2bbf10d40d502dc402337585980` |
| `fx/fx_fairiefire.png` | `app/resources/fx/fx_fairiefire.png` | `4646f866682358efe5c77d60cb72340d370e527eadb1a4dc351b84728f2c400f` |
| `fx/fx_fireimpact.plist` | `app/resources/fx/fx_fireimpact.plist` | `00110fce7fa5e793192df011dfb5c4a4e09a7122fd22ce0b89e6886f86a681e4` |
| `fx/fx_fireimpact.png` | `app/resources/fx/fx_fireimpact.png` | `c2e134b7a0986ddf67bbceaee33fc90c5f4af4f5b6ddb3994ef33b941bf71b71` |
| `fx/fx_fireslash.plist` | `app/resources/fx/fx_fireslash.plist` | `13b1cd40b684cb48515e5b29374f07d5c61595e318dd9442d08652974864c36e` |
| `fx/fx_fireslash.png` | `app/resources/fx/fx_fireslash.png` | `a234cfa1f4463a7e63f38476abc465747fbb6727306b69d7e787f9a4629013f4` |
| `fx/fx_firetornado.plist` | `app/resources/fx/fx_firetornado.plist` | `310db32ee021ca6a8b7e15181a74f81c660e382e720c17f3fe7b95bbcd41237d` |
| `fx/fx_firetornado.png` | `app/resources/fx/fx_firetornado.png` | `25214918f1b16aec1ad25f3eea220b66760641c555f3ed3f78f92603cf0edd82` |
| `fx/fx_flamesphere.plist` | `app/resources/fx/fx_flamesphere.plist` | `e23dee0289ddb61ef3797dc90f4d3c280d55107038ce5bddd558104f0ec74dd3` |
| `fx/fx_flamesphere.png` | `app/resources/fx/fx_flamesphere.png` | `7e99b5152c63c688402d7cc522abad96ace7957deba337ee3598bbd3d363393f` |
| `fx/fx_heal.plist` | `app/resources/fx/fx_heal.plist` | `aa6a90fb4a13a54b390842f3d6972d351c59eb99fb7bdc5ee1e82f7bc949e8de` |
| `fx/fx_heal.png` | `app/resources/fx/fx_heal.png` | `b110ac5711694cfb2edb8fde086b96926f75b0b20d3e4c104d8b74c753e9d456` |
| `fx/fx_heavenlystrike.plist` | `app/resources/fx/fx_heavenlystrike.plist` | `5548efea31fcf65a9d5f45eedd3b9ab3d15152a4e009772c64407bcc44930b14` |
| `fx/fx_heavenlystrike.png` | `app/resources/fx/fx_heavenlystrike.png` | `5f08e17824a3aa9115aa6ef1462e9ff491ee62d61103838348bd645e844d8482` |
| `fx/fx_impact_verticalring.plist` | `app/resources/fx/fx_impact_verticalring.plist` | `5d8ace57cdfb1fc534b3a2114043436e35344a6834d1cae419c989cd94cebf18` |
| `fx/fx_impact_verticalring.png` | `app/resources/fx/fx_impact_verticalring.png` | `745c43824ba500f2ce94c5bdfe013b345ad4c3be3fe1da18d12f4b21bef2139b` |
| `fx/fx_impact.plist` | `app/resources/fx/fx_impact.plist` | `76087b135307698282972a1981a643c42e1308c21c7dbca3953e42fbc360a993` |
| `fx/fx_impact.png` | `app/resources/fx/fx_impact.png` | `aa3f7910bdf37104760b2f42bfb8de2fa70cda15c0cf1bba92604c27580a568c` |
| `fx/fx_impact2.plist` | `app/resources/fx/fx_impact2.plist` | `2e7546bafc32c9874c7fd849c55e1226c5d330974c5179ed59e3f6443ef8c818` |
| `fx/fx_impact2.png` | `app/resources/fx/fx_impact2.png` | `6ec31fe23beaf19dae01f9b0a6e14c53c555ac7bf18406f9804026ee0266a028` |
| `fx/fx_impactgreen.plist` | `app/resources/fx/fx_impactgreen.plist` | `c2b96d3f93bca9c1bd1a4d11a6b76cd469b5fc7932cf62ef05be7c72e147d482` |
| `fx/fx_impactgreen.png` | `app/resources/fx/fx_impactgreen.png` | `930e9906870d6d4235411eeea6b97977c22e6857bcc6a92725b4aaf899bd3666` |
| `fx/fx_lightninghitgreen.plist` | `app/resources/fx/fx_lightninghitgreen.plist` | `6bad7f9e8542aee287ca13aae5874ff049fdb35ac535cd3cd29922b28c580ab7` |
| `fx/fx_lightninghitgreen.png` | `app/resources/fx/fx_lightninghitgreen.png` | `f912415159c19384f63e15ea45a3b291330e2798bdc2b969d596d3ec0073b12b` |
| `fx/fx_martyrdom.plist` | `app/resources/fx/fx_martyrdom.plist` | `169ec53709dcd55d4ff8ae820e1bf2abe43629f6fececa90b85dd457ff66671f` |
| `fx/fx_martyrdom.png` | `app/resources/fx/fx_martyrdom.png` | `191056b93e816c9c6810dbcd096a8a993b1f39260367a2f69686755a02b12d78` |
| `fx/fx_plasma.plist` | `app/resources/fx/fx_plasma.plist` | `2a9558adefff1fb6dfa78618694e3fa1b303f95dcea65b7c367d3a834c4bde5c` |
| `fx/fx_plasma.png` | `app/resources/fx/fx_plasma.png` | `3c0d58fa82b9bc631183cab3db953195ff7569264e9c71ef5d3ff80fd20edd48` |
| `fx/fx_redplasma_vertical.plist` | `app/resources/fx/fx_redplasma_vertical.plist` | `189d1b9901993d12e989b8ebb5bc40170f7bceee9c7002721f46291d44a142e9` |
| `fx/fx_redplasma_vertical.png` | `app/resources/fx/fx_redplasma_vertical.png` | `d31146d445fb1a007463b843a1fddfbecc6ed36c0d8ca5da563ba9da914c43db` |
| `fx/fx_ringswirl.plist` | `app/resources/fx/fx_ringswirl.plist` | `b4218d8a7e674b7761a81f7fff608f85929a05799287d4d81d79f878c32ffa20` |
| `fx/fx_ringswirl.png` | `app/resources/fx/fx_ringswirl.png` | `51588d8c9b1178965e870fbb064eb6933c454e6abb0ee4fbdc6a877a41088606` |
| `fx/fx_searingchasm.plist` | `app/resources/fx/fx_searingchasm.plist` | `a78a9be094bdf11e47ba9447223738696e8f70d3f49208051e191c5756487a02` |
| `fx/fx_searingchasm.png` | `app/resources/fx/fx_searingchasm.png` | `aa7d19b8c407228536edbdcb96a209515c59a2c65e65ab8eb034d42f52eee50f` |
| `fx/fx_shadowcreep.plist` | `app/resources/fx/fx_shadowcreep.plist` | `e37cf3722fa442f6043561cfd92575f53406c4f90208de884839da88973bf3ed` |
| `fx/fx_shadowcreep.png` | `app/resources/fx/fx_shadowcreep.png` | `d85909f26b6477c156c54eb812793fe6cb43b4d1aa31c9dfed14b82deb0a5354` |
| `fx/fx_slashfrenzy.plist` | `app/resources/fx/fx_slashfrenzy.plist` | `c5c5216f960e0569e250c9da79472f92a48d19de67a6ae30a381795c1e6cc904` |
| `fx/fx_slashfrenzy.png` | `app/resources/fx/fx_slashfrenzy.png` | `480a967515d4d7941a5f0c56feca886d0a9e052554abab308d193ef9ba74519e` |
| `fx/fx_smoke.plist` | `app/resources/fx/fx_smoke.plist` | `3925cba7dff5d8311166ef1973a9fbf6643e34286c0274aa16f525256e3e8ab4` |
| `fx/fx_smoke.png` | `app/resources/fx/fx_smoke.png` | `d5e30f5ba031aef910560c356fddcd672f248fbb6e7f8e564b97d9fd8ac09e65` |
| `fx/fx_smoke2.plist` | `app/resources/fx/fx_smoke2.plist` | `76893cb94316b2642f0bd431841950a0eeef1de52d6a0ef2a4899dedfbaac0fb` |
| `fx/fx_smoke2.png` | `app/resources/fx/fx_smoke2.png` | `1babff98264310d4d90f8476676ae38746b1cded9f39f30955c07036107806e4` |
| `fx/fx_swirl.plist` | `app/resources/fx/fx_swirl.plist` | `5a7f0a9b94f43cf4dc3370bc58424eadd0b215b031f4539eaa66de0f28a51cbb` |
| `fx/fx_swirl.png` | `app/resources/fx/fx_swirl.png` | `99b3a639fcd258f0b079690597ff90dc33bf45e3936d0c70c0af94b6210dd72b` |
| `fx/fx_teleportorangeorb.plist` | `app/resources/fx/fx_teleportorangeorb.plist` | `81fc12b94e4a13fc644839206227bfb31a9cc0301533695ccb60473ca91aa4fa` |
| `fx/fx_teleportorangeorb.png` | `app/resources/fx/fx_teleportorangeorb.png` | `2a131b43df84bd8e33a5fb3d9ad99d7889e1b1b9f772316f13f29838944be0e9` |
| `fx/fx_teleportrecall2.plist` | `app/resources/fx/fx_teleportrecall2.plist` | `43a4a5d4e8fd9dd37c02de509fcd1c00d76ab82f1dcfed3fd30ce517a9e244ee` |
| `fx/fx_teleportrecall2.png` | `app/resources/fx/fx_teleportrecall2.png` | `1542b4042888690831e67d2c13b78a953b6040eac43b32fb983b49690c84c35e` |
| `fx/fx_teleportrecallblue.plist` | `app/resources/fx/fx_teleportrecallblue.plist` | `85823b2b200b28d5ef8a243f31b05b06e9238f0bd7929060ab4846e408575436` |
| `fx/fx_teleportrecallblue.png` | `app/resources/fx/fx_teleportrecallblue.png` | `d87e85fa0a7334d2750a6415114f93093fbe9689effb7e31fd1df60f67c719d8` |
| `fx/fx_teleportrecallwhite.plist` | `app/resources/fx/fx_teleportrecallwhite.plist` | `b19b61a0c8f0b518d5cf542f8fdafe962f2d239e834bba965aba4eb00f426e83` |
| `fx/fx_teleportrecallwhite.png` | `app/resources/fx/fx_teleportrecallwhite.png` | `3c65437346e1eb3d0f0a34342c86fcaf90148a3d63fdb262efd623b9a7e18838` |
| `fx/fx_teleportyelloworb.plist` | `app/resources/fx/fx_teleportyelloworb.plist` | `827f5c5e8ab316c59ad14e68137b813b95896192ae8a1511a37ac36e00f8a8af` |
| `fx/fx_teleportyelloworb.png` | `app/resources/fx/fx_teleportyelloworb.png` | `95eb75b7ae8c57faea06802b53919e599c71b78d8512478a2d9b9a94febf1431` |
| `fx/fx_vortexswirl.plist` | `app/resources/fx/fx_vortexswirl.plist` | `aacd1b797b1bab373def9d49010c7d9799e1260df39b6bcd495bd21216241820` |
| `fx/fx_vortexswirl.png` | `app/resources/fx/fx_vortexswirl.png` | `c8ad9db9d2985613440412f358580e32e54ca269d14d9b8f46bf081714ba3123` |
| `fx/fx_whiteexplosion.plist` | `app/resources/fx/fx_whiteexplosion.plist` | `6ee5b138cc6fbb5790bebab9c713d8274825be130da3d198ba1ca075296d873a` |
| `fx/fx_whiteexplosion.png` | `app/resources/fx/fx_whiteexplosion.png` | `03bd2396c22bad69a709b97247aca5f6445a950c77ff7d8e8fe517ef120621b8` |
| `fx/pixelpuff.plist` | `app/resources/particles/pixelpuff.plist` | `e53b952e8c8049c152f91e6e3638b376764e7a971d96355f500af474daf9aa94` |
| `fx/projectile_trail_particles.plist` | `app/resources/particles/projectile_trail_particles.plist` | `2d36b8caa6fa6fa3c3a1a9ec7f1a80e946ca544eecdd12eb33157366d6170309` |
| `fx/projectile_trail_particles.png` | `app/resources/particles/projectile_trail_particles.png` | `b58d809252a558aa9980c46b17c22da3bc512ff0f630dd21b3da2dcf2c93ec7e` |
| `generals/general_portrait_image_f1.png` | `app/resources/generals/general_portrait_image_f1.png` | `35de86a531f9e3e6ba7f53608c74790f79b6ab70aae2254efb47a15c473c8351` |
| `generals/general_portrait_image_f1alt.png` | `app/resources/generals/general_portrait_image_f1alt.png` | `80b6e37bbdcbcb9814c658d960b9c8555f29db1550fc02a7065d6adb394d1a1b` |
| `generals/general_portrait_image_f2.png` | `app/resources/generals/general_portrait_image_f2.png` | `2f5dc588202a491c465221864f55a8c78ad184807633a3857ba6a6d5bc38e82b` |
| `generals/general_portrait_image_f2alt.png` | `app/resources/generals/general_portrait_image_f2alt.png` | `69f203d316c671a0bc1a37242fcee04d0650c80f451bd431a0c7b8e9200a700e` |
| `generals/general_portrait_image_f3.png` | `app/resources/generals/general_portrait_image_f3.png` | `13e9fea7dd34e1baf30584ebd5d4e8510a58a8993cb5864599632850c9d8b912` |
| `generals/general_portrait_image_f3alt.png` | `app/resources/generals/general_portrait_image_f3alt.png` | `17da06fa7238e8056efd769bfc68306bbfba33f0b572df5eaf85026926c16dcd` |
| `generals/general_portrait_image_f4.png` | `app/resources/generals/general_portrait_image_f4.png` | `29651f66f9b3fd783ce6beb0bd7b043900e69b88ba5924ccbfa35dfb4c0bd245` |
| `generals/general_portrait_image_f4alt.png` | `app/resources/generals/general_portrait_image_f4alt.png` | `9d72fb1d653a40fb5fb136465e2e8a634da8aba508c9207cb73de6aa6ec51925` |
| `generals/general_portrait_image_f5.png` | `app/resources/generals/general_portrait_image_f5.png` | `7178053c59eb373b8aeb11d8cda8a304cbbf4703cb259fcdc22274812e462f18` |
| `generals/general_portrait_image_f5alt.png` | `app/resources/generals/general_portrait_image_f5alt.png` | `f1f9313ae34e888c7e37e5b080087c9d9c139304b9d634d02b2c0ea4f5a3cb7c` |
| `generals/general_portrait_image_f6.png` | `app/resources/generals/general_portrait_image_f6.png` | `17a8615d20f741621eeaca7ad64f2b384d092e08978e8b1afbdcbd6d9196bd68` |
| `generals/general_portrait_image_f6alt.png` | `app/resources/generals/general_portrait_image_f6alt.png` | `b261d41d68a8e7e7fd832f5b0d9f108983fc6e830f2f3937022911247e358460` |
| `sfx/sfx_f1_elyxstormblade_attack_impact.m4a` | `app/resources/sfx/sfx_f1_elyxstormblade_attack_impact.m4a` | `8d43706788b5cb896bb90fbd35e966e361ce013c8cd6329dc263b4d0ab9cb878` |
| `sfx/sfx_f1_elyxstormblade_attack_swing.m4a` | `app/resources/sfx/sfx_f1_elyxstormblade_attack_swing.m4a` | `6c4bd19367aacd7e90bce42aec7ede821070a9fda44584e9890b77f3f6992c99` |
| `sfx/sfx_f1_elyxstormblade_death.m4a` | `app/resources/sfx/sfx_f1_elyxstormblade_death.m4a` | `bc75a2076a5625681809800ae165b72701768da7f5c6cd818353f48a285b0ea0` |
| `sfx/sfx_f1_elyxstormblade_hit.m4a` | `app/resources/sfx/sfx_f1_elyxstormblade_hit.m4a` | `f5af94bb41332bf60aa8c7f2225ebb674dc5a538d89bd719095b918e3fcd3e73` |
| `sfx/sfx_f1_general_attack_impact.m4a` | `app/resources/sfx/sfx_f1_general_attack_impact.m4a` | `c802d95f7410a10c53f70a673e3cb77fd62ddc0a8d6f9283bbb85f823b70d7a5` |
| `sfx/sfx_f1_general_attack_swing.m4a` | `app/resources/sfx/sfx_f1_general_attack_swing.m4a` | `5bbc4f31009e7e07bb931691fdd657f32b4e93b129ac025cc3e2d7155a734de5` |
| `sfx/sfx_f1_general_hit.m4a` | `app/resources/sfx/sfx_f1_general_hit.m4a` | `6ca92a1ab3991e41aea3c08192d709f2459de25fbb1888cf45d7edcbfb32a303` |
| `sfx/sfx_f1_grandmasterzir_attack_impact.m4a` | `app/resources/sfx/sfx_f1_grandmasterzir_attack_impact.m4a` | `4fc44fdf80f5533ae583f0062f3b004cf5394eb267d9b4bef78b83b3240a1ab7` |
| `sfx/sfx_f1_grandmasterzir_death.m4a` | `app/resources/sfx/sfx_f1_grandmasterzir_death.m4a` | `e91b310fc21d19f4cb419a6807008e7980d553bcf06f80f0f236752ec20af3dc` |
| `sfx/sfx_f1_ironcliffeguardian_attack_impact.m4a` | `app/resources/sfx/sfx_f1_ironcliffeguardian_attack_impact.m4a` | `d4ba2663e2757eebc46e58b1e7b534d9002c6b569144696fb93bedbde5253e30` |
| `sfx/sfx_f1_ironcliffeguardian_attack_swing.m4a` | `app/resources/sfx/sfx_f1_ironcliffeguardian_attack_swing.m4a` | `de9dd2d43ce50631ce07eae67a8e4fc49de7f3c32c77ee00260cad31860e9c93` |
| `sfx/sfx_f1_ironcliffeguardian_death.m4a` | `app/resources/sfx/sfx_f1_ironcliffeguardian_death.m4a` | `3fb1c660e8e39d69a6d13060e7065349c4defc9af85bdcdb18f85a33a720d7ff` |
| `sfx/sfx_f1_ironcliffeguardian_hit.m4a` | `app/resources/sfx/sfx_f1_ironcliffeguardian_hit.m4a` | `0e71d4e72d8d9388e8399bf096af90945cdf8316ac2c14b2e0392cc0e9440fd6` |
| `sfx/sfx_f1_oserix_attack_impact.m4a` | `app/resources/sfx/sfx_f1_oserix_attack_impact.m4a` | `b15b2cfc6d94c935f5427c0f4165ab628bc4554f452fb55b1a886dcb7a8eabd6` |
| `sfx/sfx_f1_oserix_attack_swing.m4a` | `app/resources/sfx/sfx_f1_oserix_attack_swing.m4a` | `c1ebc2c800411fa7556565daedb72384424d9810218f3ae4a05921c3de705025` |
| `sfx/sfx_f1_oserix_death.m4a` | `app/resources/sfx/sfx_f1_oserix_death.m4a` | `21839e1b7b8f43ba5839993fb75c3a734b73d20f875e597ee0b9f1b43457e292` |
| `sfx/sfx_f1_oserix_hit.m4a` | `app/resources/sfx/sfx_f1_oserix_hit.m4a` | `0b1834da565f53916cb9e66ac641b705d51e9032f83eb46b41f303df4eeb6199` |
| `sfx/sfx_f1_silverguardsquire_attack_impact.m4a` | `app/resources/sfx/sfx_f1_silverguardsquire_attack_impact.m4a` | `d7b727bac2841710bf4d3ac59077a5f171667235f749c50bf1cecffdb73bfcb7` |
| `sfx/sfx_f1_silverguardsquire_attack_swing.m4a` | `app/resources/sfx/sfx_f1_silverguardsquire_attack_swing.m4a` | `237510c76aa0ae4d8a5a5dfedd3428b253788f910ec25e4a42f74e913b6fb7cb` |
| `sfx/sfx_f1_silverguardsquire_death.m4a` | `app/resources/sfx/sfx_f1_silverguardsquire_death.m4a` | `0c0c1501bb68d4bd5ae262b522391f3b4b5bb0233686d4806a7f311f7f49c76d` |
| `sfx/sfx_f1_silverguardsquire_hit.m4a` | `app/resources/sfx/sfx_f1_silverguardsquire_hit.m4a` | `3ef27f2bdb20836de65c76e99cf241fd0f78846455b0280a7feb18e8513edc0b` |
| `sfx/sfx_f1_silvermanevanguard_attack_impact.m4a` | `app/resources/sfx/sfx_f1_silvermanevanguard_attack_impact.m4a` | `79a18cb80b63a04588f64d707510ccea1bf47d03d0da31f27183516816cd11d6` |
| `sfx/sfx_f1_silvermanevanguard_attack_swing.m4a` | `app/resources/sfx/sfx_f1_silvermanevanguard_attack_swing.m4a` | `d147d8e8f0156b715ae422b07efdcc020952f4f4efe510a6d8c97ab4ea8b3719` |
| `sfx/sfx_f1_silvermanevanguard_death.m4a` | `app/resources/sfx/sfx_f1_silvermanevanguard_death.m4a` | `8ec2e01d6ef0469ac2e086e52c5149e895e0bd9e4b377224cd6cd578b0f80af5` |
| `sfx/sfx_f1_silvermanevanguard_hit.m4a` | `app/resources/sfx/sfx_f1_silvermanevanguard_hit.m4a` | `a48f5027d6a628c4c1ce56b112f4c0cb5adcb38e04ca1576f58edee69825a563` |
| `sfx/sfx_f1_sunriser_attack_impact.m4a` | `app/resources/sfx/sfx_f1_sunriser_attack_impact.m4a` | `b3bd576cc2d19b753a30ca262c23ea1a9c6c76c0547778af5605084e072b3fd9` |
| `sfx/sfx_f1_sunriser_attack_swing.m4a` | `app/resources/sfx/sfx_f1_sunriser_attack_swing.m4a` | `f80ab7a9290b3fa4091ac0c53ffebc160afddfa33a4f30965cd518f0cfd5e5c2` |
| `sfx/sfx_f1_sunriser_death_alt.m4a` | `app/resources/sfx/sfx_f1_sunriser_death_alt.m4a` | `c56904909864fae1d0e80e4d0ac461629dbe79e52da1fb9098f016377bf62be3` |
| `sfx/sfx_f1_sunriser_hit_noimpact.m4a` | `app/resources/sfx/sfx_f1_sunriser_hit_noimpact.m4a` | `584059ad4231659361ade159566e61708b2ff385e9812ef3401598374802e5f6` |
| `sfx/sfx_f1_windbladecommander_attack_impact.m4a` | `app/resources/sfx/sfx_f1_windbladecommander_attack_impact.m4a` | `b72601aedd0ebaf381bc49ba169a8bf4a0724fa5556da74b2cc46075ca4777fd` |
| `sfx/sfx_f1_windbladecommander_attack_swing.m4a` | `app/resources/sfx/sfx_f1_windbladecommander_attack_swing.m4a` | `e742c228ab7afd462ca3dec4ba3b08e72efadecc1feba6f702363cf07c7d3b0c` |
| `sfx/sfx_f1_windbladecommander_death.m4a` | `app/resources/sfx/sfx_f1_windbladecommander_death.m4a` | `68d58d465c8d1e888ffb9371cab6c040f69d465d7439640cfe7561b5c596f1f1` |
| `sfx/sfx_f1_windbladecommander_hit.m4a` | `app/resources/sfx/sfx_f1_windbladecommander_hit.m4a` | `e5e091325c8d004653d008e281ef63194a4ddee3d0ac7b0c4a32b2d9fa8d4c8f` |
| `sfx/sfx_f1general_death.m4a` | `app/resources/sfx/sfx_f1general_death.m4a` | `93304d6c0daba54aca3348732fb88237dc3730f7805cea61e12f88f57871a882` |
| `sfx/sfx_f1tank_attack_impact.m4a` | `app/resources/sfx/sfx_f1tank_attack_impact.m4a` | `0280369d6ddb9ca3d9c68a3368b88df780b0171b10ac1ccf1e3e65edcfa2fcb4` |
| `sfx/sfx_f1tank_attack_swing.m4a` | `app/resources/sfx/sfx_f1tank_attack_swing.m4a` | `337d521d31c1cd476da108208e189d861b57071922e127727fe7663e049dd142` |
| `sfx/sfx_f1tank_death.m4a` | `app/resources/sfx/sfx_f1tank_death.m4a` | `ca038c154d394dba5e7c6d69063085d65f8ef1ef74b7cc903c9ccc00a9612442` |
| `sfx/sfx_f1tank_hit.m4a` | `app/resources/sfx/sfx_f1tank_hit.m4a` | `0940268ef24ea08928d79d39016a813371fab2d6dbeb7bf8283a6f9a9de1ab0c` |
| `sfx/sfx_f2_celestialphantom_attack_impact.m4a` | `app/resources/sfx/sfx_f2_celestialphantom_attack_impact.m4a` | `80bb030b85877413b6ef08550abaff9c6d87d2fa4d97d609ceafa6d55643acdb` |
| `sfx/sfx_f2_celestialphantom_attack_swing.m4a` | `app/resources/sfx/sfx_f2_celestialphantom_attack_swing.m4a` | `5c268cbe5bbfab424d7865b1b405d83e02256d35349884a8d04ad05cbfaab859` |
| `sfx/sfx_f2_celestialphantom_death.m4a` | `app/resources/sfx/sfx_f2_celestialphantom_death.m4a` | `fb0616419591ec570973579c91940720025e1c840425cb0666280f3b4fd2eebe` |
| `sfx/sfx_f2_celestialphantom_hit.m4a` | `app/resources/sfx/sfx_f2_celestialphantom_hit.m4a` | `dd9c59ab8bfa6059d9c570d8e4ce3d0e5720a41de9bcaf194d1a60a4e16caa78` |
| `sfx/sfx_f2_chakriavatar_attack_impact.m4a` | `app/resources/sfx/sfx_f2_chakriavatar_attack_impact.m4a` | `6555132f8d2d2a363a51615331a383824c4e676bfad48969126bce15b58c2d44` |
| `sfx/sfx_f2_chakriavatar_attack_swing.m4a` | `app/resources/sfx/sfx_f2_chakriavatar_attack_swing.m4a` | `26d0487290fe874afcdf747fc10fa56f597ce76a8c7cb4873b790a17914be25a` |
| `sfx/sfx_f2_chakriavatar_death.m4a` | `app/resources/sfx/sfx_f2_chakriavatar_death.m4a` | `68652840ee8da0749a75672b5a7732183048879556adca5a7173d3d762fcc9d1` |
| `sfx/sfx_f2_chakriavatar_hit.m4a` | `app/resources/sfx/sfx_f2_chakriavatar_hit.m4a` | `8b237efa466abe482f55adcaf9abb69b4cee5ed97772ae0f7a180e42f1fae253` |
| `sfx/sfx_f2_jadeogre_attack_impact.m4a` | `app/resources/sfx/sfx_f2_jadeogre_attack_impact.m4a` | `189949a61fd7e18c1f3537ee5496da185a4c6d00cc5f582b346946b43cd95dd5` |
| `sfx/sfx_f2_jadeogre_attack_swing.m4a` | `app/resources/sfx/sfx_f2_jadeogre_attack_swing.m4a` | `68a497e9eae8b5f017c881578a86a7420ab3e58027cfc69895eba74ce406c115` |
| `sfx/sfx_f2_jadeogre_death.m4a` | `app/resources/sfx/sfx_f2_jadeogre_death.m4a` | `a0a4f7db6b38301bbaa49027cabd0c08de1a0bb8c117881631ec070a4d2011e4` |
| `sfx/sfx_f2_jadeogre_hit.m4a` | `app/resources/sfx/sfx_f2_jadeogre_hit.m4a` | `56765a7529cb9bacde2c8b473b3144ae9da72ce9d9174a78446481316b45bdc6` |
| `sfx/sfx_f2_kaidoassassin_attack_impact.m4a` | `app/resources/sfx/sfx_f2_kaidoassassin_attack_impact.m4a` | `44a312402e8b998f4c9c5c6c99b248c3f2dcafeebe6e0b9fc649f5a45323e550` |
| `sfx/sfx_f2_kaidoassassin_attack_swing.m4a` | `app/resources/sfx/sfx_f2_kaidoassassin_attack_swing.m4a` | `4b2b4dfa503ce7725f9d0ed1a82029f63c8c59d09188b6c1166d90476ce22dbc` |
| `sfx/sfx_f2_kaidoassassin_death.m4a` | `app/resources/sfx/sfx_f2_kaidoassassin_death.m4a` | `ecff7c8f0c70b7ef407be2e95e35f641563a24b11ff704cb602d9a051762bf0f` |
| `sfx/sfx_f2_kaidoassassin_hit.m4a` | `app/resources/sfx/sfx_f2_kaidoassassin_hit.m4a` | `7da471452ea55acec5bd9d2c04aa6a3b26f3f1de983b54914a48f81d23bd94f5` |
| `sfx/sfx_f2_lanternfox_attack_impact.m4a` | `app/resources/sfx/sfx_f2_lanternfox_attack_impact.m4a` | `e299100776bc431a24231c69083b98525dbec624cf6c7b462062e58fc6591409` |
| `sfx/sfx_f2_lanternfox_attack_swing.m4a` | `app/resources/sfx/sfx_f2_lanternfox_attack_swing.m4a` | `1de1792731c9aa92ddc87fed275b6625a5c9fe8edc6a3aa027a80fa944b86c54` |
| `sfx/sfx_f2_lanternfox_death.m4a` | `app/resources/sfx/sfx_f2_lanternfox_death.m4a` | `8b84174c866c46cf744868ee78437b61b9fad75e5fce70797b60cf03d55a25bc` |
| `sfx/sfx_f2_lanternfox_hit.m4a` | `app/resources/sfx/sfx_f2_lanternfox_hit.m4a` | `77390d2f2d366685a808c15cfe8c5869581c49f112378f77af6164fd104de6f2` |
| `sfx/sfx_f2_mage4winds_attack_swing.m4a` | `app/resources/sfx/sfx_f2_mage4winds_attack_swing.m4a` | `556b39f4b88ab4369f9b7943a98f0880161c2429238e1a9bf601b770348ea91d` |
| `sfx/sfx_f2_mage4winds_death.m4a` | `app/resources/sfx/sfx_f2_mage4winds_death.m4a` | `c05c0d074c6d7b02d6bda86eff5a0895d44bcaf9f8e2ceeeb903cb72ab4fd03a` |
| `sfx/sfx_f2_mage4winds_hit.m4a` | `app/resources/sfx/sfx_f2_mage4winds_hit.m4a` | `a2885a4764d4197b18f7b19603a59f09ad98407f8a0610762cd24df935797eb0` |
| `sfx/sfx_f2_mage4winds_impact.m4a` | `app/resources/sfx/sfx_f2_mage4winds_impact.m4a` | `5715120464fcb820fa0594e553d9871c88524af18a87f74146fceba20c69c361` |
| `sfx/sfx_f2_stormkage_attack_swing.m4a` | `app/resources/sfx/sfx_f2_stormkage_attack_swing.m4a` | `7696d55a3ad36bbc013033be1d3e25fa7fca56b556dff5f1539cfdeba03acbb8` |
| `sfx/sfx_f2_stormkage_death.m4a` | `app/resources/sfx/sfx_f2_stormkage_death.m4a` | `2bef74f306f99f4e93815669d24612cf057ec1160be0e2fc159bb56229643219` |
| `sfx/sfx_f2_stormkage_hit.m4a` | `app/resources/sfx/sfx_f2_stormkage_hit.m4a` | `259ad8ed42778b6eabd1ffab98ea48b225ea356b47eec4f0b6924902da99491f` |
| `sfx/sfx_f2general_attack_impact_3.m4a` | `app/resources/sfx/sfx_f2general_attack_impact_3.m4a` | `16e7e2f8b201e491d832c3f5b135a371a9480c36a19c064302109f2c2ff469dc` |
| `sfx/sfx_f2general_attack_swing.m4a` | `app/resources/sfx/sfx_f2general_attack_swing.m4a` | `fb5375323ba27b508c196fe13b88242d6d6317ba96e3406ec9ef89ea848f2f79` |
| `sfx/sfx_f2general_death.m4a` | `app/resources/sfx/sfx_f2general_death.m4a` | `e1be3dd6596a60ac5085959689bd46d47a71f1df2344c83214e278fb34498c51` |
| `sfx/sfx_f2general_hit_2.m4a` | `app/resources/sfx/sfx_f2general_hit_2.m4a` | `c613ea98cc93dee6b6cdf021c19f068900b395d4618982ae24336eab2056645a` |
| `sfx/sfx_f2melee_attack_impact_1.m4a` | `app/resources/sfx/sfx_f2melee_attack_impact_1.m4a` | `9aed925a480408f987ad6cbbba938086033adeb95cf4561136021a66ed638c07` |
| `sfx/sfx_f2melee_attack_swing_2.m4a` | `app/resources/sfx/sfx_f2melee_attack_swing_2.m4a` | `f8f814494143a244562a00a95e2bdfa0a06a2e5054d38e42b92320386f5014c2` |
| `sfx/sfx_f2melee_death.m4a` | `app/resources/sfx/sfx_f2melee_death.m4a` | `8200c9adcc69876f14fdedea0d32b438320a336893a05772357b2291d4393731` |
| `sfx/sfx_f2melee_hit_2.m4a` | `app/resources/sfx/sfx_f2melee_hit_2.m4a` | `dec41fb6f0a7b33b37dc86adc77cef6aead16df0b95f84055c190fa05014ea7d` |
| `sfx/sfx_f2tank_attack_impact.m4a` | `app/resources/sfx/sfx_f2tank_attack_impact.m4a` | `8e8bd5074bd11047018aa0e37b3b008405469c3053cb726f996f7bd61e5c8bab` |
| `sfx/sfx_f2tank_attack_swing.m4a` | `app/resources/sfx/sfx_f2tank_attack_swing.m4a` | `69c999f39f2ee09bdd34b5a6f1213dee7b343898052684c9e9cb1f02bb93458e` |
| `sfx/sfx_f2tank_death.m4a` | `app/resources/sfx/sfx_f2tank_death.m4a` | `df5027bda852f6961555de9a3a61a5257dad014298470be0a931bec5545df0da` |
| `sfx/sfx_f2tank_hit_3.m4a` | `app/resources/sfx/sfx_f2tank_hit_3.m4a` | `7a3d1774f0f9b7a3ad3d624026e5e0b6a50c6687d68d7e1dee271cf8e6eb3916` |
| `sfx/sfx_f3_aymarahealer_attack_swing.m4a` | `app/resources/sfx/sfx_f3_aymarahealer_attack_swing.m4a` | `4c2ec260e48dfdf75b8b7d99595b795104fa60059a08a8dc3710874a436266e0` |
| `sfx/sfx_f3_aymarahealer_death.m4a` | `app/resources/sfx/sfx_f3_aymarahealer_death.m4a` | `d31918f67e756f6c9fe6ea23d3d76ab94540337909f078be563dce3383e8c569` |
| `sfx/sfx_f3_aymarahealer_hit.m4a` | `app/resources/sfx/sfx_f3_aymarahealer_hit.m4a` | `aed75df4af51b10102e7aaefa276bf3e237a659620aee00ce217f910b4c4cb80` |
| `sfx/sfx_f3_aymarahealer_impact.m4a` | `app/resources/sfx/sfx_f3_aymarahealer_impact.m4a` | `6678b8a4f46b5b852b8cd1546717fa4a0ec7b52c1b9fcfb822fbada3fb000c66` |
| `sfx/sfx_f3_dunecaster_attack_swing.m4a` | `app/resources/sfx/sfx_f3_dunecaster_attack_swing.m4a` | `b485a40af1ee7895a674418b24a79c717f7fe12a97fc983824b0c4eebc3d0c7e` |
| `sfx/sfx_f3_dunecaster_death.m4a` | `app/resources/sfx/sfx_f3_dunecaster_death.m4a` | `a32e0f863fad82a2e836342cce9ebfbffdb32d554123f6163c645d5de39f39cb` |
| `sfx/sfx_f3_dunecaster_hit.m4a` | `app/resources/sfx/sfx_f3_dunecaster_hit.m4a` | `ed6c23e2b8f4ae11822b3268634733b34b5839320191f3cb40f978c0c1b9be44` |
| `sfx/sfx_f3_dunecaster_impact.m4a` | `app/resources/sfx/sfx_f3_dunecaster_impact.m4a` | `cae54809b67d49efba8a87e8c9ef162bd55b61dac9b44a66e7de87dc212dad7a` |
| `sfx/sfx_f3_general_attack_impact.m4a` | `app/resources/sfx/sfx_f3_general_attack_impact.m4a` | `2843d3195448766df4aa5a2b96512c86889f3f9eb1efc1daffeb34b4af2b2ca6` |
| `sfx/sfx_f3_general_attack_swing.m4a` | `app/resources/sfx/sfx_f3_general_attack_swing.m4a` | `505e5429d440b9312a60d3e93fde85ca9f034d4f8d2e4e374e07383c51462b78` |
| `sfx/sfx_f3_general_hit.m4a` | `app/resources/sfx/sfx_f3_general_hit.m4a` | `99650f949981700f8608210b808879df6994d25fc1277ac5074dea9b63bf29b3` |
| `sfx/sfx_f3_orbweaver_attack_swing.m4a` | `app/resources/sfx/sfx_f3_orbweaver_attack_swing.m4a` | `9fb86cbc855cb65fec8b2f5f27a5fe098ae3c6a81d763179f5d3afd9b7fa2a80` |
| `sfx/sfx_f3_orbweaver_death.m4a` | `app/resources/sfx/sfx_f3_orbweaver_death.m4a` | `6847b392c446a081ea0ad2d1e2fa73ff989b45404ae758ddef9a2da7710ed0cd` |
| `sfx/sfx_f3_orbweaver_hit.m4a` | `app/resources/sfx/sfx_f3_orbweaver_hit.m4a` | `c5a118591d3e45be05da5f94e573a2dcbd4c4525a3aa63daf9608a6851c82ad3` |
| `sfx/sfx_f3_orbweaver_impact.m4a` | `app/resources/sfx/sfx_f3_orbweaver_impact.m4a` | `5852017587326b29dab52c31ebd3e2650958abf427d5cc5fb9643ee596de7622` |
| `sfx/sfx_f4_blacksolus_attack_impact.m4a` | `app/resources/sfx/sfx_f4_blacksolus_attack_impact.m4a` | `ff5059c52c0d100bf780f7798e25680c8a48ca06aa03b39a31762eda037a30c1` |
| `sfx/sfx_f4_blacksolus_attack_swing.m4a` | `app/resources/sfx/sfx_f4_blacksolus_attack_swing.m4a` | `279766b252b5cb076ea455a170e1f0b9ac54d6871f181197bf1e893f240f9d09` |
| `sfx/sfx_f4_blacksolus_death.m4a` | `app/resources/sfx/sfx_f4_blacksolus_death.m4a` | `1b35845b8249b455fc42f45983ebb6cb999d42940cdf48c8899f3d1a8e025f3a` |
| `sfx/sfx_f4_blacksolus_hit.m4a` | `app/resources/sfx/sfx_f4_blacksolus_hit.m4a` | `683bd6c2b9fcda01a55ae6bc97bf99d30b4ae84e891c2489b952c2ca83cef82b` |
| `sfx/sfx_f4_crawler_attack_impact.m4a` | `app/resources/sfx/sfx_f4_crawler_attack_impact.m4a` | `830072af156ed1feb436947bacd5dbe80c3f17803f3b768162b16105e4d5ef4d` |
| `sfx/sfx_f4_crawler_attack_swing.m4a` | `app/resources/sfx/sfx_f4_crawler_attack_swing.m4a` | `9b837f83e74ce92f1391b1cddc91f4f8416e94842a5db4b033a51384b62e1d31` |
| `sfx/sfx_f4_crawler_death.m4a` | `app/resources/sfx/sfx_f4_crawler_death.m4a` | `00534f83a423f96a8cad89825cbe321da894775be85479b69a67bbf705353521` |
| `sfx/sfx_f4_crawler_hit.m4a` | `app/resources/sfx/sfx_f4_crawler_hit.m4a` | `be57cd68e7583bf57e7195fa7a3e899b007ff22eee27c9da69ef944a0c239cc9` |
| `sfx/sfx_f4_daemondeep_attack_impact.m4a` | `app/resources/sfx/sfx_f4_daemondeep_attack_impact.m4a` | `9f529a3f6322931211d575194e53a184b956e84b8315da05642c8d3d84706235` |
| `sfx/sfx_f4_daemondeep_attack_swing.m4a` | `app/resources/sfx/sfx_f4_daemondeep_attack_swing.m4a` | `05959bcf73f3b5b5e3dc76ba6df7e569be1bf4a3e6acf14bf656efa7490c6660` |
| `sfx/sfx_f4_daemondeep_death.m4a` | `app/resources/sfx/sfx_f4_daemondeep_death.m4a` | `80cb899d6b6c1550a1a69f5c28529cea5a6ab0cf423a619f8076c9c94398ff36` |
| `sfx/sfx_f4_daemondeep_hit.m4a` | `app/resources/sfx/sfx_f4_daemondeep_hit.m4a` | `c598a14ee4c40419237c80263735d78325b5b36db2922f211bd3a97476bfe00c` |
| `sfx/sfx_f4_daemongate_attack_impact.m4a` | `app/resources/sfx/sfx_f4_daemongate_attack_impact.m4a` | `a50948d70234869698297309959e310ae71cbac89ab8113a89b2c726c97f6a1f` |
| `sfx/sfx_f4_daemongate_attack_swing.m4a` | `app/resources/sfx/sfx_f4_daemongate_attack_swing.m4a` | `381c7c15983862c5569300692736a5606de1c5bf56f9458f1080c08445f950fa` |
| `sfx/sfx_f4_daemongate_death.m4a` | `app/resources/sfx/sfx_f4_daemongate_death.m4a` | `ca43f38d9002627f39a217ef73290eb081aa38f77b8f44a1f1e7df7ec2d36518` |
| `sfx/sfx_f4_daemongate_hit.m4a` | `app/resources/sfx/sfx_f4_daemongate_hit.m4a` | `2db14f8e629bd67ea4b06dfe7f2eee287ffcf8b4ef45d3b42725efb9152f314d` |
| `sfx/sfx_f4_engulfingshadow_attack_impact.m4a` | `app/resources/sfx/sfx_f4_engulfingshadow_attack_impact.m4a` | `c6a8ea3fd3c55ee0323417673316799b2ad62c3081e8a02bf185472f3c8765a9` |
| `sfx/sfx_f4_engulfingshadow_attack_swing.m4a` | `app/resources/sfx/sfx_f4_engulfingshadow_attack_swing.m4a` | `a7b2ca485f480a1589229a7748476bf2ca2a13f9d14613b0e47691df4c9ce76d` |
| `sfx/sfx_f4_engulfingshadow_death.m4a` | `app/resources/sfx/sfx_f4_engulfingshadow_death.m4a` | `f684478e42d652fc337a270f5a9100aaba807f5600e60ee1ed6bd4d8bc3c89ce` |
| `sfx/sfx_f4_engulfingshadow_hit.m4a` | `app/resources/sfx/sfx_f4_engulfingshadow_hit.m4a` | `ddbfcf898b740c1d9634004160f8e0caf4be4215d66cd3f88dbaa0fe48d24c8f` |
| `sfx/sfx_f4_general_attack_impact.m4a` | `app/resources/sfx/sfx_f4_general_attack_impact.m4a` | `7688ba7af93d5ce6655141d3df0c98fda8e3fd831e9a8a07609d9705260f8511` |
| `sfx/sfx_f4_general_attack_swing.m4a` | `app/resources/sfx/sfx_f4_general_attack_swing.m4a` | `1fccbe4beb676e7d9f83d29bcade351e26b9558472e21ac79ab7ae0344af3e53` |
| `sfx/sfx_f4_general_hit.m4a` | `app/resources/sfx/sfx_f4_general_hit.m4a` | `08b3ead27bce97393a2642f092565488a1f01b142f3942703e8f3e7832329ae6` |
| `sfx/sfx_f4_juggernaut_attack_impact.m4a` | `app/resources/sfx/sfx_f4_juggernaut_attack_impact.m4a` | `31e5e9f3211dcf57b6d41bbb46e987397d93fb78da388aead7f83b3e8ebb9055` |
| `sfx/sfx_f4_juggernaut_attack_swing.m4a` | `app/resources/sfx/sfx_f4_juggernaut_attack_swing.m4a` | `4fcf0191162b7e8059f421612f77d7eb31d0cf798faab9a765fdb9656f65ecb8` |
| `sfx/sfx_f4_juggernaut_death.m4a` | `app/resources/sfx/sfx_f4_juggernaut_death.m4a` | `a12e6a9a96b72b69f3c0e15eab3b373bc661bffec48cbcc5ae563789d92b43b6` |
| `sfx/sfx_f4_juggernaut_hit.m4a` | `app/resources/sfx/sfx_f4_juggernaut_hit.m4a` | `23dc036ef5b3225ef9190205fbecee4e9ed4fe33a1513ca9791fd48ec754f8f0` |
| `sfx/sfx_f4_siren_attack_impact.m4a` | `app/resources/sfx/sfx_f4_siren_attack_impact.m4a` | `23f25d72b7ef5ca51b47db600ab4389160984451198b4f8c197c2aa751abc1d5` |
| `sfx/sfx_f4_siren_attack_swing.m4a` | `app/resources/sfx/sfx_f4_siren_attack_swing.m4a` | `9ae4569282b03e6e4e4330b628a673ebda3bf4e6dc9e68d693f92baaa472d178` |
| `sfx/sfx_f4_siren_death.m4a` | `app/resources/sfx/sfx_f4_siren_death.m4a` | `c0b178804986a6c2f534c45f8fb18d8cab260eb7217c4ef3897a9544910c022d` |
| `sfx/sfx_f4_siren_hit.m4a` | `app/resources/sfx/sfx_f4_siren_hit.m4a` | `43ffe0e934b85d903e77fdcf7f9bbab7939edd21d7fb6b00a13f72aee39fae26` |
| `sfx/sfx_f5_general_attack_impact.m4a` | `app/resources/sfx/sfx_f5_general_attack_impact.m4a` | `41d678a8889b4ec064d82701a33c41fc01a621378e36c0fceb08acca5bae5ed8` |
| `sfx/sfx_f5_general_attack_swing.m4a` | `app/resources/sfx/sfx_f5_general_attack_swing.m4a` | `d132b0290f0043f8ad5c5af86e063cf822913ef9711f8e346abf64d5f03a3667` |
| `sfx/sfx_f5_general_hit.m4a` | `app/resources/sfx/sfx_f5_general_hit.m4a` | `4ad7650f98ef4859245c0e8bae7f1051b47976b2e891a95be517410649f69132` |
| `sfx/sfx_f5_kolossus_attack_impact.m4a` | `app/resources/sfx/sfx_f5_kolossus_attack_impact.m4a` | `f6c97a26667b19d58a36daef444051533e52842ccac7a6fd6c473a6e32f186cb` |
| `sfx/sfx_f5_kolossus_attack_swing.m4a` | `app/resources/sfx/sfx_f5_kolossus_attack_swing.m4a` | `0f65a66691011c384125a6d6c64f5152b1624a8a350bd7ff59f3b3a55100d7b0` |
| `sfx/sfx_f5_kolossus_death.m4a` | `app/resources/sfx/sfx_f5_kolossus_death.m4a` | `b50890510bc55f67437ded633bbb8df0734406763ac5fe702d518da4d815ac81` |
| `sfx/sfx_f5_kolossus_hit.m4a` | `app/resources/sfx/sfx_f5_kolossus_hit.m4a` | `137c1385a8b8e69b4fc756dc6df51d13c4a4ffda5ed3d2e770e6dfcc7a1c7905` |
| `sfx/sfx_f5_silitharelder_attack_impact.m4a` | `app/resources/sfx/sfx_f5_silitharelder_attack_impact.m4a` | `359bdcdd30cd8822375952d8a7e27626705bbe5970e4491eb7b9126b082a4cd7` |
| `sfx/sfx_f5_silitharelder_attack_swing.m4a` | `app/resources/sfx/sfx_f5_silitharelder_attack_swing.m4a` | `22912141c91be6e970ff9469ad18fd91877e7c844d6a261f2f4d8ba9bf5785cc` |
| `sfx/sfx_f5_silitharelder_death.m4a` | `app/resources/sfx/sfx_f5_silitharelder_death.m4a` | `53d8ffa530cc019226f4f82ada566760e49fc6bfd634689d248341ae18b6f8b6` |
| `sfx/sfx_f5_silitharelder_hit.m4a` | `app/resources/sfx/sfx_f5_silitharelder_hit.m4a` | `4dcfacc777795287587e89164854304317751931eb83e60fe88c3a730ddc0d55` |
| `sfx/sfx_f5_unstableleviathan_attack_impact.m4a` | `app/resources/sfx/sfx_f5_unstableleviathan_attack_impact.m4a` | `06b7296b7d0ce40037a7eeedb894c75d7630aeab26ea2141e543834fe24322db` |
| `sfx/sfx_f5_unstableleviathan_attack_swing.m4a` | `app/resources/sfx/sfx_f5_unstableleviathan_attack_swing.m4a` | `b23ed849a429e7c664dcc7f04dcb9c7c0450de2e1c8f8c6dc202de6ed7a745e2` |
| `sfx/sfx_f5_unstableleviathan_death.m4a` | `app/resources/sfx/sfx_f5_unstableleviathan_death.m4a` | `1ebd1a186a6236ec96fb04c9ce3c7ffdf49545c25e5840032f2cade7f5b52f7d` |
| `sfx/sfx_f5_unstableleviathan_hit.m4a` | `app/resources/sfx/sfx_f5_unstableleviathan_hit.m4a` | `d0949d36ca345b271d333655724b8c479e3348441dfc466224ceacaeff3771bb` |
| `sfx/sfx_f5_vindicator_attack_impact.m4a` | `app/resources/sfx/sfx_f5_vindicator_attack_impact.m4a` | `526c872409da2721e59be45e7597211ec50f7d85fbdad715886c12e581ea10c0` |
| `sfx/sfx_f5_vindicator_attack_swing.m4a` | `app/resources/sfx/sfx_f5_vindicator_attack_swing.m4a` | `94050627c4faef2e87feb21f71cebb3b86181c8091796488477385707db14b23` |
| `sfx/sfx_f5_vindicator_death.m4a` | `app/resources/sfx/sfx_f5_vindicator_death.m4a` | `ad0147fcd252114e5ff135d6b4d22e2370f2ef7f12fe2ff038afbeecdfacb755` |
| `sfx/sfx_f5_vindicator_hit.m4a` | `app/resources/sfx/sfx_f5_vindicator_hit.m4a` | `e535c7a1b0a79099b062bd6bb7c0eec867709b6d349c6a6e1bbbe5e4756481c3` |
| `sfx/sfx_f6_ancientgrove_attack_impact.m4a` | `app/resources/sfx/sfx_f6_ancientgrove_attack_impact.m4a` | `03b1a6294e294209dbd1d82f1586a2e5a29365a72e2b6e550cd63b77786d74ca` |
| `sfx/sfx_f6_ancientgrove_attack_swing.m4a` | `app/resources/sfx/sfx_f6_ancientgrove_attack_swing.m4a` | `1656ed11df0411619619a17d282fc603d3d88dd2372d7ebd6dd65bf6f4bf6e62` |
| `sfx/sfx_f6_ancientgrove_death.m4a` | `app/resources/sfx/sfx_f6_ancientgrove_death.m4a` | `f94b2bfea3a940b68700499ec6b3604da5ad310970c9f93c009230d283c446f7` |
| `sfx/sfx_f6_ancientgrove_hit.m4a` | `app/resources/sfx/sfx_f6_ancientgrove_hit.m4a` | `9d0ac3ec809c446158fbc24ef2a9b19a9ce5de5aee9c7574782759e6d0f90cc9` |
| `sfx/sfx_f6_boreanbear_attack_impact.m4a` | `app/resources/sfx/sfx_f6_boreanbear_attack_impact.m4a` | `13c557c8814e1c3156e0374b2a6b5c418fdfc17fb850ed2e6bd6b534bd8769a6` |
| `sfx/sfx_f6_boreanbear_attack_swing.m4a` | `app/resources/sfx/sfx_f6_boreanbear_attack_swing.m4a` | `12506efa1f14769fd5d6a96b8ed284c6d0004d33c7354b40df4cc7e43602c930` |
| `sfx/sfx_f6_boreanbear_death.m4a` | `app/resources/sfx/sfx_f6_boreanbear_death.m4a` | `bbe48e6a560915dadbc3167e592f3a90a8ffbebaf513921ff743b13a8f78830b` |
| `sfx/sfx_f6_boreanbear_hit.m4a` | `app/resources/sfx/sfx_f6_boreanbear_hit.m4a` | `a1e60ae302480eb818fa46f66c4202f0e6229022cf0994cd4b38a30a805de219` |
| `sfx/sfx_f6_draugarlord_attack_impact_.m4a` | `app/resources/sfx/sfx_f6_draugarlord_attack_impact_.m4a` | `9c117250904397e5895910ed03a419c330a81ceb1fad6911f5951f5861715ef9` |
| `sfx/sfx_f6_draugarlord_attack_swing_.m4a` | `app/resources/sfx/sfx_f6_draugarlord_attack_swing_.m4a` | `f61fe7fb7c27091bc8726ddbe76572f69257041993ab704eb98f3b114f0786e0` |
| `sfx/sfx_f6_draugarlord_death.m4a` | `app/resources/sfx/sfx_f6_draugarlord_death.m4a` | `5446a9c125697f2315e11ef92126d4df1edab439ece19e00cd1dbb1c8836e6da` |
| `sfx/sfx_f6_draugarlord_hit.m4a` | `app/resources/sfx/sfx_f6_draugarlord_hit.m4a` | `41a9d5279c5281fe9148721dcb1278da703973eced0813b29a4ccee271f2dd84` |
| `sfx/sfx_f6_fenrirwarmaster_attack_impact.m4a` | `app/resources/sfx/sfx_f6_fenrirwarmaster_attack_impact.m4a` | `68bf9916df4a733eb448c174269fb432b9deac3a155f37068a714ff48d0552ec` |
| `sfx/sfx_f6_fenrirwarmaster_attack_swing.m4a` | `app/resources/sfx/sfx_f6_fenrirwarmaster_attack_swing.m4a` | `158c3e14c3af7ea5b43cd58b7f1ee5377535a38d0463beb7804dbf6d9cdbacc3` |
| `sfx/sfx_f6_fenrirwarmaster_death.m4a` | `app/resources/sfx/sfx_f6_fenrirwarmaster_death.m4a` | `452d43a9dc082060ecff1270ce111a5aafb71be7666ef8957b2c69c914448090` |
| `sfx/sfx_f6_fenrirwarmaster_hit.m4a` | `app/resources/sfx/sfx_f6_fenrirwarmaster_hit.m4a` | `0bb6af9f9aa2b03316b99bd08c6aab4a2b8fa65851c9977856a392a4ef6b468e` |
| `sfx/sfx_f6_frostwyvern_attack_impact.m4a` | `app/resources/sfx/sfx_f6_frostwyvern_attack_impact.m4a` | `23379c91d98d97ffaa4bbea82879730ab5fa00bf810264f031318dc4a3dfa0ec` |
| `sfx/sfx_f6_frostwyvern_attack_swing.m4a` | `app/resources/sfx/sfx_f6_frostwyvern_attack_swing.m4a` | `76e8c10839417909a5b2b57f36d421ba7ad36dfbe159e094bfe55214dfff9b8e` |
| `sfx/sfx_f6_frostwyvern_death.m4a` | `app/resources/sfx/sfx_f6_frostwyvern_death.m4a` | `01a197f9d766b683562a323159c2fa0ee53dd49b19e28a9922e24329eaac339e` |
| `sfx/sfx_f6_frostwyvern_hit.m4a` | `app/resources/sfx/sfx_f6_frostwyvern_hit.m4a` | `3f61995b308ab77ddf85fc83d4ae88b46fc3c99284b4301eb0f74e1f37870deb` |
| `sfx/sfx_f6_ghostwolf_attack_impact.m4a` | `app/resources/sfx/sfx_f6_ghostwolf_attack_impact.m4a` | `a45f69217abd68bab01df97f0d358caddaed65be67e4486bb9396f6b1bdd73b7` |
| `sfx/sfx_f6_ghostwolf_attack_swing.m4a` | `app/resources/sfx/sfx_f6_ghostwolf_attack_swing.m4a` | `0c4310fba83e163f172def8df205ac9b127782746bf171caf934a60ff8524597` |
| `sfx/sfx_f6_ghostwolf_death.m4a` | `app/resources/sfx/sfx_f6_ghostwolf_death.m4a` | `9280254059ca73217d0ea52beea16e05016f53be7bc60457c65aebefd2c42a57` |
| `sfx/sfx_f6_ghostwolf_hit.m4a` | `app/resources/sfx/sfx_f6_ghostwolf_hit.m4a` | `887e250bc14c87e690dbb17ea22a70c4b101ad9324863ae3458bb3c319174d7c` |
| `sfx/sfx_f6_icebeetle_attack_impact.m4a` | `app/resources/sfx/sfx_f6_icebeetle_attack_impact.m4a` | `b2311c6f4fd0558617a71646c09606b1ba6b3c2c551aa6b5ba1ca919bb292df8` |
| `sfx/sfx_f6_icebeetle_attack_swing.m4a` | `app/resources/sfx/sfx_f6_icebeetle_attack_swing.m4a` | `1b6ee90aa6945f2fdc1f538dee95cdc8c2ccbf1bafc02eec0175f629514a88b3` |
| `sfx/sfx_f6_icebeetle_death.m4a` | `app/resources/sfx/sfx_f6_icebeetle_death.m4a` | `2d088c09893e76ca9ab817e10a569a071a33a575c6911255fd12e1990f3823eb` |
| `sfx/sfx_f6_icebeetle_hit.m4a` | `app/resources/sfx/sfx_f6_icebeetle_hit.m4a` | `6b54140b2f2415a8f2c37debafedade2fd6474ac31c0217a74cf0298c337422e` |
| `sfx/sfx_f6_icedryad_attack_impact.m4a` | `app/resources/sfx/sfx_f6_icedryad_attack_impact.m4a` | `e68970f8045974ebb3a7d8d31846c4fcfd02ef4dbec578b26c147c0e6756b341` |
| `sfx/sfx_f6_icedryad_attack_swing.m4a` | `app/resources/sfx/sfx_f6_icedryad_attack_swing.m4a` | `61b181814eb41350dd6fdc91ff46a9479e0530a2fb86b041fa3fcaa9bbb81caa` |
| `sfx/sfx_f6_icedryad_death.m4a` | `app/resources/sfx/sfx_f6_icedryad_death.m4a` | `6a1db240c68d03b81e60b8299b9c680c7932e784585ddc5212e50ec9e9ad5829` |
| `sfx/sfx_f6_icedryad_hit.m4a` | `app/resources/sfx/sfx_f6_icedryad_hit.m4a` | `23ed51abf0a16827082764a925623cc26df3ece6796ada80a278f9f7d6c009d5` |
| `sfx/sfx_f6_seismicelemental_attack_impact.m4a` | `app/resources/sfx/sfx_f6_seismicelemental_attack_impact.m4a` | `52a83bb88eded4fe5be157c8059a7591b32299d3f2cc1a83d8c67f7ace1857d6` |
| `sfx/sfx_f6_snowelemental_attack_impact.m4a` | `app/resources/sfx/sfx_f6_snowelemental_attack_impact.m4a` | `cfbd4cf64ecf96bd844f1fe7452fdd0d05b52946bacfc491065df218d45ced74` |
| `sfx/sfx_f6_snowelemental_attack_swing.m4a` | `app/resources/sfx/sfx_f6_snowelemental_attack_swing.m4a` | `ce783ceddad1546dc0e73abb6284470b2deba792ae5f2e55b855852d19dbc0ae` |
| `sfx/sfx_f6_snowelemental_death.m4a` | `app/resources/sfx/sfx_f6_snowelemental_death.m4a` | `88d633f9ca555905f2611248588f1df86855f37553b1b24c073afaa5a4dfe3fb` |
| `sfx/sfx_f6_snowelemental_hit.m4a` | `app/resources/sfx/sfx_f6_snowelemental_hit.m4a` | `4e57b4eb9764faad7e37cc56b9bd6d6f448a5936d87ca03949993f8723391948` |
| `sfx/sfx_f6_voiceofthewind_attack_impact.m4a` | `app/resources/sfx/sfx_f6_voiceofthewind_attack_impact.m4a` | `01c0d395c9726e7feeef4a228c02dada43367565556862c296b5a4399c4e38d7` |
| `sfx/sfx_f6_voiceofthewind_attack_swing.m4a` | `app/resources/sfx/sfx_f6_voiceofthewind_attack_swing.m4a` | `c71aa349b2f01c99dd9cca0a8808cc97bd6b96992ef609ef5057aa7f82dd0a5c` |
| `sfx/sfx_f6_voiceofthewind_death.m4a` | `app/resources/sfx/sfx_f6_voiceofthewind_death.m4a` | `7c5ac0d3da7f25f926a49f7eade2e2cf09fa0f949ca672642474e435bd7f9603` |
| `sfx/sfx_f6_voiceofthewind_hit.m4a` | `app/resources/sfx/sfx_f6_voiceofthewind_hit.m4a` | `0f30d0137d08072b1bdadcd7fc8a974b4191d3fd291421897f617d18849b1336` |
| `sfx/sfx_f6_waterelemental_attack_impact.m4a` | `app/resources/sfx/sfx_f6_waterelemental_attack_impact.m4a` | `79efd9da0bcad4e17eabc3c585a286c78aebc5d3fb7f6804c9b71d364a709742` |
| `sfx/sfx_f6_waterelemental_attack_swing.m4a` | `app/resources/sfx/sfx_f6_waterelemental_attack_swing.m4a` | `48b33cd3dcaebb9097cd2e93c9f7da8a98b0a757b4674759f8c70d69fdf8c4a7` |
| `sfx/sfx_f6_waterelemental_death.m4a` | `app/resources/sfx/sfx_f6_waterelemental_death.m4a` | `dedf3e6ad952bf1a5907cc6a5b614f75fc6656ca4fd484d388aa35e80a1be5f1` |
| `sfx/sfx_f6_waterelemental_hit.m4a` | `app/resources/sfx/sfx_f6_waterelemental_hit.m4a` | `f00fb2bcb18f2c824ff38e7b4687909b50c63682c1c9abc705804f19d6e5fd2e` |
| `sfx/sfx_neutral_arakiheadhunter_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_arakiheadhunter_attack_swing.m4a` | `f3da727784dc7cf3544797f12cab465f590ce3449ac0a4a6499d9d09ed129df2` |
| `sfx/sfx_neutral_arakiheadhunter_hit.m4a` | `app/resources/sfx/sfx_neutral_arakiheadhunter_hit.m4a` | `0e04f45a3b668bfabf8e1a93704ccf7b75788729f7d2d5b5f568c69ffeac7590` |
| `sfx/sfx_neutral_arcanelimiter_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_arcanelimiter_attack_impact.m4a` | `4273ddc8e0ceecf39b1daba8642714f20af3e2ce9335c66afa6f5d472ced1b5d` |
| `sfx/sfx_neutral_arcanelimiter_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_arcanelimiter_attack_swing.m4a` | `5bb527ff4d2856741171be090f63a879905a884ff482a875afb98f10a3652c2a` |
| `sfx/sfx_neutral_arcanelimiter_death.m4a` | `app/resources/sfx/sfx_neutral_arcanelimiter_death.m4a` | `9f38520ec43a08da420e11a670adc816231cb72853f6d780c1c4050c74a270c9` |
| `sfx/sfx_neutral_arcanelimiter_hit.m4a` | `app/resources/sfx/sfx_neutral_arcanelimiter_hit.m4a` | `c0cf14da9c1254afce4e2a2619c8c9ebe6b16941f88ef305f26c17296a9508e0` |
| `sfx/sfx_neutral_archonspellbinder_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_archonspellbinder_attack_impact.m4a` | `268cb5694ca2d7e1a38e0a00424b0f370d8915fd6e4552cf90f5d7f3e7544b4b` |
| `sfx/sfx_neutral_archonspellbinder_death.m4a` | `app/resources/sfx/sfx_neutral_archonspellbinder_death.m4a` | `7b1453ebe468426c56e9a2eda23749e2e6788d582b7afcf38681eb2689a2aec6` |
| `sfx/sfx_neutral_archonspellbinder_hit.m4a` | `app/resources/sfx/sfx_neutral_archonspellbinder_hit.m4a` | `5797a4233d013fdb3e46a34368542c4281336c943f448ef78bc381f7f12bc2e5` |
| `sfx/sfx_neutral_artifacthunter_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_artifacthunter_attack_impact.m4a` | `587c8bdf23404ee949be384fbdf4a1eecf477d0fd214567a84cb6735faa25245` |
| `sfx/sfx_neutral_artifacthunter_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_artifacthunter_attack_swing.m4a` | `a02fbaae1c1393bccf3e1b20cd6fb50b2935791d0c3d244b66252d4b880a95b6` |
| `sfx/sfx_neutral_artifacthunter_death.m4a` | `app/resources/sfx/sfx_neutral_artifacthunter_death.m4a` | `871353fe8a8e9a09560819aa52ff26ddf6ee7b37e3a809713f1497f77b08e315` |
| `sfx/sfx_neutral_artifacthunter_hit.m4a` | `app/resources/sfx/sfx_neutral_artifacthunter_hit.m4a` | `05fd66bef387d90f8acf32c9e0043ac133361773170d9f3eaf8d82f47b245d87` |
| `sfx/sfx_neutral_beastphasehound_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_beastphasehound_attack_impact.m4a` | `a778f7f9de9138913611900a9ee162e9283c7c449154ff57c5d0974feeae042d` |
| `sfx/sfx_neutral_beastphasehound_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_beastphasehound_attack_swing.m4a` | `2f9acda4d64429a315e716645f5cdc37e44d782a3c77d153709105f87000bf82` |
| `sfx/sfx_neutral_beastphasehound_death.m4a` | `app/resources/sfx/sfx_neutral_beastphasehound_death.m4a` | `21f4ee1e7236b00d78c52840190b6445d28c26b94e9f5b348bc22db509e6070f` |
| `sfx/sfx_neutral_beastphasehound_hit.m4a` | `app/resources/sfx/sfx_neutral_beastphasehound_hit.m4a` | `68cb0af34cff8674be9fd3bd48114d0ce7fc71d0fda0da35e164a26f8c95ad46` |
| `sfx/sfx_neutral_beastsaberspinetiger_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_beastsaberspinetiger_attack_impact.m4a` | `42f3cffbd078e6a68f50b31e8c6ae5937a10ad923b35f4dee5c050b3cad2239d` |
| `sfx/sfx_neutral_beastsaberspinetiger_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_beastsaberspinetiger_attack_swing.m4a` | `4b567a98fd264f489634b1f96795d4504f23c85855a5e076b43107fad8142183` |
| `sfx/sfx_neutral_beastsaberspinetiger_death.m4a` | `app/resources/sfx/sfx_neutral_beastsaberspinetiger_death.m4a` | `15192854ebb1266871032dcf3d43f0a91b92966bb0e364843b502047c91887bb` |
| `sfx/sfx_neutral_beastsaberspinetiger_hit.m4a` | `app/resources/sfx/sfx_neutral_beastsaberspinetiger_hit.m4a` | `65969211b8f000dc9ad4bb4f9392634b4dce391feae58b7704f4b8c6d9d7c0e1` |
| `sfx/sfx_neutral_bloodtearalchemist_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_bloodtearalchemist_attack_impact.m4a` | `96b404844c9d89ca419c9b6e017789b8ac8c8e782b8780b5d64f412598d0cb14` |
| `sfx/sfx_neutral_bloodtearalchemist_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_bloodtearalchemist_attack_swing.m4a` | `a051710d39b9c832a49047d04a7ad2e5d63125ed10ea239b5148701c9abef146` |
| `sfx/sfx_neutral_bloodtearalchemist_death.m4a` | `app/resources/sfx/sfx_neutral_bloodtearalchemist_death.m4a` | `01d9515622a069bef42530a031e9db82ce8ca947eb8513bb32936ae731e1ee20` |
| `sfx/sfx_neutral_bloodtearalchemist_hit.m4a` | `app/resources/sfx/sfx_neutral_bloodtearalchemist_hit.m4a` | `5abdf6f3180afb84111d0db22549cc6b9c83e6dae0c92c362fa75cad8eafffe6` |
| `sfx/sfx_neutral_bluetipscorpion_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_bluetipscorpion_attack_impact.m4a` | `bca845c5966833db86f837354ea55e06394d91af3814d1b7328e02ffc1cf34d6` |
| `sfx/sfx_neutral_bluetipscorpion_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_bluetipscorpion_attack_swing.m4a` | `42b259f80061db3b1aafcaef0d3552d2faacedae3b70c921c421251130661d76` |
| `sfx/sfx_neutral_bluetipscorpion_death.m4a` | `app/resources/sfx/sfx_neutral_bluetipscorpion_death.m4a` | `2a5bab3ee300bdcd1a3018028be4a7f097e1d26656b8df96afa69cc47614abe4` |
| `sfx/sfx_neutral_bluetipscorpion_hit.m4a` | `app/resources/sfx/sfx_neutral_bluetipscorpion_hit.m4a` | `7476e6a9e9f466d3c8f5fd4ae27b7faac4748ee4d8424d8da27647f5155ae64e` |
| `sfx/sfx_neutral_brightmossgolem_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_brightmossgolem_attack_impact.m4a` | `06183ddf30c5237624151dad1fcc740356294a8b1d6e7700089a655d24345a08` |
| `sfx/sfx_neutral_brightmossgolem_death.m4a` | `app/resources/sfx/sfx_neutral_brightmossgolem_death.m4a` | `5a81ccd8a6db589847b22ecd5ba8c48d8b5215a9f184161387ce75456846d1ef` |
| `sfx/sfx_neutral_brightmossgolem_hit.m4a` | `app/resources/sfx/sfx_neutral_brightmossgolem_hit.m4a` | `d48d70ad6032b1441f55ef0085a00a0d896eb8e166054c054bcd934d4dbb0c60` |
| `sfx/sfx_neutral_cannonmechaz0r_death.m4a` | `app/resources/sfx/sfx_neutral_cannonmechaz0r_death.m4a` | `d301d969bdc8ceaba140cd5204e85ee1c5b293b70487a6df1e0546ed815869bd` |
| `sfx/sfx_neutral_chaoselemental_hit.m4a` | `app/resources/sfx/sfx_neutral_chaoselemental_hit.m4a` | `7af68475f68cfcd4d2cd5df508c5c934f4b06602f0a1ce6befebfa8f19ac54b0` |
| `sfx/sfx_neutral_coiledcrawler_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_coiledcrawler_attack_impact.m4a` | `83aa7544ee5add291d25363dbe6316b205afd844c51aee661d2e51421bea78e2` |
| `sfx/sfx_neutral_coiledcrawler_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_coiledcrawler_attack_swing.m4a` | `f8c87dabd918740618921c01ca7c26e9f7eb4b25ac94884cb727c69f94bc6f7f` |
| `sfx/sfx_neutral_coiledcrawler_death.m4a` | `app/resources/sfx/sfx_neutral_coiledcrawler_death.m4a` | `37cd58a564f135dc13a5aead57ebff8fa042c11feb0c555b94b1511194a3cd05` |
| `sfx/sfx_neutral_coiledcrawler_hit.m4a` | `app/resources/sfx/sfx_neutral_coiledcrawler_hit.m4a` | `025865d313804a3b8223df0a7c202297830f21e8744734fa10ec8307c35e1dd3` |
| `sfx/sfx_neutral_crossbones_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_crossbones_attack_swing.m4a` | `edc482939c0409bf92ab9139f7635ba4d631889379d39a6d3e3f858a64647751` |
| `sfx/sfx_neutral_crossbones_hit.m4a` | `app/resources/sfx/sfx_neutral_crossbones_hit.m4a` | `1fd0ef0f7df04e3a18ffbeefe07b15f21d16f0b08de9cb86d7b798cc5a460b5c` |
| `sfx/sfx_neutral_daggerkiri_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_daggerkiri_attack_impact.m4a` | `bef09dbf8a840b6d96cd811f57b12904baa5cdb6f8dede0b17cb281548e023f3` |
| `sfx/sfx_neutral_daggerkiri_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_daggerkiri_attack_swing.m4a` | `b827750fd75721d11e45aec2e0ec01b9ea667daaf528df86462372bb35c346b6` |
| `sfx/sfx_neutral_daggerkiri_death.m4a` | `app/resources/sfx/sfx_neutral_daggerkiri_death.m4a` | `80a007663ac092b6c27b44d65b435d80bfc9ee06ee68f05f146a29a1877c6081` |
| `sfx/sfx_neutral_daggerkiri_hit.m4a` | `app/resources/sfx/sfx_neutral_daggerkiri_hit.m4a` | `38cd1756c723ec6175833f171a7bd11775493093d778e19338f50f84899fd7c4` |
| `sfx/sfx_neutral_dancingblades_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_dancingblades_attack_impact.m4a` | `15e849fff1e699dc22ab7ffac66e8fb04d6b7ee7ee0cde377b747f843fc3a178` |
| `sfx/sfx_neutral_dancingblades_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_dancingblades_attack_swing.m4a` | `cfa89a9f643b0a2c085abaf21477429d23499b90baa7a871c3a4b9292711bde7` |
| `sfx/sfx_neutral_dancingblades_death.m4a` | `app/resources/sfx/sfx_neutral_dancingblades_death.m4a` | `4511ad7fd87e8130cf504100e515b7e7c0ffdeb266b6877ee17f039b921572b8` |
| `sfx/sfx_neutral_dancingblades_hit.m4a` | `app/resources/sfx/sfx_neutral_dancingblades_hit.m4a` | `66800be0584600db548baf3d6066a4d660b814114c39e71c14930e11bdaf41e9` |
| `sfx/sfx_neutral_darkharbinger_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_darkharbinger_attack_swing.m4a` | `5a42fa8ed9166eafd9aadbbe5feaeb43851bcce50f49ec2fa150d9cf52faf800` |
| `sfx/sfx_neutral_darkharbinger_death.m4a` | `app/resources/sfx/sfx_neutral_darkharbinger_death.m4a` | `47dae96cada31c75df8bb36263f0172c52c62378338735ccf7bbab8aa697bceb` |
| `sfx/sfx_neutral_darkharbinger_hit.m4a` | `app/resources/sfx/sfx_neutral_darkharbinger_hit.m4a` | `1748afdbdf9a429f5d86bb247644ac522c0233308e906e9ce9e2afb1d5444071` |
| `sfx/sfx_neutral_darkharbinger_impact.m4a` | `app/resources/sfx/sfx_neutral_darkharbinger_impact.m4a` | `2ea28f8aa3ee139fc8d685926aec338cd4c6aa13b73901f9d10f03f7b943fdec` |
| `sfx/sfx_neutral_dragonlark_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_dragonlark_attack_impact.m4a` | `33690c8c91b34fbb1daed9d323b5293d500e8d4384176604d61a185a80e19986` |
| `sfx/sfx_neutral_dragonlark_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_dragonlark_attack_swing.m4a` | `301beb833a9a1ece9970453668de695a93689ed4d9bdbf0595d614cde02368de` |
| `sfx/sfx_neutral_dragonlark_death.m4a` | `app/resources/sfx/sfx_neutral_dragonlark_death.m4a` | `b775724619d8e46842ea14343ba3910a340aad40a14b05d1e95d0ad0021d7643` |
| `sfx/sfx_neutral_dragonlark_hit.m4a` | `app/resources/sfx/sfx_neutral_dragonlark_hit.m4a` | `9a84d7ac933038bf1cb9e7fe53386ce8a1cf654101c6c896189d8263405d7c3a` |
| `sfx/sfx_neutral_earthwalker_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_earthwalker_attack_impact.m4a` | `64e12ec64492c6c028f6b1c5f214e3e037a389f0acc71aebfe01d6758856f484` |
| `sfx/sfx_neutral_earthwalker_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_earthwalker_attack_swing.m4a` | `63cb14072f31ce635991969b3347eac86e19710fab28cac5c46605df74bda38a` |
| `sfx/sfx_neutral_earthwalker_death.m4a` | `app/resources/sfx/sfx_neutral_earthwalker_death.m4a` | `9f13866b30f9bc2787657a14d67e55b47d15e17b6215956b00aad5248bb0ac4b` |
| `sfx/sfx_neutral_earthwalker_hit.m4a` | `app/resources/sfx/sfx_neutral_earthwalker_hit.m4a` | `06eff82fac8cd430c4de0bcd287c769398b0260742e27f22430c586890b02960` |
| `sfx/sfx_neutral_emeraldrejuvenator_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_emeraldrejuvenator_attack_swing.m4a` | `417b79ad509c1ef2f8e914030e66f06eaf4bb9de1114ede97f28d60356ffb091` |
| `sfx/sfx_neutral_emeraldrejuvenator_death.m4a` | `app/resources/sfx/sfx_neutral_emeraldrejuvenator_death.m4a` | `8647b21991ab725519f1af5fb78578f4e9b3ea7fd6cfcf703cb9d42e8c5a68b8` |
| `sfx/sfx_neutral_firespitter_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_firespitter_attack_impact.m4a` | `e9a08d382d5cf112f60373e4c41877e4846a94234fde004ad6e9566828566b84` |
| `sfx/sfx_neutral_firespitter_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_firespitter_attack_swing.m4a` | `ad23ca732f78a460560c180305a90299462cb434acb9f8dc1ef3dcce71b4139e` |
| `sfx/sfx_neutral_firespitter_death.m4a` | `app/resources/sfx/sfx_neutral_firespitter_death.m4a` | `146bb95985864ccf3f3f03dcb998e4d3e1750095022a831a2beb2a9b500fe663` |
| `sfx/sfx_neutral_firespitter_hit.m4a` | `app/resources/sfx/sfx_neutral_firespitter_hit.m4a` | `e3605c4bd457b4256e6f9518052e57380bb49021cca731191e50f67a776320dd` |
| `sfx/sfx_neutral_firestarter_death.m4a` | `app/resources/sfx/sfx_neutral_firestarter_death.m4a` | `2b92c2ccd725ac8234b34867a663e69bbbaa34415f2fc8396c3380baeba0b6a1` |
| `sfx/sfx_neutral_gambitgirl_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_gambitgirl_attack_impact.m4a` | `7a1c02467c95f10d290737623a040c45a97331989fd0f79e25d04c4c7df01d71` |
| `sfx/sfx_neutral_gambitgirl_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_gambitgirl_attack_swing.m4a` | `c3daf80f6f6d7d43ea544354af7b0816e9d809e8e20d250c983ba347d61f2fab` |
| `sfx/sfx_neutral_gambitgirl_death.m4a` | `app/resources/sfx/sfx_neutral_gambitgirl_death.m4a` | `61a5443fcb1c6aa04dff2209219440cd39f3f11a2e887e004c395c220cb9791e` |
| `sfx/sfx_neutral_gambitgirl_hit.m4a` | `app/resources/sfx/sfx_neutral_gambitgirl_hit.m4a` | `df6085c11117e93e3cd771376593208da517bff331ec63d8f9c1cb3ea2359a3f` |
| `sfx/sfx_neutral_golembloodshard_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_golembloodshard_attack_impact.m4a` | `6bba1d18c8a4b032dda62a1e899fff37034211c66ea69c7c5282c5b996b493f2` |
| `sfx/sfx_neutral_golembloodshard_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_golembloodshard_attack_swing.m4a` | `fa9ace104806784c40801ca088a6bf1d9cb565d242a7a8f90e0b6777e4ef3312` |
| `sfx/sfx_neutral_golembloodshard_death.m4a` | `app/resources/sfx/sfx_neutral_golembloodshard_death.m4a` | `593224a30fbede122491e40240ef046b9b1086114a0ffb53faa3b1468951e91a` |
| `sfx/sfx_neutral_golembloodshard_hit.m4a` | `app/resources/sfx/sfx_neutral_golembloodshard_hit.m4a` | `c9068ab4e2fc2e84f9686df155c1fd6c9155140e17bb69c490cc4265a7811413` |
| `sfx/sfx_neutral_grimrock_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_grimrock_attack_impact.m4a` | `5c71ae5131e6a62e9073388d5c1cbb82b4c65da2486235e4a51e021b730e06a2` |
| `sfx/sfx_neutral_grimrock_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_grimrock_attack_swing.m4a` | `5fd2fefa7b2593d0c6dc02177cc87df4847a37ded829c6a3fd78d686234579fa` |
| `sfx/sfx_neutral_grimrock_death.m4a` | `app/resources/sfx/sfx_neutral_grimrock_death.m4a` | `e62cf2af5b62af3808969551d2d68f6a3d225910fa59e4c2084330c81c1050ca` |
| `sfx/sfx_neutral_grimrock_hit.m4a` | `app/resources/sfx/sfx_neutral_grimrock_hit.m4a` | `2b338d97045cc6def57d5d43a7eac50952acff5f3bbed4463fe126c500a467b3` |
| `sfx/sfx_neutral_hailstonehowler_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_hailstonehowler_attack_swing.m4a` | `17bc4241ea045154a71d4ee1f5c90887bf123bc14e993de90c8f0e12e5a25249` |
| `sfx/sfx_neutral_hailstonehowler_death.m4a` | `app/resources/sfx/sfx_neutral_hailstonehowler_death.m4a` | `258b4f38da2ee7c5446425ea9ff8943d17592f32768d14e6d96e63596039eeda` |
| `sfx/sfx_neutral_hailstonehowler_hit.m4a` | `app/resources/sfx/sfx_neutral_hailstonehowler_hit.m4a` | `f4e1911df54a48b408d6833d66a930a163d91d84d41f12c992c6890811e09a74` |
| `sfx/sfx_neutral_hailstonehowler_impact.m4a` | `app/resources/sfx/sfx_neutral_hailstonehowler_impact.m4a` | `4b319d3a8a6b7e10af99a1342e40efe30a3c9213e08ef7d2e381afd46d2e3ac6` |
| `sfx/sfx_neutral_jaxtruesight_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_jaxtruesight_attack_impact.m4a` | `ae1f2f0379b842f9855ab5e67d1f2f1601504377fcd421b6c5343a36ba3fb071` |
| `sfx/sfx_neutral_jaxtruesight_death.m4a` | `app/resources/sfx/sfx_neutral_jaxtruesight_death.m4a` | `612692d9e1f8f3730e2b38d2db33699662493c379d588b28c3b631e60c8fd99c` |
| `sfx/sfx_neutral_keeperofthevale_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_keeperofthevale_attack_swing.m4a` | `9bbdb687584a54ffe6cf70ea2aa13bdfdda6fbbb623a9de16de6ebca3d6603b8` |
| `sfx/sfx_neutral_keeperofthevale_hit.m4a` | `app/resources/sfx/sfx_neutral_keeperofthevale_hit.m4a` | `f64142371fe7cec8cfa8d304eaa6c2d311c53e3aba494b56b2a1a6c5f1273cf8` |
| `sfx/sfx_neutral_keeperofthevale_impact.m4a` | `app/resources/sfx/sfx_neutral_keeperofthevale_impact.m4a` | `eac7843064d47b8e5769ac56d98ee5127dc99870bed966a7c3d666351b54f88b` |
| `sfx/sfx_neutral_komodocharger_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_komodocharger_attack_impact.m4a` | `847a62949ab4677935ca55cfbdaba846703e784a6578c8845d0145be2dcd282c` |
| `sfx/sfx_neutral_komodocharger_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_komodocharger_attack_swing.m4a` | `00299e878cd30c91d681923f10c9e026095b42481e0e4d8e6fd07b6404bebb9b` |
| `sfx/sfx_neutral_komodocharger_death.m4a` | `app/resources/sfx/sfx_neutral_komodocharger_death.m4a` | `151030d1aa91e9d688722d16faf41be599e018248d2247aa7a2b78654cdb0bab` |
| `sfx/sfx_neutral_komodocharger_hit.m4a` | `app/resources/sfx/sfx_neutral_komodocharger_hit.m4a` | `9e7dc99d0aba5b57fb09dd9d67b24633dda2fe03e2c6eacad813f5edb045f306` |
| `sfx/sfx_neutral_ladylocke_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_ladylocke_attack_impact.m4a` | `8922106166710213553c9fbc623b3e41cb54fd13433692ae15600f086e7a59e4` |
| `sfx/sfx_neutral_luxignis_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_luxignis_attack_impact.m4a` | `8ca0c2fe5e75850e708c31926e74fc02caa10b0de953118ddee8d42e47799c87` |
| `sfx/sfx_neutral_luxignis_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_luxignis_attack_swing.m4a` | `9579037cf7bbd4a0da15444fe4e490f4d21a2fba6d766f0b0838b55e17dffdf9` |
| `sfx/sfx_neutral_luxignis_death.m4a` | `app/resources/sfx/sfx_neutral_luxignis_death.m4a` | `6d6cc7f5d3e99451eeb1ac89bb51065a5314fc96b767f8cac4e2327bc3246695` |
| `sfx/sfx_neutral_luxignis_hit.m4a` | `app/resources/sfx/sfx_neutral_luxignis_hit.m4a` | `fe05345c12941a24b23a88a011226cf46c51f161517c203bedf518dd25594f9d` |
| `sfx/sfx_neutral_makantorwarbeast_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_makantorwarbeast_attack_impact.m4a` | `8a1c8105cb5fec4e7d2e1323a3e940e5ae68d68bc1d0b26927c77b6bf194d2e5` |
| `sfx/sfx_neutral_makantorwarbeast_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_makantorwarbeast_attack_swing.m4a` | `df587c61c4cca530ea7cd97b96d598dbaf682af681064c83b1874f61979908bf` |
| `sfx/sfx_neutral_makantorwarbeast_death.m4a` | `app/resources/sfx/sfx_neutral_makantorwarbeast_death.m4a` | `099ad980edd84d0ba0e8f502193f3ba916c7aee3621702a23a97a10fb4706c96` |
| `sfx/sfx_neutral_makantorwarbeast_hit.m4a` | `app/resources/sfx/sfx_neutral_makantorwarbeast_hit.m4a` | `68d8f30285639fdcd4d472a8c6c9501dd02d656a8d2a107a5fcc289ca7cc80b4` |
| `sfx/sfx_neutral_mirkblooddevourer_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_mirkblooddevourer_attack_impact.m4a` | `af096a4316323e4f549bc4d69f4cce540fd6ea470cce99ba25e8739369f306f8` |
| `sfx/sfx_neutral_mirkblooddevourer_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_mirkblooddevourer_attack_swing.m4a` | `bfa662602bb82daa68a104a063ece01e3710caa5c84c7098b99f8b255afbad59` |
| `sfx/sfx_neutral_mirkblooddevourer_death.m4a` | `app/resources/sfx/sfx_neutral_mirkblooddevourer_death.m4a` | `4303ab7e4a03c6403beca600a7ee1b02310aafd8792a92a30f5faf46918f685c` |
| `sfx/sfx_neutral_mirkblooddevourer_hit.m4a` | `app/resources/sfx/sfx_neutral_mirkblooddevourer_hit.m4a` | `f67866024e1ba2cc22027ffe12be12eb03212b1b93f4776ec5edb5327271747c` |
| `sfx/sfx_neutral_monsterdreamoracle_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_monsterdreamoracle_attack_impact.m4a` | `8429dcb62c77ae9f3e0b240c94a571be3fc4ed56fc3bb224acc71ba1f11b973a` |
| `sfx/sfx_neutral_monsterdreamoracle_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_monsterdreamoracle_attack_swing.m4a` | `991341cf00e902c461d1cce41598094912683256d53491b4c2788427bf431bc5` |
| `sfx/sfx_neutral_monsterdreamoracle_death.m4a` | `app/resources/sfx/sfx_neutral_monsterdreamoracle_death.m4a` | `376bdad5b427898b8f4105d7df59cb848da5cf951f4e0de11a383a6038107f75` |
| `sfx/sfx_neutral_monsterdreamoracle_hit.m4a` | `app/resources/sfx/sfx_neutral_monsterdreamoracle_hit.m4a` | `4dec3c2e01b3f6c59af9ccf60c2d4a64c020aa9388d31dc6fd79b59374f77695` |
| `sfx/sfx_neutral_pandora_death.m4a` | `app/resources/sfx/sfx_neutral_pandora_death.m4a` | `0afc037339bc001169a1f4477c2391e3e0a324ad7bfdf16c1ee46d007cfae51e` |
| `sfx/sfx_neutral_primordialgazer_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_primordialgazer_attack_impact.m4a` | `c2d71ee6802cfda12ad81f1d227213bbbd3506819865d9932ed0ee78b250bcda` |
| `sfx/sfx_neutral_primordialgazer_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_primordialgazer_attack_swing.m4a` | `6668b6f6bdbd432083b55f48cde0a8d12da419ff9a7347364af776850f448975` |
| `sfx/sfx_neutral_primordialgazer_death.m4a` | `app/resources/sfx/sfx_neutral_primordialgazer_death.m4a` | `090b6a5533446f96812c7eba902cec086d6be86207026deb061602f04401063f` |
| `sfx/sfx_neutral_primordialgazer_hit.m4a` | `app/resources/sfx/sfx_neutral_primordialgazer_hit.m4a` | `639a4409d51a2f87c6bb84034b32a671a488c733ea7774d4acc1ce29cca42e6f` |
| `sfx/sfx_neutral_prophetofthewhite_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_prophetofthewhite_attack_swing.m4a` | `bb9b31049d7d7023118626fa38c5d67199cdc2f51cdda341adaad939f216ca6d` |
| `sfx/sfx_neutral_redsynja_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_redsynja_attack_impact.m4a` | `4fbf9a6bced596410bff6e4ed1bf3b3415509b172b01ce5e85b0fead0fb57683` |
| `sfx/sfx_neutral_redsynja_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_redsynja_attack_swing.m4a` | `b6211ca1cc44a5bb92884dca9d93d4a972f9c6a9a3c05dfa41346fabd58f0f8a` |
| `sfx/sfx_neutral_redsynja_hit.m4a` | `app/resources/sfx/sfx_neutral_redsynja_hit.m4a` | `2e8946682bff1daf0e310536c35ee1c95a9652b1e061f938295be8d8e215ba52` |
| `sfx/sfx_neutral_repulsionbeast_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_repulsionbeast_attack_swing.m4a` | `a860f6acc4012360cd2b5ea9949cbf46f7e3caafd4141664db080818f4f84ba1` |
| `sfx/sfx_neutral_repulsionbeast_death.m4a` | `app/resources/sfx/sfx_neutral_repulsionbeast_death.m4a` | `d7fd80bc34782504c3e5cdb0a4fdd080e144655b941a7d244e676c12da293dad` |
| `sfx/sfx_neutral_repulsionbeast_hit.m4a` | `app/resources/sfx/sfx_neutral_repulsionbeast_hit.m4a` | `f122c17e094a5f49b7f53c861765c029235cc530cae4cb182859d8e81e1cf464` |
| `sfx/sfx_neutral_repulsionbeast_impact.m4a` | `app/resources/sfx/sfx_neutral_repulsionbeast_impact.m4a` | `7433e3b1b6436fac2a694ef72de98f115d0f70ca84770df832e2ad014c7298af` |
| `sfx/sfx_neutral_rockpulverizer_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_rockpulverizer_attack_impact.m4a` | `18349d33dd534d309c3e6941fe79028fea9aecd5787c02ae22c4f660dae06cd2` |
| `sfx/sfx_neutral_rockpulverizer_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_rockpulverizer_attack_swing.m4a` | `4f88e0197170bb9d7d22641a1175749c4d143574e0825d925274da3e56680bdc` |
| `sfx/sfx_neutral_rockpulverizer_death.m4a` | `app/resources/sfx/sfx_neutral_rockpulverizer_death.m4a` | `403fe311fb23e4822fade2155afddea0573ad2634f715a88ac52221e7a93a376` |
| `sfx/sfx_neutral_rockpulverizer_hit.m4a` | `app/resources/sfx/sfx_neutral_rockpulverizer_hit.m4a` | `a7b0121e6a8a520bffdef1e3ccc443c80e12868354a2df9cf2a1e6d77a343c3d` |
| `sfx/sfx_neutral_sai_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_sai_attack_impact.m4a` | `8ab9f5eb69b15781f31bbc1e5db6dd43fc460b6977ad75e691bd1e98879b13f6` |
| `sfx/sfx_neutral_serpenti_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_serpenti_attack_impact.m4a` | `94c1cbac398596b7efa0043068ac33d32c16a3634911040cbb529ea823b3fa3a` |
| `sfx/sfx_neutral_serpenti_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_serpenti_attack_swing.m4a` | `96c15af37a6b36f4ad52796b0fdc7b8a3b238663927c70ea09e62e0a2701953d` |
| `sfx/sfx_neutral_serpenti_death.m4a` | `app/resources/sfx/sfx_neutral_serpenti_death.m4a` | `80b0436b7f94b308873526f332ed00fcee0ac7262c33fcfae70a32968fb37620` |
| `sfx/sfx_neutral_serpenti_hit.m4a` | `app/resources/sfx/sfx_neutral_serpenti_hit.m4a` | `50a7421dde1c5d8359e7a36489c6f90159c2833d44ab2ce1db742acdc103cd50` |
| `sfx/sfx_neutral_shieldoracle_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_shieldoracle_attack_impact.m4a` | `d1498387e6613e204f5ff75d80e4e8cefbafd25a66fdeb777cec4d61211a9b47` |
| `sfx/sfx_neutral_shieldoracle_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_shieldoracle_attack_swing.m4a` | `2ae641e09b8ccd7bd7f5d940c62b220c2336744a0fc1825cef3c69e4a0de1aa1` |
| `sfx/sfx_neutral_shieldoracle_death.m4a` | `app/resources/sfx/sfx_neutral_shieldoracle_death.m4a` | `c1438aff037ec2954eb63dbea77040d4682e19431a875aa0383f05723717d5fc` |
| `sfx/sfx_neutral_shieldoracle_hit.m4a` | `app/resources/sfx/sfx_neutral_shieldoracle_hit.m4a` | `77fdce211ba118e7f3ae7de0aafb06f4dfcb8fba5f38c18200961368a9402e69` |
| `sfx/sfx_neutral_silitharveteran_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_silitharveteran_attack_impact.m4a` | `d8a956a31c22d453685d82192e82a2dea336c56bd0cb9cb6cbaac4fb1b3c9562` |
| `sfx/sfx_neutral_silitharveteran_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_silitharveteran_attack_swing.m4a` | `8ce424fdaf429506035f58ec84d795051dffd0096ddd8b809df59888ddab955a` |
| `sfx/sfx_neutral_silitharveteran_death.m4a` | `app/resources/sfx/sfx_neutral_silitharveteran_death.m4a` | `7f8de0cd031223d39c1cd319736596a33b3100451657ec3b8297afb9732bbcbe` |
| `sfx/sfx_neutral_silitharveteran_hit.m4a` | `app/resources/sfx/sfx_neutral_silitharveteran_hit.m4a` | `0236c14bd8fad55fb18daacdf56f1a20c4ac60a9cd9a6a1e999d4223cbf0e732` |
| `sfx/sfx_neutral_spelljammer_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_spelljammer_attack_impact.m4a` | `c42563c883571254d625e37092df6ba894a1b79118b527f4715a716836455401` |
| `sfx/sfx_neutral_spelljammer_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_spelljammer_attack_swing.m4a` | `97617a75740fab09e001b36f45d2f5669fb01671440eee9369cc9b93d57d1087` |
| `sfx/sfx_neutral_spelljammer_death.m4a` | `app/resources/sfx/sfx_neutral_spelljammer_death.m4a` | `c1e9040508c6c6d717303c19e162064a87654381485aebc34cc5fde656fcf56f` |
| `sfx/sfx_neutral_spelljammer_hit.m4a` | `app/resources/sfx/sfx_neutral_spelljammer_hit.m4a` | `f14ad2152aecd4772d891e56f8d9c383f857a25a3360b77b35b66e529a5ab51a` |
| `sfx/sfx_neutral_spiritscribe_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_spiritscribe_attack_swing.m4a` | `c9f94dd6ef78227a4cd5f8b205d201181d40a621ad7e791cd08ed249b498d216` |
| `sfx/sfx_neutral_stormatha_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_stormatha_attack_impact.m4a` | `e46d5cc8f4bd8d5c359752bee4a097616f5a8066ce701a60268b3714abfa5f67` |
| `sfx/sfx_neutral_stormatha_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_stormatha_attack_swing.m4a` | `0440bbdea9ed3156a9354d7477ccade05234f0d7308d4aff9890f279dc11376e` |
| `sfx/sfx_neutral_stormmetalgolem_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_stormmetalgolem_attack_impact.m4a` | `138d253f451b72d0b210b4a4f69e4d215f9e18e2c4e6a12be45fc2a8269ce210` |
| `sfx/sfx_neutral_stormmetalgolem_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_stormmetalgolem_attack_swing.m4a` | `31c93f5caeebfeeaadfe28fa9f86e43311efa8ce9723a3ccd51902c5aafa3828` |
| `sfx/sfx_neutral_stormmetalgolem_death.m4a` | `app/resources/sfx/sfx_neutral_stormmetalgolem_death.m4a` | `eb9a63d88a828f15f80623bc940fc56733da85cae1a9c5616adcd04759d198b6` |
| `sfx/sfx_neutral_stormmetalgolem_hit.m4a` | `app/resources/sfx/sfx_neutral_stormmetalgolem_hit.m4a` | `8516c0efe4ef9428befe0d4f226325bf3fde2bf0599a58921de0972033ddb892` |
| `sfx/sfx_neutral_sunelemental_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_sunelemental_attack_swing.m4a` | `d19ed38387717016004be3526fb4f0e2812b34d532d8b371753a822c5ed107ab` |
| `sfx/sfx_neutral_sunelemental_hit.m4a` | `app/resources/sfx/sfx_neutral_sunelemental_hit.m4a` | `0eaa44622c21fe87451f38c0787c44c588c9dd3e0d1d6e4e2bd948752e15e4e9` |
| `sfx/sfx_neutral_sunelemental_impact.m4a` | `app/resources/sfx/sfx_neutral_sunelemental_impact.m4a` | `b7c9bc68c664f22468344947e3e39ffd5bf4ad88678df109a0c63bce60b50d21` |
| `sfx/sfx_neutral_sunseer_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_sunseer_attack_impact.m4a` | `2f3ca1f6be5bba6739ddd11838c2eeed9ca98a911a94da24ab08a0bfb70fb1c7` |
| `sfx/sfx_neutral_sunseer_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_sunseer_attack_swing.m4a` | `78c4cd5e185c44a102efd0f6fee5e44e71c42d13f013da3b50035b2e53145d53` |
| `sfx/sfx_neutral_sunseer_death.m4a` | `app/resources/sfx/sfx_neutral_sunseer_death.m4a` | `b6110f3d7113f2ef7c3d8fdf30ae918119aa8ac3d8cf5f3c8534b53482c1e6f7` |
| `sfx/sfx_neutral_sunseer_hit.m4a` | `app/resources/sfx/sfx_neutral_sunseer_hit.m4a` | `914a7a6694dbd94fe64ae4a4b0702c0a1e00ff80fc95935cf54d477af1e446d9` |
| `sfx/sfx_neutral_swornavenger_death.m4a` | `app/resources/sfx/sfx_neutral_swornavenger_death.m4a` | `3eb29ed8273a0ca477ce1fa5b4e929ae0958441a7a825a0c6d66980e2f5704b4` |
| `sfx/sfx_neutral_valehunter_attack_impact.m4a` | `app/resources/sfx/sfx_neutral_valehunter_attack_impact.m4a` | `02312717b7663f12181b44f6d852771fea2f2486b6d172b2894f25145733c8f4` |
| `sfx/sfx_neutral_valehunter_attack_swing.m4a` | `app/resources/sfx/sfx_neutral_valehunter_attack_swing.m4a` | `6ecdffc329571da8ddc12af70c93b235bd863427965d5e917f72ab6db3c2c8fa` |
| `sfx/sfx_neutral_valehunter_death.m4a` | `app/resources/sfx/sfx_neutral_valehunter_death.m4a` | `adff7c6db30f6ed519f6d413949bae4036794df39586307ca8c5748dcccc92d0` |
| `sfx/sfx_neutral_valehunter_hit.m4a` | `app/resources/sfx/sfx_neutral_valehunter_hit.m4a` | `d1aa949140cf8ea4a8797738e271ff42107cca7c7b1e6ad2370b2a75fbb7f927` |
| `sfx/sfx_neutral_yun_death.m4a` | `app/resources/sfx/sfx_neutral_yun_death.m4a` | `c87e3b892c774b8a646879cb011825b5e06792d82a66dfc4fae56517778dd3a2` |
| `sfx/sfx_screenshake.m4a` | `app/resources/sfx/sfx_screenshake.m4a` | `5eddee74ae9de883e7d85b7536a774805b173d525af25831c151361d0b6e19c4` |
| `sfx/sfx_spell_amplification.m4a` | `app/resources/sfx/sfx_spell_amplification.m4a` | `9384b7f7ef09b8819d16fc1aabe7d2f381573a1b2c5e8d1165631093c2dd471a` |
| `sfx/sfx_spell_blaststarfire.m4a` | `app/resources/sfx/sfx_spell_blaststarfire.m4a` | `285a1a77867895a90d97b87297ae9a364d5ba1ac0fce43ed55a6917489cb93d9` |
| `sfx/sfx_spell_blindscorch.m4a` | `app/resources/sfx/sfx_spell_blindscorch.m4a` | `0520b70de21131a6eec3ab844d29fb034d84b54d89a0d8934db8328c330cc6b8` |
| `sfx/sfx_spell_boneswarm.m4a` | `app/resources/sfx/sfx_spell_boneswarm.m4a` | `e30f4b7b3d45d5d3600f110d4fd7dc5da24d8d5ba9c04c2f598182c9e22fafaf` |
| `sfx/sfx_spell_cosmicflesh.m4a` | `app/resources/sfx/sfx_spell_cosmicflesh.m4a` | `91ed1a18416f4a990c2143d599e065338910d6aa1936a1362bbdfd7fa0eb4333` |
| `sfx/sfx_spell_daemoniclure.m4a` | `app/resources/sfx/sfx_spell_daemoniclure.m4a` | `ce5fe412e31eaacbbc8151911ebccc4573ccc0884e02fbd28a81ce5b7496490b` |
| `sfx/sfx_spell_darktransformation.m4a` | `app/resources/sfx/sfx_spell_darktransformation.m4a` | `69358d44d61306b831ccc0476fb5f28291e55aaa634a813d073f0cac4863a928` |
| `sfx/sfx_spell_deathfirecrescendo.m4a` | `app/resources/sfx/sfx_spell_deathfirecrescendo.m4a` | `b7d00e25ea38ad5b5c9eb58922fe1041d5b18d25a02e026aeaa8da688f24d1cc` |
| `sfx/sfx_spell_deathstrikeseal.m4a` | `app/resources/sfx/sfx_spell_deathstrikeseal.m4a` | `ea64db90cc036689fb76ad145dd6cddc226da88fa6441df2d2496ab1bac616da` |
| `sfx/sfx_spell_diretidefrenzy.m4a` | `app/resources/sfx/sfx_spell_diretidefrenzy.m4a` | `6d7217f58de7ffd9bae204ab42cc28eac4fab012d6a7b76827e192fbe29a03ac` |
| `sfx/sfx_spell_divineblood.m4a` | `app/resources/sfx/sfx_spell_divineblood.m4a` | `fc7d853224b6a818d79e0feb50b22b36a408db762d826d19073aa56e154aab12` |
| `sfx/sfx_spell_entropicdecay.m4a` | `app/resources/sfx/sfx_spell_entropicdecay.m4a` | `c19ac4da515b9279760ccd569a66bd742e0421e478eb15da6d0d688d607506ed` |
| `sfx/sfx_spell_flashreincarnation.m4a` | `app/resources/sfx/sfx_spell_flashreincarnation.m4a` | `3fba014b73237368ba71cde2f476ae88c25d2fb1005697e6c2ec5f0dc1d644b6` |
| `sfx/sfx_spell_fractalreplication.m4a` | `app/resources/sfx/sfx_spell_fractalreplication.m4a` | `d734020a0f299dafe820bf52f2b718a1d664dcc6452d4d2cd4905d4e07a3dadf` |
| `sfx/sfx_spell_ghostlightning.m4a` | `app/resources/sfx/sfx_spell_ghostlightning.m4a` | `97668b8a5bc7a219fec9e0e35f8494f90ee246c72f088a26fbdb5a2c1c00ca98` |
| `sfx/sfx_spell_heavenstrike.m4a` | `app/resources/sfx/sfx_spell_heavenstrike.m4a` | `223884b7b159ee40a858a015842655dd6d6191bc6be87e81bc50b82af25909f3` |
| `sfx/sfx_spell_icepillar.m4a` | `app/resources/sfx/sfx_spell_icepillar.m4a` | `7a80165b5c607ec683a0ad250814fd254439ed1c4a6259f47b701c578cfaa149` |
| `sfx/sfx_spell_immolation_a.m4a` | `app/resources/sfx/sfx_spell_immolation_a.m4a` | `51c28a336543fa95b77bf4de8f6a79efd46d670f362a0ff1360270299c9a5cc9` |
| `sfx/sfx_spell_immolation_b.m4a` | `app/resources/sfx/sfx_spell_immolation_b.m4a` | `7dcca5c8faae65ce1025e31b6d98b800077284b640e4d837e0ffeb55bf51bf8d` |
| `sfx/sfx_spell_innerfocus.m4a` | `app/resources/sfx/sfx_spell_innerfocus.m4a` | `31d6828bfb6893127b25f5d58720c5cd699a1e17d9186a5a0cfb2b57934864ce` |
| `sfx/sfx_spell_lastingjudgement.m4a` | `app/resources/sfx/sfx_spell_lastingjudgement.m4a` | `35363936fdee2e2aa34d6aeb26c621e9a7ac4ff187287feea3e373c5f0b3cbaa` |
| `sfx/sfx_spell_lionheartblessing.m4a` | `app/resources/sfx/sfx_spell_lionheartblessing.m4a` | `7ce2a3627945c2bec0d0135ce3a61cca6ec78bb7835e90d1268457fa3b6d6243` |
| `sfx/sfx_spell_manaburn.m4a` | `app/resources/sfx/sfx_spell_manaburn.m4a` | `10e829e1de701378a40e08570f28f5bd95a0036ca3aef8dd071bc3d88b5dced3` |
| `sfx/sfx_spell_manavortex.m4a` | `app/resources/sfx/sfx_spell_manavortex.m4a` | `d96c9f3ff7fea8b697dcf4a1049d9057d8ad94d62c78a96f9642da00170a26c0` |
| `sfx/sfx_spell_martyrdom.m4a` | `app/resources/sfx/sfx_spell_martyrdom.m4a` | `7f894b10dfe8113d53ddba9436a1ec603f30c683b3463bc576ca11a4b8069c86` |
| `sfx/sfx_spell_mistdragonseal.m4a` | `app/resources/sfx/sfx_spell_mistdragonseal.m4a` | `9af360f7f8493b99047c3b085b9e41c49a55d83965bf4c8701f0bcf3f68a9359` |
| `sfx/sfx_spell_naturalselection.m4a` | `app/resources/sfx/sfx_spell_naturalselection.m4a` | `2338a76dc9da81b433fe0b8e11ce8add245a9ae5e31f790c8386d85966cdab8f` |
| `sfx/sfx_spell_onyxbearseal.m4a` | `app/resources/sfx/sfx_spell_onyxbearseal.m4a` | `cc7a816bd91d6aba0799b5d154e7c958343e5976e6458eb7c76a7571da935791` |
| `sfx/sfx_spell_phoenixfire.m4a` | `app/resources/sfx/sfx_spell_phoenixfire.m4a` | `dcf3843e9dd2dab71fc1d49dc64c19ba63bbebd1141fa25b64322c7326448f6a` |
| `sfx/sfx_spell_scionsfirstwish.m4a` | `app/resources/sfx/sfx_spell_scionsfirstwish.m4a` | `b21107719d96da5890d234f8c6ef2e19219a86399b4177836daba91047611d24` |
| `sfx/sfx_spell_shadownova.m4a` | `app/resources/sfx/sfx_spell_shadownova.m4a` | `8b618e9549373ba45c7f0f2cdf9d23a02c70347003d570d9543cd771e0a66ef0` |
| `sfx/sfx_spell_sunbloom.m4a` | `app/resources/sfx/sfx_spell_sunbloom.m4a` | `f5881e552029b87938672fda23fd5982678fedbcb34b796ec22f006ddfca5529` |
| `sfx/sfx_spell_tranquility.m4a` | `app/resources/sfx/sfx_spell_tranquility.m4a` | `8163d51528e52aee66bfc1c3b3326e35bffed9d81899fcc86527c567f874d8db` |
| `sfx/sfx_spell_truestrike.m4a` | `app/resources/sfx/sfx_spell_truestrike.m4a` | `aebc3504278be8fb20e5ac44c0d0bb0804f9916185b1dd5de9a0ddb371dca1dd` |
| `sfx/sfx_spell_twinstrike.m4a` | `app/resources/sfx/sfx_spell_twinstrike.m4a` | `423c781610f98570c15ff52b21960bc7dc7add8767e788681b1079db18ddaa8b` |
| `sfx/sfx_spell_voidpulse.m4a` | `app/resources/sfx/sfx_spell_voidpulse.m4a` | `cefb701b26837c005f1454bc7845867ec8b5535bd62e7582b11193e9b229e9e3` |
| `sfx/sfx_spell_voidpulse02.m4a` | `app/resources/sfx/sfx_spell_voidpulse02.m4a` | `4741a2d61b966361f9dbc82f64778943a76c022cafabc919cbf67f6f7ca72cb4` |
| `sfx/sfx_summonlegendary.m4a` | `app/resources/sfx/sfx_summonlegendary.m4a` | `230c98512c5c27f68327eea2d249f29fb9e76e2cf1df7a3cacbc62173bf14865` |
| `sfx/sfx_ui_booster_packexplode.m4a` | `app/resources/sfx/sfx_ui_booster_packexplode.m4a` | `838225f6d5c9eb424b718d08ff8d406873bfe2a35fa8609f6c13d5733d77e76c` |
| `sfx/sfx_unit_deploy_1.m4a` | `app/resources/sfx/sfx_unit_deploy_1.m4a` | `e1468a2b101eb48210c77c252a51314d58c7c9ccd875e77edfbd90699566c380` |
| `sfx/sfx_unit_deploy_2.m4a` | `app/resources/sfx/sfx_unit_deploy_2.m4a` | `68c9a0fd4b9596e4238d7bd4ef2c443257bee86784adc2213131f721551d6690` |
| `sfx/sfx_unit_deploy_3.m4a` | `app/resources/sfx/sfx_unit_deploy_3.m4a` | `0167918d189d83186043769112bd7e51b28336fb8e8f37600833ee8784e763f0` |
| `sfx/sfx_unit_deploy.m4a` | `app/resources/sfx/sfx_unit_deploy.m4a` | `0e544cc98c833b44b5cc9893c601a4f433ab4fc0dff7bd12aebbc1f5de346b54` |
| `sfx/sfx_unit_physical_4.m4a` | `app/resources/sfx/sfx_unit_physical_4.m4a` | `8c1ce32721302378b17d6c615f34f88ec86f9e94834e01e7816aa450e3874a64` |
| `sfx/sfx_unit_run_charge_4.m4a` | `app/resources/sfx/sfx_unit_run_charge_4.m4a` | `792cfb31ed0c28f77ba8ca13459bfe2ef098ffa87a1c7031dbc3211877721638` |
| `sfx/sfx_unit_run_magical_3.m4a` | `app/resources/sfx/sfx_unit_run_magical_3.m4a` | `9601247409ce5e3703ee3a368c9e008a80f4952f2d4e55c9d4bd78f425693735` |
| `sfx/sfx_unit_run_magical_4.m4a` | `app/resources/sfx/sfx_unit_run_magical_4.m4a` | `a74789a2e28cbbd12214b76213fec5c19a2af5328ca745a57d49b7d894998370` |
| `sfx/sfx_voidhunter_attack_impact.m4a` | `app/resources/sfx/sfx_voidhunter_attack_impact.m4a` | `8d94698549c895956697cd8b528381055480b201c7105849220447783791f443` |
| `sfx/sfx_voidhunter_attack_swing.m4a` | `app/resources/sfx/sfx_voidhunter_attack_swing.m4a` | `9d08ea8a9f60e07154d3f854aea273fee93995c6cd54e197291878969abd95cc` |
| `sfx/sfx_voidhunter_death.m4a` | `app/resources/sfx/sfx_voidhunter_death.m4a` | `514d8e815685548df57b34f2a7f45eff0463baae20bd4f165fa8356435ede4d9` |
| `sfx/sfx_voidhunter_hit.m4a` | `app/resources/sfx/sfx_voidhunter_hit.m4a` | `bf8d72d94a8de8cf5878e3c634b2f7b4d5eea86c16ff47ba1c4bab5de6dbc7f7` |
| `spells/generalspell_f1_roar.plist` | `app/resources/icons/generalspell_f1_roar.plist` | `b7ce4358f479528a71999c0eb92990bba905093c886dbf1cfc37e0b3750be23e` |
| `spells/generalspell_f1_roar.png` | `app/resources/icons/generalspell_f1_roar.png` | `008e220c1583cc3fe5c40c12f2bd045b2da6b1fd182f7460c51666cc97f3f1b1` |
| `spells/icon_f1_divinebond.plist` | `app/resources/icons/icon_f1_divinebond.plist` | `eb4a60169793fe5c98f3f8b10be4719176fa6eb12d525454b844e44beead1e4e` |
| `spells/icon_f1_divinebond.png` | `app/resources/icons/icon_f1_divinebond.png` | `a063dfae80b2a2f7e14c67557f260315258739e0b75f75c2ec59c753bb527106` |
| `spells/icon_f1_holyimmolation.plist` | `app/resources/icons/icon_f1_holyimmolation.plist` | `88b80d6cce925a82477970c3e7c96f669165fadf36b72c7f17c6dc72c16af2a4` |
| `spells/icon_f1_holyimmolation.png` | `app/resources/icons/icon_f1_holyimmolation.png` | `7ae7285a65dc8af3bc04029517eca09832066c626da3854ea7da370f3990f820` |
| `spells/icon_f1_martydom.plist` | `app/resources/icons/icon_f1_martydom.plist` | `b7000b0729f66e9bdb02f48916d23a16969572219bc78b47d87bf8ef0351073d` |
| `spells/icon_f1_martydom.png` | `app/resources/icons/icon_f1_martydom.png` | `ccc21b6033b8df52177ec5612ca2942e9be1914ce8a33bbf0f2f2fd65a331d22` |
| `spells/icon_f1_sunbloom.plist` | `app/resources/icons/icon_f1_sunbloom.plist` | `4d896c2c0350a5be4853b1b89c3c21f332111f094797ab77cf5d5ea58d5af249` |
| `spells/icon_f1_sunbloom.png` | `app/resources/icons/icon_f1_sunbloom.png` | `33b2e738d0d0fe1ee0d4a431108b877a54dc455e6a96bda4defd0fec1785a49f` |
| `spells/icon_f1_sundropelixir.plist` | `app/resources/icons/icon_f1_sundropelixir.plist` | `c3ee627fab7b49e6465d09956de7db148b4e2c1ba3b6d7ee4f74c9afeecb7531` |
| `spells/icon_f1_sundropelixir.png` | `app/resources/icons/icon_f1_sundropelixir.png` | `00d2ecd8de733cbc022baa5b16e601bf56877ad5e0374de2acea7539f1e6023d` |
| `spells/icon_f1_tempest.plist` | `app/resources/icons/icon_f1_tempest.plist` | `c7e6fff929ab36bd3014871a1db86849fafa210f4930e0a3cf656611786a521a` |
| `spells/icon_f1_tempest.png` | `app/resources/icons/icon_f1_tempest.png` | `a6f7e6ed5c0f831b6fbc31426213de7190d1ffdf5d7bf12086f7f74a70671091` |
| `spells/icon_f1_truestrike.plist` | `app/resources/icons/icon_f1_truestrike.plist` | `b851a28decfc2034050718a3f2b9e9a995ad379dd9ab3432dc69e7ae8a9b47d6` |
| `spells/icon_f1_truestrike.png` | `app/resources/icons/icon_f1_truestrike.png` | `751c6e0b0a735c29424e83026f1f1f60a04d4fa19ccecacbe804b12d04032390` |
| `spells/icon_f2_heavens_eclipse.plist` | `app/resources/icons/icon_f2_heavens_eclipse.plist` | `2822637e0f0086cb6e31f3938d827c7b02971a27b82a785d78ed8dde5a9ef283` |
| `spells/icon_f2_heavens_eclipse.png` | `app/resources/icons/icon_f2_heavens_eclipse.png` | `24071d53584a9b533ca8ca4341c606704c4443373d49e90e6c10272d51655827` |
| `spells/icon_f2_inner_focus.plist` | `app/resources/icons/icon_f2_inner_focus.plist` | `e3e7334b31543ad5d95ebd231dbef96accf0636abcd90336b24a2ec3197b29da` |
| `spells/icon_f2_inner_focus.png` | `app/resources/icons/icon_f2_inner_focus.png` | `c543d81c1e5defbffe1db7918b364a2b88953fd48d6693b553503bbac6b5a835` |
| `spells/icon_f2_juxtaposition.plist` | `app/resources/icons/icon_f2_juxtaposition.plist` | `92b8093eabb77380f7706030e4f9c98622e7d6acee467f0d949b8b87d5d54000` |
| `spells/icon_f2_juxtaposition.png` | `app/resources/icons/icon_f2_juxtaposition.png` | `1a2356214299c281326bf2c6e19fd353c238c32eba50c7de0f01a6f98334e9a3` |
| `spells/icon_f2_killingedge.plist` | `app/resources/icons/icon_f2_killingedge.plist` | `faad159e1094aeada5913cdb42a541913c289cfc58bf72fb10dc3e06247a19cc` |
| `spells/icon_f2_killingedge.png` | `app/resources/icons/icon_f2_killingedge.png` | `fbec3eb1caf84ae0728e643c985c2eab301e1512e0e19146fa96f28abc39c6f0` |
| `spells/icon_f2_mistdragonseal.plist` | `app/resources/icons/icon_f2_mistdragonseal.plist` | `427abe53d2d9fb97cd4e52a846aed09c58dc7250f771d8bf2f679e6f42241b93` |
| `spells/icon_f2_mistdragonseal.png` | `app/resources/icons/icon_f2_mistdragonseal.png` | `148b31dd66ed9380a15da3b5bbe13c2e473fa85708aa2f50dabcabd4f57c0ff3` |
| `spells/icon_f2_onyxbearseal.plist` | `app/resources/icons/icon_f2_onyxbearseal.plist` | `c9a3846817fdf18c1dd550f7d60d29b23ccc4bd743fde4ee7a47c56a9582edf2` |
| `spells/icon_f2_onyxbearseal.png` | `app/resources/icons/icon_f2_onyxbearseal.png` | `77c4af3432ee3b159c079919a88ae6b8053ab9bf35a5626c5ac74bd55e447367` |
| `spells/icon_f2_phoenixfire02.plist` | `app/resources/icons/icon_f2_phoenixfire02.plist` | `d0dd025b8ec8934be178f388a9c6c32ad7387166d22aba3e0f24d5a4fa2b46dc` |
| `spells/icon_f2_phoenixfire02.png` | `app/resources/icons/icon_f2_phoenixfire02.png` | `605c005caf2a80492ba6a1a8a9b6a08b348aca7170ad9f3d2c724d4676f90c92` |
| `spells/icon_f2_twin_strike.plist` | `app/resources/icons/icon_f2_twin_strike.plist` | `7d20a0c500dc1fd08be59fa6c2fa75b807976b2d275360c21b5b1be76a741735` |
| `spells/icon_f2_twin_strike.png` | `app/resources/icons/icon_f2_twin_strike.png` | `2604fda444637ac2d8e924c233e36a32b15b0bbe6376995332e791777ff9ee7b` |
| `spells/icon_f3_boneswarm.plist` | `app/resources/icons/icon_f3_boneswarm.plist` | `e9e0ea6d368ab28929ed5aa0549236b9115692a41e681cfe1b95325c6282dae7` |
| `spells/icon_f3_boneswarm.png` | `app/resources/icons/icon_f3_boneswarm.png` | `ecf97b17a0724aff1eff0c02593403cf6aaef2aae48f72b97e3380b21c427031` |
| `spells/icon_f3_cosmicflesh.plist` | `app/resources/icons/icon_f3_cosmicflesh.plist` | `2b2c8c817d83abc2d5e190c188b084b24af466ff5ea5289095faac9c7e3926ce` |
| `spells/icon_f3_cosmicflesh.png` | `app/resources/icons/icon_f3_cosmicflesh.png` | `b97f70c21de059941f43358cff46f2ba89874aea0ad5fb2423edd82ee4ec5ba6` |
| `spells/icon_f3_entropicdecay.plist` | `app/resources/icons/icon_f3_entropicdecay.plist` | `4c4ce32b4b740ef58c3a8c60599d5dbc5cde91598b000b58f17c0e4437ec3776` |
| `spells/icon_f3_entropicdecay.png` | `app/resources/icons/icon_f3_entropicdecay.png` | `96291b58ba0b78ebdc4656c866071979a5338c3ec4309f46c7e45aad3e0db1ff` |
| `spells/icon_f3_inneroasis.plist` | `app/resources/icons/icon_f3_inneroasis.plist` | `e4aefc11dda20db891be960560e61ce5b80f6b00d0da52403b69211bc8455f52` |
| `spells/icon_f3_inneroasis.png` | `app/resources/icons/icon_f3_inneroasis.png` | `4e302482aa37984a48af51cb7599fb3c059ad52c6c79ae48c250593f899d3e74` |
| `spells/icon_f3_scionsfirstwish.plist` | `app/resources/icons/icon_f3_scionsfirstwish.plist` | `f5ad1e990fc9db3c9f3b9475922aafc121181a05d2b799ea7c627205ef103dda` |
| `spells/icon_f3_scionsfirstwish.png` | `app/resources/icons/icon_f3_scionsfirstwish.png` | `0c5a8d52d4ac6d1f9a99c9444505e8d23afaad46b3553703e6f14ee38f919d83` |
| `spells/icon_f3_scionssecondwish.plist` | `app/resources/icons/icon_f3_scionssecondwish.plist` | `87923ccbc32e43afb08429ed602cef1163d11b2aec2ad082e455524ee539cb74` |
| `spells/icon_f3_scionssecondwish.png` | `app/resources/icons/icon_f3_scionssecondwish.png` | `dab30a6d75241319dc93466f7e645b7af51b8304c8b1f809638109f0b028f668` |
| `spells/icon_f3_scionsthirdwish.plist` | `app/resources/icons/icon_f3_scionsthirdwish.plist` | `0d8a38526c9f9151106764a2cf51c703aba786d959e6f7428227031872ff0cef` |
| `spells/icon_f3_scionsthirdwish.png` | `app/resources/icons/icon_f3_scionsthirdwish.png` | `c962bbfacf9bb1d54781e3adcfcb75a203b722a041389c37571c3c5b549a9f9d` |
| `spells/icon_f3_syphonenergy.plist` | `app/resources/icons/icon_f3_syphonenergy.plist` | `010bf980b50c568acbe7c1f9d877cbd05688cc473f277a74c110786e7e817fd4` |
| `spells/icon_f3_syphonenergy.png` | `app/resources/icons/icon_f3_syphonenergy.png` | `ceb453e49bb8709e36502f0d0e24a0ee963a821e45e1bdb216c1007cb161187f` |
| `spells/icon_f4_daemoniclure.plist` | `app/resources/icons/icon_f4_daemoniclure.plist` | `e4df1be8bc01e8f4b27df1563528587af020a3a48b7c6a5e7d4b5420e787eabb` |
| `spells/icon_f4_daemoniclure.png` | `app/resources/icons/icon_f4_daemoniclure.png` | `a5402610485d577313103e00522077906af0f8138ddcb09b0ec87baab5039249` |
| `spells/icon_f4_darktransformation.plist` | `app/resources/icons/icon_f4_darktransformation.plist` | `2bc3bac6d4b737ed45bc92094f7f15bce26c00fb8ed6b690d42065a66d0b5372` |
| `spells/icon_f4_darktransformation.png` | `app/resources/icons/icon_f4_darktransformation.png` | `2752d318b02b2278f573b5f3d9e6f4a925017e4d489b4751052f999376e664ea` |
| `spells/icon_f4_deathfirecrescendo.plist` | `app/resources/icons/icon_f4_deathfirecrescendo.plist` | `4371e95f95992059d3aaf374f68ba9432490cd8b2f36253884b56f0cf6decd2e` |
| `spells/icon_f4_deathfirecrescendo.png` | `app/resources/icons/icon_f4_deathfirecrescendo.png` | `171372878c6892394ecc67229c217445419d78d7f92086a000db6c69d1565c61` |
| `spells/icon_f4_riteoftheundervault.plist` | `app/resources/icons/icon_f4_riteoftheundervault.plist` | `e613beb41c9c87a4ace5429e14bd52a947f797f867db7d40d94039bc641df03d` |
| `spells/icon_f4_riteoftheundervault.png` | `app/resources/icons/icon_f4_riteoftheundervault.png` | `90f32c76e932c9253ab0928d682c84395f9b80a603bcfaa794a29b549d80ce91` |
| `spells/icon_f4_ritualbanishing.plist` | `app/resources/icons/icon_f4_ritualbanishing.plist` | `74da2fe6be2ad7609ec214945a2a39d0ae888ea0998a7ece7a3258d3813cff18` |
| `spells/icon_f4_ritualbanishing.png` | `app/resources/icons/icon_f4_ritualbanishing.png` | `2d795ca65f584ccbef13ad8d117cfc89b4acea8cf3e224551da61ceedae7f5d5` |
| `spells/icon_f4_shadownova.plist` | `app/resources/icons/icon_f4_shadownova.plist` | `fc41bed8a84df2f7e79c1841fb347355d02f4f12029907dfe58cc332a9e723de` |
| `spells/icon_f4_shadownova.png` | `app/resources/icons/icon_f4_shadownova.png` | `df4944b717a381cd37d3958735b70b8297843fffd1e404305d0a79ef9d0465d1` |
| `spells/icon_f4_voidpulse.plist` | `app/resources/icons/icon_f4_voidpulse.plist` | `82b23313373143c099a496c73790aaadcb3b55484819222935856c2cc235d60a` |
| `spells/icon_f4_voidpulse.png` | `app/resources/icons/icon_f4_voidpulse.png` | `a30232c01e3759d22fcc316b115e752a05d15fe850370d70fa1983b7ce03817b` |
| `spells/icon_f4_wraithlingswarm.plist` | `app/resources/icons/icon_f4_wraithlingswarm.plist` | `2afaf7d78912d8a57cfa673b0134b6c47cb47356dc44cdba8185be2634e8f425` |
| `spells/icon_f4_wraithlingswarm.png` | `app/resources/icons/icon_f4_wraithlingswarm.png` | `cf1c191da27228f09a7a377b35283e9470214b1e4824a595644709e891300600` |
| `spells/icon_f5_amplification.plist` | `app/resources/icons/icon_f5_amplification.plist` | `dbedca0414bfcfbb84f7104eacdd134800375d57d2ffbf87959536aaf4e9e1b1` |
| `spells/icon_f5_amplification.png` | `app/resources/icons/icon_f5_amplification.png` | `17c810a163e61ca563c01878b4c886aaa155be50c7c30224b7103bfb2636ad06` |
| `spells/icon_f5_diretidefrenzy.plist` | `app/resources/icons/icon_f5_diretidefrenzy.plist` | `a289bb83ca81a6fe454cd2e869e469538c9363d3b3f0d72a74209c7ec1823e26` |
| `spells/icon_f5_diretidefrenzy.png` | `app/resources/icons/icon_f5_diretidefrenzy.png` | `e25c1a70493fb5814f5fc75af7ea4da41ab065fd6c234a61263a226d0fdbf931` |
| `spells/icon_f5_earthsphere.plist` | `app/resources/icons/icon_f5_earthsphere.plist` | `b4a0353bf50238dc5852699e6ee7163a399b39eab336e7fe7f44ed26aaaba5aa` |
| `spells/icon_f5_earthsphere.png` | `app/resources/icons/icon_f5_earthsphere.png` | `ea78c5d79873108caffbcc314f0b7ab1ae332c8184c0437bf2904a4bfbfc2a4d` |
| `spells/icon_f5_eggmorph.plist` | `app/resources/icons/icon_f5_eggmorph.plist` | `47959d30f9406d74163025dae9fb7e9b2086f13137836bcc4a8a8e652df5ac23` |
| `spells/icon_f5_eggmorph.png` | `app/resources/icons/icon_f5_eggmorph.png` | `ce5cb63babb95ffd8f1a8dec5fd08af1791ce5cac02ba4ee81ff9175e7cac467` |
| `spells/icon_f5_greaterfortitude.plist` | `app/resources/icons/icon_f5_greaterfortitude.plist` | `4bc4ce476c46e719803c01d5389134a4d9711d6a965a961f7c6432c17d88426c` |
| `spells/icon_f5_greaterfortitude.png` | `app/resources/icons/icon_f5_greaterfortitude.png` | `a483fe57b4246c1007b750a90a9b513800cf77e44f9cedaccb835288a48d1970` |
| `spells/icon_f5_manaburn.plist` | `app/resources/icons/icon_f5_manaburn.plist` | `8fb78f35a33f0feb0a847d7736752f69e38a7e1046c2ae7be3e6291e9d69238a` |
| `spells/icon_f5_manaburn.png` | `app/resources/icons/icon_f5_manaburn.png` | `450872414f5db1cfde162b8b94557e6284a22dada8ae858efc240c050acee630` |
| `spells/icon_f5_naturalselection.plist` | `app/resources/icons/icon_f5_naturalselection.plist` | `9e1908854593d7d69a73b6f192033c6dac863f1284f4ec1f18fc97cd75766e8d` |
| `spells/icon_f5_naturalselection.png` | `app/resources/icons/icon_f5_naturalselection.png` | `1ecf46c460b922364fd7c7024590644b8eb2c33fa10d5de4eadf3b39bedda9a2` |
| `spells/icon_f5_plasmastorm.plist` | `app/resources/icons/icon_f5_plasmastorm.plist` | `ad349c0666724047c2185a46be1ceb5aedc88abdd49b51a3a949e05520b64a17` |
| `spells/icon_f5_plasmastorm.png` | `app/resources/icons/icon_f5_plasmastorm.png` | `264be2e841d7bdd73fe8dc7e0cc53292ae12fc359824a6020f5053830b93fec7` |
| `spells/icon_f6_aspectofthefox.plist` | `app/resources/icons/icon_f6_aspectofthefox.plist` | `d28d6a9e804cc37657fd45798c38d82ef85f802d1876980a1fce43fe693b9568` |
| `spells/icon_f6_aspectofthefox.png` | `app/resources/icons/icon_f6_aspectofthefox.png` | `7ec452dfb43dfe27c7d2ca8d770b92c92d29440d81e0fa6fd2fe9af9d3cebd7a` |
| `spells/icon_f6_avalanche.plist` | `app/resources/icons/icon_f6_avalanche.plist` | `6226dcae62a4ecd71e0739b53a33e6d4636251d04f8c4d2930c4a45a8efcf295` |
| `spells/icon_f6_avalanche.png` | `app/resources/icons/icon_f6_avalanche.png` | `d4ca20da4b92f011fed39e8e894cfd709f7ab31f1ce9aee230c49549dd54c81f` |
| `spells/icon_f6_bonechillbarrier.plist` | `app/resources/icons/icon_f6_bonechillbarrier.plist` | `98477c369a3a5bc5bd40657befc1cf57d32b4e3b9eee11826e41ddffa2f2708c` |
| `spells/icon_f6_bonechillbarrier.png` | `app/resources/icons/icon_f6_bonechillbarrier.png` | `181a7d4c9bc32b9a36a6136fdb559ee5f6daa31dfbb1820a0b9d1df8d4ac7c84` |
| `spells/icon_f6_chromaticcold.plist` | `app/resources/icons/icon_f6_chromaticcold.plist` | `7cc8fdf9b3821d90a39cabd229aefa7c9a0144ebad7cb568a33546a0edea0ffb` |
| `spells/icon_f6_chromaticcold.png` | `app/resources/icons/icon_f6_chromaticcold.png` | `a9c590b3c78c0973cd9a7f9defe7623955d4de4e1d978c4359c3bbc7dfeb29a4` |
| `spells/icon_f6_cryogenesis.plist` | `app/resources/icons/icon_f6_cryogenesis.plist` | `19128d6d1d5d76580f54cd033ab9738891faf40d923d1cb183bba3fd41543c35` |
| `spells/icon_f6_cryogenesis.png` | `app/resources/icons/icon_f6_cryogenesis.png` | `dbf80f7d8c991351b8555cd9c57990aa018c3d7dae955509b0e0f60dada064c1` |
| `spells/icon_f6_flashfreeze.plist` | `app/resources/icons/icon_f6_flashfreeze.plist` | `31eb530c2db13462677dee7212011e195d642a779c4f9549dceaddbf9de641a6` |
| `spells/icon_f6_flashfreeze.png` | `app/resources/icons/icon_f6_flashfreeze.png` | `878b205cb5c964ad071adcefc5195f314a57f069914e347268ed53066318181d` |
| `spells/icon_f6_gravitywell.plist` | `app/resources/icons/icon_f6_gravitywell.plist` | `ef9e37e747526df2d37a0618edc019305a9818af19eb45b72bff8e34cd430434` |
| `spells/icon_f6_gravitywell.png` | `app/resources/icons/icon_f6_gravitywell.png` | `71a6acefe5a9f86180532af557248cc2be06cd6066d2f944ae2d2a485c691c7b` |
| `spells/icon_f6_spiritofthewild.plist` | `app/resources/icons/icon_f6_spiritofthewild.plist` | `9a88edc925f9abb8a605e2462028fbc391d4ba6ace2975bb942aa8286ca5d257` |
| `spells/icon_f6_spiritofthewild.png` | `app/resources/icons/icon_f6_spiritofthewild.png` | `26d6eb280590dfd172d832785151c22f7d273a331436a787aac8e09c1d9a2251` |
| `ui/icon_heal.png` | `app/resources/ui/icon_heal.png` | `a553bce5c48cc13039b05c6db4442f7d9d44dc80642ff3d817fcd6ad5cb32d9c` |
| `units/f1_altgeneral.plist` | `app/resources/units/f1_altgeneral.plist` | `745985a646b9382553720080e3290528c79a27c6cb27eb186f3fe6cfff878d2f` |
| `units/f1_altgeneral.png` | `app/original_resources/units/f1_altgeneral.png` | `caf2fb9bd48c1e9432ead042d6b0c91cad06462797b14b2b4a22870ff7c48de0` |
| `units/f1_azuritelion.plist` | `app/resources/units/f1_azuritelion.plist` | `73aed283f17617028b29227478f8d49963f84d78f4e7754ad6f30f7d51c8fe3b` |
| `units/f1_azuritelion.png` | `app/original_resources/units/f1_azuritelion.png` | `b823e47e4fe075a355dbed6b7918a45eb148be61573bb9702c08a5cd492ffdb6` |
| `units/f1_caster.plist` | `app/resources/units/f1_caster.plist` | `6e39fbddc20c7afd9c6ad606cc4db71c4420533e73e482d9311206c948d74d4f` |
| `units/f1_caster.png` | `app/original_resources/units/f1_caster.png` | `952ce7a7778823f381a97bfe67407490beea1d6eeebede8431a9340dd0f6c90d` |
| `units/f1_elyxstormblade.plist` | `app/resources/units/f1_elyxstormblade.plist` | `463fc09c56a19b40fafd04020c0d920afdbf331567dad5578ae28a3640bf7a89` |
| `units/f1_elyxstormblade.png` | `app/original_resources/units/f1_elyxstormblade.png` | `20f772ebba1093869f185d7fda6b91f5efd2a3b7b759d60dcee5d1642fdad02c` |
| `units/f1_general.plist` | `app/resources/units/f1_general.plist` | `c9fc39d8d7dec25ef09721fed8284bbf606a69d698d6b2982f33b51a0f054a10` |
| `units/f1_general.png` | `app/original_resources/units/f1_general.png` | `1dcbf673fa0dec4eda34b426b884df529e1c76f3d32cf3c0baf0c10ea83931f8` |
| `units/f1_ironcliffeguardian.plist` | `app/resources/units/f1_ironcliffeguardian.plist` | `281084219772dbd0b93bb28b5609a57df5940b5ca9a66cd73b97a05e2bb56cbf` |
| `units/f1_ironcliffeguardian.png` | `app/original_resources/units/f1_ironcliffeguardian.png` | `5cec31b0d6b594e953d5c7c8355ce43d2235d487ebaa6ae9f4ba60b7dcced308` |
| `units/f1_melee.plist` | `app/resources/units/f1_melee.plist` | `b22eb67d929a9f458ebec3758f874a6aa88965410c648944c13290ca2ad66638` |
| `units/f1_melee.png` | `app/original_resources/units/f1_melee.png` | `525f1a8bc9ae42d9a3cdee5c64c9f65af5b89b4f978ae7fddee04b7f11abbe1c` |
| `units/f1_silverguardsquire.plist` | `app/resources/units/f1_silverguardsquire.plist` | `7191c5873ed1932fba49af6eedc8e5bbe9568a9217b2a04d9c35b75d9c9a00a4` |
| `units/f1_silverguardsquire.png` | `app/original_resources/units/f1_silverguardsquire.png` | `8df234dc6be9080797e08855a33eca1757a12edb0b7c00bdc36e75b7a36daaee` |
| `units/f1_silvermanevanguard.plist` | `app/resources/units/f1_silvermanevanguard.plist` | `0fdc2bc9c43bd30b111131dab48c9f0ecd38417a0f2ecc76201d262683d7654d` |
| `units/f1_silvermanevanguard.png` | `app/original_resources/units/f1_silvermanevanguard.png` | `5145a7342678349a858f8f276c98d8c25c0bc46ce0bcfecdd91c6a121aaeab3d` |
| `units/f1_special.plist` | `app/resources/units/f1_special.plist` | `88816d010850c5ebd8f6b31a5977f2102057e026fb18cf49949606039fa33741` |
| `units/f1_special.png` | `app/original_resources/units/f1_special.png` | `de9ad9084186c0544c4199920fc013c5caf7507b42de7811fcb1b30d654757e0` |
| `units/f1_sunriser.plist` | `app/resources/units/f1_sunriser.plist` | `b9b99654312de4dd1fa091e825246225e20dc2ead02614fb03401e29e8b7e9a0` |
| `units/f1_sunriser.png` | `app/original_resources/units/f1_sunriser.png` | `7adc6df89b696ece29a57f80b68ea676aa10843041bb813cda04d82ef652ac2d` |
| `units/f1_sunstonetemplar.plist` | `app/resources/units/f1_sunstonetemplar.plist` | `507a0c68eb5efe8d4af61d28f6a3223e6e23567cf874e8e5bf4daed9ea5f5c8c` |
| `units/f1_sunstonetemplar.png` | `app/original_resources/units/f1_sunstonetemplar.png` | `4ff392514424e940926afbbde98225eabaf55c136e9d448d42350051355b55a0` |
| `units/f1_support.plist` | `app/resources/units/f1_support.plist` | `e55e0186b568c278fcf05c11d50477ec2b9ae7368b29bd73ab174d500a94ff0f` |
| `units/f1_support.png` | `app/original_resources/units/f1_support.png` | `fd0e4d508dc075f512ffa25ff9fd59215f5749015f3f29192ae3ad10a8b0e213` |
| `units/f1_tank.plist` | `app/resources/units/f1_tank.plist` | `c85bd0278c4534b560608220fa1c2c1d1393498ca863e281d2442957312e95b8` |
| `units/f1_tank.png` | `app/original_resources/units/f1_tank.png` | `3bed43ef85afcf20488fd992370734285a92e0283f12be93785519002b46648b` |
| `units/f1_windbladecommander.plist` | `app/resources/units/f1_windbladecommander.plist` | `73e866590da895f82b5d253f39fae62c285b4258ea027c00afc1da69388d1bdd` |
| `units/f1_windbladecommander.png` | `app/original_resources/units/f1_windbladecommander.png` | `542a7ad21d70e75b4f5786f25feb843674762905ce4e2ab329d2befbfb957da6` |
| `units/f2_altgeneral.plist` | `app/resources/units/f2_altgeneral.plist` | `98589499e7f204db490ddb21a7f6a5ee846334d12f8c84a7f4248676a773ed7e` |
| `units/f2_altgeneral.png` | `app/original_resources/units/f2_altgeneral.png` | `d729b6e8d37f2d31db5a200fe6faf365d71e457f84af950e7f3e4c812dda8c01` |
| `units/f2_caster.plist` | `app/resources/units/f2_caster.plist` | `0065d12f1110dcc313259169c12c8f9f8fe1446902962984ec144dd5e3d60677` |
| `units/f2_caster.png` | `app/original_resources/units/f2_caster.png` | `600757b5d54407bac8585d50ab17b57dcd2a8aa7340263dc2bee0976c95dbe4b` |
| `units/f2_chakriavatar.plist` | `app/resources/units/f2_chakriavatar.plist` | `dc913e18c55c6aec227be528bb214597b7bb4dea7cd577f041300755a9afbade` |
| `units/f2_chakriavatar.png` | `app/original_resources/units/f2_chakriavatar.png` | `c4aabebcc893d0028c6be7035277690d9f953c516e998f3d016c3ff453134b84` |
| `units/f2_deathphantom.plist` | `app/resources/units/f2_deathphantom.plist` | `f4b285fbd8f2ea16242500689329191347ed480231ebcd67fa93bb79b940f59e` |
| `units/f2_deathphantom.png` | `app/original_resources/units/f2_deathphantom.png` | `c8d81806fe034e59cd0b44837acf14347c12cb53f68ea59b21bc39f3a5e7ae01` |
| `units/f2_general.plist` | `app/resources/units/f2_general.plist` | `887ed35cf51926ecc9d6808aeccc0f71f9c10527ca911b901a1637bb166cef17` |
| `units/f2_general.png` | `app/original_resources/units/f2_general.png` | `a57b67b068a8b541f5e5ae18b936157b888c4e32fbc42b7db010752f28246d06` |
| `units/f2_hammonnladeseeker.plist` | `app/resources/units/f2_hammonnladeseeker.plist` | `485f3404ffa4976f58f5eab585025f52a8d1bbaa63a7953226d96bf3043e4be2` |
| `units/f2_hammonnladeseeker.png` | `app/original_resources/units/f2_hammonnladeseeker.png` | `3468c826281e265076b1fa43a7ee7e580b87a6ebfb1f36b067109440b0768017` |
| `units/f2_keshraifanblade.plist` | `app/resources/units/f2_keshraifanblade.plist` | `e53bf8ccdd96eacb6d46a9b256c204cec8a1701ebb2ea5aa11af7a6e08cc184d` |
| `units/f2_keshraifanblade.png` | `app/original_resources/units/f2_keshraifanblade.png` | `d846e30c206eb341bfeaa8363cbebaa286a91f5d3ac804f31139a57af3bbd11b` |
| `units/f2_lanternfox.plist` | `app/resources/units/f2_lanternfox.plist` | `21431a336aa2f392b568fdb3b68bdc90d46b474b1cb06df9e4be852ad928eec7` |
| `units/f2_lanternfox.png` | `app/original_resources/units/f2_lanternfox.png` | `d8e12ebed682736e3d29d0e3493fe61d7b96d83df3835887ae7963fdd47bd137` |
| `units/f2_mage4winds.plist` | `app/resources/units/f2_mage4winds.plist` | `d9bfc2e2dc7ae024c2a08df9791a51992b6a79dd03f2bc0246bd597a293ca8a2` |
| `units/f2_mage4winds.png` | `app/original_resources/units/f2_mage4winds.png` | `bc5f1d773e525d404299fff4eda184416971eaa320016786fe45be83edcc6cd7` |
| `units/f2_melee.plist` | `app/resources/units/f2_melee.plist` | `ef46ec90300879815847347092f62796ccc20e43d9d9ed6574b2fd8388aaa228` |
| `units/f2_melee.png` | `app/original_resources/units/f2_melee.png` | `38ea62382be8794f4f81035bff31a2f6481f05a5bd68cc2a57321def9def9855` |
| `units/f2_ogremonk02.plist` | `app/resources/units/f2_ogremonk02.plist` | `0eb7465de827ad8afa9aebb82ef9aea3b665d12cb6529d0cdd46bfce9201dea8` |
| `units/f2_ogremonk02.png` | `app/original_resources/units/f2_ogremonk02.png` | `872ded705b8bb91936bc539c23aea4a20621c8eebe99cd33d43b2ab05c82d147` |
| `units/f2_pandabear02.plist` | `app/resources/units/f2_pandabear02.plist` | `4defeff945d87d5793354c83bdd27ff9e49637386eece4a8ed2b51b4e32ca3f3` |
| `units/f2_pandabear02.png` | `app/original_resources/units/f2_pandabear02.png` | `37e7288da4df725726a5a954e8d58ced0ed066078280bbd9c2f61c74ece192b2` |
| `units/f2_panddo.plist` | `app/resources/units/f2_panddo.plist` | `725eb2ab26448ecaeb024582ccbda3ec8c6a390428766ef89e98d0291a7b4b5c` |
| `units/f2_panddo.png` | `app/original_resources/units/f2_panddo.png` | `92132db818b53dd4ef2c99710f80f03f9c99668efe61ca5a776fb744a2390c88` |
| `units/f2_ranged.plist` | `app/resources/units/f2_ranged.plist` | `9fbffea1e33eed21cedb6d0933784b9adca30d1ccea75057340d996a20b67ca0` |
| `units/f2_ranged.png` | `app/original_resources/units/f2_ranged.png` | `0a74e91e22ecee0f0dd78032f6f527739f07239b51bb9b5c22ad60211c80cb91` |
| `units/f2_special.plist` | `app/resources/units/f2_special.plist` | `8d4092427a64b2104ed2c5829761e300dc887f68e0dce5e062a0ae1e774bf68f` |
| `units/f2_special.png` | `app/original_resources/units/f2_special.png` | `0887d27c30731d9d83d7b11bbe6c09b9b4b4607a12e3dd654806c85ef5ce5cb0` |
| `units/f2_support.plist` | `app/resources/units/f2_support.plist` | `5c3473ea4cf65694c36fcf9302e3580151a47dcb5ec92e3325d6408fdc34819c` |
| `units/f2_support.png` | `app/original_resources/units/f2_support.png` | `05de8ecb44d8e1715eb2bdc90a72933af572f1c17f714bcbe866209dd4f7f6c4` |
| `units/f2_tank.plist` | `app/resources/units/f2_tank.plist` | `07197b0d265135d54c9d3304875423aabbdac579ddddd7789763b802bc6c36a5` |
| `units/f2_tank.png` | `app/original_resources/units/f2_tank.png` | `7414842af5cf31f12dfa9247a7622e38e50d78cff498063374eb85b1531bd099` |
| `units/f3_altgeneral.plist` | `app/resources/units/f3_altgeneral.plist` | `71e570d96858cbc97b93d44d3fa32a15c810e0a38f3b0c00b5118d890a5ab968` |
| `units/f3_altgeneral.png` | `app/original_resources/units/f3_altgeneral.png` | `ad55a2239008832445d853d0dcfed94f12bce0f2de642606b21622174df0146e` |
| `units/f3_aymarahealer.plist` | `app/resources/units/f3_aymarahealer.plist` | `fbba45980f3833b2812c8b198a3ecbb5577e951c1c52f883ef2585b200fa2d3c` |
| `units/f3_aymarahealer.png` | `app/original_resources/units/f3_aymarahealer.png` | `a20f27a2a9971df03c80c200187f37b28b83912c7ff683f58feae02fa9ffd423` |
| `units/f3_dervish.plist` | `app/resources/units/f3_dervish.plist` | `6eb6a7201f1545887c12e8683c0c1bdde7aa6eb3bc1ba1840a03a895d99ef980` |
| `units/f3_dervish.png` | `app/original_resources/units/f3_dervish.png` | `3fdd63adac0d38749528486fb07eb75fcaadfd2635680afff5db8dfb82905c5b` |
| `units/f3_dunecaster.plist` | `app/resources/units/f3_dunecaster.plist` | `367acef4ac0d8ddd397a00c1e3f73c2e9a7008ac8367cf925e72cd1533a20588` |
| `units/f3_dunecaster.png` | `app/original_resources/units/f3_dunecaster.png` | `18ec0922f4492d862006a9415f265d7737b3ece93cfde747081062a1770508e3` |
| `units/f3_general.plist` | `app/resources/units/f3_general.plist` | `a608556dc4b0717d74c9c31147762e54f1b5d8a4cbfb55b49140149fc0c4a4aa` |
| `units/f3_general.png` | `app/original_resources/units/f3_general.png` | `bbbe6f7c66de354fca9c824a538ea58ccf5e4922e3071f4308d59332af6e52e2` |
| `units/f3_glassmirage.plist` | `app/resources/units/f3_glassmirage.plist` | `6940b8944089bf9aad80ab4c6641811c3e30663cf7051624a3f7aee7b0c2fc97` |
| `units/f3_glassmirage.png` | `app/original_resources/units/f3_glassmirage.png` | `a952ca3194eb84b293f51ddbb74d26a2ec6d70bd515c6099e92ae73b8fb3fa51` |
| `units/f3_obelyskduskwind.plist` | `app/resources/units/f3_obelyskduskwind.plist` | `751be7ac4494d31e5284d76396c16f2adbaef43fe3c9b2d77551c63affff25c8` |
| `units/f3_obelyskduskwind.png` | `app/original_resources/units/f3_obelyskduskwind.png` | `6afc92f2419c7979539ecfe991c16acecdc294755e9c02b03edba17bd733cf6e` |
| `units/f3_obelyskgoldenflame.plist` | `app/resources/units/f3_obelyskgoldenflame.plist` | `f68cac5862dc66a6639bd1fa96770873f5f0d2f8eff9268b1b8c98166be6cbb6` |
| `units/f3_obelyskgoldenflame.png` | `app/original_resources/units/f3_obelyskgoldenflame.png` | `29c418287fc855dba57c0f658cc6598fe423bb9dbcc8b8ed8afbf5ca962f6170` |
| `units/f3_obelyskredsand.plist` | `app/resources/units/f3_obelyskredsand.plist` | `81187b1c2ce4141a1005cbc85dbe5564b499bfe0c74d237303a65e55b60b2c76` |
| `units/f3_obelyskredsand.png` | `app/original_resources/units/f3_obelyskredsand.png` | `8936d940357c0bf4c2cd63c6ab28418201708810f1339a2e701112fa37223203` |
| `units/f3_orbweaver.plist` | `app/resources/units/f3_orbweaver.plist` | `5b345883e6fc1a8daf8501cab09f5c7525379fdc377e966f4b9b317ce9c76edb` |
| `units/f3_orbweaver.png` | `app/original_resources/units/f3_orbweaver.png` | `db1f65920abbb2ee8f682821390ff35cf8f6a861a65dd1636d5f3e5117c30470` |
| `units/f3_pyromancer.plist` | `app/resources/units/f3_pyromancer.plist` | `0c442602d814cc6e1af0230bf6724dc2635289f19d8500cc103a3af3b00bbaf9` |
| `units/f3_pyromancer.png` | `app/original_resources/units/f3_pyromancer.png` | `645d09d0592ec9592f45f460a8ba647d1f0e5a0f7c5c6c4365ad9510c7ed6c2b` |
| `units/f3_sandhowler.plist` | `app/resources/units/f3_sandhowler.plist` | `65ad82fa7be06aa259ebe485a590b37ac0dd0107de0a3d990ee6ae9f6572e7e5` |
| `units/f3_sandhowler.png` | `app/original_resources/units/f3_sandhowler.png` | `0fe30d33c1ec17542e1ce84d8a3ad69108817fbf181b5417f3eaf7534d80c25f` |
| `units/f3_starfirescarab.plist` | `app/resources/units/f3_starfirescarab.plist` | `f51db8a2fbcf76a2058b93c6573634d25c61c4e06ea0c9d1fda76d23bd6bc8a2` |
| `units/f3_starfirescarab.png` | `app/original_resources/units/f3_starfirescarab.png` | `1c4f99f6ae75ad7fdfd19156ee52a363fa18f5a1c3d8c0e0199069d064bf6820` |
| `units/f3_windshriek.plist` | `app/resources/units/f3_windshriek.plist` | `62a3f32a421641a37d63237f07def289bfefc530aa147098e9f377857314e1c3` |
| `units/f3_windshriek.png` | `app/original_resources/units/f3_windshriek.png` | `1e61f27100898b0dc3ff649a1403aa4bb413cb94f9e59f414fd2847ccaebaf79` |
| `units/f3_zodiac02.plist` | `app/resources/units/f3_zodiac02.plist` | `143451c5636c8b4dd1e782c877a63fc8e3af10720f2bf2a965416e374795e2ee` |
| `units/f3_zodiac02.png` | `app/original_resources/units/f3_zodiac02.png` | `4922f10987613cd58db214deff2e02411322155c7bffe384922784481549ac77` |
| `units/f4_altgeneral.plist` | `app/resources/units/f4_altgeneral.plist` | `9e6c6d6d2206706181896623c123d0cc17f6ae1807c42cd6ca8dde6a73f98da3` |
| `units/f4_altgeneral.png` | `app/original_resources/units/f4_altgeneral.png` | `8faebcdc1c9c610af5ccbb890a29fc385c53d57140d3dfb168db6ff0f5613c0e` |
| `units/f4_blacksolus.plist` | `app/resources/units/f4_blacksolus.plist` | `4387ae6186bf43542c128a9b529c504445bed88b3899e3994b5a88220ed79923` |
| `units/f4_blacksolus.png` | `app/original_resources/units/f4_blacksolus.png` | `640a84c3ad6b2fd327a879cb429012fa2bb5e0be3ebb85132ec48bd5be1094e2` |
| `units/f4_bloodmoon.plist` | `app/resources/units/f4_bloodmoon.plist` | `b3bb9db3264270eee2155e8c38220fd756b5216393e3ac1304b92e55b5102d18` |
| `units/f4_bloodmoon.png` | `app/original_resources/units/f4_bloodmoon.png` | `8e1785077ac5c104ca8ec66b3ba353b9732491b44c95f06c7a6c11221d8b5c3c` |
| `units/f4_crawler.plist` | `app/resources/units/f4_crawler.plist` | `8f091ad93c3fe570c25341e4c36865ed9688481ea04bee863c6bd17cf0f444d8` |
| `units/f4_crawler.png` | `app/original_resources/units/f4_crawler.png` | `8c2c5d87377d53d3eed2242ce5c2d24570f183354eebc0358bea9f6abec18556` |
| `units/f4_daemondeep.plist` | `app/resources/units/f4_daemondeep.plist` | `1c34e3d0105f415a6f2b559fc3ce8eb0cbc40dbeaf3a7309b409b1f83aafae65` |
| `units/f4_daemondeep.png` | `app/original_resources/units/f4_daemondeep.png` | `fc2bf8d6918ccf8c5f1c2e1ae13dcb632d530ce8ac25289ec70bde3d7a8e99b2` |
| `units/f4_daemongate.plist` | `app/resources/units/f4_daemongate.plist` | `01ed30d4e95f5019bdad61f7c2a8d581d8f06563bf823784c8e6898920f93b5a` |
| `units/f4_daemongate.png` | `app/original_resources/units/f4_daemongate.png` | `cab93a320f133a06b7d327cb74811ef1b4101d155daf653f9b65e9bb0c8b26c6` |
| `units/f4_daemonvoid.plist` | `app/resources/units/f4_daemonvoid.plist` | `41b6e19bb8042f11d04fbfa41602c9f77ca1c006157df5cc03efa629a73f4a89` |
| `units/f4_daemonvoid.png` | `app/original_resources/units/f4_daemonvoid.png` | `9906d080cb4c7b0ef96173b49606c5ded147753db1dc62f1c0e9e4ed9436f30d` |
| `units/f4_darkspine.plist` | `app/resources/units/f4_darkspine.plist` | `7f5fc11d68af7c5b9d94e9387e19e53acad4d07af4d12237a400d79dcc4a9fa5` |
| `units/f4_darkspine.png` | `app/original_resources/units/f4_darkspine.png` | `a7630db6974b8687d5887837e69c43e56929ead2d9fb80eda945eef2dceb17f0` |
| `units/f4_engulfingshadow.plist` | `app/resources/units/f4_engulfingshadow.plist` | `25e980baad625b15408a1493aca49bcd0bb5cab83bcb511ee370f5ab7e607355` |
| `units/f4_engulfingshadow.png` | `app/original_resources/units/f4_engulfingshadow.png` | `4439ad5ee67b77a0aa5a41c6d4c82baff01506e80cf150d391355883f15d4f71` |
| `units/f4_general.plist` | `app/resources/units/f4_general.plist` | `afc9d5c8a36943d63f94b59a58c95c3c7c99f0411cc12e3bff18507fb42c97d0` |
| `units/f4_general.png` | `app/original_resources/units/f4_general.png` | `3059c8405a2f9f8fd9180dc5d749335fb7be216e327b61b76fbb6d36b06f4848` |
| `units/f4_gloomchaser.plist` | `app/resources/units/f4_gloomchaser.plist` | `32a75a25bb18169f11c6e70fd8f9626476be53f6dfd0e59caced5dcfe7083b8d` |
| `units/f4_gloomchaser.png` | `app/original_resources/units/f4_gloomchaser.png` | `9cdb015a6b753b414d9609b9fafbaa0673596b1c8b4a49c2abee259b4e8c2a9e` |
| `units/f4_juggernaut.plist` | `app/resources/units/f4_juggernaut.plist` | `f46de62718a7089e84f3e5c66c4c7602dbd411e2efb1578afc5d92963ef87216` |
| `units/f4_juggernaut.png` | `app/original_resources/units/f4_juggernaut.png` | `5477613577e056aff4e343a64552f0b3a5a989d6c556a6aad89cae3fecf6776f` |
| `units/f4_nightsorrow.plist` | `app/resources/units/f4_nightsorrow.plist` | `d96683fda6bbe871044682ce6f93fc22ece933a32c70dff6eeceb4d9daa0aa26` |
| `units/f4_nightsorrow.png` | `app/original_resources/units/f4_nightsorrow.png` | `fd525c87434035538014d76ca5cdceed758fb0d81ec21d01e33dc73a3287df99` |
| `units/f4_shadowdancer.plist` | `app/resources/units/f4_shadowdancer.plist` | `65ae5c2d481caf3b120403c5d69ad0a951bdc3d83d9b53a3a96fb5cdba1a0442` |
| `units/f4_shadowdancer.png` | `app/original_resources/units/f4_shadowdancer.png` | `80ffae3b015d3d839efb18c0fab58e3bc5b74ab158368351f1e0c2697d53b1de` |
| `units/f4_siren.plist` | `app/resources/units/f4_siren.plist` | `f32bf3a1f0f0dc34c4207a9e7c09dba831c7144e6c9db3fb14ea1592b2693f0e` |
| `units/f4_siren.png` | `app/original_resources/units/f4_siren.png` | `e1b2851905ad1e5044f08d8df18fd07c3ef9d15b68b635b2e0bf475e72df14ee` |
| `units/f5_altgeneral.plist` | `app/resources/units/f5_altgeneral.plist` | `a828c1ff370d08258f93d5dcd886a2a7c9ecae151d835e06853159f9715ed831` |
| `units/f5_altgeneral.png` | `app/original_resources/units/f5_altgeneral.png` | `03573073afc7904285b74c6d9b9aa34b5f1337d4b3cfb6714674032d7a4f7996` |
| `units/f5_earthwalker.plist` | `app/resources/units/f5_earthwalker.plist` | `d18702ad70262bc5a7d6f68a70d14b92957cb1674ac1300eb4f18ae5b2c8016e` |
| `units/f5_earthwalker.png` | `app/original_resources/units/f5_earthwalker.png` | `c79d4358019c74cbf16aa75a022dc72e18b685f5998825f03c2ddab783f97b1c` |
| `units/f5_egg.plist` | `app/resources/units/f5_egg.plist` | `92a733b9124dd5b7c81d83bf7fe8d9a28bff4c95f710130d7d92346c6513ddfd` |
| `units/f5_egg.png` | `app/original_resources/units/f5_egg.png` | `ab8bbb9b0c9875aab32a771638c17506655d22892fa410f922d79c105832c62b` |
| `units/f5_general.plist` | `app/resources/units/f5_general.plist` | `bc51de9994933c3955183f3823a88d7c6eb0f7ca8178d2d36041cca826db79c7` |
| `units/f5_general.png` | `app/original_resources/units/f5_general.png` | `42580c93ccb30379a6c209cb2e479f0e1b440b2dcaf0496dae836546e8aecb76` |
| `units/f5_grimrock.plist` | `app/resources/units/f5_grimrock.plist` | `aa553452328da7d02930d72a7c5e8dded92eae36a61dfc86b204000512da8e1a` |
| `units/f5_grimrock.png` | `app/original_resources/units/f5_grimrock.png` | `79457a3f4525c37ed7af01d3a1249fb721c2a080e31dedf68511f6eb83077847` |
| `units/f5_kolossus.plist` | `app/resources/units/f5_kolossus.plist` | `5c66e76b15f85e613e6608db81c581325a05eeaf45e43087296b649061f8da5a` |
| `units/f5_kolossus.png` | `app/original_resources/units/f5_kolossus.png` | `2b0d672ec878f08cb8333063934a0682c2a8616241f0a5b58027521fc4b35d6b` |
| `units/f5_mankatorwarbeast.plist` | `app/resources/units/f5_mankatorwarbeast.plist` | `41869df6ec2d44be077053810ba2a4cc6b8b7f75e5d07444350afc40fd8ecd29` |
| `units/f5_mankatorwarbeast.png` | `app/original_resources/units/f5_mankatorwarbeast.png` | `1f9cc29b3167a0aaea00f603f64e4a1f51befa776234670f3750b7993f841639` |
| `units/f5_primordialgazer.plist` | `app/resources/units/f5_primordialgazer.plist` | `149d039319e756dd74ec526d3a988140295b9b51858063953f4e705dc6f3a9cf` |
| `units/f5_primordialgazer.png` | `app/original_resources/units/f5_primordialgazer.png` | `a5327ad1048dc0002e642e9b67bafbd7b7c4ca357b449b9e446ca5a91736dc7e` |
| `units/f5_silitharelder.plist` | `app/resources/units/f5_silitharelder.plist` | `7812746c26ab85a1607fad9b83309b136536265e1bc20af83785915957407018` |
| `units/f5_silitharelder.png` | `app/original_resources/units/f5_silitharelder.png` | `d9665e764dca4f304b34c460361c74116aaa47dfce2ef52d99e777a4eb4231b7` |
| `units/f5_silitharveteran.plist` | `app/resources/units/f5_silitharveteran.plist` | `b0a96bb0221a03ae47f712b3e161e96c38663f214f30130ea8e569220786d2be` |
| `units/f5_silitharveteran.png` | `app/original_resources/units/f5_silitharveteran.png` | `1866379510386284ecdb5ced27f7cf0df8646f2f5f42be65ef89a2bdf8bb4fdb` |
| `units/f5_silitharyoung.plist` | `app/resources/units/f5_silitharyoung.plist` | `fda1daad6b4cd1d8586a915ceaaab7f7737dfd148887fe3bff8f8215ee5168b4` |
| `units/f5_silitharyoung.png` | `app/original_resources/units/f5_silitharyoung.png` | `3ce8c9f78f75294d92e1c62f2e843777667ad42eb3a857f283745db2b64ca926` |
| `units/f5_spiritharvester.plist` | `app/resources/units/f5_spiritharvester.plist` | `bdcf3cbac8335f7eacdc7678b76aaf6d353ce0dd947deb9aa255e2761efb725f` |
| `units/f5_spiritharvester.png` | `app/original_resources/units/f5_spiritharvester.png` | `41c248dab2183c85687c86fd433f4b56d20bd8e6b0a32f6ab97044a2f7b3226b` |
| `units/f5_support.plist` | `app/resources/units/f5_support.plist` | `aff8536e0a419f95e0d847fc275d4db673e551f9feaf168e930ac9f7ad54af48` |
| `units/f5_support.png` | `app/original_resources/units/f5_support.png` | `023c12e34d9a7a96b6f0d895559e3eee492d50f040de0df7696f67b819e5e17a` |
| `units/f5_tank.plist` | `app/resources/units/f5_tank.plist` | `76e9cc80fc63f9320392af8257d773b9e9bb1e20c3341b250a6bcf931c6631e1` |
| `units/f5_tank.png` | `app/original_resources/units/f5_tank.png` | `7e2ef4ecce106b0e758e0b5416b264002fa8795d372a9abf43d6bab4ef563bd2` |
| `units/f5_unstableleviathan.plist` | `app/resources/units/f5_unstableleviathan.plist` | `ba47ac78869495d43164adcb7280e525f4c9f7ec637c7e030f3c80b8cb51d74f` |
| `units/f5_unstableleviathan.png` | `app/original_resources/units/f5_unstableleviathan.png` | `c41e053e79c3d441d9c05cadff76d6d624e79fe7fc692a822d061734efa64d06` |
| `units/f5_vindicator.plist` | `app/resources/units/f5_vindicator.plist` | `1014a3ddbb0074570d7a12754cca37165a629b638f0f08cf073c534b48bf6156` |
| `units/f5_vindicator.png` | `app/original_resources/units/f5_vindicator.png` | `5f92b115418cd006116cd95e414060b0296232c6e9f983322b53a20498dd6d1e` |
| `units/f6_altgeneral.plist` | `app/resources/units/f6_altgeneral.plist` | `e4d7ac01c40fd35e055992725b1a35e1027d5216b25dce8343e212c73266f759` |
| `units/f6_altgeneral.png` | `app/original_resources/units/f6_altgeneral.png` | `ef3cab1bff711d3937d63b851d43367eae28af4bca708610574cc33a4c74f24c` |
| `units/f6_arcticrhyno.plist` | `app/resources/units/f6_arcticrhyno.plist` | `660077c7d3a31c8ca0b02b8fadb63be5935d6e9eef40491fd929965020f2a1f5` |
| `units/f6_arcticrhyno.png` | `app/original_resources/units/f6_arcticrhyno.png` | `147a410af2fbacb7d6eb27a812badfb0cdb98b697d78d301296a95844046f13c` |
| `units/f6_bonechillbarrier.plist` | `app/resources/units/f6_bonechillbarrier.plist` | `83db2ea54d0be1bc110f6e5379bda67474592709a05332e32f5f97eacedf68a7` |
| `units/f6_bonechillbarrier.png` | `app/original_resources/units/f6_bonechillbarrier.png` | `acc38eaf067e22d9c76e72c254fc7a11ac3549f78da895c3737e4fdd7d0d0462` |
| `units/f6_crystalbeetle.plist` | `app/resources/units/f6_crystalbeetle.plist` | `4ebce456611500889ec1414b67d056e62a9e26fdb8f9c2f0e130ee5b9680aa1e` |
| `units/f6_crystalbeetle.png` | `app/original_resources/units/f6_crystalbeetle.png` | `30a132437d584b74256c565f7f9846ecdf45ecabb913582468f0832efcafa252` |
| `units/f6_draugarlord.plist` | `app/resources/units/f6_draugarlord.plist` | `cf90402c2449c5ad59d1496ff74d9ef8f9d2d2d2e7f9502f010085626f072ef6` |
| `units/f6_draugarlord.png` | `app/original_resources/units/f6_draugarlord.png` | `357d54d98d2e85f35eff6148b581b83ce6ea4603490df025b5aa14507fb6a8f4` |
| `units/f6_fenrirwarmaster.plist` | `app/resources/units/f6_fenrirwarmaster.plist` | `880de86ecd2f486547b4af240d3280a957d21895b057b7f13577239e99dafd89` |
| `units/f6_fenrirwarmaster.png` | `app/original_resources/units/f6_fenrirwarmaster.png` | `eb29e277b5d50dbc54b07993f747432a11a0f76e533cd3117e116dbb28172b40` |
| `units/f6_frostdrake.plist` | `app/resources/units/f6_frostdrake.plist` | `e88b996c2570f5be09c2cc2b3a6c1859fa3b09ecd4a098d299c39f92820b933e` |
| `units/f6_frostdrake.png` | `app/original_resources/units/f6_frostdrake.png` | `a3c04400cedd8733f62803aa8a5221b0eeaaf973fb4310bfbe1a9714dbcff289` |
| `units/f6_general.plist` | `app/resources/units/f6_general.plist` | `358a09b42a58af8895aa83ef8b45a566ebab1e5a50d941efa4c9f6172fc2174a` |
| `units/f6_general.png` | `app/original_resources/units/f6_general.png` | `a1b275e8ce2e12b067e371bbf22b234605a2d780b64b3bb5af059572c3367dfe` |
| `units/f6_gravitywell.plist` | `app/resources/units/f6_gravitywell.plist` | `aa80f7561063cefbd371cb5fe610fa808b22913b3fe791d136fc9ec1db28a976` |
| `units/f6_gravitywell.png` | `app/original_resources/units/f6_gravitywell.png` | `354cf7205cf43267c5f516fdf2e06a075bc4d9c12bddd0e99279e2bda4a1de3d` |
| `units/f6_icedryad.plist` | `app/resources/units/f6_icedryad.plist` | `fc1cd709cbe4d37e85d5f13cab7a2c6e24c2a3ba15441b47b7f65876f52f012e` |
| `units/f6_icedryad.png` | `app/original_resources/units/f6_icedryad.png` | `4afb25c7cf16e24576958201aba88be38717476f687a47650d387d3cd65d909a` |
| `units/f6_justice.plist` | `app/resources/units/f6_justice.plist` | `b8a3f037cc40395a1cd2504a5a6e700d0ae636525e996d7c6b425c10cdf364fa` |
| `units/f6_justice.png` | `app/original_resources/units/f6_justice.png` | `a2fed26095762eb559b350b0b44e2bd7c14a4c08031c245bb13ebc6f0445cbbc` |
| `units/f6_minitreant.plist` | `app/resources/units/f6_minitreant.plist` | `a8d1e11a6ec30d0d908c56a3d126f623066f312024216e65ef2a85bab6fcc58f` |
| `units/f6_minitreant.png` | `app/original_resources/units/f6_minitreant.png` | `dbff44c00d9d684b49613b52ee7060f7595bb5729a904f1a645fa15baccacab6` |
| `units/f6_ravager.plist` | `app/resources/units/f6_ravager.plist` | `ef8b926061688cb4db548fb74bb9676e456bbdfcf6231f3e3247be6513ea7ac1` |
| `units/f6_ravager.png` | `app/original_resources/units/f6_ravager.png` | `f9f153aba396bb542f0dab4ae7f36a01c169f7dd6925173609bd2159e82cd9b3` |
| `units/f6_sentinel.plist` | `app/resources/units/f6_sentinel.plist` | `416acf4a55e8675a9462ae39da4fe9d16aa3423c1b7921826d81b07a554531ee` |
| `units/f6_sentinel.png` | `app/original_resources/units/f6_sentinel.png` | `5fe652959201ba65347bf3e219b23b14adc610ac88f2d33a82fea6f51de85283` |
| `units/f6_snowchaser.plist` | `app/resources/units/f6_snowchaser.plist` | `726196d85cf22a07790dd6a3bf9901491f76a1e06130e608d4af1070e1642575` |
| `units/f6_snowchaser.png` | `app/original_resources/units/f6_snowchaser.png` | `8f164f429a0d41b84f53ecced13be8db5a61ce20178a9fbc9607559b73ffeab6` |
| `units/f6_snowman.plist` | `app/resources/units/f6_snowman.plist` | `54d11c5669898a16eb8c38ad92aeb0440917cf7b654cc5e34fd7f83ab166c126` |
| `units/f6_snowman.png` | `app/original_resources/units/f6_snowman.png` | `ec96f62998a869a014b7af3e817f98e53ba3145b208d95259b8af3f9a46d2711` |
| `units/f6_snowwyvern.plist` | `app/resources/units/f6_snowwyvern.plist` | `fb4dbbe05373f376ba3555fea03d197e3e3e872a3d39a56ee8a9f287ce1f2b1e` |
| `units/f6_snowwyvern.png` | `app/original_resources/units/f6_snowwyvern.png` | `c138e1c872a9fea09af83462e4f8215a23b5ea94c78036c32491926e06ac5fcd` |
| `units/f6_spiritwolf.plist` | `app/resources/units/f6_spiritwolf.plist` | `3de3c096df9cc852b517f7b457ce42caafcc9668b48de45645e299cf18452151` |
| `units/f6_spiritwolf.png` | `app/original_resources/units/f6_spiritwolf.png` | `fb5b57b422226ec85733e55e043209f0d3899138df667c0ef5b23763e3540260` |
| `units/f6_treant.plist` | `app/resources/units/f6_treant.plist` | `aae9963c2bfaec888e8b590311d2e012f2b7c2205b7de5a967567d6cffb29a23` |
| `units/f6_treant.png` | `app/original_resources/units/f6_treant.png` | `2104e810a9946d74e5b567a2870fbc99c2a828a92b61f08dbad5ecdc31e6c3e2` |
| `units/f6_voiceofthewind.plist` | `app/resources/units/f6_voiceofthewind.plist` | `8fb391e7e7934ce33bc1e965b583c007164815cce8b9b7ba29b2282cd9aae257` |
| `units/f6_voiceofthewind.png` | `app/original_resources/units/f6_voiceofthewind.png` | `cc565f49faffe06feae37796d7716538b24348dc298bad7ab375d887208e6179` |
| `units/f6_waterbear.plist` | `app/resources/units/f6_waterbear.plist` | `889ad13f4e784ef4b632fe3822b0109f74038cff8e8c6f798858bef5f5f516ca` |
| `units/f6_waterbear.png` | `app/original_resources/units/f6_waterbear.png` | `7c2bca3b2b9283b0443bd77e601c9e6eb65178be7c539f20067f1ef917344c49` |
| `units/f6_waterelemental.plist` | `app/resources/units/f6_waterelemental.plist` | `7791c8edec94d6d66d42e9d138ed21dc38d72ddfabf923f29f4e3ea7718416c8` |
| `units/f6_waterelemental.png` | `app/original_resources/units/f6_waterelemental.png` | `f607f67326fd0a164c55f886d2a33fdff20d7967d868046d4929820fb0f153f5` |
| `units/f6_wolfraven.plist` | `app/resources/units/f6_wolfraven.plist` | `5cd7073c1cd155a1bdadc8dfc30ef67d538e15e999a6582eb74141c28c3f3439` |
| `units/f6_wolfraven.png` | `app/original_resources/units/f6_wolfraven.png` | `6c2b56ba2827b8c311511d65aa4a0a170d68d2d57ab4f269678adb91b9174a5f` |
| `units/neutral_beastcavern.plist` | `app/resources/units/neutral_beastcavern.plist` | `b137f550db566c45698c30f1e9c7fa5434f5140bd2a68456802dcb5e3a700020` |
| `units/neutral_beastcavern.png` | `app/original_resources/units/neutral_beastcavern.png` | `1248224616cfe694954351f3eda0d2775961859ec5c9aaf35368e555a639ca16` |
| `units/neutral_beastdarkharbinger.plist` | `app/resources/units/neutral_beastdarkharbinger.plist` | `9729f30f314f5044cf30136fc97bc6908742dfa051c13b70bc2d9aeb313185f2` |
| `units/neutral_beastdarkharbinger.png` | `app/original_resources/units/neutral_beastdarkharbinger.png` | `b8a19edc91c24e2ef22a4f264dbf7c53319d08df4faa93cf5937883e776fb4ee` |
| `units/neutral_beastmirkwooddevourer.plist` | `app/resources/units/neutral_beastmirkwooddevourer.plist` | `305123bf0a27f301c096cac7191701ee60250bfc7c65a8204f99421f77e152c1` |
| `units/neutral_beastmirkwooddevourer.png` | `app/original_resources/units/neutral_beastmirkwooddevourer.png` | `32a7f07cb5839603c0501cd656d27196ef8f63d281628980e0aadac2b1cc4843` |
| `units/neutral_beastphasehound.plist` | `app/resources/units/neutral_beastphasehound.plist` | `6735acf56ae3b960a501d0b48bac1417b2a489978c64fffd989e3361065dff62` |
| `units/neutral_beastphasehound.png` | `app/original_resources/units/neutral_beastphasehound.png` | `fccbf4bb7a2dab7e359cf7aed11c13c8a01ee589a2e4ff49257f0396e45f9482` |
| `units/neutral_beastrepulsion.plist` | `app/resources/units/neutral_beastrepulsion.plist` | `b2c07f6474e68ba263fd13ff49eb3383fe4e3d83b4aa1ba09f46ca5abadc8479` |
| `units/neutral_beastrepulsion.png` | `app/original_resources/units/neutral_beastrepulsion.png` | `688239cd0f62395ff7e953f86eaee7dca02d199fe176cb4016f243a242cd69a3` |
| `units/neutral_beastsaberspinetiger.plist` | `app/resources/units/neutral_beastsaberspinetiger.plist` | `d48692794f4ede337f4f1e6e202a8042e32e26cef42a0aba91f6cb5f4fe51bb1` |
| `units/neutral_beastsaberspinetiger.png` | `app/original_resources/units/neutral_beastsaberspinetiger.png` | `9f9634b00273fc8e15cb283ab904f9272d15839aa290b240bcd2a980239a6825` |
| `units/neutral_bloodstonealchemist.plist` | `app/resources/units/neutral_bloodstonealchemist.plist` | `bbea0d0dae801ab3c26630556d5c550d64ac61baaa03226e769ad484f3cfc35d` |
| `units/neutral_bloodstonealchemist.png` | `app/original_resources/units/neutral_bloodstonealchemist.png` | `d050d80382c1b2476414a14ae35e1ac5e11e1c68120551cf1117d5a401e8d4b5` |
| `units/neutral_bonereaper.plist` | `app/resources/units/neutral_bonereaper.plist` | `1e37e7cfeab1d0360d71fc84a99227f61cb8bdd87928aa63b73160daca837b88` |
| `units/neutral_bonereaper.png` | `app/original_resources/units/neutral_bonereaper.png` | `d402bdf3205ba3a045c1d5deed589a9be46a4df8593f5a20954448c34e96d635` |
| `units/neutral_eclipse.plist` | `app/resources/units/neutral_eclipse.plist` | `7c0b847e966fd3fca7d2ef0fddf84a99b996bab4e218224c80350d77e96b1ae3` |
| `units/neutral_eclipse.png` | `app/original_resources/units/neutral_eclipse.png` | `a78a5f58166969ee792535304f71627f60920813d42f47e30ee420e7151c9d41` |
| `units/neutral_gauntletmaster.plist` | `app/resources/units/neutral_gauntletmaster.plist` | `8efe6359f5625e0a5d17a38785d51e7d608ae4e6809f773855036fe1c2f967c1` |
| `units/neutral_gauntletmaster.png` | `app/original_resources/units/neutral_gauntletmaster.png` | `241327e972a1336eaa82d2554657a4e5fbf108c9c8a17b757dc82ba799fec496` |
| `units/neutral_golem_crossbones.plist` | `app/resources/units/neutral_golem_crossbones.plist` | `8c3978e5e2c7a433dbb22f7ad5cf112e79cb358ba2a7eabc9dee1b210676e789` |
| `units/neutral_golem_crossbones.png` | `app/original_resources/units/neutral_golem_crossbones.png` | `eac348fa8fa8d2fb1864fe8ab543a715fa2564a1ef931257342f17e29dc6924f` |
| `units/neutral_golemice.plist` | `app/resources/units/neutral_golemice.plist` | `8bd8cd03c4327f7d7a3d631c1695502cf2c52294933611f861ed69e9e73ef0ef` |
| `units/neutral_golemice.png` | `app/original_resources/units/neutral_golemice.png` | `3dc8cd34889f9fd57aa60207cc602b7ac421de68a4f9222a890aa34a4cce7ccb` |
| `units/neutral_golemnature.plist` | `app/resources/units/neutral_golemnature.plist` | `05731010e6e4b20198aa2e0889429d758b14ea91da64198818316c0edbd968a3` |
| `units/neutral_golemnature.png` | `app/original_resources/units/neutral_golemnature.png` | `ef3f1bd2b1ae0fb15eba4b67f893482acf09cf9f50d0db44604d8ad8794d9168` |
| `units/neutral_golemstormmetal.plist` | `app/resources/units/neutral_golemstormmetal.plist` | `8229081092e943f7828c79b48c49114db53dc0d833a08146bf95cd474f65db38` |
| `units/neutral_golemstormmetal.png` | `app/original_resources/units/neutral_golemstormmetal.png` | `dddb4ba7d06b589b06a9726df694caa88725dad9225a55624d17c0ed0ab4404e` |
| `units/neutral_healingmystic.plist` | `app/resources/units/neutral_healingmystic.plist` | `c671a984b03d267bc482cb632afbc6e7f4eba7cd3a3c18f78b87ad44aec817f3` |
| `units/neutral_healingmystic.png` | `app/original_resources/units/neutral_healingmystic.png` | `b717b3bdd6a43c1a6f1781939b28ebe36f21e1328545ae31cd6da23e9097d190` |
| `units/neutral_luxignis.plist` | `app/resources/units/neutral_luxignis.plist` | `278679cad5aab8ed1a8a08453c2e17a507f6bc1fb114874d3b47195b82cad5a9` |
| `units/neutral_luxignis.png` | `app/original_resources/units/neutral_luxignis.png` | `f58f13920010e7abd9d856b6e942a50c86db38aa68205953b336302a2b02b432` |
| `units/neutral_maw.plist` | `app/resources/units/neutral_maw.plist` | `879ca1caa7647b5e3038fe27f342ef00bdbbc7d46116cc33a476fe7dc6a8c9ab` |
| `units/neutral_maw.png` | `app/original_resources/units/neutral_maw.png` | `1cef0e078fdd50bdae8553151cd2641bbcd76f241e32638c67ab8962d6a9e8d2` |
| `units/neutral_mechaz0rsuper.plist` | `app/resources/units/neutral_mechaz0rsuper.plist` | `3b9f118a2aa85518d06eb3b5376220a10dc8a1b101426943eb1e97ddd9e12edf` |
| `units/neutral_mechaz0rsuper.png` | `app/original_resources/units/neutral_mechaz0rsuper.png` | `8b95972a120f50aa05965c0a5423f9bc6d5b9fcea87a279ce2240e67faf3f1fa` |
| `units/neutral_mercarcanelimiter.plist` | `app/resources/units/neutral_mercarcanelimiter.plist` | `ba007823295a19f57aec007c4b196b0fb9ee44e74ea9d3dc56df550230247214` |
| `units/neutral_mercarcanelimiter.png` | `app/original_resources/units/neutral_mercarcanelimiter.png` | `5d73b951c3a53a295b73fe85eeea1546584d024de6fbba76e6efe101596eb945` |
| `units/neutral_mercazurehorn.plist` | `app/resources/units/neutral_mercazurehorn.plist` | `887a5c581281a5211b8d4e6c224f03eeb0fe9765ea8963ca62454e1d95734b29` |
| `units/neutral_mercazurehorn.png` | `app/original_resources/units/neutral_mercazurehorn.png` | `011c408b1a56d983eb3802ca5f6af11461bf54049c24bbc23ebbcdabd64e1ecf` |
| `units/neutral_mercdaggerkiri.plist` | `app/resources/units/neutral_mercdaggerkiri.plist` | `142fd2a3411d20f0667d253867a4ad60566f95646eae3d54ef3510e21964d4d2` |
| `units/neutral_mercdaggerkiri.png` | `app/original_resources/units/neutral_mercdaggerkiri.png` | `a4d1192c5eaea111832082a517c0453bce6228172e93f6c45b77d196655f3aab` |
| `units/neutral_mercfrostbonenaga.plist` | `app/resources/units/neutral_mercfrostbonenaga.plist` | `d83bccd62647c2f6aa89026b9396263bfe5e4cb4035276721c507a1222eacd33` |
| `units/neutral_mercfrostbonenaga.png` | `app/original_resources/units/neutral_mercfrostbonenaga.png` | `b13024cc4dca783298cfeba92d945d1b6f8c8b97139f959b6510c180f6f1506a` |
| `units/neutral_mercgambitgirl.plist` | `app/resources/units/neutral_mercgambitgirl.plist` | `95c98570f273953e67be9b0506a04c8435cad0a3937fcdf28819e487406458a5` |
| `units/neutral_mercgambitgirl.png` | `app/original_resources/units/neutral_mercgambitgirl.png` | `68994c85e506ae5f5a705c4c3e9944ba55b71108aabdecbbb6c66f651d394cf5` |
| `units/neutral_mercgrenadier.plist` | `app/resources/units/neutral_mercgrenadier.plist` | `07c56d7bd42c6c43a9859f80808b715f7212c9fdb52e7da25cc2cd18723599a3` |
| `units/neutral_mercgrenadier.png` | `app/original_resources/units/neutral_mercgrenadier.png` | `37d739768205ff4c46170fef0435fcb31c2f9040a3ddbc9450ef51323e7a0669` |
| `units/neutral_mercmelee3.plist` | `app/resources/units/neutral_mercmelee3.plist` | `c503a86bdf605e99ae49c22086d5776137985afdd793e4ee32ee204ed69d8685` |
| `units/neutral_mercmelee3.png` | `app/original_resources/units/neutral_mercmelee3.png` | `f151b60495bd1acc50aab4d75950cb2402a1ab2817915355e289807428dee8a6` |
| `units/neutral_mercsunseer.plist` | `app/resources/units/neutral_mercsunseer.plist` | `c68e2f3004991c34bdbbf5cb3a9f4b3050aea352ed7b41c5a63a0952343a31b7` |
| `units/neutral_mercsunseer.png` | `app/original_resources/units/neutral_mercsunseer.png` | `4ac8f734ee2383a6d1be5beb68388153791e59ac088148beb999b7c7537e683d` |
| `units/neutral_mercswornavanger.plist` | `app/resources/units/neutral_mercswornavanger.plist` | `c16933988ecf0f3d5573bc4ee9b63fb1b1808fb226601722753ece1881198221` |
| `units/neutral_mercswornavanger.png` | `app/original_resources/units/neutral_mercswornavanger.png` | `4eb1da9b4fe2fe3e6671bb15bcd8504f69d0dbe8d2905cb4374b7257f972fd95` |
| `units/neutral_monstercrystalwisp.plist` | `app/resources/units/neutral_monstercrystalwisp.plist` | `39499807ca4856952d1afe30c7a28cb578e79b1357d6c16c7519a8abeb881bec` |
| `units/neutral_monstercrystalwisp.png` | `app/original_resources/units/neutral_monstercrystalwisp.png` | `a3c12e51bc6f39644d9645d05ae20718732f63ceedf6823a70e9fed1d6be946b` |
| `units/neutral_monsterdancingblades.plist` | `app/resources/units/neutral_monsterdancingblades.plist` | `7bc70704c6f94add4404dadaf21c7332d6ba033336f35b56d3a11b95c67631c0` |
| `units/neutral_monsterdancingblades.png` | `app/original_resources/units/neutral_monsterdancingblades.png` | `479c2a8bbef6931ea5bdf8bc847e7f357e1ff4eca8d4586dd385ddefb4855b12` |
| `units/neutral_monsterdragonhawk.plist` | `app/resources/units/neutral_monsterdragonhawk.plist` | `3b2902d10fb3c10c6e75ae8a413e69dee5d52be3b5a1f15f2892ccdb6149927b` |
| `units/neutral_monsterdragonhawk.png` | `app/original_resources/units/neutral_monsterdragonhawk.png` | `3cefa91939458bb38216eaf987237fcfb012a4830f3c89750bf582d5074ea9b4` |
| `units/neutral_monsterdreamoracle.plist` | `app/resources/units/neutral_monsterdreamoracle.plist` | `30fd53b727702d990f0caa97490fe8f7ed3ff731d9059441340c58f2e6dea9d0` |
| `units/neutral_monsterdreamoracle.png` | `app/original_resources/units/neutral_monsterdreamoracle.png` | `7d84753e80e26f80fe9b631bd5e4adf0f741572569cabc1ee199fd3ec361fafb` |
| `units/neutral_monsterexplodingdemon.plist` | `app/resources/units/neutral_monsterexplodingdemon.plist` | `57afb881db0e718e28c523280d4d2ab178587d985a3944c6f6c926d43450184d` |
| `units/neutral_monsterexplodingdemon.png` | `app/original_resources/units/neutral_monsterexplodingdemon.png` | `654f3e81f549a50e4bc8ec72a3489d0e775a836596092ef84d4b40af93f25790` |
| `units/neutral_monsterflamewing.plist` | `app/resources/units/neutral_monsterflamewing.plist` | `de3b7020a5546d362063b2abf980f78f9e2633f3fbe99e4df3f8ae3b08827b42` |
| `units/neutral_monsterflamewing.png` | `app/original_resources/units/neutral_monsterflamewing.png` | `5725809be794e5d18184c404ec9542ea55153dca1a7b784a721265796f2e69b6` |
| `units/neutral_monsterputridmindflayer.plist` | `app/resources/units/neutral_monsterputridmindflayer.plist` | `3da01d8322180499a9c6da0004011b348e8f70696919c8798ab46d05a958ab98` |
| `units/neutral_monsterputridmindflayer.png` | `app/original_resources/units/neutral_monsterputridmindflayer.png` | `6c157ba8e0a48b281c602c08478e02aa500636cb52743f52486727aca96f8ef9` |
| `units/neutral_monstershreddingmantis.plist` | `app/resources/units/neutral_monstershreddingmantis.plist` | `906ca84a62025a807a8563e3561afff9c870cecd22e50c340e94932d00771e03` |
| `units/neutral_monstershreddingmantis.png` | `app/original_resources/units/neutral_monstershreddingmantis.png` | `eb9315f5b987588976fe923b462ce8f257abdd8c9c69bcaaf796dcb2f99c7872` |
| `units/neutral_primusshieldmaster.plist` | `app/resources/units/neutral_primusshieldmaster.plist` | `445b3ffa4d87dfba5b1c5e9e729ef5e165b23479a48c6cbff1d6b72a87b3a29d` |
| `units/neutral_primusshieldmaster.png` | `app/original_resources/units/neutral_primusshieldmaster.png` | `61734e40e01e50296136d701b4238289fda7cb79cf7d1a3a8d05fd9af8ed32dc` |
| `units/neutral_rejuvenator.plist` | `app/resources/units/neutral_rejuvenator.plist` | `368f8eb8f43ad81acd5b3e20f839e0db502da01ae5f28bfaec0b227aea77b074` |
| `units/neutral_rejuvenator.png` | `app/original_resources/units/neutral_rejuvenator.png` | `c9e1f693dd2c5c1cc6fe9185af1c6b7858135f777acb353f4099302755916a44` |
| `units/neutral_serpenti.plist` | `app/resources/units/neutral_serpenti.plist` | `0e53840757c1bbe2cf1f3c193e4c54c257ccfbf60c32bca0e5251768814e510b` |
| `units/neutral_serpenti.png` | `app/original_resources/units/neutral_serpenti.png` | `1b933bd75b966cf66adf43ffef2493ccbfe71e09367964ac9e814a47fb2e2243` |
| `units/neutral_shadow1.plist` | `app/resources/units/neutral_shadow1.plist` | `9c4fc38a627110485b26397ab04d3ef24cda414992c6a1d236b97c6d25cd1cd2` |
| `units/neutral_shadow1.png` | `app/original_resources/units/neutral_shadow1.png` | `6470ce2f61cf982c220687c75befdbe6652621a76bcdf41a29cc40c50640eeb3` |
| `units/neutral_sunsetparagon.plist` | `app/resources/units/neutral_sunsetparagon.plist` | `5ad6167c3e13012fde5357e317b5bbdfa7633222c647047668cf3ef1e3107151` |
| `units/neutral_sunsetparagon.png` | `app/original_resources/units/neutral_sunsetparagon.png` | `e224591eb5e3b12b3d2256ddb22123b05c34cc668b25ab08d4275758ed1fb011` |
| `units/neutral_swordofakrane.plist` | `app/resources/units/neutral_swordofakrane.plist` | `7b766152db7da21eb26e0e57af02c2608fabb03be9aa388a9910dce185cb1fc0` |
| `units/neutral_swordofakrane.png` | `app/original_resources/units/neutral_swordofakrane.png` | `3dba5e97caa5556bbf58afe7e4dad255ddba6f94395a1c1436602004bc5ce3be` |
| `units/neutral_tribalranged1.plist` | `app/resources/units/neutral_tribalranged1.plist` | `9dc21ed8dd8841c050d4820a527322716d7354158bcb867d2e76240383d544d8` |
| `units/neutral_tribalranged1.png` | `app/original_resources/units/neutral_tribalranged1.png` | `314c6db6d0e28d7eadb77dc29b64ce751f21e84ad8b15a7cf34c4e13777590db` |
| `units/neutral_voidhunter.plist` | `app/resources/units/neutral_voidhunter.plist` | `fcc66abd3f7a1208a21547b284fa3a6916fe7bd681239524ee1c445248702ab3` |
| `units/neutral_voidhunter.png` | `app/original_resources/units/neutral_voidhunter.png` | `1fadc8957c23cda28acc64fba8cf3de33f0aaa90ffba3f638ba8f9576225796b` |
| `units/neutral_wartalon.plist` | `app/resources/units/neutral_wartalon.plist` | `b73a158fbb7188c7173576f34affa28efe1e9db3b0a20097465262af38394548` |
| `units/neutral_wartalon.png` | `app/original_resources/units/neutral_wartalon.png` | `fe1848533c0c6adf1414700cd5b8a8dccc151d664afacb1ca04b130bc7745af0` |
| `units/neutral_zenrui.plist` | `app/resources/units/neutral_zenrui.plist` | `02a594de07821f7fecf7b28605142f163acc5d044987b89b2dc9d3bc9b0051e4` |
| `units/neutral_zenrui.png` | `app/original_resources/units/neutral_zenrui.png` | `4a3753964ebbda9f6640e51cedd8aa2c9dbed71bb1e0724156a74070aff94b71` |

<!-- sync-effects:end -->

## 商店宣传素材（不进入游戏运行资源）

2026-10-11 英雄宣传图采用原库 `app/original_resources/generals/general_f1@2x.png`、`general_f4@2x.png`、`general_f6@2x.png`，配合 `scenes/load/scene_load_background.jpg` 与 `ui/brand_duelyst@2x.png`，通过内置 imagegen 合成。原库未修改；产物、完整提示词及处理记录见 `../../platform/store-materials.md`。该图为宣传合成图；真实截图和玩法录屏另外从当前 H5 实际操作捕获。

## 战斗底部操作区原版素材

直接复制原库；主将技能图标按当前主将切换，按钮和概览框复用原版 UI 纹理。

| 运行资源 | 原库相对路径 | SHA256 |
| --- | --- | --- |
| `ui/generalspell_f1_afterglow.png` | `app/resources/icons/generalspell_f1_afterglow.png` | `aac23082b4a748f509d4b089e0ea5fae96c5790e18c7f8b1353d3462a526edb4` |
| `ui/generalspell_f1_roar.png` | `app/resources/icons/generalspell_f1_roar.png` | `008e220c1583cc3fe5c40c12f2bd045b2da6b1fd182f7460c51666cc97f3f1b1` |
| `ui/generalspell_f2_blink.png` | `app/resources/icons/generalspell_f2_blink.png` | `bbb46c2682fa15093d3d0300f8058bc34e60c1571eeceba307a7cbd0e64345c5` |
| `ui/generalspell_f2_twilightsurge.png` | `app/resources/icons/generalspell_f2_twilightsurge.png` | `36778240e5f21e5350dde788480e2399579d4cdad8c81f0b1089ee5c6dde8550` |
| `ui/generalspell_f3_psionicrecall.png` | `app/resources/icons/generalspell_f3_psionicrecall.png` | `5feb9c0428e68dc9bd35887b1330169a9a4ebbfe46930b5f00a16f16b31ab4d0` |
| `ui/generalspell_f3_windshroud.png` | `app/original_resources/icons/generalspell_f3_windshroud.png` | `8881a4717c48af8b4ae6d8a3ee4421f5d07eca75cb2c1fa0446161f2d6bc3327` |
| `ui/generalspell_f4_shadowspawn.png` | `app/resources/icons/generalspell_f4_shadowspawn.png` | `91c79414d653a0c5b86e84db116727e6540c4d28a7af9a352cabd84d50bd0e93` |
| `ui/generalspell_f4_taint.png` | `app/resources/icons/generalspell_f4_taint.png` | `6bb0d88f746a0ceef873561ff38ffaa9179bf8ab910593fce771cb4b0b0e1ca7` |
| `ui/generalspell_f5_overload.png` | `app/resources/icons/generalspell_f5_overload.png` | `7a7e7e67079908b30e947ae3924a0491ff0baa1b56c4e93302ce18d68912a2a6` |
| `ui/generalspell_f5_seekingeye.png` | `app/resources/icons/generalspell_f5_seekingeye.png` | `d99fad312d8afb8eed40843b9402684b684d2b39e7ba73653ed00f703feb3cdd` |
| `ui/generalspell_f6_kinectcoil.png` | `app/resources/icons/generalspell_f6_kinectcoil.png` | `5f6b84f9875cac925ae6bb2dda0d583a6678e812799399275bbd09034047ba55` |
| `ui/generalspell_f6_warbird.png` | `app/resources/icons/generalspell_f6_warbird.png` | `9fea70071acefdbddf98027d44240cf18a6f66f5ed6d898bcab85562f09b45e1` |
| `ui/button-secondary.png` | `app/original_resources/ui/button_secondary.png` | `60738627b8f528d9bbd588b53e7c934c7d9be746cdbe4a939de0d84b9fe3865c` |
| `ui/overview-frame.png` | `app/original_resources/ui/artifact_frame.png` | `b479125d3c2597a16f9cfd20d6191029d415b8c99dfdb78d8d79ed250a845e3c` |
| `ui/generalspell_f1_afterglow.plist` | `app/resources/icons/generalspell_f1_afterglow.plist` | `ab51575e04b17cc0ab4c8b4ba23b3952c4d25b450f790135585742e48f3d9851` |
| `ui/generalspell_f1_roar.plist` | `app/resources/icons/generalspell_f1_roar.plist` | `b7ce4358f479528a71999c0eb92990bba905093c886dbf1cfc37e0b3750be23e` |
| `ui/generalspell_f2_blink.plist` | `app/resources/icons/generalspell_f2_blink.plist` | `92c28a640b3774768eb22fec07c4f36427d51c56a0e05d8c971376b38bd3d80c` |
| `ui/generalspell_f2_twilightsurge.plist` | `app/resources/icons/generalspell_f2_twilightsurge.plist` | `51d68b48b8378668a726101a5e3512aa7f95017810c57cf42ce1ddbaf6bf5171` |
| `ui/generalspell_f3_psionicrecall.plist` | `app/resources/icons/generalspell_f3_psionicrecall.plist` | `7f816e44aa3fff747f3507257c404a8ac3f5110f185eb32a03c92aada4766843` |
| `ui/generalspell_f4_shadowspawn.plist` | `app/resources/icons/generalspell_f4_shadowspawn.plist` | `06a601df6bdb7f46b738376903cc840b59455fea2027d2d0293afef02f9456bf` |
| `ui/generalspell_f4_taint.plist` | `app/resources/icons/generalspell_f4_taint.plist` | `d387802bb517d653339ef60ed328356602d1abf30f076a45d5e7098e270aeec8` |
| `ui/generalspell_f5_overload.plist` | `app/resources/icons/generalspell_f5_overload.plist` | `a5b9581270dae65595ebf7d24082aa31efbe36b6aea38a1bb9766d1fb26f8500` |
| `ui/generalspell_f5_seekingeye.plist` | `app/resources/icons/generalspell_f5_seekingeye.plist` | `7f998ecdad48703c1c69ea7f80e51aa79c809648e81bae3541168defeed1645f` |
| `ui/generalspell_f6_kinectcoil.plist` | `app/resources/icons/generalspell_f6_kinectcoil.plist` | `1b795786c6760668ce68070498fbee1708b6b2fd80a7eea62f0083951866163e` |
| `ui/generalspell_f6_warbird.plist` | `app/resources/icons/generalspell_f6_warbird.plist` | `49b0f498a09aa71301b1dece4247f5d8345714b019517dc56232a7e72f83ceb2` |
| `ui/generalspell_f3_windshroud2.png` | `app/resources/icons/generalspell_f3_windshroud2.png` | `3fa50a06727bd976c34662b38c6925197b17fa527cb6a43e4fe265ad4c704931` |
| `ui/generalspell_f3_windshroud2.plist` | `app/resources/icons/generalspell_f3_windshroud2.plist` | `7f15a14d69242b37318cb868dcdec7a913593dd42503b04652152a75b57820a4` |

## 局外语义图标（2026-10-11）

图鉴、培养与大卡词条使用用户授权的 my-team SVG；逐文件来源见 [ui/keywords/SOURCES.md](ui/keywords/SOURCES.md)。图标形状与语义配色复用，解释按本作回合制规则重写。原项目只读，棋盘攻血图标仍使用原版 Duelyst 资源。

## 固定战役中立内容（2026-10-12）

用户已授权的只读源库为 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main`。基础数值与机制取自 `app/sdk/cards/factory/core/neutral.coffee`（SHA256：`5A0C30650DD20B96F9F29DC15FC564B7901AA9005DF0014B338B561EB9870A43`，源库无可读Git提交）。中文名为本地项目用名，不声称官方译名。

| ID / 原名 | 素材名 | 费用 / 攻击 / 生命 | 本作规则与适配 |
| --- | --- | --- | --- |
| 10021 Vale Hunter | neutral_tribalranged1 | 2 / 1 / 2 | 远程 |
| 19027 Primus Shieldmaster | neutral_primusshieldmaster | 4 / 3 / 6 | 嘲讽 |
| 10981 Healing Mystic | neutral_healingmystic | 2 / 2 / 3 | 登场治疗2；原作手动选择任意单位，本作自动治疗缺血最多友军，含主将、同缺血取最早入场 |
| 10019 Planar Scout | neutral_beastphasehound | 1 / 2 / 1 | 空投 |
| 19037 Primus Fist | neutral_gauntletmaster | 2 / 2 / 3 | 登场邻接随从本回合+2攻击；原作手动选择，本作选择最早入场的合格友军 |
| 10012 Saberspine Tiger | neutral_beastsaberspinetiger | 4 / 3 / 2 | 突袭，登场立即可行动 |
| 19050 Azure Horn Shaman | neutral_mercazurehorn | 2 / 1 / 4 | 亡愿使邻接友方随从当前生命和上限+4 |

图集来自 `app/original_resources/units` 与 `app/resources/units`，音效、攻击、死亡与召唤配方由 `tools/sync-effects.mjs` 提取。逐文件哈希沿用生成的素材审计，源库保持不变。协防/游击/战地救护专精、法术强化与战术式、解锁节点、出战供应及敌军成长均为本作设计，不冒充Duelyst原作规则。复杂驱散的Ephemeral Shroud未纳入本版。


## 主菜单资源与招募宝珠（2026-10-12）

源库：`C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main`，用户已授权，按原文件复制且源库只读。

| 本地文件（dist/assets/） | 源文件（app/resources/） | SHA256 |
| --- | --- | --- |
| metagame/original/resource-gold.png | ui/icon_gold@2x.png | FE35E47DF6183881D1C7ABAA12F27C986D6BDD4F47B49890CEC296D5E799FDD7 |
| metagame/original/spirit-orb.png | booster_pack_opening/booster_orb.png | B39B7AF4624371E98F3D63C42705C0EE5CEBB22EFD0E01E69EF20B9BB44170CD |

原作名称与用途见 `app/localization/locales/en/common.json` 的 `spirit_orb` 和 `rewards.json` 的 `spirit_orb_reward_info`：Spirit Orb 用于获得新随从和法术。本项目译作「灵魂宝珠」，不是声称官方中文；抽碎片再合成为本作适配，未引入原作 Spirit 合成货币，也未更改现有奖励数量。

## 卡牌射程徽记（2026-10-14）

`ui/icon-attack-range.svg`为本项目手工编写的矢量素材：暗色实体金属底、暖铜色瞄准刻度，数字由界面实时叠加。未使用第三方图标库。费用徽记复用已授权Duelyst原版`ui/icon-mana.png`；没有修改源素材库。

## 主菜单音乐（2026-10-14）

《Legionnaire (2022 Remaster)》由 Scott Buckley 创作，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。

> 'Legionnaire' by Scott Buckley – released under CC-BY 4.0. www.scottbuckley.com.au

[作者曲目页](https://www.scottbuckley.com.au/library/legionnaire-2022/)；[官方 Full Mix MP3](https://www.scottbuckley.com.au/library/wp-content/uploads/2022/04/sb_legionnaire2022.mp3)；[作者使用说明](https://www.scottbuckley.com.au/library/using-this-music/)。本地 `music/legionnaire-menu.mp3` 保留整曲，转码为 128kbps / 44.1kHz 立体声；交互播放的循环与音量淡变不改变作者归属。详细原件/输出 SHA256 与参数见 `platform/content-expansion-20261014/music/sources.json`。原版 Full Mix 不随游戏分发；游戏音乐信息入口提供署名和许可。不得登记 Content ID。

## 0.4.0 卡池扩充资源（2026-10-14）

复用上述用户授权的只读 OpenDuelyst 1.97.13 源库，本轮新增43单位、23法术和3衍生物的卡面、单位动作、局部特效与原声。逐卡原文件、位置、机制与必要适配见 `output/content-expansion/card-plan.json`；当前生成器 `tools/sync-effects.mjs` 的逐文件hash审计、172卡渲染记录见 `output/content-expansion/assets/`。本次生成163特效配方、124身体资源，944项来源资源经过hash核对。新增沙魔/冰灵种族保留原关系；正式规则以当前冻结卡及version为准，不覆盖旧局。前文2026-10-12未接入的虚影帷幕（Ephemeral Shroud）已于后续版本接入，历史说明不代表当前150张可入组卡范围。


## 按钮家族（2026-10-14）

`ui/button-family/{slate,gold,cyan,red,disabled,back}.svg` 是本项目原生编写的切角材质高光层，配合已有 `ui/generated/slate-panel.webp` 与实体填充实现。设计依据为用户认可的内置 image_gen 预览 `output/button-design-preview/button-family-v1.png`，预览不作为实机截图或按钮文字背景。来源与设计记录见 `output/button-design-preview/design-notes.md`。


## 招募专属扩充（2026-10-14）

新增18位招募专属，使用用户已授权的原版Duelyst 1.97.13本地源素材；新增509冰龙、516树人仅为机制衍生token。费用、攻血与完整能力来自原factory，逐位原文与资源路径见 `output/recruitment-expansion/card-plan.json`；同步20套动画body及源音效的SHA256记录见上方既有同步表与 `.unit-fx-audit.json`。没有使用外部下载、生成图或外观映射。

10973光之守望保留原版5费2/5与附近随从治疗2；原版无限远程按本项目统一有限射程适配为4格。此为H5适配，不能称为原版射程。原102单位的关卡获取不变，18新单位只由招募获取；衍生token不进入收藏或奖池。


## 卡面材质与稀有度（2026-10-14）

`ui/card-inspect-v2.webp` 为内置image_gen生成的空白专用卡面：钢蓝切角金属、黄铜镶边与浅色纸面；用户认可底图后要求六阵营配色与培养等级/稀有度。主图不烘焙文字、数值或统计图标，原件保留在 `output/card-ui-v2/frame-master.png`，完整提示词、生产缩放/编码与SHA256见 `output/card-ui-v2/asset-source.json`。

`ui/rarity/{common,rare,epic,legendary}.png` 复用上述用户授权只读源库原版 `app/original_resources/ui/collection_card_rarity_*@2x.png`；稀有度逐卡按factory/default与rarityFactory核实，不按攻血/费用推断，见 `output/card-ui-v2/rarity-audit.json`。此为显示元数据，不改变掉落概率、原战局数值与存档。


## 招募揭晓与翻倍弹窗光效（2026-10-15）

复用已获商用授权的本地 Duelyst 原素材，未修改源素材。宝珠、光盘和粒子贴图用于保存成功后的抽取揭晓与翻倍到账表现；动画不参与奖励计算。

| 文件 | 原来源 | SHA-256 |
| --- | --- | --- |
| `recruitment-fx/booster_orb.png` | `app/resources/booster_pack_opening/booster_orb.png` | `b39b7af4624371e98f3d63c42705c0ee5cebb22efd0e01e69ef20b9bb44170cd` |
| `recruitment-fx/booster_glowing_disc.png` | `app/resources/booster_pack_opening/booster_glowing_disc.png` | `0c1d0df8130b9cdd67cb06cd5127fcbfb7f9bcad310424f115689ebab869bd21` |
| `recruitment-fx/explosion_particles.png` | `app/resources/booster_pack_opening/explosion_particles.png` | `b1d73edca8d00ebb34e49fa5a94856c138a41ebab480ba5932b390ab964b1e62` |
| `recruitment-fx/spiral_assemble_for_booster.png` | `app/resources/booster_pack_opening/spiral_assemble_for_booster.png` | `7b70a9f1389285169f87c7933aabb6bb30e9931cbc12e2367bf54ed8ff900306` |


## 主页随机背景池（2026-10-15）

复用用户已授权商用的本地 Duelyst 原素材。精确采用 `output/duelyst-background-gallery/manifest.json` 编号1–6及24–47，共6张场景与24张章节图。源库保持只读，逐项核对原件SHA256后转换。主页每次启动抽取的背景池使用这些输出，旧 `metagame/original/menu-frostfire.jpg` 保留为历史资源。

处理参数：Pillow 12.3.0，RGB（存在透明通道时RGBA），WebP quality=85、method=6；超过1600px宽时按比例缩小，LANCZOS重采样，高度四舍五入到整像素；不放大小图、不裁剪。下表SHA256对应实际输出文件。

| 图库编号 | 输出文件（dist/assets/） | 原来源 | 原始尺寸 → 输出尺寸 | 字节数 | 输出SHA256 |
| --- | --- | --- | --- | ---: | --- |
| 1 | `home-backgrounds/scene-frostfire.webp` | `app/original_resources/scenes/frostfire/background.jpg` | 1964×1080 → 1600×880 | 126862 | `c673cd5af6d8f2141500303dc772e6291e32cd80873e791ad85465a2d15aa9a0` |
| 2 | `home-backgrounds/scene-obsidian-woods.webp` | `app/original_resources/scenes/obsidian_woods/obsidian_woods_background.jpg` | 1920×1056 → 1600×880 | 114034 | `ebe51190d8d78ecb420b367900a8586be1561a20e306c382d119615e62002b5c` |
| 3 | `home-backgrounds/scene-magaari-ember-highlands.webp` | `app/original_resources/scenes/magaari_ember_highlands/magaari_ember_highlands_background.jpg` | 1920×1056 → 1600×880 | 146396 | `e3be011107dfbd3fe79bce744d1ce11603fa82d87f7deefcac659f45109f69bb` |
| 4 | `home-backgrounds/scene-shimzar.webp` | `app/original_resources/scenes/shimzar/bg.jpg` | 1964×1080 → 1600×880 | 64642 | `8ef7e90f282ec742aa3b5db902af9f64a5de3b08f4bdbd6f14ac1bfa4ab53ded` |
| 5 | `home-backgrounds/scene-vetruvian.webp` | `app/original_resources/scenes/vetruvian/bg.jpg` | 1920×1056 → 1600×880 | 64306 | `3565b16ffac9725e1c18e873e50176517d397fac27ab9171f60603011017bc42` |
| 6 | `home-backgrounds/scene-load.webp` | `app/original_resources/scenes/load/scene_load_background.jpg` | 2500×1250 → 1600×800 | 84240 | `4cb7a2e761eb0ba58bfabe75f48d2ee921732b90b0f63c536d58c9529597571b` |
| 24 | `home-backgrounds/story-01.webp` | `app/original_resources/codex/chapter1_background.jpg` | 1280×720 → 1280×720 | 60164 | `1d5abe89bb06672c2dc03ba5f3e837ba4202f842781713ec07fe901cbac1a5a5` |
| 25 | `home-backgrounds/story-02.webp` | `app/original_resources/codex/chapter2_background.jpg` | 1280×720 → 1280×720 | 95528 | `142e79bfbfde506409053984690c08e0b1a981f41bd06a7364c7962aecafdef1` |
| 26 | `home-backgrounds/story-03.webp` | `app/original_resources/codex/chapter3_background.jpg` | 1280×720 → 1280×720 | 178878 | `3d4e8c0ecf063274de1e39edc584d314d26581b635e669c428b3ed1840e9986f` |
| 27 | `home-backgrounds/story-04.webp` | `app/original_resources/codex/chapter4_background.jpg` | 1280×720 → 1280×720 | 139868 | `639b83f2d9c967f4b9bf3ac4887c7a10f0c65d23e3e75bafb02ebd1e4885c89e` |
| 28 | `home-backgrounds/story-05.webp` | `app/original_resources/codex/chapter5_background.jpg` | 1280×720 → 1280×720 | 112592 | `602136476dcb0644ffe85a74df3c4b4cd31e66709a62527661aac91c38986656` |
| 29 | `home-backgrounds/story-06.webp` | `app/original_resources/codex/chapter6_background.jpg` | 1280×576 → 1280×576 | 82048 | `54ffa751bc1db090325903ad304d5a86bee9d46ba009b6836de69a09203182aa` |
| 30 | `home-backgrounds/story-07.webp` | `app/original_resources/codex/chapter7_background.jpg` | 1280×576 → 1280×576 | 52796 | `c10f2ee6f2eb9abeda94634093ce88327a23a2230c649c8475bdc77720a12e7f` |
| 31 | `home-backgrounds/story-08.webp` | `app/original_resources/codex/chapter8_background.jpg` | 1280×576 → 1280×576 | 68100 | `1133abd293982556ab0137886a98972bf259e237febbcd0d3919e7d98a6138fe` |
| 32 | `home-backgrounds/story-09.webp` | `app/original_resources/codex/chapter9_background.jpg` | 1280×576 → 1280×576 | 59380 | `1b6a870a85d031c74668a9d2b9f5dbec3b66bf250930fb6fde0ebc06fb5bd1b9` |
| 33 | `home-backgrounds/story-10.webp` | `app/original_resources/codex/chapter10_background.jpg` | 1280×576 → 1280×576 | 97316 | `b651a5f04e6c3d757cc2be0c0a853650a0d6f99f0a80093e9d35e5680b37ee26` |
| 34 | `home-backgrounds/story-11.webp` | `app/original_resources/codex/chapter11_background.jpg` | 1280×576 → 1280×576 | 89192 | `5e6b66dc58cc394661f9af33074bc9c85b123c1227e531913963984e0af36ceb` |
| 35 | `home-backgrounds/story-12.webp` | `app/original_resources/codex/chapter12_background.jpg` | 1280×576 → 1280×576 | 74272 | `9d4145dc65d0526cef45467920a09e286d1f3a0f02d433b7b0ac343e312bba53` |
| 36 | `home-backgrounds/story-13.webp` | `app/original_resources/codex/chapter13_background.jpg` | 1280×576 → 1280×576 | 94124 | `809fc0874c985af7dc3edef69c8902e2bd77da0ff6e6631c9e1ca934099184a3` |
| 37 | `home-backgrounds/story-14.webp` | `app/original_resources/codex/chapter14_background.jpg` | 1280×576 → 1280×576 | 75396 | `05609cf02dfb9c4e6fe3dbd1e2cfa91103e23a7a9d3ae792b17abd55bb202626` |
| 38 | `home-backgrounds/story-15.webp` | `app/original_resources/codex/chapter15_background.jpg` | 1280×576 → 1280×576 | 72730 | `1fc448d3056c66b85d88804e307e6ee8dc4b8fab7ddb0339e210746d2199ba1f` |
| 39 | `home-backgrounds/story-16.webp` | `app/original_resources/codex/chapter16_background.jpg` | 1280×576 → 1280×576 | 115562 | `378ae8d0210e3c17d0b47473ec102c915b1b56be6bbd8b7ceafac22c482a7a66` |
| 40 | `home-backgrounds/story-17.webp` | `app/original_resources/codex/chapter17_background.jpg` | 1280×576 → 1280×576 | 65716 | `6fcaba2dcf875bb0b4de5c8f58dc99cfbae67d086891d9528b199fc84ee80be5` |
| 41 | `home-backgrounds/story-18.webp` | `app/original_resources/codex/chapter18_background.jpg` | 1280×576 → 1280×576 | 61310 | `bc340321ebd8e93607b831216df1b87415eb7de7d006f37e3d7a506c58e5204e` |
| 42 | `home-backgrounds/story-19.webp` | `app/original_resources/codex/chapter19_background.jpg` | 1280×576 → 1280×576 | 74948 | `81f140d6d883e512b78efb3658efefca9a4bc7dd7862195abdee9cb9d850c56a` |
| 43 | `home-backgrounds/story-20.webp` | `app/original_resources/codex/chapter20_background.jpg` | 1280×576 → 1280×576 | 74468 | `3ca17b64a896fcffff81cbc82b00444cd657becc2b10ffb0966b137a0a41dd3d` |
| 44 | `home-backgrounds/story-21.webp` | `app/original_resources/codex/chapter21_background.jpg` | 1280×576 → 1280×576 | 65810 | `c28f2eb0e0d0bf2f31592febf2552c6d59389b91f740a747ee92c499d6541775` |
| 45 | `home-backgrounds/story-22.webp` | `app/original_resources/codex/chapter22_background.jpg` | 1280×576 → 1280×576 | 60754 | `e675fdf9a05bb4c10fac92940fffcfccb911e9c0c0c63ceb513f6f153f08256f` |
| 46 | `home-backgrounds/story-23.webp` | `app/original_resources/codex/chapter23_background.jpg` | 1280×576 → 1280×576 | 94240 | `10fe0ef8070687325ebc3aa1a914e42cdb843af3f8e461f7dc18eff4ec283541` |
| 47 | `home-backgrounds/story-24.webp` | `app/original_resources/codex/chapter24_background.jpg` | 1280×576 → 1280×576 | 70730 | `4c4c1c877af26e1c5c9bbfb2985275d9fa6faad9acc7dfa0c51e9612a668b078` |

验收：30张均可完整解码，尺寸符合上述缩放规则，宽高比例误差仅为高度整数像素取整（不超过0.5像素）；总计 2,636,402 字节（2.51 MiB）。

## 2026-10-15 卡牌攻血统一标识

- `ui/card-stat-attack.svg`、`ui/card-stat-health.svg`：本项目编写的矢量素材；切角金属/珐琅填充，剑与心形浮雕，无烘焙数字，数值由实时DOM显示。
- 原 `card-backgrounds/*` 全部保留，未替换卡框、配色、人物区域。中立卡原图包含旧攻血圆槽；`ui/neutral-stat-cleanup.webp` 是内置ImageGen对原 `neutral-unit.png` 的修补结果做无损WebP编码。仅以 `ui/neutral-stat-clean-mask.svg` 的两个局部区域覆盖旧圆槽，未作为整卡背景使用。
- 修补源：`C:/Users/qs/.codex/generated_images/01a13b5a-ba2d-7640-9344-3167468524fb/exec-732b56b8-e5ac-413e-ae3a-a2bb411ded37.png`。原始资产未覆盖。


## 2026-10-15 奇兵列阵 UI 直接移植

- 用户明确确认两款游戏均为其所有，要求直接复用。来源 `games/zhenlie-demo/source/src/` 的style.css、pixel.css、ui/pixel.ts、ui/app.ts、ui/audio.ts及字体。
- 分发位置 `dist/vendor/qibing-ui/`，准确来源、原文件SHA256、适配源码和产物哈希见该目录`SOURCES.json`；字体与原像素生成算法保留。选择器、视口和音量接口为宿主适配。
- `dist/qibing-ui.css`、`dist/qibing-motion.css`及对应入口记录具体原作参数。未覆盖源工程、原卡图/卡框、阵营色及数值素材。此前生成的木皮和宝石素材保留历史文件，本轮已从index移除其样式加载。


## 试炼独立战场背景（2026-10-16）

17个固定试炼ID使用17张实际不同的原背景，显式映射见 `dist/js/trial-backgrounds.js`。原 maps 提供11套（battlemap0/1/2/3/4/5/7、abyssian、redrock、shimzar、vanar）；另6张复用已导入的 `home-backgrounds/scene-{frostfire,obsidian-woods,magaari-ember-highlands,shimzar,vetruvian,load}.webp`，来源及处理记录见上方主页随机背景池。load原件为无文字风景。battlemap6无独立背景，不作为新场景计数。

来源根目录为用户已授权商用的 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/original_resources/`，源库只读。下列新导入保留原始尺寸、构图和透明通道，不调色、不裁剪；Pillow WebP quality=85、method=6。前景缺失时映射为null；单张原前景依原位置放入foregroundLeft，battlemap7依原SDK右下锚点放入foregroundRight，不复制冒充另一层。原带glow/river的附加特效层未接入。

| 输出文件（dist/assets/） | 原来源 | 原始/输出尺寸 | 字节数 | 输出SHA256 |
| --- | --- | --- | ---: | --- |
| `maps/trials/battlemap0_background.webp` | `maps/battlemap0_background.png` | 1280×720 | 19506 | `2087f5b01173b84c3e48113a08ea7712402ecebe51ea5582ac7322db4b58e612` |
| `maps/trials/battlemap0_middleground.webp` | `maps/battlemap0_middleground.png` | 1920×1080 | 192880 | `de78767aef038fa4f5bd24738f06c847255f4f4d23c2135c81197432697e0ec0` |
| `maps/trials/battlemap0_foreground_001.webp` | `maps/battlemap0_foreground_001.png` | 562×301 | 3352 | `f878f29421ada56dd2a00dfa3b65e7add1fa032bf870cdb1fc0cbf48f96a5aaf` |
| `maps/trials/battlemap0_foreground_002.webp` | `maps/battlemap0_foreground_002.png` | 726×954 | 28724 | `65978f8f98b5ff8f049e29d74217158581b027fd305fc6d08dd66fcc274f3fb8` |
| `maps/trials/battlemap3_background.webp` | `maps/battlemap3_background.png` | 1280×720 | 36048 | `fd918b4ca0161d61de9f521385876c049d941848e9a471f393cb93e22af379a7` |
| `maps/trials/battlemap3_middleground.webp` | `maps/battlemap3_middleground.png` | 1280×720 | 171914 | `d054bc48f58ce3edc5ea95a941c266cbc2c40f2a0e296d9e0f4a7b0695dbcc80` |
| `maps/trials/battlemap3_foreground.webp` | `maps/battlemap3_foreground.png` | 281×239 | 4870 | `f20bac68914c375098c6a5c9cb44b2422d20458286829f2b0ca63f6f70ffcfb1` |
| `maps/trials/battlemap1_background.webp` | `maps/battlemap1_background.png` | 1280×720 | 60126 | `6f10f2b0490da57c5999e604f9975c3b402ae9368765cacc42b2cfd50ea97e8f` |
| `maps/trials/battlemap1_middleground.webp` | `maps/battlemap1_middleground.png` | 1536×864 | 71388 | `c4f84aae3ec1e4571d29bcae78451fd809496013325d30a5152c6321960840f0` |
| `maps/trials/battlemap2_background.webp` | `maps/battlemap2_background.png` | 1280×300 | 10480 | `26c6930084eac611fafd41c23805d85fc997638f6bf5f3094d09cac9e823dce9` |
| `maps/trials/battlemap2_middleground.webp` | `maps/battlemap2_middleground.png` | 1536×864 | 105148 | `fa37ece8c26fb2b2a8c2a2409d28b669a222105ca3a2daaf353d0edc6a4ac554` |
| `maps/trials/battlemap2_foreground_001.webp` | `maps/battlemap2_foreground_001.png` | 204×443 | 7182 | `3a81b0fad010232d237e06ff48ecef4e1cc76c4f8ea212140be69f9905f73d16` |
| `maps/trials/battlemap2_foreground_002.webp` | `maps/battlemap2_foreground_002.png` | 404×186 | 6900 | `584fe53ecd18a190aa4bde44378155df4c66c0b914f555d76281578d74f3940c` |
| `maps/trials/battlemap4_background.webp` | `maps/battlemap4_background.png` | 344×410 | 3812 | `9fc778d6bd2fe257b3db2618155e483673bde410258a182994896ce3a5c3aa4d` |
| `maps/trials/battlemap4_middleground.webp` | `maps/battlemap4_middleground.png` | 1536×864 | 112434 | `29516ad2359e94ed96f74eb3d4699c323852fffd9ebb9d3553ee10ceafcb32fe` |
| `maps/trials/battlemap4_foreground_001.webp` | `maps/battlemap4_foreground_001.png` | 257×134 | 5156 | `e52779e8a682171958b7118a03f7db8b342821bbe9ac480fd271083465893555` |
| `maps/trials/battlemap4_foreground_002.webp` | `maps/battlemap4_foreground_002.png` | 387×146 | 5804 | `bc047e711c7eaf17b4c8c23a3c439f1ab36c6ed2bc0b514c68eb6352ac6826d1` |
| `maps/trials/battlemap5_background.webp` | `maps/battlemap5_background.jpg` | 1280×720 | 130022 | `40bb530045a680f6dec40bbce77c0df255c5470f407b46d8bb70b38bc0cea1c8` |
| `maps/trials/battlemap5_middleground.webp` | `maps/battlemap5_middleground.png` | 2100×1181 | 162734 | `d0d18a121fc7b3f10d3fdb84ccecadb1f63f4dbf0f151a4032235c3a84210136` |
| `maps/trials/battlemap5_foreground_001.webp` | `maps/battlemap5_foreground_001.png` | 589×449 | 34844 | `5083ec6a9da6207223316652a41ea2755edba5af8a8dd390e88dcb8efdf54f85` |
| `maps/trials/battlemap5_foreground_002.webp` | `maps/battlemap5_foreground_002.png` | 309×250 | 9404 | `8320b91f3ea40fc4e44d23329d74b0add166dce4f960b797f7697eb77d5deed7` |
| `maps/trials/battlemap7_background.webp` | `maps/battlemap7_background.png` | 1280×720 | 67558 | `be2a36802e34ebbbc3d86a8a6de927f00e924e6b82e6b8c5b11b7ec1d32e4444` |
| `maps/trials/battlemap7_middleground.webp` | `maps/battlemap7_middleground.png` | 1920×1080 | 177424 | `44aaebf79b31a18b63c5ddcc98888c414208aeb43f2d0607f53480a9d697cd43` |
| `maps/trials/battlemap7_foreground.webp` | `maps/battlemap7_foreground.png` | 440×148 | 14538 | `519df8a236089b7276090880cc415332d5d9d68f9c1f966d8ed71631c08919c8` |
| `maps/trials/shimzar-background.webp` | `maps/shimzar/background.jpg` | 1920×1080 | 99190 | `12fd0526fabbb3f9faa804fb5a7e143b471a405f8f277a860e4a225743bda507` |
| `maps/trials/shimzar-midground.webp` | `maps/shimzar/midground.png` | 1532×991 | 102910 | `3f99cbbfeed454373c4feee6aac8f03d7e467bbbee3631b1f9e69626923cea0f` |
| `maps/trials/shimzar-foreground.webp` | `maps/shimzar/foreground.png` | 1293×943 | 125726 | `b850b3af3131e964098866b7d4ffc9f6719bbe850a86e8be1cf0623d2740fde7` |
| `maps/trials/abyssian-background.webp` | `maps/abyssian/background.jpg` | 1920×1080 | 34852 | `22a29dedfa51f51ad95b4e105250980095f1c5e1b2795990aabe314067b6deb6` |
| `maps/trials/abyssian-midground.webp` | `maps/abyssian/midground.png` | 1920×1080 | 127006 | `20612222db86d0e69d866fca3f59b05579524a909df2a7693f1ff8252ba467c6` |
| `maps/trials/redrock-background.webp` | `maps/redrock/background.jpg` | 1920×1080 | 54198 | `76c765eb9fe643c3dcd6a1de369ad1d49b413731febed2f1aaebf750c6dc38b2` |
| `maps/trials/redrock-midground.webp` | `maps/redrock/midground.png` | 1920×1080 | 218302 | `a95eb3c6d44649d98941a22a32d9bf007a75ef73a0650fcff77a63137a5f2955` |
| `maps/trials/redrock-foreground.webp` | `maps/redrock/foreground.png` | 767×1080 | 83160 | `bcf62101e2c8d7176aabb717221b4fe3f8e5d4a6d354b470a7f250a48542357a` |
| `maps/trials/vanar-background.webp` | `maps/vanar/background.jpg` | 1920×1080 | 30078 | `a4188ad61effaf21cf2eeaedfac3601b20988e039950c1edc212b74643b0be70` |
| `maps/trials/vanar-midground.webp` | `maps/vanar/midground.png` | 1920×1080 | 199426 | `143977c67e96f0217105b70f48d8087588b69195d89c3d47979fd5f1cff7aebc` |
