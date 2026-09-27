import type { ClubWorldState } from '../club/ClubTypes';
import type { RosterState } from '../roster/RosterTypes';
import type { ClubScoutingKnowledge } from '../scouting/ScoutingKnowledge';
import { createLeagueRatingReference, projectScoutingTargetHeadline,
  type HeadlineRatingPolicy, type LeaguePopulationPlayer,
  type LeagueRatingReference, type ScoutingHeadlineProjection,
} from './HeadlinePlayerRating';

export type PublicPlayerProjection = Readonly<{
  projectionId: string;
  playerId: string;
  roleId: string;
  observedAtDay: number;
  availableAtDay: number;
  sourceEventIds: readonly string[];
  ratings: Readonly<Record<string, number>>;
}>;

export type PublicProjectionSnapshot = Readonly<{
  snapshotId: string;
  careerId: string;
  projectionVersion: string;
  atDay: number;
  records: readonly PublicPlayerProjection[];
}>;

export type WorldHeadlineReferenceSnapshot = Readonly<{
  atDay: number;
  references: readonly LeagueRatingReference[];
  clubLeagues: readonly Readonly<{ clubId: string; leagueId: string }>[];
  provenance: Readonly<{
    snapshotId: string;
    careerId: string;
    rosterRevision: number;
    rosterEffectiveDay: number;
    publicProjectionSnapshotId: string;
    projectionVersion: string;
    policyId: string;
    policyVersion: string;
    clubRevisions: readonly Readonly<{
      clubId: string;
      revision: number;
      effectiveDay: number;
    }>[];
  }>;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const onlyFields = (value: unknown, allowed: readonly string[]): void => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error('public projection contains invalid or nonpublic fields');
  }
};
const unique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

/** Trusted public source boundary; hidden player fields are rejected rather than copied. */
export const createPublicProjectionSnapshot = (input: Readonly<{
  snapshotId: string;
  careerId: string;
  projectionVersion: string;
  atDay: number;
  records: readonly PublicPlayerProjection[];
}>): PublicProjectionSnapshot => {
  onlyFields(input, ['snapshotId', 'careerId', 'projectionVersion', 'atDay', 'records']);
  if (!id(input.snapshotId) || !id(input.careerId)
    || !id(input.projectionVersion) || !day(input.atDay)
    || !Array.isArray(input.records)
    || !unique(input.records.map((record) => record.playerId))
    || !unique(input.records.map((record) => record.projectionId))) {
    throw new Error('invalid public projection snapshot');
  }
  const records = input.records.map((record: PublicPlayerProjection) => {
    onlyFields(record, ['projectionId', 'playerId', 'roleId',
      'observedAtDay', 'availableAtDay', 'sourceEventIds', 'ratings']);
    if (!id(record.projectionId) || !id(record.playerId) || !id(record.roleId)
      || !day(record.observedAtDay) || !day(record.availableAtDay)
      || record.observedAtDay > record.availableAtDay
      || record.availableAtDay > input.atDay
      || !Array.isArray(record.sourceEventIds)
      || record.sourceEventIds.length === 0
      || !record.sourceEventIds.every(id)
      || !unique(record.sourceEventIds)) {
      throw new Error('public projection source is duplicate, future, or uncited');
    }
    if (record.ratings === null || typeof record.ratings !== 'object'
      || Array.isArray(record.ratings)) {
      throw new Error('public projection ratings must be a domain record');
    }
    const ratings = Object.entries(record.ratings);
    if (ratings.length === 0 || ratings.some(([domainId, value]) =>
      !id(domainId) || !Number.isFinite(value) || value < 0 || value > 100)) {
      throw new Error('public projection requires valid domain ratings');
    }
    return Object.freeze({ projectionId: record.projectionId,
      playerId: record.playerId, roleId: record.roleId,
      observedAtDay: record.observedAtDay, availableAtDay: record.availableAtDay,
      sourceEventIds: Object.freeze([...record.sourceEventIds]),
      ratings: Object.freeze(Object.fromEntries(ratings)) });
  });
  return Object.freeze({ snapshotId: input.snapshotId, careerId: input.careerId,
    projectionVersion: input.projectionVersion, atDay: input.atDay,
    records: Object.freeze(records) });
};

