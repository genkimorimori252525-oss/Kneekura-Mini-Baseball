import { expect, it, vi } from 'vitest';
import * as continuation from './BallWorldContinuation';
import { battedWorldBaseSurfaceId, deriveInitialBattedWorldFieldMotion } from './BattedWorldFieldMotion';
import { fixture, geometry, material, v } from './BattedWorldScheduledFieldThrow.test-support';
import { advanceBattedWorldScheduledFieldAcquisition as advance, prepareBattedWorldScheduledFieldAcquisition as prepare,
  validateBattedWorldScheduledFieldAcquisitionProgress as validateProgress } from './BattedWorldScheduledFieldAcquisition';
import { deriveBattedWorldFieldAcquisition } from './BattedWorldFieldAcquisition';
import { acquisitionInput, withContactAt } from './BattedWorldScheduledFieldAcquisition.test-support';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import type { BattedWorldScheduledFieldAcquisitionAdvance } from './BattedWorldScheduledFieldAcquisition';

it('prepares immutable original retention and recorded fence without querying future collisions', async () => {
  const input = fixture(0, 0.0625 / 0.0625001);
  const field = deriveInitialBattedWorldFieldMotion(input);
  const query = vi.spyOn(continuation, 'deriveAcceleratedBallWorldFieldMotion');
  try {
    const module = await import('./BattedWorldScheduledFieldAcquisition').catch(() => null);
    expect(module, 'scheduled acquisition API must exist').not.toBeNull();
    const plan = module!.prepareBattedWorldScheduledFieldAcquisition({ response: input.response, geometry: input.geometry, field });
    expect(plan.policy).toBe('original_energy_recorded_tick_fence_v1');
    expect(plan.contactMoment).toEqual(field.motion.world.moment);
    expect(plan.initialConstraintMoment.ball.velocity).toEqual(v(1, 0, 0));
    expect(plan.contactMoment.ball.velocity).toEqual(v(2, 0, 0));
    expect(plan.initialEnergyJ).toBe(0.0625);
    expect(plan.contactOffset).toEqual(v(-0.25, 0, 0));
    expect(plan.secureElapsedSeconds).toBe(0.0625001);
    expect(plan.fenceElapsedSeconds).toBe(0.062501);
    expect(plan.candidateSecureTick).toBe(62_501);
    expect(plan.coverageThroughTick).toBe(5_000_000);
    expect(plan).not.toHaveProperty('acquisition');
    expect(Object.isFrozen(plan.input.field.motion.world)).toBe(true);
    expect(query).not.toHaveBeenCalled();
    expect(() => module!.validateBattedWorldScheduledFieldAcquisitionPlan(JSON.parse(JSON.stringify(plan)))).not.toThrow();
    expect(query).not.toHaveBeenCalled();
  } finally { query.mockRestore(); }
});


it('adopts bounded capture, dissipation, and recorded fence while retaining original exact acquisition evidence', () => {
  expect(advance).toBeTypeOf('function');
  const input = acquisitionInput(fixture(0, 0.0625 / 0.0625001)), plan = prepare(input);
  const captured = advance({ plan, previous: null, throughElapsedSeconds: 0.02 });
  expect(captured.kind).toBe('capturing');
  expect(captured.startMoment).toEqual(plan.contactMoment);
  expect(captured.world.moment.ball.velocity).toEqual(v(1, 0, 0));
  expect(captured.transport.remainingEnergyJ).toBe(plan.initialEnergyJ - plan.captureDissipationPowerW * 0.02);
  expect(captured.cursor).toBeNull(); expect(captured.acquisition).toBeNull(); expect(captured.dissipationMoment).toBeNull();
  const pending = advance({ plan, previous: captured, throughElapsedSeconds: plan.secureElapsedSeconds });
  expect(pending.kind).toBe('fence_pending'); expect(pending.transport.remainingEnergyJ).toBe(0);
  expect(pending.dissipationMoment?.elapsedSeconds).toBe(plan.secureElapsedSeconds);
  expect(pending.cursor).toBeNull(); expect(pending.acquisition).toBeNull();
  const inside = advance({ plan, previous: pending, throughElapsedSeconds: 0.0625005 });
  expect(inside.kind).toBe('fence_pending'); expect(inside.dissipationMoment).toEqual(pending.dissipationMoment);
  const secured = advance({ plan, previous: inside, throughElapsedSeconds: 1 });
  expect(secured.kind).toBe('secured'); if (secured.kind !== 'secured') throw new Error('secured fixture');
  expect(secured.cursor.moment.elapsedSeconds).toBe(plan.fenceElapsedSeconds);
  expect(secured.cursor.moment).toEqual(secured.world.moment);
  expect(secured.cursor.previousContacts).toEqual([{ kind: 'actor', playerId: 'carrier', role: 'glove' }]);
  expect(secured.startMoment).toEqual(inside.world.moment);
  expect(secured.acquisition).toEqual(deriveBattedWorldFieldAcquisition(input));
  expect(secured.checkpointElapsedSeconds).toEqual([0.02, 0.0625001, 0.0625005, 1]);
  expect(() => validateProgress(plan, JSON.parse(JSON.stringify(secured)))).not.toThrow();
  expect(captured.dissipationMoment).toBeNull(); expect(pending.acquisition).toBeNull();
});

