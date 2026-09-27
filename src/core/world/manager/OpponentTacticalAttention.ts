import type { ClubScoutingKnowledge, KnowledgeConfidence,
  PlayerDomainEstimate,
  PlayerKnowledgeReport,
  ScoutingEvidenceRecord } from '../scouting/ScoutingKnowledge';

export type OpponentTacticalAttentionPolicy = Readonly<{
  policyId: string;
  version: string;
  domainId: string;
  maxReportAgeDays: number;
  minimumEvidenceCount: number;
  minimumThreatLowerBound: number;
  minimumLeverage: number;
  minimumRoleCentrality: number;
  minimumConfidence: Exclude<KnowledgeConfidence, 'LOW'>;
}>;
export type OpponentTacticalAttentionInput = Readonly<{
  careerId: string;
  clubId: string;
  managerId: string;
  opponentPlayerId: string;
  asOfDay: number;
  knowledge: ClubScoutingKnowledge;
  context: Readonly<{
    leverage: number;
    roleCentrality: number;
    legalActionIds: readonly string[];
    cautiousActionIds: readonly string[];
  }>;
  policy: OpponentTacticalAttentionPolicy;
}>;
export type OpponentTacticalAttention = Readonly<{
  boundary: 'MANAGER_OPPONENT_BELIEF_ONLY';
  careerId: string;
  clubId: string;
  managerId: string;
  opponentPlayerId: string;
  asOfDay: number;
  managerBelief: Readonly<{
    mean: number;
    uncertainty: number;
    evidence: number;
    freshnessDays: number;
  }> | null;
  considerCautiousActions: boolean;
  /** Consideration only; the Manager decides from action beliefs and legality. */
  candidateActionIds: readonly string[];
  provenance: Readonly<{
    policyId: string;
    policyVersion: string;
    reportId: string | null;
    scoutingEvidenceIds: readonly string[];
    sourceEventIds: readonly string[];
  }>;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const unit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 1;
const uniqueIds = (values: unknown): values is readonly string[] =>
  Array.isArray(values) && values.every(id)
    && values.length === new Set(values).size;

const readEvidence = (knowledge: ClubScoutingKnowledge,
  report: PlayerKnowledgeReport): readonly ScoutingEvidenceRecord[] => {
  if (!uniqueIds(report.evidenceSourceIds)
    || report.evidenceSourceIds.length === 0
    || !uniqueIds(report.evaluatorPersonIds)
    || report.evaluatorPersonIds.length === 0) {
    throw new Error('invalid opponent report provenance');
  }
  const sources = report.evidenceSourceIds.map(evidenceId =>
    knowledge.evidence.find(item => item.evidenceId === evidenceId));
  if (sources.some(source => !source
    || source.careerId !== knowledge.careerId
    || source.clubId !== knowledge.clubId
    || source.playerId !== report.playerId
    || !id(source.sourceEventId)
    || !day(source.observedAtDay) || !day(source.availableAtDay)
    || source.availableAtDay < source.observedAtDay
    || source.availableAtDay > report.availableAtDay)
    || Math.max(...sources.map(source => source!.observedAtDay))
      !== report.observedAtDay) {
    throw new Error('opponent report source mismatch');
  }
  return sources as readonly ScoutingEvidenceRecord[];
};

/** Scouting -> imperfect Manager Belief -> candidate consideration; never a chosen action. */
export function projectOpponentTacticalAttention(
  input: OpponentTacticalAttentionInput,
): OpponentTacticalAttention {
  const p = input?.policy;
  const k = input?.knowledge;
  const c = input?.context;
  if (!id(input?.careerId) || !id(input.clubId)
    || !id(input.managerId) || !id(input.opponentPlayerId)
    || !day(input.asOfDay)
    || !k || k.careerId !== input.careerId || k.clubId !== input.clubId
    || !Array.isArray(k.evidence) || !Array.isArray(k.reports)
    || !p || !id(p.policyId) || !id(p.version) || !id(p.domainId)
    || !day(p.maxReportAgeDays)
    || !Number.isSafeInteger(p.minimumEvidenceCount)
    || p.minimumEvidenceCount <= 0
    || !Number.isFinite(p.minimumThreatLowerBound)
    || !unit(p.minimumLeverage) || !unit(p.minimumRoleCentrality)
    || !['MEDIUM', 'HIGH'].includes(p.minimumConfidence)
    || !c || !unit(c.leverage) || !unit(c.roleCentrality)
    || !uniqueIds(c.legalActionIds) || c.legalActionIds.length === 0
    || !uniqueIds(c.cautiousActionIds)) {
    throw new Error('invalid opponent tactical attention input');
  }
  const candidates = k.reports.filter(report =>
    report.playerId === input.opponentPlayerId
    && report.availableAtDay <= input.asOfDay
    && report.estimate?.some((estimate: PlayerDomainEstimate) =>
      estimate.domainId === p.domainId))
    .sort((a, b) => b.observedAtDay - a.observedAtDay
      || b.availableAtDay - a.availableAtDay
      || a.reportId.localeCompare(b.reportId));
  const report = candidates[0];
  const base = { boundary: 'MANAGER_OPPONENT_BELIEF_ONLY' as const,
    careerId: input.careerId, clubId: input.clubId,
    managerId: input.managerId,
    opponentPlayerId: input.opponentPlayerId,
    asOfDay: input.asOfDay };
  if (!report) return Object.freeze({ ...base, managerBelief: null,
    considerCautiousActions: false,
    candidateActionIds: Object.freeze([]),
    provenance: Object.freeze({ policyId: p.policyId,
      policyVersion: p.version, reportId: null,
      scoutingEvidenceIds: Object.freeze([]),
      sourceEventIds: Object.freeze([]) }) });
  if (!id(report.reportId) || report.careerId !== input.careerId
    || report.clubId !== input.clubId
    || !day(report.observedAtDay)
    || !day(report.availableAtDay)
    || report.availableAtDay < report.observedAtDay
    || !['LOW', 'MEDIUM', 'HIGH'].includes(report.confidence)) {
    throw new Error('invalid opponent report');
  }
  const sources = readEvidence(k, report);
  const estimate = report.estimate.find((item: PlayerDomainEstimate) =>
    item.domainId === p.domainId)!;
  if (!Number.isFinite(estimate.lower)
    || !Number.isFinite(estimate.upper)
    || estimate.lower > estimate.upper) {
    throw new Error('invalid opponent threat estimate');
  }
  const freshnessDays = input.asOfDay - report.observedAtDay;
  const consideration = freshnessDays <= p.maxReportAgeDays
    && sources.length >= p.minimumEvidenceCount
    && estimate.lower >= p.minimumThreatLowerBound
    && (report.confidence === 'HIGH'
      || (p.minimumConfidence === 'MEDIUM'
        && report.confidence === 'MEDIUM'))
    && c.leverage >= p.minimumLeverage
    && c.roleCentrality >= p.minimumRoleCentrality;
  const candidateActionIds = consideration
    ? c.cautiousActionIds.filter(actionId => c.legalActionIds.includes(actionId))
    : [];
  return Object.freeze({ ...base,
    managerBelief: Object.freeze({
      mean: (estimate.lower + estimate.upper) / 2,
      uncertainty: (estimate.upper - estimate.lower) / 2,
      evidence: sources.length, freshnessDays,
    }),
    considerCautiousActions: consideration,
    candidateActionIds: Object.freeze(candidateActionIds),
    provenance: Object.freeze({ policyId: p.policyId,
      policyVersion: p.version, reportId: report.reportId,
      scoutingEvidenceIds: Object.freeze([...report.evidenceSourceIds]),
      sourceEventIds: Object.freeze(sources.map(source => source.sourceEventId)),
    }),
  });
}
