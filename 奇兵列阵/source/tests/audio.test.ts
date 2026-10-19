import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let doc: EventTarget & { hidden: boolean }, instances: any[], activation: { isActive: boolean };
class Audio {
 state = 'running'; currentTime = 0; sampleRate = 20; destination = {};
 constructor() { instances.push(this); }
 node() { return { connect: () => this.node(), gain: { value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, Q: { value: 0 }, start: vi.fn(), stop: vi.fn() }; }
 createGain = vi.fn(() => this.node()); createDynamicsCompressor = vi.fn(() => this.node());
 createBuffer = vi.fn(() => ({ getChannelData: () => new Float32Array(10) }));
 createOscillator = vi.fn(() => this.node()); createBufferSource = vi.fn(() => this.node()); createBiquadFilter = vi.fn(() => this.node());
 resume = vi.fn(async () => { this.state = 'running'; }); suspend = vi.fn(async () => { this.state = 'suspended'; }); close = vi.fn(async () => { this.state = 'closed'; });
}
beforeEach(() => {
 vi.resetModules(); instances = []; doc = Object.assign(new EventTarget(), { hidden: false }); activation = { isActive: false };
 vi.stubGlobal('document', doc); vi.stubGlobal('navigator', { userActivation: activation });
 vi.stubGlobal('window', { AudioContext: Audio }); vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
it('muted and hidden effects create no oscillator or noise source; hidden suspends and visible waits for gesture', async () => {
 const a = await import('../src/ui/audio'); a.unlockAudio(); const ctx = instances[0];
 a.sfx.hit(); expect(ctx.createOscillator).toHaveBeenCalledOnce(); expect(ctx.createBufferSource).toHaveBeenCalledOnce();
 a.setMuted(true); a.sfx.hit(); expect(ctx.createOscillator).toHaveBeenCalledOnce(); expect(ctx.createBufferSource).toHaveBeenCalledOnce();
 a.setMuted(false); doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); a.sfx.hit(); expect(ctx.suspend).toHaveBeenCalledOnce();
 doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); a.unlockAudio();
 expect(ctx.resume).not.toHaveBeenCalled(); a.sfx.hit(); expect(ctx.createOscillator).toHaveBeenCalledOnce();
 activation.isActive = true; a.unlockAudio(); expect(ctx.resume).toHaveBeenCalledOnce(); a.sfx.hit(); expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
 a.disposeAudio(); expect(ctx.close).toHaveBeenCalledOnce();
 doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); expect(ctx.suspend).toHaveBeenCalledOnce();
});
it('muted initial unlock does not create any audio context', async () => {
 const a = await import('../src/ui/audio'); a.setMuted(true); a.unlockAudio(); expect(instances).toHaveLength(0); a.disposeAudio();
});
