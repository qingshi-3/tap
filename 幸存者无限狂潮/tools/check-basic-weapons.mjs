// The previous autonomous wind/projectile/anchor tests describe the superseded design.
// Keep this entry point in the verification route; exercise the researched replacement.
export {enemy as foe} from './check-researched-original.mjs';
import {fixture} from './check-researched-original.mjs';
export const make=(hero,rank=1,branch=null)=>({...fixture(hero,1,rank,branch),upgrades:{},evolutions:{},skillLoadout:[]});
