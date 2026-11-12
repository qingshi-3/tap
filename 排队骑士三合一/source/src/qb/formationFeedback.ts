// 摆阵时只在副本上结束备战、按正式种子结算。坐标始终指向预览盘面上的原单位。
import { ruleNumber, type BattleRule } from '../core/archetypes';
import { card, equipOf, FOOD, RELIC, STAT_CAP } from '../core/data';
import { QUEUE_MAX, type BattleOut, type Ev, type Snap } from '../core/engine';
import { CHARGE_MAX, curNode, endTurn, fight, isCombat, lvlOf, moveOwned, type Owned, type RunState, type ShopFx } from '../core/run';
import type { TargetPos } from './targeting';

type Tone = 'benefit' | 'attack' | 'condition';
export interface FormationFeedback {
  lines: { label: string; text: string; tone: Tone }[];
  beneficiaries: TargetPos[];
  beneficiaryOids: number[];
  damageTargets: TargetPos[];
}
const empty = (): FormationFeedback => ({ lines: [], beneficiaries: [], beneficiaryOids: [], damageTargets: [] });
const friendly = (slot: number): TargetPos => ({ side: 0, slot });
const signed = (n: number) => n >= 0 ? '+' + n : String(n);
const statsText = (a: number, h: number) => a && h ? signed(a) + '/' + signed(h) : a ? '攻击' + signed(a) : '生命' + signed(h);
const same = (a: TargetPos, b: TargetPos) => a.side === b.side && a.slot === b.slot;

interface Row { priority: number; label: string; text: string; tone: Tone; targets: TargetPos[] }
class Rows {
  private rows: Row[] = [];
  add(priority: number, label: string, text: string, tone: Tone, targets: TargetPos[] = []) {
    this.rows.push({ priority, label, text, tone, targets });
  }
  result(): FormationFeedback {
    const out = empty();
    for (const row of this.rows.sort((a, b) => b.priority - a.priority)) {
      if (out.lines.some(line => line.label === row.label && line.text === row.text)) continue;
      out.lines.push({ label: row.label, text: row.text, tone: row.tone });
      for (const pos of row.targets) {
        const list = pos.side === 0 ? out.beneficiaries : out.damageTargets;
        if (!list.some(p => same(p, pos))) list.push(pos);
      }
      if (out.lines.length === 3) break;
    }
    return out;
  }
}

// 先在同一对象上累计实际变化，再把收到相同效果的多个位置合写为一行。
type Effect = 'stats' | 'permanent' | 'block' | 'charge' | 'mark' | 'seal' | 'damage' | 'blocked' | 'heal';
interface Change { priority: number; label: string; target: TargetPos; effect: Effect; a: number; h: number }
class Changes {
  private changes = new Map<string, Change>();
  add(priority: number, label: string, target: TargetPos, effect: Effect, a: number, h = 0) {
    if (!a && !h) return;
    const key = [label, target.side, target.slot, effect].join('|');
    const old = this.changes.get(key);
    if (old) { old.a += a; old.h += h; }
    else this.changes.set(key, { priority, label, target, effect, a, h });
  }
  append(rows: Rows, selected: number, queue: RunState['queue']) {
    const groups = new Map<string, { change: Change; positions: TargetPos[] }>();
    for (const c of this.changes.values()) {
      const totalSeal = c.effect === 'seal' ? queue[c.target.slot]?.seal : undefined;
      const key = [c.label, c.effect, c.target.side, c.a, c.h, totalSeal].join('|');
      const group = groups.get(key);
      if (group) group.positions.push(c.target);
      else groups.set(key, { change: c, positions: [c.target] });
    }
    for (const { change: c, positions } of groups.values()) {
      const nums = positions.map(pos => pos.slot + 1).sort((a, b) => a - b).join('、');
      const who = positions.length === 1 && c.target.side === 0 && c.target.slot === selected ? '自身'
        : (c.target.side ? '敌方' : '') + '第' + nums + '位';
      const total = queue[c.target.slot]?.seal ?? c.a;
      const seal = total === c.a ? '首击追加' + total + '伤害' : '首击附伤+' + c.a + '（共' + total + '）';
      const result: Record<Effect, string> = {
        stats: statsText(c.a, c.h), permanent: '永久' + statsText(c.a, c.h), block: '格挡+' + c.a,
        charge: '蓄能+' + c.a, mark: '猎标+' + c.a, seal,
        damage: '受到' + c.a + '伤害', blocked: '挡下' + c.a + '次攻击', heal: '回复' + c.a + '生命',
      };
      const penalty = !c.target.side && (c.a < 0 || c.h < 0);
      rows.add(c.priority, c.label, who + result[c.effect], penalty ? 'condition' : c.target.side ? 'attack' : 'benefit', penalty ? [] : positions);
    }
  }
}

