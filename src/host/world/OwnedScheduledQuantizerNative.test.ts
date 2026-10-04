import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, openSqliteBattedWorldFieldExecutionStore,
  type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { ownedScheduledMotionArchiveJson, ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { battedWorldFieldPhysicalPrefix, battedWorldFieldBaseTouchHistoryFromPrefix } from './BattedWorldFieldPhysicalPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { installOwnedScheduledDecision } from './OwnedScheduledMotionDecisionFixtures.test-support';
import type { OwnedMotionV2Action } from './OwnedScheduledBattedWorldMotion';

// Genuine Native fixture inputs are accepted by the normal pitch/contact/field owners.
// Move original actor shapes away before their Source is accepted so first ground
// contact, rather than an old capture forecast, leaves a real free-ball cursor.
const nativeFixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'retained-quantizer-native-')), 'state.sqlite');
  const x = battedWorldFieldExecutionFixture(path, 'candidate', world => {
    const model = world.models.get(world.model.sourceId)!;
    world.models.set(model.sourceId, { ...model, actors: model.actors.map((a, i) => ({ ...a, primitives: a.primitives.map(p => ({
      ...p, offset: { x: 1000 + i, y: p.offset.y, z: 1000 } })) })) });
  });
  const pitchId = x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId;
  const ids = x.fieldSource.commands.map(c => c.playerId);
  const prefix = (through: string | null) => ({ baseField: x.baseField,
    fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField),
    executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, through) });
  const source = (sourceId: string, previousExecutionSourceId: string | null, checkpoint: OwnedMotionV2Action['checkpoint']) => {
    const p = prefix(previousExecutionSourceId), knownWork = ownedMotionKnownWorkFromSqlite(x.f.db, pitchId, ids);
    const action: OwnedMotionV2Action = { kind: 'owned_motion_v2', checkpoint, knownWork,
      contributions: actualPlayersKinematicsFromPrefix(ids, p).map(s => ({ kind: 'retained', playerId: s.playerId, command: s.activeCommand })) };
    const input: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId, previousExecutionSourceId, action };
    x.sources.set(sourceId, input); return input;
  };
  const step = (id: string, previous: string | null, throughTick: number) => x.executions.accept(source(id, previous,
    { kind: 'retained_quantizer_bucket_v1', throughTick }).sourceId);
  return { ...x, pitchId, ids, prefix, source, step };
};

it('executes a genuine retained bucket tail into whole/foot history and preserves retry, reopen and historical archive bytes', () => {
  const x = nativeFixture();
  try {
    expect(x.baseField.field.motion.response.kind).toBe('ground');
    expect(x.baseField.field.motion.cursor).not.toBeNull();
    const before = x.prefix(null), selves = actualPlayersKinematicsFromPrefix(x.ids, before);
    const moment = x.baseField.field.motion.cursor!.moment, tps = x.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
    const boundary = deriveQuantizerClosedGenerationBoundary({ originTick: moment.originTick, throughTick: moment.ball.tick, ticksPerSecond: tps });
    const saved = x.step('native-quantizer-tail', null, moment.ball.tick);
    if (saved.execution.kind !== 'owned_motion_v2') throw new Error('owned checkpoint');
    expect(saved.execution.adoption.status).toBe('checkpoint_reached');
    expect(saved.execution.adoption.executedThrough.elapsedSeconds).toBe(boundary.lastIncludedElapsedSeconds);
    expect(saved.execution.field.motion.actors).toEqual(x.baseField.field.motion.actors);
    expect(saved.execution.field.motion.actors).toHaveLength(50);
    expect(saved.execution.composition.contributors).toHaveLength(10);
    const p = x.prefix(saved.source.sourceId), actual = battedWorldFieldPhysicalPrefix(p), history = wholePlayPhysicalHistoryFromPrefix(p);
    expect(actual.segments.at(-1)).toMatchObject({ startElapsedSeconds: moment.elapsedSeconds, endElapsedSeconds: boundary.lastIncludedElapsedSeconds });
    expect(history.horizon.elapsedSeconds).toBe(boundary.lastIncludedElapsedSeconds);
    expect(history.physicalSteps.at(-1)).toMatchObject({ kind: 'owned_motion_v2', field: saved.execution.field });
    expect(history.end.kind).toBe('unestablished');
    const bag = x.baseField.geometry.geometry.baseGeometry.bases.first;
    const feet = battedWorldFieldBaseTouchHistoryFromPrefix({ ...p, playerId: x.ids[0], base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
    expect(feet.history.endElapsedSeconds).toBe(boundary.lastIncludedElapsedSeconds);
    const next = actualPlayersKinematicsFromPrefix(x.ids, p);
    expect(next.map(s => s.adoptions.length)).toEqual(selves.map(s => s.adoptions.length));
    expect(next.map(s => s.activeCommand.sourceId)).toEqual(selves.map(s => s.activeCommand.sourceId));
    const bytes = ownedScheduledMotionArchiveJson(saved), digest = ownedScheduledMotionArchiveHash(saved);
    expect(ownedScheduledMotionArchiveJson(x.executions.accept(saved.source.sourceId))).toBe(bytes);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(ownedScheduledMotionArchiveJson(reopened.read(saved.source.sourceId)!)).toBe(bytes);
    const future = x.step('native-quantizer-future', saved.source.sourceId, moment.ball.tick + 10);
    expect(ownedScheduledMotionArchiveHash(reopened.read(saved.source.sourceId)!)).toBe(digest);
    const rows = x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    const repeated = x.source('native-quantizer-already-reached', future.source.sourceId,
      { kind: 'retained_quantizer_bucket_v1', throughTick: moment.ball.tick + 10 });
    expect(() => x.executions.accept(repeated.sourceId)).toThrow(/already reached or past/);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all()).toEqual(rows);
  } finally { x.f.close(); }
});

it('stops a genuine known decision at its mathematical deadline without consuming it or claiming the requested bucket tail', () => {
  const x = nativeFixture();
  try {
    const start = x.baseField.field.motion.world.moment, first = x.step('native-decision-initial-tail', null, start.ball.tick);
    const player = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.defenderBindings[0].playerId;
    const installed = installOwnedScheduledDecision(x, player, first.source.sourceId, 50);
    expect(installed.decision.receipt.lifecycle.status).toBe('pending_decision');
    const dueTick = installed.decision.receipt.scheduling.decisionTick, saved = x.step('native-decision-boundary', first.source.sourceId, dueTick);
    if (saved.execution.kind !== 'owned_motion_v2') throw new Error('checkpoint');
    const e = saved.execution;
    expect(e.adoption.status).toBe('decision_boundary');
    expect(e.adoption.executedThrough.elapsedSeconds).toBe((dueTick - e.adoption.executedThrough.originTick) / e.composition.ticksPerSecond);
    expect(e.composition.quantizerBoundary!.lastIncludedElapsedSeconds).toBeGreaterThan(e.adoption.executedThrough.elapsedSeconds);
    expect(e.liveWork.pendingDecisionHandoffs).toHaveLength(1);
    expect(installed.decisions.read(installed.decision.source.sourceId)).toEqual(installed.decision);
    const blocked = x.source('native-decision-still-due', saved.source.sourceId, { kind: 'retained_quantizer_bucket_v1', throughTick: dueTick });
    const rows = x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    expect(() => x.executions.accept(blocked.sourceId)).toThrow(/due decision revision/);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all()).toEqual(rows);
  } finally { x.f.close(); }
});

