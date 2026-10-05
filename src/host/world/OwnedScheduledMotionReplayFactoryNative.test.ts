import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import * as execution from './OwnedScheduledMotionExecution';
import * as physical from './BattedWorldFieldPhysicalPrefix';
import * as archive from './OwnedScheduledMotionArchive';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const tiny = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'archive-replay-native-')), 'state.sqlite');
  const x = ownedScheduledMotionFixture(path, 1000);
  try {
    expect(x.f.path).toBe(path);
    expect(x.f.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    expect(x.f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    const plan = x.plan('replay-plan');
    if (plan.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('plan fixture');
    const initialized = x.step('replay-init', plan.source.sourceId,
      { kind: 'operation', planSourceId: plan.source.sourceId, throughElapsedSeconds: plan.execution.plan.contactMoment.elapsedSeconds });
    const p = plan.execution.plan, tps = p.input.response.world.parameters.ticksPerSecond;
    const source = x.stepSource('replay-piece', initialized.source.sourceId, { kind: 'operation', planSourceId: plan.source.sourceId,
      throughElapsedSeconds: (p.contactMoment.ball.tick + 1 - p.contactMoment.originTick) / tps });
    return { x, plan, initialized, source };
  } catch (error) { x.f.close(); throw error; }
};

/** Intercept only real returned identities. The production service still performs
 * every codec and projection; a hit requires the exact row-seeded object. */
const observeWarmReferences = (onHit: () => void = () => {}) => {
  const create = physical.createBattedWorldFieldPhysicalReplay;
  let hits = 0;
  const spy = vi.spyOn(physical, 'createBattedWorldFieldPhysicalReplay').mockImplementation(() => {
    const replay = create(), seeded = new WeakMap<object, ReturnType<typeof replay.snapshotIdentity>>();
    return Object.freeze({ ...replay, snapshotIdentity(value) {
      const identity = replay.snapshotIdentity(value); seeded.set(value, identity); return identity;
    }, reference(value) {
      const prior = seeded.get(value), result = replay.reference(value);
      if (prior && replay.snapshotIdentity(value) === prior && result.snapshotHash === prior.hash) { hits++; onHit(); }
      return result;
    } });
  });
  return { hits: () => hits, restore: () => spy.mockRestore() };
};

it('constructs separate initial, pretransaction, transaction, admission, saved and retry replay factories', () => {
  const { x, source } = tiny();
  const create = execution.createOwnedScheduledMotionExecutionReplay;
  const phases: { encodings: string[]; snapshots: string[]; derives: string[] }[] = [];
  let active: typeof phases[number] | undefined;
  const factories = vi.spyOn(execution, 'createOwnedScheduledMotionExecutionReplay').mockImplementation(() => {
    const replay = create(), phase = { encodings: [] as string[], snapshots: [] as string[], derives: [] as string[] }; phases.push(phase);
    return Object.freeze({ derive(...args) {
      const previous = active; active = phase; phase.derives.push(args[0].sourceId);
      try { return replay.derive(...args); } finally { active = previous; }
    }, snapshotIdentity(value) {
      const previous = active; active = phase; phase.snapshots.push(value.source.sourceId);
      try { return replay.snapshotIdentity(value); } finally { active = previous; }
    } });
  });
  const encode = archive.ownedScheduledMotionArchiveEncoding;
  const encodings = vi.spyOn(archive, 'ownedScheduledMotionArchiveEncoding').mockImplementation(value => {
    active?.encodings.push(value.source.sourceId); return encode(value);
  });
  try {
    const saved = x.executions.accept(source.sourceId);
    expect(phases.map(p => p.snapshots.length)).toEqual([2, 2, 2, 3, 3]);
    expect(phases.map(p => p.derives.length)).toEqual([3, 3, 3, 3, 3]);
    for (const phase of phases) expect(phase.encodings).toEqual(phase.snapshots);
    phases.length = 0;
    expect(x.executions.read(source.sourceId)).toEqual(saved);
    expect(phases.map(p => p.encodings.length)).toEqual([3]);
    phases.length = 0;
    expect(x.executions.accept(source.sourceId)).toEqual(saved);
    expect(phases.map(p => p.encodings.length)).toEqual([3, 3]);
    expect(x.executions).not.toHaveProperty('scopeWithReplay'); expect(x.executions).not.toHaveProperty('executeWithReplay');
  } finally { encodings.mockRestore(); factories.mockRestore(); x.f.close(); }
});

it('rolls back same-writer predecessor and head mutations after row-seeded archive hits at insert and head-update boundaries', () => {
  const { x, source } = tiny(), observed = observeWarmReferences();
  const rows = () => ['batted_world_field_executions', 'batted_world_field_execution_heads']
    .map(table => x.f.db.prepare(`SELECT * FROM ${table} ORDER BY source_id`).all());
  try {
    const before = rows();
    const mutations = [
      { event: 'AFTER INSERT ON batted_world_field_executions',
        sql: "UPDATE batted_world_field_executions SET snapshot_hash='writer-local-change' WHERE source_id='replay-plan';",
        rejection: /corrupt actual field execution snapshot/ },
      { event: 'AFTER UPDATE ON batted_world_field_execution_heads',
        sql: "UPDATE batted_world_field_execution_heads SET source_id='replay-unmatched-head' WHERE source_id=NEW.source_id;",
        rejection: /head|scope|ownership/ },
    ];
    for (const mutation of mutations) {
      const hits = observed.hits();
      x.f.db.exec(`CREATE TRIGGER replay_mutation ${mutation.event} WHEN NEW.source_id='replay-piece' BEGIN ${mutation.sql} END;`);
      try { expect(() => x.executions.accept(source.sourceId)).toThrow(mutation.rejection); }
      finally { x.f.db.exec('DROP TRIGGER replay_mutation'); }
      expect(observed.hits()).toBeGreaterThan(hits); expect(rows()).toEqual(before);
    }
    // Failed writer phases cannot poison the next fresh admission on this store.
    const saved = x.executions.accept(source.sourceId), encoded = archive.ownedScheduledMotionArchiveEncoding(saved);
    expect(saved.execution.kind).toBe('owned_motion_v2'); expect(saved.revision).toBe(3);
    expect(x.executions.read(source.sourceId)).toEqual(saved);
    const after = rows(), inserted = after[0].filter(row => row.source_id === source.sourceId);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ source_id: source.sourceId, previous_source_id: source.previousExecutionSourceId,
      revision: saved.revision, snapshot_json: encoded.json, snapshot_hash: encoded.hash });
    expect(after[0].filter(row => row.source_id !== source.sourceId)).toEqual(before[0]);
    expect(after[1]).toEqual(before[1].map(row => ({ ...row, source_id: source.sourceId, revision: saved.revision })));
  } finally { observed.restore(); x.f.close(); }
});

