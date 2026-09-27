/** Audience keys stay stable when a person changes clubs. */
export type PopularityAudience = Readonly<{
  kind: 'CLUB_FANS' | 'LOCAL_REGION' | 'LEAGUE_WIDE'
    | 'NATIONAL' | 'INTERNATIONAL';
  scopeId: string;
}>;

/** A scored observation, not a fixed reward for its source Career event. */
export type AudienceObservation = Readonly<{
  evidenceId: string;
  sourceCareerEventId: string;
  atDay: number;
  availableAtDay: number;
  evidencePolicyVersion: string;
  audience: PopularityAudience;
  metric: 'AWARENESS' | 'FAVORABILITY';
  value: number;
}>;
export type PopularityTransfer = Readonly<{
  transferId: string;
  sourceCareerEventId: string;
  atDay: number;
  fromClubId: string | null;
  toClubId: string | null;
}>;
export type FanFavoritePolicy = Readonly<{
  policyId: string;
  version: string;
  effectiveDay: number;
  minimumAwareness: number;
  minimumFavorability: number;
}>;
export type FanFavoriteInput = Readonly<{
  careerId: string;
  personId: string;
  asOfDay: number;
  initialClubId: string | null;
  transfers: readonly PopularityTransfer[];
  observations: readonly AudienceObservation[];
  policy: FanFavoritePolicy;
}>;
export type AudienceStanding = Readonly<{
  audience: PopularityAudience;
  awareness: number | null;
  favorability: number | null;
  fanFavorite: boolean;
  awarenessEvidenceId: string | null;
  favorabilityEvidenceId: string | null;
}>;
export type FanFavoriteProjection = Readonly<{
  boundary: 'CAREER_AUDIENCE_DESCRIPTOR_ONLY';
  careerId: string;
  personId: string;
  asOfDay: number;
  currentClubId: string | null;
  audiences: readonly AudienceStanding[];
  provenance: Readonly<{
    policy: Readonly<{ policyId: string; version: string }>;
    transferIds: readonly string[];
    evidenceIds: readonly string[];
    sourceCareerEventIds: readonly string[];
  }>;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const unit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 1;
const fields = (value: unknown, keys: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
const optionalId = (value: unknown): value is string | null =>
  value === null || id(value);
const audienceKey = (audience: PopularityAudience): string =>
  JSON.stringify([audience.kind, audience.scopeId]);

function validate(input: FanFavoriteInput): void {
  if (!fields(input, ['careerId', 'personId', 'asOfDay',
    'initialClubId', 'transfers', 'observations', 'policy'])
    || !id(input.careerId) || !id(input.personId)
    || !day(input.asOfDay) || !optionalId(input.initialClubId)
    || !Array.isArray(input.transfers)
    || !Array.isArray(input.observations)) {
    throw new Error('invalid fan favorite input');
  }
  const p = input.policy;
  if (!fields(p, ['policyId', 'version', 'effectiveDay',
    'minimumAwareness', 'minimumFavorability'])
    || !id(p.policyId) || !id(p.version)
    || !day(p.effectiveDay) || p.effectiveDay > input.asOfDay
    || !unit(p.minimumAwareness) || !unit(p.minimumFavorability)) {
    throw new Error('invalid fan favorite policy');
  }
  const transferIds = new Set<string>();
  let clubId = input.initialClubId;
  let previousTransferDay = -1;
  for (const transfer of input.transfers) {
    if (!fields(transfer, ['transferId', 'sourceCareerEventId',
      'atDay', 'fromClubId', 'toClubId'])
      || !id(transfer.transferId)
      || transferIds.has(transfer.transferId)
      || !id(transfer.sourceCareerEventId)
      || !day(transfer.atDay) || transfer.atDay > input.asOfDay
      || transfer.atDay < previousTransferDay
      || !optionalId(transfer.fromClubId)
      || !optionalId(transfer.toClubId)
      || transfer.fromClubId !== clubId
      || transfer.toClubId === clubId) {
      throw new Error('invalid popularity transfer history');
    }
    transferIds.add(transfer.transferId);
    previousTransferDay = transfer.atDay;
    clubId = transfer.toClubId;
  }
  const evidenceIds = new Set<string>();
  for (const observation of input.observations) {
    if (!fields(observation, ['evidenceId', 'sourceCareerEventId',
      'atDay', 'availableAtDay', 'evidencePolicyVersion',
      'audience', 'metric', 'value'])
      || !id(observation.evidenceId)
      || evidenceIds.has(observation.evidenceId)
      || !id(observation.sourceCareerEventId)
      || !day(observation.atDay)
      || observation.atDay > input.asOfDay
      || !day(observation.availableAtDay)
      || observation.availableAtDay < observation.atDay
      || !id(observation.evidencePolicyVersion)
      || !fields(observation.audience, ['kind', 'scopeId'])
      || !['CLUB_FANS', 'LOCAL_REGION', 'LEAGUE_WIDE',
        'NATIONAL', 'INTERNATIONAL'].includes(observation.audience.kind)
      || !id(observation.audience.scopeId)
      || !['AWARENESS', 'FAVORABILITY'].includes(observation.metric)
      || !unit(observation.value)) {
      throw new Error('invalid audience observation');
    }
    evidenceIds.add(observation.evidenceId);
  }
}

/** Reprojects audience descriptors from observed Career evidence only. */
export function projectFanFavorite(input: FanFavoriteInput): FanFavoriteProjection {
  validate(input);
  const visible = input.observations.filter((item) =>
    item.availableAtDay <= input.asOfDay)
    .sort((a, b) => a.availableAtDay - b.availableAtDay
      || a.atDay - b.atDay || a.evidenceId.localeCompare(b.evidenceId));
  const standings = new Map<string, AudienceStanding>();
  for (const observation of visible) {
    const key = audienceKey(observation.audience);
    const prior = standings.get(key) ?? {
      audience: observation.audience, awareness: null,
      favorability: null, fanFavorite: false,
      awarenessEvidenceId: null, favorabilityEvidenceId: null,
    };
    standings.set(key, observation.metric === 'AWARENESS'
      ? { ...prior, awareness: observation.value,
        awarenessEvidenceId: observation.evidenceId }
      : { ...prior, favorability: observation.value,
        favorabilityEvidenceId: observation.evidenceId });
  }
  const audiences = [...standings.values()].map((standing) => ({
    ...standing, fanFavorite: standing.awareness !== null
      && standing.favorability !== null
      && standing.awareness >= input.policy.minimumAwareness
      && standing.favorability >= input.policy.minimumFavorability,
  })).sort((a, b) => audienceKey(a.audience)
    .localeCompare(audienceKey(b.audience)));
  const sourceCareerEventIds = new Set([
    ...input.transfers.map((transfer) => transfer.sourceCareerEventId),
    ...visible.map((observation) => observation.sourceCareerEventId),
  ]);
  return {
    boundary: 'CAREER_AUDIENCE_DESCRIPTOR_ONLY',
    careerId: input.careerId, personId: input.personId,
    asOfDay: input.asOfDay,
    currentClubId: input.transfers.length
      ? input.transfers[input.transfers.length - 1]!.toClubId
      : input.initialClubId,
    audiences,
    provenance: { policy: { policyId: input.policy.policyId,
      version: input.policy.version },
    transferIds: input.transfers.map((transfer) => transfer.transferId),
    evidenceIds: visible.map((observation) => observation.evidenceId).sort(),
    sourceCareerEventIds: [...sourceCareerEventIds].sort() },
  };
}
