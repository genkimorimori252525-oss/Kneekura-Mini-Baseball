import { expect, it } from 'vitest';
import * as motion from './BattedWorldFieldMotion';
import { fixture } from './BattedWorldScheduledFieldThrow.test-support';

it('adopts complete future commands at zero time and preserves an immediate unresolved contact', () => {
  expect(motion).toHaveProperty('deriveBattedWorldFieldMotionAdoption');
  const f = fixture(), initial = f.response.world.flight.initialBall;
  const { throughTick: coverageThroughTick, ...rest } = f;
  const input = { ...rest, coverageThroughTick, actors: f.response.world.actors,
    cursor: { moment: { originTick: initial.tick, elapsedSeconds: 0, ball: initial }, previousContacts: [] }, carrierPlayerId: null };
  const result = motion.deriveBattedWorldFieldMotionAdoption(input);
  expect(result.motion.world.moment.elapsedSeconds).toBe(0); expect(result.motion.world.kind).toBe('boundary');
  expect(result.motion.cursor).toBeNull(); expect(result.motion.response.kind).toBe('capture_candidate');
  expect(result.motion.actors.map((a) => [a.primitive.startCenter, a.primitive.startVelocity])).toEqual(
    input.actors.map((a) => [a.primitive.startCenter, a.primitive.startVelocity]));
  expect(result.motion.actors.every((a) => a.primitive.endTick === 5_000_000)).toBe(true);
});

