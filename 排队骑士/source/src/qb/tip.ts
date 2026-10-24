import { cardText, tierBadge } from './card';
import { card, ENCH_INFO, FOOD, KW_INFO, type Ench } from '../core/data';
import { FACTION_INFO, unitDef } from './shim';
import { h, STAGE_H, STAGE_W } from './dom';
import { kwInline, kwRich, kwUpgrade } from './kwtext';
import { statArt } from './board';
import { itemIcon } from './pixelItems';

/** 状态数值：与场上同一套像素图标 + 右下角数字 */
const pxStat = (k: 'block', v: number) => h('span', { class: `kwic kw-${k}` }, h('i', null, v));

// 单例悬浮说明框：单位 / 补给

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

export interface TipStats { atk: number; hp: number; block?: number; ench?: Ench | null; drum?: number; lamp?: boolean; copies?: number; kws?: readonly string[] }

/** withUp：附带升一星的变化（只改数字时并进同一句写成「2→3」） */
export function unitTip(defId: string, level: number, st?: TipStats | null, withUp = true) {
  const d = unitDef(defId);
  const c = card(defId);
  const f = FACTION_INFO[d.faction];
  const add = level === 1 ? 0 : level === 2 ? 2 : 5;
  const atk = st ? st.atk : c.atk + add;
  const hp = st ? st.hp : c.hp + add;
  const ability = cardText(defId, level);
  const kwLines = (st?.kws ?? c.kws).filter((k) => k !== 'block').map((k) => `${KW_INFO[k as keyof typeof KW_INFO].name}：${KW_INFO[k as keyof typeof KW_INFO].desc}`);
  const upText = withUp && !d.enemyOnly && !d.token && level < 3 && c.v ? cardText(defId, level + 1) : '';
  const upDiff = upText && upText !== ability ? kwUpgrade(ability, upText) ?? upText : '';
  const extras: (Node | null)[] = [];
  if (st?.ench) extras.push(h('div', { class: 'tip-text tip-ench' }, itemIcon(foodOfEnch(st.ench), 'spell', 'tip-item'), ...kwRich(`附魔·${ENCH_INFO[st.ench].name}：${ENCH_INFO[st.ench].text}`)));
  if (st?.drum) extras.push(h('div', { class: 'tip-text tip-ench' }, itemIcon('f_drum', 'spell', 'tip-item'), ...kwRich(`战鼓：下一场 +${st.drum}/+${st.drum}`)));
  if (st?.lamp) extras.push(h('div', { class: 'tip-text tip-ench' }, itemIcon('f_lamp', 'spell', 'tip-item'), ...kwRich('魂灯：下一场获得复生')));
  return h(
    'div',
    { class: 'tip-unit', style: `--fc:${f.color}` },
    h(
      'div',
      { class: 'tip-head' },
      h('div', { class: 'tip-name' }, d.name),
      d.token ? h('span', { class: 'tip-fac' }, '召唤物') : d.enemyOnly ? h('span', { class: 'tip-fac' }, '敌军') : null,
      !d.enemyOnly && !d.token ? h('span', { class: 'tip-lv' }, tierBadge(d.tier), ' ', h('span', { class: 'tip-stars' }, '★'.repeat(level))) : null,
    ),
    h('div', { class: 'tip-stats' }, statArt('atk', atk), statArt('hp', hp), st?.block ? pxStat('block', st.block) : null,
      st?.copies != null && st.copies < 6 ? h('span', { class: 'ts-act' }, '升星', h('i', null, `${st.copies >= 3 ? st.copies - 3 : st.copies - 1}/${st.copies >= 3 ? 3 : 2}`)) : null),
    ability ? h('div', { class: 'tip-text' }, ...kwRich(ability)) : null,
    kwLines.length ? h('div', { class: 'tip-text tip-kw' }, ...kwLines.flatMap((t, i) => [i ? h('br') : null, ...kwRich(t)])) : null,
    ...extras,
    upDiff ? h('div', { class: 'tip-next' }, h('span', { class: 'tn-star' }, '★'.repeat(level + 1)), h('span', { class: 'tn-st' }, `+${level === 1 ? 2 : 3}/+${level === 1 ? 2 : 3}`), h('span', { class: 'tn-ab' }, ...kwInline(upDiff))) : null,
  );
}

const ENCH_FOOD: Record<Ench, string> = { rotate: 'f_scroll', iron: 'f_iron', chili: 'f_chili', amulet: 'f_amulet', shroom: 'f_shroom', wine: 'f_wine' };
export const foodOfEnch = (e: Ench) => ENCH_FOOD[e];

export function foodTip(id: string) {
  const fd = FOOD[id];
  return h('div', { class: 'tip-unit', style: `--fc:${FACTION_INFO.neutral.color}` },
    h('div', { class: 'tip-head' }, h('div', { class: 'tip-name' }, fd.name), h('span', { class: 'tip-fac' }, '补给'), h('span', { class: 'tip-lv' }, tierBadge(fd.tier))),
    h('div', { class: 'tip-text' }, ...kwRich(fd.text)),
    fd.ench ? h('div', { class: 'tip-text tip-kw' }, '附魔：每个单位只能带 1 个，新的会替换旧的。') : null);
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
  const room = { above: top0 - gap - pad, below: STAGE_H - y - gap - pad };
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
    max = Math.min(need, STAGE_H - pad * 2);
    top = (top0 + y) / 2 - max / 2;
  }
  tipEl.style.maxHeight = `${max}px`;
  // 实在太长时可以滑动查看，所以要能接收触摸
  tipEl.classList.toggle('interactive', need > max || content.classList.contains('selected-tip') || !!content.querySelector('button'));
  tipEl.style.top = `${Math.max(pad, Math.min(STAGE_H - max - pad, top))}px`;
}

let hideHook: (() => void) | null = null;
/** 详情关闭时的回调（备战连线跟着收起） */
export function setTipHideHook(fn: (() => void) | null) { hideHook = fn; }

export function hideTip() {
  hideHook?.();
  // Closing a scrollable/actionable detail must also retire its input surface.
  tipEl?.classList.remove('on', 'interactive');
  root?.querySelectorAll('.unit.inspected').forEach((unit) => unit.classList.remove('inspected'));
}

/** A selected tooltip may live in document.body on touch screens. */
export function isTipTarget(target: EventTarget | null) {
  return target instanceof Node && !!tipEl?.classList.contains('on') && tipEl.contains(target);
}
