import type { DatabaseSync } from 'node:sqlite';
import { readBattingRequest } from '../../core/world/psychology/batting/BattingValidation';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { originalBattingIntentInput } from './OriginalBattingIntent';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite,
  readCurrentSamePaLifecycleCalibrationFromSqlite, readSamePaLifecycleCalibrationFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { readCurrentSamePaInFlightCutFromSqlite, readHistoricalSamePaInFlightCutFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { readCurrentBattingEmotionExecutionFromSqlite, readBattingEmotionExecutionFromSqlite } from './SqliteBattingEmotionExecutionStore';
import { readEmotionWorldRevisionFromSqlite, readHistoricalEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { readCurrentInFlightSamePaBattingKnowledgeFromSqlite } from './SamePlateAppearanceBattingKnowledgeFromSqlite';
import { assertSamePaOriginalMember } from './SamePlateAppearanceInvocationView';
import type { AcceptedInFlightSamePaBattingIntent, AcceptedInFlightSamePaBattingExecutionInput, DurableSamePaBattingIntent, DurableSamePaBattingExecutionInput } from './NativeBattingExecutionInput';
type Pending = Readonly<{ kind: 'pending'; reason: string; missingSourceIds: readonly string[] }>;
const pending = (reason: string, ids: readonly string[] = []): Pending => freeze({ kind: 'pending', reason, missingSourceIds: ids });
const fail = (detail: string): never => { throw new Error('in-flight batting input ' + detail); };
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) fail('original dependency or cut differs'); };
export const deriveInFlightSamePaBattingIntent = (db: DatabaseSync, source: AcceptedInFlightSamePaBattingIntent, current: boolean): DurableSamePaBattingIntent => {
  const b = (current ? readCurrentSamePaLifecycleViewFromSqlite : readHistoricalSamePaLifecycleViewFromSqlite)(db, source.viewReference);
  const posture = readBattingPerceptionFromSqlite(db, 'posture', source.postureReference);
  if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') return fail('per-pitch posture owner differs');
  same(posture.source.viewReference, source.viewReference); same(posture.source.member, source.member); same(posture.lineage, b.view.lineage); same(posture.lineage.actorReference, source.actorReference);
  same(source.member, b.members.find(m => m.playerId === b.actor.binding.playerId));
  if (!['retained_take', 'foul_reset_ready'].includes(b.view.cut.stage)) return fail('original intent must precede its pitch launch');
  return freeze({ kind: 'same_pa_batting_intent', source, lineage: posture.lineage, physicalPitchSourceId: posture.physicalPitchSourceId,
    originalIntent: originalBattingIntentInput({ version: 'original_batting_intent_v1', actorSourceId: source.actorReference.sourceId, attempt: source.attempt }) });
};

/** Prepare authenticated data only. Effective calculation and physical adoption
 * happen together in the physical commitment owner's transaction. */
