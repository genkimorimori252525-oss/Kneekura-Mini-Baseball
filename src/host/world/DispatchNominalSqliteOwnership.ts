import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
export const nominalTable = (db: DatabaseSync, table: string): void => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native)) throw new Error('dispatch nominal evidence requires Native connection');
  assertBodyCompositionNativeConnection(db);
  const rows = db.prepare('SELECT name,type FROM main.sqlite_master WHERE lower(name)=lower(?)').all(table);
  if (rows.length !== 1 || rows[0].name !== table || rows[0].type !== 'table') throw new Error('dispatch nominal original namespace differs');
};
export const nominalClaim = (doc: string, path: Parameters<typeof nodes>[1], param: string) =>
  `EXISTS(SELECT 1 FROM (${nodes(doc, path)}) n WHERE n.type='text' AND n.atom=${param})`;
export const nominalIdentity = (db: DatabaseSync, tables: readonly string[], owner: string, id: string) => {
  const found = tables.flatMap(table => {
    nominalTable(db, table);
    return db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${nominalClaim('source_json', ['sourceId'], '$id')}`).all({ id }).map(row => ({ table, row }));
  });
  if (found.length !== 1 || found[0].table !== owner || found[0].row.source_id !== id) throw new Error('dispatch nominal Source ownership differs');
  return found[0].row;
};
export const assertNominalReference = (ref: SamePaReference, source: unknown, result: unknown, owners: readonly string[]) => {
  if (!owners.includes(ref.owner) || !samePaReferenceValid(ref, ref.owner) || ref.sourceHash !== hash(source) || ref.snapshotHash !== hash(result)) {
    throw new Error('dispatch nominal endpoint Source or reconstructed snapshot hash differs');
  }
};
export const nominalSame = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('dispatch nominal original identity or state differs'); };
