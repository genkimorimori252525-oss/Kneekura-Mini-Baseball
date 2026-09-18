import type {
  FlyBallFirstFielderTouchFact,
} from './PhysicalRuleFacts';

export type FlyCatchRuleInput = Readonly<{
  batterRunnerId: string;
  firstTouch: FlyBallFirstFielderTouchFact;
  secureCatchTick: number | null;
  firstGroundContactTick: number | null;
}>;

export type FlyCatchRuleResult =
  | Readonly<{
    kind: 'caught';
    batterRunnerId: string;
    firstFielderTouchTick: number;
    outTick: number;
    secureCatchTick: number;
  }>
  | Readonly<{
    kind: 'not_caught';
    batterRunnerId: string;
    firstFielderTouchTick: number;
    firstGroundContactTick: number;
    secureCatchTick: number;
  }>
  | Readonly<{
    kind: 'unresolved';
    batterRunnerId: string;
    firstFielderTouchTick: number;
  }>;

const validateOptionalTick = (
  name: string,
  tick: number | null,
): void => {
  if (
    tick !== null
    && (!Number.isSafeInteger(tick) || tick < 0)
  ) {
    throw new Error(`${name} must be null or a non-negative safe integer tick`);
  }
};

export const resolveFlyCatch = (
  input: FlyCatchRuleInput,
): FlyCatchRuleResult => {
  if (input.batterRunnerId.length === 0) {
    throw new Error('batterRunnerId must not be empty');
  }
  validateOptionalTick('secureCatchTick', input.secureCatchTick);
  validateOptionalTick(
    'firstGroundContactTick',
    input.firstGroundContactTick,
  );

  if (
    input.secureCatchTick !== null
    && input.secureCatchTick < input.firstTouch.tick
  ) {
    throw new Error(
      'secureCatchTick must be at or after first fielder touch',
    );
  }

  if (input.secureCatchTick === null) {
    return {
      kind: 'unresolved',
      batterRunnerId: input.batterRunnerId,
      firstFielderTouchTick: input.firstTouch.tick,
    };
  }

  if (
    input.firstGroundContactTick !== null
    && input.firstGroundContactTick <= input.secureCatchTick
  ) {
    return {
      kind: 'not_caught',
      batterRunnerId: input.batterRunnerId,
      firstFielderTouchTick: input.firstTouch.tick,
      firstGroundContactTick: input.firstGroundContactTick,
      secureCatchTick: input.secureCatchTick,
    };
  }

  return {
    kind: 'caught',
    batterRunnerId: input.batterRunnerId,
    firstFielderTouchTick: input.firstTouch.tick,
    outTick: input.secureCatchTick,
    secureCatchTick: input.secureCatchTick,
  };
};
