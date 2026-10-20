const gate = (index) => `assets/metagame/original/challenge-gate-00${index}.jpg`;

const EXPANSION_CHAPTERS = [
  {
    "id": "crossroads-front",
    "title": "第七章 · 四岔战线",
    "subtitle": "",
    "image": "assets/metagame/original/challenge-gate-000.jpg",
    "description": "",
    "levelIds": [
      "crossroads-01",
      "crossroads-02",
      "crossroads-03"
    ]
  },
  {
    "id": "citadel-circuit",
    "title": "第八章 · 环堡攻防",
    "subtitle": "",
    "image": "assets/metagame/original/challenge-gate-001.jpg",
    "description": "",
    "levelIds": [
      "citadel-01",
      "citadel-02",
      "citadel-03"
    ]
  },
  {
    "id": "ruins-watch",
    "title": "第九章 · 裂隙遗城",
    "subtitle": "",
    "image": "assets/metagame/original/challenge-gate-002.jpg",
    "description": "",
    "levelIds": [
      "ruins-01",
      "ruins-02",
      "ruins-03"
    ]
  },
  {
    "id": "confluence-final",
    "title": "第十章 · 炉乡决战",
    "subtitle": "",
    "image": "assets/metagame/original/challenge-gate-000.jpg",
    "description": "",
    "levelIds": [
      "confluence-01",
      "confluence-02",
      "confluence-03"
    ]
  }
];
const EXPANSION_LEVELS = [
  {
    "id": "crossroads-01",
    "chapterId": "crossroads-front",
    "title": "四岔渡口",
    "subtitle": "",
    "goal": "击败敌方主将。",
    "hint": "绕过断开的中轴，选择一翼推进。",
    "columns": 11,
    "rows": 9,
    "tiles": [
      {
        "x": 5,
        "y": 3,
        "type": "wall"
      },
      {
        "x": 5,
        "y": 5,
        "type": "wall"
      },
      {
        "x": 2,
        "y": 4,
        "type": "outpost"
      },
      {
        "x": 8,
        "y": 4,
        "type": "outpost"
      }
    ],
    "objective": {
      "type": "eliminate"
    },
    "mana": 5,
    "playerStart": {
      "x": 5,
      "y": 1
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 5,
        "y": 7,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 150,
      "repeat": 40
    },
    "turnLimit": 15
  },
  {
    "id": "crossroads-02",
    "chapterId": "crossroads-front",
    "title": "错位桥头",
    "subtitle": "",
    "goal": "击败敌方主将。",
    "hint": "绕开错位墙体，夺取中央前哨。",
    "columns": 13,
    "rows": 7,
    "tiles": [
      {
        "x": 4,
        "y": 2,
        "type": "wall"
      },
      {
        "x": 4,
        "y": 3,
        "type": "wall"
      },
      {
        "x": 8,
        "y": 3,
        "type": "wall"
      },
      {
        "x": 8,
        "y": 4,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 3,
        "type": "outpost"
      }
    ],
    "objective": {
      "type": "eliminate"
    },
    "mana": 5,
    "playerStart": {
      "x": 1,
      "y": 5
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 11,
        "y": 1,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 160,
      "repeat": 40
    },
    "turnLimit": 16
  },
  {
    "id": "crossroads-03",
    "chapterId": "crossroads-front",
    "title": "三面来敌",
    "subtitle": "",
    "goal": "存活 10 回合并守住主将。",
    "hint": "从两军之间撤向一侧，守住主将。",
    "columns": 11,
    "rows": 9,
    "tiles": [
      {
        "x": 4,
        "y": 3,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 5,
        "type": "wall"
      },
      {
        "x": 5,
        "y": 2,
        "type": "outpost"
      },
      {
        "x": 5,
        "y": 6,
        "type": "outpost"
      }
    ],
    "objective": {
      "type": "survive",
      "rounds": 10
    },
    "mana": 5,
    "playerStart": {
      "x": 5,
      "y": 4
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 1,
        "y": 1,
        "health": 30,
        "attack": 3
      },
      {
        "cardId": 418,
        "owner": 2,
        "x": 9,
        "y": 7,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ],
      "2": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 180,
      "repeat": 45
    },
    "turnLimit": 10
  },
  {
    "id": "citadel-01",
    "chapterId": "citadel-circuit",
    "title": "外堡回廊",
    "subtitle": "",
    "goal": "击败敌方主将。",
    "hint": "沿堡垒两侧绕行，拆除远程支援。",
    "columns": 13,
    "rows": 9,
    "tiles": [
      {
        "x": 6,
        "y": 2,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 3,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 4,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 5,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 6,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 1,
        "type": "outpost"
      },
      {
        "x": 6,
        "y": 7,
        "type": "outpost"
      }
    ],
    "objective": {
      "type": "eliminate"
    },
    "mana": 5,
    "playerStart": {
      "x": 1,
      "y": 4
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 11,
        "y": 4,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 150,
      "repeat": 40
    },
    "turnLimit": 17
  },
  {
    "id": "citadel-02",
    "chapterId": "citadel-circuit",
    "title": "双门换防",
    "subtitle": "",
    "goal": "击败敌方主将。",
    "hint": "两门间轮换部队，避免堵住自己的退路。",
    "columns": 11,
    "rows": 9,
    "tiles": [
      {
        "x": 2,
        "y": 4,
        "type": "wall"
      },
      {
        "x": 4,
        "y": 4,
        "type": "wall"
      },
      {
        "x": 5,
        "y": 4,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 4,
        "type": "wall"
      },
      {
        "x": 8,
        "y": 4,
        "type": "wall"
      },
      {
        "x": 3,
        "y": 4,
        "type": "outpost"
      },
      {
        "x": 7,
        "y": 4,
        "type": "outpost"
      }
    ],
    "objective": {
      "type": "eliminate"
    },
    "mana": 5,
    "playerStart": {
      "x": 5,
      "y": 7
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 5,
        "y": 1,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 160,
      "repeat": 40
    },
    "turnLimit": 16
  },
  {
    "id": "citadel-03",
    "chapterId": "citadel-circuit",
    "title": "孤堡突围",
    "subtitle": "",
    "goal": "击败两名敌方主将。",
    "hint": "集中突破一侧，再转向另一名敌将。",
    "columns": 11,
    "rows": 9,
    "tiles": [
      {
        "x": 4,
        "y": 2,
        "type": "wall"
      },
      {
        "x": 5,
        "y": 2,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 2,
        "type": "wall"
      },
      {
        "x": 4,
        "y": 6,
        "type": "wall"
      },
      {
        "x": 5,
        "y": 6,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 6,
        "type": "wall"
      },
      {
        "x": 3,
        "y": 4,
        "type": "outpost"
      },
      {
        "x": 7,
        "y": 4,
        "type": "outpost"
      }
    ],
    "objective": {
      "type": "eliminate"
    },
    "mana": 5,
    "playerStart": {
      "x": 5,
      "y": 4
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 1,
        "y": 4,
        "health": 30,
        "attack": 3
      },
      {
        "cardId": 418,
        "owner": 2,
        "x": 9,
        "y": 4,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ],
      "2": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 180,
      "repeat": 45
    },
    "turnLimit": 18
  },
  {
    "id": "ruins-01",
    "chapterId": "ruins-watch",
    "title": "裂隙遗城",
    "subtitle": "",
    "goal": "击败敌方主将。",
    "hint": "沿斜向通路接近火力，及时清理重生与召唤。",
    "columns": 13,
    "rows": 9,
    "tiles": [
      {
        "x": 4,
        "y": 3,
        "type": "wall"
      },
      {
        "x": 4,
        "y": 4,
        "type": "wall"
      },
      {
        "x": 8,
        "y": 4,
        "type": "wall"
      },
      {
        "x": 8,
        "y": 5,
        "type": "wall"
      },
      {
        "x": 5,
        "y": 4,
        "type": "rough"
      },
      {
        "x": 7,
        "y": 4,
        "type": "rough"
      },
      {
        "x": 6,
        "y": 2,
        "type": "outpost"
      },
      {
        "x": 6,
        "y": 6,
        "type": "outpost"
      }
    ],
    "objective": {
      "type": "eliminate"
    },
    "mana": 5,
    "playerStart": {
      "x": 1,
      "y": 7
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 11,
        "y": 1,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 150,
      "repeat": 40
    },
    "turnLimit": 17
  },
  {
    "id": "ruins-02",
    "chapterId": "ruins-watch",
    "title": "回响祭阵",
    "subtitle": "",
    "goal": "击败敌方主将。",
    "hint": "主动拆掉侧翼生产和支援节点。",
    "columns": 11,
    "rows": 9,
    "tiles": [
      {
        "x": 3,
        "y": 4,
        "type": "wall"
      },
      {
        "x": 7,
        "y": 4,
        "type": "wall"
      },
      {
        "x": 3,
        "y": 6,
        "type": "outpost"
      },
      {
        "x": 7,
        "y": 6,
        "type": "outpost"
      },
      {
        "x": 5,
        "y": 4,
        "type": "rough"
      }
    ],
    "objective": {
      "type": "eliminate"
    },
    "mana": 5,
    "playerStart": {
      "x": 5,
      "y": 1
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 5,
        "y": 7,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 160,
      "repeat": 40
    },
    "turnLimit": 16
  },
  {
    "id": "ruins-03",
    "chapterId": "ruins-watch",
    "title": "遗城守夜",
    "subtitle": "",
    "goal": "存活 11 回合并守住主将。",
    "hint": "在两侧前哨之间转移，保护主将。",
    "columns": 13,
    "rows": 9,
    "tiles": [
      {
        "x": 5,
        "y": 5,
        "type": "wall"
      },
      {
        "x": 7,
        "y": 5,
        "type": "wall"
      },
      {
        "x": 4,
        "y": 6,
        "type": "outpost"
      },
      {
        "x": 8,
        "y": 6,
        "type": "outpost"
      }
    ],
    "objective": {
      "type": "survive",
      "rounds": 11
    },
    "mana": 5,
    "playerStart": {
      "x": 6,
      "y": 7
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 2,
        "y": 1,
        "health": 30,
        "attack": 3
      },
      {
        "cardId": 418,
        "owner": 2,
        "x": 10,
        "y": 1,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ],
      "2": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 180,
      "repeat": 45
    },
    "turnLimit": 11
  },
  {
    "id": "confluence-01",
    "chapterId": "confluence-final",
    "title": "寒沙交界",
    "subtitle": "",
    "goal": "击败两名敌方主将。",
    "hint": "选择一翼推进，利用两軍交火窗口。",
    "columns": 13,
    "rows": 9,
    "tiles": [
      {
        "x": 6,
        "y": 3,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 5,
        "type": "wall"
      },
      {
        "x": 5,
        "y": 2,
        "type": "outpost"
      },
      {
        "x": 5,
        "y": 6,
        "type": "outpost"
      }
    ],
    "objective": {
      "type": "eliminate"
    },
    "mana": 5,
    "playerStart": {
      "x": 1,
      "y": 4
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 11,
        "y": 2,
        "health": 30,
        "attack": 3
      },
      {
        "cardId": 418,
        "owner": 2,
        "x": 11,
        "y": 6,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ],
      "2": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 150,
      "repeat": 40
    },
    "turnLimit": 18
  },
  {
    "id": "confluence-02",
    "chapterId": "confluence-final",
    "title": "反转战线",
    "subtitle": "",
    "goal": "击败敌方主将。",
    "hint": "从右向左推进，保护主将身后的位置。",
    "columns": 11,
    "rows": 9,
    "tiles": [
      {
        "x": 4,
        "y": 2,
        "type": "wall"
      },
      {
        "x": 6,
        "y": 6,
        "type": "wall"
      },
      {
        "x": 5,
        "y": 3,
        "type": "rough"
      },
      {
        "x": 5,
        "y": 5,
        "type": "rough"
      },
      {
        "x": 6,
        "y": 4,
        "type": "outpost"
      },
      {
        "x": 3,
        "y": 4,
        "type": "outpost"
      }
    ],
    "objective": {
      "type": "eliminate"
    },
    "mana": 5,
    "playerStart": {
      "x": 9,
      "y": 4
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 1,
        "y": 4,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 160,
      "repeat": 40
    },
    "turnLimit": 17
  },
  {
    "id": "confluence-03",
    "chapterId": "confluence-final",
    "title": "炉乡决战",
    "subtitle": "",
    "goal": "击败两名敌方主将。",
    "hint": "先击破一军，避免两侧终结部队同时逼近。",
    "columns": 13,
    "rows": 9,
    "tiles": [
      {
        "x": 5,
        "y": 2,
        "type": "wall"
      },
      {
        "x": 7,
        "y": 6,
        "type": "wall"
      },
      {
        "x": 3,
        "y": 4,
        "type": "outpost"
      },
      {
        "x": 9,
        "y": 4,
        "type": "outpost"
      },
      {
        "x": 5,
        "y": 4,
        "type": "rough"
      },
      {
        "x": 7,
        "y": 4,
        "type": "rough"
      }
    ],
    "objective": {
      "type": "eliminate"
    },
    "mana": 5,
    "playerStart": {
      "x": 6,
      "y": 4
    },
    "allyStarts": [],
    "enemies": [
      {
        "cardId": 527,
        "owner": 1,
        "x": 1,
        "y": 1,
        "health": 30,
        "attack": 3
      },
      {
        "cardId": 418,
        "owner": 2,
        "x": 11,
        "y": 7,
        "health": 30,
        "attack": 3
      }
    ],
    "enemyDecks": {
      "1": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ],
      "2": [
        505,
        503,
        511,
        20149,
        20139,
        19027
      ]
    },
    "reward": {
      "first": 180,
      "repeat": 45
    },
    "turnLimit": 20
  }
];

