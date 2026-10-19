import { unitAssets as defaultUnitAssets } from './assets.js';
import { vfxAssets as defaultVfxAssets } from './vfx-assets.js';
import { HEROES, SKILL_DEFINITIONS, HERO_ACTIVE_SKILLS, getActiveSkillLoadout, getHeroKind, getHeroJobs } from './heroes.js';
import { createGame, configureRun, startGame, castSkill, updateGame } from './simulation.js';
import { createRenderer } from './renderer.js';
import { getJobSkillDescription } from './profession-content.js';
import { ensureSpecialHero } from './special-heroes.js';
import { ensureOriginal } from './original-heroes.js';
import { getSkillGeometry } from './combat-stats.js';
import { applyGrowthUpgrade } from './growth.js';

const PREVIEW_SECONDS = 7.2;
const VIRTUAL_WIDTH = 720;
const VIRTUAL_HEIGHT = 400;
const AIM = Object.freeze({ x: 1, y: 0 });
const ALL_SKILLS = Object.values(HERO_ACTIVE_SKILLS).flat();

const PLAYING_CAPTIONS = Object.freeze({
  swordFocus: '真实飞剑出鞘 → 指定集火点 → 自主索敌追击',
  swordRecall: '飞剑在外 → 沿真实路径回剑 → 短时护身',
  swordUnion: '飞剑实体收拢停击 → 巨剑斩落 → 拆回飞剑',
  spiralOrb: '旋球飞行 → 碰敌停留旋磨 → 结束爆发',
  spiralClone: '侧翼分身出现 → 本体投球 → 分身协同补投',
  spiralConvergence: '本体托举 → 随移动推进 → 终结爆发',
  petalSweep: '投出真实花刃 → 穿敌后落地布刃',
  petalPierce: '走位改变归路 → 地面花刃沿路径召回',
  petalBloom: '本体腾空 → 播出真实花刃 → 落地继续布刃',
  grappleHook: '实体魔手伸出 → 擒住轻敌 / 对重敌拉近自己',
  grappleSlam: '持敌向下摔击 → 落地冲击；高阶先横扫再砸地',
  grappleClash: '投出真实持敌 → 撞穿沿路敌群 → 落地震击',
  riftGate: '入口随身 → 放置远门 → 普攻从门后飞出',
  riftStep: '先放远门 → 穿门交换位置 → 门后攻击',
  riftBarrage: '先布远门 → 门后蓄能 → 实体光炮扫射',
  magnetField: '展开护板 → 捕获真实普通敌弹 → 装入弹仓',
  magnetLance: '捕弹入仓 → 发射榴弹或轨炮 → 碰撞爆破',
  magnetCrush: '武装展开 → 本体移动开火 → 肩炮与热量主炮',
  blinkStrike: '切入留下返程影 → 主动退回 → 高阶留诱饵',
  blinkStorm: '敌人附上死印 → 记录攻击 → 延迟结算',
  recallSummons: '灵骸已形成 → 爆破或化作追敌灵火',
});

const ADVANCED_FIGHTER_SKILLS = new Set(['swordField', 'bladeWave', 'whirlwind', 'quickCut']);

function heroForSkill(skillId) {
  const owner = HEROES.find(hero => hero.skills.some(skill => skill.id === skillId));
  if (owner) return owner;
  if (ADVANCED_FIGHTER_SKILLS.has(skillId)) return HEROES.find(hero => hero.id === 'commander');
  return HEROES[0];
}

function previewLoadout(skillId) {
  const owner = heroForSkill(skillId);
  return getActiveSkillLoadout(owner.id,[skillId]);
}

function makeTarget(game, index, total) {
  const angle = (index - (total - 1) / 2) * 0.28;
  const distance = 145 + (index % 2) * 46;
  const kind = index % 4 === 3 ? 'brute' : index % 3 === 2 ? 'guard_basic' : index % 2 ? 'runner' : 'grunt';
  const stats = kind === 'brute' ? [29, 520] : kind === 'guard_basic' ? [24, 360] : kind === 'runner' ? [17, 240] : [20, 280];
  return {
    id: game._nextId++, kind,
    x: game.player.x + Math.cos(angle) * distance,
    y: game.player.y + Math.sin(angle) * distance,
    radius: stats[0], hp: stats[1], maxHp: stats[1], speed: 0, damage: 0, xp: 0,
    elite: false, hitFlash: 0, spawnDelay: 0, anim: 'idle', animTime: index * .17,
    animDuration: 0, facing: -1, aiClock: 999, attackWarning: null, contactClock: 999,
  };
}

