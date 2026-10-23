# 0.11逐卡内容变更

48张候选逐项记录。SAP引用2026-10-22社区快照，patch未确认；只借职责/回报窗口，不等同本作数值平衡。112普通ID/阶级保留。所有改动待集成与同预算/合法成长轨迹，不宣称平衡通过。

## l_shield 银盾侍卫（已调整）

SAP：Ox: Friend ahead faints: Gain Melon perk and +1 attack. Works 1 time per turn.；Turtle: Faint: Give Melon perk to the nearest friend behind.

防护先于首次承伤兑现；轮换保护接棒者。

旧：`C('l_shield', '银盾侍卫', 'light', 1, 2, 5, 'front', '轮换；成为队首时：获得 [1,2,2] 层格挡', '前排·轮换·给格挡',     { traits: { rotate: true }, onFront: [fx('block', 'self', [1, 2, 2])] }),`

新：`C('l_shield', '银盾侍卫', 'light', 1, 2, 5, 'start', '轮换；开战时：获得 [1,2,2] 层格挡；自己轮换后：新队首获得 1 层格挡（每回合限 1 次）', '前排·轮换·给格挡',     { traits: { rotate: true }, onStart: [fx('block', 'self', [1, 2, 2])], onRotate: [fx('block', 'front', t3(1), { cap: t3(1) })] }),`

证据：补测48完整场景20零触发、24零实际挡伤、9死前零触发；去onFront对48场无胜负改变。原稳定免伤判断撤回

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## l_vigil 守誓者（已调整）

SAP：Giraffe: Start of turn: Give the nearest friend ahead +1 attack and +1 health.；Monkey: End turn: Give front-most friendly pet +2 attack and +2 health.

明确结束备战只提交一次，数值暂保留。

旧：`C('l_vigil', '守誓者', 'light', 2, 2, 5, 'passive', '在场且备战结束时：队首永久 +[1,2,3] 生命', '辅助·培养',     { prep: [{ event: 'endPrep', scope: 'self', target: 'front', hp: [1, 2, 3] }] }),`

新：`C('l_vigil', '守誓者', 'light', 2, 2, 5, 'passive', '在场且备战结束时：队首永久 +[1,2,3] 生命（每次备战限 1 次）', '辅助·培养',     { prep: [{ event: 'endPrep', scope: 'self', target: 'front', hp: [1, 2, 3] }] }),`

证据：裸用可养自己但收益很薄；结束备战反复改布局不会重复发钱，卡面缺限次

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## l_windblade 风刃剑士（已调整）

SAP：Kangaroo: Friend ahead attacks: Gain +1 attack and +1 health.；Boar: Before attack: Gain +4 attack and +2 health.

移除已行动后临时增益过期；有界本场成长。

旧：`C('l_windblade', '风刃剑士', 'light', 1, 3, 4, 'front', '轮换；成为队首时：本回合 +[2,3,4] 攻', '输出·轮换',     { traits: { rotate: true }, onFront: [fx('buff', 'self', [2, 3, 4], { temp: true })] }),`

新：`C('l_windblade', '风刃剑士', 'light', 1, 3, 4, 'front', '轮换；开战及成为队首时：自己本场 +[1,2,3] 攻（成为队首每回合限 2 次）', '输出·轮换',     { traits: { rotate: true }, onStart: [fx('buff', 'self', [1, 2, 3])], onFront: [fx('buff', 'self', [1, 2, 3], { cap: t3(2) })] }),`

证据：补测48完整场景21零onFront；2轮换和混队的满5队首常不触发，二位配前方轮换才较可靠；部分增攻发生于已经行动后，需等下一轮且会清临时增益

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## l_lion 蔚蓝雄狮（已调整）

SAP：Ox: Friend ahead faints: Gain Melon perk and +1 attack. Works 1 time per turn.；Kangaroo: Friend ahead attacks: Gain +1 attack and +1 health.

以消耗盾成长使挡伤与输出同向。

旧：`C('l_lion', '蔚蓝雄狮', 'light', 2, 4, 5, 'attack', '普攻伤害 + 自己的格挡层数 ×[1,2,3]', '输出·吃格挡', { special: 'lion' }),`

新：`C('l_lion', '蔚蓝雄狮', 'light', 2, 4, 5, 'attack', '开战时：获得 1 层格挡；自己每消耗 1 层格挡：本场 +[2,3,4] 攻', '输出·吃格挡', { onStart: [fx('block', 'self', t3(1))], special: 'lion' }),`

证据：盾被打掉就丢增伤，前排难稳定；三星每层3有上限9但不是常态

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## l_mender 辉光医者（已调整）

SAP：Rabbit: Friendly ate food: Give them +1 health. Works 3 times per turn.；Penguin: Start of turn: Give two level 2 or higher friends +1 attack and +1 health.

补清培养净提交与对象限次。

旧：`C('l_mender', '辉光医者', 'light', 4, 1, 8, 'passive', '在场时：其他友军完成培养后，该友军永久 +[2,3,4] 生命（每次备战限 2 次）', '辅助·培养',     { prep: [{ event: 'train', scope: 'ally', target: 'event', hp: [2, 3, 4], cap: 2 }] }),`

新：`C('l_mender', '辉光医者', 'light', 4, 1, 8, 'passive', '在场时：其他友军完成培养后，该友军永久 +[2,3,4] 生命（每对象每次备战限 1 次，共 2 名；开战提交，能力成长不算培养）', '辅助·培养',     { prep: [{ event: 'train', scope: 'ally', target: 'event', hp: [2, 3, 4], cap: 2 }] }),`

证据：实际按完成备战后的对象触发，不是每点培养；单核心投入再多只得2/3/4

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## l_cliff 铁崖守护者（已调整）

SAP：Gorilla: Hurt: Gain Coconut perk. Works 1 time per turn.；Ox: Friend ahead faints: Gain Melon perk and +1 attack. Works 1 time per turn.

一星先有一次防护，不提高受击补盾上限。

旧：`C('l_cliff', '铁崖守护者', 'light', 5, 3, 10, 'hurt', '嘲讽；被普攻后：获得 1 层格挡（每回合最多 [1,2,2] 次）', '前排·嘲讽·给格挡',     { traits: { taunt: true }, onAttacked: [fx('block', 'self', t3(1), { cap: [1, 2, 2] })] }),`

新：`C('l_cliff', '铁崖守护者', 'light', 5, 3, 10, 'hurt', '嘲讽；开战时：获得 1 层格挡；被普攻后：获得 1 层格挡（每回合最多 [1,2,2] 次）', '前排·嘲讽·给格挡',     { onStart: [fx('block', 'self', t3(1))], traits: { taunt: true }, onAttacked: [fx('block', 'self', t3(1), { cap: [1, 2, 2] })] }),`

证据：一星新买只有10血且每回合一次挡伤，5阶时要与现有已养前排竞争；嘲讽虽有直接收益但反抢受击伙伴，尚无合法晚买窗口验证

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## l_sunriser 旭日守望（保留待验证）

SAP：Turtle: Faint: Give Melon perk to the nearest friend behind.；Fish: Level-up: Give two friends +1 attack and +1 health.

保留当前供盾/亡语倍增/采购成长职责；现有证据不足以定量改数值，交由同预算与合法入手轨迹验证。

旧：`C('l_sunriser', '旭日守望', 'light', 5, 4, 9, 'start', '开战时：生命最高的友军获得 [2,3,3] 层格挡；在场时：其他友军升星后，该友军永久 +[2,4,6] 生命（每次备战限 1 次）', '辅助·给格挡·升星',     { onStart: [fx('block', 'highestHp', [2, 3, 3])], prep: [{ event: 'upgrade', scope: 'ally', target: 'event', hp: [2, 4, 6] }] }),`

