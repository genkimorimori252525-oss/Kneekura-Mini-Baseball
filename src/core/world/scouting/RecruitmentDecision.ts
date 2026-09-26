import { frozenScoutingCopy, rejectUnknownScoutingFields,
  type ClubScoutingKnowledge,
  type PlayerKnowledgeReport, type ScoutingEvidenceRecord } from './ScoutingKnowledge';
import { deriveSourceBackedRosterNeed,
  type RosterNeedPlanningPolicy, type RosterNeedRequest,
  type SourceBackedRosterNeed } from '../roster/SourceBackedRosterNeed';
import type { RosterState } from '../roster/RosterTypes';
import type { BudgetBucket } from '../club/ClubFinanceTypes';
import type { ClubWorldState } from '../club/ClubTypes';
import { evaluateClubPayrollPrecheck,
  type ClubPayrollPrecheck,
  type PlayerWageSeasonAllocation } from '../club/ClubPayrollPrecheck';
import { deriveRecruitmentFinance,
  type SourceBackedClubFinance } from './SourceBackedRecruitmentFinance';

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
  knowledgeEvidence: readonly ScoutingEvidenceRecord[];
  sourceBackedRosterNeed?: SourceBackedRosterNeed;
  sourceBackedClubFinance?: SourceBackedClubFinance;
  payrollPrecheck?: ClubPayrollPrecheck;
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
const appendRecruitmentDecisionInternal = (
  ledger: RecruitmentDecisionLedger,
  expectedRevision: number,
  knowledge: ClubScoutingKnowledge,
  source: RecruitmentDecisionInput,
  sourceBackedRosterNeed?: SourceBackedRosterNeed,
  sourceBackedClubFinance?: SourceBackedClubFinance,
  payrollPrecheck?: ClubPayrollPrecheck,
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
  const knowledgeEvidence = new Map<string, ScoutingEvidenceRecord>();
  for (const report of reports as PlayerKnowledgeReport[]) {
    rejectUnknownScoutingFields(report, ['reportId', 'careerId', 'clubId',
      'playerId', 'observedAtDay', 'availableAtDay', 'evidenceSourceIds',
      'evaluatorPersonIds', 'estimate', 'confidence'], 'knowledge report');
    if (!day(report.observedAtDay) || !day(report.availableAtDay)
      || report.observedAtDay > report.availableAtDay
      || !Array.isArray(report.evidenceSourceIds)
      || !unique(report.evidenceSourceIds)
      || !Array.isArray(report.evaluatorPersonIds)
      || !unique(report.evaluatorPersonIds)
      || !Array.isArray(report.estimate) || report.estimate.length === 0
      || !['LOW', 'MEDIUM', 'HIGH'].includes(report.confidence)) {
      throw new Error('invalid recruitment decision knowledge report');
    }
    for (const estimate of report.estimate) {
      rejectUnknownScoutingFields(estimate, ['domainId', 'lower', 'upper'],
        'knowledge estimate');
      if (!id(estimate.domainId) || !Number.isFinite(estimate.lower)
        || !Number.isFinite(estimate.upper)
        || estimate.lower > estimate.upper) {
        throw new Error('invalid recruitment decision knowledge estimate');
      }
    }
    const sources = report.evidenceSourceIds.map((evidenceId) =>
      knowledge.evidence.find((item) => item.evidenceId === evidenceId));
    if (sources.some((item) => !item)) {
      throw new Error('recruitment decision knowledge evidence is missing');
    }
    for (const source of sources as ScoutingEvidenceRecord[]) {
      rejectUnknownScoutingFields(source, ['evidenceId', 'careerId', 'clubId',
        'playerId', 'observedAtDay', 'availableAtDay', 'sourceEventId'],
      'knowledge evidence');
      if (!id(source.evidenceId) || !id(source.sourceEventId)
        || source.careerId !== ledger.careerId
        || source.clubId !== ledger.clubId
        || source.playerId !== decision.playerId
        || !day(source.observedAtDay) || !day(source.availableAtDay)
        || source.availableAtDay < source.observedAtDay
        || source.availableAtDay > report.availableAtDay
        || source.availableAtDay > decision.decidedAtDay) {
        throw new Error('recruitment decision knowledge evidence is mismatched or future');
      }
      knowledgeEvidence.set(source.evidenceId, source);
    }
    if (Math.max(...sources.map((item) => item!.observedAtDay))
      !== report.observedAtDay) {
      throw new Error('recruitment decision knowledge observation mismatch');
    }
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
    knowledgeReports: reports as PlayerKnowledgeReport[],
    knowledgeEvidence: [...knowledgeEvidence.values()],
    ...(sourceBackedRosterNeed ? { sourceBackedRosterNeed } : {}),
    ...(sourceBackedClubFinance ? { sourceBackedClubFinance } : {}),
    ...(payrollPrecheck ? { payrollPrecheck } : {}) });
  return Object.freeze({ careerId: ledger.careerId, clubId: ledger.clubId,
    revision: ledger.revision + 1, effectiveDay: decision.decidedAtDay,
    decisions: Object.freeze([...ledger.decisions, record]) });
};

