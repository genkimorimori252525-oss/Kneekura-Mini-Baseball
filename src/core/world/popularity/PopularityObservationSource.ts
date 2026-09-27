import type { AudienceObservation, FanFavoriteInput, FanFavoritePolicy,
  PopularityAudience, PopularityTransfer } from './FanFavorite';
import type { FreeAgentRightsEvent } from '../roster/FreeAgentContract';

/** Accepted by Career persistence before audience exposure is considered. */
export type AcceptedPublicCareerEvent = Readonly<{
  eventId: string;
  careerId: string;
  personId: string;
  kind: 'OFFICIAL_GAME' | 'AWARD' | 'TRANSFER' | 'PUBLIC_EVENT';
  sourceRecordId: string;
  acceptedRevision: number;
  occurredAtDay: number;
  acceptedAtDay: number;
  transfer: Readonly<{ fromClubId: string | null;
    toClubId: string | null }> | null;
}>;
export type AudienceResponseEvidence = Readonly<{
  evidenceId: string;
  sourceCareerEventId: string;
  audience: PopularityAudience;
  observedAtDay: number;
  availableAtDay: number;
  /** Observed share reached and audience response, both 0–1. */
  reach: number;
  response: number;
}>;
export type PopularityUpdatePolicy = Readonly<{
  policyId: string;
  version: string;
  availableAtDay: number;
  initialAwareness: number;
  initialFavorability: number;
  awarenessRate: number;
  favorabilityRate: number;
  maximumAwarenessStep: number;
  maximumFavorabilityStep: number;
}>;
export type PopularityHistory = Readonly<{
  careerId: string;
  personId: string;
  initialClubId: string | null;
  revision: number;
  effectiveDay: number;
  transfers: readonly PopularityTransfer[];
  observations: readonly AudienceObservation[];
  processedEvents: readonly Readonly<{
    eventId: string;
    kind: AcceptedPublicCareerEvent['kind'];
    sourceRecordId: string;
    acceptedRevision: number;
    acceptedAtDay: number;
    policyId: string;
    policyVersion: string;
    audienceEvidenceIds: readonly string[];
    audienceEvidence: readonly Readonly<{
      evidenceId: string;
      observedAtDay: number;
      availableAtDay: number;
    }>[];
  }>[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const optionalId = (value: unknown): value is string | null =>
  value === null || id(value);
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const unit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 1;
const unique = (items: readonly string[]): boolean =>
  new Set(items).size === items.length;
const fields = (value: unknown, keys: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
const audienceKey = (value: PopularityAudience): string =>
  JSON.stringify([value.kind, value.scopeId]);

export const createPopularityHistory = (careerId: string, personId: string,
  initialClubId: string | null): PopularityHistory => {
  if (!id(careerId) || !id(personId) || !optionalId(initialClubId)) {
    throw new Error('invalid popularity history identity');
  }
  return Object.freeze({ careerId, personId, initialClubId,
    revision: 0, effectiveDay: 0, transfers: Object.freeze([]),
    observations: Object.freeze([]), processedEvents: Object.freeze([]) });
};

/** A concrete accepted Career source for an unattached player's club arrival. */
export const adaptFreeAgentRightsEvent = (source: FreeAgentRightsEvent,
  personId: string, playerId: string): AcceptedPublicCareerEvent => {
  if (source.type !== 'FREE_AGENT_RIGHTS_ACQUIRED'
    || !id(personId) || !id(playerId) || source.playerId !== playerId
    || !id(source.eventId) || !id(source.careerId) || !id(source.clubId)
    || !id(source.sourceClubEventId) || !id(source.acceptanceId)
    || !day(source.effectiveDay)
    || !Number.isSafeInteger(source.beforeRevision)
    || source.beforeRevision < 0
    || source.afterRevision !== source.beforeRevision + 1
    || source.beforeRights.rightsHolderClubId !== null
    || source.beforeRights.contractId !== null
    || source.afterRights.rightsHolderClubId !== source.clubId
    || source.afterRights.contractId !== source.contractId) {
    throw new Error('invalid accepted free-agent rights source');
  }
  return Object.freeze({ eventId: source.eventId,
    careerId: source.careerId, personId, kind: 'TRANSFER',
    sourceRecordId: source.sourceClubEventId,
    acceptedRevision: source.afterRevision,
    occurredAtDay: source.effectiveDay,
    acceptedAtDay: source.effectiveDay,
    transfer: Object.freeze({ fromClubId: null, toClubId: source.clubId }) });
};

const validatePolicy = (policy: PopularityUpdatePolicy,
  asOfDay: number): void => {
  if (!fields(policy, ['policyId', 'version', 'availableAtDay',
    'initialAwareness', 'initialFavorability', 'awarenessRate',
    'favorabilityRate', 'maximumAwarenessStep', 'maximumFavorabilityStep'])
    || !id(policy.policyId) || !id(policy.version)
    || !day(policy.availableAtDay) || policy.availableAtDay > asOfDay
    || !unit(policy.initialAwareness) || !unit(policy.initialFavorability)
    || !unit(policy.awarenessRate) || !unit(policy.favorabilityRate)
    || !unit(policy.maximumAwarenessStep)
    || !unit(policy.maximumFavorabilityStep)) {
    throw new Error('invalid versioned popularity update policy');
  }
};

const currentClub = (state: PopularityHistory): string | null =>
  state.transfers.length > 0
    ? state.transfers[state.transfers.length - 1]!.toClubId
    : state.initialClubId;

const latest = (state: PopularityHistory, audience: PopularityAudience,
  metric: AudienceObservation['metric']): number | null => {
  const key = audienceKey(audience);
  const found = [...state.observations].reverse().find((item) =>
    audienceKey(item.audience) === key && item.metric === metric);
  return found?.value ?? null;
};

/** Updates sparse audience state from measured reach/response, never event-kind bonuses. */
export const appendPopularityExposure = (state: PopularityHistory,
  expectedRevision: number, event: AcceptedPublicCareerEvent,
  evidence: readonly AudienceResponseEvidence[],
  policy: PopularityUpdatePolicy, asOfDay: number): PopularityHistory => {
  validatePolicy(policy, asOfDay);
  if (!day(asOfDay) || asOfDay < state.effectiveDay
    || expectedRevision !== state.revision
    || !fields(event, ['eventId', 'careerId', 'personId', 'kind',
      'sourceRecordId', 'acceptedRevision', 'occurredAtDay',
      'acceptedAtDay', 'transfer'])
    || !id(event.eventId) || !id(event.sourceRecordId)
    || event.careerId !== state.careerId || event.personId !== state.personId
    || !['OFFICIAL_GAME', 'AWARD', 'TRANSFER', 'PUBLIC_EVENT'].includes(event.kind)
    || !Number.isSafeInteger(event.acceptedRevision)
    || event.acceptedRevision < 1
    || !day(event.occurredAtDay) || !day(event.acceptedAtDay)
    || event.occurredAtDay > event.acceptedAtDay
    || event.acceptedAtDay > asOfDay
    || state.processedEvents.some((item) => item.eventId === event.eventId
      || item.sourceRecordId === event.sourceRecordId)) {
    throw new Error('popularity Career event is duplicate, future, or mismatched');
  }
  if (event.kind === 'TRANSFER') {
    if (!fields(event.transfer, ['fromClubId', 'toClubId'])
      || !optionalId(event.transfer?.fromClubId)
      || !optionalId(event.transfer?.toClubId)
      || event.transfer?.fromClubId !== currentClub(state)
      || event.transfer?.toClubId === currentClub(state)
      || (state.transfers.length > 0
        && event.occurredAtDay < state.transfers[state.transfers.length - 1]!.atDay)) {
      throw new Error('popularity transfer does not match current club');
    }
  } else if (event.transfer !== null) {
    throw new Error('non-transfer popularity event carries a transfer');
  }
  if (!Array.isArray(evidence) || evidence.length === 0
    || !unique(evidence.map((item) => item.evidenceId))
    || !unique(evidence.map((item) => audienceKey(item.audience)))
    || evidence.some((item) => state.processedEvents.some((prior) =>
      prior.audienceEvidenceIds.includes(item.evidenceId)))) {
    throw new Error('popularity update requires distinct new audience evidence');
  }
  const observations: AudienceObservation[] = [];
  for (const item of evidence) {
    if (!fields(item, ['evidenceId', 'sourceCareerEventId', 'audience',
      'observedAtDay', 'availableAtDay', 'reach', 'response'])
      || !id(item.evidenceId)
      || item.sourceCareerEventId !== event.eventId
      || !fields(item.audience, ['kind', 'scopeId'])
      || !['CLUB_FANS', 'LOCAL_REGION', 'LEAGUE_WIDE',
        'NATIONAL', 'INTERNATIONAL'].includes(item.audience.kind)
      || !id(item.audience.scopeId)
      || !day(item.observedAtDay)
      || item.observedAtDay < event.occurredAtDay
      || !day(item.availableAtDay)
      || item.availableAtDay < item.observedAtDay
      || item.availableAtDay > asOfDay
      || !unit(item.reach) || item.reach === 0
      || !unit(item.response)) {
      throw new Error('audience reach or response was not observed in time');
    }
    const priorAwareness = latest(state, item.audience, 'AWARENESS')
      ?? policy.initialAwareness;
    const priorFavorability = latest(state, item.audience, 'FAVORABILITY')
      ?? policy.initialFavorability;
    const awarenessStep = Math.min(policy.maximumAwarenessStep,
      policy.awarenessRate * item.reach * (1 - priorAwareness));
    const rawFavorabilityStep = policy.favorabilityRate * item.reach
      * (item.response - priorFavorability);
    const favorabilityStep = Math.max(-policy.maximumFavorabilityStep,
      Math.min(policy.maximumFavorabilityStep, rawFavorabilityStep));
    for (const [metric, value] of [
      ['AWARENESS', Math.min(1, priorAwareness + awarenessStep)],
      ['FAVORABILITY', Math.max(0, Math.min(1,
        priorFavorability + favorabilityStep))],
    ] as const) {
      observations.push(Object.freeze({ evidenceId: `${item.evidenceId}:${metric}`,
        sourceCareerEventId: event.eventId, atDay: asOfDay,
        availableAtDay: asOfDay,
        evidencePolicyVersion: policy.version,
        audience: Object.freeze({ ...item.audience }), metric, value }));
    }
  }
  const transfer: PopularityTransfer | null = event.kind === 'TRANSFER'
    ? Object.freeze({ transferId: event.eventId,
      sourceCareerEventId: event.eventId, atDay: event.occurredAtDay,
      fromClubId: event.transfer!.fromClubId,
      toClubId: event.transfer!.toClubId }) : null;
  const processed = Object.freeze({ eventId: event.eventId, kind: event.kind,
    sourceRecordId: event.sourceRecordId,
    acceptedRevision: event.acceptedRevision,
    acceptedAtDay: event.acceptedAtDay,
    policyId: policy.policyId, policyVersion: policy.version,
    audienceEvidenceIds: Object.freeze(evidence.map((item) =>
      item.evidenceId).sort()),
    audienceEvidence: Object.freeze(evidence.map((item) => Object.freeze({
      evidenceId: item.evidenceId,
      observedAtDay: item.observedAtDay,
      availableAtDay: item.availableAtDay,
    })).sort((a, b) => a.evidenceId.localeCompare(b.evidenceId))) });
  return Object.freeze({ ...state, revision: state.revision + 1,
    effectiveDay: asOfDay,
    transfers: transfer ? Object.freeze([...state.transfers, transfer])
      : state.transfers,
    observations: Object.freeze([...state.observations, ...observations]),
    processedEvents: Object.freeze([...state.processedEvents, processed]) });
};

/** Historical descriptor input; later observations and transfers cannot leak backward. */
export const readFanFavoriteInputAt = (state: PopularityHistory,
  asOfDay: number, policy: FanFavoritePolicy): FanFavoriteInput => {
  if (!day(asOfDay)) throw new Error('invalid popularity history read day');
  return Object.freeze({ careerId: state.careerId, personId: state.personId,
    asOfDay, initialClubId: state.initialClubId,
    transfers: Object.freeze(state.transfers.filter((item) =>
      item.atDay <= asOfDay)),
    observations: Object.freeze(state.observations.filter((item) =>
      item.atDay <= asOfDay && item.availableAtDay <= asOfDay)),
    policy });
};
