const freeze = (value) => Object.freeze(value);

export const UNIT_TYPES = freeze({
  guard: freeze({ name: "卫队", cost: 100, supply: 1, hp: 234, damage: 22, range: 24, speed: 80, interval: 1, soldiers: 9 }),
  archer: freeze({ name: "弓手", cost: 120, supply: 1, hp: 144, damage: 36, range: 100, speed: 78, interval: 1.6, soldiers: 9 }),
  cavalry: freeze({ name: "骑兵", cost: 180, supply: 1, hp: 290, damage: 32, range: 28, speed: 110, interval: 1, soldiers: 5 }),
  siege: freeze({ name: "攻城车", cost: 200, supply: 2, hp: 400, damage: 55, range: 170, speed: 52, interval: 2, soldiers: 1 }),
  magic: freeze({ name: "法师", cost: 150, supply: 1, hp: 390, damage: 26, range: 110, speed: 75, interval: 1.5, soldiers: 6 }),
});

export const BUILDINGS = freeze({
  mine: freeze({ name: "矿场", cost: 150, description: "持续产出金币。" }),
  farm: freeze({ name: "农场", cost: 150, description: "提高编制上限。" }),
  obelisk: freeze({ name: "魔能工坊", cost: 150, description: "持续恢复法力。" }),
});

const nodes = [
  {
    "id": "W_HOME",
    "name": "西境王城",
    "x": 300,
    "y": 900,
    "kind": "castle",
    "owner": "player"
  },
  {
    "id": "W_GATE",
    "name": "西境城门",
    "x": 300,
    "y": 730,
    "kind": "road",
    "owner": "neutral"
  },
  {
    "id": "W_TOWN",
    "name": "青林镇",
    "x": 570,
    "y": 780,
    "kind": "town",
    "owner": "neutral"
  },
  {
    "id": "W_MAGIC",
    "name": "苍翠法师塔",
    "x": 390,
    "y": 450,
    "kind": "tower",
    "owner": "neutral"
  },
  {
    "id": "CENTER_CASTLE",
    "name": "中央王堡",
    "x": 950,
    "y": 650,
    "kind": "castle",
    "owner": "neutral"
  },
  {
    "id": "C_HOME",
    "name": "赤红王城",
    "x": 1580,
    "y": 900,
    "kind": "castle",
    "owner": "enemy"
  },
  {
    "id": "C_GATE",
    "name": "赤红城门",
    "x": 1560,
    "y": 730,
    "kind": "road",
    "owner": "neutral"
  },
  {
    "id": "C_TOWN",
    "name": "红岩镇",
    "x": 1330,
    "y": 780,
    "kind": "town",
    "owner": "neutral"
  },
  {
    "id": "C_MAGIC",
    "name": "霜原法师塔",
    "x": 1510,
    "y": 450,
    "kind": "tower",
    "owner": "neutral"
  },
  {
    "id": "I_CASTLE",
    "name": "旧日城堡",
    "x": 910,
    "y": 245,
    "kind": "castle",
    "owner": "neutral"
  },
  {
    "id": "I_HOME",
    "name": "教团王城",
    "x": 1330,
    "y": 245,
    "kind": "castle",
    "owner": "rival"
  },
  {
    "id": "OGRE_NW",
    "name": "西北侧翼守卫",
    "x": 640,
    "y": 325,
    "kind": "ogre",
    "owner": "neutral"
  },
  {
    "id": "OGRE_NE",
    "name": "北关守卫",
    "x": 950,
    "y": 430,
    "kind": "ogre",
    "owner": "neutral"
  },
  {
    "id": "OGRE_E",
    "name": "东北侧翼守卫",
    "x": 1570,
    "y": 290,
    "kind": "ogre",
    "owner": "neutral"
  },
  {
    "id": "OGRE_S",
    "name": "南道守卫",
    "x": 950,
    "y": 970,
    "kind": "ogre",
    "owner": "neutral"
  },
  {
    "id": "W_CHEST",
    "name": "西境宝箱",
    "x": 330,
    "y": 250,
    "kind": "chest",
    "owner": "neutral"
  },
  {
    "id": "C_CHEST",
    "name": "赤红宝箱",
    "x": 1700,
    "y": 490,
    "kind": "chest",
    "owner": "neutral"
  }
];