export const appendRecruitmentDecision = (
  ledger: RecruitmentDecisionLedger,
  expectedRevision: number,
  knowledge: ClubScoutingKnowledge,
  source: RecruitmentDecisionInput,
): RecruitmentDecisionLedger => appendRecruitmentDecisionInternal(
  ledger, expectedRevision, knowledge, source);

/** Bind the recorded need to the same club's actual roster and as-of knowledge. */
export const appendRecruitmentDecisionWithRosterNeed = (
  ledger: RecruitmentDecisionLedger,
  expectedRevision: number,
  knowledge: ClubScoutingKnowledge,
  roster: RosterState,
  policy: RosterNeedPlanningPolicy,
  needRequest: RosterNeedRequest,
  source: Omit<RecruitmentDecisionInput, 'rosterNeedSnapshot'>,
): RecruitmentDecisionLedger => {
  if (needRequest.careerId !== source.careerId
    || needRequest.clubId !== source.clubId
    || needRequest.asOfDay > source.decidedAtDay) {
    throw new Error('recruitment roster need scope or decision time mismatch');
  }
  const need = deriveSourceBackedRosterNeed(roster, knowledge,
    needRequest, policy);
  return appendRecruitmentDecisionInternal(ledger, expectedRevision, knowledge,
    { ...source, rosterNeedSnapshot: {
      snapshotId: need.snapshotId,
      availableAtDay: need.asOfDay,
      positionGroup: need.positionGroup,
      horizon: need.horizon,
      urgency: need.urgency,
      requiredRole: need.requiredRole,
    } }, need);
};

/** Pins the actual club ledger and approved budget used for a recruitment decision. */
export const appendRecruitmentDecisionWithClubFinance = (
  ledger: RecruitmentDecisionLedger,
  expectedRevision: number,
  knowledge: ClubScoutingKnowledge,
  club: ClubWorldState,
  budgetBucket: BudgetBucket,
  source: Omit<RecruitmentDecisionInput, 'budgetContext'>,
): RecruitmentDecisionLedger => {
  const finance = deriveRecruitmentFinance(club, source.careerId,
    source.clubId, source.decidedAtDay, budgetBucket);
  return appendRecruitmentDecisionInternal(ledger, expectedRevision,
    knowledge, { ...source, budgetContext: finance.budgetContext },
    undefined, finance.sourceBackedClubFinance);
};

