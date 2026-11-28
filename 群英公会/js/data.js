// 纯数据：种族、职阶、技能、英灵、敌人、设施、特效登记表。可在 Node 中导入（无 DOM）。

export const SAVE_KEY = 'guild-of-legends.save.v1';

export const RANKS = [
  {id: 'F', fame: 0, name: '无名'},
  {id: 'E', fame: 80, name: '新星'},
  {id: 'D', fame: 260, name: '城镇'},
  {id: 'C', fame: 650, name: '王都'},
  {id: 'B', fame: 1400, name: '王国'},
  {id: 'A', fame: 2800, name: '大陆'},
  {id: 'S', fame: 5200, name: '传说'},
];

export const RACES = {
  knight: {name: '骑士团', color: '#f2c75c', home: '西境王国', desc: '恪守誓约的圣光骑士，重视荣誉与秩序。'},
  eastern: {name: '东国武士', color: '#ff6670', home: '东国', desc: '来自东方群岛的剑士与忍者，讲究义理。'},
  desert: {name: '沙海术士', color: '#f0a84a', home: '沙海王朝', desc: '沙海王朝的星象术士与沙漠游侠。'},
  undead: {name: '亡灵', color: '#9d8cff', home: '深渊墓城', desc: '从墓城归来的不死者，被生者排斥。'},
  darkelf: {name: '暗精灵', color: '#c46bff', home: '幽影林海', desc: '幽影林海的暗精灵，骄傲而多疑。'},
  ogre: {name: '食人魔', color: '#d98a55', home: '碎石荒丘', desc: '体格惊人的食人魔，好吃好斗也好哄。'},
  beast: {name: '兽人蛮族', color: '#53c98e', home: '蛮荒古林', desc: '蛮荒古林的兽人与蛮族猎手。'},
  frost: {name: '霜北部族', color: '#86d8ff', home: '霜北冰原', desc: '冰原上的海盗、萨满与女武神后裔。'},
};

// 种族好感基准：负数为宿怨，正数为亲近。未列出为 0。
const RELATION_PAIRS = [
  ['knight', 'undead', -45], ['knight', 'darkelf', -25], ['eastern', 'undead', -15],
  ['ogre', 'beast', -20], ['desert', 'frost', -15], ['darkelf', 'beast', -15],
  ['undead', 'darkelf', 20], ['eastern', 'desert', 10], ['beast', 'frost', 15],
  ['knight', 'frost', 10], ['ogre', 'frost', 10],
];
export function raceRelation(a, b) {
  if (a === b) return 15;
  for (const [x, y, v] of RELATION_PAIRS) if ((x === a && y === b) || (x === b && y === a)) return v;
  return 0;
}

export const ROLES = {
  guard: {name: '守卫', row: 0, range: 'melee', hp: 1.6, atk: 0.7, def: 1.6, interval: 1500},
  fighter: {name: '斗士', row: 0, range: 'melee', hp: 1.2, atk: 1.15, def: 1.0, interval: 1250},
  assassin: {name: '刺客', row: 1, range: 'melee', hp: 0.85, atk: 1.35, def: 0.6, interval: 1000},
  archer: {name: '射手', row: 2, range: 'ranged', hp: 0.8, atk: 1.15, def: 0.55, interval: 1300},
  mage: {name: '术士', row: 2, range: 'ranged', hp: 0.75, atk: 1.3, def: 0.5, interval: 1650},
  cleric: {name: '祭司', row: 2, range: 'ranged', hp: 0.9, atk: 0.6, def: 0.7, interval: 1600},
};

export const TRAITS = {
  bold: {name: '豪爽', desc: '与同伴好感增长 +50%'},
  greedy: {name: '贪财', desc: '对抽成格外敏感'},
  loner: {name: '孤僻', desc: '好感增长减半，但独自专注训练'},
  warlike: {name: '好战', desc: '攻击 +10%，出征更耗体力'},
  loyal: {name: '忠义', desc: '忠诚不易下降'},
  lazy: {name: '懒散', desc: '休息恢复更多，训练收益降低'},
};

