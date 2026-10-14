import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
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
import type { SamePaPhysicalCommitment } from './SamePlateAppearancePhysicalEpisode';

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
export type LAN01RetainedReceivedBoundaryPins = LAN01RetainedThrowBoundaryPins & Readonly<{
  transferReference: SamePaReference<'pa_physical_v1_field_steps'>;
  releasedReference: SamePaReference<'pa_physical_v1_field_steps'>;
  receptionReference: SamePaReference<'pa_physical_v1_field_steps'>;
  receivedReference: SamePaReference<'pa_physical_v1_field_steps'>;
  cut17ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  cut18ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  cut19ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  cut20ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  cut21ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  cut21PrefixReference: SamePaReference<'pa_lifecycle_v1_work_prefixes'>;
}>;
type Context = Readonly<{
  db: DatabaseSync; actor: DurablePhysicalPlateAppearanceActor; second: SamePaSuccessorTakePitch;
  anchorViewReference: SamePaReference<'pa_continuation_v1_execution_views'>;
  current: Readonly<{ view: SamePaLifecycleView; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>; basis: SamePaLifecycleViewBasis }>;
  eventReferences: readonly SamePaLifecycleWorkReference[];
}>;

const same = (actual: unknown, expected: unknown, what: string) => assert.deepEqual(actual, expected, 'LAN01 retained throw ' + what + ' differs');
const assertOriginalMembers = (basis: SamePaLifecycleViewBasis) => {
  const playerIds = ['away-2', 'p2', ...Array.from({ length: 8 }, (_, i) => 'home-' + (i + 1)), 'away-1'];
  for (const values of [basis.members, basis.view.participants, basis.view.lineage.participantReferences,
    basis.view.source.participantTotalReferences]) same(values.map(v => v.playerId).sort(), [...playerIds].sort(), 'eleven original members');
  for (const member of basis.members) {
    const participant = basis.view.lineage.participantReferences.find(p => p.playerId === member.playerId)!;
    const projected = basis.view.participants.find(p => p.playerId === member.playerId)!;
    same(member, { playerId: participant.playerId, bindingHash: participant.bindingHash, personHash: participant.personHash,
      baselineSourceId: participant.baselineSourceId, reservedRevision: participant.revision, reservedStateHash: participant.stateHash,
      projectedStateHash: projected.projectedStateHash }, 'original member baseline');
  }
};

/** Immutable cut16 and its original plan history. This never applies current
 * reserved-state or coverage fences to a historical lifecycle cut. */
const readLAN01RetainedThrowHistory = (context: Context, pins: LAN01RetainedThrowBoundaryPins, historical: SamePaLifecycleViewBasis) => {
  const { db, actor, second, anchorViewReference, current } = context;
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
  assertOriginalMembers(current.basis);

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
  return { events, commitment, boundary: { field: { root, rootReference: pins.fieldRootReference, step, stepReference: pins.fieldStepReference,
    resolution, resolutionReference: pins.resolutionReference },
    secured: { value: secured, operationReference: pins.securedReference }, indicated: { value: indicated, operationReference: pins.indicatedReference },
    planned: { value: planned, operationReference: pins.plannedReference }, throwCalibration,
    caught: { work: caught, workReference: pins.caughtReference } } };
};

const assertCurrentFences = (context: Context, commitment: SamePaPhysicalCommitment, events: readonly SamePaLifecycleWorkReference[]) => {
  const { db, actor, current, anchorViewReference } = context;
  assertSamePaLifecycleReservedStateFromSqlite(db, current.basis);
  assertSamePaLifecycleWorkCoverage(db, commitment.lineage.enrollmentReference, anchorViewReference, events);
  const world = readEmotionWorldRevisionFromSqlite(db, actor.binding.careerId);
  assert(world, 'LAN01 retained throw current World missing');
  same(world.head.worldRevision, commitment.afterWorldRevision, 'current World revision');
  same(world.head.control.revision, commitment.controlRevision, 'current World control revision');
  same(hash(world.head.control), commitment.controlHash, 'current World control hash');
};

/** Exact LAN01-R9 cp39 only. The caller owns the existing query-only proof
 * scope, all cut16 TOTAL/calibration rows and absence of cut17 or later work. */
export const readLAN01RetainedThrowBoundary = (context: Context, pins: LAN01RetainedThrowBoundaryPins) => {
  const historical = readHistoricalSamePaLifecycleViewFromSqlite(context.db, pins.cut16ViewReference);
  const proof = readLAN01RetainedThrowHistory(context, pins, historical);
  // The physical owner authenticates its committed head; exact coverage excludes
  // every later operation, while :3 remains outside cut16's admitted prefix.
  assertCurrentFences(context, proof.commitment, [...proof.events, pins.plannedReference]);
  return proof.boundary;
};

