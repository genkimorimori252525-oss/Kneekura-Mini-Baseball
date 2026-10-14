import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { startNationalExposureDevelopmentLearningEpisode } from '../../core/world/development/DevelopmentLearningEpisode';
import { deriveDevelopmentInitiationHistory, type RecordedDevelopmentInitiation } from '../../core/world/development/DevelopmentInitiationHistory';
import { evaluateDevelopmentReceptivity } from '../../core/world/development/DevelopmentReceptivity';
import { resolveDevelopmentEpisodeInitiation } from '../../core/world/development/DevelopmentEpisodeInitiation';
import type { AcceptedDevelopmentAppraisal, AcceptedDevelopmentPolicies } from './DevelopmentEpisodeFromAcceptedAppraisal';
import { practiceFields as fields, practiceHash as hash, practiceId as id, practiceJson as json } from './PitchPracticeAttempt';
import { officialParticipationEvidenceFromSqlite } from './SqliteOfficialParticipationStore';
import { isNationalParticipationKind, type TaggedParticipationReceipt } from './TaggedParticipationEvidenceFromSqlite';
import { personGenesisEvidenceFromSqlite, type DurablePersonPriors } from './SqlitePersonGenesisStore';
import { readClinicalPersonLink } from './HealthRehabEvidenceFromSqlite';
import type { PracticeInitiationRow } from './PracticeDevelopmentOrigin';

export const NATIONAL_EXPOSURE_DEVELOPMENT_KIND = 'NATIONAL_PARTICIPATION_ELITE_EXPOSURE' as const;
export type NationalExposureDevelopmentRequest = Readonly<{
  episodeId: string; playerId: string; personSourceId: string; appraisalSourceId: string; policySourceId: string; participationReceiptId: string;
}>;
export type AcceptedNationalExposureAppraisal = AcceptedDevelopmentAppraisal & Readonly<{ sourceVersion: string; motifId: string }>;
export type NationalExposureDevelopmentSources = Readonly<{
  readAcceptedAppraisal(sourceId: string): AcceptedNationalExposureAppraisal | null;
}>;
export type NationalExposureEvidence = Readonly<{
  receipt: TaggedParticipationReceipt; person: DurablePersonPriors;
  personLink: ReturnType<typeof readClinicalPersonLink>; genesis: unknown; careerDevelopmentSeed: number;
}>;
export type NationalExposureOrigin = Readonly<{
  request: NationalExposureDevelopmentRequest; appraisal: AcceptedNationalExposureAppraisal;
  policies: AcceptedDevelopmentPolicies; evidence: NationalExposureEvidence; prior: readonly RecordedDevelopmentInitiation[];
}>;
export type NationalExposureOriginRow = Readonly<{
  episode_id: string; career_id: string; player_id: string; game_id: string; participation_receipt_id: string;
  appraisal_source_id: string; source_version: string; origin_json: string; origin_hash: string;
}>;

export const validateNationalExposureRequest = (raw: NationalExposureDevelopmentRequest): NationalExposureDevelopmentRequest => {
  const request = cloneInert(raw);
  if (!fields(request, ['episodeId', 'playerId', 'personSourceId', 'appraisalSourceId', 'policySourceId', 'participationReceiptId'])
    || !Object.values(request).every(id)) throw new Error('invalid National exposure request scope');
  return request;
};
export const validateNationalExposureIntake = (request: NationalExposureDevelopmentRequest,
  raw: AcceptedNationalExposureAppraisal, policyInput: AcceptedDevelopmentPolicies) => {
  const appraisal = cloneInert(raw), policies = cloneInert(policyInput);
  if (!fields(appraisal, ['sourceId', 'sourceVersion', 'motifId', 'episodeId', 'careerId', 'playerId', 'domain', 'ageYears', 'competingLearningLoad', 'appraisal'])
    || ![appraisal.sourceId, appraisal.sourceVersion, appraisal.motifId, appraisal.episodeId, appraisal.careerId, appraisal.playerId].every(id)
    || appraisal.sourceId !== request.appraisalSourceId || appraisal.episodeId !== request.episodeId || appraisal.playerId !== request.playerId
    || !fields(policies, ['sourceId', 'careerId', 'learning', 'receptivity', 'initiation'])
    || policies.sourceId !== request.policySourceId || policies.careerId !== appraisal.careerId) {
    throw new Error('invalid accepted National exposure appraisal or policies');
  }
  return { appraisal, policies };
};

