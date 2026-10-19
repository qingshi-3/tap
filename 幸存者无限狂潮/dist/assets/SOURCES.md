# Unit asset sources

## 2026-10-13 十英雄特效材质优化

继续复用本清单已记录的Duelyst逐帧动画：cleave、vortex、blinkPhase、magicBolt/Impact、flameCore/fireGround/fireImpact/fireExplosion、frost、tesla/beam、whiteSpark/hitImpact、bossSlam等；未新增或改动源素材。钢刃、拳掌、腕臂、门框与枪体为运行时Canvas材质轮廓，图集保留裁切锚点、固定色调缓存。Riot指南解读图片只保留在output供视觉参考，未作为游戏资产使用。

## 0.12.1 飞镖与瞬移特效

飞行/落地飞镖复用已授权 Godot `return-blade-painted.png`，地面刃痕与起手凝聚直接导入 Duelyst `fx_shadowcreep` / `fx_teleportblueorb` 图集，落地和命中复用现有 Duelyst 刃风与斩切序列。未修改源素材库；完整来源与呈现职责见 [vfx/SOURCES.md](vfx/SOURCES.md)。

## 0.8.4 profession appearances

The current profession pairing keeps the shared Lyonar base fighter for both sword branches, uses Windblade Commander for Swift Blade, and pairs Vanar's silver-haired `f6_general` with its `f6_tier2general` variant for the element path. The summoner and blink pairings are unchanged. Selection prioritizes character identity, species, apparent gender presentation, body type and weapon continuity before palette or decorative effects; it is this game's visual profession grading, not an official Duelyst evolution chain. The PNGs are unchanged copies from the authorized local Godot resource library; frames, anchors, aliases and source hashes are recorded in [UNIQUE_UNITS.md](UNIQUE_UNITS.md). No generated character art is used.

These files are unmodified copies from the local `D:/godot/rpg` project. The source project was read only during extraction. Reuse for this game was explicitly authorized by the user on 2026-10-10. The local OpenDuelyst CC0 1.0 license and asset provenance were examined and preserved in [licenses/UNIT_ASSETS.md](../../licenses/UNIT_ASSETS.md). The prior provenance comparison found exact decoded-pixel matches for three original sheets; the brute has a matching CC0-library plist but its original PNG is absent, so pixel identity for that original cannot be independently verified. The two additional hero sheets are copied byte-for-byte from the authorized local source.

| Game key | Readable name | Source identity | PNG | Size | Transparency | Animations |
| --- | --- | --- | --- | --- | --- | --- |
| hero | 风刃指挥官 | `莱昂纳王国/f1_风刃指挥官` | `f1_windbladecommander.png` | 512×1024 | PNG alpha/transparency | attack, defeated, hit, idle, move, breathing, death, hurt, run |
| hero_duelist | 岚影双刃将军 | `岚影诸派/f2_将军` | `f2_general.png` | 1024×1024 | PNG alpha/transparency | attack, defeated, hit, idle, move, breathing, cast, castend, castloop, caststart, death, run |
| hero_mage | 星砂沙丘术士 | `星砂圣庭/f3_Dune施法者` | `f3_dunecaster.png` | 512×1024 | PNG alpha/transparency | attack, defeated, hit, idle, move, breathing, death, run |
| grunt | 深渊爬行者 | `深渊军团/f4_异界Crawler` | `f4_crawler.png` | 512×1024 | PNG alpha/transparency | attack, defeated, hit, idle, move, breathing, damage, death, run |
| runner | 深渊暗影舞者 | `深渊军团/f4_暗影Dancer` | `f4_shadowdancer.png` | 512×1024 | PNG alpha/transparency | attack, defeated, hit, idle, move, breathing, death, run |
| brute | 冥界蛮兵 | `深渊军团/f4_异界Underworldbrute` | `f4_underworldbrute.png` | 1024×1024 | PNG alpha/transparency | attack, defeated, hit, idle, move, breathing, death, run |

The frame rectangles, animation speeds, loop flags, and per-frame duration multipliers in `dist/assets.js` are parsed from each source `frames.tres`. The normalized anchor is derived from the matching `visual.tres` Offset and Scale relative to an animation frame.

## Generated terrain

- Tool: built-in `image_gen` tool, opaque output
- Native output: 1254×1254 pixels, copied directly from the built-in image tool output without resampling
- Output: `dist/assets/terrain.png`
- Prompt:

```text
Use case: stylized-concept
Asset type: seamless 1024×1024 top-down ground texture for a browser survival game
Primary request: Create a genuinely seamless square pixel-art ground texture combining muted wilderness grass with worn old gray-green stone surface.
Scene/backdrop: Entire canvas is flat walkable ground viewed straight down, with broad irregular patches of dull sage grass and desaturated blue-green/gray stone blending naturally.
Style/medium: Deliberate large-block pixel art, crisp hard pixel clusters, restrained detail, low contrast, no painterly blur.
Composition/framing: Uniform visual weight with a calm readable center; opposite edges must join seamlessly when tiled horizontally and vertically; avoid any obvious central focal object or repeated grid seam.
Color palette: Dark muted sage, stone teal, lichen gray-green, very limited subdued earthy accents. The ground must stay dim enough that a cyan-blue hero and dark-purple monsters stand out clearly.
Materials/textures: Sparse tiny cracks, faint worn mottling, and occasional minimal grass tufts integrated into the flat surface, all low contrast.
Constraints: 1024×1024 square. Ground only. Edge-to-edge tileable. Large readable pixel shapes and sparse detail.
Avoid: units, characters, creatures, text, logos, roads, paths, buildings, walls, cliffs, rocks as raised objects, trees, props, shadows suggesting obstacles, perspective, lighting hotspots, borders, frames, map boundaries, high contrast, excessive noise, photorealism.
```

