import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, dispatch, selectProperties, selectApplicants, selectTenants, selectSummary, quoteRent, loadGame, saveGame, validateSave, SAVE_KEY, BACKUP_KEY, V2_BACKUP_KEY, selectDistricts, content, type GameState, type Action } from '../src/game/index';
const id = 'xingfu-402';
function act(s: GameState, a: Action) { const r = dispatch(s, a); assert.equal(r.ok, true, r.message); return r.state; }
function clear(s: GameState) { while (s.pendingEvents.length) {
    const e = s.pendingEvents[0];
    s = act(s, { type: 'resolve', eventId: e.id, choiceId: e.choices.find(c => !c.cost)?.id ?? e.choices[0].id });
} return s; }
const playable = () => act(act(createGame(17), { type: 'repair', propertyId: id }),{type:'listing',propertyId:id,askingRent:400});
function accept(s: GameState, propertyId = id) { return act(s, { type: 'rent', propertyId, applicantId: selectApplicants(s, propertyId)[0].id }); }
function storage(raw?: string) { const entries = new Map<string, string>(raw ? [[SAVE_KEY, raw]] : []); return { entries, getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v); } }; }
test('三户计租不会把整屋租金乘三，第4户和重复签约拒绝', () => { let s = playable(); assert.equal(selectApplicants(s, id).length, 1); s = act(s, { type: 'agency', propertyId: id }); const initial = selectApplicants(s, id); assert.equal(initial.length, 3); const cash = s.cash; for (const a of initial) {
    assert.equal(a.monthlyRent, quoteRent(s, id, a.tenantId));
    s = act(s, { type: 'rent', propertyId: id, applicantId: a.id });
} const p = selectProperties(s)[0]; assert.equal(p.occupancy, 3); assert.equal(p.rent, 1200); assert.equal(p.leases.reduce((n, l) => n + l.monthlyRent, 0), p.rent); assert.equal(dispatch(s, { type: 'rent', propertyId: id, applicantId: initial[0].id }).ok, false); assert.equal(dispatch(s, { type: 'agency', propertyId: id }).ok, false); assert.equal(s.cash, cash); assert.equal(dispatch(s, { type: 'renovate', propertyId: id, renovationId: 'simple' }).ok, false); validateSave(s); });
test('免费上门每房每月最多一次，拒绝和维修不能刷人，中介只补空位', () => { let s = playable(); s = act(s, { type: 'reject', propertyId: id, applicantId: s.applicants[0].id }); s.properties[id].condition = 90; s = act(s, { type: 'repair', propertyId: id }); assert.equal(s.applicants.length, 0); s = clear(act(s, { type: 'advance' })); assert.equal(s.applicants.length, 0);s=clear(act(s,{type:'advance'})); assert.equal(s.applicants.length, 1); const cash = s.cash; s = act(s, { type: 'agency', propertyId: id }); assert.equal(s.cash, cash - 200); assert.equal(s.applicants.length, 3); assert.equal(dispatch(s, { type: 'agency', propertyId: id }).ok, false); assert.equal(s.cash, cash - 200); s = accept(s); s = accept(s); const a = s.applicants[0]; s = act(s, { type: 'reject', propertyId: id, applicantId: a.id }); const before = s.cash; s = act(s, { type: 'agency', propertyId: id }); assert.equal(s.applicants.length, 1); assert.equal(s.cash, before - 200); });
test('中介缺现金和没有候选不收费，人物不得跨房重复', () => { let s = playable(); s.cash = 199; const r = dispatch(s, { type: 'agency', propertyId: id }); assert.equal(r.ok, false); assert.equal(r.state, s); s.cash = 2000000; for (const property of selectProperties(s).slice(1))
    {s = act(s, { type: 'buy', propertyId: property.id, financing: 'cash' });s=act(s,{type:'listing',propertyId:property.id,askingRent:400});} assert.equal(new Set(s.applicants.map(a => a.tenantId)).size, s.applicants.length); for (const property of selectProperties(s)) {
    s = act(s, { type: 'agency', propertyId: property.id });
    while (selectApplicants(s, property.id).length)
        s = accept(s, property.id);
} assert.equal(new Set(Object.values(s.properties).flatMap(p => p.leases.map(l => l.tenantId))).size, 15); s.properties[id].leases.pop(); const cash = s.cash; s = act(s, { type: 'agency', propertyId: id }); assert.equal(s.cash, cash - 200); });
test('贷款、全部租户售出及关联事件访客清理', () => { let s = playable(); s = act(s, { type: 'agency', propertyId: id }); s = accept(s); s = accept(s); s.cash = 30000; s = act(s, { type: 'buy', propertyId: 'xingfu-403', financing: 'mortgage' });s=act(s,{type:'listing',propertyId:'xingfu-403',askingRent:400}); assert.equal(s.properties['xingfu-403'].debt, 60000); s = clear(act(s, { type: 'advance' })); assert.equal(s.properties['xingfu-403'].debt, 60000 + 180 - s.properties['xingfu-403'].payment); s = act(s, { type: 'advance' }); assert.ok(s.pendingEvents.some(e => e.tenantId === 'zhangwei')); s = act(s, { type: 'sell', propertyId: id }); assert.equal(s.properties[id].leases.length, 0); assert.ok(!s.applicants.some(a => a.propertyId === id)); assert.ok(!s.pendingEvents.some(e => e.propertyId === id)); const p = selectProperties(s).find(p => p.id === 'xingfu-403')!; const cash = s.cash; s = act(s, { type: 'sell', propertyId: p.id }); assert.equal(s.cash, cash + p.value - p.debt); assert.equal(s.properties[p.id].debt, 0); validateSave(s); });
test('事件具体到每户，成长离开不只首户', () => { let s = playable(); s = act(s, { type: 'agency', propertyId: id }); while (s.applicants.length)
    s = accept(s); s.month = 5; s.properties[id].condition = 79; s = act(s, { type: 'advance' }); const repairs = s.pendingEvents.filter(e => e.id.startsWith('repair-request')); assert.equal(repairs.length, 1); assert.equal(new Set(repairs.map(e => e.tenantId)).size, 1); for (const l of s.properties[id].leases)
    assert.equal(s.tenants[l.tenantId].growth, 1); s = clear(s); for (const l of s.properties[id].leases)
    s.tenants[l.tenantId].relationship = 20; s.properties[id].condition = 39; s = act(s, { type: 'advance' }); assert.equal(s.properties[id].leases.length, 0); });
