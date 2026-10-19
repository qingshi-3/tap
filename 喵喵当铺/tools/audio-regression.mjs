import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/audio.js', import.meta.url), 'utf8');
let moduleId = 0;

async function fixture(options = {}) {
  const timers = new Map(), contexts = [];
  let timerId = 0;
  class Param {
    setValueAtTime() {}
    exponentialRampToValueAtTime() {}
  }
  class Node {
    connected = false;
    connect(target) { this.connected = true; this.target = target; }
    disconnect() { this.connected = false; }
  }
  class Oscillator extends Node {
    frequency = new Param();
    stopAt = Infinity;
    ended = false;
    start(time) { this.startAt = time; }
    stop(time = this.context.currentTime) {
      if (this.ended) throw new Error('source already ended');
      this.stopAt = time;
    }
    finish() { this.ended = true; this.onended?.(); }
  }
  class Context {
    currentTime = 0;
    state = options.suspended ? 'suspended' : 'running';
    destination = {};
    oscillators = [];
    gains = [];
    resumeCalls = 0;
    pendingResumes = [];
    constructor() {
      if (options.constructorFails) throw new Error('audio unavailable');
      contexts.push(this);
    }
    createGain() { const node = new Node(); node.gain = new Param(); this.gains.push(node); return node; }
    createOscillator() {
      const node = new Oscillator(); node.context = this; this.oscillators.push(node); return node;
    }
    resume() {
      this.resumeCalls++;
      if (options.resumeFails) return Promise.reject(new Error('gesture required'));
      if (options.resumeDeferred) return new Promise(resolve => {
        this.pendingResumes.push(resolve);
      });
      this.state = 'running';
      return Promise.resolve();
    }
    finishResume() {
      this.state = 'running';
      for (const resolve of this.pendingResumes) resolve();
      this.pendingResumes = [];
    }
    advance(seconds) {
      this.currentTime += seconds;
      for (const node of this.oscillators) {
        if (!node.ended && node.stopAt <= this.currentTime) node.finish();
      }
    }
  }
  globalThis.AudioContext = options.unavailable ? undefined : Context;
  globalThis.setTimeout = (callback, delay) => {
    const id = timerId++; timers.set(id, { callback, delay }); return id;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
  const audio = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${moduleId++}`);
  return {
    audio, contexts, timers, Context,
    fireTimer(audioElapsed) {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      contexts[0].advance(audioElapsed ?? timer.delay / 1000);
      timer.callback();
    },
  };
}

const originals = Object.fromEntries(['AudioContext', 'webkitAudioContext', 'setTimeout', 'clearTimeout'].map(k => [k, globalThis[k]]));
const failures = [];
async function check(name, run) {
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); }
}

try {
  globalThis.webkitAudioContext = undefined;
  await check('same song and repeated unlock keep one phrase and one timer, including timer ID 0', async () => {
    const f = await fixture(); f.audio.music('night');
    const count = f.contexts[0].oscillators.length;
    assert.ok(count > 0);
    f.audio.music('night'); f.audio.unlockAudio(); f.audio.unlockAudio();
    assert.equal(f.contexts[0].oscillators.length, count);
    assert.equal(f.timers.size, 1);
    f.audio.music(null); assert.equal(f.timers.size, 0);
  });
  await check('switching song stops and disconnects every old current/future voice, preserving SFX', async () => {
    const f = await fixture(); f.audio.music('night');
    const c = f.contexts[0], old = [...c.oscillators];
    assert.ok(old.some(o => o.startAt > c.currentTime + 1));
    f.audio.sfx('bell'); const effects = c.oscillators.slice(old.length);
    f.audio.music('day');
    assert.ok(old.every(o => o.stopAt <= c.currentTime), 'old scheduled music still exists');
    assert.ok(old.every(o => !o.connected && !o.target.connected), 'old nodes remain connected');
    assert.ok(effects.every(o => o.stopAt > c.currentTime && o.connected), 'SFX was interrupted');
    assert.ok(c.oscillators.slice(old.length + effects.length).length > 0);
    assert.equal(f.timers.size, 1); f.audio.music(null);
  });
  await check('music off cancels voices and timer; repeated stop and late ended events are safe', async () => {
    const f = await fixture(); f.audio.music('day'); const c = f.contexts[0];
    const old = [...c.oscillators], staleLoop = [...f.timers.values()][0].callback;
    // The audio thread ended one voice, but its ended event has not reached JS yet.
    old[0].ended = true;
    f.audio.sound.music = false; f.audio.music(null); f.audio.music(null);
    assert.ok(old.every(o => o.ended || o.stopAt <= c.currentTime), 'old scheduled music still exists');
    assert.ok(old.every(o => !o.connected && !o.target.connected));
    assert.equal(f.timers.size, 0);
    for (const o of old) o.finish();
    staleLoop(); assert.equal(f.timers.size, 0);
    f.audio.sound.music = true; f.audio.music('day');
    assert.equal(f.timers.size, 1); f.audio.music(null);
  });
  await check('loop releases ended notes, repeats once, and ignores stale callbacks after a switch', async () => {
    const f = await fixture(); f.audio.music('night'); const c = f.contexts[0];
    const first = [...c.oscillators], staleLoop = [...f.timers.values()][0].callback;
    f.fireTimer();
    assert.ok(first.filter(o => o.ended).every(o => !o.connected && !o.target.connected));
    assert.equal(c.oscillators.length, first.length * 2);
    assert.equal(f.timers.size, 1);
    f.audio.music('day'); f.audio.music('night'); const count = c.oscillators.length;
    staleLoop(); assert.equal(c.oscillators.length, count); assert.equal(f.timers.size, 1);
    f.audio.music(null);
  });
  await check('missing AudioContext can recover on unlock without duplicate scheduling', async () => {
    const f = await fixture({ unavailable: true }); f.audio.music('night');
    assert.equal(f.timers.size, 0);
    globalThis.AudioContext = f.Context; f.audio.unlockAudio();
    const count = f.contexts[0].oscillators.length;
    f.audio.unlockAudio(); assert.equal(f.contexts[0].oscillators.length, count);
    assert.equal(f.timers.size, 1); f.audio.music(null);
  });
  await check('AudioContext construction failure is silent and leaves no phantom timer', async () => {
    const f = await fixture({ constructorFails: true });
    f.audio.music('night'); f.audio.sfx('tap'); f.audio.unlockAudio();
    assert.equal(f.timers.size, 0);
  });
  await check('suspended context resumes on unlock without restarting the song', async () => {
    const f = await fixture({ suspended: true }); f.audio.music('night');
    const c = f.contexts[0], count = c.oscillators.length;
    f.audio.unlockAudio(); assert.ok(c.resumeCalls >= 1);
    assert.equal(c.state, 'running'); assert.equal(c.oscillators.length, count);
    f.audio.music(null);
  });
  await check('async unlock starts only the latest requested song once', async () => {
    const f = await fixture({ suspended: true, resumeDeferred: true });
    f.audio.music('night'); f.audio.music('day'); f.audio.unlockAudio();
    const c = f.contexts[0]; assert.equal(c.oscillators.length, 0); assert.equal(f.timers.size, 0);
    c.finishResume(); await Promise.resolve();
    const count = c.oscillators.length; assert.ok(count > 0); assert.equal(f.timers.size, 1);
    f.audio.music('day'); assert.equal(c.oscillators.length, count); f.audio.music(null);
  });
  await check('turning music off while resume is pending cannot restart it on resolution', async () => {
    const f = await fixture({ suspended: true, resumeDeferred: true }); f.audio.music('night');
    const c = f.contexts[0]; f.audio.sound.music = false; f.audio.music(null);
    c.finishResume(); await Promise.resolve();
    assert.equal(c.oscillators.length, 0); assert.equal(f.timers.size, 0);
  });
  await check('rejected unlock has no queued voices or timer, then a later gesture can retry', async () => {
    const options = { suspended: true, resumeFails: true }, f = await fixture(options);
    f.audio.music('night'); f.audio.unlockAudio(); await Promise.resolve();
    const c = f.contexts[0]; assert.equal(c.oscillators.length, 0); assert.equal(f.timers.size, 0);
    options.resumeFails = false; f.audio.unlockAudio(); await Promise.resolve();
    assert.ok(c.oscillators.length > 0); assert.equal(f.timers.size, 1); f.audio.music(null);
  });
  await check('resuming before wall timer expiry waits for the audio phrase boundary', async () => {
    const f = await fixture(); f.audio.music('night'); const c = f.contexts[0];
    const count = c.oscillators.length, fullDelay = [...f.timers.values()][0].delay;
    // Wall time reached the loop deadline, but suspension allowed only 2s of audio playback.
    f.fireTimer(2);
    assert.equal(c.oscillators.length, count); assert.equal(f.timers.size, 1);
    assert.equal([...f.timers.values()][0].delay, fullDelay - 2000);
    f.fireTimer(); assert.equal(c.oscillators.length, count * 2); f.audio.music(null);
  });
  await check('iOS interrupted state can resume on a later activation', async () => {
    const f = await fixture(); f.audio.music('night'); const c = f.contexts[0];
    c.state = 'interrupted'; c.onstatechange();
    assert.equal(f.timers.size, 0);
    assert.ok(c.oscillators.every(o => !o.connected));
    f.audio.unlockAudio(); await Promise.resolve();
    assert.equal(c.state, 'running'); assert.equal(f.timers.size, 1);
    f.audio.music(null);
  });
  await check('system recovery restarts latest song without a game button; off stays off', async () => {
    const f = await fixture(); f.audio.music('day'); const c = f.contexts[0];
    c.state = 'suspended'; c.onstatechange(); assert.equal(f.timers.size, 0);
    c.state = 'running'; c.onstatechange(); assert.equal(f.timers.size, 1);
    f.audio.sound.music = false; f.audio.music(null);
    c.state = 'interrupted'; c.onstatechange(); c.state = 'running'; c.onstatechange();
    assert.equal(f.timers.size, 0);
  });
  await check('wall timer during suspension clears the pending phrase before restarting on unlock', async () => {
    const f = await fixture(); f.audio.music('night'); const c = f.contexts[0], old = [...c.oscillators];
    c.state = 'suspended'; f.fireTimer(0);
    assert.equal(f.timers.size, 0); assert.ok(old.every(o => !o.connected && o.stopAt <= c.currentTime));
    f.audio.unlockAudio(); await Promise.resolve();
    assert.equal(c.state, 'running'); assert.equal(f.timers.size, 1);
    assert.equal(c.oscillators.length, old.length * 2); f.audio.music(null);
  });
} finally {
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
}
if (failures.length) process.exitCode = 1;
