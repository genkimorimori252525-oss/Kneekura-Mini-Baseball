import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { readNativeContactReportEnvelopeV229FromSqlite } from '../native-contact-report-runtime-v192';
import { readContactDescriptorEnvelopeV229 } from '../../src/integration/traits/ContactDescriptorEnvelopeV229';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';
/** Caller owns a read-only Native transaction and connection. */
export function inspectContactEnvelopeV229(db: DatabaseSync, careerId: string, playerId: string) {
  assert(db.isTransaction); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 1);
  const before = { changes: db.prepare('SELECT total_changes() n').get()!.n, schema: db.prepare('PRAGMA main.schema_version').get()!.schema_version };
  const scope = { careerId, playerId };
  const value = readNativeContactReportEnvelopeV229FromSqlite(db, { scope, model: null, policy: null, worldRevision: 0 });
  assert.deepEqual(readContactDescriptorEnvelopeV229(value, scope), value);
  assert(db.isTransaction); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 1);
  assert.deepEqual({ changes: db.prepare('SELECT total_changes() n').get()!.n, schema: db.prepare('PRAGMA main.schema_version').get()!.schema_version }, before);
  return value;
}
