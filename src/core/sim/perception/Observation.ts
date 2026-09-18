export type PerceptionTarget =
  | Readonly<{ kind: 'ball' }>
  | Readonly<{ kind: 'player'; playerId: string }>
  | Readonly<{ kind: 'base'; base: 1 | 2 | 3 | 4 }>
  | Readonly<{ kind: 'coach'; coachId: string }>;

export type AttentionState = Readonly<{
  target: PerceptionTarget;
  focusedSinceTick: number;
}>;

export type ObservationSample<T> = Readonly<{
  estimate: T;
  observedAt: number;
  confidence: number;
}>;

export type ObservationRefreshPolicy = Readonly<{
  attendedIntervalTicks: number;
  peripheralIntervalTicks: number;
}>;

export type ObservationRefreshQuery = Readonly<{
  target: PerceptionTarget;
  attention: AttentionState;
  lastObservedAt: number | null;
  currentTick: number;
  policy: ObservationRefreshPolicy;
}>;

const validateTick = (name: string, tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

const validateInterval = (name: string, interval: number): void => {
  if (!Number.isSafeInteger(interval) || interval <= 0) {
    throw new Error(`${name} must be a positive safe integer tick interval`);
  }
};

const targetKey = (target: PerceptionTarget): string => {
  switch (target.kind) {
    case 'ball':
      return 'ball';
    case 'player':
      return `player:${target.playerId}`;
    case 'base':
      return `base:${target.base}`;
    case 'coach':
      return `coach:${target.coachId}`;
  }
};

export const createObservationSample = <T>(
  estimate: T,
  observedAt: number,
  confidence: number,
): ObservationSample<T> => {
  validateTick('observedAt', observedAt);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('confidence must be finite and within [0, 1]');
  }

  return {
    estimate,
    observedAt,
    confidence,
  };
};

export const isObservationRefreshDue = ({
  target,
  attention,
  lastObservedAt,
  currentTick,
  policy,
}: ObservationRefreshQuery): boolean => {
  validateTick('attention.focusedSinceTick', attention.focusedSinceTick);
  validateTick('currentTick', currentTick);
  validateInterval('attendedIntervalTicks', policy.attendedIntervalTicks);
  validateInterval('peripheralIntervalTicks', policy.peripheralIntervalTicks);

  if (lastObservedAt === null) {
    return true;
  }

  validateTick('lastObservedAt', lastObservedAt);
  if (currentTick < lastObservedAt) {
    throw new Error('currentTick must be at or after lastObservedAt');
  }

  const interval = targetKey(target) === targetKey(attention.target)
    ? policy.attendedIntervalTicks
    : policy.peripheralIntervalTicks;

  return currentTick - lastObservedAt >= interval;
};
