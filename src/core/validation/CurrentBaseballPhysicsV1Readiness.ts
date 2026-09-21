import {
  BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
} from '../sim/ball/BaseballPhysicsV1';
import {
  evaluatePublishedCoefficientRegressionCorpus,
} from './PublishedBaseballPhysicsValidationCorpus';
import {
  evaluateBaseballPhysicsProductionReadiness,
  type BaseballPhysicsProductionReadiness,
} from './BaseballPhysicsProductionReadiness';
import {
  createCurrentBaseballPhysicsV1GateEvidence,
} from './CurrentBaseballPhysicsV1Closure';

/**
 * Snapshot of whether the current repository evidence is sufficient to
 * promote the realistic v1 paths to production defaults.
 *
 * This function intentionally answers "no" while any empirical calibration
 * gate remains open, even when the published coefficient regression corpus is
 * green.
 */
export const evaluateCurrentBaseballPhysicsV1Readiness =
  (): BaseballPhysicsProductionReadiness => (
    evaluateBaseballPhysicsProductionReadiness({
      architectureVersion:
        BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
      calibrationGates:
        createCurrentBaseballPhysicsV1GateEvidence(),
      validationCorpus:
        evaluatePublishedCoefficientRegressionCorpus(),
      acceptExplicitScopeOut: false,
    })
  );
