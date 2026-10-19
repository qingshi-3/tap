/** Procedural feedback is deliberately short; licensed asset audio can replace it through this seam. */
export class GameAudio {
 muted=false; private context:AudioContext|null=null;private samples=new Map<string,HTMLAudioElement>();
 setSources(sources:Record<string,string[]>){for(const [kind,files] of Object.entries(sources)){if(!files.length)continue;const a=new Audio('./'+files[0]);a.preload='auto';this.samples.set(kind,a)}}
 asset(kind:'attack'|'hit'|'death'){if(this.muted||document.hidden)return;const source=this.samples.get(kind);if(!source)return;const a=source.cloneNode(true) as HTMLAudioElement;a.volume=.18;void a.play().catch(()=>{})}
 unlock(){if(!this.context){try{this.context=new AudioContext()}catch{return}}void this.context.resume()}
 play(kind:'confirm'|'error'|'wave'|'hit'){
  if(this.muted||!this.context||this.context.state!=='running')return;
  const c=this.context,o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(kind==='error'?150:kind==='wave'?420:kind==='hit'?220:620,c.currentTime);o.frequency.exponentialRampToValueAtTime(kind==='error'?90:kind==='wave'?720:300,c.currentTime+.08);g.gain.setValueAtTime(.035,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.10);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.11);
 }
 pause(){void this.context?.suspend()}
}
