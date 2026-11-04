// Offline paired-seed sensitivity for the third human run. This is not a replay: the original
// battle RNG seeds were not saved, so all scenarios use a new deterministic 1..512 seed grid.
// @ts-ignore node builtin types are intentionally not installed in the game project
import { mkdirSync, writeFileSync } from 'node:fs';
import { authoredEncounters } from '../../src/core/encounters';
import { simulate, type Result, type UnitSpec } from '../../src/core/engine';

type Scenario = { turn: number; name: string; enemyKey: string; enemyDefs?: string[]; enemyStats: [number, number][]; enemyLvl: 1 | 2 | 3; player: UnitSpec[]; relics: string[] };
type Totals = Record<Result, number> & { score: number };

const player = (specs: Array<[string, 1 | 2 | 3, number, number, Partial<UnitSpec>?]>): UnitSpec[] =>
  specs.map(([def, lvl, atk, hp, extra]) => ({ def, lvl, atk, hp, ...extra }));
const scenarios: Scenario[] = [
  { turn: 13, name: 'T13 火山兽潮', enemyKey: 'summon-late', enemyStats: [[11,19],[17,12],[10,14],[14,19],[14,19]], enemyLvl: 1,
    player: player([['l_windblade',1,6,8],['l_warden',3,16,19],['d_pharaoh',1,13,13,{copy:'l_warden'}],['v_bear',1,9,12],['l_storm',1,11,13]]), relics: ['r_vanguard','r_rear','r_relay'] },
  { turn: 19, name: 'T19 伤痕共鸣', enemyKey: 'hurt-late', enemyStats: [[11,21],[8,16],[8,19],[16,19],[10,19]], enemyLvl: 2,
    player: player([['l_windblade',1,5,7,{lamp:true,tfx:['plate']}],['l_warden',3,16,19],['d_pharaoh',2,18,17,{copy:'l_warden'}],['v_bear',2,10,13],['l_storm',2,15,17]]), relics: ['r_vanguard','r_rear','r_relay','r_lone'] },
  { turn: 20, name: 'T20 铁幕追击', enemyKey: 'wall-mid', enemyStats: [[18,28],[16,46],[19,25],[11,30],[16,16]], enemyLvl: 2,
    player: player([['l_windblade',2,8,10],['l_warden',3,18,25,{tfx:['berry']}],['d_pharaoh',2,23,22,{copy:'l_warden'}],['v_bear',2,12,15],['l_storm',2,17,19]]), relics: ['r_vanguard','r_rear','r_relay','r_lone'] },
  { turn: 21, name: 'T21 最终Boss', enemyKey: 'final', enemyDefs: ['e_shield','e_twin','e_void','e_pyre','e_tomb'], enemyStats: [[9,39],[22,26],[26,50],[26,17],[13,30]], enemyLvl: 3,
    player: player([['l_windblade',2,9,11,{lamp:true}],['l_warden',3,19,22],['d_pharaoh',2,18,17,{copy:'l_warden'}],['v_bear',2,10,13],['l_storm',2,15,17]]), relics: ['r_vanguard','r_rear','r_relay','r_lone'] },
];

