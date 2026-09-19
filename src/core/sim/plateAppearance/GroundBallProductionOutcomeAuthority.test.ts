import { describe, expect, it } from 'vitest';
import type {
  CanonicalGroundBallFirstBaseOutcomeInput,
} from './GroundBallProductionOutcomeCoordinator';

declare const baseline:
  CanonicalGroundBallFirstBaseOutcomeInput;

const compileTimeAuthorityGuards = (): void => {
  const releaseInjection:
    CanonicalGroundBallFirstBaseOutcomeInput = {
      ...baseline,
      // @ts-expect-error release timing is derived from secure possession + transfer.
      releaseTick: 123,
    };

  const basesInjection:
    CanonicalGroundBallFirstBaseOutcomeInput = {
      ...baseline,
      // @ts-expect-error final occupancy is a downstream resolved outcome.
      basesAfter: {
        first: 'batter',
        second: null,
        third: null,
      },
    };

  const playEndInjection:
    CanonicalGroundBallFirstBaseOutcomeInput = {
      ...baseline,
      // @ts-expect-error play end is emitted only from terminal supported evidence.
      playEnd: {
        kind: 'play_end',
        tick: 123,
        reason: 'live_action_complete',
      },
    };

  const outcomeInjection:
    CanonicalGroundBallFirstBaseOutcomeInput = {
      ...baseline,
      // @ts-expect-error official/result classification cannot drive production physics.
      outcome: 'single',
    };

  const pickupTickInjection:
    CanonicalGroundBallFirstBaseOutcomeInput = {
      ...baseline,
      handler: {
        ...baseline.handler,
        // @ts-expect-error pickup contact time comes from ball/glove collision.
        pickupTick: 123,
      },
    };

  const possessionInjection:
    CanonicalGroundBallFirstBaseOutcomeInput = {
      ...baseline,
      handler: {
        ...baseline.handler,
        // @ts-expect-error possession comes from CatchRetention, not a caller boolean.
        possession: true,
      },
    };

  void releaseInjection;
  void basesInjection;
  void playEndInjection;
  void outcomeInjection;
  void pickupTickInjection;
  void possessionInjection;
};

describe('GroundBallProductionOutcomeCoordinator authority boundary', () => {
  it('keeps caller-supplied terminal facts outside the production input type', () => {
    expect(typeof compileTimeAuthorityGuards).toBe('function');
  });
});