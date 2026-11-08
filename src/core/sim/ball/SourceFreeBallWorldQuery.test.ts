import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { querySourceFreeBallWorldV2, type SourceFreeBallWorldQueryInputV2 } from './SourceFreeBallWorldQuery';
import type { BallWorldMotionActor } from './BallWorldContinuation';
import type { BattedBallBasePrism } from './BattedBallBaseContact';
import { sourceRk4PositionBounds } from './SourceFreeBallSpeedBound';

const descriptor = (): SourceFreeBallDescriptorV2 => ({ kind: 'aero_ground_continuous_source_kernel_v2',
  initial: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: { x: 0, y: 1, z: 0 },
    velocity: { x: 30, y: 0, z: 0 }, spin: { x: 0, y: 12, z: -50 } } }, throughElapsedSeconds: 0.1,
  profile: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
    ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366, inertiaRatio: 0.378,
      restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25,
        rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } } });
const query = (d: SourceFreeBallDescriptorV2): SourceFreeBallWorldQueryInputV2 => ({ descriptor: d,
  moment: d.initial, side: 'outgoing', throughElapsedSeconds: d.throughElapsedSeconds, actors: [], surfaces: [] });
const actor = (center: BallWorldMotionActor['primitive']['startCenter'], radius = 0.05): BallWorldMotionActor => ({ playerId: 'fielder',
  primitive: { role: 'glove', radius, startTick: 0, endTick: 3_000_000, ticksPerSecond: 1_000_000,
    startCenter: center, startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } });

it('finds an actor contact wholly between the old 1ms endpoints from the actual nonlinear Source', () => {
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 0.001,
    initial: { ...original.initial, ball: { ...original.initial.ball, velocity: { x: 150, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  const kernel = createSourceFreeBallKernel(d), target = kernel.evaluateAt(0.0005).moment.ball.position, a = actor(target, 0.001);
  const separation = (t: number) => Math.hypot(...(['x', 'y', 'z'] as const).map(k => kernel.evaluateAt(t).moment.ball.position[k] - target[k]));
  expect(separation(0)).toBeGreaterThan(d.profile.ground.radiusM + a.primitive.radius);
  expect(separation(0.001)).toBeGreaterThan(d.profile.ground.radiusM + a.primitive.radius);
  const result = querySourceFreeBallWorldV2({ ...query(d), actors: [a] });
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected actual actor contact');
  expect(result.moment.elapsedSeconds).toBeGreaterThan(0);
  expect(result.moment.elapsedSeconds).toBeLessThan(0.001);
  expect(result.contacts[0]).toMatchObject({ kind: 'actor', playerId: 'fielder', role: 'glove' });
  expect(result.moment).toEqual(kernel.evaluateAt(result.moment.elapsedSeconds).moment);
});

it('clips to the actual continuous ground boundary and preserves the resolved outgoing state at zero elapsed progress', () => {
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 0.000001, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: 0, y: original.profile.ground.radiusM + 1e-7, z: 0 },
      velocity: { x: 0, y: -1, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  const kernel = createSourceFreeBallKernel(d), result = querySourceFreeBallWorldV2(query(d));
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected actual ground');
  expect(result.contacts.map(c => c.kind)).toEqual(['ground']);
  expect(result.moment.elapsedSeconds).toBeLessThan(0.000001);
  expect(result.moment).toEqual(kernel.evaluateAt(result.moment.elapsedSeconds, 'incoming').moment);
  const outgoing = kernel.evaluateAt(result.moment.elapsedSeconds, 'outgoing').moment;
  const resolved = querySourceFreeBallWorldV2({ ...query(d), moment: outgoing, side: 'outgoing', throughElapsedSeconds: outgoing.elapsedSeconds });
  expect(resolved.kind).toBe('moving');
  if (resolved.kind === 'unresolved') throw new Error('unexpected numerical ambiguity');
  expect(resolved.moment).toEqual(outgoing);
  expect(resolved.contacts).toEqual([]);
});

it('uses finite 3D rectangle geometry for a fence and keeps the Source spin/velocity at actual impact', () => {
  const d = descriptor(), kernel = createSourceFreeBallKernel(d);
  const result = querySourceFreeBallWorldV2({ ...query(d), surfaces: [{ surfaceId: 'fence', start: { x: 1, z: -1 },
    end: { x: 1, z: 1 }, minimumHeight: 0, maximumHeight: 3 }] });
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected fence');
  expect(result.contacts[0]).toMatchObject({ kind: 'surface', surfaceId: 'fence' });
  expect(result.moment.ball.position.x).toBeCloseTo(1 - d.profile.ground.radiusM, 9);
  expect(result.moment).toEqual(kernel.evaluateAt(result.moment.elapsedSeconds).moment);
  expect(result.moment.ball.spin).not.toEqual(d.initial.ball.spin);
  expect(querySourceFreeBallWorldV2({ ...query(d), surfaces: [{ surfaceId: 'distant-panel', start: { x: 1, z: 10 },
    end: { x: 1, z: 11 }, minimumHeight: 0, maximumHeight: 3 }] }).kind).toBe('moving');
});

it('queries a rotated base solid against the same nonlinear ball rather than a gravity/rolling surrogate', () => {
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 0.2, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: 0, y: 0.25, z: 0 }, velocity: { x: 6, y: 0, z: 0 } } } };
  const prism = (x: number): BattedBallBasePrism => ({ region: { center: { x, z: 0 }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0.31 }, bottomY: 0, topY: 0.15 });
  const result = querySourceFreeBallWorldV2({ ...query(d), bases: { home: prism(100), first: prism(1), second: prism(110), third: prism(120) } });
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected base solid');
  expect(result.contacts.some(c => c.kind === 'base' && c.baseId === 'first')).toBe(true);
  expect(result.moment).toEqual(createSourceFreeBallKernel(d).evaluateAt(result.moment.elapsedSeconds).moment);
});

