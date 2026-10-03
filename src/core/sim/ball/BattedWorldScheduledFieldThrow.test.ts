import { expect, it } from 'vitest';
import { deriveBattedWorldFieldThrow } from './BattedWorldFieldThrow';
import { deriveBattedWorldFieldMotion } from './BattedWorldFieldMotion';
import { prepareBattedWorldScheduledFieldThrow, advanceBattedWorldScheduledFieldThrow,
  validateBattedWorldScheduledFieldThrowPlan, validateBattedWorldScheduledFieldThrowProgress } from './BattedWorldScheduledFieldThrow';
import { fixture, geometry, material, throwInput, v } from './BattedWorldScheduledFieldThrow.test-support';

it('prepares only future work and advances the real moving transfer before release', () => {
  const input = throwInput(), plan = prepareBattedWorldScheduledFieldThrow(input);
  expect(plan.transfer.throwReadyTick).toBe(162_500); expect(plan.releaseElapsedSeconds).toBe(0.1625);
  expect(plan).not.toHaveProperty('field'); expect(plan).not.toHaveProperty('launch');
  const step = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.1 });
  expect(step.kind).toBe('transfer'); expect(step.startCursor).toEqual(input.cursor);
  expect(step.field.motion.carrierPlayerId).toBe('carrier'); expect(step.field.motion.cursor?.moment.ball.position.x).toBeCloseTo(1.1, 14);
  expect(step.field.motion.cursor?.moment.elapsedSeconds).toBe(0.1); expect(step.checkpointElapsedSeconds).toEqual([0.1]);
  expect(step.field.motion.response.kind).toBe('carried'); expect(step).not.toHaveProperty('releaseCursor');
  expect(step).not.toHaveProperty('playEnd'); expect(step).not.toHaveProperty('complete');
  expect(Object.isFrozen(step.field.motion.cursor)).toBe(true); expect(input.cursor.moment.elapsedSeconds).toBe(0.0625);
});

it('resumes serialized accelerated transfer without restarting the delay or reseeding the throw', () => {
  const raw = throwInput(fixture(0, 1, 2)), input = { ...raw,
    commands: raw.commands.map((c) => ({ ...c, acceleration: c.playerId === 'carrier' ? v(2, 0, 0) : v(0, 0, 4) })),
    throwCalibration: { ...raw.throwCalibration, minimumTargetErrorMeters: 0.01, maximumTargetErrorMeters: 0.3 } };
  const plan = prepareBattedWorldScheduledFieldThrow(input), original = deriveBattedWorldFieldThrow(input);
  const first = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.1 });
  const second = advanceBattedWorldScheduledFieldThrow({ plan: JSON.parse(JSON.stringify(plan)), previous: JSON.parse(JSON.stringify(first)), throughElapsedSeconds: 0.15 });
  const final = advanceBattedWorldScheduledFieldThrow({ plan, previous: second, throughElapsedSeconds: 3 });
  expect(final.kind).toBe('released'); expect(original.kind).toBe('released');
  if (final.kind !== 'released' || original.kind !== 'released') throw new Error('release fixture');
  expect(second.startCursor).toEqual(first.field.motion.cursor); expect(final.startCursor).toEqual(second.field.motion.cursor);
  expect(final.transfer).toEqual(original.transfer); expect(final.launch.targetError).toEqual(original.launch.targetError);
  expect(final.launch.intendedTarget).toEqual(original.launch.intendedTarget);
  expect(final.releaseCursor.moment.elapsedSeconds).toBe(0.1625);
  expect(final.releaseCursor.moment.ball.position.x).toBeCloseTo(original.releaseCursor.moment.ball.position.x, 14);
  expect(final.launch.initialVelocity.x).toBeCloseTo(original.launch.initialVelocity.x, 14);
  expect(final.field.motion.carrierPlayerId).toBeNull(); expect(final.field.motion.world.moment.elapsedSeconds).toBe(0.1625);
  expect(final.field.motion.world).toMatchObject({ throughTick: 162_500 });
  if (!final.field.motion.cursor) throw new Error('released cursor fixture');
  const continued = deriveBattedWorldFieldMotion({ response: input.response, geometry: input.geometry, actors: plan.actors,
    cursor: final.field.motion.cursor, carrierPlayerId: null, availableAtTick: 162_500, throughTick: input.throughTick, commands: input.commands });
  expect(continued.motion.world.kind).toBe(original.field.motion.world.kind);
  expect(continued.motion.world.moment.elapsedSeconds).toBeCloseTo(original.field.motion.world.moment.elapsedSeconds, 12);
  for (const axis of ['x', 'y', 'z'] as const) expect(continued.motion.world.moment.ball.position[axis])
    .toBeCloseTo(original.field.motion.world.moment.ball.position[axis], 12);
  expect(() => advanceBattedWorldScheduledFieldThrow({ plan, previous: final, throughElapsedSeconds: 4 })).toThrow(/terminal|released/);
});

