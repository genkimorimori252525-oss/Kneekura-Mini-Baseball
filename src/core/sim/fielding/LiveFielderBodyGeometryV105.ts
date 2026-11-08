import type { Vec3 } from '../../model/geometry';
import { createLiveHandPreparationV1, type LiveHandPreparationInputV1 } from './LiveHandPreparationV1';

/** Optional authoring controls. Omission resolves from stature, without rewriting the roster. */
export type LiveFielderBodyControlsV105 = Readonly<{
  fieldArmReachMetersV105?: number; fieldShoulderHeightRatioV105?: number; fieldEyeHeightRatioV105?: number;
  fieldCrouchFractionV105?: number; fieldPostureSpeedMpsV105?: number;
  fieldTurnSpeedRadiansPerSecondV105?: number; fieldRearReachFractionV105?: number;
}>;
export type LiveFielderBodyModelV105 = Readonly<{
  heightMeters: number; hipHeightMeters: number; shoulderHeightMeters: number; eyeHeightMeters: number;
  armReachMeters: number; maximumCrouchMeters: number; postureSpeedMps: number;
  turnSpeedRadiansPerSecond: number; rearReachFraction: number;
}>;
export type LiveFielderBodyPoseV105 = Readonly<{
  foot: Vec3; hip: Vec3; shoulder: Vec3; head: Vec3; eye: Vec3; eyeVelocity: Vec3; forward: Vec3;
  crouchMeters: number; armReachMeters: number; reachMarginMeters?: number;
}>;
export type LiveFielderPostureV105 = Readonly<{
  from: number; through: number; crouchFrom: number; crouchTo: number; yawFrom: number; yawTo: number;
}>;
const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: Vec3, s: number): Vec3 => v(a.x * s, a.y * s, a.z * s);
const norm = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export const liveFielderBodyControlBoundsV105 = Object.freeze({
  fieldArmReachMetersV105: [.2, 4], fieldShoulderHeightRatioV105: [.65, .88], fieldEyeHeightRatioV105: [.89, .99],
  fieldCrouchFractionV105: [0, .45], fieldPostureSpeedMpsV105: [.1, 8],
  fieldTurnSpeedRadiansPerSecondV105: [.1, 12], fieldRearReachFractionV105: [0, .5],
} as const);
export function resolveLiveFielderBodyModelV105(heightMeters: number, legacyGloveReachMeters: number,
  controls: LiveFielderBodyControlsV105 = {}): LiveFielderBodyModelV105 {
  if (!Number.isFinite(heightMeters) || heightMeters < 1.1 || heightMeters > 2.5
    || !Number.isFinite(legacyGloveReachMeters) || legacyGloveReachMeters <= 0
    || !controls || Object.keys(controls).some(k => !(k in liveFielderBodyControlBoundsV105))) throw new Error('invalid V105 fielder body dimensions');
  for (const [key, value] of Object.entries(controls)) {
    const bounds = liveFielderBodyControlBoundsV105[key as keyof typeof liveFielderBodyControlBoundsV105];
    if (!Number.isFinite(value) || value < bounds[0] || value > bounds[1]) throw new Error('invalid V105 fielder body control: ' + key);
  }
  return Object.freeze({ heightMeters, hipHeightMeters: heightMeters * .53,
    shoulderHeightMeters: heightMeters * (controls.fieldShoulderHeightRatioV105 ?? .818),
    eyeHeightMeters: heightMeters * (controls.fieldEyeHeightRatioV105 ?? .92),
    armReachMeters: controls.fieldArmReachMetersV105 ?? heightMeters * .491 * legacyGloveReachMeters / 1.35,
    maximumCrouchMeters: heightMeters * (controls.fieldCrouchFractionV105 ?? .36),
    postureSpeedMps: controls.fieldPostureSpeedMpsV105 ?? 2.5,
    turnSpeedRadiansPerSecond: controls.fieldTurnSpeedRadiansPerSecondV105 ?? 4.5,
    rearReachFraction: controls.fieldRearReachFractionV105 ?? .12 });
}
export function validateLiveFielderBodyModelV105(m: LiveFielderBodyModelV105): boolean {
  return !!m && Object.values(m).every(Number.isFinite) && m.heightMeters >= 1.1 && m.heightMeters <= 2.5
    && m.hipHeightMeters === m.heightMeters * .53 && m.shoulderHeightMeters >= m.heightMeters * .65
    && m.shoulderHeightMeters <= m.heightMeters * .88 && m.eyeHeightMeters >= m.heightMeters * .89
    && m.eyeHeightMeters <= m.heightMeters * .99 && m.armReachMeters > 0 && m.armReachMeters <= 10
    && m.maximumCrouchMeters >= 0 && m.maximumCrouchMeters <= m.heightMeters * .45
    && m.postureSpeedMps >= .1 && m.postureSpeedMps <= 8 && m.turnSpeedRadiansPerSecond >= .1
    && m.turnSpeedRadiansPerSecond <= 12 && m.rearReachFraction >= 0 && m.rearReachFraction <= .5;
}
export function sampleLiveFielderPostureV105(p: LiveFielderPostureV105, t: number) {
  const duration = p.through - p.from, u = duration <= 0 ? 1 : clamp((t - p.from) / duration, 0, 1);
  return { crouchMeters: p.crouchFrom + (p.crouchTo - p.crouchFrom) * u,
    crouchVelocity: duration > 0 && t >= p.from && t < p.through ? (p.crouchTo - p.crouchFrom) / duration : 0,
    yaw: p.yawFrom + (p.yawTo - p.yawFrom) * u };
}
export function liveFielderBodyPoseV105(m: LiveFielderBodyModelV105, anchor: Vec3, velocity: Vec3,
  posture: LiveFielderPostureV105, t: number, glove?: Vec3): LiveFielderBodyPoseV105 {
  const p = sampleLiveFielderPostureV105(posture, t), floor = anchor.y - m.hipHeightMeters,
    foot = v(anchor.x, floor, anchor.z), shoulder = v(anchor.x, floor + m.shoulderHeightMeters - p.crouchMeters, anchor.z),
    forward = v(Math.sin(p.yaw), 0, Math.cos(p.yaw));
  return { foot, hip: v(anchor.x, anchor.y - .65 * p.crouchMeters, anchor.z), shoulder,
    head: v(anchor.x, floor + m.heightMeters - p.crouchMeters, anchor.z),
    eye: v(anchor.x, floor + m.eyeHeightMeters - p.crouchMeters, anchor.z),
    eyeVelocity: v(velocity.x, velocity.y - p.crouchVelocity, velocity.z), forward,
    crouchMeters: p.crouchMeters, armReachMeters: m.armReachMeters,
    ...(glove ? { reachMarginMeters: liveFielderReachMarginV105(m, shoulder, forward, glove) } : {}) };
}
export function liveFielderReachMarginV105(m: LiveFielderBodyModelV105, shoulder: Vec3, forward: Vec3, hand: Vec3): number {
  const d = sub(hand, shoulder);
  return Math.min(m.armReachMeters - norm(d), dot(d, forward) + m.rearReachFraction * m.armReachMeters);
}
/** Project a command endpoint, never the current hand or ball. Both sets are convex. */
export function liveFielderReachTargetV105(m: LiveFielderBodyModelV105, shoulder: Vec3, forward: Vec3, target: Vec3): Vec3 {
  let d = sub(target, shoulder); d = mul(d, Math.min(1, m.armReachMeters * .995 / Math.max(norm(d), 1e-30)));
  const rear = dot(d, forward), limit = -m.rearReachFraction * m.armReachMeters * .99;
  if (rear < limit) d = add(d, mul(forward, limit - rear));
  return add(shoulder, d);
}
export function liveFielderDesiredCrouchV105(m: LiveFielderBodyModelV105, anchor: Vec3, target: Vec3): number {
  return clamp(anchor.y - m.hipHeightMeters + m.shoulderHeightMeters - target.y - m.armReachMeters * .8, 0, m.maximumCrouchMeters);
}
/** Maximum horizontal reach at a given ball height, including a feasible crouch. */
export function liveFielderHorizontalReachV105(m: LiveFielderBodyModelV105, anchor: Vec3, targetY: number, crouch = liveFielderDesiredCrouchV105(m, anchor, v(0, targetY, 0))): number {
  const dy = targetY - (anchor.y - m.hipHeightMeters + m.shoulderHeightMeters - crouch);
  return Math.abs(dy) <= m.armReachMeters ? Math.sqrt(Math.max(0, m.armReachMeters ** 2 - dy ** 2)) : -1;
}
export function liveFielderPreferredBodyPointV105(m: LiveFielderBodyModelV105, anchor: Vec3, ball: Vec3, forward: Vec3): Vec3 {
  const reach = Math.max(0, liveFielderHorizontalReachV105(m, anchor, ball.y)) * .65;
  return v(ball.x - forward.x * reach, anchor.y, ball.z - forward.z * reach);
}
export function liveFielderRecoverySecondsV105(m: LiveFielderBodyModelV105, pose?: Pick<LiveFielderBodyPoseV105, 'crouchMeters'>): number {
  return (pose?.crouchMeters ?? 0) / m.postureSpeedMps;
}
/** Optimistic motor timing, not a guarantee of a hand path or a future catch.
 * Torso recovery and facing can overlap each other and the transfer delay. */
