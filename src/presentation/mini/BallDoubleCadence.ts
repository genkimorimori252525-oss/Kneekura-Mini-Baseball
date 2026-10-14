import type { TimedMatchEvent } from '../../core/model/TimedMatchEvent';
import type { Vec3 } from '../../core/model/geometry';
import { MINI_PRESENTATION_CADENCE_MICROS } from './model';

/** Exact halfway visual cadence: this never advances canonical simulation. */
export const MINI_BALL_DOUBLE_CADENCE_MICROS = 27_500 as const;

export type BallVisualSample = Readonly<{
  atMicros: number;
  sourceFromTick: number;
  sourceToTick: number;
  interpolated: boolean;
  ballPosition: Vec3 | null;
}>;

type BallWorldSample = Readonly<{
  world: Readonly<{ tick: number; ball: null | Readonly<{ position: Vec3 }> }>;
}>;

const BOUNDARY_EVENTS = new Set([
  'BatBallContact',
  'PitchReleased',
  'BallCaught',
  'BallFielded',
  'PitchResult',
  'OfficialPlayClosure',
]);

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/**
 * Append *only* extra ball visual samples to the original 55ms presentation
 * sequence. No original sample, event, world state, player pose or rule tick
 * is modified. Never interpolate across a discontinuity, an absent ball, a
 * missing 55ms interval or an invalid position.
 */
export function buildDoubleRateBallVisualSamples(
  samples: readonly BallWorldSample[],
  events: readonly TimedMatchEvent[],
): readonly BallVisualSample[] {
  if (MINI_PRESENTATION_CADENCE_MICROS !== MINI_BALL_DOUBLE_CADENCE_MICROS * 2) {
    throw new Error('Unexpected presentation-to-ball cadence ratio.');
  }
  const output: BallVisualSample[] = [];
  const sortedEvents = [...events].sort((a, b) => a.tick - b.tick || a.sequence - b.sequence);
  let eventCursor = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const left = samples[i];
    const tick = left.world.tick;
    if (!Number.isSafeInteger(tick)) throw new Error('Invalid canonical presentation tick.');
    if (i > 0 && samples[i - 1].world.tick >= tick) {
      throw new Error('Canonical presentation ticks must strictly increase.');
    }
    output.push({
      atMicros: tick,
      sourceFromTick: tick,
      sourceToTick: tick,
      interpolated: false,
      ballPosition: left.world.ball?.position ?? null,
    });
    const right = samples[i + 1];
    if (!right || right.world.tick !== tick + MINI_PRESENTATION_CADENCE_MICROS) continue;
    if (!left.world.ball || !right.world.ball) continue;
    const a = left.world.ball.position, b = right.world.ball.position;
    if (![a.x, a.y, a.z, b.x, b.y, b.z].every(Number.isFinite)) continue;
    while (eventCursor < sortedEvents.length && sortedEvents[eventCursor].tick <= tick) eventCursor += 1;
    let crossesBoundary = false;
    for (let j = eventCursor; j < sortedEvents.length && sortedEvents[j].tick <= right.world.tick; j += 1) {
      if (BOUNDARY_EVENTS.has(sortedEvents[j].kind)) { crossesBoundary = true; break; }
    }
    if (crossesBoundary) continue;
    output.push({
      atMicros: tick + MINI_BALL_DOUBLE_CADENCE_MICROS,
      sourceFromTick: tick,
      sourceToTick: right.world.tick,
      interpolated: true,
      ballPosition: midpoint(a, b),
    });
  }
  return output;
}
