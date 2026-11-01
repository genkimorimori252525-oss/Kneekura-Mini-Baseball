import { expect, it } from 'vitest';
import {
  appendBatterObservedEvidenceV151, createBatterObservedEvidenceV151, createEmptyBatterObservedMemoryV151,
  recallBatterObservedMemoryV151, validateBatterObservedEvidenceV151, validateBatterObservedMemoryPolicyV151,
  validateBatterObservedMemoryV151, type BatterObservedEvidenceV151, type BatterObservedMemoryPolicyV151,
} from './BatterObservedMemoryV151';
import type { forecastObservedPitchV151 } from './ObservedPitchForecastV151';

const policy = (maximumEntriesPerPair = 3):BatterObservedMemoryPolicyV151 => ({
  version:'batter_observed_memory_policy_v151', sourceId:'explicit-operation-policy-not-human-calibration',
  maximumEntriesPerPair, unprofiledPriorWeight:.25,
});
const forecast = ():ReturnType<typeof forecastObservedPitchV151> => ({
  version:'observed_pitch_forecast_v151', status:'PREDICTED', cutoffTick:140000,
  observedThroughTick:120000, availableAtTick:130000, usedObservationIds:['sample-1', 'sample-2', 'sample-3'],
  prediction:{ position:{ x:.1, y:1.2, z:0 }, arrivalAfterReleaseSeconds:.45,
    estimatedVelocity:{ x:1, y:-1, z:-35 }, estimatedAcceleration:{ x:0, y:-10, z:1 } },
  model:'POSITION_SAMPLES_CONSTANT_ACCELERATION_EXTRAPOLATION', humanCalibration:'NOT_MEASURED',
  opponentPrivateStateUsed:false, futureSourceUsed:false,
});
const source = () => ({ evidenceId:'pitch-1', observerPlayerId:'b', pitcherId:'p', pitchOrdinal:1, forecast:forecast(), regionId:'observed-middle' });
const evidence = (ordinal = 1):BatterObservedEvidenceV151 => ({
  version:'batter_observed_evidence_v151', evidenceId:'pitch-' + ordinal, observerPlayerId:'b', pitcherId:'p', pitchOrdinal:ordinal,
  observedTick:ordinal * 1000, availableTick:ordinal * 1000 + 100, position:{ x:ordinal / 10, y:1.2, z:0 },
  arrivalAfterReleaseSeconds:.4 + ordinal / 100, regionId:'observed-middle', classification:'UNCLASSIFIED_OBSERVED_FLIGHT',
  sourceObservationIds:['sample-' + ordinal],
});
const empty = () => createEmptyBatterObservedMemoryV151({ observerPlayerId:'b', pitcherId:'p' });

it('requires an explicit bounded operation policy without inventing a player confidence or preference', () => {
  const valid = validateBatterObservedMemoryPolicyV151(policy());
  expect(valid).toEqual(policy()); expect(Object.isFrozen(valid)).toBe(true);
  for (const raw of [null, { ...policy(), sourceId:'' }, { ...policy(), maximumEntriesPerPair:0 },
    { ...policy(), maximumEntriesPerPair:65 }, { ...policy(), maximumEntriesPerPair:1.5 },
    { ...policy(), unprofiledPriorWeight:NaN }, { ...policy(), unprofiledPriorWeight:1.01 },
    { ...policy(), confidence:.5 }]) expect(() => validateBatterObservedMemoryPolicyV151(raw)).toThrow();
});

it('builds evidence from the raw delivered forecast and dates availability at calculation cutoff', () => {
  const raw = source(), before = JSON.stringify(raw), built = createBatterObservedEvidenceV151(raw)!;
  expect(built).toEqual({ version:'batter_observed_evidence_v151', evidenceId:'pitch-1', observerPlayerId:'b', pitcherId:'p', pitchOrdinal:1,
    observedTick:120000, availableTick:140000, position:{ x:.1, y:1.2, z:0 }, arrivalAfterReleaseSeconds:.45,
    regionId:'observed-middle', classification:'UNCLASSIFIED_OBSERVED_FLIGHT', sourceObservationIds:['sample-1', 'sample-2', 'sample-3'] });
  expect(JSON.stringify(raw)).toBe(before); expect(Object.isFrozen(raw.forecast.prediction)).toBe(false);
  expect(Object.isFrozen(built.position)).toBe(true); expect(Object.isFrozen(built.sourceObservationIds)).toBe(true);
  expect('familyId' in built).toBe(false); expect('confidence' in built).toBe(false); expect('reliability' in built).toBe(false);
});

it('does not treat an absent prediction, a prepared mixture or private pitch/result fields as new evidence', () => {
  const none = { ...forecast(), status:'INSUFFICIENT_OBSERVATIONS' as const, prediction:null,
    usedObservationIds:['one-sample'], observedThroughTick:100000, availableAtTick:110000 };
  expect(createBatterObservedEvidenceV151({ ...source(), forecast:none })).toBeNull();
  for (const raw of [
    { ...source(), actualPitchType:'curve' },
    { ...source(), forecast:{ ...forecast(), pitchType:'curve' } },
    { ...source(), forecast:{ ...forecast(), sourceDescriptor:{} } },
    { ...source(), forecast:{ ...forecast(), preparedAndObservedPrediction:{ x:2, y:2, z:0 } } },
    { ...source(), forecast:{ ...forecast(), prediction:{ ...forecast().prediction!, confidence:1 } } },
    { ...source(), forecast:{ ...forecast(), futureSourceUsed:true } },
    { ...source(), forecast:{ ...forecast(), cutoffTick:100000 } },
  ]) expect(() => createBatterObservedEvidenceV151(raw as ReturnType<typeof source>)).toThrow();
});

