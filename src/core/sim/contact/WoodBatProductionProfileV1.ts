import {
  NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT,
  NATHAN_2012_OBLIQUE_WOOD_EVIDENCE,
} from './HighSpeedObliqueBatCalibration';
import type {
  WoodBatSpeedResponseProfile,
} from './WoodBatSpeedResponseProfile';

const MPH_TO_MPS = 0.44704;

/**
 * Frozen v1 local-contact response for a wooden impact surface.
 *
 * Nathan et al. (2012) fitted one non-gross-slip parameter set to 47 impacts
 * from the same rigidly mounted three-inch wood-cylinder fixture. The two
 * speed knots below do NOT claim that COR was independently measured at each
 * endpoint. They encode the documented tested speed envelope for the single
 * fitted e_y=0.52 response so callers clamp rather than extrapolate a
 * cross-study curve.
 *
 * Finite bat mass, inertia, recoil, impact location and surface velocity remain
 * the responsibility of RigidBatBallContact. This profile is only the local
 * reduced-order contact response.
 */
export const NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1:
  WoodBatSpeedResponseProfile = Object.freeze({
    profileId:
      'nathan-2012-rigid-wood-local-contact',
    version:
      'nathan-2012-47-impact-fit-v1',
    normalRestitutionKnots: Object.freeze([
      {
        relativeImpactSpeedMps:
          85 * MPH_TO_MPS,
        normalRestitution:
          NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT
            .normalRestitution,
      },
      {
        relativeImpactSpeedMps:
          120 * MPH_TO_MPS,
        normalRestitution:
          NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT
            .normalRestitution,
      },
    ]),
    tangentialRestitution:
      NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT
        .tangentialRestitution,
    frictionCoefficient:
      NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT
        .frictionCoefficient,
    evidenceIds: Object.freeze([
      'nathan-2012-spin-of-a-batted-baseball',
      'nathan-2012-rigid-three-inch-wood-cylinder-47-impact-fit',
    ]),
  });

export const NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_SCOPE =
  Object.freeze({
    minimumDocumentedIncidentSpeedMph: 85,
    maximumDocumentedIncidentSpeedMph:
      NATHAN_2012_OBLIQUE_WOOD_EVIDENCE
        .maximumIncidentSpeedMph,
    fittedNonGrossSlipImpactCount: 47,
    fixture:
      'rigidly-mounted-three-inch-wood-cylinder',
    finiteBatDynamics:
      'handled-by-rigid-bat-ball-contact',
  } as const);