test('冻结v1严格加载、原文备份、继续保存、重进继续保存，财务人物产权事件保留', () => { const raw = readFileSync(new URL('./fixtures/v1-established.json', import.meta.url), 'utf8'); const old = JSON.parse(raw); const st = storage(raw); const loaded = loadGame(st); assert.equal(loaded.blocked, false, loaded.error ?? ''); assert.equal(st.entries.get(BACKUP_KEY), raw); let s = loaded.state; assert.equal(s.schemaVersion, 3); assert.equal(s.cash, old.cash); assert.equal(s.month, old.month); assert.equal(s.properties['xingfu-403'].debt, old.properties['xingfu-403'].debt); assert.deepEqual(s.tenants.zhangwei, old.tenants.zhangwei); assert.deepEqual(s.completedEvents, old.completedEvents); assert.deepEqual(s.history, old.history); assert.equal(selectProperties(s)[0].rent, 1560); assert.equal(s.properties[id].leases[0].rentShare, 1); assert.equal(s.properties[id].leases[0].source, 'legacy'); s = clear(act(s, { type: 'advance' })); assert.equal(saveGame(st, s, loaded.raw).ok, true); const reloaded = loadGame(st); assert.equal(reloaded.blocked, false); s = clear(act(reloaded.state, { type: 'advance' })); assert.equal(saveGame(st, s, reloaded.raw).ok, true); assert.equal(loadGame(st).state.month, old.month + 2); assert.equal(st.entries.get(BACKUP_KEY), raw); });
test('旧档备份失败、坏档、未知档与旧页拒绝覆盖', () => { const raw = readFileSync(new URL('./fixtures/v1-established.json', import.meta.url), 'utf8'); const st = storage(raw); const broken = { ...st, setItem: (k: string, v: string) => { if (k === BACKUP_KEY)
        throw Error('quota'); st.setItem(k, v); } }; assert.equal(loadGame(broken).blocked, true); assert.equal(st.getItem(SAVE_KEY), raw); assert.equal(saveGame(broken, validateSave(JSON.parse(raw)), raw).ok, false); assert.equal(st.getItem(SAVE_KEY), raw); for (const invalid of ['{broken', '{"schemaVersion":99}', JSON.stringify({ ...JSON.parse(raw), tenants: {} })]) {
    const bad = storage(invalid);
    assert.equal(loadGame(bad).blocked, true);
    assert.equal(saveGame(bad, createGame(17)).ok, false);
    assert.equal(bad.getItem(SAVE_KEY), invalid);
} const clean = storage(); const page = loadGame(clean); assert.equal(saveGame(clean, playable(), page.raw).ok, true); const saved = clean.getItem(SAVE_KEY); assert.equal(saveGame(clean, page.state, page.raw).ok, false); assert.equal(clean.getItem(SAVE_KEY), saved); });
test('v2保存访客来源去重和固定存储位置', () => { let s = act(playable(), { type: 'agency', propertyId: id }); s = accept(s); const st = storage(); assert.equal(saveGame(st, s, null).ok, true); assert.deepEqual(loadGame(st).state, s); assert.equal(st.entries.size, 1); const dup = structuredClone(s); dup.applicants.push({ ...dup.applicants[0], id: 'duplicate' }); assert.throws(() => validateSave(dup), /存档损坏/); assert.throws(() => validateSave({ ...s, pendingEvents: [null] }), /存档损坏/); });
test('贷款最终偿清，现金不足月结原对象保留', () => { let s = act(createGame(17), { type: 'buy', propertyId: 'xingfu-403', financing: 'mortgage' }); const r = dispatch(s, { type: 'advance' }); assert.equal(r.ok, false); assert.equal(r.state, s); s.cash = 100000; for (let i = 0; i < 120; i++) {
    const expected = selectSummary(s).netIncome;
    s = clear(act(s, { type: 'advance' }));
    assert.equal(s.history.at(-1)!.net, expected);
} assert.equal(s.properties['xingfu-403'].debt, 0); assert.equal(s.properties['xingfu-403'].payment, 0); });
test('v1不能使用新增身份，v2拒绝伪造第四户与坏来源', () => { const raw = JSON.parse(readFileSync(new URL('./fixtures/v1-established.json', import.meta.url), 'utf8')); raw.properties[id].tenantId = 'chenchen'; assert.throws(() => validateSave(raw), /存档损坏/); let s = act(playable(), { type: 'agency', propertyId: id }); while (s.applicants.length)
    s = accept(s); s.applicants.push({ id: 'fourth', propertyId: id, tenantId: 'wangjie', source: 'agency', createdMonth: 0,offeredRent:400,kind:'full',offerText:'测试',expiresMonth:1 }); assert.equal(dispatch(s, { type: 'rent', propertyId: id, applicantId: 'fourth' }).ok, false); assert.throws(() => validateSave(s), /存档损坏/); const valid = playable(); (valid.applicants[0] as any).source = 'fake'; assert.throws(() => validateSave(valid), /存档损坏/); });

