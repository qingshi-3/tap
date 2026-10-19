import { FACTION_INFO, RARITY_NAMES, unitDef } from '../core/data';
import { levelStats } from '../core/engine';
import { describe } from '../core/run';
import { h } from './dom';
import { icon } from './icons';
import { kwRich, kwTag } from './kwtext';
import { unitSvg } from './unitArt';
import { CARD_SUMMARY } from './cardSummary';

export interface CardOpts {
  /** 若与已上阵单位同名：合并后的等级 */
  mergeTo?: number;
  maxed?: boolean;
}

export function draftCard(defId: string, o: CardOpts = {}) {
  const d = unitDef(defId);
  const f = FACTION_INFO[d.faction];
  const st = levelStats(defId, 1);
  // 卡面宽度只容两行大字：缺概括时退回描述的第一个分句，再按长度降字号并截断，保证不溢出卡框
  const brief = CARD_SUMMARY[defId] ?? describe(defId, 1).split(/[；;]/)[0];
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
        h('span', { class: 'card-tier' }, RARITY_NAMES[d.tier]),
      ),
      h('div', { class: 'card-art', html: unitSvg(defId) }),
      h('i', { class: 'card-gems', style: `--n:${d.tier}` }),
      h('div', { class: 'card-name' }, d.name),
      h('div', { class: `card-brief${briefCls(brief)}` }, ...kwRich(brief)),
      h(
        'div',
        { class: 'card-text' },
        ...kwRich(describe(defId, 1)),
      ),
      h(
        'div',
        { class: 'card-stats' },
        h('span', { class: 'cs atk' }, icon('sword'), h('i', null, st.atk)),
        d.keywords?.length ? h('span', { class: 'card-kw' }, d.keywords.map((k) => kwTag(k))) : h('span', { class: 'card-kw' }),
        h('span', { class: 'cs hp' }, icon('heart'), h('i', null, st.hp)),
      ),
    ),
    o.mergeTo
      ? h('div', { class: 'card-badge' }, icon('arrowUp'), `合成 ${o.mergeTo}星`)
      : o.maxed
        ? h('div', { class: 'card-badge maxed' }, '已有三星')
        : null,
  );
}

/** 卡面一行约 7 个大字：≤14 字两行原字号，更长降字号，三行封顶（余下截断，详情点开看） */
function briefCls(text: string) {
  return text.length <= 14 ? '' : text.length <= 20 ? ' sm' : ' xs';
}
