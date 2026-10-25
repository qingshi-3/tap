import { card } from './data';
import { endTurn, sell, playerTeam, type Owned, type RunState, type ShopFx } from './run';

export interface GrowthPreview {
  oid: number; def: string; slot: number;
  before: [number, number]; after: [number, number];
  capped: boolean; copy?: string; bank: number; effects: ShopFx[];
}

/** 在副本上走同一条规则路径；预览不会消耗金币、随机种子或成长。 */
function changes(before: RunState, after: RunState, fx: ShopFx[]): GrowthPreview[] {
  return after.queue.flatMap((o, slot) => {
    if (!o) return [];
    const old = before.queue.find((x) => x?.oid === o.oid)!;
    const stats = (x: Owned): [number, number] => {
      const s = playerTeam({ queue: [x] })[0];
      return [s.atk, s.hp];
    };
    const a = stats(old), b = stats(o);
    return [{ oid: o.oid, def: o.def, slot, before: a, after: b,
      capped: b[0] >= 50 || b[1] >= 50,
      copy: card(o.def).ab === 'parrot' ? o.copy : undefined,
      bank: (o.bank ?? 0) - (old.bank ?? 0),
      effects: fx.filter((f) => f.kind === 'buff' ? f.tgt === o.oid : f.src === o.oid),
    }];
  });
}

export function previewEndTurn(r: RunState) {
  const copy = structuredClone(r);
  const fx = endTurn(copy);
  return changes(r, copy, fx);
}

export function previewInheritance(r: RunState, slot: number) {
  const source = r.queue[slot];
  if (!source || !card(source.def).inherit || !source.foodHistory?.length) return null;
  const receiver = r.queue.slice(slot + 1).find((o): o is Owned => !!o)
    ?? r.queue.slice(0, slot).reverse().find((o): o is Owned => !!o);
  if (!receiver) return { receiver: null, foods: source.foodHistory, changes: [] };
  const copy = structuredClone(r);
  const result = sell(copy, slot)!;
  return { receiver, foods: source.foodHistory, changes: changes(r, copy, result.fx) };
}
