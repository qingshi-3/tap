# 装车收纳 · 活动任务

## 最新交付：三支代码宣传动画（2026-10-19）

用户要求制作数支宣传片，建议直接代码实现，随后明确“提交”。本轮生成动画与可修改工程，已上传三片并将61.3秒合辑绑定宣传片栏、重新提审。没有改游戏源码/dist/玩家存档。游戏4197预览保留，独立动画预览4209保持运行。

- 最新平台状态：阿芙工作室488823 / 装车收纳985963；三片视频5989562/5989563/5989564（素材492257/492258/492260），合辑5989574（素材492301）。宣传片字段已读回5989574；实机视频5989048、main H5版本329596保持。提交前草稿已为draft，本轮没有执行撤审。snapshot ready、preaudit_passed=true、blockers/warnings空；按既有immediate档期提交成功，审核单1104678读回reviewing。四个视频已转码、有播放地址，当前regulating、未封禁。回执目录`platform/promo-20261019/`，当前无需重复提交，等待审核。
- 合辑首两段各取20秒、末段22秒，两处0.35秒交叉淡化；1280×720/30fps、H264/AAC，视频61.3秒/1839帧。完整解码、转场目视及连续播放通过，零丢帧、音轨已解码；证据`trailer-validation.json`，本地`trailer-preview.html`可播放。未执行Git提交或推送。

- 输出`output/promo-20261019/{rotate,stack,unload}.mp4`，各22秒、1280×720、30fps、H264/AAC。主题为长箱旋转入侧缝、拒绝压花瓶后正确叠放、先送货调到尾门并先上后下卸货。第三片只完成第一站，后站货留车继续送；不冒充两站通关或实机录屏。
- 复用`art.js`原生绘制与o02/o08/o15规则，`animation.js`确定性时间轴；`scene-validation.json`验证候选动作，`scene-animation-audit.json`进一步验证动画实际布局及每步卸货路径。失败反馈没有虚构碎裂、罚款或额外玩法。
- 实际渲染复查修正旋转中心跳变、拒绝时货物似乎已落地、重复字条、L形货物的静态椭圆阴影、花瓶倾倒及目的地凭空箱子。关键动作使用温和推近；原生物体移动/旋转/落地回弹，不是静态图平移。
- 原创木琴式配乐与动作音效由`audio/score.py`生成，事件由`events.json`同步；无外部音乐素材。`audio/final-media-validation.json`完整解码通过，综合响度-19.8/-21.9/-19.7 LUFS、真峰值-2.4/-2.2/-3.1 dBFS。物理扬声器主观听感未验收。
- `preview.html`真实片选与重播按钮启动三条最终有声片，均连续播放到22秒ended，660帧、零丢帧、音轨已解码且未静音，证据`audio/playback-validation.json`与8/14/21秒截图。Canvas预览的播放/暂停、键盘时间轴、重播及reduced-motion和844×390/568×320/360×800检查见`ui-validation.json`。
- 复现：4209服务`node output/promo-20261019/server.cjs`；影片导出`node tools/with-lock.mjs cargo-promo-render node output/promo-20261019/export.cjs`。音频生成依赖本机Codex runtime Python的numpy；`audio/finalize.py`合成最终MP4。共享资源生成串行领取锁，无分支、提交或发布。详细来源与入口见`production.json`。

## 目标与授权
手机竖屏普通HTML/JS H5装车拼图；触摸拖放、旋转、叠装、重排与逐站卸货。用户已明确“执行”分阶段规则方案：前期纯拼图，再加入叠放、花瓶不能受压、重货/长件、多站、窄门组合。1.1.0本地实现、验证及已授权平台准备全部完成。
仅修改games/cargo-packer/；master，不创建分支/worktree，不提交/推送。保留玩家进度、用户预览服务及其他游戏。已授权包体/素材上传、草稿保存绑定和预检；2026-10-19用户进一步明确授权完善商店介绍与正式提审，并在展示协议实质条款及发布选项后回复“允许”，同意签署及审核通过后立即上线。协议已签署，审核单1104678已提交，读回审核中，尚未上线。

