import type { ClubWorldRegion } from './ClubWorldBerths';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { finalizeRegionalNationalKnockout,
  planRegionalNationalKnockout,
  type RegionalNationalKnockoutSource }
  from './RegionalNationalKnockout';
import { finalizePremierTwelve,
  planPremierTwelveFinalFour,
  type PremierTwelveFinalFourSource,
  type PremierTwelveRanking }
  from './PremierTwelve';
import { deriveOfficialWbcWorldEdition,
  type OfficialWbcWorldEdition }
  from './WbcRegionalCoefficients';
import type { WbcKnockoutSource } from './WbcFinalsKnockout';

const TIERS = ['REGIONAL', 'WBC', 'PREMIER_12'] as const;
const STAGES = ['GROUP', 'ROUND_OF_16', 'QUARTERFINAL',
  'SEMIFINAL', 'BRONZE', 'FINAL'] as const;
type Tier = typeof TIERS[number];
type Stage = typeof STAGES[number];
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

type NationalResult = Readonly<{ applicationId: string;
  stage: Stage;
  homeNationId: string;
  awayNationId: string;
  winnerNationId: string | null }>;
export type OfficialNationalRankingEdition = Readonly<{
  editionId: string;
  tier: Tier;
  completedAtDay: number;
  snapshotId: string;
  games: readonly NationalResult[];
}>;
export type WorldNationalRankingHistory = Readonly<{
  editions: readonly OfficialNationalRankingEdition[];
}>;
export type WorldNationalRankingPolicy = Readonly<{
  version: string;
  winPoints: number;
  tiePoints: number;
  tierWeights: Readonly<Record<Tier, number>>;
  stageWeights: Readonly<Record<Stage, number>>;
  recencyBands: readonly Readonly<{ maxAgeDays: number;
    multiplier: number }>[];
  tieBreak: 'NATION_ID';
}>;
export type WorldNationalRankingPolicyRegistry = Readonly<{
  policies: readonly WorldNationalRankingPolicy[];
}>;
export const EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY:
WorldNationalRankingPolicyRegistry = Object.freeze({
  policies: Object.freeze([]),
});

const snapshotPolicy = (value: WorldNationalRankingPolicy):
WorldNationalRankingPolicy => {
  if (!id(value?.version) || !day(value.winPoints)
    || value.winPoints === 0 || !day(value.tiePoints)
    || value.tiePoints > value.winPoints
    || !value.tierWeights || TIERS.some((tier) =>
      !day(value.tierWeights[tier]))
    || !TIERS.some((tier) => value.tierWeights[tier] > 0)
    || !value.stageWeights || STAGES.some((stage) =>
      !day(value.stageWeights[stage]))
    || !STAGES.some((stage) => value.stageWeights[stage] > 0)
    || !Array.isArray(value.recencyBands)
    || value.recencyBands.length === 0
    || value.recencyBands.some((band, index) =>
      !day(band?.maxAgeDays) || !day(band.multiplier)
      || band.maxAgeDays <= (index === 0 ? -1
        : value.recencyBands[index - 1].maxAgeDays))
    || value.tieBreak !== 'NATION_ID') {
    throw new Error('invalid versioned world national ranking policy');
  }
  return Object.freeze({ version: value.version,
    winPoints: value.winPoints, tiePoints: value.tiePoints,
    tierWeights: Object.freeze({ ...value.tierWeights }),
    stageWeights: Object.freeze({ ...value.stageWeights }),
    recencyBands: Object.freeze(value.recencyBands.map((band) =>
      Object.freeze({ ...band }))), tieBreak: value.tieBreak });
};
export const registerWorldNationalRankingPolicy = (
  registry: WorldNationalRankingPolicyRegistry,
  value: WorldNationalRankingPolicy,
): WorldNationalRankingPolicyRegistry => {
  if (!Array.isArray(registry?.policies)) {
    throw new Error('world national ranking policy registry required');
  }
  const policies = registry.policies.map(snapshotPolicy);
  if (new Set(policies.map((item) => item.version)).size
    !== policies.length) {
    throw new Error('duplicate world national ranking policy');
  }
  const policy = snapshotPolicy(value);
  const existing = policies.find((item) =>
    item.version === policy.version);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(policy)) {
      throw new Error('world national ranking policy version conflict');
    }
    return registry;
  }
  return Object.freeze({ policies: Object.freeze([...policies,
    policy]) });
};

