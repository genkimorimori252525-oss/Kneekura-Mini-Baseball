import type { Vec3 } from '../../model/geometry';
import { SeedRoot } from '../../rng/SeedRoot';
import type { RigidBaseballProperties } from '../contact/RigidBatBallContact';
import {
  multiplyQuaternions,
  normalizeQuaternion,
  quaternionFromAxisAngle,
  type Quaternion,
} from './BaseballOrientation';
import type {
  PitchFingerImpulse,
  PitchReleaseMechanicsInput,
} from './PitchReleaseMechanics';

export type PitchSkillFingerRepeatability = Readonly<{
  fingerId: string;
  contactDirectionStdDev: Vec3;
  impulseStdDevNs: Vec3;
}>;

export type PitchSkillRepeatability = Readonly<{
  releasePositionStdDevM: Vec3;
  preReleaseVelocityStdDevMps: Vec3;
  preReleaseSpinStdDevRadPerSecond: Vec3;
  orientationStdDevRad: Vec3;
  fingers: readonly PitchSkillFingerRepeatability[];
}>;

export type PitchSkillReleaseTemplate = Readonly<{
  releasePositionOffsetM: Vec3;
  preReleaseVelocityMps: Vec3;
  preReleaseSpinRadPerSecond: Vec3;
  orientation: Quaternion;
  fingerImpulses: readonly PitchFingerImpulse[];
}>;

export type PitchSkillProfile = Readonly<{
  pitchSkillId: string;
  releaseTemplate: PitchSkillReleaseTemplate;
  repeatability: PitchSkillRepeatability;
}>;

export type PitcherPitchSkillProfile = Readonly<{
  pitcherId: string;
  skills: readonly PitchSkillProfile[];
}>;

export type PitchSkillSamplingContext = Readonly<{
  matchSeed: number;
  playId: number;
  pitchOrdinal: number;
  tick: number;
  releaseAnchorPosition: Vec3;
  ball: RigidBaseballProperties;
}>;

export type SampledPitchSkillRelease = Readonly<{
  pitcherId: string;
  pitchSkillId: string;
  release: PitchReleaseMechanicsInput;
  deltas: Readonly<{
    releasePositionM: Vec3;
    preReleaseVelocityMps: Vec3;
    preReleaseSpinRadPerSecond: Vec3;
    orientationRad: Vec3;
    fingerImpulsesNs: readonly Readonly<{
      fingerId: string;
      delta: Vec3;
    }>[];
    fingerContactDirections: readonly Readonly<{
      fingerId: string;
      delta: Vec3;
    }>[];
  }>;
}>;

const EPSILON = 1e-12;

const add = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

const magnitude = (value: Vec3): number =>
  Math.hypot(value.x, value.y, value.z);

const normalize = (value: Vec3): Vec3 => {
  const length = magnitude(value);
  if (!Number.isFinite(length) || length <= EPSILON) {
    throw new Error(
      'pitch skill finger contact direction must remain non-zero',
    );
  }
  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  };
};

const validateFiniteVec3 = (
  name: string,
  value: Vec3,
): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(
      `${name} must contain finite values`,
    );
  }
};

const validateStdDevVec3 = (
  name: string,
  value: Vec3,
): void => {
  validateFiniteVec3(name, value);
  if (
    value.x < 0
    || value.y < 0
    || value.z < 0
  ) {
    throw new Error(
      `${name} must contain non-negative standard deviations`,
    );
  }
};

