import { describe, expect, it } from 'vitest';
import {
  evaluateCatchRetentionLoad,
  resolveCatchRetention,
  type CatchRetentionContact,
  type CatchRetentionParameters,
} from './CatchRetention';
import {
  deriveCatchRetentionParameters,
  type CatchRetentionSkillCalibration,
} from './CatchRetentionSkill';

const baseParameters: CatchRetentionParameters = {
  ticksPerSecond: 1_000_000,
  ballMassKg: 0.145,
  ballRadiusMeters: 0.0366,
  pocketRadiusMeters: 0.1,
  centerRetentionCapacityJ: 10,
  captureDissipationPowerW: 700,
  failedContactRestitution: 0.25,
  failedTangentialDamping: 0.4,
  failedSpinDamping: 0.2,
};

const calibration: CatchRetentionSkillCalibration = {
  lowAbilityCenterRetentionCapacityMultiplier: 0.7,
  highAbilityCenterRetentionCapacityMultiplier: 1.15,
  lowAbilityCaptureDissipationPowerMultiplier: 0.8,
  highAbilityCaptureDissipationPowerMultiplier: 1.2,
};

const contactForEnergy = (
  translationalEnergyJ: number,
): CatchRetentionContact => {
  const speed = Math.sqrt(
    (2 * translationalEnergyJ) / baseParameters.ballMassKg,
  );

  return {
    contactTick: 2_000_000,
    ball: {
      tick: 2_000_000,
      position: { x: 0, y: 1, z: 0 },
      velocity: { x: 0, y: 0, z: -speed },
      spin: { x: 0, y: 0, z: 0 },
    },
    glove: {
      tick: 2_000_000,
      position: { x: 0, y: 1, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    },
    contactNormal: { x: 0, y: 0, z: 1 },
    pocketOffsetMeters: 0,
    bodyStability: 1,
  };
};

describe('CatchRetentionSkill integration', () => {
  it('keeps incoming physical energy identical while changing retention capacity', () => {
    const contact = contactForEnergy(9);
    const lowParameters = deriveCatchRetentionParameters(
      baseParameters,
      0,
      calibration,
    );
    const highParameters = deriveCatchRetentionParameters(
      baseParameters,
      1,
      calibration,
    );

    const low = evaluateCatchRetentionLoad(contact, lowParameters);
    const high = evaluateCatchRetentionLoad(contact, highParameters);

    expect(low.translationalEnergyJ).toBeCloseTo(9, 12);
    expect(high.translationalEnergyJ).toBeCloseTo(
      low.translationalEnergyJ,
      12,
    );
    expect(high.rotationalEnergyJ).toBeCloseTo(
      low.rotationalEnergyJ,
      12,
    );
    expect(high.retentionLoadJ).toBeCloseTo(
      low.retentionLoadJ,
      12,
    );

    expect(low.effectiveCapacityJ).toBeCloseTo(7, 12);
    expect(high.effectiveCapacityJ).toBeCloseTo(11.5, 12);
  });

  it('can cross the physical retention boundary without a random success roll', () => {
    const contact = contactForEnergy(9);
    const low = resolveCatchRetention(
      contact,
      deriveCatchRetentionParameters(
        baseParameters,
        0,
        calibration,
      ),
    );
    const high = resolveCatchRetention(
      contact,
      deriveCatchRetentionParameters(
        baseParameters,
        1,
        calibration,
      ),
    );

    expect(low.outcome.kind).toBe('live-ball');
    expect(high.outcome.kind).toBe('secured');
  });

  it('secures earlier when both players can retain but one dissipates energy faster', () => {
    const contact = contactForEnergy(5);
    const low = resolveCatchRetention(
      contact,
      deriveCatchRetentionParameters(
        baseParameters,
        0,
        calibration,
      ),
    );
    const high = resolveCatchRetention(
      contact,
      deriveCatchRetentionParameters(
        baseParameters,
        1,
        calibration,
      ),
    );

    expect(low.outcome.kind).toBe('secured');
    expect(high.outcome.kind).toBe('secured');

    if (low.outcome.kind !== 'secured' || high.outcome.kind !== 'secured') {
      throw new Error('fixture must retain for both skill levels');
    }

    expect(low.outcome.secureTick).toBe(2_008_929);
    expect(high.outcome.secureTick).toBe(2_005_953);
    expect(high.outcome.secureTick).toBeLessThan(
      low.outcome.secureTick,
    );
  });
});
