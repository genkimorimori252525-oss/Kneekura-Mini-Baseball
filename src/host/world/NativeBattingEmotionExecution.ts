import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { EmotionState } from '../../core/world/psychology/EmotionTypes';
import type { AppraisalInput } from '../../core/world/psychology/appraisal/AppraisalTypes';
import { readAppraisalInput } from '../../core/world/psychology/appraisal/AppraisalValidation';
import { readModel, readBaseline } from '../../core/world/psychology/execution/ExecutionValidation';
import { prepareEmotionExecution } from '../../core/world/psychology/execution/ExecutionPreparation';
import { acceptEmotionExecution } from '../../core/world/psychology/execution/ExecutionAcceptance';
import type { EmotionFreeDecisionBaseline, ExecutionModel, ExecutionFrame, EmotionExecutionAcceptance } from '../../core/world/psychology/execution/ExecutionTypes';
import { actorHash as hash, actorJson as json, actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaHash, samePaReferenceValid as ref, type SamePaReference, type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import type { SamePaCurrentExecutionViewReference } from './SamePlateAppearanceInvocationView';
import type { EmotionWorldRevision } from './EmotionWorldRevisionFromSqlite';
import type { DurableBattingObservation, DurableBattingObservationDelivery } from './NativeBattingPerception';
import type { AcceptedBattingScoreAssessment } from './NativeBattingScoreAssessment';

export type AcceptedBattingEmotionExecution = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'owned_batting_emotion_execution_v1'; executionId: string;
  viewReference: SamePaCurrentExecutionViewReference; member: SamePaDispatchMember;
  observationReference: SamePaReference<'batting_observation_v1_observations'>;
  deliveryReference: SamePaReference<'batting_observation_v1_deliveries'>;
  genesisReference: SamePaReference<'batting_emotion_v1_geneses'>;
  previousExecutionReference: SamePaReference<'batting_emotion_execution_v1_executions'> | null;
  expectedWorld: Readonly<{ careerId: string; worldRevision: number; controlRevision: number; controlHash: string }>;
  appraisalAssessment: AppraisalInput;
  baseline: Omit<EmotionFreeDecisionBaseline, 'frame'>; executionModel: ExecutionModel;
  provenance: AcceptedBattingScoreAssessment['provenance'];
}>;
export type DurableBattingEmotionExecution = Readonly<{
  kind: 'batting_emotion_execution'; source: AcceptedBattingEmotionExecution; lineage: SamePaExecutionLineage;
  physicalPitchSourceId: string; physicalPitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions'>;
  worldBefore: EmotionWorldRevision; acceptance: EmotionExecutionAcceptance;
}>;
const tick = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const fail = (detail: string): never => { throw new Error('batting emotion execution ' + detail); };
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) fail('original factual scope or frame differs'); };
export const battingEmotionExecutionInput = (raw: unknown, id?: string): AcceptedBattingEmotionExecution => {
  const s = cloneInert(raw) as AcceptedBattingEmotionExecution;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'executionId', 'viewReference', 'member', 'observationReference', 'deliveryReference', 'genesisReference',
    'previousExecutionReference', 'expectedWorld', 'appraisalAssessment', 'baseline', 'executionModel', 'provenance'])
    || !text(s.sourceId) || !text(s.sourceVersion) || !text(s.executionId) || id !== undefined && s.sourceId !== id || s.capability !== 'owned_batting_emotion_execution_v1'
    || !ref(s.viewReference, 'pa_continuation_v1_execution_views') || !samePaDispatchMemberValid(s.member)
    || !ref(s.deliveryReference, 'batting_observation_v1_deliveries') || !ref(s.observationReference, 'batting_observation_v1_observations') || !ref(s.genesisReference, 'batting_emotion_v1_geneses')
    || s.previousExecutionReference !== null && !ref(s.previousExecutionReference, 'batting_emotion_execution_v1_executions')
    || !fields(s.expectedWorld, ['careerId', 'worldRevision', 'controlRevision', 'controlHash']) || !text(s.expectedWorld.careerId)
    || !tick(s.expectedWorld.worldRevision) || !tick(s.expectedWorld.controlRevision) || !samePaHash(s.expectedWorld.controlHash)
    || !fields(s.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion']) || !Object.values(s.provenance).every(text)
    || !fields(s.baseline, ['basis', 'sourceId', 'revision', 'swingDecision', 'throwIntent', 'defenseReplan', 'swingAggression', 'throwAggression', 'minimumAdvanceSafetyMarginTicks'])) return fail('invalid explicit Source');
  readAppraisalInput(s.appraisalAssessment); readModel(s.executionModel);
  const b = s.baseline;
  if (b.basis !== 'WITHOUT_EMOTION' || !text(b.sourceId) || !tick(b.revision) || !tick(b.minimumAdvanceSafetyMarginTicks)
    || [b.swingAggression, b.throwAggression].some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)) return fail('invalid explicit emotion-free baseline');
  for (const window of [b.swingDecision, b.throwIntent, b.defenseReplan]) {
    if (!fields(window, ['tick', 'earliestTick', 'latestTick']) || !Object.values(window).every(tick)
      || window.earliestTick > window.tick || window.latestTick < window.tick) return fail('invalid explicit baseline timing window');
  }
  return freeze(s);
};
export const battingEmotionFrame = (source: Pick<AcceptedBattingEmotionExecution, 'viewReference' | 'observationReference' | 'deliveryReference' | 'previousExecutionReference'>,
  actor: DurablePhysicalPlateAppearanceActor, world: EmotionWorldRevision, time: ExecutionFrame['time']): ExecutionFrame => freeze({
    scope: { careerId: actor.binding.careerId, matchId: actor.source.gameId, playerId: actor.binding.playerId },
    contextId: 'same-pa-batting:' + hash([actor.source.sourceId, actor.source.gameId, actor.match.playId]),
    snapshotId: 'owned-batting-frame:' + hash([source.viewReference, source.observationReference, source.deliveryReference, source.previousExecutionReference, world]),
    worldRevision: world.head.worldRevision, time,
  });

