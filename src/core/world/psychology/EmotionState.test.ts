import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createEmotionState, restoreEmotionState, getEmotionInfluence } from './EmotionState';
import { scope, policy, state } from './EmotionFixtures.test-support';

test('new match starts neutral with no emotion contribution', () => {
  const s = state(); assert.equal(s.revision, 0); assert.equal(s.active, null);
  const output = getEmotionInfluence(s); assert.ok(output.ok);
  assert.equal(output.value.activeEmotion, null); assert.equal(output.value.effects, null); assert.equal(output.value.source, null);
});
test('created state detaches and freezes nested caller data without freezing caller', () => {
  const input = { scope: { ...scope }, policy: policy() };
  const r = createEmotionState(input); assert.ok(r.ok);
  assert.notEqual(r.value.scope, input.scope); assert.notEqual(r.value.policy.thresholds, input.policy.thresholds);
  input.scope.playerId = 'changed'; assert.equal(r.value.scope.playerId, 'player');
  assert.ok(Object.isFrozen(r.value.policy.thresholds[0])); assert.equal(Object.isFrozen(input.policy), false);
});
test('state survives JSON restore without consulting any live world', () => {
  const s = state(), r = restoreEmotionState(JSON.parse(JSON.stringify(s))); assert.ok(r.ok); assert.deepEqual(r.value, s);
});
for (const value of [null, [], {}, { scope }, { scope, policy: policy(), extra: true }]) {
  test('rejects incomplete or extra creation shape ' + JSON.stringify(value), () => assert.equal(createEmotionState(value).ok, false));
}
for (const value of [NaN, Infinity, -1, 0, 0.1, Number.MAX_SAFE_INTEGER + 1]) {
  test('rejects invalid calm-event count ' + value, () => assert.equal(createEmotionState({ scope,
    policy: { ...policy(), clearAfterCalmEvents: value } }).ok, false));
}
test('activation must be strictly greater than sustain for every emotion', () => {
  const p = policy(); assert.equal(createEmotionState({ scope, policy: { ...p,
    thresholds: p.thresholds.map(x => ({ ...x, sustain: x.activation })) } }).ok, false);
});
test('requires each of the five policy entries exactly once', () => {
  const p = policy();
  for (const thresholds of [p.thresholds.slice(1), [...p.thresholds, p.thresholds[0]], [...p.thresholds.slice(1), p.thresholds[1]]])
    assert.equal(createEmotionState({ scope, policy: { ...p, thresholds } }).ok, false);
});
test('rejects accessor properties without evaluating them', () => {
  let touched = false; const input = { scope, get policy() { touched = true; return policy(); } };
  assert.equal(createEmotionState(input).ok, false); assert.equal(touched, false);
});
test('rejects sparse threshold arrays instead of silently accepting missing entries', () => {
  const p = policy(), thresholds = [...p.thresholds]; delete thresholds[2];
  assert.equal(createEmotionState({ scope, policy: { ...p, thresholds } }).ok, false);
});
test('rejects a non-neutral revision-zero checkpoint', () => {
  assert.equal(restoreEmotionState({ ...state(), calmObservations: 1 }).ok, false);
});
test('neutral state cannot pretend to have consumed an appraisal', () => {
  assert.equal(restoreEmotionState({ ...state(), revision: 1 }).ok, false);
});
test('invalid restored scope rejects and no caller data is frozen', () => {
  const s = JSON.parse(JSON.stringify(state())); s.scope.playerId = '';
  assert.equal(restoreEmotionState(s).ok, false); assert.equal(Object.isFrozen(s), false);
});
