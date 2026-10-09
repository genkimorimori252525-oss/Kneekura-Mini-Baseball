import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json, actorFreeze as freeze, readPhysicalPlateAppearanceActorFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaText } from './SamePlateAppearanceWorkPrefix';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { battingEmotionGenesisInput, deriveBattingEmotionGenesis, type AcceptedBattingEmotionGenesis, type DurableBattingEmotionGenesis } from './NativeBattingEmotion';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { assertBattingEmotionExecutionStorage } from './SqliteBattingEmotionExecutionStore';
import { assertBattingAssessmentOwnership } from './BattingAssessmentOwnership';

const table = 'batting_emotion_v1_geneses';
export const battingEmotionGenesisSchema = 'CREATE TABLE batting_emotion_v1_geneses(source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,game_id TEXT NOT NULL,player_id TEXT NOT NULL,view_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(career_id,game_id,player_id))';
const fail = (message: string): never => { throw new Error('batting emotion ' + message); };
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) fail('original identity or durable row differs'); };
const storage = (db: DatabaseSync): boolean => {
  assertBodyCompositionNativeConnection(db);
  const rows = db.prepare("SELECT * FROM main.sqlite_master WHERE lower(name) GLOB 'batting_emotion_v1_*' OR lower(tbl_name) GLOB 'batting_emotion_v1_*'").all();
  if (!rows.length) return false;
  const main = rows.find(r => r.name === table);
  if (!main || main.type !== 'table' || main.tbl_name !== table || main.sql !== battingEmotionGenesisSchema || rows.length !== 3) return fail('namespace is partial or malformed');
  const indexes = db.prepare(`PRAGMA main.index_list(${table})`).all();
  if (indexes.length !== 2) return fail('index namespace differs');
  for (const [i, columns] of [['source_id'], ['career_id', 'game_id', 'player_id']].entries()) {
    const name = `sqlite_autoindex_${table}_${i + 1}`, row = rows.find(r => r.name === name), index = indexes.find(r => r.name === name);
    if (!row || row.type !== 'index' || row.tbl_name !== table || row.sql !== null || !index || index.unique !== 1 || index.partial !== 0 || index.origin !== (i === 0 ? 'pk' : 'u')) return fail('index identity differs');
    const info = db.prepare(`PRAGMA main.index_xinfo(${name})`).all(); same(info.filter(r => r.key === 1).map(r => r.name), columns);
    if (info.length !== columns.length + 1 || info.some(r => r.coll !== 'BINARY' || r.desc !== 0) || info.at(-1)?.cid !== -1) return fail('index columns differ');
  }
  return true;
};
const rowFor = (value: DurableBattingEmotionGenesis) => ({ source_id: value.source.sourceId, career_id: value.scope.careerId,
  game_id: value.scope.matchId, player_id: value.scope.playerId, view_source_id: value.source.viewReference.sourceId,
  source_json: json(value.source), source_hash: hash(value.source), snapshot_json: json(value), snapshot_hash: hash(value) });
const derive = (db: DatabaseSync, source: AcceptedBattingEmotionGenesis) => {
  assertBattingAssessmentOwnership(db, table, source);
  const view = readHistoricalSamePaExecutionView(db, source.viewReference).view;
  const actor = readPhysicalPlateAppearanceActorFromSqlite(db, view.lineage.actorReference.sourceId);
  if (!actor) return fail('original actor missing');
  same(source.member, deriveSamePaDispatchRoles(actor, view)[0].member);
  return deriveBattingEmotionGenesis(source, { careerId: actor.binding.careerId, matchId: actor.source.gameId, playerId: actor.binding.playerId });
};
const identityRow = (db: DatabaseSync, id: string) => {
  if (!storage(db)) {
    if (assertBattingEmotionExecutionStorage(db) && (db.prepare('SELECT 1 FROM main.batting_emotion_execution_v1_heads WHERE genesis_source_id=?').get(id)
      || db.prepare(`SELECT 1 FROM main.batting_emotion_execution_v1_executions WHERE genesis_source_id=$id OR ${claim('source_json', ['genesisReference', 'sourceId'], '$id')}`).get({ id }))) return fail('missing genesis has surviving execution claim');
    return null;
  }
  const rows = db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id });
  if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== id) return fail('raw Source identity claim differs');
  if (!rows.length && assertBattingEmotionExecutionStorage(db) && (db.prepare('SELECT 1 FROM main.batting_emotion_execution_v1_heads WHERE genesis_source_id=?').get(id)
    || db.prepare(`SELECT 1 FROM main.batting_emotion_execution_v1_executions WHERE genesis_source_id=$id OR ${claim('source_json', ['genesisReference', 'sourceId'], '$id')}`).get({ id }))) return fail('missing genesis has surviving execution claim');
  return rows[0] ?? null;
};
const read = (db: DatabaseSync, id: string): DurableBattingEmotionGenesis | null => {
  const row = identityRow(db, id); if (!row) return null;
  const value = derive(db, battingEmotionGenesisInput(JSON.parse(String(row.source_json)), id)); same(row, rowFor(value)); return value;
};
export const readBattingEmotionGenesisFromSqlite = (db: DatabaseSync, id: string): DurableBattingEmotionGenesis | null => {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if (!(db instanceof Native) || !db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1 || !samePaText(id)) return fail('reader requires original read-only transaction');
  return read(db, id);
};

