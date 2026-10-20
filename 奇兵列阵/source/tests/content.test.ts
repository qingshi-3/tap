import { describe, expect, it } from 'vitest';
import { ACTIVE_FACTIONS, DRAFT_POOL, FACTION_ORDER, GENERALS, KEYWORDS, RARITY_NAMES, UNITS, unitDef } from '../src/core/data';
import { chapter, CHAPTER_COUNT, TOTAL_BATTLES } from '../src/core/route';
import { CARD_SUMMARY } from '../src/ui/cardSummary';

interface ArtMeta { frames: number; width: number; height: number; image: string; still: string; selectedImage: string }
const manifests = import.meta.glob<{ units: Record<string, ArtMeta> }>('../src/assets/units/manifest.json', { eager: true, import: 'default' });
const art = manifests['../src/assets/units/manifest.json'].units;
const pngs = import.meta.glob('../src/assets/units/*.png');
const CORE_KEYWORDS = ['格挡', '护甲', '复生', '寒意', '灼烧', '溅射', '连击', '狙击', '反击', '法强'];

describe('当前远征内容契约', () => {
  it('六阵营与中立均可招募，召唤物和敌军不会混入', () => {
    expect(ACTIVE_FACTIONS).toEqual(['light', 'shadow', 'abyss', 'magma', 'frost', 'desert']);
    expect(FACTION_ORDER).toEqual([...ACTIVE_FACTIONS, 'neutral']);
    expect(RARITY_NAMES).toEqual({ 1: '普通', 2: '稀有', 3: '史诗', 4: '传说' });
    for (const faction of FACTION_ORDER) {
      const cards = DRAFT_POOL.filter(u => u.faction === faction);
      for (const tier of [1, 2, 3, 4]) expect(cards.some(u => u.tier === tier), `${faction}/${tier}`).toBe(true);
    }
    expect(DRAFT_POOL.some(u => u.token || u.enemyOnly)).toBe(false);
    for (const id of ['n_envoy', 'n_ritualist']) expect(DRAFT_POOL.find(u => u.id === id)?.faction).toBe('neutral');
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

  it('六阵营与中立各有可用主将', () => {
    expect(GENERALS.map(g => g.faction).sort()).toEqual([...FACTION_ORDER].sort());
  });

  it('三章21战含分岔和变体均为合法五格敌阵', () => {
    expect(CHAPTER_COUNT).toBe(3);
    expect(TOTAL_BATTLES).toBe(21);
    const stages = Array.from({ length: CHAPTER_COUNT }, (_, i) => chapter(i).stages).flat();
    const nodes = stages.flatMap(s => s.type === 'shop' ? [] : s.type === 'fork' ? [s.elite, s.normal] : s.type === 'battle' && s.variant ? [s.main, s.variant] : [s.main]);
    expect(stages.filter(s => s.type === 'boss')).toHaveLength(CHAPTER_COUNT);
    for (const node of nodes) {
      expect(node.lineup, node.name).toHaveLength(5);
      expect(node.hint, node.name).toBeTruthy();
      for (const entry of node.lineup) if (entry) {
        expect(unitDef(entry.defId)).toBeTruthy();
        expect(entry.level ?? 1).toBeGreaterThanOrEqual(1);
        expect(entry.level ?? 1).toBeLessThanOrEqual(3);
        expect(entry.hp ?? unitDef(entry.defId).hp).toBeGreaterThan(0);
      }
    }
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