/** Exact LAN01-R11 cp24 only: original receiver capture :7 and complete cut21.
 * The caller owns the same query-only proof scope, TOTAL/calibration set and
 * explicit absence of future appeal :8. No prefix is extended by this reader. */
const readLAN01RetainedReceivedHistory = (context: Context, pins: LAN01RetainedReceivedBoundaryPins) => {
  const { db, actor, current, anchorViewReference } = context;
  const cut16 = readHistoricalSamePaLifecycleViewFromSqlite(db, pins.cut16ViewReference);
  const history = readLAN01RetainedThrowHistory({ ...context,
    current: { view: cut16.view, viewReference: pins.cut16ViewReference, basis: cut16 },
    eventReferences: context.eventReferences.slice(0, 16) }, pins, cut16);
  const { field, indicated, planned, caught } = history.boundary, { root } = field;
  const events = [...history.events, pins.plannedReference, pins.transferReference, pins.releasedReference,
    pins.receptionReference, pins.receivedReference];
  same(context.eventReferences, events, 'twenty-one admitted event references');
  same(current.viewReference, pins.cut21ViewReference, 'cut21 current view reference');
  for (const [pin, id] of [[pins.transferReference, 'lan01:appeal-throw:4'], [pins.releasedReference, 'lan01:appeal-throw:5'],
    [pins.receptionReference, 'lan01:appeal-throw:6'], [pins.receivedReference, 'lan01:appeal-throw:7'],
    [pins.cut17ViewReference, 'lan01:occupied:cut17:view'], [pins.cut18ViewReference, 'lan01:occupied:cut18:view'],
    [pins.cut19ViewReference, 'lan01:occupied:cut19:view'], [pins.cut20ViewReference, 'lan01:occupied:cut20:view'],
    [pins.cut21ViewReference, 'lan01:occupied:cut21:view'], [pins.cut21PrefixReference, 'lan01:occupied:cut21:prefix']] as const)
    same(pin.sourceId, id, 'received boundary identity');

  const transferProof = readSamePaPhysicalOperationFromSqlite(db, pins.transferReference);
  const releasedProof = readSamePaPhysicalOperationFromSqlite(db, pins.releasedReference);
  const receptionProof = readSamePaPhysicalOperationFromSqlite(db, pins.receptionReference);
  const receivedProof = readSamePaPhysicalOperationFromSqlite(db, pins.receivedReference);
  assert(transferProof?.record.kind === 'same_pa_physical_field_step_v1', 'LAN01 retained throw transfer missing');
  assert(releasedProof?.record.kind === 'same_pa_physical_field_step_v1', 'LAN01 retained throw released operation missing');
  assert(receptionProof?.record.kind === 'same_pa_physical_field_step_v1', 'LAN01 retained throw reception missing');
  assert(receivedProof?.record.kind === 'same_pa_physical_field_step_v1', 'LAN01 retained throw received operation missing');
  const transfer = transferProof.record, released = releasedProof.record, reception = receptionProof.record, received = receivedProof.record;
  for (const [value, proof, pin, previous, view, ordinal, tick] of [
    [transfer, transferProof, pins.transferReference, pins.plannedReference, pins.cut17ViewReference, 11, 103_218_827],
    [released, releasedProof, pins.releasedReference, pins.transferReference, pins.cut18ViewReference, 12, 103_218_932],
    [reception, receptionProof, pins.receptionReference, pins.releasedReference, pins.cut19ViewReference, 13, 103_251_165],
    [received, receivedProof, pins.receivedReference, pins.receptionReference, pins.cut20ViewReference, 14, 103_280_489],
  ] as const) {
    same(reference('pa_physical_v1_field_steps', value), pin, 'received field owner reference');
    same(proof.reference, pin, 'received physical proof reference'); same(proof.actor, actor, 'received actor');
    same(value.lineage, root.lineage, 'received lineage'); same(proof.physicalPitchReference, pins.launchReference, 'received pitch reference');
    same(value.source.launchReference, pins.launchReference, 'received launch');
    same(value.physicalPitchSourceId, pins.launchReference.sourceId, 'received pitch identity');
    same(value.source.previousOperationReference, previous, 'received predecessor'); same(value.source.previousFieldReference, previous, 'received previous field');
    same(value.source.fieldRootReference, pins.fieldRootReference, 'received field root'); same(value.source.viewReference, view, 'received source view');
    same(value.viewReference, view, 'received adopted view'); same(value.operationOrdinal, ordinal, 'received operation ordinal');
    same(value.pitchOrdinal, 3, 'received pitch ordinal'); same(value.stage, 'field', 'received physical stage');
    same(value.evaluationTick, tick, 'received original tick'); same(value.field.motion.world.moment.ball.tick, tick, 'received actual moment tick');
    same(value.timeline, root.timeline, 'received timeline'); same(proof.bodyCut, current.view.cut.bodyCut, 'received body cut');
    same(proof.physicalWorld, current.view.cut.physicalWorld, 'received physical World');
  }
  assert(planned.value.actionResult?.kind === 'throw_plan_v1', 'LAN01 retained throw original plan missing');
  const plan = planned.value.actionResult.plan, start = plan.input.cursor.moment, midpoint = (start.elapsedSeconds + plan.releaseElapsedSeconds) / 2;
  same(plan.input.carrierPlayerId, 'p2', 'original thrower'); same(plan.input.receiverPlayerId, 'home-1', 'original receiver');
  same(plan.input.cursor, planned.value.field.motion.cursor, 'original throw cursor');
  same(plan.input.response, root.response, 'original throw response'); same(plan.input.geometry, root.geometry, 'original throw geometry');
  for (const value of [transfer, released, reception, received]) same(value.field.motion.actors, plan.actors, 'original throw actors');
  assert(transfer.actionResult?.kind === 'throw_checkpoint_v1' && released.actionResult?.kind === 'throw_checkpoint_v1', 'LAN01 retained throw checkpoints missing');
  same(transfer.actionResult.progress.kind, 'transfer', 'transfer progress'); same(released.actionResult.progress.kind, 'released', 'released progress');
  for (const [value, elapsed, checkpoints, priorCursor] of [[transfer, midpoint, [midpoint], plan.input.cursor],
    [released, plan.releaseElapsedSeconds, [midpoint, plan.releaseElapsedSeconds], transfer.field.motion.cursor]] as const) {
    assert(value.actionResult?.kind === 'throw_checkpoint_v1', 'LAN01 retained throw checkpoint missing');
    const progress = value.actionResult.progress;
    same(value.source.action, { kind: 'throw_checkpoint_v1', planReference: pins.plannedReference, throughElapsedSeconds: elapsed }, 'original throw checkpoint');
    same(value.source.throughTick, quantizeEventTick(start.originTick, elapsed, root.response.world.parameters.ticksPerSecond), 'throw checkpoint horizon');
    same(value.actionResult.planReference, pins.plannedReference, 'checkpoint plan'); same(progress.field, value.field, 'checkpoint physical field');
    same(JSON.parse(progress.planIdentity), plan, 'checkpoint original plan'); same(progress.transfer, plan.transfer, 'checkpoint transfer timing');
    same(progress.checkpointElapsedSeconds, checkpoints, 'checkpoint history'); same(progress.startCursor, priorCursor, 'checkpoint start cursor');
  }
  same(transfer.field.motion.carrierPlayerId, 'p2', 'transfer carrier'); same(transfer.field.motion.response.kind, 'carried', 'transfer response');
  assert(released.actionResult.progress.kind === 'released', 'LAN01 retained throw released progress differs');
  same(released.actionResult.progress.launch.releaseTick, plan.transfer.throwReadyTick, 'actual release tick');
  same(released.evaluationTick, plan.transfer.throwReadyTick, 'release ready tick');
  same(released.field.motion.carrierPlayerId, null, 'released carrier'); same(released.field.motion.response.kind, 'moving', 'released response');
  same(reception.source.action, undefined, 'reception action'); same(reception.actionResult, undefined, 'reception result');
  same(reception.source.throughTick, released.evaluationTick + 100_000, 'reception search horizon');
  same(reception.field.motion.carrierPlayerId, null, 'candidate carrier'); same(reception.field.motion.cursor, null, 'candidate cursor');
  same(reception.field.motion.response.kind, 'capture_candidate', 'candidate response');
  const candidateWorld = reception.field.motion.world;
  assert(candidateWorld.kind === 'boundary', 'LAN01 retained throw receiver contact missing');
  same(candidateWorld.contacts.length, 1, 'receiver contact count');
  const contact = candidateWorld.contacts[0];
  assert(contact.kind === 'actor', 'LAN01 retained throw receiver contact actor missing');
  same(contact.playerId, 'home-1', 'receiver contact player'); same(contact.role, 'glove', 'receiver contact role');
  same(contact.moment, candidateWorld.moment, 'receiver contact moment');
  assert(received.source.action?.kind === 'capture_checkpoint_v1' && received.actionResult?.kind === 'capture_checkpoint_v1', 'LAN01 retained throw receiver capture missing');
  same(received.actionResult.progress.kind, 'secured', 'received progress');
  assert(received.actionResult.progress.kind === 'secured', 'LAN01 retained throw received progress differs');
  const capture = received.actionResult.progress;
  const capturePlan = JSON.parse(capture.planIdentity);
  same(capturePlan.input, { response: root.response, geometry: root.geometry, field: reception.field }, 'received original capture input');
  same(capturePlan.candidateSecureTick, received.evaluationTick, 'received original secure tick');
  same(capturePlan.fenceElapsedSeconds, received.source.action.throughElapsedSeconds, 'received original capture fence');
  same(received.source.action.candidateReference, pins.receptionReference, 'received candidate');
  same(received.actionResult.candidateReference, pins.receptionReference, 'received result candidate');
  same(received.source.throughTick, received.evaluationTick, 'received horizon');
  same(received.source.throughTick, quantizeEventTick(candidateWorld.moment.originTick, received.source.action.throughElapsedSeconds,
    root.response.world.parameters.ticksPerSecond), 'received exact horizon');
  same(capture.checkpointElapsedSeconds, [received.source.action.throughElapsedSeconds], 'received checkpoint history');
  same(capture.startMoment, candidateWorld.moment, 'received original contact');
  same(capture.acquisition.acquirerPlayerId, 'home-1', 'received acquirer'); same(capture.acquisition.secureTick, received.evaluationTick, 'received secure tick');
  same(capture.acquisition.contactMoment, candidateWorld.moment, 'received acquisition contact');
  same(capture.world, received.field.motion.world, 'received actual World'); same(capture.cursor, received.field.motion.cursor, 'received actual cursor');
  same(received.field.motion.carrierPlayerId, 'home-1', 'received carrier'); same(received.field.motion.response.kind, 'carried', 'received response');

  for (const [pin, value, operation, ordinal] of [[pins.cut17ViewReference, planned.value, pins.plannedReference, 17],
    [pins.cut18ViewReference, transfer, pins.transferReference, 18], [pins.cut19ViewReference, released, pins.releasedReference, 19],
    [pins.cut20ViewReference, reception, pins.receptionReference, 20], [pins.cut21ViewReference, received, pins.receivedReference, 21]] as const) {
    const basis = readHistoricalSamePaLifecycleViewFromSqlite(db, pin), view = basis.view;
    same(reference('pa_lifecycle_v1_execution_views', view), pin, 'received owner view'); same(basis.actor, actor, 'received view actor');
    same(view.lineage, root.lineage, 'received view lineage'); assertOriginalMembers(basis);
    const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', view.source.prefixReference.sourceId);
    assert(prefix?.kind === 'same_pa_lifecycle_prefix', 'LAN01 retained throw received prefix missing');
    same(prefix.source.sourceId, 'lan01:occupied:cut' + ordinal + ':prefix', 'received prefix identity');
    same(reference('pa_lifecycle_v1_work_prefixes', prefix), view.source.prefixReference, 'received prefix owner reference');
    same(prefix.source.enrollmentReference, root.lineage.enrollmentReference, 'received prefix enrollment');
    same(prefix.source.anchorViewReference, anchorViewReference, 'received prefix anchor');
    same(prefix.source.eventReferences, events.slice(0, ordinal), 'received prefix events');
    same(view.cut, { stage: 'field_active', pitchOrdinal: 3, physicalPitchReference: pins.launchReference,
      operationReference: operation, physicalOperationReference: operation, timeline: value.timeline, evaluationTick: value.evaluationTick,
      physicalWorld: current.view.cut.physicalWorld, bodyCut: current.view.cut.bodyCut, outcomeReference: null, resetReference: null }, 'received view cut');
    if (ordinal === 21) {
      same(view.source.prefixReference, pins.cut21PrefixReference, 'cut21 prefix');
      same(basis, current.basis, 'cut21 current basis'); same(view, current.view, 'cut21 current view');
    }
  }
  return { commitment: history.commitment, events, boundary: { field, indicated, planned,
    released: { value: released, operationReference: pins.releasedReference },
    received: { candidate: reception, value: received, operationReference: pins.receivedReference }, caught } };
};

