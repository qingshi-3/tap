import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const run=(command,args)=>{const r=spawnSync(command,args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw new Error(r.stdout+r.stderr);return r.stdout;};
mkdirSync(path.join(root,'output'),{recursive:true});
const report=run(process.execPath,['--test','tests/core.test.mjs','tests/persistence.test.mjs','tests/ads.test.mjs','tests/economy.test.mjs']);
writeFileSync(path.join(root,'output','package-validation.txt'),report);
run(process.execPath,['tools/build.mjs']);
const version=JSON.parse(readFileSync(path.join(root,'package.json'))).version;
const archive=path.join(root,'output',`forest-lantern-${version}.zip`);
run('python',['-c',`import pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file(): z.write(p,'forest-lantern/'+p.relative_to(root).as_posix())`,path.join(root,'dist'),archive]);
const data=readFileSync(archive);
const manifest={version,archive,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),validation:'passed',saveKey:'forest-lantern.save.v1',time:new Date().toISOString()};
writeFileSync(path.join(root,'output','package-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
