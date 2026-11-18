# 场景转场

当前使用 `burn-away.png` / `burn-away.json`，来自 pixelfx 原版 `src/fx/transitions/burn-away.js`，MIT（https://github.com/patch-gg/pixelfx）。该效果保留原调色板、seed 3、火舌、烟雾和余烬，原注释注明 Sprite Fusion fire 的 MIT 来源（https://www.spritefusion.com/pixel-art-vfx/fire，Copyright 2026 Hugo Duprez）。未修改源库。

`tools/render-burn-away.mjs <pixelfx-checkout>` 调用原库 `loadEffect`、`renderFrames`、`contactSheet` 与 `spriteSheet` 实际导出；原320×180、3秒、91帧，图集2560×2160、2,281,004字节。实际运行压为1000ms，在450ms全遮黑点提交场景，之后中央烧开。接触表在 `output/cloud-cache/transitions/burn-away/contact.png`。

仅用于进入战斗、设置退出战斗与已结束战斗退出；主页、选关和配队无燃烧。manual popover把装饰层放在加载/目标弹窗之上，无popover时以原生dialog承载；缺少顶层API、资源未就绪、减少动态或页面不可见时即时提交。没有引入pixelfx运行库。历史 `camp-veil` 资产及生成脚本保留作为旧版制作记录，当前不再引用或播放。

