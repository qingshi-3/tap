// 奇兵列阵 UI 模块的适配层：把排队骑士的卡牌数据映射成奇兵列阵视觉需要的「阵营」配色等。
// 主标签（引擎）只决定配色，不显示文字在卡面上。
import { card, LINE_INFO, type Line } from '../core/data';

export type Faction = 'light' | 'shadow' | 'abyss' | 'magma' | 'frost' | 'desert' | 'neutral' | 'enemy';
export type Side = 0 | 1;
export type Rarity = 1 | 2 | 3 | 4 | 5 | 6;

export const FACTION_INFO: Record<Faction, { name: string; color: string; dark: string }> = {
  light: { name: LINE_INFO.hurt.name, color: '#ffd36b', dark: '#7a5413' },
  shadow: { name: LINE_INFO.start.name, color: '#ff5f6d', dark: '#6e1622' },
  abyss: { name: LINE_INFO.death.name, color: '#b77bff', dark: '#3d1a6e' },
  magma: { name: LINE_INFO.any.name, color: '#ff9a3d', dark: '#6b2a07' },
  frost: { name: LINE_INFO.food.name, color: '#6fe6ff', dark: '#0e4a63' },
  desert: { name: LINE_INFO.grow.name, color: '#e9bd72', dark: '#745025' },
  neutral: { name: '中立', color: '#cfd6e6', dark: '#3a4255' },
  enemy: { name: '敌军', color: '#ff4b6e', dark: '#3a0b19' },
};
export const LINE_FACTION: Record<Line, Faction> = {
  hurt: 'light', start: 'shadow', death: 'abyss', any: 'magma', food: 'frost', grow: 'desert', enemy: 'enemy',
};
export const RARITY_NAMES: Record<number, string> = { 1: '一阶', 2: '二阶', 3: '三阶', 4: '四阶', 5: '五阶', 6: '六阶' };

export interface ShimDef { id: string; name: string; faction: Faction; tier: Rarity; token: boolean; enemyOnly: boolean; atk: number; hp: number }
export function unitDef(id: string): ShimDef {
  const d = card(id);
  if (!d) return { id, name: '?', faction: 'neutral', tier: 1, token: false, enemyOnly: false, atk: 0, hp: 0 };
  return { id, name: d.name, faction: LINE_FACTION[d.line], tier: d.tier, token: !!d.token, enemyOnly: !!d.enemy, atk: d.atk, hp: d.hp };
}
export const GENERAL_MAP: Record<string, { name: string; faction: Faction }> = {};
export const SLOTS = 5;

/** 词条释义（玩法说明「词条」页与 kwtext 用） */
export const KEYWORDS: Record<string, string> = {
  传承: '最多记录最早吃到的 5 件指定补给；出售时把记录交给最近身后友军，没有则交给最近身前。',
  格挡: '每层完整挡住 1 次伤害。',
  复生: '第一次阵亡时，以 1 血回到队尾。',
  溅射: '交锋时，敌方第 2 位也受到一部分伤害。',
  召唤: '在指定位置放下一个召唤物；队伍满 5 个时召唤失败。',
  施法: '',
};
