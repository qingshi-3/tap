# 圣光、暗影、中立48单位静态审计（0.8.4）

强度为设计判断，不是真人排名。全部112普通单位卡表已横向读过；这里只负责48单位。未改产品代码、未跑构建，未引用尚未冻结的探针结果。

## 优先处理

- D0：碎石兵/熔岩巨蜥，三个位阶完全同纯溅射，前者少1攻击。
- D1上位覆盖：角斗士/背刺者同阶同身材；方尖碑/育魂者同阶同法强数值且覆盖范围是子集。游侠弓手/暗隙猎手同狙击击杀成长，多长生命仍是数值维度。
- 高频失衡风险：守誓者、晨星弓手每交锋；铁崖自给盾；宗师按全队每段普攻；回响祭司双邻持续成长；盾卫盾转甲和狮子连击逐段盾转伤。尚需行为探针判断幅度。
- 祭仪师消灭一名活体，只给第三人小额攻击，需按最优亡语祭品比较净收益。

D0为完全同底规则；D1含附加泛用奖励与上位覆盖，不能用人数、数值、阵营和稀有度豁免。D2要求实际不同站位、队友、时序或资源风险。JSON保留要求的level三枚举并补templateRisk与分星判定。

## 共同契约

- 普通连击两段ceil(攻击/2)，并非两次全伤；甲与反击逐段结算。
- onRear是每交锋末，不是每回合；不需要该单位自己出手。
- 开战初始队首不触发onFront，普通追击不轮换/蓄力/施法；额外常规行动可触发这些。
- 法强只增施法dmg/heal/burn/chill，全体目标减半向下取整；buff/盾/行动/追击不吃法强。
- highestAtk友方目标排除施法源；highestHp可能含自己；锁定目标避免前一效果改变后续目标。
- 格挡上限3、复生一次且1血；灼烧绕过盾甲；孤立阻止其他友军来源正收益。
- 身体每星统一+1攻/+2血不是独立机制成长；专有能力无增量的星级应明确列出。

每牌占5个上场位之一，同名合星耗招募机会。通常每回合1次常规行动，普通施法替代普攻。培养/装备/主将协同均需投入，不能视为免费性能；敌群出现率、实战胜率、多人叠加等尚未验证。

## l_shield 银盾侍卫：条件型

初始队首不触发，必须等轮换/死亡后再接棒；多次接棒能持续补盾，只剩单个单位或固定首位时收益低。

成长：1★ 2/5；2★ 3/7；3★ 4/9。格挡1/2/2；3星仅身材成长，无能力增量。

职能、协同与弱点：轮换接棒坦；齐兰轮转、机兵/剑圣配队有效；怕灼烧和接棒前被打死。

- l_windblade【同职能但有实质差异 / D2】：同样轮换接棒，但保护与临时输出改变培养和排位。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留接棒差异；提示初始队首不触发。

证据：src/core/data.ts:72；src/core/engine.ts (onFront)；src/core/engine.ts (rotateToRear)；src/core/engine.ts (checkFront)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_martyr 殉道者：合理

复生使一次死亡可保留本体且触发亡语；身后必须有友军，献祭能主动兑现，放逐克制。

成长：1★ 1/4；2★ 2/6；3★ 3/8。身后盾1/2/3，上限3；两次真正阵亡可两次亡语，复生只一次。

职能、协同与弱点：亡语送盾前排；莉莉丝/卡西瓦及主母有协同；无后位或身后盾满浪费。

- a_graveguard【同职能但有实质差异 / D2】：送格挡且自身复生，对方给后位复生且自身嘲讽，死亡时点/受益对象配置不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留；观察多亡语叠盾上限，不按层数当本场持续减伤。

证据：src/core/data.ts:74；src/core/engine.ts (reap)；src/core/engine.ts (rattleTimes / reap)；src/core/engine.ts (reviveUnit)；src/core/engine.ts (block)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_vigil 守誓者：偏强

站队尾即每次交锋补前排盾，不消耗自己的行动；频率随双方人数/额外行动增加，远高于每回合一次。

成长：1★ 2/5；2★ 3/7；3★ 4/9。每交锋1/1/2；2星只有身材，3星抗连击能力跃升但盾上限3。

职能、协同与弱点：固定尾部保前排引擎；晨光盾卫/誓约骑将连动、齐兰会移走尾位；怕狙击与灼烧。

- l_sunriser【高度近似 / D1】：均自动持续给单目标格挡；尾位限制和选最高生命会改变排位，但基础决策仍是后排盾电池。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：优先探针长交锋队伍的封锁强度，必要时按回合限额。

证据：src/core/data.ts:76；src/core/engine.ts (beatEnd)；src/core/engine.ts (onRear)；src/core/engine.ts (block)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_warden 晨光盾卫：偏强

开战自带盾，每消耗一层格挡便本场叠甲；补盾循环使攻击减伤无限成长，嘲讽确保受击。

成长：1★ 2/6；2★ 3/8；3★ 4/10。初盾1/2/2；每破盾恒定+1甲，3星不提高能力；额外盾供给比升星更关键。

职能、协同与弱点：嘲讽成长坦；守誓者/旭日、格挡培养连动；灼烧无视盾甲、爆发/放逐阻断。

- d_sentry【高度近似 / D1】：都是嘲讽开战盾；持续叠甲带来实质成长分支但基础功能完全覆盖对方。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：高优先级检验盾甲循环，考虑护甲成长封顶。

证据：src/core/data.ts:78；src/core/engine.ts (hit)；src/core/engine.ts (armor)；src/core/engine.ts (block)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_windblade 风刃剑士：条件型

每次真正成为队首加临时攻击，可多次接棒但回合末清空；开战首位无收益，轮换会离开承伤区。

成长：1★ 3/4；2★ 4/6；3★ 5/8。接棒本回合+2/3/4攻；不是跨回合积累。

