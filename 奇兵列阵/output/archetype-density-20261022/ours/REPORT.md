# 我方112普通卡构筑密度

仅静态诊断，未改src/UI、未跑新强度模拟。以当前data声明与必要engine规则为准，旧逐卡表只作追溯。完整112逐卡主职责、原文/定义、跨方向角色及SHA见classification.json。

## 结论

取消“蓄力独立流派”不要求重做10张蓄力单位：它们已有法术、物理爆发、冻结、召唤、攻击号令等真实职责，可保留单卡计时。真正需要重新定位的是3张专用依赖：遗迹守卫的加能、沙漏构装的加能/节拍双功能、沙焰术士的锁蓄力采购成长。后者不是加速卡，但比普通计时卡更依赖旧流派定义。

六阶分布21/21/21/21/14/14；主职责互斥合计112。备战成长字段25张（与主职责重叠），单卡蓄力10张。严格构筑密度只计明确输入/兑现/专属成长，不把有一个关键词的过桥卡算核心。

## 主职责（互斥）

|主职责|张数|
|---|---|
|轮换接棒|7|
|阵亡/复生/献祭兑现|15|
|备战成长/交易引擎|14|
|格挡转化与补给|5|
|独立承伤/续航|8|
|多段普攻核心|4|
|决斗/对位击杀|8|
|追击/完整行动支援|4|
|定点后排压制|4|
|法术伤害/收割|4|
|召唤接力/后继|11|
|灼烧投放/兑现|8|
|物理溅射/攻击载体|6|
|寒意/冻结兑现|12|
|专用时序加速支援|2|

## 构筑方向密度（可重叠）

入口/配合/终端按实际效果而非标签；E输入、A配合、P兑现、F终端、G专属备战成长计严格密度，B桥梁不计。细分角色与ID完整见JSON。

|方向|1–2阶入口/早配合|3–4阶配合|5–6阶终端/后配合|边界|
|---|---|---|---|---|
|轮换接棒|3：l_shield、l_windblade、s_step|3：l_archer、l_storm、n_tether|1：l_caliber|入队首/队尾事实可循环；沙兵只有活到常规行动后才轮换，故召唤者列桥梁而非直算轮换核心。|
|格挡消耗转化|4：l_shield、l_martyr、l_lion、d_sentry|3：l_warden、l_banner、d_obelisk|1：l_cliff|需要供盾与消耗兑现两端。独立嘲讽/护甲不是自动盾核心；冻结供盾是跨体系桥梁。|
|阵亡/复生/献祭|7：l_martyr、a_seed、a_graveguard、a_spine、a_imp、a_reaper、d_dune|8：l_knight、a_cult、a_brood、a_ritualist、a_jugg、a_nightmare、n_ritualist、n_alchemist|3：l_archon、a_matriarch、a_void|亡语输入、复生重复输入、主动献祭、死亡事实奖励各有子线；不是所有死亡卡都能同时服务每种子线。|
|召唤接力/后继|7：a_seed、m_egg、d_dune、d_artificer、d_howler、d_goldob、d_glass|3：a_nightmare、m_incubator、d_dunecaster|2：d_pharaoh、d_worm|镜沙与看守吃真实召唤；复活不是召唤。炼火/收割召唤属于条件桥梁；满场溢出不算召唤事实。|
|灼烧持续与燃亡|3：m_shaman、m_raptor、m_whelp|3：m_mender、m_harvester、m_bloodcaller|2：m_titan、m_heart|点火→续火/燃亡兑现。炼金亡语只有一次爆破，本体不能稳定续火；暗影只可作牺牲/承伤，不计严格密度。|
|寒意→冻结→兑现|5：v_guard、v_scout、v_chaser、v_snowman、v_shard|4：v_mage、v_sentinel、v_conduit、v_keeper|4：v_drake、v_queen、v_wyvern、v_stag|有寒意来源、冻结阈值与实际跳过行动、冻后奖励三层；雪人白鹿只把蓄力当投放时序。|
|多段/溅射普攻|5：s_wind、s_step、m_raptor、m_rex、n_breaker|4：s_dancer、s_choreo、s_xyle、m_rager|5：s_ninja、s_master、m_vindicator、m_mankator、n_colossus|这里含两个物理子方向：逐段命中/连击 与 横向溅射。共享攻击成长/追击但不可把两者当同一触发；主表保留子线标签。|
|决斗对位与击败对手|4：s_backstab、s_fox、s_monk、n_gladiator|2：s_viper、s_xyle|2：s_lord、s_panda|对位定点、嘲讽优先与击败锁定目标才发奖；普通击杀行动增加不自动计决斗核心。|
|个人法强与法术输出|3：l_priest、s_dart、a_devour|5：s_caster、a_cult、a_chanter、n_obelisk、d_shriek|2：a_engulf、a_solus|个人法强只加伤害/治疗/灼烧/寒意；召唤数值、格挡、追击与加行动不因此增长。E含治疗入口，不代表存在早期独立法强发动机。|
|净培养/结束备战养成|3：l_vigil、d_goldob、n_gladiator|3：l_mender、a_brood、m_kujata|1：a_solus|净培养与结束备战是两个投入模型：前者需点，后者需部署和回合；合并展示覆盖，不能视为一个闭环。|
|升星事件养成|1：s_wind|1：d_obelisk|4：l_sunriser、s_ninja、n_echo、n_paragon|自己升星与其他友军升星不同；s_wind不养队友，仅自身成长载体，晚期全队放大在5–6阶。|
|购买/出售养成|5：a_imp、n_merc、n_bulwark、n_medic、n_archer|4：s_choreo、a_cult、v_conduit、n_obelisk|1：m_mankator|前期是有限预算内交易转移，真正场上友军交易发动机3–4阶；d_pyro当前锁蓄力标签，归属问题另列，不计通用买卖核心。|

