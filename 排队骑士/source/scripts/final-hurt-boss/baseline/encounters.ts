import { card } from './data';
import type { UnitSpec } from './engine';

export type EncounterForm = 'tank' | 'summon' | 'carry' | 'snipe' | 'boom' | 'wall' | 'rush' | 'mixed';
export interface AuthoredEncounter { key: string; name: string; hint: string; form: EncounterForm; units: UnitSpec[] }
interface Template { key: string; name: string; hint: string; form: EncounterForm; defs: readonly string[]; weights: readonly number[] }

const MID: readonly Template[] = [
  { key: 'hurt-mid', name: '伤痕熔炉', hint: '前排刺激全队受伤技能，风暴剑圣会越打越强。', form: 'tank', defs: ['l_windblade','l_vigil','l_warden','l_storm','l_caliber'], weights: [25,18,18,24,15] },
  { key: 'summon-mid', name: '亡者兽潮', hint: '前排阵亡不断召唤，后排把新单位放大。', form: 'summon', defs: ['a_chanter','m_rex','m_mankator','m_bloodcaller','a_engulf'], weights: [20,20,20,20,20] },
  { key: 'wall-mid', name: '铁幕追击', hint: '格挡拖住队首，影舞者跟随前排连续追击。', form: 'wall', defs: ['a_chanter','l_shield','s_dancer','a_ritualist','s_hunter'], weights: [20,28,20,18,14] },
  { key: 'rush-mid', name: '破阵先锋', hint: '开战点杀与前排放大同时启动，前两次交锋压力最高。', form: 'rush', defs: ['l_knight','s_step','s_dancer','s_hunter','s_viper'], weights: [28,23,20,15,14] },
];
const LATE: readonly Template[] = [
  { key: 'hurt-late', name: '伤痕共鸣', hint: '队首启动受伤链，黑沙巨虫把每次受伤放大到全队。', form: 'tank', defs: ['l_windblade','l_vigil','l_warden','l_storm','d_worm'], weights: [22,16,18,24,20] },
  { key: 'summon-late', name: '火山兽潮', hint: '多个亡语召唤源会同时激活巫兽与火山之心。', form: 'summon', defs: ['m_rex','m_mankator','a_matriarch','m_bloodcaller','m_heart'], weights: [20,20,16,22,22] },
  { key: 'snipe-late', name: '岚影点杀', hint: '宗师压血、刺客切后，执政官让宗主的开战技再放一次。', form: 'snipe', defs: ['a_chanter','s_master','s_viper','s_lord','l_archon'], weights: [28,15,17,25,15] },
  { key: 'boom-late', name: '深渊交接', hint: '前排阵亡留下保护与增益，吞噬之影会在后排持续成长。', form: 'boom', defs: ['a_graveguard','a_chanter','a_nightmare','a_engulf','a_matriarch'], weights: [14,14,18,29,25] },
];

function allocate(total: number, weights: readonly number[], lo: number, hi: number): number[] {
  const out = weights.map(() => lo);
  let left = total - lo * weights.length;
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => left * w / weightSum);
  for (let i = 0; i < out.length; i++) { const add = Math.min(hi - lo, Math.floor(raw[i])); out[i] += add; left -= add; }
  const order = weights.map((_, i) => i).sort((a, b) => raw[b] % 1 - raw[a] % 1 || a - b);
  while (left > 0) { let moved = false; for (const i of order) if (out[i] < hi && left > 0) { out[i]++; left--; moved = true; } if (!moved) break; }
  return out;
}

function build(t: Template, turn: number, budget: number): AuthoredEncounter {
  const total = Math.max(10, Math.min(500, Math.round(budget)));
  const totals = allocate(total, t.weights, 2, 100);
  const lvl: 1 | 2 = turn >= 17 ? 2 : 1;
  const units = t.defs.map((def, i): UnitSpec => {
    const d = card(def), n = totals[i];
    let atk = Math.max(1, Math.min(50, Math.round(n * d.atk / Math.max(1, d.atk + d.hp))));
    let hp = n - atk;
    if (hp < 1) { hp = 1; atk = n - 1; } else if (hp > 50) { hp = 50; atk = n - 50; }
    return { def, lvl, atk, hp };
  });
  return { key: t.key, name: t.name, hint: t.hint, form: t.form, units };
}

/** T9+的预设敌群；站位是套路的一部分，调用方不应再交给 tidyTeam。 */
export function authoredEncounters(turn: number, budget: number): AuthoredEncounter[] {
  if (turn < 9) return [];
  return (turn < 12 ? MID : [...MID, ...LATE]).map((t) => build(t, turn, budget));
}