it('learns the first accepted observation from an empty memory without a fabricated prior', () => {
  const initial = empty(); expect(initial.totalObservations).toBe(0);
  expect(recallBatterObservedMemoryV151(initial, { atTick:5000, draw:.2, priorWeight:.8 })).toBeNull();
  const next = appendBatterObservedEvidenceV151(initial, evidence(), policy(), 1100);
  expect(next.totalObservations).toBe(1); expect(next.entries).toEqual([evidence()]);
  const recalled = recallBatterObservedMemoryV151(next, { atTick:1100, draw:.99, priorWeight:.8 });
  expect(recalled).toEqual({ kind:'UNCLASSIFIED_EMPIRICAL_FORECAST', evidenceId:'pitch-1', position:evidence().position,
    arrivalAfterReleaseSeconds:evidence().arrivalAfterReleaseSeconds, observedThroughTick:1000, eligibleObservationCount:1, empiricalProbability:1,
    priorWeight:.8, confidence:null, pitchFamilyRecognized:false });
  expect(initial).toEqual(empty());
});

it('accepts only the observer own arrived next evidence and preserves state on every rejection', () => {
  const first = appendBatterObservedEvidenceV151(empty(), evidence(2), policy(), 2100), before = JSON.stringify(first);
  for (const [item, acceptedAt] of [
    [evidence(3), 3099],
    [{ ...evidence(3), observerPlayerId:'other' }, 3100],
    [{ ...evidence(3), pitcherId:'other' }, 3100],
    [evidence(2), 3100],
    [evidence(1), 3100],
    [{ ...evidence(3), evidenceId:'pitch-2' }, 3100],
    [{ ...evidence(3), observedTick:2000 }, 3100],
    [{ ...evidence(3), availableTick:2100, observedTick:2050 }, 3100],
  ] as const) {
    expect(() => appendBatterObservedEvidenceV151(first, item, policy(), acceptedAt)).toThrow();
    expect(JSON.stringify(first)).toBe(before);
  }
});

it('bounds retained observations while preserving total count and rejecting replay of an evicted ordinal', () => {
  let memory = empty();
  for (let ordinal = 1; ordinal <= 5; ordinal++) memory = appendBatterObservedEvidenceV151(memory, evidence(ordinal), policy(2), ordinal * 1000 + 100);
  expect(memory.totalObservations).toBe(5); expect(memory.entries.map(entry => entry.pitchOrdinal)).toEqual([4, 5]);
  expect(() => appendBatterObservedEvidenceV151(memory, evidence(1), policy(2), 6100)).toThrow();
  expect(validateBatterObservedMemoryV151(memory)).toEqual(memory);
});

it('recalls only arrived empirical observations with a deterministic external draw and no inferred confidence', () => {
  let memory = empty();
  for (let ordinal = 1; ordinal <= 3; ordinal++) memory = appendBatterObservedEvidenceV151(memory, evidence(ordinal), policy(), ordinal * 1000 + 100);
  expect(recallBatterObservedMemoryV151(memory, { atTick:1099, draw:0, priorWeight:.25 })).toBeNull();
  expect(recallBatterObservedMemoryV151(memory, { atTick:1100, draw:.999, priorWeight:0 })!.evidenceId).toBe('pitch-1');
  const selections = [0, .34, .68].map(draw => recallBatterObservedMemoryV151(memory, { atTick:3100, draw, priorWeight:.7 })!);
  expect(selections.map(item => item.evidenceId)).toEqual(['pitch-1', 'pitch-2', 'pitch-3']);
  expect(selections.every(item => item.empiricalProbability === 1 / 3 && item.priorWeight === .7
    && item.confidence === null && item.pitchFamilyRecognized === false)).toBe(true);
  expect(recallBatterObservedMemoryV151(memory, { atTick:3100, draw:.34, priorWeight:.7 })).toEqual(selections[1]);
  for (const input of [{ atTick:NaN, draw:0, priorWeight:.2 }, { atTick:3100, draw:1, priorWeight:.2 },
    { atTick:3100, draw:0, priorWeight:-1 }, { atTick:3100, draw:0, priorWeight:.2, actualPitchType:'curve' }])
    expect(() => recallBatterObservedMemoryV151(memory, input)).toThrow();
});

it('validates inert evidence and retained chronology, with no confidence or result-derived schema', () => {
  for (const raw of [{ ...evidence(), pitchOrdinal:0 }, { ...evidence(), availableTick:999 },
    { ...evidence(), position:{ ...evidence().position, z:Infinity } }, { ...evidence(), classification:'curve' },
    { ...evidence(), sourceObservationIds:['same', 'same'] }, { ...evidence(), reliability:1 },
    { ...evidence(), observedTick:Number.MAX_SAFE_INTEGER + 1 }]) expect(() => validateBatterObservedEvidenceV151(raw)).toThrow();
  const valid = appendBatterObservedEvidenceV151(empty(), evidence(), policy(), 1100);
  for (const raw of [{ ...valid, totalObservations:0 }, { ...valid, totalObservations:NaN },
    { ...valid, entries:[evidence(2), evidence(1)], totalObservations:2 },
    { ...valid, entries:[{ ...evidence(), observerPlayerId:'other' }] },
    { ...valid, priorProbability:1 }]) expect(() => validateBatterObservedMemoryV151(raw)).toThrow();
  let accessed = false; const accessor = { ...evidence() };
  Object.defineProperty(accessor, 'position', { enumerable:true, get(){ accessed = true; return evidence().position; } });
  expect(() => validateBatterObservedEvidenceV151(accessor)).toThrow(); expect(accessed).toBe(false);
});
