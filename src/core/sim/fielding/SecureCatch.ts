import { findFirstTrueTick } from '../ExactEventTime';

/**
 * Monotonic event predicate supplied by the future catch-retention model.
 * It is false before secure possession has been established and true from the
 * authoritative secure-possession tick onward for this catch attempt.
 */
export type SecurePossessionOccurrencePredicate = (tick: number) => boolean;

/**
 * Refines secure possession to an authoritative integer tick after physical
 * glove-ball contact.
 *
 * This function intentionally does not turn glove contact into a catch and does
 * not invent a fixed settling delay. The catch-retention model owns whether and
 * when secure possession becomes physically established; this boundary only
 * preserves that event time exactly in the shared Match Core.
 */
export const findSecureCatchTick = (
  gloveContactTick: number,
  endTick: number,
  hasSecurePossessionOccurredBy: SecurePossessionOccurrencePredicate,
): number | null => findFirstTrueTick(
  gloveContactTick,
  endTick,
  hasSecurePossessionOccurredBy,
);
