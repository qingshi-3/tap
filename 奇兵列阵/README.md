# 奇兵列阵

TapTap 横屏 H5 自走棋（Vite + TypeScript）。当前版本 v0.8.1（2026-10-22 后续修正），未发布。

## 文档

| 文件 | 内容 |
|---|---|
| `ISSUES.md` | **现状问题清单**：平衡、同质化、规则文本不一致，全部待拍板项都在这里 |
| `DESIGN.md` | 当前设计（v0.8 流派与主将重构）；数值以源码为准 |
| `output/试玩观察单-v0.8.1.md` | 真人试玩记录表 |
| `output/商店物料-v0.8.1.md`、`output/store-shots/` | 商店页文案与截图草稿 |
| `platform/binding.json` | TapTap 应用绑定（阿芙工作室 488823 / 应用 977726，未发布） |
| `dist/assets/SOURCES.md` | 素材来源 |

历史设计稿、平衡报告、审计原始结果和任务日志已在 2026-10-22 清理，需要时查 git 历史。

## 试玩

- 双击 `阵列-双击打开.html`（单文件，内嵌全部素材）。
- 或在本目录执行 `python -m http.server 8766`，打开 `http://127.0.0.1:8766/dist/`。
- 普通浏览器没有 TapTap 广告 SDK，激励视频不能播放。

## 开发（在 `source/` 中）

需要 Node.js 20.19+ 或 22.12+。

```bash
npm ci
npm run dev            # 开发服务器
npm test               # vitest
npx tsc --noEmit -p .  # 类型检查（含 scripts/）
npm run build          # source/dist/ 分包版
npm run build:single   # source/dist-single/index.html 单文件版
npm run sim            # 整局模拟
```

平衡工具：`scripts/combo-bench.ts`（推荐阵容基准）、`scripts/card-margin.ts`（单卡边际）、`scripts/passive-strength.ts`（被动强度）、`scripts/boss-probe.ts`（首领），用 `npx vite-node <脚本>` 运行。

构建不会覆盖根目录产物，发布到根目录：

```bash
cd .. && rm -rf dist && cp -r source/dist dist
cp source/dist-single/index.html 阵列-双击打开.html
sha256sum 阵列-双击打开.html > MANIFEST.sha256
```

## 约定

- `.ts` 文件是 CRLF，用脚本修改时保留换行符；CSS 是 LF。
- 手机优先：不靠悬停，舞台字号 ≥18，说明框不挡目标；常驻动画只动 transform/opacity。
- 不改 TapTap 应用名，不做排行榜，不上传/发布。