职能、协同与弱点：轮转爆发；齐兰/换位术士创造入口；缺轮转时不如常驻攻击成长。

- l_storm【同职能但有实质差异 / D2】：自己接棒临时爆发对全队接棒本场持续自成长，确实改变队伍密度及节奏。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留，和剑圣区分为当回合爆发。

证据：src/core/data.ts:80；src/core/engine.ts (onFront)；src/core/engine.ts (respond)；src/core/engine.ts (rotateToRear)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_priest 圣光牧师：合理

每次常规行动用治疗替代1攻，追当前生命最低的受伤者；多人受伤时更聪明但不能保证坦克，满血改普攻。

成长：1★ 1/6；2★ 2/8；3★ 3/10。治疗4/6/8，单体加完整个人法强；升星身材攻+1/血+2不提升施法频率。

职能、协同与弱点：单体续航；阿尔吉昂亲征/坚守队、法涌有用；怕一击致死/全队爆发。

- n_medic【高度近似 / D1】：都是行动换单体治疗；最低血量与固定队首在轮换/分摊受伤时改变目标，但普通单坦队几乎同用法。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留最低受伤目标差异；不要仅按奶量和医师区分。

证据：src/core/data.ts:82；src/core/engine.ts (targets)；src/core/engine.ts (cast)；src/core/engine.ts (effectUseful)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_knight 晨曦骑士：合理

复生后1血再领盾，能额外承受攻击并保留原培养；灼烧直接穿盾，复生已消耗后是普通近战。

成长：1★ 3/7；2★ 4/9；3★ 5/11。复活盾1/2/3；3星抗多段更稳但无第二次复生。

职能、协同与弱点：复生抗压前排；莉莉丝死亡计魂、格挡消费队；怕放逐。

- l_martyr【同职能但有实质差异 / D2】：自保复活盾对后位亡语盾，保核心与供给别人分工不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留复活后护盾时点。

证据：src/core/data.ts:84；src/core/engine.ts (reap)；src/core/engine.ts (reviveUnit)；src/core/engine.ts (onRevive)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_lion 蔚蓝雄狮：条件型

每段普攻加当前盾层×系数；无盾时能力为零，盾既是伤害燃料又会被攻击消耗，需后排保护。

成长：1★ 4/5；2★ 5/7；3★ 6/9。每盾增伤1/2/3；3盾时每段+3/6/9，获得连击可把附加值结算两次。

职能、协同与弱点：盾量转输出；守誓者/旭日/连击装备/刃影导师连动；怕灼烧、先手破盾。

- s_xyle【同职能但有实质差异 / D2】：都逐段加伤，但自有盾资源与敌方护甲条件要求不同的培养/支援。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：高优先级探针连击×盾附加，保留而审查倍增。

证据：src/core/data.ts:86；src/core/engine.ts (attack)；src/core/engine.ts (lion)；src/core/engine.ts (hit)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_archer 晨星弓手：偏强

轮换后留在尾部即可每交锋打敌尾，不必等本人下一次行动；多单位长轮次放大频率。

成长：1★ 2/5；2★ 3/7；3★ 4/9。额外尾伤2/3/4，不是施法不吃法强；轮换与常规攻击同存。

职能、协同与弱点：尾位持续副伤；齐兰会周期换离尾位，狙击/嘲讽不拦技能尾伤；怕先被后排斩杀。

- s_dart【高度近似 / D1】：都定点打尾；无需行动的尾位响应会改变站位和频率，但终端输出目标高度重复。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：优先探针每交锋自动副伤，和飞镖手的行动代价比较。

证据：src/core/data.ts:87；src/core/engine.ts (beatEnd)；src/core/engine.ts (onRear)；src/core/engine.ts (rotateToRear)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_mender 辉光医者：合理

每次行动群疗，五人同时受伤上限高；不提高最大生命，未受伤队友浪费，替代普通攻击。

成长：1★ 1/8；2★ 2/10；3★ 3/12。全队治疗2/3/4，各加floor(个人法强/2)；单坦伤害环境逊于单奶。

职能、协同与弱点：分摊损伤续航；轮转队/阿尔吉昂光誓相合；怕集火直接击杀与灼烧压过奶速。

- l_priest【同职能但有实质差异 / D2】：群体摊伤队与单核心集火队有实质配队差异。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留群疗差异，用实际受伤人数评价。

证据：src/core/data.ts:89；src/core/engine.ts (cast)；src/core/engine.ts (heal)；src/core/engine.ts (effectAmount)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_banner 誓约骑将：条件型

每个友军每消耗1盾就本场持续加攻，没有自身供盾；盾不被打破无收益，其他友军源增益受孤立阻断。

成长：1★ 4/8；2★ 5/10；3★ 6/12。每破盾+1/2/3攻，可多友军/多段触发，无回合上限。

职能、协同与弱点：破盾转攻引擎；晨光盾卫/守誓者/旭日；怕灼烧绕盾、无供盾。

- m_hide【同职能但有实质差异 / D2】：格挡消耗让全队成长，与自己实际受伤成长是不同资源循环。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：探针多盾多段的成长，先看供给成本而非单独强度。

证据：src/core/data.ts:91；src/core/engine.ts (hit)；src/core/engine.ts (banner)；src/core/engine.ts (blocksAllyBenefit)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_cliff 铁崖守护者：偏强

每交锋首次被普攻后补盾，嘲讽集中攻击；对单段每交锋一击容易形成循环。补盾入队列在攻击后结算，不应假定第一段后立即挡同次连击。

成长：1★ 3/10；2★ 4/12；3★ 5/14。补盾1/2/2；2星抵多段与下一交锋显著提高，3星只身材。

职能、协同与弱点：自给盾嘲讽坦；旗将/守誓者与格挡体系相合；怕灼烧、法术和集中多击。

