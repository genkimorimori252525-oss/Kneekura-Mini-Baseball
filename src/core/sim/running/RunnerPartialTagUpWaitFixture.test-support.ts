import { expect } from 'vitest';
import type { RunnerPartialTagUpWaitInput, RunnerPartialTagUpWaitModule } from './RunnerPartialTagUpWaitContracts.test-support';

/** Core test DTO only. These are the existing P6 synthetic parameters, not Native perception/calibration proof. */
export const corePartialWaitInput = (observationTime = 2_000_000): RunnerPartialTagUpWaitInput => ({
  version: 'runner_partial_tag_up_wait_v1', runnerId: 'runner',
  perceivedWorld: { observerId: 'runner', observationTime,
    attention: { target: { kind: 'ball' }, focusedSinceTick: observationTime - 100_000 },
    ball: null, players: [], communications: [],
    knownContext: { currentBase: 1, nextBase: 2, tagUp: { kind: 'awaiting_first_touch' },
      forceKnowledge: { status: 'unavailable', reason: 'fair_foul_unresolved' } } },
  cueKnowledge: { status: 'unavailable', reason: 'producer_not_connected' },
  minimumCueConfidence: 0.5, coachTrust: 1, minimumAdvanceSafetyMarginTicks: 50_000, decisionAbility: 0.8,
  timingParameters: { minimumDecisionDelayTicks: 30_000, maximumDecisionDelayTicks: 180_000, fixedRecognitionOffsetTicks: 10_000 },
});
export const requireCorePartialWait = (module: unknown): RunnerPartialTagUpWaitModule['decideRunnerMotionIntentFromPartialContext'] => {
  const choose = (module as Partial<RunnerPartialTagUpWaitModule>).decideRunnerMotionIntentFromPartialContext;
  expect(choose, 'missing versioned partial tag-up wait entry after valid Core contract prerequisites').toBeTypeOf('function');
  return choose!;
};