it('rejects a committed peer mutation after an exact row-seeded hit at the next fresh admission check', () => {
  const { x, plan, initialized, source } = tiny();
  const saved = x.f.db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(plan.source.sourceId)!;
  const heads = x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
  let changed = false;
  const observed = observeWarmReferences(() => {
    if (!changed) {
      changed = true;
      // x.executions owns a separate connection. This is a committed WAL peer write.
      x.f.db.prepare("UPDATE batted_world_field_executions SET snapshot_hash='peer-after-hit' WHERE source_id=?").run(plan.source.sourceId);
    }
  });
  try {
    try {
      expect(() => x.executions.accept(source.sourceId)).toThrow(/corrupt actual field execution snapshot/);
      expect(changed).toBe(true); expect(observed.hits()).toBeGreaterThan(0);
      expect(x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(heads);
      expect(x.f.db.prepare('SELECT source_id FROM batted_world_field_executions WHERE source_id=?').get(source.sourceId)).toBeUndefined();
    } finally {
      observed.restore(); x.f.db.prepare('UPDATE batted_world_field_executions SET snapshot_hash=? WHERE source_id=?').run(saved.snapshot_hash, plan.source.sourceId);
    }
    expect(x.executions.read(initialized.source.sourceId)).toEqual(initialized);
  } finally { x.f.close(); }
});

it('repeats the exact SQL read trace and observes peer WAL corruption only after the pinned snapshot ends', () => {
  const { x, initialized } = tiny(), peer = new DatabaseSync(x.f.path), owner = battedWorldFieldExecutionEvidenceFromSqlite(x.f.db);
  const trace: unknown[] = [], prepare = x.f.db.prepare;
  const queries = vi.spyOn(x.f.db, 'prepare').mockImplementation(function (sql) {
    const statement = prepare.call(x.f.db, sql);
    return new Proxy(statement, { get(target, key) {
      const value = Reflect.get(target, key);
      return typeof value !== 'function' ? value : (...args: unknown[]) => {
        trace.push([sql, key, args]); return value.apply(target, args);
      };
    } });
  });
  try {
    x.f.db.exec('BEGIN');
    const first = owner.read(initialized.source.sourceId), firstTrace = [...trace]; trace.length = 0;
    expect(owner.read(initialized.source.sourceId)).toEqual(first); expect(trace).toEqual(firstTrace);
    peer.prepare("UPDATE batted_world_field_executions SET snapshot_hash='peer-pinned-change' WHERE source_id=?").run(initialized.source.sourceId);
    expect(owner.read(initialized.source.sourceId)).toEqual(first);
    x.f.db.exec('COMMIT; BEGIN'); expect(() => owner.read(initialized.source.sourceId)).toThrow(/corrupt actual field execution snapshot/);
  } finally { queries.mockRestore(); if (x.f.db.isTransaction) x.f.db.exec('ROLLBACK'); peer.close(); x.f.close(); }
});