function prepChanges(r: RunState, slot: number, fx: ShopFx[], changes: Changes) {
  const own = r.queue[slot]!;
  const queue = r.queue;
  for (const f of fx) {
    if (f.kind === 'buff' && (f.src === own.oid || f.tgt === own.oid)) {
      const to = queue.findIndex(o => o?.oid === f.tgt);
      if (to >= 0) changes.add(95, '回合末', friendly(to), f.tmp ? 'stats' : 'permanent', f.atk, f.hp);
    }
    if (f.kind !== 'bank' || f.resource !== 'seal') continue;
    const to = queue.findIndex(o => o?.oid === f.src);
    if (to < 0) continue;
    // bank.src 是领取者。用同名来源和目标筛出唯一发放者，避免把相邻另一份同名技能记到当前卡上。
    const sources = queue.flatMap((o, i) => {
      if (!o || f.label !== card(o.def).name + '·封印') return [];
      return card(o.def).rules?.some(rule => rule.phase === 'prep' && rule.on === 'turnEnd'
        && rule.effect === 'seal' && (rule.target === 'team' || rule.target === 'ahead'
          && queue.slice(0, i).filter(Boolean).at(-1)?.oid === f.src)) ? [i] : [];
    });
    if (to === slot || (sources.length === 1 && sources[0] === slot)) {
      changes.add(96, '回合末', friendly(to), 'seal', f.n);
    }
  }
}

function ruleSources(r: RunState, o: Owned) {
  const equipment = equipOf(o.ench);
  return [
    { name: card(o.def).name, level: lvlOf(o.copies), rules: card(o.def).rules ?? [] },
    { name: equipment?.name ?? '', level: 1, rules: equipment?.rules ?? [] },
    ...[...new Set(o.supportFoods)].map(id => ({ name: FOOD[id]?.name, level: 1, rules: FOOD[id]?.battleRules ?? [] })),
    ...r.relics.map(id => ({ name: RELIC[id]?.name, level: 1, rules: RELIC[id]?.battleRules ?? [] })),
  ].flatMap(origin => origin.rules.filter((rule): rule is BattleRule => rule.phase === 'battle')
    .map(rule => ({ name: origin.name, level: origin.level, rule })));
}

