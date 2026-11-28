// v2 卡池：圣盾 10 + 影刃 10 + 深渊 10 + 霜境 10 + 中立 4，召唤物 3，机制敌人 4（数据来自 CONTENT-DESIGN.md 第 7、8、11 章）。
// 从 prototype/cards.js 移植，卡牌顺序必须和原型一致（随机组队按卡池下标抽卡）。
// 钩子签名：(s, u, payload, A)，A 为 engine.ts 的 API。所有事件都会广播给场上全部单位，钩子自己判断是否与自己有关。
// art 是原型素材键（prototype/units.js），接入正式界面时再映射到游戏的素材清单。
import type { CardDef, Faction, Payload, Side, Unit } from './types';

export const CARDS: Record<string, CardDef> = {};
const card = (o: CardDef): CardDef => { CARDS[o.id] = o; return o; };
const me = (u: Unit, p: Payload): boolean => p.unit === u;
const opp = (u: Unit): Side => (1 - u.side) as Side;

// ================= 圣盾 =================
card({ id: 'squire', name: '银卫侍从', faction: 'shield', tier: 1, role: '启动', pos: 'front', atk: 1, hp: 4, art: 'l_shield',
  text: '开战时：自身和后邻友军各获得 1 层格挡', lv3: '改为自身和身后所有友军',
  on: { start(s, u, p, A) {
    A.addBlock(s, u, 1);
    for (const x of A.lv3(u) ? A.behind(s, u) : [A.back(s, u)]) if (x) A.addBlock(s, x, 1);
  } } });

card({ id: 'recruit', name: '圣殿新兵', faction: 'shield', tier: 1, role: '启动', pos: 'front', atk: 2, hp: 4, art: 'l_vigil',
  text: '受击时：若消耗了格挡，本场 +1 伤害', lv3: '改为 +2',
  on: { hit(s, u, p, A) { if (me(u, p) && p.blockUsed) A.buff(s, u, A.lv3(u) ? 2 : 1, 0); } } });

card({ id: 'templar', name: '日石圣骑', faction: 'shield', tier: 2, role: '引擎', pos: 'front', atk: 2, hp: 6, art: 'l_templar',
  text: '受击时：若消耗了格挡，后邻友军获得 1 层格挡（每场 3 次）', lv3: '每场 5 次',
  on: { hit(s, u, p, A) {
    if (!me(u, p) || !p.blockUsed) return;
    const b = A.back(s, u);
    if (b && A.useOnce(u, 'pass', A.lv3(u) ? 5 : 3)) A.addBlock(s, b, 1);
  } } });

card({ id: 'wall', name: '盾墙卫士', faction: 'shield', tier: 2, role: '支撑', pos: 'mid', atk: 1, hp: 7, art: 'l_warden',
  text: '援护（邻格）：相邻友军被单体施法、狙击、拉拽选中时改由自己承受', lv3: '援护范围改为身后所有友军',
  taunt: (u) => (u.lvl >= 3 ? 'behind' : 'adjacent') });

card({ id: 'lion', name: '碧鬃战狮', faction: 'shield', tier: 3, role: '引擎', pos: 'back', atk: 3, hp: 4, art: 'l_azurelion',
  text: '交锋后：1 号位友军获得 2 点临时护盾', lv3: '改为 1、2 号位友军',
  on: { afterClash(s, u, p, A) {
    const L = A.allies(s, u);
    for (const x of L.slice(0, A.lv3(u) ? 2 : 1)) A.addShield(s, x, 2);
  } } });

card({ id: 'sunriser', name: '晨曦骑士', faction: 'shield', tier: 3, role: '引擎', pos: 'back', atk: 4, hp: 5, art: 'l_sunriser',
  text: '友军每消耗 1 层格挡，自身充能 +1；充能 3 时对敌方 1 号位施法（等于自身伤害）', lv3: '充能 2 即释放',
  charge: (u) => (u.lvl >= 3 ? 2 : 3),
  fire(s, u, A) { A.castDamage(s, u, () => A.enemyFront(s, u), u.atk, '晨曦'); },
  on: { blockConsumed(s, u, p, A) { if (A.isAlly(u, p.unit)) A.addCharge(s, u, 1); } } });

