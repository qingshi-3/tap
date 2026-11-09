import { cardText, foodRow, tierBadge } from './card';
import { card, equipOf, equipText, EQUIP, FOOD, fxFood, KW_INFO, Q_INFO, summonInfo, type Ench, type FoodFx, type Tier } from '../core/data';
import { unitSvg } from './unitArt';
import { FACTION_INFO, unitDef } from './shim';
import { h, STAGE_H, STAGE_W } from './dom';
import { kwInline, kwRich, kwUpgrade } from './kwtext';
import { statArt } from './board';
import { itemIcon } from './pixelItems';
import { FOOD_HISTORY_MAX, type FoodMemory } from '../core/run';
import type { GrantedAbility } from '../core/engine';

export function grantedText(ability: GrantedAbility) {
  const effect = ability.id === 'bone' ? `阵亡时召唤 ${ability.value}/${ability.value} 魂火`
    : ability.id === 'spark' ? `开战时对敌方队首造成 ${ability.value} 伤害`
    : ability.id === 'thorn' ? `受伤时对伤害来源造成 ${ability.value} 伤害`
    : ability.id === 'sprout' ? `每个备战回合结束时永久 +${ability.value} 生命`
    : `开战时对自己造成 1 伤害${ability.value ? `，存活后本场 +${ability.value} 攻` : ''}`;
  return `${ability.duration === 'battle' ? '下一场' : '永久'} · ${effect}${ability.tempered ? '（已淬炼）' : ''}`;
}

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

export interface TipStats { atk: number; hp: number; block?: number; ench?: Ench | null; tmpAtk?: number; tmpHp?: number; lamp?: boolean; tfx?: readonly FoodFx[]; copies?: number; kws?: readonly string[]; foodHistory?: readonly FoodMemory[]; prepUses?: { used: number; max: number } | null; granted?: GrantedAbility }

