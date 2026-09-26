import { createCanonicalLineScoreSnapshot }
  from '../../model/CanonicalLineScoreSnapshot';
import { finalizeClubWorldGroupHubs, type ClubWorldGroupHubPlan,
  type ClubWorldGroupHubSource } from './ClubWorldGroupHubs';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { StandingsTiebreakPolicy } from './OfficialStandings';

export type ClubWorldQuarterfinalSource = Readonly<{
  groupSource: ClubWorldGroupHubSource;
  groupPlan: ClubWorldGroupHubPlan;
  groupOfficialResults: readonly OfficialGameResult[];
  groupTiebreakPolicy: StandingsTiebreakPolicy;
}>;
export type ClubWorldQuarterfinalGame = Readonly<{
  gameId: string;
  winnerGroupIndex: number;
  runnerGroupIndex: number;
  seededClubId: string;
  homeClubId: string;
  awayClubId: string;
  neutralVenueId: string;
  fixtureEventId: string;
}>;
export type ClubWorldQuarterfinalPlan = Readonly<{
  competitionId: string;
  editionId: string;
  pairingPolicyVersion: string;
  groupTiebreakPolicyVersion: string;
  sourceApplicationIds: readonly string[];
  games: readonly ClubWorldQuarterfinalGame[];
}>;
export type ClubWorldQuarterfinalOutcome = Readonly<{
  plan: ClubWorldQuarterfinalPlan;
  winnerClubIds: readonly string[];
  resultApplicationIds: readonly string[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** Group winners are seeded; the pinned edition chooses neutral venues. */
export const planClubWorldQuarterfinals = (
  source: ClubWorldQuarterfinalSource,
): ClubWorldQuarterfinalPlan => {
  const groups = finalizeClubWorldGroupHubs(source.groupPlan,
    source.groupOfficialResults, source.groupTiebreakPolicy,
    source.groupSource);
  const edition = source.groupSource.edition;
  const policy = edition.clubWorldQuarterfinalPolicy;
  if (!policy || !id(policy.version)
    || !Array.isArray(policy.runnerGroupByWinnerGroup)
    || policy.runnerGroupByWinnerGroup.length !== 4
    || new Set(policy.runnerGroupByWinnerGroup).size !== 4
    || policy.runnerGroupByWinnerGroup.some((runner, winner) =>
      !Number.isSafeInteger(runner) || runner < 0 || runner > 3
      || runner === winner)
    || typeof policy.groupWinnerBatsLast !== 'boolean'
    || !Array.isArray(policy.venueIds)
    || policy.venueIds.length !== 4
    || policy.venueIds.some((venueId) =>
      !edition.host.venueIds.includes(venueId))) {
    throw new Error('Club World quarterfinal policy must be pinned to its edition');
  }
  const qualifiers = groups.groups.map((group) =>
    group.qualifierClubIds);
  if (qualifiers.some((group) => !group || group.length !== 2)
    || new Set(qualifiers.flatMap((group) => group ?? [])).size !== 8) {
    throw new Error('Club World group qualification must be resolved');
  }
  const games = qualifiers.map((group, winnerGroupIndex) => {
    const runnerGroupIndex = policy.runnerGroupByWinnerGroup[winnerGroupIndex];
    const seededClubId = group![0];
    const runnerClubId = qualifiers[runnerGroupIndex]![1];
    const neutralVenueId = policy.venueIds[winnerGroupIndex];
    const gameId = JSON.stringify(['club-world-quarterfinal',
      edition.competitionId, edition.editionId, winnerGroupIndex,
      runnerGroupIndex]);
    return Object.freeze({ gameId, winnerGroupIndex, runnerGroupIndex,
      seededClubId,
      homeClubId: policy.groupWinnerBatsLast ? seededClubId : runnerClubId,
      awayClubId: policy.groupWinnerBatsLast ? runnerClubId : seededClubId,
      neutralVenueId,
      fixtureEventId: JSON.stringify(['club-world-fixture', gameId,
        neutralVenueId]) });
  });
  return Object.freeze({ competitionId: edition.competitionId,
    editionId: edition.editionId,
    pairingPolicyVersion: policy.version,
    groupTiebreakPolicyVersion: groups.tiebreakPolicyVersion,
    sourceApplicationIds: Object.freeze(source.groupOfficialResults
      .map((result) => result.applicationId).sort()),
    games: Object.freeze(games) });
};

/** Replays qualification and rejects forged plans, venues and outcomes. */
export const finalizeClubWorldQuarterfinals = (
  plan: ClubWorldQuarterfinalPlan,
  results: readonly OfficialGameResult[],
  source: ClubWorldQuarterfinalSource,
): ClubWorldQuarterfinalOutcome => {
  const expected = planClubWorldQuarterfinals(source);
  if (!plan || plan.competitionId !== expected.competitionId
    || plan.editionId !== expected.editionId
    || plan.pairingPolicyVersion !== expected.pairingPolicyVersion
    || plan.groupTiebreakPolicyVersion
      !== expected.groupTiebreakPolicyVersion
    || JSON.stringify(plan.sourceApplicationIds)
      !== JSON.stringify(expected.sourceApplicationIds)
    || JSON.stringify(plan.games) !== JSON.stringify(expected.games)) {
    throw new Error('Club World quarterfinal plan contradicts official groups');
  }
  if (!Array.isArray(results) || results.length !== 4) {
    throw new Error('Club World quarterfinals require four official results');
  }
  const byGame = new Map(results.map((result) => [result.gameId, result]));
  const prior = new Set(expected.sourceApplicationIds);
  if (byGame.size !== 4
    || new Set(results.map((result) => result.applicationId)).size !== 4
    || new Set(results.map((result) => result.closureId)).size !== 4
    || results.some((result) => prior.has(result.applicationId))) {
    throw new Error('quarterfinal results require unique applications');
  }
  const winners: string[] = [];
  const applications: string[] = [];
  for (const game of expected.games) {
    const result = byGame.get(game.gameId);
    if (!result || result.seasonId !== expected.editionId
      || result.homeClubId !== game.homeClubId
      || result.awayClubId !== game.awayClubId
      || !id(result.closureId) || !id(result.applicationId)) {
      throw new Error('Club World quarterfinal official game mismatch');
    }
    if (result.venueBinding?.gameId !== game.gameId
      || result.venueBinding.venueId !== game.neutralVenueId
      || result.venueBinding.fixtureEventId !== game.fixtureEventId
      || !Number.isSafeInteger(result.venueBinding.fixtureRevision)
      || result.venueBinding.fixtureRevision < 0) {
      throw new Error('Club World quarterfinal requires its neutral venue');
    }
    if (!Number.isSafeInteger(result.homeRuns)
      || !Number.isSafeInteger(result.awayRuns)
      || result.homeRuns < 0 || result.awayRuns < 0
      || result.homeRuns === result.awayRuns
      || result.completionReason === 'TIE_LIMIT') {
      throw new Error('Club World quarterfinal requires a decided official game');
    }
    const winner = result.homeRuns > result.awayRuns
      ? game.homeClubId : game.awayClubId;
    const lineScore = createCanonicalLineScoreSnapshot(result.lineScore);
    if (winner !== result.winnerClubId
      || lineScore.totals.home.runs !== result.homeRuns
      || lineScore.totals.away.runs !== result.awayRuns) {
      throw new Error('Club World quarterfinal winner contradicts official score');
    }
    winners.push(winner);
    applications.push(result.applicationId);
  }
  return Object.freeze({ plan: expected,
    winnerClubIds: Object.freeze(winners),
    resultApplicationIds: Object.freeze(applications) });
};
