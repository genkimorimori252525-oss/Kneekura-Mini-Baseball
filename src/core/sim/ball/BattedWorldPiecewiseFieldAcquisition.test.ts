import { expect, it } from 'vitest';
import { acquisitionInput } from './BattedWorldScheduledFieldAcquisition.test-support';
import { fixture, v } from './BattedWorldScheduledFieldThrow.test-support';
import { deriveInitialBattedWorldFieldMotion, deriveBattedWorldFieldMotionCheckpoint } from './BattedWorldFieldMotion';
import { deriveBattedWorldMotionActorsAtExactCoverage } from './BattedWorldMotion';
const api = await import('./BattedWorldPiecewiseFieldAcquisition').catch(() => null);
it('capture_rebase_keeps_original_energy_clock_and_offset', () => {
  expect(api, 'piecewise acquisition API').not.toBeNull();
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(acquisitionInput());
  const first = { throughElapsedSeconds: 0.02, actors: { kind: 'retained' as const } };
  const initial = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first] });
  const actors = deriveBattedWorldMotionActorsAtExactCoverage({ response: plan.input.response, cursor: { moment: initial.world.moment, previousContacts: [] },
    actors: initial.activePiece.actors, carrierPlayerId: 'carrier', availableAtTick: 20_000, throughTick: 5_000_000,
    commands: initial.activePiece.actors.map((a) => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.playerId === 'carrier' ? v(2, 0, 0) : v(0, 0, 0) })) });
  const changed = { throughElapsedSeconds: 0.04, actors: { kind: 'adopted' as const, actors } };
  const progress = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first, changed] });
  expect(progress.kind).toBe('capturing'); expect(progress.transport.remainingEnergyJ).toBeCloseTo(0.0225, 15);
  expect(progress.world.moment.ball.position.x).toBe(1.0404); expect(progress.world.moment.ball.velocity.x).toBe(1.04);
  expect(progress.cursor).toBeNull(); expect(progress.acquisition).toBeNull(); expect(plan.secureElapsedSeconds).toBe(0.0625);
  expect(plan.fenceElapsedSeconds).toBe(0.0625); expect(plan.initialConstraintMoment.ball.position.x).toBe(1);
  expect(plan.initialConstraintMoment.ball.velocity.x).toBe(1); expect(plan.contactMoment.ball.velocity.x).toBe(2);
  expect(plan.contactOffset).toEqual(v(-0.25, 0, 0));
  const final = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first, changed, { throughElapsedSeconds: 0.1, actors: { kind: 'retained' } }] });
  expect(final.kind).toBe('secured'); expect(final.dissipationMoment?.elapsedSeconds).toBe(0.0625);
  expect(final.dissipationMoment?.ball.position.x).toBe(1.02 + 0.0425 + 0.0425 ** 2);
  expect(() => api!.validateBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first, changed], progress })).not.toThrow();
});
it('planning_does_not_require_future_actor_coverage', () => {
  expect(api, 'piecewise acquisition API').not.toBeNull();
  const raw = acquisitionInput(fixture()), input = { ...raw, field: { ...raw.field, motion: { ...raw.field.motion,
    actors: raw.field.motion.actors.map((a) => ({ ...a, primitive: { ...a.primitive, endTick: 20_000 } })) } } };
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(input);
  expect(plan.initialCoverageThroughTick).toBe(20_000); expect(plan.secureElapsedSeconds).toBe(0.0625);
  const progress = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [{ throughElapsedSeconds: 1, actors: { kind: 'retained' } }] });
  expect(progress.kind).toBe('capturing'); expect(progress.world.moment.elapsedSeconds).toBe(0.02);
  expect(progress.activePiece.actors).toEqual(input.field.motion.actors);
  expect(() => api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [
    { throughElapsedSeconds: 1, actors: { kind: 'retained' } }, { throughElapsedSeconds: 2, actors: { kind: 'retained' } }] })).toThrow(/progress|coverage/);
});