/** Pure reconstruction over already authenticated originals. The Native owner
 * supplies this basis privately. All appraisal magnitudes/models are explicitly
 * accepted primitives; this creates no autonomous assessment or default state. */
export const deriveBattingEmotionExecution = (source: AcceptedBattingEmotionExecution, basis: Readonly<{
  actor: DurablePhysicalPlateAppearanceActor; lineage: SamePaExecutionLineage; worldBefore: EmotionWorldRevision; beforeEmotion: EmotionState;
  observation: DurableBattingObservation; delivery: DurableBattingObservationDelivery; time: ExecutionFrame['time']; physicalPitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions'>;
}>): DurableBattingEmotionExecution => {
  const { actor, observation, delivery, worldBefore, beforeEmotion } = basis;
  const frame = battingEmotionFrame(source, actor, worldBefore, basis.time), a = readAppraisalInput(source.appraisalAssessment);
  same(source.expectedWorld, { careerId: actor.binding.careerId, worldRevision: worldBefore.head.worldRevision, controlRevision: worldBefore.head.control.revision, controlHash: hash(worldBefore.head.control) });
  same(a.importance.scope, frame.scope); same(a.importance.time, frame.time);
  if (a.importance.contextId !== frame.contextId || a.event.contextId !== frame.contextId || a.expectedRevision !== beforeEmotion.revision
    || a.event.eventId !== delivery.source.sourceId || a.event.stamp.sourceId !== delivery.source.sourceId
    || a.event.stamp.revision !== delivery.eventSequence || a.event.stamp.time.tick !== delivery.delivery.evaluatedAtTick
    || a.event.stamp.time.sequence !== delivery.eventSequence || delivery.delivery.kind !== 'batting_observation_delivered'
    || delivery.originalCaptureHash !== hash(observation) || delivery.delivery.evaluatedAtTick > basis.time.tick) return fail('appraisal lacks the exact delivered event cut');
  same(delivery.source.observationReference, source.observationReference); same(a.evidenceEventIds, [delivery.source.sourceId]); same(a.policy, beforeEmotion.policy);
  const clubId = actor.binding.clubId, game = actor.worldFixture.game;
  const opponentClubId = clubId === game.homeClubId ? game.awayClubId : game.homeClubId;
  if (a.importance.clubId !== clubId || a.importance.opponentClubId !== opponentClubId || a.importance.competition.competitionId !== actor.binding.competitionEditionId
    || a.importance.competition.matchId !== actor.source.gameId || a.importance.competition.careerId !== actor.binding.careerId) return fail('accepted appraisal Career or competition binding differs');
  const baseline = { ...source.baseline, frame }; readBaseline(baseline, frame);
  const request = { executionId: source.executionId, frame, beforeEmotion, appraisal: a, baseline, model: source.executionModel, runner: null };
  const prepared = prepareEmotionExecution(request); if (!prepared.ok) return fail('Core preparation rejected: ' + prepared.reason.path);
  const accepted = acceptEmotionExecution(request, prepared.value); if (!accepted.ok) return fail('Core acceptance rejected: ' + accepted.reason.path);
  return freeze({ kind: 'batting_emotion_execution', source, lineage: basis.lineage, physicalPitchSourceId: basis.physicalPitchReference.sourceId,
    physicalPitchReference: basis.physicalPitchReference, worldBefore, acceptance: accepted.value });
};
