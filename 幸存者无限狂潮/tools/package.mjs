import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute, sep, posix } from 'node:path';

// A fixed allowlist keeps development records and platform credentials outside the client.
const files = ['index.html','style.css','audio.js','main.js','simulation.js','enemy-content.js','enemy-abilities.js','battle-camera.js','combat-stats.js','growth.js','hero-kit.js','common-abilities.js','skill-targeting.js','combat-content.js','vfx-assets.js','renderer.js','assets.js','campaign.js','campaign-ui.js','campaign.css','heroes.js','skill-art.js','skill-preview.js','journey-art.js','campaign-journey.js','campaign-journey.css','campaign-profession.js','campaign-profession.css','unit-preview.js',
  'assets/units/general_commander.png','assets/units/general_summoner.png','assets/units/general_blink.png','assets/units/general_mage.png',
  'assets/units/base_commander.png','assets/units/base_summoner.png','assets/units/base_blink.png','assets/units/base_mage.png','assets/units/general_swift.png',
  'assets/units/boss_kron.png','assets/units/boss_cindera.png','assets/units/neutral_golemstone.png','assets/units/f2_flareslinger.png','assets/units/neutral_monsterexplodingdemon.png',
  'assets/units/hero_duelist.png','assets/units/hero_mage.png',
  'assets/terrain.png','assets/units/hero.png','assets/units/grunt.png','assets/units/runner.png','assets/units/brute.png',
  'assets/vfx/magicBolt.png','assets/vfx/magicImpact.png','assets/vfx/dash.png','assets/vfx/cleave.png','assets/vfx/swordField.png','assets/vfx/frost.png',
  'assets/vfx/bossCleave.png','assets/vfx/bossCharge.png','assets/vfx/bossSlam.png',
  'assets/vfx/rend-strip.png','assets/vfx/return-blade-painted.png','assets/vfx/icePillar.png','assets/vfx/iceRain.png','assets/vfx/rockWall.png',
  'assets/units/guard_basic.png','assets/units/scout_basic.png','assets/units/healer_basic.png',
  'assets/units/archer_elite.png','assets/units/guard_elite.png','assets/units/healer_elite.png',
  'assets/ui/hub.jpg','assets/ui/camp-original.png','assets/ui/frame.png','assets/ui/bottom-bar.png',
  'assets/ui/button.png','assets/ui/back.png','assets/ui/gold.png','assets/ui/materials.png',
  'assets/ui/scenes/moss-gate.jpg','assets/ui/scenes/ember-trail.jpg','assets/ui/scenes/blade-trial.jpg','assets/ui/scenes/swift-trial.jpg',
  'assets/ui/scenes/blink-trial.jpg',
  'assets/ui/duelyst-button-secondary.png','assets/ui/duelyst-button-primary.png','assets/ui/duelyst-round-border.png','assets/ui/duelyst-header-dashes.png','assets/ui/duelyst-panel-header.png',
  'assets/ui/skill-dash.png','assets/ui/skill-cleave.png','assets/ui/skill-guard.png','assets/ui/skill-sword-field.png','assets/ui/skill-blade-wave.png',
  'assets/ui/skill-whirlwind.png','assets/ui/skill-quick-cut.png','assets/ui/skill-summon-guard.png','assets/ui/skill-recall-summons.png','assets/ui/skill-summon-elite.png',
  'assets/ui/skill-mark-blade.png','assets/ui/skill-blink-strike.png','assets/ui/skill-blink-storm.png','assets/ui/skill-flame-breath.png','assets/ui/skill-rock-wall.png','assets/ui/skill-frost-aura.png'];
files.push('blink-abilities.js','ranged-pressure.js','cloud-save.js','cloud-save-ui.js','cloud-save.css','rewarded-ad.js','ad-test-ui.js','daily-checkin.js','daily-checkin.css',
  'assets/vfx/summon.png','assets/vfx/tesla.png','assets/vfx/beam.png','assets/vfx/vortex.png','assets/vfx/shield.png','assets/vfx/familiar.png',
  'assets/vfx/blinkSeal.png','assets/vfx/blinkPhase.png','assets/vfx/heal.png','assets/vfx/hitImpact.png');
