import { appendFileSync } from 'node:fs';

const start = Date.now();
/** Opt-in test diagnostics only. Synchronous writes remain visible during a
 * synchronous SQLite chain, unlike timer-flushed test-runner console output. */
export const ownedScheduledMotionTiming = (phase: string, event: 'begin' | 'end' | 'error' | 'point', started?: number): number => {
  const now = Date.now(), path = process.env.OWNED_SCHEDULED_TIMING_PATH;
  if (path) appendFileSync(path, `${JSON.stringify({ event, phase, elapsedMs: now - start,
    ...(started === undefined ? {} : { phaseMs: now - started }) })}\n`);
  return now;
};
export const ownedScheduledMotionPhase = <T>(phase: string, run: () => T): T => {
  const started = ownedScheduledMotionTiming(phase, 'begin');
  try {
    const value = run(); ownedScheduledMotionTiming(phase, 'end', started); return value;
  } catch (error) {
    ownedScheduledMotionTiming(phase, 'error', started); throw error;
  }
};
