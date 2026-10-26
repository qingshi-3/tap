# 喵喵当铺

猫咪题材的手机竖屏 H5 当铺经营游戏：白天验货、议价、收卖和收费鉴定，夜晚拾荒、加工、藏货、订货和调整门面，以交租和攒钱赎店为主线。

## 当前版本与方向

当前本地版本 **v1.6.4**，由2026-10-21恢复的线上 H5 **328700**（v1.1.1）基线扩展，已加入本轮玩法和新主角，**当前源码／dist不再等同线上62文件的原始哈希**。线上基线与回退证据仍保留。2026-10-24已按用户授权将房租广告改为免交本次并提交审核，当前为reviewing，设定审核通过立即上线；尚不能视为已上线。v1.6.3已读回online。未进行Git提交或推送。

用户授权丰富玩法、按经历渐进展示。2026-10-22按最新参考替换主角：灰色虎斑猫脸、琥珀眼、酒红金边旗袍的猫咪女店主，图片为 assets/cats/player-qipao.png。旧player/player-v2图片保留。游戏图标为猫眯起一只眼、用独立放大镜鉴定金币，已替换本地promo/icon.png和网页图标，并已更新平台图标、宣传图、截图、介绍与视频资料。来源见 [assets/SOURCES.md](assets/SOURCES.md)。

当前49种商品、24名NPC（不含主角，新增8名职业猫客），16卖家／16买家模板、13种轮换预约、8种机器、4联系人21套餐、15种行情。新增商品与客人在第3天／6次、第6天／12次、第10天／20次买卖逐步开放。夜晚免费预告明日行情与已锁定来客，可提前备货、加工或留钱收货；普通来客和货物降低近期重复。

电话第2天且累计4次买卖开放，鉴定第3天／6次，改装第4天／8次，精品第6天／12次；原5设备保留实物改装，新添烟熏炉、修复台、宝石台。已拥有设备及必要耗材保留可用。具体规则、参考来源与适配边界见 [DESIGN.md](DESIGN.md)。24名NPC各用独立立绘，新增8位职业猫客已补齐专属图片；24种新品已分别生成独立透明图片，49种货物默认图片路径、文件与解码像素均不重复。不恢复分店、中央作坊或员工合同托管。

## 本地运行