files.push('assets/vfx/shockNoise.png','assets/vfx/fireExplosion.png','assets/vfx/fireImpact.png','assets/vfx/fireGround.png','assets/vfx/flameCore.png','assets/vfx/poisonCloud.png','assets/vfx/whiteSpark.png','assets/units/familiarLight.png','assets/units/familiarHeavy.png');
files.push('attack-progression.js','job-mechanics.js','profession-content.js','common-unlocks.js','campaign-home.js','common-preview.js','campaign-growth.js','campaign-home.css');
files.push('combat-feedback.js','motion-trails.js',...['slash','pulse','hurt','pickup','select','upgrade','evolution','win','lose'].map(name=>`assets/audio/clean-${name}.m4a`));
files.push('trial-bosses.js',...['commander','swift','summoner','blink','mage'].map(name=>`assets/units/trial_${name}.png`));
files.push('trial-audio.js',...['shield-ready','shield-slash','wind-charge','wind-dash','wind-land','soul-bind','soul-pulse','soul-break','rift-mark','rift-burst','rift-cut','prism-in','prism-out','prism-charge','prism-break'].map(name=>`assets/audio/trial-${name}.m4a`));
files.push('special-heroes.js','special-hero-renderer.js',
  ...['grappler','rift','magnet'].flatMap(hero=>[1,2,3].map(tier=>`assets/units/hero_${hero}_${tier}.png`)),
  ...['grapple-hook','grapple-slam','grapple-clash','rift-gate','rift-step','rift-barrage','magnet-field','magnet-lance','magnet-crush'].map(skill=>`assets/ui/skill-${skill}.png`));
files.push('ascension-combat.js','mythic-heroes.js','mythic-hero-renderer.js',
 ...['sword','spiral','petal'].flatMap(hero=>[1,2,3].map(tier=>`assets/units/hero_${hero}_${tier}.png`)),
 ...['summoner','blink','mage'].map(hero=>`assets/units/hero_${hero}_3.png`),
 ...['sword-focus','sword-recall','sword-union','spiral-orb','spiral-clone','spiral-convergence','petal-sweep','petal-pierce','petal-bloom'].map(skill=>`assets/ui/skill-${skill}.png`));
