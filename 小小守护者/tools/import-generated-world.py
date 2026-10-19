"""Export original imagegen environment art as independent runtime sprites."""
import hashlib
import json
from pathlib import Path
from PIL import Image

GAME = Path(__file__).resolve().parents[1]
SOURCE = GAME / 'output/art-concepts/generated-ui'
DEST = GAME / 'public/assets/world-generated'
DEST.mkdir(parents=True, exist_ok=True)
world = {}
records = []
with Image.open(SOURCE / 'environment.png') as sheet:
    for key, region, limit in [('keep',(0,0,640,560),(120,144)),('tower',(640,0,1280,560),(72,120)),('wall',(0,560,640,870),(96,64)),('slow',(640,560,1280,870),(96,64)),('tree',(0,870,640,1280),(72,108)),('rock',(640,870,1280,1280),(96,64))]:
        tile = sheet.convert('RGBA').crop(region)
        bounds = tile.getchannel('A').point(lambda a: 255 if a>240 else 0).getbbox()
        if not bounds: raise ValueError(key)
        tile = tile.crop(bounds)
        tile.thumbnail(limit, Image.Resampling.LANCZOS)
        tile.save(DEST / (key+'.png'), optimize=True)
        world[key] = {'file':'assets/world-generated/'+key+'.png','rect':[0,0,*tile.size]}
        records.append({'key':key,'region':region,'solidBounds':bounds,'size':tile.size})
with Image.open(SOURCE / 'grass.png') as grass:
    grass.resize((512,512), Image.Resampling.LANCZOS).save(DEST/'grass.png', optimize=True)
world['grassBackdrop'] = {'file':'assets/world-generated/grass.png','rect':[0,0,512,512]}
(DEST/'skin.json').write_text(json.dumps(world,indent=2)+'\n',encoding='utf-8')
manifest_path=GAME/'public/assets/manifest.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['world'].update(world)
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(SOURCE/'world-slicing.json').write_text(json.dumps({'generator':'image_gen','created':'2026-10-14','sourceSheets':{name:hashlib.sha256((SOURCE/name).read_bytes()).hexdigest() for name in ['environment.png','grass.png']},'sprites':records},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'sprites':len(world),'output':str(DEST)}))