export const createWorldNationalRankingHistory = ():
WorldNationalRankingHistory => Object.freeze({
  editions: Object.freeze([]),
});

const recordEdition = (history: WorldNationalRankingHistory,
  edition: OfficialNationalRankingEdition):
WorldNationalRankingHistory => {
  if (!Array.isArray(history?.editions)
    || !id(edition.editionId) || !TIERS.includes(edition.tier)
    || !day(edition.completedAtDay) || !id(edition.snapshotId)
    || !Array.isArray(edition.games)
    || edition.games.length === 0
    || new Set(edition.games.map((game) =>
      game.applicationId)).size !== edition.games.length
    || edition.games.some((game) =>
      !id(game.applicationId) || !STAGES.includes(game.stage)
      || !id(game.homeNationId) || !id(game.awayNationId)
      || game.homeNationId === game.awayNationId
      || (game.winnerNationId !== null
        && game.winnerNationId !== game.homeNationId
        && game.winnerNationId !== game.awayNationId))
    || history.editions.some((item) =>
      item.editionId === edition.editionId
      || item.snapshotId === edition.snapshotId)
    || history.editions.flatMap((item) => item.games)
      .some((game) => edition.games.some((candidate) =>
        candidate.applicationId === game.applicationId))) {
    throw new Error('invalid or duplicate official national edition');
  }
  return Object.freeze({ editions: Object.freeze([
    ...history.editions, edition]) });
};
type PlannedNationalGame = Readonly<{ gameId: string;
  homeNationId: string; awayNationId: string }>;
const resultsFrom = (games: readonly PlannedNationalGame[],
  results: readonly OfficialGameResult[], stage: Stage):
readonly NationalResult[] => games.map((game) => {
  const result = results.find((item) => item.gameId
    === game.gameId)!;
  return Object.freeze({ applicationId: result.applicationId,
    stage, homeNationId: game.homeNationId,
    awayNationId: game.awayNationId,
    winnerNationId: result.winnerClubId ?? null });
});
const completedEdition = (tier: Tier, editionId: string,
  completedAtDay: number, games: readonly NationalResult[]):
OfficialNationalRankingEdition => Object.freeze({
  editionId, tier, completedAtDay,
  snapshotId: JSON.stringify(['national-ranking-edition', tier,
    editionId, ...games.map((game) => game.applicationId)]),
  games: Object.freeze(games),
});

export const recordRegionalNationalRankingResults = (
  history: WorldNationalRankingHistory,
  source: RegionalNationalKnockoutSource,
  quarterfinalResults: readonly OfficialGameResult[],
  semifinalResults: readonly OfficialGameResult[],
  finalResult: OfficialGameResult,
): WorldNationalRankingHistory => {
  const plan = planRegionalNationalKnockout(source);
  const outcome = finalizeRegionalNationalKnockout(plan,
    quarterfinalResults, semifinalResults, finalResult, source);
  const games = [
    ...resultsFrom(source.groupPlan.groups.flatMap((group) =>
      group.games), source.groupResults, 'GROUP'),
    ...resultsFrom(plan.knockoutNationIds.length === 8
      ? plan.openingGames : [], quarterfinalResults,
    'QUARTERFINAL'),
    ...resultsFrom(outcome.semifinalGames, semifinalResults,
      'SEMIFINAL'),
    ...resultsFrom([outcome.finalGame], [finalResult], 'FINAL'),
  ];
  return recordEdition(history, completedEdition('REGIONAL',
    source.groupEdition.editionId,
    source.groupEdition.calendarWindow.endsOnDay, games));
};

export const recordWbcNationalRankingResults = (
  history: WorldNationalRankingHistory,
  source: WbcKnockoutSource,
  roundOf16Results: readonly OfficialGameResult[],
  quarterfinalResults: readonly OfficialGameResult[],
  semifinalResults: readonly OfficialGameResult[],
  finalResult: OfficialGameResult,
  nationRegion: (nationId: string) => ClubWorldRegion | null,
): WorldNationalRankingHistory => {
  const edition: OfficialWbcWorldEdition =
    deriveOfficialWbcWorldEdition(source, roundOf16Results,
      quarterfinalResults, semifinalResults, finalResult,
      nationRegion);
  return recordEdition(history, completedEdition('WBC',
    edition.editionId, edition.completedAtDay,
    edition.games.map((game) => Object.freeze({ ...game,
      stage: game.stage as Stage }))));
};

