'use strict';
// 把游戏本体的 v14Meta / v14Data / v14Engine 原样加载进一个 Node vm 沙箱，
// 并从 v14Main.js 里直接摘出「纯逻辑」方法（Boss 意图、抽牌、商店货架…），
// 让模拟器和游戏共用同一份数据与结算代码，避免两边漂移。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const GAME_ROOT = path.resolve(__dirname, '..', '..');
const JS_DIR = path.join(GAME_ROOT, 'js');

// 直接从 v14Main.js 摘出来执行的方法（不含任何 DOM）
const EXTRACT_METHODS = ['prepareBossIntent', 'drawToHandSize', 'getRemainingHand', 'rollShopOffers', 'getPackCost'];
// 混有 UI 的流程方法：模拟器在 flow.js 里镜像了它们的规则，这里只做「逻辑指纹」校验
const MIRRORED_METHODS = [
  'startNewRun', 'startWaveBattle', 'beginRound', 'handleDiscardButton', 'handleStrikeButton',
  'finishBattle', 'openShop', 'rerollShop', 'buyRelicOffer', 'upgradeSlot', 'openPack',
  'selectInscriptionTarget', 'spendGold', 'handleShopAdReroll'
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readJs(name) {
  return fs.readFileSync(path.join(JS_DIR, name), 'utf8');
}

// 取类方法源码：从 `    name(` 那一行到下一行恰好是 `    }` 为止（v14Main 的 4 空格缩进约定）
function extractClassMethod(src, name) {
  const lines = src.split('\n');
  const re = new RegExp('^    (async\\s+)?' + name + '\\s*\\(');
  const start = lines.findIndex((l) => re.test(l));
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && lines[end] !== '    }') end++;
  if (end >= lines.length) return null;
  return lines.slice(start, end + 1).join('\n');
}

function extractTopFunction(src, name) {
  const lines = src.split('\n');
  const re = new RegExp('^  function ' + name + '\\s*\\(');
  const start = lines.findIndex((l) => re.test(l));
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && lines[end] !== '  }') end++;
  return lines.slice(start, end + 1).join('\n');
}

