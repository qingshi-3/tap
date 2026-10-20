import { RECRUITMENT_CARDS, RECRUITMENT_UNIT_IDS } from './premium-cards.js';
// Campaign content revisions are copied into new battles; older matches retain their frozen snapshots.
export const CONTENT_VERSION = "campaign-2026-10-15-v4";
export const PRE_EXPANSION_UNIT_IDS = Object.freeze([9,11,14,15,16,17,108,109,110,111,115,116,209,211,213,214,215,216,308,309,310,311,316,317,402,404,406,410,412,413,503,505,506,511,513,526,10012,10019,10021,10981,19027,19037,19050,10001,10018,19026,10204,10013,10982,10017,10978,10020,19033,19034,19049,10207,10307,19042,10959]);
export const PRE_EXPANSION_SPELL_IDS = Object.freeze([20043,20044,20052,20066,20068,20072,20081,20086,20095,20116,20117,20139,20149,20151,20174,20168,20129,20073,20077,20049,20061,20125,20122,20134,20144]);
export const PRE_EXPANSION_LEVEL_IDS = Object.freeze(["border-01","border-02","border-03","road-01","road-02","road-03","banners-01","banners-02","banners-03","sand-01","sand-02","sand-03","shadow-01","shadow-02","shadow-03","frost-01","frost-02","frost-03"]);
export const NEW_ACQUISITION_IDS = Object.freeze([10,21,12,8,22,13,20064,20090,20067,112,114,117,122,120,119,20082,20087,20102,20155,210,212,221,208,219,220,20074,20096,20097,20153,313,319,312,318,321,314,20057,20133,20051,20154,417,403,407,415,405,414,20115,20119,20113,20157,510,512,517,519,515,507,20147,20136,20165,20163,19052,19040,10016,10301,10306,10995,10958]);
export const CARD_ACQUISITION = [
  ...RECRUITMENT_UNIT_IDS.map(id=>({id,type:'unit',faction:RECRUITMENT_CARDS[id].faction,acquisition:'recruitment',level:null})),
  {
    "id": 9,
    "type": "unit",
    "faction": 1,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 11,
    "type": "unit",
    "faction": 1,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 14,
    "type": "unit",
    "faction": 1,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 15,
    "type": "unit",
    "faction": 1,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 16,
    "type": "unit",
    "faction": 1,
    "acquisition": "campaign",
    "level": 3
  },
  {
    "id": 17,
    "type": "unit",
    "faction": 1,
    "acquisition": "recruitment",
    "level": null
  },
  {
    "id": 108,
    "type": "unit",
    "faction": 2,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 109,
    "type": "unit",
    "faction": 2,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 110,
    "type": "unit",
    "faction": 2,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 111,
    "type": "unit",
    "faction": 2,
    "acquisition": "campaign",
    "level": 3
  },
  {
    "id": 115,
    "type": "unit",
    "faction": 2,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 116,
    "type": "unit",
    "faction": 2,
    "acquisition": "recruitment",
    "level": null
  },
  {
    "id": 209,
    "type": "unit",
    "faction": 3,
    "acquisition": "campaign",
    "level": 3
  },
  {
    "id": 211,
    "type": "unit",
    "faction": 3,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 213,
    "type": "unit",
    "faction": 3,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 214,
    "type": "unit",
    "faction": 3,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 215,
    "type": "unit",
    "faction": 3,
    "acquisition": "recruitment",
    "level": null
  },
  {
    "id": 216,
    "type": "unit",
    "faction": 3,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 308,
    "type": "unit",
    "faction": 4,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 309,
    "type": "unit",
    "faction": 4,
    "acquisition": "campaign",
    "level": 3
  },
  {
    "id": 310,
    "type": "unit",
    "faction": 4,
    "acquisition": "recruitment",
    "level": null
  },
  {
    "id": 311,
    "type": "unit",
    "faction": 4,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 316,
    "type": "unit",
    "faction": 4,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 317,
    "type": "unit",
    "faction": 4,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 402,
    "type": "unit",
    "faction": 5,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 404,
    "type": "unit",
    "faction": 5,
    "acquisition": "recruitment",
    "level": null
  },
  {
    "id": 406,
    "type": "unit",
    "faction": 5,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 410,
    "type": "unit",
    "faction": 5,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 412,
    "type": "unit",
    "faction": 5,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 413,
    "type": "unit",
    "faction": 5,
    "acquisition": "campaign",
    "level": 3
  },
  {
    "id": 503,
    "type": "unit",
    "faction": 6,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 505,
    "type": "unit",
    "faction": 6,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 506,
    "type": "unit",
    "faction": 6,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 511,
    "type": "unit",
    "faction": 6,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 513,
    "type": "unit",
    "faction": 6,
    "acquisition": "campaign",
    "level": 3
  },
  {
    "id": 526,
    "type": "unit",
    "faction": 6,
    "acquisition": "recruitment",
    "level": null
  },
  {
    "id": 10012,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 9
  },
  {
    "id": 10019,
    "type": "unit",
    "faction": 0,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 10021,
    "type": "unit",
    "faction": 0,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 10981,
    "type": "unit",
    "faction": 0,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 19027,
    "type": "unit",
    "faction": 0,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 19037,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 1
  },
  {
    "id": 19050,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 7
  },
  {
    "id": 20043,
    "type": "spell",
    "faction": 1,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20044,
    "type": "spell",
    "faction": 1,
    "acquisition": "campaign",
    "level": 6
  },
  {
    "id": 20052,
    "type": "spell",
    "faction": 4,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20066,
    "type": "spell",
    "faction": 1,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20068,
    "type": "spell",
    "faction": 1,
    "acquisition": "campaign",
    "level": 12
  },
  {
    "id": 20072,
    "type": "spell",
    "faction": 4,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20081,
    "type": "spell",
    "faction": 2,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20086,
    "type": "spell",
    "faction": 2,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20095,
    "type": "spell",
    "faction": 3,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20116,
    "type": "spell",
    "faction": 5,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20117,
    "type": "spell",
    "faction": 5,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20139,
    "type": "spell",
    "faction": 6,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20149,
    "type": "spell",
    "faction": 6,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20151,
    "type": "spell",
    "faction": 3,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 20174,
    "type": "spell",
    "faction": 1,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 10001,
    "type": "unit",
    "faction": 0,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 10018,
    "type": "unit",
    "faction": 0,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 19026,
    "type": "unit",
    "faction": 0,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 10204,
    "type": "unit",
    "faction": 0,
    "acquisition": "initial",
    "level": null
  },
  {
    "id": 10013,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 2
  },
  {
    "id": 10982,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 4
  },
  {
    "id": 10017,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 5
  },
  {
    "id": 10978,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 6
  },
  {
    "id": 10020,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 8
  },
  {
    "id": 19033,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 10
  },
  {
    "id": 19034,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 11
  },
  {
    "id": 19049,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 12
  },
  {
    "id": 10207,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 13
  },
  {
    "id": 10307,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 14
  },
  {
    "id": 19042,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 16
  },
  {
    "id": 10959,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 17
  },
  {
    "id": 20168,
    "type": "spell",
    "faction": 2,
    "acquisition": "campaign",
    "level": 6
  },
  {
    "id": 20129,
    "type": "spell",
    "faction": 2,
    "acquisition": "campaign",
    "level": 12
  },
  {
    "id": 20073,
    "type": "spell",
    "faction": 3,
    "acquisition": "campaign",
    "level": 6
  },
  {
    "id": 20077,
    "type": "spell",
    "faction": 3,
    "acquisition": "campaign",
    "level": 12
  },
  {
    "id": 20049,
    "type": "spell",
    "faction": 4,
    "acquisition": "campaign",
    "level": 6
  },
  {
    "id": 20061,
    "type": "spell",
    "faction": 4,
    "acquisition": "campaign",
    "level": 12
  },
  {
    "id": 20125,
    "type": "spell",
    "faction": 5,
    "acquisition": "campaign",
    "level": 6
  },
  {
    "id": 20122,
    "type": "spell",
    "faction": 5,
    "acquisition": "campaign",
    "level": 12
  },
  {
    "id": 20134,
    "type": "spell",
    "faction": 6,
    "acquisition": "campaign",
    "level": 6
  },
  {
    "id": 20144,
    "type": "spell",
    "faction": 6,
    "acquisition": "campaign",
    "level": 12
  },
  {
    "id": 10,
    "type": "unit",
    "faction": 1,
    "acquisition": "campaign",
    "level": 2
  },
  {
    "id": 21,
    "type": "unit",
    "faction": 1,
    "acquisition": "campaign",
    "level": 5
  },
  {
    "id": 12,
    "type": "unit",
    "faction": 1,
    "acquisition": "campaign",
    "level": 8
  },
  {
    "id": 8,
    "type": "unit",
    "faction": 1,
    "acquisition": "campaign",
    "level": 11
  },
  {
    "id": 22,
    "type": "unit",
    "faction": 1,
    "acquisition": "campaign",
    "level": 19
  },
  {
    "id": 13,
    "type": "unit",
    "faction": 1,
    "acquisition": "campaign",
    "level": 22
  },
  {
    "id": 20064,
    "type": "spell",
    "faction": 1,
    "acquisition": "campaign",
    "level": 4
  },
  {
    "id": 20090,
    "type": "spell",
    "faction": 1,
    "acquisition": "campaign",
    "level": 7
  },
  {
    "id": 20067,
    "type": "spell",
    "faction": 1,
    "acquisition": "campaign",
    "level": 13
  },
  {
    "id": 112,
    "type": "unit",
    "faction": 2,
    "acquisition": "campaign",
    "level": 2
  },
  {
    "id": 114,
    "type": "unit",
    "faction": 2,
    "acquisition": "campaign",
    "level": 5
  },
  {
    "id": 117,
    "type": "unit",
    "faction": 2,
    "acquisition": "campaign",
    "level": 8
  },
  {
    "id": 122,
    "type": "unit",
    "faction": 2,
    "acquisition": "campaign",
    "level": 11
  },
  {
    "id": 120,
    "type": "unit",
    "faction": 2,
    "acquisition": "campaign",
    "level": 19
  },
  {
    "id": 119,
    "type": "unit",
    "faction": 2,
    "acquisition": "campaign",
    "level": 22
  },
  {
    "id": 20082,
    "type": "spell",
    "faction": 2,
    "acquisition": "campaign",
    "level": 4
  },
  {
    "id": 20087,
    "type": "spell",
    "faction": 2,
    "acquisition": "campaign",
    "level": 7
  },
  {
    "id": 20102,
    "type": "spell",
    "faction": 2,
    "acquisition": "campaign",
    "level": 13
  },
  {
    "id": 20155,
    "type": "spell",
    "faction": 2,
    "acquisition": "campaign",
    "level": 20
  },
  {
    "id": 210,
    "type": "unit",
    "faction": 3,
    "acquisition": "campaign",
    "level": 2
  },
  {
    "id": 212,
    "type": "unit",
    "faction": 3,
    "acquisition": "campaign",
    "level": 5
  },
  {
    "id": 221,
    "type": "unit",
    "faction": 3,
    "acquisition": "campaign",
    "level": 8
  },
  {
    "id": 208,
    "type": "unit",
    "faction": 3,
    "acquisition": "campaign",
    "level": 11
  },
  {
    "id": 219,
    "type": "unit",
    "faction": 3,
    "acquisition": "campaign",
    "level": 19
  },
  {
    "id": 220,
    "type": "unit",
    "faction": 3,
    "acquisition": "campaign",
    "level": 22
  },
  {
    "id": 20074,
    "type": "spell",
    "faction": 3,
    "acquisition": "campaign",
    "level": 4
  },
  {
    "id": 20096,
    "type": "spell",
    "faction": 3,
    "acquisition": "campaign",
    "level": 7
  },
  {
    "id": 20097,
    "type": "spell",
    "faction": 3,
    "acquisition": "campaign",
    "level": 13
  },
  {
    "id": 20153,
    "type": "spell",
    "faction": 3,
    "acquisition": "campaign",
    "level": 20
  },
  {
    "id": 313,
    "type": "unit",
    "faction": 4,
    "acquisition": "campaign",
    "level": 2
  },
  {
    "id": 319,
    "type": "unit",
    "faction": 4,
    "acquisition": "campaign",
    "level": 5
  },
  {
    "id": 312,
    "type": "unit",
    "faction": 4,
    "acquisition": "campaign",
    "level": 8
  },
  {
    "id": 318,
    "type": "unit",
    "faction": 4,
    "acquisition": "campaign",
    "level": 11
  },
  {
    "id": 321,
    "type": "unit",
    "faction": 4,
    "acquisition": "campaign",
    "level": 19
  },
  {
    "id": 314,
    "type": "unit",
    "faction": 4,
    "acquisition": "campaign",
    "level": 22
  },
  {
    "id": 20057,
    "type": "spell",
    "faction": 4,
    "acquisition": "campaign",
    "level": 4
  },
  {
    "id": 20133,
    "type": "spell",
    "faction": 4,
    "acquisition": "campaign",
    "level": 7
  },
  {
    "id": 20051,
    "type": "spell",
    "faction": 4,
    "acquisition": "campaign",
    "level": 13
  },
  {
    "id": 20154,
    "type": "spell",
    "faction": 4,
    "acquisition": "campaign",
    "level": 20
  },
  {
    "id": 417,
    "type": "unit",
    "faction": 5,
    "acquisition": "campaign",
    "level": 2
  },
  {
    "id": 403,
    "type": "unit",
    "faction": 5,
    "acquisition": "campaign",
    "level": 5
  },
  {
    "id": 407,
    "type": "unit",
    "faction": 5,
    "acquisition": "campaign",
    "level": 8
  },
  {
    "id": 415,
    "type": "unit",
    "faction": 5,
    "acquisition": "campaign",
    "level": 11
  },
  {
    "id": 405,
    "type": "unit",
    "faction": 5,
    "acquisition": "campaign",
    "level": 19
  },
  {
    "id": 414,
    "type": "unit",
    "faction": 5,
    "acquisition": "campaign",
    "level": 22
  },
  {
    "id": 20115,
    "type": "spell",
    "faction": 5,
    "acquisition": "campaign",
    "level": 4
  },
  {
    "id": 20119,
    "type": "spell",
    "faction": 5,
    "acquisition": "campaign",
    "level": 7
  },
  {
    "id": 20113,
    "type": "spell",
    "faction": 5,
    "acquisition": "campaign",
    "level": 13
  },
  {
    "id": 20157,
    "type": "spell",
    "faction": 5,
    "acquisition": "campaign",
    "level": 20
  },
  {
    "id": 510,
    "type": "unit",
    "faction": 6,
    "acquisition": "campaign",
    "level": 2
  },
  {
    "id": 512,
    "type": "unit",
    "faction": 6,
    "acquisition": "campaign",
    "level": 5
  },
  {
    "id": 517,
    "type": "unit",
    "faction": 6,
    "acquisition": "campaign",
    "level": 8
  },
  {
    "id": 519,
    "type": "unit",
    "faction": 6,
    "acquisition": "campaign",
    "level": 11
  },
  {
    "id": 515,
    "type": "unit",
    "faction": 6,
    "acquisition": "campaign",
    "level": 19
  },
  {
    "id": 507,
    "type": "unit",
    "faction": 6,
    "acquisition": "campaign",
    "level": 22
  },
  {
    "id": 20147,
    "type": "spell",
    "faction": 6,
    "acquisition": "campaign",
    "level": 4
  },
  {
    "id": 20136,
    "type": "spell",
    "faction": 6,
    "acquisition": "campaign",
    "level": 7
  },
  {
    "id": 20165,
    "type": "spell",
    "faction": 6,
    "acquisition": "campaign",
    "level": 13
  },
  {
    "id": 20163,
    "type": "spell",
    "faction": 6,
    "acquisition": "campaign",
    "level": 20
  },
  {
    "id": 19052,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 5
  },
  {
    "id": 19040,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 8
  },
  {
    "id": 10016,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 11
  },
  {
    "id": 10301,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 14
  },
  {
    "id": 10306,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 19
  },
  {
    "id": 10995,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 23
  },
  {
    "id": 10958,
    "type": "unit",
    "faction": 0,
    "acquisition": "campaign",
    "level": 26
  }
];

