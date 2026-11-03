import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS, REFERENCE_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { querySourceFreeBallWorldV2 } from './SourceFreeBallWorldQuery';
import { querySourceFenceOverflightV146, type SourceFenceOverflightQueryInputV146 } from './SourceFenceOverflightV146';
import { quaternionFromAxisAngle } from '../pitching/BaseballOrientation';
import { quantizeEventTick } from '../ExactEventTime';

// Authored mathematical geometry/policy, not an adopted stadium or baseball rule.
const descriptor = (): SourceFreeBallDescriptorV2 => ({ kind: 'aero_ground_continuous_source_kernel_v2', initial: {
  originTick: 1000, elapsedSeconds: 0, ball: { tick: 1000, position: { x: 0, y: 5, z: 0 },
    velocity: { x: 30, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } }, throughElapsedSeconds: 0.1,
  profile: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2000, gravityY: -9.81,
    aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1_000_000, radiusM: 0.0366, inertiaRatio: 0.378,
    gravityMps2: 9.81, restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25,
      rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } } });
const input = (d = descriptor()): SourceFenceOverflightQueryInputV146 => ({ descriptor: d, moment: d.initial, side: 'incoming',
  throughElapsedSeconds: d.throughElapsedSeconds, fence: { boundaryId: 'synthetic-boundary', surface: { surfaceId: 'synthetic-fence',
    start: { x: 1, z: -2 }, end: { x: 1, z: 2 }, minimumHeight: 0, maximumHeight: 1 }, interiorPoint: { x: 0, z: 0 } },
  policy: { version: 'finite_fence_sphere_transit_v1', crossing: 'whole_ball_outside', endpoints: 'strict_sphere_inside_else_unresolved',
    top: 'strict_sphere_above_during_transit_else_unresolved', ground: 'stop_at_first_ground' } });
const witnessed = (q = input()) => {
  const result = querySourceFenceOverflightV146(q);
  if (result.kind !== 'witness') throw Error(`expected actual finite-sphere transit, received ${result.kind}`);
  return result;
};

it.each([-1, 1])('proves an actual whole-sphere finite fence transit for outward side %s', side => {
  const original = descriptor(), d = { ...original, initial: { ...original.initial,
    ball: { ...original.initial.ball, velocity: { x: 30 * side, y: 0, z: 0 } } } }, q = input(d);
  const before = JSON.stringify(q), result = witnessed({ ...q, fence: { ...q.fence, surface: { ...q.fence.surface,
    start: { x: side, z: -2 }, end: { x: side, z: 2 } } } });
  const kernel = createSourceFreeBallKernel(d);
  expect(result.entry.moment).toEqual(kernel.evaluateAt(result.entry.witnessElapsedSeconds, 'incoming').moment);
  expect(result.exit.moment).toEqual(kernel.evaluateAt(result.exit.witnessElapsedSeconds, 'incoming').moment);
  expect(result.entry.witnessElapsedSeconds).toBeLessThan(result.exit.firstPossibleElapsedSeconds);
  expect(result.entry.witnessElapsedSeconds - result.entry.firstPossibleElapsedSeconds).toBeLessThanOrEqual(1e-12);
  expect(result.exit.witnessElapsedSeconds - result.exit.firstPossibleElapsedSeconds).toBeLessThanOrEqual(1e-12);
  expect(result.exit.moment.ball.position.x * side - 1).toBeGreaterThan(result.radiusM);
  expect(Object.values(result.clearance).every(n => n > 0)).toBe(true);
  expect(result.authority).toBe('SOURCE_NONLINEAR_FENCE_TRANSIT_RESEARCH');
  for (const key of ['fair', 'homeRun', 'award', 'native', 'officialResult']) expect(result).not.toHaveProperty(key);
  expect(Object.isFrozen(result.exit.moment.ball.position)).toBe(true); expect(JSON.stringify(q)).toBe(before);
});

