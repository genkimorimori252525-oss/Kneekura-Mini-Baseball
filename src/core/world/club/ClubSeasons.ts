import type { ClubCommand, ClubOperation, ClubSeasonSnapshot, ClubWorldState } from './ClubTypes';
import { managerFromReferences } from './ClubSeed';
import { financeSummary, outstanding } from './ClubFinance';
import { exact, fail, same } from './ClubValidation';

export function closeSeason(state: ClubWorldState, op: Extract<ClubOperation, { kind: 'CLOSE_SEASON' }>, command: ClubCommand,
  afterRevision: number): Readonly<{ state: ClubWorldState; snapshot: ClubSeasonSnapshot }> {
  if (state.season.closureRef !== null) fail('SEASON_CLOSED');
  const snapshot: ClubSeasonSnapshot = { snapshotId: op.snapshotId, careerId: state.careerId, clubId: state.identity.clubId,
    season: state.season.plan.season, effectiveDay: command.effectiveDay, plan: state.season.plan, finance: state.live.finance,
    financeSummary: financeSummary({ ...state, revision: afterRevision }), institutional: state.institutional, resultRefs: op.resultRefs,
    openingManager: state.season.openingManager, closingManager: managerFromReferences(state.live.references),
    managerAppointmentEventIds: state.live.managerAppointmentEventIds };
  return { state: { ...state, effectiveDay: command.effectiveDay, season: { ...state.season, closureRef: op.snapshotId } }, snapshot };
}
export function openSeason(state: ClubWorldState, op: Extract<ClubOperation, { kind: 'OPEN_SEASON' }>, command: ClubCommand): ClubWorldState {
  if (state.season.closureRef === null) fail('SEASON_NOT_CLOSED');
  const old = state.season.plan, plan = op.plan;
  if (plan.season !== exact([old.season, 1], 'season') || plan.financialProfile.season !== plan.season
    || plan.startsOnDay < state.effectiveDay || plan.startsOnDay > command.effectiveDay) fail('WRONG_SEASON');
  const previous = old.financialProfile, incoming = plan.financialProfile;
  if (previous.currency !== incoming.currency) fail('CURRENCY_MISMATCH');
  if (previous.profileId === incoming.profileId && previous.version === incoming.version
    && !same({ ...previous, season: incoming.season }, incoming)) fail('PROFILE_VERSION_CONFLICT');
  const f = state.live.finance;
  return { ...state, effectiveDay: command.effectiveDay,
    season: { plan, openingManager: managerFromReferences(state.live.references), closureRef: null },
    live: { ...state.live, managerAppointmentEventIds: [], finance: {
      openingCash: f.cash, openingDebt: f.debt, cash: f.cash, debt: f.debt,
      revenue: { matchday: 0, broadcasting: 0, commercial: 0, merchandise: 0, prizeMoney: 0, transferIncome: 0, ownerFunding: 0, other: 0 },
      receipts: [], commitments: f.commitments.filter(c => outstanding(c) > 0).map(c => ({ ...c,
        paidBeforeSeason: exact([c.paidBeforeSeason, c.paidThisSeason], 'paidBeforeSeason'), paidThisSeason: 0 })),
    } },
  };
}
