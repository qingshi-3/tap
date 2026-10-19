import {isOriginalHero,castOriginalHero,onOriginalEnemyDeath,originalDecoy,absorbOriginalDamage,ORIGINAL_ARMY_KINDS} from './original-heroes.js';
import { castMythicHero, clearMythicHero, getMythicDecoy } from './mythic-heroes.js';
import { hasJobMechanic, updateAscension, clearAscension } from './ascension-combat.js';
import { createCombatFeedback, emitCombatFeedback, tickCombatFeedback } from './combat-feedback.js';
import { resetJobMechanics, updateJobMechanics, onJobSkill, onJobDashComplete, onJobGuardHit } from './job-mechanics.js';
import {startBlinkTravel, updateBlink, landBlinkBlade} from './blink-abilities.js';
import { scheduleOrdinaryRanged, launchOrdinaryShot, clearOrdinaryRanged } from './ranged-pressure.js';
import { WEAPONS } from './combat-content.js';
import { SKILL_DEFINITIONS, HERO_JOBS, getHeroKind, getActiveSkillLoadout } from './heroes.js';
import { getBlinkAnchors, getFrostTarget } from './skill-targeting.js';
import { getCombatStats, getSkillGeometry, getSkillCooldown, pointInSector } from './combat-stats.js';
import { makeUpgradeChoices, applyGrowthUpgrade, findAlternativeUpgradeChoices } from './growth.js';
import { updateHeroKit, onHeroSkill } from './hero-kit.js';
import { castSpecialHero, clearSpecialHero, captureSpecialProjectile, absorbSpecialHeroDamage } from './special-heroes.js';
import { updateCommonAbilities } from './common-abilities.js';
import { getEnemyContent, getEncounterWave } from './enemy-content.js';
import { initEnemyAbility, updateEnemyAbility, updateEnemyHazards, onEnemyDamaged, cancelEnemyOwned, clearEnemyAbilities, getTrialDamageMultiplier, isTrialBoss, getEnemyApproachPoint } from './enemy-abilities.js';

const WORLD_W = 2400;
const WORLD_H = 1800;
const STEP = 1 / 60;
const TAU = Math.PI * 2;
const UPGRADE_SLOWDOWN_DURATION = 0.28;
const UPGRADE_RESUME_DURATION = 0.35;
const ENTITY_COLLISION_SCALE = 0.85;
const DASH_DISTANCE = 135;
const DASH_DURATION = 0.28;
const DASH_HIT_RADIUS = 34;

