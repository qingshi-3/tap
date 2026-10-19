# 森灯小馆 · 活动任务

## 目标与授权
2026-10-19用户要求调研好评模拟经营，开发全新完整游戏、创建TapTap应用，全程自主决策；特别要求不要5分钟后变成重复劳动。用户否定初版平板UI，明确要求直接照抄《奇兵列阵》的UI生成策略。当前在master既有工作区新目录开发，保留其他游戏与用户改动；未提交Git。用户随后明确要求加入资源激励广告，既有提审及过审上线授权继续有效。

## 当前交付
- 手机竖屏普通H5，原生JS/Canvas/DOM，1.1.0。预览 http://127.0.0.1:4194/ ，服务保留运行；生产目录dist。
- 经营：三产区、每日四点采集、12菜研究与熟练度、4员工专长、5类三档设施、10种双分支来信、8类限期订单、28天四季与四场不同指标节庆、结局及自由经营。初始员工自动服务；断货可恢复。
- UI直接移植奇兵列阵pixel.ts/pixelItems.ts绘制算法至js/pixel.js：九宫格、分割纹、原始色板、像素图标、Noto/Russo字体；按钮采用原四色阶梯填充，不附加外框。采购箱、厨师和料理图标沿原字稿生成策略扩展。
- 餐馆背景与图标由内置imagegen生成，Duelyst角色使用用户已授权素材。背景等比取景，4桌+2吧台席，角色/点击共用映射；素材来源assets/SOURCES.md，生成记录output/imagegen-prompts.json。
- 固定本地存档forest-lantern.save.v1，备份forest-lantern.save.v1.backup；拒绝未知/坏档，多页面冲突暂停，导出副本。仅同设备；接入自愿资源激励广告，未接内购/云存档。

## 已完成验证
- 1.0.0的14项行为检查通过，证据output/package-validation.txt。两条不同投资路线各模拟35天，首产区第2天、研究第3天；四节庆真实达标，研究/订单失败不扣资源、重复奖励拒绝、过期无破产、断货救济、存档重进继续保存。
- 独立复核发现满座离场席位提前复用导致7客并锁存档，已修：客人离场清理前仍占位。600步持续保存+重进下一天回归通过，原37.8秒复现已关闭，output/review.md。
- 浏览器真实操作360×640、390×844、844×390：采购、采集、研究菜单、事件、订单、员工、升级、上菜、完整日结到第2天保存重进；完整28天合法模拟档可继续第29天。七面板、滚动、44px触控、焦点跨tick、减少动效和导出已检查。截图/结构化证据output/ui/；六客Canvas实际点击output/visual/。
- 已按design-slop检查并修复大留白、重复入口、不可研究误报、图标语义与皇冠重复、六客按钮遮挡、横屏面板滚动、错误toast、焦点丢失。最终菜单配真实像素料理，不以文字流水账代替对象。
- 历史1.0.1生产包output/forest-lantern-1.0.1.zip，3,422,777字节，SHA256见output/package-manifest.json。脚本强制包含广告回归的27项测试通过后构建打包。

## 资源广告增量验收（2026-10-19）
- 采购顶部自愿观看：80金币或蘑菇6/稻米6/浆果4，每游戏日总共2次，营业前领取。TapTap当前应用985480广告已生效，本次服务端返回竖屏广告位1054324；未接强制广告。
- 请求使用独立实例、请求ID与原存档上下文；严格完整观看回调发奖，奖励和claims同档提交。重复/迟到/取消/超时/跨日/重载/保存失败不发；show失败仅load后重试一次。保存失败立即暂停并提供导出与重读。
- 27项自动检查通过：包含冻结1.0.0无ads旧档加载→领奖→保存→重进→继续营业→保存，以及存储冲突、写入异常与迟到回调。存档位置不变、schema 1可选ads字段，具体契约README。
- 隔离浏览器真实点击360×640、390×844、844×390：自愿入口、取消后采集、模拟完成与重复回调、两次上限和重进、无宿主置灰、一次重试失败、保存失败转导出/重读、键盘焦点及减少动效。证据output/ads/browser-report.json及截图；回调为测试mock，非真机播放。
- design-slop实际截图审查：沿用实体像素按钮，无新增外框或面板；删去重复的每日限额文案，44px触控与奖励说明无溢出，短屏可滚动，等待可取消，失败可恢复。未声称TapTap广告真机或结算已验收。

