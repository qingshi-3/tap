# 战斗规则修订验证

2026-10-22，本地入口 games/zhenlie-demo/source；未改冻结下载快照。

## 实现
- 普通施法、蓄力技能、光誓统一执行入口；施法后监听可看到追加施法。
- 法涌/余韵追加消耗原普通技能charges，效果级cap/capBattle仍由apply检查；追加不再法涌递归，余韵复制最近一次常规行动实际施法种类。
- 蓄力强化普攻保留attack；追加蓄力技能不消耗下一轮蓄力，技能效果上限照常。
- 普攻按当前槽位决斗，嘲讽优先；连击整次锁定目标且死亡不转火，独立追击重新选人。
- 实际目标直接普攻击杀才触发击败对手；溅射/技能/反击不计。赤蛇与opponent也使用实际普攻目标。
- 导出previewAttackTarget供界面与战斗共用。
- 早孵龙+1/+2、硬壳龙护甲1，蛋保留嘲讽护甲2。
- 卡拉纯色保留n+3数值并叠加折射/分光。
- 岚刃armorPiercer每段对护甲>0目标追加values伤害。
- EnemyEntry.armor覆盖固有护甲（负值夹0），保留光环；初始snap和实时护甲一致。

## 验证
命令（source目录）：
node node_modules/vitest/vitest.mjs run tests/balance-revision.test.ts tests/engine.test.ts tests/unit-targeting.test.ts tests/smoke-keywords.test.ts tests/action-rounds.test.ts tests/v08-generals-enemy-only.test.ts --maxWorkers=2

结果：6文件、95行为检查通过；新增balance-revision含23项。覆盖共享限次、蓄力/光誓施法后、禁止复制递归、蓄力普攻、效果本场上限、决斗优先级/空位/换位/嘲讽/连击/追击/赤蛇/伤害归属、护甲覆盖、岚刃对照、星角龙/蛋、卡拉折射/分光组合。

旧engine.test法强测试改为s_caster，同样坚持实际伤害4的断言；a_cult本轮内容基础伤害降低，不再适合作原先3+1测试样本。

整套测试、最终构建、模拟配对、界面真实输入交由主责集成。无存档或UnitState新字段；仅EnemyEntry增加armor可选参数。

## 16:58 后续候选与边界修订
- 余韵本次施法后若次数耗尽或无有效目标，既不复制也不fallback追击；只有本次实际普攻才保留压轴追击。
- 赤蛇：实际目标发生阵亡即触发（含立即复生）；双方同时阵亡时统计直接击杀事实，已死亡赤蛇不执行追击。
- 可配对评估候选：亲征每章+2/+4（一章3/8不变）；法伊前2回合全敌延后、长冬第3回合仅后2名，凝滞/霜钟先机窗口相应2/3回合；纯色X=min(6,n+3)；熔岩护体第2/4/6…回合末发1格挡，灼烧不动。
- 同一局部命令重跑6文件114项全通过；新增文件42项。候选是否最终保留待主责同种子配对结果。
