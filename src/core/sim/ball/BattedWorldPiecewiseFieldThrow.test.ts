import { expect, it } from 'vitest';
import { fixture, throwInput, v } from './BattedWorldScheduledFieldThrow.test-support';
import { advanceBattedWorldFieldMotionCheckpoint } from './BattedWorldFieldMotion';
import { deriveBattedWorldMotionActorsAtExactCoverage } from './BattedWorldMotion';
const api = await import('./BattedWorldPiecewiseFieldThrow').catch(() => null);
const input = (raw = throwInput()) => {
  const { availableAtTick: _a, throughTick: _t, commands: _c, ...retained } = raw; return retained;
};
it('carrier_and_receiver_changes_keep_transfer_seed_and_ready', () => {
  expect(api, 'piecewise throw API').not.toBeNull();
  const scope = input(), plan = api!.prepareBattedWorldPiecewiseFieldThrow(scope);
  const first = { throughElapsedSeconds: 0.1, actors: { kind: 'retained' as const } };
  const prior = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [first] });
  const actors = deriveBattedWorldMotionActorsAtExactCoverage({ response: scope.response, cursor: prior.field.motion.cursor!,
    actors: prior.activePiece.actors, carrierPlayerId: 'carrier', availableAtTick: 100_000, throughTick: 5_000_000,
    commands: prior.activePiece.actors.map((a) => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.playerId === 'carrier' ? v(2, 0, 0) : v(0, 0, 4) })) });
  const changed = { throughElapsedSeconds: 1, actors: { kind: 'adopted' as const, actors } };
  const final = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [first, changed] });
  expect(final.kind).toBe('released'); if (final.kind !== 'released') throw new Error('released fixture');
  expect(plan.releaseElapsedSeconds).toBe(0.1625); expect(final.transfer).toEqual(plan.transfer); expect(plan.input.seed).toEqual(scope.seed);
  expect(final.launch.origin.x).toBe(1.1 + 0.0625 + 0.0625 ** 2);
  expect(final.launch.intendedTarget).toEqual(v(-10, 0.5, 2 * 0.0625 ** 2));
  expect(final.releaseCursor.moment.elapsedSeconds).toBe(0.1625); expect(final.field.motion.carrierPlayerId).toBeNull();
  expect(() => api!.validateBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [first, changed], progress: final })).not.toThrow();
  expect(() => api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [first, changed, { throughElapsedSeconds: 2, actors: { kind: 'retained' } }] })).toThrow(/terminal/);
});
it('planning_does_not_require_future_actor_coverage', () => {
  expect(api, 'piecewise throw API').not.toBeNull();
  const raw = input(), scope = { ...raw, actors: raw.actors.map((a) => ({ ...a, primitive: { ...a.primitive, endTick: 100_000 } })) };
  const plan = api!.prepareBattedWorldPiecewiseFieldThrow(scope);
  expect(plan.initialCoverageThroughTick).toBe(100_000); expect(plan).not.toHaveProperty('launch');
  const progress = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [{ throughElapsedSeconds: 1, actors: { kind: 'retained' } }] });
  expect(progress.kind).toBe('transfer'); expect(progress.field.motion.world.moment.elapsedSeconds).toBe(0.1);
  expect(progress).not.toHaveProperty('launch'); expect(plan.releaseElapsedSeconds).toBe(0.1625);
});

it('bridges old transfer metadata without adopting its unexecuted raw command tail', async () => {
  expect(api).toHaveProperty('bridgeBattedWorldPiecewiseFieldThrowPlan');
  const legacy = await import('./BattedWorldScheduledFieldThrow');
  const raw = throwInput(), original = legacy.prepareBattedWorldScheduledFieldThrow({ ...raw,
    commands: raw.commands.map((c) => ({ ...c, acceleration: v(2, 0, 0) })) });
  const saved = JSON.stringify(original);
  const plan = api!.bridgeBattedWorldPiecewiseFieldThrowPlan({ plan: original, progress: null });
  const step = { throughElapsedSeconds: raw.cursor.moment.elapsedSeconds, actors: { kind: 'retained' as const } };
  const bridged = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [step] });
  expect(bridged.kind).toBe('transfer'); expect(bridged.activePiece.actors).toEqual(raw.actors);
  expect(bridged.activePiece.actors).not.toEqual(original.actors); expect(plan.transfer).toEqual(original.transfer);
  expect(() => api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [step, step] })).toThrow(/progress/);
  const prior = legacy.advanceBattedWorldScheduledFieldThrow({ plan: original, previous: null, throughElapsedSeconds: 0.1 });
  const continuedPlan = api!.bridgeBattedWorldPiecewiseFieldThrowPlan({ plan: original, progress: prior });
  const continued = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan: continuedPlan, steps: [{ throughElapsedSeconds: 0.1, actors: { kind: 'retained' } }] });
  expect(continued.activePiece.actors).toEqual(original.actors); expect(continued.field.motion.world).toEqual(prior.field.motion.world);
  expect(continued.startCursor).toEqual(prior.field.motion.cursor);
  expect(continued.activePiece.anchorMoment).toEqual(prior.field.motion.world.moment);
  const released = legacy.advanceBattedWorldScheduledFieldThrow({ plan: original, previous: prior, throughElapsedSeconds: 1 });
  expect(() => api!.bridgeBattedWorldPiecewiseFieldThrowPlan({ plan: original, progress: released })).toThrow(/terminal/);
  expect(JSON.stringify(original)).toBe(saved);
});

