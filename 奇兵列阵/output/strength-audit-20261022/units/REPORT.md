# 112普通卡受控强度与成长诊断

本轮只读产品：112卡×三星×前后排×基础/邻位协同/类别反制×0/4/12点平衡培养与4/12点法强，共10080格、13354缓存去重战，fault0，核心SHA前后一致。另2688一星轻/普通威胁格、3156去重战，fault0、核心SHA未变。25张prep卡的0/1/3轮合成事件账本单列，不将其战斗低伤害当弱卡。

所有数字都是受控合成证据，不是玩家胜率、抽取概率或合法远征收益。没有修改产品、技能数值、主将、模拟策略或运行完整构建。

## 能支持的结论

1. **存在可用的一星入口与明显培养空间，但不是人人同一种投资。** 普通一星威胁下，学徒和巨蜥均从零投入3/4场景取胜到4点攻血4/4；固定二星高血压力下，巨蜥4点使3/18格结果改善、12点14/18，巨犀为6/18→18/18。这里4点=2攻+4血，12点=6攻+12血，确实花费同一总点数，不是给某卡额外资源。赢格不是强度总分。
2. **沙嚎者的具体瓶颈仍是后继行动兑现，不是完全放不出蓄力。** 下面可复现格中零投入已经释放1次、攻血12点释放2次，但两只沙狼都在首次行动前死亡；法强12点没有任何收益。这支持检查精英后继保护/时序，不支持把所有召唤统一立即行动或简单加法强。
3. **法强轴必须防误导。** 巨蜥是蓄力普攻、巨犀同理，沙嚎召唤数值不吃法强；12法强与0投入在代表格完全相同。它们仍可从攻血投资变强，不能因此扣常规强度。魂缚吟者法强12点将代表格队伍有效伤害25→53，但仍落败；生存/行动与法强是不同取舍。
4. **高阶不自动值得替换。** 只有13卡找到通过事先职责检查的低阶参照，其余标NA。所有prep卡排除这种直接换卡判断，因为其价值在未来备战事件。不同职责只保留原场景数据，不能推荐用输出替掉育成引擎或反过来。
5. **同结果近伤害不是机制同质。** 本报告不按合成胜率给112卡排总榜；同结果时必须结合治疗、减伤、冻结、召唤、触发前置及实际输入成本。

## 代表反例：固定可复现输入

以下均为一星、队尾格4、邻位协同、固定seed841022；完整allies/enemy/投入与三方结果见cells.json按ID/level/slot/context/investment检索。该格是压力对照，不是远征可得阵容。

|单位|0点：动作/释放/队伍有效伤害/结果|4点平衡|12点平衡|12法强|
|---|---|---|---|---|
|d_howler|3/1/16/lose|5/2/18/lose|5/2/26/lose|3/1/16/lose|
|m_rex|2/1/18/lose|4/2/34/lose|5/3/59/win|2/1/18/lose|
|a_chanter|2/1/25/lose|4/2/39/lose|6/3/56/draw|2/1/53/lose|
|s_master|7/0/41/win|7/0/44/win|5/0/48/win|7/0/41/win|
|m_titan|3/2/61/win|3/2/61/win|3/2/61/win|1/1/61/win|

千刃宗师该格0投入7动作、24次左右战斗触发（以cells记录为准）即可胜，属于多段普攻团队的放大风险入口；不能和无同阶职责匹配的育成/亡语辅助对比后宣称全面超模。熔岩巨像0点已经完成击杀，12点仍是相同总有效伤害61，是敌方总血量的天花板，不是“培养没用”。

沙嚎格：0点召1狼、0只行动、1只先死；12点平衡召2狼、0只行动、2只先死。它不是“无技能触发”，也不是胜利提前结束造成没行动。

## 控制变量与失效方法

- 候选与参照同星、同培养，总购入份数1/2/4对应3/6/12金；比较星级时成本相应提高，不宣称三星与一星同成本。队友固定一星无培养；无主将、装备、预演选阵或额外行动注入。
- 敌方固定二星、基础血+8且攻至少3，所有投入/替代/空槽臂完全一致。零投入只有106/2016赢格，有明显压力地板，不能用于“开局公平”结论；一星轻/普通威胁补充用于可用性，极轻骷髅阵也有天花板。
- 协同前排让核心在身后，后排将核心翻转贴近候选，保证最少一名真正相邻。五战位端点最多一个直接邻居，所以双电池不声称同时邻接；具体位置记录在allies数组。
- 参照按事先机制族+职责标签挑选、ID固定破并列，不看结果。随后以事先职责+实际效果/trait兼容条件筛掉错配：只有19卡同阶参照、13卡低阶参照保留比较资格，其他NA。原始启发式臂仍保留在cells但referenceComparable=false，不用于换卡判断。
- calibration-first/是已标为无效的方法校准：纯标签错配及队尾离电池过远。保留追溯，不作为本结论证据。
- 团队metrics是引擎有效量。个人directEffectiveDamage按日志前态扣血上限估计；治疗/授盾/状态事件量为原始事件，不能与有效团队量相加；后代/后续灼烧未强行归到召唤者。无trigger标签不代表光环无效。

