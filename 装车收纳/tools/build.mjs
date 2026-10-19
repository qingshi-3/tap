import {mkdir,cp,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);await mkdir(dist,{recursive:true});
for(const name of ['index.html','style.css','js','assets'])await cp(new URL(name,root),new URL(name,dist),{recursive:true});
await writeFile(new URL('build.json',dist),JSON.stringify({game:'cargo-packer',version:JSON.parse(await readFile(new URL('package.json',root),'utf8')).version,builtAt:new Date().toISOString()}));
console.log('Built',fileURLToPath(dist));
