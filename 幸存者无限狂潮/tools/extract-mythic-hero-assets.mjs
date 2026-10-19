import {copyFile,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceRoot='D:/godot/rpg';
const {unitAssets}=await import(pathToFileURL(path.join(root,'dist/assets.js')));
const choices=[
 ['sword',1,'剑修学徒','莱昂纳王国/f1_法刃Adept',150],['sword',2,'御剑修士','neutral/中立_剑Ofakrane',156],['sword',3,'御剑真君','岚影诸派/f2_宗师Zendo',156],
 ['spiral',1,'旋丸学徒','岚影诸派/f2_异界Chakriavatar',150],['spiral',2,'旋丸影者','岚影诸派/f2_法术Thief',152],['spiral',3,'群影仙者','岚影诸派/f2_二阶替补将军',166],
 ['petal',1,'花刃学徒','岚影诸派/f2_施法者',148],['petal',2,'花刃使','岚影诸派/f2_异界Onnabugeisha',160],['petal',3,'千花刃主','岚影诸派/f2_异界Caligrapher',170],
 ['summoner',3,'万灵统御者','深渊军团/f4_宗师Variax',164],['blink',3,'千影瞬行者','岚影诸派/f2_Shidai二型',168],['mage',3,'三相主宰','霜原部盟/f6_宗师Embla',164],
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
 for(const action of ['idle','attack','run','hit'])if(!animations[action]?.frames.length)throw Error('Missing '+action+' '+dir);
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 for(const action of Object.values(animations))for(const f of action.frames)if(f.x<0||f.y<0||f.x+f.w>width||f.y+f.h>height)throw Error('Frame bounds '+dir);
 const visualPath=path.join(sourceRoot,'resource/battle/units',dir,'visual.tres');const visual=await readFile(visualPath,'utf8');
 const offset=visual.match(/Offset\s*=\s*Vector2\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/),scale=visual.match(/Scale\s*=\s*Vector2\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/),frame=animations.idle.frames[0];
 if(!offset||!scale)throw Error('Anchor '+dir);
 const anchor={x:+(.5-+offset[1]/(frame.w*+scale[1])).toFixed(4),y:+(.5-+offset[2]/(frame.h*+scale[2])).toFixed(4)};
 const key=`hero_${hero}_${tier}`,dest=path.join(root,'dist/assets/units',key+'.png');await copyFile(pngPath,dest);
 unitAssets[key]={src:`./assets/units/${key}.png`,readableName:name,role:'hero profession',sourceIdentity:dir,sourceSha256:sha256,renderSize,authoredSize:true,animationAliases:{move:['run','move'],cast:['attack'],death:['death','die','defeated']},anchor,animations};
 evidence.push({key,name,sourcePng:pngPath,sourceFrames:path.join(sourceDir,'frames.tres'),sourceVisual:visualPath,sha256,width,height,bytes:png.length,anchor,actions:Object.fromEntries(Object.entries(animations).map(([a,v])=>[a,{frames:v.frames.length,fps:v.fps,loop:v.loop}]))});
}
await mkdir(path.join(root,'output/hero-ascension/assets'),{recursive:true});
await writeFile(path.join(root,'dist/assets.js'),'// Original authored unit atlases; reviewed additions: extract-mythic-hero-assets.mjs.\nexport const unitAssets = '+JSON.stringify(unitAssets,null,2)+';\n');
await writeFile(path.join(root,'output/hero-ascension/assets/manifest.json'),JSON.stringify(evidence,null,2)+'\n');
const docs=path.join(root,'dist/assets/SOURCES.md');let text=await readFile(docs,'utf8');const marker='## 十英雄三阶新增素材（2026-10-12）';if(text.includes(marker)){const start=text.indexOf(marker),next=text.indexOf('\n## ',start+marker.length);text=text.slice(0,start)+(next<0?'':text.slice(next));}
await writeFile(docs,text.trimEnd()+'\n\n'+marker+'\n\n只读授权D:/godot/rpg源库，十二份不同原PNG逐字节复制；保留原帧区域、速度、循环、帧时长与visual.tres锚点。cast只映射attack。候选idle/attack/run实际接触表经人工查看，原飞剑悬阵/影术掌心旋球/粉刃青花绽放按职责配形态；不复用原四英雄或试炼Boss。\n\n| key | 职业 | 原PNG | SHA256 | 尺寸 |\n| --- | --- | --- | --- | --- |\n'+evidence.map(e=>`| ${e.key} | ${e.name} | ${e.sourcePng} | ${e.sha256} | ${e.width}×${e.height} |`).join('\n')+'\n\n复现tools/extract-mythic-hero-assets.mjs；元数据output/hero-ascension/assets/manifest.json，实际帧contact表selected.png与candidates-0/1/2.png。十二PNG共'+evidence.reduce((n,e)=>n+e.bytes,0)+'字节。飞剑与花刃从上述原图集缓存裁取，旋丸复用已入包Duelyst vortex/magicImpact/whiteSpark纹理；无新生图/改源图。\n');
console.log(evidence.map(e=>e.key+': '+e.bytes+' bytes').join('\n'));