const validateProfile = (
  profile: PitchSkillProfile,
): void => {
  if (profile.pitchSkillId.length === 0) {
    throw new Error(
      'pitchSkillId must not be empty',
    );
  }
  validateFiniteVec3(
    'releasePositionOffsetM',
    profile.releaseTemplate.releasePositionOffsetM,
  );
  validateFiniteVec3(
    'preReleaseVelocityMps',
    profile.releaseTemplate.preReleaseVelocityMps,
  );
  validateFiniteVec3(
    'preReleaseSpinRadPerSecond',
    profile.releaseTemplate.preReleaseSpinRadPerSecond,
  );
  normalizeQuaternion(
    profile.releaseTemplate.orientation,
  );

  const fingerIds = new Set<string>();
  for (const finger of profile.releaseTemplate.fingerImpulses) {
    if (finger.fingerId.length === 0) {
      throw new Error(
        'pitch skill fingerId must not be empty',
      );
    }
    if (fingerIds.has(finger.fingerId)) {
      throw new Error(
        'pitch skill fingerId values must be unique',
      );
    }
    fingerIds.add(finger.fingerId);
    validateFiniteVec3(
      'pitch skill finger contactDirectionBody',
      finger.contactDirectionBody,
    );
    normalize(finger.contactDirectionBody);
    validateFiniteVec3(
      'pitch skill finger impulseWorldNs',
      finger.impulseWorldNs,
    );
  }

  validateStdDevVec3(
    'releasePositionStdDevM',
    profile.repeatability.releasePositionStdDevM,
  );
  validateStdDevVec3(
    'preReleaseVelocityStdDevMps',
    profile.repeatability.preReleaseVelocityStdDevMps,
  );
  validateStdDevVec3(
    'preReleaseSpinStdDevRadPerSecond',
    profile.repeatability.preReleaseSpinStdDevRadPerSecond,
  );
  validateStdDevVec3(
    'orientationStdDevRad',
    profile.repeatability.orientationStdDevRad,
  );

  const repeatabilityFingerIds =
    new Set<string>();
  for (const finger of profile.repeatability.fingers) {
    if (!fingerIds.has(finger.fingerId)) {
      throw new Error(
        'pitch skill repeatability fingerId must exist in the release template',
      );
    }
    if (repeatabilityFingerIds.has(finger.fingerId)) {
      throw new Error(
        'pitch skill repeatability fingerId values must be unique',
      );
    }
    repeatabilityFingerIds.add(
      finger.fingerId,
    );
    validateStdDevVec3(
      'finger contactDirectionStdDev',
      finger.contactDirectionStdDev,
    );
    validateStdDevVec3(
      'finger impulseStdDevNs',
      finger.impulseStdDevNs,
    );
  }
};

const createNormalSampler = (
  nextFloat: () => number,
): (() => number) => {
  let spare: number | null = null;

  return (): number => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }

    const u1 = Math.max(
      Number.EPSILON,
      nextFloat(),
    );
    const u2 = nextFloat();
    const radius = Math.sqrt(
      -2 * Math.log(u1),
    );
    const angle = 2 * Math.PI * u2;
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
};

const sampleVec3Delta = (
  stdDev: Vec3,
  normal: () => number,
): Vec3 => ({
  x: stdDev.x * normal(),
  y: stdDev.y * normal(),
  z: stdDev.z * normal(),
});

const applyOrientationDelta = (
  orientation: Quaternion,
  deltaRad: Vec3,
): Quaternion => {
  const qx = quaternionFromAxisAngle(
    { x: 1, y: 0, z: 0 },
    deltaRad.x,
  );
  const qy = quaternionFromAxisAngle(
    { x: 0, y: 1, z: 0 },
    deltaRad.y,
  );
  const qz = quaternionFromAxisAngle(
    { x: 0, y: 0, z: 1 },
    deltaRad.z,
  );

  return normalizeQuaternion(
    multiplyQuaternions(
      qz,
      multiplyQuaternions(
        qy,
        multiplyQuaternions(
          qx,
          normalizeQuaternion(orientation),
        ),
      ),
    ),
  );
};

export const createPitcherPitchSkillProfile = (
  pitcherId: string,
  skills: readonly PitchSkillProfile[],
): PitcherPitchSkillProfile => {
  if (pitcherId.length === 0) {
    throw new Error(
      'pitcherId must not be empty',
    );
  }
  const ids = new Set<string>();
  for (const skill of skills) {
    validateProfile(skill);
    if (ids.has(skill.pitchSkillId)) {
      throw new Error(
        'pitchSkillId values must be unique per pitcher',
      );
    }
    ids.add(skill.pitchSkillId);
  }

  return {
    pitcherId,
    skills: [...skills],
  };
};

