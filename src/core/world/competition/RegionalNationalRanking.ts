import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { ClubWorldRegion } from './ClubWorldBerths';
import type { PremierTwelveRanking } from './PremierTwelve';
import type { RegionalNationalEdition } from './RegionalNationalGroups';
import { registerWorldNationalRankingPolicy, type WorldNationalRankingHistory,
  type WorldNationalRankingPolicy, type WorldNationalRankingPolicyRegistry } from './WorldNationalRankingHistory';

export type RegionalNationalRanking = PremierTwelveRanking & Readonly<{ kind: 'REGIONAL_NATIONAL'; region: ClubWorldRegion }>;
const regions: readonly ClubWorldRegion[] = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const stages = ['GROUP', 'ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'BRONZE', 'FINAL'] as const;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Regional seeding consumes its own actual results, never a World ranking or Player ability. */
export const buildRegionalNationalRanking = (
  rawHistory: WorldNationalRankingHistory, region: ClubWorldRegion, asOfDay: number,
  rawNationIds: readonly string[], rawPolicy: WorldNationalRankingPolicy, rawRegistry: WorldNationalRankingPolicyRegistry,
  nationRegion: (nationId: string, beforeDay: number) => ClubWorldRegion | null,
  regionalEdition: (editionId: string) => Pick<RegionalNationalEdition, 'editionId' | 'region' | 'calendarWindow'> | null,
): RegionalNationalRanking => {
  const history = cloneInert(rawHistory), nationIds = cloneInert(rawNationIds);
  const policy = cloneInert(rawPolicy), registry = cloneInert(rawRegistry);
  if (registerWorldNationalRankingPolicy(registry, policy) !== registry) throw new Error('regional ranking policy must be registered');
  if (policy.tierWeights.REGIONAL <= 0 || policy.tierWeights.WBC !== 0 || policy.tierWeights.PREMIER_12 !== 0) {
    throw new Error('regional ranking requires regional-only policy');
  }
  if (!regions.includes(region) || !day(asOfDay) || !Array.isArray(nationIds) || nationIds.length === 0
    || nationIds.some((nation) => !id(nation)) || new Set(nationIds).size !== nationIds.length
    || !Array.isArray(history?.editions)) throw new Error('invalid regional ranking scope');
  if (nationIds.some((nation) => nationRegion(nation, asOfDay) !== region)) throw new Error('regional ranking requires current Nation region');
  const editionIds = new Set<string>(), snapshots = new Set<string>(), applications = new Set<string>();
  const editions: WorldNationalRankingHistory['editions'] = history.editions;
  const scores = new Map(nationIds.map((nation) => [nation, 0n]));
  const evidenceResultIds: string[] = [], sourceEditionIds: string[] = [];
  for (const edition of editions) {
    if (!edition || !id(edition.editionId) || !id(edition.snapshotId) || !day(edition.completedAtDay)
      || !['REGIONAL', 'WBC', 'PREMIER_12'].includes(edition.tier)
      || !Array.isArray(edition.games) || edition.games.length === 0
      || editionIds.has(edition.editionId) || snapshots.has(edition.snapshotId)) throw new Error('invalid official ranking edition');
    editionIds.add(edition.editionId); snapshots.add(edition.snapshotId);
    const games: WorldNationalRankingHistory['editions'][number]['games'] = edition.games;
    for (const game of games) {
      if (!game || !id(game.applicationId) || !stages.includes(game.stage) || !id(game.homeNationId) || !id(game.awayNationId)
        || game.homeNationId === game.awayNationId || applications.has(game.applicationId)
        || (game.winnerNationId !== null && game.winnerNationId !== game.homeNationId && game.winnerNationId !== game.awayNationId)) {
        throw new Error('invalid official regional ranking game');
      }
      applications.add(game.applicationId);
    }
    if (edition.tier !== 'REGIONAL' || edition.completedAtDay > asOfDay) continue;
    const band = policy.recencyBands.find((item) => asOfDay - edition.completedAtDay <= item.maxAgeDays);
    if (!band || band.multiplier === 0) continue;
    const metadata = cloneInert(regionalEdition(edition.editionId));
    if (!metadata || metadata.editionId !== edition.editionId || !regions.includes(metadata.region)
      || !day(metadata.calendarWindow?.startsOnDay) || metadata.calendarWindow.endsOnDay !== edition.completedAtDay
      || metadata.calendarWindow.startsOnDay > metadata.calendarWindow.endsOnDay) throw new Error('regional ranking lacks accepted historical Edition');
    const historicalRegions = new Set(games.flatMap((game) => [game.homeNationId, game.awayNationId])
      .map((nation) => nationRegion(nation, metadata.calendarWindow.startsOnDay)));
    if (historicalRegions.size !== 1 || !historicalRegions.has(metadata.region)) {
      throw new Error('regional ranking edition requires one historical region');
    }
    if (!historicalRegions.has(region) || !games.some((game) => scores.has(game.homeNationId) || scores.has(game.awayNationId))) continue;
    sourceEditionIds.push(JSON.stringify([edition.snapshotId, metadata]));
    for (const game of games) {
      const multiplier = BigInt(policy.tierWeights.REGIONAL) * BigInt(policy.stageWeights[game.stage]) * BigInt(band.multiplier);
      // An opponent that later changed region remains real historical evidence, without joining today's ranking.
      if (scores.has(game.homeNationId) || scores.has(game.awayNationId)) evidenceResultIds.push(game.applicationId);
      if (game.winnerNationId === null) {
        for (const nation of [game.homeNationId, game.awayNationId]) if (scores.has(nation)) {
          scores.set(nation, scores.get(nation)! + BigInt(policy.tiePoints) * multiplier);
        }
      } else if (scores.has(game.winnerNationId)) {
        scores.set(game.winnerNationId, scores.get(game.winnerNationId)! + BigInt(policy.winPoints) * multiplier);
      }
    }
  }
  if (evidenceResultIds.length === 0) throw new Error('regional ranking needs official regional results');
  const orderedNationIds = [...nationIds].sort((left, right) => {
    const difference = scores.get(left)! - scores.get(right)!;
    return difference === 0n ? left < right ? -1 : left > right ? 1 : 0 : difference > 0n ? -1 : 1;
  });
  return Object.freeze({ kind: 'REGIONAL_NATIONAL', region, policyVersion: policy.version, asOfDay,
    snapshotId: JSON.stringify(['regional-national-ranking', region, asOfDay, policy.version, ...nationIds, ...sourceEditionIds]),
    orderedNationIds: Object.freeze(orderedNationIds), evidenceResultIds: Object.freeze(evidenceResultIds) });
};
