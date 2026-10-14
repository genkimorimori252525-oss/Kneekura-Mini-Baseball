export { ownedRunnerFieldObservationHistoryEvidenceFromSqlite, openSqliteOwnedRunnerFieldObservationStore } from './SqliteOwnedRunnerFieldObservationStore';
export { originalRunnerPublicKnowledgeEvidenceFromSqlite, openSqliteOriginalRunnerPublicKnowledgeStore } from './SqliteOriginalRunnerPublicKnowledgeStore';
import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
export { ownedRunnerFieldObservationEvidenceFromSqlite } from './OwnedRunnerFieldObservation';
import { createRequire } from 'node:module';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches } from './SqliteOwnershipMetadata';
import { actualObservationId as id, actualFieldObservationInput as input, sampleActualFieldObservation,
  type AcceptedActualFieldObservation, type ActualFieldObservationReceipt } from './ActualFieldObservation';
import { actualObservationPhysicalPrefixEvidence } from './ActualObservationPhysicalPrefixHash';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { actualCommunicationEvidenceFromSqlite } from './SqliteActualCommunicationStore';
import { actualCommunicationObservationAt } from './ActualCallCommunication';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';

export type DurableActualFieldObservation = Readonly<{ source: AcceptedActualFieldObservation;
  revision: number; history: readonly AcceptedActualFieldObservation[];
  physicalPrefixHash: string; physicalPrefixHashConvention?: 'owned_motion_observation_prefix_manifest_v1'; observationModelHash: string; receipt: ActualFieldObservationReceipt }>;
export type SqliteActualFieldObservationStore = Readonly<{ accept(sourceId: string): DurableActualFieldObservation;
  read(sourceId: string): DurableActualFieldObservation | null; close(): void }>;
