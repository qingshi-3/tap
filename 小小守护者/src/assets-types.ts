export interface SpriteFrame { file:string; rect?:[number,number,number,number]; offset?:[number,number]; duration:number }
export interface UnitAsset { width:number;height:number;animations:{idle:SpriteFrame[];walk:SpriteFrame[];attack:SpriteFrame[]};sourceId:string }
export interface WorldAsset { file:string;rect:[number,number,number,number] }
export interface AssetManifest {
 units:Record<string,UnitAsset>;
 world:Record<string,WorldAsset>;
 ui:Record<string,string>;
 sounds?:Record<string,string[]>;
}
