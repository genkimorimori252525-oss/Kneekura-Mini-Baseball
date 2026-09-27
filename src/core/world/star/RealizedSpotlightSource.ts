import type { DevelopmentLearningEpisode } from
  '../development/DevelopmentLearningEpisode';
import type { StarGenesisProfile } from '../development/StarGenesis';
import type { RealizedSpotlightResponse } from './SpotlightAppraisal';

type ResponseAxes = Pick<RealizedSpotlightResponse,
  'activation' | 'stability' | 'pressureConversion'>;
export type RealizedSpotlightPolicy = Readonly<{
  policyId: string;
  version: string;
  profileVersion: string;
  availableAtDay: number;
  initialResponse: ResponseAxes;
  minimumImportance: number;
  minimumMatches: number;
  minimumObservationSpanDays: number;
  learningFraction: number;
  potentialSensitivity: number;
}>;
export type RealizedSpotlightObservation = Readonly<{
  observationId: string;
  matchId: string;
  sourceEventId: string;
  atDay: number;
  importance: number;
  activation: number;
  stability: number;
  pressureConversion: number;
}>;
export type RealizedSpotlightChange = Readonly<{
  episodeId: string;
  effectiveDay: number;
  policyId: string;
  policyVersion: string;
  profileVersion: string;
  genesisProfileVersion: string;
  learningProfileVersion: string;
  consolidationSourceEventId: string;
  learningSourceEventIds: readonly string[];
  observationSourceEventIds: readonly string[];
  matchIds: readonly string[];
  before: ResponseAxes;
  after: ResponseAxes;
}>;
/** Career-owned state. Hidden potential is omitted from the Match-readable profile. */
export type RealizedSpotlightSource = Readonly<{
  careerId: string;
  playerId: string;
  createdAtDay: number;
  effectiveDay: number;
  revision: number;
  hiddenPotential: Readonly<ResponseAxes & {
    genesisProfileVersion: string;
    genesisPolicyId: string;
  }>;
  profile: RealizedSpotlightResponse;
  records: readonly RealizedSpotlightChange[];
}>;

const axes = ['activation', 'stability', 'pressureConversion'] as const;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const unit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 1;
const positiveUnit = (value: unknown): value is number =>
  unit(value) && value > 0;
const unique = (items: readonly string[]): boolean =>
  items.length === new Set(items).size;
const values = (source: ResponseAxes): ResponseAxes =>
  Object.freeze({ activation: source.activation,
    stability: source.stability,
    pressureConversion: source.pressureConversion });

function validatePolicy(policy: RealizedSpotlightPolicy,
  atDay: number): void {
  if (!policy || !id(policy.policyId) || !id(policy.version)
    || !id(policy.profileVersion)
    || !day(policy.availableAtDay)
    || policy.availableAtDay > atDay
    || !policy.initialResponse
    || axes.some(axis => !unit(policy.initialResponse[axis]))
    || !positiveUnit(policy.minimumImportance)
    || !Number.isSafeInteger(policy.minimumMatches)
    || policy.minimumMatches < 2
    || !Number.isSafeInteger(policy.minimumObservationSpanDays)
    || policy.minimumObservationSpanDays <= 0
    || !positiveUnit(policy.learningFraction)
    || !unit(policy.potentialSensitivity)
    || policy.learningFraction * (1 + policy.potentialSensitivity / 2) > 1) {
    throw new Error('invalid realized spotlight policy');
  }
}