card({ id: 'maiden', name: '日石修女', faction: 'shield', tier: 3, role: '支撑', pos: 'back', atk: 2, hp: 5, art: 'l_angel', artNote: '临时用 f1_support',
  text: '交锋后：为受伤最重的友军恢复 2 点血量', lv3: '同时为该友军加 1 层格挡（每场 2 次）',
  on: { afterClash(s, u, p, A) {
    const hurt = A.allies(s, u).filter((x) => x.hp < x.maxHp).sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp))[0];
    if (!hurt) return;
    A.heal(s, hurt, 2);
    if (A.lv3(u) && A.useOnce(u, 'blk', 2)) A.addBlock(s, hurt, 1);
  } } });

card({ id: 'vanguard', name: '银鬃先锋', faction: 'shield', tier: 4, role: '桥接', bridge: '熔岩', pos: 'mid', atk: 4, hp: 9, art: 'l_knight',
  text: '前邻友军受伤后：前邻友军本场 +1 血量（战斗结束固化 1 点，原型不计）', lv3: '固化 2 点',
  on: { damaged(s, u, p, A) { if (p.unit && p.unit === A.ahead(s, u) && p.unit.hp > 0) A.buff(s, p.unit, 0, 1); } } });

card({ id: 'windblade', name: '风刃统领', faction: 'shield', tier: 4, role: '桥接', bridge: '影刃', pos: 'mid', atk: 5, hp: 7, art: 'l_windblade',
  text: '补位时：自身和后邻友军各获得 1 层格挡', lv3: '改为自身和身后所有友军',
  on: { enterFront(s, u, p, A) {
    if (!me(u, p)) return;
    A.addBlock(s, u, 1);
    for (const x of A.lv3(u) ? A.behind(s, u) : [A.back(s, u)]) if (x) A.addBlock(s, x, 1);
  } } });

card({ id: 'ironcliffe', name: '铁崖守护者', faction: 'shield', tier: 5, role: '终端', pos: 'front', size: 2, atk: 6, hp: 18, art: 'l_ironcliffe',
  text: '巨型（2 格）。援护全队；每承受一次被援护重定向的效果，获得 1 层格挡（每场 3 次）；全队受到的伤害 15% 转给自己', lv3: '分摊比例 30%',
  taunt: () => 'all',
  share: (u) => (u.lvl >= 3 ? 0.3 : 0.15),
  on: { redirected(s, u, p, A) { if (me(u, p) && A.useOnce(u, 'cliff', 3)) A.addBlock(s, u, 1); } } });

// ================= 影刃 =================
card({ id: 'fox', name: '灯笼狐', faction: 'blade', tier: 1, role: '启动', pos: 'mid', atk: 2, hp: 4, art: 's_fox',
  text: '补位时：对敌方 1 号位施法 1 点', lv3: '施法 2 点',
  on: { enterFront(s, u, p, A) { if (me(u, p)) A.castDamage(s, u, () => A.enemyFront(s, u), A.lv3(u) ? 2 : 1, '灯笼狐'); } } });

card({ id: 'stepper', name: '影步忍徒', faction: 'blade', tier: 1, role: '启动', pos: 'front', atk: 3, hp: 3, art: 's_step', artNote: '临时用 neutral_silhouettetracer',
  text: '交锋后：若自身受伤，与后邻友军换位（每场 1 次）', lv3: '每场 2 次',
  on: { afterClash(s, u, p, A) {
    const b = A.back(s, u);
    if (u.hp < u.maxHp && b && b.size === 1 && A.useOnce(u, 'step', A.lv3(u) ? 2 : 1)) A.swapUnits(s, u, b);
  } } });

