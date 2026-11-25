// Midnight Tavern v4.0 Core Data (classic script, file:// & http:// compatible, zero emojis)
(function () {
  window.MT = window.MT || {};

  // 6 visual colors x fine letter grades (D .. SSS)
  const TIERS = {
    D:    { grade: 'D',    rank: 1,  label: '杂鱼', color: '#9aa0b4', bg: '#222430', border: '#6c7288', hireBase: 55 },
    C:    { grade: 'C',    rank: 2,  label: '散客', color: '#5ef29b', bg: '#152b22', border: '#3dc77b', hireBase: 80 },
    B:    { grade: 'B',    rank: 3,  label: '老手', color: '#5cc8ff', bg: '#132638', border: '#3ca4e0', hireBase: 115 },
    'B+': { grade: 'B+',   rank: 4,  label: '精锐', color: '#78d8ff', bg: '#162c42', border: '#54beff', hireBase: 135 },
    'A-': { grade: 'A-',   rank: 5,  label: '名宿', color: '#c48aff', bg: '#27173b', border: '#9c5ee0', hireBase: 165 },
    A:    { grade: 'A',    rank: 6,  label: '名宿', color: '#d49eff', bg: '#2c1842', border: '#b36eff', hireBase: 190 },
    'A+': { grade: 'A+',   rank: 7,  label: '王牌', color: '#e4b8ff', bg: '#341c4e', border: '#cc88ff', hireBase: 225 },
    'S-': { grade: 'S-',   rank: 8,  label: '暗金', color: '#ffae42', bg: '#36210f', border: '#e08d22', hireBase: 260 },
    S:    { grade: 'S',    rank: 9,  label: '传说', color: '#ffc44d', bg: '#3d2510', border: '#ffaa2b', hireBase: 310 },
    'S+': { grade: 'S+',   rank: 10, label: '巅峰', color: '#ffd966', bg: '#472a10', border: '#ffc43d', hireBase: 370 },
    SSS:  { grade: 'SSS',  rank: 11, label: '传奇', color: '#ff5978', bg: '#3d1020', border: '#ff4268', hireBase: 460 }
  };

  // Straightforward Pokemon-style 6-element double cycle:
  // Element loop: 火 -> 草 -> 冰 -> 火
  // Arcane loop:  光 -> 暗 -> 雷 -> 光
  const ELEMENTS = {
    fire:  { id: 'fire',  name: '火', color: '#ff6b3d', bg: '#3d170f', beats: 'grass', weakTo: 'ice' },
    grass: { id: 'grass', name: '草', color: '#52e088', bg: '#133320', beats: 'ice',   weakTo: 'fire' },
    ice:   { id: 'ice',   name: '冰', color: '#5cd6ff', bg: '#102b3d', beats: 'fire',  weakTo: 'grass' },
    light: { id: 'light', name: '光', color: '#ffd966', bg: '#3b3010', beats: 'dark',  weakTo: 'bolt' },
    dark:  { id: 'dark',  name: '暗', color: '#c07aff', bg: '#27133d', beats: 'bolt',  weakTo: 'light' },
    bolt:  { id: 'bolt',  name: '雷', color: '#56f0e8', bg: '#103338', beats: 'light', weakTo: 'dark' }
  };

  function getElementMultiplier(atkElements, defElements) {
    if (!atkElements || !atkElements.length || !defElements || !defElements.length) {
      return { mult: 1, tag: 'neutral' };
    }
    let bestMult = 1;
    let worstMult = 1;
    for (const a of atkElements) {
      const eA = ELEMENTS[a];
      if (!eA) continue;
      let hitMult = 1;
      for (const d of defElements) {
        if (eA.beats === d) hitMult *= 1.5;
        else if (eA.weakTo === d) hitMult *= 0.72;
      }
      if (hitMult > bestMult) bestMult = hitMult;
      if (hitMult < worstMult) worstMult = hitMult;
    }
    const finalMult = bestMult > 1 ? Math.min(2.0, Math.round(bestMult * 100) / 100) : Math.round(worstMult * 100) / 100;
    let tag = 'neutral';
    if (finalMult >= 1.9) tag = 'super2';
    else if (finalMult >= 1.4) tag = 'super';
    else if (finalMult <= 0.8) tag = 'resist';
    return { mult: finalMult, tag };
  }

  // Auto-positioning roles (transparent rule, zero manual grid shuffling)
  const ROLES = {
    tank:     { id: 'tank',     name: '前排', short: '前', posOrder: 1, desc: '自动顶1号位抗伤护盾' },
    warrior:  { id: 'warrior',  name: '战士', short: '中', posOrder: 2, desc: '自动站2号位破阵输出' },
    assassin: { id: 'assassin', name: '刺客', short: '切', posOrder: 2, desc: '2号位，开局瞬移切后排' },
    ranged:   { id: 'ranged',   name: '远程', short: '后', posOrder: 3, desc: '自动站3号位远程爆发' },
    support:  { id: 'support',  name: '支援', short: '辅', posOrder: 3, desc: '自动站3号位治疗增益' }
  };

  // Dynamic life-state tags rolled every time a merc walks into the tavern
  const LIFE_TAGS = [
    {
      id: 'new_baby', name: '刚生娃', color: '#ffd166',
      chips: ['定金0G', '战力+12%', '红线-18%'],
      feeMult: 0, powerMult: 1.12, cutLimitDelta: -18, critBonus: 12,
      ultLine: '为了奶粉钱，给我倒下！！', eventHook: null
    },
    {
      id: 'loan_shark', name: '欠高利贷', color: '#ff6b7a',
      chips: ['定金半价', '底薪半价', '招讨债'],
      feeMult: 0.5, powerMult: 1.05, cutLimitDelta: 8, salaryMult: 0.5,
      ultLine: '还完这笔债我就金盆洗手！', eventHook: 'debt_collector'
    },
    {
      id: 'dumped', name: '刚被甩', color: '#c77dff',
      chips: ['灌酒暴击×2', '战力+8%', '易掀桌'],
      feeMult: 0.9, powerMult: 1.08, drinkPowerBonus: 0.16, cutLimitDelta: -10, critBonus: 24,
      ultLine: '前任都没你这么难缠！去死吧！', eventHook: 'bar_brawl'
    },
    {
      id: 'lottery', name: '中了小奖', color: '#5ef29b',
      chips: ['心情极好', '红线+15%'],
      feeMult: 1.0, powerMult: 1.0, cutLimitDelta: 15, critBonus: 5,
      ultLine: '今天手气正旺，顺手收了你！', eventHook: null
    },
    {
      id: 'hangover', name: '宿醉未醒', color: '#78d8ff',
      chips: ['定金5.5折', '战力-10%', '麦酒醒酒'],
      feeMult: 0.55, powerMult: 0.90, cutLimitDelta: 5, soberByAle: true,
      ultLine: '嗝……谁在敲我的头？！', eventHook: null
    },
    {
      id: 'hiding', name: '躲仇家', color: '#ff9f43',
      chips: ['定金6折', '战力+6%', '招仇家'],
      feeMult: 0.6, powerMult: 1.06, cutLimitDelta: 6,
      ultLine: '嘘——别声张，速战速决！', eventHook: 'rival_ambush'
    },
    {
      id: 'burned_ex', name: '被前东家坑', color: '#ff758f',
      chips: ['红线-15%', '厚道忠诚↑'],
      feeMult: 0.85, powerMult: 1.08, cutLimitDelta: -15, fairLoyaltyBonus: 14,
      ultLine: '这次老板靠谱，老子拼了！', eventHook: null
    },
    {
      id: 'windfall', name: '刚发横财', color: '#ffd966',
      chips: ['定金+25%', '战力+14%'],
      feeMult: 1.25, powerMult: 1.14, cutLimitDelta: -5,
      ultLine: '砸钱砸死你！看招！', eventHook: null
    },
    {
      id: 'insomnia', name: '通宵打牌', color: '#a0c4ff',
      chips: ['定金8折', '胜+28G'],
      feeMult: 0.8, powerMult: 1.0, cutLimitDelta: 5, bonusLootGold: 28,
      ultLine: '梭哈！一把定胜负！', eventHook: null
    },
    {
      id: 'motivated', name: '手热发烫', color: '#ffae42',
      chips: ['战力+15%', '暴击+15%'],
      feeMult: 1.0, powerMult: 1.15, cutLimitDelta: 0, critBonus: 15,
      ultLine: '感觉来了，挡我者碎！', eventHook: null
    }
  ];

  // 3 tavern expansion stages (horizontal scrolling hall)
  const TAVERN_LEVELS = [
    {
      level: 1, name: '破落小馆', hallWidth: 1280, maxScroll: 0,
      tables: 2, visitorCount: 3, signCap: 1,
      upgradeCost: 0, upgradeRep: 0,
      unlockChips: ['客×3', '签×1', '基础调酒']
    },
    {
      level: 2, name: '暗夜大厅', hallWidth: 1860, maxScroll: 580,
      tables: 4, visitorCount: 5, signCap: 3,
      upgradeCost: 260, upgradeRep: 48,
      unlockChips: ['横滑大厅', '客×5', '签×3', '冰/暗附魔酒', '护镖/劫镖']
    },
    {
      level: 3, name: '紫金地下公会', hallWidth: 2420, maxScroll: 1140,
      tables: 6, visitorCount: 7, signCap: 5,
      upgradeCost: 540, upgradeRep: 68,
      unlockChips: ['2.2屏长卷', '客×7', '签×5', 'VIP包厢', 'S+/SSS稀客']
    }
  ];

  // Bar drinks including elemental enchant brews (icons powered by Duelyst H5 Kit)
  const DRINKS = [
    {
      id: 'rum', name: '烈焰朗姆', cost: 16, minTavernLv: 1,
      color: '#ff6b35', glow: '#ffae42', pxIcon: 'rum',
      duelystIcon: 'icon-130319687a750ebf796effdf',
      shortTag: '火附魔+20%', enchantElement: 'fire',
      desc: '泼一杯烈酒：战力+20% 并临时附魔【火】属性，克制草系 Boss',
      effect: { powerMult: 0.20, critBonus: 15, feeDiscount: 0, loyaltyDelta: 4, revealIntel: false }
    },
    {
      id: 'absinthe', name: '迷雾苦艾', cost: 20, minTavernLv: 1,
      color: '#4de8a8', glow: '#7effd4', pxIcon: 'absinthe',
      duelystIcon: 'icon-d7fb4a7519b997571b4ff455',
      shortTag: '探属性+砍30%', enchantElement: null,
      desc: '微醺吐真言：揭露当前迷雾大单的隐藏属性，且本晚定金立减 30%',
      effect: { powerMult: 0.08, critBonus: 5, feeDiscount: 0.30, loyaltyDelta: 2, revealIntel: true }
    },
    {
      id: 'holy_ale', name: '圣泉麦酒', cost: 18, minTavernLv: 1,
      color: '#ffd966', glow: '#fff0a8', pxIcon: 'ale',
      duelystIcon: 'icon-8fe3811fcb33e8c9981eb990',
      shortTag: '光附魔+醒酒', enchantElement: 'light',
      desc: '一口回魂：临时附魔【光】属性、醒酒去负面，忠诚 +12',
      effect: { powerMult: 0.12, critBonus: 0, feeDiscount: 0.10, loyaltyDelta: 12, revealIntel: false, steady: true }
    },
    {
      id: 'frost_vodka', name: '寒霜伏特加', cost: 22, minTavernLv: 2,
      color: '#5cd6ff', glow: '#a8ecff', pxIcon: 'ale',
      duelystIcon: 'icon-7e778462987e456f3e70c7b6',
      shortTag: '冰附魔+22%', enchantElement: 'ice',
      desc: '冰裂入喉：战力+22% 并临时附魔【冰】属性，专克火系 Boss',
      effect: { powerMult: 0.22, critBonus: 10, feeDiscount: 0, loyaltyDelta: 4, revealIntel: false }
    },
    {
      id: 'shadow_gin', name: '暗影苦酒', cost: 24, minTavernLv: 2,
      color: '#c07aff', glow: '#e0b8ff', pxIcon: 'absinthe',
      duelystIcon: 'icon-5b259d77f8eb2a13a3e620fb',
      shortTag: '暗附魔+暴击', enchantElement: 'dark',
      desc: '暗夜秘酿：临时附魔【暗】属性，暴击+20%，专克雷系 Boss',
      effect: { powerMult: 0.18, critBonus: 20, feeDiscount: 0.05, loyaltyDelta: 3, revealIntel: false }
    }
  ];

  // Minimalist 2-slot equipment (weapon / relic), 1 crisp perk each
  const EQUIPMENT_POOL = [
    { id: 'eq_iron_blade', name: '精钢斩马刀', slot: 'weapon', tier: 'C', power: 10, rent: 16, basePrice: 65, element: null, perk: '战力 +10' },
    { id: 'eq_ember_axe',  name: '余烬战斧',   slot: 'weapon', tier: 'B', power: 15, rent: 24, basePrice: 105, element: 'fire', perk: '火属性附魔 · 战力 +15' },
    { id: 'eq_frost_bow',  name: '霜纹长弓',   slot: 'weapon', tier: 'B+', power: 17, rent: 28, basePrice: 125, element: 'ice', perk: '冰属性附魔 · 战力 +17' },
    { id: 'eq_venom_fang', name: '毒藤短刃',   slot: 'weapon', tier: 'B', power: 14, rent: 24, basePrice: 100, element: 'grass', perk: '草属性附魔 · 战力 +14' },
    { id: 'eq_dawn_lance', name: '晨曦圣枪',   slot: 'weapon', tier: 'A', power: 24, rent: 38, basePrice: 185, element: 'light', perk: '光属性附魔 · 战力 +24' },
    { id: 'eq_void_fan',   name: '幽影折扇',   slot: 'weapon', tier: 'A+', power: 28, rent: 44, basePrice: 220, element: 'dark', perk: '暗属性附魔 · 暴击偷钱' , bonusGold: 30 },
    { id: 'eq_storm_staff',name: '雷鸣权杖',   slot: 'weapon', tier: 'S', power: 36, rent: 56, basePrice: 310, element: 'bolt', perk: '雷属性附魔 · 战力 +36' },
    { id: 'eq_blood_edge', name: '绯红弑神刃', slot: 'weapon', tier: 'SSS', power: 48, rent: 75, basePrice: 460, element: 'fire', perk: '火+终结回怒 · 战力 +48' },

    { id: 'eq_oak_charm',  name: '橡木护符',   slot: 'relic',  tier: 'C', power: 8,  rent: 14, basePrice: 55, element: null, perk: '开局护盾 · 稳健 +8' , safeBonus: 8 },
    { id: 'eq_greed_dice', name: '灌铅金骰',   slot: 'relic',  tier: 'B+', power: 11, rent: 22, basePrice: 110, element: null, perk: '胜利额外爆金 +35G', bonusGold: 35 },
    { id: 'eq_aegis_seal', name: '圣盾纹章',   slot: 'relic',  tier: 'A', power: 18, rent: 34, basePrice: 175, element: 'light', perk: '全队护盾 · 稳健 +14', safeBonus: 14 },
    { id: 'eq_shadow_cloak',name:'夜鸦斗篷',   slot: 'relic',  tier: 'A+', power: 22, rent: 40, basePrice: 215, element: 'dark', perk: '暗附魔 · 暴击 +18%', critBonus: 18 },
    { id: 'eq_dragon_heart',name:'深渊龙心',   slot: 'relic',  tier: 'S+', power: 34, rent: 58, basePrice: 340, element: 'fire', perk: '火附魔 · 战力+34 赏金+20%', lootMult: 0.20 }
  ];

  // Elemental & trait synergies (2 units activate)
  const SYNERGIES = [
    { id: 'syn_fire',  key: 'fire',  type: 'el', need: 2, name: '烈焰连爆', color: '#ff6b3d', bonusPower: 22, bonusSafe: 0,  bonusLoot: 0,    desc: '【火×2】战力 +22，普攻附带灼烧溅射' },
    { id: 'syn_grass', key: 'grass', type: 'el', need: 2, name: '剧毒蔓延', color: '#52e088', bonusPower: 18, bonusSafe: 10, bonusLoot: 0,    desc: '【草×2】战力 +18，持续毒伤稳压胜率' },
    { id: 'syn_ice',   key: 'ice',   type: 'el', need: 2, name: '霜寒结界', color: '#5cd6ff', bonusPower: 16, bonusSafe: 14, bonusLoot: 0,    desc: '【冰×2】战力 +16，冻结降伤稳健+14' },
    { id: 'syn_light', key: 'light', type: 'el', need: 2, name: '晨曦壁垒', color: '#ffd966', bonusPower: 20, bonusSafe: 16, bonusLoot: 0,    desc: '【光×2】开局金色护盾，战力+20 稳健+16' },
    { id: 'syn_dark',  key: 'dark',  type: 'el', need: 2, name: '影袭双刃', color: '#c07aff', bonusPower: 26, bonusSafe: 0,  bonusLoot: 0.16, desc: '【暗×2】战力+26，额外摸走 16% 赏金' },
    { id: 'syn_bolt',  key: 'bolt',  type: 'el', need: 2, name: '雷霆回响', color: '#56f0e8', bonusPower: 24, bonusSafe: 4,  bonusLoot: 0.12, desc: '【雷×2】战力+24，雷链清场赏金+12%' }
  ];

  // 14 Duelyst mercenaries with fine tiers (D..SSS), roles, elements (high tiers dual-element), signing personalities, and ultimates
  const MERCENARY_POOL = [
    {
      id: 'susan_medic', unitId: 'n_medic', name: '苏珊', title: '草药秘医',
      tier: 'D', role: 'support', elements: ['grass'],
      personality: 'loyal', signStyle: 'rep', signReq: { rep: 40, gold: 45 },
      power: 28, fee: 16, salary: 14, greed: 0.26, loyalty: 80, favDrink: 'holy_ale',
      ultName: '生命药雾', quirk: { name: '廉价急救', desc: '全队稳健 +10，受伤归来免费治疗' },
      barks: ['出场费便宜，但绷带按市价算哦。', '老板别熬太晚，来点薄荷茶？', '草药刚晒好，今晚谁需要奶一口？'],
      drunkBark: '哇，这麦酒比草药汤好喝一百倍！',
      intelBark: '我从伤员伤口里验出了属性残留——情报给你！'
    },
    {
      id: 'iron_anvil', unitId: 'f1_3rdgeneral', name: '铁砧', title: '银盾老兵',
      tier: 'C', role: 'tank', elements: ['light'],
      personality: 'loyal', signStyle: 'rep', signReq: { rep: 45, gold: 65 },
      power: 35, fee: 20, salary: 18, greed: 0.34, loyalty: 76, favDrink: 'holy_ale',
      ultName: '叹息壁垒', quirk: { name: '死扛到底', desc: '站1号位替脆皮挡刀，降低装备损毁率' },
      barks: ['盾牌擦亮了，今晚哪座墓穴要人扛？', '只要酒管够，站最前面算我的。', '别让我跟火药桶老七一队！'],
      drunkBark: '哈！这杯够劲，今晚能多扛两下！',
      intelBark: '老板，我打听到了——今晚目标的底细在这儿！'
    },
    {
      id: 'kyle_blade', unitId: 'neutral_astralcrusader', name: '凯尔', title: '风刃队长',
      tier: 'B', role: 'warrior', elements: ['light'],
      personality: 'loyal', signStyle: 'bet', signReq: { targetGold: 220, nights: 2 },
      power: 42, fee: 26, salary: 22, greed: 0.44, loyalty: 70, favDrink: 'rum',
      ultName: '圣光三连斩', quirk: { name: '骑士荣誉', desc: '厚道分账时下晚战力 +12%' },
      barks: ['骑士团发不出饷了，只能来接私活。', '给个前排，我三剑劈开大门。', '这壁炉比皇城暖和多了。'],
      drunkBark: '风刃出鞘！今晚的赏金志在必得！',
      intelBark: '城防处老兄弟透了口风，Boss 属性摸清了！'
    },
    {
      id: 'seven_boom', unitId: 'n_grenadier', name: '火药桶老七', title: '爆破狂魔',
      tier: 'B', role: 'ranged', elements: ['fire'],
      personality: 'drunk', signStyle: 'drink', signReq: { drinkId: 'rum', gold: 75 },
      power: 45, fee: 25, salary: 22, greed: 0.42, loyalty: 66, favDrink: 'rum',
      ultName: '黑火药齐射', quirk: { name: '艺术就是爆炸', desc: '超高火系爆发，专炸草系 Boss' },
      barks: ['老板！借壁炉点根引线行不行？', '一颗黑火药解决不了就两颗！', '给我烈焰朗姆，签字好说！'],
      drunkBark: '烈焰朗姆配黑火药！！今晚掀翻屋顶！！',
      intelBark: '哈哈！那地方全是易燃物，情报给你摸透了！'
    },
    {
      id: 'vera_gambit', unitId: 'f2_altgeneral', name: '红桃薇拉', title: '千术赌徒',
      tier: 'B+', role: 'assassin', elements: ['dark'],
      personality: 'greedy', signStyle: 'bet', signReq: { targetGold: 260, nights: 2 },
      power: 44, fee: 24, salary: 24, greed: 0.72, loyalty: 60, favDrink: 'absinthe',
      ultName: '命运梭哈', quirk: { name: '顺手牵羊', desc: '胜利有高概率偷走 Boss 密袋 +45G' },
      barks: ['押大押小？不如押我今晚单杀 Boss。', '想签我？0 签字费对赌两晚，敢吗？', '老板的眼神像极了老千，我喜欢。'],
      drunkBark: '好酒！今晚手气热得发烫！',
      intelBark: '刚赢了雇主随从的底牌——Boss 属性看穿了！'
    },
    {
      id: 'buck_pirate', unitId: 'n_pirate', name: '黑胡子巴克', title: '独眼船长',
      tier: 'B+', role: 'warrior', elements: ['ice'],
      personality: 'greedy', signStyle: 'bet', signReq: { targetGold: 280, nights: 2 },
      power: 46, fee: 28, salary: 26, greed: 0.76, loyalty: 58, favDrink: 'rum',
      ultName: '怒海狂涛', quirk: { name: '海盗刮地皮', desc: '胜利必多捞 +35G，但极讨厌超红线抽成' },
      barks: ['我要听见宝箱砸在吧台上的声音！', '抽成敢超我红线，我就掀桌子！', '带我赚够金币，船长就常驻你这儿！'],
      drunkBark: '哈哈哈！今晚连 Boss 金牙一块撬！',
      intelBark: '线人刚发来密报，Boss 弱点在这儿！'
    },
    {
      id: 'crimson_fox', unitId: 's_fox', name: '赤尾', title: '灯笼狐灵',
      tier: 'A-', role: 'ranged', elements: ['fire', 'bolt'],
      personality: 'drunk', signStyle: 'drink', signReq: { drinkId: 'absinthe', gold: 105 },
      power: 49, fee: 30, salary: 28, greed: 0.58, loyalty: 66, favDrink: 'absinthe',
      ultName: '九尾鬼火雷', quirk: { name: '鬼火寻宝', desc: '双属性火+雷，易触发隐藏宝箱 +40G' },
      barks: ['紫金灯笼真好看呀~ 请我喝苦艾就跟你签！', '人类的金币亮晶晶的，我也想攒一窝！', '尾巴飘起来啦~'],
      drunkBark: '微醺啦~ 今晚给你叼个大宝箱回来！',
      intelBark: '灯笼映出凶兆啦，Boss 属性我都看清咯！'
    },
    {
      id: 'aria_sun', unitId: 'f1_altgeneral', name: '阿莉娅', title: '晨曦圣女',
      tier: 'A', role: 'support', elements: ['light', 'grass'],
      personality: 'loyal', signStyle: 'rep', signReq: { rep: 62, gold: 110 },
      power: 48, fee: 30, salary: 26, greed: 0.28, loyalty: 82, favDrink: 'holy_ale',
      ultName: '破晓圣咏', quirk: { name: '圣光兜底', desc: '双属性光+草，全队稳健 +14' },
      barks: ['愿晨曦照亮这间满是酒气的黑店……', '声望太臭的酒馆我可不签约哦。', '麦酒里没掺水吧，老板？'],
      drunkBark: '魔力暖洋洋的，我可以多放两道圣光。',
      intelBark: '圣堂占卜已显灵，Boss 属性已揭晓！'
    },
    {
      id: 'kiri_mist', unitId: 'n_kiri', name: '影牙雾', title: '双刃游侠',
      tier: 'A', role: 'assassin', elements: ['dark', 'ice'],
      personality: 'gear', signStyle: 'gift', signReq: { minTierRank: 3 },
      power: 53, fee: 34, salary: 30, greed: 0.48, loyalty: 64, favDrink: 'absinthe',
      ultName: '霜影绝杀', quirk: { name: '先手斩首', desc: '双属性暗+冰，开局削弱 Boss 14% 威胁' },
      barks: ['……（默默擦着涂毒短刃）', '给钱不签，拿把蓝阶以上像样装备当聘礼。', '天亮前把头带回来。'],
      drunkBark: '苦艾不错……今晚替你多探一条退路。',
      intelBark: '踩点回来了，Boss 的属性和破绽全在这。'
    },
    {
      id: 'mord_blood', unitId: 'f4_blacksolus', name: '莫德', title: '血月祭司',
      tier: 'A+', role: 'ranged', elements: ['dark', 'bolt'],
      personality: 'drunk', signStyle: 'drink', signReq: { drinkId: 'shadow_gin', gold: 130 },
      power: 56, fee: 36, salary: 32, greed: 0.50, loyalty: 64, favDrink: 'shadow_gin',
      ultName: '血月雷咒', quirk: { name: '血月共鸣', desc: '双属性暗+雷，同队暗/雷队友战力 +12%' },
      barks: ['血月升起之时，委托价码也该翻倍。', '请我喝杯暗影苦酒，合约便由你拟。', '这酒馆风水很适合招魂啊。'],
      drunkBark: '好浓的暗影酒……血月之力在沸腾！',
      intelBark: '骨骰卜了一卦：Boss 属性无所遁形！'
    },
    {
      id: 'lady_locke', unitId: 'n_locke', name: '洛克夫人', title: '黑市军火商',
      tier: 'S-', role: 'support', elements: ['light', 'bolt'],
      personality: 'greedy', signStyle: 'bet', signReq: { targetGold: 420, nights: 2 },
      power: 58, fee: 40, salary: 36, greed: 0.68, loyalty: 66, favDrink: 'holy_ale',
      ultName: '全员军火换装', quirk: { name: '溢价统帅', desc: '同队另外两名佣兵战力各 +15%' },
      barks: ['好经纪人卖的不是人头，是溢价。', '两晚带我赚够 420G，我就入股你这酒馆。', '合作愉快，老板。'],
      drunkBark: '品味不错。今晚免费借队员两把好刀。',
      intelBark: '黑市情报网传回消息——Boss 底细全清！'
    },
    {
      id: 'baiyu_fan', unitId: 's_backstab', name: '白羽', title: '折扇暗杀者',
      tier: 'S', role: 'assassin', elements: ['dark', 'grass'],
      personality: 'gear', signStyle: 'gift', signReq: { minTierRank: 5 },
      power: 64, fee: 44, salary: 40, greed: 0.52, loyalty: 62, favDrink: 'absinthe',
      ultName: '千羽毒影杀', quirk: { name: '风雅破甲', desc: '双属性暗+草，必中暴击且无视护盾' },
      barks: ['折扇一合，万籁俱寂。', '庸俗的金币免谈，拿件紫阶以上奇兵来聘我。', '出场费可谈，面子不能打折。'],
      drunkBark: '微醺正合剑意，今晚斩落首级。',
      intelBark: '雇主隐瞒了属性，我已替你摸清底细。'
    },
    {
      id: 'grey_fenrir', unitId: 'f6_3rdgeneral', name: '格雷', title: '霜狼战主',
      tier: 'S+', role: 'tank', elements: ['ice', 'bolt'],
      personality: 'gear', signStyle: 'gift', signReq: { minTierRank: 6 },
      power: 72, fee: 50, salary: 46, greed: 0.44, loyalty: 68, favDrink: 'frost_vodka',
      ultName: '极地雷狼啸', quirk: { name: '孤狼战主', desc: '双属性冰+雷，极高坦度与斩杀伤害' },
      barks: ['北境风雪比这儿冷十倍，来杯寒霜酒！', '唯有紫阶以上神兵配得上我的战斧！', '弱者留桌，强者随我撕碎猎物。'],
      drunkBark: '嗷呜！！酒劲上来了，谁也拦不住！',
      intelBark: '我闻到了猎物属性——左翼有旧伤！'
    },
    {
      id: 'lilith_dance', unitId: 'f4_altgeneral', name: '莉莉丝', title: '绯红影后',
      tier: 'SSS', role: 'assassin', elements: ['fire', 'dark'],
      personality: 'gear', signStyle: 'gift', signReq: { minTierRank: 8 },
      power: 86, fee: 62, salary: 58, greed: 0.60, loyalty: 65, favDrink: 'shadow_gin',
      ultName: '绯红午夜终章', quirk: { name: '全城传奇', desc: 'SSS 唯一传奇（火+暗），全队战力 +18% 且赏金 +20%' },
      barks: ['全城悬赏最高的女人坐你店里，还不动手？', '拿暗金神装当聘礼，我就让你的酒馆名震天下。', '给我挑最危险的单子，软柿子没意思。'],
      drunkBark: '咯咯……今夜谁挡路，就拿谁助兴吧。',
      intelBark: '暗影低语早已告诉我 Boss 的一切弱点~'
    }
  ];

  // Contracts: 明牌单 / 迷雾 Boss 单 / 护镖 / 劫镖 (All 5 Duelyst H5 Bosses actively wired!)
  const CONTRACTS = [
    {
      id: 'c_road', kind: 'bounty', fog: false, tier: 1, name: '废弃商道清剿',
      bossUnitId: 'boss_antiswarm', bossName: '毒棘虫群霸主', elements: ['grass'],
      threat: 74, baseReward: 155, repGain: 4, wantedGain: 0, dropChance: 0.45,
      flavor: '黑松林商道被毒藤虫群霸主截断，明牌单，适合新手练手。'
    },
    {
      id: 'c_grave', kind: 'bounty', fog: false, tier: 1, name: '雾锁乱葬岗',
      bossUnitId: 'boss_chaosknight', bossName: '混沌收割骑士', elements: ['dark'],
      threat: 92, baseReward: 195, repGain: 5, wantedGain: 0, dropChance: 0.50,
      flavor: '午夜钟声后坟头游荡着混沌骑士，光系佣兵专治各种不服。'
    },
    {
      id: 'c_escort', kind: 'escort', fog: false, tier: 1, name: '商会秘银护镖',
      bossUnitId: 'boss_cindera', bossName: '余烬女皇 · 劫镖首领', elements: ['fire'],
      threat: 88, baseReward: 180, repGain: 8, wantedGain: -4, dropChance: 0.35,
      flavor: '正规护镖单：稳赚声望与金币，还能洗掉一点通缉度。'
    },
    {
      id: 'c_heist', kind: 'heist', fog: false, tier: 2, name: '黑市劫镖：王室税车',
      bossUnitId: 'boss_skyfalltyrant', bossName: '苍穹暴君 · 押镖统帅', elements: ['light'],
      threat: 112, baseReward: 295, repGain: -6, wantedGain: 14, dropChance: 0.70,
      flavor: '暴利黑单！高概率爆紫装，但会扣声望并推高城卫通缉度。'
    },
    {
      id: 'c_cellar', kind: 'bounty', fog: true, tier: 2, name: '【迷雾】沉没地下酒窖',
      bossUnitId: 'boss_borealjuggernaut', bossName: '极寒巨像', elements: ['ice'],
      threat: 122, baseReward: 285, repGain: 7, wantedGain: 0, dropChance: 0.65,
      flavor: '迷雾大单！属性未知，建议先【踩点】或喝【迷雾苦艾】再配队。'
    },
    {
      id: 'c_vault', kind: 'bounty', fog: true, tier: 2, name: '【迷雾】黑铁失落金库',
      bossUnitId: 'boss_skyfalltyrant', bossName: '苍穹雷霆暴君', elements: ['bolt'],
      threat: 140, baseReward: 345, repGain: 8, wantedGain: 0, dropChance: 0.75,
      flavor: '迷雾大单！金库深处电弧闪烁，高概率掉落高阶军火。'
    },
    {
      id: 'c_sand', kind: 'bounty', fog: true, tier: 3, name: '【迷雾】诅咒黑沙堡',
      bossUnitId: 'boss_chaosknight', bossName: '噬魂混沌领主', elements: ['dark', 'grass'],
      threat: 168, baseReward: 445, repGain: 10, wantedGain: 0, dropChance: 0.85,
      flavor: '双属性高难迷雾 Boss！摸清属性针对克制可打 ×2.0 致命伤害。'
    },
    {
      id: 'c_rift', kind: 'bounty', fog: true, tier: 3, name: '【迷雾】午夜深渊裂隙',
      bossUnitId: 'boss_cindera', bossName: '熔核余烬女皇', elements: ['fire', 'dark'],
      threat: 196, baseReward: 560, repGain: 14, wantedGain: 0, dropChance: 0.95,
      flavor: '终局级双属性深渊女皇！拿下它你的酒馆将名震黑市。'
    }
  ];

  // Live tavern events (triggered every ~2 nights, hooked to current visitors/tags/gear)
  const EVENTS = [
    {
      id: 'ev_debt', title: '讨债打手踹开了酒馆大门！',
      hookTag: 'loan_shark',
      desc: (ctx) => `高利贷打手一把揪住【${ctx.merc.name}】的衣领：“欠债 60G 今晚必须还！”`,
      choices: [
        { label: '替他扛下 60G 债（直接免费签约！）', kind: 'amber', action: 'pay_debt_sign' },
        { label: '把他交出去换 55G 线人费（声望 -10）', kind: 'crimson', action: 'sell_out_merc' },
        { label: '拱火让他们店里干一架，顺手开盘口！', kind: 'default', action: 'brawl_bet' }
      ]
    },
    {
      id: 'ev_rival', title: '仇家上门寻仇！',
      hookTag: 'hiding',
      desc: (ctx) => `蒙面杀手推门冷笑：“【${ctx.merc.name}】果然躲在这儿，老板别多管闲事。”`,
      choices: [
        { label: '护短！酒馆保他（声望 +8，本晚战力 +20%）', kind: 'amber', action: 'protect_merc' },
        { label: '收 70G 封口费装没看见（该客逃离，声望 -8）', kind: 'crimson', action: 'bribe_ignore' }
      ]
    },
    {
      id: 'ev_fix_match', title: '神秘雇主塞来一袋黑钱',
      hookTag: null,
      desc: () => '黑袍金主把 120G 拍在吧台：“今晚悬赏故意派弱队演戏放水，这钱现在归你！”',
      choices: [
        { label: '收下 120G 黑钱（声望 -8，通缉 +8）', kind: 'crimson', action: 'take_dirty_money' },
        { label: '把钱甩他脸上赶出门（声望 +10）', kind: 'amber', action: 'reject_dirty_money' }
      ]
    },
    {
      id: 'ev_guard_check', title: '城卫队长进店“喝茶”',
      hookTag: null,
      desc: (ctx) => `城卫敲了敲你的通缉令（当前通缉 ${ctx.wanted}）：“最近黑市风声紧，老板懂规矩吧？”`,
      choices: [
        { label: '塞 55G 茶水费息事宁人（通缉 -12）', kind: 'amber', action: 'bribe_guard' },
        { label: '硬顶回去，拒绝交保护费（声望 +6，地税 +25G）', kind: 'crimson', action: 'defy_guard' }
      ]
    },
    {
      id: 'ev_brawl', title: '店里两个醉汉掀桌干起来了！',
      hookTag: 'dumped',
      desc: (ctx) => `【${ctx.merc.name}】借酒发疯，跟隔壁桌抡起酒瓶互砸，全店围观起哄！`,
      choices: [
        { label: '花 20G 请喝圣泉麦酒劝和（全店忠诚 +6，声望 +4）', kind: 'amber', action: 'calm_brawl' },
        { label: '趁乱开盘口收抽水（赚 65G，该客战力 +15% 但声望 -4）', kind: 'crimson', action: 'brawl_bet' }
      ]
    },
    {
      id: 'ev_mystery_box', title: '蒙面行商兜售“来历不明的木箱”',
      hookTag: null,
      desc: () => '行商压低声音：“85G 一口价，里头八成是紫/橙阶军火，也可能是城卫通缉的赃物……”',
      choices: [
        { label: '花 85G 赌一把开箱！（必得 B+~S 阶装备，可能 +10 通缉）', kind: 'amber', action: 'buy_mystery_gear' },
        { label: '不碰来路不明的货（稳妥放行）', kind: 'default', action: 'skip_event' }
      ]
    },
    {
      id: 'ev_vip_buyer', title: '黑市豪客点名高价求购军火！',
      hookTag: null,
      needGear: true,
      desc: (ctx) => `戴金戒指的豪客盯上了你军火架上的【${ctx.gear.name}】：“出价 ${Math.round(ctx.gear.basePrice * 1.55)}G 现金，卖不卖？”`,
      choices: [
        { label: '立刻高价变现！（赚 1.55 倍暴利）', kind: 'amber', action: 'sell_gear_vip' },
        { label: '镇店之宝不卖（声望 +5）', kind: 'default', action: 'keep_gear_vip' }
      ]
    },
    {
      id: 'ev_poach', title: '隔壁对头酒馆派猎头上门挖人！',
      hookTag: null,
      needSigned: true,
      desc: (ctx) => `猎头把金袋推给你的签约王牌【${ctx.signed.name}】：“来我们那儿，底薪翻倍！”`,
      choices: [
        { label: '发 50G 留任奖金稳住人心（忠诚 +15）', kind: 'amber', action: 'retain_signed' },
        { label: '冷笑放话“爱走不走”（若忠诚 <65 则解约跑路，否则忠诚 +6）', kind: 'crimson', action: 'dare_leave' }
      ]
    }
  ];

  // v7.0 Tactical Battle Drinks (Carried into battle: max 2 bottles, icons powered by Duelyst H5 Kit!)
  const BATTLE_DRINKS = [
    {
      id: 'flame_shot', name: '烈焰烧酒', short: '打断蓄力',
      cost: 18, target: 'enemy', element: 'fire', color: '#ff6e3a', glow: '#ff9b5c',
      icon: 'rum', duelystIcon: 'icon-130319687a750ebf796effdf',
      desc: '泼敌方：火系破甲爆发 + 打断 Boss 蓄力（每场限打断1次）'
    },
    {
      id: 'holy_ale', name: '圣泉麦酒', short: '回血护盾',
      cost: 16, target: 'ally', element: 'light', color: '#5ef29b', glow: '#9bffc4',
      icon: 'ale', duelystIcon: 'icon-8fe3811fcb33e8c9981eb990',
      desc: '泼我方：回复 35% 生命 + 附加一层护盾'
    },
    {
      id: 'fury_absinthe', name: '狂暴苦艾', short: '满怒大招',
      cost: 22, target: 'ally', element: 'dark', color: '#c07aff', glow: '#dfb3ff',
      icon: 'absinthe', duelystIcon: 'icon-1dde93f80d94cb80d0861041',
      desc: '泼我方：立刻补满 3 格怒气，下次行动必放大招'
    }
  ];

  // v7.0 Boss Monster Material Drops (Stored in tavern inventory -> feeds Phase 2 Brewing & Phase 4 Forging!)
  const MONSTER_MATERIALS = {
    fire:  { id: 'mat_fire',  name: '猩红火蜥胆',   element: 'fire',  color: '#ff6e3a', sellPrice: 28 },
    grass: { id: 'mat_grass', name: '幽冥毒腺',     element: 'grass', color: '#5ef29b', sellPrice: 26 },
    ice:   { id: 'mat_ice',   name: '深渊触手冰囊', element: 'ice',   color: '#5ce6ff', sellPrice: 30 },
    light: { id: 'mat_light', name: '碎裂圣光核',   element: 'light', color: '#ffe46b', sellPrice: 34 },
    dark:  { id: 'mat_dark',  name: '噬魂暗晶',     element: 'dark',  color: '#b56cff', sellPrice: 34 },
    bolt:  { id: 'mat_bolt',  name: '蓄雷魔爪',     element: 'bolt',  color: '#64d2ff', sellPrice: 32 }
  };

  const RENT_SCHEDULE = {
    3: 110,
    6: 210,
    9: 340,
    12: 490,
    15: 660
  };

  window.MT.DATA = {
    TIERS, ELEMENTS, getElementMultiplier, ROLES, LIFE_TAGS,
    TAVERN_LEVELS, DRINKS, BATTLE_DRINKS, MONSTER_MATERIALS,
    EQUIPMENT_POOL, SYNERGIES,
    MERCENARY_POOL, CONTRACTS, EVENTS, RENT_SCHEDULE
  };
})();
