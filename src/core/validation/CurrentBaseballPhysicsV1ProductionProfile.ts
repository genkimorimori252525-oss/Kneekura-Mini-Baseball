import {
  BASEBALL_PHYSICS_V1_PRODUCTION_PROFILE_ID,
} from '../sim/ball/BaseballPhysicsV1';
import {
  createBaseballRealityProfileV1,
  type BaseballRealityProfileV1,
  type BaseballRealityProfileV1Input,
} from '../sim/ball/BaseballRealityProfileV1';
import {
  NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
} from '../sim/contact/WoodBatProductionProfileV1';
import {
  evaluateCurrentBaseballPhysicsV1Readiness,
} from './CurrentBaseballPhysicsV1Readiness';

export const CURRENT_BASEBALL_PHYSICS_V1_PRODUCTION_PROFILE_ID =
  BASEBALL_PHYSICS_V1_PRODUCTION_PROFILE_ID;

export type CurrentBaseballPhysicsV1ProductionProfileInput =
  Omit<
    BaseballRealityProfileV1Input,
    'woodBat'
  >;

/**
 * Production entry point for the frozen v1 physics architecture.
 *
 * Evidence-backed global pieces are selected here. Ballpark-specific surfaces
 * remain mandatory input because their universal coefficients are explicitly
 * scoped out rather than fabricated. The constructor is guarded by the same
 * mechanical readiness snapshot used by release verification.
 */
export const createCurrentBaseballPhysicsV1ProductionProfile = (
  input:
    CurrentBaseballPhysicsV1ProductionProfileInput,
): BaseballRealityProfileV1 => {
  const readiness =
    evaluateCurrentBaseballPhysicsV1Readiness();

  if (!readiness.readyForDefaultPromotion) {
    throw new Error(
      'baseball physics v1 production profile requested before readiness gate is green',
    );
  }

  return createBaseballRealityProfileV1({
    ...input,
    woodBat:
      NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
  });
};
