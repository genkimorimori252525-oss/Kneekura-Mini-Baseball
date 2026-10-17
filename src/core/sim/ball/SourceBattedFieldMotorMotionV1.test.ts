import { expect, it } from 'vitest';
import { createSourceFreeBallKernel } from './SourceFreeBallKernel';
import { sourceGloveFixture as gloveFixture } from './SourceBattedFieldAcquisitionV1.test-support';
import { prepareBattedWorldScheduledFieldAcquisition, advanceBattedWorldScheduledFieldAcquisition } from './BattedWorldScheduledFieldAcquisition';
import { deriveSourceBattedFieldMotionV3 } from './SourceBattedFieldMotionV3';
import { sourceFieldV3Fixture as fixture } from './SourceBattedFieldMotionV3.test-support';
import { deriveSourceBattedFieldMotorMotionV1, type SourceBattedFieldMotorActionV1 } from './SourceBattedFieldMotorMotionV1';
import { advanceSourceFieldToIntegerBoundaryV1 } from './SourceFieldIntegerBoundaryV1';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const advance = (throughTick: number): SourceBattedFieldMotorActionV1 => ({ kind: 'advance', throughTick });
const adopt = (x: ReturnType<typeof fixture>, acceleration = v()): Extract<SourceBattedFieldMotorActionV1, { kind: 'adopt' }> => ({ kind: 'adopt',
  availableAtTick: x.availableAtTick, coverageThroughTick: x.coverageThroughTick,
  commands: x.commands.map(c => ({ ...c, acceleration })) });

it('retains the stationary V3 physical results and certificates without Native or official authority', () => {
  const x = fixture(), throughTicks = [212345, 212345], prior = JSON.stringify(x);
  const legacy = deriveSourceBattedFieldMotionV3({ initial: x, throughTicks });
  const actual = deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: throughTicks.map(advance) });
  expect(actual.initial).toEqual(legacy.initial);
  expect(actual.steps.map(s => s.field)).toEqual(legacy.steps.map(s => s.field));
  expect(actual.field).toEqual(legacy.field);
  expect(actual.impulseCertificates.map(s => s.diagnostic)).toEqual(legacy.impulseCertificates.map(s => s.diagnostic));
  expect(actual.nativeAdmission).toBe(false); expect(actual.official).toBeNull();
  expect(JSON.stringify(x)).toBe(prior);
});

it('adopts actor acceleration at the true fractional ground moment without rebasing the ball or rounding actor motion', () => {
  const x = fixture(); x.response.world.surfaces = []; x.response.surfaces = [];
  const baseline = deriveSourceBattedFieldMotionV3({ initial: x, throughTicks: [512345] });
  expect(baseline.field.motion.response.kind).toBe('ground');
  const before = baseline.field.motion.cursor!;
  expect(before.moment.elapsedSeconds).not.toBe((before.moment.ball.tick - before.moment.originTick) / 1e6);
  const trace = deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [advance(512345), adopt(x, v(3)), advance(512345)] });
  const adopted = trace.steps[1].field.motion;
  expect(adopted.cursor).toEqual(before);
  expect(adopted.actors[0].startElapsedSeconds).toBe(before.moment.elapsedSeconds);
  expect(adopted.actors[0].primitive.startCenter).toEqual(x.actors[0].primitive.startCenter);
  const cursor = trace.field.motion.cursor!;
  expect(cursor.sourceCurve!.initial).toEqual(x.cursor.sourceCurve.initial);
  expect(cursor.moment).toEqual(createSourceFreeBallKernel(cursor.sourceCurve!).evaluateAt(0.5, cursor.sourceSide).moment);
  expect(trace.field.motion.actors[0].primitive.acceleration).toEqual(v(3));
});

it('uses actual moving body contact velocity for the original impulse and certified escape', () => {
  const x = fixture(); x.response.world.surfaces = []; x.response.surfaces = [];
  x.actors[0].primitive.startCenter = v(3, 0.98, 0);
  const trace = deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [adopt(x, v(-4)), advance(212345), advance(212345)] });
  const hit = trace.steps[1].field.motion.world;
  expect(hit.kind).toBe('boundary');
  if (hit.kind !== 'boundary') throw new Error('expected actual body contact');
  const contact = hit.contacts[0]; expect(contact.kind).toBe('actor');
  if (contact.kind !== 'actor') throw new Error('expected actor');
  expect(contact.velocity.x).toBeCloseTo(-4 * hit.moment.elapsedSeconds, 12);
  expect(trace.steps[1].field.motion.response.kind).toBe('rebound');
  expect(trace.impulseCertificates).toHaveLength(1); expect(trace.escapedIntervals).toHaveLength(1);
  expect(trace.field.motion.world.kind).toBe('moving');
  expect(trace.field.motion.cursor!.moment).toEqual(createSourceFreeBallKernel(trace.field.motion.cursor!.sourceCurve!).evaluateAt(0.2).moment);
});

