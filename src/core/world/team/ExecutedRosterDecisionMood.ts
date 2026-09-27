import { attributeExecutedDecision } from '../control/DecisionEvidence';
import type { ControlledDecision, DecisionEvidenceProjection,
  ExecutedDecision } from '../control/ControlTypes';
import { getCurrentClubManager } from '../club/ClubEvents';
import type { ClubWorldState } from '../club/ClubTypes';
import { same } from '../club/ClubValidation';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import type { RosterChangeCommand, RosterState,
  RosterTransitionEvent } from '../roster/RosterTypes';
import { EMOTIONS } from '../psychology/EmotionTypes';
import type { EmotionKind } from '../psychology/EmotionTypes';
import { evaluateAppraisedEmotion } from '../psychology/appraisal/AppraisalGate';
import type { AppliedAppraisal } from '../psychology/appraisal/AppraisalTypes';
import { readAppraisalInput } from '../psychology/appraisal/AppraisalValidation';
import type { PlayerRelationshipNetwork } from './PlayerRelationships';
import { applyTeamMoodSignal, TEAM_MOOD_AXES } from './TeamMood';
import type { TeamMoodAxis, TeamMoodEvent,
  TeamMoodState } from './TeamMood';

export type ExecutedRosterMoodPolicy = Readonly<{
  policyId: string;
  version: string;
  season: number;
  availableAtDay: number;
  responses: Readonly<Record<EmotionKind, Readonly<{
    axis: TeamMoodAxis;
    deltaAtFullPressure: number;
  }>>>;
}>;
export type ExecutedRosterDecisionMoodInput = Readonly<{
  /** The Match host supplies the Club snapshot current at the action day. */
  clubAtAction: ClubWorldState;
  clubAsOfDay: number;
  roster: RosterState;
  rosterCommand: RosterChangeCommand;
  rosterEvent: RosterTransitionEvent;
  decision: ControlledDecision;
  execution: ExecutedDecision;
  mood: TeamMoodState;
  relationships: PlayerRelationshipNetwork;
  emotionState: unknown;
  appraisalInput: unknown;
  policy: ExecutedRosterMoodPolicy;
}>;
export type AppliedExecutedRosterDecisionMood = Readonly<{
  projection: DecisionEvidenceProjection;
  appraisal: AppliedAppraisal;
  mood: Readonly<{ state: TeamMoodState;
    event: TeamMoodEvent }> | null;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** An executed baseball decision reaches Mood through one receiver's appraisal. */
export const applyExecutedRosterDecisionMood = (
  input: ExecutedRosterDecisionMoodInput,
): AppliedExecutedRosterDecisionMood => {
  const { clubAtAction: club, rosterCommand, rosterEvent,
    decision, execution, mood, relationships, policy } = input;
  const roster = createRosterState(input.roster);
  const projection = attributeExecutedDecision(decision, execution);
  if (!projection.ok
    || !projection.value.worldEvidence.eventIds.includes(
      rosterEvent.eventId)
    || rosterCommand.causeEventId !== execution.executionId) {
    throw new Error('decision execution does not cause roster event');
  }
  const replay = applyRosterChange(roster, rosterCommand);
  if (!replay.ok || !same(replay.event, rosterEvent)) {
    throw new Error('invalid executed roster event');
  }
  const manager = getCurrentClubManager(club);
  if (!manager.ok || manager.value?.managerId !== decision.managerId
    || manager.value.appointmentId !== decision.appointmentId
    || decision.clubId !== club.identity.clubId
    || roster.careerId !== club.careerId
    || mood.careerId !== club.careerId
    || mood.clubId !== club.identity.clubId
    || mood.season !== club.season.plan.season
    || club.season.closureRef !== null
    || !day(input.clubAsOfDay)
    || input.clubAsOfDay !== rosterEvent.effectiveDay
    || club.effectiveDay > rosterEvent.effectiveDay
    || club.season.plan.startsOnDay > rosterEvent.effectiveDay
    || roster.effectiveDay > rosterEvent.effectiveDay) {
    throw new Error('Club or manager is not current for roster action');
  }
  if (!policy || !id(policy.policyId) || !id(policy.version)
    || policy.season !== mood.season || !day(policy.availableAtDay)
    || policy.availableAtDay > rosterEvent.effectiveDay
    || !policy.responses
    || EMOTIONS.some((emotion) => {
      const response = policy.responses[emotion];
      return !response || !TEAM_MOOD_AXES.includes(response.axis)
        || !Number.isFinite(response.deltaAtFullPressure)
        || Math.abs(response.deltaAtFullPressure) > 100;
    })) {
    throw new Error('invalid executed roster mood policy');
  }
  const appraisalInput = readAppraisalInput(input.appraisalInput);
  const receiverId = appraisalInput.importance.scope.playerId;
  if (appraisalInput.importance.scope.careerId !== club.careerId
    || appraisalInput.importance.clubId !== club.identity.clubId
    || appraisalInput.event.eventId !== rosterEvent.eventId
    || appraisalInput.evidenceEventIds.length !== 1
    || appraisalInput.evidenceEventIds[0] !== rosterEvent.eventId
    || !rosterEvent.changes.some((change) =>
      change.playerId === receiverId
        && (change.before.assignment?.clubId === mood.clubId
          || change.after.assignment?.clubId === mood.clubId))) {
    throw new Error('receiver appraisal lacks executed roster evidence');
  }
  const evaluated = evaluateAppraisedEmotion(input.emotionState,
    appraisalInput);
  if (!evaluated.ok) {
    throw new Error(`${evaluated.reason.code}: receiver appraisal gate`);
  }
  const appraisal = evaluated.value;
  const emotion = appraisal.influence.activeEmotion;
  if (emotion === null || (appraisal.event.transition !== 'ACTIVATED'
    && appraisal.event.transition !== 'CHANGED')) {
    return Object.freeze({ projection: projection.value,
      appraisal, mood: null });
  }
  const response = policy.responses[emotion];
  const candidate = appraisal.computation.appraisal.candidates.find(
    (item) => item.emotion === emotion)!;
  const delta = candidate.pressure * response.deltaAtFullPressure;
  if (delta === 0) {
    return Object.freeze({ projection: projection.value,
      appraisal, mood: null });
  }
  const appliedMood = applyTeamMoodSignal(mood, roster, relationships, {
    eventId: `team-mood/${encodeURIComponent(execution.executionId)}`,
    sourceEventId: rosterEvent.eventId,
    appraisalId: appraisal.computation.appraisal.appraisalId,
    careerId: mood.careerId, clubId: mood.clubId,
    season: mood.season, directPlayerId: receiverId,
    atDay: rosterEvent.effectiveDay,
    axis: response.axis, delta,
  });
  return Object.freeze({ projection: projection.value,
    appraisal, mood: appliedMood });
};
