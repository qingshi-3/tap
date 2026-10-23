// @ts-expect-error Node host API.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
// @ts-expect-error Node host API.
import { createHash } from 'node:crypto';
// @ts-expect-error Node host API.
import { readFileSync } from 'node:fs';
import { chapter, battleIndex, CHAPTER_SCALE } from '../src/core/route';
import { unitDef } from '../src/core/data';
import { tierCap, qualityWeights } from '../src/core/run';
import { simulate } from '../src/core/engine';
import { INTRINSIC_BOSS_RULES } from '../src/core/encounterRules';
import { UNIT_MAP as OLD_UNITS } from '../../output/six-tier-rework-20261022/before-0.8.4/src/core/data';
import type { RouteNode } from '../src/core/route';
const dir='../output/strength-audit-20261022/enemies';mkdirSync(dir,{recursive:true});
const fields=['traits','special','cast','onStart','afterAttack','onHurt','onKill','onDuelKill','onRattle','onAllyFaint','onRear','onBeatEnd','onRevive','onEnemyFreeze','onFront','onPulse','chargeSkill','chargeAttack','prep'] as const;
const records:any[]=[];
for(let ch=0;ch<3;ch++)for(const [ni,stage]of chapter(ch).stages.entries()){
 if(stage.type==='shop')continue;
 const paths:[string,RouteNode][]=stage.type==='fork'?[['normal',stage.normal],['elite',stage.elite]]:stage.type==='battle'?[['main',stage.main],...(stage.variant?[['variant',stage.variant]as[string,RouteNode]]:[])]:[['boss',stage.main]];
 for(const[path,node]of paths){
 const battle=battleIndex(ch,ni), out=simulate({player:[{defId:'n_bulwark',atk:1,hp:99999}],enemy:node.lineup,rules:node.rules,chapter:ch+1,seed:1,record:false});
 const units=node.lineup.flatMap((entry,slot)=>{if(!entry)return[];const def=unitDef(entry.defId),old=OLD_UNITS[entry.defId];const initial=out.initial.find(u=>u.side===1&&u.slot===slot)!;
 const mechanics=Object.fromEntries(fields.filter(f=>def[f]!==undefined).map(f=>[f,def[f]]));const changed=old?fields.filter(f=>JSON.stringify(def[f])!==JSON.stringify((old as unknown as Partial<Record<typeof fields[number], unknown>>)[f])):[];
 const battleFields=fields.filter(f=>f!=='prep'&&f!=='traits');
 return[{slot:slot+1,id:def.id,name:def.name,level:initial.level,tier:def.tier,atk:initial.atk,hp:initial.maxHp,armor:initial.armor,grants:initial.grants,block:initial.block,ability:def.text,mechanics,changedSince084:changed,prepInactiveEnemy:!!def.prep?.length,prepOnly:!!def.prep?.length&&!battleFields.some(f=>def[f]!==undefined)&&!def.traits}];});
 const shopsBefore=chapter(ch).stages.slice(0,ni).filter(s=>s.type==='shop').length+ch*2;
 records.push({key:`${ch+1}:${ni+1}:${path}`,chapter:ch+1,node:ni+1,path,kind:node.kind,name:node.name,battleNumber:battle+1,tierCap:tierCap(battle),tierWeights:qualityWeights(battle),basePrepGold:10,cumulativeBaseBudgets:10*(battle+1+shopsBefore),maxBasePurchasesIgnoringRefresh:3*(battle+1+shopsBefore),previousWinsTrainingRange:[battle*3,battle*3+ch+(ni>5?1:0)],resourceCaveat:'Base window assumes prior victories. Upper range adds one extra point per prior optional elite (up to one each chapter); elite also grants equipment choice; g_drill and battle bonuses extra; trade refunds/recycling and growth not counted. Retries are not counted as first attempts.',hint:node.hint,totalAtk:units.reduce((n,u)=>n+u.atk,0),totalHp:units.reduce((n,u)=>n+u.hp,0),units,intrinsicBossRules:INTRINSIC_BOSS_RULES.filter(r=>r.source?.defId&&units.some(u=>u.id===r.source!.defId)),encounterRules:node.rules??[],fault:out.fault});
 }
}
const hashes=Object.fromEntries(['route','data','engine','run','preparation','encounterRules'].map(f=>[f,createHash('sha256').update(readFileSync(`src/core/${f}.ts`)).digest('hex')]));
writeFileSync(`${dir}/curve.json`,JSON.stringify({method:'CHAPTER_SCALE-applied chapter() lineup, actual engine initial snapshot against isolated diagnostic dummy; initial only, not combat-strength ranking. Enemy skills compared against frozen 0.8.4 definitions.',scales:CHAPTER_SCALE,hashes,records},null,2));
const pressure:Record<string,{risk:string;counterplay:string;predictability:string}>={
'1:1:main':{risk:'No special ability; deliberately forgiving first fight.',counterplay:'Any viable attacker; all-passive/non-attacking lineup still needs damage.',predictability:'Visible single 1/2 skeleton; ordinary mandatory route.'},
'1:2:main':{risk:'Rear sniper bypasses front tank; more bodies than first fight.',counterplay:'Place durable body at rear; avoid lone fragile engine there.',predictability:'Hint and enemy sniper visible; positioning sufficient.'},
'1:3:main':{risk:'Burn bypasses armor/block and persists across exchanges.',counterplay:'Kill pyre earlier; enough front hp; burn engines have not yet stacked.',predictability:'Mandatory; visible burn hint.'},
'1:5:main':{risk:'Splash behind front plus armor punishes adjacent fragile support and small-hit attacks.',counterplay:'Durable second seat, caster damage, higher single hits.',predictability:'Variant preselected; inspect lineup before deployment.'},
'1:5:variant':{risk:'Reborn plus initial block extends effective hp, sniper attacks rear.',counterplay:'Rear tank, sufficient repeated damage; raw hp understates reborn.',predictability:'Visible bodies and hint; cannot choose the alternative variant.'},
'1:6:normal':{risk:'FIRST MANDATORY CURVE SPIKE: 7/22 previous main ->16/38; reflect punishes multi-hit/low-hp attackers; shop tier remains2.',counterplay:'Casters bypass attacked-reflect; train front hp; adjust attack order.',predictability:'Can choose this normal route, elite is harder; no free easier route.'},
'1:6:elite':{risk:'Optional 21/47 five bodies: block+sniper+next-actor chill concentrates defensive and control pressure.',counterplay:'Choose normal; target fragile silencer/sniper, rear resilience.',predictability:'Explicit optional risk/reward, not representative of forced difficulty.'},
'1:7:main':{risk:'Reflect plus exile deletes reborn/deathrattle payoff; anti-summon/revive hard counter.',counterplay:'Damage spells, shielding/support, eliminate exile before sacrificial front dies.',predictability:'Mandatory chosen variant; exile stated, but faction synergy may be sunk investment.'},
'1:7:variant':{risk:'Summon/deathrattle relay and ally-death damage; a_seed changed summons since0.8.4; low base totals hide reinforcements.',counterplay:'Avoid slow single target attrition; crowd damage and focus summoners.',predictability:'Preview lists units; no option to choose opposite variant.'},
'1:9:boss':{risk:'75hp pool plus rear pull every3 exchanges and allied attack buffs every9(max2). Pull disrupts tank/support roles.',counterplay:'Anchor scroll blocks pull; robust rear; enough early damage.',predictability:'Boss ability and encounter rule exposed; defeat costs life then grants new10 budget, draw same budget/caps.'},
'2:1:main':{risk:'Taunt diverts sniper/ordinary attacks while enemy sniper+lowest-hp caster focus fragile engines.',counterplay:'Protect rear and low-hp unit; AoE/caster bypass taunt.',predictability:'Both target rules readable; chapter transition not simply +hp.'},
'2:2:main':{risk:'Two repeatable -2 attack casters create front damage collapse; combo strips blocks.',counterplay:'Rotate front, caster damage, kill curses quickly.',predictability:'Only one curser described despite two copies; inspect full formation.'},
'2:3:main':{risk:'Two combo units remove four blocks across their actions; burn bypasses armor, opening double block enemy.',counterplay:'Raw hp/healing and spell damage instead of relying only block.',predictability:'Visible combo hint; tier4 just unlocked previous fight.'},
'2:5:main':{risk:'Taunt plus lowest-hp damage plus healing slows front kill while killing support.',counterplay:'Burst/area damage, durable lowest-hp body.',predictability:'Hint accurate; shop precedes this fight.'},
'2:5:variant':{risk:'85hp reborn/healing/block support; l_vigil is prep-only so enemy has no rear block engine; old hint stale.',counterplay:'Kill healer with spells; no need to counter nonexistent l_vigil rear block.',predictability:'Hint overstates outdated ability; actual card details differ.'},
'2:6:normal':{risk:'Two4hp repeat heals behind frontline/initial block; low offense can stalemate or fatigue.',counterplay:'Burst, area damage, healing-denial via focus target ordering.',predictability:'Optional fork normal choice; current5-tier access does not guarantee acquired tier5.'},
'2:6:elite':{risk:'102hp plus warlord start+1 each, taunt, combo, curse and lowest-hp damage. Effective post-start atk exceeds listed27.',counterplay:'Choose normal; burst warlord/support, avoid fragile lone carry.',predictability:'Explicit optional elite; evaluate separately from normal path.'},
'2:7:main':{risk:'Reborn grant plus one-use resurrection and deathrattle power; a_brood now prep-only; a_cult no longer initial caster, old hint inaccurate.',counterplay:'Exile deathrattle units, burst ritualist, exploit reduced direct damage.',predictability:'Old description advertises removed power/cast role.'},
'2:7:variant':{risk:'103hp taunt+armor wall, hurt-trigger chill and next-actor chill create actual freeze loop; unlike main no prep-only blank.',counterplay:'Spell damage and high attack thresholds, target mage, fewer front small hits.',predictability:'Variant automatic; may cause large same-stage difficulty gap.'},
'2:9:boss':{risk:'154hp; every5 freezes highest attack, mage chills next actor, curse lowers front freeze threshold; all-enemy block every9.',counterplay:'Spread damage across units; spells/extra actions; kill control supports; no new ordinary6-tier yet.',predictability:'Rules public; forced gate. Defeat retry new budget vs draw unchanged.'},
'3:1:main':{risk:'Two reborn11atk knights and two tomb summons;119 initial hp understates repeated bodies.',counterplay:'Exile and AoE; avoid prolonged lowest-hp caster pressure.',predictability:'Tier6 first opens here with only10% offer weight, not guaranteed purchased.'},
'3:2:main':{risk:'Dual taunt screens charge2 sniper summon; keeper charges adjacent allies on attacked. d_pyro is prep-only so no enemy buy-power engine.',counterplay:'Spell bypass, avoid low-damage repeated attacks on battery tank.',predictability:'Visible battery adjacency; old hint does not explain current dependency fully.'},
'3:3:main':{risk:'High attack plus armor-retaliation burn, frontline burn and burn amplification; attacks fuel enemy growth/retaliation.',counterplay:'Burst casters, kill shaman/bloodcaller, hp resilience, less multi-hit on armored mender.',predictability:'Mandatory burn countercheck; shared m_rex/m_mender changed since084.'},
'3:5:main':{risk:'Taunt+11atk combo killer gains action, duel kill chase, sniper rear attack reduction, dancer forces highest attacker follow-up.',counterplay:'No low-hp sacrificial kill fodder; spread durability; disrupt caster/taunt.',predictability:'Old sniper/combo hint omits new ninja action-on-kill and rear debuff.'},
'3:5:variant':{risk:'Warlord +1 start each;39hp taunt; combo/healing/exile punish reborn engines.',counterplay:'Spell focus supports; no reliance solely on deathrattle/blocks.',predictability:'Automatic variant; exile visible but hint omits exile.'},
'3:6:normal':{risk:'39hp armor2 tank+39hp taunt and dual lowest-hp3 damage casters create sustain/burst threshold.',counterplay:'High single hit or spells; lowest hp protection; kill casters.',predictability:'Normal route; no requirement to choose52atk elite.'},
'3:6:elite':{risk:'52atk before warlord+1 each; armor2/combo/curse/exile all attack distinct defenses.',counterplay:'Choose normal; only voluntarily risk if mature alternate damage plan.',predictability:'Explicit optional high risk; scaling passives make initial totals misleading.'},
'3:7:main':{risk:'42/153 with ally-death team attack and summons; keeper+drake freeze responses now lack own chill source after drake cast removed.',counterplay:'Kill summon support; current freeze loop is inert, not a demand for freeze resistance.',predictability:'Hint advertises outdated cold package; meaningful content-regression candidate.'},
'3:7:variant':{risk:'Taunt armor42hp wall, retaliation chill and burn, next-actor freeze; alchemist now deathrattle instead of caster, burst happens on death.',counterplay:'Controlled burst and spell targeting, high atk threshold, avoid repeated small attacks into retaliation.',predictability:'37/151 smaller than main but actual control loop can be harder; variant not chosen.'},
'3:9:boss':{risk:'275initial hp;44hp taunt,14atk reborn+combo,143hp boss; below-half recalls dead allies at halfhp then gives recalled+2atk and boss3block.',counterplay:'Save burst for halfhp phase; exile limits death payoffs but check recall rules independently; spread survivability.',predictability:'Mandatory terminal gate, rule text public. First attempt cannot assume retries or bonus budgets.'}
};
for(const r of records)r.pressure=pressure[r.key];
writeFileSync(`${dir}/curve.json`,JSON.stringify({method:'CHAPTER_SCALE-applied chapter() lineup; actual engine.initial snapshot. Not an estimated combat power score. Initial totals exclude start buffs, revives, summons and rules.',scales:CHAPTER_SCALE,hashes,records},null,2));
writeFileSync(`${dir}/fairness-review.md`,'# 敌曲线与公平性静态审查\n\n静态压力不能等同胜率；每个节点需接合法成长实战。当前普通每备战10金且余钱清零，每个预算最多买3张基础单位；商店独立10金另可买一次6金全局被动。累计预算是假设各先前战斗首次获胜的资源窗口，未叠主将/战斗产金、卖出、成长与刷新成本。培养范围为每前胜3点，加最多每章1个已选精英的额外点，不含练兵。首领败局扣命并新发预算，平局不发钱、不重置成长限次，不能把重试成绩当首通公平性。\n\n'+records.map(r=>`## ${r.key} ${r.name}\n\n- 实际初始：${r.totalAtk}攻/${r.totalHp}血，战序${r.battleNumber}，普通开放${r.tierCap}阶；本阶概率${r.tierWeights[r.tierCap-1]}%。\n- 压力：${r.pressure.risk}\n- 反制：${r.pressure.counterplay}\n- 预判/规避：${r.pressure.predictability}\n`).join('\n'));
const rows=records.map(r=>`|${r.key}|${r.name}|${r.kind}|${r.battleNumber}|${r.tierCap}|${r.totalAtk}/${r.totalHp}|${r.cumulativeBaseBudgets}|${r.previousWinsTrainingRange.join('–')}|${r.units.filter((u:any)=>u.prepInactiveEnemy).map((u:any)=>u.name+(u.prepOnly?'（备战专属）':'')).join('、')||'—'}|`);
writeFileSync(`${dir}/curve.md`,'# 实际敌曲线与资源窗口\n\n不是战力评分：总攻血只用于定位数值跳点；控制、召唤、治疗、复生、目标选择和首领规则详见curve.json逐单位实际初始值与完整能力。\n\n|节点章:格:分支|遭遇|路线|战序|开放阶|总攻/总血|累计基础预算|前胜培养点范围|敌方备战能力失效|\n|---|---|---|---:|---:|---:|---:|---:|---|\n'+rows.join('\n')+'\n');
console.log(JSON.stringify({nodes:records.length,changed:records.flatMap(r=>r.units.filter((u:any)=>u.changedSince084.length).map((u:any)=>({node:r.key,id:u.id,changes:u.changedSince084,prepOnly:u.prepOnly}))),curves:records.map(r=>({key:r.key,name:r.name,tier:r.tierCap,atk:r.totalAtk,hp:r.totalHp}))},null,2));

