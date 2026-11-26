// v15.6 Procedural WebAudio SFX & Ambience Engine
// Features: Master DynamicsCompressor Bus, Voice Limiting, Pre-generated Noise Buffer Pool
// (white/pink/brown), Pitch Randomization, Pentatonic Musical Escalation, Layered Combat Impacts,
// Scene Ambient Beds (Rain / Tavern Hearth / Mirror-Lake Wind) + Automatic Audio Ducking.
(function () {
  window.MT = window.MT || {};

  // Pentatonic scale ratios (C major pentatonic across 2.5 octaves) for musical combo escalation
  const PENTA_RATIOS = [
    1.000, 1.122, 1.260, 1.498, 1.682,
    2.000, 2.245, 2.520, 2.997, 3.364,
    4.000
  ];

  // Ambient bed presets: rainGain, rainFreq, rainQ, windGain, windFreq, hearthCrackle
  const AMBIENT_PRESETS = {
    silent:   { rain: 0.0001, rainFreq: 1200, rainQ: 0.7, wind: 0.0001, windFreq: 220, hearth: false },
    title:    { rain: 0.042,  rainFreq: 1650, rainQ: 0.65, wind: 0.024, windFreq: 240, hearth: false },
    porch:    { rain: 0.052,  rainFreq: 1900, rainQ: 0.60, wind: 0.028, windFreq: 260, hearth: false },
    tavern:   { rain: 0.018,  rainFreq: 720,  rainQ: 0.90, wind: 0.020, windFreq: 155, hearth: true  },
    ceremony: { rain: 0.010,  rainFreq: 560,  rainQ: 1.10, wind: 0.036, windFreq: 180, hearth: false },
    battle: {
      drizzle:   { rain: 0.038, rainFreq: 1500, rainQ: 0.72, wind: 0.034, windFreq: 280, hearth: false },
      mist:      { rain: 0.012, rainFreq: 900,  rainQ: 0.95, wind: 0.044, windFreq: 230, hearth: false },
      fireflies: { rain: 0.008, rainFreq: 1100, rainQ: 0.85, wind: 0.030, windFreq: 210, hearth: false }
    }
  };

  class TavernAudio {
    constructor() {
      this.ctx = null;
      this.muted = false;

      // Bus graph
      this.masterGain = null;
      this.compressor = null;
      this.sfxBus = null;
      this.ambientBus = null;
      this.ambientDuckGain = null;

      // Pre-generated noise buffer pool (zero per-hit allocation)
      this.noisePool = null;

      // Voice limiter & per-tag cooldown throttling
      this.activeVoices = 0;
      this.maxVoices = 30;
      this.lastTagTs = Object.create(null);

      // Ambient loop nodes & state
      this.ambienceMode = 'silent';
      this.ambienceSub = 'drizzle';
      this._ambNodes = null;
      this._hearthTimer = null;

      this._bindLifecycle();
    }

    _bindLifecycle() {
      if (typeof window === 'undefined' || this._lifecycleBound) return;
      this._lifecycleBound = true;

      // Unlock WebAudio cleanly on first user gesture and fade in pending ambience
      const unlock = () => {
        if (this.muted) return;
        const ctx = this.ensure();
        if (ctx && this.ambienceMode && this.ambienceMode !== 'silent') {
          this._applyAmbiencePreset(0.45);
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });

      // Pause cleanly when mobile tab backgrounds to save battery & avoid audio glitches
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!this.ctx) return;
          if (document.hidden) {
            if (this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
          } else if (!this.muted) {
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
          }
        });
      }
    }

    _initGraph(ctx) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0.0001 : 0.92, ctx.currentTime);

      // Master bus DynamicsCompressor prevents clipping during rapid multi-hit combos
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, ctx.currentTime);
      this.compressor.knee.setValueAtTime(16, ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      this.compressor.release.setValueAtTime(0.14, ctx.currentTime);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.setValueAtTime(1.0, ctx.currentTime);

      this.ambientDuckGain = ctx.createGain();
      this.ambientDuckGain.gain.setValueAtTime(1.0, ctx.currentTime);

      this.ambientBus = ctx.createGain();
      this.ambientBus.gain.setValueAtTime(1.0, ctx.currentTime);

      this.sfxBus.connect(this.compressor);
      this.ambientBus.connect(this.ambientDuckGain);
      this.ambientDuckGain.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      this._buildNoisePool(ctx);
      this._initAmbientNodes(ctx);
    }

    _buildNoisePool(ctx) {
      const sr = ctx.sampleRate || 44100;
      const len = Math.floor(sr * 2.0); // 2-second seamless loop buffers

      // 1. White noise (crisp transients, slashes, shatters, rain hiss)
      const white = ctx.createBuffer(1, len, sr);
      const wd = white.getChannelData(0);
      for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;

      // 2. Pink noise (Paul Kellet's filter — natural rain & fire texture)
      const pink = ctx.createBuffer(1, len, sr);
      const pd = pink.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        pd[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11));
        b6 = w * 0.115926;
      }

      // 3. Brown noise (deep nocturnal lake wind, distant thunder, hearth warmth)
      const brown = ctx.createBuffer(1, len, sr);
      const bd = brown.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * w) / 1.02;
        bd[i] = Math.max(-1, Math.min(1, lastOut * 3.2));
      }

      // Smooth crossfade last 2048 samples into first 2048 samples for click-free looping
      const fadeN = Math.min(2048, Math.floor(len * 0.1));
      for (const data of [wd, pd, bd]) {
        for (let i = 0; i < fadeN; i++) {
          const t = i / fadeN;
          data[len - fadeN + i] = data[len - fadeN + i] * (1 - t) + data[i] * t;
        }
      }

      this.noisePool = { white, pink, brown };
    }

    _initAmbientNodes(ctx) {
      if (!this.noisePool || this._ambNodes) return;
      const now = ctx.currentTime;

      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = this.noisePool.pink;
      rainSrc.loop = true;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.setValueAtTime(1200, now);
      rainFilter.Q.setValueAtTime(0.75, now);
      const rainGain = ctx.createGain();
      rainGain.gain.setValueAtTime(0.0001, now);
      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(this.ambientBus);
      rainSrc.start(now);

      const windSrc = ctx.createBufferSource();
      windSrc.buffer = this.noisePool.brown;
      windSrc.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.setValueAtTime(220, now);
      windFilter.Q.setValueAtTime(1.1, now);
      const windGain = ctx.createGain();
      windGain.gain.setValueAtTime(0.0001, now);
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(this.ambientBus);
      windSrc.start(now);

      this._ambNodes = { rainSrc, rainFilter, rainGain, windSrc, windFilter, windGain };
    }

    ensure() {
      if (this.muted) return null;
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this._initGraph(this.ctx);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.ctx && this.masterGain) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(this.muted ? 0.0001 : 0.92, now, 0.04);
      }
      if (this.muted) {
        this._stopHearthCrackle();
      } else if (this.ambienceMode && this.ambienceMode !== 'silent') {
        const ctx = this.ensure();
        if (ctx) this._applyAmbiencePreset(0.35);
      }
      return this.muted;
    }

    // Switch ambient soundscape smoothly ('title' | 'porch' | 'tavern' | 'battle' | 'ceremony' | 'silent')
    setAmbience(mode, sub = null) {
      this.ambienceMode = mode || 'silent';
      if (sub) this.ambienceSub = sub;
      if (this.muted || !this.ctx || !this._ambNodes) return;
      this._applyAmbiencePreset(0.55);
    }

    _getAmbiencePreset() {
      if (this.ambienceMode === 'battle') {
        return AMBIENT_PRESETS.battle[this.ambienceSub] || AMBIENT_PRESETS.battle.drizzle;
      }
      return AMBIENT_PRESETS[this.ambienceMode] || AMBIENT_PRESETS.silent;
    }

    _applyAmbiencePreset(tc = 0.5) {
      if (!this.ctx || !this._ambNodes) return;
      const preset = this._getAmbiencePreset();
      const now = this.ctx.currentTime;
      const { rainFilter, rainGain, windFilter, windGain } = this._ambNodes;

      rainFilter.frequency.setTargetAtTime(preset.rainFreq, now, tc);
      rainFilter.Q.setTargetAtTime(preset.rainQ, now, tc);
      rainGain.gain.setTargetAtTime(preset.rain, now, tc);

      windFilter.frequency.setTargetAtTime(preset.windFreq, now, tc);
      windGain.gain.setTargetAtTime(preset.wind, now, tc);

      if (preset.hearth && !this.muted) {
        this._startHearthCrackle();
      } else {
        this._stopHearthCrackle();
      }
    }

    _startHearthCrackle() {
      if (this._hearthTimer) return;
      const scheduleNext = () => {
        this._hearthTimer = setTimeout(() => {
          this._hearthTimer = null;
          if (this.muted || this.ambienceMode !== 'tavern') return;
          if (this.ctx && this.ctx.state === 'running' && !document.hidden) {
            // Subtle warm firewood pop in tavern interior
            const freq = 1800 + Math.random() * 2400;
            this.noise(0.022 + Math.random() * 0.018, 0.014 + Math.random() * 0.014, freq, 0, {
              kind: 'white',
              filterType: 'bandpass',
              Q: 3.5,
              bus: 'ambient',
              bypassThrottle: true
            });
          }
          scheduleNext();
        }, 420 + Math.random() * 1450);
      };
      scheduleNext();
    }

    _stopHearthCrackle() {
      if (this._hearthTimer) {
        clearTimeout(this._hearthTimer);
        this._hearthTimer = null;
      }
    }

    // Sidechain-style ducking: briefly dips ambient bed so big impacts / ults punch through cleanly
    duckAmbience(targetGain = 0.25, holdSec = 0.16, releaseSec = 0.38) {
      if (!this.ctx || !this.ambientDuckGain || this.muted) return;
      const now = this.ctx.currentTime;
      const g = this.ambientDuckGain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(0.05, g.value), now);
      g.linearRampToValueAtTime(Math.max(0.05, targetGain), now + 0.018);
      g.setValueAtTime(Math.max(0.05, targetGain), now + 0.018 + holdSec);
      g.linearRampToValueAtTime(1.0, now + 0.018 + holdSec + releaseSec);
    }

    // Voice limiter + per-tag cooldown check
    _canTrigger(tag = null, minGapMs = 0) {
      if (this.activeVoices >= this.maxVoices) return false;
      if (tag && minGapMs > 0) {
        const nowMs = performance.now();
        const prev = this.lastTagTs[tag] || 0;
        if (nowMs - prev < minGapMs) return false;
        this.lastTagTs[tag] = nowMs;
      }
      return true;
    }

    _trackVoice(node) {
      this.activeVoices += 1;
      node.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      };
    }

    // Slight natural pitch jitter (±pct) to eliminate the robotic "machine-gun effect"
    _jitter(freq, pct = 0.04) {
      return freq * (1 + (Math.random() * 2 - 1) * pct);
    }

    // Map combo step (0..10+) to pleasant pentatonic frequency multiplier
    _pentaFreq(baseHz, step = 0) {
      const idx = Math.max(0, Math.min(PENTA_RATIOS.length - 1, Math.floor(step)));
      return baseHz * PENTA_RATIOS[idx];
    }

    tone(freq, dur, type = 'triangle', gainVal = 0.12, delay = 0, endFreq = null, opts = {}) {
      const ctx = this.ensure();
      if (!ctx) return;
      if (!opts.bypassLimit && !this._canTrigger(opts.tag || null, opts.minGapMs || 0)) return;

      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const f0 = opts.jitter ? this._jitter(freq, opts.jitter) : freq;
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, f0), now);
      if (endFreq !== null) {
        const f1 = opts.jitter ? this._jitter(endFreq, opts.jitter) : endFreq;
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + Math.max(0.01, dur));
      }

      const atk = opts.attack !== undefined ? opts.attack : Math.min(0.012, dur * 0.22);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(gainVal, now + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.015, dur));

      let tail = osc;
      if (opts.filterFreq) {
        const flt = ctx.createBiquadFilter();
        flt.type = opts.filterType || 'lowpass';
        flt.frequency.setValueAtTime(opts.filterFreq, now);
        if (opts.filterEndFreq) {
          flt.frequency.exponentialRampToValueAtTime(Math.max(40, opts.filterEndFreq), now + dur);
        }
        osc.connect(flt);
        tail = flt;
      }

      tail.connect(g);
      g.connect(opts.bus === 'ambient' ? this.ambientBus : this.sfxBus);
      this._trackVoice(osc);
      osc.start(now);
      osc.stop(now + dur + 0.03);
    }

    noise(dur, gainVal = 0.08, filterFreq = 900, delay = 0, opts = {}) {
      const ctx = this.ensure();
      if (!ctx || !this.noisePool) return;
      if (!opts.bypassThrottle && !this._canTrigger(opts.tag || null, opts.minGapMs || 0)) return;

      const now = ctx.currentTime + delay;
      const buf = this.noisePool[opts.kind || 'white'] || this.noisePool.white;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      // Start at a random offset in the pooled buffer so rapid hits never sound identical
      const offset = Math.random() * Math.max(0.1, buf.duration - 0.05);

      const filter = ctx.createBiquadFilter();
      filter.type = opts.filterType || 'bandpass';
      const f0 = opts.jitter ? this._jitter(filterFreq, opts.jitter) : filterFreq;
      filter.frequency.setValueAtTime(Math.max(40, f0), now);
      if (opts.endFreq) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endFreq), now + Math.max(0.015, dur));
      }
      if (opts.Q) filter.Q.setValueAtTime(opts.Q, now);

      const g = ctx.createGain();
      const atk = opts.attack !== undefined ? opts.attack : Math.min(0.008, dur * 0.2);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(gainVal, now + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.018, dur));

      src.connect(filter);
      filter.connect(g);
      g.connect(opts.bus === 'ambient' ? this.ambientBus : this.sfxBus);
      this._trackVoice(src);
      src.start(now, offset, dur + 0.03);
    }

    // =========================================================================
    // v15.6 LAYERED COMBAT & CEREMONY SFX SUITE
    // =========================================================================

    playDashWhoosh(step = 0) {
      if (!this._canTrigger('whoosh', 35)) return;
      const f0 = Math.min(1800, 620 + step * 75);
      this.noise(0.11, 0.085, f0, 0, { kind: 'pink', filterType: 'bandpass', endFreq: f0 * 2.1, Q: 1.6, jitter: 0.05, bypassThrottle: true });
      this.tone(this._pentaFreq(220, step % 5), 0.075, 'triangle', 0.055, 0, this._pentaFreq(330, step % 5), { jitter: 0.03, bypassLimit: true });
    }

    playDaggerThrow(step = 0) {
      if (!this._canTrigger('dagger_throw', 30)) return;
      const hi = this._pentaFreq(740, step % 7);
      this.noise(0.075, 0.08, 3400, 0, { kind: 'white', filterType: 'highpass', endFreq: 1600, jitter: 0.07, bypassThrottle: true });
      this.tone(hi, 0.06, 'triangle', 0.065, 0, hi * 1.42, { jitter: 0.04, bypassLimit: true });
    }

    playDaggerHit(step = 0) {
      if (!this._canTrigger('dagger_hit', 30)) return;
      const note = this._pentaFreq(440, step % 8);
      // Crisp metallic pierce + subtle punch
      this.noise(0.065, 0.10, 2600, 0, { kind: 'white', filterType: 'bandpass', Q: 1.8, jitter: 0.06, bypassThrottle: true });
      this.tone(150, 0.065, 'sine', 0.11, 0, 58, { jitter: 0.05, bypassLimit: true });
      this.tone(note, 0.085, 'triangle', 0.075, 0.008, note * 1.04, { jitter: 0.02, bypassLimit: true });
    }

    playGhostAppear() {
      this.noise(0.18, 0.08, 1200, 0, { kind: 'pink', filterType: 'bandpass', endFreq: 420, Q: 2.2 });
      this.tone(320, 0.14, 'sine', 0.08, 0, 640, { jitter: 0.04 });
      this.tone(480, 0.16, 'triangle', 0.05, 0.03, 290, { jitter: 0.04 });
    }

    // Layered impact: blade transient + sub-bass thump sweetener + musical combo escalation
    playBattleHit({ step = 1, isHeavy = false, isMega = false, isRetrigger = false, isGhost = false, heatLevel = 0 } = {}) {
      if (!this._canTrigger('battle_hit', 26)) return;
      const s = Math.max(0, step - 1 + Math.min(2, heatLevel));
      const scaleNote = this._pentaFreq(261.63, Math.min(10, s));

      // Layer 1: Sub-bass body thump (gives weight and tactile punch)
      const subStart = isMega ? 148 : isHeavy ? 132 : 114;
      const subEnd = isMega ? 32 : isHeavy ? 38 : 46;
      const subDur = isMega ? 0.24 : isHeavy ? 0.17 : 0.11;
      const subGain = Math.min(0.28, (isMega ? 0.24 : isHeavy ? 0.19 : 0.14) + heatLevel * 0.012);
      this.tone(subStart, subDur, 'sine', subGain, 0, subEnd, { jitter: 0.04, bypassLimit: true });

      // Layer 2: Filtered noise impact crack / steel cut
      const crackFreq = isGhost ? 1450 : (isMega ? 2400 : isHeavy ? 1900 : 1550) + heatLevel * 180;
      this.noise(isMega ? 0.18 : isHeavy ? 0.13 : 0.09, isMega ? 0.17 : isHeavy ? 0.13 : 0.095, crackFreq, 0, {
        kind: 'white',
        filterType: 'bandpass',
        endFreq: 420,
        Q: 1.2,
        jitter: 0.07,
        bypassThrottle: true
      });

      // Layer 3: Mid-body bite (lowpassed sawtooth for metallic crunch without harshness)
      this.tone(isGhost ? 210 : 195, isHeavy ? 0.11 : 0.075, 'sawtooth', isHeavy ? 0.09 : 0.065, 0, 74, {
        filterFreq: isMega ? 1600 : 1100,
        filterEndFreq: 260,
        jitter: 0.05,
        bypassLimit: true
      });

      // Layer 4: Musical combo escalation chime (Balatro-like rising satisfaction!)
      this.tone(scaleNote, isMega ? 0.20 : 0.11, 'triangle', isMega ? 0.10 : 0.075, 0.01, scaleNote * 1.03, {
        jitter: 0.015,
        bypassLimit: true
      });

      if (isRetrigger || isHeavy || heatLevel >= 2) {
        this.tone(scaleNote * 1.5, 0.15, 'triangle', 0.065 + heatLevel * 0.008, 0.025, scaleNote * 1.52, { bypassLimit: true });
      }
      if (isMega || heatLevel >= 3) {
        this.tone(scaleNote * 2.0, 0.24, 'sine', 0.085, 0.035, scaleNote * 2.04, { bypassLimit: true });
        this.duckAmbience(0.28, 0.15, 0.35);
      }
    }

    // Balatro-style Relic (Joker) trigger tick — pitches up musically & grows hotter with heatLevel!
    playRelicTick({ step = 0, isMult = false, heatLevel = 0 } = {}) {
      if (!this._canTrigger('relic_tick', 24)) return;
      const base = this._pentaFreq(isMult ? 440 : 392, Math.min(10, step));
      if (isMult) {
        // Hot multiplier pop: punchy harmonic triad + slight flame hiss when heated
        this.tone(base, 0.12, 'triangle', 0.095, 0, base * 1.08, { jitter: 0.012, bypassLimit: true });
        this.tone(base * 1.5, 0.16, 'sine', 0.09, 0.02, base * 1.54, { bypassLimit: true });
        if (heatLevel >= 2) {
          this.tone(base * 2.0, 0.18, 'triangle', 0.065, 0.035, base * 2.06, { bypassLimit: true });
          this.noise(0.08, 0.06, 2200 + heatLevel * 380, 0, { kind: 'pink', filterType: 'bandpass', Q: 1.4, bypassThrottle: true });
        }
      } else {
        // Crisp chip-add clack
        this.tone(base, 0.085, 'triangle', 0.085, 0, base * 1.05, { jitter: 0.015, bypassLimit: true });
        this.noise(0.035, 0.055, 2800 + step * 110, 0, { kind: 'white', filterType: 'bandpass', Q: 2.0, bypassThrottle: true });
      }
    }

    // Iconic flame-ignition whoosh when scoring crosses Heat Lv.2 (Orange Flame), Lv.3 (Blue Overkill), Lv.4 (Eclipse)
    playHeatIgnite(level = 2) {
      if (!this._canTrigger(`heat_${level}`, 260)) return;
      const isBlue = level >= 3;
      const isSuper = level >= 4;
      // Rising fire rush whoosh
      this.noise(isSuper ? 0.42 : 0.30, isSuper ? 0.16 : 0.12, isBlue ? 900 : 620, 0, {
        kind: 'pink',
        filterType: 'bandpass',
        endFreq: isSuper ? 3600 : isBlue ? 2900 : 1900,
        Q: 1.3,
        bypassThrottle: true
      });
      this.tone(isBlue ? 128 : 105, 0.22, 'sine', 0.18, 0, 48, { bypassLimit: true });
      // Bright ignition chord
      const notes = isSuper
        ? [587.33, 880, 1174.66, 1760]
        : isBlue
          ? [523.25, 783.99, 1046.5]
          : [440, 659.25];
      notes.forEach((f, idx) => {
        this.tone(f, 0.24, 'triangle', 0.075, 0.02 + idx * 0.035, f * 1.03, { bypassLimit: true });
      });
      if (isBlue) this.duckAmbience(0.26, 0.22, 0.42);
    }

    playAmpCast() {
      this.tone(440, 0.12, 'sine', 0.075, 0, 659.25, { jitter: 0.02 });
      this.tone(659.25, 0.18, 'triangle', 0.08, 0.045, 880, { jitter: 0.02 });
      this.noise(0.14, 0.045, 2800, 0.02, { kind: 'white', filterType: 'bandpass', Q: 2.5 });
    }

    playShieldGain() {
      this.tone(523.25, 0.10, 'sine', 0.075, 0, 659.25, { jitter: 0.03 });
      this.tone(783.99, 0.16, 'triangle', 0.065, 0.04, 1046.5, { jitter: 0.02 });
    }

    playShieldBash() {
      this.tone(140, 0.16, 'sine', 0.18, 0, 44, { jitter: 0.04 });
      this.tone(310, 0.12, 'triangle', 0.10, 0, 185, { jitter: 0.04 });
      this.noise(0.11, 0.11, 1200, 0, { kind: 'pink', filterType: 'bandpass', endFreq: 380, Q: 1.5 });
    }

    playPoisonApply() {
      this.tone(280, 0.07, 'sine', 0.065, 0, 480, { jitter: 0.06 });
      this.noise(0.08, 0.055, 2200, 0.015, { kind: 'pink', filterType: 'bandpass', Q: 3.0, jitter: 0.08 });
    }

    playPoisonDetonate() {
      this.tone(128, 0.22, 'sine', 0.20, 0, 38, { jitter: 0.04 });
      this.tone(240, 0.18, 'sawtooth', 0.085, 0, 92, { filterFreq: 950, filterEndFreq: 220, jitter: 0.05 });
      this.noise(0.22, 0.13, 1800, 0.01, { kind: 'white', filterType: 'bandpass', endFreq: 480, Q: 1.4 });
      this.duckAmbience(0.35, 0.14, 0.30);
    }

    playBreakStun() {
      // Armor shatter + triumphant major chord
      this.noise(0.22, 0.18, 3600, 0, { kind: 'white', filterType: 'highpass', endFreq: 900, bypassThrottle: true });
      this.tone(150, 0.24, 'sine', 0.22, 0, 36, { bypassLimit: true });
      this.tone(523.25, 0.16, 'triangle', 0.10, 0.02, 523.25, { bypassLimit: true });
      this.tone(659.25, 0.18, 'triangle', 0.095, 0.055, 659.25, { bypassLimit: true });
      this.tone(783.99, 0.26, 'sine', 0.11, 0.09, 1046.5, { bypassLimit: true });
      this.duckAmbience(0.22, 0.22, 0.42);
    }

    playThornsHit() {
      this.noise(0.07, 0.085, 2900, 0, { kind: 'white', filterType: 'bandpass', Q: 2.2, jitter: 0.06 });
      this.tone(240, 0.08, 'sawtooth', 0.075, 0, 125, { filterFreq: 1100, jitter: 0.05 });
    }

    playBossWindup(isUlt = false) {
      const f0 = isUlt ? 86 : 108;
      const f1 = isUlt ? 168 : 155;
      this.tone(f0, isUlt ? 0.24 : 0.15, 'sawtooth', isUlt ? 0.11 : 0.08, 0, f1, { filterFreq: 520, filterEndFreq: 1200 });
      this.noise(isUlt ? 0.24 : 0.14, isUlt ? 0.09 : 0.06, 480, 0, { kind: 'brown', filterType: 'lowpass', endFreq: 900 });
      if (isUlt) {
        this.tone(124, 0.22, 'sine', 0.10, 0.04, 210);
        this.duckAmbience(0.22, 0.30, 0.45);
      }
    }

    playBossSlam(isUlt = false, fullBlocked = false) {
      if (fullBlocked) {
        // Resonant arcane hex-shield deflection chime + solid thud
        this.tone(135, 0.14, 'sine', 0.16, 0, 62);
        this.tone(587.33, 0.16, 'triangle', 0.11, 0, 783.99, { jitter: 0.02 });
        this.tone(880, 0.22, 'sine', 0.09, 0.025, 1174.66, { jitter: 0.02 });
        this.noise(0.11, 0.08, 2200, 0, { kind: 'white', filterType: 'bandpass', Q: 2.4 });
        return;
      }
      // Heavy flesh/ground impact
      this.tone(isUlt ? 118 : 105, isUlt ? 0.32 : 0.22, 'sine', isUlt ? 0.26 : 0.21, 0, 28, { bypassLimit: true });
      this.tone(isUlt ? 165 : 145, isUlt ? 0.24 : 0.18, 'sawtooth', isUlt ? 0.12 : 0.095, 0, 44, {
        filterFreq: 850,
        filterEndFreq: 160,
        bypassLimit: true
      });
      this.noise(isUlt ? 0.26 : 0.18, isUlt ? 0.18 : 0.13, 720, 0, {
        kind: 'brown',
        filterType: 'lowpass',
        endFreq: 180,
        bypassThrottle: true
      });
      this.duckAmbience(isUlt ? 0.18 : 0.30, isUlt ? 0.26 : 0.16, 0.40);
    }

    playRevengeHit() {
      this.tone(145, 0.22, 'sine', 0.21, 0, 38);
      this.tone(420, 0.16, 'triangle', 0.10, 0, 680);
      this.noise(0.18, 0.13, 1900, 0, { kind: 'white', filterType: 'bandpass', endFreq: 450 });
      this.duckAmbience(0.30, 0.16, 0.32);
    }

    // Finisher Kill Confirm: massive final impact + shimmering dissolution + coin scatter
    playBossKill() {
      this.duckAmbience(0.15, 0.42, 0.65);
      // Heavy finisher impact boom
      this.tone(132, 0.38, 'sine', 0.26, 0, 26, { bypassLimit: true });
      this.noise(0.28, 0.19, 2400, 0, { kind: 'white', filterType: 'bandpass', endFreq: 320, Q: 0.9, bypassThrottle: true });
      // Ethereal rising victory resonance
      const chord = [523.25, 659.25, 783.99, 1046.5];
      chord.forEach((f, idx) => {
        this.tone(f, 0.34, 'triangle', 0.075, 0.06 + idx * 0.055, f * 1.015, { bypassLimit: true });
      });
      // Distant dissolving wind & gold coin clink
      this.noise(0.45, 0.07, 1500, 0.12, { kind: 'pink', filterType: 'bandpass', endFreq: 520, Q: 1.8, bypassThrottle: true });
      this.tone(1318.5, 0.11, 'sine', 0.06, 0.30, 1567.98, { bypassLimit: true });
      this.tone(1567.98, 0.16, 'sine', 0.065, 0.37, 2093.0, { bypassLimit: true });
    }

    // Pack Ceremony SFX
    playPackCharge() {
      this.tone(160, 0.28, 'sine', 0.08, 0, 320);
      this.tone(240, 0.28, 'triangle', 0.05, 0.04, 480);
      this.noise(0.24, 0.05, 900, 0, { kind: 'pink', filterType: 'bandpass', endFreq: 2400, Q: 2.0 });
    }

    playPackTear(hasJackpot = false) {
      this.duckAmbience(0.24, 0.28, 0.45);
      // Crisp foil rip + energy burst
      this.noise(0.18, 0.16, 3200, 0, { kind: 'white', filterType: 'bandpass', endFreq: 1100, Q: 1.2, bypassThrottle: true });
      this.tone(138, 0.24, 'sine', 0.20, 0.04, 42, { bypassLimit: true });
      this.tone(523.25, 0.18, 'triangle', 0.09, 0.06, 783.99, { bypassLimit: true });
      if (hasJackpot) {
        this.tone(783.99, 0.26, 'sine', 0.095, 0.10, 1046.5, { bypassLimit: true });
        this.tone(1046.5, 0.32, 'triangle', 0.08, 0.16, 1318.5, { bypassLimit: true });
      }
    }

    playCardReveal(tier = 'B', index = 0) {
      const base = this._pentaFreq(440, index % 5);
      if (tier === 'SSS') {
        this.tone(130, 0.22, 'sine', 0.18, 0, 48, { bypassLimit: true });
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
          this.tone(f, 0.26, 'triangle', 0.085, i * 0.045, f * 1.02, { bypassLimit: true });
        });
        this.noise(0.18, 0.08, 3400, 0.02, { kind: 'white', filterType: 'highpass', bypassThrottle: true });
      } else if (tier === 'S') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          this.tone(f, 0.20, 'triangle', 0.08, i * 0.045, f * 1.02, { bypassLimit: true });
        });
      } else if (tier === 'A') {
        this.tone(base, 0.13, 'triangle', 0.085, 0, base * 1.06);
        this.tone(base * 1.5, 0.17, 'sine', 0.075, 0.04, base * 1.52);
      } else {
        this.tone(base, 0.10, 'triangle', 0.075, 0, base * 1.05, { jitter: 0.02 });
      }
    }

    // =========================================================================
    // LEGACY & SHARED UI SFX (upgraded with jitter & cleaner envelopes, 100% compatible)
    // =========================================================================

    playPickup() {
      this.tone(310, 0.08, 'triangle', 0.08, 0, 520, { jitter: 0.04 });
      this.tone(580, 0.06, 'sine', 0.065, 0.025, 720, { jitter: 0.03 });
    }

    playDrop() {
      this.tone(175, 0.10, 'sine', 0.14, 0, 82, { jitter: 0.04 });
      this.noise(0.055, 0.065, 580, 0, { kind: 'pink', jitter: 0.06 });
    }

    playSlotSnap() {
      this.tone(330, 0.065, 'triangle', 0.075, 0, 440, { jitter: 0.03 });
      this.tone(587.33, 0.13, 'triangle', 0.11, 0.035, 659.25, { jitter: 0.02 });
      this.noise(0.04, 0.045, 1800, 0, { kind: 'white', jitter: 0.06 });
    }

    playSynergy() {
      this.tone(523.25, 0.12, 'triangle', 0.075, 0);
      this.tone(659.25, 0.13, 'triangle', 0.08, 0.06);
      this.tone(783.99, 0.22, 'sine', 0.11, 0.12, 810);
    }

    playDrinkServe() {
      this.tone(1480, 0.11, 'sine', 0.07, 0, 1760, { jitter: 0.03 });
      this.tone(1980, 0.15, 'sine', 0.055, 0.03, 1850, { jitter: 0.03 });
      this.noise(0.20, 0.055, 1800, 0.04, { kind: 'pink' });
      this.tone(420, 0.14, 'triangle', 0.085, 0.11, 620);
    }

    playStampCharge() {
      this.playPackCharge();
    }

    playWaxSlam() {
      this.tone(120, 0.22, 'sine', 0.20, 0, 38);
      this.noise(0.16, 0.14, 480, 0, { kind: 'brown', filterType: 'lowpass' });
      this.tone(240, 0.15, 'triangle', 0.11, 0.04, 160);
      this.tone(523.25, 0.22, 'triangle', 0.08, 0.11, 659.25);
    }

    playSlash() {
      this.noise(0.13, 0.11, 2300, 0, { kind: 'white', filterType: 'bandpass', endFreq: 750, jitter: 0.06 });
      this.tone(440, 0.095, 'sawtooth', 0.08, 0, 145, { filterFreq: 1400, jitter: 0.05 });
    }

    playHit() {
      this.tone(125, 0.13, 'sine', 0.16, 0, 48, { jitter: 0.05 });
      this.noise(0.085, 0.10, 950, 0, { kind: 'white', jitter: 0.06 });
    }

    playCrit() {
      this.tone(145, 0.18, 'sine', 0.20, 0, 40, { jitter: 0.04 });
      this.tone(587.33, 0.10, 'triangle', 0.095, 0, 880, { jitter: 0.02 });
      this.tone(880, 0.20, 'sine', 0.11, 0.05, 1174.66, { jitter: 0.02 });
      this.noise(0.14, 0.12, 2600, 0.015, { kind: 'white', endFreq: 900 });
    }

    playSackBurst() {
      this.tone(115, 0.18, 'sine', 0.18, 0, 48);
      for (let i = 0; i < 6; i++) {
        const f = this._pentaFreq(659.25, i);
        this.tone(f, 0.12, 'triangle', 0.065, 0.05 + i * 0.042, f * 1.15, { jitter: 0.02 });
      }
    }

    playCoin() {
      if (!this._canTrigger('coin', 40)) return;
      this.tone(1174.66, 0.08, 'sine', 0.07, 0, 1567.98, { jitter: 0.025, bypassLimit: true });
      this.tone(1567.98, 0.14, 'triangle', 0.075, 0.045, 1760, { jitter: 0.02, bypassLimit: true });
    }

    playSliderTick(ratio) {
      if (!this._canTrigger('slider', 28)) return;
      this.tone(260 + ratio * 420, 0.032, 'triangle', 0.045, 0, null, { bypassLimit: true });
    }

    playGrumpy() {
      this.tone(180, 0.12, 'sawtooth', 0.07, 0, 120, { filterFreq: 680 });
      this.tone(140, 0.16, 'sawtooth', 0.07, 0.1, 95, { filterFreq: 560 });
    }

    playCheer() {
      this.tone(440, 0.10, 'triangle', 0.07, 0);
      this.tone(554.37, 0.11, 'triangle', 0.075, 0.075);
      this.tone(659.25, 0.22, 'sine', 0.11, 0.15);
    }

    playSplash() {
      this.noise(0.18, 0.12, 1400, 0, { kind: 'pink', endFreq: 620 });
      this.tone(360, 0.12, 'triangle', 0.10, 0, 740);
      this.tone(740, 0.16, 'sine', 0.08, 0.05, 520);
    }

    // Iconic Balatro-style pentatonic pitch-rising chime as each Relic slot lights up left-to-right!
    playChainDing(step = 0, isMult = false) {
      const base = this._pentaFreq(523.25, step);
      if (isMult) {
        this.tone(base, 0.14, 'triangle', 0.09, 0, base * 1.06, { jitter: 0.01 });
        this.tone(base * 1.5, 0.19, 'sine', 0.10, 0.028, base * 1.53);
      } else {
        this.tone(base, 0.11, 'triangle', 0.085, 0, base * 1.04, { jitter: 0.01 });
      }
    }

    playError() {
      this.tone(175, 0.12, 'sawtooth', 0.065, 0, 125, { filterFreq: 620 });
    }
  }

  window.MT.sfx = new TavernAudio();
  window.MT.audio = window.MT.sfx;
})();