- l_warden【同职能但有实质差异 / D2】：自给循环盾对外部供盾叠甲，支援依赖不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：最高优先级比较单段/连击/法术三类反制与盾甲队组合。

证据：src/core/data.ts:92；src/core/engine.ts (attack)；src/core/engine.ts (cliffBeat)；src/core/engine.ts (hit)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_storm 风暴剑圣：条件型

任一友军接棒本场持续自加攻，每回合上限防止无限；初始前排不计，单体轮换不足。

成长：1★ 4/7；2★ 5/9；3★ 6/11。每次+1，回合cap2/3/3；3星只有身材，长局跨回合可持续。

职能、协同与弱点：轮转成长输出；齐兰、换位术士/多轮换单位；怕早期集火与缺队友。

- l_windblade【同职能但有实质差异 / D2】：全队事件跨回合成长与自己接棒临时增伤不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留团队接棒计数，审查3星升级感。

证据：src/core/data.ts:94；src/core/engine.ts (checkFront)；src/core/engine.ts (onAllyFront)；src/core/engine.ts (capped)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_archon 曙光执政官：偏强

开战全队复生不需行动，最多给多个培养核心第二条命；可加倍亡语/死亡魂潮，已有复生者重复无效。

成长：1★ 4/10；2★ 5/12；3★ 6/14。1星全队复生；2/3星再全队1/2盾；开战一次，不自动覆盖后续召唤。

职能、协同与弱点：全队保险；莉莉丝/卡西瓦及亡语体系；放逐、复生1血后灼烧反制。

- a_graveguard【同职能但有实质差异 / D2】：开战全队即时赋予对死亡后单后位继承，强度/排位要求不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：高优先级检查全队有效复生数与四阶机会成本，不能当等量治疗。

证据：src/core/data.ts:96；src/core/engine.ts (onStart)；src/core/engine.ts (grant)；src/core/engine.ts (reap)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_sunriser 旭日守望：条件型

开战一次并每3交锋给最高生命者盾，不耗行动；目标可能是自己或后排，不保证当前坦克且满盾会浪费。

成长：1★ 4/9；2★ 5/11；3★ 6/13。2/3/3盾，3星只身材；沙漏可缩短节拍，不是3回合。

职能、协同与弱点：高血核心盾电池；旗将/狮子/盾卫；怕目标偏离和灼烧。

- l_vigil【高度近似 / D1】：持续单目标供盾重复，最高血和尾位/前排差异使站位要求不同，不能仅以节拍数字当新机制。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留选最高血策略但需清楚表现；与尾位供盾者比较有效盾量。

证据：src/core/data.ts:99；src/core/engine.ts (targets)；src/core/engine.ts (beatEnd)；src/core/engine.ts (pulseMax)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## l_caliber 圣铸机兵：偏强

每次真正轮换给新前排本场持续双属性，每回合至多3次；多个轮换者让收益扩散，不能用无实际换位反复触发。

成长：1★ 5/10；2★ 6/12；3★ 7/14。每次+1/+1、+2/+2、+3/+3；每回合cap3，即全队总量最高+3/+3、+6/+6、+9/+9。

职能、协同与弱点：轮换成长核心；齐兰/换位术士/轮换牌；缺轮换只是普通5/10，占四阶槽。

- n_echo【同职能但有实质差异 / D2】：轮换后新前排被动给数值，对行动换双邻持续培养要求不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：高优先级测3星多轮换增长，保留轮换定向分配。

证据：src/core/data.ts:101；src/core/engine.ts (afterRotate)；src/core/engine.ts (rotateToRear)；src/core/engine.ts (specialUse)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_wind 风刃学徒：合理

连击分两段，每段向上取整，奇数攻击额外1总伤，但受护甲两次和反击两次；2星后普攻/追击追加本场持续成长。

成长：1★ 3/3；2★ 4/5；3★ 5/7。1星无成长；2/3星每次普攻后+1/+2攻，不是每段各加。

职能、协同与弱点：连击起手；千刃宗师/卡雷奥斯追击；怕护甲反击，3血难前排。

- s_step【高度近似 / D1】：连击主体相同，轮换有真实脱离前排及接棒作用；s_wind高星改为成长而非走位。 分星：1星同纯连击主体，影步附轮换；2/3星风刃增加自成长，影步仍只有连击轮换。轮换需实际接棒收益才构成构筑差异。
- n_merc【高度近似 / D1】：2/3星都普攻后自加攻，连击改护甲/反击关系但成长循环相同。 分星：1星风刃无成长、佣兵有成长；2/3星都普攻后自加攻，连击影响逐段护甲/反击但不改变成长循环。

建议：保留2星成长但明确1星与升级差异。

证据：src/core/data.ts:105；src/core/engine.ts (attack)；src/core/engine.ts (afterAttack)；src/core/engine.ts (extraAct)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_backstab 背刺者：合理

必须决斗锁定目标被本人普攻击杀才加攻追击，空位打前排且嘲讽拦截；追击链默认不能无限接杀。

成长：1★ 3/4；2★ 4/6；3★ 5/8。决斗击杀+1/2/3攻后追击；高星易跨斩杀线但错位即失效。

职能、协同与弱点：同位斩杀滚动；蕾娃换敌位/卡雷奥斯/连锁；怕高甲盾和抢人头。

- s_ninja【高度近似 / D1】：核心都是击杀加攻追击；决斗选位对连击抗性不同，会改站位但滚雪球循环高度重复。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。
- s_viper【高度近似 / D1】：决斗追击重复，但只认本人击杀与队友代杀也触发改变协作抢头。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留决斗击杀条件，和忍者合并评估是否仍有足够目标差异。

证据：src/core/data.ts:108；src/core/engine.ts (duelKill)；src/core/engine.ts (pickTarget)；src/core/engine.ts (chainCap)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_dancer 影舞者：偏强

