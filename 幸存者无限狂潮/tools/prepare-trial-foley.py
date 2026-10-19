"""Prepare CC0 recorded/produced foley. No oscillator, pitch shift or retro library."""
from pathlib import Path
import hashlib,json,math,subprocess,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/trial-audio-rework'; SOURCES=OUT/'sources'
FF=ROOT/'output/gameplay-recording/tooling/node_modules/ffmpeg-static/ffmpeg.exe'
SR=44100
PROVENANCE={
 'sword':dict(author='StarNinjas',license='CC0 1.0',page='https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes',download='https://opengameart.org/sites/default/files/sword_-_starninjas_1.zip'),
 'swishes':dict(author='artisticdude',license='CC0 1.0',page='https://opengameart.org/content/swishes-sound-pack',download='https://opengameart.org/sites/default/files/swishes.zip'),
 'impact':dict(author='Kenney',license='CC0 1.0',page='https://kenney.nl/assets/impact-sounds',download='https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip'),
 'tiny':dict(author='Vehicle / Ján Schupke',license='CC0 1.0',page='https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx',download='https://opengameart.org/sites/default/files/tinysized.zip')}
# Trim, EQ and envelope are individual; reversing preserves pitch. At most two sources.
def layer(source,start,length,hp,lp,gain=1,reverse=False,fade_in=.004,fade_out=.028):
 return dict(source=source,start=start,length=length,highpass=hp,lowpass=lp,gain=gain,reverse=reverse,fadeIn=fade_in,fadeOut=fade_out)
SPECS=[
 ('shield-ready',.20,'Short metal clasp-like impact without ringing',[layer('impact/Audio/impactMetal_light_000.ogg',0,.20,180,5200)]),
 ('shield-slash',.30,'Real blade attack',[layer('sword/sword - StarNinjas/sword.4.ogg',0,.30,150,6500,fade_out=.035)]),
 ('wind-charge',.18,'Recorded air swish with gentle lead-in',[layer('swishes/swishes/swish-8.wav',0,.154,280,4800,fade_in=.025,fade_out=.025)]),
 ('wind-dash',.20,'Fast recorded hanger/stick swish',[layer('swishes/swishes/swish-9.wav',.015,.18,250,6300,fade_in=.003,fade_out=.018)]),
 ('wind-land',.32,'Short stone mining landing',[layer('impact/Audio/impactMining_000.ogg',0,.32,120,4400,fade_out=.065)]),
 ('soul-bind',.20,'Reversed recorded air, unchanged pitch',[layer('swishes/swishes/swish-9.wav',0,.197,320,3800,reverse=True,fade_in=.015,fade_out=.025)]),
 ('soul-pulse',.24,'Muffled soft physical pressure impact',[layer('impact/Audio/impactSoft_heavy_002.ogg',0,.24,100,2500,fade_out=.035)]),
 ('soul-break',.18,'Granular short stone release',[layer('impact/Audio/impactMining_004.ogg',0,.18,180,4500,fade_out=.025)]),
 ('rift-mark',.19,'Light glass contact',[layer('impact/Audio/impactGlass_light_001.ogg',0,.19,350,5800,fade_out=.032)]),
 ('rift-burst',.22,'Heavy glass scatter impact',[layer('impact/Audio/impactGlass_heavy_000.ogg',0,.22,230,5300,fade_out=.025)]),
 ('rift-cut',.23,'Real swish with very light glass contact',[layer('swishes/swishes/swish-7.wav',0,.187,300,6200,fade_out=.025),layer('impact/Audio/impactGlass_light_002.ogg',0,.20,600,5600,gain=.15)]),
 ('prism-in',.28,'Compact recorded compressed-air burst',[layer('tiny/sfx-cc0/compressed-air-spray-01.wav',.09,.28,400,5300,fade_in=.009,fade_out=.04)]),
 ('prism-out',.31,'Glass impact with a soft stone underpinning',[layer('impact/Audio/impactGlass_medium_002.ogg',0,.31,280,5700),layer('impact/Audio/impactMining_001.ogg',0,.31,160,2200,gain=.20)]),
 ('prism-charge',.40,'Reversed compressed-air buildup, no pitch manipulation',[layer('tiny/sfx-cc0/compressed-air-spray-01.wav',0,.40,450,4300,reverse=True,fade_in=.005,fade_out=.025)]),
 ('prism-break',.22,'Short glass break consequence',[layer('impact/Audio/impactGlass_heavy_003.ogg',0,.22,300,5500,fade_out=.035)])]
def read(path,filters=None):
 cmd=[str(FF),'-v','error','-i',str(path)]
 if filters:cmd+=['-af',filters]
 return np.frombuffer(subprocess.check_output(cmd+['-f','f32le','-ac','1','-ar',str(SR),'pipe:1']),dtype='<f4').astype(np.float64)
def metrics(x):
 return dict(duration=len(x)/SR,peakDbFS=20*math.log10(max(float(np.max(np.abs(x))),1e-12)),rmsDbFS=20*math.log10(max(float(np.sqrt(np.mean(x*x))),1e-12)),dc=float(x.mean()))