/** Genesis tier does not set the initial Match-visible response. */
export function createRealizedSpotlightSource(
  genesis: StarGenesisProfile,
  policy: RealizedSpotlightPolicy,
): RealizedSpotlightSource {
  if (!genesis || !id(genesis.careerId)
    || !id(genesis.playerId) || !day(genesis.createdAtDay)
    || !id(genesis.profileVersion)
    || !id(genesis.generation?.policyId)
    || !unit(genesis.spotlightPotential)
    || !unit(genesis.pressureStabilityPotential)
    || !unit(genesis.pressureConversionPotential)) {
    throw new Error('invalid star genesis source');
  }
  validatePolicy(policy, genesis.createdAtDay);
  const profile: RealizedSpotlightResponse = Object.freeze({
    careerId: genesis.careerId, playerId: genesis.playerId,
    profileVersion: policy.profileVersion,
    effectiveDay: genesis.createdAtDay,
    ...values(policy.initialResponse),
  });
  return Object.freeze({ careerId: genesis.careerId,
    playerId: genesis.playerId, createdAtDay: genesis.createdAtDay,
    effectiveDay: genesis.createdAtDay, revision: 0,
    hiddenPotential: Object.freeze({
      activation: genesis.spotlightPotential,
      stability: genesis.pressureStabilityPotential,
      pressureConversion: genesis.pressureConversionPotential,
      genesisProfileVersion: genesis.profileVersion,
      genesisPolicyId: genesis.generation.policyId,
    }),
    profile, records: Object.freeze([]),
  });
}

/** Match receives only the realized profile after its effective day. */
export function selectRealizedSpotlightResponse(
  source: RealizedSpotlightSource,
  atDay: number,
): RealizedSpotlightResponse {
  if (!source || !day(atDay) || atDay < source.effectiveDay) {
    throw new Error('realized spotlight response unavailable at requested day');
  }
  return source.profile;
}

function validateEpisode(source: RealizedSpotlightSource,
  episode: DevelopmentLearningEpisode): void {
  const first = episode?.events?.[0];
  const last = episode?.events?.at(-1);
  if (!episode || episode.careerId !== source.careerId
    || episode.playerId !== source.playerId
    || !id(episode.episodeId) || !id(episode.profileVersion)
    || episode.stage !== 'CONSOLIDATED'
    || episode.domain !== 'BEHAVIOR'
    || !day(episode.startedAtDay) || !day(episode.effectiveDay)
    || episode.startedAtDay < source.effectiveDay
    || episode.effectiveDay < episode.startedAtDay
    || !Array.isArray(episode.events)
    || episode.events.length !== episode.revision + 1
    || first?.kind !== 'CATALYST'
    || first.sourceEventId !== episode.catalyst?.sourceEventId
    || last?.kind !== 'CONSOLIDATION_RECORDED'
    || last.domain !== 'BEHAVIOR'
    || last.atDay !== episode.effectiveDay
    || !Array.isArray(episode.practiceSourceEventIds)
    || !Array.isArray(episode.feedbackSourceEventIds)
    || episode.practiceSourceEventIds.length
      < episode.policy.minimumPracticeEvents
    || episode.feedbackSourceEventIds.length
      < episode.policy.minimumFeedbackEvents
    || episode.effectiveDay - episode.startedAtDay
      < episode.policy.minimumElapsedDays
    || episode.events.filter(event => event.kind === 'PRACTICE_RECORDED')
      .map(event => event.sourceEventId).join('\0')
      !== episode.practiceSourceEventIds.join('\0')
    || episode.events.filter(event => event.kind === 'FEEDBACK_RECORDED')
      .map(event => event.sourceEventId).join('\0')
      !== episode.feedbackSourceEventIds.join('\0')) {
    throw new Error('realized spotlight response requires consolidated behavior episode');
  }
}

