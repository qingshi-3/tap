import { demoOutput } from '../src/core/demo';
import { KW_DEMOS, equipDemo, unitDemo } from '../src/core/kwDemos';
import { EQUIPS, SHOP_POOL } from '../src/core/data';
const bad: string[] = [];
for (const [k, s] of Object.entries(KW_DEMOS)) { const r = demoOutput(s); console.log(k, r.at, r.out.events.length); if (r.at < 0) bad.push(k); }
for (const e of EQUIPS) { const s = equipDemo(e.id); if (s) { const r = demoOutput(s); if (r.at < 0) bad.push(e.id); } }
const no = SHOP_POOL.filter(d => !unitDemo(d.id)).map(d => d.name);
console.log('BAD', bad, '\nunits without demo', no.length, no.join(' '));
