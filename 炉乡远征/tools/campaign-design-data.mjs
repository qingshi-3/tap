// Proposed content design only. Never imported by dist or used to mutate saves.
import assert from 'node:assert/strict';
import {CARDS} from '../dist/js/cards.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {FACTIONS} from '../dist/js/factions.js';

export const PROPOSED_NEUTRAL_REWARDS = {1:19037,2:10013,4:10982,5:10017,6:10978,7:19050,8:10020,9:10012,10:19033,11:19034,12:19049,13:10207,14:10307,16:19042,17:10959};
export const PROPOSED_FACTION_UNITS = {1:16,2:111,3:209,4:309,5:413,6:513};
// Attack/health are authored enemy values, before visible battle buffs. They do
// not read player growth, ownership, inventory, rank or deck composition.
const profiles = [
  {14:[1,4],9:[2,3],10021:[1,2],10019:[2,1],19027:[2,6]},
  {14:[2,5],9:[3,4],11:[2,6],15:[3,3],16:[3,7],17:[3,8],10021:[2,3],10981:[2,4],19027:[3,7]},
  {14:[2,6],9:[3,5],11:[2,7],15:[3,4],16:[3,8],17:[3,10],10021:[2,4],10981:[2,5],10019:[3,2],19037:[3,4],10012:[3,3]},
  {214:[0,7],215:[0,8],213:[3,4],211:[2,4],209:[4,7],10021:[2,4],10981:[2,5],19027:[3,8],19037:[3,5]},
  {110:[3,4],109:[3,4],111:[3,6],115:[2,4],108:[1,2],10019:[3,2],10012:[4,3],317:[3,4],308:[3,3],311:[2,5],316:[1,6],19050:[2,5],309:[4,6]},
  {505:[3,6],503:[4,4],511:[2,6],513:[4,5],506:[2,3],19027:[3,9],412:[3,5],413:[5,6],402:[4,6],406:[6,2],410:[3,4],19050:[2,6],10981:[3,5],10021:[3,4],10012:[4,3]},
];
// Ordered opening prefix, then an explicit authored count for every card. The
// generated full ordered deck cycles these rows until counts are exhausted.
const army = (hp,mana,opening,rows,behavior='assault',extra={}) => ({hp,mana,opening,rows,behavior,...extra});
const encounters = [
  ['前排与集火','先用基础随从建立战线；不考验养成。',[
    army(12,2,[14,9,14],[[14,5],[9,4],[10021,3]])]],
  ['侧翼远程','射手血薄但不可放任；空投或绕侧接近。',[
    army(16,2,[10021,14,9],[[14,4],[9,3],[10021,4],[10019,3]],'flank')]],
  ['守住前哨','坚守7轮，优先换位与保护主将，无需追杀。',[
    army(18,3,[14,10021,9],[[14,5],[9,4],[10021,4],[19027,3]],'assault',{overrides:{14:[1,5]}})]],
  ['护卫与射手','嘲讽挡路，保留侧翼手段，击破后排。',[
    army(20,3,[14,11,10021],[[11,4],[14,4],[10021,4],[20043,2],[9,4]],'defend')]],
  ['治疗支援','治疗与逐光者联动；先打支援而非轮流削血。',[
    army(22,3,[15,10981,11],[[15,3],[10981,4],[11,3],[14,3],[20043,3],[10021,2]],'support')]],
  ['重装关隘','厚前排掩护射手；基础远程与集火是候选解法，是否足够及起手容错待试玩。',[
    army(26,4,[14,11,10021,20066],[[11,4],[19027,3],[10021,4],[16,2],[20066,3],[20043,2],[14,3]],'defend',{overrides:{11:[2,7]}})]],
  ['两军交战','敌军互攻；避免过早同时进入两边火力。',[
    army(20,3,[14,11,15],[[11,4],[15,3],[10981,3],[14,5],[20043,3]],'defend'),
    army(16,3,[9,10021,10019],[[9,5],[10019,4],[10021,5],[20066,4]],'flank')]],
  ['争夺渡口','支援军与侧翼军分工；选择一侧突破。',[
    army(22,4,[11,10981,15],[[11,4],[15,3],[16,3],[10981,4],[20043,3],[14,3]],'support'),
    army(18,3,[10019,9,10021],[[10019,4],[9,4],[10021,5],[19037,3],[20066,4]],'flank')]],
  ['三旗坚守','坚守10轮；已有驱散可拆护卫，不要求清场。',[
    army(24,4,[11,15,10981,20043],[[11,4],[17,2],[16,3],[15,3],[10981,4],[20043,3],[14,3]],'defend'),
    army(20,4,[9,10019,10021],[[9,5],[10012,2],[10019,4],[10021,5],[20066,3],[19037,3]],'assault')]],
  ['沙魔供兵','清除方尖碑阻断增援；已获得突袭和驱散。',[
    army(26,4,[214,213,211,20095],[[214,4],[213,6],[211,4],[10021,4],[20095,3],[20151,3]],'defend')]],
  ['双塔协同','先拆强化塔；飞行单位绕过正面沙魔。',[
    army(28,4,[214,213,211,20095],[[215,2],[214,4],[213,6],[211,4],[10981,2],[20095,3],[20151,3]],'support')]],
  ['沙海军团','坚守10轮；炮击线和产兵点同场，留机动通道。',[
    army(30,5,[214,213,211,20095],[[215,2],[214,4],[213,7],[209,3],[211,3],[19027,2],[20151,3],[20095,3]],'defend',{overrides:{209:[5,8],215:[0,9]}})]],
  ['后排突袭','防背刺和直伤组合；护卫与站位仍有明确收益。',[
    army(28,5,[110,109,115,20086],[[110,5],[109,4],[111,2],[10019,4],[115,3],[20081,3],[20086,3]],'flank')]],
  ['腐化与亡愿','核心比杂兵更重要；已有抽牌与驱散可换入。',[
    army(30,5,[317,308,316,20072],[[317,5],[308,5],[311,3],[316,3],[19050,3],[20072,4],[20052,3]],'support')]],
  ['暗影会战','两套组合同时存在但互攻；利用刚获得的溅射。',[
    army(28,5,[110,109,115,20086],[[110,5],[111,3],[109,5],[115,3],[20081,4],[20086,4]],'flank'),
    army(26,4,[317,308,311,20072],[[317,5],[308,4],[311,4],[316,3],[19050,3],[20072,3],[20052,2]],'support')]],
  ['冰墙封路','控制和潜入组合；飞行、空投、驱散、溅射均能应对。',[
    army(32,5,[505,511,20149,503],[[505,6],[503,4],[511,4],[19027,3],[513,2],[20149,5],[20139,4]],'defend')]],
  ['重生攻坚','先清脆弱卵；不要在成长单位面前无限拖延。',[
    army(34,5,[412,402,410,20116],[[412,6],[413,4],[402,4],[19027,3],[410,3],[20116,4],[20117,4]],'assault')]],
  ['围城总考','坚守12轮；两军互攻，主考资源管理与换牌取舍。',[
    army(32,5,[505,503,511,20149,20139],[[505,6],[503,4],[511,5],[513,3],[19027,3],[20149,5],[20139,4]],'defend'),
    army(30,5,[412,402,410,20116],[[412,6],[413,4],[402,5],[410,4],[19050,3],[20116,4],[20117,4]],'assault')]],
];

