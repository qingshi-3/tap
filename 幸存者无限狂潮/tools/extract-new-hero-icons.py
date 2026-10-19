from PIL import Image
from pathlib import Path
root=Path('C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/resources/icons')
choices={'grapple-hook':'icon_f4_daemoniclure','grapple-slam':'icon_f5_smashem','grapple-clash':'icon_f5_kineticequilibrium','rift-gate':'icon_f1_aerial_rift','rift-step':'icon_f3_astralphasing','rift-barrage':'icon_f2_hollowvortex','magnet-field':'icon_f1_magnetize','magnet-lance':'icon_f3_stonestospears','magnet-crush':'icon_f3_metalworking'}
for name,source in choices.items():
 Image.open(root/(source+'.png')).crop((0,0,48,48)).save(Path('games/pixel-survivor/dist/assets/ui')/('skill-'+name+'.png'))
docs=Path('games/pixel-survivor/dist/assets/SOURCES.md')
with docs.open('a',encoding='utf8') as f:
 f.write('\n九技能图标：只读Duelyst app/resources/icons，原动画表48×48首帧原像素裁切；不重绘。\n\n| 本地assets/ui | 源icons |\n| --- | --- |\n'+ '\n'.join('| skill-'+k+'.png | '+v+'.png |' for k,v in choices.items())+'\n')