// 特效登记表：游戏只按这些键调用，同一个键可被任意单位复用。
// sprite: 来自 Duelyst 包的帧动画；proc: 程序自绘特效（包内没有合适素材时补充）。
export const FX = {
  hitSlash: {sprite: 'fxClawSlash', scale: 1.4},
  hitBlade: {sprite: 'fxImpactRedMed', scale: 1.3},
  hitBlunt: {sprite: 'fxImpactOrangeSmall', scale: 2},
  hitMagic: {sprite: 'fxImpactBlueMed', scale: 1.3},
  hitDark: {sprite: 'fxCollisionSparksPurple', scale: 0.9},
  hitHoly: {sprite: 'fxImpactRingVerticalWhite', scale: 0.9},
  arrow: {sprite: 'f1RangedProjectile', scale: 1.4, projectile: true},
  boltBlue: {sprite: 'fxPlasmaBlueHorizontal', scale: 0.8, projectile: true},
  boltFire: {sprite: 'f5FireBreatherProjectile', scale: 0.7, projectile: true},
  boltDark: {sprite: 'f4GloomchaserProjectile', scale: 2.4, projectile: true},
  boltHoly: {sprite: 'neutralLuxIgnisProjectile', scale: 1.4, projectile: true},
  boulder: {sprite: 'neutralMercGrenadierProjectile', scale: 1.6, projectile: true},
  shieldUp: {sprite: 'ForceField', scale: 1.1},
  healPulse: {sprite: 'fxBuffSimpleGold', scale: 1.1},
  healBig: {sprite: 'fx_f1_lionheartblessing', scale: 0.8},
  buff: {sprite: 'fxBuffSimpleGold', scale: 1.2},
  freeze: {sprite: 'fxFrozenIceBlock', scale: 0.9},
  burn: {sprite: 'fxFaerieFireRed', scale: 0.8},
  breakArmor: {sprite: 'fxCollisionSparksOrange', scale: 1},
  death: {sprite: 'BloodExplosionMedium', scale: 1.6},
  deathDark: {sprite: 'fxTeleportRecallRed', scale: 1.2},
  spawn: {sprite: 'fxTeleportRecallWhite', scale: 1.2},
  cleave: {sprite: 'fx_slashfrenzy', scale: 0.8},
  trueStrike: {sprite: 'fx_f1_truestrike', scale: 0.8},
  twinStrike: {sprite: 'fx_f2_twinstrike', scale: 0.55},
  killingEdge: {sprite: 'fx_f2_killingedge', scale: 0.6},
  phoenix: {sprite: 'fx_f2_phoenixfire', scale: 0.7},
  hailstone: {sprite: 'fx_f6_chromaticcold', scale: 0.7},
  shadowNova: {sprite: 'fx_f4_shadownova', scale: 0.7},
  tremor: {sprite: 'fx_f5_tremor', scale: 0.7},
  lightning: {sprite: 'fxElectricalGroundUpBlue', scale: 1.3},
  chain: {sprite: 'fxChainLightningBlue', scale: 1.5},
  siphon: {sprite: 'fx_f4_curseofagony', scale: 0.55},
  sandBlast: {sprite: 'fx_f3_blast', scale: 0.6},
  starsFury: {sprite: 'fx_f3_starsfury', scale: 0.55},
  doom: {sprite: 'fx_f4_doom', scale: 0.7},
  heavens: {sprite: 'fxHeavensStrike', scale: 0.8},
  fireTornado: {sprite: 'fxFireTornado', scale: 1.2},
  beamFire: {sprite: 'fx_beamfire', scale: 0.55},
  boneSwarm: {sprite: 'fx_f3_boneswarm', scale: 0.7},
  petals: {sprite: 'fx_f2_bbs_petalflurry', scale: 0.6},
  roar: {sprite: 'fx_f1_bbs_roar', scale: 0.6},
  bigBoom: {sprite: 'fxExplosionBigWhiteHot', scale: 2},
  smoke: {sprite: 'fxSmokeGround', scale: 1.2},
  dust: {sprite: 'fxFootStepDust', scale: 2},
  levelUp: {sprite: 'fxYellowTeleporterBeam', scale: 0.8},
  summon: {sprite: 'fxSummonLegendary', scale: 1},
  victory: {sprite: 'fx_winner', scale: 0.9},
  altarSwirl: {sprite: 'fx_ringswirl', scale: 0.5, loop: true},
  forgeSpark: {sprite: 'fx_bigfirehitspark', scale: 0.35},
  // 程序特效：包里没有合适的现成素材
  telegraph: {proc: 'telegraph'},
  interrupt: {proc: 'shatterRing'},
  shockwave: {proc: 'shockwave'},
  coinBurst: {proc: 'coinBurst'},
  unisonFlash: {proc: 'unisonFlash'},
  heartBurst: {proc: 'heartBurst'},
};

// 单张纹理（粒子）——用于场景氛围，由程序粒子系统调用
export const PARTICLE_TEX = {
  glow: 'ptcl_dotorb',
  ash: 'ptcl_ash',
  snow: 'ptcl_snow',
  ring: 'ptcl_ring_glow_circle',
};

const I = id => 'icon-' + id;
export const ICONS = {
  interrupt: I('4ec69d7fca245bfeacc3fe84'),
  rally: I('8fe3811fcb33e8c9981eb990'),
  unison: I('8a061f53f4542404a3ef1f8d'),
};

