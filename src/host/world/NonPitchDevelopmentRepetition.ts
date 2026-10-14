import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { DevelopmentDomain } from '../../core/world/development/DevelopmentTrajectory';
import { DEVELOPMENT_DOMAINS } from '../../core/world/development/DevelopmentTrajectory';
import type { DevelopmentLearningEventInput } from '../../core/world/development/DevelopmentLearningEpisode';
import type { DevelopmentPracticeRepetition } from '../../core/world/development/DevelopmentPracticeExposure';
import { actorFreeze as freeze, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type NonPitchRepetitionExercise = 'BATTING_CONTACT' | 'FIELDING_GLOVE_CONTACT' | 'RUNNING_MOTION';
/** An accepted learning intention for one original play, before its physical
 * pitch. It creates no action, assessment, practice workload or ability gain. */
export type NonPitchRepetitionOpportunity = Readonly<{
  sourceId: string; sourceVersion: string; opportunityId: string;
  actorSourceId: string; playerId: string; personLinkSourceId: string;
  episodeId: string; episodeRevision: number; domain: DevelopmentDomain;
  exercise: NonPitchRepetitionExercise;
}>;
export type AcceptedNonPitchRepetitionAssessment = Readonly<{
  sourceId: string; sourceVersion: string; opportunitySourceId: string;
  closureSourceId: string; physicalProofHash: string; relevant: boolean;
  factors: Omit<DevelopmentPracticeRepetition, 'sourceEventId' | 'atDay' | 'fatigue'>;
  provenance: Readonly<{ assessmentSourceId: string; assessmentVersion: string;
    calibrationSourceId: string; calibrationVersion: string }>;
}>;
export type NonPitchRepetitionAuthority = Readonly<{
  readAcceptedOpportunity?(sourceId: string): NonPitchRepetitionOpportunity | null;
  readAcceptedAssessment?(sourceId: string): AcceptedNonPitchRepetitionAssessment | null;
}>;
export const nonPitchId = (v: unknown): v is string => typeof v === 'string' && !!v.length && v.trim() === v;
export const nonPitchFields = (v: unknown, names: readonly string[]): boolean => !!v && typeof v === 'object'
  && !Array.isArray(v) && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const unit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
export const nonPitchOpportunityInput = (raw: unknown, sourceId: string): NonPitchRepetitionOpportunity => {
  const s = cloneInert(raw) as NonPitchRepetitionOpportunity;
  if (!nonPitchFields(s, ['sourceId', 'sourceVersion', 'opportunityId', 'actorSourceId', 'playerId', 'personLinkSourceId',
    'episodeId', 'episodeRevision', 'domain', 'exercise']) || s.sourceId !== sourceId
    || ![s.sourceId, s.sourceVersion, s.opportunityId, s.actorSourceId, s.playerId, s.personLinkSourceId, s.episodeId].every(nonPitchId)
    || !Number.isSafeInteger(s.episodeRevision) || s.episodeRevision < 0 || !DEVELOPMENT_DOMAINS.includes(s.domain)
    || !['BATTING_CONTACT', 'FIELDING_GLOVE_CONTACT', 'RUNNING_MOTION'].includes(s.exercise)) {
    throw new Error('invalid accepted non-pitch repetition opportunity');
  }
  return freeze(s);
};
export const nonPitchAssessmentInput = (raw: unknown, sourceId: string): AcceptedNonPitchRepetitionAssessment => {
  const s = cloneInert(raw) as AcceptedNonPitchRepetitionAssessment;
  if (!nonPitchFields(s, ['sourceId', 'sourceVersion', 'opportunitySourceId', 'closureSourceId', 'physicalProofHash', 'relevant', 'factors', 'provenance'])
    || s.sourceId !== sourceId || ![s.sourceId, s.sourceVersion, s.opportunitySourceId, s.closureSourceId].every(nonPitchId)
    || typeof s.physicalProofHash !== 'string' || !/^[a-f0-9]{64}$/.test(s.physicalProofHash) || typeof s.relevant !== 'boolean'
    || !nonPitchFields(s.factors, ['trainingStimulus', 'coachingFit', 'challengeFit', 'healthAvailability', 'motivation', 'opportunity', 'novelty'])
    || !Object.values(s.factors).every(unit)
    || !nonPitchFields(s.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion'])
    || !Object.values(s.provenance).every(nonPitchId)) throw new Error('invalid accepted non-pitch repetition assessment');
  return freeze(s);
};
export const nonPitchRepetitionEventId = (careerId: string, gameId: string, playId: number, playerId: string): string =>
  `non-pitch-game-repetition:${hash([careerId, gameId, playId, playerId])}`;
export const isNonPitchRepetitionEvent = (event: DevelopmentLearningEventInput): boolean =>
  event.sourceEventId.startsWith('non-pitch-game-repetition:');
