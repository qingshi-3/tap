// 技能行拆分（kwtext.splitAbilities）：每张商店卡的文案都能拆成「时机 + 效果 + 次数」，卡面主技能存在。
import { SHOP_POOL } from '../src/core/data';
import { splitAbilities } from '../src/qb/kwtext';

const ok = (v: unknown, message: string) => { if (!v) throw new Error(message); };
const text = (c: (typeof SHOP_POOL)[number]) => c.text.replace(/\{v\}/g, String(c.v?.[0] ?? '')).replace(/\{u\}/g, String(c.u?.[0] ?? '')).replace(/\{p\}/g, String(c.pv?.[0] ?? ''));
let rows = 0, triggered = 0;
for (const c of SHOP_POOL) {
  const all = splitAbilities(text(c));
  ok(all.length > 0, `${c.name}: no abilities`);
  ok(all.some(a => !a.boiler), `${c.name}: only archetype boilerplate, card face would be empty`);
  for (const a of all) {
    rows++;
    if (a.trig !== 'passive') triggered++;
    ok(a.body.trim().length > 0, `${c.name}: empty body for ${a.label}`);
    ok(a.label.length <= 16, `${c.name}: trigger label too long: ${a.label}`);
    ok(!/^[，；]/.test(a.body), `${c.name}: body starts with punctuation: ${a.body}`);
    ok(!a.limit || /^每(场|回合)/.test(a.limit), `${c.name}: odd limit ${a.limit}`);
  }
}
// 典型写法
const [entry, rotate] = splitAbilities('成为队首时，身后友军获得1层格挡（每场2次）。攻击后退到队尾。');
ok(entry.label === '成为队首时' && entry.trig === 'enter' && entry.body === '身后友军获得1层格挡' && entry.limit === '每场2次', 'entry ability parsed');
ok(rotate.label === '攻击后' && rotate.boiler && rotate.body === '退到队尾', 'rotation boilerplate parsed');
const [blood] = splitAbilities('献出1点永久生命，获得1金（每回合1次）。');
ok(blood.trig === 'bloodPay' && blood.limit === '每回合1次', 'blood active parsed');
const [summon] = splitAbilities('每2次交锋后，在队首召唤2/2幼兽（每场3次，需空位）。');
ok(summon.label === '每2次交锋后' && summon.limit === '每场3次' && summon.body.endsWith('（需空位）'), 'limit split from note');
console.log(`ability text: ${SHOP_POOL.length} cards, ${rows} rows (${triggered} with a trigger) parsed`);
