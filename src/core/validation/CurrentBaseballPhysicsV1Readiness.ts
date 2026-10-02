import {
  BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
} from '../sim/ball/BaseballPhysicsV1';
import {
  evaluateBaseballPhysicsV1ReleaseValidationCorpus,
} from './BaseballPhysicsV1ReleaseValidationCorpus';
import {
  evaluateBaseballPhysicsProductionReadiness,
  type BaseballPhysicsCalibrationGateEvidence,
  type BaseballPhysicsCalibrationGateId,
  type BaseballPhysicsProductionReadiness,
} from './BaseballPhysicsProductionReadiness';
import {
  createCurrentBaseballPhysicsV1GateEvidence,
} from './CurrentBaseballPhysicsV1Closure';

/**
 * Explicit production acknowledgement for the empirical boundaries that v1
 * refuses to universalize. This list is intentionally exact: adding a new
 * scope-out to the ledger cannot silently inherit this approval.
 */
export const BASEBALL_PHYSICS_V1_ACCEPTED_SCOPE_OUT_GATES:
  readonly BaseballPhysicsCalibrationGateId[] =
  Object.freeze([
    'infield_dirt_material_profile',
    'natural_grass_material_profile',
    'artificial_turf_material_profile',
    'warning_track_material_profile',
    'wall_padding_material_profile',
    'sliding_friction_calibration',
    'rolling_resistance_calibration',
  ]);

const assertAcceptedScopeOutSet = (
  gates:
    readonly BaseballPhysicsCalibrationGateEvidence[],
): void => {
  const actual = gates
    .filter(
      (entry) =>
        entry.state
        === 'explicitly_scoped_out',
    )
    .map((entry) => entry.gateId);

  if (
    actual.length
      !== BASEBALL_PHYSICS_V1_ACCEPTED_SCOPE_OUT_GATES
        .length
    || actual.some(
      (gateId, index) =>
        gateId
        !== BASEBALL_PHYSICS_V1_ACCEPTED_SCOPE_OUT_GATES[
          index
        ],
    )
  ) {
    throw new Error(
      'current baseball physics v1 scope-out set differs from the explicit production acknowledgement',
    );
  }
};

/**
 * Mechanical release-readiness snapshot for the frozen v1 physics graph.
 *
 * The source-level regression corpus and integrated end-to-end corpus are both
 * required. Explicitly scoped-out field-material coefficients count as closed
 * only because the exact list above is acknowledged here; a new omission
 * therefore re-closes promotion automatically.
 */
export const evaluateCurrentBaseballPhysicsV1Readiness =
  (): BaseballPhysicsProductionReadiness => {
    const calibrationGates =
      createCurrentBaseballPhysicsV1GateEvidence();

    assertAcceptedScopeOutSet(
      calibrationGates,
    );

    return evaluateBaseballPhysicsProductionReadiness({
      architectureVersion:
        BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
      calibrationGates,
      validationCorpus:
        evaluateBaseballPhysicsV1ReleaseValidationCorpus(),
      acceptExplicitScopeOut: true,
    });
  };
