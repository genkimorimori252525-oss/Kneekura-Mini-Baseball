import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createBattedWorldFieldGeometry, deriveBattedWorldFieldMotion, deriveInitialBattedWorldFieldMotion,
  type BattedWorldFieldGeometry, type BattedWorldFieldGeometryInput, type BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedContactResponseEvidenceFromSqlite, type DurableBattedContactResponse, type SqliteBattedContactResponseStore } from './SqliteBattedContactResponseStore';
import { battedWorldBaseGeometryEvidenceFromSqlite, type DurableBattedWorldBaseGeometry, type SqliteBattedWorldBaseGeometryStore } from './SqliteBattedWorldBaseGeometryStore';
import { battedWorldResponseInput } from './SqliteBattedWorldContinuationStore';
import { battedWorldMotionCommandsInput, battedWorldMotionPrimitiveCommands, type AcceptedBattedWorldMotion } from './SqliteBattedWorldMotionStore';
import { battedWorldFieldTerritoryFromPrefix } from './BattedWorldFieldTerritoryFromPrefix';
import { assertNoBattedWorldFieldExecutionOwner } from './BattedWorldMotionOwnershipFence';
import { deriveOwnedRunnerFieldMotion, type OwnedRunnerFieldCapability } from './OwnedRunnerFieldMotion';

export type AcceptedBattedWorldFieldGeometry = Readonly<{ sourceId: string; sourceVersion: string; baseGeometrySourceId: string;
  baseModels: BattedWorldFieldGeometryInput['baseModels'] }>;
export type DurableBattedWorldFieldGeometry = Readonly<{ source: AcceptedBattedWorldFieldGeometry;
  baseGeometry: DurableBattedWorldBaseGeometry; geometry: BattedWorldFieldGeometry }>;
export type AcceptedBattedWorldFieldAction = Readonly<{ sourceId: string; sourceVersion: string; responseSourceId: string;
  geometrySourceId: string; previousFieldSourceId: string | null; availableAtTick: number; throughTick: number;
  commands: AcceptedBattedWorldMotion['commands'] }> & OwnedRunnerFieldCapability;
type Root = Readonly<{ response: DurableBattedContactResponse; geometry: DurableBattedWorldFieldGeometry }>;
export type DurableBattedWorldFieldAction = Root & Readonly<{ source: AcceptedBattedWorldFieldAction; revision: number;
  history: readonly AcceptedBattedWorldFieldAction[]; field: BattedWorldFieldMotion }>;
export type SqliteBattedWorldFieldStore = Readonly<{ acceptGeometry(sourceId: string): DurableBattedWorldFieldGeometry;
  readGeometry(sourceId: string): DurableBattedWorldFieldGeometry | null;
  accept(sourceId: string): DurableBattedWorldFieldAction; read(sourceId: string): DurableBattedWorldFieldAction | null;
  interpret(sourceId: string): ReturnType<typeof battedWorldFieldTerritoryFromPrefix> | null; close(): void }>;
type Authority = Readonly<{ readAcceptedGeometry(sourceId: string): AcceptedBattedWorldFieldGeometry | null;
  readAcceptedAction(sourceId: string): AcceptedBattedWorldFieldAction | null }>;
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
// Only completed own reads can seed this synchronous physical traversal. No
// public setter accepts evidence; caller-supplied scope objects are never seeds.
type FieldReadTraversal = Readonly<{ check(): void;
  nodes: Map<string, Readonly<{ value: DurableBattedWorldFieldAction; snapshotJson: string; snapshotHash: string }>>;
  roots: Map<string, DurableBattedWorldFieldAction>; authenticated: WeakSet<object> }>;
const fieldReadTraversals = new WeakMap<Db, FieldReadTraversal>();

/** Internal root-owned read bracket. It never replaces a connection authorizer.
 * query_only belongs to this synchronous operation, not an adversarial SQL sandbox. */
