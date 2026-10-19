import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ExpeditionProgress,normalizeExpeditionState,validateExpeditionState} from '../dist/js/expedition-progress.js';
import {starterInventory,validatePlayerDeck,PLAYER_DECK_SIZE} from '../dist/js/battle-deck.js';
import {FACTIONS} from '../dist/js/factions.js';
import {unlockedInventory} from '../dist/js/campaign-rules.js';
import {createExpeditionMatch,validateMatch,restoreMatch,confirmMulligan,autoAct,endTurn} from '../dist/js/engine.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
const KEY=SAVE_KEYS.expedition,copy=structuredClone;
class Storage{data=new Map();failKey=null;after=false;getItem(k){return this.data.get(k)??null;}removeItem(k){this.data.delete(k);}setItem(k,v){if(this.failKey===k)throw Error('write failure');this.data.set(k,String(v));if(this.after&&k===KEY){this.after=false;throw Error('after-write');}}}
function load(storage){const p=new ExpeditionProgress(storage);assert.equal(p.error,'');return p;}
function assertDecks(state){assert.equal(state.schemaVersion,13);assert.equal(Object.keys(state.factionDecks).length,6);for(const f of FACTIONS){assert.equal(state.factionDecks[f.id].length,PLAYER_DECK_SIZE);assert.ok(validatePlayerDeck(state.factionDecks[f.id],f.heroIds[0],state.inventory));}for(const kind of ['units','spells'])for(const id of starterInventory()[kind])assert.ok(state.inventory[kind].includes(id));}
const fresh=load(new Storage());assertDecks(fresh.state);assert.equal(Object.hasOwn(fresh.getLoadout(),'deck'),false);
for(const f of FACTIONS)for(const hero of f.heroIds){assert.ok(fresh.selectHero(hero).ok);assert.ok(validatePlayerDeck(fresh.getBattleLoadout().deck,hero,fresh.state.inventory));const local=fresh.getBattleLoadout();local.deck.pop();assert.equal(fresh.getBattleLoadout().deck.length,30);}
const fixtures=JSON.parse(await readFile(new URL('./fixtures/save-contract-0.1.9.json',import.meta.url)));
const fixture021=JSON.parse(await readFile(new URL('./fixtures/save-contract-0.2.1.json',import.meta.url)));
const old56=[5,6].map(version=>{
 const profile=copy(fixture021.profile);profile.schemaVersion=version;delete profile.factionDecks;profile.inventory=copy(fixture021.profile.inventory);profile.completed=['border-01','border-02'];profile.coins=543;profile.training[14]=2;
 profile.inventory.units.push(19037);profile.inventory.spells.push(20044);profile.factionSpells[1]=[20044,20174];
 profile.settlements['old-run']={levelId:'border-01',amount:111,firstClear:true};profile.rewardClaims['old-run']={status:'pending',requestId:'old-coin-ad',levelId:'border-01',amount:27};
 profile.activeBattle=createExpeditionMatch('border-01',profile.training,profile.squad,1,version===5?{spells:profile.factionSpells[1],spellTraining:profile.spellTraining,spellModes:profile.spellModes,specializations:profile.specializations}:null);
 if(version===5)delete profile.recruitment;else profile.recruitment={tickets:13,fragments:{19037:9,99999:4},victoryClaims:{'old-run':3},adClaims:{'old-run':{status:'pending',requestId:'old-orb-ad',amount:2,requestIds:['cancelled-orb-ad','old-orb-ad']}}};
 return profile;
});
for(const source of [...fixtures.profiles,...old56]){
 const storage=new Storage(),raw=` ${JSON.stringify(source)}\n`;storage.setItem(KEY,raw);let p=load(storage);assertDecks(p.state);assert.equal(storage.getItem(`${KEY}.legacy-v${source.schemaVersion}-backup`),raw);
 for(const [key,value] of Object.entries(source)){if(['schemaVersion','inventory','recruitment','spellModes','spellTraining','specializations'].includes(key)){if(key==='recruitment')for(const oldKey of ['tickets','fragments','victoryClaims','adClaims'])assert.deepEqual(p.state.recruitment[oldKey],oldKey==='fragments'?Object.fromEntries(Object.entries(value[oldKey]).map(([id,n])=>[id,Math.ceil(n*30/12)])):value[oldKey]);if(['spellModes','spellTraining','specializations'].includes(key))for(const [id,n] of Object.entries(value))assert.equal(p.state[key][id],n);continue;}if(key==='training'){for(const [id,rank] of Object.entries(value))assert.equal(p.state.training[id],rank,'historical rank preserved');for(const [id,rank] of Object.entries(p.state.training))if(!Object.hasOwn(value,id))assert.equal(rank,0,'new roster starts untrained');continue;}assert.deepEqual(p.state[key],value,'preserved '+source.schemaVersion+' '+key);}
 for(const kind of ['units','spells'])for(const id of source.inventory?.[kind]??[])assert.ok(p.state.inventory[kind].includes(id),'never revoke '+id);
 const deck=p.getBattleLoadout().deck;assert.ok(p.setBattleDeck([...deck].reverse()).ok);p=load(storage);assert.ok(p.setBattleDeck(deck).ok);p=load(storage);assert.deepEqual(p.getBattleLoadout().deck,deck);assert.deepEqual(p.state.activeBattle,source.activeBattle);
 for(const failKey of [KEY,`${KEY}.legacy-v${source.schemaVersion}-backup`]){const failed=new Storage();failed.setItem(KEY,raw);failed.failKey=failKey;const q=new ExpeditionProgress(failed);assert.ok(q.error);assert.equal(q.setBattleDeck(deck).ok,false);assert.equal(failed.getItem(KEY),raw);}
}
{
 const storage=new Storage();let p=load(storage);assert.ok(p.selectHero(1).ok);const before=p.state;
 const deck=p.getBattleLoadout().deck;
 for(const bad of [deck.slice(1),[...deck,9],Array(30).fill(9),deck.map((id,i)=>i===0?110:id),deck.map((id,i)=>i===0?17:id),deck.map((id,i)=>i===0?9.5:id),deck.map((id,i)=>i===0?1:id)]){assert.equal(p.setBattleDeck(bad).ok,false);assert.deepEqual(p.state,before);assert.equal(storage.getItem(KEY),JSON.stringify(before));}
 storage.after=true;assert.equal(p.setBattleDeck([...deck].reverse()).ok,false);assert.deepEqual(p.state,before);assert.equal(storage.getItem(KEY),JSON.stringify(before));
 assert.ok(p.setBattleDeck([...deck].reverse()).ok);p=load(storage);assert.deepEqual(p.getBattleLoadout().deck,[...deck].reverse());
 let match=createExpeditionMatch('border-01',p.state.training,p.state.squad,1,p.getBattleLoadout());assert.equal(match.schemaVersion,7);assert.ok(validateMatch(match));assert.ok(p.saveBattle(match).ok);p=load(storage);
 match=restoreMatch(p.state.activeBattle);assert.ok(match);assert.ok(confirmMulligan(match));assert.ok(autoAct(match,match.currentPlayer));assert.ok(validateMatch(match));assert.ok(p.saveBattle(match).ok);p=load(storage);
 const saved=copy(p.state.activeBattle);match=restoreMatch(copy(saved));assert.ok(endTurn(match,match.currentPlayer,true));assert.ok(p.saveBattle(match).ok);p=load(storage);assert.deepEqual(p.state.activeBattle,match);assert.notEqual(JSON.stringify(saved),JSON.stringify(match),'second resumed action changes saved battle');
}
for(const modify of [s=>s.schemaVersion=99,s=>delete s.factionDecks,s=>s.factionDecks[1].pop(),s=>s.factionDecks[1]=Array(30).fill(9),s=>s.recruitment.tickets=-1,s=>s.inventory=null]){const state=load(new Storage()).state;modify(state);assert.equal(normalizeExpeditionState(state),null);assert.equal(validateExpeditionState(state),false);const storage=new Storage(),raw=JSON.stringify(state);storage.setItem(KEY,raw);const p=new ExpeditionProgress(storage);assert.ok(p.error);assert.equal(p.train(14).ok,false);assert.equal(storage.getItem(KEY),raw);}
for(const source of old56){const bad=copy(source);bad.factionDecks={};assert.equal(normalizeExpeditionState(bad),null,'old exact field contract stays frozen');}
{
 const storage=new Storage();storage.setItem(KEY,JSON.stringify(old56[1]));let p=load(storage);
 assert.equal(p.completeReward('old-run','old-coin-ad').ok,false);assert.equal(p.state.coins,543);
 assert.equal(p.completeRecruitmentAd('old-run','old-orb-ad').ok,false);assert.equal(p.state.recruitment.tickets,13);
 const before=p.state;assert.ok(p.beginDailyAd('gold','new-coin').ok);assert.ok(p.beginDailyAd('orb','new-orb').ok);const coin=p.completeDailyAd('gold','new-coin'),orb=p.completeDailyAd('orb','new-orb');assert.ok(coin.ok&&orb.ok);assert.equal(p.state.coins,before.coins+coin.amount);assert.equal(p.state.recruitment.tickets,before.recruitment.tickets+orb.amount);
 p=load(storage);const raw=storage.getItem(KEY);assert.ok(p.completeDailyAd('orb','new-orb').duplicate);assert.ok(p.completeDailyAd('gold','new-coin').duplicate);assert.equal(storage.getItem(KEY),raw);assert.deepEqual(p.state.rewardClaims,before.rewardClaims);assert.deepEqual(p.state.recruitment.adClaims,before.recruitment.adClaims);

}

console.log('draw profile checks passed: schema1–6 exact migration and backups, starter grant without revocation, six30-card decks, recruitment/battle preservation, failures, schema6 actual actions across two saves/reloads');
