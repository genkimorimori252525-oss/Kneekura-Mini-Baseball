import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, registerCompetitionDrawPolicy } from
  '../../core/world/competition/CompetitionDraw';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteNationalCompetitionDrawStore } from './SqliteNationalCompetitionDrawStore';
import { openSqliteWbcFinalsGroupStore } from './SqliteWbcFinalsGroupStore';
import { openSqliteNationalCompetitionEditionStore, type NationalHostCandidateSnapshot,
  type SqliteNationalCompetitionEditionStore } from
  './SqliteNationalCompetitionEditionStore';
import { openSqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';
import { openSqliteNationalHostCandidateStore } from './SqliteNationalHostCandidateStore';
import { openSqliteWbcFinalsKnockoutStore } from './SqliteWbcFinalsKnockoutStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import { wbcFinalsInput } from './WbcFinalsFixtures.test-support';

const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');

it('pins WBC qualification and ranking pots while rejecting changed policies and saved draws', () => {
  const closables: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { closables.push(store); return store; };
  try {
    const cycle = track(openSqliteWorldCompetitionCycleStore(':memory:'));
    cycle.initialize('career-1', worldCycleInput(0));
    const selections = track(openSqliteNationalCompetitionSelectionStore(':memory:', { cycle }));
    const selection = selections.initialize({ careerId: 'career-1', editionId: 'wbc-2032',
      cycleOrdinal: 0, kind: 'WBC', careerDayOne: '2031-01-01', cutoffDay: 400 });
    const { berths, edition, knockoutEdition } = wbcFinalsInput(selection.calendarWindow,
      selection.qualificationCutoff.snapshotId);
    const nations = track(openSqliteNationCompetitionRegionStore(':memory:'));
    berths.entrantNationIds.forEach((nationId, index) => nations.record({ careerId: 'career-1', nationId,
      region: (['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const)[index % 4],
      effectiveFromDay: 0, sourceEventId: `region-${index}` }));
    // Ranking/qualification are accepted fixtures in this isolated draw test.
    const ranking = { snapshotId: 'ranking-400', policyVersion: 'ranking-test-v1', asOfDay: 400,
      orderedNationIds: berths.entrantNationIds, evidenceResultIds: ['old-official-result'] };
    let rankingMissing = false;
    const sources = { selections, nations, rankings: { readRanking: () => rankingMissing ? null : ranking },
      history: { readHistory: () => ({ editions: [{ editionId: 'prior', tier: 'WBC' as const,
        completedAtDay: 100, snapshotId: 'prior-history', games: [{ applicationId: 'old-official-result',
          stage: 'GROUP' as const, homeNationId: 'nation-0', awayNationId: 'nation-1',
          winnerNationId: 'nation-0' }] }] }) }, wbcBerths: { readAllocation: () => berths } };
    const policy = { version: 'wbc-test-draw-v1', rematchLookbackDays: 200,
      relaxationOrder: ['REMATCH_AVOIDANCE', 'SAME_LEAGUE_AVOIDANCE', 'REGIONAL_DIVERSITY'] as const };
    const registry = registerCompetitionDrawPolicy(EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, policy);
    // A shared memory URI permits another connection to validate deliberate saved-data corruption.
    const path = `file:national-draw-test-${crypto.randomUUID()}?mode=memory&cache=shared`;
    const draws = track(openSqliteNationalCompetitionDrawStore(path, sources));
    const request = { careerId: 'career-1', editionId: edition.editionId, kind: 'WBC' as const,
      drawSeed: 'seed-wbc', policy, registry };
    rankingMissing = true;
    expect(() => draws.initialize(request)).toThrow('cutoff ranking');
    rankingMissing = false;
    const draw = draws.initialize(request);
    expect(draw.draw.groups.map((group) => group.length)).toEqual([4, 4, 4, 4, 4, 4]);
    for (const group of draw.draw.groups) expect(group.map((nation) => nation.pot)).toEqual([1, 2, 3, 4]);
    expect(draw.source.rematchHistory.editions).toHaveLength(0);
    expect(draw.source.berths).toEqual(berths);
    expect(() => draws.initialize({ ...request, policy: { ...policy, rematchLookbackDays: 100 } }))
      .toThrow('frozen differently');
    ['US', 'CA'].forEach((nationId) => nations.record({ careerId: 'career-1', nationId, region: 'AMERICAS',
      effectiveFromDay: 0, sourceEventId: `${nationId}-host-region` }));
    const infrastructure = track(openSqliteWorldHostInfrastructureStore(':memory:', { nations }));
    const metrics = { stadiumCapacity: 10000, stadiumQuality: 0, transportQuality: 0,
      accommodationCapacity: 0, broadcastReadiness: 0, operationsQuality: 0 };
    const publicVenue = { careerId: 'career-1', nationId: 'US', region: 'AMERICAS' as const,
      effectiveFromDay: 0, licensed: true, safe: true, sourceClubId: null };
    edition.groups.forEach((group, index) => infrastructure.record({ ...publicVenue,
      venueId: group.hostVenueId, cityId: group.hostCityId, sourceEventId: `${group.hostVenueId}-opened`,
      metrics: { ...metrics, stadiumQuality: 50 - index, broadcastReadiness: 50 } }));
    knockoutEdition.knockoutHubs.forEach((hub, index) => infrastructure.record({ ...publicVenue,
      ...hub, sourceEventId: `${hub.venueId}-opened`, metrics: { ...metrics,
        stadiumCapacity: 9000, stadiumQuality: 60 - index * 5, broadcastReadiness: 90 } }));
    infrastructure.record({ ...publicVenue, ...knockoutEdition.finalFourHost, sourceEventId: 'us-final-opened',
      metrics: { ...metrics, stadiumCapacity: 8000, stadiumQuality: 70, broadcastReadiness: 100 } });
    infrastructure.record({ ...publicVenue, nationId: 'CA', venueId: 'canada-high-score', cityId: 'ca-city',
      sourceEventId: 'canada-opened', metrics: { ...metrics, stadiumCapacity: 100000,
        stadiumQuality: 1000, broadcastReadiness: 100 } });
    const hostPolicy = { version: edition.hostingPolicyVersion, kind: 'WBC' as const, knockoutHubCount: 2,
      minimums: { GROUP: metrics, KNOCKOUT: { ...metrics, stadiumCapacity: 9000, broadcastReadiness: 80 },
        FINAL_FOUR: { ...metrics, stadiumCapacity: 8000, broadcastReadiness: 100 } },
      suitabilityWeights: { ...metrics, stadiumCapacity: 0, stadiumQuality: 1 },
      rotation: { lookbackDays: 0, cityPenalty: 10, nationPenalty: 2, regionPenalty: 1 } };
    let editions: SqliteNationalCompetitionEditionStore;
    const hostStore = track(openSqliteNationalHostCandidateStore(':memory:', {
      selections, infrastructure, history: sources.history, editions: {
        readSnapshot: (careerId: string, editionId: string) => editions?.readSnapshot(careerId, editionId) ?? null } }));
    const hostCandidates = hostStore.initialize({ careerId: 'career-1', editionId: edition.editionId, policy: hostPolicy });
    let candidateOverride: NationalHostCandidateSnapshot | undefined;
    const editionSources = { draws, hosts: { readCandidates: (careerId: string, editionId: string, day: number) =>
      candidateOverride ?? hostStore.readCandidates(careerId, editionId, day) } };
    const editionPath = `file:national-edition-test-${crypto.randomUUID()}?mode=memory&cache=shared`;
    editions = track(openSqliteNationalCompetitionEditionStore(editionPath, editionSources));
    const editionRequest = { careerId: 'career-1', editionId: edition.editionId, profile: {
      kind: 'WBC' as const, competitionId: edition.competitionId, formatVersion: edition.formatVersion,
      ruleProfileVersion: edition.ruleProfileVersion, gamePolicyVersion: edition.gamePolicyVersion,
      hostingPolicyVersion: edition.hostingPolicyVersion, groupTiebreakPolicy: edition.groupTiebreakPolicy,
      thirdPlacePolicy: edition.thirdPlacePolicy,
      knockoutPolicy: { knockoutPolicyVersion: knockoutEdition.knockoutPolicyVersion,
        roundOf16Pairs: knockoutEdition.roundOf16Pairs,
        roundOf16HubIndices: knockoutEdition.roundOf16HubIndices,
        quarterfinalHubIndices: knockoutEdition.quarterfinalHubIndices },
    } };
    expect(() => editions.initialize({ ...editionRequest, profile: { ...editionRequest.profile,
      knockoutPolicy: { ...editionRequest.profile.knockoutPolicy,
        roundOf16HubIndices: [4, 0, 0, 0, 0, 0, 0, 0] } } })).toThrow('knockout edition');
    const savedEdition = editions.initialize(editionRequest);
    expect(savedEdition.kind).toBe('WBC');
    expect(savedEdition.hosting.hostNationIds).toEqual(['US']);
    expect(savedEdition.hosting.groupHosts[0].evaluations.find((item) => item.venueId === 'canada-high-score')
      ?.rejectionReason).toBe('WBC_US_ONLY');
    const acceptedEdition = editions.readWbcEdition('career-1', edition.editionId)!;
    expect(editions.readWbcKnockoutEdition('career-1', edition.editionId)).toEqual({ ...knockoutEdition,
      groupDrawSnapshotId: draw.drawSnapshotId });
    expect(editions.readPremierEdition('career-1', edition.editionId)).toBeNull();
    expect(acceptedEdition.groups.flatMap((group) => group.nationIds).sort())
      .toEqual([...berths.entrantNationIds].sort());
    candidateOverride = { ...hostCandidates, snapshotId: 'same-winners-different-source' };
    expect(() => editions.readSnapshot('career-1', edition.editionId)).toThrow('corrupt');
    candidateOverride = undefined;
    expect(() => editions.initialize({ ...editionRequest, profile: { ...editionRequest.profile,
      formatVersion: 'another-format' } })).toThrow('frozen differently');
    const editionDb = new DatabaseSync(editionPath);
    const row = editionDb.prepare('SELECT snapshot_json FROM world_national_competition_editions')
      .get() as { snapshot_json: string };
    editionDb.prepare("UPDATE world_national_competition_editions SET snapshot_json='{}'").run();
    expect(() => editions.readSnapshot('career-1', edition.editionId)).toThrow('corrupt');
    editionDb.prepare('UPDATE world_national_competition_editions SET snapshot_json=?').run(row.snapshot_json);
    editions.close();
    editions = track(openSqliteNationalCompetitionEditionStore(editionPath, editionSources));
    expect(editions.initialize(editionRequest)).toEqual(savedEdition);
    editionDb.close();
    const groups = track(openSqliteWbcFinalsGroupStore(':memory:', { selections, draws,
      editions: { readWbcEdition: (careerId: string, editionId: string) => editions.readWbcEdition(careerId, editionId) },
      berths: sources.wbcBerths, matches: { getMatch: () => null, getOfficialFixture: () => null } }));
    expect(() => groups.initialize({ careerId: 'career-1', edition: { ...acceptedEdition,
      drawPolicyVersion: 'another-policy-version' } })).toThrow('accepted draw');
    expect(() => groups.initialize({ careerId: 'career-1', edition: { ...acceptedEdition,
      groups: acceptedEdition.groups.map((group, index) => index === 0
        ? { ...group, hostVenueId: 'unaccepted-venue' } : group) } })).toThrow('accepted national edition');
    expect(groups.initialize({ careerId: 'career-1', edition: acceptedEdition }).groups).toHaveLength(6);
    const knockout = track(openSqliteWbcFinalsKnockoutStore(':memory:', { groups,
      editions: { readWbcKnockoutEdition: (careerId: string, editionId: string) =>
        editions.readWbcKnockoutEdition(careerId, editionId) },
      matches: { getMatch: () => null, getOfficialFixture: () => null } }));
    const acceptedKnockout = editions.readWbcKnockoutEdition('career-1', edition.editionId)!;
    expect(() => knockout.initialize({ careerId: 'career-1', edition: { ...acceptedKnockout,
      knockoutPolicyVersion: 'another-knockout-policy' } })).toThrow('accepted national edition');
    const db = new DatabaseSync(path);
    db.prepare("UPDATE world_national_draws SET draw_json='{}'").run();
    db.close();
    expect(() => draws.readDraw('career-1', edition.editionId)).toThrow('corrupt');
  } finally {
    closables.reverse().forEach((store) => store.close());
  }
});