export const withBattedWorldFieldReadTraversal = <T>(db: Db, body: () => T): T => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync) || !db.isTransaction) return body();
  const prior = fieldReadTraversals.get(db), name = `physical_field_read_${randomUUID().replaceAll('-', '')}`;
  const queryOnly = () => db.prepare('PRAGMA query_only').get()!.query_only;
  const beforeQueryOnly = queryOnly();
  if (beforeQueryOnly !== 0 && beforeQueryOnly !== 1) throw new Error('physical read query-only state is unavailable');
  const stamp = () => [db.prepare('SELECT total_changes() AS changes').get()!.changes,
    db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    db.prepare('PRAGMA temp.schema_version').get()!.schema_version] as const;
  let savepoint = false, failed = false, failure: unknown, value!: T;
  const cleanupErrors: unknown[] = [];
  try {
    db.exec(`SAVEPOINT ${name}`); savepoint = true;
    if (beforeQueryOnly === 0) db.exec('PRAGMA query_only=ON');
    if (queryOnly() !== 1) throw new Error('physical read query-only setting was not established');
    const original = stamp();
    const check = () => {
      const current = stamp();
      if (!db.isTransaction || queryOnly() !== 1 || current.some((v, i) => v !== original[i])) {
        throw new Error('physical read transaction or dependencies changed during traversal');
      }
    };
    fieldReadTraversals.set(db, { check, nodes: new Map(), roots: new Map(), authenticated: new WeakSet() });
    value = body(); check();
    // Counters cannot identify rollback/rebegin. The private savepoint must
    // still belong to the original enclosing transaction before evidence escapes.
    db.exec(`RELEASE ${name}`); savepoint = false;
    if (!db.isTransaction) throw new Error('physical read transaction ended during traversal');
  } catch (error) { failed = true; failure = error; }
  finally {
    if (prior) fieldReadTraversals.set(db, prior); else fieldReadTraversals.delete(db);
    if (savepoint) try { db.exec(`RELEASE ${name}`); } catch (error) { cleanupErrors.push(error); }
    try {
      if (queryOnly() !== beforeQueryOnly) db.exec(`PRAGMA query_only=${beforeQueryOnly}`);
      if (queryOnly() !== beforeQueryOnly) throw new Error('physical read query-only setting could not be restored');
    } catch (error) { cleanupErrors.push(error); }
  }
  if (cleanupErrors.length) throw new AggregateError([...(failed ? [failure] : []), ...cleanupErrors],
    'physical read transaction or setting cleanup failed', { cause: failed ? failure : cleanupErrors[0] });
  if (failed) throw failure;
  return value;
};

/** Identity-only eligibility, never a way to install caller evidence. */
export const isAuthenticatedBattedWorldFieldTraversalValue = (db: Db, value: DurableBattedWorldFieldAction): boolean => {
  const traversal = fieldReadTraversals.get(db); traversal?.check();
  return traversal?.authenticated.has(value) ?? false;
};

type GeometryRow = { source_id: string; base_geometry_source_id: string; game_id: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type ActionRow = { source_id: string; physical_pitch_source_id: string; response_source_id: string; geometry_source_id: string;
  previous_source_id: string | null; revision: number; game_id: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type Head = { physical_pitch_source_id: string; response_source_id: string; geometry_source_id: string; source_id: string; revision: number };
const id = (v: unknown): v is string => typeof v === 'string' && !!v.length && v === v.trim();
const tick = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const fields = (v: unknown, names: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const geometryInput = (raw: AcceptedBattedWorldFieldGeometry, sourceId: string) => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'baseGeometrySourceId', 'baseModels']) || s.sourceId !== sourceId
    || ![sourceId, s.sourceVersion, s.baseGeometrySourceId].every(id)) throw new Error('invalid accepted actual field calibration Source');
  return s;
};
const actionInput = (raw: AcceptedBattedWorldFieldAction, sourceId: string) => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'responseSourceId', 'geometrySourceId', 'previousFieldSourceId', 'availableAtTick', 'throughTick', 'commands',
    ...('kind' in s ? ['kind', 'prePitchRunnerSourceId'] : [])])
    || 'kind' in s && (s.kind !== 'owned_runner_field_v1' || !id(s.prePitchRunnerSourceId))
    || s.sourceId !== sourceId || ![sourceId, s.sourceVersion, s.responseSourceId, s.geometrySourceId].every(id)
    || s.previousFieldSourceId !== null && (!id(s.previousFieldSourceId) || s.previousFieldSourceId === sourceId)
    || !tick(s.availableAtTick) || !tick(s.throughTick)) throw new Error('invalid accepted actual field action Source');
  return { ...s, commands: battedWorldMotionCommandsInput(s.commands) };
};
const physicalId = (root: Root) => root.response.touch.worldContact.flight.source.physicalPitchSourceId;
const noOldOwner = (db: Db, pitchId: string) => {
  for (const table of ['batted_world_continuations', 'batted_world_acquisitions', 'batted_world_motions', 'batted_world_motion_heads',
    'batted_world_executions', 'batted_world_execution_heads']) {
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)) continue;
    const columns = new Set((db.prepare('SELECT name FROM pragma_table_info(?)').all(table) as { name: string }[]).map((c) => c.name));
    const clauses = ['physical_pitch_source_id=?'], arguments_ = [pitchId];
    if (columns.has('source_json')) {
      clauses.push(`CASE WHEN json_valid(source_json) THEN json_extract(source_json,'$.responseSourceId') END
        IN (SELECT source_id FROM batted_contact_responses WHERE physical_pitch_source_id=?)`);
      arguments_.push(pitchId);
    }
    if (columns.has('snapshot_json')) {
      for (const path of ['$.response.touch.worldContact.flight.source.physicalPitchSourceId', '$.baseMotion.response.touch.worldContact.flight.source.physicalPitchSourceId']) {
        clauses.push(`CASE WHEN json_valid(snapshot_json) THEN json_extract(snapshot_json,'${path}') END=?`); arguments_.push(pitchId);
      }
    }
    if (db.prepare(`SELECT source_id FROM ${table} WHERE ${clauses.join(' OR ')} LIMIT 1`).get(...arguments_)) {
      throw new Error('an earlier actual batted World owner already executed this field prefix');
    }
  }
};

