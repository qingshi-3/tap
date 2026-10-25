import type { BattleOut } from '../core/engine';
import type { DamageSourceKind, UnitBattleStats } from '../core/battleStats';
import { h } from '../qb/dom';
import { icon } from '../qb/icons';
import { itemIcon } from '../qb/pixelItems';
import { unitSvg } from '../qb/unitArt';
import { sfx } from '../qb/audio';
import { battleTimeline } from './battleTimeline';

const SOURCES: Record<DamageSourceKind, { name: string; color: string }> = {
  attack: { name: '交锋', color: '#e9bc67' }, skill: { name: '技能', color: '#ba91ed' },
  equipment: { name: '装备', color: '#6bc5df' }, supply: { name: '补给', color: '#8fc988' },
  relic: { name: '遗物', color: '#ed915d' }, summon: { name: '召唤', color: '#db7c97' },
};
type Metric = 'damageDealt' | 'damageTaken' | 'kills' | 'hitsTaken';
const METRICS: { key: Metric; name: string; color: string }[] = [
  { key: 'damageDealt', name: '输出', color: '#e9bc67' }, { key: 'damageTaken', name: '承伤', color: '#6bc5df' },
  { key: 'kills', name: '击杀', color: '#db7c97' }, { key: 'hitsTaken', name: '受击次数', color: '#b4a9d7' },
];