## Generated game icon

- Tool: built-in `image_gen` tool, opaque output
- Native output: 1254×1254 pixels, copied directly from the built-in image tool output without resampling; exceeds the platform's 512×512 minimum icon size
- Reference image: `dist/assets/units/hero.png` (identity and palette reference only; source unchanged)
- Output: `media/icon.png`
- Prompt:

```text
Use case: stylized-concept
Asset type: 1024×1024 square mobile game icon
Primary request: Create a bold pixel-art icon for a game about one lone wind-blade warrior facing a shadow horde.
Input images: The supplied sprite sheet is an identity and palette reference for the hero only. Translate its recognizable orange-gold exposed face and limbs, bright blue-and-violet armor/clothing, white-blue oversized curved wind blade, and athletic fighter silhouette into a polished icon character. Do not reproduce the sprite sheet grid or layout.
Scene/backdrop: Deep muted pine-green atmospheric background with only a few dark purple enemy silhouettes closing in behind the hero.
Subject: One large, clear lone hero in a decisive forward slashing pose, dominating the foreground; white-blue crescent wind slash sweeps in an arc around the hero.
Style/medium: Premium crisp pixel art with deliberate pixel clusters and strong silhouette, suited to a mobile game icon.
Composition/framing: Square icon, hero centered and filling most of the frame, face and weapon readable at very small size; enemies remain secondary shapes; dynamic diagonal motion with safe margins for rounded icon cropping.
Lighting/mood: Focused cool rim light, brave and tense, strong separation between foreground hero and dark horde.
Color palette: Bright blue, violet, white and small orange-gold accents on hero; dark desaturated pine green backdrop; restrained dark purple enemies.
Constraints: Exactly one primary hero, clear blue-white wind blade, concise composition, no border required, readable as a 48px icon.
Avoid: text, letters, logos, watermark, UI, sprite-sheet cells, multiple heroes, detailed scenery, buildings, roads, excessive tiny detail, photorealism, anime illustration, smooth vector art.
```

## Generated promotional banner

- Tool: built-in `image_gen` tool, opaque output
- Reference images: `media/icon.png` (primary identity, palette, mood, and rendering reference) and `dist/assets/units/hero.png` (supporting hero identity reference); both sources unchanged
- Output: `media/banner.png`
- Native output: 1672×941 pixels, 2,182,787 bytes (2.082 MiB), copied directly from the built-in image tool output without resampling
- Platform check: 16:9 aspect and file size under 4 MiB pass; native dimensions are below the required minimum 1920×1080 and need separate handling before upload
- Prompt:

```text
Use case: ads-marketing
Asset type: platform promotional banner for the browser survival game 《像素孤锋》
Primary request: Create a cinematic 16:9 promotional banner in refined high-detail pixel art. The lone wind-blade hero faces and cuts through an encroaching abyssal enemy horde.
Input images: Image 1 is the existing square game icon and the primary identity, palette, mood, and rendering reference. Image 2 is the original hero sprite sheet and a supporting identity reference. Preserve the hero's recognizable orange-gold face and limbs, blue and violet armor/clothing, white-blue oversized curved wind blade, athletic silhouette, and sweeping crescent slash. Do not reproduce the square crop or sprite-sheet grid.
Scene/backdrop: A dark muted pine-green and stone-teal wilderness battlefield, with ranks of dark-purple abyss creatures emerging from mist and shadow. Keep scenery secondary and leave the combat space readable.
Subject: One large, clear hero in a dynamic forward-slashing pose confronting many enemy silhouettes; a brilliant white-blue wind arc leads the eye across the wide frame.
Style/medium: Polished, detailed pixel art with crisp intentional pixel clusters, strong silhouettes, atmospheric depth, and premium game key-art finish.
Composition/framing: Native wide 16:9 landscape composition intended for at least 1920×1080 delivery. Hero occupies the center-right foreground, enemy tide sweeps in from the left and deep background, slash arc connects both sides. Reserve a clean upper-left area for the title while keeping all important content inside safe margins.
Lighting/mood: Brave last-stand energy, cool cyan wind light on the hero, restrained violet enemy glow, dark atmospheric background.
Color palette: Hero in vivid blue, violet, white, cyan, and orange-gold; environment in desaturated pine green and stone teal; enemies in dark purple and near-black.
Text (verbatim): "像素孤锋"
Text treatment: Display exactly the four Chinese characters 像素孤锋 once, large and legible in the upper-left, using a bold handcrafted pixel-display title with pale silver-white fill, subtle cyan edge light, and a restrained dark shadow. No subtitle.
Constraints: Wide 16:9. One primary hero. Preserve character identity from the references. Only the exact Chinese title 像素孤锋 may appear. Strong readability at banner size.
Avoid: any other text, English letters, numbers, logos, watermarks, UI, sprite-sheet cells, duplicate heroes, modern objects, buildings, roads, photorealism, smooth vector art, illegible or substituted Chinese characters.
```

### Release-resolution edit attempt

