import { beforeEach, expect, it, vi } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readLAN01RetainedThrowBoundary } from './LAN01RetainedThrowBoundary.test-support';

const boundary = vi.hoisted(() => ({
  records: new Map<string, any>(), views: new Map<string, any>(), world: null as any,
  operation: vi.fn(), reserved: vi.fn(), coverage: vi.fn(),
  forbidden: vi.fn(() => { throw new Error('retained throw boundary opened a scope or writer'); }),
}));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite', () => ({
  readHistoricalSamePaLifecycleViewFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.views.get(pin.sourceId),
  readSamePaLifecycleRecordFromSqlite: (_db: unknown, _kind: unknown, id: string) => boundary.records.get(id),
  readSamePaLifecycleCalibrationFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.records.get(pin.sourceId),
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
vi.mock('./SamePlateAppearanceCatchWorkFromSqlite', () => ({
  readSamePaCatchWorkFromSqlite: (_db: unknown, pin: { sourceId: string }) => boundary.records.get(pin.sourceId),
  openSqliteSamePlateAppearanceCatchWorkStore: boundary.forbidden,
}));
vi.mock('./EmotionWorldRevisionFromSqlite', () => ({ readEmotionWorldRevisionFromSqlite: () => boundary.world }));
vi.mock('./SqliteReadTransaction.test-support', () => ({ withSqliteReadTransaction: boundary.forbidden }));