it('rolls back the genuine new-variant row and head on same-connection trigger corruption', () => {
  const x = nativeFixture();
  try {
    const moment = x.baseField.field.motion.world.moment, initial = x.step('native-trigger-initial', null, moment.ball.tick);
    const input = x.source('native-trigger-tail', initial.source.sourceId,
      { kind: 'retained_quantizer_bucket_v1', throughTick: moment.ball.tick + 1 });
    const tables = ['batted_world_field_actions', 'batted_world_field_heads', 'batted_world_field_executions', 'batted_world_field_execution_heads'];
    const rows = () => tables.map(t => x.f.db.prepare(`SELECT * FROM ${t} ORDER BY source_id`).all());
    const before = rows();
    for (const event of ['AFTER INSERT ON batted_world_field_executions', 'AFTER UPDATE ON batted_world_field_execution_heads']) {
      for (const mutation of [
        "UPDATE batted_world_field_actions SET snapshot_hash='changed-dependency';",
        "UPDATE batted_world_field_executions SET snapshot_json=json_set(snapshot_json,'$.execution.composition.quantizerBoundary.lastIncludedElapsedSeconds',0) WHERE source_id=NEW.source_id;",
      ]) {
        x.f.db.exec(`CREATE TRIGGER quantizer_mutation ${event} WHEN NEW.source_id='native-trigger-tail' BEGIN ${mutation} END;`);
        try { expect(() => x.executions.accept(input.sourceId)).toThrow(); } finally { x.f.db.exec('DROP TRIGGER quantizer_mutation'); }
        expect(rows()).toEqual(before);
      }
    }
    expect(x.executions.accept(input.sourceId).execution.kind).toBe('owned_motion_v2');
  } finally { x.f.close(); }
});

it('rejects a committed peer field dependency change after preflight before inserting the new-variant row', () => {
  const x = nativeFixture();
  try {
    const moment = x.baseField.field.motion.world.moment, input = x.source('native-peer-tail', null,
      { kind: 'retained_quantizer_bucket_v1', throughTick: moment.ball.tick });
    const rows = x.f.db.prepare('SELECT * FROM batted_world_field_executions').all();
    let changed = false;
    const writer = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, { read() {
      if (!changed) { changed = true; x.f.db.prepare("UPDATE batted_world_field_actions SET snapshot_hash='committed-peer-change' WHERE source_id=?").run(x.baseField.source.sourceId); }
      return x.baseField;
    } }, { readAcceptedExecution: () => input }));
    expect(() => writer.accept(input.sourceId)).toThrow();
    expect(changed).toBe(true);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(rows);
  } finally { x.f.close(); }
});
