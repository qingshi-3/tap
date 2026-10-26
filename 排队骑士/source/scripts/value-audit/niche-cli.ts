// @ts-ignore Offline Node utility.
import { readFileSync, writeFileSync } from 'node:fs';
import { runNiche } from './niche';
import { writeReview } from './review';
const directory = new URL('../../output/value-audit/', import.meta.url);
const path = new URL('results.json', directory);
const result = JSON.parse(readFileSync(path, 'utf8'));
const niche = runNiche(result.seeds);
result.niche = niche;
result.counts.nicheBattles = niche.battles;
writeFileSync(new URL('niche.json', directory), JSON.stringify(niche, null, 2));
writeFileSync(path, JSON.stringify(result, null, 2));
writeReview();
