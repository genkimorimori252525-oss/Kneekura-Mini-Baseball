import type {
  PlayerPerceivedWorldState,
} from '../perception/PlayerPerceivedWorldState';
import type {
  ReceivedCommunication,
} from '../perception/Communication';
import type {
  RunnerMotionIntent,
} from './RunnerMotion';
import {
  resolveRunnerDecisionTiming,
  type RunnerDecisionTimingParameters,
} from './RunnerDecisionTiming';
import { runnerPartialTagUpWaitInput, type RunnerPartialTagUpWaitInput } from './RunnerPartialTagUpWaitInput';
export type { RunnerPartialTagUpWaitContext, RunnerPartialTagUpWaitInput } from './RunnerPartialTagUpWaitInput';

export type RunnerKnownContext = Readonly<{
  currentBase: 1 | 2 | 3;
  nextBase: 2 | 3 | 4;
  forcedToAdvance: boolean;
  tagUp:
    | Readonly<{ kind: 'none' }>
    | Readonly<{
        kind: 'must_retouch';
        originBase: 1 | 2 | 3;
      }>
    | Readonly<{
        kind: 'awaiting_first_touch';
      }>;
}>;

type RunnerPerceivedCueBase = Readonly<{
  observedAt: number;
  confidence: number;
}>;

export type RunnerPerceivedCue =
  | (RunnerPerceivedCueBase & Readonly<{
      kind: 'next_base_race';
      runnerArrivalTick: number;
      defenderControlTick: number | null;
    }>)
  | (RunnerPerceivedCueBase & Readonly<{
      kind: 'current_base_threat';
      runnerReturnTick: number;
      defenderTagTick: number;
    }>);

export type RunnerCoachInstructionContent = Readonly<{
  kind: 'runner_action';
  action: RunnerMotionIntent['kind'];
}>;

export type RunnerDecisionInput = Readonly<{
  runnerId: string;
  perceivedWorld:
    PlayerPerceivedWorldState<RunnerKnownContext>;
  perceivedCues: readonly RunnerPerceivedCue[];
  minimumCueConfidence: number;
  coachTrust: number;
  minimumAdvanceSafetyMarginTicks: number;
  decisionAbility: number;
  timingParameters: RunnerDecisionTimingParameters;
}>;

export type RunnerDecisionReason =
  | 'tag_up_retouch'
  | 'tag_up_wait'
  | 'current_base_threat'
  | 'forced_advance'
  | 'coach_instruction'
  | 'next_base_race'
  | 'no_actionable_evidence';

export type RunnerMotionDecision = Readonly<{
  motionIntent: RunnerMotionIntent;
  reason: RunnerDecisionReason;
  evidenceAvailableAt: number;
  decisionTick: number;
  perceivedRaceMarginTicks: number | null;
}>;

type ChosenAction = Readonly<{
  kind: RunnerMotionIntent['kind'];
  reason: RunnerDecisionReason;
  evidenceAvailableAt: number;
  perceivedRaceMarginTicks: number | null;
}>;

const validateUnit = (
  name: string,
  value: number,
): void => {
  if (
    !Number.isFinite(value)
    || value < 0
    || value > 1
  ) {
    throw new Error(
      `${name} must be finite and within [0, 1]`,
    );
  }
};

