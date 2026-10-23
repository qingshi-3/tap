# 浏览器真实输入与 design-slop 验收

入口：http://127.0.0.1:8788/?debug；隔离Edge headless contexts，未访问真实玩家存储，服务保持运行。
视口：844×390、568×320；触控环境，另覆盖真实鼠标拖动、键盘Tab与prefers-reduced-motion。

## 已修并复查
1. 换位/撤销主将动作原固定56舞台像素在短屏约25物理像素；现在height随--control-size，双视口实际43.99px（浏览器子像素舍入）。gen-stack同步为CSS变量表达式，开战/整备不重叠。swap-armed-568.png、swap-armed-844.png与report.json。
2. 换位选中从空心描边改成单位本体提亮和柔边光效，保留对象识别；真实两次敌军tap完成换位，存档swaps读回[[0,1]]。
3. 待补蛋删除次要说明，仅保留一行状态；font-size=max(22px,--control-size*.28)，实际约12.3px。pending-full-568.png与pending-claimed-568.png已查看，无开战遮挡。
4. reduced-motion下教练提示coachBob与合并升星牌badgeBounce仍持续跳动，现均停用。extras-report.json为修复后结果：两视口无限动画数组均为空。report.json较早的motion观察（568仍有1项）已被该复查结果取代。

## 真实输入证据
- 双视口touch tap选己方slot1决斗，实际光晕指向敌方同格slot1；选slot3决斗对含嘲讽敌军时光晕转为敌方slot1。duel-*.png、taunt-*.png。
- 蕾娃先tap换位按钮、再tap两敌军，位置与存档均变化；没有直接调用addSwap或点击处理函数。
- 鼠标拖招募卡入空格后读回阵容/picks/save；另用CDP Input.dispatchTouchEvent真实touchStart/move/end在两个视口完成招募，实际可见新单位。touch-recruit-*.png。
- Tab聚焦刷新按钮，计算样式为solid outline，截图focus-*.png；普通按钮有填充，禁用刷新不可操作。
- 实际tap开战进入可见战斗回放，battle-*.png。
- 星角库存5战斗+3备战全满、pendingEggs=2时可见单行待补蛋；真实拖单位至出售区后pending=1、库存恰1个蛋，保存后reload再点继续，仍pending=1且恰1蛋，无重复领取。pending-full/claimed/reload-568.png。
- 冻结tests/fixtures/boss-save-v014.json（0.8.0无contentStructure）从localStorage正常标题入口继续：原阵容不变迁移0.8.2；真实拖动换位保存、reload继续、再次真实拖回保存。随后实际开战、tap跳过回放，显示胜利并持久化chapter=1/wins=7。legacy-loaded-844.png、legacy-battle-result-844.png、legacy-report.json。
- 最新法伊主将/被动长文本经真实tap打开，整个tip在两视口内部，已截图general-long-*.png；不截断、不依赖hover。

## 可恢复入口
- audit.mjs：双视口完整交互、星角补蛋；--eggs仅重跑补蛋分支。
- extras.mjs：最新长文本、真实触控拖动、reduced-motion复查。
- legacy.mjs：冻结旧档迁移与真实操作/战斗持久化。
- report.json、extras-report.json、legacy-report.json均无pageerror与未解决失败。

按用户提示执行了实际界面的design-slop审查：检查按钮外框、无用标题/小字、重复文案、折叠/面板、文字换行、目标视口、遮挡与可达性；先删待补蛋次要小字，再修触控高度与状态字号。此次未扩改既有卡牌像素框架。最后UI源码冻结后由主责整套测试和构建。

未验收：实体手机硬件、系统安全区真实刘海/系统栏、TapTap宿主与平台能力；本轮仅浏览器触控模拟。原有全舞台缩放中的小型HUD信息仍沿既有布局，本轮新增待补蛋状态已单独保证实际字号。