// 技能：kind 决定引擎逻辑，fx 为特效键，icon 为技能图标
export const SKILLS = {
  holyShield: {name: '圣盾壁垒', kind: 'shieldAll', power: 0.3, cd: 8000, fx: 'shieldUp', icon: I('63cb92ffac30384ab1b51d91'), desc: '全体获得最大生命 30% 的护盾'},
  frostArmor: {name: '霜甲', kind: 'shieldAll', power: 0.22, cd: 7000, fx: 'shieldUp', icon: I('a0b7aea084dc9ed413b1abd6'), desc: '全体获得护盾'},
  stoneSkin: {name: '岩肤', kind: 'shieldSelf', power: 0.6, cd: 6500, fx: 'shieldUp', icon: I('d81011a5f8f65abb79c41a94'), desc: '自身获得大量护盾并嘲讽'},
  cleave: {name: '横扫', kind: 'cleave', power: 1.5, cd: 6000, fx: 'cleave', icon: I('4864d27319e119ef29ed5312'), desc: '对前方两名敌人造成 150% 伤害'},
  trueStrike: {name: '审判一击', kind: 'strikeBreak', power: 2.2, cd: 7000, fx: 'trueStrike', icon: I('2ec9399762ddd666fee9764d'), desc: '220% 伤害并破甲 5 秒'},
  bloodRage: {name: '血怒', kind: 'selfBuff', power: 0.5, cd: 9000, fx: 'roar', icon: I('1dde93f80d94cb80d0861041'), desc: '攻击 +50%，持续 6 秒'},
  twinStrike: {name: '双牙', kind: 'backstab', power: 2.4, cd: 6000, fx: 'twinStrike', icon: I('458b606534be297996ccda46'), desc: '突袭后排，造成 240% 伤害'},
  killingEdge: {name: '杀意之刃', kind: 'backstab', power: 2.8, cd: 7500, fx: 'killingEdge', icon: I('861203d95111a42404eb7921'), desc: '突袭生命最低者，280% 伤害'},
  volley: {name: '箭雨', kind: 'multi', power: 0.9, hits: 3, cd: 6500, fx: 'heavens', icon: I('7f6d94ed500f80f6a7638f4c'), desc: '对三名随机敌人各造成 90% 伤害'},
  phoenix: {name: '凤凰火', kind: 'aoeBurn', power: 1.1, cd: 8000, fx: 'phoenix', icon: I('130319687a750ebf796effdf'), desc: '全体敌人 110% 伤害并灼烧'},
  flashFreeze: {name: '急冻', kind: 'freeze', power: 1.2, cd: 8000, fx: 'hailstone', icon: I('2e5c43a05fb5e046d3a51681'), desc: '冰冻最强敌人 2.5 秒'},
  shadowNova: {name: '暗影新星', kind: 'aoe', power: 1.0, cd: 7000, fx: 'shadowNova', icon: I('eff9e8d4c9430764a796426a'), desc: '全体敌人 100% 伤害'},
  restoringLight: {name: '复苏之光', kind: 'heal', power: 1.8, cd: 5500, fx: 'healPulse', icon: I('dbbd0669eab4ebc0e113686a'), desc: '治疗生命最低的两名同伴'},
  fountain: {name: '青春之泉', kind: 'healAll', power: 1.0, cd: 8000, fx: 'healBig', icon: I('a1e16cb5e8d40cfe724cf58a'), desc: '治疗全体同伴'},
  roar: {name: '战吼', kind: 'teamBuff', power: 0.3, cd: 9000, fx: 'roar', icon: I('02526de834129f8d87162418'), desc: '全体攻击 +30%，持续 6 秒'},
  tremor: {name: '震地', kind: 'aoeStun', power: 0.8, cd: 9000, fx: 'tremor', icon: I('45c1f554a477ce75079ea7e8'), desc: '全体敌人 80% 伤害并眩晕 1 秒'},
  lightning: {name: '连锁闪电', kind: 'multi', power: 1.1, hits: 3, cd: 6500, fx: 'lightning', icon: I('1f614cb60219e7b0713132a3'), desc: '闪电在三名敌人间跳跃'},
  lifeCoil: {name: '生命汲取', kind: 'drain', power: 1.8, cd: 6000, fx: 'siphon', icon: I('fe51efaba185db501f1b68e6'), desc: '180% 伤害并回复等量生命'},
  sandBlast: {name: '沙暴', kind: 'aoe', power: 0.95, cd: 7000, fx: 'sandBlast', icon: I('a51834996edde44f5955b810'), desc: '横扫战场的沙暴'},
  boneSwarm: {name: '骨群', kind: 'aoe', power: 0.9, cd: 7000, fx: 'boneSwarm', icon: I('ed9d9cf48eb767e1597fb6bd'), desc: '召唤骨群冲刷全体敌人'},
  boulderHurl: {name: '投石', kind: 'strikeStun', power: 2.0, cd: 6500, fx: 'hitBlunt', icon: I('673d3ca4a1ab022c232f032a'), desc: '200% 伤害并眩晕 1.5 秒'},
  curse: {name: '苦痛之握', kind: 'strikeBreak', power: 1.6, cd: 6000, fx: 'siphon', icon: I('034c52d4135b140f64f58c65'), desc: '160% 伤害并破甲'},
  // 英灵宝具
  excalibur: {name: '王者之剑', kind: 'aoe', power: 2.0, cd: 9000, fx: 'heavens', icon: I('1f44b07f5c53c1db274b3d64'), desc: '圣光斩向全体敌人，200% 伤害'},
  lionheart: {name: '狮心', kind: 'teamBuff', power: 0.5, cd: 9000, fx: 'healBig', icon: I('2780f621fa193b285c5582db'), desc: '全体攻击 +50%'},
  maidenBanner: {name: '圣女旗帜', kind: 'healAllShield', power: 1.4, cd: 8500, fx: 'healBig', icon: I('fe0bd7c3a755864cfdff4e9e'), desc: '治疗全体并附加护盾'},
  petalFlurry: {name: '花舞', kind: 'multi', power: 1.5, hits: 4, cd: 7000, fx: 'petals', icon: I('6a57e0e611daa9183e847791'), desc: '四连斩，每段 150% 伤害'},
  nitenIchi: {name: '二天一流', kind: 'backstab', power: 3.4, cd: 7000, fx: 'twinStrike', icon: I('0d75e9fcb8c79b6b313ec227'), desc: '340% 伤害的双刀斩'},
  eastWind: {name: '借东风', kind: 'aoeBurn', power: 1.5, cd: 8500, fx: 'fireTornado', icon: I('7e8e4d8f49630eebf8a1b6ea'), desc: '火借风势，全体灼烧'},
  pharaoh: {name: '尼罗之咒', kind: 'aoeStun', power: 1.3, cd: 8500, fx: 'sandBlast', icon: I('630102b7729df69f550f894b'), desc: '全体伤害并眩晕'},
  saladin: {name: '圣城守护', kind: 'shieldAll', power: 0.45, cd: 8000, fx: 'shieldUp', icon: I('1dc82669ee35225faebf8bd6'), desc: '全体获得 45% 护盾'},
  bloodCountess: {name: '血浴', kind: 'drainAll', power: 1.2, cd: 8000, fx: 'doom', icon: I('2a36d062f1abcdab969bffe2'), desc: '吸取全体敌人生命'},
  valkyrie: {name: '女武神之矛', kind: 'strikeBreak', power: 3.0, cd: 7000, fx: 'hailstone', icon: I('0fb84a38631da949be569ce5'), desc: '300% 伤害并破甲'},
  scourge: {name: '上帝之鞭', kind: 'cleave', power: 2.4, cd: 6500, fx: 'tremor', icon: I('c19f6927f1e8f297da3c9b43'), desc: '横扫前方两名敌人 240%'},
  sherwood: {name: '舍伍德箭雨', kind: 'multi', power: 1.3, hits: 5, cd: 7000, fx: 'heavens', icon: I('da06786a38deb0e395e903b8'), desc: '五连射'},
  avalon: {name: '阿瓦隆星落', kind: 'aoe', power: 1.6, cd: 8000, fx: 'starsFury', icon: I('ac8e9fd7d7aa73dabb7a32a3'), desc: '星辰坠落全体伤害'},
  // 首领技能（大招由引擎蓄力，可被打断）
  bossDoom: {name: '灭世', kind: 'aoe', power: 1.0, cd: 99999, fx: 'doom', icon: I('d04272f54d93917db40658a3'), desc: '首领大招'},
};

