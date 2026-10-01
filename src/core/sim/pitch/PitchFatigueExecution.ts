import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { validatePitchTimingProfile, type PitchTimingProfile } from './PitchTimingModel';

export type PitchFatigueExecutionPolicy = Readonly<{
  policyId: string; version: string; availableAtDay: number;
  motionDurationScaleAtFullFatigue: number; velocityRetentionAtFullFatigue: number; spinRetentionAtFullFatigue: number;
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const unit = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;
const fields = (value: object, names: readonly string[]) => Object.keys(value).sort().join('|') === names.slice().sort().join('|');
export const validatePitchFatigueExecutionPolicy = (raw: PitchFatigueExecutionPolicy): PitchFatigueExecutionPolicy => {
  const policy = cloneInert(raw);
  if (!policy || !fields(policy, ['policyId', 'version', 'availableAtDay', 'motionDurationScaleAtFullFatigue',
    'velocityRetentionAtFullFatigue', 'spinRetentionAtFullFatigue']) || !id(policy.policyId) || !id(policy.version)
    || !day(policy.availableAtDay) || !Number.isFinite(policy.motionDurationScaleAtFullFatigue) || policy.motionDurationScaleAtFullFatigue < 1
    || !unit(policy.velocityRetentionAtFullFatigue) || !unit(policy.spinRetentionAtFullFatigue)) throw new Error('invalid pitch fatigue execution policy');
  return Object.freeze(policy);
};

/** Temporary physical response; accepted long-term skill/body sources never change. */
export const applyPitchFatigueToExecution = (rawTiming: PitchTimingProfile,
  rawPhysics: Readonly<{ velocity: Vec3; spin: Vec3 }>, fatigue: number,
  rawPolicy: PitchFatigueExecutionPolicy, gameDay: number): Readonly<{
    timingProfile: PitchTimingProfile; physics: Readonly<{ velocity: Vec3; spin: Vec3 }>;
  }> => {
  const policy = validatePitchFatigueExecutionPolicy(rawPolicy);
  if (!unit(fatigue) || !day(gameDay) || policy.availableAtDay > gameDay) throw new Error('invalid fatigue or future execution policy');
  const timing = validatePitchTimingProfile(cloneInert(rawTiming)), physics = cloneInert(rawPhysics);
  if (!physics || !fields(physics, ['velocity', 'spin']) || !physics.velocity || !physics.spin
    || !fields(physics.velocity, ['x', 'y', 'z']) || !fields(physics.spin, ['x', 'y', 'z'])
    || ![...Object.values(physics.velocity), ...Object.values(physics.spin)].every((value) => typeof value === 'number' && Number.isFinite(value))) {
    throw new Error('invalid nominal pitch physics');
  }
  const durationScale = 1 + fatigue * (policy.motionDurationScaleAtFullFatigue - 1);
  const duration = (value: number): number => {
    const result = Math.round(value * durationScale);
    if (!Number.isSafeInteger(result) || result <= 0) throw new Error('pitch fatigue duration overflow');
    return result;
  };
  const scaled = (vector: Vec3, retention: number): Vec3 => {
    const scale = 1 - fatigue * (1 - retention);
    return Object.freeze({ x: vector.x * scale, y: vector.y * scale, z: vector.z * scale });
  };
  return Object.freeze({ timingProfile: validatePitchTimingProfile({ ...timing,
    normalMotionToReleaseUs: duration(timing.normalMotionToReleaseUs), followThroughUs: duration(timing.followThroughUs) }),
  physics: Object.freeze({ velocity: scaled(physics.velocity, policy.velocityRetentionAtFullFatigue),
    spin: scaled(physics.spin, policy.spinRetentionAtFullFatigue) }) });
};
