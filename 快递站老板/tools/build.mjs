import {mkdirSync,readdirSync,statSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';
// Explicit read/write avoids Node 24 cpSync failures on Windows Unicode paths.
function copyTree(source,target){if(statSync(source).isDirectory()){mkdirSync(target,{recursive:true});for(const name of readdirSync(source))copyTree(path.join(source,name),path.join(target,name));}else writeFileSync(target,readFileSync(source));}
const root=fileURLToPath(new URL('../',import.meta.url));const out=path.join(root,'dist');mkdirSync(out,{recursive:true});
for(const name of ['index.html','style.css','js','assets']){if(!existsSync(path.join(root,name)))throw Error('Missing '+name);copyTree(path.join(root,name),path.join(out,name));}
const packageInfo=JSON.parse(readFileSync(path.join(root,'package.json')));writeFileSync(path.join(out,'version.json'),JSON.stringify({version:packageInfo.version,saveSchema:1,saveKey:'courier-depot.save.v1'}));console.log('Built dist');
