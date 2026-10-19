import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle, rotateVectorByQuaternion, type Quaternion } from '../pitching/BaseballOrientation';
import type { BatterSwingState } from './BatBallContact';
import type { ReferenceBatKinematicsInputV1 } from './ReferenceBatKinematicsV1';

/** Authored research controls, not measured launch-angle classes. Window times
 * belong to the original measured clock and scale with motor playback rate. */
export type ImpactTrajectorySettingsV1 = Readonly<{
  level: 1 | 2 | 3 | 4;
  angleDegreesByLevel: readonly [number, number, number, number];
  beforeSeconds: number;
  afterSeconds: number;
}>;
export type ReferenceImpactTrajectoryV1 = ImpactTrajectorySettingsV1 & Readonly<{ contactSourceTick: number }>;
export const DEFAULT_IMPACT_TRAJECTORY_V1: ImpactTrajectorySettingsV1 = Object.freeze({
  level: 2, angleDegreesByLevel: Object.freeze([-10, 0, 10, 20] as const), beforeSeconds: .1, afterSeconds: .06,
});
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, n: number): Vec3 => ({ x: a.x * n, y: a.y * n, z: a.z * n });
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const keys = ['level', 'angleDegreesByLevel', 'beforeSeconds', 'afterSeconds'];
export function validateImpactTrajectorySettingsV1(raw: unknown): ImpactTrajectorySettingsV1 {
  const s = cloneInert(raw) as ImpactTrajectorySettingsV1;
  if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).sort().join('|') !== [...keys].sort().join('|')
    || !Number.isInteger(s.level) || s.level < 1 || s.level > 4 || !Array.isArray(s.angleDegreesByLevel)
    || s.angleDegreesByLevel.length !== 4 || Object.keys(s.angleDegreesByLevel).length !== 4
    || !s.angleDegreesByLevel.every(n => Number.isFinite(n) && n >= -30 && n <= 30)
    || ![s.beforeSeconds, s.afterSeconds].every(n => Number.isFinite(n) && n >= .02 && n <= .3))
    throw new Error('invalid impact trajectory settings');
  return Object.freeze({ ...s, angleDegreesByLevel: Object.freeze([...s.angleDegreesByLevel]) as unknown as readonly [number, number, number, number] });
}
/** Shared serializable input used by both the physical collision and preview.
 * Original measured frames are retained; there is no resampling or time warp. */
export function withReferenceImpactTrajectoryV1(reference: ReferenceBatKinematicsInputV1, contactSourceTick: number,
  settings: ImpactTrajectorySettingsV1): ReferenceBatKinematicsInputV1 {
  const input = cloneInert(reference), s = validateImpactTrajectorySettingsV1(settings);
  if (!Number.isFinite(contactSourceTick) || contactSourceTick < 0) throw new Error('invalid impact contact source tick');
  return { ...input, impactTrajectory: { ...s, contactSourceTick } };
}

type Sample = Readonly<{ tick: number; sourceTick: number; orientation: Quaternion; state: BatterSwingState;
  sweetSpot: Vec3; sweetSpotVelocity: Vec3 }>;
type Motion = Readonly<{
  maximumSweetSpotSpeedUpperBoundMps: number; maximumSweetSpotSpeedMps: number;
  maximumGripSpeedMps: number; maximumAngularSpeedRadPerSecond: number;
  sample: (tick: number) => Sample; sampleContinuous: (tick: number) => Sample;
  sampleAtSourceTick: (tick: number, side?: 'incoming' | 'outgoing') => Sample;
}>;
/** Continuous rigid transformation with analytic velocities. Its compact
 * quintic envelope has zero first/second derivatives at both ends and impact.
 * The pivot is the original measured sweet spot at contact, not the ball. */