**密度判断：** 召唤与阵亡共享大量低阶入口，但召唤事实/死亡事实/复活不能互换；看守在4阶，低阶仍应靠亡语接力和学徒形成循环。冻结链入口、兑现、配套成长分布最完整。轮换低中阶有输入与兑现，高阶只有机兵一端；不需要借“蓄力”补计。灼烧从低阶投放到中阶燃亡/续火、高阶全场点火职责连贯。

**不能冒充独立成熟流的轴：** 个人法强低阶有输出和治疗载体，但持续永久法强发动机集中3–6阶、还跨死亡/交易，不能把所有施法者都叫法强核心；后排压制只是4张主职责卡、支持跨物理/法术，不另算完整成长流；独立护甲/反击/治疗不一定组成“护甲流”。备战成长分净培养、结束备战、升星、买卖四轴，机会成本和触发对象不同。

## 通用模块密度（不冒充独立流派）

|模块|1–2阶|3–4阶|5–6阶|判断边界|
|---|---|---|---|---|
|承伤/治疗通用模块（不直接称独立护甲流）|5：v_wall、n_bulwark、d_sentry、l_priest、m_hide|4：l_warden、v_rhyno、n_thorn、v_bear|2：l_cliff、n_colossus|单体承伤、反击、治疗可独立替换；没有自动形成统一护甲奖励循环，不能仅因坦克多就宣称护甲流完整。|
|后排压制目标模块|2：n_archer、s_dart|2：s_hunter、d_shriek|0：|物理狙击、两发法术、削弱与定时后排法伤混合；共享目标并不共享成长或触发，5–6阶无专门后排新增主核心。|
|追击/完整行动支援模块|0：|3：s_dancer、n_envoy、d_sandblade|1：n_marshal|前期没有独立发队友额外动作的普通核心，3–4阶开始、5阶指挥终端；追击不施法不积能，完整常规行动才可积能。|

## 蓄力及专用依赖去向