card({ id: 'fanblade', name: '扇刃刺客', faction: 'blade', tier: 2, role: '引擎', pos: 'mid', atk: 3, hp: 5, art: 's_backstab',
  text: '补位时：下一次常规攻击获得连击', lv3: '连击两次',
  on: { enterFront(s, u, p, A) { if (me(u, p)) u.combo = A.lv3(u) ? 2 : 1; } } });

card({ id: 'panda', name: '竹林熊猫', faction: 'blade', tier: 2, role: '支撑', pos: 'front', atk: 2, hp: 7, art: 's_viper', artNote: '临时用 f2_support',
  text: '受伤后：若存活，与后邻友军换位（每场 2 次）', lv3: '换位后自身获得 1 层格挡',
  on: { damaged(s, u, p, A) {
    if (!me(u, p) || u.hp <= 0) return;
    const b = A.back(s, u);
    if (b && b.size === 1 && A.useOnce(u, 'roll', 2) && A.swapUnits(s, u, b) && A.lv3(u)) A.addBlock(s, u, 1);
  } } });

card({ id: 'seeker', name: '寻刃者', faction: 'blade', tier: 3, role: '引擎', pos: 'mid', atk: 4, hp: 5, art: 's_hunter',
  text: '位于 2 号位时：1 号位友军常规攻击，自身同步攻击同一目标（协同，无反撞）', lv3: '位于 2、3 号位都生效',
  on: { clashAttack(s, u, p, A) {
    if (!A.isAlly(u, p.unit) || p.unit === u) return;
    const i = A.idx(s, u);
    if (i === 1 || (A.lv3(u) && i === 2)) A.extraAttack(s, u, () => (p.target && !p.target.dead ? p.target : A.enemyFront(s, u)), { label: 'assist' });
  } } });

card({ id: 'stormkage', name: '风暴影', faction: 'blade', tier: 3, role: '引擎', pos: 'back', atk: 3, hp: 6, art: 's_master',
  text: '己方每发生一次补位，充能 +1；充能 3 时狙击敌方队尾（攻击，受援护拦截）', lv3: '充能 2 即释放',
  charge: (u) => (u.lvl >= 3 ? 2 : 3),
  fire(s, u, A) { A.extraAttack(s, u, () => A.enemyTail(s, u), { snipe: true, label: 'snipe' }); },
  on: { sideRefill(s, u, p, A) { if (p.side === u.side) A.addCharge(s, u, 1); } } });

card({ id: 'fourwinds', name: '四风法师', faction: 'blade', tier: 3, role: '支撑', pos: 'back', atk: 3, hp: 6, art: 's_fourwinds',
  text: '开战时：击退敌方 1 号位', lv3: '开战时和第 4 轮交锋后各一次',
  on: {
    start(s, u, p, A) { A.knockback(s, opp(u)); },
    afterClash(s, u, p, A) { if (A.lv3(u) && s.round === 4) A.knockback(s, opp(u)); },
  } });

card({ id: 'phantom', name: '死亡幻影', faction: 'blade', tier: 4, role: '桥接', bridge: '沙阵', pos: 'mid', atk: 5, hp: 7, art: 's_ninja',
  text: '自身每次换位，己方队尾友军蓄力 +1', lv3: '冷却 −2',
  on: { swapped(s, u, p, A) {
    if (!me(u, p)) return;
    const L = A.allies(s, u);
    const tail = L[L.length - 1];
    if (tail && tail !== u) A.addCharge(s, tail, A.lv3(u) ? 2 : 1);
  } } });

card({ id: 'monk', name: '怒拳武僧', faction: 'blade', tier: 4, role: '桥接', bridge: '圣盾', pos: 'back', atk: 4, hp: 9, art: 'n_kiri', artNote: '临时用 neutral_mercdaggerkiri',
  text: '插队：1 号位友军即将受致命一击时，插到 1 号位承受这一击，并获得 1 层格挡（每场 1 次）', lv3: '每场 2 次',
  insert: (s, u) => (u.uses.ins || 0) < (u.lvl >= 3 ? 2 : 1),
  onInsert(s, u, p, A) { u.uses.ins = (u.uses.ins || 0) + 1; A.addBlock(s, u, 1); } });

