# 溅射公开换核策略补充

保留原FINAL-REPORT/summary的1144局与原溅射38/80，不覆盖旧策略结果。本补充只修改溅射的公开换核策略；产品core hash逐文件与旧1144一致，其他11策略不变。

新正常路线49/80通关、28明确败局、3首领平局截断，前三战80/80；新精英2/8通关、6明确败局、0截断，前三战8/8。所有完整批次零引擎fault、失败API、预算错误和批中源码变化。

**49与旧38来自不同seed，不是同seed配对，不能称为因果增加11局。** 新主组是32个独立seed与合法主将组合得到80局；旧组30个seed，精英新组4seed得到8局。

## 冻结规则与验证

Six regular own actions, exact half-attack combo segments, only first segment splash at half full base, once-after-full-attack rager growth/breaker armor loss, AoE half power. Owned higher tier must exceed old by15%+3 and meet real refunded HP floor. Old permanent growth enters old estimate only; old equipment returns via sell API but is not credited to candidate estimate.

开发c只验证真实转核、退款和无操作错误；此前错误估值/未投资窗口重选的诊断批原样保留、不计最终88局。修正后未按通关数继续调参数。源码与hash见frozen-splash-transition-final，种子事前审计及实际列表见summary。

## 转核与真实代价

主组43笔合法转核，覆盖40/80局；{'m_rex→m_rager': 7, 'n_breaker→m_rager': 20, 'm_whelp→m_rager': 8, 'm_rager→m_titan': 3, 'm_whelp→n_colossus': 1, 'n_breaker→n_colossus': 2, 'n_breaker→m_titan': 2}。精英1笔，覆盖1/8局。

实际退款培养{'atk': 295, 'hp': 215, 'block': 56}，实际丢失永久成长{'hp': 9}，装备通过原sell API退背包{'eq_belt': 6, 'eq_bow': 7, 'eq_frost': 8, 'eq_flame': 9, 'eq_duel': 6, 'eq_hammer': 1}。没有把卖出单位成长复制给新核，也未改变经济。

每笔转核首场目标血缘/上场/攻击训练退款兑现=True，实际HP底线兑现=True；合法合并后按真实ownedId血缘核对。转后实际主核场次528，其有效直接伤害{'attack': 24780, 'ability': 0, 'splash': 11859, 'thorns': 23}（无来源烧伤未冒领）。

有转核组{'runs': 40, 'clears': 20, 'defeats': 18, 'truncated': 2}；未转核组{'runs': 40, 'clears': 29}。这是自然供应选择后的分层，不是随机对照。终核分布{'m_rex': 11, 'm_rager': 32, 'm_whelp': 15, 'n_breaker': 14, 'm_titan': 5, 'n_colossus': 3}。

## 主将与机制贡献

|主将|通关|平均胜场|
|---|---:|---:|
|reva|10/20|20.40|
|zilan|9/20|18.80|
|sajj|14/20|20.70|
|kaleos|16/20|20.75|

80/80有真实溅射事件、77/80在第三章仍有机制兑现。玩家有效伤害{'attack': 112754, 'ability': 29, 'splash': 37981, 'burn': 13828, 'thorns': 1847}；其中第二目标溅射37981（22.8%）。预备真实成长8局，末核培养中位{'atk': 23.0, 'hp': 7.0, 'power': 0.0, 'block': 3.0}，永久成长中位{'atk': 0.0, 'hp': 0.0, 'power': 0.0}。

## 末关压力与剩单体阶段

明确死亡节点{'3:9:永夜君王': 27, '2:9:霜魇女皇': 1}；截断{'2:9:霜魇女皇': 1, '1:9:虚空领主': 1, '3:9:永夜君王': 1}。末章终局77局到达，首遇48胜；共129场，损失77、平3、疲劳61。

非胜场完整trace共80，其中52场、19局进入只剩一个敌人；13局主核在该阶段仍活着。真正选择攻击时只剩单体的额外溅射为0；多目标最后主目标死亡的同段链仍产生12溅射。这与初始首领多目标配置区分，不能把未过首领简单归于缺核心。胜场没有完整trace，不外推其阶段占比。

## 局限

- The old38/80 and new49/80 use different independently sampled seed groups; cannot call the11-clear difference a causal improvement.
- New main80 are32 independent seeds combined with legally available generals, not80 independent random seeds; elite8 are4 seeds.
- Upgraded and non-upgraded run comparisons are selected by naturally available supply and threshold, not randomized causal groups.
- Panel arithmetic is a bounded heuristic, not battle simulation: it does not model exact enemy action order, healing, deaths, revivals, blocks from all start auras, or counterfactual survival.
- Primary/secondary damage use effective observed events; source-less burn remains enemy-side aggregate and is not credited to upgraded core.
- Late sole-enemy analysis covers failed/draw final-boss traces only; victories do not have full traces, so their phase prevalence is unknown.
- Finite development16 was used to verify legality/real transfer and clear implementation defects, not tune success rate. Product/other11 policies were not adjusted.
