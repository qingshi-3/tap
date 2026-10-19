import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
function run(c,a){const r=spawnSync(c,a,{cwd:root,encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+r.stderr);return r.stdout;}
mkdirSync(path.join(root,'output'),{recursive:true});const report=run(process.execPath,['--test','tests/engine.test.mjs','tests/persistence.test.mjs']);writeFileSync(path.join(root,'output/package-validation.txt'),report);run(process.execPath,['tools/build.mjs']);
const version=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).version;const archive=path.join(root,`output/cargo-packer-${version}.zip`);run('python',['-c',"import pathlib,sys,zipfile\np=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED) as z:\n for f in sorted(p.rglob('*')):\n  if f.is_file(): z.write(f,'cargo-packer/'+f.relative_to(p).as_posix())",path.join(root,'dist'),archive]);const bytes=readFileSync(archive);const manifest={archive,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),version,saveKey:'cargo-packer.save.v1',validation:'rules and complete persistence cycle passed',time:new Date().toISOString()};writeFileSync(path.join(root,'output/package-manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
