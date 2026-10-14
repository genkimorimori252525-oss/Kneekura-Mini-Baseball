import { beforeEach, expect, it, vi } from 'vitest';
import { resumeInFlightBattingDelivery } from './InFlightBattingLifecycleFixture.test-support';
import { completeSamePaPhysicalLifecycleFromCutFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';

const boundary = vi.hoisted(() => ({
  records: new Map<string, any>(), views: new Map<string, any>(), cutProof: null as any,
  replay: vi.fn(() => { throw new Error('completed swing writer replayed'); }),
  after: vi.fn(), currentView: vi.fn(() => { throw new Error('historical cut5 read as current'); }),
  advance: vi.fn(() => { throw new Error('first unperformed cut6 prefix'); }),
}));
vi.mock('./SqliteReadTransaction.test-support', () => ({ withSqliteReadTransaction: (_db: unknown, body: () => unknown) => body() }));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite', () => ({
  withSamePaLifecycleReadPhase: (_db: unknown, body: () => unknown) => body(),
  readHistoricalSamePaLifecycleViewFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.views.get(pin.sourceId),
  readCurrentSamePaLifecycleViewFromSqlite: boundary.currentView,
  readSamePaLifecycleRecordFromSqlite: (_db: unknown, _kind: unknown, id: string) => boundary.records.get(id),
}));
vi.mock('./InFlightBattingLifecycleFenceFromSqlite', () => ({ assertInFlightBattingWriteCurrentFromSqlite: boundary.after }));
vi.mock('./SamePlateAppearancePhysicalEpisodeFromSqlite', () => ({
  readCurrentSamePaInFlightCutFromSqlite: () => boundary.cutProof,
  readSamePaPhysicalOperationFromSqlite: (_db: unknown, pin: { sourceId: string }) => ({ record: boundary.records.get(pin.sourceId) }),
  openSqliteSamePlateAppearancePhysicalEpisodeStore: () => ({ acceptAction: boundary.replay, acceptRight: boundary.replay, acceptOperation: boundary.replay }),
}));
vi.mock('./SqliteBattingPerceptionStore', () => ({
  readBattingPerceptionFromSqlite: (_db: unknown, _kind: unknown, pin: { sourceId: string }) => boundary.records.get(pin.sourceId),
  openSqliteBattingPerceptionStore: () => ({ acceptPosture: boundary.replay, acceptObservation: boundary.replay, acceptDelivery: boundary.replay }),
}));
vi.mock('./SqliteBattingExecutionInputStore', () => ({
  readSamePaBattingIntentFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.records.get(pin.sourceId),
  openSqliteBattingExecutionInputStore: () => ({ acceptIntent: boundary.replay, acceptInput: boundary.replay }),
}));
vi.mock('./EmotionWorldRevisionFromSqlite', () => ({ readEmotionWorldRevisionFromSqlite: () => ({ head: { worldRevision: 4 } }) }));
vi.mock('./SamePlateAppearanceLifecycleFixture.test-support', () => ({ prepareSamePaLifecycleFixture: boundary.advance }));

