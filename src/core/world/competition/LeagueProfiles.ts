import type { ClubCatalog } from '../catalog/CatalogTypes';

export type DomesticChampionshipFormat =
  | 'TABLE_TITLE' | 'TOP4_SERIES' | 'EURO_TOP4' | 'CONFERENCE_SERIES'
  | 'LADDER' | 'WINTER_ROUND_ROBIN' | 'TOP2_FINAL';
export type ScheduleDensityClass = 'LONG_DENSE' | 'STANDARD_DENSE' | 'STANDARD';

export type LeagueProfileV1 = Readonly<{
  leagueId: string;
  clubCount: number;
  calendarProfileVersion: 'league-calendar-v1';
  competitionProfileVersion: 'league-competition-v1';
  regularSeasonGamesPerClub: number;
  densityClass: ScheduleDensityClass;
  championshipFormat: DomesticChampionshipFormat;
}>;

const rows: readonly Readonly<[
  string, number, number, DomesticChampionshipFormat, ScheduleDensityClass,
]>[] = [
  ['league-001', 12, 120, 'CONFERENCE_SERIES', 'STANDARD_DENSE'],
  ['league-002', 10, 126, 'LADDER', 'STANDARD_DENSE'],
  ['league-003', 6, 100, 'TOP4_SERIES', 'STANDARD'],
  ['league-004', 10, 108, 'TOP4_SERIES', 'STANDARD'],
  ['league-005', 12, 110, 'TABLE_TITLE', 'STANDARD'],
  ['league-006', 4, 108, 'TOP2_FINAL', 'STANDARD_DENSE'],
  ['league-007', 8, 112, 'TABLE_TITLE', 'STANDARD_DENSE'],
  ['league-008', 30, 162, 'CONFERENCE_SERIES', 'LONG_DENSE'],
  ['league-009', 20, 120, 'CONFERENCE_SERIES', 'STANDARD_DENSE'],
  ['league-010', 6, 100, 'WINTER_ROUND_ROBIN', 'STANDARD'],
  ['league-011', 8, 112, 'TOP4_SERIES', 'STANDARD'],
  ['league-012', 6, 100, 'TOP4_SERIES', 'STANDARD'],
  ['league-013', 16, 120, 'CONFERENCE_SERIES', 'STANDARD_DENSE'],
  ['league-014', 10, 108, 'EURO_TOP4', 'STANDARD_DENSE'],
  ['league-015', 12, 110, 'EURO_TOP4', 'STANDARD_DENSE'],
  ['league-016', 10, 108, 'EURO_TOP4', 'STANDARD_DENSE'],
  ['league-017', 10, 108, 'EURO_TOP4', 'STANDARD_DENSE'],
  ['league-018', 10, 108, 'EURO_TOP4', 'STANDARD_DENSE'],
  ['league-019', 12, 110, 'EURO_TOP4', 'STANDARD_DENSE'],
  ['league-020', 10, 108, 'EURO_TOP4', 'STANDARD_DENSE'],
  ['league-021', 12, 110, 'TABLE_TITLE', 'STANDARD'],
];

export const LEAGUE_PROFILES_V1: readonly LeagueProfileV1[] = Object.freeze(rows.map(([
  leagueId, clubCount, regularSeasonGamesPerClub, championshipFormat, densityClass,
]) => Object.freeze({
  leagueId, clubCount, regularSeasonGamesPerClub, championshipFormat, densityClass,
  calendarProfileVersion: 'league-calendar-v1' as const,
  competitionProfileVersion: 'league-competition-v1' as const,
})));

/** Identity check only. Season snapshots pin the profile and never reinterpret history. */
export const readLeagueProfilesV1 = (
  catalog: Pick<ClubCatalog, 'leagues'>,
): readonly LeagueProfileV1[] => {
  if (
    catalog.leagues.length !== LEAGUE_PROFILES_V1.length
    || catalog.leagues.some((league, index) => (
      league.leagueId !== LEAGUE_PROFILES_V1[index].leagueId
      || league.clubCount !== LEAGUE_PROFILES_V1[index].clubCount
    ))
  ) throw new Error('catalog league identity does not match frozen v1 profiles');
  return LEAGUE_PROFILES_V1;
};
