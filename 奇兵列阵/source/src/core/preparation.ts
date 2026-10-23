import { EQUIP_MAP } from './content';
import { unitDef, tagFamily } from './data';
import { unitLevel, type Slotted, type PrepEvent } from './types';
import type { RunState } from './run';

/** Frozen 0.8.4 tiers preserve ongoing expedition recruitment after content retiering. */
export const LEGACY_TIERS: Record<string, number> = {"l_shield": 1, "l_martyr": 1, "l_vigil": 1, "l_warden": 1, "l_windblade": 1, "l_priest": 2, "l_knight": 2, "l_lion": 2, "l_archer": 2, "l_mender": 3, "l_banner": 3, "l_cliff": 3, "l_storm": 3, "l_archon": 4, "l_sunriser": 4, "l_caliber": 4, "s_wind": 1, "s_backstab": 1, "s_dancer": 1, "s_fox": 1, "s_step": 1, "s_dart": 2, "s_ninja": 2, "s_monk": 2, "s_viper": 2, "s_hunter": 3, "s_choreo": 3, "s_caster": 3, "s_xyle": 3, "s_master": 4, "s_lord": 4, "s_panda": 4, "a_seed": 1, "a_devour": 1, "a_graveguard": 1, "a_spine": 1, "a_imp": 1, "a_reaper": 2, "a_cult": 2, "a_brood": 2, "a_chanter": 2, "a_ritualist": 3, "a_jugg": 3, "a_engulf": 3, "a_nightmare": 3, "a_matriarch": 4, "a_solus": 4, "a_void": 4, "m_egg": 1, "m_shaman": 1, "m_hide": 1, "m_raptor": 1, "m_whelp": 1, "m_rex": 2, "m_mender": 2, "m_kujata": 2, "m_harvester": 2, "m_incubator": 3, "m_bloodcaller": 3, "m_vindicator": 3, "m_rager": 3, "m_titan": 4, "m_mankator": 4, "m_heart": 4, "v_guard": 1, "v_wall": 1, "v_scout": 1, "v_chaser": 1, "v_snowman": 1, "v_mage": 2, "v_shard": 2, "v_sentinel": 2, "v_rhyno": 2, "v_conduit": 3, "v_keeper": 3, "v_drake": 3, "v_bear": 3, "v_queen": 4, "v_wyvern": 4, "v_stag": 4, "d_sentry": 1, "d_dune": 1, "d_artificer": 1, "d_howler": 1, "d_goldob": 1, "d_keeper": 2, "d_obelisk": 2, "d_glass": 2, "d_shriek": 2, "d_dunecaster": 3, "d_sandblade": 3, "d_pyro": 3, "d_hourglass": 3, "d_pharaoh": 4, "d_onyx": 4, "d_worm": 4, "n_merc": 1, "n_bulwark": 1, "n_medic": 1, "n_archer": 1, "n_gladiator": 1, "n_obelisk": 2, "n_breaker": 2, "n_thorn": 2, "n_envoy": 2, "n_tether": 2, "n_ritualist": 3, "n_echo": 3, "n_marshal": 3, "n_alchemist": 3, "n_colossus": 4, "n_paragon": 4};
export const modernEconomy = (r: RunState) => r.economyVersion === 2;

