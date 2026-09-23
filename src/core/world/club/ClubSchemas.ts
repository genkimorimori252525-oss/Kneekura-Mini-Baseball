import type { ClubCreationInput, ClubWorldState, ClubReferences } from './ClubTypes';
import { BUDGET_BUCKETS, REVENUE_CATEGORIES, COST_CATEGORIES } from './ClubFinanceTypes';
import { object, text, integer, positive, index, fraction, nonnegative, nullable, boolean, enumeration, list, ids, evidenceIds, fail, exact, type Reader } from './ClubValidation';

export const targetsReader = object({ finance: index, popularity: index, development: index, scouting: index, venue: index });
export const identityReader = object({ clubId: text, canonicalOriginId: text, foundingIdentityRef: text, originCountryId: text,
  historicalHomeCityId: text, sourceArchetype: enumeration(['REAL_BASEBALL_CLUB', 'REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB']) });
export const metadataReader = object({ catalogVersion: text, datasetVersion: text, financeSnapshotSeason: nullable(text),
  sourceSnapshotIds: evidenceIds, confidenceClass: enumeration(['VERIFIED', 'SUPPORTED', 'DESIGN_ESTIMATE']), overrideReason: nullable(text) });
export const ownerReader = object({ ownerId: nullable(text), modelRef: text });
const stadiumBase = { stadiumId: text, geometryRef: text, capacity: integer, ageSeasons: integer, ownedByClub: boolean, leaseCost: integer, renovationLevel: integer };
export const stadiumReader = object({ ...stadiumBase, quality: index });
export const facilitiesReader = object({ trainingQuality: index, academyQuality: index, scoutingInfrastructure: index,
  medicalQuality: index, analyticsInfrastructure: index, stadiumOperationsQuality: index });
export const capitalReader = object({ supporterCapital: index, brandCapital: index, commercialNetworkCapital: index, stadiumAssetCapital: index,
  institutionalKnowHow: index, recruitmentNetworkCapital: index, academyKnowHow: index, financingAccess: index, ownershipBackingCapacity: index });
export const budgetsReader = object({ payroll: integer, transfers: integer, academy: integer, scouting: integer, coaching: integer, medical: integer, facilities: integer });
export const revenueReader = object({ matchday: integer, broadcasting: integer, commercial: integer, merchandise: integer, prizeMoney: integer, transferIncome: integer, ownerFunding: integer, other: integer });
export const profileReader = object({ profileId: text, version: text, leagueId: text, season: integer, currency: text,
  hardPayrollCap: nullable(integer), luxuryTaxThreshold: nullable(integer), squadCostRatioLimit: nullable(nonnegative), revenueSharingRate: fraction,
  insolvencyRuleRef: text, ownerFundingPolicyRef: text });
export const planReader = object({ season: integer, startsOnDay: integer, minimumCashReserve: integer, approvedBudgets: budgetsReader,
  objectives: ids, competitionEditionIds: ids, openingRegistrationSnapshotId: nullable(text), financialProfile: profileReader });
export const managerReader = object({ managerId: text, appointmentId: text });
export const referencesReader = object({
  playerClubStateRefs: list(object({ playerId: text, stateRef: text }), x => x.playerId),
  staffRoleLinks: list(object({ roleId: text, roleKind: enumeration(['MANAGER', 'COACH', 'SCOUT', 'OTHER']), personId: text, appointmentId: text }), x => x.roleId),
  rivalryStateRefs: list(object({ fromClubId: text, toClubId: text, stateRef: text }), x => JSON.stringify([x.fromClubId, x.toClubId])),
  competitiveThreatRefs: ids, standingsRef: nullable(text), fanDemandRef: nullable(text),
});
export const commitmentReader = object({ commitmentId: text, contractRef: text, category: enumeration(COST_CATEGORIES), budgetBucket: enumeration(BUDGET_BUCKETS),
  reservationSeason: integer, amount: positive, paidBeforeSeason: integer, paidThisSeason: integer, cancelledAmount: integer });
export const receiptReader = object({ receiptId: text, season: integer, effectiveDay: integer,
  kind: enumeration(['REVENUE', 'COMMITMENT_PAYMENT', 'DEBT_DRAW', 'DEBT_REPAYMENT']), amount: integer,
  category: nullable(enumeration(REVENUE_CATEGORIES)), commitmentId: nullable(text), causeEventIds: evidenceIds });
export const financeReader = object({ openingCash: integer, openingDebt: integer, cash: integer, debt: integer, revenue: revenueReader,
  commitments: list(commitmentReader, x => x.commitmentId), receipts: list(receiptReader, x => x.receiptId) });
export const institutionalReader = object({ brand: object({ displayName: text, shortName: text, brandVersion: integer }), homeCityId: text,
  owner: ownerReader, governanceRef: text, stadium: stadiumReader, facilities: facilitiesReader, capital: capitalReader, structuralRevenueCapacity: integer });
export const seedRecordReader = object({ targets: targetsReader, metadata: metadataReader,
  transformVersion: enumeration(['club-seed-direct-v1']), financeNormalizationVersion: text });
