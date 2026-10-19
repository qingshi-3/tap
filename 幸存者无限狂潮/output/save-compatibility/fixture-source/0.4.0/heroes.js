export const HEROES = Object.freeze([
  Object.freeze({
    id: 'commander', kind: 'hero', name: '风刃指挥官', subtitle: '孤锋远征者',
    description: '独自踏入战场，以连续施放技能唤醒风刃，强化下一轮武器攻势。', color: '#74e6d4',
    skills: Object.freeze([
      Object.freeze({ key: 'Q', name: '风行突进', description: '化作疾风向前突进，穿过敌阵并避开包围。' }),
      Object.freeze({ key: 'E', name: '裂空斩', description: '挥出贯穿战线的剑气，清扫前方敌群。' }),
      Object.freeze({ key: 'R', name: '剑阵', description: '展开环身剑阵，持续切割逼近的敌人。' }),
    ]),
    passive: '施放任意技能后，短时间强化武器攻击。',
  }),
]);

export function getSelectedHero() { return HEROES[0]; }

// Kept for callers from older builds. The solo campaign has one fixed hero.
export function selectHero(id) {
  return id === HEROES[0].id
    ? { ok: true, message: '风刃指挥官已整装待发。' }
    : { ok: false, message: '当前远征只开放风刃指挥官。' };
}