// 普通招募原型（Duelyst 单位 → 本作角色）
export const ARCHETYPES = [
  // 骑士团
  {id: 'k_guard', race: 'knight', role: 'guard', unit: 'f1_friendsguard', title: '盾卫', skill: 'holyShield', fx: 'hitBlunt'},
  {id: 'k_fighter', race: 'knight', role: 'fighter', unit: 'f1_kingsguard', title: '王庭长枪手', skill: 'trueStrike', fx: 'hitBlade'},
  {id: 'k_archer', race: 'knight', role: 'archer', unit: 'f1_backlinearcher', title: '后卫弩手', skill: 'volley', fx: 'hitSlash', proj: 'arrow'},
  {id: 'k_cleric', race: 'knight', role: 'cleric', unit: 'f1_sunstonetemplar', title: '日石圣殿僧', skill: 'restoringLight', fx: 'hitHoly', proj: 'boltHoly'},
  {id: 'k_fighter2', race: 'knight', role: 'fighter', unit: 'f1_sunforgelancer', title: '日铸枪骑', skill: 'cleave', fx: 'hitBlade'},
  // 东国
  {id: 'e_assassin', race: 'eastern', role: 'assassin', unit: 'f2_hammonnladeseeker', title: '刃忍', skill: 'twinStrike', fx: 'hitSlash'},
  {id: 'e_assassin2', race: 'eastern', role: 'assassin', unit: 'f2_stormkage', title: '风暴影', skill: 'killingEdge', fx: 'hitSlash'},
  {id: 'e_archer', race: 'eastern', role: 'archer', unit: 'f2_flareslinger', title: '焰弹射手', skill: 'volley', fx: 'hitBlunt', proj: 'boltFire'},
  {id: 'e_mage', race: 'eastern', role: 'mage', unit: 'f2_mage4winds', title: '四风术师', skill: 'lightning', fx: 'hitMagic', proj: 'boltBlue'},
  {id: 'e_fighter', race: 'eastern', role: 'fighter', unit: 'f2_onnabugeisha', title: '女武者', skill: 'cleave', fx: 'hitBlade'},
  // 沙海
  {id: 'd_mage', race: 'desert', role: 'mage', unit: 'f3_dunecaster', title: '沙丘术士', skill: 'sandBlast', fx: 'hitMagic', proj: 'boltHoly'},
  {id: 'd_fighter', race: 'desert', role: 'fighter', unit: 'f3_irondervish', title: '铁旋舞者', skill: 'cleave', fx: 'hitBlade'},
  {id: 'd_cleric', race: 'desert', role: 'cleric', unit: 'f3_aymarahealer', title: '艾玛拉医者', skill: 'fountain', fx: 'hitHoly', proj: 'boltHoly'},
  {id: 'd_archer', race: 'desert', role: 'archer', unit: 'f3_ishtarhunter', title: '伊什塔猎手', skill: 'volley', fx: 'hitSlash', proj: 'arrow'},
  {id: 'd_assassin', race: 'desert', role: 'assassin', unit: 'f3_sirocco', title: '热风刺客', skill: 'killingEdge', fx: 'hitSlash'},
  // 亡灵
  {id: 'u_fighter', race: 'undead', role: 'fighter', unit: 'neutral_ghoulie', title: '骷髅剑士', skill: 'cleave', fx: 'hitBlade'},
  {id: 'u_guard', race: 'undead', role: 'guard', unit: 'f4_phantasm', title: '死亡骑士', skill: 'stoneSkin', fx: 'hitDark'},
  {id: 'u_mage', race: 'undead', role: 'mage', unit: 'f4_skullcaster', title: '颅骨术士', skill: 'boneSwarm', fx: 'hitDark', proj: 'boltDark'},
  {id: 'u_cleric', race: 'undead', role: 'cleric', unit: 'neutral_bonereaper', title: '骨镰祭司', skill: 'lifeCoil', fx: 'hitDark', proj: 'boltDark'},
  // 暗精灵
  {id: 'de_assassin', race: 'darkelf', role: 'assassin', unit: 'f4_shadowdancer', title: '影舞者', skill: 'twinStrike', fx: 'hitDark'},
  {id: 'de_mage', race: 'darkelf', role: 'mage', unit: 'f4_nightsorrow', title: '夜哀术士', skill: 'shadowNova', fx: 'hitDark', proj: 'boltDark'},
  {id: 'de_archer', race: 'darkelf', role: 'archer', unit: 'f4_klaxon', title: '幽林射手', skill: 'curse', fx: 'hitDark', proj: 'boltDark'},
  {id: 'de_cleric', race: 'darkelf', role: 'cleric', unit: 'f4_siren', title: '海妖歌者', skill: 'restoringLight', fx: 'hitDark', proj: 'boltDark'},
  // 食人魔
  {id: 'o_fighter', race: 'ogre', role: 'fighter', unit: 'neutral_bloodletter', title: '屠夫', skill: 'bloodRage', fx: 'hitBlunt'},
  {id: 'o_guard', race: 'ogre', role: 'guard', unit: 'f2_ogremonk02', title: '武僧食人魔', skill: 'stoneSkin', fx: 'hitBlunt'},
  {id: 'o_archer', race: 'ogre', role: 'archer', unit: 'neutral_boulderhurler', title: '投石巨汉', skill: 'boulderHurl', fx: 'hitBlunt', proj: 'boulder'},
  {id: 'o_fighter2', race: 'ogre', role: 'fighter', unit: 'neutral_contentiousbrute', title: '好斗蛮汉', skill: 'tremor', fx: 'hitBlunt'},
  // 兽人蛮族
  {id: 'b_fighter', race: 'beast', role: 'fighter', unit: 'f5_ragebinder', title: '狂缚者', skill: 'bloodRage', fx: 'hitBlade'},
  {id: 'b_archer', race: 'beast', role: 'archer', unit: 'neutral_tribalranged1', title: '部族投矛手', skill: 'volley', fx: 'hitSlash', proj: 'arrow'},
  {id: 'b_mage', race: 'beast', role: 'mage', unit: 'neutral_tribalcaster', title: '部族萨满', skill: 'tremor', fx: 'hitMagic', proj: 'boltFire'},
  {id: 'b_assassin', race: 'beast', role: 'assassin', unit: 'f5_molokihuntress', title: '莫洛基女猎', skill: 'killingEdge', fx: 'hitSlash'},
  // 霜北
  {id: 'fr_guard', race: 'frost', role: 'guard', unit: 'f6_tundraguardian', title: '冻原守护', skill: 'frostArmor', fx: 'hitBlunt'},
  {id: 'fr_assassin', race: 'frost', role: 'assassin', unit: 'f6_frostiva', title: '霜刃', skill: 'killingEdge', fx: 'hitSlash'},
  {id: 'fr_archer', race: 'frost', role: 'archer', unit: 'f6_kindredhunter', title: '亲族猎人', skill: 'volley', fx: 'hitSlash', proj: 'arrow'},
  {id: 'fr_mage', race: 'frost', role: 'mage', unit: 'f6_icedryad', title: '冰原树妖', skill: 'flashFreeze', fx: 'hitMagic', proj: 'boltBlue'},
  {id: 'fr_cleric', race: 'frost', role: 'cleric', unit: 'f6_perfectreflection', title: '映冰祭司', skill: 'fountain', fx: 'hitMagic', proj: 'boltBlue'},
];

