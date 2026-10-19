import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

// Production packages must pass the same persistence and deterministic-rule checks.
execFileSync(process.execPath,['tools/check-boundary.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['node_modules/vitest/vitest.mjs','run'],{stdio:'inherit'});
if(!existsSync('dist/index.html'))throw new Error('Build is missing its root entry');
mkdirSync('output',{recursive:true});
const version=JSON.parse(readFileSync('package.json','utf8').replace(/^\uFEFF/,'')).version;
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid package version');
const archive=path.resolve(`output/little-guardians-h5-${version}.zip`);
execFileSync('python',['tools/package.py',path.resolve('dist'),archive],{stdio:'inherit'});
const data=readFileSync(archive);
console.log(JSON.stringify({archive,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')},null,2));
