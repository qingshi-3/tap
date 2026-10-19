// Open-field battle engine. Numbers tagged in OF_ADAPTATIONS are local adaptations;
// this module does not claim an exact Kingdom Rush encounter reproduction.

export const OF_MAP = Object.freeze({
  id: 'forest-heart', name: '林心守望', width: 1024, height: 576,
  core: Object.freeze({ x: 740, y: 310, radius: 42 }),
  entrances: Object.freeze([
    Object.freeze({ id: 'west', name: '西林口', x: 45, y: 290 }),
    Object.freeze({ id: 'north', name: '北岭口', x: 500, y: 50 }),
    Object.freeze({ id: 'south', name: '南溪口', x: 500, y: 535 }),
  ]),
  obstacles: Object.freeze([
    { id: 'tree-a', x: 300, y: 205, radius: 56, kind: 'tree' },
    { id: 'tree-b', x: 300, y: 382, radius: 58, kind: 'tree' },
    { id: 'rock-a', x: 465, y: 292, radius: 50, kind: 'rock' },
    { id: 'tree-c', x: 610, y: 174, radius: 52, kind: 'tree' },
    { id: 'rock-b', x: 610, y: 420, radius: 54, kind: 'rock' },
    { id: 'tree-d', x: 865, y: 205, radius: 48, kind: 'tree' },
    { id: 'rock-c', x: 875, y: 405, radius: 46, kind: 'rock' },
  ].map(Object.freeze)),
});

const OF_LEVELS = Object.freeze({
  arrowTower: { costs:[70,110,160], hp:[160,220,300], range:[140,160,180], interval:[.8,.6,.5], damage:[[4,6],[7,11],[10,16]] },
  mageTower: { costs:[100,160,240], hp:[150,210,280], range:[140,160,180], interval:[1.5,1.5,1.5], damage:[[9,17],[23,43],[40,74]] },
  cannonTower: { costs:[125,220,320], hp:[180,250,340], range:[160,160,179.2], interval:[3,3,3], damage:[[8,15],[20,40],[30,60]], splash:[62.4,62.4,67.2] },
  barracks: { costs:[70,110,160], hp:[180,240,320], range:[145,145,145], interval:[1,1.37,1.37], damage:[[1,3],[3,4],[6,10]], soldierHp:[50,100,150], armor:[0,.15,.3] },
});

const OF_TYPE_LIST = [
  {id:'guard',name:'盾卫',category:'unit',group:'front',sprite:'guard',role:'正面迎敌',description:'举盾拦住驻地附近的敌人。',cost:70,hp:150,range:24,interval:1,damage:[3,9],armor:0,speed:75,leash:145,respawn:10},
  {id:'sentinel',name:'哨卫',category:'unit',group:'front',sprite:'sentinel',role:'铁誓坚守',description:'用护甲和生命守住关键缺口。',cost:180,hp:300,range:24,interval:1.37,damage:[9,12],armor:.15,speed:75,leash:145,respawn:10},
  {id:'berserker',name:'狂战士',category:'unit',group:'front',sprite:'berserker',role:'狂怒重击',description:'以高生命和重击压住强敌。',cost:340,hp:450,range:24,interval:1.37,damage:[18,30],armor:.3,speed:75,leash:145,respawn:10},
  {id:'archer',name:'弓手',category:'unit',group:'ranged',sprite:'archer',role:'一级箭手',description:'便宜可靠的单体远射。',cost:70,hp:50,range:140,interval:.8,damage:[4,6],damageType:'physical',speed:75,leash:145,respawn:10},
  {id:'ranger',name:'游侠',category:'unit',group:'ranged',sprite:'ranger',role:'二级箭手',description:'更远、更快的持续物理射击。',cost:180,hp:50,range:160,interval:.6,damage:[7,11],damageType:'physical',speed:75,leash:145,respawn:10},
  {id:'sniper',name:'神射手',category:'unit',group:'ranged',sprite:'sniper',role:'三级箭手',description:'最远射程与最高射速的箭手。',cost:340,hp:50,range:180,interval:.5,damage:[10,16],damageType:'physical',speed:75,leash:145,respawn:10},
  {id:'mage',name:'法师',category:'unit',group:'ranged',sprite:'mage',role:'一级法师',description:'用魔法绕过敌人的物理护甲。',cost:100,hp:50,range:140,interval:1.5,damage:[9,17],damageType:'magic',speed:75,leash:145,respawn:10},
  {id:'flame',name:'烈焰术士',category:'unit',group:'ranged',sprite:'flame',role:'二级法师',description:'以强力火焰击穿单个敌人的护甲。',cost:260,hp:50,range:160,interval:1.5,damage:[23,43],damageType:'magic',speed:75,leash:145,respawn:10},
  {id:'frost',name:'寒霜术士',category:'unit',group:'ranged',sprite:'frost',role:'冰霜射手',description:'冰箭让单个敌人减速，专门拖住冲锋者。',cost:500,hp:50,range:180,interval:1.8,damage:[15,41],damageType:'magic',slow:.5,slowTime:2,speed:75,leash:145,respawn:10},
  {id:'storm',name:'风暴术士',category:'unit',group:'ranged',sprite:'storm',role:'连锁雷击',description:'闪电在邻近的三个敌人之间跳跃。',cost:665,hp:50,range:180,interval:2.2,damage:[26,39],damageType:'explosive',chain:3,chainRange:95,speed:75,leash:145,respawn:10},
  {id:'healer',name:'林地医师',category:'unit',group:'support',sprite:'healer',role:'范围治疗',description:'定期治疗附近受伤的士兵，维持前排防线。',cost:100,hp:100,range:100,interval:8,damage:[0,0],heal:50,speed:75,leash:145,respawn:10},
  {id:'summoner',name:'唤灵师',category:'unit',group:'support',sprite:'summoner',role:'援军召唤',description:'自动唤出短暂驻留的援军，在附近迎敌。',cost:70,hp:50,range:120,interval:10,damage:[0,0],summonCount:2,summonCap:4,summonLife:20,speed:75,leash:145,respawn:10},
  {id:'arrowTower',name:'箭塔',category:'tower',group:'tower',sprite:'archer',role:'物理速射',description:'固定速射，覆盖通道与前排交战处。',cost:70,hp:160,range:140,interval:.8,damage:[4,6],damageType:'physical'},
  {id:'mageTower',name:'法师塔',category:'tower',group:'tower',sprite:'mage',role:'魔法穿甲',description:'单体魔法攻击，专门对付重甲敌人。',cost:100,hp:150,range:140,interval:1.5,damage:[9,17],damageType:'magic'},
  {id:'cannonTower',name:'火炮塔',category:'tower',group:'tower',sprite:'catapult',role:'范围轰击',description:'范围轰击，对付聚集在前排的敌群。',cost:125,hp:180,range:160,interval:3,damage:[8,15],damageType:'explosive',splash:62.4},
  {id:'barracks',name:'兵营',category:'tower',group:'tower',sprite:'guardian',role:'三人守线',description:'生成三名可受伤、死亡并重生的民兵。',cost:70,hp:180,range:145,interval:1,damage:[1,3]},
];
export const OF_TYPES = Object.freeze(Object.fromEntries(OF_TYPE_LIST.map(ofType => [ofType.id, Object.freeze(ofType)])));

