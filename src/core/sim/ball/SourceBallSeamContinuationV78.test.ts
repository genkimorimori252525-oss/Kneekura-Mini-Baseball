import { expect, it } from 'vitest';
import { sourceFieldV3Fixture } from './SourceBattedFieldMotionV3.test-support';
import { createContinuousBattedBallFlightEvidence, createSourceFreeBallKernel } from './SourceFreeBallKernel';
import { deriveSourceBattedWorldContinuationV3 } from './SourceBattedWorldContinuationV3';
import { createSourceBallMaterialHistoryFromContinuationV3 } from './SourceBallMaterialHistoryFromContinuationV3';
import { createSourceBallMaterialHistoryV1 } from './SourceBallMaterialHistoryV1';
import { createSourceImpactEscapeSessionV3 } from './SourceFreeBallWorldQuery';
import { IDENTITY_QUATERNION, quaternionFromAxisAngle } from '../pitching/BaseballOrientation';

const phase = quaternionFromAxisAngle({ x: 1, y: 2, z: 3 }, .7);
const response = (initialHorizon = 0) => {
  const base = sourceFieldV3Fixture().response, curve = base.world.sourceCurve,
    profile = { ...curve.profile, air: { ...curve.profile.air, aerodynamics: { ...curve.profile.air.aerodynamics,
      seamForce: { version: 'baseball_seam_force_v1' as const, coefficientScale: 1 } } } },
    flight = createContinuousBattedBallFlightEvidence(base.world.flight.contact, initialHorizon, profile, phase);
  return { ...base, world: { ...base.world, flight, throughTick: flight.initialBall.tick + initialHorizon,
    sourceCurve: { ...curve, profile, initial: { ...curve.initial, ball: flight.initialBall }, materialOrientationAtStart: phase,
      throughElapsedSeconds: initialHorizon / profile.air.ticksPerSecond } } };
};
it('uses the physical absolute phase once and rejects phase resets across an impulse', () => {
  const original = sourceFieldV3Fixture().response.world.sourceCurve, one = { ...original, materialOrientationAtStart: phase, throughElapsedSeconds: .1 },
    first = createSourceFreeBallKernel(one).evaluateAt(.04), second = { ...one, initial: { ...first.moment,
      ball: { ...first.moment.ball, spin: { x: 12, y: -20, z: 40 } } }, materialOrientationAtStart: first.materialOrientation! },
    raw = { initialMaterialOrientation: phase, spans: [{ descriptor: one, throughElapsedSeconds: .04, side: 'incoming' as const },
      { descriptor: second, throughElapsedSeconds: .08, side: 'outgoing' as const }] }, history = createSourceBallMaterialHistoryV1(raw),
    endpoint = createSourceFreeBallKernel(second).evaluateAt(.08);
  expect(history.evaluateAt(.08).orientation).toEqual(endpoint.materialOrientation);
  expect(history.evaluateAt(.04, 'incoming').orientation).toEqual(first.materialOrientation);
  expect(history.evaluateAt(.04, 'outgoing').orientation).toEqual(first.materialOrientation);
  expect(() => createSourceBallMaterialHistoryV1({ ...raw, initialMaterialOrientation: IDENTITY_QUATERNION })).toThrow('material');
  expect(() => createSourceBallMaterialHistoryV1({ ...raw, spans: [raw.spans[0], { ...raw.spans[1],
    descriptor: { ...second, materialOrientationAtStart: phase } }] })).toThrow('material');
});
it('carries seam phase through actual wall/ground response and preserves future observations under extra checkpoints', () => {
  const input = response(), origin = input.world.sourceCurve.initial.originTick,
    continuation = deriveSourceBattedWorldContinuationV3({ response: input, throughTicks: [origin + 200_000, origin + 200_000, origin + 500_000, origin + 500_000] }),
    more = deriveSourceBattedWorldContinuationV3({ response: input, throughTicks: [origin + 200_000, origin + 200_000, origin + 350_000, origin + 500_000, origin + 500_000] }),
    one = createSourceBallMaterialHistoryFromContinuationV3({ response: input, continuation, initialMaterialOrientation: phase }),
    two = createSourceBallMaterialHistoryFromContinuationV3({ response: input, continuation: more, initialMaterialOrientation: phase });
  expect(continuation.steps[0].response.kind).toBe('rebound');
  const impact = continuation.steps[0], incoming = createSourceFreeBallKernel({ ...input.world.sourceCurve, throughElapsedSeconds: .2 }).evaluateAt(impact.world.moment.elapsedSeconds, 'incoming'),
    after = impact.response.cursor!.sourceCurve!, outgoing = createSourceFreeBallKernel(after).evaluateAt(impact.world.moment.elapsedSeconds);
  expect(after.materialOrientationAtStart).toEqual(incoming.materialOrientation);
  expect(outgoing.materialOrientation).toEqual(incoming.materialOrientation);
  expect(outgoing.moment.ball.position).toEqual(incoming.moment.ball.position);
  expect(outgoing.moment.ball.velocity).not.toEqual(incoming.moment.ball.velocity);
  for (const t of [.01, .035, .2, .333333, .4999999]) expect(two.evaluateAt(t)).toEqual(one.evaluateAt(t));
  expect(one.evaluateAt(.4999999).orientation).toEqual(createSourceFreeBallKernel(one.spans[1].descriptor).evaluateAt(.4999999).materialOrientation);
  expect(one.native).toBe(false); expect(one.nativeAdmission).toBe(false); expect(one.official).toBeNull();
  // The original-at-wall entry path must carry the same phase as a later wall response.
  const originalAtWall = response(200_000), atWall = deriveSourceBattedWorldContinuationV3({ response: originalAtWall, throughTicks: [] });
  expect(atWall.original.kind).toBe('rebound');
  const previous = createSourceFreeBallKernel(originalAtWall.world.sourceCurve).evaluateAt(atWall.initialCursor!.moment.elapsedSeconds, 'incoming');
  expect(atWall.initialCursor!.sourceCurve!.materialOrientationAtStart).toEqual(previous.materialOrientation);
});
it('requires a new impulse certificate to preserve the incoming material phase', () => {
  const input = response(), curve = { ...input.world.sourceCurve, throughElapsedSeconds: .2 }, origin = curve.initial.originTick,
    trace = deriveSourceBattedWorldContinuationV3({ response: input, throughTicks: [origin + 200_000] }),
    outgoing = trace.cursor!.sourceCurve!, session = createSourceImpactEscapeSessionV3(),
    observed = session.query({ descriptor: curve, moment: curve.initial, side: 'incoming', throughElapsedSeconds: .2,
      actors: input.world.actors, surfaces: input.world.surfaces });
  expect(observed.kind).toBe('boundary');
  expect(() => session.adoptImpulse(observed, input, { ...outgoing, materialOrientationAtStart: IDENTITY_QUATERNION })).toThrow('material');
  expect(() => session.adoptImpulse(observed, input, outgoing)).not.toThrow();
  const forged = session.query({ descriptor: { ...outgoing, materialOrientationAtStart: IDENTITY_QUATERNION }, moment: outgoing.initial,
    side: 'outgoing', throughElapsedSeconds: .2, actors: input.world.actors, surfaces: input.world.surfaces,
    previousContacts: trace.cursor!.previousContacts });
  if (forged.kind === 'unresolved') throw new Error('phase-forgery fixture requires an actual contact witness');
  expect(forged.pendingReason).toBe('persistent_contact');
});
it('leaves omitted-phase descriptor, cursor, observer and certificate shapes unchanged', () => {
  const input = sourceFieldV3Fixture().response, origin = input.world.sourceCurve.initial.originTick,
    trace = deriveSourceBattedWorldContinuationV3({ response: input, throughTicks: [origin + 200_000] }),
    history = createSourceBallMaterialHistoryFromContinuationV3({ response: input, continuation: trace, initialMaterialOrientation: phase });
  expect(Object.keys(trace.cursor!.sourceCurve!).sort()).toEqual(['initial', 'kind', 'profile', 'throughElapsedSeconds']);
  expect(Object.keys(trace.cursor!).sort()).toEqual(['moment', 'previousContacts', 'sourceCurve']);
  expect(Object.keys(history.evaluateAt(.01)).sort()).toEqual(['moment', 'native', 'nativeAdmission', 'official', 'orientation',
    'phase', 'phaseAuthority', 'relativeOrientation', 'spanIndex']);
  expect(Object.keys(trace.impulseCertificates[0].diagnostic).sort()).toEqual(['colliderKey', 'firstPossibleElapsedSeconds', 'gapBoundMeters',
    'incomingMoment', 'incomingNormalSpeedMps', 'initialSignedGapMeters', 'outgoingMoment', 'outgoingNormalSpeedMps',
    'sourcePositionRoundingBoundMeters', 'witnessElapsedSeconds']);
});
