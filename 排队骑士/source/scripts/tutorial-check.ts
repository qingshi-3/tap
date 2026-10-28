import { buy, endTurn, equipFromBag, fight, moveOwned, reroll, sell, settleBattle, shownStats, toggleLock, useFood } from '../src/core/run';
import { newTutorialRun, tutorialPositionAllowed, prepareTutorialStep, tutorialStepDone, TUTORIAL_STEPS, TUTORIAL_EQUIP, type TutorialStep } from '../src/core/tutorial';

function check(ok: unknown, label: string): asserts ok { if (!ok) throw new Error(label); }
// 以隔离存储替身覆盖整个教程流程；正式存档不得被读取、覆盖或移除。
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let storageCalls = 0;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem() { storageCalls++; return 'existing-player-save'; },
  setItem() { storageCalls++; },
  removeItem() { storageCalls++; },
  clear() { storageCalls++; },
} });
const r = newTutorialRun();
const sid = (def: string) => { const s = r.shop.find((s) => s.def === def); check(s, `missing ${def}`); return s.sid; };
function done(step: TutorialStep) { check(tutorialStepDone(r, step), `step ${step} did not finish`); }
for (const step of TUTORIAL_STEPS) {
  prepareTutorialStep(r, step);
  const preparedSnapshot = JSON.stringify(r);
  prepareTutorialStep(r, step);
  check(JSON.stringify(r) === preparedSnapshot, `${step}: repeated prepare changed state`);
  switch (step) {
    case 'buy': case 'merge': case 'star': check(buy(r, sid('a_imp'), 0).ok, step); break;
    case 'lock': toggleLock(r, sid('f_bread')); break;
    case 'reroll': {
      const locked = sid('f_bread');
      check(reroll(r), 'reroll');
      check(r.shop.some((s) => s.sid === locked && s.locked), 'reroll lost locked bread');
      check(r.gold === 0, 'round one must use the ordinary 10 gold budget');
      break;
    }
    case 'ally': check(r.gold === 10, 'ordinary second-round budget'); check(buy(r, sid('a_spine'), 1).ok, 'ally'); break;
    case 'food': check(useFood(r, sid('f_bread'), 0).ok, 'food'); break;
    case 'position': {
      for (const [from, to] of [[0, 1], [1, 0]]) {
        const branch = structuredClone(r);
        check(tutorialPositionAllowed(from, to), `position permission ${from}->${to}`);
        check(moveOwned(branch, from, to), `position move ${from}->${to}`);
        check(tutorialStepDone(branch, 'position'), `position completion ${from}->${to}`);
        check(branch.queue.filter(Boolean).length === 2, 'swap must preserve both units');
      }
      for (const [from, to] of [[0, 0], [1, 1], [0, 2], [2, 0], [1, 4]]) check(!tutorialPositionAllowed(from, to), 'unrelated move blocked');
      check(moveOwned(r, 1, 0), 'position reverse direction'); break;
    }
    case 'equip': {
      const before = shownStats(r.queue[0]!)[1];
      check(equipFromBag(r, r.bag.indexOf(TUTORIAL_EQUIP), 0), 'equip');
      check(shownStats(r.queue[0]!)[1] === before + 5, 'mail must add actual combat health');
      break;
    }
    case 'battle1': case 'battle2': {
      endTurn(r);
      const out = fight(r);
      check(out.result === 'win', `${step}: ${out.result}`);
      check(out.events.some((e) => e.t === 'summon'), 'real death/summon combat must occur');
      if (step === 'battle1') {
        const imp = out.init.find((u) => u.side === 0 && u.def === 'a_imp');
        check(imp, 'player imp must enter the first battle');
        check(out.events.some((e) => e.t === 'die' && e.uid === imp.uid), 'player imp must actually die');
        check(out.events.some((e) => e.t === 'summon' && e.src === imp.uid && e.unit.side === 0 && e.unit.def === 't_wisp' && e.unit.atk === 3 && e.unit.hp === 3), 'two-star imp must summon its own 3/3 soul flame');
      }
      settleBattle(r, out);
      break;
    }
  }
  done(step);
}
check(r.history.length === 2 && r.wins === 2 && r.lives === 5, 'two real battles finish');
// 出售走真实回收规则，并在测试副本验证，不破坏教学阵容。
const copy = structuredClone(r);
const oldGold = copy.gold;
check(sell(copy, 0)?.gold === 1 && copy.gold === oldGold + 1 && copy.bag.includes(TUTORIAL_EQUIP), 'selling refunds gold and returns equipment');
check(storageCalls === 0, 'tutorial must not access the formal player save');
if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
else Reflect.deleteProperty(globalThis, 'localStorage');
console.log('Tutorial check passed: 10-gold economy, 3-copy upgrade, own 3/3 soul flame, lock/reroll, food, positioning, equipment, two real wins, sell recovery, idempotent preparation, untouched player save.');
