"""Independent, read-only validation of the frozen closure batch and delivered product."""
import hashlib
import json
from collections import Counter
from pathlib import Path
from statistics import median

here = Path(__file__).resolve().parent
game = here.parent.parent
batch = here / 'final-01'
manifest = json.loads((batch / 'manifest.json').read_text(encoding='utf-8-sig'))
rows = [json.loads(line) for line in (batch / 'runs.jsonl').open(encoding='utf-8-sig')]
summary = json.loads((batch / 'summary.json').read_text(encoding='utf-8-sig'))
pairs = {(p['seed'], p['general']) for p in manifest['pairs']}
modes = manifest['modes']
groups = {}
for mode in modes:
    runs = [r for r in rows if r['mode'] == mode]
    groups[mode] = {
        'count': len(runs),
        'clears': sum(r['clear'] for r in runs),
        'earlyThreePassed': sum(len(r['early']) == 3 and all(x == 'win' for x in r['early']) for r in runs),
        'everFormed': sum(r['firstFormation'] is not None for r in runs),
        'drawStops': sum(r['termination'] == 'draw-stop' for r in runs),
        'stagePasses': [sum('win' in r['stages'][i]['bossResults'] for r in runs) for i in range(3)],
        'everBeforeBossOrTermination': [sum(r['stages'][i]['everFormedAtFirstBoss'] for r in runs) for i in range(3)],
        'stillAtBoss': [sum(r['stages'][i]['formedAtFirstBoss'] for r in runs) for i in range(3)],
        'bossArrivals': [sum(bool(r['stages'][i]['bossResults']) for r in runs) for i in range(3)],
    }
directed = [v for k, v in groups.items() if k not in ('casual', 'anti3')]
source_mismatches = [p for p, h in manifest['hashes'].items()
                     if hashlib.sha256((game / 'source' / p).read_bytes()).hexdigest() != h]
product_checked = 0
product_mismatches = []
for line in (game / 'MANIFEST.sha256').read_text(encoding='utf-8-sig').splitlines():
    h, p = line.split('  ', 1)
    if p.startswith(('source/src/', 'dist/')) or p == '阵列-双击打开.html':
        product_checked += 1
        if hashlib.sha256((game / p).read_bytes()).hexdigest() != h:
            product_mismatches.append(p)
late = [v for v in directed if v['everBeforeBossOrTermination'][1] / 32 < .7]
gates = {
    'completeUniqueSamples': len(rows) == 416 and len({r['runId'] for r in rows}) == 416,
    'same32PairsEachGroup': len(pairs) == 32 and all(len([r for r in rows if r['mode'] == m]) == 32 and {(r['seed'], r['general']) for r in rows if r['mode'] == m} == pairs for m in modes),
    'balancedGenerals': dict(Counter(p['general'] for p in manifest['pairs'])) == {'reva': 8, 'zilan': 8, 'sajj': 8, 'kaleos': 8},
    'freshSeeds': not json.loads((batch / 'seed-audit.json').read_text(encoding='utf-8-sig'))['overlap'],
    'engineAndActionSafety': not any(r['faults'] or r.get('exception') or r['failedActions'] or r['budgetErrors'] or r['unknownLineages'] for r in rows),
    'anti3Safety': not any(r['structuralViolations'] or r['actualViolations'] for r in rows if r['mode'] == 'anti3'),
    'sourceFrozen': not source_mismatches and not summary['changed'],
    'productUnchanged': product_checked == 1163 and not product_mismatches,
    'openingFairness': sum(v['earlyThreePassed'] for v in groups.values()) / 416 >= .99 and all(v['earlyThreePassed'] >= 31 for v in groups.values()),
    'formationBySecondBoss': sum(v['everBeforeBossOrTermination'][1] / 32 >= .7 for v in directed) >= 8,
    'lateBuildTransition': all(v['stagePasses'][0] / 32 >= .85 for v in late),
    'eachDirectionHasReliablePath': all(v['clears'] >= 8 for v in directed),
    'mostDirectionsClearHalf': sum(v['clears'] >= 16 for v in directed) >= 6,
    'constructionAdvantage': median(v['clears'] / 32 for v in directed) >= groups['casual']['clears'] / 32 + .10,
    'noExcessiveDrawStops': all(v['drawStops'] / 32 <= .25 for v in groups.values()),
}
report = {
    'groups': groups,
    'gates': gates,
    'automatedAcceptancePassed': all(gates.values()),
    'sourceMismatches': source_mismatches,
    'productFilesChecked': product_checked,
    'productMismatches': product_mismatches,
    'battles': sum(r['attempts'] for r in rows),
    'remainingHumanReview': 'Check actual direction effects in battles and UI evidence; automated gates do not certify fun or real-device readability.',
}
(here / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(0 if all(gates.values()) else 1)