// These bounded declarations exercise only the fixture's call boundary. Mocked
// readers are never evidence that cp27 or any Native owner has been executed.
const inputs = () => {
  const record = (kind: string, sourceId: string, values: any = {}) => {
    const value = { kind, lineage: { participantReferences: [] }, ...values, source: { sourceId, ...values.source } };
    boundary.records.set(sourceId, value); return value;
  };
  const actor = { binding: { careerId: 'career-a', playerId: 'away-2' } }, members = [{ playerId: 'away-2' }];
  const second = record('same_pa_successor_take_pitch', 'lan01:occupied:second-pitch');
  const secondRef = reference('pa_take_successor_v1_pitch_actions', second);
  const anchorReference = reference('pa_continuation_v1_execution_views', { source: { sourceId: 'lan01:occupied:anchor:view' } });
  const beforePrefix = record('same_pa_lifecycle_prefix', 'lan01:occupied:cut0:prefix', { source: { eventReferences: [secondRef], anchorViewReference: anchorReference } });
  const beforeView = record('same_pa_lifecycle_view', 'lan01:occupied:cut0:view', { source: { prefixReference: reference('pa_lifecycle_v1_work_prefixes', beforePrefix) } });
  const beforeRef = reference('pa_lifecycle_v1_execution_views', beforeView);
  boundary.views.set(beforeRef.sourceId, { actor, view: beforeView, members });
  const actionReference = reference('pa_physical_v1_action_plans', { source: { sourceId: 'lan01:swing:action' } });
  const launch = record('same_pa_physical_launch_v1', 'lan01:swing:launch', { stage: 'in_flight', operationOrdinal: 0, evaluationTick: 1_000,
    source: { viewReference: beforeRef, actionReference } });
  const launchReference = reference('pa_physical_v1_launches', launch);
  const captureCut = record('same_pa_physical_cut_v1', 'lan01:swing:capture-cut', { stage: 'in_flight', operationOrdinal: 1, evaluationTick: 51_000,
    source: { launchReference, previousOperationReference: launchReference, throughTick: 51_000 } });
  const captureCutReference = reference('pa_physical_v1_cuts', captureCut);
  const posture = record('batting_invocation_posture', 'lan01:swing:posture', { source: { capability: 'owned_in_flight_batting_posture_v1', viewReference: beforeRef, actionReference } });
  const postureReference = reference('batting_observation_v1_postures', posture);
  const intent = record('same_pa_batting_intent', 'lan01:swing:intent', { originalIntent: { attempt: 'ordinary_swing' }, source: { postureReference, viewReference: beforeRef } });
  const capture = record('batting_observation', 'lan01:swing:capture', { calculation: { effectiveValues: { deliveryLatencyTicks: 100 } },
    source: { capability: 'owned_in_flight_batting_observation_v1', postureReference, physicalPitchReference: launchReference,
      physicalOperationReference: captureCutReference, previousObservationReference: null, observedTick: 51_000 } });
  const observationReference = reference('batting_observation_v1_observations', capture);
  const deliveryCut = record('same_pa_physical_cut_v1', 'lan01:swing:delivery-cut', { stage: 'in_flight', operationOrdinal: 2,
    source: { launchReference, previousOperationReference: captureCutReference, throughTick: 51_100 } });
  const deliveryCutReference = reference('pa_physical_v1_cuts', deliveryCut);
  boundary.cutProof = { actor, record: deliveryCut };
  const eventReferences = [secondRef, launchReference, captureCutReference, observationReference, deliveryCutReference];
  const prefix = record('same_pa_lifecycle_prefix', 'lan01:occupied:cut5:prefix', { source: { eventReferences, anchorViewReference: anchorReference } });
  const view = record('same_pa_lifecycle_view', 'lan01:occupied:cut5:view', { source: { prefixReference: reference('pa_lifecycle_v1_work_prefixes', prefix) },
    cut: { physicalOperationReference: deliveryCutReference } });
  const viewReference = reference('pa_lifecycle_v1_execution_views', view), basis = { actor, view, members };
  boundary.views.set(viewReference.sourceId, basis);
  const delivery = record('batting_observation_delivery', 'lan01:swing:delivery', { source: { capability: 'owned_in_flight_batting_observation_delivery_v1',
    viewReference, observationReference, physicalPitchReference: launchReference, physicalOperationReference: deliveryCutReference } });
  const pins = { postureReference, intentReference: reference('batting_execution_v1_intents', intent), launchReference,
    captureCutReference, observationReference, deliveryCutReference, deliveryReference: reference('batting_observation_v1_deliveries', delivery) };
  type Args = Parameters<typeof completeSamePaPhysicalLifecycleFromCutFixture>;
  const f = { db: {}, path: '/unused/source-contract-only.sqlite', actor, acceptedAction: { source: {} }, x: { f: { track: <T>(value: T) => value } } } as unknown as Args[0];
  const prepared = { first: second, second, anchor: { viewReference: anchorReference }, basis: { viewReference, view, basis }, eventReferences } as unknown as Args[2];
  const make = () => completeSamePaPhysicalLifecycleFromCutFixture(f, new Map(), prepared, {}, 'lan01:occupied');
  return { f, prepared, pins, make, prefix, delivery, launch, captureCut, beforePrefix, eventReferences, viewReference };
};
beforeEach(() => {
  boundary.records.clear(); boundary.views.clear(); boundary.replay.mockClear(); boundary.currentView.mockClear();
  boundary.advance.mockClear(); boundary.after.mockReset();
});
it('restores exactly five admitted events and reaches cut6 with only the accepted delivery appended', () => {
  const x = inputs(), h = x.make();
  expect(h.events).toEqual(x.eventReferences);
  expect(() => resumeInFlightBattingDelivery(h, 'lan01:swing', x.pins)).toThrow('first unperformed cut6 prefix');
  expect(boundary.after).toHaveBeenCalledWith(x.f.db, x.viewReference, x.pins.deliveryReference);
  expect(boundary.advance).toHaveBeenCalledTimes(1);
  expect(boundary.advance.mock.calls[0]).toEqual([x.f, h.anchor.viewReference, [...x.eventReferences, x.pins.deliveryReference], 'lan01:occupied:cut6', {}, undefined, undefined, undefined, undefined]);
  expect(boundary.after.mock.invocationCallOrder[0]).toBeLessThan(boundary.advance.mock.invocationCallOrder[0]);
  expect(boundary.replay).not.toHaveBeenCalled(); expect(boundary.currentView).not.toHaveBeenCalled();
});
it('a failed current AFTER fence cannot enter cut6', () => {
  const x = inputs(), h = x.make();
  boundary.after.mockImplementation(() => { throw new Error('later work already exists'); });
  expect(() => resumeInFlightBattingDelivery(h, 'lan01:swing', x.pins)).toThrow('later work already exists');
  expect(boundary.advance).not.toHaveBeenCalled(); expect(boundary.replay).not.toHaveBeenCalled();
  expect(h.events).toEqual(x.eventReferences);
});
it.each([
  ['changed physical predecessor', (x: ReturnType<typeof inputs>) => { boundary.cutProof.record.source.previousOperationReference = x.pins.launchReference; }],
  ['wrong capture cut time', (x: ReturnType<typeof inputs>) => { x.captureCut.source.throughTick++; }],
  ['missing admitted capture', (x: ReturnType<typeof inputs>) => { x.prefix.source.eventReferences = x.eventReferences.filter(r => r !== x.pins.observationReference); }],
  ['delivery from another view', (x: ReturnType<typeof inputs>) => { x.delivery.source.viewReference = { ...x.viewReference, sourceId: 'lan01:occupied:cut4:view' }; }],
  ['different original TAKE', (x: ReturnType<typeof inputs>) => { x.beforePrefix.source.eventReferences = []; }],
] as const)('rejects %s before any future owner write', (_name, mutate) => {
  const x = inputs(), h = x.make(); mutate(x);
  expect(() => resumeInFlightBattingDelivery(h, 'lan01:swing', x.pins)).toThrow();
  expect(boundary.advance).not.toHaveBeenCalled(); expect(boundary.replay).not.toHaveBeenCalled();
});
it('rejects restoring delivery as already admitted and preserves the original default one-TAKE event list', () => {
  const x = inputs();
  expect(() => completeSamePaPhysicalLifecycleFromCutFixture(x.f, new Map(), { ...x.prepared, eventReferences: [...x.eventReferences, x.pins.deliveryReference] }, {}, 'lan01:occupied'))
    .toThrow('exact LAN delivery-cut prefix');
  const h = completeSamePaPhysicalLifecycleFromCutFixture(x.f, new Map(), { ...x.prepared, eventReferences: undefined });
  expect(h.events).toEqual([x.eventReferences[0]]); expect(boundary.advance).not.toHaveBeenCalled();
});
