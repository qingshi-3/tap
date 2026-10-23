# 平衡模拟口径

每主将从 seed=1000+index*7919 的固定序列里，取 generalChoices(seed) 合法提供该主将的前50个seed。13主将、两种策略各配对同一组seed，共1300局。跨主将seed组不同，不将它们冒充同池同seed比较；每组池分布保存在summary.pools。后续旧/新core比较严格按general/seed/strategy配对。

steady：身材、稀有度、能力、已有阵营数量、合并价值。synergy：上述评分加主将阵营与机制加权。两者都真实newRun、真实draft、takeDraft、moveSlot、allocPoint、equip、buy、hireMerc；不注入牌、金币、培养点或被动。保留已有forcePassive/banPassive兼容诊断入口，本轮不启用。升阶选原生选项0，不强制刷新。招募无合理替换就保留未用次数开战，不自行生成新draft。

蛋与argeon不覆盖卖出，必须上场；光誓按实际gen.power培养主将，不把单位法强误当治疗成长。argeon可随身材/被动调整队列，不固定前排。reva先处理嘲讽再暴露脆弱输出。零价佣兵允许零余额雇佣。布阵仅使用正常swap操作。

首战、每节点首次与重打、首领首次与重打分别记数；bossReached记录到达、最终打过该首领、到达后最终通关，不用重打场次充当首领样本量。无广告重打。连续三次首领平局停止并标censored，不伪造败局；因此通关率是有限策略观察值，不能当真实玩家上限。passiveWindows按实际拥有被动集合分组，同时记录获得后第一战；没有把未拿到/未到达混进被动后窗口。每场记录孵化前后计数与事件、战后孵化、待补蛋；summary包含首孵战序与发生孵化的局数。

冻结旧core通过esbuild解析钩子替换所有初始src/core导入；冻结模块内部相对依赖继续在同一快照中解析。baseline-inputs.json记录实际构建输入，脚本断言没有混入当前core。baseline-hashes.json固定core和策略脚本摘要。baseline-runner.mjs是完整冻结可执行bundle，可直接用Node复现，不依赖后续变动的源码。

复现（从games/zhenlie-demo/source，用PowerShell）：

```powershell
$env:FROZEN_CORE=(Resolve-Path '../../../output/downloads/qibing-main-20261022-9c0d506/奇兵列阵/source/src/core').Path
$env:SAMPLES='50'
node scripts/balance-revision.mjs
node scripts/balance-summary.mjs ../output/balance-20261022/simulation/baseline.json ../output/balance-20261022/simulation/baseline-summary.json
```

新core跑前移除FROZEN_CORE环境变量；输出candidate.json。先确认主责已完成共享代码，再运行，不在改动中途采样。50合法seed用于方向性判断；未证明统计显著性，也不代替手机真实输入验收。

## 策略v2修正

旧baseline/mechanics/candidate1保留。只读失败追踪发现旧Reva遇队首嘲讽时会不换位，导致惊扰/奇袭/孤军不发挥；旧报告的蕾娃强度结论不可靠，不可据此盲目加强。v2改为可见阵容/被动启发式评估换位，遵守嘲讽优先，考虑低血高威胁目标、狙击/决斗对位、惊扰减攻、奇袭延后、孤军阻止接收治疗；选择过程不调用simulate。不使用全局胜负oracle。

新报告必须用同一策略v2重跑冻结旧core的baseline-v2与最终core的final，旧版与v2不混配归因。待主责最终core就绪后再执行各1300局。AUDIT_LABEL环境变量决定runner/inputs/JSON文件名，保留旧证据。
