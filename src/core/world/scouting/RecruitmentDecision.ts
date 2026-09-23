import { frozenScoutingCopy, rejectUnknownScoutingFields,
  type ClubScoutingKnowledge,
  type PlayerKnowledgeReport } from './ScoutingKnowledge';

export type RecruitmentDecisionKind = 'SHORTLIST' | 'BID' | 'PASS' | 'ACQUIRE';
export type RosterNeedSnapshot = Readonly<{
  snapshotId: string;
  availableAtDay: number;
  positionGroup: string;
  horizon: 'NOW' | 'NEXT_SEASON' | 'LONG_TERM';
  urgency: number;
  requiredRole: string;
}>;
export type RecruitmentBudgetContext = Readonly<{
  financeSnapshotId: string;
  availableAtDay: number;
  currency: string;
  availableMinorUnits: number;
}>;
export type RecruitmentFitEstimate = Readonly<{
  policyVersion: string;
  availableAtDay: number;
  lower: number;
  upper: number;
}>;
export type RecruitmentMarketContext = Readonly<{
  snapshotId: string;
  availableAtDay: number;
  expectedCostMinorUnits: number | null;
  knownCompetingClubIds: readonly string[];
}>;
export type ContractOfferSnapshot = Readonly<{
  currency: string;
  totalMinorUnits: number;
  termSeasons: number;
}>;
export type RecruitmentDecisionInput = Readonly<{
  decisionId: string;
  careerId: string;
  clubId: string;
  playerId: string;
  decidedAtDay: number;
  decision: RecruitmentDecisionKind;
  authorityPersonId: string;
  governanceProfileVersion: string;
  knowledgeReportIds: readonly string[];
  rosterNeedSnapshot: RosterNeedSnapshot;
  budgetContext: RecruitmentBudgetContext;
  fitEstimate: RecruitmentFitEstimate;
  marketContext: RecruitmentMarketContext;
  offeredTerms?: ContractOfferSnapshot;
}>;
export type RecruitmentDecisionRecord = Readonly<RecruitmentDecisionInput & {
  knowledgeReports: readonly PlayerKnowledgeReport[];
}>;
export type RecruitmentDecisionLedger = Readonly<{
  careerId: string;
  clubId: string;
  revision: number;
  effectiveDay: number;
  decisions: readonly RecruitmentDecisionRecord[];
}>;

const id = (value: string): boolean => typeof value === 'string' && value.length > 0;
const day = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
const money = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
const unique = (values: readonly string[]): boolean =>
  values.length > 0 && values.every(id) && new Set(values).size === values.length;

export const createRecruitmentDecisionLedger = (
  careerId: string,
  clubId: string,
): RecruitmentDecisionLedger => {
  if (!id(careerId) || !id(clubId)) {
    throw new Error('recruitment career and club IDs are required');
  }
  return Object.freeze({ careerId, clubId, revision: 0, effectiveDay: 0,
    decisions: Object.freeze([]) });
};

