# 像素美术来源

`js/art.js` 为本游戏新绘制的原生 Canvas 像素货物、薄荷绿货车、木制装卸月台与送货场景，无外部图片或远程依赖。货物以结构、材质和光影区分，并按玩法提供的格子轮廓裁切；不使用通用彩色多格骨牌代替实物。

绘制方法直接参照并阅读了工作区内：

- `games/zhenlie-demo/source/src/ui/pixel.ts`：低分辨率逐像素、分层材质高光与明暗调色板；一精灵像素对应两舞台像素。
- `games/zhenlie-demo/source/src/ui/pixelItems.ts`：有限调色板、清楚的对象剪影和像素图标结构。
- `games/forest-lantern/js/pixel.js`：浏览器 Canvas 缓存、data URL 和 nearest-neighbor 展示策略。现有 UI 材质算法由主模块单独复用。

货物图形及场景未复制上述游戏的角色或道具图案；不修改参考文件。无 AI 位图、字体或第三方美术新增。

`vase` 陶瓶为单格原生像素绘制，以开口细颈、鼓腹、青蓝釉面和米色釉带识别；与盆栽共用既有明暗方向和有限调色板。叠放高度与投影由玩法场景绘制，不烘焙进货物精灵。

## 商店媒体

`tools/render-media.mjs` 通过本地浏览器直接调用同一 `js/art.js`，为 `output/store/` 重新渲染满版方形图标（512×512）、横幅（1920×1080）和方图（1440×1440）；图标不预裁圆角。场景使用 `content.js` 第25单《全城托付》的实际车款、货物和已通过装卸检查的完整布局，不伪造界面、评分或玩家数据。当前v2宣传图仅保留“装车收纳”标题；初版横幅副文案已按平台预检反馈移除。宣传图在包体之外独立上传，未改变游戏运行时资源。

文字使用游戏已提供的 Noto Sans SC 字体文件（`fonts/noto-sc-900.woff2`），授权见同目录 `Noto-Sans-SC-OFL.txt`。每张图片独立在低分辨率 Canvas 绘制后用 nearest-neighbor 放大；未对现有位图改画或裁切，未使用 imagegen。

复现命令（游戏目录）：`node tools/with-lock.mjs render-store-media node tools/render-media.mjs`。当前宣传图尺寸、字节数和来源关卡记录在 `output/store/media-v2.json`，原图标记录仍为`media.json`。