自己1攻行动换最高攻队友完整追击，可用高培养/连击/溅射放大；不复制目标施法且受冻结、追击链限制。

成长：1★ 1/5；2★ 2/7；3★ 3/9。追击额外攻0/1/2；法强不放大extraAct，升星主体收益依赖被驱动者。

职能、协同与弱点：核心普攻驱动；卡雷奥斯/千刃宗师/狮子；被迫驱动纯法师、缺高攻队友时弱。

- n_envoy【高度近似 / D1】：均牺牲自身行动换最高攻队友多打一次；即时普攻对下轮常规行动有真实时序/施法/蓄力差异。 分星：1/2/3星对普通打手均驱动一次；但对施法/蓄力/轮换者，额外常规行动能做原本行动，追击只能立刻普攻。此实际差异始终成立，不能仅以加伤0/1/2解释。

建议：探针1阶驱动高培养核心性价比；保留即时普攻区别于额外行动。

证据：src/core/data.ts:110；src/core/engine.ts (targets)；src/core/engine.ts (cast)；src/core/engine.ts (extraAct)；src/core/engine.ts (effectAmount)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_fox 灯笼狐：合理

决斗普攻后本场持续降对手攻，只要仍有目标便逐次削弱；不是每段各减，减至最小攻击后边际低。

成长：1★ 2/4；2★ 3/6；3★ 4/8。降攻1/2/2；3星只身材；目标改变时削弱分散。

职能、协同与弱点：同位削弱；蕾娃调位锁敌、长线坚守；怕施法敌/高爆发/目标先死。

- s_caster【同职能但有实质差异 / D2】：普通攻击固定决斗削弱，与追最高攻法伤削弱选择不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留同位削弱，审查高星无能力增量。

证据：src/core/data.ts:113；src/core/engine.ts (afterAttack)；src/core/engine.ts (pickTarget)；src/core/engine.ts (buff)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_step 影步刺客：偏弱

纯连击加轮换无能力随星提升；轮换可避前排但也打乱决斗/邻位，连击本身不自动翻倍输出。

成长：1★ 2/4；2★ 3/6；3★ 4/8。能力三个位阶相同，只+1/+2攻和+2/+4血；必须靠轮换体系兑现额外价值。

职能、协同与弱点：轮转连击配件；齐兰/机兵/宗师；护甲反击双重克制，缺轮换收益时白板。

- s_wind【高度近似 / D1】：同连击，轮换改变排位但高星成长被对方覆盖。 分星：1星同纯连击主体，影步附轮换；2/3星风刃增加自成长，影步仍只有连击轮换。轮换需实际接棒收益才构成构筑差异。
- m_vindicator【同职能但有实质差异 / D2】：连击轮换对连击溅射，走位辅助与多目标伤害不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：优先核对是否给高星明确轮换收益，避免再加单纯攻击数值。

证据：src/core/data.ts:115；src/core/engine.ts (rotateToRear)；src/core/engine.ts (attack)；src/core/engine.ts (levelStats)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_dart 飞镖手：偏弱

每行动只用小法伤定点敌尾，能绕嘲讽但无自带法强/成长，敌尾死亡后目标更新；同阶常见增伤辅助优于独立低额法伤。

成长：1★ 1/5；2★ 2/7；3★ 3/9。尾伤3/4/6加完整个人法强；无固有限次，行动频率每回合默认1。

职能、协同与弱点：尾部清理法师；法涌/永夜/卡雷奥斯余韵；怕盾甲与尾部高血。

- a_devour【高度近似 / D1】：完全同构单目标直接施法，仅队首/队尾不同；后排威胁与嘲讽绕过才构成场景差异。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。
- d_shriek【高度近似 / D1】：尾部单点法伤重复，蓄力期间可普攻及需加速是实际成本差异。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：与晨星弓手/吞噬者统一比较，若保留须有真实尾部清除需求。

证据：src/core/data.ts:116；src/core/engine.ts (cast)；src/core/engine.ts (targets)；src/core/engine.ts (hit)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_ninja 连环忍者：合理

连击击杀追击，需自击杀但不限决斗；杀死锁定目标后第二段不会自动转新目标，追击链有限。

成长：1★ 3/5；2★ 4/7；3★ 5/9。1星击杀仅追击，2/3星另+1/+2攻；护甲两次减伤，收割线比卡面攻击复杂。

职能、协同与弱点：连击收割；宗师/连锁/卡雷奥斯；怕盾甲与队友先杀。

- s_backstab【高度近似 / D1】：击杀成长追击核心相同，目标/连击是差异但非新玩法循环。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留连击抗性差异，审查与背刺者是否过度重复。

证据：src/core/data.ts:118；src/core/engine.ts (attack)；src/core/engine.ts (onKill)；src/core/engine.ts (extraAct)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_monk 碎骨武僧：条件型

只有目标当前攻击高于自己才附加伤；培养自身攻击会关闭条件，与单纯堆攻存在冲突；决斗允许找高攻低血目标。

成长：1★ 3/6；2★ 4/8；3★ 5/10。条件加伤2/3/4；若被赋连击每段加，容易放大但非真无视甲。

职能、协同与弱点：以弱攻换高攻斩杀；蕾娃/连击导师；对低攻高血坦与降攻队冲突。

- s_xyle【高度近似 / D1】：同为决斗条件逐段附伤；条件指向高攻或有甲会改变针对目标，但操作循环相近。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留反向堆攻取舍，给攻击培养前后的条件探针。

证据：src/core/data.ts:121；src/core/engine.ts (attack)；src/core/engine.ts (monk)；src/core/engine.ts (pickTarget)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_viper 赤蛇刺客：条件型

记住最近普攻锁定的决斗目标，任意来源杀它才追击，不需亲自抢头；首次攻击之前无锁定，后续锁定覆盖旧目标。

