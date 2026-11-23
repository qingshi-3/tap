// v10.0 Midnight Tavern: Deal-5-Pick-3 Squad Combos x Balatro Relic Engine Data
// Uses 100% selectively imported Duelyst H5 Kit assets (24 Faction Heroes, 12 Bosses, 31 VFX, 46 Icons)
(function () {
  window.MT = window.MT || {};

  const ROLES = {
    tank:    { id: 'tank',    name: '铁壁', short: '盾', color: '#6fd3ff' },
    striker: { id: 'striker', name: '突袭', short: '刃', color: '#ff8a5c' },
    ranged:  { id: 'ranged',  name: '秘术', short: '法', color: '#d48cff' }
  };

  const FACTIONS = {
    f1: { id: 'f1', name: '圣光', short: '光', color: '#ffd966', bg: '#453513', flushVfx: 'fx_f1_holyimmolation', altVfx: 'fx_f1_decimate', desc: '全屏圣焰净化与护盾' },
    f2: { id: 'f2', name: '烈焰', short: '炎', color: '#ff6b4a', bg: '#471a14', flushVfx: 'fx_f2_heavenseclipse', altVfx: 'fx_f2_eightgates_purpleflame', desc: '天穹烈焰连爆灼烧' },
    f3: { id: 'f3', name: '流沙', short: '沙', color: '#f0b85b', bg: '#423015', flushVfx: 'fx_f3_blaststarfire',  altVfx: 'fx_f3_cataclysmicfault', desc: '星火沙暴贯穿重创' },
    f4: { id: 'f4', name: '暗影', short: '影', color: '#c47dff', bg: '#2f1645', flushVfx: 'fx_f4_shadownova',     altVfx: 'fx_f4_doom', desc: '深渊新星吞噬倍增' },
    f5: { id: 'f5', name: '狂兽', short: '兽', color: '#5ef29b', bg: '#153b25', flushVfx: 'fx_f5_flamingstampede', altVfx: 'fx_f5_earthsphere_orange', desc: '狂怒践踏暴击狂飙' },
    f6: { id: 'f6', name: '极寒', short: '寒', color: '#6be5ff', bg: '#143347', flushVfx: 'fx_f6_winterswake',    altVfx: 'fx_f6_cryogenesis', desc: '极冬冰封碎甲双倍' }
  };

  // 24 Faction Heroes (4 per faction, all 6 factions x 3 roles balanced)
  const HEROES = [
    // f1 圣光 (4)
    { id: 'h_f1_brome',   unitId: 'f1_3rdgeneral',      name: '圣冠·布罗姆', faction: 'f1', role: 'tank',    atk: 42, hp: 220, vfx: 'fx_f1_holyimmolation', hitVfx: 'fxImpactBigOrange' },
    { id: 'h_f1_ziran',   unitId: 'f1_altgeneral',      name: '晨曦·齐兰',   faction: 'f1', role: 'ranged',  atk: 46, hp: 180, vfx: 'fx_f1_decimate',       hitVfx: 'fxBuffSimpleGold' },
    { id: 'h_f1_blade',   unitId: 'f1_spellbladeadept', name: '纯刃圣卫',     faction: 'f1', role: 'striker', atk: 54, hp: 175, vfx: 'fx_crossslash',        hitVfx: 'fxImpactBigOrange' },
    { id: 'h_f1_judge',   unitId: 'f1_peacekeeper2',    name: '裁决重铠',     faction: 'f1', role: 'tank',    atk: 48, hp: 235, vfx: 'fx_f1_decimate',       hitVfx: 'fxDistortionHexShield' },
    // f2 烈焰 (4)
    { id: 'h_f2_reva',    unitId: 'f2_altgeneral',      name: '暮弓·蕾瓦',   faction: 'f2', role: 'ranged',  atk: 55, hp: 160, vfx: 'fx_fireslash',         hitVfx: 'fx_flamesphere' },
    { id: 'h_f2_zendo',   unitId: 'f2_grandmasterzendo',name: '焰宗·禅道',   faction: 'f2', role: 'tank',    atk: 48, hp: 210, vfx: 'fx_f2_twilightreiki',  hitVfx: 'fxImpactBigOrange' },
    { id: 'h_f2_oni',     unitId: 'f2_demononi',        name: '心牢鬼武',     faction: 'f2', role: 'striker', atk: 60, hp: 170, vfx: 'fx_multislash_full',   hitVfx: 'fx_fireslash' },
    { id: 'h_f2_hawk',    unitId: 'f2_sparrowhawk',     name: '赤雀剑豪',     faction: 'f2', role: 'striker', atk: 56, hp: 165, vfx: 'fx_slashfrenzy',       hitVfx: 'fx_f2_teleportsmoke' },
    // f3 流沙 (4)
    { id: 'h_f3_allo',    unitId: 'f3_allomancer',      name: '星沙秘术师',   faction: 'f3', role: 'ranged',  atk: 52, hp: 170, vfx: 'fx_f3_blaststarfire',  hitVfx: 'fxExplosionBigWhiteHot' },
    { id: 'h_f3_nimbus',  unitId: 'f3_nimbus',          name: '金穹圣像',     faction: 'f3', role: 'tank',    atk: 46, hp: 230, vfx: 'fx_f3_cataclysmicfault',hitVfx: 'fxBuffSimpleGold' },
    { id: 'h_f3_saon',    unitId: 'f3_sister',          name: '流沙·萨温',   faction: 'f3', role: 'striker', atk: 54, hp: 185, vfx: 'fx_crossslash',        hitVfx: 'fxImpactBigOrange' },
    { id: 'h_f3_noshrak', unitId: 'f3_grandmasternoshrak',name:'陨日大君',    faction: 'f3', role: 'ranged',  atk: 62, hp: 175, vfx: 'fx_f3_blaststarfire',  hitVfx: 'fxFireTornado' },
    // f4 暗影 (4)
    { id: 'h_f4_cassyva', unitId: 'f4_altgeneral',      name: '噬魂·卡西瓦', faction: 'f4', role: 'ranged',  atk: 54, hp: 168, vfx: 'fx_f4_voidpulse',      hitVfx: 'fx_f4_shadownova' },
    { id: 'h_f4_solus',   unitId: 'f4_blacksolus',      name: '黑曜斩首者',   faction: 'f4', role: 'tank',    atk: 52, hp: 225, vfx: 'fx_f4_doom',           hitVfx: 'fx_f4_voidpulse' },
    { id: 'h_f4_maehv',   unitId: 'f4_3rdgeneral',      name: '裂皮·梅芙',   faction: 'f4', role: 'striker', atk: 58, hp: 180, vfx: 'fx_f4_shadownova',     hitVfx: 'fx_multislash_full' },
    { id: 'h_f4_reaper',  unitId: 'f4_reaperninemoons', name: '九月死神',     faction: 'f4', role: 'striker', atk: 60, hp: 165, vfx: 'fx_slashfrenzy',       hitVfx: 'fx_f4_doom' },
    // f5 狂兽 (4)
    { id: 'h_f5_rancour', unitId: 'f5_rancour',         name: '怒嚎狂兽',     faction: 'f5', role: 'striker', atk: 58, hp: 190, vfx: 'fx_f5_flamingstampede',hitVfx: 'fxImpactGreenBig' },
    { id: 'h_f5_rex',     unitId: 'f5_rex',             name: '暴君霸龙',     faction: 'f5', role: 'tank',    atk: 52, hp: 245, vfx: 'fx_f5_earthsphere_orange',hitVfx: 'fxExplosionBigBall_MetalSlug' },
    { id: 'h_f5_kraigon', unitId: 'f5_grandmasterkraigon',name:'灭世魔龙',    faction: 'f5', role: 'tank',    atk: 60, hp: 255, vfx: 'fx_f5_flamingstampede',hitVfx: 'fxImpactGreenBig' },
    { id: 'h_f5_taygete', unitId: 'f5_sister',          name: '裂地·泰格特', faction: 'f5', role: 'ranged',  atk: 54, hp: 185, vfx: 'fxLightningHitGreen',  hitVfx: 'fx_f5_earthsphere_orange' },
    // f6 极寒 (4)
    { id: 'h_f6_ilena',   unitId: 'f6_3rdgeneral',      name: '冰心·伊蕾娜', faction: 'f6', role: 'ranged',  atk: 52, hp: 175, vfx: 'fx_f6_cryogenesis',    hitVfx: 'fxExplosionMediumIcyWhite' },
    { id: 'h_f6_kara',    unitId: 'f6_altgeneral',      name: '冬刃·卡拉',   faction: 'f6', role: 'striker', atk: 56, hp: 185, vfx: 'fx_f6_winterswake',    hitVfx: 'fxImpactBlueBig' },
    { id: 'h_f6_embla',   unitId: 'f6_grandmasterembla',name: '永冬宗师',     faction: 'f6', role: 'tank',    atk: 48, hp: 235, vfx: 'fxFrozenIceBlock',     hitVfx: 'fxExplosionMediumIcyWhite' },
    { id: 'h_f6_seraph',  unitId: 'f6_ghostseraphim',   name: '霜灵炽天使',   faction: 'f6', role: 'ranged',  atk: 60, hp: 180, vfx: 'fx_f6_winterswake',    hitVfx: 'fxImpactBlueBig' }
  ];

  // 6 Poker-style Squad Hand Types (strictly ordered highest tier -> lowest, GPT Fix #2 single match!)
  const HAND_TYPES = [
    {
      id: 'royal_triangle', name: '同花铁三角', short: '同花铁三角',
      baseMult: 4.0, baseBonus: 120, multPerLv: 0.5, bonusPerLv: 40,
      color: '#ffd966', glow: '#ff9a2e',
      icon: 'icon-08578cf104b6ec7d82c8fd04',
      perk: '全屏阵营合体技 + 开局全队抢攻1轮',
      extraTurn: true, factionBlast: true, fusion: false
    },
    {
      id: 'three_kind', name: '三尊合体', short: '三尊合体',
      baseMult: 3.2, baseBonus: 95, multPerLv: 0.45, bonusPerLv: 35,
      color: '#ff7be5', glow: '#c84bff',
      icon: 'icon-f4767c4065ec5a27484f02e6',
      perk: '三位同名融合成巨型3★战神出阵',
      extraTurn: false, factionBlast: false, fusion: true
    },
    {
      id: 'flush', name: '同阵营三连', short: '同阵营三连',
      baseMult: 2.4, baseBonus: 65, multPerLv: 0.4, bonusPerLv: 30,
      color: '#6be5ff', glow: '#29b6f6',
      icon: 'icon-630102b7729df69f550f894b',
      perk: '开场爆发全屏阵营合体技',
      extraTurn: false, factionBlast: true, fusion: false
    },
    {
      id: 'triangle', name: '铁三角', short: '铁三角',
      baseMult: 1.8, baseBonus: 40, multPerLv: 0.35, bonusPerLv: 25,
      color: '#5ef29b', glow: '#26d07c',
      icon: 'icon-01cd7f904e07647a3ea00e54',
      perk: '盾+刃+法齐备，开局全队抢攻1轮',
      extraTurn: true, factionBlast: false, fusion: false
    },
    {
      id: 'pair', name: '同名双煞', short: '同名双煞',
      baseMult: 1.5, baseBonus: 25, multPerLv: 0.3, bonusPerLv: 20,
      color: '#ffb84d', glow: '#ff8a3d',
      icon: 'icon-07e4557e022e78a2dde68434',
      perk: '两位同名侠客触发双子连斩',
      extraTurn: false, factionBlast: false, fusion: false, twinSlash: true
    },
    {
      id: 'high_card', name: '散客小队', short: '散客小队',
      baseMult: 1.0, baseBonus: 0, multPerLv: 0.25, bonusPerLv: 18,
      color: '#a9b4d6', glow: '#66749e',
      icon: 'icon-0fb84a38631da949be569ce5',
      perk: '任意3人出战，靠秘宝引擎爆发',
      extraTurn: false, factionBlast: false, fusion: false
    }
  ];

  // GPT Fix #2: Strictly match highest-tier-first, stop on first match!
  function evaluateHand(selected3, handLevels = {}) {
    if (!selected3 || selected3.length < 3) {
      return { ready: false, count: selected3 ? selected3.length : 0, hand: null, mult: 1, bonus: 0, lv: 1, faction: null };
    }
    const f0 = selected3[0].faction;
    const sameFaction = selected3.every((h) => h.faction === f0);
    const roles = new Set(selected3.map((h) => h.role));
    const hasTriangle = roles.has('tank') && roles.has('striker') && roles.has('ranged');
    const tplCounts = {};
    for (const h of selected3) tplCounts[h.tplId] = (tplCounts[h.tplId] || 0) + 1;
    const maxSameTpl = Math.max(...Object.values(tplCounts));

    let matched = HAND_TYPES[5]; // high_card
    if (sameFaction && hasTriangle) matched = HAND_TYPES[0];
    else if (maxSameTpl >= 3)       matched = HAND_TYPES[1];
    else if (sameFaction)           matched = HAND_TYPES[2];
    else if (hasTriangle)           matched = HAND_TYPES[3];
    else if (maxSameTpl >= 2)       matched = HAND_TYPES[4];

    const lv = Math.max(1, handLevels[matched.id] || 1);
    const mult = +(matched.baseMult + (lv - 1) * matched.multPerLv).toFixed(2);
    const bonus = matched.baseBonus + (lv - 1) * matched.bonusPerLv;
    return {
      ready: true,
      count: 3,
      hand: matched,
      lv,
      mult,
      bonus,
      faction: sameFaction ? FACTIONS[f0] : null
    };
  }

  // Relic Editions (Balatro-style visual & mechanical upgrades)
  const EDITIONS = {
    normal:     { id: 'normal',     name: '',       badge: '',     addDmg: 0,  multDmg: 1,   extraSlot: 0, priceAdd: 0 },
    foil:       { id: 'foil',       name: '闪金',   badge: '✦闪金', addDmg: 35, multDmg: 1,   extraSlot: 0, priceAdd: 2, desc: '触发时额外 +35 伤' },
    polychrome: { id: 'polychrome', name: '多彩',   badge: '◈多彩', addDmg: 0,  multDmg: 1.5, extraSlot: 0, priceAdd: 3, desc: '触发时伤害 ×1.5 倍' },
    negative:   { id: 'negative',   name: '负片',   badge: '☾负片', addDmg: 0,  multDmg: 1,   extraSlot: 1, priceAdd: 3, desc: '装备后秘宝栏位上限 +1' }
  };

  // 36 Interlocking Relics (+ Additive, ⚡ Duelyst VFX/Retrigger, × Multiplicative)
  // Strictly evaluated LEFT -> RIGHT in slot order!
  const RELICS = [
    // === 12 Additive (+) Relics ===
    { id: 'r_godhammer',   cat: 'add',  rarity: 'common',   cost: 4, name: '神锤碎甲',   icon: 'icon-087055c7861fe605a3ef8e73', vfx: 'fxImpactBigOrange',
      short: '+38 伤', desc: '每次攻击基础伤害 +38', onHit: (ctx) => ({ add: 38, label: '+38' }) },
    { id: 'r_pavise',      cat: 'add',  rarity: 'common',   cost: 4, name: '耀阳塔盾',   icon: 'icon-01cd7f904e07647a3ea00e54', vfx: 'fxDistortionHexShield',
      short: '铁壁+60', desc: '队伍含铁壁时每次攻击 +60 伤', onHit: (ctx) => ctx.hasRole('tank') ? { add: 60, label: '+60 铁壁' } : null },
    { id: 'r_hexblade',    cat: 'add',  rarity: 'common',   cost: 4, name: '咒印魔剑',   icon: 'icon-454ae99b6edbe3ab5e7f1a4c', vfx: 'fx_crossslash',
      short: '突袭+65', desc: '突袭侠客出手时伤害 +65', onHit: (ctx) => ctx.attacker.role === 'striker' ? { add: 65, label: '+65 突袭' } : null },
    { id: 'r_spectral',    cat: 'add',  rarity: 'common',   cost: 4, name: '灵刃秘典',   icon: 'icon-a25e63a0ce8d432d9024b951', vfx: 'fx_f2_twilightreiki',
      short: '秘术+65', desc: '秘术侠客出手时伤害 +65', onHit: (ctx) => ctx.attacker.role === 'ranged' ? { add: 65, label: '+65 秘术' } : null },
    { id: 'r_bloodrage',   cat: 'add',  rarity: 'common',   cost: 4, name: '血怒角杯',   icon: 'icon-1dde93f80d94cb80d0861041', vfx: 'fxImpactBigOrange',
      short: '连击+14', desc: '本场每累计1次出手，本次 +14 伤', onHit: (ctx) => ({ add: ctx.hitIndex * 14, label: `+${ctx.hitIndex * 14} 血怒` }) },
    { id: 'r_wraithcrown', cat: 'add',  rarity: 'uncommon', cost: 5, name: '亡灵皇冠',   icon: 'icon-5b259d77f8eb2a13a3e620fb', vfx: 'fx_f4_voidpulse',
      short: '暗影+85', desc: '暗影或流沙侠客出手 +85 伤', onHit: (ctx) => (ctx.attacker.faction === 'f4' || ctx.attacker.faction === 'f3') ? { add: 85, label: '+85 暗沙' } : null },
    { id: 'r_winterblade', cat: 'add',  rarity: 'uncommon', cost: 5, name: '霜冻长刃',   icon: 'icon-c859b77ca06b34684765a733', vfx: 'fxImpactBlueBig',
      short: '极寒+85', desc: '极寒或圣光侠客出手 +85 伤', onHit: (ctx) => (ctx.attacker.faction === 'f6' || ctx.attacker.faction === 'f1') ? { add: 85, label: '+85 寒光' } : null },
    { id: 'r_claws',       cat: 'add',  rarity: 'uncommon', cost: 5, name: '精钢兽爪',   icon: 'icon-f6b708bf78dd83f0fde50df3', vfx: 'fxImpactGreenBig',
      short: '炎兽+85', desc: '烈焰或狂兽侠客出手 +85 伤', onHit: (ctx) => (ctx.attacker.faction === 'f2' || ctx.attacker.faction === 'f5') ? { add: 85, label: '+85 炎兽' } : null },
    { id: 'r_goldvitriol', cat: 'add',  rarity: 'uncommon', cost: 5, name: '炼金筹码',   icon: 'icon-d7fb4a7519b997571b4ff455', vfx: 'fxBuffSimpleGold',
      short: '每G+4伤', desc: '每持有1G，每次攻击 +4 伤（上限+160）', onHit: (ctx) => { const v = Math.min(160, ctx.gold * 4); return v > 0 ? { add: v, label: `+${v} 金筹` } : null; } },
    { id: 'r_lionheart',   cat: 'add',  rarity: 'common',   cost: 4, name: '狮心祝福',   icon: 'icon-2780f621fa193b285c5582db', vfx: 'fxBuffSimpleGold',
      short: '全队+45', desc: '前3次攻击每次额外 +90，之后 +30', onHit: (ctx) => ({ add: ctx.hitIndex <= 3 ? 90 : 30, label: ctx.hitIndex <= 3 ? '+90 先锋' : '+30' }) },
    { id: 'r_onyxseal',    cat: 'add',  rarity: 'uncommon', cost: 5, name: '黑曜熊印',   icon: 'icon-0685b892212ffb8a15890e08', vfx: 'fxExplosionBigBall_MetalSlug',
      short: '换桌增伤', desc: '本波每剩1次换桌机会 +55 伤', onHit: (ctx) => ctx.discardsLeft > 0 ? { add: ctx.discardsLeft * 55, label: `+${ctx.discardsLeft * 55} 沉着` } : null },
    { id: 'r_sundrop',     cat: 'add',  rarity: 'uncommon', cost: 5, name: '落日仙丹',   icon: 'icon-8fe3811fcb33e8c9981eb990', vfx: 'fxBuffSimpleGold',
      short: '精简+伤', desc: '花名册每少于10人，全队攻击 +35 伤', onHit: (ctx) => { const v = Math.max(25, (12 - ctx.rosterSize) * 35); return { add: v, label: `+${v} 精锐` }; } },

    // === 12 VFX / Retrigger (⚡) Relics ===
    { id: 'r_phoenix',     cat: 'vfx',  rarity: 'uncommon', cost: 5, name: '凤凰真火',   icon: 'icon-130319687a750ebf796effdf', vfx: 'fx_flamesphere',
      short: '⚡炎爆+75', desc: '出手引爆凤凰火球，追加 +75 伤', onHit: (ctx) => ({ add: 75, fx: 'fx_flamesphere', label: '⚡凤火+75' }) },
    { id: 'r_shadownova',  cat: 'vfx',  rarity: 'rare',     cost: 6, name: '暗影新星',   icon: 'icon-585d48d205e145d530bfa722', vfx: 'fx_f4_shadownova',
      short: '⚡每3击新星', desc: '每第3次出手引爆暗影新星 +180 伤', onHit: (ctx) => ctx.hitIndex % 3 === 0 ? { add: 180, fx: 'fx_f4_shadownova', shake: 12, label: '⚡新星+180' } : null },
    { id: 'r_eightgates',  cat: 'vfx',  rarity: 'rare',     cost: 6, name: '八门紫炎',   icon: 'icon-2f4c06bd94dbd4cff67c8997', vfx: 'fx_f2_eightgates_purpleflame',
      short: '⚡连斩再动', desc: '每2次出手触发紫炎连斩，伤害+95并追加连击', onHit: (ctx) => ctx.hitIndex % 2 === 0 ? { add: 95, fx: 'fx_f2_eightgates_purpleflame', label: '⚡紫炎+95' } : null },
    { id: 'r_starfury',    cat: 'vfx',  rarity: 'uncommon', cost: 5, name: '星火齐射',   icon: 'icon-630102b7729df69f550f894b', vfx: 'fx_f3_blaststarfire',
      short: '⚡星火+70', desc: '秘术或同阵营时降下星火 +70 伤', onHit: (ctx) => (ctx.attacker.role === 'ranged' || ctx.handId === 'flush' || ctx.handId === 'royal_triangle') ? { add: 95, fx: 'fx_f3_blaststarfire', label: '⚡星火+95' } : { add: 40, fx: 'fx_f3_blaststarfire', label: '⚡星火+40' } },
    { id: 'r_winterswake', cat: 'vfx',  rarity: 'rare',     cost: 6, name: '极冬苏醒',   icon: 'icon-16f0f826e0e3c127a6048f4f', vfx: 'fx_f6_winterswake',
      short: '⚡碎冰+110', desc: '召唤极冬冰刺 +110 伤并减缓Boss攻势', onHit: (ctx) => ({ add: 110, fx: 'fx_f6_winterswake', label: '⚡极冬+110' }) },
    { id: 'r_lightning',   cat: 'vfx',  rarity: 'uncommon', cost: 5, name: '翠雷轰击',   icon: 'icon-e4ce3c3a0cb7e1c7a1cc0927', vfx: 'fxLightningHitGreen',
      short: '⚡雷击+80', desc: '每击落下一道碧绿惊雷 +80 伤', onHit: (ctx) => ({ add: 80, fx: 'fxLightningHitGreen', label: '⚡惊雷+80' }) },
    { id: 'r_cataclysm',   cat: 'vfx',  rarity: 'rare',     cost: 6, name: '裂地岩崩',   icon: 'icon-65d2a30cf05526f44e8a96c1', vfx: 'fx_f3_cataclysmicfault',
      short: '⚡铁壁震击', desc: '首轮与末轮引爆裂地岩崩 +160 伤', onHit: (ctx) => (ctx.hitIndex <= 3 || ctx.bossHpRatio < 0.45) ? { add: 160, fx: 'fx_f3_cataclysmicfault', shake: 11, label: '⚡岩崩+160' } : null },
    { id: 'r_tornado',     cat: 'vfx',  rarity: 'rare',     cost: 6, name: '炙炎龙卷',   icon: 'icon-c0ba3caceb714e6d7c9dcb20', vfx: 'fxFireTornado',
      short: '⚡火卷+100', desc: '每击卷起烈焰风暴 +100 伤', onHit: (ctx) => ({ add: 100, fx: 'fxFireTornado', label: '⚡火卷+100' }) },
    { id: 'r_mirrormeld',  cat: 'vfx',  rarity: 'epic',     cost: 7, name: '镜像复刻',   icon: 'icon-f4767c4065ec5a27484f02e6', vfx: 'fx_f2_teleportsmoke',
      short: '⚡复刻左秘宝', desc: '复制紧邻左侧秘宝的效果再次触发！', isCopyLeft: true },
    { id: 'r_saberspine',  cat: 'vfx',  rarity: 'epic',     cost: 7, name: '连斩秘印',   icon: 'icon-c4f8e5f2138f76ed2cd8b08a', vfx: 'fx_slashfrenzy',
      short: '⚡首名再动', desc: '站位第1的侠客每回合额外再出手1次！', extraActSlot: 0, onHit: (ctx) => ctx.slotIdx === 0 ? { add: 45, fx: 'fx_slashfrenzy', label: '⚡连斩+45' } : null },
    { id: 'r_iceblock',    cat: 'vfx',  rarity: 'uncommon', cost: 5, name: '冰霜护匣',   icon: 'icon-a0b7aea084dc9ed413b1abd6', vfx: 'fxFrozenIceBlock',
      short: '⚡冻伤+85', desc: '每击附带寒冰碎裂 +85 伤', onHit: (ctx) => ({ add: 85, fx: 'fxFrozenIceBlock', label: '⚡寒碎+85' }) },
    { id: 'r_voidpulse',   cat: 'vfx',  rarity: 'uncommon', cost: 5, name: '虚空脉动',   icon: 'icon-d5a1e331f520b2358d8639e9', vfx: 'fx_f4_voidpulse',
      short: '⚡吸金+1G', desc: '每第4次攻击吸取 +1G 并爆出虚空冲击 +90', onHit: (ctx) => ctx.hitIndex % 4 === 0 ? { add: 90, bonusGold: 1, fx: 'fx_f4_voidpulse', label: '⚡脉动+1G' } : null },

    // === 12 Multiplicative (×) & Rule-Breaker Relics ===
    { id: 'r_eclipse',     cat: 'mult', rarity: 'rare',     cost: 6, name: '天穹日蚀',   icon: 'icon-08578cf104b6ec7d82c8fd04', vfx: 'fx_f2_heavenseclipse',
      short: '×1.5 倍', desc: '无条件将当前伤害 ×1.5 倍！', onHit: (ctx) => ({ mult: 1.5, fx: 'fx_f2_heavenseclipse', label: '×1.5 日蚀' }) },
    { id: 'r_twinfang',    cat: 'mult', rarity: 'rare',     cost: 6, name: '双牙连乘',   icon: 'icon-07e4557e022e78a2dde68434', vfx: 'fx_multislash_full',
      short: '牌型×1.8', desc: '非散客牌型时，当前伤害 ×1.8 倍！', onHit: (ctx) => ctx.handId !== 'high_card' ? { mult: 1.8, label: '×1.8 牌型' } : null },
    { id: 'r_doom',        cat: 'mult', rarity: 'epic',     cost: 7, name: '末日审判',   icon: 'icon-2b424f37a740631cf0edce16', vfx: 'fx_f4_doom',
      short: '斩杀×2.2', desc: 'Boss血量低于60%时，伤害直接 ×2.2 倍！', onHit: (ctx) => ctx.bossHpRatio <= 0.6 ? { mult: 2.2, fx: 'fx_f4_doom', shake: 14, label: '×2.2 末日!' } : null },
    { id: 'r_arcaneheart', cat: 'mult', rarity: 'rare',     cost: 6, name: '秘法之心',   icon: 'icon-a37b04895535fd65c9cabae1', vfx: 'fx_f1_holyimmolation',
      short: '同花×2.0', desc: '打出同阵营三连或同花铁三角时 ×2.0 倍！', onHit: (ctx) => (ctx.handId === 'flush' || ctx.handId === 'royal_triangle') ? { mult: 2.0, fx: 'fx_f1_holyimmolation', label: '×2.0 同花!' } : null },
    { id: 'r_eternalheart',cat: 'mult', rarity: 'rare',     cost: 6, name: '永恒之心',   icon: 'icon-ef0dad030257d6d8ae167153', vfx: 'fx_f5_earthsphere_orange',
      short: '铁三角×1.9', desc: '打出铁三角或同花铁三角时 ×1.9 倍！', onHit: (ctx) => (ctx.handId === 'triangle' || ctx.handId === 'royal_triangle') ? { mult: 1.9, label: '×1.9 铁三角' } : null },
    { id: 'r_dawnseye',    cat: 'mult', rarity: 'epic',     cost: 7, name: '破晓之眼',   icon: 'icon-20f207666182d15e5dafa811', vfx: 'fx_f1_decimate',
      short: '连击递增×', desc: '每次攻击倍率递增：×1.15 → ×1.3 → ×1.45…', onHit: (ctx) => { const m = +(1 + ctx.hitIndex * 0.15).toFixed(2); return { mult: m, label: `×${m} 破晓` }; } },
    { id: 'r_shadowmask',  cat: 'mult', rarity: 'rare',     cost: 6, name: '暗影假面',   icon: 'icon-968b90f1c0f9a182b5f103f8', vfx: 'fx_f4_shadownova',
      short: '偶击×1.85', desc: '偶数次攻击触发暗影暴击 ×1.85 倍', onHit: (ctx) => ctx.hitIndex % 2 === 0 ? { mult: 1.85, label: '×1.85 暗暴' } : null },
    { id: 'r_bloodmask',   cat: 'mult', rarity: 'epic',     cost: 7, name: '血怒面具',   icon: 'icon-986e4d34be4a385a6ee3b4b6', vfx: 'fxExplosionBigWhiteHot',
      short: '尾击×2.4', desc: '每轮第3位侠客出手伤害 ×2.4 倍！', onHit: (ctx) => ctx.slotIdx === 2 ? { mult: 2.4, fx: 'fxExplosionBigWhiteHot', shake: 12, label: '×2.4 终结!' } : null },
    { id: 'r_cyclonemask', cat: 'mult', rarity: 'rare',     cost: 6, name: '飓风假面',   icon: 'icon-8fcb2f113aa91ce213cb7015', vfx: 'fx_f6_cryogenesis',
      short: '红印×2.2', desc: '带有🔴红印的侠客出手时 ×2.2 倍！', onHit: (ctx) => ctx.attacker.redSeal ? { mult: 2.2, label: '×2.2 红印!' } : { mult: 1.25, label: '×1.25' } },
    { id: 'r_mistdragon',  cat: 'mult', rarity: 'epic',     cost: 7, name: '雾龙圣印',   icon: 'icon-ff9404191bfa84cb0d671b55', vfx: 'fx_f5_flamingstampede',
      short: '同名×2.1', desc: '打出同名双煞或三尊合体时 ×2.1 倍！', onHit: (ctx) => (ctx.handId === 'pair' || ctx.handId === 'three_kind') ? { mult: 2.1, label: '×2.1 双尊!' } : null },
    { id: 'r_howling',     cat: 'mult', rarity: 'rare',     cost: 6, name: '嚎叫圣物',   icon: 'icon-0ad5146b7e8c79631e4322e4', vfx: 'fxExplosionMediumIcyWhite',
      short: '满栏×1.9', desc: '装备秘宝≥4件时，每次攻击 ×1.9 倍', onHit: (ctx) => ctx.relicCount >= 4 ? { mult: 1.9, label: '×1.9 共鸣' } : { mult: 1.3, label: '×1.3' } },
    { id: 'r_shining',     cat: 'mult', rarity: 'epic',     cost: 7, name: '辉光星核',   icon: 'icon-869de204d8fbc7464e607644', vfx: 'fx_f1_holyimmolation',
      short: '每胜+0.2×', desc: '每通过1波永久+0.2×，当前 ×(1.2+波数×0.2)', onHit: (ctx) => { const m = +(1.2 + ctx.wave * 0.2).toFixed(2); return { mult: m, label: `×${m} 星核` }; } }
  ];

  // 6 Alchemy Tarot Cards (Deck-Fixing inside Alchemy Booster Pack! GPT Fix #1: Banish keeps >= 3 heroes!)
  const ALCHEMY_CARDS = [
    { id: 'al_red_seal',  name: '猩红再动印', icon: 'icon-c4f8e5f2138f76ed2cd8b08a', color: '#ff5268', needsHero: true,
      desc: '为1名侠客永久烙上【红印】：每次出战自动攻击2次！' },
    { id: 'al_shift_f',   name: '阵营同化药', icon: 'icon-466a5b65794d8ccb2a0b2c48', color: '#6be5ff', needsHero: true,
      desc: '将1名侠客改造成你花名册中人数最多的主阵营，极速凑同花！' },
    { id: 'al_clone',     name: '镜像克隆术', icon: 'icon-f4767c4065ec5a27484f02e6', color: '#ff7be5', needsHero: true,
      desc: '完整复制1名侠客（含红印与战力）加入花名册，冲击三尊合体！' },
    { id: 'al_banish',    name: '酒馆驱逐令', icon: 'icon-f2c70661b51894b44fd1664b', color: '#ffb84d', needsHero: true, minRoster: 4,
      desc: '永久移出1名不需要的杂牌侠客，极大提升同花/同名抽率（至少保留3人）' },
    { id: 'al_forge',     name: '秘焰淬体酒', icon: 'icon-8fe3811fcb33e8c9981eb990', color: '#ffd966', needsHero: true,
      desc: '为1名侠客永久锻造 +28 基础攻击力与 +40 生命！' },
    { id: 'al_midas',     name: '点金黑市契', icon: 'icon-d7fb4a7519b997571b4ff455', color: '#5ef29b', needsHero: false,
      desc: '立即使当前金币翻倍（最高获得 +18G），无需选择目标！' }
  ];

  // 3 Booster Pack Types (Emotional Showstopper Opening Ceremony!)
  const PACKS = [
    {
      id: 'pack_relic', name: '秘宝秘匣', subtitle: '4选1 稀有秘宝', cost: 5, count: 4,
      icon: 'icon-8301ee385fd5a49bc5fecfd2',
      accent: '#ffd966', glow: '#ff942e', burstVfx: 'fx_f1_holyimmolation',
      desc: '撕开秘匣，从4件秘宝中任选1件（高概率出闪金/多彩/负片版本！）'
    },
    {
      id: 'pack_hero', name: '稀客招募包', subtitle: '4选1 精锐侠客', cost: 4, count: 4,
      icon: 'icon-c73309688fafee8ff6bcb5cd',
      accent: '#6be5ff', glow: '#369cff', burstVfx: 'fx_f6_winterswake',
      desc: '从4位传奇稀客中招募1位入花名册（有概率自带🔴红印或高攻！）'
    },
    {
      id: 'pack_alchemy', name: '炼金改造包', subtitle: '3选1 塔罗提纯', cost: 4, count: 3,
      icon: 'icon-0d75e9fcb8c79b6b313ec227',
      accent: '#df7dff', glow: '#a93dff', burstVfx: 'fx_f4_shadownova',
      desc: '3选1炼金塔罗，给侠客烙红印、同化阵营、克隆或精简牌库！'
    }
  ];

  // 12 Giant Duelyst Bosses (drafted into 8 escalating waves!)
  const BOSS_POOL = [
    { id: 'b_antiswarm',  unitId: 'boss_antiswarm',       name: '噬群巨魔',   title: '镜湖先锋', affix: '铁皮：每次受击减免12伤', armor: 12, vfx: 'fxImpactGreenBig' },
    { id: 'b_decepticle', unitId: 'boss_decepticle',      name: '幻影构装',   title: '机械卫兵', affix: '闪避矩阵：首击伤害-20%', firstShield: 0.2, vfx: 'fx_f2_teleportsmoke' },
    { id: 'b_solfist',    unitId: 'boss_solfist',         name: '烈阳铁拳',   title: '熔火守门', affix: '炽拳：Boss反击造成重压', vfx: 'fx_flamesphere' },
    { id: 'b_vampire',    unitId: 'boss_vampire',         name: '猩红伯爵',   title: '血月领主', affix: '血契：半血以下开启血雾', vfx: 'fx_f4_voidpulse' },
    { id: 'b_boreal',     unitId: 'boss_borealjuggernaut',name: '极北冰巨兽', title: '永冬霸主', affix: '冻铠：前2击减伤25%', frostHits: 2, vfx: 'fx_f6_cryogenesis' },
    { id: 'b_cindera',    unitId: 'boss_cindera',         name: '灰烬女皇',   title: '焚城妖姬', affix: '余烬：每回合灼烧镜湖', vfx: 'fxFireTornado' },
    { id: 'b_chaosknight',unitId: 'boss_chaosknight',     name: '混沌黑骑',   title: '裂隙统帅', affix: '暗铠：每击减免22伤', armor: 22, vfx: 'fx_f4_shadownova' },
    { id: 'b_shinkage',   unitId: 'boss_shinkagezendo',   name: '影宗·真禅',  title: '幽冥剑圣', affix: '残影：极速连斩压迫', vfx: 'fx_f2_eightgates_purpleflame' },
    { id: 'b_invader',    unitId: 'boss_invader',         name: '异界吞噬者', title: '深空来客', affix: '虚空盾：吸收首个爆发25%', firstShield: 0.25, vfx: 'fx_f4_doom' },
    { id: 'b_manaman',    unitId: 'boss_manaman',         name: '魔泉泰坦',   title: '奥术魔神', affix: '魔涌：高额血量考验倍率', vfx: 'fx_f3_blaststarfire' },
    { id: 'b_wujin',      unitId: 'boss_wujin',           name: '无尽战尊',   title: '修罗武神', affix: '霸体：减免28伤', armor: 28, vfx: 'fx_f5_flamingstampede' },
    { id: 'b_skyfall',    unitId: 'boss_skyfalltyrant',   name: '天陨暴君',   title: '日蚀终末', affix: '终局日蚀：终极高血量Boss', armor: 30, vfx: 'fx_f2_heavenseclipse' }
  ];

  // Wave HP curve tuned so W1 is winnable with a decent combo/starter relic, and W5-W8 rewards true Balatro scaling!
  const WAVE_CONFIG = [
    { wave: 1, hp: 920,   baseReward: 6,  bossIdx: 0 },
    { wave: 2, hp: 1650,  baseReward: 7,  bossIdx: 2 },
    { wave: 3, hp: 2900,  baseReward: 8,  bossIdx: 4 },
    { wave: 4, hp: 4800,  baseReward: 9,  bossIdx: 5 },
    { wave: 5, hp: 7900,  baseReward: 10, bossIdx: 6 },
    { wave: 6, hp: 12800, baseReward: 11, bossIdx: 8 },
    { wave: 7, hp: 19500, baseReward: 12, bossIdx: 10 },
    { wave: 8, hp: 30000, baseReward: 16, bossIdx: 11 }
  ];

  function getWaveBoss(wave, runSeed = 0) {
    const idx = Math.min(WAVE_CONFIG.length - 1, Math.max(0, wave - 1));
    const cfg = WAVE_CONFIG[idx];
    const extraScale = wave > 8 ? Math.pow(1.65, wave - 8) : 1;
    // Pick deterministic varied boss per wave, final W8 always Skyfall Tyrant
    const poolIdx = wave === 8 ? 11 : ((cfg.bossIdx + (runSeed % 2)) % 11);
    const tpl = BOSS_POOL[poolIdx];
    return {
      ...tpl,
      wave,
      maxHp: Math.round(cfg.hp * extraScale),
      reward: cfg.baseReward + (wave > 8 ? 2 : 0)
    };
  }

  let _uidSeq = 1;
  function makeHeroInstance(tpl, overrides = {}) {
    return {
      uid: 'h_' + (_uidSeq++) + '_' + Math.random().toString(36).slice(2, 6),
      tplId: tpl.id,
      unitId: tpl.unitId,
      name: tpl.name,
      faction: overrides.faction || tpl.faction,
      role: tpl.role,
      atk: tpl.atk + (overrides.bonusAtk || 0),
      hp: tpl.hp + (overrides.bonusHp || 0),
      vfx: tpl.vfx,
      hitVfx: tpl.hitVfx,
      redSeal: Boolean(overrides.redSeal)
    };
  }

  // Starter 8-Hero Tavern Roster: 3 factions (f1/f2/f4) + balanced Tank/Striker/Ranged so player IMMEDIATELY sees real Flush/Triangle/Pair hands on W1!
  function createStarterRoster() {
    const starterIds = [
      'h_f1_brome',   // f1 tank
      'h_f1_blade',   // f1 striker
      'h_f1_ziran',   // f1 ranged
      'h_f2_reva',    // f2 ranged
      'h_f2_oni',     // f2 striker
      'h_f2_zendo',   // f2 tank
      'h_f4_cassyva', // f4 ranged
      'h_f4_solus'    // f4 tank
    ];
    return starterIds.map((id) => makeHeroInstance(HEROES.find((h) => h.id === id)));
  }

  function rollEdition(boosted = false) {
    const r = Math.random();
    if (boosted) {
      if (r < 0.14) return 'negative';
      if (r < 0.34) return 'polychrome';
      if (r < 0.62) return 'foil';
      return 'normal';
    }
    if (r < 0.05) return 'negative';
    if (r < 0.14) return 'polychrome';
    if (r < 0.28) return 'foil';
    return 'normal';
  }

  window.MT.V10_DATA = {
    ROLES,
    FACTIONS,
    HEROES,
    HAND_TYPES,
    EDITIONS,
    RELICS,
    ALCHEMY_CARDS,
    PACKS,
    BOSS_POOL,
    WAVE_CONFIG,
    evaluateHand,
    getWaveBoss,
    makeHeroInstance,
    createStarterRoster,
    rollEdition,
    getHeroTpl: (id) => HEROES.find((h) => h.id === id),
    getRelicTpl: (id) => RELICS.find((r) => r.id === id),
    getHandType: (id) => HAND_TYPES.find((h) => h.id === id),
    getPackTpl: (id) => PACKS.find((p) => p.id === id),
    getAlchemyTpl: (id) => ALCHEMY_CARDS.find((a) => a.id === id)
  };
})();
