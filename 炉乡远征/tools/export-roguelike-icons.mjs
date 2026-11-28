// Extract authored static frames; the authorized source library stays read-only.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = process.argv[2] || 'C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/resources';
const output = fileURLToPath(new URL('../dist/assets/roguelike/icons/', import.meta.url));
const evidence = fileURLToPath(new URL('../output/roguelike/ui/', import.meta.url));
const relics = [
  ['scout-lantern', 'artifact_f1_dawnseye', '照明与视野'],
  ['ember-pouch', 'bossspell_livingflame', '余烬火焰'],
  ['hearth-stone', 'boss_christmas_coal', '暖炉炭石'],
  ['bone-banner', 'artifact_f1_ironbanner', '战旗'],
  ['field-kit', 'icon_f1_sundropelixir', '治疗药瓶'],
  ['iron-seed', 'icon_f5_eggzactly', '种子般的卵与成长符号'],
  ['war-drum', 'icon_f1_rally', '鼓舞友军'],
  ['wing-boots', 'generalspell_f6_warbird', '羽翼与飞行'],
  ['oath-shield', 'artifact_f1_shieldofphalanx', '守护盾牌'],
  ['sun-chalice', 'artifact_f5_thegibblecup', '圣杯'],
  ['sun-script', 'artifact_f4_soulgrimwar', '书页与典籍'],
  ['sun-hammer', 'artifact_f5_godhammer', '锤'],
  ['rune-nest', 'icon_f4_nethersummoning', '符文召唤阵'],
  ['echo-crystal', 'icon_f6_hailstoneprison', '晶体'],
  ['storm-bell', 'boss_christmas_jinglebells', '铃'],
  ['mourning-quill', 'icon_neutral_brilliantplume', '羽毛'],
  ['soul-bowl', 'icon_f4_voidpulse', '灵魂汲取'],
  ['grave-candle', 'bossspell_restoringlight', '灵魂烛光与恢复符号'],
].map(([id, name, meaning]) => ({ id, source: `icons/${name}.png`, meaning, atlas: true }));
const routes = [['safe', 'bronze'], ['elite', 'gold'], ['boss', 'elite']].map(([id, rank]) => ({ id, source: `season_rewards/season_rank_${rank}.png`, meaning: `原作${rank}等级徽章`, atlas: false }));
mkdirSync(output, { recursive: true }); mkdirSync(evidence, { recursive: true });
const python = String.raw`
import sys,json,plistlib,re,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
config=json.load(sys.stdin); root=Path(config['source']); dest=Path(config['output']); evidence=Path(config['evidence']); result=[]
def numbers(value): return list(map(int,re.findall(r'-?\d+',str(value))))
for item in config['items']:
 path=root/item['source']; image=Image.open(path).convert('RGBA'); frameName=None; frame=None
 if item['atlas']:
  data=plistlib.load(open(path.with_suffix('.plist'),'rb'))['frames']
  frameName=next((name for name in sorted(data) if name.endswith('_000.png')),sorted(data)[0]); record=data[frameName]
  x,y,w,h=numbers(record.get('frame',record.get('textureRect'))); frame=[x,y,w,h]; image=image.crop((x,y,x+w,y+h))
  if record.get('rotated',record.get('textureRotated',False)): image=image.transpose(Image.Transpose.ROTATE_90)
  sw,sh=numbers(record.get('sourceSize',record.get('spriteSize','{%d,%d}'%image.size)))
  rect=numbers(record.get('sourceColorRect',record.get('spriteSourceSize','{0,0,%d,%d}'%image.size)))
  canvas=Image.new('RGBA',(sw,sh)); canvas.alpha_composite(image,(rect[0],rect[1])); image=canvas
 else:
  # The original rank emblems are large. Preserve their silhouette and alpha.
  bounds=image.getbbox(); image=image.crop(bounds); image.thumbnail((128,80),Image.Resampling.LANCZOS)
 target=dest/(item['id']+'.png'); image.save(target,optimize=True)
 result.append({**item,'frameName':frameName,'frame':frame,'width':image.width,'height':image.height,'bytes':target.stat().st_size,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
sheet=Image.new('RGBA',(7*170,3*138),(20,20,44,255)); draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',12)
for i,item in enumerate(result):
 x=(i%7)*170;y=(i//7)*138; image=Image.open(dest/(item['id']+'.png')).convert('RGBA')
 if item['atlas']: image=image.resize((image.width*2,image.height*2),Image.Resampling.NEAREST)
 image.thumbnail((146,100),Image.Resampling.LANCZOS);sheet.alpha_composite(image,(x+(170-image.width)//2,y+(104-image.height)//2))
 draw.text((x+8,y+109),item['id'],font=font,fill=(238,240,255))
sheet.save(evidence/'icon-contact-sheet.png');(evidence/'icon-export-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(result,ensure_ascii=False))
`;
const records = JSON.parse(execFileSync('python', ['-c', python], { input: JSON.stringify({ source, output, evidence, items: [...relics, ...routes] }), encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 1024 * 1024 }));
const map = items => Object.fromEntries(items.map(item => [item.id, `./assets/roguelike/icons/${item.id}.png`]));
writeFileSync(new URL('../dist/js/roguelike-icons.js', import.meta.url), `// Static images extracted from authorized Duelyst sources; see assets/roguelike/SOURCES.md.\nexport const RELIC_ICONS = Object.freeze(${JSON.stringify(map(relics), null, 2)});\nexport const ROUTE_ICONS = Object.freeze(${JSON.stringify(map(routes), null, 2)});\n`);
writeFileSync(new URL('../dist/assets/roguelike/icons/manifest.json', import.meta.url), JSON.stringify({ sourceRoot: 'Duelyst app/resources/', icons: records }, null, 2));
console.log(`Exported ${records.length} static icons (${records.reduce((sum, item) => sum + item.bytes, 0)} bytes); contact sheet: output/roguelike/ui/icon-contact-sheet.png`);