card({ id: 'chakri', name: '查克里化身', faction: 'blade', tier: 5, role: '终端', pos: 'front', size: 2, atk: 7, hp: 16, art: 's_dancer',
  text: '巨型（2 格），横扫。补位时获得连击；己方每发生一次补位，自身 +1 伤害', lv3: '每次补位 +2 伤害',
  on: {
    enterFront(s, u, p, A) { if (me(u, p)) u.combo = 1; },
    sideRefill(s, u, p, A) { if (p.side === u.side) A.buff(s, u, A.lv3(u) ? 2 : 1, 0); },
  } });

// ================= 深渊 =================
// 死亡是资源：亡语、吞噬制造死亡，坟场计数和传功把力量留给后排。
const ally = (u: Unit, p: Payload): boolean => !!p.unit && p.unit !== u && p.unit.side === u.side;

card({ id: 'shade', name: '影子', faction: 'token', tier: 0, role: '召唤物', pos: 'front', atk: 1, hp: 1, art: 'a_shade',
  text: '影爬虫的召唤物', lv3: '—' });

card({ id: 'crawler', name: '影爬虫', faction: 'abyss', tier: 1, role: '启动', pos: 'front', atk: 2, hp: 3, art: 'a_crawler',
  text: '亡语：召唤一个 1/1 影子（填入 1 号位）', lv3: '召唤两个',
  on: { death(s, u, p, A) { for (let i = 0; i < (A.lv3(u) ? 2 : 1); i++) A.summon(s, u.side, 'shade', 1, 'front', u); } } });

card({ id: 'nightsorrow', name: '夜哀刺客', faction: 'abyss', tier: 1, role: '启动', pos: 'front', atk: 3, hp: 2, art: 'a_nightsorrow',
  text: '亡语：对敌方 1 号位施法 2 点', lv3: '改为对敌方 1、2 号位各施法 2 点',
  on: { death(s, u, p, A) {
    A.castDamage(s, u, () => A.enemyFront(s, u), 2, '夜哀');
    if (A.lv3(u)) A.castDamage(s, u, () => A.line(s, opp(u))[1], 2, '夜哀');
  } } });

card({ id: 'darkspine', name: '暗脊魔', faction: 'abyss', tier: 2, role: '引擎', pos: 'mid', atk: 2, hp: 5, art: 'a_darkspine',
  text: '其他友军阵亡时：自身本场 +1 伤害', lv3: '改为 +1/+1',
  on: { allyDeath(s, u, p, A) { if (ally(u, p)) A.buff(s, u, 1, A.lv3(u) ? 1 : 0); } } });

card({ id: 'gloomchaser', name: '幽影追猎者', faction: 'abyss', tier: 2, role: '支撑', pos: 'front', atk: 2, hp: 4, art: 'a_gloomchaser',
  text: '战备结束时：吞噬后邻友军（触发其亡语），获得其伤害和血量', lv3: '吞噬后邻两名友军',
  on: { prep(s, u, p, A) {
    for (let i = 0; i < (A.lv3(u) ? 2 : 1); i++) { const b = A.back(s, u); if (b && b.size === 1) A.devour(s, u, b, { hp: true }); }
  } } });

card({ id: 'shadowdancer', name: '影舞者', faction: 'abyss', tier: 3, role: '引擎', pos: 'back', atk: 3, hp: 6, art: 'a_shadowdancer',
  text: '友军亡语每触发一次：对敌方 1 号位施法 2 点', lv3: '施法 3 点',
  on: { deathrattle(s, u, p, A) { if (p.unit!.side === u.side) A.castDamage(s, u, () => A.enemyFront(s, u), A.lv3(u) ? 3 : 2, '影舞'); } } });

