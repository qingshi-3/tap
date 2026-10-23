import type { BattleRule, BattleRuleEffect } from './types';

const signed = (n: number) => n >= 0 ? `+${n}` : String(n);
const effectText = (e: BattleRuleEffect, rule: BattleRule): string => {
  const targets = { allies: rule.side === 1 ? '敌军全体' : '我军全体', source: '来源单位', recalled: '召回的随从' };
  switch (e.op) {
    case 'buff': return `${targets[e.to]}攻击${signed(e.atk)}${e.hp ? `、生命${signed(e.hp)}` : ''}`;
    case 'block': return `${targets[e.to]}获得${e.amount}层格挡`;
    case 'recall': return `阵亡随从以${Math.round(e.hpRatio * 100)}%生命召回`;
    case 'chillHighestAttack': return '对方最高攻单位获得等同其攻击的寒意';
    case 'pullRearToFront': return `拉对方队尾到队首${e.oncePerTarget ? '，每单位限一次' : ''}`;
  }
};

/** 关卡提示直接读取规则参数，调数值时无需另维护一份描述。 */
export function encounterRuleText(rules: readonly BattleRule[]): string {
  return rules.map(rule => {
    const trigger = rule.trigger;
    const when = trigger.on === 'beatEnd'
      ? `${rule.source ? '首领存活时，' : ''}每${trigger.every}次交锋`
      : trigger.on === 'hpBelow' ? `生命低于${Math.round(trigger.ratio * 100)}%时，` : '';
    const limit = rule.maxTriggers !== undefined ? `（最多${rule.maxTriggers}次）` : '';
    return `关卡：${when}${rule.effects.map(e => effectText(e, rule)).join('，')}${limit}`;
  }).join('；');
}
