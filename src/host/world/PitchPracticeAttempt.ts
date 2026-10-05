import { createHash } from 'node:crypto';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { SeedRoot } from '../../core/rng/SeedRoot';
import type { CanonicalPitchDelivery } from '../../core/sim/pitch/CanonicalPitchDelivery';
import { applyPitchFatigueToExecution } from '../../core/sim/pitch/PitchFatigueExecution';
import type { PitchTimingIntent } from '../../core/sim/pitch/PitchTimingModel';
import type { DevelopmentLearningEpisode } from '../../core/world/development/DevelopmentLearningEpisode';
import type { PlayerPitchTimingSource } from '../../core/world/development/PlayerPitchTimingSource';
import type { PlayerWorkloadActivity, PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import { resolvePlayerPitchDeliveryFromWorld } from './PlayerPitchDeliveryRuntime';
import type { DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';
import type { DurablePersonPriors } from './SqlitePersonGenesisStore';
import type { AcceptedPitchFatiguePolicy } from './SqlitePitchFatiguePolicyStore';
import type { PlayerReleaseGeometrySnapshot } from './SqlitePlayerReleaseGeometryStore';

/** A prospective, explicitly accepted command. It contains no completion evidence. */
export type PitchPracticeOpportunity = Readonly<{
  sourceId: string; sourceVersion: string; opportunityId: string; ordinal: number;
  previousAttemptId: string | null; careerId: string; playerId: string; personLinkSourceId: string;
  atDay: number; readyAtUs: number; workloadRevision: number; timingRevision: number; releaseRevision: number;
  fatiguePolicySourceId: string; practiceSeed: number; timingIntent: PitchTimingIntent;
  moundReference: Vec3; physics: Readonly<{ velocity: Vec3; spin: Vec3 }>;
  episode: Readonly<{ episodeId: string; revision: number; domain: 'TECHNICAL' }> | null;
}>;
export type PitchPracticeAssessment = Readonly<{
  sourceId: string; sourceVersion: string; attemptId: string; completionHash: string;
  effortUnits: number; healthAvailability: number;
  provenance: Readonly<{ assessmentSourceId: string; assessmentVersion: string; calibrationSourceId: string; calibrationVersion: string }>;
}>;
export type PitchPracticeFrame = Readonly<{
  personLink: DurablePlayerPersonLink; person: DurablePersonPriors;
  workload: PlayerWorkloadRecoveryState; timing: PlayerPitchTimingSource;
  release: PlayerReleaseGeometrySnapshot; policy: AcceptedPitchFatiguePolicy;
}>;
export type PitchPracticePriorClock = Readonly<{
  attemptId: string; atDay: number; followThroughEndUs: number;
  completionHash: string; workloadActivityId: string; workloadRevision: number;
}>;
export type PitchPracticePhase = Readonly<{
  kind: 'motion_started' | 'gather_ended' | 'stride_started' | 'released' | 'follow_through_completed'; atUs: number;
}>;
export type PitchPracticeAttempt = Readonly<{
  attemptId: string; opportunity: PitchPracticeOpportunity; revision: number; throughUs: number;
  priorClock: PitchPracticePriorClock | null; status: 'IN_PROGRESS' | 'DELIVERY_COMPLETE';
  frame: PitchPracticeFrame; plannedDelivery: CanonicalPitchDelivery; events: readonly PitchPracticePhase[];
  observation: null | Readonly<{ kind: 'RAW_TIMING'; deliveryMode: 'NORMAL' | 'QUICK'; motionStartUs: number; releaseUs: number; motionToReleaseUs: number }>;
  completionReference: null | Readonly<{ attemptId: string; revision: number; hash: string }>;
  assessment: PitchPracticeAssessment | null;
}>;
export type PitchPracticeSettlement = Readonly<{ kind: 'pending'; reason: string; workload?: PlayerWorkloadRecoveryState }>
  | Readonly<{ kind: 'complete'; activity: PlayerWorkloadActivity; workload: PlayerWorkloadRecoveryState; episode: DevelopmentLearningEpisode | null }>;
export const practiceJson = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
export const practiceHash = (value: unknown): string => createHash('sha256').update(practiceJson(value)).digest('hex');
export const practiceId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
export const practiceRevision = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export const practiceFields = (value: unknown, names: readonly string[]): boolean => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
export const freezePractice = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freezePractice); Object.freeze(value); }
  return value;
};
export const practiceAttemptId = (opportunity: PitchPracticeOpportunity): string =>
  `pitch-practice:${practiceHash([opportunity.careerId, opportunity.opportunityId, opportunity.ordinal])}`;
