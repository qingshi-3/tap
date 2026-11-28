// Frozen 0.4.6 frost-03 map for pre-content schema4–6 creation only.
// Source: release-0.4.6/package/duelyst-h5-0.4.6.zip, js/expedition-data.js
// SHA256 17b4b5551a8ca264298007dc48bf7edd86a8699584a573527542c04ad862e34e
export const LEGACY_FROST_LEVEL = Object.freeze({
  "id": "frost-03",
  "chapterId": "frost-siege",
  "title": "终夜会战",
  "subtitle": "冰霜与熔岩争夺城垒",
  "goal": "存活 12 回合并守住主将。",
  "hint": "两支敌军也会互相攻击，保护主将存活12回合即可获胜。",
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
    "rounds": 12
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
      "cardId": 527,
      "owner": 1,
      "x": 10,
      "y": 2,
      "health": 28
    },
    {
      "cardId": 505,
      "owner": 1,
      "x": 8,
      "y": 2
    },
    {
      "cardId": 506,
      "owner": 1,
      "x": 9,
      "y": 3
    },
    {
      "cardId": 418,
      "owner": 2,
      "x": 10,
      "y": 6,
      "health": 28
    },
    {
      "cardId": 406,
      "owner": 2,
      "x": 8,
      "y": 6
    },
    {
      "cardId": 412,
      "owner": 2,
      "x": 9,
      "y": 5
    }
  ],
  "enemyDecks": {
    "1": [
      505,
      506,
      20139,
      503,
      20149
    ],
    "2": [
      406,
      412,
      20116,
      410,
      20117
    ]
  },
  "reward": {
    "first": 270,
    "repeat": 70
  },
  "turnLimit": 12
});
