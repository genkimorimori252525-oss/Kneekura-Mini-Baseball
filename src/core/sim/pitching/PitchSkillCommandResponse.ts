import type { Vec3 } from '../../model/geometry';
import type {
  PitcherAggression,
  PitcherAttackZone,
  PitcherVerticalPlan,
} from '../plateAppearance/PlateAppearanceCommand';
import {
  multiplyQuaternions,
  normalizeQuaternion,
  quaternionFromAxisAngle,
} from './BaseballOrientation';
import type {
  CatcherPitchCall,
} from './CatcherLead';
import type {
  PitchSkillProfile,
} from './PitchSkillProfile';

export type PitchSkillFingerAdjustment = Readonly<{
  fingerId: string;
  contactDirectionDelta?: Vec3;
  impulseDeltaNs?: Vec3;
}>;

export type PitchSkillPhysicalAdjustment = Readonly<{
  releasePositionOffsetDeltaM?: Vec3;
  preReleaseVelocityDeltaMps?: Vec3;
  preReleaseSpinDeltaRadPerSecond?: Vec3;
  orientationDeltaRad?: Vec3;
  fingers?: readonly PitchSkillFingerAdjustment[];
}>;

export type PitchSkillCommandResponseProfile = Readonly<{
  pitchSkillId: string;
  attackZone: Readonly<
    Record<PitcherAttackZone, PitchSkillPhysicalAdjustment>
  >;
  verticalPlan: Readonly<
    Record<PitcherVerticalPlan, PitchSkillPhysicalAdjustment>
  >;
  aggression: Readonly<
    Record<PitcherAggression, PitchSkillPhysicalAdjustment>
  >;
}>;

const ZERO: Vec3 = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
});

const add = (
  a: Vec3,
  b: Vec3,
): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