/** withUp：附带升一星的变化（只改数字时并进同一句写成「2→3」） */
export function unitTip(defId: string, level: number, st?: TipStats | null, withUp = true) {
  const d = unitDef(defId);
  const c = card(defId);
  const f = FACTION_INFO[d.faction];
  const atk = st ? st.atk : level >= 2 ? c.atk * 2 : c.atk;
  const hp = st ? st.hp : level >= 2 ? c.hp * 2 : c.hp;
  const ability = cardText(defId, level);
  const shownAbility = st?.prepUses
    ? ability.replace(/每回合 \d+ 次/, `本回合剩 ${Math.max(0, st.prepUses.max - st.prepUses.used)}/${st.prepUses.max} 次`)
    : ability;
  const kwLines = (st?.kws ?? c.kws).filter((k) => k !== 'block').map((k) => `${KW_INFO[k as keyof typeof KW_INFO].name}：${KW_INFO[k as keyof typeof KW_INFO].desc}`);
  const upText = withUp && !d.enemyOnly && !d.token && level < 2 && (c.v || c.pv || c.u) ? cardText(defId, level + 1) : '';
  const upDiff = upText && upText !== ability ? kwUpgrade(ability, upText) ?? upText : '';
  const extras: (Node | null)[] = [];
  if (st?.granted) extras.push(h('div', { class: 'tip-text tip-granted' }, grantedText(st.granted)));
  if (st?.ench && equipOf(st.ench)) extras.push(equipLine(st.ench));
  if (st?.tmpAtk || st?.tmpHp) extras.push(h('div', { class: 'tip-text tip-ench' }, itemIcon('f_drum', 'spell', 'tip-item'), ...kwRich(`下一场 +${st.tmpAtk ?? 0}/+${st.tmpHp ?? 0}`)));
  const sum = summonCard(defId, level as 1 | 2 | 3);
  if (sum) extras.push(sum);
  if (st?.lamp) extras.push(h('div', { class: 'tip-text tip-ench' }, itemIcon('f_lamp', 'spell', 'tip-item'), ...kwRich('魂灯：下一场获得复生')));
  for (const x of st?.tfx ?? []) { const fd = fxFood(x); extras.push(h('div', { class: 'tip-text tip-ench' }, itemIcon(fd.id, 'spell', 'tip-item'), ...kwRich(`${fd.name}（本场）：${fd.short ?? ''}`))); }
  if (c.inherit) extras.push(foodHistory(st?.copies != null ? st.foodHistory ?? [] : undefined));
  return h(
    'div',
    { class: 'tip-unit', style: `--fc:${f.color}` },
    h(
      'div',
      { class: 'tip-head' },
      h('div', { class: 'tip-name' }, d.name),
      d.token ? h('span', { class: 'tip-fac' }, '召唤物') : d.enemyOnly ? h('span', { class: 'tip-fac' }, '敌军') : null,
      !d.enemyOnly && !d.token ? h('span', { class: 'tip-lv' }, tierBadge(d.tier), ' ', level >= 2 ? h('span', { class: 'tip-stars gold' }, '金色') : null) : null,
    ),
    h('div', { class: 'tip-stats' }, statArt('atk', atk), statArt('hp', hp), st?.block ? pxStat('block', st.block) : null,
      st?.copies != null && st.copies < 3 ? h('span', { class: 'ts-act' }, '三连', h('i', null, `${st.copies}/3`)) : st?.copies != null ? h('span', { class: 'ts-act gold' }, '金色') : null),
    ability ? h('div', { class: 'tip-text' }, ...kwRich(shownAbility)) : null,
    kwLines.length ? h('div', { class: 'tip-text tip-kw' }, ...kwLines.flatMap((t, i) => [i ? h('br') : null, ...kwRich(t)])) : null,
    ...extras,
    upDiff ? h('div', { class: 'tip-next' }, h('span', { class: 'tn-star gold' }, '金色'), h('span', { class: 'tn-st' }, '属性×2'), h('span', { class: 'tn-ab' }, ...kwInline(upDiff))) : null,
  );
}

function foodHistory(items?: readonly FoodMemory[]) {
  return h('div', { class: 'tip-food-memory' },
    h('div', { class: 'tfm-head' }, h('b', null, items ? `补给传承 ${items.length}/${FOOD_HISTORY_MAX}` : '补给传承')),
    items?.length
      ? h('div', { class: 'tfm-list' }, ...items.map((x) => h('div', { class: 'tfm-item' },
        itemIcon(x.id, 'spell', 'tip-item'), h('span', null, FOOD[x.id]?.name ?? x.id),
        h('span', { class: 'tfm-stats' }, statArt('atk', x.atk), statArt('hp', x.hp)))))
      : null);
}

/** 会成长的召唤物身材：数字照常，右上角小「+」 */
const grow = () => h('i', null, '1', h('sup', { class: 'st-up' }, '+'));

/** 技能召唤物小卡：固定召唤物画立绘和身材；随机召唤画「?」和阶数 */
function summonCard(defId: string, level: 1 | 2 | 3) {
  const c = card(defId);
  const info = summonInfo(c, level);
  if (!info) return null;
  const n = info.count > 1 ? h('b', { class: 'ts-n' }, `×${info.count}`) : null;
  if (!info.def) {
    return h('div', { class: 'tip-sum' }, h('span', { class: 'ts-art ts-q' }, '?'),
      h('span', { class: 'ts-name' }, '随机 ', tierBadge(info.tier as Tier), info.lvl >= 2 ? ' 金色单位' : ' 单位'),
      info.tier === 6 ? null : h('span', { class: 'ts-st' }, statArt('atk', info.atk), statArt('hp', info.hp)), n);
  }
  const egg = c.ab === 'egg';
  const rooster = c.ab === 'rooster';
  return h('div', { class: 'tip-sum' }, h('span', { class: 'ts-art', html: unitSvg(info.def) }),
    h('span', { class: 'ts-name' }, card(info.def).name),
    h('span', { class: 'ts-st' }, statArt('atk', rooster ? h('i', null, '½') : egg ? grow() : info.atk), statArt('hp', egg ? grow() : info.hp)), n);
}