it('continues actor center and velocity across a second adoption instead of accepting caller replacement positions', () => {
  const x = fixture(); x.response.world.surfaces = []; x.response.surfaces = [];
  const trace = deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [adopt(x, v(4)), advance(62345), adopt(x, v(-2))] });
  const actor = trace.field.motion.actors[0];
  expect(actor.startElapsedSeconds).toBe(0.05);
  expect(actor.primitive.startCenter.x).toBeCloseTo(1000 + 0.5 * 4 * 0.05 ** 2, 12);
  expect(actor.primitive.startVelocity.x).toBeCloseTo(0.2, 12);
  expect(actor.primitive.acceleration).toEqual(v(-2));
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [{ ...adopt(x), actors: x.actors } as never] })).toThrow();
});

it('rejects future availability, incomplete commands, expired coverage, malformed actions and caller proof injection', () => {
  const x = fixture(), command = adopt(x);
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [{ ...command, availableAtTick: x.availableAtTick + 1 } as never] })).toThrow();
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [{ ...command, commands: [] } as never] })).toThrow();
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [{ ...command, coverageThroughTick: x.availableAtTick } as never] })).toThrow();
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [advance(1)] })).toThrow();
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [{ kind: 'capture' } as never] })).toThrow();
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [], certificates: [] } as never)).toThrow();
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: { ...x, carrierPlayerId: 'fielder' }, actions: [] })).toThrow();
});

it('does not transfer an immediately preceding impulse escape certificate to changed actor curves', () => {
  const x = fixture();
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [advance(212345), adopt(x, v(1)), advance(212345)] })).toThrow();
});

it('authenticates exact fractional availability instead of interpreting the quantized occurrence tick as elapsed time', () => {
  const x = fixture(); x.response.world.surfaces = []; x.response.surfaces = [];
  const ground = deriveSourceBattedFieldMotionV3({ initial: x, throughTicks: [512345] }).field.motion.cursor!;
  const command = { ...adopt(x), availableAtTick: ground.moment.ball.tick };
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [advance(512345), command] })).toThrow();
  const trace = deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [advance(512345),
    { ...command, availableAtElapsedSeconds: ground.moment.elapsedSeconds }] });
  expect(trace.field.motion.cursor).toEqual(ground);
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [advance(512345),
    { ...command, availableAtElapsedSeconds: ground.moment.elapsedSeconds + 1e-7 }] })).toThrow();
});

it('stops at finite actor coverage and rejects a changed primitive clock without renewing old curves', () => {
  const x = fixture();
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [
    { ...adopt(x), coverageThroughTick: 112345 }, advance(212345)] })).toThrow();
  const otherClock = { ...x, actors: x.actors.map(a => ({ ...a, primitive: { ...a.primitive, ticksPerSecond: 1000 } })) };
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: otherClock, actions: [] })).toThrow();
});

it('rejects an unresolved original root even when the replay contains no actions', () => {
  const x = fixture(); x.actors[0].primitive.startCenter = x.cursor.moment.ball.position;
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [] })).toThrow('free');
});

it('ends at an actual moving glove candidate without granting possession or advancing a free cursor past contact', () => {
  const x = gloveFixture(), command = { kind: 'adopt' as const, availableAtTick: x.availableAtTick,
    coverageThroughTick: x.coverageThroughTick, commands: x.commands.map(c => ({ ...c, acceleration: v(-4) })) };
  const trace = deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [command, advance(212345)] });
  expect(trace.field.motion.response.kind).toBe('capture_candidate');
  expect(trace.field.motion.carrierPlayerId).toBeNull(); expect(trace.field.motion.cursor).toBeNull();
  const world = trace.field.motion.world;
  expect(world.kind).toBe('boundary'); if (world.kind !== 'boundary') throw new Error('real glove boundary required');
  const contact = world.contacts[0];
  expect(contact.kind).toBe('actor'); if (contact.kind !== 'actor') throw new Error('real glove actor required');
  expect(contact.role).toBe('glove');
  expect(contact.velocity.x).toBeCloseTo(-4 * world.moment.elapsedSeconds, 12);
  expect(world.moment).toEqual(createSourceFreeBallKernel({ ...x.cursor.sourceCurve!, throughElapsedSeconds: world.moment.elapsedSeconds })
    .evaluateAt(world.moment.elapsedSeconds, 'incoming').moment);
  expect(trace.impulseCertificates).toHaveLength(0); expect(trace.official).toBeNull();
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [command, advance(212345), advance(312345)] })).toThrow();
  expect(() => deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [command, advance(212345), command] })).toThrow();
});

