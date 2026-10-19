export const MUSIC_SETTINGS_KEY='luxiang.menu-audio.v1';
const defaults={version:1,muted:false,volume:0.45};
let instance=null;
export class MenuMusic {
  constructor({context,path='./assets/music/legionnaire-menu.mp3'}={}) {
    if(instance)return instance;
    instance=this;this.context=context;this.path=path;this.media=null;this.source=null;this.gain=null;this.home=false;this.unlocked=false;this.status='idle';this.pendingPlay=null;this.pauseTimer=null;this.listeners=new Set();this.preferences={...defaults};
    try{const value=JSON.parse(localStorage.getItem(MUSIC_SETTINGS_KEY));if(value?.version===1&&typeof value.muted==='boolean'&&Number.isFinite(value.volume)&&value.volume>=0&&value.volume<=1)this.preferences={...defaults,...value};}catch{}
    document.addEventListener('visibilitychange',()=>document.hidden?this.pause(true):this.sync());
    addEventListener('pagehide',()=>this.pause(true));addEventListener('pageshow',()=>this.sync());
  }
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  notify(){for(const fn of this.listeners)fn(this.preferences,this.status);}
  setHomeVisible(value){value=Boolean(value);if(this.home===value)return;this.home=value;this.sync();}
  unlock(event,start=true){if(!event?.isTrusted)return;this.unlocked=true;this.context?.resume().catch(()=>{});if(start&&this.media?.error){this.media.load();this.status='idle';}if(start)this.sync();}
  setMuted(value){this.preferences.muted=Boolean(value);this.save();this.sync();}
  setVolume(value){this.preferences.volume=Math.max(0,Math.min(1,Number(value)||0));this.save();this.sync();}
  toggle(event){const silent=this.preferences.muted||this.preferences.volume===0;if(silent&&this.preferences.volume===0)this.preferences.volume=defaults.volume;this.preferences.muted=!silent;this.save();this.unlock(event);this.sync();}
  save(){try{localStorage.setItem(MUSIC_SETTINGS_KEY,JSON.stringify(this.preferences));}catch{}this.notify();}
  wanted(){return this.home&&!document.hidden&&!this.preferences.muted&&this.preferences.volume>0&&this.unlocked;}
  ensureMedia(){
    if(this.media)return;
    const media=document.createElement('audio');media.id='menu-music-source';media.hidden=true;media.preload='none';media.loop=true;media.src=new URL(this.path,document.baseURI).href;document.body.append(media);this.media=media;
    if(this.context){try{this.source=this.context.createMediaElementSource(media);this.gain=this.context.createGain();this.gain.gain.value=0;this.source.connect(this.gain);this.gain.connect(this.context.destination);}catch{this.source=null;this.gain=null;}}
    media.addEventListener('timeupdate',()=>{if(!Number.isFinite(media.duration))return;if(media.duration-media.currentTime<0.35&&!this.loopTail){this.loopTail=true;this.fade(0);}else if(this.loopTail&&media.currentTime<1){this.loopTail=false;this.fade(this.wanted()?this.preferences.volume:0);}});
    media.addEventListener('error',()=>{this.status='unavailable';this.notify();});
  }
  fade(value){
    if(!this.media)return;
    if(this.gain){const now=this.context.currentTime;this.gain.gain.cancelScheduledValues(now);this.gain.gain.setTargetAtTime(value,now,0.055);}
    else this.media.volume=value;
  }
  pause(immediate=false){
    clearTimeout(this.pauseTimer);this.pauseTimer=null;if(!this.media)return;
    this.fade(0);const finish=()=>{this.media.pause();this.status='paused';this.notify();};
    if(immediate)finish();else this.pauseTimer=setTimeout(()=>{if(!this.wanted())finish();},240);
  }
  sync(){
    if(!this.wanted()){this.pause();return;}
    clearTimeout(this.pauseTimer);this.pauseTimer=null;if(this.context?.state==='suspended')this.context.resume().catch(()=>{});this.ensureMedia();this.fade(this.loopTail?0:this.preferences.volume);
    if(!this.media.paused){this.status='playing';this.notify();return;}
    if(this.pendingPlay)return;
    this.status='starting';this.notify();
    // No fetch/decodeAudioData buffer: one browser media stream shares battle's context.
    this.pendingPlay=this.media.play().then(()=>{if(this.wanted()){this.fade(this.preferences.volume);this.status='playing';}else this.pause(true);}).catch(()=>{if(this.wanted())this.status='blocked';}).finally(()=>{this.pendingPlay=null;this.notify();});
  }
  snapshot(){return{preferences:{...this.preferences},home:this.home,unlocked:this.unlocked,status:this.status,mediaCount:this.media?1:0,sourceCount:this.source?1:0,paused:this.media?.paused??true,currentTime:this.media?.currentTime??0,contextState:this.context?.state??null};}
}
export const getMenuMusicStatus=()=>instance?.snapshot()??null;
