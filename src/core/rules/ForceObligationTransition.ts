import {
  retireForceParticipant,
  satisfyForceParticipantObligation,
  type ForceObligationState,
} from './ForceObligation';
import type { ForceOutRuleResult } from './ForceOutRule';

export const applyForceOutRuleResultToState = (
  state: ForceObligationState,
  result: ForceOutRuleResult,
): ForceObligationState => {
  if (result.kind === 'out') {
    return retireForceParticipant(state, result.runnerId);
  }
  if (result.kind === 'safe') {
    return satisfyForceParticipantObligation(state, result.runnerId);
  }
  return state;
};