|单位|阶/N|真实职责与建议|
|---|---|---|
|a_chanter 魂缚吟者|3/2|保留：群体法术/个人法强输出，蓄力只是施法间隔。|
|m_rex 熔岩巨蜥|2/2|保留：物理爆发溅射，强化普攻与普通连击/追击资源区分。|
|m_titan 熔岩巨像|6/2|保留：全场点火终局单位，间歇点火不要求团队蓄力。|
|v_snowman 雪人|2/2|保留：对前排按攻击给寒意的定时控制入口。|
|v_rhyno 冰原巨犀|3/3|保留：承伤期间定时重击与叠甲，独立防御成长。|
|v_stag 凛风白鹿|5/3|保留：寒意群控与队伍格挡的高阶定时支援。|
|d_howler 沙嚎者|2/2|保留定位，单独复核兑现：精英后继/狙击狼；已有强度反例是token首次行动前死，不是必须有蓄力流。|
|d_shriek 风啸隼|3/2|保留：后排定时法术打击，归个人法强/后排压制。|
|d_sandblade 日轮刃使|4/2|保留：相邻普攻追击号令；属于攻击队的定时支援，数值不吃法强。|
|d_onyx 黑曜豹神|6/3|保留：跨多回合自成长输出，可吃追击/攻击培养；不是共享蓄力终端。|
|d_keeper|3/非单卡蓄力|纯加蓄力支援（另有普通嘲讽身材）。去掉蓄力独立构筑后，其唯一协同收益仍要求场上蓄力者；最明显职责悬空候选。建议：承伤/防线或召唤接力；重做受击后的收益以服务明确闭环，不保留泛用电池凑密度|
|d_hourglass|4/非单卡蓄力|蓄力加速+节拍减阈值，不能误称完全纯蓄力。蓄力部分依赖10定时卡；节拍部分还服务m_egg/d_obelisk，保留少量真实职责但现两对象不够证明一套流派。建议：定时防线/孵化的少量专属支援，或明确归召唤；不要保留泛用全计时器流派外壳|
|d_pyro|5/非单卡蓄力|不是加速器；购买带蓄力标签的队友时加攻与法强的专门成长筛选。取消蓄力独立流后，现有筛选条件失去产品职责，且部分合法目标法强无收益。建议：明确归法术成长或攻击成长择一，筛选真实受益者；不实施|

所有建议仅去向，不已实施。遗迹守卫仍可加速10卡，不能说代码已无效；若继续允许以电池同时服务所有计时卡，只取消“流派”字样并没有真正改变构筑。沙漏还有2张普通节拍目标（幼兽蛋、流沙方尖碑），需独立权衡。沙焰的攻/法强双收益对多种蓄力目标错轴，优先按真实成长对象重新设计。

外部依赖：沙漏坠、厚积、法伊冰封时刻、萨吉待命含蓄力分支；传令/指挥完整行动顺带加快计时，但影舞追击不积能。未纳入112卡总数。

## 112卡逐项索引

