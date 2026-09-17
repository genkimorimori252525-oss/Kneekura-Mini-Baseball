import { findFirstTrueTick } from '../ExactEventTime';

/**
 * True while the throwing model still considers the ball physically constrained by
 * the hand/fingers at the supplied authoritative tick. The predicate must be monotonic
 * inside the search interval: constrained before release, unconstrained from release on.
 */
export type BallHandConstraintPredicate = (tick: number) => boolean;

/**
 * Refines the physical hand-ball release boundary to an authoritative integer tick.
 *
 * This function deliberately does not invent arm animation duration or a release delay.
 * A future throwing/body model owns the physical constraint state; this Core boundary
 * only establishes exactly when that constraint first ceases to exist.
 */
export const findThrowReleaseTick = (
  startTick: number,
  endTick: number,
  isBallHandConstrainedAt: BallHandConstraintPredicate,
): number | null => findFirstTrueTick(
  startTick,
  endTick,
  (tick) => !isBallHandConstrainedAt(tick),
);