/** Original National membership and the actual participant are replayed by their owner, never a current call-up snapshot. */
export const captureNationalExposureEvidence = (db: DatabaseSync, request: NationalExposureDevelopmentRequest,
  appraisal: AcceptedNationalExposureAppraisal): NationalExposureEvidence => {
  const receipt = officialParticipationEvidenceFromSqlite(db).readReceipt(request.participationReceiptId);
  if (!receipt || !('evidenceKind' in receipt) || !isNationalParticipationKind(receipt.evidenceKind)) {
    throw new Error('National exposure requires an actual supported National participation receipt');
  }
  const binding = receipt.binding;
  if (binding.playerId !== request.playerId || binding.careerId !== appraisal.careerId
    || binding.personLinkSourceId !== request.personSourceId || binding.gameDay > appraisal.appraisal.atDay) {
    throw new Error('National exposure original participation scope or chronology differs');
  }
  const owner = personGenesisEvidenceFromSqlite(db), person = owner.read(request.personSourceId);
  const personLink = readClinicalPersonLink(db, request.personSourceId), careerDevelopmentSeed = owner.readDevelopmentSeed(binding.careerId);
  const genesis = db.prepare('SELECT * FROM world_person_genesis_careers WHERE career_id=?').get(binding.careerId);
  if (!person || !genesis || careerDevelopmentSeed === null || person.playerId !== binding.playerId
    || person.careerId !== binding.careerId || person.personId !== binding.personId || person.priors.createdAtDay > binding.gameDay
    || personLink.personId !== binding.personId || personLink.careerId !== binding.careerId || personLink.playerId !== binding.playerId
    || personLink.acceptedAtDay > binding.gameDay) throw new Error('National exposure original Person genesis differs');
  return { receipt, person, personLink, genesis, careerDevelopmentSeed };
};
export const resolveNationalExposureOrigin = (origin: NationalExposureOrigin): RecordedDevelopmentInitiation => {
  const { appraisal: accepted, policies, evidence, prior: history } = origin, person = evidence.person.priors;
  const binding = evidence.receipt.binding;
  const episode = startNationalExposureDevelopmentLearningEpisode(origin.request.episodeId,
    { careerId: binding.careerId, playerId: binding.playerId, occurredAtDay: binding.gameDay,
      sourceEventId: evidence.receipt.receiptId, competitionEditionId: binding.competitionEditionId, motifId: accepted.motifId },
    { careerId: person.catalyst.careerId, playerId: person.catalyst.playerId, createdAtDay: person.catalyst.createdAtDay,
      profileVersion: person.catalyst.profileVersion }, policies.learning);
  const prior = evaluateDevelopmentReceptivity(person.trajectory, accepted.domain, accepted.ageYears, accepted.appraisal.atDay, policies.receptivity);
  return resolveDevelopmentEpisodeInitiation({ episode, catalystProfile: person.catalyst, prior, appraisal: accepted.appraisal,
    policy: policies.initiation, careerDevelopmentSeed: evidence.careerDevelopmentSeed,
    ...deriveDevelopmentInitiationHistory(episode, accepted.appraisal.atDay, history), competingLearningLoad: accepted.competingLearningLoad });
};
export const nationalExposureOriginRow = (origin: NationalExposureOrigin): NationalExposureOriginRow => ({
  episode_id: origin.request.episodeId, career_id: origin.appraisal.careerId, player_id: origin.appraisal.playerId,
  game_id: origin.evidence.receipt.binding.gameId, participation_receipt_id: origin.request.participationReceiptId, appraisal_source_id: origin.appraisal.sourceId,
  source_version: origin.appraisal.sourceVersion, origin_json: json(origin), origin_hash: hash(origin),
});
export const nationalExposureOriginRequest = (origin: NationalExposureOrigin) => ({ kind: NATIONAL_EXPOSURE_DEVELOPMENT_KIND,
  ...origin.request, originHash: hash(origin) });

export const readNationalExposureDevelopmentBoundary = (db: DatabaseSync, initiation: PracticeInitiationRow) => {
  const saved = db.prepare('SELECT * FROM world_development_national_exposure_origins WHERE episode_id=?')
    .get(initiation.episode_id) as NationalExposureOriginRow | undefined;
  if (!saved) throw new Error('National exposure origin is missing');
  const origin = JSON.parse(saved.origin_json) as NationalExposureOrigin;
  if (!fields(origin, ['request', 'appraisal', 'policies', 'evidence', 'prior']) || json(nationalExposureOriginRow(origin)) !== json(saved)) {
    throw new Error('corrupt National exposure origin binding');
  }
  const request = validateNationalExposureRequest(origin.request);
  validateNationalExposureIntake(request, origin.appraisal, origin.policies);
  if (json(captureNationalExposureEvidence(db, request, origin.appraisal)) !== json(origin.evidence)
    || initiation.request_json !== json(nationalExposureOriginRequest(origin)) || initiation.episode_id !== request.episodeId
    || initiation.career_id !== origin.appraisal.careerId || initiation.player_id !== request.playerId
    || initiation.appraisal_source_id !== request.appraisalSourceId || initiation.at_day !== origin.appraisal.appraisal.atDay
    || initiation.prior_json !== json(origin.prior)) throw new Error('National exposure original source evidence differs');
  const initial = resolveNationalExposureOrigin(origin);
  if (initiation.assessment_json !== json(initial.assessment) || initiation.initial_json !== json(initial.episode)) {
    throw new Error('National exposure initial assessment replay differs');
  }
  return { origin, saved, initial };
};
