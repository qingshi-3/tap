import { describe, expect, it } from 'vitest';
import { simulate } from '../src/core/engine';
import { chapter } from '../src/core/route';
import * as R from '../src/core/run';
import { newTutorialRun, scriptDraft, scriptShop, tutorialAllows, tutorialComplete, giveTutorialActionScroll, type TutAction } from '../src/core/tutorialRoute';

describe('fixed tutorial route', () => {
  it('教学显式路由不影响同seed普通远征，克隆保留预览和实际遭遇', () => {
    const tutorial = newTutorialRun();
    const ordinary = R.newRun(tutorial.general, tutorial.seed);
    expect(ordinary.tutorialMode).toBeUndefined();
    expect(R.currentStage(ordinary)).toEqual(chapter(0).stages[0]);
    expect(R.buildBattle(ordinary).enemy).not.toEqual(R.buildBattle(tutorial).enemy);
    for (const node of [0, 1, 2, 4]) {
      tutorial.node = node;
      const clone = R.cloneRun(tutorial);
      expect(clone.tutorialMode).toBe(true);
      expect(R.currentStage(clone)).toEqual(R.currentStage(tutorial));
      const stage = R.currentStage(clone, node);
      if (stage.type !== 'battle') throw new Error('missing tutorial battle');
      const preview = stage.variant && clone.variantChoices[`0:${node}`] ? stage.variant : stage.main;
      expect(R.currentNode(clone)).toEqual(preview);
      expect(R.buildBattle(clone).enemy).toEqual(preview.lineup);
      const initial = simulate({ ...R.buildBattle(clone), player: [{ defId: 'n_bulwark' }] }).initial.filter(u => u.side === 1);
      expect(initial.map(u => [u.defId, u.atk, u.maxHp])).toEqual(preview.lineup.filter(e => !!e).map(e => [e.defId, e.atk, e.hp]));
      preview.lineup[0]!.hp = 999;
      expect(R.buildBattle(tutorial).enemy[0]?.hp).not.toBe(999);
    }
  });
  it.each([0, 1])('wins four real battles including final variant %i, demonstrates the scroll extra wave, and completes after settlement', variant => {
    const r = newTutorialRun();
    r.variantChoices['0:4'] = variant;
    expect(giveTutorialActionScroll(r)).toBe(false);
    expect(r.spells).not.toContain('sp_haste');
    const act = (step: string, a: TutAction) => expect(tutorialAllows(step, r, a), `${step}: ${JSON.stringify(a)}`).toBe(true);
    const pick = (step: string, id: string, slot: number) => {
      r.draft = scriptDraft(r)!;
      expect(r.draft).toEqual([id]);
      act(step, { kind: 'place', idx: 0, slot });
      expect(R.takeDraft(r, 0, slot)).toBe(step === 'merge-first' || step === 'merge-chaser' ? 'merge' : 'place');
      r.draft = scriptDraft(r);
    };
    const fight = (step: string, freeze = false) => {
      act(step, { kind: 'battle' });
      const out = simulate({ ...R.buildBattle(r), record: true });
      expect(out.fault).toBeUndefined();
      expect(out.result).toBe('win');
      if (freeze) {
        const enemies = new Set(out.initial.filter(u => u.side === 1).map(u => u.uid));
        expect(out.log.some(x => x.ev.t === 'frozenSkip' && enemies.has(x.ev.uid))).toBe(true);
        expect(out.log.some(x => x.ev.t === 'chill' && x.ev.n === 4)).toBe(true);
      }
      R.beginBattle(r, out.result, out.gold);
      expect(R.finishBattle(r)).toBe(true);
      if (R.screen(r) === 'prep') r.draft = scriptDraft(r);
    };
    pick('recruit-first', 'n_merc', 0);
    pick('merge-first', 'n_merc', 0);
    pick('recruit-guard', 'l_vigil', 1);
    fight('fight-first');
    expect(r.stash).toEqual({ hp: 1, block: 1, atk: 1 });
    r.stash.power = 1; // Tutorial.fixDraft grants exactly one point once.
    act('train-general', { kind: 'alloc', to: 'general', type: 'power' });
    expect(R.allocPoint(r, 'general', 'power')).toBe(true);
    for (const type of ['hp', 'block', 'atk']) {
      act('train-unit', { kind: 'alloc', to: 0, type });
      expect(R.allocPoint(r, 0, type)).toBe(true);
    }
    expect(scriptDraft(r)).toEqual(['s_backstab']);
    r.draft = scriptDraft(r)!;
    act('reroll', { kind: 'reroll' });
    expect(R.reroll(r)).toBe(true);
    pick('recruit-bulwark', 'n_bulwark', 2);
    pick('recruit-sentry', 'd_sentry', 3);
    act('swap-front', { kind: 'move', from: 0, to: 2 });
    expect(R.moveSlot(r, 0, 2)).toBe('swap');
    fight('fight-second');
    act('sell-guard', { kind: 'sell', slot: 1 });
    expect(R.sell(r, 1)).toBe(true);
    pick('recruit-chaser', 'v_chaser', 1);
    pick('merge-chaser', 'v_chaser', 1);
    expect(r.slots.map(u => u?.defId ?? null)).toEqual(['n_bulwark', 'v_chaser', 'n_merc', 'd_sentry', null]);
    fight('fight-third', true);
    expect(r.gold).toBe(10);
    scriptShop(r);
    expect(r.shop?.equips[0]).toMatchObject({ id: 'eq_banner', price: 5, sold: false });
    act('shop-buy', { kind: 'buy', category: 'equips', index: 0 });
    expect(R.buy(r, 'equips', 0)).toBe(true);
    act('shop-leave', { kind: 'leave-shop' });
    R.leaveShop(r);
    expect(giveTutorialActionScroll(r)).toBe(true);
    expect(giveTutorialActionScroll(r)).toBe(true);
    expect(r.spells.filter(id => id === 'sp_haste')).toHaveLength(1);
    expect(scriptDraft(r)).toEqual([]);
    expect(tutorialAllows('fight-final', r, { kind: 'battle' })).toBe(false);
    r.picks = 0; r.rerolls = 0; // Tutorial.fixDraft suppresses further recruitment.
    expect(tutorialAllows('fight-final', r, { kind: 'battle' })).toBe(false);
    expect(tutorialComplete(r, 'result')).toBe(false);
    act('equip-banner', { kind: 'equip', index: 0, slot: 2 });
    expect(R.equip(r, 0, 2)).toBe(true);
    expect(r.slots[2]?.equips).toEqual(['eq_banner']);
    expect(r.history).toEqual(['win', 'win', 'win']);
    expect(r.lives).toBe(3);
    expect(r.gold).toBe(5);
    expect(tutorialAllows('equip-banner', r, { kind: 'battle' })).toBe(false);
    expect(tutorialAllows('fight-final', r, { kind: 'battle' })).toBe(false);
    act('use-haste', { kind: 'spell' });
    expect(R.useSpell(r, r.spells.indexOf('sp_haste'))).toBe(true);
    expect(tutorialAllows('use-haste', r, { kind: 'spell' })).toBe(false);
    expect(giveTutorialActionScroll(r)).toBe(true);
    expect(r.spells).not.toContain('sp_haste');
    act('fight-final', { kind: 'battle' });
    const final = simulate({ ...R.buildBattle(r), record: true });
    expect(final.fault).toBeUndefined();
    expect(final.result).toBe('win');
    const front = final.initial.find(u => u.side === 0 && u.slot === 0)!;
    expect(final.log.some(x => x.ev.t === 'actionGain' && x.ev.uid === front.uid && x.ev.n === 1)).toBe(true);
    const extraBeat = final.log.findIndex(x => x.ev.t === 'beat' && x.ev.round === 1 && x.ev.wave === 2);
    expect(extraBeat).toBeGreaterThan(0);
    const extraAct = final.log.slice(extraBeat).find(x => x.ev.t === 'act');
    expect(extraAct?.ev).toMatchObject({ t: 'act', uid: front.uid, mode: 'attack' });
    R.beginBattle(r, final.result, final.gold);
    expect(tutorialComplete(r, 'battle')).toBe(false);
    expect(tutorialComplete(r, 'result')).toBe(false);
    expect(R.finishBattle(r)).toBe(true);
    expect(r.history).toEqual(['win', 'win', 'win', 'win']);
    expect(tutorialComplete(r, 'battle')).toBe(false);
    expect(tutorialComplete(r, 'prep')).toBe(false);
    expect(tutorialComplete(r, 'result')).toBe(true);
    for (const result of ['lose', 'draw'] as const) {
      r.history[3] = result;
      expect(tutorialComplete(r, 'result')).toBe(false);
    }
  });

  it('blocks off-route mutations including hidden controls and wrong destinations', () => {
    const r = newTutorialRun();
    r.draft = scriptDraft(r)!;
    expect(tutorialAllows('recruit-first', r, { kind: 'place', idx: 0, slot: 0 })).toBe(true);
    for (const a of [
      { kind: 'place', idx: 0, slot: 1 }, { kind: 'place', idx: 1, slot: 0 },
      { kind: 'battle' }, { kind: 'sell', slot: 0 }, { kind: 'refund' },
      { kind: 'unequip' }, { kind: 'shop-refresh' }, { kind: 'spell' }, { kind: 'order' },
    ] as TutAction[]) expect(tutorialAllows('recruit-first', r, a)).toBe(false);
    expect(tutorialAllows('step-11', r, { kind: 'move', from: 0, to: 2 })).toBe(false);
    r.picks = 0;
    expect(tutorialAllows('fight-final', r, { kind: 'battle' })).toBe(false);
    r.stash = { power: 1, hp: 1 };
    expect(tutorialAllows('train-general', r, { kind: 'alloc', to: 0, type: 'power' })).toBe(false);
    expect(tutorialAllows('train-unit', r, { kind: 'alloc', to: 1, type: 'hp' })).toBe(false);
    expect(tutorialAllows('swap-front', r, { kind: 'move', from: 0, to: 1 })).toBe(false);
    expect(tutorialAllows('sell-guard', r, { kind: 'sell', slot: 0 })).toBe(false);
    expect(tutorialAllows('shop-buy', r, { kind: 'buy', category: 'units', index: 0 })).toBe(false);
    expect(tutorialAllows('complete', r, { kind: 'battle' })).toBe(false);
  });
});