export const OF_ADAPTATIONS = Object.freeze({
  sourceBaseline: 'KR1 mobile/Steam Campaign Normal community reference; tower grades and common enemy stats reuse the recorded baseline.',
  troopProfiles: 'Frontline bodies aggregate the three soldiers at barracks grades 1/2/3: cost 70/180/340, HP 3×50/100/150, damage 3×(1–3)/(3–4)/(6–10), interval 1/1.37/1.37 and armor 0/.15/.3. Ranged grades reuse tower cumulative costs and exact recorded damage, interval and range; their 50 HP, 75 movement and 10 s respawn reuse grade-one militia presentation values.',
  barracksAggregate: 'Barracks building durability is local presentation data; its three militia reuse recorded soldier HP, damage, armor and 10 s replacement by grade.',
  supportGap: 'Healer reuses Shaman HP 100 and heal 50 every 8 s; its cost derives from the 100-gold mage baseline. Summoner reuses Reinforcements count 2, HP 30, damage 1–2, duration 20 s and cooldown 10 s; cost derives from 70-gold militia barracks.',
  specialists: 'Frost reuses Elora level-one Frost Bolt damage 15–41, 1.8 s interval and 50% slow for 2 s; 180 range and 500 cost derive from mage grade three. Storm reuses Tesla x104 damage 26–39, 2.2 s interval, three targets and 95 jump distance; its 665 cost derives from cumulative artillery grade three.',
  encounterTiming: 'Spawn gaps, multi-entrance ordering, open-field coordinates and wave compositions are authored local timings using the recorded Goblin/Orc/Wulf/Shaman/Ogre-style progression.',
  damageResolution: 'Attacks use deterministic midpoint damage and immediate hit resolution with a visual projectile. These are local adaptations, not original random rolls or projectile timing.',
});

const OF_ENEMIES = Object.freeze({
  grunt:{name:'哥布林',sprite:'raider',hp:20,armor:0,resist:0,speed:46.1,gold:3,lives:1,damage:[2,4],interval:1},
  armored:{name:'兽人',sprite:'brute',hp:80,armor:.3,resist:0,speed:30.7,gold:9,lives:1,damage:[5,9],interval:1.2},
  runner:{name:'座狼',sprite:'hound',hp:35,armor:0,resist:0,speed:96,gold:5,lives:1,damage:[3,6],interval:.8},
  shaman:{name:'萨满',sprite:'shaman',hp:100,armor:0,resist:.85,speed:38.4,gold:10,lives:1,damage:[3,5],interval:1.3,heal:50,healInterval:8},
  ogre:{name:'食人魔',sprite:'juggernaut',hp:800,armor:0,resist:0,speed:26.9,gold:50,lives:3,damage:[40,60],interval:1.8},
  boss:{name:'古树巨兽',sprite:'boss',hp:800,armor:0,resist:0,speed:26.9,gold:50,lives:3,damage:[40,60],interval:1.8,boss:true},
});
const OF_WAVES = Object.freeze([
  [['west','grunt',4]],
  [['north','grunt',4],['west','grunt',3]],
  [['south','runner',4],['west','armored',2]],
  [['north','grunt',6],['south','armored',2]],
  [['west','runner',5],['north','shaman',1],['north','grunt',4]],
  [['south','ogre',1],['west','armored',2],['north','runner',3]],
  [['west','grunt',6],['north','armored',3],['south','shaman',1]],
  [['south','runner',4],['west','armored',3]],
  [['west','boss',1],['south','shaman',1],['south','armored',4]],
]);

