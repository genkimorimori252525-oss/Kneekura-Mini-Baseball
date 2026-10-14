import { afterEach, expect, it, vi } from 'vitest';
import { bodyMaterializationFixture, materialized } from './PlayerBodyCapabilityMaterializationFixtures.test-support';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from './PlayerBodyCapabilityMaterializationEvidence';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const fixtures: ReturnType<typeof bodyMaterializationFixture>[] = [];
afterEach(() => { vi.restoreAllMocks(); fixtures.splice(0).reverse().forEach(f => f.close()); });
const setup = () => { const f = bodyMaterializationFixture(); fixtures.push(f); materialized(f); return f; };

it('authenticates the complete body archive once across sibling readers of one immutable proof', () => {
  const f = setup(), prepare = f.db.prepare.bind(f.db); let identities = 0;
  vi.spyOn(f.db, 'prepare').mockImplementation(sql => {
    if (sql.startsWith('SELECT * FROM main.world_player_body_materializations WHERE source_id=?')) identities++;
    return prepare(sql);
  });
  const read = () => playerBodyCapabilityMaterializationEvidenceFromSqlite(f.db).readArchive(f.request.sourceId);
  const first = withSqliteReadTransaction(f.db, () => withSamePaContinuationReadPhase(f.db, () => {
    const value = read(); expect(read()).toEqual(value); expect(identities).toBe(1); return value;
  }));
  expect(withSqliteReadTransaction(f.db, () => withSamePaContinuationReadPhase(f.db, read))).toEqual(first);
  expect(identities).toBe(2);
});

it('rechecks the original Person after a completed body proof', () => {
  const f = setup(), read = () => withSqliteReadTransaction(f.db, () => withSamePaContinuationReadPhase(f.db,
    () => playerBodyCapabilityMaterializationEvidenceFromSqlite(f.db).readArchive(f.request.sourceId)));
  expect(read()?.person).toEqual(f.person);
  const row = f.db.prepare('SELECT source_json FROM world_player_person_links WHERE source_id=?').get(f.person.sourceId)!;
  const changed = { ...JSON.parse(String(row.source_json)), sourceRecordId: 'changed-original-record' };
  f.db.prepare('UPDATE world_player_person_links SET source_json=? WHERE source_id=?').run(actorJson(changed), f.person.sourceId);
  expect(read).toThrow();
  expect(f.db.isTransaction).toBe(false); expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
});

it('rejects a non-string identity before it can address a completed body proof', () => {
  const f = setup(); let coerced = false;
  expect(() => withSqliteReadTransaction(f.db, () => withSamePaContinuationReadPhase(f.db, () => {
    const owner = playerBodyCapabilityMaterializationEvidenceFromSqlite(f.db);
    owner.readArchive(f.request.sourceId);
    return owner.readArchive({ toString() { coerced = true; return f.request.sourceId; } } as unknown as string);
  }))).toThrow('invalid body materialization identity');
  expect(coerced).toBe(false);
});

it.each(['mutation', 'attached-owner'] as const)('poisons body reuse after a caught %s inside the proof', fault => {
  const f = setup(), read = () => playerBodyCapabilityMaterializationEvidenceFromSqlite(f.db).readArchive(f.request.sourceId);
  expect(() => withSqliteReadTransaction(f.db, () => withSamePaContinuationReadPhase(f.db, () => {
    read();
    f.db.exec(fault === 'mutation'
      ? "PRAGMA query_only=0; UPDATE world_player_body_materializations SET snapshot_hash='changed'; PRAGMA query_only=1"
      : "ATTACH ':memory:' AS foreign_owner");
    expect(read).toThrow();
    if (fault === 'attached-owner') f.db.exec('DETACH foreign_owner');
    expect(read).toThrow(/expired/);
  }))).toThrow(/expired/);
  expect(withSqliteReadTransaction(f.db, () => withSamePaContinuationReadPhase(f.db, read))?.source).toEqual(f.request);
});
