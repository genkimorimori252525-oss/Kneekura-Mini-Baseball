import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveSourceBattedWorldContinuationV3, type SourceBattedWorldContinuationV3 } from '../../core/sim/ball/SourceBattedWorldContinuationV3';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedContactResponseEvidenceFromSqlite, type DurableBattedContactResponse, type SqliteBattedContactResponseStore } from './SqliteBattedContactResponseStore';
import { battedWorldResponseInput } from './SqliteBattedWorldContinuationStore';
import { battedWorldConsumerSourceCurve, CONTINUOUS_AERO_GROUND_RESPONSE_SOURCE_VERSION } from './BattedWorldSourceCurve';
import { assertNoBattedWorldMotionOwner } from './BattedWorldMotionOwnershipFence';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';

export const SOURCE_IMPACT_ESCAPE_CONTINUATION_VERSION_V3 = 'batted_continuation_aero_ground_escape_v3';
export const SOURCE_IMPACT_ESCAPE_CONTINUATION_OWNER_V3 = 'batted_world_continuations_v3';
export type AcceptedBattedWorldContinuationV3 = Readonly<{ owner: typeof SOURCE_IMPACT_ESCAPE_CONTINUATION_OWNER_V3;
  sourceId: string; sourceVersion: typeof SOURCE_IMPACT_ESCAPE_CONTINUATION_VERSION_V3; responseSourceId: string;
  previousContinuationSourceId: string | null; throughTick: number }>;
export type DurableBattedWorldContinuationV3 = Readonly<{ owner: typeof SOURCE_IMPACT_ESCAPE_CONTINUATION_OWNER_V3;
  source: AcceptedBattedWorldContinuationV3; revision: number; response: DurableBattedContactResponse;
  history: readonly AcceptedBattedWorldContinuationV3[]; result: SourceBattedWorldContinuationV3 }>;
export type SqliteBattedWorldContinuationV3Store = Readonly<{ accept(sourceId: string): DurableBattedWorldContinuationV3;
  read(sourceId: string): DurableBattedWorldContinuationV3 | null; close(): void }>;
type Authority = Readonly<{ readAcceptedContinuation(sourceId: string): AcceptedBattedWorldContinuationV3 | null }>;
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
type Row = Readonly<{ source_id: string; response_source_id: string; previous_source_id: string | null; predecessor_key: string;
  physical_pitch_source_id: string; game_id: string; revision: number; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string }>;
type Head = Readonly<{ physical_pitch_source_id: string; response_source_id: string; source_id: string; revision: number }>;
const ddl = [
  `CREATE TABLE batted_world_continuations_v3 (source_id TEXT PRIMARY KEY,response_source_id TEXT NOT NULL,
    previous_source_id TEXT,predecessor_key TEXT NOT NULL UNIQUE,physical_pitch_source_id TEXT NOT NULL,game_id TEXT NOT NULL,
    revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    UNIQUE(physical_pitch_source_id,revision))`,
  `CREATE TABLE batted_world_continuation_heads_v3 (physical_pitch_source_id TEXT PRIMARY KEY,response_source_id TEXT NOT NULL,
    source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL)`,
] as const;
const tables = ['batted_world_continuations_v3', 'batted_world_continuation_heads_v3'] as const;
const id = (v: unknown): v is string => typeof v === 'string' && !!v.length && v === v.trim();
const input = (raw: AcceptedBattedWorldContinuationV3, sourceId: string): AcceptedBattedWorldContinuationV3 => {
  const s = cloneInert(raw);
  if (!s || Object.keys(s).sort().join('|') !== 'owner|previousContinuationSourceId|responseSourceId|sourceId|sourceVersion|throughTick'
    || s.owner !== SOURCE_IMPACT_ESCAPE_CONTINUATION_OWNER_V3 || s.sourceVersion !== SOURCE_IMPACT_ESCAPE_CONTINUATION_VERSION_V3
    || s.sourceId !== sourceId || ![s.sourceId, s.responseSourceId].every(id)
    || s.previousContinuationSourceId !== null && (!id(s.previousContinuationSourceId) || s.previousContinuationSourceId === sourceId)
    || !Number.isSafeInteger(s.throughTick) || s.throughTick < 0) throw new Error('invalid v3 continuation owner/Source');
  return s;
};
const schema = (db: Db) => {
  for (const [index, table] of tables.entries()) {
    const rows = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').all(table);
    if (rows.length !== 1 || rows[0].type !== 'table' || rows[0].sql !== ddl[index]) throw new Error('v3 continuation owner schema differs');
  }
};
const physicalId = (response: DurableBattedContactResponse) => response.touch.worldContact.flight.source.physicalPitchSourceId;
const predecessorKey = (s: AcceptedBattedWorldContinuationV3) => json([SOURCE_IMPACT_ESCAPE_CONTINUATION_OWNER_V3,
  s.previousContinuationSourceId === null ? 'response' : 'continuation', s.previousContinuationSourceId ?? s.responseSourceId]);
