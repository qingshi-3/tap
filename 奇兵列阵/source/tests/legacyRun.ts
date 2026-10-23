import { newRun, type RunState } from '../src/core/run';

/** A historical initial expedition: wallet, four factions, free picks and RNG sequence. */
export const legacyRun = (general: string, seed: number): RunState => newRun(general,seed,{legacyEconomy:true});
