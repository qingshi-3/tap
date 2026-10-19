import {mkdir,open,readFile,unlink} from 'node:fs/promises';
import {spawn} from 'node:child_process';
// Each exported project owns its build lock and generated output.
await mkdir(new URL('../output/',import.meta.url),{recursive:true});
const lock=new URL('../output/build-operation.lock',import.meta.url),owner='cargo-packer / 01a153a6-e74b-7460-9b2f-f00d048cff94';
const [purpose,command,...args]=process.argv.slice(2);if(!command)throw Error('purpose and command required');
let handle;try{handle=await open(lock,'wx');}catch(e){if(e.code==='EEXIST'){console.error('Shared operation occupied:',await readFile(lock,'utf8'));process.exit(75);}throw e;}
const record=JSON.stringify({owner,purpose,time:new Date().toISOString(),pid:process.pid});
try{await handle.writeFile(record);await handle.close();const code=await new Promise((resolve,reject)=>{const p=spawn(command,args,{stdio:'inherit',shell:false});p.on('error',reject);p.on('close',resolve);});process.exitCode=code??1;}finally{if(await readFile(lock,'utf8').catch(()=>null)===record)await unlink(lock);}