/** 装备 icon：带品质色光 */
export const equipIcon = (id: Ench, cls = '') => {
  const e = EQUIP[id];
  const i = itemIcon(e?.icon ?? 'spell', 'spell', `${cls} eq-q eq-q${e?.q ?? 0}`);
  return i;
};

/** 说明框里的装备一行：品质色名字 + 文案 + 词条展开 */
export function equipLine(id: Ench) {
  const e = EQUIP[id];
  const [head, ...atoms] = equipText(e);
  return h('div', { class: 'tip-text tip-ench' }, equipIcon(id, 'tip-item'),
    h('b', { style: `color:${Q_INFO[e.q].color}` }, `${Q_INFO[e.q].name}·${e.name}`), e.curse ? h('span', { class: 'tip-curse' }, '诅咒') : null, '：', ...kwRich(head),
    ...atoms.flatMap((t) => [h('br'), ...kwRich(t)]));
}

export function equipTip(id: Ench, note?: string) {
  const e = EQUIP[id];
  return h('div', { class: 'tip-unit', style: `--fc:${Q_INFO[e.q].color}` },
    h('div', { class: 'tip-head' }, h('div', { class: 'tip-name', style: `color:${Q_INFO[e.q].color}` }, e.name), h('span', { class: 'tip-fac' }, `${Q_INFO[e.q].name}装备`)),
    equipLine(id),
    note ? h('div', { class: 'tip-text tip-kw' }, note) : null);
}

export function foodTip(id: string, val?: [number, number]) {
  const fd = FOOD[id];
  return h('div', { class: 'tip-unit', style: `--fc:${FACTION_INFO.neutral.color}` },
    h('div', { class: 'tip-head' }, h('div', { class: 'tip-name' }, fd.name), h('span', { class: 'tip-fac' }, fd.spell ? '法术' : '补给'), h('span', { class: 'tip-lv' }, tierBadge(fd.tier))),
    h('div', { class: 'tip-text' }, foodRow(id, val), fd.spell ? h('div', { class: 'fr-short' }, ...kwRich(fd.text)) : fd.short ? h('div', { class: 'fr-short' }, ...kwRich(fd.short)) : null));
}

