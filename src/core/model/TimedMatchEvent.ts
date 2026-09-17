export type TimedMatchEvent<TKind extends string = string, TPayload = unknown> = Readonly<{
  tick: number;
  sequence: number;
  kind: TKind;
  payload: TPayload;
}>;

export type PhysicalEventTimeRelation = 'before' | 'simultaneous' | 'after';

/**
 * Compares canonical physical event time without allowing deterministic storage
 * sequence to invent a physical ordering between events on the same tick.
 *
 * `sequence` can still provide stable ordering for serialization/presentation, but
 * equal authoritative ticks remain physically simultaneous for rules and replay.
 */
export const comparePhysicalEventTimes = (
  first: Pick<TimedMatchEvent, 'tick'>,
  second: Pick<TimedMatchEvent, 'tick'>,
): PhysicalEventTimeRelation => {
  if (first.tick < second.tick) {
    return 'before';
  }
  if (first.tick > second.tick) {
    return 'after';
  }
  return 'simultaneous';
};
