import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import type { SamePaLifecycleExecutionRepertoire, SamePaLifecycleFixtureContext } from './SamePlateAppearanceLifecycleFixture.test-support';

/** Explicit synthetic LAN fixture correction, declared before cut9 calibration
 * acceptance. The resulting flight and catch still use unchanged Core physics. */
export const lan01SwingCalibration = (): SamePaLifecycleExecutionRepertoire => {
  const original = dispatchCalibrationValues().batter_swing;
  return { viewSourceId: 'lan01:occupied:cut9:view', values: {
    ...original, profiles: original.profiles.map(entry => ({ ...entry, profile: { ...entry.profile,
      highAttackAngleDeg: 80, middleAttackAngleDeg: 80, lowAttackAngleDeg: 80,
      nominalContactSurfaceDistanceM: 0.0366,
    } })),
  } };
};

/** Only fixture metadata is set. Existing accepted Sources are never edited. */
export const declareLAN01SwingCalibration = (f: SamePaLifecycleFixtureContext): void => {
  f.executionRepertoire = lan01SwingCalibration();
};
