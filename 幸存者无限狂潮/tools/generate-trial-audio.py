"""Rejected procedural prototype, retained for reproduction only.

The user rejected its tonal/buzzy character. Never write these sounds to dist;
production replacements are prepared by prepare-trial-foley.py.
"""
from pathlib import Path
import hashlib, json, math, subprocess, wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/trial-audio'
ASSETS = OUT / 'rejected-procedural-assets'
FFMPEG = ROOT / 'output/gameplay-recording/tooling/node_modules/ffmpeg-static/ffmpeg.exe'
SR = 44100
SEED = 20261012
# name, family, seconds, base pitch Hz, final pitch ratio, tone partials, air amount, design
SPECS = [
 ('shield-ready','shield',.30,580,1.12,[1,1.48,2.17],.025,'Rounded rising rune-metal readiness'),
 ('shield-slash','shield',.23,760,.68,[1,1.48,2.17],.12,'Short falling metal edge with narrow air'),
 ('wind-charge','wind',.40,680,1.22,[1,2.01],.10,'Gentle rising tension and air'),
 ('wind-dash','wind',.20,1000,.62,[1,2.01],.22,'Fast descending air-cut'),
 ('wind-land','wind',.19,430,.78,[1,1.82,2.37],.04,'Rounded landing knock without sub-bass'),
 ('soul-bind','soul',.38,740,.92,[1,2.62,3.31],.015,'Hollow wooden bell binding'),
 ('soul-pulse','soul',.29,880,1.05,[1,2.62,3.31],.012,'Soft compact spirit bell pulse'),
 ('soul-break','soul',.22,1120,1.20,[1,1.5,2.62],.018,'Clear short ascending release'),
 ('rift-mark','rift',.27,1320,1.02,[1,1.43,2.09],.012,'Small glass marker'),
 ('rift-burst','rift',.24,1700,.72,[1,1.43,2.09],.055,'Glass bloom descending'),
 ('rift-cut','rift',.17,1450,.82,[1,1.43,2.09],.085,'Brief glass slice'),
 ('prism-in','prism',.25,930,1.32,[1,1.25,1.5],.015,'Crystal entrance rising triad'),
 ('prism-out','prism',.25,1230,.72,[1,1.25,1.5],.015,'Crystal exit falling triad'),
 ('prism-charge','prism',.65,790,1.48,[1,1.25,1.5],.025,'Bounded crystal charge with three soft swells'),
 ('prism-break','prism',.21,1480,1.15,[1,1.25,1.5,2.13],.025,'Short resolved crystal interrupt'),
]

def band(x, lo, hi):
    f=np.fft.rfftfreq(len(x),1/SR)
    # Smooth shoulders avoid brick-wall ringing; remove low rumble and >6 kHz.
    gain=np.clip((f-lo)/180,0,1)*np.clip((hi-f)/700,0,1)
    return np.fft.irfft(np.fft.rfft(x)*gain,n=len(x))

def synth(spec, index):
    name,family,duration,hz,ratio,partials,air,_=spec
    n=round(duration*SR); t=np.arange(n)/SR; u=t/duration
    rng=np.random.default_rng(SEED+index)
    freq=hz*np.exp(np.log(ratio)*u)
    phase=2*np.pi*np.cumsum(freq)/SR
    x=np.zeros(n)
    for k,p in enumerate(partials):
        # Different decay rates soften metallic overtones; no square-wave buzz.
        env=(1-np.exp(-t/.006))*np.exp(-t/(duration/(2.1+k*.7)))
        x+=np.sin(phase*p+.14*k)*env/(1+k*2.8)
    if name=='prism-charge':
        x*=.70+.30*np.sin(np.pi*u*3)**2
    noise=band(rng.standard_normal(n),1300,4400)
    x+=noise*air*np.sin(np.pi*u)**2*np.exp(-u*2)
    x=band(x,160,5900)
    fade=np.minimum(1,t/.006)*np.minimum(1,(duration-t)/.025)
    x*=fade
    x-=x.mean()
    return x