card({ id: 'bloodmoon', name: '血月祭司', faction: 'abyss', tier: 3, role: '引擎', pos: 'front', atk: 4, hp: 3, art: 'a_bloodmoon',
  text: '亡语：传功，后邻友军获得自身死前 50% 的伤害与血量上限', lv3: '75%',
  on: { death(s, u, p, A) {
    const heir = A.line(s, u.side)[u.deadIdx ?? -1];
    if (!heir) return;
    const r = A.lv3(u) ? 0.75 : 0.5;
    A.buff(s, heir, Math.floor(u.atk * r), Math.floor(u.maxHp * r));
  } } });

card({ id: 'daemongate', name: '恶魔之门', faction: 'abyss', tier: 3, role: '支撑', pos: 'back', atk: 0, hp: 8, obstacle: true, art: 'a_daemongate',
  text: '障碍物（不攻击、稳固）。交锋后：若有空格，从坟场以 1 血复活一个阶层最低的友军到队尾（每场 1 次）', lv3: '每场 2 次',
  on: { afterClash(s, u, p, A) {
    if ((u.uses.gate || 0) >= (A.lv3(u) ? 2 : 1) || A.freeSlots(s, u.side) <= 0 || !s.grave[u.side].length) return;
    u.uses.gate = (u.uses.gate || 0) + 1;
    A.revive(s, u.side, (g) => [...g].sort((a, b) => a.tier - b.tier)[0], 'back', 1);
  } } });

card({ id: 'ninemoons', name: '九月收割者', faction: 'abyss', tier: 4, role: '桥接→熔岩', pos: 'mid', atk: 5, hp: 8, art: 'a_ninemoons',
  text: '战备结束时：吞噬后邻友军（触发其亡语），获得其伤害、血量和技能', lv3: '吞噬后邻两名友军',
  on: { prep(s, u, p, A) {
    for (let i = 0; i < (A.lv3(u) ? 2 : 1); i++) { const b = A.back(s, u); if (b && b.size === 1) A.devour(s, u, b, { steal: true, hp: true }); }
  } } });

card({ id: 'siren', name: '塞壬', faction: 'abyss', tier: 4, role: '桥接→霜境', pos: 'back', atk: 5, hp: 10, art: 'a_siren',
  text: '溢出转化：友军召唤因满格失败时，对敌方 1 号位施法 2 点', lv3: '施法 3 点，并给随机友军 +1 伤害',
  on: { summonFail(s, u, p, A) {
    if (p.side !== u.side) return;
    A.castDamage(s, u, () => A.enemyFront(s, u), A.lv3(u) ? 3 : 2, '塞壬');
    if (A.lv3(u)) { const L = A.line(s, u.side).filter((x) => !x.obstacle); A.buff(s, L[Math.floor(A.rand(s) * L.length)], 1, 0); }
  } } });

card({ id: 'juggernaut', name: '吞噬巨兽', faction: 'abyss', tier: 5, role: '终端·巨型', pos: 'back', size: 2, atk: 9, hp: 18, art: 'a_juggernaut', resonance: true,
  text: '亡语共鸣：友军亡语触发两次；友军每阵亡一名，自身 +1 伤害', lv3: '改为 +1/+1',
  on: { allyDeath(s, u, p, A) { if (ally(u, p) && !p.unit!.token) A.buff(s, u, 1, A.lv3(u) ? 1 : 0); } } });

// ================= 霜境 =================
// 铺满小兵，冻住敌人的节奏：召唤默认填 1 号位，冰冻打断敌方队首，扩编让队伍更宽。
card({ id: 'wolf1', name: '灵狼', faction: 'token', tier: 0, role: '召唤物', pos: 'front', atk: 1, hp: 1, art: 'f_wolf', text: '雪原追猎者的召唤物', lv3: '—' });
card({ id: 'wolf3', name: '芬里尔灵狼', faction: 'token', tier: 0, role: '召唤物', pos: 'front', atk: 3, hp: 2, art: 'f_wolf', text: '芬里尔战主的召唤物', lv3: '—' });

