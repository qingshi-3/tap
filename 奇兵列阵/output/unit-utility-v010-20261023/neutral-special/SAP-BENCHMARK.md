# SAP 对标：16张普通中立与关键特殊输出

来源：本地output/archetype-density-20261022/sap/pets-extracted.json与Turtle/Golden/Unicorn既有分类；原页面 https://groundedsap.co.uk/Pets.aspx ，2026-10-22社区快照，游戏补丁号未核实。不是官方当前补丁声明。优先Turtle，必要时逐个借Golden/Unicorn事件接口，不把三包180张合并成玩家单局卡池。

所有referencePets的name/tier/pack/ability均从原快照取值，并核对对应包classification成员。表内英文是快照完整精确文本，只含已抽取的一档描述，不外推二/三级参数、perk、toy或mana内部规则。SAP tier与我方shop tier不是同一开放日程，不能一阶对一阶直接换数字；同价3金币也不等于培养、等级、商店资源与战斗结算相同。

对标用于检验可得资源、事件、选靶、位置和窗口，不替代本游戏实测。延续现有16卡判定（7保留9调整），没有因SAP有同类就改成保留，也未因缺直接同义强行重做。传令240战与召唤/嘲讽探针全部沿用，不重跑或修改产品。

## 逐卡参照

### n_merc 佣兵（1阶，保留 P3）

- **Beaver / 1阶 / Turtle**：`Sell: Give two random friends +1 attack.`
- **Otter / 1阶 / Turtle**：`Buy: Give one random friend +1 health.`

比较：Beaver在出售时给两个随机友军各1攻，Otter购买给一随机友军1血；佣兵把买入自身攻与卖出最低攻友军连在一张3/5卡。是交易入口复合，不是Beaver的原数值复刻。

适配：保留低阶买入能战、出售能转交的生命周期；我方确定选靶降低随机性，必须计入适配差异。能力成长与培养事件独立，不能把买卖所得攻当train再递归奖励。

平衡含义：当前一星购入4/5同时保留出售收益，需防成为每局无条件最优起手；现保留P3，参考支持职责而非宣称已完全平衡。

### n_bulwark 铁甲卫士（1阶，保留 P3）

- **Gorilla / 6阶 / Turtle**：`Hurt: Gain Coconut perk. Works 1 time per turn.`
- **Turtle / 4阶 / Turtle**：`Faint: Give Melon perk to the nearest friend behind.`

比较：没有直接等价的低阶固有护甲宠物参照。Gorilla是六阶Hurt获得Coconut且限1次；Turtle四阶亡语把Melon交给身后。它们只说明防护与触发/位置有成本，不证明一阶护甲应等于任何perk。

适配：护甲逐段减伤、嘲讽、格挡与SAP perk不换算。卫士一阶固有护甲+出售首血，是低阶承伤和退出桥梁；与冰墙重复度须在本游戏池内判断。

平衡含义：保留P3；不以Gorilla六阶为由把卫士升六阶或照抄perk。嘲讽全队拦截造成反击错配也不是SAP护甲能解决。

### n_medic 战地医师（2阶，调整 P2）

- **Otter / 1阶 / Turtle**：`Buy: Give one random friend +1 health.`
- **Flamingo / 2阶 / Turtle**：`Faint: Give the two nearest friends behind +1 attack and +1 health.`

比较：Otter一阶买入给1血；Flamingo二阶亡语给后方两友军各1攻1血。医师二阶买入给队首1血、亡语只治疗队首3，后者可能落在满血后继而空转。新增最大血与治疗缺血不能等量比较。

适配：复用购买过渡+有位置条件的亡语支援结构，需为治疗寻找真实受伤者；不把最大血增益说成SAP治疗，亦不据总数判3治疗低于两次1/1。

平衡含义：仍调整P2，先修治疗对象/死亡时机后验数值。SAP参照加强了其低阶过渡定位，不能支持医师占位到后期。

### n_archer 游侠弓手（2阶，调整 P2）

- **Crocodile / 5阶 / Turtle**：`Start of battle: Deal 8 damage to the last enemy.`
- **Beaver / 1阶 / Turtle**：`Sell: Give two random friends +1 attack.`