it('capture_records_secure_once_before_later_piece', () => {
  expect(api).not.toBeNull();
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(acquisitionInput(fixture(0, 0.0625 / 0.0625001)));
  const first = { throughElapsedSeconds: 1, actors: { kind: 'retained' as const } };
  const secure = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first] });
  expect(secure.kind).toBe('fence_pending'); expect(secure.world.moment.elapsedSeconds).toBe(0.0625001);
  const inside = { throughElapsedSeconds: 0.0625005, actors: { kind: 'retained' as const } };
  const prior = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first, inside] });
  const actors = deriveBattedWorldMotionActorsAtExactCoverage({ response: plan.input.response, cursor: { moment: prior.world.moment, previousContacts: [] },
    actors: prior.activePiece.actors, carrierPlayerId: 'carrier', availableAtTick: 0, throughTick: 5_000_000,
    commands: prior.activePiece.actors.map((a) => ({ playerId: a.playerId, role: a.primitive.role, acceleration: v(2, 0, 0) })) });
  const final = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first, inside,
    { throughElapsedSeconds: 1, actors: { kind: 'adopted', actors } }] });
  expect(final.kind).toBe('secured'); expect(final.dissipationMoment).toEqual(secure.dissipationMoment);
  expect(final.world.moment.elapsedSeconds).toBe(0.062501); expect(final.world.moment.ball.velocity.x).toBeGreaterThan(1);
});

it('bridges validated pending legacy capture without replaying its incoming constraint transition', async () => {
  expect(api).toHaveProperty('bridgeBattedWorldPiecewiseFieldAcquisitionPlan');
  const legacy = await import('./BattedWorldScheduledFieldAcquisition');
  const original = legacy.prepareBattedWorldScheduledFieldAcquisition(acquisitionInput(fixture(0, 0.0625 / 0.0625001)));
  const prior = legacy.advanceBattedWorldScheduledFieldAcquisition({ plan: original, previous: null, throughElapsedSeconds: 0.02 });
  const saved = JSON.stringify({ original, prior });
  const plan = api!.bridgeBattedWorldPiecewiseFieldAcquisitionPlan({ plan: original, progress: prior });
  const step = { throughElapsedSeconds: 0.02, actors: { kind: 'retained' as const } };
  const bridge = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [step] });
  expect(bridge.startMoment).toEqual(prior.world.moment); expect(bridge.world).toEqual(prior.world);
  expect(bridge.activePiece.anchorMoment).toEqual(prior.world.moment);
  expect(bridge.transport).toEqual(prior.transport); expect(plan.contactMoment).toEqual(original.contactMoment);
  expect(() => api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [step, step] })).toThrow(/progress/);
  const secure = legacy.advanceBattedWorldScheduledFieldAcquisition({ plan: original, previous: prior, throughElapsedSeconds: 1 });
  expect(() => api!.bridgeBattedWorldPiecewiseFieldAcquisitionPlan({ plan: original, progress: secure })).toThrow(/terminal/);
  expect(JSON.stringify({ original, prior })).toBe(saved);
  const uninitialized = api!.bridgeBattedWorldPiecewiseFieldAcquisitionPlan({ plan: original, progress: null });
  const initialized = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan: uninitialized, steps: [{ throughElapsedSeconds: 0, actors: { kind: 'retained' } }] });
  expect(initialized.startMoment).toEqual(original.contactMoment); expect(initialized.world.moment).toEqual(original.initialConstraintMoment);
});

