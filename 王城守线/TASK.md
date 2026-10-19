# 王城守线 · 活动任务

## 目标与授权

制作一款手机横屏普通 H5 单人塔防：玩家在地图塔位建造并升级不同类型的防御塔，分波抵御敌人，完成多个主题关卡。第一版专注本地可玩内容，不接广告、云存档、排行榜、分享、账号或支付。

用户已授权在当前主工作区实现游戏、整理已购买且可商用的 `C:/Users/qs/asset` CraftPix 素材，并完成必要的本地验证。2026-10-10 用户明确要求「发布一下 taptap」，已授权本游戏应用创建、资料整理、上传、草稿绑定与提审/上线流程；随后对为《王城守线》签署协议、提交审核和过审后自动上线的明确问题回复「同意」。不得修改源素材库。

## 当前本地实现

- 普通 HTML/CSS/JavaScript H5，无第三方依赖；`tools/build.mjs` 将源码生成经典脚本 `dist/game.js`，减少旧移动 WebView 对模块脚本的兼容问题。
- 三个横屏战区：青野隘口、断桥河湾、沉钟沼泽；每关 8 波并顺序解锁。
- 四类塔均支持建造、自动攻击、三级升级和出售；敌人包含普通、疾行、重甲、飞行和首领单位。
- 战斗包含金币、城门耐久、波次控制、暂停、1×/1.6×速度、胜败结算和失败重试。
- 塔防资源已经过筛选并复制到 `dist/assets/`，资源路径和动画帧信息由 `asset-manifest.json` 管理；来源记录保留在 `dist/assets/SOURCES.md`。
- 横屏手机战斗为全屏地图和轻量 HUD；点空塔位在附近打开建造菜单，点现有塔打开升级/拆除操作；短屏横屏适配安全区，竖屏显示旋转提示并暂停模拟推进。
- 双指缩放战场 1～2.5 倍，放大后单指拖动；绘制、点击判定与菜单锚点共用同一坐标变换。HUD 不参与缩放，拖动受地图边界限制，多指手势余下的一指不会触发点击，换关重置视图。
- `tools/package.mjs` 从 `dist/` 收集运行时文件，排除素材来源文档和系统元数据；输出单目录 H5 ZIP 与包体/逐文件 SHA-256 清单。`npm run package` 会先构建经典脚本再打包。

## 文件与恢复入口

- 页面与交互：`dist/index.html`、`dist/style.css`、`dist/main.js`；移动 WebView 入口为构建生成的 `dist/game.js`。
- 关卡配置：`dist/levels.js`。
- 塔、敌人、波次和战斗规则：`dist/simulation.js`。
- Canvas 地图、单位与特效：`dist/renderer.js`。
- 运行时素材目录：`dist/assets/`；素材来源：`dist/assets/SOURCES.md`。
- 本地服务：在本目录运行 `npm run dev`，打开 `http://127.0.0.1:4181/`（4180 已由其他游戏预览占用）。
- 包装入口：`npm run package`；输出到 `build/`，不会上传。

## 验收与下一步

- 桌面宽屏既有交互曾通过实操：关卡选择、建造、升级、拆除、波次启动、暂停/继续、加速，以及键盘选位；退出战斗的二次确认也已检查。
- 已在模拟手机横屏视口 844×390 通过浏览器实操：点塔位弹出塔种菜单、选择弓箭塔后立即建造（360→270 金币）、升级（270→149）、拆除返还（149→267）、开始波次并观察敌军推进、切换 1.6×速度和暂停。菜单定位会根据选中塔位调整。
- 已在模拟竖屏视口 390×844 确认“请横屏游玩”覆盖层出现；战斗中转为竖屏后，敌人数在稳定观察区间保持不变。浏览器开发日志没有错误或警告。
- 当前包为 0.1.6，86 文件、249,997 字节；入口 `castle-ward-h5/index.html`，经典脚本、ZIP CRC、单根目录及逐文件 SHA-256 已检查。详细记录见最新战斗 UI 章节；旧包保留。
- 本地预览地址仍为 `http://127.0.0.1:4181/`；不得关闭正在使用的预览服务。
- 仍需完整打通三关并按结果检查整体难度、失败重试和通关解锁；TapTap 宿主尚未实测。
- TapTap 的 0.1.0 曾提交正式审核，后有 review_withdrawn 记录；当前读回仍为未发布草稿。最新 0.1.6 已上传独立开发版、未绑定主槽或提审，详情见最新战斗 UI 记录。

## TapTap 发布准备（2026-10-10）