it('makes progress within one quantized tick and uses the original secured tick for zero-delay release', () => {
  const input = throwInput(fixture(0, 0.0625 / 0.0625001), 0), plan = prepareBattedWorldScheduledFieldThrow(input);
  const first = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.0625003 });
  const second = advanceBattedWorldScheduledFieldThrow({ plan, previous: first, throughElapsedSeconds: 0.0625007 });
  expect(first.kind).toBe('transfer'); expect(second.kind).toBe('transfer');
  expect(first.field.motion.world.moment.ball.tick).toBe(62_501); expect(second.field.motion.world.moment.ball.tick).toBe(62_501);
  expect(second.field.motion.world.moment.elapsedSeconds).toBe(0.0625007);
  const release = advanceBattedWorldScheduledFieldThrow({ plan, previous: second, throughElapsedSeconds: 0.062501 });
  expect(release.kind).toBe('released'); expect(release.field.motion.world.moment.elapsedSeconds).toBe(0.062501);
});

it('supports immediate release without fabricating a transfer span, including large clocks', () => {
  const input = throwInput(fixture(2 ** 52), 0), plan = prepareBattedWorldScheduledFieldThrow(input);
  const result = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: input.cursor.moment.elapsedSeconds });
  expect(result.kind).toBe('released'); if (result.kind !== 'released') throw new Error('release fixture');
  expect(result.releaseCursor.moment.elapsedSeconds).toBe(input.cursor.moment.elapsedSeconds);
  expect(result.launch.origin).toEqual(input.cursor.moment.ball.position);
  expect(result.launch.releaseTick).toBe(2 ** 52 + 62_500); expect(result.field.motion.carrierPlayerId).toBeNull();
});

it.each([2_000_000, 1_562_500])('interrupts at an earlier or exact-release bag and never creates a launch (delay %i)', (delay) => {
  const input = throwInput(fixture(), delay), plan = prepareBattedWorldScheduledFieldThrow(input);
  const first = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.2 });
  const result = advanceBattedWorldScheduledFieldThrow({ plan, previous: first, throughElapsedSeconds: 2 });
  expect(result.kind).toBe('interrupted'); expect(result.field.baseContacts[0].baseId).toBe('first');
  expect(result.field.motion.world.moment.elapsedSeconds).toBe(1.625);
  expect(result.field.motion.carrierPlayerId).toBe('carrier'); expect(result.field.motion.cursor).toBeNull();
  expect(result).not.toHaveProperty('launch'); expect(result).not.toHaveProperty('releaseCursor');
  expect(() => advanceBattedWorldScheduledFieldThrow({ plan, previous: result, throughElapsedSeconds: 3 })).toThrow(/terminal|interrupted/);
});

it.each(['before', 'exact'] as const)('retains simultaneous bag, wall and actor interruption %s release', (when) => {
  const raw = throwInput(fixture(), when === 'before' ? 2_000_000 : 1_562_500);
  const wall = { surfaceId: 'wall', start: { x: 2.75, z: -1 }, end: { x: 2.75, z: 1 }, minimumHeight: 0, maximumHeight: 2 };
  const actors = raw.actors.map((a) => a.playerId !== 'receiver' ? a : { ...a, primitive: { ...a.primitive, startCenter: v(2.875, 0.5, 0) } });
  const input = { ...raw, actors, response: { ...raw.response, world: { ...raw.response.world, surfaces: [wall] }, surfaces: [{ surfaceId: 'wall', material }] } };
  const plan = prepareBattedWorldScheduledFieldThrow(input);
  const first = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.7 });
  const result = advanceBattedWorldScheduledFieldThrow({ plan, previous: first, throughElapsedSeconds: 3 });
  expect(result.kind).toBe('interrupted'); expect(result.field.motion.world.moment.elapsedSeconds).toBeCloseTo(1.625, 14);
  expect(result.field.baseContacts).toMatchObject([{ kind: 'base', baseId: 'first' }]);
  expect(result.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [
    { kind: 'actor', playerId: 'carrier' }, { kind: 'actor', playerId: 'receiver' },
    { kind: 'surface' }, { kind: 'surface', surfaceId: 'wall' }] });
  expect(result).not.toHaveProperty('launch');
});

