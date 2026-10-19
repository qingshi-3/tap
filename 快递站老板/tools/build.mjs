import {mkdirSync,cpSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));const out=path.join(root,'dist');mkdirSync(out,{recursive:true});
for(const name of ['index.html','style.css','js','assets']){if(!existsSync(path.join(root,name)))throw Error('Missing '+name);cpSync(path.join(root,name),path.join(out,name),{recursive:true});}
const packageInfo=JSON.parse(readFileSync(path.join(root,'package.json')));writeFileSync(path.join(out,'version.json'),JSON.stringify({version:packageInfo.version,saveSchema:1,saveKey:'courier-depot.save.v1'}));console.log('Built dist');
