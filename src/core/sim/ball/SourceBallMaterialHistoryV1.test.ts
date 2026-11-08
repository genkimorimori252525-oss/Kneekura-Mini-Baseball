import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { createSourceBallMaterialHistoryV1, type SourceBallMaterialHistoryInputV1 } from './SourceBallMaterialHistoryV1';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle, rotateVectorByQuaternion, type Quaternion } from '../pitching/BaseballOrientation';

const descriptor = (): SourceFreeBallDescriptorV2 => ({ kind: 'aero_ground_continuous_source_kernel_v2',
  initial: { originTick: 123_456, elapsedSeconds: 0, ball: { tick: 123_456, position: { x: 0, y: 10, z: 0 },
    velocity: { x: 12, y: 3, z: 6 }, spin: { x: 30, y: 0, z: 0 } } }, throughElapsedSeconds: .1,
  profile: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81,
    radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15,
    material: { restitution: .4, slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } } });
const initial = () => quaternionFromAxisAngle({ x: 1, y: 2, z: 3 }, .7);
const product = (a: Quaternion, b: Quaternion) => normalizeQuaternion(multiplyQuaternions(a, b));
const close = (a: Quaternion, b: Quaternion) => {
  for (const key of ['w', 'x', 'y', 'z'] as const) expect(a[key]).toBeCloseTo(b[key], 13);
};
const historyInput = (): SourceBallMaterialHistoryInputV1 => {
  const one = descriptor(), first = createSourceFreeBallKernel(one).evaluateAt(.02);
  const two = { ...one, initial: { ...first.moment, ball: { ...first.moment.ball, spin: { x: 0, y: 40, z: 0 } } } };
  const second = createSourceFreeBallKernel(two).evaluateAt(.04);
  const three = { ...two, initial: { ...second.moment, ball: { ...second.moment.ball,
    velocity: { x: -10, y: 4, z: 5 }, spin: { x: 0, y: 0, z: 50 } } } };
  return { initialMaterialOrientation: initial(), spans: [
    { descriptor: one, throughElapsedSeconds: .02, side: 'incoming' },
    { descriptor: two, throughElapsedSeconds: .04, side: 'outgoing' },
    { descriptor: three, throughElapsedSeconds: .07, side: 'outgoing' } ] };
};

it('observes declared material phase while every position, velocity, spin and relative rotation remains kernel-owned', () => {
  const d = descriptor(), raw: SourceBallMaterialHistoryInputV1 = { initialMaterialOrientation: initial(),
    spans: [{ descriptor: d, throughElapsedSeconds: .07, side: 'outgoing' }] }, before = JSON.stringify(raw);
  const history = createSourceBallMaterialHistoryV1(raw), kernel = createSourceFreeBallKernel(d);
  for (const time of [0, .0000003, .003333333, .0314159, .07]) {
    const source = kernel.evaluateAt(time), observed = history.evaluateAt(time);
    expect(observed.moment).toEqual(source.moment); expect(observed.phase).toBe(source.phase);
    expect(observed.relativeOrientation).toEqual(source.orientation);
    close(observed.orientation, product(source.orientation, initial()));
    expect(observed.native).toBe(false); expect(observed.nativeAdmission).toBe(false); expect(observed.official).toBeNull();
  }
  expect(history.phaseAuthority).toBe('DECLARED_INITIAL_PHASE');
  expect(history.native).toBe(false); expect(history.official).toBeNull();
  expect(JSON.stringify(raw)).toBe(before); expect(Object.isFrozen(raw.spans[0].descriptor)).toBe(false);
  expect(Object.isFrozen(history.spans[0].descriptor.initial.ball)).toBe(true);
});

