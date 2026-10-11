import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { readRetainedInFlightBattingInput, continueRetainedInFlightBattingInput } from './InFlightBattingLifecycleFixture.test-support';
import { completeSamePaPhysicalLifecycleFromCutFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const boundary = vi.hoisted(() => ({
  records: new Map<string, any>(), views: new Map<string, any>(), cutProof: null as any, world: null as any,
  replay: vi.fn(() => { throw new Error('completed batting writer replayed'); }),
  after: vi.fn(), currentView: vi.fn(() => { throw new Error('historical cut9 read as current'); }),
  queryScope: vi.fn(() => { throw new Error('nested restoration query scope'); }),
  operation: vi.fn(), advance: vi.fn(),
}));
vi.mock('./SqliteReadTransaction.test-support', () => ({ withSqliteReadTransaction: boundary.queryScope }));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite', () => ({
  withSamePaLifecycleReadPhase: boundary.queryScope,
  readHistoricalSamePaLifecycleViewFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.views.get(pin.sourceId),
  readCurrentSamePaLifecycleViewFromSqlite: boundary.currentView,
  readSamePaLifecycleRecordFromSqlite: (_db: unknown, _kind: unknown, id: string) => boundary.records.get(id),
}));
vi.mock('./InFlightBattingLifecycleFenceFromSqlite', () => ({ assertInFlightBattingWriteCurrentFromSqlite: boundary.after }));
vi.mock('./SamePlateAppearancePhysicalEpisodeFromSqlite', () => ({
  readCurrentSamePaInFlightCutFromSqlite: () => boundary.cutProof,
  readSamePaPhysicalOperationFromSqlite: (_db: unknown, pin: { sourceId: string }) => ({ record: boundary.records.get(pin.sourceId) }),
  openSqliteSamePlateAppearancePhysicalEpisodeStore: () => ({ acceptAction: boundary.replay, acceptRight: boundary.replay, acceptOperation: boundary.operation }),
}));
vi.mock('./SqliteBattingPerceptionStore', () => ({
  readBattingPerceptionFromSqlite: (_db: unknown, _kind: unknown, pin: { sourceId: string }) => boundary.records.get(pin.sourceId),
  openSqliteBattingPerceptionStore: () => ({ acceptPosture: boundary.replay, acceptObservation: boundary.replay, acceptDelivery: boundary.replay, acceptPrediction: boundary.replay, acceptAssessment: boundary.replay }),
}));
vi.mock('./SqliteBattingExecutionInputStore', () => ({
  readSamePaBattingIntentFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.records.get(pin.sourceId),
  readSamePaBattingExecutionInputFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.records.get(pin.sourceId),
  openSqliteBattingExecutionInputStore: () => ({ acceptIntent: boundary.replay, acceptInput: boundary.replay }),
}));
vi.mock('./SqliteBattingEmotionExecutionStore', () => ({
  readBattingEmotionExecutionFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.records.get(pin.sourceId),
  openSqliteBattingEmotionExecutionStore: () => ({ accept: boundary.replay }),
}));
vi.mock('./EmotionWorldRevisionFromSqlite', () => ({ readEmotionWorldRevisionFromSqlite: () => boundary.world }));
vi.mock('./SamePlateAppearanceLifecycleFixture.test-support', () => ({ prepareSamePaLifecycleFixture: boundary.advance }));

