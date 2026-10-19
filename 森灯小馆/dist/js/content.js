export const INGREDIENTS = [
  ['mushroom','蘑菇',3],['carrot','胡萝卜',4],['rice','稻米',5],['fish','河鱼',8],
  ['berry','浆果',5],['milk','牛奶',6],['herb','香草',3],['flour','面粉',5],
].map(([id,name,cost])=>({id,name,cost}));
export const RECIPES = [
  ['soup','蘑菇浓汤',{mushroom:2},16,3,1,'forest'],
  ['ricebowl','胡萝卜饭',{carrot:1,rice:1},19,4,1,'hearty'],
  ['berrytea','浆果茶',{berry:1,herb:1},18,2,1,'sweet'],
  ['fishrice','香煎鱼饭',{fish:1,rice:1},29,5,3,'river'],
  ['bread','奶香面包',{flour:2,milk:1},31,4,5,'sweet'],
  ['salad','林间沙拉',{carrot:2,herb:1},23,3,7,'forest'],
  ['fishsoup','香草鱼汤',{fish:1,herb:2},32,5,9,'river'],
  ['risotto','奶油菌菇饭',{mushroom:2,rice:1,milk:1},39,5,11,'hearty'],
  ['pie','浆果派',{berry:2,flour:1},33,4,14,'sweet'],
  ['stew','暖炉炖锅',{carrot:2,mushroom:2,milk:1},42,6,17,'hearty'],
  ['feast','河湾盛宴',{fish:2,rice:1,herb:1},48,6,21,'river'],
  ['lantern','森灯拼盘',{mushroom:1,carrot:1,berry:1,flour:1},43,5,25,'forest'],
].map(([id,name,ingredients,price,cookTime,unlockDay,tag],index)=>({id,name,ingredients,price,cookTime,unlockDay,tag,researchCost:index<3?0:40+(index-3)*35,researchIngredients:index<3?{}:Object.fromEntries(Object.entries(ingredients).map(([k,n])=>[k,n*2])),reputation:index<3?0:8+(index-3)*3}));
export const STAFF = [
  ['pip','小栗',75,8,4,'每4秒照顾一桌客人'],['moss','苔苔',150,12,6,'主厨：烹饪快35%，兼顾上菜'],
  ['luna','露露',180,14,6,'迎宾：每桌多收3金小费，兼顾上菜'],['oak','老橡',135,10,8,'采购：食材九折、采集主产物多1份，不参与上菜'],
].map(([id,name,cost,wage,interval,description])=>({id,name,cost,wage,interval,description}));
export const UPGRADES = [
  ['tables','餐桌',[90,450,1700],'每级增加一张餐桌'],['kitchen','灶台',[100,550,2000],'每级缩短烹饪时间'],
  ['garden','菜园',[85,400,1500],'每级让每次采集的主产物增加1份'],['decor','灯饰',[80,450,1700],'顾客更有耐心，小费更多'],
  ['sign','招牌',[120,650,2400],'吸引更多客人'],
].map(([id,name,cost,description])=>({id,name,cost,description,maxLevel:cost.length}));
export const GUEST_TYPES = [
  ['ranger','巡林客','forest'],['traveler','旅人','hearty'],['fisher','钓鱼客','river'],['sprite','花精灵','sweet'],
].map(([id,name,favorite])=>({id,name,favorite}));
export const MILESTONES = [
  ['first','第一碗热汤',1,20,'served'],['ten','十位食客',10,40,'served'],['fifty','林间常客',50,100,'served'],
  ['hundred','百客小馆',100,160,'served'],['days7','春日掌勺',7,70,'days'],['days14','夏夜灯火',14,110,'days'],
  ['days21','秋收满桌',21,150,'days'],['days28','四季森灯',28,240,'days'],['revenue500','小有积蓄',500,80,'revenue'],
  ['revenue2000','人气食堂',2000,180,'revenue'],['staff','伙伴相伴',1,50,'staff'],['build','焕然一新',5,120,'upgrades'],
].map(([id,name,target,reward,metric])=>({id,name,target,reward,metric}));
export const SEASONS = ['春','夏','秋','冬'];
export const FESTIVALS = [
  {day:7,name:'春芽野餐会',tag:'forest',target:7,metric:'forest',goal:'送出7份林间料理'},
  {day:14,name:'夏夜河鲜节',tag:'river',target:300,metric:'riverRevenue',goal:'河鲜菜肴营业额达到300金'},
  {day:21,name:'秋收甜点会',tag:'sweet',target:2,metric:'sweetVariety',goal:'卖出2种不同甜点，各至少2份'},
  {day:28,name:'冬灯团圆宴',tag:'hearty',target:3,metric:'guestVariety',goal:'用暖胃菜款待3类不同客人'},
];
export const REGIONS = [
  {id:'forest',name:'晨露森林',cost:0,reputation:0,yields:{mushroom:3,berry:1,herb:1},description:'蘑菇、浆果与香草；雨天蘑菇更多'},
  {id:'river',name:'芦苇河湾',cost:90,reputation:12,yields:{fish:2,rice:3,herb:1},description:'河鱼与稻米；薄雾时渔获更多'},
  {id:'mountain',name:'风车山麓',cost:260,reputation:20,yields:{carrot:3,milk:2,flour:2},description:'胡萝卜、牛奶与面粉；秋天收成更多'},
];
// Every branch states its actual effect. The effect is applied once in preparation;
// multiplicative modifiers last only for today's service and never mutate content.
export const EVENTS = [
  {id:'market',name:'赶集的商队',description:'商队愿意替小馆招揽客人。',choices:[{label:'招待领队',description:'花18金，今日来客速度+30%',effects:{coins:-18,traffic:1.3}},{label:'卖些干粮',description:'交出4稻米，获得24金',effects:{inventory:{rice:-4},coins:24}}]},
  {id:'rain',name:'雨棚借宿',description:'旅人想在门前避雨。',choices:[{label:'添一壶热茶',description:'交出3香草，今日耐心+6秒、声望+2',effects:{inventory:{herb:-3},patience:6,reputation:2}},{label:'摆上外带摊',description:'今日售价+10%，耐心-3秒',effects:{price:1.1,patience:-3}}]},
  {id:'ranger',name:'巡林队补给',description:'巡林队需要出发前的补给。',choices:[{label:'准备野菜',description:'交出5蘑菇，获得32金、声望+2',effects:{inventory:{mushroom:-5},coins:32,reputation:2}},{label:'请队员入座',description:'今日巡林客更常来，林间菜售价+20%',effects:{guest:'ranger',tag:'forest',tagPrice:1.2}}]},
  {id:'fisher',name:'渔夫的约定',description:'河湾渔夫带来一篮新鲜河鱼。',choices:[{label:'包下渔获',description:'花20金，获得7河鱼',effects:{coins:-20,inventory:{fish:7}}},{label:'教他做鱼',description:'交出2香草，河鲜售价+25%',effects:{inventory:{herb:-2},tag:'river',tagPrice:1.25}}]},
  {id:'critic',name:'美食手记',description:'旅行作者想为小馆写篇手记。',choices:[{label:'精心准备',description:'花25金，今日小费每桌+4、声望+3',effects:{coins:-25,tip:4,reputation:3}},{label:'保持家常',description:'今日售价-10%，来客速度+35%',effects:{price:.9,traffic:1.35}}]},
  {id:'baker',name:'面包师来访',description:'山麓面包师愿意交换手艺。',choices:[{label:'交换食材',description:'交出4浆果，获得8面粉',effects:{inventory:{berry:-4,flour:8}}},{label:'一起试炉',description:'花15金，今日烹饪速度+40%',effects:{coins:-15,cook:1.4}}]},
  {id:'sprites',name:'精灵茶会',description:'花精灵寻找今晚的聚会地点。',choices:[{label:'装点茶桌',description:'花20金，甜点售价+25%，精灵客更多',effects:{coins:-20,guest:'sprite',tag:'sweet',tagPrice:1.25}},{label:'交换山果',description:'获得6浆果、3香草，今日来客速度-15%',effects:{inventory:{berry:6,herb:3},traffic:.85}}]},
  {id:'harvest',name:'丰收帮手',description:'农场邀你交换今天的收获。',choices:[{label:'送去菌菇',description:'交出5蘑菇，获得6胡萝卜、4牛奶',effects:{inventory:{mushroom:-5,carrot:6,milk:4}}},{label:'雇辆运货车',description:'花22金，获得7稻米、7面粉',effects:{coins:-22,inventory:{rice:7,flour:7}}}]},
  {id:'musician',name:'树下演奏',description:'流浪乐手路过森灯小馆。',choices:[{label:'付出演出费',description:'花25金，今日耐心+8秒、小费每桌+2',effects:{coins:-25,patience:8,tip:2}},{label:'请吃一碗饭',description:'交出3稻米，今日来客速度+20%',effects:{inventory:{rice:-3},traffic:1.2}}]},
  {id:'challenge',name:'大胃王挑战',description:'登山队邀请你加入晚餐挑战。',choices:[{label:'推出暖胃套餐',description:'暖胃菜售价+30%，今日耐心-4秒',effects:{tag:'hearty',tagPrice:1.3,patience:-4}},{label:'打包路粮',description:'交出4胡萝卜、3面粉，获得40金、声望+2',effects:{inventory:{carrot:-4,flour:-3},coins:40,reputation:2}}]},
];
export const CONTRACTS = [
  ['picnic','巡林野餐篮',{mushroom:12,herb:6},68,3,2],['tea','精灵下午茶',{berry:12,milk:6},95,3,3],
  ['riverbox','河鲜集市',{fish:10,rice:8},120,4,2],['bakery','山麓烘焙社',{flour:15,milk:8},120,4,3],
  ['soupbox','夜哨热汤',{mushroom:16,carrot:10},110,4,2],['harvestbox','秋收餐篮',{carrot:16,rice:12},135,5,3],
  ['herbbox','药师的香草',{herb:20,berry:8},115,4,2],['banquet','商队团圆饭',{fish:12,flour:12,milk:6},170,6,3],
].map(([id,name,ingredients,reward,reputation,duration])=>({id,name,ingredients,reward,reputation,duration}));

