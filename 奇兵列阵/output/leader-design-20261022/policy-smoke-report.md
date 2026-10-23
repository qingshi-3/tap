# 独立主将A/B策略准入与冻结（260局烟测）

本轮260局是before-0.8.3真实当前快照的独立策略验证，13将各10合法seed×A/B。不是旧visible-v2结果延续，不能把策略带来的变化称为核心候选效果。全局规则仍为真实招募/合并/购买/布阵/培养/自然被动选择；无广告、无资源/卡/被动注入，无胜负oracle。

0非法准入、0动作拒绝、0战斗fault、0相位guard。所有首四战各组40/40真胜（合计1040场），输/平/疲劳均0。全局仅原有首领三平截断保留，不伪造败局。readonly评分使用ownedId=-1描述候选卡，绝不写入RunState；真正单位仅由run API创建。

|主将|A / B通关（各10）|首四A/B输/平|首四疲劳A/B|全程疲劳战斗A/B|操作轨迹不同seed/10|
|---|---|---|---|---|---|
|argeon|1 / 1|0/0；0/0|0 / 0|37 / 34|10/10|
|zilan|3 / 5|0/0；0/0|0 / 0|14 / 12|10/10|
|kaleos|6 / 1|0/0；0/0|0 / 0|12 / 26|10/10|
|reva|2 / 0|0/0；0/0|0 / 0|33 / 27|10/10|
|lilithe|1 / 1|0/0；0/0|0 / 0|32 / 34|10/10|
|kasiva|1 / 2|0/0；0/0|0 / 0|26 / 19|10/10|
|vulkan|7 / 5|0/0；0/0|0 / 0|5 / 4|10/10|
|xingjiao|7 / 1|0/0；0/0|0 / 0|15 / 26|8/10|
|faie|3 / 1|0/0；0/0|0 / 0|38 / 34|10/10|
|kara|5 / 6|0/0；0/0|0 / 0|22 / 20|10/10|
|zirix|3 / 1|0/0；0/0|0 / 0|18 / 23|10/10|
|sajj|3 / 0|0/0；0/0|0 / 0|25 / 27|10/10|
|hank|2 / 0|0/0；0/0|0 / 0|33 / 19|10/10|

10seed只检查可执行与差异，不解释通关率显著性，不按此结果重调策略。星角两组8/10有自然决策分流，另2局没有分流条件，不故意用无意义动作制造差异。

## 实际评分与动作

- 基础值为实际个人攻血/装备/已培养的进攻能力×1.2 + 生存值×0.3 + 稀有度；护甲/复生进入生存，普通施法替代普攻，伤害/灼烧/召唤与伤害蓄力按声明值估计进攻。相同一星合并候选+9，持有二星+4；赫克B一星配对+13。可用持续输出不足2时，真实伤害候选+7。替换要高于可合法出售弱者3分，商店满仓换兵至少5分；不为打赢而调用simulate。
- 13将身份加分/自然被动优先序见leader-policy.ts，延续strategy-audit.md的A/B职责。伤害、装备价格和属性从所选核心模块读；未把候选新伤害常量写入策略。自然晋升只给当前r.promo中选项评分，不强制造被动。余韵无伤害施法者、冰封无蓄力者、双祭队伍不足、纯色不符A方向等会降权；不是每项都按同一id硬选。
- 主副输出保底且使用真实当前属性；先铺5战位再萨吉预备。萨吉B仅自然待命且有伤害蓄力者时，在不损失两个输出的前提下交换入储备。卡雷奥斯按自然首发/压轴位置布置可见承担者；卡西瓦不主动献祭唯一持续输出；星角保留至少一条龙在场。
- 培养攻击集中主/副两个物理核并随已投入递减，血/挡兼顾前排与脆输出；法强给实际施法承担者或确实受益主将。候选优先调用canTrainGeneral/generalPowerSources，旧快照按相同已知实际语义判断，旧版也不故意乱投。无去处的点保留stash。
- 装备按边际职责分配，仅填合法空装备位；不靠不断换装备制造循环。真实训练后再布阵一次，让新装备和培养改变承担者判断。赫克只有真实佣兵高于可售弱者至少4分才腾位，长约B必须自然拥有、够3金且值得持有。

## 烟测机会指标

