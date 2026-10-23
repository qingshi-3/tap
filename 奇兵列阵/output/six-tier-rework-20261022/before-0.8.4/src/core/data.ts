import type { ActiveFaction, Effect, Faction, Rarity, Tri, Trigger, UnitDef } from './types';

// v0.8 卡表：6 阵营 × 16 + 中立 16 = 112。文案里的 [a,b,c] 表示 1/2/3★ 数值，自动展开为每星文案。
// 每回合按站位逐轮行动，每次交锋双方各最多一人同时结算；带「施法：」的单位出手时执行施法，不普攻。
export { GENERALS, GENERAL_MAP } from './content';

/** 卡面可点开说明的词：关键词 + 规则词 */
export const KEYWORDS: Record<string, string> = {
  格挡: '状态。抵消下一次伤害（不论大小），消耗 1 层，最多 3 层。灼烧无视格挡。',
  护甲: '特性。每次受到的伤害 −N，最少为 1。灼烧无视护甲。',
  复生: '特性。第一次阵亡时，在原位以 1 生命复活。被放逐者击杀则不能复生。',
  寒意: '状态。获得后立即影响接下来的出手：普攻攻击 −N（最少 1），出手后清空。施法前也检查冻结。',
  灼烧: '状态。每次交锋结束时受 N 伤害，然后 −1 层。无视格挡和护甲。',
  溅射: '特性。普攻时，目标身后一名敌人受本次攻击力一半的伤害（向下取整，最少 1）。连击只在第一段溅射。',
  连击: '特性。一次普攻内打两段，每段为本次攻击力的一半（向上取整）。追击也可触发连击。',
  狙击: '特性。普攻改打敌方队尾。',
  反击: '特性。被普攻命中时，对攻击者造成 N 伤害；被格挡也触发，连击每段各触发一次。',
  法强: '特性。自己施法（含蓄力技）的伤害、治疗、灼烧、寒意数值 +N（只强化自己）；作用于全体的效果只 +N/2（向下取整）。',
  嘲讽: '特性。敌方普攻（含狙击、决斗）改打最靠前的嘲讽单位。技能不受影响。',
  轮换: '特性。每次常规行动后退到我方队尾，其余友军前移。追击后不轮换。',
  成为队首时: '时机。战斗中因轮换、友军阵亡、召唤插入或换位成为队首时触发；开战时已在队首不触发，每次交锋每单位最多一次。',
  在队尾时: '时机。每次交锋结束时，这个单位位于我方队尾就触发（只剩它一人时不算）。',
  决斗: '特性。普攻打当前与自己同格的敌人，空位则打队首；嘲讽优先拦截。一次连击锁定同一目标，追击重新选择。',
  击败对手: '时机。带决斗的单位用普攻或追击击杀本次锁定目标时触发，包含拦截的嘲讽单位；技能、灼烧和溅射旁伤不计。',
  蓄力: '特性。蓄力 N：每次常规行动后 +1 蓄力；满 N 时，下一次常规行动改为释放蓄力技，然后清零。被冻结跳过的行动不蓄力。蓄力技能计施法并享受法强；强化普攻仍算普攻。',
  节拍: '特性。节拍 N：每 N 次交锋结束时触发一次效果，不需要行动。',
  亡语: '时机。阵亡时触发，即使随后复生也照样触发。被放逐者击杀时不触发。',
  不行动: '特性。这个单位从不出手，也不占用行动轮。',
  冻结: '出手前，寒意 ≥ 本次攻击力时，跳过本次出手并清空寒意；常规行动机会仍被消耗。追击也检查冻结。',
  追击: '冲出队列，立刻普攻一次。不施法、不消耗行动次数、不蓄力、不轮换，仍受寒意影响。追击引发的效果不会再引发追击（主将被动「连锁」允许再引发一次）。',
  行动次数: '每单位每回合默认 1 次常规行动，同一行动轮每人至多一次；双方本轮全部完成后，有剩余次数者再进入下一行动轮。增加的次数仅本回合有效。',
  献祭: '使一名友军直接阵亡，无视格挡和护甲，正常触发亡语和复生。',
  召唤: '召唤物插到召唤者身后（召唤者已阵亡则放在原位），其余友军后移；满员时最近的友军获得召唤物一半的属性。召唤物当回合不行动；亡语召唤的继承死者剩余的行动次数。',
  施法: '按卡面释放技能，普通施法、蓄力技能和光誓均触发施法后。法涌、余韵追加也消耗该技能剩余次数，不再触发复制；普通施法无目标或次数用完时改普攻。',
  放逐: '被它击杀的单位不能复生，也不触发亡语。',
  先机: '法伊使敌人延后行动的时段；具体回合与范围见主将技能和被动。',
  压轴者: '卡雷奥斯指定的友军：默认本回合最后完成常规行动者，首发改为第一个。',
  星轨: '齐瑞克斯积满4星能后交换敌方站位的技能；换位受锚定影响。',
};
const KW = ['格挡', '护甲', '复生', '寒意', '灼烧', '溅射', '连击', '狙击', '反击', '法强', '嘲讽', '轮换', '成为队首时', '在队尾时', '决斗', '击败对手',
  '蓄力', '节拍', '亡语', '不行动', '冻结', '追击', '行动次数', '献祭', '召唤', '放逐'];

const TRI = /\[(\d+),(\d+),(\d+)\]/g;
const atStar = (text: string, i: number) => text.replace(TRI, (_, a, b, c) => [a, b, c][i]);
const fx = (op: Effect['op'], to: Effect['to'], v?: Tri, o: Partial<Effect> = {}): Effect => ({ op, to, ...(v ? { v } : {}), ...o });
const t3 = (n: number): Tri => [n, n, n];

/** 卡牌构造：从文案提取每星文案、主数值与关键词；tags 用「·」分隔 */
function C(id: string, name: string, faction: Faction, tier: Rarity, atk: number, hp: number, trigger: Trigger,
  text: string, tags: string, o: Partial<UnitDef> = {}): UnitDef {
  const m = /\[(\d+),(\d+),(\d+)\]/.exec(text);
  const starText = o.starText ?? [0, 1, 2].map(i => atStar(text, i)) as [string, string, string];
  const keywords = KW.filter(k => starText.some(s => s.includes(k)));
  if (o.cast && !keywords.includes('施法')) keywords.push('施法');
  return {
    id, name, faction, tier, atk, hp, trigger, text: starText[0], starText,
    ...(m ? { values: [+m[1], +m[2], +m[3]] as Tri } : {}),
    keywords, tags: tags ? tags.split('·') : [], ...o,
  };
}
const enemy = (id: string, name: string, atk: number, hp: number, trigger: Trigger, text: string, o: Partial<UnitDef> = {}) =>
  C(id, name, 'enemy', 1, atk, hp, trigger, text, '', { enemyOnly: true, ...o });