it('does not query beyond a partial checkpoint or evaluate the atomic future outcome', () => {
  const plan = prepare(acquisitionInput(fixture(0, 0.0625 / 0.0625001)));
  const query = vi.spyOn(continuation, 'deriveAcceleratedBallWorldFieldMotion');
  try {
    const progress = advance({ plan, previous: null, throughElapsedSeconds: 0.01 });
    expect(progress.kind).toBe('capturing');
    expect(query).toHaveBeenCalled();
    expect(query.mock.calls.every(([scope]) => scope.throughElapsedSeconds <= 0.01)).toBe(true);
  } finally { query.mockRestore(); }
});

it.each([
  { seconds: 0.03125, kind: 'contact' },
  { seconds: 0.0625, kind: 'contact' },
])('retains bag and continuing glove evidence at $seconds seconds', ({ seconds, kind }) => {
  const input = acquisitionInput({ ...fixture(), geometry: geometry(1.375 + seconds) }), plan = prepare(input);
  const progress = advance({ plan, previous: null, throughElapsedSeconds: 1 });
  expect(progress.kind).toBe('interrupted'); if (progress.kind !== 'interrupted') throw new Error('interrupted fixture');
  expect(progress.acquisition.reason).toBe(kind);
  expect(progress.world.moment.elapsedSeconds).toBe(seconds);
  expect(progress.baseContacts.map((c) => c.baseId)).toEqual(['first']);
  expect(progress.world).toMatchObject({ contacts: [
    { kind: 'actor', playerId: 'carrier', continuing: true }, { kind: 'surface', surfaceId: battedWorldBaseSurfaceId('first') },
  ] });
  expect(progress.acquisition).toEqual(deriveBattedWorldFieldAcquisition(input));
  expect(progress.cursor).toBeNull();
  expect(progress.dissipationMoment === null).toBe(seconds < plan.secureElapsedSeconds);
});

it.each([0.0625004, 0.062501])('interrupts inside or at the inclusive recorded fence at %s', (seconds) => {
  const input = acquisitionInput({ ...fixture(0, 0.0625 / 0.0625001), geometry: geometry(1.375 + seconds) }), plan = prepare(input);
  const pending = advance({ plan, previous: null, throughElapsedSeconds: plan.secureElapsedSeconds });
  expect(pending.kind).toBe('fence_pending');
  const progress = advance({ plan, previous: pending, throughElapsedSeconds: 1 });
  expect(progress.kind).toBe('interrupted'); if (progress.kind !== 'interrupted') throw new Error('interrupted fixture');
  expect(progress.acquisition.reason).toBe('same_tick_competition');
  expect(progress.transport.remainingEnergyJ).toBe(0); expect(progress.cursor).toBeNull();
  expect(progress.acquisition).toEqual(deriveBattedWorldFieldAcquisition(input));
});

