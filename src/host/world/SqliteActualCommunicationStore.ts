import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { createRequire } from 'node:module';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { defensiveMetadataId as metadataId } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection, sqliteJsonMetadataMatches as matches } from './SqliteOwnershipMetadata';
import { umpireId as id } from './ActualFirstBaseUmpire';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualCommunicationInput, actualCommunicationModelInput, deriveActualCallCommunication, actualCommunicationAt,
  type AcceptedActualCommunicationModel, type DurableActualCommunicationModel, type AcceptedActualCallCommunication,
  type DurableActualCallCommunication } from './ActualCallCommunication';
import type { ActualObservationMoment } from './ActualFieldObservation';

export type ActualCommunicationAuthority = Readonly<{
  readAcceptedModel(sourceId: string): AcceptedActualCommunicationModel | null;
  readAcceptedCommunication(sourceId: string): AcceptedActualCallCommunication | null;
}>;
export type SqliteActualCommunicationStore = Readonly<{
  acceptModel(sourceId: string): DurableActualCommunicationModel; readModel(sourceId: string): DurableActualCommunicationModel | null;
  accept(sourceId: string): DurableActualCallCommunication; read(sourceId: string): DurableActualCallCommunication | null; close(): void;
}>;
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'> &
  Partial<Pick<import('node:sqlite').DatabaseSync, 'isTransaction'>>;