// 只保留「会影响数值」的行，滤掉 DOM / 动画 / 音效 / 提示，避免改 UI 也报警
const UI_LINE = /\$\(|classList|innerHTML|textContent|\.style|audio|battleStage|tavernShopStage|packCeremonyFX|altarBg|heroMusterStage|themeSanctumStage|toast\(|tryUnlockAch|triggerHeroCutIn|sync\w*UI|syncBattleHudOnly|render\w*\(|setTimeout|await |_battleToken|token\)|document\.|getBoundingClientRect|querySelector|playEvents|snapshotBattleHud|Snap\b|schedulePo|closeShopInspector|_closePayoutModal|_stop\w+\(|_start\w+\(|onclick|onpointer|playRewardedAd|meta\.save|saveActiveRun|^\s*\/\//;
function logicFingerprint(methodSrc) {
  if (!methodSrc) return 'MISSING';
  const kept = methodSrc
    .split('\n')
    .filter((l) => !UI_LINE.test(l))
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
  return crypto.createHash('sha1').update(kept).digest('hex').slice(0, 12);
}

function computeFingerprints() {
  const mainSrc = readJs('v14Main.js');
  const out = {};
  for (const m of MIRRORED_METHODS) out[m] = logicFingerprint(extractClassMethod(mainSrc, m));
  return out;
}

const LOCK_PATH = path.join(__dirname, '..', 'flow.lock.json');
function checkDrift() {
  const now = computeFingerprints();
  let lock = null;
  try { lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8')); } catch (e) { /* 首次运行 */ }
  if (!lock) return { ok: true, firstRun: true, changed: [], now };
  const changed = MIRRORED_METHODS.filter((m) => lock.methods && lock.methods[m] !== now[m]);
  return { ok: changed.length === 0, firstRun: false, changed, now, lock };
}
function writeLock(note = '') {
  const now = computeFingerprints();
  fs.writeFileSync(LOCK_PATH, JSON.stringify({ note, updatedAt: new Date().toISOString(), methods: now }, null, 2));
  return now;
}

function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

// overrides 格式见 sim/README.md
function applyOverrides(G, ov) {
  if (!ov) return;
  if (typeof ov === 'function') { ov(G); return; }
  const D = G.D;
  if (ov.data) {
    for (const [k, v] of Object.entries(ov.data)) {
      if (k === 'WAVE_CONFIG' && v && !Array.isArray(v)) {
        for (const [w, p] of Object.entries(v)) {
          const cfg = D.WAVE_CONFIG.find((c) => String(c.wave) === String(w));
          if (cfg) Object.assign(cfg, p);
        }
      } else if (v && typeof v === 'object' && !Array.isArray(v) && D[k] && typeof D[k] === 'object') {
        deepMerge(D[k], v);
      } else {
        D[k] = v;
      }
    }
  }
  const patchList = (list, patches, onNew) => {
    if (!patches) return;
    for (const [id, p] of Object.entries(patches)) {
      if (p === null) { // 删除
        const i = list.findIndex((x) => x.id === id);
        if (i >= 0) list.splice(i, 1);
        continue;
      }
      const cur = list.find((x) => x.id === id);
      if (cur) deepMerge(cur, p);
      else {
        const neo = { id, ...p };
        list.push(neo);
        if (onNew) onNew(neo);
      }
    }
  };
  patchList(D.SHOP_HEROES, ov.cards, (c) => { c.cost = c.cost || 5; });
  if (ov.starters) {
    for (const [id, p] of Object.entries(ov.starters)) if (D.STARTER_TEMPLATES[id]) deepMerge(D.STARTER_TEMPLATES[id], p);
  }
  // ALL_HERO_MAP 需要和卡池同步（新卡、改卡）
  for (const h of D.SHOP_HEROES) D.ALL_HERO_MAP[h.id] = h;
  for (const h of Object.values(D.STARTER_TEMPLATES)) D.ALL_HERO_MAP[h.id] = h;
  patchList(D.RELICS, ov.relics, (r) => { r.cost = r.cost || 5; });
  patchList(G.HEROES, ov.heroes);
  patchList(D.BOSS_POOL, ov.bosses);
  if (ov.ascensions) {
    for (const [lv, p] of Object.entries(ov.ascensions)) {
      const a = G.META.ASCENSIONS.find((x) => String(x.lv) === String(lv));
      if (a) Object.assign(a, p);
    }
  }
  if (ov.bossHpMult) for (const c of D.WAVE_CONFIG) c.hp = Math.round(c.hp * ov.bossHpMult);
  if (ov.bossDmgMult) for (const c of D.WAVE_CONFIG) { c.heavyDmg = Math.round(c.heavyDmg * ov.bossDmgMult); c.ultDmg = Math.round(c.ultDmg * ov.bossDmgMult); }
}

function loadOverridesFile(file) {
  if (!file) return null;
  const abs = path.resolve(file);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

// 建立一个全新的游戏沙箱。每个配置（A/B、调参）各用一个，互不污染。
function loadGame(opts = {}) {
  let rng = mulberry32(opts.seed || 1);
  const store = {};
  const sandbox = {
    console,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
    performance: { now: () => 0 }
  };
  sandbox.window = sandbox;
  sandbox.__rng = () => rng();
  vm.createContext(sandbox);
  vm.runInContext('Math.random = function () { return __rng(); };', sandbox);
  for (const f of ['v14Meta.js', 'v14Data.js', 'v14Engine.js']) {
    vm.runInContext(readJs(f), sandbox, { filename: f });
  }
  const mainSrc = readJs('v14Main.js');
  const methodSrcs = EXTRACT_METHODS.map((m) => {
    const s = extractClassMethod(mainSrc, m);
    if (!s) throw new Error(`v14Main.js 里找不到方法 ${m}()，模拟器需要更新 loadGame.js`);
    return s.trim();
  });
  const shuffleSrc = extractTopFunction(mainSrc, 'shuffle');
  const factory = vm.runInContext(
    `(function (D, E) {\n${shuffleSrc}\nreturn { shuffle, methods: {\n${methodSrcs.join(',\n')}\n} };\n})`,
    sandbox,
    { filename: 'v14Main.extracted.js' }
  );
  const D = sandbox.MT.V14_DATA;
  const E = sandbox.MT.V14_ENGINE;
  const META = sandbox.MT.V14_META;
  const extracted = factory(D, E);
  const G = {
    D, E, META,
    HEROES: META.HEROES_META,
    shuffle: extracted.shuffle,
    mainMethods: extracted.methods,
    sandbox,
    reseed(seed) { rng = mulberry32(seed); },
    random: () => rng()
  };
  applyOverrides(G, opts.overrides);
  return G;
}

module.exports = { loadGame, checkDrift, writeLock, computeFingerprints, loadOverridesFile, applyOverrides, mulberry32, GAME_ROOT, MIRRORED_METHODS };