- Tool: built-in `image_gen` edit with `media/banner.png` as the sole referenced edit target
- Output: `media/banner-release.png`
- Native output: 1672×941 pixels, 2,313,097 bytes (2.210 MiB), copied directly from the built-in image tool output without resampling
- Result: the 16:9 aspect, exact title, composition, and file-size limit are retained, but the built-in tool again returned 1672×941. This remains below the required 1920×1080 minimum and is not upload-ready on dimensions.
- Prompt:

```text
Use case: precise-object-edit
Asset type: release-resolution platform promotional banner
Primary request: Upscale the supplied promotional banner to a native 16:9 output of 2048×1152 pixels (or at minimum 1920×1080) while preserving the existing image exactly in content and composition.
Input image: The supplied `banner.png` is the edit target and sole visual source.
Invariants: Keep the same overall frame, crop, hero identity, pose, proportions, blue-violet-orange palette, white-blue wind slash, enemy count and placement, pine-green battlefield, moonlit background, visual hierarchy, lighting, detailed pixel-art rendering, and title placement. Keep the exact Chinese title "像素孤锋" unchanged, correctly shaped, and as the only text. Preserve the 16:9 aspect ratio.
Edit requested: Increase only the native pixel dimensions and restore crisp intentional pixel-art edges and fine details appropriate to the higher resolution. Do not redesign, repaint, recompose, crop, expand the scene, or add new content.
Text (verbatim): "像素孤锋"
Constraints: Native output must be at least 1920×1080, preferably 2048×1152. Opaque PNG. Same image and composition.
Avoid: any content change, altered Chinese characters, other text, English letters, logos, watermarks, UI, duplicated hero, added objects, changed colors, smooth vector treatment, photorealism, blur, aspect-ratio change.
```

## Platform-size preparation

On 2026-10-10 the user explicitly authorized a conventional proportional upscale after two built-in ImageGen outputs remained 1672x941. The selected original media/banner.png was resized with ImageMagick Lanczos to cover 1920x1080, then center-trimmed by less than one output pixel vertically to make the exact 16:9 canvas. The title and composition were retained; no new detail is claimed. Final file media/banner-taptap.png: 1920x1080 PNG, 2,634,017 bytes, within the 4 MiB limit. Native originals remain unchanged.


## 营地场景（2026-10-10）
- assets/ui/camp-original.png：内置 ImageGen 生成的原创边境营地，演武场、锻造工棚、远征关口与营火。无文字UI；原始输出保留于 Codex generated_images/01a121cb-9a2f-7013-bee9-84334573a6b7/exec-1d758fe0-3123-477c-8d56-8486b408f0bb.png。
- 场景为营地导航背景，不改变副本或养成数值。

## Q 冲刺音效（2026-10-11）
- assets/audio/dash.m4a：用户试听选择 B，原样复制 Duelyst app/resources/sfx/sfx_ui_modalwindow_swoosh_exit.m4a。素材库使用授权沿用用户确认。试听原件 media/dash-audio-review/q-dash-B.m4a。

## 回旋镖音效（2026-10-11）
- 用户将v3平A候选指定给回旋镖。assets/audio/boomerang.m4a由media/audio-redesign-v3/swords/01-basic-sword-pass.wav转AAC 128kbps，音高/时长不变；源为Duelyst sfx_f2general_attack_swing.m4a及程序气流/锋口层，复现脚本为同目录build_swords.py。
- 客户端仅在投出时播放一次；原内部dagger武器ID保留，显示与行为改回旋镖。其余待审样音未接入。

## 已确认动作音效共享（2026-10-11）
- 用户确认按动作/材质复用。玩家E与Boss扇形斩击共用slash-wide；重甲冲锋使用move-armored（冲刺A），轻快移动使用move-light（冲刺B），不再为同类动作分别制作英雄专属声音。
- 接入旋刃B、雷电A（额外线性增益0.7）、普通召唤A、回血、瞬移、三连袭，以及此前确认的护盾（试听已降20%，不二次削减）、强召唤、剑潮、刻印、毒圈、喷火、岩墙、砸地。
- 上述17份AAC输出由tools/prepare-approved-audio.py从已确认完整WAV转码，无归一化/截短/改音高。精确对应及原试听目录见media/approved-audio-runtime.json；每份试听的源录音/程序合成事实仍以各自manifest为准。本轮只转码，不重新生成。
- 喷火整段已包含起手，不重复叠起手；小兵弓箭保持无声。未确认的平A/魔弹/瞬斩/剑阵/旋风新稿不接入。

### 后续逐项确认
- 用户接受v4平A、魔弹A，及列表中的剑阵v5（用户称“剑刃”，已说明按剑阵处理）；新增slash-basic、magic-cast、sword-field共用样本并接入。来源/转码仍见tools/prepare-approved-audio.py与media/approved-audio-runtime.json。
- v5旋风样音按用户指定存为media/audio-library/crossbow-triple-shot.wav，不作为旋风斩使用、不进入包体。瞬斩v6与盖伦官方演示音轨仅在media中待试听，未进入客户端；盖伦来源不是Duelyst。
- 随后用户确认瞬斩v6单次版，已接入quick-cut.m4a，对应Duelyst sfx_f2melee_attack_swing_2.m4a的0.065–0.780秒单事件，详见media/audio-redesign-v6/instant/manifest.json。盖伦改为前2秒试听，仍未进入客户端。
- 随后用户确认盖伦前2秒版，已接入whirlwind.m4a，保留批准的2秒与末30ms淡出，不再使用旧windblade音效。来源为Riot官方盖伦E演示音轨 https://lol.dyn.riotcdn.net/x/videos/champion-abilities/0086/ability_0086_E1.mp4 的0.70–2.70秒（演示混音），不属于Duelyst库；原来源记录和用户批准切段分别见media/audio-redesign-v6/garen-source.json与garen-first2s.json。此处记录来源与用户选型，不把Duelyst的使用授权扩展到该素材。当前仅本地接入，未上传。