type ModelRow = { source_id: string; source_version: string; game_id: string; physical_pitch_source_id: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type Row = { source_id: string; source_version: string; game_id: string; play_id: number; physical_pitch_source_id: string;
  call_source_id: string; model_source_id: string | null; current_execution_source_id: string; previous_source_id: string | null;
  revision: number; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const columns = { sourceId: 'source_id', sourceVersion: 'source_version', callSourceId: 'call_source_id', modelSourceId: 'model_source_id',
  currentExecutionSourceId: 'current_execution_source_id', previousCommunicationSourceId: 'previous_source_id' } as const;
const keys = Object.keys(columns);
/** Authenticates original dependencies and bounded communication history using the caller's connection. */
export const actualCommunicationEvidenceFromSqlite = (db: Db) => {
  const calls = actualFirstBaseUmpireEvidenceFromSqlite(db), fields = battedWorldFieldEvidenceFromSqlite(db), executions = battedWorldFieldExecutionEvidenceFromSqlite(db);
  const identity = (table: string, sourceId: string) => db.prepare(`SELECT * FROM ${table} WHERE source_id=?
    OR ${metadataId('source_json', ['sourceId'])} OR ${metadataId('snapshot_json', ['source', 'sourceId'])}
    ${table === 'actual_call_communications' ? `OR ${metadataId('snapshot_json', ['history', { array: 'last' }, 'sourceId'])}` : ''}`)
    .all(sourceId, sourceId, sourceId, ...(table === 'actual_call_communications' ? [sourceId] : []));
  const deriveModel = (source: AcceptedActualCommunicationModel): DurableActualCommunicationModel => {
    const pitch = readOriginalPhysicalPitchPrefixFromSqlite(db, source.physicalPitchSourceId).at(-1)!;
    const players = [pitch.frame.batterActor?.binding.playerId, ...pitch.frame.world.runners.map(p => p.playerId), ...pitch.frame.world.defenders.map(p => p.playerId)];
    if (pitch.frame.gameId !== source.gameId || players.some(p => !id(p)) || new Set(players).size !== players.length) throw new Error('communication model original play/participant scope differs');
    const originalPlayerIds = (players as string[]).sort();
    if (source.parameters?.receivers.some(receiver => !originalPlayerIds.includes(receiver.playerId))) throw new Error('communication conditions name a foreign receiver');
    return freeze({ source, physicalPitchHash: hash(pitch), originalPlayerIds });
  };
  const modelRowsFor = (pitchId: string): ModelRow[] => db.prepare(`SELECT * FROM actual_communication_models WHERE physical_pitch_source_id=?
    OR ${metadataId('source_json', ['physicalPitchSourceId'])} OR ${metadataId('snapshot_json', ['source', 'physicalPitchSourceId'])}
    ORDER BY source_id`).all(pitchId, pitchId, pitchId) as ModelRow[];
  const readModel = (sourceId: string): DurableActualCommunicationModel | null => {
    if (!id(sourceId)) throw new Error('invalid communication model identity');
    const rows = identity('actual_communication_models', sourceId) as ModelRow[];
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('communication model identity ownership differs');
    if (!rows.length) return null;
    const row = rows[0], source = actualCommunicationModelInput(JSON.parse(row.source_json) as AcceptedActualCommunicationModel, sourceId);
    const value = deriveModel(source);
    if (row.source_json !== json(source) || row.source_hash !== hash(source) || row.source_version !== source.sourceVersion
      || row.game_id !== source.gameId || row.physical_pitch_source_id !== source.physicalPitchSourceId
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt actual communication model');
    return value;
  };
  const rowsFor = (callId: string): Row[] => db.prepare(`SELECT * FROM actual_call_communications WHERE call_source_id=?
    OR ${metadataId('source_json', ['callSourceId'])} OR ${metadataId('snapshot_json', ['source', 'callSourceId'])}
    OR ${metadataId('snapshot_json', ['history', { array: 'all' }, 'callSourceId'])} ORDER BY revision`)
    .all(callId, callId, callId, callId) as Row[];
  const metadata = (row: Row, ancestors: readonly Row[]) => {
    const expected = Object.fromEntries(Object.entries(columns).map(([key, column]) => [key, row[column]]));
    const check = (document: string, path: Parameters<typeof nodes>[1], wanted: Readonly<Record<string, string | number | null>>) => {
      const containers = db.prepare(`WITH ownership_document(document) AS (VALUES(?)) SELECT type,CASE WHEN type='object' THEN ${projection('n.value', Object.keys(wanted))} END AS identity
        FROM (${nodes('(SELECT document FROM ownership_document)', path)}) n`).all(document) as { type: string; identity: string | null }[];
      if (containers.length !== 1 || containers[0].type !== 'object' || !matches(containers[0].identity, wanted)) throw new Error('ambiguous actual communication ownership metadata');
    };
    check(row.source_json, [], expected); check(row.snapshot_json, ['source'], expected);
    const root = db.prepare(`WITH ownership_document(document) AS (VALUES(?)) SELECT type,CASE WHEN type='object' THEN ${projection('n.value', ['revision', 'gameId', 'playId', 'physicalPitchSourceId'])} END AS identity
      FROM (${nodes('(SELECT document FROM ownership_document)')}) n`).get(row.snapshot_json) as { type: string; identity: string | null };
    if (root.type !== 'object' || !matches(root.identity, { revision: row.revision, gameId: row.game_id, playId: row.play_id, physicalPitchSourceId: row.physical_pitch_source_id })) {
      throw new Error('actual communication scope mirror differs');
    }
    const history = db.prepare(`WITH ownership_document(document) AS (VALUES(?)) SELECT type,CASE WHEN type='object' THEN ${projection('n.value', keys)} END AS identity
      FROM (${nodes('(SELECT document FROM ownership_document)', ['history', { array: 'all' }])}) n`).all(row.snapshot_json) as { type: string; identity: string | null }[];
    const arrays = db.prepare(`WITH ownership_document(document) AS (VALUES(?)) SELECT type FROM (${nodes('(SELECT document FROM ownership_document)', ['history'])})`).all(row.snapshot_json);
    if (arrays.length !== 1 || arrays[0].type !== 'array' || history.length !== ancestors.length
      || history.some((entry, i) => entry.type !== 'object' || !matches(entry.identity,
        Object.fromEntries(Object.entries(columns).map(([key, column]) => [key, ancestors[i][column]]))))) throw new Error('actual communication history identity differs');
    const ownRows = identity('actual_call_communications', row.source_id);
    if (ownRows.length !== 1 || ownRows[0].source_id !== row.source_id) throw new Error('actual communication Source identity differs');
  };
  const dependencies = (source: AcceptedActualCallCommunication) => {
    const call = calls.readCall(source.callSourceId);
    if (!call) throw new Error('original owned umpire call is unavailable');
    const transactional = db.isTransaction === true;
    const owned = transactional ? executions.readWithExecutions(source.currentExecutionSourceId) : null;
    const current = transactional ? owned?.value : executions.read(source.currentExecutionSourceId);
    if (!current) throw new Error('actual communication execution Source is unavailable');
    const changes = owned ? db.prepare('SELECT total_changes() AS changes').get()!.changes : null;
    const model = source.modelSourceId === null ? null : readModel(source.modelSourceId);
    if (source.modelSourceId !== null && !model) throw new Error('accepted reception model Source is missing');
    const prefix = { baseField: current.baseField, fields: fields.scope(current.baseField, current.baseField.source.sourceId),
      executions: owned ? owned.executions : executions.scope(current.baseField, source.currentExecutionSourceId) };
    if (owned && (db.isTransaction !== true || db.prepare('SELECT total_changes() AS changes').get()!.changes !== changes)) {
      throw new Error('actual communication physical dependencies changed during read');
    }
    return { call, current, model, prefix };
  };
  const execute = (source: AcceptedActualCallCommunication, previous: DurableActualCallCommunication | null) => {
    const d = dependencies(source);
    return deriveActualCallCommunication(source, d.call, d.model, d.prefix, previous);
  };
  const scope = (callId: string, throughSourceId?: string): readonly DurableActualCallCommunication[] => {
    if (!id(callId) || throughSourceId !== undefined && !id(throughSourceId)) throw new Error('invalid actual communication scope');
    const rows = rowsFor(callId);
    const heads = db.prepare('SELECT * FROM actual_call_communication_heads WHERE call_source_id=? OR source_id IN (SELECT source_id FROM actual_call_communications WHERE call_source_id=?)')
      .all(callId, callId);
    if (!rows.length) { if (heads.length || throughSourceId) throw new Error('unowned actual communication head'); return []; }
    if (heads.length !== 1 || heads[0].call_source_id !== callId || heads[0].source_id !== rows.at(-1)!.source_id
      || heads[0].revision !== rows.length) throw new Error('actual communication head differs');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]; metadata(row, rows.slice(0, i + 1));
      if (row.call_source_id !== callId || row.revision !== i + 1 || row.previous_source_id !== (rows[i - 1]?.source_id ?? null)
        || i > 0 && (row.model_source_id !== rows[0].model_source_id || row.game_id !== rows[0].game_id || row.play_id !== rows[0].play_id
          || row.physical_pitch_source_id !== rows[0].physical_pitch_source_id)) throw new Error('actual communication original lineage differs');
    }
    const end = throughSourceId === undefined ? rows.length - 1 : rows.findIndex(row => row.source_id === throughSourceId);
    if (end < 0) throw new Error('actual communication requested bound is not owned');
    const values: DurableActualCallCommunication[] = [];
    for (const row of rows.slice(0, end + 1)) {
      const source = actualCommunicationInput(JSON.parse(row.source_json) as AcceptedActualCallCommunication, row.source_id);
      const value = execute(source, values.at(-1) ?? null);
      if (row.source_json !== json(source) || row.source_hash !== hash(source) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)
        || row.game_id !== value.gameId || row.play_id !== value.playId || row.physical_pitch_source_id !== value.physicalPitchSourceId) throw new Error('corrupt actual communication original snapshot');
      values.push(value);
    }
    return values;
  };
  const read = (sourceId: string): DurableActualCallCommunication | null => {
    if (!id(sourceId)) throw new Error('invalid actual communication identity');
    const rows = identity('actual_call_communications', sourceId) as Row[];
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('actual communication Source identity ownership differs');
    return rows.length ? scope(rows[0].call_source_id, sourceId).at(-1)! : null;
  };
  const derive = (source: AcceptedActualCallCommunication) => {
    const previous = scope(source.callSourceId).at(-1) ?? null;
    if (source.previousCommunicationSourceId !== (previous?.source.sourceId ?? null)) throw new Error('actual communication predecessor differs');
    return execute(source, previous);
  };
  const currentDependencies = (value: DurableActualCallCommunication) => {
    const d = dependencies(value.source); executions.current(d.current);
    if (hash(d.call) !== value.callHash || (d.model ? hash(d.model) : null) !== value.modelHash) throw new Error('actual communication original dependencies changed');
    const previous = value.source.previousCommunicationSourceId === null ? null : read(value.source.previousCommunicationSourceId);
    if (json(execute(value.source, previous)) !== json(value)) throw new Error('actual communication physical dependency changed');
  };
  const currentBefore = (value: DurableActualCallCommunication) => {
    currentDependencies(value);
    if (json(derive(value.source)) !== json(value)) throw new Error('actual communication original changed before write');
  };
  const current = (value: DurableActualCallCommunication) => {
    currentDependencies(value);
    if (json(scope(value.source.callSourceId).at(-1)) !== json(value)) throw new Error('actual communication head changed during write');
  };
  const inventory = (sourceId: string, at: ActualObservationMoment) => {
    const value = read(sourceId); if (!value) throw new Error('owned actual communication is unavailable');
    return freeze({ sourceId, snapshotHash: hash(value), evaluatedThrough: value.evaluatedThrough,
      emitted: value.sentAt !== null && at.elapsedSeconds >= value.sentAt.elapsedSeconds && value.emitted !== null,
      recipients: value.recipients.map(r => actualCommunicationAt(value, r.playerId, at)) });
  };
  return { readModel, deriveModel, modelRowsFor, read, derive, scope, currentBefore, current, inventory, rowsFor };
};

