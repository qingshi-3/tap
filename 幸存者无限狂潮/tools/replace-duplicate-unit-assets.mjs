import {copyFile,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),sourceRoot='D:/godot/rpg';
const {unitAssets}=await import(pathToFileURL(path.join(root,'dist/assets.js')));
const choices=[
 ['hero_sword_3','御剑真君','岚影诸派/f2_宗师Zendo',156,'hero profession'],
 ['guard_basic','重甲卫士','neutral/中立_铁Clad',130,'enemy'],
 ['summon_shield','召唤盾卫','莱昂纳王国/f1_维和者',130,'summon'],
 ['summon_spear','召唤矛卫','莱昂纳王国/f1_日铸枪兵',130,'summon'],
 ['summon_captain','召唤统领','莱昂纳王国/f1_异界Rightfulheir',145,'summon'],
 ['summon_giant','融合巨灵','neutral/中立_钻石魔像',240,'summon'],
 ['summon_priest','召唤祭司','莱昂纳王国/f1_异界Archdeacon',135,'summon'],
];
function parse(source){
 const regions=new Map([...source.matchAll(/\[sub_resource type="AtlasTexture" id="([^"]+)"\][\s\S]*?region\s*=\s*Rect2\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/g)].map(m=>[m[1],{x:+m[2],y:+m[3],w:+m[4],h:+m[5]}]));
 const animations={};
 for(const m of source.matchAll(/"frames"\s*:\s*\[([\s\S]*?)\]\s*,\s*"loop"\s*:\s*(true|false)\s*,\s*"name"\s*:\s*&"([^"]+)"\s*,\s*"speed"\s*:\s*([\d.-]+)/g))animations[m[3]]={fps:+m[4],loop:m[2]==='true',frames:[...m[1].matchAll(/"duration"\s*:\s*([\d.-]+)\s*,\s*"texture"\s*:\s*SubResource\("([^"]+)"\)/g)].map(f=>({...regions.get(f[2]),duration:+f[1]}))};
 return animations;
}
const pending=[];
// Validate the entire batch before changing client assets. Replays may match only their own key.
for(const [key,name,dir,size,role] of choices){
 const folder=path.join(sourceRoot,'assets/battle/units',dir),sourcePng=path.join(folder,(await readdir(folder)).find(n=>n.endsWith('.png'))),png=await readFile(sourcePng),sha256=createHash('sha256').update(png).digest('hex').toUpperCase();
 for(const [other,v] of Object.entries(unitAssets))if(other!==key&&(v.sourceSha256===sha256||v.sourceIdentity===dir))throw Error(`Duplicate source: ${key} / ${other}`);
 if(pending.some(v=>v.sha256===sha256||v.dir===dir))throw Error('Duplicate batch source '+key);
 const animations=parse(await readFile(path.join(folder,'frames.tres'),'utf8')),width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 for(const action of ['idle','run','attack','hit'])if(!animations[action]?.frames.length)throw Error('Missing '+action+' '+dir);
 for(const action of Object.values(animations))for(const f of action.frames)if(!Number.isFinite(f.x)||f.x<0||f.y<0||f.x+f.w>width||f.y+f.h>height)throw Error('Frame bounds '+dir);
 const sourceVisual=path.join(sourceRoot,'resource/battle/units',dir,'visual.tres'),visual=await readFile(sourceVisual,'utf8'),offset=visual.match(/Offset\s*=\s*Vector2\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/),scale=visual.match(/Scale\s*=\s*Vector2\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/),frame=animations.idle.frames[0];
 if(!offset||!scale)throw Error('Anchor '+dir);
 const anchor={x:+(.5-+offset[1]/(frame.w*+scale[1])).toFixed(4),y:+(.5-+offset[2]/(frame.h*+scale[2])).toFixed(4)};
 pending.push({key,name,dir,role,sha256,sourcePng,sourceFrames:path.join(folder,'frames.tres'),sourceVisual,width,height,bytes:png.length,anchor,renderSize:unitAssets[key]?.renderSize??size,animations});
}
const out=path.join(root,'output/unit-dedup');await mkdir(out,{recursive:true});
for(const e of pending){
 const dest=path.join(root,'dist/assets/units',e.key+'.png');
 if(unitAssets[e.key]&&unitAssets[e.key].sourceSha256!==e.sha256)await copyFile(dest,path.join(out,e.key+'-before.png'));
 await copyFile(e.sourcePng,dest);
 unitAssets[e.key]={src:`./assets/units/${e.key}.png`,readableName:e.name,role:e.role,sourceIdentity:e.dir,sourceSha256:e.sha256,renderSize:e.renderSize,authoredSize:true,animationAliases:{move:['run','move'],cast:['attack'],death:['death','die','defeated']},anchor:e.anchor,animations:e.animations};
}
await writeFile(path.join(root,'dist/assets.js'),'// Original authored unit atlases; reviewed additions: extract-mythic-hero-assets.mjs, replace-duplicate-unit-assets.mjs.\nexport const unitAssets = '+JSON.stringify(unitAssets,null,2)+';\n');
const evidence=pending.map(({animations,...e})=>({...e,actions:Object.fromEntries(Object.entries(animations).map(([a,v])=>[a,{frames:v.frames.length,fps:v.fps,loop:v.loop}]))}));
await writeFile(path.join(out,'manifest.json'),JSON.stringify(evidence,null,2)+'\n');
const docs=path.join(root,'dist/assets/SOURCES.md'),marker='## 英雄、敌人与召唤物独立素材（2026-10-13）';let text=await readFile(docs,'utf8');if(text.includes(marker))text=text.slice(0,text.indexOf(marker));
await writeFile(docs,text.trimEnd()+'\n\n'+marker+'\n\n授权源库 D:/godot/rpg 只读；七套原 PNG 逐字节复制，保留 frames.tres 全部帧区域、时长、速度与循环及 visual.tres 锚点。全 unitAssets sourceIdentity/SHA256 排重，英雄、召唤物不与敌人或 Boss 复用；替换前 PNG 留在 output/unit-dedup。\n\n| key | 职能 | 原始素材 | SHA256 |\n| --- | --- | --- | --- |\n'+pending.map(e=>`| ${e.key} | ${e.name} | ${e.sourcePng} | ${e.sha256} |`).join('\n')+'\n\n复现 tools/replace-duplicate-unit-assets.mjs；候选接触表 output/unit-dedup/candidates.png，元数据 output/unit-dedup/manifest.json。\n');
console.log(JSON.stringify({units:pending.length,bytes:pending.reduce((n,e)=>n+e.bytes,0),keys:pending.map(e=>e.key)}));

