# 全流派开发组

Development only, normal route, 4 legal seeds per general x 4 generals. Focused new builds ban master/dancer/choreo; mixed supplement permits useful dancer/choreo but bans master. Heuristic policies, not optimal player study. A/B/C corrections are deliberate strategy fixes on the same seeds, not independent holdout. Triple boss draw stops are truncations, not player defeats.

|策略|通关|失败|截断|前三战全胜|机制真实兑现局|疲劳场/总场|
|---|---:|---:|---:|---:|---:|---:|
|normal (development-a-normal)|15/16|0|1|16/16|12/16|0/324|
|summon (development-a-summon)|16/16|0|0|16/16|15/16|1/336|
|frost (development-a-frost)|14/16|1|1|16/16|15/16|34/327|
|casual (development-a-casual)|5/16|10|1|16/16|0/16|22/324|
|splash (development-b-splash)|11/16|3|2|16/16|16/16|15/346|
|burn (development-a-burn)|16/16|0|0|16/16|16/16|2/336|
|rotation (development-a-rotation)|16/16|0|0|16/16|16/16|5/337|
|duel (development-a-duel)|11/16|3|2|16/16|16/16|35/336|
|spell (development-b-spell)|13/16|3|0|16/16|16/16|10/342|
|retaliation (development-c-retaliation)|7/16|8|1|16/16|16/16|56/348|
|shield (development-b-shield)|16/16|0|0|16/16|16/16|25/336|
|sacrifice (development-c-sacrifice)|2/16|14|0|16/16|14/16|25/350|

自动检查：所有完整批次均0 fault、失败API、预算错误和运行期间源码变化。共享核心只有一个engine SHA。旧a/b/c与mixed证据全部保留，未覆盖。

机制贡献按玩家来源对敌方目标有效伤害计算；烧伤无来源，按敌方目标归属；治疗以恢复缺口封顶。轮换/决斗/施法是实际事件，不能把相关单位输出声称为机制反事实增益。

## 校正与补组

- development-a-retaliation: 9/16通关，5失败，2截断，前三战16/16。
- development-a-shield: 3/16通关，10失败，3截断，前三战16/16。
- development-a-spell: 6/16通关，9失败，1截断，前三战16/16。
- development-a-splash: 10/16通关，6失败，0截断，前三战16/16。
- development-b-retaliation: 4/16通关，9失败，3截断，前三战16/16。
- development-b-sacrifice: 1/16通关，14失败，1截断，前三战16/16。
- development-mixed-a-duel: 10/16通关，5失败，1截断，前三战16/16。
- development-mixed-a-spell: 16/16通关，0失败，0截断，前三战16/16。
- development-mixed-a-splash: 13/16通关，3失败，0截断，前三战16/16。

## 主要证据

- normal: 有效伤害{'attack': 22736, 'ability': 5835, 'burn': 1193, 'splash': 193, 'thorns': 323}，治疗71，轮换200，玩家决斗胜利152，献祭2。失败节点{}；截断{'1:9:虚空领主': 1}。
- summon: 有效伤害{'attack': 30849, 'splash': 22, 'ability': 170, 'burn': 148, 'thorns': 781}，治疗13，轮换99，玩家决斗胜利13，献祭0。失败节点{}；截断{}。
- frost: 有效伤害{'attack': 26689, 'ability': 3117, 'thorns': 80, 'burn': 65, 'splash': 104}，治疗75，轮换76，玩家决斗胜利379，献祭0。失败节点{'3:5:混合军团': 1}；截断{'1:9:虚空领主': 1}。
- casual: 有效伤害{'attack': 25146, 'splash': 707, 'thorns': 450, 'burn': 3426, 'ability': 1114}，治疗384，轮换189，玩家决斗胜利352，献祭6。失败节点{'3:9:永夜君王': 7, '3:5:混合军团': 1, '1:9:虚空领主': 2}；截断{'3:9:永夜君王': 1}。
- splash: 有效伤害{'attack': 20398, 'splash': 8723, 'burn': 5154, 'thorns': 798}，治疗2121，轮换37，玩家决斗胜利74，献祭0。失败节点{'3:9:永夜君王': 3}；截断{'3:9:永夜君王': 2}。
- burn: 有效伤害{'attack': 15213, 'burn': 16290, 'splash': 717, 'thorns': 20}，治疗1706，轮换22，玩家决斗胜利139，献祭0。失败节点{}；截断{}。
- rotation: 有效伤害{'attack': 31371, 'ability': 187, 'thorns': 127, 'burn': 594, 'splash': 7}，治疗108，轮换3152，玩家决斗胜利50，献祭0。失败节点{}；截断{}。
- duel: 有效伤害{'attack': 32164, 'burn': 470, 'splash': 26, 'thorns': 429}，治疗4533，轮换63，玩家决斗胜利1352，献祭0。失败节点{'3:9:永夜君王': 3}；截断{'3:9:永夜君王': 1, '1:9:虚空领主': 1}。
- spell: 有效伤害{'attack': 14279, 'ability': 18227, 'thorns': 199, 'burn': 193, 'splash': 37}，治疗2768，轮换59，玩家决斗胜利145，献祭0。失败节点{'3:9:永夜君王': 3}；截断{}。
- retaliation: 有效伤害{'attack': 28601, 'thorns': 3561, 'splash': 1644, 'burn': 967}，治疗6372，轮换45，玩家决斗胜利288，献祭0。失败节点{'3:9:永夜君王': 8}；截断{'2:9:霜魇女皇': 1}。
- shield: 有效伤害{'attack': 31185, 'burn': 436, 'splash': 8, 'thorns': 8, 'ability': 12}，治疗15，轮换42，玩家决斗胜利44，献祭0。失败节点{}；截断{}。
- sacrifice: 有效伤害{'attack': 32941, 'burn': 522, 'ability': 994, 'thorns': 1002, 'splash': 3}，治疗19，轮换42，玩家决斗胜利47，献祭314。失败节点{'3:9:永夜君王': 13, '1:9:虚空领主': 1}；截断{}。

终端首次上场星级、首次触发、宗主自身duelKill/开战授予、逐单位供盾/消盾/buff/伤害与第三章失败分布见 DEVELOPMENT-summary.json。原始逐场阵形与训练、终端sourceEvents、玩家事件和失败trace在各label/battles.jsonl；合法交易与奖励选择在actions.jsonl。

该组尚不是独立holdout，不用于宣称所有构筑均衡。尤其反击与献祭，实际机制已出现而通关仍弱，需主责评估机制/成长与策略剩余限制。
