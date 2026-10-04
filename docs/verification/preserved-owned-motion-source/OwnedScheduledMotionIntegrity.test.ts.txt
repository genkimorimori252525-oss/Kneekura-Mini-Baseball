import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('pins operation and ordered step manifests while excluding future opaque payloads from a bounded read', () => {
  const x = ownedScheduledMotionFixture(undefined, 1000);
  try {
    const planned = x.plan('bounded-owned-plan');
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('plan');
    const plan = planned.execution.plan;
    let current = x.step('bounded-owned-init', planned.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.contactMoment.elapsedSeconds });
    const count = 32, duration = (plan.secureElapsedSeconds - plan.contactMoment.elapsedSeconds) / (count + 3);
    const originalSelves = x.selves(current.source.sourceId), knownWork = x.knownWork();
    for (let i = 1; i <= count; i++) {
      if (current.execution.kind !== 'owned_motion_v2') throw new Error('recorded current cut');
      // These references come from the preceding actual result. The writer still
      // rederives each exact self before acceptance; the fixture avoids an extra replay.
      const through = current.execution.adoption.executedThrough;
      const source = { ...x.source, sourceId: `bounded-owned-piece-${i}`, previousExecutionSourceId: current.source.sourceId,
        action: { kind: 'owned_motion_v2' as const, checkpoint: { kind: 'operation' as const, planSourceId: planned.source.sourceId,
          throughElapsedSeconds: plan.contactMoment.elapsedSeconds + duration * i }, knownWork,
          contributions: originalSelves.map(self => ({ kind: 'retained' as const, playerId: self.playerId,
            command: { ...self.activeCommand, executedThrough: through } })) } };
      x.sources.set(source.sourceId, source); const started = Date.now(); current = x.executions.accept(source.sourceId);
      if (process.env.OWNED_TIMINGS) console.info('owned-native-retained-step', i, Date.now() - started);
    }
    if (current.execution.kind !== 'owned_motion_v2' || current.execution.operation?.kind !== 'acquisition') throw new Error('progress');
    const operation = current.execution.operation;
    expect(operation.planReference).toEqual({ sourceId: planned.source.sourceId, sourceHash: actorHash(planned.source), snapshotHash: ownedScheduledMotionArchiveHash(planned) });
    expect(operation.previousSteps).toHaveLength(count);
    expect(operation.previousSteps.every(s => Object.keys(s).sort().join('|') === 'snapshotHash|sourceHash|sourceId')).toBe(true);
    const historySource = { ...x.source, sourceId: 'bounded-owned-whole-history', previousExecutionSourceId: current.source.sourceId,
      action: { kind: 'whole_play_history' as const } };
    x.sources.set(historySource.sourceId, historySource); current = x.executions.accept(historySource.sourceId);
    if (current.execution.kind !== 'whole_play_history') throw new Error('whole history');
    const nodeCount = (value: unknown): number => value !== null && typeof value === 'object'
      ? 1 + Object.values(value).reduce<number>((sum, item) => sum + nodeCount(item), 0) : 1;
    expect(nodeCount(current.execution.physicalHistory)).toBeGreaterThan(100_000);
    const archivedHistory = x.f.db.prepare('SELECT snapshot_json FROM batted_world_field_executions WHERE source_id=?').get(current.source.sourceId)!;
    const wire = JSON.parse(String(archivedHistory.snapshot_json));
    expect(wire.snapshotFormat).toBe('owned_scheduled_field_execution_manifest_v1');
    expect(wire.execution.physicalHistory.format).toBe('owned_scheduled_whole_history_manifest_v1');
    expect(wire.execution.physicalHistory.physicalSteps.every((record: object) => Object.keys(record).sort().join('|') === 'recordHash|source')).toBe(true);
    expect(nodeCount(wire)).toBeLessThan(100_000);
    const observer = installSyntheticObservation(x, plan.acquirerPlayerId, current.source.sourceId), observed = observer.observations.accept(observer.observationSource.sourceId);
    expect(observed.physicalPrefixHashConvention).toBe('owned_motion_observation_prefix_manifest_v1');
    const rows = x.f.db.prepare('SELECT * FROM actual_field_observations').all();
    const archiveDirectory = process.env.OWNED_SCHEDULED_ARCHIVE_DIR;
    if (archiveDirectory) {
      // Opt-in test evidence only: preserve actual accepted rows before any of the
      // deliberate corruption below. VACUUM INTO refuses an existing artifact.
      const testedSourceSha256 = process.env.OWNED_SCHEDULED_TEST_SOURCE_SHA256;
      expect(testedSourceSha256).toMatch(/^[a-f0-9]{64}$/);
      const database = join(archiveDirectory, 'owned-scheduled-32-step.sqlite');
      const tables = x.f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all().map(row => String(row.name));
      const allRows = tables.map(table => ({ table, rows: x.f.db.prepare(`SELECT * FROM "${table.replaceAll('"', '""')}"`).all() }));
      x.f.db.prepare('VACUUM INTO ?').run(database);
      const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
      writeFileSync(join(archiveDirectory, 'owned-scheduled-32-step.json'), JSON.stringify({
        testedSourceSha256, runtime: process.version, optIn: 'OWNED_SCHEDULED_ARCHIVE_DIR',
        database: 'owned-scheduled-32-step.sqlite', databaseSha256: sha256(readFileSync(database)),
        physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
        baseFieldSourceId: x.baseField.source.sourceId, planSourceId: planned.source.sourceId,
        executionSourceId: current.source.sourceId, observationSourceId: observed.source.sourceId,
        fixtureInputs: { capturePower: 1000, retainedStepCount: count, contactElapsedSeconds: .01 },
        tables: allRows, rowsSha256: sha256(JSON.stringify(allRows)),
      }, null, 2), { flag: 'wx' });
    }
    const future = x.step('bounded-owned-future', current.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.contactMoment.elapsedSeconds + duration * (count + 1) });
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(current.source.sourceId)).toEqual(current);
    expect(reopened.accept(current.source.sourceId)).toEqual(current);
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='opaque-future',snapshot_json='opaque-future' WHERE source_id=?").run(future.source.sourceId);
    expect(reopened.read(current.source.sourceId)).toEqual(current);
    expect(observer.observations.read(observed.source.sourceId)).toEqual(observed);
    expect(x.f.db.prepare('SELECT * FROM actual_field_observations').all()).toEqual(rows);
    expect(() => reopened.read(future.source.sourceId)).toThrow();
    x.f.db.prepare('UPDATE batted_world_field_execution_heads SET revision=revision+1').run();
    expect(() => reopened.read(current.source.sourceId)).toThrow(/head/);
    expect(() => observer.observations.read(observed.source.sourceId)).toThrow(/head/);
  } finally { x.f.close(); }
});

