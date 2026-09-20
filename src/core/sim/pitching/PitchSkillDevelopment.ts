import type { Vec3 } from '../../model/geometry';
import {
  normalizeQuaternion,
  type Quaternion,
} from './BaseballOrientation';
import type {
  PitchFingerImpulse,
} from './PitchReleaseMechanics';
import type {
  PitchSkillFingerRepeatability,
  PitchSkillProfile,
} from './PitchSkillProfile';

const lerp = (
  from: number,
  to: number,
  rate: number,
): number => from + (to - from) * rate;

const lerpVec3 = (
  from: Vec3,
  to: Vec3,
  rate: number,
): Vec3 => ({
  x: lerp(from.x, to.x, rate),
  y: lerp(from.y, to.y, rate),
  z: lerp(from.z, to.z, rate),
});

const dotQuaternion = (
  a: Quaternion,
  b: Quaternion,
): number => (
  a.w * b.w
  + a.x * b.x
  + a.y * b.y
  + a.z * b.z
);

const blendQuaternion = (
  from: Quaternion,
  to: Quaternion,
  rate: number,
): Quaternion => {
  const a = normalizeQuaternion(from);
  const b0 = normalizeQuaternion(to);
  const sign =
    dotQuaternion(a, b0) < 0
      ? -1
      : 1;
  const b: Quaternion = {
    w: b0.w * sign,
    x: b0.x * sign,
    y: b0.y * sign,
    z: b0.z * sign,
  };

  return normalizeQuaternion({
    w: lerp(a.w, b.w, rate),
    x: lerp(a.x, b.x, rate),
    y: lerp(a.y, b.y, rate),
    z: lerp(a.z, b.z, rate),
  });
};

const validateRate = (
  rate: number,
): void => {
  if (
    !Number.isFinite(rate)
    || rate < 0
    || rate > 1
  ) {
    throw new Error(
      'pitch skill adaptationRate must be finite within [0, 1]',
    );
  }
};

const indexByFingerId = <
  T extends Readonly<{ fingerId: string }>,
>(
  values: readonly T[],
): Map<string, T> => new Map(
  values.map(
    (value) => [
      value.fingerId,
      value,
    ] as const,
  ),
);

const assertSameFingerIds = <
  T extends Readonly<{ fingerId: string }>,
>(
  current: readonly T[],
  target: readonly T[],
  label: string,
): void => {
  const currentIds = current
    .map((value) => value.fingerId)
    .sort();
  const targetIds = target
    .map((value) => value.fingerId)
    .sort();

  if (
    currentIds.length !== targetIds.length
    || currentIds.some(
      (id, index) =>
        id !== targetIds[index],
    )
  ) {
    throw new Error(
      `${label} must use the same fingerId set`,
    );
  }
};

const blendFingerImpulses = (
  current: readonly PitchFingerImpulse[],
  target: readonly PitchFingerImpulse[],
  rate: number,
): readonly PitchFingerImpulse[] => {
  assertSameFingerIds(
    current,
    target,
    'pitch skill release templates',
  );
  const targetById =
    indexByFingerId(target);

  return current.map((finger) => {
    const goal =
      targetById.get(finger.fingerId)!;
    return {
      fingerId: finger.fingerId,
      contactDirectionBody:
        lerpVec3(
          finger.contactDirectionBody,
          goal.contactDirectionBody,
          rate,
        ),
      impulseWorldNs:
        lerpVec3(
          finger.impulseWorldNs,
          goal.impulseWorldNs,
          rate,
        ),
    };
  });
};

const blendFingerRepeatability = (
  current: readonly PitchSkillFingerRepeatability[],
  target: readonly PitchSkillFingerRepeatability[],
  rate: number,
): readonly PitchSkillFingerRepeatability[] => {
  assertSameFingerIds(
    current,
    target,
    'pitch skill repeatability profiles',
  );
  const targetById =
    indexByFingerId(target);

  return current.map((finger) => {
    const goal =
      targetById.get(finger.fingerId)!;
    return {
      fingerId: finger.fingerId,
      contactDirectionStdDev:
        lerpVec3(
          finger.contactDirectionStdDev,
          goal.contactDirectionStdDev,
          rate,
        ),
      impulseStdDevNs:
        lerpVec3(
          finger.impulseStdDevNs,
          goal.impulseStdDevNs,
          rate,
        ),
    };
  });
};

/**
 * Moves one learned pitch skill toward another physical release target while
 * keeping the stable pitchSkillId. This function does not decide *why* the
 * pitcher improves or how large the adaptation rate should be; those belong
 * to a future training/development model.
 *
 * Human-readable pitch names are intentionally absent.
 */
export const adaptPitchSkillTowardPhysicalTarget = (
  current: PitchSkillProfile,
  target: PitchSkillProfile,
  adaptationRate: number,
): PitchSkillProfile => {
  validateRate(adaptationRate);
  if (
    current.pitchSkillId
    !== target.pitchSkillId
  ) {
    throw new Error(
      'pitch skill development target must preserve pitchSkillId',
    );
  }

  return {
    pitchSkillId: current.pitchSkillId,
    releaseTemplate: {
      releasePositionOffsetM:
        lerpVec3(
          current.releaseTemplate
            .releasePositionOffsetM,
          target.releaseTemplate
            .releasePositionOffsetM,
          adaptationRate,
        ),
      preReleaseVelocityMps:
        lerpVec3(
          current.releaseTemplate
            .preReleaseVelocityMps,
          target.releaseTemplate
            .preReleaseVelocityMps,
          adaptationRate,
        ),
      preReleaseSpinRadPerSecond:
        lerpVec3(
          current.releaseTemplate
            .preReleaseSpinRadPerSecond,
          target.releaseTemplate
            .preReleaseSpinRadPerSecond,
          adaptationRate,
        ),
      orientation:
        blendQuaternion(
          current.releaseTemplate
            .orientation,
          target.releaseTemplate
            .orientation,
          adaptationRate,
        ),
      fingerImpulses:
        blendFingerImpulses(
          current.releaseTemplate
            .fingerImpulses,
          target.releaseTemplate
            .fingerImpulses,
          adaptationRate,
        ),
    },
    repeatability: {
      releasePositionStdDevM:
        lerpVec3(
          current.repeatability
            .releasePositionStdDevM,
          target.repeatability
            .releasePositionStdDevM,
          adaptationRate,
        ),
      preReleaseVelocityStdDevMps:
        lerpVec3(
          current.repeatability
            .preReleaseVelocityStdDevMps,
          target.repeatability
            .preReleaseVelocityStdDevMps,
          adaptationRate,
        ),
      preReleaseSpinStdDevRadPerSecond:
        lerpVec3(
          current.repeatability
            .preReleaseSpinStdDevRadPerSecond,
          target.repeatability
            .preReleaseSpinStdDevRadPerSecond,
          adaptationRate,
        ),
      orientationStdDevRad:
        lerpVec3(
          current.repeatability
            .orientationStdDevRad,
          target.repeatability
            .orientationStdDevRad,
          adaptationRate,
        ),
      fingers:
        blendFingerRepeatability(
          current.repeatability.fingers,
          target.repeatability.fingers,
          adaptationRate,
        ),
    },
  };
};