const score = (r: Result) => r === 'win' ? 1 : r === 'draw' ? 0.5 : 0;
function run(s: Scenario, mutate: (p: UnitSpec[], relics: string[]) => void) {
  const p = structuredClone(s.player), relics = [...s.relics]; mutate(p, relics);
  const defs = s.enemyDefs ?? authoredEncounters(s.turn, 100).find((x) => x.key === s.enemyKey)?.units.map((u) => u.def);
  if (!defs) throw new Error(`missing ${s.enemyKey}`);
  const enemy = defs.map((def, i) => ({ def, lvl: s.enemyLvl, atk: s.enemyStats[i][0], hp: s.enemyStats[i][1] }));
  const results: Result[] = [];
  for (let seed = 1; seed <= 512; seed++) results.push(simulate(p, enemy, seed, relics).result);
  const totals: Totals = { win: 0, draw: 0, lose: 0, score: 0 };
  for (const r of results) { totals[r]++; totals.score += score(r); }
  totals.score /= results.length;
  return { results, totals };
}
const blank = (index: number) => (p: UnitSpec[]) => { p[index] = { ...p[index], def: 'd_artificer', copy: undefined }; };
const variants = (s: Scenario) => {
  const v: Array<[string, (p: UnitSpec[], r: string[]) => void, string]> = [
    ['blank_windblade', blank(0), '风刃改为同星同身材无战斗技能卡'],
    ['blank_warden', blank(1), '晨光盾卫改为同星同身材无战斗技能卡'],
    ['blank_pharaoh', blank(2), '法老改为同星同身材无战斗技能卡，并去掉copy'],
    ['blank_storm', blank(4), '风暴改为同星同身材无战斗技能卡'],
    ['without_lone', (_p, r) => { const i=r.indexOf('r_lone'); if(i>=0)r.splice(i,1); }, '仅去独狼披风（T13未持有时为无操作对照）'],
    ['without_vanguard', (_p, r) => { const i=r.indexOf('r_vanguard'); if(i>=0)r.splice(i,1); }, '仅去先锋徽章'],
    ['without_rear', (_p, r) => { const i=r.indexOf('r_rear'); if(i>=0)r.splice(i,1); }, '仅去后卫弩'],
    ['without_relay', (_p, r) => { const i=r.indexOf('r_relay'); if(i>=0)r.splice(i,1); }, '仅去车轮战旗'],
    ['without_all_relics', (_p, r) => { r.length=0; }, '去掉全部遗物'],
  ];
  if (s.turn === 19) v.push(['without_front_temp', (p) => { p[0].lamp=undefined;p[0].tfx=undefined; }, '去掉队首魂灯和铁甲片']);
  if (s.turn === 20) v.push(['without_berry_trigger', (p) => { p[1].tfx=undefined; }, '去掉刺莓的开战自伤1；+4血已在面板中，不回退']);
  if (s.turn === 21) v.push(['without_windblade_lamp', (p) => { p[0].lamp=undefined; }, '仅去风刃魂灯，保留已给定攻血']);
  if (s.turn >= 19) v.push(['without_both_blowfish', (p) => { blank(1)(p); blank(2)(p); }, '同时去掉晨光与法老复制的两个受伤反击技能']);
  if (s.turn === 21) {
    v.push(['without_both_blowfish_and_storm', (p) => { blank(1)(p); blank(2)(p); blank(4)(p); }, '同时去掉双反击与风暴技能']);
    v.push(['without_both_blowfish_and_relics', (p, r) => { blank(1)(p); blank(2)(p); r.length=0; }, '同时去掉双反击与全部遗物']);
  }
  if (s.player[4].lvl > 1) v.push(['storm_skill_minus_one', (p) => { p[4].lvl=(p[4].lvl-1) as 1|2; }, '风暴技能降一星，攻血不变']);
  if (s.player[2].lvl > 1) v.push(['pharaoh_skill_minus_one', (p) => { p[2].lvl=(p[2].lvl-1) as 1|2; }, '法老复制技能降一星，攻血不变']);
  return v;
};

const output = scenarios.map((s) => {
  const base = run(s, () => {});
  return { turn:s.turn, name:s.name, enemyKey:s.enemyKey, caveat:'deterministic sensitivity, not original battle replay', baseline:{...base.totals,winRate:base.totals.win/512},
    variants:variants(s).map(([key,fn,note])=>{const x=run(s,fn);let improved=0,worsened=0;for(let i=0;i<512;i++){const d=score(x.results[i])-score(base.results[i]);if(d>0)improved++;if(d<0)worsened++;}return {key,note,totals:{...x.totals,winRate:x.totals.win/512},winRateDelta:(x.totals.win-base.totals.win)/512,scoreDelta:x.totals.score-base.totals.score,paired:{improved,worsened,unchanged:512-improved-worsened}};}) };
});
const dir = new URL('../../output/player-hard-v4-20261026/contribution/', import.meta.url); mkdirSync(dir,{recursive:true});
writeFileSync(new URL('sensitivity.json',dir),JSON.stringify({seeds:'1..512',scenarios:output},null,2)+'\n');
const lines=['第三局高阶卡离线战力消融','', '原战斗随机seed未保存；以下是固定队形在1..512确定seed上的同种子敏感性，不是原局复现。每个变体单独从原始阵容改动，收益不可相加。',''];
for(const s of output){lines.push(`${s.name}  基准 W/D/L=${s.baseline.win}/${s.baseline.draw}/${s.baseline.lose}，纯胜率=${(s.baseline.winRate*100).toFixed(1)}%，平局半分得分率=${(s.baseline.score*100).toFixed(1)}%`);for(const v of s.variants)lines.push(`- ${v.key}: W/D/L=${v.totals.win}/${v.totals.draw}/${v.totals.lose}，纯胜率Δ${(v.winRateDelta*100).toFixed(1)}pp，得分率Δ${(v.scoreDelta*100).toFixed(1)}pp，配对改善/恶化=${v.paired.improved}/${v.paired.worsened}。${v.note}`);lines.push('');}
lines.push('熊在这四场战斗中本来就没有战斗触发；它的价值是备战经济与前序供给，不能用本战斗消融归因。','T20/T21法老已按run.ts回合结束规则固定copy=l_warden；复制技能按法老自身二星结算6伤，不是继承晨光三星的9伤。晨光白板消融不改写已复制技能。','T20刺莓的当前机制是开战自受1伤，不是反伤；已可见的+4血保留在输入面板。');
writeFileSync(new URL('sensitivity.txt',dir),lines.join('\n')+'\n');

