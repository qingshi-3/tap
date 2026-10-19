from PIL import Image,ImageDraw
from pathlib import Path
import hashlib,json
root=Path('C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/resources/icons')
choices={'sword-focus':'icon_f2_spellsword_light','sword-recall':'icon_f2_etherealblades','sword-union':'artifact_f4_spectralblade','spiral-orb':'icon_f2_spiralcounter','spiral-clone':'icon_f2_projection','spiral-convergence':'icon_f2_spiraltechnique','petal-sweep':'f4_shadowblossom','petal-pierce':'artifact_f6_winterblade','petal-bloom':'icon_f1_sunbloom'}
out=Image.new('RGBA',(650,9*78),(20,26,34,255));dr=ImageDraw.Draw(out);report=[]
for i,(name,source) in enumerate(choices.items()):
 src=root/(source+'.png');dest=Path('games/pixel-survivor/dist/assets/ui')/('skill-'+name+'.png');im=Image.open(src).convert('RGBA').crop((0,0,48,48));im.save(dest);out.alpha_composite(im.resize((72,72)),(0,i*78));dr.text((82,i*78+28),name+' <- '+source,fill='white');report.append({'file':str(dest),'source':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'crop':[0,0,48,48]})
out.save('games/pixel-survivor/output/hero-ascension/assets/icons.png');Path('games/pixel-survivor/output/hero-ascension/assets/icons.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
docs=Path('games/pixel-survivor/dist/assets/SOURCES.md');text=docs.read_text(encoding='utf8');marker='### 御剑、旋丸、花刃九技能图标';text=text.split(marker)[0].rstrip()
docs.write_text(text+'\n\n'+marker+'\n\n只读Duelyst app/resources/icons，原动画表48×48首帧原像素裁切；不重绘。\n\n| 本地assets/ui | 源icons |\n| --- | --- |\n'+ '\n'.join('| skill-'+k+'.png | '+v+'.png |' for k,v in choices.items())+'\n',encoding='utf8')