it('finds a nonmonotonic whole-ball exit and return wholly inside 1ms despite both rendered endpoints being inside', () => {
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 0.001, initial: { ...original.initial,
    ball: { ...original.initial.ball, velocity: { x: 1000, y: 0, z: 0 } } }, profile: { ...original.profile, air: { ...original.profile.air,
      integrationStepTicks: 10, aerodynamics: { ...original.profile.air.aerodynamics, windVelocityMps: { x: -20000, y: 0, z: 0 } } } } };
  const q = input(d), kernel = createSourceFreeBallKernel(d), fenceX = 0.1, radius = d.profile.ground.radiusM;
  for (const t of [0, 0.001]) expect(kernel.evaluateAt(t).moment.ball.position.x + radius).toBeLessThan(fenceX);
  expect(kernel.evaluateAt(0.0004).moment.ball.position.x - radius).toBeGreaterThan(fenceX);
  const result = witnessed({ ...q, fence: { ...q.fence, surface: { ...q.fence.surface,
    start: { x: fenceX, z: -2 }, end: { x: fenceX, z: 2 } } } });
  expect(result.exit.witnessElapsedSeconds).toBeGreaterThan(0); expect(result.exit.witnessElapsedSeconds).toBeLessThan(0.001);
});

it('retains different exact entry/exit instants even when both ceil to the same integer tick', () => {
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 0.001, initial: { ...original.initial,
    ball: { ...original.initial.ball, velocity: { x: 3000, y: 0, z: 0 } } }, profile: { ...original.profile,
    air: { ...original.profile.air, ticksPerSecond: 1000, integrationStepTicks: 1 }, ground: { ...original.profile.ground, ticksPerSecond: 1000 } } };
  const result = witnessed(input(d));
  expect(result.entry.moment.ball.tick).toBe(result.exit.moment.ball.tick);
  expect(result.entry.moment.elapsedSeconds).toBeLessThan(result.exit.moment.elapsedSeconds);
});

it('does not publish a transit before the whole ball is outside or for reverse motion', () => {
  const q = input(); expect(querySourceFenceOverflightV146({ ...q, throughElapsedSeconds: 0.02 }).kind).toBe('no_crossing');
  const d = { ...q.descriptor, initial: { ...q.descriptor.initial,
    ball: { ...q.descriptor.initial.ball, velocity: { x: -30, y: 0, z: 0 } } } };
  expect(querySourceFenceOverflightV146(input(d)).kind).toBe('no_crossing');
  const afterEntry = witnessed(q).entry.witnessElapsedSeconds;
  expect(querySourceFenceOverflightV146({ ...q, throughElapsedSeconds: afterEntry }).kind).toBe('no_crossing');
});

it('does not invent an inside-to-outside witness from an initially outside or tangent sphere', () => {
  const q = input(), d = q.descriptor;
  for (const x of [2, 1 - d.profile.ground.radiusM]) {
    const changed = { ...d, initial: { ...d.initial, ball: { ...d.initial.ball, position: { x, y: 5, z: 0 }, velocity: { x: 0, y: 0, z: 30 } } } };
    expect(querySourceFenceOverflightV146(input(changed)).kind).toBe('unresolved');
  }
});

it('requires sphere clearance above the actual top rather than a center-only or infinitely high wall interpretation', () => {
  const original = descriptor(), d = { ...original, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: 0, y: 1.02, z: 0 } } } };
  expect(querySourceFenceOverflightV146(input(d))).toMatchObject({ kind: 'unresolved', reason: 'finite_fence_clearance_unproved' });
  const q = input(); expect(witnessed(q).clearance.minimumTopMeters).toBeGreaterThan(3);
});

it('requires top clearance throughout the transit even when the final outside ball alone is clear', () => {
  const original = descriptor(), d = { ...original, initial: { ...original.initial,
    ball: { ...original.initial.ball, velocity: { x: 30, y: 10, z: 0 } } } };
  const q = input(d), low = witnessed(q), radius = d.profile.ground.radiusM;
  const top = (low.entry.moment.ball.position.y + low.exit.moment.ball.position.y) / 2 - radius;
  expect(low.entry.moment.ball.position.y - radius).toBeLessThan(top);
  expect(low.exit.moment.ball.position.y - radius).toBeGreaterThan(top);
  expect(querySourceFenceOverflightV146({ ...q, fence: { ...q.fence, surface: { ...q.fence.surface, maximumHeight: top } } }))
    .toMatchObject({ kind: 'unresolved', reason: 'finite_fence_clearance_unproved' });
});

it.each(['start', 'end'] as const)('retains finite %s endpoint overlap and rounding ambiguity', edge => {
  const q = input(), radius = q.descriptor.profile.ground.radiusM;
  for (const margin of [-1e-5, 0, 1e-15]) {
    const value = edge === 'start' ? -radius - margin : radius + margin;
    const surface = { ...q.fence.surface, [edge]: { x: 1, z: value } };
    expect(querySourceFenceOverflightV146({ ...q, fence: { ...q.fence, surface } }))
      .toMatchObject({ kind: 'unresolved', reason: 'finite_fence_clearance_unproved' });
  }
});

