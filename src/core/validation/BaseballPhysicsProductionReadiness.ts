import {
  BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
  BASEBALL_PHYSICS_V1_ARCHITECTURE_FROZEN,
  BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
  type BaseballPhysicsArchitectureVersion,
} from '../sim/ball/BaseballPhysicsV1';
import type {
  PhysicsValidationCorpusResult,
} from './PhysicsObservableValidation';

export type BaseballPhysicsCalibrationGateId =
  (typeof BASEBALL_PHYSICS_V1_CALIBRATION_GATES)[number];

export type BaseballPhysicsCalibrationGateState =
  | 'satisfied'
  | 'explicitly_scoped_out'
  | 'open';

export type BaseballPhysicsCalibrationGateEvidence =
  Readonly<{
    gateId:
      BaseballPhysicsCalibrationGateId;
    state:
      BaseballPhysicsCalibrationGateState;
    evidenceId: string;
    evidenceVersion: string;
  }>;

export type BaseballPhysicsProductionReadinessInput =
  Readonly<{
    architectureVersion:
      BaseballPhysicsArchitectureVersion;
    calibrationGates:
      readonly BaseballPhysicsCalibrationGateEvidence[];
    validationCorpus:
      PhysicsValidationCorpusResult;
    /**
     * A scoped-out gate can count as closed only when the promotion decision
     * explicitly acknowledges that omission.
     */
    acceptExplicitScopeOut: boolean;
  }>;

export type BaseballPhysicsProductionReadiness =
  Readonly<{
    architectureVersion:
      BaseballPhysicsArchitectureVersion;
    architectureFrozen: boolean;
    validationCorpusVersion: string;
    validationPassed: boolean;
    openGateIds:
      readonly BaseballPhysicsCalibrationGateId[];
    explicitlyScopedOutGateIds:
      readonly BaseballPhysicsCalibrationGateId[];
    readyForDefaultPromotion: boolean;
  }>;

export const evaluateBaseballPhysicsProductionReadiness = (
  input: BaseballPhysicsProductionReadinessInput,
): BaseballPhysicsProductionReadiness => {
  if (
    input.architectureVersion
    !== BASEBALL_PHYSICS_ARCHITECTURE_VERSION
  ) {
    throw new Error(
      'baseball physics production readiness requires the frozen v1 architecture version',
    );
  }

  const required =
    new Set<BaseballPhysicsCalibrationGateId>(
      BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
    );
  const byId =
    new Map<
      BaseballPhysicsCalibrationGateId,
      BaseballPhysicsCalibrationGateEvidence
    >();

  for (
    const gate
    of input.calibrationGates
  ) {
    if (
      !required.has(gate.gateId)
    ) {
      throw new Error(
        `unknown baseball physics calibration gate: ${gate.gateId}`,
      );
    }
    if (
      byId.has(gate.gateId)
    ) {
      throw new Error(
        'baseball physics calibration gate evidence must be unique',
      );
    }
    if (
      gate.evidenceId.length === 0
      || gate.evidenceVersion.length === 0
    ) {
      throw new Error(
        'baseball physics calibration gate evidence id/version must not be empty',
      );
    }
    byId.set(
      gate.gateId,
      gate,
    );
  }

  for (
    const gateId
    of BASEBALL_PHYSICS_V1_CALIBRATION_GATES
  ) {
    if (!byId.has(gateId)) {
      throw new Error(
        `missing baseball physics calibration gate evidence: ${gateId}`,
      );
    }
  }

  const openGateIds =
    BASEBALL_PHYSICS_V1_CALIBRATION_GATES
      .filter(
        (gateId) =>
          byId.get(gateId)!.state
          === 'open',
      );
  const explicitlyScopedOutGateIds =
    BASEBALL_PHYSICS_V1_CALIBRATION_GATES
      .filter(
        (gateId) =>
          byId.get(gateId)!.state
          === 'explicitly_scoped_out',
      );

  const scopeOutAccepted =
    input.acceptExplicitScopeOut
    || explicitlyScopedOutGateIds.length
      === 0;

  return {
    architectureVersion:
      input.architectureVersion,
    architectureFrozen:
      BASEBALL_PHYSICS_V1_ARCHITECTURE_FROZEN,
    validationCorpusVersion:
      input.validationCorpus.version,
    validationPassed:
      input.validationCorpus.passed,
    openGateIds,
    explicitlyScopedOutGateIds,
    readyForDefaultPromotion:
      BASEBALL_PHYSICS_V1_ARCHITECTURE_FROZEN
      && input.validationCorpus.passed
      && openGateIds.length === 0
      && scopeOutAccepted,
  };
};
