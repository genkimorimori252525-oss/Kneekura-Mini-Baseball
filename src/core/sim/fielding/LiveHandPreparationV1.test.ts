import { expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import { createLiveHandPreparationV1, type LiveHandPreparationInputV1 } from './LiveHandPreparationV1';

const input = (): LiveHandPreparationInputV1 => ({ fromElapsedSeconds: 12.345,
  initialOffset: { x: 0, y: 0, z: -.5 }, initialRelativeVelocity: { x: .12, y: -.03, z: .04 },
  targetOffset: { x: .5, y: .7, z: 0 }, maximumRelativeSpeedMps: 11, maximumReachMeters: 1.35 });
const norm = (p: Vec3) => Math.hypot(p.x, p.y, p.z);
const distance = (a: Vec3, b: Vec3) => norm({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const planned = (i = input()) => {
  const result = createLiveHandPreparationV1(i); expect(result.kind).toBe('planned');
  if (result.kind !== 'planned') throw new Error(result.reason);
  return result;
};

it('keeps the actual hand C1 endpoints and proves finite reach and relative motor speed', () => {
  const i = input(), before = JSON.stringify(i), p = planned(i);
  expect(p.durationSeconds).toBeGreaterThan(0); expect(p.durationSeconds).toBeLessThan(.5);
  expect(p.durationSeconds).toBe(p.throughElapsedSeconds - i.fromElapsedSeconds);
  expect(p.sampleAtElapsedSeconds(i.fromElapsedSeconds).offset).toEqual(i.initialOffset);
  expect(p.sampleAtElapsedSeconds(i.fromElapsedSeconds).relativeVelocity).toEqual(i.initialRelativeVelocity);
  expect(p.sampleAtElapsedSeconds(p.throughElapsedSeconds).offset).toEqual(i.targetOffset);
  expect(p.sampleAtElapsedSeconds(p.throughElapsedSeconds).relativeVelocity).toEqual({ x: 0, y: 0, z: 0 });
  const c = p.cubicBezierControls(i.fromElapsedSeconds, p.throughElapsedSeconds),
    derivativeControls = c.slice(1).map((point, n) => ({ x: 3 * (point.x - c[n].x) / p.durationSeconds,
      y: 3 * (point.y - c[n].y) / p.durationSeconds, z: 3 * (point.z - c[n].z) / p.durationSeconds }));
  expect(Math.max(...c.map(norm))).toBeLessThanOrEqual(i.maximumReachMeters);
  expect(Math.max(...derivativeControls.map(norm))).toBeLessThanOrEqual(i.maximumRelativeSpeedMps);
  expect(p.diagnostics.controlPointReachBoundMeters).toBeLessThanOrEqual(i.maximumReachMeters);
  expect(p.diagnostics.derivativeControlSpeedBoundMps).toBeLessThanOrEqual(i.maximumRelativeSpeedMps);
  for (let n = 0; n <= 100; n++) {
    const sample = p.sampleAtElapsedSeconds(i.fromElapsedSeconds + p.durationSeconds * n / 100);
    expect(norm(sample.offset)).toBeLessThanOrEqual(i.maximumReachMeters);
    expect(norm(sample.relativeVelocity)).toBeLessThanOrEqual(i.maximumRelativeSpeedMps);
    expect([sample.relativeAcceleration.x, sample.relativeAcceleration.y, sample.relativeAcceleration.z].every(Number.isFinite)).toBe(true);
  }
  const h = p.durationSeconds * 1e-6, first = p.sampleAtElapsedSeconds(i.fromElapsedSeconds + h),
    last = p.sampleAtElapsedSeconds(p.throughElapsedSeconds - h);
  expect(distance(first.relativeVelocity, i.initialRelativeVelocity)).toBeLessThan(.0001);
  expect(norm(last.relativeVelocity)).toBeLessThan(.0001);
  expect(JSON.stringify(i)).toBe(before); expect(p.diagnostics.candidateCount).toBeLessThanOrEqual(4);
});

it('exposes exact cubic restrictions for independent continuous contact proofs', () => {
  const i = input(), p = planned(i), from = i.fromElapsedSeconds + p.durationSeconds * .2,
    through = i.fromElapsedSeconds + p.durationSeconds * .8, c = p.cubicBezierControls(from, through);
  for (const u of [0, .25, .5, .75, 1]) {
    const polynomial = (key: keyof Vec3) => c[0][key] * (1 - u) ** 3 + 3 * c[1][key] * u * (1 - u) ** 2
      + 3 * c[2][key] * u * u * (1 - u) + c[3][key] * u ** 3,
      actual = p.sampleAtElapsedSeconds(from + (through - from) * u);
    expect(distance(actual.offset, { x: polynomial('x'), y: polynomial('y'), z: polynomial('z') })).toBeLessThan(1e-13);
  }
  const same = p.cubicBezierControls(from, from); expect(same.every(point => distance(point, same[0]) === 0)).toBe(true);
  expect(() => p.cubicBezierControls(through, from)).toThrow(/interval/);
  expect(() => p.cubicBezierControls(i.fromElapsedSeconds - 1, through)).toThrow(/interval/);
  expect(() => p.sampleAtElapsedSeconds(NaN)).toThrow(/interval/);
  expect(() => p.sampleAtElapsedSeconds(p.throughElapsedSeconds + 1)).toThrow(/interval/);
});

it('handles an already prepared stationary hand without inventing a delay or moving its endpoint', () => {
  const i = input(), p = planned({ ...i, initialOffset: i.targetOffset, initialRelativeVelocity: { x: 0, y: 0, z: 0 } });
  expect(p.durationSeconds).toBe(0); expect(p.throughElapsedSeconds).toBe(i.fromElapsedSeconds);
  expect(p.sampleAtElapsedSeconds(p.throughElapsedSeconds)).toEqual({ offset: i.targetOffset,
    relativeVelocity: { x: 0, y: 0, z: 0 }, relativeAcceleration: { x: 0, y: 0, z: 0 } });
  expect(p.cubicBezierControls(p.fromElapsedSeconds, p.throughElapsedSeconds)).toEqual(Array(4).fill(i.targetOffset));
});

it('retains a feasible speed-cap initial velocity and never projects an impossible hand inward', () => {
  const i = input(), p = planned({ ...i, initialOffset: { x: 0, y: 0, z: 0 },
    initialRelativeVelocity: { x: 11, y: 0, z: 0 }, targetOffset: { x: .5, y: 0, z: 0 } });
  expect(p.sampleAtElapsedSeconds(i.fromElapsedSeconds).relativeVelocity.x).toBe(11);
  for (const change of [
    { initialOffset: { x: 2, y: 0, z: 0 } }, { targetOffset: { x: 0, y: 2, z: 0 } },
    { initialRelativeVelocity: { x: 11.001, y: 0, z: 0 } },
    { initialOffset: { x: 1.35, y: 0, z: 0 }, initialRelativeVelocity: { x: 1, y: 0, z: 0 } },
    { initialOffset: { x: 0, y: 0, z: 0 }, initialRelativeVelocity: { x: -11, y: 0, z: 0 }, targetOffset: { x: .5, y: 0, z: 0 } },
  ]) expect(createLiveHandPreparationV1({ ...i, ...change }).kind).toBe('unreachable');
});

it('rejects nonfinite parameters and an unrepresentable absolute clock without endpoint corrections', () => {
  const i = input();
  for (const value of [NaN, Infinity, -Infinity]) {
    for (const key of ['fromElapsedSeconds', 'maximumRelativeSpeedMps', 'maximumReachMeters'] as const)
      expect(createLiveHandPreparationV1({ ...i, [key]: value }).kind).toBe('unreachable');
    for (const key of ['initialOffset', 'initialRelativeVelocity', 'targetOffset'] as const)
      expect(createLiveHandPreparationV1({ ...i, [key]: { ...i[key], x: value } }).kind).toBe('unreachable');
  }
  expect(createLiveHandPreparationV1({ ...i, maximumRelativeSpeedMps: 0 }).kind).toBe('unreachable');
  expect(createLiveHandPreparationV1({ ...i, maximumReachMeters: -1 }).kind).toBe('unreachable');
  expect(createLiveHandPreparationV1({ ...i, fromElapsedSeconds: 1e308 }).kind).toBe('unreachable');
});