## 25卡备战成长与交易账本

prep-growth.json使用真实prepEvent执行明确标注的合成成功事件，每次备战尝试3次以检验cap，每次重置前才跨轮。它不是商店/金币可达性模拟。自己购买/出售/升星的反复事件只是限次压力，不把同一身份买三轮或卖后仍在场当成合法成长。

条件成立且来源存活占战位时：守誓者一星3次备战给队首总3生命；永夜一星3次给两个相邻施法者各3法强，代价是来源占1/5战位并存活保留3轮；导师一星3次备战每轮购2名连击者才可累计6攻击，购入总18金，若卖回同星循环净耗至少12金。角斗士一星3次净培养提交额外+3攻/+3血，仍需3轮各有真实净投入培养点，撤销不能白领。

## 按ID查阅与投入边际

同阶/低阶NA表示职责不匹配或prep未来价值未纳入。表内改善是相对本卡零培养18格的结果改善数量；不能将其当跨卡分数。完整伤害/支持边际、三星与一星成本和动作、开场补充均在by-id.json。

|ID|阶/族|同阶参照|低一阶参照|4→12平衡点改善格/18|4→12法强改善格/18|一星普通威胁0→4→12点赢格/4|
|---|---|---|---|---|---|---|
|l_shield 银盾侍卫|1/rotate|NA|NA|0→12|0→0|3→3→4|
|l_martyr 殉道者|1/death|NA|NA|0→2|0→0|4→4→4|
|l_vigil 守誓者|2/prep|NA|NA|0→5|0→0|3→4→4|
|l_warden 晨光盾卫|3/physical|NA|NA|6→15|0→0|4→4→4|
|l_windblade 风刃剑士|1/rotate|s_step|NA|0→13|0→0|3→4→4|
|l_priest 圣光牧师|2/caster|NA|NA|1→11|0→0|4→4→4|
|l_knight 晨曦骑士|3/physical|l_warden|NA|4→15|0→0|4→4→4|
|l_lion 蔚蓝雄狮|2/physical|NA|NA|1→12|0→0|4→4→4|
|l_archer 晨星弓手|3/rotate|NA|NA|6→14|0→0|4→4→4|
|l_mender 辉光医者|4/prep|NA|NA|0→2|0→0|3→4→4|
|l_banner 誓约骑将|4/physical|NA|NA|2→16|0→0|4→4→4|
|l_cliff 铁崖守护者|5/physical|NA|NA|5→15|0→0|4→4→4|
|l_storm 风暴剑圣|4/rotate|NA|l_archer|5→17|0→0|4→4→4|
|l_archon 曙光执政官|6/physical|NA|NA|6→9|0→0|4→4→4|
|l_sunriser 旭日守望|5/prep|NA|NA|2→17|0→0|4→4→4|
|l_caliber 圣铸机兵|6/rotate|NA|NA|1→13|0→0|4→4→4|
|s_wind 风刃学徒|1/combo|NA|NA|0→8|0→0|4→4→4|
|s_backstab 背刺者|2/duel|s_monk|n_gladiator|2→12|0→0|3→4→4|
|s_dancer 影舞者|3/caster|NA|NA|1→4|0→0|4→4→4|
|s_fox 灯笼狐|1/duel|n_gladiator|NA|0→2|0→0|3→4→4|
|s_step 影步刺客|1/rotate|l_windblade|NA|0→13|0→0|2→4→4|
|s_dart 飞镖手|2/caster|NA|a_devour|2→12|3→4|4→4→4|
|s_ninja 连环忍者|5/combo|m_vindicator|s_xyle|2→15|0→0|4→4→4|
|s_monk 碎骨武僧|2/duel|s_backstab|n_gladiator|0→5|0→0|4→4→4|
|s_viper 赤蛇刺客|3/duel|NA|s_backstab|0→10|0→0|4→4→4|
|s_hunter 暗隙猎手|3/physical|NA|NA|2→15|0→0|4→4→4|
|s_choreo 刃影导师|4/prep|NA|NA|0→5|0→0|3→4→4|
|s_caster 四风术士|4/caster|NA|NA|2→9|6→11|4→4→4|
|s_xyle 岚刃剑客|4/combo|NA|NA|2→15|0→0|4→4→4|
|s_master 千刃宗师|6/combo|NA|m_vindicator|6→9|0→0|4→4→4|
|s_lord 岚影宗主|6/duel|NA|NA|0→11|0→0|4→4→4|
|s_panda 熊猫武尊|5/physical|NA|NA|6→16|0→0|4→4→4|
|a_seed 幽火灵蛇|1/summon|d_artificer|NA|0→2|0→0|3→3→4|
|a_devour 吞噬者|1/caster|NA|NA|3→10|5→11|4→4→4|
|a_graveguard 墓园守卫|2/death|NA|NA|0→1|0→0|3→4→4|
|a_spine 暗棘|2/death|NA|NA|0→6|0→0|4→4→4|
|a_imp 残魂小鬼|1/death|NA|NA|0→2|0→0|4→4→4|
|a_reaper 灵魂收割者|2/death|NA|NA|0→4|0→0|3→3→4|
|a_cult 献祭术士|3/death|NA|NA|0→1|0→0|4→4→4|
|a_brood 育魂者|3/death|NA|NA|0→3|0→0|4→4→4|
|a_chanter 魂缚吟者|3/charge|d_shriek|NA|3→12|1→8|4→4→4|
|a_ritualist 唤亡祭师|4/death|NA|NA|0→2|0→0|4→4→4|
|a_jugg 深渊巨兽|4/death|NA|NA|3→9|0→0|4→4→4|
|a_engulf 吞噬之影|5/summon|NA|d_dunecaster|0→1|2→4|4→4→4|
|a_nightmare 夜魇|4/summon|d_dunecaster|NA|0→2|0→0|4→4→4|
|a_matriarch 深渊主母|6/death|NA|NA|0→8|0→0|4→4→4|
|a_solus 永夜吟诵者|6/prep|NA|NA|0→8|0→0|3→4→4|
|a_void 虚空吞噬者|5/death|NA|NA|2→12|0→0|4→4→4|
|m_egg 幼兽蛋|1/summon|a_seed|NA|0→0|0→0|3→3→3|
|m_shaman 原始萨满|1/burn|NA|NA|1→4|2→3|4→4→4|
|m_hide 厚皮兽|1/physical|NA|NA|3→14|0→0|4→4→4|
|m_raptor 白鬃猎龙|2/burn|NA|NA|1→9|0→0|4→4→4|
|m_whelp 炽棘幼龙|2/burn|NA|NA|3→10|0→0|4→4→4|
|m_rex 熔岩巨蜥|2/charge|NA|NA|3→14|0→0|3→4→4|
|m_mender 熔甲兽|3/burn|NA|NA|6→10|0→0|4→4→4|
|m_kujata 驮岩兽|3/prep|NA|NA|0→5|0→0|3→4→4|
|m_harvester 噬焰兽|3/summon|NA|NA|0→3|0→0|3→4→4|
|m_incubator 孵化看守|4/physical|NA|NA|2→13|0→0|4→4→4|
|m_bloodcaller 熔血巫兽|4/burn|NA|NA|2→8|0→0|4→4→4|
|m_vindicator 怒焰斗士|5/combo|s_ninja|s_xyle|4→16|0→0|4→4→4|
|m_rager 暴怒迅猛龙|4/physical|NA|NA|5→12|0→0|4→4→4|
|m_titan 熔岩巨像|6/charge|NA|NA|1→1|1→1|4→4→4|
|m_mankator 炎鬃战兽|6/prep|NA|l_sunriser|7→15|0→0|4→4→4|
|m_heart 火山之心|5/burn|NA|NA|5→7|0→0|4→4→4|
|v_guard 冰晶甲虫|1/freeze|NA|NA|0→10|0→0|3→4→4|
|v_wall 冰墙|1/armor|n_bulwark|NA|5→8|0→0|4→4→4|
|v_scout 冰原霜狼|2/freeze|NA|NA|0→2|0→0|2→3→4|
|v_chaser 雪原小妖|1/freeze|NA|NA|0→0|0→0|2→3→4|
|v_snowman 雪人|2/charge|NA|NA|0→4|0→0|2→4→4|
|v_mage 冰霜法师|3/freeze|NA|NA|0→0|0→0|2→4→3|
|v_shard 冰棱射手|2/freeze|NA|NA|0→7|0→0|2→4→4|
|v_sentinel 冰角战兽|3/freeze|NA|NA|1→10|0→0|4→4→4|
|v_rhyno 冰原巨犀|3/charge|NA|NA|6→18|0→0|4→4→4|
|v_conduit 寒潮之灵|4/freeze|NA|NA|0→4|0→0|3→4→4|
|v_keeper 寒冬守望者|4/freeze|NA|v_sentinel|0→12|0→0|4→4→4|
|v_drake 霜脊地龙|5/freeze|NA|NA|0→7|0→0|4→4→4|
|v_bear 冰河巨熊|4/physical|NA|NA|4→15|0→0|4→4→4|
|v_queen 霜冠执政官|6/freeze|NA|NA|2→12|0→0|4→4→4|
|v_wyvern 白霜巨龙|6/freeze|NA|NA|4→11|0→0|4→4→4|
|v_stag 凛风白鹿|5/charge|NA|NA|10→16|2→2|4→4→4|
|d_sentry 沙铠甲虫|1/physical|NA|NA|1→9|0→0|4→4→4|
|d_dune 沙丘行者|1/summon|d_artificer|NA|0→2|0→0|4→4→4|
|d_artificer 构装学徒|1/summon|d_dune|NA|0→4|0→0|3→4→4|
|d_howler 沙嚎者|2/summon|NA|a_seed|0→1|0→0|4→4→4|
|d_goldob 金焰方尖碑|2/summon|NA|NA|0→0|0→0|2→3→3|
|d_keeper 遗迹守卫|3/physical|NA|NA|0→5|0→0|3→4→4|
|d_obelisk 流沙方尖碑|3/prep|NA|NA|0→5|0→0|4→4→4|
|d_glass 镜沙猎蜥|2/physical|NA|NA|1→10|0→0|4→4→4|
|d_shriek 风啸隼|3/charge|a_chanter|NA|0→3|0→0|3→4→4|
|d_dunecaster 沙灵塑师|4/summon|a_nightmare|NA|0→6|0→0|4→4→4|
|d_sandblade 日轮刃使|4/charge|NA|NA|0→4|0→0|2→3→4|
|d_pyro 沙焰术士|5/prep|NA|NA|0→2|0→0|3→4→4|
|d_hourglass 沙漏构装|4/physical|NA|NA|1→10|0→0|4→4→4|
|d_pharaoh 沙域法老|6/physical|NA|n_marshal|4→5|0→0|4→4→4|
|d_onyx 黑曜豹神|6/charge|NA|NA|6→10|0→0|4→4→4|
|d_worm 黑沙巨虫|5/summon|NA|NA|3→6|0→0|4→4→4|
|n_merc 佣兵|1/prep|NA|NA|0→5|0→0|3→4→4|
|n_bulwark 铁甲卫士|1/armor|v_wall|NA|6→11|0→0|4→4→4|
|n_medic 战地医师|2/death|NA|NA|0→1|0→0|4→4→4|
|n_archer 游侠弓手|2/prep|NA|NA|0→1|0→0|3→4→4|
|n_gladiator 角斗士|1/duel|s_fox|NA|0→4|0→0|4→4→4|
|n_obelisk 方尖碑|3/prep|NA|NA|0→2|0→0|3→4→4|
|n_breaker 碎石兵|2/physical|NA|NA|3→16|0→0|3→4→4|
|n_thorn 棘背兽|3/physical|NA|NA|2→13|0→0|4→4→4|
|n_envoy 传令使|4/caster|NA|NA|0→4|0→0|4→4→4|
|n_tether 换位术士|3/rotate|NA|NA|0→2|0→0|2→2→4|
|n_ritualist 祭仪师|4/death|NA|NA|0→0|0→0|4→4→4|
|n_echo 回响祭司|5/prep|NA|NA|0→2|0→0|3→4→4|
|n_marshal 战阵指挥官|5/physical|NA|NA|3→16|0→0|4→4→4|
|n_alchemist 炼金术士|4/freeze|NA|NA|1→3|0→0|4→4→4|
|n_colossus 战争巨像|6/physical|NA|NA|8→17|0→0|4→4→4|
|n_paragon 落日灵驹|6/prep|NA|NA|0→11|0→0|4→4→4|

## 尚未证明

真实远征的同名获取、有限预算下培养分配与卖出替换、发动机未来收益回本和后程关卡压力不由本合成表证明。需要主责的合法远征/成长策略对照与本报告交叉；不根据此表单独改数值。
