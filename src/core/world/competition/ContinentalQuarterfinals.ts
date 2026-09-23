import { createCanonicalLineScoreSnapshot } from '../../model/CanonicalLineScoreSnapshot';
import { fnv1a32 } from '../../rng/DeterministicRng';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { finalizeContinentalGroupResults,
  type ContinentalGroupGamePlan } from './ContinentalGroupResults';
import type { StandingsTiebreakPolicy } from './OfficialStandings';

export type ContinentalQuarterfinalGame = Readonly<{
  gameId: string;
  winnerGroupIndex: number;
  runnerGroupIndex: number;
  homeClubId: string;
  awayClubId: string;
}>;
export type ContinentalQuarterfinalPlan = Readonly<{
  competitionId: string;
  editionId: string;
  policyVersion: string;
  drawSeed: string;
  groupTiebreakPolicyVersion: string;
  sources: readonly Readonly<{
    groupIndex: number;
    winnerClubId: string;
    runnerClubId: string;
    resultApplicationIds: readonly string[];
  }>[];
  games: readonly ContinentalQuarterfinalGame[];
}>;
export type ContinentalQuarterfinalOutcome = Readonly<{
  plan: ContinentalQuarterfinalPlan;
  winnerClubIds: readonly string[];
  resultApplicationIds: readonly string[];
}>;
export type ContinentalQuarterfinalSource = Readonly<{
  groupPlan: ContinentalGroupGamePlan;
  groupOfficialResults: readonly OfficialGameResult[];
  groupTiebreakPolicy: StandingsTiebreakPolicy;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const permutations = (items: readonly number[]): number[][] =>
  items.length === 0 ? [[]] : items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)])
      .map((rest) => [item, ...rest]));

const drawRunnerGroups = (seed: string): number[] => {
  const legal = permutations([0, 1, 2, 3]).filter((order) =>
    order.every((runnerGroup, winnerGroup) => runnerGroup !== winnerGroup));
  legal.sort((left, right) => {
    const leftKey = left.join(':');
    const rightKey = right.join(':');
    return fnv1a32(`${seed}:${leftKey}`)
      - fnv1a32(`${seed}:${rightKey}`)
      || (leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0);
  });
  return legal[0];
};

/** Draws four winner-home single games; no same-group rematch is needed. */
export const planContinentalQuarterfinals = (input: ContinentalQuarterfinalSource & Readonly<{
  policyVersion: string;
  drawSeed: string;
}>): ContinentalQuarterfinalPlan => {
  if (!id(input?.policyVersion) || !id(input.drawSeed)) {
    throw new Error('invalid versioned continental quarterfinal source');
  }
  const source = finalizeContinentalGroupResults(input.groupPlan,
    input.groupOfficialResults, input.groupTiebreakPolicy);
  const qualified = new Set<string>();
  const applications = new Set<string>();
  const groups = source.groups;
  const sources = groups.map((group, groupIndex) => {
    const ranked = group.standings?.rows;
    const qualifiers = group.qualifierClubIds;
    if (group?.groupIndex !== groupIndex || !group.standings
      || group.standings.seasonId !== source.editionId
      || group.standings.leagueId !== source.competitionId
      || group.standings.tiebreakPolicyVersion !== source.tiebreakPolicyVersion
      || !Array.isArray(ranked) || ranked.length !== 4
      || !Array.isArray(group.standings.resultApplicationIds)
      || group.standings.resultApplicationIds.length !== 18
      || !Array.isArray(group.standings.unresolvedTieGroups)
      || !Array.isArray(qualifiers) || qualifiers.length !== 2
      || ranked[0].clubId !== qualifiers[0]
      || ranked[1].clubId !== qualifiers[1]
      || ranked.some((row) => !id(row.clubId) || row.games !== 9)
      || group.standings.unresolvedTieGroups.some((tie) =>
        tie.some((clubId: string) => qualifiers.includes(clubId)))
      || qualifiers.some((clubId) => qualified.has(clubId))
      || group.standings.resultApplicationIds.some((applicationId) =>
        !id(applicationId) || applications.has(applicationId))) {
      throw new Error('quarterfinal qualification is unresolved or inconsistent');
    }
    qualifiers.forEach((clubId) => qualified.add(clubId));
    group.standings.resultApplicationIds.forEach((applicationId) =>
      applications.add(applicationId));
    return Object.freeze({ groupIndex,
      winnerClubId: qualifiers[0], runnerClubId: qualifiers[1],
      resultApplicationIds: Object.freeze([
        ...group.standings.resultApplicationIds]) });
  });
  const selected = drawRunnerGroups(input.drawSeed);
  const games = sources.map((winner, winnerGroupIndex) => {
    const runnerGroupIndex = selected[winnerGroupIndex];
    const runner = sources[runnerGroupIndex];
    return Object.freeze({
      gameId: JSON.stringify(['continental-quarterfinal',
        source.competitionId, source.editionId,
        winnerGroupIndex, runnerGroupIndex]),
      winnerGroupIndex, runnerGroupIndex,
      homeClubId: winner.winnerClubId,
      awayClubId: runner.runnerClubId,
    });
  });
  return Object.freeze({ competitionId: source.competitionId,
    editionId: source.editionId, policyVersion: input.policyVersion,
    drawSeed: input.drawSeed,
    groupTiebreakPolicyVersion: source.tiebreakPolicyVersion,
    sources: Object.freeze(sources), games: Object.freeze(games) });
};

