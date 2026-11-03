import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { createSourceImpactEscapeSessionV145, createSourceImpactEscapeSessionV3,
  querySourceFreeBallWorldV2, querySourceFreeBallWorldWithPolesV136,
  type SourceFreeBallWorldQueryInputV2, type SourceFreeBallWorldQueryResultV2 } from './SourceFreeBallWorldQuery';
import type { SourceFreeBallPoleV136 } from './SourceFreeBallPoleV136';
import type { BallWorldResponseInput } from './BattedBallContactResponse';
import { respondToBallContact } from './BallContactResponse';
import { IDENTITY_QUATERNION, quaternionFromAxisAngle } from '../pitching/BaseballOrientation';

// Explicit mathematical fixtures. They imply no actual park material or legal policy.
const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 };
const descriptor = (): SourceFreeBallDescriptorV2 => ({ kind: 'aero_ground_continuous_source_kernel_v2', initial: {
  originTick: 1000, elapsedSeconds: 0, ball: { tick: 1000, position: { x: 0, y: 1, z: 0 },
    velocity: { x: 30, y: 0, z: 0 }, spin: { x: 0, y: 12, z: -50 } } }, throughElapsedSeconds: 0.1,
  profile: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
  ground: { ticksPerSecond: 1_000_000, radiusM: 0.0366, inertiaRatio: 0.378, gravityMps2: 9.81,
    restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25,
      rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } } });
const pole = (patch: Partial<SourceFreeBallPoleV136> = {}): SourceFreeBallPoleV136 => ({ surfaceId: 'synthetic-pole',
  center: { x: 1, z: 0 }, minimumHeight: 0, maximumHeight: 3, radiusM: 0.1, ...patch });
const world = (d = descriptor(), patch: Partial<SourceFreeBallWorldQueryInputV2> = {}): SourceFreeBallWorldQueryInputV2 => ({ descriptor: d,
  moment: d.initial, side: 'incoming', throughElapsedSeconds: d.throughElapsedSeconds, actors: [], surfaces: [], ...patch });
const base = (x: number) => ({ region: { center: { x, z: 0 }, halfSize: { x: 0.2, z: 1 }, rotationRadians: 0 }, bottomY: 0, topY: 2 });
const actor = (x: number): SourceFreeBallWorldQueryInputV2['actors'][number] => ({ playerId: 'synthetic-body', primitive: {
  role: 'body', radius: 0.05, startTick: 1000, endTick: 1_001_000, ticksPerSecond: 1_000_000,
  startCenter: { x, y: 1, z: 0 }, startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } });
const responseFor = (input: SourceFreeBallWorldQueryInputV2): BallWorldResponseInput => ({ world: {
  parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, integrationStepTicks: 2_000 }, actors: input.actors, surfaces: input.surfaces },
  actors: input.actors.map(a => ({ playerId: a.playerId, profile: { role: 'body', material } })),
  surfaces: input.surfaces.map(s => ({ surfaceId: s.surfaceId, material })) });
const singleSurface = (observed: SourceFreeBallWorldQueryResultV2) => {
  if (observed.kind !== 'boundary' || observed.contacts.length !== 1 || observed.contacts[0].kind !== 'surface'
    || !observed.contacts[0].normal) throw Error('expected sole actual cylindrical surface');
  return observed.contacts[0];
};
const fixture = (input = world(), poles = [pole()]) => {
  const session = createSourceImpactEscapeSessionV145(), observed = session.query({ world: input, poles });
  const c = singleSurface(observed), ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal!,
    surfaceVelocity: { x: 0, y: 0, z: 0 }, material });
  const basis = { ...input.descriptor, initial: { ...c.moment, ball } }, response = responseFor(input);
  const materials = poles.map(p => ({ surfaceId: p.surfaceId, material }));
  const next = { world: { ...input, descriptor: basis, moment: basis.initial, side: 'outgoing' as const,
    previousContacts: [{ kind: 'surface' as const, surfaceId: c.surfaceId }] }, poles };
  return { input, poles, session, observed, c, basis, response, materials, next };
};