function orderedDeck(rows, opening) {
  const counts=new Map(rows);assert.equal(counts.size,rows.length);
  const deck=[...opening];for(const id of opening){assert.ok(counts.get(id)>0);counts.set(id,counts.get(id)-1);}
  while([...counts.values()].some(n=>n>0))for(const [id,n] of counts)if(n>0){deck.push(id);counts.set(id,n-1);}
  return deck;
}

export function buildCampaignDesign(cards, spellAudit) {
  const stages=encounters.map(([theme,counterplay,armies],index)=>{
    const level=EXPEDITION_LEVELS[index],stage=index+1,chapter=Math.floor(index/3)+1;
    const configuredOwners=[...new Set(level.enemies.map(x=>x.owner))].sort();assert.equal(armies.length,configuredOwners.length);
    return {stage,levelId:level.id,title:level.title,chapter,theme,counterplay,
      objective:{...level.objective},turnLimit:level.turnLimit,map:{columns:level.columns,rows:level.rows,playerStart:level.playerStart},
      intendedRounds:stage<=3?[4,7]:stage<=6?[5,8]:stage<=12?[6,10]:[7,12],
      garrisonOmissions:stage===11?[{id:214,x:10,y:3}]:stage===14?[{id:311,x:10,y:2}]:[],
      playerReward:{accountFirstCoins:100+index*10,otherVictoryCoins:level.reward.repeat,
        factionChapterFirstCoins:stage%3===0?60:0,accountStageFirstOrbs:1+(stage%3===0?1:0),otherFactionStageFirstOrbs:stage%3===0?1:0,repeatOrbs:0,
        cards:cards.filter(c=>c.acquisition==='campaign'&&c.level===stage).map(c=>({id:c.id,name:c.name,scope:c.faction===0?'account_milestone_once':'matching_faction_once',faction:c.faction})),
        rankUnlock:stage===3?'单位2阶/法术1阶':stage===6?'法术2阶':stage===9?'单位3阶':stage===15?'单位4阶':null},
      armies:armies.map((a,ai)=>{
        const owner=configuredOwners[ai],profile={...profiles[chapter-1],...a.overrides};
        const omissions={11:[{id:214,x:10,y:3}],14:[{id:311,x:10,y:2}]};
        const garrison=level.enemies.filter(e=>e.owner===owner&&!((omissions[stage]??[]).some(o=>o.id===e.cardId&&o.x===e.x&&o.y===e.y)));
        const allIds=[...new Set([...a.rows.map(r=>r[0]),...garrison.map(e=>e.cardId)])];
        const unitStats=allIds.filter(id=>CARDS[id].type==='unit'&&!CARDS[id].token).map(id=>{
          assert.ok(profile[id],`${level.id} owner${owner} enemy stat ${id} needs an explicit design`);
          const [attack,health]=profile[id];return {id,name:CARDS[id].name,cost:CARDS[id].cost,attack,health,abilities:'existing_card_mechanics',source:'authored_enemy_proposal_not_original_balance'};
        });
        const deck=orderedDeck(a.rows,a.opening);assert.ok(deck.length>=a.opening.length);assert.ok(a.opening.some(id=>CARDS[id].cost<=a.mana&&CARDS[id].type==='unit'));
        const general=garrison.find(e=>CARDS[e.cardId].type==='general');
        const stats=new Map(unitStats.map(s=>[s.id,s]));
        return {owner,general:{id:general.cardId,name:CARDS[general.cardId].name,attack:stage===1?1:stage<=12?2:3,health:a.hp},
          rules:{mana:a.mana,maxMana:a.mana,manaGrowth:1,manaCap:9,openingHandSize:a.opening.length,drawPerTurn:1,handLimit:8,fatigueDamage:2,replacePerTurn:0,shuffleDeck:false,behavior:a.behavior,spellRank:0,spellMode:'base'},
          deck,deckSize:deck.length,openingHand:a.opening,deckComposition:a.rows.map(([id,count])=>({id,name:CARDS[id].name,count,cost:CARDS[id].cost})),
          unitStats,
          garrison:garrison.map(e=>({id:e.cardId,name:CARDS[e.cardId].name,x:e.x,y:e.y,attack:CARDS[e.cardId].type==='general'?(stage===1?1:stage<=12?2:3):stats.get(e.cardId)?.attack,health:CARDS[e.cardId].type==='general'?a.hp:stats.get(e.cardId)?.health,openingGambit:false})),
          tokenStats:[217,225,315,411,504,525].map(id=>({id,name:CARDS[id].name,attack:CARDS[id].attack,health:CARDS[id].health,policy:'explicit_fixed_token_base_no_army_bonus; visible auras still apply'})),
        };
      }),
    };
  });
  const curves=[
    [0,80,'2个单位1阶',80],
    [3,410,'2个单位2阶 + 2个法术1阶',340],
    [6,830,'4个单位2阶 + 2个法术2阶',760],
    [9,1340,'3个单位3阶 + 2个单位2阶 + 2个法术2阶',1200],
    [12,1940,'5个单位3阶 + 2个法术2阶',1420],
    [15,2630,'3个单位4阶 + 3个单位3阶 + 2个法术2阶',2120],
    [18,3410,'5个单位4阶 + 3个单位3阶 + 2个法术2阶',2880],
  ].map(([stage,budget,example,spent])=>({stage,budget:budget+60*Math.floor(stage/3),example,spent,factionEligibility:[1,2,3,4,5,6],availabilityNote:'Use only the two existing spells with defined numerical upgrades. No unimplemented new spell rank is included. Remaining funds may train newly selected cards; this is not the only purchase path.',remaining:budget+60*Math.floor(stage/3)-spent,meaning:'alternative affordable allocation at this milestone, not forced purchase order; costs for new cards counted at full price'}));
  return {status:'proposed_not_runtime_not_playtest_balanced',revision:'campaign-content-2026-10-13',
    scope:'six independent faction progress tracks sharing the same 18 encounter templates in the first release, not 108 independently authored maps',
    acquisition:{initialNeutralIds:[10021,10981,10019,19027,10001,10018,19026,10204],factionUnitAtStage:3,factionUnitIds:PROPOSED_FACTION_UNITS,factionSpellAtStages:[6,12],neutralRewards:PROPOSED_NEUTRAL_REWARDS,oldOwnedRetained:true,unlockGrantsDeckCopies:3},
    economy:{initialCoins:80,initialOrbs:0,currencies:['coins','spirit_orbs','card_specific_fragments'],initialUnitRankCap:1,unitRankGates:{2:3,3:9,4:15},spellRankGates:{1:3,2:6},
      trainingCosts:{unit:[40,70,110,160],spell:[60,100]},
      unitGrowth:{newVersion:'proposed-low-growth-v2',steps:[{attack:0,health:0},{attack:0,health:1},{attack:0,health:1},{attack:1,health:1},{attack:1,health:2}],specializationUnlockRanks:{new:[2,2],legacy:[2,4]},rank2Value:'both existing card specializations available at rank2; choose one, never stack; rank2 pays for branch selection rather than further stats',legacyVersion:'legacy-growth-v1',legacySteps:[{attack:0,health:0},{attack:0,health:1},{attack:1,health:2},{attack:1,health:3},{attack:2,health:4}],migration:'Already-trained card types retain historical growth curve and permissions; rank0 and newly acquired types use new curve. Persist growthVersion per card type; all same-type copies share it. No existing values are reduced, no old battle is rewritten.',implementationStatus:'planning_requires_growthVersion_persistence_not_runtime'},newUnitCatchup:'Card unlocking stays rank0; first unit rank purchase after obtaining it may buy up to the chosen unlocked rank in one transaction at the full summed price; no automatic stat compensation.',
      claimScopes:{coins:'account stage first clear gets first reward, all other victories get repeat reward; each faction chapter first completion additionally grants60 coins. Account-stage and faction-chapter claims commit in one idempotent transaction',neutral:'account stage milestone once',factionCard:'matching faction stage first clear once, even if another faction already claimed account coins',orbs:'accountStageFirstClaim grants1 orb plus1 at chapter end; another faction first completion of the same node grants only1 at chapter end; repeats/defeats/trials grant0. Alternating factions does not change totals'},
      gateScope:'Faction-card unlocks and faction training caps use current faction progress; shared neutral training cap uses account highest progress. A highly trained shared neutral is intentionally a benefit when switching faction, not dynamically nerfed.',
      legacyGrowth:'New gates only restrict new rank purchases; never reject, downgrade or disable historical unit/spell ranks, modes or specializations. Existing ownership remains usable. Old shared progress attribution is a separate migration decision; do not guess faction history or repeat old account payouts.',
      firstRouteCoins:3770,laterRouteCoins:1330,allSixFirstRoutesCoins:10420,firstRouteOrbs:24,laterRouteOrbs:6,allSixFirstRoutesOrbs:54,totalsExcludeCollectionCompensation:true,laterRouteIncome:[{stage:3,coins:150},{stage:6,coins:340},{stage:12,coins:805},{stage:18,coins:1330}],adRequired:false,energyRequired:false,dailyGate:false,curves},
    recruitment:{targets:[17,116,215,310,404,526],unlock:'account first stage3 completion',costOrbs:1,fragmentsPerDraw:2,recipeFragments:12,
      focus:'choose one unowned target; target weight5, each of the other five cards weight1 (50%/10% before redirects)',
      softGuarantee:'after three consecutive non-focus results, fourth result is focus; resets on receiving focus fragments; miss counters persist per chosen target across target switches',
      duplicatePolicy:'if a rolled card is already owned, redirect its two fragments to selected unowned focus; synthesis deducts12 once, and all remaining fragments for that now-owned card may transfer1:1 to a newly chosen target only with an explicit transfer action; never auto-delete old shards',
      allOwnedPolicy:'stop new draws, retain orbs and remaining fragments for future content; no endless forced duplicates',
      expectedDrawsForZeroProgressFocus:11.25,maxDrawsForZeroProgressFocus:24,guaranteeDerivation:'6 hits × max4 draws =24; p0.5 capped geometric has mean1.875 per hit, so11.25 before beneficial duplicate redirects',
      firstRouteGuarantee:'24 first-route orbs guarantee at least one chosen premium unit by stage18 if focus stays fixed; no premium is required for campaign clearance',
      finiteCollection:{totalRequiredFragments:72,drawsForCompleteCollection:36,condition:'Start with zero fragments; synthesize immediately once any unowned card reaches12 and explicitly transfer all leftover fragments after synthesis. Owned outcomes redirect to unowned focus; every draw preserves two useful fragments, so36 draws complete six cards. Not a guarantee if the player delays synthesis/transfer.',positioning:'finite optional collection, not infinite orb farming'},
      completionCompensation:{coinsPerFutureOrb:20,trigger:'all six recruitment targets owned at battle start',preview:'show the frozen reward type and amount in pre-battle preview',freeze:'Freeze reward configuration, relevant claim keys and owned-target state at battle start. Settlement and replay use the committed reward receipt; later synthesis/config edits cannot change amounts. Reject competing claim commits rather than paying twice.',legacy:'Do not automatically convert existing orb balances or historical pending/claimed receipts; conversion only applies to future newly frozen rewards'},
      requiresNewFeatures:['account-stage/faction-chapter scoped rewards and opening-frozen receipts','future all-owned orb-to-coin compensation','selected target and per-target miss counters','owned-result redirect and all-owned pool disable','explicit overflow-fragment transfer'],
      existingRuntimeSupport:'fixed pool weights, fixed shards per entry, recipes and transactional awards only; these pity and duplicate protections are not implemented'},
    garrisonAdjustments:[{stage:11,omit:{id:214,x:10,y:3},preserved:'two211 garrison units',opening:[214,213,211,20095],reason:'delay215 support tower until later draws; deck total unchanged'},{stage:14,omit:{id:311,x:10,y:2},opening:[317,308,316,20072],reason:'delay death-growth observer until later draws; deck total unchanged'}],
    enemyPolicy:{stats:'absolute per-army per-card cost/attack/health snapshot, no player-rank or player-stat lookup, no army-wide additive growth',
      mechanics:'keep established card mechanics; explicitly tune attack/health without silently turning off ranged, provoke, backstab or rebirth',
      spells:'base-rank spell effects and cost for first balancing pass; do not raise burst damage at the same time as card advantage and board pressure',
      initialBoard:'reuse current authored positions; starting units do not run ordinary summon opening effects, later played units do; show these units as existing garrison',
      pressure:'one default end-turn draw throughout first campaign; difficulty changes with card composition, selected unit stats, initial board and starting mana; later scenario draw2 remains configurable but unused here',
      difficultyDoesNotScaleWithPlayerInventory:true,playerDeckLimitsDoNotApply:true,unannouncedReinforcements:false,
      deploymentOrder:'saved per-card overrides -> instantiate base stats -> visible aura/status/entry effects; first garrison and later copies use same stat table; rebirth retains the card table; eggs base0/1 can receive visible buffs',
      fatiguePurpose:'Cost of extra draws and prevention of draw loops; not a universal encounter clock. Keep enemy independent stats.',
      pressureRisks:['stage11/12: only two Fireblaze copies each to limit stacking; dervish base2/2 may still get both +1 attack auras, Dune Caster +2/+2 and general201 +1 health; target producer before wave size escalates','stage14/15: Shadow Watcher grows from deaths on all sides, shaman health can stack and spawned wraithlings feed this loop; dispel access is required before this chapter','stage18: shaman and Greater Fortitude can strengthen rebirth eggs; preview should advise killing support then eggs, not promise every egg dies to1 damage'],
      implementationNeeded:['enemy per-card override snapshot and validation','general attack override','token snapshot contract','apply initial garrison and later summon stats consistently without double army bonus']},
    spellTraining:spellAudit.candidates.map(spell=>({id:spell.cardId,name:spell.originalEnglishName,verifiedBaseEffect:spell.verifiedEffectZh,source:spell.source,status:[20129,20073,20077,20061,20125,20144].includes(spell.cardId)?'no_numeric_training_temporarily':'define_and_verify_numeric_upgrade_before_enable',reason:[20129,20073,20077,20061,20125,20144].includes(spell.cardId)?'Audited effect is positioning/dispel/kill/transform with no additive numeric benefit; keep full base effect and do not sell a no-op rank':'Audited base has a numeric buff/damage/attack threshold; no upgrade is enabled until its actual effect is defined and verified',legacy:'Existing spell modes and paid permissions remain usable; do not revoke them'})),
    validationFirstSlice:{stages:[1,3,6,11,14,18],status:'existing proposed enemy tables not balanced for new low growth; real playtest required before expansion'},
    openingPressureChecks:[11,12,14,15,18].map(stage=>{
      const options={
        11:[{cardTypes:[10001,19033],approach:'飞行绕侧优先拆强化/产兵方尖碑',openingConditions:'至少一种飞行工具及时抽到且侧路有合法落点；不能假设必然起手'},{cardTypes:[19026,19027,10021,10017],approach:'地面嘲讽控沙魔进路、远程集中处理塔',openingConditions:'至少护卫和远程能按法力依次部署；路径被卡时另检替代'}],
        12:[{cardTypes:[10001,10012,10021],approach:'优先拆215弱化沙魔并稳守',openingConditions:'飞行/突袭/远程至少一个可在受压前触及215；触及轮数待验证'},{cardTypes:[19026,19027,10981],approach:'控制路线、轮换恢复并保护主将坚守10轮',openingConditions:'至少护卫或恢复及时入手，需验证没有指定工具的前三轮能否稳住'}],
        14:[{cardTypes:[10020,20073,20134],approach:'驱散观察者/元素核心，打断成长与腐化联动',openingConditions:'按当前阵营选可拥有的驱散，主将/登场范围实际可达；不能把跨阵营法术当共享'},{cardTypes:[10021,10017,10012],approach:'远程/突袭优先杀核心，减少喂养亡愿成长',openingConditions:'输出和部署范围足够先杀核心，必须记录杀杂兵造成的成长代价'}],
        15:[{cardTypes:[19026,19027,10019],approach:'利用两军交火并集中一军，空投控制局部通道',openingConditions:'合法进路和敌军互攻实际出现；不承诺两军自动替玩家解场'},{cardTypes:[10307,10018,10012],approach:'留溅射及低费单点处理产兵，先支援后杂兵',openingConditions:'伤害/召唤窗口和法力足以拆产兵源；反击/亡愿顺序需实测'}],
        18:[{cardTypes:[10021,10017,10012,19049],approach:'先杀支援再处理重生卵，减少强化卵',openingConditions:'伤害或抽牌工具可在支援叠加前抵达；不保证1伤能杀受增益的卵'},{cardTypes:[10019,10001,19026,10981],approach:'绕开重生线、控制走廊并恢复，坚守12轮',openingConditions:'存在不被堵死的合法走廊且控线/恢复及时抽到；不假定起手满足'}],
      };
      return {stage,rounds:[1,2,3],status:'candidate_paths_not_verified',checks:['逐回合记录敌方驻军/后续召唤、沙魔数量及光环、亡愿/成长/腐化触发、强化卵状态','记录主将实际受伤和可承受爆发，不仅记录最后胜负','记录每条路径的工具入手、法力、部署格与最早实际到达窗口；未实测前不填写可达轮数','没有指定工具的起手，前三轮仍须验证合法替代路线；不得用完美起手代表容错'],paths:options[stage].map((path,i)=>({key:i===0?'A':'B',...path,actions:[],resourceTimeline:[],observedArrivalWindow:null,recruitmentRequired:false,status:'candidate_not_verified'})),pathConstraint:'Each path is an independent option using different card types available from initial/campaign before encounter; for faction spells only matching faction may use them. Neither path depends on recruited premium cards.'};
    }),
    factionRouteReplay:'Do not skip tutorials or stages for later factions. Repetition of the second route must be assessed in playtests before changing progression.',
    stages,
    validationRequired:['structural IDs/counts/openings/18 maps pass only as planning checks','each faction default deck and affordable growth at chapter gates; no recruited cards required','multiple shuffled player openings and novice/defensive strategies, not only autoAct','target first3 70-90% and chapter bosses50-70% first-attempt win rate in internal human tests, provisional targets not measured results','avoid forced loss before first meaningful turn and require at least two deterministic accessible counters for every boss theme','new enemy snapshots survive later content changes and continue saving','same run/retry/reload cannot duplicate account/faction rewards; legacy claims preserve exact existing value','repeats give no orbs; verify alternating-faction claims and all-owned compensation conserve54 base orbs and10420 base coins'],
  };
}
