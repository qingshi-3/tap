export const ADVENTURE_REVISION = 1;
export const ADVENTURE_CONTENT_VERSION = "adventure-2026-11-05-v1";
const freeze = (v) => {
  if (v && typeof v === "object") {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
};
const u = (id, name, cost, attack, health, speed, spriteFrom, extra = {}) => ({
  id,
  name,
  type: "unit",
  faction: 0,
  cost,
  attack,
  health,
  speed,
  spriteFrom,
  token: true,
  adventure: true,
  description: "关卡专属单位。",
  ...extra,
});
const g = (id, name, attack, health, sprite) =>
  u(id, name, 0, attack, health, 0, sprite, {
    type: "general",
    anchored: true,
  });
export const ADVENTURE_CARDS = freeze({
  9201: u(9201, "导雷卫", 0, 2, 8, 2, 10207, {
    adventureRole: "conductor",
    description:
      "驻场。连锁放电：1法力，最多4节点，各敌人3伤。引雷吸收敌雷并反射。",
  }),
  9202: u(9202, "棱晶炮", 0, 2, 10, 1, 209, {
    adventureRole: "cannon",
    description: "驻场。贯穿炮：2法力，正交7格各6伤；2充能过载为10伤。",
  }),
  9203: u(9203, "重力使", 0, 2, 8, 2, 10982, {
    adventureRole: "gravity",
    description: "驻场。引力井：2法力，4格内选择中心，半径2牵引两轮。",
  }),
  9204: u(9204, "坠星使", 0, 1, 8, 2, 115, {
    adventureRole: "meteor",
    description:
      "驻场。陨星轰击：3法力，5格内3×3范围，中心10伤、外圈6伤，友军安全。",
  }),
  9211: u(9211, "导电步兵", 2, 3, 4, 2, 14),
  9212: u(9212, "晶甲卫", 4, 3, 7, 1, 19027, { provoke: true }),
  9213: u(9213, "裂隙猎手", 3, 4, 3, 3, 110),
  9214: u(9214, "星壳射手", 4, 3, 5, 2, 10021, {
    ranged: true,
    attackRange: 3,
  }),
  9221: g(9221, "风暴巨像", 4, 54, 10207),
  9222: g(9222, "引力监守", 4, 56, 317),
  9223: g(9223, "换轨督军", 4, 64, 215),
  9224: g(9224, "雷霆主宰", 5, 80, 513),
  9225: g(9225, "陨星裁决者", 4, 72, 115),
  9226: g(9226, "坠星君王", 5, 72, 402),
  9231: u(9231, "供能源", 0, 0, 6, 0, 214, {
    anchored: true,
    description: "驻场供能源。击败或驱散关闭并取消其预告。",
  }),
});
export const ADVENTURE_CARD_IDS = freeze(
  Object.keys(ADVENTURE_CARDS).map(Number),
);
const chapterNames = [
  ["storm-front", "第十一章 · 导雷谷地"],
  ["storm-march", "第十二章 · 换轨前线"],
  ["storm-core", "第十三章 · 雷霆中枢"],
  ["starfall-depths", "第十四章 · 引力裂谷"],
  ["starfall-crossing", "第十五章 · 坠星峡谷"],
  ["starfall-throne", "第十六章 · 深渊王座"],
];
const key = (i) =>
  `${i < 9 ? "storm" : "starfall"}-${String((i % 9) + 1).padStart(2, "0")}`;
export const ADVENTURE_CHAPTERS = freeze(
  chapterNames.map(([id, title], i) => ({
    id,
    title,
    subtitle: "",
    description: "",
    image: `assets/metagame/original/challenge-gate-00${i % 3}.jpg`,
    levelIds: [0, 1, 2].map((j) => key(i * 3 + j)),
  })),
);
// Troop order fixes unit-ID ties. Layouts: title, HP, allies, troops, walls, outposts, rubble, finite draw order.
const layouts = [
  {
    title: "导雷谷",
    health: 24,
    allies: [
      [9201, 2, 2],
      [9201, 2, 4],
    ],
    troops: "S4,1 S5,1 S6,2 G7,3",
    walls: [[5, 3]],
    outposts: [[4, 3]],
    rough: [
      [4, 5],
      [5, 5],
    ],
    deck: "S,R,S,G,S,R,S,G,S,R,S,G",
  },
  {
    title: "棱晶炮阵",
    health: 30,
    allies: [
      [9201, 2, 2],
      [9202, 2, 3, 2],
    ],
    troops: "S4,3 G6,3 A8,3 R6,1",
    walls: [
      [5, 1],
      [5, 5],
    ],
    outposts: [[4, 2]],
    rough: [],
    deck: "S,R,A,G,S,R,A,G,S,R,A,G,S,R,A",
  },
  {
    title: "风暴巨像",
    health: 54,
    allies: [
      [9201, 3, 2],
      [9202, 2, 3],
    ],
    troops: "S5,2 S6,2 G7,3 A8,4",
    walls: [
      [5, 0],
      [5, 6],
    ],
    outposts: [[4, 4]],
    rough: [],
    deck: "R,S,A,G,S,R,A,G,S,R,A,G,S,R,A,G,S,R",
  },
  {
    title: "断桥接电",
    health: 32,
    allies: [
      [9201, 3, 1],
      [9201, 2, 4],
      [9202, 2, 3],
    ],
    troops: "S6,1 S7,1 A8,2 G7,4 R6,5",
    walls: [
      [5, 2],
      [5, 3],
      [5, 4],
    ],
    outposts: [[4, 1]],
    rough: [],
    deck: "S,R,A,G,S,R,A,G,S,R,A,G,S,R,A",
  },
  {
    title: "移炮开廊",
    health: 34,
    allies: [
      [9201, 2, 4],
      [9202, 4, 2, 1],
    ],
    troops: "S6,1 A8,1 G4,4 S4,5",
    walls: [
      [5, 2],
      [5, 3],
    ],
    outposts: [[3, 3]],
    rough: [],
    deck: "R,S,A,G,R,S,A,G,R,S,A,G,R,S,A",
  },
  {
    title: "换轨督军",
    health: 64,
    allies: [
      [9201, 3, 2],
      [9202, 3, 4],
    ],
    troops: "G7,2 G7,4 S6,1 A8,5 R4,0 R4,6",
    walls: [
      [5, 0],
      [5, 6],
    ],
    outposts: [[4, 3]],
    rough: [],
    deck: "R,S,A,G,S,R,A,G,S,R,A,G,S,R,A,G,S,R",
  },
  {
    title: "双端导流",
    health: 36,
    allies: [
      [9201, 2, 1],
      [9201, 2, 5],
      [9202, 3, 2],
    ],
    troops: "S6,1 S7,1 A8,1 S6,5 S7,5 A8,5",
    walls: [[5, 3]],
    outposts: [
      [4, 1],
      [4, 5],
    ],
    rough: [],
    deck: "R,S,A,G,R,S,A,G,R,S,A,G,R,S,A,G,R,S",
  },
  {
    title: "双炮交锋",
    health: 40,
    allies: [
      [9201, 3, 3],
      [9202, 2, 2],
      [9202, 2, 4],
    ],
    troops: "S4,2 S6,2 G8,2 S4,4 S6,4 G8,4",
    walls: [
      [5, 0],
      [5, 6],
    ],
    outposts: [[4, 3]],
    rough: [],
    deck: "A,R,G,S,A,R,G,S,A,R,G,S,A,R,G,S,A,R",
  },
  {
    title: "雷霆主宰",
    health: 80,
    allies: [
      [9201, 3, 1],
      [9201, 3, 5],
      [9202, 2, 3],
    ],
    troops: "G7,3 A7,2 S7,4 R4,0 R4,6",
    walls: [
      [5, 0],
      [5, 6],
    ],
    outposts: [[4, 3]],
    rough: [],
    deck: "R,S,A,G,S,R,A,G,S,R,A,G,S,R,A,G,S,R,A,G",
  },
  {
    title: "引力裂谷",
    health: 26,
    allies: [[9203, 3, 3]],
    troops: "S5,1 A7,2 S6,4 G8,3",
    walls: [
      [6, 0],
      [6, 6],
    ],
    outposts: [[4, 3]],
    rough: [[5, 3]],
    deck: "S,A,R,S,G,A,R,S,G,A,R,S",
  },
  {
    title: "陨星猎场",
    health: 32,
    allies: [
      [9203, 3, 2],
      [9204, 3, 4],
    ],
    troops: "S5,2 A7,2 G7,4 S6,5",
    walls: [
      [5, 0],
      [5, 6],
    ],
    outposts: [[4, 3]],
    rough: [],
    deck: "S,A,G,R,S,A,G,R,S,A,G,R,S,A,G",
  },
  {
    title: "引力监守",
    health: 56,
    allies: [
      [9203, 3, 2],
      [9204, 3, 4],
    ],
    troops: "G7,2 G7,4 A8,3 R6,5",
    walls: [
      [6, 0],
      [6, 6],
    ],
    outposts: [[4, 3]],
    rough: [],
    deck: "R,S,A,G,S,R,A,G,S,R,A,G,S,R,A,G,S,R",
  },
  {
    title: "峡口拖阵",
    health: 34,
    allies: [
      [9203, 3, 2],
      [9204, 3, 4],
    ],
    troops: "G6,2 A7,1 G6,4 A8,5 S7,3",
    walls: [
      [5, 3],
      [7, 0],
      [7, 6],
    ],
    outposts: [[4, 2]],
    rough: [],
    deck: "G,A,R,S,G,A,R,S,G,A,R,S,G,A,R",
  },
  {
    title: "陨星取舍",
    health: 38,
    allies: [
      [9203, 3, 2],
      [9204, 3, 4],
    ],
    troops: "S6,0 A7,0 S8,1 G6,6 G7,6 A8,5",
    walls: [[5, 3]],
    outposts: [
      [4, 1],
      [4, 5],
    ],
    rough: [],
    deck: "R,G,A,S,R,G,A,S,R,G,A,S,R,G,A,S,R,G",
  },
  {
    title: "陨星裁决者",
    health: 72,
    allies: [
      [9203, 3, 2],
      [9204, 3, 4],
    ],
    troops: "G6,1 A7,1 G6,5 A7,5 R4,0 R4,6",
    walls: [
      [6, 0],
      [6, 6],
    ],
    outposts: [[4, 3]],
    rough: [],
    deck: "R,S,A,G,S,R,A,G,S,R,A,G,S,R,A,G,S,R",
  },
  {
    title: "双重牵引",
    health: 40,
    allies: [
      [9203, 3, 1],
      [9203, 3, 5],
      [9204, 2, 3],
    ],
    troops: "S5,0 A7,0 S6,6 A7,6 G7,3 R10,0",
    walls: [
      [8, 0],
      [8, 6],
    ],
    outposts: [[4, 3]],
    rough: [],
    deck: "R,S,A,G,R,S,A,G,R,S,A,G,R,S,A,G,R,S",
  },
  {
    title: "星门夹攻",
    health: 44,
    allies: [
      [9203, 3, 3],
      [9204, 2, 3],
    ],
    troops: "R5,1 S6,1 A8,2 R5,5 S6,5 G8,4",
    walls: [[6, 3]],
    outposts: [[4, 3]],
    rough: [],
    deck: "R,R,A,G,S,R,A,G,S,R,A,G,S,R,A,G,S,R,A,G",
  },
  {
    title: "坠星君王",
    health: 72,
    allies: [
      [9203, 3, 2],
      [9203, 3, 4],
      [9204, 2, 3],
    ],
    troops: "G7,2 A8,2 G7,4 R6,5",
    walls: [
      [6, 0],
      [6, 6],
    ],
    outposts: [[4, 3]],
    rough: [],
    deck: "R,S,A,G,S,R,A,G,S,R,A,G,S,R,A,G,S,R,A,G",
  },
];
const letters = { S: 9211, G: 9212, R: 9213, A: 9214 },
  bossIds = { 2: 9221, 5: 9223, 8: 9224, 11: 9222, 14: 9225, 17: 9226 };
const rewards = [
  [280, 60],
  [300, 65],
  [360, 80],
  [300, 65],
  [320, 70],
  [400, 90],
  [320, 70],
  [340, 75],
  [440, 100],
  [300, 65],
  [320, 70],
  [400, 90],
  [320, 70],
  [340, 75],
  [440, 100],
  [340, 75],
  [360, 80],
  [480, 110],
];
export const ADVENTURE_DEFINITIONS = freeze(
  Object.fromEntries(
    layouts.map((r, i) => [
      key(i),
      {
        version: 1,
        revision: 1,
        levelId: key(i),
        allies: r.allies.map(([cardId, x, y, charge = 0]) => ({
          cardId,
          x,
          y,
          charge,
        })),
        sources:
          i === 8
            ? [
                { cardId: 9231, x: 8, y: 1 },
                { cardId: 9231, x: 8, y: 5 },
              ]
            : [],
        script: `${i < 9 ? "storm" : "starfall"}${String((i % 9) + 1).padStart(2, "0")}`,
        ...(bossIds[i]
          ? {
              boss: {
                threshold: r.health / 2,
                attack2: i === 8 || i === 17 ? 6 : 5,
              },
            }
          : {}),
      },
    ]),
  ),
);
export const getAdventureDefinition = (id) =>
  Object.hasOwn(ADVENTURE_DEFINITIONS, id) ? ADVENTURE_DEFINITIONS[id] : null;
const rebalancedBossIds = { "starfall-03": 9222, "starfall-09": 9226 };
const legacyAdventureCards = freeze({
  ...ADVENTURE_CARDS,
  9222: { ...ADVENTURE_CARDS[9222], health: 64 },
  9226: { ...ADVENTURE_CARDS[9226], health: 84 },
});
const legacyAdventureDefinitions = freeze(
  Object.fromEntries(
    Object.entries(rebalancedBossIds).map(([id, cardId]) => {
      const definition = getAdventureDefinition(id);
      return [id, {
        ...definition,
        boss: { ...definition.boss, threshold: legacyAdventureCards[cardId].health / 2 },
      }];
    }),
  ),
);
export function getAdventureSnapshotRules(id, playerCards) {
  const legacy = playerCards?.[9222]?.health === legacyAdventureCards[9222].health
    && playerCards?.[9226]?.health === legacyAdventureCards[9226].health;
  const cards = legacy ? legacyAdventureCards : ADVENTURE_CARDS;
  return {
    cards,
    definition: legacy && Object.hasOwn(legacyAdventureDefinitions, id)
      ? legacyAdventureDefinitions[id] : getAdventureDefinition(id),
    bossCard: cards[rebalancedBossIds[id]],
  };
}
export const ADVENTURE_LEVELS = freeze(
  layouts.map((r, i) => {
    const {
      title,
      health: hp,
      troops,
      walls,
      outposts,
      rough,
      deck: order,
    } = r;
    const generalId = bossIds[i] ?? 23,
      attack = bossIds[i] ? ADVENTURE_CARDS[generalId].attack : 3,
      deck = order.split(",").map((k) => letters[k]);
    return {
      id: key(i),
      chapterId: chapterNames[Math.floor(i / 3)][0],
      title,
      subtitle: "",
      goal: "击败敌方主将。",
      hint: "",
      columns: 11,
      rows: 7,
      tiles: [
        ...walls.map(([x, y]) => ({ x, y, type: "wall" })),
        ...outposts.map(([x, y]) => ({ x, y, type: "outpost" })),
        ...rough.map(([x, y]) => ({ x, y, type: "rough" })),
      ],
      objective: { type: "eliminate" },
      mana: 5,
      hand: [],
      playerStart: { x: 1, y: 3 },
      allyStarts: [],
      enemies: [
        {
          cardId: generalId,
          owner: 1,
          x: 9,
          y: 3,
          attack,
          health: hp,
          maxHealth: hp,
        },
        ...troops.split(" ").map((t) => {
          const [x, y] = t.slice(1).split(",").map(Number);
          return { cardId: letters[t[0]], owner: 1, x, y };
        }),
      ],
      enemyDecks: { 1: deck },
      reward: { first: rewards[i][0], repeat: rewards[i][1] },
      turnLimit: i % 3 === 2 ? 20 : i % 3 === 1 ? 18 : 16,
      adventureVersion: 1,
      adventureRevision: 1,
      ...(bossIds[i] ? { boss: true } : {}),
    };
  }),
);
export function getAdventureEnemyPlan(id) {
  const i = ADVENTURE_LEVELS.findIndex((l) => l.id === id);
  if (i < 0) return null;
  const l = ADVENTURE_LEVELS[i],
    general = l.enemies[0];
  return structuredClone({
    version: 3,
    contentVersion: ADVENTURE_CONTENT_VERSION,
    adventureVersion: 1,
    adventureRevision: 1,
    label: l.title,
    hint: "",
    chapter: 11 + Math.floor(i / 3),
    players: {
      1: {
        mana: l.boss ? 5 : 4,
        maxMana: l.boss ? 5 : 4,
        manaGrowth: 1,
        manaCap: 8,
        openingHandSize: 4,
        drawPerTurn: 1,
        handLimit: 8,
        fatigueDamage: 1,
        replacePerTurn: 0,
        shuffleDeck: false,
        behavior: i >= 9 ? "support" : "assault",
        spellRank: 0,
        spellMode: "base",
        attackBonus: 0,
        healthBonus: 0,
        generalHealth: general.health,
        generalAttack: general.attack,
        generalId: general.cardId,
        deck: l.enemyDecks[1],
        deployLimit: 2,
        unitLimit: 8,
        unitStats: Object.fromEntries(
          [
            ...new Set([
              ...l.enemyDecks[1],
              ...l.enemies.slice(1).map((e) => e.cardId),
            ]),
          ].map((id) => [
            id,
            {
              cost: ADVENTURE_CARDS[id].cost,
              attack: ADVENTURE_CARDS[id].attack,
              health: ADVENTURE_CARDS[id].health,
            },
          ]),
        ),
        garrison: l.enemies.map((e) => ({
          id: e.cardId,
          x: e.x,
          y: e.y,
          attack: e.attack ?? ADVENTURE_CARDS[e.cardId].attack,
          health: e.health ?? ADVENTURE_CARDS[e.cardId].health,
        })),
      },
    },
  });
}
