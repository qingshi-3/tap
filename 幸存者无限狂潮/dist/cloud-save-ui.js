import {CloudSave,cloudSummary} from './cloud-save.js';
import {createAdTestUI} from './ad-test-ui.js';
import {getLocalSavedAt} from './campaign.js';
const time=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('zh-CN'):'未记录';
export function createCloudSaveUI({profile,canOpen,onRestore=()=>{},onAbout=()=>{}}){
  const dialog=document.getElementById('cloud-save-dialog'),find=id=>document.getElementById(id);
  const adTest=createAdTestUI(dialog);
  const service=new CloudSave({isAllowed:()=>dialog.open&&canOpen()&&!document.hidden});
  let epoch=0,busy=false,remote=null,confirmation=null,action=null,ready=false;
  function buttons(){find('cloud-backup').disabled=busy||!ready||!service.available||service.blocked;find('cloud-restore').disabled=busy||!ready||!remote||service.blocked;find('cloud-refresh').disabled=busy||!service.available||service.blocked;find('cloud-confirm').disabled=busy;find('cloud-cancel-confirm').disabled=busy;}
  function summaries(){find('cloud-local-summary').textContent=cloudSummary(profile);find('cloud-local-time').textContent=`本机保存：${time(getLocalSavedAt())}`;find('cloud-remote-summary').textContent=remote?cloudSummary(remote.data.profile):ready?'尚无云端备份':'尚未读取';find('cloud-remote-time').textContent=remote?`云端备份：${time(remote.data.savedAt)}`:'';}
  function resetConfirmation(){confirmation=null;action=null;find('cloud-confirmation').hidden=true;}
  function close(){service.cancel();epoch=0;busy=false;ready=false;resetConfirmation();if(dialog.open)dialog.close();}
  async function load(){
    if(busy)return;resetConfirmation();busy=true;ready=false;buttons();const current=epoch;
    find('cloud-status').textContent='正在核对当前宿主云档…';
    try{const result=await service.read(current);if(epoch!==current)return;remote=result;ready=true;find('cloud-status').textContent='已读取当前宿主云档。备份或恢复前将再次核对。';}
    catch(error){if(epoch!==current)return;remote=null;find('cloud-status').textContent=error.message;}
    finally{if(epoch===current){busy=false;summaries();buttons();}}
  }
  function request(next){
    if(busy||!ready)return;try{confirmation=service.prepare(profile,remote);}catch(error){find('cloud-status').textContent=error.message;return;}
    action=next;find('cloud-confirmation').hidden=false;
    find('cloud-confirm-text').textContent=next==='restore'?'恢复会替换本机全部养成进度；原始本机档案将先保留备份。确认使用上方云端进度？':remote?'备份会覆盖上方云端进度。确认用本机完整养成进度覆盖？':'这将创建当前宿主的首份云端备份。确认上传本机完整养成进度？';
    find('cloud-confirm').textContent=next==='restore'?'确认恢复':remote?'确认覆盖云端':'确认首次备份';find('cloud-cancel-confirm').focus();
  }
  async function confirm(){
    if(busy||!confirmation||!action)return;const current=epoch,chosen=action,snapshot=confirmation;busy=true;buttons();
    find('cloud-status').textContent=chosen==='restore'?'正在重新核对云档并保留本机备份…':'本机先保存，正在重新核对并备份到云端…';
    try{const data=await service[chosen==='restore'?'restore':'backup'](profile,snapshot,current);if(epoch!==current)return;remote={...(remote||{}),data};ready=false;resetConfirmation();if(chosen==='restore')onRestore();find('cloud-status').textContent=(chosen==='restore'?'已恢复并可靠保存到本机；本机原档案备份已保留。':'云端备份成功。本机进度仍保留，换设备需手动恢复。')+' 再次操作请先刷新云端。';}
    catch(error){
      if(epoch!==current)return;resetConfirmation();ready=false;find('cloud-status').textContent=error.message;
      if(error.conflict){try{const latest=await service.read(current);if(epoch!==current)return;remote=latest;ready=true;find('cloud-status').textContent='云端进度已变化，本次操作已拒绝。已刷新云档，请核对上方概要并重新确认。';}catch(refreshError){if(epoch===current)find('cloud-status').textContent=refreshError.message;}}
    }
    finally{if(epoch===current){busy=false;buttons();summaries();find('cloud-refresh').focus();}}
  }
  find('cloud-close').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>{service.cancel();epoch=0;});
  find('cloud-refresh').addEventListener('click',load);find('cloud-backup').addEventListener('click',()=>request('backup'));find('cloud-restore').addEventListener('click',()=>request('restore'));find('cloud-confirm').addEventListener('click',confirm);find('cloud-cancel-confirm').addEventListener('click',()=>{resetConfirmation();buttons();find('cloud-backup').focus();});
  find('cloud-about').addEventListener('click',()=>{close();onAbout();});
  return {close,open(){if(!canOpen()||document.hidden)return;service.cancel();epoch=service.begin();busy=false;ready=false;remote=null;resetConfirmation();dialog.showModal();adTest.open();summaries();buttons();find('cloud-close').focus();if(service.available)load();else find('cloud-status').textContent='普通浏览器只使用本机进度。云端功能需支持云存档的 TapTap 手机宿主；不会要求自建登录。';}};
}
