import { FACTION_INFO, GENERAL_MAP, RARITY_NAMES, unitDef } from '../core/data';
import { levelStats } from '../core/engine';
import { describe } from '../core/run';
import type { UnitState } from '../core/types';
import { h, STAGE_W } from './dom';
import { icon } from './icons';
import { kwInline, kwRich, kwUpgrade } from './kwtext';

// 单例悬浮说明框：单位 / 将军 / 关键词

let tipEl: HTMLElement | null = null;
let root: HTMLElement | null = null;

export function initTip(stage: HTMLElement) {
  root = stage;
  tipEl = h('div', { class: 'tip' });
  stage.appendChild(tipEl);
  document.addEventListener('pointerdown', (event) => {
    if (tipEl && !tipEl.contains(event.target as Node)) hideTip();
  }, { capture: true });
  window.addEventListener('resize', hideTip);
}

type TipStats = Pick<UnitState, 'atk' | 'hp' | 'block' | 'chill' | 'burn'> & { armor?: number };

/** withUp：附带升一星的变化（只改数字时并进同一句写成「2→3」，多了效果才另起一行） */
export function unitTip(defId: string, level: number, st?: TipStats | null, withUp = true) {
  const d = unitDef(defId);
  const f = FACTION_INFO[d.faction];
  const base = levelStats(defId, level);
  const atk = st ? st.atk : base.atk;
  const hp = st ? st.hp : base.hp;
  const ability = describe(defId, level);
  const upText = withUp && !d.enemyOnly && !d.token && level < 3 ? describe(defId, level + 1) : '';
  const next = upText ? levelStats(defId, level + 1) : null;
  // 升星只做一行弱提示：属性增量 + 技能里变化的部分，不抢当前状态的视觉
  let upDiff = '';
  if (upText && upText !== ability) {
    const ca = ability.split(/(?<=[；;。])/), cb = upText.split(/(?<=[；;。])/);
    upDiff = ca.length === cb.length
      ? cb.map((c, i) => (c === ca[i] ? '' : kwUpgrade(ca[i], c) ?? c)).join('')
      : upText.startsWith(ability) ? upText.slice(ability.length).replace(/^[；;，,\s]+/, '') : upText;
  }
  const dAtk = next ? next.atk - base.atk : 0;
  const dHp = next ? next.hp - base.hp : 0;
  const nextRow = upText && (dAtk || dHp || upDiff)
    ? h('div', { class: 'tip-next' },
      h('span', { class: 'tn-star' }, '★'.repeat(level + 1)),
      dAtk || dHp ? h('span', { class: 'tn-st' }, `+${dAtk}/+${dHp}`) : null,
      upDiff ? h('span', { class: 'tn-ab' }, ...kwInline(upDiff)) : null)
    : null;
  return h(
    'div',
    { class: 'tip-unit', style: `--fc:${f.color}` },
    h(
      'div',
      { class: 'tip-head' },
      h('div', { class: 'tip-name' }, d.name),
      d.token ? h('span', { class: 'tip-fac' }, '召唤物') : h('span', { class: 'tip-fac' }, f.name),
      !d.enemyOnly && !d.token ? h('span', { class: 'tip-lv' }, h('span', { class: `tip-rarity rarity-${d.tier}` }, RARITY_NAMES[d.tier]), ' ', h('span', { class: 'tip-stars' }, '★'.repeat(level))) : null,
    ),
    h(
      'div',
      { class: 'tip-stats' },
      h('span', { class: 'ts atk' }, icon('sword'), atk),
      h('span', { class: 'ts hp' }, icon('heart'), hp),
      st && st.block ? h('span', { class: 'ts sh' }, icon('shield'), `格挡 ${st.block}`) : null,
      st && st.armor ? h('span', { class: 'ts ar' }, icon('plate'), `护甲 ${st.armor}`) : null,
      st && st.chill ? h('span', { class: 'ts fr' }, icon('snow'), `寒意 ${st.chill}${st.chill >= st.atk ? '（将被冻结）' : ''}`) : null,
      st && st.burn ? h('span', { class: 'ts bn' }, icon('fire'), `灼烧 ${st.burn}`) : null,
    ),
    h('div', { class: 'tip-text' }, ...kwRich(ability)),
    nextRow,
  );
}

export function generalTip(id: string) {
  const g = GENERAL_MAP[id];
  const f = FACTION_INFO[g.faction];
  return h(
    'div',
    { class: 'tip-unit', style: `--fc:${f.color}` },
    h('div', { class: 'tip-head' }, h('div', { class: 'tip-name' }, g.name), h('span', { class: 'tip-fac' }, g.title)),
    h('div', { class: 'tip-text' }, ...kwRich(g.text)),
  );
}

/** 在舞台坐标 (x, y) 附近显示说明：先量内容高度，上下放得下的一侧优先；都放不下就放到目标左右 */
/** top：目标上沿（默认同 y），放上方时以它为准，免得盖住目标本身 */
export function showTip(content: HTMLElement, x: number, y: number, prefer: 'above' | 'below' = 'above', top0 = y) {
  if (!tipEl || !root) return;
  tipEl.replaceChildren(content);
  tipEl.classList.add('on');
  root.appendChild(tipEl);
  const w = 440, pad = 12, gap = 8;
  tipEl.style.width = `${w}px`;
  tipEl.style.left = `${Math.max(pad, Math.min(STAGE_W - w - pad, x - w / 2))}px`;
  tipEl.style.bottom = '';
  tipEl.style.maxHeight = 'none';
  const need = tipEl.offsetHeight;
  const room = { above: top0 - gap - pad, below: 720 - y - gap - pad };
  const other = prefer === 'above' ? 'below' : 'above';
  const side = need <= room[prefer] ? prefer : need <= room[other] ? other : null;
  let top: number, max: number;
  if (side) {
    max = need;
    top = side === 'above' ? top0 - gap - need : y + gap;
  } else {
    // 上下都放不下：挪到目标左右两侧，按整屏高度放，不盖住目标
    const off = 64;
    tipEl.style.left = `${Math.max(pad, Math.min(STAGE_W - w - pad, x < STAGE_W / 2 ? x + off : x - off - w))}px`;
    max = Math.min(need, 720 - pad * 2);
    top = (top0 + y) / 2 - max / 2;
  }
  tipEl.style.maxHeight = `${max}px`;
  // 实在太长时可以滑动查看，所以要能接收触摸
  tipEl.classList.toggle('interactive', need > max || content.classList.contains('selected-tip') || !!content.querySelector('button'));
  tipEl.style.top = `${Math.max(pad, Math.min(720 - max - pad, top))}px`;
}

export function hideTip() {
  tipEl?.classList.remove('on');
  root?.querySelectorAll('.unit.inspected').forEach((unit) => unit.classList.remove('inspected'));
}

/** A selected tooltip may live in document.body on touch screens. */
export function isTipTarget(target: EventTarget | null) {
  return target instanceof Node && !!tipEl?.contains(target);
}
