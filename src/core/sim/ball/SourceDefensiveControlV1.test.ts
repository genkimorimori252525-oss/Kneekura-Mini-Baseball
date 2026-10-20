import { expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import type { BattedWorldFieldMotionAdoptionInput } from './BattedWorldFieldMotion';
import type { BallWorldMotionActor } from './BallWorldContinuation';
import type { BattedActorResponseProfile } from './BattedBallContactResponse';
import { sourceFieldV3Fixture } from './SourceBattedFieldMotionV3.test-support';
import { sourceGloveFixture } from './SourceBattedFieldAcquisitionV1.test-support';
import { createSourceFreeBallKernel } from './SourceFreeBallKernel';
import { createSourceBattedFieldMotorSessionV1, deriveSourceBattedFieldMotorMotionV1 } from './SourceBattedFieldMotorMotionV1';
import { createSourceDefensiveControlV1, type SourceDefensiveControlPlanV1 } from './SourceDefensiveControlV1';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const;
const fixture = () => {
  const x = sourceFieldV3Fixture(), glove = sourceGloveFixture().response.actors[0].profile;
  const actors: BallWorldMotionActor[] = [], profiles: { playerId: string; profile: BattedActorResponseProfile }[] = [];
  const plans: SourceDefensiveControlPlanV1[] = [];
  for (let i = 0; i < 9; i++) {
    const playerId = 'defender-' + i, center = v(1000 + i * 10, 1, 1000);
    for (const [j, role] of roles.entries()) {
      actors.push({ playerId, primitive: { ...x.actors[0].primitive, role, startCenter: { ...center, y: center.y + j * .5 } } });
      profiles.push({ playerId, profile: role === 'glove' ? glove : { role, material: x.response.actors[0].profile.material } });
    }
    plans.push({ playerId, decisionSourceId: 'synthetic-observed-decision-' + i, availableAtTick: x.availableAtTick,
      movementStartTick: x.availableAtTick, reviewAtTick: x.availableAtTick + 80_000, bodyOffset: { x: 0, z: 0 },
      waypoints: [{ x: center.x + 10, z: center.z }], parameters: { ticksPerSecond: 1e6, maxIntegrationStepTicks: 2000,
        accelerationMps2: 4, brakingMps2: 4, topSpeedMps: 8, arrivalRadiusMeters: .05 } });
  }
  const initial: BattedWorldFieldMotionAdoptionInput = { ...x, actors,
    response: { ...x.response, world: { ...x.response.world, actors, surfaces: [] }, actors: profiles, surfaces: [] },
    commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: v() })) };
  return { initial, priorActions: [] as Parameters<typeof deriveSourceBattedFieldMotorMotionV1>[0]['actions'], plans };
};
const sampled = (a: BallWorldMotionActor, elapsed: number, origin: number): { position: Vec3; velocity: Vec3 } => {
  const b = a.primitive, dt = (origin - b.startTick) / b.ticksPerSecond + elapsed - (a.startElapsedSeconds ?? 0);
  const pos = (axis: keyof Vec3) => b.startCenter[axis] + b.startVelocity[axis] * dt + .5 * b.acceleration[axis] * dt * dt;
  const vel = (axis: keyof Vec3) => b.startVelocity[axis] + b.acceleration[axis] * dt;
  return { position: { x: pos('x'), y: pos('y'), z: pos('z') }, velocity: { x: vel('x'), y: vel('y'), z: vel('z') } };
};

it('streams the same original motor actions, contacts and private escape evidence as finite replay', () => {
  const initial = sourceFieldV3Fixture(), actions = [{ kind: 'advance' as const, throughTick: 212345 }, { kind: 'advance' as const, throughTick: 212345 }];
  const expected = deriveSourceBattedFieldMotorMotionV1({ initial, actions }), live = createSourceBattedFieldMotorSessionV1(initial);
  for (const [i, a] of actions.entries()) expect(live.apply(a)).toEqual(expected.steps[i].field);
  expect(live.evidence()).toEqual({ impulseCertificates: expected.impulseCertificates, escapedIntervals: expected.escapedIntervals });
});

