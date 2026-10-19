import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const cli='C:/Users/qs/AppData/Roaming/npm/node_modules/@taptap/cli/scripts/run.js';
const schedule={release_schedule:{kind:'immediate'}};
const read=p=>JSON.parse(readFileSync(p,'utf8'));
function call(op,data,name,extra=[]){
 const file=`platform/authorized-review-${name}.json`;
 const r=spawnSync(process.execPath,[cli,'app',op,'--dev-id','488823','--app-id','985963','--data',JSON.stringify(data),...extra],{encoding:'utf8'});
 writeFileSync(file,r.stdout);const j=JSON.parse(r.stdout);
 if(r.status!==0||!j.ok)throw Error(JSON.stringify(j));return j.data.result??j.data;
}
const mode=process.argv[2];
if(mode==='inspect'){
 console.log(call('get-app-version',{version:'V-20261019'},'before'));
 console.log(call('get-app-module',{module_id:'package'},'package'));
 const basic=call('get-app-module',{module_id:'basic-info'},'basic');
 assert.equal(basic.fields.title.current_value,'装车收纳');
 console.log('Title verified:',basic.fields.title.current_value);
}else if(mode==='agree'){
 // User explicitly accepted the displayed agreement and immediate release in this chat.
 call('agree-sce-agreement',{},'agreement-dryrun',['--idempotency-key','cargo-agreement-985963-20261019','--dry-run']);
 const signed=call('agree-sce-agreement',{},'agreement',['--idempotency-key','cargo-agreement-985963-20261019','--yes']);
 assert.equal(signed.status,'signed');assert.equal(String(signed.app_id),'985963');console.log(signed);
}else if(mode==='precheck'){
 console.log(call('prepare-review-snapshot',{},'snapshot'));
 writeFileSync('platform/authorized-review-request.json',JSON.stringify(schedule,null,2)+'\n');
 const check=call('precheck-app-review',schedule,'precheck');console.log(check);
 assert.equal(check.preaudit_passed,true);assert.deepEqual(check.blockers,[]);
}else if(mode==='submit'){
 const check=read('platform/authorized-review-precheck.json').data.result;
 assert.equal(check.preaudit_passed,true);assert.deepEqual(check.blockers,[]);
 assert.equal(String(check.version_id),'1104678');
 assert.deepEqual(read('platform/authorized-review-request.json'),schedule);
 if(existsSync('platform/authorized-review-submit.json'))throw Error('Submission receipt exists; query state before any retry');
 call('submit-app-review',schedule,'submit-dryrun',['--idempotency-key','cargo-submit-1104678-20261019','--dry-run']);
 console.log(call('submit-app-review',schedule,'submit',['--idempotency-key','cargo-submit-1104678-20261019','--yes']));
}else if(mode==='verify'){
 console.log(call('get-app-version',{version:'V-20261019'},'readback'));
 console.log(call('list-app-versions',{},'versions'));
 console.log(call('get-app-module',{module_id:'release-settings'},'release'));
}else throw Error('Expected inspect/agree/precheck/submit/verify');