// 英灵：历史与传说人物。需在英灵祭坛召唤。
export const LEGENDS = [
  {id: 'arthur', name: '亚瑟', title: '不列颠之王', race: 'knight', role: 'fighter', unit: 'f1_3rdgeneral', skill: 'excalibur', fx: 'hitBlade', altar: 1, bio: '拔出石中剑的少年王，相信骑士之间人人平等。'},
  {id: 'joan', name: '贞德', title: '奥尔良圣女', race: 'knight', role: 'cleric', unit: 'f1_altgeneral', skill: 'maidenBanner', fx: 'hitHoly', proj: 'boltHoly', altar: 1, bio: '高举旗帜冲在最前的少女，坚信公会就是她的军团。'},
  {id: 'richard', name: '理查', title: '狮心王', race: 'knight', role: 'guard', unit: 'f1_general', skill: 'lionheart', fx: 'hitBlunt', altar: 2, bio: '一生都在出征，最怕的是无仗可打。'},
  {id: 'mulan', name: '花木兰', title: '代父从军', race: 'eastern', role: 'assassin', unit: 'f2_general', skill: 'petalFlurry', fx: 'hitSlash', altar: 1, bio: '十二年征战无人识破，最讨厌被小看。'},
  {id: 'musashi', name: '宫本武藏', title: '二天一流', race: 'eastern', role: 'fighter', unit: 'f2_altgeneral', skill: 'nitenIchi', fx: 'hitSlash', altar: 2, bio: '六十余战未尝一败的剑豪，常在训练场打坐。'},
  {id: 'zhuge', name: '诸葛亮', title: '卧龙', race: 'eastern', role: 'mage', unit: 'neutral_prophetwhitepalm', skill: 'eastWind', fx: 'hitMagic', proj: 'boltFire', altar: 2, bio: '羽扇轻摇便能看穿委托书里的陷阱。'},
  {id: 'cleopatra', name: '克娄巴特拉', title: '尼罗女王', race: 'desert', role: 'mage', unit: 'f3_altgeneral', skill: 'pharaoh', fx: 'hitMagic', proj: 'boltHoly', altar: 2, bio: '精通九种语言的女王，擅长让敌人互相猜忌。'},
  {id: 'saladin', name: '萨拉丁', title: '沙海苏丹', race: 'desert', role: 'guard', unit: 'f3_general', skill: 'saladin', fx: 'hitBlade', altar: 1, bio: '以宽厚闻名的苏丹，愿意为任何种族的伤员送去冰雪。'},
  {id: 'bathory', name: '巴托里', title: '血色伯爵夫人', race: 'undead', role: 'mage', unit: 'f4_bloodbaronette', skill: 'bloodCountess', fx: 'hitDark', proj: 'boltDark', altar: 3, bio: '从墓城归来的伯爵夫人，对永葆青春有执念。'},
  {id: 'brynhild', name: '布伦希尔德', title: '女武神', race: 'frost', role: 'fighter', unit: 'f6_general', skill: 'valkyrie', fx: 'hitMagic', altar: 3, bio: '被贬下凡间的女武神，在寻找配得上她的战士。'},
  {id: 'attila', name: '阿提拉', title: '上帝之鞭', race: 'beast', role: 'fighter', unit: 'f5_general', skill: 'scourge', fx: 'hitBlunt', altar: 3, bio: '草原尽头的征服者，只尊敬比他更强的人。'},
  {id: 'robin', name: '罗宾汉', title: '舍伍德义贼', race: 'knight', role: 'archer', unit: 'neutral_arrowwhistler', skill: 'sherwood', fx: 'hitSlash', proj: 'arrow', altar: 1, bio: '劫富济贫的神射手，对高抽成的公会嗤之以鼻。'},
  {id: 'merlin', name: '梅林', title: '大魔术师', race: 'darkelf', role: 'mage', unit: 'f3_keeperofages', skill: 'avalon', fx: 'hitMagic', proj: 'boltBlue', altar: 3, bio: '自称有一半暗精灵血统的老魔术师，喜欢预言公会的未来。'},
];

