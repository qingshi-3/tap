from pathlib import Path
import subprocess,json,zipfile
root=Path(__file__).resolve().parents[1]; raw=root/'output/sensory-upgrade/audio-source/retro'; ff=root/'output/gameplay-recording/tooling/node_modules/ffmpeg-static/ffmpeg.exe'; outdir=root/'output/sensory-rework'; outdir.mkdir(exist_ok=True)
rows=[('slash','sfx_wpn_sword1.wav',.111,-30),('pulse','sfx_sounds_impact2.wav',.138,-32),('hurt','sfx_sounds_impact1.wav',.093,-27),('pickup','sfx_coin_single2.wav',.171,-33),('select','sfx_sound_neutral1.wav',.20,-32),('upgrade','sfx_sounds_fanfare1.wav',.516,-25),('evolution','sfx_sounds_powerup1.wav',.836,-24),('win','sfx_sounds_fanfare1.wav',.516,-24),('lose','sfx_sound_neutral1.wav',.266,-27)]
manifest=[]
for name,original,duration,target in rows:
 inp=next(raw.rglob(original));out=root/'dist/assets/audio'/f'clean-{name}.m4a';filters=f'atrim=0:{duration},asetpts=PTS-STARTPTS,lowpass=f=6500,loudnorm=I={target}:TP=-8:LRA=7,afade=t=out:st={max(0,duration-.015)}:d=0.015'
 subprocess.run([str(ff),'-hide_banner','-loglevel','error','-y','-i',str(inp),'-af',filters,'-ac','1','-ar','44100','-c:a','aac','-b:a','80k',str(out)],check=True)
 manifest.append(dict(file=str(out.relative_to(root)),original=str(inp.relative_to(raw)),duration=duration,loudnessTarget=target,processing=filters,bytes=out.stat().st_size))
# A/B review: old attack -> new slash -> old pickup -> new pickup -> old upgrade -> new reward.
zipPath=root/'output/sensory-upgrade/package-check/pixel-survivor-0.14.1.zip'
oldDir=outdir/'old-samples';oldDir.mkdir(exist_ok=True)
if zipPath.exists():
 with zipfile.ZipFile(zipPath) as z:
  for n in ['impact-short.m4a','pickup-short.m4a','reward-up.m4a']:
   key=next(k for k in z.namelist() if k.endswith('/'+n));(oldDir/n).write_bytes(z.read(key))
 review=[oldDir/'impact-short.m4a',root/'dist/assets/audio/clean-slash.m4a',oldDir/'pickup-short.m4a',root/'dist/assets/audio/clean-pickup.m4a',oldDir/'reward-up.m4a',root/'dist/assets/audio/clean-upgrade.m4a']
 pcm=[]
 for i,p in enumerate(review):
  dest=outdir/f'review-{i}.wav';subprocess.run([str(ff),'-hide_banner','-loglevel','error','-y','-i',str(p),'-af','apad=pad_dur=0.6','-ar','44100','-ac','1',str(dest)],check=True);pcm.append(dest)
 listing=outdir/'review-concat.txt';listing.write_text('\n'.join("file '"+p.as_posix()+"'" for p in pcm),encoding='utf-8')
 subprocess.run([str(ff),'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listing),str(outdir/'old-vs-new.wav')],check=True)
(outdir/'audio-manifest.json').write_text(json.dumps(dict(source='https://opengameart.org/content/512-sound-effects-8-bit-style',author='Juhani Junkala (SubspaceAudio)',license='CC0 1.0',selection='Short source durations and envelopes; not subjective listening verified.',reviewOrder=['old attack','new slash','old pickup','new pickup','old upgrade','new reward'],files=manifest),indent=2),encoding='utf-8')
print('Converted',len(rows),'files;',sum(x['bytes'] for x in manifest),'bytes; A/B review ready')