- 普通 HTML/CSS/JavaScript ES modules，无需编译；源码入口 index.html，交付运行目录 dist/。
- [dist预览](http://127.0.0.1:18851/)保持运行；[源码隔离验收](http://127.0.0.1:18852/)用于本轮检查，两来源存档独立。
- 日间货架／订单在底部，交易调价及成交固定；顶部／底部按系统安全区避让。360×600短屏与iPhone尺寸安全区模拟及全页面检查见 [布局验收记录](../../output/miaomiao-pawnshop/page-audit-20261022/audit.md)，尚未代替物理手机与TapTap宿主验收。
- 重启dist预览：在本目录执行 `python -m http.server 18851 --bind 127.0.0.1 --directory dist`；源码验收去掉directory参数并改端口18852。
- 仓库 https://github.com/qingshi-3/tap ，沿用main，不建分支／worktree，不自动提交或推送。

## 存档范围

保留v2及固定键 `mmdp_run`、`mmdp_meta`，以可选 `growth.v1`记录解锁、提示、订货、改装与鉴定招牌，`variety.v1`记录内容阶段、近期来客与锁定预约；支持旧v2继续游玩、保存、重进。没有云同步。

未知v3、未来growth／variety版本、损坏结构或坏JSON会停止覆盖，提供原存档在游戏内查看与复制；不能通过改版本号或删字段猜测降级。localStorage读写失败会明确提示并提供进度导出，不能把提示等同已成功保存。用户真实浏览器／TapTap进度未被迁移或清理。

## v1.6.4 广告免租与当前发布包

- 完整观看广告免交本次房租，不扣现金、不积欠到下周；每局一次，沿用旧档使用记录。免租不增加实际交租次数。取消／失败可重试，重复点击及过期回调不会发奖。
- [当前发布ZIP](../../output/miaomiao-pawnshop/rent-waiver-20261024/package/miaomiao-pawnshop-v1.6.4.zip)：53,931,012字节，126文件；SHA256 `19a81654aef165b78162d783c1f8dce392385becfa6b2afc7ff141409e0c5c7e`。源与dist127文件一致；相比v1.6.3仅game.js、main.js、index.html变化，其余123个运行文件不变。
- 9项免租行为、decision14项及最终dist四份冻结v2续玩／保存／重进检查通过；360×600、402×874实际点击验证完成／取消广告、正常支付、用过隐藏、免租后重进与键盘操作。广告为模拟结果，真实玩家档未动；TapTap宿主广告、物理手机未验。[验收记录](../../output/miaomiao-pawnshop/rent-waiver-20261024/audit.md)。

## v1.6.3 全货物独立素材（历史）

- 24种新品分别用内置image_gen生成独立图片，仅缩为256×256透明PNG；旧25种货物图片及水品质显示规则保持。49个货物路径、文件SHA256及解码像素均不同；全部data导出除ITEMS.icon外不变。
- [历史发布ZIP](../../output/miaomiao-pawnshop/unique-items-20261023/package/miaomiao-pawnshop-v1.6.3.zip)：54,323,923字节，126文件；SHA256 `6dc6ae436d25dc0161b1e9039c850cc57d4c2b3be11687e56a6316b9db0a51c2`。比v1.6.2仅新增24PNG、删除商品icon别名与同步注释、版本字符串和JS缓存参数变化；99个旧运行文件逐字节一致。源与dist127文件哈希一致，仍仅排除来源文档、不含fixture。
- 四份冻结旧v2通过最终dist继续、保存、重进。360×600／402×874实际验证货架24新品、选中六分仪、订货及修复台配方，design-slop审查通过，无报错；[验收记录](../../output/miaomiao-pawnshop/unique-items-20261023/audit.md)。真实档未动，物理手机与TapTap宿主未测。

## v1.6.2 存档恢复与发布包（历史）

- 异常、未来版本和损坏存档先保留原件，可在游戏内查看、复制备份，不再触发Blob下载。新增「清除进度并重开」二次确认，仅删除当前经营进度，保留成就与设置；确认时重新读取run/meta，防止并发换档或读取失败误删，删除失败可以重试。
- [历史发布ZIP](../../output/miaomiao-pawnshop/save-recovery-20261022/package/miaomiao-pawnshop-v1.6.2.zip)：52,067,075字节，102文件；根为miaomiao-pawnshop/index.html，仅排除assets/SOURCES.md，dist103文件与源码哈希一致。SHA256 `55a34272add17eb458b53216b8550dfb4ac62c120205edbb65b9106b6abb5eaf`。
- 10组恢复行为测试及四份冻结旧v2在最终dist加载、继续、保存、重进通过。360×600／402×874实际验证取消确认、查看复制备份、清后交易与重进、删除失败、读取恢复、键盘与reduced-motion；[本轮证据](../../output/miaomiao-pawnshop/save-recovery-20261022/)。真实玩家档未动，物理手机与TapTap宿主未验。
- 用户已明确授权提交新版本发布；保留前轮新图标、旗袍媒体并读回一致，本次developer_message追加存档恢复修复说明。未Git提交或推送，当前master。

## 平台绑定与状态

- 开发者488823／阿芙工作室，应用982518／喵喵当铺，miniapp `tapmckaytq32aqvqjc`；公开配置在js/config.js。
- 2026-10-24当前提交：H5 version362341／package115473，V-20261023-1，revision与audit均为1134434；precheck无blocker或warning，submit后读回reviewing，提交方式immediate，审核通过自动上线。前轮356079／V-20261023已读回online；本轮媒体与开发者话未改且逐字段读回一致。
- 图标、banner、square、5张截图、description、developer_message及两类视频共8字段保存后读回一致，见[平台字段核验](../../output/miaomiao-pawnshop/release-20261022/platform/field-verification.json)。实机演示gameplay6004020（57.2秒、540×1174，无额外字幕配音）、宣传片trailer6004021（35秒、1280×720，游戏配乐）均已转码且有play_url；核验时视频状态为regulating。
- 历史状态（2026-10-21）：V-20261019（revision1101771）online，原主包328700；以下原包仅供基线追溯。
- [线上原包](../../output/miaomiao-pawnshop/pv-audio-20261019/platform/miaomiao-pawnshop-audio.zip)：62文件，包体98341；SHA256 `6fbb1cfcae4271d723e55d80b4ac856e82620c3b3ac873f1975cdd3e63edf6f8`。该哈希仅代表线上原包。
- 330038、330100为撤回方向的历史自测包，不是当前开发产物。平台激励视频／排行榜接入仍在；成就与存档为本地。宿主能力及音频听感未重新验收。

## 发布包与媒体验证（v1.6.1，历史）

- [发布ZIP](../../output/miaomiao-pawnshop/release-20261022/package/miaomiao-pawnshop-v1.6.1-preview.zip)：52,066,346字节，102文件；根目录miaomiao-pawnshop，第一层index.html。SHA256 `f421685a49063d5b2e991f9f69bf5f67e4aa3fee27af2a76f617d9e5d66e3d23`。dist全部103文件与源码哈希一致，仅来源说明文档未打包；[清单与兼容报告](../../output/miaomiao-pawnshop/release-20261022/package/report.md)。
- 四份冻结旧v2使用dist逻辑及实际store接口完成加载、继续、保存、重进、再次继续与保存，固定mmdp_run／mmdp_meta及原meta保持；storage、richness22组、variety18组、scavenging19组、lessons18组、patience14项通过。
- [媒体证据](../../output/miaomiao-pawnshop/release-20261022/media/)包含成片、banner.jpg与square.jpg；raw-full为18852隔离新局真实操作至第2天录制，剪短长停顿，无内部状态注入。旧尺寸错误raw已弃用。视频为浏览器实际运行画面，不是物理手机录屏。
- 18851真实进度未动；18852仅用于隔离新档录制。物理手机及TapTap宿主未复验；本段为前轮媒体与包体验证，当前审核状态见上方平台状态。

## 验证与记录（此前本地阶段）

- 本轮入口：`node tools/variety-regression.mjs`（18组），richness（22组）、decision（14项）、patience（14项）通过；四份冻结旧v2继续游玩／保存／重进、未知扩展拒绝覆盖已覆盖。audio（14项）为前轮结果，本轮未改音频。详情见 [TASK.md](TASK.md)。
- 实际已验证：360×640夜间预告与次日来客兑现、指定商品买家成交、烟熏／修复选料开工与次晨产出、未知扩展保护；402×874常客委托接取与选货交付。design-slop复查简化了委托重复文字，保留已认可的标题构图和按钮。
- [本轮证据](../../output/miaomiao-pawnshop/variety-20261021/)；[改前dist备份](../../output/miaomiao-pawnshop/variety-20261021/before-variety-dist.zip)；[前轮证据](../../output/miaomiao-pawnshop/richness-20261021/)。物理手机、TapTap宿主、系统减少动态效果切换及真人长期节奏／经济平衡仍未验收；本地规则不等于原作精确数值复刻。
- [回退证据](../../output/miaomiao-pawnshop/rollback-reference-20261021/)和[回退前完整备份](../../output/miaomiao-pawnshop/rollback-reference-20261021/before-rollback.zip)保留；tools旧growth／operations／network／startup脚本与冻结样本仅供历史追溯。

## v1.6.1 交互修正（历史本地验收）

- 游戏内次按钮使用深木色实体底，主报价／成交保留金色／绿色，禁用置灰；货架与门面选中增加勾选，标题已确认构图与按钮保持。修复货架商品标签引起的横向溢出。
- 满货架拾荒弹出换货／暂不拾取；未拿及换出物均留本晚地面，整备时加工、改装、扩容等操作完成后，有空位自动收回并toast。可以从拾荒页重新整理；本晚重进保留，睡觉后未拿余物清理。可选night.ground.v1不更换存档键或v2版本，拒绝未来／损坏结构。
- 小铺与营业菜单常设「经营指引」，按五组门槛展示七项开放内容、当前天数／累计买卖和还差多少；直接读取规则门槛，已开放状态保持。
- 新增scavenging19组行为回归；实际360×640验证满包换货、暂不拿后加工补领、交换后重进与补领toast、焦点返回，360×640／402×874验证指引滚动与达标更新。证据在`../../output/miaomiao-pawnshop/scav-guide-20261021/`和`../../output/miaomiao-pawnshop/button-clarity-20261021/`。物理手机与TapTap宿主未测，未发布。
## 信息分层与首次提示（2026-10-21）

- 作坊常驻显示材料缺口、滤芯余额、可开工批数与剩余工期；净水器详情使用六瓶水的可点选图解，直接显示原水→产物、耗材与设备上限；其他设备详情提供配方。选料页保留这一次的原料→产物、消耗和工期。小铺保留收益摘要与价格；订货、订单、货架的通用规则从对应详情入口查看。
- 卖货选货／议价直接显示进价；没有直接购入价的物品标“无买入价”。经营指引改为开放内容／天数／买卖次数对照表。
- 首次验货、公开赃物、违禁品、已识破赝品、水、主动观察提供简短提示；确认后记入既有mmdp_meta.mechanicSeen，跨重进记忆。一次渲染最多提示一项，关闭不连续弹窗；不根据未知真假／赃物触发。未查验货按钮同色，查后才标正常／异常。
- 验证：lessons 18组、patience 14项通过；360×640与402×874实际点击检查指引、作坊详情及选料开工、订货、订单交付、货架水质详情、首次提示与重进记忆。证据：`../../output/miaomiao-pawnshop/ui-clarity-20261021/`、`../../output/miaomiao-pawnshop/sale-cost-20261021/`。仅本地，物理手机及TapTap宿主未验收。

- 净水器／紫外线灯已使用独立透明设备素材，图解、小铺与作坊保持一致。紫外线灯显示配件身份、未装／已装及纯净水图标；图解可打开小铺购买弹窗，夜间按原门槛购买安装，白天显示购买时机。安装即时更新上限并保留原选择；加工格数明确标为“成品占N格”。

## 全设备图标（2026-10-21）

27项设备、设施、工具、配件、耗材、服务及招牌使用独立实物图，小铺/作坊/门面/详情保持一致。鱼缸等详情展示原料→设备→成品；贴标台同时说明罐头加工与货架水贴标（即时2鱼币/份、水质不变）。短屏/长屏实际查看，完成满架买设备、鱼缸开工、水牌点亮和水贴标验证；源码与dist同步。证据与来源见TASK.md和assets/SOURCES.md，未发布。
