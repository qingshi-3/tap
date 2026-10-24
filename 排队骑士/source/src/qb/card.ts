import { card, FOOD, KW_INFO } from '../core/data';
import { FACTION_INFO, RARITY_NAMES, unitDef, type Rarity } from './shim';
import { h } from './dom';
import { icon } from './icons';
import { kwRich, kwTag, trigCap, type TrigId } from './kwtext';
import { unitSvg } from './unitArt';
import { itemIcon } from './pixelItems';

export interface CardOpts {
  /** 若与已上阵单位同名：合并后的等级 */
  mergeTo?: number;
  maxed?: boolean;
  /** 叠加进度（未到升星时）：如「2/3」 */
  stack?: string;
  /** 升星奖励卡 */
  bonus?: boolean;
  /** 图鉴按星级浏览时显示对应星级的数值 */
  level?: number;
  /** 罐头等额外攻血 */
  plus?: number;
}

/** 卡面文案：{v} {u} 换成该星级数值 */
export function cardText(id: string, lvl = 1) {
  const d = card(id);
  return d.text.replace(/\{v\}/g, String(d.v?.[lvl - 1] ?? '')).replace(/\{u\}/g, String(d.u?.[lvl - 1] ?? ''));
}
/** 卡牌摘要标签：技能时机 + 天生词条 */
export function cardLabels(id: string): string[] {
  const d = card(id);
  const out: string[] = [];
  const m = /^([^：]{1,10})：/.exec(d.text);
  if (m) out.push(m[1].replace(/（.*$/, ''));
  for (const k of d.kws) out.push(KW_INFO[k].name);
  return out.slice(0, 2);
}

export function draftCard(defId: string, o: CardOpts = {}) {
  const d = unitDef(defId);
  const c = card(defId);
  const f = FACTION_INFO[d.faction];
  const lvl = o.level ?? 1;
  const plus = o.plus ?? 0;
  const add = lvl === 1 ? 0 : lvl === 2 ? 2 : 5;
  return h(
    'div',
    { class: `card tier-${d.tier} fac-${d.faction}`, style: `--fc:${f.color};--fd:${f.dark};--pxf:var(--pxf-${d.faction});--pxm:var(--pxm-${d.faction});--pxs:var(--pxs-${d.faction})`, 'data-id': defId },
    h(
      'div',
      { class: 'card-in' },
      h('div', { class: 'card-shine' }),
      h('i', { class: 'card-sigil' }),
      h('div', { class: 'card-top' }, h('span', { class: 'card-fac' }, c.perm ? '永久成长' : ''), h('span', { class: 'card-tier' }, tierBadge(d.tier))),
      tierArt('card-art', defId, d.tier),
      h('i', { class: 'card-gems', style: `--n:${d.tier}` }),
      h('div', { class: 'card-name' }, d.name),
      h('div', { class: 'card-brief card-keywords' }, ...cardLabels(defId).map(previewTag)),
      h('div', { class: 'card-text' }, ...kwRich(cardText(defId, lvl))),
      h(
        'div',
        { class: 'card-stats' },
        h('span', { class: 'cs atk' }, icon('sword'), h('i', null, c.atk + add + plus)),
        h('span', { class: 'cs hp' }, icon('heart'), h('i', null, c.hp + add + plus)),
      ),
    ),
    o.mergeTo
      ? h('div', { class: 'card-badge' }, icon('arrowUp'), `升 ${o.mergeTo}星`)
      : o.stack
        ? h('div', { class: 'card-badge stack' }, o.stack)
        : o.maxed
          ? h('div', { class: 'card-badge maxed' }, '已满6份')
          : null,
  );
}

/** 补给卡：同一套卡框（中立色），立绘换成像素道具 */
export function foodCard(id: string) {
  const fd = FOOD[id];
  const f = FACTION_INFO.neutral;
  return h(
    'div',
    { class: `card food-card tier-${fd.tier} fac-neutral`, style: `--fc:${f.color};--fd:${f.dark};--pxf:var(--pxf-neutral);--pxm:var(--pxm-neutral);--pxs:var(--pxs-neutral)`, 'data-id': id },
    h(
      'div',
      { class: 'card-in' },
      h('div', { class: 'card-shine' }),
      h('div', { class: 'card-top' }, h('span', { class: 'card-fac' }, '补给'), h('span', { class: 'card-tier' }, tierBadge(fd.tier))),
      h('div', { class: 'card-art food-art' }, itemIcon(id, 'pack', 'food-icon')),
      h('i', { class: 'card-gems', style: `--n:${fd.tier}` }),
      h('div', { class: 'card-name' }, fd.name),
      h('div', { class: 'card-text' }, ...kwRich(fd.text)),
    ),
  );
}

const TIER_NUM = ['一', '二', '三', '四', '五', '六'];
const TIER_WINGS = [0, 1, 2, 3, 3, 3];
/** 阶级徽记：中间宝石写阶数，两侧羽翼逐阶加片，五阶加冠、六阶冠上星芒（样式见 card-tiers.css） */
export function tierBadge(tier: Rarity) {
  const wing = (side: string) => h('i', { class: `tb-w ${side}` }, ...Array.from({ length: TIER_WINGS[tier - 1] ?? 0 }, () => h('i')));
  return h('span', { class: `tier-badge rarity-${tier}`, role: 'img', 'aria-label': RARITY_NAMES[tier], title: RARITY_NAMES[tier] },
    wing('l'), h('b', { class: 'tb-gem' }, h('em', null, TIER_NUM[tier - 1])), wing('r'));
}

/** 单位身后的阶层光效（一阶不渲染）：二阶脚光 → 三阶光点 → 四阶背光柱 → 五阶星芒 → 六阶赤金余烬。
 *  招募卡、图鉴、阵容头像、整备等所有单位立绘共用；上场战斗的单位不挂。 */
export function tierAura(tier: number) {
  if (tier <= 1) return null;
  return h('i', { class: `card-aura tier-${tier}`, 'aria-hidden': 'true' },
    h('b', { class: 'a-pillar' }), h('b', { class: 'a-glow' }),
    h('b', { class: 'a-motes m1' }), h('b', { class: 'a-motes m2' }), h('b', { class: 'a-motes m3' }),
    h('b', { class: 'a-spark s1' }), h('b', { class: 'a-spark s2' }));
}

/** 立绘 + 阶层光效 */
export function tierArt(cls: string, defId: string, tier: number, tag: 'div' | 'span' = 'div') {
  const art = h(tag, { class: `${cls} has-aura`, html: unitSvg(defId) });
  const aura = tierAura(tier);
  if (aura) art.prepend(aura);
  return art;
}

export const PREVIEW_TRIG: Record<string, TrigId> = {};

function previewTag(label: string) {
  return /[时后]$|^每次交锋|^每回合/.test(label) ? trigCap(triggerOf(label), label, true) : kwTag(label);
}
function triggerOf(label: string): TrigId {
  if (/开战/.test(label)) return 'start';
  if (/回合|出售|升星|刷新/.test(label)) return 'shop';
  if (/召唤/.test(label)) return 'summon';
  if (/敌方阵亡/.test(label)) return 'kill';
  if (/阵亡/.test(label)) return 'faint';
  if (/上前/.test(label)) return 'front';
  if (/退后/.test(label)) return 'rear';
  if (/受伤/.test(label)) return 'hurt';
  if (/交锋/.test(label)) return 'beat';
  return 'cond';
}