type Authority = Readonly<{ readAcceptedObservation(sourceId: string): AcceptedActualFieldObservation | null }>;
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
type Row = { source_id: string; physical_pitch_source_id: string; player_id: string; base_field_source_id: string;
  execution_source_id: string | null; observation_model_source_id: string; previous_source_id: string | null;
  revision: number; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type Head = { physical_pitch_source_id: string; player_id: string; source_id: string; revision: number };

// Only identity/lineage metadata crosses a historical bound. Never deserialize a
// future Source view, perception receipt, or physical dependency payload here.
const identityColumns = {
  sourceId: 'source_id', physicalPitchSourceId: 'physical_pitch_source_id', playerId: 'player_id',
  baseFieldSourceId: 'base_field_source_id', executionSourceId: 'execution_source_id',
  observationModelSourceId: 'observation_model_source_id', previousObservationSourceId: 'previous_source_id',
} as const;
const identityProjection = (document: string, path = '$') => projection(document, Object.keys(identityColumns), path);
const identityMatches = (metadata: string | null, row: Row) => matches(metadata,
  Object.fromEntries(Object.entries(identityColumns).map(([key, column]) => [key, row[column]])));


/** Separate observation ownership: no physical execution, time advancement, original archive rewrite or AI truth access. */
export const actualFieldObservationEvidenceFromSqlite = (db: Db) => {
  const fields = battedWorldFieldEvidenceFromSqlite(db), executions = battedWorldFieldExecutionEvidenceFromSqlite(db);
  const models = playerObservationModelEvidenceFromSqlite(db);
  const hasExecutions = () => {
    const count = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('batted_world_field_executions','batted_world_field_execution_heads')").get() as { n: number };
    if (count.n !== 0 && count.n !== 2) throw new Error('actual observation execution owner tables differ');
    return count.n === 2;
  };
  const dependencies = (source: AcceptedActualFieldObservation, current = false) => {
    const baseField = fields.read(source.baseFieldSourceId);
    if (!baseField) throw new Error('actual observation original field is missing');
    const world = baseField.response.touch.worldContact, flight = world.flight;
    if (flight.source.physicalPitchSourceId !== source.physicalPitchSourceId) throw new Error('actual observation original pitch scope differs');
    const fieldPrefix = fields.scope(baseField, source.baseFieldSourceId);
    const executionPrefix = hasExecutions() ? executions.scope(baseField, source.executionSourceId) : [];
    if (source.executionSourceId !== null && executionPrefix.at(-1)?.source.sourceId !== source.executionSourceId) {
      throw new Error('actual observation original execution is missing');
    }
    const model = models.read(source.observationModelSourceId);
    const actor = world.modelActorEvidence.find((value) => value.binding.playerId === source.playerId);
    if (!model || !actor || model.source.playerId !== source.playerId || model.source.careerId !== actor.binding.careerId
      || model.source.personLinkSourceId !== actor.binding.personLinkSourceId || json(model.fieldingModel.person) !== json(actor.person)
      || model.source.acceptedAtDay > actor.binding.gameDay) throw new Error('actual observation Player/Person/model scope or day differs');
    if (current) {
      fields.current(baseField);
      const last = executionPrefix.at(-1);
      if (last) executions.current(last);
      else if (hasExecutions() && executions.scope(baseField).length) throw new Error('actual observation pinned execution is stale');
    }
    return { prefix: { baseField, fields: fieldPrefix, executions: executionPrefix }, model };
  };
  const execute = (source: AcceptedActualFieldObservation, previous: DurableActualFieldObservation | null): DurableActualFieldObservation => {
    const { prefix, model } = dependencies(source);
    let communicationEvidence;
    if (source.communicationSourceId !== undefined) {
      const communication = actualCommunicationEvidenceFromSqlite(db).read(source.communicationSourceId);
      const physical = battedWorldFieldPhysicalPrefix(prefix), ball = physical.field.evidence;
      const at = { originTick: ball.originTick, elapsedSeconds: ball.horizon.elapsedSeconds, tick: ball.horizon.ball.tick };
      if (!communication || communication.physicalPitchSourceId !== source.physicalPitchSourceId
        || communication.evaluatedThrough.originTick !== at.originTick || communication.evaluatedThrough.elapsedSeconds > at.elapsedSeconds
        || !prefix.executions.some(value => value.source.sourceId === communication.source.currentExecutionSourceId)) {
        throw new Error('actual observation original communication scope or executed cut differs');
      }
      communicationEvidence = { sourceId: source.communicationSourceId, snapshotHash: hash(communication),
        result: actualCommunicationObservationAt(communication, source.playerId, at) };
    }
    return freeze({ source, revision: (previous?.revision ?? 0) + 1, history: [...(previous?.history ?? []), source],
      ...actualObservationPhysicalPrefixEvidence(prefix), observationModelHash: hash(model),
      receipt: sampleActualFieldObservation(source, prefix, model, previous, communicationEvidence) });
  };
  // Enumerate all duplicate containers/keys before selecting a scope. Earlier
  // history entries are ancestors, not aliases of this row's own Source.
  const identityObjects = (ownId: boolean) => `${nodes('source_json')}
    UNION ALL ${nodes('snapshot_json', ['source'])}
    UNION ALL ${nodes('snapshot_json', ['history', { array: ownId ? 'last' : 'all' }])}`;
  const claims = (key: string) => `EXISTS (SELECT 1 FROM (${nodes('claim.value', [key])}) field
    WHERE field.type='text' AND field.atom=?)`;
  const sourceRows = (sourceId: string) => db.prepare(`SELECT * FROM actual_field_observations WHERE source_id=?
    OR EXISTS (SELECT 1 FROM (${identityObjects(true)}) claim WHERE claim.type='object' AND ${claims('sourceId')})`)
    .all(sourceId, sourceId) as Row[];
  const metadata = (row: Row, prefix: readonly Row[]) => {
    // A fresh continuation must not bless an ancestor with a hidden foreign alias.
    if (sourceRows(row.source_id).length !== 1) throw new Error('actual observation Source ownership scope differs');
    const mirrors = db.prepare(`SELECT
      CASE WHEN json_valid(source_json) THEN ${identityProjection('source_json')} END AS source_identity,
      CASE WHEN json_valid(snapshot_json) THEN ${identityProjection('snapshot_json', '$.source')} END AS snapshot_identity,
      CASE WHEN json_valid(snapshot_json) THEN (SELECT json_group_array(key) FROM json_each(snapshot_json)
        WHERE key IN ('source','history','revision')) END AS containers,
      CASE WHEN json_valid(snapshot_json) THEN json_type(snapshot_json,'$.revision') END AS revision_type,
      CASE WHEN json_valid(snapshot_json) THEN json_extract(snapshot_json,'$.revision') END AS revision,
      CASE WHEN json_valid(snapshot_json) THEN json_type(snapshot_json,'$.history') END AS history_type,
      CASE WHEN json_valid(snapshot_json) THEN json_array_length(snapshot_json,'$.history') END AS history_length
      FROM actual_field_observations WHERE source_id=?`).get(row.source_id) as {
        source_identity: string | null; snapshot_identity: string | null; containers: string | null; revision_type: string | null;
        revision: number | null; history_type: string | null; history_length: number | null;
      };
    if (mirrors.source_identity !== null && !identityMatches(mirrors.source_identity, row)) {
      throw new Error('actual observation Source identity metadata differs');
    }
    // The optional communication dependency is metadata too. Inspect it without
    // decoding future view/model/perceived-world payloads, and retain omission
    // for old Sources rather than inventing a null property in their archives.
    const communicationIdentity = (sourceRow: Row): Readonly<Record<string, string>> => {
      const selected = db.prepare(`WITH ownership_document(document) AS (VALUES(?)) SELECT ${projection('document', ['communicationSourceId'])} AS identity FROM ownership_document`).get(sourceRow.source_json) as { identity: string };
      const fields = JSON.parse(selected.identity) as [string, string, string | null][];
      if (fields.length === 0) return {};
      if (fields.length !== 1 || fields[0][1] !== 'text' || !id(fields[0][2])) throw new Error('ambiguous actual observation communication identity');
      return { communicationSourceId: fields[0][2] };
    };
    const ownCommunication = communicationIdentity(row);
    if (mirrors.snapshot_identity !== null) {
      const communicationMirrors = db.prepare(`WITH ownership_document(document) AS (VALUES(?)) SELECT ${projection('n.value', ['communicationSourceId'])} AS identity
        FROM (${nodes('(SELECT document FROM ownership_document)', ['source'])}) n`).all(row.snapshot_json) as { identity: string }[];
      if (communicationMirrors.length !== 1 || !matches(communicationMirrors[0].identity, ownCommunication)) {
        throw new Error('actual observation communication identity mirror differs');
      }
      if (JSON.stringify((JSON.parse(mirrors.containers!) as string[]).sort()) !== '["history","revision","source"]'
        || !identityMatches(mirrors.snapshot_identity, row) || mirrors.revision_type !== 'integer' || mirrors.revision !== row.revision
        || mirrors.history_type !== 'array' || mirrors.history_length !== prefix.length) {
        throw new Error('actual observation snapshot identity metadata differs');
      }
      const history = db.prepare(`SELECT h.key AS position,
        CASE WHEN h.type='object' THEN ${identityProjection('h.value')} END AS identity
        FROM actual_field_observations, json_each(CASE WHEN json_valid(snapshot_json) THEN snapshot_json ELSE '{}' END,'$.history') h
        WHERE source_id=? ORDER BY h.key`).all(row.source_id) as { position: number; identity: string | null }[];
      if (history.length !== prefix.length || history.some((entry, index) => entry.position !== index
        || !identityMatches(entry.identity, prefix[index]))) throw new Error('actual observation history identity metadata differs');
      const communications = db.prepare(`WITH ownership_document(document) AS (VALUES(?)) SELECT ${projection('n.value', ['communicationSourceId'])} AS identity
        FROM (${nodes('(SELECT document FROM ownership_document)', ['history', { array: 'all' }])}) n`).all(row.snapshot_json) as { identity: string }[];
      if (communications.length !== prefix.length || communications.some((entry, index) => !matches(entry.identity, communicationIdentity(prefix[index])))) {
        throw new Error('actual observation communication history identity differs');
      }
    }
  };
  const scope = (pitchId: string, playerId: string, throughSourceId?: string): readonly DurableActualFieldObservation[] => {
    const owners = `(physical_pitch_source_id=? AND player_id=?)
      OR EXISTS (SELECT 1 FROM (${identityObjects(false)}) claim WHERE claim.type='object'
        AND ${claims('physicalPitchSourceId')} AND ${claims('playerId')})`;
    const args = [pitchId, playerId, pitchId, playerId];
    const rows = db.prepare(`SELECT * FROM actual_field_observations WHERE ${owners} ORDER BY revision`).all(...args) as Row[];
    const heads = db.prepare(`SELECT * FROM actual_field_observation_heads WHERE (physical_pitch_source_id=? AND player_id=?)
      OR source_id IN (SELECT source_id FROM actual_field_observations WHERE ${owners})`).all(pitchId, playerId, ...args) as Head[];
    if (!rows.length) { if (heads.length || throughSourceId) throw new Error('unowned actual observation head'); return []; }
    const head = heads[0];
    if (heads.length !== 1 || head.physical_pitch_source_id !== pitchId || head.player_id !== playerId
      || head.source_id !== rows.at(-1)!.source_id || head.revision !== rows.length) throw new Error('actual observation prefix head differs');
    const unique = new Set<string>();
    let priorFieldRevision = 0, priorExecutionRevision = 0, executionBaseId: string | null = null;
    for (const [index, row] of rows.entries()) {
      if (!id(row.source_id) || unique.has(row.source_id) || row.revision !== index + 1 || row.physical_pitch_source_id !== pitchId
        || row.player_id !== playerId || row.previous_source_id !== (rows[index - 1]?.source_id ?? null)
        || !id(row.base_field_source_id) || !id(row.observation_model_source_id)
        || row.execution_source_id !== null && !id(row.execution_source_id)) throw new Error('corrupt actual observation prefix metadata');
      metadata(row, rows.slice(0, index + 1));
      if (row.observation_model_source_id !== rows[0].observation_model_source_id) throw new Error('actual observation model prefix metadata differs');
      const field = db.prepare('SELECT physical_pitch_source_id,revision,game_id FROM batted_world_field_actions WHERE source_id=?')
        .get(row.base_field_source_id) as { physical_pitch_source_id: string; revision: number; game_id: string } | undefined;
      if (!field || field.physical_pitch_source_id !== pitchId || !Number.isSafeInteger(field.revision) || field.revision < 1
        || field.revision < priorFieldRevision || executionBaseId !== null && row.base_field_source_id !== executionBaseId) {
        throw new Error('actual observation field prefix metadata differs');
      }
      priorFieldRevision = field.revision;
      if (row.execution_source_id !== null) {
        if (!hasExecutions()) throw new Error('actual observation execution metadata is missing');
        const execution = db.prepare('SELECT physical_pitch_source_id,base_field_source_id,revision,game_id FROM batted_world_field_executions WHERE source_id=?')
          .get(row.execution_source_id) as { physical_pitch_source_id: string; base_field_source_id: string; revision: number; game_id: string } | undefined;
        if (!execution || execution.physical_pitch_source_id !== pitchId || execution.base_field_source_id !== row.base_field_source_id
          || execution.game_id !== field.game_id || !Number.isSafeInteger(execution.revision) || execution.revision < 1
          || execution.revision < priorExecutionRevision) throw new Error('actual observation execution prefix metadata differs');
        priorExecutionRevision = execution.revision; executionBaseId = row.base_field_source_id;
      } else if (priorExecutionRevision > 0) throw new Error('actual observation execution metadata moved backward');
      unique.add(row.source_id);
    }
    const bound = throughSourceId === undefined ? rows.length - 1 : rows.findIndex((row) => row.source_id === throughSourceId);
    if (bound < 0) throw new Error('actual observation Source is outside its prefix');
    const values: DurableActualFieldObservation[] = [];
    for (const row of rows.slice(0, bound + 1)) {
      const source = input(JSON.parse(row.source_json) as AcceptedActualFieldObservation, row.source_id);
      if (source.physicalPitchSourceId !== pitchId || source.playerId !== playerId || source.baseFieldSourceId !== row.base_field_source_id
        || source.executionSourceId !== row.execution_source_id || source.observationModelSourceId !== row.observation_model_source_id
        || source.previousObservationSourceId !== row.previous_source_id || row.source_json !== json(source) || row.source_hash !== hash(source)) {
        throw new Error('corrupt original actual observation Source');
      }
      const value = execute(source, values.at(-1) ?? null);
      if (row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt actual observation snapshot');
      values.push(value);
    }
    return values;
  };
  const read = (sourceId: string): DurableActualFieldObservation | null => {
    if (!id(sourceId)) throw new Error('invalid actual observation scope');
    const rows = sourceRows(sourceId);
    if (rows.length > 1) throw new Error('actual observation Source ownership scope differs');
    const row = rows[0];
    if (!row) return null;
    if (row.source_id !== sourceId) throw new Error('actual observation Source identity mirror differs');
    const source = input(JSON.parse(row.source_json) as AcceptedActualFieldObservation, sourceId);
    return scope(source.physicalPitchSourceId, source.playerId, sourceId).at(-1)!;
  };
  const derive = (source: AcceptedActualFieldObservation) => {
    const previous = scope(source.physicalPitchSourceId, source.playerId).at(-1) ?? null;
    if (source.previousObservationSourceId !== (previous?.source.sourceId ?? null)) throw new Error('actual observation predecessor differs');
    return execute(source, previous);
  };
  const currentDependencies = (value: DurableActualFieldObservation) => {
    const { prefix, model } = dependencies(value.source, true);
    const evidence = actualObservationPhysicalPrefixEvidence(prefix);
    if (evidence.physicalPrefixHash !== value.physicalPrefixHash || evidence.physicalPrefixHashConvention !== value.physicalPrefixHashConvention
      || hash(model) !== value.observationModelHash) throw new Error('actual observation dependencies changed during write');
    if (value.source.communicationSourceId !== undefined) {
      const communication = actualCommunicationEvidenceFromSqlite(db).read(value.source.communicationSourceId);
      if (!communication || hash(communication) !== value.receipt.communicationEvidence?.snapshotHash) throw new Error('actual observation communication changed during write');
    }
  };
  const currentBefore = (value: DurableActualFieldObservation) => {
    currentDependencies(value);
    if (json(derive(value.source)) !== json(value)) throw new Error('actual observation original changed before write');
  };
  const current = (value: DurableActualFieldObservation) => {
    currentDependencies(value); const values = scope(value.source.physicalPitchSourceId, value.source.playerId);
    if (values.length !== value.revision || json(values.at(-1)) !== json(value)) throw new Error('actual observation prefix changed during write');
  };
  return { read, derive, currentBefore, current };
};

export const openSqliteActualFieldObservationStore = (path: string, authority?: Authority): SqliteActualFieldObservationStore => {
  if (!id(path) || authority != null && typeof authority.readAcceptedObservation !== 'function') throw new Error('invalid actual observation Source owner');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS actual_field_observations (source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT NOT NULL,
    player_id TEXT NOT NULL,base_field_source_id TEXT NOT NULL,execution_source_id TEXT,observation_model_source_id TEXT NOT NULL,
    previous_source_id TEXT,revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    UNIQUE(physical_pitch_source_id,player_id,revision));
    CREATE TABLE IF NOT EXISTS actual_field_observation_heads (physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,
    source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL,PRIMARY KEY(physical_pitch_source_id,player_id));`);
  const own = actualFieldObservationEvidenceFromSqlite(db); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed actual observation scope'); };
  // Keep authority callbacks between fresh private snapshots. Existing caller
  // and writer transactions retain their ownership and writable revalidation.
  const reading = <T>(work: () => T): T => {
    if (db.isTransaction) return work();
    db.exec('BEGIN');
    try { const value = withBattedWorldPhysicalReadTraversal(db, work); db.exec('COMMIT'); return value; }
    catch (error) {
      if (db.isTransaction) try { db.exec('ROLLBACK'); }
      catch (cleanup) { throw new AggregateError([error, cleanup], 'actual observation private read rollback failed', { cause: error }); }
      throw error;
    }
  };
  return Object.freeze({ read(sourceId) { check(sourceId); return reading(() => own.read(sourceId)); },
    accept(sourceId) {
      check(sourceId); const prior = reading(() => own.read(sourceId)), raw = authority?.readAcceptedObservation(sourceId) ?? null;
      const source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('actual observation Source is frozen differently');
        const saved = reading(() => own.read(sourceId));
        if (!saved || json(saved) !== json(prior)) throw new Error('actual observation original changed during retry');
        return saved;
      }
      if (!source) throw new Error('accepted actual observation Source is missing');
      const value = reading(() => { const derived = own.derive(source); own.currentBefore(derived); return derived; });
      db.exec('BEGIN IMMEDIATE');
      try {
        const liveFence = beginActualLivePitchWrite(db, source.physicalPitchSourceId, { owner: 'actual_field_observations', sourceId });
        own.currentBefore(value);
        db.prepare('INSERT INTO actual_field_observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.physicalPitchSourceId,
          source.playerId, source.baseFieldSourceId, source.executionSourceId, source.observationModelSourceId, source.previousObservationSourceId,
          value.revision, json(source), hash(source), json(value), hash(value));
        if (value.revision === 1) db.prepare('INSERT INTO actual_field_observation_heads VALUES (?,?,?,?)')
          .run(source.physicalPitchSourceId, source.playerId, sourceId, 1);
        else {
          const changed = db.prepare(`UPDATE actual_field_observation_heads SET source_id=?,revision=?
            WHERE physical_pitch_source_id=? AND player_id=? AND source_id=? AND revision=?`)
            .run(sourceId, value.revision, source.physicalPitchSourceId, source.playerId, source.previousObservationSourceId, value.revision - 1);
          if (Number(changed.changes) !== 1) throw new Error('actual observation predecessor changed during write');
        }
        recordActualLivePlayAdmission(db, liveFence);
        own.current(value); const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('actual observation original changed during write');
        assertActualLivePlayWriteUnchanged(db, liveFence); db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }, close() { if (!closed) { db.close(); closed = true; } },
  });
};
