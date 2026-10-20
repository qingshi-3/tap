import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let doc: EventTarget & { hidden: boolean }, instances: any[], activation: { isActive: boolean };
class Audio {
 state = 'running'; currentTime = 0; sampleRate = 20; destination = {};
 constructor() { instances.push(this); }
 node() { return { connect: () => this.node(), disconnect: vi.fn(), gain: { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, Q: { value: 0 }, start: vi.fn(), stop: vi.fn() }; }
 createGain = vi.fn(() => this.node()); createDynamicsCompressor = vi.fn(() => this.node());
 createBuffer = vi.fn(() => ({ getChannelData: () => new Float32Array(10) }));
 createOscillator = vi.fn(() => this.node()); createBufferSource = vi.fn(() => this.node()); createBiquadFilter = vi.fn(() => this.node());
 decodeAudioData = vi.fn(async (_bytes: ArrayBuffer) => ({ decoded: true, duration: 120 }));
 resume = vi.fn(async () => { this.state = 'running'; }); suspend = vi.fn(async () => { this.state = 'suspended'; }); close = vi.fn(async () => { this.state = 'closed'; });
}
beforeEach(() => {
 vi.resetModules(); instances = []; doc = Object.assign(new EventTarget(), { hidden: false }); activation = { isActive: false };
 vi.stubGlobal('document', doc); vi.stubGlobal('navigator', { userActivation: activation });
 vi.stubGlobal('window', { AudioContext: Audio }); vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('muted and hidden effects create no oscillator or noise source; hidden suspends and visible waits for gesture', async () => {
 activation.isActive = true;
 const a = await import('../src/ui/audio'); a.unlockAudio(); const ctx = instances[0];
 a.sfx.hit(); expect(ctx.createOscillator).toHaveBeenCalledOnce(); expect(ctx.createBufferSource).toHaveBeenCalledOnce();
 a.setMuted(true); a.sfx.hit(); expect(ctx.createOscillator).toHaveBeenCalledOnce(); expect(ctx.createBufferSource).toHaveBeenCalledOnce();
 a.setMuted(false); doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); a.sfx.hit(); expect(ctx.suspend).toHaveBeenCalledOnce();
 doc.hidden = false; activation.isActive = false; doc.dispatchEvent(new Event('visibilitychange')); a.unlockAudio();
 expect(ctx.resume).not.toHaveBeenCalled(); a.sfx.hit(); expect(ctx.createOscillator).toHaveBeenCalledOnce();
 activation.isActive = true; a.unlockAudio(); expect(ctx.resume).toHaveBeenCalledOnce(); a.sfx.hit(); expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
 a.disposeAudio(); expect(ctx.close).toHaveBeenCalledOnce();
 doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); expect(ctx.suspend).toHaveBeenCalledOnce();
});
it('muted initial unlock does not create any audio context', async () => {
 const a = await import('../src/ui/audio'); a.setMuted(true); a.unlockAudio(); expect(instances).toHaveLength(0); a.disposeAudio();
});

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fetchMusic() {
 const request = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
 vi.stubGlobal('fetch', request);
 return request;
}
it('waits for gesture, loops throughout the run and isolates BGM/SFX volumes', async () => {
 const request = fetchMusic();
 const a = await import('../src/ui/audio');
 expect(a.getVolumes()).toEqual({ master: 1, sfx: 1, bgm: .2 });
 a.setAudioPaused(false); expect(instances).toHaveLength(0);
 a.setMusicRun('test-run'); a.unlockAudio(); await flush();
 expect(instances).toHaveLength(0);
 expect(request).not.toHaveBeenCalled();
 activation.isActive = true; a.unlockAudio(); await flush();
 const ctx = instances[0];
 expect(request).toHaveBeenCalledOnce();
 expect(ctx.createBufferSource).toHaveBeenCalledOnce();
 const music = ctx.createBufferSource.mock.results[0].value;
 expect(music.loop).toBe(true); expect(music.start).toHaveBeenCalledOnce();
 a.setVolume('sfx', 0); a.sfx.click(); expect(ctx.createOscillator).not.toHaveBeenCalled();
 expect(music.stop).not.toHaveBeenCalled();
 a.setVolume('bgm', 0); expect(music.stop).toHaveBeenCalledOnce(); expect(music.disconnect).toHaveBeenCalledOnce();
 a.setVolume('sfx', 1); a.sfx.click(); expect(ctx.createOscillator).toHaveBeenCalledOnce();
 a.setVolume('bgm', .3); expect(ctx.createBufferSource).toHaveBeenCalledTimes(2);
 a.setMusicRun(null); expect(ctx.createBufferSource.mock.results[1].value.stop).toHaveBeenCalledOnce();
 a.disposeAudio();
});
it('late decode cannot start music after battle exit or dispose', async () => {
 fetchMusic(); activation.isActive = true;
 const a = await import('../src/ui/audio');
 a.unlockAudio(); const ctx = instances[0];
 let finish!: (value: any) => void;
 ctx.decodeAudioData.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
 a.setMusicRun('test-run'); await flush();
 a.setMusicRun(null); finish({ decoded: true, duration: 120 }); await flush();
 expect(ctx.createBufferSource).not.toHaveBeenCalled();
 a.setMusicRun('test-run'); await flush(); expect(ctx.createBufferSource).toHaveBeenCalledOnce();
 a.disposeAudio();
 a.unlockAudio(); const second = instances[1];
 second.decodeAudioData.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
 a.setMusicRun('test-run'); await flush(); a.disposeAudio(); finish({ decoded: true, duration: 120 }); await flush();
 expect(second.createBufferSource).not.toHaveBeenCalled();
});
it('shuffles three distinct chapters once per run and restores the same selection on reload', async () => {
 const saved = new Map<string, string>();
 vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) });
 const request = fetchMusic(); activation.isActive = true;
 let a = await import('../src/ui/audio'); a.unlockAudio();
 a.setMusicRun('campaign', 0); await flush();
 const first = request.mock.calls.map(call => call[0]);
 a.setMusicRun('campaign', 0); await flush(); expect(request).toHaveBeenCalledOnce();
 a.setMusicRun('campaign', 1); await flush(); a.setMusicRun('campaign', 2); await flush();
 const urls = request.mock.calls.map(call => call[0]);
 expect(new Set(urls).size).toBe(3);
 const order = JSON.parse(saved.get('zl_music_run')!).order;
 expect(new Set(order).size).toBe(3);
 a.disposeAudio(); vi.resetModules(); a = await import('../src/ui/audio'); a.unlockAudio();
 a.setMusicRun('campaign', 0); await flush();
 expect(request.mock.calls.at(-1)![0]).toBe(first[0]);
 a.setMusicSelection('songhai'); await flush(); const count = request.mock.calls.length;
 expect(saved.get('zl_music_selection')).toBe('songhai');
 a.setMusicRun('campaign', 1); a.setMusicRun('campaign', 2); await flush();
 expect(request).toHaveBeenCalledTimes(count); a.disposeAudio();
});
it('ducks only music, resumes its offset and cancels obsolete fade timers', async () => {
 vi.useFakeTimers(); fetchMusic(); activation.isActive = true;
 const a = await import('../src/ui/audio'); a.unlockAudio(); a.setMusicSelection('battle02');
 a.setMusicRun('campaign'); await flush();
 const ctx = instances[0], source = ctx.createBufferSource.mock.results[0].value;
 ctx.currentTime = 5; a.setMusicDucked(true); a.sfx.click();
 expect(ctx.createOscillator).toHaveBeenCalledOnce(); expect(source.stop).not.toHaveBeenCalled();
 ctx.currentTime = 5.3; vi.advanceTimersByTime(300); expect(source.stop).toHaveBeenCalledOnce();
 a.setMusicDucked(false); const resumed = ctx.createBufferSource.mock.results[1].value;
 expect(resumed.start).toHaveBeenCalledWith(0, 5.3);
 a.setMusicDucked(true); vi.advanceTimersByTime(100); a.setMusicDucked(false);
 vi.advanceTimersByTime(400); expect(resumed.stop).not.toHaveBeenCalled();
 a.setMusicDucked(true); a.setMuted(true); a.setMuted(false); a.setMusicDucked(false);
 const afterMute = ctx.createBufferSource.mock.results[2].value;
 vi.advanceTimersByTime(400); expect(afterMute.stop).not.toHaveBeenCalled();
 a.setMusicDucked(true); a.setMusicSelection('battle01'); await flush();
 a.setMusicDucked(false); await flush(); const changed = ctx.createBufferSource.mock.results.at(-1)!.value;
 vi.advanceTimersByTime(400); expect(changed.stop).not.toHaveBeenCalled();
 a.setMusicDucked(true); a.setMusicRun(null); vi.advanceTimersByTime(400);
 expect(changed.stop).toHaveBeenCalledOnce(); a.disposeAudio();
});
it('replacing a track ignores its stale decode and retains only the latest buffer', async () => {
 fetchMusic(); activation.isActive = true;
 const a = await import('../src/ui/audio'); a.setMusicSelection('battle02'); a.unlockAudio();
 const ctx = instances[0]; let finish!: (value: any) => void;
 ctx.decodeAudioData.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
 a.setMusicRun('campaign'); await flush();
 a.setMusicSelection('battle01'); await flush();
 const latest = ctx.createBufferSource.mock.results[0].value;
 expect(latest.start).toHaveBeenCalledOnce();
 const stale = { duration: 120, obsolete: true }; finish(stale); await flush();
 expect(ctx.createBufferSource).toHaveBeenCalledOnce(); expect(latest.buffer).not.toBe(stale);
 a.setMusicSelection('battle02'); await flush();
 expect(ctx.decodeAudioData).toHaveBeenCalledTimes(3);
 expect(latest.stop).toHaveBeenCalledOnce(); a.disposeAudio();
});
it('title track continues across title views, yields to a run and never uses battle Songhai by mistake', async () => {
 const request = fetchMusic(); activation.isActive = true;
 const a = await import('../src/ui/audio'); a.setTitleMusic(true); a.unlockAudio(); await flush();
 expect(request.mock.calls[0][0]).toContain('music_mainmenu_songhai.m4a');
 a.setTitleMusic(true); a.setMusicSelection('songhai'); await flush();
 expect(request).toHaveBeenCalledOnce();
 a.setMusicRun('campaign'); await flush();
 expect(request.mock.calls[1][0]).toContain('music_battlemap_songhai.m4a');
 a.setTitleMusic(false); await flush(); expect(request).toHaveBeenCalledTimes(2);
 a.setMusicRun(null); await flush(); expect(request).toHaveBeenCalledTimes(2);
 a.setTitleMusic(true); await flush();
 expect(request.mock.calls[2][0]).toContain('music_mainmenu_songhai.m4a');
 expect(instances[0].createBufferSource).toHaveBeenCalledTimes(3); a.disposeAudio();
});
it('background or ad pause invalidates a pending duck fade without restoring music behind a modal', async () => {
 vi.useFakeTimers(); fetchMusic(); activation.isActive = true;
 const a = await import('../src/ui/audio'); a.unlockAudio(); a.setMusicRun('campaign'); await flush();
 const ctx = instances[0];
 a.setMusicDucked(true); a.setAudioPaused(true); vi.advanceTimersByTime(500);
 a.setAudioPaused(false); await flush(); expect(ctx.createBufferSource).toHaveBeenCalledOnce();
 a.setMusicDucked(false); expect(ctx.createBufferSource).toHaveBeenCalledTimes(2);
 a.setMusicDucked(true); doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
 vi.advanceTimersByTime(500); doc.hidden = false; a.unlockAudio(); await flush();
 expect(ctx.createBufferSource).toHaveBeenCalledTimes(2);
 a.setMusicDucked(false); expect(ctx.createBufferSource).toHaveBeenCalledTimes(3);
 vi.advanceTimersByTime(500); expect(ctx.createBufferSource.mock.results[2].value.stop).not.toHaveBeenCalled();
 a.disposeAudio();
});
it('a delayed suspend cannot leave audio paused after an immediate ad failure resumes play', async () => {
 fetchMusic(); activation.isActive = true;
 const a = await import('../src/ui/audio'); a.unlockAudio(); a.setMusicRun('campaign'); await flush();
 const ctx = instances[0]; let finish!: () => void;
 ctx.suspend.mockImplementationOnce(() => new Promise<void>(resolve => {
   finish = () => { ctx.state = 'suspended'; resolve(); };
 }));
 a.setAudioPaused(true); a.setAudioPaused(false);
 expect(ctx.state).toBe('running');
 finish(); await flush();
 expect(ctx.state).toBe('running'); expect(ctx.resume).toHaveBeenCalledOnce();
 a.sfx.click(); expect(ctx.createOscillator).toHaveBeenCalledOnce(); a.disposeAudio();
});
it('late suspend completion respects a newer pause, background gesture gate and disposed context', async () => {
 activation.isActive = true;
 const a = await import('../src/ui/audio'); a.unlockAudio(); const ctx = instances[0];
 let finish!: () => void;
 const delay = () => ctx.suspend.mockImplementationOnce(() => new Promise<void>(resolve => {
   finish = () => { ctx.state = 'suspended'; resolve(); };
 }));
 delay(); a.setAudioPaused(true); a.setAudioPaused(false); a.setAudioPaused(true);
 finish(); await flush(); expect(ctx.resume).not.toHaveBeenCalled();
 a.setAudioPaused(false); await flush(); expect(ctx.resume).toHaveBeenCalledOnce();
 delay(); a.setAudioPaused(true); a.setAudioPaused(false);
 doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); doc.hidden = false;
 activation.isActive = false; finish(); await flush(); expect(ctx.resume).toHaveBeenCalledOnce();
 activation.isActive = true; a.unlockAudio(); await flush();
 delay(); a.setAudioPaused(true); a.setAudioPaused(false); a.disposeAudio();
 const count = ctx.resume.mock.calls.length; finish(); await flush();
 expect(ctx.resume).toHaveBeenCalledTimes(count); expect(instances).toHaveLength(1);
});
it('background and pause stop sources; visible alone cannot resume music', async () => {
 fetchMusic(); activation.isActive = true;
 const a = await import('../src/ui/audio'); a.unlockAudio(); a.setMusicRun('test-run'); await flush();
 const ctx = instances[0], source = ctx.createBufferSource.mock.results[0].value;
 doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
 expect(source.stop).toHaveBeenCalledOnce();
 doc.hidden = false; activation.isActive = false; a.unlockAudio(); await flush();
 expect(ctx.createBufferSource).toHaveBeenCalledOnce();
 activation.isActive = true; a.unlockAudio(); await flush();
 expect(ctx.createBufferSource).toHaveBeenCalledTimes(2);
 a.setAudioPaused(true); a.sfx.click(); expect(ctx.createOscillator).not.toHaveBeenCalled();
 a.setAudioPaused(false); await flush(); expect(ctx.createBufferSource).toHaveBeenCalledTimes(3);
 a.disposeAudio();
});
it('storage errors, failed loads and malformed volume settings do not block SFX', async () => {
 vi.stubGlobal('localStorage', { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('denied'); } });
 vi.stubGlobal('fetch', vi.fn(async () => { throw Error('offline'); })); activation.isActive = true;
 const a = await import('../src/ui/audio'); a.unlockAudio(); a.setMusicRun('test-run'); await flush();
 a.setVolume('master', 2); a.setVolume('bgm', NaN); a.setMuted(true); a.setMuted(false);
 expect(a.getVolumes()).toEqual({ master: 1, sfx: 1, bgm: .2 });
 a.sfx.click(); expect(instances[0].createOscillator).toHaveBeenCalledOnce(); a.disposeAudio();
});
it('restores independent saved volumes and legacy mute; total zero releases music nodes', async () => {
 const saved = new Map([['zl_muted', '1'], ['zl_audio_volumes', JSON.stringify({ master: .8, sfx: .4, bgm: .15 })]]);
 vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) });
 fetchMusic(); activation.isActive = true;
 const a = await import('../src/ui/audio');
 expect(a.isMuted()).toBe(true); expect(a.getVolumes()).toEqual({ master: .8, sfx: .4, bgm: .15 });
 a.setMuted(false); a.unlockAudio(); a.setMusicRun('test-run'); await flush();
 const ctx = instances[0];
 expect(ctx.createGain.mock.results[1].value.gain.value).toBeCloseTo(.55 * .4);
 a.setVolume('master', 0);
 expect(ctx.createBufferSource.mock.results[0].value.stop).toHaveBeenCalledOnce();
 expect(JSON.parse(saved.get('zl_audio_volumes')!)).toEqual({ master: 0, sfx: .4, bgm: .15 });
 a.setVolume('master', .8); expect(ctx.createBufferSource).toHaveBeenCalledTimes(2);
 a.setMuted(true); expect(ctx.createBufferSource.mock.results[1].value.stop).toHaveBeenCalledOnce();
 expect(saved.get('zl_muted')).toBe('1');
 a.disposeAudio();
});