it('rejects stale or invented plan/progress, hidden result fields, and checkpoints outside accepted coverage', () => {
  const input = throwInput(), plan = prepareBattedWorldScheduledFieldThrow(input);
  const previous = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.1 });
  const advance = (p = plan, prior = previous, bound = 0.15) => advanceBattedWorldScheduledFieldThrow({ plan: p, previous: prior, throughElapsedSeconds: bound });
  expect(() => advance({ ...plan, transfer: { ...plan.transfer, throwReadyTick: 170_000 } })).toThrow();
  expect(() => advance({ ...plan, actors: [] })).toThrow();
  expect(() => advance(prepareBattedWorldScheduledFieldThrow({ ...input, seed: { ...input.seed, streamKey: 'another-plan' } }))).toThrow();
  expect(() => advance(plan, { ...previous, checkpointElapsedSeconds: [0.11] })).toThrow();
  const cursor = previous.field.motion.cursor!;
  for (const component of ['position', 'velocity'] as const) {
    const forged = { ...cursor, moment: { ...cursor.moment, ball: { ...cursor.moment.ball,
      [component]: { ...cursor.moment.ball[component], x: cursor.moment.ball[component].x + 0.01 } } } };
    expect(() => advance(plan, { ...previous, field: { ...previous.field, motion: { ...previous.field.motion,
      cursor: forged, response: { kind: 'carried', cursor: forged }, world: { ...previous.field.motion.world, moment: forged.moment } } } })).toThrow();
  }
  expect(() => validateBattedWorldScheduledFieldThrowPlan(JSON.parse(JSON.stringify(plan)))).not.toThrow();
  expect(() => validateBattedWorldScheduledFieldThrowProgress(plan, JSON.parse(JSON.stringify(previous)))).not.toThrow();
  expect(() => validateBattedWorldScheduledFieldThrowProgress(plan, { ...previous, planIdentity: 'forged' })).toThrow();
  expect(() => advance(plan, { ...previous, field: { ...previous.field, baseContacts: [{ kind: 'base', baseId: 'first' } as never] } })).toThrow();
  expect(() => advance(plan, { ...previous, startCursor: input.cursor, playEnd: true } as unknown as typeof previous)).toThrow();
  expect(() => advance(plan, previous, 0.1)).toThrow(/progress|checkpoint/);
  expect(() => advance(plan, previous, 5.0000001)).toThrow(/coverage|horizon/);
  expect(() => advance(plan, previous, NaN)).toThrow();
  expect(() => prepareBattedWorldScheduledFieldThrow({ ...input, throughTick: 100_000 })).toThrow(/horizon|coverage/);
  expect(() => prepareBattedWorldScheduledFieldThrow({ ...input, geometry: { ...geometry(), bases: { ...input.geometry.bases,
    first: { ...input.geometry.bases.first, topY: 3 } } } })).toThrow();
  expect(() => prepareBattedWorldScheduledFieldThrow({ ...input, out: true } as typeof input)).toThrow();
});

it.each(['wall', 'actor'] as const)('prioritizes a lone %s contact at the release instant', (kind) => {
  const raw = throwInput(fixture(0, 1, 2));
  const wall = { surfaceId: 'wall', start: { x: 1.375, z: -1 }, end: { x: 1.375, z: 1 }, minimumHeight: 0, maximumHeight: 4 };
  const input = { ...raw, transferParameters: { minimumTransferDelayTicks: 187_500, maximumTransferDelayTicks: 187_500, fixedGripOffsetTicks: 0 },
    ...(kind === 'wall' ? { response: { ...raw.response, world: { ...raw.response.world, surfaces: [wall] }, surfaces: [{ surfaceId: 'wall', material }] } }
      : { actors: raw.actors.map((a) => a.playerId !== 'receiver' ? a : { ...a, primitive: { ...a.primitive, startCenter: v(1.5, 2, 0) } }) }) };
  const plan = prepareBattedWorldScheduledFieldThrow(input);
  const first = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.125 });
  const result = advanceBattedWorldScheduledFieldThrow({ plan, previous: first, throughElapsedSeconds: 0.25 });
  expect(result.kind).toBe('interrupted'); expect(result.field.motion.world.moment.elapsedSeconds).toBe(0.25);
  expect(result.field.baseContacts).toEqual([]); expect(result.field.motion.carrierPlayerId).toBe('carrier');
  expect(result).not.toHaveProperty('releaseCursor'); expect(result).not.toHaveProperty('launch');
});

