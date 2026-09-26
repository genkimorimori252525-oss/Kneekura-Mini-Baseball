import { expect, it } from 'vitest';
import { applyPlayerRelationshipEvidence,
  createPlayerRelationshipNetwork } from './PlayerRelationships';

const policy = () => ({ policyId: 'synthetic-relationships',
  version: 'v1', availableAtDay: 0,
  baseline: { affinity: 50, trust: 50, coordination: 50 },
  deltas: {
    SHARED_SUCCESS: { affinity: 2, trust: 0, coordination: 0 },
    MUTUAL_SUPPORT: { affinity: 4, trust: 0, coordination: 0 },
    JOINT_REPETITION: { affinity: 0, trust: 0, coordination: 5 },
    JOINT_EXECUTION: { affinity: 0, trust: 0, coordination: 3 },
    JOINT_FAILURE: { affinity: 0, trust: 0, coordination: -10 },
    CONFLICT: { affinity: -5, trust: 0, coordination: 0 },
    TRUST_BREACH: { affinity: 0, trust: -6, coordination: 0 },
    ROLE_COMPETITION: { affinity: -2, trust: 0, coordination: 0 },
  },
});
const evidence = (kind: 'SHARED_SUCCESS' | 'MUTUAL_SUPPORT'
  | 'JOINT_REPETITION' | 'JOINT_EXECUTION' | 'JOINT_FAILURE'
  | 'CONFLICT' | 'TRUST_BREACH'
  | 'ROLE_COMPETITION', eventId: string, fromPlayerId: string,
  toPlayerId: string, atDay = 10) => ({ eventId,
  sourceEventId: `source-${eventId}`, atDay,
  fromPlayerId, toPlayerId, kind,
  ...((kind === 'JOINT_REPETITION' || kind === 'JOINT_EXECUTION'
    || kind === 'JOINT_FAILURE')
    ? { task: 'MIDDLE_INFIELD' as const } : {}),
});

it('keeps directional affinity, trust and joint coordination distinct', () => {
  let state = createPlayerRelationshipNetwork('career-1', policy());
  state = applyPlayerRelationshipEvidence(state, 0,
    evidence('SHARED_SUCCESS', 'shared-1', 'a', 'b')).state;
  state = applyPlayerRelationshipEvidence(state, 1,
    evidence('MUTUAL_SUPPORT', 'support-1', 'b', 'a')).state;
  state = applyPlayerRelationshipEvidence(state, 2,
    evidence('JOINT_REPETITION', 'joint-1', 'a', 'b')).state;
  state = applyPlayerRelationshipEvidence(state, 3,
    evidence('JOINT_EXECUTION', 'execution-1', 'a', 'b')).state;
  expect(state.links).toMatchObject([
    { fromPlayerId: 'a', toPlayerId: 'b', affinity: 52,
      trust: 50, coordinationByTask: { MIDDLE_INFIELD: 58 },
      sharedSuccessMemory: 1 },
    { fromPlayerId: 'b', toPlayerId: 'a', affinity: 54,
      trust: 50, coordinationByTask: {}, sharedSuccessMemory: 0 },
  ]);
  const battery = applyPlayerRelationshipEvidence(state, 4, {
    ...evidence('JOINT_REPETITION', 'joint-battery', 'a', 'b', 11),
    task: 'BATTERY' as const,
  }).state;
  expect(battery.links[0]?.coordinationByTask)
    .toEqual({ MIDDLE_INFIELD: 58, BATTERY: 55 });
  const breached = applyPlayerRelationshipEvidence(battery, 5,
    evidence('TRUST_BREACH', 'breach-1', 'a', 'b', 12)).state;
  expect(breached.links[0]).toMatchObject({ trust: 44,
    coordinationByTask: { MIDDLE_INFIELD: 58, BATTERY: 55 } });
  expect(Object.isFrozen(state.links[0])).toBe(true);
  expect(state.links[0]).not.toHaveProperty('battingModifier');
});

it('records conflict without an ability penalty and carries the pair across seasons', () => {
  const initial = createPlayerRelationshipNetwork('career-1', policy());
  const first = applyPlayerRelationshipEvidence(initial, 0,
    evidence('CONFLICT', 'conflict-1', 'a', 'b'));
  const later = applyPlayerRelationshipEvidence(first.state, 1,
    evidence('MUTUAL_SUPPORT', 'support-1', 'a', 'b', 370));
  expect(later.state.links[0]).toMatchObject({ affinity: 49,
    trust: 50, coordinationByTask: {}, conflictMemory: 1,
    lastMeaningfulInteraction: 370 });
  expect(first.event).toMatchObject({ before: null,
    after: { conflictMemory: 1 } });
  expect(initial.links).toHaveLength(0);
});

it('rejects stale and duplicate evidence and policy-made coordination from friendship', () => {
  const initial = createPlayerRelationshipNetwork('career-1', policy());
  const first = applyPlayerRelationshipEvidence(initial, 0,
    evidence('SHARED_SUCCESS', 'shared-1', 'a', 'b'));
  expect(() => applyPlayerRelationshipEvidence(first.state, 0,
    evidence('JOINT_REPETITION', 'joint-1', 'a', 'b'))).toThrow('stale');
  expect(() => applyPlayerRelationshipEvidence(first.state, 1,
    evidence('SHARED_SUCCESS', 'shared-1', 'a', 'b'))).toThrow('duplicate');
  expect(() => applyPlayerRelationshipEvidence(first.state, 1,
    { ...evidence('SHARED_SUCCESS', 'shared-2', 'a', 'b'),
      sourceEventId: 'source-shared-1' })).toThrow('duplicate');
  expect(() => createPlayerRelationshipNetwork('career-1', {
    ...policy(), deltas: { ...policy().deltas,
      MUTUAL_SUPPORT: { affinity: 4, trust: 0,
        coordination: 5 } } })).toThrow('coordination');
  expect(() => createPlayerRelationshipNetwork('career-1', {
    ...policy(), deltas: { ...policy().deltas,
      MUTUAL_SUPPORT: { affinity: 4, trust: 1,
        coordination: 0 } } })).toThrow('dimension');
  expect(() => applyPlayerRelationshipEvidence(initial, 0,
    { ...evidence('JOINT_REPETITION', 'joint-1', 'a', 'b'),
      task: undefined })).toThrow('task');
  expect(() => applyPlayerRelationshipEvidence(initial, 0,
    { ...evidence('CONFLICT', 'conflict-2', 'a', 'b'),
      task: 'BATTERY' })).toThrow('evidence');
  expect(() => applyPlayerRelationshipEvidence(initial, 0,
    { ...evidence('JOINT_REPETITION', 'joint-unknown', 'a', 'b'),
      task: 'FOOTBALL' as 'BATTERY' })).toThrow('task');
});
