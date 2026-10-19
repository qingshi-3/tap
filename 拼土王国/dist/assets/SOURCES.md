# 《拼地王国》美术来源

本目录的 `world/**.png` 为用户已有 MiniWorldSprites 原图的逐字节复制，没有修改源素材库或来源项目。原始路径：`C:/Users/qs/Desktop/游戏素材/MiniWorldSprites`。来源沿用 `games/deepseek-little-guardians/public/assets/SOURCES.md` 中已记录的地景素材；原目录未检出独立 LICENSE/README，因此不声称额外许可核验。当前任务明确授权复用这套现有本地素材。

Canvas 的草地土层、水波、沃土、空地、木料与资源图标、学校书本、诊所标识和旗帜由本游戏 `art.js` 绘制，无外部图标、字体或 emoji 依赖。

## 实际使用的原图裁切

坐标均为原图像素，格式 `x,y,w,h`。运行时关闭平滑缩放。

| 对象 | 文件（相对 world） | 裁切 |
|---|---|---|
| 草地 | Ground/TexturedGrass.png | 16,0,16,16；32,16,16,16 |
| 树木 | Nature/Trees.png | 16,0,16,16 |
| 山岩 | Nature/Rocks.png | 0/16/32,0,16,16 |
| 麦田 | Nature/Wheatfield.png | 16,0,16,16 |
| 王城 | Buildings/Wood/Keep.png | 一级0,0,32,32；二级32,0,32,32；三级32,32,32,32 |
| 住宅 | Buildings/Wood/Houses.png | 0/16/32,16,16,16 |
| 农场风车 | Buildings/Wood/Resources.png | 16,16,16,16 |
| 伐木工坊 | Buildings/Wood/Workshops.png | 0,0,16,16 |
| 矿井 | Buildings/Wood/CaveV2.png | 0,16,16,16 |
| 渔港 | Buildings/Wood/Docks.png | 32,0,32,32 |
| 市场 | Buildings/Wood/Market.png | 0/16/32,16,16,16 |
| 学校 | Buildings/Wood/Workshops.png | 16,16,16,16，加书本标识 |
| 诊所 | Buildings/Wood/Chapels.png | 0,16,16,16，加医疗标识 |
| 兵营 | Buildings/Wood/Barracks.png | 16,16,16,16，加旗帜与盾牌 |

`Ground/DeadGrass.png` 原图随同复制并可供后续同风格道路接入，当前不用于绘制。

## 接口

- `await loadArt()`：图片加载完成；返回 `{loaded,total}`。缺图时对象使用 Canvas 实物后备图，不会阻塞主流程。
- `drawTerrain(ctx, terrain, x, y, size, seed=0)`：grass / forest / water / mountain / fertile；完整铺满正方形。
- `drawBuilding(ctx, type, x, y, size, level=1)`：hall / house / farm / lumber / mine / fishery / market / school / clinic / barracks。先绘制地形，再绘制建筑；建筑的实体空地会覆盖格内树木与岩石，避免穿模。
- `drawIcon(ctx, key, x, y, size)`：gold / food / wood / population / happiness / knowledge / defense；也接受建筑与地形 key。

所有方法保存并恢复 Canvas 状态，图形裁剪在输入的格子内。建筑等级取1至3，普通建筑升级以门前金色铺砖表达，城堡/住宅/市场使用原图变体。
