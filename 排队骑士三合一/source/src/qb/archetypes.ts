import { ARCHETYPES, type ArchetypeId } from '../core/archetypes';
import { card, LINE_INFO, type CardDef } from '../core/data';
import { h } from './dom';
import './css/archetype-rework.css';
export const ARCHETYPE_COLORS: Record<ArchetypeId,string> = { wheel:'#efc76d', charge:'#85bbed', ember:'#ed976d', nest:'#a9cc83', blood:'#e77d91', trade:'#d8b782', rune:'#b29bea', pair:'#e9aece', hunt:'#a9d284', formation:'#7dcfc6', supply:'#8fd8e5' };
export const identityColor = (d: CardDef) => d.archetype ? ARCHETYPE_COLORS[d.archetype] : LINE_INFO[d.line].color;
export const identityName = (d: CardDef) => d.archetype ? ARCHETYPES[d.archetype].name : d.id.startsWith('rw_common_') ? '通用' : LINE_INFO[d.line].name;
export const HUNT_MARK_TEXT = '每次交锋结束时，每层猎标造成1点伤害。目标阵亡后，传给它身后的敌人，并增加1层。';
const archetypeRules: Partial<Record<ArchetypeId, string>> = {
  wheel:'每完成一次轮转，全队轮转次数 +1。圈数 = 全队轮转次数 ÷ 开战时我方人数，向下取整。',
  ember:'继承到攻击、生命或新的阵亡技能后，触发继承效果。',
  formation:'原始相邻指开战时相邻的两名友军；两人都存活、保持原前后顺序且仍紧邻时，这一组相邻关系生效。',
  supply:'群体补给按最初吃到补给的人数计次。分享、转交和重复效果跳过计次。',
};
export function archetypeGuide(id: ArchetypeId, showAction = true) {
  const a = ARCHETYPES[id];
  const row = (label: string, text: string) => h('p', { class:'archetype-guide-row' },
    h('span', { class:'archetype-guide-label' }, label), h('span', { class:'archetype-guide-value' }, text));
  return h('section', { class:'archetype-guide', style:`--ac:${ARCHETYPE_COLORS[id]}` },
    showAction ? h('b', { class:'archetype-guide-name' }, a.name) : null,
    showAction ? h('p', { class:'archetype-guide-action' }, a.action) : null,
    row('计数：', a.resource), row('留意：', a.cost),
    archetypeRules[id] ? h('p',{class:'archetype-rule-note'},archetypeRules[id]) : null);
}
export const cardIdentity = (id: string) => { const d=card(id); return identityName(d); };

export interface EconomyUsage { generatedGold?:number; generatedSpells?:number; generatedRations?:number }
/** 卡片与本局面板共用经营产出说明，数值表示全队本回合用量。 */
export function economyLimits(usage?: EconomyUsage) {
  const items = [ ['额外金币',4,usage?.generatedGold ?? 0], ['临时法术',2,usage?.generatedSpells ?? 0], ['免费口粮',2,usage?.generatedRations ?? 0] ] as const;
  return h('section',{class:'run-economy-limits', 'aria-label':'全队本回合额外产出'},
    h('b',null, usage ? '本回合还可获得' : '全队每回合最多'),
    h('div',{class:'economy-remaining'}, ...items.map(([name,max,used]) => h('span',null, `${name} ${usage ? Math.max(0,max-used) : max}${name === '额外金币' ? ' 金' : name === '临时法术' ? ' 张' : ' 份'}`))));
}