it.each([-1, 1])('adopts a private actual finite pole impulse and continues the same Source for side %s', side => {
  const original = descriptor(), d = { ...original, initial: { ...original.initial, ball: { ...original.initial.ball,
    velocity: { ...original.initial.ball.velocity, x: 30 * side } } } };
  const x = fixture(world(d), [pole({ center: { x: side, z: 0 } })]);
  expect(x.observed).toEqual(querySourceFreeBallWorldWithPolesV136({ world: x.input, poles: x.poles }));
  const diagnostic = x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis);
  expect(diagnostic.incomingNormalSpeedMps).toBeLessThan(0);
  expect(diagnostic.outgoingNormalSpeedMps).toBeGreaterThan(0);
  expect(diagnostic.outgoingMoment).toEqual(x.basis.initial);
  expect(querySourceFreeBallWorldWithPolesV136(x.next)).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
  const result = x.session.query(x.next);
  expect(result.kind).toBe('moving');
  if (result.kind === 'unresolved') throw Error('expected proved escape');
  expect(result.moment).toEqual(createSourceFreeBallKernel(x.basis).evaluateAt(x.next.world.throughElapsedSeconds).moment);
  expect(x.session.advances()).toHaveLength(1);
  const advance = x.session.advances()[0];
  expect(advance.escapeBracketThroughElapsedSeconds - advance.fromElapsedSeconds).toBeLessThanOrEqual(1e-12);
  expect(advance.supportingPlaneLowerGapAtEscapeMeters).toBeGreaterThan(0);
  expect(advance.signedGapAtEscapeMeters).toBeGreaterThan(0);
  expect(advance.signedGapAtClearWindowEndMeters).toBeGreaterThan(0);
  expect(result).not.toHaveProperty('fair'); expect(result).not.toHaveProperty('officialResult');
});

it('does not let public, cloned or foreign observations acquire private pole response authority', () => {
  const x = fixture(), publicBoundary = querySourceFreeBallWorldWithPolesV136({ world: x.input, poles: x.poles });
  for (const observed of [publicBoundary, structuredClone(x.observed)]) {
    expect(() => x.session.adoptPoleImpulse(observed, x.response, x.materials, x.basis)).toThrow('own sole');
  }
  expect(() => createSourceImpactEscapeSessionV145().adoptPoleImpulse(x.observed, x.response, x.materials, x.basis)).toThrow('own sole');
  expect(Object.isFrozen(x.observed)).toBe(true);
  expect(Object.isFrozen(x.c.moment.ball.velocity)).toBe(true);
  expect(() => createSourceImpactEscapeSessionV3().adoptImpulse(x.observed, x.response, x.basis)).toThrow('own sole');
});

it('rejects changed impulse, origin/elapsed clock, air/ground profile, Source horizon and pole material', () => {
  const x = fixture();
  for (const basis of [
    { ...x.basis, initial: { ...x.basis.initial, originTick: 0 } },
    { ...x.basis, initial: { ...x.basis.initial, elapsedSeconds: x.basis.initial.elapsedSeconds + 1e-7 } },
    { ...x.basis, initial: { ...x.basis.initial, ball: { ...x.basis.initial.ball, velocity: { x: -999, y: 0, z: 0 } } } },
    { ...x.basis, profile: { ...x.basis.profile, ground: { ...x.basis.profile.ground, radiusM: 0.04 } } },
    { ...x.basis, throughElapsedSeconds: 0.2 },
  ]) expect(() => x.session.adoptPoleImpulse(x.observed, x.response, x.materials, basis)).toThrow();
  expect(() => x.session.adoptPoleImpulse(x.observed, x.response,
    [{ surfaceId: x.c.surfaceId, material: { ...material, restitution: 0.9 } }], x.basis)).toThrow('impulse/clock tuple');
  expect(x.session.diagnostics()).toEqual([]);
});

it('requires exact complete pole material membership and never fabricates a wall response profile', () => {
  const x = fixture(world(), [pole(), pole({ surfaceId: 'distant-pole', center: { x: 100, z: 10 } })]);
  for (const materials of [[], [x.materials[0]], [...x.materials, x.materials[0]],
    [...x.materials, { surfaceId: 'foreign-pole', material }],
    x.materials.map(m => ({ ...m, material: { ...material, restitution: NaN } })),
    x.materials.map(m => ({ ...m, material: { ...material, fair: true } })),
  ]) expect(() => x.session.adoptPoleImpulse(x.observed, x.response, materials, x.basis)).toThrow();
  expect(() => x.session.adoptImpulse(x.observed, x.response, x.basis)).toThrow('pole');
  expect(() => x.session.adoptPoleImpulse(x.observed, { ...x.response,
    surfaces: [{ surfaceId: x.c.surfaceId, material }] }, x.materials, x.basis)).toThrow();
  x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis);
  expect(x.session.query(x.next).kind).toBe('moving');
});

