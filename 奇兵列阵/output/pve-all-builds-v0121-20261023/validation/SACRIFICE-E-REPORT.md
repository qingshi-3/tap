# 献祭e：单核转型与队尾契约

沿用d产品与相同16个开发样本，仅修策略；d证据保持原样。

结果：0/16通关，15失败，1截断；前三战16/16。零fault、失败API、预算错误和批中源码变化。全部core hash与d相同。

23次合法销售转型，退还培养 {'hp': 137, 'block': 53, 'atk': 184}；损失永久成长 {'hp': 15, 'atk': 8, 'power': 0}，装备损失也逐笔记录，未白转属性。末次Void培养中位攻击26、HP点22。

真实Void献祭390次；活着的Void每轮机会中，177次不合格尾停机，23次仅剩自己在尾。首回合状态{'actual-sacrifice': 142, 'ineligible-tail': 22}。不合格尾{'a_jugg': 67, 'a_ritualist': 47, 'a_matriarch': 62, 'n_breaker': 1}。没有第二只Void同时上场，没有非祭品轮换副核封尾；无worm观察歧义。

Actual sacrifice is exact from real event and pre-event snapshot. Stops use real first beat of each round with no preceding void sacrifice, inspecting standing tail after round-start effects; worm presence is flagged ambiguous. No worm ambiguity observed. This measures void-alive rounds, not dead/reserve rounds.

玩家有效伤害{'attack': 32321, 'burn': 525, 'ability': 1326, 'thorns': 838, 'splash': 1}；Void自身有效伤害12038、真实献祭获得攻击buff合计1823。失败节点{'3:9:永夜君王': 14, '1:9:虚空领主': 1}。

该轮校正没有改善胜率。旧普通副输出移交后，有限祭品耗尽和不可献祭支援留尾成为可见停机原因；不能再把d的成熟风刃副核当作Void循环强度。结论是当前这套已执行契约的Void策略仍弱，不是对所有合法献祭混搭的最优性证明。

逐轮机会、尾对象、实际事件索引、销售损失与逐场阵形见 SACRIFICE-E-summary.json / development-e-sacrifice。可复现源码见 frozen-development-e。
