import type { SamePaFieldThrowValues } from './SamePlateAppearanceLifecycleCalibrationSource';
/** Explicit synthetic initial poses for IFN01. Both glove offsets are within
 * the existing accepted 1.3m reach. Native accepts these poses before batting;
 * no contact, candidate, capture or result is supplied to a writer. */
export const physicalThrowSceneFixture = () => ({
  gloveOffsets: { p2: { x: -0.065, y: 0.49, z: 0.7 }, 'home-1': { x: -0.3, y: 0.15, z: -0.3 } },
  values: { transferParameters: { minimumTransferDelayTicks: 100, maximumTransferDelayTicks: 300, fixedGripOffsetTicks: 10 },
    throwCalibration: { minimumReleaseSpeedMps: 10, maximumReleaseSpeedMps: 30, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 0 } } satisfies SamePaFieldThrowValues,
});
