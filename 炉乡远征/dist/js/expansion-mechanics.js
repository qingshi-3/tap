import {recordBattlePresentation} from './battle-presentation-events.js';
// Audited Duelyst 1.97.13 core; source and adaptation table: output/content-expansion/card-plan.json.
export const EXPANSION_VERSION='campaign-2026-10-14-v2';
export const EXPANSION_CARDS={
  "8": {
    "id": 8,
    "name": "莱昂斗士",
    "type": "unit",
    "faction": 1,
    "cost": 4,
    "attack": 4,
    "health": 4,
    "celerity": true,
    "description": "每回合可移动和攻击各2次。"
  },
  "10": {
    "id": 10,
    "name": "日石圣殿卫",
    "type": "unit",
    "faction": 1,
    "cost": 2,
    "attack": 1,
    "health": 4,
    "attackDispel": true,
    "description": "攻击时驱散目标。"
  },
  "12": {
    "id": 12,
    "name": "辉光哨卫",
    "type": "unit",
    "faction": 1,
    "cost": 3,
    "attack": 2,
    "health": 4,
    "openingStatAttack": 2,
    "openingStatHealth": -2,
    "description": "登场：所选随从永久增加2攻击、减少2生命。"
  },
  "13": {
    "id": 13,
    "name": "第二太阳",
    "type": "unit",
    "faction": 1,
    "cost": 5,
    "attack": 0,
    "health": 8,
    "zeal": 8,
    "description": "邻近己方主将时增加8攻击。"
  },
  "21": {
    "id": 21,
    "name": "碧石狮",
    "type": "unit",
    "faction": 1,
    "cost": 2,
    "attack": 2,
    "health": 3,
    "celerity": true,
    "description": "每回合可移动和攻击各2次。"
  },
  "22": {
    "id": 22,
    "name": "旭日者",
    "type": "unit",
    "faction": 1,
    "cost": 4,
    "attack": 3,
    "health": 4,
    "healWatchDamage": 2,
    "description": "任一单位实际恢复生命时，对相邻敌人造成2伤害。"
  },
  "112": {
    "id": 112,
    "name": "血角刺客",
    "type": "unit",
    "faction": 2,
    "cost": 3,
    "attack": 3,
    "health": 3,
    "backstab": 2,
    "attackWatchBuff": 1,
    "description": "背刺2；主动攻击后永久增加1攻击和1生命。"
  },
  "113": {
    "id": 113,
    "name": "潘多",
    "type": "unit",
    "faction": 2,
    "cost": 1,
    "attack": 0,
    "health": 2,
    "attackImmune": true,
    "token": true,
    "description": "不受攻击伤害。"
  },
  "114": {
    "id": 114,
    "name": "翡翠僧",
    "type": "unit",
    "faction": 2,
    "cost": 3,
    "attack": 4,
    "health": 3,
    "damageEnemyRandom": 1,
    "description": "每次受伤后，随机一名敌方随从受到1伤害。"
  },
  "117": {
    "id": 117,
    "name": "天界幻影",
    "type": "unit",
    "faction": 2,
    "cost": 3,
    "attack": 1,
    "health": 5,
    "damageKill": true,
    "description": "对随从造成伤害后将其消灭。"
  },
  "119": {
    "id": 119,
    "name": "哈蒙寻刃者",
    "type": "unit",
    "faction": 2,
    "cost": 5,
    "attack": 8,
    "health": 8,
    "startSelfDamage": 2,
    "description": "己方回合开始，己方主将受到2伤害。"
  },
  "120": {
    "id": 120,
    "name": "凯什蕾扇刃",
    "type": "unit",
    "faction": 2,
    "cost": 4,
    "attack": 5,
    "health": 3,
    "openingSpellTax": 2,
    "description": "登场：敌方法术与主将技能增加2费用，持续至其下个回合结束。"
  },
  "122": {
    "id": 122,
    "name": "灯笼狐",
    "type": "unit",
    "faction": 2,
    "cost": 3,
    "attack": 2,
    "health": 3,
    "damageGenerate": 20081,
    "description": "每次受伤后，将1张凤凰火加入手牌。"
  },
  "208": {
    "id": 208,
    "name": "风伯劳",
    "type": "unit",
    "faction": 3,
    "cost": 4,
    "attack": 4,
    "health": 3,
    "flying": true,
    "dyingDraw": 1,
    "description": "飞行；亡愿：抽1张牌。"
  },
  "210": {
    "id": 210,
    "name": "沙嚎兽",
    "type": "unit",
    "faction": 3,
    "cost": 3,
    "attack": 3,
    "health": 3,
    "spellImmune": true,
    "description": "不能被敌方法术直接选为目标；区域法术仍可影响。"
  },
  "212": {
    "id": 212,
    "name": "织球者",
    "type": "unit",
    "faction": 3,
    "cost": 3,
    "attack": 2,
    "health": 2,
    "race": "dervish",
    "openingClone": true,
    "description": "沙魔。登场：在所选空格召唤自身复制体。"
  },
  "219": {
    "id": 219,
    "name": "幻影大师",
    "type": "unit",
    "faction": 3,
    "cost": 4,
    "attack": 1,
    "health": 1,
    "openingCopy": true,
    "description": "登场：变为所选敌方随从的复制体。"
  },
  "220": {
    "id": 220,
    "name": "艾玛拉疗愈者",
    "type": "unit",
    "faction": 3,
    "cost": 6,
    "attack": 5,
    "health": 5,
    "provoke": true,
    "dyingLeech": 5,
    "description": "嘲讽；亡愿：敌方主将受到5伤害，己方主将恢复5生命。"
  },
  "221": {
    "id": 221,
    "name": "传送门守卫",
    "type": "unit",
    "faction": 3,
    "cost": 3,
    "attack": 0,
    "health": 8,
    "frenzy": true,
    "summonWatchAttack": 1,
    "description": "狂暴；每次召唤友方随从后永久增加1攻击。"
  },
  "312": {
    "id": 312,
    "name": "深火吞噬者",
    "type": "unit",
    "faction": 4,
    "cost": 4,
    "attack": 4,
    "health": 4,
    "frenzy": true,
    "openingSacrifice": 2,
    "description": "狂暴。登场：牺牲相邻友方随从，每名使自身永久增加2攻击和2生命。"
  },
  "313": {
    "id": 313,
    "name": "血妖",
    "type": "unit",
    "faction": 4,
    "cost": 2,
    "attack": 3,
    "health": 2,
    "openingAttackDebuff": 2,
    "description": "登场：相邻一名敌人本回合减少2攻击。"
  },
  "314": {
    "id": 314,
    "name": "斩首掠夺者",
    "type": "unit",
    "faction": 4,
    "cost": 6,
    "attack": 6,
    "health": 6,
    "celerity": true,
    "dyingSpawnCount": 6,
    "description": "每回合可移动和攻击各2次。亡愿：在空格召唤最多6名暗灵。"
  },
  "318": {
    "id": 318,
    "name": "暗影舞者",
    "type": "unit",
    "faction": 4,
    "cost": 5,
    "attack": 4,
    "health": 4,
    "deathWatchLeech": 1,
    "description": "其他随从死亡时，敌方主将受到1伤害，己方主将恢复1生命。"
  },
  "319": {
    "id": 319,
    "name": "夜恸刺客",
    "type": "unit",
    "faction": 4,
    "cost": 3,
    "attack": 2,
    "health": 1,
    "openingKillMaxAttack": 2,
    "description": "登场：消灭相邻攻击不超过2的敌方随从。"
  },
  "321": {
    "id": 321,
    "name": "黑暗索鲁斯",
    "type": "unit",
    "faction": 4,
    "cost": 5,
    "attack": 4,
    "health": 7,
    "summonWraithAttack": 2,
    "description": "每次召唤己方暗灵后永久增加2攻击。"
  },
  "403": {
    "id": 403,
    "name": "恐岩",
    "type": "unit",
    "faction": 5,
    "cost": 4,
    "attack": 3,
    "health": 4,
    "grow": 2,
    "description": "成长2。"
  },
  "405": {
    "id": 405,
    "name": "马坎托战争兽",
    "type": "unit",
    "faction": 5,
    "cost": 6,
    "attack": 4,
    "health": 4,
    "rush": true,
    "frenzy": true,
    "description": "突袭、狂暴。"
  },
  "407": {
    "id": 407,
    "name": "启明兽",
    "type": "unit",
    "faction": 5,
    "cost": 4,
    "attack": 5,
    "health": 4,
    "rush": true,
    "openingSelfDamage": 4,
    "description": "突袭。登场：己方主将受到4伤害。"
  },
  "414": {
    "id": 414,
    "name": "希利萨长老",
    "type": "unit",
    "faction": 5,
    "cost": 7,
    "attack": 7,
    "health": 7,
    "rebirth": true,
    "endSpawnEgg": true,
    "description": "重生。己方回合结束，在相邻空格召唤自身的卵。"
  },
  "415": {
    "id": 415,
    "name": "灵魂收割者",
    "type": "unit",
    "faction": 5,
    "cost": 5,
    "attack": 5,
    "health": 5,
    "endDamageAllMinions": 1,
    "description": "己方回合结束，其他所有随从受到1伤害。"
  },
  "417": {
    "id": 417,
    "name": "复仇者",
    "type": "unit",
    "faction": 5,
    "cost": 3,
    "attack": 1,
    "health": 3,
    "enemyDrawBuff": 2,
    "description": "敌方每抽1张牌后，永久增加2攻击和2生命。"
  },
  "507": {
    "id": 507,
    "name": "霜角犀牛",
    "type": "unit",
    "faction": 6,
    "cost": 5,
    "attack": 6,
    "health": 5,
    "infiltrate": 1,
    "infiltrateCelerity": true,
    "description": "位于敌方半场时增加1攻击，每回合可移动和攻击各2次。"
  },
  "510": {
    "id": 510,
    "name": "追雪者",
    "type": "unit",
    "faction": 6,
    "cost": 1,
    "attack": 2,
    "health": 1,
    "race": "vespyr",
    "infiltrateReturn": true,
    "description": "冰灵。位于敌方半场时获得亡愿：将自身基础卡加入手牌。"
  },
  "512": {
    "id": 512,
    "name": "北境熊",
    "type": "unit",
    "faction": 6,
    "cost": 2,
    "attack": 1,
    "health": 3,
    "race": "vespyr",
    "summonRaceAttack": 1,
    "description": "冰灵。每次召唤友方冰灵后永久增加1攻击。"
  },
  "515": {
    "id": 515,
    "name": "风之声",
    "type": "unit",
    "faction": 6,
    "cost": 4,
    "attack": 4,
    "health": 4,
    "handSummonSpawn": 518,
    "description": "每次从手牌召唤随从后，在相邻空格召唤一名2/2冰灵。"
  },
  "517": {
    "id": 517,
    "name": "炉火姐妹",
    "type": "unit",
    "faction": 6,
    "cost": 2,
    "attack": 3,
    "health": 2,
    "openingSwap": true,
    "description": "登场：与所选其他随从交换位置，不恢复行动。"
  },
  "518": {
    "id": 518,
    "name": "冬日冰灵",
    "type": "unit",
    "faction": 6,
    "cost": 1,
    "attack": 2,
    "health": 2,
    "race": "vespyr",
    "token": true,
    "description": "冰灵。"
  },
  "519": {
    "id": 519,
    "name": "冰川元素",
    "type": "unit",
    "faction": 6,
    "cost": 3,
    "attack": 2,
    "health": 3,
    "race": "vespyr",
    "summonRaceDamage": 2,
    "description": "冰灵。每次召唤友方冰灵后，随机一名敌方随从受到2伤害。"
  },
  "523": {
    "id": 523,
    "name": "引力之墙",
    "type": "unit",
    "faction": 6,
    "cost": 1,
    "attack": 0,
    "health": 1,
    "wall": true,
    "provoke": true,
    "token": true,
    "description": "冰墙、嘲讽。"
  },
  "10016": {
    "id": 10016,
    "name": "排斥兽",
    "type": "unit",
    "faction": 0,
    "cost": 3,
    "attack": 2,
    "health": 2,
    "openingTeleport": true,
    "description": "登场：将相邻敌方随从传送到所选空格。"
  },
  "10301": {
    "id": 10301,
    "name": "日光先知",
    "type": "unit",
    "faction": 0,
    "cost": 3,
    "attack": 2,
    "health": 4,
    "damageHeal": 2,
    "description": "每次造成伤害后，己方主将恢复2生命。"
  },
  "10306": {
    "id": 10306,
    "name": "光弯者",
    "type": "unit",
    "faction": 0,
    "cost": 4,
    "attack": 3,
    "health": 3,
    "openingDispelArea": true,
    "description": "登场：驱散周围8格的单位与腐化。"
  },
  "10958": {
    "id": 10958,
    "name": "匕首麒麟",
    "type": "unit",
    "faction": 0,
    "cost": 5,
    "attack": 2,
    "health": 8,
    "celerity": true,
    "description": "每回合可移动和攻击各2次。"
  },
  "10995": {
    "id": 10995,
    "name": "翡翠复苏者",
    "type": "unit",
    "faction": 0,
    "cost": 4,
    "attack": 4,
    "health": 4,
    "openingHealBoth": 4,
    "description": "登场：各存活阵营的主将恢复4生命。"
  },
  "19040": {
    "id": 19040,
    "name": "穿刺螳螂",
    "type": "unit",
    "faction": 0,
    "cost": 2,
    "attack": 2,
    "health": 2,
    "frenzy": true,
    "description": "狂暴。"
  },
  "19052": {
    "id": 19052,
    "name": "血泪炼金师",
    "type": "unit",
    "faction": 0,
    "cost": 1,
    "attack": 2,
    "health": 1,
    "openingDamageTarget": 1,
    "description": "登场：一名敌方单位受到1伤害，可选主将。"
  },
  "20051": {
    "id": 20051,
    "name": "暗影新星",
    "type": "spell",
    "faction": 4,
    "cost": 4,
    "effect": "shadowNova",
    "target": "areaCell",
    "description": "2x2区域生成腐化"
  },
  "20057": {
    "id": 20057,
    "name": "放逐仪式",
    "type": "spell",
    "faction": 4,
    "cost": 3,
    "effect": "ritualBanishing",
    "target": "ally",
    "followup": "killEnemy",
    "description": "牺牲友方随从后消灭敌方随从"
  },
  "20064": {
    "id": 20064,
    "name": "日光绽放",
    "type": "spell",
    "faction": 1,
    "cost": 2,
    "effect": "sunBloom",
    "target": "areaCell",
    "description": "驱散2x2区域"
  },
  "20067": {
    "id": 20067,
    "name": "神圣焚身",
    "type": "spell",
    "faction": 1,
    "cost": 4,
    "effect": "holyImmolation",
    "target": "ally",
    "heal": 4,
    "amount": 4,
    "description": "友方随从治疗4；邻近敌人受4伤"
  },
  "20074": {
    "id": 20074,
    "name": "宇宙血肉",
    "type": "spell",
    "faction": 3,
    "cost": 2,
    "effect": "cosmicFlesh",
    "target": "ally",
    "attackBuff": 1,
    "healthBuff": 3,
    "grantProvoke": true,
    "description": "友方随从+1/+3及嘲讽"
  },
  "20082": {
    "id": 20082,
    "name": "双重打击",
    "type": "spell",
    "faction": 2,
    "cost": 3,
    "effect": "twinStrike",
    "target": "none",
    "amount": 2,
    "description": "至少2敌随从，随机不同两名各受2伤；下次常规抽牌+1"
  },
  "20087": {
    "id": 20087,
    "name": "黑玉熊印",
    "type": "spell",
    "faction": 2,
    "cost": 3,
    "effect": "onyxBearSeal",
    "target": "enemyMinion",
    "transform": 113,
    "description": "敌随从变0/2攻击免疫Panddo，归属不变"
  },
  "20090": {
    "id": 20090,
    "name": "殉道",
    "type": "spell",
    "faction": 1,
    "cost": 3,
    "effect": "martyrdom",
    "target": "minion",
    "description": "消灭随从；其主将恢复被杀前当前生命"
  },
  "20096": {
    "id": 20096,
    "name": "第二愿望",
    "type": "spell",
    "faction": 3,
    "cost": 2,
    "effect": "secondWish",
    "target": "ally",
    "attackBuff": 2,
    "healthBuff": 2,
    "grantGeneralImmune": true,
    "description": "友方随从+2/+2及主将伤害免疫"
  },
  "20097": {
    "id": 20097,
    "name": "第三愿望",
    "type": "spell",
    "faction": 3,
    "cost": 3,
    "effect": "thirdWish",
    "target": "allyDervish",
    "attackBuff": 3,
    "healthBuff": 3,
    "grantFlying": true,
    "description": "友方沙魔+3/+3及飞行"
  },
  "20102": {
    "id": 20102,
    "name": "杀戮之刃",
    "type": "spell",
    "faction": 2,
    "cost": 3,
    "effect": "killingEdge",
    "target": "ally",
    "attackBuff": 4,
    "healthBuff": 2,
    "description": "友方随从+4/+2；有背刺则下次常规抽牌+1"
  },
  "20113": {
    "id": 20113,
    "name": "凶潮狂暴",
    "type": "spell",
    "faction": 5,
    "cost": 2,
    "effect": "diretideFrenzy",
    "target": "ally",
    "attackBuff": 1,
    "healthBuff": 0,
    "grantFrenzy": true,
    "description": "友方随从+1攻及狂暴"
  },
  "20115": {
    "id": 20115,
    "name": "梦之舞",
    "type": "spell",
    "faction": 5,
    "cost": 1,
    "effect": "danceDreams",
    "target": "none",
    "description": "本回合友方随从死亡抽1"
  },
  "20119": {
    "id": 20119,
    "name": "增幅",
    "type": "spell",
    "faction": 5,
    "cost": 1,
    "effect": "amplification",
    "target": "damagedAlly",
    "attackBuff": 2,
    "healthBuff": 4,
    "description": "受伤友方随从+2/+4"
  },
  "20133": {
    "id": 20133,
    "name": "死亡渐强",
    "type": "spell",
    "faction": 4,
    "cost": 3,
    "effect": "deathfireCrescendo",
    "target": "ally",
    "deathWatchBuff": 2,
    "description": "友方随从获得死亡监听+2/+2"
  },
  "20136": {
    "id": 20136,
    "name": "雪崩",
    "type": "spell",
    "faction": 6,
    "cost": 4,
    "effect": "avalanche",
    "target": "none",
    "amount": 4,
    "description": "己方半场所有单位受4伤及眩晕"
  },
  "20147": {
    "id": 20147,
    "name": "引力井",
    "type": "spell",
    "faction": 6,
    "cost": 2,
    "effect": "gravityWell",
    "target": "cell",
    "summon": 523,
    "count": 4,
    "description": "召唤4个0/1嘲讽墙"
  },
  "20153": {
    "id": 20153,
    "name": "心灵绿洲",
    "type": "spell",
    "faction": 3,
    "cost": 3,
    "effect": "innerOasis",
    "target": "none",
    "healthBuff": 3,
    "draw": 1,
    "description": "全体友方随从+3生命；抽1"
  },
  "20154": {
    "id": 20154,
    "name": "冥窖仪式",
    "type": "spell",
    "faction": 4,
    "cost": 6,
    "effect": "riteUndervault",
    "target": "none",
    "description": "从牌库抽到手牌上限"
  },
  "20155": {
    "id": 20155,
    "name": "天蚀",
    "type": "spell",
    "faction": 2,
    "cost": 5,
    "effect": "heavensEclipse",
    "target": "none",
    "count": 3,
    "description": "从牌库随机抽最多3法术"
  },
  "20157": {
    "id": 20157,
    "name": "卵变",
    "type": "spell",
    "faction": 5,
    "cost": 4,
    "effect": "eggMorph",
    "target": "minion",
    "description": "随从变为同属卵；卵则立即孵化"
  },
  "20163": {
    "id": 20163,
    "name": "野性之灵",
    "type": "spell",
    "faction": 6,
    "cost": 5,
    "effect": "spiritWild",
    "target": "none",
    "description": "敌方半场友方随从恢复行动"
  },
  "20165": {
    "id": 20165,
    "name": "冰生",
    "type": "spell",
    "faction": 6,
    "cost": 4,
    "effect": "cryogenesis",
    "target": "enemyMinion",
    "amount": 4,
    "description": "敌随从受4伤；从牌库抽1冰灵"
  }
};
export const EXPANSION_IDS=Object.freeze(Object.keys(EXPANSION_CARDS).map(Number));
export const RECRUITMENT_VERSION='campaign-2026-10-14-v3';
export const TURN_START_DRAW_VERSION='campaign-2026-10-15-v4';

