import { PLAYER_DECK_SIZE, MAX_CARD_COPIES } from './battle-deck.js';
import { HAND_LIMIT } from './hand-rules.js';
import { cardKeywords } from './card-keywords.js';

const DRAW_RULE_LABELS = new Set(['试炼', '出牌', '补给', '牌组', '起手', '换牌', '抽牌', '疲劳']);

// Fixed mechanics share the card glossary; variable bonuses follow each card's value.
function battleKeywordEntries() {
  const shared = ['provoke', 'rush', 'airdrop', 'flying', 'backstab', 'rebirth', 'stun', 'wall'];
  const entries = shared.map(key => {
    const entry = cardKeywords({ [key]: true }).find(item => item.id === key);
    return [key === 'backstab' ? '背刺' : entry.label, entry.explanation];
  });
  entries.splice(5, 0, ['成长', '己方回合开始时，永久增加攻击与生命；增加值见卡牌。']);
  entries.push(
    ['护主', '邻近己方主将时获得卡牌注明的攻击加成；护主回复在己方回合结束恢复全部生命。'],
    ['潜入', '进入敌方半场时获得卡牌注明的攻击加成；中央列不算敌方半场。'],
    ['远程', '可攻击卡牌注明射程内的敌人；身边有敌方嘲讽时必须先攻击嘲讽。'],
    ['爆破', '攻击同排或同列敌人，并伤害该方向射程内的其他敌人；相邻嘲讽优先。'],
    ['施法成长', cardKeywords({ spellWatch: true }).find(item => item.id === 'spellWatch').explanation],
    ['死亡成长', cardKeywords({ deathWatch: true }).find(item => item.id === 'deathWatch').explanation],
  );
  return entries;
}

export function battleRuleSections(match = null) {
  const entries = battleRuleEntries(match);
  return [
    { id: 'keywords', label: '战斗词条', entries: battleKeywordEntries() },
    { id: 'draw', label: '通用抽卡', entries: entries.filter(([label]) => DRAW_RULE_LABELS.has(label)) },
    { id: 'tactics', label: '战斗技巧', entries: entries.filter(([label]) => !DRAW_RULE_LABELS.has(label)) },
  ];
}

// Help follows the battle being resumed; older saves retain their original rules.
export function battleRuleEntries(match = null) {
  const actionRules = [
    ['召唤', '将随从牌的指示线拖到友军相邻的空格，松手召唤。空投可选择任意空格。新随从通常要等下回合才能行动。'],
    ['行动', '每个单位通常每回合可移动一次、攻击一次。拖到空格移动；选中己方后，点击范围内敌人攻击。点击空白或无效目标收起范围。'],
    ['射程', '卡牌右上角表示攻击距离，斜向相邻也算1格。∞表示不限制距离；爆破只能攻击同排或同列。'],
    ['反击', '目标受击后存活，且能攻击到攻击者时，才会反击。背刺等特殊效果按卡牌说明执行。'],
    ['技能', '主将技能每回合可用一次，使用时消耗法力；不算施放法术。'],
    ['查看', '长按手牌或场上单位查看能力，敌军也可以查看。'],
    ['相邻', '相邻、附近均包含周围八格，包括斜方向。'],
    ['选格', '自动召唤按从上到下、从左到右选择空格，没有合适空格时不召唤。卡牌另有说明时按卡牌效果执行。'],
    ['被动', '主将被动的“每回合首次”在己方回合开始重置，敌方回合也可触发。'],
  ];
  if (match?.mode === 'challenge') return [
    ['试炼', '使用本关提供的单位、手牌和法力。胜利条件与回合限制见本局目标。'],
    ...actionRules,
  ];
  if (match?.campaignSupply) return [
    ['出牌', '本局每张牌有固定使用次数，使用时消耗法力。'],
    ['补给', '回合不会自动抽牌。抽牌效果消耗1点补给，恢复第一张尚未补满的牌1次使用次数。'],
    ...actionRules,
  ];
  if (match && ![6, 7].includes(match.schemaVersion)) return [
    ['抽牌', `回合开始抽1张牌。手牌上限${HAND_LIMIT}张，满手时暂停抽牌。${match.mode === 'expedition' ? '牌库为空时不再抽牌。' : '牌库为空时，每次抽牌使主将受到1点伤害。'}`],
    ...actionRules,
  ];
  const rules = match?.deckRules?.[0] ?? { openingHandSize: 5, drawPerTurn: 1, handLimit: HAND_LIMIT, fatigueDamage: 1, replacePerTurn: 1 };
  return [
    ['牌组', `${PLAYER_DECK_SIZE}张牌，同一张最多${MAX_CARD_COPIES}张。可使用本阵营和中立卡牌。`],
    ['起手', `抽${rules.openingHandSize}张牌，可选择最多2张替换。`],
    ['换牌', `每回合可换${rules.replacePerTurn}张手牌，换下的牌放回牌库。牌库为空时不能换牌。`],
    ['抽牌', `己方回合结束抽${rules.drawPerTurn}张。手牌最多${rules.handLimit}张，满手时新抽到的牌会被弃掉。`],
    ['疲劳', !match || match.fatigueVersion === 1
      ? '牌库为空时，首次抽牌受到1点疲劳伤害，此后每次抽空增加1点（1、2、3……）。同回合额外抽牌也递增，双方分别累计，无法减免。用过的牌不会自动回到牌库。'
      : `用过的牌不会自动回到牌库。牌库为空后，每次抽牌使主将受到${rules.fatigueDamage}点伤害，无法减免。`],
    ...actionRules,
  ];
}

export function battleObjectiveCopy(match, level) {
  if (match.objective?.type === 'survive') return {
    goal: `存活${match.objective.rounds}回合`, limit: '己方主将阵亡即失败',
  };
  const enemies = match.players.filter(player => player.id !== 0).length;
  return {
    goal: enemies > 1 ? '击败所有敌方主将' : '击败敌方主将',
    limit: `${level && match.turnLimit ? `${match.turnLimit === 1 ? '本回合' : `${match.turnLimit}回合`}内完成；` : ''}己方主将阵亡即失败`,
  };
}
