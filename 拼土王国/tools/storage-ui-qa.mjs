import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'output/qa-popup');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),key='patchwork-kingdom.save.v1',errors=[],report=[];
let page;
const shot=async name=>page.screenshot({path:resolve(out,`storage-${name}.png`)});
const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const dialogOpen=()=>page.locator('#dialog').evaluate(e=>e.open);
const waitLand=async()=>{await page.locator('#market-title').filter({hasText:'选一块土地'}).waitFor();assert.equal(await page.locator('#market [data-kind="land"]').count(),3);};
try{
 // Fresh nonpersistent contexts isolate every save/reset/import from player data.
 const context=await browser.newContext({viewport:{width:360,height:640},hasTouch:true,isMobile:true,acceptDownloads:true});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4198');await waitLand();
 const initial=await read();assert.equal(initial.version,2);
 await page.locator('#close-market').tap();assert.equal(await page.locator('#market').isHidden(),true);
 await page.locator('#open-building').tap();await page.locator('#market-title').filter({hasText:'选一座建筑'}).waitFor();
 assert.equal(await page.locator('#market [data-kind="building"]').count(),3);await shot('building-popup');
 await page.locator('#close-market').tap();

 // Cancellation leaves the full saved state unchanged; only confirmation removes it.
 await page.locator('.tile[data-x="5"][data-y="6"]').tap();await page.locator('#demolish').tap();
 await page.locator('#confirm-demolish').waitFor();assert.deepEqual(await read(),initial);await shot('demolish-confirm');
 await page.locator('#close-dialog').tap();assert.equal(await dialogOpen(),false);assert.deepEqual(await read(),initial);
 await page.locator('#demolish').tap();await page.locator('#confirm-demolish').tap();
 let saved=await read();assert.ok(saved.gold>initial.gold);assert.equal(saved.tiles.find(t=>t.x===5&&t.y===6).building,null);
 assert.equal(saved.tiles.length,initial.tiles.length);assert.equal(await page.locator('#inspector').isHidden(),true);await shot('demolished');
 report.push({demolishConfirmation:true,cancelPreservesSave:true,confirmedRefundAndLandRetained:true});

 // Quarter settlement pushes land cards directly, rather than a settlement dialog.
 await page.locator('#next-turn').tap();await waitLand();assert.equal(await dialogOpen(),false);
 saved=await read();assert.equal(saved.turn,initial.turn+1);
 await page.locator('#records').tap();const downloadWait=page.waitForEvent('download');await page.locator('#export').tap();
 const download=await downloadWait,exportPath=resolve(out,'storage-exported-save.json');await download.saveAs(exportPath);
 assert.deepEqual(JSON.parse(await readFile(exportPath,'utf8')),saved);await shot('export');
 await page.locator('#restart').tap();await page.locator('#confirm-restart').waitFor();assert.deepEqual(await read(),saved);
 await page.locator('#confirm-restart').tap();await waitLand();const restarted=await read();assert.equal(restarted.turn,1);
 assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k+'.backup')),key),saved);await shot('restart-backed-up');
 await page.locator('#records').tap();await page.locator('#file-input').setInputFiles(exportPath);await page.locator('#confirm-import').waitFor();
 assert.deepEqual(await read(),restarted);await shot('import-confirm');await page.locator('#confirm-import').tap();await waitLand();
 assert.deepEqual(await read(),saved);assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k+'.backup')),key),restarted);
 await page.reload();await waitLand();assert.deepEqual(await read(),saved);
 await page.locator('#next-turn').tap();await waitLand();assert.equal(await dialogOpen(),false);
 const continued=await read();assert.equal(continued.turn,saved.turn+1);await page.reload();await waitLand();assert.deepEqual(await read(),continued);
 await page.locator('#close-market').tap();await shot('reloaded-continued');
 report.push({viewport:[360,640],export:true,restartBackup:true,importBackup:true,reload:true,continuedQuarterSaving:true,quarterPushesLandWithoutDialog:true});
 await context.close();

 for(const mode of ['corrupt','denied']){
  const isolated=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  await isolated.addInitScript(({key,mode})=>{
   if(mode==='corrupt')localStorage.setItem(key,'broken-original');
   else Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});
  },{key,mode});
  page=await isolated.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4198');await page.locator('#recover-new').waitFor();assert.equal(await dialogOpen(),true);
  for(const id of ['next-turn','open-land','open-building'])assert.equal(await page.locator('#'+id).isDisabled(),true);
  await page.keyboard.press('Escape');assert.equal(await dialogOpen(),true);
  await page.locator('#close-dialog').click();await page.locator('.dialog-notice').filter({hasText:'请先处理原存档'}).waitFor();
  assert.equal(await dialogOpen(),true);await shot(`${mode}-protected`);
  if(mode==='corrupt'){
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),'broken-original');
   const originalWait=page.waitForEvent('download');await page.locator('#export-original').click();
   const originalPath=resolve(out,'storage-corrupt-original.json');await (await originalWait).saveAs(originalPath);
   assert.equal(await readFile(originalPath,'utf8'),'broken-original');
  }
  await page.locator('#recover-new').click();
  if(mode==='corrupt'){
   await waitLand();assert.equal(await page.evaluate(k=>localStorage.getItem(k+'.backup'),key),'broken-original');assert.equal(await dialogOpen(),false);
   assert.equal((await read()).version,2);assert.equal(await page.locator('#next-turn').isDisabled(),false);
   await page.locator('#next-turn').click();await waitLand();assert.equal((await read()).turn,2);await shot('corrupt-recovered');
   report.push({mode,escapeAndCloseBlocked:true,originalExportUnchanged:true,backupBeforeRecovery:true,continuedSavingAfterRecovery:true});
  }else{
   await page.locator('.dialog-notice').filter({hasText:'未能备份或写入'}).waitFor();assert.equal(await page.locator('.dialog-notice').isVisible(),true);
   assert.equal(await dialogOpen(),true);assert.equal(await page.locator('#next-turn').isDisabled(),true);await shot('denied-visible-error');
   report.push({mode,localStorageGetterThrows:true,escapeAndCloseBlocked:true,recoveryFailureVisible:true,remainsBlocked:true});
  }
  await isolated.close();
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'storage-report.json'),JSON.stringify({passed:true,report,errors},null,2));console.log(JSON.stringify(report));
}catch(error){
 if(page&&!page.isClosed())await shot('failure').catch(()=>{});
 await writeFile(resolve(out,'storage-report.json'),JSON.stringify({passed:false,error:error.stack,report,errors},null,2));throw error;
}finally{await browser.close();}

