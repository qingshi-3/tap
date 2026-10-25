import { card } from '../core/data';
import { lvlOf, morphPool, playerTeam, type Owned } from '../core/run';
import { draftCard } from '../qb/card';
import { h } from '../qb/dom';
import { unitTip } from '../qb/tip';

type MorphUnit = { u: Owned; i: number };

/** 与图鉴相同：卡面只负责卡面，完整技能交给共用 unitTip。 */
function morphCard(u: Owned, defId: string, inspect: boolean, onClick: () => void) {
  const stats = playerTeam({ queue: [{ ...u, def: defId }] })[0];
  const level = lvlOf(u.copies);
  const button = h('button', {
    class: 'morph-card-button', type: 'button',
    'aria-label': inspect ? `查看${card(defId).name}技能，随机候选` : `选择${card(defId).name}，预览随机变形候选`,
    onclick: onClick,
  }, draftCard(defId, { level, displayStats: stats }));
  return h('div', { class: `morph-card-cell${inspect ? ' morph-candidate' : ''}`, role: 'listitem' },
    h('div', { class: 'morph-card-stars', 'aria-label': `${level}星` }, '★'.repeat(level)), button);
}

function showSkill(detail: HTMLElement, u: Owned, defId: string) {
  const stats = playerTeam({ queue: [{ ...u, def: defId }] })[0];
  detail.replaceChildren(h('h3', null, '技能详情'), unitTip(defId, lvlOf(u.copies), {
    ...stats, copies: u.copies, kws: card(defId).kws,
    tmpAtk: u.tmpAtk, tmpHp: u.tmpHp, foodHistory: u.foodHistory,
  }, false));
}

function panel(title: string, hint: string, cards: HTMLElement, detail: HTMLElement | null, actions: HTMLElement, note?: string) {
  return h('div', { class: `branch-card morph-panel${detail ? '' : ' morph-picker'}` },
    h('div', { class: 'morph-heading' }, h('h2', null, title), h('p', null, hint)),
    h('div', { class: 'morph-body' }, cards, detail),
    h('div', { class: 'morph-footer' }, note ? h('p', null, note) : null, actions));
}

/** 保持原选人操作：点友军卡直接进入候选预览。 */
export function morphUnitPicker(units: MorphUnit[], onPick: (slot: number) => void, onBack: () => void) {
  const cells = units.map((unit) => morphCard(unit.u, unit.u.def, false, () => onPick(unit.i)));
  const back = h('button', { class: 'btn ghost', type: 'button', onclick: onBack }, '返回');
  return panel('选一个友军', '点选友军，查看变形候选',
    h('div', { class: 'morph-candidates', role: 'list', 'aria-label': '可变形友军' }, ...cells), null,
    h('div', { class: 'preview-actions' }, back));
}

/** 浏览候选只展示技能，不决定结果；真正变形仍由 resolveEvent 随机抽取。 */
export function morphOutcomePreview(u: Owned, onBack: () => void, onConfirm: () => void) {
  const pool = morphPool(u);
  const detail = h('div', { class: 'morph-skill', role: 'region', 'aria-label': '随机候选技能详情' });
  const inspect = (index: number) => {
    showSkill(detail, u, pool[index].id);
  };
  const cells = pool.map((d, index) => morphCard(u, d.id, true, () => inspect(index)));
  if (pool.length) inspect(0);
  const cancel = h('button', { class: 'btn ghost', type: 'button', onclick: onBack }, '重新选人');
  const confirm = h('button', { class: 'btn primary', type: 'button' }, `变形「${card(u.def).name}」`);
  confirm.addEventListener('click', () => { confirm.disabled = true; onConfirm(); });
  const root = panel('可能变成', `以下 ${pool.length} 个候选随机其一 · 点卡牌仅查看技能`,
    h('div', { class: 'morph-candidates', role: 'list', 'aria-label': '随机变形候选' }, ...cells), detail,
    h('div', { class: 'preview-actions' }, cancel, confirm),
    '星级、累计成长和装备保留；基础属性随新单位变化');
  root.classList.add('morph-preview');
  return root;
}
