import {foulTerminalNextPlayReadinessFromSqlite} from './FoulTerminalNextPlayReadiness';
import {activeBattedWorldFieldReadFrame} from './SqliteBattedWorldFieldStore';
import {foulApplicationOwnershipRows} from './ActualFoulTerminalApplicationOwnership';
import { officialActivationApplicationOwnershipClaims, officialApplicationHasTerminalStageClaim, officialApplicationRawIdentities } from '../OfficialApplicationOwnershipFromSqlite';
import { assertFoulTerminalPriorActivation } from './FoulTerminalCompletionAncestryGuard';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { createRequire } from 'node:module';
import { foulTerminalPostPlayCompletionEvidenceFromSqlite } from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import type { DurableFoulTerminalCompletedApplication } from './ActualFoulTerminalPostPlayCompletion';
import { originalFoulMetadataValues as values } from './OriginalFoulOwnershipMetadata';

type Db = Pick<DatabaseSync, 'prepare'>;
const rows = (db: Db, table: string, required: readonly string[]): Record<string, SQLOutputValue>[] => {
  return foulApplicationOwnershipRows(db,table,Object.fromEntries(required.map(name=>[name,'TEXT' as const])));
};
const document = (row: Record<string, SQLOutputValue>, column: string) => typeof row[column] === 'string' ? row[column] as string : '';
const hasPending = (db: Db, doc: string) => !!db.prepare(`SELECT 1 FROM json_tree(CASE WHEN json_valid(?) THEN ? ELSE 'null' END)
  WHERE key='pendingPostPlay' LIMIT 1`).get(doc, doc);
const terminalRows = (db: Db) => rows(db,'actual_foul_terminal_applications',['application_id','source_json','proposal_json','result_json']);
/** Raw scope discovery is rejection-only. Full completion must authenticate the
 * selected row, every mirror and all original dependencies on this connection. */
export const foulTerminalNextPlayScopeRows = (db: Db, gameId: string, playId: number,
  physicalEndSourceIds: readonly string[] = []) => terminalRows(db).filter(row => {
  if (row.game_id === gameId && row.play_id === playId || physicalEndSourceIds.includes(String(row.physical_end_source_id))) return true;
  for (const [column, gamePath, playPath] of [
    ['proposal_json',['gameId'],['playId']],
    ['proposal_json',['applicationBody','matchId'],['applicationBody','match','playId']],
    ['result_json',['official','pendingPostPlay','matchId'],['official','pendingPostPlay','previousPlayId']],
    ['result_json',['acknowledgement','applicationReference','matchId'],['acknowledgement','applicationReference','previousPlayId']],
  ] as const) if (values(db,document(row,column),gamePath).includes(gameId) && values(db,document(row,column),playPath).includes(playId)) return true;
  const doc = document(row,'result_json');
  const game = row.game_id === gameId || values(db,doc,['completion','finalResult','gameId']).includes(gameId) || values(db,document(row,'proposal_json'),['gameId']).includes(gameId)
    || values(db,doc,['official','pendingPostPlay','matchId']).includes(gameId)
    || values(db,doc,['acknowledgement','applicationReference','matchId']).includes(gameId);
  return game && (values(db,doc,['official','receipt','previousPlayId']).includes(playId)
    || values(db,doc,['completion','activation','previousPlayId']).includes(playId)
    || values(db,doc,['completion','controllerRetirement','previousPlayId']).includes(playId))
    || [document(row,'source_json'),document(row,'proposal_json'),doc].some((text,index) =>
      values(db,text,index === 2 ? ['completion','controllerRetirement','physicalEndReference','sourceId'] : ['physicalEndReference','sourceId'])
        .some(id => typeof id === 'string' && physicalEndSourceIds.includes(id)));
});
const completion = (db: Db, sourceId: string) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync)) throw new Error('terminal completion admission requires a Native connection');
  const saved = foulTerminalPostPlayCompletionEvidenceFromSqlite(db).read(sourceId);
  if(saved&&('finalResult'in saved.result.completion||saved.status==='POST_PLAY_COMPLETED_FINAL'))throw new Error('terminal final completion has no next-play activation');
  if (!saved) throw new Error('terminal completed admission owner is missing');
  return saved;
};
/** Legacy name retained for existing callers. A surviving pending claim still
 * blocks; the sole exception is the exact fully authenticated completion and
 * its intentionally retained original pendingPostPlay in the application. */