0.6.4：按用户最新要求，B候选 dash.m4a 改用于平A，Q恢复 windblade.m4a，来源文件名与音频内容保持原样。

## 0.7.0 英雄视觉
契灵使复用healer_basic，瞬印行者复用scout_basic，元素法师复用hero_mage；普通与精锐召卫使用guard_basic/guard_elite。全部沿用已有授权Duelyst单位图集，无新增生成角色。火焰与岩墙复用已有bossCleave/bossCharge/bossSlam图集，雪粒/积雪/岩块几何由Canvas绘制。

## 任务与远征场景（0.8.2，2026-10-11）
- 按用户要求，远征界面改用四张 Duelyst 原版场景：Shimzar 遗迹、Frostfire 崖城、Obsidian Woods 石门与 Vetruvian 浮岩，均直接复制源 JPEG；映射、尺寸和精确路径见 [UI 来源清单](ui/SOURCES.md)。
- 旧生成的 `world-map-original.png` 保留原件，已不展示、预加载或打入0.8.2包体。未来扩展关卡背景按上述原版画风生成，场景选择不再依赖大地图。

## 战技演武 UI（0.8.1，2026-10-11）
- 16 个战技图标、按钮、头像圆框和标题饰边均复用已授权的 Duelyst 原素材，精确源文件和裁切方式见 [UI 来源清单](ui/SOURCES.md)。背景沿用已导入的 Duelyst `hub.jpg`。不修改源素材库。
- 战技预览复用本地 `simulation.js` / `renderer.js` 及现有单位、VFX，无新增生成视觉或音频；只在独立演示状态中布置目标，不写入玩家档案。

## 当前 General 英雄视觉（2026-10-11，替代上述可操控角色映射）
- 指挥官 / 契灵使 / 瞬印行者 / 元素法师分别使用 `general_commander` / `general_summoner` / `general_blink` / `general_mage`，来自 Duelyst 的 f1 / f4 / f2 / f6 General。
- PNG、攻击与施法序列均复用 `D:/godot/rpg/assets/battle/units` 的原图集和 `frames.tres`，锚点来自对应 `resource/battle/units/.../visual.tres`；具体路径见 `UNIQUE_UNITS.md`，复现入口 `tools/extract-assets.mjs`。源库只读，无生成或拼造动画帧。
- 所有四个新 General 都具有独立 `attack` 和 `cast`。旧英雄、敌人与随从图集保留；仅更换英雄素材标识，原英雄 ID 与养成存档沿用。



## 裂垒与织焰敌方内容（2026-10-11）
- 裂垒执锤者 `boss_kron`、烬环织焰者 `boss_cindera`、护炉卫 `neutral_golemstone`、封路炮手 `f2_flareslinger`、蓄爆甲虫 `neutral_monsterexplodingdemon`：原样复制已授权 `D:/godot/rpg/assets/battle/units/` 的 PNG，帧来自相邻 `frames.tres`，锚点来自对应 `resource/battle/units/.../visual.tres`。精确目录、SHA-256、尺寸与帧映射见 [UNIQUE_UNITS.md](UNIQUE_UNITS.md)；复现入口 `tools/extract-assets.mjs`。
- 保留全部原动画，包括炮手独立 `projectile` 和甲虫独立 `explode`。普通击杀用 `death`，自然蓄爆终结才用 `explode`；原攻击全为 10 FPS。Kron 原攻击第 12 帧落锤，炮手第 5 帧发炮；举锤/瞄准预警可维持已核对姿势。
- 本作机制由运行时几何和时序定义，不宣称复用 Duelyst 原技能。护阵六角纹、小盾、锁定危险边界、计时及环缺口由 Canvas 绘制，原像素主体/弹体不改图。五项 `authoredSize` 避免叠加旧 Boss/精英倍率；身体可见高度按 idle 实测约 40–68 世界像素。
- 逐帧检查图位于 `output/enemy-content/`。源库与 Story 分析记录保持只读，未生成替代角色，未外部上传。