it('checks initial contacts before an immediate release and keeps transfer custody exclusive', () => {
  const raw = throwInput(fixture(), 0), input = { ...raw, geometry: geometry(1.4375) };
  const plan = prepareBattedWorldScheduledFieldThrow(input);
  const result = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.0625 });
  expect(result.kind).toBe('interrupted'); expect(result.field.motion.world.moment.elapsedSeconds).toBe(0.0625);
  expect(result.field.baseContacts).toMatchObject([{ baseId: 'first' }]);
  expect(result.field.motion.carrierPlayerId).toBe('carrier'); expect(result).not.toHaveProperty('launch');
});

it('keeps original accepted coverage and command basis immutable across every checkpoint', () => {
  const raw = throwInput(fixture(0, 1, 2)), input = { ...raw,
    commands: raw.commands.map((c) => ({ ...c, acceleration: c.playerId === 'carrier' ? v(2, 0, 0) : v(0, 0, 1) })) };
  const plan = prepareBattedWorldScheduledFieldThrow(input);
  const first = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.1 });
  const second = advanceBattedWorldScheduledFieldThrow({ plan, previous: first, throughElapsedSeconds: 0.14 });
  expect(first.field.motion.actors).toEqual(plan.actors); expect(second.field.motion.actors).toEqual(plan.actors);
  expect(second.field.motion.world.moment.ball.velocity.x).toBeCloseTo(1 + 2 * (0.14 - 0.0625), 14);
  expect(second.field.motion.world.moment.ball.position.x).toBeCloseTo(1.0625 + (0.14 - 0.0625) + (0.14 - 0.0625) ** 2, 14);
  expect(plan.input.actors).toEqual(input.actors); expect(plan.input.commands).toEqual(input.commands);
  expect(plan.actors.every((a) => a.primitive.endTick === input.throughTick)).toBe(true);
  expect(() => prepareBattedWorldScheduledFieldThrow({ ...input, commands: input.commands.slice(1) })).toThrow();
  expect(() => prepareBattedWorldScheduledFieldThrow({ ...input, cursor: { ...input.cursor,
    moment: { ...input.cursor.moment, ball: { ...input.cursor.moment.ball, velocity: v(9, 0, 0) } } } })).toThrow(/velocity/);
  expect(() => prepareBattedWorldScheduledFieldThrow({ ...input, throwCalibration: { ...input.throwCalibration, maximumReleaseSpeedMps: -1 } })).toThrow();
});

it('keeps the release stable across many short accelerated checkpoints', () => {
  const raw = throwInput(fixture(0, 1, 5), 500_000), input = { ...raw,
    commands: raw.commands.map((c) => ({ ...c, acceleration: c.playerId === 'carrier' ? v(1.7, 0.3, -0.2) : v(0.3, 0, 0.7) })),
    throwCalibration: { ...raw.throwCalibration, minimumTargetErrorMeters: 0.01, maximumTargetErrorMeters: 0.3 } };
  const plan = prepareBattedWorldScheduledFieldThrow(input), original = deriveBattedWorldFieldThrow(input);
  let previous: ReturnType<typeof advanceBattedWorldScheduledFieldThrow> | null = null;
  for (let index = 1; index <= 17; index++) {
    previous = advanceBattedWorldScheduledFieldThrow({ plan, previous, throughElapsedSeconds: 0.0625 + 0.5 * index / 17 });
    expect(previous.kind, `checkpoint ${index}`).toBe(index === 17 ? 'released' : 'transfer');
  }
  if (previous?.kind !== 'released' || original.kind !== 'released') throw new Error('release fixture');
  expect(previous.launch.targetError).toEqual(original.launch.targetError);
  for (const axis of ['x', 'y', 'z'] as const) {
    expect(previous.launch.origin[axis]).toBeCloseTo(original.launch.origin[axis], 12);
    expect(previous.launch.initialVelocity[axis]).toBeCloseTo(original.launch.initialVelocity[axis], 12);
  }
});

