// v0.8 机制冒烟：单卡遍历 + 主将遍历。输出 markdown 到 stdout。
declare const process: { env: Record<string, string | undefined>; exit(code: number): never; stderr: { write(s: string): void }; exitCode: number };
import { DRAFT_POOL, unitDef } from '../src/core/data';
import { GENERALS, PASSIVES } from '../src/core/content';
import { simulate, type BattleSetup } from '../src/core/engine';
import { chapter, type RouteNode } from '../src/core/route';
import { COMBOS } from '../src/core/combos';
import type { EnemyEntry, Slotted } from '../src/core/types';

const TARGET_CARD = process.env.SMOKE_CARD;
const TARGET_GENERAL = process.env.SMOKE_GENERAL;

function report(s: string) { console.log(s); }

// ───────────── 工具 ─────────────

const E = (defId: string, atk?: number, hp?: number): EnemyEntry => ({ defId, ...(atk !== undefined ? { atk } : {}), ...(hp !== undefined ? { hp } : {}) });
const L = (...xs: (EnemyEntry | null)[]) => { const out = xs.slice(0, 5); while (out.length < 5) out.push(null); return out; };
const P = (defId: string, level: number): Slotted => ({ defId, ownedId: 0, copies: ([1, 2, 4] as const)[level - 1] });
const idHash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; };

// 三类敌阵
const ENEMIES: { label: string; lineup: (EnemyEntry | null)[] }[] = [
  { label: '普通', lineup: L(E('e_brute', 3, 7), E('e_raider', 3, 5)) },
  { label: '精英', lineup: L(E('e_warlord', 6, 22), E('e_guardian', 4, 22), E('e_twin', 8, 15), E('e_curser', 2, 13)) },
  { label: '首领', lineup: L(E('e_void', 4, 36), E('e_brute', 5, 13), E('e_assassin', 5, 9), E('e_thorn', 3, 13), E('e_brute', 5, 13)) },
  // 木桩：攻低血厚、打得久，让蓄力 / 节拍 / 次数类能力有机会转满
  { label: '木桩', lineup: L(E('e_brute', 1, 40), E('e_brute', 1, 40), E('e_raider', 1, 6), E('e_brute', 1, 40), E('e_raider', 1, 6)) },
];

// 找到同阵营的队友卡（确定性，用 idHash 做种子）
function sameFaction(draftId: string, count: number, seed: number): string[] {
  const f = unitDef(draftId).faction;
  const pool = f === 'neutral'
    ? DRAFT_POOL.filter(d => d.faction !== 'neutral')
    : DRAFT_POOL.filter(d => d.faction === f && d.id !== draftId);
  // 确定性排序
  const sorted = [...pool].sort((a, b) => idHash(a.id + seed) - idHash(b.id + seed));
  return sorted.slice(0, count).map(d => d.id);
}

// ───────────── A. 单卡遍历 ─────────────

report('# 机制冒烟 v0.8');
report('');
report('## A. 单卡遍历');
report('');

const cards = TARGET_CARD ? DRAFT_POOL.filter(d => d.id === TARGET_CARD) : DRAFT_POOL;
const CARD_COUNT = DRAFT_POOL.length;
report(`卡池 ${CARD_COUNT} 张，测试 ${cards.length} 张`);
report('');

interface CardFail { card: string; name: string; level: number; enemy: string; seed: number; reason: string }
const cardFails: CardFail[] = [];
const abilityDone = new Set<string>();

for (const d of cards) {
  for (let lv = 1; lv <= 3; lv++) {
    const teammates = sameFaction(d.id, 4, lv);
    const lineup: (Slotted | null)[] = [P(d.id, lv)];
    for (const t of teammates.slice(0, 4)) lineup.push(P(t, 1));
    while (lineup.length < 5) lineup.push(null);

    for (const en of ENEMIES) {
      for (let s = 0; s < 3; s++) {
        const battleSeed = (idHash(d.id) ^ (lv << 8) ^ (en.label.charCodeAt(0) << 4) ^ s) | 0;
        const out = simulate({
          player: lineup.slice(0, 5),
          enemy: en.lineup,
          seed: battleSeed,
          record: false,
        });

        if (out.fault) {
          cardFails.push({ card: d.id, name: d.name, level: lv, enemy: en.label, seed: battleSeed,
            reason: `fault: ${out.fault}` });
        }
        if (out.beats >= 60 && out.result === 'draw') {
          cardFails.push({ card: d.id, name: d.name, level: lv, enemy: en.label, seed: battleSeed,
            reason: '超时（60 拍平局）' });
        }
        for (const u of out.initial) {
          if (isNaN(u.hp) || u.hp < 0) {
            cardFails.push({ card: d.id, name: d.name, level: lv, enemy: en.label, seed: battleSeed,
              reason: `NaN/负数生命: ${u.defId} hp=${u.hp}` });
          }
        }

        // 统计能力触发
        if (out.triggers?.[d.id] && (out.triggers[d.id] ?? 0) > 0) {
          abilityDone.add(d.id);
        }
      }
    }
  }
  if (cards.length > 1 && DRAFT_POOL.indexOf(d) % 20 === 0) {
    process.stderr.write(`  卡 ${DRAFT_POOL.indexOf(d) + 1}/${CARD_COUNT} fail ${cardFails.length}\n`);
  }
}

