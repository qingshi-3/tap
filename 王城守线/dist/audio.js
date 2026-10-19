// A session-owned mixer. Browsers unlock audio only after a trusted user gesture.
export class BattleAudio {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.buffers = new Map();
    this.voices = new Set();
    this.lastPlayed = new Map();
    this.sources = {};
    this.loading = null;
  }
  configure(sources) { this.sources = sources ?? {}; }
  unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    if (!this.loading && Object.keys(this.sources).length) {
      this.loading = Promise.all(Object.entries(this.sources).map(async ([key, path]) => {
        try {
          const response = await fetch(`./${path}`);
          if (!response.ok) return;
          this.buffers.set(key, await this.context.decodeAudioData(await response.arrayBuffer()));
        } catch { /* An unavailable sound must never interrupt combat. */ }
      }));
    }
  }
  toggle() { this.enabled = !this.enabled; if (!this.enabled) this.stop(); return this.enabled; }
  stop() { for (const source of this.voices) { try { source.stop(); } catch {} } this.voices.clear(); }
  play(key) {
    if (!this.enabled || this.context?.state !== 'running' || this.voices.size >= 7) return;
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    const now = this.context.currentTime;
    const interval = ['impact', 'arrow', 'magic', 'melee', 'fire', 'ice', 'siege'].includes(key) ? .16 : .25;
    if (now - (this.lastPlayed.get(key) ?? -10) < interval) return;
    this.lastPlayed.set(key, now);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    const duration = Math.min(buffer.duration, key === 'wave' ? 2.5 : 1.5);
    const volume = key === 'impact' ? .13 : key === 'siege' ? .18 : key === 'wave' ? .34 : .24;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.setValueAtTime(volume, now + Math.max(0, duration - .12));
    gain.gain.linearRampToValueAtTime(0, now + duration);
    source.connect(gain); gain.connect(this.context.destination);
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); };
    this.voices.add(source); source.start(); source.stop(now + duration);
  }
}
