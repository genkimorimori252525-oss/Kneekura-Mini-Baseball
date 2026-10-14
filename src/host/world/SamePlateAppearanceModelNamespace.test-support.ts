import type { DatabaseSync } from 'node:sqlite';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';

type Kind = 'observation' | 'decision' | 'locomotion';
type Schema = { name: string; type: string; tbl_name: string; sql: string | null };
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const normalized = (sql: string) => sql.replace(/\s|;/g, '');
const reject = (detail: string): never => { throw new Error('normal model namespace differs: ' + detail); };

/** Inventory-only absence classification. Present rows still require the unchanged
 * normal model reader. This never installs a table or turns SQLite errors into
 * accepted absence, and it never authenticates a model/calibration value.
 */
export const classifyFieldModelNamespace = (db: DatabaseSync, kind: Kind): 'present' | 'pristine' => {
  assertBodyCompositionNativeConnection(db);
  if (!['observation', 'decision', 'locomotion'].includes(kind)) reject('unsupported family');
  const name = `world_player_${kind}_models`;
  const schema = db.prepare('SELECT name,type,tbl_name,sql FROM main.sqlite_master').all() as Schema[];
  const family = schema.filter(row => row.name.toLowerCase().startsWith(name)
    || row.tbl_name.toLowerCase().startsWith(name)
    || row.name.toLowerCase().startsWith(`sqlite_autoindex_${name}`));
  if (family.length) {
    const root = family.find(row => row.name === name && row.type === 'table');
    const expected = `CREATE TABLE ${name} (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
      ${kind === 'locomotion' ? 'capability TEXT NOT NULL,' : ''}career_id TEXT NOT NULL,player_id TEXT NOT NULL,
      person_link_source_id TEXT NOT NULL,fielding_model_source_id TEXT NOT NULL,accepted_at_day INTEGER NOT NULL,
      source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
      UNIQUE(career_id,player_id))`;
    if (!root || root.sql === null || normalized(root.sql) !== normalized(expected) || family.length !== 3
      || family.some(row => row !== root && !(row.type === 'index' && row.tbl_name === name && row.sql === null
        && [`sqlite_autoindex_${name}_1`, `sqlite_autoindex_${name}_2`].includes(row.name)))) reject(name);
    return 'present';
  }

  // A durable consumer head alone still claims a required original model. Check
  // both members of its known family before scanning raw/indexed model links.
  const consumers: Record<Kind, readonly [string, string]> = {
    observation: ['actual_field_observations', 'actual_field_observation_heads'],
    decision: ['actual_defensive_decisions', 'actual_defensive_decision_heads'],
    locomotion: ['actual_locomotion_receipts', 'actual_locomotion_heads'],
  };
  const consumerColumns: Record<Kind, string> = {
    observation: `source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT NOT NULL,
      player_id TEXT NOT NULL,base_field_source_id TEXT NOT NULL,execution_source_id TEXT,observation_model_source_id TEXT NOT NULL,
      previous_source_id TEXT,revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
      UNIQUE(physical_pitch_source_id,player_id,revision)`,
    decision: `source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
      physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,observation_source_id TEXT NOT NULL,decision_model_source_id TEXT NOT NULL,
      plan_source_id TEXT NOT NULL,previous_source_id TEXT,revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(physical_pitch_source_id,player_id,revision)`,
    locomotion: `source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,capability TEXT NOT NULL,
      physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,decision_source_id TEXT NOT NULL,locomotion_model_source_id TEXT NOT NULL,
      base_field_source_id TEXT NOT NULL,execution_source_id TEXT,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
      UNIQUE(physical_pitch_source_id,player_id),UNIQUE(decision_source_id)`,
  };
  const headColumns = `physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,
    source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL,PRIMARY KEY(physical_pitch_source_id,player_id)`;
  const roots = consumers[kind].map(table => {
    const rows = schema.filter(row => row.name.toLowerCase().startsWith(table) && row.type !== 'index');
    if (rows.length > 1 || rows.some(row => row.name !== table || row.type !== 'table')) reject(table);
    return rows[0];
  });
  if (roots.some(Boolean) && !roots.every(Boolean)) reject('partial surviving consumer family');
  for (const [i, root] of roots.entries()) if (root) {
    const expected = `CREATE TABLE ${root.name} (${i === 0 ? consumerColumns[kind] : headColumns})`;
    const objects = schema.filter(row => row.tbl_name.toLowerCase() === root.name), indexes = i === 0 && kind === 'locomotion' ? 3 : 2;
    if (root.sql === null || normalized(root.sql) !== normalized(expected) || objects.length !== indexes + 1
      || objects.some(row => row !== root && !(row.type === 'index' && row.tbl_name === root.name && row.sql === null
        && Array.from({ length: indexes }, (_, index) => `sqlite_autoindex_${root.name}_${index + 1}`).includes(row.name)))) reject(root.name);
    if (db.prepare(`SELECT 1 FROM main.${quote(root.name)} LIMIT 1`).get()) {
      throw new Error('surviving model consumer claim without original model namespace: ' + name);
    }
  }

  // Discover typed scalar claims without hydrating arbitrary future payloads.
  // json_tree retains escaped and duplicate keys/containers; JSON.parse does not.
  // A plain string naming an owner, or an array in an owner field, is not a typed
  // reference. Invalid unrelated documents remain opaque. Known consumers above
  // cannot hide their required model merely by corrupting their JSON/indexes.
  for (const row of schema) {
    if (row.type !== 'table' || row.name.startsWith('sqlite_')) continue;
    const columns = db.prepare(`PRAGMA main.table_xinfo(${quote(row.name)})`).all() as { name: string }[];
    const indexed = `${kind}_model_source_id`;
    for (const column of columns) {
      const value = `r.${quote(column.name)}`;
      if (column.name.toLowerCase() === indexed
        && db.prepare(`SELECT 1 FROM main.${quote(row.name)} r WHERE ${value} IS NOT NULL LIMIT 1`).get()) {
        throw new Error('surviving indexed model claim without original namespace: ' + name);
      }
      if (!column.name.endsWith('_json')) continue;
      const document = `CASE WHEN json_valid(${value}) THEN ${value} ELSE 'null' END`;
      if (db.prepare(`SELECT 1 FROM main.${quote(row.name)} r,json_tree(${document}) claim
        WHERE (claim.key='owner' AND claim.type='text' AND claim.atom=?)
          OR claim.key=? LIMIT 1`).get(name, `${kind}ModelSourceId`)) {
        throw new Error('surviving raw model claim without original namespace: ' + name);
      }
    }
  }
  return 'pristine';
};