const prefixValue = (response: DurableBattedContactResponse, history: readonly AcceptedBattedWorldContinuationV3[],
  trace: SourceBattedWorldContinuationV3, length: number): DurableBattedWorldContinuationV3 => freeze({ owner: SOURCE_IMPACT_ESCAPE_CONTINUATION_OWNER_V3,
  source: history[length - 1], revision: length, response, history: history.slice(0, length), result: { original: trace.original,
    initialCursor: trace.initialCursor, steps: trace.steps.slice(0, length), cursor: trace.steps[length - 1].response.cursor,
    solverVersion: trace.solverVersion, impulseCertificates: trace.impulseCertificates.filter(p => p.afterStepIndex < length),
    escapedIntervals: trace.escapedIntervals.filter(p => p.stepIndex < length) } });

/** Independent replay of the original owner rows; stored diagnostics or caller
 * certificates never authenticate an escape. v2 rows/heads have separate identity. */
export const battedWorldContinuationV3EvidenceFromSqlite = (db: Db) => {
  const ownResponses = battedContactResponseEvidenceFromSqlite(db);
  const assertIdentity = (sourceId: string) => {
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='batted_world_continuations'").get()
      && db.prepare(`SELECT source_id FROM batted_world_continuations WHERE source_id=$id
        OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).get({ id: sourceId })) {
      throw new Error('v3 continuation Source identity belongs to the v2 owner');
    }
  };
  const head = (response: DurableBattedContactResponse): Head | null => {
    const rows = db.prepare('SELECT * FROM batted_world_continuation_heads_v3 WHERE physical_pitch_source_id=? OR response_source_id=?')
      .all(physicalId(response), response.source.sourceId) as Head[];
    if (rows.length > 1) throw new Error('v3 continuation has competing owner heads');
    return rows[0] ?? null;
  };
  const scope = (response: DurableBattedContactResponse): readonly DurableBattedWorldContinuationV3[] => {
    schema(db);
    if (!battedWorldConsumerSourceCurve(response.touch.worldContact, 'v3_continuation', response.source.sourceVersion,
      CONTINUOUS_AERO_GROUND_RESPONSE_SOURCE_VERSION)) throw new Error('v3 continuation requires its original continuous response');
    const pitchId = physicalId(response), responseId = response.source.sourceId;
    const rows = db.prepare(`SELECT * FROM batted_world_continuations_v3 WHERE physical_pitch_source_id=$pitch OR response_source_id=$response
      OR ${claim('source_json', ['responseSourceId'], '$response')}
      OR ${claim('snapshot_json', ['response', 'source', 'sourceId'], '$response')}
      OR ${claim('snapshot_json', ['response', 'touch', 'worldContact', 'flight', 'source', 'physicalPitchSourceId'], '$pitch')}
      ORDER BY revision`).all({ pitch: pitchId, response: responseId }) as Row[];
    const current = head(response);
    if (!rows.length) { if (current) throw new Error('v3 continuation has an unowned head'); return []; }
    if (!current || current.physical_pitch_source_id !== pitchId || current.response_source_id !== responseId
      || current.source_id !== rows.at(-1)!.source_id || current.revision !== rows.length) throw new Error('v3 continuation own prefix/head differs');
    const history = rows.map((row, index) => {
      assertIdentity(row.source_id);
      const s = input(JSON.parse(row.source_json) as AcceptedBattedWorldContinuationV3, row.source_id);
      if (s.responseSourceId !== responseId || s.previousContinuationSourceId !== (index === 0 ? null : rows[index - 1].source_id)
        || row.response_source_id !== responseId || row.previous_source_id !== s.previousContinuationSourceId || row.predecessor_key !== predecessorKey(s)
        || row.physical_pitch_source_id !== pitchId || row.game_id !== response.model.gameId || row.revision !== index + 1
        || row.source_json !== json(s) || row.source_hash !== hash(s)) throw new Error('corrupt v3 continuation original Source prefix');
      return s;
    });
    const trace = deriveSourceBattedWorldContinuationV3({ response: battedWorldResponseInput(response), throughTicks: history.map(s => s.throughTick) });
    if (json(trace.original) !== json(response.result)) throw new Error('v3 continuation original response differs');
    return rows.map((row, index) => {
      const value = prefixValue(response, history, trace, index + 1);
      if (row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt v3 continuation independently rederived snapshot');
      return value;
    });
  };
  const read = (sourceId: string): DurableBattedWorldContinuationV3 | null => {
    if (!id(sourceId)) throw new Error('invalid v3 continuation scope');
    schema(db); assertIdentity(sourceId);
    const rows = db.prepare(`SELECT * FROM batted_world_continuations_v3 WHERE source_id=$id
      OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`)
      .all({ id: sourceId }) as Row[];
    if (!rows.length) return null;
    if (rows.length !== 1 || rows[0].source_id !== sourceId) throw new Error('v3 continuation Source identity mirror differs');
    const response = ownResponses.read(rows[0].response_source_id);
    if (!response) throw new Error('v3 original response Source is missing');
    const value = scope(response).find(v => v.source.sourceId === sourceId);
    if (!value) throw new Error('v3 continuation is outside its own original prefix');
    return value;
  };
  const derive = (s: AcceptedBattedWorldContinuationV3): DurableBattedWorldContinuationV3 => {
    assertIdentity(s.sourceId);
    const response = ownResponses.read(s.responseSourceId);
    if (!response) throw new Error('v3 original response Source is missing');
    const values = scope(response), latest = values.at(-1);
    if (s.previousContinuationSourceId !== (latest?.source.sourceId ?? null)) throw new Error('v3 continuation predecessor is not its own current head');
    const history = [...(latest?.history ?? []), s], trace = deriveSourceBattedWorldContinuationV3({ response: battedWorldResponseInput(response),
      throughTicks: history.map(s => s.throughTick) });
    if (json(trace.original) !== json(response.result)) throw new Error('v3 continuation original response differs');
    return prefixValue(response, history, trace, history.length);
  };
  const currentBefore = (value: DurableBattedWorldContinuationV3) => {
    assertNoBattedWorldMotionOwner(db, physicalId(value.response)); ownResponses.current(value.response);
    if (json(derive(value.source)) !== json(value)) throw new Error('v3 continuation original changed before write');
  };
  const current = (value: DurableBattedWorldContinuationV3) => {
    assertNoBattedWorldMotionOwner(db, physicalId(value.response)); ownResponses.current(value.response);
    const values = scope(value.response);
    if (values.length !== value.revision || json(values.at(-1)) !== json(value)) throw new Error('v3 continuation original changed during write');
  };
  return { read, derive, scope, currentBefore, current };
};

/** Explicit opt-in v3 owner. Opening a legacy store never creates these tables. */
export const openSqliteBattedWorldContinuationV3Store = (path: string, responses: Pick<SqliteBattedContactResponseStore, 'read'>,
  authority?: Authority): SqliteBattedWorldContinuationV3Store => {
  if (!id(path) || typeof responses?.read !== 'function' || authority != null && typeof authority.readAcceptedContinuation !== 'function') throw new Error('invalid v3 continuation sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
    for (const [index, table] of tables.entries()) {
      const present = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').all(table);
      if (present.length && (present.length !== 1 || present[0].type !== 'table' || present[0].sql !== ddl[index])) {
        throw new Error('v3 continuation owner schema differs');
      }
    }
    for (const [index, table] of tables.entries()) if (!db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table)) db.exec(ddl[index]);
    schema(db);
  } catch (error) { db.close(); throw error; }
  const own = battedWorldContinuationV3EvidenceFromSqlite(db);
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed v3 continuation scope'); };
  const reading = <T>(work: () => T): T => {
    if (db.isTransaction) return withBattedWorldPhysicalReadTraversal(db, work);
    db.exec('BEGIN');
    try { const value = withBattedWorldPhysicalReadTraversal(db, work); db.exec('COMMIT'); return value; }
    catch (error) {
      if (db.isTransaction) try { db.exec('ROLLBACK'); }
      catch (cleanup) { throw new AggregateError([error, cleanup], 'v3 continuation private read rollback failed', { cause: error }); }
      throw error;
    }
  };
  return Object.freeze({ read(sourceId) { check(sourceId); return reading(() => own.read(sourceId)); },
    accept(sourceId) {
      check(sourceId);
      const prior = reading(() => own.read(sourceId)), raw = authority?.readAcceptedContinuation(sourceId) ?? null,
        s = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (s && json(s) !== json(prior.source)) throw new Error('v3 continuation Source is frozen differently');
        const actual = reading(() => own.read(sourceId));
        if (!actual || json(actual) !== json(prior)) throw new Error('v3 continuation original changed during retry');
        return actual;
      }
      if (!s) throw new Error('accepted v3 continuation Source is missing');
      const value = reading(() => { const v = own.derive(s); own.currentBefore(v); return v; });
      const peer = responses.read(s.responseSourceId);
      if (!peer || json(peer) !== json(value.response)) throw new Error('v3 continuation peer response differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        const fence = beginActualLivePitchWrite(db, physicalId(value.response), { owner: SOURCE_IMPACT_ESCAPE_CONTINUATION_OWNER_V3, sourceId });
        own.currentBefore(value);
        const pitchId = physicalId(value.response);
        db.prepare('INSERT INTO batted_world_continuations_v3 VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, s.responseSourceId,
          s.previousContinuationSourceId, predecessorKey(s), pitchId, value.response.model.gameId, value.revision, json(s), hash(s), json(value), hash(value));
        if (value.revision === 1) db.prepare('INSERT INTO batted_world_continuation_heads_v3 VALUES (?,?,?,?)').run(pitchId, s.responseSourceId, sourceId, 1);
        else {
          const changed = db.prepare('UPDATE batted_world_continuation_heads_v3 SET source_id=?,revision=? WHERE physical_pitch_source_id=? AND response_source_id=? AND source_id=? AND revision=?')
            .run(sourceId, value.revision, pitchId, s.responseSourceId, s.previousContinuationSourceId, value.revision - 1);
          if (Number(changed.changes) !== 1) throw new Error('v3 continuation predecessor changed during write');
        }
        recordActualLivePlayAdmission(db, fence); own.current(value);
        const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('v3 continuation original changed during write');
        assertActualLivePlayWriteUnchanged(db, fence); db.exec('COMMIT'); return saved;
      } catch (error) {
        if (db.isTransaction) try { db.exec('ROLLBACK'); }
        catch (cleanup) { throw new AggregateError([error, cleanup], 'v3 continuation write rollback failed', { cause: error }); }
        throw error;
      }
    }, close() { if (!closed) { db.close(); closed = true; } } });
};
