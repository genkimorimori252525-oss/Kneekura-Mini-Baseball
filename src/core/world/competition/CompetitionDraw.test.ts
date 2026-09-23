import { expect, it } from 'vitest';
import { drawCompetitionGroups } from './CompetitionDraw';

it('keeps hard pot integrity and deterministically relaxes impossible soft constraints', () => {
  const participants = Array.from({ length: 8 }, (_, index) => ({
    teamId: `team-${index}`, pot: Math.floor(index / 4) + 1,
    leagueId: index < 4 ? 'league-a' : `league-${index}`,
    regionId: index < 4 ? 'region-a' : 'region-b',
  }));
  const input = {
    editionId: 'continental-1', drawPolicyVersion: 'draw-v1',
    drawSeed: 'seed-1', groupCount: 4,
    participants,
    rematchPairs: [] as readonly (readonly [string, string])[],
  };
  const result = drawCompetitionGroups(input);
  expect(result.groups).toHaveLength(4);
  expect(result.groups.every((group) =>
    group.length === 2 && new Set(group.map((team) => team.pot)).size === 2)).toBe(true);
  expect(result.relaxedConstraints).toEqual([]);
  expect(drawCompetitionGroups(input)).toEqual(result);
  const impossible = drawCompetitionGroups({
    ...input,
    participants: participants.map((team) => ({ ...team, leagueId: 'same-league' })),
  });
  expect(impossible.relaxedConstraints).toContain('SAME_LEAGUE_AVOIDANCE');
  expect(impossible.groups.flat()).toHaveLength(8);
});