it('constraint_pair_does_not_hide_competing_same_player_body_wall_base_or_peer', async () => {
  const { geometry, material } = await import('./BattedWorldScheduledFieldThrow.test-support');
  const f = fixture(), seconds = 0.03125;
  const body = { playerId: 'carrier', primitive: { ...f.response.world.actors[0].primitive, role: 'body' as const,
    startCenter: v(1.25 + seconds, 0.5, 0), startVelocity: v(0, 0, 0) } };
  const wall = { surfaceId: 'wall', start: { x: 1.125 + seconds, z: -1 }, end: { x: 1.125 + seconds, z: 1 }, minimumHeight: 0, maximumHeight: 2 };
  const response = { ...f.response, world: { ...f.response.world, surfaces: [wall], actors: [...f.response.world.actors.map((a) =>
    a.playerId === 'receiver' ? { ...a, primitive: { ...a.primitive, startCenter: body.primitive.startCenter } } : a), body] },
    actors: [...f.response.actors, { playerId: 'carrier', profile: { role: 'body' as const, material } }], surfaces: [{ surfaceId: 'wall', material }] };
  const fieldGeometry = geometry(1.375 + seconds);
  const scope = { response, geometry: fieldGeometry, field: deriveInitialBattedWorldFieldMotion({ ...f, response, geometry: fieldGeometry,
    commands: [...f.commands, { playerId: 'carrier', role: 'body', acceleration: v(0, 0, 0) }] }) };
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(scope);
  const final = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [{ throughElapsedSeconds: 1, actors: { kind: 'retained' } }] });
  expect(final.kind).toBe('interrupted'); expect(final.world.moment.elapsedSeconds).toBe(seconds);
  expect(final.activePiece.actors).toHaveLength(3); expect(final.world).toMatchObject({ contacts: [
    { kind: 'actor', playerId: 'carrier', role: 'body' }, { kind: 'actor', playerId: 'carrier', role: 'glove', continuing: true },
    { kind: 'actor', playerId: 'receiver', role: 'glove' }, { kind: 'surface' }, { kind: 'surface', surfaceId: 'wall' }] });
  expect(final.baseContacts).toHaveLength(1);
});

it('retained_partition_does_not_change_capture_across_nonbinary_real_pieces', () => {
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(acquisitionInput(fixture(0, 1, 2)));
  const planBytes = JSON.stringify(plan);
  type Step = Parameters<NonNullable<typeof api>['deriveBattedWorldPiecewiseFieldAcquisitionProgress']>[0]['steps'][number];
  const direct: Step[] = [], split: Step[] = [];
  for (const [start, end, acceleration] of [[0, 0.02, 0], [0.02, 0.04, 0.1], [0.04, 0.0625, 0.3]]) {
    let adoption: Step['actors'] = { kind: 'retained' };
    if (direct.length) {
      const previous = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: direct });
      const actors = deriveBattedWorldMotionActorsAtExactCoverage({ response: plan.input.response,
        cursor: { moment: previous.world.moment, previousContacts: [] }, actors: previous.activePiece.actors, carrierPlayerId: 'carrier',
        availableAtTick: 0, throughTick: 5_000_000, commands: previous.activePiece.actors.map((a) => ({ playerId: a.playerId,
          role: a.primitive.role, acceleration: a.playerId === 'carrier' ? v(acceleration, 0.1, 0.3) : v(0.3, 0, 0.1) })) });
      adoption = { kind: 'adopted', actors };
    }
    direct.push({ throughElapsedSeconds: end, actors: adoption });
    for (let i = 1; i <= 100; i++) split.push({ throughElapsedSeconds: i === 100 ? end : start + (end - start) * (i / 100) ** 1.37,
      actors: i === 1 ? adoption : { kind: 'retained' } });
    const once = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: direct });
    const many = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: split });
    const { startMoment: _a, ...expected } = once, { startMoment: _b, ...actual } = many;
    expect(actual).toEqual(expected);
  }
  expect(JSON.stringify(plan)).toBe(planBytes);
});

it('initializes positive energy once at zero time without custody and rejects exact nonprogress', () => {
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(acquisitionInput());
  const step = { throughElapsedSeconds: 0, actors: { kind: 'retained' as const } };
  const progress = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [step] });
  expect(progress.kind).toBe('capturing'); expect(progress.world.moment).toEqual(plan.initialConstraintMoment);
  expect(progress.startMoment).toEqual(plan.contactMoment); expect(progress.transport.remainingEnergyJ).toBe(0.0625);
  expect(progress.cursor).toBeNull(); expect(progress.acquisition).toBeNull();
  expect(() => api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [step, step] })).toThrow(/progress/);
});