function stageTargets(game, skillId) {
  const radial = new Set(['whirlwind', 'guard', 'summonGuard', 'summonElite', 'recallSummons']);
  const count = radial.has(skillId) ? 7 : 6;
  game.enemies = Array.from({ length: count }, (_, index) => makeTarget(game, index, count));

  if (radial.has(skillId)) {
    game.enemies.forEach((enemy, index) => {
      const angle = index / count * Math.PI * 2;
      enemy.x = game.player.x + Math.cos(angle) * (105 + index % 2 * 28);
      enemy.y = game.player.y + Math.sin(angle) * (105 + index % 2 * 28);
    });
  }
}

function primePrerequisite(game, skillId) {
  // Prerequisites use the same casts and simulation steps as a real battle.
  const tick=(seconds,input={x:0,y:0})=>{for(let i=0;i<seconds*60;i++)updateGame(game,1/60,input);};
  if(skillId.startsWith('sword')){tick(.8);return;}
  if(skillId.startsWith('spiral')){
    tick(.05);
    if(skillId==='spiralConvergence'&&game.player.job==='spiral_sage'){castSkill(game,'spiralClone',{x:1,y:0});tick(.2);}
    return;
  }
  if(skillId.startsWith('petal')){tick(2.5);return;}
  if(['grappleSlam','grappleClash'].includes(skillId)){castSkill(game,'grappleHook',AIM);tick(.5);return;}
  if(['riftStep','riftBarrage'].includes(skillId)){castSkill(game,'riftGate',AIM);tick(.3);return;}
  if(['magnetLance','magnetCrush'].includes(skillId)){
    castSkill(game,'magnetField',AIM);
    // Ordinary zero-damage hostile projectiles demonstrate real capture, never grant fake ammo.
    for(let i=0;i<3;i++)game.enemyProjectiles.push({id:game._nextId++,kind:'enemyOrb',x:game.player.x+170+i*15,y:game.player.y+(i-1)*12,vx:-180,vy:0,life:3,radius:9,damage:0});
    // Let the capture field end naturally so E/R shows its own silhouette, with real stored ammo.
    tick(4.4);return;
  }
  if(['summonGuard','recallSummons','summonElite'].includes(skillId)){tick(3);return;}
  if(skillId==='blinkStrike'){castSkill(game,'markBlade',AIM);tick(.4);return;}
  return;
}

