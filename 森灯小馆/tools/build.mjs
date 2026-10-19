import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(path.join(root,'dist'),{recursive:true});
for(const item of ['index.html','css','js','assets'])await cp(path.join(root,item),path.join(root,'dist',item),{recursive:true});
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
await writeFile(path.join(root,'dist','version.json'),JSON.stringify({version:pkg.version,builtAt:new Date().toISOString(),saveKey:'forest-lantern.save.v1'}));
console.log('Built forest-lantern/dist');