const stateShapeReader = object({ schemaVersion: enumeration([1]), careerId: text, revision: integer, effectiveDay: integer,
  identity: identityReader, initialSeed: seedRecordReader, institutional: institutionalReader,
  season: object({ plan: planReader, openingManager: nullable(managerReader), closureRef: nullable(text) }),
  live: object({ finance: financeReader, references: referencesReader, managerAppointmentEventIds: ids }) });
export const creationReader: Reader<ClubCreationInput> = object({
  context: object({ phase: enumeration(['CREATION', 'RUNNING']), careerId: text, effectiveDay: integer, existingClubIds: ids }),
  seed: object({ identity: identityReader, metadata: metadataReader, targets: targetsReader }),
  initial: object({ brand: object({ displayName: text, shortName: text }), homeCityId: text, owner: ownerReader, governanceRef: text,
    stadium: object(stadiumBase), cash: integer, debt: integer, structuralRevenueCapacity: integer, financeNormalizationVersion: text,
    season: planReader, references: referencesReader }),
});
export function validateReferences(refs: ClubReferences, clubId: string): void {
  if (refs.staffRoleLinks.filter(x => x.roleKind === 'MANAGER').length > 1) fail('STATE_INCONSISTENT', 'staffRoleLinks');
  if (new Set(refs.staffRoleLinks.map(x => x.appointmentId)).size !== refs.staffRoleLinks.length) fail('DUPLICATE_ID', 'appointmentId');
  for (const edge of refs.rivalryStateRefs) {
    if (edge.fromClubId !== clubId || edge.fromClubId === edge.toClubId) fail('STATE_INCONSISTENT', 'rivalryStateRefs');
  }
}
export function validateState(state: ClubWorldState): void {
  const { plan } = state.season; const f = state.live.finance;
  if (plan.financialProfile.season !== plan.season || plan.startsOnDay > state.effectiveDay) fail('STATE_INCONSISTENT', 'season.plan');
  validateReferences(state.live.references, state.identity.clubId);
  for (const c of f.commitments) {
    if (c.reservationSeason > plan.season || (c.reservationSeason === plan.season && c.paidBeforeSeason !== 0)
      || exact([c.paidBeforeSeason, c.paidThisSeason, c.cancelledAmount], 'commitment.total') > c.amount) fail('STATE_INCONSISTENT', 'commitments');
  }
  const cashChanges: number[] = [f.openingCash]; const debtChanges: number[] = [f.openingDebt];
  const revenue = Object.fromEntries(REVENUE_CATEGORIES.map(k => [k, [] as number[]])) as Record<typeof REVENUE_CATEGORIES[number], number[]>;
  const paid = new Map(f.commitments.map(c => [c.commitmentId, [] as number[]]));
  let cashCursor = f.openingCash, debtCursor = f.openingDebt, previousDay = plan.startsOnDay;
  for (const r of f.receipts) {
    if (r.kind !== 'REVENUE' && r.amount === 0) fail('STATE_INCONSISTENT', 'receipts.amount');
    if (r.effectiveDay < previousDay) fail('STATE_INCONSISTENT', 'receipts.order');
    previousDay = r.effectiveDay;
    let debtDelta = 0;
    if (r.season !== plan.season || r.effectiveDay < plan.startsOnDay || r.effectiveDay > state.effectiveDay) fail('STATE_INCONSISTENT', 'receipts.period');
    if (r.kind === 'REVENUE') {
      if (r.category === null || r.commitmentId !== null) fail('STATE_INCONSISTENT', 'receipts.revenue');
      revenue[r.category].push(r.amount); cashChanges.push(r.amount);
    } else if (r.kind === 'COMMITMENT_PAYMENT') {
      if (r.category !== null || r.commitmentId === null || !paid.has(r.commitmentId)) fail('STATE_INCONSISTENT', 'receipts.commitment');
      paid.get(r.commitmentId)!.push(r.amount); cashChanges.push(-r.amount);
    } else {
      if (r.category !== null || r.commitmentId !== null) fail('STATE_INCONSISTENT', 'receipts.principal');
      const delta = r.kind === 'DEBT_DRAW' ? r.amount : -r.amount; cashChanges.push(delta); debtChanges.push(delta); debtDelta = delta;
    }
    cashCursor = exact([cashCursor, cashChanges[cashChanges.length - 1]!], 'receipts.cashTrajectory');
    debtCursor = exact([debtCursor, debtDelta], 'receipts.debtTrajectory');
  }
  if (exact(cashChanges, 'cash') !== f.cash || exact(debtChanges, 'debt') !== f.debt) fail('STATE_INCONSISTENT', 'finance.balances');
  for (const key of REVENUE_CATEGORIES) if (exact(revenue[key], 'revenue') !== f.revenue[key]) fail('STATE_INCONSISTENT', 'finance.revenue');
  for (const c of f.commitments) if (exact(paid.get(c.commitmentId)!, 'paid') !== c.paidThisSeason) fail('STATE_INCONSISTENT', 'finance.paidThisSeason');
}
export function readState(input: unknown): ClubWorldState {
  const state = stateShapeReader(input, 'state'); validateState(state); return state;
}
