import { applyClubCommand } from '../club/ClubLifecycle';
import { evaluateClubPayrollPrecheck } from '../club/ClubPayrollPrecheck';
import { appendClubWageSchedule, getClubSeasonWageAllocations,
  type ClubWageScheduleLedger } from '../club/ClubWageScheduleLedger';
import type { ClubTransitionEvent, ClubWorldState } from '../club/ClubTypes';
import { deriveRecruitmentAuthority } from '../scouting/RecruitmentAuthority';
import type { RecruitmentDecisionLedger } from '../scouting/RecruitmentDecision';
import { deriveRecruitmentFinance } from '../scouting/SourceBackedRecruitmentFinance';
import { createRosterState } from './RosterState';
import type { ClubPlayerRights, RosterState } from './RosterTypes';
import { freeze, identifier, nonnegativeInteger, object, onlyKeys } from './RosterValidation';

/** Trusted acceptance from the contract owner, causally cited by the club event. */
export type FreeAgentAcceptance = Readonly<{
  acceptanceId: string;
  sourceEventId: string;
  decisionId: string;
  careerId: string;
  clubId: string;
  playerId: string;
  contractId: string;
  acceptedAtDay: number;
  currency: string;
  totalMinorUnits: number;
  termSeasons: number;
}>;
export type FreeAgentRightsEvent = Readonly<{
  type: 'FREE_AGENT_RIGHTS_ACQUIRED';
  eventId: string;
  careerId: string;
  clubId: string;
  playerId: string;
  contractId: string;
  decisionId: string;
  acceptanceId: string;
  sourceClubEventId: string;
  effectiveDay: number;
  beforeRevision: number;
  afterRevision: number;
  beforeRights: ClubPlayerRights;
  afterRights: ClubPlayerRights;
}>;

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Applies only the rights effect of a signed free-agent contract. The host
 * must persist club, wage schedule, roster and events with one compare-and-swap.
 * Registration and assignment remain separate league-governed operations.
 */
