import { rejectUnknownScoutingFields,
  type ClubScoutingKnowledge, type PlayerKnowledgeReport } from '../scouting/ScoutingKnowledge';
import { evaluateRosterParticipation } from './RosterQueries';
import type { RosterState } from './RosterTypes';

export type RosterNeedHorizon = 'NOW' | 'NEXT_SEASON' | 'LONG_TERM';
export type RosterNeedPlanningPolicy = Readonly<{
  version: string;
  roles: readonly Readonly<Pick<RosterNeedRequest,
    'positionGroup' | 'requiredRole' | 'candidateDomainId'
    | 'minimumCandidateEstimate' | 'knowledgeDomainId'
    | 'minimumEstimate' | 'targetCount'>>[];
}>;
export type RosterNeedRequest = Readonly<{
  careerId: string;
  clubId: string;
  asOfDay: number;
  snapshotId: string;
  policyVersion: string;
  competitionEditionId: string;
  positionGroup: string;
  /** Report domain identifying candidates for this position and role. */
  candidateDomainId: string;
  minimumCandidateEstimate: number;
  /** Club knowledge domain selected by the planning policy, not a global ability key. */
  knowledgeDomainId: string;
  requiredRole: string;
  horizon: RosterNeedHorizon;
  targetCount: number;
  /** Minimum acceptable club estimate for this role; supplied by pinned policy. */
  minimumEstimate: number;
}>;
export type SourceBackedRosterNeed = Readonly<RosterNeedRequest & {
  coverageScope: 'DOCUMENTED_ROLE_CANDIDATES';
  rosterRevision: number;
  knowledgeRevision: number;
  confirmedPlayerIds: readonly string[];
  uncertainPlayerIds: readonly string[];
  unsuitablePlayerIds: readonly string[];
  unknownPlayerIds: readonly string[];
  sourceReportIds: readonly string[];
  /** Lower vacancy bound among documented role candidates. */
  guaranteedVacancies: number;
  /** Upper vacancy bound among documented role candidates. */
  possibleVacancies: number;
  /** Documented vacancy fraction; a planning signal, not an acquisition approval. */
  urgency: number;
}>;

const validId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const validDay = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const latestDomainReport = (
  knowledge: ClubScoutingKnowledge, playerId: string,
  domainId: string, asOfDay: number,
): PlayerKnowledgeReport | undefined => knowledge.reports
  .filter((report) => report.playerId === playerId
    && report.availableAtDay <= asOfDay
    && report.estimate.some((item) => item.domainId === domainId))
  .sort((a, b) => b.observedAtDay - a.observedAtDay
    || b.availableAtDay - a.availableAtDay
    || a.reportId.localeCompare(b.reportId))[0];

