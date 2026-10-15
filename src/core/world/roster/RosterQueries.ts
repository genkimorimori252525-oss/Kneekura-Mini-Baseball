import type {
  ClubRosterSummary, RosterIssue, RosterParticipationQuery, RosterParticipationResult, RosterState,
} from './RosterTypes';
import { freeze, identifier, object, RosterValidationError } from './RosterValidation';

/** Administrative roster gate only; competition/game legality still belongs upstream. */
export function evaluateRosterParticipation(state: RosterState, query: RosterParticipationQuery): RosterParticipationResult {
  try {
    const v = object(query, 'query');
    identifier(v.playerId, 'query.playerId');
    identifier(v.clubId, 'query.clubId');
    identifier(v.competitionEditionId, 'query.competitionEditionId');
  } catch (error) {
    if (!(error instanceof RosterValidationError)) throw error;
    return freeze({ scope: 'ROSTER_ONLY', eligible: false, profile: null, reasons: [error.issue] });
  }
  const player = state.players.find(p => p.playerId === query.playerId);
  const policy = state.profiles.find(p => p.competitionEditionId === query.competitionEditionId);
  const profile = policy ? {
    profileId: policy.profileId, version: policy.version,
    season: policy.season, competitionEditionId: policy.competitionEditionId,
  } : null;
  const reasons: RosterIssue[] = [];
  if (!player) reasons.push({ code: 'UNKNOWN_PLAYER', playerId: query.playerId });
  if (!policy) reasons.push({ code: 'UNKNOWN_COMPETITION', competitionEditionId: query.competitionEditionId });
  if (player && policy) {
    if (player.assignment?.clubId !== query.clubId) {
      reasons.push({ code: 'NOT_ASSIGNED_TO_CLUB', playerId: query.playerId, clubId: query.clubId });
    } else {
      const unit = state.units.find(u => u.unitId === player.assignment?.unitId)!;
      if (!policy.allowedAssignmentKinds.includes(unit.kind)) {
        reasons.push({ code: 'ASSIGNMENT_KIND_NOT_ALLOWED', playerId: query.playerId });
      }
    }
    const registration = player.registrations.find(r => r.competitionEditionId === query.competitionEditionId && r.clubId === query.clubId);
    if (!registration) reasons.push({ code: 'NOT_REGISTERED', playerId: query.playerId, competitionEditionId: query.competitionEditionId });
    else {
      if (registration.status !== 'ACTIVE') reasons.push({ code: 'REGISTRATION_INACTIVE', playerId: query.playerId });
      if (registration.eligibility !== 'ELIGIBLE') reasons.push({ code: 'REGISTRATION_NOT_ELIGIBLE', playerId: query.playerId });
    }
    if (player.availability.status === 'INJURED' || player.availability.status === 'UNAVAILABLE') {
      reasons.push({ code: 'PLAYER_UNAVAILABLE', playerId: query.playerId });
    } else if (player.availability.status === 'REHAB' && !policy.rehabParticipationAllowed) {
      reasons.push({ code: 'REHAB_NOT_PERMITTED', playerId: query.playerId });
    }
  }
  return freeze({ scope: 'ROSTER_ONLY', eligible: reasons.length === 0, profile, reasons });
}

/** Rights-held and physically assigned players are intentionally different sets. */
export function getClubRoster(state: RosterState, clubId: string): ClubRosterSummary {
  identifier(clubId, 'clubId');
  return freeze({
    careerId: state.careerId, clubId, revision: state.revision,
    rightsHeldPlayerIds: state.players.filter(p => p.clubRights.rightsHolderClubId === clubId).map(p => p.playerId),
    assignedPlayerIds: state.players.filter(p => p.assignment?.clubId === clubId).map(p => p.playerId),
  });
}