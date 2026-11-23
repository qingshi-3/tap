// v9.0 Mirror-Lake Eclipse Relic-Chain Battle Theater
// - Full-bleed 1280x720 (320x180 x 4) Split-Biome Pine Forest <-> Giant Black-Hole Solar Eclipse + Real-Time Shimmering Mirror Lake
// - True Left-to-Right 5-Slot Balatro Relic Pipeline (GPT Fix #1: + adds in-place, x multiplies damage arriving at that slot!)
// - Ascending Harmonic Chimes + Staggered Slot Pop Animations + 19 Independent Keyed Duelyst H5 Effects + Live Water Reflections
(function () {
  window.MT = window.MT || {};

  const BW = 1280;
  const BH = 720;
  const VW = 320;
  const VH = 180;
  const BRIDGE_VY = 104;
  const BRIDGE_Y = BRIDGE_VY * 4;     // 416px
  const LAKE_Y = (BRIDGE_VY + 8) * 4; // 448px
  const MAX_TURNS = 6;

  const EL_LIGHT_COLORS = {
    fire:  '#ff7a33',
    grass: '#52e88a',
    ice:   '#5ce6ff',
    light: '#ffe378',
    dark:  '#b86cff',
    bolt:  '#58f5ee'
  };

  const ECLIPSE_PALETTES = {
    default: { skyTop: '#3e1c4a', skyMid: '#8a3560', skyLow: '#d96c84', corona1: '#a82c58', corona2: '#ff6e8e', cloudDark: '#b84b6a', cloudMid: '#ea7b8e', cloudHi: '#ffc2cc', ruinDark: '#3f384f', ruinMid: '#5d5370', ruinHi: '#827699' },
    ice:     { skyTop: '#241a4a', skyMid: '#5c2e6e', skyLow: '#b85c94', corona1: '#7e308c', corona2: '#eb78d4', cloudDark: '#7a3c7c', cloudMid: '#bf68a8', cloudHi: '#f5b8e2', ruinDark: '#34334d', ruinMid: '#504e70', ruinHi: '#7a789e' },
    dark:    { skyTop: '#2d123d', skyMid: '#6e2159', skyLow: '#c24874', corona1: '#941e58', corona2: '#ff528c', cloudDark: '#94315e', cloudMid: '#d65e83', cloudHi: '#ffb0c8', ruinDark: '#362e47', ruinMid: '#54486b', ruinHi: '#7b6c96' }
  };

  function hash2(x, y, seed = 1) {
    let n = Math.imul(x + 31, 374761393) + Math.imul(y + 19, 668265263) + Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  const PROP_PAL = {
    'K': '#090712', 'I': '#1f2336', 'i': '#3d4563', 's': '#7c89b0',
    'C': '#2289b8', 'c': '#58d4ff', 'W': '#f0fdff',
    'S': '#383d59', 'z': '#5a6385', 'Z': '#8e99bf',
    'O': '#2e293d', 'o': '#524966', 'h': '#7b6f94',
    'V': '#a34cff', 'v': '#e6b8ff'
  };

  const PROPS = {
    cyanLamp: [
      '......K......', '.....KsK.....', '....KisiK....', '...KiCCciK...',
      '..KiCWWWCiK..', '..KiCWWWCiK..', '..KiCWWWCiK..', '...KiCCciK...',
      '....KiiiK....', '.....KiK.....', '....KisiK....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '.....KiK.....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '.....KiK.....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '.....KiK.....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '.....KiK.....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '.....KiK.....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '....KisiK....', '...KizSziK...',
      '...KzSSSzK...', '..KzZSSSZzK..', '..KKKKKKKKK..'
    ],
    floatCrystal: [
      '....K....', '...KCK...', '..KCcWK..', '..KCcWK..', '.KCccWWK.',
      '.KCccWWK.', 'KCcccWWcK', 'KCcccWWcK', 'KCccWWccK', '.KCcWccK.',
      '.KCccccK.', '..KCccK..', '..KCCcK..', '...KCK...', '....K....'
    ],
    floatShard: [
      '..KKKKK..', '.KOhhhoK.', '.KOhhooK.', 'KOhhoOOK.', 'KOhooOOK.',
      '.KOooOOK.', '.KOOoOK..', '..KOOOK..', '..KOOOK..', '...KOOK..', '...KOK...', '....K....'
    ],
    arcanePrism: [
      '.KKKKKKKKKKKKK.', 'KhhhooooooooohK', 'KhOoKKKKKKKKoOK', '.KhOKVVVVVVKoK.',
      '.KhOKVvvvvVKoK.', '..KhOKvWWvKoK..', '..KhOKvWWvKoK..', '...KhOKvvKoK...',
      '...KhOKVVKoK...', '....KhOKKoK....', '....KhOOoK.....', '.....KhOK......',
      '.....KOOK......', '......KK.......'
    ]
  };

  function drawMatrix(ctx, rows, ox, oy, flipX = false) {
    const w = rows[0] ? rows[0].length : 0;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = PROP_PAL[ch];
        if (!col) continue;
        const dx = flipX ? (ox + (w - 1 - x)) : (ox + x);
        ctx.fillStyle = col;
        ctx.fillRect(dx, oy + y, 1, 1);
      }
    }
  }

  class EngineBattle {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.canvas.width = BW;
      this.canvas.height = BH;

      this.sceneBuf = document.createElement('canvas');
      this.sceneBuf.width = BW;
      this.sceneBuf.height = BRIDGE_Y + 24;
      this.sceneCtx = this.sceneBuf.getContext('2d');

      this.bgCache = {};
      this.running = false;
      this.rafId = null;
      this.lastTs = 0;
      this.speed = 1;

      this.time = 0;
      this.hitstop = 0;
      this.shakeTime = 0;
      this.shakeAmp = 0;
      this.finisherSlow = 0;
      this.screenFlash = null;

      this.allies = [];
      this.boss = null;
      this.relics = [];
      this.drinks = [];
      this.waveCfg = null;
      this.runCtx = null;

      this.round = 1;
      this.turnQueue = [];
      this.actionTimer = 0;
      this.activeAnim = null;
      this.finishDelay = 0;
      this.battleResult = null;
      this.bossGhostHp = 0;

      // Chain metrics
      this.roundTriggers = 0;
      this.totalAttacksForFrost = 0;
      this.totalFxForStorm = 0;
      this.echoUsedThisRound = false;
      this.bossArmorLeft = 0;
      this.bossEvadeUsed = false;
      this.sealedSlotIdx = -1;
      this.peakHit = 0;
      this.totalTriggers = 0;
      this.combatGold = 0;
      this.openingCloakDone = false;

      // Drag bottle state
      this.draggingDrinkIdx = -1;
      this.dragPos = null;

      this.particles = [];
      this.popups = [];
      this.projectiles = [];
      this.activeVfx = [];
      this.lights = [];
      this.shockwaves = [];
      this.afterimages = [];
      this.ambientMotes = [];
      this._timers = [];

      this.onDone = null;
      this.bindPointer();
    }

    // ─── Start Wave Battle with Active 5-Slot Relic Engine ───
    play({ squad, relics, drinks, waveCfg, runCtx, onDone }) {
      const { getHeroStats, HEROES, TACTICAL_DRINKS } = window.MT.ENGINE_DATA;
      this.clearTimers();
      this.waveCfg = waveCfg;
      this.runCtx = runCtx; // { gold, rerollsTotal }
      this.onDone = onDone;
      this.biome = waveCfg.element === 'ice' ? 'ice' : waveCfg.element === 'dark' ? 'dark' : 'default';

      this.time = 0;
      this.hitstop = 0;
      this.shakeTime = 0;
      this.finisherSlow = 0;
      this.screenFlash = null;
      this.round = 1;
      this.actionTimer = 0.55;
      this.activeAnim = null;
      this.finishDelay = 0;
      this.battleResult = null;

      this.roundTriggers = 0;
      this.totalAttacksForFrost = 0;
      this.totalFxForStorm = 0;
      this.echoUsedThisRound = false;
      this.bossArmorLeft = waveCfg.affixId === 'armor2' ? 2 : 0;
      this.bossEvadeUsed = false;
      this.sealedSlotIdx = -1;
      this.peakHit = 0;
      this.totalTriggers = 0;
      this.combatGold = 0;
      this.openingCloakDone = false;
      this.draggingDrinkIdx = -1;
      this.dragPos = null;

      this.particles = [];
      this.popups = [];
      this.projectiles = [];
      this.activeVfx = [];
      this.lights = [];
      this.shockwaves = [];
      this.afterimages = [];
      this.ambientMotes = Array.from({ length: 22 }, (_, i) => ({
        x: Math.random() * BW, y: 60 + Math.random() * 340,
        vx: (Math.random() - 0.5) * 18, vy: -10 - Math.random() * 14,
        phase: i * 1.15, size: 4
      }));

      // Snapshot relics in exact left-to-right order!
      this.relics = relics.map((r, idx) => ({ ...r, slotIdx: idx }));

      // Snapshot carried 0..2 Tactical Drinks
      this.drinks = drinks
        .map((id) => TACTICAL_DRINKS.find((d) => d.id === id))
        .filter(Boolean)
        .slice(0, 2)
        .map((d, idx) => ({ ...d, slotIdx: idx, used: false, slowMoRemaining: 2.0 }));

      // Build persistent Allies (Front -> Mid -> Back)
      const roleRank = { tank: 1, warrior: 2, assassin: 3, ranged: 4, support: 5 };
      const sorted = [...squad].sort((a, b) => (roleRank[a.role] || 3) - (roleRank[b.role] || 3));
      const allyXs = sorted.length === 1 ? [420] : sorted.length === 2 ? [485, 305] : [525, 365, 205];
      this.allies = sorted.map((m, idx) => {
        const tpl = HEROES.find((h) => h.id === m.id) || HEROES[0];
        const st = getHeroStats(tpl, m.stars || 1);
        return {
          side: 'ally',
          id: m.id,
          uid: m.uid,
          unitId: tpl.unitId,
          name: tpl.name,
          stars: m.stars || 1,
          role: tpl.role,
          element: tpl.element,
          maxHp: st.maxHp,
          hp: st.maxHp,
          ghostHp: st.maxHp,
          shield: tpl.role === 'tank' ? Math.round(st.maxHp * 0.45) : tpl.role === 'support' ? Math.round(st.maxHp * 0.20) : 0,
          atk: st.atk,
          crit: st.crit,
          speed: st.speed,
          alive: true,
          homeX: allyXs[idx],
          homeY: BRIDGE_Y,
          x: allyXs[idx],
          y: BRIDGE_Y,
          knockX: 0,
          squashX: 1,
          squashY: 1,
          anim: 'idle',
          flash: 0,
          phase: idx * 1.4
        };
      });

      // Build Blind Boss on Right Side of the Mirror-Lake Bridge!
      this.boss = {
        side: 'enemy',
        isBoss: true,
        id: 'boss',
        unitId: waveCfg.bossUnitId,
        name: waveCfg.bossName,
        element: waveCfg.element,
        maxHp: waveCfg.hp,
        hp: waveCfg.hp,
        ghostHp: waveCfg.hp,
        atk: waveCfg.atk,
        speed: 8,
        burn: 0,
        freeze: 0,
        charging: false,
        turnsSinceCharge: 0,
        alive: true,
        homeX: 985,
        homeY: BRIDGE_Y,
        x: 985,
        y: BRIDGE_Y,
        knockX: 0,
        squashX: 1,
        squashY: 1,
        anim: 'idle',
        flash: 0,
        phase: 0.5
      };
      this.bossGhostHp = waveCfg.hp;

      this.buildTurnQueue();
      this.renderBattleHud();
      this.renderRelicBar();
      this.renderDrinkDock();

      this.running = true;
      this.lastTs = 0;
      const loop = (ts) => {
        if (!this.running) return;
        if (!this.lastTs) this.lastTs = ts;
        const rawDt = Math.min(0.05, (ts - this.lastTs) / 1000);
        this.lastTs = ts;
        this.update(rawDt);
        this.render();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    clearTimers() {
      for (const id of this._timers) clearTimeout(id);
      this._timers = [];
    }

    stop() {
      this.running = false;
      this.clearTimers();
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    setSpeed(spd) {
      this.speed = spd === 2 ? 2 : 1;
      const b1 = document.getElementById('btn-bt-speed-1');
      const b2 = document.getElementById('btn-bt-speed-2');
      if (b1) b1.classList.toggle('active', this.speed === 1);
      if (b2) b2.classList.toggle('active', this.speed === 2);
    }

    // ─── Visual Pop & Ascending Chime on Relic Bar Slot ───
    pulseRelicSlot(slotIdx, badgeText, color, delayMs = 0, stepOrder = 0, isMult = false) {
      const tid = setTimeout(() => {
        if (!this.running) return;
        const el = document.querySelector(`#bt-relic-chain .bt-relic-slot[data-ridx="${slotIdx}"]`);
        if (el) {
          el.classList.remove('pop');
          void el.offsetWidth;
          el.classList.add('pop');
          const popTag = el.querySelector('.bt-relic-pop');
          if (popTag) {
            popTag.textContent = badgeText;
            popTag.style.color = color;
            popTag.classList.remove('show');
            void popTag.offsetWidth;
            popTag.classList.add('show');
          }
        }
        if (window.MT.sfx) window.MT.sfx.playChainDing(stepOrder, isMult);
      }, Math.round(delayMs / this.speed));
      this._timers.push(tid);
    }

    // ─── TRUE LEFT-TO-RIGHT 5-SLOT RELIC PIPELINE (GPT Fix #1!) ───
    evaluateAttackPipeline(actor, opts = {}) {
      const { isFxAttack = false, baseMult = 1.0, forcedCrit = false } = opts;
      const boss = this.boss;
      let curDmg = Math.round(actor.atk * baseMult * (0.95 + Math.random() * 0.1));

      // Compute total crit chance (base + gambler dice)
      let bonusCrit = 0;
      for (const r of this.relics) {
        if (r.slotIdx === this.sealedSlotIdx) continue;
        if (r.id === 'r_gambler_dice') bonusCrit += 30;
      }
      const isCrit = forcedCrit || (Math.random() * 100 < (actor.crit + bonusCrit));
      if (isCrit) curDmg = Math.round(curDmg * 1.5);

      const triggeredEvents = []; // [{ slotIdx, label, color, isMult }]
      const extraFollowups = [];  // Duelyst VFX follow-up attacks!
      let hadMultRelic = false;
      let stepOrder = 0;

      // STRICT LEFT -> RIGHT PASS ACROSS SLOTS 0..4!
      for (const r of this.relics) {
        if (r.slotIdx === this.sealedSlotIdx) continue;

        if (r.id === 'r_whetstone') {
          curDmg += 26;
          triggeredEvents.push({ slotIdx: r.slotIdx, label: '+26', color: '#78d8ff', isMult: false });
        } else if (r.id === 'r_ember_amp') {
          if (actor.element === 'fire' || isFxAttack) {
            curDmg += 48;
            triggeredEvents.push({ slotIdx: r.slotIdx, label: '+48火', color: '#ff7b3d', isMult: false });
          }
        } else if (r.id === 'r_ledger') {
          const bonus = Math.max(14, (this.runCtx.rerollsTotal || 0) * 14);
          curDmg += bonus;
          triggeredEvents.push({ slotIdx: r.slotIdx, label: `+${bonus}`, color: '#ffd966', isMult: false });
        } else if (r.id === 'r_shield_bash') {
          if (actor.shield > 0) {
            const bonus = Math.round(actor.shield * 0.55);
            if (bonus > 0) {
              curDmg += bonus;
              triggeredEvents.push({ slotIdx: r.slotIdx, label: `+${bonus}盾`, color: '#7ceeff', isMult: false });
            }
          }
        } else if (r.id === 'r_gambler_dice') {
          if (isCrit) {
            curDmg += 22;
            triggeredEvents.push({ slotIdx: r.slotIdx, label: '暴+22', color: '#c07aff', isMult: false });
          }
        } else if (r.id === 'r_gold_cup') {
          if (isCrit) {
            curDmg += 28;
            let goldTxt = '暴+28';
            if (this.combatGold < 12) {
              this.combatGold += 2;
              goldTxt = '+28 & +2G';
            }
            triggeredEvents.push({ slotIdx: r.slotIdx, label: goldTxt, color: '#ffe07d', isMult: false });
          }
        } else if (r.id === 'r_ember_orb') {
          if (!isFxAttack && (actor.element === 'fire' || isCrit)) {
            this.roundTriggers++;
            this.totalTriggers++;
            this.totalFxForStorm++;
            triggeredEvents.push({ slotIdx: r.slotIdx, label: '火球!', color: '#ff6e3a', isMult: false });
            extraFollowups.push({ kind: 'fireball', vfx: 'fx_flamesphere', color: '#ff7b29', mult: 0.58 });
          }
        } else if (r.id === 'r_frost_seal') {
          this.totalAttacksForFrost++;
          if (this.totalAttacksForFrost >= 3) {
            this.totalAttacksForFrost = 0;
            this.roundTriggers++;
            this.totalTriggers++;
            this.totalFxForStorm++;
            boss.freeze = 1;
            if (boss.charging) {
              boss.charging = false;
              this.spawnPopup(boss.x, boss.y - 165, '❄ 冰封打断蓄力!', '#5ce6ff', true);
            }
            triggeredEvents.push({ slotIdx: r.slotIdx, label: '冰冻!', color: '#5ce6ff', isMult: false });
            extraFollowups.push({ kind: 'frost', vfx: 'fxFrozenIceBlock', color: '#5ce6ff', mult: 0 });
          }
        } else if (r.id === 'r_storm_bell') {
          if (this.totalFxForStorm >= 2) {
            this.totalFxForStorm -= 2;
            this.roundTriggers++;
            this.totalTriggers++;
            triggeredEvents.push({ slotIdx: r.slotIdx, label: '天雷!', color: '#58f5ee', isMult: false });
            extraFollowups.push({ kind: 'storm', vfx: 'fx_f2_twilightreiki', color: '#58f5ee', mult: 0.78 });
          }
        } else if (r.id === 'r_compound') {
          const stacks = Math.min(8, Math.max(1, this.roundTriggers));
          const mult = Math.pow(1.25, stacks);
          curDmg = Math.round(curDmg * mult);
          hadMultRelic = true;
          triggeredEvents.push({ slotIdx: r.slotIdx, label: `×${mult.toFixed(2)}`, color: '#ff5978', isMult: true });
        } else if (r.id === 'r_all_in') {
          if ((this.runCtx.gold + this.combatGold) >= 25) {
            curDmg = Math.round(curDmg * 1.85);
            hadMultRelic = true;
            triggeredEvents.push({ slotIdx: r.slotIdx, label: '×1.85', color: '#ffd966', isMult: true });
          }
        } else if (r.id === 'r_crit_lens') {
          if (isCrit) {
            curDmg = Math.round(curDmg * 1.8);
            hadMultRelic = true;
            triggeredEvents.push({ slotIdx: r.slotIdx, label: '暴×1.8', color: '#ff6e91', isMult: true });
          }
        } else if (r.id === 'r_blood_pact') {
          curDmg = Math.round(curDmg * 2.0);
          hadMultRelic = true;
          triggeredEvents.push({ slotIdx: r.slotIdx, label: '血×2.0', color: '#ff475b', isMult: true });
        } else if (r.id === 'r_burn_oil') {
          if (boss.burn > 0 || boss.freeze > 0) {
            curDmg = Math.round(curDmg * 1.7);
            hadMultRelic = true;
            triggeredEvents.push({ slotIdx: r.slotIdx, label: '异×1.7', color: '#ff944d', isMult: true });
          }
        } else if (r.id === 'r_reaper') {
          if (boss.hp / boss.maxHp < 0.50) {
            curDmg = Math.round(curDmg * 2.2);
            hadMultRelic = true;
            triggeredEvents.push({ slotIdx: r.slotIdx, label: '斩×2.2', color: '#c678ff', isMult: true });
          }
        }
      }

      // Count non-mult relic triggers toward round chain
      if (triggeredEvents.length > 0) {
        this.roundTriggers += Math.min(2, triggeredEvents.length);
        this.totalTriggers += triggeredEvents.length;
        this.totalFxForStorm += 1;
      }

      // Apply Wave Boss Affixes (Armor, Resist Plain)
      if (!isFxAttack && this.waveCfg.affixId === 'armor2' && this.bossArmorLeft > 0 && actor.id !== 'kyle_blade') {
        this.bossArmorLeft--;
        curDmg = Math.round(curDmg * 0.6);
      }
      if (!isFxAttack && this.waveCfg.affixId === 'resist_plain' && !isCrit && !hadMultRelic) {
        curDmg = Math.round(curDmg * 0.65);
      }

      // Play staggered slot pops & ascending chimes!
      triggeredEvents.forEach((ev, idx) => {
        this.pulseRelicSlot(ev.slotIdx, ev.label, ev.color, idx * 65, idx, ev.isMult);
      });

      return { dmg: Math.max(1, curDmg), isCrit, hadMultRelic, triggeredCount: triggeredEvents.length, extraFollowups };
    }

    // ─── Turn Queue & Round Start/End Triggers ───
    buildTurnQueue() {
      const living = [...this.allies.filter((a) => a.alive)];
      living.sort((a, b) => b.speed - a.speed);
      if (this.boss && this.boss.alive) living.push(this.boss);
      this.turnQueue = living;
    }

    onRoundStart() {
      this.roundTriggers = 0;
      this.echoUsedThisRound = false;
      this.bossArmorLeft = this.waveCfg.affixId === 'armor2' ? 2 : 0;
      this.bossEvadeUsed = false;

      // W8 Boss Seal Leftmost Relic every 2 rounds!
      if (this.waveCfg.affixId === 'seal_left' && this.round % 2 === 0 && this.relics.length > 0) {
        this.sealedSlotIdx = 0;
        this.spawnPopup(this.boss.x, this.boss.y - 165, '日蚀封印 · 最左秘宝失效!', '#ff5978', true);
      } else {
        this.sealedSlotIdx = -1;
      }
      this.renderRelicBar();

      // Blood Pact self-HP cost at start of round!
      const bp = this.relics.find((r) => r.id === 'r_blood_pact' && r.slotIdx !== this.sealedSlotIdx);
      if (bp) {
        this.pulseRelicSlot(bp.slotIdx, '血契!', '#ff475b', 0, 0, true);
        for (const a of this.allies) {
          if (!a.alive) continue;
          const drain = Math.max(1, Math.round(a.hp * 0.18));
          a.hp = Math.max(1, a.hp - drain);
          this.spawnPopup(a.x, a.y - 108, `血契 -${drain}`, '#ff5978', false);
        }
      }

      // Opening Shadow Cloak Backstab on Round 1!
      if (this.round === 1 && !this.openingCloakDone) {
        this.openingCloakDone = true;
        const cloak = this.relics.find((r) => r.id === 'r_shadow_cloak' && r.slotIdx !== this.sealedSlotIdx);
        if (cloak && this.boss && this.boss.alive) {
          this.roundTriggers += 2;
          this.totalTriggers += 2;
          this.pulseRelicSlot(cloak.slotIdx, '开局斩!', '#c07aff', 0, 1, false);
          for (const a of this.allies) {
            if (!a.alive || !this.boss.alive) continue;
            const res = this.evaluateAttackPipeline(a, { isFxAttack: true, baseMult: 0.75 });
            this.playVfx('fx_f2_teleportsmoke', a.x, a.y - 54, { scale: 1.65 });
            this.playVfx('fx_crossslash', this.boss.x, this.boss.y - 58, { scale: 1.55 });
            this.spawnLight(this.boss.x, this.boss.y - 58, '#c07aff', 180, 0.45);
            this.applyBossDamage(res.dmg, res.isCrit ? '#ffd966' : '#c07aff', `瞬斩 -${res.dmg}`, true);
          }
        }
      }
    }

    onRoundEnd() {
      // Holy Chalice end-of-round heal + shield!
      const chalice = this.relics.find((r) => r.id === 'r_holy_chalice' && r.slotIdx !== this.sealedSlotIdx);
      if (chalice) {
        this.pulseRelicSlot(chalice.slotIdx, '奶+盾!', '#5ef29b', 0, 0, false);
        for (const a of this.allies) {
          if (!a.alive) continue;
          const heal = Math.round(a.maxHp * 0.22);
          const sh = Math.round(a.maxHp * 0.25);
          a.hp = Math.min(a.maxHp, a.hp + heal);
          a.shield += sh;
          this.playVfx('fx_f1_holyimmolation', a.x, a.y - 50, { scale: 1.6 });
          this.playVfx('fxDistortionHexShield', a.x, a.y - 56, { scale: 0.68, alpha: 0.8, blend: 'lighter' });
          this.spawnPopup(a.x, a.y - 110, `+${heal} 盾+${sh}`, '#5ef29b', false);
        }
      }
    }

    stepNextTurn() {
      if (!this.boss || !this.boss.alive) {
        this.finishBattle(true);
        return;
      }
      if (this.allies.every((a) => !a.alive)) {
        this.finishBattle(false);
        return;
      }

      if (this.turnQueue.length === 0) {
        this.onRoundEnd();
        if (this.round >= MAX_TURNS) {
          this.spawnPopup(this.boss.x, this.boss.y - 165, '6 回合超时!', '#ff5978', true);
          this.finishBattle(false);
          return;
        }
        this.round++;
        this.buildTurnQueue();
        this.onRoundStart();
        this.renderBattleHud();
      }

      if (this.round === 1 && !this.openingCloakDone) {
        this.onRoundStart();
      }

      let actor = null;
      while (this.turnQueue.length > 0 && !actor) {
        const cand = this.turnQueue.shift();
        if (cand.alive) actor = cand;
      }
      if (!actor) return;

      if (actor.side === 'ally') {
        this.executeAllyAction(actor, false);
      } else {
        this.executeBossAction(actor);
      }
    }

    executeAllyAction(actor, isRetrigger = false) {
      if (!this.boss || !this.boss.alive) return;

      // Support Aria heals & shields entire team every time she acts!
      if (actor.id === 'aria_sun') {
        for (const a of this.allies) {
          if (!a.alive) continue;
          const heal = Math.round(a.maxHp * 0.18);
          const sh = Math.round(a.maxHp * 0.16);
          a.hp = Math.min(a.maxHp, a.hp + heal);
          a.shield += sh;
          this.playVfx('fx_f1_holyimmolation', a.x, a.y - 48, { scale: 1.45 });
        }
        this.spawnPopup(actor.x, actor.y - 115, '全队圣光奶盾!', '#5ef29b', false);
      }

      // Check Retrigger sources: Echo Blade (first actor each round), Lilith (always 2 hits!), 2★+ Kyle (2 hits!)
      let extraSwings = 0;
      if (!isRetrigger) {
        if (actor.id === 'lilith_dance' || (actor.id === 'kyle_blade' && actor.stars >= 2)) {
          extraSwings += 1;
        }
        const echo = this.relics.find((r) => r.id === 'r_echo_blade' && r.slotIdx !== this.sealedSlotIdx);
        if (echo && !this.echoUsedThisRound) {
          this.echoUsedThisRound = true;
          extraSwings += 1;
          this.pulseRelicSlot(echo.slotIdx, '再打1次!', '#ff85c0', 0, 0, true);
        }
      }

      // Queue any extra swings immediately at the front of turnQueue!
      for (let i = 0; i < extraSwings; i++) {
        this.turnQueue.unshift({ ...actor, _isRetriggerRef: actor, alive: true });
      }
      const realActor = actor._isRetriggerRef || actor;
      if (!realActor.alive) {
        this.actionTimer = 0.05;
        return;
      }

      this.launchAttackAnim(realActor, this.boss, { isRetrigger: Boolean(actor._isRetriggerRef) });
      this.actionTimer = 0.62;
    }

    executeBossAction(boss) {
      // Burn DoT tick
      if (boss.burn > 0) {
        const burnDmg = Math.max(15, Math.round(boss.maxHp * 0.05));
        boss.burn--;
        this.playVfx('fxImpactBigOrange', boss.x, boss.y - 54, { scale: 1.75 });
        this.applyBossDamage(burnDmg, '#ff6e3a', `灼烧 -${burnDmg}`, false);
        if (!boss.alive) return;
      }

      // Freeze skip!
      if (boss.freeze > 0) {
        boss.freeze--;
        this.playVfx('fxFrozenIceBlock', boss.x, boss.y - 58, { scale: 1.8 });
        this.spawnPopup(boss.x, boss.y - 140, '❄ 冰冻跳过回合!', '#5ce6ff', true);
        this.actionTimer = 0.55;
        return;
      }

      const livingAllies = this.allies.filter((a) => a.alive);
      if (!livingAllies.length) return;
      const enrageMult = (this.waveCfg.affixId === 'enrage4' && this.round >= 4) ? 2.0 : 1.0;

      // Charged AoE Ultimate!
      if (boss.charging) {
        boss.charging = false;
        boss.turnsSinceCharge = 0;
        this.shake(15, 0.38);
        this.hitstop = 0.085;
        this.spawnScreenFlash('#ff475b', 0.28, 0.28);
        this.spawnPopup(boss.x, boss.y - 155, '灭世蓄力爆破!!', '#ff475b', true);
        this.spawnShockwave(boss.x, boss.y - 54, '#ff475b', 180, 0.45, 5);
        for (const a of livingAllies) {
          const dmg = Math.round(boss.atk * 1.45 * enrageMult * (a.role === 'tank' ? 0.78 : 1.0));
          this.applyAllyDamage(a, dmg);
          this.playVfx('fx_f4_shadownova', a.x, a.y - 56, { scale: 1.75, flipX: true });
          this.spawnLight(a.x, a.y - 50, '#ff475b', 165, 0.52);
        }
        if (window.MT.sfx) window.MT.sfx.playCrit();
        this.actionTimer = 0.95;
        return;
      }

      // Charge telegraph on charge / seal_left bosses
      if (this.waveCfg.affixId === 'charge' || this.waveCfg.affixId === 'seal_left') {
        boss.turnsSinceCharge++;
        if (boss.turnsSinceCharge >= 2) {
          boss.charging = true;
          this.playVfx('fx_f4_voidpulse', boss.x, boss.y - 74, { scale: 1.95 });
          this.spawnLight(boss.x, boss.y - 74, '#ff475b', 220, 0.65);
          this.spawnPopup(boss.x, boss.y - 155, '⚠ 蓄力重击（泼烈焰酒/冰冻可断）', '#ff5978', true);
          this.actionTimer = 0.72;
          return;
        }
      }

      // Standard front-ally boss strike
      const target = livingAllies[0];
      const dmg = Math.round(boss.atk * enrageMult * (target.role === 'tank' ? 0.82 : 1.0));
      this.launchBossStrikeAnim(boss, target, dmg);
      this.actionTimer = 0.68;
    }

    launchAttackAnim(actor, target, opts = {}) {
      const isMelee = actor.role !== 'ranged' && actor.role !== 'support';
      const dashX = target.x - 104;
      const dur = window.MT.sprites ? Math.min(0.62, window.MT.sprites.getAttackDurationSec(actor.unitId)) : 0.44;
      const animSpeedMult = window.MT.sprites ? window.MT.sprites.getAttackSpeedMult(actor.unitId, dur) : 1;

      if (actor.role === 'assassin') {
        this.playVfx('fx_f2_teleportsmoke', actor.homeX, actor.homeY - 52, { scale: 1.5 });
        this.playVfx('fx_f2_teleportsmoke', dashX, target.y - 52, { scale: 1.65 });
      }
      this.activeAnim = {
        kind: 'ally', actor, target, isMelee, opts,
        elapsed: 0, dur, animSpeedMult, hitDone: false, afterTimer: 0,
        startX: actor.homeX, dashX
      };
      actor.anim = 'attack';
    }

    launchBossStrikeAnim(boss, target, dmg) {
      const dur = window.MT.sprites ? Math.min(0.62, window.MT.sprites.getAttackDurationSec(boss.unitId)) : 0.46;
      const animSpeedMult = window.MT.sprites ? window.MT.sprites.getAttackSpeedMult(boss.unitId, dur) : 1;
      this.activeAnim = {
        kind: 'boss', actor: boss, target, isMelee: true, dmg,
        elapsed: 0, dur, animSpeedMult, hitDone: false, afterTimer: 0,
        startX: boss.homeX, dashX: target.x + 108
      };
      boss.anim = 'attack';
    }

    resolveAllyHit(actor, opts = {}) {
      const boss = this.boss;
      if (!boss || !boss.alive) return;

      // W4 Shadow Evade: evades 1st basic attack each round (relic VFX follow-ups still hit!)
      if (this.waveCfg.affixId === 'evade1' && !this.bossEvadeUsed) {
        this.bossEvadeUsed = true;
        this.playVfx('fx_f2_teleportsmoke', boss.x, boss.y - 62, { scale: 1.8 });
        this.spawnPopup(boss.x, boss.y - 135, '暗影闪避!(特效必中)', '#c07aff', true);
        // Still evaluate follow-up VFX triggers!
        const res = this.evaluateAttackPipeline(actor, { isFxAttack: false });
        this.triggerFollowups(actor, res.extraFollowups, res.dmg);
        return;
      }

      const res = this.evaluateAttackPipeline(actor, { isFxAttack: false });
      const el = actor.element || 'fire';
      const lightCol = EL_LIGHT_COLORS[el] || '#ffd966';

      // Primary Duelyst VFX
      const isMelee = actor.role !== 'ranged' && actor.role !== 'support';
      if (isMelee) {
        const sk = res.triggeredCount >= 3 ? 'fx_multislash_full' : (el === 'fire' ? 'fx_fireslash' : 'fx_crossslash');
        this.playVfx(sk, boss.x, boss.y - 60, { scale: sk === 'fx_multislash_full' ? 2.0 : 1.65 });
      } else {
        const rk = el === 'fire' ? 'fx_flamesphere' : el === 'bolt' ? 'fx_f2_twilightreiki' : 'fx_f4_voidpulse';
        this.playVfx(rk, boss.x, boss.y - 60, { scale: rk === 'fx_f2_twilightreiki' ? 1.35 : 1.6 });
      }

      // Mord innate bolt VFX bonus!
      if (actor.id === 'mord_blood') {
        this.roundTriggers++;
        this.totalFxForStorm++;
        this.playVfx('fx_f2_twilightreiki', boss.x, boss.y - 66, { scale: 1.25, blend: 'lighter' });
      }
      // Seven Boom innate burn!
      if (actor.id === 'seven_boom') boss.burn = Math.max(boss.burn, 2);
      // Grey Fenrir 35% innate freeze!
      if (actor.id === 'grey_fenrir' && Math.random() < 0.35) {
        boss.freeze = 1;
        this.playVfx('fxFrozenIceBlock', boss.x, boss.y - 58, { scale: 1.65 });
      }

      const bigHit = res.isCrit || res.hadMultRelic || res.dmg >= 200;
      if (bigHit) {
        this.playVfx('fxExplosionBigWhiteHot', boss.x, boss.y - 62, { scale: 1.9, blend: 'lighter' });
        this.spawnShockwave(boss.x, boss.y - 54, res.isCrit ? '#ffd966' : lightCol, 125, 0.36, 4.5);
        this.hitstop = res.dmg >= 500 ? 0.08 : 0.055;
        this.shake(res.dmg >= 500 ? 12 : 7.5, 0.24);
      } else {
        this.playVfx('fxImpactBigOrange', boss.x, boss.y - 56, { scale: 1.6, blend: 'lighter' });
        this.shake(3.5, 0.14);
      }
      this.spawnLight(boss.x, boss.y - 58, lightCol, bigHit ? 235 : 165, 0.52);

      const lbl = res.isCrit ? `暴击 -${res.dmg}!` : `-${res.dmg}`;
      this.applyBossDamage(res.dmg, res.isCrit ? '#ffe07d' : '#ff7b8d', lbl, bigHit);

      // W5 Frost Thorns reflect on melee attacks
      if (this.waveCfg.affixId === 'thorns' && isMelee && actor.alive) {
        const refl = Math.max(6, Math.round(boss.atk * 0.35));
        this.applyAllyDamage(actor, refl);
      }

      // Fire any triggered Relic Duelyst VFX follow-ups (Fireball, Storm Lightning, Frost)!
      this.triggerFollowups(actor, res.extraFollowups, res.dmg);
    }

    triggerFollowups(actor, followups, baseHitDmg) {
      if (!followups || !followups.length) return;
      followups.forEach((fu, idx) => {
        const tid = setTimeout(() => {
          if (!this.running || !this.boss || !this.boss.alive) return;
          this.playVfx(fu.vfx, this.boss.x, this.boss.y - 62, { scale: fu.kind === 'storm' ? 1.55 : 1.85 });
          this.spawnLight(this.boss.x, this.boss.y - 60, fu.color, 210, 0.52);
          this.spawnShockwave(this.boss.x, this.boss.y - 54, fu.color, 110, 0.34, 4);
          if (fu.kind === 'fireball') this.boss.burn = Math.max(this.boss.burn, 2);
          if (fu.mult > 0) {
            const fxDmg = Math.max(12, Math.round(baseHitDmg * fu.mult));
            const lbl = fu.kind === 'storm' ? `天雷 -${fxDmg}` : `火球 -${fxDmg}`;
            this.applyBossDamage(fxDmg, fu.color, lbl, true);
          }
        }, Math.round((130 + idx * 140) / this.speed));
        this._timers.push(tid);
      });
    }

    applyBossDamage(dmg, color, label, big = false) {
      const boss = this.boss;
      if (!boss || !boss.alive) return;
      if (dmg > this.peakHit) this.peakHit = dmg;
      boss.hp = Math.max(0, boss.hp - dmg);
      boss.flash = 0.2;
      boss.knockX = big ? 22 : 11;
      boss.squashX = big ? 0.82 : 0.90;
      boss.squashY = big ? 1.20 : 1.10;
      this.spawnPopup(boss.x, boss.y - 120, label, color, big);
      this.burstParticles(boss.x, boss.y - 58, color, big ? 24 : 11);

      if (boss.hp <= 0) {
        boss.alive = false;
        this.finisherSlow = 0.42;
        this.shake(16, 0.44);
        this.spawnScreenFlash('#ffe48a', 0.34, 0.36);
        this.playVfx('fxExplosionBigWhiteHot', boss.x, boss.y - 72, { scale: 2.6, blend: 'lighter' });
        this.spawnLight(boss.x, boss.y - 68, '#ffe07d', 280, 0.72);
        this.spawnShockwave(boss.x, boss.y - 56, '#ffe07d', 180, 0.46, 5);
        this.spawnPopup(boss.x, boss.y - 165, '盲注击破!!', '#ffe07d', true);
        this.finishBattle(true);
      }
      this.renderBattleHud();
    }

    applyAllyDamage(ally, dmg) {
      if (!ally || !ally.alive) return;
      let rem = dmg;
      if (ally.shield > 0) {
        const abs = Math.min(ally.shield, rem);
        ally.shield -= abs;
        rem -= abs;
        if (abs > 0) this.playVfx('fxDistortionHexShield', ally.x, ally.y - 54, { scale: 0.7, alpha: 0.85, blend: 'lighter' });
      }
      ally.hp = Math.max(0, ally.hp - rem);
      ally.flash = 0.18;
      ally.knockX = -14;
      ally.squashX = 0.86;
      ally.squashY = 1.14;
      this.spawnPopup(ally.x, ally.y - 110, `-${dmg}`, '#ff6b7d', false);
      if (ally.hp <= 0) {
        ally.alive = false;
        this.burstParticles(ally.x, ally.y - 48, '#ff5978', 18);
      }
      this.renderBattleHud();
    }

    // ─── Interactive Tactical Drinks (Tarot Cards!) ───
    throwDrink(drinkIdx, explicitTarget = null) {
      if (!this.running || this.battleResult) return;
      const d = this.drinks[drinkIdx];
      if (!d || d.used) return;
      d.used = true;
      this.draggingDrinkIdx = -1;
      this.dragPos = null;
      this.renderDrinkDock();

      this.hitstop = 0.08;
      this.shake(10, 0.26);
      if (window.MT.sfx) window.MT.sfx.playSplash();
      this.roundTriggers += 2;
      this.totalTriggers += 2;

      if (d.id === 'flame_shot') {
        const boss = this.boss;
        if (!boss || !boss.alive) return;
        const dmg = Math.round(boss.maxHp * 0.16) + 35;
        boss.burn = Math.max(boss.burn, 3);
        this.playVfx('fxExplosionBigBall_MetalSlug', boss.x, boss.y - 72, { scale: 2.25 });
        this.playVfx('fx_flamesphere', boss.x, boss.y - 68, { scale: 1.65, blend: 'lighter' });
        this.spawnLight(boss.x, boss.y - 64, '#ff7b29', 280, 0.78);
        this.spawnShockwave(boss.x, boss.y - 54, '#ffae42', 160, 0.42, 5);
        this.spawnScreenFlash('#ff7b29', 0.24, 0.24);
        this.applyBossDamage(dmg, '#ff7a3d', `烈焰破甲 -${dmg}`, true);
        if (boss.charging) {
          boss.charging = false;
          boss.turnsSinceCharge = 0;
          this.spawnPopup(boss.x, boss.y - 168, '🔥 打断 Boss 蓄力!!', '#ffe07d', true);
        }
      } else if (d.id === 'holy_ale') {
        for (const a of this.allies) {
          if (!a.alive) continue;
          const heal = Math.round(a.maxHp * 0.35);
          const sh = Math.round(a.maxHp * 0.30);
          a.hp = Math.min(a.maxHp, a.hp + heal);
          a.shield += sh;
          this.playVfx('fx_f1_holyimmolation', a.x, a.y - 52, { scale: 2.0 });
          this.playVfx('fxDistortionHexShield', a.x, a.y - 58, { scale: 0.85, alpha: 0.9, blend: 'lighter' });
          this.spawnLight(a.x, a.y - 52, '#5ef29b', 210, 0.65);
          this.spawnPopup(a.x, a.y - 124, `+${heal} & 护盾!`, '#5ef29b', true);
        }
        this.spawnScreenFlash('#5ef29b', 0.18, 0.22);
        this.renderBattleHud();
      } else if (d.id === 'fury_absinthe') {
        const living = this.allies.filter((a) => a.alive);
        if (!living.length) return;
        const target = (explicitTarget && explicitTarget.side === 'ally' && explicitTarget.alive)
          ? explicitTarget
          : [...living].sort((a, b) => b.atk - a.atk)[0];
        this.playVfx('fxBuffSimpleGold', target.x, target.y - 56, { scale: 2.35 });
        this.playVfx('fx_f4_voidpulse', target.x, target.y - 58, { scale: 1.55, blend: 'lighter' });
        this.spawnLight(target.x, target.y - 56, '#c07aff', 240, 0.72);
        this.spawnShockwave(target.x, target.y - 46, '#ffd966', 130, 0.40, 4);
        this.spawnScreenFlash('#c07aff', 0.20, 0.22);
        this.spawnPopup(target.x, target.y - 136, '⚡ 狂暴双连动!!', '#d39bff', true);
        // Push 2 immediate retrigger actions at front of queue!
        this.turnQueue.unshift({ ...target, _isRetriggerRef: target, alive: true });
        this.turnQueue.unshift({ ...target, _isRetriggerRef: target, alive: true });
      }
    }

    finishBattle(victory) {
      if (this.battleResult) return;
      this.battleResult = {
        victory,
        turnsUsed: this.round,
        peakHit: this.peakHit,
        totalTriggers: this.totalTriggers,
        combatGold: this.combatGold,
        remainingDrinks: this.drinks.filter((d) => !d.used).map((d) => d.id)
      };
      this.finishDelay = 0.95;
    }

    // ─── VFX Helpers & Update ───
    playVfx(key, x, y, opts = {}) {
      if (!window.MT.vfx) return;
      const inst = window.MT.vfx.createInstance(key, x, y, opts);
      if (inst) this.activeVfx.push(inst);
    }
    spawnLight(x, y, color, radius = 165, life = 0.54) {
      this.lights.push({ x, y, color, radius, life, maxLife: life });
    }
    spawnShockwave(x, y, color, maxR = 104, life = 0.38, lineW = 4) {
      this.shockwaves.push({ x, y, color, maxR, life, maxLife: life, lineW });
    }
    spawnScreenFlash(color, alpha = 0.24, life = 0.22) {
      this.screenFlash = { color, alpha, life, maxLife: life };
    }
    shake(amp, dur) {
      this.shakeAmp = Math.max(this.shakeAmp, amp);
      this.shakeTime = Math.max(this.shakeTime, dur);
    }
    spawnPopup(x, y, text, color, big = false) {
      this.popups.push({
        x: x + (Math.random() - 0.5) * 16, y,
        vx: (Math.random() - 0.5) * 26, vy: big ? -88 : -64,
        text, color, big, life: 1.25, maxLife: 1.25
      });
    }
    burstParticles(x, y, color, count = 14) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 70 + Math.random() * 210;
        this.particles.push({
          x, y, px: x, py: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 90,
          size: 4 + (i % 3), color: i % 4 === 0 ? '#fff8de' : color,
          life: 0.42 + Math.random() * 0.36, maxLife: 0.78
        });
      }
    }
    spawnAfterimage(u, tint) {
      this.afterimages.push({
        unitId: u.unitId, anim: u.anim, time: this.time + u.phase,
        x: u.x, y: u.y, scale: u.isBoss ? 2.25 : 1.55, flipX: u.side === 'enemy',
        tint, life: 0.22, maxLife: 0.22
      });
    }
    spawnProjectile(fromX, fromY, toX, toY, color, onArrive) {
      this.projectiles.push({ x: fromX, y: fromY, startX: fromX, startY: fromY, toX, toY, color, elapsed: 0, dur: 0.19, onArrive });
    }

    update(rawDt) {
      let timeScale = this.speed;
      if (this.draggingDrinkIdx >= 0) {
        const d = this.drinks[this.draggingDrinkIdx];
        if (d && !d.used && d.slowMoRemaining > 0) {
          d.slowMoRemaining = Math.max(0, d.slowMoRemaining - rawDt);
          timeScale = 0.25;
          const bar = document.getElementById(`bt-slowmo-${this.draggingDrinkIdx}`);
          if (bar) bar.style.width = `${Math.round((d.slowMoRemaining / 2.0) * 100)}%`;
        }
      }
      if (this.finisherSlow > 0) {
        this.finisherSlow = Math.max(0, this.finisherSlow - rawDt);
        timeScale = 0.28;
      }
      if (this.hitstop > 0) {
        this.hitstop = Math.max(0, this.hitstop - rawDt);
        return;
      }

      const dt = rawDt * timeScale;
      this.time += dt;

      if (this.shakeTime > 0) {
        this.shakeTime = Math.max(0, this.shakeTime - rawDt);
        if (this.shakeTime === 0) this.shakeAmp = 0;
      }
      if (this.screenFlash) {
        this.screenFlash.life -= rawDt;
        if (this.screenFlash.life <= 0) this.screenFlash = null;
      }

      const allU = [...this.allies, ...(this.boss ? [this.boss] : [])];
      for (const u of allU) {
        if (u.flash > 0) u.flash = Math.max(0, u.flash - rawDt);
        if (u.ghostHp > u.hp) u.ghostHp = Math.max(u.hp, u.ghostHp - u.maxHp * 0.65 * rawDt);
        u.knockX *= Math.pow(0.001, rawDt);
        if (Math.abs(u.knockX) < 0.2) u.knockX = 0;
        u.squashX += (1 - u.squashX) * Math.min(1, rawDt * 14);
        u.squashY += (1 - u.squashY) * Math.min(1, rawDt * 14);
      }

      if (this.activeAnim) {
        const aa = this.activeAnim;
        aa.elapsed += dt;
        const p = Math.min(1, aa.elapsed / aa.dur);
        if (aa.isMelee) {
          const prevX = aa.actor.x;
          if (p < 0.22) aa.actor.x = aa.startX + (aa.dashX - aa.startX) * (p / 0.22);
          else if (p < 0.76) aa.actor.x = aa.dashX;
          else aa.actor.x = aa.dashX + (aa.startX - aa.dashX) * ((p - 0.76) / 0.24);
          if (Math.abs(aa.actor.x - prevX) > 4) {
            aa.afterTimer += dt;
            if (aa.afterTimer >= 0.035) {
              aa.afterTimer = 0;
              this.spawnAfterimage(aa.actor, EL_LIGHT_COLORS[aa.actor.element] || '#ffd966');
            }
          }
        }
        if (!aa.hitDone && p >= (aa.isMelee ? 0.45 : 0.32)) {
          aa.hitDone = true;
          if (aa.kind === 'boss') {
            this.playVfx('fx_crossslash', aa.target.x, aa.target.y - 56, { scale: 1.6, flipX: true });
            this.spawnLight(aa.target.x, aa.target.y - 56, '#ff5978', 165, 0.42);
            this.applyAllyDamage(aa.target, aa.dmg);
            if (window.MT.sfx) window.MT.sfx.playHit();
          } else if (aa.isMelee) {
            this.resolveAllyHit(aa.actor, aa.opts);
          } else {
            const pCol = EL_LIGHT_COLORS[aa.actor.element] || '#ffae42';
            this.spawnProjectile(aa.actor.x + 36, aa.actor.y - 60, aa.target.x, aa.target.y - 60, pCol, () => {
              this.resolveAllyHit(aa.actor, aa.opts);
            });
          }
        }
        if (p >= 1) {
          aa.actor.x = aa.startX;
          aa.actor.anim = 'idle';
          this.activeAnim = null;
        }
      }

      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.elapsed += dt;
        const k = Math.min(1, pr.elapsed / pr.dur);
        pr.x = pr.startX + (pr.toX - pr.startX) * k;
        pr.y = pr.startY + (pr.toY - pr.startY) * k - Math.sin(k * Math.PI) * 40;
        this.particles.push({ x: pr.x, y: pr.y, px: pr.x, py: pr.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, size: 4, color: pr.color, life: 0.2, maxLife: 0.2 });
        if (k >= 1) {
          const cb = pr.onArrive;
          this.projectiles.splice(i, 1);
          if (cb) cb();
        }
      }

      if (this.battleResult) {
        this.finishDelay -= rawDt;
        if (this.finishDelay <= 0) {
          const res = this.battleResult;
          const cb = this.onDone;
          this.stop();
          if (cb) cb(res);
        }
      } else if (!this.activeAnim && this.projectiles.length === 0) {
        this.actionTimer -= dt;
        if (this.actionTimer <= 0) this.stepNextTurn();
      }

      for (const m of this.ambientMotes) {
        m.x += (m.vx + Math.sin(this.time * 1.6 + m.phase) * 14) * dt;
        m.y += m.vy * dt;
        if (m.y < 30) { m.y = BRIDGE_Y - 12; m.x = Math.random() * BW; }
        if (m.x < 0) m.x = BW;
        if (m.x > BW) m.x = 0;
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.px = p.x; p.py = p.y; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 380 * dt; p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const pp = this.popups[i];
        pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.vy *= Math.pow(0.08, dt); pp.life -= dt;
        if (pp.life <= 0) this.popups.splice(i, 1);
      }
      for (let i = this.lights.length - 1; i >= 0; i--) {
        this.lights[i].life -= dt;
        if (this.lights[i].life <= 0) this.lights.splice(i, 1);
      }
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        this.shockwaves[i].life -= dt;
        if (this.shockwaves[i].life <= 0) this.shockwaves.splice(i, 1);
      }
      for (let i = this.afterimages.length - 1; i >= 0; i--) {
        this.afterimages[i].life -= dt;
        if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
      }
      if (window.MT.vfx) {
        for (let i = this.activeVfx.length - 1; i >= 0; i--) {
          window.MT.vfx.update(this.activeVfx[i], dt);
          if (this.activeVfx[i].done) this.activeVfx.splice(i, 1);
        }
      }
    }

    // ─── Mirror-Lake Eclipse Backdrop Baking (Identical Masterpiece Visuals!) ───
    getUpperBgCanvas(biome) {
      if (this.bgCache[biome]) return this.bgCache[biome];
      const pal = ECLIPSE_PALETTES[biome] || ECLIPSE_PALETTES.default;
      const c = document.createElement('canvas');
      c.width = VW; c.height = BRIDGE_VY + 8;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const leftSky = ctx.createLinearGradient(0, 0, 0, BRIDGE_VY);
      leftSky.addColorStop(0, '#161638'); leftSky.addColorStop(0.50, '#222b60');
      leftSky.addColorStop(0.82, '#347db0'); leftSky.addColorStop(1, '#68d8f5');
      ctx.fillStyle = leftSky; ctx.fillRect(0, 0, 178, BRIDGE_VY);

      const rightSky = ctx.createLinearGradient(0, 0, 0, BRIDGE_VY);
      rightSky.addColorStop(0, pal.skyTop); rightSky.addColorStop(0.55, pal.skyMid); rightSky.addColorStop(1, pal.skyLow);
      ctx.fillStyle = rightSky; ctx.fillRect(156, 0, VW - 156, BRIDGE_VY);

      this.drawMergedCloudBank(ctx, [[18, 56, 20], [46, 46, 24], [78, 42, 26], [112, 48, 24], [140, 56, 20]], '#3a367d', '#29265e', '#1e1c4a');

      // Giant Unobstructed Black-Hole Solar Eclipse!
      const ex = 232, ey = 38;
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2 + 0.08;
        const len = 30 + (i % 3) * 7 + (i % 2) * 3;
        for (let step = 16; step <= len; step++) {
          const t = (step - 16) / (len - 16);
          const a = ang + 0.34 * t * t;
          const w = Math.max(1, Math.round((1 - t) * 3.5));
          ctx.fillStyle = t < 0.38 ? pal.corona2 : pal.corona1;
          ctx.fillRect(Math.round(ex + Math.cos(a) * step - w / 2), Math.round(ey + Math.sin(a) * step - w / 2), w, w);
        }
      }
      this.drawPixelDisc(ctx, ex, ey, 21, pal.corona2);
      this.drawPixelDisc(ctx, ex, ey, 19, '#fff2f7');
      this.drawPixelDisc(ctx, ex, ey, 16, '#08040e');

      this.drawMergedCloudBank(ctx, [[168, 72, 16], [190, 65, 18], [216, 68, 17], [244, 66, 18], [272, 62, 20], [300, 54, 22], [318, 48, 18]], pal.cloudHi, pal.cloudMid, pal.cloudDark);

      for (const px of [16, 36, 58, 80, 102, 124, 144]) this.drawOutlinedPine(ctx, px, BRIDGE_VY - 10, 32 + Math.floor(hash2(px, 2, 12) * 12), '#143844', '#1f5360');
      for (const px of [8, 28, 48, 70, 92, 114, 134, 150]) this.drawOutlinedPine(ctx, px, BRIDGE_VY - 6, 26 + Math.floor(hash2(px, 5, 19) * 12), '#1d545e', '#2e787e');
      this.drawMergedCloudBank(ctx, [[8, BRIDGE_VY - 7, 14], [30, BRIDGE_VY - 9, 16], [56, BRIDGE_VY - 8, 16], [84, BRIDGE_VY - 10, 18], [112, BRIDGE_VY - 8, 16], [138, BRIDGE_VY - 9, 15]], '#8ef0ff', '#5ccce8', '#3ba4cc');
      ctx.fillStyle = '#70dff5'; ctx.fillRect(0, BRIDGE_VY - 5, 154, 5);

      // Left pitched-roof stone gatehouse & cyan streetlamp
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = '#090712'; ctx.fillRect(0, 52 + i, 12 + i, 2);
        ctx.fillStyle = i % 2 === 0 ? '#2b3454' : '#3d4c78'; ctx.fillRect(0, 52 + i, 10 + i, 1);
      }
      ctx.fillStyle = '#090712'; ctx.fillRect(0, 60, 16, BRIDGE_VY - 60);
      ctx.fillStyle = '#364369'; ctx.fillRect(0, 60, 14, BRIDGE_VY - 60);
      ctx.fillStyle = '#090712'; ctx.fillRect(2, 72, 9, 13);
      ctx.fillStyle = '#9cf4ff'; ctx.fillRect(3, 73, 7, 11);
      drawMatrix(ctx, PROPS.cyanLamp, 38, BRIDGE_VY - 38);

      // Organic black-outlined shattered gothic ruins
      this.drawShatteredRuins(ctx, 158, VW, BRIDGE_VY, pal);
      ctx.save();
      ctx.globalAlpha = 0.42;
      for (let y = 0; y < BRIDGE_VY; y += 2) {
        const sway = Math.round(Math.sin(y * 0.08) * 6 + (BRIDGE_VY - y) * 0.06);
        const w = 14 + Math.round(Math.sin(y * 0.14) * 5);
        ctx.fillStyle = pal.cloudMid; ctx.fillRect(156 + sway - Math.floor(w / 2), y, w, 3);
      }
      ctx.restore();

      this.bgCache[biome] = c;
      return c;
    }

    drawMergedCloudBank(ctx, puffs, colHi, colMid, colDark) {
      for (const [cx, cy, r] of puffs) this.drawPixelDisc(ctx, cx, cy, r, colHi);
      for (const [cx, cy, r] of puffs) this.drawPixelDisc(ctx, cx + 1, cy + 3, Math.max(2, r - 1), colMid);
      for (const [cx, cy, r] of puffs) this.drawPixelDisc(ctx, cx + 2, cy + 7, Math.max(2, r - 2), colDark);
    }
    drawPixelDisc(ctx, cx, cy, r, color) {
      ctx.fillStyle = color;
      const r2 = r * r;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r2) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
    drawOutlinedPine(ctx, cx, baseY, h, colDark, colLit) {
      const tiers = 4, topY = baseY - h;
      for (let t = 0; t < tiers; t++) {
        const ty = topY + Math.floor((t / tiers) * (h * 0.68)), th = Math.floor(h * 0.40), maxW = 5 + t * 3.6;
        for (let row = 0; row < th; row++) {
          const hw = Math.max(1, Math.round((row / th) * maxW));
          ctx.fillStyle = '#090712'; ctx.fillRect(cx - hw - 1, ty + row - 1, hw * 2 + 3, 3);
        }
      }
      for (let t = 0; t < tiers; t++) {
        const ty = topY + Math.floor((t / tiers) * (h * 0.68)), th = Math.floor(h * 0.40), maxW = 5 + t * 3.6;
        for (let row = 0; row < th; row++) {
          const hw = Math.max(1, Math.round((row / th) * maxW));
          ctx.fillStyle = colDark; ctx.fillRect(cx - hw, ty + row, hw * 2 + 1, 1);
          ctx.fillStyle = colLit; ctx.fillRect(cx - hw, ty + row, Math.max(1, Math.floor(hw * 0.72)), 1);
        }
      }
    }
    drawShatteredRuins(ctx, startX, endX, baseY, pal) {
      const mask = new Uint8Array(VW * baseY);
      const setPx = (px, py, val) => { if (px >= startX && px < endX && py >= 0 && py < baseY) mask[py * VW + px] = val; };
      for (let x = startX; x < endX; x++) {
        const h = Math.max(10, Math.round(20 + Math.sin(x * 0.09) * 5 + Math.cos(x * 0.23) * 3 + (Math.floor(x / 5) % 3 === 0 ? 5 : 0)));
        for (let y = baseY - h; y < baseY; y++) setPx(x, y, 1);
      }
      for (const sp of [{ cx: 174, h: 40, w: 6, lean: -1 }, { cx: 196, h: 48, w: 7, lean: 1 }, { cx: 222, h: 36, w: 6, lean: -1 }, { cx: 262, h: 42, w: 7, lean: 1 }, { cx: 294, h: 38, w: 6, lean: -1 }]) {
        for (let dy = 0; dy < sp.h; dy++) {
          const t = dy / sp.h, hw = Math.max(1, Math.round((0.25 + t * 0.75) * (sp.w * 0.55)));
          const ox = sp.cx + Math.round((1 - t) * sp.lean * 2.5);
          for (let dx = -hw; dx <= hw; dx++) setPx(ox + dx, baseY - sp.h + dy, 2);
        }
      }
      for (let y = 1; y < baseY; y++) {
        for (let x = startX; x < endX; x++) {
          const v = mask[y * VW + x]; if (!v) continue;
          const edge = !mask[(y - 1) * VW + x] || x <= startX || !mask[y * VW + (x - 1)] || x >= endX - 1 || !mask[y * VW + (x + 1)];
          ctx.fillStyle = edge ? '#090712' : (!mask[(y - 2) * VW + x] ? pal.ruinHi : (v === 2 ? pal.ruinDark : pal.ruinMid));
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    drawStoneBridge(ctx) {
      const y = BRIDGE_Y, h = LAKE_Y - BRIDGE_Y;
      ctx.fillStyle = '#090712'; ctx.fillRect(0, y - 4, BW, 4);
      const rim = ctx.createLinearGradient(0, 0, BW, 0);
      rim.addColorStop(0, '#c2f7ff'); rim.addColorStop(0.5, '#9ed8f2'); rim.addColorStop(1, '#d8b4c8');
      ctx.fillStyle = rim; ctx.fillRect(0, y, BW, 4);
      ctx.fillStyle = '#474f6e'; ctx.fillRect(0, y + 4, BW, 12);
      ctx.fillStyle = '#2a3047'; ctx.fillRect(0, y + 16, BW, 12);
      for (let bx = 0; bx < BW; bx += 48) {
        ctx.fillStyle = '#141726'; ctx.fillRect(bx, y + 4, 4, 12); ctx.fillRect(bx + 24, y + 16, 4, 12);
      }
      ctx.fillStyle = '#090712'; ctx.fillRect(0, y + h - 4, BW, 4);
    }

    renderUpperWorld(ctx) {
      const { sprites } = window.MT;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, BW, this.sceneBuf.height);
      ctx.drawImage(this.getUpperBgCanvas(this.biome), 0, 0, VW, BRIDGE_VY, 0, 0, BW, BRIDGE_Y);

      const bob1 = Math.round(Math.sin(this.time * 2.4) * 3);
      const bob2 = Math.round(Math.sin(this.time * 2.1 + 1.8) * 3);
      const bob3 = Math.round(Math.sin(this.time * 1.7 + 0.7) * 4);
      ctx.save();
      ctx.scale(4, 4);
      drawMatrix(ctx, PROPS.floatCrystal, 55, 58 + bob1);
      drawMatrix(ctx, PROPS.floatCrystal, 66, 70 - bob2);
      drawMatrix(ctx, PROPS.floatShard, 174, 30 + bob2);
      drawMatrix(ctx, PROPS.floatShard, 195, 24 - bob1);
      drawMatrix(ctx, PROPS.floatShard, 288, 34 + bob3);
      drawMatrix(ctx, PROPS.arcanePrism, 266, 58 + bob3);
      ctx.restore();

      const flicker = 0.88 + Math.sin(this.time * 7.2) * 0.12;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(176, 288, 6, 176, 288, 130);
      lg.addColorStop(0, `rgba(110, 240, 255, ${0.42 * flicker})`); lg.addColorStop(1, 'rgba(40, 140, 255, 0)');
      ctx.fillStyle = lg; ctx.fillRect(40, 150, 270, 260);
      const eg = ctx.createRadialGradient(928, 152, 58, 928, 152, 260);
      eg.addColorStop(0, `rgba(255, 118, 162, ${0.34 * flicker})`); eg.addColorStop(1, 'rgba(140, 30, 80, 0)');
      ctx.fillStyle = eg; ctx.fillRect(660, 0, 540, 410);
      for (const m of this.ambientMotes) {
        ctx.globalAlpha = 0.28 + 0.55 * (0.5 + 0.5 * Math.sin(this.time * 3.2 + m.phase));
        ctx.fillStyle = m.x < 640 ? '#8ef5ff' : '#ffa6c0';
        ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
      }
      ctx.restore();

      for (const ag of this.afterimages) {
        sprites.drawUnit(ctx, ag.unitId, ag.anim, ag.time, ag.x, ag.y, { scale: ag.scale, flipX: ag.flipX, alpha: (ag.life / ag.maxLife) * 0.48, outlineColor: ag.tint });
      }

      const units = [...this.allies, ...(this.boss ? [this.boss] : [])].filter((u) => u.alive);
      for (const u of units) {
        const ux = Math.round(u.x + u.knockX), uy = Math.round(u.y);
        const scale = u.isBoss ? 2.3 : 1.58;
        const isAct = this.activeAnim && this.activeAnim.actor === u && u.anim === 'attack';
        sprites.drawUnit(ctx, u.unitId, u.anim, this.time + u.phase, ux, uy, {
          scale, flipX: u.side === 'enemy', loop: !isAct,
          elapsedOverride: isAct ? this.activeAnim.elapsed : null,
          speedMult: isAct ? this.activeAnim.animSpeedMult : 1,
          squashX: u.squashX, squashY: u.squashY,
          outlineColor: u.flash > 0 ? '#ffffff' : u.freeze > 0 ? '#5ce6ff' : (u.isBoss && u.charging) ? '#ff475b' : null
        });
      }

      for (const pr of this.projectiles) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const pg = ctx.createRadialGradient(pr.x, pr.y, 2, pr.x, pr.y, 38);
        pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.35, pr.color); pg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pg; ctx.fillRect(pr.x - 40, pr.y - 40, 80, 80);
        ctx.restore();
      }
      if (window.MT.vfx) for (const inst of this.activeVfx) window.MT.vfx.draw(ctx, inst);

      if (this.lights.length > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const l of this.lights) {
          const lg2 = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, l.radius);
          lg2.addColorStop(0, l.color); lg2.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = Math.max(0, l.life / l.maxLife) * 0.48;
          ctx.fillStyle = lg2; ctx.beginPath(); ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      for (const sw of this.shockwaves) {
        const p = 1 - Math.max(0, sw.life / sw.maxLife), r = 14 + sw.maxR * (1 - Math.pow(1 - p, 3));
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - p) * 0.88;
        ctx.strokeStyle = sw.color; ctx.lineWidth = Math.max(1.5, sw.lineW * (1 - p * 0.55));
        ctx.beginPath(); ctx.arc(Math.round(sw.x), Math.round(sw.y), r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(2, p.size * 0.8);
        ctx.beginPath(); ctx.moveTo(Math.round(p.px), Math.round(p.py)); ctx.lineTo(Math.round(p.x), Math.round(p.y)); ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    }

    render() {
      const ctx = this.ctx;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (this.shakeTime > 0) {
        ctx.translate(Math.round((Math.random() - 0.5) * this.shakeAmp * 2), Math.round((Math.random() - 0.5) * this.shakeAmp * 2));
      }

      this.renderUpperWorld(this.sceneCtx);
      ctx.drawImage(this.sceneBuf, 0, 0, BW, BRIDGE_Y, 0, 0, BW, BRIDGE_Y);

      // Real-Time Shimmering Mirror Lake Reflection!
      const lakeH = BH - LAKE_Y;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, LAKE_Y, BW, lakeH); ctx.clip();
      for (let sy = 0; sy < lakeH; sy += 4) {
        const srcY = BRIDGE_Y - sy - 4;
        if (srcY < 0) break;
        const ripple = Math.round(Math.sin(sy * 0.085 + this.time * 3.8) * (1.5 + (sy / lakeH) * 2.5));
        ctx.save();
        ctx.translate(ripple, LAKE_Y + sy + 4);
        ctx.scale(1, -1);
        ctx.drawImage(this.sceneBuf, 0, srcY, BW, 4, 0, 0, BW, 4);
        ctx.restore();
      }
      const waterTint = ctx.createLinearGradient(0, LAKE_Y, BW, LAKE_Y);
      waterTint.addColorStop(0, 'rgba(26, 98, 175, 0.28)');
      waterTint.addColorStop(0.55, 'rgba(72, 34, 96, 0.26)');
      waterTint.addColorStop(1, 'rgba(92, 36, 94, 0.30)');
      ctx.fillStyle = waterTint; ctx.fillRect(0, LAKE_Y, BW, lakeH);
      const waterDepth = ctx.createLinearGradient(0, LAKE_Y, 0, BH);
      waterDepth.addColorStop(0, 'rgba(10, 16, 38, 0.14)'); waterDepth.addColorStop(1, 'rgba(6, 7, 20, 0.52)');
      ctx.fillStyle = waterDepth; ctx.fillRect(0, LAKE_Y, BW, lakeH);

      if (this.lights.length > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const l of this.lights) {
          const a = Math.max(0, l.life / l.maxLife);
          for (let r = 0; r < 5; r++) {
            const wy = LAKE_Y + 14 + r * 20;
            const rw = Math.round(l.radius * (0.85 - r * 0.11));
            ctx.globalAlpha = a * (0.45 - r * 0.06);
            ctx.fillStyle = l.color;
            ctx.fillRect(Math.round(l.x - rw / 2 + Math.sin(this.time * 6 + r) * 8), wy, rw, 4);
          }
        }
        ctx.restore();
      }
      ctx.restore();

      this.drawStoneBridge(ctx);

      // Ally HP + Shield + Star bars
      for (const a of this.allies) {
        if (!a.alive) continue;
        const bx = Math.round(a.x + a.knockX - 46), by = Math.round(a.y + 8);
        ctx.fillStyle = '#090712'; ctx.fillRect(bx - 3, by - 3, 98, 15);
        ctx.fillStyle = '#1b1f33'; ctx.fillRect(bx, by, 92, 9);
        ctx.fillStyle = '#fff0cc'; ctx.fillRect(bx, by, Math.round(92 * Math.max(0, a.ghostHp / a.maxHp)), 9);
        const pct = Math.max(0, a.hp / a.maxHp);
        ctx.fillStyle = pct > 0.35 ? '#5ef29b' : '#ff6b7d'; ctx.fillRect(bx, by, Math.round(92 * pct), 9);
        if (a.shield > 0) {
          ctx.fillStyle = '#8ef5ff'; ctx.fillRect(bx, by, Math.min(92, Math.round(92 * (a.shield / a.maxHp))), 3);
        }
        // Star pips
        ctx.fillStyle = '#ffd966'; ctx.font = '900 12px "Noto Sans SC", monospace'; ctx.textAlign = 'center';
        ctx.fillText('★'.repeat(a.stars), Math.round(a.x + a.knockX), by + 24);
      }

      // Boss Charge Telegraph
      if (this.boss && this.boss.alive && this.boss.charging) {
        const bx = Math.round(this.boss.x + this.boss.knockX);
        ctx.fillStyle = '#090712'; ctx.fillRect(bx - 96, 174, 192, 42);
        ctx.fillStyle = '#591627'; ctx.fillRect(bx - 93, 177, 186, 36);
        ctx.fillStyle = '#ffe07d'; ctx.font = '900 14px "Noto Sans SC", monospace'; ctx.textAlign = 'center';
        ctx.fillText('⚠ 蓄力灭世 · 泼火酒打断!', bx, 200);
      }

      // Scale-Pop Floating Damage Numbers
      for (const pp of this.popups) {
        const age = pp.maxLife - pp.life;
        const sc = age < 0.11 ? (0.7 + (age / 0.11) * 0.72) : age < 0.22 ? (1.42 - ((age - 0.11) / 0.11) * 0.42) : 1.0;
        ctx.save();
        ctx.globalAlpha = Math.min(1, pp.life * 1.8);
        ctx.translate(Math.round(pp.x), Math.round(pp.y));
        ctx.scale(sc, sc);
        ctx.font = pp.big ? '900 26px "Noto Sans SC", monospace' : '900 18px "Noto Sans SC", monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = pp.big ? 6 : 4;
        ctx.strokeStyle = '#07040f'; ctx.lineJoin = 'round';
        ctx.strokeText(pp.text, 0, 0);
        ctx.fillStyle = pp.color; ctx.fillText(pp.text, 0, 0);
        ctx.restore();
      }

      if (this.screenFlash) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (this.screenFlash.life / this.screenFlash.maxLife) * this.screenFlash.alpha;
        ctx.fillStyle = this.screenFlash.color; ctx.fillRect(0, 0, BW, BH);
        ctx.restore();
      }
      ctx.restore();
    }

    // ─── DOM Overlays (Top Boss HUD, Live 5-Slot Relic Chain Bar, Bottom Drink Dock) ───
    renderBattleHud() {
      const titleEl = document.getElementById('bt-title');
      if (titleEl && this.waveCfg) {
        titleEl.textContent = `W${this.waveCfg.wave}/8 · 回合 ${this.round}/${MAX_TURNS}`;
      }
      const affixEl = document.getElementById('bt-affix-chip');
      if (affixEl && this.waveCfg) {
        affixEl.textContent = this.waveCfg.affixName;
        affixEl.title = this.waveCfg.affixDesc;
      }
      const bName = document.getElementById('bt-boss-name');
      if (bName && this.boss) bName.textContent = this.boss.name;
      const hpTxt = document.getElementById('bt-boss-hp-text');
      if (hpTxt && this.boss) hpTxt.textContent = `${this.boss.hp.toLocaleString()} / ${this.boss.maxHp.toLocaleString()}`;
      const bar = document.getElementById('bt-boss-hp-bar');
      if (bar && this.boss) {
        const pct = Math.max(0, Math.min(1, this.boss.hp / this.boss.maxHp));
        const lit = Math.ceil(pct * 10);
        let h = '';
        for (let i = 0; i < 10; i++) h += `<i class="bt-boss-seg ${i < lit ? 'on' : ''}"></i>`;
        bar.innerHTML = h;
      }
      const chainEl = document.getElementById('bt-chain-stats');
      if (chainEl) {
        chainEl.textContent = `连锁 ×${this.roundTriggers} · 最高一击 ${this.peakHit.toLocaleString()}${this.combatGold > 0 ? ` · 暴击掉金 +${this.combatGold}G` : ''}`;
      }
    }

    renderRelicBar() {
      const box = document.getElementById('bt-relic-chain');
      if (!box) return;
      let html = '';
      for (let i = 0; i < 5; i++) {
        const r = this.relics[i];
        if (!r) {
          html += `<div class="bt-relic-slot empty" data-ridx="${i}"><span>空</span></div>`;
          continue;
        }
        const sealed = i === this.sealedSlotIdx;
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(r.icon) : null;
        html += `
          <div class="bt-relic-slot filled kind-${r.kind} ${sealed ? 'sealed' : ''}" data-ridx="${i}" style="--rcol:${r.color}" title="${r.name}：${r.desc}">
            ${iconUrl ? `<img src="${iconUrl}" alt="${r.name}" />` : ''}
            <span class="bt-relic-badge">${sealed ? '封印' : r.badge}</span>
            <span class="bt-relic-pop"></span>
          </div>`;
      }
      box.innerHTML = html;
    }

    renderDrinkDock() {
      const dock = document.getElementById('bt-drink-dock');
      if (!dock) return;
      if (this.drinks.length === 0) {
        dock.innerHTML = `<div class="bt-drink-empty">未携带战中特调 · 欣赏秘宝连锁轰炸</div>`;
        return;
      }
      dock.innerHTML = this.drinks.map((d, idx) => {
        const iconUrl = d.duelystIcon && window.MT.vfx ? window.MT.vfx.getIconUrl(d.duelystIcon) : null;
        return `
          <button class="bt-drink-btn ${d.used ? 'used' : ''}" data-didx="${idx}" style="--dcol:${d.color}">
            <div class="bt-vial-bezel">${iconUrl ? `<img class="duelyst-drink-ico md" src="${iconUrl}" alt="${d.name}" />` : ''}</div>
            <div class="bt-drink-meta">
              <div class="bt-drink-head"><strong>${d.name}</strong><span class="bt-drink-tag">${d.short}</span></div>
              <div class="bt-slowmo-track"><i class="bt-slowmo-fill" id="bt-slowmo-${idx}" style="width:${Math.round((d.slowMoRemaining / 2.0) * 100)}%"></i></div>
            </div>
            ${d.used ? '<span class="bt-used-tag">已泼出</span>' : '<span class="bt-ready-gem">◆</span>'}
          </button>`;
      }).join('');

      dock.querySelectorAll('.bt-drink-btn').forEach((btn) => {
        const idx = Number(btn.dataset.didx);
        btn.onpointerdown = (e) => {
          if (this.drinks[idx]?.used || this.battleResult) return;
          e.preventDefault();
          this.draggingDrinkIdx = idx;
          this._downPt = { x: e.clientX, y: e.clientY, moved: false };
        };
      });
    }

    bindPointer() {
      window.addEventListener('pointermove', (e) => {
        if (this.draggingDrinkIdx < 0 || !this._downPt) return;
        if (Math.hypot(e.clientX - this._downPt.x, e.clientY - this._downPt.y) > 14) this._downPt.moved = true;
        const rect = this.canvas.getBoundingClientRect();
        this.dragPos = { x: ((e.clientX - rect.left) / rect.width) * BW, y: ((e.clientY - rect.top) / rect.height) * BH };
      });
      window.addEventListener('pointerup', (e) => {
        if (this.draggingDrinkIdx < 0) return;
        const idx = this.draggingDrinkIdx;
        const d = this.drinks[idx];
        const wasDrag = this._downPt && this._downPt.moved;
        this.draggingDrinkIdx = -1;
        this._downPt = null;
        if (!d || d.used) return;
        if (!wasDrag) { this.throwDrink(idx, null); return; }
        const rect = this.canvas.getBoundingClientRect();
        const cx = ((e.clientX - rect.left) / rect.width) * BW;
        const cy = ((e.clientY - rect.top) / rect.height) * BH;
        const pool = d.target === 'enemy' ? [this.boss].filter((u) => u && u.alive) : this.allies.filter((a) => a.alive);
        const nearest = pool.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
        this.throwDrink(idx, nearest || null);
        this.dragPos = null;
      });
    }
  }

  window.MT.EngineBattle = EngineBattle;
})();
