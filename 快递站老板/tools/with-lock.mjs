import {mkdirSync,openSync,writeFileSync,closeSync,unlinkSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Each exported project owns its build lock and generated output.
mkdirSync(new URL('../output/',import.meta.url),{recursive:true});
const lock=fileURLToPath(new URL('../output/build-operation.lock',import.meta.url));
const owner={game:'courier-depot',pid:process.pid,purpose:process.argv.slice(2).join(' '),time:new Date().toISOString()};
let fd;try{fd=openSync(lock,'wx');writeFileSync(fd,JSON.stringify(owner));closeSync(fd);}catch{console.log('Shared operation busy; no operation performed.');process.exit(75);}
try{const [cmd,...args]=process.argv.slice(2);const r=spawnSync(cmd,args,{stdio:'inherit',shell:process.platform==='win32'&&cmd==='taptap-cli'});process.exitCode=r.status??1;}finally{try{const current=JSON.parse(readFileSync(lock));if(current.pid===owner.pid&&current.game===owner.game)unlinkSync(lock);}catch{}}
