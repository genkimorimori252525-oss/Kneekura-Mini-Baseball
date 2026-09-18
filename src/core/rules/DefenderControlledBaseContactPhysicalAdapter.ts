import type { CatchOutcome } from '../sim/fielding/CatchOutcome';
import {
  findDefenderControlledBaseContactTick,
  type DefenderControlledBaseContactInput,
} from '../sim/fielding/DefenderControlledBaseContact';
import {
  createControlledBaseContactFact,
  type BaseballBase,
  type ControlledBaseContactFact,
} from './PhysicalRuleFacts';

export type DefenderControlledBaseContactPhysicalAdapterInput =
  DefenderControlledBaseContactInput
  & Readonly<{
    defenderId: string;
    base: BaseballBase;
  }>;

export const createControlledBaseContactFactFromDefenderPhysics = (
  input: DefenderControlledBaseContactPhysicalAdapterInput,
): ControlledBaseContactFact | null => {
  if (input.defenderId.length === 0) {
    throw new Error('defenderId must not be empty');
  }

  const tick = findDefenderControlledBaseContactTick(input);
  return tick === null
    ? null
    : createControlledBaseContactFact(
        input.defenderId,
        input.base,
        tick,
      );
};


export type DefenderControlledBaseContactFromCatchOutcomeInput =
  Omit<
    DefenderControlledBaseContactPhysicalAdapterInput,
    'securedCatch'
  >
  & Readonly<{
    catchOutcome: CatchOutcome;
  }>;

export const createControlledBaseContactFactFromCatchOutcomePhysics = (
  input: DefenderControlledBaseContactFromCatchOutcomeInput,
): ControlledBaseContactFact | null => {
  if (input.catchOutcome.kind !== 'secured') {
    return null;
  }

  return createControlledBaseContactFactFromDefenderPhysics({
    defenderId: input.defenderId,
    base: input.base,
    baseRegion: input.baseRegion,
    baseSurfaceHeightMeters: input.baseSurfaceHeightMeters,
    securedCatch: input.catchOutcome,
    controlThroughTick: input.controlThroughTick,
    contactPrimitives: input.contactPrimitives,
  });
};