it('preserves simultaneous bag, wall, actor, and continuing glove companions', () => {
  const f = fixture(), seconds = 0.03125;
  const wall = { surfaceId: 'wall', start: { x: 1.125 + seconds, z: -1 }, end: { x: 1.125 + seconds, z: 1 }, minimumHeight: 0, maximumHeight: 2 };
  const response = { ...f.response, world: { ...f.response.world, surfaces: [wall], actors: f.response.world.actors.map((a) =>
    a.playerId === 'receiver' ? { ...a, primitive: { ...a.primitive, startCenter: v(1.25 + seconds, 0.5, 0) } } : a) },
    surfaces: [{ surfaceId: 'wall', material }] };
  const input = acquisitionInput({ ...f, response, geometry: geometry(1.375 + seconds) }), plan = prepare(input);
  const progress = advance({ plan, previous: null, throughElapsedSeconds: 1 });
  expect(progress.kind).toBe('interrupted');
  expect(progress.world).toMatchObject({ contacts: [{ kind: 'actor', playerId: 'carrier', continuing: true },
    { kind: 'actor', playerId: 'receiver' }, { kind: 'surface', surfaceId: battedWorldBaseSurfaceId('first') }, { kind: 'surface', surfaceId: 'wall' }] });
  expect(progress.baseContacts).toHaveLength(1);
});

it.each([0, 0.0000001])('allows exactly one meaningful zero-load initial zero-duration transition at %s', (elapsed) => {
  const input = withContactAt(acquisitionInput(), elapsed, true), plan = prepare(input);
  expect(plan.initialEnergyJ).toBe(0); expect(plan.secureElapsedSeconds).toBe(elapsed);
  const initial = advance({ plan, previous: null, throughElapsedSeconds: elapsed });
  expect(initial.kind).toBe(elapsed === 0 ? 'secured' : 'fence_pending');
  expect(initial.dissipationMoment?.elapsedSeconds).toBe(elapsed);
  expect(() => advance({ plan, previous: initial, throughElapsedSeconds: elapsed })).toThrow();
  if (elapsed !== 0) expect(advance({ plan, previous: initial, throughElapsedSeconds: plan.fenceElapsedSeconds }).kind).toBe('secured');
});

it('retains a large original integer clock without adding rounded durations to an adopted contact tick', () => {
  const input = withContactAt(acquisitionInput(fixture(2 ** 52, 0.0625 / 0.0625001)), 0.0000001), plan = prepare(input);
  expect(plan.candidateSecureTick).toBe(2 ** 52 + 62_501);
  expect(plan.archivedCandidateSecureTick).toBe(2 ** 52 + 62_502);
  const progress = advance({ plan, previous: null, throughElapsedSeconds: 1 });
  expect(progress.kind).toBe('secured');
  expect(progress.acquisition).toEqual(deriveBattedWorldFieldAcquisition(input));
});


it('is invariant under uneven original-curve checkpoints with nonbinary acceleration and rotational energy', () => {
  const f = fixture(0, 0.73, 2), parameters = f.response.world.parameters;
  const contact = { tick: 0, ballCenter: v(1, 2, 0), point: v(1, 2, 0), batPoint: v(1, 2, 0), normal: v(1, 0, 0),
    segmentT: 0.5, exitVelocity: v(2, 0, 0), exitSpin: v(0, 0, 4) };
  const response = { ...f.response, world: { ...f.response.world,
    flight: createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 5_000_000 }) } };
  const input = acquisitionInput({ ...f, response, commands: f.commands.map((command) => command.playerId === 'carrier'
    ? { ...command, acceleration: v(0.13, 0.17, 0.19) } : command) }), plan = prepare(input);
  expect(plan.initialEnergyJ).toBe(0.06875);
  expect(plan.initialConstraintMoment.ball.spin).toEqual(v(0, 0, 0));
  let previous: BattedWorldScheduledFieldAcquisitionAdvance | null = null;
  const fractions = [0.00001, 0.003, 0.017, 0.04, 0.111, 0.231, 0.343, 0.555, 0.721, 0.891, 0.993, 1];
  for (const fraction of fractions) {
    const throughElapsedSeconds = plan.fenceElapsedSeconds * fraction;
    const once = advance({ plan, previous: null, throughElapsedSeconds });
    const split = advance({ plan, previous, throughElapsedSeconds });
    const { startMoment: _onceStart, checkpointElapsedSeconds: _onceCheckpoints, ...expected } = once;
    const { startMoment: _splitStart, checkpointElapsedSeconds: _splitCheckpoints, ...actual } = split;
    expect(actual).toEqual(expected); previous = split;
  }
  expect(previous?.kind).toBe('secured');
  expect(previous?.acquisition).toEqual(deriveBattedWorldFieldAcquisition(input));
});

