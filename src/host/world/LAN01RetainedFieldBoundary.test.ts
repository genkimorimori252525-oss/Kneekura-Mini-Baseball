import { beforeEach, expect, it, vi } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readLAN01RetainedFieldBoundary } from './LAN01RetainedFieldBoundary.test-support';

const boundary = vi.hoisted(() => ({
  records: new Map<string, any>(), views: new Map<string, any>(), world: null as any,
  operation: vi.fn(), reserved: vi.fn(), coverage: vi.fn(),
  forbidden: vi.fn(() => { throw new Error('retained field boundary opened a scope or writer'); }),
}));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite', () => ({
  readHistoricalSamePaLifecycleViewFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.views.get(pin.sourceId),
  readSamePaLifecycleRecordFromSqlite: (_db: unknown, _kind: unknown, id: string) => boundary.records.get(id),
  assertSamePaLifecycleReservedStateFromSqlite: boundary.reserved,
  assertSamePaLifecycleWorkCoverage: boundary.coverage,
  readCurrentSamePaLifecycleViewFromSqlite: boundary.forbidden, withSamePaLifecycleReadPhase: boundary.forbidden,
}));
vi.mock('./SamePlateAppearancePhysicalEpisodeFromSqlite', () => ({
  readSamePaPhysicalOperationFromSqlite: boundary.operation,
  readCurrentSamePaInFlightCutFromSqlite: boundary.forbidden,
  openSqliteSamePlateAppearancePhysicalEpisodeStore: boundary.forbidden,
}));
vi.mock('./SqliteBattingPerceptionStore', () => ({
  readBattingPerceptionFromSqlite: (_db: unknown, _kind: unknown, pin: { sourceId: string }) => boundary.records.get(pin.sourceId),
  openSqliteBattingPerceptionStore: boundary.forbidden,
}));
vi.mock('./SqliteBattingExecutionInputStore', () => ({
  readSamePaBattingIntentFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.records.get(pin.sourceId),
  readSamePaBattingExecutionInputFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.records.get(pin.sourceId),
  openSqliteBattingExecutionInputStore: boundary.forbidden,
}));
vi.mock('./EmotionWorldRevisionFromSqlite', () => ({ readEmotionWorldRevisionFromSqlite: () => boundary.world }));
vi.mock('./SqliteReadTransaction.test-support', () => ({ withSqliteReadTransaction: boundary.forbidden }));

