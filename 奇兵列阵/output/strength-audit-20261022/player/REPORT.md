# 玩家强度与成长空间测试

仅测试诊断，未改src/core、UI、产品数值或包。主样本1170局：13主将×30新合法seed×3公开策略，前10校准390局、后20冻结保留780局。辅助：casual130、恢复60、有效少刷30、资源消融195条合法轨迹、声明式蓄力覆盖30、商店敏感性78，共1693条最终轨迹。initial/prefreeze/before-general为方法修正中间记录，不混入最终结果。

## 策略契约与限制

- growth：保成长核心，保留培养与永久成长投入，非专门买卖流；没有证明最优发动机购买/出售顺序。
- upgrade：同名合成优先、比较合成后有效战力，避免仅因阶级更高出售已培养主力。
- mechanism：从当前可见核心及主将公开职责选择召唤、蓄力、寒意、灼烧、轮换、决斗、防御、成长路线；按能力字段和互补角色，不预演候选战斗。
- casual：不刷新、不过度买卖、正常培养装备合成、固定normal，独立普通玩家基线，仍不能代表所有新手。

不看未来货架/敌阵，不注资源，不重打选结果。优化策略只在满命且可见组合/卡面条件满足时选elite；其它normal。奖励按公开适用价值、晋升按当前需求。萨吉选预备位，卡西瓦安排祭品尾位，蕾娃按公开敌阵调动；有明确用途的主将可投法强。纯召唤/增益不投无效法强。

原780保留存在声明式供能识别缺陷：只查special keeper，漏掉d_keeper.onAttacked.charge；旧结果原样保留，不能声称它验证完整蓄力流。后续只补独立coverage-charge，不拿保留结果回调采购。装备/全局效果商店优先级也有强偏好，独立敏感性样本单列。

## 门禁与截断

全部最终phase failed/illegal/fault/changed=0，TypeScript通过。正常结算逐次比较buildBattle预测与beginBattle/finishBattle真实提交growth，无差异；所有最终批core SHA一致。JSONL流式写，每战记录动作/花费/余金/刷新、原始train/growth/equips、分项估值、阵型/备战位、组合首成型、精确enemyIds/variant/path/name、首遇retry0及重试、死亡/疲劳；非胜局保setup和事件，可重放。

0故障不代表全部结算完整：沿用第3次相同boss draw截断，最后一局在begin/finish前停止；保留86条(第一首领10、第二69、最终7)，记未通关/截断，不能当扣命失败或全程结算无错。各批见TRUNCATED-RUNS.json。

## 逐策略与主将

| 策略 | 校准通关/130 | 保留通关/260 | 第二首领首遇胜/到达 |
|---|---:|---:|---:|
| growth | 39 | 75 | 85/259 |
| upgrade | 39 | 84 | 101/259 |
| mechanism | 26 | 48 | 69/220 |

casual通关10/130，不能把优化策略结果当普通新手体验。保留每格20局：

| 主将 | 保核心 | 升星 | 机制 |
|---|---:|---:|---:|
| argeon | 3 | 4 | 0 |
| zilan | 11 | 12 | 8 |
| kaleos | 10 | 11 | 8 |
| reva | 3 | 5 | 2 |
| lilithe | 4 | 2 | 2 |
| kasiva | 3 | 8 | 3 |
| vulkan | 17 | 11 | 9 |
| xingjiao | 3 | 5 | 4 |
| faie | 1 | 3 | 0 |
| kara | 9 | 5 | 4 |
| zirix | 6 | 7 | 4 |
| sajj | 3 | 3 | 2 |
| hank | 2 | 8 | 2 |

首遇尖峰：第二首领霜魇女皇255/738胜(34.6%)、633场实际疲劳；最终首领191/293胜、153疲劳；1:6荆棘守卫74/85胜、18疲劳。RESULTS.json精确分name/敌阵ID/首遇/重试，不把普通/精英或main/variant混为一个敌阵。结构攻血是公开压力字段，不被当作实际战力。

## 真实成长空间

每局首次到达该章的中位统计，仅对到达者，有幸存偏差。星为场上平均星级的中位；培养为当前持有者点数(不含stash/主将点)；永久成长为原始攻/血/法强。持有账本在本次commit前，战斗setup已含本次endPrep预测，不混算。

| 策略/章 | 到达 | 场均星中位 | 培养点中位 | 永久攻/血/法强中位 |
|---|---:|---:|---:|---|
| growth/1 | 260 | 1.0 | 0.0 | 0.0/0.0/0.0 |
| growth/2 | 259 | 2 | 25 | 4/0/0 |
| growth/3 | 100 | 2.0 | 51.0 | 4.0/6.0/0.0 |
| upgrade/1 | 260 | 1.0 | 0.0 | 0.0/0.0/0.0 |
| upgrade/2 | 259 | 2 | 25 | 2/0/0 |
| upgrade/3 | 112 | 1.8 | 52.0 | 2.0/0.0/0.0 |
| mechanism/1 | 260 | 1.0 | 0.0 | 0.0/0.0/0.0 |
| mechanism/2 | 222 | 2.0 | 25.0 | 2.0/0.0/0.0 |
| mechanism/3 | 88 | 2.0 | 51.0 | 1.5/4.0/0.0 |

中后期约51–52点真实培养，形成可观成长空间；永久成长较低也受未规划买卖发动机影响，不能称成长卡无用。装备持有中位0是boon优先消费偏差，后有独立对照。

机制策略召唤+收益核心86/260成型，中位第6次战斗，174未成型；旧蓄力+电池仅1/260，第12战，但存在上述识别缺陷。全保留d_keeper见732局买0、hourglass见688买5，不可说电池池内不可得。看守见677买59；CORE-AVAILABILITY.json将日志可见/实际获取分开。