it('fails a live motor session closed after a rejected command instead of exposing partial mutation', () => {
  const initial = sourceFieldV3Fixture(), live = createSourceBattedFieldMotorSessionV1(initial);
  expect(() => live.apply({ kind: 'adopt', availableAtTick: initial.availableAtTick, coverageThroughTick: initial.coverageThroughTick, commands: [] })).toThrow();
  expect(() => live.read()).toThrow('session failed'); expect(() => live.evidence()).toThrow('session failed');
  expect(() => live.apply({ kind: 'advance', throughTick: 212345 })).toThrow('session failed');
});

it('moves all nine retained decisions through forty physical control intervals on the same Source ball clock', () => {
  const input = fixture(), before = JSON.stringify(input), live = createSourceDefensiveControlV1(input);
  const result = live.advanceThrough(input.plans[0].reviewAtTick + 1000);
  expect(result.status).toBe('review_due'); expect(result.advances).toBe(40);
  const at = result.field.motion.world.moment;
  expect(at.elapsedSeconds).toBe(.08); expect(result.field.motion.actors).toHaveLength(45);
  expect(at).toEqual(createSourceFreeBallKernel({ ...input.initial.cursor.sourceCurve!, throughElapsedSeconds: .08 }).evaluateAt(.08, 'incoming').moment);
  for (let i = 0; i < 9; i++) {
    const body = sampled(result.field.motion.actors[i * 5], .08, at.originTick);
    expect(body.position.x).toBeCloseTo(1000 + i * 10 + .5 * 4 * .08 ** 2, 10);
    expect(body.velocity.x).toBeCloseTo(.32, 12);
  }
  expect(result.controls.map(c => c.decisionSourceId)).toEqual(input.plans.map(p => p.decisionSourceId));
  expect(result.nativeAdmission).toBe(false); expect(result.official).toBeNull(); expect(result.field.motion.carrierPlayerId).toBeNull();
  expect(JSON.stringify(input)).toBe(before);
});

it('keeps an adopted acceleration across arbitrary renderer checkpoints rather than recomputing it early', () => {
  const input = fixture(), a = createSourceDefensiveControlV1(input), b = createSourceDefensiveControlV1(input), target = input.plans[0].reviewAtTick;
  a.advanceThrough(input.initial.availableAtTick + 321); a.advanceThrough(input.initial.availableAtTick + 9013);
  expect(a.advanceThrough(target)).toEqual({ ...b.advanceThrough(target), advances: 36 });
});

it('does not move before the decision first-step deadline, including a deadline between ordinary controls', () => {
  const input = fixture(), start = input.initial.availableAtTick;
  input.plans[0] = { ...input.plans[0], movementStartTick: start + 5500 };
  const live = createSourceDefensiveControlV1(input), before = live.advanceThrough(start + 5500);
  expect(sampled(before.field.motion.actors[0], .0055, start).position.x).toBe(1000);
  const after = live.advanceThrough(start + 7500);
  expect(sampled(after.field.motion.actors[0], .0075, start).position.x).toBeCloseTo(1000 + .5 * 4 * .002 ** 2, 11);
});

it('uses each player acceleration and control cadence independently while retaining the same ball', () => {
  const input = fixture(), start = input.initial.availableAtTick;
  input.plans = input.plans.map((p, i) => ({ ...p, parameters: { ...p.parameters,
    accelerationMps2: i + 1, maxIntegrationStepTicks: [1000, 2000, 4000][i % 3] } }));
  const result = createSourceDefensiveControlV1(input).advanceThrough(start + 80_000);
  for (let i = 0; i < 9; i++) {
    const body = sampled(result.field.motion.actors[i * 5], .08, start);
    expect(body.velocity.x).toBeCloseTo((i + 1) * .08, 10);
    expect(body.position.x).toBeCloseTo(1000 + i * 10 + .5 * (i + 1) * .08 ** 2, 9);
  }
  expect(result.field.motion.world.moment).toEqual(createSourceFreeBallKernel({ ...input.initial.cursor.sourceCurve!, throughElapsedSeconds: .08 }).evaluateAt(.08).moment);
});

