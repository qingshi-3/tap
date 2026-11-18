import {ALL_RECRUITMENT_IDS} from './recruitment-catalog.js';
import {validDay} from './daily-ad-rewards.js';
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,k)=>obj(v)&&Object.keys(v).sort().join('|')===[...k].sort().join('|');
const int=(v,min=0)=>Number.isSafeInteger(v)&&v>=min;
const str=v=>typeof v==='string'&&v.length>0&&v.length<=200;
export function validateReceipt(v){
 if(v===null)return true;
 if(!keys(v,['id','count','ticketCost','draws','newUnitIds','coins','tickets','pity'])||!str(v.id)||!(int(v.count,1)&&v.count<=10)||v.ticketCost!==v.count||v.coins!==v.count*20||!int(v.tickets)||!Array.isArray(v.draws)||v.draws.length!==v.count||!Array.isArray(v.newUnitIds)||v.newUnitIds.some(id=>!ALL_RECRUITMENT_IDS.includes(id)))return false;
 if(!keys(v.pity,['totalDraws','drawsSinceUnit','legacyGuarantees','legacyUnitGuarantee'])||!int(v.pity.totalDraws)||!int(v.pity.drawsSinceUnit)||v.pity.drawsSinceUnit>9||!obj(v.pity.legacyGuarantees)||!(v.pity.legacyUnitGuarantee===null||int(v.pity.legacyUnitGuarantee,1)&&v.pity.legacyUnitGuarantee<=10))return false;
 if(v.pity.drawsSinceUnit>v.pity.totalDraws||Object.entries(v.pity.legacyGuarantees).some(([id,n])=>![17,116,215,310,404,526].includes(Number(id))||String(Number(id))!==id||!int(n,1)||n>3))return false;
 for(const [i,d] of v.draws.entries()){
  if(!keys(d,['index','guaranteed','rewards','newUnitIds'])||d.index!==i+1||d.guaranteed!==false||!Array.isArray(d.rewards)||d.rewards.length<2||!Array.isArray(d.newUnitIds))return false;
  for(const [j,e] of d.rewards.entries()){
   if(!obj(e))return false;
   const expected=['kind','cardId','amount','source','converted','newUnit'];if(e.kind==='fragments')expected.push('remainingFragments');
   if(!keys(e,expected)||e.converted!==false||typeof e.newUnit!=='boolean'||!int(e.amount,1))return false;
   if(j===0&&(e.kind!=='fragments'||e.source!=='random'||![1,2,5].includes(e.amount)))return false;
   if(j===1&&(e.kind!=='coins'||e.source!=='companion'||e.amount!==20||e.cardId!==null||e.newUnit))return false;
   if(j>1&&!((e.kind==='fragments'&&e.source==='legacy'&&e.amount===5)||(e.kind==='unit'&&e.source==='legacy-unit'&&e.amount===1&&e.newUnit)))return false;
   if(e.kind!=='coins'&&(!ALL_RECRUITMENT_IDS.includes(e.cardId)||e.kind==='fragments'&&!int(e.remainingFragments)))return false;
  }
  if(JSON.stringify(d.newUnitIds)!==JSON.stringify(d.rewards.filter(e=>e.newUnit).map(e=>e.cardId)))return false;
 }
 return JSON.stringify(v.newUnitIds)===JSON.stringify(v.draws.flatMap(d=>d.newUnitIds));
}
export function validateRecruitmentDoubles(v){
 if(!validateReceipt(v.lastReceipt)||!keys(v.doubles,['claims'])||!obj(v.doubles.claims))return false;
 if(v.lastReceipt&&(v.lastReceipt.id!==`recruit-${v.random.totalDraws}`||v.lastReceipt.pity.totalDraws!==v.random.totalDraws))return false;
 const targets=new Set(),days={};
 for(const [id,c] of Object.entries(v.doubles.claims)){
  if(!str(id)||!keys(c,['receiptId','index','day','status','cardId','fragments','coins','rewards'])||!str(c.receiptId)||!int(c.index,1)||c.index>10||!validDay(c.day)||!['pending','watched','claimed','cancelled'].includes(c.status)||!ALL_RECRUITMENT_IDS.includes(c.cardId)||![1,2,5].includes(c.fragments)||c.coins!==20||!Array.isArray(c.rewards)||c.rewards.length<2||c.rewards.length>8)return false;
  for(const [i,e] of c.rewards.entries()){if(!keys(e,['kind','cardId','amount'])||!int(e.amount,1)||!((e.kind==='fragments'&&ALL_RECRUITMENT_IDS.includes(e.cardId)&&(i===0?[1,2,5].includes(e.amount):e.amount===5))||(e.kind==='coins'&&i===1&&e.cardId===null&&e.amount===20)))return false;}
  if(c.rewards[0].cardId!==c.cardId||c.rewards[0].amount!==c.fragments||c.rewards[1].kind!=='coins')return false;
  if(c.status!=='cancelled'){const target=`${c.receiptId}:${c.index}`;if(targets.has(target))return false;targets.add(target);days[c.day]=(days[c.day]??0)+1;if(days[c.day]>10)return false;}
  if(['pending','watched'].includes(c.status)&&(!v.lastReceipt||c.receiptId!==v.lastReceipt.id||!(int(v.lastReceipt.count,1)&&v.lastReceipt.count<=10)||v.lastReceipt.draws[c.index-1]?.rewards[0].cardId!==c.cardId||v.lastReceipt.draws[c.index-1]?.rewards[0].amount!==c.fragments||JSON.stringify(c.rewards)!==JSON.stringify(v.lastReceipt.draws[c.index-1]?.rewards.filter(e=>['fragments','coins'].includes(e.kind)).map(({kind,cardId,amount})=>({kind,cardId,amount})))))return false;
 }
 return true;
}
export function doubleOffer(recruitment,receiptId,index,day){
 const receipt=recruitment.lastReceipt,claims=Object.entries(recruitment.doubles.claims),prior=claims.find(([,c])=>c.receiptId===receiptId&&c.index===index&&c.status!=='cancelled');
 const claimed=prior?.[1].status==='claimed',pending=prior&&['pending','watched'].includes(prior[1].status)?{requestId:prior[0],...prior[1]}:null;
 const remaining=Math.max(0,10-claims.filter(([,c])=>c.day===day&&c.status==='claimed').length);
 const reservations=claims.filter(([,c])=>c.day===day&&['pending','watched'].includes(c.status)).length;
 const valid=!!receipt&&receipt.id===receiptId&&int(receipt.count,1)&&receipt.count<=10&&Number.isInteger(index)&&index>=1&&index<=receipt.count;
 return {remaining,claimed,pending,watched:pending?.status==='watched',eligible:!!valid&&!claimed&&(!!pending||remaining>reservations),reason:!valid?'此结果不支持翻倍。':claimed?'已翻倍。':!remaining&&!pending?'今日翻倍次数已用完。':''};
}
