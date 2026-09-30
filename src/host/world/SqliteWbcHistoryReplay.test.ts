import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { WbcBerthAllocation } from '../../core/world/competition/WbcBerths';
import { planWbcFinalsGroups, type WbcFinalsGroupEdition } from
  '../../core/world/competition/WbcFinalsGroups';
import { finalizeWbcKnockout, planWbcFinal, planWbcKnockout,
  planWbcQuarterfinals, planWbcSemifinals, type WbcKnockoutGame,
  type WbcKnockoutSource } from
  '../../core/world/competition/WbcFinalsKnockout';
import { EMPTY_WBC_REGIONAL_COEFFICIENT_POLICY_REGISTRY,
  registerWbcRegionalCoefficientPolicy } from
  '../../core/world/competition/WbcRegionalCoefficients';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { WbcFinalsKnockoutEvidence } from './SqliteWbcFinalsKnockoutStore';
import { openSqliteOfficialWbcHistoryStore } from './SqliteOfficialWbcHistoryStore';
import { openSqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import { openSqliteWbcRegionalCoefficientStore,
  type SqliteWbcRegionalCoefficientStore } from './SqliteWbcRegionalCoefficientStore';

const nationIds = Array.from({ length: 24 }, (_, index) => `nation-${index}`);
const regions = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;
const policy = { version: 'regional-v1', olderEditionMultiplier: 1,
  newerEditionMultiplier: 2, bestNationsPerRegion: 3,
  winPoints: { GROUP: 1, ROUND_OF_16: 2, QUARTERFINAL: 3, SEMIFINAL: 4, FINAL: 5 } };
const registry = registerWbcRegionalCoefficientPolicy(
  EMPTY_WBC_REGIONAL_COEFFICIENT_POLICY_REGISTRY, policy);

const evidence = (editionId: string, completedAtDay: number): WbcFinalsKnockoutEvidence => {
  const berths: WbcBerthAllocation = {
    editionId, cycleId: `cycle-${editionId}`, policyVersion: 'wbc-v1',
    cutoffSnapshotId: `cutoff-${editionId}`, qualificationSnapshotId: `qualified-${editionId}`,
    previousWorldEditionIds: ['prior-1', 'prior-2'],
    directBerthsByRegion: { ASIA_PACIFIC: 5, AMERICAS: 5, EUROPE: 4, AFRICA: 2 },
    coefficientSources: [], regionalPlacementSources: [], entrantNationIds: nationIds, slots: [],
  };
  const groupEdition: WbcFinalsGroupEdition = {
    competitionId: 'wbc', editionId, canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP',
    formatVersion: 'wbc-24-v1', ruleProfileVersion: 'rules-v1', gamePolicyVersion: 'games-v1',
    hostingPolicyVersion: 'hosts-v1', drawPolicyVersion: 'draw-v1',
    drawSnapshotId: `draw-${editionId}`, qualificationSnapshotId: berths.qualificationSnapshotId,
    hostNationId: 'US', calendarWindow: { startsOnDay: completedAtDay - 20, endsOnDay: completedAtDay },
    groupTiebreakPolicy: { version: 'ties-v1', tieCreditNumerator: 0,
      tieCreditDenominator: 1, runDifferentialCapPerGame: 5 },
    thirdPlacePolicy: { version: 'third-v1', criteria: ['WINS',
      'CAPPED_RUN_DIFFERENTIAL', 'RUNS_AGAINST'], drawSeed: `third-${editionId}` },
    groups: Array.from({ length: 6 }, (_, groupIndex) => ({ groupIndex,
      hostCityId: `city-${groupIndex}`, hostVenueId: `venue-${groupIndex}`,
      nationIds: nationIds.slice(groupIndex * 4, groupIndex * 4 + 4) })),
  };
  let index = 0;
  const result = (game: Pick<WbcKnockoutGame, 'gameId' | 'homeNationId'
    | 'awayNationId' | 'venueId'>): OfficialGameResult => {
    const key = `${editionId}-${index++}`;
    return { gameId: game.gameId, seasonId: editionId,
      homeClubId: game.homeNationId, awayClubId: game.awayNationId,
      homeRuns: 2, awayRuns: 1, winnerClubId: game.homeNationId,
      completionReason: 'BOTTOM_COMPLETE', ruleProfileId: asRuleProfileId('rules-v1'),
      gamePolicyVersion: 'games-v1', closureId: `closure-${key}`,
      applicationId: `apply-${key}`, durableRevision: 1,
      venueBinding: { gameId: game.gameId, venueId: game.venueId,
        fixtureEventId: `fixture-${key}`, fixtureRevision: 1 },
      lineScore: { innings: [{ inning: 1, homeRuns: 2, awayRuns: 1 }],
        totals: { home: { runs: 2, hits: 0, errors: 0 }, away: { runs: 1, hits: 0, errors: 0 } } },
    };
  };
  const groupPlan = planWbcFinalsGroups(groupEdition, berths);
  const groupResults = groupPlan.groups.flatMap((group) => group.games).map(result);
  const source: WbcKnockoutSource = { groupEdition, groupPlan, groupResults, berths,
    knockoutEdition: { competitionId: 'wbc', editionId,
      canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP', hostNationId: 'US',
      ruleProfileVersion: 'rules-v1', gamePolicyVersion: 'games-v1',
      groupDrawSnapshotId: groupEdition.drawSnapshotId,
      qualificationSnapshotId: berths.qualificationSnapshotId,
      knockoutPolicyVersion: 'knockout-v1',
      roundOf16Pairs: [[0, 15], [1, 14], [2, 13], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]],
      knockoutHubs: [{ cityId: 'hub-city-0', venueId: 'hub-0' },
        { cityId: 'hub-city-1', venueId: 'hub-1' }],
      roundOf16HubIndices: [0, 1, 0, 1, 0, 1, 0, 1],
      quarterfinalHubIndices: [0, 1, 0, 1],
      finalFourHost: { cityId: 'final-city', venueId: 'final-venue' },
    } };
  const plan = planWbcKnockout(source);
  const roundOf16Results = plan.roundOf16Games.map(result);
  const quarterfinalResults = planWbcQuarterfinals(plan, roundOf16Results, source).map(result);
  const semifinalResults = planWbcSemifinals(plan, roundOf16Results,
    quarterfinalResults, source).map(result);
  const finalResult = result(planWbcFinal(plan, roundOf16Results,
    quarterfinalResults, semifinalResults, source));
  return { source, plan, roundOf16Results, quarterfinalResults,
    semifinalResults, finalResult, outcome: finalizeWbcKnockout(plan,
      roundOf16Results, quarterfinalResults, semifinalResults, finalResult, source) };
};

