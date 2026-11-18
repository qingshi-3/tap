import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Supplementary same-save opening captures. This is not a playthrough and does
// not read, migrate, or overwrite the user's browser profile or player progress.
const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const first = Number(arg('--from', 1)), last = Number(arg('--to', 30));
const oldBase = arg('--before-base', 'http://127.0.0.1:4257');
const newBase = arg('--after-base', 'http://127.0.0.1:4256');
const dirURL = (value,fallback) => value ? pathToFileURL(resolve(value)+'/') : new URL(fallback,import.meta.url);
const oldRoot = dirURL(arg('--before-source',null),'../output/release-0.4.11/source/');
const newRoot = dirURL(arg('--after-source',null),'../output/release-0.4.12/source/');
const oldVersion=arg('--before-version','0.4.11'),newVersion=arg('--after-version','0.4.12');
const out = dirURL(arg('--output',null),'../output/battle-display/comparisons/');
const reuseRoot=arg('--reuse-before',null)?dirURL(arg('--reuse-before',null)):null;
const middleBase=arg('--middle-base','http://127.0.0.1:4256'),middleVersion=arg('--middle-version','0.4.12');
const W=Number(arg('--width',844)),H=Number(arg('--height',390)),pairHeight=H+56;
if(args.includes('--review-only'))assert.ok(args.includes('--output'),'size reviews require a separate output directory');
if(newVersion!=='0.4.12')assert.ok(args.includes('--output'),'a new revision must not overwrite the historical 0.4.12 image collection');
if(reuseRoot)assert.notEqual(fileURLToPath(out).toLowerCase(),fileURLToPath(reuseRoot).toLowerCase(),'reused historical images are read-only inputs');
const oldMod = path => import(new URL('dist/js/' + path, oldRoot));
const [{ ExpeditionProgress }, engine, { EXPEDITION_LEVELS }, { SAVE_KEYS }, { CARDS }] = await Promise.all([
  oldMod('expedition-progress.js'), oldMod('engine.js'), oldMod('expedition-data.js'), oldMod('storage-keys.js'), oldMod('cards.js'),
]);
const { createExpeditionMatch, confirmMulligan, validateMatch } = engine;
assert.equal(EXPEDITION_LEVELS.length, 30, 'the before release contains the original 30 campaign levels');
const { chromium } = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
for (const dir of ['', 'originals/', 'pairs/', 'sheets/', 'snapshots/', 'evidence/']) await mkdir(new URL(dir, out), { recursive: true });
class Memory {
  data = new Map(); getItem(k) { return this.data.get(k) ?? null; }
  setItem(k, v) { this.data.set(k, String(v)); } removeItem(k) { this.data.delete(k); }
}
function freshProgress() {
  const p = new ExpeditionProgress(new Memory()), profile = p.state;
  // Isolated screenshot entitlement only: leave completed/settlements empty.
  profile.legacyUnlockedLevels = EXPEDITION_LEVELS.map(l => l.id);
  const replaced = p.replaceState(profile); assert.ok(replaced.ok, replaced.error); return p;
}
function denseUnits(match) {
  const make = (id, owner, x, y, unitId, extra = {}) => {
    const c = CARDS[id]; return { unitId, cardId:id, owner, x, y, attack:c.attack, health:c.health, maxHealth:c.health,
      attackBuff:0, healthBuff:0, moved:false, attacked:false, summonedThisTurn:false, token:Boolean(c.token), reborn:false,
      silenced:false, bodyguardUsed:false, skirmishUsed:false, ...(owner === 0 && !c.token ? { specialization:'none' } : {}), ...extra };
  };
  const a = match.units.find(u => u.owner === 0 && CARDS[u.cardId].type === 'general');
  const b = match.units.find(u => u.owner === 1 && CARDS[u.cardId].type === 'general');
  const object = match.units.find(u => u.cardId === 9101);
  Object.assign(a, { x:1, y:2 }); Object.assign(b, { x:7, y:2 }); Object.assign(object, { x:4, y:1 });
  Object.assign(match.encounter.sources.find(s => s.unitId === object.unitId), { x:4, y:1 });
  const next = Math.max(...match.units.map(u => u.unitId)) + 1;
  match.units = [a, b, object,
    make(14,0,2,2,next,{attack:2,health:12,maxHealth:12}), make(14,1,3,2,next+1,{attack:1,health:10,maxHealth:10}),
    make(14,0,2,3,next+2,{stunTurns:1,moved:true,attacked:true}), make(9,0,3,3,next+3,{moved:true,attacked:true}),
    make(11,0,2,1,next+4), make(11,1,3,1,next+5), make(9101,1,4,3,next+6)];
  match.selectedUnitId = null; match.lastAction = null;
}
async function fixture(level, index, dense = false) {
  const stem = dense ? 'dense-test' : `${String(index).padStart(2,'0')}-${level.id}`;
  const file = new URL(`snapshots/${stem}.json`, out);
  try { const cached = JSON.parse(await readFile(file, 'utf8')); assert.ok(validateMatch(cached.profile.activeBattle)); return cached; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if(reuseRoot){
    const bytes=await readFile(new URL(`snapshots/${stem}.json`,reuseRoot));
    const cached=JSON.parse(bytes);assert.ok(validateMatch(cached.profile.activeBattle));
    await writeFile(file,bytes);return cached;
  }
  const p = freshProgress(), seed = (0x20261105 + index) >>> 0;
  const match = createExpeditionMatch(level.id, p.state.training, p.state.squad, 1, p.getBattleLoadout(), { challengeSeed:seed });
  assert.ok(p.saveBattle(match).ok, 'freeze reward on the legal pre-mulligan factory match');
  assert.ok(confirmMulligan(match)); if (dense) denseUnits(match);
  assert.ok(validateMatch(match), 'old-engine snapshot is valid');
  const result = p.saveBattle(match); assert.ok(result.ok, result.error);
  const profileText = JSON.stringify(p.state);
  const value = { stem, index, levelId:level.id, title:level.title, kind:dense?'密集单位合法测试局':'同档开局补拍', seed,
    profile:p.state, profileSha256:hash(profileText), snapshotSha256:hash(match),
    provenance:'Built with the frozen 0.4.11 engine, reward saved before confirmMulligan, then validateMatch/saveBattle; same profile bytes supplied to both isolated browser contexts. Screenshot-only unlock entitlement; completed remains empty.' };
  await writeFile(file, JSON.stringify(value, null, 2)); return value;
}
function business(s) {
  return { schemaVersion:s.schemaVersion, levelId:s.levelId, runId:s.runId, board:s.board, units:s.units, players:s.players,
    encounter:s.encounter, boss:s.boss, phase:s.phase, round:s.round, currentPlayer:s.currentPlayer, selectedUnitId:s.selectedUnitId };
}
const browser = await chromium.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true });
const errors = [];
async function capture(f, version, base) {
  assert.equal(hash(JSON.stringify(f.profile)), f.profileSha256, 'the exact profile payload matches its frozen digest');
  const context = await browser.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:1, hasTouch:true, reducedMotion:'reduce' });
  try {
    const page = await context.newPage(); page.on('pageerror', error => errors.push({ stem:f.stem, version, error:String(error) }));
    await page.addInitScript(({ text, key }) => localStorage.setItem(key, text), { text:JSON.stringify(f.profile), key:SAVE_KEYS.expedition });
    await page.addInitScript(async () => {
      const { BoardRenderer } = await import('/js/renderer.js'), draw = BoardRenderer.prototype.draw;
      BoardRenderer.prototype.draw = function(state, ...rest) { window.__comparisonRenderer=this; return draw.call(this,state,...rest); };
    });
    await page.goto(base); await page.locator('.menu-play').tap();
    await page.locator('#objective-close').waitFor({state:'visible'}); await page.locator('#objective-close').tap();
    await page.waitForFunction(() => window.__comparisonRenderer?.ready && !document.querySelector('#match').hidden
      && !document.querySelector('#end-turn').disabled && !document.querySelector('#match').classList.contains('turn-transition')
      && [...document.querySelectorAll('.turn-toast')].every(el=>el.hidden));
    await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    const live = await page.evaluate(() => {
      const r=window.__comparisonRenderer,b=r.canvas.getBoundingClientRect();
      return { state:structuredClone(r.state), camera:structuredClone(r.camera), metrics:r.boardMetrics(b.width,b.height),
        enteredThrough:'menu-play tap, objective-close tap', toastHidden:[...document.querySelectorAll('.turn-toast')].every(el=>el.hidden) };
    });
    assert.equal(live.state.levelId, f.levelId); assert.equal(live.toastHidden,true);
    assert.deepEqual(business(live.state),business(f.profile.activeBattle), `${f.stem}/${version} loaded the supplied battle without gameplay changes`);
    const image = `originals/${f.stem}-${version}.png`;
    await page.screenshot({ path:fileURLToPath(new URL(image,out)), animations:'disabled' });
    const imageSha256=hash(await readFile(new URL(image,out)));
    await writeFile(new URL(`evidence/${f.stem}-${version}.json`,out),JSON.stringify({...live,loadedBusinessSha256:hash(business(live.state)),imageSha256},null,2));
    return { image, imageSha256, business:business(live.state), camera:live.camera, metrics:live.metrics };
  } finally { await context.close(); }
}
async function obtain(f,version,base){
  if(reuseRoot&&W===844&&H===390&&['before','middle'].includes(version)){
    const sourceVersion=version==='middle'?'after':'before';
    const evidence=JSON.parse(await readFile(new URL(`evidence/${f.stem}-${sourceVersion}.json`,reuseRoot),'utf8'));
    assert.deepEqual(business(evidence.state),business(f.profile.activeBattle),'reused screenshot has the exact same snapshot');
    const sourceImage=new URL(`originals/${f.stem}-${sourceVersion}.png`,reuseRoot),bytes=await readFile(sourceImage);
    assert.equal(bytes.readUInt32BE(16),W);assert.equal(bytes.readUInt32BE(20),H);assert.equal(hash(bytes),evidence.imageSha256);
    const image=`originals/${f.stem}-${version}.png`;await copyFile(sourceImage,new URL(image,out));
    await writeFile(new URL(`evidence/${f.stem}-${version}.json`,out),JSON.stringify({...evidence,reusedFrom:fileURLToPath(sourceImage)},null,2));
    return {image,imageSha256:hash(bytes),business:business(evidence.state),camera:evidence.camera,metrics:evidence.metrics,reused:true};
  }
  return capture(f,version,base);
}
const css = `*{box-sizing:border-box}body{margin:0;background:#fff;color:#171717;font:16px/1.3 Arial,"Microsoft YaHei",sans-serif}header{height:32px;display:flex;align-items:center;gap:16px;padding:0 12px}header b{font-size:16px}header span{font-size:14px;color:#444}.pair{width:${W*2}px}.labels{display:grid;grid-template-columns:${W}px ${W}px;height:24px;font-size:14px;align-items:center}.labels span{padding-left:12px}.images{display:grid;grid-template-columns:${W}px ${W}px;width:${W*2}px;height:${H}px}.images img{display:block;width:${W}px;height:${H}px;max-width:none}.sheet>h1{height:36px;margin:0;padding:6px 12px;font-size:18px}`;
async function data(path) { return 'data:image/png;base64,' + (await readFile(new URL(path,out))).toString('base64'); }
async function pairMarkup(meta) {
  return `<section class="pair"><header><b>${esc(meta.kind==='密集单位合法测试局'?'密集单位测试场景':`${String(meta.index).padStart(2,'0')} · ${meta.title}`)}</b><span>${esc(meta.kind)} · ${W}×${H} · 减少动画</span></header><div class="labels"><span>优化前 · ${esc(oldVersion)}</span><span>优化后 · ${esc(newVersion)}</span></div><div class="images"><img src="${await data(meta.before.image)}"><img src="${await data(meta.after.image)}"></div></section>`;
}
async function comparePixels(page, sourcePath, compositePath, x, y) {
  const result=await page.evaluate(async ({source,composite,x,y,width,height})=>{
    const load=async src=>{const image=new Image();image.src=src;await image.decode();return image;};
    const [a,b]=await Promise.all([load(source),load(composite)]),c=document.createElement('canvas');c.width=width;c.height=height;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(a,0,0);const first=ctx.getImageData(0,0,width,height).data;
    ctx.clearRect(0,0,width,height);ctx.drawImage(b,x,y,width,height,0,0,width,height);const second=ctx.getImageData(0,0,width,height).data;
    let changed=0;for(let i=0;i<first.length;i++)if(first[i]!==second[i])changed++;return {changedChannels:changed,pixels:width*height};
  },{source:await data(sourcePath),composite:await data(compositePath),x,y,width:W,height:H});
  assert.equal(result.changedChannels,0, 'composite keeps original game pixels at 1:1');return result;
}
async function composePair(meta) {
  const context=await browser.newContext({viewport:{width:W*2,height:pairHeight},deviceScaleFactor:1}),page=await context.newPage();
  try {
    await page.setContent(`<html lang="zh-CN"><head><meta charset="utf-8"><style>${css}</style></head><body>${await pairMarkup(meta)}</body></html>`);
    await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
    const pair=`pairs/${meta.stem}.png`;await page.screenshot({path:fileURLToPath(new URL(pair,out))});
    meta.pair=pair;
    meta.pixelIdentity={before:await comparePixels(page,meta.before.image,pair,0,56),after:await comparePixels(page,meta.after.image,pair,W,56)};
    return meta;
  } finally {await context.close();}
}
async function capturePair(f) {
  const before=await obtain(f,'before',oldBase),after=await capture(f,'after',newBase);
  assert.deepEqual(before.business,after.business, `${f.stem} exact loaded units/players/board/encounter match`);
  assert.deepEqual(before.camera,after.camera, `${f.stem} both versions keep their natural identical camera`);
  assert.deepEqual(before.metrics,after.metrics, `${f.stem} identical board projection`);
  const meta=await composePair({stem:f.stem,index:f.index,levelId:f.levelId,title:f.title,kind:f.kind,seed:f.seed,
    profileSha256:f.profileSha256,snapshotSha256:f.snapshotSha256,loadedBusinessSha256:hash(before.business),camera:before.camera,
    sameSnapshot:true,sameCamera:true,viewport:{width:W,height:H,deviceScaleFactor:1},reducedMotion:'reduce',
    reusedBefore:Boolean(before.reused),beforeVersion:oldVersion,afterVersion:newVersion,
    before:{image:before.image,sha256:before.imageSha256},after:{image:after.image,sha256:after.imageSha256}});
  await writeFile(new URL(`evidence/${f.stem}-pair.json`,out),JSON.stringify(meta,null,2));
  console.log(`${f.stem}: same-save/camera, original pixels verified, pair ready`);
}
async function sizeReview(f){
  const before=await obtain(f,'before',oldBase),middle=await obtain(f,'middle',middleBase),after=await capture(f,'after',newBase);
  for(const other of [middle,after]){
    assert.deepEqual(before.business,other.business,'all size columns use the same loaded battle');
    assert.deepEqual(before.camera,other.camera,'all size columns use the same natural camera');
    assert.deepEqual(before.metrics,other.metrics,'all size columns use the same board projection');
  }
  const context=await browser.newContext({viewport:{width:W*3,height:pairHeight},deviceScaleFactor:1}),page=await context.newPage();
  try{
    const labels=[`原版 · ${oldVersion}`,`过小版 · ${middleVersion}`,`回调版 · ${newVersion}`];
    const columns=[before,middle,after];
    await page.setContent(`<html lang="zh-CN"><meta charset="utf-8"><style>${css}.pair,.images{width:${W*3}px}.images,.labels{grid-template-columns:repeat(3,${W}px)}</style><section class="pair"><header><b>${f.stem==='dense-test'?'密集单位测试场景':esc(f.title)}</b><span>同档尺寸对照 · ${W}×${H} · 减少动画</span></header><div class="labels">${labels.map(label=>`<span>${esc(label)}</span>`).join('')}</div><div class="images">${(await Promise.all(columns.map(async column=>`<img src="${await data(column.image)}">`))).join('')}</div></section></html>`);
    await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
    const image=`pairs/${f.stem}-three-sizes.png`;await page.screenshot({path:fileURLToPath(new URL(image,out))});
    const pixelIdentity=[];for(let i=0;i<columns.length;i++)pixelIdentity.push(await comparePixels(page,columns[i].image,image,W*i,56));
    const value={stem:f.stem,title:f.title,image,viewport:{width:W,height:H},versions:labels,profileSha256:f.profileSha256,
      loadedBusinessSha256:hash(before.business),sameSnapshot:true,sameCamera:true,pixelIdentity,originals:columns.map(column=>column.image),
      reusedOriginalColumns:columns.map(column=>Boolean(column.reused)),scope:'Unit size review only; no gameplay or publication acceptance claim.'};
    await writeFile(new URL(`evidence/${f.stem}-three-sizes.json`,out),JSON.stringify(value,null,2));
    console.log(`${f.stem} ${W}×${H}: three size columns ready`);return value;
  }finally{await context.close();}
}
async function publishIndex() {
  const names=(await readdir(new URL('evidence/',out))).filter(name=>name.endsWith('-pair.json'));
  const pairs=await Promise.all(names.map(async name=>JSON.parse(await readFile(new URL('evidence/'+name,out),'utf8'))));
  const natural=pairs.filter(p=>p.kind==='同档开局补拍').sort((a,b)=>a.index-b.index),dense=pairs.find(p=>p.kind!=='同档开局补拍');
  const sheets=args.includes('--index-only')?JSON.parse(await readFile(new URL('report.json',out),'utf8')).sheets:[];
  for(let first=1;first<=30;first+=5){
    if(args.includes('--index-only'))break;
    const group=natural.filter(p=>p.index>=first&&p.index<first+5);if(group.length!==5)continue;
    const name=`sheets/${String(first).padStart(2,'0')}-${String(first+4).padStart(2,'0')}.png`;
    const context=await browser.newContext({viewport:{width:W*2,height:36+5*pairHeight},deviceScaleFactor:1}),page=await context.newPage();
    try{
      await page.setContent(`<html lang="zh-CN"><head><meta charset="utf-8"><style>${css}</style></head><body class="sheet"><h1>第${first}–${first+4}关 · 同档开局补拍</h1>${(await Promise.all(group.map(pairMarkup))).join('')}</body></html>`);
      await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
      await page.screenshot({path:fileURLToPath(new URL(name,out))});
      const identities=[];for(let i=0;i<group.length;i++)identities.push({stem:group[i].stem,before:await comparePixels(page,group[i].before.image,name,0,36+i*pairHeight+56),after:await comparePixels(page,group[i].after.image,name,W,36+i*pairHeight+56)});
      sheets.push({first,last:first+4,image:name,pixelIdentity:identities});
    }finally{await context.close();}
  }
  const index=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>原30关优化前后 · 同档开局补拍</title><style>body{margin:24px;max-width:1500px;font:16px/1.6 Arial,"Microsoft YaHei",sans-serif;color:#202020}h1{font-size:24px;margin:0 0 8px}h2{font-size:20px}p{max-width:900px}a{color:#135799}nav{display:flex;gap:16px;flex-wrap:wrap}article{margin:28px 0 44px}img{display:block;width:100%;height:auto;margin:8px 0}article a{margin-right:16px}</style><h1>原30关优化前后</h1><p>0.4.11 与 0.4.12 同档开局补拍。每对使用相同存档、手牌、镜头和 844×390 视口。仅核对开局显示，另附密集单位测试场景。</p><nav>${sheets.map(s=>`<a href="${s.image}">第${s.first}–${s.last}关汇总</a>`).join('')}${dense?'<a href="#dense-test">密集测试局</a>':''}</nav>${natural.map(p=>`<article id="${p.stem}"><h2>${String(p.index).padStart(2,'0')} · ${esc(p.title)}</h2><a href="${p.pair}">配对原尺寸</a><a href="${p.before.image}">优化前原图</a><a href="${p.after.image}">优化后原图</a><a href="evidence/${p.stem}-pair.json">同档证据</a><img loading="lazy" src="${p.pair}" alt="${esc(p.title)}同档开局补拍，左侧优化前、右侧优化后"></article>`).join('')}${dense?`<article id="dense-test"><h2>密集单位测试场景</h2><p>合法保存的人工密集测试局，包含9101机关、多行相邻单位、嘲讽、冻结与行动耗尽。</p><a href="${dense.before.image}">优化前原图</a><a href="${dense.after.image}">优化后原图</a><img src="${dense.pair}" alt="密集单位合法测试局优化前后"></article>`:''}</html>`;
  await writeFile(new URL('index.html',out),index.replaceAll('0.4.11',oldVersion).replaceAll('0.4.12',newVersion).replaceAll('844×390',`${W}×${H}`));
  const report={title:'原30关优化前后 · 同档开局补拍',before:{version:oldVersion,source:fileURLToPath(oldRoot),base:oldBase},after:{version:newVersion,source:fileURLToPath(newRoot),base:newBase},
    naturalOpeningCount:natural.length,targetCount:30,denseTest:Boolean(dense),pairs:[...natural,...(dense?[dense]:[])],sheets,errors,
    limitation:'Supplementary opening screenshots only; screenshot-only entitlement unlock, no claim of normal clears, historical combat captures, full playthrough or TapTap host/device acceptance.'};
  assert.deepEqual(errors,[]);await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));
  console.log(`Ready: ${natural.length}/30 opening pairs, ${sheets.length} five-level sheets, dense=${Boolean(dense)}`);
}
async function archive() {
  const command = String.raw`$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$comparisonRoot=[IO.Path]::GetFullPath($env:BATTLE_COMPARISON_ROOT)
$archivePath=Join-Path $comparisonRoot 'battle-opening-comparisons-30.zip'
$temporaryPath=Join-Path $comparisonRoot ('comparison-'+[guid]::NewGuid().ToString()+'.zip')
$files=@()
foreach($folder in @('originals','pairs','sheets')){$files+=Get-ChildItem -LiteralPath (Join-Path $comparisonRoot $folder) -File}
$files+=Get-ChildItem -LiteralPath (Join-Path $comparisonRoot 'evidence') -Filter '*-pair.json' -File
foreach($name in @('index.html','report.json')){$files+=Get-Item -LiteralPath (Join-Path $comparisonRoot $name)}
$zip=[IO.Compression.ZipFile]::Open($temporaryPath,[IO.Compression.ZipArchiveMode]::Create)
try{foreach($file in $files){$entry=$file.FullName.Substring($comparisonRoot.TrimEnd('\').Length+1).Replace('\','/');[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,$entry,[IO.Compression.CompressionLevel]::Optimal)|Out-Null}}
finally{$zip.Dispose()}
Move-Item -LiteralPath $temporaryPath -Destination $archivePath -Force
$check=[IO.Compression.ZipFile]::OpenRead($archivePath)
try{$entries=@($check.Entries|ForEach-Object FullName)}finally{$check.Dispose()}
$hashStream=[IO.File]::OpenRead($archivePath)
$algorithm=[Security.Cryptography.SHA256]::Create()
try{$sha256=[BitConverter]::ToString($algorithm.ComputeHash($hashStream)).Replace('-','').ToLower()}finally{$hashStream.Dispose();$algorithm.Dispose()}
[ordered]@{file='battle-opening-comparisons-30.zip';bytes=(Get-Item -LiteralPath $archivePath).Length;sha256=$sha256;entryCount=$entries.Count;entries=$entries}|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $comparisonRoot 'archive-manifest.json') -Encoding utf8
Write-Output ('ZIP ready: '+$entries.Count+' entries')`;
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',env:{...process.env,BATTLE_COMPARISON_ROOT:fileURLToPath(out)}});
  assert.equal(result.status,0,result.stderr||result.stdout);console.log(result.stdout.trim());
}
async function checkIndex() {
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1}),page=await context.newPage();
  try{
    await page.goto(new URL('index.html',out).href);
    assert.equal(await page.locator('article').count(),31);
    assert.equal(await page.locator('nav a[href^="sheets/"]').count(),6);
    await page.locator('article img').first().evaluate(image=>image.decode());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:fileURLToPath(new URL('index-preview.png',out))});
    await page.locator('nav a[href="#dense-test"]').click();
    assert.equal(new URL(page.url()).hash,'#dense-test');
    await page.locator('a[href="pairs/30-confluence-03.png"]').click();
    await page.waitForURL('**/pairs/30-confluence-03.png');
    assert.equal(await page.locator('img').evaluate(image=>image.naturalWidth),W*2);
    await writeFile(new URL('index-check.json',out),JSON.stringify({passed:true,checks:['31 scene sections and six summaries','no horizontal overflow at 1280×800','real dense anchor navigation','real final-level full-resolution image link'],errors:[]},null,2));
  }finally{await context.close();}
}
try {
  if(args.includes('--review-only')){
    const scenes=[];
    for(const dense of [true,false])scenes.push(await sizeReview(await fixture(EXPEDITION_LEVELS[0],dense?0:1,dense)));
    await writeFile(new URL('review-report.json',out),JSON.stringify({before:oldVersion,middle:middleVersion,after:newVersion,scenes,errors,passed:errors.length===0},null,2));
  }else if(!args.includes('--compose-only')&&!args.includes('--index-only')&&!args.includes('--archive-only')){
    for(const [i,level]of EXPEDITION_LEVELS.entries())if(i+1>=first&&i+1<=last)await capturePair(await fixture(level,i+1));
    if(args.includes('--dense')||first===1&&last===30)await capturePair(await fixture(EXPEDITION_LEVELS[0],0,true));
  }
  if(!args.includes('--archive-only')&&!args.includes('--review-only'))await publishIndex();
  if(args.includes('--archive-only'))await archive();
  else if(args.includes('--zip')){await checkIndex();await archive();}
}finally{await browser.close();}
