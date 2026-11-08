import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';

export type ObservedPitchPositionV151 = Readonly<{ observationId:string;observedTick:number;availableTick:number;position:Vec3 }>;

type Status = 'PREDICTED'|'NO_DELIVERED_OBSERVATIONS'|'INSUFFICIENT_OBSERVATIONS'|'PLANE_ALREADY_PASSED'|'NO_FORWARD_CROSSING';
type Prediction = Readonly<{ position:Vec3;arrivalAfterReleaseSeconds:number;estimatedVelocity:Vec3;estimatedAcceleration:Vec3 }>;
const axes = ['x', 'y', 'z'] as const;
const fields = (value:unknown, keys:readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const tick = (value:number) => Number.isSafeInteger(value) && value >= 0;
function assert(condition:unknown, message:string):asserts condition {
  if (!condition) throw Error('observed pitch forecast v151: ' + message);
}
function finiteDerived(value:number):number {
  assert(Number.isFinite(value), 'forecast arithmetic overflow');return value;
}
/** Scale before the discriminant, and use the complementary root to avoid
 * cancelling the small arrival root when |b| is large. No physics is simulated. */
function roots(a:number, b:number, c:number):number[] {
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
  if (scale === 0) return [];
  a /= scale;b /= scale;c /= scale;
  if (a === 0) return b === 0 ? [] : [-c / b];
  const discriminant = b * b - 4 * a * c;
  if (discriminant <= 0) return []; // A tangent touch is not a forward passage.
  const q = -.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
  return [q / a, c / q].sort((one, two) => one - two);
}

/** Ideal delivered position samples only. This local extrapolation is neither
 * an alternative ball simulator nor a measured model of human perception. */
export function forecastObservedPitchV151(raw:Readonly<{ originTick:number;ticksPerSecond:number;cutoffTick:number;planeZ:number;
  maximumAfterReleaseSeconds:number;observations:readonly ObservedPitchPositionV151[] }>) {
  const input = cloneInert(raw);
  assert(fields(input, ['originTick', 'ticksPerSecond', 'cutoffTick', 'planeZ', 'maximumAfterReleaseSeconds', 'observations']) &&
    tick(input.originTick) && tick(input.cutoffTick) && input.cutoffTick >= input.originTick &&
    Number.isSafeInteger(input.ticksPerSecond) && input.ticksPerSecond > 0 && Number.isFinite(input.planeZ) &&
    Number.isFinite(input.maximumAfterReleaseSeconds) && input.maximumAfterReleaseSeconds > 0 &&
    input.maximumAfterReleaseSeconds * input.ticksPerSecond <= Number.MAX_SAFE_INTEGER - input.originTick &&
    Array.isArray(input.observations), 'invalid forecast input or clock');
  const ids = new Set<string>(), observedTicks = new Set<number>();
  for (const observation of input.observations) {
    assert(fields(observation, ['observationId', 'observedTick', 'availableTick', 'position']) &&
      typeof observation.observationId === 'string' && observation.observationId.length > 0 &&
      observation.observationId.trim() === observation.observationId &&
      tick(observation.observedTick) && tick(observation.availableTick) && observation.observedTick >= input.originTick &&
      observation.availableTick >= observation.observedTick && fields(observation.position, axes) &&
      axes.every(axis => Number.isFinite(observation.position[axis])) &&
      !ids.has(observation.observationId) && !observedTicks.has(observation.observedTick), 'invalid or duplicate position observation');
    ids.add(observation.observationId);observedTicks.add(observation.observedTick);
  }
  const used = input.observations.filter(observation => observation.observedTick <= input.cutoffTick && observation.availableTick <= input.cutoffTick)
    .sort((one, two) => one.observedTick - two.observedTick).slice(-3), last = used.at(-1),
    usedObservationIds = Object.freeze(used.map(observation => observation.observationId)),
    observedThroughTick = last?.observedTick ?? null,
    availableAtTick = used.length ? Math.max(...used.map(observation => observation.availableTick)) : null;
  function result(status:Status, prediction:Prediction|null = null) {
    return Object.freeze({ version:'observed_pitch_forecast_v151' as const, status, cutoffTick:input.cutoffTick, observedThroughTick,
      availableAtTick, usedObservationIds, prediction, model:'POSITION_SAMPLES_CONSTANT_ACCELERATION_EXTRAPOLATION' as const,
      humanCalibration:'NOT_MEASURED' as const, opponentPrivateStateUsed:false as const, futureSourceUsed:false as const });
  }
  if (!last) return result('NO_DELIVERED_OBSERVATIONS');
  if (last.position.z <= input.planeZ) return result('PLANE_ALREADY_PASSED');
  if (used.length < 2) return result('INSUFFICIENT_OBSERVATIONS');
  const previous = used.at(-2)!, h12 = (last.observedTick - previous.observedTick) / input.ticksPerSecond,
    velocity = { x:0, y:0, z:0 }, acceleration = { x:0, y:0, z:0 };
  for (const axis of axes) {
    const slope12 = finiteDerived((last.position[axis] - previous.position[axis]) / h12);
    if (used.length === 2) velocity[axis] = slope12;
    else {
      const first = used[0], h01 = (previous.observedTick - first.observedTick) / input.ticksPerSecond,
        slope01 = finiteDerived((previous.position[axis] - first.position[axis]) / h01),
        quadratic = finiteDerived((slope12 - slope01) / (h01 + h12));
      velocity[axis] = finiteDerived(slope12 + quadratic * h12);acceleration[axis] = finiteDerived(2 * quadratic);
    }
  }
  const crossing = roots(.5 * acceleration.z, velocity.z, finiteDerived(last.position.z - input.planeZ))
    .find(seconds => Number.isFinite(seconds) && seconds > 0 && velocity.z + acceleration.z * seconds < 0),
    lastAfterRelease = (last.observedTick - input.originTick) / input.ticksPerSecond,
    cutoffAfterLast = (input.cutoffTick - last.observedTick) / input.ticksPerSecond;
  // Only the first decreasing-z arrival after the last sample is relevant.
  // A past arrival is not moved to a later reversing root; a tangent is no passage.
  if (crossing === undefined || crossing < cutoffAfterLast || lastAfterRelease + crossing > input.maximumAfterReleaseSeconds)
    return result('NO_FORWARD_CROSSING');
  const position = { x:0, y:0, z:input.planeZ }, estimatedVelocity = { x:0, y:0, z:0 };
  for (const axis of axes) {
    if (axis !== 'z') position[axis] = finiteDerived(last.position[axis] + velocity[axis] * crossing + .5 * acceleration[axis] * crossing * crossing);
    estimatedVelocity[axis] = finiteDerived(velocity[axis] + acceleration[axis] * crossing);
  }
  return result('PREDICTED', Object.freeze({ position:Object.freeze(position),
    arrivalAfterReleaseSeconds:finiteDerived(lastAfterRelease + crossing), estimatedVelocity:Object.freeze(estimatedVelocity),
    estimatedAcceleration:Object.freeze(acceleration) }));
}