- CLI 2026.9.24、catalog 1.0.49；认证存储沿用 keychain，无凭据进入客户端或项目。已读账号与应用列表，本游戏为阿芙工作室（488823）的独立应用 968761，miniapp `tapmczgouni5thmw5m`，未复用其他游戏。
- 已用稳定幂等键和 dry-run 创建、上传、绑定、保存资料。上传任务 `7e5685ca-13f8-4d6d-9552-bbda2f675a15`，H5 version 284860、底层上传 package 78049；主槽读回为 `kind=h5 / h5_version_id=284860`。本次 CLI `list-h5-packages.package_id` 和二维码接口使用 284860，不能将底层上传 ID 78049 填入二维码接口。
- 草稿 revision/version_id 1057150，展示版本 V-20261010。手机平台保留 MOBILE，Android=4、iOS=0，当前动态标签均为「提供游玩」；这是草稿设置，不代表已公开生效。
- 已回填并读回：1024×1024 城堡盾徽图标、简介、开发者的话、开发商名称、1920×1080 宣传图、三张 1920×1080 真实截图、首页推荐语与宣传图选项。
- 物料位于 `media/`：图标为本地 authored SVG 渲染；截图取自 960×540 手机横屏布局，浏览器直接按 2 倍导出。首次将关卡界面作为 banner 被预检指出不适用；已换成内置 imagegen 生成的宣传插画，仅保留游戏标题。生成原图 `banner-v2.png`，平台导出 `banner-final-1920x1080.png`（3,350,490 字节），提示词留在 `banner-prompt.txt`。三张游戏截图仍为实际界面，无虚构画面。
- 宣传图涉及生成式图像，已保存 `has_ai_content=true / provide_aigc_service=false` 的 AI 声明；资质读回为 uploaded，未单独提审。其余资质槽为空并不等于全部必交；当前 `analyze-app-status` 无必须资质缺口 warning。
- 前一阶段 `review-snapshot-final.json` 返回 ready、无 warning；`review-precheck-final.json` 返回 `preaudit_passed=true`、无 warning，曾因 `SCE_AGREEMENT_REQUIRED` 阻塞。用户随后明确同意，《创意工坊内容授权协议》已签署，最新预检已无该 blocker，正式提交见下节。
- 实机录屏是当前服务端建议项，未提供。完整三关和 TapTap 手机宿主仍未验收；浏览器取图时实际建造弓箭塔、升级、建造秘法塔、守住第一波并观察第二波移动与攻击，不将这视为完整通关或手机宿主验证。
- 0.1.0 开发版二维码页由平台返回：https://www.taptap.cn/qrcode/miniapp?id=tapmczgouni5thmw5m&type=develop&version_id=284860 。直接 HTTP 下载曾被 WAF 拦截，错误响应归档为 `platform/test-qr-fetch-waf.html`；随后已将平台返回的链接本地编码为 `media/test-qr-284860.png` 并解码核对，不将 WAF HTML 称为二维码图。
- 完整请求、返回与写后读回保存在 `platform/`。公开绑定为 `../../docs/platform/castle-ward-h5.binding.json`。本地 4181 预览保持运行；取图临时视口已恢复。

### 已提交审核与恢复入口

