# 献祭f：兑现行动配对

f: sacrifice pursuit after complete payment/death/rattle; frozen product, same development seeds. old/legal fodder policies are explicit parameter only, identical source hashes. Legal f2 is main strategy. Not holdout.

|组|通关|失败|截断|前三战全胜|
|---|---:|---:|---:|---:|
|development-f1-sacrifice|6/16|9|1|16/16|
|development-f2-sacrifice|9/16|7|0|16/16|
|development-f-normal|15/16|0|1|16/16|
|development-f-duel|14/16|1|1|16/16|
|development-f-summon|16/16|0|0|16/16|

80局全部0fault、失败API、预算错误、批中源码变化。f1/f2源码hash完全相同，仅BENCH_VOID_FODDER=old/legal不同。f源码完整备份 frozen-development-f。

同开发种子的阶段对照：旧严格过滤e 0→f1 6；合法亡语过滤e2 3→f2 9。合法f2作为后续主策略，旧过滤只用来分离策略错误。不是独立holdout。

- development-f1-sacrifice: 逐轮状态{'actual-sacrifice': 328, 'ineligible-tail': 130, 'only-core-at-tail': 20}；首轮{'actual-sacrifice': 135, 'ineligible-tail': 23}；不合格尾{'a_jugg': 33, 'a_ritualist': 39, 'a_matriarch': 58}；worm歧义0。
- development-f2-sacrifice: 逐轮状态{'actual-sacrifice': 363, 'ineligible-tail': 101, 'only-core-at-tail': 3}；首轮{'actual-sacrifice': 151}；不合格尾{'a_jugg': 18, 'a_ritualist': 14, 'a_matriarch': 69}；worm歧义0。

献祭按召唤/亡语的资源消费分支解释，不要求无补给的独立纯队。当前legal f2仍有祭品消耗后的停机，不能用关键词标签或通关率代替供应链检查。

- development-f1-sacrifice: 玩家有效伤害{'attack': 32152, 'burn': 454, 'ability': 1210, 'thorns': 709, 'splash': 1}；Void来源统计Counter({'damage': 14527, 'positiveAtkBuff': 1517, 'thorns': 520, 'blocksConsumed': 463, 'sacrifices': 328, 'deployments': 158, 'casts': 0, 'blockGranted': 0})；祭仪师Counter({'positiveAtkBuff': 111, 'casts': 31, 'sacrifices': 31, 'deployments': 19, 'damage': 19, 'blocksConsumed': 1, 'thorns': 0, 'blockGranted': 0})；失败{'3:9:永夜君王': 8, '1:9:虚空领主': 1}。
- development-f2-sacrifice: 玩家有效伤害{'attack': 30759, 'burn': 392, 'ability': 906, 'thorns': 568, 'splash': 1}；Void来源统计Counter({'damage': 14832, 'positiveAtkBuff': 2251, 'blocksConsumed': 442, 'sacrifices': 363, 'thorns': 362, 'deployments': 151, 'casts': 0, 'blockGranted': 0})；祭仪师Counter({'positiveAtkBuff': 111, 'casts': 31, 'sacrifices': 31, 'deployments': 19, 'damage': 19, 'blocksConsumed': 1, 'thorns': 0, 'blockGranted': 0})；失败{'3:9:永夜君王': 6, '1:9:虚空领主': 1}。
