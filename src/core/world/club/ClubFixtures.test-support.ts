import assert from 'node:assert/strict';
import { createClubFromSeed } from './index';
import type { ClubCommand, ClubOperation, ClubResult, ClubWorldState } from './ClubTypes';

export function bootstrap() {
  return {
    context: { phase: 'CREATION' as const, careerId: 'career-a', effectiveDay: 10, existingClubIds: [] as string[] },
    seed: {
      identity: { clubId: 'club-a', canonicalOriginId: 'source-a', foundingIdentityRef: 'founding-a',
        originCountryId: 'country-a', historicalHomeCityId: 'city-origin', sourceArchetype: 'REAL_BASEBALL_CLUB' as const },
      metadata: { catalogVersion: 'catalog-v1', datasetVersion: 'dataset-v1', financeSnapshotSeason: null as string | null,
        sourceSnapshotIds: ['source-snapshot-a'], confidenceClass: 'DESIGN_ESTIMATE' as const, overrideReason: null as string | null },
      targets: { finance: 90, popularity: 80, development: 70, scouting: 60, venue: 50 },
    },
    initial: {
      brand: { displayName: 'Test Club', shortName: 'TC' }, homeCityId: 'city-origin',
      owner: { ownerId: 'owner-a' as string | null, modelRef: 'ownership-model-a' }, governanceRef: 'governance-a',
      stadium: { stadiumId: 'stadium-a', geometryRef: 'geometry-a', capacity: 10000, ageSeasons: 5,
        ownedByClub: true, leaseCost: 0, renovationLevel: 0 },
      cash: 1000, debt: 200, structuralRevenueCapacity: 800, financeNormalizationVersion: 'test-money-v1',
      season: {
        season: 1, startsOnDay: 10, minimumCashReserve: 100,
        approvedBudgets: { payroll: 500, transfers: 200, academy: 100, scouting: 80, coaching: 80, medical: 60, facilities: 100 },
        objectives: ['objective-a'], competitionEditionIds: ['league-season-1'], openingRegistrationSnapshotId: 'roster-opening-1' as string | null,
        financialProfile: { profileId: 'profile-a', version: 'rules-v1', leagueId: 'league-a', season: 1, currency: 'SIM',
          hardPayrollCap: null as number | null, luxuryTaxThreshold: null as number | null,
          squadCostRatioLimit: null as number | null, revenueSharingRate: 0,
          insolvencyRuleRef: 'solvency-v1', ownerFundingPolicyRef: 'owner-policy-v1' },
      },
      references: {
        playerClubStateRefs: [{ playerId: 'player-a', stateRef: 'player-club-a' }],
        staffRoleLinks: [{ roleId: 'manager-role', roleKind: 'MANAGER' as const, personId: 'manager-a', appointmentId: 'appointment-a' }],
        rivalryStateRefs: [{ fromClubId: 'club-a', toClubId: 'club-b', stateRef: 'rivalry-a-b' }],
        competitiveThreatRefs: ['threat-b-a'], standingsRef: 'standings-1' as string | null, fanDemandRef: 'demand-1' as string | null,
      },
    },
  };
}
export function value<T>(result: ClubResult<T>): T { assert.ok(result.ok, JSON.stringify(result)); return result.value; }
export function state(): ClubWorldState { return value(createClubFromSeed(bootstrap())); }
export function command(operations: readonly ClubOperation[], current = state(), id = 'event-1'): ClubCommand {
  return { eventId: id, careerId: current.careerId, clubId: current.identity.clubId, expectedRevision: current.revision,
    effectiveDay: current.effectiveDay + 1, causeEventIds: ['cause-' + id], operations };
}
export function nextPlan(current = state()) {
  const plan = current.season.plan;
  return { ...plan, season: plan.season + 1, startsOnDay: current.effectiveDay + 2,
    openingRegistrationSnapshotId: 'next-registration',
    competitionEditionIds: ['league-season-' + (plan.season + 1)],
    financialProfile: { ...plan.financialProfile, season: plan.season + 1 } };
}
export const closure = () => ({ kind: 'CLOSE_SEASON' as const, snapshotId: 'season-summary-1',
  resultRefs: { domesticResultRef: 'official-season-1', continentalResultRef: null,
    rosterSummaryRef: 'roster-summary-1', fanbaseSummaryRef: 'fanbase-summary-1', derivedSummaryRef: 'derived-summary-1' } });