/** 召唤物：身材由召唤者决定 */
const token = (id: string, name: string, faction: Faction, atk: number, hp: number, text: string, o: Partial<UnitDef> = {}) =>
  C(id, name, faction, 1, atk, hp, 'none', text, '', { token: true, ...o });
/** 主将专属单位（阿尔吉昂、龙蛋与龙）：不进招募池 */
const unique = (id: string, name: string, faction: Faction, atk: number, hp: number, trigger: Trigger, text: string, tags: string, o: Partial<UnitDef> = {}) =>
  C(id, name, faction, 3, atk, hp, trigger, text, tags, { unique: true, ...o });

export const UNITS: UnitDef[] = [
  // ── 圣光：车轮战 + 格挡坚守 + 复生 ──
  C('l_shield', '银盾侍卫', 'light', 1, 2, 5, 'front', '轮换；成为队首时：获得 [1,2,2] 层格挡', '前排·轮换·给格挡',
    { traits: { rotate: true }, onFront: [fx('block', 'self', [1, 2, 2])] }),
  C('l_martyr', '殉道者', 'light', 1, 1, 4, 'rattle', '复生；亡语：身后一名友军获得 [1,2,3] 层格挡', '前排·亡语·复生·给格挡',
    { traits: { reborn: true }, onRattle: [fx('block', 'behind', [1, 2, 3])] }),
  C('l_vigil', '守誓者', 'light', 1, 2, 5, 'rear', '在队尾时：我方队首获得 [1,1,2] 层格挡', '辅助·轮换·给格挡',
    { onRear: [fx('block', 'front', [1, 1, 2])] }),
  C('l_warden', '晨光盾卫', 'light', 1, 2, 6, 'start', '嘲讽；开战时：获得 [1,2,2] 层格挡；自己每消耗 1 层格挡：本场护甲 +1', '前排·嘲讽·吃格挡',
    { traits: { taunt: true }, onStart: [fx('block', 'self', [1, 2, 2])], values: t3(1), special: 'warden' }),
  C('l_windblade', '风刃剑士', 'light', 1, 3, 4, 'front', '轮换；成为队首时：本回合 +[2,3,4] 攻', '输出·轮换',
    { traits: { rotate: true }, onFront: [fx('buff', 'self', [2, 3, 4], { temp: true })] }),
  C('l_priest', '圣光牧师', 'light', 2, 1, 6, 'cast', '施法：生命最低的受伤友军恢复 [4,6,8] 生命', '施法·辅助',
    { cast: [fx('heal', 'lowest', [4, 6, 8])] }),
  C('l_knight', '晨曦骑士', 'light', 2, 3, 7, 'rattle', '复生；复活时：获得 [1,2,3] 层格挡', '前排·复生·给格挡',
    { traits: { reborn: true }, onRevive: [fx('block', 'self', [1, 2, 3])] }),
  C('l_lion', '蔚蓝雄狮', 'light', 2, 4, 5, 'attack', '普攻伤害 + 自己的格挡层数 ×[1,2,3]', '输出·吃格挡', { special: 'lion' }),
  C('l_archer', '晨星弓手', 'light', 2, 2, 5, 'rear', '轮换；在队尾时：敌方队尾受 [2,3,4] 伤害', '输出·轮换',
    { traits: { rotate: true }, onRear: [fx('dmg', 'enemyRear', [2, 3, 4])] }),
  C('l_mender', '辉光医者', 'light', 3, 1, 8, 'cast', '施法：全体友军恢复 [2,3,4] 生命', '施法·辅助',
    { cast: [fx('heal', 'allies', [2, 3, 4])] }),
  C('l_banner', '誓约骑将', 'light', 3, 4, 8, 'passive', '友军每消耗 1 层格挡：该友军本场 +[1,2,3] 攻', '辅助·吃格挡', { special: 'banner' }),
  C('l_cliff', '铁崖守护者', 'light', 3, 3, 10, 'passive', '嘲讽；被普攻后：获得 [1,2,2] 层格挡（每次交锋限 1 次）', '前排·嘲讽·给格挡',
    { traits: { taunt: true }, special: 'cliff' }),
  C('l_storm', '风暴剑圣', 'light', 3, 4, 7, 'front', '轮换；任一友军成为队首时：自己本场 +1 攻（每回合最多 +[2,3,3]）', '输出·轮换·吃轮换',
    { traits: { rotate: true }, onAllyFront: [fx('buff', 'self', t3(1), { cap: [2, 3, 3] })] }),
  C('l_archon', '曙光执政官', 'light', 4, 4, 10, 'start', '开战时：全体友军获得复生', '辅助·复生',
    { starText: ['开战时：全体友军获得复生', '开战时：全体友军获得复生和 1 层格挡', '开战时：全体友军获得复生和 2 层格挡'],
      onStart: [fx('grant', 'allies', undefined, { grant: 'reborn' }), fx('block', 'allies', [0, 1, 2])] }),
  C('l_sunriser', '旭日守望', 'light', 4, 4, 9, 'pulse', '节拍 3：生命最高的友军获得 [2,3,3] 层格挡（开战时也触发一次）', '辅助·给格挡·节拍',
    { traits: { pulse: 3 }, onStart: [fx('block', 'highestHp', [2, 3, 3])], onPulse: [fx('block', 'highestHp', [2, 3, 3])] }),
  C('l_caliber', '圣铸机兵', 'light', 4, 5, 10, 'passive', '友军轮换时：新的队首本场 +[1,2,3]/+[1,2,3]（每回合最多 3 次）', '辅助·吃轮换',
    { special: 'caliber' }),

  // ── 暗影：连击追击 + 决斗 ──
  C('s_wind', '风刃学徒', 'shadow', 1, 3, 3, 'passive', '连击', '输出·连击',
    { starText: ['连击', '连击；普攻后：自己本场 +1 攻', '连击；普攻后：自己本场 +2 攻'],
      traits: { combo: true }, afterAttack: [fx('buff', 'self', [0, 1, 2])] }),
  C('s_backstab', '背刺者', 'shadow', 1, 3, 4, 'duel', '决斗；击败对手时：本场 +[1,2,3] 攻并追击一次', '输出·决斗·追击',
    { traits: { duel: true }, onDuelKill: [fx('buff', 'self', [1, 2, 3]), fx('extraAct', 'self')] }),
  C('s_dancer', '影舞者', 'shadow', 1, 1, 5, 'cast', '施法：让攻击最高的友军追击一次', '施法·辅助·追击',
    { starText: ['施法：让攻击最高的友军追击一次', '施法：让攻击最高的友军追击一次，该次攻击 +1', '施法：让攻击最高的友军追击一次，该次攻击 +2'],
      cast: [fx('extraAct', 'highestAtk', [0, 1, 2])] }),
  C('s_fox', '灯笼狐', 'shadow', 1, 2, 4, 'duel', '决斗；普攻对手后：对手本场攻击 −[1,2,2]', '输出·决斗',
    { traits: { duel: true }, afterAttack: [fx('weaken', 'opponent', [1, 2, 2])] }),
  C('s_step', '影步刺客', 'shadow', 1, 2, 4, 'passive', '轮换；连击', '输出·轮换·连击', { traits: { rotate: true, combo: true } }),
  C('s_dart', '飞镖手', 'shadow', 2, 1, 5, 'cast', '施法：敌方队尾受 [3,4,6] 伤害', '施法·输出',
    { cast: [fx('dmg', 'enemyRear', [3, 4, 6])] }),
  C('s_ninja', '连环忍者', 'shadow', 2, 3, 5, 'kill', '连击；击杀时：追击一次', '输出·连击·追击',
    { starText: ['连击；击杀时：追击一次', '连击；击杀时：本场 +1 攻，并追击一次', '连击；击杀时：本场 +2 攻，并追击一次'],
      traits: { combo: true }, onKill: [fx('buff', 'self', [0, 1, 2]), fx('extraAct', 'self')] }),
  C('s_monk', '碎骨武僧', 'shadow', 2, 3, 6, 'duel', '决斗；普攻目标攻击高于自己时：本次伤害 +[2,3,4]', '输出·决斗', { traits: { duel: true }, special: 'monk' }),
  C('s_viper', '赤蛇刺客', 'shadow', 2, 3, 4, 'duel', '决斗；本次锁定的决斗目标阵亡时（不论谁击杀）：追击一次', '输出·决斗·追击',
    { traits: { duel: true }, special: 'viper' }),
  C('s_hunter', '暗隙猎手', 'shadow', 3, 4, 6, 'kill', '狙击；击杀时：自己本场 +[2,3,4]/+[2,3,4]', '输出·狙击',
    { traits: { snipe: true }, onKill: [fx('buff', 'self', [2, 3, 4], { v2: [2, 3, 4] })] }),
  C('s_choreo', '刃影导师', 'shadow', 3, 2, 6, 'start', '开战时：相邻友军中攻击最高的一名获得连击', '辅助·给连击',
    { starText: ['开战时：相邻友军中攻击最高的一名获得连击', '开战时：相邻友军中攻击最高的一名获得连击，攻击 +1', '开战时：相邻友军中攻击最高的一名获得连击，攻击 +2'],
      lockTargets: true, onStart: [fx('grant', 'adjHighestAtk', undefined, { grant: 'combo' }), fx('buff', 'adjHighestAtk', [0, 1, 2])] }),
  C('s_caster', '四风术士', 'shadow', 3, 1, 6, 'cast', '法强 +1；施法：敌方攻击最高的单位受 [3,4,6] 伤害，本场攻击 −1', '施法·输出·法强',
    { lockTargets: true, traits: { power: t3(1) }, cast: [fx('dmg', 'enemyHighestAtk', [3, 4, 6]), fx('weaken', 'enemyHighestAtk', t3(1))] }),
  C('s_xyle', '岚刃剑客', 'shadow', 3, 4, 6, 'duel', '决斗；连击；每段普攻对有护甲的目标伤害 +[2,3,4]', '输出·决斗·连击',
    { traits: { duel: true, combo: true }, special: 'armorPiercer' }),
  C('s_master', '千刃宗师', 'shadow', 4, 6, 10, 'passive', '连击；我方每段普攻命中后：敌方队尾受 [1,2,2] 伤害', '输出·连击',
    { traits: { combo: true }, special: 'master' }),
  C('s_lord', '岚影宗主', 'shadow', 4, 4, 9, 'start', '开战时：攻击最高的友军获得决斗和连击', '辅助·给决斗·给连击',
    { starText: ['开战时：攻击最高的友军获得决斗和连击', '开战时：攻击最高的友军获得决斗和连击，攻击 +1', '开战时：攻击最高的友军获得决斗和连击，攻击 +2'],
      lockTargets: true,
      onStart: [fx('grant', 'highestAtk', undefined, { grant: 'duel' }), fx('grant', 'highestAtk', undefined, { grant: 'combo' }), fx('buff', 'highestAtk', [0, 1, 2])] }),
  C('s_panda', '熊猫武尊', 'shadow', 4, 6, 12, 'duel', '任一友军击败对手时：全体友军本场 +1 攻（每回合最多 [1,1,2] 次）', '辅助·吃决斗',
    { special: 'panda' }),

  // ── 深渊：亡语 + 法强（蓄力吟诵） ──
  C('a_seed', '幽火灵蛇', 'abyss', 1, 1, 3, 'rattle', '亡语：召唤 2 个 [1,2,3]/[1,2,3] 暗影', '亡语·召唤',
    { onRattle: [fx('summon', 'self', [1, 2, 3], { v2: [1, 2, 3], token: 't_shade', count: 2 })] }),
  C('a_devour', '吞噬者', 'abyss', 1, 1, 5, 'cast', '施法：敌方队首受 [3,4,6] 伤害', '施法·输出',
    { cast: [fx('dmg', 'enemyFront', [3, 4, 6])] }),
  C('a_graveguard', '墓园守卫', 'abyss', 1, 2, 7, 'rattle', '嘲讽；亡语：身后一名友军获得复生', '前排·嘲讽·亡语·复生',
    { traits: { taunt: true }, onRattle: [fx('grant', 'behind', undefined, { grant: 'reborn' })] }),
  C('a_spine', '暗棘', 'abyss', 1, 2, 5, 'rattle', '复生；亡语：敌方队首受 [2,3,4] 伤害', '前排·复生·亡语',
    { traits: { reborn: true }, onRattle: [fx('dmg', 'enemyFront', [2, 3, 4])] }),
  C('a_imp', '残魂小鬼', 'abyss', 1, 1, 2, 'rattle', '亡语：攻击最高的友军本场 +[2,3,4] 攻', '亡语·辅助',
    { onRattle: [fx('buff', 'highestAtk', [2, 3, 4])] }),
  C('a_reaper', '灵魂收割者', 'abyss', 2, 3, 5, 'ally', '任一友军阵亡时：敌方队首受 [2,3,4] 伤害', '输出·吃亡语',
    { onAllyFaint: [fx('dmg', 'enemyFront', [2, 3, 4])] }),
  C('a_cult', '献祭术士', 'abyss', 2, 1, 5, 'cast', '法强 +1；施法：敌方队首受 [2,3,5] 伤害；亡语：相邻友军本场法强 +[1,2,3]', '施法·输出·法强·亡语·给法强',
    { traits: { power: t3(1) }, cast: [fx('dmg', 'enemyFront', [2, 3, 5])], onRattle: [fx('grant', 'adjacent', [1, 2, 3], { grant: 'power' })] }),
  C('a_brood', '育魂者', 'abyss', 2, 2, 7, 'passive', '相邻友军法强 +[1,2,2]', '辅助·给法强', { special: 'brood' }),
  C('a_chanter', '魂缚吟者', 'abyss', 2, 2, 6, 'charge', '法强 +2；蓄力 2；蓄力技：全体敌人受 [2,3,4] 伤害', '输出·法强·蓄力',
    { traits: { power: t3(2), charge: 2 }, chargeSkill: [fx('dmg', 'enemyAll', [2, 3, 4])] }),
  C('a_ritualist', '唤亡祭师', 'abyss', 3, 1, 5, 'cast', '施法：第一个阵亡的友军以一半生命复活，插到自己身后（本场最多 [1,1,2] 次，用完改普攻）', '施法·辅助·亡语',
    { cast: [fx('revive', 'self')], castUses: [1, 1, 2] }),
  C('a_jugg', '深渊巨兽', 'abyss', 3, 3, 11, 'ally', '任一友军阵亡时：全体友军本场 +1 攻（每回合最多 [1,2,2] 次）', '前排·吃亡语',
    { onAllyFaint: [fx('buff', 'allies', t3(1), { cap: [1, 2, 2] })] }),
  C('a_engulf', '吞噬之影', 'abyss', 3, 1, 7, 'cast', '法强 +[1,1,2]；施法：敌方生命最低的单位受 [3,4,5] 伤害；击杀时：相邻友军本场法强 +1', '施法·输出·给法强·法强',
    { traits: { power: [1, 1, 2] }, cast: [fx('dmg', 'enemyLowest', [3, 4, 5])], onKill: [fx('grant', 'adjacent', t3(1), { grant: 'power' })] }),
  C('a_nightmare', '夜魇', 'abyss', 3, 3, 8, 'rattle', '亡语：召唤一个带嘲讽的 [2,3,4]/[3,5,7] 夜影', '亡语·召唤·嘲讽',
    { onRattle: [fx('summon', 'self', [2, 3, 4], { v2: [3, 5, 7], token: 't_night' })] }),
  C('a_matriarch', '深渊主母', 'abyss', 4, 4, 11, 'passive', '你的亡语触发两次', '前排·吃亡语', { special: 'matriarch' }),
  C('a_solus', '永夜吟诵者', 'abyss', 4, 3, 9, 'passive', '友军施法后：该友军本场法强 +[1,2,3]', '辅助·给法强·吃施法', { special: 'solus' }),
  C('a_void', '虚空吞噬者', 'abyss', 4, 6, 12, 'round', '每回合开始时：献祭我方队尾的其他友军，自己本场获得其一半攻击和生命', '前排·亡语·献祭',
    { special: 'devourer' }),

  // ── 熔岩：灼烧 + 溅射成长 + 蛋 ──
  C('m_egg', '幼兽蛋', 'magma', 1, 0, 5, 'pulse', '不行动；节拍 3：破壳（视为阵亡）；亡语：召唤 [3,4,6]/[3,4,6] 幼兽', '召唤·亡语·节拍',
    { traits: { idle: true, pulse: 3 }, onPulse: [fx('die', 'self')], onRattle: [fx('summon', 'self', [3, 4, 6], { v2: [3, 4, 6], token: 't_hatch' })] }),
  C('m_shaman', '原始萨满', 'magma', 1, 1, 5, 'cast', '施法：敌方队首获得 [3,4,5] 层灼烧', '施法·给灼烧',
    { cast: [fx('burn', 'enemyFront', [3, 4, 5])] }),
  C('m_hide', '厚皮兽', 'magma', 1, 2, 7, 'hurt', '受击时：自己本场 +[1,2,3] 攻', '前排', { onHurt: [fx('buff', 'self', [1, 2, 3])] }),
  C('m_raptor', '白鬃猎龙', 'magma', 1, 3, 4, 'attack', '连击；普攻后：目标获得 [1,2,3] 层灼烧', '输出·连击·给灼烧',
    { traits: { combo: true }, afterAttack: [fx('burn', 'target', [1, 2, 3])] }),
  C('m_whelp', '炽棘幼龙', 'magma', 1, 2, 4, 'passive', '溅射；溅射命中的敌人获得 [1,2,3] 层灼烧', '输出·溅射·给灼烧',
    { traits: { splash: true }, special: 'whelp' }),
  C('m_rex', '熔岩巨蜥', 'magma', 2, 4, 6, 'passive', '溅射', '输出·溅射', { traits: { splash: true } }),
  C('m_mender', '熔甲兽', 'magma', 2, 3, 6, 'attack', '普攻后：目标获得 [2,3,4] 层灼烧', '输出·给灼烧',
    { afterAttack: [fx('burn', 'target', [2, 3, 4])] }),
  C('m_kujata', '驮岩兽', 'magma', 2, 2, 8, 'start', '开战时：攻击最高的友军获得溅射，并本场 +[1,2,3] 攻', '辅助·给溅射',
    { lockTargets: true, onStart: [fx('grant', 'highestAtk', undefined, { grant: 'splash' }), fx('buff', 'highestAtk', [1, 2, 3])] }),
  C('m_harvester', '噬焰兽', 'magma', 2, 2, 6, 'passive', '任一带灼烧的敌人阵亡时：召唤 [1,2,3]/[1,2,3] 火苗到我方队尾', '召唤·吃灼烧',
    { special: 'harvester' }),
  C('m_incubator', '孵化看守', 'magma', 3, 3, 8, 'passive', '友军召唤的单位本场 +[1,2,3]/+[1,2,3]，并且当回合就能行动', '辅助·吃召唤',
    { special: 'incubator' }),
  C('m_bloodcaller', '熔血巫兽', 'magma', 3, 3, 8, 'beat', '每次交锋结束时：所有带灼烧的敌人灼烧 +[1,2,2]', '辅助·吃灼烧',
    { onBeatEnd: [fx('burn', 'burningEnemies', [1, 2, 2])] }),
  C('m_vindicator', '怒焰斗士', 'magma', 3, 4, 7, 'passive', '连击；溅射', '输出·连击·溅射', { traits: { combo: true, splash: true } }),
  C('m_rager', '暴怒迅猛龙', 'magma', 3, 4, 6, 'attack', '溅射；普攻后：自己本场 +[1,1,2] 攻', '输出·溅射',
    { traits: { splash: true }, afterAttack: [fx('buff', 'self', [1, 1, 2])] }),
  C('m_titan', '熔岩巨像', 'magma', 4, 6, 14, 'passive', '溅射；普攻命中后：目标和溅射目标获得 [3,4,5] 层灼烧（每次交锋限 1 次）', '输出·溅射·给灼烧',
    { traits: { splash: true }, special: 'titan' }),
  C('m_mankator', '炎鬃战兽', 'magma', 4, 5, 12, 'start', '开战时：相邻友军获得溅射，并本场 +[1,2,3] 攻', '辅助·给溅射',
    { lockTargets: true, onStart: [fx('grant', 'adjacent', undefined, { grant: 'splash' }), fx('buff', 'adjacent', [1, 2, 3])] }),
  C('m_heart', '火山之心', 'magma', 4, 5, 12, 'beat', '免疫灼烧；每次交锋结束时：双方队首各获得 [1,2,2] 层灼烧', '前排·给灼烧',
    { traits: { burnImmune: true }, onBeatEnd: [fx('burn', 'front', [1, 2, 2]), fx('burn', 'enemyFront', [1, 2, 2])] }),

  // ── 冰霜：寒意冻结 + 护甲坚守 + 法强 ──
  C('v_guard', '冰晶甲虫', 'frost', 1, 1, 7, 'hurt', '受击时：攻击者获得 [2,3,4] 层寒意', '前排·给寒意',
    { onHurt: [fx('chill', 'attacker', [2, 3, 4])] }),
  C('v_wall', '冰墙', 'frost', 1, 1, 9, 'passive', '嘲讽；护甲 [1,1,2]', '前排·嘲讽·护甲', { traits: { taunt: true, armor: [1, 1, 2] } }),
  C('v_scout', '冰原霜狼', 'frost', 1, 3, 4, 'passive', '任一敌人被冻结时：自己本场 +[1,2,3] 攻', '输出·吃寒意',
    { onEnemyFreeze: [fx('buff', 'self', [1, 2, 3])] }),
  C('v_chaser', '雪原小妖', 'frost', 1, 1, 5, 'cast', '法强 +1；施法：敌方队首获得 [2,3,4] 层寒意', '施法·给寒意·法强',
    { traits: { power: t3(1) }, cast: [fx('chill', 'enemyFront', [2, 3, 4])] }),
  C('v_snowman', '雪人', 'frost', 1, 2, 6, 'charge', '蓄力 2；蓄力技：敌方队首获得等同其攻击的寒意（寒意可被减免）', '给寒意·蓄力',
    { traits: { charge: 2 }, chargeSkill: [fx('freeze', 'enemyFront')] }),
  C('v_mage', '冰霜法师', 'frost', 2, 1, 6, 'cast', '施法：敌方下一个出手者获得 [3,4,5] 层寒意', '施法·给寒意',
    { cast: [fx('chill', 'enemyNext', [3, 4, 5])] }),
  C('v_shard', '冰棱射手', 'frost', 2, 3, 5, 'attack', '普攻后：目标获得 [1,2,3] 层寒意', '输出·给寒意',
    { afterAttack: [fx('chill', 'target', [1, 2, 3])] }),
  C('v_sentinel', '冰角战兽', 'frost', 2, 2, 8, 'passive', '护甲 1；相邻友军施法后：敌方下一个出手者获得 [1,2,3] 层寒意', '前排·护甲·吃施法·给寒意',
    { traits: { armor: t3(1) }, special: 'sentinel' }),
  C('v_rhyno', '冰原巨犀', 'frost', 2, 3, 8, 'charge', '护甲 1；蓄力 3；蓄力技：本次普攻伤害翻倍，自己本场护甲 +[1,2,2]', '前排·护甲·蓄力',
    { traits: { armor: t3(1), charge: 3 }, chargeAttack: { mult: 2, after: [fx('grant', 'self', [1, 2, 2], { grant: 'armor' })] } }),
  C('v_conduit', '寒潮之灵', 'frost', 3, 2, 8, 'passive', '相邻友军护甲 +[1,2,2]', '辅助·给护甲', { special: 'conduit' }),
  C('v_keeper', '寒冬守望者', 'frost', 3, 4, 8, 'passive', '护甲 1；在队首时护甲再 +[1,2,2]', '前排·护甲·轮换',
    { traits: { armor: t3(1) }, special: 'keeper' }),
  C('v_drake', '霜脊地龙', 'frost', 3, 2, 7, 'cast', '法强 +2；施法：全体敌人获得 1 层寒意', '施法·给寒意·法强',
    { traits: { power: t3(2) }, cast: [fx('chill', 'enemyAll', t3(1))] }),
  C('v_bear', '冰河巨熊', 'frost', 3, 3, 9, 'passive', '嘲讽；护甲 1；被普攻后：攻击者获得 [1,2,3] 层寒意', '前排·嘲讽·护甲·给寒意',
    { traits: { taunt: true, armor: t3(1) }, onAttacked: [fx('chill', 'attacker', [1, 2, 3])] }),
  C('v_queen', '霜冠执政官', 'frost', 4, 4, 12, 'start', '开战时：敌方队首获得 2 层寒意；任一敌人被冻结时：其余敌人获得 [1,2,2] 层寒意', '辅助·给寒意',
    { onStart: [fx('chill', 'enemyFront', t3(2))], special: 'queen' }),
  C('v_wyvern', '白霜巨龙', 'frost', 4, 5, 11, 'passive', '任一敌人被冻结时：自己本场 +[1,2,3] 攻，并追击一次（每次交锋限 1 次）', '输出·吃寒意·追击',
    { special: 'wyvern' }),
  C('v_stag', '凛风白鹿', 'frost', 4, 4, 11, 'charge', '蓄力 3；蓄力技：全体敌人获得 [2,3,4] 层寒意，全体友军获得 1 层格挡', '辅助·给寒意·蓄力·给格挡',
    { traits: { charge: 3 }, chargeSkill: [fx('chill', 'enemyAll', [2, 3, 4]), fx('block', 'allies', t3(1))] }),

  // ── 沙漠：人口召唤 + 蓄力 ──
  C('d_sentry', '沙铠甲虫', 'desert', 1, 3, 5, 'start', '嘲讽；开战时：获得 [1,2,3] 层格挡', '前排·嘲讽·给格挡',
    { traits: { taunt: true }, onStart: [fx('block', 'self', [1, 2, 3])] }),
  C('d_dune', '沙丘行者', 'desert', 1, 2, 4, 'rattle', '亡语：召唤 [2,3,4]/[2,3,4] 沙兵', '亡语·召唤',
    { onRattle: [fx('summon', 'self', [2, 3, 4], { v2: [2, 3, 4], token: 't_dervish' })] }),
  C('d_artificer', '构装学徒', 'desert', 1, 1, 5, 'cast', '施法：召唤 [1,2,3]/[1,2,3] 沙兵（本场最多 3 次，满员或用完改普攻）', '施法·召唤',
    { cast: [fx('summon', 'self', [1, 2, 3], { v2: [1, 2, 3], token: 't_dervish' })], castUses: t3(3) }),
  C('d_howler', '沙嚎者', 'desert', 1, 1, 7, 'charge', '蓄力 2；蓄力技：召唤 2 个 [1,2,2]/[1,2,2] 沙狼', '召唤·蓄力',
    { traits: { charge: 2 }, chargeSkill: [fx('summon', 'self', [1, 2, 2], { v2: [1, 2, 2], token: 't_wolf', count: 2 })] }),
  C('d_goldob', '金焰方尖碑', 'desert', 1, 0, 6, 'pulse', '不行动；节拍 2：召唤 [1,2,3]/[1,2,3] 沙灵', '召唤·节拍',
    { traits: { idle: true, pulse: 2 }, onPulse: [fx('summon', 'self', [1, 2, 3], { v2: [1, 2, 3], token: 't_wisp' })] }),
  C('d_keeper', '遗迹守卫', 'desert', 2, 3, 6, 'passive', '嘲讽；被普攻后：相邻友军各 +1 蓄力', '前排·嘲讽·给蓄力',
    { traits: { taunt: true }, onAttacked: [fx('charge', 'adjacent', t3(1))] }),
  C('d_obelisk', '流沙方尖碑', 'desert', 2, 1, 9, 'pulse', '不行动；节拍 3：召唤一个带嘲讽的 0/[4,6,8] 沙像', '前排·召唤·嘲讽·节拍',
    { traits: { idle: true, pulse: 3 }, onPulse: [fx('summon', 'self', t3(0), { v2: [4, 6, 8], token: 't_statue' })] }),
  C('d_glass', '镜沙猎蜥', 'desert', 2, 3, 5, 'passive', '友军召唤单位时：自己本场 +1 攻（本场最多 +[3,4,6]）', '输出·吃召唤',
    { onAllySummon: [fx('buff', 'self', t3(1), { capBattle: [3, 4, 6] })] }),
  C('d_shriek', '风啸隼', 'desert', 2, 2, 4, 'charge', '蓄力 2；蓄力技：敌方队尾受 [4,6,8] 伤害', '输出·蓄力',
    { traits: { charge: 2 }, chargeSkill: [fx('dmg', 'enemyRear', [4, 6, 8])] }),
  C('d_dunecaster', '沙灵塑师', 'desert', 3, 4, 8, 'cast', '施法：召唤一个带嘲讽的 0/[6,8,10] 沙像（本场最多 2 次）', '施法·召唤·嘲讽',
    { cast: [fx('summon', 'self', t3(0), { v2: [6, 8, 10], token: 't_statue' })], castUses: t3(2) }),
  C('d_sandblade', '日轮刃使', 'desert', 3, 4, 7, 'charge', '蓄力 3；蓄力技：本次普攻带溅射，伤害 +[3,4,6]', '输出·蓄力·溅射',
    { traits: { charge: 3 }, chargeAttack: { bonus: [3, 4, 6], splash: true } }),
  C('d_pyro', '沙焰术士', 'desert', 3, 1, 7, 'charge', '法强 +1；蓄力 2；蓄力技：敌方生命最高的单位受 [6,8,10] 伤害', '输出·蓄力·法强',
    { traits: { power: t3(1), charge: 2 }, chargeSkill: [fx('dmg', 'enemyHighestHp', [6, 8, 10])] }),
  C('d_hourglass', '沙漏构装', 'desert', 3, 2, 7, 'passive', '相邻友军每次常规行动额外 +1 蓄力；相邻的节拍单位节拍 −1', '辅助·给蓄力',
    { special: 'hourglass' }),
  C('d_pharaoh', '沙域法老', 'desert', 4, 5, 12, 'start', '开战时：全体友军本场 +[1,2,3]/+[1,2,3]；自己在场时，友军召唤的单位也获得', '辅助·吃召唤',
    { onStart: [fx('buff', 'allies', [1, 2, 3], { v2: [1, 2, 3] })], special: 'pharaoh' }),
  C('d_onyx', '黑曜豹神', 'desert', 4, 5, 10, 'charge', '蓄力 3；蓄力技：自己本场 +[3,4,5]/+[3,4,5]，并追击一次', '输出·蓄力·追击',
    { traits: { charge: 3 }, chargeSkill: [fx('buff', 'self', [3, 4, 5], { v2: [3, 4, 5] }), fx('extraAct', 'self')] }),
  C('d_worm', '黑沙巨虫', 'desert', 4, 5, 12, 'round', '每回合开始时：召唤 1/1 沙虫；召唤因满员失败时：改为自己本场 +[2,3,4]/+[2,3,4]', '前排·召唤',
    { special: 'worm' }),

  // ── 中立：白板身材 + 流派起手 ──
  C('n_merc', '佣兵', 'neutral', 1, 3, 5, 'attack', '普攻后：自己本场 +[1,2,2] 攻', '输出', { afterAttack: [fx('buff', 'self', [1, 2, 2])] }),
  C('n_bulwark', '铁甲卫士', 'neutral', 1, 1, 9, 'passive', '护甲 [1,2,2]', '前排·护甲', { traits: { armor: [1, 2, 2] } }),
  C('n_medic', '战地医师', 'neutral', 1, 1, 5, 'cast', '施法：队首恢复 [3,4,6] 生命', '施法·辅助', { cast: [fx('heal', 'front', [3, 4, 6])] }),
  C('n_archer', '游侠弓手', 'neutral', 1, 2, 4, 'passive', '狙击', '输出·狙击',
    { starText: ['狙击', '狙击；击杀时：自己本场 +1 攻', '狙击；击杀时：自己本场 +2 攻'],
      traits: { snipe: true }, onKill: [fx('buff', 'self', [0, 1, 2])] }),
  C('n_gladiator', '角斗士', 'neutral', 1, 3, 4, 'duel', '决斗', '输出·决斗', { traits: { duel: true } }),
  C('n_obelisk', '方尖碑', 'neutral', 2, 1, 7, 'passive', '身后一名友军法强 +[1,2,2]', '辅助·给法强', { special: 'nobelisk' }),
  C('n_breaker', '碎石兵', 'neutral', 2, 3, 6, 'passive', '溅射', '输出·溅射', { traits: { splash: true } }),
  C('n_thorn', '棘背兽', 'neutral', 2, 2, 9, 'passive', '反击 [1,2,3]', '前排·反击', { traits: { thorns: [1, 2, 3] } }),
  C('n_envoy', '传令使', 'neutral', 2, 1, 5, 'cast', '施法：攻击最高的其他友军本回合行动次数 +1（每回合限 1 次）', '施法·辅助·给行动次数',
    { cast: [fx('addAction', 'highestAtk', t3(1), { oncePerRound: true })] }),
  C('n_tether', '换位术士', 'neutral', 2, 1, 5, 'cast', '施法：我方队首退到队尾（新队首触发「成为队首时」）', '施法·辅助·轮换',
    { cast: [fx('rotate', 'front')] }),
  C('n_ritualist', '祭仪师', 'neutral', 3, 1, 6, 'cast', '施法：献祭身前最近的友军，使攻击最高的其他友军本场 +[1,2,3] 攻；无祭品或获益友军时改为普攻', '施法·辅助·献祭·亡语',
    { cast: [fx('sacrifice', 'ahead', [1, 2, 3])] }),
  C('n_echo', '回响祭司', 'neutral', 3, 1, 7, 'cast', '施法：相邻友军本场 +[1,2,3]/+[1,2,3]', '施法·辅助',
    { cast: [fx('buff', 'adjacent', [1, 2, 3], { v2: [1, 2, 3] })] }),
  C('n_marshal', '战阵指挥官', 'neutral', 3, 2, 6, 'start', '开战时：队首本场 +[2,3,4]/+[2,3,4]，首回合行动次数 +1', '辅助·给行动次数',
    { onStart: [fx('buff', 'front', [2, 3, 4], { v2: [2, 3, 4] }), fx('addAction', 'front', t3(1))] }),
  C('n_alchemist', '炼金术士', 'neutral', 3, 1, 6, 'cast', '施法：敌方队首获得 [2,3,4] 层灼烧和 [1,2,2] 层寒意', '施法·给灼烧·给寒意',
    { cast: [fx('burn', 'enemyFront', [2, 3, 4]), fx('chill', 'enemyFront', [1, 2, 2])] }),
  C('n_colossus', '战争巨像', 'neutral', 4, 7, 14, 'passive', '溅射；嘲讽', '前排·溅射·嘲讽', { traits: { splash: true, taunt: true } }),
  C('n_paragon', '落日灵驹', 'neutral', 4, 4, 10, 'start', '开战时：攻击最高与生命最高的友军各本场 +[2,3,4]/+[2,3,4]，生命最高的目标另获本场护甲 +[1,2,2]', '辅助',
    { lockTargets: true, onStart: [fx('buff', 'highestAtk', [2, 3, 4], { v2: [2, 3, 4] }), fx('buff', 'highestHp', [2, 3, 4], { v2: [2, 3, 4] }), fx('grant', 'highestHp', [1, 2, 2], { grant: 'armor' })] }),

  // ── 召唤物：身材由召唤者决定，不进入招募池 ──
  token('t_shade', '暗影', 'abyss', 1, 1, '召唤物'),
  token('t_night', '夜影', 'abyss', 2, 3, '嘲讽', { traits: { taunt: true } }),
  token('t_hatch', '幼兽', 'magma', 3, 3, '召唤物'),
  token('t_flame', '火苗', 'magma', 1, 1, '普攻后：目标获得 1 层灼烧', { afterAttack: [fx('burn', 'target', t3(1))] }),
  token('t_dervish', '沙兵', 'desert', 2, 2, '召唤物'),
  token('t_wolf', '沙狼', 'desert', 1, 1, '召唤物'),
  token('t_wisp', '沙灵', 'desert', 1, 1, '召唤物'),
  token('t_statue', '沙像', 'desert', 0, 4, '嘲讽；不行动', { traits: { taunt: true, idle: true } }),
  token('t_worm', '沙虫', 'desert', 1, 1, '召唤物'),
  token('t_drakelet', '雏龙', 'magma', 2, 2, '召唤物'),
  token('t_bonelet', '骨龙幼体', 'abyss', 3, 3, '召唤物'),

  // ── 主将专属：阿尔吉昂、龙蛋与龙 ──
  unique('x_argeon', '阿尔吉昂', 'light', 3, 8, 'passive', '主将亲征：每场第一次受到致命伤害时，保留 1 生命', '前排'),
  unique('x_egg', '龙蛋', 'magma', 0, 6, 'none', '不行动；按战斗事件孵化成龙', '', { traits: { idle: true } }),
  unique('x_bone', '骨龙', 'abyss', 5, 10, 'rattle', '亡语：召唤 3/3 骨龙幼体；友军阵亡时：自己本场 +1 攻', '前排·亡语·召唤',
    { onRattle: [fx('summon', 'self', t3(3), { v2: t3(3), token: 't_bonelet' })], onAllyFaint: [fx('buff', 'self', t3(1))] }),
  unique('x_fire', '炎龙', 'magma', 5, 9, 'attack', '溅射；普攻后：目标获得 3 层灼烧', '输出·溅射·给灼烧',
    { traits: { splash: true }, afterAttack: [fx('burn', 'target', t3(3))] }),
  unique('x_frostd', '霜龙', 'frost', 4, 11, 'passive', '任一敌人被冻结时：追击一次', '输出·吃寒意·追击',
    { onEnemyFreeze: [fx('extraAct', 'self')] }),
  unique('x_wind', '风龙', 'desert', 5, 8, 'front', '轮换；成为队首时：敌方队首受 3 伤害', '输出·轮换',
    { traits: { rotate: true }, onFront: [fx('dmg', 'enemyFront', t3(3))] }),
  unique('x_brood', '群龙母', 'magma', 4, 12, 'pulse', '节拍 3：召唤 2/2 雏龙', '前排·召唤·节拍',
    { traits: { pulse: 3 }, onPulse: [fx('summon', 'self', t3(2), { v2: t3(2), token: 't_drakelet' })] }),

  // ── 敌方：用同一套关键词出题 ──
  enemy('e_skel', '骷髅兵', 2, 2, 'none', '没有能力'),
  enemy('e_raider', '掠夺者', 3, 3, 'none', '没有能力'),
  enemy('e_golem', '石魔', 1, 7, 'passive', '护甲 2', { traits: { armor: t3(2) } }),
  enemy('e_brute', '蛮兵', 4, 5, 'none', '没有能力'),
  enemy('e_shield', '盾卫', 2, 6, 'start', '开战时：自己获得 2 层格挡', { onStart: [fx('block', 'self', t3(2))] }),
  enemy('e_assassin', '影袭者', 3, 2, 'passive', '狙击', { traits: { snipe: true } }),
  enemy('e_silencer', '霜咒者', 1, 4, 'cast', '施法：你下一个出手的单位获得 2 层寒意', { cast: [fx('chill', 'enemyNext', t3(2))] }),
  enemy('e_crusher', '碎岩者', 3, 6, 'passive', '溅射', { traits: { splash: true } }),
  enemy('e_exile', '放逐者', 3, 4, 'passive', '放逐：被它击杀的单位不能复生，也不触发亡语', { special: 'exile' }),
  enemy('e_thorn', '荆棘守卫', 1, 6, 'passive', '反击 2', { traits: { thorns: t3(2) } }),
  enemy('e_guardian', '护卫兵', 2, 8, 'passive', '嘲讽', { traits: { taunt: true } }),
  enemy('e_curser', '咒沙者', 1, 5, 'cast', '施法：你的队首本场攻击 −2', { cast: [fx('weaken', 'enemyFront', t3(2))] }),
  enemy('e_pyre', '焚火者', 2, 5, 'attack', '普攻后：目标获得 2 层灼烧', { afterAttack: [fx('burn', 'target', t3(2))] }),
  enemy('e_twin', '双刃兵', 4, 5, 'passive', '连击', { traits: { combo: true } }),
  enemy('e_lich', '骨巫', 1, 5, 'cast', '施法：你生命最低的单位受 3 伤害', { cast: [fx('dmg', 'enemyLowest', t3(3))] }),
  enemy('e_dark_priest', '暗祭司', 1, 6, 'cast', '施法：生命最低的受伤友军恢复 4 生命', { cast: [fx('heal', 'lowest', t3(4))] }),
  enemy('e_revenant', '亡魂骑士', 3, 5, 'passive', '复生', { traits: { reborn: true } }),
  enemy('e_tomb', '墓碑', 1, 6, 'rattle', '亡语：召唤 2/2 骷髅兵', { onRattle: [fx('summon', 'self', t3(2), { token: 'e_skel' })] }),
  enemy('e_warlord', '战帅', 4, 10, 'start', '开战时：全体友军本场 +1 攻', { onStart: [fx('buff', 'allies', t3(1))] }),
  enemy('e_void', '虚空领主', 5, 24, 'beat', '每 3 次交锋结束时：把你的队尾拉到队首（每个单位本场只被拉一次）', { special: 'void', boss: true }),
  enemy('e_frostq', '霜魇女皇', 5, 30, 'beat', '每 5 次交锋结束时：你攻击最高的单位获得等同其攻击的寒意（下次出手冻结）', { special: 'frostq', boss: true }),
  enemy('e_nightk', '永夜君王', 6, 40, 'hurt', '生命首次低于一半时：召回本场所有阵亡的友军（生命减半），自己获得 3 层格挡', { special: 'nightk', boss: true }),
];