function rng(game) {
  let t = game._seed += 0x6d2b79f5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance2(a, b) { const x = a.x - b.x; const y = a.y - b.y; return x * x + y * y; }
function normalize(x, y) { const l = Math.hypot(x, y); return l > 0.001 ? { x: x / l, y: y / l } : { x: 0, y: 0 }; }

const ENEMY = {
  grunt: { hp: 34, speed: 64, damage: 9, xp: 5, radius: 20 * ENTITY_COLLISION_SCALE },
  runner: { hp: 23, speed: 103, damage: 7, xp: 6, radius: 17 * ENTITY_COLLISION_SCALE },
  brute: { hp: 105, speed: 43, damage: 16, xp: 14, radius: 29 * ENTITY_COLLISION_SCALE },
  guard_basic: { hp: 82, speed: 50, damage: 13, xp: 10, radius: 24 * ENTITY_COLLISION_SCALE },
  scout_basic: { hp: 30, speed: 88, damage: 9, xp: 7, radius: 18 * ENTITY_COLLISION_SCALE, scout: true },
  archer_elite: { hp: 58, speed: 56, damage: 12, xp: 11, radius: 21 * ENTITY_COLLISION_SCALE, ranged: true },
};

const STAGES = [
  { at: 0, name: "荒野初潮", hint: "稳住阵脚，收集最初的魂晶", interval: .72, burst: 2, table: [["grunt", 10], ["runner", 1]] },
  { at: 60, name: "斥候穿插", hint: "留意斥候冲锋的方向", interval: .58, burst: 2, table: [["grunt", 6], ["runner", 3], ["scout_basic", 3]] },
  { at: 120, name: "铁甲推进", hint: "重甲兵正在压缩活动空间", interval: .49, burst: 3, table: [["grunt", 4], ["runner", 2], ["guard_basic", 3], ["brute", 2], ["scout_basic", 2]] },
  { at: 180, name: "箭雨封锁", hint: "弓手瞄准时横向移动", interval: .42, burst: 3, table: [["grunt", 3], ["runner", 2], ["guard_basic", 3], ["brute", 2], ["archer_elite", 3], ["scout_basic", 2]] },
  { at: 240, name: "全线猛攻", hint: "密集敌潮来袭，主动寻找补给", interval: .34, burst: 4, table: [["grunt", 3], ["runner", 3], ["guard_basic", 3], ["brute", 3], ["archer_elite", 2], ["scout_basic", 3]] },
  { at: 300, name: "监军决战", hint: "击败监军并坚持到六分钟", interval: .30, burst: 4, table: [["runner", 3], ["guard_basic", 3], ["brute", 3], ["archer_elite", 3], ["scout_basic", 3]] },
  { at: 360, name: "战线肃清", hint: "消灭监军即可撤离", interval: .55, burst: 2, table: [["guard_basic", 2], ["brute", 2], ["archer_elite", 1]] },
];
function encounterStage(game) {
  const base = STAGES[game._stageIndex] || STAGES[0];
  const wave = getEncounterWave(game.dungeon?.id, game._stageIndex);
  return wave ? { ...base, ...wave } : base;
}
const LIVE_ENEMY_CAP = 160;
const MAP_OBJECTS = [
  { id: "crate-nw", type: "crate", x: 430, y: 410, radius: 34, label: "近身击破" },
  { id: "crate-ne", type: "crate", x: 1940, y: 390, radius: 34, label: "近身击破" },
  { id: "crate-sw", type: "crate", x: 510, y: 1420, radius: 34, label: "近身击破" },
  { id: "crate-se", type: "crate", x: 1900, y: 1390, radius: 34, label: "近身击破" },
  { id: "fountain-west", type: "fountain", x: 760, y: 900, radius: 75, label: "驻足疗愈" },
  { id: "fountain-east", type: "fountain", x: 1640, y: 900, radius: 75, label: "驻足疗愈" },
  { id: "beacon-north", type: "beacon", x: 1200, y: 360, radius: 140, label: "坚守信标", startsAt: 90, endsAt: 135 },
  { id: "beacon-south", type: "beacon", x: 1200, y: 1440, radius: 140, label: "坚守信标", startsAt: 210, endsAt: 255 },
  { id: "ruins-west", type: "ruins", x: 310, y: 920, radius: 78 },
  { id: "ruins-east", type: "ruins", x: 2090, y: 850, radius: 82 },
  { id: "tree-northwest", type: "tree", x: 820, y: 250, radius: 45 },
  { id: "tree-southeast", type: "tree", x: 1710, y: 1580, radius: 45 },
];

function createMapObjects() {
  const scenery=Array.from({length:28},(_,i)=>({id:`scenery-${i}`,type:i%4===0?'ruins':'tree',x:140+(i*397)%2100,y:160+(i*263)%1470,radius:35}));
  return [...MAP_OBJECTS,...scenery].map(object => ({
    ...object,
    state: object.type === "beacon" ? "locked" : "ready",
    progress: 0,
    ...(object.type === "crate" ? { hp: 72, maxHp: 72 } : {}),
  }));
}

const SKILL_ICONS = {
  dash: { key: "Q", name: "风行突进", icon: "➤", cooldown: 5, description: "向指定方向突进，沿途斩击并短暂无敌。" },
  cleave: { key: "E", name: "裂空斩", icon: "◒", cooldown: 8, description: "向指定方向挥出大范围裂空剑气。" },
  swordField: { key: "R", name: "剑阵", icon: "✥", cooldown: 18, description: "在前方展开持续杀伤的风刃剑阵。" },
  guard: { key: "Q", name: "守势", icon: "◇", cooldown: 12, description: "短时间内大幅降低受到的伤害。" },
  bladeWave: { key: "E", name: "剑气", icon: "➞", cooldown: 10, description: "向指定方向释放贯穿敌人的直线剑气。" },
  whirlwind: { key: "R", name: "旋风斩", icon: "◎", cooldown: 12, description: "瞬间斩击身边的多个目标。" },
  quickCut: { key: "Q", name: "瞬斩", icon: "╱", cooldown: 6, description: "向指定方向发动短距离快速斩击。" },
  summonGuard: { key: "Q", name: "召唤卫士", icon: "♟", cooldown: 8, description: "召唤可拦截敌人的近战卫士。" },
  recallSummons: { key: "E", name: "全军召回", icon: "↶", cooldown: 12, description: "召回卫士并恢复其生命。" },
  summonElite: { key: "R", name: "召唤统领", icon: "♜", cooldown: 25, description: "召唤一名范围攻击的精锐统领。" },
  markBlade: { key: "Q", name: "地面飞镖", icon: "✦", cooldown: 2, description: "投出穿透飞镖，在终点留下地面锚点。" },
  blinkStrike: { key: "E", name: "瞬身", icon: "➤", cooldown: 5, description: "无敌穿梭至选中飞镖，落地击退。" },
  blinkStorm: { key: "R", name: "瞬印连袭", icon: "✥", cooldown: 18, description: "沿所有飞镖无敌来回穿梭，最终停在第一枚。" },
  flameBreath: { key: "Q", name: "龙焰吐息", icon: "♨", cooldown: 9, description: "锁定方向喷吐三秒烈焰，期间仍可移动。" },
  rockWall: { key: "E", name: "岩壁", icon: "◠", cooldown: 12, description: "沿英雄前方升起弧形岩壁，震退敌人并阻挡怪物与敌弹六秒。" },
  frostAura: { key: "R", name: "冰柱雨", icon: "❉", cooldown: 22, description: "在指定圆形区域降下六秒冰柱雨，持续造成冰霜伤害并减速。" },
};
const SKILLS = Object.fromEntries(Object.entries(SKILL_DEFINITIONS).map(([id,definition]) => {const presentation=SKILL_ICONS[id]||{icon:id.startsWith('grapple')?'✊':id.startsWith('rift')?'◌':'◆',key:'Q'};return [id,{...presentation,...definition,key:presentation.key,icon:presentation.icon}];}));
const DEFAULT_SKILLS = getActiveSkillLoadout("commander");
const SKILL_KEYS = ["Q", "E"];

export function createGame({ seed = Date.now(), duration = 360 } = {}) {
  return {
    phase: "ready", time: 0, duration: Math.max(1, duration), kills: 0, orbitHitSerial: 0, choices: [], timeScale: 1,
    runSupport: { freeRerolls: 1, tacticalAdUsed: false, revived: false },
    combatFeedback: createCombatFeedback(),
    world: { width: WORLD_W, height: WORLD_H },
    player: { x: WORLD_W / 2, y: WORLD_H / 2, hp: 100, maxHp: 100, level: 1, xp: 0, xpNext: 18,
      speed: 205, radius: 21 * ENTITY_COLLISION_SCALE, facing: 1, invulnerable: 0, hitFlash: 0, anim: "idle", animTime: 0, animDuration: 0, dash: null },
    enemies: [], gems: [], projectiles: [], enemyProjectiles: [], enemyHazards: [], supplies: [], effects: [], damageNumbers: [], orbitals: [], companions: [], fields: [], mapObjects: createMapObjects(), objective: { text: "" }, dungeon: null, boss: null, heroId: null, heroState: { blinkAnchors: [], blinkTravel: null, skillLock: 0, flame: null, frostAura: null },
    encounter: { name: STAGES[0].name, hint: STAGES[0].hint, index: 0 }, announcement: { text: STAGES[0].name, remaining: 3 },
    upgrades: Object.fromEntries(WEAPONS.map(w=>[w.id,0])), evolutions: {}, growth: {}, heroPerks: {}, heroKit: null, heroEffects: [], commonEntities: [], commonEffects: [],
    skills: Object.fromEntries(Object.keys(SKILLS).map(id => [id, { remaining: 0 }])), skillLoadout: [...DEFAULT_SKILLS],
    stats: { damageDealt: 0, damageTaken: 0, heroDamage: 0, commonDamage: 0, damageBySource: {basic:0,basicSecondary:0,active:0,companion:0,reaction:0,common:0}, damageHits: {basic:0,basicSecondary:0,active:0,companion:0,reaction:0,common:0}, damageTakenBySource: { contact: 0, projectile: 0, mechanic: 0 } },
    _seed: (Number(seed) || 1) >>> 0, _accumulator: 0, _spawnClock: 0, _attackClock: 0.25,
    _orbClock: 0.5, _daggerClock: 0.8, _lightningClock: 1, _frostClock: 1.4, _orbAngle: 0, _nextId: 1, _pendingLevels: 0, _previousPhase: "playing", _upgradeTransitionElapsed: 0,
    _stageIndex: 0, _eliteWaves: 0, _nextSupplyAt: 55, _lastRecoveryAt: -99, _magnetTime: 0, _objectStrikeClock: 0,
  };
}

export function configureRun(game, { dungeon, heroBonus = {}, heroKind = null, heroName = '风刃指挥官', heroJob = 'fighter', heroSkills = DEFAULT_SKILLS, heroId = null } = {}) {
  if (!game || game.phase !== "ready") return false;
  heroId = heroId || HERO_JOBS[heroJob]?.heroId || 'commander';
  const activeSkills=getActiveSkillLoadout(heroId,heroSkills);if(activeSkills.length!==2)return false;
  heroKind = heroKind || getHeroKind(heroId,heroJob);
  game.player.kind = heroKind; game.player.name = heroName; game.player.job = heroJob; game.player.heroId = heroId; game.heroId = heroId;
  game.dungeon = dungeon ? { ...dungeon, enemies: [...(dungeon.enemies || [])], boss: dungeon.boss ? { ...dungeon.boss } : null } : null;
  if (Number.isFinite(dungeon?.duration)) game.duration = Math.max(1, dungeon.duration);
  game.skillLoadout = activeSkills;
  const scheduleScale = game.duration / 360;
  for (const object of game.mapObjects) if (object.type === "beacon") { object.startsAt *= scheduleScale; object.endsAt *= scheduleScale; }
  game._nextSupplyAt *= scheduleScale;
  const hpBonus = Math.max(0, Number(heroBonus.hp) || 0), damageBonus = Math.max(-0.8, Number(heroBonus.damage) || 0);
  game.player.maxHp += hpBonus; game.player.hp = game.player.maxHp; game.player.damageMultiplier = 1 + damageBonus;
  game.companions = [];
  clearSpecialHero(game);clearAscension(game);clearMythicHero(game);game.heroKit = null; game.originalHero=null; game.heroEffects = []; resetJobMechanics(game); game.attackProgress={rank:1,branch:null}; game._growthBranchTurn=null;
  if(heroId === "summoner") summonCompanion(game,false);
  game.heroState = { blinkAnchors: [], blinkTravel: null, skillLock: 0, flame: null, frostAura: null };
  return true;
}

export function startGame(game) {
  if (!game || game.phase !== "ready") return false;
  game.phase = "playing";
  const stage = encounterStage(game);
  game.encounter = { name: stage.name, hint: stage.hint, index: game._stageIndex };
  game.announcement = { text: stage.name, remaining: 3 };
  return true;
}

function makeChoices(game) { return makeUpgradeChoices(game, () => rng(game)); }
function combatApi(game, source) {
  return { damage:(enemy,amount,color,category)=>damageEnemy(game,enemy,amount,color,source,category), movementHitsWall:(ax,ay,bx,by,padding)=>movementHitsWall(game,ax,ay,bx,by,padding), isUnsafePosition:(x,y,r)=>movementHitsWall(game,x,y,x,y,r)||(game.enemyHazards||[]).some(h=>!h.telegraph&&Math.hypot(x-h.x,y-h.y)<(h.radius||30)+r), random:()=>rng(game) };
}
function enemyApi(game, protectPlayer = false) {
  return { hurtPlayer: amount => hurtPlayer(game, amount, protectPlayer, 'mechanic'),
    hurtCompanion: (companion, amount) => hurtCompanion(game, companion, amount),
    damageEnemy: (enemy, amount) => damageEnemy(game, enemy, amount, '#ffdc92', 'enemy'),
    movementHitsWall: (ax, ay, bx, by, padding) => movementHitsWall(game, ax, ay, bx, by, padding), random: () => rng(game) };
}

function requestUpgrade(game) {
  game._pendingLevels++;
  if (game.phase === "playing") {
    game.phase = "upgrade_slowdown";
    game.timeScale = 1;
    game._upgradeTransitionElapsed = 0;
    game.choices = makeChoices(game);
  } else if (game.phase === "upgrade_resume") {
    // XP picked up while easing back into play joins the queue without losing an upgrade choice.
    game.phase = "upgrade";
    game.timeScale = 0;
    game._upgradeTransitionElapsed = 0;
    if (!game.choices.length) game.choices = makeChoices(game);
  }
}

export function chooseUpgrade(game, id) {
  if (!game || game.phase !== "upgrade" || !game.choices.some(c => c.id === id)) return false;
  if(id === 'supply:heal') dropSupply(game, game.player.x+80, game.player.y, 'heal');
  else if(id === 'supply:magnet')game._magnetTime=Math.max(game._magnetTime,8);
  else if(id === 'supply:focus') for(const skill of Object.values(game.skills))skill.remaining=Math.max(0,skill.remaining-3);
  else if(!applyGrowthUpgrade(game,id)) return false;
  if(id.startsWith('evolve:') || (id.startsWith('attack:') && game.attackProgress?.rank === 4)) emitCombatFeedback(game,'evolution',{strength:2,color:'#ffe9a3'});
  game.player.hp=Math.min(game.player.maxHp,game.player.hp+3);
  game._pendingLevels = Math.max(0, game._pendingLevels - 1);
  if (game._pendingLevels > 0) game.choices = makeChoices(game);
  else {
    game.choices = [];
    game.phase = "upgrade_resume";
    game.timeScale = 0;
    game._upgradeTransitionElapsed = 0;
    game.player.invulnerable = Math.max(game.player.invulnerable, UPGRADE_RESUME_DURATION + 0.15);
  }
  return true;
}

export function togglePause(game) {
  if (!game) return false;
  if (["playing", "upgrade_slowdown", "upgrade_resume"].includes(game.phase)) { game._previousPhase = game.phase; game.phase = "paused"; return true; }
  if (game.phase === "paused") { game.phase = game._previousPhase || "playing"; return true; }
  return false;
}

export function canRerollUpgrade(game, source = 'free') {
  if(game?.phase !== 'upgrade' || !game.choices.length || !game.runSupport) return false;
  if(source==='free' ? game.runSupport.freeRerolls<=0 : source!=='ad' || game.runSupport.freeRerolls>0 || game.runSupport.tacticalAdUsed) return false;
  return !!findAlternativeUpgradeChoices(game);
}

export function rerollUpgrade(game, source = 'free') {
  if(!canRerollUpgrade(game,source)) return false;
  const draft = findAlternativeUpgradeChoices(game);
  if(!draft) return false;
  game.choices=draft.choices; game._growthBranchTurn=draft.branchTurn; game._seed=draft.seed;
  if(source==='free') game.runSupport.freeRerolls--;
  else game.runSupport.tacticalAdUsed=true;
  return true;
}

export function canRevive(game) {
  return !!(game?.phase==='defeat' && game.time>=60 && game.player.hp<=0 && game.runSupport && !game.runSupport.tacticalAdUsed && !game.runSupport.revived);
}

export function reviveGame(game) {
  if(!canRevive(game)) return false;
  clearSpecialHero(game);clearAscension(game);clearMythicHero(game);
  if(isTrialBoss(game.boss)&&!game.boss.dead){cancelEnemyOwned(game,game.boss.id);initEnemyAbility(game,game.boss,game.boss.abilityId);}
  const p=game.player, clearance=200;
  p.hp=p.maxHp*.5; p.invulnerable=3; p.hitFlash=0; p.anim='idle'; p.animTime=0; p.animDuration=0; p.dash=null;
  game.enemyProjectiles=game.enemyProjectiles.filter(s=>distance2(p,s)>(clearance+(s.radius||0))**2);
  game.enemyHazards=game.enemyHazards.filter(h=>{
    // Include long line telegraphs whose origin lies outside the cleared neighborhood.
    let x=h.x,y=h.y;
    if(Number.isFinite(h.toX)&&Number.isFinite(h.toY)) {
      const dx=h.toX-h.x,dy=h.toY-h.y,t=clamp(((p.x-h.x)*dx+(p.y-h.y)*dy)/(dx*dx+dy*dy||1),0,1);
      x+=dx*t;y+=dy*t;
    }
    return distance2(p,{x,y})>(clearance+(h.radius||h.width||0))**2;
  });
  for(const e of game.enemies) if(!e.dead && !e.boss && distance2(p,e)<(clearance+e.radius)**2) {
    let direction=normalize(e.x-p.x,e.y-p.y);
    if(!direction.x&&!direction.y) {const angle=(game.enemies.indexOf(e)+1)*2.399963;direction={x:Math.cos(angle),y:Math.sin(angle)};}
    let x=p.x+direction.x*(clearance+e.radius),y=p.y+direction.y*(clearance+e.radius);
    if(x<e.radius||x>game.world.width-e.radius) x=p.x-direction.x*(clearance+e.radius);
    if(y<e.radius||y>game.world.height-e.radius) y=p.y-direction.y*(clearance+e.radius);
    e.x=clamp(x,e.radius,game.world.width-e.radius);e.y=clamp(y,e.radius,game.world.height-e.radius);
  }
  game.runSupport.tacticalAdUsed=true; game.runSupport.revived=true;
  game.phase='playing';game.timeScale=1;game._accumulator=0;game._upgradeTransitionElapsed=0;
  return true;
}

function canReturnBlink(game){const shadow=game?.originalHero?.returnShadow;return game?.heroId==='blink'&&shadow?.remaining>0&&Number.isFinite(shadow.x)&&Number.isFinite(shadow.y);}
export function getSkillState(game) {
  const loadout = getActiveSkillLoadout(game?.heroId||game?.player?.heroId||'commander',game?.skillLoadout);
  return loadout.map((id, index) => {
    const isReturn=id==='markBlade'&&canReturnBlink(game);
    const needsAnchor = !isOriginalHero(game) && (id === 'blinkStrike' || id === 'blinkStorm') && !getBlinkAnchors(game,id).length;
    const needsGate = id==='riftStep' && !(game?.specialHero?.gates||[]).some(gate=>gate.remaining>0);
    const travelLocked = !!game?.heroState?.blinkTravel;
    return { id, ...SKILLS[id], ...(isReturn?{name:'返影'}:{}), isReturn, cooldown:getSkillCooldown(game,id,SKILLS[id].cooldown), key:SKILL_KEYS[index], remaining:isReturn?0:Math.max(0,game?.skills?.[id]?.remaining||0), locked:travelLocked || !!game?.heroState?.skillLock || needsAnchor || needsGate, lockReason:needsGate?'先放远门':needsAnchor?'先投镖':travelLocked?'穿梭中':'' };
  });
}

function lineDistance(point, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = clamp(((point.x - x1) * dx + (point.y - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(point.x - (x1 + dx * t), point.y - (y1 + dy * t));
}

function summonCompanion(game, elite = false) {
  const p = game.player, angle = rng(game) * TAU, kind = elite ? ORIGINAL_ARMY_KINDS.leader : ORIGINAL_ARMY_KINDS.shield;
  if (elite) game.companions = game.companions.filter(c => !c.elite);
  else {
    const basics = game.companions.filter(c => !c.elite);
    if (basics.length >= 3) {
      const weakest = basics.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      game.companions.splice(game.companions.indexOf(weakest), 1);
    }
  }
  const maxHp = elite ? 250 : 115;
  const companion = { id: game._nextId++, kind, summon: true, elite, x: p.x + Math.cos(angle) * 54, y: p.y + Math.sin(angle) * 54,
    radius: elite ? 24 : 19, hp: maxHp, maxHp, damage: elite ? 34 : 18, speed: elite ? 110 : 125, facing: 1, anim: "idle", animTime: 0, hitFlash: 0, invulnerable: 0, attackClock: .2 };
  game.companions.push(companion);
  companion.x=clamp(companion.x,companion.radius,WORLD_W-companion.radius);
  companion.y=clamp(companion.y,companion.radius,WORLD_H-companion.radius);
  game.effects.push({ type: "summon", x: companion.x, y: companion.y, companionId: companion.id, elite, life: .55, maxLife: .55 });
  return companion;
}

function pushEnemies(game, x, y, radius, force) {
  for (const enemy of game.enemies) if (!enemy.dead && !enemy.trialConstruct && enemy.spawnDelay <= 0 && distance2({ x, y }, enemy) < (radius + enemy.radius) ** 2) {
    const n = normalize(enemy.x - x, enemy.y - y), scale = enemy.boss ? 0 : enemy.elite ? .32 : 1;
    enemy.x = clamp(enemy.x + n.x * force * scale, enemy.radius, WORLD_W - enemy.radius);
    enemy.y = clamp(enemy.y + n.y * force * scale, enemy.radius, WORLD_H - enemy.radius);
  }
}

export function castSkill(game, id, input = { x: 0, y: 0 }) {
  const isReturn=id==='markBlade'&&canReturnBlink(game);
  if (!game || game.phase !== 'playing' || !SKILLS[id] || !getActiveSkillLoadout(game.heroId,game.skillLoadout).includes(id) || (!isReturn&&game.skills[id].remaining > 0) || game.player.dash || game.heroState?.blinkTravel || game.heroState?.skillLock > 0) return false;
  if(!game.jobMechanics)resetJobMechanics(game);
  let aim = normalize(Number(input.x) || 0, Number(input.y) || 0);
  if (!input.x && !input.y) {
    const target = nearestEnemy(game, 700);
    aim = target ? normalize(target.x - game.player.x, target.y - game.player.y) : { x: game.player.facing || 1, y: 0 };
  }
  const player = game.player, angle = Math.atan2(aim.y, aim.x), multiplier = getCombatStats(game).damage, geometry = getSkillGeometry(game,id);
  player.facing = aim.x >= 0 ? 1 : -1; game._jobCastAngle=angle;
  if(isReturn){const returned=castOriginalHero(game,'blinkStrike',aim,combatApi(game,'hero'));if(returned!==true)return false;player.anim=SKILLS.blinkStrike.animation||'attack';player.animTime=0;player.animDuration=.4;player.animSource='skill';player.animFacing=player.facing;return true;}
  const specialResult=castOriginalHero(game,id,{...aim,targetX:input.targetX,targetY:input.targetY},combatApi(game,'hero'))??castSpecialHero(game,id,aim,combatApi(game,'hero'))??castMythicHero(game,id,aim,combatApi(game,'hero'));
  if(specialResult===false)return false;
  if(specialResult===true){
    // New heroes execute their own bounded entities and damage through combatApi.
  } else if (id === "dash") {
    const x = player.x, y = player.y;
    const toX = clamp(x + aim.x * DASH_DISTANCE, player.radius, WORLD_W - player.radius);
    const toY = clamp(y + aim.y * DASH_DISTANCE, player.radius, WORLD_H - player.radius);
    player.dash = { x, y, toX, toY, elapsed: 0, duration: DASH_DURATION, damage: 56 * multiplier, hitRadius:geometry.width, hitEnemies: new Set(), hitCrates: new Set() };
    player.invulnerable = Math.max(player.invulnerable, DASH_DURATION + STEP);
    game.effects.push({ type: "dash", x, y, toX, toY, radius:geometry.width, travelDuration: DASH_DURATION, life: DASH_DURATION + .16, maxLife: DASH_DURATION + .16 });
  } else if (id === "cleave") {
    game.effects.push({ type: "cleave", x: player.x, y: player.y, angle, width:geometry.angle, radius: geometry.radius, life: 0.42, maxLife: 0.42 });
    for (const enemy of game.enemies) if (!enemy.dead && enemy.spawnDelay <= 0 && pointInSector(enemy, player, angle, geometry.radius, geometry.angle)) damageEnemy(game, enemy, 105 * multiplier, "#d5ffff");
    for (const object of game.mapObjects) if (object.type === "crate" && object.state !== "destroyed" && pointInSector(object, player, angle, geometry.radius, geometry.angle)) damageCrate(game, object, 105 * multiplier);
  } else if (id === "swordField") {
    const x = clamp(player.x + aim.x * 170, 40, WORLD_W - 40), y = clamp(player.y + aim.y * 170, 40, WORLD_H - 40);
    game.fields.push({ type: "sword", x, y, radius: geometry.radius, life: geometry.duration, tick: 0 });
    game.effects.push({ type: "swordField", x, y, radius: geometry.radius, life: geometry.duration, maxLife: geometry.duration });
  } else if (id === "guard") {
    player.guardTime = Math.max(player.guardTime || 0, 3.2);
    game.effects.push({ type: "swordField", guard: true, x: player.x, y: player.y, radius: 72, life: 3.2, maxLife: 3.2 });
  } else if (id === "bladeWave") {
    game.projectiles.push({ id: game._nextId++, weapon: "bladeWave", friendly: true, x: player.x + aim.x * 28, y: player.y + aim.y * 28, vx: aim.x * 610, vy: aim.y * 610, radius: geometry.width, damage: 88 * multiplier, life: 1.05, pierce: 99, hitIds: new Set() });
    game.effects.push({ type: "cleave", bladeWave: true, x: player.x, y: player.y, radius: 150, width: .62, angle, life: .28, maxLife: .28 });
  } else if (id === "whirlwind" && hasJobMechanic(game,'swift_blade')) {
    // Four fixed ticks belong to the job lifecycle.
  } else if (id === "whirlwind") {
    const radius = geometry.radius;
    game.effects.push({ type: "cleave", whirlwind: true, x: player.x, y: player.y, angle, width: TAU, radius, life: .48, maxLife: .48 });
    for (const enemy of game.enemies) if (!enemy.dead && enemy.spawnDelay <= 0 && distance2(player, enemy) <= (radius + enemy.radius) ** 2) damageEnemy(game, enemy, 92 * multiplier, "#d5ffff");
    for (const object of game.mapObjects) if (object.type === "crate" && object.state !== "destroyed" && distance2(player, object) <= (radius + object.radius) ** 2) damageCrate(game, object, 92 * multiplier);
  } else if (id === "quickCut") {
    const x = player.x, y = player.y, distance = 96;
    const toX = clamp(x + aim.x * distance, player.radius, WORLD_W - player.radius), toY = clamp(y + aim.y * distance, player.radius, WORLD_H - player.radius);
    player.dash = { x, y, toX, toY, elapsed: 0, duration: .16, damage: 72 * multiplier, hitRadius:geometry.width, hitEnemies: new Set(), hitCrates: new Set() };
    player.invulnerable = Math.max(player.invulnerable, .16 + STEP);
    game.effects.push({ type: "dash", quickCut: true, x, y, toX, toY, radius:geometry.width, travelDuration: .16, life: .32, maxLife: .32 });
  } else if (id === "summonGuard") {
    game.jobMechanics.fullSummons=hasJobMechanic(game,'summoner_master')&&game.companions.filter(c=>!c.elite&&c.hp>0).length>=3;
    if(!game.jobMechanics.fullSummons)summonCompanion(game, false);
  } else if (id === "summonElite") {
    if(!(hasJobMechanic(game,'summoner_master')&&game.companions.some(c=>c.elite&&c.hp>0)))summonCompanion(game, true);
  } else if (id === "recallSummons") {
    game.companions.forEach((companion, index) => {
      const a = index * TAU / Math.max(1, game.companions.length);
      companion.x = clamp(player.x + Math.cos(a) * 62, companion.radius, WORLD_W - companion.radius);
      companion.y = clamp(player.y + Math.sin(a) * 62, companion.radius, WORLD_H - companion.radius);
      companion.hp = Math.min(companion.maxHp, companion.hp + companion.maxHp * .25);
      companion.damageReduction = Math.max(companion.damageReduction || 0, 1);
      game.effects.push({ type: "recall", x: companion.x, y: companion.y, companionId: companion.id, elite: !!companion.elite, life: .55, maxLife: .55 });
    });
  } else if (id === "markBlade") {
    const toX=clamp(player.x+aim.x*240,player.radius,WORLD_W-player.radius),toY=clamp(player.y+aim.y*240,player.radius,WORLD_H-player.radius),distance=Math.hypot(toX-player.x,toY-player.y),n=normalize(toX-player.x,toY-player.y);
    game.projectiles.push({id:game._nextId++,weapon:'markBlade',friendly:true,x:player.x,y:player.y,originX:player.x,originY:player.y,toX,toY,maxDistance:distance,vx:n.x*540,vy:n.y*540,radius:geometry.width,damage:38*multiplier,life:distance/540,maxLife:distance/540,pierce:Infinity,hitIds:new Set()});
  } else if (id === 'blinkStrike' || id === 'blinkStorm') {
    if(!startBlinkTravel(game,id,input,geometry,(id==='blinkStrike'?72:48)*multiplier))return false;
  } else if (id === "flameBreath") {
    game.heroState.flame = { remaining: geometry.duration, radius:geometry.radius, width:geometry.angle, angle, tick: 0 };
    game.effects.push({ type: "flameBreath", heroPersistent: true, x: player.x, y: player.y, angle, length: geometry.radius, radius: geometry.radius, width: geometry.angle, life: geometry.duration, maxLife: geometry.duration });
  } else if (id === "rockWall") {
    if(hasJobMechanic(game,'mage_master'))for(const e of game.enemies)if(!e.dead&&pointInSector(e,player,angle,geometry.radius+geometry.width,geometry.angle))(e.jobElements||={}).rock=game.time+3;
    const wall = { type: "rockWall", heroPersistent: true, x: player.x, y: player.y, angle, arcRadius: geometry.radius, arcAngle: geometry.angle, depth: geometry.width, segments: 18, life: geometry.duration, maxLife: geometry.duration, tick: 99 };
    game.fields.push(wall);
    onHeroSkill(game,id,combatApi(game,"hero"));
    // Clear the protected side too, so casting while crowded creates breathing room.
    for (const enemy of game.enemies) if (!enemy.dead && !enemy.boss &&
      Math.hypot(enemy.x-wall.x,enemy.y-wall.y)<=wall.arcRadius+wall.depth/2+enemy.radius+12 &&
      Math.abs(Math.atan2(Math.sin(Math.atan2(enemy.y-wall.y,enemy.x-wall.x)-angle),Math.cos(Math.atan2(enemy.y-wall.y,enemy.x-wall.x)-angle)))<=wall.arcAngle/2) {
      const radial=normalize(enemy.x-wall.x,enemy.y-wall.y),out=radial.x||radial.y?radial:aim,distance=wall.arcRadius+wall.depth/2+enemy.radius+3;
      enemy.x=clamp(wall.x+out.x*distance,enemy.radius,WORLD_W-enemy.radius); enemy.y=clamp(wall.y+out.y*distance,enemy.radius,WORLD_H-enemy.radius);
      enemy.slow=Math.max(enemy.slow||0,enemy.elite?.28:.48);damageEnemy(game,enemy,enemy.elite?6:10,"#d9c19a");
    }
    game.effects.push({ ...wall });
  } else if (id === "frostAura") {
    const target = getFrostTarget(game, input);
    game.heroState.frostAura = { x: target.x, y: target.y, remaining: geometry.duration, radius: geometry.radius, tick: 0 };
    game.fields = game.fields.filter(field => field.type !== "heroFrost");
    game.fields.push({ type: "heroFrost", heroPersistent: true, x: target.x, y: target.y, radius: geometry.radius, life: geometry.duration, maxLife: geometry.duration, tick: 99 });
    game.effects.push({ type: "frostAura", heroPersistent: true, x: target.x, y: target.y, radius: geometry.radius, life: .7, maxLife: .7 });
  }
  game.skills[id].remaining = getSkillCooldown(game,id,SKILLS[id].cooldown);
  if(!["rockWall","blinkStrike","blinkStorm"].includes(id)) onHeroSkill(game,id,combatApi(game,"hero"));
  // Initialize the hero kit before job hooks, even for an immediate first-frame cast.
  onJobSkill(game,id,combatApi(game,"hero"));
  player.anim = SKILLS[id].animation || "attack"; player.animTime = 0; player.animDuration = .4; player.animSource = "skill"; player.animFacing = player.facing;
  return true;
}

function weightedKind(game, table) {
  const allowed = new Set(game.dungeon?.enemies?.filter(kind => ENEMY[kind]) || Object.keys(ENEMY));
  const arrowSlots = game.dungeon?.id !== 'moss-gate' || game.enemies.filter(e=>!e.dead&&!e.elite&&!e.boss&&e.kind==='archer_elite').length < 6;
  if(!arrowSlots)allowed.delete('archer_elite');
  const choices = table.filter(([kind]) => allowed.has(kind));
  const usable = choices.length ? choices : [...allowed].map(kind => [kind, 1]);
  if(!usable.length)return null;
  let roll = rng(game) * usable.reduce((sum, entry) => sum + entry[1], 0);
  for (const [kind, weight] of usable) { roll -= weight; if (roll <= 0) return kind; }
  return usable[usable.length - 1][0];
}

function ordinarySpawnLimit(game) {
  if(game.dungeon?.id!=='moss-gate')return LIVE_ENEMY_CAP;
  if(game.boss&&!game.boss.dead)return 24;
  return [24,30,36,40,44][Math.min(4,Math.floor(game.time/60))];
}
function ordinaryWaveOpen(game) {
  if(game.dungeon?.id!=='moss-gate')return true;
  if(game.time%30>=22)return false;
  return ![90,180,270].some(at=>Math.abs(game.time-at*game.duration/360)<3);
}

function spawnEnemy(game, forcedKind = null, elite = false, scheduledOverride = false) {
  const live = game.enemies.reduce((count, enemy) => count + (!enemy.dead ? 1 : 0), 0);
  if (live >= LIVE_ENEMY_CAP) return null;
  if(!elite&&!scheduledOverride&&game.enemies.filter(e=>!e.dead&&!e.elite&&!e.boss).length>=ordinarySpawnLimit(game))return null;
  const progress = Math.min(1, game.time / game.duration);
  const stage = encounterStage(game);
  const allowedKinds = game.dungeon?.enemies?.filter(candidate => ENEMY[candidate]);
  const kind = forcedKind && (scheduledOverride || !allowedKinds?.length || allowedKinds.includes(forcedKind)) ? forcedKind : weightedKind(game, stage.table);
  if(!kind)return null;
  if(!elite&&!scheduledOverride&&game.dungeon?.id==='moss-gate'&&kind==='archer_elite'&&game.enemies.filter(e=>!e.dead&&!e.elite&&!e.boss&&e.kind==='archer_elite').length>=6)return null;
  const viewport = game.viewport || { width: 0, height: 0 };
  const safeDistance = Math.max(330, Math.hypot(viewport.width || 0, viewport.height || 0) * 0.5 + 75);
  const radius = Math.max(safeDistance + 25, 430 + rng(game) * 170);
  const base = ENEMY[kind];
  // Mechanism elites are scheduled replacements, never random stat upgrades.
  const difficulty = clamp(Number(game.dungeon?.difficulty) || 1, 0.5, 5);
  const scale = (1 + progress * 1.45) * (0.72 + difficulty * 0.28);
  let x = game.player.x, y = game.player.y, bestDistance = -1;
  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = rng(game) * TAU;
    const candidateX = clamp(game.player.x + Math.cos(angle) * radius, 35, WORLD_W - 35);
    const candidateY = clamp(game.player.y + Math.sin(angle) * radius, 35, WORLD_H - 35);
    const candidateDistance = Math.hypot(candidateX - game.player.x, candidateY - game.player.y);
    if (candidateDistance > bestDistance) { x = candidateX; y = candidateY; bestDistance = candidateDistance; }
    if (candidateDistance >= safeDistance) break;
  }
  const enemy = { id: game._nextId++, kind, x, y, radius: base.radius * (elite ? 1.2 : 1),
    hp: base.hp * scale * (elite ? 2.4 : 1), maxHp: base.hp * scale * (elite ? 2.4 : 1),
    speed: base.speed * (1 + progress * 0.12) * (0.9 + difficulty * 0.1), damage: base.damage * (1 + progress * 0.5) * (0.75 + difficulty * 0.25), xp: Math.max(2, Math.ceil(base.xp * .48 * Math.min(3, 360 / game.duration) * (elite ? 3 : 1))),
    elite, hitFlash: 0, spawnDelay: 0.45, anim: "move", animTime: rng(game), facing: 1,
    aiClock: .8 + rng(game), attackWarning: null, contactClock: 0 };
  game.enemies.push(enemy);
  return enemy;
}

function dropSupply(game, x, y, guaranteedType = null) {
  if (game.supplies.length >= 8) game.supplies.shift();
  const type = guaranteedType || (game.player.hp < game.player.maxHp * .48 ? "heal" : rng(game) < .45 ? "heal" : "magnet");
  game.supplies.push({ id: game._nextId++, x: clamp(x, 24, WORLD_W - 24), y: clamp(y, 24, WORLD_H - 24), type });
}

function damageCrate(game, object, damage) {
  if (!object || object.type !== "crate" || object.state === "destroyed") return false;
  object.state = "active";
  object.hp = Math.max(0, object.hp - Math.max(0, damage));
  object.progress = clamp(1 - object.hp / object.maxHp, 0, 1);
  game.effects.push({ type: "burst", x: object.x, y: object.y, weapon: "crate", angle: 0, life: .28, maxLife: .28 });
  if (object.hp <= 0) {
    object.state = "destroyed";
    object.progress = 1;
    const supplyType = object.id === "crate-ne" || object.id === "crate-sw" ? "magnet" : "heal";
    dropSupply(game, object.x, object.y, supplyType);
    game.announcement = { text: `补给箱击破 · ${supplyType === "heal" ? "生命补给" : "魂晶磁吸"}`, remaining: 2.4 };
  }
  return true;
}

function updateMapObjects(game, dt) {
  game._objectStrikeClock = Math.max(0, game._objectStrikeClock - dt);
  if (game._objectStrikeClock <= 0) {
    const crate = game.mapObjects.find(object => object.type === "crate" && object.state !== "destroyed" && distance2(game.player, object) <= 110 ** 2);
    if (crate) {
      damageCrate(game, crate, 30 * getCombatStats(game).damage);
      game.player.facing = crate.x >= game.player.x ? 1 : -1;
      if (!(game.player.animSource === "skill" && game.player.animTime < game.player.animDuration)) {
        game.player.anim = "attack"; game.player.animTime = 0; game.player.animDuration = .32; game.player.animSource = "auto"; game.player.animFacing = game.player.facing;
      }
      game.effects.push({ type: "windblade", x: game.player.x, y: game.player.y, radius: 110, width: 1.6, angle: Math.atan2(crate.y-game.player.y,crate.x-game.player.x), life: .24, maxLife: .24 });
      game._objectStrikeClock = .72;
    }
  }

  let objectiveText = "";
  for (const object of game.mapObjects) {
    if (object.type === "fountain" && object.state !== "completed") {
      if (distance2(game.player, object) <= object.radius ** 2) {
        object.state = "active";
        const previous = object.progress;
        object.progress = clamp(object.progress + dt / 3, 0, 1);
        game.player.hp = Math.min(game.player.maxHp, game.player.hp + game.player.maxHp * .36 * (object.progress - previous));
        if (object.progress >= 1) {
          object.state = "completed";
          game.announcement = { text: "古泉疗愈完成", remaining: 2.4 };
        }
      } else if (object.state === "active") {
        object.state = "ready";
      }
    }
    if (object.type !== "beacon" || ["completed", "expired"].includes(object.state)) continue;
    if (object.state === "locked" && game.time >= object.startsAt) {
      object.state = "active";
      game.announcement = { text: "战地信标已激活 · 进入范围坚守", remaining: 3 };
    }
    if (object.state === "active") {
      if (game.time >= object.endsAt) {
        object.state = "expired";
        game.announcement = { text: "战地信标已失效", remaining: 2.4 };
        continue;
      }
      const remaining = Math.max(0, 12 * (1 - object.progress));
      objectiveText = `坚守战地信标 ${remaining.toFixed(1)}秒`;
      if (distance2(game.player, object) <= object.radius ** 2) object.progress = clamp(object.progress + dt / 12, 0, 1);
      if (object.progress >= 1) {
        object.state = "completed";
        gainXp(game, 28);
        dropSupply(game, object.x, object.y, object.id === "beacon-north" ? "magnet" : "heal");
        game.announcement = { text: "信标坚守完成 · 获得魂晶与补给", remaining: 3.2 };
        objectiveText = "";
      }
    }
  }
  game.objective = { text: objectiveText };
}

function spawnEliteWave(game) {
  if(isTrialBoss(game.boss)){game._eliteWaves++;return;}
  if (game.dungeon?.eliteWaves) {
    const wave = game.dungeon.eliteWaves[game._eliteWaves] || [];
    game._eliteWaves++;
    if (game.boss && !game.boss.dead) return;
    let slots = Math.max(0, 2 - game.enemies.filter(e => !e.dead && e.abilityId && !e.boss).length);
    const leaders = [];
    for (const abilityId of wave) {
      const content = getEnemyContent(abilityId); if (!content || content.role !== 'elite' || slots <= 0) continue;
      const live = game.enemies.filter(e => !e.dead);
      if (live.length >= LIVE_ENEMY_CAP) {
        const far = live.filter(e => !e.boss && !e.abilityId && !e.guaranteedSupply).sort((a,b)=>distance2(b,game.player)-distance2(a,game.player))[0];
        if (far) { far.dead = true; far.deathLife = 0; cancelEnemyOwned(game, far.id); }
      }
      const e = spawnEnemy(game, content.baseKind, true, true);
      if (!e) continue;
      initEnemyAbility(game, e, abilityId); e.abilityState.remaining += leaders.length * 1.8;
      leaders.push(e); slots--;
    }
    if (leaders.length) {
      leaders.at(-1).guaranteedSupply = true;
      const hints = { kilnGuard: '击破护阵来源', laneGunner: '双炮道之间留有安全隙', blastBeetle: '集火打断或远离蓄爆' };
      game.announcement = { text: leaders.map(e=>`${e.name} · ${hints[e.abilityId]}`).join(' / '), remaining: 3.5 };
      game.encounter.hint = hints[leaders[0].abilityId];
    }
    return;
  }
  const kinds = game._eliteWaves === 0 ? ["scout_basic", "runner", "scout_basic"] : game._eliteWaves === 1 ? ["guard_basic", "brute", "archer_elite"] : ["archer_elite", "scout_basic", "brute", "guard_basic"];
  // Reserve wave slots even when the surrounding horde has reached its cap.
  const live = game.enemies.filter(e => !e.dead);
  const replace = live.filter(e => !e.boss && !e.guaranteedSupply).sort((a,b) => distance2(b,game.player)-distance2(a,game.player));
  for (let i=0;i<Math.max(0,live.length+kinds.length-LIVE_ENEMY_CAP) && i<replace.length;i++) {
    replace[i].dead=true;replace[i].deathLife=0;
  }
  let leader = null;
  for (const kind of kinds) leader = spawnEnemy(game, kind, true) || leader;
  if (leader) leader.guaranteedSupply = true;
  game._eliteWaves++;
  game.announcement = { text: "精英突袭 · 击破可获得补给", remaining: 3.5 };
}

function recycleDistantEnemies(game) {
  if (game.enemies.length < LIVE_ENEMY_CAP - 8) return;
  const far = game.enemies.filter(e => !e.dead && !e.boss && distance2(e, game.player) > 1050 ** 2)
    .sort((a, b) => distance2(b, game.player) - distance2(a, game.player));
  for (let i = 0; i < Math.min(12, far.length); i++) { far[i].recycled = far[i].dead = true; cancelEnemyOwned(game, far[i].id); }
}

function spawnBoss(game) {
  const config = game.dungeon?.boss;
  if (!config || game.boss) return;
  const kind = ENEMY[config.kind] || config.kind === "guard_elite" ? config.kind : "brute", base = ENEMY[kind] || ENEMY.guard_basic, angle = rng(game) * TAU;
  const hp = Math.max(100, Number(config.hp) || base.hp * 12), damage = Math.max(4, Number(config.damage) || base.damage * 1.5);
  const boss = { id: game._nextId++, boss: true, name: config.name || "苔痕关监军", kind,
    x: clamp(game.player.x + Math.cos(angle) * 480, 50, WORLD_W - 50), y: clamp(game.player.y + Math.sin(angle) * 480, 50, WORLD_H - 50),
    radius: base.radius * 1.55, hp, maxHp: hp, speed: base.speed * 0.78, damage, xp: base.xp * 12, elite: true,
    hitFlash: 0, spawnDelay: 0.9, anim: "move", animTime: 0, facing: 1, skillClock: 2.2, skillIndex: 0, bossState: null, contactClock: 0 };
  game.boss = boss; game.enemies.push(boss);
  if (config.abilityId) initEnemyAbility(game, boss, config.abilityId);
  if(isTrialBoss(boss)){
    for(const e of game.enemies)if(e!==boss&&!e.dead){e.dead=true;e.hp=0;e.deathLife=0;cancelEnemyOwned(game,e.id);}
    game.enemyProjectiles=[];clearOrdinaryRanged(game);
  }
  const hint = config.hint || (config.abilityId === 'cinderweaver' ? '把火种留在身后，沿缺口穿环' : '诱导落点，横移离开裂缝');
  game.announcement = { text: `${boss.name} · ${hint}`, remaining: 4 };
  if(isTrialBoss(boss))game.encounter.name=boss.name;
  game.encounter.hint = hint;
}

function nearestEnemy(game, range) {
  let best = null, bestD = range * range;
  for (const e of game.enemies) {
    if (e.dead || e.spawnDelay > 0) continue;
    const d = distance2(game.player, e);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function damageEnemy(game, enemy, damage, color = "#fff1a8", source = "hero", category = source==='common'?'common':'active') {
  if (!enemy || enemy.dead || !Number.isFinite(damage) || damage <= 0) return false;
  const protectedByKiln = !enemy.boss && !enemy.elite && game.enemyHazards.some(h => h.type === 'aura' && h.remaining > 0 && h.ownerId !== enemy.id && game.enemies.some(e=>e.id===h.ownerId&&!e.dead) && distance2(h,enemy) <= h.radius ** 2);
  if (protectedByKiln) damage *= .65;
  damage *= getTrialDamageMultiplier(game,enemy);
  const actual = Math.min(Math.max(0,enemy.hp),damage);
  enemy.hp -= damage; enemy.hitFlash = 0.12;
  if(source !== 'enemy') {
    game.stats.damageDealt += actual;
    const categories=["basic","basicSecondary","active","companion","reaction","common"];
    const totals=game.stats.damageBySource ||= Object.fromEntries(categories.map(k=>[k,0]));
    const hits=game.stats.damageHits ||= Object.fromEntries(categories.map(k=>[k,0]));
    const key=categories.includes(category)?category:"active";totals[key]+=actual;if(actual>0)hits[key]++;
    game.stats[source === 'common' ? 'commonDamage' : 'heroDamage'] += actual;
  }
  if(actual>0) emitCombatFeedback(game,'hit',{x:enemy.x,y:enemy.y,color,strength:Math.sqrt(actual)/5,angle:Math.atan2(enemy.y-game.player.y,enemy.x-game.player.x)});
  onEnemyDamaged(game, enemy, actual);
  if (source !== 'enemy' && game.damageNumbers.length < 28) game.damageNumbers.push({ x: enemy.x, y: enemy.y - enemy.radius, value: Math.round(damage), life: 0.55, color });
  if (enemy.hp <= 0) {
    enemy.dead = true; onOriginalEnemyDeath(game,enemy,combatApi(game,'hero')); enemy.deathLife = 0.38; enemy.anim = "death"; enemy.animTime = 0; enemy.animDuration = 0.38; if(!enemy.trialConstruct)game.kills++;
    emitCombatFeedback(game,'kill',{x:enemy.x,y:enemy.y,color,strength:enemy.boss?3:enemy.elite?2:1,boss:enemy.boss,angle:Math.atan2(enemy.y-game.player.y,enemy.x-game.player.x)});
    enemy.animHoldFrame = null; cancelEnemyOwned(game, enemy.id);
    if(!enemy.trialConstruct)addGem(game, enemy.x, enemy.y, enemy.xp);
    if (!enemy.trialConstruct && enemy.guaranteedSupply) dropSupply(game, enemy.x, enemy.y);
  }
  return true;
}

function addGem(game, x, y, value) {
  const cap = 180;
  if (game.gems.length < cap) game.gems.push({ id: game._nextId++, x, y, value });
  else {
    let nearest = game.gems[0], best = Infinity;
    for (const gem of game.gems) { const d = (gem.x - x) ** 2 + (gem.y - y) ** 2; if (d < best) { best = d; nearest = gem; } }
    nearest.value += value;
  }
}

function gainXp(game, amount) {
  game.player.xp += amount;
  while (game.player.xp >= game.player.xpNext) {
    game.player.xp -= game.player.xpNext; game.player.level++; game.player.xpNext = 14 + game.player.level * 8;
    requestUpgrade(game);
  }
}

function beginBossSkill(game, boss) {
  const kind = ["cone", "charge", "slam"][boss.skillIndex++ % 3], low = boss.hp / boss.maxHp < 0.4;
  const angle = Math.atan2(game.player.y-boss.y, game.player.x-boss.x), charge = low ? 0.7 : 1.05;
  boss.bossState = { kind, charge, angle, ox: boss.x, oy: boss.y, targetX: game.player.x, targetY: game.player.y };
  if (kind === "cone") game.effects.push({ type:"telegraph", shape:"cone", x:boss.x, y:boss.y, angle, radius:230, width:1.35, length:230, life:charge, maxLife:charge });
  if (kind === "charge") game.effects.push({ type:"telegraph", shape:"line", x:boss.x, y:boss.y, angle, radius:0, width:76, length:320, life:charge, maxLife:charge });
  if (kind === "slam") game.effects.push({ type:"telegraph", shape:"circle", x:game.player.x, y:game.player.y, angle:0, radius:155, width:0, length:0, life:charge, maxLife:charge });
}

function finishBossSkill(game, boss, state, protectPlayer = false) {
  const player=game.player;
  const hurt = amount => hurtPlayer(game, amount, protectPlayer, 'mechanic');
  if(state.kind==="cone"){
    const delta=Math.atan2(Math.sin(Math.atan2(player.y-boss.y,player.x-boss.x)-state.angle),Math.cos(Math.atan2(player.y-boss.y,player.x-boss.x)-state.angle));
    if(distance2(player,boss)<=230**2&&Math.abs(delta)<.675)hurt(boss.damage*1.05);
    game.effects.push({type:"bossCleave",hostile:true,x:boss.x,y:boss.y,angle:state.angle,width:1.35,radius:230,life:.6,maxLife:.6});
  } else if(state.kind==="charge"){
    const toX=clamp(state.ox+Math.cos(state.angle)*320,boss.radius,WORLD_W-boss.radius),toY=clamp(state.oy+Math.sin(state.angle)*320,boss.radius,WORLD_H-boss.radius);boss.x=toX;boss.y=toY;
    if(lineDistance(player,state.ox,state.oy,toX,toY)<player.radius+38)hurt(boss.damage*1.15);
    game.effects.push({type:"bossCharge",hostile:true,x:state.ox,y:state.oy,toX,toY,life:.6,maxLife:.6});
  } else {
    if(Math.hypot(player.x-state.targetX,player.y-state.targetY)<155+player.radius)hurt(boss.damage*1.25);
    game.effects.push({type:"bossSlam",hostile:true,x:state.targetX,y:state.targetY,radius:155,life:.8,maxLife:.8});
  }
  for (const companion of game.companions) {
    let hit = false;
    if (state.kind === "cone") {
      const delta=Math.atan2(Math.sin(Math.atan2(companion.y-boss.y,companion.x-boss.x)-state.angle),Math.cos(Math.atan2(companion.y-boss.y,companion.x-boss.x)-state.angle));
      hit=distance2(companion,boss)<=230**2&&Math.abs(delta)<.675;
    } else if (state.kind === "charge") hit=lineDistance(companion,state.ox,state.oy,boss.x,boss.y)<companion.radius+38;
    else hit=Math.hypot(companion.x-state.targetX,companion.y-state.targetY)<155+companion.radius;
    if (hit) hurtCompanion(game,companion,boss.damage*(state.kind==="slam"?1.25:state.kind==="charge"?1.15:1.05));
  }
  boss.skillClock=boss.hp/boss.maxHp<.4?1.65:2.7;
}

function updateFields(game,dt){
  for(const field of game.fields){const fieldDt=field.heroPersistent&&game.phase!=="playing"?0:dt;field.life-=fieldDt;field.tick-=fieldDt;if(field.type==="heroFrost")continue;if(field.type==="rockWall")continue;
    if(field.type==="poison"){
      const damage=(9+field.level*4)*getCombatStats(game).damage;
      for(const enemy of game.enemies)if(!enemy.dead&&enemy.spawnDelay<=0&&distance2(field,enemy)<=field.radius**2){enemy.poisonEffects=enemy.poisonEffects||[];let poison=enemy.poisonEffects.find(effect=>effect.sourceId===field.id);if(!poison){poison={sourceId:field.id,damage,remaining:2};enemy.poisonEffects.push(poison);}poison.damage=damage;poison.remaining=2;enemy.poisonTick=Math.min(enemy.poisonTick??0,.55);}
      if(field.tick<=0){for(const object of game.mapObjects)if(object.type==="crate"&&object.state!=="destroyed"&&distance2(field,object)<=field.radius**2)damageCrate(game,object,damage);field.tick=.55;}
      continue;
    }
    if(field.tick<=0){for(const enemy of game.enemies)if(!enemy.dead&&enemy.spawnDelay<=0&&distance2(field,enemy)<=field.radius**2)damageEnemy(game,enemy,27*getCombatStats(game).damage,"#d5ffff");for(const object of game.mapObjects)if(object.type==="crate"&&object.state!=="destroyed"&&distance2(field,object)<=field.radius**2)damageCrate(game,object,27*getCombatStats(game).damage);field.tick=.32;}}
  game.fields=game.fields.filter(field=>field.life>0);
}

function hurtPlayer(game, amount, protectPlayer, source = 'contact', attacker=null) {
  const p = game.player;
  if (protectPlayer || game.heroState?.blinkTravel || p.invulnerable > 0) return false;
  if(source!=='mechanic'){if(p.mythicAirborne?.remaining>0)return false;const front=attacker?Math.atan2(attacker.y-p.y,attacker.x-p.x):null;const faces=guard=>front===null||Math.abs(Math.atan2(Math.sin(front-guard.angle),Math.cos(front-guard.angle)))<=Math.PI/2;if(source==='contact'&&p.mythicSwordGuard?.charges>0&&faces(p.mythicSwordGuard)){p.mythicSwordGuard.charges--;return false;}if(p.mythicFrontGuard?.remaining>0&&faces(p.mythicFrontGuard))amount*=p.mythicFrontGuard.factor;}
  if(source!=='mechanic')amount=absorbSpecialHeroDamage(game,amount,attacker);
  amount=absorbOriginalDamage(game,amount,source,attacker,combatApi(game,'hero'));
  const incoming = amount * ((p.guardTime || 0) > 0 ? .4 : 1);
  const absorbed = Math.min(Math.max(0,p.commonShield||0),incoming);
  p.commonShield = Math.max(0,(p.commonShield||0)-absorbed);
  const received = incoming-absorbed;
  onJobGuardHit(game,combatApi(game,"hero"));
  p.hp = Math.max(0, p.hp - received); p.invulnerable = .72; p.hitFlash = .12;
  if(received>0) emitCombatFeedback(game,'hurt',{x:p.x,y:p.y,color:'#ff857b',strength:Math.sqrt(received)/3});
  game.stats.damageTaken += received;
  const bySource=game.stats.damageTakenBySource ||= {contact:0,projectile:0,mechanic:0};
  bySource[source]=(bySource[source]||0)+received;
  game.effects.push({ type: "hit", x: p.x, y: p.y, life: .25, maxLife: .25 });
  return true;
}

function hurtCompanion(game, companion, amount) {
  if (!companion || companion.hp <= 0 || (companion.invulnerable || 0) > 0) return false;
  if(companion.soulShield){companion.soulShield=0;return false;}
  const received = amount * ((companion.damageReduction || 0) > 0 ? .75 : 1);
  companion.hp = Math.max(0, companion.hp - received); companion.invulnerable = .55; companion.hitFlash = .12;
  game.effects.push({ type: "hit", x: companion.x, y: companion.y, life: .25, maxLife: .25 });
  return true;
}

function segmentHitsWall(field, fromX, fromY, toX, toY, padding = 0) {
  const distanceToSegment=(px,py,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,length2=dx*dx+dy*dy,t=length2?clamp(((px-ax)*dx+(py-ay)*dy)/length2,0,1):0;return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));};
  const segmentDistance=(ax,ay,bx,by,cx,cy,dx,dy)=>{
    const abx=bx-ax,aby=by-ay,cdx=dx-cx,cdy=dy-cy,cross=abx*cdy-aby*cdx;
    if(Math.abs(cross)>.0001){const acx=cx-ax,acy=cy-ay,t=(acx*cdy-acy*cdx)/cross,u=(acx*aby-acy*abx)/cross;if(t>=0&&t<=1&&u>=0&&u<=1)return 0;}
    return Math.min(distanceToSegment(ax,ay,cx,cy,dx,dy),distanceToSegment(bx,by,cx,cy,dx,dy),distanceToSegment(cx,cy,ax,ay,bx,by),distanceToSegment(dx,dy,ax,ay,bx,by));
  };
  const count=field.segments||18,start=field.angle-field.arcAngle/2,limit=field.depth/2+padding;
  let ax=field.x+Math.cos(start)*field.arcRadius,ay=field.y+Math.sin(start)*field.arcRadius;
  for(let i=1;i<=count;i++){
    const a=start+field.arcAngle*i/count,bx=field.x+Math.cos(a)*field.arcRadius,by=field.y+Math.sin(a)*field.arcRadius;
    if(segmentDistance(fromX,fromY,toX,toY,ax,ay,bx,by)<=limit)return true;
    ax=bx;ay=by;
  }
  return false;
}

function movementHitsWall(game, fromX, fromY, toX, toY, padding = 0) {
  return game.fields.some(field=>field.type==="rockWall"&&segmentHitsWall(field,fromX,fromY,toX,toY,padding));
}

function updateHeroSystems(game, dt, input) {
  const p = game.player, state = game.heroState;
  state.skillLock = Math.max(0, (state.skillLock || 0) - dt);
  updateBlink(game,dt,{damage:(e,n,color,category)=>damageEnemy(game,e,n,color||'#d9c7ff','hero',category),complete:id=>onHeroSkill(game,id,combatApi(game,'hero'))});
  if (state.flame) {
    state.flame.remaining -= dt; state.flame.tick -= dt;
    if (state.flame.tick <= 0) {
      for (const enemy of game.enemies) if (!enemy.dead && enemy.spawnDelay <= 0 && distance2(p, enemy) <= state.flame.radius ** 2) {
        const delta = Math.atan2(Math.sin(Math.atan2(enemy.y-p.y,enemy.x-p.x)-state.flame.angle), Math.cos(Math.atan2(enemy.y-p.y,enemy.x-p.x)-state.flame.angle));
        if (Math.abs(delta) <= state.flame.width/2) { if(hasJobMechanic(game,'mage_master'))(enemy.jobElements||={}).fire=game.time+3; damageEnemy(game, enemy, 16 * getCombatStats(game).damage, "#ffb06b"); }
      }
      state.flame.tick = .18;
    }
    const effect = game.effects.find(e => e.type === "flameBreath" && e.life > 0);
    if (effect) { effect.x = p.x; effect.y = p.y; effect.angle = state.flame.angle; }
    if (state.flame.remaining <= 0) state.flame = null;
  }
  if (state.frostAura) {
    state.frostAura.remaining -= dt; state.frostAura.tick -= dt;
    if (state.frostAura.tick <= 0) {
      for (const enemy of game.enemies) if (!enemy.dead && enemy.spawnDelay <= 0 && distance2(state.frostAura, enemy) <= state.frostAura.radius ** 2) {
        if(hasJobMechanic(game,'mage_master'))(enemy.jobElements||={}).frost=game.time+3; damageEnemy(game, enemy, 13 * getCombatStats(game).damage, "#b9ecff"); if(!enemy.boss)enemy.slow = Math.max(enemy.slow || 0, .65);
      }
      state.frostAura.tick = .35;
    }
    if (state.frostAura.remaining <= 0) state.frostAura = null;
  }
}

function updateCompanions(game, dt) {
  if(game.heroId==='summoner')return;
  for (const c of game.companions) {
    if(c.ascensionRush && c.hp>0){c.invulnerable=Math.max(0,(c.invulnerable||0)-dt);c.damageReduction=Math.max(0,(c.damageReduction||0)-dt);c.hitFlash=Math.max(0,(c.hitFlash||0)-dt);continue;}
    if (c.hp <= 0) continue;
    if (distance2(c,game.player)>560**2) {
      const angle=(c.id%4)*TAU/4;
      c.x=clamp(game.player.x+Math.cos(angle)*64,c.radius,WORLD_W-c.radius);
      c.y=clamp(game.player.y+Math.sin(angle)*64,c.radius,WORLD_H-c.radius);
      game.effects.push({type:'recall',x:c.x,y:c.y,life:.3,maxLife:.3});
    }
    c.animTime = (c.animTime || 0) + dt; c.hitFlash = Math.max(0, (c.hitFlash || 0) - dt); c.invulnerable = Math.max(0, (c.invulnerable || 0) - dt); c.damageReduction = Math.max(0, (c.damageReduction || 0) - dt); c.attackClock -= dt;
    let target = null, best = 440 ** 2;
    for (const e of game.enemies) if (!e.dead && e.spawnDelay <= 0) { const d = distance2(c, e); if (d < best) { best = d; target = e; } }
    const focus=game.enemies.find(e=>e.id===c.focusTargetId&&!e.dead&&e.spawnDelay<=0&&distance2(c,e)<440**2);
    if(focus){target=focus;best=distance2(c,focus);}else if(game.heroKit?.secondaryFocusTime>0){const secondary=game.enemies.find(e=>e.id===c.secondaryFocusTargetId&&!e.dead&&e.spawnDelay<=0&&distance2(c,e)<440**2);if(secondary){target=secondary;best=distance2(c,secondary);}}
    if (!target) {
      const d = distance2(c, game.player);
      if (d > 115 ** 2) { const n = normalize(game.player.x-c.x, game.player.y-c.y); c.x += n.x*c.speed*dt; c.y += n.y*c.speed*dt; c.anim = "move"; }
      else c.anim = "idle";
      continue;
    }
    const n = normalize(target.x-c.x,target.y-c.y); c.facing=n.x>=0?1:-1; const reach=c.radius+target.radius+(c.elite?55:8);
    if (best > reach ** 2) { c.x += n.x*c.speed*dt; c.y += n.y*c.speed*dt; c.anim="move"; }
    else if (c.attackClock <= 0) {
      c.anim="attack"; c.animTime=0; c.animDuration=.3; c.attackClock=(c.elite?.85:.62)/getCombatStats(game).attackSpeed;
      const damage=c.damage*getCombatStats(game).damage;
      if (c.elite) {
        for (const e of game.enemies) if (!e.dead&&e.spawnDelay<=0&&distance2(c,e)<(105*getCombatStats(game).area)**2) damageEnemy(game,e,damage*(e.id===c.focusTargetId?(c.focusDamageMultiplier||1):1),"#ffd68c","hero","companion");
      } else {
        damageEnemy(game,target,damage*(target.id===c.focusTargetId?(c.focusDamageMultiplier||1):1),"#ffd68c","hero","companion");
      }
    }
  }
  game.companions = game.companions.filter(c => c.hp > 0);
}

function updateSpecialEnemy(game, e, target, targetD, dt, protectPlayer) {
  if (e.attackWarning) {
    e.attackWarning.remaining -= dt;
    if (e.attackWarning.remaining > 0) return true;
    const warning = e.attackWarning;
    if (warning.type === "shot") {
      if(!launchOrdinaryShot(game,e,warning))return true;
    } else {
      const from = { x: e.x, y: e.y }, length = 230;
      e.x = clamp(e.x + Math.cos(warning.angle) * length, e.radius, WORLD_W - e.radius);
      e.y = clamp(e.y + Math.sin(warning.angle) * length, e.radius, WORLD_H - e.radius);
      if(movementHitsWall(game,from.x,from.y,e.x,e.y,e.radius)){e.x=from.x;e.y=from.y;e.slow=Math.max(e.slow||0,.35);game.effects.push({type:"burst",x:e.x,y:e.y,weapon:"rockWall",angle:warning.angle,life:.25,maxLife:.25});}
      else if (lineDistance(game.player, from.x, from.y, e.x, e.y) < game.player.radius + e.radius * .65) hurtPlayer(game, e.damage * 1.15, protectPlayer, 'mechanic');
    }
    e.attackWarning=null;
    e.aiClock = warning.type === "shot" ? 2.5 + rng(game) * .5 : 2.6 + rng(game) * .8;
    return true;
  }
  if(e.kind !== 'archer_elite')e.aiClock = Math.max(0, (e.aiClock || 0) - dt);
  if (e.kind === "scout_basic" && e.aiClock <= 0 && target === game.player && targetD > 115 ** 2 && targetD < 390 ** 2) {
    const angle = Math.atan2(target.y - e.y, target.x - e.x);
    e.attackWarning = { type: "charge", angle, remaining: .6, total: .6 }; return true;
  }
  return false;
}

function step(game, dt, input, { protectPlayer = false } = {}) {
  tickCombatFeedback(game,dt);
  game.time += dt;
  const p = game.player;
  p.hitFlash = Math.max(0, (p.hitFlash || 0) - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt); p.guardTime = Math.max(0, (p.guardTime || 0) - dt); p.animTime += dt;
  for (const skill of Object.values(game.skills)) skill.remaining = Math.max(0, skill.remaining - dt);
  const blinkMoving=!!game.heroState?.blinkTravel;
  if (game.phase === "playing") { game._jobApi=combatApi(game,"hero"); updateHeroSystems(game, dt, input); updateCompanions(game, dt); updateJobMechanics(game,dt,game._jobApi); updateAscension(game,dt,game._jobApi); }
  p.lastMoveX=Number(input?.x)||0;p.lastMoveY=Number(input?.y)||0;
  const move = blinkMoving ? { x: 0, y: 0 } : normalize(Number(input?.x) || 0, Number(input?.y) || 0);
  const dash = p.dash;
  const dashFromX = p.x, dashFromY = p.y;
  if (dash) {
    dash.elapsed = Math.min(dash.duration, dash.elapsed + dt);
    const progress = dash.elapsed / dash.duration;
    p.x = dash.x + (dash.toX - dash.x) * progress;
    p.y = dash.y + (dash.toY - dash.y) * progress;
    p.invulnerable = Math.max(p.invulnerable, dt);
    for (const enemy of game.enemies) {
      if (!enemy.dead && enemy.spawnDelay <= 0 && !dash.hitEnemies.has(enemy.id) && lineDistance(enemy, dashFromX, dashFromY, p.x, p.y) < enemy.radius + (dash.hitRadius || DASH_HIT_RADIUS)) {
        dash.hitEnemies.add(enemy.id);
        damageEnemy(game, enemy, dash.damage, "#b7fff5");
      }
    }
    for (const object of game.mapObjects) {
      if (object.type === "crate" && object.state !== "destroyed" && !dash.hitCrates.has(object.id) && lineDistance(object, dashFromX, dashFromY, p.x, p.y) < object.radius + (dash.hitRadius || DASH_HIT_RADIUS)) {
        dash.hitCrates.add(object.id);
        damageCrate(game, object, dash.damage);
      }
    }
    if (dash.elapsed >= dash.duration) { p.dash = null; onJobDashComplete(game,combatApi(game,"hero")); }
  }
  p.moving = Boolean(dash || move.x || move.y);
  p.moveTime = p.moving ? (p.moveTime || 0) + dt : 0;
  if (!dash) {
    p.x = clamp(p.x + move.x * p.speed * dt, p.radius, WORLD_W - p.radius);
    p.y = clamp(p.y + move.y * p.speed * dt, p.radius, WORLD_H - p.radius);
    if (Math.abs(move.x) > 0.05) p.facing = move.x > 0 ? 1 : -1;
  }
  const actionActive = (p.anim === "attack" || p.anim === "cast") && p.animTime < p.animDuration;
  if (!actionActive) { p.anim = dash || move.x || move.y ? "move" : "idle"; p.animDuration = 0; p.animSource = null; p.animFacing = null; }

  if (game.phase === "playing") updateMapObjects(game, dt);

  const scheduleScale = game.duration / 360;
  const progress = Math.min(1, game.time / game.duration);
  while (game._stageIndex + 1 < STAGES.length && game.time >= STAGES[game._stageIndex + 1].at * scheduleScale) {
    game._stageIndex++;
    const next = encounterStage(game);
    if(isTrialBoss(game.boss)&&!game.boss.dead) {
      // Scheduling still advances, but the active trial remains the objective.
      game.encounter = { name: game.boss.name, hint: game.dungeon?.boss?.hint || game.encounter.hint, index: game._stageIndex };
    } else {
      game.encounter = { name: next.name, hint: next.hint, index: game._stageIndex };
      game.announcement = { text: next.name, remaining: 3 };
    }
  }
  if (game.time >= (game.dungeon?.boss?.spawnAt ?? game.duration * 5 / 6)) spawnBoss(game);
  while (game._eliteWaves < 3 && game.time >= [90, 180, 270][game._eliteWaves] * scheduleScale) spawnEliteWave(game);
  if (game.time >= game._nextSupplyAt) {
    const angle = rng(game) * TAU, distance = 180 + rng(game) * 130;
    dropSupply(game, game.player.x + Math.cos(angle) * distance, game.player.y + Math.sin(angle) * distance);
    game._nextSupplyAt += 58 * scheduleScale;
    game.announcement = { text: "战地补给已投放", remaining: 2.5 };
  }
  game.announcement.remaining = Math.max(0, game.announcement.remaining - dt);
  if (game.announcement.remaining === 0 && game.announcement.text) game.announcement = { text: "", remaining: 0 };
  game._magnetTime = Math.max(0, game._magnetTime - dt);
  recycleDistantEnemies(game);
  game._spawnClock -= dt;
  if (game._spawnClock <= 0) {
    const stage = STAGES[game._stageIndex];
    const burst = stage.burst + (game.time >= 270 && rng(game) < .35 ? 1 : 0);
    if(!isTrialBoss(game.boss)&&ordinaryWaveOpen(game))for (let i = 0; i < burst; i++) spawnEnemy(game);
    // A full roster or rest window skips this pulse; it never accrues backfill.
    game._spawnClock = stage.interval / clamp(Number(game.dungeon?.spawnScale) || 1, .25, 4) / (game.boss && !game.boss.dead ? .65 : 1);
  }
  scheduleOrdinaryRanged(game,dt);
  for (const e of game.enemies) {
    e.animTime += dt;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.dead) { e.deathLife -= dt; continue; }
    if (e.anim === "attack" && e.animHoldFrame == null && e.animTime >= e.animDuration) { e.anim = "move"; e.animTime = 0; e.animDuration = 0; }
    if (e.spawnDelay > 0) { e.spawnDelay = Math.max(0, e.spawnDelay - dt); continue; }
    if(e.poisonEffects?.length){for(const poison of e.poisonEffects)poison.remaining-=dt;e.poisonEffects=e.poisonEffects.filter(poison=>poison.remaining>0);e.poisonTick=(e.poisonTick??0)-dt;if(e.poisonEffects.length&&e.poisonTick<=0){damageEnemy(game,e,Math.max(...e.poisonEffects.map(poison=>poison.damage)),"#8fd45a","common");e.poisonTick+=.55;}if(!e.poisonEffects.length)e.poisonTick=0;if(e.dead)continue;}
    if (e.boss && !e.abilityId) {
      if (e.bossState) { e.bossState.charge -= dt; if (e.bossState.charge <= 0) { const state=e.bossState; e.bossState=null; finishBossSkill(game,e,state,protectPlayer); } continue; }
      e.skillClock -= dt;
      if (e.skillClock <= 0) { beginBossSkill(game,e); continue; }
    }
    if(e.trialConstruct||e.specialHeld)continue;
    const livingAllies = game.companions.filter(a => !a.incapacitated&&a.hp>0);
    let target = p, targetD = distance2(p, e);
    if (!e.boss || !e.abilityId) for (const ally of livingAllies) { const d = distance2(ally, e); if (d < targetD && d < 260 ** 2) { target = ally; targetD = d; } }
    const decoy=originalDecoy(game,e)||getMythicDecoy(game,e);if(decoy&&distance2(decoy,e)<targetD){target=decoy;targetD=distance2(decoy,e);}
    if(target===p&&game.originalHero?.stealth>0&&!e.boss&&!e.abilityId){e.anim='idle';continue;}
    const oldX=e.x, oldY=e.y;
    const slowed = e.frozen > 0 ? 0 : e.slow > 0 ? (e.boss ? 0.72 : 0.55) : 1;
    e.slow = Math.max(0, (e.slow || 0) - dt);
    e.frozen = Math.max(0, (e.frozen || 0) - dt);
    const specialBusy = e.abilityId ? (slowed === 0 || updateEnemyAbility(game,e,dt*slowed,enemyApi(game,protectPlayer))) : !e.boss && (slowed === 0 || updateSpecialEnemy(game, e, target, targetD, dt * slowed, protectPlayer));
    const repositioning = e.abilityId === 'cinderweaver' && e.abilityState?.move === 'reposition';
    const movementTarget = repositioning ? e.abilityState.repositionPoint : e.boss && e.abilityState?.waitForView ? getEnemyApproachPoint(game,e) : target;
    const movementD = distance2(movementTarget,e), n = normalize(movementTarget.x-e.x,movementTarget.y-e.y);e.facing = n.x>=0?1:-1;
    const preferredRange = e.abilityId && e.boss ? (e.abilityState?.waitForView || repositioning ? 0 : 70) : e.kind === "archer_elite" ? (e.rangedNeedsView ? 0 : 285) : e.radius + target.radius + 42;
    if (!specialBusy && (!e.boss || Math.sqrt(movementD) > preferredRange) && (e.kind !== "archer_elite" || Math.sqrt(targetD) > preferredRange)) {
      const moveSpeed=e.speed*(repositioning?.55:1);
      e.x += n.x * moveSpeed * slowed * dt; e.y += n.y * moveSpeed * slowed * dt;
    } else if (!specialBusy && e.kind === "archer_elite" && Math.sqrt(targetD) < 185) {
      e.x -= n.x * e.speed * .7 * slowed * dt; e.y -= n.y * e.speed * .7 * slowed * dt;
    }
    if (!e.boss && movementHitsWall(game,oldX,oldY,e.x,e.y,e.radius)) { e.x=oldX; e.y=oldY; }
    if (!specialBusy && !e.boss && distance2(target, e) < (target.radius + e.radius - 4) ** 2 && target.invulnerable <= 0 && !(protectPlayer && target === p)) {
      e.anim = "attack"; e.animTime = 0; e.animDuration = 0.32;
      if (target === p) hurtPlayer(game,e.damage,protectPlayer,'contact',e); else if(target.originalDecoy){target.hp=0;} else if(target.mythicClone){target.hp=Math.max(0,target.hp-e.damage);target.invulnerable=.25;if(target.hp<=0){target.dead=true;target.remaining=0;}} else hurtCompanion(game,target,e.damage);
      if (target === p && p.hp <= 0) { p.hp = 0; p.anim = "death"; p.animTime = 0; p.animDuration = 0.6; game.phase = "defeat"; return; }
      if (target !== p && !target.mythicClone && target.hp <= 0) { target.hp = 0; target.incapacitated = true; target.reviveTimer = 8; target.anim = "death"; target.animTime = 0; target.animDuration = 0.6; }
    }
  }
  updateEnemyHazards(game, dt, enemyApi(game,protectPlayer));
  if (p.hp <= 0) { p.hp = 0; p.anim = "death"; p.animTime = 0; p.animDuration = 0.6; game.phase = "defeat"; return; }
  if(game.phase === "playing") { updateHeroKit(game,dt,combatApi(game,"hero")); updateCommonAbilities(game,dt,combatApi(game,"common")); }
  updateFields(game, dt);
  for (const shot of game.projectiles) {
    if(shot.weapon==='markBlade' && game.phase!=='playing')continue;
    if (shot.hit) continue;
    shot.age=(shot.age || 0)+dt;
    if (shot.weapon === "orb") {
      let target=game.enemies.find(enemy=>enemy.id===shot.targetId&&!enemy.dead&&enemy.spawnDelay<=0);
      if(!target)target=nearestEnemy(game,560);
      if(target){shot.targetId=target.id;const aim=normalize(target.x-shot.x,target.y-shot.y),speed=shot.speed||420;shot.vx=shot.vx*.86+aim.x*speed*.14;shot.vy=shot.vy*.86+aim.y*speed*.14;}
    }
    if (shot.weapon === "dagger") {
      shot.spin=(shot.spin||0)+dt*18;
      if (shot.phase === "outbound") {
        const turn=(shot.curve||0)*dt, cos=Math.cos(turn), sin=Math.sin(turn), vx=shot.vx, vy=shot.vy;
        shot.vx=vx*cos-vy*sin; shot.vy=vx*sin+vy*cos;
        shot.travel=(shot.travel||0)+Math.hypot(shot.vx,shot.vy)*dt;
        const nextX=shot.x+shot.vx*dt,nextY=shot.y+shot.vy*dt,edge=28;
        if (shot.travel >= shot.maxDistance || nextX<edge || nextY<edge || nextX>WORLD_W-edge || nextY>WORLD_H-edge) {
          shot.phase="returning"; shot.hitIds=new Set();
          // Keep an edge-triggered turn inside the playable world before steering home.
          shot.x=clamp(shot.x,edge,WORLD_W-edge); shot.y=clamp(shot.y,edge,WORLD_H-edge);
          if (nextX<edge || nextY<edge || nextX>WORLD_W-edge || nextY>WORLD_H-edge) {
            const inward=normalize(p.x-shot.x,p.y-shot.y),speed=Math.hypot(shot.vx,shot.vy)||480;
            shot.vx=inward.x*speed; shot.vy=inward.y*speed;
          }
        }
      }
      if (shot.phase === "returning") {
        const home=normalize(p.x-shot.x,p.y-shot.y),distance=Math.hypot(p.x-shot.x,p.y-shot.y);
        const speed=(shot.returnSpeed||590)+Math.min(190,distance*.22), current=Math.atan2(shot.vy,shot.vx), desired=Math.atan2(home.y,home.x);
        let delta=Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
        if (Math.abs(Math.abs(delta)-Math.PI)<.0001) delta=Math.PI*Math.sign(shot.curve||1);
        const angle=current+clamp(delta,-dt*9.5,dt*9.5);
        shot.vx=Math.cos(angle)*speed; shot.vy=Math.sin(angle)*speed;
      }
    }
    const shotFromX=shot.x,shotFromY=shot.y;
    shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
    if (shot.weapon === "dagger" && shot.phase === "returning") {
      const edge=28; shot.x=clamp(shot.x,edge,WORLD_W-edge); shot.y=clamp(shot.y,edge,WORLD_H-edge);
      const segmentX=shot.x-shotFromX,segmentY=shot.y-shotFromY,length2=segmentX*segmentX+segmentY*segmentY;
      const t=length2>0?clamp(((p.x-shotFromX)*segmentX+(p.y-shotFromY)*segmentY)/length2,0,1):0;
      const catchX=shotFromX+segmentX*t,catchY=shotFromY+segmentY*t;
      if (shot.age>.18 && Math.hypot(p.x-catchX,p.y-catchY)<=p.radius+18) { shot.hit=true; continue; }
    }
    if (shot.weapon === "markBlade" && Math.hypot(shot.x-shot.originX,shot.y-shot.originY) >= shot.maxDistance) {
      const n=normalize(shot.x-shot.originX,shot.y-shot.originY); shot.x=shot.originX+n.x*shot.maxDistance; shot.y=shot.originY+n.y*shot.maxDistance; shot.life=0;
    }
    for (const e of game.enemies) if (!e.dead && !(e.spawnDelay > 0) && !shot.hitIds?.has(e.id) && (shot.weapon === "markBlade" ? lineDistance(e,shotFromX,shotFromY,shot.x,shot.y) < shot.radius+e.radius : distance2(shot, e) < (shot.radius + e.radius) ** 2)) {
      damageEnemy(game, e, shot.damage, "#8ee9ff"); game.effects.push({ type: "burst", x: shot.x, y: shot.y, weapon:shot.weapon, angle:Math.atan2(shot.vy,shot.vx), life: 0.4, maxLife:0.4 });

      shot.hitIds?.add(e.id);
      if (shot.weapon !== "dagger") { if ((shot.pierce || 0) > 0) shot.pierce--; else shot.hit = true; }
      if(shot.weapon!=="markBlade")break;
    }
    if (shot.weapon === 'markBlade' && shot.life <= 0 && !shot.hit) {shot.x=shot.toX;shot.y=shot.toY;landBlinkBlade(game,shot);}
  }
  for (const shot of game.enemyProjectiles) {
    if (shot.ownerId != null && !game.enemies.some(e=>e.id===shot.ownerId&&!e.dead)) { shot.hit = true; continue; }
    const shotFromX=shot.x,shotFromY=shot.y,shotDt=Math.min(dt,Math.max(0,shot.life));shot.x += shot.vx * shotDt; shot.y += shot.vy * shotDt; shot.life -= dt;
    if(captureSpecialProjectile(game,shot,{x:shotFromX,y:shotFromY},shot))continue;
    if (movementHitsWall(game,shotFromX,shotFromY,shot.x,shot.y,shot.radius)) { shot.hit=true; game.effects.push({type:"burst",x:shot.x,y:shot.y,weapon:"rockWall",angle:0,life:.2,maxLife:.2}); }
    if (shot.hit) continue;
    for (const object of game.mapObjects) if (object.type === "crate" && object.state !== "destroyed" && lineDistance(object,shotFromX,shotFromY,shot.x,shot.y) < shot.radius + object.radius) {
      damageCrate(game, object, shot.damage);
      shot.hitIds?.add(object.id); if ((shot.pierce || 0) > 0) shot.pierce--; else shot.hit = true; break;
    }
    if (shot.hit) continue;
    for (const companion of game.companions) if (!shot.hit && companion.hp > 0 && lineDistance(companion,shotFromX,shotFromY,shot.x,shot.y) < shot.radius+companion.radius) { shot.hit=true; hurtCompanion(game,companion,shot.damage); }
    if (!shot.hit && lineDistance(p,shotFromX,shotFromY,shot.x,shot.y) < shot.radius+p.radius) { shot.hit = true; hurtPlayer(game, shot.damage, protectPlayer, shot.kind==='laneShell'?'mechanic':'projectile',shot); }
  }
  if (p.hp <= 0) { p.anim = "death"; p.animTime = 0; p.animDuration = .6; game.phase = "defeat"; return; }
  const pickup = game._magnetTime > 0 ? 310 : 54*(1+.2*(game.growth.pickup||0));
  for (const gem of game.gems) {
    if (gem.collected) continue;
    const d = Math.sqrt(distance2(p, gem));
    if (d < pickup * 2.2) { const n = normalize(p.x - gem.x, p.y - gem.y); const speed = 110 + (pickup * 2.2 - d) * 2.5; gem.x += n.x * speed * dt; gem.y += n.y * speed * dt; }
    if (d < p.radius + 12) { gem.collected = true; emitCombatFeedback(game,'pickup',{x:gem.x,y:gem.y,color:'#9effda',strength:Math.sqrt(gem.value)}); gainXp(game, gem.value); }
  }
  for (const supply of game.supplies) {
    if (!supply.collected && distance2(supply, p) < (p.radius + 22) ** 2) {
      supply.collected = true;
      emitCombatFeedback(game,'supply',{x:supply.x,y:supply.y,color:supply.type==='heal'?'#b1ffd1':'#a1e6ff',strength:2});
      if (supply.type === "heal") p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .24);
      else game._magnetTime = Math.max(game._magnetTime, 8);
      game.announcement = { text: supply.type === "heal" ? "生命补给 +24%" : "魂晶磁吸 8秒", remaining: 2 };
    }
  }
  for (const list of [game.effects, game.damageNumbers]) for (const item of list) { if (!(item.heroPersistent && game.phase !== "playing")) item.life -= dt; if (item.type === undefined) item.y -= 25 * dt; }
  game.enemies = game.enemies.filter(e => !e.dead || e.deathLife > 0);
  game.gems = game.gems.filter(g => !g.collected);
  game.projectiles = game.projectiles.filter(s => !s.hit && s.life > 0);
  game.enemyProjectiles = game.enemyProjectiles.filter(s => !s.hit && s.life > 0 && s.x > -80 && s.y > -80 && s.x < WORLD_W + 80 && s.y < WORLD_H + 80).slice(-90);
  game.supplies = game.supplies.filter(s => !s.collected).slice(-8);
  game.effects = game.effects.filter(e => e.life > 0);
  game.damageNumbers = game.damageNumbers.filter(e => e.life > 0);
  if (game.time >= game.duration && (!game.dungeon?.boss || game.boss?.dead)) game.phase = "victory";
}

export function updateGame(game, dt, input = { x: 0, y: 0 }) {
  if(game?.phase==='defeat'||game?.phase==='victory'){clearSpecialHero(game);clearAscension(game);clearMythicHero(game);}
  if (!game || !Number.isFinite(dt) || dt <= 0) return game;
  // Death can interrupt a queued level: present it after the rescue pause, before simulation advances.
  if(game.phase==='playing' && game.runSupport?.revived && game._pendingLevels>0) {
    if(!game.choices.length)game.choices=makeChoices(game);
    game.phase='upgrade';game.timeScale=0;return game;
  }
  const transitionPhase = game.phase;
  if (!["playing", "upgrade_slowdown", "upgrade_resume"].includes(transitionPhase)) return game;

  let scaledDt = Math.min(dt, 0.25);
  let stepInput = input;
  let protectPlayer = false;
  if (transitionPhase === "upgrade_slowdown" || transitionPhase === "upgrade_resume") {
    game._upgradeTransitionElapsed += dt;
    const duration = transitionPhase === "upgrade_slowdown" ? UPGRADE_SLOWDOWN_DURATION : UPGRADE_RESUME_DURATION;
    const progress = clamp(game._upgradeTransitionElapsed / duration, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    game.timeScale = transitionPhase === "upgrade_slowdown" ? 1 - eased : eased;
    scaledDt *= game.timeScale;
    protectPlayer = true;
    if (transitionPhase === "upgrade_slowdown") stepInput = { x: 0, y: 0 };
  } else game.timeScale = 1;

  game._accumulator += scaledDt;
  let iterations = 0;
  while (game._accumulator >= STEP && iterations++ < 15 && game.phase === transitionPhase) {
    step(game, STEP, stepInput, { protectPlayer }); game._accumulator -= STEP;
  }
  if (game.phase === 'defeat' || game.phase === 'victory'){clearSpecialHero(game);clearAscension(game);clearMythicHero(game);}
  if (game.phase === 'defeat' && isTrialBoss(game.boss))clearEnemyAbilities(game);
  if ((game.phase === 'defeat' && !canRevive(game)) || game.phase === 'victory') {game.originalHero=null;clearEnemyAbilities(game);clearOrdinaryRanged(game);game.heroState.blinkAnchors=[];game.heroState.blinkTravel=null;game.projectiles=game.projectiles.filter(s=>s.weapon!=='markBlade');}

  // A fixed step may have reached a terminal state; upgrade transitions must never overwrite it.
  if (game.phase === transitionPhase && transitionPhase === "upgrade_slowdown" && game._upgradeTransitionElapsed >= UPGRADE_SLOWDOWN_DURATION) {
    game.phase = "upgrade";
    game.timeScale = 0;
    game._accumulator = 0;
  } else if (game.phase === transitionPhase && transitionPhase === "upgrade_resume" && game._upgradeTransitionElapsed >= UPGRADE_RESUME_DURATION) {
    game.phase = "playing";
    game.timeScale = 1;
    game._upgradeTransitionElapsed = 0;
  }
  return game;
}

export function getHud(game) {
  return { phase: game.phase, time: game.time, duration: game.duration, kills: game.kills,
    hp: game.player.hp, maxHp: game.player.maxHp, level: game.player.level, xp: game.player.xp, xpNext: game.player.xpNext,
    dungeon: game.dungeon, encounter: game.encounter, announcement: game.announcement,
    boss: game.boss ? { name: game.boss.name, hp: Math.max(0, game.boss.hp), maxHp: game.boss.maxHp, dead: !!game.boss.dead } : null,
    companions: game.companions.map(({ id, kind, elite, hp, maxHp }) => ({ id, kind, elite, hp, maxHp })) };
}