新：`C('l_sunriser', '旭日守望', 'light', 5, 4, 9, 'start', '开战时：生命最高的友军获得 [2,3,3] 层格挡；在场时：其他友军升星后，该友军永久 +[2,4,6] 生命（每次备战限 1 次）', '辅助·给格挡·升星',     { onStart: [fx('block', 'highestHp', [2, 3, 3])], prep: [{ event: 'upgrade', scope: 'ally', target: 'event', hp: [2, 4, 6] }] }),`

证据：升星奖励每备战一次，不能把晚期少量合成当成长主引擎；三星+6生命有收益但难多轮

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## l_caliber 圣铸机兵（已调整）

SAP：Mammoth: Faint: Give friends +2 attack and +2 health.；Turkey: Friend summoned: Give it +3 attack and +1 health.；Snake: Friend ahead attacks: Deal 5 damage to one random enemy. Works 5 times per battle.

六阶自身提供轮换入口，增强首次一星收益。

旧：`C('l_caliber', '圣铸机兵', 'light', 6, 5, 10, 'passive', '友军轮换时：新的队首本场 +[1,2,3]/+[1,2,3]（每回合最多 3 次）', '辅助·吃轮换',     { special: 'caliber' }),`

新：`C('l_caliber', '圣铸机兵', 'light', 6, 5, 10, 'passive', '轮换；友军轮换时：新的队首本场 +[3,4,5]/+[3,4,5]（每回合最多 3 次）', '辅助·吃轮换',     { traits: { rotate: true }, special: 'caliber' }),`

证据：有明确反证：3轮换较高前期培养物理场技能使负转胜；但1轮换6组都只给一次+1/+1，晚买低配套回报薄

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## s_ninja 连环忍者（已调整）

SAP：Hippo: Knock out: Gain +3 attack and +3 health. Works 3 times per battle.；Rhino: Knock out: Deal 4 damage to the first enemy. Double against tier 1 pets.

提高首杀与承伤入口，保留每回合一次追加。

旧：`C('s_ninja', '连环忍者', 'shadow', 5, 3, 5, 'kill', '连击；击杀时：本回合行动次数 +1（每回合限 1 次）；自己升星时：永久 +[1,2,3] 生命（每次备战限 1 次）', '输出·连击·给行动次数·升星',     { traits: { combo: true }, onKill: [fx('addAction', 'self', t3(1), { oncePerRound: true })], prep: [{ event: 'upgrade', scope: 'self', target: 'self', hp: [1, 2, 3] }] }),`

新：`C('s_ninja', '连环忍者', 'shadow', 5, 5, 7, 'kill', '连击；击杀时：本回合行动次数 +1（每回合限 1 次）；自己升星时：永久 +[1,2,3] 生命（每次备战限 1 次）', '输出·连击·给行动次数·升星',     { traits: { combo: true }, onKill: [fx('addAction', 'self', t3(1), { oncePerRound: true })], prep: [{ event: 'upgrade', scope: 'self', target: 'self', hp: [1, 2, 3] }] }),`

证据：额外次数不是立刻行动；晚期低身材与培养成本挤压收益，三星仅升星hp多2并无杀奖提升

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## s_choreo 刃影导师（已调整）

SAP：Dragon: Tier 1 friend bought: Give friends +1 attack and +1 health. Works 4 times per turn.；Horse: Friend summoned: Give it +1 attack until next turn.

改为培养已有连击核心，不依赖晚期再买同轴单位。

旧：`C('s_choreo', '刃影导师', 'shadow', 4, 2, 6, 'passive', '在场时：购买其他带连击的友军后，该友军永久 +[1,2,3] 攻（每次备战限 2 次）', '辅助·连击·购买',     { prep: [{ event: 'buy', scope: 'ally', target: 'event', atk: [1, 2, 3], cap: 2, tag: '连击' }] }),`

新：`C('s_choreo', '刃影导师', 'shadow', 4, 2, 6, 'passive', '在场且备战结束时：相邻带连击的友军永久 +[2,3,4] 攻（每次备战限 1 次）', '辅助·连击·培养',     { prep: [{ event: 'endPrep', scope: 'self', target: 'adjacent', atk: [2, 3, 4], targetTag: '连击' }] }),`

证据：裸用无战斗技能；2–3卡组合只有未来买卡收益，已培养旧核心无补偿；后续合并可保收益但窗口仍窄

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## s_caster 四风术士（已调整）

SAP：Dolphin: Start of battle: Deal 4 damage to the lowest health enemy.；Crocodile: Start of battle: Deal 8 damage to the last enemy.

定点威胁削弱配同阶首次伤害阈值。

旧：`C('s_caster', '四风术士', 'shadow', 4, 1, 6, 'cast', '法强 +1；施法：敌方攻击最高的单位受 [3,4,6] 伤害，本场攻击 −1', '施法·输出·法强',     { lockTargets: true, traits: { power: t3(1) }, cast: [fx('dmg', 'enemyHighestAtk', [3, 4, 6]), fx('weaken', 'enemyHighestAtk', t3(1))] }),`

新：`C('s_caster', '四风术士', 'shadow', 4, 1, 6, 'cast', '法强 +1；施法：敌方攻击最高的单位受 [5,7,9] 伤害，本场攻击 −1', '施法·输出·法强',     { lockTargets: true, traits: { power: t3(1) }, cast: [fx('dmg', 'enemyHighestAtk', [5, 7, 9]), fx('weaken', 'enemyHighestAtk', t3(1))] }),`

证据：每行动定点锁伤与削攻，击杀后不把削弱转到新目标；法强有收益但底盘/阶段性偏弱

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## s_lord 岚影宗主（已调整）

SAP：Tiger: The friend ahead repeats their ability in battle as if they were level 1.；Rhino: Knock out: Deal 4 damage to the first enemy. Double against tier 1 pets.

保留自己击败→身后友军追击独立职责，本体6/12增强首次收割入口。

旧：`C('s_lord', '岚影宗主', 'shadow', 6, 4, 9, 'start', '决斗；开战时：攻击最高的友军获得决斗；击败对手时：身后一名友军追击，本次攻击 +[1,2,3]', '辅助·给决斗·追击',     { onStart: [fx('grant', 'highestAtk', undefined, { grant: 'duel' })], traits: { duel: true }, onDuelKill: [fx('extraAct', 'behind', [1, 2, 3])] }),`

新：`C('s_lord', '岚影宗主', 'shadow', 6, 6, 12, 'start', '决斗；开战时：攻击最高的友军获得决斗；自己击败对手时：身后一名友军追击，本次攻击 +[1,2,3]', '辅助·给决斗·追击',     { onStart: [fx('grant', 'highestAtk', undefined, { grant: 'duel' })], traits: { duel: true }, onDuelKill: [fx('extraAct', 'behind', [1, 2, 3])] }),`

证据：onDuelKill仅属于宗主本人，不是授予决斗者击杀就让其身后追击；文案易误读且三星仅追击+3

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## s_panda 熊猫武尊（已调整）

SAP：Shark: Friend faints: Gain +2 attack and +2 health.；Hippo: Knock out: Gain +3 attack and +3 health. Works 3 times per battle.

本体能提供一次决斗入口，仍不加团队触发上限。

旧：`C('s_panda', '熊猫武尊', 'shadow', 5, 6, 12, 'duel', '任一友军击败对手时：全体友军本场 +1 攻（每回合最多 [1,1,2] 次）', '辅助·吃决斗',     { special: 'panda' }),`