## 当前玩法与长期契约
- 1–4纯平面单站拼图，不检查卸货路径；5–7叠装教学/练习且地板面积不足，必须使用第二层；8–10花瓶不能承重；11–12重货落地靠前；13–14长件贴墙固定；15–18多站与上下层顺序；19–25窄门、固定座、轮罩组合。25单、14类货物、5辆车。
- 坐标{x,y,r,z?}，z默认0且限0/1。拖到被占地板自动预览上层，最多两层；只允许≤2格非重货，全部占格由地板纸箱/收纳箱支撑。不能压易碎品、悬空或抽走仍承重的底箱。长件贴墙自动显示绑带。
- API：getOrder(id,contentVersion)、canPlace(order,placements,id,x,y,r,z)、canRemove、validateLayout、inspect、unloadPath。前14单直接提起搬出但先上后下；后续按站处理，上层提起、地板BFS走尾门。
- 固定存储键cargo-packer.save.v1，当前schema2。冻结js/content-v1.js；schema1验证后只在内存迁移，旧活动单contentVersion1保持原内容/站次/规则，下一单contentVersion2。首次正常保存先备份精确旧原文。拒绝未知/坏档，不静默重开；奖励首通幂等不变。
- 平台公开事实权威platform/binding.json。CONTRACTS仍未接入UI，不算开放内容。

## 本轮分工与交付
主责整合app.js、UI、工具、README/TASK及平台。rules_v2完成content.js/engine.js/规则测试；save_v2完成persistence.js、冻结旧档及兼容/边界浏览器检查；art_v2完成花瓶绘制及叠放浏览器检查。各文件写入不重叠，均已结束；资源生成、打包和平台写入使用output/logistics-shared-operation.lock串行保护。

## 验证证据（1.1.0）
- output/package-validation.txt：95项规则/存档检查通过。新25单、旧25单与5个未公开样本的作者装载/完整卸货路线、支撑/受压/悬空/移除、前后站、窄门、经济、失败保存和并发保护均覆盖；不能以数量代替浏览器证据。
- output/qa-v2/browser-report.json：从新档以真实触摸完成全部25单、四次购车和结局，没有注入位置/奖励替代操作；重进、重接、再保存通过。基础四视口/reduced-motion通过，无页面异常。该通关过程中仅后续花瓶始终直立绘制、站次徽标位置及坏档文案又被简化；这些最终差异由下面专项覆盖。
- output/qa-v2/stack-report.json：显式隔离第8单夹具，360×640、320×568、844×390真实拖动叠放、压花瓶/部分支撑拒绝且原存档不变，承重箱禁止移动/移除，先上后下，旋转r=1花瓶保存重进与键盘/焦点通过；全部最终花瓶保持直立。
- output/qa-v2/legacy-report.json：三份冻结schema1装车/卸货/结果档实际触摸继续完成旧单，验证原站次、精确首次备份、防重复奖励、进入新版下一单、重进再保存。未覆盖用户真实存档。
- output/qa-v2/edge-report.json：第25单在三视口实触装满12件、上下层点选卸货；键盘、重排、未装齐/错站恢复、坏档/schema3原样导出等通过。edge-focused-report.json为最终徽标/错误文案后5条相关路径复查，保留完整报告。
- output/qa-v2/rules-video.json与output/store/gameplay-v3.mp4：23.44秒、720×1558 H264。初始解锁第8单为隔离夹具，随后全部实际触摸装载、压花瓶拒绝和卸货，未注入位置/奖励；这是浏览器触控录像，不是真手机录像。
- design-slop实际审查并修复：移除遮住花瓶的“上”字块；花瓶无方向占格，保留逻辑r但图像始终直立；上层多站徽标移到占格右下，露出瓶颈与腹部；删除重复卸货提示；损坏JSON提示改简明中文并删重复“已保留”说明。已查看最终叠放三视口、晚期短屏/横屏、拒绝、焦点和错误截图；按钮≥44px，未发现溢出或操作遮挡。
- 用户在4197预览的旧第2单2/6装载与132运费保持，刷新后恢复旧单，完成后下一单进入新版。

