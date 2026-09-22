import type {
  BallSurfaceContactParameters,
} from '../ball/BallSurfaceContact';

export const NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT:
  BallSurfaceContactParameters = Object.freeze({
    normalRestitution: 0.52,
    tangentialRestitution: 0.30,
    frictionCoefficient: 0.15,
  });

export const NATHAN_2012_TANGENTIAL_COR_UNCERTAINTY =
  0.02 as const;

/**
 * Fitted high-speed fixed-wood-cylinder result from Nathan et al. (2012):
 * - non-gross-slip normal COR ey = 0.52
 * - tangential COR ex = 0.30 +/- 0.02
 * - gross-slip Coulomb friction coefficient ~= 0.15
 *
 * The experiment reached incident speeds up to 120 mph. This is a local
 * contact-response calibration, not a complete free-bat recoil model.
 */
export const NATHAN_2012_OBLIQUE_WOOD_EVIDENCE =
  Object.freeze({
    maximumIncidentSpeedMph: 120,
    nonSlipNormalRestitution: 0.52,
    nonSlipTangentialRestitution: 0.30,
    tangentialRestitutionUncertainty: 0.02,
    grossSlipFrictionCoefficient: 0.15,
    grossSlipOnsetAngleDegreesApprox: 40,
    source:
      'Nathan et al. 2012, Spin of a batted baseball',
  } as const);
