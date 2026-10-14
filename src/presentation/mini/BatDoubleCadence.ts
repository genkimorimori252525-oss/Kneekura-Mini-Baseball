import type { TimedMatchEvent } from '../../core/model/TimedMatchEvent';
import type { Vec3 } from '../../core/model/geometry';
import type { BatPose, CanonicalPresentationSample } from './model';
import { MINI_PRESENTATION_CADENCE_MICROS } from './model';

export const MINI_BAT_DOUBLE_CADENCE_MICROS = 27_500 as const;

export type BatVisualSample = Readonly<{
  atMicros: number;
  sourceFromTick: number;
  sourceToTick: number;
  interpolated: boolean;
  pose: BatPose | null;
}>;

function lerpVector(a: Vec3, b: Vec3, weight: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * weight,
    y: a.y + (b.y - a.y) * weight,
    z: a.z + (b.z - a.z) * weight,
  };
}

/**
 * Presentation-only intermediate BAT poses. Keep original sprites/frame
 * choices as-is; interpolate geometric bat grip/tip ONLY when both canonical
 * samples have a bat and the swing action is unchanged.
 * Never interpolate across contact, release, or a missing observation.
 */
export function buildDoubleRateBatVisualSamples(
  samples: readonly CanonicalPresentationSample[],
  events: readonly TimedMatchEvent[],
): readonly BatVisualSample[] {
  if (MINI_BAT_DOUBLE_CADENCE_MICROS * 2 !== MINI_PRESENTATION_CADENCE_MICROS) {
    throw new Error('Bat cadence must be precisely 2x canonical presentation cadence.');
  }
  const output: BatVisualSample[] = [];
  const boundaries = events.filter(event =>
    event.kind === 'BatBallContact' || event.kind === 'PitchReleased' ||
    event.kind === 'PitchResult' || event.kind === 'OfficialPlayClosure')
    .map(event => event.tick);
  for (let i = 0; i < samples.length; i += 1) {
    const left = samples[i];
    const tick = left.world.tick;
    if (!Number.isSafeInteger(tick) || i > 0 && samples[i - 1].world.tick >= tick) {
      throw new Error('Bat samples require strictly increasing canonical ticks.');
    }
    output.push({
      atMicros: tick,
      sourceFromTick: tick,
      sourceToTick: tick,
      interpolated: false,
      pose: left.batter.bat,
    });
    const right = samples[i + 1];
    if (!right || right.world.tick !== tick + MINI_PRESENTATION_CADENCE_MICROS ||
      !left.batter.bat || !right.batter.bat ||
      left.batter.action !== right.batter.action ||
      left.batter.handedness !== right.batter.handedness ||
      boundaries.some(eventTick => eventTick > tick && eventTick <= right.world.tick)) continue;
    const a = left.batter.bat, b = right.batter.bat;
    if (![a.grip.x, a.grip.y, a.grip.z, a.tip.x, a.tip.y, a.tip.z,
      b.grip.x, b.grip.y, b.grip.z, b.tip.x, b.tip.y, b.tip.z].every(Number.isFinite)) continue;
    output.push({
      atMicros: tick + MINI_BAT_DOUBLE_CADENCE_MICROS,
      sourceFromTick: tick,
      sourceToTick: right.world.tick,
      interpolated: true,
      pose: { grip: lerpVector(a.grip, b.grip, 0.5), tip: lerpVector(a.tip, b.tip, 0.5) },
    });
  }
  return output;
}
