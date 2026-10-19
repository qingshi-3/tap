# Asset sources

用户于2026-10-10确认本地Duelyst库可直接商用、本地Godot素材均可用，随后指定优先采用 `D:/godot/rpg/assets/`。原素材库只读；以下PNG为原文件副本，裁片和组合在客户端执行。

## 当前地图与建筑

草地/土路由 `../terrain.js` 按 LEVEL 导航道路连续绘制，在920×540离屏缓存中生成，显示为1840×1080世界；不加载旧地图图片，也不旋转草地边缘砖拼道路。稀疏草叶和资源位木桩由Canvas绘制。树石使用现有RPG物体图集。

以下源路径均相对 `D:/godot/rpg/assets/`；region记作 `(x,y,w,h)`。

| 当前副本 | 源文件 | 使用区域 |
| --- | --- | --- |
| `terrain-rpg/Trees_rocks.png` | `textures/tiles/草原_grassland-tileset/Trees_rocks.png` | 树4格 `(0/64/128/192,0,64,80)`；灌木和石头见下文 |
| `buildings-rpg/stone-hall.png` | `textures/tiles/铁匠铺内外_blacksmith-house-interior-exterior/House_exterior.png` | 完整右侧石屋 `(208,0,128,144)`；排除局部左上 `(0,0,48,32)` 内无关武器图标，保留完整屋顶/烟囱/墙体 |
| `buildings-rpg/mage-tower-exterior.png` | `textures/tiles/法师塔_mage-tower/Exterior.png` | `(0,0,136,232)` |
| `buildings-rpg/farm-houses.png` | `textures/tiles/动物农场_farm-with-animals/Houses.png` | `(272,0,128,144)`，含完整门廊；城镇与农场共用 |
| `buildings-rpg/cave-entrance.png` | `textures/world/2 Objects/Other/Cave_enter.png` | 全图 `(0,0,70,55)` |
| `buildings-rpg/crystal-obelisk.png` | `textures/world/2 Objects/Crystals/1.png` | 全图 `(0,0,57,46)` |
| `buildings-rpg/chest-lever.png` | `textures/tiles/RPG肉鸽地牢_dungeon-tileset-rpg-roguelike/chest_lever.png` | 关闭宝箱 `(0,0,32,32)` |

灌木精确裁片：`(2,83,58,42)`、`(64,86,48,37)`、`(117,80,39,48)`、`(162,86,43,41)`。

石头精确裁片：`(3,244,58,57)`、`(73,256,47,45)`、`(129,244,61,59)`、`(198,256,53,47)`。不按统一64格切割，避免上排或邻居碎片。装饰按纵向落地点排序。

建筑使用原透明通道并保留长宽比，阵营用小旗表达，不重绘/改色原PNG。素材裁片与排除相邻物体的裁切轮廓在 `../assets.js`；显示与点击尺寸由renderer共享。

## 单位与动画

五种玩家单位保留 `C:/Users/qs/godot/the-war/assets/units/takeover/` 下的原始PNG：

| 输出 | 相对源路径 |
| --- | --- |
| `units/guard.png` | `infantry/f1_melee.png` |
| `units/archer.png` | `archers/f1_ranged.png` |
| `units/cavalry.png` | `cavalry/f1_radiantdragoon.png` |
| `units/siege.png` | `siege/f1_mech.png` |
| `units/magic.png` | `magic/f1_caster.png` |

帧区域、速度、循环和时长来自同目录各自的 `frames.tres`。攻击跟随实际出手重播原attack帧，死亡使用原death帧；无新生成单位图片。

`units/ogre.png` 来自 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/original_resources/units/f2_ogremonk02.png`。帧元数据读取 `app/resources/units/f2_ogremonk02.plist`：100×100帧、1px间隔；attack14帧、idle/breathing11帧、run8帧、death23帧。不是猜测128px网格。

## UI与停用素材

`ui/gold.svg` 原样复制自 `C:/Users/qs/godot/my-team/assets/ui/icons/gold.svg`，运行时CSS滤镜显示金币色。`ui/stone-panel.png` 与 `ui/portrait-ring.png` 分别来自该项目 `assets/ui/tavern/workbench-list.png`、`portrait-stone-ring.png`，当前UI不加载。

旧的 `terrain.png`、`strongholds.png`、`resources.png`、`world-objects.png` 为the-war副本，现不加载。旧 `terrain-mobile-v1.png`、`terrain-mobile/`、`buildings-mobile/` 为已否定原型资源，保留文件不用于当前画面。RPG `ground_grasss.png` 曾用于不正确的草边拼接，已停用；`dead-tree-stake.png` 也已停用，不将枯树充当木桩。

未修改源Godot工程或源图集，未批量导入整个资源库。

公会大厅及叠加屋顶方案被用户否定，现已停用 `guild-hall-exterior.png`，不再拼接模块屋顶。主城使用石屋图集中的完整建筑形状；仅以Canvas裁切剔除同一区域左上角独立武器图标，不改变原PNG。
