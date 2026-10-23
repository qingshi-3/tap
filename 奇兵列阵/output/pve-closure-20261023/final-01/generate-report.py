import json,collections,pathlib,statistics
P=pathlib.Path(__file__).parent
runs=[json.loads(line) for line in (P/'runs.jsonl').open(encoding='utf8')]
by={r['runId']:r for r in runs}
modes=json.loads((P/'manifest.json').read_text(encoding='utf8'))['modes']
mechanism={m:{'winningRuns':0,'runsWithMechanism':set(),'winBattles':0,'qualifyingWinBattles':0,'metrics':collections.Counter(),'sourceDamageLog':collections.Counter(),'castsByDef':collections.Counter(),'triggers':collections.Counter(),'examples':[]}for m in modes}
markers={'multi':'extraActions','splash':'splashDamage','burn':'burnDamage','rotation':'rotations','duel':'duelKills','spell':'casts','retaliation':'thornsDamage','shield':'blocks','sacrifice':'sacrifices','summon':'summons','frost':'freezes'}
for r in runs:
 if r['clear']:mechanism[r['mode']]['winningRuns']+=1
for line in (P/'battles.jsonl').open(encoding='utf8'):
 b=json.loads(line);r=by[b['runId']]
 if not r['clear'] or b['result']!='win':continue
 m=b['mode'];a=mechanism[m];a['winBattles']+=1;a['metrics'].update(b['metrics'] or {});a['sourceDamageLog'].update(b['mechanism'].get('sourceDamage',{}));a['castsByDef'].update(b['mechanism'].get('castsByDef',{}));a['triggers'].update(b['mechanism'].get('triggers',{}))
 qualifies=(b['metrics']or {}).get(markers.get(m,''),0)>0
 if m=='shield':qualifies=qualifies and b['mechanism'].get('sourceDamage',{}).get('l_lion:attack',0)>0
 if m=='spell':qualifies=any(n>0 and k in ['a_devour','s_dart','a_chanter','s_caster','d_shriek','a_engulf']for k,n in b['mechanism'].get('castsByDef',{}).items())
 if qualifies:
  a['runsWithMechanism'].add(b['runId']);a['qualifyingWinBattles']+=1
  if len(a['examples'])<3:a['examples'].append({'runId':b['runId'],'attempt':b['attempt'],'chapter':b['chapter'],'node':b['node'],'mechanism':b['mechanism'],'metrics':b['metrics']})
aggregate=[]
for m in modes:
 a=[r for r in runs if r['mode']==m];mech=mechanism[m];mech['runsWithMechanism']=sorted(mech['runsWithMechanism'])
 stages=[{'chapter':i+1,'chapterReached':sum(r['stages'][i]['reached']for r in a),'bossReached':sum(r['stages'][i]['bossReached']for r in a),'passed':sum('win'in r['stages'][i]['bossResults']for r in a),'everFormedBeforeBossOrTermination':sum(r['stages'][i]['everFormedAtFirstBoss']for r in a),'stillFormedAtFirstBoss':sum(r['stages'][i]['formedAtFirstBoss']for r in a)}for i in range(3)]
 row={'mode':m,'n':len(a),'clear':sum(r['clear']for r in a),'clearRate':sum(r['clear']for r in a)/len(a),'firstThreePassed':sum(r['early']==['win']*3 for r in a),'everFormed':sum(r['firstFormation']is not None for r in a),'lastStillFormed':sum(bool(r['last']['formation']and r['last']['formation']['basicReady'])for r in a),'stages':stages,'drawStop':sum(r['termination']=='draw-stop'for r in a),'terminations':dict(collections.Counter(r['termination']for r in a)),'switched':sum(bool(r.get('closure',{}).get('switched'))for r in a),'bridgeRuns':sum(any(b['phase']=='bridge'for b in (r.get('closure')or{}).get('battles',[]))for r in a),'faults':sum(r['faults']for r in a),'failedActions':sum(r['failedActions']for r in a),'budgetErrors':sum(r['budgetErrors']for r in a),'unknownLineages':sum(r['unknownLineages']for r in a),'structuralViolations':sum(r['structuralViolations']for r in a),'actualViolations':sum(r['actualViolations']for r in a),'winningRunMechanism':mech}
 aggregate.append(row)