// One authored enemy plan per level (faction-specific variants removed in safe-v2).
export const AUTHORED_ENEMY_PLANS = {
 "border-01": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "前排与集火",
  "hint": "让随从挡在主将前方，集中攻击一名敌人。",
  "chapter": 1,
  "players": {
   "1": {
    "mana": 2,
    "maxMana": 2,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 3,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "assault",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 12,
    "generalAttack": 1,
    "generalId": 23,
    "deck": [
     14,
     9,
     14,
     14,
     9,
     10021,
     14,
     9,
     10021,
     14,
     9,
     10021
    ],
    "unitStats": {
     "9": {
      "cost": 2,
      "attack": 2,
      "health": 3
     },
     "14": {
      "cost": 1,
      "attack": 1,
      "health": 4
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 2
     }
    },
    "garrison": [
     {
      "id": 23,
      "x": 7,
      "y": 2,
      "attack": 1,
      "health": 12
     },
     {
      "id": 14,
      "x": 6,
      "y": 2,
      "attack": 1,
      "health": 4
     }
    ]
   }
  }
 },
 "border-02": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "侧翼远程",
  "hint": "敌方射手生命较低，可以绕到侧面或空投接近。",
  "chapter": 1,
  "players": {
   "1": {
    "mana": 2,
    "maxMana": 2,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 3,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 16,
    "generalAttack": 2,
    "generalId": 23,
    "deck": [
     10021,
     14,
     9,
     14,
     9,
     10021,
     10019,
     14,
     9,
     10021,
     10019,
     14,
     10021,
     10019
    ],
    "unitStats": {
     "9": {
      "cost": 2,
      "attack": 2,
      "health": 3
     },
     "14": {
      "cost": 1,
      "attack": 1,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 1
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 2
     }
    },
    "garrison": [
     {
      "id": 23,
      "x": 7,
      "y": 2,
      "attack": 2,
      "health": 16
     },
     {
      "id": 9,
      "x": 6,
      "y": 0,
      "attack": 2,
      "health": 3
     },
     {
      "id": 14,
      "x": 6,
      "y": 4,
      "attack": 1,
      "health": 4
     }
    ]
   }
  }
 },
 "border-03": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "守住前哨",
  "hint": "保护主将，存活7回合即可获胜。",
  "chapter": 1,
  "players": {
   "1": {
    "mana": 3,
    "maxMana": 3,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 3,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "assault",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 18,
    "generalAttack": 2,
    "generalId": 23,
    "deck": [
     14,
     10021,
     9,
     14,
     9,
     10021,
     19027,
     14,
     9,
     10021,
     19027,
     14,
     9,
     10021,
     19027,
     14
    ],
    "unitStats": {
     "9": {
      "cost": 2,
      "attack": 2,
      "health": 3
     },
     "14": {
      "cost": 1,
      "attack": 1,
      "health": 5
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 2
     },
     "19027": {
      "cost": 4,
      "attack": 2,
      "health": 6
     }
    },
    "garrison": [
     {
      "id": 23,
      "x": 8,
      "y": 2,
      "attack": 2,
      "health": 18
     },
     {
      "id": 14,
      "x": 6,
      "y": 1,
      "attack": 1,
      "health": 5
     },
     {
      "id": 9,
      "x": 7,
      "y": 2,
      "attack": 2,
      "health": 3
     }
    ]
   }
  }
 },
 "road-01": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "护卫与射手",
  "hint": "先击败挡路的护卫，或从侧面接近射手。",
  "chapter": 2,
  "players": {
   "1": {
    "mana": 3,
    "maxMana": 3,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 3,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 20,
    "generalAttack": 2,
    "generalId": 23,
    "deck": [
     14,
     11,
     10021,
     11,
     14,
     10021,
     20043,
     9,
     11,
     14,
     10021,
     20043,
     9,
     11,
     14,
     10021,
     9,
     9
    ],
    "unitStats": {
     "9": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "11": {
      "cost": 3,
      "attack": 2,
      "health": 6
     },
     "14": {
      "cost": 1,
      "attack": 2,
      "health": 5
     },
     "10021": {
      "cost": 2,
      "attack": 2,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 23,
      "x": 9,
      "y": 3,
      "attack": 2,
      "health": 20
     },
     {
      "id": 11,
      "x": 7,
      "y": 3,
      "attack": 2,
      "health": 6
     },
     {
      "id": 9,
      "x": 8,
      "y": 1,
      "attack": 3,
      "health": 4
     }
    ]
   }
  }
 },
 "road-02": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "治疗支援",
  "hint": "敌军会治疗逐光者，尽量在一回合内击败它。",
  "chapter": 2,
  "players": {
   "1": {
    "mana": 3,
    "maxMana": 3,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 3,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "support",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 22,
    "generalAttack": 2,
    "generalId": 1,
    "deck": [
     15,
     10981,
     11,
     15,
     10981,
     11,
     14,
     20043,
     10021,
     15,
     10981,
     11,
     14,
     20043,
     10021,
     10981,
     14,
     20043
    ],
    "unitStats": {
     "11": {
      "cost": 3,
      "attack": 2,
      "health": 6
     },
     "14": {
      "cost": 1,
      "attack": 2,
      "health": 5
     },
     "15": {
      "cost": 2,
      "attack": 3,
      "health": 3
     },
     "10021": {
      "cost": 2,
      "attack": 2,
      "health": 3
     },
     "10981": {
      "cost": 2,
      "attack": 2,
      "health": 4
     }
    },
    "garrison": [
     {
      "id": 1,
      "x": 9,
      "y": 3,
      "attack": 2,
      "health": 22
     },
     {
      "id": 15,
      "x": 8,
      "y": 2,
      "attack": 3,
      "health": 3
     },
     {
      "id": 14,
      "x": 8,
      "y": 4,
      "attack": 2,
      "health": 5
     }
    ]
   }
  }
 },
 "road-03": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "重装关隘",
  "hint": "护卫身后的射手可以远程攻击，注意保护受伤单位。",
  "chapter": 2,
  "players": {
   "1": {
    "mana": 4,
    "maxMana": 4,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 26,
    "generalAttack": 2,
    "generalId": 23,
    "deck": [
     14,
     11,
     10021,
     20066,
     11,
     19027,
     10021,
     16,
     20066,
     20043,
     14,
     11,
     19027,
     10021,
     16,
     20066,
     20043,
     14,
     11,
     19027,
     10021
    ],
    "unitStats": {
     "11": {
      "cost": 3,
      "attack": 2,
      "health": 7
     },
     "14": {
      "cost": 1,
      "attack": 2,
      "health": 5
     },
     "16": {
      "cost": 4,
      "attack": 3,
      "health": 7
     },
     "17": {
      "cost": 5,
      "attack": 3,
      "health": 8
     },
     "10021": {
      "cost": 2,
      "attack": 2,
      "health": 3
     },
     "19027": {
      "cost": 4,
      "attack": 3,
      "health": 7
     }
    },
    "garrison": [
     {
      "id": 23,
      "x": 9,
      "y": 3,
      "attack": 2,
      "health": 26
     },
     {
      "id": 17,
      "x": 7,
      "y": 3,
      "attack": 3,
      "health": 8
     },
     {
      "id": 11,
      "x": 8,
      "y": 2,
      "attack": 2,
      "health": 7
     }
    ]
   }
  }
 },
 "banners-01": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "两军交战",
  "hint": "两支敌军也会互相攻击，避免同时被两边围攻。",
  "chapter": 3,
  "players": {
   "1": {
    "mana": 3,
    "maxMana": 3,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 3,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 20,
    "generalAttack": 2,
    "generalId": 23,
    "deck": [
     14,
     11,
     15,
     11,
     15,
     10981,
     14,
     20043,
     11,
     15,
     10981,
     14,
     20043,
     11,
     10981,
     14,
     20043,
     14
    ],
    "unitStats": {
     "11": {
      "cost": 3,
      "attack": 2,
      "health": 7
     },
     "14": {
      "cost": 1,
      "attack": 2,
      "health": 6
     },
     "15": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "10981": {
      "cost": 2,
      "attack": 2,
      "health": 5
     }
    },
    "garrison": [
     {
      "id": 23,
      "x": 11,
      "y": 1,
      "attack": 2,
      "health": 20
     },
     {
      "id": 11,
      "x": 9,
      "y": 1,
      "attack": 2,
      "health": 7
     }
    ]
   },
   "2": {
    "mana": 3,
    "maxMana": 3,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 3,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 16,
    "generalAttack": 2,
    "generalId": 1,
    "deck": [
     9,
     10021,
     10019,
     9,
     10019,
     10021,
     20066,
     9,
     10019,
     10021,
     20066,
     9,
     10019,
     10021,
     20066,
     9,
     10021,
     20066
    ],
    "unitStats": {
     "9": {
      "cost": 2,
      "attack": 3,
      "health": 5
     },
     "10019": {
      "cost": 1,
      "attack": 3,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 2,
      "health": 4
     }
    },
    "garrison": [
     {
      "id": 1,
      "x": 11,
      "y": 5,
      "attack": 2,
      "health": 16
     },
     {
      "id": 9,
      "x": 9,
      "y": 5,
      "attack": 3,
      "health": 5
     }
    ]
   }
  }
 },
 "banners-02": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "争夺渡口",
  "hint": "两侧都有敌军，可以先集中攻击一侧。",
  "chapter": 3,
  "players": {
   "1": {
    "mana": 4,
    "maxMana": 4,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 3,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "support",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 22,
    "generalAttack": 2,
    "generalId": 23,
    "deck": [
     11,
     10981,
     15,
     11,
     15,
     16,
     10981,
     20043,
     14,
     11,
     15,
     16,
     10981,
     20043,
     14,
     11,
     16,
     10981,
     20043,
     14
    ],
    "unitStats": {
     "11": {
      "cost": 3,
      "attack": 2,
      "health": 7
     },
     "14": {
      "cost": 1,
      "attack": 2,
      "health": 6
     },
     "15": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "16": {
      "cost": 4,
      "attack": 3,
      "health": 8
     },
     "17": {
      "cost": 5,
      "attack": 3,
      "health": 10
     },
     "10981": {
      "cost": 2,
      "attack": 2,
      "health": 5
     }
    },
    "garrison": [
     {
      "id": 23,
      "x": 11,
      "y": 2,
      "attack": 2,
      "health": 22
     },
     {
      "id": 17,
      "x": 9,
      "y": 2,
      "attack": 3,
      "health": 10
     },
     {
      "id": 15,
      "x": 10,
      "y": 3,
      "attack": 3,
      "health": 4
     },
     {
      "id": 14,
      "x": 8,
      "y": 3,
      "attack": 2,
      "health": 6
     }
    ]
   },
   "2": {
    "mana": 3,
    "maxMana": 3,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 3,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 18,
    "generalAttack": 2,
    "generalId": 1,
    "deck": [
     10019,
     9,
     10021,
     10019,
     9,
     10021,
     19037,
     20066,
     10019,
     9,
     10021,
     19037,
     20066,
     10019,
     9,
     10021,
     19037,
     20066,
     10021,
     20066
    ],
    "unitStats": {
     "9": {
      "cost": 2,
      "attack": 3,
      "health": 5
     },
     "11": {
      "cost": 3,
      "attack": 2,
      "health": 7
     },
     "14": {
      "cost": 1,
      "attack": 2,
      "health": 6
     },
     "10019": {
      "cost": 1,
      "attack": 3,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "19037": {
      "cost": 2,
      "attack": 3,
      "health": 4
     }
    },
    "garrison": [
     {
      "id": 1,
      "x": 11,
      "y": 6,
      "attack": 2,
      "health": 18
     },
     {
      "id": 11,
      "x": 9,
      "y": 6,
      "attack": 2,
      "health": 7
     },
     {
      "id": 14,
      "x": 10,
      "y": 5,
      "attack": 2,
      "health": 6
     }
    ]
   }
  }
 },
 "banners-03": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "三旗坚守",
  "hint": "保护主将，存活10回合即可获胜。",
  "chapter": 3,
  "players": {
   "1": {
    "mana": 4,
    "maxMana": 4,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 24,
    "generalAttack": 2,
    "generalId": 23,
    "deck": [
     11,
     15,
     10981,
     20043,
     11,
     17,
     16,
     15,
     10981,
     20043,
     14,
     11,
     17,
     16,
     15,
     10981,
     20043,
     14,
     11,
     16,
     10981,
     14
    ],
    "unitStats": {
     "11": {
      "cost": 3,
      "attack": 2,
      "health": 7
     },
     "14": {
      "cost": 1,
      "attack": 2,
      "health": 6
     },
     "15": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "16": {
      "cost": 4,
      "attack": 3,
      "health": 8
     },
     "17": {
      "cost": 5,
      "attack": 3,
      "health": 10
     },
     "10981": {
      "cost": 2,
      "attack": 2,
      "health": 5
     }
    },
    "garrison": [
     {
      "id": 23,
      "x": 11,
      "y": 2,
      "attack": 2,
      "health": 24
     },
     {
      "id": 17,
      "x": 9,
      "y": 2,
      "attack": 3,
      "health": 10
     },
     {
      "id": 16,
      "x": 10,
      "y": 3,
      "attack": 3,
      "health": 8
     }
    ]
   },
   "2": {
    "mana": 4,
    "maxMana": 4,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 3,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "assault",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 20,
    "generalAttack": 2,
    "generalId": 1,
    "deck": [
     9,
     10019,
     10021,
     9,
     10012,
     10019,
     10021,
     20066,
     19037,
     9,
     10012,
     10019,
     10021,
     20066,
     19037,
     9,
     10019,
     10021,
     20066,
     19037,
     9,
     10021
    ],
    "unitStats": {
     "9": {
      "cost": 2,
      "attack": 3,
      "health": 5
     },
     "11": {
      "cost": 3,
      "attack": 2,
      "health": 7
     },
     "15": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "10012": {
      "cost": 4,
      "attack": 3,
      "health": 3
     },
     "10019": {
      "cost": 1,
      "attack": 3,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "19037": {
      "cost": 2,
      "attack": 3,
      "health": 4
     }
    },
    "garrison": [
     {
      "id": 1,
      "x": 9,
      "y": 8,
      "attack": 2,
      "health": 20
     },
     {
      "id": 11,
      "x": 9,
      "y": 7,
      "attack": 2,
      "health": 7
     },
     {
      "id": 15,
      "x": 8,
      "y": 7,
      "attack": 3,
      "health": 4
     }
    ]
   }
  }
 },
 "sand-01": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "沙魔援军",
  "hint": "方尖碑会不断召唤沙魔，击败它可阻止增援。",
  "chapter": 4,
  "players": {
   "1": {
    "mana": 4,
    "maxMana": 4,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 26,
    "generalAttack": 2,
    "generalId": 201,
    "deck": [
     214,
     213,
     211,
     20095,
     214,
     213,
     211,
     10021,
     20095,
     20151,
     214,
     213,
     211,
     10021,
     20095,
     20151,
     214,
     213,
     211,
     10021,
     20151,
     213,
     10021,
     213
    ],
    "unitStats": {
     "211": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "213": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "214": {
      "cost": 2,
      "attack": 0,
      "health": 7
     },
     "10021": {
      "cost": 2,
      "attack": 2,
      "health": 4
     }
    },
    "garrison": [
     {
      "id": 201,
      "x": 9,
      "y": 3,
      "attack": 2,
      "health": 26
     },
     {
      "id": 213,
      "x": 7,
      "y": 3,
      "attack": 3,
      "health": 4
     },
     {
      "id": 211,
      "x": 8,
      "y": 1,
      "attack": 2,
      "health": 4
     }
    ]
   }
  }
 },
 "sand-02": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "双塔协同",
  "hint": "金焰方尖碑会强化沙魔，可以优先击败它。",
  "chapter": 4,
  "players": {
   "1": {
    "mana": 4,
    "maxMana": 4,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "support",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 28,
    "generalAttack": 2,
    "generalId": 223,
    "deck": [
     214,
     213,
     211,
     20095,
     215,
     214,
     213,
     211,
     10981,
     20095,
     20151,
     215,
     214,
     213,
     211,
     10981,
     20095,
     20151,
     214,
     213,
     211,
     20151,
     213,
     213
    ],
    "unitStats": {
     "211": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "213": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "214": {
      "cost": 2,
      "attack": 0,
      "health": 7
     },
     "215": {
      "cost": 3,
      "attack": 0,
      "health": 8
     },
     "10981": {
      "cost": 2,
      "attack": 2,
      "health": 5
     }
    },
    "garrison": [
     {
      "id": 223,
      "x": 11,
      "y": 3,
      "attack": 2,
      "health": 28
     },
     {
      "id": 211,
      "x": 9,
      "y": 1,
      "attack": 2,
      "health": 4
     },
     {
      "id": 211,
      "x": 9,
      "y": 5,
      "attack": 2,
      "health": 4
     }
    ]
   }
  }
 },
 "sand-03": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "沙海军团",
  "hint": "避开爆破单位所在的行，给主将留出退路。",
  "chapter": 4,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 30,
    "generalAttack": 2,
    "generalId": 201,
    "deck": [
     214,
     213,
     211,
     20095,
     215,
     214,
     213,
     209,
     211,
     19027,
     20151,
     20095,
     215,
     214,
     213,
     209,
     211,
     19027,
     20151,
     20095,
     214,
     213,
     209,
     20151,
     213,
     213,
     213
    ],
    "unitStats": {
     "209": {
      "cost": 5,
      "attack": 5,
      "health": 8
     },
     "211": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "213": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "214": {
      "cost": 2,
      "attack": 0,
      "health": 7
     },
     "215": {
      "cost": 3,
      "attack": 0,
      "health": 9
     },
     "19027": {
      "cost": 4,
      "attack": 3,
      "health": 8
     }
    },
    "garrison": [
     {
      "id": 201,
      "x": 11,
      "y": 4,
      "attack": 2,
      "health": 30
     },
     {
      "id": 213,
      "x": 8,
      "y": 3,
      "attack": 3,
      "health": 4
     },
     {
      "id": 214,
      "x": 9,
      "y": 5,
      "attack": 0,
      "health": 7
     },
     {
      "id": 211,
      "x": 10,
      "y": 2,
      "attack": 2,
      "health": 4
     }
    ]
   }
  }
 },
 "shadow-01": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "后排突袭",
  "hint": "敌军能从背后攻击，注意主将身后的空格。",
  "chapter": 5,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 28,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     109,
     115,
     20086,
     110,
     109,
     111,
     10019,
     115,
     20081,
     20086,
     110,
     109,
     111,
     10019,
     115,
     20081,
     20086,
     110,
     109,
     10019,
     20081,
     110,
     10019
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "111": {
      "cost": 5,
      "attack": 3,
      "health": 6
     },
     "115": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 3,
      "health": 2
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 3,
      "y": 9,
      "attack": 3,
      "health": 28
     },
     {
      "id": 110,
      "x": 4,
      "y": 7,
      "attack": 3,
      "health": 4
     },
     {
      "id": 115,
      "x": 2,
      "y": 8,
      "attack": 2,
      "health": 4
     },
     {
      "id": 109,
      "x": 5,
      "y": 8,
      "attack": 3,
      "health": 4
     }
    ]
   }
  }
 },
 "shadow-02": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "腐化与亡愿",
  "hint": "暗灵死亡会强化敌方单位，先处理带有死亡监视的敌人。",
  "chapter": 5,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "support",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 30,
    "generalAttack": 3,
    "generalId": 301,
    "deck": [
     317,
     308,
     316,
     20072,
     317,
     308,
     311,
     316,
     19050,
     20072,
     20052,
     317,
     308,
     311,
     316,
     19050,
     20072,
     20052,
     317,
     308,
     311,
     19050,
     20072,
     20052,
     317,
     308
    ],
    "unitStats": {
     "308": {
      "cost": 1,
      "attack": 3,
      "health": 3
     },
     "311": {
      "cost": 3,
      "attack": 2,
      "health": 5
     },
     "316": {
      "cost": 2,
      "attack": 1,
      "health": 6
     },
     "317": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "19050": {
      "cost": 2,
      "attack": 2,
      "health": 5
     }
    },
    "garrison": [
     {
      "id": 301,
      "x": 11,
      "y": 3,
      "attack": 3,
      "health": 30
     },
     {
      "id": 308,
      "x": 8,
      "y": 2,
      "attack": 3,
      "health": 3
     },
     {
      "id": 317,
      "x": 9,
      "y": 4,
      "attack": 3,
      "health": 4
     }
    ]
   }
  }
 },
 "shadow-03": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "暗影会战",
  "hint": "两支敌军也会互相攻击，溅射能同时伤害相邻敌人。",
  "chapter": 5,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 28,
    "generalAttack": 3,
    "generalId": 123,
    "deck": [
     110,
     109,
     115,
     20086,
     110,
     111,
     109,
     115,
     20081,
     20086,
     110,
     111,
     109,
     115,
     20081,
     20086,
     110,
     111,
     109,
     20081,
     20086,
     110,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "111": {
      "cost": 5,
      "attack": 3,
      "health": 6
     },
     "115": {
      "cost": 2,
      "attack": 2,
      "health": 4
     }
    },
    "garrison": [
     {
      "id": 123,
      "x": 10,
      "y": 2,
      "attack": 3,
      "health": 28
     },
     {
      "id": 115,
      "x": 8,
      "y": 2,
      "attack": 2,
      "health": 4
     },
     {
      "id": 109,
      "x": 9,
      "y": 3,
      "attack": 3,
      "health": 4
     }
    ]
   },
   "2": {
    "mana": 4,
    "maxMana": 4,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "support",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 26,
    "generalAttack": 3,
    "generalId": 323,
    "deck": [
     317,
     308,
     311,
     20072,
     317,
     308,
     311,
     316,
     19050,
     20072,
     20052,
     317,
     308,
     311,
     316,
     19050,
     20072,
     20052,
     317,
     308,
     311,
     316,
     19050,
     317
    ],
    "unitStats": {
     "308": {
      "cost": 1,
      "attack": 3,
      "health": 3
     },
     "311": {
      "cost": 3,
      "attack": 2,
      "health": 5
     },
     "316": {
      "cost": 2,
      "attack": 1,
      "health": 6
     },
     "317": {
      "cost": 2,
      "attack": 3,
      "health": 4
     },
     "19050": {
      "cost": 2,
      "attack": 2,
      "health": 5
     }
    },
    "garrison": [
     {
      "id": 323,
      "x": 10,
      "y": 6,
      "attack": 3,
      "health": 26
     },
     {
      "id": 317,
      "x": 8,
      "y": 6,
      "attack": 3,
      "health": 4
     },
     {
      "id": 308,
      "x": 9,
      "y": 5,
      "attack": 3,
      "health": 3
     }
    ]
   }
  }
 },
 "frost-01": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "冰墙封路",
  "hint": "飞行和空投可以绕过冰墙，驱散能移除冰墙。",
  "chapter": 6,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 32,
    "generalAttack": 3,
    "generalId": 501,
    "deck": [
     505,
     511,
     20149,
     503,
     505,
     503,
     511,
     19027,
     513,
     20149,
     20139,
     505,
     503,
     511,
     19027,
     513,
     20149,
     20139,
     505,
     503,
     511,
     19027,
     20149,
     20139,
     505,
     20149,
     20139,
     505
    ],
    "unitStats": {
     "503": {
      "cost": 3,
      "attack": 4,
      "health": 4
     },
     "505": {
      "cost": 2,
      "attack": 3,
      "health": 6
     },
     "506": {
      "cost": 2,
      "attack": 2,
      "health": 3
     },
     "511": {
      "cost": 3,
      "attack": 2,
      "health": 6
     },
     "513": {
      "cost": 4,
      "attack": 4,
      "health": 5
     },
     "19027": {
      "cost": 4,
      "attack": 3,
      "health": 9
     }
    },
    "garrison": [
     {
      "id": 501,
      "x": 1,
      "y": 3,
      "attack": 3,
      "health": 32
     },
     {
      "id": 505,
      "x": 4,
      "y": 2,
      "attack": 3,
      "health": 6
     },
     {
      "id": 506,
      "x": 3,
      "y": 4,
      "attack": 2,
      "health": 3
     },
     {
      "id": 503,
      "x": 2,
      "y": 1,
      "attack": 4,
      "health": 4
     }
    ]
   }
  }
 },
 "frost-02": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "重生攻坚",
  "hint": "重生之卵只有1生命，及时击败它可阻止敌人复活。",
  "chapter": 6,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "assault",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 34,
    "generalAttack": 3,
    "generalId": 401,
    "deck": [
     412,
     402,
     410,
     20116,
     412,
     413,
     402,
     19027,
     410,
     20116,
     20117,
     412,
     413,
     402,
     19027,
     410,
     20116,
     20117,
     412,
     413,
     402,
     19027,
     20116,
     20117,
     412,
     413,
     20117,
     412
    ],
    "unitStats": {
     "402": {
      "cost": 3,
      "attack": 4,
      "health": 6
     },
     "406": {
      "cost": 2,
      "attack": 6,
      "health": 2
     },
     "410": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "412": {
      "cost": 2,
      "attack": 3,
      "health": 5
     },
     "413": {
      "cost": 4,
      "attack": 5,
      "health": 6
     },
     "19027": {
      "cost": 4,
      "attack": 3,
      "health": 9
     }
    },
    "garrison": [
     {
      "id": 401,
      "x": 11,
      "y": 4,
      "attack": 3,
      "health": 34
     },
     {
      "id": 406,
      "x": 8,
      "y": 3,
      "attack": 6,
      "health": 2
     },
     {
      "id": 412,
      "x": 9,
      "y": 5,
      "attack": 3,
      "health": 5
     },
     {
      "id": 410,
      "x": 10,
      "y": 2,
      "attack": 3,
      "health": 4
     }
    ]
   }
  }
 },
 "frost-03": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "霜墙女王",
  "hint": "冰棱护住女王：打碎她身边的冰棱，碎冰会伤到相邻的所有人。别停在冰封标记上。",
  "chapter": 6,
  "boss": {
   "id": "frost-queen"
  },
  "players": {
   "1": {
    "mana": 3,
    "maxMana": 3,
    "manaGrowth": 1,
    "manaCap": 5,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 6,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 22,
    "generalAttack": 2,
    "generalId": 527,
    "deck": [
     505,
     503,
     511,
     20139,
     505,
     503,
     511,
     513,
     20139,
     505,
     503,
     511,
     513,
     20139,
     505,
     503,
     511,
     513,
     505,
     503
    ],
    "unitStats": {"503":{"cost":3,"attack":3,"health":2},"505":{"cost":2,"attack":2,"health":3},"511":{"cost":3,"attack":1,"health":4},"513":{"cost":4,"attack":4,"health":3}},
    "garrison": [
     {
      "id": 527,
      "x": 7,
      "y": 2,
      "attack": 2,
      "health": 22
     },
     {
      "id": 9001,
      "x": 6,
      "y": 1,
      "attack": 0,
      "health": 3
     },
     {
      "id": 9001,
      "x": 6,
      "y": 2,
      "attack": 0,
      "health": 3
     },
     {
      "id": 9001,
      "x": 6,
      "y": 3,
      "attack": 0,
      "health": 3
     },
     {
      "id": 503,
      "x": 6,
      "y": 4,
      "attack": 3,
      "health": 2
     }
    ]
   }
  }
 },
 "crossroads-01": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "四岔渡口",
  "hint": "绕过断开的中轴，选择一翼推进。",
  "chapter": 7,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 30,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 5,
      "y": 7,
      "attack": 3,
      "health": 30
     },
     {
      "id": 110,
      "x": 5,
      "y": 6,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 4,
      "y": 6,
      "attack": 1,
      "health": 3
     },
     {
      "id": 109,
      "x": 6,
      "y": 6,
      "attack": 2,
      "health": 4
     }
    ]
   }
  }
 },
 "crossroads-02": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "错位桥头",
  "hint": "绕开错位墙体，夺取中央前哨。",
  "chapter": 7,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 30,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 11,
      "y": 1,
      "attack": 3,
      "health": 30
     },
     {
      "id": 110,
      "x": 10,
      "y": 2,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 11,
      "y": 3,
      "attack": 1,
      "health": 3
     },
     {
      "id": 109,
      "x": 9,
      "y": 1,
      "attack": 2,
      "health": 4
     }
    ]
   }
  }
 },
 "crossroads-03": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "三面来敌",
  "hint": "从两军之间撤向一侧，守住主将。",
  "chapter": 7,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 32,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 1,
      "y": 1,
      "attack": 3,
      "health": 32
     },
     {
      "id": 110,
      "x": 2,
      "y": 2,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 3,
      "y": 1,
      "attack": 1,
      "health": 3
     },
     {
      "id": 109,
      "x": 1,
      "y": 3,
      "attack": 2,
      "health": 4
     }
    ]
   },
   "2": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 32,
    "generalAttack": 3,
    "generalId": 527,
    "deck": [
     11,
     10021,
     505,
     20149,
     10981,
     512,
     20139,
     14,
     505,
     519,
     11,
     20149,
     10021,
     10981,
     20139,
     10981,
     512,
     20139,
     14,
     505,
     519,
     11,
     20149,
     10021,
     10981,
     20139,
     11,
     10021,
     505,
     20149
    ],
    "unitStats": {
     "11": {
      "cost": 3,
      "attack": 1,
      "health": 6
     },
     "14": {
      "cost": 1,
      "attack": 1,
      "health": 5
     },
     "505": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "512": {
      "cost": 2,
      "attack": 1,
      "health": 4
     },
     "519": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "10981": {
      "cost": 2,
      "attack": 2,
      "health": 4
     }
    },
    "garrison": [
     {
      "id": 527,
      "x": 9,
      "y": 7,
      "attack": 3,
      "health": 32
     },
     {
      "id": 11,
      "x": 8,
      "y": 6,
      "attack": 1,
      "health": 6
     },
     {
      "id": 10021,
      "x": 7,
      "y": 7,
      "attack": 1,
      "health": 3
     },
     {
      "id": 505,
      "x": 9,
      "y": 5,
      "attack": 2,
      "health": 4
     }
    ]
   }
  }
 },
 "citadel-01": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "外堡回廊",
  "hint": "沿堡垒两侧绕行，拆除远程支援。",
  "chapter": 8,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 30,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 11,
      "y": 4,
      "attack": 3,
      "health": 30
     },
     {
      "id": 110,
      "x": 10,
      "y": 4,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 10,
      "y": 5,
      "attack": 1,
      "health": 3
     },
     {
      "id": 109,
      "x": 10,
      "y": 3,
      "attack": 2,
      "health": 4
     }
    ]
   }
  }
 },
 "citadel-02": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "双门换防",
  "hint": "两门间轮换部队，避免堵住自己的退路。",
  "chapter": 8,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 30,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 5,
      "y": 1,
      "attack": 3,
      "health": 30
     },
     {
      "id": 110,
      "x": 5,
      "y": 2,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 6,
      "y": 2,
      "attack": 1,
      "health": 3
     },
     {
      "id": 109,
      "x": 4,
      "y": 2,
      "attack": 2,
      "health": 4
     }
    ]
   }
  }
 },
 "citadel-03": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "孤堡突围",
  "hint": "集中突破一侧，再转向另一名敌将。",
  "chapter": 8,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 32,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 1,
      "y": 4,
      "attack": 3,
      "health": 32
     },
     {
      "id": 110,
      "x": 2,
      "y": 4,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 2,
      "y": 3,
      "attack": 1,
      "health": 3
     },
     {
      "id": 109,
      "x": 2,
      "y": 5,
      "attack": 2,
      "health": 4
     }
    ]
   },
   "2": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 32,
    "generalAttack": 3,
    "generalId": 527,
    "deck": [
     11,
     10021,
     505,
     20149,
     10981,
     512,
     20139,
     14,
     505,
     519,
     11,
     20149,
     10021,
     10981,
     20139,
     10981,
     512,
     20139,
     14,
     505,
     519,
     11,
     20149,
     10021,
     10981,
     20139,
     11,
     10021,
     505,
     20149
    ],
    "unitStats": {
     "11": {
      "cost": 3,
      "attack": 1,
      "health": 6
     },
     "14": {
      "cost": 1,
      "attack": 1,
      "health": 5
     },
     "505": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "512": {
      "cost": 2,
      "attack": 1,
      "health": 4
     },
     "519": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "10981": {
      "cost": 2,
      "attack": 2,
      "health": 4
     }
    },
    "garrison": [
     {
      "id": 527,
      "x": 9,
      "y": 4,
      "attack": 3,
      "health": 32
     },
     {
      "id": 11,
      "x": 8,
      "y": 4,
      "attack": 1,
      "health": 6
     },
     {
      "id": 10021,
      "x": 8,
      "y": 5,
      "attack": 1,
      "health": 3
     },
     {
      "id": 505,
      "x": 8,
      "y": 3,
      "attack": 2,
      "health": 4
     }
    ]
   }
  }
 },
 "ruins-01": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "裂隙遗城",
  "hint": "沿斜向通路接近火力，及时清理重生与召唤。",
  "chapter": 9,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 30,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 11,
      "y": 1,
      "attack": 3,
      "health": 30
     },
     {
      "id": 110,
      "x": 10,
      "y": 2,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 11,
      "y": 3,
      "attack": 1,
      "health": 3
     },
     {
      "id": 112,
      "x": 9,
      "y": 1,
      "attack": 3,
      "health": 4
     }
    ]
   }
  }
 },
 "ruins-02": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "回响祭阵",
  "hint": "主动拆掉侧翼生产和支援节点。",
  "chapter": 9,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 30,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 5,
      "y": 7,
      "attack": 3,
      "health": 30
     },
     {
      "id": 110,
      "x": 5,
      "y": 6,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 4,
      "y": 6,
      "attack": 1,
      "health": 3
     },
     {
      "id": 112,
      "x": 6,
      "y": 6,
      "attack": 3,
      "health": 4
     }
    ]
   }
  }
 },
 "ruins-03": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "遗城守夜",
  "hint": "在两侧前哨之间转移，保护主将。",
  "chapter": 9,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 32,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 2,
      "y": 1,
      "attack": 3,
      "health": 32
     },
     {
      "id": 110,
      "x": 3,
      "y": 2,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 4,
      "y": 1,
      "attack": 1,
      "health": 3
     },
     {
      "id": 112,
      "x": 2,
      "y": 3,
      "attack": 3,
      "health": 4
     }
    ]
   },
   "2": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 32,
    "generalAttack": 3,
    "generalId": 527,
    "deck": [
     11,
     10021,
     505,
     20149,
     10981,
     512,
     20139,
     14,
     505,
     519,
     11,
     20149,
     10021,
     10981,
     20139,
     10981,
     512,
     20139,
     14,
     505,
     519,
     11,
     20149,
     10021,
     10981,
     20139,
     11,
     10021,
     505,
     20149
    ],
    "unitStats": {
     "11": {
      "cost": 3,
      "attack": 1,
      "health": 6
     },
     "14": {
      "cost": 1,
      "attack": 1,
      "health": 5
     },
     "505": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "512": {
      "cost": 2,
      "attack": 1,
      "health": 4
     },
     "519": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "10981": {
      "cost": 2,
      "attack": 2,
      "health": 4
     }
    },
    "garrison": [
     {
      "id": 527,
      "x": 10,
      "y": 1,
      "attack": 3,
      "health": 32
     },
     {
      "id": 11,
      "x": 9,
      "y": 2,
      "attack": 1,
      "health": 6
     },
     {
      "id": 10021,
      "x": 10,
      "y": 3,
      "attack": 1,
      "health": 3
     },
     {
      "id": 512,
      "x": 8,
      "y": 1,
      "attack": 1,
      "health": 4
     }
    ]
   }
  }
 },
 "confluence-01": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "寒沙交界",
  "hint": "选择一翼推进，利用两軍交火窗口。",
  "chapter": 10,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 30,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 11,
      "y": 2,
      "attack": 3,
      "health": 30
     },
     {
      "id": 110,
      "x": 10,
      "y": 3,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 11,
      "y": 4,
      "attack": 1,
      "health": 3
     },
     {
      "id": 112,
      "x": 9,
      "y": 2,
      "attack": 3,
      "health": 4
     }
    ]
   },
   "2": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 30,
    "generalAttack": 3,
    "generalId": 527,
    "deck": [
     11,
     10021,
     505,
     20149,
     10981,
     512,
     20139,
     14,
     505,
     519,
     11,
     20149,
     10021,
     10981,
     20139,
     10981,
     512,
     20139,
     14,
     505,
     519,
     11,
     20149,
     10021,
     10981,
     20139,
     11,
     10021,
     505,
     20149
    ],
    "unitStats": {
     "11": {
      "cost": 3,
      "attack": 1,
      "health": 6
     },
     "14": {
      "cost": 1,
      "attack": 1,
      "health": 5
     },
     "505": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "512": {
      "cost": 2,
      "attack": 1,
      "health": 4
     },
     "519": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "10981": {
      "cost": 2,
      "attack": 2,
      "health": 4
     }
    },
    "garrison": [
     {
      "id": 527,
      "x": 11,
      "y": 6,
      "attack": 3,
      "health": 30
     },
     {
      "id": 11,
      "x": 12,
      "y": 3,
      "attack": 1,
      "health": 6
     },
     {
      "id": 10021,
      "x": 10,
      "y": 1,
      "attack": 1,
      "health": 3
     },
     {
      "id": 512,
      "x": 9,
      "y": 0,
      "attack": 1,
      "health": 4
     }
    ]
   }
  }
 },
 "confluence-02": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "反转战线",
  "hint": "从右向左推进，保护主将身后的位置。",
  "chapter": 10,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 30,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 1,
      "y": 4,
      "attack": 3,
      "health": 30
     },
     {
      "id": 110,
      "x": 2,
      "y": 4,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 2,
      "y": 3,
      "attack": 1,
      "health": 3
     },
     {
      "id": 112,
      "x": 2,
      "y": 5,
      "attack": 3,
      "health": 4
     }
    ]
   }
  }
 },
 "confluence-03": {
  "version": 3,
  "contentVersion": "campaign-2026-10-14-v2",
  "label": "炉乡决战",
  "hint": "先击破一军，避免两侧终结部队同时逼近。",
  "chapter": 10,
  "players": {
   "1": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "flank",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 32,
    "generalAttack": 3,
    "generalId": 101,
    "deck": [
     110,
     115,
     109,
     20081,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     10021,
     112,
     20086,
     10019,
     109,
     120,
     110,
     20081,
     115,
     10021,
     20086,
     110,
     115,
     109,
     20081
    ],
    "unitStats": {
     "109": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "110": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "112": {
      "cost": 3,
      "attack": 3,
      "health": 4
     },
     "115": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "120": {
      "cost": 4,
      "attack": 5,
      "health": 4
     },
     "10019": {
      "cost": 1,
      "attack": 2,
      "health": 2
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     }
    },
    "garrison": [
     {
      "id": 101,
      "x": 1,
      "y": 1,
      "attack": 3,
      "health": 32
     },
     {
      "id": 110,
      "x": 2,
      "y": 2,
      "attack": 2,
      "health": 4
     },
     {
      "id": 115,
      "x": 3,
      "y": 1,
      "attack": 1,
      "health": 3
     },
     {
      "id": 112,
      "x": 1,
      "y": 3,
      "attack": 3,
      "health": 4
     }
    ]
   },
   "2": {
    "mana": 5,
    "maxMana": 5,
    "manaGrowth": 1,
    "manaCap": 9,
    "openingHandSize": 4,
    "drawPerTurn": 1,
    "handLimit": 8,
    "fatigueDamage": 2,
    "replacePerTurn": 0,
    "shuffleDeck": false,
    "behavior": "defend",
    "spellRank": 0,
    "spellMode": "base",
    "attackBonus": 0,
    "healthBonus": 0,
    "generalHealth": 32,
    "generalAttack": 3,
    "generalId": 527,
    "deck": [
     11,
     10021,
     505,
     20149,
     10981,
     512,
     20139,
     14,
     505,
     519,
     11,
     20149,
     10021,
     10981,
     20139,
     10981,
     512,
     20139,
     14,
     505,
     519,
     11,
     20149,
     10021,
     10981,
     20139,
     11,
     10021,
     505,
     20149
    ],
    "unitStats": {
     "11": {
      "cost": 3,
      "attack": 1,
      "health": 6
     },
     "14": {
      "cost": 1,
      "attack": 1,
      "health": 5
     },
     "505": {
      "cost": 2,
      "attack": 2,
      "health": 4
     },
     "512": {
      "cost": 2,
      "attack": 1,
      "health": 4
     },
     "519": {
      "cost": 3,
      "attack": 2,
      "health": 4
     },
     "10021": {
      "cost": 2,
      "attack": 1,
      "health": 3
     },
     "10981": {
      "cost": 2,
      "attack": 2,
      "health": 4
     }
    },
    "garrison": [
     {
      "id": 527,
      "x": 11,
      "y": 7,
      "attack": 3,
      "health": 32
     },
     {
      "id": 11,
      "x": 10,
      "y": 6,
      "attack": 1,
      "health": 6
     },
     {
      "id": 10021,
      "x": 9,
      "y": 7,
      "attack": 1,
      "health": 3
     },
     {
      "id": 512,
      "x": 11,
      "y": 5,
      "attack": 1,
      "health": 4
     }
    ]
   }
  }
 }
};