const snapshotPlan = (plan: ContinentalQuarterfinalPlan):
ContinentalQuarterfinalPlan => {
  if (!id(plan?.competitionId) || !id(plan.editionId)
    || !id(plan.policyVersion) || !id(plan.drawSeed)
    || !id(plan.groupTiebreakPolicyVersion)
    || !Array.isArray(plan.sources) || plan.sources.length !== 4
    || !Array.isArray(plan.games) || plan.games.length !== 4) {
    throw new Error('invalid continental quarterfinal plan');
  }
  const sources: ContinentalQuarterfinalPlan['sources'] = plan.sources;
  const games: ContinentalQuarterfinalPlan['games'] = plan.games;
  const clubs = new Set<string>();
  const applications = new Set<string>();
  const savedSources = sources.map((source, groupIndex) => {
    if (source.groupIndex !== groupIndex
      || !id(source.winnerClubId) || !id(source.runnerClubId)
      || clubs.has(source.winnerClubId) || clubs.has(source.runnerClubId)
      || source.winnerClubId === source.runnerClubId
      || !Array.isArray(source.resultApplicationIds)
      || source.resultApplicationIds.length !== 18
      || source.resultApplicationIds.some((applicationId) =>
        !id(applicationId) || applications.has(applicationId))) {
      throw new Error('invalid quarterfinal qualification source');
    }
    clubs.add(source.winnerClubId);
    clubs.add(source.runnerClubId);
    source.resultApplicationIds.forEach((applicationId) =>
      applications.add(applicationId));
    return Object.freeze({ groupIndex,
      winnerClubId: source.winnerClubId,
      runnerClubId: source.runnerClubId,
      resultApplicationIds: Object.freeze([...source.resultApplicationIds]) });
  });
  const usedRunners = new Set<number>();
  const expectedRunners = drawRunnerGroups(plan.drawSeed);
  const savedGames = games.map((game, winnerGroupIndex) => {
    const runner = game.runnerGroupIndex;
    if (game.winnerGroupIndex !== winnerGroupIndex
      || !Number.isSafeInteger(runner) || runner < 0 || runner > 3
      || runner === winnerGroupIndex || usedRunners.has(runner)
      || runner !== expectedRunners[winnerGroupIndex]
      || game.homeClubId !== savedSources[winnerGroupIndex].winnerClubId
      || game.awayClubId !== savedSources[runner].runnerClubId
      || game.gameId !== JSON.stringify(['continental-quarterfinal',
        plan.competitionId, plan.editionId, winnerGroupIndex, runner])) {
      throw new Error('invalid quarterfinal draw or winner-home game');
    }
    usedRunners.add(runner);
    return Object.freeze({ ...game });
  });
  return Object.freeze({ competitionId: plan.competitionId,
    editionId: plan.editionId, policyVersion: plan.policyVersion,
    drawSeed: plan.drawSeed,
    groupTiebreakPolicyVersion: plan.groupTiebreakPolicyVersion,
    sources: Object.freeze(savedSources), games: Object.freeze(savedGames) });
};

