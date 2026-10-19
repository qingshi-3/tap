// Regional business screens: use the same public plan for budgets, deliveries and construction.
import * as G from './game.js';
export function createNetworkUI({h,img,modal,closeX,execute,refresh,toast}) {
  const view=()=>G.businessView().network;
  const assets={old:'assets/bg/shop.jpg',workshop:'assets/bg/workshop.jpg',harbor:'assets/items/fish.png',boutique:'assets/items/water.png',capacity:'assets/items/ingot.png'};
  const names={old:'老店',workshop:'中央作坊',harbor:'港区店',boutique:'精品街店',capacity:'中央扩产'};
  const labels={production:{water:'偏向水业',balanced:'均衡生产',fish:'偏向鲜鱼'},quality:{standard:'山泉水',mixed:'两种各半',premium:'纯净水'},priority:{harbor:'港区优先',boutique:'精品街优先'}};
  const fill=(el,...children)=>el.replaceChildren(...h('div',{},...children).childNodes);
  const amount=n=>n==null?'0':Number.isInteger(n)?String(n):Number(n).toFixed(2);
  const net=n=>(n>0?'+':'')+amount(n);
  const date=p=>p?.period?`第${p.period.start}—${p.period.end}天`:'';
  const waterName=id=>id==='boutique'?'纯净水':'山泉水';
  const supplyText=s=>`到货/需求：${waterName(s.id)} ${s.units.standard+s.units.premium}/${s.demand.water} · 鲜鱼 ${s.units.fish}/${s.demand.fish}`;
  const compared=(value,original)=>net(value)+(original!=null&&value!==original?`（原${net(original)}）`:'');
  const units=(u={})=>h('div.network-goods',[
    ['standard','山泉水','water'],['premium','纯净水','water'],['fish','鲜鱼','fish']
  ].filter(([key])=>u[key]>0).map(([key,label,icon])=>h('span',img(`assets/items/${icon}.png`),`${label}×${u[key]}`)));
  const stat=(label,value)=>h('div.stat',h('span',label),h('b',value));
  const goalText=n=>n.goal.completedDay?`三店版图已达成 · 第${n.goal.completedDay}天`:`稳健经营 ${n.goal.streak}/${n.goal.required}期`;
  function frontage(body){
    const n=view();if(!n||!G.businessView().ownership.owned)return;
    body.append(h('div.business-row',img(assets.harbor),h('div.grow',h('b','生意版图'),h('div.machine-status',n.goal.completedDay?goalText(n):n.nextTarget||n.status)),h('button.btn.small.mint',{onclick:open},'查看')));
  }
  function open(){
    if(!view()){toast('生意版图尚未准备好');return;}
    modal(close=>{
      const host=h('div.sheet.business-sheet.network-sheet');
      const draw=()=>{
        const n=view(),workshop=n.builds.find(b=>b.id==='workshop'),branch=n.builds.some(b=>['harbor','boutique'].includes(b.id)&&b.built);
        const builds=n.builds.filter(b=>b.id==='workshop'||workshop?.built&&(b.id!=='capacity'||branch&&!b.built));
        const capacityBuild=n.builds.find(b=>b.id==='capacity'),hours=n.current?.plan.capacity??(capacityBuild?.effective?72:48);
        const workshopStatus=`${hours}工时/期`+(capacityBuild?.built&&!capacityBuild.effective?` · 第${capacityBuild.effectiveDay}天72工时`:'');
        fill(host,h('h2','生意版图',closeX(close)),h('div.scroll.business-content',
          h('div.order-status',h('b',`鱼币 ${G.S.money}`),h('span',branch?goalText(n):n.nextTarget)),
          branch&&!n.goal.completedDay&&n.goal.reason&&h('div.machine-status',(n.current&&n.last?.goalReason===n.goal.reason?'上期：':'')+n.goal.reason),
          n.reason&&!n.reason.includes(n.nextTarget)&&h('div.machine-status',n.reason),
          h('div.network-object',img(assets.old),h('div.grow',h('b','老店'),h('div.machine-status',G.businessView().ownership.owned?`永久产权${n.last?' · 上期净额'+net(n.last.oldStoreProfit):''}`:'尚未赎回')),h('button.btn.small.paper',{onclick:()=>storePage('old',draw,host)},'收支')),
          builds.map(b=>h('div.network-object',img(assets[b.id]),h('div.grow',h('b',b.name),h('div.machine-status',b.built?(b.effective?(b.id==='workshop'?workshopStatus:'已启用'):`第${b.effectiveDay}天启用`):b.reason||`建设后余${b.balanceAfter}鱼币`)),
            b.built?(['harbor','boutique'].includes(b.id)?h('button.btn.small.paper',{onclick:()=>storePage(b.id,draw,host)},'收支'):null):h('button.btn.small.mint',{disabled:!b.eligible,onclick:()=>buildPage(b,draw,host)},`${b.id==='capacity'?'扩产':'建设'} ${b.cost}`))),
          n.current&&h('div.network-current',h('b',`本期已锁定 · ${date(n.current.plan)}`),units(n.current.plan.production)),
          workshop?.built&&receptionControl(n,draw),
          n.goal.completedDay&&h('button.btn.mint',{onclick:()=>reviewPage(draw,host)},'经营回顾')
        ),workshop?.built&&h('button.btn.mint',{onclick:()=>policyPage(draw,host)},'下期安排'));
      };draw();return host;
    },{onClose:refresh});
  }
  function receptionControl(n,redraw){
    const mode=n.reception||'all';
    const control=h('select',{'aria-label':'临时订单接待',onchange:async e=>{
      const choice=e.target.value;control.disabled=true;
      const result=await execute('networkReception',{mode:choice});
      if(result.ok){toast(choice==='stock'?'店长将婉拒缺货新单':'临时订单恢复逐单接待');redraw();}
      else {control.value=mode;control.disabled=false;}
    }},h('option',{value:'all'},'逐单接待'),h('option',{value:'stock'},'仅接待现货单'));
    control.value=mode;
    return h('div.network-reception',h('label.network-field',h('span','临时订单'),control),!n.managerActive&&h('div.machine-status','店长上岗后生效'));
  }
  function buildPage(build,back,host){
    const draw=()=>{
      const b=view().builds.find(x=>x.id===build.id);
      fill(host,h('h2',b.name),h('div.scroll.business-content',h('div.network-build-portrait',img(assets[b.id])),stat('建设费用',amount(b.cost)),stat('现有鱼币',amount(G.S.money)),stat('支付后余额',amount(b.balanceAfter)),stat('建设后需留',amount(b.requiredCash-b.cost)),h('div.machine-status',b.reason||`第${b.effectiveDay||view().preview.period.start}天启用；已留出下期运营与周转资金。`)),h('div.row',h('button.btn.paper',{onclick:back},'返回'),h('button.btn.mint',{disabled:!b.eligible,onclick:async()=>{const result=await execute('networkBuild',{id:b.id});if(result.ok){toast(`${b.name}已建设`);back();}}},`支付 ${b.cost}`)));
    };draw();
  }
  function select(label,key,draft,draw){
    const el=h('select',{'aria-label':label,onchange:e=>{draft[key]=e.target.value;draw(label);}},Object.entries(labels[key]).map(([value,text])=>h('option',{value},text)));
    el.value=draft[key];return h('label.network-field',h('span',label),el);
  }
  function policyPage(back,host){
    let draft={...view().policy};
    const original=G.networkPreview({...draft});
    const draw=focus=>{
      const scroll=host.querySelector('.scroll')?.scrollTop||0,n=view(),hasBranch=n.builds.some(b=>['harbor','boutique'].includes(b.id)&&b.built),hasBoutique=n.builds.some(b=>b.id==='boutique'&&b.built),bothBranches=['harbor','boutique'].every(id=>n.builds.some(b=>b.id===id&&b.built));
      const input=h('input',{type:'number',min:0,inputmode:'numeric',value:draft.reserve,'aria-label':'额外留用鱼币'}),preview=h('div.network-preview'),error=h('div.selection-status',{role:'status'});
      const save=h('button.btn.mint',{onclick:async()=>{const result=await execute('networkPolicy',{...draft});if(result.ok){toast('下期安排已保存');back();}}},'保存下期安排');
      const update=()=>{
        draft.reserve=Number(input.value);
        const invalid=!Number.isSafeInteger(draft.reserve)||draft.reserve<0;save.disabled=invalid;
        error.textContent=invalid?'留用金额须为非负整数':'';
        if(invalid){fill(preview);return;}
        const plan=typeof G.networkPreview==='function'?G.networkPreview({...draft}):n.preview;
        if(plan)fill(preview,h('b',`${draft.enabled?'下期预览':'开工预览'} · ${date(plan)} · ${plan.market.name}`),h('div.machine-status',`${plan.hoursUsed}/${plan.capacity}工时`),units(plan.production),stat('预计支出',amount(plan.spending)),stat('预计回款',amount(plan.income)),stat('预计净额',compared(plan.profit,original?.profit)),stat('需备现金（含留用与旧约）',amount(plan.requiredCash)),!plan.affordable&&h('div.selection-status',`还缺${plan.shortfall}鱼币`),plan.stores.map(s=>h('div.network-preview-store',h('b',s.name),h('div.machine-status',supplyText(s)),h('div.order-status',h('span',`预计回款${s.income}`),h('b',`净额${compared(s.profit,original?.stores.find(old=>old.id===s.id)?.profit)}`)))));
      };
      input.addEventListener('input',update);
      fill(host,h('h2','下期安排'),h('div.scroll.business-content',
        h('button.btn.'+(draft.enabled?'mint':'paper'),{'aria-pressed':String(draft.enabled),onclick:()=>{draft.enabled=!draft.enabled;draw();}},draft.enabled?'中央作坊：开工':'中央作坊：停工'),
        h('label.business-field',h('span','额外留用鱼币'),input),
        hasBranch&&(hasBoutique?h('div.network-policy-pair',select('生产偏向','production',draft,draw),select('水质结构','quality',draft,draw)):select('生产偏向','production',draft,draw)),bothBranches&&select('配送优先','priority',draft,draw),
        h('div.machine-status',n.current?'本期方案已锁定，修改从下期生效；停工也会完成已付批次。':draft.enabled?'下期开始时支付原料与运营费用。':'已安排停工；下方为重新开工时的预计值。'),preview
      ),error,h('div.row',h('button.btn.paper',{onclick:back},'返回版图'),save));
      update();const area=host.querySelector('.scroll');if(area)area.scrollTop=scroll;
      if(focus)host.querySelector(`[aria-label="${focus}"]`)?.focus({preventScroll:true});
    };draw();
  }
  function storePage(id,back,host,source){
    const n=view(),chosen=source||(n.last?'last':n.current?'current':'preview'),plan=chosen==='last'?n.last:chosen==='current'?n.current?.plan:n.preview,store=plan?.stores.find(s=>s.id===id);
    fill(host,h('h2',names[id]||id),h('div.scroll.business-content',h('div.network-build-portrait',img(assets[id])),h('div.row.network-report-tabs',n.last&&h('button.btn.small.'+(chosen==='last'?'mint':'paper'),{onclick:()=>storePage(id,back,host,'last')},'上期实际'),n.current&&h('button.btn.small.'+(chosen==='current'?'mint':'paper'),{onclick:()=>storePage(id,back,host,'current')},'本期锁定'),h('button.btn.small.'+(chosen==='preview'?'mint':'paper'),{onclick:()=>storePage(id,back,host,'preview')},'下期预计')),
      store?[h('div.machine-status',`${date(plan)} · ${plan.market.name}`),h('div.machine-status',`需求 ${waterName(store.id)}${store.demand.water} · 鲜鱼${store.demand.fish}`),units(store.units),stat(id==='old'?(chosen==='last'?'日用品柜台回款':'柜台预计回款'):(chosen==='last'?'实际回款':'预计回款'),amount(store.income)),stat('原料及滤材',amount(store.materials)),stat('工资与场地',amount(store.wages)),stat('报损成本',amount(store.wasteCost)),stat(id==='old'?(chosen==='last'?'日用品柜台净额':'柜台预计净额'):chosen==='last'?'实际净额':'预计净额',net(store.profit)),id==='old'&&chosen==='last'&&stat('原有业务净额',net(plan.legacyProfit)),id==='old'&&chosen==='last'&&stat('老店总净额',net(plan.oldStoreProfit))]:h('div.empty-state','尚未营业，无收支记录。')
    ),h('button.btn.paper',{onclick:back},'返回版图'));
  }
  function reviewPage(back,host){
    const n=view(),last=n.last;
    fill(host,h('h2','经营回顾'),h('div.scroll.business-content',h('div.network-review-objects',['old','harbor','boutique'].map(id=>h('div',img(assets[id]),h('b',names[id])))),h('b',goalText(n)),last&&[stat('最近一期回款',amount(last.income)),stat('运营支出',amount(last.spending)),stat('区域柜台净额',net(last.profit)),last.stores.map(s=>stat(s.id==='old'?'老店经营净额':`${s.name}净额`,net(s.id==='old'?last.oldStoreProfit:s.profit)))],h('div.machine-status','三家店继续营业，可以按下一期行情调整生产与配送。')),h('button.btn.mint',{onclick:back},'继续经营'));
  }
  function review(){modal(close=>{const host=h('div.sheet.business-sheet.network-sheet');reviewPage(close,host);return host;},{onClose:refresh});}
  return {frontage,open,review};
}


