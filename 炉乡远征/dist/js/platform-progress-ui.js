import { FACTIONS } from './factions.js';
import { EXPEDITION_LEVELS } from './expedition-data.js';
import { platformProgressStats, collectionProgressStats } from './platform-progress.js';
import { achievementIcon } from './achievement-icons.js';
const el=(tag,className,text='')=>{const node=document.createElement(tag);node.className=className;node.textContent=text;return node;};

export class PlatformProgressUI {
  constructor({service,onChallengeStart,onChallengeResume,readChallenge=()=>({}),readProgress=()=>({})}) {
    Object.assign(this,{service,onChallengeStart,onChallengeResume,readChallenge,readProgress,epoch:0});
    this.dialog=el('dialog','platform-progress-dialog');this.dialog.id='platform-progress-dialog';
    this.dialog.setAttribute('aria-labelledby','platform-progress-title');
    const header=el('header','platform-progress-header'),navigation=el('div','platform-progress-navigation');
    this.title=el('h2','','战役排行');this.title.id='platform-progress-title';
    this.campaignButton=el('button','platform-progress-board','战役排行');this.campaignButton.dataset.boardMode='leaderboard';
    this.collectionButton=el('button','platform-progress-board','收集榜');this.collectionButton.dataset.boardMode='collection';
    this.switchButton=el('button','platform-progress-board','铁崖挑战');this.switchButton.dataset.boardMode='challenge';
    this.achievementCategory='all';this.achievementFilters=new Map();
    for(const [category,label] of [['all','全部'],['expedition','远征'],['faction','阵营'],['collection','收集'],['challenge','挑战']]){
      const button=el('button','achievement-filter',label);button.dataset.achievementCategory=category;this.achievementFilters.set(category,button);
    }
    this.closeButton=el('button','platform-progress-close','关闭');navigation.append(this.campaignButton,this.collectionButton,this.switchButton,...this.achievementFilters.values(),this.closeButton);header.append(this.title,navigation);
    this.body=el('div','platform-progress-body');this.body.tabIndex=0;
    this.status=el('p','platform-progress-status');this.status.setAttribute('role','status');
    const footer=el('footer','platform-progress-actions');
    this.action=el('button','','查看排行');this.retry=el('button','','同步进度');
    this.start=el('button','challenge-start is-primary','开始挑战');this.start.dataset.challengeAction='start';
    this.resume=el('button','challenge-resume','继续挑战');this.resume.dataset.challengeAction='resume';
    footer.append(this.start,this.resume,this.retry,this.action);this.dialog.append(header,this.body,this.status,footer);document.body.append(this.dialog);
    for(const button of this.dialog.querySelectorAll('button'))button.type='button';
    this.closeButton.onclick=()=>this.close();
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    this.dialog.addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const targets=[...this.dialog.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(node=>!node.hidden&&node.getClientRects().length);
      if(!targets.length)return;
      const index=targets.indexOf(document.activeElement),next=(index+(event.shiftKey?-1:1)+targets.length)%targets.length;
      event.preventDefault();targets[next].focus({preventScroll:true});
    });
    for(const button of [this.campaignButton,this.collectionButton,this.switchButton])button.onclick=()=>{
      if(this.mode!==button.dataset.boardMode)this.open(button.dataset.boardMode,this.opener);
    };
    for(const [category,button]of this.achievementFilters)button.onclick=()=>{
      if(this.achievementCategory===category)return;
      this.achievementCategory=category;this.resetScroller();this.render();button.focus({preventScroll:true});
    };
    this.action.onclick=()=>void this.run('open');this.retry.onclick=()=>void this.run('sync');
    this.start.onclick=()=>{this.close();this.onChallengeStart?.();};
    this.resume.onclick=()=>{this.close();this.onChallengeResume?.();};
    window.addEventListener('pagehide',()=>this.close());
  }
  capabilities(){return this.service.getCapabilities?.()??{leaderboard:false,collection:false,challenge:false,achievements:false,achievementView:false};}
  resetScroller(){const body=this.body.cloneNode(false);this.body.replaceWith(body);this.body=body;}
  hasSyncableProgress(){return this.mode==='leaderboard'?this.service.score()>0:this.mode==='collection'?this.service.collectionScore()>0:this.mode==='challenge'?!!this.readChallenge().bestResult:this.service.getAchievements().some(item=>item.configured&&item.achieved&&!item.synced);}
  open(mode,opener,{automaticSync=true}={}){
    const wasOpen=this.dialog.open;
    if(mode!==this.mode){
      // A new page must not inherit a previous touch scroll's momentum/anchor.
      this.resetScroller();
    }
    this.epoch++;Object.assign(this,{mode,opener,busy:false,notice:''});this.render();this.body.scrollTop=0;
    if(!this.dialog.open)this.dialog.showModal();
    const focus=wasOpen?[this.campaignButton,this.collectionButton,this.switchButton].find(button=>button.dataset.boardMode===mode):null;
    (focus??this.closeButton).focus({preventScroll:true});
    if(automaticSync&&this.capabilities()[mode]&&this.hasSyncableProgress())void this.run('sync',{automatic:true});
  }
  statusMessage(){
    const state=this.service.getStatus()[this.mode];
    const publication=this.mode==='achievements'&&this.capabilities().achievements&&!this.capabilities().achievementView?'平台成就发布待确认，本机成就可查看。':'';
    if(this.notice)return publication+this.notice;
    if(publication)return publication+(state&&['pending','error','stopped'].includes(state.state)?state.message:'');
    if(state?.state==='unconfigured')return this.mode==='leaderboard'?'战役榜待开通，通关进度已保存在本机。':state.message;
    if(!this.capabilities()[this.mode])return this.mode==='achievements'?'进度已保存在本机，请在TapTap内同步成就。':'请在TapTap内同步和查看排行。';
    if(state&&['pending','error','synced','stopped'].includes(state.state))return state.message;
    return this.mode==='leaderboard'?'通关后自动同步，同阵营重复通关不加分。':this.mode==='collection'?'只计不同卡牌，重复卡不加分。':this.mode==='challenge'?'借用卡池、0阶培养，不消耗远征资源。':'达成后自动同步，无需重新完成旧进度。';
  }
  render(){
    const challenge=this.mode==='challenge',achievements=this.mode==='achievements',caps=this.capabilities();
    this.title.textContent=achievements?'成就':challenge?'铁崖挑战':this.mode==='collection'?'收集榜':'战役排行';
    this.title.hidden=true;
    for(const button of [this.campaignButton,this.collectionButton,this.switchButton]){
      button.hidden=achievements;button.setAttribute('aria-pressed',String(button.dataset.boardMode===this.mode));
    }
    for(const [category,button]of this.achievementFilters){
      button.hidden=!achievements;button.setAttribute('aria-pressed',String(category===this.achievementCategory));
    }
    this.action.textContent=achievements?'TapTap成就':'查看排行';this.retry.textContent=achievements?'同步成就':challenge?'同步成绩':this.mode==='collection'?'同步收藏':'同步进度';
    this.body.replaceChildren();
    if(challenge){
      const header=el('div','challenge-opponent'),portrait=el('img','');portrait.src='./assets/generals/general_portrait_image_f1.png';portrait.alt='';
      header.append(portrait,el('strong','','阿杰农 · 铁崖封锁'));this.body.append(header);
      const best=this.readChallenge().bestResult;
      header.append(el('p','platform-progress-score',best?`最高 ${best.score} 分`:'暂无成绩'));
      if(best)this.body.append(el('p','challenge-best-details',`${best.round} 回合 · 阵亡 ${best.deaths} · 主将 ${best.health} 生命`));
      const rules=el('dl','challenge-score-breakdown');rules.setAttribute('aria-label','计分规则');
      for(const [label,value,tone]of [['胜利基础','100000','base'],['每回合','−1000','penalty'],['随从阵亡','−25/名','penalty'],['主将生命','+5/点','bonus']]){
        const group=el('div',`score-${tone}`);group.append(el('dt','',label),el('dd','',value));rules.append(group);
      }this.body.append(rules);
    }else if(achievements){
      const items=this.service.getAchievements().filter(item=>this.achievementCategory==='all'||item.category===this.achievementCategory);
      this.body.append(el('p','platform-progress-score achievement-summary',`已达成 ${items.filter(item=>item.achieved).length} / ${items.length}`));
      const list=el('ul','achievement-list');
      for(const item of items){
        const row=el('li',item.achieved?'is-achieved':'');row.dataset.achievementKey=item.key;
        const status=item.synced?'✓ 已同步':item.achieved?(item.configured?'✓ 已达成 · 待同步':'✓ 已达成'):`${item.progress} / ${item.target}`;
        const icon=el('img','achievement-icon');icon.src=`./${achievementIcon(item.key)}`;icon.alt='';icon.width=44;icon.height=44;
        row.append(icon,el('span','achievement-name',item.name),el('strong','',status));list.append(row);
      }this.body.append(list);
    }else if(this.mode==='collection'){
      const progress=collectionProgressStats(this.readProgress());
      this.body.append(el('p','platform-progress-score',`已收集 ${progress.total} / ${progress.available} 种`));
      const list=el('ul','collection-progress-list');
      for(const [name,count] of [['单位',progress.units],['法术',progress.spells]]){
        const row=el('li','');row.append(el('span','',name),el('strong','',`${count} 种`));list.append(row);
      }this.body.append(list);
    }else{
      const progress=platformProgressStats(this.readProgress());
      this.body.append(el('p','platform-progress-score',`已通关 ${progress.score} / ${EXPEDITION_LEVELS.length * FACTIONS.length} 关`));
      const list=el('ul','faction-progress-list');
      for(const [index,faction]of FACTIONS.entries()){
        const row=el('li',''),crest=el('img','');crest.src=faction.crest;crest.alt='';
        row.append(crest,el('span','',faction.name),el('strong','',`${progress.factions[index]} / 30`));list.append(row);
      }this.body.append(list);
    }
    this.status.textContent=this.statusMessage();this.status.dataset.state=this.service.getStatus()[this.mode]?.state??'idle';
    this.start.hidden=!challenge;this.start.disabled=this.busy||!this.onChallengeStart;
    this.resume.hidden=!challenge||!this.readChallenge().hasResume;this.resume.disabled=this.busy;
    this.action.classList.toggle('is-primary',!challenge);this.action.disabled=!(achievements?caps.achievementView:caps[this.mode]);
    this.retry.hidden=!this.hasSyncableProgress();this.retry.disabled=this.busy||!caps[this.mode];
  }
  refresh(){if(this.dialog.open&&!this.busy)this.render();}
  async run(action,{automatic=false}={}){
    if(action==='open')return this.openNative();
    if(this.busy)return;
    const epoch=this.epoch,mode=this.mode;this.busy=true;this.notice='正在同步…';this.render();
    let result;
    try{
      const method={leaderboard:'syncLeaderboard',collection:'syncCollectionLeaderboard',challenge:'syncChallengeLeaderboard',achievements:'syncAchievements'}[mode];
      result=await this.service[method]({force:!automatic});
    }catch{result={ok:false,error:'暂时无法连接TapTap，请稍后重试。'};}
    if(epoch!==this.epoch||!this.dialog.open)return;
    this.busy=false;this.notice=result?.ok?'':result?.error||'暂时无法连接TapTap，请稍后重试。';this.render();
  }
  async openNative(){
    const mode=this.mode,opener=this.opener;
    const canView=mode==='achievements'?this.capabilities().achievementView:this.capabilities()[mode];
    if(!canView||!this.dialog.open)return;
    // Release the HTML top layer before handing control to a host panel. Keep
    // the SDK invocation in this click stack, without awaiting synchronization.
    const epoch=++this.epoch;this.busy=false;this.dialog.close();
    let result;
    try{
      const method={leaderboard:'openLeaderboard',collection:'openCollectionLeaderboard',challenge:'openChallengeLeaderboard',achievements:'showAchievements'}[mode];
      result=await this.service[method]();
    }catch(error){result={ok:false,error:error?.message||error?.errMsg||'暂时无法连接TapTap，请稍后重试。'};}
    // Missing host callbacks cannot establish that a panel failed to open.
    // Keep the game modal closed rather than covering a possibly active panel.
    if(epoch!==this.epoch||result?.ok||result?.uncertain)return;
    this.open(mode,opener,{automaticSync:false});
    this.notice=result?.error||'暂时无法连接TapTap，请稍后重试。';this.render();
  }
  close(){
    this.epoch++;this.busy=false;if(!this.dialog.open)return;this.dialog.close();
    const opener=this.opener?.isConnected?this.opener:document.querySelector(`[data-action="${this.mode==='achievements'?'achievements':'leaderboard'}"]`);opener?.focus({preventScroll:true});
  }
}