export const openSqliteActualCommunicationStore = (path: string, authority?: ActualCommunicationAuthority): SqliteActualCommunicationStore => {
  if (!id(path) || authority && (typeof authority.readAcceptedModel !== 'function' || typeof authority.readAcceptedCommunication !== 'function')) throw new Error('invalid actual communication Source authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS actual_communication_models (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
    game_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS actual_call_communications (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,
    physical_pitch_source_id TEXT NOT NULL,call_source_id TEXT NOT NULL,model_source_id TEXT,current_execution_source_id TEXT NOT NULL,
    previous_source_id TEXT,revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    UNIQUE(call_source_id,revision));
    CREATE TABLE IF NOT EXISTS actual_call_communication_heads (call_source_id TEXT PRIMARY KEY,source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL);`);
  const own = actualCommunicationEvidenceFromSqlite(db); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed actual communication Source'); };
  // Only pure call reads share this private snapshot; accepted-Source callbacks
  // remain outside it and the existing write transaction reauthenticates afresh.
  const reading = <T>(work: () => T): T => {
    if (db.isTransaction) return work();
    db.exec('BEGIN');
    try { const value = withBattedWorldPhysicalReadTraversal(db, work); db.exec('COMMIT'); return value; }
    catch (error) {
      if (db.isTransaction) try { db.exec('ROLLBACK'); }
      catch (cleanup) { throw new AggregateError([error, cleanup], 'actual communication private read rollback failed', { cause: error }); }
      throw error;
    }
  };
  const pinModel = (value: DurableActualCommunicationModel) => {
    if (json(own.deriveModel(value.source)) !== json(value)) throw new Error('communication model original pitch changed');
  };
  return freeze({ readModel(sourceId: string) { check(sourceId); return own.readModel(sourceId); },
    acceptModel(sourceId: string) {
      check(sourceId); const prior = own.readModel(sourceId), raw = authority?.readAcceptedModel(sourceId) ?? null;
      const source = raw === null ? null : actualCommunicationModelInput(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('communication model Source is frozen differently');
        const saved = own.readModel(sourceId); if (!saved || json(saved) !== json(prior)) throw new Error('communication model changed during retry'); return saved;
      }
      if (!source) throw new Error('accepted communication model is unavailable');
      const value = own.deriveModel(source), pins = json(own.modelRowsFor(source.physicalPitchSourceId)); db.exec('BEGIN IMMEDIATE');
      try {
        if (json(own.modelRowsFor(source.physicalPitchSourceId)) !== pins) throw new Error('actual communication prior model rows changed before admission');
        pinModel(value);
        db.prepare('INSERT INTO actual_communication_models VALUES (?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion, source.gameId,
          source.physicalPitchSourceId, json(source), hash(source), json(value), hash(value));
        if (json(own.modelRowsFor(source.physicalPitchSourceId).filter(row => row.source_id !== sourceId)) !== pins) throw new Error('actual communication prior model rows changed after insert');
        pinModel(value); const saved = own.readModel(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('communication model original changed after insert');
        db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    read(sourceId: string) { check(sourceId); return reading(() => own.read(sourceId)); },
    accept(sourceId: string) {
      check(sourceId); const prior = reading(() => own.read(sourceId)), raw = authority?.readAcceptedCommunication(sourceId) ?? null;
      const source = raw === null ? null : actualCommunicationInput(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('actual communication Source is frozen differently');
        const saved = reading(() => own.read(sourceId)); if (!saved || json(saved) !== json(prior)) throw new Error('actual communication changed during retry'); return saved;
      }
      if (!source) throw new Error('accepted actual communication Source is unavailable');
      const { value, pins } = reading(() => {
        const value = own.derive(source); own.currentBefore(value);
        return { value, pins: json(own.rowsFor(source.callSourceId)) };
      });
      db.exec('BEGIN IMMEDIATE');
      try {
        const liveFence = beginActualLivePitchWrite(db, value.physicalPitchSourceId, { owner: 'actual_call_communications', sourceId });
        if (json(own.rowsFor(source.callSourceId)) !== pins) throw new Error('actual communication prior rows changed before admission');
        // Each immutable proof phase is independent. INSERT, its triggers and
        // the live fence stay outside; postwrite must replay fresh dependencies.
        withBattedWorldPhysicalReadTraversal(db, () => own.currentBefore(value));
        db.prepare('INSERT INTO actual_call_communications VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion,
          value.gameId, value.playId, value.physicalPitchSourceId, source.callSourceId, source.modelSourceId, source.currentExecutionSourceId,
          source.previousCommunicationSourceId, value.revision, json(source), hash(source), json(value), hash(value));
        if (value.revision === 1) db.prepare('INSERT INTO actual_call_communication_heads VALUES (?,?,?)').run(source.callSourceId, sourceId, 1);
        else {
          const changed = db.prepare('UPDATE actual_call_communication_heads SET source_id=?,revision=? WHERE call_source_id=? AND source_id=? AND revision=?')
            .run(sourceId, value.revision, source.callSourceId, source.previousCommunicationSourceId, value.revision - 1);
          if (Number(changed.changes) !== 1) throw new Error('actual communication predecessor changed during write');
        }
        recordActualLivePlayAdmission(db, liveFence);
        if (json(own.rowsFor(source.callSourceId).filter(r => r.source_id !== sourceId)) !== pins) throw new Error('actual communication prior rows changed after insert');
        const saved = withBattedWorldPhysicalReadTraversal(db, () => {
          own.current(value); const saved = own.read(sourceId);
          if (!saved || json(saved) !== json(value)) throw new Error('actual communication original changed after insert');
          return saved;
        });
        assertActualLivePlayWriteUnchanged(db, liveFence); db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }, close() { if (!closed) { closed = true; db.close(); } },
  });
};
