// Business screens reuse the existing shop, workshop, frontage and order entrances.
import * as G from './game.js';
import { MACHINES, ITEMS, WG } from './data.js';
export function createBusinessUI({h,img,modal,closeX,toast,execute,refresh,finish,advance,sleep}) {
  const view=()=>G.businessView();
  const stockName=it=>it.id==='water'&&it.gk?WG[G.grade(it)].n:G.itemName(it);
  const name=r=>r==='water'?'饮水':'鲜鱼';
  const icon=r=>`assets/items/${r==='water'?'dirtywater':'fry'}.png`;
  const field=(label,value,min=1,max=999)=>h('label.business-field',h('span',label),h('input',{type:'number',value,min,max,inputmode:'numeric','aria-label':label}));
  const button=(text,action,args={},after=refresh,disabled=false)=>h('button.btn.small',{disabled,onclick:async()=>{const r=await execute(action,args);if(r?.ok)after?.(r);}},text);
  const row=(title,detail,action,src)=>h('div.business-row',src&&img(src),h('div.grow',h('b',title),detail&&h('div.machine-status',detail)),action);
  const open=(title,build)=>modal(close=>{const host=h('div.sheet.business-sheet');const draw=()=>{fill(host,h('h2',title,closeX(close)),h('div.scroll.business-content',build(draw,close,host)));};draw();return host;},{onClose:refresh});
  const fill=(el,...kids)=>{el.replaceChildren(...h('div',{},...kids).childNodes);};
  function suppliers(body){
    const v=view();
    for(const s of v.suppliers.filter(s=>s.unlocked)) body.append(row(s.name||`${name(s.route)}供货商`,`${s.route==='water'?'怪味水':'真鱼苗'} · 每份${s.price} · 本期余${s.remaining}/${s.quota}`,h('button.btn.small',{onclick:()=>purchase(s.route)},'预订'),icon(s.route)));
  }
  function purchase(route){
    modal(close=>{
      const host=h('div.sheet.business-sheet');
      const draw=()=>{
        const v=view(),s=v.suppliers.find(x=>x.route===route),amount=field('数量',1,1,Math.max(1,s.remaining)),input=amount.querySelector('input');
        const total=h('b'),reason=h('div.selection-status',{role:'status'});
        const pay=h('button.btn.mint',{onclick:async()=>{const r=await execute('purchase',{route,qty:Number(input.value)});if(r?.ok)draw();}},'确认预订');
        const sync=()=>{
          const qty=Number(input.value),space=v.warehouse.capacity-v.warehouse.items.length-(v.warehouse.reserved||0);
          const error=!Number.isInteger(qty)||qty<1?'数量至少1份':qty>s.remaining?'超过本期额度':qty>space?'原料仓空间不足':qty*s.price>G.S.money?'鱼币不足':s.batches>=2&&!v.purchases.some(p=>p.route===route&&p.period===s.period.id&&p.arrivalDay===s.arrivalDay&&p.status!=='cancelled')?'本期最多两批到货':'';
          total.textContent=`合计 ${qty*s.price} 鱼币`;reason.textContent=error||`第${s.arrivalDay}天早上到货`;pay.disabled=!!error;
        };
        input.addEventListener('input',sync);sync();
        const pending=v.purchases.filter(p=>p.route===route&&['ordered','blocked'].includes(p.status));
        fill(host,h('h2',`${name(route)}供货商`,closeX(close)),h('div.scroll.business-content',
          h('div.machine-status',`${route==='water'?'怪味水':'真鱼苗'} · 单价${s.price} · 余${s.remaining}/${s.quota}`),h('div.machine-status',`到货期第${s.period.start}—${s.period.end}天`),amount,
          pending.map(p=>row(`在途 ×${p.qty}`,p.status==='blocked'?'仓满，包裹待接收':`第${p.arrivalDay}天到货`,button('取消退款','cancelPurchase',{id:p.id},draw,p.status!=='ordered'||p.arrivalDay<=G.S.day)))
        ),reason,h('div.business-checkout',total,pay));
      };draw();return host;
    },{onClose:refresh});
  }
  function warehouse(){
    let inspected='';
    open('原料仓',draw=>{const v=view(),w=v.warehouse;return [h('div.order-status',h('b',`${w.items.length}/${w.capacity}`),h('span',`在途预占 ${w.reserved||0}`)),button('货架原料移入','moveWarehouse',{to:'warehouse'},draw),inspected&&h('div.selection-status',{role:'status'},inspected),w.items.length?h('div.business-stock',w.items.map(it=>row(stockName(it),'',h('div.business-stock-actions',G.S.phase==='night'&&h('button.btn.small.paper',{onclick:async()=>{const r=await execute('inspectStock',{uid:it.uid});if(r.ok){inspected=r.inspection.text;draw();}}},'验货'),button('摆上货架','moveWarehouse',{uids:[it.uid],to:'shelf'},draw)),`assets/items/${it.id==='water'?'dirtywater':it.id}.png`))):h('div.empty-state','预订原料次晨送到这里')];});
  }
  function workshop(body){const v=view();body.prepend(row('原料仓',`${v.warehouse.items.length}/${v.warehouse.capacity} · 在途${v.warehouse.reserved||0}`,h('button.btn.small.paper',{onclick:warehouse},'整理'),icon('water')));}
  function machineActions(mid){const v=view(),route=mid==='purifier'?'water':mid==='tank'?'fish':null;const managed=route&&v.operations?.enabled&&(v.operations.routes[route]!=='off'||v.contracts.some(c=>c.managed&&c.route===route&&c.status==='active'));if(managed)return h('div.business-machine-plan',h('span.machine-status','供货托管中'),h('button.btn.small.paper',{onclick:operations},'经营安排'));const planned=v.plans.find(p=>p.machine===mid);return h('div.business-machine-plan',planned&&h('span.machine-status',`计划${planned.qty}批 · ${planned.status||'待照看'}`),h('button.btn.small.paper',{onclick:()=>plan(mid)},planned?'修改计划':'店员照看'));}
  function plan(machine){open(`${MACHINES[machine]?.name||machine}下一批`,(draw)=>{const existing=view().plans.find(p=>p.machine===machine),amount=field('开工批数',existing?.qty||1),purpose=h('select',{'aria-label':'原料用途'},h('option',{value:'contract'},'合同优先'),h('option',{value:'retail'},'零售'));purpose.value=existing?.purpose||'contract';return [amount,purpose,h('div.machine-status','店员照看一台机器；缺料、滤芯不足或成品未收时停工。'),h('div.row',h('button.btn.mint',{onclick:async()=>{const r=await execute('plan',{machine,qty:Number(amount.querySelector('input').value),purpose:purpose.value,enabled:true});if(r?.ok)draw();}},'保留计划'),button('取消计划','plan',{machine,qty:1,enabled:false},draw))];});}
  const levelName=level=>['基础规模','扩产Ⅰ','扩产Ⅱ','物流扩建'][level]||'基础规模';
  function mainStatus(v){
    if(!v.mainRoute){const p=v.progress;const missing=Math.max(0,p.routeRequired-Math.max(...Object.values(p.routeCompleted)));return missing?`任一路线还需${missing}期正式合同`:'可选择主营';}
    const r=v.routes[v.mainRoute];return `${levelName(r.effectiveLevel)}${r.pendingLevel!=null?` · 第${r.effectiveDay}天启用${levelName(r.pendingLevel)}`:''}${v.pendingMain?` · 第${v.pendingMain.day}天切换${name(v.pendingMain.route)}`:''}`;
  }
  function frontage(body){const v=view(),p=v.progress,staffMissing=Math.max(0,p.staffRequired-p.staffCompleted);body.append(row(v.mainRoute?`${name(v.mainRoute)}主营`:'主营经营',mainStatus(v),h('button.btn.small',{onclick:investments},'经营')),
    row(v.network?.managerActive?'店长接待':'店员',v.network?.managerActive?'可疑来货拒收':v.employee.hired?`预付余${v.employee.days}天${v.employee.pending?` · 次日${v.employee.pending.active?'开工':'暂停'}`:v.employee.days<=0?' · 待续聘':v.employee.active?'':' · 已暂停'}`:staffMissing?`还需${staffMissing}期正式合同`:'可以招聘，次日上岗',h('button.btn.small.paper',{onclick:employee},'照看')),
    row('经营安排',v.operations?.enabled?'已开启':v.operations?.reason||'尚未开启',h('button.btn.small.mint',{onclick:operations},'安排')));}
  function investments(){open('主营经营',(draw,close,host)=>{const v=view(),available=v.investments||[];return [h('div.machine-status',mainStatus(v)),v.mainRoute&&button(`切换为${name(v.mainRoute==='water'?'fish':'water')}主营`,'invest',{id:v.mainRoute==='water'?'switchFish':'switchWater'},draw),available.filter(i=>i.eligible).map(i=>row(i.name,`${i.cost}鱼币${i.description?' · '+i.description:''}`,button('投资','invest',{id:i.id},draw))),!available.some(i=>i.eligible)&&h('div.machine-status',available.find(i=>i.reason&&!i.reason.startsWith('已')&&(!v.mainRoute||i.id.startsWith(v.mainRoute)))?.reason||(v.mainRoute?'当前主营扩建完成':'继续完成正式合同以解锁扩产')),...(v.offers||[]).filter(o=>['harbor','boutique'].includes(o.kind)&&o.eligible).map(o=>row(`${name(o.route)}${kindName(o.kind)}`,`${o.qty}份 × ${o.price}`,h('button.btn.small',{onclick:()=>showOffer(o,draw,host)},'市场报价')))];});}
  function employee(){open('店员',draw=>{
    const v=view(),e=v.employee,manager=v.network?.managerActive,nextActive=e.pending?.active??e.active,missing=Math.max(0,v.progress.staffRequired-v.progress.staffCompleted);
    const status=manager?`中央本期已付费${e.hired?' · 原店员余'+e.days+'天':''}`:!e.hired?(missing?`还需${missing}期正式合同`:'首次入职，次日上岗'):`预付余${e.days}天${e.pending?' · 次日'+(e.pending.active?'开工':'暂停'):e.days<=0?' · 待续聘':e.active?' · 工作中':' · 已暂停'}`;
    return [h('div.business-row',img('assets/cats/worker.png'),h('div.grow',h('b',manager?'店长在岗':!e.hired?'招聘店员':e.days<=0?'待续聘':!e.active&&e.pending?.active?'次日上岗':e.active?'店员在岗':'店员已暂停'),h('div.machine-status',status))),h('div.machine-status',manager?'店长接待；可疑来货拒收。原店员按原委托代售。':v.operations?.enabled?'按经营安排照看供货；每天最多代售2件，未成交也计服务日。':'每天最多代售2件委托真货，夜里照看一条计划；没有成交也计服务日。'),!e.hired?button('招聘 · 入职80＋5天工资30','hire',{},draw,missing>0||G.S.money<110):h('div.list',button(manager?'续聘原店员5天 · 30':'续聘5天 · 30','renew',{},draw,G.S.money<30),button(manager?(nextActive?'次日暂停原店员':'次日恢复原店员'):(nextActive?'次日暂停':'次日恢复'),'employeePause',{paused:!!nextActive},draw)),(e.status||G.S.money<(e.hired?30:110)&&'鱼币不足')&&h('div.selection-status',e.status||'鱼币不足')];
  });}
  function delegate(original){
    let inspection='';
    open('交给店员',draw=>{
      const v=view(),it=G.allItems().find(i=>i.uid===original.uid)||original,delegated=v.employee.delegated.find(d=>d.uid===it.uid),amount=field('最低售价',delegated?.minPrice||Math.max(1,it.cost||1));
      const unknown=!it.known||(it.id==='water'&&!it.gk&&!WG[G.grade(it)]?.eye);
      const blocked=unknown?'先验明真货':it.id==='water'&&it.lab!=null&&it.lab>G.grade(it)?'水质与标签不符，不能委托':it.known&&it.fake?'赝品不能委托':it.stolenKnown&&it.stolen?'赃物不能委托':ITEMS[it.id].ban?'违禁品不能委托':!G.S.shelf.some(i=>i.uid===it.uid)?'先摆上货架':v.reservations[it.uid]?'已预留给合同':'';
      return [row(stockName(it),blocked||'只按实际买家的公开出价出售',unknown&&G.S.phase==='night'?h('button.btn.small.mint',{onclick:async()=>{const r=await execute('inspectStock',{uid:it.uid});if(r.ok){inspection=r.inspection.text;draw();}}},'验货'):null,`assets/items/${it.id}.png`),inspection&&h('div.selection-status',{role:'status'},inspection),amount,h('div.row',h('button.btn.mint',{disabled:!!blocked,onclick:async()=>{const r=await execute('delegate',{uid:it.uid,minPrice:Number(amount.querySelector('input').value),enabled:true});if(r.ok)draw();}},'确认委托'),button('收回委托','delegate',{uid:it.uid,enabled:false},draw))];
    });
  }
  const kindName=k=>({trial:'试单',regular:'固定客户',harbor:'港区大宗',boutique:'街区精品'}[k]||k);
  function showOffer(o,back,host){const draw=()=>{const current=view().offers.find(x=>x.route===o.route&&x.kind===o.kind)||o;fill(host,h('h2',`${name(o.route)}${kindName(o.kind)}`),h('div.scroll.business-content',h('div.order-status',h('b',`${current.qty}份 × ${current.price}`),h('span',`货款 ${current.qty*current.price}`)),h('div.machine-status',current.requirement),h('div.machine-status',`第${current.start}天开始，第${current.due}天截止`),h('div.machine-status',current.reason||`原料采购${current.rawCost}鱼币${current.filterCost?' · 滤芯'+current.filterCost+'点':''}`),h('div.machine-status',current.requiresRestart?'需要中途再次开工；请提前备料。':`加工${current.productionDays}晚；次晨到货后方可安排开工。`),['harbor','boutique'].includes(current.kind)&&h('div.machine-status',current.kind==='boutique'?'服务费60；第3、5天分别交一半，第二批第4天起可交。':'物流费60；本期替代主营固定客户。')),h('div.row',h('button.btn.paper',{onclick:back},'返回'),button('确认接单','acceptContract',{route:current.route,kind:current.kind},back,!current.eligible)));};draw();}
  function orders(host,close,legacy){const draw=()=>{const v=view();fill(host,h('h2','送货订单',closeX(close)),h('div.scroll.business-content',h('div.business-orders',(v.contracts||[]).filter(c=>c.status==='active').map(c=>row(`${name(c.route)} · ${kindName(c.kind)}`,`${c.requirement} · 已交${c.delivered||0}/${c.qty} · 第${c.due}天截止`,h('button.btn.small.mint',{onclick:()=>delivery(c,draw,host)},'交付'),icon(c.route)))),(v.offers||[]).filter(o=>o.visible).map(o=>row(`${name(o.route)} · ${kindName(o.kind)}`,`${o.requirement} · ${o.qty}份 ×${o.price} · 第${o.start}—${o.due}天`,h('button.btn.small.paper',{onclick:()=>showOffer(o,draw,host)},'报价'),icon(o.route))),h('button.btn.paper',{onclick:()=>{close();legacy();}},`临时订单 ${G.S.orders.length}`)));};draw();}
  function delivery(c,back,host){const selected=new Set(c.defaultUids||[]);const draw=()=>{const v=view(),current=v.contracts.find(x=>x.id===c.id)||c;const candidates=current.candidates||current.items||[];fill(host,h('h2',`${name(c.route)}交付`),h('div.scroll.business-content',h('div.order-status',h('b',`已交 ${current.delivered||0}/${current.qty}`),h('span',`每份${current.price}`)),h('div.machine-status',current.requirement),h('div.machine-status',G.S.day<current.start?`第${current.start}天起交付，可先预留备货。`:`可交${current.available}份 · 还需${Math.max(0,current.qty-current.delivered)}份${current.kind==='boutique'?' · 本批最多'+Math.max(0,current.qty/2-current.windows[G.S.day>=current.start+3?1:0])+'份':''}`),candidates.length?h('div.selection-grid',candidates.map(it=>h('button.choice'+(selected.has(it.uid)?'.sel':''),{'aria-pressed':selected.has(it.uid),onclick:()=>{selected.has(it.uid)?selected.delete(it.uid):selected.add(it.uid);draw();}},img(`assets/items/${it.id}.png`),it.name||G.itemName(it),it.location==='machine'&&h('small','机器成品')))):h('div.machine-status',`可交 ${current.available??current.deliverable??0} · 仍需 ${Math.max(0,current.qty-(current.delivered||0))}`)),h('div.row',h('button.btn.paper',{onclick:back},'返回'),button(selected.size?`交付${selected.size}件 · +${selected.size*current.price}`:'没有可交货物','deliverContract',{id:c.id,uids:[...selected]},back,!selected.size||G.S.day<current.start)),h('div.row',button('预留所选','reserve',{id:c.id,uids:[...selected]},draw,!selected.size),button('解除本单预留','release',{uids:Object.keys(v.reservations||{}).filter(uid=>v.reservations[uid]===c.id).map(Number)},draw,!Object.values(v.reservations||{}).includes(c.id))),h('button.btn.small.paper',{onclick:()=>fill(host,h('h2','中止合作？'),h('div.machine-status',current.requirement),h('div.machine-status',G.S.day<current.start?'尚未开始，已付客户费用退回。':'未交部分关闭，下一期恢复基础额度；已交款不追回。'),h('div.row',h('button.btn.paper',{onclick:draw},'保留合作'),button('确认中止','cancelContract',{id:c.id},back)))},'中止本期合作'));};draw();}
  function operations(){
    const current=view().operations;
    if(!current){toast('经营安排尚未准备好');return;}
    let draft={enabled:current.enabled,reserve:current.reserve,routes:{...current.routes}};
    modal(close=>{
      const host=h('div.sheet.business-sheet.operations-sheet');
      const draw=()=>{
        const op=view().operations,reserve=field('额外留用鱼币',draft.reserve,0),input=reserve.querySelector('input');
        const toggle=h('button.btn.'+(draft.enabled?'mint':'paper'),{'aria-pressed':String(draft.enabled),onclick:()=>{draft.enabled=!draft.enabled;draw();}},draft.enabled?'自动经营：开启':'自动经营：关闭');
        const floor=h('div.machine-status'),error=h('div.selection-status',{role:'status'});
        const save=h('button.btn.mint',{onclick:async()=>{
          const result=await execute('setOperations',{enabled:draft.enabled,reserve:Number(input.value),routes:{...draft.routes}});
          if(result.ok){toast('经营安排已保存');draft={enabled:view().operations.enabled,reserve:view().operations.reserve,routes:{...view().operations.routes}};draw();}
        }},'保存安排');
        const sync=()=>{
          draft.reserve=Number(input.value);
          const invalid=!Number.isSafeInteger(draft.reserve)||draft.reserve<0;
          floor.textContent=invalid?'':`保护现金 ${Math.max(0,(op.cashFloor||0)-(op.reserve||0))+draft.reserve}（含房租）`;
          error.textContent=invalid?'留用金额须为非负整数':'';
          save.disabled=!!error.textContent;
        };
        input.addEventListener('input',sync);
        const routeFields=['water','fish'].map(route=>{
          const opts=op.options[route]||[],selected=opts.find(o=>o.kind===draft.routes[route]);
          const select=h('select',{'aria-label':`${name(route)}客户`,onchange:e=>{draft.routes[route]=e.target.value;draw();}},
            h('option',{value:'off'},'不再续单'),opts.map(o=>h('option',{value:o.kind,disabled:!o.eligible},`${kindName(o.kind)}${!o.eligible?' · '+o.reason:''}`)));
          select.value=draft.routes[route];
          return h('div.operations-route',h('label',name(route),select),selected?h('div.operations-quote',
            h('b',`${selected.qty}份×${selected.revenue/selected.qty} · 预计回款${selected.revenue}`),
            h('span',`原料${selected.rawCost} · 滤芯${selected.filterExpense||0}${selected.filterCost?'（'+selected.filterCost+'点）':''} · 服务费${selected.fee||0}`),
            selected.text&&h('span',`${selected.days}日一期 · ${selected.text}`),!selected.eligible&&h('span',selected.reason)
          ):null);
        });
        const period=op.period,previous=op.previousPeriod,hasReport=p=>p&&['income','spending','deliveries','productionStarts','purchases'].some(k=>p[k]>0);
        fill(host,h('h2','经营安排',closeX(close)),h('div.scroll.business-content',
          toggle,reserve,floor,h('div.machine-status',draft.enabled?'自动续单、备料、补滤芯、续聘并生产交货。':'关闭自动操作，已有合同保留。'),
          routeFields,h('div.machine-status','不续单仍交旧单；关闭总开关才全停。'),
          !op.available&&op.reason&&!op.issues?.some(i=>i.text===op.reason)&&h('div.selection-status',op.reason),
          op.issues?.length?h('div.operations-issues',{role:'status'},op.issues.map(i=>h('div',i.text))):null,
          hasReport(previous)&&h('div.machine-status',`上期托管：回款${previous.income} · 支出${previous.spending}`),
          hasReport(period)&&h('div.operations-period',h('div.machine-status',`第${period.start}—${period.end}天`),
            h('div.stat',h('span','托管回款'),h('b',String(period.income))),h('div.stat',h('span','托管支出'),h('b',String(period.spending))))
        ),error,h('div.row',G.S.phase==='night'&&h('button.btn.paper',{onclick:()=>{close();sleep();}},'只过一晚'),save));
        sync();
      };draw();return host;
    },{onClose:refresh});
  }
  function ledger(body){const v=view(),entries=(v.ledger||[]).filter(e=>e.period===v.period.id),l={income:entries.reduce((n,e)=>n+Math.max(0,e.amount),0),costs:entries.reduce((n,e)=>n+Math.max(0,-e.amount),0)};l.net=l.income-l.costs;const margin=entries.filter(e=>['contract','retail','employee','fence'].includes(e.type)).reduce((n,e)=>n+e.amount-(e.cost||0),0);body.prepend(h('div.business-ledger',h('div.stat',h('span','本期现金入账'),h('b',String(l.revenue??l.income??0))),h('div.stat',h('span','本期现金支出'),h('b',String(l.cost??l.costs??0))),h('div.stat',h('span','本期现金净额'),h('b',String(l.profit??l.net??0))),h('div.stat',h('span','已售货物毛利'),h('b',String(margin)))));}
  return {operations,suppliers,workshop,machineActions,frontage,ledger,orders,warehouse,delegate};
}
