import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { classifyClosedPlayForOfficialScoring } from '../../core/adjudication/OfficialScoring';
import type { PersistedOfficialScoring } from '../SqliteOfficialScoringStore';
import { officialStateSerialized as json } from '../OfficialStateEncoding';
import { deriveOfficialPendingNonLiveResult } from '../OfficialPendingPostPlay';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLivePlayId as id } from './ActualLivePlayScope';
import { originalFoulMetadataValues as values, originalFoulReferenceIds as refs } from './OriginalFoulOwnershipMetadata';
import { foulApplicationOwnershipRows, sortFoulApplicationOwnershipRows } from './ActualFoulTerminalApplicationOwnership';
import { assertFoulTerminalApplicationStorage, foulTerminalApplicationEvidenceFromSqlite,
  foulTerminalPendingInput } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';

type Row = Record<string, SQLOutputValue>;
type Scope = Readonly<{ terminalSourceId: string; applicationId?: string; matchId?: string; playId?: number }>;
const table = 'official_scoring_applications';
const columns = ['scoring_application_id','match_id','official_application_id','closure_id','source_event_id','request_json','result_json'] as const;
export const foulTerminalScoringApplicationId = (sourceId: string): string => {
  if (!id(sourceId)) throw new Error('invalid terminal scoring Source identity');
  return JSON.stringify(['actual_foul_terminal_scoring_v1', sourceId]);
};
const same = (a: unknown, b: unknown, message: string): void => { if (json(a) !== json(b)) throw new Error(message); };
const strings = (items: readonly unknown[]): string[] => items.filter((value): value is string => typeof value === 'string');
const embeddedSource = (value: string): string[] => {
  try {
    const encoded = JSON.parse(value);
    return Array.isArray(encoded) && encoded.length === 2 && encoded[0] === 'actual_foul_terminal_scoring_v1'
      && id(encoded[1]) ? [encoded[1]] : [];
  } catch { return []; }
};

/** Rejection-only census; duplicates, escaped keys and array ancestors remain
 * visible. No discovered claim supplies a valid request or receipt. */
export const foulTerminalScoringClaimRows = (db: DatabaseSync, scope: Scope): Row[] => {
  const sourceIds = new Set([scope.terminalSourceId]), applicationIds = new Set(strings([scope.applicationId]));
  const scoringIds = new Set([foulTerminalScoringApplicationId(scope.terminalSourceId)]), closureIds = new Set([scope.terminalSourceId]);
  const rows = foulApplicationOwnershipRows(db, table, Object.fromEntries(columns.map(column => [column,'TEXT'])));
  const entries = rows.map(row => {
    const request = typeof row.request_json === 'string' ? row.request_json : '', result = typeof row.result_json === 'string' ? row.result_json : '';
    const r = (path: string[]) => values(db, request, path), o = (path: string[]) => values(db, result, path);
    const scoring = strings([row.scoring_application_id, ...r(['input','scoringApplicationId']), ...o(['scoringApplicationId'])]);
    const sources = strings([...refs(db, request, ['input','officialApplication','origin'], 'actual_foul_terminal_applications'),
      ...scoring.flatMap(embeddedSource)]);
    const events = strings([row.source_event_id,...r(['input','sourceEventId']),...r(['evidence','sourceEventId']),...o(['sourceEventId'])]);
    const applications = strings([row.official_application_id,...r(['input','officialApplication','applicationId']),...o(['officialApplicationId']),
      ...events.filter(event => event.startsWith('official-non-live:')).map(event => event.slice('official-non-live:'.length))]);
    const closures = strings([row.closure_id,...o(['closureId']),...o(['record','closureId']),
      ...r(['input','officialApplication','adjudication','events','closureId'])]);
    const games = [row.match_id,...r(['input','officialApplication','matchId']),...o(['matchId'])];
    const plays = [...r(['input','officialApplication','match','playId']),...r(['input','officialApplication','timeline','playId']),
      ...r(['input','officialApplication','adjudication','playId']),...o(['record','playId'])];
    return { row,scoring,sources,applications,closures,scoped:scope.matchId !== undefined && scope.playId !== undefined
      && games.includes(scope.matchId) && plays.includes(scope.playId) };
  });
  const selected = new Set<Row>();
  for (;;) {
    let changed = false;
    for (const e of entries) if (!selected.has(e.row) && (e.scoped || e.scoring.some(v => scoringIds.has(v))
      || e.sources.some(v => sourceIds.has(v)) || e.applications.some(v => applicationIds.has(v)) || e.closures.some(v => closureIds.has(v)))) {
      selected.add(e.row); changed = true;
      e.scoring.forEach(v => scoringIds.add(v));
      // This terminal owner's closure ID is its Source ID. Preserve that edge
      // in both directions; application/event suffixes remain separate.
      [...e.sources,...e.closures].forEach(v => { sourceIds.add(v); closureIds.add(v); });
      e.applications.forEach(v => applicationIds.add(v));
    }
    if (!changed) return sortFoulApplicationOwnershipRows([...selected]);
  }
};

