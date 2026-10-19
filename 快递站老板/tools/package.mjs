import {spawnSync} from 'node:child_process';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));const run=(cmd,args)=>{const r=spawnSync(cmd,args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+r.stderr);return r.stdout;};
mkdirSync(path.join(root,'output'),{recursive:true});const checks=run(process.execPath,['--test','tests/engine.test.mjs','tests/save-compat.test.mjs','tests/ads.test.mjs','tests/pipeline.test.mjs','tests/waves.test.mjs']);writeFileSync(path.join(root,'output/package-validation.txt'),checks);run(process.execPath,['tools/build.mjs']);
const version=JSON.parse(readFileSync(path.join(root,'package.json'))).version;const archive=path.join(root,'output',`courier-depot-${version}.zip`);run('python',['-c',`import pathlib,zipfile,sys
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file():z.write(p,'courier-depot/'+p.relative_to(root).as_posix())`,path.join(root,'dist'),archive]);const data=readFileSync(archive);const manifest={version,archive,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),saveKey:'courier-depot.save.v1',saveCompatibility:'passed',time:new Date().toISOString()};writeFileSync(path.join(root,'output/package-manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