it('world-premultiplies noncommuting relative rotations across three impulse bases without a phase reset', () => {
  const raw = historyInput(), history = createSourceBallMaterialHistoryV1(raw);
  let expected = initial();
  for (const span of raw.spans) expected = product(createSourceFreeBallKernel(span.descriptor)
    .evaluateAt(span.throughElapsedSeconds, span.side).orientation, expected);
  close(history.evaluateAt(.07).orientation, expected);
  let wrongOrder = initial();
  for (const span of raw.spans) wrongOrder = product(wrongOrder, createSourceFreeBallKernel(span.descriptor)
    .evaluateAt(span.throughElapsedSeconds, span.side).orientation);
  expect(Math.hypot(expected.w - wrongOrder.w, expected.x - wrongOrder.x, expected.y - wrongOrder.y, expected.z - wrongOrder.z)).toBeGreaterThan(.1);
  for (const time of [.02, .04]) {
    const incoming = history.evaluateAt(time, 'incoming'), outgoing = history.evaluateAt(time, 'outgoing');
    close(incoming.orientation, outgoing.orientation); expect(incoming.moment.ball.position).toEqual(outgoing.moment.ball.position);
    expect(incoming.moment.ball.spin).not.toEqual(outgoing.moment.ball.spin);
    const seam = { x: .0366, y: 0, z: 0 };
    const before = rotateVectorByQuaternion(seam, incoming.orientation), after = rotateVectorByQuaternion(seam, outgoing.orientation);
    for (const axis of ['x', 'y', 'z'] as const) expect(before[axis]).toBeCloseTo(after[axis], 14);
  }
});

it('does not integrate observation steps or depend on fps, query order or repeated samples', () => {
  const history = createSourceBallMaterialHistoryV1(historyInput()), expected = history.evaluateAt(.05321);
  for (const fps of [24, 30, 60, 120, 240]) {
    for (let frame = 0; frame / fps <= .07; frame++) history.evaluateAt(frame / fps);
    expect(history.evaluateAt(.05321)).toEqual(expected);
    history.evaluateAt(.07); history.evaluateAt(0); history.evaluateAt(.02, 'incoming');
    expect(history.evaluateAt(.05321)).toEqual(expected);
  }
});

it('keeps a real ground incoming/outgoing impulse continuous in material angle and exactly equal in kernel geometry', () => {
  const original = descriptor(), d = { ...original, initial: { ...original.initial, ball: { ...original.initial.ball,
    position: { x: 0, y: .04, z: 0 }, velocity: { x: 12, y: -2, z: 6 }, spin: { x: 15, y: 12, z: -50 } } } };
  const kernel = createSourceFreeBallKernel(d), ground = kernel.boundaries.find(b => b.kind === 'ground')!;
  expect(ground).toBeDefined();
  const before = kernel.evaluateAt(ground.elapsedSeconds, 'incoming'), after = kernel.evaluateAt(ground.elapsedSeconds, 'outgoing');
  const next = { ...d, initial: after.moment }, raw: SourceBallMaterialHistoryInputV1 = { initialMaterialOrientation: initial(), spans: [
    { descriptor: d, throughElapsedSeconds: ground.elapsedSeconds, side: 'incoming' },
    { descriptor: next, throughElapsedSeconds: ground.elapsedSeconds + .02, side: 'outgoing' } ] };
  const history = createSourceBallMaterialHistoryV1(raw), incoming = history.evaluateAt(ground.elapsedSeconds, 'incoming');
  const outgoing = history.evaluateAt(ground.elapsedSeconds, 'outgoing');
  expect(incoming.moment).toEqual(before.moment); expect(outgoing.moment).toEqual(after.moment);
  close(incoming.orientation, outgoing.orientation); expect(incoming.moment.ball.velocity).not.toEqual(outgoing.moment.ball.velocity);
  close(outgoing.orientation, product(before.orientation, initial()));
  const later = createSourceFreeBallKernel(next).evaluateAt(ground.elapsedSeconds + .013);
  expect(history.evaluateAt(later.moment.elapsedSeconds).moment).toEqual(later.moment);
  close(history.evaluateAt(later.moment.elapsedSeconds).orientation, product(later.orientation, outgoing.orientation));
  // The same source's own ground boundary also keeps its material phase.
  const one = createSourceBallMaterialHistoryV1({ initialMaterialOrientation: initial(),
    spans: [{ descriptor: d, throughElapsedSeconds: .04, side: 'outgoing' }] });
  close(one.evaluateAt(ground.elapsedSeconds, 'incoming').orientation, one.evaluateAt(ground.elapsedSeconds, 'outgoing').orientation);
  const ending = createSourceBallMaterialHistoryV1({ initialMaterialOrientation: initial(),
    spans: [{ descriptor: d, throughElapsedSeconds: ground.elapsedSeconds, side: 'outgoing' }] });
  expect(ending.evaluateAt(ground.elapsedSeconds, 'incoming').moment).toEqual(before.moment);
  expect(ending.evaluateAt(ground.elapsedSeconds, 'outgoing').moment).toEqual(after.moment);
});

