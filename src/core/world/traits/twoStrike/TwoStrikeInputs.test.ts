import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { evaluateTrait } from '../index';
import { evaluation, assessment } from '../TraitFixtures.test-support';
import { getEmotionInfluence } from '../../psychology/index';
import { prepareTwoStrikeInput } from './TwoStrikeInputs';
import { input, mutable, withEmotion, value, code } from './TwoStrikeFixtures.test-support';

describe('two-strike technique/weakness/emotion source separation', () => {
  it('keeps the original learned proof separate from current execution', () => {
    const q = input(), r = value(prepareTwoStrikeInput(q));
    assert.equal(r.boundary, 'TWO_STRIKE_INPUT_ONLY'); assert.deepEqual(r.technical, q.current);
    assert.equal(r.learnedTechniques.length, 2); assert.ok(r.learnedTechniques.every(t => t.acquired && t.feasible));
    assert.equal(r.learnedTechniques[1]!.masteryProof!.source.sourceSnapshotId, 'proof/two_strike_adjustment');
  });
  it('allows severe current weakness while learned mastery remains', () => {
    const q = input(); q.classificationRequest!.observations.forEach(o => o.recognitionErrorTicks = 20);
    const r = value(prepareTwoStrikeInput(q)); assert.equal(r.weakness.stateId, 'RED_EXTREME');
    assert.ok(r.learnedTechniques.every(t => t.acquired)); assert.equal(q.traits.entries.length, 2);
  });
  it('does not remove mastery when current feasibility is false', () => {
    const q = input(); q.current.techniques.forEach(t => t.feasible = false);
    const r = value(prepareTwoStrikeInput(q)); assert.ok(r.learnedTechniques.every(t => t.acquired && !t.feasible));
    assert.ok(r.learnedTechniques.every(t => t.masteryProof !== null));
  });
  it('reuses retained proof after an existing lifecycle reevaluation', () => {
    const q = input(); const e = mutable(evaluation(q.traits, 'two_strike_adjustment', assessment(null), 3));
    e.source.sourceKey = 'skill/two_strike_adjustment'; e.source.sourceSnapshotId = 'reevaluated/2';
    q.traits = mutable(value(evaluateTrait(q.traits, e)).state); q.frame.expectedTraitRevision = q.traits.revision;
    const r = value(prepareTwoStrikeInput(q)); assert.equal(r.learnedTechniques[1]!.acquired, true);
    assert.equal(r.learnedTechniques[1]!.masteryProof!.evaluationId, 'learned/two_strike_adjustment');
  });
  it('does not unlock or increase current numeric skill from a named label', () => {
    const a = value(prepareTwoStrikeInput(input(false))), b = value(prepareTwoStrikeInput(input(true)));
    assert.deepEqual(a.technical, b.technical); assert.ok(a.learnedTechniques.every(t => !t.acquired));
    assert.ok(b.learnedTechniques.every(t => t.acquired));
  });
  it('does not lower numeric skill again when negative recognition changes', () => {
    const q = input(), a = value(prepareTwoStrikeInput(q));
    q.classificationRequest!.observations.forEach(o => o.recognitionErrorTicks = 20);
    const b = value(prepareTwoStrikeInput(q)); assert.deepEqual(a.technical, b.technical);
    assert.notEqual(a.weakness.stateId, b.weakness.stateId); assert.deepEqual(a.emotion, b.emotion);
  });
  it('can clear recognized weakness without modifying stored mastery', () => {
    const q = input(); q.classificationRequest!.observations.forEach(o => o.recognitionErrorTicks = 20);
    const a = value(prepareTwoStrikeInput(q));
    q.classificationRequest!.classificationId = 'new-assessment'; q.classificationRequest!.observations.forEach(o => o.recognitionErrorTicks = 0);
    const b = value(prepareTwoStrikeInput(q)); assert.equal(a.weakness.stateId, 'RED_EXTREME'); assert.equal(b.weakness.stateId, null);
    assert.deepEqual(a.learnedTechniques, b.learnedTechniques);
  });
  it('returns unassessed rather than confirmed absence when assessment is missing', () => {
    const q = input(); q.classificationRequest = null;
    assert.equal(value(prepareTwoStrikeInput(q)).weakness.status, 'UNASSESSED');
  });
  it('preserves insufficient evidence as unavailable', () => {
    const q = input(); q.classificationRequest!.observations = [];
    assert.equal(value(prepareTwoStrikeInput(q)).weakness.status, 'UNAVAILABLE');
  });
  it('invalidates previous-source recognition without deleting learned technique', () => {
    const q = input(); q.current.source.revision++; q.current.source.snapshotId = 'baseline/6';
    q.frame.currentSource = { sourceKey: 'baseline', revision: 6, snapshotId: 'baseline/6' };
    const r = value(prepareTwoStrikeInput(q)); assert.equal(r.weakness.status, 'UNAVAILABLE');
    assert.ok(r.weakness.reasons.includes('SOURCE_CHANGED')); assert.ok(r.learnedTechniques.every(t => t.acquired));
  });
  it('invalidates a superseded classification model', () => {
    const q = input(); q.frame.recognitionModel.version = '2'; const r = value(prepareTwoStrikeInput(q));
    assert.equal(r.weakness.status, 'UNAVAILABLE'); assert.ok(r.weakness.reasons.includes('MODEL_CHANGED'));
  });
  it('does not reuse yesterday recognition as current evidence', () => {
    const q = input(); q.frame.time.day++; const r = value(prepareTwoStrikeInput(q));
    assert.equal(r.weakness.status, 'UNAVAILABLE'); assert.ok(r.weakness.reasons.includes('ASSESSMENT_EXPIRED'));
  });
  for (const strikes of [0,1] as const) it(`does not activate count-specific inputs at ${strikes} strikes`, () => {
    const q = input(); q.frame.strikes = strikes; const r = value(prepareTwoStrikeInput(q));
    assert.equal(r.technical, null); assert.equal(r.weakness.status, 'OUT_OF_CONTEXT');
    assert.ok(r.learnedTechniques.every(t => t.acquired));
  });
  it('keeps neutral emotion completely effect-free', () => {
    const r = value(prepareTwoStrikeInput(input())); assert.equal(r.emotion.activeEmotion, null); assert.equal(r.emotion.effects, null);
  });
  it('reuses exactly one existing active emotion influence without adding it to baseline twice', () => {
    const q = input(); withEmotion(q); const r = value(prepareTwoStrikeInput(q));
    assert.deepEqual(r.emotion, value(getEmotionInfluence(q.emotion))); assert.equal(r.emotion.activeEmotion, 'FEAR');
    assert.equal(r.emotion.effects!.swingDecisionShiftTicks, 2); assert.equal(r.technical!.recognitionDelayTicks, 3);
    assert.equal('directPressureBonus' in r, false);
  });
  it('does not block general active emotion outside a two-strike count', () => {
    const q = input(); withEmotion(q); q.frame.strikes = 1; const r = value(prepareTwoStrikeInput(q));
    assert.equal(r.technical, null); assert.equal(r.emotion.activeEmotion, 'FEAR');
  });
  it('does not invent a pressure bonus from a high or low grade when neutral', () => {
    const q = input(), initial = value(prepareTwoStrikeInput(q));
    q.traits = mutable(value(evaluateTrait(q.traits, evaluation(q.traits, 'bat_pressure', { kind: 'CURRENT_SOURCE', stateId: 'GOLD' }, 4))).state);
    q.frame.expectedTraitRevision = q.traits.revision;
    const r = value(prepareTwoStrikeInput(q)); assert.deepEqual(r.technical, initial.technical); assert.deepEqual(r.emotion, initial.emotion);
  });
  it('preserves one gate influence regardless of stored pressure grade', () => {
    const q = input(); withEmotion(q); const initial = value(prepareTwoStrikeInput(q));
    q.traits = mutable(value(evaluateTrait(q.traits, evaluation(q.traits, 'bat_pressure', { kind: 'CURRENT_SOURCE', stateId: 'G' }, 4))).state);
    q.frame.expectedTraitRevision = q.traits.revision;
    const r = value(prepareTwoStrikeInput(q)); assert.deepEqual(r.emotion, initial.emotion);
  });
  it('accepts an evaluated neutral gate without secretly activating a candidate', () => {
    const q = input(); withEmotion(q, false); const r = value(prepareTwoStrikeInput(q));
    assert.equal(r.emotion.revision, 1); assert.equal(r.emotion.effects, null);
  });
  it('retains a bounded adjustment spread even if a technique is currently infeasible', () => {
    const q = input(); q.current.techniques[1]!.feasible = false;
    const r = value(prepareTwoStrikeInput(q)); assert.equal(r.technical!.adjustmentSpreadM, q.current.adjustmentSpreadM);
    assert.equal(r.technical!.techniques[1]!.feasible, false);
  });
  it('returns detached immutable evidence without touching caller data', () => {
    const q = input(), before = structuredClone(q); const r = value(prepareTwoStrikeInput(q));
    assert.deepEqual(q, before); assert.notEqual(r.frame, q.frame); assert.ok(Object.isFrozen(r.learnedTechniques[1]!.masteryProof!.source));
    q.current.recognitionDelayTicks = 100; assert.equal(r.technical!.recognitionDelayTicks, 3);
  });
  it('produces identical inputs across JSON save/restore and repeated evaluation', () => {
    const q = input(); withEmotion(q); const r = value(prepareTwoStrikeInput(q));
    assert.deepEqual(r, value(prepareTwoStrikeInput(JSON.parse(JSON.stringify(q))))); assert.deepEqual(r, value(prepareTwoStrikeInput(q)));
  });
  it('rejects a caller-written negative tier instead of trusting it', () => {
    const q = input(); code(prepareTwoStrikeInput({ ...q, weakness: 'RED_EXTREME' }), 'INVALID_INPUT');
  });
});