export const EXPANSION_UNIT_IDS=Object.freeze(EXPANSION_IDS.filter(id=>EXPANSION_CARDS[id].type==='unit'&&!EXPANSION_CARDS[id].token));
export const EXPANSION_SPELL_IDS=Object.freeze(EXPANSION_IDS.filter(id=>EXPANSION_CARDS[id].type==='spell'));
export const EXPANSION_RACES=Object.freeze({211:'dervish',212:'dervish',217:'dervish',225:'dervish',505:'vespyr',525:'vespyr',526:'vespyr',510:'vespyr',512:'vespyr',518:'vespyr',519:'vespyr'});
export function enemyHalf(state,unit) {const middle=(state.board.columns-1)/2;return unit.owner===0?unit.x>middle:unit.x<middle;}
export function actionQuota(state,unit,rule) {return (rule?.celerity||rule?.infiltrateCelerity&&enemyHalf(state,unit))?2:1;}
export function randomIndex(state,length) {
  if(!length)return -1;
  state.expansionRandom=(Math.imul(state.expansionRandom,1664525)+1013904223)>>>0;
  return state.expansionRandom%length;
}
const living=(s)=>s.units.filter(u=>u.health>0);
const near=(a,b)=>b&&Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))<=1;
export function buff(unit,attack=0,health=0) {unit.attackBuff+=attack;unit.healthBuff+=health;unit.health+=health;}
export function generatedCardId(state,owner,sourceId) {
  const source=state.battleCards?.[owner]?.[sourceId];
  return source?.damageGenerate ?? (source?.infiltrateReturn || source?.startBounceSelf ? Number(sourceId) : null);
}
export function putCard(state,owner,id,sourceId=null,presentation={}) {
  const p=state.players[owner];
  if(!p)return false;
  const kind=presentation.kind??'generate';
  if(p.hand.length>=state.deckRules[owner].handLimit){recordBattlePresentation(state,{kind:'burn',origin:kind,owner,cardId:id,sourceCardId:sourceId});return false;}
  if(sourceId!==null) {
    if(generatedCardId(state,owner,sourceId)!==id)throw new Error('Unsupported generated-card source.');
    // Returning bodies may have been copied, transformed or hatched; `token`
    // is not card provenance. Extend the frozen pile bound only when a return
    // actually exceeds it. Replaying and returning that card cannot mint credit.
    const source=state.battleCards[owner][sourceId];
    const original=owner===0?state.playerDeck:state.enemyPlan.players[owner].deck;
    const allowance=original.filter(cardId=>cardId===id).length+Object.entries(p.generatedBySource??{})
      .reduce((sum,[generator,count])=>sum+(generatedCardId(state,owner,generator)===id?count:0),0);
    const extend=!(source.infiltrateReturn || source.startBounceSelf)||[...p.hand,...p.deck].filter(cardId=>cardId===id).length+1>allowance;
    // Tutors transfer existing cards; full-hand burns return before this point.
    if(extend){p.generatedBySource??={};p.generatedBySource[sourceId]=(p.generatedBySource[sourceId]??0)+1;}
  }
  const handIndex=p.hand.length;p.hand.push(id);recordBattlePresentation(state,{kind,owner,cardId:id,handIndex,sourceCardId:sourceId});return true;
}
export function drawMatching(state,owner,predicate,api,count=1) {
  const p=state.players[owner];for(let n=0;n<count;n++) {const ids=p.deck.map((id,i)=>predicate(api.card(id,owner))?i:-1).filter(i=>i>=0);if(!ids.length)break;const idx=ids[randomIndex(state,ids.length)];const [id]=p.deck.splice(idx,1);putCard(state,owner,id,null,{kind:'tutor'});expansionEvent(state,'draw',{owner},api);}
}
export function openingFollowup(state,card,cell,owner,primaryId,api) {
  const minions=living(state).filter(u=>api.rule(u)?.type==='unit');
  let targets=null;
  if(card.openingStatAttack)targets=minions;
  if(card.openingCopy)targets=minions.filter(u=>u.owner!==owner);
  if(card.openingSwap)targets=living(state);
  if(card.openingDamageTarget)targets=living(state).filter(u=>u.owner!==owner&&(!card.openingTargetNearby||near(cell,u))&&(!card.openingTargetMinion||api.rule(u)?.type==='unit'));
  if(card.openingVespyrBuff)targets=minions.filter(u=>u.owner===owner&&api.rule(u)?.race==='vespyr');
  if(card.openingControlMaxAttack)targets=minions.filter(u=>u.owner!==owner&&near(cell,u)&&api.attack(u)<=card.openingControlMaxAttack);
  if(card.openingAttackDebuff)targets=living(state).filter(u=>u.owner!==owner&&near(cell,u));
  if(card.openingKillMaxAttack)targets=minions.filter(u=>u.owner!==owner&&near(cell,u)&&api.attack(u)<=card.openingKillMaxAttack);
  if(card.openingTeleport) {
    targets=minions.filter(u=>u.owner!==owner&&near(cell,u));
    if(primaryId!==null) {if(!targets.some(u=>u.unitId===primaryId))return null;return {type:'cell',optional:true,cells:api.allFree().filter(p=>p.x!==cell.x||p.y!==cell.y)};}
  }
  if(card.openingClone)return {type:'cell',optional:true,cells:api.allFree().filter(p=>p.x!==cell.x||p.y!==cell.y)};
  return targets?{type:'unit',optional:true,unitIds:targets.map(u=>u.unitId)}:null;
}
export function resolveOpening(state,unit,card,choice,api) {
  const target=state.units.find(u=>u.unitId===(choice?.unitId??choice?.primaryId));const cell=choice?.cell??choice;
  {
    if(card.openingVespyrBuff&&target){buff(target,card.openingVespyrBuff,card.openingVespyrBuff);target.flyingBuff=true;}
    if(card.openingControlMaxAttack&&target)api.control(target,unit.owner);
    if(card.openingGrantDyingSpawnToAllies)for(const ally of living(state).filter(u=>u!==unit&&u.owner===unit.owner&&api.rule(u)?.type==='unit'))(ally.grantedDyingSpawns??=[]).push(card.openingGrantDyingSpawnToAllies);
    if(card.openingNearbySelfDamageEqualAttack)for(const victim of [...living(state)].filter(u=>u!==unit&&near(unit,u)&&api.rule(u)?.type==='unit'))api.damage(victim,api.attack(victim),{sourceOwner:victim.owner,sourceId:victim.unitId,actionOwner:unit.owner});
  }
  if(card.openingStatAttack&&target) {buff(target,card.openingStatAttack,card.openingStatHealth);api.settle(target);}
  if(card.openingSwap&&target){const old={x:unit.x,y:unit.y};unit.x=target.x;unit.y=target.y;target.x=old.x;target.y=old.y;}
  if(card.openingTeleport&&target&&cell){target.x=cell.x;target.y=cell.y;}
  if(card.openingClone&&cell){const made=api.summon(unit.cardId,unit.owner,cell.x,cell.y,{token:true,skipOpening:true});if(made)api.copy(made,unit);}
  if(card.openingCopy&&target)api.copy(unit,target);
  if(card.openingAttackDebuff&&target){buff(target,-card.openingAttackDebuff);target.tempDebuff=(target.tempDebuff??0)+card.openingAttackDebuff;target.debuffOwner=unit.owner;}
  if(card.openingKillMaxAttack&&target)api.kill(target,unit.owner);
  if(card.openingDamageTarget&&target)api.damage(target,card.openingDamageTarget,{sourceOwner:unit.owner,sourceId:unit.unitId});
  if(card.openingSelfDamage)api.damage(api.general(unit.owner),card.openingSelfDamage,{sourceOwner:unit.owner});
  if(card.openingHealBoth)for(const p of state.players)api.heal(api.general(p.id),card.openingHealBoth);
  if(card.openingDispelArea)for(let y=unit.y-1;y<=unit.y+1;y++)for(let x=unit.x-1;x<=unit.x+1;x++)if(x!==unit.x||y!==unit.y)api.dispel(x,y);
  if(card.openingSacrifice)for(const victim of [...state.units].filter(u=>u!==unit&&u.owner===unit.owner&&api.rule(u)?.type==='unit'&&near(unit,u))){api.kill(victim,unit.owner);if(state.units.includes(unit))buff(unit,card.openingSacrifice,card.openingSacrifice);}
  if(card.openingSpellTax)for(const p of state.players.filter(p=>p.id!==unit.owner)){p.spellTax=(p.spellTax??0)+card.openingSpellTax;p.spellTaxEndsAfter=p.turnsStarted+1;}
}
export function expansionEvent(state,type,event,api) {
  // Snapshot listeners: derived summons never re-enter the hand-summon event.
  for(const watcher of [...living(state)]) {
    if(!state.units.includes(watcher))continue;const c=api.rule(watcher);if(!c)continue;
    if(type==='summon'&&watcher!==event.unit&&watcher.owner===event.unit.owner) {
      if(c.nearbySummonBuff&&near(watcher,event.unit)&&api.rule(event.unit)?.type==='unit')buff(event.unit,c.nearbySummonBuff,c.nearbySummonBuff);
      if(c.summonWatchAttack)buff(watcher,c.summonWatchAttack);
      if(c.summonWraithAttack&&event.unit.cardId===315)buff(watcher,c.summonWraithAttack);
      if(c.summonRaceAttack&&api.rule(event.unit)?.race==='vespyr')buff(watcher,c.summonRaceAttack);
      if(c.summonRaceDamage&&api.rule(event.unit)?.race==='vespyr'){const enemies=living(state).filter(u=>u.owner!==watcher.owner&&api.rule(u)?.type==='unit');const victim=enemies[randomIndex(state,enemies.length)];if(victim)api.damage(victim,c.summonRaceDamage,{sourceOwner:watcher.owner,sourceId:watcher.unitId});}
      if(c.handSummonSpawn&&event.fromHand){const pos=api.free(watcher)[0];if(pos)api.summon(c.handSummonSpawn,watcher.owner,pos.x,pos.y,{token:true});}
    }
    if(type==='heal'&&c.healWatchDamage)for(const enemy of [...living(state)].filter(u=>u.owner!==watcher.owner&&near(watcher,u)))api.damage(enemy,c.healWatchDamage,{sourceOwner:watcher.owner,sourceId:watcher.unitId});
    if(type==='death'&&watcher!==event.unit){if(watcher.deathWatchBuff)buff(watcher,watcher.deathWatchBuff,watcher.deathWatchBuff);if(c.deathWatchLeech){for(const p of state.players.filter(p=>p.id!==watcher.owner))api.damage(api.general(p.id),c.deathWatchLeech,{sourceOwner:watcher.owner});api.heal(api.general(watcher.owner),c.deathWatchLeech);}}
    if(type==='draw'&&c.enemyDrawBuff&&event.owner!==watcher.owner)buff(watcher,c.enemyDrawBuff,c.enemyDrawBuff);
  }
  if(type==='damageTaken'){const {unit,card}=event;{
    if(card.damageAllEnemies)for(const victim of [...living(state)].filter(u=>u.owner!==unit.owner))api.damage(victim,card.damageAllEnemies,{sourceOwner:unit.owner,sourceId:unit.unitId});
    if(card.mirrorDamageToEnemyGeneral)for(const victim of [...living(state)].filter(u=>u.owner!==unit.owner&&api.rule(u)?.type==='general'))api.damage(victim,event.amount,{sourceOwner:unit.owner,sourceId:unit.unitId});
  }if(card.damageGenerate)putCard(state,unit.owner,card.damageGenerate,card.id);if(card.damageEnemyRandom){const targets=living(state).filter(u=>u.owner!==unit.owner&&api.rule(u)?.type==='unit');const victim=targets[randomIndex(state,targets.length)];if(victim)api.damage(victim,card.damageEnemyRandom,{sourceOwner:unit.owner,sourceId:unit.unitId});}}
  if(type==='damageDealt'){const c=event.card??api.rule(event.source);if(c?.damageEnemyGeneralOnMinionDamage&&event.target.owner!==event.source.owner&&event.targetCard?.type==='unit')for(const victim of [...living(state)].filter(u=>u.owner!==event.source.owner&&api.rule(u)?.type==='general'))api.damage(victim,c.damageEnemyGeneralOnMinionDamage,{sourceOwner:event.source.owner,sourceId:event.source.unitId});if(c?.damageHeal)api.heal(api.general(event.source.owner),c.damageHeal);if(c?.damageKill&&api.rule(event.target)?.type==='unit'&&state.units.includes(event.target))api.kill(event.target,event.source.owner);}
  if(type==='death') {
    const {unit,card}=event;const p=state.players[unit.owner];if(p.deathDraw)api.draw(unit.owner);
    if(card.infiltrateReturn&&enemyHalf(state,unit))putCard(state,unit.owner,unit.cardId,card.id,{kind:'return'});
    if(card.dyingLeech){for(const p of state.players.filter(p=>p.id!==unit.owner))api.damage(api.general(p.id),card.dyingLeech,{sourceOwner:unit.owner});api.heal(api.general(unit.owner),card.dyingLeech);}
    if(card.dyingSpawnCount)for(let i=0;i<card.dyingSpawnCount;i++){const cells=api.allFree(),pos=cells[randomIndex(state,cells.length)];if(!pos)break;api.summon(315,unit.owner,pos.x,pos.y,{token:true});}
  }
}
export function expansionEnd(state,owner,api) {
  for(const unit of [...living(state)].filter(u=>u.owner===owner)) {if(!state.units.includes(unit))continue;const c=api.rule(unit);{
    if(c.endHealNearby)for(const ally of [...living(state)].filter(u=>u!==unit&&u.owner===owner&&api.rule(u)?.type==='unit'&&near(unit,u)))api.heal(ally,c.endHealNearby);
    if(c.endDamageNearbyEnemyMinions)for(const enemy of [...living(state)].filter(u=>u.owner!==owner&&api.rule(u)?.type==='unit'&&near(unit,u)))api.damage(enemy,c.endDamageNearbyEnemyMinions,{sourceOwner:owner,sourceId:unit.unitId});
  }if(c.endSpawnEgg){const pos=api.free(unit)[0];if(pos)api.summon(411,owner,pos.x,pos.y,{token:true,hatchCardId:unit.cardId});}if(c.endDamageAllMinions)for(const victim of [...living(state)].filter(u=>u!==unit&&api.rule(u)?.type==='unit'))api.damage(victim,c.endDamageAllMinions,{sourceOwner:owner,sourceId:unit.unitId});}
  for(const unit of state.units)if(unit.debuffOwner===owner){unit.attackBuff+=unit.tempDebuff;delete unit.tempDebuff;delete unit.debuffOwner;}
  const p=state.players[owner];if(p.spellTax&&p.turnsStarted>=p.spellTaxEndsAfter){delete p.spellTax;delete p.spellTaxEndsAfter;}
}
export function recruitmentStart(state,owner,api) {
  for(const unit of [...living(state)].filter(u=>u.owner===owner)) {
    if(state.phase==='over')break;
    if(!state.units.includes(unit))continue;
    const card=api.rule(unit);
    if(card.startBounceSelf){api.remove(unit);putCard(state,owner,unit.cardId,card.id,{kind:'return'});api.refresh();}
    if(card.startRandomDamage){const targets=living(state),victim=targets[randomIndex(state,targets.length)];if(victim)api.damage(victim,card.startRandomDamage,{sourceOwner:owner,sourceId:unit.unitId});}
  }
}
export function validateExpansionState(state) {
  const integer=(v,max=100)=>Number.isInteger(v)&&v>=0&&v<=max;
    const frozenAbility = key => Object.values(state.battleCards??{}).some(table=>Object.values(table).some(card=>card?.[key]));
  for(const unit of state.units) {
    if(unit.grantedDyingSpawns!==undefined&&(state.phase==='mulligan'||state.battleCards?.[unit.controlledFromOwner??unit.owner]?.[unit.cardId]?.type!=='unit'||!frozenAbility('openingGrantDyingSpawnToAllies')||!Array.isArray(unit.grantedDyingSpawns)||unit.grantedDyingSpawns.length<1||unit.grantedDyingSpawns.length>10000||unit.grantedDyingSpawns.some(id=>id!==516||state.battleCards?.[unit.owner]?.[id]?.type!=='unit')))return false;
    if(unit.controlledFromOwner!==undefined&&(state.phase==='mulligan'||!frozenAbility('openingControlMaxAttack')||!Number.isInteger(unit.controlledFromOwner)||!state.players[unit.controlledFromOwner]||state.battleCards?.[unit.controlledFromOwner]?.[unit.cardId]?.type!=='unit'))return false;
  }
  if(!integer(state.expansionRandom,4294967295))return false;
  for(const p of state.players){for(const k of ['spellTax','spellTaxEndsAfter','drawBonus'])if(p[k]!==undefined&&!integer(p[k],k==='spellTaxEndsAfter'?1000:100))return false;if((p.spellTax===undefined)!==(p.spellTaxEndsAfter===undefined))return false;if(p.deathDraw!==undefined&&typeof p.deathDraw!=='boolean')return false;}
  for(const p of state.players)if(p.generatedBySource!==undefined){
    const receipt=p.generatedBySource;
    if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))return false;
    if(state.phase==='mulligan'&&Object.keys(receipt).length)return false;
    for(const [source,count]of Object.entries(receipt)){
      const id=generatedCardId(state,p.id,source);
      if(String(Number(source))!==source||!Number.isSafeInteger(count)||count<=0||!id||!state.battleCards?.[p.id]?.[id]||state.battleCards[p.id][id].type==='general')return false;
    }
  }
  for(const u of state.units){for(const k of ['movesUsed','attacksUsed'])if(u[k]!==undefined&&!integer(u[k],2))return false;for(const k of ['deathWatchBuff','tempDebuff'])if(u[k]!==undefined&&!integer(u[k]))return false;if(u.debuffOwner!==undefined&&!integer(u.debuffOwner,state.players.length-1))return false;if((u.tempDebuff===undefined)!==(u.debuffOwner===undefined))return false;for(const k of ['generalImmuneBuff','flyingBuff','frenzyBuff'])if(u[k]!==undefined&&typeof u[k]!=='boolean')return false;if(u.copiedCardId!==undefined&&(!integer(u.copiedCardId,100000)||!state.battleCards[u.owner][u.copiedCardId]||state.battleCards[u.owner][u.copiedCardId].type!=='unit'))return false;}
  return true;
}