card({ id: 'snowchaser', name: '雪原追猎者', faction: 'frost', tier: 1, role: '启动', pos: 'back', atk: 2, hp: 4, art: 'f_snowchaser',
  text: '开战时：召唤一只 1/1 灵狼（填入 1 号位）；满格召唤失败时改为自身获得 1 层格挡', lv3: '召唤两只',
  on: { start(s, u, p, A) { for (let i = 0; i < (A.lv3(u) ? 2 : 1); i++) if (!A.summon(s, u.side, 'wolf1', 1, 'front', u)) A.addBlock(s, u, 1); } } });

card({ id: 'beetle', name: '冰晶甲虫', faction: 'frost', tier: 1, role: '启动', pos: 'front', atk: 2, hp: 3, art: 'f_beetle',
  text: '受击时：冰冻攻击者（下一轮不能攻击，每场 1 次）', lv3: '每场 2 次',
  on: { hit(s, u, p, A) { if (me(u, p) && p.src && (u.uses.frz || 0) < (A.lv3(u) ? 2 : 1) && A.freeze(s, p.src, u)) u.uses.frz = (u.uses.frz || 0) + 1; } } });

card({ id: 'voice', name: '风之声', faction: 'frost', tier: 2, role: '引擎', pos: 'back', atk: 2, hp: 6, art: 'f_voice',
  text: '己方每召唤一个单位，该单位 +1/+1', lv3: '+2/+2',
  on: { summoned(s, u, p, A) { if (p.unit!.side === u.side) A.buff(s, p.unit, A.lv3(u) ? 2 : 1, A.lv3(u) ? 2 : 1); } } });

card({ id: 'dryad', name: '冰霜树精', faction: 'frost', tier: 2, role: '支撑', pos: 'back', atk: 2, hp: 6, art: 'f_dryad',
  text: '每 2 轮交锋后：最接近释放的敌方蓄力技能 −1', lv3: '第一次改为 −2',
  on: { afterClash(s, u, p, A) {
    if (s.round % 2) return; // 每轮 −1 会和每轮 +1 的蓄力抵消，永久锁死
    const E = A.line(s, opp(u)).filter((x) => A.def(x).charge && x.charge > 0);
    if (!E.length) return;
    E.sort((a, b) => (A.def(a).charge!(a) - a.charge) - (A.def(b).charge!(b) - b.charge)); // 剩余最少的在前
    const n = A.lv3(u) && !u.uses.big ? 2 : 1;
    if (n === 2) u.uses.big = 1;
    E[0].charge = Math.max(0, E[0].charge - n);
    A.log(s, 'delay', { uid: E[0].uid, src: u.uid });
  } } });

card({ id: 'fenrir', name: '芬里尔战主', faction: 'frost', tier: 3, role: '引擎', pos: 'mid', atk: 3, hp: 4, art: 'f_fenrir',
  text: '亡语：召唤一只 3/2 灵狼', lv3: '召唤两只',
  on: { death(s, u, p, A) { for (let i = 0; i < (A.lv3(u) ? 2 : 1); i++) A.summon(s, u.side, 'wolf3', 1, 'front', u); } } });

card({ id: 'drake', name: '霜龙', faction: 'frost', tier: 3, role: '引擎', pos: 'mid', atk: 3, hp: 6, art: 'f_drake', frostCast: true,
  text: '开战时：冰冻敌方 1 号位；被冰冻的敌人受到的施法 +1', lv3: '冰冻敌方 1、2 号位',
  on: { start(s, u, p, A) { for (const x of A.line(s, opp(u)).slice(0, A.lv3(u) ? 2 : 1)) A.freeze(s, x, u); } } });

card({ id: 'bonechill', name: '刺骨冰墙', faction: 'frost', tier: 3, role: '支撑', pos: 'front', atk: 0, hp: 7, obstacle: true, art: 'f_bonechill',
  text: '障碍物。受击时：冰冻攻击者（每场 2 次）', lv3: '每场 3 次',
  on: { hit(s, u, p, A) { if (me(u, p) && p.src && (u.uses.frz || 0) < (A.lv3(u) ? 3 : 2) && A.freeze(s, p.src, u)) u.uses.frz = (u.uses.frz || 0) + 1; } } });

