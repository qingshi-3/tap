import { card } from '../core/data';
import { endTurn, fight, type RunState } from '../core/run';
import { previewEndTurn, previewInheritance } from '../core/previews';
import { h } from '../qb/dom';
import { unitSvg } from '../qb/unitArt';
import { sfx } from '../qb/audio';
import { battleTimeline } from './battleTimeline';

export function inheritancePreview(r: RunState, slot: number) {
  const info = previewInheritance(r, slot);
  if (!info) return null;
  if (!info.receiver) return h('div', { class: 'inherit-preview' }, h('b', null, '出售后：没有传承接收者'));
  const effects = info.changes.filter((c) => c.after[0] !== c.before[0] || c.after[1] !== c.before[1]);
  return h('div', { class: 'inherit-preview' }, h('b', null, `出售传给 ${card(info.receiver.def).name}`),
    ...effects.map((c) => h('div', null, `${card(c.def).name}　${c.before.join('/')} → ${c.after.join('/')}`)),
    !effects.length ? h('p', null, '本次上场攻血不变（可能受装备或属性上限影响）') : null);
}

export function preparationPreview(r: RunState, close: () => void) {
  const el = h('div', { class: 'prep-preview-ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': '成长与开战预览' });
  const growth = previewEndTurn(r);
  let opening = false;
  const copy = structuredClone(r);
  endTurn(copy);
  const start = battleTimeline(fight(copy))[0];
  const paint = () => {
    const growthBtn = h('button', { class: `report-tab${opening ? '' : ' on'}`, onclick: () => { opening = false; sfx.click(); paint(); } }, '回合成长');
    const openingBtn = h('button', { class: `report-tab${opening ? ' on' : ''}`, onclick: () => { opening = true; sfx.click(); paint(); } }, '开战 / 先手顺序');
    const back = h('button', { class: 'btn primary', onclick: close }, '回去调整');
    const content = opening
      ? h('ol', { class: 'report-events' }, ...start.lines.map((line) => h('li', null, line)), !start.lines.length ? h('li', null, '没有额外开战效果') : null)
      : h('div', { class: 'growth-preview-list' }, ...growth.map((u) => h('div', { class: 'growth-preview-row' },
        h('span', { class: 'preview-art', html: unitSvg(u.def) }),
        h('div', null, h('b', null, `${u.slot + 1} · ${card(u.def).name}`),
          h('p', null, u.effects.filter((f) => f.kind === 'buff').map((f) => `${f.src ? card(r.queue.find((o) => o?.oid === f.src)!.def).name : f.label}`).filter((n, i, a) => a.indexOf(n) === i).join('、') || '本轮无属性增长'),
          u.copy ? h('p', null, `复制技能 → ${card(u.copy).name}`) : null,
          u.bank ? h('p', null, `蛋内成长 +${u.bank}/+${u.bank}`) : null),
        h('div', { class: 'preview-stat' }, `${u.before.join('/')} → ${u.after.join('/')}`, u.capped ? h('small', null, '有属性达到上限，继续成长可能溢出') : null))));
    el.replaceChildren(h('section', { class: 'prep-preview-panel' }, h('h2', null, '开战前看一眼'),
      h('div', { class: 'report-tabs' }, growthBtn, openingBtn),
      h('p', { class: 'preview-hint' }, opening ? '开战至首次交锋前：含双方开战及首次交锋前触发。继续购买、换位后会改变。' : '开战前从队首到队尾结算；以下已计入当前星级、装备与成长上限。'), content,
      h('div', { class: 'preview-actions' }, back)));
  };
  paint();
  return el;
}