test('共用维修每房只收一次，并处理已有同月兄弟事件且保留另一房和个人消息', () => {
    for (const choiceId of ['help', 'wait']) {
        let s = act(playable(), {type:'agency',propertyId:id});
        while(selectApplicants(s,id).length)s=accept(s);
        s.cash=30000;
        s=act(s,{type:'buy',propertyId:'xingfu-403',financing:'mortgage'});s=act(s,{type:'listing',propertyId:'xingfu-403',askingRent:400});
        s=accept(s,'xingfu-403');
        s.month=5;
        s.properties[id].condition=79;
        s.properties['xingfu-403'].condition=79;
        s=act(s,{type:'advance'});
        const repairs=s.pendingEvents.filter(e=>e.id.startsWith('repair-request:'));
        assert.equal(repairs.length,2);
        const shared=repairs.find(e=>e.propertyId===id)!;
        const other=repairs.find(e=>e.propertyId==='xingfu-403')!;
        for(const lease of s.properties[id].leases.slice(1))s.pendingEvents.push({...structuredClone(shared),id:`repair-request:6:${id}:${lease.tenantId}`,tenantId:lease.tenantId});
        validateSave(s);
        const cash=s.cash;
        const before=s.properties[id].leases.map(l=>[l.tenantId,s.tenants[l.tenantId].relationship] as const);
        const personal=s.pendingEvents.filter(e=>!e.id.startsWith('repair-request:')).map(e=>e.id);
        s=act(s,{type:'resolve',eventId:shared.id,choiceId});
        assert.equal(s.cash,cash-(choiceId==='help'?300:0));
        assert.equal(s.properties[id].condition,choiceId==='help'?100:77);
        for(const [tenantId,relationship] of before)assert.equal(s.tenants[tenantId].relationship,relationship+(choiceId==='help'?10:-15));
        assert.ok(!s.pendingEvents.some(e=>e.propertyId===id&&e.id.startsWith('repair-request:6:')));
        assert.ok(s.pendingEvents.some(e=>e.id===other.id));
        assert.deepEqual(s.pendingEvents.filter(e=>!e.id.startsWith('repair-request:')).map(e=>e.id),personal);
        assert.equal(dispatch(s,{type:'resolve',eventId:shared.id,choiceId}).ok,false);
        validateSave(s);
    }
});
test('保存返回确切写入文本，另一页面紧随写入也不会偷换版本令牌',()=>{
    const st=storage();const a=playable();const b=act(a,{type:'agency',propertyId:id});const bRaw=JSON.stringify(b);
    const racing={getItem:st.getItem,setItem:(k:string,v:string)=>{st.setItem(k,v);if(k===SAVE_KEY)st.setItem(k,bRaw);}};
    const saved=saveGame(racing,a,null);
    assert.equal(saved.ok,true);assert.equal(saved.raw,JSON.stringify(a));assert.equal(st.getItem(SAVE_KEY),bRaw);
    const next=saveGame(st,act(a,{type:'advance'}),saved.raw);
    assert.equal(next.ok,false);assert.equal(next.raw,null);assert.equal(st.getItem(SAVE_KEY),bRaw);
});


