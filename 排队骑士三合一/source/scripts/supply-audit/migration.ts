// 补给存档迁移回归：只操作内存 localStorage，不写构建产物。
import {
  FOOD_SHOP_MAX,
  PRE_SUPPLY_BACKUP_KEY,
  SAVE_KEY,
  SUPPLY_VERSION,
  load,
  newRun,
  type RunState,
  type ShopItem,
} from '../../src/core/run';

type Check = { id: string; ok: boolean; observed?: unknown };
const checks: Check[] = [];
class StorageMock {
  private data = new Map<string, string>();
  failBackup = false;
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) {
    if (this.failBackup && k === PRE_SUPPLY_BACKUP_KEY) throw new Error('quota');
    this.data.set(k, String(v));
  }
  removeItem(k: string) { this.data.delete(k); }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
}
const storage = new StorageMock();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

const item = (sid: number, def = 'f_bread', locked = false): ShopItem => ({ sid, kind: 'food', def, locked, free: def === 'f_milk', ...(def === 'f_milk' ? { val: [2, 2] as [number, number] } : {}) });
function state(foods: ShopItem[], legacy = true) {
  const r = newRun(314159);
  r.turn = 5; // 普通补给位 2
  r.shop = foods;
  r.nextId = 100;
  if (legacy) delete r.supplyVersion;
  return r;
}
function put(r: RunState) {
  storage.clear();
  const raw = JSON.stringify(r);
  storage.setItem(SAVE_KEY, raw);
  return raw;
}
function check(id: string, run: () => boolean, observed?: () => unknown) {
  let ok = false;
  try { ok = run(); } catch { ok = false; }
  checks.push({ id, ok, ...(ok || !observed ? {} : { observed: observed() }) });
}

check('legacy.normal', () => {
  const raw = put(state([item(1), item(2)]));
  const r = load();
  return !!r && r.supplyVersion === SUPPLY_VERSION && r.shop.length === 2
    && storage.getItem(PRE_SUPPLY_BACKUP_KEY) === raw && storage.getItem(SAVE_KEY) === raw;
});

for (const n of [5, 6]) check(`legacy.${n}-foods`, () => {
  const raw = put(state(Array.from({ length: n }, (_, i) => item(i + 1))));
  const r = load();
  return !!r && r.shop.map((s) => s.sid).join(',') === '1,2'
    && storage.getItem(PRE_SUPPLY_BACKUP_KEY) === raw && storage.getItem(SAVE_KEY) === raw;
});

check('legacy.locked-first-stable-order', () => {
  put(state([item(1), item(2, 'f_whet', true), item(3), item(4, 'f_roast', true), item(5)]));
  return load()?.shop.map((s) => s.sid).join(',') === '2,4';
});

check('legacy.keep-two-milk-specs', () => {
  const a = item(20, 'f_milk'); a.val = [1, 2]; a.locked = true;
  const b = item(21, 'f_milk'); b.val = [3, 3];
  put(state([item(1), item(2), item(3), item(4), item(5), a, b]));
  const r = load();
  const milk = r?.shop.filter((s) => s.def === 'f_milk') ?? [];
  return !!r && milk.map((s) => `${s.sid}:${s.val?.join('/')}`).join(',') === '20:1/2,21:3/3'
    && milk.every((s) => !s.locked);
});

check('legacy.keep-existing-backup', () => {
  const raw = put(state([item(1), item(2), item(3), item(4), item(5)]));
  storage.setItem(PRE_SUPPLY_BACKUP_KEY, 'older-backup');
  const r = load();
  return !!r && storage.getItem(PRE_SUPPLY_BACKUP_KEY) === 'older-backup' && storage.getItem(SAVE_KEY) === raw;
});

check('current.reject-over-cap', () => {
  const raw = put(state(Array.from({ length: FOOD_SHOP_MAX + 1 }, (_, i) => item(i + 1)), false));
  return load() === null && storage.getItem(PRE_SUPPLY_BACKUP_KEY) === null && storage.getItem(SAVE_KEY) === raw;
});

check('legacy.invalid-history-still-rejected', () => {
  const r = state([item(1), item(2)]);
  r.queue[0] = { oid: 90, def: 'v_guard', copies: 1, atkBonus: 0, hpBonus: 0,
    foodHistory: [{ id: 'f_bomb', atk: 99, hp: 99, sourceId: 1 }] };
  const raw = put(r);
  return load() === null && storage.getItem(SAVE_KEY) === raw;
});

check('backup-failure-keeps-original', () => {
  const raw = put(state(Array.from({ length: 5 }, (_, i) => item(i + 1))));
  storage.failBackup = true;
  const r = load();
  storage.failBackup = false;
  return r === null && storage.getItem(PRE_SUPPLY_BACKUP_KEY) === null && storage.getItem(SAVE_KEY) === raw;
});

const failed = checks.filter((x) => !x.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.id}`, c.observed ?? '');
if (failed.length) throw new Error(`${failed.length} migration checks failed`);
