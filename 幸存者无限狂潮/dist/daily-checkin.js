import {getDailyCheckinState,claimDailyCheckin,grantDailyCheckinBonus} from './campaign.js';
import {RewardedAd} from './rewarded-ad.js';

export class DailyCheckinBonus {
  constructor({profile,adapter=new RewardedAd(),now=()=>Date.now(),isAllowed=()=>true}) {
    Object.assign(this,{profile,adapter,now,isAllowed});this.busy=false;this.receipt=null;this.generation=0;
  }
  get available(){return this.adapter.available&&!this.adapter.blocked;}
  valid(receipt){return this.isAllowed()&&receipt.generation===this.generation&&receipt.snapshot===JSON.stringify(this.profile)&&receipt.day===this.profile.dailyCheckin?.day;}
  async watch(){
    if(this.busy)return {ok:false,message:'视频正在播放，请稍候。'};
    if(this.receipt)return {ok:false,pending:true,message:'视频已看完，请重试保存奖励，无需重看。'};
    if(!this.isAllowed())return {ok:false,message:'当前无法领取签到奖励。'};
    if(!this.available)return {ok:false,message:'广告暂时无法播放，可直接免费领取签到奖励。'};
    const now=this.now();let state=getDailyCheckinState(this.profile,now);
    // Direct ad entry saves the free share first, so cancellation never loses it.
    if(state.canClaim){
      const base=claimDailyCheckin(this.profile,now);
      if(!base.ok)return base;
      state=getDailyCheckinState(this.profile,now);
    }
    if(!state.canDouble)return {ok:false,message:state.clockRollback?'请校准设备日期后再试。':'今日签到加领已完成。'};
    const receipt={day:state.day,snapshot:JSON.stringify(this.profile),generation:++this.generation};
    this.busy=true;
    try{
      const result=await this.adapter.show({isContextValid:()=>this.valid(receipt)});
      if(!this.valid(receipt))return {ok:false,message:'签到页面或进度已变化，本次请求已失效。'};
      if(result.status!=='completed')return {ok:false,message:result.message||'视频未完整观看，加领奖励机会保留。'};
      this.receipt=receipt;return this.retrySave();
    }finally{if(receipt.generation===this.generation)this.busy=false;}
  }
  retrySave(){
    if(!this.receipt||!this.valid(this.receipt)){this.receipt=null;return {ok:false,message:'观看凭证已失效，未发放加领奖励。'};}
    // A video started before midnight belongs to its original sign-in day.
    const result=grantDailyCheckinBonus(this.profile,this.receipt.day,this.now());
    if(result.ok)this.receipt=null;
    return {...result,pending:!result.ok,message:result.ok?result.message:`视频已看完，奖励尚未保存：${result.message} 请保留此页面重试，无需重看。`};
  }
  cancel(){this.generation++;this.busy=false;this.receipt=null;this.adapter.cancel();}
}

export function createDailyCheckinUI({profile,canOpen,isCurrent=canOpen,onChange=()=>{}}){
  const find=id=>document.getElementById(id),dialog=find('daily-dialog');
  const bonus=new DailyCheckinBonus({profile,isAllowed:()=>dialog.open&&isCurrent()});
  let timer,opening=0;
  function schedule(){
    clearTimeout(timer);
    // One timer at the next fixed UTC+8 day boundary; no frame-by-frame clock polling.
    const dayMs=86400000,delay=dayMs-((Date.now()+8*3600000)%dayMs)+50;
    timer=setTimeout(()=>{if(dialog.open)render();onChange();schedule();},delay);
  }
  function render(){
    const state=getDailyCheckinState(profile),pending=!!bonus.receipt;
    find('daily-count').textContent=`累计签到 ${state.totalDays} 天`;
    find('daily-summary').textContent=state.clockRollback?'设备日期早于上次签到，请校准日期后再试。':state.bonusClaimed?'今日已领取 120 金币、16 材料，明日再来。':state.baseClaimed?'今日免费奖励已到账，可自愿看广告再领一份。':'今日免费奖励：60 金币、8 材料。';
    find('daily-base').disabled=bonus.busy||pending||!state.canClaim;
    find('daily-base').textContent=state.baseClaimed?'免费奖励已领取':'免费领取';
    find('daily-double').disabled=bonus.busy||pending||!(state.canClaim||state.canDouble)||!bonus.available;
    find('daily-double').textContent=bonus.busy?'视频播放中…':state.bonusClaimed?'今日加领已完成':state.baseClaimed?'看广告再领一份':'看广告领双份';
    find('daily-retry').hidden=!pending;find('daily-retry').disabled=bonus.busy;
  }
  function close(){opening++;bonus.cancel();if(dialog.open)dialog.close();}
  find('daily-close').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{opening++;bonus.cancel();onChange();document.querySelector('.home-daily')?.focus({preventScroll:true});});
  find('daily-base').addEventListener('click',()=>{
    if(bonus.busy||bonus.receipt||!dialog.open||!canOpen())return;
    const result=claimDailyCheckin(profile);find('daily-status').textContent=result.message;render();onChange();
  });
  find('daily-double').addEventListener('click',async()=>{
    if(bonus.busy||bonus.receipt||!dialog.open||!canOpen()||!bonus.available)return;
    const current=opening;find('daily-status').textContent='正在准备签到奖励…';
    const pending=bonus.watch();render();onChange();
    if(bonus.busy)find('daily-status').textContent='免费奖励已保存；完整观看后再领取 60 金币、8 材料。';
    try{const result=await pending;if(current===opening&&dialog.open){find('daily-status').textContent=result.message;render();onChange();}}
    catch{if(current===opening&&dialog.open){find('daily-status').textContent='广告暂时无法播放，免费奖励保留。';render();}}
  });
  find('daily-retry').addEventListener('click',()=>{if(bonus.busy||!dialog.open||!canOpen())return;const result=bonus.retrySave();find('daily-status').textContent=result.message;render();onChange();});
  window.addEventListener('pagehide',close);
  window.addEventListener('pageshow',()=>{if(dialog.open)render();onChange();schedule();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(dialog.open)render();onChange();schedule();}});
  schedule();
  return {close,open(){
    if(!canOpen()||document.hidden||dialog.open)return;
    opening++;dialog.showModal();render();
    find('daily-status').textContent=bonus.adapter.blocked?'广告请求已中断，请重新进入游戏后再试。免费签到不受影响。':bonus.available?'免费奖励可直接领取，广告加领每天一次。':'当前环境不支持广告播放，免费签到可正常领取。';
    find('daily-close').focus();
  }};
}