type HistoricalTerminalReadiness=ReturnType<ReturnType<typeof foulTerminalNextPlayReadinessFromSqlite>['readHistorical']>;
const admission = (db: Db, applicationId: string | null, paired: boolean): Readonly<{archive:DurableFoulTerminalCompletedApplication|null;readiness:HistoricalTerminalReadiness|null}> => {
  if (applicationId === null) return {archive:null,readiness:null};
  if (typeof applicationId !== 'string' || !applicationId || applicationId !== applicationId.trim()) {
    throw new Error('invalid terminal pending admission application identity');
  }
  const reject = (): never => { throw new Error('terminal official application has pending post-play effects or conflicting completion claims'); };
  const terminal = terminalRows(db), applications = rows(db,'applications',['application_id','match_id','result_json']);
  // Clean legacy stores retain their old optional-owner behavior. Any retained
  // terminal row or terminal marker requires the shared full raw census before
  // fallback, including bridges through untagged official owner rows.
  const officialTables=['applications','matches','physical_play_closures','actual_live_play_closures'] as const;
  const marked = terminal.length > 0 || officialTables.some(table=>rows(db,table,[])
    .some(row=>officialApplicationHasTerminalStageClaim(db,{table,row})));
  const census = marked ? officialActivationApplicationOwnershipClaims(db,applicationId) : null;
  const candidates = census?.terminal ?? [];
  if(candidates.length>1)reject();
  const selected=candidates[0];
  for(const claim of census?.official ?? [])if(officialApplicationHasTerminalStageClaim(db,claim)
    && (!selected||claim.table!=='applications'||claim.row.application_id!==applicationId))reject();
  const scopes = new Map<string, Set<number>>();
  for (const row of applications) {
    const doc = document(row,'result_json');
    if (officialApplicationRawIdentities(db,'applications',row).applicationIds.includes(applicationId)) {
      if (typeof row.match_id !== 'string') reject();
      const result = JSON.parse(doc);
      assertFoulTerminalPriorActivation(db,String(row.match_id),result?.receipt?.previousPlayId,result?.activation?.nextMatchState?.playId);
      const plays = scopes.get(row.match_id as string) ?? new Set<number>();
      for (const play of values(db,doc,['receipt','previousPlayId'])) if (typeof play === 'number' && Number.isSafeInteger(play) && play >= 0) plays.add(play);
      scopes.set(row.match_id as string,plays);
    }
  }
  for (const [game,plays] of scopes) for (const play of plays) {
    const scoped=foulTerminalNextPlayScopeRows(db,game,play);
    if(scoped.some(row=>!selected||row.source_id!==selected.source_id)||scoped.length>1)reject();
  }
  if (selected && (selected.application_id !== applicationId || typeof selected.source_id !== 'string'
    || selected.status !== 'POST_PLAY_COMPLETED_CONTINUING')) reject();
  const readiness = paired && selected ? foulTerminalNextPlayReadinessFromSqlite(db).readHistorical(String(selected.source_id)) : null;
  const saved = readiness?.archive ?? (selected ? completion(db,String(selected.source_id)) : null);
  if (saved && saved.source.applicationId !== applicationId) reject();
  for (const row of applications) {
    const doc = document(row,'result_json');
    const identity = officialApplicationRawIdentities(db,'applications',row).applicationIds.includes(applicationId);
    const pendingScope = values(db,doc,['pendingPostPlay','matchId']).some(game => typeof game === 'string'
      && values(db,doc,['pendingPostPlay','previousPlayId']).some(play => typeof play === 'number' && scopes.get(game)?.has(play)));
    const completionClaim = identity && !!db.prepare(`SELECT 1 FROM json_tree(CASE WHEN json_valid(?) THEN ? ELSE 'null' END) WHERE key='completion' LIMIT 1`).get(doc,doc);
    const pending = pendingScope || completionClaim || values(db,doc,['pendingPostPlay','applicationId']).includes(applicationId) || identity && hasPending(db,doc);
    if (pending && (!saved || row.application_id !== applicationId || row.match_id !== saved.proposal.gameId)) reject();
    // Any other row retaining this activation identity is an alias, even if its
    // cached application ID and pending marker were damaged independently.
    if (saved && identity && row.application_id !== applicationId) reject();
  }
  for (const row of rows(db,'matches',['match_id','activation_json'])) {
    const doc = document(row,'activation_json');
    const games = [row.match_id,...values(db,doc,['finalResult','gameId']),...values(db,doc,['completion','finalResult','gameId']),...values(db,doc,['pendingPostPlay','matchId'])];
    const plays = [...values(db,doc,['pendingPostPlay','previousPlayId']),...values(db,doc,['completion','activation','previousPlayId']),
      ...values(db,doc,['completion','controllerRetirement','previousPlayId'])];
    if (values(db,doc,['pendingPostPlay','applicationId']).includes(applicationId)
      || values(db,doc,['completion','officialReference','applicationId']).includes(applicationId)
      || values(db,doc,['completion','activation','applicationId']).includes(applicationId)
      || games.some(game => typeof game === 'string' && plays.some(play => typeof play === 'number' && scopes.get(game)?.has(play)))) reject();
  }
  return {archive:saved,readiness};
};
export const assertNoFoulTerminalNextPlay = (db: Db, applicationId: string | null): DurableFoulTerminalCompletedApplication | null => admission(db,applicationId,false).archive;
/** Only this owned Native read may carry its completed target through the later
 * scope census. No caller evidence, mutable cache or cross-operation handoff. */
export const readFoulTerminalNextPlayAdmission = (db: Db, applicationId: string) => {
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if(!(db instanceof DatabaseSync)||!db.isTransaction||activeBattedWorldFieldReadFrame(db)===null
    ||db.prepare('PRAGMA query_only').get()!.query_only!==1)throw new Error('paired terminal admission requires an owned Native read frame');
  return admission(db,applicationId,true);
};
