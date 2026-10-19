import { describe, expect, it } from 'vitest';
import { ACTIVE_FACTIONS, DRAFT_POOL, FACTION_ORDER, GENERALS, KEYWORDS, RARITY_NAMES, ROUTE, ROUTE_VARIANTS, UNITS, unitDef } from '../src/core/data';
import { CARD_SUMMARY } from '../src/ui/cardSummary';

interface ArtMeta { frames: number; width: number; height: number; image: string; still: string; selectedImage: string }
const manifests = import.meta.glob<{ units: Record<string, ArtMeta> }>('../src/assets/units/manifest.json', { eager: true, import: 'default' });
const art = manifests['../src/assets/units/manifest.json'].units;
const pngs = import.meta.glob('../src/assets/units/*.png');
const CORE_KEYWORDS = ['格挡', '护甲', '复生', '寒意', '灼烧', '溅射', '连击', '狙击', '反击', '法强'];

describe('v0.6 初版卡表', () => {
  it('5 阵营 + 中立各 8 张，品质 3/2/2/1；召唤物、沙域与敌军不进招募池', () => {
    expect(ACTIVE_FACTIONS).toEqual(['light', 'shadow', 'abyss', 'magma', 'frost']);
    expect(FACTION_ORDER).toEqual([...ACTIVE_FACTIONS, 'neutral']);
    expect(RARITY_NAMES).toEqual({ 1: '普通', 2: '稀有', 3: '史诗', 4: '传说' });
    expect(DRAFT_POOL).toHaveLength(48);
    for (const faction of FACTION_ORDER) {
      const cards = DRAFT_POOL.filter(u => u.faction === faction);
      expect([1, 2, 3, 4].map(t => cards.filter(u => u.tier === t).length), faction).toEqual([3, 2, 2, 1]);
    }
    expect(DRAFT_POOL.some(u => u.token || u.enemyOnly || u.faction === 'desert')).toBe(false);
    expect(new Set(UNITS.map(u => u.id)).size).toBe(UNITS.length);
  });

  it('10 个核心关键词各至少出现在 2 张招募卡上，所有标签都有说明', () => {
    for (const k of CORE_KEYWORDS) expect(DRAFT_POOL.filter(u => u.keywords?.includes(k)).length, k).toBeGreaterThanOrEqual(2);
    for (const card of UNITS) for (const k of card.keywords ?? []) expect(KEYWORDS[k], `${card.id}/${k}`).toBeTruthy();
  });

  it('每星文案完整，且不再出现旧机制用词', () => {
    for (const card of UNITS) {
      const texts = card.starText ?? [card.text];
      for (const t of texts) {
        expect(t, card.id).not.toMatch(/护盾|换位|沉默|指定|开战末|\[\d/);
        expect(t.length, card.id).toBeGreaterThan(1);
      }
    }
    for (const card of DRAFT_POOL) {
      expect(card.starText, card.id).toHaveLength(3);
      expect(CARD_SUMMARY[card.id], card.id).toBeTruthy();
      expect(CARD_SUMMARY[card.id], card.id).not.toMatch(/护盾|换位|沉默|指定/);
    }
    for (const g of GENERALS) expect(g.text).not.toMatch(/护盾|换位|沉默|指定/);
  });

  it('带施法的卡都有施法效果，trigger 与声明字段一致', () => {
    for (const card of DRAFT_POOL) {
      if (card.trigger === 'cast') expect(card.cast?.length, card.id).toBeGreaterThan(0);
      if (card.trigger === 'start') expect(card.onStart?.length, card.id).toBeGreaterThan(0);
      if (card.cast) expect(card.text, card.id).toContain('施法');
    }
  });

  it('5 名将军，各对应一个启用阵营', () => {
    expect(GENERALS.map(g => g.faction).sort()).toEqual([...ACTIVE_FACTIONS].sort());
  });

  it('路线 10 关（前 4 关教学）与变体均为 5 格合法配置', () => {
    expect(ROUTE).toHaveLength(10);
    expect(ROUTE.map(n => n.kind)).toEqual(['normal', 'normal', 'normal', 'normal', 'normal', 'elite', 'normal', 'normal', 'elite', 'boss']);
    expect(ROUTE.slice(0, 4).map(n => n.name)).toEqual(['轮转出手', '盾卫', '石魔', '霜咒者']);
    expect(Object.keys(ROUTE_VARIANTS).map(Number)).toEqual([6, 7, 8]);
    for (const node of [...ROUTE, ...Object.values(ROUTE_VARIANTS)]) {
      expect(node.lineup, node.name).toHaveLength(5);
      expect(node.hint, node.name).toBeTruthy();
      for (const entry of node.lineup) if (entry) {
        expect(unitDef(entry.defId)).toBeTruthy();
        expect(entry.level ?? 1).toBeGreaterThanOrEqual(1);
        expect(entry.level ?? 1).toBeLessThanOrEqual(3);
        expect(entry.hp ?? unitDef(entry.defId).hp).toBeGreaterThan(0);
      }
    }
    expect(ROUTE[9].lineup[0]?.defId).toBe('e_void');
  });

  it('所有单位与将军都有美术，三张运行 PNG 齐全', () => {
    for (const id of [...UNITS.map(u => u.id), ...GENERALS.map(g => `general_${g.id}`)]) {
      const item = art[id];
      expect(item, id).toBeDefined();
      expect([item.width, item.height], id).toEqual([100, 112]);
      expect(item.frames, id).toBeGreaterThan(0);
      for (const file of [item.image, item.still, item.selectedImage]) expect(pngs[`../src/assets/units/${file}`], file).toBeDefined();
    }
  });
});