card({ id: 'gravity', name: '重力井', faction: 'frost', tier: 4, role: '桥接→沙阵', pos: 'back', atk: 0, hp: 10, obstacle: true, anchor: true, art: 'f_gravity',
  expand: (u) => (u.lvl >= 3 ? 2 : 1),
  text: '障碍物。扩编：己方容量 +1（在场时生效）；敌方位移效果对己方失效。交锋后：若有空格，召唤一只 1/1 灵狼（每场 2 次）', lv3: '容量 +2',
  on: { afterClash(s, u, p, A) { if ((u.uses.wolf || 0) < 2 && A.freeSlots(s, u.side) > 0) { u.uses.wolf = (u.uses.wolf || 0) + 1; A.summon(s, u.side, 'wolf1', 1, 'front', u); } } } });

card({ id: 'wolfraven', name: '狼鸦', faction: 'frost', tier: 4, role: '桥接→深渊', pos: 'back', atk: 5, hp: 9, art: 'f_wolfraven',
  text: '友军召唤物阵亡时：对敌方 1 号位施法 1 点', lv3: '施法 2 点',
  on: { allyDeath(s, u, p, A) { if (p.unit!.side === u.side && p.unit!.token) A.castDamage(s, u, () => A.enemyFront(s, u), A.lv3(u) ? 2 : 1, '狼鸦'); } } });

card({ id: 'seismic', name: '地震元素', faction: 'frost', tier: 5, role: '终端·巨型', pos: 'back', size: 2, atk: 10, hp: 24, art: 'f_seismic',
  text: '阵型共鸣：己方满编时，开战时和每 3 轮交锋后冰冻敌方前 2 格', lv3: '冰冻敌方前 3 格',
  on: {
    start(s, u, p, A) { if (A.isFull(s, u.side)) for (const x of A.line(s, opp(u)).slice(0, A.lv3(u) ? 3 : 2)) A.freeze(s, x, u); },
    afterClash(s, u, p, A) { if (s.round % 3 === 0 && A.isFull(s, u.side)) for (const x of A.line(s, opp(u)).slice(0, A.lv3(u) ? 3 : 2)) A.freeze(s, x, u); },
  } });

// ================= 中立 =================
card({ id: 'sworn', name: '誓盾佣兵', faction: 'neutral', tier: 1, role: '中立', pos: 'front', atk: 2, hp: 5, armor: 1, art: 'n_sworndef',
  text: '护甲 1', lv3: '护甲 2' });

card({ id: 'golem', name: '碎盾魔像', faction: 'neutral', tier: 2, role: '中立', pos: 'front', atk: 3, hp: 5, art: 't_statue',
  text: '常规攻击附带碎盾（清空目标全部格挡）', lv3: '—', shatter: true });

card({ id: 'whistler', name: '鸣镝射手', faction: 'neutral', tier: 2, role: '中立', pos: 'back', atk: 3, hp: 3, art: 'n_whistler',
  text: '交锋后：若不在 1 号位，充能 +1；充能 2 时狙击敌方队尾（受援护拦截）', lv3: '—',
  charge: () => 2,
  fire(s, u, A) { A.extraAttack(s, u, () => A.enemyTail(s, u), { snipe: true, label: 'snipe' }); },
  on: { afterClash(s, u, p, A) { if (A.idx(s, u) !== 0) A.addCharge(s, u, 1); } } });

card({ id: 'talon', name: '战爪猎手', faction: 'neutral', tier: 3, role: '中立', pos: 'mid', atk: 3, hp: 6, art: 's_lord',
  text: '开战时：拉拽敌方队尾到 1 号位（受援护拦截）', lv3: '—',
  on: { start(s, u, p, A) {
    const t = A.enemyTail(s, u);
    if (t) A.pullToFront(s, A.redirect(s, t, 'pull'));
  } } });