// 没触发过的卡：区分实在触发和条件触发
const missedAbilities: string[] = [];
const conditionalMissed: string[] = [];
for (const d of cards) {
  if (abilityDone.has(d.id)) continue;
  const hasUnconditional = !!(d.onStart || d.afterAttack || d.traits?.pulse);
  const hasConditional = !!(d.cast || d.chargeSkill || d.onRattle || d.onKill || d.onHurt || d.traits?.charge || d.onFront || d.onRear);
  if (hasUnconditional) missedAbilities.push(d.id);
  else if (hasConditional) conditionalMissed.push(d.id);
}

if (cardFails.length === 0) report('✅ 0 次报错、0 次超时、0 次 NaN');
else {
  report(`❌ ${cardFails.length} 项失败：`);
  report('');
  report('| 卡 | 名称 | ★ | 敌阵 | 种子 | 现象 |');
  report('|---|---|---|---|---|---|');
  for (const f of cardFails) report(`| ${f.card} | ${f.name} | ${f.level} | ${f.enemy} | ${f.seed} | ${f.reason} |`);
}

report('');
if (missedAbilities.length === 0) report('✅ 所有无条件触发的能力至少触发一次');
else {
  report(`⚠️ ${missedAbilities.length} 张卡无条件能力未触发（需关注）：`);
  for (const id of missedAbilities) report(`- ${id} ${unitDef(id).name}`);
}
if (conditionalMissed.length > 0) {
  report(`ℹ️ ${conditionalMissed.length} 张卡条件触发能力未触发（蓄力/击杀/施法等，可能为正常）：`);
  for (const id of conditionalMissed) report(`- ${id} ${unitDef(id).name}`);
}

// ───────────── B. 主将 / 被动遍历（差分） ─────────────
// 判据：同一组对局，挂上被动 X 和不挂 X 的战斗日志至少有一场不同，才算「X 生效」。
// 只作用在 RunState 的被动（佣兵品阶、签约、军需官、换位次数、孵化阈值、补蛋）不经过引擎，由 tests/v08-run-passives.test.ts 覆盖。

report('');
report('## B. 主将 / 被动遍历（差分）');
report('');

const RUN_LEVEL = new Set(['hank_1', 'hank_3', 'hank_4', 'reva_1', 'xingjiao_1', 'xingjiao_2']);
interface GenFail { general: string; passives: string; stage: string; reason: string; seed: number }
const genFails: GenFail[] = [];
const passiveDone = new Set<string>();
const comboByGeneral = new Map<string, typeof COMBOS[number]>();
for (const c of COMBOS) comboByGeneral.set(c.general, c);
const generals = TARGET_GENERAL ? GENERALS.filter(g => g.id === TARGET_GENERAL) : GENERALS;
report(`主将 ${generals.length} 名`);
report('');

const battleNodes: { label: string; node: RouteNode }[] = [];
for (let ch = 0; ch < 3; ch++) chapter(ch).stages.forEach((st, i) => {
  const node = st.type === 'boss' ? st.main : st.type === 'fork' ? st.normal : st.type === 'battle' ? st.main : null;
  if (node) battleNodes.push({ label: `${ch + 1}-${i + 1} ${node.name}`, node });
});

