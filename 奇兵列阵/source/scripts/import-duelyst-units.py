"""Extract only idle/breathing animation; source atlases remain untouched."""
import json, re, plistlib, argparse, hashlib, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path('C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main')
MAPPING = {
 'l_shield':'f1_silverguardsquire', 'l_martyr':'f1_support', 'l_priest':'f1_caster', 'l_knight':'f1_silvermanevanguard',
 's_wind':'f2_melee', 's_backstab':'f2_keshraifanblade', 's_dart':'f2_ranged', 's_ninja':'f2_special',
 'a_seed':'f4_gloomchaser', 'a_devour':'f4_daemondeep', 'a_reaper':'f4_reaperninemoons', 'a_cult':'f4_shadowdancer',
 'm_egg':'f5_egg', 'm_shaman':'f5_primordialgazer', 'm_rex':'f5_unstableleviathan', 'm_titan':'f5_grimrock',
 'v_guard':'f6_crystalbeetle', 'v_wall':'f6_bonechillbarrier', 'v_mage':'f6_icedryad', 'v_shard':'f6_voiceofthewind',
 'n_obelisk':'f3_obelyskredsand', 'n_echo':'neutral_aethermaster', 'n_merc':'neutral_mercmelee1',
 't_shade':'f4_crawler', 't_hatch':'f5_silitharyoung',
 'e_skel':'neutral_golem_crossbones', 'e_raider':'neutral_mercpirate', 'e_golem':'neutral_golemrunesand',
 'e_brute':'neutral_mercmelee4', 'e_assassin':'neutral_mercdaggerkiri', 'e_silencer':'neutral_mercarcanelimiter',
 'e_crusher':'neutral_rook', 'e_exile':'neutral_voidhunter', 'e_thorn':'neutral_beastswamp', 'e_void':'boss_shadowlord',
 'general_argeon':'f1_general', 'general_kaleos':'f2_general', 'general_lilithe':'f4_general', 'general_faie':'f6_general',
}

# DESIGN is the selected-art authority. Preserve enemy/general identities, and
# read the 59 card/token selections without depending on generated review data.
_design = (ROOT/'DESIGN.md').read_text(encoding='utf-8-sig')
_selection_section = _design.split('### 11.4 单位素材选型', 1)[1].split('## 12 ', 1)[0]
_selected = dict(re.findall(r'^\| `([^`]+)` \| `([^`]+)` \|', _selection_section, re.MULTILINE))
assert len(_selected) == 59, 'Expected 56 cards and 3 tokens in DESIGN selected art'
MAPPING = {**_selected, **{k:v for k,v in MAPPING.items() if k.startswith(('e_', 'general_'))}}
assert len(MAPPING) == 73 and len(set(MAPPING.values())) == 73

def digest(path):
 return hashlib.sha256(path.read_bytes()).hexdigest()

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