it('binds all poles, bases, panels and actors and refuses geometry substitution and escape reuse', () => {
  const x = fixture();
  x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis);
  const modified = [
    { ...x.next, poles: [pole({ radiusM: 0.11 })] },
    { ...x.next, poles: [pole({ maximumHeight: 4 })] },
    { ...x.next, poles: [pole({ center: { x: 1, z: 0.001 } })] },
    { ...x.next, poles: [pole(), pole({ surfaceId: 'new-pole', center: { x: 100, z: 1 } })] },
    { ...x.next, poles: [] },
    { ...x.next, world: { ...x.next.world, surfaces: [{ surfaceId: 'late-wall', start: { x: 100, z: -1 },
      end: { x: 100, z: 1 }, minimumHeight: 0, maximumHeight: 3 }] } },
  ];
  for (const query of modified) expect(() => x.session.query(query)).toThrow('scope');
  expect(() => x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis)).toThrow('used');
  expect(x.session.query(x.next).kind).toBe('moving');
  expect(() => x.session.query(x.next)).toThrow('used');
});

it.each([{ y: 4, vy: -30, minimumHeight: 0, maximumHeight: 3, normalY: 1 },
  { y: 2, vy: 30, minimumHeight: 3, maximumHeight: 6, normalY: -1 }])('adopts the actual flat finite cap response at y=$y', f => {
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 0.05, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: 0, y: f.y, z: 0 }, velocity: { x: 0, y: f.vy, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  const x = fixture(world(d), [pole({ center: { x: 0, z: 0 }, minimumHeight: f.minimumHeight, maximumHeight: f.maximumHeight })]);
  expect(x.c.normal).toEqual({ x: 0, y: f.normalY, z: 0 });
  x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis);
  expect(x.session.query(x.next).kind).toBe('moving');
});

it('retains initial deep overlap, zero-restitution and numerical near-graze refusal', () => {
  const x = fixture(), original = descriptor(), deepDescriptor = { ...original, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: 0.88, y: 1, z: 0 } } } };
  const deepSession = createSourceImpactEscapeSessionV145(), deep = deepSession.query({ world: world(deepDescriptor), poles: x.poles });
  expect(() => deepSession.adoptPoleImpulse(deep, x.response, x.materials, x.basis)).toThrow('bracket');
  const zeroMaterials = [{ surfaceId: x.c.surfaceId, material: { ...material, restitution: 0 } }];
  const ball = respondToBallContact({ ball: x.c.moment.ball, normal: x.c.normal!, surfaceVelocity: { x: 0, y: 0, z: 0 }, material: zeroMaterials[0].material });
  expect(() => x.session.adoptPoleImpulse(x.observed, x.response, zeroMaterials,
    { ...x.basis, initial: { ...x.c.moment, ball } })).toThrow('outward departure');
  const d = { ...original, initial: { ...original.initial, ball: { ...original.initial.ball, position: { x: 0, y: 0.0366, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  const result = createSourceImpactEscapeSessionV145().query({ world: world(d, { side: 'outgoing',
    moment: createSourceFreeBallKernel(d).evaluateAt(0, 'outgoing').moment }), poles: [pole({ center: { x: 0.1366 + 5e-15, z: 0 } })] });
  expect(result).toMatchObject({ kind: 'unresolved', reason: 'numerical_contact_refinement_required' });
});

it('does not suppress another panel after the pole or a later wind-driven return to the same pole', () => {
  const panel = { surfaceId: 'other-wall', start: { x: -0.05, z: -1 }, end: { x: -0.05, z: 1 }, minimumHeight: 0, maximumHeight: 20 };
  const x = fixture(world(descriptor(), { surfaces: [panel] }));
  x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis);
  const result = x.session.query(x.next);
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw Error('expected actual later wall');
  expect(result.contacts).toHaveLength(1); expect(result.contacts[0]).toMatchObject({ kind: 'surface', surfaceId: panel.surfaceId });
  expect(result.moment.elapsedSeconds).toBeGreaterThan(x.basis.initial.elapsedSeconds);
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 1, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: 0, y: 10, z: 0 }, spin: { x: 0, y: 0, z: 0 } } },
  profile: { ...original.profile, air: { ...original.profile.air, aerodynamics: { ...original.profile.air.aerodynamics,
    windVelocityMps: { x: 100, y: 0, z: 0 } } } } };
  const returned = fixture(world(d), [pole({ maximumHeight: 20 })]);
  returned.session.adoptPoleImpulse(returned.observed, returned.response, returned.materials, returned.basis);
  const again = returned.session.query(returned.next), c = singleSurface(again);
  expect(c.surfaceId).toBe(returned.c.surfaceId);
  expect(c.moment.elapsedSeconds).toBeGreaterThan(returned.basis.initial.elapsedSeconds + 0.1);
  const ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal!, surfaceVelocity: { x: 0, y: 0, z: 0 }, material });
  returned.session.adoptPoleImpulse(again, returned.response, returned.materials, { ...returned.basis, initial: { ...c.moment, ball } });
  expect(returned.session.diagnostics()).toHaveLength(2);
});

