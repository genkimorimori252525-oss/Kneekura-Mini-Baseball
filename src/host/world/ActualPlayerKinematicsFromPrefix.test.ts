import { expect, it } from 'vitest';
import { advanceBattedWorldScheduledFieldThrow } from '../../core/sim/ball/BattedWorldScheduledFieldThrow';
import { sampleBatterSwingState } from '../../core/sim/contact/BatBallContact';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { battedWorldFieldThrowFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { actualPlayerKinematicsEvidenceFromSqlite, openSqliteActualPlayerKinematicsReader } from './SqliteActualPlayerKinematicsReader';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution, type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

const v = (x: number, y = x / 2, z = -x) => ({ x, y, z });
const richFixture = () => {
  const x = battedWorldFieldFixture(undefined, true, false, undefined, { world(world) {
    const model = world.models.get(world.model.sourceId)!;
    world.models.set(model.sourceId, { ...model, actors: model.actors.map((a) => ({ ...a, bodyOriginHeightMeters: 0.4,
      primitives: a.primitives.map((p, i) => ({ ...p, offset: v(1 + i / 10) })) })) });
    const source = world.sources.get(world.source.sourceId)!;
    world.sources.set(source.sourceId, { ...source, commands: source.commands.map((c) => ({ ...c, bodyAcceleration: v(0.3, 0),
      primitiveMotions: c.primitiveMotions.map((p, i) => ({ ...p, offsetVelocity: v(0.2 + i / 100), offsetAcceleration: v(0.1 + i / 100) })) })) });
  } });
  // A short actual interval keeps this fixture independent of incidental ball contacts.
  const source = { ...x.source, throughTick: x.source.availableAtTick + 1000 };
  x.sources.set(source.sourceId, source);
  return { ...x, baseField: x.fields.accept(source.sourceId) };
};
const cut = (x: { baseField: ReturnType<typeof richFixture>['baseField'] }, playerId = 'p2', executionSourceId: string | null = null) => ({
  physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
  playerId, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId, mode: 'original' as const,
});

it('reconstructs the original defender root and all nonzero relative states without equating body center and root', () => {
  const x = richFixture();
  try {
    const before = x.f.db.prepare('SELECT * FROM batted_world_field_actions').all();
    const result = actualPlayerKinematicsEvidenceFromSqlite(x.f.db).read(cut(x));
    const world = x.baseField.response.touch.worldContact, initial = world.flight.physicalPitch.frame.world;
    const defender = initial.defenders.find((d) => d.playerId === 'p2')!;
    const tps = world.flight.source.execution.ballFlightParameters.ticksPerSecond;
    const dt = (world.flight.flight.contact.tick - initial.tick) / tps, elapsed = result.at.elapsedSeconds;
    expect(result.root.position.x).toBeCloseTo(defender.position.x + defender.velocity.x * (dt + elapsed) + 0.5 * 0.3 * (dt + elapsed) ** 2, 12);
    expect(result.root.position.y).toBe(0.4);
    expect(result.root.acceleration).toEqual(v(0.3, 0));
    for (const [i, role] of result.roles.entries()) {
      const original = world.model.actors.find((a) => a.playerId === 'p2')!.primitives.find((p) => p.role === role.role)!;
      const command = world.source.commands.find((a) => a.playerId === 'p2')!.primitiveMotions.find((p) => p.role === role.role)!;
      expect(role.offset.x).toBeCloseTo(original.offset.x + command.offsetVelocity.x * elapsed + 0.5 * command.offsetAcceleration.x * elapsed ** 2, 12);
      expect(role.relativeVelocity.x).toBeCloseTo(command.offsetVelocity.x + command.offsetAcceleration.x * elapsed, 12);
      expect(role.relativeAcceleration).toEqual(command.offsetAcceleration);
      expect(role.radiusMeters).toBe(original.radius);
      expect(i).toBeLessThan(5);
    }
    expect(result.roles).toHaveLength(5);
    expect(result.adoptions.map((a) => a.kind)).toEqual(['contact', 'field']);
    expect(result.activeCommand.acceptedThroughTick).toBe(x.baseField.source.throughTick);
    expect(result.activeCommand.adoptedAt.elapsedSeconds).toBe(0);
    expect(result).not.toHaveProperty('actors');
    expect(result).not.toHaveProperty('ball');
    expect(result.playerId).toBe('p2');
    expect(Object.isFrozen(result.roles[0].offset)).toBe(true);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_actions').all()).toEqual(before);
    const reader = x.f.track(openSqliteActualPlayerKinematicsReader(x.f.path));
    expect(reader.read(cut(x))).toEqual(result);
  } finally { x.f.close(); }
});

it('uses actual swing grip minus model offset for the batter and preserves vertical motion', () => {
  const x = richFixture();
  try {
    const world = x.baseField.response.touch.worldContact, pitch = world.flight.physicalPitch;
    const action = pitch.source.request.batter.action;
    if (action.kind !== 'swing') throw new Error('fixture swing');
    const batterId = pitch.frame.batterActor!.binding.playerId;
    const swing = sampleBatterSwingState(action.swing.stateAtStart, world.flight.flight.contact.tick - action.swing.startTick, action.swing.ticksPerSecond);
    const result = actualPlayerKinematicsEvidenceFromSqlite(x.f.db).read(cut(x, batterId));
    for (const axis of ['x', 'y', 'z'] as const) {
      const t = result.at.elapsedSeconds, a = result.root.acceleration[axis];
      expect(result.root.position[axis]).toBeCloseTo(swing.pose.grip[axis] - world.model.batterGripOffset[axis] + swing.linearVelocity[axis] * t + 0.5 * a * t * t, 12);
      expect(result.root.velocity[axis]).toBeCloseTo(swing.linearVelocity[axis] + a * t, 12);
    }
    expect(result.root.position.y).not.toBe(world.model.actors.find((a) => a.playerId === batterId)!.bodyOriginHeightMeters);
    expect(result.origin.kind).toBe('batter_swing_grip');
  } finally { x.f.close(); }
});

it('rejects a canonical primitive that is continuous but no longer agrees with its unflattened owned command', () => {
  const x = richFixture();
  try {
    const bad = structuredClone(x.baseField);
    const actor = bad.field.motion.actors.find((a) => a.playerId === 'p2' && a.primitive.role === 'body')!;
    (actor.primitive.acceleration as { x: number }).x += 0.001;
    expect(() => actualPlayerKinematicsFromPrefix('p2', { baseField: bad, fields: [bad], executions: [] })).toThrow(/canonical/);
  } finally { x.f.close(); }
});

it('keeps a throw plan metadata-only and adopts its commands at the first fractional advance', () => {
  const x = battedWorldFieldThrowFixture(undefined, 1000);
  try {
    if (x.source.action.kind !== 'throw') throw new Error('fixture throw');
    const own = actualPlayerKinematicsEvidenceFromSqlite(x.f.db), request = cut(x);
    const old = own.read({ ...request, executionSourceId: x.acquired.source.sourceId });
    const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'kinematics-plan', action: { ...x.source.action, kind: 'throw_plan',
      commands: x.source.action.commands.map((c) => c.playerId !== 'p2' ? c : { ...c, bodyAcceleration: v(3, 0),
        primitiveMotions: c.primitiveMotions.map((p) => ({ ...p, offsetAcceleration: v(0.25) })) }) } };
    x.sources.set(source.sourceId, source); const planned = x.executions.accept(source.sourceId);
    if (planned.execution.kind !== 'throw_plan') throw new Error('fixture plan');
    const admitted = own.read({ ...request, executionSourceId: source.sourceId });
    expect(admitted.root).toEqual(old.root); expect(admitted.roles).toEqual(old.roles); expect(admitted.adoptions).toEqual(old.adoptions);
    const start = planned.execution.plan.input.cursor.moment.elapsedSeconds;
    const advance: AcceptedBattedWorldFieldExecution = { ...source, sourceId: 'kinematics-advance', previousExecutionSourceId: source.sourceId,
      action: { kind: 'throw_advance', planSourceId: source.sourceId, throughElapsedSeconds: start + 0.0000001 } };
    x.sources.set(advance.sourceId, advance); x.executions.accept(advance.sourceId);
    const executed = own.read({ ...request, executionSourceId: advance.sourceId });
    expect(executed.root.acceleration).toEqual(v(3, 0));
    expect(executed.roles.every((p) => JSON.stringify(p.relativeAcceleration) === JSON.stringify(v(0.25)))).toBe(true);
    expect(executed.activeCommand).toMatchObject({ sourceId: source.sourceId, adoptionSourceId: advance.sourceId, adoptedAt: { elapsedSeconds: start } });
    expect(executed.at.elapsedSeconds).toBe(start + 0.0000001);
    expect(executed.root.position.x).toBeCloseTo(old.root.position.x + old.root.velocity.x * 0.0000001 + 0.5 * 3 * 0.0000001 ** 2, 12);
    expect(() => own.read({ ...request, executionSourceId: source.sourceId, mode: 'current' })).toThrow();
    expect(own.read({ ...request, executionSourceId: source.sourceId })).toEqual(admitted);
    const secondAdvance: AcceptedBattedWorldFieldExecution = { ...advance, sourceId: 'kinematics-second-advance', previousExecutionSourceId: advance.sourceId,
      action: { ...advance.action, kind: 'throw_advance', planSourceId: source.sourceId, throughElapsedSeconds: start + 0.0000002 } };
    x.sources.set(secondAdvance.sourceId, secondAdvance); x.executions.accept(secondAdvance.sourceId);
    const twice = own.read({ ...request, executionSourceId: secondAdvance.sourceId });
    expect(twice.at.tick).toBe(executed.at.tick);
    expect(twice.at.elapsedSeconds).toBeGreaterThan(executed.at.elapsedSeconds);
    expect(twice.adoptions).toHaveLength(executed.adoptions.length);
    expect(twice.activeCommand.adoptionSourceId).toBe(advance.sourceId);
    expect(twice.root.position.x).toBeCloseTo(old.root.position.x + old.root.velocity.x * 0.0000002 + 0.5 * 3 * 0.0000002 ** 2, 12);
    expect(own.read({ ...request, executionSourceId: advance.sourceId })).toEqual(executed);
    // The same executed endpoint with a single transfer advance has byte-identical self state.
    const progress = advanceBattedWorldScheduledFieldThrow({ plan: planned.execution.plan, previous: null, throughElapsedSeconds: twice.at.elapsedSeconds });
    const directSource = { ...secondAdvance, sourceId: 'single-transfer', previousExecutionSourceId: source.sourceId };
    const last = x.executions.read(secondAdvance.sourceId)!;
    if (last.execution.kind !== 'throw_advance') throw new Error('fixture advance');
    const direct: DurableBattedWorldFieldExecution = { ...last, source: directSource, revision: 3,
      history: [x.acquired.source, source, directSource], execution: { ...last.execution, progress, field: progress.field } };
    const once = actualPlayerKinematicsFromPrefix('p2', { baseField: x.baseField, fields: [x.baseField], executions: [x.acquired, planned, direct] });
    expect(once.root).toEqual(twice.root); expect(once.roles).toEqual(twice.roles);
    expect(once.adoptions).toHaveLength(twice.adoptions.length);
    expect(once.adoptions.filter((a) => a.kind === 'throw_advance')).toHaveLength(1);
  } finally { x.f.close(); }
});