export function liveFielderPreparationPostureSecondsV105(m: LiveFielderBodyModelV105,
  pose: Pick<LiveFielderBodyPoseV105, 'crouchMeters' | 'forward'> | undefined, origin: Vec3, target: Vec3): number {
  const dx=target.x-origin.x,dz=target.z-origin.z;
  if (!pose || Math.hypot(dx,dz)===0) return liveFielderRecoverySecondsV105(m,pose);
  const from=Math.atan2(pose.forward.x,pose.forward.z),to=Math.atan2(dx,dz),
    turn=Math.abs(Math.atan2(Math.sin(to-from),Math.cos(to-from)))/liveFielderTurnSpeedV110(m);
  return Math.max(liveFielderRecoverySecondsV105(m,pose),turn);
}
/** V110 authored global tuning. Preserve the stored individual base speed. */
export const liveFielderTurnSpeedV110=(m:LiveFielderBodyModelV105)=>m.turnSpeedRadiansPerSecond*2;
/** Shoulder-relative target translated back into the legacy body-relative command coordinates. */
export function liveFielderThrowOffsetV105(m: LiveFielderBodyModelV105, origin: Vec3, target: Vec3): Vec3 {
  const d = sub(target, origin), h = Math.hypot(d.x, d.z), forward = h > 0 ? v(d.x / h, 0, d.z / h) : v(0, 0, -1);
  return add(v(0, m.shoulderHeightMeters - m.hipHeightMeters, 0), add(mul(forward, m.armReachMeters * .45), v(0, m.armReachMeters * .32, 0)));
}
/** Same C1 solver, with a fixed standing shoulder origin. Preserves measured hand boundaries. */
export function createLiveBodyHandPreparationV105(raw: LiveHandPreparationInputV1, model?: LiveFielderBodyModelV105, forward?: Vec3) {
  if (!model) return createLiveHandPreparationV1(raw);
  const shoulder = v(0, model.shoulderHeightMeters - model.hipHeightMeters, 0),
    result = createLiveHandPreparationV1({ ...raw, initialOffset: sub(raw.initialOffset, shoulder),
      targetOffset: sub(raw.targetOffset, shoulder), maximumReachMeters: model.armReachMeters });
  if (result.kind !== 'planned') return result;
  const controls = result.cubicBezierControls(result.fromElapsedSeconds, result.throughElapsedSeconds);
  if (forward && controls.some(c => dot(c, forward) < -model.rearReachFraction * model.armReachMeters))
    return { kind: 'unreachable' as const, reason: 'ENDPOINT_OUTSIDE_REACH' as const, candidateCount: 0 };
  return { ...result, sampleAtElapsedSeconds: (t: number) => { const s = result.sampleAtElapsedSeconds(t); return { ...s, offset: add(s.offset, shoulder) }; },
    cubicBezierControls: (from: number, through: number) => result.cubicBezierControls(from, through).map(c => add(c, shoulder)) as unknown as readonly [Vec3, Vec3, Vec3, Vec3] };
}