it('retains actual sphere overlap with the finite fence top', () => {
  const q = input(), result = witnessed(q), top = result.exit.moment.ball.position.y - result.radiusM + 1e-15;
  expect(querySourceFenceOverflightV146({ ...q, fence: { ...q.fence,
    surface: { ...q.fence.surface, maximumHeight: top } } })).toMatchObject({ kind: 'unresolved', reason: 'finite_fence_clearance_unproved' });
});

it('does not certify strictly positive top clearance smaller than the original Source cell rounding bound', () => {
  const q = input(), result = witnessed(q), top = result.exit.moment.ball.position.y - result.radiusM - 1e-15;
  const rawClearance = result.exit.moment.ball.position.y - result.radiusM - top;
  const cell = createSourceFreeBallKernel(q.descriptor).cells.find(c => c.fromElapsedSeconds <= result.exit.witnessElapsedSeconds
    && c.throughElapsedSeconds >= result.exit.witnessElapsedSeconds)!;
  expect(rawClearance).toBeGreaterThan(0);
  expect(rawClearance).toBeLessThan(cell.positionRoundingBoundMeters);
  expect(querySourceFenceOverflightV146({ ...q, fence: { ...q.fence,
    surface: { ...q.fence.surface, maximumHeight: top } } })).toMatchObject({ kind: 'unresolved', reason: 'finite_fence_clearance_unproved' });
});

it('stops at original ground chronology and does not let a later checkpoint hide that ground', () => {
  const original = descriptor(), d = { ...original, initial: { ...original.initial, ball: { ...original.initial.ball,
    position: { x: 0, y: original.profile.ground.radiusM + 1e-7, z: 0 }, velocity: { x: 30, y: -1, z: 0 } } } };
  const kernel = createSourceFreeBallKernel(d), ground = kernel.boundaries.find(b => b.kind === 'ground')!;
  const expected = kernel.evaluateAt(ground.elapsedSeconds, 'incoming').moment;
  expect(querySourceFenceOverflightV146(input(d))).toMatchObject({ kind: 'blocked_by_ground', moment: expected });
  expect(querySourceFenceOverflightV146({ ...input(d), moment: kernel.evaluateAt(0.01).moment, side: 'outgoing' }))
    .toMatchObject({ kind: 'blocked_by_ground', moment: expected });
  const early = { ...original, throughElapsedSeconds: 1, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: 0, y: 1, z: 0 } } } };
  expect(witnessed({ ...input(early), fence: { ...input(early).fence,
    surface: { ...input(early).fence.surface, maximumHeight: 0.1 } } }).exit.witnessElapsedSeconds)
    .toBeLessThan(createSourceFreeBallKernel(early).boundaries.find(b => b.kind === 'ground')!.elapsedSeconds);
});

it('preserves the original lattice/prefix under horizon extension and extra observation checkpoints', () => {
  const q = input(), one = witnessed(q), extended = { ...q.descriptor, throughElapsedSeconds: 0.2 };
  const long = witnessed({ ...q, descriptor: extended, throughElapsedSeconds: 0.2 });
  expect(long.entry).toEqual(one.entry); expect(long.exit).toEqual(one.exit); expect(long.clearance).toEqual(one.clearance);
  const checkpoint = createSourceFreeBallKernel(extended).evaluateAt(0.010123).moment;
  const observed = witnessed({ ...q, descriptor: extended, moment: checkpoint, side: 'outgoing', throughElapsedSeconds: 0.2 });
  expect(observed.entry).toEqual(one.entry); expect(observed.exit).toEqual(one.exit);
});

it('keeps a partial final Source cell on the same curve with compatible actual-time transition brackets', () => {
  const q = input(), partialDescriptor = { ...q.descriptor, throughElapsedSeconds: 0.035123 };
  const partial = witnessed({ ...q, descriptor: partialDescriptor, throughElapsedSeconds: partialDescriptor.throughElapsedSeconds });
  const full = witnessed(q), one = createSourceFreeBallKernel(partialDescriptor), two = createSourceFreeBallKernel(q.descriptor);
  for (const key of ['entry', 'exit'] as const) {
    expect(Math.max(partial[key].firstPossibleElapsedSeconds, full[key].firstPossibleElapsedSeconds))
      .toBeLessThanOrEqual(Math.min(partial[key].witnessElapsedSeconds, full[key].witnessElapsedSeconds));
    for (const time of [partial[key].witnessElapsedSeconds, full[key].witnessElapsedSeconds])
      expect(one.evaluateAt(time)).toEqual(two.evaluateAt(time));
  }
});

