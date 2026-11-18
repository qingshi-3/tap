// Versioned, immutable encounter definitions. Never edit v1 after release: append a version.
const object=(id,name,spriteFrom,health,attack=0,mobile=false)=>({id,name,type:'unit',faction:0,cost:0,attack,health,speed:mobile?2:0,token:true,spriteFrom,description:mobile?'关卡部队。':'机制对象：不能普通移动或攻击；可攻击、驱散、变形或控制以关闭。'});
export const ENCOUNTER_CARDS=Object.freeze({
  9101:object(9101,'蓄弩哨兵',10021,3),9102:object(9102,'集合营火',214,3),9103:object(9103,'桥头盾卫',11,4,2,true),9104:object(9104,'逐光医师',10981,4),9105:object(9105,'贴身铁卫',19027,6,3,true),
  9106:object(9106,'集结旗',15,4),9107:object(9107,'突击旗',16,4),9108:object(9108,'补给旗',10981,4),9109:object(9109,'军用方尖碑',214,4),9110:object(9110,'沙炮塔',215,4),9111:object(9111,'回撤影锚',317,4),9112:object(9112,'渡口突袭兵',110,3,3,true),9113:object(9113,'影仆',315,1,1,true),9114:object(9114,'可拆冰棱',525,3),9115:object(9115,'孵化巢',411,4),9116:object(9116,'弩台供能器',214,4),9117:object(9117,'轮换门闸',525,4),9118:object(9118,'祭坛',317,5),9119:object(9119,'具名祭兵',308,4,2,true),9120:object(9120,'复生祭兵',308,1,2,true),9121:object(9121,'孵化兽兵',402,4,3,true),9122:object(9122,'基础沙魔',213,2,2,true),9123:object(9123,'普通援军',14,2,2,true),9124:{...object(9124,'侧翼弩手',10021,3,1,true),ranged:true,attackRange:3},
});
const src=(kind,card,side='front',times=[],extra={})=>({kind,card,side,times,...extra});
const row=(title,text,sources,extra={})=>({title,text,sources,...extra});
export const ENCOUNTERS_V1=Object.freeze({
 'border-01':row('蓄弩哨兵','哨兵隔回合预告1伤，移开标记格或击败哨兵；共3发。',[src('shot',9101,'back',[1,3,5],{damage:1})]),
 'border-02':row('集合点','上下营火分别预告援军，各一次；拆除或驱散可取消。',[src('spawn',9102,'top',[1],{spawn:9123}),src('spawn',9102,'bottom',[1],{spawn:9123,delay:2})]),
 'border-03':row('巡夜点名','每次敌军行动后预告主将格2伤；侧路巡军仅2名。',[src('shot',0,'general','every',{damage:2}),src('spawn',0,'top',[2,4],{spawn:9123})]),
 'road-01':row('桥头盾阵','相邻普通敌兵减伤1，最低1；移开、驱散或击败盾卫解除。',[src('guard',9103,'top',[],{reduction:1}),src('guard',9103,'bottom',[],{reduction:1})]),
 'road-02':row('逐光医师','医师各有2次相邻普通友军治疗，每次2；不治疗主将或医师。',[src('medic',9104,'top',[],{charges:2}),src('medic',9104,'bottom',[],{charges:2})]),
 'road-03':row('贴身铁卫','相邻铁卫使统帅减伤2；拆卫反噬3。半血永久破甲、停止换防，下次行动攻击+1。',[src('iron',9105,'near',[],{backlash:3}),src('iron',9105,'near',[],{backlash:3}),src('reserve',0,'general',[2,4],{spawn:9105})]),
 'banners-01':row('集结旗','两军各自第二次行动后预告一次集结；拆旗或斩将取消。',[src('spawn',9106,'front',[2],{spawn:9123}),src('spawn',9106,'front',[2],{spawn:9123,owner:2})]),
 'banners-02':row('军令旗','突击旗最多3次为邻近2兵攻击+1；补给旗最多3次治疗最伤邻兵2。',[src('attackFlag',9107,'front',[1,2,3]),src('healFlag',9108,'front',[1,2,3],{owner:2})]),
 'banners-03':row('有限军令','突击、补给交替预告，共4令；拆对应旗永久取消。',[src('attackFlag',9107,'top',[1,5],{health:5}),src('healFlag',9108,'bottom',[3,7],{health:5,count:2})]),
 'sand-01':row('有限方尖碑','产兵碑仅在E2/E4/E6产兵，提前预告；拆碑停止生产。',[src('spawn',9109,'front',[1,3,5],{spawn:9122})]),
 'sand-02':row('双塔交火','上下炮塔各2发、错开预告；固定三格各2伤，移出即可避开。',[src('cannon',9110,'top',[1,3],{damage:2}),src('cannon',9110,'bottom',[2,4],{damage:2,dense:true})]),
 'sand-03':row('沙阵供给','两碑各3兵；拆碑反噬督军3伤，耗尽不会补碑。',[src('spawn',9109,'top',[1,3,5],{spawn:9122,health:5,backlash:3}),src('spawn',9109,'bottom',[1,3,5],{spawn:9122,health:5,backlash:3})]),
 'shadow-01':row('影门伏兵','两门分别在E1/E3预告；玩家站在门格直到结算则永久封门。',[src('portal',0,'top',[1],{spawn:9112}),src('portal',0,'bottom',[3],{spawn:9112})]),
 'shadow-02':row('回撤影门','两名突袭兵首次存活攻击后预告回撤；拆影锚可断退路，回撤不恢复行动。',[src('anchor',9111,'top',[],{bind:9112}),src('anchor',9111,'bottom',[],{bind:9112})]),
 'shadow-03':row('移形猎杀','猎首预告距最高攻击随从2格的影门；任意单位堵门使其受下一次正伤害额外+2。成功移形当回合不能攻击。',[src('hunt',0,'general',[1,3,5])]),
 'frost-01':row('可拆冰棱','3面冰棱被摧毁时，对相邻所有单位造成2伤。',[src('ice',9114,'front'),src('ice',9114,'top'),src('ice',9114,'bottom')]),
 'frost-02':row('孵化巢','两巢在第一次行动后预告，第三次行动孵化；驱散关闭，冻结不停止计时。',[src('spawn',9115,'front',[1],{spawn:9121,delay:2}),src('spawn',9115,'bottom',[1],{spawn:9121,delay:2})]),
 'frost-03':row('霜墙女王','保留霜甲、冰封、碎冰与半血凛冬。',[]),
 'crossroads-01':row('两路补员','两入口各在E2/E4出兵；玩家停到所属军开始时永久封口。',[src('portal',0,'top',[1,3],{spawn:9123}),src('portal',0,'bottom',[1,3],{spawn:9123})]),
 'crossroads-02':row('错峰补员','上口E2/E4、下口E3/E5出兵；占入口永久封口。',[src('portal',0,'top',[1,3],{spawn:9123}),src('portal',0,'bottom',[2,4],{spawn:9123})]),
 'crossroads-03':row('封三路','3口各2兵，按所属军E2/E5出兵；斩将清除其全部入口。',[src('portal',0,'top',[1,4],{spawn:9123}),src('portal',0,'bottom',[1,4],{spawn:9123}),src('portal',0,'front',[1,4],{spawn:9123,owner:2})]),
 'citadel-01':row('弩台供能','两供能器各为一名弩手攻击+1；拆器或击败弩手可断火力。',[src('power',9116,'top',[],{bind:9124}),src('power',9116,'bottom',[],{bind:9124})]),
 'citadel-02':row('轮换护阵','上下门闸交替激活，仅相邻普通守军减伤1；拆掉后该侧轮次空过。',[src('gate',9117,'top',[],{parity:1}),src('gate',9117,'bottom',[],{parity:0})]),
 'citadel-03':row('门闸过载','交替门闸为统帅减伤2；首次关闭任一门使两门失效，持续接下来两个完整玩家回合。',[src('bossGate',9117,'top',[],{parity:1,health:5}),src('bossGate',9117,'bottom',[],{parity:0,health:5})]),
 'ruins-01':row('一次回响','2名祭兵首次阵亡留下残骸，预告后原格复生一次；玩家回合结束站位净除。',[src('echo',0,'general',[],{charges:2}),src('sacrifice',9119,'front'),src('sacrifice',9119,'bottom')]),
 'ruins-02':row('祭坛回收','3祭兵留残骸，祭坛最多3次预告最近残骸复生；拆坛停止。',[src('altar',9118,'front',[],{charges:3}),src('sacrifice',9119,'near'),src('sacrifice',9119,'top'),src('sacrifice',9119,'bottom')]),
 'ruins-03':row('双点招魂','祭坛E1/E3/E5各预告最多2具原始残骸；占位或拆坛取消，复生兵不留残骸。',[src('altar',9118,'front',[1,3,5],{count:2}),src('sacrifice',9119,'near'),src('sacrifice',9119,'top'),src('sacrifice',9119,'bottom'),src('sacrifice',9119,'front')]),
 'confluence-01':row('寒沙交界','冰军2面碎冰，沙军有限产兵碑E2/E4各1兵；两军互攻。',[src('ice',9114,'front'),src('ice',9114,'top'),src('spawn',9109,'front',[1,3],{spawn:9122,owner:2})]),
 'confluence-02':row('反转战线','入口E2/E4出兵，可占位封口；另一翼供能器给一名弩手攻击+1。',[src('portal',0,'top',[1,3],{spawn:9123}),src('power',9116,'bottom',[],{bind:9124})]),
 'confluence-03':row('残局夺势','统帅旗预告2名铁卫，先锋预告2次3伤点名；一将倒下取消普通预告，余将下一次行动后仅预告一次最后号令。',[src('spawn',9106,'front',[1,3],{spawn:9105,health:5}),src('shot',0,'general',[1,3],{damage:3,owner:2})]),
});
export const encounterDefinition=id=>ENCOUNTERS_V1[id]??null;
export const ENCOUNTER_CARD_IDS=Object.keys(ENCOUNTER_CARDS).map(Number);
