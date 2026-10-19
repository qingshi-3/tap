<script setup lang="ts">
import {useId} from 'vue';
const props=defineProps<{modelValue:number,baseline:number,label:string,disabled?:boolean}>();
const emit=defineEmits<{'update:modelValue':[value:number]}>();
const labelId=useId();
const changes=[-10,-100,-1000,10,100,1000];
function valid(value:number){return Number.isInteger(value)&&value>=1&&value<=100000;}
function adjust(change:number){const value=props.modelValue+change;if(!props.disabled&&valid(value))emit('update:modelValue',value);}
const money=(n:number)=>'¥'+Math.round(n).toLocaleString('zh-CN');
</script>
<template><div class="price-stepper" role="group" :aria-labelledby="labelId"><div class="price-heading"><span :id="labelId">{{label}}</span><output class="price-value" aria-live="polite">{{money(modelValue)}} / 月</output></div><p class="price-baseline">基准价 {{money(baseline)}} / 月</p><div class="price-step-buttons"><button v-for="change in changes" :key="change" type="button" :disabled="disabled||!valid(modelValue+change)" @click="adjust(change)">{{change>0?'+':''}}{{change}}</button></div><button type="button" class="quiet price-reset" :disabled="disabled||modelValue===baseline||!valid(baseline)" @click="emit('update:modelValue',baseline)">恢复基准价</button></div></template>