export const NAMES = {
  knight: ['加文', '珀西瓦尔', '罗兰', '艾莉诺', '赛蕾娜', '凯伊', '贝狄威尔', '伊莎贝拉', '崔斯坦', '玛蒂尔达'],
  eastern: ['千代', '小次郎', '阿雪', '半藏', '凛', '十兵卫', '静', '燕青', '鹤', '朔'],
  desert: ['阿米娜', '拉希德', '萨米尔', '莱拉', '哈桑', '纳迪亚', '扎伊德', '赛勒玛'],
  undead: ['骨头先生', '灰烬', '莫尔特', '寂静', '老卡隆', '维克托', '残烛', '叮当'],
  darkelf: ['伊尔卓', '薇芮丝', '扎莉丝', '尼娅', '夜鸦', '奥瑞丝', '卡莉娅', '席恩'],
  ogre: ['大块头', '咕噜', '格罗姆', '饱嗝', '岩拳', '胖丁', '石锅', '烤肉'],
  beast: ['格鲁', '萨尔', '獠牙', '断矛', '红鬃', '阿卡', '霍克', '炽爪'],
  frost: ['英格丽', '比约恩', '西格丽德', '拉格纳', '弗蕾雅', '埃里克', '霜歌', '托尔芬'],
};

export const ENEMIES = {
  bandit: {name: '山贼', unit: 'neutral_mercmelee1', role: 'fighter', fx: 'hitBlade'},
  banditArcher: {name: '山贼弓手', unit: 'neutral_mercranged1', role: 'archer', fx: 'hitSlash', proj: 'arrow'},
  skeleton: {name: '游荡骷髅', unit: 'neutral_mercmelee3', role: 'fighter', fx: 'hitBlade'},
  wolf: {name: '雪原狼', unit: 'f6_snowchaser', role: 'assassin', fx: 'hitSlash'},
  scorpion: {name: '黑沙蝎', unit: 'neutral_monsteronyxscorpion', role: 'fighter', fx: 'hitSlash'},
  crawler: {name: '深渊爬虫', unit: 'f4_crawler', role: 'assassin', fx: 'hitDark'},
  mantis: {name: '裂刃螳螂', unit: 'neutral_monstershreddingmantis', role: 'assassin', fx: 'hitSlash'},
  pirate: {name: '海盗', unit: 'neutral_mercpirate', role: 'fighter', fx: 'hitBlade'},
  golem: {name: '岩石魔像', unit: 'neutral_golemstone', role: 'guard', fx: 'hitBlunt'},
  nightfiend: {name: '夜魔', unit: 'f4_nightfiend', role: 'fighter', fx: 'hitDark'},
  cultist: {name: '邪教术士', unit: 'neutral_merctwilightmage', role: 'mage', fx: 'hitDark', proj: 'boltDark', skill: 'shadowNova'},
  dragonhawk: {name: '龙鹰', unit: 'neutral_monsterdragonhawk', role: 'assassin', fx: 'hitSlash'},
  steelGolem: {name: '钢铁魔像', unit: 'neutral_golemsteel', role: 'guard', fx: 'hitBlunt', skill: 'stoneSkin'},
  blighter: {name: '凋零者', unit: 'neutral_deathblighter', role: 'mage', fx: 'hitDark', proj: 'boltDark', skill: 'boneSwarm'},
  raptor: {name: '迅猛兽', unit: 'f5_silitharveteran', role: 'fighter', fx: 'hitSlash'},
  boneDragon: {name: '骨龙魔像', unit: 'neutral_golemdragonbone', role: 'guard', fx: 'hitBlunt', skill: 'stoneSkin'},
  kolossus: {name: '巨像兽', unit: 'f5_kolossus', role: 'fighter', fx: 'hitBlunt', skill: 'tremor'},
  ravager: {name: '劫掠者', unit: 'f6_ravager', role: 'assassin', fx: 'hitSlash', skill: 'killingEdge'},
  moltenGolem: {name: '熔岩魔像', unit: 'neutral_moltengolem', role: 'guard', fx: 'hitBlunt'},
  abomination: {name: '憎恶', unit: 'f4_abomination', role: 'fighter', fx: 'hitDark', skill: 'cleave'},
  flamewing: {name: '老练焰翼', unit: 'neutral_veteranflamewing', role: 'mage', fx: 'hitBlunt', proj: 'boltFire', skill: 'phoenix'},
  wyvern: {name: '白翼龙', unit: 'f6_whitewyvern', role: 'archer', fx: 'hitMagic', proj: 'boltBlue', skill: 'flashFreeze'},
  darkKnight: {name: '黑暗公会骑士', unit: 'f4_reaperninemoons', role: 'fighter', fx: 'hitDark', skill: 'trueStrike'},
  darkMage: {name: '黑暗公会术士', unit: 'neutral_shadowcaster', role: 'mage', fx: 'hitDark', proj: 'boltDark', skill: 'shadowNova'},
};

