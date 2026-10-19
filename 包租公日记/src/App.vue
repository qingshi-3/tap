<script setup lang="ts">
import {computed,ref,watch,toRaw,nextTick} from 'vue';
import {content,quoteMortgage,selectApplicants,selectDistricts} from './game';
import {useGameStore} from './store/game';
import {useGameClock} from './composables/useGameClock';
import CityMap from './components/CityMap.vue';
import NeighborhoodMap from './components/NeighborhoodMap.vue';
import DistrictInfo from './components/DistrictInfo.vue';
import RoomInterior from './components/RoomInterior.vue';
import RoomScene from './components/RoomScene.vue';
import GameDialog from './components/GameDialog.vue';
import NpcAvatar from './components/NpcAvatar.vue';
import ApplicantCard from './components/ApplicantCard.vue';
import PriceStepper from './components/PriceStepper.vue';
import {USE_ILLUSTRATED_ART} from './presentation';
const game=useGameStore();const tab=ref<'city'|'neighborhood'|'building'|'ledger'>('city');const previousScene=ref<'city'|'neighborhood'|'building'>('city');const selected=ref<string|null>(null);const mode=ref<'main'|'renovate'|'rent'|'sell'|'inquiry'>('main');const settled=ref(false);const regionId=ref('xingfu');
const visibleScene=computed(()=>tab.value==='ledger'?previousScene.value:tab.value);const buildingIds=ref<string[]>([]);const buildingName=ref('');const districtInfoOpen=ref(false);const neighborhoodBusy=ref(false);const cityCamera=ref<{x:number,y:number}|null>(null);
const regionName=computed(()=>content.regions.find(r=>r.id===regionId.value)?.name??'幸福里');const sceneTitle=computed(()=>visibleScene.value==='city'?'包租公日记':visibleScene.value==='neighborhood'?regionName.value:buildingName.value);
const buildingRooms=computed(()=>rooms.value.filter(p=>buildingIds.value.includes(p.id)));const buildingVisitors=computed(()=>visitors.value.filter(a=>buildingIds.value.includes(a.propertyId)));
type Inquiry=ReturnType<typeof selectApplicants>[number];
const inquiry=ref<Inquiry|null>(null);const inquiryResult=ref('');
const inquiries=computed(()=>game.properties.flatMap(p=>selectApplicants(toRaw(game.state),p.id)).filter(a=>a.kind==='renewal'||a.expiresMonth>game.state.month));
const activeInquiry=computed(()=>inquiries.value.find(a=>a.id===inquiry.value?.id));
const inquiryChannel=(a:Inquiry)=>a.kind==='renewal'?'续租':a.source==='agency'?'中介推荐':'上门看房';
const districts=computed(()=>selectDistricts(toRaw(game.state)));const askingInput=ref<number>(0);
const money=(n:number)=>'¥'+Math.round(n).toLocaleString('zh-CN');const date=(m:number)=>`${2029+Math.floor(m/12)}年${m%12+1}月`;
const rooms=computed(()=>game.properties.filter(p=>p.regionId===regionId.value));const property=computed(()=>game.properties.find(p=>p.id===selected.value));const residents=computed(()=>property.value?.leases.map(l=>({...l,...game.tenants.find(t=>t.id===l.tenantId)}))??[]);const event=computed(()=>game.state.pendingEvents[0]);const last=computed(()=>game.state.history.at(-1));
const accessibleRegions=computed(()=>content.regions.filter(r=>r.id==='xingfu'||game.properties.some(p=>p.owned&&p.regionId===r.id)));
const visitors=computed(()=>rooms.value.flatMap(p=>selectApplicants(toRaw(game.state),p.id)).filter(a=>a.source==='walkin'&&a.kind!=='renewal'));
const applicants=computed(()=>property.value?selectApplicants(toRaw(game.state),property.value.id):[]);
const renewals=computed(()=>applicants.value.filter(a=>a.kind==='renewal'));
watch(()=>property.value?.id,()=>{askingInput.value=property.value?.askingRent??property.value?.marketRent??0;});
const tutorial=computed(()=>{if(inquiries.value.length)return '';if(game.properties.some(p=>p.owned&&p.occupancy))return '';const p=game.properties.find(p=>p.owned&&p.regionId===regionId.value);if(!p)return '选择一间待售房屋，查看购房方案。';if(game.state.month>2)return '';if(p.renovatingMonths)return '装修正在进行，点击月结推进一个月。';if(p.condition<40)return '点开你的房间，先装修或维修。';return '房间可以入住了，点开房间招租。';});
const financing=computed(()=>{const p=property.value;if(!p)return null;const quote=quoteMortgage(p.value,p.mortgage);return {down:quote.downPayment,payment:quote.payment};});
const eventOpen=ref(!!event.value);const eventResult=ref('');const cityBusy=ref(false);
const clock=useGameClock({month:()=>game.state.month,processing:()=>!!selected.value||!!event.value||eventOpen.value||settled.value||game.blocked||tab.value==='ledger'||cityBusy.value||neighborhoodBusy.value||districtInfoOpen.value,advance:()=>{const before=game.state.month;advance();return game.state.month!==before;}});
const portrait=(id?:string)=>{const found=content.tenants.findIndex(t=>t.id===id);const i=found<0?5:found;return {backgroundPosition:`${i%2?'100%':'0%'} ${Math.floor(i/2)*50}%`};};
watch(()=>game.state.pendingEvents.length,(n,o)=>{if(n>o){eventOpen.value=true;selected.value=null;settled.value=false;}});
watch(()=>game.blocked,(now,before)=>{if(before&&!now){mode.value='main';if(event.value)eventOpen.value=true;}});
watch(()=>game.state.month,(now,before)=>{if(now!==before){selected.value=null;eventOpen.value=!!event.value;settled.value=!event.value;}});
function choose(id:string){eventOpen.value=false;settled.value=false;selected.value=id;mode.value='main';askingInput.value=game.properties.find(p=>p.id===id)?.askingRent??game.properties.find(p=>p.id===id)?.marketRent??0;}
function switchTab(value:typeof tab.value){if(value==='ledger'&&tab.value!=='ledger')previousScene.value=tab.value;districtInfoOpen.value=false;tab.value=value;selected.value=null;mode.value='main';settled.value=false;eventOpen.value=false;}
function advance(){selected.value=null;if(event.value){eventOpen.value=true;return;}if(game.act({type:'advance'})){eventOpen.value=!!event.value;settled.value=!event.value;eventResult.value='';}}
function act(action:Parameters<typeof game.act>[0]){if(game.act(action)){mode.value='main';if(action.type==='buy'){regionId.value=game.properties.find(p=>p.id===action.propertyId)?.regionId??'xingfu';choose(action.propertyId);}if(action.type==='sell'){selected.value=null;}}}
function receive(a:Inquiry){choose(a.propertyId);inquiry.value={...a};inquiryResult.value='';mode.value='inquiry';}
function enterDistrict(id:string){if(!content.regions.some(r=>r.id===id))return;regionId.value=id;buildingIds.value=[];buildingName.value='';switchTab('neighborhood');}
function enterBuilding(b:{id:string,name:string,ids:string[]}){buildingIds.value=b.ids;buildingName.value=b.name;switchTab('building');}
function chooseFromDistrict(id:string){districtInfoOpen.value=false;nextTick(()=>choose(id));}
function respond(a:Inquiry,type:'rent'|'reject'|'counter',rent?:number){
 const action=type==='counter'?{type,propertyId:a.propertyId,applicantId:a.id,rent:Number(rent)}:{type,propertyId:a.propertyId,applicantId:a.id};
 game.act(action);if(mode.value==='inquiry')inquiryResult.value=game.message;
}
function resolve(choiceId:string){if(!event.value)return;const label=event.value.choices.find(c=>c.id===choiceId)?.label??'';if(game.act({type:'resolve',eventId:event.value.id,choiceId})){eventResult.value=`${label}，已处理。`;}}</script>
<template>
<main class="game-shell" :class="{illustrated:USE_ILLUSTRATED_ART}">
 <header class="hud"><div><h1>{{sceneTitle}}</h1><span class="clock-date" :data-day="clock.day.value">{{date(game.state.month)}} · {{clock.day.value}}日{{clock.paused.value?' · 暂停':''}}</span><span class="calendar-track" aria-hidden="true"><i :style="{width:clock.progress.value*100+'%'}"></i></span></div><div class="cash"><small>现金</small><strong>{{money(game.summary.cash)}}</strong></div></header>
 <div v-if="game.error" class="storage-error" role="alert"><strong>{{game.blocked?'存档暂时无法使用':'进度未保存'}}</strong><p>{{game.error}}</p><button v-if="game.retryable" @click="game.retrySave">重试保存</button><p v-else>原存档已保留。{{game.error.includes('另一')||game.error.includes('变化')||game.error.includes('更新')?'请刷新，载入另一个页面保存的新进度。':'请保留原存档；恢复浏览器存储权限或修复存档后重新打开。'}}</p></div>
 
 <div class="view-tabs" aria-label="游戏页面"><button :class="{active:visibleScene==='city'}" @click="switchTab('city')">城市</button><button :class="{active:tab==='ledger'}" @click="switchTab('ledger')">记账</button></div>
 <template v-if="true">
 <div class="playfield" :class="{'has-inquiries':inquiries.length}"><nav v-if="inquiries.length" class="inquiry-rail" aria-label="找租通知"><button v-for="a in inquiries" :key="a.id" class="inquiry-notice" :aria-label="`${a.name}，${game.properties.find(p=>p.id===a.propertyId)?.name}，${inquiryChannel(a)}，点击接待`" :disabled="game.blocked" @click="receive(a)"><NpcAvatar :tenant-id="a.tenantId"/><span>{{a.name}}</span><small>{{a.kind==='renewal'?'续租':'找租'}}</small></button></nav><CityMap v-if="visibleScene==='city'" :properties="game.properties" :districts="districts" :camera="cityCamera" @camera="cityCamera=$event" @enter="enterDistrict" @select="choose" @busy="cityBusy=$event"/><div v-else class="neighborhood-view"><nav class="neighborhood-nav"><button class="quiet" @click="switchTab(visibleScene==='building'?'neighborhood':'city')">{{visibleScene==='building'?'返回小区':'返回城市'}}</button><button @click="districtInfoOpen=true">小区信息</button></nav><NeighborhoodMap v-if="visibleScene==='neighborhood'" :rooms="rooms" :region-name="regionName" @enter="enterBuilding" @busy="neighborhoodBusy=$event"/><RoomScene v-else :rooms="buildingRooms" :building-name="buildingName" :selected="selected" :visitors="buildingVisitors" @select="choose" @visit="id=>{choose(id);mode='rent'}" /></div></div>
 <DistrictInfo v-if="districtInfoOpen" :district="districts.find(d=>d.id===regionId)" :properties="game.properties" @close="districtInfoOpen=false" @select="chooseFromDistrict"/>
 
 <p v-if="visibleScene==='building'&&!rooms.length" class="empty">你还没有房屋，去城市挑一套。</p>
 <p v-if="tutorial&&visibleScene==='building'&&!selected" class="tutorial">{{tutorial}}</p>
 <GameDialog v-if="property&&mode==='inquiry'&&inquiry&&!game.error" :title="inquiry.name+' · '+(inquiry.kind==='renewal'?'续租':'找租')" @close="selected=null;mode='main'"><p class="inquiry-location">{{property.name}} · {{inquiryChannel(inquiry)}}</p><ApplicantCard v-if="activeInquiry" :a="activeInquiry" :blocked="game.blocked" :vacancies="property.vacancies" :baseline="property.marketRent" @respond="(type,rent)=>respond(activeInquiry!,type,rent)"/><div v-else class="inquiry-complete"><NpcAvatar :tenant-id="inquiry.tenantId"/><p v-if="!inquiryResult">这位访客已离开。</p></div><p v-if="inquiryResult" class="dialog-feedback" role="status">{{inquiryResult}}</p><div v-if="!activeInquiry" class="actions"><button v-if="inquiries.length" :disabled="game.blocked" @click="receive(inquiries[0]!)">接待下一位</button><button class="quiet" @click="selected=null;mode='main'">回到街区</button></div></GameDialog>
 <GameDialog v-if="property&&mode!=='inquiry'&&!game.error" :title="property.name" drawer @close="selected=null"><RoomInterior v-if="mode!=='rent'" :tenant-ids="property.tenantIds" :renovating="!!property.renovatingMonths"/>
 <div class="sheet-heading"><div><p>{{property.owned?`房况 ${property.condition}%` : content.regions.find(r=>r.id===property?.regionId)?.name}} · {{money(property.value)}}</p></div></div>
 <template v-if="!property.owned"><p class="purchase-note">每租位市场参考 {{money(property.marketRent)}} / 月</p><div class="choices"><button :disabled="game.blocked||game.summary.cash<property.value" @click="act({type:'buy',propertyId:property.id,financing:'cash'})"><b>全款购买</b><span>{{money(property.value)}}</span></button><button :disabled="game.blocked||game.summary.cash<(financing?.down??0)" @click="act({type:'buy',propertyId:property.id,financing:'mortgage'})"><b>贷款购买</b><span>首付 {{money(financing?.down??0)}}</span><small>{{property.mortgage.months}}期 · 年利率{{property.mortgage.annualRate*100}}%<br>每月约 {{money(financing?.payment??0)}}</small></button></div></template>
 <template v-else-if="mode==='renovate'"><div class="sheet-heading"><h3>选择装修</h3><button class="quiet" @click="mode='main'">返回</button></div><button v-for="r in content.renovations" :key="r.id" class="choice-row" :disabled="game.blocked||game.summary.cash<r.cost||property.renovationId===r.id" @click="act({type:'renovate',propertyId:property.id,renovationId:r.id})"><span><b>{{r.name}}</b><small>{{r.months}}个月 · 租金倍率 {{r.rentMultiplier}}</small></span><strong>{{money(r.cost)}}</strong></button></template>
 <template v-else-if="mode==='rent'"><div class="sheet-heading"><h3>招租 · 空位 {{property.vacancies}} / {{property.capacity}}</h3><button class="quiet" @click="mode='main'">返回</button></div>
 <form v-if="property.vacancies" class="listing-form" @submit.prevent="game.act({type:'listing',propertyId:property.id,askingRent:Number(askingInput)})">
 <PriceStepper v-model="askingInput" :baseline="property.marketRent" :label="property.askingRent===null?'挂牌月租':'修改挂牌月租'" :disabled="game.blocked||property.condition<40||!!property.renovatingMonths"/><button type="submit" class="listing-submit" :disabled="game.blocked||property.condition<40||!!property.renovatingMonths">{{property.askingRent===null?'挂牌招租':'确认改价'}}</button>
 <button v-if="property.askingRent!==null" type="button" class="quiet" :disabled="game.blocked" @click="game.act({type:'unlist',propertyId:property.id})">撤下招租牌</button></form>
 <p v-if="property.askingRent===null&&property.vacancies">尚未挂牌，设定月租后才会有新客来看房。</p><p v-else-if="property.vacancies">挂牌 {{money(property.askingRent??0)}} / 月 · 空位 {{property.vacancies}}</p>
 <p>签约后月租固定6个月；改价只影响新租约。</p>
 <template v-for="source in (renewals.length?['renewal','walkin','agency']:['walkin','agency'])" :key="source">
 <h3>{{source==='renewal'?'到期续租':source==='walkin'?'上门看房':'中介推荐'}}</h3>
 <template v-if="source==='agency'"><button class="wide" :disabled="game.blocked||!property.vacancies||property.askingRent===null||property.condition<40||!!property.renovatingMonths||game.summary.cash<content.recruitment.agencyFee" @click="game.act({type:'agency',propertyId:property.id})">请中介找人 · {{money(content.recruitment.agencyFee)}}</button></template>
 <p v-if="!(source==='renewal'?renewals:applicants.filter(a=>a.source===source&&a.kind!=='renewal')).length">{{source==='renewal'?'暂无到期租约。':source==='walkin'?'本月暂无看房客。':'暂无中介候选。'}}</p>
 <ApplicantCard v-for="a in (source==='renewal'?renewals:applicants.filter(a=>a.source===source&&a.kind!=='renewal'))" :key="a.id" :a="a" :blocked="game.blocked" :vacancies="property.vacancies" :baseline="property.marketRent" @respond="(type,rent)=>respond(a,type,rent)"/></template></template>
 <template v-else-if="mode==='sell'"><p>出售后租客将搬离，贷款自动结清。预计到账 {{money(property.value-property.debt)}}。</p><div class="actions"><button class="danger" :disabled="game.blocked" @click="act({type:'sell',propertyId:property.id});selected=null">确认出售</button><button class="quiet" @click="mode='main'">保留房屋</button></div></template>
 <template v-else><p v-if="property.renovatingMonths" class="work-status">装修中，还需 {{property.renovatingMonths}} 个月。</p><p>入住 {{property.occupancy}} / {{property.capacity}} 户 · 合计月租 {{money(property.rent)}}</p>
 <div class="household-slots"><article v-for="slot in property.capacity" :key="slot" class="household-slot"><template v-if="residents[slot-1]"><NpcAvatar :tenant-id="residents[slot-1]!.tenantId"/><div><strong>{{residents[slot-1]!.name}}</strong><p>合同月租 {{money(residents[slot-1]!.monthlyRent)}}</p><p>{{date(residents[slot-1]!.expiresMonth)}}到期</p><p>关系 {{residents[slot-1]!.relationship}} / 100</p></div></template><template v-else><div class="vacant-bed" aria-hidden="true"></div><div><strong>空租位 {{slot}}</strong><button :disabled="game.blocked||property.condition<40||!!property.renovatingMonths" @click="mode='rent'">招租</button></div></template></article></div>
 <p v-if="property.condition<40">先装修或维修，再招租。</p><p v-if="property.debt" class="loan">剩余贷款 {{money(property.debt)}} · 每月 {{money(property.payment)}}</p><div class="actions"><button v-if="!property.occupancy&&!property.renovatingMonths" :disabled="game.blocked" @click="mode='renovate'">装修</button><button :disabled="game.blocked||(!renewals.length&&(!property.vacancies||property.condition<40||!!property.renovatingMonths))" @click="mode='rent'">{{renewals.length?'处理续租':property.vacancies?'招租':'三户已满'}}</button><button :disabled="game.blocked||property.condition===100||game.summary.cash<Math.ceil((100-property.condition)*5)" @click="act({type:'repair',propertyId:property.id})">维修 {{money(Math.ceil((100-property.condition)*5))}}</button><button class="quiet" :disabled="game.blocked" @click="mode='sell'">出售</button></div></template>
 <p v-if="game.message" class="dialog-feedback" role="status">{{game.message}}</p></GameDialog>
 </template>
 <GameDialog v-if="tab==='ledger'&&!selected&&!eventOpen&&!settled&&!game.error" title="房产账本" @close="switchTab(previousScene)"><dl class="balance"><div><dt>房产价值</dt><dd>{{money(game.summary.assets)}}</dd></div><div><dt>剩余贷款</dt><dd>{{money(game.summary.debt)}}</dd></div><div><dt>净资产</dt><dd>{{money(game.summary.netWorth)}}</dd></div></dl><h3>街坊消息</h3><p v-for="(news,i) in game.state.news" :key="i" class="news">{{news}}</p><h3>月结记录</h3><p v-if="!game.state.history.length">推进一个月后，收支会记在这里。</p><article v-for="h in [...game.state.history].reverse()" :key="h.month" class="history"><div class="sheet-heading"><b>{{date(h.month)}}</b><strong :class="{negative:h.net<0}">{{money(h.net)}}</strong></div><p>租金 {{money(h.income)}} · 维护 {{money(h.maintenance)}} · 月供 {{money(h.loanPayment)}}</p><p v-for="(item,i) in h.items" :key="i">{{item}}</p></article></GameDialog>
 <GameDialog v-if="eventOpen&&!game.error" :title="event?.title??'消息已处理'" @close="eventOpen=false"><template v-if="event"><div class="event-story"><div class="event-portrait" :class="{illustrated:USE_ILLUSTRATED_ART}" :style="portrait(event.tenantId)" role="img" :aria-label="game.tenants.find(t=>t.id===event?.tenantId)?.name??'老房东'"><NpcAvatar v-if="!USE_ILLUSTRATED_ART" :tenant-id="event.tenantId"/></div><p class="speaker">{{game.tenants.find(t=>t.id===event?.tenantId)?.name??'老房东'}}</p><p>{{event.text}}</p></div><button v-for="choice in event.choices" :key="choice.id" class="choice-row" :disabled="game.blocked||game.summary.cash<(choice.cost??0)" @click="resolve(choice.id)"><span><b>{{choice.label}}{{choice.cost?' '+money(choice.cost):''}}</b><small>{{choice.description}}</small></span></button></template><p v-if="eventResult" class="dialog-feedback" role="status">{{eventResult}}</p><button v-if="!event" class="wide" @click="eventOpen=false;settled=!!last">{{last?'查看月结':'回到街区'}}</button></GameDialog>
 <GameDialog v-if="settled&&last&&!eventOpen&&!game.error" :title="date(last.month)+'结算'" @close="settled=false"><dl class="balance"><div><dt>租金</dt><dd>{{money(last.income)}}</dd></div><div><dt>维护与月供</dt><dd>{{money(last.maintenance+last.loanPayment)}}</dd></div><div><dt>本月结余</dt><dd :class="{negative:last.net<0}">{{money(last.net)}}</dd></div></dl><p v-for="(item,i) in last.items" :key="i">{{item}}</p><button class="wide" @click="settled=false">回到街区</button></GameDialog> <p v-if="game.messageError&&game.message&&!selected&&!eventOpen&&!settled" class="feedback" role="status">{{game.message}}</p>
 <footer class="month-bar"><div><small>预计每月结余</small><strong :class="{negative:game.summary.netIncome<0}">{{money(game.summary.netIncome)}}</strong></div><button class="clock-toggle" :aria-label="clock.manualPaused.value?'继续时间':'暂停时间'" :disabled="clock.processing.value" @click="clock.toggle">{{clock.manualPaused.value?'继续':'暂停'}}</button><button class="advance"  :disabled="game.blocked" @click="advance">{{event?'查看消息':'月结 · 下个月'}}</button></footer>
</main>
</template>