export const EXPEDITION_CHAPTERS = Object.freeze([

  {
    id: 'border-march', title: '第一章 · 边境行军', subtitle: '认识战线', image: gate(0),
    description: '在狭窄战场上练习护卫、抢占前哨与集中火力。',
    levelIds: ['border-01', 'border-02', 'border-03']
  },
  {
    id: 'sunken-road', title: '第二章 · 沉没古道', subtitle: '守住阵形', image: gate(1),
    description: '在碎石与狭路间前进，抵挡两侧敌军。',
    levelIds: ['road-01', 'road-02', 'road-03']
  },
  {
    id: 'three-banners', title: '第三章 · 三旗会战', subtitle: '穿越乱军', image: gate(2),
    description: '两支敌军互相交战，击败敌方主将或完成坚守。',
    levelIds: ['banners-01', 'banners-02', 'banners-03']
  },
  {"id": "sand-front", "title": "第四章 · 沙海前线", "subtitle": "突破沙阵", "image": "assets/metagame/original/challenge-gate-000.jpg", "description": "沙魔与远程交叉火力迫使队伍选择通行路线。", "levelIds": ["sand-01", "sand-02", "sand-03"]},
  {"id": "shadow-pass", "title": "第五章 · 暗影关隘", "subtitle": "迎击伏兵", "image": "assets/metagame/original/challenge-gate-001.jpg", "description": "背刺、远程与暗灵从不同方向争夺前哨。", "levelIds": ["shadow-01", "shadow-02", "shadow-03"]},
  {"id": "frost-siege", "title": "第六章 · 冰原围城", "subtitle": "守住最后战线", "image": "assets/metagame/original/challenge-gate-002.jpg", "description": "冰原与玛格玛的敌军在宽阔战场上相互交战。", "levelIds": ["frost-01", "frost-02", "frost-03"]},
  ...EXPANSION_CHAPTERS
]);

