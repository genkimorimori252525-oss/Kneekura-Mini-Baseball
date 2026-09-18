import type {
  PlayEndFact,
  RunnerBaseTouchFact,
} from './PhysicalRuleFacts';

export type PlayRunFinalization = Readonly<{
  finalizedAt: number;
  playEnd: PlayEndFact;
  scored: readonly RunnerBaseTouchFact[];
}>;

export const finalizePendingRunsAtPlayEnd = (
  pendingHomeTouches: readonly RunnerBaseTouchFact[],
  playEnd: PlayEndFact,
): PlayRunFinalization => {
  for (const touch of pendingHomeTouches) {
    if (touch.base !== 4) {
      throw new Error(
        'pending run finalization requires base-4 home touch facts',
      );
    }
    if (touch.tick > playEnd.tick) {
      throw new Error(
        'pending home touch cannot occur after the authoritative play end',
      );
    }
  }

  return {
    finalizedAt: playEnd.tick,
    playEnd,
    scored: [...pendingHomeTouches],
  };
};
