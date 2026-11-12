import { cardIdentity, identityColor, type EconomyUsage } from './archetypes';
import { cardText, tierBadge } from './card';
import { card, equipOf, equipText, EQUIP, FOOD, foodText, fxFood, KW_INFO, Q_INFO, summonInfo, type Ench, type FoodFx, type Tier } from '../core/data';
import { unitSvg } from './unitArt';
import { FACTION_INFO, unitDef } from './shim';
import { h, STAGE_H, STAGE_W } from './dom';
import { highlightVariantNumbers, kwRich, kwTag } from './kwtext';
import { closeKeywordHelp, enableKeywordHelp, KEYWORD_HELP, markKeyword } from './keywordHelp';
import './css/card-details.css';
import { statArt } from './board';
import { itemIcon } from './pixelItems';
import { FOOD_HISTORY_MAX, type FoodMemory } from '../core/run';
import type { GrantedAbility } from '../core/engine';
import { supportGuide } from './support';

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

export interface TipStats { atk: number; hp: number; maxHp?: number; block?: number; ench?: Ench | null; tmpAtk?: number; tmpHp?: number; lamp?: boolean; tfx?: readonly FoodFx[]; copies?: number; kws?: readonly string[]; foodHistory?: readonly FoodMemory[]; prepUses?: { used: number; max: number } | null; granted?: GrantedAbility; seal?: number; startCharge?: number; wounds?: number; supportFoods?:readonly string[]; sealSources?:Readonly<Record<string,number>>; economyUsage?: EconomyUsage }

