import {RecruitmentPresentation} from './recruitment-presentation.js';
import { watchDailyAdRefresh } from './daily-ad-rewards.js';
import { CARDS } from './cards.js';
import { cardRuleSections } from './card-rules.js';
import { rewardedAd } from './rewarded-ad.js';

const node=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text!=null)el.textContent=text;return el;};
const button=(text,action,key=action)=>{const el=node('button','recruitment-button',text);el.type='button';el.dataset.recruitmentAction=action;el.dataset.focusKey=key;return el;};
const cardName=id=>CARDS[id]?.name||`卡牌 ${id}`;
const resource=(kind,amount,plus=false)=>{const el=node('span',`recruitment-resource recruitment-resource-${kind}`),img=node('img','');img.src=`./assets/metagame/original/${kind==='orb'?'spirit-orb.png':'resource-gold.png'}`;img.alt=kind==='orb'?'宝珠':'金币';el.append(img,node('strong','',`${plus?'+':''}${amount}`));return el;};
const requestId=()=>globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`;

// A reveal is presentation only: every displayed result already has a saved receipt.
export class RecruitmentUI {
  constructor({progress,drawCardArt,onClose=()=>{},ad=rewardedAd,onReward=()=>{}}){
    Object.assign(this,{progress,drawCardArt,onClose,ad,onReward});
    this.view='home';this.previewId=null;this.notice='';this.receipt=null;this.selectedDraw=1;this.session=null;this.revealing=false;
    this.dialog=node('dialog','recruitment-dialog');this.presentation=new RecruitmentPresentation({host:this.dialog,drawCardArt});this.presentedDoubles=new Set();this.presentationToken=0;this.dialog.setAttribute('aria-label','招募');
    // This modal is attached to body, outside the game root's native-gesture guard.
    for(const type of ['contextmenu','selectstart','dragstart'])this.dialog.addEventListener(type,event=>{
      if(!event.target.closest('input,textarea,[contenteditable="true"]'))event.preventDefault();
    },{capture:true});
    this.dialog.addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const targets=[...this.dialog.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length),first=targets[0],last=targets.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
    this.dialog.addEventListener('cancel',event=>{if(this.session?.earned){event.preventDefault();this.notice='奖励尚未保存，请重试领取。';this.render();}});
    this.dialog.addEventListener('click',event=>{
      const target=event.target.closest('[data-recruitment-action]');if(!target||target.disabled)return;
      switch(target.dataset.recruitmentAction){
        case 'close':this.dialog.close();break;
        case 'home':this.finishReveal();this.view='home';this.notice='';this.render();break;
        case 'pool':this.view='pool';this.notice='';this.render();break;
        case 'preview':this.previewId=Number(target.dataset.cardId);this.view='pool';this.render();break;
        case 'draw':this.draw(Number(target.dataset.count));break;
        case 'results':this.receipt=this.progress.recruitmentStatus().lastReceipt;this.selectedDraw=1;this.view='results';this.render();break;
        case 'select-result':this.selectedDraw=Number(target.dataset.index);this.render();break;
        case 'skip':this.finishReveal();this.render();break;
        case 'claim':this.claim();break;
        case 'ad':void this.watchAd('orb');break;
        case 'double':void this.watchAd('double');break;
      }
    });
    this.dialog.addEventListener('close',()=>{
      if(this.dialog.open)return;
      this.finishReveal();this.stopDailyRefresh?.();this.stopDailyRefresh=null;
      const session=this.session;
      // Keep an earned, unsaved entitlement in this controller for safe reopening.
      if(session&&!session.earned){this.session=null;if(session.busy)this.ad.cancel();this.cancelAd(session);}
      this.onClose();const trigger=this.returnFocus?.isConnected?this.returnFocus:document.querySelector('[data-action="recruitment"]');trigger?.focus({preventScroll:true});
    });
    window.addEventListener('pagehide',()=>this.invalidate());document.body.append(this.dialog);
  }
  cancelAd(session){return session.kind==='double'?this.progress.cancelRecruitmentDouble(session.requestId):this.progress.cancelDailyAd('orb',session.requestId);}
  invalidate(){const session=this.session;this.session=null;if(session&&!session.earned){if(session.busy)this.ad.cancel();this.cancelAd(session);}if(this.dialog.open)this.dialog.close();}
  open(){
    if(this.dialog.open)return;
    this.stopDailyRefresh?.();this.stopDailyRefresh=null;this.finishReveal();
    this.returnFocus=document.activeElement;
    this.receipt=this.progress.recruitmentStatus().lastReceipt??null;
    if(!this.session&&this.receipt)for(const draw of this.receipt.draws){const offer=this.progress.recruitmentDoubleOffer(this.receipt.id,draw.index);if(offer.pending){this.session={kind:'double',requestId:offer.pending.requestId,earned:offer.watched,busy:false,receiptId:this.receipt.id,index:draw.index};this.selectedDraw=draw.index;break;}}
    this.view=this.session?.kind==='double'?'results':'home';this.notice='';this.render();this.dialog.showModal();this.dialog.querySelector('button:not(:disabled)')?.focus();
    this.stopDailyRefresh=watchDailyAdRefresh(()=>{if(this.dialog.open&&!this.session?.busy)this.render();});
  }
  art(id,className='recruitment-art',size=176){const canvas=node('canvas',className);canvas.width=canvas.height=size;canvas.setAttribute('aria-hidden','true');try{this.drawCardArt?.(canvas,id)?.catch?.(()=>{});}catch(_){}return canvas;}
  render(){
    const focusKey=this.dialog.contains(document.activeElement)?document.activeElement.dataset.focusKey:null;
    const scroll=this.dialog.querySelector('.recruitment-pool-grid')?.scrollTop||0;
    const status=this.progress.recruitmentStatus(),ids=(status.recipes||[]).map(r=>r.cardId);
    if(!ids.includes(this.previewId))this.previewId=ids[0]??null;
    if(status.lastReceipt&&this.receipt?.id===status.lastReceipt.id)this.receipt=status.lastReceipt;
    this.dialog.dataset.view=this.view;this.dialog.classList.toggle('is-revealing',this.revealing);
    const header=node('header','recruitment-header'),close=button('返回',this.view==='home'?'close':'home');
    close.disabled=!!this.session?.earned||!!this.session?.busy;close.setAttribute('aria-label',this.view==='home'?'关闭招募':'返回招募');
    const titleText=this.view==='pool'?'奖池':this.view==='results'?'招募结果':'招募';this.dialog.setAttribute('aria-label',titleText);
    header.append(close);if(this.view!=='home')header.append(node('h2','',titleText));
    const assets=node('div','recruitment-assets');assets.append(resource('gold',this.progress.state.coins),resource('orb',status.tickets));header.append(assets);
    const content=node('section','recruitment-content');
    if(this.view==='pool')this.buildPool(content,status,ids);else if(this.view==='results'&&this.receipt)this.buildResults(content,status);else this.buildHome(content,status,ids);
    const error=status.error||this.progress.error;const notice=node('p','recruitment-notice',this.notice||(/写入远征存档失败/.test(error)?'保存失败，请重试。':error));notice.hidden=!notice.textContent;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    this.dialog.replaceChildren(header,content,notice);
    if(this.view==='pool')this.dialog.querySelector('.recruitment-pool-grid').scrollTop=scroll;
    [...this.dialog.querySelectorAll('[data-focus-key]')].find(el=>el.dataset.focusKey===focusKey&&!el.disabled)?.focus({preventScroll:true});
  }
  buildHome(content,status,ids){
    content.classList.add('recruitment-home');const stage=node('div','recruitment-showcase');
    for(const id of [...ids.slice(6,9),...ids].filter((id,i,a)=>a.indexOf(id)===i).slice(0,3)){
      const featured=button('','preview',`featured-${id}`);featured.className='recruitment-featured';featured.dataset.cardId=id;featured.setAttribute('aria-label',`查看${cardName(id)}`);
      featured.append(this.art(id,'recruitment-featured-art',240),node('strong','',cardName(id)));stage.append(featured);
    }
    if(!ids.length)stage.append(node('p','recruitment-rule','已集齐全部招募随从'));
    const info=node('div','recruitment-home-info'),pool=button(`奖池一览 ${ids.length}`,'pool');pool.disabled=!ids.length;
    if(ids.length)info.append(node('p','recruitment-rule',status.locked?'通关第3关开放招募':'每抽必得碎片 · 30片合成'));
    info.append(pool,this.adButton(status));
    if(status.lastReceipt)info.append(button('上次结果','results'));
    const claimable=(status.recipes||[]).filter(r=>(status.eligibleTargets||[]).includes(r.cardId)&&(status.fragments[r.cardId]||0)>=r.fragmentsRequired);
    if(claimable.length){const claim=button(`合成 ${claimable.length} 位随从`,'claim');claim.disabled=!!status.error||!!this.session||!!status.pendingDrawCount;info.append(claim);}
    const footer=node('div','recruitment-home-footer');footer.append(this.drawActions(status));
    if(!status.locked&&!status.allOwned&&status.tickets<1)footer.append(node('span','recruitment-balance-note','宝珠不足'));
    content.append(stage,info,footer);
  }
  drawActions(status){
    const actions=node('div','recruitment-draw-actions'),cost=status.pools?.[0]?.ticketCost??1;
    for(const count of[1,10]){const retry=status.pendingDrawCount===count,draw=button(retry?'重试保存':count===1?'招募一次':'招募十次','draw',`draw-${count}`);draw.dataset.count=count;draw.append(resource('orb',cost*count));draw.disabled=!!status.error||status.locked||status.allOwned||status.tickets<cost*count||!!this.session||!!status.pendingDrawCount&&!retry;draw.setAttribute('aria-label',retry?'重试保存招募结果':`${count===1?'招募一次':'招募十次'}，消耗${cost*count}宝珠`);actions.append(draw);}return actions;
  }
  adButton(status){
    const holder=node('div','recruitment-ad'),offer=this.progress.resourceRewardOffer('orb');if(!status.adEnabled)return holder;
    const session=this.session?.kind==='orb'?this.session:null;
    const ad=button(session?.earned?'重试领取宝珠':session?.busy?'广告播放中…':offer.eligible?'广告领宝珠':'今日宝珠已领取','ad');ad.disabled=!!this.session?.busy||!!status.error||!!status.pendingDrawCount||(!offer.eligible&&!session?.earned)||!!this.session&&this.session.kind!=='orb';
    if(offer.eligible&&!session)ad.append(resource('orb',offer.range));holder.append(ad);return holder;
  }
  buildPool(content,status,ids){
    content.classList.add('recruitment-pool');const grid=node('div','recruitment-pool-grid');grid.setAttribute('aria-label','奖池随从');
    for(const id of ids){const owned=!(status.eligibleTargets||[]).includes(id),choice=button('','preview',`pool-${id}`);choice.className='recruitment-pool-unit';choice.dataset.cardId=id;choice.setAttribute('aria-pressed',String(this.previewId===id));choice.setAttribute('aria-label',`查看${cardName(id)}${owned?'，已拥有':''}`);choice.append(this.art(id,'recruitment-pool-art',112),node('strong','',cardName(id)),node('small','',owned?'已拥有':`${status.fragments[id]||0}/30`));grid.append(choice);}
    const detail=node('div','recruitment-pool-detail'),card=CARDS[this.previewId];
    if(card){const portrait=node('div','recruitment-detail-portrait');portrait.append(this.art(card.id,'recruitment-detail-art',200),node('h3','',card.name));const stats=node('p','recruitment-detail-stats',`${card.cost}费\n${card.attack}攻　${card.health}血`);portrait.append(stats);detail.append(portrait);
      const rules=node('div','recruitment-pool-rules');rules.tabIndex=0;rules.setAttribute('aria-label',`${card.name}技能`);for(const item of cardRuleSections(card)){const text=node('p','');if(item.label!=='规则')text.append(node('strong','',item.label+'：'));text.append(document.createTextNode(item.text));rules.append(text);}detail.append(rules);}
    const odds=node('p','recruitment-probability'),rewards=status.randomConfig?.rewards??[],total=rewards.reduce((n,r)=>n+r.weight,0);odds.append(node('span','',rewards.map(r=>`${r.amount}片 ${Number((r.weight/total*100).toFixed(2))}%`).join('　')),node('span','',`${ids.length}位随从等概率 · 每抽另得`),resource('gold',status.randomConfig?.coinsPerDraw??20));content.append(grid,detail,odds);
  }
  buildResults(content,status){
    content.classList.add('recruitment-results');const receipt=this.receipt,grid=node('div',`recruitment-result-grid${receipt.count===1?' is-single':''}`);
    if(!receipt.draws.some(d=>d.index===this.selectedDraw))this.selectedDraw=receipt.draws[0].index;
    for(const draw of receipt.draws){
      const offer=this.progress.recruitmentDoubleOffer(receipt.id,draw.index),result=button('','select-result',`result-${draw.index}`);result.className='recruitment-result';result.dataset.index=draw.index;result.style.setProperty('--reveal-index',draw.index-1);result.setAttribute('aria-pressed',String(this.selectedDraw===draw.index));result.disabled=this.revealing||!!this.session;
      if(draw.rewards.some(r=>r.newUnit))result.classList.add('is-new');if(offer.claimed)result.classList.add('is-doubled');
      const main=draw.rewards.find(r=>r.kind==='fragments');result.setAttribute('aria-label',`第${draw.index}抽，${cardName(main?.cardId)}${offer.claimed?'，已翻倍':''}`);
      if(main)result.append(this.art(main.cardId,'recruitment-result-art',180),node('strong','recruitment-result-name',cardName(main.cardId)));
      const values=node('div','recruitment-result-values');for(const reward of draw.rewards){
        if(reward.kind==='fragments'){values.append(node('span','recruitment-fragment',`${reward.cardId!==main?.cardId?cardName(reward.cardId)+' ':''}${reward.source==='legacy'?'旧保底':'碎片'} +${reward.amount*(offer.claimed?2:1)}`));}
        else if(reward.kind==='coins')values.append(resource('gold',reward.amount*(offer.claimed?2:1),true));
      }
      for(const reward of draw.rewards.filter(r=>r.kind==='unit'))values.append(node('span','recruitment-legacy-unit',`旧保底补发：${cardName(reward.cardId)}`));
      result.append(values);
      if(draw.rewards.some(r=>r.kind==='fragments'&&r.cardId===main?.cardId&&r.newUnit))result.append(node('span','recruitment-new-unit','已合成'));
      else if(main&&receipt.count===1)result.append(node('span','recruitment-owned',!(status.eligibleTargets||[]).includes(main.cardId)?'已拥有':`${status.fragments[main.cardId]??0}/30片`));
      if(offer.claimed&&receipt.count>1)result.append(node('span','recruitment-doubled','×2'));grid.append(result);
    }
    const footer=node('div','recruitment-result-footer');
    if(this.revealing){footer.append(button('跳过动画','skip'));}
    else{
      const offer=this.progress.recruitmentDoubleOffer(receipt.id,this.selectedDraw),session=this.session?.kind==='double'?this.session:null;
      const controls=node('div','recruitment-double-controls'),double=button(session?.earned?'重试保存翻倍奖励':session?.busy?'广告播放中…':offer.claimed?'本抽已翻倍':offer.remaining===0?'今日翻倍次数已用完':`广告 · ${receipt.count===1?'本抽':`第${this.selectedDraw}抽`}翻倍`,'double');
      double.disabled=!!session?.busy||!!status.error||(!offer.eligible&&!session?.earned)||!!this.session&&this.session.kind!=='double';
      controls.append(double,node('span','recruitment-double-quota',`今日剩余 ${offer.remaining??0}/10 · 每广告1抽`));
      const done=button('直接收下','home');done.disabled=!!this.session;footer.append(controls,done);
    }
    content.append(grid,footer);
  }
  draw(count=1){
    if(this.session||this.revealing)return;const pool=this.progress.recruitmentStatus().pools?.[0],result=this.progress.drawRecruitment(pool?.id??'premium',count);
    if(result.ok){this.receipt=result;this.selectedDraw=1;this.view='results';this.notice='';void this.present('draw',result);}
    else{this.notice=/写入远征存档失败/.test(result.error)?'保存失败，请重试。':result.error;this.render();}
  }
  async present(kind,payload){
    const token=++this.presentationToken;this.revealing=true;this.render();const balances={gold:this.progress.state.coins,orb:this.progress.recruitmentStatus().tickets};
    if(kind==='draw')await this.presentation.showDraw(payload,balances);else await this.presentation.showDouble({...payload,balances});
    if(token!==this.presentationToken)return;
    this.revealing=false;if(this.dialog.open){this.render();this.dialog.querySelector('[data-recruitment-action=home]:not(:disabled)')?.focus({preventScroll:true});}
  }
  finishReveal(){this.presentationToken++;this.presentation.dismiss();this.revealing=false;}
  claim(){const result=this.progress.synthesizeAvailableCards();this.notice=result.ok?`${result.cardIds.map(cardName).join('、')}已加入收藏。`:result.error;this.render();}
  async watchAd(kind){
    if(this.session?.busy||this.session&&this.session.kind!==kind)return;
    const session=this.session??{kind,requestId:requestId(),earned:false,receiptId:this.receipt?.id,index:this.selectedDraw};
    this.session=session;session.busy=true;let presentationPayload=null;const valid=()=>this.session===session&&this.dialog.open;
    try{
      if(!session.earned){
        const begin=kind==='double'?this.progress.beginRecruitmentDouble(session.receiptId,session.index,session.requestId):this.progress.beginDailyAd('orb',session.requestId);
        if(!begin.ok){this.notice=begin.error;this.session=null;return;}
        if(!begin.watched){this.render();const result=await this.ad.show({isContextValid:valid});if(!valid())return;
        if(result.status!=='completed'){const cancel=this.cancelAd(session);this.notice=cancel.ok?(result.message||'未完成观看，奖励与次数未变。'):'取消记录尚未保存，请重试。';if(cancel.ok)this.session=null;return;}}session.earned=true;
      }
      const reward=kind==='double'?this.progress.completeRecruitmentDouble(session.requestId):this.progress.completeDailyAd('orb',session.requestId);
      if(reward.ok){this.notice=kind==='double'?'':`宝珠 +${reward.amount}`;this.session=null;if(kind==='double'&&!reward.duplicate&&!this.presentedDoubles.has(session.requestId)){this.presentedDoubles.add(session.requestId);presentationPayload={receipt:this.receipt,drawIndex:session.index,reward,requestId:session.requestId};}if(kind==='orb'&&!reward.duplicate)this.onReward({kind:'orb',amount:reward.amount,requestId:session.requestId});}
      else this.notice='奖励尚未保存，请重试，无需再看广告。';
    }catch(error){if(valid()){this.notice=`奖励未保存：${error.message}`;if(!session.earned){this.cancelAd(session);this.session=null;}}}
    finally{session.busy=false;if(this.dialog.open){if(presentationPayload)void this.present('double',presentationPayload);else this.render();}}
  }
}