成长：1★ 3/4；2★ 4/6；3★ 5/8。三个位阶同能力，只身材提升；高星不提高追击频率上限。

职能、协同与弱点：队友协杀追击；蕾娃调位/宗师尾伤/灼烧；目标不死或自己先死无收益。

- s_backstab【高度近似 / D1】：同决斗追击；不同击杀归属是实际协同差异但终端功能重复。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留代杀条件，与背刺者差异须靠队友协杀场景体现。

证据：src/core/data.ts:122；src/core/engine.ts (attackTargets)；src/core/engine.ts (reap)；src/core/engine.ts (viper)；src/core/engine.ts (extraAct)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_hunter 暗隙猎手：合理

狙击击杀双属性成长，能绕前排但嘲讽仍拦截；增血提高后排续航，高血尾部/抢头使滚雪球停止。

成长：1★ 4/6；2★ 5/8；3★ 6/10。击杀+2/+2、+3/+3、+4/+4；不会改变狙击目标规则，个人培养攻与生命成长相互促成。

职能、协同与弱点：后排狙杀成长；卡雷奥斯/蕾娃摆尾；怕嘲讽高甲/无小怪。

- n_archer【同质 / D1】：同是狙击→自己击杀→本场自成长；增攻改增攻血与数值/身材不足以构成新机制。 分星：1星游侠仅狙击，猎手多击杀自成长；2/3星两者都是狙击击杀成长，猎手仅更高增攻及额外生命成长，均属同底模板/上位奖励。

建议：按用户标准与游侠弓手列同质族，若并存应给非数值机制差别。

证据：src/core/data.ts:124；src/core/engine.ts (pickTarget)；src/core/engine.ts (onKill)；src/core/engine.ts (buff)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_choreo 刃影导师：条件型

开战给相邻最高攻连击，不包括自己且已连击者授予无额外收益；在中位挑邻居确有排位代价。

成长：1★ 2/6；2★ 3/8；3★ 4/10。赋连击恒定，另加攻0/1/2；高星主要固定加攻及身材，不提升连击层数。

职能、协同与弱点：为高攻单段者改攻击形态；狮子/武僧/宗师协同；怕护甲反击。

- s_lord【高度近似 / D1】：同开战给最高攻连击及少量攻击；相邻限制与额外决斗有排位意义，但主要核心授予重复。 分星：三个位阶均同开战授最高攻连击模板；高星同附0/1/2攻击。宗主全场选人能复刻导师邻位选择；额外决斗需实际同槽对位才可形成差异，不能因覆盖范围更大免责。
- m_kujata【同职能但有实质差异 / D2】：同开战授特性，但连击与溅射的目标数/克制完全不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：和宗主合并审议，避免只靠稀有度与目标范围保留重复授予。

证据：src/core/data.ts:126；src/core/engine.ts (onStart)；src/core/engine.ts (targets)；src/core/engine.ts (grant)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_caster 四风术士：合理

瞄准最高攻，固定目标锁定防止伤害后削弱跳人；自带1法强使伤害实际4/5/7，弱化不吃法强。

成长：1★ 1/6；2★ 2/8；3★ 3/10。基础伤3/4/6+1，本场持续降攻恒1；可外部法强继续扩大伤害，削弱不增长。

职能、协同与弱点：高威胁法伤压制；永夜/法涌/蕾娃；盾甲能削实际伤，目标不一定残血。

- s_dart【同职能但有实质差异 / D2】：定点尾部伤与追最高攻并本场持续削弱，改变对抗和辅助需求。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留伤害+威胁削弱，勿把最高攻当自动斩杀。

证据：src/core/data.ts:129；src/core/engine.ts (lockTargets)；src/core/engine.ts (cast)；src/core/engine.ts (effectAmount)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_xyle 岚刃剑客：条件型

双段逐段对有甲目标追加，但还要被甲减伤，并非完全穿透；无甲时普通连击决斗。

成长：1★ 4/6；2★ 5/8；3★ 6/10。每段条件加2/3/4；高星双段系数增强，嘲讽会改目标，不能自由挑甲。

职能、协同与弱点：反甲决斗打手；蕾娃调位/卡雷奥斯/宗师；怕高甲超过附加值、反击。

- s_monk【高度近似 / D1】：同条件逐段附伤决斗，区别在高攻/护甲条件并改变针对目标。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：用各档护甲实际伤害表核对，不称无视护甲。

证据：src/core/data.ts:131；src/core/engine.ts (attack)；src/core/engine.ts (armorPiercer)；src/core/engine.ts (armor)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_master 千刃宗师：偏强

任意友军每段普攻命中均额外打尾，包括自己连击/追击；被格挡的命中也可能入landed路径，无每回合上限，队伍攻击次数倍增。

成长：1★ 6/10；2★ 7/12；3★ 8/14。每段尾伤1/2/2；2星能力翻倍，3星只身材；属于被动能力不吃个人法强。

职能、协同与弱点：连击追击发动机；影舞者/卡雷奥斯/忍者；怕主体系被控制、自己被狙击。

- l_archer【同职能但有实质差异 / D2】：同尾副伤但按全队普攻段数而非自己尾位每交锋，配置与触发密度实质不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：最高优先级探针五连击队加驱动，检查多宗师叠加及格挡命中计数。

证据：src/core/data.ts:133；src/core/engine.ts (attack)；src/core/engine.ts (master)；src/core/engine.ts (hit)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_lord 岚影宗主：条件型

开战给其他最高攻决斗和连击；既有连击/决斗者部分浪费，决斗可能把原本前排斩杀者改打同位硬坦，需排位。

成长：1★ 4/9；2★ 5/11；3★ 6/13。授予恒定，附攻0/1/2；高星未新增机制，4阶槽用于开战一次授予。

职能、协同与弱点：核心改造辅助；狮子/武僧/宗师；怕甲反击，已有特性队弱。

