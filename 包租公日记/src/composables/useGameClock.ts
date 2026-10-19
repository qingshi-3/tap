import {computed,onMounted,onBeforeUnmount,ref,watch} from 'vue';

// Only foreground, unpaused time advances the monthly simulation; no offline catch-up.
export function useGameClock(options:{month:()=>number;processing:()=>boolean;advance:()=>boolean}) {
 const elapsed=ref(0);const manualPaused=ref(false);const hidden=ref(false);
 const processing=computed(options.processing);
 const paused=computed(()=>manualPaused.value||processing.value||hidden.value);
 const progress=computed(()=>elapsed.value/60);
 const days=computed(()=>new Date(2029+Math.floor(options.month()/12),options.month()%12+1,0).getDate());
 const day=computed(()=>Math.min(days.value,1+Math.floor(progress.value*days.value)));
 let interval:ReturnType<typeof setInterval>|undefined;let previous=0;
 function visibility(){hidden.value=document.hidden;previous=performance.now();}
 function toggle(){manualPaused.value=!manualPaused.value;previous=performance.now();}
 watch(options.month,()=>{elapsed.value=0;previous=performance.now();},{flush:'sync'});
 onMounted(()=>{
  visibility();document.addEventListener('visibilitychange',visibility);
  interval=setInterval(()=>{
   const now=performance.now();const delta=Math.min(.5,Math.max(0,(now-previous)/1000));previous=now;
   if(paused.value)return;
   elapsed.value+=delta;
   if(elapsed.value>=60){elapsed.value=0;if(!options.advance()){elapsed.value=59.9;manualPaused.value=true;}}
  },200);
 });
 onBeforeUnmount(()=>{if(interval)clearInterval(interval);document.removeEventListener('visibilitychange',visibility);});
 return {day,progress,paused,processing,manualPaused,toggle};
}