summ=json.loads((P/'summary.json').read_text(encoding='utf8'))
result={'samples':len(runs),'modes':aggregate,'sourceChanges':summ['changed'],'firstThreePassed':sum(x['firstThreePassed']for x in aggregate),'directedMedianClearRate':statistics.median(x['clearRate']for x in aggregate if x['mode']not in ['casual','anti3']),'note':'Mechanism sourceDamageLog is raw logged damage, not effective enemy damage. Current formation is not latched; ever includes termination for nonarrivals.'}
(P/'aggregate.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
lines=['# 冻结最终416局','', '13组各32个全新合法seed/主将组合，四将各8，共享同一32组合，normal路线。seed-audit扫描历史json/jsonl中的3867个不同seed值，新增组合与之无交集；没有按结果丢样本、改标准或调整策略。产品仍0.12.1。', '', '策略先合法贪心获取真实三角色成型，再从下一决策永久转向旧同方向战力策略；召唤在没有实际继承来源时用公开战体过渡。casual与anti3保留原策略，二者行为不同，不把通关差归因为三人联动限制。', '', '|方向|一章通过|二章通过|全通|曾成型|二章首领前曾成型|首三战全胜|平局截断|切换/过渡|', '|---|---:|---:|---:|---:|---:|---:|---:|---:|']
for x in aggregate:
 m=x['mode'];direct=m not in ['casual','anti3'];lines.append('|'+ '|'.join([m,str(x['stages'][0]['passed'])+'/32',str(x['stages'][1]['passed'])+'/32',str(x['clear'])+'/32',str(x['everFormed'])+'/32'if direct else '—',str(x['stages'][1]['everFormedBeforeBossOrTermination'])+'/32'if direct else '—',str(x['firstThreePassed'])+'/32',str(x['drawStop'])+'/32',str(x['switched'])+'/'+str(x['bridgeRuns'])if direct else '—'])+'|')
lines+=['', '曾成型口径：截至首次首领；未到达则截至实际终止，始终以全部开局为分母。仍成型另按实际到达首领统计，不能用曾经成型冒充当前阵容。', '', '|方向|一章首领仍成型/到达|二章首领仍成型/到达|三章首领仍成型/到达|末战仍成型|', '|---|---:|---:|---:|---:|']
for x in aggregate:
 if x['mode']in ['casual','anti3']:continue
 lines.append('|'+x['mode']+'|'+'|'.join(str(s['stillFormedAtFirstBoss'])+'/'+str(s['bossReached'])for s in x['stages'])+'|'+str(x['lastStillFormed'])+'/32|')
lines+=['', '## 获胜远征内的真实方向事件','', '下表只统计最终通关远征中的获胜战斗。每方向的示例runId/节点、玩家触发、专属来源施法、来源伤害日志值保存在aggregate.json的winningRunMechanism；原始逐战记录可复核。事件发生证明该方向实际参与，不证明每个胜利都由它单独造成，也不把sourceDamageLog称为有效伤害。护盾项为同场蔚蓝雄狮攻击日志与玩家消盾，未保存逐单位消盾归因，不能单独认证每层转攻贡献。', '', '|方向|有对应事件的通关远征/通关远征|对应获胜战斗数|事件口径|', '|---|---:|---:|---|']
labels={'multi':'追击','splash':'溅射','burn':'灼烧','rotation':'轮换/换位','duel':'决斗击败对手','spell':'真实伤害法师施法','retaliation':'反伤','shield':'雄狮攻击日志且本方消盾','sacrifice':'献祭','summon':'召唤','frost':'敌方冻结跳过'}
for x in aggregate:
 m=x['mode']
 if m not in markers:continue
 a=x['winningRunMechanism'];lines.append(f"|{m}|{len(a['runsWithMechanism'])}/{a['winningRuns']}|{a['qualifyingWinBattles']}|{labels[m]}|")
lines+=['', '来源样例（仅通关远征的获胜战斗，数值均为日志记账）：','']
named={'multi':['s_wind','m_raptor','s_master','s_dancer'],'splash':['m_whelp','m_rex','m_titan','n_colossus','m_vindicator'],'burn':['m_shaman','m_raptor','m_whelp','m_heart','m_titan'],'rotation':['l_windblade','s_step','l_archer','l_storm','l_caliber'],'duel':['n_gladiator','s_fox','s_monk','s_viper','s_xyle','s_lord'],'spell':['a_devour','s_dart','a_chanter','s_caster','d_shriek','a_engulf'],'retaliation':['n_thorn','v_bear'],'shield':['l_lion'],'sacrifice':['a_void','n_ritualist','a_reaper'],'summon':['a_seed','d_dune','d_howler','m_egg','d_artificer','a_nightmare','d_dunecaster','d_worm'],'frost':['v_chaser','v_mage','v_stag','v_scout','v_drake','v_wyvern']}
for x in aggregate:
 m=x['mode']
 if m not in named:continue
 a=x['winningRunMechanism'];src=[(k,v)for k,v in a['sourceDamageLog'].items()if k.split(':')[0]in named[m]];src.sort(key=lambda kv:-kv[1]);casts=[(k,v)for k,v in a['castsByDef'].items()if k in named[m]];casts.sort(key=lambda kv:-kv[1]);parts=[f'{k}={v}'for k,v in src[:3]]+[f'{k}施法={v}'for k,v in casts[:2]];lines.append('- '+m+'：'+'；'.join(parts)+('。'if parts else '未记录匹配来源，见机制计数。'))
lines+=['', '## 门禁与解释范围','', f"完整样本{len(runs)}，首三战全胜{result['firstThreePassed']}/{len(runs)}。fault={sum(x['faults']for x in aggregate)}，失败动作={sum(x['failedActions']for x in aggregate)}，预算错误={sum(x['budgetErrors']for x in aggregate)}，未知谱系={sum(x['unknownLineages']for x in aggregate)}，冻结源码漂移={len(summ['changed'])}。anti3结构/实际违规见aggregate，不把其它定向组正常三人关系记为错误。", '', '本报告只陈列冻结结果与证据；预注册验收线由主责verify-final.py独立判断。32组合的小样本有不确定性，各组共享种子但交易与刷新会改变后续供给，不是相同商店逐项复演。主方向事件存在不代表所有单位等强；仍成型与胜率分开披露。未改产品、未打包、未提交、未发布，也未触碰真实存档与8788预览。', '', 'manifest保存冻结hash、frozen保存完整核心/脚本原件，runs/battles/investments流式落盘，失败只保留initial与末15事件。REPORT与aggregate由本目录generate-report.py生成。']
(P/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print(json.dumps({'samples':len(runs),'groups':[{k:x[k]for k in ['mode','clear','drawStop','everFormed','switched','firstThreePassed']}for x in aggregate],'sourceChanges':summ['changed']}))
