/** Administrative references only. The global player/ability state remains elsewhere. */
export type AssignmentKind = 'FIRST_TEAM' | 'RESERVE' | 'DEVELOPMENT' | 'ACADEMY' | 'EXTERNAL';
export type AssignmentUnit = Readonly<{
  unitId: string;
  clubId: string;
  kind: AssignmentKind;
  developmentLevel?: number;
}>;
export type PlayerAssignment = Readonly<{ unitId: string; clubId: string }>;
export type ClubPlayerRights = Readonly<{ rightsHolderClubId: string | null; contractId: string | null }>;
export type PlayerRegistration = Readonly<{
  competitionEditionId: string;
  clubId: string;
  status: 'ACTIVE' | 'INACTIVE';
  eligibility: 'ELIGIBLE' | 'PENDING' | 'INELIGIBLE';
  evidenceId: string;
}>;
export type PlayerAvailability = Readonly<{
  status: 'AVAILABLE' | 'INJURED' | 'REHAB' | 'UNAVAILABLE';
  evidenceId: string;
}>;
export type PlayerClubState = Readonly<{
  playerId: string;
  clubRights: ClubPlayerRights;
  assignment: PlayerAssignment | null;
  registrations: readonly PlayerRegistration[];
  availability: PlayerAvailability;
}>;

/** A pinned edition policy, not a claim about any real league's current rules. */
export type RosterCompetitionProfile = Readonly<{
  profileId: string;
  version: string;
  season: number;
  competitionEditionId: string;
  activeLimit: number | null;
  allowedAssignmentKinds: readonly AssignmentKind[];
  rehabParticipationAllowed: boolean;
}>;
export type RosterProfileReference = Readonly<Pick<RosterCompetitionProfile,
  'profileId' | 'version' | 'season' | 'competitionEditionId'>>;
export type RosterStateInput = Readonly<{
  careerId: string;
  profiles: readonly RosterCompetitionProfile[];
  units: readonly AssignmentUnit[];
  players: readonly PlayerClubState[];
  revision?: number;
  effectiveDay?: number;
}>;
export type RosterState = Readonly<Omit<RosterStateInput, 'revision' | 'effectiveDay'> & {
  revision: number;
  effectiveDay: number;
}>;

export type RosterIssueCode =
  | 'INVALID_INPUT' | 'DUPLICATE_ID' | 'UNKNOWN_PLAYER' | 'UNKNOWN_UNIT'
  | 'UNKNOWN_COMPETITION' | 'ASSIGNMENT_CLUB_MISMATCH' | 'ACTIVE_LIMIT_EXCEEDED'
  | 'STALE_REVISION' | 'BACKDATED_COMMAND' | 'NO_CHANGE' | 'EXTERNAL_TRANSACTION_REQUIRED'
  | 'NOT_ASSIGNED_TO_CLUB' | 'ASSIGNMENT_KIND_NOT_ALLOWED' | 'NOT_REGISTERED'
  | 'REGISTRATION_INACTIVE' | 'REGISTRATION_NOT_ELIGIBLE' | 'PLAYER_UNAVAILABLE'
  | 'REHAB_NOT_PERMITTED';
export type RosterIssue = Readonly<{
  code: RosterIssueCode;
  field?: string;
  playerId?: string;
  clubId?: string;
  competitionEditionId?: string;
  limit?: number;
  actual?: number;
}>;
export type PlayerRosterChange = Readonly<{
  playerId: string;
  assignment?: PlayerAssignment | null;
  availability?: PlayerAvailability;
  /** Upsert supplied edition entries; other registrations remain unchanged. */
  registrations?: readonly PlayerRegistration[];
}>;
export type RosterChangeCommand = Readonly<{
  commandId: string;
  causeEventId: string;
  expectedRevision: number;
  effectiveDay: number;
  changes: readonly PlayerRosterChange[];
}>;
export type RosterTransitionEvent = Readonly<{
  type: 'ROSTER_CHANGED';
  eventId: string;
  careerId: string;
  commandId: string;
  causeEventId: string;
  effectiveDay: number;
  beforeRevision: number;
  afterRevision: number;
  changes: readonly Readonly<{ playerId: string; before: PlayerClubState; after: PlayerClubState }>[];
}>;
export type RosterChangeResult =
  | Readonly<{ ok: true; state: RosterState; event: RosterTransitionEvent }>
  | Readonly<{ ok: false; state: RosterState; rejection: RosterIssue }>;
export type RosterParticipationQuery = Readonly<{
  playerId: string;
  clubId: string;
  competitionEditionId: string;
}>;
export type RosterParticipationResult = Readonly<{
  scope: 'ROSTER_ONLY';
  eligible: boolean;
  profile: RosterProfileReference | null;
  reasons: readonly RosterIssue[];
}>;
export type ClubRosterSummary = Readonly<{
  careerId: string;
  clubId: string;
  revision: number;
  rightsHeldPlayerIds: readonly string[];
  assignedPlayerIds: readonly string[];
}>;