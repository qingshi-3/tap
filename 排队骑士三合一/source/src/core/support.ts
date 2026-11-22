import type { ArchetypeId, CardRole } from './archetypes';

export interface SupportMeta {
  archetypes?: readonly ArchetypeId[];
  role?: CardRole;
  legacy?: boolean;
}
export interface FoodResources {
  charge?: number;
  seal?: number;
  block?: number;
  wounds?: number;
}
export function supportAvailable(item: SupportMeta, open: readonly ArchetypeId[]): boolean {
  return !item.legacy && (!item.archetypes?.length || item.archetypes.some(id => open.includes(id)));
}
/** 已持有的道具（存档里的背包、货架、手牌、单位身上）：已下架的照常有效，只是不再新出现 */
export function supportHeld(item: SupportMeta, open: readonly ArchetypeId[]): boolean {
  return !!item.legacy || supportAvailable(item, open);
}

// 旧 ID 保留原有定义。此清单控制 v5 可用的经典物品，历史阵容与战斗演示仍可按 ID 解析其余定义。
// 2026-11-16 重新分工（SUPPORT-REVIEW.md）：磨刀石、烤全羊、白色数值装备下架；恢复 8 个单原子白装、5 件双原子紫装、贯日之枪、不灭圣杯。
const classics: Record<string, SupportMeta> = {
  f_bread: {}, f_milk: {}, f_lamp: {}, f_drum: {},
  f_stew: { archetypes:['formation','supply'] }, f_plate: {},
  b_axe: {}, b_scythe: {}, b_banner: {}, b_lance: {}, b_buckler: {}, b_torch: {}, b_horn: {}, b_spur: {},
  shroom: {}, p_thorn: {}, p_reaver: {}, p_phoenix: {}, p_inferno: {}, p_berserk: {}, p_bulwark: {}, c_rage: {},
  o_crown: {}, o_storm: {}, o_spear: {}, o_grail: {},
  r_vanguard: {}, r_share: { archetypes:['supply'] }, r_relay: {}, r_reserve: {}, r_runebox: {},
  r_ember: {}, r_motley: {}, r_training: {}, r_medal: {}, r_few: { archetypes:['nest'] },
  r_pouch: { archetypes:['trade'] }, r_brood: { archetypes:['nest'] }, r_heavy: {},
};
/** 下架的法术：附加能力六张、直接给金币三张、定向搜寻、回响（SUPPORT-REVIEW.md §3）。旧存档里的效果照常结算。 */
const RETIRED_SPELLS = new Set(['x_search', 'x_echo', 'x_coin', 'x_bank', 'x_siphon', 'x_bonepact', 'x_inscribe', 'x_thorn', 'x_sprout', 'x_transfer', 'x_temper']);
export function classicSupport(id: string): SupportMeta {
  if (id.startsWith('x_')) return RETIRED_SPELLS.has(id) ? { role:'utility', legacy:true } : { role:'utility' };
  return Object.hasOwn(classics, id) ? { role:'utility', ...classics[id] } : { legacy:true };
}