新：`C('s_panda', '熊猫武尊', 'shadow', 5, 6, 12, 'duel', '决斗；任一友军击败对手时：全体友军本场 +1 攻（每回合最多 [1,1,2] 次）', '辅助·吃决斗',     { traits: { duel: true }, special: 'panda' }),`

证据：一星6/12提供即时身材反证，但全队仅每回合+1攻且必须决斗先杀，首次晚买可能只放大已赢局；未有同预算因果证据证明能占五阶位

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## a_cult 献祭术士（已调整）

SAP：Flamingo: Faint: Give the two nearest friends behind +1 attack and +1 health.；Beaver: Sell: Give two random friends +1 attack.

出售前先筛实际法强受益者再排序。

旧：`C('a_cult', '献祭术士', 'abyss', 3, 1, 5, 'rattle', '亡语：相邻友军本场法强 +[2,3,4]；出售时：生命最低的友军永久 +[1,1,2] 法强', '辅助·亡语·给法强·出售',     { onRattle: [fx('grant', 'adjacent', [2, 3, 4], { grant: 'power' })], prep: [{ event: 'sell', scope: 'self', target: 'lowestHp', power: [1, 1, 2] }] }),`

新：`C('a_cult', '献祭术士', 'abyss', 3, 1, 5, 'rattle', '亡语：相邻友军本场法强 +[2,3,4]；出售时：生命最低的法术受益友军永久 +[1,1,2] 法强', '辅助·亡语·给法强·出售',     { onRattle: [fx('grant', 'adjacent', [2, 3, 4], { grant: 'power' })], prep: [{ event: 'sell', scope: 'self', target: 'lowestHp', power: [1, 1, 2], targetTag: '法术受益' }] }),`

证据：亡语法强需后续行动兑现，卖卡仅1/1/2且二星不长，但经济功能不能忽略

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## a_brood 育魂者（已调整）

SAP：Giraffe: Start of turn: Give the nearest friend ahead +1 attack and +1 health.；Penguin: Start of turn: Give two level 2 or higher friends +1 attack and +1 health.

补备战结束限次；目标站位可控。

旧：`C('a_brood', '育魂者', 'abyss', 3, 2, 7, 'passive', '在场且备战结束时：相邻带亡语的友军永久 +[1,2,3] 生命', '辅助·亡语·培养',     { prep: [{ event: 'endPrep', scope: 'self', target: 'adjacent', hp: [1, 2, 3], targetTag: '亡语' }] }),`

新：`C('a_brood', '育魂者', 'abyss', 3, 2, 7, 'passive', '在场且备战结束时：相邻带亡语的友军永久 +[1,2,3] 生命（每次备战限 1 次）', '辅助·亡语·培养',     { prep: [{ event: 'endPrep', scope: 'self', target: 'adjacent', hp: [1, 2, 3], targetTag: '亡语' }] }),`

证据：结束备战默认cap1卡面未写；养出生命也可能推迟想要的死亡，但保护前排真实有效

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## a_ritualist 唤亡祭师（已调整）

SAP：Whale: Start of battle: Swallow the nearest friend ahead and release it at level 1 on faint.；Fly: Friend faints: Summon one 4/4 fly in its place. Works 3 times per turn.

降低首死饲料污染并改善首次施法存活。

旧：`C('a_ritualist', '唤亡祭师', 'abyss', 4, 1, 5, 'cast', '施法：第一个阵亡的友军以一半生命复活，插到自己身后（本场最多 [1,1,2] 次，用完改普攻）', '施法·辅助·亡语',     { cast: [fx('revive', 'self')], castUses: [1, 1, 2] }),`

新：`C('a_ritualist', '唤亡祭师', 'abyss', 4, 1, 7, 'cast', '施法：优先使攻击最高的非召唤物阵亡友军以一半生命复活，插到自己身后（本场最多 [1,1,2] 次，用完改普攻）', '施法·辅助·亡语',     { cast: [fx('revive', 'self')], castUses: [1, 1, 2] }),`

证据：自动挑第一个死者无法选择，三星两次仍可能复活同一饲料；法强不提高复活血量

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## a_engulf 吞噬之影（已调整）

SAP：Dolphin: Start of battle: Deal 4 damage to the lowest health enemy.；Fly: Friend faints: Summon one 4/4 fly in its place. Works 3 times per turn.

提高残血斩杀入口，不增召唤频率。

旧：`C('a_engulf', '吞噬之影', 'abyss', 5, 1, 7, 'cast', '施法：敌方生命最低的单位受 [4,6,8] 伤害；击杀时：在队尾召唤 [2,3,4]/[2,3,4] 暗影（每回合限 1 次）', '施法·输出·召唤·亡语',     { cast: [fx('dmg', 'enemyLowest', [4, 6, 8])], onKill: [fx('summon', 'self', [2, 3, 4], { v2: [2, 3, 4], token: 't_shade', rear: true, cap: t3(1) })] }),`

新：`C('a_engulf', '吞噬之影', 'abyss', 5, 1, 7, 'cast', '施法：敌方生命最低的单位受 [6,8,10] 伤害；击杀时：在队尾召唤 [2,3,4]/[2,3,4] 暗影（每回合限 1 次）', '施法·输出·召唤·亡语',     { cast: [fx('dmg', 'enemyLowest', [6, 8, 10])], onKill: [fx('summon', 'self', [2, 3, 4], { v2: [2, 3, 4], token: 't_shade', rear: true, cap: t3(1) })] }),`

证据：召唤每回合一次且满员仅转半属性；暗影队尾新召当轮不行动，低血索敌不保证能杀

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## a_matriarch 深渊主母（保留待验证）

SAP：Tiger: The friend ahead repeats their ability in battle as if they were level 1.；Fly: Friend faints: Summon one 4/4 fly in its place. Works 3 times per turn.

保留当前供盾/亡语倍增/采购成长职责；现有证据不足以定量改数值，交由同预算与合法入手轨迹验证。

旧：`C('a_matriarch', '深渊主母', 'abyss', 6, 4, 11, 'passive', '你的亡语触发两次（不与回魂、魂符和哀悼叠乘）', '前排·吃亡语', { special: 'matriarch' }),`

新：`C('a_matriarch', '深渊主母', 'abyss', 6, 4, 11, 'passive', '你的亡语触发两次（不与回魂、魂符和哀悼叠乘）', '前排·吃亡语', { special: 'matriarch' }),`

证据：一星能立即双亡语而非慢培养，有双暗棘/夜魇时可能有用；但需存活、满场双召转属性、与既有亡语倍增不叠乘，尚无晚买机会成本因果证据

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## a_solus 永夜吟诵者（已调整）

SAP：Monkey: End turn: Give front-most friendly pet +2 attack and +2 health.；Dragon: Tier 1 friend bought: Give friends +1 attack and +1 health. Works 4 times per turn.；Penguin: Start of turn: Give two level 2 or higher friends +1 attack and +1 health.

六阶立即增强真实法术受益者，包含伤害型蓄力。

旧：`C('a_solus', '永夜吟诵者', 'abyss', 6, 3, 9, 'passive', '在场且备战结束时：相邻带施法的友军永久 +[1,1,2] 法强', '辅助·给法强·施法·培养',     { prep: [{ event: 'endPrep', scope: 'self', target: 'adjacent', power: [1, 1, 2], targetTag: '施法' }] }),`

新：`C('a_solus', '永夜吟诵者', 'abyss', 6, 3, 9, 'passive', '开战时：其他法术受益友军本场法强 +[2,3,4]；在场且备战结束时：相邻法术受益友军永久 +[1,2,3] 法强（每次备战限 1 次）', '辅助·给法强·培养',     { onStart: [fx('grant', 'spellAllies', [2, 3, 4], { grant: 'power' })], prep: [{ event: 'endPrep', scope: 'self', target: 'adjacent', power: [1, 2, 3], targetTag: '法术受益' }] }),`

