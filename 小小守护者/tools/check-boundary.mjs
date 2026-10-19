import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
async function walk(dir){const out=[];for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())out.push(...await walk(p));else if(f.name.endsWith('.ts')&&!f.name.endsWith('.test.ts'))out.push(p);}return out;}
const banned=/\b(?:Math\.random|Date\.now|performance\.now|document|window|navigator|localStorage|requestAnimationFrame)\b|from\s+['"](?:pixi\.js|.*(?:storage|platform|profile))['"]/;
const issues=[];for(const file of await walk('src/core')){const text=await readFile(file,'utf8');if(banned.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'')))issues.push(file);}
if(issues.length){console.error('Core boundary violation:',issues);process.exitCode=1;}else console.log('Core boundary verified.');
