import type { ClubWorldRegion } from './ClubWorldBerths';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { finalizeWbcKnockout, planWbcKnockout,
  type WbcKnockoutSource }
  from './WbcFinalsKnockout';
import type { WbcRegionalCoefficient } from './WbcBerths';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const STAGES = ['GROUP', 'ROUND_OF_16', 'QUARTERFINAL',
  'SEMIFINAL', 'FINAL'] as const;
type Stage = typeof STAGES[number];
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export type OfficialWbcWorldEdition = Readonly<{
  editionId: string;
  snapshotId: string;
  completedAtDay: number;
  entrants: readonly Readonly<{ nationId: string;
    region: ClubWorldRegion }>[];
  games: readonly Readonly<{ applicationId: string;
    stage: Stage; homeNationId: string; awayNationId: string;
    winnerNationId: string | null }>[];
}>;
export type WbcRegionalCoefficientPolicy = Readonly<{
  version: string;
  olderEditionMultiplier: number;
  newerEditionMultiplier: number;
  bestNationsPerRegion: number;
  winPoints: Readonly<Record<Stage, number>>;
}>;
export type WbcRegionalCoefficientPolicyRegistry = Readonly<{
  policies: readonly WbcRegionalCoefficientPolicy[];
}>;
export const EMPTY_WBC_REGIONAL_COEFFICIENT_POLICY_REGISTRY:
WbcRegionalCoefficientPolicyRegistry = Object.freeze({
  policies: Object.freeze([]),
});

const snapshotPolicy = (value: WbcRegionalCoefficientPolicy):
WbcRegionalCoefficientPolicy => {
  if (!id(value?.version)
    || !nonnegative(value.olderEditionMultiplier)
    || !nonnegative(value.newerEditionMultiplier)
    || value.olderEditionMultiplier
      + value.newerEditionMultiplier === 0
    || !Number.isSafeInteger(value.bestNationsPerRegion)
    || value.bestNationsPerRegion < 1
    || value.bestNationsPerRegion > 6
    || !value.winPoints
    || STAGES.some((stage) =>
      !nonnegative(value.winPoints[stage]))
    || !STAGES.some((stage) => value.winPoints[stage] > 0)) {
    throw new Error('invalid versioned WBC regional coefficient policy');
  }
  return Object.freeze({ version: value.version,
    olderEditionMultiplier: value.olderEditionMultiplier,
    newerEditionMultiplier: value.newerEditionMultiplier,
    bestNationsPerRegion: value.bestNationsPerRegion,
    winPoints: Object.freeze(Object.fromEntries(STAGES.map((stage) =>
      [stage, value.winPoints[stage]])) as Record<Stage, number>) });
};

export const registerWbcRegionalCoefficientPolicy = (
  registry: WbcRegionalCoefficientPolicyRegistry,
  value: WbcRegionalCoefficientPolicy,
): WbcRegionalCoefficientPolicyRegistry => {
  if (!Array.isArray(registry?.policies)) {
    throw new Error('WBC regional coefficient registry required');
  }
  const policies = registry.policies.map(snapshotPolicy);
  if (new Set(policies.map((item) => item.version)).size
    !== policies.length) {
    throw new Error('duplicate WBC regional coefficient policy');
  }
  const policy = snapshotPolicy(value);
  const existing = policies.find((item) =>
    item.version === policy.version);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(policy)) {
      throw new Error('WBC regional coefficient policy version conflict');
    }
    return registry;
  }
  return Object.freeze({ policies: Object.freeze([...policies,
    policy]) });
};

/** Captures one entire WBC after rechecking all 51 official results. */
export const deriveOfficialWbcWorldEdition = (
  source: WbcKnockoutSource,
  roundOf16Results: readonly OfficialGameResult[],
  quarterfinalResults: readonly OfficialGameResult[],
  semifinalResults: readonly OfficialGameResult[],
  finalResult: OfficialGameResult,
  nationRegion: (nationId: string) => ClubWorldRegion | null,
): OfficialWbcWorldEdition => {
  const plan = planWbcKnockout(source);
  const outcome = finalizeWbcKnockout(plan,
    roundOf16Results, quarterfinalResults,
    semifinalResults, finalResult, source);
  const nationIds = source.groupPlan.groups.flatMap((group) =>
    group.nationIds);
  const entrants = nationIds.map((nationId) => ({ nationId,
    region: nationRegion(nationId) }));
  if (entrants.length !== 24
    || entrants.some((entrant) => !REGIONS.includes(
      entrant.region as ClubWorldRegion))) {
    throw new Error('WBC result needs twenty-four regional nations');
  }
  const games = [
    ...source.groupPlan.groups.flatMap((group) =>
      group.games.map((game) => ({ ...game, stage: 'GROUP' as const }))),
    ...plan.roundOf16Games,
    ...outcome.quarterfinalGames,
    ...outcome.semifinalGames, outcome.finalGame,
  ];
  const results = [...source.groupResults, ...roundOf16Results,
    ...quarterfinalResults, ...semifinalResults, finalResult];
  const byGame = new Map(results.map((result) =>
    [result.gameId, result]));
  const facts = games.map((game) => {
    const result = byGame.get(game.gameId)!;
    return Object.freeze({ applicationId: result.applicationId,
      stage: game.stage, homeNationId: game.homeNationId,
      awayNationId: game.awayNationId,
      winnerNationId: result.winnerClubId ?? null });
  });
  const editionId = source.groupEdition.editionId;
  return Object.freeze({ editionId,
    snapshotId: JSON.stringify(['official-wbc-world-edition',
      editionId, source.berths.qualificationSnapshotId,
      source.groupEdition.drawSnapshotId,
      ...facts.map((fact) => fact.applicationId)]),
    completedAtDay: source.groupEdition.calendarWindow.endsOnDay,
    entrants: Object.freeze(entrants.map((entrant) =>
      Object.freeze({ nationId: entrant.nationId,
        region: entrant.region! }))),
    games: Object.freeze(facts) });
};

