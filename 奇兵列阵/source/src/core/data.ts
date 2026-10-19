import type { ActiveFaction, Effect, Faction, Rarity, Tri, Trigger, UnitDef } from './types';

// v0.7 卡表：6 阵营 × 12 + 中立 12 = 84。文案里的 [a,b,c] 表示 1/2/3★ 数值，自动展开为每星文案。
// 每拍双方从队首往后轮流出手；带「施法：」的单位出手时执行施法，不普攻。
export { GENERALS, GENERAL_MAP } from './content';

/** 卡面可点开说明的词：关键词 + 规则词 */
export const KEYWORDS: Record<string, string> = {
  格挡: '状态。抵消下一次伤害（不论大小），消耗 1 层，最多 3 层。灼烧无视格挡。',
  护甲: '特性。每次受到的伤害 −N，最少为 1。灼烧无视护甲。',
  复生: '特性。第一次阵亡时，在原位以 1 生命复活。被放逐者击杀则不能复生。',
  寒意: '状态。下次出手时攻击 −N，出手后清空；寒意 ≥ 当前攻击时被冻结。',
  灼烧: '状态。每拍结束时受 N 伤害，然后 −1 层。无视格挡和护甲。',
  溅射: '特性。普攻时，目标身后一名敌人受 N 伤害（不触发反击）。',
  连击: '特性。普攻打两下，每下为攻击力的一半（向上取整）。',
  狙击: '特性。普攻改打敌方队尾。',
  反击: '特性。被普攻直接命中时，对攻击者造成 N 伤害；连击每段各触发一次。',
  法强: '特性。自己施法的伤害、治疗、灼烧、寒意、易伤数值 +N（只强化自己）；作用于全体的效果只 +N/2（向下取整）。',
  护卫: '特性。敌方单体指定效果（狙击、打队尾、打生命最低等）选中相邻友军时，改为选中护卫。打队首、溅射、群体效果不受影响。',
  易伤: '状态。受到的下一次伤害 +1，消耗 1 层。灼烧无视易伤。',
  冻结: '寒意 ≥ 当前攻击时，跳过这次出手，寒意清空。',
  立即出手: '额外出手一次，不改变轮转顺序；每方每拍最多 1 次，不能连锁。',
  召唤: '在原位生成单位；原位被占（例如已复生）时，改为最近的友军获得同等加成。',
  施法: '出手时执行卡面效果，不普攻。同一拍先施法、后普攻。',
  放逐: '被它击杀的单位不能复生。',
};
const KW = ['格挡', '护甲', '复生', '寒意', '灼烧', '溅射', '连击', '狙击', '反击', '法强', '护卫', '易伤', '冻结', '立即出手', '召唤', '放逐'];

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