it.each([NaN, Infinity, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER, -1])('rejects nonfinite, unsafe or backward checkpoint %s', (throughElapsedSeconds) => {
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(acquisitionInput());
  expect(() => api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [{ throughElapsedSeconds, actors: { kind: 'retained' } }] })).toThrow();
});

it('rejects forged original energy, offset, secure clock, coverage and replayed progress', () => {
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(acquisitionInput());
  const steps = [{ throughElapsedSeconds: 0.02, actors: { kind: 'retained' as const } }];
  const progress = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps });
  for (const patch of [{ initialEnergyJ: 0 }, { captureDissipationPowerW: 2 }, { contactOffset: v(0, 0, 0) },
    { secureElapsedSeconds: 0.04 }, { initialCoverageThroughTick: 9_000_000 }]) {
    expect(() => api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan: { ...plan, ...patch }, steps })).toThrow();
  }
  for (const forged of [ { ...progress, transport: { ...progress.transport, remainingEnergyJ: 0 } },
    { ...progress, world: { ...progress.world, moment: { ...progress.world.moment, elapsedSeconds: 0.01 } } },
    { ...progress, activePiece: { ...progress.activePiece, constraint: { playerId: 'receiver', contactOffset: v(-0.25, 0, 0) } } } ]) {
    expect(() => api!.validateBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps, progress: forged })).toThrow();
  }
  expect(() => api!.validateBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [{ ...steps[0], throughElapsedSeconds: 0.03 }], progress })).toThrow();
});

it('rejects discontinuous adopted position, velocity, identity, radius, clock, coverage and acceleration overflow', () => {
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(acquisitionInput());
  const first = { throughElapsedSeconds: 0.02, actors: { kind: 'retained' as const } };
  const prior = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first] });
  const actors = deriveBattedWorldMotionActorsAtExactCoverage({ response: plan.input.response,
    cursor: { moment: prior.world.moment, previousContacts: [] }, actors: prior.activePiece.actors, carrierPlayerId: 'carrier',
    availableAtTick: 0, throughTick: 5_000_000, commands: prior.activePiece.actors.map((a) => ({ playerId: a.playerId, role: a.primitive.role, acceleration: v(0.1, 0.3, 0.1) })) });
  for (const patch of [{ radius: 0.25 }, { role: 'body' as const }, { startTick: 1 }, { ticksPerSecond: 1 }, { endTick: 19_999 },
    { startCenter: v(99, 0, 0) }, { startVelocity: v(99, 0, 0) }, { acceleration: v(Infinity, 0, 0) }, { acceleration: v(Number.MAX_VALUE, 0, 0) }]) {
    const forged = actors.map((a, i) => i ? a : { ...a, primitive: { ...a.primitive, ...patch } });
    expect(() => api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first,
      { throughElapsedSeconds: 0.03, actors: { kind: 'adopted', actors: forged } }] })).toThrow();
  }
  expect(() => api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first,
    { throughElapsedSeconds: 0.03, actors: { kind: 'adopted', actors: [...actors.slice(1), actors[1]] } }] })).toThrow();
});

it('records zero remaining energy at original exact secure even when division multiplication rounds below E0', () => {
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(acquisitionInput(fixture(0, 0.09, 2)));
  expect(plan.initialEnergyJ - plan.captureDissipationPowerW * plan.secureElapsedSeconds).toBeGreaterThan(0);
  const progress = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [{ throughElapsedSeconds: 1, actors: { kind: 'retained' } }] });
  expect(progress.kind).toBe('fence_pending'); expect(progress.world.moment.elapsedSeconds).toBe(plan.secureElapsedSeconds);
  expect(progress.transport.remainingEnergyJ).toBe(0);
});

