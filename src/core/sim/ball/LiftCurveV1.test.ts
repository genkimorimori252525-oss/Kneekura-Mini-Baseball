import { expect, it } from 'vitest';
import { LIVE_MATCH_PHYSICS_V1 } from '../../../integration/browser/LiveBaseballMatchV1';
import { LIFT_CURVES_V1, withLiftCurveV1 } from './LiftCurveV1';

it('replaces only the lift at each spin knot with Nathan 2017, leaving the drag and the rest', () => {
  const base = LIVE_MATCH_PHYSICS_V1, swapped = withLiftCurveV1(base, 'nathan2017');
  const before = base.air.aerodynamics.coefficientProfile!.spinKnots, after = swapped.air.aerodynamics.coefficientProfile!.spinKnots;
  expect(after.length).toBe(before.length);
  after.forEach((knot, i) => {
    expect(knot.dragCoefficientAtReferenceRe).toBe(before[i].dragCoefficientAtReferenceRe);
    expect(knot.liftCoefficient).toBeCloseTo(LIFT_CURVES_V1.nathan2017(knot.spinFactor), 12);
  });
  expect(LIFT_CURVES_V1.nathan2017(.2)).toBeCloseTo(.224 / 1.0496, 6);
  expect(swapped.air.aerodynamics.dragCoefficient).toBe(base.air.aerodynamics.dragCoefficient);
  expect(swapped.ground).toEqual(base.ground);
  expect(() => withLiftCurveV1(base, 'lyu9' as never)).toThrow(/unknown curve/);
});
