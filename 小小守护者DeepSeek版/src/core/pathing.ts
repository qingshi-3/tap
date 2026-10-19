import type {GameState,Point} from './types';
import {BUILDING_DEFS} from './content.ts';
const cache=new WeakMap<GameState,{key:string;field:number[]}>();
export function flowField(s:GameState):number[]{
 const key=s.buildings.filter(b=>BUILDING_DEFS[b.kind].blocks).map(b=>`${b.id}:${Math.floor(b.x)},${Math.floor(b.y)}:${Math.ceil(b.hp/20)}`).join(',');const old=cache.get(s);if(old?.key===key)return old.field;
 const {width:w,height:h}=s.map,field=Array(w*h).fill(Infinity),done=new Uint8Array(w*h),cost=Array(w*h).fill(.5);
 for(const b of s.buildings)if(BUILDING_DEFS[b.kind].blocks)cost[Math.floor(b.y)*w+Math.floor(b.x)]+=b.hp/20;
 field[Math.floor(s.map.core.y)*w+Math.floor(s.map.core.x)]=0;
 for(let n=0;n<w*h;n++){let k=-1;for(let i=0;i<field.length;i++)if(!done[i]&&(k<0||field[i]<field[k]))k=i;if(k<0||!Number.isFinite(field[k]))break;done[k]=1;const x=k%w,y=Math.floor(k/w);for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){const nx=x+dx,ny=y+dy,i=ny*w+nx;if(nx<0||nx>=w||ny<0||ny>=h||s.map.cells[i])continue;field[i]=Math.min(field[i],field[k]+cost[k]);}}
 cache.set(s,{key,field});return field;
}
export function nextGroundPoint(s:GameState,p:Point):Point{const f=flowField(s),w=s.map.width,x=Math.floor(p.x),y=Math.floor(p.y);let best={x:x+.5,y:y+.5},score=Infinity;for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=s.map.height)continue;if(s.map.cells[ny*w+nx])continue;const building=s.buildings.find(b=>BUILDING_DEFS[b.kind].blocks&&Math.floor(b.x)===nx&&Math.floor(b.y)===ny);const v=f[ny*w+nx]+.5+(building?building.hp/20:0);if(v<score){score=v;best={x:nx+.5,y:ny+.5};}}return best;}

