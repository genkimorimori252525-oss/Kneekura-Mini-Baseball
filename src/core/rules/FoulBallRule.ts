import type { FlyCatchRuleResult } from './FlyCatchRule';
import {
  resolvePitchCountRule,
  type PitchCountRuleResult,
  type PitchCountState,
} from './PitchCountRule';

export type FoulBallTerritory = 'fair' | 'foul';

export type FoulBallRuleInput = Readonly<{
  territory: FoulBallTerritory;
  buntAttempt: boolean;
  count: PitchCountState;
  flyCatch: FlyCatchRuleResult;
}>;

export type FoulBallRuleResult =
  | Readonly<{
    kind: 'not_foul';
  }>
  | Readonly<{
    kind: 'caught_foul_fly';
    batterRunnerId: string;
    outTick: number;
    ballRemainsLive: true;
    runnerState: 'tag_up_required_if_advancing';
  }>
  | Readonly<{
    kind: 'uncaught_foul';
    ballDead: true;
    countResult: PitchCountRuleResult;
  }>
  | Readonly<{
    kind: 'unresolved_foul_fly';
    batterRunnerId: string;
    firstFielderTouchTick: number;
  }>;

export const resolveFoulBallRule = (
  input: FoulBallRuleInput,
): FoulBallRuleResult => {
  if (input.territory === 'fair') {
    return {
      kind: 'not_foul',
    };
  }

  if (input.flyCatch.kind === 'unresolved') {
    return {
      kind: 'unresolved_foul_fly',
      batterRunnerId: input.flyCatch.batterRunnerId,
      firstFielderTouchTick:
        input.flyCatch.firstFielderTouchTick,
    };
  }

  if (input.flyCatch.kind === 'caught') {
    return {
      kind: 'caught_foul_fly',
      batterRunnerId: input.flyCatch.batterRunnerId,
      outTick: input.flyCatch.outTick,
      ballRemainsLive: true,
      runnerState: 'tag_up_required_if_advancing',
    };
  }

  return {
    kind: 'uncaught_foul',
    ballDead: true,
    countResult: resolvePitchCountRule(
      input.count,
      {
        kind: input.buntAttempt
          ? 'foul_bunt'
          : 'foul',
      },
    ),
  };
};