const validateTick = (
  name: string,
  tick: number,
): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer tick`,
    );
  }
};

const validateContext = (
  context: RunnerKnownContext,
): void => {
  if (context.nextBase !== context.currentBase + 1) {
    throw new Error(
      'runner nextBase must immediately follow currentBase',
    );
  }

  if (
    context.tagUp.kind === 'must_retouch'
    && context.tagUp.originBase !== context.currentBase
  ) {
    throw new Error(
      'tag-up originBase must match runner currentBase',
    );
  }

};

const validateCue = (
  cue: RunnerPerceivedCue,
  observationTime: number,
): void => {
  validateTick('cue.observedAt', cue.observedAt);
  validateUnit('cue.confidence', cue.confidence);
  if (cue.observedAt > observationTime) {
    throw new Error(
      'runner perceived cue cannot occur after observationTime',
    );
  }

  if (cue.kind === 'next_base_race') {
    validateTick(
      'cue.runnerArrivalTick',
      cue.runnerArrivalTick,
    );
    if (cue.defenderControlTick !== null) {
      validateTick(
        'cue.defenderControlTick',
        cue.defenderControlTick,
      );
    }
    return;
  }

  validateTick(
    'cue.runnerReturnTick',
    cue.runnerReturnTick,
  );
  validateTick(
    'cue.defenderTagTick',
    cue.defenderTagTick,
  );
};

const communicationTargetsRunner = (
  communication: ReceivedCommunication,
  runnerId: string,
): boolean => {
  const scope = communication.event.targetScope;
  return (
    scope.kind !== 'player'
    || scope.playerId === runnerId
  );
};

const parseCoachInstruction = (
  communication: ReceivedCommunication,
): RunnerCoachInstructionContent | null => {
  if (communication.event.kind !== 'coach_signal') {
    return null;
  }

  const value = communication.event.content;
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as {
    kind?: unknown;
    action?: unknown;
  };

  if (record.kind !== 'runner_action') {
    return null;
  }
  if (
    record.action !== 'advance'
    && record.action !== 'retreat'
    && record.action !== 'hold'
    && record.action !== 'slide'
  ) {
    return null;
  }

  return {
    kind: 'runner_action',
    action: record.action,
  };
};

const bestCoachInstruction = (
  input: RunnerDecisionInput,
): Readonly<{
  action: RunnerMotionIntent['kind'];
  evidenceAvailableAt: number;
  effectiveConfidence: number;
  sourceId: string;
}> | null => {
  const available = input.perceivedWorld.communications
    .flatMap((communication) => {
      if (
        communication.receivedAt
        > input.perceivedWorld.observationTime
        || !communicationTargetsRunner(
          communication,
          input.runnerId,
        )
      ) {
        return [];
      }

      validateUnit(
        'communication.confidence',
        communication.confidence,
      );
      const instruction =
        parseCoachInstruction(communication);
      if (instruction === null) {
        return [];
      }

      const effectiveConfidence = (
        communication.confidence
        * input.coachTrust
      );
      if (
        effectiveConfidence
        < input.minimumCueConfidence
      ) {
        return [];
      }

      return [{
        action: instruction.action,
        evidenceAvailableAt:
          communication.receivedAt,
        effectiveConfidence,
        sourceId: communication.event.sourceId,
      }];
    })
    .sort((first, second) => (
      second.effectiveConfidence
        - first.effectiveConfidence
      || second.evidenceAvailableAt
        - first.evidenceAvailableAt
      || first.sourceId.localeCompare(
        second.sourceId,
      )
    ));

  return available[0] ?? null;
};

const bestCue = <TKind extends RunnerPerceivedCue['kind']>(
  cues: readonly RunnerPerceivedCue[],
  kind: TKind,
  minimumConfidence: number,
): Extract<RunnerPerceivedCue, { kind: TKind }> | null => {
  const matching = cues
    .filter(
      (
        cue,
      ): cue is Extract<
        RunnerPerceivedCue,
        { kind: TKind }
      > => (
        cue.kind === kind
        && cue.confidence >= minimumConfidence
      ),
    )
    .sort((first, second) => (
      second.confidence - first.confidence
      || second.observedAt - first.observedAt
    ));

  return matching[0] ?? null;
};

const chooseTagUpPriorityAction = (
  context: Pick<RunnerKnownContext, 'tagUp'>,
  observationTime: number,
): ChosenAction | null => {
  if (context.tagUp.kind === 'must_retouch') {
    return {
      kind: 'retreat',
      reason: 'tag_up_retouch',
      evidenceAvailableAt: observationTime,
      perceivedRaceMarginTicks: null,
    };
  }

  if (context.tagUp.kind === 'awaiting_first_touch') {
    return {
      kind: 'hold',
      reason: 'tag_up_wait',
      evidenceAvailableAt: observationTime,
      perceivedRaceMarginTicks: null,
    };
  }

  return null;
};

const chooseRunnerAction = (
  input: RunnerDecisionInput,
): ChosenAction => {
  const context = input.perceivedWorld.knownContext;
  const observationTime =
    input.perceivedWorld.observationTime;
  const tagUp = chooseTagUpPriorityAction(context, observationTime);
  if (tagUp !== null) return tagUp;

  const currentBaseThreat = bestCue(
    input.perceivedCues,
    'current_base_threat',
    input.minimumCueConfidence,
  );
  if (currentBaseThreat !== null) {
    return {
      kind: 'retreat',
      reason: 'current_base_threat',
      evidenceAvailableAt:
        currentBaseThreat.observedAt,
      perceivedRaceMarginTicks: (
        currentBaseThreat.defenderTagTick
        - currentBaseThreat.runnerReturnTick
      ),
    };
  }

  if (context.forcedToAdvance) {
    return {
      kind: 'advance',
      reason: 'forced_advance',
      evidenceAvailableAt: observationTime,
      perceivedRaceMarginTicks: null,
    };
  }

  const coach = bestCoachInstruction(input);
  if (coach !== null) {
    return {
      kind: coach.action,
      reason: 'coach_instruction',
      evidenceAvailableAt:
        coach.evidenceAvailableAt,
      perceivedRaceMarginTicks: null,
    };
  }

  const nextBaseRace = bestCue(
    input.perceivedCues,
    'next_base_race',
    input.minimumCueConfidence,
  );
  if (nextBaseRace !== null) {
    if (nextBaseRace.defenderControlTick === null) {
      return {
        kind: 'advance',
        reason: 'next_base_race',
        evidenceAvailableAt:
          nextBaseRace.observedAt,
        perceivedRaceMarginTicks: null,
      };
    }

    const margin = (
      nextBaseRace.defenderControlTick
      - nextBaseRace.runnerArrivalTick
    );

    return {
      kind: (
        margin
          >= input.minimumAdvanceSafetyMarginTicks
          ? 'advance'
          : 'hold'
      ),
      reason: 'next_base_race',
      evidenceAvailableAt:
        nextBaseRace.observedAt,
      perceivedRaceMarginTicks: margin,
    };
  }

  return {
    kind: 'hold',
    reason: 'no_actionable_evidence',
    evidenceAvailableAt: observationTime,
    perceivedRaceMarginTicks: null,
  };
};

type RunnerDecisionParameters = Pick<RunnerDecisionInput, 'runnerId' | 'minimumCueConfidence' | 'coachTrust'
  | 'minimumAdvanceSafetyMarginTicks' | 'decisionAbility' | 'timingParameters'> & Readonly<{
    perceivedWorld: Pick<RunnerDecisionInput['perceivedWorld'], 'observerId' | 'observationTime'>;
  }>;
const validateRunnerDecisionParameters = (
  input: RunnerDecisionParameters,
): void => {
  if (input.runnerId.length === 0) {
    throw new Error(
      'runnerId must not be empty',
    );
  }
  if (
    input.perceivedWorld.observerId
    !== input.runnerId
  ) {
    throw new Error(
      'runner decision observer must match runnerId',
    );
  }

  validateTick(
    'observationTime',
    input.perceivedWorld.observationTime,
  );
  validateUnit(
    'minimumCueConfidence',
    input.minimumCueConfidence,
  );
  validateUnit(
    'coachTrust',
    input.coachTrust,
  );
  validateUnit(
    'decisionAbility',
    input.decisionAbility,
  );
  if (
    !Number.isSafeInteger(
      input.minimumAdvanceSafetyMarginTicks,
    )
    || input.minimumAdvanceSafetyMarginTicks < 0
  ) {
    throw new Error(
      'minimumAdvanceSafetyMarginTicks must be a non-negative safe integer tick',
    );
  }

};

const finishRunnerDecision = (
  chosen: ChosenAction,
  input: Pick<RunnerDecisionInput, 'decisionAbility' | 'timingParameters'>,
): RunnerMotionDecision => {
  const timing = resolveRunnerDecisionTiming(
    chosen.evidenceAvailableAt,
    input.decisionAbility,
    input.timingParameters,
  );

  return {
    motionIntent: {
      kind: chosen.kind,
      issuedTick: timing.decisionTick,
    },
    reason: chosen.reason,
    evidenceAvailableAt:
      chosen.evidenceAvailableAt,
    decisionTick: timing.decisionTick,
    perceivedRaceMarginTicks:
      chosen.perceivedRaceMarginTicks,
  };
};

export const decideRunnerMotionIntent = (
  input: RunnerDecisionInput,
): RunnerMotionDecision => {
  validateRunnerDecisionParameters(input);
  validateContext(
    input.perceivedWorld.knownContext,
  );
  for (const cue of input.perceivedCues) {
    validateCue(
      cue,
      input.perceivedWorld.observationTime,
    );
  }
  return finishRunnerDecision(chooseRunnerAction(input), input);
};

/** Only justified tag-up waiting is actionable here. Unknown force/cues are
 * retained as unknown and never converted into legacy booleans or empty scans. */
export const decideRunnerMotionIntentFromPartialContext = (
  raw: RunnerPartialTagUpWaitInput,
): RunnerMotionDecision => {
  const input = runnerPartialTagUpWaitInput(raw);
  validateRunnerDecisionParameters(input);
  const chosen = chooseTagUpPriorityAction(input.perceivedWorld.knownContext, input.perceivedWorld.observationTime);
  if (chosen === null || chosen.reason !== 'tag_up_wait') throw new Error('unsupported partial runner decision');
  return finishRunnerDecision(chosen, input);
};
