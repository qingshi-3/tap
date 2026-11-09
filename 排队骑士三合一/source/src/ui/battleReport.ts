import type { BattleOut, Snap } from '../core/engine';
import type { DamageSourceKind, UnitBattleStats } from '../core/battleStats';
import { h } from '../qb/dom';
import { icon, type IconName } from '../qb/icons';
import { itemIcon } from '../qb/pixelItems';
import { unitSvg } from '../qb/unitArt';
import { sfx } from '../qb/audio';

const SOURCES: Record<DamageSourceKind, { icon: IconName; color: string }> = {
  attack: { icon: 'sword', color: '#e9bc67' }, skill: { icon: 'bolt', color: '#ba91ed' },
  equipment: { icon: 'diamond', color: '#6bc5df' }, supply: { icon: 'plate', color: '#8fc988' },
  relic: { icon: 'crown', color: '#ed915d' }, summon: { icon: 'sparkle', color: '#db7c97' },
};
type Metric = 'damageDealt' | 'damageTaken' | 'kills';
const METRICS: { key: Metric; name: string; icon: IconName; color: string }[] = [
  { key: 'damageDealt', name: '输出', icon: 'sword', color: '#e9bc67' },
  { key: 'damageTaken', name: '承伤', icon: 'shield', color: '#6bc5df' },
  { key: 'kills', name: '击杀', icon: 'skull', color: '#db7c97' },
];

/** 一次交锋里发生的事：开战前效果为第 0 段。连续同类同对象的数字合并成一枚筹码。 */
type Chip =
  | { k: 'dmg'; src: number | null; tgt: number; n: number; block: boolean; burn: boolean }
  | { k: 'heal'; src: number; tgt: number; n: number }
  | { k: 'buff'; src: number; tgt: number; atk: number; hp: number }
  | { k: 'block'; tgt: number; n: number }
  | { k: 'trig'; uid: number; label: string }
  | { k: 'die'; uid: number }
  | { k: 'summon'; src: number | null; uid: number; revive: boolean; atk: number; hp: number };
interface Moment { n: number; a: number | null; b: number | null; chips: Chip[]; dead: Set<number>; dealt: [number, number] }

function moments(out: BattleOut, states: Map<number, Snap>): Moment[] {
  const list: Moment[] = [{ n: 0, a: null, b: null, chips: [], dead: new Set(), dealt: [0, 0] }];
  let m = list[0];
  const push = (c: Chip) => {
    const last = m.chips[m.chips.length - 1];
    if (last && last.k === c.k && 'src' in last && 'src' in c && last.src === c.src && 'tgt' in last && 'tgt' in c && last.tgt === c.tgt) {
      if (c.k === 'dmg' && last.k === 'dmg' && last.burn === c.burn) { last.n += c.n; last.block = last.block && c.block; return; }
      if (c.k === 'heal' && last.k === 'heal') { last.n += c.n; return; }
      if (c.k === 'buff' && last.k === 'buff') { last.atk += c.atk; last.hp += c.hp; return; }
    }
    m.chips.push(c);
  };
  for (const e of out.events) {
    switch (e.t) {
      case 'clash': m = { n: e.n, a: e.a, b: e.b, chips: [], dead: new Set(), dealt: [0, 0] }; list.push(m); break;
      case 'trigger': push({ k: 'trig', uid: e.uid, label: e.label }); break;
      case 'dmg': {
        const s = states.get(e.tgt);
        const actual = s ? Math.max(0, s.hp - Math.max(0, e.hp)) + Math.max(0, s.shield - e.shield) : e.n;
        if (s) { s.hp = e.hp; s.shield = e.shield; s.block = e.block; m.dealt[s.side ? 0 : 1] += actual; }
        push({ k: 'dmg', src: e.src, tgt: e.tgt, n: actual, block: e.blocked && !actual, burn: e.kind === 'burn' });
        break;
      }
      case 'buff': {
        const s = states.get(e.tgt);
        const a = s ? e.nowAtk - s.atk : e.atk, hp = s ? e.nowHp - s.hp : e.hp;
        if (s) { s.atk = e.nowAtk; s.hp = e.nowHp; }
        if (a || hp) push({ k: 'buff', src: e.src, tgt: e.tgt, atk: a, hp });
        break;
      }
      case 'heal': if (states.has(e.tgt)) states.get(e.tgt)!.hp = e.hp; push({ k: 'heal', src: e.src, tgt: e.tgt, n: e.n }); break;
      case 'block': push({ k: 'block', tgt: e.tgt, n: e.n }); break;
      case 'stat': { const s = states.get(e.uid); if (s) { s.shield = e.shield; s.burn = e.burn; } break; }
      case 'die': m.dead.add(e.uid); push({ k: 'die', uid: e.uid }); break;
      case 'summon': states.set(e.unit.uid, { ...e.unit }); push({ k: 'summon', src: e.src, uid: e.unit.uid, revive: !!e.revive, atk: e.unit.atk, hp: e.unit.hp }); break;
      case 'fizzle': push({ k: 'trig', uid: e.uid, label: e.label }); break;
    }
  }
  return list[0].chips.length ? list : list.slice(1);
}

