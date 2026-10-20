import { abilityText } from '../core/abilityText';
import { FACTION_INFO, RARITY_NAMES, unitDef } from '../core/data';
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
}

export function draftCard(defId: string, o: CardOpts = {}) {
  const d = unitDef(defId);
  const f = FACTION_INFO[d.faction];
  const st = levelStats(defId, 1);
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
        h('span', { class: 'card-tier' }, RARITY_NAMES[d.tier]),
      ),
      h('div', { class: 'card-art', html: unitSvg(defId) }),
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
      ? h('div', { class: 'card-badge' }, icon('arrowUp'), `合成 ${o.mergeTo}星`)
      : o.maxed
        ? h('div', { class: 'card-badge maxed' }, '已有三星')
        : null,
  );
}

const PREVIEW_TRIG: Record<string, TrigId> = {
  开战: 'start', 施法: 'cast', 普攻: 'attack', 受击: 'hurt',
  击杀: 'kill', 阵亡: 'faint', 每拍: 'beat', 周期: 'beat',
};

function previewTag(label: string) {
  const trigger = PREVIEW_TRIG[label];
  return trigger ? trigCap(trigger, label, true) : kwTag(label);
}