export const UNITS: UnitDef[] = [
  // ── 圣光：格挡、复生 / 护卫 ──
  C('l_shield', '银盾侍卫', 'light', 1, 2, 5, 'cast', '施法：队首获得 [1,2,3] 层格挡', '辅助·施法·给格挡',
    { cast: [fx('block', 'front', [1, 2, 3])] }),
  C('l_martyr', '殉道者', 'light', 1, 1, 4, 'faint', '复生；阵亡时：身后一名友军获得 [1,2,3] 层格挡', '前排·阵亡·复生·给格挡',
    { traits: { reborn: true }, onFaint: [fx('block', 'behind', [1, 2, 3])] }),
  C('l_vigil', '守誓者', 'light', 1, 2, 5, 'start', '开战时：自己获得 [1,2,3] 层格挡', '前排·给格挡',
    { onStart: [fx('block', 'self', [1, 2, 3])] }),
  C('l_warden', '晨卫', 'light', 1, 2, 6, 'passive', '护卫；自己的格挡被打掉时：恢复 [2,3,4] 生命', '前排·护卫·吃格挡',
    { traits: { guard: true }, special: 'warden' }),
  C('l_priest', '圣光牧师', 'light', 2, 1, 6, 'cast', '施法：生命最低的受伤友军恢复 [4,6,8] 生命', '施法·辅助',
    { cast: [fx('heal', 'lowest', [4, 6, 8])] }),
  C('l_knight', '晨曦骑士', 'light', 2, 3, 7, 'faint', '复生；复活时获得 [1,2,3] 层格挡', '前排·复生·给格挡',
    { traits: { reborn: true }, onRevive: [fx('block', 'self', [1, 2, 3])] }),
  C('l_lion', '蔚蓝雄狮', 'light', 2, 4, 5, 'attack', '普攻伤害 + 自己的格挡层数 ×[1,2,3]', '输出·吃格挡', { special: 'lion' }),
  C('l_mender', '辉光医者', 'light', 3, 1, 8, 'cast', '施法：全体友军恢复 [2,3,4] 生命', '施法·辅助',
    { cast: [fx('heal', 'allies', [2, 3, 4])] }),
  C('l_banner', '誓约旗手', 'light', 3, 4, 8, 'passive', '友军的格挡被打掉时：该友军攻击 +[1,2,3]', '辅助·吃格挡',
    { special: 'banner' }),
  C('l_cliff', '铁崖守护者', 'light', 3, 3, 10, 'passive', '护卫；每拍第一次替友军承伤后：获得 [1,2,2] 层格挡', '前排·护卫·给格挡',
    { traits: { guard: true }, special: 'cliff' }),
  C('l_archon', '曙光执政官', 'light', 4, 4, 10, 'start', '开战时：全体友军获得复生', '辅助·复生',
    { starText: ['开战时：全体友军获得复生', '开战时：全体友军获得复生和 1 层格挡', '开战时：全体友军获得复生和 2 层格挡'],
      onStart: [fx('grant', 'allies', undefined, { grant: 'reborn' }), fx('block', 'allies', [0, 1, 2])] }),
  C('l_sunriser', '旭日守望', 'light', 4, 4, 9, 'start', '开战时及每第 3 拍结束：生命最高的友军获得 [2,3,4] 层格挡', '辅助·给格挡·读生命最高',
    { onStart: [fx('block', 'highestHp', [2, 3, 4])], onBeatEnd: [fx('block', 'highestHp', [2, 3, 4])], beatEvery: 3 }),

  // ── 影刃：连击、狙击 / 易伤 ──
  C('s_wind', '风刃学徒', 'shadow', 1, 3, 3, 'passive', '连击', '输出·连击',
    { starText: ['连击', '连击；普攻后：自己本场 +1 攻', '连击；普攻后：自己本场 +2 攻'],
      traits: { combo: true }, afterAttack: [fx('buff', 'self', [0, 1, 2])] }),
  C('s_backstab', '背刺者', 'shadow', 1, 3, 4, 'passive', '狙击', '输出·狙击',
    { starText: ['狙击', '狙击；普攻后：目标获得 1 层易伤', '狙击；普攻后：目标获得 2 层易伤'],
      traits: { snipe: true }, afterAttack: [fx('vuln', 'target', [0, 1, 2])] }),
  C('s_dancer', '影舞者', 'shadow', 1, 1, 5, 'cast', '施法：让攻击最高的友军立即出手一次', '施法·辅助·读攻击最高·立即出手',
    { starText: ['施法：让攻击最高的友军立即出手一次', '施法：让攻击最高的友军立即出手一次，该次攻击 +1', '施法：让攻击最高的友军立即出手一次，该次攻击 +2'],
      cast: [fx('extraAct', 'highestAtk', [0, 1, 2])] }),
  C('s_fox', '灯笼狐', 'shadow', 1, 2, 4, 'attack', '普攻后：目标获得 [1,2,3] 层易伤', '输出·给易伤',
    { afterAttack: [fx('vuln', 'target', [1, 2, 3])] }),
  C('s_dart', '飞镖手', 'shadow', 2, 1, 5, 'cast', '施法：敌方队尾受 [3,4,6] 伤害', '施法·输出',
    { cast: [fx('dmg', 'enemyRear', [3, 4, 6])] }),
  C('s_ninja', '连环忍者', 'shadow', 2, 3, 5, 'kill', '连击；击杀时：立即出手一次', '输出·连击·立即出手',
    { starText: ['连击；击杀时：立即出手一次', '连击；击杀时：本场 +1 攻，并立即出手一次', '连击；击杀时：本场 +2 攻，并立即出手一次'],
      traits: { combo: true }, onKill: [fx('buff', 'self', [0, 1, 2]), fx('extraAct', 'self')] }),
  C('s_monk', '碎骨武僧', 'shadow', 2, 3, 6, 'attack', '普攻带易伤的敌人后：自己本场 +[1,2,3] 攻', '输出·吃易伤', { special: 'monk' }),
  C('s_hunter', '暗隙猎手', 'shadow', 3, 4, 6, 'kill', '狙击；击杀时：自己 +[2,3,4]/+[2,3,4]', '输出·狙击',
    { traits: { snipe: true }, onKill: [fx('buff', 'self', [2, 3, 4], { v2: [2, 3, 4] })] }),
  C('s_choreo', '刃影导师', 'shadow', 3, 2, 6, 'start', '开战时：相邻友军中攻击最高的一名获得连击', '辅助·给连击·读攻击最高',
    { starText: ['开战时：相邻友军中攻击最高的一名获得连击', '开战时：相邻友军中攻击最高的一名获得连击，攻击 +1', '开战时：相邻友军中攻击最高的一名获得连击，攻击 +2'],
      onStart: [fx('grant', 'adjHighestAtk', undefined, { grant: 'combo' }), fx('buff', 'adjHighestAtk', [0, 1, 2])] }),
  C('s_caster', '四风术士', 'shadow', 3, 1, 6, 'cast', '法强 +1；施法：敌方攻击最高的单位受 [3,4,6] 伤害，并获得 2 层易伤', '施法·给易伤·法强',
    { traits: { power: t3(1) }, cast: [fx('dmg', 'enemyHighestAtk', [3, 4, 6]), fx('vuln', 'enemyHighestAtk', t3(2))] }),
  C('s_master', '千刃宗师', 'shadow', 4, 6, 10, 'passive', '连击；我方每段普攻命中后：敌方队尾受 [1,2,2] 伤害', '输出·连击',
    { traits: { combo: true }, special: 'master' }),
  C('s_lord', '岚影宗主', 'shadow', 4, 4, 9, 'start', '开战时：攻击最高的友军获得狙击和连击', '辅助·给连击·给狙击·读攻击最高',
    { starText: ['开战时：攻击最高的友军获得狙击和连击', '开战时：攻击最高的友军获得狙击和连击，攻击 +1', '开战时：攻击最高的友军获得狙击和连击，攻击 +2'],
      onStart: [fx('grant', 'highestAtk', undefined, { grant: 'snipe' }), fx('grant', 'highestAtk', undefined, { grant: 'combo' }), fx('buff', 'highestAtk', [0, 1, 2])] }),

  // ── 深渊：法强、反击 / 复生 ──
  C('a_seed', '亡灵之种', 'abyss', 1, 1, 3, 'faint', '阵亡时：原位召唤 [2,3,4]/[2,3,4] 暗影', '阵亡·召唤',
    { onFaint: [fx('summon', 'self', [2, 3, 4], { token: 't_shade' })] }),
  C('a_devour', '吞噬者', 'abyss', 1, 1, 5, 'cast', '施法：敌方队首受 [3,4,6] 伤害', '施法·输出',
    { cast: [fx('dmg', 'enemyFront', [3, 4, 6])] }),
  C('a_graveguard', '墓园守卫', 'abyss', 1, 2, 7, 'passive', '反击 [2,3,4]', '前排·反击', { traits: { thorns: [2, 3, 4] } }),
  C('a_spine', '暗棘', 'abyss', 1, 2, 5, 'faint', '复生；复活时：敌方队首受 [2,3,4] 伤害', '前排·复生·阵亡',
    { traits: { reborn: true }, onRevive: [fx('dmg', 'enemyFront', [2, 3, 4])] }),
  C('a_reaper', '灵魂收割者', 'abyss', 2, 3, 5, 'ally', '友军阵亡时：敌方队首受 [2,3,4] 伤害', '输出·吃阵亡',
    { onAllyFaint: [fx('dmg', 'enemyFront', [2, 3, 4])] }),
  C('a_cult', '献祭术士', 'abyss', 2, 1, 5, 'cast', '法强 +1；施法：敌方队首受 [2,3,4] 伤害', '施法·输出·法强',
    { traits: { power: t3(1) }, cast: [fx('dmg', 'enemyFront', [2, 3, 4])] }),
  C('a_brood', '育魂者', 'abyss', 2, 2, 7, 'passive', '相邻友军法强 +[1,2,2]', '辅助·给法强', { special: 'brood' }),
  C('a_ritualist', '唤亡祭师', 'abyss', 3, 1, 5, 'cast', '施法（本场 3 次，用完改普攻）：全体敌人受 [1,2,2] 伤害', '施法·输出',
    { cast: [fx('dmg', 'enemyAll', [1, 2, 2])], castUses: 3 }),
  C('a_jugg', '深渊巨兽', 'abyss', 3, 3, 11, 'ally', '反击 [2,3,4]；每有一名友军阵亡：本场反击 +1', '前排·反击·吃阵亡',
    { traits: { thorns: [2, 3, 4] }, onAllyFaint: [fx('grant', 'self', t3(1), { grant: 'thorns' })] }),
  C('a_engulf', '吞噬之影', 'abyss', 3, 1, 7, 'cast', '法强 +[1,1,2]；施法：敌方生命最低的单位受 [3,4,5] 伤害；击杀时：相邻友军本场法强 +1', '施法·输出·给法强·法强',
    { traits: { power: [1, 1, 2] }, cast: [fx('dmg', 'enemyLowest', [3, 4, 5])], onKill: [fx('grant', 'adjacent', t3(1), { grant: 'power' })] }),
  C('a_matriarch', '深渊主母', 'abyss', 4, 4, 11, 'passive', '反击 [2,3,4]；友军施法后：敌方队首受 [2,3,4] 伤害', '前排·反击·吃施法',
    { traits: { thorns: [2, 3, 4] }, special: 'matriarch' }),
  C('a_solus', '永夜吟诵者', 'abyss', 4, 3, 9, 'passive', '友军施法后：该友军本场法强 +[1,2,2]', '辅助·给法强·吃施法', { special: 'solus' }),

  // ── 熔岩：灼烧、溅射 / 连击 ──
  C('m_egg', '幼兽蛋', 'magma', 1, 1, 5, 'faint', '阵亡时：原位召唤 [3,4,6]/[3,4,6] 幼兽', '阵亡·召唤',
    { onFaint: [fx('summon', 'self', [3, 4, 6], { token: 't_hatch' })] }),
  C('m_shaman', '原始萨满', 'magma', 1, 1, 5, 'cast', '施法：敌方队首获得 [3,4,5] 层灼烧', '施法·给灼烧',
    { cast: [fx('burn', 'enemyFront', [3, 4, 5])] }),
  C('m_hide', '厚皮兽', 'magma', 1, 2, 7, 'hurt', '受击时：自己攻击 +[1,2,3]', '前排', { onHurt: [fx('buff', 'self', [1, 2, 3])] }),
  C('m_raptor', '迅猛龙', 'magma', 1, 3, 4, 'attack', '连击；普攻后：目标获得 [1,2,3] 层灼烧', '输出·连击·给灼烧',
    { traits: { combo: true }, afterAttack: [fx('burn', 'target', [1, 2, 3])] }),
  C('m_rex', '暴龙', 'magma', 2, 4, 6, 'passive', '溅射 [2,3,4]', '输出·溅射', { traits: { splash: [2, 3, 4] } }),
  C('m_mender', '燃血斗士', 'magma', 2, 3, 6, 'attack', '普攻后：目标获得 [2,3,4] 层灼烧', '输出·给灼烧',
    { afterAttack: [fx('burn', 'target', [2, 3, 4])] }),
  C('m_kujata', '驮岩兽', 'magma', 2, 2, 8, 'start', '开战时：攻击最高的友军获得溅射 [1,2,3]', '辅助·给溅射·读攻击最高',
    { onStart: [fx('grant', 'highestAtk', [1, 2, 3], { grant: 'splash' })] }),
  C('m_incubator', '孵化看守', 'magma', 3, 3, 8, 'start', '开战时：相邻友军攻击 +[1,2,3]', '辅助',
    { onStart: [fx('buff', 'adjacent', [1, 2, 3])] }),
  C('m_bloodcaller', '熔血导师', 'magma', 3, 3, 8, 'beat', '每拍结束时：所有带灼烧的敌人灼烧 +[1,2,2]', '辅助·吃灼烧',
    { onBeatEnd: [fx('burn', 'burningEnemies', [1, 2, 2])] }),
  C('m_vindicator', '怒焰斗士', 'magma', 3, 4, 7, 'passive', '连击；溅射 [1,2,3]', '输出·连击·溅射',
    { traits: { combo: true, splash: [1, 2, 3] } }),
  C('m_titan', '熔岩巨像', 'magma', 4, 6, 14, 'passive', '溅射 2；每拍第一次普攻命中：命中的敌人获得 [3,4,5] 层灼烧', '输出·溅射·给灼烧',
    { traits: { splash: t3(2) }, special: 'titan' }),
  C('m_mankator', '炎鬃战兽', 'magma', 4, 5, 12, 'start', '开战时：全体友军获得溅射 [1,2,3]', '辅助·给溅射',
    { onStart: [fx('grant', 'allies', [1, 2, 3], { grant: 'splash' })] }),

  // ── 寒冰：寒意、护甲 / 法强 ──
  C('v_guard', '寒冰卫士', 'frost', 1, 1, 7, 'hurt', '受击时：攻击者获得 [2,3,4] 层寒意', '前排·给寒意',
    { onHurt: [fx('chill', 'attacker', [2, 3, 4])] }),
  C('v_wall', '冰墙', 'frost', 1, 1, 8, 'passive', '护甲 [1,2,2]', '前排·护甲', { traits: { armor: [1, 2, 2] } }),
  C('v_scout', '冰原猎犬', 'frost', 1, 3, 4, 'attack', '普攻目标有寒意时：伤害 + 寒意层数', '输出·吃寒意',
    { starText: ['普攻目标有寒意时：伤害 + 寒意层数', '普攻目标有寒意时：伤害 + 寒意层数；普攻后：目标获得 1 层寒意', '普攻目标有寒意时：伤害 + 寒意层数；普攻后：目标获得 2 层寒意'],
      special: 'scout', afterAttack: [fx('chill', 'target', [0, 1, 2])] }),
  C('v_chaser', '雪原学徒', 'frost', 1, 1, 5, 'cast', '法强 +1；施法：敌方队首获得 [2,3,4] 层寒意', '施法·给寒意·法强',
    { traits: { power: t3(1) }, cast: [fx('chill', 'enemyFront', [2, 3, 4])] }),
  C('v_mage', '冰霜法师', 'frost', 2, 1, 6, 'cast', '施法：敌方下一个出手者获得 [3,4,5] 层寒意', '施法·给寒意',
    { cast: [fx('chill', 'enemyNext', [3, 4, 5])] }),
  C('v_shard', '冰棱射手', 'frost', 2, 3, 5, 'attack', '普攻后：目标获得 [1,2,3] 层寒意', '输出·给寒意',
    { afterAttack: [fx('chill', 'target', [1, 2, 3])] }),
  C('v_sentinel', '冰哨', 'frost', 2, 2, 8, 'passive', '护甲 1；相邻友军施法后：敌方下一个出手者获得 [1,2,3] 层寒意', '前排·护甲·吃施法·给寒意',
    { traits: { armor: t3(1) }, special: 'sentinel' }),
  C('v_conduit', '雪灵引路者', 'frost', 3, 2, 8, 'passive', '相邻友军护甲 +[1,2,2]', '辅助·给护甲', { special: 'conduit' }),
  C('v_keeper', '寒冬守望者', 'frost', 3, 4, 8, 'passive', '护甲 1；在队首时护甲再 +[1,2,2]', '前排·护甲',
    { traits: { armor: t3(1) }, special: 'keeper' }),
  C('v_drake', '霜龙', 'frost', 3, 2, 7, 'cast', '法强 +[1,2,2]；施法：全体敌人获得 1 层寒意', '施法·给寒意·法强',
    { traits: { power: [1, 2, 2] }, cast: [fx('chill', 'enemyAll', t3(1))] }),
  C('v_queen', '霜冠执政官', 'frost', 4, 4, 12, 'start', '开战时：敌方队首获得 2 层寒意；敌人被冻结时：其余敌人获得 [1,2,2] 层寒意', '辅助·给寒意',
    { onStart: [fx('chill', 'enemyFront', t3(2))], special: 'queen' }),
  C('v_wyvern', '白霜巨龙', 'frost', 4, 5, 11, 'passive', '每拍第一个敌人被冻结时：自己本场 +[1,2,3] 攻，并立即出手一次', '输出·吃寒意·立即出手',
    { special: 'wyvern' }),

  // ── 沙域：护卫、易伤 / 格挡 ──
  C('d_sentry', '沙铠卫士', 'desert', 1, 3, 5, 'start', '护卫；开战时：自己获得 [1,2,3] 层格挡', '前排·护卫·给格挡',
    { traits: { guard: true }, onStart: [fx('block', 'self', [1, 2, 3])] }),
  C('d_dune', '沙丘行者', 'desert', 1, 2, 4, 'faint', '阵亡时：原位召唤沙兵', '阵亡·召唤',
    { starText: ['阵亡时：原位召唤 3/2 沙兵', '阵亡时：原位召唤 3/3 沙兵', '阵亡时：原位召唤 4/4 沙兵'],
      onFaint: [fx('summon', 'self', [3, 3, 4], { v2: [2, 3, 4], token: 't_dervish' })] }),
  C('d_artificer', '构装学徒', 'desert', 1, 1, 5, 'cast', '施法：队首本场 +[1,2,3]/+[1,2,3]', '施法·辅助',
    { cast: [fx('buff', 'front', [1, 2, 3], { v2: [1, 2, 3] })] }),
  C('d_howler', '沙嚎者', 'desert', 1, 1, 5, 'cast', '施法：敌方队首获得 [2,3,4] 层易伤', '施法·给易伤',
    { cast: [fx('vuln', 'enemyFront', [2, 3, 4])] }),
  C('d_keeper', '遗迹守卫', 'desert', 2, 3, 6, 'passive', '护卫；替友军承伤时：攻击者获得 [1,2,3] 层易伤', '前排·护卫·给易伤',
    { traits: { guard: true }, special: 'dkeeper' }),
  C('d_obelisk', '流沙方尖碑', 'desert', 2, 1, 9, 'beat', '每拍结束时：敌方队首获得 [1,2,3] 层易伤', '前排·给易伤',
    { onBeatEnd: [fx('vuln', 'enemyFront', [1, 2, 3])] }),
  C('d_glass', '镜沙刺客', 'desert', 2, 3, 5, 'passive', '带易伤的敌人每次受伤后：自己本场 +1 攻（最多 +[3,4,6]）', '输出·吃易伤',
    { special: 'glass' }),
  C('d_dunecaster', '沙灵塑师', 'desert', 3, 4, 8, 'cast', '施法：队首获得 [1,2,3] 层格挡', '施法·给格挡',
    { cast: [fx('block', 'front', [1, 2, 3])] }),
  C('d_sandblade', '日轮刃使', 'desert', 3, 4, 7, 'passive', '溅射 [1,2,3]；溅射命中的敌人获得 1 层易伤', '输出·溅射·给易伤',
    { traits: { splash: [1, 2, 3] }, special: 'sandblade' }),
  C('d_pyro', '沙焰术士', 'desert', 3, 1, 7, 'cast', '法强 +1；施法：敌方生命最高的单位受 [3,4,5] 伤害，并获得 [2,2,3] 层易伤', '施法·给易伤·法强',
    { traits: { power: t3(1) }, cast: [fx('dmg', 'enemyHighestHp', [3, 4, 5]), fx('vuln', 'enemyHighestHp', [2, 2, 3])] }),
  C('d_pharaoh', '沙域法老', 'desert', 4, 5, 12, 'start', '开战时：全体友军本场 +[1,2,3]/+[1,2,3]；带护卫的友军另获得 2 层格挡', '辅助·吃护卫·给格挡',
    { onStart: [fx('buff', 'allies', [1, 2, 3], { v2: [1, 2, 3] }), fx('block', 'guardAllies', t3(2))] }),
  C('d_onyx', '黑曜狮神', 'desert', 4, 5, 10, 'passive', '友军普攻带易伤的敌人时：额外消耗 1 层易伤，伤害再 +[1,2,3]', '输出·吃易伤',
    { special: 'onyx' }),

  // ── 中立：白板身材 + 低配接口 ──
  C('n_merc', '佣兵', 'neutral', 1, 3, 5, 'attack', '普攻后：自己攻击 +[1,2,2]', '输出', { afterAttack: [fx('buff', 'self', [1, 2, 2])] }),
  C('n_bulwark', '铁甲卫士', 'neutral', 1, 1, 9, 'passive', '护甲 [1,2,2]', '前排·护甲', { traits: { armor: [1, 2, 2] } }),
  C('n_medic', '战地医师', 'neutral', 1, 1, 5, 'cast', '施法：队首恢复 [3,4,6] 生命', '施法·辅助', { cast: [fx('heal', 'front', [3, 4, 6])] }),
  C('n_archer', '游侠弓手', 'neutral', 1, 2, 4, 'passive', '狙击', '输出·狙击',
    { starText: ['狙击', '狙击；击杀时：自己本场 +1 攻', '狙击；击杀时：自己本场 +2 攻'],
      traits: { snipe: true }, onKill: [fx('buff', 'self', [0, 1, 2])] }),
  C('n_obelisk', '方尖碑', 'neutral', 2, 1, 7, 'passive', '身后一名友军法强 +[1,2,2]', '辅助·给法强', { special: 'nobelisk' }),
  C('n_breaker', '碎石兵', 'neutral', 2, 3, 6, 'passive', '溅射 [1,2,3]', '输出·溅射', { traits: { splash: [1, 2, 3] } }),
  C('n_thorn', '盾刺佣兵', 'neutral', 2, 2, 7, 'passive', '反击 [1,2,3]', '前排·反击', { traits: { thorns: [1, 2, 3] } }),
  C('n_echo', '回响祭司', 'neutral', 3, 1, 7, 'cast', '施法：相邻友军本场 +[1,2,3]/+[1,2,3]', '施法·辅助',
    { cast: [fx('buff', 'adjacent', [1, 2, 3], { v2: [1, 2, 3] })] }),
  C('n_marshal', '战阵指挥官', 'neutral', 3, 2, 6, 'start', '开战时：队首本场 +[2,3,4]/+[2,3,4]', '辅助',
    { onStart: [fx('buff', 'front', [2, 3, 4], { v2: [2, 3, 4] })] }),
  C('n_alchemist', '炼金术士', 'neutral', 3, 1, 6, 'cast', '施法：敌方队首获得 [2,3,4] 层灼烧和 [1,2,2] 层寒意', '施法·给灼烧·给寒意',
    { cast: [fx('burn', 'enemyFront', [2, 3, 4]), fx('chill', 'enemyFront', [1, 2, 2])] }),
  C('n_colossus', '战争巨像', 'neutral', 4, 7, 14, 'passive', '溅射 [2,3,4]', '输出·溅射', { traits: { splash: [2, 3, 4] } }),
  C('n_paragon', '落日典范', 'neutral', 4, 4, 10, 'start', '开战时：攻击最高与生命最高的友军各本场 +[2,3,4]/+[2,3,4]', '辅助·读攻击最高·读生命最高',
    { onStart: [fx('buff', 'highestAtk', [2, 3, 4], { v2: [2, 3, 4] }), fx('buff', 'highestHp', [2, 3, 4], { v2: [2, 3, 4] })] }),

  // 召唤物身材由召唤者决定，不进入招募池。
  { id: 't_shade', name: '暗影', faction: 'abyss', atk: 1, hp: 1, tier: 1, trigger: 'none', token: true, text: '召唤物，没有能力' },
  { id: 't_hatch', name: '幼兽', faction: 'magma', atk: 3, hp: 3, tier: 1, trigger: 'none', token: true, text: '召唤物，没有能力' },
  { id: 't_dervish', name: '沙兵', faction: 'desert', atk: 3, hp: 2, tier: 1, trigger: 'none', token: true, text: '召唤物，没有能力' },

  // ── 敌方：用同一套关键词出题 ──
  enemy('e_skel', '骷髅兵', 2, 2, 'none', '没有能力'),
  enemy('e_raider', '掠夺者', 3, 3, 'none', '没有能力'),
  enemy('e_golem', '石魔', 1, 7, 'passive', '护甲 2', { traits: { armor: t3(2) } }),
  enemy('e_brute', '蛮兵', 4, 5, 'none', '没有能力'),
  enemy('e_shield', '盾卫', 2, 6, 'start', '开战时：自己获得 2 层格挡', { onStart: [fx('block', 'self', t3(2))] }),
  enemy('e_assassin', '影袭者', 3, 2, 'passive', '狙击', { traits: { snipe: true } }),
  enemy('e_silencer', '霜咒者', 1, 4, 'cast', '施法：你下一个出手的单位获得 2 层寒意', { cast: [fx('chill', 'enemyNext', t3(2))] }),
  enemy('e_crusher', '碎岩者', 3, 6, 'passive', '溅射 2', { traits: { splash: t3(2) } }),
  enemy('e_exile', '放逐者', 3, 4, 'passive', '放逐：被它击杀的单位不能复生', { special: 'exile' }),
  enemy('e_thorn', '荆棘守卫', 1, 6, 'passive', '反击 2', { traits: { thorns: t3(2) } }),
  enemy('e_guardian', '护卫兵', 2, 8, 'passive', '护卫', { traits: { guard: true } }),
  enemy('e_curser', '咒沙者', 1, 5, 'cast', '施法：你的队首获得 2 层易伤', { cast: [fx('vuln', 'enemyFront', t3(2))] }),
  enemy('e_pyre', '焚火者', 2, 5, 'attack', '普攻后：目标获得 2 层灼烧', { afterAttack: [fx('burn', 'target', t3(2))] }),
  enemy('e_twin', '双刃兵', 4, 5, 'passive', '连击', { traits: { combo: true } }),
  enemy('e_lich', '骨巫', 1, 5, 'cast', '施法：你生命最低的单位受 3 伤害', { cast: [fx('dmg', 'enemyLowest', t3(3))] }),
  enemy('e_dark_priest', '暗祭司', 1, 6, 'cast', '施法：生命最低的受伤友军恢复 4 生命', { cast: [fx('heal', 'lowest', t3(4))] }),
  enemy('e_revenant', '亡魂骑士', 3, 5, 'passive', '复生', { traits: { reborn: true } }),
  enemy('e_tomb', '墓碑', 1, 6, 'faint', '阵亡时：原位召唤 2/2 骷髅兵', { onFaint: [fx('summon', 'self', t3(2), { token: 'e_skel' })] }),
  enemy('e_warlord', '战帅', 4, 10, 'start', '开战时：全体敌人本场 +1 攻', { onStart: [fx('buff', 'allies', t3(1))] }),
  enemy('e_void', '虚空领主', 5, 24, 'beat', '每第 3 拍结束时：把你的队尾拉到队首（每个单位本场只被拉一次）', { special: 'void', boss: true }),
  enemy('e_frostq', '霜魇女皇', 5, 30, 'beat', '每第 3 拍结束时：你攻击最高的单位获得等同其攻击的寒意（下次出手冻结）', { special: 'frostq', boss: true }),
  enemy('e_nightk', '永夜君王', 6, 40, 'hurt', '生命首次低于一半时：召回本场所有阵亡的随从（生命减半），自己获得 3 层格挡', { special: 'nightk', boss: true }),
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
export const DRAFT_POOL = UNITS.filter((u) => !u.token && !u.enemyOnly && FACTION_ORDER.includes(u.faction));

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
export const ROLE_TAGS = ['前排', '输出', '施法', '辅助', '阵亡', '召唤'];

export const RARITY_NAMES: Record<Rarity, string> = { 1: '普通', 2: '稀有', 3: '史诗', 4: '传说' };
