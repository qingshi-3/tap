/** Tap/browser boundaries. No capability is inferred from a different bridge method. */
export interface SafeInsets { top:number;right:number;bottom:number;left:number }
type TapWindow = { windowWidth?:number;windowHeight?:number;safeArea?:{left:number;right:number;top:number;bottom:number} };
type TapBridge = { getWindowInfo?:()=>TapWindow;onHide?:(fn:()=>void)=>void;offHide?:(fn:()=>void)=>void;onShow?:(fn:()=>void)=>void;offShow?:(fn:()=>void)=>void };
const bridge=():TapBridge|undefined=>(globalThis as typeof globalThis & {tap?:TapBridge}).tap;
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;

export function readSafeInsets():SafeInsets {
 const coarse=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
 const iphone=/iPhone|iPad|iPod/i.test(navigator.userAgent);
 const defaults:SafeInsets=coarse?{left:iphone?72:20,right:iphone?72:20,top:44,bottom:iphone?28:16}:{left:18,right:18,top:18,bottom:18};
 const probe=document.createElement('div');
 probe.style.cssText='position:fixed;pointer-events:none;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
 document.body.append(probe);const css=getComputedStyle(probe);
 const result={top:Math.max(defaults.top,parseFloat(css.paddingTop)||0),right:Math.max(defaults.right,parseFloat(css.paddingRight)||0),bottom:Math.max(defaults.bottom,parseFloat(css.paddingBottom)||0),left:Math.max(defaults.left,parseFloat(css.paddingLeft)||0)};
 probe.remove();
 try {
  const info=bridge()?.getWindowInfo?.(),safe=info?.safeArea;
  // Reject portrait-coordinate or inconsistent old system info in landscape.
  if(info&&safe&&finite(info.windowWidth)&&finite(info.windowHeight)&&Math.abs(info.windowWidth-innerWidth)<4&&Math.abs(info.windowHeight-innerHeight)<4&&[safe.left,safe.right,safe.top,safe.bottom].every(finite)&&safe.right>=safe.left&&safe.bottom>=safe.top&&safe.right<=innerWidth&&safe.bottom<=innerHeight){
   result.left=Math.max(result.left,safe.left);result.right=Math.max(result.right,innerWidth-safe.right);
   result.top=Math.max(result.top,safe.top);result.bottom=Math.max(result.bottom,innerHeight-safe.bottom);
  }
 }catch{ /* env plus conservative fallback remains usable when bridge is unavailable. */ }
 return result;
}

export function initPlatform(onPause:()=>void):()=>void {
 const pause=()=>onPause();
 const hidden=()=>{if(document.hidden)pause();};
 document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',pause);
 let registered:TapBridge|undefined;
 let stopped=false;
 const register=()=>{const tap=bridge();if(tap&&tap!==registered){registered?.offHide?.(pause);tap.onHide?.(pause);registered=tap;}};
 register();
 // A bridge can arrive after JS modules. Bounded discovery never delays game startup.
 let attempts=0;
 const timer=window.setInterval(()=>{if(stopped)return;register();if(registered||++attempts>=20)clearInterval(timer);},250);
 return ()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',pause);registered?.offHide?.(pause);};
}

/** No documented H5 native-startup progress bridge was confirmed. Never fake one. */
export function startupReady():void { /* The TapTap host owns its existing startup UI. */ }
export const platformCapabilities={nativeStartupProgress:'unconfirmed' as const};