export const samplePitchSkillRelease = (
  pitcherId: string,
  profile: PitchSkillProfile,
  context: PitchSkillSamplingContext,
): SampledPitchSkillRelease => {
  if (pitcherId.length === 0) {
    throw new Error(
      'pitcherId must not be empty',
    );
  }
  validateProfile(profile);
  if (
    !Number.isSafeInteger(context.playId)
    || context.playId < 0
    || !Number.isSafeInteger(context.pitchOrdinal)
    || context.pitchOrdinal < 0
    || !Number.isSafeInteger(context.tick)
    || context.tick < 0
  ) {
    throw new Error(
      'pitch skill playId, pitchOrdinal, and tick must be non-negative safe integers',
    );
  }
  validateFiniteVec3(
    'releaseAnchorPosition',
    context.releaseAnchorPosition,
  );

  const rng = new SeedRoot(
    context.matchSeed,
  ).streamRng(
    context.playId,
    'pitch',
    `pitch-skill:${pitcherId}:${profile.pitchSkillId}:ordinal:${context.pitchOrdinal}`,
  );
  const normal = createNormalSampler(
    () => rng.nextFloat(),
  );

  const releasePositionDelta =
    sampleVec3Delta(
      profile.repeatability.releasePositionStdDevM,
      normal,
    );
  const velocityDelta =
    sampleVec3Delta(
      profile.repeatability.preReleaseVelocityStdDevMps,
      normal,
    );
  const spinDelta =
    sampleVec3Delta(
      profile.repeatability.preReleaseSpinStdDevRadPerSecond,
      normal,
    );
  const orientationDelta =
    sampleVec3Delta(
      profile.repeatability.orientationStdDevRad,
      normal,
    );

  const repeatabilityByFinger =
    new Map(
      profile.repeatability.fingers.map(
        (entry) => [
          entry.fingerId,
          entry,
        ] as const,
      ),
    );

  const fingerImpulseDeltas: {
    fingerId: string;
    delta: Vec3;
  }[] = [];
  const fingerContactDeltas: {
    fingerId: string;
    delta: Vec3;
  }[] = [];

  const fingerImpulses =
    profile.releaseTemplate.fingerImpulses.map(
      (finger): PitchFingerImpulse => {
        const repeatability =
          repeatabilityByFinger.get(
            finger.fingerId,
          );
        const contactDelta =
          repeatability === undefined
            ? { x: 0, y: 0, z: 0 }
            : sampleVec3Delta(
                repeatability.contactDirectionStdDev,
                normal,
              );
        const impulseDelta =
          repeatability === undefined
            ? { x: 0, y: 0, z: 0 }
            : sampleVec3Delta(
                repeatability.impulseStdDevNs,
                normal,
              );

        fingerContactDeltas.push({
          fingerId: finger.fingerId,
          delta: contactDelta,
        });
        fingerImpulseDeltas.push({
          fingerId: finger.fingerId,
          delta: impulseDelta,
        });

        return {
          fingerId: finger.fingerId,
          contactDirectionBody: normalize(
            add(
              finger.contactDirectionBody,
              contactDelta,
            ),
          ),
          impulseWorldNs: add(
            finger.impulseWorldNs,
            impulseDelta,
          ),
        };
      },
    );

  const release: PitchReleaseMechanicsInput = {
    tick: context.tick,
    position: add(
      context.releaseAnchorPosition,
      add(
        profile.releaseTemplate.releasePositionOffsetM,
        releasePositionDelta,
      ),
    ),
    preReleaseVelocity: add(
      profile.releaseTemplate.preReleaseVelocityMps,
      velocityDelta,
    ),
    preReleaseSpin: add(
      profile.releaseTemplate.preReleaseSpinRadPerSecond,
      spinDelta,
    ),
    orientation: applyOrientationDelta(
      profile.releaseTemplate.orientation,
      orientationDelta,
    ),
    ball: context.ball,
    fingerImpulses,
  };

  return {
    pitcherId,
    pitchSkillId: profile.pitchSkillId,
    release,
    deltas: {
      releasePositionM:
        releasePositionDelta,
      preReleaseVelocityMps:
        velocityDelta,
      preReleaseSpinRadPerSecond:
        spinDelta,
      orientationRad:
        orientationDelta,
      fingerImpulsesNs:
        fingerImpulseDeltas,
      fingerContactDirections:
        fingerContactDeltas,
    },
  };
};
