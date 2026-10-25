/** 直接触发伤害的来源。属性加成和交锋伤害倍率保留在普通交锋，不反推增益贡献。 */
export type DamageSourceKind = 'attack' | 'skill' | 'equipment' | 'supply' | 'relic' | 'summon';
export interface DamageSourceStat { kind: DamageSourceKind; label: string; damage: number }
export interface UnitBattleStats {
  /** 初始单位的 uid；独立遗物行使用负数。复生和后代召唤物并入此行。 */
  uid: number;
  def: string;
  lvl: 1 | 2 | 3;
  side: 0 | 1;
  oid?: number;
  label: string;
  kind: 'unit' | 'relic';
  summoned: boolean;
  ownerUid: number | null;
  runtimeUids: number[];
  summons: number;
  revives: number;
  /** 敌方实际生命损失 + 护盾吸收，排除过量、自伤、友伤和格挡免除。 */
  damageDealt: number;
  damageTaken: number;
  kills: number;
  /** 敌方有效发起的伤害次数，含格挡、护盾和灼烧整次跳伤。 */
  hitsTaken: number;
  /** 仅格挡层数免伤；护盾全吸收不计为格挡。 */
  blockedHits: number;
  shieldAbsorbed: number;
  selfDamage: number;
  friendlyDamageTaken: number;
  damageBySource: DamageSourceStat[];
}
export interface BattleStats { units: UnitBattleStats[] }
export interface StatsUnit { uid: number; def: string; lvl: 1 | 2 | 3; side: 0 | 1; oid?: number }
export interface BattleDamageSource { uid: number | null; side: 0 | 1; kind: DamageSourceKind; label: string; relicId?: string }
export interface DamageContribution { source: BattleDamageSource; amount: number }
interface RuntimeEntry { row: UnitBattleStats; summoned: boolean; label: string }

/** 只观察引擎已完成的结算，不改写单位、随机数、规则事件或击杀反应队列。 */
export class BattleStatsCollector {
  private readonly units: UnitBattleStats[] = [];
  private readonly runtime = new Map<number, RuntimeEntry>();
  private readonly relics = new Map<string, UnitBattleStats>();
  register(u: StatsUnit, label: string, parentUid: number | null = null, revive = false) {
    const parent = parentUid === null ? undefined : this.runtime.get(parentUid);
    if (parent) {
      parent.row.runtimeUids.push(u.uid);
      if (revive) parent.row.revives++;
      else parent.row.summons++;
      this.runtime.set(u.uid, { row: parent.row, summoned: revive ? parent.summoned : true, label });
      return;
    }
    const row = this.makeRow(u, label, 'unit');
    row.summoned = parentUid !== null;
    row.ownerUid = parentUid;
    this.units.push(row);
    this.runtime.set(u.uid, { row, summoned: row.summoned, label });
  }
  private makeRow(u: StatsUnit, label: string, kind: UnitBattleStats['kind']): UnitBattleStats {
    return { ...u, label, kind, summoned: false, ownerUid: null, runtimeUids: kind === 'unit' ? [u.uid] : [], summons: 0, revives: 0,
      damageDealt: 0, damageTaken: 0, kills: 0, hitsTaken: 0, blockedHits: 0, shieldAbsorbed: 0, selfDamage: 0, friendlyDamageTaken: 0, damageBySource: [] };
  }
  private sourceRow(s: BattleDamageSource): UnitBattleStats | undefined {
    if (s.relicId) {
      const key = `${s.side}:${s.relicId}`;
      let row = this.relics.get(key);
      if (!row) {
        row = this.makeRow({ uid: -(this.relics.size + 1), side: s.side, def: s.relicId, lvl: 1 }, s.label, 'relic');
        this.relics.set(key, row);
        this.units.push(row);
      }
      return row;
    }
    return s.uid === null ? undefined : this.runtime.get(s.uid)?.row;
  }
  /** contributions 顺序即伤害归属顺序；灼烧每层 2 点按施加先后消耗有效伤害。 */
  hit(tgt: StatsUnit, contributions: DamageContribution[], hpLoss: number, shield: number, blocked: boolean, killed: boolean) {
    const target = this.runtime.get(tgt.uid)?.row;
    if (!target) return;
    const hostile = contributions.some(({ source }) => source.side !== tgt.side);
    if (hostile) {
      target.hitsTaken++;
      if (blocked) target.blockedHits++;
    }
    let remaining = Math.max(0, hpLoss) + Math.max(0, shield);
    let shieldRemaining = Math.max(0, shield);
    let killer: UnitBattleStats | undefined;
    for (const { source, amount } of contributions) {
      const effective = Math.min(remaining, Math.max(0, amount));
      const absorbed = Math.min(shieldRemaining, effective);
      remaining -= effective;
      shieldRemaining -= absorbed;
      if (source.side === tgt.side) {
        if (source.uid === tgt.uid) target.selfDamage += effective;
        else target.friendlyDamageTaken += effective;
        continue;
      }
      target.damageTaken += effective;
      target.shieldAbsorbed += absorbed;
      const row = this.sourceRow(source);
      if (!row || effective <= 0) continue;
      row.damageDealt += effective;
      const runtime = source.uid === null ? undefined : this.runtime.get(source.uid);
      const kind = !source.relicId && runtime?.summoned ? 'summon' : source.kind;
      const label = kind === 'summon' ? `召唤物·${runtime!.label}·${source.label}` : source.label;
      let segment = row.damageBySource.find((x) => x.kind === kind && x.label === label);
      if (!segment) { segment = { kind, label, damage: 0 }; row.damageBySource.push(segment); }
      segment.damage += effective;
      killer = row;
    }
    if (killed && killer) killer.kills++;
  }
  finish(): BattleStats {
    return { units: this.units.map((u) => ({ ...u, runtimeUids: [...u.runtimeUids], damageBySource: u.damageBySource.map((s) => ({ ...s })) })) };
  }
}