比较：Crocodile五阶开战直接打最后敌人8，Beaver一阶出售转攻；弓手二阶2/4重复狙击并出售养队尾1/1，是持续后排进攻兼退出，不是Crocodile开战必达伤害。

适配：借鉴点杀明确目标和买卖生命周期；本游戏有嘲讽拦截狙击且需排到行动，SAP开战点杀的兑现不可直接套。

平衡含义：保持调整P2；不因SAP鳄鱼五阶就抬二阶弓手伤害，也不因机制低阶就认定它持续留场有价值。应核同期开局尾部击杀阈值。

### n_gladiator 角斗士（1阶，调整 P1）

- **Rabbit / 3阶 / Turtle**：`Friendly ate food: Give them +1 health. Works 3 times per turn.`
- **Seal / 5阶 / Turtle**：`Eats food: Give three random friends +1 attack.`
- **Peacock / 2阶 / Turtle**：`Hurt: Gain +3 attack.`

比较：Rabbit三阶友军吃食物给该友军1血限3次；Seal五阶自己吃食物给三随机友军1攻；Peacock二阶受伤自+3攻。它们各绑定明确事件，不能把“得到任意属性”当统一成长事件。角斗士是自己净提交培养后额外1/1，每备战一次，且有决斗。

适配：食物和培养只在有成本的投入事件层可比；受伤则属于战斗风险事件，非培养同义。沿用已测ownedId去重：atk/block培养都可触发，a_imp出售给攻不发train；不新增无来源属性奖励递归。

平衡含义：调整P1首先补每备战限1次与事件边界。当前没有证据支持从Peacock受伤收益直接改成角斗士每受伤成长，或每加一点培养重复1/1。

### n_obelisk 方尖碑（3阶，调整 P1）

- **Dragon / 6阶 / Turtle**：`Tier 1 friend bought: Give friends +1 attack and +1 health. Works 4 times per turn.`
- **Catfish / 6阶 / Golden**：`Start of turn: Activate Buy ability on the nearest friend ahead once, or give it +4 health.`

比较：Dragon六阶买一阶友军给friends1/1限4次；Golden Catfish六阶启动身前Buy能力或给4血。它们用明确交易输入和可识别受益者连接经济；方尖碑三阶要卖其他施法者，却把法强给最低攻击友军，可能完全不受益。

适配：借鉴交易引擎必须既有资源输入也有有效输出；SAP这些文本不含我方“法强”，不能抄1/1当1法强或把猫鱼当出售触发。

平衡含义：维持调整P1：先约束法术受益目标/展示输出，再算卖卡净成本。Dragon高阶全队成长也不证明三阶任意法强卖卡引擎平衡。

### n_breaker 碎石兵（2阶，保留 P3）

- **Deer / 4阶 / Turtle**：`Faint: Summon one 5/3 Bus with Chili.`
- **Skunk / 4阶 / Turtle**：`Start of battle: Remove 33% health from the highest health enemy.`

比较：Deer四阶亡语产带Chili的5/3 Bus，Skunk四阶开战移除最高血敌33%生命。碎石兵二阶是普攻溅射后削甲，两参照分别只对应邻后伤害输出和针对耐久弱化；没有直接等价破甲文本。

适配：不能外推Chili内部数值，也不能把移除生命当伤害或削甲。保留先打再削、光环甲不削的我方契约，让后续同目标攻击兑现团队收益。

平衡含义：保持保留P3，仅证明需要独立破甲入口；数值仍由我方甲公式/先伤后削/敌阵决定，不与Skunk百分比机械换算。

### n_thorn 棘背兽（3阶，保留 P3）

- **Blowfish / 4阶 / Turtle**：`Hurt: Deal 3 damage to one random enemy.`
- **Camel / 3阶 / Turtle**：`Hurt: Give the nearest friend behind +1 attack and +2 health.`

比较：Blowfish四阶受伤打随机敌3；Camel三阶受伤给最近身后友军1攻2血。两者都要求承伤机会。棘背兽三阶反击只普攻直接命中、格挡亦触发、连击逐段，与Hurt扣血路径不同。

