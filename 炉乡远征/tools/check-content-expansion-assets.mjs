import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/content-expansion/assets/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],pages=[];
try {
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4227');
  const audit=await page.evaluate(async()=>{
    const {BoardRenderer}=await import('/js/renderer.js'),{CARDS}=await import('/js/cards.js');
    const r=window.assetRenderer=new BoardRenderer(document.createElement('canvas'));await r.load();
    window.assetCards=Object.values(CARDS).sort((a,b)=>a.faction-b.faction||a.id-b.id);
    return window.assetCards.map(card=>{
      const canvas=document.createElement('canvas');canvas.width=140;canvas.height=120;r.drawCardArt(canvas,card.id);
      const pixels=canvas.getContext('2d').getImageData(0,0,140,120).data;
      let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>16)visible++;
      const atlas=r.atlases.get(card.sprite?.sheet);
      return {id:card.id,type:card.type,name:card.name,visible,loaded:card.type==='spell'?!!r.images.get(`spell-${card.effect}`):!!atlas?.image,
        states:atlas?Object.fromEntries(Object.entries(atlas.animations).map(([k,v])=>[k,v.frames.length])):null};
    });
  });
  assert.equal(audit.length,192);assert.ok(audit.every(c=>c.loaded&&c.visible>0),JSON.stringify(audit.filter(c=>!c.loaded||!c.visible)));
  for(let start=0;start<audit.length;start+=40){
    await page.evaluate(start=>{
      const grid=document.createElement('div');grid.style='display:grid;grid-template-columns:repeat(8,120px);background:#24354b;color:#fff;padding:16px;gap:0;font:13px sans-serif';
      for(const card of window.assetCards.slice(start,start+40)){
        const cell=document.createElement('div'),canvas=document.createElement('canvas');canvas.width=120;canvas.height=110;
        window.assetRenderer.drawCardArt(canvas,card.id);cell.append(canvas,document.createTextNode(`${card.id} ${card.name}`));grid.append(cell);
      }
      document.body.replaceChildren(grid);
    },start);
    const file=`cards-${String(start).padStart(3,'0')}.png`;await page.screenshot({path:fileURLToPath(new URL(file,out)),fullPage:true});pages.push(file);
  }
  assert.deepEqual(errors,[]);
  await writeFile(new URL('report.json',out),JSON.stringify({passed:true,audit,pages,errors,scope:'Real renderer card assets; separate gameplay and animation interaction checks required.'},null,2));
  console.log(JSON.stringify({passed:true,cards:audit.length,pages}));
} finally {await browser.close();}