const spikes=records.flatMap(r=>records.filter(p=>p.battleNumber===r.battleNumber-1).map(p=>({from:p.key,to:r.key,fromName:p.name,toName:r.name,toKind:r.kind,attackRatio:r.totalAtk/Math.max(1,p.totalAtk),hpRatio:r.totalHp/Math.max(1,p.totalHp),newTier:r.tierCap>p.tierCap,fromPressure:p.pressure.risk,toPressure:r.pressure.risk}))).sort((a,b)=>b.hpRatio-a.hpRatio);
writeFileSync(`${dir}/adjacent-spikes.json`,JSON.stringify({warning:'Raw initial attack/hp ratios are descriptive only. They exclude combat loops and do not rank fight difficulty. Start-up singleton->two/three enemy jumps are expected.',pairs:spikes},null,2));
/** Join only a finished audit with an unchanged-core gate; never treat in-progress rows as a final sample. */
for(const phase of ['calibration','holdout','casual','recovery']) {
  const prefix=`../output/strength-audit-20261022/player/${phase}`;
  if(!existsSync(`${prefix}-summary.json`)||!existsSync(`${prefix}-battles.jsonl`))continue;
  const summary=JSON.parse(readFileSync(`${prefix}-summary.json`,'utf8'));
  if(summary.changed?.length||summary.failed||summary.illegal||summary.faults) {
    writeFileSync(`${dir}/${phase}-join-rejected.json`,JSON.stringify({reason:'Dynamic audit gate not clean; do not present as verified final sample.',failed:summary.failed,illegal:summary.illegal,faults:summary.faults,changed:summary.changed},null,2));continue;
  }
  const battleRaw=readFileSync(`${prefix}-battles.jsonl`,'utf8');
  const summaryRaw=readFileSync(`${prefix}-summary.json`,'utf8');
  const inputHashes={battles:createHash('sha256').update(battleRaw).digest('hex'),summary:createHash('sha256').update(summaryRaw).digest('hex')};
  for(const [name,sha]of Object.entries(hashes))if(summary.hashes?.[`src/core/${name}.ts`]!==sha)throw Error(`${phase}: source hash mismatch ${name}`);
  const lines=battleRaw.trim().split('\n').filter(Boolean).map((l:string)=>JSON.parse(l));
  if(lines.length!==summary.battles)throw Error(`${phase}: completed summary/row count mismatch`);
  const buckets:Record<string,any>={};
  for(const row of lines){
    const encounter=records.find(r=>r.chapter===row.chapter&&r.node===row.node&&r.name===row.encounterName);
    if(!encounter)throw Error(`unmapped encounter ${row.key}`);
    const first=row.retry===0, key=`${encounter.key}/${first?'first':'retry'}/${row.policy}/${row.recoveryMode??'normal'}`;
    const b=buckets[key]??={node:encounter.key,name:encounter.name,kind:encounter.kind,policy:row.policy,recovery:row.recoveryMode??'normal',attemptClass:first?'first':'retry',n:0,win:0,lose:0,draw:0,fatigue:0,beats:0,goldUnused:0,fieldBodies:0,trainingPoints:0,rawGrowthAtk:0,rawGrowthHp:0,star2:0,star3:0,maxTier:0,generals:{},failureIds:[]};
    b.n++;b[row.result]++;b.fatigue+=row.fatigue?1:0;b.beats+=row.beats;b.goldUnused+=row.goldUnused;b.fieldBodies+=row.field.length;
    b.trainingPoints+=row.owned.reduce((n:number,u:any)=>n+(Object.values(u.train??{}) as number[]).reduce((a:number,v:number)=>a+v,0),0);
    b.rawGrowthAtk+=row.owned.reduce((n:number,u:any)=>n+(u.growth?.atk??0),0);b.rawGrowthHp+=row.owned.reduce((n:number,u:any)=>n+(u.growth?.hp??0),0);
    b.star2+=row.field.filter((u:any)=>u.star===2).length;b.star3+=row.field.filter((u:any)=>u.star===3).length;b.maxTier+=Math.max(0,...row.field.map((u:any)=>u.tier));
    const g=b.generals[row.general]??={n:0,win:0,lose:0,draw:0};g.n++;g[row.result]++;
    if(row.result!=='win'&&b.failureIds.length<5)b.failureIds.push({id:row.id,attempt:row.attempt,result:row.result,combo:row.combo,route:row.route});
  }
  const list=Object.values(buckets).map((b:any)=>({...b,winRate:b.win/b.n,meanBeats:b.beats/b.n,meanGoldUnused:b.goldUnused/b.n,meanFieldBodies:b.fieldBodies/b.n,meanTraining:b.trainingPoints/b.n,meanGrowthAtk:b.rawGrowthAtk/b.n,meanGrowthHp:b.rawGrowthHp/b.n,meanStar2:b.star2/b.n,meanStar3:b.star3/b.n,meanMaxTier:b.maxTier/b.n}));
  const ranked=list.filter((b:any)=>b.attemptClass==='first').sort((a:any,b:any)=>a.winRate-b.winRate);
  writeFileSync(`${dir}/${phase}-join.json`,JSON.stringify({source:`player/${phase}-battles.jsonl`,inputHashes,sampleRuns:summary.runs,sampleBattles:summary.battles,interpretation:'Conditioned on reaching each node; policies are bounded heuristics, not optimal play. Retry separate. Raw growth/training are resources, not additive combat power scores.',buckets:list},null,2));
  writeFileSync(`${dir}/${phase}-risk-ranked.md`,`# ${phase} 敌曲线 × 合法成长实战\n\n总样本${summary.runs}局/${summary.battles}战。以下首遇表为到达该节点的条件胜率；不同策略和主将样本不混作最优解证明。首领重试在JSON另列，精英和自动变体保留独立节点。培养/成长均为真实持有量，不作战力分数。\n\n|节点|遭遇|路线|策略|到达N|胜|负|平|胜率|平均战位|平均2星/3星|平均培养|平均永久攻/血|\n|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`+ranked.map((b:any)=>`|${b.node}|${b.name}|${b.kind}|${b.policy}${b.recovery!=='normal'?'/'+b.recovery:''}|${b.n}|${b.win}|${b.lose}|${b.draw}|${(b.winRate*100).toFixed(1)}%|${b.meanFieldBodies.toFixed(1)}|${b.meanStar2.toFixed(1)}/${b.meanStar3.toFixed(1)}|${b.meanTraining.toFixed(1)}|${b.meanGrowthAtk.toFixed(1)}/${b.meanGrowthHp.toFixed(1)}|`).join('\n')+'\n');
  console.log(JSON.stringify({joinedPhase:phase,runs:summary.runs,battles:summary.battles,highestRisk:ranked.slice(0,8).map((b:any)=>({node:b.node,policy:b.policy,n:b.n,winRate:b.winRate}))}));
}

