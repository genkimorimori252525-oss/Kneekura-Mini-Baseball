import { expect, it } from 'vitest';
import { sourceFieldV3Fixture } from './SourceBattedFieldMotionV3.test-support';
import { deriveSourceBattedWorldContinuationV3 } from './SourceBattedWorldContinuationV3';
import { createSourceBallMaterialHistoryFromContinuationV3 } from './SourceBallMaterialHistoryFromContinuationV3';
import { createContinuousBattedBallFlightEvidence, createSourceFreeBallKernel } from './SourceFreeBallKernel';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle, type Quaternion } from '../pitching/BaseballOrientation';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';

const phase = () => quaternionFromAxisAngle({ x: 1, y: 2, z: 3 }, .7);
const product = (a: Quaternion, b: Quaternion) => normalizeQuaternion(multiplyQuaternions(a, b));
const close = (a: Quaternion, b: Quaternion) => {
  for (const key of ['w', 'x', 'y', 'z'] as const) expect(a[key]).toBeCloseTo(b[key], 13);
};
const fixture = () => {
  const response = sourceFieldV3Fixture().response, origin = response.world.sourceCurve.initial.originTick;
  const throughTicks = [origin + 200_000, origin + 200_000, origin + 500_000, origin + 500_000];
  const continuation = deriveSourceBattedWorldContinuationV3({ response, throughTicks });
  return { response, continuation, initialMaterialOrientation: phase() };
};
const withOriginalHorizon = (input: BattedBallContactResponseInput, elapsed = .2): BattedBallContactResponseInput => {
  const curve = input.world.sourceCurve!, ticks = Math.round(elapsed * curve.profile.air.ticksPerSecond);
  return { ...input, world: { ...input.world, throughTick: curve.initial.originTick + ticks,
    flight: createContinuousBattedBallFlightEvidence(input.world.flight.contact, ticks, curve.profile),
    sourceCurve: { ...curve, throughElapsedSeconds: elapsed } } };
};

it('maps an actual v3 wall then ground to two original bases with continuous phase and exact kernel geometry', () => {
  const input = fixture(), before = JSON.stringify(input), history = createSourceBallMaterialHistoryFromContinuationV3(input);
  expect(input.continuation.steps.map(step => step.response.kind)).toEqual(['rebound', 'moving', 'ground', 'moving']);
  expect(input.continuation.escapedIntervals.length).toBeGreaterThan(0);
  expect(history.spans).toHaveLength(2);
  const rebound = input.continuation.steps[0], outgoing = rebound.response.cursor!;
  expect(history.spans[0].descriptor.initial).toEqual(input.response.world.sourceCurve!.initial);
  expect(history.spans[1].descriptor.initial).toEqual(outgoing.sourceCurve!.initial);
  close(history.evaluateAt(rebound.world.moment.elapsedSeconds, 'incoming').orientation,
    history.evaluateAt(rebound.world.moment.elapsedSeconds, 'outgoing').orientation);
  for (const step of input.continuation.steps) {
    const cursor = step.response.cursor!, sample = history.evaluateAt(cursor.moment.elapsedSeconds, 'outgoing');
    expect(sample.moment).toEqual(cursor.moment);
    if (step.response.kind === 'ground') {
      const beforeGround = history.evaluateAt(step.world.moment.elapsedSeconds, 'incoming');
      expect(beforeGround.moment).toEqual(step.world.moment); close(beforeGround.orientation, sample.orientation);
    }
  }
  const kernel = createSourceFreeBallKernel(history.spans[1].descriptor), ground = input.continuation.steps[2].world.moment.elapsedSeconds;
  for (const t of [ground - 1e-7, ground, ground + 1e-7, .4999999]) {
    expect(history.evaluateAt(t).moment).toEqual(kernel.evaluateAt(t).moment);
  }
  expect(history.native).toBe(false); expect(history.nativeAdmission).toBe(false); expect(history.official).toBeNull();
  expect(JSON.stringify(input)).toBe(before);
});

