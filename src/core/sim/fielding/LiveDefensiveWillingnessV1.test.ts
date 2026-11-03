import { expect, it } from 'vitest';
import { appraisal, candidate, state } from '../../world/psychology/EmotionFixtures.test-support';
import { evaluateEmotion } from '../../world/psychology/EmotionGate';
import { createLiveDefensiveProjectionAuthorityV1 as authority, resolveLiveDefensiveWillingnessV1 as resolve,
  type LiveDefensiveProjectionBindingV1, type LiveDefensiveWillingnessInputV1,
  type LiveVerifiedDefensiveProjectionV1 } from './LiveDefensiveWillingnessV1';
function projection(active = true): LiveVerifiedDefensiveProjectionV1 {
  const initial = state(), offer = active ? candidate(appraisal(initial), 'MOTIVATION', .9) : appraisal(initial),
    evaluated = evaluateEmotion(initial, offer);
  if (!evaluated.ok) throw Error(evaluated.reason.code);
  const s = evaluated.state, a = s.lastAppraisal!, c = s.active ? a.candidates.find(c => c.emotion === s.active!.emotion)! : null;
  return { schemaVersion: 1, emotionState: s, availableAt: { tick: 10, sequence: 0 }, validUntilTick: 30,
    valueDelta: .25, costDelta: -.1, binding: { scope: s.scope, time: { tick: 12, sequence: 0 }, optionId: 'following',
      emotionRevision: s.revision, appraisalId: a.appraisalId, sourceSnapshotId: a.sourceSnapshotId,
      emotionCandidateId: c?.candidateId ?? null, appraisalModelVersion: a.appraisalModelVersion,
      projectionModel: { modelId: 'synthetic-defensive-projection', version: 'test-1' } } };
}
const input = (): LiveDefensiveWillingnessInputV1 => ({ schemaVersion: 1, stage: 'POST_TRAIT_CANDIDATE_VALUE_V1',
  optionId: 'following', value: 2, cost: .4 });