/** Evidence updates only the Career-owned response; no label or raw ability is written. */
export function applyRealizedSpotlightEvidence(
  source: RealizedSpotlightSource,
  expectedRevision: number,
  episode: DevelopmentLearningEpisode,
  observations: readonly RealizedSpotlightObservation[],
  policy: RealizedSpotlightPolicy,
  asOfDay: number,
): RealizedSpotlightSource {
  if (!source || expectedRevision !== source.revision
    || !day(asOfDay) || asOfDay < source.effectiveDay
    || !id(source.careerId) || !id(source.playerId)
    || !day(source.createdAtDay)
    || !day(source.effectiveDay)
    || source.effectiveDay < source.createdAtDay
    || !source.profile
    || source.profile.careerId !== source.careerId
    || source.profile.playerId !== source.playerId
    || source.profile.effectiveDay !== source.effectiveDay
    || !id(source.profile.profileVersion)
    || axes.some(axis => !unit(source.profile[axis]))
    || !source.hiddenPotential
    || !id(source.hiddenPotential.genesisProfileVersion)
    || !id(source.hiddenPotential.genesisPolicyId)
    || axes.some(axis => !unit(source.hiddenPotential[axis]))
    || !Array.isArray(source.records)
    || source.records.length !== source.revision
    || !unique(source.records.map(record => record.episodeId))
    || (source.records.length > 0 && (
      source.records.at(-1)!.effectiveDay !== source.effectiveDay
      || source.records.at(-1)!.profileVersion
        !== source.profile.profileVersion
      || axes.some(axis => source.records.at(-1)!.after[axis]
        !== source.profile[axis])))
    || source.records.some(record => record.episodeId === episode?.episodeId)) {
    throw new Error('stale or reused realized spotlight source');
  }
  validateEpisode(source, episode);
  validatePolicy(policy, episode.startedAtDay);
  if (!Array.isArray(observations)
    || observations.length < policy.minimumMatches
    || !unique(observations.map(item => item?.observationId))
    || !unique(observations.map(item => item?.matchId))
    || !unique(observations.map(item => item?.sourceEventId))
    || observations.some(item => !id(item?.observationId)
      || !id(item.matchId) || !id(item.sourceEventId)
      || !day(item.atDay) || item.atDay < episode.effectiveDay
      || item.atDay > asOfDay
      || !unit(item.importance)
      || item.importance < policy.minimumImportance
      || axes.some(axis => !unit(item[axis])))) {
    throw new Error('insufficient high-stage spotlight observations');
  }
  const ordered = [...observations].sort((a, b) => a.atDay - b.atDay
    || a.observationId.localeCompare(b.observationId));
  const effectiveDay = ordered[ordered.length - 1]!.atDay;
  if (effectiveDay - ordered[0]!.atDay
    < policy.minimumObservationSpanDays) {
    throw new Error('spotlight observation span too short');
  }
  const potential = source.hiddenPotential;
  const before = values(source.profile);
  const response = Object.fromEntries(axes.map(axis => {
    const observed = ordered.reduce((sum, item) => sum + item[axis], 0)
      / ordered.length;
    const fraction = policy.learningFraction
      * (1 + policy.potentialSensitivity * (potential[axis] - 0.5));
    return [axis, before[axis] + fraction * (observed - before[axis])];
  })) as ResponseAxes;
  const after = values(response);
  const profile: RealizedSpotlightResponse = Object.freeze({
    careerId: source.careerId, playerId: source.playerId,
    profileVersion: policy.profileVersion,
    effectiveDay, ...after,
  });
  const record: RealizedSpotlightChange = Object.freeze({
    episodeId: episode.episodeId, effectiveDay,
    policyId: policy.policyId, policyVersion: policy.version,
    profileVersion: policy.profileVersion,
    genesisProfileVersion: potential.genesisProfileVersion,
    learningProfileVersion: episode.profileVersion,
    consolidationSourceEventId: episode.events.at(-1)!.sourceEventId,
    learningSourceEventIds: Object.freeze(episode.events.map(event =>
      event.sourceEventId)),
    observationSourceEventIds: Object.freeze(ordered.map(item =>
      item.sourceEventId)),
    matchIds: Object.freeze(ordered.map(item => item.matchId)),
    before, after,
  });
  return Object.freeze({ ...source, effectiveDay,
    revision: source.revision + 1, profile,
    records: Object.freeze([...source.records, record]),
  });
}
