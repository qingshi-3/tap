// v9.0 《午夜酒馆：秘宝引擎流》Core Data (Balatro-Style Left-to-Right Relic Pipeline + 8 Escalating Boss Blinds)
// Strictly implements GPT Logic Fixes:
// - Fix #1: Every '+' relic adds to the current hit's damage pipeline; every 'x' relic multiplies damage arriving at that slot!
// - Fix #2: Consolation payout on defeat is an advance (max 1x per wave), deducted from the wave's win bounty.
(function () {
  window.MT = window.MT || {};

  const ELEMENTS = {
    fire:  { id: 'fire',  name: '火', color: '#ff6b3d' },
    ice:   { id: 'ice',   name: '冰', color: '#5cd6ff' },
    light: { id: 'light', name: '光', color: '#ffd966' },
    dark:  { id: 'dark',  name: '暗', color: '#c07aff' },
    bolt:  { id: 'bolt',  name: '雷', color: '#56f0e8' },
    grass: { id: 'grass', name: '草', color: '#52e088' }
  };

  // 8 Persistent Duelyst Mercenaries (Buy duplicate -> 2-in-1 Star Up: 1★ -> 2★ -> 3★!)
  const HEROES = [
    {
      id: 'iron_anvil', unitId: 'f1_3rdgeneral', name: '铁砧', title: '圣盾壁垒',
      role: 'tank', element: 'light', cost: 4, starter: true,
      baseHp: 220, baseAtk: 34, crit: 12, speed: 9,
      tag: '开局护盾', desc: '开局获得 45% 护盾，绝配【圣盾反击】把护盾转成爆炸伤害'
    },
    {
      id: 'seven_boom', unitId: 'n_grenadier', name: '火药桶老七', title: '烈焰爆破手',
      role: 'ranged', element: 'fire', cost: 4, starter: true,
      baseHp: 145, baseAtk: 42, crit: 18, speed: 12,
      tag: '火系灼烧', desc: '火系远程必挂灼烧，高频触发【余烬火球】【火油桶】连爆'
    },
    {
      id: 'vera_gambit', unitId: 'f2_altgeneral', name: '红桃薇拉', title: '暴击千术师',
      role: 'assassin', element: 'dark', cost: 4, starter: true,
      baseHp: 140, baseAtk: 40, crit: 44, speed: 15,
      tag: '超高暴击', desc: '自带 44% 暴击与最高速度，印钞【贪婪金杯】与【暴击放大镜】发动机'
    },
    {
      id: 'kyle_blade', unitId: 'neutral_astralcrusader', name: '凯尔', title: '星界破甲剑',
      role: 'warrior', element: 'light', cost: 5, starter: false,
      baseHp: 185, baseAtk: 48, crit: 22, speed: 11,
      tag: '破甲连斩', desc: '无视护甲减伤，2★起每次普攻额外连砍 1 剑（双倍触发秘宝链）'
    },
    {
      id: 'aria_sun', unitId: 'f1_altgeneral', name: '阿莉娅', title: '晨曦圣女',
      role: 'support', element: 'light', cost: 5, starter: false,
      baseHp: 175, baseAtk: 30, crit: 15, speed: 10,
      tag: '奶盾永动', desc: '行动时攻击同时为全队回复 18% 生命并加盾，稳撑【血债契约】'
    },
    {
      id: 'mord_blood', unitId: 'f4_blacksolus', name: '莫德', title: '深渊雷契者',
      role: 'ranged', element: 'bolt', cost: 6, starter: false,
      baseHp: 165, baseAtk: 56, crit: 24, speed: 13,
      tag: '雷暗高伤', desc: '高面板远程核弹，每次出手自带 1 次雷击特效（计入连锁层数）'
    },
    {
      id: 'grey_fenrir', unitId: 'f6_3rdgeneral', name: '格雷', title: '极寒霜狼王',
      role: 'tank', element: 'ice', cost: 6, starter: false,
      baseHp: 250, baseAtk: 46, crit: 20, speed: 9,
      tag: '冰冻控场', desc: '极厚身板 + 35% 概率冰冻 Boss，克制蓄力 Boss 并吃满【火油桶】'
    },
    {
      id: 'lilith_dance', unitId: 'f4_altgeneral', name: '莉莉丝', title: '绯红双刃后',
      role: 'assassin', element: 'fire', cost: 6, starter: false,
      baseHp: 160, baseAtk: 52, crit: 35, speed: 16,
      tag: '火暗双连击', desc: '每次出手必打 2 段（火系 + 高暴），整条秘宝链触发效率翻倍！'
    }
  ];

  // 16 Interlocking Balatro-Style Relics (Evaluated Strictly Left -> Right!)
  // kind: 'add' (+X to current hit), 'fx' (triggers Duelyst VFX / Retrigger / Utility), 'mult' (multiplies damage arriving at this slot!)
  const RELICS = [
    // ── ADDITIVE & SCALING (Place on LEFT to feed multipliers on the RIGHT!) ──
    {
      id: 'r_whetstone', name: '精钢磨刀石', kind: 'add', badge: '+26', color: '#78d8ff',
      cost: 5, icon: 'icon-d7fb4a7519b997571b4ff455',
      short: '本次伤害 +26', desc: '任何佣兵出手时，结算到本格的伤害 +26（放左侧可吃右侧倍率）'
    },
    {
      id: 'r_ember_amp', name: '炽焰魔核', kind: 'add', badge: '火+48', color: '#ff7b3d',
      cost: 6, icon: 'icon-130319687a750ebf796effdf',
      short: '火系伤害 +48', desc: '火系佣兵或火球特效出手时，到达本格的伤害 +48'
    },
    {
      id: 'r_ledger', name: '黑心刷店账本', kind: 'add', badge: '成长+', color: '#ffd966',
      cost: 6, icon: 'icon-8fe3811fcb33e8c9981eb990',
      short: '每刷店永久+14', desc: '本局每刷新 1 次商店，本格永久 +14 本次伤害（越刷店越恐怖！）'
    },
    {
      id: 'r_shield_bash', name: '圣盾反击印', kind: 'add', badge: '盾转攻', color: '#7ceeff',
      cost: 6, icon: 'icon-7e778462987e456f3e70c7b6',
      short: '+55%当前护盾', desc: '拥有护盾的佣兵出手时，把当前护盾值的 55% 加到本次伤害'
    },
    {
      id: 'r_gold_cup', name: '贪婪印钞杯', kind: 'add', badge: '暴+2G', color: '#ffe07d',
      cost: 7, icon: 'icon-d7fb4a7519b997571b4ff455',
      short: '暴击+28且掉2G', desc: '暴击时本次伤害 +28，并立刻爆出 +2G 进钱包（每战上限 12G）'
    },
    {
      id: 'r_gambler_dice', name: '灌铅暴击骰', kind: 'add', badge: '暴+30%', color: '#c07aff',
      cost: 6, icon: 'icon-5b259d77f8eb2a13a3e620fb',
      short: '暴击率+30%', desc: '全队暴击率 +30%；触发暴击时本次伤害额外 +22'
    },

    // ── DUELYST VFX TRIGGERS & RETRIGGER ENGINES ──
    {
      id: 'r_ember_orb', name: '余烬火球戒', kind: 'fx', badge: '火球!', color: '#ff6e3a',
      cost: 7, icon: 'icon-130319687a750ebf796effdf', vfx: 'fx_flamesphere',
      short: '火/暴追加火球', desc: '火系或暴击命中后，追加 1 发火球爆炸（55% 伤害 + 灼烧，计入连锁！）'
    },
    {
      id: 'r_shadow_cloak', name: '影步背刺斗篷', kind: 'fx', badge: '开局斩', color: '#c07aff',
      cost: 7, icon: 'icon-5b259d77f8eb2a13a3e620fb', vfx: 'fx_f2_teleportsmoke',
      short: '开局全体瞬斩', desc: '每战开局全队瞬移背刺 Boss 1 次（触发烟雾+十字斩，立刻叠起连锁！）'
    },
    {
      id: 'r_frost_seal', name: '寒霜冰封印', kind: 'fx', badge: '3击冻', color: '#5ce6ff',
      cost: 7, icon: 'icon-7e778462987e456f3e70c7b6', vfx: 'fxFrozenIceBlock',
      short: '每3击冰冻Boss', desc: '我方每累计 3 次攻击/追加特效，释放极寒冰封冻结 Boss 1 回合（打断蓄力）'
    },
    {
      id: 'r_holy_chalice', name: '圣泉永动杯', kind: 'fx', badge: '回血盾', color: '#5ef29b',
      cost: 6, icon: 'icon-8fe3811fcb33e8c9981eb990', vfx: 'fx_f1_holyimmolation',
      short: '回合末全队奶盾', desc: '每回合结束全队回复 22% 生命并获得 25% 护盾，完美喂养【圣盾反击】与【血债】'
    },
    {
      id: 'r_storm_bell', name: '九霄雷鸣铃', kind: 'fx', badge: '2链雷', color: '#58f5ee',
      cost: 8, icon: 'icon-7e778462987e456f3e70c7b6', vfx: 'fx_f2_twilightreiki',
      short: '每2特效劈天雷', desc: '本回合每触发 2 次秘宝/特效，立刻劈下连锁天雷造成 75% 必中伤害！'
    },
    {
      id: 'r_echo_blade', name: '回响双刃镜', kind: 'fx', badge: '再打1次', color: '#ff85c0',
      cost: 9, icon: 'icon-1dde93f80d94cb80d0861041', vfx: 'fx_multislash_full',
      short: '首攻重触发×2', desc: '【核心重触发】每回合第 1 位出手的佣兵立刻再攻击 1 次（完整重走整条秘宝链！）'
    },

    // ── MULTIPLICATIVE ENGINES (Place on RIGHT to multiply ALL damage arriving at this slot!) ──
    {
      id: 'r_compound', name: '黑心复利账', kind: 'mult', badge: '链×1.25', color: '#ff5978',
      cost: 9, icon: 'icon-1dde93f80d94cb80d0861041',
      short: '每特效×1.25', desc: '本回合每已触发 1 次秘宝/特效，将到达本格的伤害乘以 1.25（叠满轻松 ×3~×6！）'
    },
    {
      id: 'r_all_in', name: '孤注一掷金印', kind: 'mult', badge: '富×1.85', color: '#ffd966',
      cost: 8, icon: 'icon-d7fb4a7519b997571b4ff455',
      short: '≥25G时×1.85', desc: '【三角博弈】当前持有金币 ≥25G 时，将到达本格的伤害 ×1.85！（存钱吃息又翻倍）'
    },
    {
      id: 'r_crit_lens', name: '绯红暴击镜', kind: 'mult', badge: '暴×1.8', color: '#ff6e91',
      cost: 8, icon: 'icon-130319687a750ebf796effdf',
      short: '暴击时×1.8', desc: '本次攻击暴击时，将到达本格的伤害再 ×1.8 并炸出白热冲击波！'
    },
    {
      id: 'r_blood_pact', name: '血债狂暴契', kind: 'mult', badge: '血×2.0', color: '#ff475b',
      cost: 8, icon: 'icon-1dde93f80d94cb80d0861041',
      short: '扣血换×2.0', desc: '【高风险尖刺】每回合初全队自扣 18% 当前血，将到达本格的伤害 ×2.0！'
    },
    {
      id: 'r_burn_oil', name: '烈酒助燃桶', kind: 'mult', badge: '异常×1.7', color: '#ff944d',
      cost: 7, icon: 'icon-130319687a750ebf796effdf',
      short: '灼/冻目标×1.7', desc: '攻击处于【灼烧】或【冰冻】状态的 Boss 时，将到达本格的伤害 ×1.7！'
    },
    {
      id: 'r_reaper', name: '斩杀死神镰', kind: 'mult', badge: '斩×2.2', color: '#c678ff',
      cost: 8, icon: 'icon-5b259d77f8eb2a13a3e620fb',
      short: 'Boss<50%×2.2', desc: 'Boss 生命低于 50% 时，将到达本格的伤害直接 ×2.2！'
    }
  ];

  // 3 Tarot-Style One-Shot Tactical Battle Drinks (Cost 4G, Max 2 held!)
  const TACTICAL_DRINKS = [
    {
      id: 'flame_shot', name: '烈焰烧酒', short: '炸甲+打断', cost: 4,
      target: 'enemy', color: '#ff6e3a', duelystIcon: 'icon-130319687a750ebf796effdf',
      desc: '泼向 Boss：引爆金属弹头火球（16%最大血+挂灼烧）并打断蓄力！'
    },
    {
      id: 'holy_ale', name: '圣泉麦酒', short: '全队奶盾', cost: 4,
      target: 'ally', color: '#5ef29b', duelystIcon: 'icon-8fe3811fcb33e8c9981eb990',
      desc: '泼向我方：全队立刻回复 35% 生命 + 获得 30% 护盾！'
    },
    {
      id: 'fury_absinthe', name: '狂暴苦艾', short: '立刻2连动', cost: 4,
      target: 'ally', color: '#c07aff', duelystIcon: 'icon-1dde93f80d94cb80d0861041',
      desc: '泼向主力：让其立刻连续出手 2 次，双倍引爆整条 5 格秘宝乘算链！'
    }
  ];

  // 8 Escalating Boss Blinds (All 5 Duelyst H5 Bosses, Strict 6-Turn Limit!)
  const WAVES = [
    {
      wave: 1, name: '商道虫群前哨', bossUnitId: 'boss_antiswarm', bossName: '毒棘虫群霸主',
      element: 'grass', hp: 280, atk: 24, reward: 9,
      affixId: 'none', affixName: '无词条', affixDesc: '试水盲注：测试你的首发秘宝连锁！'
    },
    {
      wave: 2, name: '黑铁破阵骑兵', bossUnitId: 'boss_chaosknight', bossName: '混沌先锋骑士',
      element: 'dark', hp: 620, atk: 32, reward: 10,
      affixId: 'armor2', affixName: '重甲×2', affixDesc: '每回合前 2 次受击减伤 40%（破甲/多段/特效破之）'
    },
    {
      wave: 3, name: '【小Boss】灰烬祭坛', bossUnitId: 'boss_cindera', bossName: '余烬女皇·先遣',
      element: 'fire', hp: 1350, atk: 42, reward: 11, isBossBlind: true,
      affixId: 'charge', affixName: '蓄力焚城', affixDesc: '每 2 回合蓄力高伤 AOE（烈焰烧酒或冰冻可打断）'
    },
    {
      wave: 4, name: '幽影迷雾裂隙', bossUnitId: 'boss_skyfalltyrant', bossName: '苍穹影袭者',
      element: 'bolt', hp: 2850, atk: 54, reward: 12,
      affixId: 'evade1', affixName: '暗影闪避', affixDesc: '每回合闪避第 1 次普攻（秘宝追加特效必中！）'
    },
    {
      wave: 5, name: '永冻地下深渊', bossUnitId: 'boss_borealjuggernaut', bossName: '极寒巨像',
      element: 'ice', hp: 6200, atk: 66, reward: 13,
      affixId: 'thorns', affixName: '霜甲反伤', affixDesc: '每次承受普攻反伤 12%（护盾/远程奶/特效克制）'
    },
    {
      wave: 6, name: '【中Boss】猩红收割场', bossUnitId: 'boss_chaosknight', bossName: '混沌收割骑士',
      element: 'dark', hp: 13500, atk: 80, reward: 14, isBossBlind: true,
      affixId: 'enrage4', affixName: '狂暴倒计时', affixDesc: '第 4 回合起攻击翻倍，请在前 3 回合炸出高倍乘算！'
    },
    {
      wave: 7, name: '熔核深渊核心', bossUnitId: 'boss_cindera', bossName: '熔核余烬女皇',
      element: 'fire', hp: 28000, atk: 96, reward: 15,
      affixId: 'resist_plain', affixName: '双相抗性', affixDesc: '未暴击且无秘宝乘算的普通攻击减伤 35%'
    },
    {
      wave: 8, name: '【终局盲注】日蚀王座', bossUnitId: 'boss_skyfalltyrant', bossName: '日蚀君主',
      element: 'dark', hp: 58000, atk: 115, reward: 22, isBossBlind: true,
      affixId: 'seal_left', affixName: '日蚀封印', affixDesc: '每 2 回合封印最左侧 1 件秘宝 1 回合 + 蓄力灭世大招！（把关键乘算放右侧）'
    }
  ];

  function getHeroStats(heroTpl, stars = 1) {
    const mult = stars === 3 ? 3.2 : stars === 2 ? 1.85 : 1.0;
    return {
      maxHp: Math.round(heroTpl.baseHp * mult),
      atk: Math.round(heroTpl.baseAtk * mult),
      crit: heroTpl.crit + (stars - 1) * 6,
      speed: heroTpl.speed + (stars - 1)
    };
  }

  window.MT.ENGINE_DATA = {
    ELEMENTS, HEROES, RELICS, TACTICAL_DRINKS, WAVES, getHeroStats
  };
})();