// Finite fixture call-boundary declarations only. These mocked readers do not
// qualify the retained database or establish that any Native owner has run.
const inputs = () => {
  const record = (kind: string, sourceId: string, values: any = {}) => {
    const value = { kind, lineage: { participantReferences: [] }, ...values, source: { sourceId, ...values.source } };
    boundary.records.set(sourceId, value); return value;
  };
  const viewPin = (cut: number) => reference('pa_lifecycle_v1_execution_views', { source: { sourceId: `lan01:occupied:cut${cut}:view` } });
  const actor = { binding: { careerId: 'career-a', playerId: 'away-2' } }, member = { playerId: 'away-2' }, members = [member];
  boundary.world = { head: { worldRevision: 5, control: { revision: 2 } } };
  const expectedWorld = { careerId: 'career-a', worldRevision: 4, controlRevision: 2, controlHash: hash(boundary.world.head.control) };
  const second = record('same_pa_successor_take_pitch', 'lan01:occupied:second-pitch');
  const secondRef = reference('pa_take_successor_v1_pitch_actions', second);
  const anchorReference = reference('pa_continuation_v1_execution_views', { source: { sourceId: 'lan01:occupied:anchor:view' } });
  const beforePrefix = record('same_pa_lifecycle_prefix', 'lan01:occupied:cut0:prefix', { source: { eventReferences: [secondRef], anchorViewReference: anchorReference } });
  const beforeView = record('same_pa_lifecycle_view', 'lan01:occupied:cut0:view', { source: { prefixReference: reference('pa_lifecycle_v1_work_prefixes', beforePrefix) } });
  const beforeRef = reference('pa_lifecycle_v1_execution_views', beforeView);
  boundary.views.set(beforeRef.sourceId, { actor, view: beforeView, members });
  const actionReference = reference('pa_physical_v1_action_plans', { source: { sourceId: 'lan01:swing:action' } });
  const launch = record('same_pa_physical_launch_v1', 'lan01:swing:launch', { stage: 'in_flight', operationOrdinal: 0, evaluationTick: 1_000,
    trajectory: { endTick: 100_000 }, source: { viewReference: beforeRef, actionReference } });
  const launchReference = reference('pa_physical_v1_launches', launch);
  const captureCut = record('same_pa_physical_cut_v1', 'lan01:swing:capture-cut', { stage: 'in_flight', operationOrdinal: 1, evaluationTick: 51_000,
    source: { launchReference, previousOperationReference: launchReference, throughTick: 51_000 } });
  const captureCutReference = reference('pa_physical_v1_cuts', captureCut);
  const posture = record('batting_invocation_posture', 'lan01:swing:posture', { source: { capability: 'owned_in_flight_batting_posture_v1', viewReference: beforeRef, actionReference } });
  const postureReference = reference('batting_observation_v1_postures', posture);
  const intent = record('same_pa_batting_intent', 'lan01:swing:intent', { originalIntent: { attempt: 'ordinary_swing' }, source: { capability: 'owned_in_flight_same_pa_batting_intent_v1', postureReference, viewReference: beforeRef } });
  const intentReference = reference('batting_execution_v1_intents', intent);
  const capture = record('batting_observation', 'lan01:swing:capture', { calculation: { effectiveValues: { deliveryLatencyTicks: 100 } },
    source: { capability: 'owned_in_flight_batting_observation_v1', postureReference, physicalPitchReference: launchReference,
      physicalOperationReference: captureCutReference, previousObservationReference: null, observedTick: 51_000 } });
  const observationReference = reference('batting_observation_v1_observations', capture);
  const deliveryCut = record('same_pa_physical_cut_v1', 'lan01:swing:delivery-cut', { stage: 'in_flight', operationOrdinal: 2,
    source: { launchReference, previousOperationReference: captureCutReference, throughTick: 51_100 } });
  const deliveryCutReference = reference('pa_physical_v1_cuts', deliveryCut);
  const delivery = record('batting_observation_delivery', 'lan01:swing:delivery', { source: { capability: 'owned_in_flight_batting_observation_delivery_v1',
    viewReference: viewPin(5), observationReference, physicalPitchReference: launchReference, physicalOperationReference: deliveryCutReference } });
  const deliveryReference = reference('batting_observation_v1_deliveries', delivery);
  const forecast = record('batting_observed_prediction', 'lan01:swing:forecast', { source: { capability: 'owned_in_flight_batting_observed_prediction_v1',
    viewReference: viewPin(6), observationReference, deliveryReference } });
  const predictionReference = reference('batting_prediction_v1_predictions', forecast);
  const score = record('batting_score_assessment', 'lan01:swing:score', { source: { capability: 'owned_in_flight_batting_score_assessment_v1', viewReference: viewPin(7), predictionReference } });
  const scoreReference = reference('batting_score_v1_assessments', score);
  const emotion = record('batting_emotion_execution', 'lan01:swing:emotion', { acceptance: { afterWorldRevision: 5, proposal: { inputs: { swingDecision: { tick: 52_000 } } } },
    source: { capability: 'owned_in_flight_batting_emotion_execution_v1', viewReference: viewPin(7), observationReference, deliveryReference,
      physicalPitchReference: launchReference, physicalOperationReference: deliveryCutReference, expectedWorld } });
  const emotionReference = reference('batting_emotion_execution_v1_executions', emotion);
  const decisionCut = record('same_pa_physical_cut_v1', 'lan01:swing:decision-cut', { stage: 'in_flight', operationOrdinal: 3,
    source: { viewReference: viewPin(8), launchReference, previousOperationReference: deliveryCutReference, throughTick: 52_000 } });
  const decisionCutReference = reference('pa_physical_v1_cuts', decisionCut);
  boundary.cutProof = { actor, record: decisionCut };
  const eventReferences = [secondRef, launchReference, captureCutReference, observationReference, deliveryCutReference,
    deliveryReference, predictionReference, emotionReference, decisionCutReference];
  const prefix = record('same_pa_lifecycle_prefix', 'lan01:occupied:cut9:prefix', { source: { eventReferences, anchorViewReference: anchorReference } });
  const decisionPrefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix);
  const view = record('same_pa_lifecycle_view', 'lan01:occupied:cut9:view', { source: { prefixReference: decisionPrefixReference }, cut: { physicalOperationReference: decisionCutReference } });
  const cut9ViewReference = reference('pa_lifecycle_v1_execution_views', view), basis = { actor, view, members };
  boundary.views.set(cut9ViewReference.sourceId, basis);
  const calibrations = ['batter_decision', 'batter_motor', 'batter_swing'].map(route =>
    record('same_pa_lifecycle_execution_calibration', `lan01:occupied:cut9:${route}`, { source: { route, member } }));
  const calibrationReferences = calibrations.map(c => ({ route: c.source.route, calibrationReference: reference('pa_lifecycle_v1_execution_calibrations', c) }));
  const input = record('same_pa_batting_input', 'lan01:swing:input', { physicalPitchReference: launchReference,
    source: { capability: 'owned_in_flight_same_pa_batting_execution_input_v1', viewReference: cut9ViewReference, member,
      postureReference, intentReference, emotionReference, physicalPitchReference: launchReference, physicalOperationReference: decisionCutReference,
      assessmentReferences: [scoreReference], calibrationReferences, directive: 'SWING', expectedWorld: { ...expectedWorld, worldRevision: 5 } } });
  const inputReference = reference('batting_execution_v1_inputs', input);
  const pins = { postureReference, intentReference, launchReference, captureCutReference, observationReference, deliveryCutReference,
    deliveryReference, predictionReference, scoreReference, emotionReference, decisionCutReference, decisionPrefixReference, cut9ViewReference, inputReference };
  type Args = Parameters<typeof completeSamePaPhysicalLifecycleFromCutFixture>;
  const f = { db: {}, path: '/unused/source-contract-only.sqlite', actor, acceptedAction: { source: {} }, x: { f: { track: <T>(value: T) => value } } } as unknown as Args[0];
  const prepared = { first: second, second, anchor: { viewReference: anchorReference }, basis: { viewReference: cut9ViewReference, view, basis, calibrationSet: { calibrations } },
    eventReferences, worldOwner: { readHead: () => boundary.world.head } } as unknown as Args[2];
  const h = completeSamePaPhysicalLifecycleFromCutFixture(f, new Map(), prepared, {}, 'lan01:occupied');
  const read = () => readRetainedInFlightBattingInput(h, 'lan01:swing', pins);
  const resume = () => continueRetainedInFlightBattingInput(h, 'lan01:swing', read());
  return { f, h, prepared, pins, read, resume, prefix, input, emotion, decisionCut, captureCut, beforePrefix, eventReferences, calibrations };
};
beforeEach(() => {
  boundary.records.clear(); boundary.views.clear(); boundary.replay.mockClear(); boundary.currentView.mockClear(); boundary.queryScope.mockClear();
  boundary.advance.mockReset(); boundary.after.mockReset(); boundary.operation.mockReset();
  boundary.operation.mockImplementation(() => { throw new Error('first unperformed commitment'); });
});
it('restores nine admitted events and reaches the exact original commitment as its first writer', () => {
  const x = inputs(), retained = x.read();
  expect(retained.input).toBe(x.input); expect(retained.beforeLaunch.worldRevision).toBe(4);
  expect(x.h.events).toEqual(x.eventReferences); expect(boundary.operation).not.toHaveBeenCalled();
  expect(() => continueRetainedInFlightBattingInput(x.h, 'lan01:swing', retained)).toThrow('first unperformed commitment');
  expect(boundary.after).toHaveBeenCalledTimes(1); expect(boundary.after).toHaveBeenCalledWith(x.f.db, x.pins.cut9ViewReference, null);
  expect(boundary.operation).toHaveBeenCalledTimes(1); expect(boundary.operation).toHaveBeenCalledWith('lan01:swing:commitment');
  expect(boundary.after.mock.invocationCallOrder[0]).toBeLessThan(boundary.operation.mock.invocationCallOrder[0]);
  expect(boundary.advance).not.toHaveBeenCalled(); expect(boundary.replay).not.toHaveBeenCalled();
  expect(boundary.currentView).not.toHaveBeenCalled(); expect(boundary.queryScope).not.toHaveBeenCalled();
});
it('preserves the shared commitment, cut10, resolution and cut11 declarations and prepared World revision', () => {
  const x = inputs(), retained = x.read();
  boundary.operation.mockImplementation((id: string) => ({ kind: id.endsWith(':commitment') ? 'same_pa_physical_commitment_v1' : 'same_pa_physical_resolution_v1', source: x.h.accepted.get(id) }));
  boundary.advance.mockImplementation((_f: unknown, _anchor: unknown, _events: unknown, label: string) => ({ ...x.h.current(), viewReference: reference('pa_lifecycle_v1_execution_views', { source: { sourceId: label + ':view' } }) }));
  const prepareCommitment = vi.fn(source => source);
  const result = continueRetainedInFlightBattingInput(x.h, 'lan01:swing', retained, { prepareCommitment });
  expect(result.input).toBe(x.input); expect(result.preparedWorldRevision).toBe(5);
  expect(prepareCommitment).toHaveBeenCalledTimes(1); expect(prepareCommitment).toHaveBeenCalledWith({ sourceId: 'lan01:swing:commitment', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_commitment_v1',
    viewReference: x.pins.cut9ViewReference, launchReference: x.pins.launchReference, previousOperationReference: x.pins.decisionCutReference,
    inputReference: x.pins.inputReference, intentReference: x.pins.intentReference }, x.input);
  expect(boundary.operation.mock.calls).toEqual([['lan01:swing:commitment'], ['lan01:swing:resolution']]);
  expect(boundary.advance.mock.calls.map(call => call[3])).toEqual(['lan01:occupied:cut10', 'lan01:occupied:cut11']);
  expect(x.h.accepted.get('lan01:swing:resolution')).toEqual({ sourceId: 'lan01:swing:resolution', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_resolution_v1',
    viewReference: reference('pa_lifecycle_v1_execution_views', { source: { sourceId: 'lan01:occupied:cut10:view' } }), launchReference: x.pins.launchReference,
    previousOperationReference: result.commitmentReference, commitmentReference: result.commitmentReference, throughTick: 100_000 });
  expect(x.h.events).toEqual([...x.eventReferences, result.commitmentReference, result.resolutionReference]);
  expect(boundary.replay).not.toHaveBeenCalled();
});
it('rejects a failed current AFTER fence before the first new writer', () => {
  const x = inputs(); boundary.after.mockImplementation(() => { throw new Error('later work already exists'); });
  expect(x.resume).toThrow('later work already exists');
  expect(boundary.operation).not.toHaveBeenCalled(); expect(boundary.advance).not.toHaveBeenCalled(); expect(boundary.replay).not.toHaveBeenCalled();
  expect(x.h.events).toEqual(x.eventReferences);
});
it.each([
  ['changed physical predecessor', (x: ReturnType<typeof inputs>) => { x.decisionCut.source.previousOperationReference = x.pins.launchReference; }],
  ['wrong capture time', (x: ReturnType<typeof inputs>) => { x.captureCut.source.throughTick++; }],
  ['missing admitted emotion', (x: ReturnType<typeof inputs>) => { x.prefix.source.eventReferences = x.eventReferences.filter(r => r !== x.pins.emotionReference); }],
  ['input from another view', (x: ReturnType<typeof inputs>) => { x.input.source.viewReference = { ...x.pins.cut9ViewReference, sourceId: 'lan01:occupied:cut8:view' }; }],
  ['input from another decision cut', (x: ReturnType<typeof inputs>) => { x.input.source.physicalOperationReference = x.pins.deliveryCutReference; }],
  ['changed input calibration', (x: ReturnType<typeof inputs>) => { x.input.source.calibrationReferences = []; }],
  ['different original TAKE', (x: ReturnType<typeof inputs>) => { x.beforePrefix.source.eventReferences = []; }],
  ['moved World revision', () => { boundary.world.head.worldRevision++; }],
] as const)('rejects %s without replaying a completed owner or entering commitment', (_name, mutate) => {
  const x = inputs(); mutate(x); expect(x.resume).toThrow();
  expect(boundary.operation).not.toHaveBeenCalled(); expect(boundary.advance).not.toHaveBeenCalled(); expect(boundary.replay).not.toHaveBeenCalled();
});
it('rejects a changed continuation invocation before commitment', () => {
  const x = inputs(), retained = x.read();
  expect(() => continueRetainedInFlightBattingInput(x.h, 'other:swing', retained)).toThrow('original invocation differs');
  expect(() => continueRetainedInFlightBattingInput(x.h, 'lan01:swing', retained, { attempt: 'bunt' as never })).toThrow('original invocation differs');
  expect(boundary.operation).not.toHaveBeenCalled(); expect(boundary.replay).not.toHaveBeenCalled();
});
it('rejects an extra admitted input, wrong cut or non-LAN restoration', () => {
  const x = inputs();
  for (const [prepared, label] of [
    [{ ...x.prepared, eventReferences: [...x.eventReferences, x.pins.inputReference] }, 'lan01:occupied'],
    [{ ...x.prepared, basis: { ...x.prepared.basis, viewReference: { ...x.pins.cut9ViewReference, sourceId: 'lan01:occupied:cut8:view' } } }, 'lan01:occupied'],
    [x.prepared, 'physical-fixture'],
  ] as const) expect(() => completeSamePaPhysicalLifecycleFromCutFixture(x.f, new Map(),
    prepared as unknown as Parameters<typeof completeSamePaPhysicalLifecycleFromCutFixture>[2], {}, label)).toThrow('exact LAN delivery-cut prefix or accepted-input prefix');
  expect(boundary.operation).not.toHaveBeenCalled(); expect(boundary.advance).not.toHaveBeenCalled();
});

