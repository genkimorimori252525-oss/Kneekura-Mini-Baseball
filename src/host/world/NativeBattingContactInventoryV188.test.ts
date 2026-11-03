import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import * as actorOwner from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as samePaOwner from './NativeMeasuredBattingContactV182';
import * as initialOwner from './NativeMeasuredInitialJointContactV184';
import { createWorldBoundOriginalContactV187 } from './WorldBoundOriginalContactV187.test-support';
import { readNativeBattingContactInventoryV188FromSqlite as read } from './NativeBattingContactInventoryV188';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  const root = realpathSync(tmpdir());
  for (const path of directories.splice(0)) {
    const target = realpathSync(path);
    if (!target.startsWith(root + sep) || !basename(target).startsWith('native-inventory-v188-')) throw new Error('inventory cleanup escaped its fixture directory');
    rmSync(target, { recursive: true, force: true });
  }
});

it.each(['pa_physical_v1_resolutions', 'pa_initial_joint_v1_executions'] as const)(
  'NI188-U06 routes a %s row with destroyed snapshot claims through its independent enrollment index', owner => {
    // Explicit metadata/getter doubles exercise candidate selection only.
    // They confer no Native contact, actor or enrollment authority.
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(`CREATE TABLE physical_plate_appearance_actors(source_id TEXT,game_id TEXT,player_id TEXT,source_json TEXT,snapshot_json TEXT);
        CREATE TABLE same_pa_enrollments(source_id TEXT,game_id TEXT,actor_source_id TEXT,source_json TEXT,snapshot_json TEXT);
        CREATE TABLE ${owner}(source_id TEXT,source_hash TEXT,snapshot_hash TEXT,enrollment_source_id TEXT,source_json TEXT,snapshot_json TEXT)`);
      db.prepare('INSERT INTO physical_plate_appearance_actors VALUES(?,?,?,?,?)').run('actor','game','batter',
        JSON.stringify({ playerId: 'batter', gameId: 'game' }), JSON.stringify({ binding: { careerId: 'career', playerId: 'batter', gameId: 'game' } }));
      db.prepare('INSERT INTO same_pa_enrollments VALUES(?,?,?,?,?)').run('enrollment','game','actor','{}','{}');
      db.prepare(`INSERT INTO ${owner} VALUES(?,?,?,?,?,?)`).run('broken','a'.repeat(64),'b'.repeat(64),'enrollment','{}','{}');
      vi.spyOn(actorOwner, 'readPhysicalPlateAppearanceActorFromSqlite').mockReturnValue({ source: { sourceId: 'actor' },
        binding: { careerId: 'career', playerId: 'batter', gameId: 'game' } } as never);
      const getter = owner === 'pa_physical_v1_resolutions'
        ? vi.spyOn(samePaOwner, 'readNativeMeasuredBattingContactV182FromSqlite')
        : vi.spyOn(initialOwner, 'readNativeMeasuredInitialJointContactV184FromSqlite');
      getter.mockImplementation(() => { throw new Error('normal owner rejects destroyed archive'); });
      expect(() => read(db, { careerId: 'career', playerId: 'batter' })).toThrow('normal owner rejects destroyed archive');
      expect(getter).toHaveBeenCalledTimes(1);
      db.prepare(`UPDATE ${owner} SET snapshot_json=?`).run('{invalid');
      expect(() => read(db, { careerId: 'career', playerId: 'batter' })).toThrow('normal owner rejects destroyed archive');
    } finally { db.close(); }
  },
);
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'native-inventory-v188-')); directories.push(directory);
  const path = join(directory, 'match.sqlite'); return { path, expected: createWorldBoundOriginalContactV187(path) };
};

