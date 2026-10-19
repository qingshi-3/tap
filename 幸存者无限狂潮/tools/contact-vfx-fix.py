from pathlib import Path
import json
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
folder = root / 'output/vfx-full-fix'
old = root / 'output/vfx-full-audit'

def sheet(name, files, columns=4, width=422):
    files = [(label, path) for label, path in files if path.exists()]
    if not files: return
    height = round(width * 390 / 844)
    page = Image.new('RGB', (columns * width, ((len(files) + columns - 1) // columns) * (height + 24)), '#151d25')
    draw = ImageDraw.Draw(page)
    for index, (label, path) in enumerate(files):
        x, y = (index % columns) * width, (index // columns) * (height + 24)
        image = Image.open(path).convert('RGB')
        image.thumbnail((width, height))
        page.paste(image, (x, y+24))
        draw.text((x+6, y+5), label, fill='white')
    page.save(folder / name, quality=92)

e = json.loads((folder/'evidence.json').read_text(encoding='utf-8'))
s = json.loads((folder/'supplement.json').read_text(encoding='utf-8')) if (folder/'supplement.json').exists() else {'cases':[]}
for key in ['orb','orbit','dagger','lightning','frost','meteor','nova','mine','beam','vortex','familiar','aegis']:
    files=[]
    for c in e['cases']:
        if c.get('id')==key and c.get('viewport')==[844,390]:
            files += [(f"{key} {c.get('branch') or 'base'} | {f}", folder/f) for f in c['frames']]
    sheet(f'CONTACT-{key}.jpg',files)
for hero in ['commander','summoner','blink','mage']:
    files=[]
    for c in e['cases']:
        if c.get('hero')==hero:
            files += [(f"{hero} {c.get('id', c.get('kind'))} | {f}",folder/f) for f in c['frames']]
    sheet(f'CONTACT-HERO-{hero}.jpg',files)
sheet('CONTACT-SUPPLEMENT.jpg',[(f"{c['kind']} | {f}",folder/f) for c in s['cases'] for f in c['frames']])
sheet('CONTACT-SHORT.jpg',[(f"{c['id']} reduce={c['reduced']} | {f}",folder/f) for c in e['cases'] if c.get('viewport')==[667,320] for f in c['frames']])
comparisons=['nova-a-844-0p2.png','beam-a-844-0p2.png','meteor-a-844-1p1.png','mine-b-trigger-1p1.png','familiar-b-844-0p5.png','aegis-base-844-0p2.png','blink-auto-1.png','summoner-auto-1.png']
sheet('BEFORE-AFTER.jpg',[(f'{prefix} | {f}',base/f) for f in comparisons for prefix,base in [('BEFORE',old),('AFTER',folder)]],columns=2,width=844)
live=folder/'live'
if live.exists():
    sheet('CONTACT-LIVE.jpg',[(p.stem,p) for p in sorted(live.glob('*.png'))],columns=3,width=422)
print('Contact sheets written to',folder)