it('rejects forged candidate, incomplete profiles, mismatched geometry, and invalid inherited actor coverage', () => {
  const input = acquisitionInput(), plan = prepare(input), world = input.field.motion.world;
  expect(() => prepare({ ...input, result: 'secured' } as typeof input)).toThrow();
  expect(() => prepare({ ...input, response: { ...input.response, actors: input.response.actors.slice(1) } })).toThrow();
  expect(() => prepare({ ...input, geometry: { ...input.geometry, bases: { ...input.geometry.bases,
    first: { ...input.geometry.bases.first, topY: 2 } } } })).toThrow();
  expect(() => prepare({ ...input, field: { ...input.field, motion: { ...input.field.motion,
    response: { ...input.field.motion.response, retention: { ...plan.retention, diagnostics: { ...plan.retention.diagnostics, retentionLoadJ: 0 } } } as never } } })).toThrow();
  if (world.kind !== 'boundary') throw new Error('boundary fixture');
  expect(() => prepare({ ...input, field: { ...input.field, motion: { ...input.field.motion,
    world: { ...world, contacts: [...world.contacts, world.contacts[0]] } } } })).toThrow();
  const actor = input.field.motion.actors[1];
  const mutations = [
    { ...actor, playerId: 'unknown' },
    input.field.motion.actors[0],
    { ...actor, startElapsedSeconds: 0.01 },
    { ...actor, startElapsedSeconds: -1 },
    { ...actor, primitive: { ...actor.primitive, startTick: 1 } },
    { ...actor, primitive: { ...actor.primitive, endTick: 62_499 } },
    { ...actor, primitive: { ...actor.primitive, ticksPerSecond: 1 } },
    { ...actor, primitive: { ...actor.primitive, acceleration: v(Infinity, 0, 0) } },
  ];
  for (const changed of mutations) expect(() => prepare({ ...input, field: { ...input.field, motion: { ...input.field.motion,
    actors: [input.field.motion.actors[0], changed] } } })).toThrow();
});

it('rejects all independently forged plan caches and progress evidence without trusting the supplied prior', () => {
  const plan = prepare(acquisitionInput()), previous = advance({ plan, previous: null, throughElapsedSeconds: 0.01 });
  for (const key of ['initialEnergyJ', 'captureDissipationPowerW', 'secureElapsedSeconds', 'candidateSecureTick',
    'archivedCandidateSecureTick', 'fenceElapsedSeconds', 'coverageThroughTick'] as const) {
    expect(() => advance({ plan: { ...plan, [key]: plan[key] + 1 }, previous, throughElapsedSeconds: 0.02 })).toThrow();
  }
  const changes = [
    { ...previous, planIdentity: 'forged' },
    { ...previous, checkpointElapsedSeconds: [0.02] },
    { ...previous, checkpointElapsedSeconds: [] },
    { ...previous, transport: { ...previous.transport, remainingEnergyJ: 0 } },
    { ...previous, dissipationMoment: previous.world.moment },
    { ...previous, baseContacts: [{ kind: 'base', baseId: 'first' }] },
    { ...previous, kind: 'secured' },
    { ...previous, completion: true },
    { ...previous, world: { ...previous.world, moment: { ...previous.world.moment,
      ball: { ...previous.world.moment.ball, velocity: v(2, 0, 0) } } } },
  ];
  for (const forged of changes) expect(() => validateProgress(plan, forged as BattedWorldScheduledFieldAcquisitionAdvance)).toThrow();
  for (const throughElapsedSeconds of [0, 0.01, -1, Infinity, NaN, 5.0000001]) {
    expect(() => advance({ plan, previous, throughElapsedSeconds })).toThrow();
  }
  expect(() => advance({ plan, previous: null, throughElapsedSeconds: 0 })).toThrow();
  const secured = advance({ plan, previous, throughElapsedSeconds: 1 });
  expect(() => advance({ plan, previous: secured, throughElapsedSeconds: 2 })).toThrow(/terminal/);
  expect(() => advance({ plan, previous, throughElapsedSeconds: 0.02, policy: 'override' } as never)).toThrow();
});