// Finite owner-reader boundary declarations. No Native database or owner runs;
// the real helper must reject an altered graph and propagate independent fences.
const fixture = () => {
  const pin = (owner: any, sourceId: string) => reference(owner, { source: { sourceId } });
  const enrollmentReference = pin('same_pa_enrollments', 'lan01:occupied:enrollment');
  const playerIds = ['away-2', 'p2', ...Array.from({ length: 8 }, (_, i) => 'home-' + (i + 1)), 'away-1'];
  const members = playerIds.map(playerId => ({ playerId, bindingHash: hash(playerId), personHash: hash(playerId),
    baselineSourceId: playerId + ':baseline', reservedRevision: 0, reservedStateHash: hash(playerId), projectedStateHash: hash(playerId) }));
  const participantReferences = members.map(m => ({ playerId: m.playerId, bindingHash: m.bindingHash, personHash: m.personHash,
    baselineSourceId: m.baselineSourceId, revision: m.reservedRevision, stateHash: m.reservedStateHash }));
  const participants = members.map(m => ({ playerId: m.playerId, projectedStateHash: m.projectedStateHash }));
  const lineage = { enrollmentReference, careerId: 'career-a', participantReferences };
  const physicalWorld = { original: 'World' }, bodyCut = { original: 'body' };
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
    source: { enrollmentReference, anchorViewReference, eventReferences: [...eventReferences] } });
  pins.cut12PrefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix);
  const view = record('same_pa_lifecycle_view', 'lan01:occupied:cut12:view', {
    source: { prefixReference: pins.cut12PrefixReference }, participants,
    cut: { stage: 'field_active', pitchOrdinal: 3, physicalPitchReference: pins.launchReference,
      operationReference: pins.fieldRootReference, physicalOperationReference: pins.fieldRootReference,
      timeline: contactTimeline, evaluationTick: 200, outcomeReference: null, resetReference: null, physicalWorld, bodyCut } });
  pins.cut12ViewReference = reference('pa_lifecycle_v1_execution_views', view);
  const fieldBasis = { actor, view, members };
  boundary.views.set(view.source.sourceId, fieldBasis);
  const nextView = (ordinal: number, events: any[], operation: any, tick: number) => {
    const prefix = record('same_pa_lifecycle_prefix', 'lan01:occupied:cut' + ordinal + ':prefix', {
      source: { enrollmentReference, anchorViewReference, eventReferences: [...events] } });
    const next = record('same_pa_lifecycle_view', 'lan01:occupied:cut' + ordinal + ':view', {
      source: { prefixReference: reference('pa_lifecycle_v1_work_prefixes', prefix), participantTotalReferences:
        playerIds.map(playerId => ({ playerId, assessmentReference: pin('pa_lifecycle_v1_total_assessments', 'cut' + ordinal + ':' + playerId) })) }, participants,
      cut: { ...view.cut, operationReference: operation, physicalOperationReference: operation, evaluationTick: tick } });
    const basis = { actor, view: next, members };
    boundary.views.set(next.source.sourceId, basis);
    return { view: next, viewReference: reference('pa_lifecycle_v1_execution_views', next), basis, prefix };
  };
  const moment = { originTick: 103_000_000, elapsedSeconds: 0.218722, ball: { tick: 103_218_722 } };
  const carried = { motion: { carrierPlayerId: 'p2', response: { kind: 'carried' }, world: { moment },
    actors: playerIds.map(playerId => ({ playerId, primitive: { endTick: 111_694_321 } })) } };
  const stepRecord = (id: string, ordinal: number, viewReference: any, previous: any, action: any, actionResult: any) =>
    record('same_pa_physical_field_step_v1', id, { ...common, timeline: contactTimeline, stage: 'field', operationOrdinal: ordinal,
      evaluationTick: moment.ball.tick, viewReference, field: carried, ...(actionResult ? { actionResult } : {}),
      source: { viewReference, launchReference: pins.launchReference, previousOperationReference: previous, previousFieldReference: previous,
        fieldRootReference: pins.fieldRootReference, throughTick: moment.ball.tick, ...(action ? { action } : {}) } });
  const step = stepRecord('lan01:field:field-step', 7, pins.cut12ViewReference, pins.fieldRootReference, undefined, undefined);
  pins.fieldStepReference = reference('pa_physical_v1_field_steps', step);
  eventReferences.push(pins.fieldStepReference);
  const view13 = nextView(13, eventReferences, pins.fieldStepReference, moment.ball.tick); pins.cut13ViewReference = view13.viewReference;
  const secured = stepRecord('lan01:appeal-throw:1', 8, pins.cut13ViewReference, pins.fieldStepReference,
    { kind: 'capture_checkpoint_v1', candidateReference: pins.fieldStepReference, throughElapsedSeconds: moment.elapsedSeconds },
    { kind: 'capture_checkpoint_v1', candidateReference: pins.fieldStepReference, progress: { kind: 'secured' } });
  pins.securedReference = reference('pa_physical_v1_field_steps', secured);
  eventReferences.push(pins.securedReference);
  const view14 = nextView(14, eventReferences, pins.securedReference, moment.ball.tick); pins.cut14ViewReference = view14.viewReference;
  const caught = record('same_pa_catch_work_v1', 'lan01:caught:work:original', {
    physicalPitchReference: pins.launchReference, physicalOperationReference: pins.securedReference, evaluationTick: moment.ball.tick,
    source: { enrollmentReference, viewReference: pins.cut14ViewReference, priorWorkReference: null },
    originalInputs: { source: { sourceId: 'lan01:caught:communication:original', viewReference: pins.cut14ViewReference },
      action: { sourceId: 'lan01:caught:action', viewReference: pins.cut14ViewReference, judgment: 'caught' },
      assignment: { sourceId: 'lan01:caught:assignment' }, person: { sourceId: 'lan01:caught:person' }, model: { sourceId: 'lan01:caught:reception-model' } } });
  pins.caughtReference = reference('pa_catch_v1_work', caught); eventReferences.push(pins.caughtReference);
  const view15 = nextView(15, eventReferences, pins.securedReference, moment.ball.tick); pins.cut15ViewReference = view15.viewReference;
  const thrower = members.find(m => m.playerId === 'p2');
  const indicated = stepRecord('lan01:appeal-throw:2', 9, pins.cut15ViewReference, pins.securedReference,
    { kind: 'appeal_indication_v1', member: thrower, defenderId: 'home-1', runnerId: 'away-1', base: 'first', contact: 'base' },
    { kind: 'appeal_indication_v1', throwerId: 'p2', defenderId: 'home-1', runnerId: 'away-1', base: 'first', contact: 'base',
      indicatedAt: { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick } });
  pins.indicatedReference = reference('pa_physical_v1_field_steps', indicated); eventReferences.push(pins.indicatedReference);
  const current = nextView(16, eventReferences, pins.indicatedReference, moment.ball.tick);
  pins.cut16ViewReference = current.viewReference; pins.cut16PrefixReference = current.view.source.prefixReference;
  const throwCalibration = record('same_pa_lifecycle_calibration', 'lan01:appeal-throw:throw-calibration', {
    source: { route: 'defender_throw', viewReference: pins.cut16ViewReference, member: thrower } });
  pins.throwCalibrationReference = reference('pa_lifecycle_v1_execution_calibrations', throwCalibration);
  const planned = stepRecord('lan01:appeal-throw:3', 10, pins.cut16ViewReference, pins.indicatedReference,
    { kind: 'throw_plan_v1', member: thrower, calibrationReference: pins.throwCalibrationReference, receiverPlayerId: 'home-1',
      coverageThroughTick: 111_694_321, appealIndicationReference: pins.indicatedReference },
    { kind: 'throw_plan_v1', plan: { original: 'owned-plan' }, appealIndicationReference: pins.indicatedReference });
  pins.plannedReference = reference('pa_physical_v1_field_steps', planned);
  boundary.operation.mockImplementation((_db: unknown, ref: any) => {
    const value = boundary.records.get(ref.sourceId);
    return value && { record: value, actor, reference: ref, physicalPitchReference: pins.launchReference, physicalWorld, bodyCut };
  });
  const context: any = { db: { prepare: boundary.forbidden }, actor, second, anchorViewReference, current, eventReferences };
  return { context, pins, posture, input, intent, commitment, resolution, root, step, secured, indicated, planned, throwCalibration, caught, prefix };
};

beforeEach(() => { vi.clearAllMocks(); boundary.records.clear(); boundary.views.clear(); boundary.reserved.mockReset(); boundary.coverage.mockReset(); });