## TapTap 1.0.1提交历史（当前1.1.0见下文）
阿芙工作室488823 / 森灯小馆985480 / 审核版本1103358（V-20261019）/ H5版本329485 / 包体98703。公开权威platform/binding.json。
- 1.0.0审核已为本次广告改版撤回；1.0.1上传、main绑定、list-packages读回均成功，platform/upload-1.0.1.json、select-1.0.1-result.json、packages-1.0.1.json。
- 商店简介已去掉“无广告”，改为自愿激励资源、每日2次，已读回。图标、两张仅游戏标题宣传图、三张原真实截图及实玩视频沿用；没有将模拟广告截图充当真实广告素材。
- 当前预检preaudit_passed=true，blockers/warnings均空，platform/ads-precheck.json。
- 协议此前已明确同意并签署，不重复签约。广告版已重新提审，platform/ads-submit-result.json；get-app-version读回reviewing/审核中，platform/ads-version-status.json。
- 本次同样提交release_schedule.kind=immediate并成功，过审立即上线；尚未过审或公开上线。Android4/iOS0发布设置沿用。
- TapTap宿主启动/触控/存档更新与真实广告播放、奖励、收入结算未实测。广告已开通只说明服务端配置可接入，资质通用pending_upload不等于每项适用性结论。
- 新包二维码output/store/test-qr-329485.png；本地预览 http://127.0.0.1:4194/ 保留运行。

## 新档真实路径试玩（2026-10-19，广告版提交后）
- 用户要求实际玩游戏路径。以独立空浏览器存档从第1天操作到第30天（完整29次营业），没有注入进度、直接调用玩法核心或跳过时钟；首日正常速度，之后使用游戏内2倍速。
- 真实UI完成采集、采购、菜单/定价、事件分支、3产区、12菜研究、4员工、设施升级、8订单交付及1份故意过期订单；四节庆实际结果分别10/7、900/300、2/2、4/3，获得四季名店1390分。接待403位客人，结局后再营业一天且重进保存至第30天。
- 另测空菜单禁开、采购0数量禁用、暂停恢复、营业中重进、营业中领取目标、结局继续经营。无浏览器脚本错误。证据output/playthrough/report.json、actions.json、各日截图、played-save-day29.json及played-save-day30.json（均为实际游玩产生，不是注入样本）。
- 本地修复：营业中人数/收入目标此前仅日结更新；菜单没有菜系标签导致节庆配菜不明确；节庆缺少常驻进度及结算达成结果。core.js和main.js已修，真实营业与节庆路径复查，360×640菜单和390×844结局截图已按design-slop审查，无新增嵌套面板或非必要标题，分类和结果帮助玩家选择与确认。
- 新增营业中目标领奖、存档重进、结算不重复回归，相关28项自动检查通过。本轮修复仅在源码与本地预览，未打包或替换当前审核中的1.0.1，平台绑定不变。
- **体验未通过项：**本路线高价+完整员工几乎无服务压力；第22天库存蘑菇169/胡萝卜239/牛奶173等，22–28天不采集仍可完成营业；第29天已有15056金币。资金/库存过剩与后期策略取舍偏弱，不能以流程通关宣称耐玩性合格。尚未进行系统经济重平衡或新增玩法。

## 1.1.0经营优化契约（已实现）
目标：消除固定高价/全员工/资源过剩策略，保留旧资源与所有进度，继续原生JS/像素UI。主责管理集成、README/TASK/package与平台；核心执行者仅core.js/content.js/核心测试；UI执行者仅main.js/css/style.css/scene.js。不得分支或worktree。