适配：SAP位置链提示承伤输入必须可安排；我方全队嘲讽优先会让后排巨像截走队首棘背兽的普攻，破坏这一输入。不能把Hurt和反击合并或加数值来修失去输入。

平衡含义：保留反击身份P3，优先调整/呈现嘲讽范围和负协同；SAP反应型卡也不是无条件好，需保证可控承伤与收益对象。

### n_envoy 传令使（4阶，调整 P1）

- **Parrot / 4阶 / Turtle**：`End turn: Copy ability from the nearest pet ahead as level 1 until next turn.`
- **Tiger / 6阶 / Turtle**：`The friend ahead repeats their ability in battle as if they were level 1.`
- **Catfish / 6阶 / Golden**：`Start of turn: Activate Buy ability on the nearest friend ahead once, or give it +4 health.`

比较：Parrot四阶备战结束复制身前能力为一级到下回合；Tiger六阶让身前友军战斗中重复能力且按一级；Golden Catfish六阶启动身前Buy能力。均不是增加完整常规行动或让最高攻立即普攻，没有直接行动同义参照。

适配：借鉴复制/放大的确定位置、技能范围与等级预算，不能把Tiger一条重复能力等同我方二次施法+积蓄力+轮换的完整行动。当前最高攻击选靶常偏离低攻法师，SAP位置复制也不能作为原样套用许可。

平衡含义：维持调整P1；复用240战：148预算95实行动、41冻损、11先死、1结束，新增25施法/10蓄力但55给非预定核心。若保留完整行动须改善目标/四阶回报；若回立即追击则与三阶影舞去重，不凭SAP Tiger六阶直接调阶。

### n_tether 换位术士（3阶，保留 P2）

- **Door Head Ant / 2阶 / Golden**：`Empty front space: Jump to the front and gain +4 health in battle.`
- **Emu / 5阶 / Golden**：`Empty front space: Give nearest friend ahead +4 health and move it to the front in battle.`
- **Kangaroo / 2阶 / Turtle**：`Friend ahead attacks: Gain +1 attack and +1 health.`

比较：Golden Door Head Ant二阶前位空时跳首并获4战内血；Emu五阶前位空时给最近身前4血并把其移到最前；Turtle Kangaroo二阶响应身前攻击。它们分别是补位和邻位链，不等于将现有队首送尾的整队轮换。

适配：借鉴有实际条件的队列空间价值；我方队首事件、轮换和施法行动轮需独立核算。当前换位术士三阶一星没有额外数值，若阵型不适配会暴露脆皮。

平衡含义：保留P2条件用途；无直接等价轮换不代表必须重做，必须靠真实新队首收益与避伤证明占位价值。

### n_ritualist 祭仪师（4阶，调整 P1）

- **Whale / 4阶 / Turtle**：`Start of battle: Swallow the nearest friend ahead and release it at level 1 on faint.`
- **Flamingo / 2阶 / Turtle**：`Faint: Give the two nearest friends behind +1 attack and +1 health.`
- **Ant / 1阶 / Turtle**：`Faint: Give one random friend +1 attack and +1 health.`

比较：Whale四阶开战吞身前并在自身亡语以一级释放；Flamingo/Ant是被触发的亡语收益。祭仪师四阶每次施法主动杀身前、只给其他最高攻1攻，没有鲸鱼的延后释放承诺。

适配：可借鉴吞噬/亡语触发链，但要保留祭品归属和后继资源：主动阵亡并不等于可回收存入。不能以存在Whale就认定反复拆队换1攻合理；复生/亡语增益仍按现队伍真实计。

平衡含义：仍调整P1，需强亡语/复生前置与祭品预览，核每次献祭净价值。SAP参照不支持把任何普通队友视为廉价燃料。

### n_echo 回响祭司（5阶，调整 P2）

- **Fish / 1阶 / Turtle**：`Level-up: Give two friends +1 attack and +1 health.`
- **Penguin / 4阶 / Turtle**：`Start of turn: Give two level 2 or higher friends +1 attack and +1 health.`
- **Team Spirit / 6阶 / Unicorn**：`Friend level-up: Give friends +1 attack and +1 health.`