test('挂牌过高无访客与中介不扣费，降价原价成交，暂停移除普通报价',()=>{
 let s=act(createGame(17),{type:'repair',propertyId:id});assert.equal(s.applicants.length,0);
 s=act(s,{type:'listing',propertyId:id,askingRent:5000});assert.equal(s.applicants.length,0);const cash=s.cash;
 assert.equal(dispatch(s,{type:'agency',propertyId:id}).ok,false);assert.equal(s.cash,cash);
 s=act(s,{type:'listing',propertyId:id,askingRent:350});assert.equal(s.applicants[0].kind,'full');assert.equal(s.applicants[0].offeredRent,350);
 s=act(s,{type:'unlist',propertyId:id});assert.equal(s.applicants.length,0);assert.equal(selectDistricts(s)[0].listedVacancies,0);
});
test('砍价与可接受反报价固定合同，过高反价离开不收费，普通报价下月失效',()=>{
 let s=act(act(createGame(17),{type:'repair',propertyId:id}),{type:'listing',propertyId:id,askingRent:550});
 const a=s.applicants[0];assert.equal(a.kind,'bargain');assert.ok(a.offeredRent<550);const cash=s.cash;
 s=act(s,{type:'counter',propertyId:id,applicantId:a.id,rent:900});assert.equal(s.applicants.length,0);assert.equal(s.cash,cash);
 s=act(s,{type:'agency',propertyId:id});const b=s.applicants[0];s=act(s,{type:'counter',propertyId:id,applicantId:b.id,rent:390});assert.equal(s.properties[id].leases[0].monthlyRent,390);
 const expired=s.applicants.map(a=>a.id);s=clear(act(s,{type:'advance'}));assert.ok(s.applicants.every(a=>!expired.includes(a.id)));validateSave(s);
});
test('合同不随预算房况市场改变；满房到期唯一续租，待决旧价，接受与拒绝',()=>{
 let s=act(playable(),{type:'agency',propertyId:id});while(s.applicants.length)s=accept(s);
 const initial=selectProperties(s)[0].rent;assert.equal(initial,1200);
 for(const l of s.properties[id].leases)s.tenants[l.tenantId].growth=10;
 s.development.xingfu.rentFactor=2;s.properties[id].condition=60;assert.equal(selectProperties(s)[0].rent,initial);
 for(let i=0;i<6;i++)s=clear(act(s,{type:'advance'}));assert.equal(s.applicants.filter(a=>a.kind==='renewal').length,3);
 const renewal=s.applicants[0];const offered=renewal.offeredRent;s=clear(act(s,{type:'advance'}));assert.equal(s.applicants.filter(a=>a.kind==='renewal').length,3);assert.equal(selectProperties(s)[0].rent,initial);
 s=act(s,{type:'rent',propertyId:id,applicantId:renewal.id});assert.equal(s.properties[id].leases.find(l=>l.tenantId===renewal.tenantId)!.monthlyRent,offered);
 const rejected=s.applicants[0];s=act(s,{type:'reject',propertyId:id,applicantId:rejected.id});assert.equal(s.properties[id].leases.length,2);assert.ok(!s.properties[id].leases.some(l=>l.tenantId===rejected.tenantId));validateSave(s);
});
test('项目阶段驱动价格租金需求，取消回落、延期等待启用；不会按月全区涨价',()=>{
 let s=createGame(17);s.cash=100000;const old=selectProperties(s).map(p=>p.value);
 s=clear(act(s,{type:'advance'}));assert.deepEqual(selectProperties(s).map(p=>p.value),old);
 for(let i=1;i<9;i++)s=clear(act(s,{type:'advance'}));const x=selectDistricts(s);assert.equal(x[1].project.stage,'operating');assert.equal(s.development.university.rentFactor,1.12);assert.ok(s.development.university.demandBonus>0);
 for(let i=9;i<12;i++)s=clear(act(s,{type:'advance'}));assert.equal(selectDistricts(s)[0].project.stage,'delayed');assert.equal(s.development.xingfu.rentFactor,1);
 for(let i=12;i<15;i++)s=clear(act(s,{type:'advance'}));assert.equal(selectDistricts(s)[0].project.stage,'operating');
 let cancelled=createGame(17);cancelled.citySeed=18;cancelled.cash=100000;for(let i=0;i<10;i++)cancelled=clear(act(cancelled,{type:'advance'}));assert.equal(selectDistricts(cancelled)[2].project.stage,'cancelled');assert.equal(cancelled.development.tech.priceFactor,1);assert.equal(cancelled.development.tech.rentFactor,1);
 assert.equal(selectDistricts(createGame(17))[0].tiers[2].demandLevel,'冷清');validateSave(cancelled);
});
test('冻结真实v2原权益、独立备份、继续签约月结保存重进；备份故障拒绝覆盖',()=>{
 const raw=readFileSync(new URL('./fixtures/v2-established.json',import.meta.url),'utf8');const old=JSON.parse(raw);const st=storage(raw);const loaded=loadGame(st);assert.equal(loaded.blocked,false,loaded.error??'');assert.equal(st.getItem(V2_BACKUP_KEY),raw);assert.equal(st.getItem(BACKUP_KEY),null);
 let s=loaded.state;assert.equal(s.schemaVersion,3);assert.equal(s.cash,old.cash);assert.equal(s.month,old.month);assert.equal(selectProperties(s)[0].rent,400);assert.equal(selectProperties(s)[0].value,50000);
 s=accept(s);s=clear(act(s,{type:'advance'}));const saved=saveGame(st,s,loaded.raw);assert.equal(saved.ok,true);const again=loadGame(st);s=clear(act(again.state,{type:'advance'}));assert.equal(saveGame(st,s,again.raw).ok,true);assert.equal(st.getItem(V2_BACKUP_KEY),raw);
 const failed=storage(raw);const broken={...failed,setItem:(k:string,v:string)=>{if(k===V2_BACKUP_KEY)throw Error('quota');failed.setItem(k,v);}};assert.equal(loadGame(broken).blocked,true);assert.equal(saveGame(broken,validateSave(JSON.parse(raw)),raw).ok,false);assert.equal(failed.getItem(SAVE_KEY),raw);
 const dup=structuredClone(loaded.state);dup.applicants.push({...dup.applicants[0],id:'same-person'});assert.throws(()=>validateSave(dup),/存档损坏/);
});


