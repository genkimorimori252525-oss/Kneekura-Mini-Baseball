import { describe, expect, it, vi } from 'vitest';
import { completeNativeBatterRunPlanCheckpoint } from './SamePlateAppearanceBatterRunNative.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';

const stops = vi.hoisted(() => ({
  source: null as unknown, opened: [] as string[], accepted: [] as string[], prefix: vi.fn(() => { throw new Error('completed prefix replayed'); }),
}));
vi.mock('./SqlitePlayerRunnerDecisionMotionModelStore', () => ({ openSqlitePlayerRunnerDecisionMotionModelStore: stops.prefix }));
vi.mock('./SqlitePlayerBatterRunTransitionModelStore', () => ({ openSqlitePlayerBatterRunTransitionModelStore: stops.prefix }));
vi.mock('./SqliteBatterSwingExitStateStore', () => ({ openSqliteBatterSwingExitStateStore: stops.prefix }));
vi.mock('./SqliteBatterRunPlanStore', () => ({ openSqliteBatterRunPlanStore: (path: string, authority: { readAcceptedPlan(id: string): unknown }) => {
  stops.opened.push(path);
  return { accept: (id: string) => { stops.accepted.push(id); stops.source = authority.readAcceptedPlan(id); throw new Error('first unperformed plan acceptance'); } };
} }));

describe('IFN01 accepted-exit-state continuation seam, without Native owners', () => {
  it('enters the original plan owner directly with retained references and geometry', () => {
    type Args = Parameters<typeof completeNativeBatterRunPlanCheckpoint>;
    const viewReference = { owner: 'pa_lifecycle_v1_execution_views', sourceId: 'cut32', sourceHash: 'view-source', snapshotHash: 'view-snapshot' };
    const physicalPitchReference = { owner: 'pa_physical_v1_launches', sourceId: 'pitch3', sourceHash: 'pitch-source', snapshotHash: 'pitch-snapshot' };
    const h = { f: { path: '/private/copied-cp10.sqlite', actor: { binding: { playerId: 'away-1', personId: 'person-away-1' } },
      x: { f: { track: <T>(store: T) => store } } }, current: () => ({ viewReference }) } as unknown as Args[0];
    const previous = { evaluationTick: 100, source: { launchReference: physicalPitchReference } } as Args[2];
    const state = { source: { sourceId: 'accepted-exit-state', sourceVersion: 'v1' } } as Args[4]['state'];
    const prepared = { state, before: {}, start: { x: 1, z: 2 }, delta: { x: 3, z: 4 }, throughTick: 110, endTick: 111 } as Args[4];
    expect(() => completeNativeBatterRunPlanCheckpoint(h, {} as Args[1], previous, 'in-flight-fixture:batter-run', prepared))
      .toThrow('first unperformed plan acceptance');
    expect(stops.prefix).not.toHaveBeenCalled();
    expect(stops.opened).toEqual(['/private/copied-cp10.sqlite']);
    expect(stops.accepted).toEqual(['in-flight-fixture:batter-run:issued-plan']);
    expect(stops.source).toEqual({ sourceId: 'in-flight-fixture:batter-run:issued-plan', sourceVersion: 'explicit-advance-fixture-v1',
      capability: 'same_pa_batter_run_plan_v1', viewReference, physicalPitchReference,
      exitStateReference: reference('world_batter_swing_exit_states', state), playerId: 'away-1', personId: 'person-away-1',
      route: { segments: [{ kind: 'line', start: prepared.start, end: { x: 7, z: 10 } }] },
      intent: { kind: 'advance', issuedTick: 100 }, endTick: 111,
      provenance: { sourceRecordId: 'in-flight-fixture:batter-run:independent-intent', sourceVersion: 'fixture-v1' } });
  });
});
