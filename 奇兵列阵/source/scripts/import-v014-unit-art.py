"""Incremental v0.14 idle-art import; run from any directory. Never runs the legacy importer."""
import hashlib
import json
import math
import plistlib
import re
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path('C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main')
OUT = ROOT / 'source/src/assets/units'
REPORT = ROOT.parents[2] / 'output/qibing-v014-unit-art/import'
def numbers(value):
 return list(map(int, re.findall(r'-?\d+',value)))

def extract(source):
 data=plistlib.load(open(SOURCE/'app/resources/units'/f'{source}.plist','rb'))
 atlas=Image.open(SOURCE/'app/original_resources/units'/f'{source}.png').convert('RGBA')
 keys=sorted(k for k in data['frames'] if '_breathing_' in k)
 if not keys: keys=sorted(k for k in data['frames'] if '_idle_' in k)
 if not keys: raise ValueError(f'No idle/breathing animation for {source}')
 frames=[]
 for key in keys:
  f=data['frames'][key]; x,y,w,h=numbers(f['frame'])
  piece=atlas.crop((x,y,x+w,y+h))
  if f.get('rotated'): piece=piece.transpose(Image.Transpose.ROTATE_90)
  sw,sh=numbers(f['sourceSize']); sx,sy,cw,ch=numbers(f['sourceColorRect'])
  canvas=Image.new('RGBA',(sw,sh)); canvas.alpha_composite(piece,(sx,sy))
  assert canvas.getbbox(), f'Empty source animation frame: {source}/{key}'
  frames.append(canvas)
 boxes=[f.getbbox() for f in frames]; boxes=[b for b in boxes if b]
 union=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
 return frames,union,keys

def add_outline(cell, selected=False):
 # Keep ordinary outlines thin; selected units retain the stronger two-pixel edge.
 # Outline only empty pixels, leaving original colors and translucent effects untouched.
 alpha=cell.getchannel('A')
 solid=alpha.point(lambda a: 255 if a>=32 else 0)
 occupied=alpha.point(lambda a: 255 if a else 0)
 ring=ImageChops.subtract(solid.filter(ImageFilter.MaxFilter(5 if selected else 3)),occupied)
 outline=Image.new('RGBA',cell.size,(255,225,102,0) if selected else (255,248,226,0))
 outline.putalpha(ring.point(lambda a: (255 if selected else 235) if a else 0))
 result=Image.alpha_composite(outline,cell)
 difference=ImageChops.difference(result,cell)
 assert all(not ImageChops.multiply(channel,occupied).getbbox() for channel in difference.split()), 'Original sprite pixels changed'
 assert not result.getchannel('A').crop((0,0,100,1)).getbbox(), 'Outline clipped at top'
 assert not result.getchannel('A').crop((0,111,100,112)).getbbox(), 'Outline clipped at bottom'
 assert not result.getchannel('A').crop((0,0,1,112)).getbbox(), 'Outline clipped at left'
 assert not result.getchannel('A').crop((99,0,100,112)).getbbox(), 'Outline clipped at right'
 return result