it('retains the exact old public result for empty poles and rejects a permissive outer schema', () => {
  const input = world();
  expect(createSourceImpactEscapeSessionV145().query({ world: input, poles: [] })).toEqual(querySourceFreeBallWorldV2(input));
  expect(() => createSourceImpactEscapeSessionV145().query({ world: input, poles: [], fair: true } as never)).toThrow();
  expect(() => createSourceImpactEscapeSessionV145().query(input as never)).toThrow();
});

it('preserves earlier ground, body, panel and base contacts in the same complete-pole query', () => {
  const original = descriptor(), groundDescriptor = { ...original, initial: { ...original.initial,
    ball: { ...original.initial.ball, position: { x: 0, y: 0.0366001, z: 0 }, velocity: { x: 0, y: -1, z: 0 } } } };
  const panel = { surfaceId: 'earlier-panel', start: { x: 0.5, z: -1 }, end: { x: 0.5, z: 1 }, minimumHeight: 0, maximumHeight: 3 };
  const inputs = [world(groundDescriptor), world(descriptor(), { actors: [actor(0.5)] }),
    world(descriptor(), { surfaces: [panel] }),
    world(descriptor(), { bases: { home: base(-100), first: base(0.7), second: base(100), third: base(200) } })];
  for (const [index, input] of inputs.entries()) {
    const session = createSourceImpactEscapeSessionV145(), observed = session.query({ world: input, poles: [pole()] });
    expect(observed.kind).toBe('boundary');
    if (observed.kind !== 'boundary') throw Error('expected original earlier boundary');
    expect(observed.contacts).toHaveLength(1); expect(observed.contacts[0].kind).toBe(['ground', 'actor', 'surface', 'base'][index]);
    expect(observed).toEqual(querySourceFreeBallWorldV2(input));
    expect(() => session.adoptPoleImpulse(observed, responseFor(input), [{ surfaceId: pole().surfaceId, material }], input.descriptor)).toThrow();
  }
});

it.each(['panel', 'actor', 'base'] as const)('adopts an earlier %s response without losing later pole chronology', kind => {
  const original = descriptor(), d = { ...original, throughElapsedSeconds: 0.2 };
  const panel = { surfaceId: 'earlier-panel', start: { x: 0.5, z: -1 }, end: { x: 0.5, z: 1 }, minimumHeight: 0, maximumHeight: 3 };
  const bases = { home: base(-100), first: base(0.7), second: base(100), third: base(200) };
  const input = world(d, kind === 'panel' ? { surfaces: [panel] } : kind === 'actor' ? { actors: [actor(0.5)] } : { bases });
  const poles = [pole({ center: { x: -0.3, z: 0 } })], session = createSourceImpactEscapeSessionV145();
  const observed = session.query({ world: input, poles });
  if (observed.kind !== 'boundary' || observed.contacts.length !== 1) throw Error('expected sole earlier contact');
  const c = observed.contacts[0];
  if (c.kind !== 'actor' && c.kind !== 'surface' && c.kind !== 'base' || !c.normal) throw Error('expected original normal');
  const ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal, surfaceVelocity: c.kind === 'actor' ? c.velocity : { x: 0, y: 0, z: 0 }, material });
  const basis = { ...d, initial: { ...c.moment, ball } }, response = responseFor(input);
  if (kind === 'base') session.adoptBaseImpulse(observed, response, { home: material, first: material, second: material, third: material }, basis);
  else session.adoptImpulse(observed, response, basis);
  const previous = c.kind === 'base' ? { previousBaseContacts: [c.baseId] } : { previousContacts: [c.kind === 'actor'
    ? { kind: 'actor' as const, playerId: c.playerId, role: c.role } : { kind: 'surface' as const, surfaceId: c.surfaceId }] };
  const next = { world: { ...input, descriptor: basis, moment: basis.initial, side: 'outgoing' as const, ...previous }, poles };
  const changedPoles = [{ ...poles[0], minimumHeight: 0.01 }];
  expect(() => session.query({ ...next, poles: changedPoles })).toThrow('scope');
  const hit = session.query(next), contact = singleSurface(hit);
  expect(contact.surfaceId).toBe(poles[0].surfaceId);
  expect(contact.moment.elapsedSeconds).toBeGreaterThan(c.moment.elapsedSeconds);
  const poleBall = respondToBallContact({ ball: contact.moment.ball, normal: contact.normal!, surfaceVelocity: { x: 0, y: 0, z: 0 }, material });
  session.adoptPoleImpulse(hit, response, [{ surfaceId: poles[0].surfaceId, material }], { ...basis, initial: { ...contact.moment, ball: poleBall } });
  expect(session.diagnostics()).toHaveLength(2);
});

