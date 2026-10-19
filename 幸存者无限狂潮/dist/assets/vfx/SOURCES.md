# 特效素材来源

以下图片从用户指定的 my-team 项目原样复制，源项目保持不变。

- `rend-strip.png`：`C:/Users/qs/godot/my-team/assets/vfx/refresh/rend-strip.png`。复用正式旋风斩/劈斩刷纹，映射到扇环，按扫掠到达时间逐段消散。
- `return-blade-painted.png`：`C:/Users/qs/godot/my-team/assets/vfx/enemy-actions/return-blade-painted.png`。复用 basic_blade 的实体金属轮刃，保留当前游戏环绕轨道并自转。
- `rockWall.png`：`C:/Users/qs/godot/my-team/assets/vfx/library/rock-wedge-anime.png`。棕灰色手绘岩楔单帧，供岩墙沿弧线排列；输出为原图逐字节副本，元数据裁掉顶部和底部透明边距（972×1508 可见矩形）。
- `iceRain.png`：用户确认候选 A，源 `C:/Users/qs/godot/my-team/assets/vfx/ice-prism.png`，原图逐字节复制。元数据选取主体矩形 `(243,92,471,1489)` 排除极低透明度边缘杂点；渲染旋转180度、等比缩小为30–46世界单位高，作为固定区域冰柱雨及小碎冰。原图不改色、不重绘。0.7.3 起替代 R 原 `icePillar` 图集。

用户另已授权 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main` 全部素材可直接商用；本次这两张图片直接取自 my-team。

## Duelyst 序列帧特效

以下序列帧 PNG 从用户已授权的 Duelyst 素材库原样复制，没有缩放、重采样或重绘。除注明的 units 素材外，来源均为 `app/resources/fx/`。`dist/vfx-assets.js` 的帧矩形、旋转标记、原始画布尺寸和裁剪位置由同名 plist 通过 `tools/extract-vfx.mjs` 提取。

| 游戏键 | 输出 PNG | Duelyst 源文件 | 用途 |
| --- | --- | --- | --- |
| `magicBolt` | `magicBolt.png` | `fx_f1_casterprojectile.png/.plist` | 弹头朝左的金色能量弹三帧飞行循环（仅 `_002`、`_003`、`_004`，排除 charge、淡入淡出及重复帧） |
| `magicImpact` | `magicImpact.png` | `fx_impactblue.png/.plist` | 蓝色大型魔法命中爆发（仅 `big` 序列） |
| `dash` | `dash.png` | `fx_f2_teleport.png/.plist` | 红色残影闪身 |
| `cleave` | `cleave.png` | `fx_crossslash.png/.plist` | 白色交叉斩击 |
| `swordField` | `swordField.png` | `fx_bladestorm.png/.plist` | 环绕剑刃风暴 |
| `frost` | `frost.png` | `f6_flashfreeze.png/.plist` | 旧地面冰刺图集；0.7.2 起法师 R 改用 `icePillar`，通用毒圈也不使用此图集 |
| `bossCleave` | `bossCleave.png` | `fx_fireslash.png/.plist` | 朝右的橙黄火焰重斩完整序列，与主角青白剑光区分 |
| `bossCharge` | `bossCharge.png` | `f5_fx_flamingstampede.png/.plist` | 朝右的紫红、橙黄长尾冲锋完整序列 |
| `bossSlam` | `bossSlam.png` | `fx_f3_cataclysmicfault.png/.plist` | 暖金色地面喷发、落尘完整序列，无固定水平朝向 |
| `icePillar` | `icePillar.png` | `app/resources/units/f6_bonechillbarrier.png/.plist`（PNG 副本取自用户授权的 `D:/godot/rpg` 同名生产图集） | 真正高柱形紫蓝冰晶障碍；使用 `idle_000..005` 六帧、5 FPS 循环。plist 每帧为 100×100，本游戏元数据裁到共同非透明范围 46×67，消除四周透明边距并保持帧间锚点稳定 |

来源库保持不变；重新运行提取工具会确定性更新工具清单内的 FX 副本及其元数据，并保留独立导入的元数据。`icePillar` 来自 units 图集，不属于该工具的 FX 批量覆盖范围。

2026-10-11: summon.png = fx_summonlegendary; tesla.png = fx_beamtesla; beam.png = fx_beamlaser; vortex.png = fx_vortexswirl, authorized unmodified Duelyst app/resources/fx. Authored frames replace summon, lightning, beam and vortex placeholders. Active enemy animation is clipped to collision geometry and safe gaps.

Beam/tesla retain only the active authored frames (tesla 16–28, laser 10–25), rotated from vertical onto the attack ray. Monochrome FX are tinted to the ability color; enemy active FX use red. Vortex retains 6–32 to exclude spawn/disappear tails while the zone persists.

shield.png = fx_distortion_hex_shield (active frames 1–5), used as translucent authored hex shielding for guard/aegis. familiar.png = fx_teleportblueorb (active frames 5–11), used as the floating familiar entity. Both original authorized Duelyst atlases. Mine reuses approved rockWall body plus summon rune; no collision changes.

2026-10-11 飞镖/瞬移视觉：blinkSeal.png 原样复制 fx_shadowcreep.png，使用 idle 低亮地面刃痕；blinkPhase.png 原样复制 fx_teleportblueorb.png，使用起手凝聚。主体复用已授权 return-blade-painted.png，Q 飞行、落地保持同一实体，通用回旋镖银刃尺寸与刃风拖尾强化。落地打击复用 cleave 多方向斩切，激活复用 swordField；不修改战斗参数。

2026-10-11 通用反馈补整：heal.png 原样复制 Duelyst fx_heal.png，完整绿金治疗光丝；hitImpact.png 原样复制 fx_impactred.png，使用 medium_000..005 红粉受击星芒（24 FPS）。普通 slash 复用 cleave 交叉斩切。受击只绘38px、不满屏闪烁，reduced-motion定格稳定中帧、降低不透明度。仅renderer映射，不增加游戏事件或改范围/参数；当前只有hit生产者，slash/heal是已有具名兼容分支，未调用的radial保留原绘制。
