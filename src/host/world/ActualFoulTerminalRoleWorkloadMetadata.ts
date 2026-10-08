import type { DatabaseSync } from 'node:sqlite';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
type Db = Pick<DatabaseSync, 'prepare'>;
type Table = 'actual_role_workload_assessments' | 'actual_role_workload_settlements';
const numeric = (document: string, path: string[], value: string) =>
  `EXISTS(SELECT 1 FROM (${nodes(document, path)}) number_claim WHERE number_claim.type IN ('integer','real') AND number_claim.atom=${value})`;

/** Raw ownership discovery deliberately considers old and terminal mirrors.
 * Discovery never authenticates either variant; its concrete reader does that. */
export const foulTerminalWorkloadIdentityRow = (db: Db, table: Table, sourceId: string) => {
  const assessment = table === 'actual_role_workload_assessments';
  const key = assessment ? 'source_id' : 'closure_source_id';
  const raw = assessment ? `${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`
    : `${claim('plan_json', ['terminalSourceId'], '$id')} OR ${claim('plan_json', ['terminalReference', 'sourceId'], '$id')}
       OR ${claim('plan_json', ['closureSourceId'], '$id')}`;
  const rows = db.prepare(`SELECT * FROM main.${table} WHERE ${key}=$id OR ${raw}`).all({ id: sourceId });
  if (rows.length > 1 || rows.length === 1 && rows[0][key] !== sourceId) throw new Error('terminal workload Source identity ownership differs');
  return rows[0] ?? null;
};
export const foulTerminalWorkloadScopeRows = (db: Db, table: Table, scope: Readonly<{
  terminalSourceId: string; careerId: string; gameId: string; playId: number; physicalEndSourceId: string;
}>) => {
  const assessment = table === 'actual_role_workload_assessments', document = assessment ? 'r.snapshot_json' : 'r.plan_json';
  const reference = assessment ? ['source', 'terminalReference', 'sourceId'] : ['terminalReference', 'sourceId'];
  const end = assessment ? ['source', 'physicalEndReference', 'sourceId'] : ['physicalEndReference', 'sourceId'];
  return db.prepare(`SELECT r.* FROM main.${table} r WHERE r.closure_source_id=$terminalSourceId
    OR ${claim(document, reference, '$terminalSourceId')}
    OR ${claim(document, assessment ? ['source', 'closureSourceId'] : ['closureSourceId'], '$terminalSourceId')}
    OR ${claim(document, end, '$physicalEndSourceId')}
    ${assessment ? `OR ${claim('r.source_json', ['terminalReference', 'sourceId'], '$terminalSourceId')}
      OR ${claim('r.source_json', ['physicalEndReference', 'sourceId'], '$physicalEndSourceId')}` : `OR ${claim(document, ['terminalSourceId'], '$terminalSourceId')}`}
    OR ((r.career_id=$careerId OR ${claim(document, ['careerId'], '$careerId')}
        ${assessment ? `OR ${claim(document, ['actor', 'binding', 'careerId'], '$careerId')}` : ''})
      AND (r.game_id=$gameId OR ${claim(document, ['gameId'], '$gameId')}
        ${assessment ? `OR ${claim(document, ['actor', 'binding', 'gameId'], '$gameId')}` : ''})
      AND (r.play_id=$playId OR ${numeric(document, ['playId'], '$playId')}))`).all(scope);
};
