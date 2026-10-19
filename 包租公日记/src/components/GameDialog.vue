<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue';
defineProps<{title:string,drawer?:boolean}>();
const emit=defineEmits<{close:[]}>();
const host=ref<HTMLDialogElement>();
function trapFocus(event: KeyboardEvent) {
  if(event.key!=='Tab')return;
  const items=Array.from(host.value?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')??[]).filter(item=>item.getClientRects().length);
  const first=items[0];const last=items.at(-1);
  if(!first){event.preventDefault();host.value?.focus();return;}
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!host.value?.contains(document.activeElement))){event.preventDefault();first.focus();}
}
// Native modal dialogs keep the street behind them inert and restore focus on close.
onMounted(()=>host.value?.showModal());
onBeforeUnmount(()=>host.value?.close());
</script>
<template><Teleport to="body"><dialog ref="host" class="dialog-backdrop" :aria-label="title" @keydown="trapFocus" @cancel.prevent="emit('close')" @click.self="emit('close')"><section class="game-dialog" :class="{drawer}"><header class="dialog-heading"><h2>{{title}}</h2><button class="close" @click="emit('close')" aria-label="关闭" autofocus>关闭</button></header><div class="dialog-content"><slot /></div></section></dialog></Teleport></template>

<style scoped>
dialog.dialog-backdrop{width:100%;max-width:none;height:100%;max-height:none;margin:0;border:0;color:inherit}
dialog.dialog-backdrop::backdrop{background:transparent}
dialog.dialog-backdrop:not([open]){display:none}
</style>