证据：六阶开放晚、收益慢；魂缚吟者蓄力虽享法强但不含施法tag吃不到；默认cap1还漏写

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## a_void 虚空吞噬者（已调整）

SAP：Whale: Start of battle: Swallow the nearest friend ahead and release it at level 1 on faint.；Shark: Friend faints: Gain +2 attack and +2 health.

明确安全祭品与最大生命口径。

旧：`C('a_void', '虚空吞噬者', 'abyss', 5, 6, 12, 'round', '每回合开始时：献祭我方队尾的其他友军，自己本场获得其一半攻击和生命', '前排·亡语·献祭',     { special: 'devourer' }),`

新：`C('a_void', '虚空吞噬者', 'abyss', 5, 6, 12, 'round', '每回合开始时：仅献祭我方队尾其他带亡语、未用复生或召唤物友军，自己本场获得其一半攻击和最大生命；无合格祭品则不献祭', '前排·亡语·献祭',     { special: 'devourer' }),`

证据：第一回合行动前就吃尾，只收半攻半最大血而非完整价值；复生饲料可留人但下一轮仍吃，三星无技能成长

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## m_egg 幼兽蛋（已调整）

SAP：Cricket: Faint: Summon one 1/1 Cricket.；Sneaky Egg: Start of battle: Faint and summon one 4/2 Cracked Egg.

明确后继不继承投入；不无证据提高蛋高星数值。

旧：`C('m_egg', '幼兽蛋', 'magma', 1, 0, 5, 'pulse', '不行动；节拍 3：破壳（视为阵亡）；亡语：召唤 [3,4,6]/[3,4,6] 幼兽', '召唤·亡语·节拍',     { traits: { idle: true, pulse: 3 }, onPulse: [fx('die', 'self')], onRattle: [fx('summon', 'self', [3, 4, 6], { v2: [3, 4, 6], token: 't_hatch' })] }),`

新：`C('m_egg', '幼兽蛋', 'magma', 1, 0, 5, 'pulse', '不行动；节拍 3：破壳（视为阵亡）；亡语：召唤 [3,4,6]/[3,4,6] 幼兽；培养与本体属性不传给幼兽', '召唤·亡语·节拍',     { traits: { idle: true, pulse: 3 }, onPulse: [fx('die', 'self')], onRattle: [fx('summon', 'self', [3, 4, 6], { v2: [3, 4, 6], token: 't_hatch' })] }),`

证据：不行动与3拍形成真实代价；前排可承伤孵化，放队尾等孵化会拖到第二回合且挤位置。三星12金只换6/6后继，不宜靠多投蛋攻血修孵化

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## m_kujata 驮岩兽（已调整）

SAP：Rabbit: Friendly ate food: Give them +1 health. Works 3 times per turn.；Bison: End turn: If this has a level 3 friend, gain +2 attack and +2 health. Works for 1 Bison.

培养成长转为防御职责，避免攻血分散。

旧：`C('m_kujata', '驮岩兽', 'magma', 3, 2, 8, 'passive', '在场时：其他友军完成培养后，自己永久 +[1,2,3] 攻（每次备战限 2 次）', '前排·培养',     { prep: [{ event: 'train', scope: 'ally', target: 'self', atk: [1, 2, 3], cap: 2 }] }),`

新：`C('m_kujata', '驮岩兽', 'magma', 3, 2, 8, 'passive', '在场时：其他友军完成培养后，自己永久 +[2,3,4] 生命（每对象每次备战限 1 次，共 2 名；开战提交）', '前排·培养',     { prep: [{ event: 'train', scope: 'ally', target: 'self', hp: [2, 3, 4], cap: 2 }] }),`

证据：能真实多轮积累但承伤侧只有8血，无护甲/嘲讽；不投前排血仍可能被同阶即用坦替代。培养包时点改动会改变可达频率，不能用合成3次事件当合法收益

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## m_harvester 噬焰兽（已调整）

SAP：Falcon: Knock out: Summon one 3/3 level 1 copy of it. Works 3 times per battle.；Fly: Friend faints: Summon one 4/4 fly in its place. Works 3 times per turn.；Rooster: Faint: Summon one Chick with 1 health and 50% attack of this.

局部落点与本体更有价值后继，保留普通召唤行动规则。

旧：`C('m_harvester', '噬焰兽', 'magma', 3, 2, 6, 'passive', '任一带灼烧的敌人阵亡时：召唤 [1,2,3]/[1,2,3] 火苗到我方队尾', '召唤·吃灼烧',     { special: 'harvester' }),`

新：`C('m_harvester', '噬焰兽', 'magma', 3, 2, 6, 'passive', '任一带灼烧的敌人阵亡时：召唤 [3,4,5]/[3,4,5] 火苗到自己身后（每场限 3 次）', '召唤·吃灼烧',     { special: 'harvester' }),`

证据：160格新受控证据修正初读重做判断：40个固定条件原卡24胜2平14负，同体去special19胜2平19负；7条件改善且无反向退化。排除终局生成后44只火苗23首动，直接有效伤害51、实际承普攻24/法术4。没有看守也有28只战中火苗、9首动、16直接伤害，故不是必须三卡才有意义。五人条件仅1个结果改善，且满员及首动效率仍弱；同阶熔甲26胜1平13负，当前收益不够稳定，但不能据此要求彻底重做。

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## m_mankator 炎鬃战兽（已调整）

SAP：Dodo: Start of battle: Give 50% of attack to the nearest friend ahead.；Dragon: Tier 1 friend bought: Give friends +1 attack and +1 health. Works 4 times per turn.

去掉必须卖掉现役溅射的反向成本，仍每备战一次。

旧：`C('m_mankator', '炎鬃战兽', 'magma', 6, 5, 12, 'start', '开战时：队尾获得溅射和 [1,2,3] 层格挡；在场时：出售其他带溅射的友军后，队尾永久 +[2,3,4] 攻（每次备战限 1 次）', '辅助·给溅射·给格挡·出售',     { onStart: [fx('grant', 'rear', undefined, { grant: 'splash' }), fx('block', 'rear', [1, 2, 3])], prep: [{ event: 'sell', scope: 'ally', target: 'rear', atk: [2, 3, 4], tag: '溅射' }] }),`

新：`C('m_mankator', '炎鬃战兽', 'magma', 6, 5, 12, 'start', '开战时：队尾获得溅射和 [1,2,3] 层格挡；在场时：出售其他友军后，队尾永久 +[2,3,4] 攻（每次备战限 1 次）', '辅助·给溅射·给格挡·出售',     { onStart: [fx('grant', 'rear', undefined, { grant: 'splash' }), fx('block', 'rear', [1, 2, 3])], prep: [{ event: 'sell', scope: 'ally', target: 'rear', atk: [2, 3, 4] }] }),`

证据：成长可先上场交易再移备战，不必全程占战位；开场收益需留场。若阵容队尾已怒焰/暴怒，主要只剩盾和交易，六阶身份可用性偏窄

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## m_heart 火山之心（已调整）

SAP：Hedgehog: Faint: Deal 2 damage to ALL pets.；Kraken: Start of battle: Remove 15% health from ALL other pets.

删除强迫前排自损；免烧仍是本体特性。

旧：`C('m_heart', '火山之心', 'magma', 5, 5, 12, 'beat', '免疫灼烧；每次交锋结束时：双方队首各获得 [1,2,2] 层灼烧', '前排·给灼烧',     { traits: { burnImmune: true }, onBeatEnd: [fx('burn', 'front', [1, 2, 2]), fx('burn', 'enemyFront', [1, 2, 2])] }),`

