import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const toolDir=path.dirname(fileURLToPath(import.meta.url));
const gameRoot=path.resolve(toolDir,'..');
let source=fs.readFileSync(path.join(toolDir,'sync-effects.mjs'),'utf8').split("fs.writeFileSync(path.join(gameRoot, '.unit-fx-audit.json')")[0];
source=source.replace("const here = path.dirname(fileURLToPath(import.meta.url));",`const here = ${JSON.stringify(toolDir)};`);
source+=`\nfunction getAtPath(root,dotted){return dotted.replace(/^FX\\./, '').split('.').reduce((value,key)=>value?.[key],root);}\nexport {RSX,buildUnitAudit,buildSpellAudit};`;
const {RSX,buildUnitAudit,buildSpellAudit}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {EFFECT_MANIFEST:m}=await import('../dist/js/effect-manifest.js');
const {CARDS}=await import('../dist/js/cards.js');
const units=buildUnitAudit(),spells=buildSpellAudit(),mismatches=[];
let unitEvents=0;
for(const [id,entry] of Object.entries(units.cards))for(const [event,symbol]of Object.entries(entry.sounds)){unitEvents++;const expected=RSX[symbol]?.audio,actual=m.bodies[id]?.sounds?.[event];if(JSON.stringify(expected)!==JSON.stringify(actual))mismatches.push({id,event,symbol,expected,actual,source:entry.factoryLines});}
for(const [id,entry]of Object.entries(spells.cards)){const symbol=entry.factory.sound.replace(/^RSX\.|\.audio$/g,''),expected=RSX[symbol]?.audio,actual=m.spellSounds[id];if(JSON.stringify(expected)!==JSON.stringify(actual))mismatches.push({id,event:'spell',symbol,expected,actual,source:entry.factory.location});}
const variants=Object.values(CARDS).filter(c=>c.spriteFrom).map(c=>({id:c.id,sourceId:c.spriteFrom,hasOwnBody:!!m.bodies[c.id],sourceSounds:m.bodies[c.spriteFrom]?.sounds}));
const missingUnits=Object.values(CARDS).filter(c=>c.type!=='spell'&&!m.bodies[c.spriteFrom??c.id]).map(c=>({id:c.id,name:c.name}));
const missingSpells=Object.values(CARDS).filter(c=>c.type==='spell'&&!m.spellSounds[c.id]).map(c=>({id:c.id,name:c.name,effect:c.effect}));
const assets=Object.entries(m.sounds).map(([source,local])=>{
 const original=fs.readFileSync(path.join(units.sourceRoot,'app',source));
 const packaged=fs.readFileSync(path.join(gameRoot,'dist',local));
 return {source,local,bytes:packaged.length,identical:original.equals(packaged),sha256:crypto.createHash('sha256').update(packaged).digest('hex')};
});
const report={unitCards:Object.keys(units.cards).length,unitEvents,spellCards:Object.keys(spells.cards).length,mismatches,variants,missingUnits,missingSpells,assets};
const out=path.join(gameRoot,'output/ui-refinement/audio');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'source-mapping-audit.json'),JSON.stringify(report,null,2));
assert.deepEqual(mismatches,[]);assert.deepEqual(missingUnits,[]);assert.deepEqual(missingSpells,[]);assert.ok(assets.every(asset=>asset.identical));
console.log(`Original mappings verified: ${report.unitCards} units/${unitEvents} events, ${report.spellCards} spells, ${variants.length} explicit variants, ${assets.length} byte-identical packaged sounds.`);
