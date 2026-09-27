import { evaluateBattingResonance } from '../../team/BattingResonance';
import type { BattingResonanceInput,
  BattingResonanceStimulus } from '../../team/BattingResonance';
import { restoreEmotionState } from '../EmotionState';
import type { EmotionResult } from '../EmotionTypes';
import { attempt, fail, fraction, obj, text } from '../EmotionValidation';
import { evaluateAppraisedEmotion } from './AppraisalGate';
import type { AppliedAppraisal, AppraisalInput } from './AppraisalTypes';
import { readAppraisalInput } from './AppraisalValidation';

export type BattingResonanceCuePolicy = Readonly<{
  policyId: string;
  version: string;
  adjacentCue: number;
  otherLineupCue: number;
}>;
export type AppliedBattingResonance = Readonly<{
  stimulus: BattingResonanceStimulus;
  cuePolicy: BattingResonanceCuePolicy;
  applied: AppliedAppraisal;
}>;

const readCuePolicy = (input: unknown): BattingResonanceCuePolicy => {
  const source = obj(input, ['policyId', 'version',
    'adjacentCue', 'otherLineupCue'], 'battingResonance.cuePolicy');
  const adjacentCue = fraction(source.adjacentCue,
    'battingResonance.cuePolicy.adjacentCue');
  const otherLineupCue = fraction(source.otherLineupCue,
    'battingResonance.cuePolicy.otherLineupCue');
  if (otherLineupCue <= 0 || adjacentCue < otherLineupCue) {
    fail('INVALID_INPUT', 'battingResonance.cuePolicy.strength');
  }
  return { policyId: text(source.policyId,
    'battingResonance.cuePolicy.policyId'),
  version: text(source.version,
    'battingResonance.cuePolicy.version'),
  adjacentCue, otherLineupCue };
};

/**
 * Converts a relationship-derived positive cue into the existing appraisal
 * situation axis. The pinned appraisal model and Emotion gate still decide
 * whether MOTIVATION becomes active and what behavioral effect it has.
 */
export const evaluateBattingResonanceEmotion = (
  emotionState: unknown,
  appraisalInput: unknown,
  resonanceInput: BattingResonanceInput,
  cuePolicyInput: unknown,
): EmotionResult<AppliedBattingResonance | null> => attempt(() => {
  const cuePolicy = readCuePolicy(cuePolicyInput);
  let stimulus: BattingResonanceStimulus | null;
  try {
    stimulus = evaluateBattingResonance(resonanceInput);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    fail('INVALID_INPUT', 'battingResonance.source');
  }
  if (stimulus === null) return null;
  const input = readAppraisalInput(appraisalInput);
  const scope = input.importance.scope;
  if (scope.careerId !== stimulus.careerId
    || scope.matchId !== stimulus.gameId
    || scope.playerId !== stimulus.receiverPlayerId
    || input.importance.clubId !== stimulus.teamId
    || input.event.eventId !== stimulus.sourceEventId) {
    fail('SCOPE_MISMATCH', 'battingResonance.appraisalSource');
  }
  const restored = restoreEmotionState(emotionState);
  if (!restored.ok) fail(restored.reason.code, restored.reason.path);
  if (restored.value.lastAppraisal?.evidenceEventIds
    .includes(stimulus.sourceEventId)) {
    fail('DUPLICATE_APPRAISAL', 'battingResonance.sourceEventId');
  }
  const cue = stimulus.proximity === 'ADJACENT'
    ? cuePolicy.adjacentCue : cuePolicy.otherLineupCue;
  const adapted: AppraisalInput = {
    ...input,
    bundleId: JSON.stringify(['batting-resonance-appraisal-v1',
      input.bundleId, stimulus.sourceEventId, stimulus.channel,
      stimulus.policyId, stimulus.policyVersion,
      resonanceInput.policy.minAffinity,
      resonanceInput.policy.minTrust,
      resonanceInput.policy.minSharedSuccessMemory,
      resonanceInput.policy.minChannelStrength,
      resonanceInput.network.revision,
      cuePolicy.policyId, cuePolicy.version,
      cuePolicy.adjacentCue, cuePolicy.otherLineupCue]),
    event: { ...input.event,
      recentSuccess: Math.max(input.event.recentSuccess, cue) },
  };
  const applied = evaluateAppraisedEmotion(restored.value, adapted);
  if (!applied.ok) fail(applied.reason.code, applied.reason.path);
  return { stimulus, cuePolicy, applied: applied.value };
});