const finiteVec = (
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

const rotateOrientation = (
  orientation:
    PitchSkillProfile['releaseTemplate']['orientation'],
  delta: Vec3,
) => {
  const qx = quaternionFromAxisAngle(
    { x: 1, y: 0, z: 0 },
    delta.x,
  );
  const qy = quaternionFromAxisAngle(
    { x: 0, y: 1, z: 0 },
    delta.y,
  );
  const qz = quaternionFromAxisAngle(
    { x: 0, y: 0, z: 1 },
    delta.z,
  );

  return normalizeQuaternion(
    multiplyQuaternions(
      qz,
      multiplyQuaternions(
        qy,
        multiplyQuaternions(
          qx,
          normalizeQuaternion(
            orientation,
          ),
        ),
      ),
    ),
  );
};

const mergeAdjustments = (
  adjustments:
    readonly PitchSkillPhysicalAdjustment[],
): PitchSkillPhysicalAdjustment => {
  let releasePositionOffsetDeltaM =
    ZERO;
  let preReleaseVelocityDeltaMps =
    ZERO;
  let preReleaseSpinDeltaRadPerSecond =
    ZERO;
  let orientationDeltaRad =
    ZERO;
  const fingers =
    new Map<
      string,
      {
        contactDirectionDelta: Vec3;
        impulseDeltaNs: Vec3;
      }
    >();

  for (const adjustment of adjustments) {
    if (
      adjustment.releasePositionOffsetDeltaM
      !== undefined
    ) {
      finiteVec(
        'releasePositionOffsetDeltaM',
        adjustment.releasePositionOffsetDeltaM,
      );
      releasePositionOffsetDeltaM =
        add(
          releasePositionOffsetDeltaM,
          adjustment.releasePositionOffsetDeltaM,
        );
    }
    if (
      adjustment.preReleaseVelocityDeltaMps
      !== undefined
    ) {
      finiteVec(
        'preReleaseVelocityDeltaMps',
        adjustment.preReleaseVelocityDeltaMps,
      );
      preReleaseVelocityDeltaMps =
        add(
          preReleaseVelocityDeltaMps,
          adjustment.preReleaseVelocityDeltaMps,
        );
    }
    if (
      adjustment.preReleaseSpinDeltaRadPerSecond
      !== undefined
    ) {
      finiteVec(
        'preReleaseSpinDeltaRadPerSecond',
        adjustment.preReleaseSpinDeltaRadPerSecond,
      );
      preReleaseSpinDeltaRadPerSecond =
        add(
          preReleaseSpinDeltaRadPerSecond,
          adjustment.preReleaseSpinDeltaRadPerSecond,
        );
    }
    if (
      adjustment.orientationDeltaRad
      !== undefined
    ) {
      finiteVec(
        'orientationDeltaRad',
        adjustment.orientationDeltaRad,
      );
      orientationDeltaRad =
        add(
          orientationDeltaRad,
          adjustment.orientationDeltaRad,
        );
    }

    for (
      const finger
      of adjustment.fingers ?? []
    ) {
      if (finger.fingerId.length === 0) {
        throw new Error(
          'pitch skill command fingerId must not be empty',
        );
      }
      const current =
        fingers.get(finger.fingerId)
        ?? {
          contactDirectionDelta: ZERO,
          impulseDeltaNs: ZERO,
        };

      if (
        finger.contactDirectionDelta
        !== undefined
      ) {
        finiteVec(
          'contactDirectionDelta',
          finger.contactDirectionDelta,
        );
        current.contactDirectionDelta =
          add(
            current.contactDirectionDelta,
            finger.contactDirectionDelta,
          );
      }
      if (
        finger.impulseDeltaNs
        !== undefined
      ) {
        finiteVec(
          'impulseDeltaNs',
          finger.impulseDeltaNs,
        );
        current.impulseDeltaNs =
          add(
            current.impulseDeltaNs,
            finger.impulseDeltaNs,
          );
      }
      fingers.set(
        finger.fingerId,
        current,
      );
    }
  }

  return {
    releasePositionOffsetDeltaM,
    preReleaseVelocityDeltaMps,
    preReleaseSpinDeltaRadPerSecond,
    orientationDeltaRad,
    fingers: [
      ...fingers.entries(),
    ].map(
      ([
        fingerId,
        adjustment,
      ]) => ({
        fingerId,
        ...adjustment,
      }),
    ),
  };
};

/**
 * Converts a catcher's coarse call into a pitcher-specific *motor-plan*
 * adjustment in physical release space.
 *
 * The call does not target an exact final coordinate and does not change the
 * pitch's human-readable name. Execution error is still applied later by
 * PitchSkillProfile repeatability sampling.
 */
export const applyCatcherCallToPitchSkill = (
  skill: PitchSkillProfile,
  response:
    PitchSkillCommandResponseProfile,
  call: CatcherPitchCall,
): PitchSkillProfile => {
  if (
    skill.pitchSkillId
    !== call.pitchSkillId
    || response.pitchSkillId
      !== call.pitchSkillId
  ) {
    throw new Error(
      'catcher call, pitch skill, and command response must share pitchSkillId',
    );
  }

  const combined =
    mergeAdjustments([
      response.attackZone[
        call.attackZone
      ],
      response.verticalPlan[
        call.verticalPlan
      ],
      response.aggression[
        call.aggression
      ],
    ]);

  const fingerAdjustments =
    new Map(
      (combined.fingers ?? [])
        .map(
          (finger) => [
            finger.fingerId,
            finger,
          ] as const,
        ),
    );

  const fingerIds =
    new Set(
      skill.releaseTemplate
        .fingerImpulses
        .map(
          (finger) =>
            finger.fingerId,
        ),
    );
  for (
    const fingerId
    of fingerAdjustments.keys()
  ) {
    if (!fingerIds.has(fingerId)) {
      throw new Error(
        'pitch skill command response fingerId must exist in release template',
      );
    }
  }

  return {
    ...skill,
    releaseTemplate: {
      releasePositionOffsetM:
        add(
          skill.releaseTemplate
            .releasePositionOffsetM,
          combined
            .releasePositionOffsetDeltaM
            ?? ZERO,
        ),
      preReleaseVelocityMps:
        add(
          skill.releaseTemplate
            .preReleaseVelocityMps,
          combined
            .preReleaseVelocityDeltaMps
            ?? ZERO,
        ),
      preReleaseSpinRadPerSecond:
        add(
          skill.releaseTemplate
            .preReleaseSpinRadPerSecond,
          combined
            .preReleaseSpinDeltaRadPerSecond
            ?? ZERO,
        ),
      orientation:
        rotateOrientation(
          skill.releaseTemplate
            .orientation,
          combined.orientationDeltaRad
            ?? ZERO,
        ),
      fingerImpulses:
        skill.releaseTemplate
          .fingerImpulses
          .map((finger) => {
            const adjustment =
              fingerAdjustments.get(
                finger.fingerId,
              );
            return {
              ...finger,
              contactDirectionBody:
                add(
                  finger
                    .contactDirectionBody,
                  adjustment
                    ?.contactDirectionDelta
                    ?? ZERO,
                ),
              impulseWorldNs:
                add(
                  finger.impulseWorldNs,
                  adjustment
                    ?.impulseDeltaNs
                    ?? ZERO,
                ),
            };
          }),
    },
  };
};