function project(r: RunState, slot: number, merged = false): FormationFeedback {
  const o = r.queue[slot];
  if (!o || r.phase !== 'prep' || r.endTurnCommitted) return empty();
  const rows = new Rows(), changes = new Changes();
  if (merged) rows.add(101, '合并', '第' + (slot + 1) + '位' + (lvlOf(o.copies) > 1 ? '升为金色' : '合为' + o.copies + '份'), 'benefit');
  if (r.rewards?.length || r.discover?.length) {
    rows.add(100, '等待选择', '领取奖励后更新摆阵预览', 'condition');
    return rows.result();
  }
  const slots = r.queue.flatMap((unit, i) => unit ? [i] : []);
  const index = slots.indexOf(slot), ahead = slots[index - 1], behind = slots[index + 1];
  const node = curNode(r);
  if (node && !isCombat(node.k)) return empty();
  const preparedSeal = o.seal ?? 0;
  const fx = endTurn(r);
  prepChanges(r, slot, fx, changes);
  if (preparedSeal > 0) rows.add(93, '已备封印', '首击追加' + preparedSeal + '伤害', 'benefit');
  if (o.startCharge) rows.add(92, '预装', '自身已有' + o.startCharge + '点蓄能', 'benefit');
  for (const rule of card(o.def).rules ?? []) {
    if (rule.phase !== 'prep' || rule.on !== 'turnEnd' || rule.effect !== 'seal') continue;
    if (rule.target === 'ahead' && ahead == null) rows.add(94, '回合末', '身前缺少接收封印的队友', 'condition');
    else if (rule.scale === 'trades' && !r.tc.bought && !r.tc.sold) rows.add(79, '回合末', '本回合尚未买卖单位，封印增加0', 'condition');
    else if (rule.scale === 'spells' && !r.tc.spells) rows.add(79, '回合末', '本回合尚未施法，封印增加0', 'condition');
    else if (rule.scale === 'meals' && !r.tc.foods) rows.add(79, '回合末', '本回合尚未喂食，封印增加0', 'condition');
  }
  const rules = ruleSources(r, o);
  const pending = r.discover?.length || r.rewards?.length || !r.enemy.units.length;
  if (pending) rows.add(100, '等待开战', r.enemy.units.length ? '回合末领取奖励后更新战斗预览' : '敌阵出现后更新战斗预览', 'condition');
  const prediction = pending ? undefined : readBattle(fight(r), slot, slots, o, rules, rows, changes);
  positionConditions(r, slot, slots, rules, rows, false, prediction);
  if (card(o.def).inherit) {
    const n = o.foodHistory?.length ?? 0;
    const receiver = behind ?? ahead;
    rows.add(78, '补给记录', n ? '已记录' + n + '份，' + (receiver == null ? '当前缺少接收队友' : '出售时传给第' + (receiver + 1) + '位') : '尚未记录吃过的补给', 'condition');
  }
  changes.append(rows, slot, r.queue);
  // 只有没有专属站位信息时才展示基础顺位。
  return finishRows(r, index, rows, prediction?.aim);
}

function finishRows(r: RunState, index: number, rows: Rows, aim: TargetPos[] = []): FormationFeedback {
  const result = rows.result();
  if (!result.lines.length) result.lines.push({ label: '顺位', text: index ? '身前有' + index + '名队友' : '队首接战', tone: 'condition' });
  for (const pos of aim) if (!result.damageTargets.some(p => same(pos, p))) result.damageTargets.push(pos);
  result.beneficiaryOids = result.beneficiaries.flatMap(p => r.queue[p.slot]?.oid ?? []);
  return result;
}


/** 演练只读队伍关系，战场、回合末结算和随机种子都不参与。 */
export function formationConditions(r: RunState, slot: number): FormationFeedback {
  if (!Number.isInteger(slot) || slot < 0 || slot >= QUEUE_MAX || !r.queue[slot] || r.phase !== 'prep') return empty();
  const slots = r.queue.flatMap((o, i) => o ? [i] : []);
  const rows = new Rows();
  positionConditions(r, slot, slots, ruleSources(r, r.queue[slot]!), rows, true);
  return finishRows(r, slots.indexOf(slot), rows);
}