export function battleReport(out: BattleOut) {
  const el = h('section', { class: `battle-report br-${out.result}`, 'aria-label': '本场战报' });
  const states = new Map<number, Snap>(out.init.map((s) => [s.uid, { ...s }]));
  const timeline = moments(out, states);
  let metric: Metric = 'damageDealt', open: number | null = null, view: number | null = null;

  const face = (def: string | null, enemy: boolean, cls = '') => h('span', { class: `br-face ${enemy ? 'foe ' : ''}${cls}`, html: unitSvg(def, { enemy }) });
  const rowFace = (row: UnitBattleStats) => row.kind === 'relic'
    ? h('span', { class: `br-face relic${row.side ? ' foe' : ''}` }, itemIcon(`rl_${row.def.slice(2)}`, 'spell'))
    : face(row.def, !!row.side);
  const uidFace = (uid: number | null, cls = '') => {
    const s = uid == null ? null : states.get(uid);
    return s ? face(s.def, !!s.side, cls) : h('span', { class: `br-face fx ${cls}` }, icon('sparkle'));
  };
  const num = (n: number | string, cls = '') => h('b', { class: `br-num ${cls}` }, String(n));
  const rows = (side: 0 | 1) => out.stats.units.filter((u) => u.side === side);
  const best = (side: 0 | 1, key: Metric) => rows(side).reduce<UnitBattleStats | null>((b, r) => (r[key] > (b?.[key] ?? 0) ? r : b), null);

  // 顶部：胜负 + 勋章。每枚勋章 = 头像 + 光 + 数字，不配说明文字。
  const medal = (row: UnitBattleStats | null, key: Metric, ic: IconName, cls: string, label: string) => {
    if (!row) return null;
    return h('button', { class: `br-medal ${cls}`, type: 'button', 'aria-label': `${label}：${row.label} ${row[key]}`,
      onclick: () => { sfx.click(); metric = key; view = null; open = row.uid; paint(); } },
    h('span', { class: 'br-medal-glow' }), rowFace(row),
    h('span', { class: 'br-medal-tag' }, icon(ic), label), num(row[key]));
  };
  const clashCount = timeline.filter((t) => t.n > 0).length;
  const alive = out.survivors;
  const head = h('header', { class: 'br-head' },
    h('div', { class: 'br-result' },
      h('span', { class: 'br-result-glow' }),
      h('strong', null, out.result === 'win' ? '胜利' : out.result === 'lose' ? '失败' : '平局'),
      h('span', { class: 'br-result-meta' }, icon('sword'), num(clashCount), icon('heart'), num(alive))),
    h('div', { class: 'br-medals' },
      medal(best(0, 'damageDealt'), 'damageDealt', 'crown', 'mvp', 'MVP'),
      medal(best(0, 'damageTaken'), 'damageTaken', 'shield', 'tank', '铁壁'),
      medal(best(0, 'kills'), 'kills', 'skull', 'reap', '收割'),
      medal(best(1, 'damageDealt'), 'damageDealt', 'fire', 'threat', '威胁')));

  const stage = h('div', { class: 'br-stage' });
  const strip = h('nav', { class: 'br-strip', 'aria-label': '交锋时间线' });

  function chart() {
    const m = METRICS.find((x) => x.key === metric)!;
    const mine = rows(0).sort((a, b) => b[metric] - a[metric]), foe = rows(1).sort((a, b) => b[metric] - a[metric]);
    const max = Math.max(1, ...out.stats.units.map((r) => r[metric]));
    const sum = (rs: UnitBattleStats[]) => rs.reduce((n, r) => n + r[metric], 0);
    const [ta, tb] = [sum(mine), sum(foe)];
    const share = ta + tb ? ta / (ta + tb) : .5;
    const metricBtns = h('div', { class: 'br-metrics', role: 'tablist' }, ...METRICS.map((x) => h('button', {
      class: `br-metric${x.key === metric ? ' on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(x.key === metric), style: `--mc:${x.color}`,
      onclick: () => { sfx.click(); metric = x.key; open = null; paint(); },
    }, icon(x.icon), x.name)));
    const tug = h('div', { class: 'br-tug', style: `--mc:${m.color}` },
      num(ta, 'mine'),
      h('span', { class: 'br-tug-rail' }, h('i', { class: 'mine', style: `transform:scaleX(${share})` }), h('i', { class: 'foe', style: `transform:scaleX(${1 - share})` }),
        h('span', { class: 'br-tug-vs', style: `left:${share * 100}%` }, 'VS')),
      num(tb, 'foe'));
    const bar = (row: UnitBattleStats, i: number) => {
      const fill = h('span', { class: 'br-fill', style: `transform:scaleX(${row[metric] / max});animation-delay:${i * 60}ms` });
      if (metric === 'damageDealt' && row.damageDealt) {
        for (const [kind, info] of Object.entries(SOURCES)) {
          const v = row.damageBySource.filter((s) => s.kind === kind).reduce((n, s) => n + s.damage, 0);
          if (v) fill.append(h('i', { style: `flex:${v};--sc:${info.color}` }));
        }
      } else fill.append(h('i', { style: `flex:1;--sc:${m.color}` }));
      const isOpen = open === row.uid;
      const r = h('button', { class: `br-row${row.side ? ' foe' : ''}${isOpen ? ' open' : ''}${row[metric] ? '' : ' zero'}`, type: 'button',
        'aria-expanded': String(isOpen), 'aria-label': `${row.label} ${m.name} ${row[metric]}`,
        onclick: () => { sfx.click(); open = isOpen ? null : row.uid; paint(); } },
      rowFace(row), h('span', { class: 'br-rail' }, fill), num(row[metric]),
      row.lvl > 1 && row.kind === 'unit' ? h('span', { class: 'br-lv' }, '★'.repeat(row.lvl)) : null);
      return isOpen ? [r, detail(row)] : [r];
    };
    const col = (rs: UnitBattleStats[], side: 0 | 1) => h('div', { class: `br-col${side ? ' foe' : ''}` }, ...rs.flatMap(bar));
    stage.replaceChildren(h('div', { class: 'br-chart-top' }, metricBtns, tug),
      h('div', { class: 'br-chart' }, col(mine, 0), h('span', { class: 'br-axis' }), col(foe, 1)));
  }

  // 展开明细：只放 icon + 数字。
  function detail(row: UnitBattleStats) {
    const chips: HTMLElement[] = [];
    for (const [kind, info] of Object.entries(SOURCES)) {
      const v = row.damageBySource.filter((s) => s.kind === kind).reduce((n, s) => n + s.damage, 0);
      if (v) chips.push(h('span', { class: 'br-chip src', style: `--sc:${info.color}` }, icon(info.icon), num(v)));
    }
    const stat = (ic: IconName, v: number, color: string, label: string) => v ? h('span', { class: 'br-chip stat', style: `--sc:${color}`, title: label, 'aria-label': `${label} ${v}` }, icon(ic), num(v)) : null;
    return h('div', { class: `br-detail${row.side ? ' foe' : ''}` }, ...chips,
      stat('hit', row.hitsTaken, '#b4a9d7', '受击'), stat('guard', row.blockedHits, '#9fd4e8', '格挡'), stat('plate', row.shieldAbsorbed, '#6bc5df', '护盾吸收'),
      stat('sparkle', row.summons, '#db7c97', '召唤'), stat('tomb', row.revives, '#9fe2c6', '复生'), stat('fire', row.selfDamage + row.friendlyDamageTaken, '#ed915d', '自伤/友伤'));
  }

  // 单段交锋：漫画式动作流。
  function scene(m: Moment) {
    const flow = h('div', { class: 'br-flow' });
    m.chips.forEach((c, i) => {
      let node: HTMLElement;
      const actor = 'src' in c ? c.src : 'uid' in c ? c.uid : c.tgt;
      const side = actor == null ? '' : states.get(actor)?.side ? ' by-foe' : ' by-mine';
      const d = `animation-delay:${Math.min(i, 20) * 40}ms`;
      switch (c.k) {
        case 'dmg': node = h('span', { class: `br-act dmg${c.block ? ' blocked' : ''}`, style: d }, uidFace(c.src), icon(c.block ? 'guard' : c.burn ? 'fire' : 'hit', 'br-verb'), uidFace(c.tgt), c.block ? null : num(`-${c.n}`, 'neg')); break;
        case 'heal': node = h('span', { class: 'br-act heal', style: d }, uidFace(c.src), icon('heart', 'br-verb'), uidFace(c.tgt), num(`+${c.n}`, 'pos')); break;
        case 'buff': node = h('span', { class: 'br-act buff', style: d }, uidFace(c.src), icon('arrowUp', 'br-verb'), uidFace(c.tgt),
          num(`${c.atk >= 0 ? '+' : ''}${c.atk}/${c.hp >= 0 ? '+' : ''}${c.hp}`, c.atk < 0 || c.hp < 0 ? 'neg' : 'pos')); break;
        case 'block': node = h('span', { class: 'br-act block', style: d }, uidFace(c.tgt), icon('guard', 'br-verb'), num(`+${c.n}`, 'cool')); break;
        case 'trig': node = h('span', { class: 'br-act trig', style: d }, uidFace(c.uid), h('span', { class: 'br-word' }, c.label)); break;
        case 'die': node = h('span', { class: 'br-act die', style: d }, uidFace(c.uid, 'dead'), icon('x', 'br-xmark')); break;
        case 'summon': node = h('span', { class: `br-act summon`, style: d }, uidFace(c.src), icon(c.revive ? 'tomb' : 'sparkle', 'br-verb'), uidFace(c.uid),
          num(`${c.atk}/${c.hp}`, 'pos')); break;
      }
      node.className += side; flow.append(node);
    });
    if (!m.chips.length) flow.append(h('span', { class: 'br-empty' }, icon('flag')));
    const duel = m.a != null && m.b != null ? h('div', { class: 'br-duel' }, uidFace(m.a, m.dead.has(m.a) ? 'dead' : ''), h('span', { class: 'br-duel-n' }, String(m.n)), uidFace(m.b, m.dead.has(m.b) ? 'dead' : ''))
      : h('div', { class: 'br-duel pre' }, icon('flag'), h('span', { class: 'br-duel-n' }, '开战'));
    stage.replaceChildren(h('div', { class: 'br-scene' },
      h('div', { class: 'br-scene-side' }, duel,
        h('div', { class: 'br-scene-dealt' }, h('span', { class: 'mine' }, icon('sword'), num(m.dealt[0])), h('span', { class: 'foe' }, icon('sword'), num(m.dealt[1]))),
        h('button', { class: 'br-back', type: 'button', 'aria-label': '返回总览', onclick: () => { sfx.click(); view = null; paint(); } }, icon('x'))),
      flow));
  }

  function paintStrip() {
    const nodes = timeline.map((m, i) => {
      const on = view === i;
      const winner = m.dealt[0] > m.dealt[1] ? 'mine' : m.dealt[1] > m.dealt[0] ? 'foe' : 'even';
      const b = h('button', { class: `br-node ${winner}${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), 'aria-label': m.n ? `交锋 ${m.n}` : '开战效果',
        onclick: () => { sfx.click(); view = on ? null : i; paint(); } },
      h('span', { class: 'br-node-glow' }),
      m.a != null && m.b != null
        ? h('span', { class: 'br-node-pair' }, uidFace(m.a, m.dead.has(m.a) ? 'dead' : ''), uidFace(m.b, m.dead.has(m.b) ? 'dead' : ''))
        : h('span', { class: 'br-node-pair pre' }, icon('flag')),
      h('span', { class: 'br-node-n' }, m.n ? String(m.n) : '开战'));
      return b;
    });
    const all = h('button', { class: `br-node all${view == null ? ' on' : ''}`, type: 'button', 'aria-label': '总览', onclick: () => { sfx.click(); view = null; paint(); } },
      h('span', { class: 'br-node-glow' }), h('span', { class: 'br-node-pair pre' }, icon('crown')), h('span', { class: 'br-node-n' }, '总览'));
    strip.replaceChildren(all, h('span', { class: 'br-strip-line' }), h('div', { class: 'br-nodes' }, ...nodes));
    strip.querySelector('.br-node.on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  function paint() {
    if (view == null) chart(); else scene(timeline[view]);
    paintStrip();
  }
  el.append(head, stage, strip);
  paint();
  return el;
}
