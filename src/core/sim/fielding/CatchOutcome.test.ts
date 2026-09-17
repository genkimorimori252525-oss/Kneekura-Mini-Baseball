import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import type { LiveBallState } from './GloveBallContact';
import {
  createLiveBallCatchOutcome,
  createSecuredCatchOutcome,
} from './CatchOutcome';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const deflectedBall = (overrides: Partial<LiveBallState> = {}): LiveBallState => ({
  tick: 2_006_500,
  position: v(0.04, 1.08, -0.06),
  velocity: v(4.2, -3.8, -11.5),
  spin: v(18, -42, 9),
  ...overrides,
});

describe('CatchOutcome', () => {
  it('requires failed secure possession to continue with an authoritative live-ball state', () => {
    const ball = deflectedBall();
    const outcome = createLiveBallCatchOutcome(2_002_167, ball);

    expect(outcome).toEqual({
      kind: 'live-ball',
      gloveContactTick: 2_002_167,
      ball,
    });
  });

  it('records secure possession separately from the earlier glove contact', () => {
    const outcome = createSecuredCatchOutcome(2_002_167, 2_014_731);

    expect(outcome).toEqual({
      kind: 'secured',
      gloveContactTick: 2_002_167,
      secureTick: 2_014_731,
    });
  });

  it('rejects a live-ball continuation whose state predates glove contact', () => {
    expect(() => createLiveBallCatchOutcome(
      2_002_167,
      deflectedBall({ tick: 2_002_166 }),
    )).toThrow('live ball tick must be at or after glove contact');
  });
});
