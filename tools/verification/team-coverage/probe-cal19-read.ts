import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { readCurrentSamePaLifecycleViewFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
const directory = resolve(process.argv[2]), path = join(directory, 'closed-prefix.sqlite');
const sha = () => createHash('sha256').update(readFileSync(path)).digest('hex'), before = sha();
const db = new DatabaseSync(path, { readOnly: true }), prepare = db.prepare.bind(db), errors: unknown[] = [];
// Diagnostic only: retain the actual Native connection and original SQL/results;
// intercept only an exception to record exact SQL/bindings. No execution credit.
db.prepare = ((sql: string) => {
  const statement = prepare(sql);
  for (const method of ['all', 'get'] as const) {
    const original = statement[method].bind(statement);
    Object.defineProperty(statement, method, { configurable: true, writable: true, value: (...args: never[]) => {
      try { return original(...args); }
      catch (error) { errors.push({ sql, method, bindings: args, error: String(error) }); throw error; }
    } });
  }
  return statement;
}) as typeof db.prepare;
const started = Date.now(); let outcome: unknown;
try {
  const row = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut19:view')!;
  const view = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(row.snapshot_json)));
  const ids = db.prepare('SELECT source_id FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
    .all('team-retained:cut18:view').map(row => String(row.source_id));
  const result = withSqliteReadTransaction(db, () => ({ current: readCurrentSamePaLifecycleViewFromSqlite(db, view),
    calibrations: readSamePaLifecycleSetFromSqlite(db, 'calibration', ids) }));
  outcome = { status: 'PASS_DIAGNOSTIC_ORIGINAL_CAL19_READ', viewReference: view, calibrationCount: result.calibrations.length };
} catch (error) { outcome = { status: 'FAIL_DIAGNOSTIC_ORIGINAL_CAL19_READ', error: String(error) }; }
finally { db.close(); }
if (sha() !== before) throw new Error('readonly probe changed database');
const report = { outcome, errors, databaseHash: before, elapsedMilliseconds: Date.now() - started, diagnosticOnly: true, teamExecutionCredit: 0 };
writeFileSync(join(directory, 'original-cal19-read-probe.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
