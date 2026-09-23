export type KnowledgeConfidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type PlayerDomainEstimate = Readonly<{
  domainId: string;
  lower: number;
  upper: number;
}>;
export type ScoutingEvidenceRecord = Readonly<{
  evidenceId: string;
  careerId: string;
  clubId: string;
  playerId: string;
  observedAtDay: number;
  availableAtDay: number;
  /** Stable reference to the upstream match, practice, video, or other source event. */
  sourceEventId: string;
}>;
export type PlayerKnowledgeReport = Readonly<{
  reportId: string;
  careerId: string;
  clubId: string;
  playerId: string;
  /** When the underlying evidence was observed, not when it was delivered. */
  observedAtDay: number;
  availableAtDay: number;
  evidenceSourceIds: readonly string[];
  evaluatorPersonIds: readonly string[];
  estimate: readonly PlayerDomainEstimate[];
  confidence: KnowledgeConfidence;
}>;
export type ClubScoutingKnowledge = Readonly<{
  careerId: string;
  clubId: string;
  revision: number;
  effectiveDay: number;
  evidence: readonly ScoutingEvidenceRecord[];
  reports: readonly PlayerKnowledgeReport[];
}>;
export type PlayerKnowledgeAt = Readonly<{
  report: PlayerKnowledgeReport;
  freshnessDays: number;
}>;

const validId = (value: string): boolean =>
  typeof value === 'string' && value.length > 0;
const validDay = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
const uniqueIds = (ids: readonly string[]): boolean =>
  ids.length > 0 && ids.every(validId) && new Set(ids).size === ids.length;
export const rejectUnknownScoutingFields = (
  value: unknown, allowed: readonly string[], label: string,
): void => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((field) => !allowed.includes(field))) {
    throw new Error(`unknown or invalid ${label} field`);
  }
};