export const readLAN01RetainedReceivedBoundary = (context: Context, pins: LAN01RetainedReceivedBoundaryPins) => {
  const proof = readLAN01RetainedReceivedHistory(context, pins);
  // Current coverage21 still excludes every later operation at the old boundary.
  assertCurrentFences(context, proof.commitment, proof.events);
  return proof.boundary;
};


export type LAN01RetainedSealedBoundaryPins = LAN01RetainedReceivedBoundaryPins & Readonly<{
  appealedReference: SamePaReference<'pa_physical_v1_field_steps'>;
  sealedReference: SamePaReference<'pa_physical_v1_field_steps'>;
  sealedCatchReference: SamePaReference<'pa_catch_v1_work'>;
  cut22ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  cut23ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  cut24ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  cut24PrefixReference: SamePaReference<'pa_lifecycle_v1_work_prefixes'>;
}>;

/** Exact R12 cp16 physical boundary: appeal, seal and sealed CatchWork are
 * already committed and admitted through cut24. Historical cut21 is never
 * mistaken for current state. This reader performs no acceptance or advance. */
export const readLAN01RetainedSealedBoundary = (context: Context, pins: LAN01RetainedSealedBoundaryPins) => {
  const { db, actor, current, anchorViewReference } = context;
  const cut21 = readHistoricalSamePaLifecycleViewFromSqlite(db, pins.cut21ViewReference);
  const history = readLAN01RetainedReceivedHistory({ ...context,
    current: { view: cut21.view, viewReference: pins.cut21ViewReference, basis: cut21 },
    eventReferences: context.eventReferences.slice(0, 21) }, pins);
  const events = [...history.events, pins.appealedReference, pins.sealedReference, pins.sealedCatchReference];
  same(context.eventReferences, events, 'twenty-four admitted event references');
  same(current.viewReference, pins.cut24ViewReference, 'cut24 current view reference');
  for (const [pin, id] of [[pins.appealedReference, 'lan01:appeal-throw:8'], [pins.sealedReference, 'lan01:seal'],
    [pins.sealedCatchReference, 'lan01:caught:work:sealed'], [pins.cut22ViewReference, 'lan01:occupied:cut22:view'],
    [pins.cut23ViewReference, 'lan01:occupied:cut23:view'], [pins.cut24ViewReference, 'lan01:occupied:cut24:view'],
    [pins.cut24PrefixReference, 'lan01:occupied:cut24:prefix']] as const) same(pin.sourceId, id, 'sealed boundary identity');
  const appealProof = readSamePaPhysicalOperationFromSqlite(db, pins.appealedReference);
  const sealProof = readSamePaPhysicalOperationFromSqlite(db, pins.sealedReference);
  assert(appealProof?.record.kind === 'same_pa_physical_field_step_v1', 'LAN01 retained original appeal missing');
  assert(sealProof?.record.kind === 'same_pa_physical_field_step_v1', 'LAN01 retained physical seal missing');
  const appealed = appealProof.record, sealed = sealProof.record, root = history.boundary.field.root;
  for (const [proof, value, pin, previous, view, ordinal] of [
    [appealProof, appealed, pins.appealedReference, pins.receivedReference, pins.cut21ViewReference, 15],
    [sealProof, sealed, pins.sealedReference, pins.appealedReference, pins.cut22ViewReference, 16],
  ] as const) {
    same(reference('pa_physical_v1_field_steps', value), pin, 'sealed physical owner reference');
    same(proof.reference, pin, 'sealed physical proof reference'); same(proof.actor, actor, 'sealed actor');
    same(value.lineage, root.lineage, 'sealed lineage'); same(value.source.launchReference, pins.launchReference, 'sealed launch');
    same(value.source.previousOperationReference, previous, 'sealed predecessor');
    same(value.source.previousFieldReference, previous, 'sealed previous field');
    same(value.source.fieldRootReference, pins.fieldRootReference, 'sealed field root');
    same(value.source.viewReference, view, 'sealed source view'); same(value.viewReference, view, 'sealed adopted view');
    same(value.operationOrdinal, ordinal, 'sealed operation ordinal'); same(value.pitchOrdinal, 3, 'sealed pitch ordinal');
    same(value.stage, 'field', 'sealed physical stage'); same(value.timeline, root.timeline, 'sealed timeline');
    same(proof.bodyCut, current.view.cut.bodyCut, 'sealed body cut'); same(proof.physicalWorld, current.view.cut.physicalWorld, 'sealed physical World');
  }
  same(appealed.source.action, { kind: 'appeal_contact_v1', indicationReference: pins.indicatedReference,
    throwPlanReference: pins.plannedReference }, 'original appeal instruction');
  assert(appealed.actionResult?.kind === 'appeal_contact_v1', 'LAN01 retained appeal result missing');
  same(appealed.actionResult.execution.kind, 'executed', 'original appeal executed');
  same(appealed.field.motion.carrierPlayerId, 'home-1', 'original appeal carrier');
  same(sealed.source.action, { kind: 'retained_quantizer_checkpoint_v1' }, 'original physical seal instruction');
  assert(sealed.actionResult?.kind === 'retained_quantizer_checkpoint_v1', 'LAN01 retained seal result missing');
  same(sealed.actionResult.status, 'checkpoint_reached', 'original physical seal status');
  same(sealed.source.throughTick, appealed.evaluationTick, 'original seal horizon');
  const sealedCatch = readSamePaCatchWorkFromSqlite(db, pins.sealedCatchReference);
  assert(sealedCatch?.kind === 'same_pa_catch_work_v1', 'LAN01 retained sealed CatchWork missing');
  same(reference('pa_catch_v1_work', sealedCatch), pins.sealedCatchReference, 'sealed CatchWork reference');
  same(sealedCatch.source.viewReference, pins.cut23ViewReference, 'sealed CatchWork view');
  same(sealedCatch.source.priorWorkReference, pins.caughtReference, 'sealed CatchWork predecessor');
  same(sealedCatch.source.enrollmentReference, root.lineage.enrollmentReference, 'sealed CatchWork enrollment');
  same(sealedCatch.physicalOperationReference, pins.sealedReference, 'sealed CatchWork physical end');
  same(sealedCatch.physicalPitchReference, pins.launchReference, 'sealed CatchWork pitch');
  same(sealedCatch.lineage, root.lineage, 'sealed CatchWork lineage');
  same(sealedCatch.evaluationTick, sealed.evaluationTick, 'sealed CatchWork tick');
  for (const [pin, operation, physical, value, ordinal] of [
    [pins.cut22ViewReference, pins.appealedReference, pins.appealedReference, appealed, 22],
    [pins.cut23ViewReference, pins.sealedReference, pins.sealedReference, sealed, 23],
    [pins.cut24ViewReference, pins.sealedCatchReference, pins.sealedReference, sealed, 24],
  ] as const) {
    const basis = readHistoricalSamePaLifecycleViewFromSqlite(db, pin), view = basis.view;
    same(reference('pa_lifecycle_v1_execution_views', view), pin, 'sealed owner view');
    same(basis.actor, actor, 'sealed view actor'); same(view.lineage, root.lineage, 'sealed view lineage'); assertOriginalMembers(basis);
    const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', view.source.prefixReference.sourceId);
    assert(prefix?.kind === 'same_pa_lifecycle_prefix', 'LAN01 retained sealed prefix missing');
    same(prefix.source.sourceId, 'lan01:occupied:cut' + ordinal + ':prefix', 'sealed prefix identity');
    same(reference('pa_lifecycle_v1_work_prefixes', prefix), view.source.prefixReference, 'sealed prefix owner reference');
    same(prefix.source.enrollmentReference, root.lineage.enrollmentReference, 'sealed prefix enrollment');
    same(prefix.source.anchorViewReference, anchorViewReference, 'sealed prefix anchor');
    same(prefix.source.eventReferences, events.slice(0, ordinal), 'sealed prefix events');
    same(view.cut, { stage: 'field_active', pitchOrdinal: 3, physicalPitchReference: pins.launchReference,
      operationReference: operation, physicalOperationReference: physical, timeline: value.timeline, evaluationTick: value.evaluationTick,
      physicalWorld: current.view.cut.physicalWorld, bodyCut: current.view.cut.bodyCut, outcomeReference: null, resetReference: null }, 'sealed view cut');
    if (ordinal === 24) {
      same(view.source.prefixReference, pins.cut24PrefixReference, 'cut24 prefix');
      same(basis, current.basis, 'cut24 current basis'); same(view, current.view, 'cut24 current view');
    }
  }
  assertCurrentFences(context, history.commitment, events);
  return { ...history.boundary, appealed: { value: appealed, operationReference: pins.appealedReference },
    sealed: { value: sealed, operationReference: pins.sealedReference },
    sealedCaught: { work: sealedCatch, workReference: pins.sealedCatchReference } };
};
