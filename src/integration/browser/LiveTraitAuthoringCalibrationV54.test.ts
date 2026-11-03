import { expect, it } from 'vitest';
import { getLiveTraitAuthoringCalibrationV54, deriveLiveThrowAccuracyGradeV54, getLiveThrowAccuracySourceV54 } from './LiveTraitAuthoringCalibrationV54';

it('declares local authoring calibration, not measured ability or Native mastery', () => {
  const calibration = getLiveTraitAuthoringCalibrationV54();
  expect(calibration.authority).toBe('LOCAL_AUTHORING_ONLY');
  expect(calibration.version).toBe(54);
  expect(calibration.throwAccuracy.id).toBeTruthy();
  expect(Object.isFrozen(calibration.throwAccuracy.tiers)).toBe(true);
  expect(calibration.runningAggression.offsetSeconds).toBe(-.25);
  expect(calibration.fieldingAggression.costMultiplier).toBe(.65);
  expect(calibration.plateAggression.thresholdOffset).toBe(.12);
});

it('projects one ordered throw tier at every threshold without treating a tier as another physical effect', () => {
  const tiers = [['GOLD', .0015], ['A', .003], ['B', .006], ['C', .010], ['D', .016], ['E', .024], ['F', .04], ['G', .065]] as const;
  for (let index = 0; index < tiers.length; index++) {
    const [stateId, representative] = tiers[index];
    expect(getLiveThrowAccuracySourceV54(stateId)).toBe(representative);
    expect(deriveLiveThrowAccuracyGradeV54(representative)).toBe(stateId);
    if (index < tiers.length - 1) expect(deriveLiveThrowAccuracyGradeV54(representative + 1e-10)).toBe(tiers[index + 1][0]);
  }
  expect(deriveLiveThrowAccuracyGradeV54(0)).toBe('GOLD');
  expect(deriveLiveThrowAccuracyGradeV54(.12)).toBe('G');
  for (const source of [-.001, .12001, NaN, Infinity]) expect(() => deriveLiveThrowAccuracyGradeV54(source)).toThrow();
  expect(() => getLiveThrowAccuracySourceV54('S')).toThrow();
});
