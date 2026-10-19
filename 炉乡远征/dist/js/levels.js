// Fixed teaching scenarios. Stable IDs preserve historical completion and snapshots.
// Stats and geometry make each lesson's central mechanic useful; no click-order gates.
export const LEVELS = [
  {
    "id": "roar-lethal",
    "title": "狮王一击",
    "subtitle": "利用邻近强化击败敌将",
    "goal": "本回合击败敌方主将。",
    "hint": "本关主将攻击为0。风刃侍从紧邻主将时为3攻，先用狮王怒吼提高到5攻，再击败敌将。",
    "mana": 1,
    "maxMana": 1,
    "hand": [
      20174
    ],
    "board": [
      {
        "cardId": 1,
        "owner": 0,
        "x": 2,
        "y": 2,
        "attack": 0
      },
      {
        "cardId": 9,
        "owner": 0,
        "x": 3,
        "y": 2
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 4,
        "y": 2,
        "health": 5
      }
    ],
    "turnLimit": 1,
    "solution": "用手牌狮王怒吼或同名主将技能强化风刃侍从，保持它邻近主将，再攻击齐兰。",
    "group": "advanced",
    "lesson": {
      "summary": "利用邻近强化击败敌将",
      "steps": [
        "本关主将攻击为0。风刃侍从紧邻主将时为3攻，先用狮王怒吼提高到5攻，再击败敌将。"
      ],
      "takeaway": "用手牌狮王怒吼或同名主将技能强化风刃侍从，保持它邻近主将，再攻击齐兰。"
    }
  },
  {
    "id": "break-the-guard",
    "title": "破阵擒王",
    "subtitle": "清除嘲讽，为主将让出进攻路线",
    "goal": "本回合击败敌方主将。",
    "hint": "白银骑士还在时，靠近它的单位只能攻击它；新召唤的单位本回合不能行动。",
    "mana": 1,
    "maxMana": 1,
    "hand": [
      14
    ],
    "board": [
      {
        "cardId": 1,
        "owner": 0,
        "x": 2,
        "y": 2
      },
      {
        "cardId": 9,
        "owner": 0,
        "x": 3,
        "y": 1
      },
      {
        "cardId": 11,
        "owner": 1,
        "x": 4,
        "y": 1,
        "health": 3
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 5,
        "y": 2,
        "health": 2
      }
    ],
    "turnLimit": 1,
    "solution": "先让风刃侍从击败白银骑士，再把阿杰农移到齐兰左侧，攻击齐兰。",
    "group": "advanced",
    "lesson": {
      "summary": "清除嘲讽，为主将让出进攻路线",
      "steps": [
        "白银骑士还在时，靠近它的单位只能攻击它；新召唤的单位本回合不能行动。"
      ],
      "takeaway": "先让风刃侍从击败白银骑士，再把阿杰农移到齐兰左侧，攻击齐兰。"
    }
  },
  {
    "id": "lightchaser-bond",
    "title": "逐光联结",
    "subtitle": "治疗后用生命提高攻击",
    "goal": "本回合击败敌方主将。",
    "hint": "本关主将攻击为0。先实际治疗逐光者使其达到3生命、4攻击，再用神圣联结达到7攻击。",
    "mana": 4,
    "maxMana": 4,
    "hand": [
      20043,
      20068
    ],
    "board": [
      {
        "cardId": 1,
        "owner": 0,
        "x": 2,
        "y": 3,
        "attack": 0
      },
      {
        "cardId": 15,
        "owner": 0,
        "x": 3,
        "y": 2,
        "health": 1
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 4,
        "y": 2,
        "health": 7
      }
    ],
    "turnLimit": 1,
    "solution": "先用日耀圣露治疗逐光者，再对它使用神圣联结，最后攻击齐兰。",
    "group": "advanced",
    "lesson": {
      "summary": "治疗后用生命提高攻击",
      "steps": [
        "本关主将攻击为0。先实际治疗逐光者使其达到3生命、4攻击，再用神圣联结达到7攻击。"
      ],
      "takeaway": "先用日耀圣露治疗逐光者，再对它使用神圣联结，最后攻击齐兰。"
    }
  },
  {
    "extended": true,
    "mana": 1,
    "maxMana": 1,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 1,
    "id": "move-and-strike",
    "group": "basics",
    "title": "走位出击",
    "subtitle": "移动后仍可攻击",
    "goal": "本回合击败敌方主将。",
    "hint": "双方主将只剩 2 生命，主动走位击败敌将；移动不会消耗攻击。",
    "board": [
      {
        "cardId": 1,
        "owner": 0,
        "x": 1,
        "y": 2,
        "health": 2,
        "maxHealth": 2
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 4,
        "y": 2,
        "health": 2,
        "attack": 2
      }
    ],
    "lesson": {
      "summary": "移动到敌人旁边，再攻击。",
      "steps": [
        "按住阿杰农，拖到敌方主将左侧的空格，再松手。",
        "点击阿杰农选中，再点击攻击范围内的敌方主将进行攻击；长按单位可查看能力。"
      ],
      "takeaway": "每回合可移动一次、攻击一次；普通单位最多移动两步。"
    },
    "solution": "把阿杰农移到齐兰左侧，再选中阿杰农并点击齐兰发动攻击。"
  },
  {
    "extended": true,
    "mana": 0,
    "maxMana": 0,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 1,
    "id": "trade-and-retaliate",
    "group": "basics",
    "title": "看清反击",
    "subtitle": "攻击前查看双方生命",
    "goal": "本回合击败敌方主将。",
    "hint": "阿杰农仅剩 2 生命，先攻击会被 2 点反击击败；让侍从先换血，主将再斩杀。",
    "board": [
      {
        "cardId": 1,
        "owner": 0,
        "x": 2,
        "y": 3,
        "health": 2,
        "maxHealth": 2
      },
      {
        "cardId": 14,
        "owner": 0,
        "x": 3,
        "y": 2
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 4,
        "y": 3,
        "health": 3,
        "maxHealth": 3
      }
    ],
    "lesson": {
      "summary": "受伤主将不能先换血；让护卫承受反击。",
      "steps": [
        "选中白银侍从，再点击右下方齐兰攻击；侍从造成 1 伤害、承受 2 点反击。",
        "按住阿杰农，拖到齐兰左侧的空格并松手；再选中阿杰农并点击齐兰攻击。"
      ],
      "takeaway": "击败目标就不会被它反击；先让能承受反击的护卫削血，再用受伤主将斩杀。"
    },
    "solution": "先让白银侍从攻击齐兰，再把阿杰农移到齐兰左侧，攻击齐兰。阿杰农不能先手，否则会被反击击败。"
  },
  {
    "extended": true,
    "mana": 1,
    "maxMana": 1,
    "hand": [
      14
    ],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 2,
    "id": "summon-next-turn",
    "group": "basics",
    "title": "新兵接战",
    "subtitle": "召唤后等下一回合",
    "goal": "2 回合内击败敌方主将。",
    "hint": "本关主将攻击为 0。新兵本回合不能行动，等下回合再击败 1 生命的敌将。",
    "board": [
      {
        "cardId": 1,
        "owner": 0,
        "x": 4,
        "y": 2,
        "attack": 0
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 7,
        "y": 2,
        "health": 1,
        "maxHealth": 1,
        "attack": 0
      }
    ],
    "map": {
      "tiles": [
        {
          "x": 6,
          "y": 2,
          "type": "wall"
        },
        {
          "x": 7,
          "y": 1,
          "type": "wall"
        },
        {
          "x": 7,
          "y": 3,
          "type": "wall"
        },
        {
          "x": 8,
          "y": 2,
          "type": "wall"
        }
      ]
    },
    "lesson": {
      "summary": "新兵要到下回合才能移动和攻击。",
      "steps": [
        "把白银侍从召唤到阿杰农右侧的空格。",
        "新兵本回合不能行动；结束回合。",
        "下一回合把侍从拖到敌将左下方，再攻击斜上方的敌将。"
      ],
      "takeaway": "召唤疲劳在己方回合开始清除；刚召唤的普通单位不能移动或攻击。"
    },
    "solution": "在 (5,2) 召唤白银侍从，结束回合；下一回合移到 (6,3)，再攻击 (7,2) 的敌将。"
  },
  {
    "extended": true,
    "mana": 1,
    "maxMana": 1,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 1,
    "id": "command-before-attack",
    "group": "basics",
    "title": "主将号令",
    "subtitle": "先强化，再攻击",
    "goal": "本回合击败敌方主将。",
    "hint": "本关主将攻击为 0；侍从只有 1 攻击，先用 1 法力的主将技能补足到 3。",
    "board": [
      {
        "cardId": 1,
        "owner": 0,
        "x": 2,
        "y": 2,
        "attack": 0
      },
      {
        "cardId": 14,
        "owner": 0,
        "x": 3,
        "y": 2
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 4,
        "y": 2,
        "health": 3,
        "attack": 0
      }
    ],
    "lesson": {
      "summary": "用战场上的主将技能为侍从补足伤害。",
      "steps": [
        "把主将技能拖到附近的白银侍从身上。",
        "侍从获得 +2 攻击后，攻击齐兰。"
      ],
      "takeaway": "先用技能再攻击；同回合不能重复使用技能。"
    },
    "solution": "对白银侍从使用狮王怒吼，再让侍从攻击齐兰。"
  },
  {
    "extended": true,
    "mana": 1,
    "maxMana": 1,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 2,
    "id": "terrain-detour",
    "group": "battlefield",
    "title": "绕开碎石",
    "subtitle": "选普通地面绕过石墙",
    "goal": "2 回合内绕过石墙，击败敌方主将。",
    "hint": "石墙不能进入；碎石耗两步。走下方普通地面，第二回合可从斜侧攻击敌将。",
    "map": {
      "tiles": [
        {
          "x": 2,
          "y": 2,
          "type": "wall"
        },
        {
          "x": 2,
          "y": 1,
          "type": "rough"
        },
        {
          "x": 3,
          "y": 2,
          "type": "wall"
        },
        {
          "x": 5,
          "y": 2,
          "type": "wall"
        },
        {
          "x": 4,
          "y": 1,
          "type": "wall"
        },
        {
          "x": 4,
          "y": 3,
          "type": "wall"
        }
      ]
    },
    "board": [
      {
        "cardId": 1,
        "owner": 0,
        "x": 1,
        "y": 2
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 4,
        "y": 2,
        "health": 2,
        "maxHealth": 2,
        "attack": 0
      }
    ],
    "lesson": {
      "summary": "用普通地面绕墙，避开会耗尽步数的碎石。",
      "steps": [
        "把阿杰农拖到右下方普通地面（石墙右下侧的空格）。",
        "结束回合，再移到敌将左下方的空格。",
        "选中阿杰农，攻击斜上方的敌将。"
      ],
      "takeaway": "移动走上下左右，攻击可以打斜侧；碎石会消耗两步。"
    },
    "solution": "第一回合移到 (2,3)，结束回合；第二回合移到 (3,3)，攻击 (4,2) 的敌将。"
  },
  {
    "extended": true,
    "mana": 0,
    "maxMana": 1,
    "hand": [
      11
    ],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 3,
    "id": "outpost-hold",
    "group": "battlefield",
    "title": "前哨招援",
    "subtitle": "占点后才能支付援军",
    "goal": "3 回合内召唤骑士，击败敌方主将。",
    "hint": "主将与侍从攻击均为 0。第二回合只有占住前哨才有 3 法力，能召唤白银骑士。 敌将有 5 攻击，不要把疲劳的新兵放在它身旁。",
    "map": {
      "tiles": [
        {
          "x": 3,
          "y": 2,
          "type": "outpost"
        },
        {
          "x": 4,
          "y": 2,
          "type": "wall"
        },
        {
          "x": 6,
          "y": 2,
          "type": "wall"
        },
        {
          "x": 5,
          "y": 1,
          "type": "wall"
        },
        {
          "x": 5,
          "y": 3,
          "type": "wall"
        }
      ]
    },
    "board": [
      {
        "cardId": 23,
        "owner": 0,
        "x": 1,
        "y": 2,
        "attack": 0
      },
      {
        "cardId": 14,
        "owner": 0,
        "x": 2,
        "y": 2,
        "attack": 0
      },
      {
        "cardId": 1,
        "owner": 1,
        "x": 5,
        "y": 2,
        "health": 1,
        "maxHealth": 1,
        "attack": 5
      }
    ],
    "lesson": {
      "summary": "先占前哨，才能提早召唤骑士。",
      "steps": [
        "把白银侍从拖到右侧前哨，再结束回合。",
        "第二回合有 3 法力；把白银骑士召唤到前哨正下方的空格，避开敌将。",
        "结束回合；第三回合把骑士移到敌将左下方，攻击敌将。"
      ],
      "takeaway": "前哨在下次己方回合增加 1 法力；没有补给，援军晚一回合上场就赶不上。"
    },
    "solution": "第一回合侍从移 (3,2)，结束；第二回合在 (3,3) 召唤白银骑士，结束；第三回合骑士移 (4,3)，攻击 (5,2) 敌将。",
    "heroId": 23
  },
  {
    "extended": true,
    "mana": 0,
    "maxMana": 0,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 2,
    "id": "three-way-crossfire",
    "group": "battlefield",
    "title": "三旗交锋",
    "subtitle": "敌人之间也会交战",
    "goal": "2 回合内击败两名敌方主将。",
    "hint": "先让两名敌将互攻；碎石会拖慢幸存者，下一回合用射手主动收尾，不能一直等待。",
    "board": [
      {
        "cardId": 1,
        "owner": 0,
        "x": 0,
        "y": 2
      },
      {
        "cardId": 109,
        "owner": 0,
        "x": 2,
        "y": 2
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 6,
        "y": 2,
        "health": 4
      },
      {
        "cardId": 1,
        "owner": 2,
        "x": 7,
        "y": 2,
        "health": 4
      }
    ],
    "lesson": {
      "summary": "先让两军交战，再用射手击败剩余敌将。",
      "steps": [
        "己方暂不进攻，结束回合。",
        "观察两名敌方主将互攻，至少一方退出战场。",
        "用寡妇射手远程攻击剩余主将。"
      ],
      "takeaway": "三方战场要击败所有敌方主将；消灭一方不会立即结束战斗。"
    },
    "solution": "先结束回合，让两名敌方主将互相攻击。下一回合用寡妇射手击败剩余主将。",
    "map": {
      "tiles": [
        {
          "x": 3,
          "y": 0,
          "type": "rough"
        },
        {
          "x": 3,
          "y": 1,
          "type": "rough"
        },
        {
          "x": 3,
          "y": 2,
          "type": "rough"
        },
        {
          "x": 3,
          "y": 3,
          "type": "rough"
        },
        {
          "x": 3,
          "y": 4,
          "type": "rough"
        }
      ]
    }
  },
  {
    "extended": true,
    "mana": 1,
    "maxMana": 1,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 1,
    "id": "lyonar-healing",
    "group": "factions",
    "title": "莱昂 · 治疗成长",
    "subtitle": "治疗让逐光者达到斩杀线",
    "goal": "本回合击败敌方主将。",
    "hint": "本关齐兰攻击为0；逐光者初始3攻，治疗后变为5攻。",
    "board": [
      {
        "cardId": 23,
        "owner": 0,
        "x": 2,
        "y": 2,
        "attack": 0
      },
      {
        "cardId": 15,
        "owner": 0,
        "x": 3,
        "y": 2,
        "health": 1
      },
      {
        "cardId": 1,
        "owner": 1,
        "x": 4,
        "y": 2,
        "health": 5,
        "attack": 0
      }
    ],
    "lesson": {
      "summary": "治疗受伤的逐光者，再攻击。",
      "steps": [
        "用齐兰的主将技能治疗逐光者。",
        "逐光者从3攻提高到5攻后，攻击敌方主将。"
      ],
      "takeaway": "实际治疗触发逐光者成长；齐兰的首次治疗被动再加1攻击。"
    },
    "solution": "用齐兰技能治疗逐光者，再让逐光者攻击敌将。"
  },
  {
    "extended": true,
    "mana": 1,
    "maxMana": 1,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 1,
    "id": "songhai-backstab",
    "group": "factions",
    "title": "宋海 · 远射与背刺",
    "subtitle": "两种攻击合力斩杀",
    "goal": "本回合击败敌方主将。",
    "hint": "敌将本回合无法行动且有6生命；射手造成2伤害，凯多从背后造成4伤害。",
    "board": [
      {
        "cardId": 101,
        "owner": 0,
        "x": 0,
        "y": 2
      },
      {
        "cardId": 109,
        "owner": 0,
        "x": 2,
        "y": 4
      },
      {
        "cardId": 110,
        "owner": 0,
        "x": 7,
        "y": 2
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 6,
        "y": 2,
        "health": 6,
        "stunTurns": 1
      }
    ],
    "lesson": {
      "summary": "用远射和背刺合计造成6点伤害。",
      "steps": [
        "寡妇射手远程攻击敌方主将，造成2伤害。",
        "右侧凯多刺客从背后攻击敌将，造成4伤害。"
      ],
      "takeaway": "背刺需要站在目标同一行的背后一格，且不会受到反击。"
    },
    "solution": "寡妇射手远射敌将，再让右侧凯多刺客背刺敌将。"
  },
  {
    "extended": true,
    "mana": 0,
    "maxMana": 0,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 1,
    "id": "flight-and-airdrop",
    "group": "factions",
    "title": "机动 · 飞越石墙",
    "subtitle": "飞行可以越过整条障碍",
    "goal": "本回合击败敌方主将。",
    "hint": "狼鸦可飞越石墙；落在敌方半场后潜入使其达到4攻。",
    "map": {
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
          "y": 2,
          "type": "wall"
        },
        {
          "x": 4,
          "y": 3,
          "type": "wall"
        },
        {
          "x": 4,
          "y": 4,
          "type": "wall"
        }
      ]
    },
    "board": [
      {
        "cardId": 501,
        "owner": 0,
        "x": 0,
        "y": 2
      },
      {
        "cardId": 511,
        "owner": 0,
        "x": 1,
        "y": 2
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 7,
        "y": 2,
        "health": 4,
        "attack": 0
      }
    ],
    "lesson": {
      "summary": "让狼鸦飞越石墙，直取敌将。",
      "steps": [
        "将狼鸦拖到敌方主将左侧空格。",
        "狼鸦在敌方半场获得潜入强化，攻击敌方主将。"
      ],
      "takeaway": "飞行可以跨越障碍，但不能落在墙或已有单位上。"
    },
    "solution": "狼鸦从(1,2)飞至(6,2)，再攻击敌方主将。"
  },
  {
    "extended": true,
    "mana": 0,
    "maxMana": 0,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 2,
    "id": "vetruvian-obelysk",
    "group": "factions",
    "title": "维特鲁威 · 方尖碑补兵",
    "subtitle": "等待方尖碑产出沙魔",
    "goal": "2回合内击败敌方主将。",
    "hint": "本关主将攻击为0；金焰方尖碑在己方回合开始产出3攻沙魔。",
    "board": [
      {
        "cardId": 201,
        "owner": 0,
        "x": 1,
        "y": 2,
        "attack": 0
      },
      {
        "cardId": 215,
        "owner": 0,
        "x": 3,
        "y": 2
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 6,
        "y": 2,
        "health": 3,
        "attack": 0
      }
    ],
    "lesson": {
      "summary": "等待方尖碑补兵，再让沙魔出击。",
      "steps": [
        "结束回合，等待己方第二回合。",
        "把新产出的沙魔移到敌将附近，再攻击敌将。"
      ],
      "takeaway": "方尖碑无法移动；产出的沙魔可立即行动，但通常在己方回合结束消散。"
    },
    "solution": "直接结束回合。第二回合将方尖碑产出的沙魔移到敌将附近并攻击。"
  },
  {
    "extended": true,
    "mana": 1,
    "maxMana": 1,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 2,
    "id": "abyssian-death-and-creep",
    "group": "factions",
    "title": "深渊 · 腐土侵蚀",
    "subtitle": "让腐土在回合结束造成伤害",
    "goal": "2回合内击败敌方主将。",
    "hint": "敌将3生命；幽暗爆裂造成1伤害并留下腐土，腐土在回合结束再造成1伤害。",
    "board": [
      {
        "cardId": 323,
        "owner": 0,
        "x": 1,
        "y": 2,
        "attack": 0
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 7,
        "y": 2,
        "health": 3,
        "attack": 0
      }
    ],
    "lesson": {
      "summary": "留下腐土，结算持续伤害，再补一击。",
      "steps": [
        "对敌方主将使用幽暗爆裂。",
        "结束回合，观察腐土造成1点伤害。",
        "第二回合再次对敌将使用幽暗爆裂。"
      ],
      "takeaway": "腐土在所属阵营回合结束造成伤害；单靠两次爆裂的直接伤害不足以获胜。"
    },
    "solution": "爆裂敌将造成1伤害，结束回合让腐土造成1伤害，下一回合再次爆裂。"
  },
  {
    "extended": true,
    "mana": 0,
    "maxMana": 0,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 2,
    "id": "magmar-grow-and-rebirth",
    "group": "factions",
    "title": "玛格玛 · 成长蓄势",
    "subtitle": "前后两回合打出3加4的伤害",
    "goal": "2回合内击败敌方主将。",
    "hint": "本关主将攻击为0，敌将暂时无法行动；敌将7生命，大地行者本回合3攻，下回合成长至4攻。",
    "board": [
      {
        "cardId": 401,
        "owner": 0,
        "x": 1,
        "y": 2,
        "attack": 0
      },
      {
        "cardId": 402,
        "owner": 0,
        "x": 3,
        "y": 3
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 4,
        "y": 3,
        "health": 7,
        "attack": 0,
        "stunTurns": 2
      }
    ],
    "lesson": {
      "summary": "先打3伤害，再成长至4攻完成斩杀。",
      "steps": [
        "本回合用大地行者攻击敌将，造成3伤害。",
        "结束回合，观察大地行者成长至4攻。",
        "第二回合再攻击敌将，造成4伤害。"
      ],
      "takeaway": "成长在所属阵营回合开始发生；3加4才能在两回合内击败7血目标。"
    },
    "solution": "大地行者先攻击敌将造成3伤害，结束回合成长至4攻，下一回合再攻击完成斩杀。"
  },
  {
    "extended": true,
    "mana": 0,
    "maxMana": 0,
    "hand": [],
    "deck": [],
    "objective": {
      "type": "eliminate"
    },
    "turnLimit": 1,
    "id": "vanar-wall-and-infiltrate",
    "group": "factions",
    "title": "瓦纳尔 · 潜入侧击",
    "subtitle": "进入敌方半场再攻击",
    "goal": "本回合击败敌方主将。",
    "hint": "本关主将攻击为0，敌将无法行动；潜伏者在己方半场2攻，进入敌方半场后4攻。",
    "board": [
      {
        "cardId": 527,
        "owner": 0,
        "x": 1,
        "y": 2,
        "attack": 0
      },
      {
        "cardId": 505,
        "owner": 0,
        "x": 3,
        "y": 3
      },
      {
        "cardId": 23,
        "owner": 1,
        "x": 4,
        "y": 2,
        "health": 4,
        "attack": 0,
        "stunTurns": 1
      }
    ],
    "lesson": {
      "summary": "从敌方半场发起攻击。",
      "steps": [
        "把水晶潜伏者从(3,3)移动到(5,3)。",
        "确认潜入使攻击达到4，再攻击左上方敌将。"
      ],
      "takeaway": "潜入按当前站位生效；在己方半场发起攻击不会获得强化。"
    },
    "solution": "把潜伏者移动到(5,3)进入敌方半场，再攻击(4,2)的敌将。"
  }
];

export const TRIAL_GROUPS = [
  {
    "id": "basics",
    "title": "基础操作",
    "description": "移动、攻击、法力与主将技能。"
  },
  {
    "id": "battlefield",
    "title": "战场训练",
    "description": "地形绕行、前哨补给与多方交战。"
  },
  {
    "id": "factions",
    "title": "阵营战术",
    "description": "练习各阵营的特色能力。"
  },
  {
    "id": "advanced",
    "title": "进阶解题",
    "description": "搭配技能和法术，击败敌方主将。"
  }
];

// Trials remain freely selectable. Only new matches consume the current scenario data.
export function isTrialUnlocked(levelId, _completed = []) {
  return LEVELS.some(level => level.id === levelId);
}

export function nextTrialLevel(levelId) {
  const current = LEVELS.find(level => level.id === levelId);
  if (!current) return null;
  const group = LEVELS.filter(level => level.group === current.group);
  return group[group.indexOf(current) + 1] ?? null;
}