it('keeps a truly simultaneous pole/panel boundary ambiguous and refuses either impulse family', () => {
  const original = descriptor(), d = { ...original, initial: { ...original.initial,
    ball: { ...original.initial.ball, spin: { x: 0, y: 0, z: 0 } } } };
  const input = world(d, { surfaces: [{ surfaceId: 'same-time-panel', start: { x: 0.9, z: -1 }, end: { x: 0.9, z: 1 }, minimumHeight: 0, maximumHeight: 3 }] });
  const session = createSourceImpactEscapeSessionV145(), result = session.query({ world: input, poles: [pole()] });
  expect(result.kind).toBe('boundary');
  if (result.kind !== 'boundary') throw Error('expected ambiguous actual boundary');
  expect(result.contacts).toHaveLength(2);
  expect(() => session.adoptPoleImpulse(result, responseFor(input), [{ surfaceId: pole().surfaceId, material }], d)).toThrow('own sole');
  expect(() => session.adoptImpulse(result, responseFor(input), d)).toThrow('own sole');
});

it('freezes complete observed geometry and does not accept omitted/extra previous collider capability', () => {
  const x = fixture(), before = JSON.stringify(x.poles);
  x.poles[0] = { ...x.poles[0], radiusM: 0.11 };
  expect(JSON.stringify(x.poles)).not.toBe(before);
  x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis);
  expect(() => x.session.query(x.next)).toThrow('scope');
  const originalNext = { ...x.next, poles: [pole()] };
  expect(() => x.session.query({ ...originalNext, world: { ...originalNext.world, previousContacts: [] } })).toThrow('scope');
  expect(() => x.session.query({ ...originalNext, world: { ...originalNext.world,
    previousContacts: [...originalNext.world.previousContacts, ...originalNext.world.previousContacts] } })).toThrow('scope');
  expect(x.session.query(originalNext).kind).toBe('moving');
});

it('does not mint another impulse capability by querying the same original boundary again', () => {
  const x = fixture(), repeated = x.session.query({ world: x.input, poles: x.poles });
  expect(repeated).toEqual(x.observed); expect(repeated).not.toBe(x.observed);
  x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis);
  expect(() => x.session.adoptPoleImpulse(repeated, x.response, x.materials, x.basis)).toThrow('used');
  x.session.query(x.next);
  const afterEscape = x.session.query({ world: x.input, poles: x.poles });
  expect(() => x.session.adoptPoleImpulse(afterEscape, x.response, x.materials, x.basis)).toThrow('used');
});

it('does not mint another physical boundary by extending only the original Source horizon', () => {
  const x = fixture();
  x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis);
  const extendedDescriptor = { ...x.input.descriptor, throughElapsedSeconds: 0.2 };
  const repeated = x.session.query({ world: { ...x.input, descriptor: extendedDescriptor, throughElapsedSeconds: 0.2 }, poles: x.poles });
  expect(repeated).toEqual(x.observed);
  expect(() => x.session.adoptPoleImpulse(repeated, x.response, x.materials,
    { ...x.basis, throughElapsedSeconds: 0.2 })).toThrow('physical boundary already used');
  expect(x.session.diagnostics()).toHaveLength(1);
  expect(x.session.query(x.next).kind).toBe('moving');
});