it('merges observation cuts, keeps ground on the same basis and never turns an escape interval into a basis', () => {
  const input = fixture(), origin = input.response.world.sourceCurve!.initial.originTick;
  const moreCuts = deriveSourceBattedWorldContinuationV3({ response: input.response,
    throughTicks: [origin + 200_000, origin + 200_000, origin + 350_000, origin + 500_000, origin + 500_000] });
  const one = createSourceBallMaterialHistoryFromContinuationV3(input);
  const two = createSourceBallMaterialHistoryFromContinuationV3({ ...input, continuation: moreCuts });
  expect(two.spans).toEqual(one.spans);
  for (const t of [0, .01, .1, .33333, .4999999, .5]) expect(two.evaluateAt(t)).toEqual(one.evaluateAt(t));
  expect(two.spans).toHaveLength(2);
  expect(two.spans[1].descriptor.initial).toEqual(moreCuts.steps[0].response.cursor!.sourceCurve!.initial);
});

it('stops at a last rebound actual moment with a zero-duration outgoing span rather than the requested horizon', () => {
  const input = fixture(), origin = input.response.world.sourceCurve!.initial.originTick;
  const continuation = deriveSourceBattedWorldContinuationV3({ response: input.response, throughTicks: [origin + 200_000] });
  const history = createSourceBallMaterialHistoryFromContinuationV3({ ...input, continuation });
  const at = continuation.cursor!.moment;
  expect(history.throughElapsedSeconds).toBe(at.elapsedSeconds); expect(at.elapsedSeconds).toBeLessThan(.2);
  expect(history.spans).toHaveLength(2);
  expect(history.spans[1].descriptor.initial.elapsedSeconds).toBe(history.spans[1].throughElapsedSeconds);
  expect(history.evaluateAt(at.elapsedSeconds, 'outgoing').moment).toEqual(at);
  expect(history.evaluateAt(at.elapsedSeconds, 'incoming').moment).toEqual(continuation.steps[0].world.moment);
  close(history.evaluateAt(at.elapsedSeconds, 'incoming').orientation, history.evaluateAt(at.elapsedSeconds, 'outgoing').orientation);
  expect(() => history.evaluateAt(at.elapsedSeconds + 1e-10)).toThrow();
});

it('carries the pre-contact phase into an original rebound instead of declaring identity at initialCursor', () => {
  const base = fixture(), response = withOriginalHorizon(base.response);
  const continuation = deriveSourceBattedWorldContinuationV3({ response, throughTicks: [] });
  expect(continuation.original.kind).toBe('rebound');
  const history = createSourceBallMaterialHistoryFromContinuationV3({ response, continuation, initialMaterialOrientation: phase() });
  const time = continuation.initialCursor!.moment.elapsedSeconds;
  const prior = createSourceFreeBallKernel(response.world.sourceCurve!).evaluateAt(time, 'incoming');
  close(history.evaluateAt(time).orientation, product(prior.orientation, phase()));
  expect(history.evaluateAt(time).orientation).not.toEqual(phase());
  expect(history.evaluateAt(time).moment).toEqual(continuation.initialCursor!.moment);
  expect(history.spans).toHaveLength(2);
});

it('keeps original ground and a later rolling stop in one original basis without a phase reset', () => {
  const base = sourceFieldV3Fixture().response, profile = base.world.sourceCurve.profile;
  const contact = { ...base.world.flight.contact, ballCenter: { x: 1, y: profile.ground.radiusM, z: 0 },
    exitVelocity: { x: .1, y: 0, z: 0 }, exitSpin: { x: 0, y: 0, z: -.1 / profile.ground.radiusM } };
  const flight = createContinuousBattedBallFlightEvidence(contact, 0, profile), origin = contact.tick;
  const response: BattedBallContactResponseInput = { ...base, world: { ...base.world, flight,
    sourceCurve: { ...base.world.sourceCurve, initial: { originTick: origin, elapsedSeconds: 0, ball: flight.initialBall } } } };
  const continuation = deriveSourceBattedWorldContinuationV3({ response, throughTicks: [origin + 200_000, origin + 200_000] });
  expect(continuation.original.kind).toBe('ground');
  expect(continuation.steps.map(step => step.response.kind)).toEqual(['rolling_stop', 'resting']);
  const history = createSourceBallMaterialHistoryFromContinuationV3({ response, continuation, initialMaterialOrientation: phase() });
  expect(history.spans).toHaveLength(1);
  expect(history.spans[0].descriptor.initial).toEqual(response.world.sourceCurve!.initial);
  expect(history.evaluateAt(continuation.cursor!.moment.elapsedSeconds).moment).toEqual(continuation.cursor!.moment);
  const at = continuation.steps[0].world.moment.elapsedSeconds;
  close(history.evaluateAt(at, 'incoming').orientation, history.evaluateAt(at, 'outgoing').orientation);
});

