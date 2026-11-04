import { card } from '../core/data';
import type { RunState } from '../core/run';
import { previewInheritance } from '../core/previews';
import { h } from '../qb/dom';

export function inheritancePreview(r: RunState, slot: number) {
  const info = previewInheritance(r, slot);
  if (!info) return null;
  if (!info.receiver) return h('div', { class: 'inherit-preview' }, h('b', null, '出售后：没有传承接收者'));
  const effects = info.changes.filter((c) => c.after[0] !== c.before[0] || c.after[1] !== c.before[1]);
  return h('div', { class: 'inherit-preview' }, h('b', null, `出售传给 ${card(info.receiver.def).name}`),
    ...effects.map((c) => h('div', null, `${card(c.def).name}　${c.before.join('/')} → ${c.after.join('/')}`)),
    !effects.length ? h('p', null, '本次上场攻血不变（可能受装备或属性上限影响）') : null);
}