function makePreviewGame(skillId, preferredJob, attackHero, attackProgress, attackScenario) {
  const hero = HEROES.find(item=>item.id===attackHero) || heroForSkill(skillId);
  const jobs=getHeroJobs(hero.id), job=jobs.some(item=>item.id===preferredJob)&&(attackHero||SKILL_DEFINITIONS[skillId].jobs.includes(preferredJob))?preferredJob:jobs.find(item=>SKILL_DEFINITIONS[skillId].jobs.includes(item.id))?.id||hero.job;
  const game = createGame({ seed: 0x51a7c0de, duration: attackHero&&attackScenario.startsWith('survival')?360:1000 });
  configureRun(game, {
    heroId: hero.id,
    heroKind: getHeroKind(hero.id,job),
    heroName: hero.name,
    heroJob: job,
    heroSkills: previewLoadout(skillId),
  });
  startGame(game);
  if(attackHero&&attackScenario.startsWith('survival')){
    // Disposable fixed-build trial: production spawns, movement and damage.
    // Only XP is suppressed to avoid protected upgrade screens changing the build.
    game.attackProgress={rank:attackProgress?.rank||1,branch:attackProgress?.branch||null};
    for(const [id,count]of Object.entries({damage:2,area:2,attackSpeed:2,vitality:2,speed:1}))for(let i=0;i<count;i++)applyGrowthUpgrade(game,`stat:${id}`);
    game.time=270;game._eliteWaves=3;game._nextSupplyAt=287;
    game.player.x=1400;game.player.y=900;game.viewport={width:VIRTUAL_WIDTH,height:VIRTUAL_HEIGHT};
    return game;
  }
  const width=VIRTUAL_WIDTH,height=VIRTUAL_HEIGHT;
  game.viewport = { width, height };
  // A stable virtual stage keeps every large area effect in frame even when the
  // visible card is a very short phone-landscape canvas.
  game.world = { width, height };
  game.previewMode = true;
  game.mapObjects = [];
  game.announcement = { text: '', remaining: 0 };
  game.encounter = { name: '', hint: '', index: 0 };
  game._spawnClock = 999;
  game._attackClock = 999;
  game._nextSupplyAt = 999;
  game._eliteWaves = 3;
  game.player.x = attackHero?160:230;
  game.player.y = attackHero?200:216;
  stageTargets(game, skillId);
  if(attackHero){
    game.attackProgress={rank:attackProgress?.rank||1,branch:attackProgress?.branch||null};
    game.companions=[];
    // One shared formation exposes range, fan coverage, piercing and return paths.
    // No active spells, ground anchors or companions are primed for signature weapons.
    // Both sides need a nearby target to expose the grappler's actual dual-grab third hit.
    const formation=hero.id==='grappler'
      ? [[80,-30],[90,30],[110,0],[180,-45],[180,45],[255,0],[320,-45],[320,45]]
      : [[90,0],[180,0],[270,0],[360,0],[150,60],[240,90],[330,120],[150,-60],[240,-90],[330,-120],[-110,-140],[-110,140],[100,125],[100,-125],[430,0]];
    game.enemies=formation.map(([x,y],index)=>({...makeTarget(game,index,formation.length),hp:100000,maxHp:100000,x:game.player.x+x,y:game.player.y+y}));
    if(attackScenario==='pressure'){
      game.player.x=360;game.player.y=200;
      // Fixed finite encounter for comparing basics; no active casts, rewards or profile.
      game.enemies=Array.from({length:72},(_,i)=>{
        const ring=Math.floor(i/18),a=i%18*Math.PI*2/18+ring*.17,r=78+ring*40;
        return {...makeTarget(game,i,72),x:360+Math.cos(a)*r*1.35,y:200+Math.sin(a)*r*.82,hp:180,maxHp:180,speed:28,damage:0,xp:0};
      });
    }
  }else{
    if(hero.id) {
      game.enemies.forEach((enemy,index)=>{
        enemy.hp=enemy.maxHp=6000;
        if(hero.id==='grappler'){enemy.x=game.player.x+85+Math.floor(index/2)*55;enemy.y=game.player.y+(index%2?-20:20);}
        if(hero.id==='rift'){const gateLength=getSkillGeometry(game,'riftGate').length;enemy.x=Math.min(width-30,game.player.x+gateLength+55+(index%3)*28);enemy.y=game.player.y+(index<3?-20:20);}
      });
    }
    if(hero.id==='commander'&&job!==hero.job)game.enemies.forEach((enemy,index)=>{enemy.x=game.player.x+70+index%3*20;enemy.y=game.player.y-30+Math.floor(index/3)*55;enemy.hp=enemy.maxHp=4000;});
    // Active demonstrations keep unrelated automatic attacks quiet.
    if(['grappler','magnet','rift'].includes(hero.id))ensureSpecialHero(game).clock=999;
    if(['blink','mage'].includes(hero.id))ensureOriginal(game).clock=999;
    primePrerequisite(game, skillId);
    if(game.specialHero && skillId!=='riftGate')game.specialHero.clock=999;
    if(game.mythicHero&&skillId!=='spiralClone')game.mythicHero.clock=999;
    // Show a naturally charged job loop, not an empty-resource cast of an advanced skill.
    if(job==='blade_master'||job==='swift_blade')for(let i=0;i<150;i++)updateGame(game,1/60,{x:0,y:0});
    if(hero.id==='commander')ensureOriginal(game).clock=999;
  }
  return game;
}

/**
 * Creates a disposable, profile-free combat preview using the production simulation and renderer.
 * `images` accepts the same image bundle as createRenderer; `vfxImages` may contain either
 * `dash` or `vfx_dash` style keys. Locked campaign skills remain intentionally previewable.
 */
