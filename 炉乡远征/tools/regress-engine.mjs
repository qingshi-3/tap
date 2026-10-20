// Deterministic engine regression: bot-vs-bot on every level × faction with a
// seeded Math.random. Usage: node tools/regress-engine.mjs [out.json] [--compare base.json]
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as engine from '../dist/js/engine.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';
import { FACTIONS } from '../dist/js/factions.js';
import { makeStarterDeck } from '../dist/js/battle-deck.js';

let seed = 1;
Math.random = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
const args = process.argv.slice(2);
const out = args[0] && !args[0].startsWith('--') ? args[0] : null;
const compare = args.includes('--compare') ? args[args.indexOf('--compare') + 1] : null;

function makeMatch(levelId, hero) {
  return engine.createCampaignMatch(levelId, hero, makeStarterDeck(hero));
}
const strip = (s) => { const c = structuredClone(s); delete c.runId; delete c.loadout; delete c.training; delete c.unitGrowth; delete c.squad; delete c.schemaVersion; delete c.contentVersion;
  for (const t of Object.values(c.battleCards ?? {})) for (const card of Object.values(t)) { delete card.campaignRank; delete card.campaignMode; delete card.tactical; }
  for (const u of c.units) { delete u.specialization; delete u.bodyguardUsed; delete u.skirmishUsed; }
  return c; };
// Key order differs between engine generations; hash a canonical form.
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const results = {};
for (const level of EXPEDITION_LEVELS) for (const faction of FACTIONS) {
  const hero = faction.heroIds[0];
  seed = 7 + faction.id * 101;
  let s;
  try { s = makeMatch(level.id, hero); } catch (e) { results[`${level.id}/${faction.id}`] = { error: e.message }; continue; }
  engine.confirmMulligan(s);
  let actions = 0;
  const trail = createHash('sha1');
  while (s.phase !== 'over' && actions++ < 1500) {
    if (!engine.autoAct(s)) break;
    trail.update(JSON.stringify(strip(s).units.map(u => [u.unitId, u.cardId, u.x, u.y, u.health, u.attack])));
  }
  if (process.env.DUMP === `${level.id}/${faction.id}`) writeFileSync(process.env.DUMP_OUT, JSON.stringify(strip(s).units, null, 1));
  results[`${level.id}/${faction.id}`] = { result: s.result, reason: s.resultReason, round: s.round, actions, valid: engine.validateMatch(s), trail: trail.digest('hex').slice(0, 12),
    final: createHash('sha1').update(JSON.stringify(canon(strip(s).units))).digest('hex').slice(0, 12) };
}
if (out) writeFileSync(out, JSON.stringify(results, null, 1));
if (compare) {
  const base = JSON.parse(readFileSync(compare, 'utf8'));
  let diff = 0;
  for (const [k, v] of Object.entries(base)) { const n = results[k]; if (JSON.stringify(n) !== JSON.stringify(v)) { diff++; if (diff <= 15) console.log('DIFF', k, JSON.stringify(v), '->', JSON.stringify(n)); } }
  console.log(`${Object.keys(base).length - diff}/${Object.keys(base).length} identical`);
  process.exitCode = diff ? 1 : 0;
} else {
  const v = Object.values(results);
  console.log(`${v.length} runs, wins ${v.filter(r => r.result === 'win').length}, errors ${v.filter(r => r.error).length}, invalid ${v.filter(r => r.valid === false).length}`);
}