it('retains the exact original commitment tail and physical future closure declarations', () => {
  const source = readFileSync(new URL('./InFlightBattingLifecycleFixture.test-support.ts', import.meta.url), 'utf8');
  const seam = source.slice(source.indexOf('const completeInFlightBattingInput ='));
  const start = "  const inputReference = reference('batting_execution_v1_inputs', input);";
  const end = '  return { input, inputReference, preparedWorldRevision, commitment, commitmentReference, resolution, resolutionReference };';
  const body = seam.slice(seam.indexOf(start), seam.indexOf(end) + end.length);
  // Exact original post-acceptInput declarations at base 7d043125.
  expect(createHash('sha256').update(body).digest('hex')).toBe('011b0b97b79268a67564b543b92ede2019c5278244073c95c10fe88e39e9b62f');
  expect(source).toContain('return completeInFlightBattingInput(h, label, { ...prefix, input }, options);');
  expect(source).toContain('const completed = completeInFlightBattingInput(h, label, retained, options);');
  const physical = readFileSync(new URL('./SamePlateAppearancePhysicalLifecycleFixture.test-support.ts', import.meta.url), 'utf8');
  const physicalStart = physical.indexOf('  const physical=track(openSqliteSamePlateAppearancePhysicalEpisodeStore(f.path,');
  const physicalBody = physical.slice(physicalStart, physical.indexOf('\n};', physicalStart));
  expect(Buffer.byteLength(physicalBody)).toBe(4285);
  expect(createHash('sha256').update(physicalBody).digest('hex')).toBe('16e2aff00f455b52abe28034029321788688c7d171d5c693ea4ecfb8fb52caf5');
});