// Finite owner-reader boundary declarations. No Native database or owner runs;
// the real helper must reject an altered graph and propagate independent fences.
const fixture = () => {
  const pin = (owner: any, sourceId: string) => reference(owner, { source: { sourceId } });
  const enrollmentReference = pin('same_pa_enrollments', 'lan01:occupied:enrollment');
  const lineage = { enrollmentReference, careerId: 'career-a', participantReferences: [] };
  const actor = { source: { sourceId: 'occupied-actor' }, binding: { careerId: 'career-a', playerId: 'away-2' } };
  const record = (kind: string, sourceId: string, values: any = {}) => {
    const value = { kind, lineage, ...values, source: { sourceId, ...values.source } };
    boundary.records.set(sourceId, value); return value;
  };
  const timeline = { events: [{ kind: 'TakenPitchPlateCrossed' }, { kind: 'PitchAdjudicated' },
    { kind: 'TakenPitchPlateCrossed' }, { kind: 'PitchAdjudicated' }], status: { kind: 'active', count: { balls: 0, strikes: 2 } } };
  const second = record('same_pa_successor_take_executed_v1', 'lan01:occupied:second-pitch', { result: { resolution: { timeline } } });
  const anchorViewReference = pin('pa_continuation_v1_execution_views', 'lan01:occupied:anchor:view');
  const pins: any = {
    launchReference: pin('pa_physical_v1_launches', 'lan01:swing:launch'),
    captureCutReference: pin('pa_physical_v1_cuts', 'lan01:swing:capture-cut'),
    observationReference: pin('batting_observation_v1_observations', 'lan01:swing:capture'),
    deliveryCutReference: pin('pa_physical_v1_cuts', 'lan01:swing:delivery-cut'),
    deliveryReference: pin('batting_observation_v1_deliveries', 'lan01:swing:delivery'),
    predictionReference: pin('batting_prediction_v1_predictions', 'lan01:swing:forecast'),
    scoreReference: pin('batting_score_v1_assessments', 'lan01:swing:score'),
    emotionReference: pin('batting_emotion_execution_v1_executions', 'lan01:swing:emotion'),
    decisionCutReference: pin('pa_physical_v1_cuts', 'lan01:swing:decision-cut'),
    fieldCalibrationReference: pin('pa_physical_v1_field_calibrations', 'lan01:field:calibration'),
  };
  const oldEvents = [reference('pa_take_successor_v1_pitch_actions', second), pins.launchReference, pins.captureCutReference,
    pins.observationReference, pins.deliveryCutReference, pins.deliveryReference, pins.predictionReference,
    pins.emotionReference, pins.decisionCutReference];
  const prefix9 = record('same_pa_lifecycle_prefix', 'lan01:occupied:cut9:prefix', {
    source: { enrollmentReference, anchorViewReference, eventReferences: oldEvents } });
  pins.decisionPrefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix9);
  const view9 = record('same_pa_lifecycle_view', 'lan01:occupied:cut9:view', { source: { prefixReference: pins.decisionPrefixReference } });
  pins.cut9ViewReference = reference('pa_lifecycle_v1_execution_views', view9);
  const posture = record('batting_invocation_posture', 'lan01:swing:posture', {
    physicalPitchSourceId: pins.launchReference.sourceId, source: { capability: 'owned_in_flight_batting_posture_v1' } });
  pins.postureReference = reference('batting_observation_v1_postures', posture);
  const intent = record('same_pa_batting_intent', 'lan01:swing:intent', {
    physicalPitchSourceId: pins.launchReference.sourceId, originalIntent: { actorSourceId: actor.source.sourceId, attempt: 'ordinary_swing' },
    source: { capability: 'owned_in_flight_same_pa_batting_intent_v1', postureReference: pins.postureReference } });
  pins.intentReference = reference('batting_execution_v1_intents', intent);
  boundary.world = { head: { careerId: 'career-a', worldRevision: 2, control: { revision: 0, controllerId: 'controller-a' } } };
  const expectedWorld = { careerId: 'career-a', worldRevision: 1, controlRevision: 0, controlHash: hash(boundary.world.head.control) };
  const input = record('same_pa_batting_input', 'lan01:swing:input', {
    physicalPitchSourceId: pins.launchReference.sourceId, physicalPitchReference: pins.launchReference,
    source: { capability: 'owned_in_flight_same_pa_batting_execution_input_v1', viewReference: pins.cut9ViewReference,
      postureReference: pins.postureReference, intentReference: pins.intentReference, emotionReference: pins.emotionReference,
      physicalPitchReference: pins.launchReference, physicalOperationReference: pins.decisionCutReference,
      assessmentReferences: [pins.scoreReference], directive: 'SWING', expectedWorld } });
  pins.inputReference = reference('batting_execution_v1_inputs', input);
  const common = { physicalPitchSourceId: pins.launchReference.sourceId, pitchOrdinal: 3, timeline };
  const commitment = record('same_pa_physical_commitment_v1', 'lan01:swing:commitment', {
    ...common, stage: 'committed', operationOrdinal: 4, evaluationTick: 100, beforeWorldRevision: 1, afterWorldRevision: 2,
    controlRevision: 0, controlHash: expectedWorld.controlHash, inputSource: input.source, originalIntent: intent.originalIntent,
    commitment: { action: 'SWING' }, source: { viewReference: pins.cut9ViewReference, launchReference: pins.launchReference,
      previousOperationReference: pins.decisionCutReference, inputReference: pins.inputReference, intentReference: pins.intentReference } });
  pins.commitmentReference = reference('pa_physical_v1_commitments', commitment);
  const contact = { tick: 200 };
  const contactTimeline = { events: [...timeline.events, { kind: 'BatBallContact', tick: 200, payload: { contact } }],
    status: { kind: 'batted_ball_pending', contactTick: 200, count: { balls: 0, strikes: 2 } } };
  const resolution = record('same_pa_physical_resolution_v1', 'lan01:swing:resolution', {
    ...common, timeline: contactTimeline, stage: 'resolved', operationOrdinal: 5, evaluationTick: 200, contact,
    resolution: { kind: 'recorded_swing' }, source: { viewReference: pin('pa_lifecycle_v1_execution_views', 'lan01:occupied:cut10:view'),
      launchReference: pins.launchReference, previousOperationReference: pins.commitmentReference, commitmentReference: pins.commitmentReference } });
  pins.resolutionReference = reference('pa_physical_v1_resolutions', resolution);
  const root = record('same_pa_physical_field_root_v1', 'lan01:field:field-root', {
    ...common, timeline: contactTimeline, stage: 'field', operationOrdinal: 6, evaluationTick: 200,
    source: { viewReference: pin('pa_lifecycle_v1_execution_views', 'lan01:occupied:cut11:view'), launchReference: pins.launchReference,
      previousOperationReference: pins.resolutionReference, resolutionReference: pins.resolutionReference, postureReference: pins.postureReference,
      fieldInputs: { kind: 'fresh_physical_field_calibration_v1', calibrationReference: pins.fieldCalibrationReference }, throughTick: 200 } });
  pins.fieldRootReference = reference('pa_physical_v1_field_roots', root);
  const eventReferences = [...oldEvents, pins.commitmentReference, pins.resolutionReference, pins.fieldRootReference];
  const prefix = record('same_pa_lifecycle_prefix', 'lan01:occupied:cut12:prefix', {
    source: { enrollmentReference, anchorViewReference, eventReferences } });
  pins.cut12PrefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix);
  const view = record('same_pa_lifecycle_view', 'lan01:occupied:cut12:view', {
    source: { prefixReference: pins.cut12PrefixReference }, participants: [],
    cut: { stage: 'field_active', pitchOrdinal: 3, physicalPitchReference: pins.launchReference,
      operationReference: pins.fieldRootReference, physicalOperationReference: pins.fieldRootReference,
      timeline: contactTimeline, evaluationTick: 200, outcomeReference: null, resetReference: null } });
  pins.cut12ViewReference = reference('pa_lifecycle_v1_execution_views', view);
  const basis = { actor, view, members: [] };
  boundary.views.set(view.source.sourceId, basis);
  boundary.views.set(view9.source.sourceId, { actor, view: view9, members: [] });
  boundary.operation.mockImplementation((_db: unknown, ref: any) => {
    const value = boundary.records.get(ref.sourceId);
    return value && { record: value, actor, reference: ref, physicalPitchReference: pins.launchReference };
  });
  const context: any = { db: { prepare: boundary.forbidden }, actor, second, anchorViewReference,
    current: { view, viewReference: pins.cut12ViewReference, basis }, eventReferences };
  return { context, pins, posture, input, intent, commitment, resolution, root, prefix };
};
beforeEach(() => { vi.clearAllMocks(); boundary.records.clear(); boundary.views.clear(); boundary.reserved.mockReset(); boundary.coverage.mockReset(); });