it('adopts the exact accepted plan outside cut16 and fences its seventeen-row current coverage without writers', () => {
  const f = fixture();
  const result = readLAN01RetainedThrowBoundary(f.context, f.pins);
  expect(result).toEqual({ field: { root: f.root, rootReference: f.pins.fieldRootReference, step: f.step, stepReference: f.pins.fieldStepReference,
    resolution: f.resolution, resolutionReference: f.pins.resolutionReference },
    secured: { value: f.secured, operationReference: f.pins.securedReference }, indicated: { value: f.indicated, operationReference: f.pins.indicatedReference },
    planned: { value: f.planned, operationReference: f.pins.plannedReference }, throwCalibration: f.throwCalibration,
    caught: { work: f.caught, workReference: f.pins.caughtReference } });
  expect(result.planned.value).toBe(f.planned); expect(result.caught.work.originalInputs).toBe(f.caught.originalInputs);
  expect(boundary.operation.mock.calls.map(c => c[1].sourceId)).toEqual([
    'lan01:field:field-root', 'lan01:swing:commitment', 'lan01:swing:resolution', 'lan01:field:field-step',
    'lan01:appeal-throw:1', 'lan01:appeal-throw:2', 'lan01:appeal-throw:3']);
  expect(f.context.eventReferences).toHaveLength(16); expect(f.context.eventReferences).not.toContainEqual(f.pins.plannedReference);
  expect(boundary.reserved).toHaveBeenCalledWith(f.context.db, f.context.current.basis);
  expect(boundary.coverage).toHaveBeenCalledWith(f.context.db, f.root.lineage.enrollmentReference, f.context.anchorViewReference,
    [...f.context.eventReferences, f.pins.plannedReference]);
  expect(boundary.forbidden).not.toHaveBeenCalled();
});
it.each(['planned', 'caught', 'throwCalibration'] as const)('rejects missing retained %s ownership', key => {
  const f = fixture(); boundary.records.delete(f[key].source.sourceId);
  expect(() => readLAN01RetainedThrowBoundary(f.context, f.pins)).toThrow(/missing/);
});
it.each(['planned', 'caught', 'throwCalibration'] as const)('rejects changed retained %s against its exact hash', key => {
  const f = fixture(); f[key].changed = true;
  expect(() => readLAN01RetainedThrowBoundary(f.context, f.pins)).toThrow(/owner reference differs/);
});
it.each(['missing', 'extra', 'premature-plan'] as const)('rejects %s admitted work instead of extending cut16', change => {
  const f = fixture();
  f.context.eventReferences = change === 'missing' ? f.context.eventReferences.slice(0, -1)
    : [...f.context.eventReferences, change === 'extra' ? f.pins.indicatedReference : f.pins.plannedReference];
  expect(() => readLAN01RetainedThrowBoundary(f.context, f.pins)).toThrow(/sixteen admitted event references differs/);
  expect(boundary.coverage).not.toHaveBeenCalled();
});
it('rejects a substituted indication pin before interpreting the later plan', () => {
  const f = fixture(); f.pins.indicatedReference = { ...f.pins.indicatedReference, snapshotHash: 'a'.repeat(64) };
  expect(() => readLAN01RetainedThrowBoundary(f.context, f.pins)).toThrow(/event references differs/);
});
it('rejects a changed current member baseline even when the current basis object is substituted', () => {
  const f = fixture(); f.context.current.basis.members[0].baselineSourceId = 'replacement';
  expect(() => readLAN01RetainedThrowBoundary(f.context, f.pins)).toThrow(/original member baseline differs/);
});
it('rejects an omitted member in the eleven-player current basis', () => {
  const f = fixture(); f.context.current.basis.members.pop();
  expect(() => readLAN01RetainedThrowBoundary(f.context, f.pins)).toThrow(/eleven original members differs/);
});
it.each(['world', 'control', 'hash'] as const)('rejects changed current %s after historical authentication', change => {
  const f = fixture();
  if (change === 'world') boundary.world.head.worldRevision++;
  if (change === 'control') boundary.world.head.control.revision++;
  if (change === 'hash') boundary.world.head.control.controllerId = 'other-controller';
  expect(() => readLAN01RetainedThrowBoundary(f.context, f.pins)).toThrow(/World.*differs/);
});
it.each(['reserved', 'coverage'] as const)('propagates the independent current %s fence', fence => {
  const f = fixture(); boundary[fence].mockImplementation(() => { throw new Error('current ' + fence + ' rejected'); });
  expect(() => readLAN01RetainedThrowBoundary(f.context, f.pins)).toThrow('current ' + fence + ' rejected');
});
it('propagates committed physical head rejection without using an in-flight reader', () => {
  const f = fixture(); boundary.operation.mockImplementation(() => { throw new Error('physical operation is not covered by its committed head'); });
  expect(() => readLAN01RetainedThrowBoundary(f.context, f.pins)).toThrow(/committed head/);
});
