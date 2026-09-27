import { selectControlledDecision } from '../control/ControlledDecision';
import { attributeExecutedDecision } from '../control/DecisionEvidence';
import type { DecisionEvidenceProjection, DecisionOpportunity,
  ExecutedDecision, HumanControlState } from '../control/ControlTypes';
import { id } from '../control/ControlValidation';
import { getCurrentClubManager } from '../club/ClubEvents';
import type { ClubWorldState } from '../club/ClubTypes';
import { same } from '../club/ClubValidation';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import type { RosterChangeCommand, RosterState,
  RosterTransitionEvent } from '../roster/RosterTypes';
import { applyExecutedRosterDecisionMood } from '../team/ExecutedRosterDecisionMood';
import type { AppliedExecutedRosterDecisionMood,
  ExecutedRosterDecisionMoodInput } from '../team/ExecutedRosterDecisionMood';
import type { ManagerControlledSelection } from './ManagerControlledDecision';
import { selectManagerControlledDecision } from './ManagerControlledDecision';
import type { ManagerDecisionAgent } from './ManagerControlledDecision';

export type LegalRosterActionBinding = Readonly<{
  actionId: string;
  /** Immutable payload resolved by the world owner for this legal action. */
  command: Omit<RosterChangeCommand, 'causeEventId'>;
}>;
export type SelectedManagerRosterDispatchInput = Readonly<{
  control: HumanControlState;
  opportunity: DecisionOpportunity;
  selection: ManagerControlledSelection;
  selectionAgent: ManagerDecisionAgent;
  candidateActionIds?: readonly string[];
  clubAtAction: ClubWorldState;
  clubAsOfDay: number;
  roster: RosterState;
  binding: LegalRosterActionBinding;
  currentWorldRevision: number;
  afterWorldRevision: number;
  executionId: string;
  moodContext?: Pick<ExecutedRosterDecisionMoodInput,
    'mood' | 'relationships' | 'emotionState'
      | 'appraisalInput' | 'policy'>;
}>;
export type SelectedManagerRosterDispatch = Readonly<{
  roster: RosterState;
  rosterEvent: RosterTransitionEvent;
  execution: ExecutedDecision;
  projection: DecisionEvidenceProjection;
  mood: AppliedExecutedRosterDecisionMood | null;
}>;
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** Executes only the selected, legal roster action; persistence belongs to the host. */
export const dispatchSelectedManagerRosterDecision = (
  input: SelectedManagerRosterDispatchInput,
): SelectedManagerRosterDispatch => {
  const { selection, opportunity, clubAtAction: club,
    binding } = input;
  const decision = selection.decision;
  const roster = createRosterState(input.roster);
  if (decision.actor.kind !== 'MANAGER'
    || decision.origin === 'HUMAN_OVERRIDE'
    || selection.trace.decisionId !== decision.decisionId
    || selection.trace.contextId !== decision.contextId
    || selection.trace.actionId !== decision.actionId
    || selection.trace.traceId !== decision.actor.traceId
    || binding.actionId !== decision.actionId
    || binding.command.commandId !== decision.actionId) {
    throw new Error('manager selected action does not match roster binding');
  }
  const reselected = selectManagerControlledDecision(input.control,
    opportunity, input.selectionAgent, selection.trace.traceId,
    input.candidateActionIds);
  if (!reselected.ok || !same(reselected.value, selection)) {
    throw new Error('manager selection does not match current belief and authority');
  }
  const authorized = selectControlledDecision(input.control,
    opportunity, { decisionId: decision.decisionId,
      contextId: decision.contextId,
      expectedControlRevision: decision.controlRevision,
      expectedWorldRevision: decision.worldRevision,
      actionId: decision.actionId, actor: decision.actor });
  if (!authorized.ok || !same(authorized.value, decision)) {
    throw new Error('manager decision authority or legality changed');
  }
  const manager = getCurrentClubManager(club);
  if (!manager.ok || manager.value?.managerId !== decision.managerId
    || manager.value.appointmentId !== decision.appointmentId
    || club.identity.clubId !== decision.clubId
    || roster.careerId !== club.careerId
    || club.season.closureRef !== null
    || !day(input.clubAsOfDay)
    || input.clubAsOfDay !== binding.command.effectiveDay
    || club.effectiveDay > input.clubAsOfDay
    || club.season.plan.startsOnDay > input.clubAsOfDay
    || roster.effectiveDay > input.clubAsOfDay
    || !roster.profiles.some((profile) =>
      profile.season === club.season.plan.season)) {
    throw new Error('Club or manager is not current for roster action');
  }
  if (!day(input.currentWorldRevision)
    || input.currentWorldRevision !== opportunity.worldRevision
    || !day(input.afterWorldRevision)
    || input.afterWorldRevision <= input.currentWorldRevision) {
    throw new Error('invalid roster decision world revision');
  }
  const executionId = id(input.executionId, 'executionId');
  const command: RosterChangeCommand = {
    commandId: binding.command.commandId,
    causeEventId: executionId,
    expectedRevision: binding.command.expectedRevision,
    effectiveDay: binding.command.effectiveDay,
    changes: binding.command.changes,
  };
  const applied = applyRosterChange(roster, command);
  if (!applied.ok) {
    throw new Error(`${applied.rejection.code}: roster action failed`);
  }
  const execution: ExecutedDecision = Object.freeze({ executionId,
    decisionId: decision.decisionId,
    contextId: decision.contextId,
    actionId: decision.actionId,
    worldRevision: input.afterWorldRevision,
    eventIds: Object.freeze([applied.event.eventId]) });
  const projected = attributeExecutedDecision(decision, execution);
  if (!projected.ok) {
    throw new Error('executed roster decision projection failed');
  }
  const mood = input.moodContext === undefined ? null
    : applyExecutedRosterDecisionMood({
      clubAtAction: club, clubAsOfDay: input.clubAsOfDay,
      roster, rosterCommand: command,
      rosterEvent: applied.event, decision, execution,
      ...input.moodContext,
    });
  return Object.freeze({ roster: applied.state,
    rosterEvent: applied.event, execution,
    projection: projected.value, mood });
};