export function battleReport(out: BattleOut) {
  const el = h('section', { class: 'battle-report', 'aria-label': '本场战报' });
  let side: 0 | 1 = 0, metric: Metric = 'damageDealt', selected: number | null = null;
  let mode: 'stats' | 'events' | 'rules' = 'stats', page = 0;
  const timeline = battleTimeline(out);
  const button = (text: string, on: boolean, action: () => void) => h('button', {
    class: `report-tab${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on),
    onclick: () => { sfx.click(); action(); paint(); },
  }, text);
  const detail = (row: UnitBattleStats) => h('aside', { class: 'report-detail', 'aria-label': `${row.label}来源明细` },
    h('h3', null, row.label),
    h('div', { class: 'report-detail-total' }, '有效输出 ', h('b', null, row.damageDealt)),
    h('div', { class: 'report-source-list' }, row.damageBySource.length ? row.damageBySource.map((s) => h('div', { class: 'report-source' },
      h('i', { style: `--source-color:${SOURCES[s.kind].color}` }), h('span', null, s.label), h('b', null, s.damage))) : h('p', null, '本场没有造成有效伤害')),
    h('p', { class: 'report-detail-note' }, `承伤 ${row.damageTaken} · 受击 ${row.hitsTaken} 次`, h('br'), `格挡 ${row.blockedHits} 次 · 护盾吸收 ${row.shieldAbsorbed}`,
      h('br'), `自伤 ${row.selfDamage} · 友伤 ${row.friendlyDamageTaken}`),
    row.summons || row.revives ? h('p', { class: 'report-detail-note' }, `含 ${row.summons} 次召唤、${row.revives} 次复生的累计表现`) : null);
  function paint() {
    const rows = out.stats.units.filter((u) => u.side === side);
    if (!rows.some((r) => r.uid === selected)) selected = rows[0]?.uid ?? null;
    const controls = h('div', { class: 'report-controls' },
      h('div', { class: 'report-tabs' }, button('我方', side === 0, () => { side = 0; mode = 'stats'; }), button('敌方', side === 1, () => { side = 1; mode = 'stats'; })),
      h('div', { class: 'report-tabs' }, ...METRICS.map((m) => button(m.name, mode === 'stats' && metric === m.key, () => { metric = m.key; mode = 'stats'; }))),
      h('div', { class: 'report-tabs' }, button('事件', mode === 'events', () => { mode = 'events'; }), button('口径', mode === 'rules', () => { mode = 'rules'; })));
    el.replaceChildren(controls);
    if (mode === 'rules') {
      el.append(h('div', { class: 'report-rules' }, h('h3', null, '本场统计口径'),
        h('p', null, '输出 / 承伤：敌我之间实际扣除的生命 + 护盾吸收；不计过量伤害和格挡免除。'),
        h('p', null, '受击：敌方每次命中，含格挡、护盾与每次灼烧跳伤。自伤、友伤单独记录。'),
        h('p', null, '击杀：实际致死才记一次；不屈保命不算击杀，复生后再次阵亡可再记一次。'),
        h('p', null, '召唤物与复生并入原单位，独立遗物伤害单列。分色表示直接伤害来源，增攻与伤害倍率保留在对应攻击中，不反推辅助贡献。'),
        h('p', null, '回放、跳过与切换页面都查看同一场结果，不重复累计。')));
      return;
    }
    if (mode === 'events') {
      const entry = timeline[page];
      const prev = button('上一段', false, () => { page = Math.max(0, page - 1); }); prev.disabled = page === 0;
      const next = button('下一段', false, () => { page = Math.min(timeline.length - 1, page + 1); }); next.disabled = page === timeline.length - 1;
      el.append(h('div', { class: 'report-event-head' }, prev, h('b', null, `${entry.title} · ${page + 1}/${timeline.length}`), next),
        h('ol', { class: 'report-events', 'aria-label': entry.title }, entry.lines.length ? entry.lines.map((line) => h('li', null, line)) : h('li', null, '没有额外开战效果')));
      return;
    }
    const activeMetric = METRICS.find((m) => m.key === metric)!;
    const max = Math.max(1, ...rows.map((r) => r[metric]));
    const total = rows.reduce((sum, r) => sum + r[metric], 0);
    const legend = h('div', { class: 'report-legend' },
      metric === 'damageDealt' ? Object.values(SOURCES).map((s) => h('span', null, h('i', { style: `--source-color:${s.color}` }), s.name)) : h('span', null, `${activeMetric.name} · 点击单位查看明细`),
      h('b', { class: 'report-team-total' }, `合计 ${total}`));
    const list = h('div', { class: 'report-rows', 'aria-label': `${side ? '敌方' : '我方'}${activeMetric.name}` });
    for (const row of rows) {
      const value = row[metric];
      const rail = h('span', { class: 'report-rail', 'aria-hidden': 'true' });
      if (metric === 'damageDealt') {
        for (const [kind, info] of Object.entries(SOURCES)) {
          const sum = row.damageBySource.filter((s) => s.kind === kind).reduce((n, s) => n + s.damage, 0);
          if (sum) rail.append(h('i', { class: 'report-segment', style: `width:${sum / max * 100}%;--source-color:${info.color}`, title: `${info.name} ${sum}` }));
        }
      } else if (value) rail.append(h('i', { class: 'report-segment', style: `width:${value / max * 100}%;--source-color:${activeMetric.color}` }));
      const b = h('button', { class: `report-row${row.uid === selected ? ' selected' : ''}`, type: 'button', 'aria-pressed': String(row.uid === selected),
        'aria-label': `${row.label}，输出${row.damageDealt}，承伤${row.damageTaken}，击杀${row.kills}，受击${row.hitsTaken}次`,
        onclick: () => { selected = row.uid; sfx.click(); paint(); },
      },
      h('span', { class: 'report-portrait' }, row.kind === 'relic' ? itemIcon(`rl_${row.def.slice(2)}`, 'spell') : h('span', { html: unitSvg(row.def, { enemy: !!side }) })),
      h('span', { class: 'report-unit' }, h('b', null, row.label), h('small', null, row.kind === 'relic' ? '独立遗物' : '★'.repeat(row.lvl))),
      h('span', { class: 'report-bar-cell' }, h('span', { class: 'report-value' }, `${activeMetric.name} `, h('b', null, value)), rail,
        h('span', { class: 'report-row-meta' }, `承伤 ${row.damageTaken}　击杀 ${row.kills}　受击 ${row.hitsTaken}`)));
      list.append(b);
    }
    const chosen = rows.find((r) => r.uid === selected);
    el.append(legend, h('div', { class: 'report-body' }, list, chosen ? detail(chosen) : h('p', null, icon('flag'), '本场无单位')));
  }
  paint();
  return el;
}