it('preserves a nonaxial original glove offset rather than snapping the carried ball to the glove', () => {
  const raw = throwInput(fixture(0, 1, 2)), cursor = { ...raw.cursor,
    moment: { ...raw.cursor.moment, ball: { ...raw.cursor.moment.ball, position: v(1.1125, 2.05, 0.03) } } };
  const input = { ...raw, cursor, commands: raw.commands.map((c) => ({ ...c,
    acceleration: c.playerId === 'carrier' ? v(1.7, 0.3, -0.2) : v(0, 0, 0) })) };
  const plan = prepareBattedWorldScheduledFieldThrow(input), first = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.1 });
  const released = advanceBattedWorldScheduledFieldThrow({ plan, previous: first, throughElapsedSeconds: 0.1625 });
  expect(released.kind).toBe('released'); if (released.kind !== 'released') throw new Error('release fixture');
  expect(released.launch.origin.x).toBeCloseTo(1.1125 + 0.1 + 0.5 * 1.7 * 0.1 ** 2, 14);
  expect(released.launch.origin.y).toBeCloseTo(2.05 + 0.5 * 0.3 * 0.1 ** 2, 14);
  expect(released.launch.origin.z).toBeCloseTo(0.03 - 0.5 * 0.2 * 0.1 ** 2, 14);
  const changed = prepareBattedWorldScheduledFieldThrow({ ...input, cursor: { ...cursor,
    moment: { ...cursor.moment, ball: { ...cursor.moment.ball, position: v(1.1225, 2.05, 0.03) } } } });
  expect(() => advanceBattedWorldScheduledFieldThrow({ plan: changed, previous: first, throughElapsedSeconds: 0.1625 })).toThrow(/progress/);
});

it('retains a same-time post-release ground contact instead of claiming a safe flight handoff', () => {
  const raw = throwInput(fixture(0, 1, 0.125));
  const input = { ...raw, commands: raw.commands.map((c) => ({ ...c, acceleration: c.playerId === 'receiver' ? v(0, -2, 0) : v(0, 0, 0) })) };
  const plan = prepareBattedWorldScheduledFieldThrow(input);
  const result = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 1 });
  expect(result.kind).toBe('released'); if (result.kind !== 'released') throw new Error('release fixture');
  expect(result.launch.initialVelocity.y).toBeLessThan(0);
  expect(result.field.motion.world).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: 0.1625 } });
  expect(result.field.motion.response.kind).toBe('unresolved'); expect(result.field.motion.cursor).toBeNull();
  expect(result.field.motion.carrierPlayerId).toBeNull(); expect(result.releaseCursor.moment.ball.velocity.y).toBeLessThan(0);
});

it.each([0.3, 1.7, 2.3].flatMap((acceleration) => [1, 3, 4, 17, 100].map((count) => ({ acceleration, count }))))(
  'keeps exact release contact and ownership identical after $count deltas with acceleration $acceleration', ({ acceleration, count }) => {
  const raw = throwInput(fixture(0, 1, 0.125), 500_000), input = { ...raw,
    commands: raw.commands.map((c) => ({ ...c, acceleration: c.playerId === 'carrier' ? v(acceleration, 0, 0) : v(0, 0, 0) })),
    actors: raw.actors.map((a) => a.playerId !== 'receiver' ? a : { ...a, primitive: { ...a.primitive, startCenter: v(-10, 0, 0) } }) };
  const plan = prepareBattedWorldScheduledFieldThrow(input);
  let previous: ReturnType<typeof advanceBattedWorldScheduledFieldThrow> | null = null;
  for (let index = 1; index <= count; index++) previous = advanceBattedWorldScheduledFieldThrow({ plan, previous,
    throughElapsedSeconds: 0.0625 + 0.5 * index / count });
  if (previous?.kind !== 'released') throw new Error('release fixture');
  const uninterrupted = deriveBattedWorldFieldThrow(input);
  if (uninterrupted.kind !== 'released') throw new Error('uninterrupted release fixture');
  expect(previous.releaseCursor).toEqual(uninterrupted.releaseCursor); expect(previous.launch).toEqual(uninterrupted.launch);
  expect(previous.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [
    { kind: 'actor', playerId: 'carrier', continuing: true }, { kind: 'ground' }] });
  const world = previous.field.motion.world;
  if (world.kind !== 'boundary') throw new Error('boundary fixture');
  const glove = world.contacts.find((contact) => contact.kind === 'actor');
  if (!glove || glove.kind !== 'actor') throw new Error('glove fixture');
  expect(glove.velocity.x).toBeCloseTo(1 + 0.5 * acceleration, 14); expect(glove.velocity.y).toBe(0); expect(glove.velocity.z).toBe(0);
  expect(previous.field.motion.response).toEqual({ kind: 'unresolved', reason: 'simultaneous', cursor: null });
  expect(previous.field.motion.cursor).toBeNull(); expect(previous.field.motion.carrierPlayerId).toBeNull();
  expect(previous.field.motion.actors).toEqual(plan.actors);
  expect(previous.releaseCursor.moment.ball.position.x).toBeCloseTo(1.5625 + 0.125 * acceleration, 14);
});
