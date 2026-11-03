import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { samePaMetadataClaim as claim } from '../../../src/host/world/SamePlateAppearanceReservationGuard';
const directory = resolve(process.argv[2]), path = join(directory, 'closed-prefix.sqlite');
const sha = () => createHash('sha256').update(readFileSync(path)).digest('hex'); const before = sha();
const db = new DatabaseSync(path, { readOnly: true });
const results: unknown[] = [];
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'pa_lifecycle_v1_*'").all();
  for (const { name } of tables) {
    const table = String(name), rows = db.prepare('SELECT source_id,source_json,snapshot_json FROM ' + table).all();
    const invalid = rows.flatMap(row => ['source_json', 'snapshot_json'].flatMap(column =>
      db.prepare('SELECT json_valid(?) v').get(row[column])!.v === 1 ? [] : [{ sourceId: row.source_id, column, length: String(row[column]).length }]));
    const expression = `source_id=$id OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`;
    const sql = `SELECT source_id FROM main.${table} WHERE ${expression}`;
    const ids = ['team-retained:cut19:view', 'team-retained:cut18:home-8:defender_decision'];
    for (const id of ids) {
      try { results.push({ table, id, invalid, status: 'PASS_QUERY', rows: db.prepare(sql).all({ id }) }); }
      catch (error) {
        const failures = rows.flatMap(row => {
          try { db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$probe AND (${expression})`).all({ id, probe: row.source_id }); return []; }
          catch (e) { return [{ sourceId: row.source_id, error: String(e) }]; }
        });
        results.push({ table, id, invalid, status: 'FAIL_QUERY', error: String(error), failures, sql });
      }
    }
  }
} finally { db.close(); }
if (sha() !== before) throw new Error('readonly diagnostic mutated closed artifact');
const report = { status: 'READONLY_METADATA_SQL_DIAGNOSTIC', databaseHash: before, results };
writeFileSync(join(directory, 'metadata-diagnostic.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