四阶661/780局实际持有，首次中位第9战、后续实际战斗中位8场；五阶698/780，第12战、后5场；六阶299/780，第15战、后7场。后续场次含重试，是观察统计，不被策略提前读取。ID→tier来自所有出场ID再回查持有，未曾出场的未知ID可能漏记；未到达不等于抽取失败。

## 资源消融与分支边际

195条合法轨迹3506场，冻结真实setup/敌阵/seed分别移除当前培养、growth或装备，离线重放不反馈策略。去培养不抹去历史培养触发的永久成长，因此只测当前账本边际。

| 移除项 | 有对应部署投入的快照 | 原胜→负 | 原胜→平 |
|---|---:|---:|---:|
| growth | 2306 | 20 | 6 |
| training | 3311 | 737 | 59 |
| equipment | 275 | 4 | 1 |

装备投入快照仅275，不能据低影响称装备无用。同合法own setup换normal/elite敌阵与规则457组，normal胜而elite负10组、胜而elite平3组；不换奖励，未反馈分支选择。

## 有界恢复

wrongBuy30/30实际买后卖、每局净损2金、无补偿；前四每战均30/30胜。后续5/30通关对基线2/30，推荐/RNG/合法成长历史已变，不能解释成犯错更优。

旧skipRefresh30组实际干预0，起手本来不刷，保留无效证据而不声称已覆盖恢复。recovery-effective新30配对在第2–5战真正首个欲刷新分支拦截，30/30有效、无补偿；前四每战30/30胜，后续7/30通关，不根据结果调策略。

## 最后覆盖补充

coverage-charge新seed71010011起，阿尔吉昂/赫克/萨吉各10合法局，固定识别声明式给其他友军加能与沙漏，已有蓄力时采购/部署相邻电池：见23/30、买22/30、初始真实相邻11/30、可明确源归属成功加能7/30共85点。无源hourglass额外加能保守排除，不偷算成守卫收益。4/30通关仅覆盖结果，不能用来回调保留组。

商店敏感性新seed81010011起，13将各3合法seed，固定upgrade，其余冻结，公开适用装备优先vsboon优先各39局：

| 商店政策 | 装备命令 | 第二首领首遇胜/负/平 | 二首领实际疲劳 | 通关 |
|---|---:|---|---:|---:|
| boon优先 | 0 | 11/20/7 (到达38) | 30 | 9/39 |
| 装备优先 | 264 | 6/31/1 (到达38) | 35 | 3/39 |

消费政策真实增加装备，但同时牺牲全局效果/培养包和改变推荐历史；不支持装备自动解决二首领，也不支持装备无用。保持其它脚本策略冻结、未预演挑装备。下一轮如继续应比较不同消费组合，而非据本轮改产品。

## 文件与复现

最终紧凑汇总：RESULTS.json、GROWTH-SPACE.json、ABLATION-RESULTS.json、CORE-AVAILABILITY.json、TRUNCATED-RUNS.json、COVERAGE-CHARGE.json、SHOP-SENSITIVITY.json；逐phase-*summary含core/脚本SHA，FINAL-SCRIPTS.json为最后脚本SHA。后补能力识别/覆盖入口使最终脚本版本不同于旧780保留；已增加显式legacyAuditClassifier选项(LEGACY_AUDIT_CLASSIFIER=1)保存旧分类口径，不修改原数据。新覆盖/商店组设0使用声明式识别。未重新运行完整780轨迹来证明最终脚本逐条一致，因此不宣称旧结果已被最终脚本再次逐一验证；非胜局setup/trace可精确复演。

PowerShell于source目录，建议设新的AUDIT_OUTPUT避免覆盖证据：

```powershell
$env:AUDIT_OUTPUT='../output/strength-audit-20261022/player-replay'
Remove-Item Env:AUDIT_GENERALS -ErrorAction SilentlyContinue
Remove-Item Env:AUDIT_SEED_BASE -ErrorAction SilentlyContinue
$env:LEGACY_AUDIT_CLASSIFIER='1'
$env:AUDIT_PHASE='calibration'; $env:AUDIT_COUNT='10'; npx vite-node scripts/player-growth-audit.ts
$env:AUDIT_PHASE='holdout'; $env:AUDIT_COUNT='20'; npx vite-node scripts/player-growth-audit.ts
$env:AUDIT_PHASE='casual'; $env:AUDIT_COUNT='10'; npx vite-node scripts/player-growth-audit.ts
$env:AUDIT_PHASE='ablation'; $env:AUDIT_COUNT='5'; npx vite-node scripts/player-growth-audit.ts
$env:AUDIT_GENERALS='argeon,faie,hank,xingjiao,sajj'; $env:AUDIT_COUNT='2'
$env:AUDIT_PHASE='recovery'; npx vite-node scripts/player-growth-audit.ts
$env:AUDIT_PHASE='recovery-effective'; npx vite-node scripts/player-growth-audit.ts
$env:LEGACY_AUDIT_CLASSIFIER='0'
$env:AUDIT_GENERALS='argeon,hank,sajj'; $env:AUDIT_COUNT='10'; $env:AUDIT_SEED_BASE='71010011'; $env:AUDIT_PHASE='coverage-charge'; npx vite-node scripts/player-growth-audit.ts
Remove-Item Env:AUDIT_GENERALS -ErrorAction SilentlyContinue
$env:AUDIT_COUNT='3'; $env:AUDIT_SEED_BASE='81010011'; $env:AUDIT_PHASE='shop-sensitivity'; npx vite-node scripts/player-growth-audit.ts
```

主seed规则23010011+n×104729，每将公开三选筛前30合法seed；前10校准、后20保留。不再扩研究、不改数值、不打包。
