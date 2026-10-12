import { describe, expect, it } from 'vitest';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { samePaLifecycleExecutionRepertoireValues } from './SamePlateAppearanceLifecycleFixture.test-support';
import { lan01SwingCalibration } from './LAN01SwingCalibration.test-support';

describe('LAN01 prospective swing fixture declaration', () => {
  it('declares only the four approved profile corrections for the cut9 view', () => {
    const original = dispatchCalibrationValues().batter_swing;
    const declared = lan01SwingCalibration();
    expect(declared.viewSourceId).toBe('lan01:occupied:cut9:view');
    expect(declared.values).toEqual({ ...original, profiles: original.profiles.map(entry => ({
      ...entry, profile: { ...entry.profile, highAttackAngleDeg: 80, middleAttackAngleDeg: 80,
        lowAttackAngleDeg: 80, nominalContactSurfaceDistanceM: 0.0366 },
    })) });
    expect(original.profiles.map(entry => [entry.profile.highAttackAngleDeg, entry.profile.middleAttackAngleDeg,
      entry.profile.lowAttackAngleDeg, entry.profile.nominalContactSurfaceDistanceM])).toEqual([[7, 9, 16, 0.0696]]);
    expect(dispatchCalibrationValues().batter_swing).toEqual(original);
  });

  it('selects the declaration only for its exact prospective view', () => {
    const declared = lan01SwingCalibration();
    expect(samePaLifecycleExecutionRepertoireValues('lan01:occupied:cut9:view', declared)).toBe(declared.values);
    for (const viewSourceId of ['lan01:occupied:cut0:view', 'lan01:occupied:cut8:view',
      'lan01:occupied:cut10:view', 'lan01:occupied:cut12:view', 'other:occupied:cut9:view']) {
      expect(samePaLifecycleExecutionRepertoireValues(viewSourceId, declared)).toBeUndefined();
    }
  });

  it('preserves the original path when no execution repertoire is declared', () => {
    expect(samePaLifecycleExecutionRepertoireValues('lan01:occupied:cut9:view')).toBeUndefined();
    expect(samePaLifecycleExecutionRepertoireValues('lan01:occupied:cut12:view')).toBeUndefined();
  });
});
