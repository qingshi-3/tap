# 最终独立只读审查（2026-10-22）

范围：当前source/src/core/{engine,run,save,data,route,content}.ts、src/ui/{game,board,tip}.ts及balance-revision.test.ts。对照冻结9c0d506的data/route差异。未修改源码、未运行全量测试或模拟；本文件仅记录静态审查证据。

## 需要处理

1. 击败对手缺少决斗资格判断（机制/文本错配）。data.ts:24现在明文限定“带决斗的单位”；engine.ts:582在任意普通攻击击杀其锁定目标时登记duelVictims，:707直接调用duelKill，未判断hasTrait(killer,'duel')。因此无决斗的佣兵或弓手正常击杀，也会增加duelKills并触发熊猫武尊全队增攻和g_arena治疗。建议在登记或结算处检查决斗特性，并用“无决斗单位+熊猫武尊击杀”补反例；保留有决斗的嘲讽拦截、追击及复生/同时死现有语义。

2. 长冬文字存在可操作歧义。content.ts:179写“先机延长到第3回合，但只推迟敌方的最后两个单位”，易理解为三回合均仅推迟末两人；engine.ts:1296-1299及对应测试却是前两回合全体、第三回合仅末两人。建议改为“前2回合先机不变；第3回合额外推迟敌方最后两个单位”。这是说明修正，不建议为匹配文字削弱实现。

## 复核通过的静态路径

- 余韵：engine.ts:1151-1153已改为先判断本次施法，再按剩余技能可用性复制；次数耗尽/无治疗目标不会跌入强制追击。真实普攻仍可压轴追击。balance-revision.test.ts已有对应反例。
- 法伊：faieActive(:1136)与roundStart(:1293)前2/延长3窗口一致；后发独占分支仅首回合加3临时攻击并推迟我方，faieActive在持有后发时始终false，凝滞/冰封不会误生效。未发现窗口逻辑缺陷。
- 护甲：engine.prepare(:232)对显式0及负值归零并扣掉固有护甲偏移；实时armor仍允许后续光环/减甲参与。board.keywordsOf读取总armor并保留0；tip.unitAbilityText(:38-47)仅移除独立基础护甲句，保留条件能力，0也不会退回静态护甲。
- 补蛋入口：game.ts:1388显示待领数；招募doPlace(:1200)、移动doMove(:1222)、出售(:884及1811)、晋升(:1858)均调用真实run函数，正常入口随后save/render。run的兑现发生在操作完成后，覆盖招募内部售卖不抢目标位。读取旧档不回溯奖励；加载pending结算和兑现后会saveRun持久化。
- route当前对照冻结版本仅首战石魔加显式armor:1，无全局血量系数或Boss改动。data的数值/能力变化未更换内容ID、单位总量或存档结构；a_cult亡语、chanter/drake法强及howler血量说明与声明一致。

边界：以上为静态审查，手机渲染、出售/拖动后待领提示的实际消失及重进必须以主责浏览器验收为准。存档自动行为证据见同目录vitest.txt，不将静态路径当成真实输入通过。

## 17:03 已授权修复与复核

问题1已修复：engine.ts的duelKill入口先检查hasTrait(k, 'duel')，不符合直接返回；原有普通击杀事实与kills保留，决斗广播、熊猫、竞技场与duelKills仅向有资格者发出。新增duel-kill-eligibility.test.ts的普通/狙击阴性、嘲讽决斗阳性及后天授予决斗阳性均通过；与balance-revision共2文件46项通过，见duel-eligibility-vitest.txt。未运行全量测试/构建。已通知模拟执行者下一候选纳入该修复，进行中的候选1保持冻结。
