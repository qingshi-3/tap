export const SKILL_DEFINITIONS = Object.freeze({
  dash: Object.freeze({ id: 'dash', name: '风行突进', description: '化作疾风向前突进，穿过敌阵并避开包围。', cooldown: 5, aimType: 'dash', jobs: Object.freeze(['fighter', 'blade_master', 'swift_blade']), level: 1 }),
  cleave: Object.freeze({ id: 'cleave', name: '裂空斩', description: '挥出扇形剑气，清扫前方敌群。', cooldown: 8, aimType: 'cone', jobs: Object.freeze(['fighter', 'blade_master', 'swift_blade']), level: 1 }),
  guard: Object.freeze({ id: 'guard', name: '风息守势', description: '获得 3.2 秒守护，受到的伤害降低 60%。', cooldown: 12, aimType: 'self', jobs: Object.freeze(['fighter', 'blade_master', 'swift_blade']), level: 1 }),
  swordField: Object.freeze({ id: 'swordField', name: '剑阵', description: '在指定方向展开剑阵，持续切割范围内的敌人。', cooldown: 18, aimType: 'circle', jobs: Object.freeze(['blade_master']), level: 3 }),
  bladeWave: Object.freeze({ id: 'bladeWave', name: '破空剑潮', description: '向前释放贯穿战线的连续剑气。', cooldown: 10, aimType: 'line', jobs: Object.freeze(['blade_master']), level: 5 }),
  whirlwind: Object.freeze({ id: 'whirlwind', name: '回风乱舞', description: '高速旋斩，将周围敌人卷入风刃。', cooldown: 12, aimType: 'circle', jobs: Object.freeze(['swift_blade']), level: 3 }),
  quickCut: Object.freeze({ id: 'quickCut', name: '瞬身斩', description: '沿直线疾驰并斩击路径上的敌人。', cooldown: 6, aimType: 'dash', jobs: Object.freeze(['swift_blade']), level: 5 }),
});

export const HEROES = Object.freeze([
  Object.freeze({
    id: 'commander', kind: 'hero', name: '风刃指挥官', subtitle: '孤锋远征者',
    description: '独自踏入战场，以连续施放技能唤醒风刃，强化下一轮武器攻势。', color: '#74e6d4',
    skills: Object.freeze([
      Object.freeze({ key: 'Q', id: 'dash', name: SKILL_DEFINITIONS.dash.name, description: SKILL_DEFINITIONS.dash.description }),
      Object.freeze({ key: 'E', id: 'cleave', name: SKILL_DEFINITIONS.cleave.name, description: SKILL_DEFINITIONS.cleave.description }),
      Object.freeze({ key: 'R', id: 'guard', name: SKILL_DEFINITIONS.guard.name, description: SKILL_DEFINITIONS.guard.description }),
    ]),
    passive: '施放任意技能后，短时间强化武器攻击。',
  }),
]);

export const HERO_JOBS = Object.freeze({
  fighter: Object.freeze({ id: 'fighter', name: '战士', tier: 1, description: '攻守均衡的基础职业。' }),
  blade_master: Object.freeze({ id: 'blade_master', name: '剑阵宗师', tier: 2, description: '驾驭剑阵与远程剑潮的进阶职业。' }),
  swift_blade: Object.freeze({ id: 'swift_blade', name: '迅刃', tier: 2, description: '依靠高速位移与旋斩突围的进阶职业。' }),
});

export function getHeroJob(job) { return HERO_JOBS[job] || HERO_JOBS.fighter; }
export function getSelectedHero() { return HEROES[0]; }

// Kept for callers from older builds. The solo campaign has one fixed hero.
export function selectHero(id) {
  return id === HEROES[0].id
    ? { ok: true, message: '风刃指挥官已整装待发。' }
    : { ok: false, message: '当前远征只开放风刃指挥官。' };
}
