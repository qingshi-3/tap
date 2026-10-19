// Each viewing owns its callbacks and instance. Never infer completion from show().
const usedInstances=new WeakSet();
export const AD_UNIT_ID='1054324';
export const rewardCount=s=>s.ads?.day===s.day?s.ads.claims.length:0;
export function createRewardAds({getState,save,replace,onBusy=()=>{},onResult=()=>{},onSaveError=()=>{},host=()=>globalThis.tap,timeoutMs=180000}){
 let active=null;
 const available=()=>typeof host()?.createRewardedVideoAd==='function';
 function finish(request,message,error=true){
  if(active!==request)return;
  active=null;clearTimeout(request.timer);
  try{request.ad?.offClose?.(request.close);request.ad?.offError?.(request.error);request.ad?.offLoad?.(request.load);}catch{}
  try{request.ad?.destroy?.();}catch{}
  onBusy(false);onResult(message,error);
 }
 function cancel(){if(active)finish(active,'广告已取消，未领取奖励。');}
 function request(kind){
  if(active)return false;
  const state=getState();
  if(!available()){onResult('仅在TapTap内可观看广告。',true);return false;}
  if(!state||state.phase!=='prep'||!['coins','ingredients'].includes(kind)||rewardCount(state)>=2){onResult('请在营业前领取，每游戏日最多2次。',true);return false;}
  // A failed checkpoint must never start a viewing. Compare the exact same game generation on close.
  const checkpoint=save(state);if(!checkpoint.ok){onSaveError(checkpoint.error);onResult(checkpoint.error,true);return false;}
  const r={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`,state,snapshot:JSON.stringify(state),kind,ad:null,showing:false};active=r;onBusy(true);
  r.timer=setTimeout(()=>finish(r,'广告等待超时，未领取奖励。'),timeoutMs);
  r.error=()=>finish(r,'广告暂时无法播放，未领取奖励。');r.load=()=>{};
  r.close=result=>{
   if(active!==r)return;
   if(result?.isEnded!==true||!r.showing)return finish(r,'未完整观看广告，未领取奖励。');
   const current=getState();
   if(current!==r.state||JSON.stringify(current)!==r.snapshot||current.phase!=='prep'||rewardCount(current)>=2)return finish(r,'进度已变化，未领取奖励。');
   const next=JSON.parse(r.snapshot);
   if(!next.ads||next.ads.day!==next.day)next.ads={day:next.day,claims:[]};
   next.ads.claims.push({id:r.id,kind});
   if(kind==='coins')next.coins+=80;
   else {next.inventory.mushroom+=6;next.inventory.rice+=6;next.inventory.berry+=4;}
   const saved=save(next);
   if(!saved.ok){const message=saved.error||'奖励未保存，请重新读取进度。';finish(r,message);onSaveError(message);return;}
   replace(next);finish(r,kind==='coins'?'已领取80金币。':'已领取蘑菇×6、稻米×6、浆果×4。',false);
  };
  try{
   const ad=host().createRewardedVideoAd({adUnitId:AD_UNIT_ID});
   if(!ad||typeof ad!=='object'||usedInstances.has(ad))throw new Error('instance reused');
   usedInstances.add(ad);r.ad=ad;
   if(!['onClose','onError','onLoad','show','load','destroy'].every(k=>typeof ad[k]==='function'))throw new Error('incomplete host');
   ad.onClose(r.close);ad.onError(r.error);ad.onLoad(r.load);
   const show=()=>{if(active!==r)return; r.showing=true;return ad.show();};
   Promise.resolve().then(show).catch(async()=>{
    if(active!==r)return;r.showing=false;
    try{await ad.load();if(active!==r)return;await show();}catch{r.error();}
   });
  }catch{r.error();}
  return true;
 }
 return {available,request,cancel,get busy(){return !!active;}};
}
