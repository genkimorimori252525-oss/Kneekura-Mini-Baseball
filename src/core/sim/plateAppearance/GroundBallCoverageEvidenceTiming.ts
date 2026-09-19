import type {
  TeamCoveragePlan,
} from '../fielding/TeamCoveragePlan';

export type GroundBallCoverageEvidenceTimingInput = Readonly<{
  coverage: TeamCoveragePlan;
  handlerId: string;
  receiverId: string;
  pickupContactTick: number;
  throwReadyTick: number;
}>;

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

/**
 * Coverage decisions may depend on perceived evidence, but that evidence must already
 * exist before the corresponding physical action. This prevents future observations
 * from selecting a ball handler or first-base receiver retroactively.
 */
export const assertGroundBallCoverageEvidenceTiming = (
  input: GroundBallCoverageEvidenceTimingInput,
): void => {
  validateTick(
    'pickupContactTick',
    input.pickupContactTick,
  );
  validateTick(
    'throwReadyTick',
    input.throwReadyTick,
  );
  if (input.throwReadyTick < input.pickupContactTick) {
    throw new Error(
      'throwReadyTick must not precede physical pickup contact',
    );
  }

  const handler = input.coverage.assignments.find(
    (assignment) => (
      assignment.playerId === input.handlerId
      && assignment.intent.kind === 'ball_handler'
    ),
  );
  if (handler === undefined) {
    throw new Error(
      'coverage evidence timing requires the selected ball-handler assignment',
    );
  }
  if (handler.evidenceAvailableAt > input.pickupContactTick) {
    throw new Error(
      'ball-handler coverage evidence must exist before physical pickup contact',
    );
  }

  const receiver = input.coverage.assignments.find(
    (assignment) => (
      assignment.playerId === input.receiverId
      && assignment.intent.kind === 'base_cover'
      && assignment.intent.base === 1
    ),
  );
  if (receiver === undefined) {
    throw new Error(
      'coverage evidence timing requires the selected first-base cover assignment',
    );
  }
  if (receiver.evidenceAvailableAt > input.throwReadyTick) {
    throw new Error(
      'first-base cover evidence must exist before the derived throw-ready tick',
    );
  }
};