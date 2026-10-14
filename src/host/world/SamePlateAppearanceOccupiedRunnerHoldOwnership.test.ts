import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
import { expect, it, vi } from 'vitest';
import { batterRunArchiveFromSqlite } from './BatterRunSourceArchive';
import * as archive from './BatterRunSourceArchive';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { actorFreeze as freeze, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { readSamePaOccupiedRunnerHoldFromSqlite as readHold, readSamePaOccupiedRunnerHolds as readHolds,
  type DurableSamePaOccupiedRunnerHold } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';

it.each(['source_json', 'snapshot_json'] as const)('OH03 a surviving posture %s hold reference prevents absent-owner repair', column => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE batting_observation_v1_postures(source_json TEXT,snapshot_json TEXT)');
    const reference = { owner: 'world_same_pa_occupied_runner_holds', sourceId: 'deleted-hold', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
    const source = { occupiedRunnerHoldReferences: [reference] };
    db.prepare('INSERT INTO batting_observation_v1_postures VALUES(?,?)').run(column === 'source_json' ? JSON.stringify(source) : '{}',
      column === 'snapshot_json' ? JSON.stringify({ source }) : '{}');
    const before = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
    db.exec('PRAGMA query_only=1; BEGIN');
    const owner = batterRunArchiveFromSqlite(db, 'world_same_pa_occupied_runner_holds' as any,
      { input: (x: any) => x, derive: (source: any) => ({ source }), key: s => s.sourceId, scope: () => ({ sql: '0', values: [] }) });
    expect(() => owner.read('deleted-hold')).toThrow('surviving typed');
    expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(before);
    db.exec('ROLLBACK');
  } finally { db.close(); }
});
it.each(['pa_lifecycle_v1_outcomes', 'pa_lifecycle_v1_resets'])('OH04 a surviving %s retirement keeps its original hold claimed', table => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE ${table}(source_json TEXT,snapshot_json TEXT)`);
    const sourceReference = { owner: 'world_same_pa_occupied_runner_holds', sourceId: 'deleted-hold', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
    const basis = { participants: [{ ownedCommands: [{ sourceReference }] }] };
    const snapshot = table === 'pa_lifecycle_v1_outcomes' ? { controllerRetirementBasis: basis } : { retirement: { basis } };
    db.prepare(`INSERT INTO ${table} VALUES(?,?)`).run('{}', JSON.stringify(snapshot));
    const before = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
    db.exec('PRAGMA query_only=1; BEGIN');
    const owner = batterRunArchiveFromSqlite(db, 'world_same_pa_occupied_runner_holds',
      { input: (x: any) => x, derive: (source: any) => ({ source }), key: s => s.sourceId, scope: () => ({ sql: '0', values: [] }) });
    expect(() => owner.read('deleted-hold')).toThrow('surviving typed');
    expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(before);
    db.exec('ROLLBACK');
  } finally { db.close(); }
});
it.each(['source', 'source_mirror', 'result'] as const)('OH05 surviving %s received-response hold reference prevents absent-owner repair', arm => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE pa_physical_v1_field_steps(source_json TEXT,snapshot_json TEXT)');
    const holdReference = {owner:'world_same_pa_occupied_runner_holds',sourceId:'deleted-hold',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)};
    const source = {action:{kind:'occupied_runner_catch_response_v1',holdReference}};
    const snapshot = arm === 'source_mirror' ? {source} : arm === 'result' ? {actionResult:{kind:'occupied_runner_catch_response_v1',holdReference}} : {};
    db.prepare('INSERT INTO pa_physical_v1_field_steps VALUES(?,?)').run(arm === 'source' ? JSON.stringify(source) : '{}',JSON.stringify(snapshot));
    db.exec('PRAGMA query_only=1; BEGIN');
    const owner = batterRunArchiveFromSqlite(db,'world_same_pa_occupied_runner_holds',
      {input:(x:any)=>x,derive:(source:any)=>({source}),key:s=>s.sourceId,scope:()=>({sql:'0',values:[]})});
    expect(()=>owner.read('deleted-hold')).toThrow('surviving typed response');
    db.exec('ROLLBACK');
  } finally { db.close(); }
});

/** Earlier archive reconstruction is the explicit fixture boundary. Native
 * snapshot lifetime, main-owner guard, full-reference checks and each caller's
 * finite runner coverage are real. This is not a physical owner qualification. */
const holdReadFixture = () => {
  const db = new DatabaseSync(':memory:');
  const actor = freeze({ source: { sourceId: 'actor' }, world: { tick: 100, runners: [{ playerId: 'runner' }] } });
  const enrollmentReference = { owner: 'same_pa_enrollments' as const, sourceId: 'enrollment', sourceHash: hash('enrollment'), snapshotHash: hash('enrollment-result') };
  const saved = freeze({ source: { sourceId: 'hold', playerId: 'runner', enrollmentReference,
    intent: { kind: 'hold', issuedTick: 100 }, coverageThroughTick: 500 }, actorReference: reference('physical_plate_appearance_actors', actor),
    actors: [{ primitive: { endTick: 500 } }] }) as unknown as DurableSamePaOccupiedRunnerHold;
  vi.spyOn(archive, 'batterRunArchiveFromSqlite').mockImplementation(((connection, table) => {
    expect(table).toBe('world_same_pa_occupied_runner_holds');
    return { read: (id: string) => {
      assertBodyCompositionNativeConnection(connection);
      return id === saved.source.sourceId ? freeze(structuredClone(saved)) : null;
    }, assertScope: () => {} };
  }) as typeof archive.batterRunArchiveFromSqlite);
  const pin = reference('world_same_pa_occupied_runner_holds', saved);
  const phase = <T>(body: () => T) => withSqliteReadTransaction(db, () => withSamePaLifecycleReadPhase(db, body));
  const coverage = (throughTick = 500) => readHolds(db, actor as never, enrollmentReference, [pin], 100, throughTick);
  return { db, pin, phase, coverage, close: () => { vi.restoreAllMocks(); db.close(); } };
};

it('OH06 shares only the exact completed hold within a phase and keeps finite coverage at each caller', () => {
  const x = holdReadFixture();
  try {
    const first = x.phase(() => {
      const value = readHold(x.db, x.pin);
      expect(readHold(x.db, { ...x.pin })).toBe(value);
      expect(x.coverage()[0]).toBe(value);
      expect(() => { (value.actors[0].primitive as { endTick: number }).endTick = 900; }).toThrow(TypeError);
      return value;
    });
    const retry = x.phase(() => readHold(x.db, x.pin));
    expect(retry).toEqual(first); expect(retry).not.toBe(first);
    expect(() => x.phase(() => { readHold(x.db, x.pin); x.coverage(501); })).toThrow(/coverage exhausted/);
    expect(x.phase(x.coverage)[0]).toEqual(first);
    expect(() => readHold(x.db, x.pin)).toThrow(/query-only ownership/);
  } finally { x.close(); }
});

it('OH07 rejects changed complete hold references and expires caught invalid requests', () => {
  const x = holdReadFixture();
  try {
    for (const changed of [
      { ...x.pin, sourceId: 'missing' }, { ...x.pin, sourceHash: hash('changed-source') },
      { ...x.pin, snapshotHash: hash('changed-result') }, { ...x.pin, owner: 'same_pa_enrollments' },
    ]) expect(() => x.phase(() => {
      readHold(x.db, x.pin);
      expect(() => readHold(x.db, changed as typeof x.pin)).toThrow(/missing|differs|invalid/);
      expect(() => readHold(x.db, x.pin)).toThrow(/expired/);
    })).toThrow(/^(?:same-PA continuation phase|lifecycle proof) expired$/);
    expect(x.phase(() => readHold(x.db, x.pin)).source.sourceId).toBe('hold');
  } finally { x.close(); }
});

it('OH08 rejects attached owners on a warm hold and authenticates a new retry after detach', () => {
  const x = holdReadFixture();
  try {
    expect(() => x.phase(() => {
      readHold(x.db, x.pin); x.db.exec("ATTACH DATABASE ':memory:' AS peer");
      expect(() => readHold(x.db, x.pin)).toThrow(/original main owners/);
      expect(() => readHold(x.db, x.pin)).toThrow(/expired/);
    })).toThrow(/^(?:same-PA continuation phase|lifecycle proof) expired$/);
    x.db.exec('DETACH DATABASE peer');
    expect(x.phase(() => readHold(x.db, x.pin)).source.sourceId).toBe('hold');
  } finally { x.close(); }
});
