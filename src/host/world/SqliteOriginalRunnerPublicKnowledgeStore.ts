import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { withBattedWorldFieldReadTraversal } from './SqliteBattedWorldFieldStore';
import { publicKnowledgeId as id, originalRunnerPublicKnowledgeInput as input, deriveOriginalRunnerPublicKnowledge, assertOriginalRunnerPublicKnowledgeCurrent,
  type AcceptedOriginalRunnerPublicKnowledge, type DurableOriginalRunnerPublicKnowledge } from './OriginalRunnerPublicKnowledge';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type SqliteOriginalRunnerPublicKnowledgeStore = Readonly<{
  accept(sourceId: string): DurableOriginalRunnerPublicKnowledge;
  read(sourceId: string): DurableOriginalRunnerPublicKnowledge | null; close(): void;
}>;
type Authority = Readonly<{ readAcceptedKnowledge(sourceId: string): AcceptedOriginalRunnerPublicKnowledge | null }>;
type Row = { source_id: string; source_version: string; physical_pitch_source_id: string; game_id: string; play_id: number;
  player_id: string; physical_actor_source_id: string; pre_pitch_runner_source_id: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const claim = (document: string, path: readonly string[]) => `EXISTS(SELECT 1 FROM (${nodes(document, path)}) n WHERE n.type='text' AND n.atom=?)`;

/** Dedicated original-public baseline. No live semantic update, perception
 * consumption, decision or motor authority is supplied by a stored row. */
export const originalRunnerPublicKnowledgeEvidenceFromSqlite = (db: DatabaseSync) => {
  const installed = () => {
    const rows = db.prepare("SELECT type FROM sqlite_master WHERE name='actual_runner_public_knowledge'").all();
    if (rows.length && (rows.length !== 1 || rows[0].type !== 'table')) throw new Error('original public baseline owner differs');
    return rows.length === 1;
  };
  const sourceRows = (sourceId: string): Row[] => installed() ? db.prepare(`SELECT * FROM actual_runner_public_knowledge WHERE source_id=?
    OR ${claim('source_json', ['sourceId'])} OR ${claim('snapshot_json', ['source', 'sourceId'])}`)
    .all(sourceId, sourceId, sourceId) as Row[] : [];
  const scope = (value: DurableOriginalRunnerPublicKnowledge): Row[] => {
    if (!installed()) return [];
    const source = value.source, recipient = value.recipient;
    const stableSource = (document: string, prefix: readonly string[]) =>
      `(${claim(document, [...prefix, 'physicalActorSourceId'])} AND ${claim(document, [...prefix, 'prePitchRunnerSourceId'])} AND ${claim(document, [...prefix, 'playerId'])})`;
    // A pitch-progress endpoint is provenance, not a new original-information
    // identity. Discover surviving canonical claims before trusting any mirror.
    return db.prepare(`SELECT * FROM actual_runner_public_knowledge WHERE physical_pitch_source_id=?
      OR (game_id=? AND play_id=? AND player_id=?)
      OR (physical_actor_source_id=? AND pre_pitch_runner_source_id=? AND player_id=?)
      OR ${claim('source_json', ['physicalPitchSourceId'])} OR ${claim('snapshot_json', ['source', 'physicalPitchSourceId'])}
      OR ${stableSource('source_json', [])} OR ${stableSource('snapshot_json', ['source'])}
      OR (${claim('snapshot_json', ['recipient', 'gameId'])}
        AND EXISTS(SELECT 1 FROM (${nodes('snapshot_json', ['recipient', 'playId'])}) n WHERE n.atom=?)
        AND ${claim('snapshot_json', ['recipient', 'playerId'])})
      OR EXISTS(SELECT 1 FROM (${nodes('snapshot_json', ['original'])}) origin WHERE origin.type='object'
        AND ${claim('origin.value', ['physicalActorSourceId'])} AND ${claim('origin.value', ['prePitchRunnerSourceId'])})
      OR ${claim('snapshot_json', ['original', 'physicalPitchHash'])}
      OR (${claim('snapshot_json', ['original', 'actorHash'])} AND ${claim('snapshot_json', ['original', 'runnerHash'])})`)
      .all(source.physicalPitchSourceId, recipient.gameId, recipient.playId, recipient.playerId,
        source.physicalActorSourceId, source.prePitchRunnerSourceId, source.playerId, source.physicalPitchSourceId, source.physicalPitchSourceId,
        source.physicalActorSourceId, source.prePitchRunnerSourceId, source.playerId, source.physicalActorSourceId, source.prePitchRunnerSourceId, source.playerId,
        recipient.gameId, recipient.playId, recipient.playerId, source.physicalActorSourceId, source.prePitchRunnerSourceId,
        value.original.physicalPitchHash, value.original.actorHash, value.original.runnerHash) as Row[];
  };
  const derive = (source: AcceptedOriginalRunnerPublicKnowledge) => deriveOriginalRunnerPublicKnowledge(db, source);
  const read = (sourceId: string): DurableOriginalRunnerPublicKnowledge | null => {
    if (!id(sourceId)) throw new Error('invalid original public baseline Source');
    const rows = sourceRows(sourceId), row = rows[0];
    if (rows.length > 1 || row && row.source_id !== sourceId) throw new Error('original public baseline Source ownership differs');
    if (!row) return null;
    const source = input(JSON.parse(row.source_json) as AcceptedOriginalRunnerPublicKnowledge, sourceId), value = derive(source), owned = scope(value);
    if (owned.length !== 1 || owned[0].source_id !== sourceId || row.source_version !== source.sourceVersion
      || row.physical_pitch_source_id !== source.physicalPitchSourceId || row.player_id !== source.playerId
      || row.physical_actor_source_id !== source.physicalActorSourceId || row.pre_pitch_runner_source_id !== source.prePitchRunnerSourceId
      || row.game_id !== value.recipient.gameId || row.play_id !== value.recipient.playId
      || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt original public baseline archive or scope');
    return value;
  };
  const before = (raw: DurableOriginalRunnerPublicKnowledge) => {
    const value = cloneInert(raw);
    if (sourceRows(value.source.sourceId).length || scope(value).length) throw new Error('original runner public baseline is already owned');
    if (json(derive(value.source)) !== json(value)) throw new Error('original public baseline dependencies changed before write');
    assertOriginalRunnerPublicKnowledgeCurrent(db, value);
  };
  const snapshot = <T>(work: () => T): T => {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    if (!(db instanceof DatabaseSync)) throw new Error('original public baseline requires its native read connection');
    const run = () => withBattedWorldFieldReadTraversal(db, work);
    if (db.isTransaction) return run();
    db.exec('BEGIN');
    try { const value = run(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return Object.freeze({ derive: (source: AcceptedOriginalRunnerPublicKnowledge) => snapshot(() => derive(source)),
    read: (sourceId: string) => snapshot(() => read(sourceId)),
    before: (value: DurableOriginalRunnerPublicKnowledge) => snapshot(() => before(value)) });
};

export const openSqliteOriginalRunnerPublicKnowledgeStore = (path: string, authority?: Authority): SqliteOriginalRunnerPublicKnowledgeStore => {
  if (!id(path) || authority != null && typeof authority.readAcceptedKnowledge !== 'function') throw new Error('invalid original public baseline authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS actual_runner_public_knowledge(source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
      physical_pitch_source_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,player_id TEXT NOT NULL,
      physical_actor_source_id TEXT NOT NULL,pre_pitch_runner_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(physical_pitch_source_id,player_id),UNIQUE(game_id,play_id,player_id));`);
    const own = originalRunnerPublicKnowledgeEvidenceFromSqlite(db); let closed = false;
    const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed original public baseline store'); };
    return Object.freeze({ read(sourceId) { check(sourceId); return own.read(sourceId); },
      accept(sourceId) {
        check(sourceId); const prior = own.read(sourceId), raw = authority?.readAcceptedKnowledge(sourceId) ?? null;
        const source = raw === null ? null : input(raw, sourceId);
        if (prior) {
          if (source && json(source) !== json(prior.source)) throw new Error('original public baseline Source is frozen differently');
          const current = own.read(sourceId);
          if (!current || json(current) !== json(prior)) throw new Error('original public baseline changed during retry');
          return current;
        }
        if (!source) throw new Error('accepted original public baseline Source is missing');
        const value = own.derive(source); own.before(value);
        db.exec('BEGIN IMMEDIATE');
        try {
          const fence = beginActualLivePitchWrite(db, source.physicalPitchSourceId, { owner: 'actual_runner_public_knowledge', sourceId });
          own.before(value);
          db.prepare('INSERT INTO actual_runner_public_knowledge VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion,
            source.physicalPitchSourceId, value.recipient.gameId, value.recipient.playId, source.playerId, source.physicalActorSourceId,
            source.prePitchRunnerSourceId, json(source), hash(source), json(value), hash(value));
          assertOriginalRunnerPublicKnowledgeCurrent(db, value);
          recordActualLivePlayAdmission(db, fence);
          const saved = own.read(sourceId);
          if (!saved || json(saved) !== json(value)) throw new Error('original public baseline changed during write');
          assertOriginalRunnerPublicKnowledgeCurrent(db, saved);
          assertActualLivePlayWriteUnchanged(db, fence); db.exec('COMMIT'); return saved;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      }, close() { if (!closed) { db.close(); closed = true; } },
    });
  } catch (error) { db.close(); throw error; }
};