export const terminalScoringSchema = (db: DatabaseSync) => ({
  main: db.prepare('SELECT rowid,* FROM main.sqlite_master ORDER BY type,name').all(),
  temp: db.prepare('SELECT rowid,* FROM temp.sqlite_master ORDER BY type,name').all(),
  mainVersion: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
  tempVersion: db.prepare('PRAGMA temp.schema_version').get()!.schema_version,
  userVersion: db.prepare('PRAGMA main.user_version').get()!.user_version,
});
/** Full raw dependency pin deliberately includes rowids, participant/person,
 * calibration and workload archives as well as P/C/E and pending mirrors. */
export const terminalScoringRows = (db: DatabaseSync, excludeScoring = false) => db.prepare(
  "SELECT name FROM main.sqlite_master WHERE type='table' ORDER BY name").all()
  .filter(row => !excludeScoring || row.name !== table).map(row => ({ table: row.name,
    rows: db.prepare('SELECT rowid AS __terminal_scoring_rowid,* FROM main."' + String(row.name).replaceAll('"','""') + '" ORDER BY rowid').all() }));

const compact = (sql: string) => sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|\s+/g,
  token => token[0] === "'" || token[0] === '"' ? token : '').replace(/^CREATETABLE(?:IFNOTEXISTS)?(?:main\.)?/i,'');
const expectedSql = `CREATE TABLE official_scoring_applications (
 scoring_application_id TEXT PRIMARY KEY, match_id TEXT NOT NULL,
 official_application_id TEXT NOT NULL REFERENCES applications(application_id), closure_id TEXT NOT NULL,
 source_event_id TEXT NOT NULL UNIQUE, request_json TEXT NOT NULL, result_json TEXT NOT NULL, UNIQUE(match_id, closure_id))`;
export const assertTerminalScoringStorage = (db: DatabaseSync): void => {
  if (db.prepare('PRAGMA main.user_version').get()!.user_version !== 3
    || !assertFoulTerminalApplicationStorage(db, 'acknowledgement')) throw new Error('terminal scoring requires acknowledged schema version 3');
  if (db.prepare("SELECT 1 FROM temp.sqlite_master WHERE type IN ('table','view')").all().length) throw new Error('terminal scoring temp shadowing is unsupported');
  const installed = db.prepare('SELECT type,sql FROM main.sqlite_master WHERE name=?').all(table);
  if (installed.length !== 1 || installed[0].type !== 'table' || typeof installed[0].sql !== 'string'
    || compact(installed[0].sql) !== compact(expectedSql)) throw new Error('terminal scoring canonical table is missing or differs');
  same(db.prepare('PRAGMA main.table_info(official_scoring_applications)').all().map(c => [c.name,c.type,c.notnull,c.pk,c.dflt_value]),
    columns.map((name,i) => [name,'TEXT',i === 0 ? 0 : 1,i === 0 ? 1 : 0,null]),'terminal scoring columns differ');
  const keys = db.prepare('PRAGMA main.index_list(official_scoring_applications)').all().filter(i => i.unique === 1).map(i => {
    if (i.partial !== 0 || !['pk','u'].includes(String(i.origin))) throw new Error('terminal scoring unique keys differ');
    return db.prepare('PRAGMA main.index_info("' + String(i.name).replaceAll('"','""') + '")').all().map(c => c.name);
  });
  same(keys.map(json).sort(),[['scoring_application_id'],['source_event_id'],['match_id','closure_id']].map(json).sort(),'terminal scoring unique keys differ');
  same(db.prepare('PRAGMA main.foreign_key_list(official_scoring_applications)').all().map(f => [f.table,f.from,f.to,f.on_update,f.on_delete,f.match]),
    [['applications','official_application_id','application_id','NO ACTION','NO ACTION','NONE']],'terminal scoring FK differs');
  for (const [owner, required, requiredKeys] of [
    ['matches',[['match_id','TEXT',0,1],['durable_revision','INTEGER',1,0],['state_json','TEXT',1,0],['activation_json','TEXT',0,0]],[['match_id']]],
    ['applications',[['application_id','TEXT',0,1],['match_id','TEXT',1,0],['closure_id','TEXT',1,0],['request_hash','TEXT',1,0],['result_json','TEXT',1,0]],
      [['application_id'],['match_id','closure_id']]],
    ['official_fixtures',[['game_id','TEXT',0,1],['venue_id','TEXT',1,0],['fixture_event_id','TEXT',1,0],['fixture_revision','INTEGER',1,0]],
      [['game_id'],['fixture_event_id']]],
  ] as const) {
    const found = db.prepare('SELECT type FROM main.sqlite_master WHERE name=?').all(owner);
    if (found.length !== 1 || found[0].type !== 'table') throw new Error('terminal scoring official storage missing');
    same(db.prepare('PRAGMA main.table_info(' + owner + ')').all().map(c => [c.name,c.type,c.notnull,c.pk,c.dflt_value]),
      required.map(c => [...c,null]),'terminal scoring official columns differ');
    const unique = db.prepare('PRAGMA main.index_list(' + owner + ')').all().filter(i => i.unique === 1).map(i => {
      if (i.partial !== 0 || !['pk','u'].includes(String(i.origin))) throw new Error('terminal scoring official unique key differs');
      return db.prepare('PRAGMA main.index_info("' + String(i.name).replaceAll('"','""') + '")').all().map(c => c.name);
    });
    same(unique.map(json).sort(),requiredKeys.map(json).sort(),'terminal scoring official unique keys differ');
  }
};