### 核心与UI共享接口（本轮权威）
保留现有act/derived字段。schema1增加可选operations对象；旧档无该对象合法，首次新操作或next按明确定义初始化，不删除已有资源/雇员/升级/节庆。新字段严格校验，不猜修损坏字段。默认派班优先pip并取已有员工另一人，最多2人；员工所有权和在岗分离。
- act({type:'shift',id})切换员工在岗，仅prep、已雇、最多2人；老橡当天首次成功采购/采集即procurementCommitted=true，不能休息，next解除；derived.committedStaff给出锁岗名单。derived.activeStaff:string[]、shiftCapacity:2。空岗仍有店主基础服务，不强迫手动点上菜。只有在岗者专长及薪资生效；oak采购岗不自动上菜。hire不自动超额上岗。
- act({type:'planGather',id,quantity})编辑某产区次数，非负整数，合计<=剩余次数，仅已开辟；act({type:'gatherPlanned'})原子执行整个计划，失败不扣次数或资源。derived.gatherPlan:{[regionId]:integer}、plannedYields:{ingredientId:number}、plannedTrips、canGatherPlanned；保留单次gather兼容。已执行后计划清零，次日可重新分配；UI提供每区+/-及一键按上次计划（若实现则须真实API），不得自动采集。缩减产量，菜园主要增加各区主产物，采购岗有真实增益。
- derived.market:{name,description}给出每日客群偏好，priceOptions:[{id,label,description}]给出售价及来客取舍；实际价格/来客/选择必须应用，不能仅改文案。不同日客群和扩建让premium不是普遍最优。
- derived.expansions:[{id,name,description,cost,owned,selected,canBuy,unlockDay}]，act({type:'buyExpansion',id})购买并选用，act({type:'selectExpansion',id})切换已拥有路线。id=takeaway/salon，约第8天开放，最多一个active；外带周转和客流优势但售价折让；精致餐区溢价但接待量少。购买记录独立保留，切换免费仅prep。
- derived.serviceOffers:[{id,name,description,reward,reputation,duration,canAccept}]，derived.serviceOrder:null|{id,name,description,progress,target,daysLeft,reward,reputation,canClaim}；act({type:'acceptServiceOrder',id})和act({type:'claimServiceOrder'})。新增至少限定菜系/两种不同菜/连续营业三类，可用明确的目标计数，不奖励只点按钮。仅一个营业委托，原食材合同保留可并行，未完成到期不负债；完成后报酬保留至领取，成功只奖励一次。可接委托随阶段轮换，晚期仍有新选择。
- derived.nextFestival:{name,goal,daysUntil,tiers:[{name,target,reward}]}；当日derived.festival也含tiers，current保留。分档目标/奖励按真实结果，summary.festival额外tier/reward，旧summary无新增字段时UI兼容；原festivalWins语义保持基础达成次数，历史成就不删。
- 更新实际经营收支与summary必要项，保留无广告完整可玩和免费断货救济。不得用离线扣粮、腐坏清库或增加纯等待来制造难度。新数值是本项目调优，不冒充参考游戏原值。

### 验收
定价×客群×路线比较必须出现不同优势（固定高价不统治）；员工岗位影响采购/服务/工资且不可全叠加；合理菜单备货下新档中期常用库存通常1–3天、不是一季（目标非硬删库存）。两种投资路线无广告走过28天和结局续玩，逐日记录库存/利润/节庆/委托；历史1.0.0与1.0.1真实试玩档加载、继续、保存、重进继续保存。新档真实UI试玩与后期实际路径、不以数据模拟代替。360×640/390×844/844×390查看渲染和输入，UI按design-slop修复复查。主责完成后按既有上传/提审/过审上线授权更新平台，先读最新状态。

