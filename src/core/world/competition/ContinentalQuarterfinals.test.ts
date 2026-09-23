import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { CompetitionDraw } from './CompetitionDraw';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
  registerCompetitionDrawPolicy } from './CompetitionDraw';
import { createCompetitionEdition } from './CompetitionEdition';
import type { HostCandidate } from './HostSelection';
import { assignContinentalGroupHomeSeries,
  createHomeFairnessLedger } from './ContinentalHomeFairness';
import { createContinentalGroupGamePlan } from './ContinentalGroupResults';
import { planContinentalQuarterfinals,
  finalizeContinentalQuarterfinals } from './ContinentalQuarterfinals';
import { planContinentalFinalFour, finalizeContinentalFinalFour }
  from './ContinentalFinalFour';

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

it('uses the edition host for two neutral semifinals and one official final', () => {
  const quarterfinalSource = { groupPlan, groupOfficialResults,
    groupTiebreakPolicy };
  const quarterfinalPlan = planContinentalQuarterfinals({
    ...quarterfinalSource, policyVersion: 'quarterfinal-v1',
    drawSeed: 'seed-2027' });
  const quarterfinalResults = quarterfinalPlan.games.map(result);
  const hostCandidates: HostCandidate[] = [{ venueId: 'venue-1',
    nationId: 'nation-1', cityId: 'city-1', regionId: 'region-1',
    eligible: true, suitabilityScore: 10, rotationScore: 1 },
  { venueId: 'venue-2', nationId: 'nation-1', cityId: 'city-2',
    regionId: 'region-2', eligible: true, suitabilityScore: 5,
    rotationScore: 1 }];
  const profile = {
    competitionId: 'continental-a',
    formatVersion: 'continental-16-v1',
    ruleProfileVersion: 'continental-rules-v1',
    hostingPolicyVersion: 'final-four-host-v1',
    drawPolicyVersion: 'draw-v1',
    drawPolicy: { version: 'draw-v1',
      relaxationOrder: draw.relaxationOrder },
    awardPolicyVersion: 'award-v1', canonicalRole: 'CONTINENTAL_CL' };
  const registry = registerCompetitionDrawPolicy(
    EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, profile.drawPolicy);
  const edition = createCompetitionEdition(profile, {
    editionId: draw.editionId,
    qualificationSnapshotId: 'qualified-2027',
    participantIds: groupPlan.groups.flatMap((group) => group.memberClubIds),
    host: { nationId: 'nation-1', cityIds: ['city-1', 'city-2'],
      venueIds: ['venue-1', 'venue-2'] },
    calendarWindow: { startsOnDay: 1, endsOnDay: 30 },
    drawSnapshotId: 'group-draw-2027', prestigeAtEdition: 1,
    finalFourHostCandidates: hostCandidates,
    finalFourPairingPolicy: { version: 'sf-pairs-v1',
      semifinalPairs: [[0, 1], [2, 3]] as const },
  }, registry);
  expect(() => createCompetitionEdition(profile, {
    editionId: draw.editionId,
    qualificationSnapshotId: 'qualified-2027',
    participantIds: groupPlan.groups.flatMap((group) => group.memberClubIds),
    host: edition.host, calendarWindow: edition.calendarWindow,
    drawSnapshotId: edition.drawSnapshotId, prestigeAtEdition: 1,
  }, registry)).toThrow('preselected final four host');
  const source = { edition, quarterfinalPlan,
    quarterfinalResults, quarterfinalSource,
    pairingPolicy: { version: 'sf-pairs-v1',
      semifinalPairs: [[0, 1], [2, 3]] as const } };
  hostCandidates[0] = { ...hostCandidates[0], suitabilityScore: -10 };
  const plan = planContinentalFinalFour(source);
  expect(edition.finalFourHost?.selectedVenueId).toBe('venue-1');
  expect(plan.semifinalGames).toHaveLength(2);
  expect(plan.semifinalGames.every((game) =>
    game.neutralVenueId === 'venue-1')).toBe(true);
  const withVenue = (game: Readonly<{ gameId: string;
    homeClubId: string; awayClubId: string }>, index: number):
  OfficialGameResult => ({ ...result(game, index),
    venueBinding: { gameId: game.gameId, venueId: 'venue-1',
      fixtureEventId: `fixture-${index}`,
      fixtureRevision: index + 1 } });
  const semifinals = plan.semifinalGames.map((game, index) =>
    withVenue(game, index + 4));
  const finalists = semifinals.map((game) => game.winnerClubId!);
  const final = withVenue({ gameId: plan.finalGameId,
    homeClubId: finalists[0], awayClubId: finalists[1] }, 6);
  const outcome = finalizeContinentalFinalFour(plan, semifinals,
    final, source);
  expect(outcome.championClubId).toBe(final.winnerClubId);
  expect(outcome.finalGame.neutralVenueId).toBe('venue-1');
  expect('thirdPlaceGame' in outcome).toBe(false);
  expect(() => finalizeContinentalFinalFour(plan, semifinals,
    { ...final, applicationId: quarterfinalResults[0].applicationId },
    source)).toThrow('application');
  expect(() => finalizeContinentalFinalFour(plan, semifinals,
    { ...final, venueBinding: { ...final.venueBinding!,
      venueId: 'venue-2' } }, source)).toThrow('official');
  expect(() => finalizeContinentalFinalFour(plan, semifinals,
    { ...final, venueBinding: undefined }, source)).toThrow('official');
  expect(() => planContinentalFinalFour({ ...source,
    edition: { ...edition, finalFourHost: undefined } })).toThrow('host');
  expect(() => planContinentalFinalFour({ ...source,
    pairingPolicy: { version: 'bad-pairs',
      semifinalPairs: [[0, 0], [2, 3]] as const } }))
    .toThrow('pairing');
  expect(() => planContinentalFinalFour({ ...source,
    pairingPolicy: { version: 'sf-pairs-v1',
      semifinalPairs: [[0, 2], [1, 3]] as const } }))
    .toThrow('pairing');
});
