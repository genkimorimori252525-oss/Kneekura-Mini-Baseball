import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { CompetitionDraw } from './CompetitionDraw';
import { assignContinentalGroupHomeSeries,
  createHomeFairnessLedger } from './ContinentalHomeFairness';
import { createContinentalGroupGamePlan } from './ContinentalGroupResults';
import { planContinentalQuarterfinals,
  finalizeContinentalQuarterfinals } from './ContinentalQuarterfinals';

const draw: CompetitionDraw = {
  editionId: 'edition-2027', drawPolicyVersion: 'draw-v1',
  drawSeed: 'group-seed', relaxationOrder: ['REMATCH_AVOIDANCE',
    'REGIONAL_DIVERSITY', 'SAME_LEAGUE_AVOIDANCE'],
  groups: ['abcd', 'efgh', 'ijkl', 'mnop'].map((members) =>
    [...members].map((teamId, index) => ({ teamId, pot: index + 1,
      leagueId: `league-${teamId}`, regionId: `region-${teamId}` }))),
  appliedConstraints: [], relaxedConstraints: [],
  softViolationCounts: { sameLeague: 0, sameRegion: 0, rematch: 0 },
};
const assignment = assignContinentalGroupHomeSeries({
  competitionId: 'continental-a', editionId: draw.editionId,
  editionOrdinal: 1, expectedRevision: 0, draw,
  ledger: createHomeFairnessLedger('continental-a'),
  policy: { version: 'fairness-v1', recentEditionWeights: [1] },
});
const groupPlan = createContinentalGroupGamePlan(assignment);
const groupTiebreakPolicy = { version: 'group-rank-v1',
  tieCreditNumerator: 0, tieCreditDenominator: 1,
  runDifferentialCapPerGame: 5 };

const result = (game: Readonly<{ gameId: string; homeClubId: string;
  awayClubId: string }>, index: number): OfficialGameResult => ({
  ...game, seasonId: 'edition-2027', homeRuns: 1, awayRuns: 2,
  winnerClubId: game.awayClubId, completionReason: 'BOTTOM_COMPLETE',
  ruleProfileId: asRuleProfileId('continental-rules-v1'),
  gamePolicyVersion: 'knockout-v1', closureId: `closure-${index}`,
  applicationId: `quarterfinal-${index}`, durableRevision: index + 1,
  lineScore: { innings: [{ inning: 1, homeRuns: 1, awayRuns: 2 }],
    totals: { home: { runs: 1, hits: 0, errors: 0 },
      away: { runs: 2, hits: 0, errors: 0 } } },
});

const groupOfficialResults = groupPlan.groups.flatMap((group) => group.games)
  .map((game, index): OfficialGameResult => {
    const winnerClubId = game.homeClubId < game.awayClubId
      ? game.homeClubId : game.awayClubId;
    const homeRuns = winnerClubId === game.homeClubId ? 2 : 1;
    const awayRuns = winnerClubId === game.awayClubId ? 2 : 1;
    return { ...result(game, index), homeRuns, awayRuns, winnerClubId,
      applicationId: `group-application-${index}`,
      lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
        totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
          away: { runs: awayRuns, hits: 0, errors: 0 } } } };
  });

it('draws cross-group winner-home quarterfinals and advances official winners only', () => {
  const input = { groupPlan, groupOfficialResults, groupTiebreakPolicy,
    policyVersion: 'quarterfinal-v1', drawSeed: 'seed-2027' };
  const plan = planContinentalQuarterfinals(input);
  expect(planContinentalQuarterfinals(input)).toEqual(plan);
  expect(plan.games).toHaveLength(4);
  expect(new Set(plan.games.map((game) => game.gameId)).size).toBe(4);
  expect(plan.games.every((game) => game.winnerGroupIndex
    !== game.runnerGroupIndex)).toBe(true);
  expect(plan.games.map((game) => game.homeClubId))
    .toEqual(['a', 'e', 'i', 'm']);
  const official = plan.games.map(result);
  const complete = finalizeContinentalQuarterfinals(plan, official, input);
  expect(complete.winnerClubIds).toEqual(
    plan.games.map((game) => game.awayClubId));
  expect(complete.resultApplicationIds).toEqual(
    official.map((game) => game.applicationId));
  expect(() => finalizeContinentalQuarterfinals(plan,
    official.slice(1), input)).toThrow('complete');
  expect(() => finalizeContinentalQuarterfinals(plan,
    [{ ...official[0], awayRuns: 1, winnerClubId: null,
      completionReason: 'TIE_LIMIT' }, ...official.slice(1)], input))
    .toThrow('decided');
  expect(() => finalizeContinentalQuarterfinals(plan,
    [{ ...official[0], gameId: official[1].gameId }, ...official.slice(1)],
    input))
    .toThrow('unique');
  expect(() => finalizeContinentalQuarterfinals(plan,
    [{ ...official[0], applicationId: groupOfficialResults[0].applicationId },
      ...official.slice(1)], input)).toThrow('unique');
  const forgedDraw = structuredClone(plan);
  const first = forgedDraw.games[0].runnerGroupIndex;
  const second = forgedDraw.games[1].runnerGroupIndex;
  (forgedDraw.games[0] as { runnerGroupIndex: number }).runnerGroupIndex = second;
  (forgedDraw.games[1] as { runnerGroupIndex: number }).runnerGroupIndex = first;
  expect(() => finalizeContinentalQuarterfinals(forgedDraw, official, input))
    .toThrow('draw');
  const forgedQualifier = structuredClone(plan);
  (forgedQualifier.sources[0] as { winnerClubId: string }).winnerClubId = 'x';
  (forgedQualifier.games[0] as { homeClubId: string }).homeClubId = 'x';
  expect(() => finalizeContinentalQuarterfinals(forgedQualifier,
    [{ ...official[0], homeClubId: 'x' }, ...official.slice(1)], input))
    .toThrow('official group results');
  expect(() => planContinentalQuarterfinals({ ...input,
    groupOfficialResults: groupOfficialResults.slice(1) }))
    .toThrow('complete');
});