export const MARKETS = [
 {name:'赶集客',description:'重视实惠，平价吸引更多客人；高价会劝退多数人。',traffic:{value:1.65,normal:1,premium:.48},prices:{value:.85,normal:1,premium:1.25},favorite:'forest'},
 {name:'过路旅人',description:'常价兼顾客流与收入，旅人喜欢暖胃菜。',traffic:{value:1.12,normal:1.2,premium:.7},prices:{value:.82,normal:1,premium:1.25},favorite:'hearty'},
 {name:'品鉴客',description:'愿意为精致料理付费，高价更受欢迎。',traffic:{value:.85,normal:1,premium:1.12},prices:{value:.8,normal:1,premium:1.3},favorite:'sweet'},
];
export const EXPANSIONS = [
 {id:'takeaway',name:'林边外带窗',description:'来客快35%、用餐时间减半，售价降12%。',cost:650,unlockDay:8,traffic:1.35,price:.88,eating:1.25},
 {id:'salon',name:'灯下雅座',description:'售价加25%，来客少25%。',cost:650,unlockDay:8,traffic:.75,price:1.25,eating:2.5},
];
export const SERVICE_ORDERS = [
 {id:'forestLunch',name:'巡林午餐',description:'营业中送出12份林间菜。',kind:'tag',tag:'forest',target:12,reward:90,reputation:3,duration:2,unlockDay:1},
 {id:'twoDishes',name:'双味试吃',description:'营业中送出两种不同料理，每种至少3份。',kind:'variety',target:2,reward:110,reputation:3,duration:2,unlockDay:1},
 {id:'threeDays',name:'三日常客',description:'连续三天各接待至少8位客人。',kind:'streak',target:3,reward:180,reputation:5,duration:3,unlockDay:4},
 {id:'riverTable',name:'河湾宴请',description:'营业中送出18份河鲜。',kind:'tag',tag:'river',target:18,reward:180,reputation:5,duration:3,unlockDay:9},
 {id:'sweetFlight',name:'甜点品鉴',description:'营业中送出两种甜点，每种至少3份。',kind:'variety',tag:'sweet',target:2,reward:160,reputation:4,duration:2,unlockDay:14},
 {id:'winterRegulars',name:'冬日长桌',description:'连续三天各接待至少12位客人。',kind:'streak',minimum:12,target:3,reward:240,reputation:6,duration:3,unlockDay:20},
];