it('returns genuine accepted records and separately fences the exact field AFTER boundary without appending', () => {
  const f = fixture();
  expect(readLAN01RetainedFieldBoundary(f.context, f.pins)).toEqual({ posture: f.posture, input: f.input, intent: f.intent,
    commitment: f.commitment, resolution: f.resolution, root: f.root });
  expect(boundary.reserved).toHaveBeenCalledWith(f.context.db, f.context.current.basis);
  expect(boundary.coverage).toHaveBeenCalledWith(f.context.db, f.root.lineage.enrollmentReference, f.context.anchorViewReference, f.context.eventReferences);
  expect(boundary.forbidden).not.toHaveBeenCalled();
});
it('rejects a changed physical record even if a substituted reader ignores the pinned reference', () => {
  const f = fixture(); f.commitment.beforeWorldRevision = 50;
  expect(() => readLAN01RetainedFieldBoundary(f.context, f.pins)).toThrow(/physical owner reference differs/);
});
it('rejects a changed posture reference against the authenticated original root', () => {
  const f = fixture(); f.pins.postureReference = { ...f.pins.postureReference, snapshotHash: 'a'.repeat(64) };
  expect(() => readLAN01RetainedFieldBoundary(f.context, f.pins)).toThrow(/root posture differs/);
});
it('rejects a missing retained physical owner', () => {
  const f = fixture(); boundary.records.delete(f.root.source.sourceId);
  expect(() => readLAN01RetainedFieldBoundary(f.context, f.pins)).toThrow(/missing/);
});
it.each(['missing', 'extra'] as const)('rejects %s retained work instead of extending the accepted prefix', mode => {
  const f = fixture(); f.context.eventReferences = mode === 'missing' ? f.context.eventReferences.slice(0, -1)
    : [...f.context.eventReferences, f.pins.fieldRootReference];
  expect(() => readLAN01RetainedFieldBoundary(f.context, f.pins)).toThrow(/event.*differs/);
  expect(boundary.coverage).not.toHaveBeenCalled();
});
it.each(['world', 'control', 'hash'] as const)('rejects a changed current %s after authenticating history', change => {
  const f = fixture();
  if (change === 'world') boundary.world.head.worldRevision++;
  if (change === 'control') boundary.world.head.control.revision++;
  if (change === 'hash') boundary.world.head.control.controllerId = 'other-controller';
  expect(() => readLAN01RetainedFieldBoundary(f.context, f.pins)).toThrow(/World.*differs/);
});
it.each(['reserved', 'coverage'] as const)('propagates current %s rejection without treating history as authority', fence => {
  const f = fixture(); boundary[fence].mockImplementation(() => { throw new Error('current ' + fence + ' rejected'); });
  expect(() => readLAN01RetainedFieldBoundary(f.context, f.pins)).toThrow('current ' + fence + ' rejected');
});
it('propagates the production physical owner head rejection', () => {
  const f = fixture(); boundary.operation.mockImplementation(() => { throw new Error('physical operation is not covered by its committed head'); });
  expect(() => readLAN01RetainedFieldBoundary(f.context, f.pins)).toThrow(/committed head/);
});
