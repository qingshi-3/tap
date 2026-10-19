export interface DropInput {
 start:{x:number;y:number};end:{x:number;y:number};inside:boolean;valid:boolean;
 cancelled:boolean;otherPointers:number;
}
/** Recheck travel at release: fast pointer sequences need not deliver a move event. */
export function shouldDrop(input:DropInput):boolean {
 return !input.cancelled&&input.otherPointers===0&&input.inside&&input.valid&&
  Math.hypot(input.end.x-input.start.x,input.end.y-input.start.y)>7;
}
