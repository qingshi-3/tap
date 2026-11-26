const library=globalThis.DuelystLibrary, titles={unit:'单位',fx:'特效',icon:'图标'}, roles=['起手','弹道','命中','持续','技能图标','其他'];
const pageSize=30, storeKey='duelyst-personal-asset-links-v1', documentNode=id=>document.getElementById(id);
let kind='unit', group='', term='', page=0, focus=null, role='命中', manual=[], previews=[];
const node=(tag,text,cls)=>{const part=document.createElement(tag);if(text!==undefined)part.textContent=text;if(cls)part.className=cls;return part};
const button=(label,click,pressed)=>{const element=node('button',label);element.onclick=click;if(pressed!==undefined)element.setAttribute('aria-pressed',String(pressed));return element};
const validRef=ref=>ref&&Object.hasOwn(titles,ref.type)&&typeof ref.id==='string'&&!!library.get(ref.type,ref.id);
const validLink=link=>link&&validRef(link.from)&&validRef(link.to)&&roles.includes(link.role)&&['unit','icon'].includes(link.from.type)&&['fx','icon'].includes(link.to.type)&&!(link.from.type===link.to.type&&link.from.id===link.to.id);
const key=link=>JSON.stringify([link.from.type,link.from.id,link.role,link.to.type,link.to.id]);
function notify(text){documentNode('message').textContent=text}
function gradeEditor(item){const group=node('div',undefined,'actions');group.style.flexBasis='100%';group.setAttribute('role','group');group.setAttribute('aria-label',`${item.id} 分档`);for(const grade of [1,2,3,4,5,null]){const label=grade?String(grade):'待设置';const choice=button(label,()=>{DuelystGrades.set(item,grade);documentNode('gradeStatus').textContent=`${item.name}：${grade?grade+' 档':label}。${DuelystGrades.status()}`;draw()},DuelystGrades.gradeOf(item)===grade);choice.setAttribute('aria-label',grade?grade+' 档':label);group.append(choice)}return group}
documentNode('gradesExport').onclick=()=>{const link=node('a');const url=URL.createObjectURL(new Blob([JSON.stringify(DuelystGrades.exportRows(),null,2)],{type:'application/json'}));link.href=url;link.download='Duelyst-单位全量分档.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),15000)};
documentNode('gradesImport').onclick=()=>documentNode('gradesFile').click();documentNode('gradesFile').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const count=DuelystGrades.load(JSON.parse(await file.text()));documentNode('gradeStatus').textContent=`已导入 ${count} 项分档。${DuelystGrades.status()}`;draw()}catch{documentNode('gradeStatus').textContent='清单中的文件名或分档无效，原记录已保留。'}event.target.value=''};
try{const prior=JSON.parse(localStorage.getItem(storeKey)||'[]');if(Array.isArray(prior))manual=prior.filter(validLink)}catch{notify('本地记录读取失败，可从先前导出的文件恢复。')}
function save(){try{localStorage.setItem(storeKey,JSON.stringify(manual));notify(`已保存 ${manual.length} 条个人选配。`)}catch{notify('当前会话已更新，请导出 JSON 保存。')}}
function setKind(next){kind=next;page=0;group='';term='';documentNode('query').value='';draw()}
function showAsset(ref){kind=ref.type;group='';page=0;term=ref.id.toLowerCase();documentNode('grade').value='';documentNode('visual').checked=false;documentNode('query').value=ref.id;draw();documentNode('topPager').scrollIntoView()}
function choose(type,id){focus={type,id};role='命中';setKind('fx');documentNode('selection').scrollIntoView({block:'start'})}
function connect(type,id){if(!focus)return;const entry={from:{...focus},role,to:{type,id}};if(!validLink(entry)||manual.some(record=>key(record)===key(entry)))return;manual.push(entry);save();draw()}
function addSample(row,ref){const view=library.createPreview(ref.type,ref.id,'attack',1)||library.createPreview(ref.type,ref.id,'idle',1);if(!view)return;previews.push(view);view.element.style.maxWidth='110px';view.element.style.maxHeight='90px';view.element.style.objectFit='contain';row.append(view.element)}
function drawFocus(){
  const target=documentNode('target'),slots=documentNode('slots'),links=documentNode('links');target.replaceChildren();slots.replaceChildren();links.replaceChildren();
  if(!focus){target.textContent='在单位或图标卡片点「选作主体」，再到特效或图标页手动添加。';for(const record of new Map(manual.map(entry=>[JSON.stringify(entry.from),entry.from])).values())links.append(button(`已选配 · ${library.get(record.type,record.id).name}`,()=>choose(record.type,record.id)));return}
  const line=node('div',undefined,'line');addSample(line,focus);line.append(node('b',`${titles[focus.type]} · ${library.get(focus.type,focus.id).name}`),button('清除所选主体',()=>{focus=null;draw()}));target.append(line);slots.append(node('small','关联位置：'));for(const tag of roles)slots.append(button(tag,()=>{role=tag;draw()},role===tag));
  for(const ref of library.get(focus.type,focus.id).cardRefs||[]){const evidence=node('div',undefined,'source');evidence.textContent=`原作卡牌 ${ref.card}${ref.fxKeys?.length?' · 演出配置 '+ref.fxKeys.join('、'):''}〔${ref.source}〕`;target.append(evidence)}
  for(const record of manual.filter(entry=>entry.from.type===focus.type&&entry.from.id===focus.id)){const row=node('div',undefined,'line');addSample(row,record.to);row.append(node('small',`个人选配 · ${record.role} → ${titles[record.to.type]} / ${library.get(record.to.type,record.to.id).name}`),button('查看素材',()=>showAsset(record.to)),button('移除此条',()=>{manual=manual.filter(entry=>key(entry)!==key(record));save();draw()}));links.append(row)}
}
function drawPager(id,total){const bar=documentNode(id);bar.replaceChildren();const pages=Math.max(1,Math.ceil(total/pageSize));const previous=button('上一页',()=>{page--;draw();documentNode('topPager').scrollIntoView()}),next=button('下一页',()=>{page++;draw();documentNode('topPager').scrollIntoView()});previous.disabled=page===0;next.disabled=page+1>=pages;bar.append(previous,node('span',`${page+1} / ${pages}`),next)}
const selectedComposite = new Map();
function compositeControls(item, art, entries) {
  const controls = node('div', undefined, 'composite');
  const link = node('a');
  const key = kind + '/' + item.id;
  function select(entry) {
    DuelystCompositeLinks.bindLink(art, entry);
    DuelystCompositeLinks.bindLink(link, entry);
    link.textContent = '▶ ' + entry.playLabel;
  }
  const index = selectedComposite.get(key) ?? 0;
  if (entries.length > 1) {
    const picker = node('select');
    picker.setAttribute('aria-label', item.name + ' · 选择卡牌和事件');
    for (const entry of entries) picker.append(node('option', entry.label));
    picker.selectedIndex = index;
    picker.onchange = () => {
      selectedComposite.set(key, picker.selectedIndex);
      select(entries[picker.selectedIndex]);
    };
    controls.append(picker);
  }
  select(entries[index]);
  controls.append(link);
  return controls;
}
function display(item){
  const entries = DuelystCompositeLinks.choices(kind, item.id);
  const card = node('article');
  const art = node(entries.length ? 'a' : 'div', undefined, 'art');
  const body = node('div', undefined, 'body');
  if(kind==='unit'){for(const action of [item.actions.loop&&!item.actions.idle?'loop':'idle','attack']){const slot=node('div',undefined,'slot'),view=library.createPreview(kind,item.id,action,1);if(view){previews.push(view);slot.append(view.element)}else slot.append(node('span',Object.keys(item.actions).length?'无此动作':'待补图'));slot.append(node('small',action==='idle'?'待机':action==='loop'?'原作循环':'攻击'));art.append(slot)}}else{const view=library.createPreview(kind,item.id);if(view){previews.push(view);art.append(view.element)}else art.append(node('span','资源记录 · 暂无预览','tag'))}body.append(node('div',`${titles[kind]} / ${item.group}${kind==='unit'?' · '+(DuelystGrades.gradeOf(item)??'待设置')+ (DuelystGrades.gradeOf(item)?' 档':''):''}`,'tag'),node('h2',item.name,'name'));if(item.name!==item.id)body.append(node('div',item.id,'tag'));if(item.note)body.append(node('p',item.note,'note'));body.append(node('p',item.source,'source'));
  if (entries.length) body.append(compositeControls(item, art, entries));
  if (kind === 'unit') {
    const preview = node('a', '打开单位演出');
    preview.href = '单位演出.html?' + new URLSearchParams({id:item.id});
    preview.target = '_blank';
    preview.rel = 'noopener';
    body.append(preview);
  }
  const actions=node('div',undefined,'actions');if(kind==='unit'||kind==='icon')actions.append(button('选作主体',()=>choose(kind,item.id)));if(focus&&kind!=='unit'&&(focus.type!==kind||focus.id!==item.id)){const found=manual.some(record=>key(record)===key({from:focus,to:{type:kind,id:item.id},role}));const add=button(found?'已添加':`加到「${role}」`,()=>connect(kind,item.id));add.disabled=found;actions.append(add)}if(kind==='unit')actions.prepend(gradeEditor(item));body.append(actions);card.append(art,body);return card}