test('续租拒绝或谈崩保留共用维修转绑其余住户，只移除离开者个人消息',()=>{
 for(const type of ['reject','counter'] as const){
  let s=act(playable(),{type:'agency',propertyId:id});while(s.applicants.length)s=accept(s);
  for(let i=0;i<5;i++)s=clear(act(s,{type:'advance'}));s.properties[id].condition=79;s=act(s,{type:'advance'});
  const renewal=s.applicants.find(a=>a.kind==='renewal'&&a.tenantId==='zhangwei')!;
  const shared=s.pendingEvents.find(e=>e.id.startsWith('repair-request:'))!;assert.equal(shared.tenantId,renewal.tenantId);
  s.completedEvents=s.completedEvents.filter(e=>e!=='network');s.pendingEvents.push({...structuredClone(content.events.find(e=>e.id==='network')!),propertyId:id,tenantId:'zhangwei'});validateSave(s);
  s=act(s,type==='reject'?{type:'reject',propertyId:id,applicantId:renewal.id}:{type:'counter',propertyId:id,applicantId:renewal.id,rent:10000});
  assert.equal(s.properties[id].leases.length,2);assert.ok(!s.pendingEvents.some(e=>e.id==='network'));const remaining=s.pendingEvents.find(e=>e.id===shared.id)!;assert.ok(remaining);assert.ok(s.properties[id].leases.some(l=>l.tenantId===remaining.tenantId));validateSave(s);
  const cash=s.cash;s=act(s,{type:'resolve',eventId:remaining.id,choiceId:'help'});assert.equal(s.cash,cash-300);assert.equal(s.properties[id].condition,100);assert.ok(!s.pendingEvents.some(e=>e.id.startsWith('repair-request:')));validateSave(s);
 }
});
test('v2中等房况的旧报价与旧租金均冻结400而不是新参考380',()=>{
 const old=JSON.parse(readFileSync(new URL('./fixtures/v2-established.json',import.meta.url),'utf8'));old.properties[id].condition=60;
 const raw=JSON.stringify(old);const st=storage(raw);const loaded=loadGame(st);assert.equal(loaded.blocked,false,loaded.error??'');assert.equal(st.getItem(V2_BACKUP_KEY),raw);assert.equal(selectProperties(loaded.state)[0].marketRent,380);assert.equal(selectProperties(loaded.state)[0].rent,400);assert.ok(loaded.state.applicants.every(a=>a.offeredRent===400));
 const again=validateSave(old);assert.equal(again.citySeed,17);assert.deepEqual(again,loaded.state);
});
test('新档随机城市种子持久保存，显式种子和迁移仍可复现',()=>{
 const original=Math.random;let first:GameState,second:GameState;
 try{Math.random=()=>.01;first=createGame();Math.random=()=>.75;second=createGame();}finally{Math.random=original;}
 assert.notEqual(first!.citySeed,second!.citySeed);assert.equal(createGame(18).citySeed,18);const st=storage();assert.equal(saveGame(st,first!,null).ok,true);assert.equal(loadGame(st).state.citySeed,first!.citySeed);
});
test('地区房价租金档位跟随真实市场参考，装修不伪造不同售价',()=>{
 const s=createGame(17);const initial=selectDistricts(s);assert.ok(initial[0].tiers.every(t=>t.priceLevel===initial[0].priceLevel));assert.notEqual(initial[0].tiers[0].rentLevel,initial[0].tiers[2].rentLevel);
 for(const p of content.properties.filter(p=>p.regionId==='xingfu'))s.properties[p.id].valueFactor=8;s.development.xingfu.rentFactor=4;
 const updated=selectDistricts(s)[0];assert.equal(updated.priceLevel,'昂贵');assert.ok(updated.tiers.every(t=>t.priceLevel==='昂贵'));assert.equal(updated.rentLevel,'高');assert.equal(updated.tiers[0].rentLevel,'高');
});


