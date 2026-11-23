// Procedural WebAudio SFX engine (classic script for file:// & http:// compatibility)
(function () {
  window.MT = window.MT || {};

  class TavernAudio {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }

    ensure() {
      if (this.muted) return null;
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }

    tone(freq, dur, type = 'triangle', gainVal = 0.12, delay = 0, endFreq = null) {
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
      }
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(gainVal, now + Math.min(0.015, dur * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }

    noise(dur, gainVal = 0.08, filterFreq = 900, delay = 0) {
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(filterFreq, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gainVal, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      src.start(now);
    }

    playPickup() {
      this.tone(280, 0.09, 'square', 0.07, 0, 460);
      this.tone(520, 0.06, 'triangle', 0.07, 0.03, 660);
    }

    playDrop() {
      this.tone(190, 0.11, 'triangle', 0.14, 0, 110);
      this.noise(0.06, 0.07, 500, 0);
    }

    playSlotSnap() {
      this.tone(330, 0.07, 'square', 0.06, 0, 440);
      this.tone(587, 0.14, 'triangle', 0.12, 0.04, 659);
    }

    playSynergy() {
      this.tone(523.25, 0.12, 'square', 0.06, 0);
      this.tone(659.25, 0.12, 'square', 0.06, 0.07);
      this.tone(783.99, 0.22, 'triangle', 0.11, 0.14);
    }

    playDrinkServe() {
      this.tone(1480, 0.12, 'sine', 0.08, 0, 1760);
      this.tone(1980, 0.16, 'sine', 0.06, 0.03, 1850);
      this.noise(0.22, 0.06, 1800, 0.04);
      this.tone(420, 0.15, 'triangle', 0.09, 0.12, 620);
    }

    playStampCharge() {
      this.tone(140, 0.12, 'sawtooth', 0.05, 0, 220);
    }

    playWaxSlam() {
      this.tone(120, 0.22, 'sawtooth', 0.16, 0, 42);
      this.noise(0.18, 0.16, 360, 0);
      this.tone(240, 0.16, 'triangle', 0.12, 0.05, 160);
      this.tone(523, 0.24, 'square', 0.07, 0.14, 659);
    }

    playSlash() {
      this.noise(0.14, 0.12, 2200, 0);
      this.tone(420, 0.1, 'sawtooth', 0.09, 0, 140);
    }

    playHit() {
      this.tone(130, 0.13, 'square', 0.11, 0, 55);
      this.noise(0.09, 0.1, 700, 0);
    }

    playCrit() {
      this.tone(520, 0.08, 'sawtooth', 0.1, 0, 880);
      this.tone(880, 0.18, 'triangle', 0.12, 0.06, 1174);
      this.noise(0.14, 0.12, 2600, 0.02);
    }

    playSackBurst() {
      this.tone(110, 0.16, 'triangle', 0.15, 0, 55);
      for (let i = 0; i < 6; i++) {
        this.tone(920 + i * 130, 0.12, 'square', 0.05, 0.06 + i * 0.045, 1320 + i * 90);
      }
    }

    playCoin() {
      this.tone(1174, 0.08, 'square', 0.06, 0, 1568);
      this.tone(1568, 0.14, 'triangle', 0.07, 0.05, 1760);
    }

    playSliderTick(ratio) {
      this.tone(260 + ratio * 420, 0.035, 'square', 0.04, 0);
    }

    playGrumpy() {
      this.tone(180, 0.12, 'sawtooth', 0.07, 0, 120);
      this.tone(140, 0.16, 'sawtooth', 0.07, 0.1, 95);
    }

    playCheer() {
      this.tone(440, 0.1, 'square', 0.06, 0);
      this.tone(554, 0.1, 'square', 0.06, 0.08);
      this.tone(659, 0.2, 'triangle', 0.11, 0.16);
    }

    playSplash() {
      this.noise(0.18, 0.14, 1400, 0);
      this.tone(360, 0.12, 'triangle', 0.12, 0, 740);
      this.tone(740, 0.16, 'sine', 0.09, 0.05, 520);
    }

    // Iconic Balatro-style pitch-rising chime as each Relic slot lights up left-to-right!
    playChainDing(step = 0, isMult = false) {
      const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1396.91, 1567.98];
      const base = notes[Math.min(notes.length - 1, Math.max(0, step))];
      if (isMult) {
        this.tone(base, 0.14, 'square', 0.08, 0, base * 1.12);
        this.tone(base * 1.5, 0.18, 'triangle', 0.10, 0.03);
      } else {
        this.tone(base, 0.11, 'triangle', 0.09, 0, base * 1.05);
      }
    }

    playError() {
      this.tone(175, 0.12, 'square', 0.06, 0, 130);
    }
  }

  window.MT.sfx = new TavernAudio();
  window.MT.audio = window.MT.sfx;
})();