export const ENEMY_TIERS = [
  ['bandit', 'banditArcher', 'skeleton', 'wolf'],
  ['skeleton', 'wolf', 'scorpion', 'crawler', 'pirate', 'banditArcher'],
  ['mantis', 'pirate', 'golem', 'nightfiend', 'cultist', 'scorpion'],
  ['dragonhawk', 'steelGolem', 'blighter', 'raptor', 'cultist', 'nightfiend'],
  ['boneDragon', 'kolossus', 'ravager', 'blighter', 'steelGolem', 'raptor'],
  ['moltenGolem', 'abomination', 'flamewing', 'wyvern', 'ravager', 'kolossus'],
  ['abomination', 'flamewing', 'wyvern', 'moltenGolem', 'boneDragon'],
];

export const BOSSES = [
  {id: 'kron', name: '克隆·囚徒之主', unit: 'boss_kron', tier: 1, fx: 'hitBlunt'},
  {id: 'sandpanther', name: '沙海豹王', unit: 'boss_sandpanther', tier: 2, fx: 'hitSlash'},
  {id: 'serpenti', name: '蛇王瑟彭缇', unit: 'boss_serpenti', tier: 2, fx: 'hitSlash'},
  {id: 'wraith', name: '怨灵领主', unit: 'boss_wraith', tier: 3, fx: 'hitDark'},
  {id: 'cindera', name: '烬灭女巫', unit: 'boss_cindera', tier: 3, fx: 'hitBlunt'},
  {id: 'legion', name: '万魂军团', unit: 'boss_legion', tier: 4, fx: 'hitDark'},
  {id: 'boreal', name: '北极巨兽', unit: 'boss_borealjuggernaut', tier: 4, fx: 'hitBlunt'},
  {id: 'chaosknight', name: '混沌骑士', unit: 'boss_chaosknight', tier: 5, fx: 'hitBlade'},
  {id: 'shadowlord', name: '暗影君王', unit: 'boss_shadowlord', tier: 5, fx: 'hitDark'},
  {id: 'skyfall', name: '天坠暴君', unit: 'boss_skyfalltyrant', tier: 6, fx: 'hitMagic'},
  {id: 'solfist', name: '日拳', unit: 'boss_solfist', tier: 6, fx: 'hitBlunt'},
];

