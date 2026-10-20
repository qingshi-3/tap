import { RECRUITMENT_CARDS, RECRUITMENT_UNIT_IDS } from './premium-cards.js';
const BBS_IDS = {1:20174,23:20175,101:20176,123:20177,201:20178,223:20179,301:20180,323:20181,401:20182,418:20183,501:20184,527:20185};
export const HEROES = {
  1: hero(1,1,'阿杰农','狮王怒吼','使主将附近一名友军 +2 攻击。','皇家护卫','每回合首次在主将附近召唤随从时，该随从永久 +1 生命。','ally'),
  23: hero(23,1,'齐兰','日耀圣露','为一名受伤友军恢复 3 点生命。','生命赐福','每回合首次实际治疗友军后，该目标永久 +1 攻击。','ally',true),
  101: hero(101,2,'卡尔奥斯','雾隐移形','将一名友军移到己方主将附近的空位。','暗影突袭','每回合首次背刺额外造成 1 点伤害。','ally'),
  123: hero(123,2,'蕾瓦','召唤心猎者','在空地召唤一名心猎者。','箭术精研','每回合首次施法后，一名友方远程随从永久 +1 攻击。','cell',true),
  201: hero(201,3,'齐瑞克斯','召唤铁沙','在空地召唤一名铁甲沙魔。','沙海锻体','己方召唤的沙魔永久 +1 生命。','cell'),
  223: hero(223,3,'萨姬','穿甲意志','本回合攻击随从时，自身 +2 攻击。','猎杀回馈','每回合首次消灭敌方随从时，己方主将恢复 2 生命。','self',true),
  301: hero(301,4,'莉莉丝','暗灵召唤','在附近召唤两个暗灵。','死灵呼唤','每回合首个非衍生友军死亡时，在其位置召唤幽灵。','self'),
  323: hero(323,4,'卡西瓦','幽暗爆裂','对一个敌人造成 1 点伤害并留下腐化地形。','腐土汲取','每回合首次由腐化地形造成伤害时，己方主将恢复 1 生命。','enemy',true),
  401: hero(401,5,'瓦斯','原始怒火','永久获得 +1 攻击。','坚韧战意','每回合首次受伤后若存活，获得 +1 攻击直到下个己方回合开始。','self'),
  418: hero(418,5,'星角','寻求真知','双方各抽一张牌。','求知若渴','每回合首次召唤费用至少 3 的随从时抽 1 张牌。','self',true),
  501: hero(501,6,'费伊','战鸟突袭','对敌方主将造成 2 点伤害。','寒境适应','拥有潜入的友军被召唤时永久 +1 生命。','self'),
  527: hero(527,6,'卡拉','冰霜战歌','本回合召唤的友军获得 +1 / +1。','冰墙号令','每回合首次召唤的随从永久 +1 生命，并使相邻冰墙获得嘲讽。','self',true),
};

function hero(id,faction,name,activeName,activeDescription,passiveName,passiveDescription,target,alt=false) {
  return { id,faction,name,activeName,activeDescription,passiveName,passiveDescription,cost:1,target,bbsCardId:BBS_IDS[id],
    portrait:`./assets/generals/general_portrait_image_f${faction}${alt?'alt':''}.png` };
}

const FACTION_STRENGTHS = {
  1: ['嘲讽', '治疗', '邻近强化'],
  2: ['背刺', '远程', '施法强化'],
  3: ['召唤沙魔', '爆破'],
  4: ['召唤暗灵', '腐化地形', '死亡成长'],
  5: ['成长', '重生'],
  6: ['潜入', '冰墙', '眩晕'],
};

export const FACTIONS = [
  faction(1,'莱昂', [1,23], [14,9,15,16,11,17,8,10,12,13,21,22], [14,9,11], [20174,20043,20066,20044,20068,20090,20064,20067]),
  faction(2,'宋海', [101,123], [110,115,109,108,111,116,112,114,117,119,120,122], [110,115,109], [20081,20086,20168,20129,20087,20102,20082,20155]),
  faction(3,'维特鲁威', [201,223], [213,211,214,209,215,216,208,210,212,219,220,221], [213,211,214], [20095,20151,20073,20077,20074,20096,20097,20153]),
  faction(4,'深渊', [301,323], [308,317,311,309,310,316,312,313,314,318,319,321], [308,317,311], [20052,20072,20049,20061,20051,20133,20057,20154]),
  faction(5,'玛格玛', [401,418], [406,412,410,402,404,413,403,405,407,414,415,417], [406,412,410], [20116,20117,20125,20122,20113,20119,20157,20115]),
  faction(6,'瓦纳尔', [501,527], [505,506,503,526,511,513,507,510,512,515,517,519], [505,506,503], [20139,20149,20134,20144,20147,20136,20165,20163]),
];



function faction(id,name,heroIds,unitIds,defaultSquad,spellIds) {
  return { id,name,heroIds,unitIds:[...unitIds,...RECRUITMENT_UNIT_IDS.filter(cardId=>RECRUITMENT_CARDS[cardId].faction===id)],defaultSquad,spellIds,strengths:FACTION_STRENGTHS[id],crest:`./assets/crests/crest_f${id}.png`,
    unitFrame:`./assets/card-backgrounds/f${id}-unit.png`, spellFrame:`./assets/card-backgrounds/f${id}-spell.png` };
}

export function getFaction(id) { return FACTIONS.find((faction) => faction.id === Number(id)) ?? null; }
export function getHero(id) { return HEROES[Number(id)] ?? null; }
