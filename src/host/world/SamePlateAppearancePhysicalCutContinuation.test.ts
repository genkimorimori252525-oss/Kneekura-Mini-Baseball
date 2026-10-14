import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { completeSamePaPhysicalLifecycleFromCutFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';

const boundary = vi.hoisted(() => ({
  completed: vi.fn(() => { throw new Error('completed TAKE or anchor replayed'); }),
  futureLifecycle: vi.fn(), physicalWriter: vi.fn(), postureWriter: vi.fn(), source: null as unknown,
}));
vi.mock('./SamePlateAppearanceNonemptyFixture.test-support', () => ({ prepareSamePaNonemptyFixture: boundary.completed }));
vi.mock('./SqliteSamePlateAppearanceTakeSuccessorStore', () => ({ openSqliteSamePlateAppearanceTakeSuccessorStore: boundary.completed }));
vi.mock('./SamePlateAppearanceLifecycleFixture.test-support', () => ({ prepareSamePaLifecycleFixture: boundary.futureLifecycle }));
vi.mock('./SqliteBattingPerceptionStore', () => ({ openSqliteBattingPerceptionStore: () => ({ acceptPosture: boundary.postureWriter }) }));
vi.mock('./SqliteSamePlateAppearancePhysicalEpisodeStore', () => ({
  openSqliteSamePlateAppearancePhysicalEpisodeStore: (_path: string, authority: { readAcceptedAction(id: string): unknown }) => ({
    acceptAction(id: string) { boundary.physicalWriter(id); boundary.source = authority.readAcceptedAction(id); throw new Error('first unperformed swing action'); },
  }),
}));
const inputs = () => {
  type Args = Parameters<typeof completeSamePaPhysicalLifecycleFromCutFixture>;
  const accepted = new Map<string, unknown>(), geometry = Object.freeze({ validUntilTick: 100_056_482 });
  const f = { path: '/unopened/accepted-cut0.sqlite', close: () => {},
    x: { f: { track: <T>(s: T) => s } }, acceptedAction: { source: {
      timingReference: { sourceId: 'original-timing' }, releaseReference: { sourceId: 'original-release' },
      pitchResponseReference: { sourceId: 'original-response' }, batterModelReference: { sourceId: 'original-model' },
      occupiedRunnerHoldReferences: [{ sourceId: 'accepted-hold' }],
    } } } as unknown as Args[0];
  const basis = { viewReference: { sourceId: 'lan01:occupied:cut0:view' }, view: { source: { sourceId: 'accepted-cut0-view' } },
    basis: { members: [] }, calibrationSet: { calibrations: [] }, owner: {}, accepted: new Map() };
  const prepared = { first: { lineage: { participantReferences: [{ playerId: 'runner' }, { playerId: 'batter' }] } },
    second: { source: { sourceId: 'lan01:occupied:second-pitch' } }, anchor: { viewReference: { sourceId: 'accepted-anchor' } },
    basis, sceneBodyReferences: [], geometry, genesis: { source: { sourceId: 'accepted-genesis' } }, worldOwner: {}, roles: [], throughTick: 128_602_725 } as unknown as Args[2];
  return { f, accepted, prepared, basis, geometry };
};
it('restores only future methods at cut0 and first writes the original swing action', () => {
  const { f, accepted, prepared, basis, geometry } = inputs();
  boundary.completed.mockClear(); boundary.futureLifecycle.mockClear(); boundary.physicalWriter.mockClear(); boundary.postureWriter.mockClear();
  const h = completeSamePaPhysicalLifecycleFromCutFixture(f, accepted, prepared, {}, 'lan01:occupied');
  expect(h.current()).toBe(basis); expect(h.first).toBe(prepared.first); expect(h.second).toBe(prepared.second);
  expect(h.geometry).toBe(geometry); expect(h.genesis).toBe(prepared.genesis);
  expect(h.events).toEqual([reference('pa_take_successor_v1_pitch_actions', prepared.second)]);
  expect(accepted.size).toBe(0); expect(boundary.completed).not.toHaveBeenCalled(); expect(boundary.futureLifecycle).not.toHaveBeenCalled();
  expect(boundary.physicalWriter).not.toHaveBeenCalled(); expect(boundary.postureWriter).not.toHaveBeenCalled();
  const nominal = { delivery: { readyAtUs: 91_694_321 } } as Parameters<typeof h.prepareAction>[2];
  expect(() => h.prepareAction('lan01:swing', 'observer_decision', nominal)).toThrow('first unperformed swing action');
  expect(boundary.physicalWriter).toHaveBeenCalledWith('lan01:swing:action');
  expect(boundary.source).toMatchObject({ sourceId: 'lan01:swing:action', viewReference: basis.viewReference,
    nominalPitch: nominal, timingReference: f.acceptedAction.source.timingReference });
  expect(h.current()).toBe(basis); expect(h.geometry).toBe(geometry);
});
it('the next genuine operation advances from the accepted second TAKE to the original cut2', () => {
  const { f, accepted, prepared } = inputs(), next = { viewReference: { sourceId: 'lan01:occupied:cut2:view' } };
  boundary.futureLifecycle.mockReset(); boundary.futureLifecycle.mockReturnValue(next);
  const h = completeSamePaPhysicalLifecycleFromCutFixture(f, accepted, prepared, {}, 'lan01:occupied');
  const operation = reference('pa_physical_v1_launches', { source: { sourceId: 'lan01:swing:launch' } });
  expect(h.advance(operation)).toBe(next); expect(h.current()).toBe(next);
  expect(boundary.futureLifecycle).toHaveBeenCalledTimes(1);
  expect(boundary.futureLifecycle.mock.calls[0].slice(0, 5)).toEqual([f, prepared.anchor.viewReference,
    [reference('pa_take_successor_v1_pitch_actions', prepared.second), operation], 'lan01:occupied:cut2', { runner: 2, batter: 2 }]);
});
it('preserves the existing future action, posture, right, launch and advance body', () => {
  const source = readFileSync(new URL('./SamePlateAppearancePhysicalLifecycleFixture.test-support.ts', import.meta.url), 'utf8');
  const start = source.indexOf('  const physical=track(openSqliteSamePlateAppearancePhysicalEpisodeStore(f.path,');
  const body = source.slice(start, source.indexOf('\n};', start));
  expect(createHash('sha256').update(body).digest('hex')).toBe('16e2aff00f455b52abe28034029321788688c7d171d5c693ea4ecfb8fb52caf5');
});
