export class AudioSettings {
  constructor(music,{effects}={}){this.music=music;this.effects=effects;this.dialog=document.getElementById('audio-settings');this.toggle=document.getElementById('settings-music-toggle');this.slider=document.getElementById('settings-music-volume');this.value=document.getElementById('settings-music-value');this.retry=document.getElementById('settings-music-retry');this.opener=null;
    this.effectsSlider=document.getElementById('settings-effects-volume');this.effectsValue=document.getElementById('settings-effects-value');this.leave=document.getElementById('settings-leave-battle');this.giftCode=document.getElementById('settings-gift-code');
    // Audio preferences are independent of player progress and battle snapshots.
    this.giftCode.addEventListener('click',()=>{this.dialog.close();this.onGiftCode?.();});
    this.effectsVolume=1;
    try{const saved=JSON.parse(localStorage.getItem('luxiang.battle-audio.v1'));if(saved?.version===1&&Number.isFinite(saved.volume)&&saved.volume>=0&&saved.volume<=1)this.effectsVolume=saved.volume;}catch{}
    effects?.setSoundVolume(this.effectsVolume);
    this.effectsSlider.addEventListener('input',()=>{this.effectsVolume=Number(this.effectsSlider.value)/100;effects?.setSoundVolume(this.effectsVolume);try{localStorage.setItem('luxiang.battle-audio.v1',JSON.stringify({version:1,volume:this.effectsVolume}));}catch{}this.refreshEffects();});
    this.toggle.addEventListener('click',event=>{music.setMuted(!music.preferences.muted);music.unlock(event);});this.slider.addEventListener('input',()=>{this.slider.style.setProperty('--volume',`${this.slider.value}%`);music.setVolume(Number(this.slider.value)/100);});this.retry.addEventListener('click',event=>music.unlock(event));document.getElementById('audio-settings-close').addEventListener('click',()=>this.close());this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});music.subscribe(()=>this.refresh());this.refresh();
  }
  refresh(){
    const p=this.music.preferences,enabled=!p.muted;
    const label=this.toggle.querySelector('.settings-toggle-label');
    if(label)label.textContent=enabled?'开启':'关闭';
    else this.toggle.textContent=enabled?'开启':'关闭';
    this.toggle.setAttribute('role','switch');
    this.toggle.setAttribute('aria-label','背景音乐');
    this.toggle.setAttribute('aria-checked',String(enabled));
    this.toggle.removeAttribute('aria-pressed');
    this.slider.value=String(Math.round(p.volume*100));
    this.slider.style.setProperty('--volume',`${this.slider.value}%`);
    this.value.value=`${this.slider.value}%`;
    this.retry.hidden=!['blocked','unavailable'].includes(this.music.status);
    this.refreshEffects();
  }
  refreshEffects(){this.effectsSlider.value=String(Math.round(this.effectsVolume*100));this.effectsSlider.style.setProperty('--volume',`${this.effectsSlider.value}%`);this.effectsValue.value=`${this.effectsSlider.value}%`;}
  open(opener,{battle=false}={}){this.opener=opener;this.leave.hidden=!battle;this.giftCode.hidden=battle||!this.onGiftCode;this.refresh();if(!this.dialog.open)this.dialog.showModal();(battle?this.effectsSlider:this.toggle).focus();}
  close(){this.dialog.close();(this.opener?.isConnected?this.opener:document.querySelector('[data-action="audio-settings"]'))?.focus();}
}