it('bounds measured dense-curve displacement in each air/ground Source cell without a frame cadence', () => {
  const d = descriptor(), kernel = createSourceFreeBallKernel({ ...d, throughElapsedSeconds: 2 });
  for (const cell of kernel.cells) {
    const duration = cell.throughElapsedSeconds - cell.fromElapsedSeconds;
    const times = [cell.fromElapsedSeconds, cell.fromElapsedSeconds + duration * 0.21,
      cell.fromElapsedSeconds + duration * 0.79, cell.throughElapsedSeconds];
    for (let i = 1; i < times.length; i++) {
      const a = kernel.evaluateAt(times[i - 1]).moment.ball.position, b = kernel.evaluateAt(times[i]).moment.ball.position;
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z))
        .toBeLessThanOrEqual(cell.maximumPositionSpeedMps * (times[i] - times[i - 1]) + cell.positionRoundingBoundMeters);
    }
  }
});

it('refuses invented initial moments, incomplete actor coverage and caller outcomes', () => {
  const d = descriptor(), input = query(d);
  expect(() => querySourceFreeBallWorldV2({ ...input, moment: { ...d.initial,
    ball: { ...d.initial.ball, velocity: { x: 999, y: 0, z: 0 } } } })).toThrow('original Source moment');
  const short = actor({ x: 1, y: 1, z: 0 });
  expect(() => querySourceFreeBallWorldV2({ ...input, actors: [{ ...short, primitive: { ...short.primitive, endTick: 1 } }] })).toThrow('coverage');
  const fractional = { ...d, throughElapsedSeconds: 0.10000000000000002 };
  expect(() => querySourceFreeBallWorldV2({ ...query(fractional), actors: [{ ...short, primitive: { ...short.primitive, endTick: 100_000 } }] })).toThrow('coverage');
  expect(() => querySourceFreeBallWorldV2({ ...input, result: 'out' } as unknown as SourceFreeBallWorldQueryInputV2)).toThrow();
  const result = querySourceFreeBallWorldV2({ ...input, actors: [actor({ x: 1, y: 1, z: 100 })] });
  expect(result.kind).toBe('moving');
  expect(result).not.toHaveProperty('officialResult');
});

