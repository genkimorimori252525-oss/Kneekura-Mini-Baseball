import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { buildPlayerPerceivedWorldState, type PlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import type { RunnerDecisionInput } from './RunnerDecision';

export type RunnerPartialTagUpWaitContext = Readonly<{
  currentBase: 1 | 2 | 3; nextBase: 2 | 3 | 4;
  tagUp: Readonly<{ kind: 'awaiting_first_touch' }>;
  forceKnowledge: Readonly<{ status: 'unavailable'; reason: 'fair_foul_unresolved' }>;
}>;
export type RunnerPartialTagUpWaitInput = Readonly<{
  version: 'runner_partial_tag_up_wait_v1'; runnerId: string;
  perceivedWorld: PlayerPerceivedWorldState<RunnerPartialTagUpWaitContext>;
  cueKnowledge: Readonly<{ status: 'unavailable'; reason: 'producer_not_connected' }>;
}> & Pick<RunnerDecisionInput, 'minimumCueConfidence' | 'coachTrust' | 'minimumAdvanceSafetyMarginTicks'
  | 'decisionAbility' | 'timingParameters'>;

const fields = (value: unknown, keys: readonly string[]): boolean => value !== null && typeof value === 'object'
  && !Array.isArray(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const tick = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Calculation input only. Its justified perception remains the Native producer's responsibility. */
export const runnerPartialTagUpWaitInput = (raw: RunnerPartialTagUpWaitInput): RunnerPartialTagUpWaitInput => {
  const input = cloneInert(raw);
  if (!fields(input, ['version', 'runnerId', 'perceivedWorld', 'cueKnowledge', 'minimumCueConfidence', 'coachTrust',
    'minimumAdvanceSafetyMarginTicks', 'decisionAbility', 'timingParameters']) || input.version !== 'runner_partial_tag_up_wait_v1'
    || !id(input.runnerId) || !fields(input.cueKnowledge, ['status', 'reason'])
    || input.cueKnowledge.status !== 'unavailable' || input.cueKnowledge.reason !== 'producer_not_connected'
    || !fields(input.timingParameters, ['minimumDecisionDelayTicks', 'maximumDecisionDelayTicks', 'fixedRecognitionOffsetTicks'])) {
    throw new Error('invalid partial tag-up wait input');
  }
  const world = input.perceivedWorld;
  if (!fields(world, ['observerId', 'observationTime', 'attention', 'ball', 'players', 'communications', 'knownContext'])
    || world.observerId !== input.runnerId || !tick(world.observationTime)
    || !fields(world.attention, ['target', 'focusedSinceTick']) || !tick(world.attention.focusedSinceTick)
    || world.attention.focusedSinceTick > world.observationTime || !Array.isArray(world.players) || !Array.isArray(world.communications)) {
    throw new Error('invalid partial tag-up wait perception or availability');
  }
  const context = world.knownContext;
  if (!fields(context, ['currentBase', 'nextBase', 'tagUp', 'forceKnowledge'])
    || !Number.isSafeInteger(context.currentBase) || context.currentBase < 1 || context.currentBase > 3
    || context.nextBase !== context.currentBase + 1 || !fields(context.tagUp, ['kind'])
    || context.tagUp.kind !== 'awaiting_first_touch' || !fields(context.forceKnowledge, ['status', 'reason'])
    || context.forceKnowledge.status !== 'unavailable' || context.forceKnowledge.reason !== 'fair_foul_unresolved') {
    throw new Error('partial tag-up wait cannot enter a lower-priority decision');
  }
  // Reuse the existing prediction/communication availability boundary without
  // turning future received content into a normalized successful partial input.
  const available = buildPlayerPerceivedWorldState(world);
  if (available.communications.length !== world.communications.length) {
    throw new Error('partial tag-up wait contains unavailable communication');
  }
  return input;
};