|ID|阶|主职责（仅一个）|跨方向/角色|计时/备战|
|---|---|---|---|---|
|l_shield 银盾侍卫|1|轮换接棒|rotation:E、shield:E||
|l_martyr 殉道者|1|阵亡/复生/献祭兑现|shield:E、death:E||
|l_vigil 守誓者|2|备战成长/交易引擎|growth:E|备战成长|
|l_warden 晨光盾卫|3|格挡转化与补给|shield:P||
|l_windblade 风刃剑士|1|轮换接棒|rotation:E||
|l_priest 圣光牧师|2|独立承伤/续航|shield:B、spell:E||
|l_knight 晨曦骑士|3|阵亡/复生/献祭兑现|death:E||
|l_lion 蔚蓝雄狮|2|格挡转化与补给|shield:P||
|l_archer 晨星弓手|3|轮换接棒|rotation:P||
|l_mender 辉光医者|4|备战成长/交易引擎|growth:A|备战成长|
|l_banner 誓约骑将|4|格挡转化与补给|shield:P||
|l_cliff 铁崖守护者|5|格挡转化与补给|shield:A||
|l_storm 风暴剑圣|4|轮换接棒|rotation:P||
|l_archon 曙光执政官|6|阵亡/复生/献祭兑现|shield:B、death:F||
|l_sunriser 旭日守望|5|备战成长/交易引擎|shield:B、growth:B、upgrade:P|备战成长|
|l_caliber 圣铸机兵|6|轮换接棒|rotation:F||
|s_wind 风刃学徒|1|多段普攻核心|combo:E、upgrade:E|备战成长|
|s_backstab 背刺者|2|决斗/对位击杀|duel:P||
|s_dancer 影舞者|3|追击/完整行动支援|combo:A、duel:B||
|s_fox 灯笼狐|1|决斗/对位击杀|duel:E||
|s_step 影步刺客|1|轮换接棒|rotation:E、combo:E||
|s_dart 飞镖手|2|定点后排压制|spell:E||
|s_ninja 连环忍者|5|多段普攻核心|combo:F、upgrade:P|备战成长|
|s_monk 碎骨武僧|2|决斗/对位击杀|duel:E||
|s_viper 赤蛇刺客|3|决斗/对位击杀|duel:P||
|s_hunter 暗隙猎手|3|定点后排压制|||
|s_choreo 刃影导师|4|备战成长/交易引擎|combo:G、trade:G|备战成长|
|s_caster 四风术士|4|法术伤害/收割|spell:P||
|s_xyle 岚刃剑客|4|决斗/对位击杀|combo:P、duel:A||
|s_master 千刃宗师|6|多段普攻核心|combo:F||
|s_lord 岚影宗主|6|决斗/对位击杀|duel:F||
|s_panda 熊猫武尊|5|决斗/对位击杀|duel:F||
|a_seed 幽火灵蛇|1|召唤接力/后继|shield:B、death:E、summon:E、burn:B||
|a_devour 吞噬者|1|法术伤害/收割|spell:E||
|a_graveguard 墓园守卫|2|阵亡/复生/献祭兑现|death:A||
|a_spine 暗棘|2|阵亡/复生/献祭兑现|death:E||
|a_imp 残魂小鬼|1|阵亡/复生/献祭兑现|death:E、trade:E|备战成长|
|a_reaper 灵魂收割者|2|阵亡/复生/献祭兑现|death:P||
|a_cult 献祭术士|3|阵亡/复生/献祭兑现|death:A、spell:A、trade:P|备战成长|
|a_brood 育魂者|3|备战成长/交易引擎|death:G、growth:G|备战成长|
|a_chanter 魂缚吟者|3|法术伤害/收割|spell:P|蓄力2；|
|a_ritualist 唤亡祭师|4|阵亡/复生/献祭兑现|death:A、summon:B||
|a_jugg 深渊巨兽|4|阵亡/复生/献祭兑现|death:P||
|a_engulf 吞噬之影|5|法术伤害/收割|death:B、summon:B、spell:P||
|a_nightmare 夜魇|4|召唤接力/后继|death:E、summon:E||
|a_matriarch 深渊主母|6|阵亡/复生/献祭兑现|death:F、summon:B||
|a_solus 永夜吟诵者|6|备战成长/交易引擎|spell:G、growth:G|备战成长|
|a_void 虚空吞噬者|5|阵亡/复生/献祭兑现|death:P||
|m_egg 幼兽蛋|1|召唤接力/后继|death:B、summon:E||
|m_shaman 原始萨满|1|灼烧投放/兑现|burn:E||
|m_hide 厚皮兽|1|独立承伤/续航|||
|m_raptor 白鬃猎龙|2|灼烧投放/兑现|burn:E、combo:E||
|m_whelp 炽棘幼龙|2|灼烧投放/兑现|burn:E||
|m_rex 熔岩巨蜥|2|物理溅射/攻击载体|combo:E|蓄力2；|
|m_mender 熔甲兽|3|灼烧投放/兑现|burn:E||
|m_kujata 驮岩兽|3|备战成长/交易引擎|growth:P|备战成长|
|m_harvester 噬焰兽|3|灼烧投放/兑现|summon:B、burn:P||
|m_incubator 孵化看守|4|召唤接力/后继|summon:A||
|m_bloodcaller 熔血巫兽|4|灼烧投放/兑现|burn:A||
|m_vindicator 怒焰斗士|5|多段普攻核心|combo:F||
|m_rager 暴怒迅猛龙|4|物理溅射/攻击载体|combo:P||
|m_titan 熔岩巨像|6|灼烧投放/兑现|burn:F|蓄力2；|
|m_mankator 炎鬃战兽|6|物理溅射/攻击载体|combo:A、trade:G|备战成长|
|m_heart 火山之心|5|灼烧投放/兑现|burn:E||
|v_guard 冰晶甲虫|1|寒意/冻结兑现|freeze:E||
|v_wall 冰墙|1|独立承伤/续航|||
|v_scout 冰原霜狼|2|寒意/冻结兑现|freeze:P||
|v_chaser 雪原小妖|1|寒意/冻结兑现|freeze:E、spell:B||
|v_snowman 雪人|2|寒意/冻结兑现|freeze:E|蓄力2；|
|v_mage 冰霜法师|3|寒意/冻结兑现|freeze:A、spell:B||
|v_shard 冰棱射手|2|寒意/冻结兑现|freeze:E||
|v_sentinel 冰角战兽|3|寒意/冻结兑现|freeze:A、spell:B||
|v_rhyno 冰原巨犀|3|独立承伤/续航||蓄力3；|
|v_conduit 寒潮之灵|4|备战成长/交易引擎|freeze:G、trade:G|备战成长|
|v_keeper 寒冬守望者|4|寒意/冻结兑现|shield:B、freeze:P||
|v_drake 霜脊地龙|5|寒意/冻结兑现|freeze:P||
|v_bear 冰河巨熊|4|独立承伤/续航|||
|v_queen 霜冠执政官|6|寒意/冻结兑现|freeze:F||
|v_wyvern 白霜巨龙|6|寒意/冻结兑现|freeze:F||
|v_stag 凛风白鹿|5|寒意/冻结兑现|shield:B、freeze:A、spell:B|蓄力3；|
|d_sentry 沙铠甲虫|1|独立承伤/续航|shield:E||
|d_dune 沙丘行者|1|召唤接力/后继|rotation:B、death:E、summon:E||
|d_artificer 构装学徒|1|召唤接力/后继|rotation:B、death:B、summon:E||
|d_howler 沙嚎者|2|召唤接力/后继|summon:E|蓄力2；|
|d_goldob 金焰方尖碑|2|备战成长/交易引擎|summon:G、growth:G|备战成长|
|d_keeper 遗迹守卫|3|专用时序加速支援|freeze:B||
|d_obelisk 流沙方尖碑|3|格挡转化与补给|shield:A、upgrade:P|备战成长|
|d_glass 镜沙猎蜥|2|召唤接力/后继|summon:P||
|d_shriek 风啸隼|3|定点后排压制|spell:P|蓄力2；|
|d_dunecaster 沙灵塑师|4|召唤接力/后继|summon:E、trade:B|备战成长|
|d_sandblade 日轮刃使|4|追击/完整行动支援|combo:B、duel:B、spell:B|蓄力2；|
|d_pyro 沙焰术士|5|备战成长/交易引擎|trade:B|备战成长|
|d_hourglass 沙漏构装|4|专用时序加速支援|freeze:B||
|d_pharaoh 沙域法老|6|召唤接力/后继|summon:F||
|d_onyx 黑曜豹神|6|物理溅射/攻击载体|combo:B|蓄力3；|
|d_worm 黑沙巨虫|5|召唤接力/后继|summon:F||
|n_merc 佣兵|1|备战成长/交易引擎|growth:B、trade:E|备战成长|
|n_bulwark 铁甲卫士|1|独立承伤/续航|growth:B、trade:E|备战成长|
|n_medic 战地医师|2|阵亡/复生/献祭兑现|death:B、trade:E|备战成长|
|n_archer 游侠弓手|2|定点后排压制|trade:E|备战成长|
|n_gladiator 角斗士|1|决斗/对位击杀|duel:E、growth:E、upgrade:B|备战成长|
|n_obelisk 方尖碑|3|备战成长/交易引擎|spell:G、trade:P|备战成长|
|n_breaker 碎石兵|2|物理溅射/攻击载体|combo:A||
|n_thorn 棘背兽|3|独立承伤/续航|||
|n_envoy 传令使|4|追击/完整行动支援|combo:B、duel:B、spell:B||
|n_tether 换位术士|3|轮换接棒|rotation:A||
|n_ritualist 祭仪师|4|阵亡/复生/献祭兑现|death:A、summon:B||
|n_echo 回响祭司|5|备战成长/交易引擎|upgrade:P|备战成长|
|n_marshal 战阵指挥官|5|追击/完整行动支援|combo:B、duel:B||
|n_alchemist 炼金术士|4|阵亡/复生/献祭兑现|death:E、burn:B、freeze:B||
|n_colossus 战争巨像|6|物理溅射/攻击载体|combo:F||
|n_paragon 落日灵驹|6|备战成长/交易引擎|upgrade:F|备战成长|

