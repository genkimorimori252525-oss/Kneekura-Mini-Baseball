import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { createSourceImpactEscapeSessionV3, querySourceFreeBallWorldV2, type SourceFreeBallWorldQueryInputV2 } from './SourceFreeBallWorldQuery';
import { respondToBallContact } from './BallContactResponse';
import type { BallWorldResponseInput } from './BattedBallContactResponse';

// Explicit mathematical geometry, not an admitted stadium or regulation bag.
const fixture = () => {
  const descriptor: SourceFreeBallDescriptorV2 = { kind: 'aero_ground_continuous_source_kernel_v2', initial: {
    originTick: 1000, elapsedSeconds: 0, ball: { tick: 1000, position: { x: 0, y: 1, z: 0 }, velocity: { x: 30, y: 0, z: 0 }, spin: { x: 0, y: 12, z: -50 } } },
    throughElapsedSeconds: 0.1, profile: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1_000_000, radiusM: 0.0366, inertiaRatio: 0.378, gravityMps2: 9.81,
      restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } } };
  const base = (x: number) => ({ region: { center: { x, z: 0 }, halfSize: { x: 0.2, z: 1 }, rotationRadians: 0 }, bottomY: 0, topY: 2 });
  const input: SourceFreeBallWorldQueryInputV2 = { descriptor, moment: descriptor.initial, side: 'incoming', throughElapsedSeconds: 0.1,
    actors: [], surfaces: [], bases: { home: base(-100), first: base(1.2), second: base(100), third: base(200) } };
  const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 }, materials = { home: material, first: material, second: material, third: material };
  const response: BallWorldResponseInput = { world: { parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, integrationStepTicks: 2_000 }, actors: [], surfaces: [] }, actors: [], surfaces: [] };
  const session = createSourceImpactEscapeSessionV3(), observed = session.query(input);
  if (observed.kind !== 'boundary' || observed.contacts[0].kind !== 'base' || !observed.contacts[0].normal) throw new Error('expected actual first-base contact');
  const c = observed.contacts[0], ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal!, surfaceVelocity: { x: 0, y: 0, z: 0 }, material });
  const basis = { ...descriptor, initial: { ...c.moment, ball } }, next = { ...input, descriptor: basis, moment: basis.initial, side: 'outgoing' as const, previousBaseContacts: ['first' as const] };
  return { session, observed, response, materials, basis, input, next };
};
it('independently rederives the same original base impulse and certifies only its single bounded collider escape', () => {
  const x = fixture(), diagnostic = x.session.adoptBaseImpulse(x.observed, x.response, x.materials, x.basis);
  expect(diagnostic.colliderKey).toBe('["base","first"]');
  expect(querySourceFreeBallWorldV2(x.next)).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
  const result = x.session.query(x.next);
  expect(result.kind).toBe('moving');
  if (result.kind === 'unresolved') throw new Error('expected proved escape');
  expect(result.moment).toEqual(createSourceFreeBallKernel(x.basis).evaluateAt(0.1).moment);
  expect(x.session.advances()[0].escapeBracketThroughElapsedSeconds - diagnostic.outgoingMoment.elapsedSeconds).toBeLessThanOrEqual(1e-12);
  expect(x.session.advances()[0].supportingPlaneLowerGapAtEscapeMeters).toBeGreaterThan(0);
});
it('rejects forged identity, changed material/clock/profile and does not transfer the base certificate to another geometry', () => {
  const x = fixture();
  expect(() => x.session.adoptBaseImpulse(structuredClone(x.observed), x.response, x.materials, x.basis)).toThrow('own sole');
  expect(() => x.session.adoptBaseImpulse(x.observed, x.response, { ...x.materials, first: { ...x.materials.first, restitution: 0.9 } }, x.basis)).toThrow('impulse/clock tuple');
  expect(() => x.session.adoptBaseImpulse(x.observed, x.response, x.materials, { ...x.basis, initial: { ...x.basis.initial, originTick: 0 } })).toThrow('impulse/clock tuple');
  x.session.adoptBaseImpulse(x.observed, x.response, x.materials, x.basis);
  expect(x.session.query({ ...x.next, bases: { ...x.next.bases!, second: { ...x.next.bases!.second, topY: 3 } } }))
    .toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
});