/** The outer transaction must retire after proof-boundary cleanup failure even
 * if a failing SQLite wrapper already performed the requested restoration. */
export class TerminalScoringProofIntegrityError extends AggregateError {}

/** Runs only inside the terminal store's owned transaction. Source readers
 * cannot acquire writer authority, replace the transaction or leave query_only
 * changed without the outer owner retiring the connection. */
export const terminalScoringProof = <T>(db: DatabaseSync, body: () => T): T => {
  if (!db.isTransaction) throw new Error('terminal scoring proof requires its owned transaction');
  const setting = db.prepare('PRAGMA query_only').get()!.query_only;
  if (setting !== 0 && setting !== 1) throw new Error('terminal scoring query_only differs');
  const name = 'terminal_scoring_proof_' + randomUUID().replaceAll('-','');
  db.exec('SAVEPOINT ' + name);
  let primary: unknown, bodyFailed = false;
  try {
    db.exec('PRAGMA query_only=1');
    const before = { schema: terminalScoringSchema(db), changes: db.prepare('SELECT total_changes() AS n').get()!.n };
    const result = withBattedVenueLegalReadSnapshot(db, body);
    if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) throw new Error('terminal scoring proof transaction changed');
    same({ schema: terminalScoringSchema(db), changes: db.prepare('SELECT total_changes() AS n').get()!.n },before,'terminal scoring proof wrote data');
    try { db.exec('RELEASE ' + name); }
    catch (error) { throw new TerminalScoringProofIntegrityError([error],'terminal scoring proof RELEASE failed',{ cause:error }); }
    return result;
  } catch (error) { primary = error; bodyFailed = true; throw error; }
  finally {
    try {
      db.exec('PRAGMA query_only=' + setting);
      if (db.prepare('PRAGMA query_only').get()!.query_only !== setting) throw new Error('terminal scoring proof restoration differs');
    } catch (error) {
      throw new TerminalScoringProofIntegrityError(bodyFailed ? [primary,error] : [error],
        'terminal scoring proof restoration failed',{ cause:bodyFailed ? primary : error });
    }
  }
};

export const foulTerminalScoringEvidenceFromSqlite = (db: DatabaseSync) => ({
  prepare(sourceId: string) {
    assertTerminalScoringStorage(db);
    const saved = foulTerminalApplicationEvidenceFromSqlite(db).read(sourceId);
    if (!saved) {
      if (foulTerminalScoringClaimRows(db,{ terminalSourceId:sourceId }).length) throw new Error('terminal scoring claims survive missing original owner');
      return null;
    }
    if (saved.status !== 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY') throw new Error('terminal scoring requires acknowledged pending original source');
    const p = saved.proposal, request = foulTerminalPendingInput(p);
    same(saved.result.official,deriveOfficialPendingNonLiveResult(request,p.originalOfficialRevision + 1),'terminal scoring full official receipt differs');
    const classified = classifyClosedPlayForOfficialScoring({ kind:'non_live',match:request.match,timeline:request.timeline,
      adjudication:request.adjudication,context:request.context });
    if (classified.kind !== 'supported' || classified.record.classification !== 'strikeout'
      || classified.record.hitsCredited !== 0 || classified.record.errorsCharged !== 0
      || classified.record.basisRulingId !== p.callSource.sourceId) throw new Error('terminal scoring assigned strikeout differs');
    const scoringApplicationId = foulTerminalScoringApplicationId(sourceId);
    const input = freeze({ scoringApplicationId,officialApplication:request });
    const expected: PersistedOfficialScoring = freeze({ scoringApplicationId,matchId:p.gameId,
      officialApplicationId:p.source.applicationId,closureId:sourceId,sourceEventId:'official-non-live:' + p.source.applicationId,record:classified.record });
    const row = { scoring_application_id:scoringApplicationId,match_id:p.gameId,official_application_id:p.source.applicationId,
      closure_id:sourceId,source_event_id:expected.sourceEventId,request_json:json({ input,evidence:null }),result_json:json(expected) };
    const claims = foulTerminalScoringClaimRows(db,{ terminalSourceId:sourceId,applicationId:p.source.applicationId,matchId:p.gameId,playId:p.playId });
    if (claims.length) same(claims,[row],'terminal scoring canonical row or competing claims differ');
    return { saved,input,expected,row,result:claims.length ? expected : null };
  },
});
