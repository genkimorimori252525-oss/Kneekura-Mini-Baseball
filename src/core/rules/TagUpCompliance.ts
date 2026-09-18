import type {
  BaseballBase,
  FlyBallFirstFielderTouchFact,
  RunnerBaseDepartureFact,
  RunnerBaseTouchFact,
} from './PhysicalRuleFacts';

export type TagUpComplianceInput = Readonly<{
  runnerId: string;
  originBase: BaseballBase;
  firstTouch: FlyBallFirstFielderTouchFact;
  departure: RunnerBaseDepartureFact;
  retouch: RunnerBaseTouchFact | null;
}>;

export type TagUpComplianceResult =
  | Readonly<{
    kind: 'compliant';
    runnerId: string;
    originBase: BaseballBase;
    basis: 'departed_at_or_after_first_touch';
    firstFielderTouchTick: number;
    departureTick: number;
    legalAdvanceFromTick: number;
  }>
  | Readonly<{
    kind: 'compliant';
    runnerId: string;
    originBase: BaseballBase;
    basis: 'retouched_after_first_touch';
    firstFielderTouchTick: number;
    departureTick: number;
    retouchTick: number;
    legalAdvanceFromTick: number;
  }>
  | Readonly<{
    kind: 'appealable_early_departure';
    runnerId: string;
    originBase: BaseballBase;
    firstFielderTouchTick: number;
    departureTick: number;
    retouchTick: number | null;
  }>;

export const evaluateTagUpCompliance = (
  input: TagUpComplianceInput,
): TagUpComplianceResult => {
  if (input.departure.runnerId !== input.runnerId) {
    throw new Error('departure must belong to the evaluated runner');
  }
  if (input.departure.base !== input.originBase) {
    throw new Error('departure must belong to the origin base');
  }

  if (input.retouch !== null) {
    if (input.retouch.runnerId !== input.runnerId) {
      throw new Error('retouch must belong to the evaluated runner');
    }
    if (input.retouch.base !== input.originBase) {
      throw new Error('retouch must belong to the origin base');
    }
    if (input.retouch.tick < input.departure.tick) {
      throw new Error('retouch cannot precede departure');
    }
  }

  if (input.departure.tick >= input.firstTouch.tick) {
    return {
      kind: 'compliant',
      runnerId: input.runnerId,
      originBase: input.originBase,
      basis: 'departed_at_or_after_first_touch',
      firstFielderTouchTick: input.firstTouch.tick,
      departureTick: input.departure.tick,
      legalAdvanceFromTick: input.departure.tick,
    };
  }

  if (
    input.retouch !== null
    && input.retouch.tick >= input.firstTouch.tick
  ) {
    return {
      kind: 'compliant',
      runnerId: input.runnerId,
      originBase: input.originBase,
      basis: 'retouched_after_first_touch',
      firstFielderTouchTick: input.firstTouch.tick,
      departureTick: input.departure.tick,
      retouchTick: input.retouch.tick,
      legalAdvanceFromTick: input.retouch.tick,
    };
  }

  return {
    kind: 'appealable_early_departure',
    runnerId: input.runnerId,
    originBase: input.originBase,
    firstFielderTouchTick: input.firstTouch.tick,
    departureTick: input.departure.tick,
    retouchTick: input.retouch?.tick ?? null,
  };
};
