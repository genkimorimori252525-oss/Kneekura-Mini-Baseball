import { expect, it } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

it('owns field-aware continuation and reopens its original causal prefix without rewriting the field archive', () => {
  const x = battedWorldFieldFixture();
  try {
    const base = x.fields.accept(x.source.sourceId), archived = JSON.stringify(base);
    const source: AcceptedBattedWorldFieldExecution = { sourceId: 'field-execution-1', sourceVersion: 'synthetic-v1',
      baseFieldSourceId: base.source.sourceId, previousExecutionSourceId: null,
      action: { kind: 'motion', availableAtTick: base.field.motion.world.moment.ball.tick,
        throughTick: base.field.motion.world.moment.ball.tick + 1000, commands: x.source.commands } };
    const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields,
      { readAcceptedExecution: (id) => id === source.sourceId ? source : null }));
    const value = executions.accept(source.sourceId);
    expect(value.revision).toBe(1);
    expect(value.history).toEqual([source]);
    expect(value.baseField).toEqual(base);
    expect(value.execution.kind).toBe('motion');
    expect(value.execution.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(base.field.motion.world.moment.elapsedSeconds);
    expect(value).not.toHaveProperty('playEnd'); expect(value).not.toHaveProperty('officialClosure');
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(source.sourceId)).toEqual(value);
    expect(reopened.accept(source.sourceId)).toEqual(value);
    expect(JSON.stringify(x.fields.read(base.source.sourceId))).toBe(archived);
    const lower = { ...x.source, sourceId: 'stale-field-motion', previousFieldSourceId: base.source.sourceId,
      throughTick: base.field.motion.world.moment.ball.tick + 2000 };
    x.sources.set(lower.sourceId, lower);
    expect(() => x.fields.accept(lower.sourceId)).toThrow(/owner|execution/);
    expect(x.fields.accept(base.source.sourceId)).toEqual(base);
  } finally { x.f.close(); }
});

it('adopts the actual field candidate and carries it from the secure moment before a Player-owned transfer and throw', async () => {
  const { battedWorldFieldThrowFixture } = await import('./BattedWorldFieldExecutionFixtures.test-support');
  const x = battedWorldFieldThrowFixture();
  try {
    expect(x.baseField.field.motion.response.kind).toBe('capture_candidate');
    expect(x.capture.contactMoment).toEqual(x.baseField.field.motion.world.moment);
    expect(x.capture.baseContacts).toEqual([]);
    const result = x.executions.accept(x.source.sourceId);
    expect(result.execution.kind).toBe('throw');
    if (result.execution.kind !== 'throw') throw new Error('field throw fixture');
    expect(result.execution.model).toEqual(x.model);
    expect(result.execution.throw.kind).toBe('released');
    if (result.execution.throw.kind !== 'released') throw new Error('actual release');
    expect(result.execution.throw.transfer.throwReadyTick).toBe(x.capture.secureTick + 210);
    expect(result.execution.throw.launch.releaseSpeedMps).toBe(20);
    expect(result.execution.field.motion.carrierPlayerId).toBeNull();
    expect(x.executions.read(x.acquired.source.sourceId)).toEqual(x.acquired);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(result.source.sourceId)).toEqual(result);
    expect(reopened.accept(result.source.sourceId)).toEqual(result);
    expect(x.fields.read(x.baseField.source.sourceId)).toEqual(x.baseField);
  } finally { x.f.close(); }
});

it('keeps an original historical execution readable without replaying a later payload, while proving the whole sequence metadata', async () => {
  const { battedWorldFieldExecutionFixture } = await import('./BattedWorldFieldExecutionFixtures.test-support');
  const x = battedWorldFieldExecutionFixture();
  try {
    const first = x.executions.accept(x.source.sourceId), end = first.execution.field.motion.world.moment.ball.tick;
    const next = { ...x.source, sourceId: 'field-execution-2', previousExecutionSourceId: first.source.sourceId,
      action: { kind: 'motion' as const, availableAtTick: end, throughTick: end + 1000, commands: x.fieldSource.commands } };
    x.sources.set(next.sourceId, next); x.executions.accept(next.sourceId);
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='invalid-future-payload' WHERE source_id=?").run(next.sourceId);
    expect(x.executions.read(first.source.sourceId)).toEqual(first);
    expect(x.executions.accept(first.source.sourceId)).toEqual(first);
    expect(() => x.executions.read(next.sourceId)).toThrow();
    x.f.db.prepare('UPDATE batted_world_field_executions SET revision=1.5 WHERE source_id=?').run(next.sourceId);
    expect(() => x.executions.read(first.source.sourceId)).toThrow(/metadata/);
  } finally { x.f.close(); }
});

