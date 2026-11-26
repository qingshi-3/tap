(() => {
  const lib=globalThis.DuelystLibrary,events=globalThis.DuelystOriginalEvents;
  const labels={UnitAttackedFX:'普攻',UnitPrimaryAttackedFX:'显式攻击附加',SpellCastFX:'施法',SpellAppliedFX:'目标生效'};
  const el=id=>document.getElementById(id), node=(tag,text,cls)=>{const part=document.createElement(tag);if(text)part.textContent=text;if(cls)part.className=cls;return part};
  const playLabels = new Map([['full', '播放完整合成'], ['partial', '播放部分合成']]);
  const subjects = new Map();
  for (const row of globalThis.CompositeCoverage || []) {
    if (!row || !['unit', 'icon'].includes(row.type) || !row.id || !row.card || !row.event) continue;
    const playLabel = playLabels.get(row.status);
    if (!playLabel) continue;
    const key = row.type + '/' + row.id;
    if (!subjects.has(key)) subjects.set(key, new Map());
    const params = new URLSearchParams({type:row.type, id:row.id, card:row.card, event:row.event});
    subjects.get(key).set(params.toString(), {
      card:row.card, event:row.event,
      label:row.card + ' · ' + (labels[row.event] || row.event),
      playLabel,
      href:'合成预览.html?' + params
    });
  }
  function choices(type, id) {
    return Array.from(subjects.get(type + '/' + id)?.values() || []);
  }
  function bindLink(anchor, choice) {
    anchor.href = choice.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.setAttribute('aria-label', choice.playLabel + ' · ' + choice.label + '（新窗口）');
    anchor.title = anchor.getAttribute('aria-label');
  }
  globalThis.DuelystCompositeLinks = {choices, bindLink};
  if (!el('results')) return;

  const size=10;let page=0,views=[];
  const index=events.map(record=>{const item=lib.get(record.type,record.id);return [record,[item.name,item.note,item.id,record.card,record.fxKey,record.event,labels[record.event],...record.layers.flatMap(layer=>[layer.key,layer.id,lib.get('fx',layer.id).name])].join(' ').toLowerCase()]});
  function tile(type,id,label,detail,choice){const box=node('div',null,'tile'),pic=node(choice?'a':'div',null,'pic');if(choice)bindLink(pic,choice);const view=lib.createPreview(type,id,type==='unit'?'attack':'idle',1);if(view){views.push(view);pic.append(view.element)}else pic.textContent='源码条目';box.append(pic,node('b',label),node('div',detail));return box}
  function card(record){const item=lib.get(record.type,record.id),article=node('article'),row=node('div',null,'row');article.append(node('h2',item.name+' · '+labels[record.event]),node('p',record.card+' → '+record.fxKey+' / '+record.event));const choice = choices(record.type, item.id).find(entry => entry.card === record.card && entry.event === record.event);
    if (choice) {
      const link = node('a', '▶ ' + choice.playLabel);
      bindLink(link, choice);
      article.append(link);
    }
    row.append(tile(record.type,item.id,record.type==='unit'?'攻击动作':'技能图标',item.id,choice));
    for(const layer of record.layers){const lane=layer.route.includes('.impactFX')?'命中':layer.route.includes('.emitFX')?'随附效果':layer.nodeType==='Projectile'?'弹体':labels[record.event];row.append(tile('fx',layer.id,lane+(layer.alternative===null?'':' · 候选 '+(layer.alternative+1)),layer.key))}
    if(choice && record.id==='boss_skyfalltyrant' && record.event==='UnitAttackedFX'){
      const link=node('a',' · 查看爪痕落点示例');link.href='Skyfall攻击示例.html';article.append(link)
    }
    if(choice && (record.id==='boss_skyfalltyrant'||record.card==='Cards.BossSpell.LaceratingFrost')){const link=node('a','　▶ 同屏比较：普攻与撕裂寒霜');link.href='Skyfall双演出.html';article.append(link)}
    const sources=[...new Set([...record.sources,...record.layers.flatMap(layer=>['app/data/fx.js:'+layer.line,'app/data/resources.js:'+layer.registration])])];article.append(row,node('small',sources.join(' · ')));return article}
  function render(){views.forEach(view=>view.dispose());views=[];const term=el('query').value.trim().toLowerCase(),kind=el('kind').value;const rows=index.filter(([r,words])=>(!kind||r.type===kind)&&words.includes(term));const pages=Math.max(1,Math.ceil(rows.length/size));el('count').textContent=rows.length+' 条事件';el('page').textContent=(page+1)+' / '+pages;el('prev').disabled=page===0;el('next').disabled=page>=pages-1;el('results').replaceChildren(...rows.slice(page*size,(page+1)*size).map(([record])=>card(record)));if(!rows.length)el('results').textContent='尚无已核实的对应关系。'}
  el('query').oninput=el('kind').onchange=()=>{page=0;render()};el('prev').onclick=()=>{page--;render()};el('next').onclick=()=>{page++;render()};render();
})();