let OF_NEXT_ID = 1;
const ofId = ofPrefix => `${ofPrefix}-${OF_NEXT_ID++}`;
const ofDist = (ofA,ofB) => Math.hypot(ofA.x-ofB.x,ofA.y-ofB.y);
const ofClamp = (ofV,ofA,ofB) => Math.max(ofA,Math.min(ofB,ofV));
const ofRoll = ofPair => (ofPair[0]+ofPair[1])*.5;
const ofIsBuildPhase = ofG => ofG.phase==='deploy'||ofG.phase==='intermission';
const ofRadius = ofU => ofU.type.category==='tower'?28:18;

export function ofCreateGame(){
  const ofG={phase:'deploy',paused:false,speed:1,gold:300,lives:20,wave:0,maxWaves:OF_WAVES.length,units:[],enemies:[],projectiles:[],effects:[],audioEvents:[],elapsed:0,spellCooldown:0,stats:{kills:0,breaches:0,spawned:0,damageDealt:0},navRevision:0,routeCache:new Map(),spawnQueue:[],spawnLeft:0,routePreview:[]};
  ofG.routePreview=ofRoutePreview(ofG);return ofG;
}

const ofBlocked = (ofG,ofX,ofY,ofExtra=0,ofSkip=null) => {
  if(ofX<160+ofExtra||ofX>900-ofExtra||ofY<130+ofExtra||ofY>480-ofExtra)return true;
  if(Math.hypot(ofX-OF_MAP.core.x,ofY-OF_MAP.core.y)<OF_MAP.core.radius+34+ofExtra)return true;
  if(OF_MAP.obstacles.some(ofO=>Math.hypot(ofX-ofO.x,ofY-ofO.y)<ofO.radius+22+ofExtra))return true;
  return ofG.units.some(ofU=>ofU!==ofSkip&&!ofU.temporary&&Math.hypot(ofX-ofU.homeX,ofY-ofU.homeY)<ofRadius(ofU)+24+ofExtra);
};

