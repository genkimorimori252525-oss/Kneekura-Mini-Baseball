import type { LiveBallState } from './GloveBallContact';

export type SecuredCatchOutcome = Readonly<{
  kind: 'secured';
  gloveContactTick: number;
  secureTick: number;
}>;

export type LiveBallCatchOutcome = Readonly<{
  kind: 'live-ball';
  gloveContactTick: number;
  ball: LiveBallState;
}>;

export type CatchOutcome = SecuredCatchOutcome | LiveBallCatchOutcome;

/**
 * Records a catch attempt whose physical contact has progressed to secure possession.
 * Contact and secure possession remain separate authoritative events.
 */
export const createSecuredCatchOutcome = (
  gloveContactTick: number,
  secureTick: number,
): SecuredCatchOutcome => ({
  kind: 'secured',
  gloveContactTick,
  secureTick,
});

/**
 * Records a catch attempt that did not become secure possession.
 *
 * A failed catch cannot collapse into a boolean/result-only event: callers must carry the
 * authoritative post-contact live-ball state so deflections, drops, and passed balls can
 * continue through normal ball physics.
 */
export const createLiveBallCatchOutcome = (
  gloveContactTick: number,
  ball: LiveBallState,
): LiveBallCatchOutcome => {
  if (ball.tick < gloveContactTick) {
    throw new Error('live ball tick must be at or after glove contact');
  }

  return {
    kind: 'live-ball',
    gloveContactTick,
    ball,
  };
};