export const REGIONS = {
  knight: {name: '西境', sky: ['#1b1638', '#3a2b5c'], ground: '#3b3346', accent: '#f2c75c', particle: 'ash'},
  eastern: {name: '东国', sky: ['#1a1230', '#4a1f3a'], ground: '#3a2a35', accent: '#ff7a8a', particle: 'ash'},
  desert: {name: '沙海', sky: ['#1f1530', '#5c3a2a'], ground: '#5a4232', accent: '#f0a84a', particle: 'ash'},
  undead: {name: '墓城', sky: ['#0d0c1e', '#262049'], ground: '#28243a', accent: '#9d8cff', particle: 'ash'},
  darkelf: {name: '林海', sky: ['#0e1024', '#2b1a46'], ground: '#232233', accent: '#c46bff', particle: 'ash'},
  ogre: {name: '荒丘', sky: ['#18122a', '#40283a'], ground: '#463634', accent: '#d98a55', particle: 'ash'},
  beast: {name: '古林', sky: ['#0d1a22', '#1d3a3a'], ground: '#253530', accent: '#53c98e', particle: 'ash'},
  frost: {name: '冰原', sky: ['#0f1a30', '#2c4a6c'], ground: '#4a5a72', accent: '#86d8ff', particle: 'snow'},
};

export const QUEST_KINDS = [
  {id: 'hunt', name: '讨伐', verb: '讨伐'},
  {id: 'escort', name: '护送', verb: '护送商队穿越'},
  {id: 'clear', name: '清剿', verb: '清剿'},
  {id: 'rescue', name: '营救', verb: '营救被困的'},
];

export const FACILITIES = {
  hall: {name: '酒馆大厅', max: 3, desc: '公会的心脏。等级越高，每日营业收入与来访者越多。', cost: [0, 220, 700], mats: [0, 0, 10], effect: l => `每日营业收入 ≈ ${12 + l * 14} + 声望加成，来访者 ${l + 1} 名`},
  dorm: {name: '宿舍', max: 3, desc: '决定公会成员上限。', cost: [0, 180, 600], mats: [0, 4, 12], effect: l => `成员上限 ${[0, 5, 8, 12][l]}`},
  training: {name: '训练场', max: 3, desc: '留守成员每天获得经验。', cost: [150, 420, 900], mats: [0, 6, 14], effect: l => `留守成员每日经验 +${[0, 12, 24, 40][l]}`},
  cellar: {name: '酒窖', max: 3, desc: '休息恢复更多体力，并提高酒馆收入。', cost: [120, 380, 800], mats: [2, 6, 12], effect: l => `休息体力 +${l * 10}，营业收入 +${l * 15}%`},
  forge: {name: '锻造坊', max: 3, desc: '消耗魔物素材强化成员装备。', cost: [200, 500, 1000], mats: [4, 10, 18], effect: l => `装备最高可强化至 +${l * 2}`},
  altar: {name: '英灵祭坛', max: 3, desc: '以声望为媒介，召唤历史与传说中的英灵。', cost: [400, 900, 1800], mats: [8, 16, 30], effect: l => `可召唤 ${l} 阶英灵`},
};

export const RIVAL_GUILDS = [
  {name: '剑与蔷薇', race: 'knight'},
  {name: '月下刃', race: 'eastern'},
  {name: '金沙商盟', race: 'desert'},
  {name: '骨钟会', race: 'undead'},
  {name: '霜狼兄弟', race: 'frost'},
];

export const SEASON_DAYS = 28;
export const WEEK_DAYS = 7;

// 汇总游戏实际引用的素材，供导入脚本裁剪素材包。
export function assetUsage() {
  const units = new Set();
  for (const a of ARCHETYPES) units.add(a.unit);
  for (const l of LEGENDS) units.add(l.unit);
  for (const e of Object.values(ENEMIES)) units.add(e.unit);
  for (const b of BOSSES) units.add(b.unit);
  const effects = new Set();
  for (const f of Object.values(FX)) if (f.sprite) effects.add(f.sprite);
  for (const t of Object.values(PARTICLE_TEX)) effects.add(t);
  const icons = new Set(Object.values(ICONS));
  for (const s of Object.values(SKILLS)) icons.add(s.icon);
  return {units: [...units].sort(), effects: [...effects].sort(), icons: [...icons].sort()};
}
