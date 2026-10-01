import { expect, it } from 'vitest';
import { createPlayerHealthRehab, advancePlayerHealthRehab, type HealthRehabEvidence } from './PlayerHealthRehab';

const diagnosis = { caseId: 'injury-1', careerId: 'career-a', playerId: 'p2', diagnosedAtDay: 2, injuryBurden: 0.8,
  policy: { policyId: 'clinical-fixture', version: 'v1', availableAtDay: 1, medicalBurdenReductionPerHour: 0.2,
    rehabEntryMaximumBurden: 0.5, returnMaximumBurden: 0.1, practiceExposurePerEffortUnit: 1,
    minimumPracticeExposure: 1, minimumRehabGames: 1 } };
const evidence = (sourceId: string, atDay: number, effect: object): HealthRehabEvidence =>
  ({ sourceId, sourceVersion: 'v1', careerId: 'career-a', playerId: 'p2', caseId: 'injury-1', atDay, ...effect } as HealthRehabEvidence);
const recovery = (id = 'medical-1', day = 3) => evidence(id, day, { kind: 'MEDICAL_RECOVERY', workloadActivityId: `dose-${id}`,
  durationHours: 4, quality: 1, medicalAvailability: 1, recoveryCapacity: 1 }) as Extract<HealthRehabEvidence, { kind: 'MEDICAL_RECOVERY' }>;
const practice = (id = 'practice-1', day = 4, beforeFatigue = 0) => evidence(id, day, {
  kind: 'REHAB_PRACTICE', workloadActivityId: `effort-${id}`, effortUnits: 2, beforeFatigue, healthAvailability: 1 });
const game = (id = 'game-effect', gameId = 'rehab-game', day = 5) => evidence(id, day, {
  kind: 'REHAB_GAME', gameId, participationReceiptId: `receipt-${gameId}`, rosterSnapshotId: `roster-${gameId}` });

it('requires actual ordered medical recovery, effective practice and a distinct played rehab game before return readiness', () => {
  let state = createPlayerHealthRehab(diagnosis);
  expect(state.phase).toBe('INJURED'); expect(state.injuryBurden).toBe(0.8);
  expect(() => advancePlayerHealthRehab(state, 0, practice())).toThrow('medical');
  state = advancePlayerHealthRehab(state, 0, recovery());
  expect(state.phase).toBe('REHAB'); expect(state.injuryBurden).toBeCloseTo(0);
  expect(() => advancePlayerHealthRehab(state, 1, game())).toThrow('practice');
  state = advancePlayerHealthRehab(state, 1, practice());
  expect(state.phase).toBe('REHAB'); expect(state.practiceExposure).toBe(2);
  state = advancePlayerHealthRehab(state, 2, game());
  expect(state.phase).toBe('READY'); expect(state.rehabGameIds).toEqual(['rehab-game']);
  expect(state.careerId).toBe(diagnosis.careerId); expect(state.playerId).toBe(diagnosis.playerId);
});
it('does not recover from missing days, exhausted practice, reused effort or repeated registration/game', () => {
  let state = createPlayerHealthRehab(diagnosis);
  state = advancePlayerHealthRehab(state, 0, recovery('medical-late', 200));
  state = advancePlayerHealthRehab(state, 1, practice('exhausted', 201, 1));
  expect(state.practiceExposure).toBe(0); expect(state.phase).toBe('REHAB');
  expect(() => advancePlayerHealthRehab(state, 2, game('unused', 'game-1', 202))).toThrow('practice');
  const original = practice('training', 202);
  state = advancePlayerHealthRehab(state, 2, original);
  expect(() => advancePlayerHealthRehab(state, 3, { ...original, sourceId: 'alias' })).toThrow('reused');
  state = advancePlayerHealthRehab(state, 3, game('played', 'game-1', 203));
  expect(() => advancePlayerHealthRehab(state, 4, game('alias-game', 'game-1', 204))).toThrow('reused');
});
it('retains medical feasibility and explicit dose capacity rather than treating rehabilitation as an instant reset', () => {
  let state = createPlayerHealthRehab(diagnosis);
  state = advancePlayerHealthRehab(state, 0, { ...recovery(), durationHours: 4, recoveryCapacity: 0.5 });
  expect(state.injuryBurden).toBeCloseTo(0.4); expect(state.phase).toBe('REHAB');
  state = advancePlayerHealthRehab(state, 1, practice());
  expect(state.practiceExposure).toBeCloseTo(1.2);
  state = advancePlayerHealthRehab(state, 2, game());
  expect(state.phase).toBe('REHAB');
  state = advancePlayerHealthRehab(state, 3, recovery('medical-2', 6));
  expect(state.phase).toBe('READY');
});
it('rejects future calibration, stale revisions, changed scope, backdating and nonfinite or unexpected fields', () => {
  expect(() => createPlayerHealthRehab({ ...diagnosis, policy: { ...diagnosis.policy, availableAtDay: 3 } })).toThrow('policy');
  const state = createPlayerHealthRehab(diagnosis);
  for (const invalid of [{ ...recovery(), playerId: 'other' }, { ...recovery(), atDay: 1 },
    { ...recovery(), durationHours: Infinity }, { ...recovery(), desiredPhase: 'READY' },
    { ...recovery(), durationHours: 25 }]) expect(() => advancePlayerHealthRehab(state, 0, invalid)).toThrow();
  expect(() => advancePlayerHealthRehab(state, 1, recovery())).toThrow('revision');
});
it('does not advance a mild injury through ineffective treatment or unavailable medical care', () => {
  const mild = createPlayerHealthRehab({ ...diagnosis, injuryBurden: 0.1 });
  for (const key of ['quality', 'medicalAvailability', 'recoveryCapacity'] as const) {
    const after = advancePlayerHealthRehab(mild, 0, { ...recovery(), [key]: 0 });
    expect(after.phase).toBe('INJURED'); expect(after.medicalRecoveryHours).toBe(0);
    expect(() => advancePlayerHealthRehab(after, 1, practice())).toThrow('medical');
  }
});