function positionConditions(r: RunState, slot: number, slots: number[], rules: ReturnType<typeof ruleSources>, rows: Rows,
  rehearsal: boolean, prediction?: ReturnType<typeof readBattle>) {
  const o = r.queue[slot]!, index = slots.indexOf(slot), ahead = slots[index - 1], behind = slots[index + 1];
  const partner = [ahead, behind].find(i => i != null && r.queue[i]?.def === o.def);
  if (rules.some(s => s.rule.when === 'paired')) {
    if (partner == null) rows.add(97, '并肩', '相邻位置缺少同名搭档', 'condition');
    else if (rehearsal) rows.add(97, '并肩', '第' + (partner + 1) + '位是相邻同名搭档', 'condition',
      rules.some(s => s.rule.target === 'partner') ? [friendly(partner)] : []);
  }
  if (rehearsal && rules.some(s => s.rule.on === 'start' && s.rule.effect === 'summon')) {
    const free = QUEUE_MAX - slots.length;
    const coalesce = !free && slots.some(i => card(r.queue[i]!.def).rules?.some(rule => rule.effect === 'coalesce'));
    const firstToken = coalesce ? slots.find(i => card(r.queue[i]!.def).token) : undefined;
    if (firstToken != null) rows.add(96, '合巢', '当前满员，第' + (firstToken + 1) + '位小兵可接收召唤的攻血', 'condition', [friendly(firstToken)]);
    else rows.add(96, '开战召唤', free ? '当前有' + free + '个幼兽入场空位' : '当前满员，幼兽入场需要1个空位', 'condition');
  }
  for (const { rule, name, level } of rules) {
    if (rehearsal && (rule.effect === 'guard' || rule.effect === 'share')) {
      const protect = rule.effect === 'guard' ? (ahead == null ? [] : [slots[0]]) : [ahead, behind].filter(i => i != null);
      if (protect.length) rows.add(85, '护卫', '当前保护第' + protect.map(i => i + 1).join('、') + '位', 'condition', protect.map(friendly));
    }
    if (rehearsal && (rule.on === 'start' || rule.on === 'enter') && (rule.effect === 'block' || rule.effect === 'buff')
      && (rule.target === 'ahead' || rule.target === 'behind' || rule.target === 'neighbors')) {
      const targets = (rule.target === 'neighbors' ? [ahead, behind] : [rule.target === 'ahead' ? ahead : behind]).filter(i => i != null);
      const direction = rule.target === 'ahead' ? '身前' : rule.target === 'behind' ? '身后' : '相邻';
      const label = rule.on === 'enter' ? '登上队首时' : '开战时';
      rows.add(83, label, targets.length ? '当前' + direction + '第' + targets.map(i => i + 1).join('、') + '位可接收' + (rule.effect === 'block' ? '格挡' : '属性加成') : direction + '缺少接收队友',
        'condition', targets.map(friendly));
    }
    if (rule.effect === 'charge' && rule.when === 'rear') {
      const label = name === card(o.def).name ? '后排蓄能' : name || '后排蓄能';
      if (ahead == null) {
        rows.add(75, label, '当前在队首，退到后排后可积攒蓄能', 'condition');
      } else if (rule.target === 'behind' && behind == null) {
        rows.add(95, label, '身后缺少接收蓄能的队友', 'condition');
      } else {
        const who = rule.target === 'behind' ? '第' + (behind + 1) + '位' : '自身';
        const every = rule.every && rule.every > 1 ? '每' + rule.every + '次' : '每次';
        const recipientSlot = rule.target === 'behind' ? behind : slot;
        const receiver = rehearsal ? friendly(recipientSlot) : prediction?.confirmedRear.get((name ?? '') + ':' + recipientSlot);
        if ((r.queue[recipientSlot]?.startCharge ?? 0) >= CHARGE_MAX) {
          rows.add(83, label, who + '的预装蓄能已满', 'condition');
          continue;
        }
        rows.add(receiver ? 90 : 80, label, '保持后排时，' + every + '交锋后' + who + '蓄能+' + ruleNumber(rule.n, level)
          + (rule.limit ? '（至多' + rule.limit + '次）' : ''), 'condition', receiver ? [receiver] : []);
      }
    }
    if (rule.effect === 'inherit' && !prediction?.actualInherit.has(name ?? '')) {
      rows.add(74, '阵亡传承', behind == null ? '当前身后没有继承人' : '若站位保持，第' + (behind + 1) + '位继承' + ruleNumber(rule.n, level) + '%攻血', 'condition', rehearsal && behind != null ? [friendly(behind)] : []);
    }
  }
}

const ruleEvent: Partial<Record<string, Ev['t']>> = { 格挡: 'block', 鼓舞: 'buff', 薪火传承: 'buff', 猎标: 'counter', 蓄能: 'counter' };