it('rejects self/forward operation links before replay and rejects accessor, duplicate and injected contribution containers', () => {
  const x = ownedScheduledMotionFixture();
  try {
    const planned = x.plan('rank-owned-plan');
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('plan');
    const source = x.stepSource('rank-owned-step', planned.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: planned.execution.plan.contactMoment.elapsedSeconds });
    if (source.action.kind !== 'owned_motion_v2' || source.action.checkpoint.kind !== 'operation') throw new Error('source');
    const before = x.f.db.prepare('SELECT * FROM batted_world_field_executions').all();
    const action = source.action;
    let read = false;
    const variants = [
      { ...action, checkpoint: { ...action.checkpoint, planSourceId: source.sourceId } },
      { ...action, checkpoint: { ...action.checkpoint, planSourceId: 'future-plan' } },
      { ...action, get contributions() { read = true; return action.contributions; } },
      { ...action, contributions: [...action.contributions.slice(1), action.contributions[1]] },
      { ...action, contributions: action.contributions.map((c, i) => i ? c : { ...c, actors: [] }) },
      { ...action, plan: planned.execution.plan },
    ];
    for (const variant of variants) {
      x.sources.set(source.sourceId, { ...source, action: variant } as typeof source);
      let error: unknown;
      try { x.executions.accept(source.sourceId); } catch (e) { error = e; }
      expect(error).toBeInstanceOf(Error); expect(error).not.toBeInstanceOf(RangeError);
      expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(before);
    }
    expect(read).toBe(false);
  } finally { x.f.close(); }
});

