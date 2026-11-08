import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { createSourceFreePoleSessionV148, querySourceFreeBallWorldV2, querySourceFreeBallWorldWithPolesV136,
  type SourceFreeBallPoleMaterialsV145, type SourceFreeBallWorldQueryResultV2 } from './SourceFreeBallWorldQuery';
import type { SourceFreeBallPoleV136 } from './SourceFreeBallPoleV136';
import { respondToBallContact } from './BallContactResponse';
import { IDENTITY_QUATERNION, quaternionFromAxisAngle } from '../pitching/BaseballOrientation';
import { quantizeEventTick } from '../ExactEventTime';

// Authored SI fixtures, not adopted park dimensions, materials or legal policy.
const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 };
const descriptor = (): SourceFreeBallDescriptorV2 => ({ kind: 'aero_ground_continuous_source_kernel_v2', initial: {
  originTick: 1000, elapsedSeconds: 0, ball: { tick: 1000, position: { x: 0, y: 1, z: 0 },
    velocity: { x: 30, y: 0, z: 0 }, spin: { x: 0, y: 12, z: -50 } } }, throughElapsedSeconds: 0.1,
  profile: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1_000_000, radiusM: 0.0366, inertiaRatio: 0.378,
    gravityMps2: 9.81, restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25,
      rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } } });
const pole = (patch: Partial<SourceFreeBallPoleV136> = {}): SourceFreeBallPoleV136 => ({ surfaceId: 'synthetic-pole',
  center: { x: 1, z: 0 }, minimumHeight: 0, maximumHeight: 3, radiusM: 0.1, ...patch });
const query = (d = descriptor()) => ({ descriptor: d, moment: d.initial, side: 'incoming' as const, throughElapsedSeconds: d.throughElapsedSeconds });
const config = (poles = [pole()], materials: SourceFreeBallPoleMaterialsV145 = poles.map(p => ({ surfaceId: p.surfaceId, material }))) =>
  ({ version: 'source_free_pole_session_v148' as const, poles, materials });
const contact = (r: SourceFreeBallWorldQueryResultV2) => {
  if (r.kind !== 'boundary' || r.contacts.length !== 1 || r.contacts[0].kind !== 'surface' || !r.contacts[0].normal)
    throw Error('expected sole physical pole contact');
  return r.contacts[0];
};
const fixture = (d = descriptor(), poles = [pole()]) => {
  const input = query(d), options = config(poles), session = createSourceFreePoleSessionV148(options), observed = session.query(input);
  const c = contact(observed), ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal!,
    surfaceVelocity: { x: 0, y: 0, z: 0 }, material });
  const phase = createSourceFreeBallKernel(d).evaluateAt(c.moment.elapsedSeconds, 'incoming').materialOrientation;
  const basis = { ...d, initial: { ...c.moment, ball }, ...(phase === undefined ? {} : { materialOrientationAtStart: phase }) };
  return { input, options, session, observed, c, basis, next: { ...input, descriptor: basis, moment: basis.initial, side: 'outgoing' as const } };
};

it.each([-1, 1])('uses the finite pole, fixed original material and same free Source for side %s', side => {
  const original = descriptor(), d = { ...original, initial: { ...original.initial,
    ball: { ...original.initial.ball, velocity: { x: side * 30, y: 0, z: 0 } } } };
  const x = fixture(d, [pole({ center: { x: side, z: 0 } })]);
  const publicQuery = { world: { ...x.input, actors: [], surfaces: [] }, poles: x.options.poles };
  expect(x.observed).toEqual(querySourceFreeBallWorldWithPolesV136(publicQuery));
  const diagnostic = x.session.adoptPoleImpulse(x.observed, x.basis);
  expect(diagnostic.incomingNormalSpeedMps).toBeLessThan(0); expect(diagnostic.outgoingNormalSpeedMps).toBeGreaterThan(0);
  expect(diagnostic.outgoingMoment).toEqual(x.basis.initial);
  const result = x.session.query(x.next);
  expect(result.kind).toBe('moving');
  if (result.kind === 'unresolved') throw Error('expected proved physical departure');
  expect(result.moment).toEqual(createSourceFreeBallKernel(x.basis).evaluateAt(0.1).moment);
  expect(x.session.advances()).toHaveLength(1);
  const advance = x.session.advances()[0];
  expect(advance.supportingPlaneLowerGapAtEscapeMeters).toBeGreaterThan(0);
  expect(advance.signedGapAtEscapeMeters).toBeGreaterThan(0); expect(advance.signedGapAtClearWindowEndMeters).toBeGreaterThan(0);
  expect(advance.escapeBracketThroughElapsedSeconds - advance.fromElapsedSeconds).toBeLessThanOrEqual(1e-12);
  for (const key of ['native', 'official', 'fair', 'homeRun', 'award']) expect(result).not.toHaveProperty(key);
});

