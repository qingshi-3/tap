import { abilityText } from '../core/abilityText';
import { FACTION_INFO, RARITY_NAMES, unitDef } from '../core/data';
import type { Rarity } from '../core/types';
import { levelStats } from '../core/engine';
import { h } from './dom';
import { icon } from './icons';
import { kwRich, kwTag, trigCap, type TrigId } from './kwtext';
import { unitSvg } from './unitArt';
import { CARD_SUMMARY } from './cardSummary';

export interface CardOpts {
  /** 若与已上阵单位同名：合并后的等级 */
  mergeTo?: number;
  maxed?: boolean;
  /** 叠加进度（未到升星时）：如「叠加 2/3」 */
  stack?: string;
  /** 升星奖励卡 */
  bonus?: boolean;
  /** 图鉴按星级浏览时显示对应星级的数值 */
  level?: number;
}

export function draftCard(defId: string, o: CardOpts = {}) {
  const d = unitDef(defId);
  const f = FACTION_INFO[d.faction];
  const st = levelStats(defId, o.level ?? 1);
  // 招募卡采用独立词条；非招募单位的复用入口只回退到已有机制，不压缩技能句子。
  const labels = CARD_SUMMARY[defId]?.split('/') ?? d.keywords ?? [];
  return h(
    'div',
    { class: `card tier-${d.tier} fac-${d.faction}`, style: `--fc:${f.color};--fd:${f.dark};--pxf:var(--pxf-${d.faction});--pxm:var(--pxm-${d.faction});--pxs:var(--pxs-${d.faction})`, 'data-id': defId },
    h(
      'div',
      { class: 'card-in' },
      h('div', { class: 'card-shine' }),
      h('i', { class: 'card-sigil' }),
      h(
        'div',
        { class: 'card-top' },
        h('span', { class: 'card-fac' }, f.name),
        h('span', { class: 'card-tier' }, tierBadge(d.tier)),
      ),
      cardArt(defId, d.tier),
      h('i', { class: 'card-gems', style: `--n:${d.tier}` }),
      h('div', { class: 'card-name' }, d.name),
      h('div', { class: 'card-brief card-keywords' }, ...labels.map(previewTag)),
      h(
        'div',
        { class: 'card-text' },
        ...kwRich(abilityText(defId, 1)),
      ),
      h(
        'div',
        { class: 'card-stats' },
        h('span', { class: 'cs atk' }, icon('sword'), h('i', null, st.atk)),
        h('span', { class: 'cs hp' }, icon('heart'), h('i', null, st.hp)),
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

function cardArt(defId: string, tier: number) {
  return tierArt('card-art', defId, tier);
}

export const PREVIEW_TRIG: Record<string, TrigId> = {
  开战: 'start', 施法: 'cast', 普攻: 'attack', 受击: 'hurt',
  击杀: 'kill', 阵亡: 'faint', 每次交锋: 'beat', 周期: 'beat',
};

function previewTag(label: string) {
  const trigger = PREVIEW_TRIG[label];
  return trigger ? trigCap(trigger, label, true) : kwTag(label);
}