it('passes the original Source glove contact into energy dissipation and recorded possession fence without a gravity flight replay', () => {
  const x = gloveFixture(), trace = deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [advance(212345)] });
  const plan = prepareBattedWorldScheduledFieldAcquisition({ response: x.response, geometry: x.geometry, field: trace.field });
  expect(plan.contactMoment).toEqual(trace.field.motion.world.moment);
  expect(plan.initialEnergyJ).toBeGreaterThan(0); expect(plan.secureElapsedSeconds).toBeGreaterThan(plan.contactMoment.elapsedSeconds);
  const pending = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: null,
    throughElapsedSeconds: (plan.contactMoment.elapsedSeconds + plan.secureElapsedSeconds) / 2 });
  expect(pending.kind).toBe('capturing'); expect(pending.cursor).toBeNull();
  const secured = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: pending, throughElapsedSeconds: plan.fenceElapsedSeconds });
  expect(secured.kind).toBe('secured'); if (secured.kind !== 'secured') throw new Error('physical possession fence required');
  expect(secured.acquisition.acquirerPlayerId).toBe(x.actors[0].playerId);
  expect(secured.cursor.moment).toEqual(secured.world.moment);
  expect(secured.transport.remainingEnergyJ).toBe(0);
  expect(secured.cursor.moment.elapsedSeconds).toBe(plan.fenceElapsedSeconds);
  expect(trace.field.motion.carrierPlayerId).toBeNull();
});

it('retains a failed glove catch as a live Source rebound with its real outgoing velocity and certified escape', () => {
  const x = gloveFixture(.001), trace = deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [advance(212345), advance(212345)] });
  const response = trace.steps[0].field.motion.response;
  expect(response.kind).toBe('rebound'); if (response.kind !== 'rebound') throw new Error('retention failure must stay live');
  expect(response.retention?.outcome.kind).toBe('live-ball');
  if (response.retention?.outcome.kind !== 'live-ball') throw new Error('no possession on failed retention');
  expect(response.cursor.moment.ball).toEqual(response.retention.outcome.ball);
  expect(trace.impulseCertificates).toHaveLength(1); expect(trace.escapedIntervals).toHaveLength(1);
  expect(trace.field.motion.carrierPlayerId).toBeNull(); expect(trace.field.motion.cursor).not.toBeNull();
  const cursor = trace.field.motion.cursor!;
  expect(cursor.moment).toEqual(createSourceFreeBallKernel(cursor.sourceCurve!).evaluateAt(.2).moment);
  expect(cursor.sourceCurve!.initial).toEqual(response.cursor.moment);
});

it('joins original ground, positive integer wait, motor adoption and advance on one original ball basis', () => {
  const x = fixture(); x.response.world.surfaces = []; x.response.surfaces = [];
  const throughTicks = [812345], waited = advanceSourceFieldToIntegerBoundaryV1({ initial: x, throughTicks });
  expect(waited.kind).toBe('reached_integer_boundary');
  expect(waited.boundary.waitSeconds).toBeGreaterThan(0);
  const atInteger = waited.trace.field.motion.cursor!, motor = { ...adopt(x, v(3)), availableAtTick: waited.boundary.boundaryTick };
  const targetTick = waited.boundary.boundaryTick + 1000;
  const trace = deriveSourceBattedFieldMotorMotionV1({ initial: x, actions: [advance(throughTicks[0]),
    advance(waited.boundary.boundaryTick), motor, advance(targetTick)] });
  expect(trace.steps[1].field).toEqual(waited.trace.field);
  expect(trace.steps[2].field.motion.cursor).toEqual(atInteger);
  expect(trace.steps[2].field.motion.actors[0].startElapsedSeconds).toBe(waited.boundary.boundaryElapsedSeconds);
  expect(trace.steps[2].field.motion.actors[0].primitive.startVelocity).toEqual(v());
  const final = trace.field.motion.cursor!, endpoint = (targetTick - final.moment.originTick) / 1e6;
  expect(final.moment.elapsedSeconds).toBe(endpoint);
  expect(final.moment).toEqual(createSourceFreeBallKernel(final.sourceCurve!).evaluateAt(endpoint, final.sourceSide).moment);
  expect(final.sourceCurve!.initial).toEqual(x.cursor.sourceCurve.initial);
  expect(final.sourceCurve!.profile).toEqual(x.cursor.sourceCurve.profile);
  expect(final.moment.ball.position).not.toEqual(atInteger.moment.ball.position);
  expect(final.moment.ball.spin).not.toEqual(atInteger.moment.ball.spin);
  const actor = trace.field.motion.actors[0], dt = final.moment.elapsedSeconds - actor.startElapsedSeconds!;
  expect(dt).toBeCloseTo(0.001, 15);
  expect(actor.primitive.startCenter.x + actor.primitive.acceleration.x * dt ** 2 / 2).toBeCloseTo(1000.0000015, 12);
  expect(actor.primitive.startVelocity.x + actor.primitive.acceleration.x * dt).toBeCloseTo(0.003, 15);
  expect(trace.nativeAdmission).toBe(false); expect(trace.official).toBeNull();
});