it('accepts a genuine fractional released free basis without a fabricated bat-flight header', () => {
  const original = descriptor(), start = 0.12345635, d = { ...original, throughElapsedSeconds: start + 0.1, initial: { ...original.initial,
    elapsedSeconds: start, ball: { ...original.initial.ball, tick: quantizeEventTick(original.initial.originTick, start, 1_000_000) } } };
  const x = fixture(d), before = JSON.stringify(x.input);
  x.session.adoptPoleImpulse(x.observed, x.basis);
  const result = x.session.query(x.next);
  expect(result.kind).toBe('moving');
  if (result.kind === 'unresolved') throw Error('expected free released-basis continuation');
  expect(result.moment).toEqual(createSourceFreeBallKernel(x.basis).evaluateAt(d.throughElapsedSeconds).moment);
  expect(result.moment.originTick).toBe(original.initial.originTick); expect(JSON.stringify(x.input)).toBe(before);
});

it('allows same-basis horizon extension and retains an unused escape through repeated zero-time observations', () => {
  const x = fixture(); x.session.adoptPoleImpulse(x.observed, x.basis);
  for (let i = 0; i < 2; i++) {
    const zero = x.session.query({ ...x.next, throughElapsedSeconds: x.basis.initial.elapsedSeconds });
    expect(zero.kind).toBe('moving'); expect(x.session.advances()).toEqual([]);
  }
  const basis = { ...x.basis, throughElapsedSeconds: 0.2 }, next = { ...x.next, descriptor: basis, throughElapsedSeconds: 0.2 };
  const result = x.session.query(next);
  expect(result.kind).toBe('moving');
  if (result.kind === 'unresolved') throw Error('expected same-basis extended escape');
  expect(result.moment).toEqual(createSourceFreeBallKernel(basis).evaluateAt(0.2).moment);
  expect(x.session.advances()).toHaveLength(1);
  expect(() => x.session.query(next)).toThrow('used');
  expect(() => x.session.query(x.next)).toThrow('used');
});

it('requires its own sole observation and refuses public, cloned, foreign and fabricated boundaries', () => {
  const x = fixture(), publicResult = querySourceFreeBallWorldWithPolesV136({ world: { ...x.input, actors: [], surfaces: [] }, poles: x.options.poles });
  for (const r of [publicResult, structuredClone(x.observed), {} as SourceFreeBallWorldQueryResultV2])
    expect(() => x.session.adoptPoleImpulse(r, x.basis)).toThrow('own sole');
  expect(() => createSourceFreePoleSessionV148(x.options).adoptPoleImpulse(x.observed, x.basis)).toThrow('own sole');
  expect(Object.isFrozen(x.observed)).toBe(true); expect(Object.isFrozen(x.c.moment.ball.velocity)).toBe(true);
});

it('does not obtain a departure by supplying an already reflected basis to a fresh session', () => {
  const x = fixture(), fresh = createSourceFreePoleSessionV148(x.options), unobserved = fresh.query(x.next);
  expect(unobserved.kind).toBe('boundary');
  expect(() => fresh.adoptPoleImpulse(unobserved, x.basis)).toThrow('bracket');
  expect(fresh.advances()).toEqual([]);
  x.session.adoptPoleImpulse(x.observed, x.basis);
  expect(() => x.session.query({ ...x.next, side: 'incoming' })).toThrow('outgoing moment');
  expect(() => x.session.query({ ...x.next, moment: { ...x.next.moment,
    elapsedSeconds: x.next.moment.elapsedSeconds + 1e-7 } })).toThrow('outgoing moment');
  expect(x.session.query(x.next).kind).toBe('moving');
});