分类判断边界：s_step主归轮换、同时是连击载体；m_raptor主归点火、同时是多段入口；v_keeper主归冻结兑现、同时桥接格挡；l_sunriser主归升星培养、开场盾为桥梁；a_engulf主归法术收割、击杀召唤是桥梁。多归属已在JSON保留，不用单一主职责掩盖。

## 个人法强口径复核（修正漏项）

风啸隼虽然主职责归后排压制，其chargeSkill确为dmg→enemyRear，已补入严格法术P。严格法术方向现在10卡、分阶3/5/2（含3名专属法强供给，不把它们误算输出）。

直接伤害/治疗载体共7卡：l_priest、s_dart、s_caster、a_devour、a_chanter、a_engulf、d_shriek。可被法强增强的状态桥梁共5卡：m_shaman、m_titan、v_chaser、v_mage、v_stag；后者属灼烧/寒意链，不因吃法强便全部计为个人法术流核心。二者合计12名真实受益载体。

雪人的freeze按目标攻击投放，召唤属性、追加追击、完整行动、强化普攻均不受个人法强增幅。冰角/地龙等被动以及炼金亡语虽然投状态或伤害，也不是cast，不计法强载体。统计不依赖主职责归属，具体效果/目标与排除理由见JSON personalPowerReview。

