import { describe, expect, it } from 'vitest';
import {
  BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
} from '../sim/ball/BaseballPhysicsV1';
import {
  CURRENT_BASEBALL_PHYSICS_V1_GATE_COVERAGE,
  createCurrentBaseballPhysicsV1GateEvidence,
} from './CurrentBaseballPhysicsV1Closure';

describe('current baseball physics v1 closure ledger', () => {
  it('accounts for every production calibration gate exactly once', () => {
    expect(
      CURRENT_BASEBALL_PHYSICS_V1_GATE_COVERAGE
        .map((entry) => entry.gateId),
    ).toEqual(
      BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
    );

    expect(
      new Set(
        CURRENT_BASEBALL_PHYSICS_V1_GATE_COVERAGE
          .map(
            (entry) =>
              entry.gateId,
          ),
      ).size,
    ).toBe(
      BASEBALL_PHYSICS_V1_CALIBRATION_GATES
        .length,
    );
  });

  it('does not silently mark a partially identified material or contact model as production-calibrated', () => {
    const evidence =
      createCurrentBaseballPhysicsV1GateEvidence();

    expect(
      evidence.every(
        (entry) =>
          entry.state === 'open',
      ),
    ).toBe(true);
  });

  it('records both what is already physically implemented and what evidence is still missing', () => {
    for (
      const entry
      of CURRENT_BASEBALL_PHYSICS_V1_GATE_COVERAGE
    ) {
      expect(entry.coverage.length)
        .toBeGreaterThan(20);
      expect(entry.missing.length)
        .toBeGreaterThan(20);
    }
  });
});