it('continues later exact Source observations after the single departure capability has been consumed', () => {
  const x = fixture(); x.session.adoptPoleImpulse(x.observed, x.basis);
  const first = x.session.query({ ...x.next, throughElapsedSeconds: 0.08 });
  if (first.kind !== 'moving') throw Error('expected original contact-free checkpoint');
  const next = x.session.query({ ...x.next, moment: first.moment });
  expect(next.kind).toBe('moving');
  if (next.kind === 'unresolved') throw Error('expected retained free Source');
  expect(next.moment).toEqual(createSourceFreeBallKernel(x.basis).evaluateAt(0.1).moment);
  expect(x.session.advances()).toHaveLength(1);
});

it('preserves the exact no-pole path and rejects an invented free query moment or horizon', () => {
  const session = createSourceFreePoleSessionV148(config([])), q = query();
  expect(session.query(q)).toEqual(querySourceFreeBallWorldV2({ ...q, actors: [], surfaces: [] }));
  expect(() => session.query({ ...q, throughElapsedSeconds: 0.2 })).toThrow();
  expect(() => session.query({ ...q, moment: { ...q.moment,
    ball: { ...q.moment.ball, velocity: { x: 999, y: 0, z: 0 } } } })).toThrow('original Source moment');
});

it('rejects changes to the reflected velocity/spin, exact clock, original profile, horizon and material response', () => {
  const x = fixture();
  const differentMaterialBall = respondToBallContact({ ball: x.c.moment.ball, normal: x.c.normal!, surfaceVelocity: { x: 0, y: 0, z: 0 },
    material: { ...material, restitution: 0.9 } });
  for (const basis of [
    { ...x.basis, initial: { ...x.basis.initial, originTick: 0 } },
    { ...x.basis, initial: { ...x.basis.initial, elapsedSeconds: x.basis.initial.elapsedSeconds + 1e-7 } },
    { ...x.basis, initial: { ...x.basis.initial, ball: { ...x.basis.initial.ball, velocity: { x: -999, y: 0, z: 0 } } } },
    { ...x.basis, initial: { ...x.basis.initial, ball: { ...x.basis.initial.ball, spin: { x: 0, y: 0, z: 0 } } } },
    { ...x.basis, initial: { ...x.basis.initial, ball: differentMaterialBall } },
    { ...x.basis, profile: { ...x.basis.profile, ground: { ...x.basis.profile.ground, radiusM: 0.04 } } },
    { ...x.basis, throughElapsedSeconds: 0.2 },
  ]) expect(() => x.session.adoptPoleImpulse(x.observed, basis)).toThrow();
  expect(x.session.diagnostics()).toEqual([]);
});

it('fixes every pole/material at construction, including unused objects, and does not accept caller previous-contact or World overrides', () => {
  const q = query(), poles = [pole(), pole({ surfaceId: 'unused', center: { x: 100, z: 10 } })], good = config(poles);
  for (const options of [
    { ...good, poles: [...poles, poles[0]], materials: [...good.materials, good.materials[0]] },
    { ...good, poles: [poles[0], { ...poles[1], radiusM: 0 }] },
    { ...good, materials: good.materials.slice(0, 1) },
    { ...good, materials: [...good.materials, good.materials[0]] },
    { ...good, materials: [{ ...good.materials[0], surfaceId: 'foreign' }, good.materials[1]] },
    { ...good, materials: [good.materials[0], { ...good.materials[1], material: { ...material, restitution: NaN } }] },
    { ...good, materials: [good.materials[0], { ...good.materials[1], material: { ...material, fair: true } }] },
    { ...good, actors: [] },
  ]) expect(() => createSourceFreePoleSessionV148(options as never)).toThrow();
  const session = createSourceFreePoleSessionV148(good);
  for (const change of [{ poles }, { materials: good.materials }, { actors: [] }, { world: {} }, { flight: {} },
    { previousContacts: [{ kind: 'surface', surfaceId: poles[0].surfaceId }] }])
    expect(() => session.query({ ...q, ...change } as never)).toThrow();
});