it('retained_partition_does_not_change_contact_response_cursor_target_or_launch', () => {
  const scope = input(throwInput(fixture(0, 1, 2))), plan = api!.prepareBattedWorldPiecewiseFieldThrow(scope);
  const planBytes = JSON.stringify(plan);
  type Step = Parameters<NonNullable<typeof api>['deriveBattedWorldPiecewiseFieldThrowProgress']>[0]['steps'][number];
  const direct: Step[] = [], split: Step[] = [];
  for (const [start, end, acceleration] of [[0.0625, 0.1, 0], [0.1, 0.13, 0.1], [0.13, 0.1625, 0.3]]) {
    let adoption: Step['actors'] = { kind: 'retained' };
    if (direct.length) {
      const prior = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: direct });
      const actors = deriveBattedWorldMotionActorsAtExactCoverage({ response: scope.response, cursor: prior.field.motion.cursor!,
        actors: prior.activePiece.actors, carrierPlayerId: 'carrier', availableAtTick: 0, throughTick: 5_000_000,
        commands: prior.activePiece.actors.map((a) => ({ playerId: a.playerId, role: a.primitive.role,
          acceleration: a.playerId === 'carrier' ? v(acceleration, 0.1, 0.3) : v(0.3, 0, 0.1) })) });
      adoption = { kind: 'adopted', actors };
    }
    direct.push({ throughElapsedSeconds: end, actors: adoption });
    for (let i = 1; i <= 100; i++) split.push({ throughElapsedSeconds: i === 100 ? end : start + (end - start) * (i / 100) ** 1.37,
      actors: i === 1 ? adoption : { kind: 'retained' } });
    const once = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: direct });
    const many = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: split });
    const { startCursor: _a, ...expected } = once, { startCursor: _b, ...actual } = many;
    expect(actual).toEqual(expected);
  }
  expect(JSON.stringify(plan)).toBe(planBytes);
});

it('rejects readiness, seed and replay-state substitution and a backdated fractional zero-delay release', () => {
  const scope = input(), plan = api!.prepareBattedWorldPiecewiseFieldThrow(scope);
  const steps = [{ throughElapsedSeconds: 0.1, actors: { kind: 'retained' as const } }];
  const progress = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps });
  expect(() => api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan: { ...plan, transfer: { ...plan.transfer, throwReadyTick: 9 } }, steps })).toThrow();
  const other = api!.prepareBattedWorldPiecewiseFieldThrow({ ...scope, seed: { ...scope.seed, streamKey: 'other' } });
  expect(() => api!.validateBattedWorldPiecewiseFieldThrowProgress({ plan: other, steps, progress })).toThrow();
  expect(() => api!.validateBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [{ ...steps[0], throughElapsedSeconds: 0.11 }], progress })).toThrow();
  const zero = input(throwInput(fixture(), 0)), moment = zero.cursor.moment;
  const fractional = { ...zero, cursor: { ...zero.cursor, moment: { ...moment, elapsedSeconds: moment.elapsedSeconds + Number.EPSILON,
    ball: { ...moment.ball, position: { ...moment.ball.position, x: moment.ball.position.x + Number.EPSILON } } } } };
  expect(() => api!.prepareBattedWorldPiecewiseFieldThrow(fractional)).toThrow(/release precedes/);
});

