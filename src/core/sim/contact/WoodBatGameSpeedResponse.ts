import {
  KENSRUD_2016_GAME_SPEED_CONTEXT,
  findKensrud2016TangentialReference,
} from './Kensrud2016TangentialCalibration';
import type {
  PitchWorldState,
} from './BatBallContact';
import {
  resolveRigidBatBallContactWithParameterResolver,
  type RigidBaseballProperties,
  type RigidBatBallContactParameters,
  type RigidBatBallContactResult,
  type RigidBatState,
} from './RigidBatBallContact';

export const WOOD_BAT_GAME_SPEED_RESPONSE_VERSION =
  'wood-bat-game-speed-response-v2' as const;

export const WOOD_BAT_BBCOR_SPEED_POWER_EXPONENT =
  -1 / 6 as const;

export const WOOD_BAT_BBCOR_REFERENCE =
  Object.freeze({
    relativeImpactSpeedMps: 60.8,
    normalRestitution: 0.452,
    uncertainty: 0.005,
    source:
      'Nathan et al. 2011 wood-bat BBCOR anchor; high-speed v^-1/6 scaling reported in later impact-speed studies',
  } as const);

export const WOOD_BAT_GAME_SPEED_MIN_MPS =
  33 as const;
export const WOOD_BAT_GAME_SPEED_MAX_MPS =
  67 as const;

/**
 * Evidence-informed high-speed normal restitution law.
 *
 * The v^(-1/6) dependence is only used inside the published high-speed test
 * regime (33-67 m/s). Outside that range the result clamps; it is not
 * extrapolated into low-speed Cross/Nathan fixtures.
 */
export const resolveWoodBatGameSpeedNormalRestitution = (
  relativeImpactSpeedMps: number,
): number => {
  if (
    !Number.isFinite(
      relativeImpactSpeedMps,
    )
    || relativeImpactSpeedMps < 0
  ) {
    throw new Error(
      'wood-bat game-speed impact speed must be finite and non-negative',
    );
  }

  const speed = Math.max(
    WOOD_BAT_GAME_SPEED_MIN_MPS,
    Math.min(
      WOOD_BAT_GAME_SPEED_MAX_MPS,
      relativeImpactSpeedMps,
    ),
  );

  return (
    WOOD_BAT_BBCOR_REFERENCE
      .normalRestitution
    * Math.pow(
      speed
      / WOOD_BAT_BBCOR_REFERENCE
        .relativeImpactSpeedMps,
      WOOD_BAT_BBCOR_SPEED_POWER_EXPONENT,
    )
  );
};

export type WoodBatGameSpeedContactCandidateInput =
  Readonly<{
    relativeImpactSpeedMps: number;
    frictionCoefficient?: number;
  }>;

export const createWoodBatGameSpeedContactCandidate = (
  input:
    WoodBatGameSpeedContactCandidateInput,
): RigidBatBallContactParameters => {
  const frictionCoefficient =
    input.frictionCoefficient
    ?? KENSRUD_2016_GAME_SPEED_CONTEXT
      .frictionCoefficientLowerBound;

  if (
    !Number.isFinite(
      frictionCoefficient,
    )
    || frictionCoefficient
      < KENSRUD_2016_GAME_SPEED_CONTEXT
        .frictionCoefficientLowerBound
  ) {
    throw new Error(
      'game-speed wood-bat friction must satisfy measured lower bound',
    );
  }

  return {
    normalRestitution:
      resolveWoodBatGameSpeedNormalRestitution(
        input.relativeImpactSpeedMps,
      ),
    tangentialRestitution:
      findKensrud2016TangentialReference(
        'wood',
      ).tangentialRestitution,
    frictionCoefficient,
  };
};


export const resolveWoodBatGameSpeedBallContact = (
  pitch: PitchWorldState,
  bat: RigidBatState,
  ball: RigidBaseballProperties,
  frictionCoefficient:
    number =
      KENSRUD_2016_GAME_SPEED_CONTEXT
        .frictionCoefficientLowerBound,
): RigidBatBallContactResult | null => (
  resolveRigidBatBallContactWithParameterResolver(
    pitch,
    bat,
    ball,
    (kinematics) =>
      createWoodBatGameSpeedContactCandidate({
        relativeImpactSpeedMps:
          kinematics.normalApproachSpeedMps,
        frictionCoefficient,
      }),
  )
);