新：`C('m_heart', '火山之心', 'magma', 5, 5, 12, 'beat', '免疫灼烧；每次交锋结束时：敌方队首获得 [1,2,2] 层灼烧', '前排·给灼烧',     { traits: { burnImmune: true }, onBeatEnd: [fx('burn', 'enemyFront', [1, 2, 2])] }),`

证据：可独立上前排对甲盾，但无嘲讽；有其他嘲讽坦吸火或轮换换首，会把自免烧变成友军持续伤害。二三星只能2层，不能期待大幅档位提升

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## v_wall 冰墙（共享契约调整）

SAP：Ghost Kitten: Takes 3 less damage from abilities.；Gorilla: Hurt: Gain Coconut perk. Works 1 time per turn.

本体保持；全局嘲讽改紧邻身后护卫，不再后排抢前排；必须复查反伤共存与狙击保护。

旧：`C('v_wall', '冰墙', 'frost', 1, 1, 9, 'passive', '嘲讽；护甲 [1,1,2]', '前排·嘲讽·护甲', { traits: { taunt: true, armor: [1, 1, 2] } }),`

新：`C('v_wall', '冰墙', 'frost', 1, 1, 9, 'passive', '嘲讽；护甲 [1,1,2]', '前排·嘲讽·护甲', { traits: { taunt: true, armor: [1, 1, 2] } }),`

证据：低成本全场保护有实用性但可能挤压受击/反击卡的组队空间：不仅站最前才吸火，后排嘲讽也拦截。问题来自全局目标规则，应整体审查，不能单独扣冰墙无用

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## v_scout 冰原霜狼（已调整）

SAP：Mothman: Anyone gained ailment: Gain +1 attack and +1 health until next turn. Works 5 times per turn.；Kangaroo: Friend ahead attacks: Gain +1 attack and +1 health.

一次真实冻结的攻击兑现提高，保留条件。

旧：`C('v_scout', '冰原霜狼', 'frost', 2, 3, 4, 'passive', '任一敌人被冻结时：自己本场 +[1,2,3] 攻', '输出·吃寒意',     { onEnemyFreeze: [fx('buff', 'self', [1, 2, 3])] }),`

新：`C('v_scout', '冰原霜狼', 'frost', 2, 3, 4, 'passive', '任一敌人被冻结时：自己本场 +[2,3,4] 攻', '输出·吃寒意',     { onEnemyFreeze: [fx('buff', 'self', [2, 3, 4])] }),`

证据：一星只+1且要先攒够寒意，敌高攻时迟兑现；三卡组冰甲虫+寒法+狼可用但给寒意者占位后已缺输出，普通环境未必优于自带控伤输出

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## v_chaser 雪原小妖（已调整）

SAP：Goose: Start of battle: Remove 1 attack from the first enemy.；Mandrake: Start of battle: Make one tier 2 or lower enemy Dazed and prioritize Faint pets.

明确阈值；低阶法强+1入口保留，暂不追加伤害。

旧：`C('v_chaser', '雪原小妖', 'frost', 1, 1, 5, 'cast', '法强 +1；施法：敌方队首获得 [2,3,4] 层寒意', '施法·给寒意·法强',     { traits: { power: t3(1) }, cast: [fx('chill', 'enemyFront', [2, 3, 4])] }),`

新：`C('v_chaser', '雪原小妖', 'frost', 1, 1, 5, 'cast', '法强 +1；施法：敌方队首获得 [2,3,4] 层寒意（施法前寒意达到目标攻击才会冻结）', '施法·给寒意·法强',     { traits: { power: t3(1) }, cast: [fx('chill', 'enemyFront', [2, 3, 4])] }),`

证据：只有寒意无伤害，早期低攻敌可独立冻结，攻击成长敌会把阈值抬高；后续购买加法强能跨阈但需要真实新购/合副本。旧普通威胁2/4到培养4/4是旧固定样本

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## v_conduit 寒潮之灵（已调整）

SAP：Dragon: Tier 1 friend bought: Give friends +1 attack and +1 health. Works 4 times per turn.

排除受击寒意与固定冻结等不吃法强对象。

旧：`C('v_conduit', '寒潮之灵', 'frost', 4, 2, 8, 'passive', '在场时：购买其他带寒意的友军后，该友军永久 +[1,1,2] 法强（每次备战限 2 次）', '辅助·给法强·购买·寒意',     { prep: [{ event: 'buy', scope: 'ally', target: 'event', power: [1, 1, 2], cap: 2, tag: '给寒意' }] }),`

新：`C('v_conduit', '寒潮之灵', 'frost', 4, 2, 8, 'passive', '在场时：购买其他寒意法术受益友军后，该友军永久 +[1,1,2] 法强（每次备战限 2 次）', '辅助·给法强·购买·寒意',     { prep: [{ event: 'buy', scope: 'ally', target: 'event', power: [1, 1, 2], cap: 2, tag: '寒意法术受益' }] }),`

证据：交易有真实价值，但寒意标签不等于受益，多张被动寒意单位能吃永久法强却无增益是实用性陷阱，直接受益者主要雪妖/寒法/白鹿；二星仍1，升星收益小

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## v_drake 霜脊地龙（已调整）

SAP：Crocodile: Start of battle: Deal 8 damage to the last enemy.；Vampire Bat: Enemy gained ailment: Deal 4 damage to it and gain damage as health. Works 2 times per battle.

改善一星存活入口，不叠加法强假收益。

旧：`C('v_drake', '霜脊地龙', 'frost', 5, 2, 7, 'passive', '敌人被冻结时：敌方队尾受 [4,6,8] 伤害（每回合最多 2 次）', '输出·吃寒意',     { onEnemyFreeze: [fx('dmg', 'enemyRear', [4, 6, 8], { cap: t3(2) })] }),`

新：`C('v_drake', '霜脊地龙', 'frost', 5, 3, 9, 'passive', '敌人被冻结时：敌方队尾受 [4,6,8] 伤害（每回合最多 2 次）', '输出·吃寒意',     { onEnemyFreeze: [fx('dmg', 'enemyRear', [4, 6, 8], { cap: t3(2) })] }),`

证据：两次触发一星8原始伤可能有用，但高阶敌攻击阈值与后排护甲/格挡会压回报；为它再凑第三第四冰卡不应视为默认合理

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## v_queen 霜冠执政官（已调整）

SAP：Manticore: Enemy ailments are two times worse.；Vampire Bat: Enemy gained ailment: Deal 4 damage to it and gain damage as health. Works 2 times per battle.

给六阶开场跨阈机会，不提高扩散频率。

旧：`C('v_queen', '霜冠执政官', 'frost', 6, 4, 12, 'start', '开战时：敌方队首获得 2 层寒意；任一敌人被冻结时：其余敌人获得 [1,2,2] 层寒意', '辅助·给寒意',     { onStart: [fx('chill', 'enemyFront', t3(2))], special: 'queen' }),`

新：`C('v_queen', '霜冠执政官', 'frost', 6, 4, 12, 'start', '开战时：敌方队首获得 [4,5,6] 层寒意；任一敌人被冻结时：其余敌人获得 [1,2,2] 层寒意', '辅助·给寒意',     { values: [1, 2, 2], onStart: [fx('chill', 'enemyFront', [4, 5, 6])], special: 'queen' }),`

证据：一次冻结只给其他人少量层数，要等更多出手；易产生看似全屏特效却未跨高攻阈值的空扩散。一星终局开场2层固定，三星扩散仅2

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## d_howler 沙嚎者（已调整）

SAP：Sheep: Faint: Summon two 2/2 Rams.；Deer: Faint: Summon one 5/3 Bus with Chili.；Rooster: Faint: Summon one Chick with 1 health and 50% attack of this.

