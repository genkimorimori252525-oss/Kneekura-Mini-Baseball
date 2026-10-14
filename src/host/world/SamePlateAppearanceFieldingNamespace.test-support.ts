import type { DatabaseSync } from 'node:sqlite';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { classifyFieldModelNamespace } from './SamePlateAppearanceModelNamespace.test-support';
const name = 'world_player_fielding_models';
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const normalized = (sql: string) => sql.replace(/\s|;/g, '');
const schemaSql = `CREATE TABLE ${name}(source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,player_id TEXT NOT NULL,
  person_link_source_id TEXT NOT NULL,accepted_at_day INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(career_id,player_id))`;

/** Read-only fixture prerequisite census, not a fielding model owner or repair.
 * Installed tables always proceed to the unchanged normal model reader. */
export const classifyFieldingNamespace = (db: DatabaseSync): 'present' | 'pristine' => {
  assertBodyCompositionNativeConnection(db);
  const schema = db.prepare('SELECT name,type,tbl_name,sql FROM main.sqlite_master').all() as { name: string; type: string; tbl_name: string; sql: string | null }[];
  const family = schema.filter(r => r.name.toLowerCase().startsWith(name) || r.tbl_name.toLowerCase().startsWith(name)
    || r.name.toLowerCase().startsWith(`sqlite_autoindex_${name}`));
  if (family.length) {
    const root = family.find(r => r.name === name && r.type === 'table');
    if (!root || root.sql === null || normalized(root.sql) !== normalized(schemaSql) || family.length !== 3
      || family.some(r => r !== root && !(r.type === 'index' && r.tbl_name === name && r.sql === null
        && [`sqlite_autoindex_${name}_1`, `sqlite_autoindex_${name}_2`].includes(r.name)))) throw new Error('fielding model namespace differs');
    return 'present';
  }
  // These three normal models require fielding. Their partial namespaces must
  // fail before an absent fielding family can be described as pristine.
  for (const kind of ['observation', 'decision', 'locomotion'] as const) classifyFieldModelNamespace(db, kind);
  for (const row of schema) {
    if (row.type !== 'table' || row.name.startsWith('sqlite_')) continue;
    const columns = db.prepare(`PRAGMA main.table_xinfo(${quote(row.name)})`).all() as { name: string }[];
    for (const column of columns) {
      const value = `r.${quote(column.name)}`;
      if (column.name.toLowerCase() === 'fielding_model_source_id'
        && db.prepare(`SELECT 1 FROM main.${quote(row.name)} r WHERE ${value} IS NOT NULL LIMIT 1`).get()) {
        throw new Error('surviving indexed fielding model claim without original namespace');
      }
      if (!column.name.endsWith('_json')) continue;
      const document = `CASE WHEN json_valid(${value}) THEN ${value} ELSE 'null' END`;
      if (db.prepare(`SELECT 1 FROM main.${quote(row.name)} r,json_tree(${document}) claim
        WHERE (claim.key='owner' AND claim.type='text' AND claim.atom=?)
          OR claim.key='fieldingModelSourceId' OR (claim.key='fieldingModelRef' AND claim.type!='null') LIMIT 1`).get(name)) {
        throw new Error('surviving raw fielding model claim without original namespace');
      }
    }
  }
  return 'pristine';
};
