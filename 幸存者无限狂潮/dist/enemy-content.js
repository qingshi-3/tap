// This project's first tuning pass, mapped to verified Duelyst sprite identities.
// These values describe our encounters, not the original game's card rules.
export const ENEMY_ABILITIES = Object.freeze({
  faultwarden: Object.freeze({ kind: 'boss_kron', name: '裂垒执锤者', role: 'boss', baseKind: 'brute', color: '#ffb76b' }),
  cinderweaver: Object.freeze({ kind: 'boss_cindera', name: '烬环织焰者', role: 'boss', baseKind: 'brute', color: '#ff8666' }),
  trialBulwark: Object.freeze({ kind: 'trial_commander', name: '铁誓盾卫', role: 'boss', baseKind: 'brute', color: '#8eeaff' }),
  trialPursuer: Object.freeze({ kind: 'trial_swift', name: '逐风猎刃', role: 'boss', baseKind: 'brute', color: '#d2ed86' }),
  trialBinder: Object.freeze({ kind: 'trial_summoner', name: '缚魂司祭', role: 'boss', baseKind: 'brute', color: '#d4a4ff' }),
  trialRift: Object.freeze({ kind: 'trial_blink', name: '镜隙行者', role: 'boss', baseKind: 'brute', color: '#a1f3ea' }),
  trialPrism: Object.freeze({ kind: 'trial_mage', name: '三相观测者', role: 'boss', baseKind: 'brute', color: '#94d8ff' }),
  kilnGuard: Object.freeze({ kind: 'neutral_golemstone', name: '护炉卫', role: 'elite', baseKind: 'guard_basic', color: '#ffc477' }),
  laneGunner: Object.freeze({ kind: 'f2_flareslinger', name: '封路炮手', role: 'elite', baseKind: 'archer_elite', color: '#ffba83' }),
  blastBeetle: Object.freeze({ kind: 'neutral_monsterexplodingdemon', name: '蓄爆甲虫', role: 'elite', baseKind: 'runner', color: '#d4dc7c' }),
});
export const getEnemyContent = abilityId => ENEMY_ABILITIES[abilityId] || null;

// Ordinary composition only; simulation owns timing, density, elites and bosses.
const G='grunt', R='runner', S='scout_basic', H='guard_basic', B='brute', A='archer_elite';
const wave = (name, hint, table) => Object.freeze({ name, hint, table: Object.freeze(table.map(entry=>Object.freeze(entry))) });
const trial = (warmup, name, hint, odd, even) => [wave(`${name}热身`,'先熟悉近战敌群，留出走位空间',warmup), ...Array.from({length:6},(_,i)=>wave(`${name}·${i+1}`,hint,i%2?even:odd))];
export const ENCOUNTER_WAVES = Object.freeze(Object.fromEntries(Object.entries({
  'moss-gate': [
    wave('苔原初潮','稳住阵脚，收集最初的魂晶',[[G,10],[R,1]]),
    wave('斥候与游弓','留意斥候穿插，横移避开少量弓箭',[[G,5],[R,3],[S,3],[A,1]]),
    wave('铁甲掩弓','重甲压缩空间，弓手在后方瞄准',[[G,3],[R,2],[H,3],[B,2],[S,4],[A,2]]),
    wave('苔关箭阵','沿敌群空隙移动，避开弓手瞄准',[[G,3],[R,2],[H,3],[B,2],[S,3],[A,3]]),
    wave('关隘合围','近远混编来袭，主动寻找补给',[[G,3],[R,3],[H,3],[B,3],[S,4],[A,4]]),
    wave('裂垒决战','诱导落锤，留意后排弓手',[[R,3],[H,3],[B,3],[S,3],[A,3]]),
    wave('苔关肃清','消灭执锤者即可撤离',[[H,2],[B,2],[A,1]]),
  ],
  'ember-trail': [
    wave('赤岭奔袭','留意快兵，从火线空隙穿过',[[R,3],[B,1]]),
    wave('游弓入阵','快兵牵制时留意后排瞄准',[[R,4],[B,2],[H,1],[A,1]]),
    wave('重兵压火','绕开重兵，沿火线空隙移动',[[R,4],[B,5],[H,3],[A,3]]),
    wave('火线封锁','快兵推进与弓手交错，持续横移',[[R,5],[B,4],[H,3],[A,4]]),
    wave('赤岭强攻','穿过火线缺口，避免被重兵围住',[[R,5],[B,5],[H,2],[A,4]]),
    wave('织焰决战','把火种留在身后，寻找焰环缺口',[[R,4],[B,5],[H,3],[A,4]]),
    wave('余烬肃清','消灭织焰者即可撤离',[[R,3],[B,3],[H,3],[A,3]]),
  ],
  'blade-trial': trial([[H,4],[B,1]],'盾列夹弓','清理盾列，留意少量后排弓手',[[H,7],[B,2],[A,1]],[[H,6],[B,3],[A,1]]),
  'swift-trial': trial([[S,3],[R,1]],'斥候穿弓','观察斥候冲锋，横移穿过箭隙',[[S,5],[R,4],[A,3]],[[S,6],[R,3],[A,3]]),
  'summoner-trial': trial([[B,3],[H,2]],'契灵破围','集火重兵，带领契灵避开后排瞄准',[[B,6],[H,5],[A,2]],[[B,7],[H,4],[A,2]]),
  'blink-trial': trial([[R,3],[S,1]],'瞬印箭网','布好飞镖，穿过快兵与箭路后留意落点',[[R,5],[S,2],[A,3]],[[R,4],[S,3],[A,3]]),
  'mage-trial': trial([[R,2],[H,1]],'元素聚阵','打断甲虫蓄爆，规划法术区域间的路线',[[H,5],[R,2],[B,3]],[[H,4],[R,2],[B,4]]),
}).map(([id,waves])=>[id,Object.freeze(waves)])));
export const getEncounterWave = (dungeonId, stageIndex) => ENCOUNTER_WAVES[dungeonId]?.[stageIndex] || null;