function genSetups(gid: string): { lineup: (Slotted | null)[]; extra: Partial<BattleSetup> }[] {
  const combo = comboByGeneral.get(gid);
  const g = GENERALS.find(x => x.id === gid)!;
  const ids = combo ? combo.units : DRAFT_POOL.filter(d => d.faction === g.faction).slice(0, 5).map(d => d.id);
  const out: { lineup: (Slotted | null)[]; extra: Partial<BattleSetup> }[] = [];
  for (const lv of [1, 2]) {
    const lineup: (Slotted | null)[] = ids.slice(0, 5).map(id => P(id, lv));
    while (lineup.length < 5) lineup.push(null);
    if (gid === 'argeon') lineup[4] = P('x_argeon', lv);
    if (gid === 'xingjiao') lineup[4] = P('x_egg', 1);
    if (gid === 'hank') lineup[4] = { ...P('n_merc', lv), temp: true };
    // 让条件型被动有机会生效：卡雷奥斯要施法的压轴者、卡西瓦队尾要有亡语、星角要有龙
    if (gid === 'kaleos' && lv === 2) lineup[3] = P('n_medic', lv);
    if (gid === 'kasiva') lineup[4] = P('d_dune', lv);
    if (gid === 'xingjiao') lineup[3] = P('x_fire', lv);
    const extra: Partial<BattleSetup> = {};
    if (gid === 'sajj') extra.reserve = [P('a_chanter', lv), P('d_onyx', lv)];
    if (gid === 'reva') extra.swaps = lv === 1 ? [[0, 2], [1, 3]] : [[0, 4]];
    out.push({ lineup, extra });
  }
  return out;
}
const sig = (out: ReturnType<typeof simulate>) => out.result + '|' + out.beats + '|' + (out.gold ?? 0) + '|' + out.log.map(l => JSON.stringify(l.ev)).join(';');

for (const g of generals) {
  const own = PASSIVES.filter(p => p.general === g.id).map(p => p.id);
  const setups = genSetups(g.id);
  let k = 0;
  for (const { lineup, extra } of setups) for (const { label, node } of battleNodes) for (let sd = 0; sd < 2; sd++) {
    const seed = (idHash(g.id + label) ^ (sd * 0x2545f491) ^ k++) | 0;
    const run = (passives: string[]) => simulate({ player: structuredClone(lineup), enemy: node.lineup, rules: node.rules, ...extra,
      general: { id: g.id, power: 1, passives }, seed, record: true });
    const base = run([]);
    for (const [o, tag] of [[base, '无被动'] as const]) {
      if (o.fault) genFails.push({ general: g.id, passives: tag, stage: label, reason: `fault: ${o.fault}`, seed });
    }
    const bs = sig(base);
    for (const p of own) {
      if (passiveDone.has(p) && sd > 0) continue;
      const o = run([p]);
      if (o.fault) genFails.push({ general: g.id, passives: p, stage: label, reason: `fault: ${o.fault}`, seed });
      if (sig(o) !== bs) passiveDone.add(p);
    }
    // 全被动同时挂：只查报错 / 超时
    const all = run(own);
    if (all.fault) genFails.push({ general: g.id, passives: own.join('+'), stage: label, reason: `fault: ${all.fault}`, seed });
  }
  process.stderr.write(`  主将 ${g.name}\n`);
}

if (genFails.length === 0) report('✅ 主将遍历 0 次报错');
else {
  report(`❌ ${genFails.length} 项失败：`);
  report('');
  report('| 主将 | 被动 | 节点 | 现象 | 种子 |');
  report('|---|---|---|---|---|');
  for (const f of genFails) report(`| ${f.general} | ${f.passives} | ${f.stage} | ${f.reason} | ${f.seed} |`);
}

report('');
const allPassives = new Set<string>();
for (const g of generals) for (const p of PASSIVES.filter(p => p.general === g.id)) allPassives.add(p.id);
const missedPassives = [...allPassives].filter(id => !passiveDone.has(id) && !RUN_LEVEL.has(id));
const runLevelEngineHit = [...RUN_LEVEL].filter(id => passiveDone.has(id));
report(`引擎差分生效 ${[...allPassives].filter(id => passiveDone.has(id)).length}/${allPassives.size}；局外被动 ${RUN_LEVEL.size} 个由 vitest 覆盖${runLevelEngineHit.length ? `（其中 ${runLevelEngineHit.join('、')} 也改变了战斗）` : ''}`);
if (missedPassives.length === 0) report('✅ 每个引擎被动在差分中至少生效一次');
else {
  report(`⚠️ ${missedPassives.length} 个被动挂上后战斗日志与不挂完全相同：`);
  for (const pid of missedPassives) {
    const pDef = PASSIVES.find(p => p.id === pid);
    if (pDef) report(`- ${pDef.general}/${pid} ${pDef.name}：${pDef.text}`);
  }
}

// ───────────── 汇总 ─────────────

report('');
report('## 汇总');
report('');
const totalFails = cardFails.length + genFails.length;
const totalMissed = missedAbilities.length + missedPassives.length;
if (totalFails === 0 && totalMissed === 0) {
  report(`✅ **通过**：0 报错、0 超时、0 能力/被动未触发`);
} else {
  report(`❌ **未通过**：${totalFails} 错误、${totalMissed} 未触发${conditionalMissed.length > 0 ? `（+${conditionalMissed.length} 条件触发未触发）` : ''}`);
  process.exitCode = 1;
}
