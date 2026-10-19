import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const cli='C:/Users/qs/AppData/Roaming/npm/node_modules/@taptap/cli/scripts/run.js';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
function call(op,data,file,extra=[]){
 const r=spawnSync(process.execPath,[cli,'app',op,'--dev-id','488823','--app-id','985963','--data',JSON.stringify(data),...extra],{encoding:'utf8'});
 writeFileSync(file,r.stdout);let j;try{j=JSON.parse(r.stdout);}catch{throw Error('Invalid response saved at '+file);}
 if(r.status!==0||!j.ok)throw Error(JSON.stringify(j));return j.data.result;
}
const modules=['basic-info','developer-info','profile-promotion','assets-upload'];
const mode=process.argv[2];
if(mode==='prepare'){
 const fields={};for(const id of modules)Object.assign(fields,call('get-app-module',{module_id:id},`platform/store-v4-${id}-before.json`).fields);
 const copy=read('platform/store-copy-v4.json');
 const changes=Object.entries(copy).map(([field_id,value])=>({field_id,expected:fields[field_id].current_value,value}));
 const metadata=read('output/store/media-v4-metadata.json');
 for(const [field_id,name] of [['icon','app-icon-v4'],['banner_4','banner-v4-export'],['square_promo_image','square-v4-export']]){
  const upload=read(`platform/upload-${name}.json`).data;
  const result=upload.result??upload;
  const url=result.url??result.image_url;
  assert.equal(typeof url,'string',JSON.stringify(upload));
  changes.push({field_id,expected:fields[field_id].current_value,value:{url,info:metadata[name]}});
 }
 writeFileSync('platform/store-v4-changes.json',JSON.stringify({changes},null,2)+'\n');
 console.log('Prepared',changes.length,'fields');
}else if(mode==='save'){
 const changes=read('platform/store-v4-changes.json');
 call('save-changes',changes,'platform/store-v4-dryrun.json',['--idempotency-key','cargo-store-v4-20261019','--dry-run']);
 console.log(call('save-changes',changes,'platform/store-v4-saved.json',['--idempotency-key','cargo-store-v4-20261019','--yes']));
}else if(mode==='verify'){
 const fields={};for(const id of modules)Object.assign(fields,call('get-app-module',{module_id:id},`platform/store-v4-${id}-readback.json`).fields);
 for(const c of read('platform/store-v4-changes.json').changes)assert.deepEqual(fields[c.field_id].current_value,c.value?.url??c.value,c.field_id);
 console.log('All 6 fields match readback; screenshots and video:',fields.screenshots.current_value.length,fields.gameplay_demo_video.current_value);
 console.log(call('prepare-review-snapshot',{},'platform/store-v4-snapshot.json'));
 console.log(call('precheck-app-review',{release_schedule:{kind:'immediate'}},'platform/store-v4-precheck.json'));
}else throw Error('Expected prepare/save/verify');