it('rejects gaps, overlaps, backwards horizons, changed clocks/profiles, discontinuous positions and non-free descriptors', () => {
  for (const mutate of [
    (raw: any) => { raw.spans[0].throughElapsedSeconds = .021; },
    (raw: any) => { raw.spans[0].throughElapsedSeconds = .019; },
    (raw: any) => { raw.spans[1].throughElapsedSeconds = .019; },
    (raw: any) => { raw.spans[0].throughElapsedSeconds = .11; },
    (raw: any) => { raw.spans[1].descriptor.initial.originTick++; raw.spans[1].descriptor.initial.ball.tick++; },
    (raw: any) => { raw.spans[1].descriptor.profile = structuredClone(raw.spans[1].descriptor.profile);
      raw.spans[1].descriptor.profile.ground.material.restitution += .01; },
    (raw: any) => { raw.spans[1].descriptor.initial.ball.position.x += 1e-12; },
    (raw: any) => { raw.spans[1].descriptor.kind = 'held'; },
    (raw: any) => { raw.spans[1].custody = 'held'; },
    (raw: any) => { raw.spans[0].side = 'unknown'; },
    (raw: any) => { raw.spans = []; },
    (raw: any) => { raw.initialMaterialOrientation = { w: 0, x: 0, y: 0, z: 0 }; },
    (raw: any) => { raw.initialMaterialOrientation.w = Infinity; },
    (raw: any) => { raw.nativeAdmission = true; },
  ]) { const raw = structuredClone(historyInput()); mutate(raw); expect(() => createSourceBallMaterialHistoryV1(raw)).toThrow(); }
  const history = createSourceBallMaterialHistoryV1(historyInput());
  for (const time of [-.001, .071, NaN, Infinity]) expect(() => history.evaluateAt(time)).toThrow();
  expect(() => history.evaluateAt(.02, 'invalid' as 'incoming')).toThrow();
});

it('carries zero-duration impulse phase, rejects accessors and isolates immutable evidence from later input mutation', () => {
  const raw = historyInput(), middle = raw.spans[1];
  const zero = { descriptor: middle.descriptor, throughElapsedSeconds: .02, side: 'outgoing' as const };
  const history = createSourceBallMaterialHistoryV1({ ...raw, spans: [raw.spans[0], zero, middle, raw.spans[2]] });
  close(history.evaluateAt(.02, 'incoming').orientation, history.evaluateAt(.02, 'outgoing').orientation);
  const expected = history.evaluateAt(.05321), mutable = structuredClone(raw);
  const stable = createSourceBallMaterialHistoryV1(mutable);
  Object.assign(mutable.spans[2].descriptor.initial.ball.spin, { x: 999 });
  expect(stable.evaluateAt(.05321).moment).toEqual(expected.moment);
  close(stable.evaluateAt(.05321).orientation, expected.orientation);
  const withGetter = structuredClone(raw); let calls = 0;
  Object.defineProperty(withGetter.spans[0], 'throughElapsedSeconds', { enumerable: true, get: () => { calls++; return .02; } });
  expect(() => createSourceBallMaterialHistoryV1(withGetter)).toThrow(/accessors/); expect(calls).toBe(0);
});