const L = (level) => Object.freeze(level);
export const EXPEDITION_LEVELS = Object.freeze([
  L({
    id: 'border-01', chapterId: 'border-march', title: '边哨初战', subtitle: '把护卫摆在主将前方',
    goal: '击败敌方主将。', hint: '护住己方主将，集中火力击破敌方主将。',
    columns: 9, rows: 5, tiles: [{ x: 4, y: 2, type: 'outpost' }], objective: { type: 'eliminate' },
    mana: 3, hand: [14, 20043], playerStart: { x: 1, y: 2 }, allyStarts: [{ x: 2, y: 2 }, { x: 1, y: 3 }],
    enemies: [{ cardId: 23, owner: 1, x: 7, y: 2, health: 12, maxHealth: 12, attack: 1 }, { cardId: 14, owner: 1, x: 6, y: 2 }],
    enemyDecks: { 1: [14, 14, 9] }, reward: { first: 100, repeat: 25 }, turnLimit: 10
  }),
  L({
    id: 'border-02', chapterId: 'border-march', title: '双路夹击', subtitle: '不要让阵形被拉开',
    goal: '击败敌方主将。', hint: '先清理一侧的快攻单位，再围攻主将。',
    columns: 9, rows: 5, tiles: [{ x: 4, y: 1, type: 'rough' }, { x: 4, y: 3, type: 'rough' }, { x: 4, y: 2, type: 'outpost' }], objective: { type: 'eliminate' },
    mana: 3, hand: [9, 20066], playerStart: { x: 1, y: 2 }, allyStarts: [{ x: 2, y: 1 }, { x: 2, y: 3 }],
    enemies: [{ cardId: 23, owner: 1, x: 7, y: 2, health: 16, maxHealth: 16 }, { cardId: 9, owner: 1, x: 6, y: 0 }, { cardId: 14, owner: 1, x: 6, y: 4 }],
    enemyDecks: { 1: [14, 9, 14, 20043] }, reward: { first: 110, repeat: 30 }, turnLimit: 11
  }),
  L({
    id: 'border-03', chapterId: 'border-march', title: '守夜', subtitle: '在连续攻势中坚持防守',
    goal: '存活 7 回合。', hint: '退到前哨附近轮换受伤单位，治疗留给关键护卫。',
    columns: 9, rows: 5, tiles: [{ x: 0, y: 1, type: 'wall' }, { x: 0, y: 3, type: 'wall' }, { x: 3, y: 2, type: 'outpost' }], objective: { type: 'survive', rounds: 7 },
    mana: 4, hand: [11, 20043], playerStart: { x: 1, y: 2 }, allyStarts: [{ x: 2, y: 1 }, { x: 2, y: 3 }],
    enemies: [{ cardId: 23, owner: 1, x: 8, y: 2, health: 22, maxHealth: 22 }, { cardId: 14, owner: 1, x: 6, y: 1 }, { cardId: 9, owner: 1, x: 7, y: 2 }],
    enemyDecks: { 1: [14, 9, 14, 20043] }, reward: { first: 120, repeat: 35 }, turnLimit: 7
  }),
  L({
    id: 'road-01', chapterId: 'sunken-road', title: '断桥', subtitle: '争夺中央落脚点',
    goal: '击败敌方主将。', hint: '桥口狭窄，空投单位能绕过封锁迅速建立前线。',
    columns: 11, rows: 7, tiles: [{ x: 5, y: 0, type: 'wall' }, { x: 5, y: 1, type: 'wall' }, { x: 5, y: 5, type: 'wall' }, { x: 5, y: 6, type: 'wall' }, { x: 5, y: 3, type: 'outpost' }], objective: { type: 'eliminate' },
    mana: 4, hand: [17, 20066], playerStart: { x: 1, y: 3 }, allyStarts: [{ x: 2, y: 2 }, { x: 2, y: 4 }],
    enemies: [{ cardId: 23, owner: 1, x: 9, y: 3, health: 23 }, { cardId: 11, owner: 1, x: 7, y: 3 }, { cardId: 9, owner: 1, x: 8, y: 1 }],
    enemyDecks: { 1: [11, 15, 14, 9] }, reward: { first: 130, repeat: 40 }, turnLimit: 13
  }),
  L({
    id: 'road-02', chapterId: 'sunken-road', title: '逐光阵', subtitle: '压制会成长的敌军',
    goal: '击败敌方主将。', hint: '逐光者会从任何实际治疗中成长，优先击破它。',
    columns: 11, rows: 7, tiles: [{ x: 4, y: 2, type: 'rough' }, { x: 4, y: 4, type: 'rough' }, { x: 6, y: 2, type: 'rough' }, { x: 6, y: 4, type: 'rough' }, { x: 5, y: 3, type: 'outpost' }], objective: { type: 'eliminate' },
    mana: 4, hand: [20066, 20044], playerStart: { x: 1, y: 3 }, allyStarts: [{ x: 2, y: 2 }, { x: 2, y: 4 }],
    enemies: [{ cardId: 1, owner: 1, x: 9, y: 3, health: 22, maxHealth: 22 }, { cardId: 15, owner: 1, x: 8, y: 2 }, { cardId: 14, owner: 1, x: 8, y: 4 }],
    enemyDecks: { 1: [14, 15, 20043, 14] }, reward: { first: 140, repeat: 45 }, turnLimit: 13
  }),
  L({
    id: 'road-03', chapterId: 'sunken-road', title: '铁崖封锁', subtitle: '突破连续护卫',
    goal: '击败敌方主将。', hint: '嘲讽会限制攻击目标，用法术削弱护卫再集中突破。',
    columns: 11, rows: 7, tiles: [{ x: 5, y: 1, type: 'wall' }, { x: 5, y: 5, type: 'wall' }, { x: 5, y: 2, type: 'rough' }, { x: 5, y: 4, type: 'rough' }, { x: 5, y: 3, type: 'outpost' }], objective: { type: 'eliminate' },
    mana: 5, hand: [20066, 20068], playerStart: { x: 1, y: 3 }, allyStarts: [{ x: 2, y: 2 }, { x: 2, y: 4 }],
    enemies: [{ cardId: 23, owner: 1, x: 9, y: 3, health: 22, maxHealth: 22 }, { cardId: 17, owner: 1, x: 7, y: 3, attack: 2, health: 7, maxHealth: 7 }, { cardId: 11, owner: 1, x: 8, y: 2 }],
    enemyDecks: { 1: [11, 14, 20066, 15, 16] }, reward: { first: 150, repeat: 45 }, turnLimit: 14
  }),
  L({
    id: 'banners-01', chapterId: 'three-banners', title: '陌生旗号', subtitle: '第三方从侧翼进入战场',
    goal: '击败两名敌方主将。', hint: '两支敌军也会互相攻击，避免同时被两边围攻。',
    columns: 13, rows: 7, tiles: [{ x: 6, y: 1, type: 'rough' }, { x: 6, y: 5, type: 'rough' }, { x: 6, y: 3, type: 'outpost' }], objective: { type: 'eliminate' },
    mana: 5, hand: [17, 20043], playerStart: { x: 1, y: 3 }, allyStarts: [{ x: 2, y: 2 }, { x: 2, y: 4 }],
    enemies: [{ cardId: 23, owner: 1, x: 11, y: 1, health: 22 }, { cardId: 11, owner: 1, x: 9, y: 1 }, { cardId: 1, owner: 2, x: 11, y: 5, health: 22 }, { cardId: 9, owner: 2, x: 9, y: 5 }],
    enemyDecks: { 1: [14, 15, 20043, 11], 2: [9, 14, 20066, 16] }, reward: { first: 160, repeat: 50 }, turnLimit: 15
  }),
  L({
    id: 'banners-02', chapterId: 'three-banners', title: '三军夺垒', subtitle: '围绕前哨争夺行动优势',
    goal: '击败两名敌方主将。', hint: '抢占中央前哨后保持退路，不要被两翼包围。',
    columns: 13, rows: 9, tiles: [{ x: 6, y: 0, type: 'wall' }, { x: 6, y: 8, type: 'wall' }, { x: 5, y: 4, type: 'rough' }, { x: 7, y: 4, type: 'rough' }, { x: 6, y: 4, type: 'outpost' }], objective: { type: 'eliminate' },
    mana: 5, hand: [20044, 20068], playerStart: { x: 1, y: 4 }, allyStarts: [{ x: 2, y: 3 }, { x: 2, y: 5 }],
    enemies: [{ cardId: 23, owner: 1, x: 11, y: 2, health: 25 }, { cardId: 17, owner: 1, x: 9, y: 2 }, { cardId: 15, owner: 1, x: 10, y: 3 }, { cardId: 14, owner: 1, x: 8, y: 3 }, { cardId: 1, owner: 2, x: 11, y: 6, health: 25 }, { cardId: 11, owner: 2, x: 9, y: 6 }, { cardId: 14, owner: 2, x: 10, y: 5 }],
    enemyDecks: { 1: [15, 20043, 17, 16, 20068], 2: [11, 9, 20066, 20066, 14] }, reward: { first: 170, repeat: 55 }, turnLimit: 16
  }),
  L({
    id: 'banners-03', chapterId: 'three-banners', title: '王旗下的决战', subtitle: '在连续攻势中守住统帅',
    goal: '存活 10 回合并守住主将。', hint: '保护主将，存活10回合即可获胜。',
    columns: 13, rows: 9, tiles: [{ x: 3, y: 2, type: 'wall' }, { x: 3, y: 6, type: 'wall' }, { x: 6, y: 3, type: 'rough' }, { x: 6, y: 5, type: 'rough' }, { x: 4, y: 4, type: 'outpost' }], objective: { type: 'survive', rounds: 10 },
    mana: 6, hand: [17, 20043, 20044], playerStart: { x: 1, y: 4 }, allyStarts: [{ x: 2, y: 3 }, { x: 2, y: 5 }],
    enemies: [{ cardId: 23, owner: 1, x: 11, y: 2, health: 28 }, { cardId: 17, owner: 1, x: 9, y: 2 }, { cardId: 16, owner: 1, x: 10, y: 3 }, { cardId: 1, owner: 2, x: 9, y: 8, health: 28 }, { cardId: 11, owner: 2, x: 9, y: 7 }, { cardId: 15, owner: 2, x: 8, y: 7 }],
    enemyDecks: { 1: [15, 20043, 17, 16, 20068, 11], 2: [9, 20066, 11, 17, 20044, 14] }, reward: { first: 180, repeat: 60 }, turnLimit: 10
  }),
  L({
      "id": "sand-01",
      "chapterId": "sand-front",
      "title": "沙柱走廊",
      "subtitle": "绕开中央封锁",
      "goal": "击败敌方主将。",
      "hint": "优先压制沙魔身后的远程单位。",
      "columns": 11,
      "rows": 7,
      "tiles": [
          {
              "x": 5,
              "y": 3,
              "type": "outpost"
          },
          {
              "x": 5,
              "y": 1,
              "type": "wall"
          },
          {
              "x": 5,
              "y": 5,
              "type": "wall"
          },
          {
              "x": 4,
              "y": 2,
              "type": "rough"
          },
          {
              "x": 6,
              "y": 4,
              "type": "rough"
          }
      ],
      "objective": {
          "type": "eliminate"
      },
      "mana": 5,
      "playerStart": {
          "x": 1,
          "y": 3
      },
      "allyStarts": [
          {
              "x": 2,
              "y": 2
          },
          {
              "x": 2,
              "y": 4
          }
      ],
      "enemies": [
          {
              "cardId": 201,
              "owner": 1,
              "x": 9,
              "y": 3,
              "health": 25
          },
          {
              "cardId": 213,
              "owner": 1,
              "x": 7,
              "y": 3
          },
          {
              "cardId": 211,
              "owner": 1,
              "x": 8,
              "y": 1
          }
      ],
      "enemyDecks": {
          "1": [
              213,
              211,
              20095,
              214,
              20151
          ]
      },
      "reward": {
          "first": 190,
          "repeat": 60
      },
      "turnLimit": 14
  }),
  L({
      "id": "sand-02",
      "chapterId": "sand-front",
      "title": "双塔交火",
      "subtitle": "两翼争夺前哨",
      "goal": "击败敌方主将。",
      "hint": "两处前哨分散在两翼，避免全队挤在一路。",
      "columns": 13,
      "rows": 7,
      "tiles": [
          {
              "x": 6,
              "y": 1,
              "type": "outpost"
          },
          {
              "x": 6,
              "y": 5,
              "type": "outpost"
          },
          {
              "x": 6,
              "y": 3,
              "type": "wall"
          }
      ],
      "objective": {
          "type": "eliminate"
      },
      "mana": 5,
      "playerStart": {
          "x": 1,
          "y": 3
      },
      "allyStarts": [
          {
              "x": 2,
              "y": 2
          },
          {
              "x": 2,
              "y": 4
          }
      ],
      "enemies": [
          {
              "cardId": 223,
              "owner": 1,
              "x": 11,
              "y": 3,
              "health": 27
          },
          {
              "cardId": 211,
              "owner": 1,
              "x": 9,
              "y": 1
          },
          {
              "cardId": 211,
              "owner": 1,
              "x": 9,
              "y": 5
          },
          {
              "cardId": 214,
              "owner": 1,
              "x": 10,
              "y": 3
          }
      ],
      "enemyDecks": {
          "1": [
              213,
              20095,
              211,
              214,
              20151
          ]
      },
      "reward": {
          "first": 200,
          "repeat": 60
      },
      "turnLimit": 16
  }),
  L({
      "id": "sand-03",
      "chapterId": "sand-front",
      "title": "沙海守望",
      "subtitle": "在长阵线上轮换防守",
      "goal": "存活 10 回合并守住主将。",
      "hint": "守住主将即可，远程敌军需要优先处理。",
      "columns": 13,
      "rows": 9,
      "tiles": [
          {
              "x": 6,
              "y": 4,
              "type": "outpost"
          },
          {
              "x": 6,
              "y": 1,
              "type": "wall"
          },
          {
              "x": 6,
              "y": 7,
              "type": "wall"
          },
          {
              "x": 5,
              "y": 3,
              "type": "rough"
          },
          {
              "x": 7,
              "y": 5,
              "type": "rough"
          },
          {
              "x": 3,
              "y": 2,
              "type": "wall"
          },
          {
              "x": 3,
              "y": 6,
              "type": "wall"
          }
      ],
      "objective": {
          "type": "survive",
          "rounds": 10
      },
      "mana": 5,
      "playerStart": {
          "x": 1,
          "y": 4
      },
      "allyStarts": [
          {
              "x": 2,
              "y": 3
          },
          {
              "x": 2,
              "y": 5
          }
      ],
      "enemies": [
          {
              "cardId": 201,
              "owner": 1,
              "x": 11,
              "y": 4,
              "health": 28
          },
          {
              "cardId": 213,
              "owner": 1,
              "x": 8,
              "y": 3
          },
          {
              "cardId": 214,
              "owner": 1,
              "x": 9,
              "y": 5
          },
          {
              "cardId": 211,
              "owner": 1,
              "x": 10,
              "y": 2
          }
      ],
      "enemyDecks": {
          "1": [
              213,
              211,
              20095,
              214,
              213,
              20151
          ]
      },
      "reward": {
          "first": 210,
          "repeat": 60
      },
      "turnLimit": 10
  }),
  L({
      "id": "shadow-01",
      "chapterId": "shadow-pass",
      "title": "雾隘伏兵",
      "subtitle": "侧路会遭遇背刺",
      "goal": "击败敌方主将。",
      "hint": "背刺需要站在目标同一行的背后一格，注意主将身后的空格。",
      "columns": 7,
      "rows": 11,
      "tiles": [
          {
              "x": 3,
              "y": 5,
              "type": "outpost"
          },
          {
              "x": 5,
              "y": 5,
              "type": "wall"
          },
          {
              "x": 1,
              "y": 5,
              "type": "wall"
          },
          {
              "x": 4,
              "y": 4,
              "type": "rough"
          },
          {
              "x": 2,
              "y": 6,
              "type": "rough"
          }
      ],
      "objective": {
          "type": "eliminate"
      },
      "mana": 5,
      "playerStart": {
          "x": 3,
          "y": 1
      },
      "allyStarts": [
          {
              "x": 4,
              "y": 2
          },
          {
              "x": 2,
              "y": 2
          }
      ],
      "enemies": [
          {
              "cardId": 101,
              "owner": 1,
              "x": 3,
              "y": 9,
              "health": 25
          },
          {
              "cardId": 110,
              "owner": 1,
              "x": 4,
              "y": 7
          },
          {
              "cardId": 115,
              "owner": 1,
              "x": 2,
              "y": 8
          },
          {
              "cardId": 109,
              "owner": 1,
              "x": 5,
              "y": 8
          }
      ],
      "enemyDecks": {
          "1": [
              110,
              20081,
              115,
              109,
              20086
          ]
      },
      "reward": {
          "first": 220,
          "repeat": 65
      },
      "turnLimit": 15
  }),
  L({
      "id": "shadow-02",
      "chapterId": "shadow-pass",
      "title": "幽影渡口",
      "subtitle": "暗灵争夺落脚点",
      "goal": "击败敌方主将。",
      "hint": "封口与范围攻击能控制小型暗灵，留出转移空间。",
      "columns": 13,
      "rows": 7,
      "tiles": [
          {
              "x": 4,
              "y": 0,
              "type": "wall"
          },
          {
              "x": 4,
              "y": 1,
              "type": "wall"
          },
          {
              "x": 4,
              "y": 5,
              "type": "wall"
          },
          {
              "x": 4,
              "y": 6,
              "type": "wall"
          },
          {
              "x": 8,
              "y": 0,
              "type": "wall"
          },
          {
              "x": 8,
              "y": 1,
              "type": "wall"
          },
          {
              "x": 8,
              "y": 5,
              "type": "wall"
          },
          {
              "x": 8,
              "y": 6,
              "type": "wall"
          },
          {
              "x": 6,
              "y": 3,
              "type": "outpost"
          },
          {
              "x": 5,
              "y": 2,
              "type": "rough"
          },
          {
              "x": 7,
              "y": 4,
              "type": "rough"
          }
      ],
      "objective": {
          "type": "eliminate"
      },
      "mana": 5,
      "playerStart": {
          "x": 1,
          "y": 3
      },
      "allyStarts": [
          {
              "x": 2,
              "y": 2
          },
          {
              "x": 2,
              "y": 4
          }
      ],
      "enemies": [
          {
              "cardId": 301,
              "owner": 1,
              "x": 11,
              "y": 3,
              "health": 27
          },
          {
              "cardId": 308,
              "owner": 1,
              "x": 8,
              "y": 2
          },
          {
              "cardId": 317,
              "owner": 1,
              "x": 9,
              "y": 4
          },
          {
              "cardId": 311,
              "owner": 1,
              "x": 10,
              "y": 2
          }
      ],
      "enemyDecks": {
          "1": [
              308,
              317,
              20052,
              311,
              20072
          ]
      },
      "reward": {
          "first": 230,
          "repeat": 65
      },
      "turnLimit": 17
  }),
  L({
      "id": "shadow-03",
      "chapterId": "shadow-pass",
      "title": "两旗夜战",
      "subtitle": "借助敌军互相消耗",
      "goal": "击败两名敌方主将。",
      "hint": "宋海与深渊互为敌人，等待交战后选择突破方向。",
      "columns": 13,
      "rows": 9,
      "tiles": [
          {
              "x": 6,
              "y": 4,
              "type": "outpost"
          },
          {
              "x": 6,
              "y": 1,
              "type": "wall"
          },
          {
              "x": 6,
              "y": 7,
              "type": "wall"
          },
          {
              "x": 5,
              "y": 3,
              "type": "rough"
          },
          {
              "x": 7,
              "y": 5,
              "type": "rough"
          }
      ],
      "objective": {
          "type": "eliminate"
      },
      "mana": 5,
      "playerStart": {
          "x": 1,
          "y": 4
      },
      "allyStarts": [
          {
              "x": 2,
              "y": 3
          },
          {
              "x": 2,
              "y": 5
          }
      ],
      "enemies": [
          {
              "cardId": 123,
              "owner": 1,
              "x": 10,
              "y": 2,
              "health": 25
          },
          {
              "cardId": 115,
              "owner": 1,
              "x": 8,
              "y": 2
          },
          {
              "cardId": 109,
              "owner": 1,
              "x": 9,
              "y": 3
          },
          {
              "cardId": 323,
              "owner": 2,
              "x": 10,
              "y": 6,
              "health": 25
          },
          {
              "cardId": 317,
              "owner": 2,
              "x": 8,
              "y": 6
          },
          {
              "cardId": 308,
              "owner": 2,
              "x": 9,
              "y": 5
          }
      ],
      "enemyDecks": {
          "1": [
              110,
              20081,
              115,
              20086
          ],
          "2": [
              308,
              317,
              20052,
              311,
              20072
          ]
      },
      "reward": {
          "first": 240,
          "repeat": 65
      },
      "turnLimit": 18
  }),
  L({
      "id": "frost-01",
      "chapterId": "frost-siege",
      "title": "冰原猎线",
      "subtitle": "突破冰墙与射手",
      "goal": "击败敌方主将。",
      "hint": "带有潜入的敌人进入我方半场会变强，尽量提前拦截。",
      "columns": 13,
      "rows": 7,
      "tiles": [
          {
              "x": 6,
              "y": 3,
              "type": "outpost"
          },
          {
              "x": 6,
              "y": 1,
              "type": "wall"
          },
          {
              "x": 6,
              "y": 5,
              "type": "wall"
          },
          {
              "x": 7,
              "y": 2,
              "type": "rough"
          },
          {
              "x": 5,
              "y": 4,
              "type": "rough"
          }
      ],
      "objective": {
          "type": "eliminate"
      },
      "mana": 6,
      "playerStart": {
          "x": 11,
          "y": 3
      },
      "allyStarts": [
          {
              "x": 10,
              "y": 2
          },
          {
              "x": 10,
              "y": 4
          }
      ],
      "enemies": [
          {
              "cardId": 501,
              "owner": 1,
              "x": 1,
              "y": 3,
              "health": 28
          },
          {
              "cardId": 505,
              "owner": 1,
              "x": 4,
              "y": 2
          },
          {
              "cardId": 506,
              "owner": 1,
              "x": 3,
              "y": 4
          },
          {
              "cardId": 503,
              "owner": 1,
              "x": 2,
              "y": 1
          }
      ],
      "enemyDecks": {
          "1": [
              505,
              506,
              20139,
              503,
              20149
          ]
      },
      "reward": {
          "first": 250,
          "repeat": 70
      },
      "turnLimit": 17
  }),
  L({
      "id": "frost-02",
      "chapterId": "frost-siege",
      "title": "熔岩围城",
      "subtitle": "阻止重型单位接近",
      "goal": "击败敌方主将。",
      "hint": "敌军会成长和重生，及时清除重生之卵。",
      "columns": 13,
      "rows": 9,
      "tiles": [
          {
              "x": 5,
              "y": 2,
              "type": "wall"
          },
          {
              "x": 5,
              "y": 3,
              "type": "wall"
          },
          {
              "x": 5,
              "y": 5,
              "type": "wall"
          },
          {
              "x": 5,
              "y": 6,
              "type": "wall"
          },
          {
              "x": 3,
              "y": 4,
              "type": "outpost"
          },
          {
              "x": 7,
              "y": 1,
              "type": "outpost"
          },
          {
              "x": 7,
              "y": 7,
              "type": "outpost"
          }
      ],
      "objective": {
          "type": "eliminate"
      },
      "mana": 6,
      "playerStart": {
          "x": 1,
          "y": 4
      },
      "allyStarts": [
          {
              "x": 2,
              "y": 3
          },
          {
              "x": 2,
              "y": 5
          }
      ],
      "enemies": [
          {
              "cardId": 401,
              "owner": 1,
              "x": 11,
              "y": 4,
              "health": 30
          },
          {
              "cardId": 406,
              "owner": 1,
              "x": 8,
              "y": 3
          },
          {
              "cardId": 412,
              "owner": 1,
              "x": 9,
              "y": 5
          },
          {
              "cardId": 410,
              "owner": 1,
              "x": 10,
              "y": 2
          }
      ],
      "enemyDecks": {
          "1": [
              406,
              412,
              20116,
              410,
              20117
          ]
      },
      "reward": {
          "first": 260,
          "repeat": 70
      },
      "turnLimit": 18
  }),
  L({
      "id": "frost-03",
      "chapterId": "frost-siege",
      "title": "霜墙女王",
      "subtitle": "冰棱环绕的王座",
      "goal": "击败霜墙女王。",
      "hint": "冰棱护住女王：打碎她身边的冰棱，碎冰会伤到相邻的所有人。别停在冰封标记上。",
      "columns": 9,
      "rows": 5,
      "tiles": [],
      "objective": {
          "type": "eliminate"
      },
      "mana": 3,
      "playerStart": {
          "x": 1,
          "y": 2
      },
      "allyStarts": [],
      "enemies": [
          {
              "cardId": 527,
              "owner": 1,
              "x": 7,
              "y": 2,
              "health": 22
          },
          {
              "cardId": 9001,
              "owner": 1,
              "x": 6,
              "y": 1
          },
          {
              "cardId": 9001,
              "owner": 1,
              "x": 6,
              "y": 2
          },
          {
              "cardId": 9001,
              "owner": 1,
              "x": 6,
              "y": 3
          },
          {
              "cardId": 503,
              "owner": 1,
              "x": 6,
              "y": 4
          }
      ],
      "enemyDecks": {
          "1": [
              505,
              503,
              20139,
              511
          ]
      },
      "reward": {
          "first": 300,
          "repeat": 70
      },
      "turnLimit": 30,
      "boss": true
  }),
  ...EXPANSION_LEVELS.map(L)
]);