it('integrates multiple field and execution commands only over their actual piecewise intervals', () => {
  const x = richFixture();
  try {
    const own = actualPlayerKinematicsEvidenceFromSqlite(x.f.db), first = own.read(cut(x));
    const originalSource = x.baseField.source;
    if (originalSource.kind !== undefined || originalSource.episodeFieldBinding !== undefined) {
      throw new Error('piecewise kinematics fixture requires the legacy field Source');
    }
    const secondSource = { ...originalSource, sourceId: 'second-root-motion', previousFieldSourceId: originalSource.sourceId,
      availableAtTick: first.at.tick, throughTick: first.at.tick + 1000,
      commands: originalSource.commands.map((c) => ({ ...c, bodyAcceleration: v(-0.2, 0),
        primitiveMotions: c.primitiveMotions.map((p) => ({ ...p, offsetAcceleration: v(-0.4) })) })) };
    x.sources.set(secondSource.sourceId, secondSource); const secondField = x.fields.accept(secondSource.sourceId);
    const second = own.read({ ...cut(x), baseFieldSourceId: secondSource.sourceId, mode: 'current' });
    const dt = second.at.elapsedSeconds - first.at.elapsedSeconds;
    expect(second.root.position.x).toBeCloseTo(first.root.position.x + first.root.velocity.x * dt - 0.1 * dt * dt, 12);
    expect(second.roles[0].offset.x).toBeCloseTo(first.roles[0].offset.x + first.roles[0].relativeVelocity.x * dt - 0.2 * dt * dt, 12);
    const source: AcceptedBattedWorldFieldExecution = { sourceId: 'third-root-motion', sourceVersion: 'synthetic-v1', baseFieldSourceId: secondSource.sourceId,
      previousExecutionSourceId: null, action: { kind: 'motion', availableAtTick: second.at.tick, throughTick: second.at.tick + 1000,
        commands: secondSource.commands.map((c) => ({ ...c, bodyAcceleration: v(0.7, 0) })) } };
    const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, { readAcceptedExecution: () => source }));
    const moved = executions.accept(source.sourceId);
    const result = own.read({ ...cut(x), baseFieldSourceId: secondSource.sourceId, executionSourceId: source.sourceId, mode: 'current' });
    const step = result.at.elapsedSeconds - second.at.elapsedSeconds;
    expect(result.root.position.x).toBeCloseTo(second.root.position.x + second.root.velocity.x * step + 0.35 * step * step, 12);
    expect(result.adoptions.map((a) => a.kind)).toEqual(['contact', 'field', 'field', 'motion']);
    expect(result.adoptions[2].executedThrough).toEqual(second.at);
    expect(result.activeCommand.executedThrough).toEqual(result.at);
    expect(result.at.elapsedSeconds).toBe(moved.execution.field.motion.world.moment.elapsedSeconds);
    expect(() => own.read({ ...cut(x), mode: 'current' })).toThrow();
    // Later owner payloads are not consumed by the original bounded cut.
    x.f.db.prepare("UPDATE batted_world_field_actions SET source_json='invalid-future-payload' WHERE source_id=?").run(secondField.source.sourceId);
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='invalid-future-payload' WHERE source_id=?").run(source.sourceId);
    expect(own.read(cut(x))).toEqual(first);
    x.f.db.prepare('UPDATE batted_world_field_execution_heads SET revision=revision+1').run();
    expect(() => own.read(cut(x))).toThrow(/head/);
  } finally { x.f.close(); }
});

