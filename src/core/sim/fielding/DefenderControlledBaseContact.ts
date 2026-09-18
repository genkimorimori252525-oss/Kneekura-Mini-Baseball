import type { BaseTouchRegion } from '../running/BaseTouch';
import type {
  SecuredCatchOutcome,
} from './CatchOutcome';
import {
  findDefenderFootBaseContactTick,
} from './DefenderBaseContact';
import type {
  DefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';
export type DefenderControlledBaseContactInput = Readonly<{
  baseRegion: BaseTouchRegion;
  baseSurfaceHeightMeters: number;
  securedCatch: SecuredCatchOutcome;
  controlThroughTick: number;
  contactPrimitives: readonly DefenderPhysicalPrimitiveSegment[];
}>;

const validateTick = (
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer tick`,
    );
  }
};

export const findDefenderControlledBaseContactTick = (
  input: DefenderControlledBaseContactInput,
): number | null => {
  validateTick(
    'glove contact tick',
    input.securedCatch.gloveContactTick,
  );
  validateTick(
    'secure possession tick',
    input.securedCatch.secureTick,
  );
  if (
    input.securedCatch.secureTick
    < input.securedCatch.gloveContactTick
  ) {
    throw new Error(
      'secure possession tick must be at or after glove contact tick',
    );
  }

  validateTick(
    'controlThroughTick',
    input.controlThroughTick,
  );
  if (
    input.controlThroughTick
    < input.securedCatch.secureTick
  ) {
    throw new Error(
      'controlThroughTick must be at or after secure possession tick',
    );
  }

  let earliestTick: number | null = null;

  for (const primitive of input.contactPrimitives) {
    if (
      primitive.role !== 'left_foot'
      && primitive.role !== 'right_foot'
    ) {
      continue;
    }

    const searchStartTick = Math.max(
      input.securedCatch.secureTick,
      primitive.startTick,
    );
    const searchEndTick = Math.min(
      input.controlThroughTick,
      primitive.endTick,
    );
    if (searchEndTick < searchStartTick) {
      continue;
    }

    const contactTick = findDefenderFootBaseContactTick(
      primitive,
      input.baseRegion,
      input.baseSurfaceHeightMeters,
      searchStartTick,
      searchEndTick,
    );
    if (
      contactTick !== null
      && (
        earliestTick === null
        || contactTick < earliestTick
      )
    ) {
      earliestTick = contactTick;
    }
  }

  return earliestTick;
};
