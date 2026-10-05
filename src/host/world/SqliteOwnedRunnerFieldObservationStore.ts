import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { createRequire } from 'node:module';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches } from './SqliteOwnershipMetadata';
import { actualObservationId as id } from './ActualFieldObservation';
import { ownedRunnerFieldObservationHistoryInput as input, runnerObservationSensoryInput, runnerObservationProjectionInput,
  type AcceptedOwnedRunnerFieldObservationHistory, type DurableOwnedRunnerFieldObservationHistory } from './OwnedRunnerFieldObservationHistory';
import { sampleOwnedRunnerFieldObservationWithPrevious } from './OwnedRunnerFieldObservation';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldEvidenceFromSqlite, withBattedWorldFieldReadTraversal } from './SqliteBattedWorldFieldStore';

export type SqliteOwnedRunnerFieldObservationStore = Readonly<{ accept(sourceId: string): DurableOwnedRunnerFieldObservationHistory;
  read(sourceId: string): DurableOwnedRunnerFieldObservationHistory | null; close(): void }>;
type Authority = Readonly<{ readAcceptedObservation(sourceId: string): AcceptedOwnedRunnerFieldObservationHistory | null }>;
type Db = import('node:sqlite').DatabaseSync;
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
export const ownedRunnerFieldObservationHistoryEvidenceFromSqlite = (db: Db) => {
  const fields = battedWorldFieldEvidenceFromSqlite(db);
  const execute = (source: AcceptedOwnedRunnerFieldObservationHistory,
    previous: DurableOwnedRunnerFieldObservationHistory | null): DurableOwnedRunnerFieldObservationHistory => {
    if (previous && (previous.source.prePitchRunnerSourceId !== source.prePitchRunnerSourceId
      || previous.source.kind !== source.kind)) throw new Error('runner observation original predecessor scope differs');
    if (previous) {
      const rank = (sourceId: string) => db.prepare('SELECT revision,physical_pitch_source_id,game_id FROM batted_world_field_actions WHERE source_id=?')
        .get(sourceId) as { revision: number; physical_pitch_source_id: string; game_id: string } | undefined;
      const before = rank(previous.source.baseFieldSourceId), current = rank(source.baseFieldSourceId);
      if (!before || !current || current.revision < before.revision || current.physical_pitch_source_id !== before.physical_pitch_source_id
        || current.game_id !== before.game_id) throw new Error('runner observation field lineage moved backward or changed scope');
    }
    const projected = sampleOwnedRunnerFieldObservationWithPrevious(db, runnerObservationProjectionInput(source),
      previous ? { source: runnerObservationSensoryInput(previous.source), receipt: previous.receipt } : null);
    return freeze({ ...projected, version: 'owned_runner_field_observation_history_v1', source,
      revision: (previous?.revision ?? 0) + 1, history: [...(previous?.history ?? []), source] });
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
  const metadata = (row: Row, prefix: readonly Row[], runnerId: string) => {
    // A fresh continuation must not bless an ancestor with a hidden foreign alias.
    if (sourceRows(row.source_id).length !== 1) throw new Error('runner observation Source ownership scope differs');
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
      throw new Error('runner observation Source identity metadata differs');
    }
    const expectedRunner = { kind: 'owned_runner_field_observation_history_v1', prePitchRunnerSourceId: runnerId };
    const selected = db.prepare(`SELECT CASE WHEN json_valid(source_json) THEN ${projection('source_json', Object.keys(expectedRunner))} END AS identity
      FROM actual_field_observations WHERE source_id=?`).get(row.source_id) as { identity: string | null };
    if (selected.identity !== null && !matches(selected.identity, expectedRunner)) throw new Error('runner observation capability metadata differs');
    if (mirrors.snapshot_identity !== null) {
      const runnerMirrors = db.prepare(`WITH ownership_document(document) AS (VALUES(?)) SELECT ${projection('n.value', Object.keys(expectedRunner))} AS identity
        FROM (${nodes('(SELECT document FROM ownership_document)', ['source'])}) n`)
        .all(row.snapshot_json) as { identity: string }[];
      if (runnerMirrors.length !== 1 || !matches(runnerMirrors[0].identity, expectedRunner)) throw new Error('runner observation capability mirror differs');
      if (JSON.stringify((JSON.parse(mirrors.containers!) as string[]).sort()) !== '["history","revision","source"]'
        || !identityMatches(mirrors.snapshot_identity, row) || mirrors.revision_type !== 'integer' || mirrors.revision !== row.revision
        || mirrors.history_type !== 'array' || mirrors.history_length !== prefix.length) {
        throw new Error('runner observation snapshot identity metadata differs');
      }
      const history = db.prepare(`SELECT h.key AS position,
        CASE WHEN h.type='object' THEN ${identityProjection('h.value')} END AS identity
        FROM actual_field_observations, json_each(CASE WHEN json_valid(snapshot_json) THEN snapshot_json ELSE '{}' END,'$.history') h
        WHERE source_id=? ORDER BY h.key`).all(row.source_id) as { position: number; identity: string | null }[];
      if (history.length !== prefix.length || history.some((entry, index) => entry.position !== index
        || !identityMatches(entry.identity, prefix[index]))) throw new Error('runner observation history identity metadata differs');
      const runnerHistory = db.prepare(`WITH ownership_document(document) AS (VALUES(?)) SELECT ${projection('n.value', Object.keys(expectedRunner))} AS identity
        FROM (${nodes('(SELECT document FROM ownership_document)', ['history', { array: 'all' }])}) n`)
        .all(row.snapshot_json) as { identity: string }[];
      if (runnerHistory.length !== prefix.length || runnerHistory.some(entry => !matches(entry.identity, expectedRunner))) {
        throw new Error('runner observation capability history differs');
      }
    }
  };
  const scope = (pitchId: string, playerId: string, throughSourceId?: string): readonly DurableOwnedRunnerFieldObservationHistory[] => {
    const owners = `(physical_pitch_source_id=? AND player_id=?)
      OR EXISTS (SELECT 1 FROM (${identityObjects(false)}) claim WHERE claim.type='object'
        AND ${claims('physicalPitchSourceId')} AND ${claims('playerId')})`;
    const args = [pitchId, playerId, pitchId, playerId];
    const rows = db.prepare(`SELECT * FROM actual_field_observations WHERE ${owners} ORDER BY revision`).all(...args) as Row[];
    const heads = db.prepare(`SELECT * FROM actual_field_observation_heads WHERE (physical_pitch_source_id=? AND player_id=?)
      OR source_id IN (SELECT source_id FROM actual_field_observations WHERE ${owners})`).all(pitchId, playerId, ...args) as Head[];
    if (!rows.length) { if (heads.length || throughSourceId) throw new Error('unowned runner observation head'); return []; }
    const head = heads[0];
    if (heads.length !== 1 || head.physical_pitch_source_id !== pitchId || head.player_id !== playerId
      || head.source_id !== rows.at(-1)!.source_id || head.revision !== rows.length) throw new Error('runner observation prefix head differs');
    const unique = new Set<string>();
    const firstSource = input(JSON.parse(rows[0].source_json) as AcceptedOwnedRunnerFieldObservationHistory, rows[0].source_id);
    let priorFieldRevision = 0;
    for (const [index, row] of rows.entries()) {
      if (!id(row.source_id) || unique.has(row.source_id) || row.revision !== index + 1 || row.physical_pitch_source_id !== pitchId
        || row.player_id !== playerId || row.previous_source_id !== (rows[index - 1]?.source_id ?? null)
        || !id(row.base_field_source_id) || !id(row.observation_model_source_id)
        || row.execution_source_id !== null) throw new Error('corrupt runner observation prefix metadata');
      metadata(row, rows.slice(0, index + 1), firstSource.prePitchRunnerSourceId);
      if (row.observation_model_source_id !== rows[0].observation_model_source_id) throw new Error('runner observation model prefix metadata differs');
      const field = db.prepare('SELECT physical_pitch_source_id,revision,game_id FROM batted_world_field_actions WHERE source_id=?')
        .get(row.base_field_source_id) as { physical_pitch_source_id: string; revision: number; game_id: string } | undefined;
      if (!field || field.physical_pitch_source_id !== pitchId || !Number.isSafeInteger(field.revision) || field.revision < 1
        || field.revision < priorFieldRevision) {
        throw new Error('runner observation field prefix metadata differs');
      }
      priorFieldRevision = field.revision;
      unique.add(row.source_id);
    }
    const bound = throughSourceId === undefined ? rows.length - 1 : rows.findIndex((row) => row.source_id === throughSourceId);
    if (bound < 0) throw new Error('runner observation Source is outside its prefix');
    const values: DurableOwnedRunnerFieldObservationHistory[] = [];
    for (const row of rows.slice(0, bound + 1)) {
      const source = input(JSON.parse(row.source_json) as AcceptedOwnedRunnerFieldObservationHistory, row.source_id);
      if (source.physicalPitchSourceId !== pitchId || source.playerId !== playerId || source.baseFieldSourceId !== row.base_field_source_id
        || source.executionSourceId !== row.execution_source_id || source.observationModelSourceId !== row.observation_model_source_id
        || source.previousObservationSourceId !== row.previous_source_id || row.source_json !== json(source) || row.source_hash !== hash(source)) {
        throw new Error('corrupt original runner observation Source');
      }
      const value = execute(source, values.at(-1) ?? null);
      if (row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt runner observation snapshot');
      values.push(value);
    }
    return values;
  };
  const read = (sourceId: string): DurableOwnedRunnerFieldObservationHistory | null => {
    if (!id(sourceId)) throw new Error('invalid runner observation scope');
    const rows = sourceRows(sourceId);
    if (rows.length > 1) throw new Error('runner observation Source ownership scope differs');
    const row = rows[0];
    if (!row) return null;
    if (row.source_id !== sourceId) throw new Error('runner observation Source identity mirror differs');
    const source = input(JSON.parse(row.source_json) as AcceptedOwnedRunnerFieldObservationHistory, sourceId);
    return scope(source.physicalPitchSourceId, source.playerId, sourceId).at(-1)!;
  };
  const derive = (raw: AcceptedOwnedRunnerFieldObservationHistory) => {
    const source = input(raw);
    const previous = scope(source.physicalPitchSourceId, source.playerId).at(-1) ?? null;
    if (source.previousObservationSourceId !== (previous?.source.sourceId ?? null)) throw new Error('runner observation predecessor differs');
    return execute(source, previous);
  };
  const currentDependencies = (value: DurableOwnedRunnerFieldObservationHistory) => {
    const field = fields.read(value.source.baseFieldSourceId);
    if (!field || field.source.kind !== 'owned_runner_field_pieces_v1') throw new Error('runner observation current field is missing');
    fields.current(field);
    // Full same-cut rederivation checks original actor/Person/model dependencies,
    // including uncommitted trigger changes; no stored projection is authority.
    const prior = value.history.length > 1 ? read(value.source.previousObservationSourceId!) : null;
    const actual = execute(value.source, prior);
    if (json(actual) !== json(value)) throw new Error('runner observation dependencies changed during write');
  };
  const currentBefore = (value: DurableOwnedRunnerFieldObservationHistory) => {
    currentDependencies(value);
    if (json(derive(value.source)) !== json(value)) throw new Error('runner observation original changed before write');
  };
  const current = (value: DurableOwnedRunnerFieldObservationHistory) => {
    currentDependencies(value); const values = scope(value.source.physicalPitchSourceId, value.source.playerId);
    if (values.length !== value.revision || json(values.at(-1)) !== json(value)) throw new Error('runner observation prefix changed during write');
  };
  const snapshot = <T>(work: () => T): T => {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    if (!(db instanceof DatabaseSync)) throw new Error('runner observation history requires its native read connection');
    const run = () => withBattedWorldFieldReadTraversal(db, work);
    if (db.isTransaction) return run();
    db.exec('BEGIN');
    try { const value = run(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return { read: (sourceId: string) => snapshot(() => read(sourceId)),
    derive: (source: AcceptedOwnedRunnerFieldObservationHistory) => snapshot(() => derive(source)),
    currentBefore: (value: DurableOwnedRunnerFieldObservationHistory) => snapshot(() => currentBefore(value)),
    current: (value: DurableOwnedRunnerFieldObservationHistory) => snapshot(() => current(value)) };
};

export const openSqliteOwnedRunnerFieldObservationStore = (path: string, authority?: Authority): SqliteOwnedRunnerFieldObservationStore => {
  if (!id(path) || authority != null && typeof authority.readAcceptedObservation !== 'function') throw new Error('invalid runner observation Source owner');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS actual_field_observations (source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT NOT NULL,
    player_id TEXT NOT NULL,base_field_source_id TEXT NOT NULL,execution_source_id TEXT,observation_model_source_id TEXT NOT NULL,
    previous_source_id TEXT,revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    UNIQUE(physical_pitch_source_id,player_id,revision));
    CREATE TABLE IF NOT EXISTS actual_field_observation_heads (physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,
    source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL,PRIMARY KEY(physical_pitch_source_id,player_id));`);
  const own = ownedRunnerFieldObservationHistoryEvidenceFromSqlite(db); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed runner observation scope'); };
  return Object.freeze({ read(sourceId) { check(sourceId); return own.read(sourceId); },
    accept(sourceId) {
      check(sourceId); const prior = own.read(sourceId), raw = authority?.readAcceptedObservation(sourceId) ?? null;
      const source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('runner observation Source is frozen differently');
        const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(prior)) throw new Error('runner observation original changed during retry');
        return saved;
      }
      if (!source) throw new Error('accepted runner observation Source is missing');
      const value = own.derive(source); own.currentBefore(value);
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
          if (Number(changed.changes) !== 1) throw new Error('runner observation predecessor changed during write');
        }
        recordActualLivePlayAdmission(db, liveFence);
        own.current(value); const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('runner observation original changed during write');
        assertActualLivePlayWriteUnchanged(db, liveFence); db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }, close() { if (!closed) { db.close(); closed = true; } },
  });
};