it('preserves acquisition/fence motion and skips every observer Source without adopting commands', async () => {
  const { scheduledAcquisitionHistoryFixture } = await import('./ScheduledFieldAcquisitionHistory.test-support');
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const own = actualPlayerKinematicsEvidenceFromSqlite(x.f.db), original = own.read(cut(x));
    const planned = x.accept('kinematics-capture-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('fixture capture plan');
    const plan = planned.execution.plan;
    const admitted = own.read({ ...cut(x), executionSourceId: planned.source.sourceId });
    expect(admitted.root).toEqual(original.root); expect(admitted.activeCommand).toEqual(original.activeCommand);
    for (const [i, end] of [(plan.contactMoment.elapsedSeconds + plan.secureElapsedSeconds) / 2,
      (plan.secureElapsedSeconds + plan.fenceElapsedSeconds) / 2, plan.fenceElapsedSeconds].entries()) {
      const value = x.accept(`kinematics-capture-${i}`, { kind: 'acquisition_advance', planSourceId: planned.source.sourceId, throughElapsedSeconds: end });
      const result = own.read({ ...cut(x), executionSourceId: value.source.sourceId });
      expect(result.at.elapsedSeconds).toBe(end);
      expect(result.adoptions).toHaveLength(2);
      expect(result.activeCommand.sourceId).toBe(x.baseField.source.sourceId);
      expect(result.activeCommand.executedThrough).toEqual(result.at);
    }
    const before = own.read({ ...cut(x), executionSourceId: x.executionPrefix.at(-1)!.source.sourceId });
    for (const action of [{ kind: 'whole_play_history' }, { kind: 'base_touch_history', playerId: 'p2', base: 'first' },
      { kind: 'first_base_race' }] as const) {
      const observer = x.accept(`kinematics-observer-${action.kind}`, action);
      const result = own.read({ ...cut(x), executionSourceId: observer.source.sourceId, mode: 'current' });
      expect(result.root).toEqual(before.root); expect(result.roles).toEqual(before.roles);
      expect(result.adoptions).toEqual(before.adoptions); expect(result.at).toEqual(before.at);
    }
  } finally { x.f.close(); }
});

