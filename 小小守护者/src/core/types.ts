/** Shared contract. Rules have no browser, rendering, storage or TapTap dependencies. */
export type Phase = 'prep' | 'combat' | 'won' | 'lost';
export type LegionKind = 'shield' | 'archer' | 'mage' | 'spear' | 'rider';
export type BuildingKind = 'wall' | 'tower' | 'slow';
export type EnemyKind = 'grunt' | 'siege' | 'flyer' | 'boss' | 'healer' | 'armored' | 'splitter' | 'raider';
export type CardKind = 'giant' | 'deathBurst' | 'sharp' | 'bounty';
export type SpellKind = 'heal' | 'freeze';
export type HeroKind = 'engineer' | 'captain' | 'ranger';
export type Animation = 'idle' | 'walk' | 'attack' | 'hurt';
export interface Point { x:number; y:number }
export interface MapData { id:string; width:number; height:number; cells:number[]; core:Point; gates:(Point & {label:string})[] }
export interface Unit extends Point {
 id:number; team:'player'|'enemy'; kind:LegionKind|EnemyKind|HeroKind; legionId:number|null;
 hp:number; maxHp:number; damage:number; armor:number; range:number; speed:number;
 cooldown:number; attackEvery:number; anchorX:number; anchorY:number; alertRadius:number;
 targetId:number|null; anim:Animation; animTick:number; lastHurtTick:number;
 fly:boolean; leakDamage:number; bounty:number;
}
export interface Legion extends Point { id:number; kind:LegionKind; tier:1|2|3; xp:number; alertRadius:number; unitIds:number[]; cardIds:number[] }
export interface Building extends Point { id:number; kind:BuildingKind; hp:number; maxHp:number; cooldown:number }
export interface Card { id:number; kind:CardKind; carrier:number|null; recyclable:boolean }
export interface Hero extends Point { id:number; kind:HeroKind; unitId:number|null }
export interface Spawn { tick:number; gate:number; kind:EnemyKind }
export interface Effect extends Point { id:number; kind:'shot'|'hit'|'heal'|'freeze'|'burst'; toX?:number; toY?:number; born:number; ttl:number }
export interface RecordedAction { tick:number; action:Action }
export interface GameState {
 schemaVersion:1; rulesVersion:string; seed:number; rng:number; mapId:string; tick:number;
 phase:Phase; wave:number; gold:number; coreHp:number; nextId:number; map:MapData;
 legions:Legion[]; buildings:Building[]; units:Unit[]; hero:Hero|null; cards:Card[];
 cardChoices:CardKind[]; spells:Record<SpellKind,number>; spawns:Spawn[]; combatStarted:number;
 freezeUntil:number; effects:Effect[]; actions:RecordedAction[]; message:string;
 stats:{kills:number; leaked:number; legionsLost:number; wavesCleared:number};
}
export type Action =
 | {type:'buyLegion';kind:LegionKind;x:number;y:number}
 | {type:'moveLegion';id:number;x:number;y:number}
 | {type:'setRadius';id:number;value:number}
 | {type:'upgradeLegion';id:number}
 | {type:'buyBuilding';kind:BuildingKind;x:number;y:number}
 | {type:'moveBuilding';id:number;x:number;y:number}
 | {type:'repair';id:number}
 | {type:'buyHero';kind?:HeroKind;x:number;y:number}
 | {type:'buySpell';kind:SpellKind}
 | {type:'castSpell';kind:SpellKind;x:number;y:number}
 | {type:'chooseCard';kind:CardKind}
 | {type:'assignCard';cardId:number;legionId:number}
 | {type:'startWave'};
export interface ActionResult { ok:boolean; message?:string }
export interface UnitStats { hp:number;damage:number;armor:number;range:number;speed:number;attackEvery:number;count:number }