## 1.1.0最终验收与提交（2026-10-19）
- 完成批量采集、动态客群定价、两岗排班、采购出勤锁、双扩建路线、六类营业委托、节庆分档；补齐营业实时目标、菜系标签、已完成委托跨期领取、备料偏少提示及售罄提前打烊。未改固定存档位置、未扣除旧资源/所有权。
- 修复采购岗先取加成再免费换岗的漏洞；streak进度必须关联已经结算的有效日期；售罄只有当前菜单无法供应且无正在烹饪/用餐客人才允许提前结算，保留真实营业elapsed且不能重复结算。
- 最终打包47项行为检查通过，output/package-validation.txt。包含冻结1.0.0/真实1.0.1在固定字面存储键加载、营业、保存、重进、次日再次保存；采购锁岗/广告保持/委托跨期奖励通过独立复核并纳入持久回归。
- 新档真实UI完整30次营业，重进到第31天：前29天516客，末日全自动19客、0流失、经营收益442。12菜、4员工、双路线、四季名店1523；四祭分别12/7佳宴180金、825/300盛会260金、2/2达成100金、3/3达成100金。三种营业委托实际完成，10:riverTable故意过期，无罚款；已完成连续委托超期限仍领取。证据output/operations-playthrough/fixed/report.json、days.json、daily-metrics.csv、auto-day30.json及真实逐日存档。
- 真实长线前29日每5秒检查手动补位，最后第30日不补位；两条独立35日路线为核心模拟，真实试玩是一条新档切换两路线，不能混称两条独立实玩。旧核心6日探索隔离在exploration-before-procurement-fix，不计入最终结论；第10日脚本恢复时少量准备点击未及时记录，真实持久档及营业结果完整。
- 主责另以独立新档实际测试前4日：低库存第三日仅2客后发现空等问题，修复后第四日售罄20秒提前结算，重进续到第5天；采购锁重进保持、次日换岗、真实低库存补货、键盘与减少动效见output/operations-review/。最终dist启动营业通过，无脚本错误。
- design-slop实际截图审查360×640、390×844、844×390：实体像素按钮、44px触控、已出勤置灰、短屏滚动无水平溢出；删除日结无功能鼓励句、节庆冗长括注，拆分短奖励行后复查真实结果渲染与下一天输入。证据output/ui/operations-final-report.json及output/operations-review/390-festival-final.png、360-staff-committed-final.png、360-sold-out.png、844-low-stock.png。
- **保留限制：**主用食材需要补货，但联产非当季食材仍积存：胡萝卜第21天204份、第29天96份；未引入强制清库/腐坏。第28天13628金、第30天15371金，设施仅2/2/1/1/1，仍有约10800金设施未购；余额不能单独等同于没有投资需求，也不宣称长期经济压力已完全解决。旧存档资产保留，因此老档不会立即变得资源紧张。
- 最终包output/forest-lantern-1.1.0.zip，3,427,785字节，SHA256 95e8a9e52f72220c3aa579f7447d4220c983bb078f8c065f0c9f33904e59b2ad。330429为删日结冗余文案前上传的未绑定候选，已被最终330445取代；不得使用旧候选二维码。
- 平台读回：阿芙工作室488823 / 森灯小馆985480 / revision1103358 / V-20261019。最终H5版本330445、内部包99172已绑定main；简介按新玩法更新并精确读回。预检通过，无blockers/warnings；按既有授权提交immediate，get-app-version明确reviewing，尚未上线。证据platform/upload-1.1.0.json、select-1.1.0-result.json、packages-1.1.0.json、operations-store-readback.json、operations-precheck.json、operations-submit-result.json、operations-version-status.json。
- TapTap手机宿主启动、触控、同设备更新和真实广告播放/奖励/收入结算仍未实测。自测二维码output/store/test-qr-330445.png；本地4194服务保留，未提交Git。

## 恢复入口
本次优化与提审已完成；当前1.1.0审核中，过审立即上线请求已提交。平台以binding.json和实时读回为准，不重复签约、创建应用或提交同一审核。后续如用户反馈，优先参考真实长线与主责短路径证据；没有请求自动监控。
