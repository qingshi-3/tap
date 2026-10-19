import { chromium } from 'file:///C:/Users/qs/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const out=new URL('../output/qa/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4196');await page.waitForTimeout(700);await page.screenshot({path:new URL('intro-390.png',out).pathname.slice(1)});
console.log(await page.locator('body').innerText());
await page.getByRole('button',{name:'接下小站',exact:true}).click();await page.getByRole('button',{name:'开门营业',exact:true}).click();await page.waitForTimeout(700);await page.screenshot({path:new URL('play-390.png',out).pathname.slice(1)});
console.log('errors',errors);writeFileSync(new URL('initial.json',out),JSON.stringify({errors,body:await page.locator('body').innerText()},null,2));
await browser.close();

