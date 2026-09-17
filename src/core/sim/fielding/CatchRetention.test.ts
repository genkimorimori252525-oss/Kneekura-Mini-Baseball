import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import {
  evaluateCatchRetentionLoad,
  type CatchRetentionContact,
  type CatchRetentionParameters,
} from './CatchRetention';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const parameters: CatchRetentionParameters = {
  ticksPerSecond: 1_000_000,
  ballMassKg: 0.145,
  ballRadiusMeters: 0.0366,
  pocketRadiusMeters: 0.1,
  centerRetentionCapacityJ: 10,
  captureDissipationPowerW: 725,
  failedContactRestitution: 0.25,
  failedTangentialDamping: 0.4,
  failedSpinDamping: 0.2,
};

const contact = (overrides: Partial<CatchRetentionContact> = {}): CatchRetentionContact => ({
  contactTick: 2_000_000,
  ball: {
    tick: 2_000_000,
    position: v(0, 1.2, 0),
    velocity: v(0, 0, -10),
    spin: v(0, 0, 0),
  },
  glove: {
    tick: 2_000_000,
    position: v(0, 1.2, 0.07),
    velocity: v(0, 0, 0),
  },
  contactNormal: v(0, 0, 1),
  pocketOffsetMeters: 0,
  bodyStability: 1,
  ...overrides,
});

describe('evaluateCatchRetentionLoad', () => {
  it('uses relative translational kinetic energy as retention load', () => {
    const result = evaluateCatchRetentionLoad(contact(), parameters);

    expect(result.translationalEnergyJ).toBeCloseTo(7.25, 12);
    expect(result.rotationalEnergyJ).toBe(0);
    expect(result.retentionLoadJ).toBeCloseTo(7.25, 12);
    expect(result.pocketFactor).toBe(1);
    expect(result.effectiveCapacityJ).toBeCloseTo(10, 12);
  });

  it('adds ball rotational kinetic energy instead of using a catch probability', () => {
    const result = evaluateCatchRetentionLoad(
      contact({
        ball: {
          ...contact().ball,
          spin: v(0, 100, 0),
        },
      }),
      parameters,
    );

    expect(result.rotationalEnergyJ).toBeCloseTo(0.3884724, 10);
    expect(result.retentionLoadJ).toBeCloseTo(7.6384724, 10);
  });

  it('reduces effective capacity for unstable and off-center contact', () => {
    const result = evaluateCatchRetentionLoad(
      contact({ pocketOffsetMeters: 0.08, bodyStability: 0.5 }),
      parameters,
    );

    expect(result.pocketFactor).toBeCloseTo(0.6, 12);
    expect(result.effectiveCapacityJ).toBeCloseTo(3, 12);
  });
});