const validEdition = (edition: OfficialWbcWorldEdition): boolean => {
  if (!id(edition?.editionId) || !id(edition.snapshotId)
    || !nonnegative(edition.completedAtDay)
    || !Array.isArray(edition.entrants)
    || edition.entrants.length !== 24
    || new Set(edition.entrants.map((item) =>
      item.nationId)).size !== 24
    || edition.entrants.some((item) =>
      !id(item.nationId) || !REGIONS.includes(item.region))
    || !Array.isArray(edition.games)
    || edition.games.length !== 51
    || new Set(edition.games.map((game) =>
      game.applicationId)).size !== 51) return false;
  const nations = new Set(edition.entrants.map((item) =>
    item.nationId));
  return STAGES.every((stage, index) =>
    edition.games.filter((game) => game.stage === stage).length
      === [36, 8, 4, 2, 1][index])
    && edition.games.every((game) =>
      id(game.applicationId) && STAGES.includes(game.stage)
      && nations.has(game.homeNationId)
      && nations.has(game.awayNationId)
      && game.homeNationId !== game.awayNationId
      && (game.winnerNationId === null
        ? game.stage === 'GROUP'
        : game.winnerNationId === game.homeNationId
          || game.winnerNationId === game.awayNationId));
};

/** Computes region scores from each edition's best national results. */
export const buildWbcRegionalCoefficients = (
  older: OfficialWbcWorldEdition,
  newer: OfficialWbcWorldEdition,
  requestedPolicy: WbcRegionalCoefficientPolicy,
  registry: WbcRegionalCoefficientPolicyRegistry,
): readonly WbcRegionalCoefficient[] => {
  const policy = snapshotPolicy(requestedPolicy);
  const registered = registry?.policies?.find((item) =>
    item.version === policy.version);
  if (!registered
    || JSON.stringify(snapshotPolicy(registered))
      !== JSON.stringify(policy)) {
    throw new Error('WBC regional coefficient policy must be registered');
  }
  if (!validEdition(older) || !validEdition(newer)
    || older.editionId === newer.editionId
    || older.snapshotId === newer.snapshotId
    || older.completedAtDay >= newer.completedAtDay
    || new Set([...older.games, ...newer.games].map((game) =>
      game.applicationId)).size !== 102) {
    throw new Error('invalid official two-edition WBC coefficient source');
  }
  const coefficients = REGIONS.map((region) => {
    let score = 0n;
    const evidence = new Set<string>();
    for (const [edition, multiplier] of [
      [older, policy.olderEditionMultiplier],
      [newer, policy.newerEditionMultiplier],
    ] as const) {
      const nationIds = edition.entrants.filter((item) =>
        item.region === region).map((item) => item.nationId);
      if (nationIds.length === 0) {
        throw new Error('WBC coefficient region needs official entrants');
      }
      const regionNations = new Set(nationIds);
      const points = nationIds.map((nationId) => ({ nationId,
        score: edition.games.reduce((sum, game) =>
          sum + (game.winnerNationId === nationId
            ? BigInt(policy.winPoints[game.stage]) : 0n), 0n) }));
      points.sort((left, right) => left.score === right.score
        ? left.nationId < right.nationId ? -1 : 1
        : left.score > right.score ? -1 : 1);
      score += BigInt(multiplier) * points.slice(0,
        policy.bestNationsPerRegion).reduce((sum, item) =>
        sum + item.score, 0n);
      edition.games.forEach((game) => {
        if (regionNations.has(game.homeNationId)
          || regionNations.has(game.awayNationId)) {
          evidence.add(game.applicationId);
        }
      });
    }
    if (score > BigInt(Number.MAX_SAFE_INTEGER)
      || evidence.size === 0) {
      throw new Error('WBC regional coefficient exceeds safe score range');
    }
    return Object.freeze({ region,
      snapshotId: JSON.stringify(['wbc-regional-coefficient',
        region, policy.version, older.snapshotId, newer.snapshotId]),
      policyVersion: policy.version,
      previousWorldEditionIds: Object.freeze([
        older.editionId, newer.editionId]),
      completedAtDay: newer.completedAtDay,
      score: Number(score),
      evidenceResultIds: Object.freeze([...evidence]) });
  });
  return Object.freeze(coefficients);
};