## 通用战技特效与灵械实体（2026-10-11）
- 复用已授权 Duelyst 源库 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app`，原库保持只读。VFX 原 PNG 与 plist 位于 `resources/fx`；`tools/extract-vfx.mjs` 复制原图并保留裁切、旋转与未裁尺寸元数据。
- `shockNoise` ← `fx_radial_bluenoise`；`fireExplosion` ← `fx_explosionorangesmoke`；`fireImpact` ← `fx_fireimpact`；`fireGround` ← `fx_firefallground`；`flameCore` ← `fx_flamesphere`。shockNoise 原图有不透明黑底，原为叠加用途，呈现必须使用 screen/lighter 或等效去黑合成，不能正常覆盖出黑方块。
- `poisonCloud` ← `fx_smoke2` 的 `fx_smokeground_001..006`：亲看为低矮灰绿尘雾弧和稀疏碎点，作为低亮贴地纹理，毒色由运行时轻映射，不宣称原图就是毒液。`whiteSpark` ← `fx_smoke` 的 `fx_explosionwhitesmokemedium_000..009`：白色星芒转白碎屑；没有选择名为 whiteexplosion 却带黄色火团的图集。
- `familiarLight` ← `neutral_golemsteel`（窄身钢铁盾械）；`familiarHeavy` ← `neutral_golemrunesand`（宽身符砂巨拳）。原 PNG 位于 `original_resources/units`，plist 位于 `resources/units`；原样复制，idle/run/attack/hit/death/breathing 均按真实帧导入，不拼造动画。元数据、SHA-256 和尺寸见 `dist/assets.js`，复现顺序为 `tools/extract-assets.mjs` 后 `tools/extract-familiar-assets.mjs`。
- 亲看接触表在 `output/vfx-full-fix/assets/construct-candidates.jpg` 与 `imported-vfx-contact.jpg`；这是素材选型证据，不替代最终游戏交互与密集战斗验收。

## 战斗短音与奖励反馈（2026-10-12）
- 新增12份 `assets/audio/*-short.m4a` / `reward-up.m4a` / `reward-evolution.m4a` / `result-win.m4a` / `result-lose.m4a`，来自 rubberduck 的 [80 CC0 RPG SFX](https://opengameart.org/content/80-cc0-rpg-sfx)，许可证 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)，可商用及改编。实际下载：https://opengameart.org/sites/default/files/80-CC0-RPG-SFX_0.zip。原ZIP/OGG与来源网页保存在 `output/sensory-upgrade/audio-source/`，不进入包体。
- 精确映射（输出←原OGG）：impact-short←blade_01；kill-short←creature_die_01；pickup-short←item_gem_01；supply-short←item_coins_01；reward-up←spell_01；reward-evolution←spell_02；result-win←item_gem_04；result-lose←creature_monster_01；pulse-short←spell_fire_03；blast-short←spell_fire_01；vortex-short←spell_02；select-short←lock_01。
- 处理：截取起点0至0.12–1.00秒（逐项时长见原件目录manifest.json），响度目标-20 LUFS/真峰值-3dB，末50ms淡出，单声道44.1kHz AAC 80kbps。复现脚本 `tools/prepare-sensory-audio.py`；新增共62,058字节。按波形/时长及角色功能选型，未宣称主观试听或手机宿主通过。
- 高频windblade普攻改用impact短样本，orb魔弹改用pulse短样本；保留已批准Duelyst/用户样音的低频主动技能。nova/mine/vortex分别有脉冲/爆裂/力场短起手，命中、击杀、拾取按每帧累计事实聚合；奖励/UI优先级高于普通攻击，最多10声部。
- 上述较早Riot盖伦演示来源仍仅作为历史记录；本轮未扩展其许可声明或新增该来源。


## 声音减噪重做（2026-10-12，替代上一节运行选型）
- 用户否定上一版声音密度和听感。已撤普通命中/死亡叠音、持续区域与旋风/毒/喷火/剑阵长声；上一节12份RPG音源保留为历史原件，已不预加载或运行。低频主动/Boss也改用短瞬态，原批准长样音保留文件但本轮不运行。
- 当前9份 `assets/audio/clean-*.m4a` 来自 [512 Sound Effects 8-bit Style](https://opengameart.org/content/512-sound-effects-8-bit-style)，作者 Juhani Junkala / SubspaceAudio，CC0 1.0。实际下载并保留原ZIP/WAV于 `output/sensory-upgrade/audio-source/retro.zip` / `retro/`。下载URL：https://opengameart.org/sites/default/files/The%20Essential%20Retro%20Video%20Game%20Sound%20Effects%20Collection%20%5B512%20sounds%5D.zip。
- 输出←原文件：clean-slash←sfx_wpn_sword1.wav；clean-pulse←sfx_sounds_impact2.wav；clean-hurt←sfx_sounds_impact1.wav；clean-pickup←sfx_coin_single2.wav；clean-select/clean-lose←sfx_sound_neutral1.wav；clean-upgrade/clean-win←sfx_sounds_fanfare1.wav；clean-evolution←sfx_sounds_powerup1.wav。精确原相对路径与处理见 `output/sensory-rework/audio-manifest.json`。
- 处理：保留原音高，0.093–0.836秒短段，6.5kHz低通、尾15ms淡出、单声道44.1kHz AAC 80kbps。片段目标分别attack -30/-32 LUFS、pickup -33、hurt -27、select -32、reward -25/-24、lose -27，峰值目标-8dB；短段响度值只为处理目标，不宣称其代表主观听感。新增9份40,225字节。复现 `tools/prepare-clean-audio.py`。
- 普攻/通用能力共用每0.30秒总节奏门，弹簇只1声；拾取最多每0.65秒1声。最多2战斗+1拾取+1重要提示，主动/Boss/奖励按优先级竞争单一重要声部；同批重要提示只选最高优先级，攻击声不会通过共享样本冷却吞掉主动。声音开关过期操作与进化恢复转场修复保留。
- 试听对照 `output/sensory-rework/old-vs-new.wav` 顺序：旧攻击→新剑击→旧拾取→新拾取→旧升级→新奖励，每段后0.6秒静音。选型根据原片长度与包络，并保留真实试听材料；工具无法接收音频输入，未声称 Agent 已耳听、用户认可或手机宿主通过。


## 五职业试炼 Boss 素材（2026-10-12）

原样复制只读 D:/godot/rpg 项目中的五份 Duelyst 单位PNG；商业使用授权沿用工作区已确认素材授权。依 Story 视觉分析记录并亲看 idle、attack 四分位、run 实际帧后选型。保持源动作、速度、循环标志、帧时长与 visual.tres 锚点；cast仅别名映射原 attack，无伪造传送/召唤动作。

| 游戏key | 原创名 | 原PNG路径 | SHA-256 | 图集尺寸 | 动作与帧数 |
| --- | --- | --- | --- | --- | --- |
| trial_commander | 符盾守门人 | D:\godot\rpg\assets\battle\units\neutral\中立_Primus盾牌大师\neutral_primusshieldmaster.png | 73A819666735E022A57325574FFF5F4A39D467C906D053FCF9C784CB1C8768C0 | 256×2048 | attack:18, defeated:24, hit:3, idle:12, move:8, breathing:14, death:24, run:8 |
| trial_swift | 荒刃猎豹 | D:\godot\rpg\assets\battle\units\neutral\首领_沙地豹\boss_sandpanther.png | 517681F94DBC8E694215A5805AF8952F50A5AC42D53925283A5A4229C7197173 | 2048×1024 | attack:26, defeated:16, hit:3, idle:14, move:8, breathing:14, death:16, run:8 |
| trial_summoner | 唤魂祭司 | D:\godot\rpg\assets\battle\units\neutral\首领_怨魂\boss_wraith.png | CEA0C2F1C3DAC92B427497F892F0C54FA45665A796E246EBCE1D5B9FCD2EE709 | 1024×1024 | attack:16, breathing:14, death:16, defeated:16, hit:3, idle:14, move:8, run:8 |
| trial_blink | 折空环使 | D:\godot\rpg\assets\battle\units\neutral\首领_奥里亚斯\boss_orias.png | 39866D67CAECDE162510AE654387EA5195027F97B261C7E2E055C0449671936A | 256×2048 | attack:29, breathing:11, death:22, defeated:22, hit:3, idle:11, move:8, run:8 |
| trial_mage | 涡流法尊 | D:\godot\rpg\assets\battle\units\neutral\首领_噬法者\boss_spelleater.png | F240AA22D13804F2877BE3AB4248268C2A579D2ABAD41A3A6B3240E8DFBC8227 | 1024×1024 | attack:19, breathing:14, death:17, defeated:17, hit:3, idle:14, move:8, run:8 |

符盾守门人：黑金重甲和青蓝符文盾，盾面膨胀后横纵弧击；荒刃猎豹：人形上身、豹形下身、绿刃长尾，跃身甩尾；唤魂祭司：白衣人形与紫色灵兽共生，举臂唤起灵浪；折空环使：悬浮灰身、青晶片、同心环施法；涡流法尊：橙发袍者被蓝环流包裹，扩张旋涡。按这些实际动作配机制，不把来源名称当作行为证据。

复现：基础/随从提取后运行 tools/extract-trial-boss-assets.mjs，只追加5个trial_*条目与图片，不重生成已有PNG。输出精确来源、哈希、尺寸、字节数、动作参数见 output/trial-bosses/assets/manifest.json；亲看接触表 candidates.png。新增原图共 485870 字节。

## 三名机制英雄九职业素材（2026-10-12）

只读授权D:/godot/rpg源库，九份不同原PNG逐字节复制；保留原帧区域、速度、循环、帧时长与visual.tres锚点。cast只映射attack。候选idle/attack/run实际接触表经人工查看，蓝拳套→青能掌→双魔手、镜杖→门杖→浮环阵、小球械→关节刃械→重机甲按职责配形态；不复用原四英雄或试炼Boss。

| key | 职业 | 原PNG | SHA256 | 尺寸 |
| --- | --- | --- | --- | --- |
| hero_grappler_1 | 拳斗士 | D:\godot\rpg\assets\battle\units\neutral\中立_Gauntlet大师\neutral_gauntletmaster.png | D5BE14B92002E8FA7E9BA369391B1E4778F3412233D2F5FEDF6626897A0AB74B | 1024×1024 |
| hero_grappler_2 | 魔手斗士 | D:\godot\rpg\assets\battle\units\neutral\中立_异界Highhand\neutral_highhand.png | 7357B1D0019DC95FAE1E23F686A2C21DEADEE714D98528AB32D0B7A6B5D3E3A7 | 1024×1024 |
| hero_grappler_3 | 巨擘战将 | D:\godot\rpg\assets\battle\units\岚影诸派\f2_异界Godpalmblacktiger\f2_godpalmblacktiger.png | ACA07070E79A91B714D92BE6BD1918A740157C6FF6ADD03479DADBDF8C34F106 | 1024×1024 |
| hero_rift_1 | 折光学徒 | D:\godot\rpg\assets\battle\units\neutral\中立_异界Mirrormancer\neutral_mirrormancer.png | C5C9CD94BD8EFEBAE8B14B89B1C932BC061BABD001807B20D5FA9DF3D986F531 | 2048×1024 |
| hero_rift_2 | 界门术士 | D:\godot\rpg\assets\battle\units\星砂圣庭\f3_异界Duskweaver\f3_duskweaver.png | 6354A3C0D6F7F17FD270830DD15CBAAA2D8293BEE72518B073726108E54CDB00 | 2048×1024 |
| hero_rift_3 | 万门织界者 | D:\godot\rpg\assets\battle\units\neutral\中立_Aether大师\neutral_aethermaster.png | A3640C6929EC89028177649110D7486B318F6EA0EF608A74AB9C943BF2E90502 | 1024×1024 |
| hero_magnet_1 | 拾铁匠 | D:\godot\rpg\assets\battle\units\neutral\中立_异界Z0r\neutral_z0r.png | 0C3AF3B01753142C0BD3F0972BDB15C3C15C769601D4B736E96E0232F840528F | 1024×1024 |
| hero_magnet_2 | 磁械师 | D:\godot\rpg\assets\battle\units\neutral\中立_异界Deceptib0t\neutral_deceptib0t.png | 30D591FCC354A900CA425B1713CA98A062838F58FB0BBDAEC02EC044A78877E5 | 1024×1024 |
| hero_magnet_3 | 磁极武装者 | D:\godot\rpg\assets\battle\units\neutral\中立_机械Az0r超型\neutral_mechaz0rsuper.png | 8B95972A120F50AA05965C0A5423F9BC6D5B9FCEA87A279CE2240E67FAF3F1FA | 512×1024 |

复现tools/extract-new-hero-assets.mjs；元数据output/new-heroes/assets/manifest.json，实际帧contact表candidates.jpg。九PNG共475945字节。技能实体手/铁片使用上述原图集局部区域缓存绘制，门和冲击纹理复用已入包Duelyst VFX，无新生图/改源图。

九技能图标：只读Duelyst app/resources/icons，原动画表48×48首帧原像素裁切；不重绘。

| 本地assets/ui | 源icons |
| --- | --- |
| skill-grapple-hook.png | icon_f4_daemoniclure.png |
| skill-grapple-slam.png | icon_f5_smashem.png |
| skill-grapple-clash.png | icon_f5_kineticequilibrium.png |
| skill-rift-gate.png | icon_f1_aerial_rift.png |
| skill-rift-step.png | icon_f3_astralphasing.png |
| skill-rift-barrage.png | icon_f2_hollowvortex.png |
| skill-magnet-field.png | icon_f1_magnetize.png |
| skill-magnet-lance.png | icon_f3_stonestospears.png |
| skill-magnet-crush.png | icon_f3_metalworking.png |

## 十英雄三阶新增素材（2026-10-12）

只读授权D:/godot/rpg源库，十二份不同原PNG逐字节复制；保留原帧区域、速度、循环、帧时长与visual.tres锚点。cast只映射attack。候选idle/attack/run实际接触表经人工查看，原飞剑悬阵/影术掌心旋球/粉刃青花绽放按职责配形态；不复用原四英雄或试炼Boss。

| key | 职业 | 原PNG | SHA256 | 尺寸 |
| --- | --- | --- | --- | --- |
| hero_sword_1 | 剑修学徒 | D:\godot\rpg\assets\battle\units\莱昂纳王国\f1_法刃Adept\f1_spellbladeadept.png | 2D1012CC58510FB395B87C8914975043DB025285765C1EE46190EEDA39B27819 | 2048×1024 |
| hero_sword_2 | 御剑修士 | D:\godot\rpg\assets\battle\units\neutral\中立_剑Ofakrane\neutral_swordofakrane.png | 577394B4234BCDBC3B67951BCBCD7735D045528C8B45B337C394304093F83A86 | 1024×1024 |
| hero_sword_3 | 御剑真君 | D:\godot\rpg\assets\battle\units\岚影诸派\f2_Keshraifan刃\f2_keshraifanblade.png | D8E5C549BF8CFBE0B71DFBF821787C25BD31C09B0F3A5C7E5E75B86C37181899 | 512×1024 |
| hero_spiral_1 | 旋丸学徒 | D:\godot\rpg\assets\battle\units\岚影诸派\f2_异界Chakriavatar\f2_chakriavatar.png | 8E4C6C161C9F1ABEE0D00D72A80401A0411D88EFCC79A666628F18BE6F950AA3 | 512×1024 |
| hero_spiral_2 | 旋丸影者 | D:\godot\rpg\assets\battle\units\岚影诸派\f2_法术Thief\f2_spellthief.png | DC3414703F47F6BC0DFFB0682E851233E619D395D589AE3A5EA47E8985733E94 | 1024×1024 |
| hero_spiral_3 | 群影仙者 | D:\godot\rpg\assets\battle\units\岚影诸派\f2_二阶替补将军\f2_altgeneraltier2.png | 6CF2E243D20E4CC9E97FE6D0F39EE1478DA0D85A9DE127016A76DAD602F8E541 | 2048×2048 |
| hero_petal_1 | 花刃学徒 | D:\godot\rpg\assets\battle\units\岚影诸派\f2_施法者\f2_caster.png | 004DA46571A6E6486981F7AA988A5682EC144C6E9329B65D7B0298DEF73E96DE | 512×1024 |
| hero_petal_2 | 花刃使 | D:\godot\rpg\assets\battle\units\岚影诸派\f2_异界Onnabugeisha\f2_onnabugeisha.png | FDC97B484878A741A5BAD8EE24F5F2AC7CCC71B5430D9298AAACD860D68D0561 | 2048×1024 |
| hero_petal_3 | 千花刃主 | D:\godot\rpg\assets\battle\units\岚影诸派\f2_异界Caligrapher\f2_caligrapher.png | C92FC075BC8330375E649A4206AF3BA7F3FF2BE71EBD68F38F3BD7A885F73AAA | 1024×1024 |
| hero_summoner_3 | 万灵统御者 | D:\godot\rpg\assets\battle\units\深渊军团\f4_宗师Variax\f4_grandmastervariax.png | FBABEA5AD04E23D1AE4BFB6433CE6CCB00E15F73B7048254BFBFFA03479D2FA6 | 2048×1024 |
| hero_blink_3 | 千影瞬行者 | D:\godot\rpg\assets\battle\units\岚影诸派\f2_Shidai二型\f2_shidaimk2.png | 0D9DF9FD3238D6A459B227DBAAFFB53CF125440582FFAE77B968BA21102D9E8D | 2048×2048 |
| hero_mage_3 | 三相主宰 | D:\godot\rpg\assets\battle\units\霜原部盟\f6_宗师Embla\f6_grandmasterembla.png | DAA1F5F679CA338B92C05177130A14A70F997A0D350CF4BF7D1CF74B5F2927F6 | 2048×1024 |

复现tools/extract-mythic-hero-assets.mjs；元数据output/hero-ascension/assets/manifest.json，实际帧contact表selected.png与candidates-0/1/2.png。十二PNG共842530字节。飞剑与花刃从上述原图集缓存裁取，旋丸复用已入包Duelyst vortex/magicImpact/whiteSpark纹理；无新生图/改源图。

### 御剑、旋丸、花刃九技能图标

只读Duelyst app/resources/icons，原动画表48×48首帧原像素裁切；不重绘。

| 本地assets/ui | 源icons |
| --- | --- |
| skill-sword-focus.png | icon_f2_spellsword_light.png |
| skill-sword-recall.png | icon_f2_etherealblades.png |
| skill-sword-union.png | artifact_f4_spectralblade.png |
| skill-spiral-orb.png | icon_f2_spiralcounter.png |
| skill-spiral-clone.png | icon_f2_projection.png |
| skill-spiral-convergence.png | icon_f2_spiraltechnique.png |
| skill-petal-sweep.png | f4_shadowblossom.png |
| skill-petal-pierce.png | artifact_f6_winterblade.png |
| skill-petal-bloom.png | icon_f1_sunbloom.png |


## 2026-10-13 十英雄机制重设计

未新增或修改源素材库。运行时继续使用本清单已记录的Duelyst单位与VFX图集；巨刃从已入包hero_sword_2攻击帧0内(32,14,16,44)区域裁出，磁械甲片/炮身和魔手实体沿用已授权单位裁片。元素法术使用flameCore、fireGround、fireExplosion、frost、icePillar等实际纹理，旋丸柔芯和旋带、花刃实体、界门晶核均复用现有授权资产。裁切、着色、缩放仅在客户端画布发生，未写回原素材。

## 英雄、敌人与召唤物独立素材（2026-10-13）

授权源库 D:/godot/rpg 只读；七套原 PNG 逐字节复制，保留 frames.tres 全部帧区域、时长、速度与循环及 visual.tres 锚点。全 unitAssets sourceIdentity/SHA256 排重，英雄、召唤物不与敌人或 Boss 复用；替换前 PNG 留在 output/unit-dedup。

| key | 职能 | 原始素材 | SHA256 |
| --- | --- | --- | --- |
| hero_sword_3 | 御剑真君 | D:\godot\rpg\assets\battle\units\岚影诸派\f2_宗师Zendo\f2_grandmasterzendo.png | 9D5BBA5683260CAE40BB9EC115ECBF39139FDC13535E97E56FFF19539AF4D28A |
| guard_basic | 重甲卫士 | D:\godot\rpg\assets\battle\units\neutral\中立_铁Clad\neutral_ironclad.png | 6827EC85D2D37B438E86C5BC3E52FFE886F73ECD015128994A183B2815F4AFDC |
| summon_shield | 召唤盾卫 | D:\godot\rpg\assets\battle\units\莱昂纳王国\f1_维和者\f1_peacekeeper.png | 5A1C88B1F9BE84B106EF0A3735977072E469C2E75544C6EECAB82A96A47B1985 |
| summon_spear | 召唤矛卫 | D:\godot\rpg\assets\battle\units\莱昂纳王国\f1_日铸枪兵\f1_sunforgelancer.png | 6ACDA94BADFE76D5E9C985D6CDEE161A1D3FC79FF64ECE0D358B358F3E96BBA7 |
| summon_captain | 召唤统领 | D:\godot\rpg\assets\battle\units\莱昂纳王国\f1_异界Rightfulheir\f1_rightfulheir.png | 244A3B8599F7632B33E2EF2A5CCF5860105D84099117DF63FE41EF243D342C06 |
| summon_giant | 融合巨灵 | D:\godot\rpg\assets\battle\units\neutral\中立_钻石魔像\neutral_diamondgolem.png | F3A1CBEAE1B56A9F6EA67C5830D0644A611034731A34133FE826BE07E8097954 |
| summon_priest | 召唤祭司 | D:\godot\rpg\assets\battle\units\莱昂纳王国\f1_异界Archdeacon\f1_archdeacon.png | 73DB78440501525F06F3DF9390B7C5477C626FB4E4192837E060DECEFA7A1885 |

复现 tools/replace-duplicate-unit-assets.mjs；候选接触表 output/unit-dedup/candidates.png，元数据 output/unit-dedup/manifest.json。