/** Additive original field owner. Historical bounded reads never replay future action payloads. */
export const battedWorldFieldEvidenceFromSqlite = (db: Db) => {
  const ownResponses = battedContactResponseEvidenceFromSqlite(db), ownBases = battedWorldBaseGeometryEvidenceFromSqlite(db);
  const deriveGeometry = (source: AcceptedBattedWorldFieldGeometry): DurableBattedWorldFieldGeometry => {
    const baseGeometry = ownBases.read(source.baseGeometrySourceId);
    if (!baseGeometry) throw new Error('actual field original fixture geometry is missing');
    const geometry = createBattedWorldFieldGeometry({ baseGeometry: baseGeometry.geometry, baseModels: source.baseModels });
    return freeze({ source, baseGeometry, geometry });
  };
  const checkGeometryRow = (row: GeometryRow, value: DurableBattedWorldFieldGeometry) => {
    if (row.source_id !== value.source.sourceId || row.base_geometry_source_id !== value.source.baseGeometrySourceId
      || row.game_id !== value.baseGeometry.fixture.game_id || row.source_json !== json(value.source) || row.source_hash !== hash(value.source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt own actual field calibration');
  };
  const readGeometry = (sourceId: string): DurableBattedWorldFieldGeometry | null => {
    if (!id(sourceId)) throw new Error('invalid actual field calibration scope');
    const row = db.prepare('SELECT * FROM batted_world_field_geometries WHERE source_id=?').get(sourceId) as GeometryRow | undefined;
    if (!row) return null;
    const value = deriveGeometry(geometryInput(JSON.parse(row.source_json) as AcceptedBattedWorldFieldGeometry, sourceId));
    checkGeometryRow(row, value); return value;
  };
  const currentGeometry = (value: DurableBattedWorldFieldGeometry) => {
    ownBases.current(value.baseGeometry);
    if (json(deriveGeometry(value.source)) !== json(value)) throw new Error('original actual field calibration changed');
    const rows = db.prepare(`SELECT * FROM batted_world_field_geometries WHERE game_id=? OR base_geometry_source_id=?
      OR CASE WHEN json_valid(source_json) THEN json_extract(source_json,'$.baseGeometrySourceId') END=?
      OR CASE WHEN json_valid(snapshot_json) THEN json_extract(snapshot_json,'$.baseGeometry.fixture.game_id') END=?`)
      .all(value.baseGeometry.fixture.game_id, value.source.baseGeometrySourceId, value.source.baseGeometrySourceId, value.baseGeometry.fixture.game_id) as GeometryRow[];
    if (rows.length > 1) throw new Error('actual field has competing original calibration owners');
    for (const row of rows) checkGeometryRow(row, value);
  };
  const root = (source: AcceptedBattedWorldFieldAction): Root => {
    const response = ownResponses.read(source.responseSourceId), geometry = readGeometry(source.geometrySourceId);
    if (!response || !geometry) throw new Error('actual field original profile or calibration is missing');
    const flight = response.touch.worldContact.flight;
    const world = response.touch.worldContact, initial = flight.flight.initialBall;
    if (flight.source.searchDurationTicks !== 0 || world.source.previousContactSourceId !== null
      || world.result.kind !== 'airborne' || world.result.throughTick !== initial.tick || json(world.result.ball) !== json(initial)
      || response.result.kind !== 'airborne' || json(response.result.ball) !== json(initial)) {
      throw new Error('original field action requires unadvanced bat-contact calibration');
    }
    if (geometry.baseGeometry.source.flightSourceId !== flight.source.sourceId || json(geometry.baseGeometry.flight) !== json(flight)
      || response.model.gameId !== geometry.baseGeometry.fixture.game_id) throw new Error('actual field original pitch/Player/fixture geometry differs');
    return { response, geometry };
  };
  const execute = (source: AcceptedBattedWorldFieldAction, original: Root, previous: DurableBattedWorldFieldAction | null): DurableBattedWorldFieldAction => {
    let field: BattedWorldFieldMotion;
    if (source.kind === 'owned_runner_field_v1') field = deriveOwnedRunnerFieldMotion(source, original, previous);
    else {
      const response = battedWorldResponseInput(original.response), commands = battedWorldMotionPrimitiveCommands(original.response, source.commands);
      const common = { response, geometry: original.geometry.geometry, commands, availableAtTick: source.availableAtTick, throughTick: source.throughTick };
      if (!previous) field = deriveInitialBattedWorldFieldMotion(common);
      else {
        const motion = previous.field.motion;
        if (!motion.cursor) throw new Error('actual field capture or unresolved physical policy is pending');
        field = deriveBattedWorldFieldMotion({ ...common, cursor: motion.cursor, actors: motion.actors, carrierPlayerId: motion.carrierPlayerId });
      }
    }
    return freeze({ source, response: original.response, geometry: original.geometry, revision: (previous?.revision ?? 0) + 1,
      history: [...(previous?.history ?? []), source], field });
  };
  const scope = (original: Root, throughSourceId?: string): readonly DurableBattedWorldFieldAction[] => {
    const traversal = fieldReadTraversals.get(db);
    traversal?.check();
    const authenticated = traversal?.authenticated.has(original) === true;
    const pitchId = physicalId(original), responseId = original.response.source.sourceId, geometryId = original.geometry.source.sourceId;
    const owners = `physical_pitch_source_id=? OR response_source_id=?
      OR CASE WHEN json_valid(source_json) THEN json_extract(source_json,'$.responseSourceId') END=?
      OR CASE WHEN json_valid(snapshot_json) THEN json_extract(snapshot_json,'$.response.touch.worldContact.flight.source.physicalPitchSourceId') END=?`;
    const rows = db.prepare(`SELECT * FROM batted_world_field_actions WHERE ${owners} ORDER BY revision`)
      .all(pitchId, responseId, responseId, pitchId) as ActionRow[];
    const heads = db.prepare(`SELECT * FROM batted_world_field_heads WHERE physical_pitch_source_id=? OR response_source_id=?
      OR source_id IN (SELECT source_id FROM batted_world_field_actions WHERE ${owners})`)
      .all(pitchId, responseId, pitchId, responseId, responseId, pitchId) as Head[];
    if (!rows.length) { if (heads.length || throughSourceId) throw new Error('unowned actual field prefix head'); return []; }
    const head = heads[0];
    if (heads.length !== 1 || head.physical_pitch_source_id !== pitchId || head.response_source_id !== responseId || head.geometry_source_id !== geometryId
      || head.source_id !== rows.at(-1)!.source_id || !tick(head.revision) || head.revision !== rows.length) throw new Error('actual field original prefix head differs');
    const unique = new Set<string>();
    for (const [index, row] of rows.entries()) {
      if (!id(row.source_id) || unique.has(row.source_id) || !tick(row.revision) || row.revision !== index + 1
        || row.physical_pitch_source_id !== pitchId || row.response_source_id !== responseId || row.geometry_source_id !== geometryId
        || row.previous_source_id !== (rows[index - 1]?.source_id ?? null) || row.game_id !== original.response.model.gameId) {
        throw new Error('corrupt actual field prefix metadata');
      }
      unique.add(row.source_id);
    }
    const bound = throughSourceId === undefined ? rows.length - 1 : rows.findIndex((row) => row.source_id === throughSourceId);
    if (bound < 0) throw new Error('actual field Source is outside its original prefix');
    const values: DurableBattedWorldFieldAction[] = [];
    for (const row of rows.slice(0, bound + 1)) {
      const source = actionInput(JSON.parse(row.source_json) as AcceptedBattedWorldFieldAction, row.source_id);
      const sourceJson = json(source);
      if (source.responseSourceId !== responseId || source.geometrySourceId !== geometryId || source.previousFieldSourceId !== row.previous_source_id
        || row.source_json !== sourceJson || row.source_hash !== createHash('sha256').update(sourceJson).digest('hex')) throw new Error('corrupt original actual field action Source');
      const saved = authenticated ? traversal!.nodes.get(row.source_id) : undefined;
      // Exact private root identity and the freshly parsed full Source are both
      // required. A partial/changed caller field cannot borrow an owned proof.
      const reusable = saved && saved.value.response === original.response && saved.value.geometry === original.geometry
        && json(saved.value.source) === sourceJson ? saved : undefined;
      const value = reusable?.value ?? execute(source, original, values.at(-1) ?? null);
      const snapshotJson = reusable?.snapshotJson ?? json(value);
      if (row.snapshot_json !== snapshotJson || row.snapshot_hash !== (reusable?.snapshotHash
        ?? createHash('sha256').update(snapshotJson).digest('hex'))) throw new Error('corrupt original actual field action snapshot');
      values.push(value);
    }
    return values;
  };
  const read = (sourceId: string): DurableBattedWorldFieldAction | null => {
    if (!id(sourceId)) throw new Error('invalid actual field action scope');
    const row = db.prepare('SELECT * FROM batted_world_field_actions WHERE source_id=?').get(sourceId) as ActionRow | undefined;
    if (!row) return null;
    const source = actionInput(JSON.parse(row.source_json) as AcceptedBattedWorldFieldAction, sourceId);
    const traversal = fieldReadTraversals.get(db); traversal?.check();
    const rootKey = json([source.responseSourceId, source.geometrySourceId]);
    const values = scope(traversal?.roots.get(rootKey) ?? root(source), sourceId);
    if (traversal) {
      traversal.check();
      for (const value of values) {
        if (traversal.nodes.get(value.source.sourceId)?.value !== value) {
          const snapshotJson = json(value);
          traversal.nodes.set(value.source.sourceId, { value, snapshotJson,
            snapshotHash: createHash('sha256').update(snapshotJson).digest('hex') });
        }
        traversal.authenticated.add(value);
      }
      traversal.roots.set(rootKey, values.at(-1)!);
    }
    return values.at(-1)!;
  };
  const derive = (source: AcceptedBattedWorldFieldAction) => {
    if (source.kind === 'owned_runner_field_v1') source = actionInput(source, source.sourceId);
    const original = root(source), previous = scope(original).at(-1) ?? null;
    if (source.previousFieldSourceId !== (previous?.source.sourceId ?? null)) throw new Error('actual field predecessor differs');
    return execute(source, original, previous);
  };
  const currentRoot = (value: DurableBattedWorldFieldAction) => {
    noOldOwner(db, physicalId(value)); ownResponses.current(value.response); currentGeometry(value.geometry);
    if (json(root(value.source)) !== json({ response: value.response, geometry: value.geometry })) throw new Error('actual field original changed during write');
  };
  const currentBefore = (value: DurableBattedWorldFieldAction) => {
    currentRoot(value); if (json(derive(value.source)) !== json(value)) throw new Error('actual field prefix changed before write');
  };
  const current = (value: DurableBattedWorldFieldAction) => {
    currentRoot(value); const values = scope(value);
    if (values.length !== value.revision || json(values.at(-1)) !== json(value)) throw new Error('actual field prefix changed during write');
  };
  const interpret = (sourceId: string) => {
    const value = read(sourceId);
    return value ? battedWorldFieldTerritoryFromPrefix(scope(value, sourceId)) : null;
  };
  return { readGeometry, deriveGeometry, currentGeometry, read, interpret, derive, scope, currentBefore, current };
};

export const openSqliteBattedWorldFieldStore = (path: string, responses: Pick<SqliteBattedContactResponseStore, 'read'>,
  bases: Pick<SqliteBattedWorldBaseGeometryStore, 'read'>, authority?: Authority): SqliteBattedWorldFieldStore => {
  if (!id(path) || typeof responses?.read !== 'function' || typeof bases?.read !== 'function'
    || authority != null && (typeof authority.readAcceptedGeometry !== 'function' || typeof authority.readAcceptedAction !== 'function')) {
    throw new Error('invalid actual field Source owners');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS batted_world_field_geometries (source_id TEXT PRIMARY KEY,base_geometry_source_id TEXT NOT NULL,game_id TEXT NOT NULL UNIQUE,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS batted_world_field_actions (source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT NOT NULL,response_source_id TEXT NOT NULL,
    geometry_source_id TEXT NOT NULL,previous_source_id TEXT,revision INTEGER NOT NULL,game_id TEXT NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(physical_pitch_source_id,revision));
    CREATE TABLE IF NOT EXISTS batted_world_field_heads (physical_pitch_source_id TEXT PRIMARY KEY,response_source_id TEXT NOT NULL,geometry_source_id TEXT NOT NULL,
    source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL);`);
  const own = battedWorldFieldEvidenceFromSqlite(db); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed actual field scope'); };
  return Object.freeze({ readGeometry(sourceId) { check(sourceId); return own.readGeometry(sourceId); }, read(sourceId) { check(sourceId); return own.read(sourceId); },
    interpret(sourceId) { check(sourceId); return own.interpret(sourceId); },
    acceptGeometry(sourceId) {
      check(sourceId); const prior = own.readGeometry(sourceId), raw = authority?.readAcceptedGeometry(sourceId) ?? null;
      const source = raw === null ? null : geometryInput(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('actual field calibration is frozen differently');
        const saved = own.readGeometry(sourceId); if (!saved || json(saved) !== json(prior)) throw new Error('original field calibration changed during retry'); return saved;
      }
      if (!source) throw new Error('accepted actual field calibration Source is missing');
      const value = own.deriveGeometry(source); own.currentGeometry(value); const peer = bases.read(source.baseGeometrySourceId);
      if (!peer || json(peer) !== json(value.baseGeometry)) throw new Error('actual field peer geometry differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        own.currentGeometry(value);
        db.prepare('INSERT INTO batted_world_field_geometries VALUES (?,?,?,?,?,?,?)').run(sourceId, source.baseGeometrySourceId, value.baseGeometry.fixture.game_id,
          json(source), hash(source), json(value), hash(value));
        own.currentGeometry(value); const saved = own.readGeometry(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('actual field calibration changed during write'); db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    accept(sourceId) {
      check(sourceId); const prior = own.read(sourceId), raw = authority?.readAcceptedAction(sourceId) ?? null;
      const source = raw === null ? null : actionInput(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('actual field action is frozen differently');
        const saved = own.read(sourceId); if (!saved || json(saved) !== json(prior)) throw new Error('actual field original changed during retry'); return saved;
      }
      if (!source) throw new Error('accepted actual field action Source is missing');
      const value = own.derive(source); own.currentBefore(value); const peer = responses.read(source.responseSourceId);
      assertNoBattedWorldFieldExecutionOwner(db, physicalId(value));
      if (!peer || json(peer) !== json(value.response)) throw new Error('actual field peer original profile differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        const liveFence = beginActualLivePitchWrite(db, physicalId(value), { owner: 'batted_world_field_actions', sourceId });
        own.currentBefore(value); const pitchId = physicalId(value);
        assertNoBattedWorldFieldExecutionOwner(db, pitchId);
        db.prepare('INSERT INTO batted_world_field_actions VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, pitchId, source.responseSourceId, source.geometrySourceId,
          source.previousFieldSourceId, value.revision, value.response.model.gameId, json(source), hash(source), json(value), hash(value));
        if (value.revision === 1) db.prepare('INSERT INTO batted_world_field_heads VALUES (?,?,?,?,?)').run(pitchId, source.responseSourceId, source.geometrySourceId, sourceId, 1);
        else {
          const changed = db.prepare('UPDATE batted_world_field_heads SET source_id=?,revision=? WHERE physical_pitch_source_id=? AND response_source_id=? AND geometry_source_id=? AND source_id=? AND revision=?')
            .run(sourceId, value.revision, pitchId, source.responseSourceId, source.geometrySourceId, source.previousFieldSourceId, value.revision - 1);
          if (Number(changed.changes) !== 1) throw new Error('actual field predecessor changed during write');
        }
        recordActualLivePlayAdmission(db, liveFence);
        own.current(value); assertNoBattedWorldFieldExecutionOwner(db, pitchId); const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('actual field original changed during write'); assertActualLivePlayWriteUnchanged(db, liveFence); db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }, close() { if (!closed) { db.close(); closed = true; } },
  });
};
