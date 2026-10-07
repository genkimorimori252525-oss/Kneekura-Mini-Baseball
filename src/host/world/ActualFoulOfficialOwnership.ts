import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { originalFoulMetadataValues as values, originalFoulReferenceIds as references } from './OriginalFoulOwnershipMetadata';
import { actualLivePlayId as id } from './ActualLivePlayScope';
export type FoulOfficialDb = Pick<DatabaseSync,'prepare'>;
export type FoulOfficialRow = Record<string,SQLOutputValue>;
export type FoulOfficialScope = Readonly<{ sourceId: string; gameId: string; playId: number; physicalPitchSourceId: string;
  physicalEndSourceId: string; consumptionSourceId: string; officialObligationKey: string; originalSuccessorKey: string }>;
export const foulOfficialTables = ['actual_foul_official_sessions','actual_foul_official_events','actual_foul_official_heads','actual_foul_official_handoffs'] as const;
type Table = typeof foulOfficialTables[number];
export const foulOfficialRows = (db: FoulOfficialDb, table: Table): FoulOfficialRow[] => {
  const schema = db.prepare("SELECT type FROM main.sqlite_master WHERE name=?").all(table);
  if (!schema.length) return [];
  if (schema.length !== 1 || schema[0].type !== 'table') throw new Error('foul official owner schema differs');
  return db.prepare('SELECT * FROM main.'+table).all();
};
const text = (row: FoulOfficialRow, column: string) => typeof row[column] === 'string' ? row[column] as string : '';
const claim = (db: FoulOfficialDb, row: FoulOfficialRow, column: string, path: readonly string[], target: string | number) =>
  values(db,text(row,column),path).includes(target);
export const foulOfficialIdentity = (db: FoulOfficialDb, kind: 'session'|'event', sourceId: string): FoulOfficialRow | null => {
  if (!id(sourceId)) throw new Error('invalid foul official Source identity');
  const table = kind === 'session' ? 'actual_foul_official_sessions' : 'actual_foul_official_events';
  const selected = foulOfficialRows(db,table).filter(row => row.source_id === sourceId || claim(db,row,'source_json',['sourceId'],sourceId)
    || claim(db,row,'snapshot_json',kind === 'session' ? ['source','sourceId'] : ['headSourceId'],sourceId));
  if (selected.length > 1 || selected.length === 1 && selected[0].source_id !== sourceId) throw new Error('foul official Source identity ownership claim differs');
  return selected[0] ?? null;
};
/** Rejection-only raw discovery. Never parse a foreign payload to decide whether
 * it claims this episode. The existing CTE retains escaped duplicates/arrays. */