## 平台准备（1.1.0）
阿芙工作室488823 / 装车收纳985963。CLI2026.9.24，schema缓存1.0.55。包体412447字节，SHA256 b339bf2043a97cb299d57432e806d3691298a731d8a144ab0582c2be367bb4d6。H5版本329596、上传包98762，主槽位已绑定并读回；草稿V-20261019，revision1104678，竖屏1。
新版玩法说明/开发者的话、3张实际截图与视频5989048已上传、保存、逐字段读回。platform/precheck-v110.json内容预审true、warnings空；唯一blocker=SCE_AGREEMENT_REQUIRED。二维码output/store/taptap-test-v110-qr.png使用list-h5实际package_id329596。
上述为提交前准备记录；最新提审状态见文末。**物理手机/TapTap宿主触控、安全区与清后台恢复未验收。** 不把浏览器模拟或内容预审视为真机/正式审核。
历史1.0.0包与平台回执保留；旧329432/98682及视频5988914已被当前草稿替换，不再作为新版试玩入口。

## 恢复与下一步
玩法无待实现项目。预览http://127.0.0.1:4197/保持运行；README记录启动/打包/存档，platform/binding.json记录当前公开绑定，output/qa-v2/存证据。后续真机扫码可验宿主，不沿用其他应用协议，不重复上传未变化包体。

## 商店完善与提审（2026-10-19）
- 用户已明确要求“提交游戏的完整信息介绍，然后提审，注意参考热榜的游戏介绍格式，以及图标和宣传图”。store_research执行只读研究，主责处理文案、生成与平台写入。
- 本轮公开休闲榜https://www.taptap.cn/top/download/casual读回：《伯吉的温馨厨房》https://www.taptap.cn/app/882850第1、《多米诺的子弹工厂》https://www.taptap.cn/app/956393第5、《再玩亿关》https://www.taptap.cn/app/247977第8。榜单每20分钟更新，非长期排名。前两款图标已浏览器目视，参考大主体/少背景；三款简介参考一句定位+短段玩法。未复制宣传声称或图像。搜索工具提供的竞品横幅描述未目视，不当作视觉验收证据。
- 最终介绍/开发者的话/推荐语见platform/store-copy-v4.json。新图标与横/方宣传图见output/store/*v4*.png；原图由内置imagegen制作，提示词见imagegen-v4-prompts.json。平台交付尺寸与大小见media-v4-metadata.json，全部小于4MB；横1920×1080、方1440×1440，图标1254×1254无圆角裁切。已目视最终图：只保留游戏名，主体与货物清楚，没有虚假按钮、评分、口号或无法实现的叠放；三张真实截图和视频5989048保持。
- 已完成素材上传490816/490817/490818，save-changes保存6项并逐项读回一致：platform/store-v4-*-readback.json。store-v4-snapshot.json状态ready，无差异。store-v4-precheck.json内容预审true，warnings空，唯一blocker仍为SCE_AGREEMENT_REQUIRED。游戏包体未变，未重新打包或上传。商店最终公开页面/宿主真机尚未验收；不能用素材目视或字段读回代替。
- 协议正文已从https://www.taptap.cn/doc/ugcgame-agreement读取，存于platform/ugcgame-agreement.html，发布日期/生效日2026-03-11。要点：向上海创巴授予全球、独占、免费、可多层转授权权利，含修改/发行/宣传/机器学习；衍生内容权利归发行方，保留原内容合法权利；撤回须提前30日书面告知并下架；全部素材需合法且可转授权。CLI agree-sce-agreement明确要求展示协议并获明确同意，用户随后回复“允许”，已满足本次签署授权。
- 最终签署/提审：复核应用985963、草稿1104678和main绑定H5版本329596。协议回执authorized-review-agreement.json为signed；snapshot为ready，authorized-review-precheck.json内容预审true、blockers和warnings均空。使用同一release_schedule={kind:immediate}提交，authorized-review-submit.json返回reviewing、audit_id1104678。authorized-review-readback.json和versions.json再次读回审核中，并含review_submitted历史。发布档期字段读接口不回显具体值，以已接受的提交请求authorized-review-request.json及dryrun为证，不声称已上线。
- 当前无需重复上传/签署/提审；等待平台审核结果。用户后续查询时先读版本状态；退审则依据原因处理，不能覆盖仍在审核的版本。现有本地预览与玩家存档未操作。授权记录和绑定状态已同步。
