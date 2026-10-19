"""Render the selected unit review as one self-contained offline document."""
import base64
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT/'selection.json').read_text(encoding='utf-8'))
esc = lambda value: html.escape(str(value), quote=True)

def portrait(unit):
    png = base64.b64encode((ROOT/unit['preview']).read_bytes()).decode()
    return f'<div class="portrait"><img src="data:image/png;base64,{png}" alt="{esc(unit["name"])}"></div><strong>{esc(unit["name"])}</strong>'

def row(unit, main=False):
    rarity = unit['rarity']
    search = ' '.join(str(unit.get(k,'')) for k in ['id','name','faction','rarity','role','source','reason']) + ' ' + ' '.join(s['effect'] for s in unit['stars'])
    attrs = f' data-id="{esc(unit["id"])}" data-faction="{esc(unit["faction"])}" data-rarity="{esc(rarity)}" data-search="{esc(search)}"' if main else ''
    cells = [f'<th scope="row" class="identity">{portrait(unit)}</th>', f'<td class="meta"><b class="rarity r{esc(rarity)}">{esc(rarity)}</b><div>{esc(unit["faction"])}</div><div>{esc(unit["role"])}</div></td>']
    for star in unit['stars']:
        cells.append(f'<td class="star" data-level="{star["level"]}"><b class="mobile-label">{["一星","二星","三星"][star["level"]-1]}</b><b class="stats">攻击 {esc(star["atk"])} / 生命 {esc(star["hp"])}</b><p>{esc(star["effect"])}</p></td>')
    if not unit['stars']:
        cells.append('<td colspan="3">'+esc(unit['role'])+'</td>')
    return f'<tbody class="unit"{attrs}><tr>'+''.join(cells)+f'</tr><tr class="mapping"><td colspan="5"><code>{esc(unit["source"])}</code><span>{esc(unit["reason"])}</span></td></tr></tbody>'

def table(units, ident):
    return f'<table id="{ident}"><colgroup><col style="width:15%"><col style="width:13%"><col style="width:24%"><col style="width:24%"><col style="width:24%"></colgroup><thead><tr><th>单位</th><th>品质与职责</th><th>一星</th><th>二星</th><th>三星</th></tr></thead>'+''.join(row(u,ident=='cards') for u in units)+'</table>'