it('rejects nonfinite derived actor state at the current contact without evaluating future collisions', () => {
  const input = withContactAt(acquisitionInput(), 2), actors = input.field.motion.actors;
  const receiver = { ...actors[1], primitive: { ...actors[1].primitive, startVelocity: v(Number.MAX_VALUE, 0, 0) } };
  const query = vi.spyOn(continuation, 'deriveAcceleratedBallWorldFieldMotion');
  try {
    expect(() => prepare({ ...input, field: { ...input.field, motion: { ...input.field.motion, actors: [actors[0], receiver] } } }))
      .toThrow(/overflow|nonfinite|arithmetic/);
    expect(query).not.toHaveBeenCalled();
  } finally { query.mockRestore(); }
});

it('rejects invalid inherited physical parameters at admission rather than serializing an unexecutable plan', () => {
  const input = acquisitionInput();
  for (const patch of [{ gravityY: Infinity }, { groundRestitution: 2 }, { groundFriction: -1 },
    { groundRollingDecelerationMps2: -1 }, { restingVerticalSpeed: -1 }, { integrationStepTicks: 0 }]) {
    expect(() => prepare({ ...input, response: { ...input.response, world: { ...input.response.world,
      parameters: { ...input.response.world.parameters, ...patch } } } })).toThrow();
  }
});

it('checks an exactly representable inclusive fence endpoint and never adopts custody there with a competing contact', () => {
  const input = acquisitionInput({ ...fixture(0, 0.0625 / 0.0624991), geometry: geometry(1.4375) }), plan = prepare(input);
  expect(plan.fenceElapsedSeconds).toBe(0.0625);
  const previous = advance({ plan, previous: null, throughElapsedSeconds: 0.0624995 });
  const progress = advance({ plan, previous, throughElapsedSeconds: 0.0625 });
  expect(progress.kind).toBe('interrupted'); if (progress.kind !== 'interrupted') throw new Error('interrupted fixture');
  expect(progress.world.moment.elapsedSeconds).toBe(plan.fenceElapsedSeconds);
  expect(progress.acquisition.reason).toBe('same_tick_competition');
  expect(progress.acquisition).not.toHaveProperty('secureTick');
  expect(() => advance({ plan, previous: progress, throughElapsedSeconds: 1 })).toThrow(/terminal/);
});

it('retains exact physical completion when effective-integer quantization records a microscopically earlier tick', () => {
  const secure = 0.0625 + 1e-16, plan = prepare(acquisitionInput(fixture(0, 0.0625 / secure)));
  expect(plan.candidateSecureTick).toBe(62_500);
  expect(plan.fenceElapsedSeconds).toBe(secure);
  const earlier = advance({ plan, previous: null, throughElapsedSeconds: 0.0625 });
  expect(earlier.kind).toBe('capturing'); expect(earlier.dissipationMoment).toBeNull();
  expect(earlier.transport.remainingEnergyJ).toBeGreaterThan(0);
  const reached = advance({ plan, previous: earlier, throughElapsedSeconds: secure });
  expect(reached.kind).toBe('secured'); expect(reached.world.moment.elapsedSeconds).toBe(secure);
  const input = plan.input;
  expect(() => prepare({ ...input, field: { ...input.field, motion: { ...input.field.motion,
    actors: input.field.motion.actors.map((actor) => ({ ...actor, primitive: { ...actor.primitive, endTick: 62_500 } })) } } }))
    .toThrow(/coverage/);
});

it('rejects positive-duration precision collapse and safe inputs that overflow only during bounded execution', () => {
  const tiny = withContactAt(acquisitionInput(fixture(0, Number.MAX_VALUE)), 1);
  expect(() => prepare(tiny)).toThrow(/precision/);
  const input = acquisitionInput(fixture(0, 0.02)), actors = input.field.motion.actors;
  const carrier = { ...actors[0], primitive: { ...actors[0].primitive, acceleration: v(Number.MAX_VALUE, 0, 0) } };
  const plan = prepare({ ...input, field: { ...input.field, motion: { ...input.field.motion, actors: [carrier, actors[1]] } } });
  expect(() => advance({ plan, previous: null, throughElapsedSeconds: 2 })).toThrow(/overflow|arithmetic/);
});

