"""Read-only Duelyst atlas inventory and nearest-neighbor candidate contact sheets."""
import importlib.util
import json
import math
import plistlib
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
SOURCE = Path('C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main')
spec = importlib.util.spec_from_file_location('unit_extract', GAME / 'source/scripts/import-duelyst-units.py')
extractor = importlib.util.module_from_spec(spec)
sys.dont_write_bytecode = True
spec.loader.exec_module(extractor)
manifest = json.loads((GAME / 'source/src/assets/units/manifest.json').read_text(encoding='utf-8'))
used = defaultdict(list)
for uid, meta in manifest['units'].items():
    used[meta['source']].append(uid)

def main():
    dest = OUT / 'candidates'
    dest.mkdir(parents=True, exist_ok=True)
    records, errors, sheets = [], [], []
    font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 11)
    small = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 10)
    for group in [f'f{i}' for i in range(1, 7)] + ['neutral']:
        paths = sorted((SOURCE / 'app/original_resources/units').glob(group + '_*.png'))
        entries = []
        for path in paths:
            name = path.stem
            rec = {'source': name, 'group': group, 'usedBy': used[name], 'png': str(path), 'animations': {}}
            preview = None
            try:
                plist = SOURCE / 'app/resources/units' / (name + '.plist')
                rec['plist'] = str(plist)
                data = plistlib.loads(plist.read_bytes())
                animations = Counter()
                for key in data['frames']:
                    match = re.match(r'^(.*?)_(\d+)(?:\.[^.]+)?$', key)
                    animations[match.group(1) if match else key] += 1
                rec['animations'] = dict(sorted(animations.items()))
                frames, box, keys = extractor.extract(name)
                preview = frames[0].crop(box)
                rec.update(previewAnimation=keys[0].rsplit('_', 1)[0], previewFrames=len(frames), sourceUnionBox=box)
            except Exception as exc:
                rec['error'] = f'{type(exc).__name__}: {exc}'
                errors.append({'source': name, 'error': rec['error']})
            records.append(rec)
            entries.append((rec, preview))
        page_size = 30 if group == 'neutral' else max(1, len(entries))
        for page, start in enumerate(range(0, len(entries), page_size), 1):
            batch = entries[start:start + page_size]
            sheet = Image.new('RGB', (1200, math.ceil(len(batch)/6)*150), '#24282e')
            draw = ImageDraw.Draw(sheet)
            for i, (rec, preview) in enumerate(batch):
                x, y = (i % 6)*200, (i // 6)*150
                if preview:
                    scale = min(180/preview.width, 106/preview.height)
                    sprite = preview.resize((max(1, round(preview.width*scale)), max(1, round(preview.height*scale))), Image.Resampling.NEAREST)
                    sheet.paste(sprite, (x+(200-sprite.width)//2, y+108-sprite.height), sprite)
                else:
                    draw.text((x+10, y+45), 'EXTRACTION FAILED', font=font, fill='#ff8a8a')
                name = rec['source']
                # Split long identifiers across two lines, preserving every character.
                parts = [name[j:j+29] for j in range(0, len(name), 29)]
                for row, part in enumerate(parts[:2]):
                    draw.text((x+5, y+110+row*12), part, font=font, fill='#f1f0e9')
                status = 'USED: ' + ','.join(rec['usedBy']) if rec['usedBy'] else 'AVAILABLE'
                draw.text((x+5, y+136), status, font=small, fill='#ffcf77' if rec['usedBy'] else '#a6b6c0')
                rec['contactSheet'] = str(dest / f'{group}-{page:02}.png')
                rec['contactCell'] = {'column': i%6+1, 'row': i//6+1}
            target = dest / f'{group}-{page:02}.png'
            sheet.save(target)
            sheets.append({'group': group, 'path': str(target), 'count': len(batch)})
    result = {'sourceRoot': str(SOURCE), 'count': len(records), 'countsByGroup': dict(Counter(r['group'] for r in records)), 'usedCandidateCount': sum(bool(r['usedBy']) for r in records), 'errors': errors, 'sheets': sheets, 'units': records}
    (OUT/'catalog.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='units'}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
