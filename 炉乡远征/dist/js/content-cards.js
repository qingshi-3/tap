import { RECRUITMENT_CARDS } from './recruitment-cards.js';
import { EXPANSION_CARDS } from './expansion-mechanics.js';
// Authored from the audited Duelyst 1.97.13 source; runtime rules, not planning imports.
export const CONTENT_CARDS = {
  ...EXPANSION_CARDS,
  ...RECRUITMENT_CARDS,
  "10001": {
    "id": 10001,
    "name": "龙雀",
    "type": "unit",
    "faction": 0,
    "cost": 1,
    "attack": 2,
    "health": 1,
    "flying": true,
    "description": "飞行。"
  },
  "10018": {
    "id": 10018,
    "name": "科莫多冲锋者",
    "type": "unit",
    "faction": 0,
    "cost": 1,
    "attack": 1,
    "health": 3,
    "description": ""
  },
  "19026": {
    "id": 19026,
    "name": "岩石粉碎者",
    "type": "unit",
    "faction": 0,
    "cost": 2,
    "attack": 1,
    "health": 4,
    "provoke": true,
    "description": "嘲讽。"
  },
  "10204": {
    "id": 10204,
    "name": "亮苔魔像",
    "type": "unit",
    "faction": 0,
    "cost": 5,
    "attack": 4,
    "health": 9,
    "description": ""
  },
  "10013": {
    "id": 10013,
    "name": "烈焰猎犬",
    "type": "unit",
    "faction": 0,
    "cost": 3,
    "attack": 4,
    "health": 3,
    "openingDrawBoth": 1,
    "description": "登场：各存活阵营抽1张牌。"
  },
  "10982": {
    "id": 10982,
    "name": "虚空猎手",
    "type": "unit",
    "faction": 0,
    "cost": 3,
    "attack": 4,
    "health": 2,
    "dyingDraw": 1,
    "description": "亡愿：己方抽1张牌。"
  },
  "10017": {
    "id": 10017,
    "name": "喷火者",
    "type": "unit",
    "faction": 0,
    "cost": 4,
    "attack": 3,
    "health": 2,
    "ranged": true,
    "attackRange": 3,
    "description": "远程。"
  },
  "10978": {
    "id": 10978,
    "name": "冰雹魔像",
    "type": "unit",
    "faction": 0,
    "cost": 4,
    "attack": 4,
    "health": 6,
    "description": ""
  },
  "10020": {
    "id": 10020,
    "name": "虚影帷幕",
    "type": "unit",
    "faction": 0,
    "cost": 2,
    "attack": 1,
    "health": 1,
    "openingDispel": true,
    "description": "登场：驱散相邻所选一格的单位与腐化地形。"
  },
  "19033": {
    "id": 19033,
    "name": "腐翼飞兽",
    "type": "unit",
    "faction": 0,
    "cost": 3,
    "attack": 2,
    "health": 4,
    "flying": true,
    "description": "飞行。"
  },
  "19034": {
    "id": 19034,
    "name": "幼年炎翼",
    "type": "unit",
    "faction": 0,
    "cost": 4,
    "attack": 5,
    "health": 4,
    "flying": true,
    "description": "飞行。"
  },
  "19049": {
    "id": 19049,
    "name": "旅者",
    "type": "unit",
    "faction": 0,
    "cost": 3,
    "attack": 1,
    "health": 5,
    "damageDraw": 1,
    "description": "每次实际造成伤害后抽1张牌，包含反击。"
  },
  "10207": {
    "id": 10207,
    "name": "风暴金属魔像",
    "type": "unit",
    "faction": 0,
    "cost": 6,
    "attack": 8,
    "health": 8,
    "description": ""
  },
  "10307": {
    "id": 10307,
    "name": "巨蛇",
    "type": "unit",
    "faction": 0,
    "cost": 6,
    "attack": 7,
    "health": 4,
    "frenzy": true,
    "description": "狂暴：主动近战同时攻击相邻其他敌人，每个目标各自反击。"
  },
  "19042": {
    "id": 19042,
    "name": "霜骨娜迦",
    "type": "unit",
    "faction": 0,
    "cost": 4,
    "attack": 3,
    "health": 3,
    "openingDamageNearby": 2,
    "description": "登场：相邻所有单位受到2伤害，包含友军与主将。"
  },
  "10959": {
    "id": 10959,
    "name": "舞刃者",
    "type": "unit",
    "faction": 0,
    "cost": 5,
    "attack": 4,
    "health": 6,
    "openingDamageFront": 3,
    "description": "登场：正前方随从受到3伤害，包含友军，不能伤害主将。"
  },
  "20168": {
    "id": 20168,
    "type": "spell",
    "name": "迷雾龙印",
    "faction": 2,
    "cost": 1,
    "effect": "mistDragonSeal",
    "target": "ally",
    "attackBuff": 1,
    "healthBuff": 1,
    "followup": "teleport",
    "description": "友方随从永久+1/+1，传送到所选空格。"
  },
  "20129": {
    "id": 20129,
    "type": "spell",
    "name": "交错换位",
    "faction": 2,
    "cost": 0,
    "effect": "juxtaposition",
    "target": "minion",
    "followup": "swap",
    "description": "交换任意两个随从位置；不刷新行动。"
  },
  "20073": {
    "id": 20073,
    "type": "spell",
    "name": "能量虹吸",
    "faction": 3,
    "cost": 0,
    "effect": "siphonEnergy",
    "target": "enemyMinion",
    "nearGeneral": true,
    "description": "驱散主将相邻一名敌方随从的能力、战场强化及脚下腐化地形；培养属性保留。"
  },
  "20077": {
    "id": 20077,
    "type": "spell",
    "name": "熵变衰亡",
    "faction": 3,
    "cost": 4,
    "effect": "entropicDecay",
    "target": "enemyMinion",
    "nearGeneral": true,
    "description": "消灭主将相邻一名敌方随从，触发亡愿与死亡效果。"
  },
  "20049": {
    "id": 20049,
    "type": "spell",
    "name": "恶魔诱引",
    "faction": 4,
    "cost": 2,
    "effect": "daemonicLure",
    "target": "enemyMinion",
    "amount": 1,
    "followup": "teleport",
    "description": "敌方随从受到1伤害，存活时传送至所选空格。"
  },
  "20061": {
    "id": 20061,
    "type": "spell",
    "name": "黑暗转化",
    "faction": 4,
    "cost": 5,
    "effect": "darkTransformation",
    "target": "enemyMinion",
    "deathSpawn": 315,
    "description": "消灭敌方随从，先触发死亡效果，再在原格召唤己方1/1暗灵；原格被占据时不召唤。"
  },
  "20125": {
    "id": 20125,
    "type": "spell",
    "name": "自然选择",
    "faction": 5,
    "cost": 2,
    "effect": "naturalSelection",
    "target": "lowestAttack",
    "description": "消灭全场当前攻击最低或并列最低的一个随从，敌我均可。"
  },
  "20122": {
    "id": 20122,
    "type": "spell",
    "name": "等离子风暴",
    "faction": 5,
    "cost": 5,
    "effect": "plasmaStorm",
    "target": "allMinions",
    "maxAttack": 3,
    "description": "消灭全场当前攻击不超过3的随从，包含友军。"
  },
  "20134": {
    "id": 20134,
    "type": "spell",
    "name": "棱光寒流",
    "faction": 6,
    "cost": 2,
    "effect": "chromaticCold",
    "target": "occupiedCell",
    "amount": 1,
    "description": "驱散所选一格单位与腐化地形；其中敌方单位随后受到1伤害，可选敌将。"
  },
  "20144": {
    "id": 20144,
    "type": "spell",
    "name": "掠食者形态",
    "faction": 6,
    "cost": 2,
    "effect": "aspectRavager",
    "target": "minion",
    "transform": 520,
    "description": "任一随从变为无能力3/3掠食者，保留归属及已消耗行动，不触发死亡或登场。"
  },
  "520": {
    "id": 520,
    "name": "掠食者",
    "type": "unit",
    "faction": 6,
    "cost": 2,
    "attack": 3,
    "health": 3,
    "token": true,
    "description": "无能力，变形"
  }
};