it('reaches configured top speed and keeps cruising across control rebases', () => {
  const input = fixture(), start = input.initial.availableAtTick;
  input.plans = input.plans.map(p => ({ ...p, parameters: { ...p.parameters, topSpeedMps: .2 } }));
  const result = createSourceDefensiveControlV1(input).advanceThrough(start + 80_000);
  const body = sampled(result.field.motion.actors[0], .08, start);
  expect(body.velocity.x).toBeCloseTo(.2, 12);
  expect(body.position.x).toBeCloseTo(1000 + .5 * 4 * .05 ** 2 + .2 * .03, 10);
});

it('stops at the earliest sensory/decision review and requires a fresh available nine-person plan', () => {
  const input = fixture(), start = input.initial.availableAtTick;
  input.plans[3] = { ...input.plans[3], reviewAtTick: start + 7013 };
  const live = createSourceDefensiveControlV1(input), result = live.advanceThrough(start + 80_000);
  expect(result.status).toBe('review_due'); expect(result.field.motion.world.moment.ball.tick).toBe(start + 7013);
  expect(live.advanceThrough(start + 80_000).advances).toBe(0);
  expect(() => live.replacePlans(input.plans)).toThrow();
  const next = input.plans.map(p => ({ ...p, decisionSourceId: p.decisionSourceId + '-new', availableAtTick: start + 7013,
    movementStartTick: start + 7013, reviewAtTick: start + 90_000 }));
  live.replacePlans(next);
  expect(live.advanceThrough(start + 80_000).status).toBe('horizon_reached');
});

it('retains arbitrary nondefender colliders and their original motion commands', () => {
  const input = fixture(), actor = { ...input.initial.actors[0], playerId: 'batter-runner', primitive: { ...input.initial.actors[0].primitive, startCenter: v(1500, 1, 1500) } };
  input.initial = { ...input.initial, actors: [...input.initial.actors, actor],
    response: { ...input.initial.response, world: { ...input.initial.response.world, actors: [...input.initial.actors, actor] },
      actors: [...input.initial.response.actors, { playerId: actor.playerId, profile: input.initial.response.actors[0].profile }] },
    commands: [...input.initial.commands, { playerId: actor.playerId, role: actor.primitive.role, acceleration: v() }] };
  const result = createSourceDefensiveControlV1(input).advanceThrough(input.plans[0].reviewAtTick);
  expect(result.field.motion.actors).toHaveLength(46);
  expect(result.field.motion.actors.at(-1)?.primitive.startCenter.x).toBe(1500);
});

it('yields bounded work without renewing decisions and resumes the same control/ball state', () => {
  const input = fixture(), end = input.initial.availableAtTick + 300_000;
  input.plans = input.plans.map(p => ({ ...p, reviewAtTick: end, parameters: { ...p.parameters, maxIntegrationStepTicks: 500 } }));
  const live = createSourceDefensiveControlV1(input), first = live.advanceThrough(end);
  expect(first.status).toBe('work_limit'); expect(first.advances).toBe(256);
  expect(first.field.motion.world.moment.elapsedSeconds).toBe(.128);
  let result = first;
  for (let i = 0; i < 8 && result.status !== 'review_due'; i++) result = live.advanceThrough(end);
  expect(result.status).toBe('review_due'); expect(result.field.motion.world.moment.elapsedSeconds).toBe(.3);
  expect(result.controls.map(c => c.decisionSourceId)).toEqual(input.plans.map(p => p.decisionSourceId));
});

it('stops all bodies at the actual fractional ground contact and resumes the original ball through its bounce', () => {
  const input = fixture(), start = input.initial.availableAtTick, end = start + 600_000;
  input.plans = input.plans.map(p => ({ ...p, reviewAtTick: end }));
  const live = createSourceDefensiveControlV1(input), contact = live.advanceThrough(end), at = contact.field.motion.world.moment;
  expect(contact.status).toBe('physical_boundary'); expect(contact.field.motion.response.kind).toBe('ground');
  expect(at.elapsedSeconds).not.toBe((at.ball.tick - start) / 1e6);
  expect(sampled(contact.field.motion.actors[0], at.elapsedSeconds, start).velocity.x).toBeCloseTo(4 * at.elapsedSeconds, 10);
  const after = live.advanceThrough(end);
  expect(after.status).toBe('review_due'); expect(after.field.motion.world.moment.elapsedSeconds).toBe(.6);
  expect(after.field.motion.cursor?.sourceCurve?.initial).toEqual(input.initial.cursor.sourceCurve?.initial);
  const kernel = createSourceFreeBallKernel(after.field.motion.cursor!.sourceCurve!);
  expect(at.ball.velocity.y).toBeLessThan(0);
  expect(kernel.evaluateAt(at.elapsedSeconds, 'outgoing').moment.ball.velocity.y).toBeGreaterThan(0);
  expect(after.field.motion.world.moment).toEqual(kernel.evaluateAt(.6, after.field.motion.cursor!.sourceSide).moment);
});

