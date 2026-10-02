import { describe, expect, it } from 'vitest';
import {
  BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
  BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
} from '../sim/ball/BaseballPhysicsV1';
import {
  evaluatePhysicsValidationCorpus,
} from './PhysicsObservableValidation';
import {
  evaluateBaseballPhysicsProductionReadiness,
  type BaseballPhysicsCalibrationGateEvidence,
} from './BaseballPhysicsProductionReadiness';

const validation = (
  passed: boolean,
) => evaluatePhysicsValidationCorpus(
  'fixture-corpus-v1',
  [
    {
      caseId: 'fixture',
      targets: [
        {
          observableId:
            'exit_speed_mps',
          sourceId: 'lab',
          sourceVersion: 'v1',
          targetValue: 50,
          absoluteTolerance: 1,
        },
      ],
      measurements: [
        {
          observableId:
            'exit_speed_mps',
          observedValue:
            passed ? 50.5 : 53,
        },
      ],
    },
  ],
);

const gates = (
  state:
    BaseballPhysicsCalibrationGateEvidence['state']
    = 'satisfied',
): BaseballPhysicsCalibrationGateEvidence[] =>
  BASEBALL_PHYSICS_V1_CALIBRATION_GATES
    .map((gateId) => ({
      gateId,
      state,
      evidenceId:
        `evidence:${gateId}`,
      evidenceVersion: 'v1',
    }));

describe('baseball physics production readiness', () => {
  it('requires every calibration gate and a passing physical-observable corpus before default promotion', () => {
    const result =
      evaluateBaseballPhysicsProductionReadiness({
        architectureVersion:
          BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
        calibrationGates:
          gates(),
        validationCorpus:
          validation(true),
        acceptExplicitScopeOut: false,
      });

    expect(result.architectureFrozen)
      .toBe(true);
    expect(result.openGateIds)
      .toEqual([]);
    expect(
      result.readyForDefaultPromotion,
    ).toBe(true);
  });

  it('keeps production promotion closed when any empirical gate remains open', () => {
    const evidence = gates();
    evidence[0] = {
      ...evidence[0]!,
      state: 'open',
    };

    const result =
      evaluateBaseballPhysicsProductionReadiness({
        architectureVersion:
          BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
        calibrationGates:
          evidence,
        validationCorpus:
          validation(true),
        acceptExplicitScopeOut: false,
      });

    expect(result.openGateIds)
      .toEqual([
        BASEBALL_PHYSICS_V1_CALIBRATION_GATES[0],
      ]);
    expect(
      result.readyForDefaultPromotion,
    ).toBe(false);
  });

  it('requires an explicit decision before a scoped-out calibration gate can count as closed', () => {
    const evidence = gates();
    evidence[1] = {
      ...evidence[1]!,
      state: 'explicitly_scoped_out',
    };

    const notAccepted =
      evaluateBaseballPhysicsProductionReadiness({
        architectureVersion:
          BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
        calibrationGates:
          evidence,
        validationCorpus:
          validation(true),
        acceptExplicitScopeOut: false,
      });
    const accepted =
      evaluateBaseballPhysicsProductionReadiness({
        architectureVersion:
          BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
        calibrationGates:
          evidence,
        validationCorpus:
          validation(true),
        acceptExplicitScopeOut: true,
      });

    expect(
      notAccepted
        .readyForDefaultPromotion,
    ).toBe(false);
    expect(
      accepted
        .readyForDefaultPromotion,
    ).toBe(true);
  });

  it('cannot promote a physically invalid validation corpus even when every administrative gate is closed', () => {
    const result =
      evaluateBaseballPhysicsProductionReadiness({
        architectureVersion:
          BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
        calibrationGates:
          gates(),
        validationCorpus:
          validation(false),
        acceptExplicitScopeOut: false,
      });

    expect(result.validationPassed)
      .toBe(false);
    expect(
      result.readyForDefaultPromotion,
    ).toBe(false);
  });

  it('rejects missing calibration evidence instead of silently assuming completion', () => {
    const evidence = gates();
    evidence.pop();

    expect(() =>
      evaluateBaseballPhysicsProductionReadiness({
        architectureVersion:
          BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
        calibrationGates:
          evidence,
        validationCorpus:
          validation(true),
        acceptExplicitScopeOut: false,
      }),
    ).toThrow(
      'missing baseball physics calibration gate evidence',
    );
  });
});