it('rejects forged history, phases, profiles, clocks, certificates, extra custody fields and absent original Sources', () => {
  for (const mutate of [
    (raw: any) => { raw.continuation.steps[1].response.cursor.moment.ball.position.x += 1e-8; },
    (raw: any) => { raw.continuation.initialCursor.moment.originTick++; },
    (raw: any) => { raw.continuation.steps[0].response.cursor.sourceCurve.profile.ground.material.restitution += .01; },
    (raw: any) => { raw.continuation.steps[0].world.moment.elapsedSeconds += 1e-9; },
    (raw: any) => { raw.continuation.impulseCertificates = []; },
    (raw: any) => { raw.continuation.escapedIntervals = []; },
    (raw: any) => { raw.continuation.solverVersion = 'invented'; },
    (raw: any) => { raw.continuation.carrierPlayerId = 'fielder'; },
    (raw: any) => { raw.initialMaterialOrientation.w = NaN; },
    (raw: any) => { delete raw.response.world.sourceCurve; },
    (raw: any) => { raw.nativeAdmission = true; },
  ]) { const raw = structuredClone(fixture()); mutate(raw); expect(() => createSourceBallMaterialHistoryFromContinuationV3(raw)).toThrow(); }
});

it('fails closed on actual original capture, actor rebound, unresolved contacts or missing free cursors', () => {
  const base = withOriginalHorizon(fixture().response), primitive = { ...base.world.actors[0].primitive,
    role: 'glove' as const, radius: .25, startCenter: { x: 2.5, y: 1, z: 0 } };
  const captureResponse: BattedBallContactResponseInput = { ...base, world: { ...base.world, surfaces: [],
    actors: [{ playerId: 'glove', primitive }] }, surfaces: [], actors: [{ playerId: 'glove', profile: { role: 'glove',
      pocketCenterOffset: { x: -.2866, y: 0, z: 0 }, bodyStability: 1, parameters: { ticksPerSecond: 1_000_000,
        ballMassKg: .145, ballRadiusMeters: .0366, pocketRadiusMeters: .5, centerRetentionCapacityJ: 1000,
        captureDissipationPowerW: 10_000_000, failedContactRestitution: .5, failedTangentialDamping: .25, failedSpinDamping: .2 } } }] };
  const capture = deriveSourceBattedWorldContinuationV3({ response: captureResponse, throughTicks: [] });
  expect(capture.original.kind).toBe('capture_candidate');
  expect(() => createSourceBallMaterialHistoryFromContinuationV3({ response: captureResponse, continuation: capture, initialMaterialOrientation: phase() })).toThrow();
  const actorResponse: BattedBallContactResponseInput = { ...base, world: { ...base.world, surfaces: [],
    actors: [{ playerId: 'body', primitive: { ...primitive, role: 'body' } }] }, surfaces: [],
    actors: [{ playerId: 'body', profile: { role: 'body', material: base.surfaces[0].material } }] };
  const actor = deriveSourceBattedWorldContinuationV3({ response: actorResponse, throughTicks: [] });
  expect(actor.original.kind).toBe('rebound');
  expect(() => createSourceBallMaterialHistoryFromContinuationV3({ response: actorResponse, continuation: actor, initialMaterialOrientation: phase() })).toThrow();
  const simultaneousResponse = { ...base, world: { ...base.world,
    surfaces: [...base.world.surfaces, { ...base.world.surfaces[0], surfaceId: 'duplicate-wall' }] },
    surfaces: [...base.surfaces, { ...base.surfaces[0], surfaceId: 'duplicate-wall' }] };
  const simultaneous = deriveSourceBattedWorldContinuationV3({ response: simultaneousResponse, throughTicks: [] });
  expect(simultaneous.original.kind).toBe('unresolved');
  expect(() => createSourceBallMaterialHistoryFromContinuationV3({ response: simultaneousResponse, continuation: simultaneous, initialMaterialOrientation: phase() })).toThrow();
});