it('uses finite rotated geometry and the explicit interior side independently of endpoint order', () => {
  const original = descriptor(), angle = 0.71, c = Math.cos(angle), s = Math.sin(angle);
  const rotate = (p: { x: number; z: number }) => ({ x: c * p.x - s * p.z, z: s * p.x + c * p.z });
  const velocity = rotate(original.initial.ball.velocity), d = { ...original, initial: { ...original.initial,
    ball: { ...original.initial.ball, velocity: { ...velocity, y: 0 } } } }, q = input(d);
  const surface = { ...q.fence.surface, start: rotate(q.fence.surface.start), end: rotate(q.fence.surface.end) };
  for (const changed of [surface, { ...surface, start: surface.end, end: surface.start }]) {
    const result = witnessed({ ...q, fence: { ...q.fence, surface: changed } });
    expect(result.exit.moment.ball.position.x * c + result.exit.moment.ball.position.z * s - 1).toBeGreaterThan(result.radiusM);
    expect(Object.values(result.clearance).every(n => n > 0)).toBe(true);
  }
});

it('preserves a fractional Source clock, real spin decay and seam material basis', () => {
  const original = descriptor(), start = 0.00000035;
  const d = { ...original, initial: { ...original.initial, elapsedSeconds: start, ball: { ...original.initial.ball,
    tick: quantizeEventTick(original.initial.originTick, start, 1_000_000), spin: { x: 12, y: 20, z: -50 } } },
    materialOrientationAtStart: quaternionFromAxisAngle({ x: 1, y: 2, z: 3 }, 0.7), profile: { ...original.profile,
      air: { ...original.profile.air, aerodynamics: { ...REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS,
        seamForce: { version: 'baseball_seam_force_v1' as const, coefficientScale: 1 } } } } };
  const q = input(d), before = JSON.stringify(q), result = witnessed(q), kernel = createSourceFreeBallKernel(d);
  expect(result.entry.moment.originTick).toBe(d.initial.originTick);
  expect(result.exit.moment).toEqual(kernel.evaluateAt(result.exit.witnessElapsedSeconds, 'incoming').moment);
  expect(result.exit.moment.ball.tick).toBe(quantizeEventTick(d.initial.originTick, result.exit.moment.elapsedSeconds, 1_000_000));
  expect(result.exit.moment.ball.spin).not.toEqual(d.initial.ball.spin);
  expect(JSON.stringify(q)).toBe(before);
});

it('requires the caller to cap this research-only query at its independently authenticated physical prefix', () => {
  const q = input(), d = q.descriptor, actor = { playerId: 'earlier-body', primitive: { role: 'body' as const, radius: 0.05,
    startTick: 1000, endTick: 101000, ticksPerSecond: 1_000_000, startCenter: { x: 0.3, y: 5, z: 0 },
    startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } };
  const actual = querySourceFreeBallWorldV2({ descriptor: d, moment: d.initial, side: 'incoming', throughElapsedSeconds: 0.1,
    actors: [actor], surfaces: [q.fence.surface] });
  if (actual.kind !== 'boundary') throw Error('expected independently observed earlier body contact');
  expect(querySourceFenceOverflightV146({ ...q, throughElapsedSeconds: actual.moment.elapsedSeconds }).kind).toBe('no_crossing');
  // An uncapped free Source still extrapolates; its mathematical witness grants
  // no permission to bypass the actual contact, response or original-row join.
  expect(witnessed(q).exit.witnessElapsedSeconds).toBeGreaterThan(actual.moment.elapsedSeconds);
});

it('rejects altered Source moments, unknown policies, malformed geometry and horizon substitution', () => {
  const q = input();
  expect(() => querySourceFenceOverflightV146({ ...q, moment: { ...q.moment,
    ball: { ...q.moment.ball, velocity: { x: 999, y: 0, z: 0 } } } })).toThrow('original Source moment');
  expect(() => querySourceFenceOverflightV146({ ...q, throughElapsedSeconds: 0.2 })).toThrow();
  expect(() => querySourceFenceOverflightV146({ ...q, policy: { ...q.policy, crossing: 'center_only' } } as never)).toThrow();
  expect(() => querySourceFenceOverflightV146({ ...q, fence: { ...q.fence,
    surface: { ...q.fence.surface, end: q.fence.surface.start } } })).toThrow();
  expect(() => querySourceFenceOverflightV146({ ...q, official: true } as never)).toThrow();
});
