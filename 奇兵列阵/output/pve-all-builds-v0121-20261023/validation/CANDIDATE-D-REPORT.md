# 四项机制候选开发验证

development-d product candidate; all 12 use one frozen final strategy, normal route, mixed off, 16 per build. Previous a/b are phase references; only c retaliation/sacrifice have byte-identical strategy and runner for direct candidate comparison. Product candidate also updates content/version metadata; no changed enemy base values.

|策略|通关|失败|截断|前三战全胜|机制兑现局|
|---|---:|---:|---:|---:|---:|
|normal|15/16|0|1|16/16|12/16|
|summon|16/16|0|0|16/16|15/16|
|frost|14/16|1|1|16/16|15/16|
|casual|5/16|10|1|16/16|0/16|
|splash|11/16|3|2|16/16|16/16|
|burn|16/16|0|0|16/16|16/16|
|rotation|16/16|0|0|16/16|16/16|
|duel|14/16|1|1|16/16|16/16|
|spell|13/16|3|0|16/16|16/16|
|retaliation|14/16|2|0|16/16|16/16|
|shield|16/16|0|0|16/16|16/16|
|sacrifice|4/16|12|0|16/16|14/16|

192局全部0引擎fault、失败API、预算错误和批中源码变化。源码备份见 frozen-development-d/manifest.json。

与c策略字节一致的反击/献祭可直接对照；其余旧a/b存在共享策略校正，不能将旧阶段差异全部归因产品。独立holdout尚未开始。

- retaliation: 7→14/16，脚本hash相同=True；伤害 {'attack': 28601, 'thorns': 3561, 'splash': 1644, 'burn': 967} → {'attack': 19372, 'thorns': 12177, 'splash': 1021, 'burn': 702}；献祭 0→0。
- sacrifice: 2→4/16，脚本hash相同=True；伤害 {'attack': 32941, 'burn': 522, 'ability': 994, 'thorns': 1002, 'splash': 3} → {'attack': 32107, 'burn': 514, 'ability': 959, 'thorns': 973, 'splash': 1}；献祭 314→307。

## 玩家侧机制与失败节点

- normal: {'attack': 22908, 'ability': 5786, 'burn': 1143, 'splash': 204, 'thorns': 300}；有效治疗71；真实轮换200；玩家决斗胜利161；献祭0。失败{}；截断{'1:9:虚空领主': 1}。
- summon: {'attack': 30849, 'splash': 22, 'ability': 170, 'burn': 148, 'thorns': 781}；有效治疗13；真实轮换99；玩家决斗胜利13；献祭0。失败{}；截断{}。
- frost: {'attack': 26689, 'ability': 3117, 'thorns': 80, 'burn': 65, 'splash': 104}；有效治疗75；真实轮换76；玩家决斗胜利379；献祭0。失败{'3:5:混合军团': 1}；截断{'1:9:虚空领主': 1}。
- casual: {'attack': 25561, 'splash': 691, 'thorns': 450, 'burn': 3422, 'ability': 1064}；有效治疗384；真实轮换189；玩家决斗胜利366；献祭6。失败{'3:9:永夜君王': 7, '3:5:混合军团': 1, '1:9:虚空领主': 2}；截断{'3:9:永夜君王': 1}。
- splash: {'attack': 20398, 'splash': 8723, 'burn': 5154, 'thorns': 798}；有效治疗2121；真实轮换37；玩家决斗胜利74；献祭0。失败{'3:9:永夜君王': 3}；截断{'3:9:永夜君王': 2}。
- burn: {'attack': 14246, 'burn': 17123, 'splash': 819, 'thorns': 29}；有效治疗1632；真实轮换24；玩家决斗胜利139；献祭0。失败{}；截断{}。
- rotation: {'attack': 31438, 'ability': 324, 'burn': 369, 'splash': 9, 'thorns': 76}；有效治疗110；真实轮换2789；玩家决斗胜利69；献祭0。失败{}；截断{}。
- duel: {'attack': 30290, 'burn': 392, 'splash': 26, 'thorns': 406}；有效治疗3678；真实轮换66；玩家决斗胜利1307；献祭0。失败{'3:9:永夜君王': 1}；截断{'1:9:虚空领主': 1}。
- spell: {'attack': 14279, 'ability': 18227, 'thorns': 199, 'burn': 193, 'splash': 37}；有效治疗2768；真实轮换59；玩家决斗胜利145；献祭0。失败{'3:9:永夜君王': 3}；截断{}。
- retaliation: {'attack': 19372, 'thorns': 12177, 'splash': 1021, 'burn': 702}；有效治疗3907；真实轮换45；玩家决斗胜利230；献祭0。失败{'3:9:永夜君王': 2}；截断{}。
- shield: {'attack': 31185, 'burn': 436, 'splash': 8, 'thorns': 8, 'ability': 12}；有效治疗15；真实轮换42；玩家决斗胜利44；献祭0。失败{}；截断{}。
- sacrifice: {'attack': 32107, 'burn': 514, 'ability': 959, 'thorns': 973, 'splash': 1}；有效治疗19；真实轮换42；玩家决斗胜利38；献祭307。失败{'3:9:永夜君王': 11, '1:9:虚空领主': 1}；截断{}。