// Exactly 19 strategic edges: six main approaches feed the central front, seven flank
// links form the guarded northern detours, four pass links create the north and south
// guarded shortcuts, and two spur links lead only to reward chests.
const roads = [
  {
    "id": "R_W_HOME_GATE",
    "a": "W_HOME",
    "b": "W_GATE",
    "role": "main",
    "points": [
      {
        "x": 300,
        "y": 900
      },
      {
        "x": 300,
        "y": 730
      }
    ]
  },
  {
    "id": "R_W_GATE_TOWN",
    "a": "W_GATE",
    "b": "W_TOWN",
    "role": "main",
    "points": [
      {
        "x": 300,
        "y": 730
      },
      {
        "x": 570,
        "y": 780
      }
    ]
  },
  {
    "id": "R_W_GATE_MAGIC",
    "a": "W_GATE",
    "b": "W_MAGIC",
    "role": "flank",
    "points": [
      {
        "x": 300,
        "y": 730
      },
      {
        "x": 390,
        "y": 450
      }
    ]
  },
  {
    "id": "R_W_TOWN_CENTER",
    "a": "W_TOWN",
    "b": "CENTER_CASTLE",
    "role": "main",
    "points": [
      {
        "x": 570,
        "y": 780
      },
      {
        "x": 700,
        "y": 650
      },
      {
        "x": 950,
        "y": 650
      }
    ]
  },
  {
    "id": "R_C_HOME_GATE",
    "a": "C_HOME",
    "b": "C_GATE",
    "role": "main",
    "points": [
      {
        "x": 1580,
        "y": 900
      },
      {
        "x": 1560,
        "y": 730
      }
    ]
  },
  {
    "id": "R_C_GATE_TOWN",
    "a": "C_GATE",
    "b": "C_TOWN",
    "role": "main",
    "points": [
      {
        "x": 1560,
        "y": 730
      },
      {
        "x": 1330,
        "y": 780
      }
    ]
  },
  {
    "id": "R_C_GATE_MAGIC",
    "a": "C_GATE",
    "b": "C_MAGIC",
    "role": "flank",
    "points": [
      {
        "x": 1560,
        "y": 730
      },
      {
        "x": 1510,
        "y": 450
      }
    ]
  },
  {
    "id": "R_C_TOWN_CENTER",
    "a": "C_TOWN",
    "b": "CENTER_CASTLE",
    "role": "main",
    "points": [
      {
        "x": 1330,
        "y": 780
      },
      {
        "x": 1200,
        "y": 650
      },
      {
        "x": 950,
        "y": 650
      }
    ]
  },
  {
    "id": "R_CENTER_NORTH",
    "a": "CENTER_CASTLE",
    "b": "OGRE_NE",
    "role": "pass",
    "points": [
      {
        "x": 950,
        "y": 650
      },
      {
        "x": 950,
        "y": 430
      }
    ]
  },
  {
    "id": "R_NORTH_CASTLE",
    "a": "OGRE_NE",
    "b": "I_CASTLE",
    "role": "pass",
    "points": [
      {
        "x": 950,
        "y": 430
      },
      {
        "x": 910,
        "y": 245
      }
    ]
  },
  {
    "id": "R_I_CASTLE_HOME",
    "a": "I_CASTLE",
    "b": "I_HOME",
    "role": "flank",
    "points": [
      {
        "x": 910,
        "y": 245
      },
      {
        "x": 1330,
        "y": 245
      }
    ]
  },
  {
    "id": "R_W_MAGIC_OGRE",
    "a": "W_MAGIC",
    "b": "OGRE_NW",
    "role": "flank",
    "points": [
      {
        "x": 390,
        "y": 450
      },
      {
        "x": 640,
        "y": 325
      }
    ]
  },
  {
    "id": "R_W_OGRE_CASTLE",
    "a": "OGRE_NW",
    "b": "I_CASTLE",
    "role": "flank",
    "points": [
      {
        "x": 640,
        "y": 325
      },
      {
        "x": 910,
        "y": 245
      }
    ]
  },
  {
    "id": "R_C_MAGIC_OGRE",
    "a": "C_MAGIC",
    "b": "OGRE_E",
    "role": "flank",
    "points": [
      {
        "x": 1510,
        "y": 450
      },
      {
        "x": 1570,
        "y": 290
      }
    ]
  },
  {
    "id": "R_C_OGRE_HOME",
    "a": "OGRE_E",
    "b": "I_HOME",
    "role": "flank",
    "points": [
      {
        "x": 1570,
        "y": 290
      },
      {
        "x": 1330,
        "y": 245
      }
    ]
  },
  {
    "id": "R_W_TOWN_SOUTH",
    "a": "W_TOWN",
    "b": "OGRE_S",
    "role": "pass",
    "points": [
      {
        "x": 570,
        "y": 780
      },
      {
        "x": 950,
        "y": 970
      }
    ]
  },
  {
    "id": "R_SOUTH_C_TOWN",
    "a": "OGRE_S",
    "b": "C_TOWN",
    "role": "pass",
    "points": [
      {
        "x": 950,
        "y": 970
      },
      {
        "x": 1330,
        "y": 780
      }
    ]
  },
  {
    "id": "R_W_CHEST",
    "a": "W_MAGIC",
    "b": "W_CHEST",
    "role": "spur",
    "points": [
      {
        "x": 390,
        "y": 450
      },
      {
        "x": 330,
        "y": 250
      }
    ]
  },
  {
    "id": "R_C_CHEST",
    "a": "C_MAGIC",
    "b": "C_CHEST",
    "role": "spur",
    "points": [
      {
        "x": 1510,
        "y": 450
      },
      {
        "x": 1700,
        "y": 490
      }
    ]
  }
];

