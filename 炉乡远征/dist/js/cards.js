import { EXPANSION_RACES } from './expansion-mechanics.js';
import { CONTENT_CARDS } from './content-cards.js';
import { EFFECT_MANIFEST } from './effect-manifest.js';
import { BOSS_CARDS } from './boss-mechanics.js';

export const CARDS = {
  ...CONTENT_CARDS,
  ...BOSS_CARDS,
  10021: { id:10021,name:'山谷猎手',type:'unit',faction:0,cost:2,attack:1,health:2,ranged:true,attackRange:3,description:'远程。' },
  19027: { id:19027,name:'普里姆斯盾卫',type:'unit',faction:0,cost:4,attack:3,health:6,provoke:true,description:'嘲讽。' },
  10981: { id:10981,name:'疗愈秘术师',type:'unit',faction:0,cost:2,attack:2,health:3,openingHeal:2,description:'登场：为损失生命最多的友军恢复2生命，可治疗主将。' },
  10019: { id:10019,name:'位面斥候',type:'unit',faction:0,cost:1,attack:2,health:1,airdrop:true,description:'空投。' },
  19037: { id:19037,name:'普里姆斯拳师',type:'unit',faction:0,cost:2,attack:2,health:3,openingTempAttack:2,description:'登场：相邻最早入场的友方随从本回合增加2攻击。' },
  10012: { id:10012,name:'剑齿猛虎',type:'unit',faction:0,cost:4,attack:3,health:2,rush:true,description:'突袭：召唤当回合即可移动与攻击。' },
  19050: { id:19050,name:'苍角萨满',type:'unit',faction:0,cost:2,attack:1,health:4,dyingAlliedHealth:4,description:'亡愿：相邻友方随从永久增加4生命。' },
  1: {
    id: 1, name: '阿杰农', type: 'general', faction: 1, attack: 2, health: 25,
    description: '战术指令：主将相邻的友方随从永久增加2攻击。'
  },
  23: {
    id: 23, name: '齐兰', type: 'general', faction: 1, attack: 2, health: 25,
    description: '战术指令：为受伤的友方随从恢复3生命。'
  },
  14: {
    id: 14, name: '白银侍从', type: 'unit', faction: 1, cost: 1, attack: 1, health: 4,
    description: ''
  },
  9: {
    id: 9, name: '风刃侍从', type: 'unit', faction: 1, cost: 2, attack: 2, health: 3, zeal: 1,
    description: '邻近己方主将时 +1 攻击。'
  },
  15: {
    id: 15, name: '逐光者', type: 'unit', faction: 1, cost: 2, attack: 3, health: 2, healWatch: true,
    description: '任一单位实际恢复生命时，永久获得 +1 / +1。'
  },
  16: {
    id: 16, name: '旭日少女', type: 'unit', faction: 1, cost: 4, attack: 3, health: 6, zealHeal: true,
    description: '邻近己方主将时，己方回合结束恢复全部生命。'
  },
  11: {
    id: 11, name: '白银骑士', type: 'unit', faction: 1, cost: 3, attack: 1, health: 5, zeal: 2, provoke: true,
    description: '嘲讽。邻近己方主将时 +2 攻击。'
  },
  17: {
    id: 17, name: '铁崖守卫', type: 'unit', faction: 1, cost: 5, attack: 3, health: 10, airdrop: true, provoke: true,
    description: '空投，嘲讽。'
  },
  20174: {
    id: 20174, name: '狮王怒吼', type: 'spell', faction: 1, cost: 1, effect: 'roar',
    description: '主将相邻的一名友方随从永久增加2攻击。'
  },
  20043: {
    id: 20043, name: '日耀圣露', type: 'spell', faction: 1, cost: 1, effect: 'heal',
    description: '为任一受伤单位恢复5生命，敌我均可，包含主将。'
  },
  20066: {
    id: 20066, name: '真理打击', type: 'spell', faction: 1, cost: 1, effect: 'strike',
    description: '对一个随从造成 2 点伤害。'
  },
  20044: {
    id: 20044, name: '风暴', type: 'spell', faction: 1, cost: 2, effect: 'tempest',
    description: '对棋盘上的所有单位造成 2 点伤害。'
  },
  20068: {
    id: 20068, name: '神圣联结', type: 'spell', faction: 1, cost: 3, effect: 'bond',
    description: '任一随从永久增加等同于其当前生命值的攻击，敌我均可。'
  },
  101:{id:101,name:'卡尔奥斯',type:'general',faction:2,attack:2,health:25,description:'宋海主将。'},
  123:{id:123,name:'蕾瓦',type:'general',faction:2,attack:2,health:25,description:'宋海主将。'},
  110:{id:110,name:'凯多刺客',type:'unit',faction:2,cost:2,attack:2,health:3,backstab:1,description:'背刺 1。'},
  115:{id:115,name:'查克里化身',type:'unit',faction:2,cost:2,attack:1,health:2,spellWatch:true,description:'己方每次施法后，永久增加1攻击和1生命。'},
  109:{id:109,name:'寡妇射手',type:'unit',faction:2,cost:3,attack:2,health:3,ranged:true,attackRange:4,description:'远程。'},
  108:{id:108,name:'心猎者',type:'unit',faction:2,cost:1,attack:1,health:1,ranged:true,attackRange:2,description:'远程。'},
  111:{id:111,name:'绯红蝰蛇',type:'unit',faction:2,cost:5,attack:2,health:5,flying:true,backstab:4,description:'飞行，背刺 4。'},
  116:{id:116,name:'四风法师',type:'unit',faction:2,cost:4,attack:4,health:4,spellWatchLeech:1,description:'己方每次施法后，敌方主将受到1伤害，己方主将恢复1生命。'},
  201:{id:201,name:'齐瑞克斯',type:'general',faction:3,attack:2,health:25,description:'维特鲁威主将。'},
  223:{id:223,name:'萨姬',type:'general',faction:3,attack:2,health:25,description:'维特鲁威主将。'},
  213:{id:213,name:'火焰术士',type:'unit',faction:3,cost:2,attack:2,health:1,blast:true,attackRange:3,description:'爆破。'},
  211:{id:211,name:'沙丘塑师',type:'unit',faction:3,cost:2,attack:2,health:1,openingBuff:2,description:'登场：最早入场的友方沙魔永久增加2攻击和2生命；临时沙魔不再消散。'},
  214:{id:214,name:'灵火方尖碑',type:'unit',faction:3,cost:2,attack:0,health:6,obelysk:true,openingDervish:true,description:'不能移动；己方回合开始，在相邻空格召唤2/2沙魔，立即可行动，回合结束消散。'},
  209:{id:209,name:'星火圣甲虫',type:'unit',faction:3,cost:5,attack:4,health:6,blast:true,attackRange:4,description:'爆破。'},
  215:{id:215,name:'金焰方尖碑',type:'unit',faction:3,cost:3,attack:0,health:6,obelysk:true,openingDervish:true,dervishAuraAttack:1,description:'不能移动；己方回合开始召唤相邻2/2临时沙魔。存活时，友方沙魔增加1攻击。'},
  216:{id:216,name:'暮风方尖碑',type:'unit',faction:3,cost:2,attack:0,health:4,obelysk:true,openingDervish:true,dervishAuraHealth:1,description:'不能移动；己方回合开始召唤相邻2/2临时沙魔。存活时，友方沙魔增加1生命。'},
  217:{id:217,name:'沙魔',type:'unit',faction:3,cost:2,attack:2,health:2,dervish:true,token:true,description:'己方回合结束时消散。'},
  225:{id:225,name:'铁甲沙魔',type:'unit',faction:3,cost:1,attack:2,health:2,token:true,description:''},
  301:{id:301,name:'莉莉丝',type:'general',faction:4,attack:2,health:25,description:'深渊主将。'},
  323:{id:323,name:'卡西瓦',type:'general',faction:4,attack:2,health:25,description:'深渊主将。'},
  308:{id:308,name:'深渊爬行者',type:'unit',faction:4,cost:1,attack:2,health:1,creepTrail:true,description:'己方回合结束，在相邻一格留下腐化地形；己方腐化格上的敌人受到1伤害。'},
  317:{id:317,name:'幽暗追猎者',type:'unit',faction:4,cost:2,attack:2,health:2,openingWraith:true,description:'登场：在相邻空格召唤一名1/1暗灵。'},
  311:{id:311,name:'暗影观察者',type:'unit',faction:4,cost:3,attack:2,health:2,deathWatch:true,description:'其他随从死亡时，永久增加1攻击和1生命，敌我均可触发。'},
  309:{id:309,name:'深渊巨兽',type:'unit',faction:4,cost:4,attack:3,health:3,creepStats:1,description:'每格己方腐化地形使其获得 +1 / +1；随地形数量变化。'},
  310:{id:310,name:'血月祭司',type:'unit',faction:4,cost:4,attack:3,health:3,deathWatchSpawn:315,description:'其他随从死亡时，在附近空地召唤一名暗灵。'},
  316:{id:316,name:'暗脊元素',type:'unit',faction:4,cost:2,attack:1,health:4,creepDamageMultiplier:2,description:'己方腐化地形造成的伤害翻倍。'},
  315:{id:315,name:'暗灵',type:'unit',faction:4,cost:1,attack:1,health:1,token:true,description:''},
  401:{id:401,name:'瓦斯',type:'general',faction:5,attack:2,health:25,description:'玛格玛主将。'},
  418:{id:418,name:'星角',type:'general',faction:5,attack:2,health:25,description:'玛格玛主将。'},
  406:{id:406,name:'法兰克萨',type:'unit',faction:5,cost:2,attack:6,health:1,description:''},
  412:{id:412,name:'幼年希利萨',type:'unit',faction:5,cost:2,attack:2,health:3,rebirth:true,description:'重生。'},
  410:{id:410,name:'原始凝视者',type:'unit',faction:5,cost:3,attack:2,health:2,openingBuff:2,description:'登场：相邻最早入场的友方随从永久增加2攻击和2生命。'},
  402:{id:402,name:'大地行者',type:'unit',faction:5,cost:3,attack:3,health:3,grow:1,description:'成长 1：己方回合开始时永久获得 +1 / +1。'},
  404:{id:404,name:'科洛苏斯',type:'unit',faction:5,cost:5,attack:1,health:7,grow:4,description:'成长 4：己方回合开始时永久获得 +4 / +4。'},
  413:{id:413,name:'成年希利萨',type:'unit',faction:5,cost:4,attack:4,health:4,rebirth:true,description:'重生。'},
  411:{id:411,name:'重生之卵',type:'unit',faction:5,cost:0,attack:0,health:1,token:true,description:'不能移动；存活至下个己方回合开始，孵化为原随从，恢复基础属性并可行动。'},
  501:{id:501,name:'费伊',type:'general',faction:6,attack:2,health:25,description:'瓦纳尔主将。'},
  527:{id:527,name:'卡拉',type:'general',faction:6,attack:2,health:25,description:'瓦纳尔主将。'},
  505:{id:505,name:'水晶潜伏者',type:'unit',faction:6,cost:2,attack:2,health:3,infiltrate:2,description:'位于敌方半场时增加2攻击，中央列不计入。'},
  506:{id:506,name:'水晶精灵',type:'unit',faction:6,cost:2,attack:1,health:1,manaWisp:true,description:'亡愿：己方法力上限增加1，最高9。'},
  503:{id:503,name:'芬里尔战主',type:'unit',faction:6,cost:3,attack:3,health:2,dyingWolf:504,description:'亡愿：在原格召唤一名3/2幽灵狼。'},
  526:{id:526,name:'极地迁跃兽',type:'unit',faction:6,cost:5,attack:10,health:4,airdrop:true,description:'空投。'},
  511:{id:511,name:'狼鸦',type:'unit',faction:6,cost:3,attack:1,health:4,flying:true,infiltrate:3,description:'飞行；位于敌方半场时增加3攻击，中央列不计入。'},
  513:{id:513,name:'剃刀背兽',type:'unit',faction:6,cost:4,attack:4,health:3,openingAlliedAttack:2,description:'登场：其他己方随从本回合获得 +2 攻击。'},
  504:{id:504,name:'幽灵狼',type:'unit',faction:6,cost:2,attack:3,health:2,token:true,description:''},
  525:{id:525,name:'寒骨屏障',type:'unit',faction:6,cost:1,attack:0,health:2,wall:true,token:true,description:'冰墙：主动攻击它的单位被眩晕。'},
  20081:{id:20081,name:'凤凰火',type:'spell',faction:2,cost:2,effect:'phoenixFire',amount:3,target:'enemy',description:'对一个敌人造成 3 点伤害。'},
  20086:{id:20086,name:'内在专注',type:'spell',faction:2,cost:1,effect:'innerFocus',refresh:true,maxAttack:3,target:'ally',description:'攻击不高于3的友方随从可立即移动和攻击；不解除眩晕。'},
  20095:{id:20095,name:'第一愿望',type:'spell',faction:3,cost:1,effect:'firstWish',attackBuff:1,healthBuff:1,draw:1,target:'ally',description:'友方随从永久增加1攻击和1生命；抽1张牌。'},
  20151:{id:20151,name:'骨沙虫群',type:'spell',faction:3,cost:2,effect:'boneSwarm',amount:2,target:'enemyArea',description:'对敌方主将及其附近敌军造成 2 点伤害。'},
  20052:{id:20052,name:'虚空脉冲',type:'spell',faction:4,cost:1,effect:'voidPulse',amount:2,heal:3,target:'enemy',description:'对敌方主将造成 2 点伤害；己方主将恢复3生命。'},
  20072:{id:20072,name:'暗灵虫群',type:'spell',faction:4,cost:3,effect:'wraithlingSwarm',summon:315,count:3,target:'cell',description:'在所选空格及相邻空格召唤最多3名1/1暗灵。'},
  20116:{id:20116,name:'强健术',type:'spell',faction:5,cost:1,effect:'greaterFortitude',attackBuff:2,healthBuff:2,target:'ally',description:'友方随从永久增加2攻击和2生命。'},
  20117:{id:20117,name:'大地之球',type:'spell',faction:5,cost:4,effect:'earthSphere',heal:8,target:'self',description:'己方主将恢复 8 点生命。'},
  20139:{id:20139,name:'瞬间冻结',type:'spell',faction:6,cost:0,effect:'flashFreeze',amount:1,stun:true,target:'minion',description:'对一个随从造成 1 点伤害并眩晕。'},
  20149:{id:20149,name:'寒骨屏障',type:'spell',faction:6,cost:2,effect:'bonechillBarrier',summon:525,count:3,target:'cell',description:'在所选空格及相邻空格召唤最多3面0/2冰墙；主动攻击冰墙的单位被眩晕。'}
};