MAPPING = {
 'l_warden':'f1_tank', 'l_lion':'f1_azuritelion', 'l_cliff':'f1_ironcliffeguardian', 'l_sunriser':'f1_sunriser',
 's_fox':'f2_lanternfox', 's_monk':'f2_ogremonk02', 's_caster':'f2_caster', 's_lord':'f2_altgeneral',
 'a_spine':'f4_darkspine', 'a_jugg':'f4_juggernaut', 'a_engulf':'f4_engulfingshadow', 'a_solus':'f4_blacksolus',
 'm_raptor':'f5_silitharveteran', 'm_kujata':'f5_kujata', 'm_vindicator':'f5_vindicator', 'm_mankator':'f5_mankatorwarbeast',
 'v_chaser':'f6_snowchaser', 'v_sentinel':'f6_sentinel', 'v_drake':'f6_frostdrake', 'v_wyvern':'f6_whitewyvern',
 'd_howler':'f3_sandhowler', 'd_glass':'f3_glassmirage', 'd_pyro':'f3_pyromancer', 'd_onyx':'f3_onyxpantheran',
 'n_archer':'neutral_mercranged1', 'n_thorn':'neutral_mercneedler', 'n_alchemist':'neutral_bloodstonealchemist', 'n_paragon':'neutral_sunsetparagon',
 'e_guardian':'neutral_primusshieldmaster', 'e_curser':'neutral_tribalcaster', 'e_pyre':'neutral_mercflamebloodwarlock',
 'e_twin':'neutral_merctwinbladewarmonger', 'e_lich':'neutral_bonereaper', 'e_dark_priest':'neutral_darknemesis',
 'e_revenant':'neutral_astralcrusader', 'e_tomb':'neutral_tombstone', 'e_warlord':'neutral_mercswornavanger',
 'e_frostq':'f6_altgeneraltier2', 'e_nightk':'neutral_unseven',
 'general_zirix':'f3_general', 'general_hank':'neutral_captainhankheart', 'general_vulkan':'f5_general',
 'general_argeon_2':'f1_tier2general', 'general_kaleos_2':'f2_tier2general', 'general_lilithe_2':'f4_tier2general',
 'general_vulkan_2':'f5_tier2general', 'general_faie_2':'f6_tier2general', 'general_zirix_2':'f3_tier2general',
 'e_shield':'neutral_golemsteel',
 'm_mender':'f5_magma', 'v_shard':'neutral_tribalranged1', 'e_silencer':'neutral_mercfrostbonenaga',
 'e_crusher':'neutral_golemstormmetal', 'e_skel':'neutral_golemdragonbone',
}
REASONS = {
 'l_warden':'厚重盾甲对应护卫和消耗格挡后恢复', 'l_lion':'蓝色狮兽对应名称和格挡强化攻击',
 'l_cliff':'巨大盾甲对应替相邻友军承伤', 'l_sunriser':'旭日圣光造型对应周期授予格挡',
 's_fox':'灯笼狐本体对应名称和易伤', 's_monk':'壮硕武僧对应碎骨近战', 's_caster':'影刃施术者对应法强和指定伤害',
 's_lord':'独立影刃统帅造型，避免与卡雷奥斯二阶共享',
 'a_spine':'暗色棘刺对应暗棘与复生', 'a_jugg':'大型深渊甲兽对应反击坦克', 'a_engulf':'吞噬暗影施法形态',
 'a_solus':'永夜大型施术者对应施法成长', 'm_raptor':'成熟迅猛兽对应连击和灼烧', 'm_kujata':'负岩重兽对应名称',
 'm_vindicator':'熔岩近战斗士对应连击和溅射', 'm_mankator':'大型炎鬃战兽对应全军溅射',
 'v_chaser':'雪地学徒对应寒意施法', 'v_sentinel':'坚固冰哨对应护甲与施法联动', 'v_drake':'霜龙对应群体寒意',
 'v_wyvern':'大型白霜龙对应冻结后突袭', 'd_howler':'沙色嚎叫者对应施加易伤', 'd_glass':'白色镜沙灵兽对应迅捷伏击与易伤成长，并非人形刺客',
 'd_pyro':'沙域火法对应指定伤害', 'd_onyx':'黑曜狮神对应名称和易伤攻击',
 'n_archer':'实体弓手对应队尾狙击', 'n_thorn':'带刺佣兵对应反击', 'n_alchemist':'炼金造型对应灼烧和寒意药剂',
 'n_paragon':'落日典范原造型对应同名辅助', 'e_guardian':'大盾卫士对应护卫', 'e_curser':'部族施术者对应诅咒易伤',
 'e_pyre':'火焰术士对应灼烧', 'e_twin':'双刃武士对应连击', 'e_lich':'骸骨施术者对应骨巫',
 'e_dark_priest':'暗色祭司对应治疗辅助', 'e_revenant':'幽魂铠甲对应复生骑士', 'e_tomb':'实体墓碑对应阵亡召唤',
 'e_warlord':'武装战帅对应全军增益', 'e_frostq':'独立寒冰女皇首领，区别法伊', 'e_nightk':'巨型亡灵君王对应召回亡者首领',
 'general_zirix':'沿用content.ts声明的沙域主将本体', 'general_hank':'沿用content.ts声明的佣兵团长本体',
 'general_vulkan':'修正为content.ts声明的熔岩主将，移除与熔岩巨兽重复',
 'e_shield':'实体钢铁重甲盾卫，移除与蛮兵重复',
 'm_mender':'直立厚甲兽斗士对应近战攻击与灼烧，替换原小蜥蜴辅助轮廓',
 'v_shard':'蓝色能量箭与实体弓手轮廓对应冰棱射手，替换原鹿形',
 'e_silencer':'蓝色冰霜法杖对应寒意施法，替换原禁魔者',
 'e_crusher':'大型石质重拳对应近战溅射，替换原双炮机器人',
 'e_skel':'裸骨骸与骨质四肢对应骷髅兵，替换原蓝甲石像',
}