it('keeps partial progress on original elapsed energy, including after serialization and a nonintegral adopted contact', () => {
  const input = withContactAt(acquisitionInput(fixture(0, 0.73)), 0.0000001), plan = prepare(input);
  let previous = advance({ plan, previous: null, throughElapsedSeconds: 0.017 });
  for (const throughElapsedSeconds of [0.0211111, 0.05030303, 0.063232323, plan.secureElapsedSeconds, plan.fenceElapsedSeconds]) {
    const once = advance({ plan, previous: null, throughElapsedSeconds });
    previous = advance({ plan: JSON.parse(JSON.stringify(plan)), previous: JSON.parse(JSON.stringify(previous)), throughElapsedSeconds });
    expect(previous.world).toEqual(once.world);
    expect(previous.transport).toEqual(once.transport);
    expect(previous.acquisition).toEqual(once.acquisition);
    expect(previous.dissipationMoment).toEqual(once.dissipationMoment);
  }
  expect(previous.kind).toBe('secured');
});

it.each([
  { height: 1.075, z: 0, acceleration: 0 },
  { height: 1.075, z: 0.325, acceleration: 0 },
  { height: 1.125, z: 0, acceleration: 0 },
  { height: 1.125001, z: 0, acceleration: 0 },
  { height: 1.075, z: 0.325, acceleration: 0.3 },
  { height: 0.5, z: 0, acceleration: 1.7 },
])('preserves serialized atomic bag/corner evidence with $height/$z and acceleration $acceleration', ({ height, z, acceleration }) => {
  const f = fixture(0, 0.03125, height, z);
  const input = acquisitionInput({ ...f, commands: f.commands.map((command) => command.playerId === 'carrier'
    ? { ...command, acceleration: v(acceleration, 0, 0) } : command) }), plan = prepare(input);
  const progress = advance({ plan, previous: null, throughElapsedSeconds: 4 });
  expect(['secured', 'interrupted']).toContain(progress.kind);
  expect(JSON.stringify(progress.acquisition)).toBe(JSON.stringify(deriveBattedWorldFieldAcquisition(input)));
});

it.each([
  { contact: 0.010916304355487228, power: 1.9308136791922152, fence: 0.043287 },
  { contact: 0.0545183741953224, power: 0.9603159536607564, fence: 0.119602 },
])('owns exact contact-free checkpoint and fence despite subtract/add drift at $contact', ({ contact, power, fence }) => {
  const input = withContactAt(acquisitionInput(fixture(0, power, 2)), contact), plan = prepare(input);
  expect(plan.fenceElapsedSeconds).toBe(fence);
  const bound = contact + (fence - contact) * 0.271;
  const partial = advance({ plan, previous: null, throughElapsedSeconds: bound });
  expect(partial.kind).toBe('capturing');
  expect(partial.world.moment.elapsedSeconds).toBe(bound);
  const dissipated = advance({ plan, previous: partial, throughElapsedSeconds: plan.secureElapsedSeconds });
  expect(dissipated.kind).toBe('fence_pending');
  expect(dissipated.world.moment.elapsedSeconds).toBe(plan.secureElapsedSeconds);
  expect(dissipated.dissipationMoment?.elapsedSeconds).toBe(plan.secureElapsedSeconds);
  const once = advance({ plan, previous: null, throughElapsedSeconds: fence });
  const split = advance({ plan, previous: dissipated, throughElapsedSeconds: fence });
  for (const progress of [once, split]) {
    expect(progress.kind).toBe('secured'); if (progress.kind !== 'secured') throw new Error('secured fixture');
    expect(progress.cursor.moment.elapsedSeconds).toBe(fence);
    expect(progress.world.moment.elapsedSeconds).toBe(fence);
    expect(progress.cursor.moment.ball.tick).toBe(plan.candidateSecureTick);
    expect(progress.acquisition).toEqual(deriveBattedWorldFieldAcquisition(input));
  }
  expect(split.world).toEqual(once.world);
});