/** 在舞台坐标 (x, y) 附近显示说明：先量内容高度，上下放得下的一侧优先；都放不下就放到目标左右 */
/** top：目标上沿（默认同 y），放上方时以它为准，免得盖住目标本身 */
export interface Box { l: number; t: number; r: number; b: number }
/** avoid：不许盖住的区域（备战点单位时的关系箭头和标签），舞台坐标 */
export function showTip(content: HTMLElement, x: number, y: number, prefer: 'above' | 'below' = 'above', top0 = y, avoid?: Box | null) {
  if (!tipEl || !root) return;
  tipEl.replaceChildren(content);
  tipEl.classList.add('on');
  tipEl.classList.remove('dock');
  root.appendChild(tipEl);
  const w = 440, pad = 12, gap = 8;
  tipEl.style.width = `${w}px`;
  tipEl.style.left = `${Math.max(pad, Math.min(STAGE_W - w - pad, x - w / 2))}px`;
  tipEl.style.bottom = '';
  tipEl.style.maxHeight = 'none';
  // offsetHeight rounds fractional line heights; a tight cap can introduce a
  // scrollbar, narrow the text and wrap another whole line on short screens.
  const need = tipEl.offsetHeight + 2;
  tipEl.scrollTop = 0;
  const room = { above: top0 - gap - pad, below: STAGE_H - y - gap - pad };
  const other = prefer === 'above' ? 'below' : 'above';
  const left0 = parseFloat(tipEl.style.left);
  const hits = (l: number, t: number, hh: number) => !!avoid && l < avoid.r && l + w > avoid.l && t < avoid.b && t + hh > avoid.t;
  const fits = (sd: 'above' | 'below') => need <= room[sd] && !hits(left0, sd === 'above' ? top0 - gap - need : y + gap, need);
  const side = fits(prefer) ? prefer : fits(other) ? other : null;
  let top: number, max: number;
  if (side) {
    max = need;
    top = side === 'above' ? top0 - gap - need : y + gap;
  } else {
    // 上下都放不下：挪到目标左右两侧，按整屏高度放，不盖住目标
    const off = 64;
    max = Math.min(need, STAGE_H - pad * 2);
    top = Math.max(pad, Math.min(STAGE_H - max - pad, (top0 + y) / 2 - max / 2));
    const clamp = (l: number) => Math.max(pad, Math.min(STAGE_W - w - pad, l));
    // 先放目标朝屏幕中间那侧；有箭头就整体让到箭头外面，放不下再换另一侧
    const right = clamp(Math.max(x + off, avoid ? avoid.r + gap : 0));
    const leftSide = clamp(Math.min(x - off - w, avoid ? avoid.l - gap - w : STAGE_W));
    const order = x < STAGE_W / 2 ? [right, leftSide] : [leftSide, right];
    const pick = order.find((l) => !hits(l, top, max) && (l >= x + off || l + w <= x - off)) ?? clamp(x < STAGE_W / 2 ? x + off : x - off - w);
    tipEl.style.left = `${pick}px`;
  }
  tipEl.style.maxHeight = `${max}px`;
  // 实在太长时可以滑动查看，所以要能接收触摸
  tipEl.classList.toggle('interactive', need > max || content.classList.contains('selected-tip') || !!content.querySelector('button'));
  tipEl.style.top = `${Math.max(pad, Math.min(STAGE_H - max - pad, top))}px`;
}

/** 牌区详情：固定停靠在舞台左上角，不贴着牌定位，所以永远不挡卡牌；bottom 为舞台坐标下沿 */
export function showDockTip(content: HTMLElement, bottom: number) {
  if (!tipEl || !root) return;
  tipEl.replaceChildren(content);
  tipEl.classList.add('on', 'interactive', 'dock');
  root.appendChild(tipEl);
  const acts = content.querySelector(':scope > .shelf-acts');
  if (acts) {
    const body = document.createElement('div');
    body.className = 'dock-body';
    body.append(...Array.from(content.childNodes).filter((n) => n !== acts));
    content.replaceChildren(body, acts);
  }
  const pad = 12, top = 70;
  // Three shop actions need one full row so the content remains visible in
  // the upper dock. The anchor stays fixed at the original top-left position.
  tipEl.style.width = acts && acts.querySelectorAll('button').length > 2 ? '640px' : '440px';
  tipEl.style.left = `${pad}px`;
  tipEl.style.bottom = '';
  tipEl.style.top = `${top}px`;
  tipEl.scrollTop = 0;
  tipEl.style.maxHeight = `${Math.min(STAGE_H - top - pad, Math.max(280, bottom - top))}px`;
}

let hideHook: (() => void) | null = null;
/** 详情关闭时的回调（备战连线跟着收起） */
export function setTipHideHook(fn: (() => void) | null) { hideHook = fn; }

export function hideTip() {
  hideHook?.();
  // Closing a scrollable/actionable detail must also retire its input surface.
  tipEl?.classList.remove('on', 'interactive', 'dock');
  root?.querySelectorAll('.unit.inspected').forEach((unit) => unit.classList.remove('inspected'));
}

/** A selected tooltip may live in document.body on touch screens. */
export function isTipTarget(target: EventTarget | null) {
  return target instanceof Node && !!tipEl?.classList.contains('on') && tipEl.contains(target);
}
