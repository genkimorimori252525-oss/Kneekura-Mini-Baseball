import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { startPracticeDevelopmentLearningEpisode } from '../../core/world/development/DevelopmentLearningEpisode';
import { deriveDevelopmentInitiationHistory, type RecordedDevelopmentInitiation } from '../../core/world/development/DevelopmentInitiationHistory';
import { evaluateDevelopmentReceptivity } from '../../core/world/development/DevelopmentReceptivity';
import { resolveDevelopmentEpisodeInitiation } from '../../core/world/development/DevelopmentEpisodeInitiation';
import { advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import type { AcceptedDevelopmentAppraisal, AcceptedDevelopmentPolicies } from './DevelopmentEpisodeFromAcceptedAppraisal';
import { practiceFields, practiceHash, practiceId, practiceJson as json, practiceRevision, practiceWorkload,
  type PitchPracticeAttempt } from './PitchPracticeAttempt';
import { assertArchivedPlayerWorkloadActivity, type DurablePlayerWorkloadActivity, type SqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import type { SqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';

export const PRACTICE_DEVELOPMENT_KIND = 'PRACTICE_TECHNICAL_DISCOVERY' as const;
export type PracticeDevelopmentRequest = Readonly<{
  episodeId: string; playerId: string; personSourceId: string; appraisalSourceId: string; policySourceId: string;
}>;
export type AcceptedPracticeDevelopmentAppraisal = AcceptedDevelopmentAppraisal & Readonly<{
  sourceVersion: string;
  discovery: Readonly<{ sourceEventId: string; occurredAtDay: number; motifId: string;
    completionReference: NonNullable<PitchPracticeAttempt['completionReference']> }>;
}>;
export type PracticeDevelopmentSources = Readonly<{
  attempts: Pick<SqlitePitchPracticeAttemptStore, 'read'>;
  workload: Pick<SqlitePlayerWorkloadRecoveryStore, 'readActivity'>;
  readAcceptedAppraisal?: (sourceId: string) => AcceptedPracticeDevelopmentAppraisal | null;
}>;
type Db = Pick<DatabaseSync, 'prepare'>;
export type PracticePhysicalReader = (attemptId: string) => PitchPracticeAttempt | null;
export type PracticeOriginEvidence = Readonly<{
  attempt: PitchPracticeAttempt; attemptRow: unknown; workload: DurablePlayerWorkloadActivity;
  genesis: Readonly<{ career_seed: number }>;
}>;
export type PracticeOrigin = Readonly<{
  request: PracticeDevelopmentRequest; appraisal: AcceptedPracticeDevelopmentAppraisal;
  policies: AcceptedDevelopmentPolicies; evidence: PracticeOriginEvidence; prior: readonly RecordedDevelopmentInitiation[];
}>;
export type PracticeOriginRow = Readonly<{
  episode_id: string; career_id: string; player_id: string; discovery_event_id: string; motif_id: string;
  attempt_id: string; appraisal_source_id: string; source_version: string; origin_json: string; origin_hash: string;
}>;
export type PracticeInitiationRow = Readonly<{
  episode_id: string; career_id: string; player_id: string; at_day: number; appraisal_source_id: string;
  request_json: string; prior_json: string; assessment_json: string; initial_json: string;
}>;

export const validatePracticeDevelopmentRequest = (raw: PracticeDevelopmentRequest): PracticeDevelopmentRequest => {
  const input = cloneInert(raw);
  if (!practiceFields(input, ['episodeId', 'playerId', 'personSourceId', 'appraisalSourceId', 'policySourceId'])
    || !Object.values(input).every(practiceId)) throw new Error('invalid practice development request scope');
  return input;
};
export const validatePracticeDevelopmentIntake = (request: PracticeDevelopmentRequest,
  raw: AcceptedPracticeDevelopmentAppraisal, policyInput: AcceptedDevelopmentPolicies) => {
  const appraisal = cloneInert(raw), policies = cloneInert(policyInput);
  if (!practiceFields(appraisal, ['sourceId', 'sourceVersion', 'episodeId', 'careerId', 'playerId', 'domain', 'ageYears',
    'competingLearningLoad', 'appraisal', 'discovery'])
    || ![appraisal.sourceId, appraisal.sourceVersion, appraisal.episodeId, appraisal.careerId, appraisal.playerId].every(practiceId)
    || appraisal.sourceId !== request.appraisalSourceId || appraisal.episodeId !== request.episodeId
    || appraisal.playerId !== request.playerId || appraisal.domain !== 'TECHNICAL'
    || !practiceFields(appraisal.discovery, ['sourceEventId', 'occurredAtDay', 'motifId', 'completionReference'])
    || ![appraisal.discovery.sourceEventId, appraisal.discovery.motifId].every(practiceId)
    || !practiceRevision(appraisal.discovery.occurredAtDay)
    || !practiceFields(appraisal.discovery.completionReference, ['attemptId', 'revision', 'hash'])
    || !practiceId(appraisal.discovery.completionReference.attemptId) || !practiceRevision(appraisal.discovery.completionReference.revision)
    || typeof appraisal.discovery.completionReference.hash !== 'string' || !/^[a-f0-9]{64}$/.test(appraisal.discovery.completionReference.hash)
    || !practiceFields(appraisal.appraisal, ['sourceEventId', 'atDay', 'salience', 'learningDisposition', 'novelty', 'consolidationCapacity'])
    || !practiceRevision(appraisal.appraisal.atDay) || appraisal.appraisal.atDay < appraisal.discovery.occurredAtDay
    || !practiceFields(policies, ['sourceId', 'careerId', 'learning', 'receptivity', 'initiation'])
    || policies.sourceId !== request.policySourceId || policies.careerId !== appraisal.careerId) {
    throw new Error('invalid accepted practice discovery appraisal or policy scope');
  }
  return { appraisal, policies };
};

/** The supplied reader must replay the real physical owner on this connection. */
export const capturePracticeOriginEvidence = (db: Db, request: PracticeDevelopmentRequest,
  appraisal: AcceptedPracticeDevelopmentAppraisal, readPhysical: PracticePhysicalReader): PracticeOriginEvidence => {
  const reference = appraisal.discovery.completionReference, attempt = readPhysical(reference.attemptId);
  if (!attempt || attempt.status !== 'DELIVERY_COMPLETE' || !attempt.assessment || attempt.opportunity.episode !== null
    || json(attempt.completionReference) !== json(reference) || attempt.opportunity.careerId !== appraisal.careerId
    || attempt.opportunity.playerId !== request.playerId || attempt.opportunity.personLinkSourceId !== request.personSourceId
    || attempt.opportunity.atDay > appraisal.discovery.occurredAtDay) throw new Error('practice origin completion, assessment, chronology or Person scope differs');
  const attemptRow = db.prepare('SELECT * FROM pitch_practice_attempts WHERE attempt_id=?').get(attempt.attemptId) as {
    episode_before_json: string; learning_evidence_json: string;
  } | undefined;
  if (!attemptRow || attemptRow.episode_before_json !== 'null' || attemptRow.learning_evidence_json !== 'null') {
    throw new Error('practice origin must retain its original null episode');
  }
  const activity = practiceWorkload(attempt)!;
  const workload = { activity, before: attempt.frame.workload,
    after: advancePlayerWorkloadRecovery(attempt.frame.workload, attempt.opportunity.workloadRevision, activity) };
  assertArchivedPlayerWorkloadActivity(db, workload);
  const genesis = db.prepare('SELECT * FROM world_person_genesis_careers WHERE career_id=?').get(appraisal.careerId) as { career_seed: number } | undefined;
  if (!genesis || !Number.isSafeInteger(genesis.career_seed) || genesis.career_seed <= 0 || genesis.career_seed >= 2 ** 32) {
    throw new Error('practice origin Career seed is missing');
  }
  return { attempt, attemptRow, workload, genesis };
};

export const resolvePracticeDevelopmentOrigin = (origin: PracticeOrigin): RecordedDevelopmentInitiation => {
  const { appraisal: accepted, policies, evidence, prior: history } = origin;
  const person = evidence.attempt.frame.person.priors;
  const episode = startPracticeDevelopmentLearningEpisode(origin.request.episodeId,
    { careerId: accepted.careerId, playerId: accepted.playerId, occurredAtDay: accepted.discovery.occurredAtDay,
      sourceEventId: accepted.discovery.sourceEventId, causeEventId: evidence.workload.activity.sourceEventId, motifId: accepted.discovery.motifId },
    { careerId: person.catalyst.careerId, playerId: person.catalyst.playerId, createdAtDay: person.catalyst.createdAtDay,
      profileVersion: person.catalyst.profileVersion }, policies.learning);
  const prior = evaluateDevelopmentReceptivity(person.trajectory, accepted.domain, accepted.ageYears, accepted.appraisal.atDay, policies.receptivity);
  return resolveDevelopmentEpisodeInitiation({ episode, catalystProfile: person.catalyst, prior, appraisal: accepted.appraisal,
    policy: policies.initiation, careerDevelopmentSeed: evidence.genesis.career_seed,
    ...deriveDevelopmentInitiationHistory(episode, accepted.appraisal.atDay, history), competingLearningLoad: accepted.competingLearningLoad });
};

export const practiceOriginRow = (origin: PracticeOrigin): PracticeOriginRow => ({
  episode_id: origin.request.episodeId, career_id: origin.appraisal.careerId, player_id: origin.appraisal.playerId,
  discovery_event_id: origin.appraisal.discovery.sourceEventId, motif_id: origin.appraisal.discovery.motifId,
  attempt_id: origin.evidence.attempt.attemptId, appraisal_source_id: origin.appraisal.sourceId, source_version: origin.appraisal.sourceVersion,
  origin_json: json(origin), origin_hash: practiceHash(origin),
});
export const practiceOriginRequest = (origin: PracticeOrigin) => ({ kind: PRACTICE_DEVELOPMENT_KIND,
  ...origin.request, originHash: practiceHash(origin) });

/** Immutable initiation only: never traverse the episode's current learning head. */
export const readPracticeDevelopmentBoundary = (db: Db, initiation: PracticeInitiationRow, readPhysical: PracticePhysicalReader) => {
  const saved = db.prepare('SELECT * FROM world_development_practice_origins WHERE episode_id=?').get(initiation.episode_id) as PracticeOriginRow | undefined;
  if (!saved) throw new Error('practice development origin source is missing');
  const origin = JSON.parse(saved.origin_json) as PracticeOrigin;
  if (!practiceFields(origin, ['request', 'appraisal', 'policies', 'evidence', 'prior']) || json(practiceOriginRow(origin)) !== json(saved)) {
    throw new Error('corrupt practice development origin binding');
  }
  const request = validatePracticeDevelopmentRequest(origin.request);
  validatePracticeDevelopmentIntake(request, origin.appraisal, origin.policies);
  const evidence = capturePracticeOriginEvidence(db, request, origin.appraisal, readPhysical);
  if (json(evidence) !== json(origin.evidence) || initiation.request_json !== json(practiceOriginRequest(origin))
    || initiation.episode_id !== request.episodeId || initiation.career_id !== origin.appraisal.careerId
    || initiation.player_id !== request.playerId || initiation.appraisal_source_id !== request.appraisalSourceId
    || initiation.at_day !== origin.appraisal.appraisal.atDay || initiation.prior_json !== json(origin.prior)) {
    throw new Error('practice development original source evidence differs');
  }
  const initial = resolvePracticeDevelopmentOrigin(origin);
  if (initiation.assessment_json !== json(initial.assessment) || initiation.initial_json !== json(initial.episode)) {
    throw new Error('practice development initial assessment replay differs');
  }
  return { origin, saved, initial };
};