借SAP Sheep/Deer死亡腾位后继，去蓄力落地前死亡窗口。

旧：`C('d_howler', '沙嚎者', 'desert', 2, 1, 7, 'charge', '蓄力 2；蓄力技：召唤一个带狙击的 [3,4,5]/[2,3,4] 沙狼', '召唤·蓄力·狙击',     { traits: { charge: 2 }, chargeSkill: [fx('summon', 'self', [3, 4, 5], { v2: [2, 3, 4], token: 't_wolf' })] }),`

新：`C('d_howler', '沙嚎者', 'desert', 2, 1, 7, 'rattle', '亡语：召唤两个带狙击的 [3,4,5]/[2,3,4] 沙狼', '召唤·亡语·狙击',     { onRattle: [fx('summon', 'self', [3, 4, 5], { v2: [2, 3, 4], token: 't_wolf', count: 2 })] }),`

证据：旧样本狼首动前死已证实瓶颈；0.10守卫576格里仅24格多一只首动，不能声称已普遍解决，且同成本中立替代胜格更高；守卫保护限2/3/4并需存活

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## d_goldob 金焰方尖碑（已调整）

SAP：Giraffe: Start of turn: Give the nearest friend ahead +1 attack and +1 health.；Monkey: End turn: Give front-most friendly pet +2 attack and +2 health.

可培养两侧召唤核心，不强制队尾。

旧：`C('d_goldob', '金焰方尖碑', 'desert', 2, 0, 6, 'passive', '不行动；在场且备战结束时：队尾带召唤的友军永久 +[1,2,3] 攻和 +[2,3,4] 生命', '辅助·召唤·培养',     { traits: { idle: true }, prep: [{ event: 'endPrep', scope: 'self', target: 'rear', atk: [1, 2, 3], hp: [2, 3, 4], targetTag: '召唤' }] }),`

新：`C('d_goldob', '金焰方尖碑', 'desert', 2, 0, 6, 'passive', '不行动；在场且备战结束时：相邻带召唤的友军永久 +[1,2,3] 攻和 +[2,3,4] 生命', '辅助·召唤·培养',     { traits: { idle: true }, prep: [{ event: 'endPrep', scope: 'self', target: 'adjacent', atk: [1, 2, 3], hp: [2, 3, 4], targetTag: '召唤' }] }),`

证据：多轮保留有收益，但在五位用一整席换本体每战+1/+2，前期0攻板使压力更大；换可行动前排和直接培养可能更稳，队尾选择还限制阵型

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## d_keeper 遗迹守卫（已调整）

SAP：Sea Turtle: Friend summoned: Give it +2 health until next turn.；Turkey: Friend summoned: Give it +3 attack and +1 health.

盾配生命延长首动窗口，两个effect独立同cap避免共享组吞第二项。

旧：`C('d_keeper', '遗迹守卫', 'desert', 3, 3, 6, 'passive', '嘲讽；友军召唤新单位时：新单位获得 1 层格挡（每场最多 [2,3,4] 次）', '前排·嘲讽·吃召唤·给格挡',     { traits: { taunt: true }, onAllySummon: [fx('block', 'opponent', t3(1), { capBattle: [2, 3, 4] })] }),`

新：`C('d_keeper', '遗迹守卫', 'desert', 3, 3, 6, 'passive', '嘲讽；友军召唤新单位时：新单位获得 1 层格挡和 +[2,3,4] 生命（每场最多 [3,4,5] 次）', '前排·嘲讽·吃召唤·给格挡',     { traits: { taunt: true }, onAllySummon: [fx('block', 'opponent', t3(1), { capBattle: [3, 4, 5] }), fx('buff', 'opponent', t3(0), { v2: [2, 3, 4], capBattle: [3, 4, 5] })] }),`

证据：0.10实测792狼入场，守卫首动324、去保护300，改善24/576格且只2配置；局部实效成立，最终全局守卫312胜对中立384胜。全局嘲讽还吸走本来可让后继分摊的普攻，沙狼多数护盾未兑现

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## d_obelisk 流沙方尖碑（已调整）

SAP：Fish: Level-up: Give two friends +1 attack and +1 health.；Turtle: Faint: Give Melon perk to the nearest friend behind.

常驻空行动位先提供开场一次防护，保留节拍。

旧：`C('d_obelisk', '流沙方尖碑', 'desert', 3, 1, 9, 'pulse', '不行动；节拍 3：队首获得 [1,2,3] 层格挡；自己升星时：队首永久 +[3,5,7] 生命（每次备战限 1 次）', '辅助·节拍·给格挡·升星',     { traits: { idle: true, pulse: 3 }, onPulse: [fx('block', 'front', [1, 2, 3])], prep: [{ event: 'upgrade', scope: 'self', target: 'front', hp: [3, 5, 7] }] }),`

新：`C('d_obelisk', '流沙方尖碑', 'desert', 3, 1, 9, 'pulse', '不行动；开战时：队首获得 1 层格挡；节拍 3：队首获得 [1,2,3] 层格挡；自己升星时：队首永久 +[3,5,7] 生命（每次备战限 1 次）', '辅助·节拍·给格挡·升星',     { onStart: [fx('block', 'front', t3(1))], traits: { idle: true, pulse: 3 }, onPulse: [fx('block', 'front', [1, 2, 3])], prep: [{ event: 'upgrade', scope: 'self', target: 'front', hp: [3, 5, 7] }] }),`

证据：一星长战每3拍1盾可能低于一席，且升星事件只真实发生两次；不能按一星3血每轮或合成重复升级估收益

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## d_shriek 风啸隼（已调整）

SAP：Dolphin: Start of battle: Deal 4 damage to the lowest health enemy.；Crocodile: Start of battle: Deal 8 damage to the last enemy.

提高蓄力前生存，保留后排单体职责。

旧：`C('d_shriek', '风啸隼', 'desert', 3, 2, 4, 'charge', '蓄力 2；蓄力技：敌方队尾受 [4,6,8] 伤害', '输出·蓄力',     { traits: { charge: 2 }, chargeSkill: [fx('dmg', 'enemyRear', [4, 6, 8])] }),`

新：`C('d_shriek', '风啸隼', 'desert', 3, 2, 6, 'charge', '蓄力 2；蓄力技：敌方队尾受 [4,6,8] 伤害', '输出·蓄力',     { traits: { charge: 2 }, chargeSkill: [fx('dmg', 'enemyRear', [4, 6, 8])] }),`

证据：一星4伤对中期后排常不足击杀，4血需保护投入才能第二手；法强确能加伤，不应与召唤/强化普攻混同为无收益

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## d_pyro 沙焰术士（保留待验证）

SAP：Dragon: Tier 1 friend bought: Give friends +1 attack and +1 health. Works 4 times per turn.；Blue Ringed Octopus: Buy: Give friends +1 attack and +1 health.

保留当前供盾/亡语倍增/采购成长职责；现有证据不足以定量改数值，交由同预算与合法入手轨迹验证。

旧：`C('d_pyro', '沙焰术士', 'desert', 5, 1, 7, 'passive', '在场时：购买其他法术受益友军后，该友军永久 +[1,2,3] 法强（每次备战限 2 次）', '辅助·给法强·购买',     { prep: [{ event: 'buy', scope: 'ally', target: 'event', power: [1, 2, 3], cap: 2, tag: '法术受益' }] }),`

新：`C('d_pyro', '沙焰术士', 'desert', 5, 1, 7, 'passive', '在场时：购买其他法术受益友军后，该友军永久 +[1,2,3] 法强（每次备战限 2 次）', '辅助·给法强·购买',     { prep: [{ event: 'buy', scope: 'ally', target: 'event', power: [1, 2, 3], cap: 2, tag: '法术受益' }] }),`

