# 森灯小馆素材来源

## 像素客人

用户于2026-10-10明确确认Duelyst源库全部素材可直接商用（工作区AGENTS.md）。仅复制既有提取图，不修改源库。

直接来源：`games/zhenlie-demo/source/src/assets/units/`。原始库：`C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main`，原图位于`app/original_resources/units/`，帧元数据位于`app/resources/units/`。

|本地文件|原角色|用途|
|---|---|---|
|guests/n_merc.png|neutral_mercmelee1|冒险者客人|
|guests/n_medic.png|neutral_healingmystic|旅行者客人|
|guests/l_priest.png|f1_caster|施法者客人|
|guests/v_scout.png|f6_spiritwolf|林间动物客人|

均为14帧idle/breathing条带，单帧100×112，约1167ms循环。透明图保留原像素美术和既有处理的细白边。Canvas最近邻渲染，金币、餐盘、蒸汽由场景即时绘制，与状态关联。

## 餐馆背景

`restaurant.png`由本会话主责通过内置imagegen原创生成，1254×1254像素餐馆环境，无人物、四张餐桌、厨房与吧台；未复制其他游戏场景。场景采用等比例contain，客人与交互坐标使用同一映射；第五、六席使用背景现有吧台座位。生成具体提示词由主责记录。不使用MiniWorldSprites或32rogues素材。

## 奇兵列阵UI生成器直接移植（2026-10-19）

`js/pixel.js`直接复用本工作区`games/zhenlie-demo/source/src/ui/pixel.ts`的逐像素Canvas绘制函数：16×16九宫格（切片6）、横/竖分隔纹、宝石、心形、皇冠、数值徽章，以及六套原始调色板；复用`pixelItems.ts`字母网格、调色板与自动描边。仅去掉战斗阵营框、台座、战场背景和无关框架依赖。运行时生成data URI写入CSS变量，不依赖外部服务。

字体：`assets/fonts/russo-one-latin-400-normal.woff2`直接来自原工程`node_modules/@fontsource/russo-one/files/`，为完整Latin字形；`noto-sc-400/700/900.woff2`来自原工程`src/fonts/`既有中文子集，缺字由UI声明的Microsoft YaHei/PingFang SC/system-ui回退，不保证子集包含新游戏所有汉字。两字体为SIL OFL，原许可证完整保留于同目录`Russo-One-OFL.txt`、`Noto-Sans-SC-OFL.txt`。中文采用Noto原视觉，数值采用Russo One，不将其称为点阵字体。
