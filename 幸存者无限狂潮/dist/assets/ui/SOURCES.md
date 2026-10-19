# Campaign UI source manifest

## 远征场景（0.8.2，2026-10-11）

用户明确选择直接使用 Duelyst 各种背景作为远征关卡场景，撤下生成的大地图；未来新场景按这些原作的绘画风格扩展。以下源文件相对 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/`，逐字节复制，未转码、重绘或修改源库。场景构图定位配置于 `dist/journey-art.js`。

| 本地 `assets/ui/` 文件 | Duelyst 源文件 | 尺寸 | 大小 |
| --- | --- | --- | --- |
| `scenes/moss-gate.jpg` | `app/resources/scenes/shimzar/bg.jpg` | 1964×1080 | 271,510 B |
| `scenes/ember-trail.jpg` | `app/resources/scenes/frostfire/background.jpg` | 1964×1080 | 318,693 B |
| `scenes/blade-trial.jpg` | `app/resources/scenes/obsidian_woods/obsidian_woods_background.jpg` | 1920×1056 | 260,957 B |
| `scenes/swift-trial.jpg` | `app/resources/scenes/vetruvian/bg.jpg` | 1920×1056 | 173,595 B |
| `scenes/blink-trial.jpg` | `app/original_resources/scenes/load/scene_load_background.jpg` | 2500×1250 | 211,096 B |

`summoner-trial` 与 `ember-trail` 共用 `scenes/ember-trail.jpg`（`app/resources/scenes/frostfire/background.jpg`），通过不同的 `background-position` 取景；`mage-trial` 与 `blade-trial` 共用 `scenes/blade-trial.jpg`（`app/resources/scenes/obsidian_woods/obsidian_woods_background.jpg`），不保存重复副本。

任务与远征操作还复用 `duelyst-button-secondary.png` ← `app/resources/ui/button_secondary.png`，沿用上轮原版主按钮、标题饰边和头像圆框。`world-map-original.png` 原件保留供追溯，已不被客户端或0.8.2包体引用。

## 战技演武 UI（0.8.1，2026-10-11）

本轮继续使用用户已授权的 Duelyst 本地素材库，未修改源文件。以下路径相对 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/resources/`。图标从动画表左上角裁出 `48×48` 首帧，无重绘；英雄头像从当前 General 图集首帧按透明边界裁切显示，不新增角色素材。

| 本地 `assets/ui/` 文件 | 源文件 |
| --- | --- |
| `duelyst-button-primary.png` | `ui/button_primary.png` |
| `duelyst-round-border.png` | `ui/dialogue_border.png` |
| `duelyst-header-dashes.png` | `ui/icon_header_dashes.png` |
| `duelyst-panel-header.png` | `ui/diamond_main_menu_container.png` |
| `skill-dash.png` | `icons/icon_f2_juxtaposition.png` |
| `skill-cleave.png` | `icons/icon_f2_killingedge.png` |
| `skill-guard.png` | `icons/icon_f1_aegisbarrier.png` |
| `skill-sword-field.png` | `icons/icon_f2_etherealblades.png` |
| `skill-blade-wave.png` | `icons/icon_f2_twin_strike.png` |
| `skill-whirlwind.png` | `icons/icon_f2_spiraltechnique.png` |
| `skill-quick-cut.png` | `icons/icon_f2_mistwalking.png` |
| `skill-summon-guard.png` | `icons/icon_f3_azuresummoning.png` |
| `skill-recall-summons.png` | `icons/icon_f1_breathoflife.png` |
| `skill-summon-elite.png` | `icons/icon_f3_summoningstones.png` |
| `skill-mark-blade.png` | `icons/icon_f2_saberspineseal.png` |
| `skill-blink-strike.png` | `icons/icon_f2_projection.png` |
| `skill-blink-storm.png` | `icons/icon_f2_hollowvortex.png` |
| `skill-flame-breath.png` | `icons/icon_f2_phoenixfire.png` |
| `skill-rock-wall.png` | `icons/icon_f3_stonestospears.png` |
| `skill-frost-aura.png` | `icons/icon_f6_snowstorm.png` |