证据：真实交易已验证雪妖/萨满各+1、沙嚎无收益，移备战保留；这证明可用育成工具而非1/7战斗废卡，但不证明晚期可购收益足够，上一轮合成buy限次不能代替经济窗口

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## d_hourglass 沙漏构装（已调整）

SAP：Door Head Ant: Empty front space: Jump to the front and gain +4 health in battle.；Emu: Empty front space: Give nearest friend ahead +4 health and move it to the front in battle.；Ox: Friend ahead faints: Gain Melon perk and +1 attack. Works 1 time per turn.

首接仍给盾，受伤接棒提高回复；不加频率。

旧：`C('d_hourglass', '沙漏构装', 'desert', 4, 2, 7, 'passive', '友军成为队首时：其恢复 [2,3,4] 生命并获得 1 层格挡（每回合限 1 次）', '辅助·轮换·给格挡',     { onAllyFront: [fx('heal', 'opponent', [2, 3, 4], { responseGroup: 'frontCare' }), fx('block', 'opponent', t3(1), { responseGroup: 'frontCare' })] }),`

新：`C('d_hourglass', '沙漏构装', 'desert', 4, 2, 7, 'passive', '友军成为队首时：其恢复 [3,4,5] 生命并获得 1 层格挡（每回合限 1 次）', '辅助·轮换·给格挡',     { onAllyFront: [fx('heal', 'opponent', [3, 4, 5], { responseGroup: 'frontCare' }), fx('block', 'opponent', t3(1), { responseGroup: 'frontCare' })] }),`

证据：0.10同身材去响应均72/96胜，实有108治疗但本组胜负未变，同价中立84/96胜；局部效果真实，不能称普遍有用或绝对无效。每回合第一队首接力耗完即不补后续

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## d_onyx 黑曜豹神（已调整）

SAP：Boar: Before attack: Gain +4 attack and +2 health.；Hippo: Knock out: Gain +3 attack and +3 health. Works 3 times per battle.

六阶成长首次提前一次行动兑现，仍须完成行动。

旧：`C('d_onyx', '黑曜豹神', 'desert', 6, 5, 10, 'charge', '蓄力 3；蓄力技：自己本场 +[3,4,5]/+[3,4,5]，并追击一次', '输出·蓄力·追击',     { traits: { charge: 3 }, chargeSkill: [fx('buff', 'self', [3, 4, 5], { v2: [3, 4, 5] }), fx('extraAct', 'self')] }),`

新：`C('d_onyx', '黑曜豹神', 'desert', 6, 5, 10, 'charge', '蓄力 2；蓄力技：自己本场 +[3,4,5]/+[3,4,5]，并追击一次', '输出·蓄力·追击',     { traits: { charge: 2 }, chargeSkill: [fx('buff', 'self', [3, 4, 5], { v2: [3, 4, 5] }), fx('extraAct', 'self')] }),`

证据：三级蓄力意味着通常要活过两轮敌行动，10血若靠额外保护才能起动，2–3卡预算已吃掉坦和辅；不能用多轮叠成巨兽证明入口足够

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## n_medic 战地医师（已调整）

SAP：Otter: Buy: Give one random friend +1 health.；Flamingo: Faint: Give the two nearest friends behind +1 attack and +1 health.

亡语找真正伤员，避免新前排满血空奶。

旧：`C('n_medic', '战地医师', 'neutral', 2, 1, 5, 'rattle', '购买时：队首永久 +[1,2,3] 生命；亡语：队首恢复 [3,5,7] 生命', '辅助·购买·亡语',     { prep: [{ event: 'buy', scope: 'self', target: 'front', hp: [1, 2, 3] }], onRattle: [fx('heal', 'front', [3, 5, 7])] }),`

新：`C('n_medic', '战地医师', 'neutral', 2, 1, 5, 'rattle', '购买时：队首永久 +[1,2,3] 生命；亡语：生命最低的受伤友军恢复 [3,5,7] 生命', '辅助·购买·亡语',     { prep: [{ event: 'buy', scope: 'self', target: 'front', hp: [1, 2, 3] }], onRattle: [fx('heal', 'lowest', [3, 5, 7])] }),`

证据：亡语疗量小且时机容易浪费，购买后立刻卖比占位有吸引力。成长投入：不宜投入攻血延迟死亡；法强不应作为常规施法投资。

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## n_archer 游侠弓手（已调整）

SAP：Crocodile: Start of battle: Deal 8 damage to the last enemy.；Beaver: Sell: Give two random friends +1 attack.

让持续狙击有早期击杀入口，交易收益不抬。

旧：`C('n_archer', '游侠弓手', 'neutral', 2, 2, 4, 'passive', '狙击；出售时：队尾永久 +[1,2,3] 攻和 +[1,2,3] 生命', '输出·狙击·出售',     { traits: { snipe: true }, prep: [{ event: 'sell', scope: 'self', target: 'rear', atk: [1, 2, 3], hp: [1, 2, 3] }] }),`

新：`C('n_archer', '游侠弓手', 'neutral', 2, 3, 4, 'passive', '狙击；出售时：队尾永久 +[1,2,3] 攻和 +[1,2,3] 生命', '输出·狙击·出售',     { traits: { snipe: true }, prep: [{ event: 'sell', scope: 'self', target: 'rear', atk: [1, 2, 3], hp: [1, 2, 3] }] }),`

证据：作为交易卡可用，作为二阶后排杀手不足以解释长期五位。成长投入：攻血能提高切尾存活但与其他核心争培养；三星应有留场理由。

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## n_gladiator 角斗士（已调整）

SAP：Rabbit: Friendly ate food: Give them +1 health. Works 3 times per turn.；Seal: Eats food: Give three random friends +1 attack.；Peacock: Hurt: Gain +3 attack.

不加数值，明确真正培养结算。

旧：`C('n_gladiator', '角斗士', 'neutral', 1, 3, 4, 'duel', '决斗；自己完成培养时：永久 +[1,2,3] 攻和 +[1,2,3] 生命', '输出·决斗·培养',     { traits: { duel: true }, prep: [{ event: 'train', scope: 'self', target: 'self', atk: [1, 2, 3], hp: [1, 2, 3] }] }),`

新：`C('n_gladiator', '角斗士', 'neutral', 1, 3, 4, 'duel', '决斗；自己完成培养时：永久 +[1,2,3] 攻和 +[1,2,3] 生命（每次备战限 1 次；开战提交，能力成长不算培养）', '输出·决斗·培养',     { traits: { duel: true }, prep: [{ event: 'train', scope: 'self', target: 'self', atk: [1, 2, 3], hp: [1, 2, 3] }] }),`

证据：卡面没写限次，易误以为逐点或出售成长也触发；实测规则本身有价值。成长投入：每轮首次净培养额外+1/+1，随后加点无额外；卖小鬼+攻不是train。

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## n_obelisk 方尖碑（已调整）

SAP：Dragon: Tier 1 friend bought: Give friends +1 attack and +1 health. Works 4 times per turn.；Catfish: Start of turn: Activate Buy ability on the nearest friend ahead once, or give it +4 health.

事件和受益目标都使用真实法术轴。

旧：`C('n_obelisk', '方尖碑', 'neutral', 3, 1, 7, 'passive', '在场时：出售其他带施法的友军后，攻击最低的友军永久 +[1,2,3] 法强（每次备战限 2 次）', '辅助·给法强·出售',     { prep: [{ event: 'sell', scope: 'ally', target: 'lowestAtk', power: [1, 2, 3], cap: 2, tag: '施法' }] }),`

