# 快递站老板素材来源

## 原创快递站像素画

`js/art.js`、`js/scene.js`：2026-10-19 为本游戏编写的原创 Canvas 像素图形。包裹、工作人员、货车、货架、分拣口、包装台、扫描设备、绿植及三处仓库场景使用有限调色板、手绘字符网格和逐像素材质生成，运行时绘制，不下载或复制第三方场景、人物和车辆图片。场景固定 195×260 源像素，对应 390×520 逻辑空间，最近邻缩放。货架队列、工人搬运和车厢库存读取本局真实状态；传送带包裹图片由 DOM 交互层使用同一生成器。

绘制方法参考本工作区 `games/zhenlie-demo/source/src/ui/pixel.ts`、`pixelItems.ts` 的逐像素 Canvas 和字符网格方法；新游戏场景和精灵为新编写内容。

## 已有 UI 像素生成器

`js/pixel.js` 直接复制自 `games/forest-lantern/js/pixel.js`，后者由 `games/zhenlie-demo/source/src/ui/pixel.ts`、`pixelItems.ts` 移植。保留既有九宫格、分隔纹、宝石、心形、皇冠、徽章、调色板、物品网格及自动描边实现。运行时生成 data URI，无外部服务依赖。

## 字体与许可证

`assets/fonts/russo-one-latin-400-normal.woff2` 与 `noto-sc-400/700/900.woff2` 直接复制自 `games/forest-lantern/assets/fonts/`。Russo One 原始来源为奇兵列阵工程 `node_modules/@fontsource/russo-one/files/`；Noto Sans SC 原始来源为该工程 `src/fonts/` 既有中文子集。两者均为 SIL Open Font License，完整许可证保留为同目录 `Russo-One-OFL.txt` 与 `Noto-Sans-SC-OFL.txt`。Noto 中文子集不保证涵盖新游戏全部汉字，界面缺字由系统中文字体回退；这两种字体不是点阵字体。

未修改用户源素材库和其他游戏资源。无认证或平台私密信息。
