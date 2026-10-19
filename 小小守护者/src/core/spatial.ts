import type {Point,Unit} from './types';
/** A transient index. State is authoritative and buckets are rebuilt each fixed tick. */
export class SpatialIndex {
 private buckets=new Map<string,Unit[]>();
 private size:number;
 constructor(units:Unit[],size=2){this.size=size;for(const u of units)if(u.hp>0){const key=this.key(u.x,u.y);const bucket=this.buckets.get(key)??[];bucket.push(u);this.buckets.set(key,bucket);}}
 private key(x:number,y:number){return `${Math.floor(x/this.size)},${Math.floor(y/this.size)}`;}
 query(p:Point,radius:number):Unit[]{const result:Unit[]=[];for(let y=Math.floor((p.y-radius)/this.size);y<=Math.floor((p.y+radius)/this.size);y++)for(let x=Math.floor((p.x-radius)/this.size);x<=Math.floor((p.x+radius)/this.size);x++)for(const u of this.buckets.get(`${x},${y}`)??[])if(u.hp>0&&Math.hypot(u.x-p.x,u.y-p.y)<=radius)result.push(u);return result.sort((a,b)=>a.id-b.id);}
}
