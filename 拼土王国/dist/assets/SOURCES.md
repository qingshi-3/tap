# 《拼土王国》美术来源

2026-10-19 按用户要求，通过内置 `image_gen` 为本游戏新生成三张透明 PNG 图集。没有使用本地素材库或外部图片作为生成参考；地形与资源图标以新生成的建筑图集作为风格参考。原始 PNG 未做重绘、抠图或像素修改。

完整生成提示词：[generated/prompts.json](generated/prompts.json)。实际图片与主体裁切坐标位于 `generated/`，运行时由 `art.js` 加载。

| 图集 | 布局顺序（从左至右、从上至下） |
|---|---|
| buildings.png | 王城、民居、农田、伐木场、矿场；渔场、集市、学堂、医馆、兵营 |
| terrain.png | 草地、森林、水域、山地、沃土；对应五类无高大树石的净地 |
| resources.png | 金币、粮食、木材、人口；幸福、学识、防务、空格 |

三张图集均为1536×1024，含真实透明通道。`frames.json` 记录完整主体的包围盒，避免按均分格裁切时切断旗帜或带入邻格对象。运行时只裁切与平滑缩放，不做透明通道分析。建筑保留宽高比；地形铺满方格。已有建筑下绘制同地形净地，避免树石穿模。建筑各有一套模型，等级由原有界面徽标表达，没有独立的升级外观图。

建筑以功能主体区分：城堡双塔、珊瑚红屋顶民居、麦垄南瓜、圆锯原木、矿坑吊架、船网码头、条纹摊棚、蓝塔书卷、绿叶药箱、盾牌靶场。

原生成文件标识：
- 建筑：exec-c5a141b1-b79d-4deb-8a15-2deeb9491e6b.png
- 地形：exec-43b97cac-601f-4929-a3b8-184a2e1456bc.png
- 资源：exec-0ebbf296-fdbb-4529-adb7-64975c58208a.png

旧 MiniWorldSprites 复制品已退出运行包，保存在游戏 `output/retired-art-20261019/world` 供历史追溯；未修改本地源素材库。本记录说明生成来源，不作额外的独占版权或平台审核保证。

接口：`loadArt()` 返回 `{loaded,total,reports}`（元数据加载失败时含error）；`drawTerrain(ctx,type,x,y,size,seed)`；`drawBuilding(ctx,type,x,y,size,level,ground)`；`drawIcon(ctx,key,x,y,size)`。绘图函数保存并恢复 Canvas 状态。缺失图集会触发游戏内加载失败提示，不回退到旧房屋素材。
