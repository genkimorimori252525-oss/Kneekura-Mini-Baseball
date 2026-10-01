import { nationalCallupFixture } from './NationalCallupFixtures.test-support';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { openSqliteNationalRosterEligibilityStore } from './SqliteNationalRosterEligibilityStore';
import { openSqliteRegionalNationalRankingSnapshotStore } from './SqliteRegionalNationalRankingSnapshotStore';
import { openSqliteRegionalNationalHostCandidateStore } from './SqliteRegionalNationalHostCandidateStore';
import { openSqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';
import { regionalNationalInput } from './RegionalNationalFixtures.test-support';
import { EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, registerWorldNationalRankingPolicy } from '../../core/world/competition/WorldNationalRankingHistory';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, registerCompetitionDrawPolicy } from '../../core/world/competition/CompetitionDraw';
import type { ParticipationAuthority, SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';

/** Native roster/eligibility/ranking/facility/hosting owners; prior official ranking results are an explicit fixture. */
export const regionalNationalAssemblyFixture = (count = 8, playersPerNation = 1) => {
  if (![8, 12, 16].includes(count) || !Number.isSafeInteger(playersPerNation) || playersPerNation < 1) throw new Error('invalid regional assembly fixture population');
  const nationIds = Array.from({ length: count + 1 }, (_, i) => `EU-${i.toString().padStart(2, '0')}`);
  const playerNationIds = nationIds.flatMap((nationId) => Array.from({ length: playersPerNation }, () => nationId));
  const f = nationalCallupFixture([], { playerNationIds, nations: nationIds.map((nationId) => ({ nationId, region: 'EUROPE' as const })) });
  const selection = f.selections.initialize({ careerId: 'career-a', editionId: 'eu-2031', kind: 'REGIONAL_NATIONAL',
    region: 'EUROPE', cycleOrdinal: 0, careerDayOne: '2031-01-01', cutoffDay: 100 });
  let gameReader: ParticipationAuthority['readGame'] = () => null;
  let receiptReader: SqliteOfficialParticipationStore['readReceipt'] = () => null;
  const callupSources = { ...f.sources, games: { readGame: (gameId: string) => gameReader(gameId) },
    participation: { readReceipt: (receiptId: string) => receiptReader(receiptId) } };
  const callups = openSqliteNationalCallupStore(f.path, callupSources);
  for (let i = 0; i < count * playersPerNation; i++) callups.register({ ...f.request(i), editionId: selection.editionId, nationId: playerNationIds[i],
    registeredAtDay: 90, callupPolicy: { ...f.request().callupPolicy, version: 'regional-roster-fixture-v1',
      rosterLimit: playersPerNation, initialRegistrationCutoffDay: 100, replacementCutoffDay: 110 } });
  const eligibility = openSqliteNationalRosterEligibilityStore(f.path, { selections: f.selections, nations: f.nations, callups });
  const cohort = eligibility.initialize({ careerId: 'career-a', editionId: selection.editionId, asOfDay: 100,
    candidateNationIds: nationIds, policy: { version: 'regional-capability-fixture-v1', minimumActivePlayers: playersPerNation } });
  const prior = { ...regionalNationalInput('EUROPE', 2, { startsOnDay: 20, endsOnDay: 80 }).edition, editionId: 'prior-eu' };
  const history = { readHistory: () => ({ editions: [{ editionId: prior.editionId, tier: 'REGIONAL' as const, completedAtDay: 80,
    snapshotId: 'prior-eu-proof', games: [{ applicationId: 'prior-final', stage: 'FINAL' as const,
      homeNationId: nationIds[count], awayNationId: nationIds[0], winnerNationId: nationIds[count] }] }] }),
    readRegionalEdition: () => prior,
    readRegionalHostingEdition: () => { throw new Error('initial ranking fixture is not a previous World-hosted Edition'); } };
  const rankings = openSqliteRegionalNationalRankingSnapshotStore(f.path, { nations: f.nations, history });
  const rankingPolicy = { version: 'regional-ranking-fixture-v1', winPoints: 2, tiePoints: 1,
    tierWeights: { REGIONAL: 1, WBC: 0, PREMIER_12: 0 },
    stageWeights: { GROUP: 1, ROUND_OF_16: 1, QUARTERFINAL: 2, SEMIFINAL: 3, BRONZE: 1, FINAL: 4 },
    recencyBands: [{ maxAgeDays: 100, multiplier: 1 }], tieBreak: 'NATION_ID' as const };
  rankings.initialize({ careerId: 'career-a', region: 'EUROPE', asOfDay: 100, nationIds, policy: rankingPolicy,
    registry: registerWorldNationalRankingPolicy(EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, rankingPolicy) });
  const infrastructure = openSqliteWorldHostInfrastructureStore(f.path, { nations: f.nations });
  const metrics = { stadiumCapacity: 100, stadiumQuality: 10, transportQuality: 10, accommodationCapacity: 100,
    broadcastReadiness: 10, operationsQuality: 10 };
  for (const index of [count - 1, count]) infrastructure.record({ careerId: 'career-a', venueId: `venue-${index}`, nationId: nationIds[index],
    cityId: `city-${index}`, region: 'EUROPE', effectiveFromDay: 20, sourceEventId: `opened-${index}`,
    sourceClubId: null, licensed: true, safe: true, metrics: { ...metrics, stadiumQuality: 50 + index, broadcastReadiness: 30 } });
  const hosts = openSqliteRegionalNationalHostCandidateStore(f.path, { selections: f.selections, nations: f.nations, infrastructure, history });
  const hostPolicy = { version: 'regional-host-fixture-v1', hostNationCount: 2 as const, groupHostVenueCount: 2, knockoutHubCount: 1,
    minimums: { GROUP: metrics, KNOCKOUT: { ...metrics, broadcastReadiness: 20 }, FINAL_FOUR: { ...metrics, broadcastReadiness: 30 } },
    suitabilityWeights: { ...metrics, stadiumCapacity: 0, stadiumQuality: 1, transportQuality: 0, accommodationCapacity: 0,
      broadcastReadiness: 0, operationsQuality: 0 }, rotation: { lookbackDays: 0, cityPenalty: 0, nationPenalty: 0, regionPenalty: 0 } };
  hosts.initialize({ careerId: 'career-a', editionId: selection.editionId, policy: hostPolicy });
  const policy = { version: 'regional-draw-fixture-v1', rematchLookbackDays: 100,
    relaxationOrder: ['REMATCH_AVOIDANCE', 'SAME_LEAGUE_AVOIDANCE', 'REGIONAL_DIVERSITY'] as const };
  const drawRequest = { careerId: 'career-a', editionId: selection.editionId, eligibilitySnapshotId: cohort.eligibility.snapshotId,
    drawSeed: 'regional-seed', policy, registry: registerCompetitionDrawPolicy(EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, policy) };
  return { ...f, nationIds, selection, callups, callupSources, eligibility, cohort, rankings, infrastructure, hosts, hostPolicy, drawRequest,
    connectParticipation: (authority: Pick<ParticipationAuthority, 'readGame'>, participation: Pick<SqliteOfficialParticipationStore, 'readReceipt'>): void => {
      gameReader = (gameId) => authority.readGame(gameId); receiptReader = (receiptId) => participation.readReceipt(receiptId);
    },
    drawSources: { selections: f.selections, nations: f.nations, rankings, eligibility, hosts },
    close: () => { hosts.close(); infrastructure.close(); rankings.close(); eligibility.close(); callups.close(); f.close(); } };
};
