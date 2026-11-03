import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { createSourceImpactEscapeSessionV3, querySourceFreeBallWorldV2, type SourceFreeBallWorldQueryInputV2 } from './SourceFreeBallWorldQuery';
import { respondToBallContact } from './BallContactResponse';
import type { BallWorldResponseInput } from './BattedBallContactResponse';

const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 };
const fixture = (change?: (d: SourceFreeBallDescriptorV2) => SourceFreeBallDescriptorV2,
  extraSurfaces: SourceFreeBallWorldQueryInputV2['surfaces'] = []) => {
  const original: SourceFreeBallDescriptorV2 = { kind: 'aero_ground_continuous_source_kernel_v2', initial: {
    originTick: 1000, elapsedSeconds: 0, ball: { tick: 1000, position: { x: 0, y: 1, z: 0 }, velocity: { x: 30, y: 0, z: 0 }, spin: { x: 0, y: 12, z: -50 } } },
    throughElapsedSeconds: 0.1, profile: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1_000_000, radiusM: 0.0366, inertiaRatio: 0.378, gravityMps2: 9.81,
      restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } } };
  const descriptor = change ? change(original) : original;
  const input: SourceFreeBallWorldQueryInputV2 = { descriptor, moment: descriptor.initial, side: 'incoming', throughElapsedSeconds: descriptor.throughElapsedSeconds,
    actors: [], surfaces: [{ surfaceId: 'wall', start: { x: 1, z: -1 }, end: { x: 1, z: 1 }, minimumHeight: 0, maximumHeight: 20 }, ...extraSurfaces] };
  const response: BallWorldResponseInput = { world: { parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, integrationStepTicks: 2_000 }, actors: [], surfaces: input.surfaces },
    actors: [], surfaces: input.surfaces.map(s => ({ surfaceId: s.surfaceId, material })) };
  const session = createSourceImpactEscapeSessionV3(), observed = session.query(input);
  if (observed.kind !== 'boundary' || observed.contacts[0].kind !== 'surface' || !observed.contacts[0].normal) throw new Error('expected real wall witness');
  const c = observed.contacts[0], ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal!, surfaceVelocity: { x: 0, y: 0, z: 0 }, material });
  const basis = { ...descriptor, initial: { ...c.moment, ball } };
  const next: SourceFreeBallWorldQueryInputV2 = { ...input, descriptor: basis, moment: basis.initial, side: 'outgoing', previousContacts: [{ kind: 'surface', surfaceId: 'wall' }] };
  return { input, response, session, observed, basis, next };
};

it('rederives the original impulse tuple and certifies only its own bounded microscopic contact escape', () => {
  const x = fixture(), diagnostic = x.session.adoptImpulse(x.observed, x.response, x.basis);
  expect(diagnostic.initialSignedGapMeters).toBeLessThan(0);
  expect(querySourceFreeBallWorldV2(x.next)).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
  const result = x.session.query(x.next);
  expect(result.kind).toBe('moving');
  if (result.kind === 'unresolved') throw new Error('expected proved escape');
  expect(result.moment).toEqual(createSourceFreeBallKernel(x.basis).evaluateAt(x.next.throughElapsedSeconds).moment);
  const advance = x.session.advances()[0];
  expect(advance.escapeBracketThroughElapsedSeconds - advance.fromElapsedSeconds).toBeLessThanOrEqual(1e-12);
  expect(advance.supportingPlaneLowerGapAtEscapeMeters).toBeGreaterThan(0);
  expect(advance.signedGapAtEscapeMeters).toBeGreaterThan(0);
  expect(advance.signedGapAtClearWindowEndMeters).toBeGreaterThan(0);
  expect(diagnostic.outgoingMoment).toEqual(x.basis.initial);
});

