import { expect, it, vi } from 'vitest';
import { completeSamePaOccupiedWalkFromRightFixture } from './SamePlateAppearanceOccupiedContinuation.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';

const boundary = vi.hoisted(() => ({
  fixture: null as unknown, scene: null as unknown, inputs: null as unknown, label: '',
  prefix: vi.fn(() => { throw new Error('accepted occupied prefix replayed'); }),
}));
vi.mock('./SqlitePlayerWorkloadRecoveryStore', () => ({ openSqlitePlayerWorkloadRecoveryStore: boundary.prefix }));
vi.mock('./SqliteSamePlateAppearanceEnrollmentStore', () => ({ openSqliteSamePlateAppearanceEnrollmentStore: boundary.prefix }));
vi.mock('./SqliteSamePlateAppearanceExecutionStore', () => ({ openSqliteSamePlateAppearanceExecutionStore: boundary.prefix }));
vi.mock('./SqliteSamePlateAppearanceOccupiedRunnerHoldStore', () => ({ openSqliteSamePlateAppearanceOccupiedRunnerHoldStore: boundary.prefix }));
vi.mock('./SqliteSamePlateAppearanceDispatchStore', () => ({ openSqliteSamePlateAppearanceDispatchStore: boundary.prefix }));
vi.mock('./SamePlateAppearanceInitialBallFixture.test-support', () => ({
  prepareSamePaInitialPlayFixture: (fixture: unknown, _accepted: unknown, scene: unknown, inputs: unknown, label: string) => {
    boundary.fixture = fixture; boundary.scene = scene; boundary.inputs = inputs; boundary.label = label;
    throw new Error('first unperformed initial Play');
  },
}));

it('enters original initial Play from accepted right without reopening a completed prefix writer', () => {
  type Args = Parameters<typeof completeSamePaOccupiedWalkFromRightFixture>;
  const h = { f: { db: {}, path: '/private/copied-cp11.sqlite', x: { f: { track: boundary.prefix } } },
    sceneBodyReferences: [{ playerId: 'pitcher', bodyReference: { sourceId: 'pitcher-body' } }] } as unknown as Args[0];
  const actor = { binding: { gameDay: 10 }, person: { playerId: 'next-batter' } };
  const prepared = { actor, bodyResult: { value: { source: { sourceId: 'accepted-next-body' } } }, accepted: new Map(),
    runnerBinding: { playerId: 'original-runner' } } as unknown as Args[2];
  const action = { source: { sourceId: 'accepted-action', firstPhysicalPitchSourceId: 'original-pitch' } };
  const pitchCalibration = { source: { sourceId: 'accepted-pitch-calibration', route: 'pitch_delivery' } };
  const hold = { source: { bodyReference: { sourceId: 'accepted-original-runner-body' } } };
  const admitted = { action, hold, calibrations: { calibrations: [pitchCalibration] }, view: { source: { sourceId: 'accepted-view' } } } as unknown as Args[3];
  const options = { initialPlay: { venue: { pitcherPlate: { original: true } } } } as unknown as Args[4];
  expect(() => completeSamePaOccupiedWalkFromRightFixture(h, 'lan01:occupied', prepared, admitted, options))
    .toThrow('first unperformed initial Play');
  expect(boundary.prefix).not.toHaveBeenCalled(); expect(boundary.label).toBe('lan01:occupied');
  expect(boundary.inputs).toBe(options!.initialPlay);
  expect(boundary.scene).toEqual([...h.sceneBodyReferences, { playerId: 'original-runner', bodyReference: hold.source.bodyReference }]);
  expect(boundary.fixture).toMatchObject({ actor, acceptedAction: action, acceptedCalibrations: admitted.calibrations, view: admitted.view,
    request: { actionReference: reference('pa_dispatch_v1_action_plans', action),
      calibrationReference: reference('pa_dispatch_v1_execution_calibrations', pitchCalibration) } });
});