export const frozenScoutingCopy = <T>(input: T): T => {
  const copy = structuredClone(input);
  const visited = new WeakSet<object>();
  const freeze = (value: unknown): void => {
    if (value === null || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  };
  freeze(copy);
  return copy;
};

export const createClubScoutingKnowledge = (
  careerId: string,
  clubId: string,
): ClubScoutingKnowledge => {
  if (!validId(careerId) || !validId(clubId)) {
    throw new Error('scouting career and club IDs are required');
  }
  return Object.freeze({ careerId, clubId, revision: 0, effectiveDay: 0,
    evidence: Object.freeze([]),
    reports: Object.freeze([]) });
};

/** Register source provenance before a report can consume it. */
export const appendScoutingEvidence = (
  state: ClubScoutingKnowledge,
  expectedRevision: number,
  source: ScoutingEvidenceRecord,
): ClubScoutingKnowledge => {
  if (expectedRevision !== state.revision) throw new Error('stale scouting revision');
  const evidence = frozenScoutingCopy(source);
  rejectUnknownScoutingFields(evidence, ['evidenceId', 'careerId', 'clubId',
    'playerId', 'observedAtDay', 'availableAtDay', 'sourceEventId'],
  'scouting evidence');
  if (evidence.careerId !== state.careerId || evidence.clubId !== state.clubId
    || !validId(evidence.evidenceId) || !validId(evidence.playerId)
    || !validId(evidence.sourceEventId)) {
    throw new Error('scouting evidence career, club or source identity mismatch');
  }
  if (state.evidence.some((item) => item.evidenceId === evidence.evidenceId)) {
    throw new Error('duplicate scouting evidence ID');
  }
  if (!validDay(evidence.observedAtDay) || !validDay(evidence.availableAtDay)
    || evidence.availableAtDay < evidence.observedAtDay) {
    throw new Error('future scouting evidence cannot be available yet');
  }
  if (evidence.availableAtDay < state.effectiveDay) {
    throw new Error('backdated scouting evidence');
  }
  return Object.freeze({ careerId: state.careerId, clubId: state.clubId,
    revision: state.revision + 1, effectiveDay: evidence.availableAtDay,
    evidence: Object.freeze([...state.evidence, evidence]), reports: state.reports });
};

/** Append a club-owned report. It never observes or mutates global player truth. */
export const appendPlayerKnowledgeReport = (
  state: ClubScoutingKnowledge,
  expectedRevision: number,
  source: PlayerKnowledgeReport,
): ClubScoutingKnowledge => {
  if (expectedRevision !== state.revision) {
    throw new Error('stale scouting revision');
  }
  const report = frozenScoutingCopy(source);
  rejectUnknownScoutingFields(report, ['reportId', 'careerId', 'clubId',
    'playerId', 'observedAtDay', 'availableAtDay', 'evidenceSourceIds',
    'evaluatorPersonIds', 'estimate', 'confidence'], 'scouting report');
  if (Array.isArray(report.estimate)) report.estimate.forEach((item) =>
    rejectUnknownScoutingFields(item, ['domainId', 'lower', 'upper'],
      'scouting estimate'));
  if (report.careerId !== state.careerId) {
    throw new Error('scouting report career mismatch');
  }
  if (!validId(report.reportId) || !validId(report.playerId)
    || report.clubId !== state.clubId) {
    throw new Error('scouting report club or identity mismatch');
  }
  if (state.reports.some((item) => item.reportId === report.reportId)) {
    throw new Error('duplicate scouting report ID');
  }
  if (!validDay(report.observedAtDay) || !validDay(report.availableAtDay)
    || report.availableAtDay < report.observedAtDay) {
    throw new Error('future scouting evidence cannot be available yet');
  }
  if (report.availableAtDay < state.effectiveDay) {
    throw new Error('backdated scouting report');
  }
  if (!Array.isArray(report.evidenceSourceIds)
    || !uniqueIds(report.evidenceSourceIds)) {
    throw new Error('scouting report requires unique evidence references');
  }
  const evidence = report.evidenceSourceIds.map((evidenceId) =>
    state.evidence.find((item) => item.evidenceId === evidenceId));
  if (evidence.length === 0 || evidence.some((item) => !item
    || item.careerId !== state.careerId || item.clubId !== state.clubId
    || item.playerId !== report.playerId
    || item.availableAtDay > report.availableAtDay)
    || evidence.reduce((latest, item) =>
      Math.max(latest, item!.observedAtDay), -1)
      !== report.observedAtDay) {
    throw new Error('scouting report evidence is missing, future or mismatched');
  }
  if (!Array.isArray(report.evaluatorPersonIds)
    || !uniqueIds(report.evaluatorPersonIds)
    || !Array.isArray(report.estimate) || report.estimate.length === 0
    || new Set(report.estimate.map((item) => item.domainId)).size
      !== report.estimate.length
    || report.estimate.some((item) => !validId(item.domainId)
      || !Number.isFinite(item.lower) || !Number.isFinite(item.upper)
      || item.lower > item.upper)
    || !['LOW', 'MEDIUM', 'HIGH'].includes(report.confidence)) {
    throw new Error('invalid source-backed scouting estimate');
  }
  return Object.freeze({ careerId: state.careerId, clubId: state.clubId,
    revision: state.revision + 1, effectiveDay: report.availableAtDay,
    evidence: state.evidence,
    reports: Object.freeze([...state.reports, report]) });
};

/** Historical reads exclude reports unavailable then; elapsed time never updates the estimate. */
export const readPlayerKnowledgeAt = (
  state: ClubScoutingKnowledge,
  playerId: string,
  asOfDay: number,
): PlayerKnowledgeAt | null => {
  if (!validId(playerId) || !validDay(asOfDay)) {
    throw new Error('invalid scouting knowledge query');
  }
  const candidates = state.reports.filter((report) =>
    report.playerId === playerId && report.availableAtDay <= asOfDay);
  if (candidates.length === 0) return null;
  const report = candidates.reduce((latest, candidate) =>
    candidate.observedAtDay > latest.observedAtDay
      || (candidate.observedAtDay === latest.observedAtDay
        && candidate.availableAtDay > latest.availableAtDay)
      ? candidate : latest);
  return Object.freeze({ report,
    freshnessDays: asOfDay - report.observedAtDay });
};
