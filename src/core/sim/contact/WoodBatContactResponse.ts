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
import {
  findKensrud2016TangentialReference,
  KENSRUD_2016_GAME_SPEED_CONTEXT,
} from './Kensrud2016TangentialCalibration';
import {
  WOOD_BAT_NORMAL_RESTITUTION_CALIBRATION_TARGETS,
  validateWoodBatRestitutionCalibrationTargets,
} from './WoodBatRestitutionCalibration';

export const WOOD_BAT_CONTACT_RESPONSE_CANDIDATE_VERSION =
  'wood-bat-contact-evidence-synthesis-v1' as const;

const lerp = (
  a: number,
  b: number,
  t: number,
): number => (
  a + (b - a) * t
);

/**
 * Piecewise-linear normal-COR interpolation between explicit wood-bat evidence
 * anchors. Values outside the evidence range clamp rather than extrapolate.
 *
 * This is a calibration candidate, not a claim that real COR is globally
 * linear in impact speed.
 */
export const resolveWoodBatNormalRestitution = (
  relativeImpactSpeedMps: number,
): number => {
  validateWoodBatRestitutionCalibrationTargets(
    WOOD_BAT_NORMAL_RESTITUTION_CALIBRATION_TARGETS,
  );
  if (
    !Number.isFinite(
      relativeImpactSpeedMps,
    )
    || relativeImpactSpeedMps < 0
  ) {
    throw new Error(
      'wood-bat relativeImpactSpeedMps must be finite and non-negative',
    );
  }

  const targets =
    WOOD_BAT_NORMAL_RESTITUTION_CALIBRATION_TARGETS;
  const first = targets[0]!;
  if (
    relativeImpactSpeedMps
    <= first.relativeImpactSpeedMps
  ) {
    return first.normalRestitution;
  }

  const last =
    targets[targets.length - 1]!;
  if (
    relativeImpactSpeedMps
    >= last.relativeImpactSpeedMps
  ) {
    return last.normalRestitution;
  }

  for (
    let index = 1;
    index < targets.length;
    index += 1
  ) {
    const right = targets[index]!;
    if (
      relativeImpactSpeedMps
      > right.relativeImpactSpeedMps
    ) {
      continue;
    }

    const left =
      targets[index - 1]!;
    const t =
      (
        relativeImpactSpeedMps
        - left.relativeImpactSpeedMps
      ) / (
        right.relativeImpactSpeedMps
        - left.relativeImpactSpeedMps
      );

    return lerp(
      left.normalRestitution,
      right.normalRestitution,
      t,
    );
  }

  throw new Error(
    'unreachable wood-bat restitution interpolation interval',
  );
};

export type EvidenceBackedWoodBatContactInput = Readonly<{
  relativeImpactSpeedMps: number;
  /**
   * Must remain explicit because game-speed swinging-bat evidence establishes
   * only a lower bound, not a unique friction coefficient.
   */
  frictionCoefficient: number;
}>;

/**
 * Provisional game-speed wood-bat response assembled from independent
 * measurements:
 * - speed-dependent normal COR: Cross/Nathan + Nathan et al. BBCOR anchors;
 * - tangential COR: Kensrud/Nathan/Smith swinging wood-bat mean;
 * - friction: caller-supplied and constrained by the measured >= 0.15 bound.
 *
 * Keeping friction explicit prevents the evidence registry from silently
 * inventing a unique value that the experiment did not identify.
 */
export const createEvidenceBackedWoodBatContactParameters = (
  input: EvidenceBackedWoodBatContactInput,
): RigidBatBallContactParameters => {
  if (
    !Number.isFinite(
      input.frictionCoefficient,
    )
    || input.frictionCoefficient
      < KENSRUD_2016_GAME_SPEED_CONTEXT
        .frictionCoefficientLowerBound
  ) {
    throw new Error(
      'wood-bat frictionCoefficient must satisfy the game-speed experimental lower bound',
    );
  }

  const tangential =
    findKensrud2016TangentialReference(
      'wood',
    );

  return {
    normalRestitution:
      resolveWoodBatNormalRestitution(
        input.relativeImpactSpeedMps,
      ),
    tangentialRestitution:
      tangential
        .tangentialRestitution,
    frictionCoefficient:
      input.frictionCoefficient,
  };
};


export type EvidenceBackedWoodBatBallContactInput = Readonly<{
  frictionCoefficient: number;
}>;

/**
 * Opt-in contact adapter that resolves normal COR from the actual pre-impact
 * normal approach speed at the contact point. This keeps speed dependence
 * causal and local to the collision rather than selected by a batted-ball
 * result label.
 */
export const resolveEvidenceBackedWoodBatBallContact = (
  pitch: PitchWorldState,
  bat: RigidBatState,
  ball: RigidBaseballProperties,
  input: EvidenceBackedWoodBatBallContactInput,
): RigidBatBallContactResult | null => (
  resolveRigidBatBallContactWithParameterResolver(
    pitch,
    bat,
    ball,
    (kinematics) =>
      createEvidenceBackedWoodBatContactParameters({
        relativeImpactSpeedMps:
          kinematics.normalApproachSpeedMps,
        frictionCoefficient:
          input.frictionCoefficient,
      }),
  )
);
