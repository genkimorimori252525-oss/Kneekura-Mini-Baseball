import { readPlayerKnowledgeAt, type ClubScoutingKnowledge } from '../scouting/ScoutingKnowledge';

export type HeadlineRatingPolicy = Readonly<{
  policyId: string;
  version: string;
  projectionVersion: string;
  availableAtDay: number;
  minimumRolePopulation: number;
  /** Points of the 0–999 display scale per weighted projection point. */
  pointsPerRatingPoint: number;
  roles: readonly Readonly<{
    roleId: string;
    domains: readonly Readonly<{ domainId: string; weight: number }>[];
  }>[];
}>;

export type LeaguePopulationPlayer = Readonly<{
  playerId: string;
  affiliationLeagueId: string;
  roleId: string;
  publicProjectionSourceId: string;
  /** Public projection values, on the policy's 0–100 domain scale. */
  ratings: Readonly<Record<string, number>>;
}>;

export type LeagueRatingReference = Readonly<{
  atDay: number;
  populationMembers: readonly Readonly<{
    playerId: string;
    roleId: string;
    publicProjectionSourceId: string;
    projectionFingerprint: string;
  }>[];
  roleBenchmarks: readonly Readonly<{
    roleId: string;
    playerCount: number;
    aggregateMean: number;
  }>[];
  provenance: Readonly<{
    leagueId: string;
    playerPopulationSnapshotId: string;
    projectionVersion: string;
    policyId: string;
    policyVersion: string;
    sourceSnapshotIds: readonly string[];
  }>;
}>;

export type HeadlineProjection = Readonly<{
  headline: number;
  ratingContextLeagueId: string;
  roleId: string;
  referencePopulationSnapshotId: string;
  policyId: string;
  policyVersion: string;
  projectionVersion: string;
  sourceId: string;
}>;

export type ScoutingHeadlineProjection = Readonly<Omit<HeadlineProjection, 'sourceId'> & {
  range: readonly [number, number];
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reportId: string;
  reportAvailableAtDay: number;
  evidenceSourceIds: readonly string[];
}>;

const validId = (value: string): boolean =>
  typeof value === 'string' && value.length > 0;
const validDay = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
const unique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

const validatePolicy = (policy: HeadlineRatingPolicy): void => {
  if (!validId(policy.policyId) || !validId(policy.version)
    || !validId(policy.projectionVersion) || !validDay(policy.availableAtDay)
    || !Number.isSafeInteger(policy.minimumRolePopulation)
    || policy.minimumRolePopulation < 1
    || !Number.isFinite(policy.pointsPerRatingPoint)
    || policy.pointsPerRatingPoint <= 0
    || !Array.isArray(policy.roles) || policy.roles.length === 0
    || !unique(policy.roles.map((role) => role.roleId))) {
    throw new Error('invalid headline rating policy');
  }
  for (const role of policy.roles) {
    if (!validId(role.roleId) || !Array.isArray(role.domains)
      || role.domains.length === 0
      || !unique(role.domains.map((domain: HeadlineRatingPolicy['roles'][number]['domains'][number]) => domain.domainId))
      || role.domains.some((domain: HeadlineRatingPolicy['roles'][number]['domains'][number]) => !validId(domain.domainId)
        || !Number.isFinite(domain.weight) || domain.weight <= 0)) {
      throw new Error('invalid headline rating role policy');
    }
  }
};

const rolePolicy = (policy: HeadlineRatingPolicy, roleId: string) => {
  const role = policy.roles.find((item) => item.roleId === roleId);
  if (!role) throw new Error('headline rating role is not in policy');
  return role;
};

const aggregate = (ratings: Readonly<Record<string, number>>,
  role: HeadlineRatingPolicy['roles'][number]): number => {
  let weighted = 0;
  let totalWeight = 0;
  for (const domain of role.domains) {
    const value = ratings[domain.domainId];
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error('headline rating requires complete 0–100 projection');
    }
    weighted += value * domain.weight;
    totalWeight += domain.weight;
  }
  return weighted / totalWeight;
};

const projectionFingerprint = (ratings: Readonly<Record<string, number>>,
  role: HeadlineRatingPolicy['roles'][number]): string =>
  JSON.stringify(role.domains.map((domain) =>
    [domain.domainId, ratings[domain.domainId]]));

