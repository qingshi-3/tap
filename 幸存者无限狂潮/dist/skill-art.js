import { SKILL_DEFINITIONS } from './heroes.js';
const ART = {
  swordFocus: Object.freeze({ src:'./assets/ui/skill-sword-focus.png', family:'sword', shape:'circle', label:'剑令集锋' }),
  swordRecall: Object.freeze({ src:'./assets/ui/skill-sword-recall.png', family:'sword', shape:'self', label:'回剑护身' }),
  swordUnion: Object.freeze({ src:'./assets/ui/skill-sword-union.png', family:'sword', shape:'circle', label:'万剑归一' }),
  spiralOrb: Object.freeze({ src:'./assets/ui/skill-spiral-orb.png', family:'spiral', shape:'line', label:'旋丸牵引' }),
  spiralClone: Object.freeze({ src:'./assets/ui/skill-spiral-clone.png', family:'spiral', shape:'self', label:'侧影分身' }),
  spiralConvergence: Object.freeze({ src:'./assets/ui/skill-spiral-convergence.png', family:'spiral', shape:'circle', label:'群影合丸' }),
  petalSweep: Object.freeze({ src:'./assets/ui/skill-petal-sweep.png', family:'petal', shape:'cone', label:'花刃横扫' }),
  petalPierce: Object.freeze({ src:'./assets/ui/skill-petal-pierce.png', family:'petal', shape:'line', label:'束刃穿心' }),
  petalBloom: Object.freeze({ src:'./assets/ui/skill-petal-bloom.png', family:'petal', shape:'circle', label:'千花收网' }),
  grappleHook: Object.freeze({ src:'./assets/ui/skill-grapple-hook.png', family:'grapple', shape:'line', label:'魔手勾袭' }),
  grappleSlam: Object.freeze({ src:'./assets/ui/skill-grapple-slam.png', family:'grapple', shape:'circle', label:'震地摔击' }),
  grappleClash: Object.freeze({ src:'./assets/ui/skill-grapple-clash.png', family:'grapple', shape:'cone', label:'巨掌合击' }),
  riftGate: Object.freeze({ src:'./assets/ui/skill-rift-gate.png', family:'rift', shape:'line', label:'远门置换' }),
  riftStep: Object.freeze({ src:'./assets/ui/skill-rift-step.png', family:'rift', shape:'dash', label:'穿门步' }),
  riftBarrage: Object.freeze({ src:'./assets/ui/skill-rift-barrage.png', family:'rift', shape:'cone', label:'门阵齐击' }),
  magnetField: Object.freeze({ src:'./assets/ui/skill-magnet-field.png', family:'magnet', shape:'circle', label:'磁场捕获' }),
  magnetLance: Object.freeze({ src:'./assets/ui/skill-magnet-lance.png', family:'magnet', shape:'line', label:'聚铁长矛' }),
  magnetCrush: Object.freeze({ src:'./assets/ui/skill-magnet-crush.png', family:'magnet', shape:'circle', label:'聚铁砸击' }),
  dash: Object.freeze({ src:'./assets/ui/skill-dash.png', family:'blade', shape:'dash', label:'风行突进' }),
  cleave: Object.freeze({ src:'./assets/ui/skill-cleave.png', family:'blade', shape:'cone', label:'裂空斩' }),
  guard: Object.freeze({ src:'./assets/ui/skill-guard.png', family:'ward', shape:'self', label:'风息守势' }),
  swordField: Object.freeze({ src:'./assets/ui/skill-sword-field.png', family:'blade', shape:'circle', label:'剑阵' }),
  bladeWave: Object.freeze({ src:'./assets/ui/skill-blade-wave.png', family:'blade', shape:'line', label:'破空剑潮' }),
  whirlwind: Object.freeze({ src:'./assets/ui/skill-whirlwind.png', family:'blade', shape:'circle', label:'回风乱舞' }),
  quickCut: Object.freeze({ src:'./assets/ui/skill-quick-cut.png', family:'blade', shape:'dash', label:'瞬身斩' }),
  summonGuard: Object.freeze({ src:'./assets/ui/skill-summon-guard.png', family:'spirit', shape:'self', label:'契灵卫' }),
  recallSummons: Object.freeze({ src:'./assets/ui/skill-recall-summons.png', family:'spirit', shape:'self', label:'归契' }),
  summonElite: Object.freeze({ src:'./assets/ui/skill-summon-elite.png', family:'spirit', shape:'self', label:'强契降临' }),
  markBlade: Object.freeze({ src:'./assets/ui/skill-mark-blade.png', family:'mark', shape:'line', label:'地面飞镖' }),
  blinkStrike: Object.freeze({ src:'./assets/ui/skill-blink-strike.png', family:'mark', shape:'dash', label:'瞬印袭' }),
  blinkStorm: Object.freeze({ src:'./assets/ui/skill-blink-storm.png', family:'mark', shape:'circle', label:'瞬印连袭' }),
  flameBreath: Object.freeze({ src:'./assets/ui/skill-flame-breath.png', family:'fire', shape:'cone', label:'焰息' }),
  rockWall: Object.freeze({ src:'./assets/ui/skill-rock-wall.png', family:'stone', shape:'line', label:'岩障' }),
  frostAura: Object.freeze({ src:'./assets/ui/skill-frost-aura.png', family:'ice', shape:'circle', label:'冰柱雨' }),
};
export const SKILL_ART=Object.freeze(Object.fromEntries(Object.entries(ART).map(([id,art])=>[id,Object.freeze({...art,label:SKILL_DEFINITIONS[id]?.name||art.label,shape:SKILL_DEFINITIONS[id]?.aimType||art.shape})])));

export const skillArtFor = skillId => SKILL_ART[skillId] || null;


