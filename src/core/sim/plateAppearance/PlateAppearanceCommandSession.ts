import type {
  CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';
import type {
  PlateAppearanceCommand,
} from './PlateAppearanceCommand';

export type PlateAppearanceCommandSession = Readonly<{
  playId: number;
  batterRunnerId: string;
  acceptedAtTick: number;
  matchSeed: number;
  command: PlateAppearanceCommand;
}>;

export type CreatePlateAppearanceCommandSessionInput =
  PlateAppearanceCommandSession;

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

export const createPlateAppearanceCommandSession = (
  input: CreatePlateAppearanceCommandSessionInput,
): PlateAppearanceCommandSession => {
  if (
    !Number.isSafeInteger(input.playId)
    || input.playId < 0
  ) {
    throw new Error(
      'playId must be a non-negative safe integer',
    );
  }
  if (input.batterRunnerId.length === 0) {
    throw new Error(
      'batterRunnerId must not be empty',
    );
  }
  validateTick(
    'acceptedAtTick',
    input.acceptedAtTick,
  );
  if (!Number.isSafeInteger(input.matchSeed)) {
    throw new Error(
      'matchSeed must be a safe integer',
    );
  }

  return {
    playId: input.playId,
    batterRunnerId: input.batterRunnerId,
    acceptedAtTick: input.acceptedAtTick,
    matchSeed: input.matchSeed,
    command: input.command,
  };
};

export const assertCommandSessionCanDriveTimeline = (
  session: PlateAppearanceCommandSession,
  timeline: CanonicalPlateAppearanceTimeline,
): void => {
  if (session.playId !== timeline.playId) {
    throw new Error(
      'command session playId must match the canonical plate appearance',
    );
  }
  if (session.acceptedAtTick > timeline.lastEventTick) {
    throw new Error(
      'command session acceptance tick must not be after the current timeline',
    );
  }
  if (timeline.status.kind !== 'active') {
    throw new Error(
      'command session cannot generate another pitch after the plate appearance stopped accepting pitches',
    );
  }
};