def write(path,x):
 with wave.open(str(path),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(np.round(np.clip(x,-1,1)*32767).astype('<i2').tobytes())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def prepare_layer(p):
 source=SOURCES/p['source']; filt=f"atrim=start={p['start']}:duration={p['length']},asetpts=PTS-STARTPTS,highpass=f={p['highpass']},lowpass=f={p['lowpass']}"
 if p['reverse']:filt+=',areverse'
 x=read(source,filt); n=len(x); t=np.arange(n)/SR
 x*=np.minimum(1,t/p['fadeIn'])*np.minimum(1,(n/SR-t)/p['fadeOut'])
 x-=x.mean()
 # Normalize layers separately so the optional secondary layer stays genuinely quiet.
 x*=10**((-23-metrics(x)['rmsDbFS'])/20)*p['gain']
 return x,dict(**p,sourceSha256=sha(source),sourceBytes=source.stat().st_size,provenance=PROVENANCE[p['source'].split('/')[0]],ffmpegFilter=filt)
def audition(records,names,path,total):
 sequence=[];cues=[];cursor=0;gap=(total-sum(len(records[n]['decoded'])/SR for n in names))/len(names)
 for name in names:
  x=records[name]['decoded'];cues.append(dict(name=name,start=cursor,duration=len(x)/SR));sequence.append(x);cursor+=len(x)/SR
  silence=np.zeros(round(gap*SR));sequence.append(silence);cursor+=len(silence)/SR
 write(path,np.concatenate(sequence));return dict(path=path.relative_to(ROOT).as_posix(),duration=cursor,cues=cues)
def main():
 OUT.mkdir(parents=True,exist_ok=True);records={};manifest=[]
 for name,duration,design,layers in SPECS:
  x=np.zeros(round(duration*SR));sources=[]
  for p in layers:
   y,record=prepare_layer(p);x[:min(len(x),len(y))]+=y[:len(x)];sources.append(record)
  x-=x.mean();gainDb=-22-metrics(x)['rmsDbFS'];x*=10**(gainDb/20)
  # Peak limiting is only gain attenuation, never synthesized or clipped material.
  peakGain=min(0,-6.6-metrics(x)['peakDbFS']);x*=10**(peakGain/20);gainDb+=peakGain
  pcm=OUT/f'trial-{name}.wav';dest=ROOT/f'dist/assets/audio/trial-{name}.m4a'
  for attempt in range(3):
   write(pcm,x);subprocess.run([str(FF),'-v','error','-y','-i',str(pcm),'-af','highpass=f=30','-c:a','aac','-b:a','80k','-ac','1','-ar',str(SR),str(dest)],check=True)
   decoded=read(dest);m=metrics(decoded)
   if m['peakDbFS']<=-6:break
   adjust=-6.6-m['peakDbFS'];x*=10**(adjust/20);gainDb+=adjust
  else:raise RuntimeError(f'Unacceptable encoded metrics {name}: {m}')
  active=decoded[np.abs(decoded)>.01*float(np.max(np.abs(decoded)))]
  record=dict(name=name,design=design,sources=sources,normalizationGainDb=gainDb,finalEncodingFilter='highpass=f=30 (DC/rumble cleanup)',pcmMetrics=metrics(x),decodedMetrics=m,activeRmsDbFS=20*math.log10(float(np.sqrt(np.mean(active*active)))),rmsException=not(-24.8<=m['rmsDbFS']<=-20),sha256=sha(dest),bytes=dest.stat().st_size,path=dest.relative_to(ROOT).as_posix())
  manifest.append(record);records[name]=dict(decoded=decoded,record=record)
 reps=audition(records,['shield-slash','wind-dash','soul-break','rift-burst','prism-break'],OUT/'five-representatives.wav',12)
 allcues=audition(records,[s[0] for s in SPECS],OUT/'all-fifteen.wav',20)
 result=dict(method='CC0 recorded/produced foley editing; no oscillator, synthetic tone, pitch shift, retro library, or prior trial audio layer.',listening='未耳听。指标只说明技术检查，不据此宣布好听；待用户试听。',retired='output/trial-audio/* contains previous rejected procedural version; retained only as retired history.',format='44100 Hz mono AAC 80 kbps',assets=manifest,auditions=[reps,allcues])
 (OUT/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 (OUT/'cue-order.txt').write_text('\n'.join(f"{a['path']}\n"+'\n'.join(f"{c['start']:.3f}s {c['name']}" for c in a['cues']) for a in [reps,allcues])+'\n',encoding='utf8')
 print(json.dumps(dict(count=len(manifest),bytes=sum(r['bytes'] for r in manifest),peak=[min(r['decodedMetrics']['peakDbFS'] for r in manifest),max(r['decodedMetrics']['peakDbFS'] for r in manifest)],rms=[min(r['decodedMetrics']['rmsDbFS'] for r in manifest),max(r['decodedMetrics']['rmsDbFS'] for r in manifest)]),indent=2))
if __name__=='__main__':main()
