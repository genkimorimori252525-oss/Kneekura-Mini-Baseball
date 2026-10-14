import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaSuccessorTakePitch } from './SamePlateAppearanceTakeSuccessor';
import type { SamePaLifecycleView, SamePaLifecycleViewBasis, SamePaLifecycleWorkReference } from './SamePlateAppearanceLifecycle';
import { readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite,
  assertSamePaLifecycleReservedStateFromSqlite, assertSamePaLifecycleWorkCoverage } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readSamePaBattingExecutionInputFromSqlite, readSamePaBattingIntentFromSqlite } from './SqliteBattingExecutionInputStore';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { readEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';

export type LAN01RetainedFieldBoundaryPins = Readonly<{
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
}>;
type Context = Readonly<{
  db: DatabaseSync; actor: DurablePhysicalPlateAppearanceActor; second: SamePaSuccessorTakePitch;
  anchorViewReference: SamePaReference<'pa_continuation_v1_execution_views'>;
  current: Readonly<{ view: SamePaLifecycleView; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>; basis: SamePaLifecycleViewBasis }>;
  eventReferences: readonly SamePaLifecycleWorkReference[];
}>;

/** Exact LAN01-R7 cp14 only. The entry owns the existing query-only lifecycle
 * read phase, the eleven TOTAL proofs, and absence of cut12 calibration,
 * field-step and cut13 rows. Historical owners reconstruct accepted ancestry
 * and effects; the separate current fences below grant no append authority. */
export const readLAN01RetainedFieldBoundary = (context: Context, pins: LAN01RetainedFieldBoundaryPins) => {
  const { db, actor, second, anchorViewReference, current } = context;
  const same = (actual: unknown, expected: unknown, what: string) => assert.deepEqual(actual, expected, 'LAN01 retained field ' + what + ' differs');
  const identities: readonly (readonly [SamePaReference, string])[] = [
    [pins.postureReference, 'lan01:swing:posture'], [pins.intentReference, 'lan01:swing:intent'], [pins.inputReference, 'lan01:swing:input'],
    [pins.launchReference, 'lan01:swing:launch'], [pins.captureCutReference, 'lan01:swing:capture-cut'], [pins.observationReference, 'lan01:swing:capture'],
    [pins.deliveryCutReference, 'lan01:swing:delivery-cut'], [pins.deliveryReference, 'lan01:swing:delivery'], [pins.predictionReference, 'lan01:swing:forecast'],
    [pins.scoreReference, 'lan01:swing:score'], [pins.emotionReference, 'lan01:swing:emotion'], [pins.decisionCutReference, 'lan01:swing:decision-cut'],
    [pins.decisionPrefixReference, 'lan01:occupied:cut9:prefix'], [pins.cut9ViewReference, 'lan01:occupied:cut9:view'],
    [pins.commitmentReference, 'lan01:swing:commitment'], [pins.resolutionReference, 'lan01:swing:resolution'],
    [pins.fieldRootReference, 'lan01:field:field-root'], [pins.fieldCalibrationReference, 'lan01:field:calibration'],
    [pins.cut12PrefixReference, 'lan01:occupied:cut12:prefix'], [pins.cut12ViewReference, 'lan01:occupied:cut12:view'],
  ];
  for (const [pin, id] of identities) same(pin.sourceId, id, 'source identity');
  same(second.source.sourceId, 'lan01:occupied:second-pitch', 'second-pitch identity');
  same(anchorViewReference.sourceId, 'lan01:occupied:anchor:view', 'anchor identity');
  const oldEvents: readonly SamePaLifecycleWorkReference[] = [reference('pa_take_successor_v1_pitch_actions', second),
    pins.launchReference, pins.captureCutReference, pins.observationReference, pins.deliveryCutReference,
    pins.deliveryReference, pins.predictionReference, pins.emotionReference, pins.decisionCutReference];
  const events = [...oldEvents, pins.commitmentReference, pins.resolutionReference, pins.fieldRootReference];
  same(context.eventReferences, events, 'event references');
  same(current.viewReference, pins.cut12ViewReference, 'current view reference');
  const historical = readHistoricalSamePaLifecycleViewFromSqlite(db, pins.cut12ViewReference);
  same(historical, current.basis, 'cut12 basis'); same(historical.actor, actor, 'actor'); same(historical.view, current.view, 'cut12 view');
  same(reference('pa_lifecycle_v1_execution_views', current.view), pins.cut12ViewReference, 'cut12 owner reference');
  same(current.view.source.prefixReference, pins.cut12PrefixReference, 'cut12 prefix reference');
  const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', pins.cut12PrefixReference.sourceId);
  const decisionPrefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', pins.decisionPrefixReference.sourceId);
  assert(prefix?.kind === 'same_pa_lifecycle_prefix' && decisionPrefix?.kind === 'same_pa_lifecycle_prefix', 'LAN01 retained field prefix missing');
  for (const [value, pin, expectedEvents] of [[prefix, pins.cut12PrefixReference, events], [decisionPrefix, pins.decisionPrefixReference, oldEvents]] as const) {
    same(reference('pa_lifecycle_v1_work_prefixes', value), pin, 'prefix owner reference');
    same(value.source.enrollmentReference, current.view.lineage.enrollmentReference, 'prefix enrollment');
    same(value.source.anchorViewReference, anchorViewReference, 'prefix anchor'); same(value.source.eventReferences, expectedEvents, 'prefix event references');
  }

  // These historical readers prove their original physical head chain and each
  // owner's stored effects. An in-flight current reader cannot admit a field root.
  const rootProof = readSamePaPhysicalOperationFromSqlite(db, pins.fieldRootReference);
  const commitmentProof = readSamePaPhysicalOperationFromSqlite(db, pins.commitmentReference);
  const resolutionProof = readSamePaPhysicalOperationFromSqlite(db, pins.resolutionReference);
  assert(rootProof?.record.kind === 'same_pa_physical_field_root_v1', 'LAN01 retained field root missing');
  assert(commitmentProof?.record.kind === 'same_pa_physical_commitment_v1', 'LAN01 retained field commitment missing');
  assert(resolutionProof?.record.kind === 'same_pa_physical_resolution_v1', 'LAN01 retained field resolution missing');
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
  assert(posture?.kind === 'batting_invocation_posture' && posture.source.capability === 'owned_in_flight_batting_posture_v1', 'LAN01 retained field posture missing');
  assert(intent?.kind === 'same_pa_batting_intent' && intent.source.capability === 'owned_in_flight_same_pa_batting_intent_v1', 'LAN01 retained field intent missing');
  assert(input?.kind === 'same_pa_batting_input' && input.source.capability === 'owned_in_flight_same_pa_batting_execution_input_v1', 'LAN01 retained field input missing');
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
  same(resolution.resolution.kind, 'recorded_swing', 'resolution kind'); assert(resolution.contact, 'LAN01 retained field BatBallContact missing');
  same(resolution.timeline.events.slice(0, commitment.timeline.events.length), commitment.timeline.events, 'prior TAKE events');
  const added = resolution.timeline.events.slice(commitment.timeline.events.length);
  assert(added.length === 1 && added[0].kind === 'BatBallContact', 'LAN01 retained field contact event missing or extra');
  same(added[0].payload.contact, resolution.contact, 'contact event'); same(resolution.timeline.status.kind, 'batted_ball_pending', 'contact status');
  same(root.timeline, resolution.timeline, 'root timeline'); same(root.evaluationTick, resolution.contact.tick, 'root contact tick');
  same(root.source.throughTick, resolution.contact.tick, 'root horizon'); same(root.stage, 'field', 'root stage');
  same(current.view.cut.stage, 'field_active', 'cut12 stage'); same(current.view.cut.pitchOrdinal, 3, 'cut12 pitch ordinal');
  same(current.view.cut.physicalPitchReference, pins.launchReference, 'cut12 pitch');
  same(current.view.cut.operationReference, pins.fieldRootReference, 'cut12 operation');
  same(current.view.cut.physicalOperationReference, pins.fieldRootReference, 'cut12 physical operation');
  same(current.view.cut.timeline, root.timeline, 'cut12 timeline'); same(current.view.cut.evaluationTick, root.evaluationTick, 'cut12 tick');
  same(current.view.cut.outcomeReference, null, 'cut12 outcome'); same(current.view.cut.resetReference, null, 'cut12 reset');

  // Historical authentication does not prove the live AFTER state. Exact
  // coverage plus the normal committed head proof excludes a later physical
  // operation without manufacturing a head or appending an event.
  assertSamePaLifecycleReservedStateFromSqlite(db, historical);
  assertSamePaLifecycleWorkCoverage(db, root.lineage.enrollmentReference, anchorViewReference, events);
  const world = readEmotionWorldRevisionFromSqlite(db, actor.binding.careerId);
  assert(world, 'LAN01 retained field current World missing');
  same(world.head.worldRevision, commitment.afterWorldRevision, 'current World revision');
  same(world.head.control.revision, commitment.controlRevision, 'current World control revision');
  same(hash(world.head.control), commitment.controlHash, 'current World control hash');
  return { posture, input, intent, commitment, resolution, root };
};
