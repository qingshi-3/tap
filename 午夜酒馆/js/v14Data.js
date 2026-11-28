// v14.0 Midnight Tavern: Live-Gear Heroes x 7-Phase Event Bus x 51-Card Pool
// Naming: [Theme] [Tier C/B/A/S/SSS] · [Core Function] — zero cringe idioms, instant clarity!
// Incorporates all GPT v14 Logic Fixes + Deep Single-Card Permanent Scaling.
(function () {
  window.MT = window.MT || {};

  const THEMES = {
    core:    { id: 'core',    name: '通用', short: '通用', color: '#ffd966', bg: '#3c2f16', desc: '全流派可用的战力、再动、易伤、空位与金币加成' },
    discard: { id: 'discard', name: '换牌', short: '换牌', color: '#6be5ff', bg: '#153447', desc: '通过换牌弃牌触发飞刀、加攻与追打' },
    shield:  { id: 'shield',  name: '盾反', short: '盾反', color: '#78b7ff', bg: '#1a2d4c', desc: '叠护盾抗伤害，并用护盾与受击反击' },
    poison:  { id: 'poison',  name: '剧毒', short: '剧毒', color: '#7ef28a', bg: '#163b22', desc: '叠毒翻倍与回合末无视护盾扣血，还能产金加攻' },
    frost:   { id: 'frost',   name: '极寒', short: '极寒', color: '#9cf4ff', bg: '#11344a', desc: '叠冰降 Boss 攻击，满 10 层冻结并碎冰爆发' },
    hand:    { id: 'hand',    name: '留手', short: '留手', color: '#f0b85b', bg: '#3d2c12', desc: '留在手牌里即可全队增伤、成长与场下追打' },
    summon:  { id: 'summon',  name: '献祭', short: '献祭', color: '#e288ff', bg: '#361547', desc: '吞噬队友永久继承战力、空位招剑灵与退场爆发' },
    blood:   { id: 'blood',   name: '燃血', short: '燃血', color: '#ff5c72', bg: '#4a1220', desc: '扣血换高倍率伤害、残血再动与锁血反杀' },
    dice:    { id: 'dice',    name: '赌博', short: '赌博', color: '#ffe066', bg: '#453512', desc: '抛硬币掷骰子赌高倍暴击、加盾与赢金币' }
  };

  const TIERS = {
    C:   { id: 'C',   label: 'C',   color: '#c4ccde', bg: '#2c3242', weight: 0 },
    B:   { id: 'B',   label: 'B',   color: '#79d2ff', bg: '#16334a', weight: 36 },
    A:   { id: 'A',   label: 'A',   color: '#d48cff', bg: '#341c4a', weight: 32 },
    S:   { id: 'S',   label: 'S',   color: '#ffd966', bg: '#473311', weight: 22 },
    SSS: { id: 'SSS', label: 'SSS', color: '#ff6b8b', bg: '#4a1426', weight: 10 }
  };

  // === 8-Card Universal Starter Templates (Zero theme lock!) ===
  const STARTER_TEMPLATES = {
    st_blade: {
      id: 'st_blade', unitId: 'f1_spellbladeadept', theme: 'core', tier: 'C',
      name: '通用 C · 剑客', shortName: '剑客', atk: 55, cost: 3,
      vfx: 'pfx_sword_slash', tag: '战力', isStarter: true,
      desc: '无特殊效果。'
    },
    st_guard: {
      id: 'st_guard', unitId: 'f1_3rdgeneral', theme: 'core', tier: 'C',
      name: '通用 C · 盾卫', shortName: '盾卫', atk: 35, cost: 3,
      vfx: 'pfx_blunt_hit', tag: '护盾', isStarter: true,
      shieldVal: 40,
      desc: '出手时获得 +40 护盾。'
    },
    st_scout: {
      id: 'st_scout', unitId: 'f3_sister', theme: 'core', tier: 'B',
      name: '通用 B · 破甲斥候', shortName: '破甲斥候', atk: 30, cost: 3,
      vfx: 'pfx_thrust', tag: '易伤', isStarter: true,
      applyVuln: true,
      desc: '出手命中后给 Boss 挂【易伤】。'
    },
    st_drummer: {
      id: 'st_drummer', unitId: 'f2_grandmasterzendo', theme: 'core', tier: 'B',
      name: '通用 B · 复读鼓手', shortName: '复读鼓手', atk: 20, cost: 4,
      vfx: 'pfx_magic_circle', tag: '复读', isStarter: true,
      retriggerLeft: true,
      desc: '出手后，让紧邻左侧的队员再出手 1 次。'
    },
    st_waiter: {
      id: 'st_waiter', unitId: 'f3_allomancer', theme: 'core', tier: 'B',
      name: '通用 B · 产钱小二', shortName: '产钱小二', atk: 30, cost: 3,
      vfx: 'pfx_coin_drop', tag: '产钱', isStarter: true,
      goldOnStrike: 1, goldOnDiscard: 1,
      desc: '出手或换牌弃掉时，获得 +1G。'
    }
  };

  // === 18 Shop Heroes (6 Core + 4 Discard + 4 Shield + 4 Poison) ===
  const SHOP_HEROES = [
    // --- 6 Core Universal Gears ---
    {
      id: 'c_shadow_follow', unitId: 'f2_sparrowhawk', theme: 'core', tier: 'A',
      name: '通用 A · 影步补刀', shortName: '影步补刀', atk: 42, cost: 4,
      vfx: 'pfx_dagger_flurry', tag: '跟打/养成',
      followPrev: true, followGrowAtk: 4,
      desc: '左侧队友每次出手时补砍 1 刀，每补砍 1 次自身永久 +4 攻击。'
    },
    {
      id: 'c_lone_wolf', unitId: 'f5_rancour', theme: 'core', tier: 'S',
      name: '通用 S · 孤狼空位', shortName: '孤狼空位', atk: 55, cost: 5,
      vfx: 'pfx_heavy_cleave', tag: '孤狼',
      emptySlotMult: 1.8,
      desc: '本手每空 1 个出战位，自身本次伤害 ×1.8（单人上阵 ×3.24）。'
    },
    {
      id: 'c_veteran', unitId: 'f5_grandmasterkraigon', theme: 'core', tier: 'A',
      name: '通用 A · 留手养成', shortName: '留手养成', atk: 40, cost: 4,
      vfx: 'pfx_double_slash', tag: '留手/养成',
      inHandGrowPerStrike: 8,
      desc: '留在手牌时，场上每出手 1 次，自身永久 +8 攻击。'
    },
    {
      id: 'c_amp_mage', unitId: 'f1_altgeneral', theme: 'core', tier: 'S',
      name: '通用 S · 右侧翻倍', shortName: '右侧翻倍', atk: 0, cost: 5,
      vfx: 'pfx_holy_pillar', tag: '增幅',
      noAttackAmpRight: 2.0,
      desc: '自身不攻击，使紧邻右侧队员本次伤害 ×2.0。'
    },
    {
      id: 'c_gold_broker', unitId: 'f3_grandmasternoshrak', theme: 'core', tier: 'A',
      name: '通用 A · 消费养成', shortName: '消费养成', atk: 42, cost: 4,
      vfx: 'pfx_coin_drop', tag: '经济/养成',
      goldOnStrike: 2, growPerSpend3G: 12,
      desc: '出手 +2G；商店每花 3G，自身永久 +12 攻击。'
    },
    {
      id: 'c_grand_drummer', unitId: 'f2_demononi', theme: 'core', tier: 'SSS',
      name: '通用 SSS · 战鼓宗师', shortName: '战鼓宗师', atk: 35, cost: 7,
      vfx: 'pfx_spin_slash', tag: '复读',
      retriggerLeft: true, inheritLeftAtkRatio: 0.6,
      desc: '继承左侧队员 60% 攻击出手，并让左侧队员立刻再出手 1 次。'
    },

    // --- 4 Discard-Knife Theme Heroes ---
    {
      id: 't_disc_knife', unitId: 'f2_altgeneral', theme: 'discard', tier: 'S',
      name: '换牌 S · 无限飞刀', shortName: '无限飞刀', atk: 40, cost: 5,
      vfx: 'pfx_dagger_flurry', tag: '弃牌/养成',
      knifeCount: 2, growKnifeOnDiscard: 1,
      desc: '换牌弃掉时蓄出飞刀（初 2 把，每次换牌永久 +1 把），随本手首位队员齐射。'
    },
    {
      id: 't_disc_sharp', unitId: 'f6_altgeneral', theme: 'discard', tier: 'B',
      name: '换牌 B · 磨刃注能', shortName: '磨刃注能', atk: 38, cost: 4,
      vfx: 'pfx_cyan_slash', tag: '弃牌/养成',
      discardGrowSelfAtk: 15, discardInjectTeamAtk: true, discardGold: 1,
      desc: '换牌弃掉时永久 +15 攻击，将自身全部攻击加给本回合全队，并 +1G。'
    },
    {
      id: 't_disc_scav', unitId: 'f4_3rdgeneral', theme: 'discard', tier: 'A',
      name: '换牌 A · 弃牌导流', shortName: '弃牌导流', atk: 42, cost: 5,
      vfx: 'pfx_mana_burst', tag: '追打', isBridge: true,
      discardTriggerLeftmostHand: true,
      desc: '换牌弃掉时，手牌最左侧队员随本手首次出击免费追打 1 次。'
    },
    {
      id: 't_disc_reaper', unitId: 'f4_reaperninemoons', theme: 'discard', tier: 'SSS',
      name: '换牌 SSS · 洗牌死神', shortName: '洗牌死神', atk: 52, cost: 7,
      vfx: 'pfx_scythe_reap', tag: '终结',
      multPerWaveDiscard: 0.4,
      desc: '本波换牌每弃掉 1 张牌，自身本次伤害倍率 +0.4×。'
    },

    // --- 4 Shield-Counter Theme Heroes ---
    {
      id: 't_shd_bastion', unitId: 'f3_nimbus', theme: 'shield', tier: 'A',
      name: '盾反 A · 挨打叠盾', shortName: '挨打叠盾', atk: 40, cost: 4,
      vfx: 'pfx_shield_block', tag: '叠盾/养成',
      shieldVal: 50, growOnSlot1SurviveShield: 12, growOnSlot1SurviveAtk: 15,
      desc: '出手获得护盾（初 50）；站 1 号位挨打存活后，永久 +12 护盾与 +15 攻击。'
    },
    {
      id: 't_shd_spike', unitId: 'f1_peacekeeper2', theme: 'shield', tier: 'B',
      name: '盾反 B · 反甲重击', shortName: '反甲重击', atk: 42, cost: 4,
      vfx: 'pfx_parry', tag: '盾击',
      shieldVal: 25, shieldToAtkRatio: 1.2,
      desc: '出手 +25 护盾，并将当前护盾的 120% 转为本次额外攻击。'
    },
    {
      id: 't_shd_borrow', unitId: 'f6_grandmasterembla', theme: 'shield', tier: 'S',
      name: '盾反 S · 借势电池', shortName: '借势电池', atk: 38, cost: 5,
      vfx: 'pfx_zap_hit', tag: '蓄力', isBridge: true,
      slot1Shield: 28, borrowHitToSlot3: 0.6,
      desc: '站 1 号位 +28 护盾；本回合 Boss 造成的总伤害，有 60% 转为下回合 3 号位攻击。'
    },
    {
      id: 't_shd_colossus', unitId: 'f5_rex', theme: 'shield', tier: 'SSS',
      name: '盾反 SSS · 耗盾巨像', shortName: '耗盾巨像', atk: 52, cost: 7,
      vfx: 'pfx_hammer_smash', tag: '终结/养成',
      consumeHalfShieldMult: 8, growAtkPer20ShieldConsumed: 15,
      desc: '出手消耗一半护盾，每点追加 +8 攻击；每消耗 20 护盾自身永久 +15 攻击。'
    },

    // --- 4 Poison-Alchemy Theme Heroes ---
    {
      id: 't_poi_fang', unitId: 'f4_blacksolus', theme: 'poison', tier: 'B',
      name: '剧毒 B · 传染毒牙', shortName: '传染毒牙', atk: 36, cost: 4,
      vfx: 'pfx_acid_splash', tag: '挂毒',
      applyPoison: 10, slot1InfectTeammates: 3,
      desc: '出手挂 10 层【剧毒】；站 1 号位时，本回合后续队友命中额外 +3 层毒。'
    },
    {
      id: 't_poi_brew', unitId: 'f4_altgeneral', theme: 'poison', tier: 'A',
      name: '剧毒 A · 毒层翻倍', shortName: '毒层翻倍', atk: 34, cost: 5,
      vfx: 'pfx_spore_burst', tag: '翻毒/养成',
      applyPoison: 6, multPoison: 1.5, growPoisonOnPoisonKill: 4,
      desc: '出手挂 6 层毒并使 Boss 毒层 ×1.5；击杀中毒 Boss 后挂毒永久 +4 层。'
    },
    {
      id: 't_poi_blood', unitId: 'f5_sister', theme: 'poison', tier: 'S',
      name: '剧毒 S · 吞毒注能', shortName: '吞毒注能', atk: 38, cost: 5,
      vfx: 'pfx_venom_bolt', tag: '吞毒/养成', isBridge: true,
      poisonBloodBridge: true,
      desc: 'Boss 无毒时挂 12 层毒；有毒则吞掉一半，每层使自身永久 +3 攻击、全队本回合 +5 攻击。'
    },
    {
      id: 't_poi_lord', unitId: 'f6_ghostseraphim', theme: 'poison', tier: 'SSS',
      name: '剧毒 SSS · 即时毒爆', shortName: '即时毒爆', atk: 48, cost: 7,
      vfx: 'pfx_venom_blast', tag: '终结',
      detonatePoison: true,
      desc: '出手时立刻结算 1 次 Boss 身上的【剧毒】（无视护盾，不减层数）。'
    },

    // --- 4 Frost Theme Heroes (Expansion Pack #4: 40 Orbs) ---
    {
      id: 't_frz_shard', unitId: 'f6_3rdgeneral', theme: 'frost', tier: 'B',
      name: '极寒 B · 寒霜叠冰', shortName: '寒霜叠冰', atk: 38, cost: 4,
      vfx: 'pfx_ice_spikes', tag: '叠冰',
      applyFrost: 4,
      desc: '出手给 Boss 挂 4 层【冰霜】。'
    },
    {
      id: 't_frz_shatter', unitId: 'f6_altgeneral', theme: 'frost', tier: 'A',
      name: '极寒 A · 碎冰成长', shortName: '碎冰成长', atk: 44, cost: 5,
      vfx: 'pfx_ice_shatter', tag: '碎冰/养成',
      shatterMult: 1.8, shatterGrowAtk: 8,
      desc: '攻击带【冰霜】的 Boss 时伤害 ×1.8，每次触发自身永久 +8 攻击。'
    },
    {
      id: 't_frz_bridge', unitId: 'f6_grandmasterembla', theme: 'frost', tier: 'S',
      name: '极寒 S · 冰甲导流', shortName: '冰甲导流', atk: 40, cost: 5,
      vfx: 'pfx_snowflake_burst', tag: '盾转冰', isBridge: true,
      slot1Shield: 22, shieldToFrostPer10: 1,
      desc: '站 1 号位 +22 护盾；出手时每有 10 点护盾，额外给 Boss 挂 +1 层【冰霜】。'
    },
    {
      id: 't_frz_lord', unitId: 'f6_ghostseraphim', theme: 'frost', tier: 'SSS',
      name: '极寒 SSS · 永冬崩裂', shortName: '永冬崩裂', atk: 52, cost: 7,
      vfx: 'pfx_frost_nova', tag: '终结',
      consumeFrostBonusAtk: 25, consumeFrostBonusMult: 0.18,
      desc: '出手清空 Boss 全部【冰霜】，每层追加 +25 攻击与 +18% 伤害。'
    },

    // --- 4 Hand-Steel Theme Heroes (Expansion Pack #5: 50 Orbs) ---
    {
      id: 't_hnd_steel', unitId: 'f1_peacekeeper2', theme: 'hand', tier: 'B',
      name: '留手 B · 钢牌助威', shortName: '钢牌助威', atk: 36, cost: 4,
      vfx: 'pfx_parry', tag: '留手',
      inHandTeamMult: 1.25,
      desc: '留在手牌不出时，场上所有队员伤害 ×1.25。'
    },
    {
      id: 't_hnd_gold', unitId: 'f3_allomancer', theme: 'hand', tier: 'A',
      name: '留手 A · 藏金养成', shortName: '藏金养成', atk: 38, cost: 5,
      vfx: 'pfx_coin_drop', tag: '留手/养成',
      inHandEndGold: 2, inHandEndGrowAtk: 12,
      desc: '留在手牌时，每回合结束 +2G 且自身永久 +12 攻击。'
    },
    {
      id: 't_hnd_bridge', unitId: 'f2_sparrowhawk', theme: 'hand', tier: 'S',
      name: '留手 S · 场下援护', shortName: '场下援护', atk: 42, cost: 5,
      vfx: 'pfx_emerald_double', tag: '追打', isBridge: true,
      leftmostAssistSlot3: true,
      desc: '留在手牌最左侧时，3 号位每次出手后，自身从手牌免费追打 1 次。'
    },
    {
      id: 't_hnd_lord', unitId: 'f5_grandmasterkraigon', theme: 'hand', tier: 'SSS',
      name: '留手 SSS · 蓄锋宗师', shortName: '蓄锋宗师', atk: 50, cost: 7,
      vfx: 'pfx_gold_cleave', tag: '终结',
      multPerRemainingHand: 1.35,
      desc: '出手时每留有 1 张手牌，自身伤害 ×1.35（留 5 张 ×4.48）。'
    },

    // --- 4 Sacrifice-Summon Theme Heroes (Expansion Pack #6: 60 Orbs) ---
    {
      id: 't_sac_devour', unitId: 'f4_blacksolus', theme: 'summon', tier: 'B',
      name: '献祭 B · 吞噬剑客', shortName: '吞噬剑客', atk: 42, cost: 4,
      vfx: 'pfx_void_scythe', tag: '吞噬/养成',
      devourLeftRatio: 0.5, devourMult: 1.6,
      desc: '上阵时吞掉左侧队友（本波退场），永久继承其 50% 攻击，本次伤害 ×1.6。'
    },
    {
      id: 't_sac_legacy', unitId: 'f2_grandmasterzendo', theme: 'summon', tier: 'A',
      name: '献祭 A · 遗言燃料', shortName: '遗言燃料', atk: 48, cost: 5,
      vfx: 'pfx_hex_sigil', tag: '遗言',
      onExhaustTeamPermAtk: 15, onExhaustGold: 3,
      desc: '被吞噬或玻璃刃退场时，全牌组永久 +15 攻击并 +3G。'
    },
    {
      id: 't_sac_bridge', unitId: 'f3_sister', theme: 'summon', tier: 'S',
      name: '献祭 S · 空位召灵', shortName: '空位召灵', atk: 40, cost: 5,
      vfx: 'pfx_spawn_portal', tag: '召灵', isBridge: true,
      summonBladeIfEmpty: 0.8,
      desc: '出手时若有空出战位，召唤 1 名剑灵补砍 1 刀（继承 80% 攻击且吃秘宝）。'
    },
    {
      id: 't_sac_lord', unitId: 'f4_reaperninemoons', theme: 'summon', tier: 'SSS',
      name: '献祭 SSS · 冥渊魔神', shortName: '冥渊魔神', atk: 55, cost: 7,
      vfx: 'pfx_dark_explosion', tag: '终结',
      multPerWaveExhaust: 1.8,
      desc: '本波每有 1 名队员退场，自身本次伤害 ×1.8。'
    },

    // --- 4 Blood-Burn Theme Heroes (Expansion Pack #7: 70 Orbs) ---
    {
      id: 't_bld_slash', unitId: 'f5_rancour', theme: 'blood', tier: 'B',
      name: '燃血 B · 狂血斩击', shortName: '狂血斩击', atk: 46, cost: 4,
      vfx: 'pfx_blood_claws', tag: '扣血/养成',
      selfHpCost: 8, selfCostMult: 1.75, selfCostGrowAtk: 8,
      desc: '出手扣小队 8 血（至少留 1 血），本次伤害 ×1.75 且自身永久 +8 攻击。'
    },
    {
      id: 't_bld_leech', unitId: 'f4_3rdgeneral', theme: 'blood', tier: 'A',
      name: '燃血 A · 噬血汲取', shortName: '噬血汲取', atk: 42, cost: 5,
      vfx: 'pfx_blood_drain', tag: '吸血/残血',
      healOnStrike: 12, lowHpThreshold: 0.6, lowHpMult: 1.8,
      desc: '出手回复小队 12 血；当前血量 ≤60% 时，本次伤害 ×1.8。'
    },
    {
      id: 't_bld_bridge', unitId: 'f1_3rdgeneral', theme: 'blood', tier: 'S',
      name: '燃血 S · 血盾转化', shortName: '血盾转化', atk: 44, cost: 5,
      vfx: 'pfx_blood_smite', tag: '转盾', isBridge: true,
      selfHpCost: 10, bloodToShield: 35, applyVuln: true,
      desc: '出手扣小队 10 血，获得 +35 护盾并给 Boss 挂【易伤】。'
    },
    {
      id: 't_bld_lord', unitId: 'f2_demononi', theme: 'blood', tier: 'SSS',
      name: '燃血 SSS · 猩红战神', shortName: '猩红战神', atk: 54, cost: 7,
      vfx: 'pfx_blood_cleave', tag: '终结',
      missingHpPctMult: 0.03,
      desc: '小队每损失 1% 血量，自身伤害 +3%（10% 血时 ×3.7）。'
    },

    // --- 4 Gamble-Dice Theme Heroes (Expansion Pack #8: 80 Orbs) ---
    {
      id: 't_dic_coin', unitId: 'f3_allomancer', theme: 'dice', tier: 'B',
      name: '赌博 B · 抛币赌徒', shortName: '抛币赌徒', atk: 45, cost: 4,
      vfx: 'pfx_coin_drop', tag: '抛币',
      gambleCoinMult: 2.2, gambleFailGold: 2,
      desc: '出手抛硬币（50% 正面）：正面伤害 ×2.2，反面 +2G。'
    },
    {
      id: 't_dic_dice', unitId: 'f2_sparrowhawk', theme: 'dice', tier: 'A',
      name: '赌博 A · 命运骰手', shortName: '命运骰手', atk: 42, cost: 5,
      vfx: 'pfx_star_fall', tag: '掷骰/养成',
      gambleDiceMode: true,
      desc: '出手掷骰：低点 +20 护盾，中点永久 +14 攻击，高点本次伤害 ×2.4。'
    },
    {
      id: 't_dic_bridge', unitId: 'f3_grandmasternoshrak', theme: 'dice', tier: 'S',
      name: '赌博 S · 筹码加注', shortName: '筹码加注', atk: 44, cost: 5,
      vfx: 'pfx_collect_burst', tag: '加注', isBridge: true,
      gambleBetGold: 2, retriggerLeftOnBet: true,
      desc: '持有 ≥2G 时自动押 2G：左侧队员立刻再出手 1 次，且 50% 返还 4G。'
    },
    {
      id: 't_dic_lord', unitId: 'f1_altgeneral', theme: 'dice', tier: 'SSS',
      name: '赌博 SSS · 皇家庄家', shortName: '皇家庄家', atk: 52, cost: 7,
      vfx: 'pfx_royal_crit', tag: '终结',
      multPerGambleWin: 1.45,
      desc: '本波每触发 1 次赌博正面/高点，自身本次伤害 ×1.45。'
    }
  ];

  const ALL_HERO_MAP = {};
  Object.values(STARTER_TEMPLATES).forEach((h) => { ALL_HERO_MAP[h.id] = h; });
  SHOP_HEROES.forEach((h) => { ALL_HERO_MAP[h.id] = h; });

  // === 27 Shop Relics (12 Core + 5 Discard + 5 Shield + 5 Poison) ===
  const RELICS = [
    // --- 12 Core Universal Relics ---
    {
      id: 'r_spend_scale', theme: 'core', tier: 'B', cat: 'scale', cost: 4,
      name: '通用 B · 消费加攻', short: '花5G+12攻',
      icon: 'icon-d7fb4a7519b997571b4ff455', vfx: 'fxBuffSimpleGold',
      desc: '商店每花 5G，每次出手永久 +12 攻击。',
      initState: () => ({ spentAcc: 0, bonusAtk: 0 })
    },
    {
      id: 'r_retrig_scale', theme: 'core', tier: 'S', cat: 'scale', cost: 6,
      name: '通用 S · 重触发成长', short: '再动+0.08×',
      icon: 'icon-20f207666182d15e5dafa811', vfx: 'fx_f2_twilightreiki',
      desc: '每次触发【再动/补刀】，全队永久 +0.08× 伤害倍率。',
      initState: () => ({ bonusMult: 0 })
    },
    {
      id: 'r_wave_scale', theme: 'core', tier: 'A', cat: 'scale', cost: 5,
      name: '通用 A · 每波增倍', short: '每波+0.25×',
      icon: 'icon-869de204d8fbc7464e607644', vfx: 'fx_f1_holyimmolation',
      desc: '每通过 1 波，全队伤害倍率永久 +0.25×（初始 ×1.25）。',
      initState: () => ({ bonusMult: 0.25 })
    },
    {
      id: 'r_first_encore', theme: 'core', tier: 'S', cat: 'retrig', cost: 6,
      name: '通用 S · 1号位再动', short: '1号位+1动',
      icon: 'icon-c4f8e5f2138f76ed2cd8b08a', vfx: 'fx_slashfrenzy',
      desc: '1 号位队员每手额外再出手 1 次。'
    },
    {
      id: 'r_loop_ring', theme: 'core', tier: 'SSS', cat: 'rule', cost: 7,
      name: '通用 SSS · 3号回1号', short: '3号回1号',
      icon: 'icon-ef0dad030257d6d8ae167153', vfx: 'fx_f2_heavenseclipse',
      desc: '3 号位出手后，1 号位再出手 1 次（每手限 1 次）。'
    },
    {
      id: 'r_ghost_invite', theme: 'core', tier: 'S', cat: 'rule', cost: 6,
      name: '通用 S · 弃牌补打', short: '弃牌补打', isBridge: true,
      icon: 'icon-585d48d205e145d530bfa722', vfx: 'fx_f2_teleportsmoke',
      desc: '每回合首个被换牌弃掉的队员，本手结束后免费追打 1 次。'
    },
    {
      id: 'r_copy_right', theme: 'core', tier: 'SSS', cat: 'rule', cost: 7,
      name: '通用 SSS · 复制右侧', short: '复制右侧',
      icon: 'icon-f4767c4065ec5a27484f02e6', vfx: 'fx_f2_teleportsmoke',
      desc: '复制右侧相邻秘宝的增伤与倍率效果。',
      isCopyRight: true
    },
    {
      id: 'r_gold_chip', theme: 'core', tier: 'B', cat: 'econ', cost: 4,
      name: '通用 B · 持币加攻', short: '每G+4攻(限100)',
      icon: 'icon-8fe3811fcb33e8c9981eb990', vfx: 'fxBuffSimpleGold',
      desc: '每持有 1G，每次攻击 +4 攻击（上限 +100）。'
    },
    {
      id: 'r_empty_bounty', theme: 'core', tier: 'A', cat: 'econ', cost: 5,
      name: '通用 A · 空位赏金', short: '空位+2G×1.35',
      icon: 'icon-0685b892212ffb8a15890e08', vfx: 'fxBuffSimpleGold',
      desc: '本手每空 1 个出战位，出手后 +2G 且全队伤害 ×1.35。'
    },
    {
      id: 'r_combo_mult', theme: 'core', tier: 'A', cat: 'mult', cost: 5,
      name: '通用 A · 5段后×2.0', short: '5段后×2.0',
      icon: 'icon-630102b7729df69f550f894b', vfx: 'fx_f1_decimate',
      desc: '本手第 5 次及之后的出手，伤害 ×2.0。'
    },
    {
      id: 'r_vuln_mult', theme: 'core', tier: 'A', cat: 'mult', cost: 5,
      name: '通用 A · 易伤×1.8', short: '易伤×1.8',
      icon: 'icon-2b424f37a740631cf0edce16', vfx: 'fx_f4_doom',
      desc: 'Boss 处于【易伤】或【眩晕】时，全队伤害 ×1.8。'
    },
    {
      id: 'r_finisher_mask', theme: 'core', tier: 'S', cat: 'mult', cost: 6,
      name: '通用 S · 3号位×2.2', short: '3号位×2.2',
      icon: 'icon-986e4d34be4a385a6ee3b4b6', vfx: 'fxExplosionBigWhiteHot',
      desc: '3 号位队员出手时，伤害 ×2.2。'
    },

    // --- 5 Discard-Knife Theme Relics ---
    {
      id: 'r_disc_extra', theme: 'discard', tier: 'B', cat: 'rule', cost: 4,
      name: '换牌 B · 换牌+2次', short: '换牌+2次',
      icon: 'icon-0fb84a38631da949be569ce5', vfx: 'fx_f2_teleportsmoke',
      desc: '每波换牌次数上限 +2。'
    },
    {
      id: 'r_disc_scale', theme: 'discard', tier: 'A', cat: 'scale', cost: 5,
      name: '换牌 A · 弃牌加攻', short: '每弃+10攻',
      icon: 'icon-087055c7861fe605a3ef8e73', vfx: 'fxImpactBigOrange',
      desc: '换牌每弃掉 1 张牌，每次出手与飞刀永久 +10 攻击。',
      initState: () => ({ bonusAtk: 0 })
    },
    {
      id: 'r_disc_vuln', theme: 'discard', tier: 'A', cat: 'rule', cost: 5,
      name: '换牌 A · 换牌破甲', short: '换牌易伤', isBridge: true,
      icon: 'icon-454ae99b6edbe3ab5e7f1a4c', vfx: 'fx_fireslash',
      desc: '每次换牌给 Boss 挂【易伤】；本回合每弃 1 张，1 号位伤害 +25%。'
    },
    {
      id: 'r_disc_double', theme: 'discard', tier: 'SSS', cat: 'retrig', cost: 7,
      name: '换牌 SSS · 弃牌再触发', short: '弃牌×2次',
      icon: 'icon-07e4557e022e78a2dde68434', vfx: 'fx_crossslash',
      desc: '所有换牌弃牌触发的效果，额外再触发 1 次。'
    },
    {
      id: 'r_disc_mult', theme: 'discard', tier: 'S', cat: 'mult', cost: 6,
      name: '换牌 S · 换牌后×1.85', short: '换牌×1.85',
      icon: 'icon-968b90f1c0f9a182b5f103f8', vfx: 'fx_f4_shadownova',
      desc: '本回合换过牌时，全队本次伤害 ×1.85。'
    },

    // --- 5 Shield-Counter Theme Relics ---
    {
      id: 'r_shd_keep', theme: 'shield', tier: 'A', cat: 'rule', cost: 5,
      name: '盾反 A · 留盾60%', short: '留盾60%',
      icon: 'icon-01cd7f904e07647a3ea00e54', vfx: 'fxDistortionHexShield',
      desc: '回合结束时，剩余护盾保留 60% 到下回合。'
    },
    {
      id: 'r_shd_crown', theme: 'shield', tier: 'SSS', cat: 'rule', cost: 7,
      name: '盾反 SSS · 荆棘盾击', short: '盾击', isBridge: true,
      icon: 'icon-5b259d77f8eb2a13a3e620fb', vfx: 'fx_f3_cataclysmicfault',
      desc: '回合初无盾则 +12 护盾；有盾时，每次出手或换牌追加等于当前护盾值的伤害。'
    },
    {
      id: 'r_shd_scale', theme: 'shield', tier: 'B', cat: 'scale', cost: 4,
      name: '盾反 B · 获盾加攻', short: '获盾+4攻',
      icon: 'icon-a0b7aea084dc9ed413b1abd6', vfx: 'fxBuffSimpleGold',
      desc: '战斗中每次获得护盾，全队出手永久 +4 攻击。',
      initState: () => ({ bonusAtk: 0 })
    },
    {
      id: 'r_shd_revenge', theme: 'shield', tier: 'S', cat: 'rule', cost: 6,
      name: '盾反 S · 受击×4反震', short: '受击×4反震',
      icon: 'icon-65d2a30cf05526f44e8a96c1', vfx: 'fxExplosionBigBall_MetalSlug',
      desc: 'Boss 攻击我方时，将本次总伤害（含护盾抵挡）×4 反弹给 Boss。'
    },
    {
      id: 'r_shd_mult', theme: 'shield', tier: 'S', cat: 'mult', cost: 6,
      name: '盾反 S · 40盾×2.0', short: '40盾×2.0',
      icon: 'icon-2780f621fa193b285c5582db', vfx: 'fx_f1_holyimmolation',
      desc: '小队当前护盾 ≥40 时，全队伤害 ×2.0。'
    },

    // --- 5 Poison-Alchemy Theme Relics ---
    {
      id: 'r_poi_furnace', theme: 'poison', tier: 'SSS', cat: 'econ', cost: 7,
      name: '剧毒 SSS · 毒伤炼金', short: '毒产金养牌', isBridge: true, requiresSource: 'poison',
      icon: 'icon-130319687a750ebf796effdf', vfx: 'fx_flamesphere',
      desc: '回合末剧毒每扣 80 血，+1G 且手牌永久 +5 攻。'
    },
    {
      id: 'r_poi_keep', theme: 'poison', tier: 'S', cat: 'rule', cost: 6,
      name: '剧毒 S · 毒不衰减', short: '毒不衰减', requiresSource: 'poison',
      icon: 'icon-16f0f826e0e3c127a6048f4f', vfx: 'fxImpactGreenBig',
      desc: '回合末【剧毒】扣血后层数不再衰减。'
    },
    {
      id: 'r_poi_scale', theme: 'poison', tier: 'B', cat: 'scale', cost: 4,
      name: '剧毒 B · 单层毒伤+1', short: '单层毒+1', requiresSource: 'poison',
      icon: 'icon-f6b708bf78dd83f0fde50df3', vfx: 'fxImpactGreenBig',
      desc: '每施加 1 次【剧毒】，每层毒伤永久 +1（基础 10/层）。',
      initState: () => ({ poisonPerStackBonus: 0 })
    },
    {
      id: 'r_poi_spread', theme: 'poison', tier: 'A', cat: 'rule', cost: 5,
      name: '剧毒 A · 命中+4毒', short: '命中+4毒', isBridge: true, requiresSource: 'poison',
      icon: 'icon-d5a1e331f520b2358d8639e9', vfx: 'fx_f4_voidpulse',
      desc: '任意队员命中中毒 Boss 时，额外 +4 层【剧毒】。'
    },
    {
      id: 'r_poi_mult', theme: 'poison', tier: 'S', cat: 'mult', cost: 6,
      name: '剧毒 S · 15毒×1.9', short: '15毒×1.9', requiresSource: 'poison',
      icon: 'icon-2f4c06bd94dbd4cff67c8997', vfx: 'fx_f4_doom',
      desc: 'Boss【剧毒】≥15 层时，所有直伤与毒爆伤害 ×1.9。'
    },

    // --- 5 Frost Theme Relics ---
    {
      id: 'r_frz_scale', theme: 'frost', tier: 'B', cat: 'scale', cost: 4,
      name: '极寒 B · 叠冰加攻', short: '叠冰+6攻', requiresSource: 'frost',
      icon: 'icon-c859b77ca06b34684765a733', vfx: 'fxImpactBlueBig',
      desc: '每给 Boss 施加 1 次【冰霜】，全队出手永久 +6 攻击。',
      initState: () => ({ bonusAtk: 0 })
    },
    {
      id: 'r_frz_keep', theme: 'frost', tier: 'A', cat: 'rule', cost: 5,
      name: '极寒 A · 冰霜永驻', short: '留冰50%', requiresSource: 'frost',
      icon: 'icon-a0b7aea084dc9ed413b1abd6', vfx: 'fxFrozenIceBlock',
      desc: '回合末 Boss 的【冰霜】不再清空，保留 50% 到下回合。'
    },
    {
      id: 'r_frz_retrig', theme: 'frost', tier: 'S', cat: 'rule', cost: 6,
      name: '极寒 S · 寒气共振', short: '再动叠冰', isBridge: true, requiresSource: 'frost',
      icon: 'icon-8fcb2f113aa91ce213cb7015', vfx: 'fx_f6_cryogenesis',
      desc: 'Boss 有 ≥6 层冰霜时，每次再动/补刀额外 +2 冰霜且伤害 ×1.35。'
    },
    {
      id: 'r_frz_mult', theme: 'frost', tier: 'S', cat: 'mult', cost: 6,
      name: '极寒 S · 碎冰×2.0', short: '8冰×2.0', requiresSource: 'frost',
      icon: 'icon-16f0f826e0e3c127a6048f4f', vfx: 'fx_f6_winterswake',
      desc: 'Boss【冰霜】≥8 层或已冻结时，全队伤害 ×2.0。'
    },
    {
      id: 'r_frz_nova', theme: 'frost', tier: 'SSS', cat: 'rule', cost: 7,
      name: '极寒 SSS · 极冬新星', short: '冻结12%真伤', requiresSource: 'frost',
      icon: 'icon-0ad5146b7e8c79631e4322e4', vfx: 'fxExplosionMediumIcyWhite',
      desc: 'Boss 叠满 10 层冻结时，立刻造成其最大血量 12% 的真伤（每波限 1 次）。'
    },

    // --- 5 Hand-Steel Theme Relics ---
    {
      id: 'r_hnd_scale', theme: 'hand', tier: 'B', cat: 'scale', cost: 4,
      name: '留手 B · 留手成长', short: '每留+4攻',
      icon: 'icon-0685b892212ffb8a15890e08', vfx: 'fxBuffSimpleGold',
      desc: '回合结束时，每剩 1 张手牌，全队出手永久 +4 攻击。',
      initState: () => ({ bonusAtk: 0 })
    },
    {
      id: 'r_hnd_steel', theme: 'hand', tier: 'A', cat: 'mult', cost: 5,
      name: '留手 A · 全员钢牌', short: '每留+15%伤',
      icon: 'icon-01cd7f904e07647a3ea00e54', vfx: 'fxBuffSimpleGold',
      desc: '本手每留 1 张未出战手牌，全队伤害 +15%。'
    },
    {
      id: 'r_hnd_bridge', theme: 'hand', tier: 'S', cat: 'rule', cost: 6,
      name: '留手 S · 手牌共享', short: '最左攻→1号', isBridge: true,
      icon: 'icon-a25e63a0ce8d432d9024b951', vfx: 'fx_f1_holyimmolation',
      desc: '未出战手牌最左侧队员的 50% 攻击，叠加到 1 号位每次出手上。'
    },
    {
      id: 'r_hnd_grow', theme: 'hand', tier: 'S', cat: 'scale', cost: 6,
      name: '留手 S · 温酒养锋', short: '留手全员+10攻',
      icon: 'icon-8fe3811fcb33e8c9981eb990', vfx: 'fxBuffSimpleGold',
      desc: '回合结束时，所有未出战手牌永久 +10 攻击。'
    },
    {
      id: 'r_hnd_mult', theme: 'hand', tier: 'SSS', cat: 'mult', cost: 7,
      name: '留手 SSS · 满手×2.4', short: '留≥4张×2.4',
      icon: 'icon-08578cf104b6ec7d82c8fd04', vfx: 'fxExplosionBigWhiteHot',
      desc: '本手留有 ≥4 张手牌（仅派 1~2 人）时，全队伤害 ×2.4。'
    },

    // --- 5 Sacrifice-Summon Theme Relics ---
    {
      id: 'r_sac_scale', theme: 'summon', tier: 'B', cat: 'scale', cost: 4,
      name: '献祭 B · 祭品加攻', short: '每祭+25攻',
      icon: 'icon-1dde93f80d94cb80d0861041', vfx: 'fx_f4_shadownova',
      desc: '每有 1 名队员被吞噬或退场，全队出手永久 +25 攻击。',
      initState: () => ({ bonusAtk: 0 })
    },
    {
      id: 'r_sac_gold', theme: 'summon', tier: 'A', cat: 'econ', cost: 5,
      name: '献祭 A · 血契产金', short: '退场+4G+20盾',
      icon: 'icon-d7fb4a7519b997571b4ff455', vfx: 'fxBuffSimpleGold',
      desc: '每有队员被吞噬或退场，立刻 +4G 且 +20 护盾。'
    },
    {
      id: 'r_sac_bridge', theme: 'summon', tier: 'S', cat: 'rule', cost: 6,
      name: '献祭 S · 替身秘偶', short: '首退不消失', isBridge: true,
      icon: 'icon-f4767c4065ec5a27484f02e6', vfx: 'fx_f2_teleportsmoke',
      desc: '每波首个被吞噬或玻璃刃退场的队员，触发遗言后回到弃牌堆。'
    },
    {
      id: 'r_sac_mult', theme: 'summon', tier: 'S', cat: 'mult', cost: 6,
      name: '献祭 S · 献祭×2.2', short: '退场/召灵×2.2',
      icon: 'icon-2b424f37a740631cf0edce16', vfx: 'fx_f4_doom',
      desc: '本波发生过队员退场或空位召灵后，全队伤害 ×2.2。'
    },
    {
      id: 'r_sac_encore', theme: 'summon', tier: 'SSS', cat: 'retrig', cost: 7,
      name: '献祭 SSS · 亡魂再动', short: '退场3号再动',
      icon: 'icon-ff9404191bfa84cb0d671b55', vfx: 'fx_f2_heavenseclipse',
      desc: '本手有队员被吞噬退场时，3 号位额外再出手 1 次。'
    },

    // --- 5 Blood-Burn Theme Relics ---
    {
      id: 'r_bld_scale', theme: 'blood', tier: 'B', cat: 'scale', cost: 4,
      name: '燃血 B · 痛觉成长', short: '掉血+8攻',
      icon: 'icon-1dde93f80d94cb80d0861041', vfx: 'fxImpactBigOrange',
      desc: '战斗中每次掉血（含自扣与挨打），全队出手永久 +8 攻击。',
      initState: () => ({ bonusAtk: 0 })
    },
    {
      id: 'r_bld_heal', theme: 'blood', tier: 'A', cat: 'econ', cost: 5,
      name: '燃血 A · 血瓶续命', short: '4段回6血',
      icon: 'icon-8fe3811fcb33e8c9981eb990', vfx: 'fxBuffSimpleGold',
      desc: '每第 4 次出手回复 6 血；血量 ≤50% 过波额外 +4G。'
    },
    {
      id: 'r_bld_bridge', theme: 'blood', tier: 'S', cat: 'retrig', cost: 6,
      name: '燃血 S · 血怒重击', short: '残血1号再动', isBridge: true,
      icon: 'icon-c4f8e5f2138f76ed2cd8b08a', vfx: 'fx_slashfrenzy',
      desc: '小队血量 ≤55% 时，1 号位每手额外再出手 1 次。'
    },
    {
      id: 'r_bld_mult', theme: 'blood', tier: 'S', cat: 'mult', cost: 6,
      name: '燃血 S · 背水×2.3', short: '半血×2.3',
      icon: 'icon-986e4d34be4a385a6ee3b4b6', vfx: 'fx_f2_heavenseclipse',
      desc: '小队血量 ≤50% 时，全队伤害 ×2.3。'
    },
    {
      id: 'r_bld_immortal', theme: 'blood', tier: 'SSS', cat: 'rule', cost: 7,
      name: '燃血 SSS · 不灭血契', short: '免死锁1血×3',
      icon: 'icon-ef0dad030257d6d8ae167153', vfx: 'fx_f1_holyimmolation',
      desc: '每波首次受致命伤锁血 1 HP，触发后本波全队伤害 ×3.0。'
    },

    // --- 5 Gamble-Dice Theme Relics ---
    {
      id: 'r_dic_lucky', theme: 'dice', tier: 'B', cat: 'rule', cost: 4,
      name: '赌博 B · 灌铅骰子', short: '正面率→75%',
      icon: 'icon-0fb84a38631da949be569ce5', vfx: 'fxBuffSimpleGold',
      desc: '所有赌博判定的正面/高点概率从 50% 提升至 75%。'
    },
    {
      id: 'r_dic_scale', theme: 'dice', tier: 'A', cat: 'scale', cost: 5,
      name: '赌博 A · 庄家抽水', short: '每赌+10攻',
      icon: 'icon-d7fb4a7519b997571b4ff455', vfx: 'fxBuffSimpleGold',
      desc: '每次触发赌博判定（无论正反），全队出手永久 +10 攻击。',
      initState: () => ({ bonusAtk: 0 })
    },
    {
      id: 'r_dic_bridge', theme: 'dice', tier: 'S', cat: 'econ', cost: 6,
      name: '赌博 S · 幸运连弹', short: '正面+2G养牌', isBridge: true,
      icon: 'icon-20f207666182d15e5dafa811', vfx: 'fxBuffSimpleGold',
      desc: '赌博判定为正面/高点时，+2G 并随机让 1 张手牌永久 +15 攻击。'
    },
    {
      id: 'r_dic_mult', theme: 'dice', tier: 'S', cat: 'mult', cost: 6,
      name: '赌博 S · 豪赌×2.5', short: '50%暴×2.5',
      icon: 'icon-968b90f1c0f9a182b5f103f8', vfx: 'fxExplosionBigWhiteHot',
      desc: '每次出手有 50% 概率伤害 ×2.5（带【灌铅骰子】时为 75%）。'
    },
    {
      id: 'r_dic_jackpot', theme: 'dice', tier: 'SSS', cat: 'mult', cost: 7,
      name: '赌博 SSS · 头奖狂潮', short: '2正面爆金×2.2',
      icon: 'icon-08578cf104b6ec7d82c8fd04', vfx: 'fx_f1_holyimmolation',
      desc: '本波累计 2 次赌博正面时，+6G 且本波后续伤害 ×2.2。'
    }
  ];

  // === 6 Tavern Inscriptions (Alchemy / Enhancements) ===
  const INSCRIPTIONS = [
    { id: 'm_red_seal', name: '铭文 S · 双连印', icon: 'icon-c4f8e5f2138f76ed2cd8b08a', color: '#ff5c72', needsHero: true,
      desc: '赋予 1 名队员【双连印】：每次出战自动出手 2 次。' },
    { id: 'm_glass',    name: '铭文 S · 玻璃刃', icon: 'icon-c859b77ca06b34684765a733', color: '#7be8ff', needsHero: true,
      desc: '赋予 1 名队员【玻璃刃】：伤害 ×2.0，出手后本波退场。' },
    { id: 'm_greed',    name: '铭文 A · 贪财徽', icon: 'icon-d7fb4a7519b997571b4ff455', color: '#ffd966', needsHero: true,
      desc: '赋予 1 名队员【贪财徽】：每次出手额外 +2G。' },
    { id: 'm_iron',     name: '铭文 A · 铁壁甲', icon: 'icon-01cd7f904e07647a3ea00e54', color: '#78b7ff', needsHero: true,
      desc: '赋予 1 名队员【铁壁甲】：每次出手额外 +18 护盾。' },
    { id: 'm_clone',    name: '铭文 SSS · 镜像克隆', icon: 'icon-f4767c4065ec5a27484f02e6', color: '#e288ff', needsHero: true,
      desc: '完整复制 1 名队员（保留铭文与全部成长）加入牌组。' },
    { id: 'm_banish',   name: '铭文 B · 驱逐', icon: 'icon-f2c70661b51894b44fd1664b', color: '#ffb84d', needsHero: true, minRoster: 4,
      desc: '永久移除 1 名队员（牌组至少保留 4 人）。' }
  ];

  // === 4 Slot Upgrades (Replaces Poker Hand Level-Ups!) ===
  const SLOT_UPGRADES = [
    { id: 'slot1', name: '1号位 · 先锋', cost: 4, color: '#78b7ff', short: '升级 +15攻 +12盾',
      desc: '每升 1 级：1 号位出手 +15 攻击、+12 护盾。' },
    { id: 'slot2', name: '2号位 · 中军', cost: 4, color: '#ffd966', short: '升级 +28攻',
      desc: '每升 1 级：2 号位出手 +28 攻击。' },
    { id: 'slot3', name: '3号位 · 压轴', cost: 4, color: '#ff7b6b', short: '升级 +0.25×伤',
      desc: '每升 1 级：3 号位出手 +0.25× 伤害倍率。' },
    { id: 'hand',  name: '手牌区 · 待命', cost: 4, color: '#7ef28a', short: '升级 留手+6攻',
      desc: '每升 1 级：回合结束时留在手牌的队员永久 +6 攻击。' }
  ];

  const PACKS = [
    {
      id: 'pack_hero', name: '稀客招募包', subtitle: '4选1 招募队员', cost: 4, count: 4,
      icon: 'icon-c73309688fafee8ff6bcb5cd', accent: '#6be5ff', glow: '#369cff', burstVfx: 'fx_f6_winterswake',
      desc: '4 选 1 招募队员加入牌组（概率自带随机铭文）。'
    },
    {
      id: 'pack_inscription', name: '铭文匣', subtitle: '3选1 强化铭文', cost: 4, count: 3,
      icon: 'icon-0d75e9fcb8c79b6b313ec227', accent: '#df7dff', glow: '#a93dff', burstVfx: 'fx_f4_shadownova',
      desc: '3 选 1 铭文强化队员：双连印、玻璃刃、贪财徽、铁壁甲、克隆或驱逐。'
    }
  ];

  // === 8 Recalibrated Active Mirror-Lake Bosses (GPT Fix #1) ===
  const BOSS_POOL = [
    { id: 'b_antiswarm',  unitId: 'boss_antiswarm',       name: '噬群巨魔',   title: '先锋',     trait: '高伤重击',          vfx: 'pfx_acid_splash',     pattern: ['heavy', 'charge', 'heavy', 'heavy'] },
    { id: 'b_decepticle', unitId: 'boss_decepticle',      name: '幻影构装',   title: '机械卫兵', trait: '护盾防御',          vfx: 'pfx_zap_hit',         pattern: ['shield', 'charge', 'heavy', 'shield'] },
    { id: 'b_solfist',    unitId: 'boss_solfist',         name: '烈阳铁拳',   title: '熔火守门', trait: '受击反伤',          vfx: 'pfx_flame_pillar',    pattern: ['heavy', 'charge', 'thorns', 'heavy'] },
    { id: 'b_vampire',    unitId: 'boss_vampire',         name: '猩红伯爵',   title: '血月领主', trait: '封锁 3 号位',       vfx: 'pfx_blood_claws',     pattern: ['charge', 'heavy', 'lock3', 'heavy'] },
    { id: 'b_boreal',     unitId: 'boss_borealjuggernaut',name: '极北冰巨兽', title: '永冬霸主', trait: '护盾 · 封锁 3 号位', vfx: 'pfx_ice_spikes',      pattern: ['lock3', 'charge', 'shield', 'heavy'] },
    { id: 'b_cindera',    unitId: 'boss_cindera',         name: '灰烬女皇',   title: '焚城妖姬', trait: '猛攻 · 受击反伤',   vfx: 'pfx_heavy_cleave',    pattern: ['thorns', 'charge', 'heavy', 'heavy'] },
    { id: 'b_chaosknight',unitId: 'boss_chaosknight',     name: '混沌黑骑',   title: '裂隙统帅', trait: '护盾 · 封锁 3 号位', vfx: 'pfx_shadow_tendrils', pattern: ['shield', 'charge', 'lock3', 'heavy'] },
    { id: 'b_skyfall',    unitId: 'boss_skyfalltyrant',   name: '天陨暴君',   title: '终末之影', trait: '反伤 · 封锁 3 号位', vfx: 'pfx_dark_explosion',  pattern: ['charge', 'thorns', 'lock3', 'heavy'] }
  ];

  // Calibrated Wave Curve (Smooth W1-W2 onboarding; steep W4-W8 pressure for ~20-30% zero-ad clear rate!)
  const WAVE_CONFIG = [
    { wave: 1, hp: 520,   heavyDmg: 34, ultDmg: 48, baseReward: 7,  bossIdx: 0 },
    { wave: 2, hp: 960,   heavyDmg: 36, ultDmg: 51, baseReward: 8,  bossIdx: 1 },
    { wave: 3, hp: 1950,  heavyDmg: 39, ultDmg: 54, baseReward: 9,  bossIdx: 2 },
    { wave: 4, hp: 3700,  heavyDmg: 42, ultDmg: 57, baseReward: 10, bossIdx: 3 },
    { wave: 5, hp: 6600,  heavyDmg: 46, ultDmg: 60, baseReward: 11, bossIdx: 4 },
    { wave: 6, hp: 11500, heavyDmg: 50, ultDmg: 63, baseReward: 12, bossIdx: 5 },
    { wave: 7, hp: 19500, heavyDmg: 54, ultDmg: 66, baseReward: 13, bossIdx: 6 },
    { wave: 8, hp: 31000, heavyDmg: 58, ultDmg: 69, baseReward: 16, bossIdx: 7 }
  ];

  function getWaveBoss(wave) {
    const idx = Math.min(WAVE_CONFIG.length - 1, Math.max(0, wave - 1));
    const cfg = WAVE_CONFIG[idx];
    const extraScale = wave > 8 ? Math.pow(1.62, wave - 8) : 1;
    const tpl = BOSS_POOL[cfg.bossIdx];
    const maxHp = Math.round(cfg.hp * extraScale);
    return {
      ...tpl,
      wave,
      maxHp,
      heavyDmg: cfg.heavyDmg,
      ultDmg: cfg.ultDmg,
      breakThreshold: Math.round(maxHp * 0.28),
      shieldGain: Math.round(maxHp * 0.20),
      reward: cfg.baseReward + (wave > 8 ? 2 : 0)
    };
  }

  let _uidSeq = 1;
  function makeHeroInstance(tplIdOrObj, overrides = {}) {
    const tpl = typeof tplIdOrObj === 'string' ? ALL_HERO_MAP[tplIdOrObj] : tplIdOrObj;
    const baseAtk = tpl.atk || 0;
    return {
      ...tpl,
      uid: 'u14_' + (_uidSeq++) + '_' + Math.random().toString(36).slice(2, 6),
      tplId: tpl.id,
      baseAtk,
      atk: baseAtk + (overrides.bonusAtk || 0),
      shieldVal: overrides.shieldVal !== undefined ? overrides.shieldVal : (tpl.shieldVal || 0),
      baseShieldVal: tpl.shieldVal || 0,
      knifeCount: overrides.knifeCount !== undefined ? overrides.knifeCount : (tpl.knifeCount || 0),
      baseKnifeCount: tpl.knifeCount || 0,
      applyPoison: overrides.applyPoison !== undefined ? overrides.applyPoison : (tpl.applyPoison || 0),
      baseApplyPoison: tpl.applyPoison || 0,
      redSeal: Boolean(overrides.redSeal),
      glassBlade: Boolean(overrides.glassBlade),
      greedBadge: Boolean(overrides.greedBadge),
      ironPlated: Boolean(overrides.ironPlated),
      spendAcc: 0
    };
  }

  function cloneHeroInstance(src) {
    return makeHeroInstance(src.tplId, {
      bonusAtk: src.atk - src.baseAtk,
      shieldVal: src.shieldVal,
      knifeCount: src.knifeCount,
      applyPoison: src.applyPoison,
      redSeal: src.redSeal,
      glassBlade: src.glassBlade,
      greedBadge: src.greedBadge,
      ironPlated: src.ironPlated
    });
  }

  function makeRelicInstance(tpl) {
    return {
      ...tpl,
      uid: 'r14_' + (_uidSeq++) + '_' + Math.random().toString(36).slice(2, 6),
      state: tpl.initState ? tpl.initState() : {}
    };
  }

  function createStarterRoster() {
    const ids = [
      'st_blade', 'st_blade', 'st_blade',
      'st_guard', 'st_guard',
      'st_scout',
      'st_drummer',
      'st_waiter'
    ];
    return ids.map((id) => makeHeroInstance(id));
  }

  function weightedPick(pool, count, excludeIds = new Set()) {
    const avail = pool.filter((item) => !excludeIds.has(item.id));
    const picked = [];
    const used = new Set();
    while (picked.length < count && used.size < avail.length) {
      const rem = avail.filter((x) => !used.has(x.id));
      const totalW = rem.reduce((s, x) => s + ((TIERS[x.tier] && TIERS[x.tier].weight) || 20), 0);
      let r = Math.random() * totalW;
      let chosen = rem[0];
      for (const item of rem) {
        r -= ((TIERS[item.tier] && TIERS[item.tier].weight) || 20);
        if (r <= 0) { chosen = item; break; }
      }
      used.add(chosen.id);
      picked.push(chosen);
    }
    return picked;
  }

  function getActiveShopHeroes(activeThemes = ['discard', 'shield', 'poison']) {
    const allowed = new Set(['core', ...activeThemes]);
    return SHOP_HEROES.filter((h) => allowed.has(h.theme));
  }

  function getActiveRelics(activeThemes = ['discard', 'shield', 'poison']) {
    const allowed = new Set(['core', ...activeThemes]);
    return RELICS.filter((r) => allowed.has(r.theme));
  }

  window.MT.V14_DATA = {
    THEMES,
    TIERS,
    ACTIVE_THEMES: ['discard', 'shield', 'poison'],
    STARTER_TEMPLATES,
    SHOP_HEROES,
    ALL_HERO_MAP,
    RELICS,
    INSCRIPTIONS,
    SLOT_UPGRADES,
    PACKS,
    BOSS_POOL,
    WAVE_CONFIG,
    SQUAD_MAX_HP: 100,
    MAX_ROUNDS: 4,            // 速胜基准：4 回合内击杀拿速胜金；第 4 回合后不再判负
    BERSERK_MULT: 1.5,        // 第 5 回合起「日蚀狂暴」：Boss 重击固定 ×1.5
    HARD_ROUND_CAP: 10,       // 安全上限，仅防极端堆盾卡死，正常不应触发
    WAVE_CLEAR_HEAL_PCT: 0.30,// 血条跨波继承：过波回复最大血量 30%
    REVIVE_HP_PCT: 0.50,      // 广告复活时血量回到 50%
    BASE_DISCARDS: 2,
    HAND_SIZE: 6,
    BASE_POISON_PER_STACK: 10,
    getWaveBoss,
    makeHeroInstance,
    cloneHeroInstance,
    makeRelicInstance,
    createStarterRoster,
    weightedPick,
    getActiveShopHeroes,
    getActiveRelics
  };
})();