const validateReference = (reference: LeagueRatingReference,
  policy: HeadlineRatingPolicy, asOfDay: number): void => {
  validatePolicy(policy);
  if (!validDay(asOfDay) || !validDay(reference.atDay)
    || policy.availableAtDay > reference.atDay
    || reference.atDay > asOfDay
    || reference.provenance.policyId !== policy.policyId
    || reference.provenance.policyVersion !== policy.version
    || reference.provenance.projectionVersion !== policy.projectionVersion) {
    throw new Error('headline reference or policy is unavailable or mismatched');
  }
};

const benchmarkFor = (reference: LeagueRatingReference,
  roleId: string): number => {
  const benchmark = reference.roleBenchmarks.find((item) => item.roleId === roleId);
  if (!benchmark) throw new Error('league role population is insufficient');
  return benchmark.aggregateMean;
};

const headline = (score: number, benchmark: number,
  policy: HeadlineRatingPolicy): number =>
  Math.max(0, Math.min(999,
    Math.round(500 + (score - benchmark) * policy.pointsPerRatingPoint)));

/** A population snapshot supplies the reference; individual ratings are not retained in it. */
export const createLeagueRatingReference = (source: Readonly<{
  leagueId: string;
  playerPopulationSnapshotId: string;
  projectionVersion: string;
  atDay: number;
  population: readonly LeaguePopulationPlayer[];
}>, policy: HeadlineRatingPolicy): LeagueRatingReference => {
  validatePolicy(policy);
  if (!validId(source.leagueId) || !validId(source.playerPopulationSnapshotId)
    || !validDay(source.atDay) || policy.availableAtDay > source.atDay
    || source.projectionVersion !== policy.projectionVersion
    || !Array.isArray(source.population) || source.population.length === 0
    || !unique(source.population.map((player) => player.playerId))
    || !unique(source.population.map((player) => player.publicProjectionSourceId))) {
    throw new Error('invalid league rating population snapshot');
  }
  for (const player of source.population) {
    if (!validId(player.playerId) || !validId(player.publicProjectionSourceId)
      || player.affiliationLeagueId !== source.leagueId) {
      throw new Error('league rating population has invalid affiliation or source');
    }
    aggregate(player.ratings, rolePolicy(policy, player.roleId));
  }
  const populationMembers = source.population.map((player) => ({
    playerId: player.playerId, roleId: player.roleId,
    publicProjectionSourceId: player.publicProjectionSourceId,
    projectionFingerprint: projectionFingerprint(player.ratings,
      rolePolicy(policy, player.roleId)),
  })).sort((a, b) => a.playerId.localeCompare(b.playerId));
  const roleBenchmarks = policy.roles.map((role) => {
    const players = source.population.filter((player) => player.roleId === role.roleId);
    return players.length >= policy.minimumRolePopulation
      ? { roleId: role.roleId, playerCount: players.length,
        aggregateMean: players.reduce((sum, player) =>
          sum + aggregate(player.ratings, role), 0) / players.length }
      : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.roleId.localeCompare(b.roleId));
  if (roleBenchmarks.length === 0) {
    throw new Error('league rating population has no sufficient role cohort');
  }
  return Object.freeze({ atDay: source.atDay,
    populationMembers: Object.freeze(populationMembers.map((item) => Object.freeze(item))),
    roleBenchmarks: Object.freeze(roleBenchmarks.map((item) => Object.freeze(item))),
    provenance: Object.freeze({ leagueId: source.leagueId,
      playerPopulationSnapshotId: source.playerPopulationSnapshotId,
      projectionVersion: source.projectionVersion, policyId: policy.policyId,
      policyVersion: policy.version,
      sourceSnapshotIds: Object.freeze(source.population
        .map((player) => player.publicProjectionSourceId).sort()) }) });
};

/** Affiliated players always use their affiliation league's population reference. */
export const projectAffiliatedHeadline = (player: LeaguePopulationPlayer,
  reference: LeagueRatingReference,
  policy: HeadlineRatingPolicy): HeadlineProjection => {
  validateReference(reference, policy, reference.atDay);
  if (player.affiliationLeagueId !== reference.provenance.leagueId
    || !validId(player.playerId) || !validId(player.publicProjectionSourceId)) {
    throw new Error('headline player affiliation or projection source mismatch');
  }
  const score = aggregate(player.ratings, rolePolicy(policy, player.roleId));
  const member = reference.populationMembers.find((item) =>
    item.playerId === player.playerId);
  if (!member || member.roleId !== player.roleId
    || member.publicProjectionSourceId !== player.publicProjectionSourceId
    || !reference.provenance.sourceSnapshotIds.includes(player.publicProjectionSourceId)
    || member.projectionFingerprint !== projectionFingerprint(player.ratings,
      rolePolicy(policy, player.roleId))) {
    throw new Error('headline player is not the pinned population projection');
  }
  return Object.freeze({ headline: headline(score,
    benchmarkFor(reference, player.roleId), policy),
    ratingContextLeagueId: reference.provenance.leagueId,
    roleId: player.roleId,
    referencePopulationSnapshotId: reference.provenance.playerPopulationSnapshotId,
    policyId: policy.policyId, policyVersion: policy.version,
    projectionVersion: policy.projectionVersion,
    sourceId: player.publicProjectionSourceId });
};

/** A target projection consumes only the evaluating club's available report estimates. */
export const projectScoutingTargetHeadline = (source: Readonly<{
  careerId: string;
  evaluatingClubId: string;
  evaluatingClubLeagueId: string;
  targetPlayerId: string;
  roleId: string;
  asOfDay: number;
  knowledge: ClubScoutingKnowledge;
}>, reference: LeagueRatingReference,
policy: HeadlineRatingPolicy): ScoutingHeadlineProjection | null => {
  validateReference(reference, policy, source.asOfDay);
  if (!validId(source.careerId) || !validId(source.evaluatingClubId)
    || !validId(source.targetPlayerId)
    || source.evaluatingClubLeagueId !== reference.provenance.leagueId
    || source.knowledge.careerId !== source.careerId
    || source.knowledge.clubId !== source.evaluatingClubId) {
    throw new Error('scouting headline context mismatch');
  }
  const role = rolePolicy(policy, source.roleId);
  const known = readPlayerKnowledgeAt(source.knowledge,
    source.targetPlayerId, source.asOfDay);
  if (!known) return null;
  const { report } = known;
  if (report.careerId !== source.careerId
    || report.clubId !== source.evaluatingClubId
    || report.playerId !== source.targetPlayerId
    || !validDay(report.observedAtDay)
    || !validDay(report.availableAtDay)
    || report.observedAtDay > report.availableAtDay
    || report.availableAtDay > source.asOfDay
    || !Array.isArray(report.evidenceSourceIds)
    || report.evidenceSourceIds.length === 0
    || !unique(report.evidenceSourceIds)
    || report.evidenceSourceIds.some((id) => !source.knowledge.evidence.some((item) =>
      item.evidenceId === id && item.careerId === report.careerId
      && item.clubId === report.clubId && item.playerId === report.playerId
      && validDay(item.observedAtDay) && validDay(item.availableAtDay)
      && item.observedAtDay <= item.availableAtDay
      && item.availableAtDay <= report.availableAtDay))
    || Math.max(...report.evidenceSourceIds.map((id) =>
      source.knowledge.evidence.find((item) => item.evidenceId === id)!
        .observedAtDay)) !== report.observedAtDay) {
    throw new Error('scouting headline report has invalid evidence provenance');
  }
  const lower: Record<string, number> = {};
  const upper: Record<string, number> = {};
  for (const domain of role.domains) {
    const estimate = report.estimate.find((item) => item.domainId === domain.domainId);
    if (!estimate) return null;
    if (!Number.isFinite(estimate.lower) || !Number.isFinite(estimate.upper)
      || estimate.lower < 0 || estimate.upper > 100
      || estimate.lower > estimate.upper) {
      throw new Error('scouting headline estimate is outside policy domain scale');
    }
    lower[domain.domainId] = estimate.lower;
    upper[domain.domainId] = estimate.upper;
  }
  const benchmark = benchmarkFor(reference, source.roleId);
  const low = headline(aggregate(lower, role), benchmark, policy);
  const high = headline(aggregate(upper, role), benchmark, policy);
  return Object.freeze({ headline: headline(
    (aggregate(lower, role) + aggregate(upper, role)) / 2,
    benchmark, policy), range: Object.freeze([low, high]) as readonly [number, number],
    confidence: report.confidence, reportId: report.reportId,
    reportAvailableAtDay: report.availableAtDay,
    evidenceSourceIds: Object.freeze([...report.evidenceSourceIds]),
    ratingContextLeagueId: reference.provenance.leagueId,
    roleId: source.roleId,
    referencePopulationSnapshotId: reference.provenance.playerPopulationSnapshotId,
    policyId: policy.policyId, policyVersion: policy.version,
    projectionVersion: policy.projectionVersion });
};