新：`C('n_obelisk', '方尖碑', 'neutral', 3, 1, 7, 'passive', '在场时：出售其他法术受益友军后，攻击最低的法术受益友军永久 +[1,2,3] 法强（每次备战限 2 次）', '辅助·给法强·出售',     { prep: [{ event: 'sell', scope: 'ally', target: 'lowestAtk', power: [1, 2, 3], cap: 2, tag: '法术受益', targetTag: '法术受益' }] }),`

证据：可能把稀缺法强给不受益友军，交易成本与战位机会成本双高。成长投入：优先不培养本体；升星放大收益但还要卖卡和有效目标。

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## n_envoy 传令使（已调整）

SAP：Parrot: End turn: Copy ability from the nearest pet ahead as level 1 until next turn.；Tiger: The friend ahead repeats their ability in battle as if they were level 1.；Catfish: Start of turn: Activate Buy ability on the nearest friend ahead once, or give it +4 health.

站位决定目标，立刻兑现完整行动，保留有界复制。

旧：`C('n_envoy', '传令使', 'neutral', 4, 1, 5, 'cast', '施法：攻击最高的其他友军本回合行动次数 +1（每回合限 1 次）', '施法·辅助·给行动次数',     { cast: [fx('addAction', 'highestAtk', t3(1), { oncePerRound: true })] }),`

新：`C('n_envoy', '传令使', 'neutral', 4, 2, 7, 'cast', '施法：身后最近的友军立即完整行动一次（每回合限 1 次；每目标每回合最多接受一次，不递归）', '施法·辅助·给行动次数',     { cast: [fx('bonusAct', 'behind', t3(1), { oncePerRound: true })] }),`

证据：240战固定配对证实完整行动有25次新增施法/10次蓄力，但148预算仅95次实际行动，41次冻损、11次先死、1次结束；低攻法师目标错配。不能以机制独特直接保留

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## n_ritualist 祭仪师（已调整）

SAP：Whale: Start of battle: Swallow the nearest friend ahead and release it at level 1 on faint.；Flamingo: Faint: Give the two nearest friends behind +1 attack and +1 health.；Ant: Faint: Give one random friend +1 attack and +1 health.

后位祭司须有合格前位祭品，不自动毁普通核心。

旧：`C('n_ritualist', '祭仪师', 'neutral', 4, 1, 6, 'cast', '施法：献祭身前最近的友军，使攻击最高的其他友军本场 +[1,2,3] 攻；无祭品或获益友军时改为普攻', '施法·辅助·献祭·亡语',     { cast: [fx('sacrifice', 'ahead', [1, 2, 3])] }),`

新：`C('n_ritualist', '祭仪师', 'neutral', 4, 1, 6, 'cast', '施法：仅献祭身前最近且带亡语、未用复生或召唤物的友军，使攻击最高的其他友军本场 +[1,2,3] 攻；无祭品或获益友军时改为普攻', '施法·辅助·献祭·亡语',     { cast: [fx('sacrifice', 'ahead', [1, 2, 3], { requireFodder: true })] }),`

证据：有亡语引擎才合理，普通混编可能主动拆队；缺少持续无效献祭防护。成长投入：投资本体不能改善牺牲汇率；法强不应当通用增益，升星也不修复消耗队友。

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## n_echo 回响祭司（已调整）

SAP：Fish: Level-up: Give two friends +1 attack and +1 health.；Penguin: Start of turn: Give two level 2 or higher friends +1 attack and +1 health.；Team Spirit: Friend level-up: Give friends +1 attack and +1 health.

开场相邻攻血[2,3,4]提供首战即战价值，保留升星成长。

旧：`C('n_echo', '回响祭司', 'neutral', 5, 1, 7, 'passive', '在场时：其他友军升星后，相邻友军永久 +[1,2,3] 攻（每次备战限 2 次）', '辅助·升星',     { prep: [{ event: 'upgrade', scope: 'ally', target: 'adjacent', atk: [1, 2, 3], cap: 2 }] }),`

新：`C('n_echo', '回响祭司', 'neutral', 5, 1, 7, 'passive', '开战时：相邻友军本场 +[2,3,4]/+[2,3,4]；在场时：其他友军升星后，相邻友军永久 +[1,2,3] 攻（每次备战限 2 次）', '辅助·升星',     { onStart: [fx('buff', 'adjacent', [2, 3, 4], { v2: [2, 3, 4] })], prep: [{ event: 'upgrade', scope: 'ally', target: 'adjacent', atk: [1, 2, 3], cap: 2 }] }),`

证据：一星一次升星仅给相邻各1攻，边位只1邻；每备战2次是上限不是保证。晚入手纯育成需真实剩余合法升星次数回本，不按三星上限判价值

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## n_marshal 战阵指挥官（已调整）

SAP：Dodo: Start of battle: Give 50% of attack to the nearest friend ahead.；Leopard: Start of battle: Deal 50% attack damage to one random enemy.；Monkey: End turn: Give front-most friendly pet +2 attack and +2 health.

增强晚买本体存活，首回合行动数量保持。

旧：`C('n_marshal', '战阵指挥官', 'neutral', 5, 2, 6, 'start', '开战时：队首本场 +[2,3,4]/+[2,3,4]，首回合行动次数 +1', '辅助·给行动次数',     { onStart: [fx('buff', 'front', [2, 3, 4], { v2: [2, 3, 4] }), fx('addAction', 'front', t3(1))] }),`

新：`C('n_marshal', '战阵指挥官', 'neutral', 5, 3, 8, 'start', '开战时：队首本场 +[2,3,4]/+[2,3,4]，首回合行动次数 +1', '辅助·给行动次数',     { onStart: [fx('buff', 'front', [2, 3, 4], { v2: [2, 3, 4] }), fx('addAction', 'front', t3(1))] }),`

证据：一星有即时收益无需等待未来备战，是优点；但单次2/2+行动不能仅因开战确定发放就证明五阶值得。目标要承受前排压力、冻损，且后续回合不再发；没有直接对照证据支撑原保留判断

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。

## n_paragon 落日灵驹（已调整）

SAP：Team Spirit: Friend level-up: Give friends +1 attack and +1 health.；Dragon: Tier 1 friend bought: Give friends +1 attack and +1 health. Works 4 times per turn.；Monkey: End turn: Give front-most friendly pet +2 attack and +2 health.

晚买无需等待未来升星，可在本次开战提交兑现。

旧：`C('n_paragon', '落日灵驹', 'neutral', 6, 4, 10, 'passive', '在场时：其他友军升星后，队首永久 +[2,3,4] 攻，队尾永久 +[3,4,5] 生命（每次备战限 2 次）', '辅助·升星',     { prep: [{ event: 'upgrade', scope: 'ally', target: 'front', atk: [2, 3, 4], cap: 2 }, { event: 'upgrade', scope: 'ally', target: 'rear', hp: [3, 4, 5], cap: 2 }] }),`

新：`C('n_paragon', '落日灵驹', 'neutral', 6, 4, 10, 'passive', '在场且备战结束时：队首永久 +[3,4,5] 攻，队尾永久 +[4,6,8] 生命（每次备战限 1 次）', '辅助·培养',     { prep: [{ event: 'endPrep', scope: 'self', target: 'front', atk: [3, 4, 5] }, { event: 'endPrep', scope: 'self', target: 'rear', hp: [4, 6, 8] }] }),`

证据：一星每次合法升星给首2攻尾3血；每备战2次不是保证，最多8轮×2仅理论上界且忽略卡源金币。出场已近末章，不能以三星4攻5血/满触发判断六阶实用

待集成：实际事件触发、首次一星同预算替换、合法获取后剩余战斗收益；未宣称平衡通过。