files.push('original-heroes.js','original-hero-renderer.js');
files.push(...['shield','spear','priest','captain','giant'].map(role=>`assets/units/summon_${role}.png`));
const version='0.17.3';
const project = new URL('../', import.meta.url);
const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--output-dir' || !args[1]))throw Error('Usage: node tools/package.mjs [--output-dir <project-contained-directory>]');
const projectPath=fileURLToPath(project),outputPath=resolve(projectPath,args[1]||'build');
const outputRelative=relative(projectPath,outputPath);
if(outputRelative==='..'||outputRelative.startsWith(`..${sep}`)||isAbsolute(outputRelative)||outputRelative==='')throw Error('Output directory must be inside this game workspace.');
// Keep the explicit allowlist, but fail if a local module or HTML entry dependency
// falls outside it. Literal dynamic imports are checked; computed paths fail closed.
const allowed=new Set(files),dist=new URL('dist/',project),dependencyEdges=[];
function requirePackagedDependency(owner,specifier){
  if(/^(?:https?:|data:)/.test(specifier))return;
  if(!specifier.startsWith('.'))throw Error(`客户端依赖必须明确使用相对路径：${owner} -> ${specifier}`);
  const target=new URL(specifier,new URL(owner,dist));target.search='';target.hash='';
  const name=decodeURIComponent(target.pathname.slice(dist.pathname.length));
  if(!target.href.startsWith(dist.href)||!allowed.has(name))throw Error(`客户端依赖未列入包体，停止打包：${owner} -> ${specifier}`);
  dependencyEdges.push({from:owner,to:name});
}
for(const file of files.filter(name=>name.endsWith('.js')||name.endsWith('.html'))){
  const source=await readFile(new URL(file,dist),'utf8');
  if(file.endsWith('.js'))for(const match of source.matchAll(/^\s*(?:import|export)\s+(?:[^;]*?\bfrom\s*)?['"]([^'"]+)['"]/gm))requirePackagedDependency(file,match[1]);
  for(const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g))requirePackagedDependency(file,match[1]);
  if(/\bimport\s*\((?!\s*['"])/.test(source))throw Error(`动态导入路径无法静态核对，停止打包：${file}`);
  if(file.endsWith('.html'))for(const match of source.matchAll(/\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/g))requirePackagedDependency(file,match[1]);
}
// Check concrete local references without auto-including anything outside the allowlist.
// Computed resource paths still require review of their configuration when changed.
const allowedFiles = new Set(files);
if (allowedFiles.size !== files.length) throw Error('打包白名单包含重复文件。');
for (const file of files.filter(name => /\.(?:html|css|js)$/.test(name))) {
  const source = await readFile(new URL(`dist/${file}`, project), 'utf8');
  const references = [
    ...source.matchAll(/["'`]((?:\.{1,2}\/|assets\/)[^"'`\s<>]+)["'`]/g),
    ...source.matchAll(/url\(\s*([^"'\s)]+)\s*\)/g),
  ];
  for (const match of references) {
    const reference = match[1];
    if (reference.includes('${') || /^(?:[a-z]+:|\/\/|#)/i.test(reference)) continue;
    const path = posix.normalize(posix.join(posix.dirname(file), reference.split(/[?#]/)[0]));
    if (!allowedFiles.has(path)) throw Error(`打包遗漏本地依赖，停止打包：${file} → ${path}`);
  }
}
// Run the compatibility gate on every direct invocation, before producing any ZIP.
// A unique run ID prevents an earlier successful report from satisfying this run.
const compatibilityRunId=randomUUID();
const compatibility=spawnSync(process.execPath,[fileURLToPath(new URL('tools/check-save-compatibility.mjs',project))],{encoding:'utf8',windowsHide:true,env:{...process.env,SAVE_COMPATIBILITY_RUN_ID:compatibilityRunId}});
if(compatibility.status!==0)throw Error(`存档兼容检查失败，停止打包：\n${compatibility.stderr||compatibility.error||compatibility.stdout||''}`);
const compatibilityBytes=await readFile(new URL('output/save-compatibility/report.json',project));
const compatibilityReport=JSON.parse(compatibilityBytes);
if(!compatibilityReport.passed||compatibilityReport.runId!==compatibilityRunId)throw Error('本次存档兼容报告无效，停止打包。');
if(compatibilityReport.singleDeviceUpdate?.passed!==true||compatibilityReport.singleDeviceUpdate.storageContractChecked!==true||!Number.isSafeInteger(compatibilityReport.singleDeviceUpdate.roundTrips)||compatibilityReport.singleDeviceUpdate.roundTrips<1)throw Error('缺少已通过的同设备更新存档闭环验证，停止打包。');
const saveCompatibility={runId:compatibilityRunId,contractVersion:compatibilityReport.contractVersion,profileSchema:compatibilityReport.profileSchema,localKey:compatibilityReport.localKey,cloudSlot:compatibilityReport.cloudSlot,passed:true,singleDeviceUpdate:compatibilityReport.singleDeviceUpdate,cases:compatibilityReport.cases,fixtures:compatibilityReport.fixtures,reportSha256:createHash('sha256').update(compatibilityBytes).digest('hex')};
const manifest = [], local = [], central = [];
let offset = 0;
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit=0;bit<8;bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
for (const file of files) {
  if (file.endsWith('.js')) {
    const syntax = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(`dist/${file}`, project))], { encoding: 'utf8', windowsHide: true });
    if (syntax.status !== 0) throw new Error(`客户端语法错误，停止打包：${file}\n${syntax.stderr || syntax.error || ''}`);
  }
  const data = await readFile(new URL(`dist/${file}`, project));
  const name = Buffer.from(`pixel-survivor/${file}`), compressed = deflateRawSync(data,{level:9}), crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20,4); header.writeUInt16LE(0x800,6);
  header.writeUInt16LE(8,8); header.writeUInt16LE(0x5d4a,12); // fixed 2026-10-10 date
  header.writeUInt32LE(crc,14); header.writeUInt32LE(compressed.length,18); header.writeUInt32LE(data.length,22); header.writeUInt16LE(name.length,26);
  local.push(header,name,compressed);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20,4); directory.writeUInt16LE(20,6);
  directory.writeUInt16LE(0x800,8); directory.writeUInt16LE(8,10); directory.writeUInt16LE(0x5d4a,14);
  directory.writeUInt32LE(crc,16); directory.writeUInt32LE(compressed.length,20); directory.writeUInt32LE(data.length,24);
  directory.writeUInt16LE(name.length,28); directory.writeUInt32LE(offset,42);
  central.push(directory,name); offset += header.length + name.length + compressed.length;
  manifest.push({path:name.toString(),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}
const directory = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10);
end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
const zip = Buffer.concat([...local,directory,end]);
await mkdir(outputPath,{recursive:true});
await writeFile(resolve(outputPath,`pixel-survivor-${version}.zip`),zip);
const record = {version,bytes:zip.length,sha256:createHash('sha256').update(zip).digest('hex'),saveCompatibility,clientDependencies:{passed:true,edges:dependencyEdges},files:manifest};
await writeFile(resolve(outputPath,`manifest-${version}.json`),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));
