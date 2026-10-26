import assert from 'node:assert/strict';
import {store} from '../js/platform.js';
const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
assert.equal(store.read('run').status,'empty');
assert.equal(store.set('run',{v:2,money:12}),true);assert.deepEqual(store.read('run').value,{v:2,money:12});
map.set('run','{broken');assert.equal(store.read('run').status,'invalid');assert.equal(store.read('run').raw,'{broken');
globalThis.localStorage.setItem=()=>{throw Error('quota');};assert.equal(store.set('run',{v:2}),false);assert.equal(map.get('run'),'{broken');
globalThis.localStorage.getItem=()=>{throw Error('blocked');};assert.equal(store.read('run').status,'unavailable');
console.log('storage empty / roundtrip / invalid raw / quota / blocked checks passed');
