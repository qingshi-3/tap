import { battleDelay, battleElapsed } from './battle-motion.js';
import { assetImage as image, assetFetch, assetFont } from './asset-loading.js';
import { EFFECT_MANIFEST } from './effect-manifest.js';
import { getHero } from './factions.js';
import { drawAtlasFrame, framesWithPrefix, parsePlist } from './atlas.js';
import { effectDependencies } from './battle-assets.js';

const ROOT = './assets/';
const DEFAULT_FRAME_MS = 80;

function localPath(value, fallbackFolder = 'fx') {
  if (!value) return null;
  const path = String(value).replaceAll('\\', '/').replace(/^\.\//, '');
  if (path.startsWith('assets/')) return `./${path}`;
  if (path.startsWith('dist/assets/')) return `./${path.slice(5)}`;
  if (path.includes('/')) return `${ROOT}${path.replace(/^.*?assets\//, '')}`;
  return `${ROOT}${fallbackFolder}/${path}`;
}

function color(value, alpha = 1) {
  if (!value) return `rgba(255,255,255,${alpha})`;
  if (typeof value === 'string') return value;
  const component = (key) => Math.max(0, Math.min(255, Number(value[key] ?? 255)));
  return `rgba(${component('r')},${component('g')},${component('b')},${alpha})`;
}

function flatten(entries, seed = 0) {
  const output = [];
  for (const entry of Array.isArray(entries) ? entries : entries ? [entries] : []) {
    if (!entry) continue;
    if (entry.chooseOneRandomly) {
      const choices = entry.chooseOneRandomly;
      const choice = choices[Math.abs(seed) % choices.length];
      output.push(typeof choice === 'string' ? { ...entry, resource: choice, chooseOneRandomly: undefined } : choice);
    } else output.push(entry);
  }
  return output;
}

function eventList(recipe, names) {
  if (!recipe) return [];
  return names.flatMap((name) => recipe[name] ?? []);
}

function noise(index, salt = 0) {
  const value = Math.sin(index * 91.345 + salt * 17.123) * 47453.5453;
  return value - Math.floor(value);
}

export class EffectsPlayer {
  constructor(renderer) {
    this.renderer = renderer;
    this.manifest = EFFECT_MANIFEST ?? {};
    this.atlases = new Map();
    this.staticImages = new Map();
    this.additiveImages = new WeakMap();
    this.particleTextures = new Map();
    this.particleTintCache = new WeakMap();
    this.statImages = {};
    this.playback = null;
    this.audio = new Map();
    this.audioBuffers = new Map();
    this.audioJobs = new Map();
    this.failedSounds = new Set();
    this.audioBytes = 0;
    this.activeSounds = new Set();
    this.mediaVoices = new Map();
    this.mediaVoiceCount = 0;
    this.mediaGeneration = new WeakMap();
    this.warmAudioSignature = null;
    try { const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext; this.audioContext = Context ? new Context({latencyHint:'interactive'}) : null; }
    catch { this.audioContext = null; }
    this.soundVolume = 1;
    this.soundGain = this.audioContext?.createGain() ?? null;
    this.soundGain?.connect(this.audioContext.destination);
    this.frameLists = new WeakMap();
    this.persistentEntries = new Map();
  }

  async load(cardIds = null) {
    const selected = cardIds ? effectDependencies(cardIds, this.manifest) : null;
    const options = { priority: cardIds ? 1 : 0 };
    const recipes = selected?.recipes ?? Object.values(this.manifest.recipes ?? {});
    const resources = selected ? selected.resources.map(key => this.manifest.resources[key]) : Object.values(this.manifest.resources ?? {});
    await Promise.all(resources.map(async (resource) => {
      const key = resource.spriteIdentifier ?? resource.identifier ?? resource.name;
      const imgPath = localPath(resource.local?.img ?? resource.localImg ?? resource.img ?? resource.image);
      const plistPath = localPath(resource.local?.plist ?? resource.localPlist ?? resource.plist);
      if (!key || !imgPath) return;
      if (!plistPath) {
        const value = await image(imgPath, options);
        if (!value && selected) throw new Error('战斗特效图片未能加载，请重试。');
        if (value) this.staticImages.set(key, value);
        return;
      }
      if (this.atlases.has(key)) return;
      try {
        const [atlasImage, response] = await Promise.all([image(imgPath, options), assetFetch(plistPath, options)]);
        if (!atlasImage || !response.ok) { if (selected) throw new Error('战斗特效图集未能加载，请重试。'); return; }
        this.atlases.set(key, {
          image: atlasImage,
          frames: parsePlist(await response.text()),
          prefix: resource.framePrefix ?? resource.prefix ?? '',
          frameMs: resource.frameMs ?? ((resource.frameDelaySeconds ?? resource.frameDelay) ? (resource.frameDelaySeconds ?? resource.frameDelay) * 1000 : DEFAULT_FRAME_MS)
        });
      } catch (error) { if (selected) throw error; /* Full audit retains optional fallback reporting. */ }
    }));
    const staticPaths = new Set(selected?.staticPaths ?? []);
    for (const recipe of recipes) {
      for (const entries of Object.values(recipe ?? {})) for (const item of flatten(entries)) {
        const identifier = item?.spriteIdentifier;
        if (typeof identifier === 'string' && /\.png$/i.test(identifier)) staticPaths.add(identifier);
      }
    }
    await Promise.all([...staticPaths].map(async (path) => {
      const normalized = path.replace(/^resources\//, '');
      const value = await image(localPath(normalized), options);
      if (!value && selected) throw new Error('战斗特效图片未能加载，请重试。');
      if (value) this.staticImages.set(path, value);
    }));
    await Promise.all(Object.entries(this.manifest.particles ?? {}).filter(([key]) => !selected || selected.particles.includes(key)).map(async ([key, params]) => {
      if (this.particleTextures.has(key)) return;
      if (!params.textureImageData || typeof DecompressionStream === 'undefined') return;
      try {
        const binary = atob(String(params.textureImageData).replace(/\s/g, ''));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        const blob = await new Response(stream).blob();
        const url = URL.createObjectURL(blob);
        const value = await image(url);
        URL.revokeObjectURL(url);
        if (value) this.particleTextures.set(key, value);
      } catch { /* Procedural particles remain available when embedded texture decoding is unavailable. */ }
    }));
    // Convert the original static additive/particle textures before battle input.
    // Yield between textures so resource preparation does not become one long task.
    const additiveSources = new Set();
    for (const recipe of recipes) {
      for (const entries of Object.values(recipe ?? {})) for (const item of flatten(entries)) {
        const source = this.staticImages.get(item.spriteIdentifier);
        if (source && item.blendDst === 'ONE') additiveSources.add(source);
      }
    }
    for (const source of additiveSources) {
      this.additiveTexture(source);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    for (const [key, texture] of this.particleTextures) {
      const params = this.manifest.particles[key];
      this.tintedParticleTexture(texture, { r: Number(params.startColorRed ?? 1)*255, g: Number(params.startColorGreen ?? 1)*255, b: Number(params.startColorBlue ?? 1)*255 });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const feedback = this.manifest.statFeedback;
    if (feedback) {
      const [hpBackground, healIcon] = await Promise.all([image(feedback.hpBackground, options), image(feedback.healIcon, options)]);
      if (selected && (!hpBackground || !healIcon)) throw new Error('战斗反馈图片未能加载，请重试。');
      this.statImages = { hpBackground, healIcon };
      if (typeof FontFace !== 'undefined' && feedback.font) {
        try {
          const face = new FontFace(feedback.fontFamily, `url("${feedback.font}")`);
          await assetFont(face);
          document.fonts?.add(face);
        } catch { /* The existing bold UI font remains a readable fallback. */ }
      }
    }
  }

  finish({ cancelAudio = true } = {}) {
    const playback = this.playback;
    if (cancelAudio) for (const sound of this.activeSounds) { try { this.mediaGeneration.set(sound,(this.mediaGeneration.get(sound)??0)+1);sound.stop?.(); sound.pause?.(); sound.disconnect?.(); } catch { /* Already ended. */ } }
    if (cancelAudio) this.activeSounds.clear();
    if (!playback) return;
    this.playback = null;
    for (const timer of playback.timers) clearTimeout(timer);
    playback.resolve?.();
    this.renderer.paint();
  }

  play(action, beforeUnits = []) {
    this.finish({cancelAudio:false});
    if (!action || this.renderer.motionPreference.matches) return Promise.resolve();
    const after = this.renderer.state?.units ?? [];
    const byBefore = new Map(beforeUnits.map((unit) => [unit.unitId, unit]));
    const byAfter = new Map(after.map((unit) => [unit.unitId, unit]));
    const sourceId = action.sourceId ?? action.unitId;
    const targetIds = [...new Set([...(action.targetIds ?? []), action.targetId].filter((id) => id != null))];
    const cardId = action.cardId ?? byAfter.get(sourceId)?.cardId ?? byBefore.get(sourceId)?.cardId;
    const source = byAfter.get(sourceId) ?? byBefore.get(sourceId) ?? null;
    const targets = targetIds.map((id) => byAfter.get(id) ?? byBefore.get(id)).filter(Boolean);
    const ghosts = beforeUnits.filter((unit) => !byAfter.has(unit.unitId));
    const statRevealAt = new Map();
    let counterSurvivor = null;
    let counterResolvedAt = null;
    const bodyStates = new Map();
    const birthAt = new Map();
    const entries = [];
    const startedAt = performance.now();
    const timers = [];
    const schedule = (callback, delay) => setTimeout(callback, battleDelay(delay));
    const addBody = (unit, state, at = 0) => {
      const animationDuration = unit ? this.bodyDuration(unit.cardId, state) : 0;
      if (!unit || !animationDuration) return;
      entries.push({ kind: 'body', unit, state, at, animationDuration, duration: animationDuration + (state === 'death' ? 1000 : 0) });
    };
    const addRecipe = (recipe, names, units, at = 0, scope = 'target', sourceUnit = source) => {
      for (const unit of units) {
        for (const item of flatten(eventList(recipe, names), Number(unit.unitId ?? 0))) {
          const itemDelay = item.delayMs != null ? Number(item.delayMs) : Number(item.delay ?? 0) * 1000;
          entries.push({ kind: 'recipe', item, unit, sourceUnit, scope, at: at + itemDelay, duration: this.recipeDuration(item) });
        }
      }
    };
    const recipes = this.manifest.recipes ?? {};
    const recipesForCard = (id) => (this.manifest.cardRecipes?.[id] ?? []).map((key) => recipes[key]).filter(Boolean);
    const cardRecipeKeys = this.manifest.cardRecipes?.[cardId] ?? [];
    const spellRecipeKeys = this.manifest.spellRecipes?.[cardId] ?? this.manifest.spellRecipes?.[action.effect] ?? [];
    const resolved = [...(Array.isArray(cardRecipeKeys) ? cardRecipeKeys : [cardRecipeKeys]), ...(Array.isArray(spellRecipeKeys) ? spellRecipeKeys : [spellRecipeKeys])]
      .map((key) => typeof key === 'string' ? recipes[key] : key).filter(Boolean);
    if (action.kind === 'summon') {
      addBody(source, 'idle', 0);
      resolved.forEach((recipe) => addRecipe(recipe, ['UnitSpawnFX', 'unitSpawnFx', 'spawn'], source ? [source] : [], 0, 'game'));
      this.playSound(this.manifest.bodies?.[cardId]?.sounds?.apply);
    } else if (action.kind === 'attack') {
      const delay = Number(this.manifest.bodies?.[cardId]?.attackDelayMs ?? 600);
      if (source && targets[0] && targets[0].x !== source.x) this.renderer.facings.set(source.unitId, targets[0].x < source.x);
      addBody(source, 'attack');
      const attackEvents = ['UnitAttackedFX', 'UnitPrimaryAttackedFX', 'unitAttackedFx', 'attack'];
      const impactDelay = this.impactDelay(resolved, attackEvents);
      const reactionAt = delay + impactDelay;
      targets.forEach((target) => statRevealAt.set(target.unitId, reactionAt));
      const aliveOnFirstImpact = (target) => byAfter.has(target.unitId) || action.retaliated && target.unitId === targets[0]?.unitId;
      targets.forEach((target) => addBody(target, aliveOnFirstImpact(target) ? 'hit' : 'death', reactionAt));
      resolved.forEach((recipe) => addRecipe(recipe, attackEvents, targets, delay, 'game', source));
      for (const target of targets) for (const recipe of recipesForCard(target.cardId)) {
        addRecipe(recipe, ['UnitDamagedFX', 'unitDamagedFx', 'damaged'], aliveOnFirstImpact(target) ? [target] : [], reactionAt, 'target', source);
        addRecipe(recipe, ['UnitDiedFX', 'unitDiedFx', 'died'], aliveOnFirstImpact(target) ? [] : [target], reactionAt, 'target', source);
      }
      this.playSound(this.manifest.bodies?.[cardId]?.sounds?.attack);
      timers.push(schedule(() => {
        this.playSound(this.manifest.bodies?.[cardId]?.sounds?.attackDamage);
        for (const target of targets) {
          const targetSounds = this.manifest.bodies?.[target.cardId]?.sounds;
          this.playSound(aliveOnFirstImpact(target) ? targetSounds?.receiveDamage : targetSounds?.death);
        }
      }, reactionAt));
      if (action.retaliated && targets[0]) {
        const counterDelay = Number(this.manifest.bodies?.[targets[0].cardId]?.attackDelayMs ?? 600);
        const counterRecipes = recipesForCard(targets[0].cardId);
        // Finish the first strike and the defender's hit reaction before countering.
        const counterStartAt = Math.max(this.bodyDuration(cardId, 'attack'), reactionAt + this.bodyDuration(targets[0].cardId, 'hit'));
        const counterGameFxAt = counterStartAt + counterDelay;
        const counterReactionAt = counterGameFxAt + this.impactDelay(counterRecipes, attackEvents);
        if (!byAfter.has(targets[0].unitId)) {
          const before = byBefore.get(targets[0].unitId) ?? targets[0];
          const damage = (action.statChanges ?? []).filter(change => change.unitId === before.unitId && change.kind === 'damage').reduce((sum, change) => sum + Number(change.amount), 0);
          counterSurvivor = {...before,health:Math.max(1,before.health-damage)};
          counterResolvedAt = counterReactionAt;
          addBody(targets[0],'death',counterReactionAt);
          for (const recipe of counterRecipes) addRecipe(recipe,['UnitDiedFX'],[targets[0]],counterReactionAt,'target',targets[0]);
          timers.push(schedule(() => this.playSound(this.manifest.bodies?.[targets[0].cardId]?.sounds?.death),counterReactionAt));
        }
        addBody(targets[0], 'attack', counterStartAt);
        if (source && targets[0].x !== source.x) this.renderer.facings.set(targets[0].unitId, source.x < targets[0].x);
        addBody(source, byAfter.has(sourceId) ? 'hit' : 'death', counterReactionAt);
        if (source) statRevealAt.set(source.unitId, counterReactionAt);
        for (const recipe of counterRecipes) addRecipe(recipe, attackEvents, source ? [source] : [], counterGameFxAt, 'game', targets[0]);
        for (const recipe of recipesForCard(source?.cardId)) {
          addRecipe(recipe, ['UnitDamagedFX'], byAfter.has(sourceId) && source ? [source] : [], counterReactionAt, 'target', targets[0]);
          addRecipe(recipe, ['UnitDiedFX'], !byAfter.has(sourceId) && source ? [source] : [], counterReactionAt, 'target', targets[0]);
        }
        const counterSounds = this.manifest.bodies?.[targets[0].cardId]?.sounds;
        timers.push(schedule(() => this.playSound(counterSounds?.attack), counterStartAt));
        timers.push(schedule(() => {
          this.playSound(counterSounds?.attackDamage);
          const sourceSounds = this.manifest.bodies?.[source?.cardId]?.sounds;
          this.playSound(byAfter.has(sourceId) ? sourceSounds?.receiveDamage : sourceSounds?.death);
        }, counterReactionAt));
      }
    } else if (action.kind === 'spell' || action.kind === 'bbs') {
      const casterBody = this.manifest.bodies?.[source?.cardId];
      if (casterBody?.states?.castStart) {
        const startDuration = this.bodyDuration(source.cardId, 'castStart');
        const loopDuration = this.bodyDuration(source.cardId, 'castLoop');
        addBody(source, 'castStart');
        if (loopDuration) addBody(source, 'castLoop', startDuration);
        addBody(source, casterBody.states.castEnd ? 'castEnd' : 'cast', startDuration + loopDuration);
      } else addBody(source, 'cast');
      const castAnchors = action.effect === 'tempest'
        ? [{ unitId: 'board-center', x: ((this.renderer.state?.board?.columns ?? 9) - 1) / 2, y: ((this.renderer.state?.board?.rows ?? 5) - 1) / 2, owner: source?.owner ?? 0 }]
        : targets.length === 1 ? targets : source ? [source] : [];
      resolved.forEach((recipe) => {
        addRecipe(recipe, ['SpellCastFX', 'spellCastFx', 'cast'], castAnchors, 0, 'game');
        addRecipe(recipe, ['SpellAppliedFX', 'spellAppliedFx', 'applied'], targets, 0, 'target');
        const healed = targets.filter((unit) => Number(byBefore.get(unit.unitId)?.health ?? unit.health) < Number(byAfter.get(unit.unitId)?.health ?? unit.health));
        addRecipe(recipe, ['UnitHealedFX', 'unitHealedFx', 'healed'], healed, 0, 'target');
      });
      for (const target of targets) {
        const before = byBefore.get(target.unitId), alive = byAfter.has(target.unitId);
        if (Number(before?.health ?? target.health) > Number(byAfter.get(target.unitId)?.health ?? 0)) {
          addBody(target, alive ? 'hit' : 'death');
          for (const recipe of recipesForCard(target.cardId)) {
            addRecipe(recipe, ['UnitDamagedFX'], alive ? [target] : [], 0, 'target');
            addRecipe(recipe, ['UnitDiedFX'], alive ? [] : [target], 0, 'target');
          }
        }
      }
      const lightchasers = after.filter((unit) => unit.cardId === 15
        && action.effect === 'heal' && Number(unit.attackBuff ?? 0) > Number(byBefore.get(unit.unitId)?.attackBuff ?? 0));
      addRecipe(recipes['FX.Modifiers.ModifierGenericBuff'], ['ModifierTriggeredTargetFX'], lightchasers, 0, 'target');
      this.playSound(action.sound ?? this.manifest.spellSounds?.[cardId] ?? this.manifest.bodies?.[cardId]?.sounds?.cast);
    }
    if (action.kind === 'end-turn') for (const target of targets) {
      const before = byBefore.get(target.unitId), alive = byAfter.has(target.unitId);
      if (!before || before.health <= (byAfter.get(target.unitId)?.health ?? 0)) continue;
      addBody(target, alive ? 'hit' : 'death');
      for (const recipe of recipesForCard(target.cardId)) addRecipe(recipe, alive ? ['UnitDamagedFX'] : ['UnitDiedFX'], [target], 0, 'target', target);
    }
    // Secondary summons and death wishes belong to their own card's original FX.
    // They may be emitted by a spell, commander passive or another unit's death.
    for (const unit of after.filter((entry) => !byBefore.has(entry.unitId))) {
      if (action.kind === 'summon' && unit.unitId === sourceId) continue;
      // Engine already resolved death wishes; reveal their bodies only at the death impact.
      const sameCellDeath = ghosts.find(ghost => ghost.x === unit.x && ghost.y === unit.y);
      const relatedDeathAt = sameCellDeath ? statRevealAt.get(sameCellDeath.unitId) : null;
      const at = action.kind === 'attack' ? Number(relatedDeathAt ?? Math.max(0,...ghosts.map(ghost=>statRevealAt.get(ghost.unitId)??0))) : 0;
      birthAt.set(unit.unitId,at);
      addBody(unit, 'idle',at);
      for (const recipe of recipesForCard(unit.cardId)) addRecipe(recipe, ['UnitSpawnFX', 'unitSpawnFx', 'spawn'], [unit], at, 'game', unit);
      const apply = this.manifest.bodies?.[unit.cardId]?.sounds?.apply;
      if(at) timers.push(schedule(()=>this.playSound(apply),at));else this.playSound(apply);
    }
    for (const unit of ghosts) {
      if (unit.unitId === sourceId || targetIds.includes(unit.unitId)) continue;
      const at = action.kind === 'attack' ? Math.max(0,...ghosts.map(ghost=>statRevealAt.get(ghost.unitId)??0)) : 0;
      if(action.kind === 'attack') statRevealAt.set(unit.unitId,at);
      addBody(unit, 'death',at);
      for (const recipe of recipesForCard(unit.cardId)) addRecipe(recipe, ['UnitDiedFX', 'unitDiedFx', 'died'], [unit], at, 'target', unit);
    }
    const feedback = this.manifest.statFeedback;
    if (feedback) for (const change of action.statChanges ?? []) {
      if (!change || Number(change.amount) <= 0 || !['damage', 'heal'].includes(change.kind)) continue;
      const unit = byAfter.get(change.unitId) ?? byBefore.get(change.unitId);
      if (!unit) continue;
      const reactionAt = action.kind === 'attack' ? Number(statRevealAt.get(change.unitId) ?? 0) : 0;
      entries.push({
        kind: 'stat', unit, change: { ...change, amount: Number(change.amount) },
        at: reactionAt + Number(feedback.delayMs ?? 93.75),
        duration: Number(feedback.growMs ?? 225) + Number(feedback.holdMs ?? 375) + Number(feedback.shrinkMs ?? 150)
      });
    }
    if (!entries.length) return Promise.resolve();
    const duration = Math.max(1, ...entries.map((entry) => entry.at + entry.duration));
    let resolve;
    const completed = new Promise((done) => { resolve = done; });
    for (const entry of entries) if (entry.kind === 'body') {
      const unitEntries = bodyStates.get(entry.unit.unitId) ?? [];
      unitEntries.push(entry); bodyStates.set(entry.unit.unitId, unitEntries);
    }
    for (const unitEntries of bodyStates.values()) unitEntries.sort((a,b) => b.at-a.at || ({death:3,hit:2}[b.state]??1)-({death:3,hit:2}[a.state]??1));
    this.playback = { action, startedAt, duration, entries, ghosts, bodyStates, timers, resolve, byBefore, byAfter, statRevealAt, counterSurvivor, counterResolvedAt, birthAt };
    timers.push(schedule(() => this.finish({cancelAudio:false}), duration + 20));
    // Publish the render snapshot now; the next frame combines this with the committed HUD/options.
    this.renderer.onVisualFrame?.(this.displayUnits(startedAt));
    this.renderer.requestPaint();
    return completed;
  }

  bodyDuration(cardId, state) {
    const body = this.manifest.bodies?.[cardId];
    const spec = body?.states?.[state] ?? (state === 'hit' ? body?.states?.damage : null);
    const atlas = body && this.renderer.atlases.get(body.sheet);
    const frames = atlas?.animations?.[state]?.frames ?? atlas?.animations?.damage?.frames ?? [];
    return frames.length * Number(spec?.frameMs ?? DEFAULT_FRAME_MS);
  }

  recipeDuration(item) {
    if (item.durationMs != null) return Number(item.durationMs);
    const explicitDuration = item.duration != null ? Number(item.duration) * (Number(item.duration) < 20 ? 1000 : 1) : 0;
    const particle = this.manifest.particles?.[item.plistFile ?? item.plist];
    if (particle) return (Math.max(0, Number(particle.duration ?? 0)) + Math.max(.05, Number(particle.particleLifespan ?? 1) + Number(particle.particleLifespanVariance ?? 0))) * 1000;
    const atlas = this.resourceAtlas(item);
    if (atlas) return Math.max(explicitDuration, DEFAULT_FRAME_MS, this.atlasFrames(atlas, atlas.prefix).length * atlas.frameMs);
    if (explicitDuration) return explicitDuration;
    if (item.moveDuration != null) return Number(item.moveDuration) * 1000;
    return 850;
  }

  impactDelay(recipes, eventNames) {
    let maximum = 0;
    for (const recipe of recipes) for (const item of flatten(eventList(recipe, eventNames))) {
      const itemDelay = item.delayMs != null ? Number(item.delayMs) : Number(item.delay ?? 0) * 1000;
      const type = String(item.type ?? item.runtimeType ?? '').toLowerCase();
      const impact = type.includes('energybeam') || item.impactAtEnd === true ? this.recipeDuration(item) : 0;
      maximum = Math.max(maximum, itemDelay + impact);
    }
    return maximum;
  }

  resourceAtlas(item) {
    const raw = item.spriteIdentifier ?? item.resource ?? item.name;
    const key = Array.isArray(raw) ? raw[0] : raw;
    return this.atlases.get(key) ?? this.atlases.get(String(key ?? '').replace(/^RSX\.|\.name$/g, ''));
  }

  bodyState(unitId, now = performance.now()) {
    const playback = this.playback;
    if (!playback) return null;
    const elapsed = battleElapsed(now, playback.startedAt);
    const unitEntries = playback.bodyStates.get(unitId) ?? [];
    const entry = unitEntries.find((candidate) => elapsed >= candidate.at && elapsed < candidate.at + candidate.duration);
    if (entry) return { state: entry.state, elapsed: Math.min(elapsed - entry.at, (entry.animationDuration ?? entry.duration) - 1) };
    const death = unitEntries.find((candidate) => candidate.state === 'death' && elapsed >= candidate.at + candidate.duration);
    return death ? { state: 'death', elapsed: Math.max(0, death.duration - 1), frozen: true } : null;
  }

  ghosts() { return this.playback?.ghosts ?? []; }

  displayUnit(unit, now = performance.now()) {
    const playback = this.playback;
    if (!playback) return unit;
    if (playback.action.kind !== 'attack') return playback.byAfter.has(unit.unitId) ? unit : {...unit,health:0};
    const revealAt = playback.statRevealAt.get(unit.unitId);
    if (revealAt == null) return unit;
    const elapsed = battleElapsed(now, playback.startedAt);
    if (elapsed < revealAt) return playback.byBefore.get(unit.unitId) ?? unit;
    if (playback.counterSurvivor?.unitId === unit.unitId && elapsed < playback.counterResolvedAt) return playback.counterSurvivor;
    return playback.byAfter.get(unit.unitId) ?? { ...(playback.byBefore.get(unit.unitId) ?? unit), health: 0 };
  }

  displayUnits(now = performance.now()) {
    const stateUnits = this.renderer.state?.units ?? [];
    if (!this.playback) return stateUnits;
    const livingIds = new Set(stateUnits.map((unit) => unit.unitId));
    return [...stateUnits.filter(unit => battleElapsed(now, this.playback.startedAt) >= (this.playback.birthAt.get(unit.unitId) ?? 0)), ...this.ghosts().filter((unit) => !livingIds.has(unit.unitId))]
      .map((unit) => this.displayUnit(unit, now));
  }

  unitOpacity(unitId, now = performance.now()) {
    const playback = this.playback;
    if (!playback) return 1;
    if (playback.action.kind === 'summon' && (playback.action.sourceId ?? playback.action.unitId) === unitId) {
      return Math.min(1, Math.max(0, battleElapsed(now, playback.startedAt) / 350));
    }
    const elapsed = battleElapsed(now, playback.startedAt);
    const death = playback.bodyStates.get(unitId)?.find((entry) => entry.state === 'death');
    if (death && elapsed > death.at + death.animationDuration) return Math.max(0, 1 - (elapsed - death.at - death.animationDuration) / 1000);
    return 1;
  }

  draw(ctx, metrics, now = performance.now(), pass = 'front') {
    const playback = this.playback;
    if (!playback) return;
    const elapsed = battleElapsed(now, playback.startedAt);
    for (const entry of playback.entries) {
      if (elapsed < entry.at || elapsed >= entry.at + entry.duration) continue;
      if (entry.kind === 'stat') {
        if (pass === 'front') this.drawStatFeedback(ctx, metrics, entry, elapsed - entry.at);
        continue;
      }
      if (entry.kind !== 'recipe') continue;
      const behind = Number(entry.item.zOrder ?? 0) < 0 || String(entry.item.type ?? '').toLowerCase().includes('decal');
      if ((pass === 'back') !== behind) continue;
      this.drawRecipe(ctx, metrics, entry, elapsed - entry.at);
    }
  }

  drawRecipe(ctx, metrics, entry, elapsed) {
    const item = entry.item;
    const source = item.atSource ? entry.sourceUnit : null;
    const anchor = source ?? entry.unit;
    const cell = this.renderer.cellGeometry(metrics, anchor.x, anchor.y);
    const boardScale = cell.width / 95;
    const offset = item.offset ?? item.position ?? {};
    const gameLift = entry.scope === 'game' ? 47.5 : entry.scope === 'target' ? 39 : 0;
    const x = cell.center.x + Number(offset.x ?? 0) * boardScale;
    const y = cell.center.y - (Number(offset.y ?? 0) + gameLift) * boardScale;
    const type = String(item.type ?? item.runtimeType ?? '').toLowerCase();
    if (type.includes('light')) return this.drawLight(ctx, x, y, item, elapsed, entry.duration, boardScale);
    if (type.includes('particle')) return this.drawParticles(ctx, x, y, item, elapsed, boardScale);
    if (type.includes('beam') || item.sourceToTarget || item.targetToSource) return this.drawBeam(ctx, x, y, item, elapsed, entry.duration, boardScale, entry.sourceUnit);
    if (type.includes('shockwave')) return this.drawShockwave(ctx, x, y, item, elapsed, entry.duration, boardScale);
    if (type.includes('vortex') || type.includes('flare') || type.includes('ring')) return this.drawVortex(ctx, x, y, item, elapsed, entry.duration, boardScale);
    const staticImage = this.staticImages.get(item.spriteIdentifier);
    if (staticImage) {
      const scale = boardScale * Number(item.scale ?? 2);
      ctx.save(); ctx.translate(x, y); ctx.rotate(((item.rotation ?? 0) + Number(item.xyzRotation?.z ?? 0) + Number(item.xyzRotationPerSecond?.z ?? 0) * elapsed / 1000) * Math.PI / 180);
      ctx.scale(1, Math.max(.2, Math.cos(Number(item.xyzRotation?.x ?? 0) * Math.PI / 180)));
      ctx.globalCompositeOperation = item.blendDst === 'ONE' ? 'lighter' : 'source-over';
      ctx.globalAlpha = Number(item.opacity ?? 255) / 255;
      if (item.colorByOwner) ctx.filter = entry.unit.owner === 0 ? 'hue-rotate(165deg) saturate(1.35)' : 'hue-rotate(330deg) saturate(1.35)';
      const pulse = item.pulseScaleMin != null
        ? Number(item.pulseScaleMin) + (1 - Number(item.pulseScaleMin)) * (.5 + Math.sin(elapsed / 300) * .5) : 1;
      const drawable = item.blendDst === 'ONE' ? this.additiveTexture(staticImage) : staticImage;
      ctx.drawImage(drawable, -drawable.width * scale * pulse / 2, -drawable.height * scale * pulse / 2, drawable.width * scale * pulse, drawable.height * scale * pulse); ctx.restore();
      return;
    }
    const atlas = this.resourceAtlas(item);
    if (!atlas) return;
    const frames = this.atlasFrames(atlas, item.framePrefix ?? atlas.prefix);
    if (!frames.length) return;
    const rawIndex = Math.floor(elapsed / atlas.frameMs);
    const frame = frames[item.looping ? rawIndex % frames.length : Math.min(frames.length - 1, rawIndex)];
    const scale = 2 * boardScale * Number(item.scale ?? 1);
    drawAtlasFrame(ctx, atlas.image, frame, x, y, {
      scale, scaleX: scale * Number(item.scaleX ?? 1), scaleY: scale * Number(item.scaleY ?? 1),
      flipX: item.flippedX, flipY: item.flippedY, rotation: item.rotation ?? item.rotationDegrees ?? 0,
      alpha: item.opacity == null ? 1 : Number(item.opacity) / (Number(item.opacity) > 1 ? 255 : 1),
      tint: item.color ? color(item.color) : null, tintAlpha: item.color ? .4 : 0,
      glow: item.glow ?? (type.includes('decal') ? 0 : cell.width * .05)
    });
  }

  atlasFrames(atlas, prefix = '') {
    let lists = this.frameLists.get(atlas);
    if (!lists) { lists = new Map(); this.frameLists.set(atlas, lists); }
    if (!lists.has(prefix)) lists.set(prefix, framesWithPrefix(atlas.frames, prefix));
    return lists.get(prefix);
  }

  drawPersistent(ctx, metrics, unit, recipeKey, now = performance.now()) {
    const recipe = this.manifest.recipes?.[recipeKey];
    const cacheKey = `${recipeKey}:${unit.unitId}`;
    let items = this.persistentEntries.get(cacheKey);
    if (!items) {
      items = flatten(eventList(recipe, ['ModifierFX']), Number(unit.unitId ?? 0));
      if (this.persistentEntries.size >= 128) this.persistentEntries.delete(this.persistentEntries.keys().next().value);
      this.persistentEntries.set(cacheKey, items);
    }
    for (const item of items) {
      this.drawRecipe(ctx, metrics, { item, unit, scope: 'target', duration: 1000 }, now % 1000);
    }
  }

  drawStatFeedback(ctx, metrics, entry, elapsed) {
    const feedback = this.manifest.statFeedback;
    if (!feedback) return;
    const cell = this.renderer.cellGeometry(metrics, entry.unit.x, entry.unit.y);
    const boardScale = cell.width / 95;
    const grow = Number(feedback.growMs ?? 225), hold = Number(feedback.holdMs ?? 375), shrink = Number(feedback.shrinkMs ?? 150);
    const c1 = 1.70158, c3 = c1 + 1;
    let scale = 1;
    if (elapsed < grow) {
      const t = Math.max(0, elapsed / grow), shifted = t - 1;
      scale = 1 + c3 * shifted * shifted * shifted + c1 * shifted * shifted;
    } else if (elapsed >= grow + hold) {
      const t = Math.min(1, (elapsed - grow - hold) / shrink);
      scale = 1 - (c3 * t * t * t - c1 * t * t);
    }
    const x = cell.center.x;
    const y = cell.center.y - 39 * boardScale + Number(feedback.offsetY ?? 10) * boardScale;
    const background = entry.change.kind === 'heal' ? this.statImages.healIcon : this.statImages.hpBackground;
    ctx.save(); ctx.translate(x, y); ctx.scale(scale * boardScale, scale * boardScale);
    if (background) ctx.drawImage(background, -background.naturalWidth / 2, -background.naturalHeight / 2);
    ctx.fillStyle = color(feedback.hpColor ?? { r: 252, g: 0, b: 2 });
    ctx.font = `${Number(feedback.fontSize ?? 20)}px "${feedback.fontFamily ?? 'Averta'}", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(entry.change.kind === 'damage' ? `-${entry.change.amount}` : String(entry.change.amount), 0, 0);
    ctx.restore();
  }

  additiveTexture(source) {
    if (this.additiveImages.has(source)) return this.additiveImages.get(source);
    const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth || source.width; canvas.height = source.naturalHeight || source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const brightness = Math.max(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]) / 255;
      pixels.data[index + 3] = Math.round(pixels.data[index + 3] * brightness);
    }
    context.clearRect(0, 0, canvas.width, canvas.height); context.putImageData(pixels, 0, 0);
    this.additiveImages.set(source, canvas); return canvas;
  }

  drawLight(ctx, x, y, item, elapsed, duration, scale) {
    // Original lights illuminate the scene through a perspective lighting pass.
    // Canvas screen blending is only a local glow; copying that world-space
    // radius washes out the whole short phone viewport and unrelated units.
    const radius = Math.min(133, Number(item.radius ?? 160)) * scale;
    const fade = Math.sin(Math.PI * Math.min(1, elapsed / duration));
    const alpha = Math.min(.18, Number(item.intensity ?? 2) * .02) * fade;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color(item.color, alpha)); gradient.addColorStop(.5, color(item.color, alpha * .35)); gradient.addColorStop(1, color(item.color, 0));
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
  }

  drawParticles(ctx, x, y, item, elapsed, scale) {
    const particleKey = item.plistFile ?? item.plist;
    const params = this.manifest.particles?.[particleKey] ?? item;
    const count = Math.min(80, Number(params.maxParticles ?? params.particleCount ?? 28));
    const baseLife = Number(params.particleLifespan ?? 1) * 1000;
    const texture = this.particleTextures.get(particleKey);
    ctx.save(); ctx.globalCompositeOperation = params.blendFuncDestination === 1 ? 'lighter' : 'source-over';
    for (let index = 0; index < count; index++) {
      const life = Math.max(50, baseLife + (noise(index, 1) * 2 - 1) * Number(params.particleLifespanVariance ?? 0) * 1000);
      const age = (elapsed + index * life / count) % life / life;
      const angle = (Number(params.angle ?? 90) + (noise(index, 2) * 2 - 1) * Number(params.angleVariance ?? 0)) * Math.PI / 180;
      const speed = (Number(params.speed ?? 45) + (noise(index, 3) * 2 - 1) * Number(params.speedVariance ?? 0)) * scale;
      const seconds = age * life / 1000;
      const px = x + (noise(index, 4) * 2 - 1) * Number(params.sourcePositionVariancex ?? 0) * scale + Math.cos(angle) * speed * seconds + Number(params.gravityx ?? 0) * seconds * seconds * scale / 2;
      const py = y + (noise(index, 5) * 2 - 1) * Number(params.sourcePositionVariancey ?? 0) * scale - Math.sin(angle) * speed * seconds - Number(params.gravityy ?? 0) * seconds * seconds * scale / 2;
      const startSize = Number(params.startParticleSize ?? 8) + (noise(index, 6) * 2 - 1) * Number(params.startParticleSizeVariance ?? 0);
      const size = Math.max(1, (startSize + (Number(params.finishParticleSize ?? startSize) - startSize) * age) * scale);
      const alpha = Math.max(0, Number(params.startColorAlpha ?? 1) + (Number(params.finishColorAlpha ?? 0) - Number(params.startColorAlpha ?? 1)) * age);
      const particleColor = { r: Number(params.startColorRed ?? 1) * 255, g: Number(params.startColorGreen ?? 1) * 255, b: Number(params.startColorBlue ?? 1) * 255 };
      ctx.globalAlpha = alpha;
      if (texture) {
        const tinted = this.tintedParticleTexture(texture, particleColor);
        ctx.drawImage(tinted, px - size / 2, py - size / 2, size, size);
      }
      else { ctx.fillStyle = color(particleColor, 1); ctx.fillRect(px - size / 2, py - size / 2, size, size); }
    }
    ctx.restore();
  }

  tintedParticleTexture(source, tint) {
    const key = `${Math.round(tint.r)},${Math.round(tint.g)},${Math.round(tint.b)}`;
    let variants = this.particleTintCache.get(source);
    if (!variants) { variants = new Map(); this.particleTintCache.set(source, variants); }
    if (variants.has(key)) return variants.get(key);
    const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth || source.width; canvas.height = source.naturalHeight || source.height;
    const context = canvas.getContext('2d'); context.drawImage(source, 0, 0);
    context.globalCompositeOperation = 'multiply'; context.fillStyle = color(tint); context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'destination-in'; context.drawImage(source, 0, 0);
    variants.set(key, canvas); return canvas;
  }

  drawBeam(ctx, x, y, item, elapsed, duration, scale, source) {
    const sourceCell = source ? this.renderer.cellGeometry(this.renderer.boardMetrics(this.renderer.canvas.clientWidth, this.renderer.canvas.clientHeight), source.x, source.y) : null;
    const sourceOffset = item.sourceOffset ?? {};
    const targetOffset = item.targetOffset ?? {};
    const start = sourceCell ? {
      x: sourceCell.center.x + Number(sourceOffset.x ?? 0) * scale,
      y: sourceCell.center.y - (47.5 + Number(sourceOffset.y ?? 0)) * scale
    } : { x: x - 95 * scale, y };
    const endX = x + Number(targetOffset.x ?? 0) * scale;
    const endY = y - Number(targetOffset.y ?? 0) * scale;
    const atlas = this.resourceAtlas(item);
    const frames = atlas ? this.atlasFrames(atlas, atlas.prefix) : [];
    if (atlas && frames.length) {
      const index = Math.floor(elapsed / atlas.frameMs);
      const frame = frames[item.looping ? index % frames.length : Math.min(frames.length - 1, index)];
      const drawScale = 2 * scale;
      const logicalWidth = frame.canvasWidth || frame.sourceWidth || (frame.rotated ? frame.height : frame.width);
      const angle = Math.atan2(endY - start.y, endX - start.x);
      drawAtlasFrame(ctx, atlas.image, frame, start.x + Math.cos(angle) * logicalWidth * drawScale / 2,
        start.y + Math.sin(angle) * logicalWidth * drawScale / 2, { scale: drawScale, rotation: angle * 180 / Math.PI });
      return;
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(Math.PI * elapsed / duration);
    ctx.strokeStyle = color(item.color ?? { r: 255, g: 210, b: 90 }); ctx.lineWidth = Math.max(2, Number(item.width ?? 12) * scale);
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(endX, endY); ctx.stroke(); ctx.restore();
  }

  drawShockwave(ctx, x, y, item, elapsed, duration, scale) {
    const progress = Math.min(1, elapsed / duration);
    const radius = Number(item.radius ?? 95) * scale * progress;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - progress) * .8;
    ctx.strokeStyle = color(item.color ?? { r: 255, g: 205, b: 110 }); ctx.lineWidth = Math.max(1, (1 - progress) * 10 * scale);
    ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .36, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  drawVortex(ctx, x, y, item, elapsed, duration, scale) {
    const progress = elapsed / duration;
    ctx.save(); ctx.translate(x, y); ctx.rotate(progress * Math.PI * 4); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color(item.color ?? { r: 255, g: 190, b: 70 }, 1 - progress); ctx.lineWidth = Math.max(1, 5 * scale);
    for (let ring = 1; ring <= 3; ring++) { ctx.beginPath(); ctx.ellipse(0, 0, 25 * ring * scale * progress, 9 * ring * scale * progress, ring * .7, 0, Math.PI * 1.7); ctx.stroke(); }
    ctx.restore();
  }

  warmBattleAudio(state) {
    if (!state) return;
    const ids = new Set([...(state.units ?? []).map(unit => unit.cardId), ...(state.players ?? []).flatMap(player => [player.generalId, getHero(player.generalId)?.bbsCardId, ...player.hand, ...player.deck])]);
    const signature = `${state.runId}:${[...ids].sort((a,b)=>a-b).join(',')}`;
    if(signature===this.warmAudioSignature) return;this.warmAudioSignature=signature;
    for (const id of ids) {
      const sounds = this.manifest.bodies?.[id]?.sounds ?? {};
      for (const symbol of [...Object.values(sounds), this.manifest.spellSounds?.[id]]) {
        const key = Array.isArray(symbol) ? symbol[0] : symbol;
        const path = this.manifest.sounds?.[key]; if (path) this.prepareSound(path);
      }
    }
  }

  unlockAudio() {
    // Invoke synchronously from pointer/key input; never await this before gameplay.
    if (this.audioContext?.state === 'suspended') this.audioContext.resume().catch(() => {});
  }

  prepareSound(path) {
    if (!path) return;
    if (this.failedSounds.has(path)) { this.prepareMediaSound(path); return; }
    if (this.audioContext) {
      if (this.audioBuffers.has(path) || this.audioJobs.has(path)) return;
      const job = fetch(localPath(path, 'audio')).then(response => {
        if (!response.ok) throw new Error('Optional audio unavailable'); return response.arrayBuffer();
      }).then(bytes => this.audioContext.decodeAudioData(bytes)).then(buffer => {
        const bytes = buffer.length * buffer.numberOfChannels * 4;
        while (this.audioBytes + bytes > 32*1024*1024 && this.audioBuffers.size) {
          const oldest = this.audioBuffers.keys().next().value;
          const cached = this.audioBuffers.get(oldest);this.audioBytes -= cached.length*cached.numberOfChannels*4;this.audioBuffers.delete(oldest);
        }
        if (bytes <= 32*1024*1024) { this.audioBuffers.set(path,buffer);this.audioBytes += bytes; }
      }).catch(() => { this.failedSounds.add(path);this.prepareMediaSound(path); }).finally(() => this.audioJobs.delete(path));
      this.audioJobs.set(path,job);return;
    }
    this.prepareMediaSound(path);
  }

  prepareMediaSound(path) {
    if (this.audio.has(path)) return this.audio.get(path);
    // A bounded fallback pool keeps simultaneous voices independent, even without Web Audio.
    if (this.mediaVoiceCount >= 32) {
      const idle = [...this.mediaVoices].find(([,voices]) => voices.every(voice => !this.activeSounds.has(voice)));
      if (!idle) return null;
      const [oldPath, voices] = idle;
      for(const voice of voices) { voice.removeAttribute('src');voice.load(); }
      this.mediaVoiceCount -= voices.length;this.mediaVoices.delete(oldPath);this.audio.delete(oldPath);
    }
    try {
      const audio = new Audio(localPath(path, 'audio'));
      audio.preload = 'auto';audio.load();this.audio.set(path,audio);
      this.mediaVoices.set(path,[audio]);this.mediaVoiceCount++;return audio;
    } catch { return null; }
  }

  setSoundVolume(value) {
    this.soundVolume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.soundGain) this.soundGain.gain.value = this.soundVolume;
    for (const voices of this.mediaVoices.values()) for (const voice of voices) voice.volume = this.soundVolume;
  }

  playSound(symbol) {
    const sound = Array.isArray(symbol) ? symbol[0] : symbol;
    const path = this.manifest.sounds?.[sound];
    if (!path) return;
    try {
      const buffer = this.audioBuffers.get(path);
      if (buffer && this.audioContext?.state === 'running') {
        // A fresh source allows attack/impact sounds to overlap without restarting each other.
        const source=this.audioContext.createBufferSource();source.buffer=buffer;source.connect(this.soundGain ?? this.audioContext.destination);source.onended=()=>{source.disconnect();this.activeSounds.delete(source);};this.activeSounds.add(source);source.start();
        this.audioBuffers.delete(path);this.audioBuffers.set(path,buffer);return;
      }
      this.prepareSound(path);
      const base = this.prepareMediaSound(path);
      if(!base) return;
      const voices = this.mediaVoices.get(path);
      let audio = voices.find(voice => !this.activeSounds.has(voice));
      if(!audio && voices.length < 8 && this.mediaVoiceCount < 32) {
        audio=base.cloneNode(true);audio.preload='auto';voices.push(audio);this.mediaVoiceCount++;
      }
      if (!audio) return;
      const generation=(this.mediaGeneration.get(audio)??0)+1;this.mediaGeneration.set(audio,generation);
      const release=()=>{if(this.mediaGeneration.get(audio)===generation)this.activeSounds.delete(audio);};
      audio.volume=this.soundVolume;audio.currentTime=0;this.activeSounds.add(audio);audio.onended=release;audio.onerror=release;
      audio.play().catch(release);
    } catch { /* Browsers may keep audio locked until a user gesture. */ }
  }
}
