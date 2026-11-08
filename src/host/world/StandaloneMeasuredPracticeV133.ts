import { planCourseAwareSwingKinematicsV1 } from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';
import { shiftSwingKinematicsTrajectoryV1 } from '../../core/sim/contact/SwingKinematicsV1';
import { createReferenceBatKinematicsV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { planMeasuredBattingTrajectoryV1, registrationForMeasuredRepertoireV137 } from '../../core/world/psychology/batting/MeasuredBattingTrajectoryV1';
import { resolveMotorStart } from '../../core/world/psychology/batting/BattingTiming';
import { REGISTERED_MEASURED_LINEAR_V133, REGISTERED_MEASURED_AIM_V138, registeredMeasuredImplementationV138, type RegisteredMeasuredImplementationV138 } from '../../core/world/psychology/batting/SpinMotorPlanV123';
import type { BattingRepertoireValues } from '../../core/world/psychology/batting/BattingTypes';
import type { DurablePlayerBattingModelV1 } from './PlayerBattingModel';
import type { StandaloneSwingCommand } from './StandalonePracticeMotion';
import { actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { nonPitchFields as fields } from './NonPitchDevelopmentRepetition';

type ProfileRef = Readonly<{ profileId: string; version: string }>;
export type MeasuredPracticeMotorV133 = Readonly<{ implementationV133: RegisteredMeasuredImplementationV138; payloadHash: string }>;
export type MeasuredPracticeMotorBindingV133 = MeasuredPracticeMotorV133 & Readonly<{ profileRef: ProfileRef }>;
type Model = Pick<DurablePlayerBattingModelV1, 'repertoire' | 'equipment' | 'capability'>;

export const assertMeasuredPracticeMotorV133 = (raw: MeasuredPracticeMotorV133): void => {
  if (!fields(raw, ['implementationV133', 'payloadHash']) || ![REGISTERED_MEASURED_LINEAR_V133, REGISTERED_MEASURED_AIM_V138].includes(raw.implementationV133)
    || typeof raw.payloadHash !== 'string' || !/^[a-f0-9]{64}$/.test(raw.payloadHash)) throw Error('invalid explicit measured practice motor');
};

/** Source values, not an executed pose or a claimed clip name. The complete
 * registered clip, course profile, registration convention and actual contact
 * equipment are authenticated by the caller's original model owner. */
export function registeredMeasuredMotorBindingV133(repertoire: BattingRepertoireValues,
  equipment: DurablePlayerBattingModelV1['equipment']['values'], profileRef: ProfileRef): MeasuredPracticeMotorBindingV133 {
  const profiles = repertoire.profiles.filter(p => p.profile.profileId === profileRef.profileId && p.profile.version === profileRef.version);
  const clips = repertoire.sampledProfiles?.filter(p => p.profileId === profileRef.profileId) ?? [];
  if (profiles.length !== 1 || clips.length !== 1) throw Error('original registered measured profile is missing or ambiguous');
  const implementationV133 = registeredMeasuredImplementationV138(repertoire.repertoireVersion);
  const payloadHash = hash({ implementationV133, repertoireVersion: repertoire.repertoireVersion, profile: profiles[0], sampledProfile: clips[0], equipment,
    // Both families use the original piecewise-linear clip. The V138 static
    // registration aim is in the fully pinned sampledProfile; this null is
    // the distinct, time-varying V121 aimCorrection option, still unsupported.
    executionOptions: { interpolation: 'linear', motorRamp: null, aimCorrection: null, executionEnvelope: null, impactTrajectory: null } });
  return freeze({ implementationV133, payloadHash, profileRef: { ...profileRef } });
}

/** Explicit prospective measured practice only. No actual contact or result
 * enters the plan, and none of the old course-aware commands use this seam. */
export function planStandaloneMeasuredPracticeV133(c: StandaloneSwingCommand & Readonly<{ measuredMotorV133: MeasuredPracticeMotorV133 }>,
  ticksPerSecond: number, model: Model) {
  assertMeasuredPracticeMotorV133(c.measuredMotorV133);
  const binding = registeredMeasuredMotorBindingV133(model.repertoire.values, model.equipment.values, { profileId: c.profileId, version: c.profileVersion });
  if (c.measuredMotorV133.implementationV133 !== binding.implementationV133 || c.measuredMotorV133.payloadHash !== binding.payloadHash) {
    throw Error('measured practice original motor family or payload differs');
  }
  const profile = model.repertoire.values.profiles.find(p => p.profile.profileId === c.profileId && p.profile.version === c.profileVersion)!.profile;
  const clip = model.repertoire.values.sampledProfiles!.find(p => p.profileId === c.profileId)!;
  const intended = planCourseAwareSwingKinematicsV1({ ...c.plan, profile, ticksPerSecond }).trajectory;
  const motor = model.capability.values, preferred = shiftSwingKinematicsTrajectoryV1(intended, motor.technicalTimingOffsetTicks);
  const sampled = planMeasuredBattingTrajectoryV1(clip, c.plan.handedness, preferred,
    registrationForMeasuredRepertoireV137(model.repertoire.values.repertoireVersion));
  if (['executionInterpolationV122', 'executionEnvelopeV133', 'motorRampSecondsV121', 'aimCorrectionV121', 'impactTrajectory'].some(k => Object.hasOwn(sampled, k))) {
    throw Error('measured practice implementation has unsupported execution options');
  }
  const startTick = resolveMotorStart(sampled.startTick, c.issuedTick, c.bodyReadyTick, motor.motorLatencyTicks);
  const trajectory = freeze({ ...sampled, startTick });
  const motion = createReferenceBatKinematicsV1(trajectory);
  if (motion.maximumSweetSpotSpeedMps > motor.maximumSweetSpotSpeedMps) throw Error('measured practice personal speed envelope exceeded');
  const endTick = Math.ceil(startTick + (trajectory.frames.at(-1)!.tick - trajectory.frames[0].tick)
    / trajectory.sourceTicksPerSecond / trajectory.playbackRate * ticksPerSecond);
  return { binding, trajectory, motion, startTick, endTick };
}
