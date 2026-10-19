<script setup lang="ts">
import {ref,watch} from 'vue';
import {selectApplicants} from '../game';
import NpcAvatar from './NpcAvatar.vue';
import PriceStepper from './PriceStepper.vue';
const props=defineProps<{a:ReturnType<typeof selectApplicants>[number],blocked:boolean,vacancies:number,baseline:number}>();
const emit=defineEmits<{respond:[type:'rent'|'reject'|'counter',rent?:number]}>();
const counterInput=ref(props.baseline);
watch(()=>props.a.id,()=>counterInput.value=props.baseline);
const money=(n:number)=>'¥'+Math.round(n).toLocaleString('zh-CN');
</script>
<template><article class="applicant"><NpcAvatar :tenant-id="a.tenantId"/><div><strong>{{a.name}} · {{a.kind==='renewal'?'续租':a.kind==='bargain'?'砍价':'原价看房'}}</strong><p>{{a.job}}</p><p class="offer-price">报价 {{money(a.offeredRent)}} / 月</p><p>{{a.offerText}}</p><p v-if="a.kind==='renewal'">待续租期间沿用旧合同月租</p><div class="actions"><button :disabled="blocked||(a.kind!=='renewal'&&!vacancies)" @click="emit('respond','rent')">{{a.kind==='renewal'?'接受续租':'接受入住'}}</button><button class="quiet" :disabled="blocked" @click="emit('respond','reject')">{{a.kind==='renewal'?'不续租':'谢绝'}}</button></div>
 <form class="counter-form" @submit.prevent="emit('respond','counter',counterInput)"><PriceStepper v-model="counterInput" :baseline="baseline" label="还价月租" :disabled="blocked||(a.kind!=='renewal'&&!vacancies)"/><button type="submit" class="counter-submit" :disabled="blocked||(a.kind!=='renewal'&&!vacancies)">还价签约</button></form></div></article></template>