it('NI188-N01 discovers the actual subject contact through normal Native owners without caller-supplied refs', () => {
  const x = fixture(), db = new DatabaseSync(x.path);
  try {
    db.exec('BEGIN; SAVEPOINT caller_inventory');
    const before = db.prepare('SELECT total_changes() n').get()!.n, input = { ...x.expected.scope }, first = read(db, input);
    expect(first.boundary).toBe('NATIVE_CONTACT_INVENTORY_ONLY'); expect(first.scope).toStrictEqual(x.expected.scope);
    expect(first.references).toStrictEqual([x.expected.reference]); expect(first.producerAvailability.physical_pitch_progress_actions).toBe('PRESENT');
    expect(first.inventoryHash).toMatch(/^[a-f0-9]{64}$/); expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.references[0])).toBe(true); expect(Object.isFrozen(input)).toBe(false);
    db.exec('PRAGMA query_only=1'); const second = read(db, input);
    expect(second).toStrictEqual(first); expect(second.references[0]).not.toBe(first.references[0]);
    expect(read(db, { playerId: input.playerId, careerId: input.careerId }).inventoryHash).toBe(first.inventoryHash);
    expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1); expect(db.isTransaction).toBe(true);
    expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(before);
    db.exec('RELEASE caller_inventory; ROLLBACK');
  } finally { db.close(); }
});

it('NI188-N02 retains an empty inventory for a subject with no authenticated actor instead of borrowing another subject', () => {
  const x = fixture(), db = new DatabaseSync(x.path);
  try {
    const first = read(db, { ...x.expected.scope, playerId: 'not-the-actual-batter' });
    const second = read(db, { ...x.expected.scope, careerId: 'another-career' });
    expect(first.references).toEqual([]); expect(second.references).toEqual([]);
    expect(first.inventoryHash).not.toBe(second.inventoryHash);
    expect(db.isTransaction).toBe(false); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { db.close(); }
});

it('NI188-N03 refuses a modified producer reference and recovers after caller rollback without consuming physical records', () => {
  const x = fixture(), db = new DatabaseSync(x.path);
  try {
    const original = read(db, x.expected.scope);
    db.exec('BEGIN');
    db.prepare('UPDATE main.physical_pitch_progress_actions SET snapshot_hash=? WHERE source_id=?').run('0'.repeat(64), x.expected.reference.sourceId);
    expect(() => read(db, x.expected.scope)).toThrow(); expect(db.isTransaction).toBe(true);
    db.exec('ROLLBACK'); expect(read(db, x.expected.scope)).toStrictEqual(original);
    expect(() => read(db, { ...x.expected.scope, playerId: '' })).toThrow();
    expect(() => read({ prepare: db.prepare.bind(db) } as InstanceType<typeof DatabaseSync>, x.expected.scope)).toThrow();
  } finally { db.close(); }
});

it('NI188-N04 refuses a producer scope mirror changed to hide an actual subject contact', () => {
  const x = fixture(), db = new DatabaseSync(x.path);
  try {
    db.exec('BEGIN');
    db.prepare('UPDATE main.physical_pitch_progress_actions SET game_id=? WHERE source_id=?').run('wrong-game', x.expected.reference.sourceId);
    expect(() => read(db, x.expected.scope)).toThrow();
    db.exec('ROLLBACK');
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});

it('NI188-N05 does not authenticate unrelated corrupt actors from another career sharing a player ID', () => {
  const x = fixture(), db = new DatabaseSync(x.path);
  try {
    const before = read(db, x.expected.scope);
    const row = db.prepare('SELECT * FROM main.physical_plate_appearance_actors LIMIT 1').get()!;
    const source = JSON.parse(String(row.source_json)), snapshot = JSON.parse(String(row.snapshot_json));
    source.sourceId = 'foreign-career-actor'; source.gameId = 'foreign-game';
    snapshot.source = source; snapshot.binding.careerId = 'foreign-career'; snapshot.binding.gameId = 'foreign-game';
    db.prepare('INSERT INTO main.physical_plate_appearance_actors(source_id,source_version,game_id,play_id,player_id,source_json,source_hash,snapshot_json,snapshot_hash) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(source.sourceId, row.source_version, source.gameId, row.play_id, row.player_id, JSON.stringify(source), '0'.repeat(64), JSON.stringify(snapshot), '0'.repeat(64));
    expect(read(db, x.expected.scope)).toStrictEqual(before);
  } finally { db.close(); }
});