it('rejects forged witness identities, clocks, root states, response values and scope without caller proof authority', () => {
  const x = fixture();
  expect(() => x.session.adoptImpulse(structuredClone(x.observed), x.response, x.basis)).toThrow('own sole');
  expect(() => createSourceImpactEscapeSessionV3().adoptImpulse(x.observed, x.response, x.basis)).toThrow('own sole');
  expect(() => x.session.adoptImpulse(x.observed, x.response, { ...x.basis, initial: { ...x.basis.initial, elapsedSeconds: x.basis.initial.elapsedSeconds + 1e-7 } })).toThrow('impulse/clock tuple');
  expect(() => x.session.adoptImpulse(x.observed, x.response, { ...x.basis, initial: { ...x.basis.initial,
    ball: { ...x.basis.initial.ball, velocity: { x: -999, y: 0, z: 0 } } } })).toThrow('impulse/clock tuple');
  expect(() => x.session.adoptImpulse(x.observed, { ...x.response, surfaces: [{ surfaceId: 'wall', material: { ...material, restitution: 0.9 } }] }, x.basis)).toThrow('impulse/clock tuple');
  expect(() => x.session.adoptImpulse(x.observed, { ...x.response, world: { ...x.response.world, surfaces: [] } }, x.basis)).toThrow();
  x.session.adoptImpulse(x.observed, x.response, x.basis);
  expect(x.session.query({ ...x.next, surfaces: [{ ...x.input.surfaces[0], maximumHeight: 4 }] }))
    .toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
});

it('does not grant a certificate to initial deep overlaps or a grazing response', () => {
  const x = fixture(), d = { ...x.input.descriptor, initial: { ...x.input.descriptor.initial,
    ball: { ...x.input.descriptor.initial.ball, position: { x: 1 - 0.01, y: 1, z: 0 } } } };
  const deep = x.session.query({ ...x.input, descriptor: d, moment: d.initial });
  expect(() => x.session.adoptImpulse(deep, x.response, x.basis)).toThrow('bracket');
  const grazing = { ...x.response, surfaces: [{ surfaceId: 'wall', material: { ...material, restitution: 0 } }] };
  if (x.observed.kind !== 'boundary' || x.observed.contacts[0].kind !== 'surface') throw new Error('expected wall');
  const c = x.observed.contacts[0], ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal!,
    surfaceVelocity: { x: 0, y: 0, z: 0 }, material: grazing.surfaces[0].material });
  expect(() => x.session.adoptImpulse(x.observed, grazing, { ...x.basis, initial: { ...c.moment, ball } })).toThrow('outward departure');
});

it('searches every other collider over the whole interval while certifying only the original wall', () => {
  const other = { surfaceId: 'other-wall', start: { x: -0.05, z: -1 }, end: { x: -0.05, z: 1 }, minimumHeight: 0, maximumHeight: 20 };
  const x = fixture(undefined, [other]);
  x.session.adoptImpulse(x.observed, x.response, x.basis);
  const result = x.session.query(x.next);
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected actual second wall');
  expect(result.contacts).toHaveLength(1);
  expect(result.contacts[0]).toMatchObject({ kind: 'surface', surfaceId: other.surfaceId });
  expect(result.moment.elapsedSeconds).toBeGreaterThan(x.basis.initial.elapsedSeconds);
  expect(result).not.toHaveProperty('pendingReason');
});

it('detects the same wall again after a wind-driven return instead of excluding it for the whole free Source', () => {
  const x = fixture(d => ({ ...d, throughElapsedSeconds: 1, initial: { ...d.initial, ball: { ...d.initial.ball,
    position: { x: 0, y: 10, z: 0 }, spin: { x: 0, y: 0, z: 0 } } }, profile: { ...d.profile, air: { ...d.profile.air,
      aerodynamics: { ...d.profile.air.aerodynamics, windVelocityMps: { x: 100, y: 0, z: 0 } } } } }));
  x.session.adoptImpulse(x.observed, x.response, x.basis);
  const result = x.session.query(x.next);
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw new Error('expected returning Source wall contact');
  expect(result.contacts).toHaveLength(1);
  expect(result.contacts[0]).toMatchObject({ kind: 'surface', surfaceId: 'wall' });
  expect(result.moment.elapsedSeconds).toBeGreaterThan(x.basis.initial.elapsedSeconds + 0.1);
  expect(result).not.toHaveProperty('pendingReason');
  const c = result.contacts[0];
  if (c.kind !== 'surface') throw new Error('expected same wall');
  const ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal!, surfaceVelocity: { x: 0, y: 0, z: 0 }, material });
  const second = x.session.adoptImpulse(result, x.response, { ...x.basis, initial: { ...c.moment, ball } });
  expect(second.witnessElapsedSeconds).toBe(result.moment.elapsedSeconds);
  expect(x.session.diagnostics()).toHaveLength(2);
});
