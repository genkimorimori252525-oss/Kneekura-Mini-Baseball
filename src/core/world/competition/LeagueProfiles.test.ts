import { describe, expect, it } from 'vitest';
import { getDefaultClubCatalog } from '../catalog/DefaultClubCatalog';
import { LEAGUE_PROFILES_V1, readLeagueProfilesV1 } from './LeagueProfiles';

describe('frozen 21-league v1 profiles', () => {
  it('matches every catalog league and the approved per-club game volumes', () => {
    const catalog = getDefaultClubCatalog();
    expect(LEAGUE_PROFILES_V1).toHaveLength(21);
    expect(LEAGUE_PROFILES_V1.map((profile) => profile.leagueId))
      .toEqual(catalog.leagues.map((league) => league.leagueId));
    expect(LEAGUE_PROFILES_V1.map((profile) => profile.regularSeasonGamesPerClub))
      .toEqual([120, 126, 100, 108, 110, 108, 112, 162, 120, 100, 112,
        100, 120, 108, 110, 108, 108, 108, 110, 108, 110]);
    expect(LEAGUE_PROFILES_V1.every((profile) => profile.regularSeasonGamesPerClub >= 100))
      .toBe(true);
    expect(readLeagueProfilesV1(catalog)).toEqual(LEAGUE_PROFILES_V1);
  });

  it('pins domestic formats separately from calendar density', () => {
    expect(LEAGUE_PROFILES_V1.find((profile) => profile.leagueId === 'league-001'))
      .toMatchObject({ championshipFormat: 'CONFERENCE_SERIES', densityClass: 'STANDARD_DENSE' });
    expect(LEAGUE_PROFILES_V1.find((profile) => profile.leagueId === 'league-008'))
      .toMatchObject({ championshipFormat: 'CONFERENCE_SERIES', densityClass: 'LONG_DENSE' });
    expect(LEAGUE_PROFILES_V1.find((profile) => profile.leagueId === 'league-021'))
      .toMatchObject({ championshipFormat: 'TABLE_TITLE', densityClass: 'STANDARD' });
  });

  it('rejects a changed catalog identity instead of silently remapping old seasons', () => {
    const catalog = getDefaultClubCatalog();
    expect(() => readLeagueProfilesV1({ ...catalog, leagues: catalog.leagues.slice(1) }))
      .toThrow('catalog league identity');
  });
});