it('isolates caller mutations from the frozen original geometry and material scope', () => {
  const options = config(), session = createSourceFreePoleSessionV148(options), q = query();
  options.poles[0] = pole({ center: { x: 100, z: 0 } });
  const changed = options.materials as { surfaceId: string; material: typeof material }[];
  changed[0] = { ...changed[0], material: { ...material, restitution: 0.9 } };
  const observed = session.query(q), c = contact(observed), ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal!,
    surfaceVelocity: { x: 0, y: 0, z: 0 }, material });
  const basis = { ...q.descriptor, initial: { ...c.moment, ball } };
  expect(c.surfaceId).toBe('synthetic-pole'); session.adoptPoleImpulse(observed, basis);
  expect(session.query({ ...q, descriptor: basis, moment: basis.initial, side: 'outgoing' }).kind).toBe('moving');
});

it('refuses duplicate physical-boundary adoption even after a horizon-only query change', () => {
  const x = fixture(), repeated = x.session.query(x.input);
  x.session.adoptPoleImpulse(x.observed, x.basis);
  expect(() => x.session.adoptPoleImpulse(x.observed, x.basis)).toThrow('used');
  expect(() => x.session.adoptPoleImpulse(repeated, x.basis)).toThrow('used');
  const longer = { ...x.input, descriptor: { ...x.input.descriptor, throughElapsedSeconds: 0.2 }, throughElapsedSeconds: 0.2 };
  const again = x.session.query(longer);
  expect(() => x.session.adoptPoleImpulse(again, { ...x.basis, throughElapsedSeconds: 0.2 })).toThrow('used');
});

it('rejects initial deep overlap and a zero-restitution departure without nudging position or clock', () => {
  const original = descriptor(), d = { ...original, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: 0.88, y: 1, z: 0 } } } }, x = fixture(d);
  expect(() => x.session.adoptPoleImpulse(x.observed, x.basis)).toThrow('bracket');
  const options = config([pole()], [{ surfaceId: pole().surfaceId, material: { ...material, restitution: 0 } }]);
  const session = createSourceFreePoleSessionV148(options), observed = session.query(query()), c = contact(observed);
  const ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal!, surfaceVelocity: { x: 0, y: 0, z: 0 }, material: options.materials[0].material });
  expect(() => session.adoptPoleImpulse(observed, { ...descriptor(), initial: { ...c.moment, ball } })).toThrow('outward departure');
});

it.each([{ y: 4, vy: -30, minimumHeight: 0, maximumHeight: 3, normalY: 1 },
  { y: 2, vy: 30, minimumHeight: 3, maximumHeight: 6, normalY: -1 }])('adopts finite flat cap response at y=$y', f => {
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 0.05, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: 0, y: f.y, z: 0 }, velocity: { x: 0, y: f.vy, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  const x = fixture(d, [pole({ center: { x: 0, z: 0 }, minimumHeight: f.minimumHeight, maximumHeight: f.maximumHeight })]);
  expect(x.c.normal).toEqual({ x: 0, y: f.normalY, z: 0 });
  x.session.adoptPoleImpulse(x.observed, x.basis); expect(x.session.query(x.next).kind).toBe('moving');
});

it('retains exact original ground handling and does not adopt ground as a pole impulse', () => {
  const original = descriptor(), d = { ...original, initial: { ...original.initial, ball: { ...original.initial.ball,
    position: { x: 0, y: 0.0366001, z: 0 }, velocity: { x: 0, y: -1, z: 0 } } } };
  const session = createSourceFreePoleSessionV148(config()), q = query(d), result = session.query(q);
  expect(result).toEqual(querySourceFreeBallWorldV2({ ...q, actors: [], surfaces: [] }));
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw Error('expected actual ground');
  expect(result.contacts.map(c => c.kind)).toEqual(['ground']);
  expect(() => session.adoptPoleImpulse(result, d)).toThrow('own sole');
  const outgoing = createSourceFreeBallKernel(d).evaluateAt(result.moment.elapsedSeconds, 'outgoing').moment;
  const next = { ...q, moment: outgoing, side: 'outgoing' as const, throughElapsedSeconds: outgoing.elapsedSeconds };
  expect(session.query(next)).toEqual(querySourceFreeBallWorldV2({ ...next, actors: [], surfaces: [] }));
});

