import { nationalCallupFixture } from './NationalCallupFixtures.test-support';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { openSqliteNationalRosterEligibilityStore } from './SqliteNationalRosterEligibilityStore';
import { openSqliteWbcQualifierSelectionStore } from './SqliteWbcQualifierSelectionStore';
import { openSqliteWbcQualifierEditionStore, type SqliteWbcQualifierEditionStore } from './SqliteWbcQualifierEditionStore';
import { openSqliteWbcGlobalQualifierPodStore } from './SqliteWbcGlobalQualifierPodStore';
import { openSqliteWbcQualifierScheduleStore } from './SqliteWbcQualifierScheduleStore';
import { openSqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';
import { openSqliteWbcQualifierHostAccessStore } from './SqliteWbcQualifierHostAccessStore';
import { openSqliteWbcQualifierHostCandidateStore, type SqliteWbcQualifierHostCandidateStore } from './SqliteWbcQualifierHostCandidateStore';
import { drawWbcQualifierEntrantPods } from '../../core/world/competition/WbcQualifierEditionAssembly';
import type { WbcDirectBerths } from '../../core/world/competition/WbcBerths';
import type { ParticipationAuthority, SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';

const regions = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;

/** Legal/roster/population values are explicit fixtures; first-two-WBC direct/ranking history is not a production bootstrap. */
export const nationalQualifierCallupFixture = () => {
  const nationRows = regions.flatMap((region) => Array.from({ length: 4 }, (_, i) => ({
    nationId: region === 'ASIA_PACIFIC' && i < 2 ? ['JP', 'KR'][i] : `${region}-${i}`, region })));
  const f = nationalCallupFixture([], { playerNationIds: nationRows.map((row) => row.nationId), nations: nationRows });
  const official = new SqliteOfficialStateStore(f.path);
  let editions: SqliteWbcQualifierEditionStore | undefined;
  let participation: Pick<SqliteOfficialParticipationStore, 'readReceipt'> | undefined;
  let authority: Pick<ParticipationAuthority, 'readGame'> | undefined;
  const sources = { ...f.sources,
    qualifierEditions: { readSnapshot: (careerId: string, editionId: string) => editions?.readSnapshot(careerId, editionId) ?? null },
    participation: { readReceipt: (receiptId: string) => participation?.readReceipt(receiptId) ?? null },
    games: { readGame: (gameId: string) => authority?.readGame(gameId) ?? null } };
  let callups = openSqliteNationalCallupStore(f.path, sources);
  const eligibility = openSqliteNationalRosterEligibilityStore(f.path, { selections: f.selections, nations: f.nations,
    callups: { readRosterSnapshot: (...args) => callups.readRosterSnapshot(...args),
      readEligibilityAtDay: (...args) => callups.readEligibilityAtDay(...args),
      readEligibilitySnapshot: (...args) => callups.readEligibilitySnapshot(...args) } });
  for (const [i, row] of nationRows.entries()) callups.register({ ...f.request(i), nationId: row.nationId,
    registeredAtDay: 370, callupPolicy: { ...f.request().callupPolicy,
      initialRegistrationCutoffDay: 370, replacementCutoffDay: 400 } });
  const acceptedEligibility = eligibility.initialize({ careerId: 'career-a', editionId: 'wbc-2032', asOfDay: 379,
    candidateNationIds: nationRows.map((row) => row.nationId), policy: { version: 'fixture-country-v1', minimumActivePlayers: 1 } });
  const world = f.selections.readSelection('career-a', 'wbc-2032')!;
  const direct: WbcDirectBerths = { editionId: world.editionId, qualifierEditionId: 'qualifier-2032',
    directSnapshotId: 'fixture-direct-2032', cutoffSnapshotId: world.qualificationCutoff.snapshotId,
    cutoffDay: 400, cycleId: 'cycle-0', policyVersion: 'fixture-berths-v1',
    previousWorldEditionIds: ['wbc-2024', 'wbc-2028'], coefficientSources: [], regionalPlacementSources: [], slots: [],
    entrantNationIds: regions.flatMap((region, index) => Array.from({ length: [7, 7, 4, 2][index] }, (_, i) => `direct-${region}-${i}`)),
    directBerthsByRegion: { ASIA_PACIFIC: 7, AMERICAS: 7, EUROPE: 4, AFRICA: 2 },
    placements: regions.map((region, index) => ({ region, editionId: `regional-${region}`, snapshotId: `placement-${region}`,
      completedAtDay: 130, orderedNationIds: [
        ...Array.from({ length: [7, 7, 4, 2][index] }, (_, i) => `direct-${region}-${i}`),
        ...nationRows.filter((row) => row.region === region).map((row) => row.nationId)] })) };
  const directSource = { readDirect: (careerId: string, editionId: string) =>
    careerId === 'career-a' && editionId === 'wbc-2032' ? direct : null };
  const rankingSource = { readRanking: (careerId: string, asOfDay: number) => careerId === 'career-a' && asOfDay === 379
    ? { snapshotId: 'fixture-ranking-379', policyVersion: 'ranking-v1', asOfDay,
      evidenceResultIds: ['fixture-regional-ranking-result'], orderedNationIds: nationRows.map((row) => row.nationId) } : null };
  const selection = openSqliteWbcQualifierSelectionStore(f.path, {
    direct: directSource, ranking: rankingSource, nations: f.nations, eligibility });
  const policy = { version: 'selection-v1', regionalPriorityPerRegion: 1, rankingPolicyVersion: 'ranking-v1' };
  const selected = selection.initialize({ careerId: 'career-a', wbcEditionId: world.editionId, qualifierEditionId: 'qualifier-2032',
    rankingAsOfDay: 379, eligibility: acceptedEligibility.eligibility, policy, registry: { policies: [policy] } });
  let candidates: SqliteWbcQualifierHostCandidateStore;
  const editionSources = { selections: f.selections, nations: f.nations, direct: directSource, selection,
    rankings: rankingSource, hosts: { readCandidates: (careerId: string, editionId: string, beforeDay: number) =>
      candidates.readCandidates(careerId, editionId, beforeDay) } };
  editions = openSqliteWbcQualifierEditionStore(f.path, editionSources);
  const pods = openSqliteWbcGlobalQualifierPodStore(f.path, { selection, matches: official,
    editions: { readEdition: (careerId, editionId) => editions!.readEdition(careerId, editionId) } });
  const schedules = openSqliteWbcQualifierScheduleStore(f.path, { pods });
  const infrastructure = openSqliteWorldHostInfrastructureStore(f.path, { nations: f.nations });
  const access = openSqliteWbcQualifierHostAccessStore(f.path);
  candidates = openSqliteWbcQualifierHostCandidateStore(f.path, { selection, infrastructure, access,
    qualifiers: pods, editions: { readSnapshot: (careerId, editionId) => editions!.readSnapshot(careerId, editionId) } });
  const profile = { competitionId: 'global-qualifier', formatVersion: 'four-pods-v1', ruleProfileVersion: 'rules-v1',
    gamePolicyVersion: 'games-v1', drawPolicyVersion: 'mixed-pods-v1', hostingPolicyVersion: 'hosts-v1', distinctPodCities: true };
  const draw = drawWbcQualifierEntrantPods({ selection: selected, drawSeed: 'draw-2032', drawPolicyVersion: profile.drawPolicyVersion });
  const metrics = { stadiumCapacity: 10000, stadiumQuality: 5, transportQuality: 5,
    accommodationCapacity: 2000, broadcastReadiness: 5, operationsQuality: 5 };
  for (const [index, region] of regions.entries()) {
    const nationId = `host-${index}`;
    f.nations.record({ careerId: 'career-a', nationId, region, effectiveFromDay: 0, sourceEventId: nationId });
    infrastructure.record({ careerId: 'career-a', nationId, region, venueId: `venue-${index}`, cityId: `city-${index}`,
      sourceClubId: null, sourceEventId: `world-venue-${index}`, effectiveFromDay: 10, licensed: true, safe: true, metrics });
    for (const podIndex of [0, 1, 2, 3]) access.record({ careerId: 'career-a', qualifierEditionId: 'qualifier-2032',
      drawSnapshotId: draw.drawSnapshotId, podIndex, venueId: `venue-${index}`, sourceEventId: `access-${podIndex}-${index}`,
      effectiveFromDay: 370, geographySuitability: 3, travelCost: index + 1, neutralAccessibility: 5, developingOpportunity: 1 });
  }
  candidates.initialize({ careerId: 'career-a', qualifierEditionId: 'qualifier-2032', selectedAtDay: 379,
    drawSeed: 'draw-2032', drawPolicyVersion: profile.drawPolicyVersion,
    policy: { version: 'hosts-v1', minimums: metrics,
      suitabilityWeights: { stadiumCapacity: 0, stadiumQuality: 1, transportQuality: 0,
        accommodationCapacity: 0, broadcastReadiness: 0, operationsQuality: 0 },
      accessWeights: { geographySuitability: 1, travelCost: 1, neutralAccessibility: 1, developingOpportunity: 1 },
      minimumNeutralAccessibility: 1, maximumTravelCost: 100,
      rotation: { lookbackDays: 1000, cityPenalty: 1, nationPenalty: 2, regionPenalty: 3 } } });
  const snapshot = editions.initialize({ careerId: 'career-a', wbcEditionId: world.editionId, qualifierEditionId: 'qualifier-2032',
    selectedAtDay: 379, calendarWindow: { startsOnDay: 380, endsOnDay: 390 }, drawSeed: 'draw-2032', profile });
  const plan = pods.initialize({ careerId: 'career-a', edition: snapshot.edition });
  const schedule = schedules.initialize({ careerId: 'career-a', editionId: 'qualifier-2032',
    policy: { version: 'schedule-v1', gamesPerVenuePerDay: 1, minimumOffDaysBetweenRounds: 1 } });
  const request = (i = 0) => ({ ...f.request(i), eventId: `qualifier-call-${i}`, editionId: 'qualifier-2032',
    nationId: nationRows[i].nationId, registeredAtDay: 380,
    callupPolicy: { ...f.request().callupPolicy, version: 'qualifier-roster-v1', initialRegistrationCutoffDay: 380, replacementCutoffDay: 390 },
    response: { ...f.request(i).response, evidenceId: `qualifier-response-${i}` } });
  return { ...f, official, eligibility, acceptedEligibility, selection, editions, pods, schedules, snapshot, plan, schedule,
    get callups() { return callups; }, request,
    connectParticipation(nextAuthority: ParticipationAuthority, nextParticipation: SqliteOfficialParticipationStore) {
      authority = nextAuthority; participation = nextParticipation;
    },
    reopen() { callups.close(); callups = openSqliteNationalCallupStore(f.path, sources); },
    close() { callups.close(); eligibility.close(); schedules.close(); pods.close(); candidates.close(); access.close();
      infrastructure.close(); editions!.close(); selection.close(); official.close(); f.close(); } };
};