// Body animation names and timings come from the original RSX, including Ziran's separate atlas.
for (const card of Object.values(CARDS)) {
  if(EXPANSION_RACES[card.id])card.race=EXPANSION_RACES[card.id];
  // Boss tokens borrow an original unit's body and effect recipes.
  if (card.spriteFrom) EFFECT_MANIFEST.cardRecipes[card.id] ??= EFFECT_MANIFEST.cardRecipes[card.spriteFrom];
  const body = EFFECT_MANIFEST.bodies[card.spriteFrom ?? card.id];
  if (card.type === 'spell' && EFFECT_MANIFEST.spellArt?.[card.id]) card.art = EFFECT_MANIFEST.spellArt[card.id];
  if (!body) continue;
  card.sprite = { sheet: body.sheet, plist: body.plist };
  for (const [state, animation] of Object.entries(body.states)) {
    card.sprite[`${state}Prefix`] = animation.prefix;
    card.sprite[`${state}FrameMs`] = animation.frameMs;
  }
}

export const DECK_LIST = [
  [14, 3], [9, 3], [15, 3], [16, 2], [11, 3], [17, 2],
  [20043, 3], [20066, 3], [20044, 2], [20068, 1]
].flatMap(([id, copies]) => Array(copies).fill(id));

export function getCard(id) {
  return CARDS[id] ?? null;
}