/** The final legacy argument is retained for callers; eligible cards share one effect switch. */
export function unitTip(defId: string, level: number, st?: TipStats | null, withUp = true) {
  void withUp;
  const d = unitDef(defId), c = card(defId);
  const actualLevel = level >= 3 ? 3 : level >= 2 ? 2 : 1;
  const atk = st?.atk ?? c.atk * (actualLevel >= 2 ? 2 : 1);
  const hp = st?.hp ?? c.hp * (actualLevel >= 2 ? 2 : 1);
  const detail = h('div', { class: 'tip-unit card-detail', style: `--fc:${identityColor(c)}`, 'data-def': defId });
  const effect = h('div', { class: 'unit-effect', 'data-keyword-paragraph': '' });
  const tabs = h('div', { class: 'tip-variants', role: 'group', 'aria-label': '查看普通或金色效果' });
  const canCompare = actualLevel <= 2 && !d.enemyOnly && !d.token;
  let viewedLevel = actualLevel;
  detail.dataset.currentLevel = String(actualLevel);
  const renderEffect = () => {
    closeKeywordHelp(detail);
    const preview = viewedLevel !== actualLevel;
    detail.dataset.effectLevel = String(viewedLevel);
    detail.dataset.previewLevel = String(viewedLevel);
    for (const button of tabs.querySelectorAll<HTMLButtonElement>('button')) {
      const selected = Number(button.dataset.level) === viewedLevel;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('active', selected);
    }
    const text = cardText(defId, viewedLevel);
    const body = h('div', { class: 'tip-text unit-effect-text' }, ...kwRich(text));
    if (canCompare) highlightVariantNumbers(body, text, cardText(defId, viewedLevel === 1 ? 2 : 1));
    if (c.inherit) for (const token of body.querySelectorAll<HTMLElement>('[data-keyword="传承"]')) token.dataset.keywordExplanation = KEYWORD_HELP.补给传承;
    const base = preview ? h('div', { class: 'tip-effect-preview' },
      h('strong', null, viewedLevel === 2 ? '金色预览' : '普通基础预览'),
      h('span', null, '基础属性 ', h('mark', { class: 'tip-number-change' }, String(c.atk * viewedLevel)), ' / ', h('mark', { class: 'tip-number-change' }, String(c.hp * viewedLevel))),
      st ? h('span', { class: 'tip-preview-context' }, '当前实际属性见上方') : null) : null;
    effect.replaceChildren(...[base, body, summonCard(defId, viewedLevel as 1 | 2 | 3)].filter(n => n !== null));
    enableKeywordHelp(detail);
    detail.dispatchEvent(new CustomEvent('tipcontentchange', { bubbles: true }));
    detail.dispatchEvent(new CustomEvent('tipvariantchange', { bubbles: true, detail: { level: viewedLevel, currentLevel: actualLevel, preview } }));
  };
  if (canCompare) for (const value of [1, 2]) {
    const label = value === 1 ? '普通效果' : '金色效果';
    const button = h('button', { type: 'button', class: 'tip-variant', 'data-level': String(value), 'aria-pressed': String(value === viewedLevel) }, label,
      value === actualLevel ? h('small', null, st?.copies != null ? '当前' : '本卡') : null);
    button.addEventListener('pointerdown', (event) => event.stopPropagation());
    button.addEventListener('click', (event) => { event.stopPropagation(); if (viewedLevel !== value) { viewedLevel = value; renderEffect(); } });
    tabs.append(button);
  }
  const extras: (Node | null)[] = [];
  if (st?.prepUses) extras.push(h('div', { class: 'tip-text tip-current-state' }, `本回合技能剩余 ${Math.max(0, st.prepUses.max - st.prepUses.used)}/${st.prepUses.max} 次`));
  const traits = (st?.kws ?? c.kws).filter((k) => k !== 'block');
  if (traits.length) extras.push(h('div', { class: 'tip-traits' }, ...traits.flatMap(k => KW_INFO[k as keyof typeof KW_INFO] ? [kwTag(KW_INFO[k as keyof typeof KW_INFO].name), ' '] : [])));
  if (st?.seal) extras.push(h('div', { class: 'tip-text tip-seal' }, ...kwRich(`下一场首击追加 ${st.seal} 伤害`)));
  if (st?.startCharge) extras.push(h('div', { class: 'tip-text prepared-support' }, ...kwRich(`下一场带 ${st.startCharge} 点蓄能，释放时消耗`)));
  if (st?.wounds) extras.push(h('div', { class: 'tip-text prepared-support' }, `下一场开战扣 ${st.wounds} 生命，最低 1 生命`));
  for (const id of st?.supportFoods ?? []) if (FOOD[id]) extras.push(h('div', { class: 'tip-text prepared-support' }, itemIcon(id, 'pack', 'tip-item'), h('b', null, FOOD[id].name), '（下一场）：', ...kwRich(FOOD[id].short ?? FOOD[id].text)));
  if (st?.granted) extras.push(h('div', { class: 'tip-text tip-granted' }, ...kwRich(grantedText(st.granted))));
  if (st?.ench && equipOf(st.ench)) extras.push(equipLine(st.ench));
  if (st?.tmpAtk || st?.tmpHp) extras.push(h('div', { class: 'tip-text tip-ench' }, itemIcon('f_drum', 'spell', 'tip-item'), ...kwRich(`下一场${st.tmpAtk ? ` +${st.tmpAtk} 攻击` : ''}${st.tmpHp ? ` +${st.tmpHp} 生命` : ''}`)));
  if (st?.lamp) extras.push(h('div', { class: 'tip-text tip-ench' }, itemIcon('f_lamp', 'spell', 'tip-item'), ...kwRich('魂灯：下一场获得复生')));
  for (const x of st?.tfx ?? []) { const fd = fxFood(x); extras.push(h('div', { class: 'tip-text tip-ench' }, itemIcon(fd.id, 'spell', 'tip-item'), ...kwRich(`${fd.name}（本场）：${fd.short ?? ''}`))); }
  if (c.inherit) extras.push(foodHistory(st?.copies != null ? st.foodHistory ?? [] : undefined));
  detail.append(...[
    h('div', { class: 'tip-head' },
      h('div', { class: 'tip-name' }, d.name),
      c.archetype || c.role ? h('span', { class: 'tip-fac' }, cardIdentity(defId)) : null,
      d.token ? h('span', { class: 'tip-fac' }, '召唤物') : d.enemyOnly ? h('span', { class: 'tip-fac' }, '敌军') : null,
      !d.enemyOnly && !d.token ? h('span', { class: 'tip-lv' }, tierBadge(d.tier), ' ', actualLevel >= 2 ? h('span', { class: 'tip-stars gold' }, '金色') : null) : null),
    h('div', { class: 'tip-stats' }, h('span', { class: 'tip-stats-caption' }, st ? '当前属性' : actualLevel >= 2 ? '金色基础' : '普通基础'),
      statArt('atk', atk), statArt('hp', st?.maxHp && st.maxHp !== hp ? h('span', { title: `开战生命 ${hp} / 上限 ${st.maxHp}` }, hp, '/', st.maxHp) : hp),
      st?.block ? pxStat('block', st.block) : null,
      st?.copies != null && st.copies < 3 ? h('span', { class: 'ts-act' }, '三连', h('i', null, `${st.copies}/3`)) : st?.copies != null ? h('span', { class: 'ts-act gold' }, '金色') : null),
    canCompare ? tabs : null, effect, ...extras].filter(n => n !== null));
  renderEffect();
  return enableKeywordHelp(detail);
}

