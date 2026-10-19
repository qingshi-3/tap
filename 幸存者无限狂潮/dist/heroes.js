// Stable content IDs are retained across the researched combat redesign.
export const SKILL_DEFINITIONS=Object.freeze({
  "dash": {
    "id": "dash",
    "animation": "attack",
    "name": "风行突进",
    "description": "沿指向短冲，刀身扫过沿路敌人；可朝空处撤离，不自动回头追怪。",
    "cooldown": 5,
    "aimType": "dash",
    "jobs": [
      "fighter",
      "swift_blade",
      "blade_master"
    ],
    "level": 1
  },
  "cleave": {
    "id": "cleave",
    "animation": "attack",
    "name": "裂空斩",
    "description": "一次前方重劈；满势时消耗剑势，改为上挑接砸地，重敌不能浮空但照常受伤。",
    "cooldown": 8,
    "aimType": "cone",
    "jobs": [
      "fighter",
      "swift_blade",
      "blade_master"
    ],
    "level": 1
  },
  "guard": {
    "id": "guard",
    "animation": "cast",
    "name": "回风乱舞",
    "description": "本体连续旋斩，可用移动方向带着旋斩清出路，获得有限减伤，结束不强行退回原位。",
    "cooldown": 12,
    "aimType": "circle",
    "jobs": [
      "fighter",
      "blade_master",
      "swift_blade"
    ],
    "level": 1
  },
  "swordField": {
    "id": "swordField",
    "animation": "cast",
    "name": "回风乱舞",
    "description": "本体连续旋斩，可用移动方向带着旋斩清出路，获得有限减伤，结束不强行退回原位。",
    "cooldown": 18,
    "aimType": "circle",
    "jobs": [
      "blade_master"
    ],
    "level": 3
  },
  "bladeWave": {
    "id": "bladeWave",
    "animation": "attack",
    "name": "裂空斩",
    "description": "一次前方重劈；满势时消耗剑势，改为上挑接砸地，重敌不能浮空但照常受伤。",
    "cooldown": 10,
    "aimType": "cone",
    "jobs": [
      "blade_master"
    ],
    "level": 5
  },
  "whirlwind": {
    "id": "whirlwind",
    "animation": "attack",
    "name": "回风乱舞",
    "description": "本体连续旋斩，可用移动方向带着旋斩清出路，获得有限减伤，结束不强行退回原位。",
    "cooldown": 12,
    "aimType": "circle",
    "jobs": [
      "fighter",
      "swift_blade",
      "blade_master"
    ],
    "level": 1
  },
  "quickCut": {
    "id": "quickCut",
    "animation": "attack",
    "name": "风行突进",
    "description": "沿指向短冲，刀身扫过沿路敌人；可朝空处撤离，不自动回头追怪。",
    "cooldown": 6,
    "aimType": "dash",
    "jobs": [
      "swift_blade",
      "blade_master"
    ],
    "level": 5
  },
  "summonGuard": {
    "id": "summonGuard",
    "animation": "cast",
    "name": "军令集结",
    "description": "标记敌人，现存护卫奔过去集火；指向空地则集合护主，持续时间后恢复自主作战。",
    "cooldown": 8,
    "aimType": "line",
    "jobs": [
      "summoner",
      "summoner_master",
      "summoner_sovereign"
    ],
    "level": 1
  },
  "recallSummons": {
    "id": "recallSummons",
    "animation": "cast",
    "name": "灵骸爆破",
    "description": "一次引爆所指区域现有灵骸；无骸时发基础魂爆。每枚灵骸消费后消失，爆炸不是宠物普通攻击。",
    "cooldown": 12,
    "aimType": "circle",
    "jobs": [
      "summoner",
      "summoner_master",
      "summoner_sovereign"
    ],
    "level": 1
  },
  "summonElite": {
    "id": "summonElite",
    "animation": "cast",
    "name": "巨灵降临",
    "description": "召出一名短时巨盾统领，落地重砸、随后自主近战，常驻护卫仍在；无护卫也可施放。",
    "cooldown": 25,
    "aimType": "circle",
    "jobs": [
      "summoner",
      "summoner_master",
      "summoner_sovereign"
    ],
    "level": 1
  },
  "markBlade": {
    "id": "markBlade",
    "animation": "attack",
    "name": "影袭切入",
    "description": "冲向所指敌人身侧刺击，在出发处留一个返程影；目标过远只冲到安全射程末端，不自动补第二段。 返程影存在时再按同一技能返回，不重置首次冷却。",
    "cooldown": 2,
    "aimType": "dash",
    "jobs": [
      "blink",
      "blink_master",
      "blink_sovereign"
    ],
    "level": 1
  },
  "blinkStrike": {
    "id": "blinkStrike",
    "animation": "attack",
    "name": "归影脱身",
    "description": "有返程影就交换回去并销毁影；没有则朝拖指方向短退，沿路闪避普通碰撞。",
    "cooldown": 5,
    "aimType": "dash",
    "jobs": [
      "blink",
      "blink_master",
      "blink_sovereign"
    ],
    "level": 1
  },
  "blinkStorm": {
    "id": "blinkStorm",
    "animation": "attack",
    "name": "死印追猎",
    "description": "给一个目标挂死印，先有基础影刺，随后记录本体短窗口伤害，期满追加一次结算；不中断移动。",
    "cooldown": 18,
    "aimType": "circle",
    "jobs": [
      "blink",
      "blink_master",
      "blink_sovereign"
    ],
    "level": 1
  },
  "flameBreath": {
    "id": "flameBreath",
    "animation": "cast",
    "name": "焰息",
    "description": "一次施放维持短时火焰锥，可边移动边扫向面朝方向，近域敌人连续受灼烧，不要求长按。",
    "cooldown": 9,
    "aimType": "cone",
    "jobs": [
      "mage",
      "mage_master",
      "mage_sovereign"
    ],
    "level": 1
  },
  "rockWall": {
    "id": "rockWall",
    "animation": "cast",
    "name": "陨星天降",
    "description": "指定处落一颗陨石，落地冲击后留下短时燃烧坑；有明确从天落下、砸地和余火三段。",
    "cooldown": 22,
    "aimType": "circle",
    "jobs": [
      "mage",
      "mage_master",
      "mage_sovereign"
    ],
    "level": 1
  },
  "frostAura": {
    "id": "frostAura",
    "animation": "cast",
    "name": "霜环护身",
    "description": "身周瞬发冰霜新星，短冻结轻敌；Boss只减缓可减缓部分并正常承伤，不强行打断大招。",
    "cooldown": 12,
    "aimType": "self",
    "jobs": [
      "mage",
      "mage_master",
      "mage_sovereign"
    ],
    "level": 1
  },
  "grappleHook": {
    "id": "grappleHook",
    "animation": "attack",
    "name": "魔手勾袭",
    "description": "直伸一只魔手抓轻敌停在身前，持敌抵挡有限正面普通攻击；重敌抓不动时把自己短拉近后肘击，可拖指取消前不扣冷却。",
    "cooldown": 7,
    "aimType": "line",
    "jobs": [
      "brawler",
      "grappler",
      "titan_grappler"
    ],
    "level": 1
  },
  "grappleSlam": {
    "id": "grappleSlam",
    "animation": "attack",
    "name": "震地摔击",
    "description": "把持敌向前砸地后松手，近域伤敌；空手时是前踏上勾接重掌，Boss不被抬离原位。",
    "cooldown": 10,
    "aimType": "circle",
    "jobs": [
      "brawler",
      "grappler",
      "titan_grappler"
    ],
    "level": 1
  },
  "grappleClash": {
    "id": "grappleClash",
    "animation": "attack",
    "name": "魔手投杀",
    "description": "抓住现有持敌或前方首个轻敌，向指定方向大力投出，撞过沿路敌群后落地震击；空手为魔臂冲撞，不强位移Boss。",
    "cooldown": 18,
    "aimType": "cone",
    "jobs": [
      "brawler",
      "grappler",
      "titan_grappler"
    ],
    "level": 1
  },
  "riftGate": {
    "id": "riftGate",
    "animation": "attack",
    "name": "远门置换",
    "description": "在指定处布远门、本体旁留入口，普攻从远门射向近敌；再施放替换旧远门，只维护一对。",
    "cooldown": 7,
    "aimType": "circle",
    "jobs": [
      "rift_apprentice",
      "rift_weaver",
      "rift_sovereign"
    ],
    "level": 1
  },
  "riftStep": {
    "id": "riftStep",
    "animation": "attack",
    "name": "穿门步",
    "description": "本体穿到远门；无门则朝指向开一次性短门脱身，落点穿墙/危险重叠校验失败时落最近合法点。",
    "cooldown": 8,
    "aimType": "dash",
    "jobs": [
      "rift_apprentice",
      "rift_weaver",
      "rift_sovereign"
    ],
    "level": 1
  },
  "riftBarrage": {
    "id": "riftBarrage",
    "animation": "attack",
    "name": "界晶轰流",
    "description": "远门扩大，门后巨大晶核蓄一拍后放出持续直束；按施放指向贯穿，不需要先Q才能释放。",
    "cooldown": 18,
    "aimType": "line",
    "jobs": [
      "rift_apprentice",
      "rift_weaver",
      "rift_sovereign"
    ],
    "level": 1
  },
  "magnetField": {
    "id": "magnetField",
    "animation": "attack",
    "name": "磁场捕获",
    "description": "前方展开有限耐久捕弹板，接住的普通敌弹进额外弹仓；没有敌弹也有基础护盾，满仓或到时停止捕获。",
    "cooldown": 10,
    "aimType": "self",
    "jobs": [
      "scrap_apprentice",
      "magnet_master",
      "magnet_sovereign"
    ],
    "level": 1
  },
  "magnetLance": {
    "id": "magnetLance",
    "animation": "attack",
    "name": "磁轨轰击",
    "description": "发一枚基础拼装榴弹，命中爆炸；有捕获弹时一并作为破片向外炸出，消耗额外仓，空仓也能发。",
    "cooldown": 7,
    "aimType": "line",
    "jobs": [
      "scrap_apprentice",
      "magnet_master",
      "magnet_sovereign"
    ],
    "level": 1
  },
  "magnetCrush": {
    "id": "magnetCrush",
    "animation": "attack",
    "name": "机甲展开",
    "description": "零件在身体周围拼成重装枪架，普攻短时替换为可移动连射，连续命中逐步升温，结束拆回普通枪。",
    "cooldown": 18,
    "aimType": "self",
    "jobs": [
      "scrap_apprentice",
      "magnet_master",
      "magnet_sovereign"
    ],
    "level": 1
  },
  "swordFocus": {
    "id": "swordFocus",
    "animation": "cast",
    "name": "剑令集锋",
    "description": "本体挥斩后驱当前飞剑沿指向突刺一次，刺完归身；不能在低阶就变成永久远程自治群。",
    "cooldown": 8,
    "aimType": "circle",
    "jobs": [
      "sword_apprentice",
      "sword_adept",
      "sword_sage"
    ],
    "level": 1
  },
  "swordRecall": {
    "id": "swordRecall",
    "animation": "cast",
    "name": "回剑护身",
    "description": "当前飞剑直回本体切过沿路敌人，归位与本体一起横剑挡一次迎面普通攻击。",
    "cooldown": 10,
    "aimType": "line",
    "jobs": [
      "sword_apprentice",
      "sword_adept",
      "sword_sage"
    ],
    "level": 1
  },
  "swordUnion": {
    "id": "swordUnion",
    "animation": "cast",
    "name": "万剑归一",
    "description": "所有现有飞剑真实收齐，合为巨剑向目标竖劈，斩后拆回；合体期间原剑停止普通攻击。",
    "cooldown": 18,
    "aimType": "line",
    "jobs": [
      "sword_apprentice",
      "sword_adept",
      "sword_sage"
    ],
    "level": 1
  },
  "spiralOrb": {
    "id": "spiralOrb",
    "animation": "cast",
    "name": "旋丸牵引",
    "description": "抛丸命中或到指定点便停住，自转连续磨削、缓牵轻敌，结束爆开；Boss不被拉，但球不一穿而过。",
    "cooldown": 8,
    "aimType": "circle",
    "jobs": [
      "shadow_novice",
      "spiral_adept",
      "spiral_sage"
    ],
    "level": 1
  },
  "spiralClone": {
    "id": "spiralClone",
    "animation": "cast",
    "name": "侧影分身",
    "description": "留一名有生命的分身在指定侧位诱敌并投短丸，承担侧翼普攻；它会被击破或到期消失。",
    "cooldown": 11,
    "aimType": "circle",
    "jobs": [
      "shadow_novice",
      "spiral_adept",
      "spiral_sage"
    ],
    "level": 1
  },
  "spiralConvergence": {
    "id": "spiralConvergence",
    "animation": "cast",
    "name": "巨丸破阵",
    "description": "本体托举巨丸向移动方向推进，接触面连续碾压，前方有限减伤；结束向前压落爆开，不留下持续驻场球。",
    "cooldown": 20,
    "aimType": "line",
    "jobs": [
      "shadow_novice",
      "spiral_adept",
      "spiral_sage"
    ],
    "level": 1
  },
  "petalSweep": {
    "id": "petalSweep",
    "animation": "cast",
    "name": "散华布刃",
    "description": "扇面投实体花瓣刃，穿敌后扎在敌群后方，先造成投射伤害，再成为E素材。",
    "cooldown": 7,
    "aimType": "line",
    "jobs": [
      "petal_apprentice",
      "petal_dancer",
      "petal_sovereign"
    ],
    "level": 1
  },
  "petalPierce": {
    "id": "petalPierce",
    "animation": "cast",
    "name": "回羽牵刃",
    "description": "所有地面花刃直飞回当前本体位置，沿途穿敌；同敌被足量实体刃命中短定身，召回后旧刃消失。",
    "cooldown": 9,
    "aimType": "self",
    "jobs": [
      "petal_apprentice",
      "petal_dancer",
      "petal_sovereign"
    ],
    "level": 1
  },
  "petalBloom": {
    "id": "petalBloom",
    "animation": "cast",
    "name": "千花羽舞",
    "description": "本体短时腾空，躲普通接触与可躲直击，向前落一大片花刃；落地后召回才能收割，不自动消费所有刃。",
    "cooldown": 18,
    "aimType": "self",
    "jobs": [
      "petal_apprentice",
      "petal_dancer",
      "petal_sovereign"
    ],
    "level": 1
  }
});
const RAW_HEROES=[
  {
    "id": "commander",
    "kind": "base_commander",
    "name": "风刃指挥官",
    "shortName": "风刃",
    "subtitle": "近斩蓄势",
    "description": "近身打出剑势，再选择继续持势作战或拔刀兑现；伤害主体始终是玩家本人。",
    "color": "#74e6d4",
    "job": "fighter",
    "skills": [
      "dash",
      "cleave",
      "whirlwind"
    ],
    "passive": "近身打出剑势，再选择继续持势作战或拔刀兑现；伤害主体始终是玩家本人。"
  },
  {
    "id": "summoner",
    "kind": "base_summoner",
    "name": "契灵使",
    "shortName": "契灵",
    "subtitle": "近战护卫",
    "description": "有生命的常驻军团负责作战，本体抽魂供灵骸，主动决定集火、批量尸爆和军团大招。",
    "color": "#9cdb91",
    "job": "summoner",
    "skills": [
      "summonGuard",
      "recallSummons",
      "summonElite"
    ],
    "passive": "有生命的常驻军团负责作战，本体抽魂供灵骸，主动决定集火、批量尸爆和军团大招。"
  },
  {
    "id": "blink",
    "kind": "base_blink",
    "name": "瞬印行者",
    "shortName": "瞬印",
    "subtitle": "本体短刃背刺",
    "description": "优先击杀一个危险目标，留下撤退影，决定何时回去；不铺锚点网络。",
    "color": "#f0b56a",
    "job": "blink",
    "skills": [
      "markBlade",
      "blinkStrike",
      "blinkStorm"
    ],
    "passive": "优先击杀一个危险目标，留下撤退影，决定何时回去；不铺锚点网络。"
  },
  {
    "id": "mage",
    "kind": "base_mage",
    "name": "元素法师",
    "shortName": "元素",
    "subtitle": "跳跃电弧",
    "description": "自动电击随晋升长成落雷，冰霜自保控场，陨星连续爆发。",
    "color": "#91bdf2",
    "job": "mage",
    "skills": [
      "flameBreath",
      "frostAura",
      "rockWall"
    ],
    "passive": "自动电击随晋升长成落雷，冰霜自保控场，陨星连续爆发。"
  },
  {
    "id": "grappler",
    "kind": "hero_grappler_1",
    "name": "魔手斗士",
    "shortName": "魔手",
    "subtitle": "连拳击退",
    "description": "抓来敌人、拿在手里当盾和武器，再掷向后排；免抓敌人走真实近身重击。",
    "color": "#e4a276",
    "job": "brawler",
    "skills": [
      "grappleHook",
      "grappleSlam",
      "grappleClash"
    ],
    "passive": "抓来敌人、拿在手里当盾和武器，再掷向后排；免抓敌人走真实近身重击。"
  },
  {
    "id": "rift",
    "kind": "hero_rift_1",
    "name": "界门术士",
    "shortName": "界门",
    "subtitle": "门后秘弹",
    "description": "用一对门改变攻击出发点与撤离位置，从异界出口释放重火力；不经营多门连线。",
    "color": "#b19eea",
    "job": "rift_apprentice",
    "skills": [
      "riftGate",
      "riftStep",
      "riftBarrage"
    ],
    "passive": "用一对门改变攻击出发点与撤离位置，从异界出口释放重火力；不经营多门连线。"
  },
  {
    "id": "magnet",
    "kind": "hero_magnet_1",
    "name": "磁械师",
    "shortName": "磁械",
    "subtitle": "铆钉枪",
    "description": "迎住一小段敌弹把它收进弹仓，再将零件拼成随身武器；纯近战关也有基础供给。",
    "color": "#8bcad9",
    "job": "scrap_apprentice",
    "skills": [
      "magnetField",
      "magnetLance",
      "magnetCrush"
    ],
    "passive": "迎住一小段敌弹把它收进弹仓，再将零件拼成随身武器；纯近战关也有基础供给。"
  },
  {
    "id": "sword",
    "kind": "hero_sword_1",
    "name": "御剑修士",
    "shortName": "御剑",
    "subtitle": "挥剑带出剑",
    "description": "实体剑自主出击，召回护身，合剑爆发；三阶本体不再有普通挥剑。",
    "color": "#8bcde6",
    "job": "sword_apprentice",
    "skills": [
      "swordFocus",
      "swordRecall",
      "swordUnion"
    ],
    "passive": "实体剑自主出击，召回护身，合剑爆发；三阶本体不再有普通挥剑。"
  },
  {
    "id": "spiral",
    "kind": "hero_spiral_1",
    "name": "旋丸影者",
    "shortName": "旋丸",
    "subtitle": "单手短丸",
    "description": "旋丸自动清群，分身诱敌协同；巨丸托举推进并在高阶脱手滚压、侧路包抄。",
    "color": "#efb578",
    "job": "shadow_novice",
    "skills": [
      "spiralOrb",
      "spiralClone",
      "spiralConvergence"
    ],
    "passive": "旋丸自动清群，分身诱敌协同；巨丸托举推进并在高阶脱手滚压、侧路包抄。"
  },
  {
    "id": "petal",
    "kind": "hero_petal_1",
    "name": "花刃使",
    "shortName": "花刃",
    "subtitle": "单刃穿敌扎根",
    "description": "把花瓣刀片种到敌人后方，走位改变回收角度，再一次收割；保留霞的种羽召回骨架。",
    "color": "#e99bbe",
    "job": "petal_apprentice",
    "skills": [
      "petalSweep",
      "petalPierce",
      "petalBloom"
    ],
    "passive": "把花瓣刀片种到敌人后方，走位改变回收角度，再一次收割；保留霞的种羽召回骨架。"
  }
];
export const HEROES=Object.freeze(RAW_HEROES.map(h=>Object.freeze({...h,skills:Object.freeze(h.skills.map((id,i)=>Object.freeze({key:['Q','E','R'][i],id,name:SKILL_DEFINITIONS[id].name,description:SKILL_DEFINITIONS[id].description})))})));
export const HERO_JOBS=Object.freeze({
  "fighter": {
    "id": "fighter",
    "heroId": "commander",
    "kind": "base_commander",
    "name": "战士",
    "tier": 1,
    "trialId": null,
    "questId": null,
    "benefit": "近斩蓄势。近身横斩、重劈交替，真实命中蓄剑势；满势自动以重斩兑现。",
    "description": "沿指向短冲，刀身扫过沿路敌人；可朝空处撤离，不自动回头追怪。 本体连续旋斩，可用移动方向带着旋斩清出路，获得有限减伤，结束不强行退回原位。",
    "mainProgression": true
  },
  "blade_master": {
    "id": "blade_master",
    "heroId": "commander",
    "kind": "general_commander",
    "name": "风刃剑圣",
    "tier": 3,
    "trialId": "blade-trial",
    "questId": "ascend-commander-3",
    "benefit": "满势拔出巨型灵刃。命中蓄成巨型灵刃，宽面重挥与剑浪自动接续，普攻自己完成蓄势和重斩循环。",
    "description": "冲刺本身变为本体带刀的旋钻突进，沿途卷开侧边轻敌，终点保留风墙；满势使用巨刃，不能变成自动跳敌。 旋斩期间拔出巨型灵刃，每轮向面朝方向甩出短龙卷；带着旋斩清出一条通路。",
    "mainProgression": true
  },
  "swift_blade": {
    "id": "swift_blade",
    "heroId": "commander",
    "kind": "general_swift",
    "name": "迅刃",
    "tier": 2,
    "trialId": "swift-trial",
    "questId": "ascend-commander-2",
    "benefit": "连段出剑气。近斩连段的第三击甩出直线剑气，本体保持近战，命中仍供剑势；首次获得中距离补伤。",
    "description": "冲刺后向前推出一道短风墙，拨开轻敌并截断一次迎面普通弹，留下可通过的缺口。 旋斩增加近侧牵引，把擦到的轻敌带入刀口；旋转时仍可移动，重敌只承伤。",
    "mainProgression": true
  },
  "summoner": {
    "id": "summoner",
    "heroId": "summoner",
    "kind": "base_summoner",
    "name": "契灵使",
    "tier": 1,
    "trialId": null,
    "questId": null,
    "benefit": "近战护卫。本体抽魂弹命中敌人，常驻近战护卫自主挥击；抽魂达到固定轮次便生成一枚灵骸，Boss也产骸。",
    "description": "一次引爆所指区域现有灵骸；无骸时发基础魂爆。每枚灵骸消费后消失，爆炸不是宠物普通攻击。 召出一名短时巨盾统领，落地重砸、随后自主近战，常驻护卫仍在；无护卫也可施放。",
    "mainProgression": true
  },
  "summoner_master": {
    "id": "summoner_master",
    "heroId": "summoner",
    "kind": "general_summoner",
    "name": "契灵统御者",
    "tier": 2,
    "trialId": "summoner-trial",
    "questId": "ascend-summoner-2",
    "benefit": "盾卫加远程矛卫。常驻队伍改为盾卫在前、矛卫在后投掷，本体仍抽魂产骸；低武器档就能看出远近分工。",
    "description": "灵骸变为短时奔跑魂火，自动扑向区域内最近敌人才炸，解决敌群离开尸体位置的问题。 统领带现存护卫冲过指定敌群，沿途真实撞击，冲完继续自主作战；不是原地召唤只加属性。",
    "mainProgression": true
  },
  "blink": {
    "id": "blink",
    "heroId": "blink",
    "kind": "base_blink",
    "name": "瞬印行者",
    "tier": 1,
    "trialId": null,
    "questId": null,
    "benefit": "本体短刃背刺。本体短刀自动刺前方近敌；从目标侧后命中有明显拔刀重击，正面仍完整伤敌。",
    "description": "冲向所指敌人身侧刺击，在出发处留一个返程影；目标过远只冲到安全射程末端，不自动补第二段。 返程影存在时再按同一技能返回，不重置首次冷却。 给一个目标挂死印，先有基础影刺，随后记录本体短窗口伤害，期满追加一次结算；不中断移动。",
    "mainProgression": true
  },
  "blink_master": {
    "id": "blink_master",
    "heroId": "blink",
    "kind": "general_blink",
    "name": "瞬印宗师",
    "tier": 2,
    "trialId": "blink-trial",
    "questId": "ascend-blink-2",
    "benefit": "残影复演攻击。本体刺后，一个短寿命攻击影在原出刀位置延迟复演；它不追怪，玩家移动能留下第二个攻击起点。",
    "description": "刺击后留一个只重放本次刺击的攻击影，本体可立即走开，敌人转身会被延迟补刀。返程影与攻击影外形不同。 返程影存在时再按同一技能返回，不重置首次冷却。返回处留下短时诱敌假身。 死印把已有近战复演改为追到标记目标身侧补刀，解决普通复演留原地可能打空的问题；目标提前死亡便兑现并返还部分Q冷却。",
    "mainProgression": true
  },
  "mage": {
    "id": "mage",
    "heroId": "mage",
    "kind": "base_mage",
    "name": "元素法师",
    "tier": 1,
    "trialId": null,
    "questId": null,
    "benefit": "跳跃电弧。指尖电弧命中一个敌人并跳向邻敌，瞬时链击无飞行弹；孤立敌人正常承受主击，不需另找目标。",
    "description": "身周瞬发冰霜新星，短冻结轻敌；Boss只减缓可减缓部分并正常承伤，不强行打断大招。 指定处落一颗陨石，落地冲击后留下短时燃烧坑；有明确从天落下、砸地和余火三段。",
    "mainProgression": true
  },
  "mage_master": {
    "id": "mage_master",
    "heroId": "mage",
    "kind": "general_mage",
    "name": "元素贤者",
    "tier": 2,
    "trialId": "mage-trial",
    "questId": "ascend-mage-2",
    "benefit": "电弧击出分叉电火。电弧首次命中会放出沿地滚动的短电火；电弧管近敌跳跃，电火向前补远处空档，单目标也看得到第二载体。",
    "description": "保留新星，冻结敌人在标记期间死亡会在原处再爆小新星，把逃生窗口传向下一排；最多传一轮。 改为前导冰彗星先落减缓轻敌，再由火陨石接砸，形成可见冰火两拍；Boss免冻但两次落击都能命中。",
    "mainProgression": true
  },
  "brawler": {
    "id": "brawler",
    "heroId": "grappler",
    "kind": "hero_grappler_1",
    "name": "拳斗士",
    "tier": 1,
    "trialId": null,
    "questId": null,
    "benefit": "连拳击退。左右拳交替，第三拳推开首个轻敌；Boss受重拳，位置不变。",
    "description": "直伸一只魔手抓轻敌停在身前，持敌抵挡有限正面普通攻击；重敌抓不动时把自己短拉近后肘击，可拖指取消前不扣冷却。 抓住现有持敌或前方首个轻敌，向指定方向大力投出，撞过沿路敌群后落地震击；空手为魔臂冲撞，不强位移Boss。",
    "mainProgression": true
  },
  "grappler": {
    "id": "grappler",
    "heroId": "grappler",
    "kind": "hero_grappler_2",
    "name": "魔手斗士",
    "tier": 2,
    "trialId": null,
    "questId": "job-grappler-2",
    "benefit": "拳后自动短抓抛敌。第三拳自动短抓近敌、向前短抛，撞到前排后松手；主动Q已有持敌时普攻用空手出拳，绝不偷用人质。",
    "description": "抓手改为宽弧捞入，沿路被抓者碰撞旁敌，最后成为身前盾；重敌分支短突进带肩撞。 先把持敌抡一整圈扫开包围，再掷向后排；落地点产生沿地扩张的冲击，玩家不随投物飞进危险区。",
    "mainProgression": true
  },
  "titan_grappler": {
    "id": "titan_grappler",
    "heroId": "grappler",
    "kind": "hero_grappler_3",
    "name": "巨擘战将",
    "tier": 3,
    "trialId": null,
    "questId": "job-grappler-3",
    "benefit": "双魔臂持敌扫打。双魔臂自动搏击，空手第三击抓一敌向两侧扫过再松手；Q持敌时对应手只护盾，由另一臂或踢击输出。",
    "description": "两只魔手分别抓前方两侧轻敌，左右各占一个真实持敌槽；一侧没有目标就空着，不复制人质。 两只魔手把一到两名持敌举高，以交错落点先后掼向目标区域，第二击落在第一击震开的敌群后排；无持敌用双巨掌完成相同落点，保留冲击范围。",
    "mainProgression": true
  },
  "rift_apprentice": {
    "id": "rift_apprentice",
    "heroId": "rift",
    "kind": "hero_rift_1",
    "name": "折光学徒",
    "tier": 1,
    "trialId": null,
    "questId": null,
    "benefit": "门后秘弹。秘弹穿近门从远门发出，无门从本体直射，普通敌人不挡掉整次攻击；远门朝向可改变覆盖。",
    "description": "在指定处布远门、本体旁留入口，普攻从远门射向近敌；再施放替换旧远门，只维护一对。 远门扩大，门后巨大晶核蓄一拍后放出持续直束；按施放指向贯穿，不需要先Q才能释放。",
    "mainProgression": true
  },
  "rift_weaver": {
    "id": "rift_weaver",
    "heroId": "rift",
    "kind": "hero_rift_2",
    "name": "界门术士",
    "tier": 2,
    "trialId": null,
    "questId": "job-rift-2",
    "benefit": "门后蓄放光炮。每轮先在门后可见蓄光，再射一发短促贯穿光炮；无门用本体小入口完成，光炮与一阶飞行秘弹明显不同。",
    "description": "远门展开时先横向裂开扫敌，随后可短时跟随所选精英移动；指空地仍固定，不强制追敌。 巨晶核放束时缓慢转向所标敌人，目标死亡则转下一个；扫过的整段都是实际伤害，失目标仍完成原方向射击。",
    "mainProgression": true
  },
  "rift_sovereign": {
    "id": "rift_sovereign",
    "heroId": "rift",
    "kind": "hero_rift_3",
    "name": "界门主宰",
    "tier": 3,
    "trialId": null,
    "questId": "job-rift-3",
    "benefit": "门后持续扫射。门后晶核直接维持短射击窗，连续束随远门朝向缓转追敌；射击结束有短冷却，不变永续无脑全屏激光。",
    "description": "展开时保留裂界扫击，入口可在短窗口吞过门的轻敌送到远门前，一敌仅一次；Boss不传送，只承受门沿切击。 远门从圆框展开为宽裂口，主束两侧晶核轮流向敌群扫射；主束继续压制强敌，两侧束清近邻，Q可重置整座出口位置一次。",
    "mainProgression": true
  },
  "scrap_apprentice": {
    "id": "scrap_apprentice",
    "heroId": "magnet",
    "kind": "hero_magnet_1",
    "name": "拾铁匠",
    "tier": 1,
    "trialId": null,
    "questId": null,
    "benefit": "铆钉枪。铆钉枪向近敌发射金属钉，基础射击不耗捕获弹；弹仓为空也不停攻。",
    "description": "前方展开有限耐久捕弹板，接住的普通敌弹进额外弹仓；没有敌弹也有基础护盾，满仓或到时停止捕获。 零件在身体周围拼成重装枪架，普攻短时替换为可移动连射，连续命中逐步升温，结束拆回普通枪。",
    "mainProgression": true
  },
  "magnet_master": {
    "id": "magnet_master",
    "heroId": "magnet",
    "kind": "hero_magnet_2",
    "name": "磁械师",
    "tier": 2,
    "trialId": null,
    "questId": "job-magnet-2",
    "benefit": "穿透磁轨枪。枪体展开磁轨，单发短蓄力穿甲弹贯穿敌列，开火声和短回座代替铆钉的连续点射；不继承旧武器Ⅲ。",
    "description": "捕弹板展开成环绕本体的磁片，接住不同方向的有限普通弹；到时把捕获弹留在可见仓内供下一招，不自动反射掉。 枪架增加双肩榴炮，主枪持续压制、肩炮隔拍轰炸目标后方，保留走位；捕获弹使首轮立刻升温，不能多复制一份仓。",
    "mainProgression": true
  },
  "magnet_sovereign": {
    "id": "magnet_sovereign",
    "heroId": "magnet",
    "kind": "hero_magnet_3",
    "name": "磁极武装者",
    "tier": 3,
    "trialId": null,
    "questId": "job-magnet-3",
    "benefit": "跟随身体的回转炮架。回转炮架围着身体转动，连续发金属弹，持续命中把枪管烧亮并在轮末打一发热弹；炮架不离体自主寻敌。",
    "description": "环绕磁片保留，正面额外合出重盾，把捕获弹压成弹芯；盾满或到时放一阵向前排斥波清近敌并关闭捕获，保存弹芯。 拼成可移动的攻城甲，连续枪火积热后自动折出大口径主炮；满热时自动开炮，甲态结束后余热消散。",
    "mainProgression": true
  },
  "sword_apprentice": {
    "id": "sword_apprentice",
    "heroId": "sword",
    "kind": "hero_sword_1",
    "name": "剑修学徒",
    "tier": 1,
    "trialId": null,
    "questId": null,
    "benefit": "挥剑带出剑。本体近斩带一把飞剑直刺后归身；剑随挥剑出手，角色本身仍是主要近域输出。",
    "description": "当前飞剑直回本体切过沿路敌人，归位与本体一起横剑挡一次迎面普通攻击。 所有现有飞剑真实收齐，合为巨剑向目标竖劈，斩后拆回；合体期间原剑停止普通攻击。",
    "mainProgression": true
  },
  "sword_adept": {
    "id": "sword_adept",
    "heroId": "sword",
    "kind": "hero_sword_2",
    "name": "御剑修士",
    "tier": 2,
    "trialId": null,
    "questId": "ascend-sword-2",
    "benefit": "近斩配双剑分工。本体近斩，两把实体飞剑自动寻找近敌刺击；武器成长后扩大自主出击范围。",
    "description": "回剑短时绕身形成真实护卫剑，轮流斩近敌与拦有限普通弹；结束恢复自主寻敌。 巨剑劈入地面后向前犁开一条裂地斩，主打成列敌群，走完拆回；不额外保留第一段后再造第二把剑。",
    "mainProgression": true
  },
  "sword_sage": {
    "id": "sword_sage",
    "heroId": "sword",
    "kind": "hero_sword_3",
    "name": "御剑真君",
    "tier": 3,
    "trialId": null,
    "questId": "ascend-sword-3",
    "benefit": "无本体平A的自治剑群。一把自治实体剑，速度260，自动寻敌、穿击、回航；本体没有平A动作与伤害，两个主动只修改剑的任务。",
    "description": "自治剑按当前位置回收成随移动前置的剑幕，可拦有限普通弹；拦截后该剑立刻反刺发弹敌人一次再回幕，非全屏删弹。 合成巨剑悬在身前短时自主重斩，可随玩家移动继续向近敌劈扫，结束一次裁落拆剑；改变为一段可带着走的巨剑作战窗口。",
    "mainProgression": true
  },
  "shadow_novice": {
    "id": "shadow_novice",
    "heroId": "spiral",
    "kind": "hero_spiral_1",
    "name": "旋丸学徒",
    "tier": 1,
    "trialId": null,
    "questId": null,
    "benefit": "单手短丸。单手投一枚小旋丸，撞敌立即爆散，完全不驻场、不吸敌，弹体与冲击短而利落。",
    "description": "留一名有生命的分身在指定侧位诱敌并投短丸，承担侧翼普攻；它会被击破或到期消失。 本体托举巨丸向移动方向推进，接触面连续碾压，前方有限减伤；结束向前压落爆开，不留下持续驻场球。",
    "mainProgression": true
  },
  "spiral_adept": {
    "id": "spiral_adept",
    "heroId": "spiral",
    "kind": "hero_spiral_2",
    "name": "旋丸影者",
    "tier": 2,
    "trialId": null,
    "questId": "ascend-spiral-2",
    "benefit": "双手连射夹击。左右手错拍投两丸，第一丸推开轻敌少许，第二丸从另一侧切入爆散，形成一个两拍攻击周期。",
    "description": "两侧分身诱敌并投短丸，本体下次普攻触发每影一次控制丸协同；复制不再产生复制。 巨丸先由本体推行，终段脱手继续向前滚压，本体恢复自由走位；分身可沿两侧补推，死光也能完整施放。",
    "mainProgression": true
  },
  "spiral_sage": {
    "id": "spiral_sage",
    "heroId": "spiral",
    "kind": "hero_spiral_3",
    "name": "群影仙者",
    "tier": 3,
    "trialId": null,
    "questId": "ascend-spiral-3",
    "benefit": "风刃旋丸碰撞展开。投出带旋转风刃的小丸，命中后短暂展开一圈实体风刃再碎裂；不驻场磨削、不拉敌。",
    "description": "指挥现有分身跃到指定侧翼，重新诱敌并准备下一次普攻协同；缺员才补召，巨丸期间参与两侧夹击。 本体推行巨丸，现存分身持小推进丸从两侧包抄；末段沿真实路径向前夹击后终爆。",
    "mainProgression": true
  },
  "petal_apprentice": {
    "id": "petal_apprentice",
    "heroId": "petal",
    "kind": "hero_petal_1",
    "name": "花刃学徒",
    "tier": 1,
    "trialId": null,
    "questId": null,
    "benefit": "单刃穿敌扎根。单片花刃穿过首敌，在其后方扎根；投出时就伤敌，不能为了攒召回让普攻没有正常收益。",
    "description": "所有地面花刃直飞回当前本体位置，沿途穿敌；同敌被足量实体刃命中短定身，召回后旧刃消失。 本体短时腾空，躲普通接触与可躲直击，向前落一大片花刃；落地后召回才能收割，不自动消费所有刃。",
    "mainProgression": true
  },
  "petal_dancer": {
    "id": "petal_dancer",
    "heroId": "petal",
    "kind": "hero_petal_2",
    "name": "花刃使",
    "tier": 2,
    "trialId": null,
    "questId": "ascend-petal-2",
    "benefit": "双刃侧翼铺放。每轮左右手各投一片花刃，分别从目标两侧穿过扎根，武器Ⅰ已有两翼落点，不靠满档才形成。",
    "description": "开始召回时本体向指向短滑一步，刃片仍朝移动后的角色回收，主动改变夹角；指空可脱围，不额外复按。 腾空期间可按移动方向漂移，花刃从起点到落点分两片落下，既脱围又留下前后两处收割角度。",
    "mainProgression": true
  },
  "petal_sovereign": {
    "id": "petal_sovereign",
    "heroId": "petal",
    "kind": "hero_petal_3",
    "name": "千花刃主",
    "tier": 3,
    "trialId": null,
    "questId": "ascend-petal-3",
    "benefit": "花苞命中盛放布刃。自动投实体花苞，命中先爆裂伤敌，再向目标四周射出花刃落地，已具有中心开花播种而非两翼双投。",
    "description": "打开短召回窗口，先收现有花刃，再将窗口内普攻和花雨新落地的花刃分拍收回；结束恢复布刃。 本体升起花瓣护翼并可短时滑行，分拍向周围落花雨；落地前仍可用召回收割已落刃。",
    "mainProgression": true
  },
  "summoner_sovereign": {
    "id": "summoner_sovereign",
    "heroId": "summoner",
    "kind": "hero_summoner_3",
    "name": "万灵统御者",
    "tier": 3,
    "trialId": null,
    "questId": "ascend-summoner-3",
    "benefit": "加入魂祭司的混编军团。盾卫、矛卫与魂祭司自主分工；祭司治疗同时发魂刺，始终共享三个常驻单位槽。",
    "description": "魂火爆杀产生的新灵骸可接续引爆一轮，形成可见连锁；递归到此停止，对Boss则第一波按命中后再爆一次兑现。 统领与现存护卫短时合成巨灵，接管军团攻击为拍地和前方横扫；结束按参与数量拆回，期间不保留隐形小兵伤害。",
    "mainProgression": true
  },
  "blink_sovereign": {
    "id": "blink_sovereign",
    "heroId": "blink",
    "kind": "hero_blink_3",
    "name": "千影瞬行者",
    "tier": 3,
    "trialId": null,
    "questId": "ascend-blink-3",
    "benefit": "伤口处刑与收割接续。本体刺击与攻击影复演共同累积目标伤口，满层由影刃从敌人身上向外切开；不依赖击杀Boss才能触发。",
    "description": "进场刺击击杀目标时，攻击影自动追刺附近另一敌人一次；本体坐标不被接管，没击杀时保留延迟复演。 返程影存在时再按同一技能返回，不重置首次冷却。返回处留下短时诱敌假身。 兑现杀死目标后，剩余窗口转给邻近一个精英并令攻击影追击；新目标重新记伤，不复制已结算伤害，最多接续一次且不瞬移本体。",
    "mainProgression": true
  },
  "mage_sovereign": {
    "id": "mage_sovereign",
    "heroId": "mage",
    "kind": "hero_mage_3",
    "name": "三相主宰",
    "tier": 3,
    "trialId": null,
    "questId": "ascend-mage-3",
    "benefit": "天落雷击接电弧。普攻从目标头顶劈下落雷，再从雷击点跳出电弧；不需要从角色前方飞过去，解决前排遮挡并保留电弧清群。",
    "description": "保留新星与破冰传播，身上再留有限耐久冰甲；首次被普通攻击打破时再爆一次新星，不靠挨打无限刷新护甲。 冰彗星先落、火陨石接砸，再自主接续三相陨星；冰霜与电击可配合落击，不要求第三个主动按钮。",
    "mainProgression": true
  }
});
export function getHero(id){return HEROES.find(hero=>hero.id===id)||null;}
export function getHeroJob(job){return HERO_JOBS[job]||HERO_JOBS.fighter;}
export function getHeroKind(heroId,job){const hero=getHero(heroId),meta=HERO_JOBS[job];return meta?.heroId===heroId?meta.kind:(hero?.kind||null);}
export function getHeroJobs(heroId){return Object.values(HERO_JOBS).filter(job=>job.heroId===heroId).sort((a,b)=>a.tier-b.tier);}
export function getSelectedHero(profile){return getHero(profile?.selectedHero)||HEROES[0];}
export function selectHero(id){const hero=getHero(id);return hero?{ok:true,message:`${hero.name}已整装待发。`}:{ok:false,message:'未知英雄。'};}

// The legacy skill catalog remains a save-content contract; runtime buttons use this kit.
export const HERO_ACTIVE_SKILLS=Object.freeze(Object.fromEntries(Object.entries({
 commander:['dash','whirlwind'],summoner:['recallSummons','summonElite'],blink:['markBlade','blinkStorm'],mage:['frostAura','rockWall'],grappler:['grappleHook','grappleClash'],rift:['riftGate','riftBarrage'],magnet:['magnetField','magnetCrush'],sword:['swordRecall','swordUnion'],spiral:['spiralClone','spiralConvergence'],petal:['petalPierce','petalBloom']
}).map(([id,skills])=>[id,Object.freeze(skills)])));
export function getActiveSkillLoadout(heroId,stored=[]){const allowed=HERO_ACTIVE_SKILLS[heroId];if(!allowed)return [];const selected=[...new Set((Array.isArray(stored)?stored:[]).filter(id=>allowed.includes(id)))];return [...selected,...allowed.filter(id=>!selected.includes(id))];}
