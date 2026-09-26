import type { ClubWorldRegion } from './ClubWorldBerths';
import type { OfficialRegionalClubSeason }
  from './ClubWorldQualificationSources';
import { deriveOfficialRegionalClubSeason,
  type OfficialRegionalClubSeasonSource }
  from './OfficialRegionalClubAchievement';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];

export type RegionalClubCompetitionIdentity = Readonly<{
  region: ClubWorldRegion;
  competitionId: string;
}>;
export type RegionalClubSeasonHistory = Readonly<{
  identities: readonly RegionalClubCompetitionIdentity[];
  seasons: readonly OfficialRegionalClubSeason[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** The world owns this stable competition-to-region identity mapping. */
export const createRegionalClubSeasonHistory = (
  identities: readonly RegionalClubCompetitionIdentity[],
): RegionalClubSeasonHistory => {
  if (!Array.isArray(identities) || identities.length !== 4
    || identities.some((item) => !item || !id(item.competitionId)
      || !REGIONS.includes(item.region))
    || new Set(identities.map((item) => item.region)).size !== 4
    || new Set(identities.map((item) => item.competitionId)).size !== 4) {
    throw new Error('regional club competition identities are incomplete');
  }
  return Object.freeze({ identities: Object.freeze(identities.map((item) =>
    Object.freeze({ region: item.region,
      competitionId: item.competitionId }))),
  seasons: Object.freeze([]) });
};

/** Register only a fully finalized edition; SeasonId is an explicit binding. */
export const recordRegionalClubSeason = (
  history: RegionalClubSeasonHistory,
  input: OfficialRegionalClubSeasonSource,
): RegionalClubSeasonHistory => {
  if (!Array.isArray(history?.identities)
    || !Array.isArray(history?.seasons)) {
    throw new Error('regional club season history is required');
  }
  const edition = input.kind === 'STANDARD' ? input.source.edition
    : input.source.groupSource.edition;
  const identity = history.identities.find((item) =>
    item.region === input.region);
  if (!identity || edition.competitionId !== identity.competitionId) {
    throw new Error('regional club edition competition identity mismatch');
  }
  const season = deriveOfficialRegionalClubSeason(input);
  if (history.seasons.some((item) =>
    (item.region === season.region && item.seasonId === season.seasonId)
    || item.editionId === season.editionId
    || item.officialSnapshotId === season.officialSnapshotId)) {
    throw new Error('regional club season or edition already recorded');
  }
  return Object.freeze({ identities: history.identities,
    seasons: Object.freeze([...history.seasons, season]) });
};

/** Suitable for ClubWorldQualificationSourceAuthority.completedRegionalSeason. */
export const completedRegionalClubSeason = (
  history: RegionalClubSeasonHistory,
  region: ClubWorldRegion,
  seasonId: string,
  beforeDay: number,
): OfficialRegionalClubSeason | null => {
  if (!id(seasonId) || !REGIONS.includes(region)
    || !Number.isSafeInteger(beforeDay) || beforeDay < 0) {
    throw new Error('invalid regional club history lookup');
  }
  const season = history.seasons.find((item) =>
    item.region === region && item.seasonId === seasonId);
  return season && season.completedAtDay <= beforeDay ? season : null;
};