候选原件保留但未接入/打包：`duelyst-modal-frame.png` ← `ui/frame_modal.png`，`duelyst-roster-tile.png` ← `ui/frame_quest_challenge.png`，`duelyst-skill-panel.png` ← `ui/status_panel.png`。圆形框/遮罩不作为矩形九宫格使用。副按钮在0.8.2任务/远征页接入。0.12.0存档设置沿用矩形面板及原版按钮、标题装饰，未使用圆形modal遮罩。

These files are copied without modifying the source repository. The user confirmed commercial use permission for the Duelyst asset library on 2026-10-10.

| Local file | Original file |
| --- | --- |
| `hub.jpg` | `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/original_resources/codex/chapter9_background@2x.jpg` |
| `world-map.jpg` | `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/original_resources/codex/world_map@2x.jpg` |
| `frame.png` | `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/original_resources/ui/frame_modal@2x.png` |
| `bottom-bar.png` | `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/original_resources/ui/bottom_bar_background@2x.png` |
| `button.png` | `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/original_resources/ui/button_primary@2x.png` |
| `back.png` | `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/original_resources/ui/button_back@2x.png` |
| `gold.png` | `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/original_resources/ui/icon_gold@2x.png` |
| `materials.png` | `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/original_resources/ui/rewards/spirit_reward_spirit_icon@2x.png` |

## 原创大陆地图（2026-10-10）

历史地图（0.8.2起已撤下，保留原件）：`world-map-original.png`（1672×941）。使用内置 imagegen 生成，未使用 Duelyst 地图；Duelyst `world-map.jpg` 是旧版留档，不再被客户端或打包引用。用户否定第一张完整岛屿轮廓，当前采用辽阔大陆的局部视野，陆地向左、上、下延伸，海只占东侧局部。原始输出保留在 C:/Users/qs/.codex/generated_images/01a121cb-9a2f-7013-bee9-84334573a6b7/exec-9f63c51b-cf5a-4b71-9e84-3e7af3586710.png。

最终生成提示词：

Generate an entirely NEW original fantasy RPG world-map artwork, landscape 16:9, high resolution. Critical art direction: a cropped small portion of an IMMENSE CONTINENT, not an island, not an archipelago, not a self-contained landmass. Land must cover 90% of the entire image and CONTINUE UNBROKEN BEYOND the entire LEFT, TOP and BOTTOM frame edges. NO ocean along those three edges. Only a partial coastline and small sea bay at the extreme right edge, water at most 10%. The map should imply limitless lands continuing well beyond this window. Top-down hand-painted terrain cartography like the readability and beautiful color of Genshin Impact's world map, original geography. Massive broad connected regions, enormous distances between landmarks, no miniature diorama. A lush starting province in southwest/left-center 15-40% x, 45-75% y with tiny stone gate at (22%,65%); meandering golden foothill trail near (46%,55%); rugged inland mining range near (62%,30%); violet ruined basin near (79%,55%) connected to continental mainland, NOT surrounded by water. To northwest: colossal continuous snowy mountain chain stretching out beyond both top and left edges. To north-center: unknown expansive plateaus and long winding river systems continuing past top border. To northeast around 82%,20%: distant forest highlands continuing out of top edge, not islands. To southeast around80%,83%: immense dune desert and ancient dry riverbeds continuing out through bottom edge. Large open plains separating small localized forests; lakes and rivers at natural scale, very tiny sparse town marks and ruins to convey continental scale. Terrain drawn crisply with elegant soft contour relief, restrained jade/sage green and ochre palette, teal rivers. Reserve distant outer northern/southern lands with subtler low contrast detail suggesting unexplored potential, but no clouds hiding geography. Flat overhead map, NO horizon, NO bounded continent silhouette, NO ocean framing, NO decorative border, NO text labels, NO icons or pins, NO logos, NO interface. This should feel like a vast world with room for years of expansion, not every biome packed onto a tiny island.
