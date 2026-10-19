import {validateProfile,saveProfile,getLocalProfileRaw,restoreCloudProfile,migrateLegacyProfile,PROFILE_SCHEMA_VERSION} from './campaign.js';
export const CLOUD_SLOT='pixel_survivor_app968359_v2';
export const LEGACY_CLOUD_SLOT='pixel_survivor_app968359_v1';
const MAX_BYTES=10*1024*1024;
const clone=value=>JSON.parse(JSON.stringify(value));
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:JSON.stringify(value);
export function validCloudEnvelope(value){
  const keys=['game','app','schemaVersion','slotId','savedAt','revision','profile'];
  return value && typeof value==='object' && Object.keys(value).length===keys.length && keys.every(k=>Object.hasOwn(value,k)) && value.game==='pixel-survivor' && value.app===968359 && value.schemaVersion===PROFILE_SCHEMA_VERSION && value.slotId===CLOUD_SLOT && typeof value.savedAt==='string' && Number.isFinite(Date.parse(value.savedAt)) && typeof value.revision==='string' && value.revision.length>0 && value.revision.length<=160 && validateProfile(value.profile);
}
export function cloudSummary(profile){return `四英雄等级 ${['commander','summoner','blink','mage'].map(id=>profile.heroes[id].level).join(' / ')} · 金币 ${profile.gold} · 材料 ${profile.materials}`;}
const token=remote=>remote?canonical({uuid:remote.uuid,fileId:remote.fileId,data:remote.sourceData||remote.data}):'empty';
export class CloudSave {
  constructor({tap=globalThis.tap,timeoutMs=25000,now=()=>Date.now(),isAllowed=()=>true}={}){
    this.tap=tap;this.timeoutMs=timeoutMs;this.now=now;this.isAllowed=isAllowed;this.epoch=0;this.sequence=0;this.queue=Promise.resolve();this.blocked=false;this.lastWriteAt=null;
    try{this.cloud=tap?.getCloudSaveManager?.();this.fs=tap?.getFileSystemManager?.();}catch{}
  }
  get available(){return Boolean(this.cloud&&this.fs&&this.tap?.env?.USER_DATA_PATH);}
  begin(){return ++this.epoch;}
  cancel(){this.epoch++;}
  guard(epoch){if(epoch!==this.epoch || !this.isAllowed())throw Error('操作已取消，当前进度未修改。');if(!this.available)throw Error('请在支持云存档的 TapTap 手机宿主中打开。普通浏览器仍可使用本机进度。');if(this.blocked)throw Error('云端请求结果尚未确定，请重新进入游戏核对云档，暂不允许重复操作。');}
  enqueue(operation){const result=this.queue.then(operation,operation);this.queue=result.catch(()=>{});return result;}
  request(target,method,options={}){
    return new Promise((resolve,reject)=>{let settled=false;const done=fn=>value=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};const timer=setTimeout(()=>{if(settled)return;settled=true;this.blocked=true;const error=Error('云端请求超时，结果未知。请重新进入游戏核对，勿重复备份。');error.uncertain=true;reject(error);},this.timeoutMs);
      try{target[method]({...options,success:done(resolve),fail:done(()=>reject(Error('云端服务操作失败，本机进度仍保留。')))});}catch{done(reject)(Error('宿主云存档接口不可用，本机进度仍保留。'));}
    });
  }
  async readDirect(epoch){
    this.guard(epoch);const result=await this.request(this.cloud,'getArchiveList');this.guard(epoch);
    if(!Array.isArray(result?.saves))throw Error('云档列表格式无效，未修改进度。');
    const current=result.saves.filter(s=>s?.name===CLOUD_SLOT);
    // Only a successful list proving v2 absent permits a read-only v1 fallback.
    const slot=current.length?CLOUD_SLOT:LEGACY_CLOUD_SLOT;
    const matches=result.saves.filter(s=>s?.name===slot);if(matches.length>1)throw Error('发现同名云档冲突，拒绝覆盖或恢复。');if(!matches.length)return null;
    const {uuid,fileId}=matches[0];if(typeof uuid!=='string'||!uuid||typeof fileId!=='string'||!fileId)throw Error('云档标识无效，未修改进度。');
    const targetFilePath=`${this.tap.env.USER_DATA_PATH}/pixel-survivor-read-${++this.sequence}.json`;
    const downloaded=await this.request(this.cloud,'getArchiveData',{archiveUUID:uuid,archiveFileId:fileId,targetFilePath});this.guard(epoch);
    if(typeof downloaded?.filePath!=='string'||!downloaded.filePath)throw Error('宿主未返回有效云档文件。');
    const file=await this.request(this.fs,'readFile',{filePath:downloaded.filePath,encoding:'utf8'});this.guard(epoch);
    if(typeof file?.data!=='string'||new TextEncoder().encode(file.data).length>MAX_BYTES)throw Error('云档内容无效或超过 10MB，拒绝恢复。');
    let data;try{data=JSON.parse(file.data);}catch{throw Error('云档已损坏，当前进度未修改。');}
    if(slot===LEGACY_CLOUD_SLOT){
      const migrated=migrateLegacyProfile(data?.profile);
      const normalized={...data,schemaVersion:PROFILE_SCHEMA_VERSION,slotId:CLOUD_SLOT,profile:migrated};
      if(data?.schemaVersion!==1||data?.slotId!==LEGACY_CLOUD_SLOT||!migrated||!validCloudEnvelope(normalized))throw Error('旧云档版本、游戏归属或档案格式不支持，原云档未修改。');
      return {uuid,fileId,data:normalized,sourceData:data,legacy:true};
    }
    if(!validCloudEnvelope(data))throw Error('云档版本、游戏归属或档案格式不支持，当前进度未修改。');
    return {uuid,fileId,data};
  }
  read(epoch){return this.enqueue(()=>this.readDirect(epoch));}
  prepare(profile,remote){
    if(!validateProfile(profile))throw Error('本机档案无效。');
    return {remote:clone(remote),remoteToken:token(remote),localRaw:getLocalProfileRaw(),localProfile:canonical(profile)};
  }
  checkLocal(confirmation,profile){if(getLocalProfileRaw()!==confirmation.localRaw||canonical(profile)!==confirmation.localProfile)throw Error('本机进度已变化，请重新查看后确认。');}
  async verify(epoch,confirmation,profile){
    this.guard(epoch);
    this.checkLocal(confirmation,profile);
    const remote=await this.readDirect(epoch);
    this.checkLocal(confirmation,profile);
    if(token(remote)!==confirmation.remoteToken){const error=Error('云端进度已变化，可能在其他设备或宿主账号中操作过。请刷新后重新确认。');error.conflict=true;throw error;}
    return remote;
  }
  backup(profile,confirmation,epoch){return this.enqueue(async()=>{
    await this.verify(epoch,confirmation,profile);
    if(this.lastWriteAt!==null && this.now()-this.lastWriteAt<60000)throw Error(`云端每分钟最多备份一次，请 ${Math.ceil((60000-(this.now()-this.lastWriteAt))/1000)} 秒后再试。`);
    // Only our exact synchronous save may advance the expected local bytes. Never adopt
    // an arbitrary read-back value: that could hide another writer's intervening progress.
    const expectedSavedRaw=JSON.stringify(profile);
    const local=saveProfile(profile);if(!local.ok)throw Error(local.error);
    const savedConfirmation={...confirmation,localRaw:expectedSavedRaw};
    this.checkLocal(savedConfirmation,profile);
    const data={game:'pixel-survivor',app:968359,schemaVersion:PROFILE_SCHEMA_VERSION,slotId:CLOUD_SLOT,savedAt:new Date(this.now()).toISOString(),revision:globalThis.crypto?.randomUUID?.()||`${this.now()}-${++this.sequence}`,profile:clone(profile)};
    const serialized=JSON.stringify(data);if(new TextEncoder().encode(serialized).length>MAX_BYTES)throw Error('档案超过 10MB，未上传。');
    this.guard(epoch);const archiveFilePath=`${this.tap.env.USER_DATA_PATH}/pixel-survivor-upload-${++this.sequence}.json`;
    await this.request(this.fs,'writeFile',{filePath:archiveFilePath,data:serialized,encoding:'utf8'});this.guard(epoch);
    // Stage first, then compare identifiers AND content once more immediately before mutation.
    const remote=await this.readDirect(epoch);if(token(remote)!==confirmation.remoteToken){const error=Error('云端进度已变化，请刷新后重新确认。');error.conflict=true;throw error;}
    this.checkLocal(savedConfirmation,profile);
    this.guard(epoch);this.lastWriteAt=this.now();
    const options={archiveMetaData:{name:CLOUD_SLOT,summary:cloudSummary(profile),playtime:0},archiveFilePath};if(remote&&!remote.legacy)options.archiveUUID=remote.uuid;
    const result=await this.request(this.cloud,remote&&!remote.legacy?'updateArchive':'createArchive',options);
    // The mutation may have committed even after the panel closes; no subsequent local changes.
    this.guard(epoch);if((!remote||remote.legacy)&&(typeof result?.uuid!=='string'||!result.uuid)){this.blocked=true;throw Error('云端未返回有效备份标识，结果未知，请重新进入游戏核对。');}
    return data;
  });}
  restore(profile,confirmation,epoch){return this.enqueue(async()=>{
    const remote=await this.verify(epoch,confirmation,profile);if(!remote)throw Error('暂无云端进度可恢复。');this.guard(epoch);
    const result=restoreCloudProfile(profile,remote.data.profile,confirmation.localRaw);if(!result.ok)throw Error(result.error);return remote.data;
  });}
}
