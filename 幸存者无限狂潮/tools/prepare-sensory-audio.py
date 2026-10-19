import subprocess,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]; ff=root/'output/gameplay-recording/tooling/node_modules/ffmpeg-static/ffmpeg.exe'
if not ff.exists(): ff=root/'output/gameplay-recording/tooling/node_modules/ffmpeg-static/ffmpeg.exe'
rows=[('impact-short','blade_01',.20),('kill-short','creature_die_01',.32),('pickup-short','item_gem_01',.22),('supply-short','item_coins_01',.36),('reward-up','spell_01',.70),('reward-evolution','spell_02',1.0),('result-win','item_gem_04',.90),('result-lose','creature_monster_01',.65),('pulse-short','spell_fire_03',.45),('blast-short','spell_fire_01',.48),('vortex-short','spell_02',.55),('select-short','lock_01',.12)]
manifest=[]
for dest,src,seconds in rows:
 inp=root/'output/sensory-upgrade/audio-source/rpg'/f'{src}.ogg'; out=root/'dist/assets/audio'/f'{dest}.m4a'
 filters=f'atrim=0:{seconds},asetpts=PTS-STARTPTS,loudnorm=I=-20:TP=-3:LRA=7,afade=t=out:st={max(0,seconds-.05)}:d=0.05'
 subprocess.run([str(ff),'-hide_banner','-loglevel','error','-y','-i',str(inp),'-af',filters,'-ac','1','-ar','44100','-c:a','aac','-b:a','80k',str(out)],check=True)
 manifest.append(dict(file=str(out.relative_to(root)),original=f'{src}.ogg',maxDuration=seconds,processing=filters,bytes=out.stat().st_size))
(root/'output/sensory-upgrade/audio-source/manifest.json').write_text(json.dumps(dict(source='https://opengameart.org/content/80-cc0-rpg-sfx',download='https://opengameart.org/sites/default/files/80-CC0-RPG-SFX_0.zip',author='rubberduck',license='CC0 1.0',files=manifest),indent=2),encoding='utf-8')
print('Converted',len(rows),'files;',sum(r['bytes'] for r in manifest),'bytes')