// ================= 机制敌人（出题用，不进玩家卡池） =================
// intent(x) 返回战场上显示的意图文字，x 是快照里的单位数据。
const emul = (u: { lvl: number; atkScale?: number; scale?: number }): number => (u.lvl === 1 ? 1 : u.lvl === 2 ? 1.5 : 2) * (u.atkScale ?? u.scale ?? 1);

card({ id: 'cannon', name: '沙暴炮台', faction: 'enemy', boss: true, tier: 3, role: '机制', pos: 'back', atk: 1, hp: 10, art: 'n_mechcannon',
  text: '交锋后蓄力 +1；蓄满 3 时对敌方 1 号位施法 6 点（受援护拦截）', lv3: '—',
  answer: '调度者：蓄满前换上满血或带格挡的单位；推阵者：钩到 1 号位打掉；时序者：迟滞推迟炮击',
  charge: () => 3,
  intent: (x) => `${x.charge}/3 → 1号位 ${Math.floor(6 * emul(x))}`,
  fire(s, u, A) { A.castDamage(s, u, () => A.enemyFront(s, u), Math.floor(6 * emul(u)), '炮击'); },
  on: { afterClash(s, u, p, A) { A.addCharge(s, u, 1); } } });

card({ id: 'puncher', name: '连拳斗士', faction: 'enemy', boss: true, tier: 3, role: '机制', pos: 'front', atk: 2, hp: 15, art: 'e_warlord',
  text: '位于 1 号位时，每轮常规攻击都附带连击', lv3: '连击两次',
  answer: '调度者：换上有格挡的单位；推阵者：震退到队尾；时序者：冰冻让它停一轮',
  intent: () => '每轮连击',
  on: { beforeAttack(s, u, p, A) { if (A.idx(s, u) === 0) u.combo = A.lv3(u) ? 2 : 1; } } });

card({ id: 'reaper', name: '处刑者', faction: 'enemy', boss: true, tier: 3, role: '机制', pos: 'back', atk: 2, hp: 9, art: 'e_lich',
  text: '每 2 轮交锋后，对敌方 2 号位施法 5 点（受援护拦截）', lv3: '—',
  answer: '调度者：处刑前换上耐打的 2 号位；推阵者：钩到 1 号位打掉；时序者：迟滞推迟处刑',
  charge: () => 2,
  intent: (x) => `${x.charge}/2 → 2号位 ${Math.floor(5 * emul(x))}`,
  fire(s, u, A) { A.castDamage(s, u, () => { const L = A.line(s, opp(u)); return L[1] || L[0]; }, Math.floor(5 * emul(u)), '处刑'); },
  on: { afterClash(s, u, p, A) { A.addCharge(s, u, 1); } } });

card({ id: 'soul', name: '噬魂者', faction: 'enemy', boss: true, tier: 3, role: '机制', pos: 'front', atk: 2, hp: 12, art: 'a_nightmare',
  text: '敌方每阵亡一名单位，自身 +2/+2；每轮交锋后 +1 伤害', lv3: '—',
  answer: '调度者：换下快死的队首；推阵者：震退它，先清护卫；时序者：冰冻它少挨打',
  intent: () => '吞噬阵亡者',
  on: {
    allyDeath(s, u, p, A) { if (p.unit!.side !== u.side) A.buff(s, u, 2, 2); },
    afterClash(s, u, p, A) { A.buff(s, u, 1, 0); },
  } });

export const FACTION_NAME: Record<Faction, string> = { shield: '圣盾', blade: '影刃', abyss: '深渊', frost: '霜境', neutral: '中立', enemy: '敌人', token: '召唤物' };
/** 玩家卡池（不含机制敌人和召唤物） */
export const POOL: CardDef[] = Object.values(CARDS).filter((c) => c.faction !== 'enemy' && c.faction !== 'token');
export const ENEMY_POOL: CardDef[] = Object.values(CARDS).filter((c) => c.faction === 'enemy');