const held='../output/strength-audit-20261022/player/holdout-battles.jsonl';
if(existsSync(held)){
  const rows=readFileSync(held,'utf8').trim().split('\n').filter(Boolean).map((s:string)=>JSON.parse(s));
  const first=rows.filter((r:any)=>r.chapter===2&&r.node===9&&r.retry===0);
  const failures=first.filter((r:any)=>r.result!=='win');
  const failureEvidence=failures.map((r:any)=>{
    const playerCount=r.setup.player.filter(Boolean).length;
    const trace=r.trace??[];
    return {id:r.id,attempt:r.attempt,policy:r.policy,result:r.result,beats:r.beats,fatigue:r.fatigue,
      initialPlayerFreezes:trace.filter((e:any)=>e.t==='frozenSkip'&&e.uid<=playerCount).length,
      bossChillApplications:trace.filter((e:any)=>e.t==='chill'&&e.src===playerCount+1&&e.uid<=playerCount).length,
      barrierRules:trace.filter((e:any)=>e.t==='rule'&&e.id==='frostq_barrier').length,
      blockedPlayerHits:trace.filter((e:any)=>e.t==='dmg'&&e.blocked&&e.src<=playerCount&&e.tgt>playerCount).length,
      sampleTimeline:trace.filter((e:any)=>e.t==='beat'||e.t==='frozenSkip'||(e.t==='chill'&&e.src===playerCount+1)||(e.t==='rule'&&['frostq_freeze','frostq_barrier'].includes(e.id))).slice(0,35)};
  });
  writeFileSync(`${dir}/frostq-fatigue-evidence.json`,JSON.stringify({source:'holdout-battles.jsonl frozen traces; only non-win setups retain trace. Initial player UID range excludes later summons and reserves.',firstEncounters:first.length,fatigueEncounters:first.filter((r:any)=>r.fatigue).length,nonWinTraceCount:failureEvidence.length,withInitialPlayerFreeze:failureEvidence.filter((r:any)=>r.initialPlayerFreezes>0).length,withBarrierRule:failureEvidence.filter((r:any)=>r.barrierRules>0).length,evidence:failureEvidence},null,2));
}
