import type {StoragePort} from './storage';
export interface Settings {version:1;muted:boolean;reducedMotion:boolean}
export const SETTINGS_KEY='little-guardians-h5.settings.v1';
export function loadSettings(reducedMotion:boolean,port?:StoragePort):{settings:Settings;error?:string}{
 const defaults:Settings={version:1,muted:false,reducedMotion};
 try{const raw=(port??localStorage).getItem(SETTINGS_KEY);if(raw===null)return {settings:defaults};const value=JSON.parse(raw);if(value?.version!==1||typeof value.muted!=='boolean'||typeof value.reducedMotion!=='boolean')throw new Error('设置版本无法读取，原件保留');return {settings:value};}
 catch(e){return {settings:defaults,error:e instanceof Error?e.message:'设置读取失败'};}
}
export function saveSettings(settings:Settings,port?:StoragePort):{ok:boolean;message?:string}{
 try{const store=port??localStorage;const raw=store.getItem(SETTINGS_KEY);if(raw!==null){const old=JSON.parse(raw);if(old?.version!==1||typeof old.muted!=='boolean'||typeof old.reducedMotion!=='boolean')throw new Error('不支持的旧设置已保留');}const next=JSON.stringify(settings);store.setItem(SETTINGS_KEY,next);if(store.getItem(SETTINGS_KEY)!==next)throw new Error('设置保存未确认');return {ok:true};}
 catch(e){return {ok:false,message:e instanceof Error?e.message:'设置保存失败'};}
}
