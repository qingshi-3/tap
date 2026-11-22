import type { BattleOut } from '../core/engine';
import { card } from '../core/data';
import type { DamageSourceKind, UnitBattleStats } from '../core/battleStats';
import { h } from '../qb/dom';
import { itemIcon } from '../qb/pixelItems';
import { unitSvg } from '../qb/unitArt';
import { sfx } from '../qb/audio';
import { battleMoments, groupMomentActions, type MomentAction } from './battleTimeline';
import './battleReport.css';

const SOURCES: Record<DamageSourceKind, { name: string; color: string }> = {
  attack: { name: '交锋', color: '#e9bc67' }, skill: { name: '技能', color: '#ba91ed' }, equipment: { name: '装备', color: '#6bc5df' },
  supply: { name: '补给', color: '#8fc988' }, relic: { name: '遗物', color: '#ed915d' }, summon: { name: '召唤', color: '#db7c97' },
};
type Metric = 'damageDealt' | 'damageTaken' | 'kills';
const METRICS: { key: Metric; name: string }[] = [{ key: 'damageDealt', name: '输出' }, { key: 'damageTaken', name: '承伤' }, { key: 'kills', name: '击杀' }];

export function battleReport(out: BattleOut) {
  const el = h('section', { class: 'battle-report br7', 'aria-label': '本场战报' });
  const { moments, units } = battleMoments(out);
  let metric: Metric = 'damageDealt', selected: number | null = null, page = -1, selectedAction = 0, resetActionScroll = false;
  const portrait = (uid: number | null, dead = false) => {
    const u = uid === null ? undefined : units.get(uid);
    return h('span', { class: `br7-portrait${dead ? ' dead' : ''}`, title: u ? card(u.def)?.name ?? u.def : '场上效果' },
      u ? h('span', { html: unitSvg(u.def) }) : '⚑', dead ? h('i', { 'aria-label': '阵亡' }, '亡') : null);
  };
  const unitName = (uid: number | null) => {
    const u = uid === null ? undefined : units.get(uid);
    return u ? card(u.def)?.name ?? u.def : '场上效果';
  };
  const person = (uid: number | null, dead = false) => {
    const side = uid === null ? null : units.get(uid)?.side;
    return h('span', { class: `br7-person ${side === 0 ? 'ally' : side === 1 ? 'enemy' : ''}` },
      portrait(uid, dead), h('span', { class: 'br7-person-name' }, unitName(uid)));
  };
  const rowPortrait = (row: UnitBattleStats) => row.kind === 'relic' ? h('span', { class: 'br7-portrait' }, itemIcon(`rl_${row.def.slice(2)}`, 'spell')) : portrait(row.uid);
  const choose = (fn: () => void) => () => { sfx.click(); fn(); paint(); };
  const best = (side: 0 | 1, key: Metric) => out.stats.units.filter((r) => r.side === side).reduce<UnitBattleStats | null>((a, b) => !a || b[key] > a[key] ? b : a, null);
  const medals: { title: string; side: 0 | 1; key: Metric; symbol: string }[] = [
    { title: 'MVP', side: 0, key: 'damageDealt', symbol: '★' }, { title: '铁壁', side: 0, key: 'damageTaken', symbol: '◆' },
    { title: '收割', side: 0, key: 'kills', symbol: '⚔' }, { title: '威胁', side: 1, key: 'damageDealt', symbol: '✦' },
  ];
  function paint() {
    const oldScroll = el.querySelector<HTMLElement>('.br7-timeline')?.scrollLeft ?? 0;
    const actionScroll = resetActionScroll ? 0 : el.querySelector<HTMLElement>('.br7-actions')?.scrollTop ?? 0;
    const detailScroll = resetActionScroll ? 0 : el.querySelector<HTMLElement>('.br7-event-detail')?.scrollTop ?? 0;
    resetActionScroll = false;
    const top = h('header', { class: 'br7-top' }, h('strong', { class: `br7-result ${out.result}` }, out.result === 'win' ? '胜利' : out.result === 'lose' ? '失败' : '平局', h('small', null, '交锋 ' + (moments.length - 1) + ' · 存活 ' + out.survivors)),
      h('div', { class: 'br7-medals' }, medals.map((m) => {
        const row = best(m.side, m.key);
        return h('button', { type: 'button', class: `br7-medal ${m.side ? 'enemy' : ''}`, disabled: !row, onclick: choose(() => { metric = m.key; selected = row?.uid ?? null; page = -1; }), 'aria-label': `${m.title} ${row?.label ?? '无'} ${row?.[m.key] ?? 0}` },
          h('span', { class: 'br7-medal-symbol' }, m.symbol), row ? rowPortrait(row) : h('span', { class: 'br7-portrait' }, '—'), h('span', { class: 'br7-medal-text' }, h('b', null, m.title), h('span', null, row?.label ?? '无'), h('strong', null, row?.[m.key] ?? 0)));
      })));
    const middle = h('div', { class: 'br7-middle' });
    if (page < 0) {
      const sides = [0, 1].map((side) => out.stats.units.filter((r) => r.side === side));
      const totals = sides.map((rows) => rows.reduce((sum, r) => sum + r[metric], 0));
      const total = totals[0] + totals[1];
      const max = Math.max(1, ...out.stats.units.map((r) => r[metric]));
      const tabs = h('div', { class: 'br7-tabs' }, METRICS.map((m) => h('button', { type: 'button', class: metric === m.key ? 'active' : '', 'aria-pressed': String(metric === m.key), onclick: choose(() => { metric = m.key; }) }, m.name)));
      const split = total ? totals[0] / total * 100 : 50;
      const tug = h('div', { class: 'br7-tug' }, h('b', null, totals[0]), h('div', { class: 'br7-tug-track' }, h('span', { class: 'br7-tug-ally', style: `width:${split}%` }), h('span', { class: 'br7-tug-enemy', style: `width:${100 - split}%` }), h('i', { style: `left:${split}%` }, 'VS')), h('b', null, totals[1]));
      const columns = h('div', { class: 'br7-columns' }, sides.map((rows, side) => h('div', { class: `br7-side ${side ? 'enemy' : 'ally'}` }, rows.map((row) => {
        const rail = h('span', { class: 'br7-rail' });
        if (metric === 'damageDealt') Object.entries(SOURCES).forEach(([kind, info]) => {
          const n = row.damageBySource.filter((s) => s.kind === kind).reduce((sum, s) => sum + s.damage, 0);
          if (n) rail.append(h('i', { style: `width:${n / max * 100}%;background:${info.color}` }));
        });
        else if (row[metric]) rail.append(h('i', { style: `width:${row[metric] / max * 100}%` }));
        return h('button', { type: 'button', class: `br7-row${selected === row.uid ? ' selected' : ''}`, 'aria-pressed': String(selected === row.uid), onclick: choose(() => { selected = selected === row.uid ? null : row.uid; }) },
          rowPortrait(row), h('span', { class: 'br7-row-name' }, row.label), rail, h('strong', null, row[metric]));
      }))));
      const row = out.stats.units.find((r) => r.uid === selected);
      const detail = row ? h('div', { class: 'br7-detail' }, h('b', null, row.label),
        h('span', null, `⚔ ${row.damageDealt}`), h('span', null, `◆ ${row.damageTaken}`), h('span', null, `✕ ${row.kills}`), h('span', null, `受击 ${row.hitsTaken}`), h('span', null, `格挡 ${row.blockedHits}`), h('span', null, `护盾 ${row.shieldAbsorbed}`), h('span', null, `自伤 ${row.selfDamage}`), h('span', null, `友伤 ${row.friendlyDamageTaken}`), h('span', null, `召唤 ${row.summons}`), h('span', null, `复生 ${row.revives}`),
        ...row.damageBySource.map((s) => h('span', null, h('i', { style: `background:${SOURCES[s.kind].color}` }), `${s.label} ${s.damage}`))) : null;
      middle.append(tabs, tug, columns, ...(detail ? [detail] : []));
    } else {
      const moment = moments[page];
      const fighters = h('div', { class: 'br7-fighters' }, h('b', null, moment.title),
        moment.a === null
          ? h('div', { class: 'br7-duel' }, h('span', { class: 'br7-flag', 'aria-hidden': 'true' }, '⚑'))
          : h('div', { class: 'br7-duel' }, person(moment.a, moment.dead.has(moment.a)), h('span', { class: 'br7-versus' }, '⚔'), person(moment.b, moment.b !== null && moment.dead.has(moment.b))),
        h('div', { class: 'br7-duel-damage' }, h('strong', null, moment.damage[0]), h('span', null, '伤害'), h('strong', null, moment.damage[1])));
      const actionVerb: Record<MomentAction['kind'], string> = { damage: '伤害', heal: '治疗', block: '格挡', die: '阵亡', summon: '召唤', revive: '复生', trigger: '触发', fizzle: '未生效', buff: '增益', stat: '状态', kw: '获得' };
      const verb = (a: MomentAction) => a.kind === 'damage' && a.damageKind === 'melee' ? '交锋' : a.kind === 'damage' && a.damageKind === 'burn' ? '灼烧' : actionVerb[a.kind];
      const value = (a: MomentAction) => a.label ?? (a.value === undefined || a.kind === 'die' ? '' : a.kind === 'heal' ? `+${a.value}` : a.kind === 'damage' ? `-${a.value}` : a.kind === 'block' ? (a.value ? `+${a.value}` : '') : String(a.value));
      const groups = groupMomentActions(moment.actions);
      const current = groups[Math.min(selectedAction, groups.length - 1)];
      const actions = h('div', { class: 'br7-actions', 'aria-label': `${moment.title}行动` }, groups.length ? groups.map((group, i) => {
        const first = group[0];
        const summary = first.kind === 'trigger' || first.kind === 'fizzle' ? value(first) : first.kind === 'buff' ? value(first) : first.kind === 'stat' || first.kind === 'summon' || first.kind === 'revive' ? verb(first) : `${verb(first)} ${value(first)}`;
        return h('button', { type: 'button', class: `br7-event ${first.side === 0 ? 'ally' : first.side === 1 ? 'enemy' : ''}${i === selectedAction ? ' selected' : ''}`, 'aria-pressed': String(i === selectedAction), 'aria-label': `${i + 1} ${unitName(first.kind === 'stat' ? first.tgt : first.src)} ${verb(first)} ${first.tgt !== null && first.tgt !== first.src ? unitName(first.tgt) : ''} ${value(first)}${group.length > 1 ? `，随后 ${group.length - 1} 条记录` : ''}`,
          onclick: () => { sfx.click(); selectedAction = i; paint(); el.querySelectorAll<HTMLButtonElement>('.br7-event')[i]?.focus(); } },
          portrait(first.kind === 'stat' ? first.tgt : first.src, first.kind === 'die'),
          h('span', { class: 'br7-event-copy' }, summary));
      }) : h('div', { class: 'br7-empty' }, '没有额外效果'));
      const detail = current ? h('div', { class: 'br7-event-detail', 'aria-label': '选中行动的记录' }, current.map((a, i) => {
        const target = a.tgt !== null && a.tgt !== a.src;
        return h('div', { class: `br7-event-line ${a.kind}` },
          current.length > 1 ? h('span', { class: 'br7-event-step' }, i + 1) : null,
          person(a.src, a.kind === 'die'), h('span', { class: 'br7-action-verb' }, verb(a), target ? ' →' : ''),
          target || value(a) ? h('span', { class: 'br7-event-outcome' }, target ? person(a.tgt) : null, value(a) ? h('strong', { class: 'br7-action-value' }, value(a)) : null) : null);
      })) : null;
      const close = h('button', { type: 'button', class: 'br7-return', 'aria-label': '返回总览', onclick: choose(() => { page = -1; }) }, '×');
      middle.append(fighters, h('div', { class: 'br7-action-panel' }, close, actions, detail));
    }
    const timeline = h('nav', { class: 'br7-timeline', 'aria-label': '战斗时间线' },
      h('button', { type: 'button', class: `br7-node overview${page < 0 ? ' active' : ''}`, 'aria-pressed': String(page < 0), onclick: choose(() => { page = -1; }) }, h('span', null, '总览')),
      moments.map((m, i) => h('button', { type: 'button', class: `br7-node ${page === i ? 'active' : ''} ${m.damage[0] > m.damage[1] ? 'ally' : m.damage[1] > m.damage[0] ? 'enemy' : ''}`, 'aria-pressed': String(page === i), onclick: choose(() => { resetActionScroll = page !== i; page = i; selectedAction = 0; }) },
        h('span', { class: 'br7-node-portraits' }, m.a === null ? h('span', { class: 'br7-flag' }, '⚑') : [portrait(m.a, m.dead.has(m.a)), portrait(m.b, m.b !== null && m.dead.has(m.b))]), h('span', null, m.title))));
    el.replaceChildren(top, middle, timeline);
    timeline.scrollLeft = oldScroll;
    const actionList = el.querySelector<HTMLElement>('.br7-actions');
    if (actionList) actionList.scrollTop = actionScroll;
    const actionDetail = el.querySelector<HTMLElement>('.br7-event-detail');
    if (actionDetail) actionDetail.scrollTop = detailScroll;
  }
  paint();
  return el;
}
