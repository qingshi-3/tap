import {CARDS} from './cards.js';
const asset=name=>`./assets/recruitment-fx/${name}`;
const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text!=null)el.textContent=text;return el;};
const picture=(src,cls)=>{const img=node('img',cls);img.src=src;img.alt='';img.draggable=false;return img;};
const cardName=id=>CARDS[id]?.name??`卡牌 ${id}`;
function control(text,action){const el=node('button','recruitment-button recruitment-presentation-button',text);el.type='button';el.dataset.recruitmentPresentationAction=action;return el;}
function rewardValue(reward){
 const line=node('span',`recruitment-presentation-value is-${reward.kind}`);
 if(reward.kind==='coins')line.append(picture('./assets/metagame/original/resource-gold.png',''),node('strong','',`+${reward.amount}`));
 else line.append(node('strong','',`${reward.source==='legacy'?'旧保底 ':''}${reward.kind==='unit'?'':`碎片 +${reward.amount}`}`));
 return line;
}
// Owns only a visual lifetime. Every amount belongs to an already committed receipt;
// no draw, ad, inventory or save operation is reachable from this controller.
export class RecruitmentPresentation{
 constructor({host,drawCardArt}){
  this.host=host;this.drawCardArt=drawCardArt;this.generation=0;this.active=false;this.timers=new Set();this.animations=new Set();this.flights=new Set();
  this.dialog=node('dialog','recruitment-presentation');this.dialog.setAttribute('aria-label','招募揭晓');this.dialog.setAttribute('aria-modal','true');
  for(const type of ['contextmenu','selectstart','dragstart'])this.dialog.addEventListener(type,e=>e.preventDefault(),{capture:true});
  this.dialog.addEventListener('click',e=>{const action=e.target.closest('[data-recruitment-presentation-action]')?.dataset.recruitmentPresentationAction;if(action==='skip')this.skip();if(action==='continue')this.dismiss();});
  this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.dismiss();});
  this.dialog.addEventListener('close',()=>{if(!this.dialog.open)this.finish();});
  this.dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const buttons=[...this.dialog.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});
  window.addEventListener('pagehide',()=>this.dismiss());document.body.append(this.dialog);
 }
 schedule(fn,ms){const generation=this.generation;const timer=setTimeout(()=>{this.timers.delete(timer);if(this.active&&this.generation===generation)fn();},ms);this.timers.add(timer);return timer;}
 animate(el,frames,options){if(!this.active||this.reduced||typeof el.animate!=='function')return null;const animation=el.animate(frames,{...options,fill:'both'});this.animations.add(animation);// Retain finished fill effects until settle/close explicitly cancels them.
  animation.finished.catch(()=>{});return animation;}
 clearMotion(){for(const timer of this.timers)clearTimeout(timer);this.timers.clear();for(const animation of this.animations)animation.cancel();this.animations.clear();for(const flight of this.flights)flight.remove();this.flights.clear();}
 art(id){const canvas=node('canvas','recruitment-presentation-art');canvas.width=canvas.height=260;canvas.setAttribute('aria-hidden','true');try{this.drawCardArt?.(canvas,id)?.catch?.(()=>{});}catch{}return canvas;}
 resultCard(draw,kind){
  const main=draw.rewards.find(r=>r.kind==='fragments')??draw.rewards.find(r=>r.kind==='unit'),rare=draw.rewards.some(r=>r.kind==='fragments'&&r.amount===5),newUnit=draw.rewards.some(r=>r.newUnit);
  const card=node('article','recruitment-presentation-card');card.dataset.index=draw.index;card.classList.toggle('is-rare',rare);card.classList.toggle('is-new',newUnit);card.setAttribute('aria-label',cardName(main.cardId));
  const flip=node('div','recruitment-presentation-flip'),back=node('div','recruitment-presentation-back'),front=node('div','recruitment-presentation-front');back.append(picture('./assets/card-backgrounds/card_back.png','recruitment-presentation-cardback'));
  front.append(this.art(main.cardId),node('strong','recruitment-presentation-name',cardName(main.cardId)));
  const values=node('div','recruitment-presentation-values');for(const reward of draw.rewards.slice(0,2))if(['fragments','coins'].includes(reward.kind)){const line=rewardValue(reward);if(reward.kind==='fragments'&&reward.cardId!==main.cardId)line.prepend(document.createTextNode(cardName(reward.cardId)+' '));values.append(line);}front.append(values);

  if(kind==='double')front.append(node('strong','recruitment-presentation-stamp','×2'));
  if(newUnit)front.append(node('span','recruitment-presentation-acquired','已合成'));
  flip.append(back,front);card.append(flip);return card;
 }
 showDraw(receipt,balances){return this.show({balances,kind:'draw',receipt,draws:receipt.draws});}
 showDouble({receipt,drawIndex,reward,requestId,balances}){
  const original=receipt.draws.find(draw=>draw.index===drawIndex);if(!original)return Promise.resolve();
  const originalRewards=original.rewards.filter(r=>['fragments','coins'].includes(r.kind));
  const rewards=(reward.rewards??[]).map((r,i)=>({...r,source:originalRewards[i]?.source??r.source}));
  return this.show({kind:'double',balances,receipt,requestId,draws:[{index:drawIndex,rewards}],reward});
 }
 show(data){
  this.dismiss();this.generation++;this.active=true;this.data=data;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.cards=[];this.dialog.dataset.kind=data.kind;this.dialog.dataset.count=data.draws.length;this.dialog.dataset.phase=this.reduced?'settled':'charge';this.dialog.classList.toggle('is-single',data.draws.length===1);this.dialog.classList.toggle('is-reduced',this.reduced);this.dialog.classList.toggle('has-new-unit',data.draws.some(d=>d.rewards.some(r=>r.newUnit)));
  const balances=node('div','recruitment-presentation-balances');if(data.balances)for(const [kind,amount]of Object.entries(data.balances)){const value=node('span','recruitment-presentation-balance');value.dataset.kind=kind;value.append(picture(`./assets/metagame/original/${kind==='gold'?'resource-gold.png':'spirit-orb.png'}`,''),node('strong','',amount));balances.append(value);}
  const scene=node('div','recruitment-presentation-scene'),light=node('div','recruitment-presentation-light');light.append(picture(asset('booster_glowing_disc.png'),'recruitment-presentation-disc'));
  const charge=node('div','recruitment-presentation-charge');charge.append(picture(asset('booster_orb.png'),'recruitment-presentation-orb'),picture(asset('spiral_assemble_for_booster.png'),'recruitment-presentation-assemble'));
  const particles=node('div','recruitment-presentation-particles');for(let i=0;i<12;i++){const particle=picture(asset(i%3?'explosion_particles.png':'spiral_assemble_for_booster.png'),'recruitment-presentation-particle');particle.style.setProperty('--angle',`${i*30}deg`);particles.append(particle);}
  const grid=node('div','recruitment-presentation-grid');for(const draw of data.draws){const card=this.resultCard(draw,data.kind);this.cards.push(card);grid.append(card);}scene.append(light,charge,particles,grid);
  const extra=node('div','recruitment-presentation-extra');extra.setAttribute('aria-label','旧保底补发');extra.tabIndex=0;
  for(const draw of data.draws)for(const reward of draw.rewards.slice(2)){const item=node('span','recruitment-presentation-extra-item',`旧保底 ${cardName(reward.cardId)}${reward.kind==='unit'?' 已加入收藏':` +${reward.amount}片`}${reward.kind==='fragments'&&reward.newUnit?' · 已合成':''}`);extra.append(item);}
  extra.hidden=!extra.childElementCount;this.dialog.classList.toggle('has-extra',!!extra.childElementCount);
  const footer=node('div','recruitment-presentation-footer'),skip=control('跳过动画','skip'),proceed=control('继续','continue');skip.hidden=this.reduced;proceed.disabled=!this.reduced;footer.append(skip,proceed);this.dialog.replaceChildren(balances,scene,extra,footer);this.scene=scene;this.charge=charge;this.particles=particles;this.light=light;this.grid=grid;
  const completion=new Promise(resolve=>this.resolve=resolve);this.dialog.showModal();(this.reduced?proceed:skip).focus({preventScroll:true});
  if(this.reduced){this.settle();return completion;}
  this.animate(charge,[{transform:'scale(.7)',opacity:.4,filter:'brightness(.7)'},{transform:'scale(1)',opacity:1,filter:'brightness(1.3)'},{transform:'scale(1.12)',opacity:1,filter:'brightness(2)'}],{duration:500,easing:'cubic-bezier(.25,.1,.35,1)'});
  this.schedule(()=>this.burst(),500);
  const start=data.kind==='double'?600:650,interval=data.draws.length===1?0:170;
  this.cards.forEach((card,i)=>this.schedule(()=>this.reveal(card),start+i*interval));
  const duration=data.kind==='double'?1550:data.draws.length===1?2000:2950;
  if(data.kind==='double')this.schedule(()=>this.flyRewards(),1050);
  this.schedule(()=>this.settle(),duration);return completion;
 }
 burst(){
  this.dialog.dataset.phase='reveal';this.charge.classList.add('is-burst');
  this.animate(this.charge,[{opacity:1,transform:'scale(1.05)'},{opacity:0,transform:'scale(1.65)'}],{duration:240,easing:'ease-out'});
  this.animate(this.light,[{opacity:0,transform:'scale(.4)'},{opacity:.72,transform:'scale(1.05)',offset:.3},{opacity:.1,transform:'scale(1.12)'}],{duration:720,easing:'ease-out'});
  for(const [i,particle]of [...this.particles.children].entries()){const angle=i*Math.PI/6,reach=this.data.kind==='double'?140:160;this.animate(particle,[{opacity:0,transform:'translate(0,0) scale(.35)'},{opacity:1,transform:`translate(${Math.cos(angle)*reach*.4}px,${Math.sin(angle)*reach*.4}px) scale(.8)`,offset:.35},{opacity:0,transform:`translate(${Math.cos(angle)*reach}px,${Math.sin(angle)*reach}px) scale(.2)`}],{duration:630+i%3*90,easing:'cubic-bezier(.1,.6,.2,1)'});}
 }
 reveal(card){
  card.classList.add('is-revealed');const flip=card.firstElementChild;
  this.animate(flip,[{transform:'rotateY(180deg) scale(.85)'},{transform:'rotateY(0deg) scale(1.05)',offset:.75},{transform:'rotateY(0deg) scale(1)'}],{duration:480,easing:'cubic-bezier(.2,.7,.2,1)'});
  if(card.classList.contains('is-rare')||card.classList.contains('is-new')){this.animate(card,[{filter:'brightness(1)'},{filter:'brightness(1.55)',offset:.35},{filter:'brightness(1)'}],{duration:650,easing:'ease-out'});}
  if(card.classList.contains('is-new')){const art=card.querySelector('canvas');this.animate(art,[{transform:'scale(.86)',filter:'drop-shadow(0 0 4px #e8b246)'},{transform:'scale(1.09)',filter:'drop-shadow(0 0 22px #ffc44d)',offset:.5},{transform:'scale(1)',filter:'drop-shadow(0 0 10px #e8b246)'}],{duration:700,easing:'ease-out'});}
 }
 flyRewards(){
  if(this.reduced)return;const bounds=this.dialog.getBoundingClientRect(),start=this.cards[0].getBoundingClientRect();
  const goldTarget=this.dialog.querySelector('.recruitment-presentation-balance[data-kind=gold]')?.getBoundingClientRect();
  const resources=[{src:'./assets/metagame/original/resource-gold.png',target:goldTarget},{src:'./assets/card-backgrounds/card_back.png',target:this.cards[0].querySelector('.is-fragments')?.getBoundingClientRect()}];
  for(const [i,item]of resources.entries()){if(!item.target)continue;const flight=picture(item.src,'recruitment-presentation-flight');flight.style.left=`${start.x+start.width*.65-bounds.x}px`;flight.style.top=`${start.y+start.height*.6-bounds.y}px`;this.dialog.append(flight);this.flights.add(flight);const dx=item.target.x+item.target.width/2-start.x-start.width*.65,dy=item.target.y+item.target.height/2-start.y-start.height*.6;
   this.animate(flight,[{opacity:1,transform:'translate(0,0) scale(.8)'},{opacity:1,transform:`translate(${dx*.4}px,${dy*.2-35}px) scale(1.2)`,offset:.4},{opacity:0,transform:`translate(${dx}px,${dy}px) scale(.45)`}],{duration:480,delay:i*80,easing:'cubic-bezier(.2,.6,.2,1)'});
  }
 }
 settle(){
  if(!this.active)return;this.clearMotion();this.dialog.dataset.phase='settled';for(const card of this.cards)card.classList.add('is-revealed');this.charge.classList.add('is-burst');this.dialog.querySelector('[data-recruitment-presentation-action="skip"]').hidden=true;this.dialog.querySelector('[data-recruitment-presentation-action="continue"]').disabled=false;
  this.dialog.querySelector('[data-recruitment-presentation-action="continue"]').focus({preventScroll:true});
 }
 skip(){this.settle();}
 finish(){
  if(!this.active)return;this.active=false;this.generation++;this.clearMotion();this.dialog.replaceChildren();this.data=null;const resolve=this.resolve;this.resolve=null;resolve?.();
 }
 dismiss(){this.generation++;if(this.dialog.open)this.dialog.close();this.finish();}
}