it('rejects fractional zero-time adoption, unsafe coverage, missing commands and unavailable commands', () => {
  const f = fixture(), initial = f.response.world.flight.initialBall;
  const { throughTick: coverageThroughTick, ...rest } = f;
  const input = { ...rest, coverageThroughTick, actors: f.response.world.actors,
    cursor: { moment: { originTick: initial.tick, elapsedSeconds: 0, ball: initial }, previousContacts: [] }, carrierPlayerId: null };
  expect(() => motion.deriveBattedWorldFieldMotionAdoption({ ...input, commands: [] })).toThrow();
  expect(() => motion.deriveBattedWorldFieldMotionAdoption({ ...input, coverageThroughTick: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
  expect(() => motion.deriveBattedWorldFieldMotionAdoption({ ...input, availableAtTick: 1 })).toThrow();
  expect(() => motion.deriveBattedWorldFieldMotionAdoption({ ...input, cursor: { ...input.cursor, moment: {
    ...input.cursor.moment, elapsedSeconds: 0.0000001, ball: { ...initial, tick: 1 } } } })).toThrow(/integer/);
});

it('replays a long valid complete fifty-actor piece sequence without aggregate clone-size rejection', async () => {
  const { throwInput, material, v } = await import('./BattedWorldScheduledFieldThrow.test-support');
  const { deriveBattedWorldMotionActorsAtExactCoverage } = await import('./BattedWorldMotion');
  const { prepareBattedWorldPiecewiseFieldThrow, deriveBattedWorldPiecewiseFieldThrowProgress } = await import('./BattedWorldPiecewiseFieldThrow');
  const raw = throwInput(), { availableAtTick: _a, throughTick: _t, commands: _c, ...old } = raw;
  const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
  const players = ['carrier', 'receiver', ...Array.from({ length: 8 }, (_, i) => `player-${i}`)];
  const actors = players.flatMap((playerId, player) => roles.map((role, part) => {
    const existing = old.actors.find((a) => a.playerId === playerId && a.primitive.role === role);
    return existing ?? { playerId, primitive: { ...old.actors[0].primitive, role, startCenter: v(100 + player * 20 + part * 2, 10, 100),
      startVelocity: v(0.25, 0.5, 0.125) } };
  }));
  const response = { ...old.response, world: { ...old.response.world, actors }, actors: actors.map((a) => ({ playerId: a.playerId,
    profile: a.primitive.role === 'glove' ? old.response.actors[0].profile : { role: a.primitive.role, material } })) };
  const plan = prepareBattedWorldPiecewiseFieldThrow({ ...old, response, actors });
  type Step = Parameters<typeof deriveBattedWorldPiecewiseFieldThrowProgress>[0]['steps'][number];
  const steps: Step[] = []; let currentActors = actors;
  for (let i = 0; i < 160; i++) {
    const elapsedSeconds = 0.0625 + i / 4096, moment = { ...old.cursor.moment, elapsedSeconds,
      ball: { ...old.cursor.moment.ball, tick: Math.ceil(elapsedSeconds * 1_000_000), position: v(1 + elapsedSeconds, 0.5, 0) } };
    const next = deriveBattedWorldMotionActorsAtExactCoverage({ response, actors: currentActors, cursor: { moment, previousContacts: old.cursor.previousContacts },
      carrierPlayerId: 'carrier', availableAtTick: 0, throughTick: 5_000_000,
      commands: currentActors.map((a) => ({ playerId: a.playerId, role: a.primitive.role, acceleration: v(0, 0, 0) })) });
    steps.push({ throughElapsedSeconds: 0.0625 + (i + 1) / 4096, actors: { kind: 'adopted', actors: next } }); currentActors = [...next];
  }
  const progress = deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps });
  expect(progress.kind).toBe('transfer'); expect(progress.activePiece.actors).toHaveLength(50);
  expect(progress.field.motion.world.moment.elapsedSeconds).toBe(0.0625 + 160 / 4096);
});

it('rejects accessors and sparse, extra-property or cyclic recorded step payloads without evaluating them', async () => {
  const { throwInput } = await import('./BattedWorldScheduledFieldThrow.test-support');
  const { prepareBattedWorldPiecewiseFieldThrow, deriveBattedWorldPiecewiseFieldThrowProgress } = await import('./BattedWorldPiecewiseFieldThrow');
  const { availableAtTick: _a, throughTick: _t, commands: _c, ...input } = throwInput();
  const plan = prepareBattedWorldPiecewiseFieldThrow(input), step = { throughElapsedSeconds: 0.1, actors: { kind: 'retained' as const } };
  let evaluations = 0;
  const getter = Object.defineProperty({}, 'steps', { enumerable: true, get: () => { evaluations++; return [step]; } });
  Object.defineProperty(getter, 'plan', { enumerable: true, value: plan });
  expect(() => deriveBattedWorldPiecewiseFieldThrowProgress(getter as { plan: typeof plan; steps: typeof step[] })).toThrow();
  const steps = [step]; Object.defineProperty(steps, 0, { enumerable: true, get: () => { evaluations++; return step; } });
  expect(() => deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps })).toThrow(); expect(evaluations).toBe(0);
  const sparse = new Array<typeof step>(2); sparse[0] = step;
  expect(() => deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: sparse })).toThrow();
  const extra = [step]; Object.defineProperty(extra, 'extra', { enumerable: false, value: true });
  expect(() => deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: extra })).toThrow();
  const cyclic = { ...step, extra: {} }; cyclic.extra = cyclic;
  expect(() => deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [cyclic] })).toThrow();
});

it('rejects a constrained acceleration residual rather than silently separating the joint', async () => {
  const { acquisitionInput } = await import('./BattedWorldScheduledFieldAcquisition.test-support');
  const { prepareBattedWorldPiecewiseFieldAcquisition } = await import('./BattedWorldPiecewiseFieldAcquisition');
  const { deriveGloveConstrainedBallWorldFieldMotion } = await import('./BallWorldContinuation');
  const plan = prepareBattedWorldPiecewiseFieldAcquisition(acquisitionInput());
  const input = { moment: plan.initialConstraintMoment, parameters: plan.input.response.world.parameters, actors: plan.input.field.motion.actors,
    surfaces: plan.input.response.world.surfaces, bases: plan.input.geometry.bases, previousBaseContacts: [],
    previousContacts: [{ kind: 'actor' as const, playerId: 'carrier', role: 'glove' as const }],
    throughElapsedSeconds: 0.02, acceleration: { x: Number.EPSILON, y: 0, z: 0 }, constraint: { playerId: 'carrier', contactOffset: plan.contactOffset } };
  expect(() => deriveGloveConstrainedBallWorldFieldMotion(input)).toThrow(/constraint/);
});

