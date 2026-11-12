import { card } from '../src/core/data';
import { ARCHETYPE_BRIDGES, BATTLE_ARCHETYPES, PREP_ARCHETYPES, cardAvailable } from '../src/core/archetypePool';
import { buy, endTurn, equipFromBag, fight, isHeldSpell, moveOwned, pickDiscover, reroll, sell, settleBattle, shownStats, toggleLock, useFood } from '../src/core/run';
import { newTutorialRun, tutorialPositionAllowed, prepareTutorialStep, tutorialStepDone, TUTORIAL_STEPS, TUTORIAL_EQUIP, TUTORIAL_UNIT, TUTORIAL_ALLY } from '../src/core/tutorial';

function check(ok: unknown, label: string): asserts ok { if (!ok) throw new Error(label); }
// 临时教学与跳过操作均不得读写正式存档。UI 的跳过只 dispose 并返回标题。
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let storageCalls = 0;
Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{
  getItem() { storageCalls++; return 'existing-player-save'; },
  setItem() { storageCalls++; }, removeItem() { storageCalls++; }, clear() { storageCalls++; },
} });
try {
  const r = newTutorialRun();
  check(r.activeArchetypes.length === 6 && new Set(r.activeArchetypes).size === 6 && r.activeArchetypes.includes('supply'), 'six unique tutorial archetypes include supply');
  check(PREP_ARCHETYPES.filter(a => r.activeArchetypes.includes(a)).length >= 2, 'tutorial includes prep choices');
  check(BATTLE_ARCHETYPES.filter(a => r.activeArchetypes.includes(a)).length >= 2, 'tutorial includes battle choices');
  check(ARCHETYPE_BRIDGES.filter(pair => pair.every(a => r.activeArchetypes.includes(a))).length >= 2, 'tutorial includes two bridges');
  const legal = () => {
    for (const s of r.shop) if (s.kind === 'unit') check(cardAvailable(r,card(s.def)), `unavailable tutorial shelf ${s.def}`);
    for (const o of [...r.queue,...r.hand]) if(o && !isHeldSpell(o)) check(cardAvailable(r,card(o.def)), `unavailable tutorial unit ${o.def}`);
    for (const d of r.discover ?? []) for (const id of d.opts) check(cardAvailable(r,card(id)), `unavailable tutorial discovery ${id}`);
  };
  const sid = (def:string) => { const item=r.shop.find(s=>s.def===def); check(item,`missing ${def}`); return item.sid; };
  for (const step of TUTORIAL_STEPS) {
    prepareTutorialStep(r,step);
    const snapshot=JSON.stringify(r);
    prepareTutorialStep(r,step);
    check(JSON.stringify(r)===snapshot,`${step}: preparation must be idempotent`);
    legal();
    switch(step) {
      case 'buy': case 'merge': case 'star': {
        const result=buy(r,sid(TUTORIAL_UNIT),0);
        check(result.ok,`${step}: new catalog purchase must succeed`);
        if(step==='star') {
          check(result.levelUp,'third copy must become gold');
          check(r.discover?.length===1,'gold upgrade must open real discovery');
          check(pickDiscover(r,0),'claim discovery into hand');
          check(r.hand.some(Boolean) && !r.discover?.length && !r.rewards?.length,'upgrade reward must be resolved before battle');
        }
        break;
      }
      case 'lock': toggleLock(r,sid('f_bread')); break;
      case 'reroll': {
        const locked=sid('f_bread');
        check(reroll(r),'ordinary paid reroll');
        check(r.shop.some(s=>s.sid===locked && s.locked),'reroll preserves locked bread');
        check(r.gold===0,'first round spends ordinary 10 gold');
        break;
      }
      case 'ally': check(r.gold===10 && r.tavern===2,'second lesson supplies 10 gold and tier two shelf'); check(buy(r,sid(TUTORIAL_ALLY),1).ok,'buy shield teammate'); break;
      case 'food': check(useFood(r,sid('f_bread'),0).ok,'feed retained bread'); break;
      case 'position': {
        for(const [from,to] of [[0,1],[1,0]]) {
          const branch=structuredClone(r);
          check(tutorialPositionAllowed(from,to),`allow swap ${from}->${to}`);
          check(moveOwned(branch,from,to),`swap ${from}->${to}`);
          check(tutorialStepDone(branch,'position'),'shield front / sling rear satisfies position lesson');
          check(branch.queue.filter(Boolean).length===2,'swap preserves both teammates');
        }
        for(const [from,to] of [[0,0],[1,1],[0,2],[2,0],[1,4]]) check(!tutorialPositionAllowed(from,to),'unrelated swap remains blocked');
        check(moveOwned(r,1,0),'move shield to front');
        break;
      }
      case 'equip': {
        const before=shownStats(r.queue[0]!)[1];
        check(equipFromBag(r,r.bag.indexOf(TUTORIAL_EQUIP),0),'equip front shield');
        check(shownStats(r.queue[0]!)[1]===before+5,'mail adds real combat health');
        break;
      }
      case 'battle1': case 'battle2': {
        check(!r.discover?.length && !r.rewards?.length,'lesson resolves rewards before fight');
        endTurn(r);
        check(r.endTurnCommitted,'battle commits the real prep turn');
        const out=fight(r);
        check(out.result==='win',`${step}: expected teaching win, got ${out.result}`);
        check(out.events.some(e=>e.t==='clash'),'lesson includes actual queue combat');
        if(step==='battle2') {
          const sling=out.init.find(u=>u.side===0 && u.def===TUTORIAL_UNIT), shield=out.init.find(u=>u.side===0 && u.def===TUTORIAL_ALLY);
          check(sling && shield,'both new-catalog teammates enter battle');
          const charged=out.events.findIndex(e=>e.t==='counter' && e.uid===sling.uid && e.charge>0);
          const shieldDies=out.events.findIndex(e=>e.t==='die' && e.uid===shield.uid);
          const released=out.events.findIndex((e,i)=>i>charged && e.t==='counter' && e.uid===sling.uid && e.charge===0);
          check(charged>=0 && shieldDies>charged && released>shieldDies,'rear sling charges under shield protection and empties energy on entry');
          check(out.events.slice(released).some(e=>e.t==='dmg' && e.src===sling.uid && e.kind==='shot' && e.n>0),'entry release deals real shot damage');
        }
        settleBattle(r,out);
        check(!r.relicPick && !r.firstRelicPending,'tutorial omits unrelated relic modal');
        break;
      }
    }
    check(tutorialStepDone(r,step),`${step}: lesson did not complete`);
    legal();
  }
  check(r.history.length===2 && r.wins===2 && r.lives===5,'two real teaching victories');
  const copy=structuredClone(r), oldGold=copy.gold;
  check(sell(copy,0)?.gold===1 && copy.gold===oldGold+1 && copy.bag.includes(TUTORIAL_EQUIP),'real sale refunds gold and returns mail');
  // 跳过任意临时教学只会丢弃该临时对象，不影响下一个正常开局。
  for(const step of TUTORIAL_STEPS) { const abandoned=newTutorialRun(); prepareTutorialStep(abandoned,step); }
  check(storageCalls===0,'temporary lessons must not access the formal player save');
  console.log('Tutorial check passed: legal six-archetype catalog, real buys and gold upgrade/discovery, lock/reroll, food, either-direction swap, equipment, two real wins, rear charging and entry shot, sale recovery, idempotent preparation, untouched player save.');
} finally {
  if(previousStorage) Object.defineProperty(globalThis,'localStorage',previousStorage);
  else Reflect.deleteProperty(globalThis,'localStorage');
}
