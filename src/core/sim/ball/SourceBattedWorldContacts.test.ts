import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createContinuousBattedBallFlightEvidence, createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { deriveFirstBattedWorldContact, deriveFirstBattedWorldContactGeometry, type BattedWorldContactInput } from './BattedBallWorldContacts';
import { deriveBattedWorldContinuation } from './BattedWorldContinuation';
import { deriveBattedBallContactResponse } from './BattedBallContactResponse';

const input = (): BattedWorldContactInput => {
  const contact = { tick: 12345, ballCenter: { x: 0, y: 1, z: 0 }, exitVelocity: { x: 30, y: 0, z: 0 }, exitSpin: { x: 0, y: 12, z: -50 },
    point: { x: 0, y: 1, z: 0 }, batPoint: { x: 0, y: 1, z: 0 }, normal: { x: 0, y: 1, z: 0 }, segmentT: 0.72 };
  const profile = { kind: 'aero_ground_v1' as const, air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366,
    inertiaRatio: 0.378, restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } };
  const flight = createContinuousBattedBallFlightEvidence(contact, 1_000_000, profile);
  return { flight, parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, integrationStepTicks: 2_000 }, throughTick: contact.tick + 1_000_000,
    actors: [], surfaces: [], sourceCurve: { kind: 'aero_ground_continuous_source_kernel_v2',
      initial: { originTick: contact.tick, elapsedSeconds: 0, ball: flight.initialBall }, throughElapsedSeconds: 1, profile } };
};

it('retains the same continuous Source incoming ground state, exact moment, and unchanged original root', () => {
  const x = input(), result = deriveFirstBattedWorldContact(x);
  expect(result.kind).toBe('contact');
  if (result.kind !== 'contact') throw new Error('expected floor');
  expect(result.contacts).toEqual([{ kind: 'ground' }]);
  expect(result.ball).toEqual(x.flight.firstGroundContact!.state);
  expect(result.sourceMoment).toEqual(createSourceFreeBallKernel(x.sourceCurve!).evaluateAt(result.sourceMoment!.elapsedSeconds, 'incoming').moment);
  expect(result.sourceMoment!.originTick).toBe(x.flight.initialBall.tick);
  expect(result.sourceMoment!.elapsedSeconds).not.toBe((result.tick - x.flight.initialBall.tick) / 1_000_000);
});

