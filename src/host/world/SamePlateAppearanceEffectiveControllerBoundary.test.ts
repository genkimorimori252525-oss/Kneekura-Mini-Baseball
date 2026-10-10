import { beforeEach, expect, it, vi } from 'vitest';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { calculateSamePaEffectiveControllerCandidate } from './SamePlateAppearanceEffectiveControllerCalculation';

const seams = vi.hoisted(() => ({ calculate: vi.fn(), field: vi.fn(), scope: vi.fn(), kernel: vi.fn() }));
vi.mock('./SamePlateAppearanceEffectiveDefenderCalculation', () => ({ calculateSamePaEffectiveDefenderCandidate: seams.calculate }));
vi.mock('./SqliteBattedWorldFieldStore', () => ({ battedWorldFieldEvidenceFromSqlite: () => ({ read: seams.field }) }));
vi.mock('./SqliteBattedWorldFieldExecutionStore', () => ({ battedWorldFieldExecutionEvidenceFromSqlite: () => ({ scope: seams.scope }) }));
vi.mock('./SamePlateAppearanceContinuationFromSqlite', () => ({ withSamePaContinuationReadPhase: (_db: unknown, body: () => unknown) => body() }));
vi.mock('../../core/sim/ball/BattedWorldFieldMotion', () => ({ deriveBattedWorldFieldMotionCheckpoint: seams.kernel }));

/** Mocked boundary wiring only. No Native ownership, actual plan acceptance or
 * physical execution is qualified here. The normal pending-plan classifier is
 * real; the generic field kernel must not be reached through either guard. */
const candidate = (status: 'unblocked_at_original_cut' | 'owned_scheduled_operation_at_original_cut_v1', planKind: 'owned_acquisition_plan_v1' | 'owned_throw_plan_v1') => {
  const base = { source: { sourceId: 'boundary-base' } }, plan = { source: { sourceId: 'pending-operation' }, revision: 1, execution: { kind: planKind } };
  const source = { member: { playerId: 'defender' }, rightReference: { sourceId: 'right' }, physicalSourceReference: { sourceId: 'physical' },
    originalInputReferences: { baseFieldReference: reference('batted_world_field_actions', base), executionReference: reference('batted_world_field_executions', plan) } };
  seams.calculate.mockReturnValue({ decisionCandidate: { source }, commandCandidate: { physicalAvailability: { status } } });
  seams.field.mockReturnValue(base); seams.scope.mockReturnValue([plan]);
  // The mocked original calculation accepts these inert shapes; they are never
  // represented as a production Source or passed through a Native adapter.
  const input = { source, motionInputs: {}, values: {} } as unknown as Parameters<typeof calculateSamePaEffectiveControllerCandidate>[1][number];
  return () => calculateSamePaEffectiveControllerCandidate({} as Parameters<typeof calculateSamePaEffectiveControllerCandidate>[0], [input], 1000);
};
beforeEach(() => { vi.clearAllMocks(); });
it('CB01 command permission before an owned throw release cannot authorize generic field advancement', () => {
  expect(candidate('owned_scheduled_operation_at_original_cut_v1', 'owned_throw_plan_v1')).toThrow(/operation-aware/);
  expect(seams.field).not.toHaveBeenCalled(); expect(seams.kernel).not.toHaveBeenCalled();
});
it.each(['owned_acquisition_plan_v1', 'owned_throw_plan_v1'] as const)('CB02 a pending %s blocks even when command availability is unblocked', kind => {
  expect(candidate('unblocked_at_original_cut', kind)).toThrow(/operation-aware/);
  expect(seams.scope).toHaveBeenCalledOnce(); expect(seams.kernel).not.toHaveBeenCalled();
});
