import { expect, it } from 'vitest';
import { drawCompetitionGroups, EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
  registerCompetitionDrawPolicy } from './CompetitionDraw';

it('keeps hard pot integrity and deterministically relaxes impossible soft constraints', () => {
  const participants = Array.from({ length: 8 }, (_, index) => ({
    teamId: `team-${index}`, pot: Math.floor(index / 4) + 1,
    leagueId: index < 4 ? 'league-a' : `league-${index}`,
    regionId: index < 4 ? 'region-a' : 'region-b',
  }));
  const input = {
    editionId: 'continental-1', profile: { drawPolicyVersion: 'draw-v1',
      drawPolicy: { version: 'draw-v1',
        relaxationOrder: ['REMATCH_AVOIDANCE', 'REGIONAL_DIVERSITY',
          'SAME_LEAGUE_AVOIDANCE'] as const } },
    drawSeed: 'seed-1', groupCount: 4,
    participants,
    rematchPairs: [] as readonly (readonly [string, string])[],
  };
  const registry = registerCompetitionDrawPolicy(
    EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, input.profile.drawPolicy);
  const result = drawCompetitionGroups(input, registry);
  expect(result.groups).toHaveLength(4);
  expect(result.groups.every((group) =>
    group.length === 2 && new Set(group.map((team) => team.pot)).size === 2)).toBe(true);
  expect(result.relaxedConstraints).toEqual([]);
  expect(drawCompetitionGroups(input, registry)).toEqual(result);
  const impossible = drawCompetitionGroups({
    ...input,
    participants: participants.map((team) => ({ ...team, leagueId: 'same-league' })),
  }, registry);
  expect(impossible.relaxedConstraints).toContain('SAME_LEAGUE_AVOIDANCE');
  expect(impossible.groups.flat()).toHaveLength(8);
});

it('uses the versioned relaxation order to resolve competing soft constraints', () => {
  const participants = [
    { teamId: 'a', pot: 1, leagueId: 'one', regionId: 'east' },
    { teamId: 'b', pot: 1, leagueId: 'two', regionId: 'west' },
    { teamId: 'c', pot: 2, leagueId: 'one', regionId: 'west' },
    { teamId: 'd', pot: 2, leagueId: 'two', regionId: 'east' },
  ];
  const base = { editionId: 'edition-1',
    drawSeed: 'seed-1', groupCount: 2, participants, rematchPairs: [] };
  const leagueProfile = { drawPolicyVersion: 'league-priority-v1',
    drawPolicy: { version: 'league-priority-v1', relaxationOrder: [
      'REGIONAL_DIVERSITY', 'REMATCH_AVOIDANCE',
      'SAME_LEAGUE_AVOIDANCE'] as const } };
  const regionProfile = { drawPolicyVersion: 'region-priority-v1',
    drawPolicy: { version: 'region-priority-v1', relaxationOrder: [
      'SAME_LEAGUE_AVOIDANCE', 'REMATCH_AVOIDANCE',
      'REGIONAL_DIVERSITY'] as const } };
  const registry = registerCompetitionDrawPolicy(
    registerCompetitionDrawPolicy(EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
      leagueProfile.drawPolicy), regionProfile.drawPolicy);
  const leagueFirst = drawCompetitionGroups({ ...base,
    profile: leagueProfile }, registry);
  const regionFirst = drawCompetitionGroups({ ...base,
    profile: regionProfile }, registry);
  expect(leagueFirst.softViolationCounts).toEqual({ sameLeague: 0,
    sameRegion: 2, rematch: 0 });
  expect(regionFirst.softViolationCounts).toEqual({ sameLeague: 2,
    sameRegion: 0, rematch: 0 });
  expect(regionFirst.relaxationOrder).toEqual([
    'SAME_LEAGUE_AVOIDANCE', 'REMATCH_AVOIDANCE', 'REGIONAL_DIVERSITY']);
  expect(Object.isFrozen(regionFirst.relaxationOrder)).toBe(true);
  expect(() => registerCompetitionDrawPolicy(registry, {
    version: 'region-priority-v1',
    relaxationOrder: leagueProfile.drawPolicy.relaxationOrder,
  })).toThrow('version conflicts');
  expect(() => drawCompetitionGroups({ ...base,
    profile: { ...regionProfile, drawPolicy: {
      ...regionProfile.drawPolicy,
      relaxationOrder: leagueProfile.drawPolicy.relaxationOrder } } },
  registry)).toThrow('registered version');
  expect(() => drawCompetitionGroups({ ...base,
    profile: { drawPolicyVersion: 'invalid-v1',
      drawPolicy: { version: 'invalid-v1',
        relaxationOrder: ['SAME_LEAGUE_AVOIDANCE', 'SAME_LEAGUE_AVOIDANCE',
          'REGIONAL_DIVERSITY'] } } }, registry)).toThrow('relaxation order');
  expect(() => drawCompetitionGroups({ ...base,
    profile: { drawPolicyVersion: 'invalid-v1',
      drawPolicy: { version: 'invalid-v1',
        relaxationOrder: ['__proto__', 'REMATCH_AVOIDANCE',
          'REGIONAL_DIVERSITY'] as never } } }, registry)).toThrow('relaxation order');
  expect(() => drawCompetitionGroups({ ...base,
    profile: { drawPolicyVersion: 'old-version',
      drawPolicy: { version: 'new-version', relaxationOrder: [
        'REMATCH_AVOIDANCE', 'REGIONAL_DIVERSITY',
        'SAME_LEAGUE_AVOIDANCE'] } } }, registry)).toThrow('versioned competition profile');
});
