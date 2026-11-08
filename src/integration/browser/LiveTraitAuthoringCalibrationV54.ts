/** Explicit local authoring policy, not an empirical scouting conversion,
 * league percentile, Native mastery assessment or runtime color multiplier. */
export type LiveThrowAccuracyGradeV54 = 'G' | 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'GOLD';
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const calibration = freeze({
  version: 54 as const, authority: 'LOCAL_AUTHORING_ONLY' as const, id: 'live-trait-source-authoring-v54',
  throwAccuracy: { id: 'local-throw-direction-sigma-v54', units: 'radians', minimum: 0, maximum: .12,
    tiers: [
      { stateId: 'GOLD' as const, source: .0015, upperBound: .0015 },
      { stateId: 'A' as const, source: .003, upperBound: .003 },
      { stateId: 'B' as const, source: .006, upperBound: .006 },
      { stateId: 'C' as const, source: .010, upperBound: .010 },
      { stateId: 'D' as const, source: .016, upperBound: .016 },
      { stateId: 'E' as const, source: .024, upperBound: .024 },
      { stateId: 'F' as const, source: .04, upperBound: .04 },
      { stateId: 'G' as const, source: .065, upperBound: .12 },
    ] },
  runningAggression: { id: 'local-running-margin-v54', defaultSource: .35, offsetSeconds: -.25, minimum: 0, maximum: 3 },
  fieldingAggression: { id: 'local-fielding-pursuit-v54', defaultSource: 1, costMultiplier: .65, minimum: .25, maximum: 4 },
  plateAggression: { id: 'local-plate-threshold-v54', defaultThreshold: 0, defaultAggressionWeight: .5,
    thresholdOffset: .12, minimum: 0, maximum: 1 },
});
export const getLiveTraitAuthoringCalibrationV54 = () => calibration;
export function deriveLiveThrowAccuracyGradeV54(source: number): LiveThrowAccuracyGradeV54 {
  if (!Number.isFinite(source) || source < calibration.throwAccuracy.minimum || source > calibration.throwAccuracy.maximum)
    throw new Error('live trait authoring: invalid throwing direction source');
  return calibration.throwAccuracy.tiers.find(tier => source <= tier.upperBound)!.stateId;
}
export function getLiveThrowAccuracySourceV54(stateId: string): number {
  const tier = calibration.throwAccuracy.tiers.find(value => value.stateId === stateId);
  if (!tier) throw new Error('live trait authoring: unsupported throwing grade');
  return tier.source;
}