/** Records the actual knowledge and context available at decision time. */
export const appendRecruitmentDecision = (
  ledger: RecruitmentDecisionLedger,
  expectedRevision: number,
  knowledge: ClubScoutingKnowledge,
  source: RecruitmentDecisionInput,
): RecruitmentDecisionLedger => {
  if (expectedRevision !== ledger.revision) {
    throw new Error('stale recruitment decision revision');
  }
  const decision = frozenScoutingCopy(source);
  rejectUnknownScoutingFields(decision, ['decisionId', 'careerId', 'clubId',
    'playerId', 'decidedAtDay', 'decision', 'authorityPersonId',
    'governanceProfileVersion', 'knowledgeReportIds', 'rosterNeedSnapshot',
    'budgetContext', 'fitEstimate', 'marketContext', 'offeredTerms'],
  'recruitment decision');
  rejectUnknownScoutingFields(decision.rosterNeedSnapshot,
    ['snapshotId', 'availableAtDay', 'positionGroup', 'horizon',
      'urgency', 'requiredRole'], 'roster need');
  rejectUnknownScoutingFields(decision.budgetContext,
    ['financeSnapshotId', 'availableAtDay', 'currency', 'availableMinorUnits'],
    'budget context');
  rejectUnknownScoutingFields(decision.fitEstimate,
    ['policyVersion', 'availableAtDay', 'lower', 'upper'], 'fit estimate');
  rejectUnknownScoutingFields(decision.marketContext,
    ['snapshotId', 'availableAtDay', 'expectedCostMinorUnits',
      'knownCompetingClubIds'], 'market context');
  if (decision.offeredTerms !== undefined) {
    rejectUnknownScoutingFields(decision.offeredTerms,
      ['currency', 'totalMinorUnits', 'termSeasons'], 'offered terms');
  }
  if (decision.careerId !== ledger.careerId
    || knowledge.careerId !== ledger.careerId) {
    throw new Error('recruitment decision career mismatch');
  }
  if (!id(decision.decisionId) || !id(decision.playerId)
    || !id(decision.authorityPersonId) || !id(decision.governanceProfileVersion)
    || decision.clubId !== ledger.clubId || knowledge.clubId !== ledger.clubId) {
    throw new Error('recruitment decision club or identity mismatch');
  }
  if (ledger.decisions.some((item) => item.decisionId === decision.decisionId)) {
    throw new Error('duplicate recruitment decision ID');
  }
  if (!day(decision.decidedAtDay) || decision.decidedAtDay < ledger.effectiveDay) {
    throw new Error('recruitment decision cannot be backdated in its ledger');
  }
  if (!Array.isArray(decision.knowledgeReportIds)
    || !unique(decision.knowledgeReportIds)) {
    throw new Error('recruitment decision requires knowledge report references');
  }
  const reports = decision.knowledgeReportIds.map((reportId) =>
    knowledge.reports.find((report) => report.reportId === reportId));
  if (reports.some((report) => !report || report.careerId !== ledger.careerId
    || report.clubId !== ledger.clubId
    || report.playerId !== decision.playerId
    || report.availableAtDay > decision.decidedAtDay)) {
    throw new Error('recruitment decision knowledge is missing or from the future');
  }
  const need = decision.rosterNeedSnapshot;
  const budget = decision.budgetContext;
  const fit = decision.fitEstimate;
  const market = decision.marketContext;
  if (!id(need.snapshotId) || !id(need.positionGroup) || !id(need.requiredRole)
    || !['NOW', 'NEXT_SEASON', 'LONG_TERM'].includes(need.horizon)
    || !Number.isFinite(need.urgency) || need.urgency < 0
    || !id(budget.financeSnapshotId) || !id(budget.currency)
    || !money(budget.availableMinorUnits)
    || !id(fit.policyVersion) || !Number.isFinite(fit.lower)
    || !Number.isFinite(fit.upper) || fit.lower > fit.upper
    || !id(market.snapshotId)
    || (market.expectedCostMinorUnits !== null
      && !money(market.expectedCostMinorUnits))
    || !Array.isArray(market.knownCompetingClubIds)
    || new Set(market.knownCompetingClubIds).size
      !== market.knownCompetingClubIds.length
    || market.knownCompetingClubIds.some((clubId) =>
      !id(clubId) || clubId === ledger.clubId)) {
    throw new Error('invalid recruitment decision context');
  }
  if ([need.availableAtDay, budget.availableAtDay,
    fit.availableAtDay, market.availableAtDay].some((available) =>
    !day(available) || available > decision.decidedAtDay)) {
    throw new Error('future recruitment decision context is unavailable');
  }
  const offer = decision.offeredTerms;
  if (!['SHORTLIST', 'BID', 'PASS', 'ACQUIRE'].includes(decision.decision)
    || ((decision.decision === 'BID' || decision.decision === 'ACQUIRE') && !offer)
    || (offer && (!id(offer.currency) || offer.currency !== budget.currency
      || !money(offer.totalMinorUnits)
      || !Number.isSafeInteger(offer.termSeasons) || offer.termSeasons <= 0))) {
    throw new Error('invalid recruitment decision offer or action');
  }
  const record = frozenScoutingCopy({ ...decision,
    knowledgeReports: reports as PlayerKnowledgeReport[] });
  return Object.freeze({ careerId: ledger.careerId, clubId: ledger.clubId,
    revision: ledger.revision + 1, effectiveDay: decision.decidedAtDay,
    decisions: Object.freeze([...ledger.decisions, record]) });
};
