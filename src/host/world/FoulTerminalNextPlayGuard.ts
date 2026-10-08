import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { originalFoulMetadataValues as values } from './OriginalFoulOwnershipMetadata';

type Db = Pick<DatabaseSync, 'prepare'>;
const rows = (db: Db, table: string, required: readonly string[]): Record<string, SQLOutputValue>[] => {
  const schema = db.prepare('SELECT type FROM main.sqlite_master WHERE name=?').all(table);
  if (!schema.length) return [];
  if (schema.length !== 1 || schema[0].type !== 'table') throw new Error('terminal pending admission owner schema differs');
  const columns = db.prepare('PRAGMA main.table_info(' + table + ')').all();
  if (required.some(name => columns.filter(c => c.name === name && c.type === 'TEXT').length !== 1)) {
    throw new Error('terminal pending admission owner columns differ');
  }
  return db.prepare('SELECT * FROM main.' + table).all();
};
const document = (row: Record<string, SQLOutputValue>, column: string) => typeof row[column] === 'string' ? row[column] as string : '';
const hasPending = (db: Db, doc: string) => !!db.prepare(`SELECT 1 FROM json_tree(CASE WHEN json_valid(?) THEN ? ELSE 'null' END)
  WHERE key='pendingPostPlay' LIMIT 1`).get(doc, doc);
/** Rejection only. None of these independent raw mirrors is an activation or a
 * completed post-play owner. Missing siblings never make the surviving claim safe. */
export const assertNoFoulTerminalNextPlay = (db: Db, applicationId: string | null): void => {
  if (applicationId === null) return;
  if (typeof applicationId !== 'string' || !applicationId || applicationId !== applicationId.trim()) {
    throw new Error('invalid terminal pending admission application identity');
  }
  const reject = () => { throw new Error('terminal official application has pending post-play effects'); };
  for (const row of rows(db, 'actual_foul_terminal_applications', ['application_id','source_json','proposal_json','result_json'])) {
    if (row.application_id === applicationId) reject();
    for (const [column, path] of [
      ['source_json',['applicationId']], ['proposal_json',['source','applicationId']], ['proposal_json',['applicationBody','applicationId']],
      ['result_json',['official','receipt','applicationId']], ['result_json',['official','pendingPostPlay','applicationId']],
      ['result_json',['acknowledgement','applicationReference','applicationId']],
    ] as const) if (values(db, document(row,column), path).includes(applicationId)) reject();
  }
  const scopes = new Map<string, Set<number>>();
  for (const row of rows(db, 'applications', ['application_id','match_id','result_json'])) {
    const doc = document(row,'result_json');
    const identity = row.application_id === applicationId || values(db,doc,['receipt','applicationId']).includes(applicationId);
    if (identity && typeof row.match_id === 'string') {
      const plays = scopes.get(row.match_id) ?? new Set<number>();
      for (const play of values(db,doc,['receipt','previousPlayId'])) {
        if (typeof play === 'number' && Number.isSafeInteger(play) && play >= 0) plays.add(play);
      }
      scopes.set(row.match_id, plays);
    }
    if (values(db,doc,['pendingPostPlay','applicationId']).includes(applicationId) || identity && hasPending(db,doc)) reject();
  }
  for (const row of rows(db, 'matches', ['match_id','activation_json'])) {
    const doc = document(row,'activation_json');
    const games = [row.match_id, ...values(db,doc,['pendingPostPlay','matchId'])];
    const plays = values(db,doc,['pendingPostPlay','previousPlayId']);
    // A later pending PA must not invalidate the earlier application's
    // historical actor origin. Only original previous-play scope is linkage.
    if (values(db,doc,['pendingPostPlay','applicationId']).includes(applicationId)
      || games.some(game => typeof game === 'string' && plays.some(play => typeof play === 'number' && scopes.get(game)?.has(play)))) reject();
  }
};
