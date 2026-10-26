# 最终 Boss 受伤流机制验证

结果：15/15 通过。

- PASS `lv2.first-wave-targets`：期望 3；实际 [3,4,5]
- PASS `lv2.worm-feeds-front`：期望 "巨虫触发1次且反哺队首"；实际 {"wormTriggers":1,"frontBuffed":true}
- PASS `lv2.warden-archon-double`：期望 "2次×6"；实际 [6,6]
- PASS `lv2.storm-observed-hurts`：期望 3；实际 3
- PASS `lv2.storm-actual-growth`：期望 26；实际 [26,26]
- PASS `lv3.first-wave-targets`：期望 4；实际 [3,4,5,6]
- PASS `lv3.worm-feeds-front`：期望 "巨虫触发1次且反哺队首"；实际 {"wormTriggers":1,"frontBuffed":true}
- PASS `lv3.warden-archon-double`：期望 "2次×9"；实际 [9,9]
- PASS `lv3.storm-observed-hurts`：期望 3；实际 3
- PASS `lv3.storm-actual-growth`：期望 34；实际 [34,34]
- PASS `worm.three-use-cap`：期望 3；实际 3
- PASS `battle-stat-cap-50`：期望 "所有事件<=50且风暴50/50"；实际 {"over":[],"storm":[50,50]}
- PASS `blocked-hurt-does-not-broadcast`：期望 {"blocked":1,"broadcasts":0}；实际 {"blocked":1,"broadcasts":0}
- PASS `baseline-non-final-unchanged`：期望 "all true"；实际 {"otherBosses":true,"playerCards":true,"foods":true,"relics":true}
- PASS `final-definition`：期望 "冻结顺序，保留默认星级"；实际 {"key":"final","name":"伤痕王座","desc":"风刃引伤，巨虫强化全队，双重反击与风暴收尾","units":["l_windblade","d_worm","l_warden","l_archon","l_storm"]}

## 口径

仅做事件级行为验证，并保存 T15/T18/T21 在相同 mul=1.1 下的 bossTeam 初始属性。未调用 makeEnemy/lift，不能解释为完整通关率或实际自适应后的强度。
