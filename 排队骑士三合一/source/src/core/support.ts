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

// 旧 ID 保留原有定义。此清单控制 v5 可用的经典物品，历史阵容与战斗演示仍可按 ID 解析其余定义。
const classics: Record<string, SupportMeta> = {
  f_bread: {}, f_milk: {}, f_lamp: {}, f_drum: {}, f_whet: {}, f_roast: {},
  f_stew: { archetypes:['formation','supply'] }, f_plate: {},
  w_sword: {}, w_mail: {}, iron: {}, shroom: {}, b_buckler: {}, p_thorn: {}, c_rage: {}, o_crown: {}, o_storm: {},
  r_vanguard: {}, r_share: { archetypes:['supply'] }, r_relay: {}, r_reserve: {}, r_runebox: {},
  r_ember: {}, r_motley: {}, r_training: {}, r_medal: {}, r_few: { archetypes:['nest'] },
  r_pouch: { archetypes:['trade'] }, r_brood: { archetypes:['nest'] }, r_heavy: {},
};
export function classicSupport(id: string): SupportMeta {
  if (id.startsWith('x_')) return { role:'utility' };
  return Object.hasOwn(classics, id) ? { role:'utility', ...classics[id] } : { legacy:true };
}