const slots = [
  {
    "id": "RES_W1",
    "hostId": "W_HOME",
    "x": 160,
    "y": 940
  },
  {
    "id": "RES_W2",
    "hostId": "W_TOWN",
    "x": 420,
    "y": 820
  },
  {
    "id": "RES_W3",
    "hostId": "W_MAGIC",
    "x": 260,
    "y": 550
  },
  {
    "id": "RES_W4",
    "hostId": "W_MAGIC",
    "x": 520,
    "y": 550
  },
  {
    "id": "RES_W5",
    "hostId": "W_TOWN",
    "x": 590,
    "y": 940
  },
  {
    "id": "RES_C1",
    "hostId": "C_HOME",
    "x": 1720,
    "y": 940
  },
  {
    "id": "RES_C2",
    "hostId": "C_TOWN",
    "x": 1480,
    "y": 820
  },
  {
    "id": "RES_C3",
    "hostId": "CENTER_CASTLE",
    "x": 950,
    "y": 810
  },
  {
    "id": "RES_C4",
    "hostId": "C_MAGIC",
    "x": 1380,
    "y": 550
  },
  {
    "id": "RES_C5",
    "hostId": "C_TOWN",
    "x": 1310,
    "y": 940
  },
  {
    "id": "RES_I1",
    "hostId": "I_HOME",
    "x": 1240,
    "y": 155
  },
  {
    "id": "RES_I2",
    "hostId": "I_HOME",
    "x": 1420,
    "y": 155
  },
  {
    "id": "RES_I3",
    "hostId": "I_HOME",
    "x": 1240,
    "y": 335
  },
  {
    "id": "RES_I4",
    "hostId": "I_HOME",
    "x": 1420,
    "y": 335
  },
  {
    "id": "RES_I5",
    "hostId": "I_CASTLE",
    "x": 770,
    "y": 150
  }
];

export const LEVEL = freeze({
  name: "三方拓疆 · 三方边境",
  shortName: "三方边境",
  world: freeze({ width: 1840, height: 1080 }),
  playerBaseId: "W_HOME",
  enemyBaseIds: freeze(["C_HOME"]),
  rivalBaseIds: freeze(["I_HOME"]),
  startingGold: freeze({ player: 250, enemy: 250, rival: 250 }),
  startingMana: freeze({ player: 100, enemy: 100, rival: 100 }),
  nodes: freeze(nodes.map(freeze)),
  roads: freeze(roads.map((road) => freeze({ ...road, points: freeze(road.points.map(freeze)) }))),
  slots: freeze(slots.map(freeze)),
  initialUnits: freeze([
    freeze({ nodeId: "W_HOME", owner: "player", kind: "guard", count: 1 }),
    freeze({ nodeId: "C_HOME", owner: "enemy", kind: "guard", count: 1 }),
    freeze({ nodeId: "I_HOME", owner: "rival", kind: "guard", count: 1 }),
  ]),
});
