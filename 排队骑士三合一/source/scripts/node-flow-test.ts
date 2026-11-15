// 非战斗节点的离开流程：事件只能结算一次（篝火在领奖未完成时不能重开）
import { activeCardPool, leaveNode, newRun, passNode, pickNode, resolveEvent, type RunState } from '../src/core/run';

const ok = (value: unknown, label: string) => { if (!value) throw new Error(label); };
const r: RunState = newRun(4242);
r.map[0] = [{ k: 'camp', next: [0] }];
const unit = activeCardPool(r).find(c => c.tier === 1)!;
r.queue[0] = { oid: r.nextId++, def: unit.id, copies: 1, atkBonus: 0, hpBonus: 0 };
ok(pickNode(r, 0), 'camp node can be picked');
leaveNode(r);
ok(r.leaving && r.event === 'fire', 'leaving a camp opens the campfire');
ok(resolveEvent(r, 1, 0).ok && r.event === null, 'campfire resolves once');
const hp = r.queue[0]!.hpBonus;
// 领奖未完成时 passNode 不能走；此时再调用 leaveNode 不能重新打开篝火
r.discover = [{ opts: [unit.id], src: 'test', mode: 'gain', price: 0 }];
passNode(r);
ok(r.leaving && r.layer === 0, 'pending discover blocks leaving the node');
// 领完奖（bot 和存档恢复都可能这样走）后再调用 leaveNode，不能重新打开篝火
r.discover = [];
leaveNode(r);
ok(r.event === null, 'leaveNode does not reopen a resolved campfire');
ok(!resolveEvent(r, 1, 0).ok && r.queue[0]!.hpBonus === hp, 'campfire cannot be resolved a second time');
passNode(r);
ok(!r.leaving && r.layer === 1, 'after rewards the node is passed normally');
console.log('node flow: campfire resolves once, pending rewards block passing, no re-entry');