it('ends at a moving glove contact with actual body speed and no custody or invented catch verdict', () => {
  const input = fixture(), start = input.initial.availableAtTick;
  const actors = input.initial.actors.map(a => a.playerId !== input.plans[0].playerId ? a : { ...a, primitive: { ...a.primitive,
    startCenter: v(2, a.primitive.role === 'glove' ? 1 : 3 + roles.indexOf(a.primitive.role), 0) } });
  input.initial = { ...input.initial, actors, response: { ...input.initial.response, world: { ...input.initial.response.world, actors } } };
  input.plans[0] = { ...input.plans[0], waypoints: [{ x: 12, z: 0 }] };
  const live = createSourceDefensiveControlV1(input), result = live.advanceThrough(start + 80_000), at = result.field.motion.world.moment;
  expect(result.status).toBe('capture_candidate'); expect(result.field.motion.response.kind).toBe('capture_candidate');
  expect(result.field.motion.cursor).toBeNull(); expect(result.field.motion.carrierPlayerId).toBeNull(); expect(result.official).toBeNull();
  const world = result.field.motion.world;
  if (world.kind !== 'boundary' || world.contacts[0].kind !== 'actor') throw new Error('actual glove boundary required');
  expect(world.contacts[0].role).toBe('glove');
  expect(world.contacts[0].velocity.x).toBeCloseTo(4 * at.elapsedSeconds, 11);
  expect(live.advanceThrough(start + 80_000).field).toEqual(result.field);
  expect(() => live.replacePlans(input.plans)).toThrow();
});

it('rejects incomplete teams, another clock, unknown authority fields and accessors without invoking them', () => {
  const input = fixture();
  expect(() => createSourceDefensiveControlV1({ ...input, plans: input.plans.slice(1) })).toThrow('nine');
  expect(() => createSourceDefensiveControlV1({ ...input, plans: input.plans.map(p => ({ ...p, parameters: { ...p.parameters, ticksPerSecond: 1000 } })) })).toThrow();
  expect(() => createSourceDefensiveControlV1({ ...input, official: 'safe' } as never)).toThrow();
  let calls = 0;
  expect(() => createSourceDefensiveControlV1(Object.defineProperty({ initial: input.initial }, 'plans', { enumerable: true, get() { calls++; return input.plans; } }) as never)).toThrow('accessors');
  expect(calls).toBe(0);
});

it('reconstructs a later integer decision cut from original actions instead of accepting a replacement cursor', () => {
  const input = fixture(), start = input.initial.availableAtTick, issuedAt = start + 20_000;
  input.priorActions = [{ kind: 'advance', throughTick: issuedAt }];
  input.plans = input.plans.map(p => ({ ...p, availableAtTick: issuedAt, movementStartTick: issuedAt }));
  const result = createSourceDefensiveControlV1(input).advanceThrough(start + 80_000);
  const body = sampled(result.field.motion.actors[0], .08, start);
  expect(body.velocity.x).toBeCloseTo(4 * .06, 12);
  expect(body.position.x).toBeCloseTo(1000 + .5 * 4 * .06 ** 2, 10);
  expect(result.field.motion.world.moment).toEqual(createSourceFreeBallKernel({ ...input.initial.cursor.sourceCurve!, throughElapsedSeconds: .08 }).evaluateAt(.08).moment);
  expect(() => createSourceDefensiveControlV1({ ...input, cursor: input.initial.cursor } as never)).toThrow();
});