it('derives surface geometry and moving actor geometry from the same fractional Source contact', () => {
  const x = input(), surface = { surfaceId: 'wall', start: { x: 1, z: -1 }, end: { x: 1, z: 1 }, minimumHeight: 0, maximumHeight: 3 };
  const r = deriveFirstBattedWorldContactGeometry({ ...x, surfaces: [surface] });
  expect(r.geometry!.contact).toMatchObject({ kind: 'surface', surfaceId: 'wall' });
  expect(r.geometry!.ball).toEqual(r.world.ball);
  expect(r.geometry!.elapsedSeconds).toBe(r.world.sourceMoment!.elapsedSeconds);
  expect(r.geometry!.ball).toEqual(createSourceFreeBallKernel(x.sourceCurve!).evaluateAt(r.geometry!.elapsedSeconds).moment.ball);
  const actor = { playerId: 'fielder', primitive: { role: 'body' as const, radius: 0.1, startTick: x.flight.initialBall.tick,
    endTick: x.throughTick, ticksPerSecond: 1_000_000, startCenter: { x: 1, y: 1, z: 0 },
    startVelocity: { x: 1, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } };
  const a = deriveFirstBattedWorldContactGeometry({ ...x, actors: [actor] });
  expect(a.geometry!.contact).toMatchObject({ kind: 'actor', playerId: 'fielder' });
  expect(a.geometry!.point.x).toBe(1 + a.geometry!.elapsedSeconds);
  expect(a.geometry!.surfaceVelocity).toEqual(actor.primitive.startVelocity);
  expect(a.geometry!.ball).toEqual(a.world.ball);
});

it('rejects swapped source roots, profile clocks, forged flight states and truncated horizons', () => {
  const x = input(), d = x.sourceCurve!;
  for (const curve of [{ ...d, initial: { ...d.initial, originTick: d.initial.originTick + 1 } },
    { ...d, throughElapsedSeconds: 0.9 }, { ...d, profile: { ...d.profile, air: { ...d.profile.air, integrationStepTicks: 1_000 } } }]) {
    expect(() => deriveFirstBattedWorldContact({ ...x, sourceCurve: curve as SourceFreeBallDescriptorV2 })).toThrow();
  }
  expect(() => deriveFirstBattedWorldContact({ ...x, flight: { ...x.flight,
    initialBall: { ...x.flight.initialBall, spin: { x: 0, y: 0, z: 0 } } } })).toThrow();
});

it('continues all repeated ground impulses from the same original kernel and extends horizons without restarting it', () => {
  const x = input(), trace = deriveBattedWorldContinuation({ response: { world: x, actors: [], surfaces: [] },
    throughTicks: [2_012_345, 2_012_345, 2_012_345, 2_012_345] });
  expect(trace.original.kind).toBe('ground');
  expect(trace.initialCursor!.sourceCurve!.initial).toEqual(x.sourceCurve!.initial);
  const kernel = createSourceFreeBallKernel({ ...x.sourceCurve!, throughElapsedSeconds: 2 });
  expect(trace.initialCursor!.moment).toEqual(kernel.evaluateAt(trace.original.world.sourceMoment!.elapsedSeconds, 'outgoing').moment);
  let previous = trace.initialCursor!.moment.elapsedSeconds;
  for (const step of trace.steps) {
    expect(step.world.moment.elapsedSeconds).toBeGreaterThan(previous);
    expect(step.world.moment).toEqual(kernel.evaluateAt(step.world.moment.elapsedSeconds, step.world.kind === 'boundary' ? 'incoming' : 'outgoing').moment);
    expect(step.response.cursor!.moment).toEqual(kernel.evaluateAt(step.world.moment.elapsedSeconds, 'outgoing').moment);
    expect(step.response.cursor!.sourceCurve!.initial).toEqual(x.sourceCurve!.initial);
    previous = step.world.moment.elapsedSeconds;
  }
  expect(trace).not.toHaveProperty('playEnd');
});

it('keeps actual coupled sliding, rolling and rest in the same Source without a second initial floor impulse', () => {
  const original = input(), profile = original.sourceCurve!.profile, contact = { ...original.flight.contact,
    ballCenter: { x: 0, y: profile.ground.radiusM, z: 0 }, exitVelocity: { x: 6, y: 0, z: 0 }, exitSpin: { x: 0, y: 12, z: 0 } };
  const flight = createContinuousBattedBallFlightEvidence(contact, 0, profile), d: SourceFreeBallDescriptorV2 = {
    kind: 'aero_ground_continuous_source_kernel_v2', initial: { originTick: contact.tick, elapsedSeconds: 0, ball: flight.initialBall }, throughElapsedSeconds: 0, profile };
  const trace = deriveBattedWorldContinuation({ response: { world: { ...original, flight, throughTick: contact.tick, sourceCurve: d }, actors: [], surfaces: [] },
    throughTicks: [contact.tick + 1_000_000, contact.tick + 6_000_000, contact.tick + 6_000_000] });
  expect(trace.initialCursor!.moment.ball).toEqual(flight.initialBall);
  expect(trace.steps[0].world.kind).toBe('moving');
  expect(trace.steps.some(step => step.response.kind === 'rolling_stop')).toBe(true);
  expect(trace.steps.at(-1)!.response.kind).toBe('resting');
  expect(trace.cursor!.sourceCurve!.initial).toEqual(d.initial);
  expect(trace.cursor!.moment).toEqual(createSourceFreeBallKernel({ ...d, throughElapsedSeconds: 6 }).evaluateAt(6).moment);
});

it('preserves a fractional actual surface-impulse basis without rebasing its physical time to ceil(tick)', () => {
  const x = input(), surface = { surfaceId: 'wall', start: { x: 1, z: -1 }, end: { x: 1, z: 1 }, minimumHeight: 0, maximumHeight: 3 };
  const response = { world: { ...x, surfaces: [surface] }, actors: [], surfaces: [{ surfaceId: 'wall', material: { restitution: 0.5, tangentialDamping: 0, spinDamping: 0 } }] };
  const trace = deriveBattedWorldContinuation({ response, throughTicks: [] });
  expect(trace.original.kind).toBe('rebound');
  if (trace.original.kind !== 'rebound') throw new Error('expected wall impulse');
  const basis = trace.initialCursor!.sourceCurve!;
  expect(basis.initial).toEqual(trace.initialCursor!.moment);
  expect(basis.initial.originTick).toBe(x.flight.initialBall.tick);
  expect(basis.initial.elapsedSeconds).toBe(trace.original.geometry.elapsedSeconds);
  expect(basis.initial.elapsedSeconds).not.toBe((basis.initial.ball.tick - basis.initial.originTick) / 1_000_000);
  const time = basis.initial.elapsedSeconds + 0.0000002, point = createSourceFreeBallKernel(basis).evaluateAt(time).moment;
  expect(point.originTick).toBe(x.flight.initialBall.tick);
  expect(point.elapsedSeconds).toBe(time);
  expect(createSourceFreeBallKernel(basis).evaluateAt(basis.initial.elapsedSeconds).orientation).toEqual({ w: 1, x: 0, y: 0, z: 0 });
  expect(createSourceFreeBallKernel(x.sourceCurve!).evaluateAt(basis.initial.elapsedSeconds).orientation).not.toEqual({ w: 1, x: 0, y: 0, z: 0 });
});

it('stops free motion after a real secured glove candidate until separate custody acquisition is proved', () => {
  const x = input(), radius = 0.1, center = { x: 0.1, y: 1, z: 0 };
  const actor = { playerId: 'fielder', primitive: { role: 'glove' as const, radius, startTick: x.flight.initialBall.tick,
    endTick: x.throughTick, ticksPerSecond: 1_000_000, startCenter: center, startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } };
  const response = { world: { ...x, actors: [actor] }, actors: [{ playerId: actor.playerId, profile: { role: 'glove' as const,
    pocketCenterOffset: { x: -0.1, y: 0, z: 0 }, bodyStability: 1, parameters: { ticksPerSecond: 1_000_000,
      ballMassKg: 0.145, ballRadiusMeters: x.parameters.ballRadius, pocketRadiusMeters: 0.2, centerRetentionCapacityJ: 100,
      captureDissipationPowerW: 1_000, failedContactRestitution: 0.5, failedTangentialDamping: 0, failedSpinDamping: 0 } } }], surfaces: [] };
  expect(deriveBattedBallContactResponse(response).kind).toBe('capture_candidate');
  const trace = deriveBattedWorldContinuation({ response, throughTicks: [] });
  expect(trace.cursor).toBeNull();
  expect(() => deriveBattedWorldContinuation({ response, throughTicks: [x.throughTick] })).toThrow('acquisition or unresolved contact is pending');
});