function readBattle(out: BattleOut, slot: number, slots: number[], o: Owned, rules: ReturnType<typeof ruleSources>, rows: Rows, changes: Changes) {
  const confirmedRear = new Map<string, TargetPos>(), actualInherit = new Set<string>(), aim: TargetPos[] = [];
  const uid = out.initOrder[0][slots.indexOf(slot)];
  const positions = new Map<number, TargetPos>();
  const units = new Map<number, Snap>();
  for (const u of out.init) {
    const at = out.initOrder[u.side].indexOf(u.uid);
    positions.set(u.uid, { side: u.side, slot: u.side ? at : slots[at] });
    units.set(u.uid, { ...u });
  }
  let round = 0, allyFront = out.initOrder[0][0];
  let trigger: { uid: number; label: string } | undefined;
  let firstAim: { round: number; melee: boolean } | undefined;
  const native = card(o.def).name;
  // 开战后只取各效果首次实际出现的交锋，避免向玩家罗列整场结算。
  const first = new Map<string, number>();
  const keep = (key: string) => {
    if (!first.has(key)) first.set(key, round);
    return first.get(key) === round;
  };
  for (const e of out.events) {
    if (e.t === 'clash') { round = e.n; allyFront = e.a; trigger = undefined; continue; }
    if (e.t === 'trigger') {
      trigger = e;
      if (e.uid === uid && (e.label === '护卫分担' || e.label === '邻接分担') && keep('guard')) {
        const pos = positions.get(allyFront);
        const who = pos ? '第' + (pos.slot + 1) + '位' : '队首召唤物';
        rows.add(89, '第' + round + '次交锋', '替' + who + '分担伤害', 'benefit', pos ? [pos] : []);
      }
      continue;
    }
    // 格挡、属性和计数器事件紧跟自己的规则标签。跨过其他事件后再出现的无来源计数器可能来自阵亡转标。
    const expected = trigger && ruleEvent[trigger.label.split('·')[1]];
    if (expected && expected !== e.t) trigger = undefined;
    const phase = round ? '第' + round + '次交锋' : '开战';
    const origin = trigger?.uid === uid ? trigger.label : '';
    const source = origin.split('·')[0];
    const external = rules.some(s => s.name === source && s.name !== native);
    const label = external ? phase + '·' + source : phase;
    const priority = round ? 64 : 94;
    const allyLabel = (tgt: number, effect: BattleRule['effect']) =>
      source === native && units.get(tgt)?.def === o.def && tgt !== uid &&
      rules.some(s => s.name === native && s.rule.when === 'paired' && s.rule.effect === effect)
        ? phase + '·并肩' : label;
    if (e.t === 'summon') {
      units.set(e.unit.uid, { ...e.unit });
      if (e.src === uid && keep('summon')) {
        const at = e.order[e.unit.side].indexOf(e.unit.uid);
        const place = at === 0 ? '队首' : '战时第' + (at + 1) + '位';
        const name = e.unit.def === 't_wolf' ? '幼兽' : card(e.unit.def).name;
        rows.add(priority + 2, label, place + (e.revive ? '复生' : '召唤') + e.unit.atk + '/' + e.unit.hp + name, 'benefit');
      }
    }
    if (e.t === 'fizzle' && e.uid === uid && !round) {
      if (e.reason === 'full') {
        const unit = rules.some(s => s.rule.effect === 'summon') ? '幼兽' : '召唤物';
        rows.add(99, phase, '队伍满员，' + (e.ability === 'revive' ? '复生缺少空位' : unit + '无处入场'), 'condition');
      }
      if (e.reason === 'no_charge') rows.add(96, phase, '抵达队首时蓄能为0', 'condition');
      if (e.reason === 'no_target') {
        const rule = rules.find(s => s.name === e.source && s.rule.effect === e.ability)?.rule;
        const where = rule?.target === 'behind' ? '身后' : rule?.target === 'ahead' ? '身前' : '';
        rows.add(96, phase, where + '缺少技能目标', 'condition');
      }
    }
    if (e.t === 'counter') {
      const state = units.get(e.uid);
      if (!state) continue;
      const pos = positions.get(e.uid);
      const charge = e.charge - (state.charge ?? 0), mark = e.mark - (state.mark ?? 0);
      if (pos && origin.endsWith('·蓄能') && charge > 0 && keep(origin)) {
        const ownIndex = slots.indexOf(slot);
        const rear = ownIndex > 0 && rules.some(s => s.name === source && s.rule.when === 'rear' && s.rule.effect === 'charge'
          && (s.rule.target === 'behind' ? slots[ownIndex + 1] : slot) === pos.slot);
        if (rear) confirmedRear.set(source + ':' + pos.slot, pos);
        else changes.add(priority + (round ? 17 : 0), label, pos, 'charge', charge);
      }
      if (pos && origin.endsWith('·猎标') && mark > 0 && keep(origin)) changes.add(priority, label, pos, 'mark', mark);
      state.charge = e.charge; state.mark = e.mark;
    }
    // 施予者的 uid 可能代表它身上的装备、补给或全队遗物。仅用紧邻且匹配的规则事件署名。
    const received = (src: number, effect: string) => {
      const tagged = trigger?.uid === src && trigger.label.endsWith('·' + effect);
      return phase + '·' + (tagged ? trigger!.label.split('·')[0] : '受益');
    };
    if (e.t === 'buff') {
      const state = units.get(e.tgt);
      if (!state) continue;
      const a = e.nowAtk - state.atk, h = Math.min(STAT_CAP - state.maxHp, e.hp);
      state.atk = e.nowAtk; state.maxHp += h; state.hp = e.nowHp;
      const pos = positions.get(e.tgt);
      if (pos && e.tgt === uid && e.src !== uid && !round) changes.add(72, received(e.src, '鼓舞'), pos, 'stats', a, h);
      if (!pos && state.side === 0 && e.src === uid && (a || h) && keep('newBuff' + origin)) {
        rows.add(priority, label, '召唤的' + card(state.def).name + statsText(a, h), 'benefit');
      }
      if (!pos || pos.side || e.src !== uid) continue;
      const inherit = origin.endsWith('·薪火传承');
      if (inherit && (a || h)) actualInherit.add(source);
      if (keep('buff' + origin)) changes.add(inherit ? 90 : priority, inherit ? phase + '·阵亡传承' : allyLabel(e.tgt, 'buff'), pos, 'stats', a, h);
    }
    if (e.t === 'block' || e.t === 'heal' || e.t === 'dmg') {
      const pos = positions.get(e.tgt);
      const state = units.get(e.tgt);
      if (!state) continue;
      if (e.t === 'dmg' && e.src === uid && state.side === 1 && e.kind !== 'burn') {
        firstAim ??= { round, melee: e.kind === 'melee' };
        if (pos && firstAim.round === round && firstAim.melee === (e.kind === 'melee') && !aim.some(p => same(p, pos))) aim.push(pos);
      }
      const beforeHp = state.hp;
      if (e.t !== 'block') state.hp = e.hp;
      if (pos && e.t !== 'dmg' && e.src !== uid && e.tgt === uid && !round) changes.add(72, received(e.src, e.t === 'block' ? '格挡' : '治疗'), pos, e.t, e.n);
      if (!pos && state.side === 0 && e.src === uid && e.t === 'block' && keep('newBlock' + origin)) {
        rows.add(priority, label, '召唤的' + card(state.def).name + '格挡+' + e.n, 'benefit');
      }
      if (!pos || e.src !== uid) continue;
      if (e.t === 'dmg') {
        if (!pos.side || e.kind === 'burn' || e.kind === 'melee' || !keep('dmg' + origin)) continue;
        const loss = Math.max(0, beforeHp) - Math.max(0, e.hp);
        if (loss > 0 || e.blocked) changes.add(priority, label, pos, e.blocked ? 'blocked' : 'damage', e.blocked ? 1 : loss);
        else rows.add(priority, label, '敌方第' + (pos.slot + 1) + '位保住' + e.hp + '生命', 'attack', [pos]);
      } else if (!pos.side && keep(e.t + origin)) {
        changes.add(priority, e.t === 'block' ? allyLabel(e.tgt, 'block') : label, pos, e.t, e.t === 'heal' ? e.hp - beforeHp : e.n);
      }
    }
  }
  return { confirmedRear, actualInherit, aim };
}

export function formationFeedback(run: RunState, slot: number): FormationFeedback {
  if (!Number.isInteger(slot) || slot < 0 || slot >= QUEUE_MAX || !run.queue[slot]) return empty();
  return project(structuredClone(run), slot);
}

export function previewPlacement(run: RunState, from: number, to: number): FormationFeedback {
  if (run.phase !== 'prep' || run.endTurnCommitted || !Number.isInteger(from) || !Number.isInteger(to) || to < 0 || to >= QUEUE_MAX) return empty();
  const copy = structuredClone(run);
  const moved = moveOwned(copy, from, to);
  return moved ? project(copy, to, moved.merged) : empty();
}
