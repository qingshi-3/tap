# SAP 单包构筑密度对照

结论：Turtle 的重点不是把60张平均分成很多互斥小流派，而是用较密集的召唤/亡语、受伤、食物和买卖接口连接多个低阶入口与中高阶兑现。较小的直接伤害族也有早中晚连续角色。Golden 把号角与召唤/阵亡紧密搭在一起；Unicorn 把 mana、异常、等级与跳位做成跨族接口。三个包不能合成180张大卡池后与我方单局池比较。

## 来源与分类边界

- 来源：[Grounded SAP 社区宠物数据库](https://groundedsap.co.uk/Pets.aspx)，2026-10-22抓取；补丁号未确认，不称官方最新。原始 `grounded-pets.html` 与解析 `pets-extracted.json` 均保留。
- 只取 `rollable=true` 且 `packs` 含指定包的记录。Turtle、Golden、Unicorn 各60张，每阶10张；不纳入召唤物和其他扩展包。抽到的单位产生的衍生物作为能力输出分析，不重复计入60。
- 人工逐条读180张ability，主职责只归一类，跨族接口另记；社区archetypes/categories仅作对照，不直接映射。例：Rat不是伤害型受伤发动机；Macaque的实际文本是开战召唤；Grizzly Bear按友军攻击次数输出伤害；Parrot/Tiger属于可复制多种机制的放大器，不能单独当点杀卡。
- 本次只以已解析的ability单段文本为证据，不外推未提供的星级升级数值、perk或toy内部效果。移除生命不自动等同伤害或触发Hurt，二者只在宽“伤害/移血输出”轴合并。
- 主职责按“主要投入/产出的循环”判断，不按第一个触发词判断。Cow虽Buy触发，主要价值是食物供应；Nurse Shark虽打伤害，主要循环是号角消耗；Chimera虽召唤，主要兑现mana。因此以下主表严格互斥，跨族表有重叠。
- “其他成长/等级”含经验与等级接口，不全是永久攻血。Murmel收益到下回合；Ogopogo与Salmon of Knowledge是战内经验。战斗内增益与长期成长不可互换计数。

## 互斥主职责：每包总计60

|主职责|Turtle|Golden|Unicorn|
|---|---:|---:|---:|
|召唤/亡语|16|15|4|
|受伤引擎|8|2|0|
|直接伤害/点杀|8|5|4|
|食物支持|7|1|0|
|买卖/经济/刷新|6|14|5|
|其他成长/等级|6|3|10|
|状态/资源/道具|2|15|29|
|战斗增益/位置/复制|7|5|8|
|总计|60|60|60|

大类状态/资源需进一步看真实接口：Golden有13张号角接口，Unicorn有15张mana接口、13张异常接口；这些是可重叠角色数，不能加起来声称28个互斥资源卡。

## Turtle：按阶段检查闭环

|构筑族|低阶1–2：入口|中阶3–4：支持/转接|高阶5–6：兑现|闭环判断|
|---|---|---|---|---|
|召唤/亡语|Cricket/Spider补单位，Horse给召唤临时攻击；Ant/Flamingo是死亡增益|Sheep/Deer多段接力，Dog/Ox吃召唤或阵亡，Whale存储释放|Turkey强化新召唤，Fly补位，Shark吃阵亡，Rooster/Mammoth兑现面板|入口、延长次数、收益放大均有；死亡增益卡不全是召唤源|
|受伤|Hedgehog主动制造全场伤害，Peacock吃受伤|Elephant重复打后方友军；Camel把受伤换后排增益，Blowfish把受伤换伤害|Armadillo加双方血量延长受伤空间，Gorilla防护，Wolverine把多人受伤兑现为全体移血|低阶有输入与受益，中阶可形成2–3卡循环；Armadillo也增敌血，不能只算正收益|
|直接伤害|Mosquito提供开战小伤|Dolphin打最低血、Skunk压最高血、Badger按面板打邻位|Crocodile打后排，Leopard面板换伤害，Snake吃前方攻击次数，Rhino击杀连锁|不是单一卡名族：按目标/面板/攻击/击杀存在不同输入；可接召唤或高攻面板|
|食物|Pigeon出售出免费食物，Worm供应低价食物|Rabbit增加吃食物收益，Squirrel压食物成本|Cow供免费奶，Seal把单次吃食物转队友收益，Cat放大食物攻血|单位生产/降价/放大明确；更关键输入来自池外食物货架，不能把7张看作全支持|
|买卖/经济|Otter购买加血，Beaver/Duck出售改面板，Pig出售回金，Swan加预算|可与场外召唤、食物供应及重复升级转接；不要求每阶都有一张“买卖核心”|Dragon用买1阶单位触发全队成长，Cow同时提供场外食物收益|低阶动作本身就是可复用输入；高阶Dragon重新赋予低阶卡用途，但经济/栏位成本仍存在|
|其他成长/等级|Fish升级团队收益，Snail以败局条件补攻|Giraffe定向成长；Bison需要3级队友，Penguin需要2级队友|Monkey集中前排成长；面板也能供给Rooster/Leopard等|不是孤立的“加数字”：等级条件、集中/分散与面板转输出决定兼容性|
|通用战术/复制|Crab复制血量、Kangaroo吃前方攻击|Dodo传攻击，Parrot复制前方能力，Hippo击杀滚动|Tiger重复战内能力；Boar攻击前自增益|Parrot/Tiger可补较小流派密度，不应在每族重复当成独立专属卡|

Turtle“召唤/亡语16张”不等于16张召唤源：严格可产生友军单位的文本只有7张（包括Whale释放存储单位）；Rat产生的是对手单位，另列，不混为己方供给。Ant、Flamingo、Mammoth是死亡增益，Ox、Shark是友军阵亡收益。这样拆开，才能判断是缺入口、缺承接还是缺兑现。

## 扩展包对照

**Golden：** Groundhog/Black Necked Stilt提供低阶号角，Pied Tamarin/Squid早期就能消费；Guineafowl把受伤接号角，Osprey衍生Groundhog把召唤接资源，Saiga把多次阵亡接号角；Nurse Shark/Wildebeest将其兑现为伤害/防护。号角13接口与召唤输出9张有交叉，不是两个完全隔离小池。经济方面Lemming/Magpie提供低阶收入/延后预算，Meerkat按支出给战内收益，Cockatoo/Blue Ringed Octopus用购买变成长，Catfish重播购买，Bird of Paradise吃花钱，Oyster提供出售预算。Silkmoth/Crane是受伤反应支持，但只有5个“受伤输入/受益”接口（含Manatee主动自伤），不能因社区Hurt标签少就当整个体系没有受伤联动。这里没有Turtle那样密集的纯食物发动机；不能默认每个包都必须复刻相同主族分布。

**Unicorn：** Alchemedes/Thunderbird提供早期mana，Pengobble放大；Gargoyle/Calygreyhound已有低中阶消耗端，Chimera/Pixiu/Sea Serpent等提供不同兑现。Barghest/Question Marks/Frost Wolf提供早期异常，Mothman提前受益，Unicorn把友方异常转成长，Vampire Bat把敌方异常转伤害/吸血，Manticore放大。Tsuchinoko/Ogopogo/Salmon提供战内经验，Wyvern/Cyclops/Team Spirit提供等级收益；不能把全部经验接口当永久升星投入。Bunyip/Ouroboros/Worm of Sand/Yeti把刷新动作接面板或自动选购；Mana Hound又把刷新接mana，Nessie把刷新接召唤。小型召唤族虽互斥主类只有4张，实际有6个召唤输出接口，且Amalgamation能给召唤攻/mana/异常，从而接到包内主资源。跳位6接口也有低阶执行者、中阶伤害与后期永久增益，不能只看角色数小就断言断档。

## 池外支持与不可直接等同之处

1. SAP有独立食物货架、可附加perk和包内道具系统。食物提供属性、触发“吃食物”及其他作用，不消耗单位池中的一个宠物定义名额；部分食物可直接触发死亡类效果或提供额外作战能力，但本次未逐一抓取食物表，不将具体食物数量/数值计入任何统计。Turtle的7张食物主职责不是只有7个食物支持来源。
2. Cuddle Toad/Griffin/Bad Dog会产出不同toy集合，属于独立道具内容。当前宠物文本未列出道具完整效果，故只计3个生产接口，不把未展开toy当已核实的召唤/伤害/成长卡。Bear/Fur-Bearing Trout产出的perk亦未在本宠物文本展开，保守只记perk来源，不直接按社区标签计作召唤或mana来源。
3. 本文只分析能力依赖关系和六阶分布，不核对当前商店概率、食物货架容量、回合解锁、全包对战环境或数值平衡。SAP本体成长、经验、敌方阵列战斗与我方行动制不同；不能把其一张攻击/食物收益换算成我方一张单位/一点法强。
4. 可比较的是：同一池的入口/支持/兑现覆盖，输入能否反复出现，同一动作是否跨族兼容，以及池外接口是否补了单位密度。不能只比较标签总数或把不同包、召唤物、道具加总成超密大池。

## 跨游戏可比轴：非互斥的显式结构覆盖

主职责表不能直接映射到我方：Badger在此主归伤害，另一游戏的类似单位可能主归亡语。为避免把SAP宽泛标签与我方严格核心数量混比，另给以下两轴。它们衡量“能力文本出现明确输入/输出接口”，不代表独立流派核心，也不代表同轴任意两卡能组配方。

- **A 死亡/复生/己方召唤结构**：自身阵亡触发、友军阵亡触发、主动使友军死亡或复活、直接产生或存储释放己方单位、响应友军召唤。排除仅击杀或敌方死亡、仅泛用复制/重复、仅受伤、仅自身进场获perk。
- **B 长期成长/交易资源接口**：场外或明确永久属性/经验成长，购买/出售/花费/产金币/刷新/商店改造，食物或道具生产及受益。纯战内短暂面板、只发战内经验、纯战斗mana/号角不计；转金币或明确读取刷新次数则计“资源相关”，但不能称永久成长。

|单包|A结构覆盖|B成长/交易资源|A与B同时覆盖|
|---|---:|---:|---:|
|Turtle|19/60|19/60|0|
|Golden|30/60|19/60|3|
|Unicorn|17/60|22/60|4|

Golden的A=30含大量Faint→号角/异常/金币接口，**不是30张召唤核心**。Turtle的Rat因自身Faint入A，但其衍生物属于敌方，不计己方召唤供给；Scorpion仅自己进场拿perk保守排除，若把所有自身进场触发都算A，则Turtle=20，必须双方同步改口径。B里Bunyip/Meerkat等是经济动作换战内收益，不能以B=19/22声称同数永久面板发动机。

**Turtle 完整可比轴名单**

- A（19）：Ant、Cricket、Horse、Flamingo、Hedgehog、Rat、Spider、Badger、Dog、Ox、Sheep、Deer、Turtle、Whale、Rooster、Shark、Turkey、Fly、Mammoth。
- B（19）：Beaver、Duck、Fish、Otter、Pig、Pigeon、Snail、Swan、Worm、Giraffe、Rabbit、Bison、Penguin、Squirrel、Cow、Monkey、Seal、Cat、Dragon。

**Golden 完整可比轴名单**

- A（30）：Groundhog、Pied Tamarin、Lizard、Sea Turtle、Sea Urchin、Squid、Stoat、Bear、Flea、Flying Fish、Musk Ox、Osprey、Surgeon Fish、Weasel、Cuttlefish、Falcon、Poison Dart Frog、Saiga Antelope、Slug、Vaquita、Beluga Whale、Fire Ant、Macaque、Nurse Shark、Nyala、Secretary Bird、Wolf、German Shepherd、Pteranodon、Warthog。
- B（19）：Chipmunk、Lemming、Magpie、Opossum、African Penguin、Hercules Beetle、Meerkat、Stoat、Baboon、Weasel、Cockatoo、Manatee、Manta Ray、Sealion、Beluga Whale、Blue Ringed Octopus、Bird of Paradise、Catfish、Oyster。

**Unicorn 完整可比轴名单**

- A（17）：Sneaky Egg、Bigfoot、Frost Wolf、Gargoyle、Calygreyhound、Fur-Bearing Trout、Skeleton Dog、Tatzelwurm、Chimera、Visitor、Amalgamation、Kitsune、Nessie、Pixiu、Cerberus、Hydra、Phoenix。
- B（22）：Baku、Bunyip、Cuddle Toad、Bigfoot、Wyvern、Griffin、Lucky Cat、Mana Hound、Ouroboros、Skeleton Dog、Abomination、Cyclops、Unicorn、Worm of Sand、Bad Dog、Loveland Frogman、Nessie、Pixiu、Behemoth、Quetzalcoatl、Team Spirit、Yeti。

## 明晰名单与复算

以下名单为互斥主表的全部成员；括号按阶级排列，合计各60。每卡crossRoles、stageRole、社区标签和原ability哈希在classification-*.json，统计由statistics.py复算并校验每阶10张。

### Turtle 主职责名单

- **召唤/亡语 16张**：1阶：Ant、Cricket、Horse；2阶：Flamingo、Rat、Spider；3阶：Dog、Ox、Sheep；4阶：Deer、Whale；5阶：Rooster、Shark、Turkey；6阶：Fly、Mammoth。
- **受伤引擎 8张**：2阶：Hedgehog、Peacock；3阶：Camel、Elephant；4阶：Blowfish；5阶：Armadillo；6阶：Gorilla、Wolverine。
- **直接伤害/点杀 8张**：1阶：Mosquito；3阶：Badger、Dolphin；4阶：Skunk；5阶：Crocodile、Rhino；6阶：Leopard、Snake。
- **食物支持 7张**：1阶：Pigeon；2阶：Worm；3阶：Rabbit；4阶：Squirrel；5阶：Cow、Seal；6阶：Cat。
- **买卖/经济/刷新 6张**：1阶：Beaver、Duck、Otter、Pig；2阶：Swan；6阶：Dragon。
- **其他成长/等级 6张**：1阶：Fish；2阶：Snail；3阶：Giraffe；4阶：Bison、Penguin；5阶：Monkey。
- **状态/资源/道具 2张**：4阶：Turtle；5阶：Scorpion。
- **战斗增益/位置/复制 7张**：2阶：Crab、Kangaroo；3阶：Dodo；4阶：Hippo、Parrot；6阶：Boar、Tiger。

### Golden 主职责名单

- **召唤/亡语 15张**：2阶：Lizard、Sea Turtle；3阶：Flying Fish、Musk Ox、Osprey；4阶：Falcon、Slug；5阶：Beluga Whale、Fire Ant、Macaque、Secretary Bird、Wolf；6阶：German Shepherd、Pteranodon、Warthog。
- **受伤引擎 2张**：1阶：Silkmoth；5阶：Crane。
- **直接伤害/点杀 5张**：2阶：Sea Urchin；3阶：Royal Flycatcher；4阶：Poison Dart Frog；6阶：Cobra、Grizzly Bear。
- **食物支持 1张**：1阶：Chipmunk。
- **买卖/经济/刷新 14张**：1阶：Lemming、Magpie、Opossum；2阶：African Penguin、Hercules Beetle、Meerkat、Stoat；3阶：Weasel；4阶：Cockatoo、Manta Ray；5阶：Blue Ringed Octopus；6阶：Bird of Paradise、Catfish、Oyster。
- **其他成长/等级 3张**：3阶：Baboon；4阶：Manatee、Sealion。
- **状态/资源/道具 15张**：1阶：Groundhog、Pied Tamarin；2阶：Black Necked Stilt、Squid；3阶：Bear、Flea、Guineafowl、Surgeon Fish；4阶：Cuttlefish、Saiga Antelope、Vaquita；5阶：Nurse Shark、Nyala；6阶：Highland Cow、Wildebeest。
- **战斗增益/位置/复制 5张**：1阶：Bulldog、Cone Snail、Goose；2阶：Door Head Ant；5阶：Emu。

### Unicorn 主职责名单

- **召唤/亡语 4张**：1阶：Sneaky Egg；5阶：Nessie；6阶：Cerberus、Hydra。
- **受伤引擎 0张**：。
- **直接伤害/点杀 4张**：2阶：Drop Bear；3阶：Tatzelwurm；4阶：Kraken、Tiger Bug。
- **食物支持 0张**：。
- **买卖/经济/刷新 5张**：1阶：Bunyip；2阶：Bigfoot；3阶：Ouroboros；4阶：Worm of Sand；6阶：Yeti。
- **其他成长/等级 10张**：1阶：Murmel；2阶：Ogopogo、Wyvern；3阶：Lucky Cat、Skeleton Dog；4阶：Cyclops；5阶：Salmon of Knowledge；6阶：Behemoth、Quetzalcoatl、Team Spirit。
- **状态/资源/道具 29张**：1阶：Alchemedes、Baku、Barghest、Cuddle Toad、Pengobble、Question Marks；2阶：Frost Wolf、Gargoyle、Mothman、Thunderbird；3阶：Calygreyhound、Fur-Bearing Trout、Griffin、Mana Hound、Mandrake；4阶：Chimera、Roc、Unicorn、Visitor；5阶：Amalgamation、Bad Dog、Kitsune、Pixiu、Red Dragon、Vampire Bat；6阶：Manticore、Phoenix、Sea Serpent、Sleipnir。
- **战斗增益/位置/复制 8张**：1阶：Tsuchinoko；2阶：Ghost Kitten、Jackalope；3阶：Brain Cramp；4阶：Abomination、Minotaur；5阶：Loveland Frogman、Werewolf。

## 必要跨族角色：有重叠，不与主表相加

|角色接口|Turtle|Golden|Unicorn|
|---|---:|---:|---:|
|实际召唤输出|7|9|6|
|召唤受益|3|3|1|
|友军阵亡受益|3|5|2|
|受伤输入或受益|9|5|0|
|直接伤害或移血输出|13|8|7|
|食物生产或受益|7|3|0|
|交易或经济接口|8|15|12|
|经验或等级接口|3|1|11|
|号角接口|0|13|0|
|mana接口|0|0|15|
|异常状态接口|0|3|13|
|位置跳跃接口|0|2|6|
|道具生产接口|0|0|3|

“实际召唤输出”包括场外Stoat与存储释放Whale等，不保证每张都是战内净增多个身体；“食物生产或受益”包括消费/复制perk等广义接口，不等于同一种食物成长配方。细分名单如下，避免只报数字：

### Turtle 跨族名单

- **实际召唤输出 7**：Cricket、Spider、Sheep、Deer、Whale、Rooster、Fly。
- **召唤受益 3**：Horse、Dog、Turkey。
- **友军阵亡受益 3**：Ox、Shark、Fly。
- **受伤输入或受益 9**：Hedgehog、Peacock、Badger、Camel、Elephant、Blowfish、Armadillo、Gorilla、Wolverine。
- **直接伤害或移血输出 13**：Mosquito、Hedgehog、Badger、Dolphin、Blowfish、Deer、Skunk、Crocodile、Rhino、Scorpion、Leopard、Snake、Wolverine。
- **食物生产或受益 7**：Pigeon、Worm、Rabbit、Squirrel、Cow、Seal、Cat。
- **交易或经济接口 8**：Beaver、Duck、Otter、Pig、Pigeon、Swan、Cow、Dragon。
- **经验或等级接口 3**：Fish、Bison、Penguin。

### Golden 跨族名单

- **实际召唤输出 9**：Lizard、Stoat、Osprey、Falcon、Slug、Beluga Whale、Macaque、Wolf、Pteranodon。
- **召唤受益 3**：Sea Turtle、Flying Fish、German Shepherd。
- **友军阵亡受益 5**：Musk Ox、Poison Dart Frog、Saiga Antelope、Secretary Bird、Pteranodon。
- **受伤输入或受益 5**：Silkmoth、Lizard、Guineafowl、Manatee、Crane。
- **直接伤害或移血输出 8**：Pied Tamarin、Sea Urchin、Royal Flycatcher、Cuttlefish、Poison Dart Frog、Nurse Shark、Cobra、Grizzly Bear。
- **食物生产或受益 3**：Chipmunk、Beluga Whale、Macaque。
- **交易或经济接口 15**：Chipmunk、Lemming、Magpie、Opossum、African Penguin、Hercules Beetle、Meerkat、Stoat、Weasel、Cockatoo、Manta Ray、Blue Ringed Octopus、Bird of Paradise、Catfish、Oyster。
- **经验或等级接口 1**：Flying Fish。
- **号角接口 13**：Groundhog、Pied Tamarin、Black Necked Stilt、Squid、Guineafowl、Osprey、Surgeon Fish、Saiga Antelope、Vaquita、Nurse Shark、Nyala、Highland Cow、Wildebeest。
- **异常状态接口 3**：Squid、Flea、Cuttlefish。
- **位置跳跃接口 2**：Door Head Ant、Emu。

### Unicorn 跨族名单

- **实际召唤输出 6**：Sneaky Egg、Chimera、Nessie、Cerberus、Hydra、Phoenix。
- **召唤受益 1**：Amalgamation。
- **友军阵亡受益 2**：Tatzelwurm、Kitsune。
- **直接伤害或移血输出 7**：Drop Bear、Calygreyhound、Tatzelwurm、Kraken、Tiger Bug、Vampire Bat、Sea Serpent。
- **交易或经济接口 12**：Bunyip、Cuddle Toad、Bigfoot、Griffin、Lucky Cat、Mana Hound、Ouroboros、Worm of Sand、Bad Dog、Nessie、Pixiu、Yeti。
- **经验或等级接口 11**：Murmel、Tsuchinoko、Ogopogo、Wyvern、Lucky Cat、Tatzelwurm、Cyclops、Minotaur、Salmon of Knowledge、Quetzalcoatl、Team Spirit。
- **mana接口 15**：Alchemedes、Pengobble、Gargoyle、Thunderbird、Calygreyhound、Mana Hound、Chimera、Cyclops、Roc、Amalgamation、Kitsune、Pixiu、Werewolf、Sea Serpent、Sleipnir。
- **异常状态接口 13**：Baku、Barghest、Question Marks、Frost Wolf、Mothman、Mandrake、Unicorn、Visitor、Amalgamation、Red Dragon、Vampire Bat、Manticore、Phoenix。
- **位置跳跃接口 6**：Tsuchinoko、Drop Bear、Jackalope、Brain Cramp、Tiger Bug、Loveland Frogman。
- **道具生产接口 3**：Cuddle Toad、Griffin、Bad Dog。

## 可比结论

Turtle把少数核心循环做成六阶连续链，再由复制、面板成长与独立食物扩展复用。Golden/Unicorn并非各自拥有更多互斥流派，而是让资源/触发事件连接多个输出端。对我方更有用的检查不是“某标签有几张”，而是：低阶是否能成2–3卡循环、下一阶是否有可替换支持、后期兑现是否保留低阶输入用途、通用放大器是否真实兼容，以及全阵营开放后这些接口的可得性。本文不代替我方独立统计，也不据此宣称哪包或我方更强。
