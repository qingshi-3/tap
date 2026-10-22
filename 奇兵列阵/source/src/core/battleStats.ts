/** 玩家侧单场统计；伤害仅计对敌实际扣血，不含溢出、自伤与疲劳。 */
export interface BattleMetrics {
  singleHit: number;
  /** 普攻与其溅射的实际对敌扣血，不含反伤、施法或灼烧。 */
  attackDamage: number;
  /** 单位施法自身 dmg 与主将直接技能的有效伤害，不含后续触发、灼烧和召唤物。 */
  spellDamage: number;
  burnDamage: number;
  /** 敌方实际因冻结跳过出手的次数。 */
  freezes: number;
  /** 友方格挡与护甲抵消的伤害；不含其他减伤。 */
  mitigated: number;
  healing: number;
  /** 友方实际消耗的格挡层数。 */
  blocks: number;
  /** 敌方普攻被我方嘲讽改选的次数。 */
  taunts: number;
  revives: number;
  summons: number;
  sacrifices: number;
  /** 未被冻结阻止的追击次数。 */
  extraActions: number;
  /** 实际执行的单位施法次数，含再次施法。 */
  casts: number;
  /** 对敌致死伤害次数；复生后的再次击杀可再次计数。 */
  kills: number;
  thornsDamage: number;
  splashDamage: number;
  /** 我方亡语触发次数（触发两次计 2）。 */
  rattles: number;
  /** 我方蓄力技释放次数。 */
  charges: number;
  /** 我方轮换、换位次数。 */
  rotations: number;
  /** 我方击败对手次数。 */
  duelKills: number;
}

export const emptyBattleMetrics = (): BattleMetrics => ({
  singleHit: 0, attackDamage: 0, spellDamage: 0, burnDamage: 0, freezes: 0, mitigated: 0,
  healing: 0, blocks: 0, taunts: 0, revives: 0, summons: 0, sacrifices: 0,
  extraActions: 0, casts: 0, kills: 0, thornsDamage: 0, splashDamage: 0, rattles: 0, charges: 0, rotations: 0, duelKills: 0,
});