it('confirms zero-load capture only through its original fence and preserves fractional progress within one tick', async () => {
  const { withContactAt } = await import('./BattedWorldScheduledFieldAcquisition.test-support');
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(withContactAt(acquisitionInput(), 0.0000001, true));
  const first = { throughElapsedSeconds: 1, actors: { kind: 'retained' as const } };
  const pending = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first] });
  expect(pending.kind).toBe('fence_pending'); expect(pending.world.moment.elapsedSeconds).toBe(0.0000001);
  expect(pending.cursor).toBeNull(); expect(pending.dissipationMoment).toEqual(plan.initialConstraintMoment);
  const inside = { throughElapsedSeconds: 0.0000005, actors: { kind: 'retained' as const } };
  const middle = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first, inside] });
  expect(middle.kind).toBe('fence_pending'); expect(middle.world.moment.ball.tick).toBe(pending.world.moment.ball.tick);
  const final = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first, inside, { throughElapsedSeconds: 1, actors: { kind: 'retained' } }] });
  expect(final.kind).toBe('secured'); expect(final.world.moment.elapsedSeconds).toBe(0.000001);
  expect(final.dissipationMoment).toEqual(pending.dissipationMoment);
});

it('keeps the validated glove joint in a nonbinary ground boundary contact set without snapping its geometry', () => {
  const raw = fixture(0, 0.01, 0.635), f = { ...raw, response: { ...raw.response, world: { ...raw.response.world,
    actors: raw.response.world.actors.map((a) => a.playerId === 'carrier' ? { ...a, primitive: { ...a.primitive, startVelocity: v(1, -1, 0) } } : a) } } };
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(acquisitionInput(f));
  const first = { throughElapsedSeconds: 0, actors: { kind: 'retained' as const } };
  const initialized = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first] });
  const actors = deriveBattedWorldMotionActorsAtExactCoverage({ response: plan.input.response,
    cursor: { moment: initialized.world.moment, previousContacts: [] }, actors: initialized.activePiece.actors,
    carrierPlayerId: 'carrier', availableAtTick: 0, throughTick: 5_000_000,
    commands: initialized.activePiece.actors.map((a) => ({ playerId: a.playerId, role: a.primitive.role,
      acceleration: a.playerId === 'carrier' ? v(2, 0, 0) : v(0, 0, 0) })) });
  const result = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first,
    { throughElapsedSeconds: 0.6, actors: { kind: 'adopted', actors } }] });
  expect(result.kind).toBe('interrupted'); expect(result.world.moment.elapsedSeconds).toBe(0.51);
  expect(result.world.moment.ball.position.x).toBe(1.7701);
  expect(result.world).toMatchObject({ kind: 'boundary', contacts: [
    { kind: 'actor', playerId: 'carrier', role: 'glove', continuing: true, center: { x: 2.0201000000000002 } }, { kind: 'ground' }] });
});

it('retained checkpoints preserve the same nonaxial peer contact bytes', () => {
  const raw = fixture(0, 0.01, 2), f = { ...raw, response: { ...raw.response, world: { ...raw.response.world,
    actors: raw.response.world.actors.map((a) => a.playerId === 'receiver' ? { ...a, primitive: { ...a.primitive, startCenter: v(1.4, 2.05, 0) } } : a) } } };
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition(acquisitionInput(f));
  const first = { throughElapsedSeconds: 0, actors: { kind: 'retained' as const } };
  const prior = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first] });
  const actors = deriveBattedWorldMotionActorsAtExactCoverage({ response: plan.input.response, actors: prior.activePiece.actors,
    cursor: { moment: prior.world.moment, previousContacts: [] }, carrierPlayerId: 'carrier', availableAtTick: 0, throughTick: 5_000_000,
    commands: prior.activePiece.actors.map((a) => ({ playerId: a.playerId, role: a.primitive.role,
      acceleration: a.playerId === 'carrier' ? v(0.1, 0.3, 0.1) : v(0.3, 0, 0.1) })) });
  const once = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first, { throughElapsedSeconds: 1, actors: { kind: 'adopted', actors } }] });
  const split = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [first,
    { throughElapsedSeconds: 0.1, actors: { kind: 'adopted', actors } }, { throughElapsedSeconds: 0.8, actors: { kind: 'retained' } }] });
  expect(once.kind).toBe('interrupted'); expect(split.world).toEqual(once.world);
  expect(split.acquisition).toEqual(once.acquisition); expect(split.transport).toEqual(once.transport);
});