export const UNIT_MAP: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
export const unitDef = (id: string): UnitDef => {
  const d = UNIT_MAP[id];
  if (!d) throw new Error(`unknown unit ${id}`);
  return d;
};

export const ALL_FACTIONS: ActiveFaction[] = ['light', 'shadow', 'abyss', 'magma', 'frost', 'desert'];
/** 兼容旧名：全部可抽阵营 */
export const ACTIVE_FACTIONS = ALL_FACTIONS;
export const FACTION_ORDER: Faction[] = [...ALL_FACTIONS, 'neutral'];
export const DRAFT_POOL = UNITS.filter((u) => !u.token && !u.enemyOnly && !u.unique && FACTION_ORDER.includes(u.faction));

export const FACTION_INFO: Record<Faction, { name: string; color: string; dark: string }> = {
  light: { name: '圣光', color: '#ffd36b', dark: '#7a5413' },
  shadow: { name: '影刃', color: '#ff5f6d', dark: '#6e1622' },
  abyss: { name: '深渊', color: '#b77bff', dark: '#3d1a6e' },
  magma: { name: '熔岩', color: '#ff9a3d', dark: '#6b2a07' },
  frost: { name: '寒冰', color: '#6fe6ff', dark: '#0e4a63' },
  desert: { name: '沙域', color: '#e9bd72', dark: '#745025' },
  neutral: { name: '中立', color: '#cfd6e6', dark: '#3a4255' },
  enemy: { name: '敌军', color: '#ff4b6e', dark: '#3a0b19' },
};

/** 机制标签族：「给X」「吃X」与裸 X 归为同一族 */
export const tagFamily = (tag: string) => tag.replace(/^[给吃读]/, '');
export const ROLE_TAGS = ['前排', '输出', '施法', '辅助', '亡语', '召唤'];

export const RARITY_NAMES: Record<Rarity, string> = { 1: '普通', 2: '稀有', 3: '史诗', 4: '传说' };