/** Events are committed only after successful transactions. Sources on the bench cannot run ally engines. */
export function prepEvent(r: RunState, event: PrepEvent, subject?: Slotted, eventSlot?: number) {
  if (r.tutorialMode) return;
  const field = r.slots.filter((u): u is Slotted => !!u);
  const sources = [...field];
  if (subject && !sources.includes(subject)) sources.push(subject);
  r.prepUses ??= {};
  for (const src of sources) {
    for (const [index, fx] of (unitDef(src.defId).prep ?? []).entries()) {
      if (fx.event !== event || (fx.scope === 'self' ? src !== subject && event !== 'endPrep' : !field.includes(src) || src === subject)) continue;
      if (fx.tag && (!subject || !matchesPreparationTag(subject.defId, fx.tag))) continue;
      const key = `${src.ownedId}:${index}`;
      if ((r.prepUses[key] ?? 0) >= (fx.cap ?? 1)) continue;
      const eligible = (u: Slotted) => !fx.targetTag || matchesPreparationTag(u.defId, fx.targetTag);
      const others = field.filter(u => u !== src && eligible(u));
      const at = src === subject && eventSlot !== undefined ? eventSlot : r.slots.indexOf(src);
      let targets: Slotted[];
      switch (fx.target) {
        case 'self': targets = [src]; break;
        case 'event': targets = subject ? [subject] : []; break;
        case 'front': targets = field.slice(0, 1); break;
        case 'rear': targets = field.slice(-1); break;
        case 'others': targets = others; break;
        case 'adjacent': targets = at < 0 ? [] : [r.slots[at-1],r.slots[at+1]].filter((u): u is Slotted => !!u); break;
        default: {
          const stat = fx.target === 'lowestAtk' ? 'atk' : 'hp';
          targets = [...others].sort((a,b) => preparationStat(a, stat) - preparationStat(b, stat)).slice(0,1);
        }
      }
      // Filter positional targets after selection; ranked targets were filtered before sorting.
      if (fx.targetTag) targets = targets.filter(eligible);
      if (!targets.length) continue;
      r.prepUses[key] = (r.prepUses[key] ?? 0) + 1;
      const level = unitLevel(src)-1;
      for (const target of targets) {
        target.growth ??= {};
        for (const stat of ['atk','hp','power'] as const) if (fx[stat]) target.growth[stat] = (target.growth[stat] ?? 0) + fx[stat]![level];
      }
    }
  }
}
/** Net refundable investments are observed once, at preparation commitment. */
export function commitPreparation(r: RunState) {
  if (r.tutorialMode || r.prepCommitted) return;
  const ids = new Set(r.allocLog.map(e => e.to).filter((id): id is number => typeof id === 'number'));
  for (const id of ids) {
    const subject = [...r.slots,...r.bench].find(u => u?.ownedId === id);
    if (subject) prepEvent(r, 'train', subject);
  }
  prepEvent(r, 'endPrep');
  r.prepCommitted = true;
}

/** Same persistent panel formula as battle outfit, without importing the battle engine. */
export function preparationStat(u: Slotted, stat: 'atk' | 'hp'): number {
  const d = unitDef(u.defId), up = unitLevel(u)-1;
  const base = stat === 'atk' ? (d.atk === 0 ? 0 : d.atk+up) : d.hp+up*2;
  const trained = (u.train?.[stat] ?? 0) * (stat === 'hp' ? 2 : 1);
  const equipment = (u.equips ?? []).reduce((n,id) => n+(EQUIP_MAP[id]?.[stat] ?? 0),0);
  return base+(u.growth?.[stat] ?? 0)+trained+equipment;
}

/** Re-evaluate only unused event allowances after a successful preparation mutation. */
export function preparationChanged(r: RunState) {
  if (!r.tutorialMode) r.prepCommitted = false;
}

/** Only authored spell effects that receive positive power; excludes raw attack, freeze and summon. */
export function benefitsFromSpellPower(defId: string): boolean {
  const d = unitDef(defId);
  return [d.cast,d.chargeSkill].some(es => es?.some(e => ['dmg','heal','burn','chill'].includes(e.op) && e.v?.some(v => v > 0)));
}

/** Benefit filters describe executable effects, not a loosely assigned archetype label. */
export function matchesPreparationTag(defId: string, tag: string): boolean {
  if (tag === '法术受益') return benefitsFromSpellPower(defId);
  if (tag === '寒意法术受益') {
    const d = unitDef(defId);
    return [d.cast, d.chargeSkill].some(es => es?.some(e => e.op === 'chill' && e.v?.some(v => v > 0)));
  }
  return (unitDef(defId).tags ?? []).some(t => t === tag || tagFamily(t) === tag);
}

/** A read-only projection of the exact pending commitment; never writes persistent growth or allowances. */
export function previewPreparation(r: RunState): RunState {
  const projected = JSON.parse(JSON.stringify(r)) as RunState;
  commitPreparation(projected);
  return projected;
}
