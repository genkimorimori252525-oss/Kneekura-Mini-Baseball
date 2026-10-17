import { expect, it } from 'vitest';
import { deriveSourceBattedFieldAcquisitionV1 as derive, type SourceBattedFieldAcquisitionInputV1 } from './SourceBattedFieldAcquisitionV1';
import { sourceGloveFixture } from './SourceBattedFieldAcquisitionV1.test-support';
import { createSourceFreeBallKernel } from './SourceFreeBallKernel';

const input = (accelerationX = -4, capacityJ = 100): SourceBattedFieldAcquisitionInputV1 => {
  const initial = sourceGloveFixture(capacityJ);
  return { initial, actions: [{ kind: 'adopt', availableAtTick: initial.availableAtTick, coverageThroughTick: initial.coverageThroughTick,
    commands: initial.commands.map(command => ({ ...command, acceleration: { x: accelerationX, y: 0, z: 0 } })) },
  { kind: 'advance', throughTick: 212345 }], captureThroughElapsedSeconds: [] };
};

it('reconstructs the original Source contact and leaves an unadvanced glove candidate unpossessed', () => {
  const raw = input(), bytes = JSON.stringify(raw), result = derive(raw), moment = result.plan.contactMoment;
  expect(result.field).toEqual(result.freeTrace.field); expect(result.progress).toBeNull();
  expect(result.field.motion.response.kind).toBe('capture_candidate'); expect(result.field.motion.carrierPlayerId).toBeNull();
  expect(result.field.motion.cursor).toBeNull(); expect(result.plan.initialEnergyJ).toBeGreaterThan(0);
  expect(moment).toEqual(createSourceFreeBallKernel({ ...raw.initial.cursor.sourceCurve!, throughElapsedSeconds: moment.elapsedSeconds })
    .evaluateAt(moment.elapsedSeconds, 'incoming').moment);
  expect(result.nativeAdmission).toBe(false); expect(result.official).toBeNull();
  expect(JSON.stringify(raw)).toBe(bytes); expect(Object.isFrozen(result.field.motion.world)).toBe(true);
});

it('executes energy absorption and the recorded custody fence along the actual accelerated glove curve', () => {
  const raw = input(), { plan } = derive(raw), start = plan.contactMoment.elapsedSeconds;
  expect(plan.fenceElapsedSeconds).toBeGreaterThan(plan.secureElapsedSeconds);
  const result = derive({ ...raw, captureThroughElapsedSeconds: [(start + plan.secureElapsedSeconds) / 2, plan.secureElapsedSeconds, plan.fenceElapsedSeconds] });
  expect(result.steps.map(step => step.progress.kind)).toEqual(['capturing', 'fence_pending', 'secured']);
  expect(result.steps.slice(0, 2).every(step => step.field.motion.carrierPlayerId === null && step.field.motion.cursor === null)).toBe(true);
  expect(result.field.motion.response.kind).toBe('carried'); expect(result.field.motion.carrierPlayerId).toBe(plan.acquirerPlayerId);
  expect(result.field.motion.cursor!.moment.elapsedSeconds).toBe(plan.fenceElapsedSeconds);
  expect(result.progress?.transport.remainingEnergyJ).toBe(0);
  const actor = result.field.motion.actors.find(actor => actor.playerId === plan.acquirerPlayerId && actor.primitive.role === 'glove')!;
  const moment = result.field.motion.world.moment, dt = (moment.originTick - actor.primitive.startTick) / 1e6 + moment.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
  for (const axis of ['x', 'y', 'z'] as const) {
    const center = actor.primitive.startCenter[axis] + actor.primitive.startVelocity[axis] * dt + .5 * actor.primitive.acceleration[axis] * dt ** 2;
    expect(moment.ball.position[axis]).toBeCloseTo(center + plan.contactOffset[axis], 12);
    expect(moment.ball.velocity[axis]).toBeCloseTo(actor.primitive.startVelocity[axis] + actor.primitive.acceleration[axis] * dt, 12);
  }
  expect(result.field.motion.actors).toEqual(result.freeTrace.field.motion.actors);
});

it('keeps the secured physical field identical for atomic versus partial observation and rejects advancing a terminal capture', () => {
  const raw = input(), { plan } = derive(raw), partial = derive({ ...raw, captureThroughElapsedSeconds: [plan.secureElapsedSeconds, plan.fenceElapsedSeconds] });
  const atomic = derive({ ...raw, captureThroughElapsedSeconds: [plan.fenceElapsedSeconds + .1] });
  expect(atomic.field).toEqual(partial.field);
  expect(() => derive({ ...raw, captureThroughElapsedSeconds: [plan.fenceElapsedSeconds, plan.fenceElapsedSeconds + .1] })).toThrow('terminal');
  expect(() => derive({ ...raw, captureThroughElapsedSeconds: [plan.secureElapsedSeconds, plan.contactMoment.elapsedSeconds] })).toThrow();
});

it('never converts a missed/failed retention or non-glove field into custody', () => {
  expect(() => derive(input(-4, .001))).toThrow('original physical glove candidate');
  const raw = input(); expect(() => derive({ ...raw, actions: [] })).toThrow('original physical glove candidate');
});

it('keeps a competing real wall contact during absorption interrupted and unpossessed', () => {
  const raw = input(-400, 1000), initial = raw.initial;
  const surface = { surfaceId: 'capture-wall', start: { x: .8, z: -1 }, end: { x: .8, z: 1 }, minimumHeight: 0, maximumHeight: 20 };
  const next = { ...raw, initial: { ...initial, response: { ...initial.response,
    world: { ...initial.response.world, surfaces: [surface] },
    surfaces: [{ surfaceId: surface.surfaceId, material: { restitution: .5, tangentialDamping: .25, spinDamping: .2 } }] } } };
  const result = derive({ ...next, captureThroughElapsedSeconds: [.5] });
  expect(result.progress?.kind).toBe('interrupted'); expect(result.field.motion.response.kind).toBe('capture_interrupted');
  expect(result.field.motion.carrierPlayerId).toBeNull(); expect(result.field.motion.cursor).toBeNull();
  expect(result.field.motion.world.kind).toBe('boundary');
  expect(result.field.motion.world.moment.elapsedSeconds).toBeLessThan(result.plan.secureElapsedSeconds);
});

it('rejects caller custody/plan injection, active values, invalid clocks, excessive history and expired actor coverage', () => {
  const raw = input();
  for (const extra of [{ carrierPlayerId: 'fielder' }, { cursor: {} }, { plan: {} }, { acquisition: {} }]) {
    expect(() => derive({ ...raw, ...extra } as never)).toThrow('scope');
  }
  for (const checkpoint of [NaN, Infinity, -.1, '0.1']) expect(() => derive({ ...raw, captureThroughElapsedSeconds: [checkpoint] } as never)).toThrow();
  expect(() => derive({ ...raw, captureThroughElapsedSeconds: Array(257).fill(.1) })).toThrow('scope');
  let reads = 0; expect(() => derive({ ...raw, get captureThroughElapsedSeconds() { reads++; return []; } })).toThrow(); expect(reads).toBe(0);
  const endTick = raw.initial.availableAtTick + 40_000;
  const actors = raw.initial.actors.map(actor => ({ ...actor, primitive: { ...actor.primitive, endTick } }));
  const shortened = { ...raw.initial, coverageThroughTick: endTick, actors,
    response: { ...raw.initial.response, world: { ...raw.initial.response.world, actors } } };
  expect(() => derive({ initial: shortened, actions: [{ kind: 'advance', throughTick: endTick }], captureThroughElapsedSeconds: [] })).toThrow('coverage');
});