function one(s: Scenario, seed: number, mutate: (p: UnitSpec[], relics: string[]) => void) {
  const p=structuredClone(s.player), relics=[...s.relics]; mutate(p,relics);
  const defs=s.enemyDefs ?? authoredEncounters(s.turn,100).find((x)=>x.key===s.enemyKey)!.units.map((u)=>u.def);
  return simulate(p,defs.map((def,i)=>({def,lvl:s.enemyLvl,atk:s.enemyStats[i][0],hp:s.enemyStats[i][1]})),seed,relics);
}
function summarize(out: ReturnType<typeof simulate>) {
  const names=new Map(out.init.map((u)=>[u.uid,`${u.side===0?'我':'敌'}:${u.def}`]));
  const alive=new Set(out.init.map((u)=>u.uid));
  const atk=new Map(out.init.map((u)=>[u.uid,u.atk])), hp=new Map(out.init.map((u)=>[u.uid,u.hp]));
  let clash=0, stormTriggers=0, loneTriggers=0;
  const deaths: Array<{clash:number;units:string[]}> = [];
  for(const e of out.events){
    if(e.t==='clash')clash=e.n;
    else if(e.t==='buff'){atk.set(e.tgt,e.nowAtk);hp.set(e.tgt,e.nowHp);}
    else if(e.t==='dmg')hp.set(e.tgt,e.hp);
    else if(e.t==='heal')hp.set(e.tgt,e.hp);
    else if(e.t==='summon'){names.set(e.unit.uid,`${e.unit.side===0?'我':'敌'}:${e.unit.def}`);alive.add(e.unit.uid);atk.set(e.unit.uid,e.unit.atk);hp.set(e.unit.uid,e.unit.hp);}
    else if(e.t==='die'){alive.delete(e.uid);let phase=deaths.find((x)=>x.clash===clash);if(!phase){phase={clash,units:[]};deaths.push(phase);}phase.units.push(names.get(e.uid)??String(e.uid));}
    else if(e.t==='trigger'){
      const def=out.init.find((u)=>u.uid===e.uid)?.def;
      if(def==='l_storm'&&e.label==='友军受伤')stormTriggers++;
      if(e.label==='独狼')loneTriggers++;
    }
  }
  const storm=out.init.find((u)=>u.side===0&&u.def==='l_storm');
  const rear=out.stats.units.find((u)=>u.kind==='relic'&&u.def==='r_rear');
  return {result:out.result,clashes:out.events.filter((e)=>e.t==='clash').length,storm:{triggers:stormTriggers,finalAtk:storm?atk.get(storm.uid):null,finalHp:storm?hp.get(storm.uid):null,alive:storm?alive.has(storm.uid):false},deaths,rearCrossbowDamage:rear?.damageDealt??0,loneTriggers,survivors:[...alive].map((uid)=>names.get(uid)??String(uid))};
}
const finalScenario=scenarios.find((s)=>s.turn===21)!;
const traces=[];
for(const seed of [1,2,3])traces.push({seed,baseline:summarize(one(finalScenario,seed,()=>{})),withoutBothBlowfish:summarize(one(finalScenario,seed,(p)=>{blank(1)(p);blank(2)(p);}))});
writeFileSync(new URL('trace-summary.json',dir),JSON.stringify({scenario:'T21 final',note:'event summaries from deterministic sensitivity seeds, not original human battle',traces},null,2)+'\n');
const traceLines=['T21 双反击移除事件摘要','', '这是离线敏感性seed 1/2/3，不是原局战斗日志。',''];
for(const t of traces)for(const [label,x] of [['baseline',t.baseline],['withoutBothBlowfish',t.withoutBothBlowfish]] as const)traceLines.push(`seed ${t.seed} ${label}: result=${x.result}, clashes=${x.clashes}, storm=${x.storm.triggers}次 ${x.storm.finalAtk}/${x.storm.finalHp} ${x.storm.alive?'存活':'阵亡'}, rear=${x.rearCrossbowDamage}, lone=${x.loneTriggers}, deaths=${x.deaths.map((d)=>`C${d.clash}[${d.units.join(',')}]`).join(' -> ')}, survivors=${x.survivors.join(',')}`);
writeFileSync(new URL('trace-summary.txt',dir),traceLines.join('\n')+'\n');
console.log('CONTRIBUTION_OK');
