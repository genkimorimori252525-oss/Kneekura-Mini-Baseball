import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createContinuousBattedBallFlightEvidence, createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { createBattedWorldFieldGeometry, deriveBattedWorldFieldMotionAdoption, advanceBattedWorldFieldMotionCheckpoint } from './BattedWorldFieldMotion';
import type { BattedWorldBallCursor } from './BattedWorldContinuation';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const fixture = (floor = false) => {
  const profile = { kind: 'aero_ground_v1' as const, air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366,
    inertiaRatio: 0.378, restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } };
  const contact = { tick: 12345, ballCenter: v(0, floor ? profile.ground.radiusM : 1), exitVelocity: v(30, floor ? -1 : 0), exitSpin: v(0, 12, -50),
    point: v(0, 1), batPoint: v(0, 1), normal: v(0, 1), segmentT: 0.72 };
  const flight = createContinuousBattedBallFlightEvidence(contact, 0, profile);
  const sourceCurve: SourceFreeBallDescriptorV2 = { kind: 'aero_ground_continuous_source_kernel_v2',
    initial: { originTick: contact.tick, elapsedSeconds: 0, ball: flight.initialBall }, throughElapsedSeconds: 0, profile };
  // Deliberately different legacy ground parameters: the Source material owns the sole impulse.
  const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, integrationStepTicks: 2_000, groundRestitution: 0.9, groundFriction: 0.9 };
  const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.5 };
  const actors = [{ playerId: 'fielder', primitive: { role: 'body' as const, radius: 0.1, startTick: contact.tick,
    endTick: contact.tick + 3_000_000, ticksPerSecond: 1_000_000, startCenter: v(100, 1, 100), startVelocity: v(), acceleration: v() } }];
  const base = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, surfaceHeightMeters: 0.1 });
  const geometry = createBattedWorldFieldGeometry({ baseGeometry: { field: { homePlate: { x: 100, z: 100 }, firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } },
    bases: { home: base(100, 100), first: base(103, 100), second: base(103, 103), third: base(100, 103) } },
    baseModels: { home: { bottomY: 0, material }, first: { bottomY: 0, material }, second: { bottomY: 0, material }, third: { bottomY: 0, material } } });
  const response = { world: { flight, sourceCurve, parameters, throughTick: contact.tick, actors, surfaces: [] },
    actors: [{ playerId: 'fielder', profile: { role: 'body' as const, material } }], surfaces: [] };
  const cursor: BattedWorldBallCursor = { moment: sourceCurve.initial, sourceCurve, sourceSide: 'incoming', previousContacts: [] };
  return { response, geometry, actors, cursor, carrierPlayerId: null, availableAtTick: contact.tick, coverageThroughTick: contact.tick + 3_000_000,
    commands: [{ playerId: 'fielder', role: 'body' as const, acceleration: v() }] };
};
it('keeps one actual Source basis and its spin across adoption and repeated contact-free checkpoints', () => {
  const x = fixture(), adopted = deriveBattedWorldFieldMotionAdoption(x);
  const run = (cursor: BattedWorldBallCursor, tick: number) => advanceBattedWorldFieldMotionCheckpoint({ response: x.response, geometry: x.geometry,
    actors: adopted.motion.actors, carrierPlayerId: null, cursor, checkpointThroughTick: tick });
  const first = run(adopted.motion.cursor!, 112345), next = run(first.motion.cursor!, 212345), once = run(adopted.motion.cursor!, 212345);
  expect(next).toEqual(once);
  expect(next.motion.cursor!.sourceCurve!.initial).toEqual(x.cursor.sourceCurve!.initial);
  const kernel = createSourceFreeBallKernel({ ...x.cursor.sourceCurve!, throughElapsedSeconds: 0.2 });
  expect(next.motion.world.moment).toEqual(kernel.evaluateAt(0.2).moment);
  expect(next.motion.world.moment.ball.spin).not.toEqual(x.cursor.moment.ball.spin);
  expect(next).not.toHaveProperty('playEnd');
});
it('uses the exact incoming/outgoing ground moment and only the Source ground impulse including at the initial cut', () => {
  for (const floor of [false, true]) {
    const x = fixture(floor), adopted = deriveBattedWorldFieldMotionAdoption(x);
    const field = floor ? adopted : advanceBattedWorldFieldMotionCheckpoint({ response: x.response, geometry: x.geometry, actors: adopted.motion.actors,
      carrierPlayerId: null, cursor: adopted.motion.cursor!, checkpointThroughTick: 1012345 });
    expect(field.motion.response.kind).toBe('ground');
    const kernel = createSourceFreeBallKernel({ ...x.cursor.sourceCurve!, throughElapsedSeconds: 1 });
    const elapsed = field.motion.world.moment.elapsedSeconds;
    expect(field.motion.world.moment).toEqual(kernel.evaluateAt(elapsed, 'incoming').moment);
    expect(field.motion.cursor!.moment).toEqual(kernel.evaluateAt(elapsed, 'outgoing').moment);
    expect(field.motion.cursor!.moment.originTick).toBe(x.cursor.moment.originTick);
    expect(field.motion.cursor!.sourceCurve!.initial).toEqual(x.cursor.sourceCurve!.initial);
  }
});
it('rejects unsupported carrying or a dropped Source descriptor instead of selecting the old free-ball curve', () => {
  const x = fixture();
  expect(() => deriveBattedWorldFieldMotionAdoption({ ...x, carrierPlayerId: 'fielder' })).toThrow(/Source|nonlinear|unsupported/);
  const { sourceCurve: _, sourceSide: __, ...cursor } = x.cursor;
  expect(() => deriveBattedWorldFieldMotionAdoption({ ...x, cursor })).toThrow(/Source|nonlinear/);
});
