import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { classifyTwoStrikeWeakness } from './TwoStrikeWeakness';
import { request, value, code } from './TwoStrikeFixtures.test-support';

describe('technical two-strike weakness recognition', () => {
  it('recognizes confirmed absence without granting mastery', () => {
    const r = value(classifyTwoStrikeWeakness(request())); assert.equal(r.status, 'READY'); assert.equal(r.stateId, null);
    assert.equal(r.familyId, 'two_strike_weakness'); assert.equal(r.lifecycleClass, 'CAUSAL_NEGATIVE_DYNAMIC');
    assert.equal(r.metrics.episodes, 4); assert.equal(r.metrics.spanDays, 3);
    assert.equal('masteryProof' in r, false);
  });
  it('recognizes RED at exact timing and episode thresholds', () => {
    const q = request(); q.observations.slice(0,2).forEach(o => o.recognitionErrorTicks = 5);
    const r = value(classifyTwoStrikeWeakness(q)); assert.equal(r.stateId, 'RED'); assert.equal(r.metrics.failedFraction, 0.5);
  });
  it('recognizes spatial weakness independently of timing', () => {
    const q = request(); q.observations.forEach(o => o.adjustmentErrorM = 0.05);
    assert.equal(value(classifyTwoStrikeWeakness(q)).stateId, 'RED');
  });
  it('recognizes one extreme tier and never stacks red tiers', () => {
    const q = request(); q.observations.slice(0,3).forEach(o => o.recognitionErrorTicks = 10);
    const r = value(classifyTwoStrikeWeakness(q)); assert.equal(r.stateId, 'RED_EXTREME'); assert.equal(r.metrics.extremeFraction, 0.75);
    assert.equal('effects' in r, false);
  });
  it('recognizes severe adjustment residual independently', () => {
    const q = request(); q.observations.forEach(o => o.adjustmentErrorM = 0.1);
    assert.equal(value(classifyTwoStrikeWeakness(q)).stateId, 'RED_EXTREME');
  });
  it('does not promote from one extreme episode', () => {
    const q = request(); q.observations.forEach(o => o.recognitionErrorTicks = 5); q.observations[0]!.recognitionErrorTicks = 100;
    assert.equal(value(classifyTwoStrikeWeakness(q)).stateId, 'RED');
  });
  it('counts both residual dimensions only once per episode', () => {
    const q = request(); q.observations.forEach(o => { o.recognitionErrorTicks = 10; o.adjustmentErrorM = 0.1; });
    const r = value(classifyTwoStrikeWeakness(q)); assert.equal(r.metrics.failedEpisodes, 4); assert.equal(r.metrics.extremeEpisodes, 4);
  });
  it('does not use pitch count as number of recognition opportunities', () => {
    const q = request(); q.observations.forEach(o => o.episodeId = 'same-ab');
    const r = value(classifyTwoStrikeWeakness(q)); assert.equal(r.status, 'UNAVAILABLE'); assert.equal(r.stateId, null); assert.equal(r.metrics.episodes, 1);
  });
  it('counts repeated failed pitches in one episode only once', () => {
    const q = request(); q.observations[0]!.recognitionErrorTicks = 10;
    q.observations.push({ ...q.observations[0]!, eventId: 'extra', time: { season: 1, day: 9, sequence: 1 } });
    const r = value(classifyTwoStrikeWeakness(q)); assert.equal(r.stateId, null); assert.equal(r.metrics.failedEpisodes, 1); assert.equal(r.metrics.samples, 5);
  });
  it('requires elapsed evidence days as well as many episodes', () => {
    const q = request(); q.observations.forEach((o, i) => o.time = { season: 1, day: 11, sequence: i });
    assert.equal(value(classifyTwoStrikeWeakness(q)).status, 'UNAVAILABLE');
  });
  it('marks empty evidence unavailable rather than recovered', () => {
    const q = request(); q.observations = []; const r = value(classifyTwoStrikeWeakness(q));
    assert.equal(r.status, 'UNAVAILABLE'); assert.equal(r.metrics.failedFraction, 0); assert.equal(r.stateId, null);
  });
  it('does not classify a stale source as absence', () => {
    const q = request(); q.time.day = 14; const r = value(classifyTwoStrikeWeakness(q));
    assert.equal(r.status, 'UNAVAILABLE'); assert.ok(r.reasons.includes('STALE_SOURCE'));
  });
  it('keeps the exact source age boundary usable', () => {
    const q = request(); q.time.day = 13; assert.equal(value(classifyTwoStrikeWeakness(q)).status, 'READY');
  });
  it('ignores outside-window evidence for the denominator', () => {
    const q = request(); q.model.windowDays = 3; const r = value(classifyTwoStrikeWeakness(q));
    assert.equal(r.metrics.samples, 3); assert.equal(r.metrics.spanDays, 2);
  });
  it('canonicalizes observation order deterministically', () => {
    const a = request(), b = request(); b.observations.reverse();
    assert.deepEqual(value(classifyTwoStrikeWeakness(a)), value(classifyTwoStrikeWeakness(b)));
  });
  it('retains tiny positive adjustment residuals without numerical collapse', () => {
    const q = request(); q.model.redAdjustmentM = 1e-200; q.model.extremeAdjustmentM = 2e-200;
    q.observations.forEach(o => o.adjustmentErrorM = 2e-200);
    assert.equal(value(classifyTwoStrikeWeakness(q)).stateId, 'RED_EXTREME');
  });
  it('accepts large representable residual without squared overflow', () => {
    const q = request(); q.observations.forEach(o => o.adjustmentErrorM = Number.MAX_VALUE);
    assert.equal(value(classifyTwoStrikeWeakness(q)).stateId, 'RED_EXTREME');
  });
  it('separates new recognition from changes in technical source', () => {
    const q = request(), before = structuredClone(q); const r = value(classifyTwoStrikeWeakness(q));
    assert.deepEqual(q, before); assert.ok(Object.isFrozen(r.request.observations[0])); assert.notEqual(r.request.source, q.source);
  });
  it('rejects hit and strikeout counts instead of treating them as a skill cause', () => {
    code(classifyTwoStrikeWeakness({ ...request(), strikeouts: 30 }), 'INVALID_INPUT');
  });
  it('rejects emotional residuals in the technical baseline', () => {
    const q = request(); code(classifyTwoStrikeWeakness({ ...q, source: { ...q.source, effectBasis: 'AFTER_EMOTION' } }), 'INVALID_INPUT');
  });
});
