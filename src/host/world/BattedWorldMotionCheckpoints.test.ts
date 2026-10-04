import { expect, it } from 'vitest';
import { actualDefensiveDecisionFixture } from './ActualDefensiveDecisionFixtures.test-support';
import { battedWorldFieldExecutionFixture, battedWorldFieldThrowFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
type Fixture = Pick<ReturnType<typeof battedWorldFieldExecutionFixture>, 'f' | 'baseField' | 'source' | 'fieldSource'>;
const checkpoint = (x: Fixture, checkpointThroughTick: number, coverageThroughTick: number): AcceptedBattedWorldFieldExecution => ({
  ...x.source, sourceId: 'coverage-checkpoint', action: { kind: 'motion_checkpoint_v1', availableAtTick: x.fieldSource.availableAtTick,
    checkpointThroughTick, coverageThroughTick, commands: x.fieldSource.commands },
});
const self = (x: Fixture, executionSourceId: string | null, playerId = 'p2') => actualPlayerKinematicsEvidenceFromSqlite(x.f.db).read({
  physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId, playerId,
  baseFieldSourceId: x.baseField.source.sourceId, executionSourceId, mode: 'original',
});
const prefix = (x: Fixture, executionSourceId: string) => ({ baseField: x.baseField,
  fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField),
  executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, executionSourceId),
});
it('reaches ordinary contact-free individual deadlines with retained coverage and preserves exact owned kinematics/history', () => {
  const x = actualDefensiveDecisionFixture();
  try {
    const archived = x.f.db.prepare('SELECT * FROM batted_world_field_actions').all();
    x.plans.accept(x.planSource.sourceId); const pending = x.decisions.accept(x.decisionSource.sourceId);
    const due = pending.receipt.scheduling, source = checkpoint(x, due.decisionTick, due.movementStartTick + 1000);
    x.sources.set(source.sourceId, source); const first = x.executions.accept(source.sourceId), one = self(x, source.sourceId);
    expect(first.execution.field.motion.world.kind).not.toBe('boundary');
    expect(one.at.elapsedSeconds).toBe((due.decisionTick - one.at.originTick) / one.ticksPerSecond);
    expect(one.activeCommand).toMatchObject({ kind: 'motion_checkpoint_v1', sourceId: source.sourceId, acceptedThroughTick: due.movementStartTick + 1000 });
    const next: AcceptedBattedWorldFieldExecution = { ...source, sourceId: 'retained-due', previousExecutionSourceId: source.sourceId,
      action: { kind: 'retained_motion_checkpoint_v1', checkpointThroughTick: due.movementStartTick } };
    x.sources.set(next.sourceId, next); const last = x.executions.accept(next.sourceId), two = self(x, next.sourceId);
    expect(last.execution.field.motion.world.kind).not.toBe('boundary');
    expect(last.execution.field.motion.actors).toEqual(first.execution.field.motion.actors);
    expect(two.at.elapsedSeconds).toBe((due.movementStartTick - two.at.originTick) / two.ticksPerSecond);
    expect(two.adoptions).toHaveLength(one.adoptions.length);
    expect(two.activeCommand).toMatchObject({ sourceId: source.sourceId, acceptedThroughTick: due.movementStartTick + 1000, executedThrough: two.at });
    expect(two.roles.every(role => role.canonicalActor.primitive.endTick > due.movementStartTick)).toBe(true);
    const obs = { ...x.observationSource, sourceId: 'observation-at-due', previousObservationSourceId: x.observationSource.sourceId, executionSourceId: next.sourceId };
    x.observationSources.set(obs.sourceId, obs); x.observations.accept(obs.sourceId);
    const decision = { ...x.decisionSource, sourceId: 'decision-at-due', previousDecisionSourceId: pending.source.sourceId, observationSourceId: obs.sourceId };
    x.decisionSources.set(decision.sourceId, decision); const issued = x.decisions.accept(decision.sourceId);
    expect(issued.receipt.lifecycle.status).toBe('issued');
    expect(issued.receipt.lifecycle.issuedAt).toEqual(two.at);
    expect(issued.receipt.selected).toEqual(pending.receipt.selected);
    const physical = battedWorldFieldPhysicalPrefix(prefix(x, next.sourceId)), history = wholePlayPhysicalHistoryFromPrefix(prefix(x, next.sourceId));
    expect(history.horizon).toEqual(physical.field.evidence.horizon);
    expect(history.physicalSteps.at(-1)?.kind).toBe('retained_motion_checkpoint_v1');
    expect(history.horizon.elapsedSeconds).toBe(two.at.elapsedSeconds);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_actions').all()).toEqual(archived);
    const reader = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reader.accept(last.source.sourceId)).toEqual(last);
    expect(self(x, source.sourceId)).toEqual(one);
  } finally { x.f.close(); }
});
it('keeps bounded old checkpoint payloads readable but rejects future ownership corruption', () => {
  const x = battedWorldFieldExecutionFixture();
  try {
    const at = x.baseField.field.motion.world.moment.ball.tick;
    const source = checkpoint(x, at + 100, at + 1000); x.sources.set(source.sourceId, source);
    const first = x.executions.accept(source.sourceId);
    const next: AcceptedBattedWorldFieldExecution = { ...source, sourceId: 'retained-later', previousExecutionSourceId: source.sourceId,
      action: { kind: 'retained_motion_checkpoint_v1', checkpointThroughTick: at + 200 } };
    x.sources.set(next.sourceId, next); x.executions.accept(next.sourceId);
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='invalid-future',snapshot_json='invalid-future' WHERE source_id=?").run(next.sourceId);
    expect(x.executions.read(source.sourceId)).toEqual(first);
    expect(() => x.executions.read(next.sourceId)).toThrow();
    x.f.db.prepare('UPDATE batted_world_field_execution_heads SET revision=revision+1').run();
    expect(() => x.executions.read(source.sourceId)).toThrow(/head/);
  } finally { x.f.close(); }
});
it('retains actual carried original curves at checkpoints and respects pending transfer ownership', () => {
  const x = battedWorldFieldThrowFixture();
  try {
    const at = x.capture.secureTick;
    const source = { ...checkpoint(x, at + 100, at + 1000), previousExecutionSourceId: x.acquired.source.sourceId };
    x.sources.set(source.sourceId, source); const first = x.executions.accept(source.sourceId);
    const next: AcceptedBattedWorldFieldExecution = { ...source, sourceId: 'carried-checkpoint', previousExecutionSourceId: source.sourceId,
      action: { kind: 'retained_motion_checkpoint_v1', checkpointThroughTick: at + 200 } };
    x.sources.set(next.sourceId, next); const last = x.executions.accept(next.sourceId);
    expect(last.execution.field.motion.response.kind).toBe('carried');
    expect(last.execution.field.motion.actors).toEqual(first.execution.field.motion.actors);
    expect(self(x, next.sourceId).activeCommand.sourceId).toBe(source.sourceId);
    expect(wholePlayPhysicalHistoryFromPrefix(prefix(x, next.sourceId)).carrierPlayerId).toBe(x.capture.acquirerPlayerId);
    if (x.source.action.kind !== 'throw') throw new Error('fixture');
    const plan = { ...x.source, sourceId: 'pending-transfer', previousExecutionSourceId: next.sourceId, action: { ...x.source.action, kind: 'throw_plan' as const } };
    x.sources.set(plan.sourceId, plan); x.executions.accept(plan.sourceId);
    const blocked = { ...next, sourceId: 'blocked-checkpoint', previousExecutionSourceId: plan.sourceId };
    x.sources.set(blocked.sourceId, blocked);
    expect(() => x.executions.accept(blocked.sourceId)).toThrow(/pending/);
  } finally { x.f.close(); }
});
it('rejects malformed complete commands and renewed retention, then permits explicit new adoption at exhausted coverage', () => {
  const x = battedWorldFieldExecutionFixture();
  try {
    const at = x.baseField.field.motion.world.moment.ball.tick, source = checkpoint(x, at + 100, at + 200);
    if (source.action.kind !== 'motion_checkpoint_v1') throw new Error('fixture');
    for (const action of [{ ...source.action, commands: [] },
      { ...source.action, commands: [...source.action.commands.slice(0, -1), source.action.commands[0]] },
      { ...source.action, commands: source.action.commands.map((c, i) => i ? c : { ...c, primitiveMotions: c.primitiveMotions.slice(1) }) },
      { ...source.action, checkpointThroughTick: at + 201 }, { ...source.action, coverageThroughTick: at - 1 },
      { ...source.action, availableAtTick: at + 1 }, { ...source.action, result: 'safe' }]) {
      x.sources.set(source.sourceId, { ...source, action });
      expect(() => x.executions.accept(source.sourceId)).toThrow();
      expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 0 });
    }
    x.sources.set(source.sourceId, source); const first = x.executions.accept(source.sourceId);
    const end: AcceptedBattedWorldFieldExecution = { ...source, sourceId: 'coverage-end', previousExecutionSourceId: source.sourceId,
      action: { kind: 'retained_motion_checkpoint_v1', checkpointThroughTick: at + 200 } };
    for (const extra of [{ commands: source.action.commands }, { coverageThroughTick: at + 1000 }, { availableAtTick: at }]) {
      x.sources.set(end.sourceId, { ...end, action: { ...end.action, ...extra } });
      expect(() => x.executions.accept(end.sourceId)).toThrow();
    }
    x.sources.set(end.sourceId, end); const last = x.executions.accept(end.sourceId);
    expect(last.execution.field.motion.actors).toEqual(first.execution.field.motion.actors);
    const expired = { ...end, sourceId: 'expired-retention', previousExecutionSourceId: end.sourceId,
      action: { kind: 'retained_motion_checkpoint_v1' as const, checkpointThroughTick: at + 201 } };
    x.sources.set(expired.sourceId, expired); expect(() => x.executions.accept(expired.sourceId)).toThrow(/exhausted/);
    const renewed = { ...source, sourceId: 'explicit-new-command', previousExecutionSourceId: end.sourceId,
      action: { ...source.action, availableAtTick: at + 200, coverageThroughTick: at + 1000, checkpointThroughTick: at + 300 } };
    x.sources.set(renewed.sourceId, renewed); x.executions.accept(renewed.sourceId);
    const current = self(x, renewed.sourceId);
    expect(current.activeCommand).toMatchObject({ sourceId: renewed.sourceId, acceptedThroughTick: at + 1000,
      adoptedAt: { tick: at + 200 } });
    expect(current.adoptions.at(-2)?.sourceId).toBe(source.sourceId);
  } finally { x.f.close(); }
});
it('leaves physical contact earlier than command coverage in history and excludes checkpoints during pending acquisition', () => {
  const x = battedWorldFieldExecutionFixture();
  try {
    const at = x.baseField.field.motion.world.moment.ball.tick, source = checkpoint(x, at + 5_000_000, at + 6_000_000);
    x.sources.set(source.sourceId, source); const result = x.executions.accept(source.sourceId), motion = result.execution.field.motion;
    expect(motion.world.kind).toBe('boundary');
    expect(motion.world.moment.ball.tick).toBeLessThan(at + 5_000_000);
    expect(motion.actors.every(a => a.primitive.endTick === at + 6_000_000)).toBe(true);
    const history = wholePlayPhysicalHistoryFromPrefix(prefix(x, source.sourceId));
    expect(history.horizon).toEqual(motion.world.moment);
    expect(self(x, source.sourceId).activeCommand.executedThrough.elapsedSeconds).toBe(motion.world.moment.elapsedSeconds);
    const observed: AcceptedBattedWorldFieldExecution = { ...source, sourceId: 'rules-at-contact', previousExecutionSourceId: source.sourceId,
      action: { kind: 'first_base_race', custodyPolicy: 'release_exclusive_v1' } };
    x.sources.set(observed.sourceId, observed); expect(x.executions.accept(observed.sourceId).execution.kind).toBe('first_base_race');
  } finally { x.f.close(); }
  const y = battedWorldFieldExecutionFixture(undefined, 'candidate');
  try {
    const plan: AcceptedBattedWorldFieldExecution = { ...y.source, action: { kind: 'acquisition_plan' } };
    y.sources.set(plan.sourceId, plan); y.executions.accept(plan.sourceId);
    const at = y.baseField.field.motion.world.moment.ball.tick;
    for (const action of [checkpoint(y, at + 100, at + 1000).action,
      { kind: 'retained_motion_checkpoint_v1' as const, checkpointThroughTick: at + 100 }]) {
      const blocked = { ...plan, sourceId: 'blocked-capture-checkpoint', previousExecutionSourceId: plan.sourceId, action };
      y.sources.set(blocked.sourceId, blocked); expect(() => y.executions.accept(blocked.sourceId)).toThrow(/pending/);
    }
  } finally { y.f.close(); }
});
it('matches one-shot self state for all ten Players after paused nonzero root and relative command execution', () => {
  const paused = battedWorldFieldExecutionFixture(), once = battedWorldFieldExecutionFixture();
  try {
    const at = paused.baseField.field.motion.world.moment.ball.tick;
    const prepare = (x: typeof paused, checkpointThroughTick: number) => {
      const source = checkpoint(x, checkpointThroughTick, at + 2000);
      if (source.action.kind !== 'motion_checkpoint_v1') throw new Error('fixture');
      const batterId = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.playerId;
      return { ...source, action: { ...source.action, commands: source.action.commands.map(c => ({ ...c,
        bodyAcceleration: { x: 0.03, y: c.playerId === batterId ? 0.02 : 0, z: -0.015 },
        primitiveMotions: c.primitiveMotions.map((p, i) => ({ ...p, offsetAcceleration: { x: 0.002 * (i + 1), y: -0.003 * (i + 1), z: 0.004 * (i + 1) } })),
      })) } };
    };
    const start = prepare(paused, at + 117), unpaused = prepare(once, at + 901);
    paused.sources.set(start.sourceId, start); const first = paused.executions.accept(start.sourceId);
    once.sources.set(unpaused.sourceId, unpaused); once.executions.accept(unpaused.sourceId);
    let previous = start.sourceId;
    for (const delta of [300, 611, 901]) {
      const source: AcceptedBattedWorldFieldExecution = { ...start, sourceId: `paused-${delta}`, previousExecutionSourceId: previous,
        action: { kind: 'retained_motion_checkpoint_v1', checkpointThroughTick: at + delta } };
      paused.sources.set(source.sourceId, source); const value = paused.executions.accept(source.sourceId);
      expect(value.execution.field.motion.actors).toEqual(first.execution.field.motion.actors);
      previous = source.sourceId;
    }
    const left = prefix(paused, previous), right = prefix(once, unpaused.sourceId);
    for (const command of start.action.commands) {
      const l = actualPlayerKinematicsFromPrefix(command.playerId, left), r = actualPlayerKinematicsFromPrefix(command.playerId, right);
      expect(l.root).toEqual(r.root); expect(l.roles).toEqual(r.roles);
      expect(l.root.acceleration).toEqual(command.bodyAcceleration);
      for (const role of l.roles) expect(role.relativeAcceleration).toEqual(command.primitiveMotions.find(p => p.role === role.role)!.offsetAcceleration);
      expect(l.adoptions).toHaveLength(r.adoptions.length);
      expect(l.activeCommand.acceptedThroughTick).toBe(at + 2000);
    }
  } finally { paused.f.close(); once.f.close(); }
});