- 用户明确「同意」后，已对 app 968761 使用同一幂等键 `castle-ward-sce-agreement-20261010` 预览并签署；返回 `signed`。`status-after-agreement.json` 读回无 blocker/warning，实机录屏仅为 suggestion。
- 已重读手机发布状态、主包体、资质与完整历史；资料与包体没有漂移。`snapshot-after-agreement.json` 和 `precheck-after-agreement.json` 均为同一 version_id 1057150；预检 `preaudit_passed=true`、blockers/warnings 为空。
- 已用 `castle-ward-review-1057150-20261010` 和 `platform/release-request.json`（immediate）完成 dry-run 与正式 submit；`submit-result.json` 返回 accepted handoff 和 `status=reviewing / audit_id=1057150`。
- `history-after-submit.json` 和 `version-after-submit.json` 均确认「审核中」，事件 `review_submitted`，提交时间 Unix 1791634856。这条为提交后的历史记录；当前状态以本轮修复后的读回为准，不得据此宣称仍在审核或已上线。
- 下一次检查应在平台审核结果更新后执行 `node tools/taptap.mjs <record> app list-app-versions --dev-id 488823 --app-id 968761 --page-all` 与 `app get-app-version --data '{"version":"V-20261010"}'`。若驳回，读取同版审核原文并处理；若状态为 online，再核实公开手机游玩入口后将公开绑定和本任务更新为已上线。
- 完整历史无 online/offline/published 证据，本次目标为首次正式上线。内置官方交接为 [首发上线期运营手册](https://developer.taptap.cn/docs/store/operation/events/events-handbook/)，用于了解首发期推荐与社区活动，不承诺流量结果。

## 手机试玩反馈修复（2026-10-10，0.1.1）

- 用户指出塔素材是由地基到成品的建造过程，要求成品外形、星级与环绕粒子表示升级；同时删除顶部横向背景板及左下角图例。
- 四种塔统一使用源素材 `2 Idle/7.png` 的完整建筑，一级起即呈现完成态；manifest.completed 与 idle[0..2] 指向同一帧条，升级不再播放建造阶段。等级以 1～3 颗真实五角星和克制粒子显示；升级爆发 0.7 秒，部署阶段正常结束、暂停冻结，reduced-motion 为静态表现。原素材库未修改。
- HUD 改为浮动的城门、金币、波次图标与数字、独立速度/暂停按钮；移除整个横条及左下角图例。建造菜单只裁切塔动画首帧，44px 触控区域保留；短屏右上为 TapTap 胶囊预留空间。返回确认的「继续守城」同时关闭弹窗并恢复原暂停状态。
- 使用 CUA 真实输入检查 844×390、667×320 手机横屏：四种塔建造/拆除，弓箭塔 1/2/3 星、秘法塔 1/2 星，开波、加速、暂停/继续、菜单关闭、返回取消和键盘方向键/Enter。667×320 的建造菜单为 360×140，未越界；卡片 80×70、顶部/关闭按钮至少 44×44。390×844 竖屏提示可见；暂停截图稳定，reduced-motion 下完整渲染截图稳定，最终页面日志无 warning/error。证据：`output/playwright/visual-update-evidence.json` 和同目录截图。裁剪截图接口的重复采集存在坐标偏移，最终静态验证改用完整截图，不将裁剪差异归因于游戏。
- 打包 `build/castle-ward-h5-0.1.1.zip`，79 个文件、176,093 字节，SHA-256 `1157a53df97ce345ae9d871f47b5d5f545110a639f94e7f9ac1993f91dec23bb`；ZIP CRC、根目录入口及逐文件 SHA-256 已核对，原 0.1.0 ZIP 保留。本地 4181 服务 PID 38952 保持运行。
- 按既有本游戏上传授权，以 `castle-ward-h5-011-visual-20261010` 完成 dry-run 与上传。H5 version 284979、底层 package 78107、CLI task `ae7b2075-de28-4a18-8329-62b0d2958e00`；ready/横屏/文件名/字节数均读回。`visual-update-upload-result.json`、`visual-update-package-list.json` 留存。
- 试玩入口：https://www.taptap.cn/qrcode/miniapp?id=tapmczgouni5thmw5m&type=develop&version_id=284979 。从平台返回链接本地编码为 `media/test-qr-284979.png`，已解码验证；来源与验证记录 `platform/visual-update-qr-image.json`。未将链接编码结果声称为官方直接下载的 PNG，TapTap 手机宿主仍待用户实测。
- 平台状态变化：上传前原版 1057150 是 reviewing；本轮最后读回新增 review_withdrawn（Unix 1791636348），当前为 draft/未发布。当前任务未调用撤回接口，发起方未知。`review-after-visual-upload.json` 为版本证据；`slots-after-visual-update.json` 确认 main 仍绑定旧 H5 284860，新 H5 284979 是 ready 候选。0.1.1 仅开发版上传，尚未绑定主槽、提审或上线。
- 下一步：用户用新码检查实际手机效果。后续恢复发布前重读当前版本与 package_slots.main.expected，按新包、最新资料截图及实际状态处理，不能继续将旧包认作修正版或复用旧提审幂等键。

## 灵动岛与塔位菜单修复（2026-10-10，0.1.2）

- 用户补充横屏 iPhone 灵动岛避让，并指出建塔/升级大弹窗突兀。本轮将两项反馈一起完成；未修改源素材、存档契约或正式发布状态。
- `style.css` 建立统一 UI 安全矩形：普通边距至少 16px，短横屏左右至少 72px；系统 inset 大于保底时加 12px 缓冲，顶部加 8px、底部加 12px。地图保持全屏，返回、HUD、塔位菜单、波次控制、关卡页、弹窗和 toast 使用安全边界。短横屏右上另外留 104px 给 TapTap 胶囊；568px 宽时将波次换至第二行。
- 建塔菜单为四个独立塔图标与价格（整体 292×86px，卡片 56×86px）；塔操作为名称/星级及升级、拆除按钮（整体 220×96px），没有整块背景板和重复标题。按钮至少 44px；射程等参数不再常驻占据战场。紧凑模式取消重复建成/升级文字，状态由建筑、星级和金币反馈。
- `main.js` 从 canvas 与 command-dock 实际矩形计算锚点，实测菜单宽高并在 DOM 更新后下一帧复测。菜单既避让 HUD，又避让塔身（绘制区域 WORLD y-100 至 y+30）；空间不足时限制在安全矩形内。旋转及 resize 会重排。
- 浏览器实操覆盖 844×390、667×320、568×320：建造、升级、金币不足禁用、拆除返还、边缘/底部塔位、左右安全范围切换、开波/加速/暂停/继续、返回取消、关卡页与玩法弹窗、键盘方向键/Enter/Tab。焦点轮廓可见，reduced-motion 偏好可读回且截图已检查，竖屏旋转提示可见。页面没有 warning/error；测得菜单与按钮范围均通过检查。证据：`output/playwright/compact-safe-area-evidence.json` 和 `compact-menu-*.jpg`、`safe-area-*.jpg`。
- CDP 不支持 `Emulation.setSafeAreaInsets`；较大左/右安全区以隔离验收页的临时 CSS 属性模拟（102px/72px 互换，底部 33px）。模拟已清除，viewport 与 reduced-motion 覆盖已恢复。浏览器验证不等于物理 iPhone 或 TapTap 宿主验证。
- 包体 `build/castle-ward-h5-0.1.2.zip`：79 文件，178,382 字节，SHA-256 `40df8d80991e40000daf56fcff03d2bc5dd9593cff00b91a317273a4c58e9f2f`。ZIP CRC、根目录入口和逐文件 SHA-256 均已核对；旧包保留，本地 4181 预览服务继续运行。
- 按已有上传授权使用 `castle-ward-h5-012-compact-safe-20261010` 完成 dry-run 和上传；H5 version **285063**、底层 package **78149**、CLI task `66a95752-26fe-4ac2-919c-a95b7b1f6a28`。ready、横屏、包名与字节数已读回，记录为 `platform/compact-ui-upload-result.json`、`compact-ui-package-list.json`、`compact-ui-slots.json`。
- 新试玩入口：https://www.taptap.cn/qrcode/miniapp?id=tapmczgouni5thmw5m&type=develop&version_id=285063 。将官方返回 URL 本地编码为 `media/test-qr-285063.png` 并解码核对，来源见 `platform/compact-ui-qr-image.json`。0.1.2 仍是独立开发版，主槽维持 284860，当前版本仍为 draft，状态见 `platform/compact-ui-status-after.json`。
- 下一步：用新码检查 iPhone 左右横屏、建造与升级操作。正式重新绑定/提审前重读当前版本和主槽，并按最新视觉更新商店截图；完整三关与 TapTap 宿主验收仍未完成。

## 单位比例与脚底锚点修复（2026-10-10，0.1.3）

- 用户反馈单位太小，头脚都被框在道路里。根因是透明留白参与整帧缩放：普通敌人 48×48 原帧本体只有约 22×19，原来画成 46×46 WORLD 方块时角色高仅约 18。源素材与模拟规则未改。
- manifest 每类三方向增加 `contentBounds`，由六帧非透明像素并集得到；已核对 5 类/15 方向/90 帧，所有可见像素均包含在边界内。每方向使用固定并集，避免动画逐帧裁切导致抖动。`footX` 是作者帧中心，`footY` 是并集底边，源 PNG 保持不变。
- renderer 使用每类固定像素比例，参考高度是三方向最大本体高度；目标可见高度 grunt52、runner64、armored66、flyer64、boss96 WORLD px。地面单位的脚底对齐路径 x/y，身体向上展开；飞行单位身体上浮 12，影子仍留在地面。上下/左右方向和翻转不改变像素比例。
- 敌人绘制副本按脚底 y 稳定排序，不重排模拟数组；血条、阴影、减速环和受击闪光按实际本体边界定位。非投石弹丸在显示层渐进抬到身体中心，投石弹继续落地，视觉状态使用 WeakMap，不修改弹丸轨迹计算、碰撞、血量、速度或伤害规则。
- 实操验证：正常输入建造弓箭塔/秘法塔并开波，第一、第二波守住，第三波真实命中时采集放大敌人、血条与弹丸截图。五类、上/下/横向及翻转另用隔离合成场景验收，不能把合成场景称为正常波次；所有方向像素比例一致、翻转绕脚底，绘制后敌人数组顺序仍一致。截图覆盖 844×390 与 667×320；记录 `output/playwright/unit-size-evidence.json`，真实战斗截图 `unit-size-combat-844x390.png`，合成场景 `unit-size-five-types-fixture-*.png`。
- 浏览器 viewport capability 未实际作用于本轮新标签；改用该隔离标签的 CDP device metrics，读回 CSS 视口尺寸并用原始 Page.captureScreenshot 取图。原先误命名为 844×390 的旧截图已按实际尺寸改为 `unit-size-before-1280x720.jpg`。波间暂停入口正常，但当时无在场单位，未据此宣称战斗中暂停单位已实测。页面日志无 warning/error，临时设备指标已清除，测试标签已关闭；预览 4181 仍运行。
- 包体 `build/castle-ward-h5-0.1.3.zip`：79 文件、180,715 字节，SHA-256 `4288b3d08213b8c6fbf0e6eb63d74889d1524d4b67c616ad24294f18586f9f55`；ZIP CRC、单根目录入口、逐文件 SHA-256 已核对，隔离验收产物与 SOURCES.md 不在客户端包中。
- 使用已有开发版上传授权，以 `castle-ward-h5-013-unit-scale-20261010` 完成 dry-run 与上传。H5 version **285110**、底层 package **78177**、CLI task `25be98b2-d457-4d66-a08d-75201861afe1`，ready/横屏/文件名/字节数均读回。相关记录为 `platform/unit-size-*.json`。正式主槽仍是 284860，当前发布版本仍 draft；本轮未重新绑定、提审或上线。
- 新入口：https://www.taptap.cn/qrcode/miniapp?id=tapmczgouni5thmw5m&type=develop&version_id=285110 。二维码 `media/test-qr-285110.png` 由官方返回链接本地编码，已解码核对。下一步用户用 0.1.3 新码检查手机单位比例；Agent 未进行物理 iPhone/TapTap 宿主验证，完整三关与正式发布准备仍待继续。

## 双指缩放与战场拖动（2026-10-10，0.1.4）

- 用户要求增加手机双指放大/缩小。renderer 使用 canvas WeakMap 保存倍率和世界中心，范围 1～2.5；双指中点移动与距离变化同时作用于同一世界锚点，单指拖动按实际 scale 转換，地图边缘受约束。render、canvasPoint 与菜单 world→client 定位共用变换，DOM HUD/菜单保持原尺寸。
- main 跟踪 Pointer Events，8px 移动阈值区分点击和拖动；多指接触后整个序列（包括最后一指）禁止点塔/建塔。pointer capture 保持拖动，cancel、lost capture、旋转/resize、失焦、切后台、弹窗和换关清理指针；新战斗重置视图。拖动/缩放时关闭选中菜单，短屏放大的塔上下空间不足时，在安全矩形内比较侧边位置与塔身/星级的遮挡面积，优先移到塔旁。
- 浏览器实操：844×390、667×320 放大后的准确点位、建造弓箭塔（360→270）、升级（270→149）、关闭、拆除（149→267）、暂停/继续、键盘 Tab 动作焦点、实际鼠标 Pointer Events 拖动与原生 capture、边缘约束及重新进关复位。HUD 在金币相同时跨倍率矩形完全一致；首次把 360 与 149 的资源宽度直接比较产生 1.36px 字形宽度差，已保留诊断并按相同金币复测。390×844 旋转提示、活跃手势清理和 reduced-motion 画面也已检查，页面 console 无 warning/error。
- 内置浏览器不支持 `Input.dispatchTouchEvent` 或原生 pinch 注入；双指张开/捏合、移动中点、两指转一指、第三指、cancel 和 lost capture 使用隔离 DOM PointerEvent 序列检查，仅模拟 ID 的 capture 使用 Set 替身，真实鼠标指针仍走浏览器 capture。该覆盖不能称为真实手机双指实测。证据 `output/playwright/pinch-zoom-evidence.json`；最终截图 `pinch-zoom-upgrade-844x390.png`、`pinch-short-menu-667x320.png`。临时页面与设备/动效覆盖已清理，用户预览服务和原标签保留。
- 包体 `build/castle-ward-h5-0.1.4.zip`：79 文件、184,178 字节，SHA-256 `39fb3b226bf60d04ba0b6da0b66583240ca00c2a9d1256983b1e58c76ead2ec9`。构建及 ZIP CRC、根目录、逐文件哈希核对通过；日志 `output/pinch-package.log`，记录 `output/pinch-package-evidence.json`。
- 按既有开发版上传授权，以 `castle-ward-h5-014-pinch-20261010` 完成 dry-run 和上传；H5 version **285158**、底层 package **78201**、CLI task `44198913-05a5-4abb-a9e3-d26452014abd`。ready、横屏、文件名和字节数已读回，记录为 `platform/pinch-*.json`。正式主槽仍为 284860，发布版本仍 draft，未重新绑定或提审。
- 最新试玩：https://www.taptap.cn/qrcode/miniapp?id=tapmczgouni5thmw5m&type=develop&version_id=285158 。`media/test-qr-285158.png` 由官方返回 URL 本地编码并解码核对；公开绑定已更新 development_preview。下一步用新码在物理 iPhone/TapTap 宿主检查双指手感、单指拖动、安全区和手势松手误触；真机、完整三关及正式发布准备仍待继续。


## 战斗 UI 升级（2026-10-11，0.1.5）

- 用户要求参考《王国保卫战》等成熟塔防重做建造、升级 UI，换模型后明确继续。已参考其紧凑动作、图标与价格层级，使用本项目原创 CSS 木质/金属包边及 SVG 图标；继续复用购买素材中的完整塔精灵。无新增 Ironhide 素材或客户端依赖。
- 建造四卡 300×98，塔种色条、完整塔预览与金币铭牌；升级菜单 220×113，塔名与三颗星直接浮于地图，升级用双上箭头、拆除用锤子、满级用皇冠。缺钱按钮保持不透明且标记「金币不足」。常驻控制按钮统一包边，资源数字换为清晰字体；未添加顶部整条底板或左下角提示。
- 菜单沿用相机坐标与安全矩形，并加入实际波次区遮挡评分。短横屏左右 72px、顶部 TapTap 胶囊预留继续生效；全部菜单动作触区至少 44px。详情按升级可负担性刷新，金币普通增长不会每次重建动作；重建时只恢复原详情内的有效动作焦点。
- 本轮委派 gpt-5.6-sol 仅修改 main.js 标记、状态与定位；主责完成 CSS、来源记录、集成、实际浏览器检查及平台步骤。游戏规则、存档、塔动画、单位比例和相机实现未改动。
- 隔离 Edge/Playwright 实操覆盖 844×390、667×320、568×320：点塔位建弓箭塔 360→270，升级 270→149，金币不足状态禁用，拆除返还至 267；右侧边缘菜单、开波、暂停/继续、键盘 Tab 可见焦点、减少动态效果、390×844 旋转提示。截图见 output/playwright/ui-refresh-*.png，数据见 ui-refresh-evidence.json。尺寸改变后的旋转提示等待实际显示再判定；即时读回曾早于 resize 处理，不据此判为界面失败。
- CDP 原生双触点从空白战场开始，放大约 1.98 倍，松手保持金币与塔数；随后真实点击放大后的塔位完成建造。最初有菜单时一次手势落在 UI 上未放大，关闭后在战场操作正常；未把 UI 上的触摸视为地图手势。满级使用隔离金币 1000 的临时场景，再点击两次升级，检查皇冠和拆除退款 217；未修改真实存档。zoomMenu 尺寸记录含 DOM 改变后的即时测量，随后截图为定位完成状态。无页面 JS 错误，测试浏览器已关闭；恢复并保留 4181 本地预览。
- 包体 build/castle-ward-h5-0.1.5.zip：79 文件、186,696 字节，SHA-256 e1cf54dddfeb614b21ff728a91d2a8b49de29faaf83fb81e255440d964d43ce1。构建与 ZIP CRC、单根目录、逐文件哈希通过，日志 output/ui-refresh-package.log、记录 output/ui-refresh-package-evidence.json。
- 使用已有开发版上传授权，先读取草稿和主槽，按当前 CLI help 完成 dry-run 与上传，幂等键 castle-ward-h5-015-ui-20261011。H5 version 287752、底层 package 79491、task bb928222-12c1-40fd-8981-82080884df68，ready/文件名/字节数/横屏方向均读回。主槽仍 284860，发布仍 draft；本轮未绑定主槽、提审或上线。平台记录为 platform/ui-refresh-*.json。
- 新试玩 https://www.taptap.cn/qrcode/miniapp?id=tapmczgouni5thmw5m&type=develop&version_id=287752 ，二维码 media/test-qr-287752.png 由官方返回 URL 本地编码并解码核对；公开绑定 development_preview 已更新。下一步用户在物理 iPhone/TapTap 宿主试玩菜单观感、安全区与触控，完整三关及正式发布准备仍待继续。


## 动作图标替换（2026-10-11，0.1.6）

- 用户继续反馈动作图标难看。已筛选购买的多套 UI，采用 Warforge 同套厚描边与立体高光图标，替换原细小 SVG：升级、拆除、满级、返回、关闭、暂停、继续、加速与开波。7 张透明 PNG 从源素材逐字节复制，来源见 SOURCES.md；未修改源库。主要动作图标放大并按原比例适配，保留现有按钮尺寸、安全边距、菜单定位和游戏逻辑。
- gpt-5.6-sol 子 Agent 只读筛选另外三套素材；主责完成选择、集成与验收。无需新增客户端依赖。
- 隔离 Edge/Playwright 844×390、568×320 实操建造 360→270、升级 270→149、缺钱禁用、拆除返还 267、1.6×、开波、暂停/继续；关闭菜单与返回确认正常。图标请求加载成功，无 pageerror。满级星徽通过隔离金币 1000 后真实点击升级检查，Tab 焦点可见，减少动态效果截图保留。证据 output/playwright/action-icons-evidence.json 及 action-icons-*.png。测试浏览器已关闭，4181 预览继续运行；物理 iPhone/TapTap 宿主待用户试玩。
- 0.1.6 ZIP 86 文件，249,997 字节，SHA-256 a7e34f8be05e296905213eb77baf2b99a8b4ec08037d97075f67638983a8a7c7。构建、CRC、根目录与逐文件哈希核对通过。
- 按既有开发版授权完成 dry-run 和上传，幂等键 castle-ward-h5-016-icons-20261011；H5 version 287788、底层 package 79507、task f95dbb91-cfe0-43e8-bca8-f0f79641bcf2。ready、横屏、文件名、字节数均读回；主槽仍 284860，本轮未提审或上线。platform/action-icons-*.json 为记录。
- 新试玩：https://www.taptap.cn/qrcode/miniapp?id=tapmczgouni5thmw5m&type=develop&version_id=287788 。二维码 media/test-qr-287788.png 由官方 URL 编码并解码核对；binding development_preview 已更新。


## 战术地图与驻军（2026-10-11，0.2.0 已上传开发版）

用户明确要求重排地图坑位，并加入 Duelyst 固定驻守单位、更多敌人、特效与音效。范围：保留四建筑，增加四驻军（寒霜/闪电/火焰/近战），四敌种（虫群/治疗/抗魔/重甲），重排三张单路线地图；不引入自由寻路或修改真实进度。Duelyst 素材沿用用户商用授权。手机横屏、安全区、局部菜单、双指手势继续为约束。

分工：td_map_layout 仅 levels.js+地图几何证据；td_combat_expansion 仅 simulation.js+隔离验证；duelyst_td_assets 仅 assets/duelyst、素材准备脚本与输出；主责 renderer/main/style/index/audio、集成和验收。资料/发布管理由主责负责。

验收：坑位距离与路线覆盖；8 防守类型可布防升级出售，4 敌种机制有不同克制关系；原始精灵动画、命中特效、有静音入口且受手势解锁的音效；实操手机布局及战斗，单独标识合成机制场景；包体与平台状态按实际记录。恢复入口为本节和三个 Agent 的接口消息。


### 0.2.0 交付记录

- 三图完成 9/8/9 据点重排，弯道与交叉火力覆盖、出口补防；最小坑位间距 94.1/107.5/96.1 WORLD px，全部 y≥180，近战塔可触及道路。河湾据点位于陆地，补齐地基材质与岸边装饰。
- 四建筑 + 四 Duelyst 固定驻军，九类敌人；阵营动画、按真实轮廓缩放、物理/魔法抗性、地空目标筛选、减速、不可叠加灼烧、三目标闪电、带免疫时间的眩晕、范围治疗完成。四套特效、十个音效带并发/频率上限，暂停/后台停声，弹窗可静音。准备阶段点顶部波次旗查看真实下一波构成。
- 菜单分建筑/驻军，每组四卡，保留小型升级与撤回、安全区和原双指相机。修复 canvas pointerup 打开菜单后合成 click 点穿导致自动消费的问题；命令必须始于同一按钮的 pointerdown，键盘激活保留。
- 浏览器真实输入：568×320 的三关全部据点点选/关闭均无误消费；844×390、667×320 招募；短屏升级 220→32、撤回→216；CDP 原生双指放大 2 倍不建塔，单指拖动后准确选择、升级至 2 级。音效 running/10 缓冲，可关/开，暂停后敌人及效果状态冻结；reduced-motion 截图已检查。记录 output/playwright/garrison-expansion-evidence.json。首次缩放把左侧驻军移出屏幕，拖回后完成选取，未将出屏点击认作成功。
- 普通输入混合布防通过前两波，第三波虫群观察；隔离后期合成场景单独验证四驻军与新增敌种画面、寒霜/闪电/火焰/近战/治疗效果和音效，不冒充正常经济流程。机制检查覆盖抗性、状态叠加/过期、飞行免疫、闪电上限、治疗边界、出售清理及终局，三关自动布防通关剩余 20/19/18 生命。完整人工难度及物理 iPhone/TapTap 宿主仍未验收。
- 0.2.0 ZIP：110 文件、876,742 字节，SHA-256 3885e5968cf309dedd70af60c6b5835fed526603c6f9f58fa22505e40ef4a7ec；CRC、单根入口、逐文件 hash 通过。素材来源文档不进入客户端；旧包和用户源库保持不变。
- 按已有开发版上传授权完成状态读取、dry-run 与上传，幂等键 castle-ward-h5-020-garrison-20261011；H5 version 287866、底层 package 79544、task cf7bd717-2759-470f-ab12-7445567cee8a。文件名、字节数、横屏方向读回，主槽仍 284860、发布仍 draft；本轮未绑定主槽、提审或上线。记录 platform/garrison-*.json，公开 binding development_preview 已更新。
- 试玩 https://www.taptap.cn/qrcode/miniapp?id=tapmczgouni5thmw5m&type=develop&version_id=287866 ，media/test-qr-287866.png 由平台返回 URL 本地编码并解码验证。下一步由用户试玩驻军组合、后期敌群和手机音效；平衡与地图精绘可基于真实反馈继续，当前主打战术布局和内容组合。隔离浏览器已关闭，4181 预览保留。


## 当前任务：按成熟塔防建立数值与素材映射（2026-10-11）

### 当前有效意图

- 用户选择「关卡战役与兵种解锁」，随后明确纠正：数值必须多抄少自己编，参考成熟塔防，不做玩法差异化；自有素材是差异化，核心工作是素材与已有单位职能的合理映射。该要求高于先前自拟平衡计划，已写入根 AGENTS.md。
- 研究口径统一 KR1 初代移动/Steam 战役普通难度、未购买星天赋，不混用 Frontiers/Origins/Battles/Genesis 的数据。公开资料未注明精确补丁号，不能宣称逐帧复刻。
- 本轮完成参考基线与素材映射初稿；仍未将它接入客户端。当前可玩/已上传版本保持 0.2.0（287866）。

### 纠正与工作区状态

- 曾委派实现自行设定的升级倍率、波间20金、70%出售与按关开放四/六/八类阵容；用户纠正后立即停止。main.js、simulation.js 已从已核对的 0.2.0 ZIP 恢复，game.js 未动，没有构建/上传该草稿。
- 这份旧方向草稿及存档安全逻辑保存在 output/pre-reference-draft/（main.js、simulation.js、progression.js），仅供复用安全代码，不作为数值权威；output/balance-behavior.test.mjs、balance-strategies.mjs 对应旧方向，同样不可用来验收新方案。
- 仍值得复用的工程修复：旧版末关 selectStageNext 提前 return 导致未写 wins；v1→v2迁移保留原v1、坏v2禁止回退覆盖、最佳星不下降。重新集成前需要接入已经查证的星级规则并做真实行为验证。

### 参考数据与差异

权威恢复入口：docs/kingdom-rush-reference.json。包含逐项来源、四系基础塔成本/攻速/伤害、前三关节奏、敌人数值、素材映射候选与未核实项。所有数值是社区资料查证记录，不冒充官方导出表。

- 原作弓塔建造/升2/升3分别70/110/160金，面板伤害4–6/7–11/10–16，间隔0.8/0.6/0.5秒；法师与炮有独立成长，不能共用自创统一倍率。
- 原作四系基础从开局提供，后续按关开放塔等级与专业分支；并非每关自选解锁两个已完成的高级兵种。
- 默认20命，18–20命三星、6–17命二星、1–5命一星；开战前全额退，开战后默认60%，弓系特定天赋可提高退款。前一草稿60%/90%星级阈值与70%退款作废。
- Southport为265金/7波/8坑/一级上限；Outskirts为220金/7波/7坑/二级；Pagras为300金/11波/12坑/二级。前三关逐步引入小兵、兽人、狼、治疗和巨人；飞行怪第6关才出现。与现三张8波/全部敌种的安排不同。
- 原作护甲按百分比；法师单体魔法、火炮按半物甲计算爆炸并有半径衰减，电击也是炮系伤害。当前固定减甲、基础法师自带溅射减速均不能直接承接原值。
- 兵营是3个可受击/阻挡/回血/死亡补员的战斗实体。当前固定无敌近战单位不等价，必须补齐兵营机制后才能照搬依赖阻挡的关卡。火雨/援军及提前开波也属于原有平衡体系，不能遗漏后再靠瞎改伤害补偿。
- Wikily将部分投射物伤害按实际向上取整列值，Fandom按面板显示；射程也有半径/长轴直径差别。资料冲突必须明确字段，未核实出兵间隔/地图坐标/取整边界不猜。

### 素材映射与实施顺序

1. 先完成「原型职能—数值来源—自有精灵—攻击/命中效果」映射：建筑弓/法/投石可直接承接基础三系；兵营用自有据点与剑盾小队。已查看 f1_silverguardsquire、f3_pyromancer 原图集，分别是剑盾近战与施法动画；原素材不改。
2. 驻军外观作为成熟塔系的表现形式。f2_stormkage 候选映射 Tesla 连锁电；f6_icedryad 候选映射 Ranger 的射击与购入控制技能；火焰术士需按法师/诅咒系选择，不能因火焰外观自动附送AOE/DOT；铁誓卫士更适合重甲兵营分支。候选不等于已完成机制或动画验收。
3. 先补比例护甲、独立等级数据、兵营阻挡/敌方攻击/补员与原版援军/火雨；保留现有触摸相机、安全区与紧凑菜单。
4. 再按参照关卡的道路拓扑、覆盖时间、坑位及出兵时间映射自有地貌；不能只复制金币和怪数、继续用任意长路后说平衡相同。前三关先建立可比切片，再展开高级分支与后续地图。
5. 按原作星树与等级解锁接入成长，复用草稿的安全存档逻辑。只把确有素材/平台约束的适配列入差异表；未核实参数不进入发布包。

验证边界：本轮是网页资料核对与原素材查看，未把参考方案实现或上传；无新游戏行为验收。后续恢复时沿本节与reference.json继续，不再沿已作废的自拟数值草稿。


### 0.3.0 实施与交付（2026-10-11，替代上文研究阶段状态）

- 用户要求直接落实。沿 KR1 初代普通、未购星天赋基准接入 balance.js；八种建筑/驻军外观映射弓、法、炮、兵营四系。逐级独立费用、伤害、攻速、半径与比例抗性生效，不保留基础驻军免费减速/连锁/燃烧/眩晕。
- 兵营真实 3 名士兵、敌方近战、阻挡、阵亡10秒补员、恢复和触控集结；修复非战斗阶段不走路/回血/补员/援军不消失的问题。援军与火雨、解锁与冷却接入并使用自有图标和音效。
- 三关按 Southport/Outskirts/Pagras 拓扑映射自有地貌：265/220/300 金，7/7/11 波，8/7/12 坑，等级上限1/2/2。最终短屏实测后移动底部被技能/开波遮挡的坑位，放宽两处窄路空隙；第三关坑位距路中心最小46.0，中心间距最小95.6。门楼朝向根据相邻路段内移。
- 星级按18/6命门槛、本地最佳保留与下一关开放、末关保存；只在无v2时迁移v1并保留原件，坏v2禁写。
- 实际浏览器证据 output/playwright/reference-integration-evidence.json：568×320三关27坑位点选关闭无误建；667×320菜单；844×390普通经济实玩前三波；集结、独立费用、开战前全退/开战后60%、能力、双指取消施法与暂停冻结。Keyboard focus/reduced-motion检查通过。末关胜利与坏档为隔离注入场景，不是人工完整通关。无pageerror。
- 工作区 output/reference-combat-check.mjs 和本游戏 output/reference-progression-test.mjs 通过；工作区 output/reference-combat-strategies.mjs 三套策略均完成三关（结果见 output/reference-combat-results.json）。自动放技能/按坑顺序布防只能证明流程可完成，不能当玩家胜率或平衡完成。
- 参考适配明确保留：本地地图坐标/尺度、出兵间隔、弹速、士兵移动速度、火雨同时命中与半径；当前手动波间，没有原作提前开波计时奖励。高级分支、星级天赋购买未实现。来源与差异在 docs/kingdom-rush-reference.json，旧研究记录中的候选和“尚未接入”不再代表当前运行状态。
- 0.3.0 ZIP 116文件、935346字节，SHA-256 542c3b990827502dd214c9ab2fa7d9d8c0a4658b3687fede7d8bbf4ca343ea63。CRC、单根入口、逐文件哈希与dist一致性通过。
- 按已有独立开发版授权读取状态、dry-run、上传：H5 version287989、package79609、task2ec82ed1-3b51-4298-8b96-0087587343d3；包名/字节数/横屏读回。主槽仍284860，草稿未发布，本次未提审/上线。platform/reference-*.json为证据，公开binding更新。
- 试玩：https://www.taptap.cn/qrcode/miniapp?id=tapmczgouni5thmw5m&type=develop&version_id=287989 。media/test-qr-287989.png编码自平台URL并解码一致。物理iPhone/TapTap宿主未验收；4181预览保留。


## 当前任务：开阔地形的兵塔协防（2026-10-11，实施中）

用户已选“改开阔地形，先做一张完整试玩图”，并强调核心仍是塔防：玩家规划部署，用兵+塔防守，减少操作。有效范围：固定树石影响通路，自由布防，自动迎敌/归位/治疗/召唤；准备阶段调整部署和升级，战斗无需逐个下令，仅保留可选火雨救场。保留横屏、安全区、双指相机。旧道路版本保存于0.3.0ZIP和原模块，不删除真实旧存档。

分工：openfield_engine仅openfield.js及行为证据；openfield_asset_audit仅素材准备/源记录/图集；openfield_renderer仅新渲染模块和HTML/CSS；主责新main、构建、集成、验收、独立开发包。素材查明330个唯一PNG具备idle/attack/run，此次挑12种玩家角色+新敌人。数值先用已查证KR基本系与专业机制；合并三士兵为单实体、招募价格映射等必须标适配，不能宣称原版平衡。

交付目标为一张完整九波林地试玩，12种兵+4塔，路线不封死、单位真正战斗、波间可规划，坏档保护，浏览器真实手机操作验收与新独立TapTap试玩包；不绑定主槽/提审/上线。


### 0.4.0 集成与验收进展

- 运行入口已切换 openfield.js / openfield-renderer.js / openfield-main.js 和 openfield.css；旧 main/progression 不进入 bundle，旧地图与存档不覆盖。当前为12兵+4塔、一张三入口九波图。
- 近战真实自动迎敌/攻击/受伤/归位，波间可免费换位；塔升级/拆除、兵撤回仅准备阶段开放。火雨可选，手动点迎战。补齐既有士兵脱战2秒恢复：基础民兵5/7/10每秒，聚合单兵15/21/30，远程/支援沿一级5，援军3；暂停API拒绝施法。
- 844×390普通300金实际触控部署盾卫+弓手+法师塔，首波自动防守20命、4击杀，盾卫从驻地380移动到297附近接敌并返回；随后免费换位，战斗中移动/出售按钮禁用。
- 浏览器568×320与667×320菜单/安全区，16目录卡、原生触摸横滑目录不误购、布防先选类型再点位置、树石拒绝消费、塔升级70+110与开波前180全退、暂停冻结/音效切换、竖屏暂停、原生双指1.83×取消待施法和2×拖动后精确选取、火雨冷却80、键盘焦点与reduced-motion截图已检查。支援、升级与终局用隔离注入资金/状态，不能当正常通关。
- 新林地胜利保存及重载、坏档保留禁写和旧道路key保持通过隔离状态检查。19条浏览器记录见 output/playwright/openfield-integration-evidence.json，无pageerror或HTTP失败。自有Edge已关闭，用户4181预览服务保留。物理iPhone/TapTap宿主仍待试玩。
- 引擎行为检查通过：路线清障、近战驻地牵制、攻击抗性、召唤上限/寿命/清理、补员、恢复、暂停、无效坐标、生成数量守恒。完整带自动技能流程9波17命仅证明流程；免技能常规混合阵型仍在最后核对，不将召唤堆叠唯一胜利认作平衡完成。


### 0.4.0 最终交付（2026-10-11）

- 最终本地编队为64敌，波数[4,7,6,8,10,6,10,7,6]。波1–5与基础兵塔/敌人属性不变，后四波从43敌降为29，移除波8额外Ogre和末波Ogre护卫，保留最终Boss。数值来源与适配已同步reference JSON，未将本地波表声称为KR原关卡。
- output/openfield-low-input-check.mjs 对真实生产通过：无技能、无战中操作、每波间10秒规划恢复，同一兵营+盾卫核心的法塔先/箭塔先两种购买次序均胜利剩3命；49杀+15漏=64。不是两种独立流派。空防失败。参考开局兵营(560,240)、盾卫(560,360)、法塔(700,400)，波1后补箭塔(660,240)，波4后箭塔(720,160)，波6后盾卫(620,320)。
- 最终引擎全流程带自动火雨为9波20命、64杀0漏；行为与数量守恒通过。主check另补脱战恢复与暂停禁施法。免技能结果独立记载，不把带技能策略当低操作证据。浏览器证据前五波/交互有效，后四波调整仅改编队，最终包与dist逐文件一致。
- 0.4.0 ZIP共132文件、1486988字节，SHA-256 f67002d867d2b03605bb6b1922cfdbdf751d504059cb31144e72ed297e07bd4c；CRC/单根入口/哈希一致性通过，证据output/openfield-package-evidence.json。旧包保留。
- 沿既有独立开发包授权完成状态读取、dry-run、上传与读回。H5 version288130、package79677、task7761313a-5a92-47b9-8695-7ea7dd699423，幂等键castle-ward-h5-040-openfield-20261011；ready、横屏、文件名、大小确认。主槽仍284860，发布仍draft，本轮未绑定主槽/提审/上线。platform/openfield-*.json为记录，binding development_preview更新。
- 试玩 https://www.taptap.cn/qrcode/miniapp?id=tapmczgouni5thmw5m&type=develop&version_id=288130 ，media/test-qr-288130.png由平台返回URL编码并解码一致。用户预览4181继续运行，自有验证浏览器已关闭。物理iPhone/TapTap宿主和人工完整通关仍未验收；下一步收集实际布阵反馈，扩展流派/战役前不宣称整体数值平衡完成。