export function createSkillPreview({
  canvas,
  images = {},
  unitAssets = defaultUnitAssets,
  vfxAssets = defaultVfxAssets,
  vfxImages = {},
  terrain,
  skillId = 'dash',
  heroJob,
  attackHero,
  attackProgress,
  attackScenario = 'formation',
  reducedMotion,
  playbackRate = 1,
  onState,
} = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('createSkillPreview requires a canvas element.');

  const normalizedVfx = Object.fromEntries(Object.entries(vfxImages).map(([key, image]) => [key.startsWith('vfx_') ? key : `vfx_${key}`, image]));
  const renderImages = { ...images, ...normalizedVfx, ...(terrain ? { terrain } : {}) };
  const renderCanvas = document.createElement('canvas');
  const renderer = createRenderer(renderCanvas, unitAssets, renderImages, vfxAssets);
  const targetContext = canvas.getContext('2d');
  if (!targetContext) throw new Error('Skill preview canvas does not provide a 2D context.');
  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let selected = ALL_SKILLS.includes(skillId) ? skillId : HERO_ACTIVE_SKILLS[attackHero]?.[0] || 'dash';
  let game = null;
  let frameId = 0;
  let disposed = false;
  let running = false;
  let paused = false;
  let elapsed = 0;
  let lastTime = 0;
  let castAttempted = false;
  let castDone = false;
  let observer = null;
  let demoShot = false;
  let lastChoreography = null;
  let lastPressureReport = -1;
  let completed=false;
  let firstDamage=null;

  const isReduced = () => reducedMotion === undefined ? !!motionQuery?.matches : !!reducedMotion;
  const survivalTrial=!!attackHero&&attackScenario.startsWith('survival');
  const previewSeconds=survivalTrial?24:attackHero&&attackScenario==='pressure'?12:PREVIEW_SECONDS;
  const dimensions = () => ({
    width: Math.max(1, canvas.clientWidth || canvas.width || 480),
    height: Math.max(1, canvas.clientHeight || canvas.height || 270),
    dpr: Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1)),
  });
  const captionFor = phase => phase === 'ready'
    ? '点击重播查看当前阶段效果'
    : phase === 'complete'
      ? '演示结束 · 可重播'
      : attackHero ? '专属武器演示 · 无主动技能' : selected === 'spiralConvergence' && game?.mythicHero?.convergence
        ? ({held:'托举巨丸 · 随本体转向推进',roll:'脱手滚压 · 本体自由走位',burst:'终结震爆'}[game.mythicHero.convergence.phase] || PLAYING_CAPTIONS[selected])
        : getJobSkillDescription(game?.player?.job,selected,PLAYING_CAPTIONS[selected]||'施放中');
  const report = (phase, extra = {}) => onState?.({
    phase,
    status: phase,
    skillId: selected,
    caption: captionFor(phase),
    elapsed,
    ...(attackHero&&attackScenario==='pressure'?{kills:game?.kills||0,totalEnemies:72}:{}),
    ...(survivalTrial?{trial:true,hp:Math.ceil(game?.player.hp||0),maxHp:game?.player.maxHp,kills:game?.kills||0,damageTaken:Math.round(game?.stats.damageTaken||0),firstDamage,dead:game?.phase==='defeat'}:{}),
    ...extra,
  });

  function draw() {
    if (disposed || !game) return;
    const size = dimensions();
    const width=VIRTUAL_WIDTH,height=VIRTUAL_HEIGHT;
    renderer.render(game, { width, height, dpr: size.dpr, reducedMotion: isReduced() });
    const pixelWidth = Math.round(size.width * size.dpr), pixelHeight = Math.round(size.height * size.dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    targetContext.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    targetContext.imageSmoothingEnabled = false;
    targetContext.fillStyle = '#091816';
    targetContext.fillRect(0, 0, size.width, size.height);
    const scale = Math.min(size.width / width, size.height / height);
    const drawWidth = width * scale, drawHeight = height * scale;
    targetContext.drawImage(renderCanvas, 0, 0, renderCanvas.width, renderCanvas.height,
      (size.width - drawWidth) / 2, (size.height - drawHeight) / 2, drawWidth, drawHeight);
  }

  function reset() {
    game = makePreviewGame(selected,heroJob,attackHero,attackProgress,attackScenario);
    elapsed = 0;
    castAttempted = false;
    castDone = false;
    demoShot = false;
    lastChoreography = null;
    lastPressureReport = -1;
    completed=false;firstDamage=null;
    draw();
  }

  function stop(phase = 'complete') {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    running = false;
    completed=phase==='complete';
    draw();
    report(phase, { cast: castDone });
  }

  function frame(now) {
    if (disposed || !running) return;
    const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000)) * Math.min(1, Math.max(.1, playbackRate));
    lastTime = now;
    elapsed += dt;

    if (!attackHero && !castAttempted && elapsed >= .55) {
      castAttempted = true;
      game.skills[selected].remaining = 0;
      castDone = castSkill(game, selected, selected === 'rockWall'
        ? { x: 1, y: 0, targetX: game.player.x + 165, targetY: game.player.y }
        : AIM);
      report('playing', { event: 'cast', cast: castDone });
      if(castDone&&selected==='riftGate')game.specialHero.clock=0;
      if(castDone&&selected==='blinkStorm')game.originalHero.clock=0;
      if (!castDone) {
        stop('complete');
        return;
      }
    }


    // Demonstrate position-dependent techniques with actual movement input.
    let move={x:0,y:0};
    if(survivalTrial&&attackScenario==='survival-orbit'){
      const a=elapsed*game.player.speed/200;move={x:1200+Math.cos(a)*200-game.player.x,y:900+Math.sin(a)*200-game.player.y};
    }
    if(!attackHero&&castDone&&['spiralConvergence','whirlwind','guard','magnetCrush','petalBloom'].includes(selected)){
      move=elapsed<1.25?{x:.45,y:0}:elapsed<2?{x:.25,y:-.25}:elapsed<3?{x:-.3,y:.2}:{x:0,y:0};
    }
    if(selected==='petalPierce'&&!attackHero&&elapsed<.55)move={x:0,y:.7};
    updateGame(game, dt, move);
    if(survivalTrial){for(const e of game.enemies)e.xp=0;if(firstDamage===null&&game.stats.damageTaken>0)firstDamage=Math.round(elapsed*10)/10;}
    if(attackHero&&(survivalTrial||attackScenario==='pressure')&&Math.floor(elapsed*4)!==lastPressureReport){lastPressureReport=Math.floor(elapsed*4);report('playing');}
    if(selected==='markBlade'&&castDone&&!demoShot&&elapsed>=2){demoShot=true;castSkill(game,'markBlade',AIM);}
    if (selected === 'spiralConvergence' && game.mythicHero?.convergence?.phase !== lastChoreography) {
      lastChoreography = game.mythicHero?.convergence?.phase;
      report('playing');
    }
    // A zero-damage ordinary orb fixture shows the production capture path.
    if(selected==='magnetField'&&castDone&&!demoShot&&elapsed>=.8){
      demoShot=true;
      game.enemyProjectiles.push({id:game._nextId++,kind:'enemyOrb',x:game.player.x+210,y:game.player.y,vx:-130,vy:0,life:4,radius:9,damage:0});
    }
    draw();
    if (elapsed >= previewSeconds || game.phase==='defeat') stop();
    else frameId = requestAnimationFrame(frame);
  }

  function replay() {
    if (disposed) return false;
    if (frameId) cancelAnimationFrame(frameId);
    reset();
    running = true;
    paused = false;
    lastTime = performance.now();
    report('playing');
    frameId = requestAnimationFrame(frame);
    return true;
  }

  // The local VFX workbench can freeze real combat frames without modifying simulation state.
  function pause() {
    if (disposed || !running) return false;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    running = false;
    paused = true;
    report('paused');
    return true;
  }

  function resume() {
    if (disposed || !paused) return false;
    paused = false;
    running = true;
    lastTime = performance.now();
    frameId = requestAnimationFrame(frame);
    report('playing');
    return true;
  }

  function select(nextSkillId) {
    if (!ALL_SKILLS.includes(nextSkillId) || disposed) return false;
    selected = nextSkillId;
    replay();
    return true;
  }

  function resize() {
    if (disposed) return;
    draw();
  }

  function handleMotionChange() {
    if (disposed || reducedMotion !== undefined) return;
    // Reduce decorative motion while keeping live mechanic positions and cues.
    draw();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    running = false;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    observer?.disconnect();
    motionQuery?.removeEventListener?.('change', handleMotionChange);
    renderer.destroy();
    targetContext.setTransform(1, 0, 0, 1, 0, 0);
    targetContext.clearRect(0, 0, canvas.width, canvas.height);
    game = null;
  }

  reset();
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
  }
  motionQuery?.addEventListener?.('change', handleMotionChange);

  if (isReduced()) report('ready', { reducedMotion: true });
  else replay();

  return {
    select,
    replay,
    pause,
    resume,
    resize,
    dispose,
    getState: () => ({ phase: disposed ? 'disposed' : running ? 'playing' : paused ? 'paused' : completed ? 'complete' : 'ready', skillId: selected, elapsed, game }),
  };
}

export const SKILL_PREVIEW_IDS = Object.freeze([...ALL_SKILLS]);