it('preserves a simultaneous two-pole boundary and a numerical near-graze without impulse authority', () => {
  const session = createSourceFreePoleSessionV148(config([pole(), pole({ surfaceId: 'other-pole' })])), result = session.query(query());
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw Error('expected simultaneous finite poles');
  expect(result.contacts).toHaveLength(2); expect(() => session.adoptPoleImpulse(result, descriptor())).toThrow('own sole');
  const original = descriptor(), d = { ...original, initial: { ...original.initial, ball: { ...original.initial.ball,
    position: { x: 0, y: 0.0366, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  const near = createSourceFreePoleSessionV148(config([pole({ center: { x: 0.1366 + 5e-15, z: 0 } })]));
  expect(near.query({ ...query(d), moment: createSourceFreeBallKernel(d).evaluateAt(0, 'outgoing').moment, side: 'outgoing' }))
    .toMatchObject({ kind: 'unresolved', reason: 'numerical_contact_refinement_required' });
});

it('retains the physical seam phase at a pole reflection and refuses a caller orientation reset', () => {
  const original = descriptor(), d = { ...original, materialOrientationAtStart: quaternionFromAxisAngle({ x: 1, y: 2, z: 3 }, 0.7),
    profile: { ...original.profile, air: { ...original.profile.air, aerodynamics: { ...original.profile.air.aerodynamics,
      seamForce: { version: 'baseball_seam_force_v1' as const, coefficientScale: 1 } } } } };
  const x = fixture(d);
  expect(() => x.session.adoptPoleImpulse(x.observed, { ...x.basis, materialOrientationAtStart: IDENTITY_QUATERNION })).toThrow('material orientation');
  x.session.adoptPoleImpulse(x.observed, x.basis); expect(x.session.query(x.next).kind).toBe('moving');
});

it('searches a later pole and a wind-driven return to the same pole rather than excluding previous contacts', () => {
  const x = fixture(descriptor(), [pole(), pole({ surfaceId: 'later-pole', center: { x: -0.3, z: 0 } })]);
  x.session.adoptPoleImpulse(x.observed, x.basis);
  const basis = { ...x.basis, throughElapsedSeconds: 0.2 };
  expect(contact(x.session.query({ ...x.next, descriptor: basis, throughElapsedSeconds: 0.2 })).surfaceId).toBe('later-pole');
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 1, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: 0, y: 10, z: 0 }, spin: { x: 0, y: 0, z: 0 } } },
    profile: { ...original.profile, air: { ...original.profile.air, aerodynamics: { ...original.profile.air.aerodynamics,
      windVelocityMps: { x: 100, y: 0, z: 0 } } } } };
  const returned = fixture(d, [pole({ maximumHeight: 20 })]); returned.session.adoptPoleImpulse(returned.observed, returned.basis);
  const observed = returned.session.query(returned.next), c = contact(observed);
  expect(c.surfaceId).toBe(returned.c.surfaceId); expect(c.moment.elapsedSeconds).toBeGreaterThan(returned.c.moment.elapsedSeconds + 0.1);
  const ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal!, surfaceVelocity: { x: 0, y: 0, z: 0 }, material });
  returned.session.adoptPoleImpulse(observed, { ...returned.basis, initial: { ...c.moment, ball } });
  expect(returned.session.diagnostics()).toHaveLength(2);
});

it('requires Live to cap and compare the pole-only candidate against independent real actor/fence events', () => {
  const d = descriptor(), q = query(d), session = createSourceFreePoleSessionV148(config());
  const actual = querySourceFreeBallWorldV2({ ...q, actors: [{ playerId: 'real-body', primitive: { role: 'body', radius: 0.05,
    startTick: 1000, endTick: 101000, ticksPerSecond: 1_000_000, startCenter: { x: 0.4, y: 1, z: 0 },
    startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } }], surfaces: [] });
  if (actual.kind !== 'boundary') throw Error('expected independently observed earlier body');
  const capped = session.query({ ...q, throughElapsedSeconds: actual.moment.elapsedSeconds });
  expect(capped.kind).toBe('moving');
  expect(contact(session.query(q)).moment.elapsedSeconds).toBeGreaterThan(actual.moment.elapsedSeconds);
});
