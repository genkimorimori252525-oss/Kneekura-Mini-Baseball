import { expect, it } from 'vitest';
import { deriveDomesticQualificationOrder } from './DomesticQualificationOrder';
import { LEAGUE_PROFILES_V1 } from './LeagueProfiles';

const profile = (leagueId: string) => LEAGUE_PROFILES_V1.find((item) => item.leagueId === leagueId)!;

it('keeps Japan conference pennants ahead of the final runner-up', () => {
  const order = deriveDomesticQualificationOrder({
    profile: profile('league-001'),
    regularSeasonStandings: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
    domesticChampionId: 'b', championshipRunnerUpId: 'a',
    conferenceWinnerIds: ['a', 'g'],
  });
  expect(order.slice(0, 4).map((item) => item.clubId)).toEqual(['b', 'a', 'g', 'a']);
  expect(order[0].sourceType).toBe('DOMESTIC_CHAMPION');
});

it('retains Europe regular-season title and Dominican championship-round order', () => {
  const europe = deriveDomesticQualificationOrder({
    profile: profile('league-014'),
    regularSeasonStandings: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    domesticChampionId: 'b', championshipRunnerUpId: 'c',
  });
  expect(europe.slice(0, 3).map((item) => item.clubId)).toEqual(['b', 'a', 'c']);
  const winter = deriveDomesticQualificationOrder({
    profile: profile('league-010'),
    regularSeasonStandings: ['a', 'b', 'c', 'd', 'e', 'f'],
    domesticChampionId: 'd', championshipRunnerUpId: 'c',
    championshipRoundOrder: ['d', 'c', 'a', 'b'],
  });
  expect(winter.slice(0, 4).map((item) => item.clubId)).toEqual(['d', 'c', 'a', 'b']);
});
