import { applyRosterChange } from '../../roster/RosterCommands';
import { createRosterState } from '../../roster/RosterState';
import type { RosterChangeCommand, RosterState,
  RosterTransitionEvent } from '../../roster/RosterTypes';
import { assessTeamMoodGate } from '../../team/TeamMoodGate';
import type { TeamMoodGateAssessment,
  TeamMoodGatePolicy } from '../../team/TeamMoodGate';
import type { TeamMoodPlayer, TeamMoodState } from '../../team/TeamMood';
import { EMOTIONS } from '../EmotionTypes';
import type { EmotionKind, EmotionResult } from '../EmotionTypes';
import { restoreEmotionState } from '../EmotionState';
import { attempt, fail, fraction, obj, same, text } from '../EmotionValidation';
import { evaluateAppraisedEmotion } from './AppraisalGate';
import type { AppliedAppraisal, AppraisalInput } from './AppraisalTypes';
import { readAppraisalInput } from './AppraisalValidation';
import type { SocialAppraisalCue } from './SourceAppraisal';

export type TeamMoodAppraisalPolicy = Readonly<{
  policyId: string;
  version: string;
  maxCue: number;
  weights: Readonly<Record<EmotionKind, number>>;
}>;
export type AppliedTeamMoodRosterAppraisal = Readonly<{
  sourceRosterEventId: string;
  gate: TeamMoodGateAssessment;
  cue: SocialAppraisalCue;
  policy: TeamMoodAppraisalPolicy;
  applied: AppliedAppraisal;
}>;

const readPolicy = (input: unknown): TeamMoodAppraisalPolicy => {
  const source = obj(input, ['policyId', 'version',
    'maxCue', 'weights'], 'teamMoodAppraisal.policy');
  const weights = obj(source.weights, EMOTIONS,
    'teamMoodAppraisal.policy.weights');
  const maxCue = fraction(source.maxCue,
    'teamMoodAppraisal.policy.maxCue');
  if (maxCue === 0) fail('INVALID_INPUT',
    'teamMoodAppraisal.policy.maxCue');
  const parsedWeights = {} as Record<EmotionKind, number>;
  for (const emotion of EMOTIONS) {
    parsedWeights[emotion] = fraction(weights[emotion],
      `teamMoodAppraisal.policy.weights.${emotion}`, true);
  }
  return { policyId: text(source.policyId,
    'teamMoodAppraisal.policy.policyId'),
  version: text(source.version,
    'teamMoodAppraisal.policy.version'), maxCue,
  weights: parsedWeights };
};
const upward = (value: number, baseline: number): number =>
  baseline === 100 ? 0 : Math.max(0, value - baseline)
    / (100 - baseline);
const downward = (value: number, baseline: number): number =>
  baseline === 0 ? 0 : Math.max(0, baseline - value) / baseline;
const personalCue = (state: TeamMoodState,
  gate: TeamMoodGateAssessment,
  player: TeamMoodPlayer): number => {
  const base = state.policy.baseline;
  const mood = player.mood;
  const positive = Math.max(0,
    gate.reasons.includes('HIGH_COHESION')
      ? upward(mood.cohesion, base.cohesion) : 0,
    gate.reasons.includes('CONFIDENCE_AND_ENERGY')
      ? Math.min(upward(mood.confidence, base.confidence),
        upward(mood.energy, base.energy)) : 0);
  const negative = Math.max(0,
    gate.reasons.includes('SEVERE_TENSION')
      ? upward(mood.tension, base.tension) : 0,
    gate.reasons.includes('ROLE_HARMONY_COLLAPSE')
      ? downward(mood.roleHarmony, base.roleHarmony) : 0);
  return positive - negative;
};

/**
 * A replay-verified roster event is appraised under an exceptional team social
 * environment. Mood supplies a player-specific situation cue to the pinned
 * appraisal model; it does not directly change ability or execution.
 */
export const evaluateTeamMoodRosterAppraisal = (
  emotionState: unknown,
  appraisalInput: unknown,
  mood: TeamMoodState,
  gatePolicy: TeamMoodGatePolicy,
  beforeRosterInput: RosterState,
  rosterCommand: RosterChangeCommand,
  rosterEvent: RosterTransitionEvent,
  policyInput: unknown,
): EmotionResult<AppliedTeamMoodRosterAppraisal | null> => attempt(() => {
  const policy = readPolicy(policyInput);
  const input = readAppraisalInput(appraisalInput);
  let beforeRoster: RosterState;
  let gate: TeamMoodGateAssessment;
  try {
    beforeRoster = createRosterState(beforeRosterInput);
    gate = assessTeamMoodGate(mood, gatePolicy);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    fail('INVALID_INPUT', 'teamMoodAppraisal.sourceState');
  }
  const replay = applyRosterChange(beforeRoster, rosterCommand);
  if (!replay.ok || !same(replay.event, rosterEvent)) {
    fail('REPLAY_MISMATCH', 'teamMoodAppraisal.rosterEvent');
  }
  const scope = input.importance.scope;
  const assigned = beforeRoster.players.filter((player) =>
    player.assignment?.clubId === mood.clubId)
    .map((player) => player.playerId);
  if (beforeRoster.careerId !== mood.careerId
    || mood.effectiveDay > rosterEvent.effectiveDay
    || scope.careerId !== mood.careerId
    || input.importance.clubId !== mood.clubId
    || input.event.eventId !== rosterEvent.eventId
    || rosterEvent.careerId !== mood.careerId
    || !assigned.includes(scope.playerId)
    || assigned.length !== mood.players.length
    || assigned.some((playerId) => !mood.players.some((player) =>
      player.playerId === playerId))
    || !rosterEvent.changes.some((change) =>
      change.before.assignment?.clubId === mood.clubId
        || change.after.assignment?.clubId === mood.clubId)) {
    fail('SCOPE_MISMATCH', 'teamMoodAppraisal.scope');
  }
  if (!gate.appraisalEligible) return null;
  const player = mood.players.find((entry) =>
    entry.playerId === scope.playerId)!;
  const value = personalCue(mood, gate, player) * policy.maxCue;
  if (value === 0) return null;
  const currentEmotion = restoreEmotionState(emotionState);
  if (!currentEmotion.ok) {
    fail(currentEmotion.reason.code, currentEmotion.reason.path);
  }
  if (currentEmotion.value.lastAppraisal?.evidenceEventIds
    .includes(rosterEvent.eventId)) {
    fail('DUPLICATE_APPRAISAL', 'teamMoodAppraisal.rosterEvent');
  }
  const cue: SocialAppraisalCue = { value, weights: policy.weights };
  const adapted: AppraisalInput = { ...input,
    bundleId: JSON.stringify(['team-mood-roster-appraisal-v1',
      input.bundleId, rosterEvent.eventId, mood.revision,
      mood.policy.policyId, mood.policy.version,
      gate.policyId, gate.policyVersion, gate.reasons,
      policy.policyId, policy.version, policy.maxCue,
      policy.weights, scope.playerId, value]) };
  const applied = evaluateAppraisedEmotion(currentEmotion.value,
    adapted, cue);
  if (!applied.ok) fail(applied.reason.code, applied.reason.path);
  return { sourceRosterEventId: rosterEvent.eventId,
    gate, cue, policy, applied: applied.value };
});