function draw(){for(const view of previews)view.dispose();previews=[];documentNode('gradeFilter').hidden=kind!=='unit';documentNode('previewFilter').hidden=kind!=='fx';documentNode('gradesIO').hidden=kind!=='unit';drawFocus();const tabs=documentNode('tabs');tabs.replaceChildren();for(const [type,title] of Object.entries(titles))tabs.append(button(`${title} ${library.list(type).length}`,()=>setKind(type),kind===type));const list=library.list(kind),groups=documentNode('groups');groups.replaceChildren();for(const name of ['',...new Set(list.map(item=>item.group))])groups.append(button(name||'全部分类',()=>{group=name;page=0;draw()},group===name));const filtered=list.filter(item=>(kind!=='unit'||!documentNode('grade').value||(documentNode('grade').value==='pending'?DuelystGrades.gradeOf(item)===null:DuelystGrades.gradeOf(item)===Number(documentNode('grade').value)))&&(kind!=='fx'||!documentNode('visual').checked||item.preview)&&(!group||item.group===group)&&(!term||[item.id,item.name,item.group,item.source, kind==='unit'?`${DuelystGrades.gradeOf(item)??'待设置'}${DuelystGrades.gradeOf(item)?'档':''}`:'',item.note||''].join(' ').toLowerCase().includes(term)));page=Math.min(page,Math.max(0,Math.ceil(filtered.length/pageSize)-1));documentNode('stats').textContent=`${filtered.length} 个结果`+(kind==='unit'?` · 待设置 ${list.filter(row=>DuelystGrades.gradeOf(row)===null).length}`:'');drawPager('topPager',filtered.length);drawPager('bottomPager',filtered.length);documentNode('grid').replaceChildren(...filtered.slice(page*pageSize,(page+1)*pageSize).map(display))}
for(const filter of ['visual','grade'])documentNode(filter).onchange=()=>{page=0;draw()};
documentNode('query').oninput=event=>{term=event.target.value.trim().toLowerCase();page=0;draw()};
documentNode('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,kind:'personal',links:manual},null,2)],{type:'application/json'}));const link=node('a');link.href=url;link.download='Duelyst-个人选配.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),15000)};
documentNode('import').onclick=()=>documentNode('file').click();documentNode('file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.version!==1||data.kind!=='personal'||!Array.isArray(data.links)||!data.links.every(validLink))throw Error();const merged=new Map([...manual,...data.links].map(record=>[key(record),record]));manual=[...merged.values()];save();draw()}catch{notify('文件格式或资源 ID 无效，原有选配已保留。')}event.target.value=''};
for(const record of library.original){const section=node('div',undefined,'evidence');section.append(node('b',record.title),node('p',record.summary));for(const ref of record.assets||[])section.append(button(`查看${titles[ref.type]} · ${library.get(ref.type,ref.id).name}`,()=>showAsset(ref)));for(const source of record.sources)section.append(node('div',source,'source'));documentNode('evidence').append(section)}
const initialParams = new URLSearchParams(location.search);
if (initialParams.get('assetType') === 'fx') {
  const item = library.get('fx',initialParams.get('assetId'));
  if (item) showAsset({type:'fx',id:item.id});
  else setKind('fx');
} else draw();
