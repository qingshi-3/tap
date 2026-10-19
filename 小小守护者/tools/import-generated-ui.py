"""Slice imagegen-authored sheets; keep original sheets and crop provenance."""
import hashlib
import json
from pathlib import Path
from PIL import Image

GAME = Path(__file__).resolve().parents[1]
SOURCE = GAME / 'output/art-concepts/generated-ui'
DEST = GAME / 'public/assets/ui-generated'
DEST.mkdir(parents=True, exist_ok=True)
ui = {}
records = []

def export(sheet, key, region, limit):
    with Image.open(SOURCE / sheet) as source:
        tile = source.convert('RGBA').crop(region)
    # Locate the solid authored object, excluding the presentation shadow margin.
    # The RGBA pixels themselves are not recolored or alpha-thresholded.
    bounds = tile.getchannel('A').point(lambda a: 255 if a > 240 else 0).getbbox()
    if not bounds:
        raise ValueError(key)
    tile = tile.crop(bounds)
    tile.thumbnail(limit, Image.Resampling.LANCZOS)
    tile.save(DEST / (key + '.png'), optimize=True)
    ui[key] = 'assets/ui-generated/' + key + '.png'
    records.append({'key': key, 'sheet': sheet, 'region': region, 'solidBounds': bounds, 'size': tile.size})

for row, state in enumerate(['Normal', 'Pressed', 'Disabled']):
    export('buttons.png', 'wide' + state, (0, row*341, 960, min(1024, (row+1)*341)), (300, 102))
    export('buttons.png', 'square' + state, (970, row*341, 1536, min(1024, (row+1)*341)), (100, 100))
export('panel.png', 'panel', (0, 0, 1536, 1024), (720, 400))
icons = ['coin', 'heart', 'pause', 'play', 'close', 'book', 'spellHeal', 'spellFreeze', 'star', 'map', 'fist', 'skull', 'swords', 'scroll', 'trophy', 'repair']
with Image.open(SOURCE / 'icons.png') as icon_sheet:
    w, h = icon_sheet.size
for i, key in enumerate(icons):
    x, y = i % 4, i // 4
    export('icons.png', key, (round(x*w/4), round(y*h/4), round((x+1)*w/4), round((y+1)*h/4)), (80, 80))

(DEST / 'skin.json').write_text(json.dumps(ui, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
manifest_path = GAME / 'public/assets/manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['ui'] = ui
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
provenance = {'created': '2026-10-14', 'generator': 'image_gen', 'sourceSheets': {name: hashlib.sha256((SOURCE/name).read_bytes()).hexdigest() for name in ['buttons.png', 'panel.png', 'icons.png']}, 'sprites': records}
(SOURCE / 'slicing.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
sources_path = GAME / 'public/assets/SOURCES.md'
sources = sources_path.read_text(encoding='utf-8')
start, end = sources.index('## UI'), sources.index('## 音效')
sources = sources[:start] + '## UI\n\n2026-10-14用户要求替换指定UI库，当前皮肤全部由image_gen生成：暖红木按钮正常/按下/禁用状态、深木面板及16种图标。导出清单为`ui-generated/skin.json`，脚本写入`manifest.json`的ui字段供运行引用，不再引用CraftPix皮肤。单位卡面引用Duelyst原帧，建筑卡面引用当前生成地景，不重绘单位。\n\n生成原图与SHA256、切片区域保留在游戏`output/art-concepts/generated-ui/`；可通过`tools/import-generated-ui.py`重建。仅裁取独立元素并缩至运行尺寸，未改源图。\n\n' + sources[end:]
sources_path.write_text(sources, encoding='utf-8')
print(json.dumps({'sprites': len(ui), 'directory': str(DEST)}))
