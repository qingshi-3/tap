// v11.0 4-Round Active-Boss Mirror-Lake Battle Theater
// - Full-bleed 1280x720 (320x180 x 4) Outdoor Mirror-Lake Eclipse with Live Water Reflections
// - 4-Round Turn-Based Poker-Hand Combat: Pick 3 from 5 on Bridge -> Strike -> Left-to-Right Relic Chain -> Active Boss Intent!
// - Active Boss Intents (GPT v11 Fix #1: Charge ONLY on R1/R2!): Heavy Strike, Charge + Break/Stun (+50% Vuln), Arcane Shield, Frost Lock
// - Squad 100 HP + Blue Shield (Tank +28 each, Triangle +25, Striker +25% Break, Ranged +25% Relic Add)
(function () {
  window.MT = window.MT || {};

  const BW = 1280;
  const BH = 720;
  const VW = 320;
  const VH = 180;
  const BRIDGE_VY = 104;
  const BRIDGE_Y = BRIDGE_VY * 4;     // 416px
  const LAKE_Y = (BRIDGE_VY + 8) * 4; // 448px

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

  function drawMatrix(ctx, rows, ox, oy) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const col = PROP_PAL[row[x]];
        if (col) { ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, 1, 1); }
      }
    }
  }

  class V12Battle {
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
      this.cutinTimer = 0;
      this.cutinInfo = null;

      this.phase = 'picking'; // picking | executing | boss_turn | ended
      this.round = 1;
      this.maxRounds = 4;
      this.squadHp = 100;
      this.squadMaxHp = 100;
      this.squadShield = 0;

      this.allies = [];
      this.boss = null;
      this.relics = [];
      this.maxRelicSlots = 5;
      this.bossCfg = null;
      this.runCtx = null;

      // Active Boss Intent State
      this.bossIntent = null; // { kind: 'heavy'|'charge'|'ult'|'shield'|'freeze'|'stunned', dmg, label, desc }
      this.bossBreakProgress = 0;
      this.bossStunnedThisTurn = false;
      this.bossVulnerableTurns = 0;
      this.pendingUltNextTurn = false;
      this.freezeNextHand = false;

      // Turn execution state
      this.handEval = null;
      this.turnQueue = [];
      this.actionTimer = 0;
      this.activeAnim = null;
      this.finishDelay = 0;
      this.battleResult = null;
      this.hitIndex = 0;
      this.peakHit = 0;
      this.totalTriggers = 0;
      this.combatGold = 0;
      this.bestHandName = '散客小队';
      this.bestHandMult = 1;

      this.particles = [];
      this.popups = [];
      this.projectiles = [];
      this.activeVfx = [];
      this.lights = [];
      this.shockwaves = [];
      this.afterimages = [];
      this.ambientMotes = [];
      this._timers = [];

      this.onRoundReady = null;
      this.onDone = null;
    }

    setSpeed(mult) { this.speed = mult >= 2 ? 2 : 1; }
    clearTimers() { for (const id of this._timers) clearTimeout(id); this._timers = []; }
    later(ms, fn) {
      const id = setTimeout(() => { if (this.running) fn(); }, Math.max(15, Math.round(ms / this.speed)));
      this._timers.push(id);
    }

    // ─── Initialize a New Wave Encounter (Opens directly into Round 1 Picking!) ───
    startWave({ bossCfg, relics, maxRelicSlots, runCtx, onRoundReady, onDone }) {
      const D = window.MT.V12_DATA;
      this.clearTimers();
      if (this.atmosphere) this.atmosphere.dispose();
      this.atmosphere = window.MT.V13BattleAtmosphere ? window.MT.V13BattleAtmosphere.create() : null;
      this.bossCfg = bossCfg;
      this.runCtx = runCtx;
      this.relics = relics.map((r, idx) => ({ ...r, slotIdx: idx }));
      this.maxRelicSlots = maxRelicSlots || 5;
      this.onRoundReady = onRoundReady;
      this.onDone = onDone;

      this.biome = bossCfg.wave % 3 === 0 ? 'ice' : bossCfg.wave % 2 === 0 ? 'dark' : 'default';
      this.time = 0;
      this.hitstop = 0;
      this.shakeTime = 0;
      this.finisherSlow = 0;
      this.screenFlash = null;
      this.cutinTimer = 0;
      this.cutinInfo = null;

      this.phase = 'picking';
      this.round = 1;
      this.maxRounds = D.MAX_ROUNDS;
      this.squadMaxHp = D.SQUAD_MAX_HP;
      this.squadHp = D.SQUAD_MAX_HP;
      this.squadShield = 0;

      this.allies = [];
      this.turnQueue = [];
      this.activeAnim = null;
      this.finishDelay = 0;
      this.battleResult = null;
      this.hitIndex = 0;
      this.peakHit = 0;
      this.totalTriggers = 0;
      this.combatGold = 0;
      this.bestHandName = '散客小队';
      this.bestHandMult = 1;

      this.bossBreakProgress = 0;
      this.bossStunnedThisTurn = false;
      this.bossVulnerableTurns = 0;
      this.pendingUltNextTurn = false;
      this.freezeNextHand = false;

      this.particles = [];
      this.popups = [];
      this.projectiles = [];
      this.activeVfx = [];
      this.lights = [];
      this.shockwaves = [];
      this.afterimages = [];
      this.ambientMotes = Array.from({ length: 24 }, (_, i) => ({
        x: Math.random() * BW, y: 60 + Math.random() * 340,
        vx: (Math.random() - 0.5) * 18, vy: -10 - Math.random() * 14,
        phase: i * 1.15, size: 4
      }));

      this.boss = {
        ...bossCfg,
        side: 'enemy',
        isBoss: true,
        scale: 2.38,
        hp: bossCfg.maxHp,
        maxHp: bossCfg.maxHp,
        ghostHp: bossCfg.maxHp,
        shield: 0,
        alive: true,
        x: 965, homeX: 965, y: BRIDGE_Y,
        knockX: 0, flash: 0, squashX: 1, squashY: 1, anim: 'idle', phase: 0.6
      };

      this.prepareRoundIntent();
      this.running = true;
      this.renderRelicBar();
      this.renderBattleHud();

      this.lastTs = performance.now();
      this.loop(this.lastTs);
    }

    stop() {
      if (this.atmosphere) this.atmosphere.dispose();
      this.running = false;
      this.clearTimers();
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    }

    // ─── Compute Boss Intent for Current Round (GPT Fix #1: Charge ONLY on R1 or R2!) ───
    prepareRoundIntent() {
      this.bossStunnedThisTurn = false;
      this.bossBreakProgress = 0;

      if (this.pendingUltNextTurn) {
        this.pendingUltNextTurn = false;
        this.bossIntent = {
          kind: 'ult',
          dmg: this.bossCfg.ultDmg,
          label: `💀 灭世降临! ${this.bossCfg.ultDmg} 巨伤`,
          short: `💀 灭世 ${this.bossCfg.ultDmg}伤`,
          color: '#ff477e'
        };
        return;
      }

      const pattern = this.bossCfg.pattern || ['heavy', 'charge', 'heavy', 'heavy'];
      let kind = pattern[(this.round - 1) % pattern.length];
      // Strictly enforce GPT Fix #1: NEVER start Charge on Round 3 or Round 4!
      if (kind === 'charge' && this.round >= 3) kind = 'heavy';

      if (kind === 'charge') {
        this.bossIntent = {
          kind: 'charge',
          dmg: 0,
          ultDmg: this.bossCfg.ultDmg,
          breakNeed: this.bossCfg.breakThreshold,
          label: `🔥 灭世蓄力 · 打 ${this.bossCfg.breakThreshold} 伤破招!`,
          short: `🔥 蓄力(破招${this.bossCfg.breakThreshold})`,
          color: '#ff9a2e'
        };
      } else if (kind === 'shield') {
        const sdmg = Math.round(this.bossCfg.heavyDmg * 0.62);
        this.bossIntent = {
          kind: 'shield',
          dmg: sdmg,
          shieldGain: this.bossCfg.shieldGain,
          label: `🛡 镜渊魔盾 +${this.bossCfg.shieldGain}盾 · 击 ${sdmg}伤`,
          short: `🛡 魔盾 & ${sdmg}伤`,
          color: '#6be5ff'
        };
      } else if (kind === 'freeze') {
        const fdmg = Math.round(this.bossCfg.heavyDmg * 0.68);
        this.bossIntent = {
          kind: 'freeze',
          dmg: fdmg,
          label: `❄ 霜锁右牌 · 击 ${fdmg}伤`,
          short: `❄ 霜锁 & ${fdmg}伤`,
          color: '#8ef0ff'
        };
      } else {
        this.bossIntent = {
          kind: 'heavy',
          dmg: this.bossCfg.heavyDmg,
          label: `⚔ 裂空重击 · ${this.bossCfg.heavyDmg} 伤`,
          short: `⚔ 重击 ${this.bossCfg.heavyDmg}伤`,
          color: '#ff667d'
        };
      }
    }

    // ─── Preview Selected 0..3 Heroes Live on the Stone Bridge while Picking! ───
    previewSelectedHeroes(selectedList) {
      if (this.phase !== 'picking') return;
      const D = window.MT.V12_DATA;
      const xs = [215, 360, 500];
      this.allies = (selectedList || []).slice(0, 3).map((h, i) => ({
        ...h,
        slotIdx: i,
        side: 'ally',
        isFusion: false,
        scale: 1.54,
        alive: true,
        x: xs[i], homeX: xs[i], y: BRIDGE_Y,
        knockX: 0, flash: 0.08, squashX: 0.92, squashY: 1.08, anim: 'idle', phase: i * 1.1,
        factionColor: D.FACTIONS[h.faction].color
      }));
    }

    // ─── Execute Player's Chosen 3-Hero Hand Strike! ───
    executeHand({ squad3, handEval, runCtx }) {
      if (this.phase !== 'picking' || !this.boss || !this.boss.alive) return;
      const D = window.MT.V12_DATA;
      this.phase = 'executing';
      this.handEval = handEval;
      this.runCtx = runCtx;

      if (handEval.mult >= this.bestHandMult) {
        this.bestHandMult = handEval.mult;
        this.bestHandName = handEval.hand.name;
      }

      // 1. Grant Squad Shield immediately from Tank heroes + Hand Shield Bonus!
      this.squadShield = handEval.shield || 0;
      if (this.squadShield > 0) {
        this.playVfx('fxDistortionHexShield', 360, BRIDGE_Y - 58, { scale: 2.1 });
        this.spawnPopup(360, BRIDGE_Y - 132, `🛡 小队护盾 +${this.squadShield}`, '#6be5ff', true);
      }

      // 2. Build Active Bridge Heroes (with 三尊合体 Giant Fusion!)
      const isFusion = handEval.hand && handEval.hand.fusion;
      if (isFusion) {
        const base = squad3[0];
        this.allies = [{
          ...base,
          slotIdx: 0, side: 'ally', isFusion: true, scale: 2.25,
          atk: Math.round(squad3.reduce((s, h) => s + h.atk, 0) * 1.15),
          redSeal: squad3.some((h) => h.redSeal),
          alive: true, x: 350, homeX: 350, y: BRIDGE_Y,
          knockX: 0, flash: 0, squashX: 1, squashY: 1, anim: 'idle', phase: 0,
          factionColor: D.FACTIONS[base.faction].color
        }];
      } else {
        const xs = [215, 360, 500];
        this.allies = squad3.map((h, i) => ({
          ...h, slotIdx: i, side: 'ally', isFusion: false, scale: 1.56,
          alive: true, x: xs[i], homeX: xs[i], y: BRIDGE_Y,
          knockX: 0, flash: 0, squashX: 1, squashY: 1, anim: 'idle', phase: i * 1.2,
          factionColor: D.FACTIONS[h.faction].color
        }));
      }

      // 3. Opening Hand Combo Cut-In + Faction Blast
      this.cutinInfo = {
        name: handEval.hand.name, lv: handEval.lv, mult: handEval.mult,
        perk: handEval.hand.perk, color: handEval.hand.color, glow: handEval.hand.glow
      };
      this.cutinTimer = 1.35;
      if (window.MT.sfx) window.MT.sfx.playChainDing(handEval.hand.baseMult >= 2.3 ? 5 : 2, handEval.hand.baseMult >= 2.3);

      if (handEval.hand.factionBlast && handEval.faction) {
        const fac = handEval.faction;
        this.later(260, () => {
          if (!this.boss || !this.boss.alive) return;
          this.playVfx(fac.flushVfx, this.boss.x, this.boss.y - 78, { scale: 2.4 });
          this.playVfx(fac.altVfx, this.boss.x - 85, this.boss.y - 68, { scale: 1.9 });
          this.spawnLight(this.boss.x, this.boss.y - 74, fac.color, 300, 0.65);
          this.spawnShockwave(this.boss.x, this.boss.y - 64, fac.color, 250, 7);
          this.screenFlash = { color: fac.color, alpha: 0.4, life: 0.3, maxLife: 0.3 };
          this.shake(13, 0.3);
          const blastDmg = Math.round((handEval.bonus + 70) * handEval.mult);
          this.applyBossDamage(blastDmg, `${fac.name}大招 -${blastDmg}`, fac.color, true, 1.0);
        });
      } else if (isFusion) {
        this.later(260, () => {
          const champ = this.allies[0];
          if (!champ) return;
          this.playVfx('fx_f1_holyimmolation', champ.x, champ.y - 64, { scale: 2.2 });
          this.spawnShockwave(champ.x, champ.y - 64, '#ff7be5', 200, 6);
          this.spawnPopup(champ.x, champ.y - 156, '★ 三尊合体 战神降临! ★', '#ffd966', true);
        });
      }

      // 4. Enqueue This Hand's Hero Strikes (Red Seal = 2x, 连斩秘印 = Slot 0 2x) + Boss Counter Turn!
      this.turnQueue = [];
      const hasSlot0Double = this.relics.some((r) => r.tpl && r.tpl.extraActSlot === 0);
      for (const a of this.allies) {
        this.turnQueue.push({ kind: 'ally', actor: a, tag: '' });
        if (a.redSeal) this.turnQueue.push({ kind: 'ally', actor: a, tag: '◈红印再动!' });
        if (hasSlot0Double && a.slotIdx === 0) this.turnQueue.push({ kind: 'ally', actor: a, tag: '⚡连斩秘印!' });
      }
      this.turnQueue.push({ kind: 'boss_end' });

      this.actionTimer = handEval.hand.factionBlast ? 0.56 : 0.34;
      this.renderBattleHud();
    }

    stepNextAction() {
      if (this.battleResult || !this.boss || !this.boss.alive) return;
      if (this.turnQueue.length === 0) return;

      const next = this.turnQueue.shift();
      if (next.kind === 'boss_end') {
        this.runBossEndOfTurn();
        return;
      }

      const actor = next.actor;
      if (!actor) { this.actionTimer = 0.05; return; }
      const sprites = window.MT.sprites;
      const dur = sprites.getAttackDurationSec(actor.unitId);
      const speedMult = sprites.getAttackSpeedMult(actor.unitId, dur);
      const isMelee = actor.role !== 'ranged';
      actor.anim = 'attack';
      if (next.tag) this.spawnPopup(actor.x, actor.y - 128, next.tag, '#ffd966', false);

      this.activeAnim = {
        kind: 'ally',
        actor,
        target: this.boss,
        isMelee,
        startX: actor.homeX,
        dashX: this.boss.x - 138,
        elapsed: 0,
        dur,
        animSpeedMult: speedMult,
        afterTimer: 0,
        hitDone: false
      };
    }

    // ─── Resolve Ally Hit through Left-to-Right Relic Pipeline ───
    resolveAllyHit(actor) {
      if (!this.boss || !this.boss.alive) return;
      const D = window.MT.V12_DATA;
      this.hitIndex++;

      const hasRanged = this.allies.some((a) => a.role === 'ranged');
      const addBoost = hasRanged ? 1.25 : 1.0; // Ranged role perk: +25% Relic additive damage!

      const effAtk = Math.round(actor.atk * (actor.boxMult || 1));
      let dmg = Math.round((effAtk + Math.round(this.handEval.bonus * 0.38)) * this.handEval.mult);
      if (this.handEval.hand && this.handEval.hand.twinSlash) dmg = Math.round(dmg * 1.15);

      const evalCtx = {
        attacker: actor,
        slotIdx: actor.slotIdx,
        hitIndex: this.hitIndex,
        handId: this.handEval.hand ? this.handEval.hand.id : 'high_card',
        bossHpRatio: this.boss.hp / this.boss.maxHp,
        bossShield: this.boss.shield,
        bossCharging: this.bossIntent && this.bossIntent.kind === 'charge' && !this.bossStunnedThisTurn,
        bossStunned: this.bossStunnedThisTurn || this.bossVulnerableTurns > 0,
        squadShield: this.squadShield,
        gold: this.runCtx.gold,
        discardsLeft: this.runCtx.discardsLeft,
        rosterSize: this.runCtx.rosterSize,
        relicCount: this.relics.length,
        wave: this.runCtx.wave
      };

      const events = [];
      let prevTpl = null;
      for (let i = 0; i < this.relics.length; i++) {
        const inst = this.relics[i];
        const tpl = inst.tpl;
        if (!tpl) continue;
        let activeTpl = tpl;
        if (tpl.isCopyLeft && prevTpl && !prevTpl.isCopyLeft) activeTpl = prevTpl;
        prevTpl = activeTpl;

        const out = activeTpl.onHit ? activeTpl.onHit(evalCtx) : null;
        const ed = D.EDITIONS[inst.edition] || D.EDITIONS.normal;
        let triggered = false;
        const labelParts = [];
        let isMult = false;
        let fxKey = null;
        let shakeAmt = 0;

        if (out) {
          triggered = true;
          if (out.add) {
            const boosted = Math.round(out.add * addBoost);
            dmg += boosted;
            labelParts.push(out.label || `+${boosted}`);
          }
          if (out.mult) { dmg = Math.round(dmg * out.mult); labelParts.push(out.label || `×${out.mult}`); isMult = true; }
          if (out.fx) fxKey = out.fx;
          if (out.shake) shakeAmt = out.shake;
          if (out.bonusGold) this.combatGold += out.bonusGold;
          if (out.addShield) { this.squadShield += out.addShield; }
        }
        if (ed.addDmg > 0) { triggered = true; dmg += ed.addDmg; labelParts.push(`✦+${ed.addDmg}`); }
        if (ed.multDmg > 1) { triggered = true; dmg = Math.round(dmg * ed.multDmg); labelParts.push(`◈×${ed.multDmg}`); isMult = true; }

        if (triggered) {
          events.push({ slotIdx: i, label: labelParts.join(' '), isMult, fxKey: fxKey || (isMult ? tpl.vfx : null), shakeAmt, edition: inst.edition });
        }
      }

      // Vulnerable (+50% dmg if Boss was Break-Stunned!)
      if (this.bossStunnedThisTurn || this.bossVulnerableTurns > 0) {
        dmg = Math.round(dmg * 1.5);
      }

      this.playVfx(actor.vfx || 'fx_crossslash', this.boss.x, this.boss.y - 62, { scale: actor.isFusion ? 2.2 : 1.65 });
      this.spawnLight(this.boss.x, this.boss.y - 62, actor.factionColor || '#ffd966', 180, 0.4);
      if (window.MT.sfx) window.MT.sfx.playHit();

      events.forEach((ev, step) => {
        this.totalTriggers++;
        this.later(step * 80, () => {
          this.flashRelicSlot(ev.slotIdx, ev.label, ev.isMult, ev.edition);
          if (window.MT.sfx) window.MT.sfx.playChainDing(step + 1, ev.isMult);
          if (ev.fxKey && this.boss) {
            this.playVfx(ev.fxKey, this.boss.x + (Math.random() - 0.5) * 70, this.boss.y - 56 - Math.random() * 44, { scale: ev.isMult ? 2.0 : 1.6 });
            this.spawnLight(this.boss.x, this.boss.y - 64, ev.isMult ? '#ff7be5' : '#ffd966', ev.isMult ? 220 : 165, 0.4);
          }
          if (ev.shakeAmt) this.shake(ev.shakeAmt, 0.22);
        });
      });

      const breakMult = actor.role === 'striker' ? 1.25 : 1.0; // Striker role perk: +25% Break!
      const isBig = dmg >= 320 || events.some((e) => e.isMult);
      this.applyBossDamage(dmg, `-${dmg.toLocaleString()}`, isBig ? '#ffe066' : '#ffffff', isBig, breakMult);
      this.actionTimer = Math.max(0.24, 0.30 + events.length * 0.055);
    }

    applyBossDamage(dmg, text, color, isBig, breakMult = 1.0) {
      if (!this.boss || !this.boss.alive) return;

      // Absorb into Boss Blue Shield first if present
      let hpDmg = dmg;
      if (this.boss.shield > 0) {
        const absorbed = Math.min(this.boss.shield, hpDmg);
        this.boss.shield -= absorbed;
        hpDmg -= absorbed;
        if (this.boss.shield === 0) {
          this.spawnPopup(this.boss.x, this.boss.y - 160, '💥 破盾!', '#6be5ff', true);
        }
      }

      this.boss.hp = Math.max(0, this.boss.hp - hpDmg);
      this.boss.flash = 0.14;
      this.boss.knockX = 16;
      this.boss.squashX = 0.84;
      this.boss.squashY = 1.18;
      if (dmg > this.peakHit) this.peakHit = dmg;
      this.spawnPopup(this.boss.x + (Math.random() - 0.5) * 60, this.boss.y - 125, text, color, isBig);
      this.burstParticles(this.boss.x, this.boss.y - 64, color, isBig ? 22 : 12, isBig ? 340 : 220);

      // Check Charge Break Threshold!
      if (this.bossIntent && this.bossIntent.kind === 'charge' && !this.bossStunnedThisTurn && this.boss.hp > 0) {
        this.bossBreakProgress += Math.round(dmg * breakMult);
        if (this.bossBreakProgress >= this.bossIntent.breakNeed) {
          this.bossStunnedThisTurn = true;
          this.bossVulnerableTurns = 1;
          this.bossIntent = { kind: 'stunned', dmg: 0, label: '💫 破招眩晕! · 易伤 +50%', short: '💫 眩晕易伤+50%', color: '#ffd966' };
          this.playVfx('fxExplosionBigWhiteHot', this.boss.x, this.boss.y - 72, { scale: 2.3 });
          this.spawnShockwave(this.boss.x, this.boss.y - 64, '#ffd966', 250, 7);
          this.screenFlash = { color: '#fff2a6', alpha: 0.45, life: 0.3, maxLife: 0.3 };
          this.hitstop = 0.08;
          this.shake(15, 0.32);
          this.spawnPopup(this.boss.x, this.boss.y - 172, '💥 破招眩晕! 易伤+50%!', '#ffd966', true);
          if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
        }
      }

      if (isBig) {
        this.hitstop = Math.max(this.hitstop, 0.05);
        this.shake(10, 0.22);
        this.spawnShockwave(this.boss.x, this.boss.y - 60, color, 170, 5);
      }
      this.renderBattleHud();

      if (this.boss.hp <= 0) {
        this.boss.alive = false;
        this.finisherSlow = 0.52;
        this.playVfx('fxExplosionBigWhiteHot', this.boss.x, this.boss.y - 70, { scale: 2.6 });
        this.playVfx('fx_f2_heavenseclipse', this.boss.x, this.boss.y - 70, { scale: 2.2 });
        this.spawnShockwave(this.boss.x, this.boss.y - 65, '#ffd966', 320, 8);
        this.screenFlash = { color: '#fff3c4', alpha: 0.65, life: 0.45, maxLife: 0.45 };
        this.shake(18, 0.45);
        this.spawnPopup(this.boss.x, this.boss.y - 155, '★ 讨伐成功! ★', '#ffd966', true);
        if (window.MT.sfx) window.MT.sfx.playChainDing(7, true);
        this.finishBattle(true, 'boss_slain');
      }
    }

    // ─── Active Boss End-of-Turn Action! ───
    runBossEndOfTurn() {
      if (this.battleResult || !this.boss || !this.boss.alive) return;
      this.phase = 'boss_turn';
      const intent = this.bossIntent;

      // Stunned: skips attack!
      if (!intent || intent.kind === 'stunned') {
        this.spawnPopup(this.boss.x, this.boss.y - 140, '💫 Boss 眩晕跳过回合!', '#ffd966', true);
        this.later(620, () => this.finishRoundTransition());
        return;
      }

      // Unbroken Charge: locks in devastating Ultimate for NEXT turn!
      if (intent.kind === 'charge') {
        this.pendingUltNextTurn = true;
        this.playVfx('fx_f4_doom', this.boss.x, this.boss.y - 72, { scale: 2.1 });
        this.spawnLight(this.boss.x, this.boss.y - 72, '#ff477e', 250, 0.55);
        this.shake(10, 0.28);
        this.spawnPopup(this.boss.x, this.boss.y - 155, `⚠ 蓄力完成! 下回合 ${intent.ultDmg} 巨伤!`, '#ff5277', true);
        this.later(760, () => this.finishRoundTransition());
        return;
      }

      // Boss attacks or casts Shield / Freeze!
      const sprites = window.MT.sprites;
      const dur = sprites.getAttackDurationSec(this.boss.unitId);
      const speedMult = sprites.getAttackSpeedMult(this.boss.unitId, dur);
      this.boss.anim = 'attack';
      this.activeAnim = {
        kind: 'boss',
        actor: this.boss,
        isMelee: false,
        startX: this.boss.homeX,
        dashX: this.boss.homeX - 75,
        elapsed: 0,
        dur,
        animSpeedMult: speedMult,
        hitDone: false,
        intent
      };
    }

    resolveBossActionImpact(intent) {
      const targetX = 360;
      const targetY = BRIDGE_Y - 58;

      if (intent.kind === 'shield') {
        this.boss.shield += intent.shieldGain;
        this.playVfx('fxDistortionHexShield', this.boss.x, this.boss.y - 68, { scale: 2.2 });
        this.spawnPopup(this.boss.x, this.boss.y - 155, `🛡 魔盾 +${intent.shieldGain}`, '#6be5ff', true);
      }
      if (intent.kind === 'freeze') {
        this.freezeNextHand = true;
        this.playVfx('fxFrozenIceBlock', targetX, targetY, { scale: 2.1 });
        this.spawnPopup(targetX, targetY - 82, '❄ 霜锁下回合右侧手牌!', '#8ef0ff', true);
      }

      const rawDmg = intent.dmg || 0;
      if (rawDmg > 0) {
        const isUlt = intent.kind === 'ult';
        this.playVfx(isUlt ? 'fx_f2_heavenseclipse' : (this.boss.vfx || 'fx_crossslash'), targetX, targetY, { scale: isUlt ? 2.6 : 1.9, flipX: true });
        this.spawnLight(targetX, targetY, isUlt ? '#ff3366' : '#ff667d', isUlt ? 280 : 190, 0.5);
        this.shake(isUlt ? 16 : 9, isUlt ? 0.38 : 0.22);
        if (isUlt) this.screenFlash = { color: '#ff3366', alpha: 0.42, life: 0.32, maxLife: 0.32 };
        if (window.MT.sfx) window.MT.sfx.playHit();

        const blocked = Math.min(this.squadShield, rawDmg);
        const hpLoss = Math.max(0, rawDmg - blocked);
        this.squadShield = Math.max(0, this.squadShield - blocked);
        this.squadHp = Math.max(0, this.squadHp - hpLoss);

        for (const a of this.allies) { a.flash = 0.14; a.knockX = -14; }
        if (blocked > 0 && hpLoss === 0) {
          this.spawnPopup(targetX, targetY - 58, `🛡 完美格挡 ${blocked} 伤!`, '#6be5ff', true);
        } else if (blocked > 0) {
          this.spawnPopup(targetX, targetY - 58, `盾挡${blocked} · 生命 -${hpLoss}`, '#ff8a9c', true);
        } else {
          this.spawnPopup(targetX, targetY - 58, `小队重创 -${hpLoss} HP!`, '#ff4766', true);
        }
        this.renderBattleHud();

        if (this.squadHp <= 0) {
          this.spawnPopup(targetX, targetY - 115, '小队阵亡!', '#ff4766', true);
          this.finishBattle(false, 'squad_wiped');
          return;
        }
      }

      this.later(620, () => this.finishRoundTransition());
    }

    finishRoundTransition() {
      if (this.battleResult) return;
      if (this.round >= this.maxRounds) {
        this.spawnPopup(640, 260, '4 回合耗尽 · 讨伐失败!', '#ff667d', true);
        this.finishBattle(false, 'out_of_rounds');
        return;
      }

      this.round++;
      this.squadShield = 0; // Shield resets cleanly at start of new round
      if (this.bossVulnerableTurns > 0 && !this.bossStunnedThisTurn) {
        this.bossVulnerableTurns = Math.max(0, this.bossVulnerableTurns - 1);
      }
      this.prepareRoundIntent();
      this.phase = 'picking';
      this.allies = [];
      this.renderBattleHud();
      if (this.onRoundReady) this.onRoundReady({ round: this.round, freezeRight: this.freezeNextHand });
      this.freezeNextHand = false;
    }

    finishBattle(win, reason) {
      if (this.battleResult) return;
      this.phase = 'ended';
      const bossDamagePct = Math.max(0, Math.min(1, 1 - (this.boss ? this.boss.hp / this.boss.maxHp : 0)));
      const handsSaved = win ? Math.max(0, this.maxRounds - this.round) : 0;
      this.battleResult = {
        win, reason,
        wave: this.bossCfg.wave,
        bossName: this.bossCfg.name,
        bossDamagePct,
        roundsUsed: this.round,
        handsSaved,
        peakHit: this.peakHit,
        totalTriggers: this.totalTriggers,
        combatGold: this.combatGold,
        handName: this.bestHandName,
        handMult: this.bestHandMult
      };
      this.finishDelay = win ? 1.2 : 0.95;
    }

    flashRelicSlot(slotIdx, label, isMult, edition) {
      const slot = document.querySelector(`#bt-relic-chain .bt-relic-slot[data-ridx="${slotIdx}"]`);
      if (!slot) return;
      slot.classList.remove('pop-add', 'pop-mult');
      void slot.offsetWidth;
      slot.classList.add(isMult ? 'pop-mult' : 'pop-add');
      const popEl = slot.querySelector('.bt-relic-pop');
      if (popEl) {
        popEl.textContent = label;
        popEl.className = `bt-relic-pop show ${isMult ? 'mult' : 'add'} ${edition === 'polychrome' ? 'poly' : ''}`;
      }
      setTimeout(() => {
        slot.classList.remove('pop-add', 'pop-mult');
        if (popEl) popEl.classList.remove('show');
      }, 600);
    }

    // ─── VFX Helpers ───
    playVfx(key, x, y, opts = {}) {
      if (!window.MT.vfx) return;
      const inst = window.MT.vfx.createInstance(key, x, y, opts);
      if (inst) this.activeVfx.push(inst);
    }
    spawnLight(x, y, color, radius, life) { this.lights.push({ x, y, color, radius, life, maxLife: life }); }
    spawnShockwave(x, y, color, maxR, lineW = 4) { this.shockwaves.push({ x, y, color, maxR, lineW, life: 0.42, maxLife: 0.42 }); }
    spawnAfterimage(u, tint) { this.afterimages.push({ unitId: u.unitId, anim: u.anim, time: this.time + u.phase, x: u.x, y: u.y, scale: u.scale || 1.56, flipX: u.side === 'enemy', tint, life: 0.22, maxLife: 0.22 }); }
    shake(amp, dur) { this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeTime = Math.max(this.shakeTime, dur); }
    spawnPopup(x, y, text, color, big = false) {
      this.popups.push({ x, y, text, color, big, vx: (Math.random() - 0.5) * 32, vy: big ? -88 : -64, life: big ? 1.15 : 0.85, maxLife: big ? 1.15 : 0.85 });
    }
    burstParticles(x, y, color, count, speed) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.35 + Math.random() * 0.65) * speed;
        this.particles.push({ x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 95, size: 3 + Math.random() * 4, color, life: 0.35 + Math.random() * 0.25, maxLife: 0.6 });
      }
    }
    spawnProjectile(startX, startY, toX, toY, color, onArrive) {
      this.projectiles.push({ startX, startY, toX, toY, x: startX, y: startY, color, elapsed: 0, dur: 0.22, onArrive });
    }

    // ─── RAF Loop ───
    loop(ts) {
      if (!this.running) return;
      const rawDt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
      this.lastTs = ts;
      this.update(rawDt);
      this.render();
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    }

    update(rawDt) {
      const slowMult = this.finisherSlow > 0 ? 0.32 : 1.0;
      if (this.finisherSlow > 0) this.finisherSlow = Math.max(0, this.finisherSlow - rawDt);
      if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - rawDt);
      if (this.cutinTimer > 0) this.cutinTimer = Math.max(0, this.cutinTimer - rawDt);
      if (this.screenFlash) { this.screenFlash.life -= rawDt; if (this.screenFlash.life <= 0) this.screenFlash = null; }
      if (this.hitstop > 0) { this.hitstop -= rawDt; return; }

      const dt = rawDt * this.speed * slowMult;
      this.time += dt;

      for (const u of [...this.allies, this.boss].filter(Boolean)) {
        if (u.flash > 0) u.flash = Math.max(0, u.flash - rawDt);
        u.knockX *= Math.pow(0.001, rawDt);
        if (u.ghostHp !== undefined) u.ghostHp += (u.hp - u.ghostHp) * Math.min(1, rawDt * 6);
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
            if (aa.afterTimer >= 0.035) { aa.afterTimer = 0; this.spawnAfterimage(aa.actor, aa.actor.factionColor || '#ffd966'); }
          }
        }
        if (!aa.hitDone && p >= (aa.isMelee ? 0.44 : 0.34)) {
          aa.hitDone = true;
          if (aa.kind === 'boss') {
            this.resolveBossActionImpact(aa.intent);
          } else if (aa.isMelee) {
            this.resolveAllyHit(aa.actor);
          } else {
            this.spawnProjectile(aa.actor.x + 36, aa.actor.y - 60, aa.target.x, aa.target.y - 60, aa.actor.factionColor || '#ffd966', () => {
              this.resolveAllyHit(aa.actor);
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
        pr.y = pr.startY + (pr.toY - pr.startY) * k - Math.sin(k * Math.PI) * 42;
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
      } else if (this.phase === 'executing' && !this.activeAnim && this.projectiles.length === 0) {
        this.actionTimer -= dt;
        if (this.actionTimer <= 0) this.stepNextAction();
      }

      for (const m of this.ambientMotes) {
        m.x += (m.vx + Math.sin(this.time * 1.6 + m.phase) * 14) * dt;
        m.y += m.vy * dt;
        if (m.y < 30) { m.y = BRIDGE_Y - 12; m.x = Math.random() * BW; }
        if (m.x < 0) m.x = BW;
        if (m.x > BW) m.x = 0;
      }
      for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.px = p.x; p.py = p.y; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 380 * dt; p.life -= dt; if (p.life <= 0) this.particles.splice(i, 1); }
      for (let i = this.popups.length - 1; i >= 0; i--) { const pp = this.popups[i]; pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.vy *= Math.pow(0.08, dt); pp.life -= dt; if (pp.life <= 0) this.popups.splice(i, 1); }
      for (let i = this.lights.length - 1; i >= 0; i--) { this.lights[i].life -= dt; if (this.lights[i].life <= 0) this.lights.splice(i, 1); }
      for (let i = this.shockwaves.length - 1; i >= 0; i--) { this.shockwaves[i].life -= dt; if (this.shockwaves[i].life <= 0) this.shockwaves.splice(i, 1); }
      for (let i = this.afterimages.length - 1; i >= 0; i--) { this.afterimages[i].life -= dt; if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1); }
      if (window.MT.vfx) {
        for (let i = this.activeVfx.length - 1; i >= 0; i--) {
          window.MT.vfx.update(this.activeVfx[i], dt);
          if (this.activeVfx[i].done) this.activeVfx.splice(i, 1);
        }
      }
    }

    // ─── Mirror-Lake Eclipse Backdrop ───
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

      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = '#090712'; ctx.fillRect(0, 52 + i, 12 + i, 2);
        ctx.fillStyle = i % 2 === 0 ? '#2b3454' : '#3d4c78'; ctx.fillRect(0, 52 + i, 10 + i, 1);
      }
      ctx.fillStyle = '#090712'; ctx.fillRect(0, 60, 16, BRIDGE_VY - 60);
      ctx.fillStyle = '#364369'; ctx.fillRect(0, 60, 14, BRIDGE_VY - 60);
      ctx.fillStyle = '#090712'; ctx.fillRect(2, 72, 9, 13);
      ctx.fillStyle = '#9cf4ff'; ctx.fillRect(3, 73, 7, 11);
      drawMatrix(ctx, PROPS.cyanLamp, 38, BRIDGE_VY - 38);

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
        for (let row = 0; row < th; row++) { const hw = Math.max(1, Math.round((row / th) * maxW)); ctx.fillStyle = '#090712'; ctx.fillRect(cx - hw - 1, ty + row - 1, hw * 2 + 3, 3); }
      }
      for (let t = 0; t < tiers; t++) {
        const ty = topY + Math.floor((t / tiers) * (h * 0.68)), th = Math.floor(h * 0.40), maxW = 5 + t * 3.6;
        for (let row = 0; row < th; row++) { const hw = Math.max(1, Math.round((row / th) * maxW)); ctx.fillStyle = colDark; ctx.fillRect(cx - hw, ty + row, hw * 2 + 1, 1); ctx.fillStyle = colLit; ctx.fillRect(cx - hw, ty + row, Math.max(1, Math.floor(hw * 0.72)), 1); }
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
      for (let bx = 0; bx < BW; bx += 48) { ctx.fillStyle = '#141726'; ctx.fillRect(bx, y + 4, 4, 12); ctx.fillRect(bx + 24, y + 16, 4, 12); }
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
      ctx.save(); ctx.scale(4, 4);
      drawMatrix(ctx, PROPS.floatCrystal, 55, 58 + bob1);
      drawMatrix(ctx, PROPS.floatCrystal, 66, 70 - bob2);
      drawMatrix(ctx, PROPS.floatShard, 174, 30 + bob2);
      drawMatrix(ctx, PROPS.floatShard, 195, 24 - bob1);
      drawMatrix(ctx, PROPS.floatShard, 288, 34 + bob3);
      drawMatrix(ctx, PROPS.arcanePrism, 266, 58 + bob3);
      ctx.restore();

      const flicker = 0.88 + Math.sin(this.time * 7.2) * 0.12;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
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

      if (this.atmosphere) this.atmosphere.draw(ctx, this.time);

      for (const ag of this.afterimages) {
        sprites.drawUnit(ctx, ag.unitId, ag.anim, ag.time, ag.x, ag.y, { scale: ag.scale, flipX: ag.flipX, alpha: (ag.life / ag.maxLife) * 0.48, outlineColor: ag.tint });
      }

      const isBossCharging = this.bossIntent && (this.bossIntent.kind === 'charge' || this.bossIntent.kind === 'ult');
      const units = [...this.allies, ...(this.boss ? [this.boss] : [])].filter((u) => u.alive);
      for (const u of units) {
        const ux = Math.round(u.x + u.knockX), uy = Math.round(u.y);
        const isAct = this.activeAnim && this.activeAnim.actor === u && u.anim === 'attack';
        sprites.drawUnit(ctx, u.unitId, u.anim, this.time + u.phase, ux, uy, {
          scale: u.scale || 1.56, flipX: u.side === 'enemy', loop: !isAct,
          elapsedOverride: isAct ? this.activeAnim.elapsed : null,
          speedMult: isAct ? this.activeAnim.animSpeedMult : 1,
          squashX: u.squashX, squashY: u.squashY,
          outlineColor: u.flash > 0 ? '#ffffff' : (u.isBoss && this.bossStunnedThisTurn) ? '#ffd966' : (u.isBoss && isBossCharging) ? '#ff477e' : u.isFusion ? '#ffd966' : u.redSeal ? '#ff5268' : null
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

      // Live Shimmering Mirror Lake Reflection!
      const lakeH = BH - LAKE_Y;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, LAKE_Y, BW, lakeH); ctx.clip();
      for (let sy = 0; sy < lakeH; sy += 4) {
        const srcY = BRIDGE_Y - sy - 4;
        if (srcY < 0) break;
        const ripple = Math.round(Math.sin(sy * 0.085 + this.time * 3.8) * (1.5 + (sy / lakeH) * 2.5));
        ctx.save(); ctx.translate(ripple, LAKE_Y + sy + 4); ctx.scale(1, -1);
        ctx.drawImage(this.sceneBuf, 0, srcY, BW, 4, 0, 0, BW, 4);
        ctx.restore();
      }
      const waterTint = ctx.createLinearGradient(0, LAKE_Y, BW, LAKE_Y);
      waterTint.addColorStop(0, 'rgba(26, 98, 175, 0.28)'); waterTint.addColorStop(0.55, 'rgba(72, 34, 96, 0.26)'); waterTint.addColorStop(1, 'rgba(92, 36, 94, 0.30)');
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

      // Empty Bridge Prompt when picking 0 heroes
      if (this.phase === 'picking' && this.allies.length === 0) {
        ctx.save();
        const bx = 355, by = 334;
        ctx.fillStyle = '#090712'; ctx.fillRect(bx - 134, by - 18, 268, 36);
        ctx.fillStyle = '#1e243b'; ctx.fillRect(bx - 131, by - 15, 262, 30);
        ctx.fillStyle = '#8ef0ff'; ctx.fillRect(bx - 131, by - 15, 262, 2);
        ctx.font = '900 13px "Noto Sans SC", monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = '#e8f4ff';
        ctx.fillText('↓ 点选下方 3 位侠客登桥迎战 ↓', bx, by + 5);
        ctx.restore();
      }

      // Ally Full Nameplates
      for (const a of this.allies) {
        if (!a.alive) continue;
        const label = `${a.redSeal ? '◈' : ''}${a.isFusion ? '★3战神' : a.name}`;
        ctx.font = '900 11px "Noto Sans SC", monospace';
        const bw = Math.max(88, Math.ceil(ctx.measureText(label).width) + 20);
        const bx = Math.round(a.x + a.knockX - bw / 2), by = Math.round(a.y + 8);
        ctx.fillStyle = '#090712'; ctx.fillRect(bx - 3, by - 3, bw + 6, 20);
        ctx.fillStyle = '#1e2338'; ctx.fillRect(bx, by, bw, 14);
        ctx.fillStyle = a.factionColor; ctx.fillRect(bx, by, 5, 14);
        ctx.fillStyle = '#f2f5ff'; ctx.textAlign = 'center';
        ctx.fillText(label, Math.round(a.x + a.knockX + 2), by + 11);
      }

      // LIVE ACTIVE BOSS INTENT TELEGRAPH SIGN RIGHT OVER BOSS HEAD!
      if (this.boss && this.boss.alive && this.bossIntent) {
        const it = this.bossIntent;
        const bx = Math.round(this.boss.x + this.boss.knockX);
        const bob = Math.round(Math.sin(this.time * 4.5) * 3);
        const by = 186 + bob;
        ctx.save();
        ctx.font = '900 14px "Noto Sans SC", monospace';
        const tw = Math.max(216, Math.ceil(ctx.measureText(it.label).width) + 28);
        const th = it.kind === 'charge' ? 50 : 34;
        const lx = Math.min(BW - 14 - tw, Math.max(660, Math.round(bx - tw / 2)));

        ctx.fillStyle = '#090712'; ctx.fillRect(lx - 4, by - 4, tw + 8, th + 8);
        ctx.fillStyle = it.kind === 'ult' ? '#5c1028' : it.kind === 'charge' ? '#4a230b' : it.kind === 'stunned' ? '#3d3011' : '#211c36';
        ctx.fillRect(lx, by, tw, th);
        ctx.fillStyle = it.color; ctx.fillRect(lx, by, tw, 3);
        ctx.textAlign = 'center';
        ctx.fillStyle = it.color;
        ctx.fillText(it.label, lx + tw / 2, by + 22);

        if (it.kind === 'charge') {
          const pct = Math.min(1, this.bossBreakProgress / Math.max(1, it.breakNeed));
          ctx.fillStyle = '#090712'; ctx.fillRect(lx + 12, by + 30, tw - 24, 12);
          ctx.fillStyle = '#29150c'; ctx.fillRect(lx + 14, by + 32, tw - 28, 8);
          ctx.fillStyle = '#ffd966'; ctx.fillRect(lx + 14, by + 32, Math.round((tw - 28) * pct), 8);
        }
        ctx.restore();
      }

      // Hand Combo Cut-In Banner
      if (this.cutinTimer > 0 && this.cutinInfo) {
        const ci = this.cutinInfo;
        const alpha = Math.min(1, this.cutinTimer * 2.2);
        const bw = 480, bh = 68;
        const bx = Math.round(BW / 2 - bw / 2);
        const by = 172;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#090712'; ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
        ctx.fillStyle = '#1b1d33'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = ci.color; ctx.fillRect(bx, by, bw, 4);
        ctx.font = '900 25px "Noto Sans SC", monospace'; ctx.textAlign = 'center';
        ctx.strokeStyle = '#090712'; ctx.lineWidth = 5;
        const title = `${ci.name} Lv.${ci.lv} · ×${ci.mult}`;
        ctx.strokeText(title, bx + bw / 2, by + 34);
        ctx.fillStyle = ci.color; ctx.fillText(title, bx + bw / 2, by + 34);
        ctx.font = '900 13px "Noto Sans SC", monospace'; ctx.fillStyle = '#f2f5ff';
        ctx.fillText(ci.perk, bx + bw / 2, by + 56);
        ctx.restore();
      }

      // Scale-Pop Floating Damage Numbers
      for (const pp of this.popups) {
        const age = pp.maxLife - pp.life;
        const sc = age < 0.11 ? (0.7 + (age / 0.11) * 0.72) : age < 0.22 ? (1.42 - ((age - 0.11) / 0.11) * 0.42) : 1.0;
        ctx.save();
        ctx.globalAlpha = Math.min(1, pp.life * 1.8);
        ctx.translate(Math.round(pp.x), Math.round(pp.y));
        ctx.scale(sc, sc);
        ctx.font = pp.big ? '900 25px "Noto Sans SC", monospace' : '900 18px "Noto Sans SC", monospace';
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

    // ─── DOM Overlays ───
    renderBattleHud() {
      const titleEl = document.getElementById('bt-title');
      if (titleEl && this.bossCfg) {
        titleEl.textContent = `W${this.bossCfg.wave}/8 · 第 ${this.round}/${this.maxRounds} 回合`;
      }
      const sqTxt = document.getElementById('bt-squad-hp-text');
      if (sqTxt) {
        sqTxt.innerHTML = `小队 ${this.squadHp}/${this.squadMaxHp}${this.squadShield > 0 ? ` <b style="color:#6be5ff">+${this.squadShield}盾</b>` : ''}`;
      }
      const sqFill = document.getElementById('bt-squad-hp-fill');
      if (sqFill) {
        sqFill.style.width = `${Math.max(0, Math.min(100, (this.squadHp / this.squadMaxHp) * 100))}%`;
      }
      const sqShFill = document.getElementById('bt-squad-shield-fill');
      if (sqShFill) {
        sqShFill.style.width = `${Math.max(0, Math.min(100, (this.squadShield / this.squadMaxHp) * 100))}%`;
      }

      const bName = document.getElementById('bt-boss-name');
      if (bName && this.boss) {
        bName.innerHTML = `${this.boss.name}${this.bossVulnerableTurns > 0 ? ' <i class="vuln-tag">易伤+50%</i>' : ''}`;
      }
      const hpTxt = document.getElementById('bt-boss-hp-text');
      if (hpTxt && this.boss) {
        hpTxt.innerHTML = `${this.boss.hp.toLocaleString()} / ${this.boss.maxHp.toLocaleString()}${this.boss.shield > 0 ? ` <b style="color:#6be5ff">+${this.boss.shield}盾</b>` : ''}`;
      }
      const bar = document.getElementById('bt-boss-hp-bar');
      if (bar && this.boss) {
        const pct = Math.max(0, Math.min(1, this.boss.hp / this.boss.maxHp));
        const lit = Math.ceil(pct * 10);
        let h = '';
        for (let i = 0; i < 10; i++) h += `<i class="bt-boss-seg ${i < lit ? 'on' : ''}"></i>`;
        bar.innerHTML = h;
      }

      const statsEl = document.getElementById('bt-chain-stats');
      if (statsEl) {
        statsEl.textContent = `秘宝连锁 ${this.totalTriggers} 次 · 最高单击 ${this.peakHit.toLocaleString()}${this.combatGold > 0 ? ` · 吸金 +${this.combatGold}G` : ''}`;
      }
    }

    renderRelicBar() {
      const box = document.getElementById('bt-relic-chain');
      if (!box) return;
      const { EDITIONS } = window.MT.V12_DATA;
      const slots = Math.max(this.maxRelicSlots || 5, this.relics.length);
      let html = '';
      for (let i = 0; i < slots; i++) {
        if (i > 0) html += `<span class="bt-chain-arrow">›</span>`;
        const inst = this.relics[i];
        if (!inst) { html += `<div class="bt-relic-slot empty" data-ridx="${i}"><span>空位</span></div>`; continue; }
        const r = inst.tpl;
        const ed = EDITIONS[inst.edition] || EDITIONS.normal;
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(r.icon) : null;
        html += `
          <div class="bt-relic-slot filled cat-${r.cat} ed-${inst.edition || 'normal'}" data-ridx="${i}" title="${r.name}：${r.desc}">
            ${ed.badge ? `<i class="ed-pip ed-${inst.edition}">${ed.badge}</i>` : ''}
            ${iconUrl ? `<img src="${iconUrl}" alt="${r.name}" />` : ''}
            <span class="bt-relic-badge">${r.short}</span>
            <span class="bt-relic-pop"></span>
          </div>`;
      }
      box.innerHTML = html;
    }
  }

  window.MT.V12Battle = V12Battle;
})();