/** Records both roster need and budget from the same club's causal state. */
export const appendRecruitmentDecisionWithRosterNeedAndClubFinance = (
  ledger: RecruitmentDecisionLedger,
  expectedRevision: number,
  knowledge: ClubScoutingKnowledge,
  roster: RosterState,
  policy: RosterNeedPlanningPolicy,
  needRequest: RosterNeedRequest,
  club: ClubWorldState,
  budgetBucket: BudgetBucket,
  source: Omit<RecruitmentDecisionInput,
    'rosterNeedSnapshot' | 'budgetContext'>,
  proposedCurrentSeasonPayrollMinorUnits?: number,
  wageAllocations: readonly PlayerWageSeasonAllocation[] = [],
): RecruitmentDecisionLedger => {
  if (needRequest.careerId !== source.careerId
    || needRequest.clubId !== source.clubId
    || needRequest.asOfDay > source.decidedAtDay) {
    throw new Error('recruitment roster need scope or decision time mismatch');
  }
  const need = deriveSourceBackedRosterNeed(roster, knowledge,
    needRequest, policy);
  const finance = deriveRecruitmentFinance(club, source.careerId,
    source.clubId, source.decidedAtDay, budgetBucket);
  if (proposedCurrentSeasonPayrollMinorUnits !== undefined
    && budgetBucket !== 'payroll') {
    throw new Error('payroll precheck requires the payroll budget');
  }
  if (proposedCurrentSeasonPayrollMinorUnits === undefined
    && wageAllocations.length > 0) {
    throw new Error('wage allocations require a payroll precheck');
  }
  const precheck = proposedCurrentSeasonPayrollMinorUnits === undefined
    ? undefined : precheckOfferedPayroll(club, source,
      finance.budgetContext.currency, proposedCurrentSeasonPayrollMinorUnits,
      wageAllocations);
  return appendRecruitmentDecisionInternal(ledger, expectedRevision,
    knowledge, { ...source,
      rosterNeedSnapshot: {
        snapshotId: need.snapshotId, availableAtDay: need.asOfDay,
        positionGroup: need.positionGroup, horizon: need.horizon,
        urgency: need.urgency, requiredRole: need.requiredRole,
      }, budgetContext: precheck ? { ...finance.budgetContext,
        availableMinorUnits: precheckedPayrollHeadroom(precheck) }
        : finance.budgetContext },
    need, finance.sourceBackedClubFinance, precheck);
};

const precheckOfferedPayroll = (
  club: ClubWorldState,
  source: Pick<RecruitmentDecisionInput, 'decision' | 'offeredTerms'>,
  currency: string,
  proposedCurrentSeasonPayrollMinorUnits: number,
  wageAllocations: readonly PlayerWageSeasonAllocation[],
): ClubPayrollPrecheck => {
  if (source.decision !== 'BID' && source.decision !== 'ACQUIRE') {
    throw new Error('payroll precheck requires a bid or acquisition');
  }
  const offer = source.offeredTerms;
  if (!offer || offer.currency !== currency
    || proposedCurrentSeasonPayrollMinorUnits > offer.totalMinorUnits) {
    throw new Error('payroll proposal does not match offered terms');
  }
  const precheck = evaluateClubPayrollPrecheck(club,
    proposedCurrentSeasonPayrollMinorUnits, wageAllocations);
  if (precheck.outcome !== 'WITHIN_COVERED_RULES') {
    throw new Error(`payroll proposal ${precheck.outcome}`);
  }
  return precheck;
};

const precheckedPayrollHeadroom = (precheck: ClubPayrollPrecheck): number => {
  if (precheck.allocatedPayrollBudget === null) {
    throw new Error('missing prechecked payroll allocation');
  }
  return Math.max(0, precheck.approvedPayrollBudget
    - precheck.allocatedPayrollBudget);
};

/** Rejects a current-season payroll offer outside the covered budget rules. */
export const appendRecruitmentDecisionWithPayrollPrecheck = (
  ledger: RecruitmentDecisionLedger,
  expectedRevision: number,
  knowledge: ClubScoutingKnowledge,
  club: ClubWorldState,
  proposedCurrentSeasonPayrollMinorUnits: number,
  source: Omit<RecruitmentDecisionInput, 'budgetContext'>,
  wageAllocations: readonly PlayerWageSeasonAllocation[] = [],
): RecruitmentDecisionLedger => {
  const finance = deriveRecruitmentFinance(club, source.careerId,
    source.clubId, source.decidedAtDay, 'payroll');
  const precheck = precheckOfferedPayroll(club, source,
    finance.budgetContext.currency, proposedCurrentSeasonPayrollMinorUnits,
    wageAllocations);
  return appendRecruitmentDecisionInternal(ledger, expectedRevision,
    knowledge, { ...source, budgetContext: { ...finance.budgetContext,
      availableMinorUnits: precheckedPayrollHeadroom(precheck) } },
    undefined, finance.sourceBackedClubFinance, precheck);
};
