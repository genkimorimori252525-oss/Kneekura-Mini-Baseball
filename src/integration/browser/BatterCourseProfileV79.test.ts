import { expect, it } from 'vitest';
import { classifyBatterCourseV79, createNeutralBatterCourseProfileV79, validateBatterCourseProfileV79 } from './BatterCourseProfileV79';

const zone = { centerX: .1, halfWidth: .25, lowerY: .5, upperY: 1.5 };
const classify = (x: number, y: number) => classifyBatterCourseV79({ position: { x, y }, zone });

it('creates a detached immutable neutral profile and strictly validates authored data', () => {
  const neutral = createNeutralBatterCourseProfileV79(), another = createNeutralBatterCourseProfileV79();
  expect(neutral).toEqual({ version: 'batter_course_profile_v79', referenceAverages: Array(63).fill(.25), effectScale: 1 });
  expect(another).not.toBe(neutral); expect(Object.isFrozen(neutral.referenceAverages)).toBe(true);
  const raw = { ...neutral, referenceAverages: [...neutral.referenceAverages], directionWeights: [.1, .2, .4, .2, .1] }, before = JSON.stringify(raw),
    checked = validateBatterCourseProfileV79(raw);
  expect(checked).toEqual(raw); expect(checked).not.toBe(raw); expect(Object.isFrozen(checked.directionWeights)).toBe(true);
  expect(JSON.stringify(raw)).toBe(before);
  for (const bad of [null, { ...raw, extra: 1 }, { ...raw, version: 'other' }, { ...raw, effectScale: -1 }, { ...raw, effectScale: 3.01 },
    { ...raw, effectScale: NaN }, { ...raw, referenceAverages: Array(62).fill(.25) }, { ...raw, referenceAverages: Array(63).fill(1.01) },
    { ...raw, referenceAverages: Array(63) }, { ...raw, directionWeights: [0, 0, 0, 0, 0] },
    { ...raw, directionWeights: [-.1, .2, .4, .2, .3] }, { ...raw, directionWeights: [.25, .25, .25, .25] }])
    expect(() => validateBatterCourseProfileV79(bad)).toThrow();
  expect(validateBatterCourseProfileV79({ ...raw, effectScale: 0, referenceAverages: Array(63).fill(0) }).effectScale).toBe(0);
  expect(validateBatterCourseProfileV79({ ...raw, effectScale: 3, referenceAverages: Array(63).fill(1) }).effectScale).toBe(3);
});

it('classifies all 63 cell centres in fixed catcher-view column-major order', () => {
  for (let column = 1; column <= 9; column++) for (let row = 0; row <= 6; row++) {
    const x = zone.centerX - zone.halfWidth + (column - 2.5) * .1, y = zone.lowerY + (row - .5) * .2,
      result = classify(x, y);
    expect(result.courseId).toBe(column * 10 + row); expect(result.courseIndex).toBe((column - 1) * 7 + row);
    expect(result.insideStrikeZone).toBe(column >= 3 && column <= 7 && row >= 1 && row <= 5);
    expect(result.publicZoneId === null).toBe(!result.insideStrikeZone);
  }
});

it('classifies public 3 by 3 independently from the 5 by 5 internal strike cells', () => {
  for (let topRow = 0; topRow < 3; topRow++) for (let column = 0; column < 3; column++) {
    const x = zone.centerX - zone.halfWidth + (column + .5) * .5 / 3, y = zone.upperY - (topRow + .5) / 3;
    expect(classify(x, y).publicZoneId).toBe(topRow * 3 + column + 1);
  }
  const left = classify(.01, 1), right = classify(.03, 1);
  expect(left.courseId).toBe(right.courseId); expect(left.publicZoneId).toBe(4); expect(right.publicZoneId).toBe(5);
});

it('includes outer upper limits, retains off-zone cells, and does not clamp outside the full grid', () => {
  expect(classify(.55, 1.7)).toMatchObject({ courseId: 96, courseIndex: 62, publicZoneId: null, insideStrikeZone: false });
  expect(classify(-.35, .3)).toMatchObject({ courseId: 10, courseIndex: 0 });
  expect(classify(.35, 1.5)).toMatchObject({ publicZoneId: 3, insideStrikeZone: true });
  expect(classify(-.15, .5)).toMatchObject({ publicZoneId: 7, insideStrikeZone: true });
  for (const [x, y] of [[.550001, 1], [-.350001, 1], [0, 1.700001], [0, .299999]])
    expect(classify(x, y)).toEqual({ courseId: null, courseIndex: null, publicZoneId: null, insideStrikeZone: false });
  expect(classifyBatterCourseV79({ position: { x: 0, y: 1 }, zone: { halfWidth: .25, lowerY: .5, upperY: 1.5 } }).publicZoneId).toBe(5);
  for (const bad of [{ ...zone, halfWidth: 0 }, { ...zone, lowerY: 1.5 }, { ...zone, upperY: Infinity }])
    expect(() => classifyBatterCourseV79({ position: { x: 0, y: 1 }, zone: bad })).toThrow();
});

it('keeps each inclusive strike-zone edge in its internal zone cells across heights and widths', () => {
  for (const zone of [{ centerX: 0, halfWidth: .2, lowerY: .4, upperY: 1.4 },
    { centerX: -.13, halfWidth: .2159, lowerY: .51, upperY: 1.23 }]) {
    expect(classifyBatterCourseV79({ position: { x: zone.centerX + zone.halfWidth, y: zone.upperY }, zone }))
      .toEqual({ courseId: 75, courseIndex: 47, publicZoneId: 3, insideStrikeZone: true });
    expect(classifyBatterCourseV79({ position: { x: zone.centerX - zone.halfWidth, y: zone.lowerY }, zone }))
      .toEqual({ courseId: 31, courseIndex: 15, publicZoneId: 7, insideStrikeZone: true });
    const cellWidth = zone.halfWidth * 2 / 5, cellHeight = (zone.upperY - zone.lowerY) / 5;
    expect(classifyBatterCourseV79({ position: { x: zone.centerX - zone.halfWidth - 2 * cellWidth, y: zone.lowerY - cellHeight }, zone }).courseId).toBe(10);
    expect(classifyBatterCourseV79({ position: { x: zone.centerX + zone.halfWidth + 2 * cellWidth, y: zone.upperY + cellHeight }, zone }).courseId).toBe(96);
  }
});