def metrics(x):
    rms=float(np.sqrt(np.mean(x*x)))
    return dict(durationSeconds=len(x)/SR,peakDbFS=20*math.log10(max(float(np.max(np.abs(x))),1e-12)),
                rmsDbFS=20*math.log10(max(rms,1e-12)),dc=float(np.mean(x)),samples=len(x))

def wav(path,x):
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.round(np.clip(x,-1,1)*32767).astype('<i2').tobytes())

def encode(src,dst):
    subprocess.run([str(FFMPEG),'-hide_banner','-loglevel','error','-y','-i',str(src),'-c:a','aac','-b:a','80k','-ar',str(SR),'-ac','1',str(dst)],check=True)

def decode(path):
    raw=subprocess.check_output([str(FFMPEG),'-hide_banner','-loglevel','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(SR),'pipe:1'])
    return np.frombuffer(raw,dtype='<f4').astype(np.float64)

def main():
    OUT.mkdir(parents=True,exist_ok=True); ASSETS.mkdir(parents=True,exist_ok=True)
    records=[]; cues=[]; preview=[]; cursor=0.; previous=None
    for i,spec in enumerate(SPECS):
        name,family,duration,hz,ratio,partials,air,design=spec
        original=synth(spec,i)
        x=original*10**((-24-metrics(original)['rmsDbFS'])/20)
        pcm=OUT/f'asset-trial-{name}.wav'; dest=ASSETS/f'trial-{name}.m4a'
        for attempt in range(5):
            wav(pcm,x); encode(pcm,dest); decoded=decode(dest); m=metrics(decoded)
            if m['peakDbFS']<=-8 and -27<=m['rmsDbFS']<=-22: break
            adjustment=min(-8.25-m['peakDbFS'],-24-m['rmsDbFS'])
            x*=10**(adjustment/20)
        else: raise RuntimeError(f'Cannot meet constraints: {name} {m}')
        if abs(m['dc'])>.001: raise RuntimeError(f'DC failure: {name}')
        records.append(dict(name=name,family=family,design=design,parameters=dict(duration=duration,baseHz=hz,pitchRatio=ratio,partials=partials,air=air,seed=SEED+i,lowpassHz=5900),
                            pcmMetrics=metrics(x),decodedMetrics=m,bytes=dest.stat().st_size,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),file=dest.relative_to(ROOT).as_posix()))
        if family!=previous and previous is not None:
            gap=np.zeros(round(.55*SR)); preview.append(gap); cursor+=len(gap)/SR
        cues.append(dict(name=name,family=family,startSeconds=round(cursor,4),durationSeconds=len(decoded)/SR))
        preview.append(decoded); cursor+=len(decoded)/SR
        gap=np.zeros(round(.56*SR)); preview.append(gap); cursor+=len(gap)/SR
        previous=family
    wav(OUT/'trial-bosses-audition.wav',np.concatenate(preview))
    manifest=dict(provenance='程序合成，无第三方素材，不冒称AI服务/听感验收',sampleRate=SR,channels=1,codec='AAC 80 kbps',seed=SEED,
                  verification='Encoded files decoded and checked for peak, RMS, duration, DC; no speaker playback or subjective listening claimed.',assets=records,
                  audition=dict(file='output/trial-audio/trial-bosses-audition.wav',durationSeconds=cursor,cues=cues))
    (OUT/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (OUT/'asset-cue-order.txt').write_text('\n'.join(f"{c['startSeconds']:6.3f}s {c['family']:7} {c['name']}" for c in cues)+'\n',encoding='utf-8')
    print(json.dumps(dict(count=len(records),bytes=sum(r['bytes'] for r in records),peakRange=[min(r['decodedMetrics']['peakDbFS'] for r in records),max(r['decodedMetrics']['peakDbFS'] for r in records)],rmsRange=[min(r['decodedMetrics']['rmsDbFS'] for r in records),max(r['decodedMetrics']['rmsDbFS'] for r in records)],auditionSeconds=cursor),indent=2))

if __name__=='__main__': main()