const connected = (p: LiveVerifiedDefensiveProjectionV1, expected: LiveDefensiveProjectionBindingV1 = p.binding): LiveDefensiveWillingnessInputV1 => ({
  ...input(), psychology: { connection: 'CONNECTED', offer: { wrapperReceiptId: 'verified-fixture' }, expected },
});
it('keeps a legacy unconnected input exactly unchanged with explicit NOT_CONNECTED', () => {
  expect(resolve(input())).toMatchObject({ kind: 'RESOLVED', status: 'NOT_CONNECTED', value: 2, cost: .4,
    emotionalValueDelta: 0, emotionalCostDelta: 0, activeEmotion: null, binding: null });
});
it('inactive_emotion_has_exactly_zero_fielding_effect even if candidate potential changes', () => {
  const p = projection(false), a = resolve(connected(p), authority(() => p)),
    b = resolve(connected(p), authority(() => ({ ...p, valueDelta: 100, costDelta: -100 })));
  expect(a).toEqual(b); expect(a).toMatchObject({ kind: 'RESOLVED', status: 'INACTIVE', value: 2, cost: .4,
    emotionalValueDelta: 0, emotionalCostDelta: 0 });
});
it('composes only the verifier-selected active candidate value/cost after the trait exactly once', () => {
  const p = projection(), result = resolve(connected(p), authority(() => p));
  expect(result).toMatchObject({ kind: 'RESOLVED', status: 'ACTIVE', activeEmotion: 'MOTIVATION',
    value: 2.25, cost: .4 - .1, emotionalValueDelta: .25, emotionalCostDelta: -.1 });
  expect(resolve(result as never)).toEqual({ kind: 'REJECTED', reason: 'INVALID_INPUT' });
  expect(resolve({ ...input(), traitMultiplier: 2 } as never)).toEqual({ kind: 'REJECTED', reason: 'INVALID_INPUT' });
});
it('does not trust a raw sidecar or a copied authority and rejects a disconnected verifier', () => {
  const p = projection(), a = authority(() => p);
  expect(resolve(connected(p))).toEqual({ kind: 'REJECTED', reason: 'AUTHORITY_REQUIRED' });
  expect(resolve(connected(p), structuredClone(a))).toEqual({ kind: 'REJECTED', reason: 'AUTHORITY_REQUIRED' });
  expect(resolve(connected(p), authority(() => null))).toEqual({ kind: 'REJECTED', reason: 'PROJECTION_REJECTED' });
  expect(resolve(connected(p), authority(() => { throw Error('stale wrapper source'); }))).toEqual({ kind: 'REJECTED', reason: 'PROJECTION_REJECTED' });
});
it('rejects stale, scope-mismatched, wrong-candidate or wrong-model binding without clearing current emotion', () => {
  const p = projection(), before = JSON.stringify(p.emotionState);
  const wrong = [{ ...p.binding, emotionRevision: 2 }, { ...p.binding, emotionCandidateId: 'other' },
    { ...p.binding, appraisalId: 'other' }, { ...p.binding, sourceSnapshotId: 'other' },
    { ...p.binding, appraisalModelVersion: 'other' },
    { ...p.binding, projectionModel: { modelId: 'other', version: 'test-1' } },
    { ...p.binding, scope: { ...p.binding.scope, playerId: 'other' } }];
  for (const expected of wrong) expect(resolve(connected(p, expected), authority(() => p)).kind).toBe('REJECTED');
  expect(resolve(connected(p), authority(() => ({ ...p, validUntilTick: 11 })))).toMatchObject({ kind: 'REJECTED' });
  expect(resolve(connected(p), authority(() => ({ ...p, availableAt: { tick: 12, sequence: 1 } })))).toMatchObject({ kind: 'REJECTED' });
  const expired = { ...p.binding, time: { tick: 30, sequence: 0 } };
  expect(resolve(connected(p, expired), authority(() => ({ ...p, binding: expired })))).toMatchObject({ kind: 'REJECTED' });
  const beforeGate = { ...p.binding, time: { tick: 9, sequence: 0 } };
  expect(resolve(connected(p, beforeGate), authority(() => ({ ...p, binding: beforeGate, availableAt: { tick: 9, sequence: 0 } })))).toMatchObject({ kind: 'REJECTED' });
  expect(JSON.stringify(p.emotionState)).toBe(before);
});
it('rejects a verifier response whose declared binding differs from its accepted gate', () => {
  const p = projection(), falseBinding = { ...p.binding, emotionRevision: 2 },
    forged = { ...p, binding: falseBinding };
  expect(resolve(connected(p, falseBinding), authority(() => forged))).toMatchObject({ kind: 'REJECTED' });
  const wrongCandidate = { ...p.binding, emotionCandidateId: 'not-the-selected-emotion' };
  expect(resolve(connected(p, wrongCandidate), authority(() => ({ ...p, binding: wrongCandidate })))).toMatchObject({ kind: 'REJECTED' });
});
it('does not accept direct importance, running risk, physical or probability channels', () => {
  for (const bad of [{ importance: 1 }, { runningRiskDelta: 1 }, { catchProbability: 1 }, { throwSpeedMps: 99 }])
    expect(resolve({ ...input(), ...bad } as never)).toEqual({ kind: 'REJECTED', reason: 'INVALID_INPUT' });
  const p = projection();
  expect(resolve(connected(p), authority(() => ({ ...p, runningRiskDelta: 1 } as never)))).toMatchObject({ kind: 'REJECTED' });
});
it('preserves immutable input and validates finite candidate deltas without adding player defaults', () => {
  const p = projection(), raw = connected(p), before = JSON.stringify(raw), frozenBefore = Object.isFrozen(p.emotionState),
    result = resolve(raw, authority(() => p));
  expect(JSON.stringify(raw)).toBe(before); expect(Object.isFrozen(p.emotionState)).toBe(frozenBefore);
  if (result.kind !== 'RESOLVED') throw Error('expected resolved');
  expect(Object.isFrozen(result.binding!.scope)).toBe(true);
  expect(resolve({ ...input(), value: NaN })).toMatchObject({ kind: 'REJECTED', reason: 'INVALID_INPUT' });
  expect(resolve(connected(p), authority(() => ({ ...p, valueDelta: Infinity })))).toMatchObject({ kind: 'REJECTED' });
});
it('accepts a neutral active projection without changing any already resolved candidate arithmetic', () => {
  const p = projection(), result = resolve(connected(p), authority(() => ({ ...p, valueDelta: 0, costDelta: 0 })));
  expect(result).toMatchObject({ kind: 'RESOLVED', status: 'ACTIVE', value: input().value, cost: input().cost,
    emotionalValueDelta: 0, emotionalCostDelta: 0 });
  expect(resolve({ ...input(), psychology: { connection: 'NOT_CONNECTED' } })).toEqual(resolve(input()));
});
it('lets the wrapper recompute the entire sidecar rather than authorizing an unchanged receipt ID', () => {
  const p = projection(), canonical = { receiptId: 'same-id', source: p.binding.sourceSnapshotId, delta: p.valueDelta },
    verifier = authority(offer => JSON.stringify(offer) === JSON.stringify(canonical) ? p : null),
    raw = { ...input(), psychology: { connection: 'CONNECTED' as const, expected: p.binding, offer: canonical } };
  expect(resolve(raw, verifier).kind).toBe('RESOLVED');
  expect(resolve({ ...raw, psychology: { ...raw.psychology, offer: { ...canonical, delta: .8 } } }, verifier))
    .toEqual({ kind: 'REJECTED', reason: 'PROJECTION_REJECTED' });
  let reads = 0;
  const unreadable = { ...canonical };
  Object.defineProperty(unreadable, 'delta', { enumerable: true, get() { reads++; return .8; } });
  expect(resolve({ ...raw, psychology: { ...raw.psychology, offer: unreadable } }, verifier).kind).toBe('REJECTED');
  expect(reads).toBe(0);
});