比较：Fish一阶自己Level-up给两友军1/1；Penguin四阶每回合给两名至少二级友军1/1；Unicorn Team Spirit六阶友军升星给friends1/1。回响五阶需其他友军真实升星却仅给来源相邻各1攻，一星纯事件收益且不常驻每轮自动增长。

适配：区分自己升星、已经高等级的自动每轮输入、友军升星三种事件。最直接触发参照是Team Spirit，但跨包mana/经验经济不能合池比较；只抄其事件结构，不猜二三级数值。

平衡含义：仍调整P2：五阶晚入手、边位单邻、未来副本事件稀缺。不能只因SAP有六阶友军升星卡就为回响当前输出辩护；优先调窗口或即时用途。

### n_marshal 战阵指挥官（5阶，调整 P2）

- **Dodo / 3阶 / Turtle**：`Start of battle: Give 50% of attack to the nearest friend ahead.`
- **Leopard / 6阶 / Turtle**：`Start of battle: Deal 50% attack damage to one random enemy.`
- **Monkey / 5阶 / Turtle**：`End turn: Give front-most friendly pet +2 attack and +2 health.`

比较：Dodo三阶开战把50%攻击给最近身前；Leopard六阶开战按50%自身攻击打随机敌；Monkey五阶每回合给最前友军2/2。指挥官五阶一星开战首2/2+首回合1行动，是小固定增益+行动预算，未像Dodo/Leopard自动继承大核心攻击规模，也不是Monkey持续永久育成。

适配：借鉴开战收益要即时可兑且随投入有可说明的比例/窗口；我方额外行动仍需等与冻结检查，不能等同开战直接攻击。没有SAP直接“一次完整行动”的同义。

平衡含义：保持调整P2。比Monkey少未来育成依赖是优点，但仅给2/2与单次预算不能凭新五阶名义认定值得换已有支持；需要首次合法入手对照，不能照搬50%或给无限行动。

### n_alchemist 炼金术士（4阶，保留 P2）

- **Hedgehog / 2阶 / Turtle**：`Faint: Deal 2 damage to ALL pets.`
- **Cuttlefish / 4阶 / Golden**：`Faint: Remove 3 health from the last enemy and make it Inked.`
- **Vampire Bat / 5阶 / Unicorn**：`Enemy gained ailment: Deal 4 damage to it and gain damage as health. Works 2 times per battle.`

比较：Hedgehog二阶亡语对ALL宠物2伤含友军；Golden Cuttlefish四阶亡语移除最后敌3血并施Inked；Unicorn Vampire Bat五阶敌得异常时伤4并吸收该伤害为血、限2次。炼金四阶亡语全敌灼烧1+下行动者寒意2，是双状态启动，没有自伤与直接点杀同义。

适配：对标的是一次亡语能开启后续状态引擎，不直接换算伤害/移血/灼烧/寒意。不能外推Inked具体效果，也不能把移血视作Hurt触发；我方2寒意不保证冻结。

平衡含义：条件保留P2：四阶可从8起见，真正价值在死亡后尚有交锋与联动，不依赖未来升星；需防后排太晚死或放逐封锁。SAP有低阶强亡语不等于所有亡语都平衡。

### n_colossus 战争巨像（6阶，保留 P2）

- **Boar / 6阶 / Turtle**：`Before attack: Gain +4 attack and +2 health.`
- **Gorilla / 6阶 / Turtle**：`Hurt: Gain Coconut perk. Works 1 time per turn.`

比较：Boar六阶每次攻击前自+4攻2血；Gorilla六阶受伤获得Coconut限1次。两者一星已在战斗内提供成长或防护；巨像六阶7/14只有嘲讽溅射，纯当前身材/目标拦截，没有相同成长效果。

适配：以一星首次入手比较立即形成的战斗角色，不用三星身材为六阶辩护。SAP perk具体减免未在本快照给出，不能换算甲或挡。巨像重投退款培养可行，但要失去旧前排护甲/不可转移growth，还会截断反击输入。