const ofCell = (ofX,ofY) => ({c:Math.floor(ofX/32),r:Math.floor(ofY/32)});
const ofKey = (ofC,ofR) => `${ofC},${ofR}`;
const ofCellBlocked = (ofG,ofC,ofR,ofIgnore=null) => {
  const ofX=ofC*32+16,ofY=ofR*32+16;
  if(ofX<16||ofX>OF_MAP.width-16||ofY<16||ofY>OF_MAP.height-16)return true;
  if(OF_MAP.obstacles.some(ofO=>Math.hypot(ofX-ofO.x,ofY-ofO.y)<ofO.radius+15))return true;
  return ofG.units.some(ofU=>ofU!==ofIgnore&&ofU.type.category==='tower'&&!ofU.temporary&&Math.hypot(ofX-ofU.x,ofY-ofU.y)<41);
};
const ofFindPath = (ofG,ofStart,ofDestination,ofIgnore=null) => {
  const ofS=ofCell(ofStart.x,ofStart.y),ofGoal=ofCell(ofDestination.x,ofDestination.y),ofOpen=[{...ofS,g:0,f:0}],ofSeen=new Map([[ofKey(ofS.c,ofS.r),0]]),ofFrom=new Map();
  while(ofOpen.length){
    ofOpen.sort((ofA,ofB)=>ofA.f-ofB.f); const ofN=ofOpen.shift();
    if(ofN.c===ofGoal.c&&ofN.r===ofGoal.r){const ofPath=[];let ofK=ofKey(ofN.c,ofN.r);while(ofFrom.has(ofK)){const [ofC,ofR]=ofK.split(',').map(Number);ofPath.push({x:ofC*32+16,y:ofR*32+16});ofK=ofFrom.get(ofK);}ofPath.reverse();ofPath.push({x:ofDestination.x,y:ofDestination.y});return ofPath;}
    for(const [ofDc,ofDr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const ofC=ofN.c+ofDc,ofR=ofN.r+ofDr;if(ofCellBlocked(ofG,ofC,ofR,ofIgnore))continue;
      if(ofDc&&ofDr&&(ofCellBlocked(ofG,ofN.c+ofDc,ofN.r,ofIgnore)||ofCellBlocked(ofG,ofN.c,ofN.r+ofDr,ofIgnore)))continue;
      const ofNg=ofN.g+(ofDc&&ofDr?1.414:1),ofNk=ofKey(ofC,ofR);if(ofNg>=(ofSeen.get(ofNk)??Infinity))continue;
      ofSeen.set(ofNk,ofNg);ofFrom.set(ofNk,ofKey(ofN.c,ofN.r));ofOpen.push({c:ofC,r:ofR,g:ofNg,f:ofNg+Math.hypot(ofC-ofGoal.c,ofR-ofGoal.r)});
    }
  } return null;
};
const ofFindRoute = (ofG,ofStart,ofIgnore=null) => ofFindPath(ofG,ofStart,OF_MAP.core,ofIgnore);
const ofRoutesValid = (ofG,ofIgnore=null) => OF_MAP.entrances.every(ofE=>ofFindRoute(ofG,ofE,ofIgnore));
const ofRouteFor = (ofG,ofEntrance) => {const ofK=`${ofEntrance}:${ofG.navRevision}`;if(!ofG.routeCache.has(ofK))ofG.routeCache.set(ofK,ofFindRoute(ofG,OF_MAP.entrances.find(ofE=>ofE.id===ofEntrance)));return ofG.routeCache.get(ofK);};
export function ofRoutePreview(ofG){return OF_MAP.entrances.map(ofE=>({entrance:ofE.id,points:ofFindRoute(ofG,ofE)||[]}));}

export function ofCanPlace(ofG,ofTypeId,ofX,ofY){
  const ofType=OF_TYPES[ofTypeId];if(!Number.isFinite(ofX)||!Number.isFinite(ofY))return {ok:false,x:0,y:0,message:'部署位置无效'};ofX=ofClamp(ofX,0,OF_MAP.width);ofY=ofClamp(ofY,0,OF_MAP.height);
  if(!ofIsBuildPhase(ofG))return {ok:false,x:ofX,y:ofY,message:'战斗中自动交战，波次间才能部署'};
  if(!ofType)return {ok:false,x:ofX,y:ofY,message:'未知单位'};
  if(ofG.gold<ofType.cost)return {ok:false,x:ofX,y:ofY,message:'金币不足'};
  if(ofBlocked(ofG,ofX,ofY,ofType.category==='tower'?8:0))return {ok:false,x:ofX,y:ofY,message:'这里无法部署'};
  if(ofType.category==='tower'){
    const ofGhost={type:ofType,x:ofX,y:ofY,homeX:ofX,homeY:ofY};ofG.units.push(ofGhost);const ofOk=ofRoutesValid(ofG);ofG.units.pop();
    if(!ofOk)return {ok:false,x:ofX,y:ofY,message:'会封死敌军通往王心的道路'};
  } return {ok:true,x:ofX,y:ofY};
}
const ofMakeUnit = (ofType,ofX,ofY,ofExtra={}) => ({id:ofId('ofu'),type:ofType,x:ofX,y:ofY,homeX:ofX,homeY:ofY,hp:ofType.hp,maxHp:ofType.hp,level:1,deadLeft:0,facing:1,moving:false,attackLeft:0,attackAge:0,...ofExtra});
const ofSpawnMilitia = (ofG,ofOwner) => {const ofStats=OF_LEVELS.barracks,ofI=ofOwner.level-1,ofSpots=[];for(let ofTry=0;ofTry<24&&ofSpots.length<3;ofTry++){const ofA=ofTry*Math.PI/12,ofCandidate={x:ofOwner.x+Math.cos(ofA)*48,y:ofOwner.y+Math.sin(ofA)*48};const ofSafe=ofCandidate.x>=160&&ofCandidate.x<=900&&ofCandidate.y>=130&&ofCandidate.y<=480&&Math.hypot(ofCandidate.x-OF_MAP.core.x,ofCandidate.y-OF_MAP.core.y)>=OF_MAP.core.radius+16&&!OF_MAP.obstacles.some(ofO=>Math.hypot(ofCandidate.x-ofO.x,ofCandidate.y-ofO.y)<ofO.radius+16)&&ofSpots.every(ofS=>ofDist(ofS,ofCandidate)>=28);if(ofSafe)ofSpots.push(ofCandidate);}for(const ofSpot of ofSpots){ofG.units.push(ofMakeUnit({id:'militia',name:'民兵',category:'unit',group:'front',sprite:'militia',role:'拦截',description:'',cost:0,hp:ofStats.soldierHp[ofI],range:23,interval:ofStats.interval[ofI],damage:ofStats.damage[ofI],armor:ofStats.armor[ofI],speed:72,leash:ofStats.range[ofI],respawn:10},ofSpot.x,ofSpot.y,{ownerId:ofOwner.id}));}};
export function ofPlace(ofG,ofTypeId,ofX,ofY){const ofCheck=ofCanPlace(ofG,ofTypeId,ofX,ofY);if(!ofCheck.ok)return ofCheck;const ofType=OF_TYPES[ofTypeId],ofU=ofMakeUnit(ofType,ofCheck.x,ofCheck.y);ofG.gold-=ofType.cost;ofG.units.push(ofU);if(ofType.category==='tower'){ofG.navRevision++;ofG.routeCache.clear();ofG.routePreview=ofRoutePreview(ofG);}if(ofType.id==='barracks')ofSpawnMilitia(ofG,ofU);return {ok:true,unit:ofU};}
export function ofUpgradeCost(ofU){if(!ofU||ofU.type.category!=='tower'||ofU.level>=3)return 0;return OF_LEVELS[ofU.type.id].costs[ofU.level];}
export function ofUpgrade(ofG,ofIdValue){if(!ofIsBuildPhase(ofG))return {ok:false,message:'战斗中不能升级'};const ofU=ofG.units.find(ofV=>ofV.id===ofIdValue&&!ofV.ownerId);if(!ofU)return {ok:false,message:'单位不存在'};const ofCost=ofUpgradeCost(ofU);if(!ofCost)return {ok:false,message:'已达最高等级'};if(ofG.gold<ofCost)return {ok:false,message:'金币不足'};const ofData=OF_LEVELS[ofU.type.id],ofI=ofU.level;ofG.gold-=ofCost;ofU.level++;ofU.maxHp=ofData.hp[ofI];ofU.hp=ofU.maxHp;ofU.range=ofData.range[ofI];ofU.interval=ofData.interval[ofI];ofU.damage=ofData.damage[ofI];if(ofData.splash)ofU.splash=ofData.splash[ofI];if(ofU.type.id==='barracks'){for(const ofM of ofG.units.filter(ofV=>ofV.ownerId===ofU.id)){const ofRatio=ofM.hp/ofM.maxHp;ofM.maxHp=ofData.soldierHp[ofI];if(ofM.hp>0)ofM.hp=Math.max(1,ofM.maxHp*ofRatio);ofM.level=ofU.level;ofM.type={...ofM.type,hp:ofM.maxHp,damage:ofData.damage[ofI],armor:ofData.armor[ofI],interval:ofData.interval[ofI]};}}return {ok:true,unit:ofU};}
export function ofRefund(ofG,ofU){if(!ofU)return 0;const ofData=OF_LEVELS[ofU.type.id];let ofSpent=ofU.type.cost;if(ofData)for(let ofI=1;ofI<ofU.level;ofI++)ofSpent+=ofData.costs[ofI];return Math.floor(ofSpent*(ofG.wave===0?1:.6));}
export function ofSell(ofG,ofIdValue){if(!ofIsBuildPhase(ofG))return {ok:false,message:'战斗中不能出售'};const ofI=ofG.units.findIndex(ofU=>ofU.id===ofIdValue&&!ofU.ownerId&&!ofU.temporary);if(ofI<0)return {ok:false,message:'单位不存在'};const ofU=ofG.units[ofI],ofRefundValue=ofRefund(ofG,ofU);ofG.units=ofG.units.filter(ofV=>ofV!==ofU&&ofV.ownerId!==ofU.id);ofG.gold+=ofRefundValue;if(ofU.type.category==='tower'){ofG.navRevision++;ofG.routeCache.clear();ofG.routePreview=ofRoutePreview(ofG);}return {ok:true,refund:ofRefundValue};}
export function ofMove(ofG,ofIdValue,ofX,ofY){if(!ofIsBuildPhase(ofG))return {ok:false,message:'战斗中不能移动'};if(!Number.isFinite(ofX)||!Number.isFinite(ofY))return {ok:false,message:'驻扎位置无效'};const ofU=ofG.units.find(ofV=>ofV.id===ofIdValue&&!ofV.ownerId&&!ofV.temporary);if(!ofU||ofU.type.category!=='unit')return {ok:false,message:'只有部署部队可移动'};if(ofBlocked(ofG,ofX,ofY,0,ofU))return {ok:false,message:'这里无法驻扎'};ofU.homeX=ofU.x=ofX;ofU.homeY=ofU.y=ofY;ofU.movePath=null;ofU.movePlanKey='';ofU.attackLeft=0;ofU.attackAge=0;ofU.facing=1;ofU.moving=false;return {ok:true,unit:ofU};}

export function ofWaveInfo(ofG){const ofPlan=OF_WAVES[Math.min(ofG.wave,OF_WAVES.length-1)]||[];const ofGroups=ofPlan.map(([ofEntrance,ofType,ofCount])=>{const ofE=OF_MAP.entrances.find(ofV=>ofV.id===ofEntrance);return {entrance:ofEntrance,name:ofE.name,count:ofCount,type:ofType,enemy:OF_ENEMIES[ofType].name};});return {number:Math.min(ofG.wave+1,OF_WAVES.length),groups:ofGroups,text:ofGroups.map(ofV=>`${ofV.name} ${ofV.enemy}×${ofV.count}`).join(' · ')};}
export function ofBeginWave(ofG){if(!ofIsBuildPhase(ofG)||ofG.wave>=OF_WAVES.length)return {ok:false,message:'无法开始波次'};ofG.phase='combat';ofG.audioEvents.push({key:'wave'});ofG.spawnQueue=[];for(const [ofEntrance,ofType,ofCount] of OF_WAVES[ofG.wave])for(let ofI=0;ofI<ofCount;ofI++)ofG.spawnQueue.push({entrance:ofEntrance,type:ofType,delay:ofG.spawnQueue.length*.58});ofG.spawnLeft=0;return {ok:true};}
const ofSpawnEnemy = (ofG,ofSpawn) => {const ofT=OF_ENEMIES[ofSpawn.type],ofE=OF_MAP.entrances.find(ofV=>ofV.id===ofSpawn.entrance),ofRoute=ofRouteFor(ofG,ofSpawn.entrance);if(!ofRoute)throw new Error(`No route for entrance ${ofSpawn.entrance}`);ofG.enemies.push({id:ofId('ofe'),type:ofSpawn.type,sprite:ofT.sprite,x:ofE.x,y:ofE.y,hp:ofT.hp,maxHp:ofT.hp,armor:ofT.armor,resist:ofT.resist,speed:ofT.speed,gold:ofT.gold,lives:ofT.lives,damage:ofT.damage,interval:ofT.interval,facing:1,moving:true,attackLeft:0,attackAge:0,path:ofRoute,pathIndex:0,slow:0,slowLeft:0,healLeft:ofT.healInterval||0,boss:!!ofT.boss});ofG.stats.spawned++;};
const ofDamage = (ofG,ofE,ofRaw,ofKind) => {const ofReduction=ofKind==='true'?0:ofKind==='magic'?ofE.resist:ofKind==='explosive'?ofE.armor*.5:ofE.armor;const ofDone=Math.max(1,ofRaw*(1-ofReduction));ofE.hp-=ofDone;ofG.stats.damageDealt+=ofDone;return ofDone;};
const ofEffect = (ofG,ofKind,ofX,ofY,ofExtra={}) => ofG.effects.push({kind:ofKind,x:ofX,y:ofY,age:0,duration:.45,...ofExtra});
const ofKillEnemy = (ofG,ofE) => {if(ofE.dead)return;ofE.dead=true;ofG.gold+=ofE.gold;ofG.stats.kills++;};
const ofAttackEnemy = (ofG,ofU,ofE) => {ofU.outOfCombat=0;const ofT=ofU.type,ofBounds=ofU.damage||ofT.damage,ofDamageValue=(ofU.splash??ofT.splash)?ofBounds[1]:ofRoll(ofBounds),ofKind=ofU.damageType||ofT.damageType||'physical';ofDamage(ofG,ofE,ofDamageValue,ofKind);ofU.attackLeft=ofU.interval||ofT.interval;ofU.attackAge=0;const ofRanged=(ofU.range||ofT.range)>40;if(ofRanged){const ofVisual=ofT.id.includes('mage')||['mage','flame','frost','storm'].includes(ofT.id)?'magic':'arrow';ofG.projectiles.push({x:ofU.x,y:ofU.y,targetId:ofE.id,kind:ofVisual,color:ofT.id==='frost'?'#9de7ff':ofT.id==='flame'?'#ff7a45':undefined,age:0,duration:.22});ofG.audioEvents.push({key:ofT.id==='flame'?'fire':ofT.id==='frost'?'ice':ofVisual});}else ofG.audioEvents.push({key:'melee'});
  const ofSplash=ofU.splash??ofT.splash;if(ofSplash)for(const ofOther of ofG.enemies)if(ofOther!==ofE&&!ofOther.dead&&ofDist(ofOther,ofE)<=ofSplash){ofDamage(ofG,ofOther,Math.max(ofBounds[0],Math.floor(ofBounds[1]-(ofBounds[1]-ofBounds[0])*Math.min(1,ofDist(ofOther,ofE)/ofSplash))),ofKind);if(ofOther.hp<=0)ofKillEnemy(ofG,ofOther);}
  if(ofT.chain){let ofLast=ofE;const ofHit=new Set([ofE.id]);for(let ofI=1;ofI<ofT.chain;ofI++){const ofNext=ofG.enemies.filter(ofOther=>!ofOther.dead&&!ofHit.has(ofOther.id)&&ofDist(ofOther,ofLast)<=ofT.chainRange).sort((ofA,ofB)=>ofDist(ofA,ofLast)-ofDist(ofB,ofLast))[0];if(!ofNext)break;ofDamage(ofG,ofNext,ofDamageValue,ofKind);ofEffect(ofG,'lightning',ofNext.x,ofNext.y,{fromX:ofLast.x,fromY:ofLast.y});ofHit.add(ofNext.id);ofLast=ofNext;if(ofNext.hp<=0)ofKillEnemy(ofG,ofNext);}}
  if(ofT.burn){ofE.burn=ofT.burn;ofE.burnLeft=3;}if(ofT.slow){ofE.slow=Math.max(ofE.slow,ofT.slow);ofE.slowLeft=Math.max(ofE.slowLeft,ofT.slowTime);}ofEffect(ofG,ofT.id==='flame'?'fire':ofT.id==='frost'?'ice':ofT.id==='storm'?'lightning':'hit',ofE.x,ofE.y,{fromX:ofU.x,fromY:ofU.y});if(ofE.hp<=0)ofKillEnemy(ofG,ofE);
};
const ofTickSupport = (ofG,ofU) => {const ofT=ofU.type;if(ofT.id==='healer'&&ofU.attackLeft<=0){const ofCandidates=ofG.units.filter(ofA=>ofA!==ofU&&ofA.hp>0&&ofA.hp<ofA.maxHp&&ofDist(ofA,ofU)<=ofT.range).sort((ofA,ofB)=>ofA.hp/ofA.maxHp-ofB.hp/ofB.maxHp);if(ofCandidates[0]){ofCandidates[0].hp=Math.min(ofCandidates[0].maxHp,ofCandidates[0].hp+ofT.heal);ofU.attackLeft=ofT.interval;ofU.attackAge=0;ofEffect(ofG,'heal',ofCandidates[0].x,ofCandidates[0].y);}}
  if(ofT.id==='summoner'&&ofU.attackLeft<=0){const ofAlive=ofG.units.filter(ofA=>ofA.ownerId===ofU.id&&ofA.temporary&&ofA.hp>0);const ofCount=Math.min(ofT.summonCount,ofT.summonCap-ofAlive.length);for(let ofI=0;ofI<ofCount;ofI++){const ofA=ofI*Math.PI;const ofSwarm={id:'swarm',name:'灵群',category:'unit',group:'front',sprite:'swarm',role:'召唤',description:'',cost:0,hp:30,range:21,interval:1,damage:[1,2],speed:75,leash:145,respawn:0};ofG.units.push(ofMakeUnit(ofSwarm,ofU.x+Math.cos(ofA)*22,ofU.y+Math.sin(ofA)*22,{homeX:ofU.x,homeY:ofU.y,ownerId:ofU.id,temporary:true,lifeLeft:ofT.summonLife}));ofEffect(ofG,'summon',ofU.x,ofU.y);}if(ofCount){ofU.attackLeft=ofT.interval;ofU.attackAge=0;}}}
const ofMoveUnitToward = (ofG,ofU,ofDestination,ofDt) => {const ofTargetCell=ofCell(ofDestination.x,ofDestination.y),ofPlanKey=`${ofTargetCell.c},${ofTargetCell.r}:${ofG.navRevision}`;if(ofU.movePlanKey!==ofPlanKey||!ofU.movePath?.length){ofU.movePath=ofFindPath(ofG,ofU,ofDestination,ofU)||[{x:ofU.x,y:ofU.y}];ofU.movePathIndex=0;ofU.movePlanKey=ofPlanKey;}let ofP=ofU.movePath[ofU.movePathIndex]||ofU,ofD=ofDist(ofU,ofP);if(ofD<4&&ofU.movePathIndex<ofU.movePath.length-1){ofU.movePathIndex++;ofP=ofU.movePath[ofU.movePathIndex];ofD=ofDist(ofU,ofP);}if(ofD>0){const ofStep=Math.min(ofD,(ofU.type.speed||75)*ofDt);ofU.x+=(ofP.x-ofU.x)/ofD*ofStep;ofU.y+=(ofP.y-ofU.y)/ofD*ofStep;ofU.facing=ofP.x>=ofU.x?1:-1;ofU.moving=true;}else ofU.moving=false;};
const ofTickUnit = (ofG,ofU,ofDt) => {ofU.attackLeft=Math.max(0,ofU.attackLeft-ofDt);ofU.attackAge+=ofDt;if(ofU.temporary){ofU.lifeLeft-=ofDt;if(ofU.lifeLeft<=0){ofU.expired=true;return;}}if(ofU.hp<=0){if(ofU.temporary){ofU.expired=true;return;}ofU.deadLeft-=ofDt;if(ofU.deadLeft<=0){ofU.hp=ofU.maxHp;ofU.x=ofU.homeX;ofU.y=ofU.homeY;ofU.movePath=null;}return;}ofTickSupport(ofG,ofU);const ofT=ofU.type;if(ofT.category==='tower'&&ofT.id==='barracks')return;const ofRange=ofU.range||ofT.range,ofLeash=ofT.leash||145;const ofEnemy=ofG.enemies.filter(ofE=>!ofE.dead&&(ofT.group!=='front'||Math.hypot(ofE.x-ofU.homeX,ofE.y-ofU.homeY)<=ofLeash)).sort((ofA,ofB)=>ofDist(ofA,ofU)-ofDist(ofB,ofU)).find(ofE=>ofDist(ofE,ofU)<=ofRange+(ofT.group==='front'?ofLeash:0));if(ofEnemy){const ofD=ofDist(ofU,ofEnemy);if(ofD<=ofRange){ofU.moving=false;ofU.movePath=null;if(ofU.attackLeft<=0&&ofT.id!=='healer'&&ofT.id!=='summoner')ofAttackEnemy(ofG,ofU,ofEnemy);}else if(ofT.category==='unit')ofMoveUnitToward(ofG,ofU,ofEnemy,ofDt);}else if(ofT.category==='unit'){const ofD=Math.hypot(ofU.homeX-ofU.x,ofU.homeY-ofU.y);if(ofD>3)ofMoveUnitToward(ofG,ofU,{x:ofU.homeX,y:ofU.homeY},ofDt);else{ofU.moving=false;ofU.movePath=null;}}};
const ofTickPlanningUnit = (ofG,ofU,ofDt) => {ofU.attackLeft=Math.max(0,ofU.attackLeft-ofDt);if(ofU.temporary){ofU.lifeLeft-=ofDt;if(ofU.lifeLeft<=0)ofU.expired=true;return;}if(ofU.hp<=0){ofU.deadLeft-=ofDt;if(ofU.deadLeft<=0){ofU.hp=ofU.maxHp;ofU.x=ofU.homeX;ofU.y=ofU.homeY;ofU.movePath=null;}return;}if(ofU.type.id==='healer'&&ofU.attackLeft<=0){const ofPatient=ofG.units.filter(ofA=>ofA!==ofU&&ofA.hp>0&&ofA.hp<ofA.maxHp&&ofDist(ofA,ofU)<=ofU.type.range).sort((ofA,ofB)=>ofA.hp/ofA.maxHp-ofB.hp/ofB.maxHp)[0];if(ofPatient){ofPatient.hp=Math.min(ofPatient.maxHp,ofPatient.hp+ofU.type.heal);ofU.attackLeft=ofU.type.interval;ofU.attackAge=0;ofEffect(ofG,'heal',ofPatient.x,ofPatient.y);}}if(ofU.type.category==='unit'){const ofD=Math.hypot(ofU.homeX-ofU.x,ofU.homeY-ofU.y);if(ofD>3)ofMoveUnitToward(ofG,ofU,{x:ofU.homeX,y:ofU.homeY},ofDt);else{ofU.moving=false;ofU.movePath=null;}}};
const ofTickEnemy = (ofG,ofE,ofDt) => {if(ofE.dead)return;ofE.attackLeft=Math.max(0,ofE.attackLeft-ofDt);ofE.attackAge+=ofDt;if(ofE.slowLeft>0)ofE.slowLeft-=ofDt;else ofE.slow=0;if(ofE.burnLeft>0){ofE.burnLeft-=ofDt;ofDamage(ofG,ofE,(ofE.burn||0)*ofDt,'magic');if(ofE.hp<=0){ofKillEnemy(ofG,ofE);return;}}
  const ofBlocker=ofG.units.filter(ofU=>ofU.hp>0&&ofU.type.category==='unit'&&ofDist(ofU,ofE)<30).sort((ofA,ofB)=>ofDist(ofA,ofE)-ofDist(ofB,ofE))[0];if(ofBlocker&&ofDist(ofBlocker,ofE)<30){ofE.moving=false;if(ofE.attackLeft<=0){ofBlocker.outOfCombat=0;ofBlocker.hp-=Math.max(1,ofRoll(ofE.damage)*(1-(ofBlocker.type.armor||0)));ofE.attackLeft=ofE.interval;ofE.attackAge=0;ofG.audioEvents.push({key:'impact'});if(ofBlocker.hp<=0)ofBlocker.deadLeft=ofBlocker.type.respawn||10;}return;}
  const ofT=OF_ENEMIES[ofE.type];if(ofT.heal&&ofE.healLeft!==undefined){ofE.healLeft-=ofDt;if(ofE.healLeft<=0){for(const ofA of ofG.enemies.filter(ofV=>!ofV.dead&&ofV!==ofE&&ofDist(ofV,ofE)<100).sort((ofA,ofB)=>ofA.hp/ofA.maxHp-ofB.hp/ofB.maxHp).slice(0,3)){ofA.hp=Math.min(ofA.maxHp,ofA.hp+ofT.heal);ofEffect(ofG,'heal',ofA.x,ofA.y);}ofE.healLeft=ofT.healInterval;}}
  const ofP=ofE.path[ofE.pathIndex];if(!ofP){ofE.dead=true;ofE.breached=true;ofG.stats.breaches++;ofG.lives=Math.max(0,ofG.lives-ofE.lives);return;}const ofD=ofDist(ofE,ofP);if(ofD<5){ofE.pathIndex++;return;}const ofSpeed=ofE.speed*(1-ofE.slow),ofStep=Math.min(ofD,ofSpeed*ofDt);ofE.x+=(ofP.x-ofE.x)/ofD*ofStep;ofE.y+=(ofP.y-ofE.y)/ofD*ofStep;ofE.facing=ofP.x>=ofE.x?1:-1;ofE.moving=true;};

export function ofCastSpell(ofG,ofX,ofY){if(ofG.paused)return {ok:false,message:'暂停中不能施放'};if(ofG.phase!=='combat')return {ok:false,message:'战斗中才能施放'};if(!Number.isFinite(ofX)||!Number.isFinite(ofY)||ofX<0||ofX>OF_MAP.width||ofY<0||ofY>OF_MAP.height)return {ok:false,message:'施法位置无效'};if(ofG.spellCooldown>0)return {ok:false,message:'火雨尚未冷却'};for(let ofI=0;ofI<3;ofI++){const ofA=ofI*Math.PI*2/3,ofP={x:ofX+Math.cos(ofA)*30,y:ofY+Math.sin(ofA)*30};for(const ofE of ofG.enemies)if(!ofE.dead&&ofDist(ofE,ofP)<68){ofDamage(ofG,ofE,45,'true');if(ofE.hp<=0)ofKillEnemy(ofG,ofE);}ofEffect(ofG,'fire',ofP.x,ofP.y,{duration:.8});}ofG.spellCooldown=80;ofG.audioEvents.push({key:'fire'});return {ok:true};}
// Recovery follows the recorded militia values; a single frontline body represents three soldiers.
const ofRecoverUnit = (ofU,ofDt) => {
  if(ofU.type.category!=='unit'||ofU.hp<=0)return;
  ofU.outOfCombat=(ofU.outOfCombat||0)+ofDt;
  if(ofU.outOfCombat<2)return;
  const ofGrade={guard:0,sentinel:1,berserker:2}[ofU.type.id];
  const ofRegen=ofU.temporary?3:ofGrade!==undefined?[5,7,10][ofGrade]*3:ofU.ownerId?[5,7,10][ofU.level-1]:5;
  ofU.hp=Math.min(ofU.maxHp,ofU.hp+ofRegen*ofDt);
};
export function ofTick(ofG,ofDt){if(ofG.paused||ofDt<=0||ofG.phase==='victory'||ofG.phase==='defeat')return ofG;ofDt=Math.min(.1,ofDt)*ofG.speed;ofG.elapsed+=ofDt;ofG.spellCooldown=Math.max(0,ofG.spellCooldown-ofDt);for(const ofFx of ofG.effects)ofFx.age+=ofDt;ofG.effects=ofG.effects.filter(ofFx=>ofFx.age<ofFx.duration);for(const ofP of ofG.projectiles)ofP.age+=ofDt;ofG.projectiles=ofG.projectiles.filter(ofP=>ofP.age<ofP.duration);
  for(const ofU of ofG.units)ofRecoverUnit(ofU,ofDt);
  if(ofG.phase!=='combat'){for(const ofU of [...ofG.units])ofTickPlanningUnit(ofG,ofU,ofDt);ofG.units=ofG.units.filter(ofU=>!ofU.expired);return ofG;}ofG.spawnLeft-=ofDt;while(ofG.spawnQueue.length&&ofG.spawnLeft<=0){ofSpawnEnemy(ofG,ofG.spawnQueue.shift());ofG.spawnLeft+=.58;}for(const ofU of [...ofG.units])ofTickUnit(ofG,ofU,ofDt);ofG.units=ofG.units.filter(ofU=>!ofU.expired);for(const ofE of ofG.enemies)ofTickEnemy(ofG,ofE,ofDt);ofG.enemies=ofG.enemies.filter(ofE=>!ofE.dead);
  if(ofG.lives<=0){ofG.phase='defeat';return ofG;}if(!ofG.spawnQueue.length&&!ofG.enemies.length){ofG.wave++;ofG.phase=ofG.wave>=OF_WAVES.length?'victory':'intermission';}return ofG;}

