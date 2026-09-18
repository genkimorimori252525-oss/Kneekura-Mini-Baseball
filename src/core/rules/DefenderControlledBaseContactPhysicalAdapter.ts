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
