import { describe, expect, it } from 'vitest';
import type { CatchRetentionParameters } from './CatchRetention';
import {
  deriveCatchRetentionParameters,
  type CatchRetentionSkillCalibration,
} from './CatchRetentionSkill';

const base = (): CatchRetentionParameters => ({
  ticksPerSecond: 1_000_000,
  ballMassKg: 0.145,
  ballRadiusMeters: 0.0366,
  pocketRadiusMeters: 0.1,
  centerRetentionCapacityJ: 10,
  captureDissipationPowerW: 700,
  failedContactRestitution: 0.25,
  failedTangentialDamping: 0.4,
  failedSpinDamping: 0.2,
});

const calibration: CatchRetentionSkillCalibration = {
  lowAbilityCenterRetentionCapacityMultiplier: 0.7,
  highAbilityCenterRetentionCapacityMultiplier: 1.15,
  lowAbilityCaptureDissipationPowerMultiplier: 0.8,
  highAbilityCaptureDissipationPowerMultiplier: 1.2,
};

describe('CatchRetentionSkill', () => {
  it('maps ability zero and one to the supplied calibration endpoints', () => {
    const low = deriveCatchRetentionParameters(
      base(),
      0,
      calibration,
    );
    const high = deriveCatchRetentionParameters(
      base(),
      1,
      calibration,
    );

    expect(low.centerRetentionCapacityJ).toBeCloseTo(7, 12);
    expect(high.centerRetentionCapacityJ).toBeCloseTo(11.5, 12);
    expect(low.captureDissipationPowerW).toBeCloseTo(560, 12);
    expect(high.captureDissipationPowerW).toBeCloseTo(840, 12);
  });

  it('interpolates retention capability continuously for intermediate ability', () => {
    const mid = deriveCatchRetentionParameters(
      base(),
      0.5,
      calibration,
    );

    expect(mid.centerRetentionCapacityJ).toBeCloseTo(9.25, 12);
    expect(mid.captureDissipationPowerW).toBeCloseTo(700, 12);
  });

  it('leaves physical constants and failed-contact response unchanged', () => {
    const source = base();
    const adjusted = deriveCatchRetentionParameters(
      source,
      0.75,
      calibration,
    );

    expect(adjusted.ticksPerSecond).toBe(source.ticksPerSecond);
    expect(adjusted.ballMassKg).toBe(source.ballMassKg);
    expect(adjusted.ballRadiusMeters).toBe(source.ballRadiusMeters);
    expect(adjusted.pocketRadiusMeters).toBe(source.pocketRadiusMeters);
    expect(adjusted.failedContactRestitution)
      .toBe(source.failedContactRestitution);
    expect(adjusted.failedTangentialDamping)
      .toBe(source.failedTangentialDamping);
    expect(adjusted.failedSpinDamping)
      .toBe(source.failedSpinDamping);
  });

  it('returns a new parameter object without mutating the base parameters', () => {
    const source = base();
    const before = structuredClone(source);

    const adjusted = deriveCatchRetentionParameters(
      source,
      0.6,
      calibration,
    );

    expect(source).toEqual(before);
    expect(adjusted).not.toBe(source);
  });

  it('rejects invalid ability and non-monotonic calibration', () => {
    expect(() => deriveCatchRetentionParameters(
      base(),
      -0.01,
      calibration,
    )).toThrow('catchingAbility must be finite and within [0, 1]');

    expect(() => deriveCatchRetentionParameters(
      base(),
      0.5,
      {
        ...calibration,
        highAbilityCenterRetentionCapacityMultiplier: 0.6,
      },
    )).toThrow(
      'highAbilityCenterRetentionCapacityMultiplier must be at least lowAbilityCenterRetentionCapacityMultiplier',
    );

    expect(() => deriveCatchRetentionParameters(
      base(),
      0.5,
      {
        ...calibration,
        lowAbilityCaptureDissipationPowerMultiplier: 0,
      },
    )).toThrow(
      'lowAbilityCaptureDissipationPowerMultiplier must be finite and positive',
    );
  });
});