- s_choreo【高度近似 / D1】：同开战最高攻连击+攻，范围与决斗改变站位但主要授予机制重合。 分星：三个位阶均同开战授最高攻连击模板；高星同附0/1/2攻击。宗主全场选人能复刻导师邻位选择；额外决斗需实际同槽对位才可形成差异，不能因覆盖范围更大免责。

建议：与刃影导师高度重复优先简化；勿用4阶/多决斗一词掩盖重复。

证据：src/core/data.ts:135；src/core/engine.ts (targets)；src/core/engine.ts (onStart)；src/core/engine.ts (grant)；src/core/engine.ts (pickTarget)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## s_panda 熊猫武尊：条件型

自己原生不带决斗，依赖其他友军决斗普攻亲自杀目标才全队加攻；技能击杀/旁伤不计。

成长：1★ 6/12；2★ 7/14；3★ 8/16。全队+1攻，回合cap1/1/2；2星只身材，3星第二次团队收益。

职能、协同与弱点：决斗击杀收益放大；蕾娃/背刺者/宗主；不搭决斗时近白板，怕坦怪挡斩杀。

- a_jugg【高度近似 / D1】：都是条件事件→全队+1攻有回合cap；友方死亡与决斗斩杀使构筑资源不同，仍属于同一团队成长骨架。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：明确本人无决斗，不以trigger标签误认特性；检查三阶以下构筑的达成率。

证据：src/core/data.ts:139；src/core/engine.ts (duelKill)；src/core/engine.ts (panda)；src/core/engine.ts (specialUse)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_merc 佣兵：合理

每次普攻后本场持续自加攻，追击也可触发但不是每段；需要活到多次出手，前排无保护。

成长：1★ 3/5；2★ 4/7；3★ 5/9。每攻后+1/2/2；3星只身材；默认每回合1次，驱动能加速。

职能、协同与弱点：纯普攻成长起手；卡雷奥斯/影舞者；怕先手斩杀与冻结。

- s_wind【高度近似 / D1】：2/3星同普攻后成长，连击仅攻击形态差异。 分星：1星风刃无成长、佣兵有成长；2/3星都普攻后自加攻，连击影响逐段护甲/反击但不改变成长循环。
- m_rager【高度近似 / D1】：同普攻后自成长，多溅射是有用攻击形态但核心循环重合。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：作为简单基准保留；减少其他卡仅附关键词的同成长复制。

证据：src/core/data.ts:271；src/core/engine.ts (afterAttack)；src/core/engine.ts (extraAct)；src/core/engine.ts (buff)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_bulwark 铁甲卫士：偏弱

低攻纯护甲肉盾，无嘲讽无法拦截狙击/决斗，站前才有价值；与冰墙同基础身材而大多缺保护功能。

成长：1★ 1/9；2★ 2/11；3★ 3/13。甲1/2/2；2星比同星冰墙多1甲，1/3星同甲却少嘲讽；3星无能力增量。

职能、协同与弱点：低费纯抗小伤前排；续航队/齐兰轮转不太相容；怕灼烧/大额伤害。

- v_wall【高度近似 / D1】：纯护甲坦对护甲嘲讽坦，1/3星能力被覆盖；无嘲讽可避免集火但未形成明确新循环。 分星：1星同1甲及同1/9身材、冰墙多嘲讽；2星铁甲2甲对冰墙1甲，有真实多段减伤数值交换；3星均2甲，冰墙再度覆盖嘲讽保护。无嘲讽可分散承伤，但需确有场景证据。
- v_keeper【高度近似 / D1】：固定站首护甲坦重复，守望者额外甲也是数值增强。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：最高优先级处理同族弱替代，别只补血攻维持重复卡。

证据：src/core/data.ts:272；src/core/engine.ts (armor)；src/core/engine.ts (hit)；src/core/engine.ts (pickTarget)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_medic 战地医师：合理

每行动固定治疗当前队首，适合保单坦但轮换后换目标；满血无有效目标改普攻，不会储存治疗。

成长：1★ 1/5；2★ 2/7；3★ 3/9。治疗3/4/6加完整个人法强；无固有限次，升星不变频率。

职能、协同与弱点：固定前排续航；阿尔吉昂/盾甲坦；怕前排被秒和后排受伤。

- l_priest【高度近似 / D1】：同单体施法治疗，单坦队用途完全接近，只有受伤分布才让目标选择产生实质差异。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：与牧师保留目标差异但列高重复单奶族。

证据：src/core/data.ts:273；src/core/engine.ts (targets)；src/core/engine.ts (heal)；src/core/engine.ts (cast)；src/core/engine.ts (effectUseful)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_archer 游侠弓手：合理

1星纯狙击，2星后击杀加攻；嘲讽拦截，后排高血或抢头使成长无效。

成长：1★ 2/4；2★ 3/6；3★ 4/8。1星无成长，2/3星击杀+1/+2攻；高星从白板攻击特性转成长狙击。

职能、协同与弱点：低阶后排击杀起手；蕾娃调位/卡雷奥斯；怕嘲讽护甲。

- s_hunter【同质 / D1】：同狙击击杀自成长，额外生命只是成长数值维度变化，不能用三阶解释差异。 分星：1星游侠仅狙击，猎手多击杀自成长；2/3星两者都是狙击击杀成长，猎手仅更高增攻及额外生命成长，均属同底模板/上位奖励。

建议：与暗隙猎手归同质族，升级路线可接受但不算两套机制。

证据：src/core/data.ts:274；src/core/engine.ts (pickTarget)；src/core/engine.ts (onKill)；src/core/engine.ts (buff)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_gladiator 角斗士：偏弱

只有决斗，提供同槽点杀但无数值外收益；与背刺者同一星原始3/4身材，后者多击杀成长和追击，无内生代价。

成长：1★ 3/4；2★ 4/6；3★ 5/8。三个位阶都只有决斗，只身材成长；始终缺击杀回报。

