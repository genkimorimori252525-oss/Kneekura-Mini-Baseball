import { expect, it, vi } from 'vitest';
import { continueSamePaOccupiedWalkFromViewFixture } from './SamePlateAppearanceOccupiedContinuation.test-support';

const boundary = vi.hoisted(() => ({
  prefix: vi.fn(() => { throw new Error('accepted occupied prefix replayed'); }),
  timing: vi.fn(), hold: vi.fn(), source: null as unknown,
}));
vi.mock('./SqlitePlayerWorkloadRecoveryStore', () => ({ openSqlitePlayerWorkloadRecoveryStore: boundary.prefix }));
vi.mock('./SqliteSamePlateAppearanceEnrollmentStore', () => ({ openSqliteSamePlateAppearanceEnrollmentStore: boundary.prefix }));
vi.mock('./SqliteSamePlateAppearanceExecutionStore', () => ({ openSqliteSamePlateAppearanceExecutionStore: boundary.prefix }));
vi.mock('./SamePlateAppearanceOccupiedTiming.test-support', () => ({ checkSamePaOccupiedPhysicalTimingFromSqlite: boundary.timing }));
vi.mock('./SqliteSamePlateAppearanceOccupiedRunnerHoldStore', () => ({
  openSqliteSamePlateAppearanceOccupiedRunnerHoldStore: (_path: unknown, authority: { readAcceptedHold(id: string): unknown }) => ({
    accept(id: string) { boundary.hold(); boundary.source = authority.readAcceptedHold(id); throw new Error('first unperformed runner hold'); },
  }),
}));

const inputs = () => {
  type Args = Parameters<typeof continueSamePaOccupiedWalkFromViewFixture>;
  const h = { f: { db: {}, path: '/private/copied-cp5.sqlite', x: { f: { track: <T>(s: T) => s } } }, original: { sourceId: 'native-action' } } as unknown as Args[0];
  const prepared = { actor: { world: { tick: 68_602_725 } }, accepted: new Map(),
    runnerBinding: { playerId: 'runner', personId: 'original-person' }, runnerBody: { value: { source: { sourceId: 'body' } } },
    runnerModel: { source: { sourceId: 'model' } } } as unknown as Args[3];
  const admitted = { enrollment: { source: { firstPhysicalPitchSourceId: 'lan01:occupied:pitch' } },
    prefix: { source: { enrollmentReference: { sourceId: 'enrollment' } } }, view: { source: { sourceId: 'accepted-view' } } } as unknown as Args[4];
  return { h, prepared, admitted };
};
it('enters exact cp5 after a whole-recipe timing check without replaying any completed prefix writer', () => {
  boundary.timing.mockReset(); boundary.hold.mockClear(); const { h, prepared, admitted } = inputs();
  expect(() => continueSamePaOccupiedWalkFromViewFixture(h, {} as never, 'lan01:occupied', prepared, admitted, { occupiedHoldDurationUs: 60_000_000 }))
    .toThrow('first unperformed runner hold');
  expect(boundary.prefix).not.toHaveBeenCalled(); expect(boundary.timing).toHaveBeenCalledTimes(1); expect(boundary.timing).toHaveBeenCalledWith(h.f.db, prepared.actor, h.original, admitted.view, 128_602_725);
  expect(boundary.hold).toHaveBeenCalledTimes(1);
  expect(boundary.source).toMatchObject({ sourceId: 'lan01:occupied:runner-hold', intent: { kind: 'hold', issuedTick: 68_602_725 }, coverageThroughTick: 128_602_725 });
});
it('a failed timing consistency check reaches no hold acceptance', () => {
  boundary.timing.mockReset(); boundary.hold.mockClear(); boundary.timing.mockImplementation(() => { throw new Error('planned interval unavailable'); });
  const { h, prepared, admitted } = inputs();
  expect(() => continueSamePaOccupiedWalkFromViewFixture(h, {} as never, 'lan01:occupied', prepared, admitted, { occupiedHoldDurationUs: 20_000_000 }))
    .toThrow('planned interval unavailable');
  expect(boundary.prefix).not.toHaveBeenCalled(); expect(boundary.hold).not.toHaveBeenCalled();
});
