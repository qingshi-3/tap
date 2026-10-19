import {copyFile,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceRoot='D:/godot/rpg';
const {unitAssets}=await import(pathToFileURL(path.join(root,'dist/assets.js')));
const choices=[
 ['grappler',1,'拳斗士','neutral/中立_Gauntlet大师',148],['grappler',2,'魔手斗士','neutral/中立_异界Highhand',148],['grappler',3,'巨擘战将','岚影诸派/f2_异界Godpalmblacktiger',160],
 ['rift',1,'折光学徒','neutral/中立_异界Mirrormancer',145],['rift',2,'界门术士','星砂圣庭/f3_异界Duskweaver',150],['rift',3,'万门织界者','neutral/中立_Aether大师',158],
 ['magnet',1,'拾铁匠','neutral/中立_异界Z0r',135],['magnet',2,'磁械师','neutral/中立_异界Deceptib0t',150],['magnet',3,'磁极武装者','neutral/中立_机械Az0r超型',162],
];
function parse(source){
 const regions=new Map([...source.matchAll(/\[sub_resource type="AtlasTexture" id="([^"]+)"\][\s\S]*?region\s*=\s*Rect2\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/g)].map(m=>[m[1],{x:+m[2],y:+m[3],w:+m[4],h:+m[5]}]));
 const animations={};
 for(const m of source.matchAll(/"frames"\s*:\s*\[([\s\S]*?)\]\s*,\s*"loop"\s*:\s*(true|false)\s*,\s*"name"\s*:\s*&"([^"]+)"\s*,\s*"speed"\s*:\s*([\d.-]+)/g))animations[m[3]]={fps:+m[4],loop:m[2]==='true',frames:[...m[1].matchAll(/"duration"\s*:\s*([\d.-]+)\s*,\s*"texture"\s*:\s*SubResource\("([^"]+)"\)/g)].map(f=>({...regions.get(f[2]),duration:+f[1]}))};
 return animations;
}
const evidence=[];
for(const [hero,tier,name,dir,renderSize] of choices){
 const sourceDir=path.join(sourceRoot,'assets/battle/units',dir);const pngPath=path.join(sourceDir,(await readdir(sourceDir)).find(n=>n.endsWith('.png')));const png=await readFile(pngPath),sha256=createHash('sha256').update(png).digest('hex').toUpperCase();
 const animations=parse(await readFile(path.join(sourceDir,'frames.tres'),'utf8'));
 for(const action of ['idle','attack','run','hit','death'])if(!animations[action]?.frames.length)throw Error('Missing '+action+' '+dir);
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 for(const action of Object.values(animations))for(const f of action.frames)if(f.x<0||f.y<0||f.x+f.w>width||f.y+f.h>height)throw Error('Frame bounds '+dir);
 const visualPath=path.join(sourceRoot,'resource/battle/units',dir,'visual.tres');const visual=await readFile(visualPath,'utf8');
 const offset=visual.match(/Offset\s*=\s*Vector2\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/),scale=visual.match(/Scale\s*=\s*Vector2\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/),frame=animations.idle.frames[0];
 if(!offset||!scale)throw Error('Anchor '+dir);
 const anchor={x:+(.5-+offset[1]/(frame.w*+scale[1])).toFixed(4),y:+(.5-+offset[2]/(frame.h*+scale[2])).toFixed(4)};
 const key=`hero_${hero}_${tier}`,dest=path.join(root,'dist/assets/units',key+'.png');await copyFile(pngPath,dest);
 unitAssets[key]={src:`./assets/units/${key}.png`,readableName:name,role:'hero profession',sourceIdentity:dir,sourceSha256:sha256,renderSize,authoredSize:true,animationAliases:{move:['run'],cast:['attack']},anchor,animations};
 evidence.push({key,name,sourcePng:pngPath,sourceFrames:path.join(sourceDir,'frames.tres'),sourceVisual:visualPath,sha256,width,height,bytes:png.length,anchor,actions:Object.fromEntries(Object.entries(animations).map(([a,v])=>[a,{frames:v.frames.length,fps:v.fps,loop:v.loop}]))});
}
await mkdir(path.join(root,'output/new-heroes/assets'),{recursive:true});
await writeFile(path.join(root,'dist/assets.js'),'// Original authored unit atlases; reviewed additions: extract-new-hero-assets.mjs.\nexport const unitAssets = '+JSON.stringify(unitAssets,null,2)+';\n');
await writeFile(path.join(root,'output/new-heroes/assets/manifest.json'),JSON.stringify(evidence,null,2)+'\n');
const docs=path.join(root,'dist/assets/SOURCES.md');let text=await readFile(docs,'utf8');const marker='## 三名机制英雄九职业素材（2026-10-12）';if(text.includes(marker))text=text.slice(0,text.indexOf(marker));
await writeFile(docs,text.trimEnd()+'\n\n'+marker+'\n\n只读授权D:/godot/rpg源库，九份不同原PNG逐字节复制；保留原帧区域、速度、循环、帧时长与visual.tres锚点。cast只映射attack。候选idle/attack/run实际接触表经人工查看，蓝拳套→青能掌→双魔手、镜杖→门杖→浮环阵、小球械→关节刃械→重机甲按职责配形态；不复用原四英雄或试炼Boss。\n\n| key | 职业 | 原PNG | SHA256 | 尺寸 |\n| --- | --- | --- | --- | --- |\n'+evidence.map(e=>`| ${e.key} | ${e.name} | ${e.sourcePng} | ${e.sha256} | ${e.width}×${e.height} |`).join('\n')+'\n\n复现tools/extract-new-hero-assets.mjs；元数据output/new-heroes/assets/manifest.json，实际帧contact表candidates.jpg。九PNG共'+evidence.reduce((n,e)=>n+e.bytes,0)+'字节。技能实体手/铁片使用上述原图集局部区域缓存绘制，门和冲击纹理复用已入包Duelyst VFX，无新生图/改源图。\n');
console.log(evidence.map(e=>e.key+': '+e.bytes+' bytes').join('\n'));
