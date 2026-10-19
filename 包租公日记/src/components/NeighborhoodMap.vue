<script setup lang="ts">
import {computed,onBeforeUnmount} from 'vue';

const props=defineProps<{rooms:any[],visitors?:any[],regionName:string}>();
const emit=defineEmits<{enter:[building:{id:string,name:string,ids:string[]}],busy:[value:boolean]}>();
const definitions=[{id:'xingfu-a',name:'幸福里A栋',ids:['xingfu-402','xingfu-403'],x:145,y:175},{id:'xingfu-b',name:'幸福里B栋',ids:['xingfu-301'],x:350,y:425},{id:'university-apartment',name:'学苑公寓',ids:['university-101'],x:165,y:230},{id:'tech-apartment',name:'创业公寓',ids:['tech-302'],x:165,y:230}];
const blocks=computed(()=>definitions.map(b=>({...b,rooms:props.rooms.filter(p=>b.ids.includes(p.id))})).filter(b=>b.rooms.length));
const region=computed(()=>props.rooms[0]?.regionId??'xingfu');




onBeforeUnmount(()=>emit('busy',false));
const money=(n:number)=>'¥'+Math.round(n).toLocaleString('zh-CN');
const tier=(id:string)=>({basic:'基础',comfort:'舒适',premium:'精品'}[id]??'基础');
const blockTier=(rooms:any[])=>new Set(rooms.map(p=>p.tier)).size>1?'混合档':tier(rooms[0]?.tier);
function range(rooms:any[]){const values=rooms.map(p=>p.marketRent),min=Math.min(...values),max=Math.max(...values);return min===max?money(min):`${money(min)}–${max.toLocaleString('zh-CN')}`;}
const countOwned=(rooms:any[])=>rooms.filter(p=>p.owned).length;
const vacancies=(rooms:any[])=>rooms.filter(p=>p.owned).reduce((n,p)=>n+p.vacancies,0);
const status=(p:any)=>!p.owned?'待售':p.renovatingMonths?'施工中':p.condition<40?'待维修':p.renewalCount?'待续租':!p.vacancies?'满住':p.askingRent===null?'未挂牌':p.applicantCount?'谈价中':'待租';

</script>
<template><section class="neighborhood-map" :aria-label="regionName+'小区地图'"><div class="neighborhood-world" :class="'neighborhood-'+region"><svg viewBox="0 0 500 600" aria-hidden="true"><rect width="500" height="600" :fill="region==='xingfu'?'#b9be9b':region==='university'?'#a8c29c':'#a4bcb0'"/><path d="M0 315H500M260 0V600" stroke="#d8d0b9" stroke-width="52"/><path d="M0 315H500M260 0V600" stroke="#a6a297" stroke-width="32"/><g v-if="region==='xingfu'" fill="#d1ba8e"><rect x="315" y="65" width="130" height="100" rx="4"/><rect x="40" y="405" width="140" height="100" rx="4"/><path d="M305 65l75-36 75 36zm-275 340 80-36 80 36" fill="#957554"/><g fill="#809b6c"><circle cx="410" cy="245" r="30"/><circle cx="165" cy="555" r="30"/><circle cx="45" cy="560" r="26"/></g></g><g v-else-if="region==='university'"><rect x="320" y="65" width="140" height="160" rx="8" fill="#c9cba2"/><rect x="340" y="90" width="100" height="22" fill="#8fa7a0"/><rect x="340" y="133" width="100" height="22" fill="#8fa7a0"/><rect x="45" y="415" width="170" height="125" rx="10" fill="#78a375"/><ellipse cx="130" cy="476" rx="68" ry="48" fill="#b7b285"/><ellipse cx="130" cy="476" rx="46" ry="29" fill="#78a375"/><g fill="#668d67"><circle cx="400" cy="410" r="30"/><circle cx="370" cy="480" r="27"/></g></g><g v-else><rect x="330" y="70" width="105" height="165" rx="7" fill="#7d9eaa"/><rect x="350" y="93" width="65" height="125" fill="#b2d0d0"/><rect x="40" y="410" width="150" height="115" rx="6" fill="#9bacb7"/><rect x="58" y="430" width="112" height="22" fill="#d7e0d4"/><rect x="340" y="405" width="110" height="130" rx="30" fill="#799c79"/></g></svg><button v-for="b in blocks" :key="b.id" class="neighborhood-building" :class="{owned:countOwned(b.rooms)>0}" :style="{left:b.x+'px',top:b.y+'px'}" :aria-label="b.name+'，进入楼栋'" @click="emit('enter',{id:b.id,name:b.name,ids:b.rooms.map(p=>p.id)})"><b>{{b.name}}</b><span class="neighborhood-windows" aria-hidden="true"><i/><i/><i/><i/></span><span v-if="countOwned(b.rooms)" class="building-ownership">我的{{countOwned(b.rooms)}}套 · 空租位{{vacancies(b.rooms)}}</span><span v-if="b.rooms.some(p=>!p.owned)">待售{{b.rooms.filter(p=>!p.owned).length}}套</span><span class="building-market">{{blockTier(b.rooms)}} · {{range(b.rooms)}}/月/位</span></button></div></section></template>