function foodHistory(items?: readonly FoodMemory[]) {
  return h('div', { class: 'tip-food-memory' },
    h('div', { class: 'tfm-head' }, markKeyword(h('b', null, items ? `补给传承 ${items.length}/${FOOD_HISTORY_MAX}` : '补给传承'), '补给传承')),
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
export function equipLine(id: Ench, showName = true) {
  const e = EQUIP[id];
  const [head, ...atoms] = equipText(e);
  return h('div', { class: 'tip-text tip-ench' }, equipIcon(id, 'tip-item'),
    showName ? h('b', { style: `color:${Q_INFO[e.q].color}` }, e.name) : null, e.curse ? h('span', { class: 'tip-curse' }, '诅咒') : null, showName ? '：' : null, ...kwRich(head),
    ...atoms.flatMap((t) => [h('br'), ...kwRich(t)]));
}

export function equipTip(id: Ench, note?: string) {
  const e = EQUIP[id];
  return enableKeywordHelp(h('div', { class: 'tip-unit', style: `--fc:${Q_INFO[e.q].color}` },
    h('div', { class: 'tip-head' }, h('div', { class: 'tip-name', style: `color:${Q_INFO[e.q].color}` }, e.name), h('span', { class: 'tip-fac' }, `${Q_INFO[e.q].name}装备`)),
    equipLine(id, false), supportGuide(e),
    note ? h('div', { class: 'tip-text tip-kw' }, note) : null));
}

export function foodTip(id: string, val?: [number, number]) {
  const fd = FOOD[id];
  return enableKeywordHelp(h('div', { class: 'tip-unit', style: `--fc:${FACTION_INFO.neutral.color}` },
    h('div', { class: 'tip-head' }, h('div', { class: 'tip-name' }, fd.name), h('span', { class: 'tip-fac' }, fd.spell ? '法术' : '补给'), h('span', { class: 'tip-lv' }, tierBadge(fd.tier))),
    h('div', { class: 'tip-text' }, ...kwRich(foodText(id, val))), supportGuide(fd)));
}

/** 在舞台坐标 (x, y) 附近显示说明：先量内容高度，上下放得下的一侧优先；都放不下就放到目标左右 */
/** top：目标上沿（默认同 y），放上方时以它为准，免得盖住目标本身 */
export interface Box { l: number; t: number; r: number; b: number }
/** avoid：不许盖住的区域（备战点单位时的关系箭头和标签），舞台坐标 */
export function showTip(content: HTMLElement, x: number, y: number, prefer: 'above' | 'below' = 'above', top0 = y, avoid?: Box | null) {
  if (!tipEl || !root) return;
  closeKeywordHelp();
  tipEl.replaceChildren(content);
  tipEl.classList.add('on');
  tipEl.classList.remove('dock');
  root.appendChild(tipEl);
  const shownTip = tipEl;
  const layout = () => {
    if (!shownTip.classList.contains('on') || shownTip.firstElementChild !== content || shownTip.classList.contains('dock')) return;
    const w = 440, pad = 12, gap = 8;
    shownTip.style.width = `${w}px`;
    shownTip.style.left = `${Math.max(pad, Math.min(STAGE_W - w - pad, x - w / 2))}px`;
    shownTip.style.bottom = '';
    shownTip.style.maxHeight = 'none';
    // offsetHeight rounds fractional line heights; a tight cap can introduce a
    // scrollbar, narrow the text and wrap another whole line on short screens.
    const need = shownTip.offsetHeight + 2;

    const room = { above: top0 - gap - pad, below: STAGE_H - y - gap - pad };
    const other = prefer === 'above' ? 'below' : 'above';
    const left0 = parseFloat(shownTip.style.left);
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
      shownTip.style.left = `${pick}px`;
    }
    shownTip.style.maxHeight = `${max}px`;
    // 实在太长时可以滑动查看，所以要能接收触摸
    shownTip.classList.toggle('interactive', need > max || content.classList.contains('selected-tip') || !!content.querySelector('button, details, [data-keyword][role="button"]'));
    shownTip.style.top = `${Math.max(pad, Math.min(STAGE_H - max - pad, top))}px`;
  };
  shownTip.scrollTop = 0;
  layout();
  // Local effect/keyword updates resize this detail while retaining its actions.
  content.addEventListener('tipcontentchange', layout);
}

/** 牌区详情：固定停靠在舞台左上角，不贴着牌定位，所以永远不挡卡牌；bottom 为舞台坐标下沿 */
export function showDockTip(content: HTMLElement, bottom: number) {
  if (!tipEl || !root) return;
  closeKeywordHelp();
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
  closeKeywordHelp();
  hideHook?.();
  // Closing a scrollable/actionable detail must also retire its input surface.
  tipEl?.classList.remove('on', 'interactive', 'dock');
  root?.querySelectorAll('.unit.inspected').forEach((unit) => unit.classList.remove('inspected'));
}

/** A selected tooltip may live in document.body on touch screens. */
export function isTipTarget(target: EventTarget | null) {
  return target instanceof Node && !!tipEl?.classList.contains('on') && tipEl.contains(target);
}
