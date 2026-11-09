# 批次 III 后端活动任务

## 范围与授权
- 目标：实现本轮用户明确规格的 4 张法术、5 件遗物、先锋徽章改版、首战遗物、旧秘药迁移及回归测试。
- 只写 src/core/*、scripts/*；禁止改 UI/qb、CSS、美术、冻结 scripts/balance-compare/baseline/* 和 scripts/balance-v4/candidate-no-authored/*；不提交 Git。
- master 工作区原地实现，保留原有修改。设计文档只参考，本轮任务规格优先。

## 文件归属
- engine_data 执行 Agent：src/core/data.ts、src/core/engine.ts。
- run_logic 执行 Agent：src/core/run.ts。
- batch3_tests 执行 Agent：scripts/v09-batch3-test.ts。
- 主 Agent：必要 bot 兼容修正、本活动任务与验证记录；集成审查，执行 Agent 结束后接管其文件。
- 不追加写入者；共享构建/验证由主 Agent 串行执行。

## 关键契约
- GrantedAbility.id 添加 thorn/sprout，tempered?:boolean；永久值 bone/spark/thorn=2、sprout=1；淬炼 ×2 且仅一次，blood 不可。
- x_thorn tier3 price2 target icon plate；x_sprout tier3 price2 target icon milk；x_temper tier5 price3 target icon whet；x_crown tier6 price6 target icon banner；x_ready tier4；删除 f_elixir，load 中各物品位置迁移 x_copy 保留字段。
- thorn 正伤且敌方活来源反伤，沿正常技能伤害及 thornback 共用递归防护。sprout 提交 endTurn 一次永久成长。crown tier≤4 未金色，走 addCopies。
- r_pouch 出售额外 1 金（含遣散，放弃不算）；r_brood 召唤全队 +1 攻最多5次；r_runebox 正式胜利 enqueueCard 随机当前 tier 战术池；r_ember 单次临战施法实际命中去重永久 +1/+1，含法老额外执行但不重复食用；r_motley line 去重排除 any/enemy 满3开战+2/+2，导出 motleyCount。
- r_vanguard 每个友军本场首次实际受伤后按 oid 向 BattleOut.perm 记 hp+1，沿 settleBattle 上限回写；如果现有通道不支持才保留旧版并说明。
- 新 firstRelicGiven?:boolean：newRun false，旧 load 缺失 true；首场正式结算存活且未终局发一次遗物。首战普通池 r_share/r_vanguard/r_relay/r_reserve/r_runebox/r_ember/r_motley，RARE_FIRST=[]；先均匀普通保底，再按4:1加权无放回2张。之后全池加权3张；rng(r)，广告保持多选语义。
- 所有新字段可选，SAVE_KEY 保持 pdqs3_run_v3。

## 开工前基线（2026-11-06）
- trigger-contract-test：通过，339 behavior assertions。
- v09-combat-test：通过。
- v09-run-test：通过。
- v09-journey-test：退出码1；first=1,searched=50,strategy=combo,wins=18,combinations=5,full=0。
- stat-cap-test：通过。
- battle-stats-test：通过，783 assertions。
- prep-feedback-test：通过，48 assertions。

## 验收与恢复入口
- 新 scripts/v09-batch3-test.ts 覆盖任务列出的法术/遗物/迁移/种子/正式战斗与重复结算边界，使用 node:assert。
- 最后顺序运行 tsc、7项既有测试、新测试、sim.ts 300 0.65。日志留 scripts/batch3-validation/，不得写冻结目录。
- 交付列实现位置、偏差、UI f_elixir 引用、临时图标及 granted 待适配位置。
- 当前：实现、集成审查和指定顺序验证完成。详细交付见 scripts/batch3-report.md；日志与退出码见 scripts/batch3-validation/。
- 最终：tsc、6项原先通过的测试及新测试通过；journey仍原有退出码1（50种子18通关、组合3、full0）；sim 300/0.65正常结束，通关37.7%。