cards = [u for u in data['units'] if u['kind']=='card']
tokens = [u for u in data['units'] if u['kind']=='token']
others = [u for u in data['units'] if u['kind'] not in ['card','token']]
options = lambda values: ''.join(f'<option>{esc(x)}</option>' for x in dict.fromkeys(values))
page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>奇兵列阵 · 单位评审</title><style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#20262c;font:16px/1.6 "Microsoft YaHei",sans-serif}main{max-width:1480px;margin:auto;padding:24px 28px 64px}h1{font-size:28px;line-height:1.3;margin:0 0 12px}h2{font-size:22px;margin:36px 0 14px}p{margin:6px 0 0}.intro{max-width:900px;margin-bottom:20px;color:#454f59}.controls{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin:18px 0 12px}.controls label{display:grid;gap:4px}.controls input,.controls select,button{font:inherit;min-height:44px;padding:8px 12px;border:0;border-radius:4px;background:#eef1f4;color:#20262c}.controls input{width:300px}.controls select{min-width:130px}button{background:#244d70;color:white;cursor:pointer;padding-inline:22px}button:hover{background:#173b5a}:focus-visible{outline:3px solid #1766b0;outline-offset:3px}#count{margin:0 0 14px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;vertical-align:top;padding:16px 14px;overflow-wrap:anywhere}thead{background:#edf0f3}thead th{font-weight:600}.identity strong{display:block;margin-top:6px}.portrait{width:112px;height:112px;background:#292d34;display:flex;align-items:center;justify-content:center}.portrait img{max-width:108px;max-height:108px;object-fit:contain;image-rendering:pixelated}.meta div{margin-top:4px}.rarity{display:inline-block}.r普通{color:#4d565f}.r稀有{color:#176196}.r史诗{color:#7d3c9d}.r传说{color:#986000}.stats{display:block;font-weight:600;font-variant-numeric:tabular-nums}.star p{white-space:pre-wrap}.mapping td{padding-top:0;padding-bottom:18px;border-bottom:1px solid #cfd5db;color:#505a64}.mapping code{display:inline-block;font:14px/1.5 Consolas,monospace;margin-right:18px;color:#363e46}.mapping span{font-size:15px}.mobile-label{display:none}.unit[hidden]{display:none}#empty{padding:28px 0;font-weight:600}.compact .identity{width:200px}.compact td{border-bottom:1px solid #cfd5db}.compact code{font:14px/1.5 Consolas,monospace}.compact p{margin-top:8px}section{scroll-margin-top:12px}
@media(max-width:950px){main{padding:20px 16px 40px}h1{font-size:25px}table,tbody,tr,td,th{display:block}colgroup,thead{display:none}.unit{padding-top:18px}.unit>tr:first-child{display:grid;grid-template-columns:140px 1fr}.identity,.meta{padding:0 10px 14px 0}.star{grid-column:1/-1;display:grid;grid-template-columns:62px 1fr;gap:0 10px;padding:12px 0;background:#f4f6f8}.star+.star{border-top:1px solid #dde2e7}.mobile-label{display:block;grid-row:1/3;padding-left:12px}.star p{grid-column:2;margin-right:12px}.stats{grid-column:2}.mapping td{padding:12px 0 20px}.mapping code,.mapping span{display:block}.mapping span{margin-top:5px}.compact tr{display:grid;grid-template-columns:140px 1fr}.compact th{width:auto!important}.compact td{padding:0 0 18px}.controls{gap:10px}.controls input{width:300px;max-width:100%}.controls label:first-child{flex:1 1 100%}.controls input{width:100%}.controls select{min-width:112px}.intro{margin-bottom:14px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style><main><h1>奇兵列阵 · 单位评审</h1><p class="intro">设计 __VERSION__ · 首测方案未实装；所有指定均在备战完成。</p><form class="controls" role="search" onsubmit="return false"><label>搜索主表<input id="search" type="search" placeholder="名称、职责、技能或素材名"></label><label>阵营<select id="faction"><option value="">全部阵营</option>__FACTIONS__</select></label><label>品质<select id="rarity"><option value="">全部品质</option>__RARITIES__</select></label><button type="reset">重置</button></form><p id="count" role="status" aria-live="polite">56 / 56 个单位</p><section aria-label="可招募单位">__CARDS__<p id="empty" hidden>没有符合条件的单位。请调整筛选或重置。</p></section><section><h2>召唤物</h2>__TOKENS__</section><section><h2>敌军与将军映射</h2><table class="compact"><thead><tr><th>对象</th><th>素材与选择理由</th></tr></thead>__OTHERS__</table></section></main><script>
const rows=[...document.querySelectorAll('#cards .unit')],q=document.querySelector('#search'),f=document.querySelector('#faction'),r=document.querySelector('#rarity');function filter(){let count=0;for(const row of rows){row.hidden=!!((q.value.trim()&&!row.dataset.search.toLowerCase().includes(q.value.trim().toLowerCase()))||(f.value&&row.dataset.faction!==f.value)||(r.value&&row.dataset.rarity!==r.value));if(!row.hidden)count++}document.querySelector('#count').textContent=count+' / '+rows.length+' 个单位';document.querySelector('#empty').hidden=count!==0;document.querySelector('#cards').hidden=count===0}q.addEventListener('input',filter);f.addEventListener('change',filter);r.addEventListener('change',filter);document.querySelector('form').addEventListener('reset',()=>setTimeout(filter,0));
</script></html>'''
def compact_rows(units):
    return ''.join(f'<tbody><tr><th scope="row" class="identity">{portrait(u)}</th><td><strong>{esc(u["faction"])} · {esc(u["role"])}</strong><p><code>{esc(u["source"])}</code></p><p>{esc(u["reason"])}</p></td></tr></tbody>' for u in units)
other_rows = compact_rows(others)
token_table = '<table id="tokens" class="compact"><thead><tr><th>召唤物</th><th>职责与素材</th></tr></thead>'+compact_rows(tokens)+'</table>'
for token, value in {'__VERSION__':esc(data['designVersion']),'__FACTIONS__':options(u['faction'] for u in cards),'__RARITIES__':options(u['rarity'] for u in cards),'__CARDS__':table(cards,'cards'),'__TOKENS__':token_table,'__OTHERS__':other_rows}.items():
    page=page.replace(token,value)
(ROOT/'review.html').write_text(page,encoding='utf-8')
print(f'Rendered {len(cards)} cards, {len(tokens)} tokens, {len(others)} other mappings')