export const deriveInFlightSamePaBattingInput = (db: DatabaseSync, source: AcceptedInFlightSamePaBattingExecutionInput, current: boolean,
  readIntent: (ref: AcceptedInFlightSamePaBattingExecutionInput['intentReference']) => DurableSamePaBattingIntent | null): DurableSamePaBattingExecutionInput | Pending => {
  const b = (current ? readCurrentSamePaLifecycleViewFromSqlite : readHistoricalSamePaLifecycleViewFromSqlite)(db, source.viewReference);
  if (b.view.cut.stage !== 'in_flight') return pending('owned_in_flight_view_required');
  const member = b.members.find(m => m.playerId === source.member.playerId);
  if (!member || b.actor.binding.playerId !== member.playerId) return fail('original batter missing'); same(member, source.member);
  same(source.physicalPitchReference, b.view.cut.physicalPitchReference); same(source.physicalOperationReference, b.view.cut.physicalOperationReference);
  const cut = (current ? readCurrentSamePaInFlightCutFromSqlite : readHistoricalSamePaInFlightCutFromSqlite)(db, source.physicalOperationReference);
  if (cut.stage !== 'in_flight') return pending('uncommitted_physical_cut_required');
  same(cut.physicalPitchReference, source.physicalPitchReference); same(cut.evaluationTick, b.view.cut.evaluationTick); same(cut.lineage, b.view.lineage);
  if (cut.action.source.battingMode !== 'observer_decision') return fail('declared TAKE uses the physical action directly');
  const posture = readBattingPerceptionFromSqlite(db, 'posture', source.postureReference);
  if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') return fail('per-pitch posture owner differs');
  assertSamePaOriginalMember(posture.source.member, source.member); same(posture.lineage, b.view.lineage);
  same(posture.source.actionReference, reference('pa_physical_v1_action_plans', cut.action)); same(posture.source.modelReference, cut.batterModelReference);
  if (posture.physicalPitchSourceId !== cut.physicalPitchReference.sourceId || cut.evaluationTick > posture.source.geometry.validUntilTick) return pending('owned_current_batting_posture_unavailable');
  const intent = readIntent(source.intentReference);
  if (!intent) return pending('original_per_pitch_intent_missing', [source.intentReference.sourceId]);
  if (intent.source.capability !== 'owned_in_flight_same_pa_batting_intent_v1' || intent.physicalPitchSourceId !== cut.physicalPitchReference.sourceId) return fail('intent belongs to another pitch');
  same(intent.source.postureReference, source.postureReference); same(intent.lineage, b.view.lineage); assertSamePaOriginalMember(intent.source.member, member);
  const emotion = (current ? readCurrentBattingEmotionExecutionFromSqlite : readBattingEmotionExecutionFromSqlite)(db, source.emotionReference);
  if (emotion.source.capability !== 'owned_in_flight_batting_emotion_execution_v1') return fail('in-flight emotion owner differs');
  same(emotion.lineage, b.view.lineage); same(emotion.physicalPitchReference, cut.physicalPitchReference); assertSamePaOriginalMember(emotion.source.member, member);
  const world = current ? readEmotionWorldRevisionFromSqlite(db, b.view.lineage.careerId) : readHistoricalEmotionWorldRevisionFromSqlite(db, b.view.lineage.careerId, source.expectedWorld.worldRevision);
  if (!world) return pending('actual_world_control_head_missing');
  same(source.expectedWorld, { careerId: b.view.lineage.careerId, worldRevision: world.head.worldRevision, controlRevision: world.head.control.revision, controlHash: hash(world.head.control) });
  const timeline = cut.timeline;
  if (timeline.status.kind !== 'active') return pending('plate_appearance_terminal');
  const predictions = source.assessmentReferences.map(pin => {
    const value = readBattingPerceptionFromSqlite(db, 'assessment', pin);
    if (value.kind !== 'batting_score_assessment' || value.source.capability !== 'owned_in_flight_batting_score_assessment_v1') return fail('explicit in-flight score owner differs');
    same(value.lineage, b.view.lineage); same(value.source.modelReference, posture.source.modelReference); assertSamePaOriginalMember(value.source.member, member);
    if (value.physicalPitchSourceId !== cut.physicalPitchReference.sourceId || value.prediction.availableTick > cut.evaluationTick) return fail('unavailable or foreign prediction');
    return value.prediction;
  });
  if (current) same(readCurrentInFlightSamePaBattingKnowledgeFromSqlite(db, source.viewReference).map(v => v.reference), source.assessmentReferences);
  if (source.directive !== 'TAKE' && !predictions.length) return pending('explicit_assessed_batting_prediction_missing');
  const calibrations = source.calibrationReferences.map(r => (current ? readCurrentSamePaLifecycleCalibrationFromSqlite : readSamePaLifecycleCalibrationFromSqlite)(db, r.calibrationReference));
  calibrations.forEach((c, i) => { same(c.source.viewReference, source.viewReference); same(c.source.member, member); same(c.source.nominalReference, posture.source.modelReference);
    if (c.source.route !== source.calibrationReferences[i].route) return fail('calibration route differs'); });
  const decision = calibrations[0].source, motor = calibrations[1].source, swing = calibrations[2].source;
  if (decision.route !== 'batter_decision' || motor.route !== 'batter_motor' || swing.route !== 'batter_swing'
    || decision.response.kind !== 'accepted_execution_values_v1' || motor.response.kind !== 'accepted_execution_values_v1' || swing.response.kind !== 'accepted_execution_values_v1') return fail('calibration domain differs');
  const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', b.view.source.prefixReference.sourceId);
  if (!prefix || prefix.kind !== 'same_pa_lifecycle_prefix') return fail('owned invocation prefix missing');
  const frame = { ...emotion.acceptance.expectedFrame, snapshotId: 'owned-in-flight-batting-input:' + hash([source, world]), worldRevision: world.head.worldRevision,
    time: { tick: cut.evaluationTick, sequence: prefix.source.eventReferences.length } };
  const nominal = posture.model, g = posture.source.geometry;
  const batting = { sourceId: source.sourceId, revision: 0, frame, validUntilTick: g.validUntilTick, ballId: 'pitch:' + cut.physicalPitchReference.sourceId,
    playId: b.actor.match.playId, pitchOrdinal: cut.pitchOrdinal, ticksPerSecond: g.ticksPerSecond, count: timeline.status.count, timelineNextSequence: timeline.nextSequence,
    bodyReadyTick: g.bodyReadyTick, latestMotorStartTick: g.latestMotorStartTick, ...nominal.capability.values, handedness: g.handedness, centerOfMass: g.centerOfMass,
    ...nominal.equipment.values, plateZ: g.plateZ, strikeZone: g.strikeZone, ...nominal.repertoire.values, directive: source.directive, decisionModel: nominal.decisionModel.values, predictions };
  const nominalRequest = readBattingRequest({ currentFrame: frame, currentEmotion: emotion.acceptance.proposal.appraisal.state, acceptedExecution: emotion.acceptance, source: batting });
  return freeze({ kind: 'same_pa_batting_input', source, lineage: b.view.lineage, physicalPitchSourceId: cut.physicalPitchReference.sourceId,
    physicalPitchReference: cut.physicalPitchReference, nominalRequest, effectiveValues: { decision: decision.response.values, motor: motor.response.values, repertoire: swing.response.values } });
};
