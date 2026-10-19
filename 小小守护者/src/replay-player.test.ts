import {it,expect} from 'vitest';
import {createGame,applyAction,step,hashState} from './core/index';
import {exportReplay} from './storage';
import {ReplayPlayer} from './replay-player';
it('visibly starts at the first wave and applies later preparation actions at their recorded tick',()=>{
 const state=createGame(23);applyAction(state,{type:'startWave'});step(state,6000);
 expect(state.phase).toBe('prep');applyAction(state,{type:'chooseCard',kind:state.cardChoices[0]});
 applyAction(state,{type:'buyLegion',kind:'archer',x:23,y:8});applyAction(state,{type:'startWave'});step(state,90);
 const player=new ReplayPlayer(exportReplay(state));expect(player.state.wave).toBe(1);expect(player.state.tick).toBe(0);expect(player.state.legions).toHaveLength(0);
 while(!player.done)player.advance();expect(hashState(player.state)).toBe(hashState(state));
 player.advance();expect(hashState(player.state)).toBe(hashState(state));
});
