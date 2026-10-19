import {getAdRewardBonus,grantAdGoldBonus} from './campaign.js';
const safe=fn=>{try{fn();}catch{}};
export class RewardedAd {
  constructor({tap,timeoutMs=120000,loadTimeoutMs=15000}={}){this.injectedTap=tap;this.timeoutMs=timeoutMs;this.loadTimeoutMs=loadTimeoutMs;this.active=null;this.used=new WeakSet();this.blocked=false;}
  // TapTap may inject its bridge after the module and adapter are constructed.
  get tap(){return this.injectedTap===undefined?globalThis.tap:this.injectedTap;}
  get available(){try{return typeof this.tap?.createRewardedVideoAd==='function';}catch{return false;}}
  selfTest(options={}){return this.show(options);}
  valid(check){try{return check();}catch{return false;}}
  show({isContextValid=()=>true}={}){
    if(this.active)return Promise.resolve({status:'busy',message:'视频正在播放，请稍候。'});
    if(this.blocked)return Promise.resolve({status:'error',message:'无法确认旧视频请求已结束，请重新进入游戏后再试。'});
    if(!this.available)return Promise.resolve({status:'unavailable',message:'当前环境不支持 TapTap 激励视频，正常奖励仍完整保留。'});
    if(!this.valid(isContextValid))return Promise.resolve({status:'cancelled',message:'本次请求已失效，本次请求已取消。'});
    let ad;try{ad=this.tap.createRewardedVideoAd({adUnitId:'1054323'});}catch{return Promise.resolve({status:'error',message:'视频暂时无法创建，正常奖励仍保留。'});}
    if(!ad||typeof ad!=='object'||typeof ad.show!=='function'||typeof ad.load!=='function'||typeof ad.onClose!=='function'){safe(()=>ad?.destroy?.());return Promise.resolve({status:'error',message:'宿主未提供有效视频实例。'});}
    if(this.used.has(ad)){this.blocked=true;return Promise.resolve({status:'error',message:'宿主复用了旧视频实例，无法安全区分回调。请重新进入游戏后再试。'});}
    this.used.add(ad);
    return new Promise(resolve=>{
      const request={ad,resolve,isContextValid,settled:false,recovery:false,phase:'loading'};this.active=request;
      const finish=result=>this.finish(request,result);
      request.onLoad=()=>{if(this.active===request&&!request.settled&&request.loadWait){const wait=request.loadWait;request.loadWait=null;clearTimeout(wait.timer);wait.resolve();}};
      request.onClose=result=>{if(this.active!==request||request.settled)return;if(!['showing','showing-retry','await-close'].includes(request.phase)){this.blocked=true;finish({status:'error',message:'视频回调时序异常，无法安全确认观看，请重新进入后再试。'});return;}finish(result?.isEnded===true&&this.valid(isContextValid)?{status:'completed'}:{status:'cancelled',message:'视频未完整观看或本次请求已失效，未领取奖励。'});};
      request.onError=()=>{if(this.active!==request||request.settled)return;if(request.loadWait){const wait=request.loadWait;request.loadWait=null;clearTimeout(wait.timer);wait.reject(Error('load failed'));}else if(request.phase==='showing'&&!request.recovery)void recover();else finish({status:'error',message:'视频加载或播放失败，正常奖励仍保留。'});};
      const startPlaybackTimer=()=>{if(request.timer)return;request.timer=setTimeout(()=>{if(this.active!==request)return;this.blocked=true;finish({status:'error',message:'视频响应超时，未发放奖励。可继续游戏；请重新进入后再播放视频。'});},this.timeoutMs);};
      const current=()=>this.active===request&&!request.settled&&this.valid(isContextValid);
      const load=()=>new Promise((resolve,reject)=>{
        const wait={resolve,reject};request.loadWait=wait;
        wait.timer=setTimeout(()=>{if(this.active===request&&request.loadWait===wait){this.blocked=true;finish({status:'error',message:'视频加载超时，未发放奖励。可继续游戏；请重新进入后再播放视频。'});}},this.loadTimeoutMs);
        const fail=error=>{if(request.loadWait===wait){request.loadWait=null;clearTimeout(wait.timer);reject(error);}};
        const ready=()=>{if(request.loadWait===wait){request.loadWait=null;clearTimeout(wait.timer);resolve();}};
        try{const loading=ad.load();if(loading?.then)loading.then(()=>{if(typeof ad.onLoad!=='function')ready();},fail);else if(typeof ad.onLoad!=='function')ready();}catch(error){fail(error);}
        // A void or resolved load return is not readiness: callback SDKs signal onLoad.
      });
      const recover=async()=>{
        if(!current()||request.recovery)return;request.recovery=true;request.phase='loading-retry';
        try{await load();if(!current()){if(this.active===request)finish({status:'cancelled',message:'本次请求已失效。'});return;}request.phase='showing-retry';await ad.show();if(current())request.phase='await-close';}
        catch{if(this.active===request)finish({status:'error',message:'视频重试失败，未领取奖励。'});}
      };
      try{ad.onLoad?.(request.onLoad);ad.onError?.(request.onError);ad.onClose(request.onClose);}catch{finish({status:'error',message:'宿主视频回调不可用。'});return;}
      void(async()=>{
        try{await load();if(!current()){if(this.active===request)finish({status:'cancelled',message:'本次请求已失效。'});return;}startPlaybackTimer();request.phase='showing';try{await ad.show();if(current()&&!request.recovery)request.phase='await-close';}catch{await recover();}}
        catch{if(this.active===request)finish({status:'error',message:'视频加载失败，未领取奖励。'});}
      })();
      // show() resolving only confirms presentation. Only strict onClose.isEnded earns a receipt.
    });
  }
  finish(request,result){
    if(this.active!==request||request.settled)return;request.settled=true;this.active=null;clearTimeout(request.timer);
    if(request.loadWait){const wait=request.loadWait;request.loadWait=null;clearTimeout(wait.timer);wait.reject(Error('request ended'));}
    safe(()=>request.ad.offLoad?.(request.onLoad));safe(()=>request.ad.offError?.(request.onError));safe(()=>request.ad.offClose?.(request.onClose));safe(()=>request.ad.destroy?.());request.resolve(result);
  }
  cancel(){if(!this.active)return;this.blocked=true;this.finish(this.active,{status:'cancelled',message:'已离开本次请求，旧视频请求已失效。'});}
}
export class AdGoldBonus {
  constructor({getContext,adapter=new RewardedAd()}={}){this.getContext=getContext;this.adapter=adapter;this.busy=false;this.receipt=null;this.generation=0;}
  get available(){return this.adapter.available&&!this.adapter.blocked;}
  amount(){return this.amounts().gold;}
  amounts(){const c=this.getContext();return c?.resultVisible&&c.settlementOk?getAdRewardBonus(c.profile,c.runId):{gold:0,materials:0};}
  valid(receipt){const c=this.getContext();return c?.resultVisible&&c.settlementOk&&c.profile===receipt.context.profile&&c.gameRef===receipt.context.gameRef&&c.runId===receipt.context.runId&&JSON.stringify(c.profile)===receipt.snapshot;}
  async watch(){
    if(this.busy)return {ok:false,message:'视频正在播放。'};
    if(this.receipt)return {ok:false,pending:true,message:'视频已完整看完，请重试保存奖励，无需重看。'};
    const context=this.getContext();if(this.amount()<=0)return {ok:false,message:'本局不符合额外奖励领取条件。'};
    const receipt={context,snapshot:JSON.stringify(context.profile)},generation=++this.generation;this.busy=true;
    try{const result=await this.adapter.show({isContextValid:()=>this.generation===generation&&this.valid(receipt)});if(result.status!=='completed')return {ok:false,message:result.message};if(this.generation!==generation||!this.valid(receipt))return {ok:false,message:'结算已变化，旧视频不能领取本局奖励。'};this.receipt=receipt;return this.retrySave();}
    finally{if(this.generation===generation)this.busy=false;}
  }
  retrySave(){
    const receipt=this.receipt;if(!receipt||!this.valid(receipt)){this.receipt=null;return {ok:false,message:'没有当前结算的有效观看凭证，未发放额外奖励。'};}
    const result=grantAdGoldBonus(receipt.context.profile,receipt.context.runId);if(result.ok)this.receipt=null;
    return {...result,pending:!result.ok,message:result.ok?result.message:`视频已完整看完，但奖励尚未保存：${result.message}。请保留此页面并重试保存，无需重看。`};
  }
  cancel(){this.generation++;this.receipt=null;this.busy=false;this.adapter.cancel();}
}