export const practiceActivityId = (attemptId: string): string => `practice-workload:${attemptId}`;
export const validatePracticeOpportunity = (raw: PitchPracticeOpportunity, sourceId: string): PitchPracticeOpportunity => {
  const value = cloneInert(raw);
  if (!practiceFields(value, ['sourceId', 'sourceVersion', 'opportunityId', 'ordinal', 'previousAttemptId', 'careerId', 'playerId',
    'personLinkSourceId', 'atDay', 'readyAtUs', 'workloadRevision', 'timingRevision', 'releaseRevision', 'fatiguePolicySourceId',
    'practiceSeed', 'timingIntent', 'moundReference', 'physics', 'episode'])
    || value.sourceId !== sourceId || ![value.sourceId, value.sourceVersion, value.opportunityId, value.careerId, value.playerId,
      value.personLinkSourceId, value.fatiguePolicySourceId].every(practiceId)
    || ![value.ordinal, value.atDay, value.readyAtUs, value.workloadRevision, value.timingRevision, value.releaseRevision, value.practiceSeed].every(practiceRevision)
    || value.practiceSeed >= 2 ** 32 || value.previousAttemptId !== null && !practiceId(value.previousAttemptId)
    || !practiceFields(value.timingIntent, ['deliveryMode', 'cadenceIntent'])
    || !practiceFields(value.moundReference, ['x', 'y', 'z'])
    || !Object.values(value.moundReference).every(n => typeof n === 'number' && Number.isFinite(n))
    || value.episode !== null && (!practiceFields(value.episode, ['episodeId', 'revision', 'domain'])
      || !practiceId(value.episode.episodeId) || !practiceRevision(value.episode.revision) || value.episode.domain !== 'TECHNICAL')) {
    throw new Error('invalid accepted practice opportunity scope');
  }
  return freezePractice(value);
};
export const validatePracticeAssessment = (raw: PitchPracticeAssessment, sourceId: string, attempt: PitchPracticeAttempt): PitchPracticeAssessment => {
  const value = cloneInert(raw);
  if (!practiceFields(value, ['sourceId', 'sourceVersion', 'attemptId', 'completionHash', 'effortUnits', 'healthAvailability', 'provenance'])
    || value.sourceId !== sourceId || !practiceId(value.sourceId) || !practiceId(value.sourceVersion)
    || value.attemptId !== attempt.attemptId || !attempt.completionReference || value.completionHash !== attempt.completionReference.hash
    || typeof value.effortUnits !== 'number' || !Number.isFinite(value.effortUnits) || value.effortUnits < 0
    || typeof value.healthAvailability !== 'number' || !Number.isFinite(value.healthAvailability) || value.healthAvailability < 0 || value.healthAvailability > 1
    || !practiceFields(value.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion'])
    || !Object.values(value.provenance).every(practiceId)) throw new Error('invalid completion-bound practice assessment or provenance');
  return freezePractice(value);
};
/** Reconstruct only the requested prefix of an authenticated timing history. */
export const practiceTimingAtRevision = (head: PlayerPitchTimingSource, revision: number): PlayerPitchTimingSource => {
  if (revision > head.revision) throw new Error('practice timing revision is missing');
  const records = head.records.slice(0, revision), last = records.at(-1), first = head.records[0];
  return { ...head, revision, records, effectiveDay: last?.effectiveDay ?? head.createdAtDay,
    profile: { ...head.profile,
      normalMotionToReleaseUs: last?.afterNormalMotionToReleaseUs ?? first?.beforeNormalMotionToReleaseUs ?? head.profile.normalMotionToReleaseUs,
      quickSpeedFactor: last?.afterQuickSpeedFactor ?? first?.beforeQuickSpeedFactor ?? head.profile.quickSpeedFactor } };
};
export const planPracticeDelivery = (opportunity: PitchPracticeOpportunity, frame: PitchPracticeFrame): CanonicalPitchDelivery => {
  const { sourceId: _sourceId, sourceVersion: _sourceVersion, ...policy } = frame.policy;
  const execution = applyPitchFatigueToExecution(frame.timing.profile, opportunity.physics, frame.workload.fatigue, policy, opportunity.atDay);
  return resolvePlayerPitchDeliveryFromWorld({ timing: { selectProfileAtDay: () => execution.timingProfile },
    release: { selectAtDay: () => frame.release } }, { careerId: opportunity.careerId, playerId: opportunity.playerId,
    gameDay: opportunity.atDay, root: new SeedRoot(opportunity.practiceSeed), outingId: `practice:${opportunity.opportunityId}`,
    playId: opportunity.ordinal, pitchIndex: opportunity.ordinal, readyAtUs: opportunity.readyAtUs,
    timingIntent: opportunity.timingIntent, moundReference: opportunity.moundReference, physics: execution.physics });
};
export const practicePhases = (delivery: CanonicalPitchDelivery): readonly PitchPracticePhase[] => {
  const t = delivery.timeline;
  return [{ kind: 'motion_started', atUs: t.motionStartUs }, { kind: 'gather_ended', atUs: t.gatherEndUs },
    { kind: 'stride_started', atUs: t.strideStartUs }, { kind: 'released', atUs: t.releaseUs },
    { kind: 'follow_through_completed', atUs: t.followThroughEndUs }];
};
export const practiceWorkload = (attempt: PitchPracticeAttempt): PlayerWorkloadActivity | null => {
  if (!attempt.completionReference || !attempt.assessment) return null;
  return { sourceEventId: practiceActivityId(attempt.attemptId), sourceVersion: 'actual-pitch-practice-v1',
    evidenceId: attempt.completionReference.hash, careerId: attempt.opportunity.careerId, playerId: attempt.opportunity.playerId,
    atDay: attempt.opportunity.atDay, kind: 'PRACTICE', effortUnits: attempt.assessment.effortUnits,
    healthAvailability: attempt.assessment.healthAvailability };
};
