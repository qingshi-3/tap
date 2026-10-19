// Isolated test fixture only. No production module imports this file.
export function makeScenario(G, scenario = 'night-production-mixed-waters') {
  let seed = 74123;
  const original = Math.random;
  Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  try {
    const s = G.newRun();
    Object.assign(s, { day: 5, money: 840, tutorial: true, shelfCap: 18, filter: 10 });
    s.up = { purifier: true, brewery: true, tank: true, lens: true };
    s.owned = { furnace: true, purifier: true, brewery: true, tank: true };
    s.machines = { furnace: null, purifier: null, brewery: null, tank: null };
    s.shelf = [];
    const add = (id, o = {}) => { const it = G.mkItem(id, { q: 1, ...o }); s.shelf.push(it); return it; };
    for (const g of [0, 1, 2, 3, 4, 5]) add('water', { g, gk: true });
    add('water', { g: 1, lab: 4, gk: false });
    for (let i = 0; i < 6; i++) add('scrap');
    for (let i = 0; i < 4; i++) add('catnip');
    add('scrap', { fake: true, known: true });
    G.startNight();
    if (scenario === 'empty-filter') s.filter = 0;
    if (scenario === 'unknown-water') {
      s.shelf = [G.mkItem('water', { g: 2, lab: 4, gk: false }), G.mkItem('water', { g: 4, gk: true })];
    }
    if (scenario === 'ice-buyer') {
      s.phase = 'day'; s.up.fridge = true;
      s.shelf = [G.mkItem('water', { g: 4, gk: true, q: 1 })];
      s.queue = [{ kind: 'buy', who: 'worker', want: 'drink', rich: 1.2, eye: 1, pat: 3 }]; s.qi = 0;
    }
    if (scenario === 'rent-paid') { s.day = 15; s.money = 1000; s.phase = 'day'; s.rentDone = false; G.payRent(); s.rentDone = true; G.startNight(); }
    if (scenario === 'order-mixed-waters' || scenario === 'order-selected-buyer') s.orders = [{ id: 'water', qty: 2, due: 8, reward: 120 }];
    if (scenario === 'order-selected-buyer') {
      s.phase = 'day'; s.queue = [{ kind: 'buy', who: 'worker', want: 'drink', rich: 1.2, eye: 1, pat: 3 }]; s.qi = 0;
    }
    if (scenario === 'daytime-negotiation' || scenario === 'fake-and-real') {
      s.phase = 'day';
      const seller = (fake, robo) => ({ kind: 'sell', who: 'trader', item: G.mkItem('watch', { fake, q: 1 }), ask: 160, ask0: 160, res: 100, pat: 5, checks: [null, null, null], bad: fake ? 1 : -1, ...(robo ? { robo: true, roboBad: 2, obs: [null, null, null] } : {}) });
      s.shelf = s.shelf.slice(0, 6);
      s.queue = [seller(true, true), seller(false, false), { kind: 'buy', who: 'worker', want: 'drink', rich: 1.2, eye: 1, pat: 5 }];
      // Select a genuine visitor with the same public suspicious cue, to check that
      // the cue itself does not certify a fake. Only fixture state is searched.
      if (typeof G.observationClue === 'function') {
        s.qi = 1;
        for (let i = 0; i < 30 && !G.observationClue(s.queue[1]); i++) s.queue[1].item = G.mkItem('watch', { fake: false, q: 1 });
      }
      s.qi = 0;
    }
    if (scenario === 'legacycontinue') {
      s.phase = 'day'; s.queue = [{ kind: 'sell', who: 'granny', item: G.mkItem('yarn', { q: 1 }), ask: 30, ask0: 30, res: 14, pat: 3, checks: [null, null, null], bad: -1 }]; s.qi = 0;
      s.machines.furnace = { left: 1, n: 1 };
      s.shelf = s.shelf.slice(0, 5);
    }
    if (['patience-seller', 'patience-lens', 'patience-exhausted', 'patience-buyer'].includes(scenario)) {
      s.phase = 'day'; s.day = 3; s.up.lens = scenario === 'patience-lens';
      s.shelf = []; s.mkt.drink = 1;
      const seller = (who = 'trader') => ({ kind: 'sell', who, item: G.mkItem('watch', { fake: false, q: 1 }), ask: 160, ask0: 160, res: 100, pat: 3, checks: [null, null, null], bad: -1 });
      s.queue = [seller(), seller('granny')]; s.qi = 0;
      if (scenario === 'patience-exhausted') s.queue[0].pat = 0;
      if (scenario === 'patience-buyer') {
        s.shelf = [G.mkItem('water', { g: 3, gk: true, q: 1 })];
        s.queue[0] = { kind: 'buy', who: 'worker', want: 'drink', rich: 1.2, eye: 1, pat: 3 };
      }
    }
    if (scenario === 'workshop-insufficient' || scenario === 'workshop-available') {
      s.shelf = []; s.filter = scenario === 'workshop-available' ? 10 : 0;
      for (let i = 0; i < (scenario === 'workshop-available' ? 3 : 2); i++) add('scrap');
      add('water', { g: 2, gk: true });
    }
    if (scenario === 'ui-crowded-seller') {
      s.phase = 'day'; s.day = 2; s.money = 83; s.shelfCap = 6; s.up.lens = false;
      s.shelf = s.shelf.slice(0, 6); s.win = s.shelf.slice(0, 2).map(it => it.uid);
      s.queue = [{ kind: 'sell', who: 'gent', item: G.mkItem('holo', { q: 1, fake: false }), ask: 198, ask0: 198, res: 125, pat: 3, checks: [null, null, null], bad: -1 }]; s.qi = 0;
    }
    return JSON.parse(JSON.stringify(s));
  } finally { Math.random = original; }
}

