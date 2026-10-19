"""Render a labeled contact sheet of every Duelyst fx atlas (3 frames each) for VFX mapping review.

Usage: python -I tools/catalog-duelyst-fx.py <duelyst fx dir> <output dir>
Read-only on the source library.
"""
import plistlib, re, sys
from pathlib import Path
from PIL import Image, ImageDraw

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
CELL, PER_ROW, PER_SHEET = 96, 4, 48  # 4 effects per row, 3 frames each


def nums(s):
    return [int(v) for v in re.findall(r'-?\d+', s)]


def frames_of(plist_path):
    data = plistlib.loads(plist_path.read_bytes())
    atlas = Image.open(plist_path.with_suffix('.png')).convert('RGBA')
    names = sorted(data.get('frames', {}))
    result = []
    for name in names:
        f = data['frames'][name]
        rect = f.get('frame') or f.get('textureRect')
        rotated = f.get('rotated') or f.get('textureRotated') or False
        x, y, w, h = nums(rect)
        if rotated:
            img = atlas.crop((x, y, x + h, y + w)).rotate(90, expand=True)
        else:
            img = atlas.crop((x, y, x + w, y + h))
        result.append((name, img))
    return result


def bbox_fit(img, size):
    img = img.copy()
    img.thumbnail((size - 4, size - 4), Image.NEAREST if max(img.size) < size else Image.LANCZOS)
    cell = Image.new('RGBA', (size, size), (18, 20, 28, 255))
    cell.alpha_composite(img, ((size - img.width) // 2, (size - img.height) // 2))
    return cell


entries = []
for plist in sorted(src.glob('*.plist')):
    if not plist.with_suffix('.png').exists():
        continue
    try:
        fr = frames_of(plist)
    except Exception as e:  # report and skip malformed atlases
        print('skip', plist.name, e)
        continue
    if not fr:
        continue
    picks = [fr[int(len(fr) * t)] for t in (0.15, 0.45, 0.75)]
    entries.append((plist.stem, len(fr), picks))

index_lines = []
for s in range(0, len(entries), PER_SHEET):
    chunk = entries[s:s + PER_SHEET]
    rows = (len(chunk) + PER_ROW - 1) // PER_ROW
    W, H = PER_ROW * (CELL * 3 + 12), rows * (CELL + 16)
    sheet = Image.new('RGBA', (W, H), (8, 9, 12, 255))
    d = ImageDraw.Draw(sheet)
    for i, (name, count, picks) in enumerate(chunk):
        cx, cy = (i % PER_ROW) * (CELL * 3 + 12), (i // PER_ROW) * (CELL + 16)
        d.text((cx + 2, cy + 1), f'{name} ({count}f)', fill=(240, 220, 150, 255))
        for k, (_, img) in enumerate(picks):
            sheet.alpha_composite(bbox_fit(img, CELL), (cx + k * CELL, cy + 14))
        index_lines.append(f'{name}\t{count}\t{picks[1][1].size}')
    sheet.convert('RGB').save(out / f'fx-catalog-{s // PER_SHEET + 1}.png')
(out / 'fx-catalog-index.tsv').write_text('\n'.join(index_lines), encoding='utf-8')
print(len(entries), 'effects')