it('removes the glove joint before release and permits its next real free-motion collision', () => {
  const raw = input(throwInput(fixture(), 62_500)), scope = { ...raw, actors: raw.actors.map((a) => a.playerId === 'receiver'
    ? { ...a, primitive: { ...a.primitive, startCenter: v(10, 0.5, 0) } } : a) };
  const plan = api!.prepareBattedWorldPiecewiseFieldThrow(scope);
  const progress = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [{ throughElapsedSeconds: 1, actors: { kind: 'retained' } }] });
  expect(progress.kind).toBe('released'); if (progress.kind !== 'released') throw new Error('release fixture');
  expect(progress.releaseCursor.moment.elapsedSeconds).toBe(0.125);
  expect(progress.releaseCursor.moment.ball.velocity.x).toBe(5);
  expect(progress.field.motion.world.moment.elapsedSeconds).toBe(0.125);
  expect(progress.field.motion.carrierPlayerId).toBeNull();
  const next = advanceBattedWorldFieldMotionCheckpoint({ response: scope.response, geometry: scope.geometry,
    cursor: progress.field.motion.cursor!, actors: progress.activePiece.actors, carrierPlayerId: null, checkpointThroughTick: 200_000 });
  expect(next.motion.world).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact', moment: { elapsedSeconds: 0.125 },
    contacts: [{ kind: 'actor', playerId: 'carrier', role: 'glove', continuing: true }] });
  expect(next.motion.cursor).toBeNull();
});

it.each(['before', 'at'] as const)('physical competing contact %s release interrupts without launch', async (when) => {
  const { geometry } = await import('./BattedWorldScheduledFieldThrow.test-support');
  const raw = input(throwInput(fixture(), 187_500)), at = when === 'before' ? 0.125 : 0.25;
  const plan = api!.prepareBattedWorldPiecewiseFieldThrow({ ...raw, geometry: geometry(1.375 + at) });
  const result = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [{ throughElapsedSeconds: 1, actors: { kind: 'retained' } }] });
  expect(result.kind).toBe('interrupted'); expect(result.field.motion.world.moment.elapsedSeconds).toBeCloseTo(at, 14);
  expect(result).not.toHaveProperty('launch'); expect(result).not.toHaveProperty('releaseCursor');
  expect(result.field.baseContacts).toMatchObject([{ baseId: 'first' }]);
});

it('retains same-time post-release ground and glove evidence with distinct raw release cursor', () => {
  const raw = input(throwInput(fixture(0, 1, 0.125), 62_500));
  const plan = api!.prepareBattedWorldPiecewiseFieldThrow({ ...raw, actors: raw.actors.map((a) => a.playerId === 'receiver'
    ? { ...a, primitive: { ...a.primitive, startCenter: v(-10, 0, 0) } } : a) });
  const result = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [{ throughElapsedSeconds: 1, actors: { kind: 'retained' } }] });
  expect(result.kind).toBe('released'); if (result.kind !== 'released') throw new Error('release fixture');
  expect(result.releaseCursor.moment.ball.velocity.y).toBeLessThan(0);
  expect(result.field.motion.world).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: 0.125 }, contacts: [
    { kind: 'actor', playerId: 'carrier', role: 'glove', continuing: true }, { kind: 'ground' }] });
  expect(result.field.motion.cursor).toBeNull(); expect(result.field.motion.response.kind).toBe('unresolved');
});

it('rejects a shifted origin clock even when the relative elapsed reconstructs the same absolute physical cut', () => {
  const raw = input(), moment = raw.cursor.moment;
  expect(() => api!.prepareBattedWorldPiecewiseFieldThrow({ ...raw, cursor: { ...raw.cursor, moment: {
    ...moment, originTick: 1, elapsedSeconds: 0.062499 } } })).toThrow(/clock|origin/);
});

it('processes original due zero-delay release before any same-cut actor adoption', () => {
  const scope = input(throwInput(fixture(), 0)), plan = api!.prepareBattedWorldPiecewiseFieldThrow(scope), at = scope.cursor.moment.elapsedSeconds;
  const released = api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [{ throughElapsedSeconds: at, actors: { kind: 'retained' } }] });
  expect(released.kind).toBe('released'); expect(released.field.motion.world.moment.elapsedSeconds).toBe(at);
  const actors = deriveBattedWorldMotionActorsAtExactCoverage({ response: scope.response, cursor: scope.cursor, actors: scope.actors,
    carrierPlayerId: scope.carrierPlayerId, availableAtTick: 0, throughTick: 5_000_000,
    commands: scope.actors.map((a) => ({ playerId: a.playerId, role: a.primitive.role, acceleration: v(2, 0, 0) })) });
  expect(() => api!.deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps: [{ throughElapsedSeconds: at, actors: { kind: 'adopted', actors } }] })).toThrow(/due release/);
});
