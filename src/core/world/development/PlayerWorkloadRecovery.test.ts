import { expect, it } from 'vitest';
import { advancePlayerWorkloadRecovery, createPlayerWorkloadRecovery,
  type PlayerWorkloadActivity, type PlayerWorkloadRecoveryPolicy } from './PlayerWorkloadRecovery';

const policy: PlayerWorkloadRecoveryPolicy = { policyId: 'workload', version: 'v1', availableAtDay: 0,
  workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 };
const baseline = () => createPlayerWorkloadRecovery({ careerId: 'career', playerId: 'player', createdAtDay: 1,
  fatigue: 0.2, recoveryCapacity: 0.5, policy });
const activity = (sourceEventId: string, atDay: number, detail:
  Pick<Extract<PlayerWorkloadActivity, { kind: 'MATCH' }>, 'kind' | 'effortUnits'>
  | Pick<Extract<PlayerWorkloadActivity, { kind: 'PRACTICE' }>, 'kind' | 'effortUnits' | 'healthAvailability'>
  | Pick<Extract<PlayerWorkloadActivity, { kind: 'TRAVEL' }>, 'kind' | 'distanceKm'>
  | Pick<Extract<PlayerWorkloadActivity, { kind: 'RECOVERY' }>, 'kind' | 'durationHours' | 'quality' | 'medicalAvailability'>,
): PlayerWorkloadActivity => ({ sourceEventId, sourceVersion: 'v1', evidenceId: `evidence-${sourceEventId}`,
  careerId: 'career', playerId: 'player', atDay, ...detail });

it('accumulates actual workload and travel; only actual capacity-weighted rest removes fatigue', () => {
  const initial = baseline();
  const match = advancePlayerWorkloadRecovery(initial, 0, activity('match', 2, { kind: 'MATCH', effortUnits: 3 }));
  expect(match.fatigue).toBeCloseTo(0.5);
  const road = advancePlayerWorkloadRecovery(match, 1, activity('road', 3, { kind: 'TRAVEL', distanceKm: 200 }));
  expect(road.fatigue).toBeCloseTo(0.7);
  const rest = activity('rest', 4, { kind: 'RECOVERY', durationHours: 8, quality: 0.5, medicalAvailability: 0.5 });
  expect(advancePlayerWorkloadRecovery(road, 2, rest).fatigue).toBeCloseTo(0.6);
  expect(advancePlayerWorkloadRecovery({ ...road, recoveryCapacity: 0 }, 2, rest).fatigue).toBeCloseTo(0.7);
  expect(initial).toEqual(baseline());
  expect(Object.isFrozen(initial.policy)).toBe(true);
});

it('missing days do not reset fatigue; saturation is bounded and same-day order is explicit', () => {
  const exhausted = advancePlayerWorkloadRecovery(baseline(), 0, activity('match', 2, { kind: 'MATCH', effortUnits: 20 }));
  const practice = advancePlayerWorkloadRecovery(exhausted, 1, activity('practice', 80, { kind: 'PRACTICE', effortUnits: 0, healthAvailability: 0.4 }));
  expect(practice.fatigue).toBe(1);
  expect(practice.effectiveDay).toBe(80);
  const rest = advancePlayerWorkloadRecovery(practice, 2, activity('rest', 80, { kind: 'RECOVERY', durationHours: 24, quality: 1, medicalAvailability: 1 }));
  expect(rest.fatigue).toBe(0);
  expect(practice.fatigue).toBe(1);
});

it('rejects scope/chronology/revision/unknown facts, finite arithmetic overflow and getters', () => {
  const initial = baseline(), match = activity('match', 2, { kind: 'MATCH', effortUnits: 1 });
  for (const invalid of [{ ...match, playerId: 'other' }, { ...match, atDay: 0 }, { ...match, effortUnits: -1 },
    { ...match, outcome: 'WIN' }, { ...match, kind: 'OFF_DAY' }, { ...match, sourceVersion: ' ' }]) {
    expect(() => advancePlayerWorkloadRecovery(initial, 0, invalid as PlayerWorkloadActivity)).toThrow();
  }
  expect(() => advancePlayerWorkloadRecovery(initial, 1, match)).toThrow(/revision/);
  expect(() => advancePlayerWorkloadRecovery({ ...initial, revision: Number.MAX_SAFE_INTEGER }, Number.MAX_SAFE_INTEGER, match)).toThrow();
  expect(() => advancePlayerWorkloadRecovery({ ...initial, policy: { ...policy, workloadFatiguePerUnit: Number.MAX_VALUE } }, 0,
    activity('overflow', 2, { kind: 'MATCH', effortUnits: 2 }))).toThrow(/overflow/);
  expect(() => createPlayerWorkloadRecovery({ careerId: 'career', playerId: 'player', createdAtDay: 1,
    fatigue: 0, recoveryCapacity: 1, policy: { ...policy, availableAtDay: 2 } })).toThrow();
  let calls = 0;
  const accessor = Object.defineProperty({ ...match }, 'effortUnits', { enumerable: true, get: () => { calls++; return 1; } });
  expect(() => advancePlayerWorkloadRecovery(initial, 0, accessor)).toThrow(/accessors/);
  expect(calls).toBe(0);
});
