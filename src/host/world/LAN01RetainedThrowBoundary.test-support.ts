import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaSuccessorTakePitch } from './SamePlateAppearanceTakeSuccessor';
import type { SamePaLifecycleView, SamePaLifecycleViewBasis, SamePaLifecycleWorkReference } from './SamePlateAppearanceLifecycle';
import { readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite,
  readSamePaLifecycleCalibrationFromSqlite, assertSamePaLifecycleReservedStateFromSqlite, assertSamePaLifecycleWorkCoverage } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readSamePaBattingExecutionInputFromSqlite, readSamePaBattingIntentFromSqlite } from './SqliteBattingExecutionInputStore';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { readEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { readSamePaCatchWorkFromSqlite } from './SamePlateAppearanceCatchWorkFromSqlite';

export type LAN01RetainedThrowBoundaryPins = Readonly<{
  postureReference: SamePaReference<'batting_observation_v1_postures'>;
  intentReference: SamePaReference<'batting_execution_v1_intents'>;
  inputReference: SamePaReference<'batting_execution_v1_inputs'>;
  launchReference: SamePaReference<'pa_physical_v1_launches'>;
  captureCutReference: SamePaReference<'pa_physical_v1_cuts'>;
  observationReference: SamePaReference<'batting_observation_v1_observations'>;
  deliveryCutReference: SamePaReference<'pa_physical_v1_cuts'>;
  deliveryReference: SamePaReference<'batting_observation_v1_deliveries'>;
  predictionReference: SamePaReference<'batting_prediction_v1_predictions'>;
  scoreReference: SamePaReference<'batting_score_v1_assessments'>;
  emotionReference: SamePaReference<'batting_emotion_execution_v1_executions'>;
  decisionCutReference: SamePaReference<'pa_physical_v1_cuts'>;
  decisionPrefixReference: SamePaReference<'pa_lifecycle_v1_work_prefixes'>;
  cut9ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  commitmentReference: SamePaReference<'pa_physical_v1_commitments'>;
  resolutionReference: SamePaReference<'pa_physical_v1_resolutions'>;
  fieldRootReference: SamePaReference<'pa_physical_v1_field_roots'>;
  fieldCalibrationReference: SamePaReference<'pa_physical_v1_field_calibrations'>;
  cut12PrefixReference: SamePaReference<'pa_lifecycle_v1_work_prefixes'>;
  cut12ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  fieldStepReference: SamePaReference<'pa_physical_v1_field_steps'>;
  securedReference: SamePaReference<'pa_physical_v1_field_steps'>;
  caughtReference: SamePaReference<'pa_catch_v1_work'>;
  indicatedReference: SamePaReference<'pa_physical_v1_field_steps'>;
  throwCalibrationReference: SamePaReference<'pa_lifecycle_v1_execution_calibrations'>;
  plannedReference: SamePaReference<'pa_physical_v1_field_steps'>;
  cut13ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  cut14ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  cut15ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  cut16PrefixReference: SamePaReference<'pa_lifecycle_v1_work_prefixes'>;
  cut16ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
}>;
type Context = Readonly<{
  db: DatabaseSync; actor: DurablePhysicalPlateAppearanceActor; second: SamePaSuccessorTakePitch;
  anchorViewReference: SamePaReference<'pa_continuation_v1_execution_views'>;
  current: Readonly<{ view: SamePaLifecycleView; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>; basis: SamePaLifecycleViewBasis }>;
  eventReferences: readonly SamePaLifecycleWorkReference[];
}>;

/** Exact LAN01-R9 cp39 only. The caller owns the existing query-only proof
 * scope, all cut16 TOTAL/calibration rows and absence of cut17 or later work.
 * Historical owners authenticate the original graph. Independent current
 * fences cover the returned but not yet lifecycle-admitted throw plan :3. */
export const readLAN01RetainedThrowBoundary = (context: Context, pins: LAN01RetainedThrowBoundaryPins) => {
  const { db, actor, second, anchorViewReference, current } = context;
  const same = (actual: unknown, expected: unknown, what: string) => assert.deepEqual(actual, expected, 'LAN01 retained throw ' + what + ' differs');
  const identities: readonly (readonly [SamePaReference, string])[] = [
    [pins.postureReference, 'lan01:swing:posture'], [pins.intentReference, 'lan01:swing:intent'], [pins.inputReference, 'lan01:swing:input'],
    [pins.launchReference, 'lan01:swing:launch'], [pins.captureCutReference, 'lan01:swing:capture-cut'], [pins.observationReference, 'lan01:swing:capture'],
    [pins.deliveryCutReference, 'lan01:swing:delivery-cut'], [pins.deliveryReference, 'lan01:swing:delivery'], [pins.predictionReference, 'lan01:swing:forecast'],
    [pins.scoreReference, 'lan01:swing:score'], [pins.emotionReference, 'lan01:swing:emotion'], [pins.decisionCutReference, 'lan01:swing:decision-cut'],
    [pins.decisionPrefixReference, 'lan01:occupied:cut9:prefix'], [pins.cut9ViewReference, 'lan01:occupied:cut9:view'],
    [pins.commitmentReference, 'lan01:swing:commitment'], [pins.resolutionReference, 'lan01:swing:resolution'],
    [pins.fieldRootReference, 'lan01:field:field-root'], [pins.fieldCalibrationReference, 'lan01:field:calibration'],
    [pins.cut12PrefixReference, 'lan01:occupied:cut12:prefix'], [pins.cut12ViewReference, 'lan01:occupied:cut12:view'],
    [pins.fieldStepReference, 'lan01:field:field-step'], [pins.securedReference, 'lan01:appeal-throw:1'],
    [pins.caughtReference, 'lan01:caught:work:original'], [pins.indicatedReference, 'lan01:appeal-throw:2'],
    [pins.throwCalibrationReference, 'lan01:appeal-throw:throw-calibration'], [pins.plannedReference, 'lan01:appeal-throw:3'],
    [pins.cut13ViewReference, 'lan01:occupied:cut13:view'], [pins.cut14ViewReference, 'lan01:occupied:cut14:view'],
    [pins.cut15ViewReference, 'lan01:occupied:cut15:view'], [pins.cut16PrefixReference, 'lan01:occupied:cut16:prefix'],
    [pins.cut16ViewReference, 'lan01:occupied:cut16:view'],
  ];
  for (const [pin, id] of identities) same(pin.sourceId, id, 'source identity');
  same(second.source.sourceId, 'lan01:occupied:second-pitch', 'second-pitch identity');
  same(anchorViewReference.sourceId, 'lan01:occupied:anchor:view', 'anchor identity');
  const oldEvents: readonly SamePaLifecycleWorkReference[] = [reference('pa_take_successor_v1_pitch_actions', second),
    pins.launchReference, pins.captureCutReference, pins.observationReference, pins.deliveryCutReference,
    pins.deliveryReference, pins.predictionReference, pins.emotionReference, pins.decisionCutReference];
  const fieldEvents = [...oldEvents, pins.commitmentReference, pins.resolutionReference, pins.fieldRootReference];
  const events = [...fieldEvents, pins.fieldStepReference, pins.securedReference, pins.caughtReference, pins.indicatedReference];
  same(context.eventReferences, events, 'sixteen admitted event references');
  same(current.viewReference, pins.cut16ViewReference, 'current view reference');
  const historical = readHistoricalSamePaLifecycleViewFromSqlite(db, pins.cut16ViewReference);
  same(historical, current.basis, 'cut16 basis'); same(historical.actor, actor, 'actor'); same(historical.view, current.view, 'cut16 view');
  same(reference('pa_lifecycle_v1_execution_views', current.view), pins.cut16ViewReference, 'cut16 owner reference');
  same(current.view.source.prefixReference, pins.cut16PrefixReference, 'cut16 prefix reference');
  const fieldBasis = readHistoricalSamePaLifecycleViewFromSqlite(db, pins.cut12ViewReference);
  same(fieldBasis.actor, actor, 'historical field actor');
  same(reference('pa_lifecycle_v1_execution_views', fieldBasis.view), pins.cut12ViewReference, 'cut12 owner reference');
  same(fieldBasis.view.source.prefixReference, pins.cut12PrefixReference, 'cut12 prefix reference');
  for (const [pin, expectedEvents] of [[pins.decisionPrefixReference, oldEvents], [pins.cut12PrefixReference, fieldEvents],
    [pins.cut16PrefixReference, events]] as const) {
    const value = readSamePaLifecycleRecordFromSqlite(db, 'prefix', pin.sourceId);
    assert(value?.kind === 'same_pa_lifecycle_prefix', 'LAN01 retained throw prefix missing');
    same(reference('pa_lifecycle_v1_work_prefixes', value), pin, 'prefix owner reference');
    same(value.source.enrollmentReference, current.view.lineage.enrollmentReference, 'prefix enrollment');
    same(value.source.anchorViewReference, anchorViewReference, 'prefix anchor'); same(value.source.eventReferences, expectedEvents, 'prefix event references');
  }
  const playerIds = ['away-2', 'p2', ...Array.from({ length: 8 }, (_, i) => 'home-' + (i + 1)), 'away-1'];
  for (const values of [current.basis.members, current.view.participants, current.view.lineage.participantReferences,
    current.view.source.participantTotalReferences]) same(values.map(v => v.playerId).sort(), [...playerIds].sort(), 'eleven original members');
  for (const member of current.basis.members) {
    const participant = current.view.lineage.participantReferences.find(p => p.playerId === member.playerId)!;
    const projected = current.view.participants.find(p => p.playerId === member.playerId)!;
    same(member, { playerId: participant.playerId, bindingHash: participant.bindingHash, personHash: participant.personHash,
      baselineSourceId: participant.baselineSourceId, reservedRevision: participant.revision, reservedStateHash: participant.stateHash,
      projectedStateHash: projected.projectedStateHash }, 'original member baseline');
  }

  // These historical readers prove their original physical head chain and each
  // owner's stored effects. An in-flight current reader cannot admit a field root.
  const rootProof = readSamePaPhysicalOperationFromSqlite(db, pins.fieldRootReference);
  const commitmentProof = readSamePaPhysicalOperationFromSqlite(db, pins.commitmentReference);
  const resolutionProof = readSamePaPhysicalOperationFromSqlite(db, pins.resolutionReference);
  assert(rootProof?.record.kind === 'same_pa_physical_field_root_v1', 'LAN01 retained throw root missing');
  assert(commitmentProof?.record.kind === 'same_pa_physical_commitment_v1', 'LAN01 retained throw commitment missing');
  assert(resolutionProof?.record.kind === 'same_pa_physical_resolution_v1', 'LAN01 retained throw resolution missing');
  const root = rootProof.record, commitment = commitmentProof.record, resolution = resolutionProof.record;
  for (const [value, proof, pin, ordinal] of [[commitment, commitmentProof, pins.commitmentReference, 4],
    [resolution, resolutionProof, pins.resolutionReference, 5], [root, rootProof, pins.fieldRootReference, 6]] as const) {
    same(reference(pin.owner, value), pin, 'physical owner reference'); same(proof.actor, actor, 'physical actor');
    same(value.lineage, current.view.lineage, 'physical lineage'); same(proof.physicalPitchReference, pins.launchReference, 'physical pitch reference');
    same(value.source.launchReference, pins.launchReference, 'physical launch');
    same(value.physicalPitchSourceId, pins.launchReference.sourceId, 'physical pitch identity');
    same(value.pitchOrdinal, 3, 'pitch ordinal'); same(value.operationOrdinal, ordinal, 'operation ordinal');
  }
  same(commitment.source.viewReference, pins.cut9ViewReference, 'commitment view');
  same(commitment.source.previousOperationReference, pins.decisionCutReference, 'commitment predecessor');
  same(commitment.source.inputReference, pins.inputReference, 'commitment input'); same(commitment.source.intentReference, pins.intentReference, 'commitment intent');
  same(resolution.source.viewReference.sourceId, 'lan01:occupied:cut10:view', 'resolution view');
  same(resolution.source.previousOperationReference, pins.commitmentReference, 'resolution predecessor');
  same(resolution.source.commitmentReference, pins.commitmentReference, 'resolution commitment');
  same(root.source.viewReference.sourceId, 'lan01:occupied:cut11:view', 'root view');
  same(root.source.previousOperationReference, pins.resolutionReference, 'root predecessor'); same(root.source.resolutionReference, pins.resolutionReference, 'root resolution');
  same(root.source.postureReference, pins.postureReference, 'root posture');
  same(root.source.fieldInputs, { kind: 'fresh_physical_field_calibration_v1', calibrationReference: pins.fieldCalibrationReference }, 'root field calibration');

  const posture = readBattingPerceptionFromSqlite(db, 'posture', pins.postureReference);
  const intent = readSamePaBattingIntentFromSqlite(db, pins.intentReference);
  const input = readSamePaBattingExecutionInputFromSqlite(db, pins.inputReference);
  assert(posture?.kind === 'batting_invocation_posture' && posture.source.capability === 'owned_in_flight_batting_posture_v1', 'LAN01 retained throw posture missing');
  assert(intent?.kind === 'same_pa_batting_intent' && intent.source.capability === 'owned_in_flight_same_pa_batting_intent_v1', 'LAN01 retained throw intent missing');
  assert(input?.kind === 'same_pa_batting_input' && input.source.capability === 'owned_in_flight_same_pa_batting_execution_input_v1', 'LAN01 retained throw input missing');
  for (const [value, pin] of [[posture, pins.postureReference], [intent, pins.intentReference], [input, pins.inputReference]] as const) {
    same(reference(pin.owner, value), pin, 'batting owner reference'); same(value.lineage, root.lineage, 'batting lineage');
    same(value.physicalPitchSourceId, pins.launchReference.sourceId, 'batting pitch identity');
  }
  same(intent.source.postureReference, pins.postureReference, 'intent posture'); same(intent.originalIntent.actorSourceId, actor.source.sourceId, 'intent actor');
  same(input.source.viewReference, pins.cut9ViewReference, 'input view'); same(input.source.postureReference, pins.postureReference, 'input posture');
  same(input.source.intentReference, pins.intentReference, 'input intent'); same(input.source.emotionReference, pins.emotionReference, 'input emotion');
  same(input.source.assessmentReferences, [pins.scoreReference], 'input assessment'); same(input.source.directive, 'SWING', 'input directive');
  same(input.source.physicalPitchReference, pins.launchReference, 'input source pitch'); same(input.physicalPitchReference, pins.launchReference, 'input pitch');
  same(input.source.physicalOperationReference, pins.decisionCutReference, 'input decision cut');
  same(commitment.inputSource, input.source, 'adopted input'); same(commitment.originalIntent, intent.originalIntent, 'adopted intent');
  same(input.source.expectedWorld, { careerId: actor.binding.careerId, worldRevision: commitment.beforeWorldRevision,
    controlRevision: commitment.controlRevision, controlHash: commitment.controlHash }, 'input World');
  same(commitment.commitment.action, 'SWING', 'effective action'); same(commitment.timeline, second.result.resolution.timeline, 'precontact timeline');
  same(resolution.resolution.kind, 'recorded_swing', 'resolution kind'); assert(resolution.contact, 'LAN01 retained throw BatBallContact missing');
  same(resolution.timeline.events.slice(0, commitment.timeline.events.length), commitment.timeline.events, 'prior TAKE events');
  const added = resolution.timeline.events.slice(commitment.timeline.events.length);
  assert(added.length === 1 && added[0].kind === 'BatBallContact', 'LAN01 retained throw contact event missing or extra');
  same(added[0].payload.contact, resolution.contact, 'contact event'); same(resolution.timeline.status.kind, 'batted_ball_pending', 'contact status');
  same(root.timeline, resolution.timeline, 'root timeline'); same(root.evaluationTick, resolution.contact.tick, 'root contact tick');
  same(root.source.throughTick, resolution.contact.tick, 'root horizon'); same(root.stage, 'field', 'root stage');
  same(fieldBasis.view.cut.stage, 'field_active', 'cut12 stage'); same(fieldBasis.view.cut.pitchOrdinal, 3, 'cut12 pitch ordinal');
  same(fieldBasis.view.cut.physicalPitchReference, pins.launchReference, 'cut12 pitch');
  same(fieldBasis.view.cut.operationReference, pins.fieldRootReference, 'cut12 operation');
  same(fieldBasis.view.cut.physicalOperationReference, pins.fieldRootReference, 'cut12 physical operation');
  same(fieldBasis.view.cut.timeline, root.timeline, 'cut12 timeline'); same(fieldBasis.view.cut.evaluationTick, root.evaluationTick, 'cut12 tick');
  same(fieldBasis.view.cut.outcomeReference, null, 'cut12 outcome'); same(fieldBasis.view.cut.resetReference, null, 'cut12 reset');

  const stepProof = readSamePaPhysicalOperationFromSqlite(db, pins.fieldStepReference);
  const securedProof = readSamePaPhysicalOperationFromSqlite(db, pins.securedReference);
  const indicatedProof = readSamePaPhysicalOperationFromSqlite(db, pins.indicatedReference);
  const plannedProof = readSamePaPhysicalOperationFromSqlite(db, pins.plannedReference);
  assert(stepProof?.record.kind === 'same_pa_physical_field_step_v1', 'LAN01 retained throw field-step missing');
  assert(securedProof?.record.kind === 'same_pa_physical_field_step_v1', 'LAN01 retained throw secured capture missing');
  assert(indicatedProof?.record.kind === 'same_pa_physical_field_step_v1', 'LAN01 retained throw indication missing');
  assert(plannedProof?.record.kind === 'same_pa_physical_field_step_v1', 'LAN01 retained throw plan missing');
  const step = stepProof.record, secured = securedProof.record, indicated = indicatedProof.record, planned = plannedProof.record;
  for (const [value, proof, pin, previous, view, ordinal] of [
    [step, stepProof, pins.fieldStepReference, pins.fieldRootReference, pins.cut12ViewReference, 7],
    [secured, securedProof, pins.securedReference, pins.fieldStepReference, pins.cut13ViewReference, 8],
    [indicated, indicatedProof, pins.indicatedReference, pins.securedReference, pins.cut15ViewReference, 9],
    [planned, plannedProof, pins.plannedReference, pins.indicatedReference, pins.cut16ViewReference, 10],
  ] as const) {
    same(reference('pa_physical_v1_field_steps', value), pin, 'field owner reference'); same(proof.reference, pin, 'physical proof reference');
    same(proof.actor, actor, 'field actor'); same(value.lineage, root.lineage, 'field lineage');
    same(proof.physicalPitchReference, pins.launchReference, 'field pitch reference');
    same(value.source.launchReference, pins.launchReference, 'field launch'); same(value.physicalPitchSourceId, pins.launchReference.sourceId, 'field pitch identity');
    same(value.source.previousOperationReference, previous, 'field predecessor'); same(value.source.previousFieldReference, previous, 'previous field');
    same(value.source.fieldRootReference, pins.fieldRootReference, 'field root'); same(value.source.viewReference, view, 'field view');
    same(value.viewReference, view, 'field adopted view'); same(value.operationOrdinal, ordinal, 'field operation ordinal');
    same(value.pitchOrdinal, 3, 'field pitch ordinal'); same(value.stage, 'field', 'physical stage'); same(value.timeline, root.timeline, 'field timeline');
    same(proof.bodyCut, current.view.cut.bodyCut, 'original body cut'); same(proof.physicalWorld, current.view.cut.physicalWorld, 'original physical World');
  }
  same(step.source.action, undefined, 'initial field action');
  assert(secured.source.action?.kind === 'capture_checkpoint_v1' && secured.actionResult?.kind === 'capture_checkpoint_v1', 'LAN01 retained throw capture action missing');
  same(secured.source.action.candidateReference, pins.fieldStepReference, 'capture candidate');
  same(secured.actionResult.candidateReference, pins.fieldStepReference, 'capture result candidate');
  same(secured.actionResult.progress.kind, 'secured', 'capture result');
  for (const value of [secured, indicated, planned]) {
    same(value.evaluationTick, 103_218_722, 'carried tick'); same(value.field.motion.carrierPlayerId, 'p2', 'retained carrier');
    same(value.field.motion.response.kind, 'carried', 'retained response');
  }
  same(indicated.field, secured.field, 'indication field'); same(planned.field, indicated.field, 'planned field');
  same(indicated.source.throughTick, secured.evaluationTick, 'indication horizon'); same(planned.source.throughTick, indicated.evaluationTick, 'plan horizon');
  const indicatedBasis = readHistoricalSamePaLifecycleViewFromSqlite(db, pins.cut15ViewReference);
  same(indicatedBasis.actor, actor, 'indication actor'); same(indicatedBasis.view.lineage, root.lineage, 'indication lineage');
  same(reference('pa_lifecycle_v1_execution_views', indicatedBasis.view), pins.cut15ViewReference, 'indication owner view');
  const thrower = current.basis.members.find(m => m.playerId === 'p2')!;
  same(indicated.source.action, { kind: 'appeal_indication_v1', member: indicatedBasis.members.find(m => m.playerId === 'p2'),
    defenderId: 'home-1', runnerId: 'away-1', base: 'first', contact: 'base' }, 'original indication');
  assert(indicated.actionResult?.kind === 'appeal_indication_v1', 'LAN01 retained throw indication result missing');
  const moment = indicated.field.motion.world.moment;
  same(indicated.actionResult, { kind: 'appeal_indication_v1', throwerId: 'p2', defenderId: 'home-1', runnerId: 'away-1',
    base: 'first', contact: 'base', indicatedAt: { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick } }, 'indication result');
  const throwCalibration = readSamePaLifecycleCalibrationFromSqlite(db, pins.throwCalibrationReference);
  assert(throwCalibration?.kind === 'same_pa_lifecycle_calibration' && throwCalibration.source.route === 'defender_throw', 'LAN01 retained throw calibration missing');
  same(reference('pa_lifecycle_v1_execution_calibrations', throwCalibration), pins.throwCalibrationReference, 'throw calibration owner reference');
  same(throwCalibration.lineage, root.lineage, 'throw calibration lineage'); same(throwCalibration.source.viewReference, pins.cut16ViewReference, 'throw calibration view');
  same(throwCalibration.source.member, thrower, 'throw calibration member');
  same(planned.source.action, { kind: 'throw_plan_v1', member: thrower, calibrationReference: pins.throwCalibrationReference,
    receiverPlayerId: 'home-1', coverageThroughTick: Math.min(...indicated.field.motion.actors.map(a => a.primitive.endTick)),
    appealIndicationReference: pins.indicatedReference }, 'original throw plan');
  assert(planned.actionResult?.kind === 'throw_plan_v1', 'LAN01 retained throw plan result missing');
  same(planned.actionResult.appealIndicationReference, pins.indicatedReference, 'planned indication');
  const caught = readSamePaCatchWorkFromSqlite(db, pins.caughtReference);
  assert(caught?.kind === 'same_pa_catch_work_v1', 'LAN01 retained throw original caught work missing');
  same(reference('pa_catch_v1_work', caught), pins.caughtReference, 'caught owner reference');
  same(caught.lineage, root.lineage, 'caught lineage'); same(caught.source.viewReference, pins.cut14ViewReference, 'caught view');
  same(caught.source.enrollmentReference, root.lineage.enrollmentReference, 'caught enrollment'); same(caught.source.priorWorkReference, null, 'original caught predecessor');
  same(caught.physicalPitchReference, pins.launchReference, 'caught pitch'); same(caught.physicalOperationReference, pins.securedReference, 'caught physical operation');
  same(caught.evaluationTick, secured.evaluationTick, 'caught tick');
  const originals = caught.originalInputs;
  assert(originals.action && originals.assignment && originals.person && originals.model, 'LAN01 retained throw original caught dependencies missing');
  for (const [value, id] of [[originals.source, 'lan01:caught:communication:original'], [originals.action, 'lan01:caught:action'],
    [originals.assignment, 'lan01:caught:assignment'], [originals.person, 'lan01:caught:person'], [originals.model, 'lan01:caught:reception-model']] as const)
    same(value.sourceId, id, 'caught original identity');
  same(originals.source.viewReference, pins.cut14ViewReference, 'caught communication view');
  same(originals.action.viewReference, pins.cut14ViewReference, 'caught action view'); same(originals.action.judgment, 'caught', 'original caught judgment');

  same(current.view.cut.stage, 'field_active', 'cut16 stage'); same(current.view.cut.pitchOrdinal, 3, 'cut16 pitch ordinal');
  same(current.view.cut.physicalPitchReference, pins.launchReference, 'cut16 pitch');
  same(current.view.cut.operationReference, pins.indicatedReference, 'cut16 admitted operation');
  same(current.view.cut.physicalOperationReference, pins.indicatedReference, 'cut16 physical operation');
  same(current.view.cut.timeline, indicated.timeline, 'cut16 timeline'); same(current.view.cut.evaluationTick, indicated.evaluationTick, 'cut16 tick');
  same(current.view.cut.outcomeReference, null, 'cut16 outcome'); same(current.view.cut.resetReference, null, 'cut16 reset');
  // The physical owner authenticates its committed head and exact coverage
  // excludes every later operation: :3 is the actual head, still outside cut16.
  assertSamePaLifecycleReservedStateFromSqlite(db, historical);
  assertSamePaLifecycleWorkCoverage(db, root.lineage.enrollmentReference, anchorViewReference, [...events, pins.plannedReference]);
  const world = readEmotionWorldRevisionFromSqlite(db, actor.binding.careerId);
  assert(world, 'LAN01 retained throw current World missing');
  same(world.head.worldRevision, commitment.afterWorldRevision, 'current World revision');
  same(world.head.control.revision, commitment.controlRevision, 'current World control revision');
  same(hash(world.head.control), commitment.controlHash, 'current World control hash');
  return { field: { root, rootReference: pins.fieldRootReference, step, stepReference: pins.fieldStepReference,
    resolution, resolutionReference: pins.resolutionReference },
    secured: { value: secured, operationReference: pins.securedReference }, indicated: { value: indicated, operationReference: pins.indicatedReference },
    planned: { value: planned, operationReference: pins.plannedReference }, throwCalibration,
    caught: { work: caught, workReference: pins.caughtReference } };
};