const scoped = (db: FoulOfficialDb, row: FoulOfficialRow, scope: FoulOfficialScope) => {
  if (row.session_source_id === scope.sourceId || row.physical_pitch_source_id === scope.physicalPitchSourceId
    || row.physical_end_source_id === scope.physicalEndSourceId || row.official_obligation_key === scope.officialObligationKey
    || row.game_id === scope.gameId && row.play_id === scope.playId) return true;
  for (const column of ['source_json','snapshot_json','intent_json'] as const) {
    const document = text(row,column);
    const paths = [[],['source'],['assignment'],['source','assignment'],['scope'],['callIntent'],['officialObligation'],['officialObligation','scope'],['handoff'],['handoff','scope']] as const;
    for (const p of paths) {
      if (values(db,document,[...p,'sessionSourceId']).includes(scope.sourceId)
        || values(db,document,[...p,'physicalPitchSourceId']).includes(scope.physicalPitchSourceId)
        || values(db,document,[...p,'obligationKey']).includes(scope.officialObligationKey)
        || values(db,document,[...p,'originalSuccessorKey']).includes(scope.originalSuccessorKey)
        || values(db,document,[...p,'gameId']).includes(scope.gameId) && values(db,document,[...p,'playId']).includes(scope.playId)) return true;
    }
    for (const p of [['physicalEndReference'],['source','physicalEndReference'],['handoff','physicalEndReference']] as const) {
      if (references(db,document,p,'actual_foul_play_ends').includes(scope.physicalEndSourceId)) return true;
    }
    for (const p of [['consumptionReference'],['scope','consumptionReference'],['officialObligation','scope','consumptionReference'],['handoff','consumptionReference'],['handoff','scope','consumptionReference']] as const) {
      if (references(db,document,p,'actual_foul_rule_consumptions').includes(scope.consumptionSourceId)) return true;
    }
    if (values(db,document,['officialObligation','obligationKey']).includes(scope.officialObligationKey)
      || values(db,document,['source','sourceId']).includes(scope.sourceId)) return true;
  }
  return false;
};
const eventClaims = (db: FoulOfficialDb, scope: FoulOfficialScope) => {
  const all = foulOfficialRows(db,'actual_foul_official_events');
  const selected = new Set(all.filter(row => scoped(db,row,scope)));
  // A foreign-indexed journal row may claim only an original parent or head.
  // Resolve those metadata edges before validating any selected payload.
  let changed = true;
  while (changed) {
    changed = false;
    const ids = new Set([scope.sourceId,...[...selected].flatMap(row => [String(row.source_id),
      ...values(db,text(row,'source_json'),['sourceId']).filter((v): v is string => typeof v === 'string')])]);
    const intents = new Set([...selected].flatMap(row => [...values(db,text(row,'intent_json'),['sourceId']),
      ...values(db,text(row,'source_json'),['action','intentSourceId'])]).filter((v): v is string => typeof v === 'string'));
    for (const row of all) if (!selected.has(row) && ([row.parent_source_id,
      ...values(db,text(row,'source_json'),['parent','sourceId']),...values(db,text(row,'snapshot_json'),['headSourceId'])]
      .some(v => typeof v === 'string' && ids.has(v))
      || values(db,text(row,'snapshot_json'),['callIntent','sourceId']).some(v => typeof v === 'string' && intents.has(v)))) { selected.add(row); changed = true; }
  }
  return all.filter(row => selected.has(row));
};
export const foulOfficialClaims = (db: FoulOfficialDb, table: Exclude<Table,'actual_foul_official_heads'>, scope: FoulOfficialScope) => {
  if (table === 'actual_foul_official_events') return eventClaims(db,scope);
  const eventIds = table === 'actual_foul_official_handoffs' ? new Set(eventClaims(db,scope).map(row => String(row.source_id))) : new Set<string>();
  return foulOfficialRows(db,table).filter(row => table === 'actual_foul_official_sessions' && row.source_id === scope.sourceId
    || scoped(db,row,scope) || table === 'actual_foul_official_handoffs' && [row.source_id,
      ...values(db,text(row,'source_json'),['sourceId']),
      ...references(db,text(row,'snapshot_json'),['consumer'],'actual_foul_official_handoffs')]
      .some(v => typeof v === 'string' && eventIds.has(v)));
};
/** Only an admitted call action owns an intent; later projections retain it. */
export const foulOfficialIntentProducerClaims = (db: FoulOfficialDb,intentSourceId: string) =>
  foulOfficialRows(db,'actual_foul_official_events').filter(row => claim(db,row,'intent_json',['sourceId'],intentSourceId)
    || claim(db,row,'source_json',['action','intentSourceId'],intentSourceId));
/** First adoption must also reject an already claimed raw retained mirror. */
export const foulOfficialIntentClaims = (db: FoulOfficialDb,intentSourceId: string) =>
  foulOfficialRows(db,'actual_foul_official_events').filter(row => claim(db,row,'intent_json',['sourceId'],intentSourceId)
    || claim(db,row,'source_json',['action','intentSourceId'],intentSourceId)
    || claim(db,row,'snapshot_json',['callIntent','sourceId'],intentSourceId));
export const foulOfficialHeads = (db: FoulOfficialDb, scope: FoulOfficialScope, eventIds: readonly string[]) => {
  const ids = new Set([scope.sourceId,...eventIds]);
  return foulOfficialRows(db,'actual_foul_official_heads').filter(row => row.session_source_id === scope.sourceId || ids.has(String(row.head_source_id)));
};