职能、协同与弱点：决斗起手/熊猫供触发；蕾娃摆位有用；怕同位硬坦/嘲讽。

- s_backstab【同质 / D1】：1/2/3星同tier同身材、同决斗选目标；背刺者仅额外给击杀加攻和追击，没有相应代价。泛用正奖励构成上位覆盖，不是新的独立操作玩法。 分星：1/2/3星均覆盖；背刺者击杀加攻1/2/3，角斗士无奖励。

建议：高优先级删并或赋实际非数值取舍，不能以白板教学掩盖长期弱替代。

证据：src/core/data.ts:277；src/core/engine.ts (pickTarget)；src/core/engine.ts (duelKill)；src/core/engine.ts (levelStats)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_obelisk 方尖碑：偏弱

动态给身后最近一友军法强，自己不受益，受站位和存活限制；同阶育魂者两邻光环且身材更优，前方不能受益。

成长：1★ 1/7；2★ 2/9；3★ 3/11。法强1/2/2，3星只身材；不是施法，不会自触发施法协同。

职能、协同与弱点：单方向法强电池；卡拉关键词、法师后排；怕被换位或目标无受法强效果。

- a_brood【同质 / D1】：同阶同法强1/2/2动态邻位光环；育魂者可以把施法者置于身后复刻方尖碑全部用法，同时覆盖前邻且2/7身材优于1/7。仅扩大覆盖人数没有引入新资源或时序取舍。 分星：1/2/3星均上位覆盖；高星都在2法强停增。

建议：高优先级与育魂者合并/改方向职责，勿用阵营保留弱覆盖。

证据：src/core/data.ts:278；src/core/engine.ts (power)；src/core/engine.ts (neighbors)；src/core/engine.ts (blocksAllyBenefit)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_breaker 碎石兵：偏弱

纯溅射第二目标半攻一次，不受连击第二段重复；和熔岩巨蜥同阶同血，攻击少1且无新机制。

成长：1★ 3/6；2★ 4/8；3★ 5/10。三个位阶仅身材成长；溅射始终floor(攻击/2)最少1，单敌无收益。

职能、协同与弱点：基础双目标物理；卡雷奥斯/影舞者；怕无后位敌人/护甲。

- m_rex【同质 / D0】：完全相同纯溅射，唯攻击数字不同；阵营不算差异。 分星：1/2/3星同纯溅射规则，同6/8/10血；巨蜥始终多1攻。
- n_colossus【高度近似 / D1】：同溅射主体，多嘲讽改变保护对象但无新输出循环。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：明确同质且弱替代，优先合并或真正重做机制。

证据：src/core/data.ts:279；src/core/engine.ts (attack)；src/core/engine.ts (splash)；src/core/engine.ts (levelStats)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_thorn 棘背兽：合理

每段普攻命中返伤，格挡命中也反击；被技能/灼烧打不触发，没嘲讽靠站前吸攻击。

成长：1★ 2/9；2★ 3/11；3★ 4/13。每段反击1/2/3；连击吃两次返伤，高星明确克制多段但自身减伤不足。

职能、协同与弱点：反连击坦；格挡供给/治疗/嘲讽装备；怕远程施法/高爆发。

- v_guard【同职能但有实质差异 / D2】：反伤立即杀攻击者，寒意则影响后续出手，克制多段与控行动不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留按攻击段反伤定位，不用普通受击混淆。

证据：src/core/data.ts:280；src/core/engine.ts (attack)；src/core/engine.ts (thorns)；src/core/engine.ts (hit)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_envoy 传令使：条件型

每回合给其他最高攻+1常规行动，后续行动可施法、蓄力和轮换；不是即时追击，获益前可能死，重复施法不会无限加。

成长：1★ 1/5；2★ 2/7；3★ 3/9。三个星级能力恒+1行动且每回合限1，主要身材成长；个人法强不加次数。

职能、协同与弱点：常规行动驱动；蓄力/法师/齐兰/卡雷奥斯次序；若只普通打手与影舞者重复。

- s_dancer【高度近似 / D1】：同最高攻驱动一次；常规行动与即时普攻造成施法/蓄力/时序差异，不能仅说行动+1等同追击。 分星：1/2/3星对普通打手均驱动一次；但对施法/蓄力/轮换者，额外常规行动能做原本行动，追击只能立刻普攻。此实际差异始终成立，不能仅以加伤0/1/2解释。

建议：保留常规行动差异，探针目标为纯施法/蓄力时的收益。

证据：src/core/data.ts:281；src/core/engine.ts (addAction)；src/core/engine.ts (actionGrants)；src/core/engine.ts (targets)；src/core/engine.ts (effectAmount)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_tether 换位术士：条件型

行动使当前队首到尾，真换位触发接棒/机兵，不直接输出；两人以上才有效，可打乱邻位及当前轮行动顺序。

成长：1★ 1/5；2★ 2/7；3★ 3/9。三个位阶能力相同，只身材成长；法强对rotate无效。

职能、协同与弱点：主动轮转引擎；齐兰/风刃/剑圣/机兵；无轮转收益时用1个槽换零输出。

- l_shield【同职能但有实质差异 / D2】：自身攻后轮换与用施法主动轮换队首，触发对象及行动代价不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留能主动推动别人差异；设计评价须计1行动+1人口成本。

证据：src/core/data.ts:283；src/core/engine.ts (cast)；src/core/engine.ts (rotateToRear)；src/core/engine.ts (afterRotate)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_ritualist 祭仪师：偏弱

每次施法消灭身前最近友军，给另一最高攻小幅攻击；需祭品、施法者、第三受益者三人，损失活体属性通常大于加攻，靠亡语/复生兑现。

成长：1★ 1/6；2★ 2/8；3★ 3/10。给攻1/2/3，不吃法强；无次数上限但会耗尽祭品，缺任一对象改普攻。