it('rejects caller physical outcomes, incomplete commands and capture without the original candidate', async () => {
  const { battedWorldFieldExecutionFixture } = await import('./BattedWorldFieldExecutionFixtures.test-support');
  const x = battedWorldFieldExecutionFixture();
  try {
    for (const property of ['ball', 'possession', 'secureTick', 'field', 'officialClosure']) {
      x.sources.set(x.source.sourceId, { ...x.source, [property]: {} });
      expect(() => x.executions.accept(x.source.sourceId)).toThrow();
    }
    if (x.source.action.kind !== 'motion') throw new Error('field motion fixture');
    x.sources.set(x.source.sourceId, { ...x.source, action: { ...x.source.action, commands: [] } });
    expect(() => x.executions.accept(x.source.sourceId)).toThrow();
    x.sources.set(x.source.sourceId, { ...x.source, action: { kind: 'acquisition' } });
    expect(() => x.executions.accept(x.source.sourceId)).toThrow(/candidate/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

it('rejects a field execution root superseded by actual later lower motion', async () => {
  const { battedWorldFieldExecutionFixture } = await import('./BattedWorldFieldExecutionFixtures.test-support');
  const x = battedWorldFieldExecutionFixture();
  try {
    const next = { ...x.fieldSource, sourceId: 'field-later', previousFieldSourceId: x.baseField.source.sourceId,
      throughTick: x.baseField.field.motion.world.moment.ball.tick + 3000 };
    x.fieldSources.set(next.sourceId, next); x.fields.accept(next.sourceId);
    expect(() => x.executions.accept(x.source.sourceId)).toThrow(/prefix/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

it('carries from the actual secure state and rejects repeated capture', async () => {
  const { battedWorldFieldExecutionFixture } = await import('./BattedWorldFieldExecutionFixtures.test-support');
  const x = battedWorldFieldExecutionFixture(undefined, 'candidate');
  try {
    const first = x.executions.accept(x.source.sourceId);
    if (first.execution.kind !== 'acquisition' || first.execution.acquisition.kind !== 'secured') throw new Error('actual field capture');
    const acquired = first.execution.acquisition;
    const repeated = { ...x.source, sourceId: 'duplicate-capture', previousExecutionSourceId: first.source.sourceId };
    x.sources.set(repeated.sourceId, repeated);
    expect(() => x.executions.accept(repeated.sourceId)).toThrow(/already/);
    const source = { ...x.source, sourceId: 'field-carried', previousExecutionSourceId: first.source.sourceId,
      action: { kind: 'motion' as const, availableAtTick: acquired.secureTick, throughTick: acquired.secureTick + 1000, commands: x.fieldSource.commands } };
    x.sources.set(source.sourceId, source);
    const carried = x.executions.accept(source.sourceId);
    expect(carried.execution.field.motion.carrierPlayerId).toBe(acquired.acquirerPlayerId);
    expect(carried.execution.field.motion.response.kind).toBe('carried');
    expect(carried.execution.field.motion.actors[0].startElapsedSeconds).toBe(acquired.moment.elapsedSeconds);
    expect(x.executions.read(first.source.sourceId)).toEqual(first);
  } finally { x.f.close(); }
});

it('rejects a different accepted Player fielding model, inactive or offensive receiver, and transported release results', async () => {
  const { battedWorldFieldThrowFixture } = await import('./BattedWorldFieldExecutionFixtures.test-support');
  const x = battedWorldFieldThrowFixture();
  try {
    if (x.source.action.kind !== 'throw') throw new Error('throw fixture');
    const other = { ...x.model.source, sourceId: 'other-fielding-model', playerId: x.receiver.playerId, personLinkSourceId: x.receiver.personLinkSourceId };
    x.fieldingSources.set(other.sourceId, other); x.fielding.accept(other.sourceId);
    for (const action of [
      { ...x.source.action, modelSourceId: other.sourceId }, { ...x.source.action, modelSourceId: 'missing' },
      { ...x.source.action, receiverPlayerId: 'unregistered' },
      { ...x.source.action, receiverPlayerId: x.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.playerId },
      { ...x.source.action, releaseTick: 1 },
    ]) {
      x.sources.set(x.source.sourceId, { ...x.source, action });
      expect(() => x.executions.accept(x.source.sourceId)).toThrow();
      expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 1 });
    }
  } finally { x.f.close(); }
});
