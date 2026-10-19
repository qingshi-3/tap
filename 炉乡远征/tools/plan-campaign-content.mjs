// Planning artifact only: never imports into the running game or rewrites saves.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {buildCampaignDesign,PROPOSED_NEUTRAL_REWARDS,PROPOSED_FACTION_UNITS} from './campaign-design-data.mjs';
const dir=new URL('../output/content-planning/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,dir),'utf8'));
const current=read('current-cards-audit.json'), source=read('source-roster.json'), skins=read('skin-variants.json');
const byId=new Map(source.units.map(u=>[u.id,u]));
const initialNeutral=[10021,10981,10019,19027,10001,10018,19026,10204];
const newInitial=[10001,10018,19026,10204];
const stageNeutral=PROPOSED_NEUTRAL_REWARDS;
const requiredMechanics={10013:'登场双方各抽1；满手烧牌与空库疲劳必须共用原作抽牌入口',10982:'亡愿抽1；与同次死亡、胜负检查顺序一致',10020:'登场驱散所选附近1格，明确可清除内容与永久成长的边界',10959:'登场伤害正前方目标；采用原作朝向/数值',10307:'Frenzy相邻溅射；采用原作伤害与反击顺序',19042:'登场伤害相邻单位；采用原作敌我范围',19049:'造成伤害后抽牌；需核对每次伤害与反击触发'};
const cards=current.cards.map(c=>({...c,routeStatus:'planned_not_live'}));
for(const c of cards.filter(c=>c.type==='unit'&&c.faction===0&&c.acquisition!=='token')){
  c.acquisition=initialNeutral.includes(c.id)?'initial':'campaign';
  c.level=c.acquisition==='initial'?null:Number(Object.entries(stageNeutral).find(([,id])=>id===c.id)?.[0]);
  c.reason=c.acquisition==='initial'?'基础职能直接拥有，30张编成不依赖抽奖':'按主线确定解锁，不用碎片购买基础工具';
}
const existing=new Set(cards.map(c=>c.id));
for(const id of [...newInitial,...Object.values(stageNeutral)].filter(id=>!existing.has(id))){
 const u=byId.get(id);assert.ok(u&&u.category==='unit'&&u.assets.some(a=>a.originalPngExists&&a.plistExists));
 cards.push({id,name:u.name,type:'unit',faction:0,baseCost:u.cost,baseAttack:u.attack,baseHealth:u.health,acquisition:newInitial.includes(id)?'initial':'campaign',level:newInitial.includes(id)?null:Number(Object.entries(stageNeutral).find(([,v])=>v===id)[0]),routeStatus:'source_import_required',source:u.source,mechanicReferences:u.modifierReferences,implementationGate:requiredMechanics[id]??'移植原作卡片数值与机制，核对动画/输入/保存；不能仅因图集存在便开放',legacyOwnedPolicy:'existing ownership never removed'});
}
// Reward timing now follows faction-local progress for faction cards, and the
// highest completed account milestone for neutrals. Never grant all six faction
// units for completing stage three with one faction.
for(const c of cards.filter(c=>c.acquisition==='campaign'&&c.faction>0)) {
  c.level=c.type==='unit'?3:c.id===20044?6:12;
  c.rewardScope='matching_faction_once';
  if(c.type==='unit')assert.equal(PROPOSED_FACTION_UNITS[c.faction],c.id);
}
const spellAudit=read('spell-candidates-audit.json');
for(const s of spellAudit.candidates) cards.push({id:s.cardId,name:s.originalEnglishName,type:'spell',faction:s.factionId,baseCost:s.manaCost,baseAttack:null,baseHealth:null,acquisition:'campaign',level:s.rewardLocalLevel,rewardScope:'matching_faction_once',role:s.role,rules:s.verifiedEffectZh,source:s.source,routeStatus:'source_import_required',implementationGate:s.adaptationNotes,legacyOwnedPolicy:'old ownership retained'});
assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
const plans=new Map(cards.map(c=>[c.id,c]));
for(const c of cards)c.levelId=c.level?EXPEDITION_LEVELS[c.level-1].id:null;
const starterDecks=current.initialDecks.map(d=>{
 const slots=d.slots.map(s=>{const id=s.id===19037?19026:s.id===19050?10204:s.id;const c=plans.get(id);return {id,count:s.count,name:c.name,cost:c.baseCost};});
 const faction=d.faction;
 const available=cards.filter(c=>c.acquisition==='initial'&&(c.faction===0||c.faction===faction));
 assert.equal(slots.reduce((n,s)=>n+s.count,0),30);assert.equal(new Set(slots.map(s=>s.id)).size,slots.length);
 for(const s of slots){assert.ok(s.count>=1&&s.count<=3);assert.ok(available.some(c=>c.id===s.id),`unowned ${s.id} faction ${faction}`);}
 assert.ok(available.length>=14);assert.ok(slots.filter(s=>s.cost<=2).reduce((n,s)=>n+s.count,0)>=12);
 return {factionId:faction,factionName:d.factionName,selectedTypes:slots.length,availableTypes:available.length,availableMaxCopies:available.length*3,availableIds:available.map(c=>c.id),slots,curve:slots.reduce((v,s)=>(v[s.cost]=(v[s.cost]??0)+s.count,v),{}),status:'constructible_only_not_battle_balanced'};
});
const sourceAllocation=source.units.map(u=>{
 const chosen=plans.get(u.id);let route=chosen?.acquisition;
 if(!route)route=u.category==='token'?'token':u.category==='boss-unit'?'enemy_reserved':u.category==='tutorial-unit'?'tutorial_reserved':['Epic','Legendary'].includes(u.rarity)?'recruitment_candidate':'campaign_candidate';
 return {id:u.id,name:u.name,source:u.source,rarity:u.rarity,category:u.category,faction:u.factionKey,acquisition:route,release:chosen?'first_content_batch':'reserve_not_scheduled',stage:chosen?.level??null,artPairExists:u.assets.some(a=>a.originalPngExists&&a.plistExists),mechanics:u.modifierReferences,note:chosen?'见首批逐卡配置':'按原稀有度给候选获取归属；尚未逐卡平衡，未分配未来关号，不放入生产抽池'};
});
const variantAllocation=skins.variants.map(v=>({planningKey:`variant:${v.variant}`,sourceVariant:v.variant,cosmeticId:v.cosmeticId,baseCardId:v.baseCardId,originalSkinCardId:v.skinnedCardId,acquisition:'recruitment_candidate',release:v.completeAtlasAvailable?'separate_unit_design_required':'missing_art_hold',artPairExists:v.completeAtlasAvailable,atlasReusedByBaseCards:v.atlasReusedByBaseCards,sourceReference:'skin-variants.json',note:'独立新单位；名称、职能、数值与持久ID单独定案，无皮肤系统。必须先检查图集齐全，与Boss/节日原卡共享图集时只登记一个内容实体；普通闪卡不算新单位。'}));
const stageRewards=Array.from({length:18},(_,i)=>({stage:i+1,cards:cards.filter(c=>c.acquisition==='campaign'&&c.level===i+1).map(c=>({id:c.id,name:c.name,faction:c.faction,scope:c.faction===0?'account_milestone_once':'matching_faction_once'})),tickets:'拟议：账号节点首通1珠、章末另1；其他阵营节点首通仅章末1；重复胜利0。满收集按开战冻结权益每未来宝珠20金币，不兑换旧余额。详见campaignDesign'}));
assert.equal(cards.filter(c=>existing.has(c.id)).length,current.cards.length);
assert.equal(sourceAllocation.length,source.units.length);assert.equal(variantAllocation.length,75);
const countBy=(rows,key)=>rows.reduce((o,r)=>(o[r[key]]=(o[r[key]]??0)+1,o),{});
const result={status:'planning_only_not_runtime_config',date:'2026-10-13',contract:{deckCards:30,generalOutsideDeck:true,maxCopies:3,unlockTypeGrantsThreeDeckCopies:true,startingHand:5,mulligan:2,replacePerTurn:1,endTurnDraw:1,handLimit:6,fullHand:'burn',emptyDeckDamage:2,reshuffle:false,initialNeutral,oldOwnedRetained:true},counts:{firstBatchUnits:cards.filter(c=>c.type==='unit'&&c.acquisition!=='token').length,existingCardsCovered:current.cards.length,firstBatchByRoute:countBy(cards,'acquisition'),sourceRows:sourceAllocation.length,sourceByRoute:countBy(sourceAllocation,'acquisition'),skinRows:variantAllocation.length},firstBatchCards:cards,starterDecks,stageRewards,recruitment:{firstBatchUnitIds:cards.filter(c=>c.type==='unit'&&c.acquisition==='recruitment').map(c=>c.id),candidateExpansionIds:[10963,19045,11036,10975],probabilities:'not_configured',fragmentRequirements:'not_configured',poolConstraints:['主线基础反制不进入招募独占','高级单位以组合/职能变化为目标，不全面替代基础单位','分阵营/主题小池，避免几百目标碎片稀释；每期目标规模、券产出与完成一次合成所需战斗数一起验算','已有卡保留，来源变更仅限制今后的新获取','解锁卡种即能带0–3张；不再要求合成三次','池/配方/库存来源必须一致：招募独占ID不能同时进入关卡直接解锁','皮肤ID不能直接充当本作单位ID；机制完成前不出售/投放碎片']},sourceAllocation,variantAllocation,knownGaps:['30张抽牌/疲劳与炉石手机布局尚未实现，当前运行仍有schema5供应原型','除莱昂外只有2种法术，首批可组但法术选择不足；后续各补2种原作法术并分别明确初始/关卡获取，不能靠新写同质治疗变式填充','新导入16单位须移植相应规则与动画，不能将本规划文件直接接成已可玩的卡','原稀有度只用于后备目录初筛，不代表本作抽率/价格或最终强弱','全部单位与皮肤已分类；后备内容尚未逐一完成新机制/数值设计，不声称626+75为701个独特可用素材','旧首通结果页重复persist覆盖解锁名称的已知缺陷仍待修，奖励到账本身已验证']};
result.campaignDesign=buildCampaignDesign(cards,spellAudit);
result.counts.firstBatchSpells=cards.filter(c=>c.type==='spell').length;
result.recruitment.probabilities='proposed focus50%, other five10% each; after three consecutive non-focus results, the fourth draw guarantees focus; not runtime';
result.recruitment.fragmentRequirements='proposed 2 fragments/draw,12/type,1 orb/draw; not runtime';
result.knownGaps=['schema6抽牌框架已实现；完整手机版布局仍待后续','六阵营独立进度与分作用域奖励尚未实现；本规划按最新菜单方向给出契约，不猜旧共享进度归属','16种中立及10种法术待规则/美术/输入/存档接入','当前enemy-plan仅军队统一加成；逐卡绝对数值与主将攻击覆写需扩展冻结快照','正式高级卡池、定向保底和重复转移未实现，原关卡直送高级卡的旧映射需移除；旧已拥有不得收回','新低成长下18关敌牌表未经平衡；优先验证1/3/6/11/14/18，风险11/12/14/15/18需两条开局反制路径','后备单位与独立外观候选未全数逐卡设计，不作为首发可用数量'];
assert.equal(result.campaignDesign.stages.length,18);
assert.equal(result.campaignDesign.stages.reduce((s,r)=>s+r.playerReward.accountFirstCoins+r.playerReward.factionChapterFirstCoins,80),3770);
assert.equal(result.campaignDesign.stages.reduce((s,r)=>s+r.playerReward.accountStageFirstOrbs,0),24);
assert.equal(80+result.campaignDesign.stages.reduce((s,r)=>s+r.playerReward.accountFirstCoins+5*r.playerReward.otherVictoryCoins+6*r.playerReward.factionChapterFirstCoins,0),10420);
const design=result.campaignDesign;
assert.equal(design.stages.reduce((n,s)=>n+s.playerReward.accountStageFirstOrbs+5*s.playerReward.otherFactionStageFirstOrbs,0),54);
assert.equal(design.stages.reduce((n,s)=>n+s.playerReward.otherVictoryCoins+s.playerReward.factionChapterFirstCoins,0),1330);
for(const milestone of design.economy.laterRouteIncome)assert.equal(design.stages.filter(s=>s.stage<=milestone.stage).reduce((n,s)=>n+s.playerReward.otherVictoryCoins+s.playerReward.factionChapterFirstCoins,0),milestone.coins);
assert.ok(design.stages.every(s=>s.playerReward.repeatOrbs===0));
// Compute the same complete six-route ledger in alternating-faction order.
const claimedStages=new Set(),claimedChapters=new Set(),claimedFactionStages=new Set();let alternatingCoins=80,alternatingOrbs=0;
for(const stage of design.stages)for(const faction of [3,1,6,2,5,4]){const factionStage=`${faction}:${stage.stage}`;assert.ok(!claimedFactionStages.has(factionStage));const first=!claimedStages.has(stage.stage);alternatingCoins+=first?stage.playerReward.accountFirstCoins:stage.playerReward.otherVictoryCoins;alternatingOrbs+=first?stage.playerReward.accountStageFirstOrbs:stage.playerReward.otherFactionStageFirstOrbs;claimedStages.add(stage.stage);claimedFactionStages.add(factionStage);if(stage.stage%3===0){const chapter=`${faction}:${stage.chapter}`;assert.ok(!claimedChapters.has(chapter));claimedChapters.add(chapter);alternatingCoins+=60;}}
assert.equal(alternatingCoins,10420);assert.equal(alternatingOrbs,54);assert.equal(claimedChapters.size,36);
for(const check of design.openingPressureChecks){assert.equal(check.paths.length,2);for(const path of check.paths){assert.equal(path.observedArrivalWindow,null);for(const id of path.cardTypes){const card=plans.get(id);assert.ok(card&&card.acquisition!=='recruitment'&&(card.acquisition==='initial'||card.level<check.stage),`path ${check.stage} uses unavailable ${id}`);}}}
assert.equal(design.stages[10].armies[0].garrison.some(u=>u.id===214&&u.x===10&&u.y===3),false);
assert.equal(design.stages[13].armies[0].garrison.some(u=>u.id===311&&u.x===10&&u.y===2),false);
assert.deepEqual(design.stages[10].armies[0].openingHand,[214,213,211,20095]);
assert.deepEqual(design.stages[13].armies[0].openingHand,[317,308,316,20072]);

assert.equal(design.recruitment.targets.length*design.recruitment.recipeFragments/design.recruitment.fragmentsPerDraw,36);
assert.deepEqual(design.economy.unitGrowth.steps.map(s=>[s.attack,s.health]),[[0,0],[0,1],[0,1],[1,1],[1,2]]);
assert.deepEqual(design.spellTraining.filter(s=>s.status==='no_numeric_training_temporarily').map(s=>s.id),[20129,20073,20077,20061,20125,20144]);
assert.deepEqual(design.validationFirstSlice.stages,[1,3,6,11,14,18]);
for(const stage of result.campaignDesign.stages)for(const army of stage.armies){
  assert.equal(army.deckSize,army.deckComposition.reduce((s,c)=>s+c.count,0));
  assert.deepEqual(army.deck.slice(0,army.rules.openingHandSize),army.openingHand);
  assert.ok(army.garrison.every(u=>Number.isInteger(u.attack)&&Number.isInteger(u.health)&&u.health>0&&u.x>=0&&u.y>=0&&u.x<stage.map.columns&&u.y<stage.map.rows));
}
assert.ok(cards.filter(c=>c.acquisition==='recruitment').every(c=>!stageRewards.some(s=>s.cards.some(x=>x.id===c.id))));
writeFileSync(new URL('content-plan.json',dir),JSON.stringify(result,null,2)+'\n');
writeFileSync(new URL('validation.json',dir),JSON.stringify({status:'planning_structure_only_not_playtest',counts:result.counts,starterDecks:starterDecks.map(d=>({faction:d.factionId,types:d.availableTypes,cards:d.slots.reduce((n,s)=>n+s.count,0)})),stageRewards,enemyStages:18,enemyArmies:result.campaignDesign.stages.reduce((n,s)=>n+s.armies.length,0),checks:['unique card IDs and original roster coverage','30-card owned starters with at least14 choices and low-cost coverage','18 authored enemy encounters: opening prefix and counts agree, integer stats and in-bounds garrisons','account/faction reward scopes and recruitment-route exclusion','3770/1330/10420 base coins and24/6/54 base orbs, excluding collection compensation','36-draw complete collection with timely synthesis and transfer','low-growth curve and legacy growthVersion protection','six first-slice stages and five opening-pressure path placeholders'],limitations:['not runtime data','no new balance simulation or human win-rate claim','new spell effects require implementation against audited source']},null,2)+'\n');
const generation={generatedAt:new Date().toISOString(),status:'planning_structure_only_not_playtest',files:['content-plan.json','validation.json'],economy:design.economy,recruitment:design.recruitment,spellTraining:design.spellTraining,validationFirstSlice:design.validationFirstSlice,openingPressureChecks:design.openingPressureChecks,garrisonAdjustments:design.garrisonAdjustments,accounting:{alternatingCoins,alternatingOrbs,accountStageClaims:claimedStages.size,factionChapterClaims:claimedChapters.size}};
writeFileSync(new URL('latest-generation.json',dir),JSON.stringify(generation,null,2)+'\n');
console.log(JSON.stringify({counts:result.counts,starterDecks:starterDecks.map(d=>({faction:d.factionId,types:d.availableTypes,cards:d.slots.reduce((n,s)=>n+s.count,0)})),stageRewards:stageRewards.map(s=>({stage:s.stage,ids:s.cards.map(c=>c.id)}))},null,2));
