import { expect, it } from 'vitest';
import { actualRoleWorkloadAssessmentInput, deriveActualRoleWorkloadActivity } from './ActualRoleWorkloadAssessment';
const h = 'a'.repeat(64);
const source = () => ({ sourceId: 'effort-p', sourceVersion: 'v1', closureSourceId: 'close',
  physicalEndReference: { owner: 'actual_first_base_play_ends' as const, sourceId: 'end', sourceVersion: 'v1', sourceHash: h, snapshotHash: h },
  wholeHistoryReference: { hash: h, convention: 'owned_scheduled_whole_history_manifest_v1' as const },
  participantReference: { playerId: 'p', bindingHash: h, personHash: h }, effortUnits: 0,
  provenance: { assessmentSourceId: 'accepted-effort', assessmentVersion: 'v1', calibrationSourceId: 'accepted-calibration', calibrationVersion: 'v1' } });
it('preserves explicit accepted zero, whole physical manifest and provenance without inventing fatigue or recovery', () => {
  const raw = source(), accepted = actualRoleWorkloadAssessmentInput(raw, raw.sourceId);
  expect(accepted).toEqual(raw); expect(Object.isFrozen(accepted.provenance)).toBe(true);
  raw.provenance.calibrationVersion = 'changed'; expect(accepted.provenance.calibrationVersion).toBe('v1');
  expect(deriveActualRoleWorkloadActivity(accepted, { careerId: 'career', gameId: 'game', playId: 2, playerId: 'p', gameDay: 8 })).toMatchObject({
    kind: 'MATCH', careerId: 'career', playerId: 'p', atDay: 8, effortUnits: 0, evidenceId: 'end' });
});
it('rejects absent effort, invented identity/results, partial evidence and nonfinite or negative effort', () => {
  for (const effortUnits of [undefined, null, NaN, Infinity, -1]) expect(() => actualRoleWorkloadAssessmentInput({ ...source(), effortUnits } as never, 'effort-p')).toThrow();
  for (const key of ['fatigue', 'ready', 'careerId', 'personId', 'outcome', 'position']) expect(() => actualRoleWorkloadAssessmentInput({ ...source(), [key]: 0 } as never, 'effort-p')).toThrow();
  expect(() => actualRoleWorkloadAssessmentInput({ ...source(), wholeHistoryReference: { hash: h } } as never, 'effort-p')).toThrow();
});
it('canonical activity ownership is independent of accepted-source aliases and rejects cross-player projection', () => {
  const a = source(), scope = { careerId: 'career', gameId: 'game', playId: 2, playerId: 'p', gameDay: 8 };
  expect(deriveActualRoleWorkloadActivity(a, scope).sourceEventId).toBe(deriveActualRoleWorkloadActivity({ ...a, sourceId: 'alias' }, scope).sourceEventId);
  expect(() => deriveActualRoleWorkloadActivity(a, { ...scope, playerId: 'other' })).toThrow();
});