it('leaves an unwitnessed stationary near-contact unresolved within bounded work', () => {
  const original = descriptor(), d = { ...original, initial: { ...original.initial, ball: { ...original.initial.ball,
    position: { x: 0, y: original.profile.ground.radiusM, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  const kernel = createSourceFreeBallKernel(d), moment = kernel.evaluateAt(0, 'outgoing').moment;
  const result = querySourceFreeBallWorldV2({ ...query(d), moment,
    actors: [actor({ x: d.profile.ground.radiusM + 0.05 + 5e-15, y: d.profile.ground.radiusM, z: 0 })] });
  expect(result.kind).toBe('unresolved');
  expect(result).toMatchObject({ reason: 'numerical_contact_refinement_required' });
});

it('certifies a new-basis surface departure without omitting the collider on later queries', () => {
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 0.01, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: -original.profile.ground.radiusM, y: 1, z: 0 },
      velocity: { x: -30, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  const surface = { surfaceId: 'wall', start: { x: 0, z: -1 }, end: { x: 0, z: 1 }, minimumHeight: 0, maximumHeight: 3 };
  const q = { ...query(d), surfaces: [surface], previousContacts: [{ kind: 'surface' as const, surfaceId: surface.surfaceId }] };
  expect(querySourceFreeBallWorldV2(q).kind).toBe('moving');
  expect(querySourceFreeBallWorldV2({ ...q, side: 'incoming' })).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
  expect(querySourceFreeBallWorldV2({ ...q, throughElapsedSeconds: 0 }).kind).toBe('moving');
  const kernel = createSourceFreeBallKernel(d), moment = kernel.evaluateAt(0.005).moment;
  expect(querySourceFreeBallWorldV2({ ...q, moment }).kind).toBe('moving');
  const penetrating = { ...d, initial: { ...d.initial, ball: { ...d.initial.ball, position: { ...d.initial.ball.position, x: -d.profile.ground.radiusM + 1e-15 } } } };
  expect(querySourceFreeBallWorldV2({ ...q, descriptor: penetrating, moment: penetrating.initial }))
    .toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
  const incoming = { ...d, initial: { ...d.initial, ball: { ...d.initial.ball, velocity: { x: 30, y: 0, z: 0 } } } };
  expect(querySourceFreeBallWorldV2({ ...q, descriptor: incoming, moment: incoming.initial }))
    .toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
});

it('preserves exact incoming/outgoing ground sides at a simultaneous resolved wall basis without re-admitting either impulse', () => {
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 0.001, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: -original.profile.ground.radiusM, y: original.profile.ground.radiusM, z: 0 },
      velocity: { x: -30, y: -1, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  const surface = { surfaceId: 'wall', start: { x: 0, z: -1 }, end: { x: 0, z: 1 }, minimumHeight: 0, maximumHeight: 3 };
  const kernel = createSourceFreeBallKernel(d), q = { ...query(d), surfaces: [surface],
    previousContacts: [{ kind: 'surface' as const, surfaceId: 'wall' }], throughElapsedSeconds: 0 };
  const before = querySourceFreeBallWorldV2({ ...q, side: 'incoming' });
  expect(before).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
  if (before.kind === 'unresolved') throw new Error('expected grounded incoming boundary');
  expect(before.contacts.map(c => c.kind).sort()).toEqual(['ground', 'surface']);
  const outgoing = kernel.evaluateAt(0, 'outgoing').moment, after = querySourceFreeBallWorldV2({ ...q, moment: outgoing });
  expect(after.kind).toBe('moving');
  if (after.kind === 'unresolved') throw new Error('expected actual outgoing');
  expect(after.moment).toEqual(outgoing);
  expect(after.contacts).toEqual([]);
  expect(after.moment.ball.tick).toBe(before.moment.ball.tick);
  expect(after.moment.ball.velocity).not.toEqual(before.moment.ball.velocity);
});

it('finds the same actor again after its certified departure rather than excluding it for the whole interval', () => {
  const original = descriptor(), radius = original.profile.ground.radiusM, d = { ...original, throughElapsedSeconds: 0.01, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: original.profile.ground.radiusM + radius, y: 1, z: 0 },
      velocity: { x: 3, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  const target = actor({ x: 0, y: 1, z: 0 }, radius), moving = { ...target,
    primitive: { ...target.primitive, acceleration: { x: 1_000, y: 0, z: 0 } } };
  const result = querySourceFreeBallWorldV2({ ...query(d), actors: [moving], previousContacts: [{ kind: 'actor', playerId: target.playerId, role: 'glove' }] });
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected later real contact');
  expect(result.moment.elapsedSeconds).toBeGreaterThan(0.004);
  expect(result.contacts[0]).toMatchObject({ kind: 'actor', playerId: target.playerId });
  expect(result).not.toHaveProperty('pendingReason');
});

it('bounds the actual dense RK4 position deviation from the physical new-basis velocity', () => {
  const d = descriptor(), kernel = createSourceFreeBallKernel(d), h = 0.002;
  const bound = sourceRk4PositionBounds(d.initial.ball, h, d.profile.air);
  for (const t of [1e-7, 0.00013, 0.0011, h]) {
    const point = kernel.evaluateAt(t).moment.ball.position, initial = d.initial.ball;
    expect(Math.hypot(...(['x', 'y', 'z'] as const).map(axis => point[axis] - initial.position[axis] - initial.velocity[axis] * t)))
      .toBeLessThanOrEqual(bound.linearDeviationMps2 * t * t + kernel.cells[0].positionRoundingBoundMeters);
  }
});
