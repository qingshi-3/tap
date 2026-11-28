// Published profile13/achievement scope. Never derive this historical set from live content.
export const ORIGINAL_CAMPAIGN_LEVEL_IDS = Object.freeze(['border','road','banners','sand','shadow','frost','crossroads','citadel','ruins','confluence'].flatMap(prefix => [1,2,3].map(n => `${prefix}-0${n}`)));
export const ADVENTURE_PACKAGE_ID = 'storm-starfall-18-v1';
export const ADVENTURE_LEVEL_IDS = Object.freeze(['storm','starfall'].flatMap(prefix => Array.from({length:9},(_,i)=>`${prefix}-0${i+1}`)));
const legalLevels = new Set([...ORIGINAL_CAMPAIGN_LEVEL_IDS,...ADVENTURE_LEVEL_IDS]);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key=>Object.hasOwn(value,key));
export const initialAdventureAccess = () => ({entitlements:{},notices:{}});
// Count legal facts per faction, deduplicating repeats and excluding inherited shared unlocks.
export function countAdventureCompletions(state) {
  return Array.from({length:6},(_,i)=>new Set((Array.isArray(state?.factionCompleted?.[i+1])?state.factionCompleted[i+1]:[]).filter(id=>legalLevels.has(id))).size).reduce((a,b)=>a+b,0);
}
export function validateAdventureAccess(value) {
  if(!exact(value,['entitlements','notices'])||!plain(value.entitlements)||!plain(value.notices))return false;
  if(Object.keys(value.entitlements).some(id=>id!==ADVENTURE_PACKAGE_ID)||Object.keys(value.notices).some(id=>id!==ADVENTURE_PACKAGE_ID))return false;
  const grant=value.entitlements[ADVENTURE_PACKAGE_ID],notice=value.notices[ADVENTURE_PACKAGE_ID];
  if(grant!==undefined&&(!exact(grant,['version','granted','qualifyingCompletions'])||grant.version!==1||grant.granted!==true||!Number.isSafeInteger(grant.qualifyingCompletions)||grant.qualifyingCompletions<=30||grant.qualifyingCompletions>legalLevels.size*6))return false;
  if(notice!==undefined&&(!grant||!exact(notice,['dismissed'])||typeof notice.dismissed!=='boolean'))return false;
  return true;
}
export function hasAdventureAccess(state) { return validateAdventureAccess(state?.adventureAccess)&&state.adventureAccess.entitlements[ADVENTURE_PACKAGE_ID]?.granted===true&&countAdventureCompletions(state)>=state.adventureAccess.entitlements[ADVENTURE_PACKAGE_ID].qualifyingCompletions; }
// Candidate only: callers must persist before exposing the entitlement.
export function grantAdventureAccess(candidate) {
  if(hasAdventureAccess(candidate)||countAdventureCompletions(candidate)<=30)return false;
  candidate.adventureAccess.entitlements[ADVENTURE_PACKAGE_ID]={version:1,granted:true,qualifyingCompletions:countAdventureCompletions(candidate)};
  return true;
}