/** A knockout tie cannot advance from score, label, or an incomplete result. */
export const finalizeContinentalQuarterfinals = (
  plan: ContinentalQuarterfinalPlan,
  results: readonly OfficialGameResult[],
  source: ContinentalQuarterfinalSource,
): ContinentalQuarterfinalOutcome => {
  const snapshot = snapshotPlan(plan);
  const expected = planContinentalQuarterfinals({ ...source,
    policyVersion: snapshot.policyVersion, drawSeed: snapshot.drawSeed });
  if (snapshot.sources.some((item, index) => {
    const original = expected.sources[index];
    return item.winnerClubId !== original.winnerClubId
      || item.runnerClubId !== original.runnerClubId
      || item.resultApplicationIds.some((applicationId, resultIndex) =>
        applicationId !== original.resultApplicationIds[resultIndex]);
  }) || snapshot.games.some((game, index) => {
    const original = expected.games[index];
    return game.gameId !== original.gameId
      || game.homeClubId !== original.homeClubId
      || game.awayClubId !== original.awayClubId;
  }) || snapshot.groupTiebreakPolicyVersion
    !== expected.groupTiebreakPolicyVersion) {
    throw new Error('quarterfinal plan contradicts official group results');
  }
  if (!Array.isArray(results) || results.length !== 4) {
    throw new Error('quarterfinals require four complete official results');
  }
  const byGame = new Map(results.map((result) => [result.gameId, result]));
  const priorApplications = new Set(snapshot.sources.flatMap((source) =>
    source.resultApplicationIds));
  if (byGame.size !== 4
    || new Set(results.map((result) => result.applicationId)).size !== 4
    || results.some((result) =>
      priorApplications.has(result.applicationId))) {
    throw new Error('quarterfinal results require unique games and applications');
  }
  const winnerClubIds: string[] = [];
  const resultApplicationIds: string[] = [];
  for (const game of snapshot.games) {
    const result = byGame.get(game.gameId);
    if (!result || result.seasonId !== snapshot.editionId
      || result.homeClubId !== game.homeClubId
      || result.awayClubId !== game.awayClubId
      || !id(result.closureId) || !id(result.applicationId)) {
      throw new Error('quarterfinal official result does not match its game');
    }
    if (!Number.isSafeInteger(result.homeRuns)
      || !Number.isSafeInteger(result.awayRuns)
      || result.homeRuns < 0 || result.awayRuns < 0
      || result.homeRuns === result.awayRuns) {
      throw new Error('quarterfinal requires a decided official game');
    }
    const winner = result.homeRuns > result.awayRuns
      ? game.homeClubId : game.awayClubId;
    const lineScore = createCanonicalLineScoreSnapshot(result.lineScore);
    if (winner !== result.winnerClubId
      || lineScore.totals.home.runs !== result.homeRuns
      || lineScore.totals.away.runs !== result.awayRuns) {
      throw new Error('quarterfinal winner contradicts official line score');
    }
    winnerClubIds.push(winner);
    resultApplicationIds.push(result.applicationId);
  }
  return Object.freeze({ plan: snapshot,
    winnerClubIds: Object.freeze(winnerClubIds),
    resultApplicationIds: Object.freeze(resultApplicationIds) });
};
