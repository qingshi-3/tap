// 新目录的公开接口。普通与金色的数值写成一对，敌方三级单位使用金色值。
export type ArchetypeId = 'wheel' | 'charge' | 'ember' | 'nest' | 'blood' | 'trade' | 'rune' | 'pair' | 'hunt' | 'formation' | 'supply';
export type CardRole = 'starter' | 'engine' | 'cover' | 'terminal' | 'bridge' | 'utility';
export type RuleNumber = number | readonly [number, number];
export const ruleNumber = (value: RuleNumber | undefined, level: number): number =>
  typeof value === 'number' ? value : value?.[level > 1 ? 1 : 0] ?? 0;
export const ROLE_NAMES: Record<CardRole, string> = { starter:'启动', engine:'引擎', cover:'补短板', terminal:'终端', bridge:'桥接', utility:'通用' };
export const ARCHETYPES: Record<ArchetypeId, { name: string; action: string; resource: string; cost: string }> = {
  wheel: { name:'车轮', action:'安排骑手轮流成为队首', resource:'圈数', cost:'攻击后退到队尾，由下一人接战' },
  charge: { name:'蓄势', action:'让前排掩护后排炮手蓄能', resource:'炮手个人蓄能', cost:'过早成为队首会提前消耗蓄能' },
  ember: { name:'薪火', action:'把火种放在继承人身前', resource:'继承的攻血和阵亡技能', cost:'继承人过早阵亡会断开传承' },
  nest: { name:'兽巢', action:'留出空位，让幼兽挡在队首', resource:'本场召唤数', cost:'召唤需空位；合巢者可将攻血并入已有小兵' },
  blood: { name:'血契', action:'备战时献血换取金币或成长', resource:'永久生命与当前血量', cost:'献血会永久降低生命' },
  trade: { name:'行商', action:'留出空位，安排单位买卖顺序', resource:'本回合买卖单位总数', cost:'买卖需要金币和队伍空位' },
  rune: { name:'咒印', action:'安排施法顺序，强化友军下次攻击', resource:'本回合施法次数与追加伤害', cost:'法术消耗金币，追加伤害需要出手' },
  pair: { name:'并肩', action:'让同名友军相邻，配合普通与金色单位', resource:'相邻同名对数', cost:'合成金色可腾出位置，也会拆散搭档' },
  hunt: { name:'猎标', action:'根据敌阵预告指定猎物', resource:'可转移的猎标层数', cost:'叠标需要时间，要保护后排猎手' },
  formation: { name:'军阵', action:'保持友军相邻，安排后排分担伤害', resource:'开战时相邻且仍按原顺序相邻的友军对数', cost:'减员或换位会破坏阵型' },
  supply: { name:'补给', action:'喂食补给单位，出售时传承补给记录', resource:'本回合喂食次数与补给记录', cost:'购买补给消耗金币' },
};
export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

export type BattleTrigger = 'start' | 'enter' | 'afterAttack' | 'clashEnd' | 'faint' | 'allyFaint' | 'summon' | 'hurt' | 'move' | 'released' | 'inherited';
export type BattleTarget = 'self' | 'front' | 'ahead' | 'behind' | 'neighbors' | 'team' | 'event' | 'enemyFront' | 'enemyLast' | 'enemies' | 'quarry' | 'partner';
export type BattleEffect = 'buff' | 'block' | 'damage' | 'rotate' | 'charge' | 'release' | 'inherit' | 'summon' | 'coalesce' | 'mark' | 'detonate' | 'guard' | 'share' | 'pairEcho' | 'survive';
export type BattleCondition = 'rear' | 'front' | 'half' | 'critical' | 'paired' | 'stationary' | 'token';
export type BattleScale = 'laps' | 'legion' | 'pairs' | 'edges' | 'missingHp' | 'gold' | 'spells' | 'marks' | 'attackPct' | 'healthPct';
export interface BattleRule {
  phase:'battle'; on:BattleTrigger; effect:BattleEffect; target:BattleTarget;
  n:RuleNumber; hp?:RuleNumber; scale?:BattleScale; when?:BattleCondition;
  /** 每名持有者、每场独立计数。符合条件的第 every 次事件触发，至多 limit 次。 */
  limit?:number; every?:number;
}
export type PrepTrigger = 'ownBuy' | 'ownSell' | 'buy' | 'sell' | 'food' | 'spell' | 'turnStart' | 'turnEnd' | 'bloodPay';
export type PrepTarget = 'self' | 'event' | 'front' | 'ahead' | 'behind' | 'neighbors' | 'team';
export type PrepEffect = 'buff' | 'block' | 'gold' | 'spell' | 'ration' | 'seal';
export interface PrepRule {
  phase:'prep'; on:PrepTrigger; effect:PrepEffect; target:PrepTarget;
  n:RuleNumber; hp?:RuleNumber; scale?:'trades'|'spells'|'meals';
  when?:'selfEvent'|'otherEvent'; limit?:number; every?:number;
  /** 仅在整回合指定的事件序号生效，例如第二、第四次施法。 */
  at?:readonly number[];
}
export type ReworkRule = BattleRule | PrepRule;