export const recordPremierTwelveRankingResults = (
  history: WorldNationalRankingHistory,
  source: PremierTwelveFinalFourSource,
  semifinalResults: readonly OfficialGameResult[],
  bronzeResult: OfficialGameResult,
  finalResult: OfficialGameResult,
): WorldNationalRankingHistory => {
  const plan = planPremierTwelveFinalFour(source);
  const outcome = finalizePremierTwelve(plan, semifinalResults,
    bronzeResult, finalResult, source);
  const games = [
    ...resultsFrom(source.groupPlan.groups.flatMap((group) =>
      group.games), source.groupResults, 'GROUP'),
    ...resultsFrom(plan.semifinalGames, semifinalResults,
      'SEMIFINAL'),
    ...resultsFrom([outcome.medalGames.bronzeGame],
      [bronzeResult], 'BRONZE'),
    ...resultsFrom([outcome.medalGames.finalGame],
      [finalResult], 'FINAL'),
  ];
  return recordEdition(history, completedEdition('PREMIER_12',
    source.edition.editionId,
    source.edition.calendarWindow.endsOnDay, games));
};

/** Uses only completed official editions available at this ranking cutoff. */
export const buildWorldNationalRanking = (
  history: WorldNationalRankingHistory,
  asOfDay: number,
  nationIds: readonly string[],
  requestedPolicy: WorldNationalRankingPolicy,
  registry: WorldNationalRankingPolicyRegistry,
): PremierTwelveRanking => {
  const policy = snapshotPolicy(requestedPolicy);
  const registered = registry?.policies?.find((item) =>
    item.version === policy.version);
  if (!registered
    || JSON.stringify(snapshotPolicy(registered))
      !== JSON.stringify(policy)) {
    throw new Error('world national ranking policy must be registered');
  }
  if (!Array.isArray(history?.editions) || !day(asOfDay)
    || !Array.isArray(nationIds) || nationIds.length < 12
    || new Set(nationIds).size !== nationIds.length
    || nationIds.some((nationId) => !id(nationId))) {
    throw new Error('invalid world national ranking cutoff');
  }
  const known = new Set(nationIds);
  const scores = new Map<string, bigint>(nationIds.map((nationId) =>
    [nationId, 0n] as const));
  const editions: readonly OfficialNationalRankingEdition[] =
    history.editions;
  const evidenceResultIds: string[] = [];
  const editionIds: string[] = [];
  for (const edition of editions) {
    if (edition.completedAtDay > asOfDay) continue;
    const age = asOfDay - edition.completedAtDay;
    const band = policy.recencyBands.find((item) =>
      age <= item.maxAgeDays);
    if (!band || band.multiplier === 0) continue;
    editionIds.push(edition.snapshotId);
    for (const game of edition.games) {
      if (!known.has(game.homeNationId)
        || !known.has(game.awayNationId)) {
        throw new Error('ranking game has unknown nation');
      }
      evidenceResultIds.push(game.applicationId);
      const multiplier = BigInt(policy.tierWeights[edition.tier])
        * BigInt(policy.stageWeights[game.stage])
        * BigInt(band.multiplier);
      if (game.winnerNationId === null) {
        const points = BigInt(policy.tiePoints) * multiplier;
        scores.set(game.homeNationId,
          scores.get(game.homeNationId)! + points);
        scores.set(game.awayNationId,
          scores.get(game.awayNationId)! + points);
      } else {
        scores.set(game.winnerNationId,
          scores.get(game.winnerNationId)! + BigInt(
            policy.winPoints) * multiplier);
      }
    }
  }
  if (evidenceResultIds.length === 0) {
    throw new Error('world ranking needs official national results');
  }
  const orderedNationIds = [...nationIds].sort((left, right) => {
    const difference = scores.get(left)! - scores.get(right)!;
    return difference === 0n ? left < right ? -1 : 1
      : difference > 0n ? -1 : 1;
  });
  return Object.freeze({ snapshotId: JSON.stringify([
    'world-national-ranking', asOfDay, policy.version,
    ...nationIds, ...editionIds]),
  policyVersion: policy.version, asOfDay,
  orderedNationIds: Object.freeze(orderedNationIds),
  evidenceResultIds: Object.freeze(evidenceResultIds) });
};