def digest(path):
 return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
 REPORT.mkdir(parents=True, exist_ok=True)
 manifest_path = OUT / 'manifest.json'
 manifest = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
 data = (ROOT / 'source/src/core/data.ts').read_text(encoding='utf-8-sig')
 content = (ROOT / 'source/src/core/content.ts').read_text(encoding='utf-8-sig')
 names = dict(re.findall(r"(?:C|enemy)\('([^']+)', '([^']+)'", data))
 names.update(dict(re.findall(r"id: '(t_[^']+)', name: '([^']+)'", data)))
 generals = re.findall(r"id: '([^']+)', name: '([^']+)', title: '[^']+', faction: '[^']+', base: \d+, art: '([^']+)'(?:, art2: '([^']+)')?", content)
 expected = set(names)
 for uid, name, art, art2 in generals:
  names['general_'+uid] = name
  expected.add('general_'+uid)
  if art2:
   names['general_'+uid+'_2'] = name+' 二阶'
   expected.add('general_'+uid+'_2')
   assert MAPPING['general_'+uid+'_2'] == art2
 legendary = set(re.findall(r"C\('([^']+)', '[^']+', '[^']+', 4,", data))
 bosses = {'e_frostq', 'e_nightk'}
 before = {p.name:digest(p) for p in OUT.glob('*.png')}
 baseline_path = REPORT / 'baseline-hashes.json'
 if not baseline_path.exists():
  baseline_path.write_text(json.dumps(before, indent=2)+'\n', encoding='utf-8')
 baseline = json.loads(baseline_path.read_text(encoding='utf-8'))
 records = []
 source_paths = {}
 # Stage every output before replacing any artifact: missing sources or invalid
 # outlines therefore fail without leaving a partially updated asset directory.
 staged = []
 for uid, source in MAPPING.items():
  png = SOURCE / 'app/original_resources/units' / (source+'.png')
  plist = SOURCE / 'app/resources/units' / (source+'.plist')
  png_hash, plist_hash = digest(png), digest(plist)
  source_paths[png] = png_hash; source_paths[plist] = plist_hash
  frames, box, keys = extract(source)
  bw, bh = box[2]-box[0], box[3]-box[1]
  height = 82 if uid.startswith('general_') else 96 if uid in legendary or uid in bosses else 82
  scale = min(92/bw, height/bh)
  size = (round(bw*scale), round(bh*scale))
  strip = Image.new('RGBA', (100*len(frames),112))
  selected_strip = Image.new('RGBA', strip.size)
  normalized = []
  for i, frame in enumerate(frames):
   cell = Image.new('RGBA',(100,112))
   sprite = frame.crop(box).resize(size,Image.Resampling.NEAREST)
   cell.alpha_composite(sprite,((100-size[0])//2,104-size[1]))
   selected = add_outline(cell,True)
   cell = add_outline(cell)
   assert cell.getbbox() and selected.getbbox()
   strip.alpha_composite(cell,(100*i,0)); selected_strip.alpha_composite(selected,(100*i,0))
   normalized.append(cell)
  images = {'':strip,'-still':normalized[0],'-selected':selected_strip}
  for suffix, image in images.items():
   staged.append((OUT/(uid+suffix+'.png'),image))
  old = manifest['units'].get(uid)
  meta = dict(image=uid+'.png',still=uid+'-still.png',selectedImage=uid+'-selected.png',frames=len(frames),durationMs=max(800,round(len(frames)*1000/12)),width=100,height=112,source=source)
  manifest['units'][uid] = meta
  records.append(dict(id=uid,name=names[uid],source=source,reason=REASONS.get(uid,'沿用content.ts声明的主将二阶形象，保留阵营身份'),previousSource=old.get('source') if old else None,originalSource={'general_vulkan':'f5_grimrock','e_shield':'neutral_mercmelee4','v_shard':'f6_voiceofthewind','e_silencer':'neutral_mercarcanelimiter','e_crusher':'neutral_rook','e_skel':'neutral_golem_crossbones','m_mender':'f5_support'}.get(uid),pngSha256=png_hash,plistSha256=plist_hash,frames=len(frames),animationKeys=keys,sourceUnionBox=box,scaledSize=size,footY=104,allIdleFramesNonEmpty=True,normalizedOutlineEdgesClear=True,originalPixelsPreserved=True))
 assert expected <= set(manifest['units']), 'Missing art: '+str(expected-set(manifest['units']))
 for path, image in staged:
  image.save(path,optimize=True)
 touched = {p.name for p,_ in staged}
 retained = [name for name in baseline if name not in touched]
 assert all(digest(OUT/name)==baseline[name] for name in retained), 'Previously retained PNG changed'
 assert all(digest(OUT/name)==oldhash for name,oldhash in before.items() if name not in touched), 'Unrelated art changed during import'
 assert all(digest(path)==oldhash for path,oldhash in source_paths.items()), 'Source library mutated'
 # Full inventory validation also covers retained assets and every idle frame.
 frame_count=0
 for uid, meta in manifest['units'].items():
  for field in ('image','selectedImage'):
   with Image.open(OUT/meta[field]) as image:
    assert image.size==(100*meta['frames'],112)
    image=image.convert('RGBA')
    for i in range(meta['frames']):
     cell=image.crop((100*i,0,100*(i+1),112)); assert cell.getbbox(), uid
     alpha=cell.getchannel('A')
     assert not alpha.crop((0,0,100,1)).getbbox(),uid
     assert not alpha.crop((0,111,100,112)).getbbox(),uid
     assert not alpha.crop((0,0,1,112)).getbbox(),uid
     assert not alpha.crop((99,0,100,112)).getbbox(),uid
  with Image.open(OUT/meta['still']) as image:
   assert image.size==(100,112) and image.getbbox()
  frame_count+=meta['frames']
 manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 for r in records:
  if r['previousSource']==r['source']:
   assert all(digest(OUT/(r['id']+suffix+'.png'))==before[r['id']+suffix+'.png'] for suffix in ('','-still','-selected')), 'Repeated import changed generated pixels: '+r['id']
  r['outputSha256']={suffix:digest(OUT/(r['id']+suffix+'.png')) for suffix in ('','-still','-selected')}
 font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
 small=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',12)
 sheet=Image.new('RGB',(5*250,math.ceil(len(records)/5)*170),'#16232d');draw=ImageDraw.Draw(sheet)
 for i,r in enumerate(records):
  x=(i%5)*250;y=(i//5)*170
  with Image.open(OUT/(r['id']+'-still.png')) as sprite:
   sheet.paste(sprite,(x+75,y),sprite)
  draw.text((x+6,y+112),r['name']+' '+r['id'],font=font,fill='#f4ecd6')
  draw.text((x+6,y+140),r['source'],font=small,fill='#9ec6cc')
 sheet.save(REPORT/'contact-sheet.png',optimize=True)

 report=dict(count=len(records),manifestCount=len(manifest['units']),expectedCount=len(expected),fullCoverage=True,repeatImportHashesStable=all(r['previousSource']==r['source'] for r in records),totalFrames=frame_count,retainedPngsUnchanged=len(retained),retainedFiles=retained,allSourceHashesUnchanged=True,allFramesNonEmpty=True,allOutlineEdgesClear=True,units=records)
 (REPORT/'extraction-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

 lines = ['# Duelyst 单位素材来源', '', '用户于 2026-10-10 确认本地 Duelyst 素材可直接商用；源素材库仅只读。', '', '源库：`'+str(SOURCE)+'`。', '原图集：`app/original_resources/units/<source>.png`；帧元数据：`app/resources/units/<source>.plist`。', '仅导出 breathing / idle 序列，按全序列联合包围盒最近邻缩放；100×112 透明画布，脚底 y=104。', '普通图使用 1px 浅白硬边；选中图使用 2px 金黄硬边；只填充原透明像素，保留原像素 RGBA。', '', '| ID | 名称 | source | 帧数 |', '|---|---|---|---|']
 lines += [f"| {uid} | {names.get(uid, uid)} | {meta['source']} | {meta['frames']} |" for uid,meta in manifest['units'].items()]
 sources_path = ROOT / 'source/public/assets/SOURCES.md'
 sources_path.parent.mkdir(parents=True, exist_ok=True)
 sources_path.write_text('\n'.join(lines)+'\n', encoding='utf-8')
 print(json.dumps({k:v for k,v in report.items() if k not in ('units','retainedFiles')},ensure_ascii=False))

if __name__=='__main__':
 main()