/** Derive conservative club depth from administrative eligibility and known reports. */
export function deriveSourceBackedRosterNeed(
  roster: RosterState,
  knowledge: ClubScoutingKnowledge,
  request: RosterNeedRequest,
  policy: RosterNeedPlanningPolicy,
): SourceBackedRosterNeed {
  rejectUnknownScoutingFields(request, ['careerId', 'clubId', 'asOfDay',
    'snapshotId', 'policyVersion', 'competitionEditionId', 'positionGroup',
    'candidateDomainId', 'minimumCandidateEstimate', 'knowledgeDomainId',
    'requiredRole', 'horizon', 'targetCount',
    'minimumEstimate'],
  'roster need request');
  rejectUnknownScoutingFields(policy, ['version', 'roles'], 'roster need policy');
  if (!validId(policy.version) || !Array.isArray(policy.roles)
    || policy.roles.length === 0) {
    throw new Error('invalid roster need policy');
  }
  for (const role of policy.roles) {
    rejectUnknownScoutingFields(role, ['positionGroup', 'requiredRole',
      'candidateDomainId', 'minimumCandidateEstimate', 'knowledgeDomainId',
      'minimumEstimate', 'targetCount'], 'roster need role policy');
    if (!validId(role.positionGroup) || !validId(role.requiredRole)
      || !validId(role.candidateDomainId) || !validId(role.knowledgeDomainId)
      || role.candidateDomainId === role.knowledgeDomainId
      || !Number.isFinite(role.minimumCandidateEstimate)
      || !Number.isFinite(role.minimumEstimate)
      || !Number.isSafeInteger(role.targetCount) || role.targetCount <= 0) {
      throw new Error('invalid roster need role policy');
    }
  }
  const rolePolicy = policy.roles.filter((role) =>
    role.positionGroup === request.positionGroup
    && role.requiredRole === request.requiredRole);
  const roleFields = ['positionGroup', 'requiredRole', 'candidateDomainId',
    'minimumCandidateEstimate', 'knowledgeDomainId', 'minimumEstimate',
    'targetCount'] as const;
  if (policy.version !== request.policyVersion || rolePolicy.length !== 1
    || roleFields.some((key) => rolePolicy[0][key] !== request[key])) {
    throw new Error('roster need request does not match pinned role policy');
  }
  if (request.careerId !== roster.careerId
    || request.careerId !== knowledge.careerId
    || request.clubId !== knowledge.clubId
    || !validId(request.clubId) || !validId(request.snapshotId)
    || !validId(request.policyVersion) || !validId(request.competitionEditionId)
    || !validId(request.positionGroup) || !validId(request.candidateDomainId)
    || !validId(request.knowledgeDomainId)
    || request.candidateDomainId === request.knowledgeDomainId
    || !validId(request.requiredRole)
    || !validDay(request.asOfDay) || roster.effectiveDay > request.asOfDay
    || !['NOW', 'NEXT_SEASON', 'LONG_TERM'].includes(request.horizon)
    || !Number.isSafeInteger(request.targetCount) || request.targetCount <= 0
    || !Number.isFinite(request.minimumEstimate)
    || !Number.isFinite(request.minimumCandidateEstimate)
    || !roster.profiles.some((profile) =>
      profile.competitionEditionId === request.competitionEditionId)) {
    throw new Error('invalid or future roster need source and policy');
  }
  const confirmedPlayerIds: string[] = [];
  const uncertainPlayerIds: string[] = [];
  const unsuitablePlayerIds: string[] = [];
  const unknownPlayerIds: string[] = [];
  const sourceReportIds: string[] = [];
  for (const player of roster.players) {
    if (player.assignment?.clubId !== request.clubId) continue;
    if (request.horizon === 'NOW' && !evaluateRosterParticipation(roster, {
      playerId: player.playerId, clubId: request.clubId,
      competitionEditionId: request.competitionEditionId,
    }).eligible) continue;
    const candidacyReport = latestDomainReport(knowledge, player.playerId,
      request.candidateDomainId, request.asOfDay);
    const candidacy = candidacyReport?.estimate.find((item) =>
      item.domainId === request.candidateDomainId);
    if (!candidacy || !candidacyReport) continue;
    sourceReportIds.push(candidacyReport.reportId);
    if (candidacy.upper < request.minimumCandidateEstimate) {
      unsuitablePlayerIds.push(player.playerId);
      continue;
    }
    const fitReport = latestDomainReport(knowledge, player.playerId,
      request.knowledgeDomainId, request.asOfDay);
    const estimate = fitReport?.estimate.find((item) =>
      item.domainId === request.knowledgeDomainId);
    if (fitReport && estimate) {
      if (fitReport.reportId !== candidacyReport.reportId) {
        sourceReportIds.push(fitReport.reportId);
      }
      if (estimate.upper < request.minimumEstimate) {
        unsuitablePlayerIds.push(player.playerId);
        continue;
      }
    }
    if (candidacy.lower < request.minimumCandidateEstimate) {
      uncertainPlayerIds.push(player.playerId);
      continue;
    }
    if (estimate) {
      if (estimate.lower >= request.minimumEstimate) {
        confirmedPlayerIds.push(player.playerId);
      } else {
        uncertainPlayerIds.push(player.playerId);
      }
    } else {
      unknownPlayerIds.push(player.playerId);
    }
  }
  confirmedPlayerIds.sort();
  uncertainPlayerIds.sort();
  unsuitablePlayerIds.sort();
  unknownPlayerIds.sort();
  sourceReportIds.sort();
  const guaranteedVacancies = Math.max(0,
    request.targetCount - confirmedPlayerIds.length
      - uncertainPlayerIds.length - unknownPlayerIds.length);
  const possibleVacancies = Math.max(0,
    request.targetCount - confirmedPlayerIds.length);
  return Object.freeze({ ...request,
    coverageScope: 'DOCUMENTED_ROLE_CANDIDATES' as const,
    rosterRevision: roster.revision,
    knowledgeRevision: knowledge.revision,
    confirmedPlayerIds: Object.freeze(confirmedPlayerIds),
    uncertainPlayerIds: Object.freeze(uncertainPlayerIds),
    unsuitablePlayerIds: Object.freeze(unsuitablePlayerIds),
    unknownPlayerIds: Object.freeze(unknownPlayerIds),
    sourceReportIds: Object.freeze(sourceReportIds),
    guaranteedVacancies, possibleVacancies,
    urgency: guaranteedVacancies / request.targetCount });
}
