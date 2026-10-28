import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';
import { assertNativeSpinNeutralV193Join } from './NativeSpinNeutralV193-frontier';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';

// Synthetic join values exercise a comparison boundary only, never Native authority.
it('NSN193-G01 rejects each mismatched Actor, lineage or launch join', () => {
  const actor = { source: { sourceId: 'actor' } }, actorReference = reference('physical_plate_appearance_actors', actor);
  const physicalPitchReference = { owner: 'pa_physical_v1_launches', sourceId: 'launch', sourceHash: 's', snapshotHash: 'h' };
  const lineage = { actorReference, firstPhysicalPitchSourceId: 'first' };
  const physical = { actor, lineage, physicalPitchReference } as Parameters<typeof assertNativeSpinNeutralV193Join>[1];
  const observation = { lineage, source: { physicalPitchReference } };
  expect(() => assertNativeSpinNeutralV193Join(actorReference, physical, observation)).not.toThrow();
  expect(() => assertNativeSpinNeutralV193Join(actorReference, { ...physical, actor: { ...actor, source: { sourceId: 'other' } } } as typeof physical, observation)).toThrow(/join/);
  expect(() => assertNativeSpinNeutralV193Join(actorReference, { ...physical, lineage: { ...lineage, actorReference: { ...actorReference, sourceId: 'other' } } } as typeof physical, observation)).toThrow(/join/);
  expect(() => assertNativeSpinNeutralV193Join(actorReference, physical, { ...observation, lineage: { ...lineage, firstPhysicalPitchSourceId: 'other' } })).toThrow(/join/);
  expect(() => assertNativeSpinNeutralV193Join(actorReference, physical, { ...observation, source: { physicalPitchReference: { ...physicalPitchReference, sourceId: 'other' } } })).toThrow(/join/);
});

it('NSN193-G02 hashes rowid values even when all stored columns match', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const a = new DatabaseSync(':memory:'), b = new DatabaseSync(':memory:');
  try {
    for (const db of [a, b]) db.exec('CREATE TABLE samples(value TEXT, "__native_spin_rowid_v193__" INTEGER)');
    a.exec("INSERT INTO samples(rowid,value,\"__native_spin_rowid_v193__\") VALUES(1,'same',9)");
    b.exec("INSERT INTO samples(rowid,value,\"__native_spin_rowid_v193__\") VALUES(2,'same',9)");
    expect(rawNativeSpinNeutralSqlDigestV193(a).catalog).toStrictEqual(rawNativeSpinNeutralSqlDigestV193(b).catalog);
    expect(rawNativeSpinNeutralSqlDigestV193(a).tables.samples.sha256).not.toBe(rawNativeSpinNeutralSqlDigestV193(b).tables.samples.sha256);
  } finally { a.close(); b.close(); }
});

it('NSN193-G03 preserves WITHOUT ROWID primary-key ordering and typed values', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const a = new DatabaseSync(':memory:'), b = new DatabaseSync(':memory:');
  try {
    for (const db of [a, b]) db.exec('CREATE TABLE samples(id TEXT PRIMARY KEY,value BLOB) WITHOUT ROWID');
    a.exec("INSERT INTO samples VALUES('b',X'01'),('a',X'02')");
    b.exec("INSERT INTO samples VALUES('a',X'02'),('b',X'01')");
    expect(rawNativeSpinNeutralSqlDigestV193(a)).toStrictEqual(rawNativeSpinNeutralSqlDigestV193(b));
  } finally { a.close(); b.close(); }
});

it('NSN193-G04 does not mistake a DEFAULT string for the actual WITHOUT ROWID schema attribute', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const a = new DatabaseSync(':memory:'), b = new DatabaseSync(':memory:');
  try {
    for (const db of [a, b]) db.exec("CREATE TABLE samples(value TEXT DEFAULT 'WITHOUT ROWID')");
    a.exec("INSERT INTO samples(rowid,value) VALUES(1,'same')");
    b.exec("INSERT INTO samples(rowid,value) VALUES(2,'same')");
    expect(rawNativeSpinNeutralSqlDigestV193(a).tables.samples.rowIdentity).toBe('ROWID');
    expect(rawNativeSpinNeutralSqlDigestV193(a).tables.samples.sha256).not.toBe(rawNativeSpinNeutralSqlDigestV193(b).tables.samples.sha256);
  } finally { a.close(); b.close(); }
});

it('NSN193-G05 retains a real table named __proto__ as its own digest entry', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE "__proto__"(value TEXT)');
    db.exec("INSERT INTO \"__proto__\" VALUES('original')");
    const digest = rawNativeSpinNeutralSqlDigestV193(db);
    expect(Object.hasOwn(digest.tables, '__proto__')).toBe(true);
    expect(Object.keys(digest.tables)).toStrictEqual(['__proto__']);
    expect(digest.tables.__proto__.rows).toBe(1);
  } finally { db.close(); }
});