export function createImpactAdjustedReferenceMotionV1<T extends Motion>(input: ReferenceBatKinematicsInputV1, base: T): T {
  const raw = input.impactTrajectory;
  if (raw === undefined) return base;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)
    || Object.keys(raw).sort().join('|') !== [...keys, 'contactSourceTick'].sort().join('|')) throw new Error('invalid reference impact trajectory');
  const { contactSourceTick, ...authoring } = raw, settings = validateImpactTrajectorySettingsV1(authoring);
  const angle = settings.angleDegreesByLevel[settings.level - 1] * Math.PI / 180;
  if (!Number.isFinite(contactSourceTick) || contactSourceTick < input.frames[0].tick || contactSourceTick > input.frames.at(-1)!.tick)
    throw new Error('impact contact lies outside measured reference');
  // Zero is a true compatibility mode, including old frame-window selection.
  if (angle === 0) return base;
  const first = contactSourceTick - settings.beforeSeconds * input.sourceTicksPerSecond,
    last = contactSourceTick + settings.afterSeconds * input.sourceTicksPerSecond;
  if (first < input.frames[0].tick || last > input.frames.at(-1)!.tick) throw new Error('impact adjustment window exceeds measured reference');
  const contact = base.sampleAtSourceTick(contactSourceTick), pivot = contact.sweetSpot, velocity = contact.sweetSpotVelocity,
    horizontalSpeed = Math.hypot(velocity.x, velocity.z);
  if (horizontalSpeed <= 1e-9) throw new Error('impact reference has no horizontal contact direction');
  const axis: Vec3 = { x: -velocity.z / horizontalSpeed, y: 0, z: velocity.x / horizontalSpeed },
    before = settings.beforeSeconds / input.playbackRate, after = settings.afterSeconds / input.playbackRate;
  const envelope = (elapsed: number) => {
    if (elapsed <= -before || elapsed >= after) return null;
    const duration = elapsed < 0 ? before : after, u = elapsed < 0 ? (elapsed + before) / before : 1 - elapsed / after,
      weight = u * u * u * (10 + u * (-15 + 6 * u)),
      derivative = 30 * u * u * (1 - u) * (1 - u) / duration * (elapsed < 0 ? 1 : -1);
    return { theta: angle * weight, thetaPrime: angle * derivative };
  };
  const adjust = (sample: Sample): Sample => {
    if (sample.sourceTick <= first || sample.sourceTick >= last) return sample;
    const e = envelope((sample.sourceTick - contactSourceTick) / input.sourceTicksPerSecond / input.playbackRate);
    if (!e) return sample;
    const rotation = quaternionFromAxisAngle(axis, e.theta), rotatedGrip = rotateVectorByQuaternion(sub(sample.state.pose.grip, pivot), rotation),
      rotatedTip = rotateVectorByQuaternion(sub(sample.state.pose.tip, pivot), rotation),
      rotatedSweet = rotateVectorByQuaternion(sub(sample.sweetSpot, pivot), rotation),
      linearVelocity = add(rotateVectorByQuaternion(sample.state.linearVelocity, rotation), scale(cross(axis, rotatedGrip), e.thetaPrime)),
      angularVelocity = add(rotateVectorByQuaternion(sample.state.angularVelocity, rotation), scale(axis, e.thetaPrime));
    return { ...sample, orientation: normalizeQuaternion(multiplyQuaternions(rotation, sample.orientation)),
      state: { pose: { grip: add(pivot, rotatedGrip), tip: add(pivot, rotatedTip) }, linearVelocity, angularVelocity },
      sweetSpot: add(pivot, rotatedSweet),
      sweetSpotVelocity: add(rotateVectorByQuaternion(sample.sweetSpotVelocity, rotation), scale(cross(axis, rotatedSweet), e.thetaPrime)) };
  };
  const sampleContinuous = (tick: number) => adjust(base.sampleContinuous(tick));
  // Each interval is inside one original constant-angular-velocity segment.
  // A midpoint speed plus an analytic acceleration bound * half-width bounds
  // every velocity in it. Subdivision only tightens this bound; the actual path
  // and collision sampler use the exact transform above, not these samples.
  const sourceToWorld = (tick: number) => input.startTick + (tick - input.frames[0].tick) / input.sourceTicksPerSecond / input.playbackRate * input.ticksPerSecond;
  const cuts = [...new Set([first, contactSourceTick, last, ...input.frames.filter(f => f.tick > first && f.tick < last).map(f => f.tick)])].sort((a, b) => a - b),
    thetaPrimeBound = Math.abs(angle) * 1.875 / Math.min(before, after),
    thetaSecondBound = Math.abs(angle) * (10 * Math.sqrt(3) / 3) / Math.min(before, after) ** 2,
    radius = input.batLengthM * input.transform.scale * input.sweetSpotT;
  let maximumSweetSpotSpeedMps = base.maximumSweetSpotSpeedMps, maximumGripSpeedMps = base.maximumGripSpeedMps;
  for (let i = 1; i < cuts.length; i++) {
    const lo = sourceToWorld(cuts[i - 1]), hi = sourceToWorld(cuts[i]),
      count = Math.max(1, Math.ceil((cuts[i] - cuts[i - 1]) / input.sourceTicksPerSecond / .001));
    for (let j = 0; j < count; j++) {
      const a = lo + (hi - lo) * j / count, b = lo + (hi - lo) * (j + 1) / count, half = (b - a) / input.ticksPerSecond / 2,
        original = base.sampleContinuous((a + b) / 2), changed = adjust(original), omega = norm(original.state.angularVelocity),
        sweetDistance = norm(sub(original.sweetSpot, pivot)) + base.maximumSweetSpotSpeedMps * half,
        gripDistance = norm(sub(original.state.pose.grip, pivot)) + base.maximumGripSpeedMps * half,
        sweetAcceleration = omega * omega * radius + 2 * thetaPrimeBound * base.maximumSweetSpotSpeedMps
          + (thetaSecondBound + thetaPrimeBound ** 2) * sweetDistance,
        gripAcceleration = 2 * thetaPrimeBound * base.maximumGripSpeedMps + (thetaSecondBound + thetaPrimeBound ** 2) * gripDistance;
      maximumSweetSpotSpeedMps = Math.max(maximumSweetSpotSpeedMps, norm(changed.sweetSpotVelocity) + sweetAcceleration * half);
      maximumGripSpeedMps = Math.max(maximumGripSpeedMps, norm(changed.state.linearVelocity) + gripAcceleration * half);
    }
  }
  return Object.freeze({ ...base, maximumSweetSpotSpeedMps, maximumSweetSpotSpeedUpperBoundMps: maximumSweetSpotSpeedMps,
    maximumGripSpeedMps, maximumAngularSpeedRadPerSecond: base.maximumAngularSpeedRadPerSecond + thetaPrimeBound,
    sampleContinuous,
    sample: (tick: number) => { base.sample(tick); return sampleContinuous(tick); },
    sampleAtSourceTick: (tick: number, side: 'incoming' | 'outgoing' = 'outgoing') => adjust(base.sampleAtSourceTick(tick, side)) });
}
