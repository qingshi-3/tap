// Real engine rehearsals in disposable memory. Results are tuning signals.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { RoguelikeSession } from '../dist/js/roguelike-session.js';
import { ROGUELIKE_HEROES, CAMP_COSTS } from '../dist/js/roguelike-data.js';
import { getCard } from '../dist/js/cards.js';
import { autoAct, confirmMulligan, findGeneral, validateMatch } from '../dist/js/engine.js';

const seeds = (process.env.ROGUE_SEEDS || '11,29').split(',').map(Number);
const heroIds = (process.env.ROGUE_HEROES || '23,123,301').split(',').map(Number);
const output = new URL('../output/roguelike/', import.meta.url);
await mkdir(output, { recursive: true });
const results = [];
const scoreCard = id => {
  const card = getCard(id);
  if (card.type === 'spell') return 2 / Math.max(1, card.cost);
  return (card.attack + card.health + (card.ranged ? 4 : 0) + (card.provoke ? 2 : 0)) / Math.max(1, card.cost);
};
const must = result => assert.ok(result.ok, result.error);

for (const heroId of heroIds) {
  for (const seed of seeds) {
    const bytes = new Map();
    const storage = { getItem: key => bytes.get(key) ?? null, setItem: (key, value) => bytes.set(key, value) };
    let session = new RoguelikeSession({ storage });
    const hero = ROGUELIKE_HEROES.find(value => value.id === heroId);
    must(session.start({ heroId, kitId: hero.kits[0].id, difficulty: 1, seed }));
    const entry = { heroId, seed, battles: [] };
    while (!['won', 'lost'].includes(session.record.run.phase)) {
      const run = session.record.run;
      if (run.phase === 'relic') {
        const preferred = run.offers.relics.find(relic => ['war-drum', 'iron-seed', 'bone-banner', 'rune-nest'].includes(relic.id));
        must(session.chooseRelic((preferred ?? run.offers.relics[0]).id));
      } else if (run.phase === 'route') {
        const choice = run.offers.routes.find(route => route.kind === 'safe') ?? run.offers.routes[0];
        must(session.chooseRoute(choice.id));
        const prepared = session.prepareBattle();
        must(prepared);
        must(session.commitBattle(prepared.match));
      } else if (run.phase === 'battle') {
        const restored = session.restoreBattle();
        must(restored);
        const match = restored.match;
        if (match.phase === 'mulligan') confirmMulligan(match);
        let actions = 0;
        while (match.phase !== 'over' && actions < 1200) {
          autoAct(match, match.currentPlayer);
          actions++;
        }
        assert.equal(match.phase, 'over', 'battle reaches a terminal result');
        assert.ok(validateMatch(match), 'completed real battle remains valid');
        must(session.checkpoint(match));
        entry.battles.push({ stage: run.stage, level: run.route.levelId, actions, round: match.round,
          result: match.result, reason: match.resultReason, health: findGeneral(match, 0)?.health ?? 0,
          deck: run.deck.length, relics: [...run.relics] });
        session.leave();
        session = new RoguelikeSession({ storage });
        assert.equal(session.error, '', 'terminal save reloads');
      } else if (run.phase === 'cards') {
        const offer = [...run.offers.cards].sort((a, b) => b.cards.reduce((sum, id) => sum + scoreCard(id), 0) - a.cards.reduce((sum, id) => sum + scoreCard(id), 0))[0];
        must(session.chooseCards(offer?.id ?? null));
      } else if (run.phase === 'camp') {
        const target = [...new Set(run.deck)].filter(id => getCard(id).type === 'unit' && (run.upgrades[id] ?? 0) < 2)
          .sort((a, b) => scoreCard(b) - scoreCard(a))[0];
        if (target && run.gold >= CAMP_COSTS.upgrade) must(session.camp('upgrade', target));
        must(session.camp('continue'));
      } else throw new Error(`Unhandled phase ${run.phase}`);
    }
    entry.result = session.record.run.result;
    results.push(entry);
    console.log(JSON.stringify({ heroId, seed, result: entry.result, battles: entry.battles.length }));
  }
}
const report = { results, limitations: ['Deterministic autoAct policies are not human win rates or mobile interaction evidence.'] };
await writeFile(new URL('run-probe.json', output), JSON.stringify(report, null, 2));
