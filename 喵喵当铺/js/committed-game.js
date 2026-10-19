// Keeps legacy view references usable, but only publishes changes after durable commit.
export function publishState(target, source) {
  const items = new Map(), seen = new WeakSet();
  const scan = value => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value); if (typeof value.id === 'string' && Number.isInteger(value.uid)) items.set(value.uid, value);
    Object.values(value).forEach(scan);
  };
  scan(target);
  const published = new WeakMap();
  const merge = (old, next) => {
    if (!next || typeof next !== 'object') return next;
    if (published.has(next)) return published.get(next);
    if (typeof next.id === 'string' && Number.isInteger(next.uid)) {
      // A newly generated seller at the same queue index does not own yesterday's item.
      old = items.get(next.uid);
    }
    const value = Array.isArray(next) ? (Array.isArray(old) ? old : []) : (old && typeof old === 'object' && !Array.isArray(old) ? old : {});
    published.set(next, value);
    if (Array.isArray(next)) {
      const prior = [...value]; value.length = next.length;
      next.forEach((item, index) => { value[index] = merge(prior[index], item); });
    } else {
      for (const key of Object.keys(value)) if (!(key in next)) delete value[key];
      for (const [key, item] of Object.entries(next)) value[key] = merge(value[key], item);
    }
    return value;
  };
  return merge(target, source);
}

function relocate(live, draft) {
  const pairs = new WeakMap();
  const visit = (old, next) => {
    if (!old || typeof old !== 'object' || !next || typeof next !== 'object' || pairs.has(old)) return;
    pairs.set(old, next); for (const key of Object.keys(old)) visit(old[key], next[key]);
  };
  visit(live, draft);
  const map = value => {
    if (!value || typeof value !== 'object') return value;
    if (pairs.has(value)) return pairs.get(value);
    if (Array.isArray(value)) return value.map(map);
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,map(item)]));
  };
  return map;
}

const mutations = new Set(['offerToSeller','checkSpot','buyItem','buyerLooks','askBuyer','sellItem','removeItem','addRep','charm','fenceSell','acceptFine','tryBribe','acceptOrder','deliver','expireOrders','startNight','openCrate','runMachine','collectMachines','buyUpgrade','payRent','graceRent','moveItem','labelWater','unlabel','observe','report','voidFakeCash','toggleWin']);
const resolves = new Set(['buyItem','sellItem','acceptOrder','report']);
export function createCommittedGame(core, session, nested = () => false) {
  const methods = new Map();
  return new Proxy(core, {get(target, name) {
    if (!mutations.has(name)) return target[name];
    if (!methods.has(name)) methods.set(name, (...args) => {
      if (nested() || !core.S?.persistence) return target[name](...args);
      const live = core.S;
      if (resolves.has(name) && core.current()?.resolved) throw new Error('这位客人已完成交易');
      const id = `${live.runId}:${live.day}:${live.qi}:${name}:${live.persistence.revision}`;
      let result;
      const commit = session.transactSync(live, id, draft => {
        const map = relocate(live,draft); core.setState(draft);
        try {
          // Upgrade definitions are immutable authored identities, not live state objects.
          result = target[name](...(name === 'buyUpgrade' ? args : args.map(map)));
          if (resolves.has(name) && result !== false && core.current()) core.current().resolved = true;
          return { value: result };
        } finally { core.setState(live); }
      });
      core.setState(publishState(live, commit.state));
      return result;
    });
    return methods.get(name);
  }});
}