test('便宜冷清基础房可首次合理接待，后续低需求空置；项目启用提高需求与来访频率',()=>{
 let s=createGame(17);s.month=1;s=act(s,{type:'repair',propertyId:id});assert.equal(selectDistricts(s)[0].tiers[0].priceLevel,'便宜');assert.equal(selectDistricts(s)[0].tiers[0].demandLevel,'冷清');
 s=act(s,{type:'listing',propertyId:id,askingRent:400});assert.equal(s.applicants.length,1);s=act(s,{type:'reject',propertyId:id,applicantId:s.applicants[0].id});
 s=clear(act(s,{type:'advance'}));assert.equal(s.applicants.length,1);s=act(s,{type:'reject',propertyId:id,applicantId:s.applicants[0].id});s=clear(act(s,{type:'advance'}));assert.equal(s.applicants.length,0);
 while(s.month<15)s=clear(act(s,{type:'advance'}));assert.equal(selectDistricts(s)[0].project.stage,'operating');assert.equal(selectDistricts(s)[0].tiers[0].demandLevel,'旺盛');assert.equal(s.applicants.length,1);
 s=act(s,{type:'reject',propertyId:id,applicantId:s.applicants[0].id});s=clear(act(s,{type:'advance'}));assert.equal(s.applicants.length,1);
 let high=createGame(17);high.month=1;high=act(high,{type:'repair',propertyId:id});high=act(high,{type:'listing',propertyId:id,askingRent:5000});assert.equal(high.applicants.length,0);
});


