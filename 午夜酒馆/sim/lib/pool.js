'use strict';
// 多核并行跑局。每个 job = { cfg, seeds }；cfg 里含 overrides（纯 JSON），worker 按 cfg 缓存游戏沙箱。
const os = require('os');
const path = require('path');
const { Worker, isMainThread, parentPort } = require('worker_threads');

function compact(r) {
  // 只回传统计需要的字段，减少线程间拷贝
  return {
    won: r.won, partial: r.partial, wavesCleared: r.wavesCleared, deathWave: r.deathWave, revivesUsed: r.revivesUsed,
    peakHit: r.peakHit, gold: r.gold, hero: r.hero, themes: r.themes, roster: r.roster, relics: r.relics,
    slotLevels: r.slotLevels, picks: r.picks,
    waves: r.waves.map((w) => ({
      wave: w.wave, won: w.won, rounds: w.rounds, hpStart: w.hpStart, hpEnd: w.hpEnd, hpLost: w.hpLost,
      shieldBlocked: w.shieldBlocked, berserkRounds: w.berserkRounds, ultTaken: w.ultTaken, breaks: w.breaks,
      discards: w.discards, peakHit: w.peakHit, capHit: Boolean(w.capHit), goldEarned: w.goldEarned || 0
    }))
  };
}

function runOne(G, cfg, seed) {
  const { SimRun } = require('./flow');
  const { HeuristicAI } = require('./ai');
  G.reseed(seed);
  const runCfg = { ...cfg };
  if (cfg.themes === 'random') {
    const all = Object.keys(G.D.THEMES).filter((t) => t !== 'core');
    runCfg.themes = G.shuffle(all).slice(0, 3);
  }
  const sim = new SimRun(G, runCfg);
  try {
    return compact(sim.play(new HeuristicAI(cfg.aiParams || {})));
  } catch (e) {
    return { error: String(e && e.stack || e), seed };
  }
}

if (!isMainThread) {
  const { loadGame } = require('./loadGame');
  const cache = new Map();
  parentPort.on('message', (job) => {
    const key = JSON.stringify(job.cfg.overrides || null);
    let G = cache.get(key);
    if (!G) {
      if (cache.size > 8) cache.clear();
      G = loadGame({ overrides: job.cfg.overrides });
      cache.set(key, G);
    }
    const out = job.seeds.map((s) => runOne(G, job.cfg, s));
    parentPort.postMessage({ id: job.id, out });
  });
}

class Pool {
  constructor(n) {
    this.n = Math.max(1, n || Math.max(1, os.cpus().length - 1));
    this.workers = [];
    this.queue = [];
    this.pending = new Map();
    this.idle = [];
    this.seq = 0;
    for (let i = 0; i < this.n; i++) {
      const w = new Worker(path.join(__dirname, 'pool.js'));
      w.on('message', (msg) => {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        p.resolve(msg.out);
        this.idle.push(w);
        this.pump();
      });
      w.on('error', (e) => { console.error('worker 出错:', e); });
      this.workers.push(w);
      this.idle.push(w);
    }
  }
  pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop();
      const job = this.queue.shift();
      this.pending.set(job.id, job);
      w.postMessage({ id: job.id, cfg: job.cfg, seeds: job.seeds });
    }
  }
  // 跑 N 局：种子 seedBase .. seedBase+N-1（A/B 用同一批种子 = 公共随机数，差值更稳）
  run(cfg, runs, seedBase = 1, onProgress) {
    const chunk = Math.max(2, Math.min(25, Math.ceil(runs / (this.n * 4))));
    const promises = [];
    let done = 0;
    for (let s = 0; s < runs; s += chunk) {
      const seeds = [];
      for (let k = s; k < Math.min(runs, s + chunk); k++) seeds.push(seedBase + k);
      promises.push(new Promise((resolve) => {
        this.queue.push({ id: ++this.seq, cfg, seeds, resolve: (out) => { done += out.length; if (onProgress) onProgress(done, runs); resolve(out); } });
      }));
    }
    this.pump();
    return Promise.all(promises).then((parts) => parts.flat());
  }
  close() { for (const w of this.workers) w.terminate(); }
}

module.exports = { Pool, runOne, compact };
