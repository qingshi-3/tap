import fs from 'node:fs';

const ghosts = JSON.parse(fs.readFileSync(new URL('../../src/core/ghosts.json', import.meta.url), 'utf8'));
const data = fs.readFileSync(new URL('../../src/core/data.ts', import.meta.url), 'utf8');
const cards = new Map();
for (const line of data.split(/\r?\n/)) {
  const m = line.match(/C\('([^']+)', '([^']+)',\s*(\d+),\s*[-\d]+,\s*[-\d]+,\s*'([^']+)',\s*'([^']*)'/);
  if (!m) continue;
  const ab = line.match(/ab:\s*'([^']+)'/)?.[1] ?? '';
  cards.set(m[1], { id: m[1], name: m[2], tier: +m[3], line: m[4], text: m[5], ab });
}

// These abilities create no new battle value for an enemy ghost: their trigger belongs to prep/economy.
const prepOnly = new Set(['tfish','bluebird','backstab','rabbit','ladybug','worm','seal','cow','sauropod','rhyno','cat','wyvern','beaver','giraffe','fish','buffalo','penguin','monkey','dragon']);
const needsFront = new Set(['dodo','snake','kangaroo','backstab','giraffe','tiger','parrot']);
const needsBack = new Set(['elephant','camel','drill','flamingo','turtle']);
const support = new Set(['camel','blowfish','ox','turtle','storm','fly','heart','turkey','dog','tiger','idol']);
const engine = new Set(['elephant','anvil','cricket','egg','spider','sheep','deer','rooster','eagle','hedgehog','badger']);

const rows = [];
for (const turn of [9,12,15,18]) {
  const teams = ghosts.turns[String(turn)] ?? [];
  let units=0, blank=0, positional=0, supportN=0, engineN=0, coherent=0, blankBudget=0, totalBudget=0;
  for (const team of teams) {
    let b=0,s=0,e=0;
    team.forEach((u,i) => {
      const c=cards.get(u.def) ?? {name:u.def,ab:''};
      const size=u.atk+u.hp; units++; totalBudget+=size;
      if (prepOnly.has(c.ab)) { blank++; b++; blankBudget+=size; }
      if ((i===0&&needsFront.has(c.ab)) || (i===team.length-1&&needsBack.has(c.ab))) positional++;
      if (support.has(c.ab)) {supportN++;s++;}
      if (engine.has(c.ab)) {engineN++;e++;}
    });
    if (b===0 && s>0 && e>0) coherent++;
  }
  rows.push({turn, teams:teams.length, units, prepOnly:blank, prepPct:(blank/units*100).toFixed(1), prepBudgetPct:(blankBudget/totalBudget*100).toFixed(1), positional, support:supportN, engine:engineN, coherentTeams:coherent});
}

const examples = {};
for (const turn of [9,12,15,18]) {
  examples[turn]=(ghosts.turns[String(turn)]??[]).map((team,idx)=>({idx, team:team.map((u,i)=>{const c=cards.get(u.def)??{name:u.def,ab:''};return `${i+1}.${c.name}[${c.ab||'-'}] ${u.atk}/${u.hp}${prepOnly.has(c.ab)?'★备战白板':''}`;})})).sort((a,b)=>b.team.filter(x=>x.includes('★')).length-a.team.filter(x=>x.includes('★')).length).slice(0,3);
}
console.log(JSON.stringify({rows,examples},null,2));
