import type { Vec2 } from '../../model/geometry';
import { createLiveLocomotionProfileV84 } from '../locomotion/LiveLocomotionV84';
import { createLiveRunnerMotionV1, type LiveRunnerMotionV1, type LiveRunnerMotionTouchV1 } from './LiveRunnerMotionV1';
import type { RunnerRouteSegment } from './RunnerRoute';

/** An actual reversal first dissipates the existing velocity. Only at zero
 * speed may the directed route reverse. Bag crossings during that stopping
 * distance remain physical touches; the return then visits passed bags in
 * reverse order. This is a motor, never a tag-up ruling or a guaranteed safe. */
export function createLiveRunnerRetreatMotionV1(input: Readonly<{
  position: Vec2; velocity: Vec2; bases: Readonly<Record<1 | 2 | 3 | 4, Vec2>>;
  originBase: 1 | 2 | 3; lastTouchedBase: number; topSpeedMps: number; accelerationMps2: number;
  brakingMps2?: number;
  roundingRadiusMeters?: number; lateralAccelerationMps2?: number; baseTouchRadiusMeters?: number;
}>): LiveRunnerMotionV1 | null {
  const { position: p, velocity, accelerationMps2: a } = input, radius = input.baseTouchRadiusMeters ?? .28,
    speed = Math.hypot(velocity.x, velocity.z), braking = input.brakingMps2 ?? 1.8 * a;
  if (![p.x, p.z, velocity.x, velocity.z, a, braking, input.topSpeedMps, radius].every(Number.isFinite)
    || a <= 0 || braking <= 0 || input.topSpeedMps <= 0 || radius <= 0 || speed > input.topSpeedMps + 1e-9
    || ![1, 2, 3].includes(input.originBase) || !Number.isInteger(input.lastTouchedBase)
    || input.lastTouchedBase < input.originBase || input.lastTouchedBase > 4)
    throw new Error('live runner retreat: finite actual runner state and origin required');
  const profile = createLiveLocomotionProfileV84({ topSpeedMps: input.topSpeedMps, accelerationMps2: a, brakingMps2: braking }),
    b = profile.brakingMps2, stopTime = speed / b, stopDistance = speed * speed / (2 * b),
    direction = speed > 0 ? { x: velocity.x / speed, z: velocity.z / speed } : { x: 0, z: 0 },
    stopped = { x: p.x + direction.x * stopDistance, z: p.z + direction.z * stopDistance };
  const brakingTimeAt = (distance: number) => distance <= 0 ? 0 : 2 * distance / (speed + Math.sqrt(Math.max(0, speed * speed - 2 * b * distance))),
    prefixTouches: LiveRunnerMotionTouchV1[] = [];
  if (speed > 0) for (const base of [1, 2, 3, 4] as const) {
    if (base < input.originBase) continue;
    const bag = input.bases[base], x = bag.x - p.x, z = bag.z - p.z,
      along = x * direction.x + z * direction.z, lateral2 = Math.max(0, x * x + z * z - along * along);
    if (Math.hypot(x, z) <= radius || lateral2 > radius * radius) continue;
    const entry = along - Math.sqrt(Math.max(0, radius * radius - lateral2));
    if (entry < 0 || entry > stopDistance) continue;
    const center = Math.min(stopDistance, Math.max(entry, along));
    prefixTouches.push({ base, distanceMeters: entry, elapsedSeconds: brakingTimeAt(entry),
      position: { x: p.x + direction.x * entry, z: p.z + direction.z * entry },
      centerDistanceMeters: center, centerElapsedSeconds: brakingTimeAt(center) });
  }
  prefixTouches.sort((x, y) => x.elapsedSeconds - y.elapsedSeconds);
  const maximumBase = Math.max(input.lastTouchedBase, ...prefixTouches.map(t => t.base)), targets = [];
  for (let base = maximumBase; base >= input.originBase; base--) {
    const position = input.bases[base as 1 | 2 | 3 | 4];
    if (base === maximumBase && Math.hypot(position.x - stopped.x, position.z - stopped.z) <= radius) continue;
    targets.push({ base, position });
  }
  const retreat = targets.length ? createLiveRunnerMotionV1({ ...input, position: stopped, velocity: { x: 0, z: 0 }, bases: targets }) : null;
  if (targets.length && !retreat || !targets.length && speed === 0) return null;
  const routeSegments: RunnerRouteSegment[] = [
    ...(stopDistance > 1e-10 ? [{ kind: 'line' as const, start: { ...p }, end: stopped }] : []), ...(retreat?.route.segments ?? []),
  ], lengthMeters = stopDistance + (retreat?.lengthMeters ?? 0), durationSeconds = stopTime + (retreat?.durationSeconds ?? 0),
    shiftedTouches = (retreat?.touches ?? []).map(t => ({ ...t, distanceMeters: t.distanceMeters + stopDistance,
      centerDistanceMeters: t.centerDistanceMeters + stopDistance, elapsedSeconds: t.elapsedSeconds + stopTime,
      centerElapsedSeconds: t.centerElapsedSeconds + stopTime }));
  return Object.freeze({ route: { segments: routeSegments }, lengthMeters, durationSeconds,
    speedSegments: [...(stopTime > 0 ? [{ startElapsedSeconds: 0, endElapsedSeconds: stopTime,
      startDistanceMeters: 0, endDistanceMeters: stopDistance, startSpeedMps: speed, accelerationMps2: -b }] : []),
    ...(retreat?.speedSegments ?? []).map(s => ({ ...s, startElapsedSeconds: s.startElapsedSeconds + stopTime,
      endElapsedSeconds: s.endElapsedSeconds + stopTime, startDistanceMeters: s.startDistanceMeters + stopDistance,
      endDistanceMeters: s.endDistanceMeters + stopDistance }))],
    touches: [...prefixTouches, ...shiftedTouches],
    elapsedSecondsAtDistanceMeters: distance => distance <= stopDistance ? brakingTimeAt(distance)
      : stopTime + retreat!.elapsedSecondsAtDistanceMeters(distance - stopDistance),
    sampleAtElapsedSeconds: elapsed => {
      if (!Number.isFinite(elapsed)) throw new Error('live runner retreat: finite sample clock required');
      if (elapsed <= 0) return { position: { ...p }, velocity: { ...velocity }, speedMps: speed, distanceMeters: 0 };
      if (elapsed >= stopTime && retreat) {
        const sample = retreat.sampleAtElapsedSeconds(elapsed - stopTime);
        return { ...sample, distanceMeters: stopDistance + sample.distanceMeters };
      }
      const t = Math.min(elapsed, stopTime), distance = speed * t - .5 * b * t * t, remaining = Math.max(0, speed - b * t);
      return { position: { x: p.x + direction.x * distance, z: p.z + direction.z * distance },
        velocity: { x: direction.x * remaining, z: direction.z * remaining }, speedMps: remaining, distanceMeters: distance };
    } });
}