/** The explicit policy initializes only emotion. It cannot initialize World
 * controls, invent an appraisal, advance workload or authorize a batting route. */
export const openSqliteBattingEmotionStore = (path: string, authority?: Readonly<{ readAcceptedGenesis(id: string): unknown }>) => {
  if (!samePaText(path) || authority && typeof authority.readAcceptedGenesis !== 'function') return fail('invalid owner input');
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync, db = new Native(path);
  const transaction = battingInvocationTransaction(db, () => storage(db));
  const canonical = (value: DurableBattingEmotionGenesis) => {
    if (assertBattingEmotionExecutionStorage(db)) {
      const h = db.prepare('SELECT * FROM main.batting_emotion_execution_v1_heads WHERE career_id=? AND game_id=? AND player_id=?').get(value.scope.careerId, value.scope.matchId, value.scope.playerId);
      if (h && (h.genesis_source_id !== value.source.sourceId || h.genesis_source_hash !== hash(value.source) || h.genesis_snapshot_hash !== hash(value))) fail('original emotion execution already pins another genesis');
    }
    if (!storage(db)) return;
    const rows = db.prepare(`SELECT * FROM main.${table} WHERE (career_id=$career OR ${claim('snapshot_json', ['scope', 'careerId'], '$career')})
      AND (game_id=$game OR ${claim('snapshot_json', ['scope', 'matchId'], '$game')}) AND (player_id=$player OR ${claim('snapshot_json', ['scope', 'playerId'], '$player')})`)
      .all({ career: value.scope.careerId, game: value.scope.matchId, player: value.scope.playerId });
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== value.source.sourceId) fail('canonical genesis identity already belongs to another Source');
  };
  return Object.freeze({
    readGenesis(id: string) { if (!samePaText(id)) return fail('invalid Source identity'); return transaction.run(false, proof => proof(() => read(db, id)), value => same(read(db, id), value)); },
    acceptGenesis(id: string) {
      if (!samePaText(id)) return fail('invalid Source identity');
      return transaction.run(true, (proof, step) => {
        const initial = proof(() => {
          const existing = read(db, id), accepted = authority?.readAcceptedGenesis(id);
          const source = accepted == null ? null : battingEmotionGenesisInput(accepted, id);
          if (existing) { if (source) same(existing.source, source); return { value: existing, existing: true }; }
          if (!source) return { value: null, existing: false };
          const value = derive(db, source); canonical(value); return { value, existing: false };
        });
        if (!initial.value) return freeze({ kind: 'pending' as const, missingAcceptedSourceIds: [id] });
        if (initial.existing) return initial.value;
        const value = initial.value;
        if (!proof(() => storage(db))) step(() => db.exec(battingEmotionGenesisSchema), 0, 1);
        proof(() => { canonical(value); same(derive(db, value.source), value); if (identityRow(db, id)) fail('unexpected Source appeared'); });
        const row = rowFor(value); step(() => {
          const result = db.prepare(`INSERT INTO main.${table}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row));
          if (result.changes !== 1) fail('genesis write differs');
        }, 1);
        proof(() => { canonical(value); same(read(db, id), value); }); return value;
      }, value => { if (value.kind === 'pending') { if (read(db, id)) fail('pending Source acquired durable claim'); }
        else { canonical(value); same(read(db, id), value); } });
    },
    close: transaction.close,
  });
};