萨吉324战无预备+未铺满场组合；星角有龙在场241战，龙备战0战。赫克A205战中44次雇用、35战临时兵上场，B169战中53次雇用、43战临时兵上场；满仓未雇仍有161/116战，属于收益阈值下保留成熟单位，不宣称佣兵百分百利用。临时兵已签约后不会仍标temp，temp上场数不等于所有已雇上场数。

观察工具保存每战准入/机会/兑现、首领首次/重打、首四、life、已分配与未用培养、疲劳；只有首样本首领边界或20+拍战斗才重放record。无record时兑现事件是null而非0。详细边界日志在baseline-policy-smoke-boundaries.json，其余有metrics与机会结构。

## 自然被动实际选择（次数，不是胜率）

|主将/策略|自然选中的被动次数|
|---|---|
|argeon/A|argeon_4×4、argeon_3×7、argeon_2×4、argeon_1×3|
|argeon/B|argeon_4×5、argeon_3×6、argeon_2×3、argeon_1×3|
|zilan/A|zilan_1×5、zilan_2×5、zilan_4×2、zilan_3×4|
|zilan/B|zilan_4×7、zilan_2×3、zilan_1×7、zilan_3×6|
|kaleos/A|kaleos_4×4、g_horde×1、kaleos_1×6、g_wall×1、g_revive×2、kaleos_3×5、g_ember×1、kaleos_2×1、g_elite×1、g_haste×1|
|kaleos/B|kaleos_4×6、kaleos_3×5、kaleos_2×5、kaleos_1×5|
|reva/A|reva_1×8、reva_3×6、reva_4×5、reva_2×7|
|reva/B|reva_1×5、reva_3×4、reva_4×5、reva_2×3|
|lilithe/A|lilithe_4×5、lilithe_1×4、lilithe_3×3、lilithe_2×6|
|lilithe/B|lilithe_4×5、lilithe_3×6、lilithe_2×6、lilithe_1×5|
|kasiva/A|kasiva_1×5、kasiva_3×5、kasiva_2×5、kasiva_4×5|
|kasiva/B|kasiva_1×5、kasiva_3×7、kasiva_2×6、kasiva_4×5|
|vulkan/A|vulkan_4×8、vulkan_2×7、vulkan_3×10、vulkan_1×5|
|vulkan/B|vulkan_4×7、vulkan_1×7、vulkan_2×7、vulkan_3×3|
|xingjiao/A|xingjiao_1×5、xingjiao_3×6、xingjiao_2×5、xingjiao_4×7|
|xingjiao/B|xingjiao_1×7、xingjiao_3×4、xingjiao_2×5、xingjiao_4×7|
|faie/A|g_core×1、faie_2×6、g_haste×1、faie_1×7、faie_4×2、g_wall×1、g_horde×1、g_breach×1、g_morale×1|
|faie/B|faie_3×3、faie_2×2、faie_1×4、faie_4×5|
|kara/A|kara_3×7、g_morale×2、kara_2×7、g_haste×1、g_revive×1、kara_4×5、g_wall×2、g_ember×2、g_drill×1、g_elite×1|
|kara/B|kara_3×7、kara_2×10、kara_4×6、kara_1×4|
|zirix/A|zirix_3×5、zirix_2×5、zirix_4×4、zirix_1×5|
|zirix/B|zirix_3×6、zirix_1×6、zirix_4×5、zirix_2×4|
|sajj/A|sajj_1×7、sajj_3×7、sajj_2×4、sajj_4×5|
|sajj/B|sajj_4×3、sajj_3×5、sajj_1×6、sajj_2×1|
|hank/A|hank_3×6、hank_2×8、hank_4×6、hank_1×7|
|hank/B|hank_1×6、hank_3×3、hank_4×5、hank_2×5|

## 冻结与后续

policy-freeze.json与policy-freeze/保存全部策略/观察/runner源SHA256，后续runner有冻结守卫，策略变动会拒绝开跑。候选不应为追通关率改策略。同固定合法seed保证开局可配对；候选晋升改为2专属+1通用会消耗不同RNG、改变之后候选，因此配对不等于后程draft一致，也不能归因某个单独被动。

按主责授权接下来只启动冻结当前基线13×50×A/B=1300局；候选等待整套验证通过通知。类型验证针对冻结before-0.8.3模块图通过。当前工作区全量tsc当时遇到其他Agent在改的UI语法和run可空字段，未据此改越界文件，也不以烟测声称整个产品构建通过。