职能、协同与弱点：主动亡语触发器；莉莉丝/主母/复生小鬼；误祭培养核心代价极高。

- a_void【同职能但有实质差异 / D2】：都献祭，但自动吃尾自吸属性与主动吃前给第三人，选择/代价明显不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：高优先级用低费亡语最优场景测净收益，优先减少无谓活体损失而非仅加数值。

证据：src/core/data.ts:285；src/core/engine.ts (targets)；src/core/engine.ts (sacrifice)；src/core/engine.ts (effectUseful)；src/core/engine.ts (cast)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_echo 回响祭司：偏强

每次行动给最多两邻本场持续双属性，持续无次数/回合上限；堆在中位让两个核心成长，不吃法强但享施法复制和额外常规行动。

成长：1★ 1/7；2★ 2/9；3★ 3/11。双邻各+1/+1、+2/+2、+3/+3；3星每施法总+6/+6，升星显著。

职能、协同与弱点：双核成长辅助；法涌/卡雷奥斯余韵/传令使（需成为最高攻才被驱动）；怕狙击、轮换破邻、孤立阻益。

- d_pharaoh【同职能但有实质差异 / D2】：行动持续双邻成长对开战全体及后续召唤加成，时间与人口结构不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：高优先级测复制双邻叠加与五人口成本，避免无上限成长压过专职牌。

证据：src/core/data.ts:287；src/core/engine.ts (cast)；src/core/engine.ts (targets)；src/core/engine.ts (buff)；src/core/engine.ts (effectAmount)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_marshal 战阵指挥官：合理

开战给当前队首本场持续双属性及首回合额外常规行动；无需本人行动，首位承伤可能尚未兑现第二次就死，后续无辅助技能。

成长：1★ 2/6；2★ 3/8；3★ 4/10。双属性2/3/4，行动恒+1且非每回合；可给自己若本人前排。

职能、协同与弱点：首位核心开局爆发；阿尔吉昂/蓄力/施法首位；怕先手爆发/冻结吞行动。

- n_envoy【同职能但有实质差异 / D2】：开战定队首含身材与每回合施法定最高攻，不同启动与回合依赖。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。
- n_paragon【高度近似 / D1】：同开战属性辅助骨架，行动与护甲/目标选择有真实不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留一次启动与持续驱动区别；检验首位施法/蓄力收益。

证据：src/core/data.ts:289；src/core/engine.ts (onStart)；src/core/engine.ts (addAction)；src/core/engine.ts (targets)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_alchemist 炼金术士：合理

一次施法同时给前排灼烧和寒意，前者逐交锋伤害、后者削下一次普攻/冻结；单法强同时提高两个状态，有实际复合效率。

成长：1★ 1/6；2★ 2/8；3★ 3/10。灼烧2/3/4、寒意1/2/2；两项都各吃完整个人法强，非伤害立即结算；3星寒意不升。

职能、协同与弱点：双状态单体法师；瓦尔坎/冰冻队/永夜、法涌；怕状态免疫减免、目标快速死亡。

- m_shaman【高度近似 / D1】：同前排灼烧施法，炼金另带寒意明显扩宽效果但构成原机制附加覆盖。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。
- v_chaser【同职能但有实质差异 / D2】：前排寒意单控与复合灼烧，法强/控伤资源配置不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：优先核对双吃法强是否让单状态施法者失去位置。

证据：src/core/data.ts:291；src/core/engine.ts (cast)；src/core/engine.ts (effectAmount)；src/core/engine.ts (burn)；src/core/engine.ts (chill)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_colossus 战争巨像：合理

高身材溅射嘲讽，吸狙击/决斗保护后排并打两目标，但无自给减伤/成长，四阶仅身材与两特性组合。

成长：1★ 7/14；2★ 8/16；3★ 9/18。能力三个位阶不变；攻7/8/9、血14/16/18，溅射随攻为3/4/4。

职能、协同与弱点：高血保护双目标前排；医疗/盾/影舞者；怕灼烧与单目标高爆发，单敌时溅射无效。

- m_rex【高度近似 / D1】：纯溅射加嘲讽，输出循环同质而保护责任不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。
- m_titan【同职能但有实质差异 / D2】：坦克拦截与多目标上灼烧，培养/支援明显不同。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：保留嘲讽保护角色，但勿把身材高当独立输出机制。

证据：src/core/data.ts:293；src/core/engine.ts (pickTarget)；src/core/engine.ts (attack)；src/core/engine.ts (levelStats)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

## n_paragon 落日灵驹：偏强

开战最高攻与最高生命分别锁定，允许同一单位两份双属性再得甲；无需行动，能集中强化高培养核心。

成长：1★ 4/10；2★ 5/12；3★ 6/14。每份+2/+2、+3/+3、+4/+4；护甲1/2/2；同目标时总+4/+4、+6/+6、+8/+8。

职能、协同与弱点：开战双核/单核增幅；阿尔吉昂高身材/高攻血坦；最高攻排除自己、最高血可自己，切勿误认为总能自己吃两份。

- n_marshal【高度近似 / D1】：同开战属性辅助，护甲对额外行动和按最高值对队首是真差异，但应作为同一辅助骨架比较。 分星：1/2/3星均比较；具体升级分界见本单位growth及下述分星结论。

建议：优先测双选同目标与分流两种收益，观察开局数值覆盖其他四阶。

证据：src/core/data.ts:294；src/core/engine.ts (targets)；src/core/engine.ts (lockTargets)；src/core/engine.ts (onStart)；src/core/engine.ts (grant)；src/core/engine.ts (levelStats)；src/core/power.ts:6 (effectAmount)

证据收口：engine.ts仅保留函数或响应路径名，data.ts行号逐ID重新核对；本场成长均不跨战保留。主责统一补充最终24场景探针，本分报告不重复运行。