test('较晚v2升级同步城市项目时程，锚定旧房价与租金，保存重进继续推进',()=>{
 const old=JSON.parse(readFileSync(new URL('./fixtures/v2-established.json',import.meta.url),'utf8'));old.month=15;old.properties[id].valueFactor=1.075;old.properties['xingfu-403'].owned=true;old.properties['xingfu-403'].debt=60000;old.properties['xingfu-403'].payment=600;
 const original=structuredClone(old);const migrated=validateSave(old);assert.deepEqual(old,original);assert.equal(migrated.cash,original.cash);
 for(const p of selectProperties(migrated)){assert.equal(p.value,Math.round(content.properties.find(d=>d.id===p.id)!.baseValue*original.properties[p.id].valueFactor));assert.equal(p.debt,original.properties[p.id].debt);assert.equal(p.payment,original.properties[p.id].payment);}
 assert.equal(selectProperties(migrated)[0].rent,400);assert.ok(migrated.applicants.every(a=>a.offeredRent===400));for(const d of selectDistricts(migrated)){assert.equal(d.project.stage,'operating');assert.ok(d.project.nextMonth===null||d.project.nextMonth>migrated.month);}
 const raw=JSON.stringify(original);const st=storage(raw);const loaded=loadGame(st);assert.equal(loaded.blocked,false,loaded.error??'');assert.deepEqual(loaded.state,migrated);assert.equal(st.getItem(V2_BACKUP_KEY),raw);
 let s=clear(act(loaded.state,{type:'advance'}));const saved=saveGame(st,s,loaded.raw);assert.equal(saved.ok,true);const again=loadGame(st);assert.equal(again.blocked,false);s=clear(act(again.state,{type:'advance'}));assert.equal(saveGame(st,s,again.raw).ok,true);assert.equal(loadGame(st).state.month,17);
});
test('施工房只计施工，不重复计入待维修',()=>{
 const s=createGame(17);s.properties[id].renovationId='simple';s.properties[id].renovatingMonths=1;const d=selectDistricts(s)[0];assert.equal(d.constructionCount,1);assert.equal(d.repairCount,0);
});