def main():
 global SOURCE
 parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=SOURCE)
 parser.add_argument('--report',type=Path,default=ROOT/'output/content-expansion/assets')
 args=parser.parse_args()
 SOURCE=args.source
 out=ROOT/'source/src/assets/units'; report=args.report
 out.mkdir(parents=True,exist_ok=True);report.mkdir(parents=True,exist_ok=True)
 text=(ROOT/'source/src/core/data.ts').read_text(encoding='utf-8')
 names=dict(re.findall(r"id: '([^']+)', (?:noAttack: true, )?name: '([^']+)'",text))
 names.update({f'general_{k}':names[k] for k in ('argeon','kaleos','lilithe','faie')})
 previous=json.loads((out/'manifest.json').read_text(encoding='utf-8-sig'))['units'] if (out/'manifest.json').exists() else {}
 # Keep established scales for retained art. New legendary bodies may use the
 # selected 96px scale; all summoned bodies stay at the 63px token scale.
 legendary=set(re.findall(r'^\| .*? `([^`]+)` \| 传说 ', _design, re.MULTILINE))
 selected_review=json.loads((ROOT/'output/art-selection/selection.json').read_text(encoding='utf-8-sig'))
 reviewed={r['id']:r for r in selected_review['units']}
 manifest={'version':1,'units':{}}; records=[]; preserved_files=[]
 for uid,source in MAPPING.items():
  png=SOURCE/'app/original_resources/units'/f'{source}.png'
  plist=SOURCE/'app/resources/units'/f'{source}.plist'
  png_hash,plist_hash=digest(png),digest(plist)
  assert reviewed[uid]['source']==source, f'Review selection is stale: {uid}'
  assert reviewed[uid]['pngSha256']==png_hash and reviewed[uid]['plistSha256']==plist_hash, f'Source changed since art selection: {uid}'
  old_hashes={suffix:digest(out/f'{uid}{suffix}.png') for suffix in ('','-still','-selected') if (out/f'{uid}{suffix}.png').exists()}
  frames,box,keys=extract(source); bw,bh=box[2]-box[0],box[3]-box[1]
  retained=previous.get(uid,{}).get('source')==source
  # The prior importer used 96px for e_void/m_titan, 82px for other old art.
  was_old=uid in {'l_shield','l_martyr','l_priest','l_knight','s_wind','s_backstab','s_dart','a_seed','a_devour','a_reaper','a_cult','m_egg','m_shaman','m_rex','m_titan','v_guard','v_wall','v_mage','v_shard','n_obelisk','n_echo','n_merc','t_shade','t_hatch'} or uid.startswith(('e_','general_'))
  height=54 if uid=='m_egg' else 63 if uid.startswith('t_') or uid=='a_seed' else 96 if uid in ('e_void','m_titan') or (uid in legendary and not was_old) else 82
  scale=min(92/bw,height/bh);size=(round(bw*scale),round(bh*scale))
  strip=Image.new('RGBA',(100*len(frames),112)); selected_strip=Image.new('RGBA',strip.size); normalized=[]
  for i,frame in enumerate(frames):
   cell=Image.new('RGBA',(100,112));sprite=frame.crop(box).resize(size,Image.Resampling.NEAREST)
   cell.alpha_composite(sprite,((100-size[0])//2,104-size[1]))
   selected=add_outline(cell,selected=True);cell=add_outline(cell)
   strip.alpha_composite(cell,(100*i,0));normalized.append(cell)
   selected_strip.alpha_composite(selected,(100*i,0))
  strip.save(out/f'{uid}.png');normalized[0].save(out/f'{uid}-still.png')
  selected_strip.save(out/f'{uid}-selected.png')
  manifest['units'][uid]={'image':f'{uid}.png','still':f'{uid}-still.png','frames':len(frames),'durationMs':max(800,round(len(frames)*1000/12)),'width':100,'height':112,'source':source}
  manifest['units'][uid].update(selectedImage=f'{uid}-selected.png')
  new_hashes={suffix:digest(out/f'{uid}{suffix}.png') for suffix in ('','-still','-selected')}
  if was_old and retained:
   assert old_hashes==new_hashes, f'Retained art changed: {uid}'
   preserved_files.extend(f'{uid}{suffix}.png' for suffix in new_hashes)
  assert digest(png)==png_hash and digest(plist)==plist_hash, f'Source mutation detected: {uid}'
  records.append({'id':uid,'name':names[uid],'source':source,'frames':len(frames),'sourceUnionBox':box,'scaledSize':size,'animation':keys[0].rsplit('_',1)[0], 'pngSha256':png_hash,'plistSha256':plist_hash,'outputSha256':new_hashes,'allIdleFramesNonEmpty':True,'normalizedOutlineEdgesClear':True,'originalPixelsPreserved':True,'footY':104})
 (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16);small=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',12)
 sheet=Image.new('RGB',(5*240,math.ceil(len(records)/5)*166),'#16232d');draw=ImageDraw.Draw(sheet)
 for i,r in enumerate(records):
  x=(i%5)*240;y=(i//5)*166;sheet.paste(Image.open(out/f"{r['id']}-still.png"),(x+70,y),Image.open(out/f"{r['id']}-still.png"))
  draw.text((x+8,y+111),r['name']+' '+r['id'],font=font,fill='#f4ecd6');draw.text((x+8,y+137),r['source'],font=small,fill='#9ec6cc')
 sheet.save(report/'contact-sheet.png')
 (report/'extraction-report.json').write_text(json.dumps({'count':len(records),'totalFrames':sum(r['frames'] for r in records),'uniqueSources':len(set(MAPPING.values())),'retainedPngsUnchanged':len(preserved_files),'units':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 lines=['# Duelyst 单位素材来源','','用户于 2026-10-10 授权原素材库所有素材可直接商用。本次仅从副本导出，不修改源库。',f'','源库：`'+str(SOURCE)+'`。','原图集：`app/original_resources/units/<source>.png`；帧元数据：`app/resources/units/<source>.plist`。','仅取 breathing / idle 序列，按全序列联合透明包围盒统一最近邻缩放，统一透明 100×112 画布、脚底 y=104；原动画帧顺序与停顿保留。','方尖碑映射 Vetruvian 原方尖碑；敌军使用独立中立/首领原造型。','','| ID | 名称 | source | 帧数 |','|---|---|---|---|']
 lines += [f"| {r['id']} | {r['name']} | {r['source']} | {r['frames']} |" for r in records]
 lines.insert(8,'所有角色追加 1 个导出像素宽的浅白硬边轮廓（#fff8e2，alpha=235），仅填充原透明像素；原图颜色、半透明特效与帧位置保持不变，不使用模糊发光。')
 lines.insert(9,'选中变体 `*-selected.png` 使用相同原帧独立添加 2px 金黄硬边（#ffe166，alpha=255），仅填充原透明像素，保留原像素RGBA；manifest 的 selectedImage 指向变体。')
 (ROOT/'dist/assets/SOURCES.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
 assert len(manifest['units'])==73
 for uid,meta in manifest['units'].items():
  image=Image.open(out/meta['image']); assert image.size==(100*meta['frames'],112)
  assert Image.open(out/meta['still']).size==(100,112)
  assert image.getbbox() and image.mode=='RGBA'
  selected=Image.open(out/meta['selectedImage']);assert selected.size==image.size
 print(f'Validated {len(records)} units: {len(records)*3} PNGs, {sum(r["frames"] for r in records)} frames, selected variants, manifest and contact sheet; {len(preserved_files)} retained PNGs unchanged.')

if __name__=='__main__':main()