export const applyFreeAgentContract = (
  rosterInput: RosterState,
  expectedRosterRevision: number,
  beforeClub: ClubWorldState,
  afterClub: ClubWorldState,
  clubEvent: ClubTransitionEvent,
  beforeSchedules: ClubWageScheduleLedger,
  afterSchedules: ClubWageScheduleLedger,
  decisions: RecruitmentDecisionLedger,
  decisionId: string,
  acceptanceInput: FreeAgentAcceptance,
): Readonly<{ state: RosterState; event: FreeAgentRightsEvent }> => {
  const roster = createRosterState(rosterInput);
  if (expectedRosterRevision !== roster.revision) {
    throw new Error('stale free-agent roster revision');
  }
  const raw = object(acceptanceInput, 'acceptance');
  onlyKeys(raw, ['acceptanceId', 'sourceEventId', 'decisionId', 'careerId',
    'clubId', 'playerId', 'contractId', 'acceptedAtDay', 'currency',
    'totalMinorUnits', 'termSeasons'], 'acceptance');
  const acceptance: FreeAgentAcceptance = {
    acceptanceId: identifier(raw.acceptanceId, 'acceptance.acceptanceId'),
    sourceEventId: identifier(raw.sourceEventId, 'acceptance.sourceEventId'),
    decisionId: identifier(raw.decisionId, 'acceptance.decisionId'),
    careerId: identifier(raw.careerId, 'acceptance.careerId'),
    clubId: identifier(raw.clubId, 'acceptance.clubId'),
    playerId: identifier(raw.playerId, 'acceptance.playerId'),
    contractId: identifier(raw.contractId, 'acceptance.contractId'),
    acceptedAtDay: nonnegativeInteger(raw.acceptedAtDay, 'acceptance.acceptedAtDay'),
    currency: identifier(raw.currency, 'acceptance.currency'),
    totalMinorUnits: nonnegativeInteger(raw.totalMinorUnits, 'acceptance.totalMinorUnits'),
    termSeasons: nonnegativeInteger(raw.termSeasons, 'acceptance.termSeasons'),
  };
  const decision = decisions.decisions.find((item) =>
    item.decisionId === decisionId);
  if (!decision || decisions.careerId !== roster.careerId
    || decisions.clubId !== beforeClub.identity.clubId
    || decision.decision !== 'ACQUIRE'
    || decision.careerId !== roster.careerId
    || decision.clubId !== beforeClub.identity.clubId
    || decision.playerId !== acceptance.playerId
    || decision.decisionId !== acceptance.decisionId
    || !decision.offeredTerms
    || decision.offeredTerms.currency !== acceptance.currency
    || decision.offeredTerms.totalMinorUnits !== acceptance.totalMinorUnits
    || decision.offeredTerms.termSeasons !== acceptance.termSeasons
    || acceptance.totalMinorUnits <= 0 || acceptance.termSeasons <= 0) {
    throw new Error('free-agent acceptance does not match acquisition decision');
  }
  if (acceptance.careerId !== roster.careerId
    || acceptance.clubId !== beforeClub.identity.clubId
    || acceptance.acceptedAtDay < decision.decidedAtDay
    || acceptance.acceptedAtDay > clubEvent.command.effectiveDay
    || roster.effectiveDay > clubEvent.command.effectiveDay
    || !clubEvent.command.causeEventIds.includes(acceptance.sourceEventId)
    || !clubEvent.command.causeEventIds.includes(decisionId)) {
    throw new Error('free-agent acceptance is unavailable or uncited');
  }
  if (beforeClub.careerId !== roster.careerId
    || clubEvent.kind !== 'CLUB_CHANGED'
    || clubEvent.command.expectedRevision !== beforeClub.revision
    || clubEvent.command.careerId !== roster.careerId
    || clubEvent.command.clubId !== beforeClub.identity.clubId
    || clubEvent.command.effectiveDay < beforeClub.effectiveDay) {
    throw new Error('free-agent club event scope mismatch');
  }
  const replay = applyClubCommand(beforeClub, clubEvent.command);
  if (!replay.ok || !same(replay.state, afterClub)
    || !same(replay.event, clubEvent)) {
    throw new Error('free-agent club event does not produce club state');
  }
  const authority = decision.sourceBackedAuthority;
  if (!authority || authority.clubRevision !== beforeClub.revision
    || !same(authority, deriveRecruitmentAuthority(beforeClub,
      authority.profile, decision.authorityPersonId,
      decision.governanceProfileVersion, decision.decidedAtDay))) {
    throw new Error('free-agent authority evidence is missing or stale');
  }
  const finance = deriveRecruitmentFinance(beforeClub,
    roster.careerId, acceptance.clubId, decision.decidedAtDay, 'payroll');
  if (!decision.sourceBackedClubFinance
    || !same(decision.sourceBackedClubFinance,
      finance.sourceBackedClubFinance)) {
    throw new Error('free-agent finance evidence is missing or stale');
  }
  const precheck = evaluateClubPayrollPrecheck(beforeClub,
    decision.payrollPrecheck?.proposedMinorUnits ?? 0,
    getClubSeasonWageAllocations(beforeSchedules, beforeClub));
  if (!decision.payrollPrecheck
    || precheck.outcome !== 'WITHIN_COVERED_RULES'
    || !same(precheck, decision.payrollPrecheck)) {
    throw new Error('free-agent payroll evidence is missing or stale');
  }
  const operations = clubEvent.command.operations.filter((op) =>
    op.kind === 'RECORD_COMMITMENT'
      && op.contractRef === acceptance.contractId);
  const liability = operations[0];
  if (clubEvent.command.operations.length !== 2
    || clubEvent.command.operations.filter((op) =>
      op.kind === 'UPDATE_REFERENCES').length !== 1
    || operations.length !== 1 || !liability
    || liability.kind !== 'RECORD_COMMITMENT'
    || liability.category !== 'playerWages'
    || liability.budgetBucket !== 'payroll'
    || liability.amount !== acceptance.totalMinorUnits
    || liability.currency !== acceptance.currency) {
    throw new Error('free-agent signed wage liability is missing');
  }
  const schedule = afterSchedules.schedules.find((item) =>
    item.commitmentId === liability.commitmentId);
  if (!schedule || schedule.sourceClubEventId !== clubEvent.command.eventId
    || schedule.contractRef !== acceptance.contractId
    || schedule.annualAmounts.length !== acceptance.termSeasons
    || schedule.annualAmounts.some((annual, index) =>
      annual.season !== beforeClub.season.plan.season + index)
    || schedule.annualAmounts[0]?.amount !== precheck.proposedMinorUnits) {
    throw new Error('free-agent wage schedule does not match offer');
  }
  const derivedSchedules = appendClubWageSchedule(beforeSchedules,
    beforeSchedules.revision, afterClub, clubEvent, {
      commitmentId: liability.commitmentId,
      contractRef: acceptance.contractId,
      annualAmounts: schedule.annualAmounts,
    });
  if (!same(derivedSchedules, afterSchedules)) {
    throw new Error('free-agent wage schedule history mismatch');
  }
  getClubSeasonWageAllocations(afterSchedules, afterClub);
  const newReference = afterClub.live.references.playerClubStateRefs.find((ref) =>
    ref.playerId === acceptance.playerId);
  if (beforeClub.live.references.playerClubStateRefs.some((ref) =>
    ref.playerId === acceptance.playerId)
    || !newReference
    || !same(afterClub.live.references, {
      ...beforeClub.live.references,
      playerClubStateRefs: [...beforeClub.live.references.playerClubStateRefs,
        newReference],
    })) {
    throw new Error('free-agent club player reference is missing');
  }
  const player = roster.players.find((item) =>
    item.playerId === acceptance.playerId);
  if (!player || player.clubRights.rightsHolderClubId !== null
    || player.clubRights.contractId !== null
    || player.assignment !== null || player.registrations.length > 0
    || roster.players.some((item) =>
      item.clubRights.contractId === acceptance.contractId)) {
    throw new Error('player is not an unattached free agent');
  }
  const afterRights = { rightsHolderClubId: acceptance.clubId,
    contractId: acceptance.contractId };
  const state = createRosterState({ ...roster,
    revision: roster.revision + 1,
    effectiveDay: clubEvent.command.effectiveDay,
    players: roster.players.map((item) => item.playerId === player.playerId
      ? { ...item, clubRights: afterRights } : item),
  });
  const event: FreeAgentRightsEvent = freeze({
    type: 'FREE_AGENT_RIGHTS_ACQUIRED',
    eventId: `free-agent:${JSON.stringify([roster.careerId, state.revision])}`,
    careerId: roster.careerId, clubId: acceptance.clubId,
    playerId: player.playerId, contractId: acceptance.contractId,
    decisionId, acceptanceId: acceptance.acceptanceId,
    sourceClubEventId: clubEvent.command.eventId,
    effectiveDay: state.effectiveDay, beforeRevision: roster.revision,
    afterRevision: state.revision, beforeRights: player.clubRights,
    afterRights,
  });
  return Object.freeze({ state, event });
};