it('records the first throw adoption even when release executes zero elapsed time', () => {
  const x = battedWorldFieldThrowFixture(undefined, 0);
  try {
    if (x.source.action.kind !== 'throw') throw new Error('fixture throw');
    const align: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'kinematics-aligned',
      action: { kind: 'motion', availableAtTick: x.capture.secureTick, throughTick: x.capture.secureTick + 1, commands: x.fieldSource.commands } };
    x.sources.set(align.sourceId, align); x.executions.accept(align.sourceId);
    const own = actualPlayerKinematicsEvidenceFromSqlite(x.f.db), before = own.read({ ...cut(x), executionSourceId: align.sourceId });
    const planSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'kinematics-zero-plan', previousExecutionSourceId: align.sourceId,
      action: { ...x.source.action, kind: 'throw_plan', commands: x.source.action.commands.map((c) => ({ ...c, bodyAcceleration: v(0.2, 0) })) } };
    x.sources.set(planSource.sourceId, planSource); const planned = x.executions.accept(planSource.sourceId);
    if (planned.execution.kind !== 'throw_plan') throw new Error('fixture plan');
    expect(planned.execution.plan.releaseElapsedSeconds).toBe(before.at.elapsedSeconds);
    const advance: AcceptedBattedWorldFieldExecution = { ...planSource, sourceId: 'kinematics-zero-release', previousExecutionSourceId: planSource.sourceId,
      action: { kind: 'throw_advance', planSourceId: planSource.sourceId, throughElapsedSeconds: before.at.elapsedSeconds } };
    x.sources.set(advance.sourceId, advance); const released = x.executions.accept(advance.sourceId);
    expect(released.execution).toMatchObject({ kind: 'throw_advance', progress: { kind: 'released' } });
    const after = own.read({ ...cut(x), executionSourceId: advance.sourceId });
    expect(after.at).toEqual(before.at); expect(after.root.position).toEqual(before.root.position); expect(after.root.velocity).toEqual(before.root.velocity);
    expect(after.root.acceleration).toEqual(v(0.2, 0));
    expect(after.adoptions).toHaveLength(before.adoptions.length + 1);
    expect(after.activeCommand).toMatchObject({ sourceId: planSource.sourceId, adoptionSourceId: advance.sourceId, adoptedAt: before.at, executedThrough: before.at });
  } finally { x.f.close(); }
});

it('records atomic throw command adoption at the transfer start rather than its later release', () => {
  const x = battedWorldFieldThrowFixture(undefined, 1000);
  try {
    if (x.source.action.kind !== 'throw') throw new Error('fixture throw');
    const source: AcceptedBattedWorldFieldExecution = { ...x.source, action: { ...x.source.action,
      commands: x.source.action.commands.map((c) => ({ ...c, bodyAcceleration: v(0.2, 0) })) } };
    x.sources.set(source.sourceId, source); x.executions.accept(source.sourceId);
    const result = actualPlayerKinematicsEvidenceFromSqlite(x.f.db).read({ ...cut(x), executionSourceId: source.sourceId });
    expect(result.activeCommand).toMatchObject({ kind: 'throw', sourceId: source.sourceId, adoptedAt: { elapsedSeconds: x.capture.moment.elapsedSeconds } });
    expect(result.root.acceleration).toEqual(v(0.2, 0));
  } finally { x.f.close(); }
});
