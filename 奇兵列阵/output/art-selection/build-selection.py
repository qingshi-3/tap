"""Build review-only sprites and data from DESIGN.md. Never updates runtime assets."""
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
SPEC = importlib.util.spec_from_file_location('existing_importer', ROOT / 'source/scripts/import-duelyst-units.py')
IMPORTER = importlib.util.module_from_spec(SPEC)
sys.dont_write_bytecode = True
SPEC.loader.exec_module(IMPORTER)
DOC = (ROOT / 'DESIGN.md').read_text(encoding='utf-8-sig')
VERSION = re.search(r'^版本：(?:设计稿\s+)?([\d.]+)', DOC, re.MULTILINE).group(1)
EXISTING = json.loads((ROOT / 'source/src/assets/units/manifest.json').read_text(encoding='utf-8-sig'))['units']
COLORS = {'普通': '#c8d6de', '稀有': '#8cc8ff', '史诗': '#e1afff', '传说': '#ffd080'}
FACTIONS = {'l': '圣光', 's': '影刃', 'a': '深渊', 'm': '熔岩', 'v': '寒冰', 'd': '沙域', 'n': '中立'}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
    mappings = {}
    for line in DOC.split('### 11.4 单位素材选型', 1)[1].split('## 12 ', 1)[0].splitlines():
        match = re.match(r'^\| `([^`]+)` \| `([^`]+)` \| (.*?) \|$', line)
        if match:
            uid, source, reason = match.groups()
            assert uid not in mappings
            mappings[uid] = (source, reason)
    assert len(mappings) == 59

    records = []
    for line in DOC.splitlines():
        match = re.match(r'^\| (.*?) `([^`]+)` \| (普通|稀有|史诗|传说) (\d+)/(\d+) (.*?) \| (.*?) \| (.*?) \| (.*?) \|$', line)
        if not match:
            continue
        name, uid, quality, atk, hp, role, *effects = match.groups()
        source, reason = mappings[uid]
        atk, hp = int(atk), int(hp)
        records.append(dict(id=uid, name=name, kind='card', faction=FACTIONS[uid.split('_')[0]], rarity=quality,
                            role=role, atk=atk, hp=hp, source=source, reason=reason,
                            stars=[dict(level=i+1, atk=(0 if '不出手' in role else atk+i), hp=hp+2*i, effect=effect)
                                   for i, effect in enumerate(effects)]))
    assert len(records) == 56
    for uid, name, faction in [('t_shade', '暗影', '深渊'), ('t_hatch', '幼兽', '熔岩'), ('t_dervish', '沙兵', '沙域')]:
        source, reason = mappings[uid]
        records.append(dict(id=uid, name=name, kind='token', faction=faction, rarity='召唤物', role='身材由召唤者决定',
                            source=source, reason=reason, stars=[]))
    source_text = (ROOT/'source/src/core/data.ts').read_text(encoding='utf-8-sig')
    names = dict(re.findall(r"id: '([^']+)', (?:noAttack: true, )?name: '([^']+)'", source_text))
    for uid, meta in EXISTING.items():
        if not (uid.startswith('e_') or uid.startswith('general_')):
            continue
        key = uid.removeprefix('general_')
        kind = 'enemy' if uid.startswith('e_') else 'general'
        records.append(dict(id=uid, name=names[key], kind=kind, faction='敌军' if kind=='enemy' else '将军',
                            rarity='敌军' if kind=='enemy' else '将军', role='沿用现有映射', source=meta['source'],
                            reason='保留现有素材；本次不改变敌军/将军身份。', stars=[]))
    assert len(records) == 73 and len({r['id'] for r in records}) == 73
    assert len({r['source'] for r in records}) == 73, 'Sources must not be reused between distinct units'

    sprite_dir = OUT / 'previews'
    sprite_dir.mkdir(exist_ok=True)
    validations = []
    for record in records:
        uid, source = record['id'], record['source']
        previous = EXISTING.get(uid, {}).get('source')
        status = '新增' if previous is None else '保留' if previous == source else '建议替换'
        frames, box, keys = IMPORTER.extract(source)
        assert frames and all(frame.getbbox() for frame in frames), source
        bw, bh = box[2]-box[0], box[3]-box[1]
        target_h = 54 if uid == 'm_egg' else 63 if record['kind']=='token' or uid=='a_seed' else 96 if record['rarity']=='传说' or uid=='e_void' else 82
        scale = min(92/bw, target_h/bh)
        size = (round(bw*scale), round(bh*scale))
        cells = []
        for frame in frames:
            cell = Image.new('RGBA', (100, 112))
            sprite = frame.crop(box).resize(size, Image.Resampling.NEAREST)
            cell.alpha_composite(sprite, ((100-size[0])//2, 104-size[1]))
            cells.append(IMPORTER.add_outline(cell))
        # Existing source identity is retained; display scale follows the existing exported asset.
        if status == '保留':
            preview = Image.open(ROOT/'source/src/assets/units'/EXISTING[uid]['still']).convert('RGBA')
        else:
            preview = cells[0]
        preview.save(sprite_dir / f'{uid}.png')
        png = IMPORTER.SOURCE/'app/original_resources/units'/f'{source}.png'
        plist = IMPORTER.SOURCE/'app/resources/units'/f'{source}.plist'
        record.update(status=status, previousSource=previous, preview=f'previews/{uid}.png',
                      frames=len(frames), pngPath=str(png), plistPath=str(plist),
                      pngSha256=digest(png), plistSha256=digest(plist))
        validations.append(dict(id=uid, source=source, frameCount=len(frames), sourceBox=box, scaledSize=size,
                                allIdleFramesNonEmpty=True, normalizedOutlineEdgesClear=True))

    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 17)
    small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 14)
    title = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 22)
    cards = [r for r in records if r['kind']=='card']
    overview = Image.new('RGB', (8*174, 7*190+52), '#25313b')
    draw = ImageDraw.Draw(overview)
    draw.text((16, 12), '奇兵列阵 · 56 种单位素材选型', font=title, fill='#f1f5f6')
    for index, record in enumerate(cards):
        x, y = (index % 8)*174, (index // 8)*190+52
        if index//8 % 2:
            draw.rectangle((x,y,x+173,y+189), fill='#2d3943')
        preview = Image.open(sprite_dir/f"{record['id']}.png")
        overview.paste(preview, (x+37, y+4), preview)
        draw.text((x+9,y+117), record['name'], font=font, fill='#f1f5f6')
        draw.text((x+9,y+144), record['faction']+' '+record['rarity'], font=small, fill=COLORS[record['rarity']])
        draw.text((x+9,y+166), record['id'], font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',13), fill='#b9c6cf')
    overview.save(OUT/'roster.png')
    for faction in FACTIONS.values():
        group = [r for r in cards if r['faction']==faction]
        sheet = Image.new('RGB', (4*250,2*240+48),'#25313b')
        d = ImageDraw.Draw(sheet)
        d.text((16,10), faction+' · 选定素材',font=title,fill='#f1f5f6')
        for index,record in enumerate(group):
            x,y=(index%4)*250,(index//4)*240+48
            preview=Image.open(sprite_dir/f"{record['id']}.png")
            sheet.paste(preview,(x+75,y+6),preview)
            d.text((x+12,y+123),record['name']+'  '+record['rarity'],font=font,fill=COLORS[record['rarity']])
            d.text((x+12,y+151),record['id']+'  '+record['status'],font=small,fill='#d4dfe5')
            # Long source labels wrap without cropping the edge of the contact sheet.
            value=record['source']
            chunks=[value[i:i+29] for i in range(0,len(value),29)]
            for j,chunk in enumerate(chunks):
                d.text((x+12,y+179+j*18),chunk,font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',13),fill='#b9c6cf')
        sheet.save(OUT/f"selected-{group[0]['id'].split('_')[0]}.png")
    (OUT/'selection.json').write_text(json.dumps(dict(designVersion=VERSION, generatedFrom='DESIGN.md',
        sourceRoot=str(IMPORTER.SOURCE), units=records), ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
    summary = dict(objects=73, cards=56, tokens=3, enemies=10, generals=4,
                   retainedCards=sum(r['kind']=='card' and r['status']=='保留' for r in records),
                   newCards=sum(r['kind']=='card' and r['status']=='新增' for r in records),
                   replacedCards=[r['id'] for r in records if r['status']=='建议替换'],
                   uniqueSources=len({r['source'] for r in records}),
                   uniqueSourcePngHashes=len({r['pngSha256'] for r in records}),
                   validatedIdleFrames=sum(v['frameCount'] for v in validations), details=validations)
    assert summary['retainedCards']==22 and summary['newCards']==33
    assert summary['replacedCards']==['s_ninja'] and summary['uniqueSourcePngHashes']==73
    (OUT/'selection-validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in summary.items() if k!='details'},ensure_ascii=True))


if __name__ == '__main__':
    build()