it('keeps the unconsumed escape capability across a zero-time observation of the original outgoing moment', () => {
  const x = fixture();
  x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis);
  const zeroTime = x.session.query({ ...x.next, world: { ...x.next.world,
    throughElapsedSeconds: x.basis.initial.elapsedSeconds } });
  expect(zeroTime.kind).toBe('moving');
  if (zeroTime.kind === 'unresolved') throw Error('expected the original zero-time observation');
  expect(zeroTime.moment).toEqual(x.basis.initial);
  expect(x.session.advances()).toEqual([]);
  const continued = x.session.query(x.next);
  expect(continued.kind).toBe('moving');
  if (continued.kind === 'unresolved') throw Error('expected the actual later escape');
  expect(continued.moment).toEqual(createSourceFreeBallKernel(x.basis).evaluateAt(x.next.world.throughElapsedSeconds).moment);
  expect(x.session.advances()).toHaveLength(1);
  expect(() => x.session.query(x.next)).toThrow('used');
});

it('continues the same adopted physical basis when a later checkpoint extends its Source horizon', () => {
  const x = fixture();
  x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis);
  const extendedBasis = { ...x.basis, throughElapsedSeconds: 0.2 };
  const result = x.session.query({ ...x.next, world: { ...x.next.world,
    descriptor: extendedBasis, throughElapsedSeconds: 0.2 } });
  expect(result.kind).toBe('moving');
  if (result.kind === 'unresolved') throw Error('expected the actual same-basis escape');
  expect(result.moment).toEqual(createSourceFreeBallKernel(extendedBasis).evaluateAt(0.2).moment);
  expect(x.session.advances()).toHaveLength(1);
  expect(() => x.session.query(x.next)).toThrow('used');
});

it('binds distant actor and base geometry even when neither causes the adopted pole contact', () => {
  const input = world(descriptor(), { actors: [actor(100)], bases: { home: base(-100), first: base(100), second: base(200), third: base(300) } });
  const x = fixture(input);
  x.session.adoptPoleImpulse(x.observed, x.response, x.materials, x.basis);
  for (const change of [{ actors: [] }, { actors: [{ ...actor(100), primitive: { ...actor(100).primitive, radius: 0.051 } }] },
    { bases: { ...input.bases!, second: { ...input.bases!.second, topY: 3 } } }])
    expect(() => x.session.query({ ...x.next, world: { ...x.next.world, ...change } })).toThrow('scope');
  const { bases, ...withoutBases } = x.next.world;
  expect(bases).toBeDefined();
  expect(() => x.session.query({ ...x.next, world: withoutBases })).toThrow('scope');
  expect(x.session.query(x.next).kind).toBe('moving');
});

it('carries the actual incoming seam material orientation through the pole impulse', () => {
  const original = descriptor(), d = { ...original, materialOrientationAtStart: quaternionFromAxisAngle({ x: 1, y: 2, z: 3 }, 0.7),
    profile: { ...original.profile, air: { ...original.profile.air, aerodynamics: { ...original.profile.air.aerodynamics,
      seamForce: { version: 'baseball_seam_force_v1' as const, coefficientScale: 1 } } } } };
  const x = fixture(world(d)), incoming = createSourceFreeBallKernel(d).evaluateAt(x.c.moment.elapsedSeconds, 'incoming');
  const basis = { ...x.basis, materialOrientationAtStart: incoming.materialOrientation! };
  expect(() => x.session.adoptPoleImpulse(x.observed, x.response, x.materials,
    { ...basis, materialOrientationAtStart: IDENTITY_QUATERNION })).toThrow('material orientation');
  x.session.adoptPoleImpulse(x.observed, x.response, x.materials, basis);
  const next = { ...x.next, world: { ...x.next.world, descriptor: basis } }, result = x.session.query(next);
  expect(result.kind).toBe('moving');
  if (result.kind === 'unresolved') throw Error('expected actual same-source phase continuation');
  expect(result.moment).toEqual(createSourceFreeBallKernel(basis).evaluateAt(0.1).moment);
  expect(createSourceFreeBallKernel(basis).evaluateAt(basis.initial.elapsedSeconds).materialOrientation).toEqual(incoming.materialOrientation);
});
