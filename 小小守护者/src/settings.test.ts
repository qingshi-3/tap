import {describe,it,expect} from 'vitest';
import {loadSettings,saveSettings,SETTINGS_KEY} from './settings';
import type {StoragePort} from './storage';
function memory():StoragePort{const map=new Map<string,string>();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v)},removeItem:k=>{map.delete(k)}};}
describe('settings persistence',()=>{
 it('keeps mute and reduced motion after reload',()=>{const port=memory();expect(loadSettings(true,port).settings.reducedMotion).toBe(true);expect(saveSettings({version:1,muted:true,reducedMotion:false},port).ok).toBe(true);expect(loadSettings(true,port).settings).toEqual({version:1,muted:true,reducedMotion:false});});
 it('preserves unsupported settings instead of replacing them',()=>{const port=memory();const raw='{"version":9,"muted":false}';port.setItem(SETTINGS_KEY,raw);expect(loadSettings(false,port).error).toBeTruthy();expect(saveSettings({version:1,muted:false,reducedMotion:false},port).ok).toBe(false);expect(port.getItem(SETTINGS_KEY)).toBe(raw);});
 it('reports rejected writes',()=>{const port=memory();port.setItem=()=>{throw new Error('quota')};expect(saveSettings({version:1,muted:true,reducedMotion:true},port)).toEqual({ok:false,message:'quota'});});
});