it('preserves original a309 legacy atomic and scheduled plan/progress bytes', async () => {
  const { createHash } = await import('node:crypto');
  const { fixture, throwInput, v, geometry } = await import('./BattedWorldScheduledFieldThrow.test-support');
  const { acquisitionInput } = await import('./BattedWorldScheduledFieldAcquisition.test-support');
  const acquisition = await import('./BattedWorldScheduledFieldAcquisition');
  const throwing = await import('./BattedWorldScheduledFieldThrow');
  const { deriveBattedWorldFieldAcquisition } = await import('./BattedWorldFieldAcquisition');
  const { deriveBattedWorldFieldThrow } = await import('./BattedWorldFieldThrow');
  const acquisitions = [fixture(), fixture(0, 0.0625 / 0.0625001), { ...fixture(), geometry: geometry(1.40625) }].map((f) => {
    const input = acquisitionInput(f), plan = acquisition.prepareBattedWorldScheduledFieldAcquisition(input);
    const first = acquisition.advanceBattedWorldScheduledFieldAcquisition({ plan, previous: null, throughElapsedSeconds: 0.02 });
    const final = acquisition.advanceBattedWorldScheduledFieldAcquisition({ plan, previous: first, throughElapsedSeconds: 1 });
    return { plan, first, final, atomic: deriveBattedWorldFieldAcquisition(input) };
  });
  const throws = [throwInput(), throwInput(fixture(0, 1, 2)), throwInput(fixture(), 187_500)].map((raw, index) => {
    const input = index === 1 ? { ...raw, commands: raw.commands.map((c) => ({ ...c,
      acceleration: c.playerId === 'carrier' ? v(0.1, 0.3, 0.1) : v(0.3, 0, 0.1) })) } : raw;
    const plan = throwing.prepareBattedWorldScheduledFieldThrow(input);
    const first = throwing.advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.1 });
    const final = throwing.advanceBattedWorldScheduledFieldThrow({ plan, previous: first, throughElapsedSeconds: 1 });
    return { plan, first, final, atomic: deriveBattedWorldFieldThrow(input) };
  });
  // Captured by executing immutable git archive a30967cfe5a8d41a0fc36cf00b361719ba600b08,
  // before executing these fixtures with this version. Original JSON length: 152,369 bytes.
  const bytes = JSON.stringify({ acquisitions, throws });
  expect(Buffer.byteLength(bytes)).toBe(152_369);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('73e9f7567c2acb0019f82cb82f0c5051aabf0ea60067dc3d9610d79681e40779');
});

it('pins zero-time adoption to the original clock and original actor radii', () => {
  const f = fixture(), initial = f.response.world.flight.initialBall;
  const { throughTick: coverageThroughTick, ...rest } = f;
  const input = { ...rest, coverageThroughTick, actors: f.response.world.actors,
    cursor: { moment: { originTick: initial.tick, elapsedSeconds: 0, ball: initial }, previousContacts: [] }, carrierPlayerId: null };
  expect(() => motion.deriveBattedWorldFieldMotionAdoption({ ...input, cursor: { ...input.cursor,
    moment: { ...input.cursor.moment, originTick: 1, ball: { ...initial, tick: 1 } } } })).toThrow();
  expect(() => motion.deriveBattedWorldFieldMotionAdoption({ ...input, actors: input.actors.map((a, index) => index ? a
    : { ...a, primitive: { ...a.primitive, radius: a.primitive.radius * 2 } }) })).toThrow();
});