## 与SAP统一的显式结构覆盖（宽口径，可重叠）

此处与SAP同一A/B协议，仅表示代码里有相应结构，绝不是流派核心数或可成型密度。

|轴|总数|1阶|2阶|3阶|4阶|5阶|6阶|
|---|---|---|---|---|---|---|---|
|A 死亡/复生/召唤|28|6|6|3|7|3|3|
|B 长期成长/交易资源|25|5|4|5|4|4|3|

A名单：l_martyr、l_knight、l_archon、a_seed、a_graveguard、a_spine、a_imp、a_reaper、a_cult、a_ritualist、a_jugg、a_engulf、a_nightmare、a_matriarch、a_void、m_egg、m_harvester、m_incubator、d_dune、d_artificer、d_howler、d_glass、d_dunecaster、d_pharaoh、d_worm、n_medic、n_ritualist、n_alchemist。

B名单：l_vigil、l_mender、l_sunriser、s_wind、s_ninja、s_choreo、a_imp、a_cult、a_brood、a_solus、m_kujata、m_mankator、v_conduit、d_goldob、d_obelisk、d_dunecaster、d_pyro、n_merc、n_bulwark、n_medic、n_archer、n_gladiator、n_obelisk、n_echo、n_paragon。

A包含自身亡语、友军死亡、主动献祭/复活、直接产己方单位、响应友军召唤；吞噬之影/噬焰兽虽用敌死触发，但明确产己方单位所以计入。育魂/金焰只在备战读取标签，不响应死亡或进场，排A入B。只有击杀/对手阵亡奖励的背刺/赤蛇不入A。B仅明确场外永久/交易等接口，排纯战内buff、加能、加行动；当前恰为25张prep卡。

SAP锁定A/B：Turtle19/19、Golden30/19、Unicorn17/22。只与我方宽A28/B25并列，不与上文严格方向核心数比较；各包规模、商店抽取规则不同，不能由卡数推出强度或成型概率。我方实际close/related/explore轮转、同名扶持及五货架规则也使n/112不是抽取率。
