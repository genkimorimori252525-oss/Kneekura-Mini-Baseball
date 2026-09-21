import type {
  AssignmentKind, AssignmentUnit, ClubPlayerRights, PlayerAssignment,
  PlayerAvailability, PlayerClubState, PlayerRegistration, RosterCompetitionProfile, RosterIssue,
} from './RosterTypes';

export class RosterValidationError extends Error {
  readonly issue: RosterIssue;
  constructor(issue: RosterIssue) {
    super(`${issue.code}${issue.field ? `: ${issue.field}` : ''}`);
    this.name = 'RosterValidationError';
    this.issue = Object.freeze({ ...issue });
  }
}
export function invalid(field: string): never {
  throw new RosterValidationError({ code: 'INVALID_INPUT', field });
}
export function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(field);
  return value as Record<string, unknown>;
}
export function onlyKeys(value: Record<string, unknown>, keys: readonly string[], field: string): void {
  if (Object.keys(value).some(key => !keys.includes(key))) invalid(field);
}
export function identifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) invalid(field);
  return value;
}
export function nonnegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid(field);
  return value;
}
function positiveInteger(value: unknown, field: string): number {
  const parsed = nonnegativeInteger(value, field);
  if (parsed === 0) invalid(field);
  return parsed;
}
export function array(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) invalid(field);
  return value;
}
function enumeration<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid(field);
  return value as T;
}
const KINDS: readonly AssignmentKind[] = ['FIRST_TEAM', 'RESERVE', 'DEVELOPMENT', 'ACADEMY', 'EXTERNAL'];
export function unique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) throw new RosterValidationError({ code: 'DUPLICATE_ID', field });
}
/** Use only on freshly copied, acyclic DTOs; never freezes caller-owned input. */
export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
export function copyAssignment(value: unknown): PlayerAssignment | null {
  if (value === null) return null;
  const v = object(value, 'assignment');
  onlyKeys(v, ['unitId', 'clubId'], 'assignment');
  return { unitId: identifier(v.unitId, 'assignment.unitId'), clubId: identifier(v.clubId, 'assignment.clubId') };
}
export function copyAvailability(value: unknown): PlayerAvailability {
  const v = object(value, 'availability');
  onlyKeys(v, ['status', 'evidenceId'], 'availability');
  return {
    status: enumeration(v.status, ['AVAILABLE', 'INJURED', 'REHAB', 'UNAVAILABLE'] as const, 'availability.status'),
    evidenceId: identifier(v.evidenceId, 'availability.evidenceId'),
  };
}
export function copyRegistration(value: unknown): PlayerRegistration {
  const v = object(value, 'registration');
  onlyKeys(v, ['competitionEditionId', 'clubId', 'status', 'eligibility', 'evidenceId'], 'registration');
  return {
    competitionEditionId: identifier(v.competitionEditionId, 'registration.competitionEditionId'),
    clubId: identifier(v.clubId, 'registration.clubId'),
    status: enumeration(v.status, ['ACTIVE', 'INACTIVE'] as const, 'registration.status'),
    eligibility: enumeration(v.eligibility, ['ELIGIBLE', 'PENDING', 'INELIGIBLE'] as const, 'registration.eligibility'),
    evidenceId: identifier(v.evidenceId, 'registration.evidenceId'),
  };
}
export function copyRegistrations(value: unknown): readonly PlayerRegistration[] {
  const entries = array(value, 'registrations').map(copyRegistration);
  unique(entries.map(entry => entry.competitionEditionId), 'registrations.competitionEditionId');
  return entries;
}
function copyRights(value: unknown): ClubPlayerRights {
  const v = object(value, 'clubRights');
  return {
    rightsHolderClubId: v.rightsHolderClubId === null ? null : identifier(v.rightsHolderClubId, 'clubRights.rightsHolderClubId'),
    contractId: v.contractId === null ? null : identifier(v.contractId, 'clubRights.contractId'),
  };
}
export function copyPlayer(value: unknown): PlayerClubState {
  const v = object(value, 'player');
  return {
    playerId: identifier(v.playerId, 'playerId'),
    clubRights: copyRights(v.clubRights),
    assignment: copyAssignment(v.assignment),
    registrations: copyRegistrations(v.registrations),
    availability: copyAvailability(v.availability),
  };
}
export function copyUnit(value: unknown): AssignmentUnit {
  const v = object(value, 'unit');
  return {
    unitId: identifier(v.unitId, 'unit.unitId'),
    clubId: identifier(v.clubId, 'unit.clubId'),
    kind: enumeration(v.kind, KINDS, 'unit.kind'),
    ...(v.developmentLevel === undefined ? {} : { developmentLevel: positiveInteger(v.developmentLevel, 'unit.developmentLevel') }),
  };
}
export function copyProfile(value: unknown): RosterCompetitionProfile {
  const v = object(value, 'profile');
  const kinds = array(v.allowedAssignmentKinds, 'profile.allowedAssignmentKinds')
    .map(kind => enumeration(kind, KINDS, 'profile.allowedAssignmentKinds'));
  if (kinds.length === 0) invalid('profile.allowedAssignmentKinds');
  unique(kinds, 'profile.allowedAssignmentKinds');
  if (typeof v.rehabParticipationAllowed !== 'boolean') invalid('profile.rehabParticipationAllowed');
  return {
    profileId: identifier(v.profileId, 'profile.profileId'),
    version: identifier(v.version, 'profile.version'),
    season: positiveInteger(v.season, 'profile.season'),
    competitionEditionId: identifier(v.competitionEditionId, 'profile.competitionEditionId'),
    activeLimit: v.activeLimit === null ? null : nonnegativeInteger(v.activeLimit, 'profile.activeLimit'),
    allowedAssignmentKinds: kinds,
    rehabParticipationAllowed: v.rehabParticipationAllowed,
  };
}