it('does not query an overflowing unexecuted tail of otherwise valid current coverage', () => {
  const raw = fixture(0, 0.01, 2), f = { ...raw, response: { ...raw.response, world: { ...raw.response.world,
    actors: raw.response.world.actors.map((a) => a.playerId === 'receiver' ? { ...a, primitive: { ...a.primitive,
      startCenter: v(100, 2, 0), startVelocity: v(2e153, 0, 0) } } : a) } },
    commands: raw.commands.map((c) => c.playerId === 'receiver' ? { ...c, acceleration: v(2e153, 0, 0) } : c) };
  const initial = f.response.world.flight.initialBall;
  const { throughTick: _coverage, ...checkpointInput } = f;
  const field = deriveBattedWorldFieldMotionCheckpoint({ ...checkpointInput, actors: f.response.world.actors,
    cursor: { moment: { originTick: 0, elapsedSeconds: 0, ball: initial }, previousContacts: [] }, carrierPlayerId: null,
    coverageThroughTick: 5_000_000, checkpointThroughTick: 1_000 });
  const plan = api!.prepareBattedWorldPiecewiseFieldAcquisition({ response: f.response, geometry: f.geometry, field });
  const result = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [{ throughElapsedSeconds: 0.001, actors: { kind: 'retained' } }] });
  expect(result.kind).toBe('capturing'); expect(result.world.moment.elapsedSeconds).toBe(0.001);
});

it('bridges before a legacy nonaxial contact without reinterpreting the original prefix', async () => {
  const legacy = await import('./BattedWorldScheduledFieldAcquisition');
  const raw = fixture(0, 0.1, 2), f = { ...raw, response: { ...raw.response, world: { ...raw.response.world,
    actors: raw.response.world.actors.map((a) => a.playerId === 'receiver' ? { ...a, primitive: { ...a.primitive, startCenter: v(1.4, 2.05, 0) } } : a) } },
    commands: raw.commands.map((c) => ({ ...c, acceleration: c.playerId === 'carrier' ? v(0.1, 0.3, 0.1) : v(0.3, 0, 0.1) })) };
  const original = legacy.prepareBattedWorldScheduledFieldAcquisition(acquisitionInput(f));
  const old = legacy.advanceBattedWorldScheduledFieldAcquisition({ plan: original, previous: null, throughElapsedSeconds: 0.15 });
  expect(old.kind).toBe('capturing');
  const bytes = JSON.stringify(old), plan = api!.bridgeBattedWorldPiecewiseFieldAcquisitionPlan({ plan: original, progress: old });
  const bridge = { throughElapsedSeconds: 0.15, actors: { kind: 'retained' as const } };
  const current = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [bridge] });
  expect(current.world).toEqual(old.world); expect(current.activePiece.anchorMoment).toEqual(old.world.moment);
  expect(current.activePiece.actors).toEqual(original.input.field.motion.actors);
  const next = api!.deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [bridge, { throughElapsedSeconds: 0.8, actors: { kind: 'retained' } }] });
  expect(next.kind).toBe('interrupted'); expect(next.startMoment).toEqual(old.world.moment);
  expect(JSON.stringify(old)).toBe(bytes); expect(plan.secureElapsedSeconds).toBe(original.secureElapsedSeconds);
});
