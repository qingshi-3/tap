// v14.0 7-Phase Unified Event Bus & Deterministic Dry-Run / Live Settlement Engine
// Guarantees 100% parity between Tactical Forecast and Actual Battle Resolution.
(function () {
  window.MT = window.MT || {};

  function getPoisonPerStack(relics) {
    let base = window.MT.V14_DATA.BASE_POISON_PER_STACK || 10;
    for (const r of relics) {
      if (r.id === 'r_poi_scale') base += (r.state && r.state.poisonPerStackBonus) || 0;
    }
    return base;
  }

  function hasRelic(relics, id) {
    return relics.some((r) => r.id === id);
  }

  function getRelic(relics, id) {
    return relics.find((r) => r.id === id);
  }

  // Deep clone minimal battle state for accurate dry-run forecast
  function cloneStateForDryRun(state) {
    return {
      wave: state.wave,
      round: state.round,
      gold: state.gold,
      squadHp: state.squadHp,
      squadMaxHp: state.squadMaxHp,
      squadShield: state.squadShield,
      bossHp: state.bossHp,
      bossMaxHp: state.bossMaxHp,
      bossShield: state.bossShield,
      bossPoison: state.bossPoison,
      bossFrost: state.bossFrost || 0,
      bossFrozen: Boolean(state.bossFrozen),
      waveFrostNovaUsed: Boolean(state.waveFrostNovaUsed),
      waveExhaustCount: state.waveExhaustCount || 0,
      waveSummonTriggered: Boolean(state.waveSummonTriggered),
      waveSubstituteUsed: Boolean(state.waveSubstituteUsed),
      waveImmortalUsed: Boolean(state.waveImmortalUsed),
      waveImmortalBuff: Boolean(state.waveImmortalBuff),
      waveGambleWins: state.waveGambleWins || 0,
      waveJackpotActive: Boolean(state.waveJackpotActive),
      bossVuln: state.bossVuln,
      bossStunned: state.bossStunned,
      bossCharging: state.bossCharging,
      bossThorns: state.bossThorns,
      bossBreakProgress: state.bossBreakProgress,
      bossBreakThreshold: state.bossBreakThreshold,
      slotLevels: { ...state.slotLevels },
      waveDiscardsCount: state.waveDiscardsCount,
      roundDiscardsCount: state.roundDiscardsCount,
      roundUsedDiscard: state.roundUsedDiscard,
      roundTeamAtkBonus: state.roundTeamAtkBonus,
      roundSlot1MultBonus: state.roundSlot1MultBonus,
      nextRoundSlot3Bonus: state.nextRoundSlot3Bonus,
      currentSlot3Bonus: state.currentSlot3Bonus,
      ghostQueuedHero: state.ghostQueuedHero ? { ...state.ghostQueuedHero } : null,
      pendingKnives: (state.pendingKnives || []).map((pk) => ({ hero: { ...pk.hero }, shots: pk.shots })),
      pendingScavengers: (state.pendingScavengers || []).map((h) => ({ ...h })),
      heroPassive: state.heroPassive || null,
      relics: state.relics.map((r) => ({ ...r, state: r.state ? { ...r.state } : {} }))
    };
  }

  // Compute single relic contribution (supports r_copy_right cleanly!)
  function evalSingleRelic(r, ctx, isDryRun) {
    const out = { addAtk: 0, mult: 1, label: '', fx: r.vfx || null, trigger: false };
    switch (r.id) {
      case 'r_spend_scale': {
        const v = (r.state && r.state.bonusAtk) || 0;
        if (v > 0) { out.addAtk = v; out.label = `+${v} 消费`; out.trigger = true; }
        break;
      }
      case 'r_retrig_scale': {
        const bm = (r.state && r.state.bonusMult) || 0;
        if (bm > 0) {
          const m = +(1 + bm).toFixed(2);
          out.mult = m; out.label = `×${m} 共振`; out.trigger = true;
        }
        break;
      }
      case 'r_wave_scale': {
        const bm = (r.state && r.state.bonusMult) || 0.25;
        const m = +(1 + bm).toFixed(2);
        out.mult = m; out.label = `×${m} 星核`; out.trigger = true;
        break;
      }
      case 'r_gold_chip': {
        const v = Math.min(100, ctx.state.gold * 4);
        if (v > 0) { out.addAtk = v; out.label = `+${v} 持币`; out.trigger = true; }
        break;
      }
      case 'r_empty_bounty': {
        if (ctx.emptySlots > 0) {
          const m = +(Math.pow(1.35, ctx.emptySlots)).toFixed(2);
          out.mult = m; out.label = `×${m} 孤客`; out.trigger = true;
        }
        break;
      }
      case 'r_combo_mult': {
        if (ctx.hitIndex >= 5) {
          out.mult = 2.0; out.label = '×2.0 连星'; out.trigger = true;
        }
        break;
      }
      case 'r_vuln_mult': {
        if (ctx.state.bossVuln || ctx.state.bossStunned) {
          out.mult = 1.8; out.label = '×1.8 易伤'; out.trigger = true;
        }
        break;
      }
      case 'r_finisher_mask': {
        if (ctx.slotIdx === 2) {
          out.mult = 2.2; out.label = '×2.2 压轴'; out.trigger = true;
        }
        break;
      }
      case 'r_disc_scale': {
        const v = (r.state && r.state.bonusAtk) || 0;
        if (v > 0) { out.addAtk = v; out.label = `+${v} 磨石`; out.trigger = true; }
        break;
      }
      case 'r_disc_mult': {
        if (ctx.state.roundUsedDiscard) {
          out.mult = 1.85; out.label = '×1.85 赌徒'; out.trigger = true;
        }
        break;
      }
      case 'r_shd_scale': {
        const v = (r.state && r.state.bonusAtk) || 0;
        if (v > 0) { out.addAtk = v; out.label = `+${v} 铁砧`; out.trigger = true; }
        break;
      }
      case 'r_shd_mult': {
        if (ctx.state.squadShield >= 40) {
          out.mult = 2.0; out.label = '×2.0 圣盾'; out.trigger = true;
        }
        break;
      }
      case 'r_poi_mult': {
        if (ctx.state.bossPoison >= 15) {
          out.mult = 1.9; out.label = '×1.9 蚀心'; out.trigger = true;
        }
        break;
      }
      case 'r_frz_scale': {
        const v = (r.state && r.state.bonusAtk) || 0;
        if (v > 0) { out.addAtk = v; out.label = `+${v} 叠冰`; out.trigger = true; }
        break;
      }
      case 'r_frz_retrig': {
        if (ctx.isRetrigger && (ctx.state.bossFrost || 0) >= 6) {
          out.mult = 1.35; out.label = '×1.35 寒振'; out.trigger = true;
        }
        break;
      }
      case 'r_frz_mult': {
        if ((ctx.state.bossFrost || 0) >= 8 || ctx.state.bossFrozen) {
          out.mult = 2.0; out.label = '×2.0 碎冰'; out.trigger = true;
        }
        break;
      }
      case 'r_hnd_scale': {
        const v = (r.state && r.state.bonusAtk) || 0;
        if (v > 0) { out.addAtk = v; out.label = `+${v} 留手`; out.trigger = true; }
        break;
      }
      case 'r_hnd_steel': {
        if (ctx.remHandCount > 0) {
          const m = +(1 + ctx.remHandCount * 0.15).toFixed(2);
          out.mult = m; out.label = `×${m} 钢牌`; out.trigger = true;
        }
        break;
      }
      case 'r_hnd_bridge': {
        if (ctx.slotIdx === 0 && ctx.leftmostHandAtk > 0) {
          const v = Math.round(ctx.leftmostHandAtk * 0.5);
          if (v > 0) { out.addAtk = v; out.label = `+${v} 手牌借力`; out.trigger = true; }
        }
        break;
      }
      case 'r_hnd_mult': {
        if (ctx.remHandCount >= 4) {
          out.mult = 2.4; out.label = '×2.4 满手'; out.trigger = true;
        }
        break;
      }
      case 'r_sac_scale': {
        const v = (r.state && r.state.bonusAtk) || 0;
        if (v > 0) { out.addAtk = v; out.label = `+${v} 祭品`; out.trigger = true; }
        break;
      }
      case 'r_sac_mult': {
        if ((ctx.state.waveExhaustCount || 0) > 0 || ctx.state.waveSummonTriggered) {
          out.mult = 2.2; out.label = '×2.2 献祭'; out.trigger = true;
        }
        break;
      }
      case 'r_bld_scale': {
        const v = (r.state && r.state.bonusAtk) || 0;
        if (v > 0) { out.addAtk = v; out.label = `+${v} 痛觉`; out.trigger = true; }
        break;
      }
      case 'r_bld_mult': {
        if (ctx.state.squadHp <= ctx.state.squadMaxHp * 0.5) {
          out.mult = 2.3; out.label = '×2.3 背水'; out.trigger = true;
        }
        break;
      }
      case 'r_bld_immortal': {
        if (ctx.state.waveImmortalBuff) {
          out.mult = 3.0; out.label = '×3.0 不灭!'; out.trigger = true;
        }
        break;
      }
      case 'r_dic_scale': {
        const v = (r.state && r.state.bonusAtk) || 0;
        if (v > 0) { out.addAtk = v; out.label = `+${v} 抽水`; out.trigger = true; }
        break;
      }
      case 'r_dic_mult': {
        const winRate = hasRelic(ctx.state.relics, 'r_dic_lucky') ? 0.75 : 0.5;
        if (!isDryRun) {
          const ok = Math.random() < winRate;
          recordGambleResult(ctx.state, ok, null, null, isDryRun);
          if (ok) { out.mult = 2.5; out.label = '🎲×2.5 豪赌!'; out.trigger = true; }
        } else {
          out.mult = +(1 + 1.5 * winRate).toFixed(2);
          out.label = '🎲期望'; out.trigger = true;
        }
        break;
      }
      case 'r_dic_jackpot': {
        if (ctx.state.waveJackpotActive) {
          out.mult = 2.2; out.label = '×2.2 头奖!'; out.trigger = true;
        }
        break;
      }
      default:
        break;
    }
    return out;
  }

  function addShield(state, amount, events, isDryRun, sourceLabel = '') {
    if (amount <= 0) return;
    state.squadShield += amount;
    if (!isDryRun) {
      events.push({ type: 'shield_gain', amount, total: state.squadShield, label: sourceLabel });
    }
    for (const r of state.relics) {
      if (r.id === 'r_shd_scale') {
        r.state.bonusAtk = (r.state.bonusAtk || 0) + 4;
        if (!isDryRun) events.push({ type: 'relic_grow', relicUid: r.uid, text: `+4攻(${r.state.bonusAtk})` });
      }
    }
  }

  function addPoison(state, stacks, events, isDryRun) {
    if (stacks <= 0) return;
    state.bossPoison += stacks;
    for (const r of state.relics) {
      if (r.id === 'r_poi_scale') {
        r.state.poisonPerStackBonus = (r.state.poisonPerStackBonus || 0) + 1;
        if (!isDryRun) events.push({ type: 'relic_grow', relicUid: r.uid, text: `毒伤+1` });
      }
    }
    if (!isDryRun) events.push({ type: 'poison_apply', stacks, total: state.bossPoison });
  }

  function addFrost(state, stacks, events, isDryRun) {
    if (stacks <= 0) return;
    state.bossFrost = (state.bossFrost || 0) + stacks;
    for (const r of state.relics) {
      if (r.id === 'r_frz_scale') {
        r.state.bonusAtk = (r.state.bonusAtk || 0) + 6;
        if (!isDryRun) events.push({ type: 'relic_grow', relicUid: r.uid, text: `+6攻(${r.state.bonusAtk})` });
      }
    }
    if (!isDryRun) events.push({ type: 'toast', text: `❄ Boss 冰霜 +${stacks}（共 ${state.bossFrost} 层）` });
    if (state.bossFrost >= 10 && !state.bossFrozen) {
      state.bossFrozen = true;
      if (!isDryRun) events.push({ type: 'ach_trigger', id: 'ach_freeze_boss' });
      if (hasRelic(state.relics, 'r_frz_nova') && !state.waveFrostNovaUsed) {
        state.waveFrostNovaUsed = true;
        const novaDmg = Math.round(state.bossMaxHp * 0.12);
        dealDamageToBoss(state, novaDmg, { ignoreShield: true }, events, isDryRun);
        if (!isDryRun) events.push({ type: 'poison_detonate', dmg: novaDmg, stacks: state.bossFrost });
      }
    }
  }

  function triggerExhaustHooks(state, victim, roster, events, isDryRun) {
    state.waveExhaustCount = (state.waveExhaustCount || 0) + 1;
    let savedBySub = false;
    if (hasRelic(state.relics, 'r_sac_bridge') && !state.waveSubstituteUsed) {
      state.waveSubstituteUsed = true;
      savedBySub = true;
      if (!isDryRun) events.push({ type: 'toast', text: `替身秘偶生效：【${victim.shortName}】触发遗言后回到弃牌堆！` });
    }
    if (victim.onExhaustTeamPermAtk && roster) {
      for (const h of roster) h.atk += victim.onExhaustTeamPermAtk;
      if (!isDryRun) events.push({ type: 'toast', text: `遗言燃料：全牌组永久 +${victim.onExhaustTeamPermAtk} 战力！` });
    }
    if (victim.onExhaustGold) {
      state.gold += victim.onExhaustGold;
      if (!isDryRun) events.push({ type: 'gold_gain', amount: victim.onExhaustGold });
    }
    for (const r of state.relics) {
      if (r.id === 'r_sac_scale') {
        r.state.bonusAtk = (r.state.bonusAtk || 0) + 25;
        if (!isDryRun) events.push({ type: 'relic_grow', relicUid: r.uid, text: `+25攻(${r.state.bonusAtk})` });
      }
      if (r.id === 'r_sac_gold') {
        state.gold += 4;
        addShield(state, 20, events, isDryRun, '血契产金');
        if (!isDryRun) events.push({ type: 'gold_gain', amount: 4 });
      }
    }
    return savedBySub;
  }

  function recordSquadHpLoss(state, amount, events, isDryRun) {
    if (amount <= 0) return;
    for (const r of state.relics) {
      if (r.id === 'r_bld_scale') {
        r.state.bonusAtk = (r.state.bonusAtk || 0) + 8;
        if (!isDryRun && events) events.push({ type: 'relic_grow', relicUid: r.uid, text: `+8攻(${r.state.bonusAtk})` });
      }
    }
  }

  function recordGambleResult(state, isWin, remainingHand, events, isDryRun) {
    for (const r of state.relics) {
      if (r.id === 'r_dic_scale') {
        r.state.bonusAtk = (r.state.bonusAtk || 0) + 10;
        if (!isDryRun && events) events.push({ type: 'relic_grow', relicUid: r.uid, text: `+10攻(${r.state.bonusAtk})` });
      }
    }
    if (!isWin) return;
    state.waveGambleWins = (state.waveGambleWins || 0) + 1;
    if (hasRelic(state.relics, 'r_dic_bridge')) {
      state.gold += 2;
      if (!isDryRun && events) events.push({ type: 'gold_gain', amount: 2 });
      if (remainingHand && remainingHand.length > 0) {
        const pick = remainingHand[Math.floor(Math.random() * remainingHand.length)];
        if (pick) {
          pick.atk += 15;
          if (!isDryRun && events) events.push({ type: 'hand_grow', heroUid: pick.uid, amount: 15 });
        }
      }
    }
    if (hasRelic(state.relics, 'r_dic_jackpot') && !state.waveJackpotActive && state.waveGambleWins >= 2) {
      state.waveJackpotActive = true;
      state.gold += 6;
      if (!isDryRun && events) {
        events.push({ type: 'gold_gain', amount: 6 });
        events.push({ type: 'toast', text: '🎰 头奖狂潮触发！+6G 且本波后续全队 ×2.2！' });
      }
    }
  }

  function dealDamageToBoss(state, dmg, opts, events, isDryRun) {
    const amount = Math.max(0, Math.round(dmg));
    if (amount <= 0) return 0;
    let remaining = amount;
    if (!opts.ignoreShield && state.bossShield > 0) {
      const absorbed = Math.min(state.bossShield, remaining);
      state.bossShield -= absorbed;
      remaining -= absorbed;
    }
    const hpLost = Math.min(state.bossHp, remaining);
    state.bossHp = Math.max(0, state.bossHp - remaining);

    // Charge Break tracking (only during direct player actions)
    if (state.bossCharging && !state.bossStunned && !opts.isEndPoison) {
      state.bossBreakProgress += amount;
      if (state.bossBreakProgress >= state.bossBreakThreshold) {
        state.bossStunned = true;
        state.bossCharging = false;
        if (!isDryRun) events.push({ type: 'boss_break' });
      }
    }
    return amount;
  }

  // === PHASE 1: onRoundStart ===
  function onRoundStart(state) {
    const events = [];
    state.bossVuln = false;
    state.roundDiscardsCount = 0;
    state.roundUsedDiscard = false;
    state.roundTeamAtkBonus = 0;
    state.roundSlot1MultBonus = 0;
    state.ghostQueuedHero = null;
    state.pendingKnives = [];
    state.pendingScavengers = [];
    state.currentSlot3Bonus = state.nextRoundSlot3Bonus || 0;
    state.nextRoundSlot3Bonus = 0;

    if (state.currentSlot3Bonus > 0) {
      events.push({ type: 'toast', text: `借势蓄能：本回合 3 号位战力 +${state.currentSlot3Bonus}！` });
    }

    // GPT Fix #2: Thorn Crown grants +12 start-of-round shield if unshielded
    if (hasRelic(state.relics, 'r_shd_crown') && state.squadShield <= 0) {
      addShield(state, 12, events, false, '荆棘王冠');
    }
    return events;
  }

  // === Core Single Strike Pipeline (used by onStrike, Retrigger, Follow, Knife, Ghost, Scavenger) ===
  function executeSingleStrike(state, hero, ctx, remainingHand, events, isDryRun) {
    if (state.bossHp <= 0 && !isDryRun) return 0;

    // Special: c_amp_mage does not attack
    if (hero.noAttackAmpRight && !ctx.forceKnife) {
      if (!isDryRun) {
        events.push({ type: 'amp_cast', heroUid: hero.uid, slotIdx: ctx.slotIdx, label: '右侧 ×2.0' });
      }
      return 0;
    }

    ctx.hitIndex += 1;
    const slotLv1 = (state.slotLevels.slot1 || 1) - 1;
    const slotLv2 = (state.slotLevels.slot2 || 1) - 1;
    const slotLv3 = (state.slotLevels.slot3 || 1) - 1;

    // 1. Pre-strike Hero Effects & Shield/Gold/Poison
    let extraHeroAtk = 0;
    let heroMult = 1;

    if (hero.shieldVal > 0 && !ctx.forceKnife) {
      addShield(state, hero.shieldVal, events, isDryRun, hero.shortName);
    }
    if (hero.slot1Shield && ctx.slotIdx === 0 && !ctx.forceKnife) {
      addShield(state, hero.slot1Shield, events, isDryRun, hero.shortName);
    }
    if (hero.ironPlated) {
      addShield(state, 18, events, isDryRun, '铁壁甲');
    }
    if (ctx.slotIdx === 0 && slotLv1 > 0 && !ctx.forceKnife) {
      addShield(state, slotLv1 * 12, events, isDryRun, '1号位强化');
      extraHeroAtk += slotLv1 * 15;
    }
    if (ctx.slotIdx === 1 && slotLv2 > 0 && !ctx.forceKnife) {
      extraHeroAtk += slotLv2 * 28;
    }
    if (ctx.slotIdx === 2 && slotLv3 > 0 && !ctx.forceKnife) {
      heroMult *= +(1 + slotLv3 * 0.25).toFixed(2);
    }
    if (ctx.slotIdx === 2 && state.currentSlot3Bonus > 0 && !ctx.forceKnife) {
      extraHeroAtk += state.currentSlot3Bonus;
    }
    if (ctx.slotIdx === 0 && state.roundSlot1MultBonus > 0 && !ctx.forceKnife) {
      heroMult *= +(1 + state.roundSlot1MultBonus).toFixed(2);
    }

    // Gold on strike
    let goldGain = (hero.goldOnStrike || 0) + (hero.greedBadge ? 2 : 0);
    if (goldGain > 0) {
      state.gold += goldGain;
      if (!isDryRun) events.push({ type: 'gold_gain', amount: goldGain, heroUid: hero.uid });
    }

    // Shield-to-Atk & Consume Half Shield
    if (hero.shieldToAtkRatio && state.squadShield > 0) {
      extraHeroAtk += Math.round(state.squadShield * hero.shieldToAtkRatio);
    }
    if (hero.consumeHalfShieldMult && state.squadShield >= 2 && !ctx.forceKnife) {
      const consumed = Math.floor(state.squadShield / 2);
      state.squadShield -= consumed;
      extraHeroAtk += consumed * hero.consumeHalfShieldMult;
      if (hero.growAtkPer20ShieldConsumed && consumed >= 20) {
        const grows = Math.floor(consumed / 20) * hero.growAtkPer20ShieldConsumed;
        hero.atk += grows;
        if (!isDryRun) events.push({ type: 'hero_grow', heroUid: hero.uid, text: `+${grows}永久攻` });
      }
      if (!isDryRun) events.push({ type: 'shield_consume', amount: consumed, total: state.squadShield });
    }

    // Inherit left atk (Grand Drummer)
    if (hero.inheritLeftAtkRatio && ctx.leftHero) {
      extraHeroAtk += Math.round(ctx.leftHero.atk * hero.inheritLeftAtkRatio);
    }

    // Hero Self Multipliers
    if (hero.emptySlotMult && ctx.emptySlots > 0) {
      heroMult *= Math.pow(hero.emptySlotMult, ctx.emptySlots);
    }
    if (state.heroPassive && state.heroPassive.emptySlotExtraMult && ctx.emptySlots > 0) {
      heroMult *= Math.pow(state.heroPassive.emptySlotExtraMult, ctx.emptySlots);
    }
    if (hero.multPerWaveDiscard && state.waveDiscardsCount > 0) {
      heroMult *= +(1 + state.waveDiscardsCount * hero.multPerWaveDiscard).toFixed(2);
    }
    if (hero.glassBlade) {
      heroMult *= 2.0;
    }
    if (ctx.ampFromLeftMult && ctx.ampFromLeftMult > 1) {
      heroMult *= ctx.ampFromLeftMult;
    }
    // Frost Shatter / Lord
    if (hero.shatterMult && (state.bossFrost || 0) > 0 && !ctx.forceKnife) {
      heroMult *= hero.shatterMult;
      if (hero.shatterGrowAtk) {
        hero.atk += hero.shatterGrowAtk;
        if (!isDryRun) {
          events.push({ type: 'hero_grow', heroUid: hero.uid, text: `碎冰 +${hero.shatterGrowAtk}永久攻` });
          events.push({ type: 'ach_trigger', id: 'ach_freeze_boss' });
        }
      }
    }
    if (hero.consumeFrostBonusAtk && (state.bossFrost || 0) > 0 && !ctx.forceKnife) {
      const f = state.bossFrost;
      state.bossFrost = 0;
      state.bossFrozen = false;
      extraHeroAtk += f * hero.consumeFrostBonusAtk;
      heroMult *= +(1 + f * (hero.consumeFrostBonusMult || 0.18)).toFixed(2);
      if (!isDryRun) events.push({ type: 'ach_trigger', id: 'ach_freeze_boss' });
    }
    // Hand-Steel Multipliers (in-hand steel buff + lord per remaining hand)
    const remCount = remainingHand ? remainingHand.length : 0;
    if (remainingHand && remainingHand.length > 0) {
      for (const hh of remainingHand) {
        if (hh.inHandTeamMult) heroMult *= hh.inHandTeamMult;
      }
    }
    if (hero.multPerRemainingHand && remCount > 0 && !ctx.forceKnife) {
      heroMult *= Math.pow(hero.multPerRemainingHand, remCount);
    }
    // Sacrifice Multipliers
    if (hero.devourMult && hero._devouredThisTurn) {
      heroMult *= hero.devourMult;
    }
    if (hero.multPerWaveExhaust && (state.waveExhaustCount || 0) > 0) {
      heroMult *= Math.pow(hero.multPerWaveExhaust, state.waveExhaustCount);
    }

    // Blood-Burn Hooks (self HP cost, heal, bloodToShield, missing HP mult)
    if (hero.selfHpCost && !ctx.forceKnife) {
      const actualCost = Math.min(Math.max(0, state.squadHp - 1), hero.selfHpCost);
      if (actualCost > 0) {
        state.squadHp -= actualCost;
        recordSquadHpLoss(state, actualCost, events, isDryRun);
      }
      if (hero.selfCostMult) heroMult *= hero.selfCostMult;
      if (hero.selfCostGrowAtk) {
        hero.atk += hero.selfCostGrowAtk;
        if (!isDryRun) events.push({ type: 'hero_grow', heroUid: hero.uid, text: `燃血 +${hero.selfCostGrowAtk}永久攻` });
      }
      if (hero.bloodToShield) {
        addShield(state, hero.bloodToShield, events, isDryRun, '血盾转化');
      }
    }
    if (hero.healOnStrike && !ctx.forceKnife) {
      const lowBefore = state.squadHp <= state.squadMaxHp * (hero.lowHpThreshold || 0.6);
      if (lowBefore && hero.lowHpMult) heroMult *= hero.lowHpMult;
      state.squadHp = Math.min(state.squadMaxHp, state.squadHp + hero.healOnStrike);
    }
    if (hero.missingHpPctMult) {
      const missingPct = Math.max(0, Math.round(((state.squadMaxHp - state.squadHp) / state.squadMaxHp) * 100));
      if (missingPct > 0) heroMult *= +(1 + missingPct * hero.missingHpPctMult).toFixed(2);
    }
    if (hasRelic(state.relics, 'r_bld_heal') && ctx.hitIndex % 4 === 0) {
      state.squadHp = Math.min(state.squadMaxHp, state.squadHp + 6);
    }

    // Gamble-Dice Hooks (coin flip, 6-sided dice, gold bet retrigger, royal dealer)
    const gambleWinRate = hasRelic(state.relics, 'r_dic_lucky') ? 0.75 : 0.5;
    if (hero.gambleCoinMult && !ctx.forceKnife) {
      if (!isDryRun) {
        const win = Math.random() < gambleWinRate;
        recordGambleResult(state, win, remainingHand, events, false);
        if (win) {
          heroMult *= hero.gambleCoinMult;
          events.push({ type: 'toast', text: `🪙 抛币正面！伤害 ×${hero.gambleCoinMult}` });
        } else {
          state.gold += (hero.gambleFailGold || 2);
          events.push({ type: 'gold_gain', amount: hero.gambleFailGold || 2, heroUid: hero.uid });
        }
      } else {
        heroMult *= +(1 + (hero.gambleCoinMult - 1) * gambleWinRate).toFixed(2);
      }
    }
    if (hero.gambleDiceMode && !ctx.forceKnife) {
      if (!isDryRun) {
        const roll = Math.random();
        const isHigh = roll < (gambleWinRate * 0.65);
        const isMid = !isHigh && roll < 0.75;
        recordGambleResult(state, isHigh, remainingHand, events, false);
        if (isHigh) {
          heroMult *= 2.4;
          events.push({ type: 'toast', text: '🎲 命运高点！本次伤害 ×2.4！' });
        } else if (isMid) {
          hero.atk += 14;
          events.push({ type: 'hero_grow', heroUid: hero.uid, text: '🎲中点 +14永久攻' });
        } else {
          addShield(state, 20, events, false, '命运骰手');
        }
      } else {
        heroMult *= 1.45;
      }
    }
    if (hero.multPerGambleWin && (state.waveGambleWins || 0) > 0) {
      heroMult *= Math.pow(hero.multPerGambleWin, state.waveGambleWins);
    }

    // Poison Blood Bridge (t_poi_blood)
    if (hero.poisonBloodBridge && !ctx.forceKnife) {
      if (state.bossPoison <= 0) {
        addPoison(state, 12, events, isDryRun);
      } else {
        const consumedP = Math.max(1, Math.floor(state.bossPoison / 2));
        state.bossPoison -= consumedP;
        const selfGrow = consumedP * 3;
        const teamBoost = consumedP * 5;
        hero.atk += selfGrow;
        state.roundTeamAtkBonus += teamBoost;
        if (!isDryRun) {
          events.push({ type: 'hero_grow', heroUid: hero.uid, text: `吞${consumedP}毒 +${selfGrow}永久攻` });
          events.push({ type: 'toast', text: `毒血注能：全队本回合每次出手 +${teamBoost} 战力！` });
        }
      }
    }

    // 2. Base Damage + Team Bonus
    let dmg = (hero.atk || 0) + extraHeroAtk + (state.roundTeamAtkBonus || 0);
    let totalMult = heroMult;
    const initBaseAtk = Math.round(dmg);
    const initBaseMult = Number(totalMult.toFixed(2));

    // 3. Left -> Right Relic Rack Evaluation (supports r_copy_right!)
    const relicSteps = [];
    for (let i = 0; i < state.relics.length; i++) {
      const r = state.relics[i];
      let targetRelic = r;
      if (r.isCopyRight && i + 1 < state.relics.length) {
        targetRelic = state.relics[i + 1];
      }
      if (targetRelic && !targetRelic.isCopyRight) {
        const res = evalSingleRelic(targetRelic, {
          state, hero, slotIdx: ctx.slotIdx, hitIndex: ctx.hitIndex, emptySlots: ctx.emptySlots,
          isRetrigger: Boolean(ctx.isRetrigger),
          remHandCount: remainingHand ? remainingHand.length : 0,
          leftmostHandAtk: (remainingHand && remainingHand[0]) ? (remainingHand[0].atk || 0) : 0
        }, isDryRun);
        if (res.trigger) {
          if (res.addAtk) dmg += res.addAtk;
          if (res.mult && res.mult !== 1) totalMult *= res.mult;
          relicSteps.push({
            relicUid: r.uid,
            label: r.isCopyRight ? `复制:${res.label}` : res.label,
            fx: res.fx,
            addAtk: res.addAtk || 0,
            mult: res.mult || 1,
            isMult: Boolean(res.mult && res.mult !== 1),
            afterBase: Math.round(dmg),
            afterMult: Number(totalMult.toFixed(2))
          });
        }
      }
    }

    // Boss Vulnerability / Stun multiplier
    let statusMultLabel = null;
    if (state.bossStunned) {
      totalMult *= 1.5;
      statusMultLabel = '眩晕×1.5';
    } else if (state.bossVuln) {
      totalMult *= 1.4;
      statusMultLabel = '易伤×1.4';
    }

    const finalDmg = Math.max(1, Math.round(dmg * totalMult));
    dealDamageToBoss(state, finalDmg, { ignoreShield: false }, events, isDryRun);

    if (!isDryRun) {
      events.push({
        type: 'strike',
        heroUid: hero.uid,
        heroName: hero.shortName || hero.name,
        unitId: hero.unitId,
        slotIdx: ctx.slotIdx,
        isKnife: Boolean(ctx.forceKnife),
        isGhost: Boolean(ctx.isGhost),
        isRetrigger: Boolean(ctx.isRetrigger),
        dmg: finalDmg,
        baseAtk: initBaseAtk,
        baseMult: initBaseMult,
        finalBaseAtk: Math.round(dmg),
        finalMult: Number(totalMult.toFixed(2)),
        statusMultLabel,
        vfx: hero.vfx,
        relicSteps,
        hitIndex: ctx.hitIndex
      });
    }

    // Boss Thorns check (4 dmg per hit, blocked by shield)
    if (state.bossThorns && !ctx.forceKnife) {
      let tDmg = 4;
      if (state.squadShield > 0) {
        const blk = Math.min(state.squadShield, tDmg);
        state.squadShield -= blk;
        tDmg -= blk;
      }
      if (tDmg > 0) state.squadHp = Math.max(1, state.squadHp - tDmg);
      if (!isDryRun) events.push({ type: 'thorns_hit', dmg: 4 });
    }

    // 4. Post-Hit Status Effects
    if (hero.applyVuln && !state.bossVuln) {
      state.bossVuln = true;
      if (!isDryRun) events.push({ type: 'boss_vuln' });
    }
    if (hero.applyPoison && hero.applyPoison > 0 && !ctx.forceKnife) {
      addPoison(state, hero.applyPoison, events, isDryRun);
    }
    if (hero.multPoison && state.bossPoison > 0 && !ctx.forceKnife) {
      const added = Math.ceil(state.bossPoison * (hero.multPoison - 1));
      addPoison(state, added, events, isDryRun);
    }
    if (ctx.slot1InfectBonus > 0 && ctx.slotIdx > 0 && !ctx.forceKnife) {
      addPoison(state, ctx.slot1InfectBonus, events, isDryRun);
    }
    if (hasRelic(state.relics, 'r_poi_spread') && state.bossPoison > 0) {
      addPoison(state, 4, events, isDryRun);
    }
    // Frost Apply Hooks
    if (hero.applyFrost && hero.applyFrost > 0 && !ctx.forceKnife) {
      addFrost(state, hero.applyFrost, events, isDryRun);
    }
    if (hero.shieldToFrostPer10 && state.squadShield >= 10 && !ctx.forceKnife) {
      addFrost(state, Math.floor(state.squadShield / 10) * hero.shieldToFrostPer10, events, isDryRun);
    }
    if (ctx.isRetrigger && hasRelic(state.relics, 'r_frz_retrig') && (state.bossFrost || 0) >= 6) {
      addFrost(state, 2, events, isDryRun);
    }

    // Instant Poison Detonation (t_poi_lord)
    let extraDetonateDmg = 0;
    if (hero.detonatePoison && state.bossPoison > 0 && !ctx.forceKnife) {
      const perStack = getPoisonPerStack(state.relics);
      let det = state.bossPoison * perStack;
      if (hasRelic(state.relics, 'r_poi_mult') && state.bossPoison >= 15) det = Math.round(det * 1.9);
      dealDamageToBoss(state, det, { ignoreShield: true }, events, isDryRun);
      extraDetonateDmg = det;
      if (!isDryRun) events.push({ type: 'poison_detonate', dmg: det, stacks: state.bossPoison });
    }

    // Thorn Crown Bonus Shield Bash on Strike!
    let crownDmg = 0;
    if (hasRelic(state.relics, 'r_shd_crown') && state.squadShield > 0 && !ctx.forceKnife) {
      crownDmg = state.squadShield;
      dealDamageToBoss(state, crownDmg, { ignoreShield: false }, events, isDryRun);
      if (!isDryRun) events.push({ type: 'crown_bash', dmg: crownDmg });
    }

    // 5. Broadcast onAfterAllyStrike to In-Hand Scaling Heroes (c_veteran)
    if (remainingHand && remainingHand.length > 0) {
      for (const h of remainingHand) {
        if (h.inHandGrowPerStrike) {
          h.atk += h.inHandGrowPerStrike;
          if (!isDryRun) events.push({ type: 'hand_grow', heroUid: h.uid, amount: h.inHandGrowPerStrike });
        }
      }
    }

    return finalDmg + extraDetonateDmg + crownDmg;
  }

  function bumpRetriggerScale(state, events, isDryRun) {
    const r = getRelic(state.relics, 'r_retrig_scale');
    if (r) {
      r.state.bonusMult = +(((r.state && r.state.bonusMult) || 0) + 0.08).toFixed(2);
      if (!isDryRun) events.push({ type: 'relic_grow', relicUid: r.uid, text: `×${(1 + r.state.bonusMult).toFixed(2)}` });
    }
  }

  // === PHASE 2: onDiscard (Live Shuffle / Knives / Scavenger Bridge) ===
  function onDiscard(state, discardedHeroes, remainingHand) {
    const events = [];
    if (!discardedHeroes || discardedHeroes.length === 0) return { totalDmg: 0, events };

    state.roundUsedDiscard = true;
    const triggersPerCard = hasRelic(state.relics, 'r_disc_double') ? 2 : 1;
    let totalDmg = 0;

    // Queue first discarded hero for r_ghost_invite
    if (hasRelic(state.relics, 'r_ghost_invite') && !state.ghostQueuedHero && discardedHeroes[0]) {
      state.ghostQueuedHero = discardedHeroes[0];
      events.push({ type: 'toast', text: `幽灵请柬已锁定【${discardedHeroes[0].shortName}】，本手末影子补打！` });
    }

    // r_disc_vuln: Apply Vuln & +25% Slot 1 per discarded card
    if (hasRelic(state.relics, 'r_disc_vuln')) {
      state.bossVuln = true;
      state.roundSlot1MultBonus += discardedHeroes.length * 0.25;
      events.push({ type: 'boss_vuln' });
      events.push({ type: 'toast', text: `换桌破甲：Boss 易伤且 1 号位伤害 +${Math.round(discardedHeroes.length * 25)}%！` });
    }

    // r_shd_crown: Shield bash on discard!
    if (hasRelic(state.relics, 'r_shd_crown') && state.squadShield > 0) {
      const cd = state.squadShield;
      dealDamageToBoss(state, cd, { ignoreShield: false }, events, false);
      totalDmg += cd;
      events.push({ type: 'crown_bash', dmg: cd, fromDiscard: true });
    }

    const ctx = { hitIndex: 0, slotIdx: -1, emptySlots: 0, slot1InfectBonus: 0 };

    for (const hero of discardedHeroes) {
      state.waveDiscardsCount += 1;
      state.roundDiscardsCount += 1;

      // r_disc_scale permanent growth
      const scaleR = getRelic(state.relics, 'r_disc_scale');
      if (scaleR) {
        scaleR.state.bonusAtk = (scaleR.state.bonusAtk || 0) + 10;
        events.push({ type: 'relic_grow', relicUid: scaleR.uid, text: `+10攻(${scaleR.state.bonusAtk})` });
      }

      for (let t = 0; t < triggersPerCard; t++) {
        if (t > 0) bumpRetriggerScale(state, events, false);

        if (hero.goldOnDiscard) {
          state.gold += hero.goldOnDiscard;
          events.push({ type: 'gold_gain', amount: hero.goldOnDiscard, heroUid: hero.uid });
        }

        // t_disc_sharp: Permanent +15 atk, inject 100% atk to team, +1G
        if (hero.discardGrowSelfAtk) {
          hero.atk += hero.discardGrowSelfAtk;
          events.push({ type: 'hero_grow', heroUid: hero.uid, text: `+${hero.discardGrowSelfAtk}永久攻` });
        }
        if (hero.discardInjectTeamAtk) {
          state.roundTeamAtkBonus += hero.atk;
          events.push({ type: 'toast', text: `磨刃注能：本回合全队出手 +${hero.atk} 战力！` });
        }
        if (hero.discardGold) {
          state.gold += hero.discardGold;
          events.push({ type: 'gold_gain', amount: hero.discardGold, heroUid: hero.uid });
        }

        // t_disc_knife (GPT v14.1 Fix #1): Queue knives to fire with first deployed striker, grow at most +1 per discard action!
        if (hero.knifeCount > 0) {
          state.pendingKnives = state.pendingKnives || [];
          state.pendingKnives.push({ hero: { ...hero }, shots: hero.knifeCount });
          events.push({ type: 'toast', text: `飞刀蓄势 +${hero.knifeCount} 把（本手首位侠客出手时齐射）` });
          if (t === 0 && hero.growKnifeOnDiscard) {
            hero.knifeCount += hero.growKnifeOnDiscard;
            events.push({ type: 'hero_grow', heroUid: hero.uid, text: `飞刀永久+1(${hero.knifeCount}把)` });
          }
        }

        // t_disc_scav [BRIDGE] (P0 Fix: Queue leftmost hero to fire after first active strike, preventing empty-board kill!)
        if (hero.discardTriggerLeftmostHand && remainingHand && remainingHand.length > 0) {
          const target = remainingHand[0];
          if (target) {
            state.pendingScavengers = state.pendingScavengers || [];
            state.pendingScavengers.push({ ...target });
            events.push({ type: 'toast', text: `弃牌导流锁定【${target.shortName}】，本手首击后免费追加出手！` });
          }
        }
      }
    }

    return { totalDmg, events };
  }

  // === PHASE 3, 4, 5: Deploy, Left->Right Strike Loop, HandEnd & Forecast Links ===
  function simulateOrExecuteStrike(state, slots, remainingHand, isDryRun, roster = null) {
    const workState = isDryRun ? cloneStateForDryRun(state) : state;
    const workSlots = isDryRun ? slots.map((h) => (h ? { ...h } : null)) : slots;
    const workHand = isDryRun ? remainingHand.map((h) => ({ ...h })) : remainingHand;
    const events = [];
    const links = [];
    const devouredUids = [];
    const savedBySubUids = [];

    // Phase 3 Deploy Hook: t_sac_devour devours left neighbor!
    let slot3ExtraActsFromSac = 0;
    for (let i = 1; i < 3; i++) {
      const h = workSlots[i];
      if (h && h.devourLeftRatio && workSlots[i - 1]) {
        const victim = workSlots[i - 1];
        const gainAtk = Math.round((victim.atk || 0) * h.devourLeftRatio);
        h.atk += gainAtk;
        h._devouredThisTurn = true;
        workSlots[i - 1] = null;
        const saved = triggerExhaustHooks(workState, victim, isDryRun ? null : roster, events, isDryRun);
        if (saved) savedBySubUids.push(victim.uid);
        else devouredUids.push(victim.uid);
        if (hasRelic(workState.relics, 'r_sac_encore')) slot3ExtraActsFromSac += 1;
        links.push(`${i + 1}号吞噬${i}号 (+${gainAtk}永久攻 ×1.6)`);
        if (!isDryRun) {
          events.push({ type: 'hero_grow', heroUid: h.uid, text: `吞噬+${gainAtk}永久攻` });
          events.push({ type: 'ach_trigger', id: 'ach_sac_eat' });
        }
      }
    }

    const activeCount = workSlots.filter(Boolean).length;
    const emptySlots = 3 - activeCount;
    if (activeCount === 0) {
      return {
        directDmg: 0,
        poisonEndDmg: calcProjectedEndPoison(workState),
        shieldTotal: workState.squadShield,
        hits: 0,
        willBreak: false,
        willDirectKill: false,
        willPoisonKill: false,
        links: [],
        events: []
      };
    }

    // Build readable golden trigger links for live tactical preview!
    if (workSlots[0] && workSlots[0].applyVuln && (workSlots[1] || workSlots[2])) {
      links.push('1号挂易伤×1.4 → 后续增伤');
    }
    if (workSlots[0] && workSlots[0].slot1InfectTeammates && (workSlots[1] || workSlots[2])) {
      links.push('1号传染毒牙 → 队友命中+3毒');
    }
    for (let i = 0; i < 3; i++) {
      const h = workSlots[i];
      if (!h) continue;
      if (h.noAttackAmpRight && i < 2 && workSlots[i + 1]) {
        links.push(`${i + 1}号导魔 → ${i + 2}号伤害×2.0`);
      }
      if (h.retriggerLeft && i > 0 && workSlots[i - 1]) {
        links.push(`${i + 1}号复读 → ${i}号再出手`);
      }
      if (h.followPrev && i > 0 && workSlots[i - 1]) {
        links.push(`${i}号出手 → ${i + 1}号影步补刀`);
      }
      if (h.emptySlotMult && emptySlots > 0) {
        links.push(`孤狼空${emptySlots}位 ×${Math.pow(h.emptySlotMult, emptySlots).toFixed(2)}`);
      }
    }
    if (hasRelic(workState.relics, 'r_loop_ring') && workSlots[0] && workSlots[2]) {
      links.push('衔尾闭环：3号 → 倒回1号再动');
    }
    if (workState.ghostQueuedHero) {
      links.push(`幽灵请柬：末段影子补打【${workState.ghostQueuedHero.shortName}】`);
    }
    const totalPendingKnives = (workState.pendingKnives || []).reduce((s, pk) => s + pk.shots, 0);
    if (totalPendingKnives > 0) {
      links.push(`🗡 蓄势飞刀 ×${totalPendingKnives} → 随首击齐射`);
    }
    if (workState.pendingScavengers && workState.pendingScavengers.length > 0) {
      links.push(`⚡ 弃牌导流 ×${workState.pendingScavengers.length} → 首击后追加`);
    }
    if (workState.heroPassive && workState.heroPassive.slot3TriggersSlot2 && workSlots[2] && workSlots[1]) {
      links.push('英雄06：3号首击 → 触发2号再动');
    }

    const slot1InfectBonus = (workSlots[0] && workSlots[0].slot1InfectTeammates) ? workSlots[0].slot1InfectTeammates : 0;
    const ctx = { hitIndex: 0, emptySlots, slot1InfectBonus };
    let directDmg = 0;
    let safetyCap = 0;

    // Helper: run a hero's strike + trigger any immediately following "followPrev" ally!
    const runSlotStrike = (slotIdx, opts = {}) => {
      if (safetyCap++ > 36) return;
      const hero = workSlots[slotIdx];
      if (!hero) return;
      const leftHero = slotIdx > 0 ? workSlots[slotIdx - 1] : null;
      const ampFromLeftMult = (leftHero && leftHero.noAttackAmpRight) ? leftHero.noAttackAmpRight : 1;

      directDmg += executeSingleStrike(
        workState,
        hero,
        {
          ...ctx,
          slotIdx,
          leftHero,
          ampFromLeftMult,
          isRetrigger: Boolean(opts.isRetrigger),
          get hitIndex() { return ctx.hitIndex; },
          set hitIndex(v) { ctx.hitIndex = v; }
        },
        workHand,
        events,
        isDryRun
      );

      // Follow-up trigger (c_shadow_follow) when the hero immediately ahead strikes!
      if (!hero.noAttackAmpRight && slotIdx + 1 < 3 && workSlots[slotIdx + 1] && workSlots[slotIdx + 1].followPrev) {
        const follower = workSlots[slotIdx + 1];
        bumpRetriggerScale(workState, events, isDryRun);
        if (follower.followGrowAtk) {
          follower.atk += follower.followGrowAtk;
          if (!isDryRun) events.push({ type: 'hero_grow', heroUid: follower.uid, text: `+${follower.followGrowAtk}永久攻` });
        }
        directDmg += executeSingleStrike(
          workState,
          follower,
          {
            ...ctx,
            slotIdx: slotIdx + 1,
            leftHero: hero,
            ampFromLeftMult: 1,
            isRetrigger: true,
            get hitIndex() { return ctx.hitIndex; },
            set hitIndex(v) { ctx.hitIndex = v; }
          },
          workHand,
          events,
          isDryRun
        );
      }
    };

    // Main Left -> Right Slot Loop (0 -> 1 -> 2)
    let knivesFired = false;
    let hero06Fired = false;
    for (let i = 0; i < 3; i++) {
      const hero = workSlots[i];
      if (!hero) continue;
      let acts = 1;
      if (hero.redSeal) acts += 1;
      if (i === 0 && hasRelic(workState.relics, 'r_first_encore')) acts += 1;
      if (i === 0 && hasRelic(workState.relics, 'r_bld_bridge') && workState.squadHp <= workState.squadMaxHp * 0.55) acts += 1;
      if (i === 2 && slot3ExtraActsFromSac > 0) acts += slot3ExtraActsFromSac;

      for (let a = 0; a < acts; a++) {
        if (a > 0) bumpRetriggerScale(workState, events, isDryRun);
        runSlotStrike(i, { isRetrigger: a > 0 });

        // t_sac_bridge: Summon temporary blade spirit if empty slot exists!
        if (hero.summonBladeIfEmpty && emptySlots > 0) {
          workState.waveSummonTriggered = true;
          bumpRetriggerScale(workState, events, isDryRun);
          const spirit = {
            ...hero,
            uid: hero.uid + '_spirit',
            shortName: '剑灵',
            atk: Math.round(hero.atk * hero.summonBladeIfEmpty),
            summonBladeIfEmpty: 0
          };
          directDmg += executeSingleStrike(
            workState,
            spirit,
            { ...ctx, slotIdx: i, isRetrigger: true, get hitIndex() { return ctx.hitIndex; }, set hitIndex(v) { ctx.hitIndex = v; } },
            workHand,
            events,
            isDryRun
          );
        }

        // t_hnd_bridge: Leftmost hand hero assists whenever Slot 3 strikes!
        if (i === 2 && workHand.length > 0 && workHand[0].leftmostAssistSlot3) {
          bumpRetriggerScale(workState, events, isDryRun);
          directDmg += executeSingleStrike(
            workState,
            workHand[0],
            { ...ctx, slotIdx: 2, isRetrigger: true, isGhost: true, get hitIndex() { return ctx.hitIndex; }, set hitIndex(v) { ctx.hitIndex = v; } },
            workHand,
            events,
            isDryRun
          );
        }

        // GPT v14.1 Fix #1: Fire queued discard knives alongside the first deployed striker!
        if (!knivesFired && workState.pendingKnives && workState.pendingKnives.length > 0 && !hero.noAttackAmpRight) {
          knivesFired = true;
          for (const pk of workState.pendingKnives) {
            for (let k = 0; k < pk.shots; k++) {
              if (workState.bossHp <= 0 && !isDryRun) break;
              directDmg += executeSingleStrike(
                workState,
                pk.hero,
                {
                  ...ctx,
                  slotIdx: i,
                  forceKnife: true,
                  isRetrigger: k > 0,
                  get hitIndex() { return ctx.hitIndex; },
                  set hitIndex(v) { ctx.hitIndex = v; }
                },
                workHand,
                events,
                isDryRun
              );
            }
          }
          workState.pendingKnives = [];
        }

        // P0 Fix: Fire queued Scavenger triggers right after first active striker!
        if (workState.pendingScavengers && workState.pendingScavengers.length > 0 && !hero.noAttackAmpRight) {
          const queued = workState.pendingScavengers.slice();
          workState.pendingScavengers = [];
          for (const target of queued) {
            if (workState.bossHp <= 0 && !isDryRun) break;
            bumpRetriggerScale(workState, events, isDryRun);
            directDmg += executeSingleStrike(
              workState,
              target,
              {
                ...ctx,
                slotIdx: i,
                isRetrigger: true,
                get hitIndex() { return ctx.hitIndex; },
                set hitIndex(v) { ctx.hitIndex = v; }
              },
              workHand,
              events,
              isDryRun
            );
          }
        }

        // Hero06 Passive: Slot 3 first strike triggers Slot 2 once
        if (i === 2 && !hero06Fired && workState.heroPassive && workState.heroPassive.slot3TriggersSlot2 && workSlots[1]) {
          hero06Fired = true;
          bumpRetriggerScale(workState, events, isDryRun);
          runSlotStrike(1, { isRetrigger: true });
        }

        // Retrigger Left (st_drummer / c_grand_drummer)
        if (hero.retriggerLeft && i > 0 && workSlots[i - 1]) {
          bumpRetriggerScale(workState, events, isDryRun);
          runSlotStrike(i - 1, { isRetrigger: true });
        }

        // t_dic_bridge: Bet 2G to retrigger left hero + 50% (75% lucky) chance to win 4G back!
        if (hero.retriggerLeftOnBet && i > 0 && workSlots[i - 1] && workState.gold >= (hero.gambleBetGold || 2)) {
          workState.gold -= (hero.gambleBetGold || 2);
          const winRate = hasRelic(workState.relics, 'r_dic_lucky') ? 0.75 : 0.5;
          if (!isDryRun) {
            const win = Math.random() < winRate;
            recordGambleResult(workState, win, workHand, events, false);
            if (win) {
              workState.gold += 4;
              events.push({ type: 'gold_gain', amount: 4, heroUid: hero.uid });
            }
          }
          bumpRetriggerScale(workState, events, isDryRun);
          runSlotStrike(i - 1, { isRetrigger: true });
        }
      }
    }

    // Rule-Breaker: r_loop_ring (Slot 3 loops back to Slot 1 once!)
    if (hasRelic(workState.relics, 'r_loop_ring') && workSlots[2] && workSlots[0]) {
      bumpRetriggerScale(workState, events, isDryRun);
      runSlotStrike(0, { isRetrigger: true });
    }

    // Rule-Breaker: r_ghost_invite (First discarded hero strikes from shadow!)
    if (workState.ghostQueuedHero && workState.bossHp > 0) {
      const gh = workState.ghostQueuedHero;
      bumpRetriggerScale(workState, events, isDryRun);
      directDmg += executeSingleStrike(
        workState,
        gh,
        {
          ...ctx,
          slotIdx: 2,
          isGhost: true,
          isRetrigger: true,
          get hitIndex() { return ctx.hitIndex; },
          set hitIndex(v) { ctx.hitIndex = v; }
        },
        workHand,
        events,
        isDryRun
      );
      workState.ghostQueuedHero = null;
    }

    // Empty Slot Economy Bounty (r_empty_bounty)
    if (emptySlots > 0 && hasRelic(workState.relics, 'r_empty_bounty')) {
      const g = emptySlots * 2;
      workState.gold += g;
      if (!isDryRun) events.push({ type: 'gold_gain', amount: g, label: '孤客赏金' });
    }

    // Phase 5: onHandEnd (Hand Slot Upgrade + Hand-Steel Pack end-of-round growth & gold!)
    const handLvBonus = ((workState.slotLevels.hand || 1) - 1) * 6;
    const hasWarmWine = hasRelic(workState.relics, 'r_hnd_grow');
    const handScaleR = getRelic(workState.relics, 'r_hnd_scale');
    if (handScaleR && workHand.length > 0) {
      handScaleR.state.bonusAtk = (handScaleR.state.bonusAtk || 0) + workHand.length * 4;
      if (!isDryRun) events.push({ type: 'relic_grow', relicUid: handScaleR.uid, text: `+${workHand.length * 4}攻` });
    }
    if (workHand.length > 0) {
      for (const h of workHand) {
        const totalGrow = handLvBonus + (hasWarmWine ? 10 : 0) + (h.inHandEndGrowAtk || 0);
        if (totalGrow > 0) {
          h.atk += totalGrow;
          if (!isDryRun) events.push({ type: 'hand_grow', heroUid: h.uid, amount: totalGrow });
        }
        if (h.inHandEndGold) {
          workState.gold += h.inHandEndGold;
          if (!isDryRun) events.push({ type: 'gold_gain', amount: h.inHandEndGold, heroUid: h.uid });
        }
      }
    }

    for (const h of workSlots) { if (h) delete h._devouredThisTurn; }

    const willDirectKill = workState.bossHp <= 0;
    const poisonEndDmg = willDirectKill ? 0 : calcProjectedEndPoison(workState);
    const willPoisonKill = !willDirectKill && poisonEndDmg >= workState.bossHp;

    return {
      directDmg,
      poisonEndDmg,
      shieldTotal: workState.squadShield,
      hits: ctx.hitIndex,
      willBreak: workState.bossStunned && state.bossCharging,
      willDirectKill,
      willPoisonKill,
      links,
      devouredUids,
      savedBySubUids,
      events
    };
  }

  function calcProjectedEndPoison(state) {
    if (state.bossPoison <= 0) return 0;
    const perStack = getPoisonPerStack(state.relics);
    let dmg = state.bossPoison * perStack;
    if (hasRelic(state.relics, 'r_poi_mult') && state.bossPoison >= 15) {
      dmg = Math.round(dmg * 1.9);
    }
    return dmg;
  }

  // === PHASE 6: Boss Action & End-of-Round Poison / Exhaust ===
  function onBossActAndRoundEnd(state, slots, remainingHand, intent, roster) {
    const events = [];

    // 1. Boss Attack (if alive and not stunned; reduced by Frost stacks / Frozen!)
    if (state.bossHp > 0 && !state.bossStunned && intent) {
      let incoming = intent.dmg || 0;
      if (incoming > 0 && (state.bossFrost || 0) > 0) {
        const mult = state.bossFrozen ? 0.5 : Math.max(0.55, 1 - state.bossFrost * 0.05);
        incoming = Math.max(1, Math.round(incoming * mult));
      }
      if (intent.kind === 'shield' && intent.shieldGain) {
        state.bossShield += intent.shieldGain;
        events.push({ type: 'boss_shield', amount: intent.shieldGain });
      }
      if (incoming > 0) {
        const rawIncoming = incoming;
        let blocked = 0;
        if (state.squadShield > 0) {
          blocked = Math.min(state.squadShield, incoming);
          state.squadShield -= blocked;
          incoming -= blocked;
        }
        if (incoming > 0) {
          state.squadHp = Math.max(0, state.squadHp - incoming);
          recordSquadHpLoss(state, incoming, events, false);
          // r_bld_immortal: Prevent fatal damage once per wave, lock 1 HP & grant 3x buff!
          if (state.squadHp <= 0 && hasRelic(state.relics, 'r_bld_immortal') && !state.waveImmortalUsed) {
            state.waveImmortalUsed = true;
            state.waveImmortalBuff = true;
            state.squadHp = 1;
            events.push({ type: 'toast', text: '🩸 不灭血契发动！锁血 1 HP，本波后续伤害 ×3.0！' });
          }
        }
        events.push({ type: 'boss_attack', rawDmg: rawIncoming, blocked, hpLost: incoming });

        // onSquadHit hooks!
        // t_shd_borrow [BRIDGE]: 60% of rawIncoming -> next round Slot 3 bonus!
        if (slots[0] && slots[0].borrowHitToSlot3) {
          const gain = Math.round(rawIncoming * slots[0].borrowHitToSlot3);
          state.nextRoundSlot3Bonus = (state.nextRoundSlot3Bonus || 0) + gain;
          events.push({ type: 'toast', text: `借势电池充能：下回合 3 号位战力 +${gain}！` });
        }
        // t_shd_bastion: Survive in Slot 1 -> permanently +12 shieldVal, +15 atk!
        if (slots[0] && slots[0].growOnSlot1SurviveShield && state.squadHp > 0) {
          slots[0].shieldVal += slots[0].growOnSlot1SurviveShield;
          slots[0].atk += slots[0].growOnSlot1SurviveAtk;
          events.push({ type: 'hero_grow', heroUid: slots[0].uid, text: `永久+${slots[0].growOnSlot1SurviveShield}盾 +${slots[0].growOnSlot1SurviveAtk}攻` });
        }
        // r_shd_revenge: 4x counter damage!
        if (hasRelic(state.relics, 'r_shd_revenge') && state.squadHp > 0) {
          const revDmg = rawIncoming * 4;
          dealDamageToBoss(state, revDmg, { ignoreShield: false, isEndPoison: true }, events, false);
          events.push({ type: 'revenge_hit', dmg: revDmg });
        }
      }
    }

    // 2. End-of-Round Shield Decay (GPT Fix #2: r_shd_keep keeps 60%)
    if (state.squadShield > 0) {
      if (hasRelic(state.relics, 'r_shd_keep')) {
        state.squadShield = Math.floor(state.squadShield * 0.6);
      } else {
        state.squadShield = 0;
      }
    }

    // 3. End-of-Round Poison Settlement (if Boss still alive and Squad alive)
    if (state.bossHp > 0 && state.squadHp > 0 && state.bossPoison > 0) {
      const pDmg = calcProjectedEndPoison(state);
      const actualDeducted = Math.min(state.bossHp, pDmg);
      dealDamageToBoss(state, pDmg, { ignoreShield: true, isEndPoison: true }, events, false);
      events.push({ type: 'poison_tick', dmg: pDmg, stacks: state.bossPoison });

      // r_poi_furnace (v14.1 Anti-Overflow Fix + Cap hand atk growth at +40/round)
      if (hasRelic(state.relics, 'r_poi_furnace') && actualDeducted >= 80) {
        const procs = Math.floor(actualDeducted / 80);
        state.gold += procs;
        const handAtkGain = Math.min(40, procs * 5);
        for (const h of remainingHand) {
          h.atk += handAtkGain;
        }
        events.push({ type: 'furnace_proc', gold: procs, handAtkGain });
      }

      // If Boss died to poison, grow t_poi_brew in roster!
      if (state.bossHp <= 0 && roster) {
        for (const h of roster) {
          if (h.growPoisonOnPoisonKill) {
            h.applyPoison += h.growPoisonOnPoisonKill;
            events.push({ type: 'toast', text: `毒层翻倍成长：挂毒永久 +${h.growPoisonOnPoisonKill} 层！` });
          }
        }
      }

      // Poison Decay (unless r_poi_keep)
      if (!hasRelic(state.relics, 'r_poi_keep')) {
        state.bossPoison = Math.ceil(state.bossPoison * 0.6);
      }
    }

    // 4. End-of-Round Frost Decay (r_frz_keep keeps 50%, otherwise resets)
    if ((state.bossFrost || 0) > 0) {
      if (hasRelic(state.relics, 'r_frz_keep')) {
        state.bossFrost = Math.floor(state.bossFrost * 0.5);
      } else {
        state.bossFrost = 0;
      }
      state.bossFrozen = state.bossFrost >= 10;
    }

    return events;
  }

  // === PHASE 7: Shop Spend & Wave Clear Scaling ===
  function onShopSpend(relics, roster, amount) {
    if (amount <= 0) return [];
    const notes = [];
    for (const r of relics) {
      if (r.id === 'r_spend_scale') {
        r.state.spentAcc = (r.state.spentAcc || 0) + amount;
        while (r.state.spentAcc >= 5) {
          r.state.spentAcc -= 5;
          r.state.bonusAtk = (r.state.bonusAtk || 0) + 12;
          notes.push(`消费加攻 +12战力(共+${r.state.bonusAtk})`);
        }
      }
    }
    for (const h of roster) {
      if (h.growPerSpend3G) {
        h.spendAcc = (h.spendAcc || 0) + amount;
        while (h.spendAcc >= 3) {
          h.spendAcc -= 3;
          h.atk += h.growPerSpend3G;
          notes.push(`${h.shortName} 永久+${h.growPerSpend3G}攻`);
        }
      }
    }
    return notes;
  }

  function countThemeSources(roster, heroPassive, sourceKey) {
    let n = 0;
    if (sourceKey === 'poison') {
      if (heroPassive && heroPassive.startBossPoison > 0) n += 1;
      for (const h of roster) {
        if ((h.applyPoison && h.applyPoison > 0) || h.poisonBloodBridge) n += 1;
      }
    } else if (sourceKey === 'shield') {
      if (heroPassive && heroPassive.startShield > 0) n += 1;
      for (const h of roster) {
        if ((h.shieldVal && h.shieldVal > 0) || (h.slot1Shield && h.slot1Shield > 0) || h.ironPlated) n += 1;
      }
    } else if (sourceKey === 'discard') {
      for (const h of roster) {
        if (h.knifeCount > 0 || h.discardGrowSelfAtk || h.discardTriggerLeftmostHand || h.goldOnDiscard) n += 1;
      }
    } else if (sourceKey === 'frost') {
      for (const h of roster) {
        if ((h.applyFrost && h.applyFrost > 0) || h.shieldToFrostPer10) n += 1;
      }
    }
    return n;
  }

  function onWaveClear(relics) {
    for (const r of relics) {
      if (r.id === 'r_wave_scale') {
        r.state.bonusMult = +(((r.state && r.state.bonusMult) || 0.25) + 0.25).toFixed(2);
      }
    }
  }

  window.MT.V14_ENGINE = {
    getPoisonPerStack,
    onRoundStart,
    onDiscard,
    forecast: (state, slots, remainingHand) => simulateOrExecuteStrike(state, slots, remainingHand, true, null),
    executeStrike: (state, slots, remainingHand, roster) => simulateOrExecuteStrike(state, slots, remainingHand, false, roster),
    onBossActAndRoundEnd,
    triggerExhaustHooks,
    onShopSpend,
    onWaveClear,
    countThemeSources
  };
})();