it('reads historical WBC sources without traversing their later dependents', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wbc-history-replay-'));
  const path = join(directory, 'world.sqlite');
  const nations = openSqliteNationCompetitionRegionStore(path);
  let coefficients: SqliteWbcRegionalCoefficientStore | undefined;
  const editions = new Map([['wbc-2024', evidence('wbc-2024', 100)],
    ['wbc-2028', evidence('wbc-2028', 140)], ['wbc-2032', evidence('wbc-2032', 180)]]);
  let blockFuture = false;
  let readingLater = false;
  const history = openSqliteOfficialWbcHistoryStore(path, { regions: nations,
    finals: { readEvidence: (_careerId, editionId) => {
      if (editionId === 'wbc-2032') {
        if (blockFuture) throw new Error('later edition source unavailable');
        // Current qualification depends on the earlier accepted coefficients.
        if (readingLater) throw new Error('cyclic later WBC source');
        readingLater = true;
        try {
          coefficients?.authority('career-1').regionalCoefficient('AFRICA', 140);
        } finally {
          readingLater = false;
        }
      }
      return editions.get(editionId) ?? null;
    } },
  });
  try {
    nationIds.forEach((nationId, i) => nations.record({ careerId: 'career-1',
      nationId, region: regions[i % 4], effectiveFromDay: 0, sourceEventId: `region-${i}` }));
    const older = history.record('career-1', 'wbc-2024');
    const newer = history.record('career-1', 'wbc-2028');
    coefficients = openSqliteWbcRegionalCoefficientStore(path, { history });
    const first = coefficients.initialize({ careerId: 'career-1',
      olderEditionId: older.editionId, newerEditionId: newer.editionId, policy, registry });
    history.record('career-1', 'wbc-2032');
    expect(history.readEdition('career-1', 'wbc-2024')).toEqual(older);
    expect(history.readEdition('career-1', 'missing')).toBeNull();
    const second = coefficients.initialize({ careerId: 'career-1',
      olderEditionId: newer.editionId, newerEditionId: 'wbc-2032', policy, registry });
    expect(coefficients.readSnapshot('career-1', 'wbc-2028')).toEqual(first);
    expect(coefficients.readSnapshot('career-1', 'wbc-2032')).toEqual(second);
    expect(coefficients.authority('career-1').regionalCoefficient('AFRICA', 140)).toEqual(first[3]);
    expect(history.readHistory('career-1')).toHaveLength(3);
    blockFuture = true;
    expect(history.readEdition('career-1', 'wbc-2024')).toEqual(older);
    expect(coefficients.readSnapshot('career-1', 'wbc-2028')).toEqual(first);
    expect(coefficients.authority('career-1').regionalCoefficient('AFRICA', 140)).toEqual(first[3]);
    expect(() => history.readHistory('career-1')).toThrow('corrupt');
    expect(() => coefficients!.authority('career-1').regionalCoefficient('AFRICA', 180)).toThrow('corrupt');
    coefficients.close();
    coefficients = openSqliteWbcRegionalCoefficientStore(path, { history });
    expect(coefficients.readSnapshot('career-1', 'wbc-2028')).toEqual(first);
  } finally {
    coefficients?.close();
    history.close();
    nations.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