/** Build every league reference from one roster, club, and public projection cut. */
export const createWorldHeadlineReferenceSnapshot = (input: Readonly<{
  snapshotId: string;
  asOfDay: number;
  roster: RosterState;
  clubs: readonly ClubWorldState[];
  publicProjectionSnapshot: PublicProjectionSnapshot;
}>, policy: HeadlineRatingPolicy): WorldHeadlineReferenceSnapshot => {
  const { roster, clubs } = input;
  const publicSnapshot = createPublicProjectionSnapshot(input.publicProjectionSnapshot);
  if (!id(input.snapshotId) || !day(input.asOfDay)
    || !day(roster.effectiveDay) || roster.effectiveDay > input.asOfDay
    || !day(publicSnapshot.atDay) || publicSnapshot.atDay > input.asOfDay
    || roster.careerId !== publicSnapshot.careerId
    || publicSnapshot.projectionVersion !== policy.projectionVersion
    || !Array.isArray(clubs) || clubs.length === 0
    || !unique(clubs.map((club) => club.identity.clubId))) {
    throw new Error('headline world source cut is inconsistent or future');
  }
  const clubById = new Map(clubs.map((club) => [club.identity.clubId, club]));
  for (const club of clubs) {
    if (club.careerId !== roster.careerId
      || !day(club.effectiveDay) || club.effectiveDay > input.asOfDay
      || !id(club.season.plan.financialProfile.leagueId)
      || !unique(club.live.references.playerClubStateRefs
        .map((item: ClubWorldState['live']['references']['playerClubStateRefs'][number]) => item.playerId))) {
      throw new Error('headline club source is mismatched or future');
    }
  }
  const projectionByPlayer = new Map(publicSnapshot.records
    .map((record) => [record.playerId, record]));
  const population: LeaguePopulationPlayer[] = [];
  if (!unique(roster.players.map((player) => player.playerId))) {
    throw new Error('duplicate headline roster player');
  }
  for (const player of roster.players) {
    const clubId = player.clubRights.rightsHolderClubId;
    if (clubId === null) continue;
    const club = clubById.get(clubId);
    const projection = projectionByPlayer.get(player.playerId);
    if (!club || !projection
      || !club.live.references.playerClubStateRefs.some((reference: ClubWorldState['live']['references']['playerClubStateRefs'][number]) =>
        reference.playerId === player.playerId)) {
      throw new Error('rights-held headline player lacks club or public source');
    }
    population.push({ playerId: player.playerId,
      affiliationLeagueId: club.season.plan.financialProfile.leagueId,
      roleId: projection.roleId, publicProjectionSourceId: projection.projectionId,
      ratings: projection.ratings });
  }
  const clubLeagues = clubs.map((club) => ({ clubId: club.identity.clubId,
    leagueId: club.season.plan.financialProfile.leagueId }))
    .sort((a, b) => a.clubId.localeCompare(b.clubId));
  const leagueIds = [...new Set(clubLeagues.map((item) => item.leagueId))].sort();
  const references = leagueIds.map((leagueId) => createLeagueRatingReference({
    leagueId, playerPopulationSnapshotId: JSON.stringify([
      'headline-population-v1', input.snapshotId, leagueId]),
    projectionVersion: publicSnapshot.projectionVersion,
    atDay: input.asOfDay,
    population: population.filter((player) => player.affiliationLeagueId === leagueId),
  }, policy));
  return Object.freeze({ atDay: input.asOfDay,
    references: Object.freeze(references),
    clubLeagues: Object.freeze(clubLeagues.map((item) => Object.freeze(item))),
    provenance: Object.freeze({ snapshotId: input.snapshotId,
      careerId: roster.careerId, rosterRevision: roster.revision,
      rosterEffectiveDay: roster.effectiveDay,
      publicProjectionSnapshotId: publicSnapshot.snapshotId,
      projectionVersion: publicSnapshot.projectionVersion,
      policyId: policy.policyId, policyVersion: policy.version,
      clubRevisions: Object.freeze(clubs.map((club) => Object.freeze({
        clubId: club.identity.clubId, revision: club.revision,
        effectiveDay: club.effectiveDay,
      })).sort((a, b) => a.clubId.localeCompare(b.clubId))) }) });
};

/** No player projection enters this path; it reads the club-owned report at the pinned day. */
export const projectScoutingHeadlineAtWorldSnapshot = (
  snapshot: WorldHeadlineReferenceSnapshot,
  request: Readonly<{ evaluatingClubId: string; targetPlayerId: string;
    roleId: string; knowledge: ClubScoutingKnowledge }>,
  policy: HeadlineRatingPolicy,
): ScoutingHeadlineProjection | null => {
  const leagueId = snapshot.clubLeagues.find((club) =>
    club.clubId === request.evaluatingClubId)?.leagueId;
  const reference = snapshot.references.find((item) =>
    item.provenance.leagueId === leagueId);
  if (!leagueId || !reference
    || snapshot.provenance.policyId !== policy.policyId
    || snapshot.provenance.policyVersion !== policy.version
    || snapshot.provenance.projectionVersion !== policy.projectionVersion) {
    throw new Error('scouting headline world context or policy mismatch');
  }
  return projectScoutingTargetHeadline({
    careerId: snapshot.provenance.careerId,
    evaluatingClubId: request.evaluatingClubId,
    evaluatingClubLeagueId: leagueId,
    targetPlayerId: request.targetPlayerId, roleId: request.roleId,
    asOfDay: snapshot.atDay, knowledge: request.knowledge,
  }, reference, policy);
};