import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('rejects missing, reordered and forged compact references and discovers an otherwise foreign manifest pitch claim', () => {
  const x = ownedScheduledMotionFixture();
  try {
    const planned = x.plan('manifest-owned-plan');
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('plan');
    const initialized = x.step('manifest-owned-init', planned.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: planned.execution.plan.contactMoment.elapsedSeconds });
    const saved = x.f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(initialized.source.sourceId)!;
    const original = JSON.parse(String(saved.snapshot_json));
    expect(original.snapshotFormat).toBe('owned_scheduled_field_execution_manifest_v1');
    const missing = structuredClone(original); delete missing.history[0].sourceHash;
    const variants = [missing, { ...original, history: [...original.history].reverse() },
      { ...original, baseField: { ...original.baseField, snapshotHash: 'forged-base-snapshot' } },
      { ...original, execution: { ...original.execution, operation: { ...original.execution.operation,
        planReference: { ...original.execution.operation.planReference, snapshotHash: 'forged-plan-reference' } } } }];
    for (const value of variants) {
      x.f.db.prepare('UPDATE batted_world_field_executions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
        .run(actorJson(value), actorHash(value), initialized.source.sourceId);
      expect(() => x.executions.read(initialized.source.sourceId)).toThrow(/metadata|history|snapshot|shape|corrupt|ownership/);
      x.f.db.prepare('UPDATE batted_world_field_executions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
        .run(saved.snapshot_json, saved.snapshot_hash, initialized.source.sourceId);
    }
    expect(x.executions.read(initialized.source.sourceId)).toEqual(initialized);
    const planWire = JSON.parse(String(x.f.db.prepare('SELECT snapshot_json FROM batted_world_field_executions WHERE source_id=?').get(planned.source.sourceId)!.snapshot_json));
    const foreignSource = { ...planned.source, sourceId: 'foreign-manifest-owner', baseFieldSourceId: 'foreign-field', previousExecutionSourceId: null };
    const foreign = { ...planWire, source: foreignSource, baseField: { ...planWire.baseField,
      source: { ...planWire.baseField.source, sourceId: 'foreign-field' } }, history: [{ sourceId: foreignSource.sourceId,
        sourceVersion: foreignSource.sourceVersion, baseFieldSourceId: foreignSource.baseFieldSourceId,
        previousExecutionSourceId: null, sourceHash: actorHash(foreignSource) }] };
    // Its only claim into this pitch is the new compact physicalPitchSourceId mirror.
    x.f.db.prepare('INSERT INTO batted_world_field_executions VALUES (?,?,?,?,?,?,?,?,?,?)').run(foreignSource.sourceId,
      'foreign-pitch', 'foreign-field', null, 1, x.baseField.response.model.gameId, actorJson(foreignSource), actorHash(foreignSource), actorJson(foreign), actorHash(foreign));
    x.f.db.prepare('INSERT INTO batted_world_field_execution_heads VALUES (?,?,?,?)').run('foreign-pitch', 'foreign-field', foreignSource.sourceId, 1);
    expect(() => x.executions.read(initialized.source.sourceId)).toThrow(/head|metadata|ownership|prefix/);
    x.f.db.prepare('DELETE FROM batted_world_field_execution_heads WHERE source_id=?').run(foreignSource.sourceId);
    x.f.db.prepare('DELETE FROM batted_world_field_executions WHERE source_id=?').run(foreignSource.sourceId);
    expect(x.executions.read(initialized.source.sourceId)).toEqual(initialized);
  } finally { x.f.close(); }
});