平衡含义：保留内容身份P2只是条件购买，并非六阶平衡通过；SAP两例强化了检查即时回报的要求。没有本游戏首见配对，不贸然抄Boar增长；若实际不能替换成熟前排，优先调阶/定位。

### n_paragon 落日灵驹（6阶，调整 P1）

- **Team Spirit / 6阶 / Unicorn**：`Friend level-up: Give friends +1 attack and +1 health.`
- **Dragon / 6阶 / Turtle**：`Tier 1 friend bought: Give friends +1 attack and +1 health. Works 4 times per turn.`
- **Monkey / 5阶 / Turtle**：`End turn: Give front-most friendly pet +2 attack and +2 health.`

比较：最接近触发的是Unicorn六阶Team Spirit：友军升星给friends1/1；Turtle六阶Dragon买一阶友军给friends1/1限4次；五阶Monkey每回合稳定给首2/2。灵驹六阶一星友军升星仅首2攻尾3血，触发资源稀缺但非毫无总量。

适配：比较同样晚入手的真实输入数量/可购买资源和覆盖对象；友军升星不等于每买一个一阶，自动每轮更非同一事件。三个包经济不混用，未提供升级档位不猜。

平衡含义：继续调整P1：No14开放10%权重后最多8备战编号不是16次合法升星；1星仅靠罕见事件需证明回本。SAP存在同类六阶不替我方卡背书，优先开放窗口/即时用途，别机械上调最大星数值。

## 40特殊定义只作关键差异，不逐敌硬配SAP

- t_shade/t_dervish/t_bonelet等亡语后继，可借Turtle Cricket（1阶：`Faint: Summon one 1/1 Cricket.`）、Sheep（3阶：`Faint: Summon two 2/2 Rams.`）检验“主体死后仍留下多少有效战力”。我方亡语召唤继承死者剩余常规行动、普通召唤通常当回合不行动，SAP快照没有对应我方行动轮的文字，不能据SAP召唤成功数就算我方完成首动。
- t_wolf/t_flame/t_drakelet的延迟兑现与SAP Turkey（5阶：`Friend summoned: Give it +3 attack and +1 health.`）、Horse（1阶：`Friend summoned: Give it +1 attack until next turn.`）只在“召唤后有支持链”上可比。我方孵化看守还授当回合行动资格，是另一资源；现有5探针说明预算0/1，controlled证据说明保护只局部提高狼首动，不等于所有token应立即动。
- t_night/t_statue本身可在首动前嘲讽承伤，不能照纯输出召唤物计零收益；但全队嘲讽可能夺走n_thorn承伤，与SAP Camel/Blowfish位置承伤链不是同一目标系统。t_statue不行动，即使孵化看守+继承也仍0行动。
- t_wisp当前无生成者，不因SAP有某种反伤token就推定可获取。7个旧主将专属按旧档生成条件/孵化前占位评价，不纳入普通招募强度表；SAP召唤物同样不并入60张可抽包来扩大密度。
- e_exile禁亡语/复生、e_silencer与e_frostq冻结、三首领阶段规则都是我方固定敌阵出题。SAP此数据是可构筑pet列表，不是固定关卡敌人采购能力曲线，不能强配22个敌定义到22只宠物。现敌阵prep钩子失效/缺寒意输入需要修本游戏敌阵契约，SAP某宠物有成长能力不能补上敌方根本不会发生的备战事件。
- SAP Hedgehog明确ALL含双方，Cuttlefish明确remove health，Peacock明确Hurt；我方灼烧无视挡甲、反击格挡也触发、onHurt扣血且存活才响应，各自有不同失败路径。所有伤害/移血/受击/反击/状态事件不可合成同一触发总数。

## 关键结论

低阶买卖/亡语过渡有成熟参照，但只说明生命周期可借鉴；不是把每个触发都叠一张卡就更好。角斗士须绑定真实有成本的培养事件和限次，不能让买卖增益递归触发。传令没有SAP完整行动直接等价，位置明确的复制类只帮助提出目标与技能预算问题。五六阶尤其要看一星即战价值和剩余可触发资源：SAP六阶也有战内即刻循环与交易放大，不支持我方仅用未来少量升星或三星上限维持高阶。
