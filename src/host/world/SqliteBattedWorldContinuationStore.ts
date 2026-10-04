import { assertSupportedBattedWorldConsumer } from './BattedWorldRunnerConsumerBoundary';
import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveBattedWorldContinuation, type BattedWorldContinuation } from '../../core/sim/ball/BattedWorldContinuation';
import type { BattedBallContactResponseInput } from '../../core/sim/ball/BattedBallContactResponse';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedContactResponseEvidenceFromSqlite, type DurableBattedContactResponse, type SqliteBattedContactResponseStore } from './SqliteBattedContactResponseStore';
import { assertNoBattedWorldMotionOwner } from './BattedWorldMotionOwnershipFence';

export type AcceptedBattedWorldContinuation = Readonly<{
  sourceId: string; sourceVersion: string; responseSourceId: string; previousContinuationSourceId: string | null; throughTick: number;
}>;
export type DurableBattedWorldContinuation = Readonly<{
  source: AcceptedBattedWorldContinuation; revision: number; response: DurableBattedContactResponse;
  history: readonly AcceptedBattedWorldContinuation[]; result: BattedWorldContinuation;
}>;
export type SqliteBattedWorldContinuationStore = Readonly<{
  accept(sourceId: string): DurableBattedWorldContinuation; read(sourceId: string): DurableBattedWorldContinuation | null; close(): void;
}>;
type Authority = Readonly<{ readAcceptedContinuation(sourceId: string): AcceptedBattedWorldContinuation | null }>;
type Row = { source_id: string; response_source_id: string; previous_source_id: string | null; predecessor_key: string;
  physical_pitch_source_id: string; game_id: string; revision: number; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type Head = { response_source_id: string; source_id: string; revision: number };
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const input = (raw: AcceptedBattedWorldContinuation, sourceId: string): AcceptedBattedWorldContinuation => {
  const s = cloneInert(raw);
  if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).sort().join('|')
    !== 'previousContinuationSourceId|responseSourceId|sourceId|sourceVersion|throughTick' || s.sourceId !== sourceId
    || ![s.sourceId, s.sourceVersion, s.responseSourceId].every(id) || s.previousContinuationSourceId !== null
      && (!id(s.previousContinuationSourceId) || s.previousContinuationSourceId === sourceId)
    || !Number.isSafeInteger(s.throughTick) || s.throughTick < 0) throw new Error('invalid accepted batted World continuation Source');
  return s;
};
const physicalId = (r: DurableBattedContactResponse) => r.touch.worldContact.flight.source.physicalPitchSourceId;
const predecessorKey = (s: AcceptedBattedWorldContinuation) => json(s.previousContinuationSourceId === null
  ? ['response', s.responseSourceId] : ['continuation', s.previousContinuationSourceId]);
export const battedWorldResponseInput = (response: DurableBattedContactResponse): BattedBallContactResponseInput => {
  const w = response.touch.worldContact;
  assertSupportedBattedWorldConsumer(w, 'response_continuation_input');
  return { world: { flight: w.flight.flight, parameters: w.flight.source.execution.ballFlightParameters,
    throughTick: w.flight.flight.contact.tick + w.flight.source.searchDurationTicks, actors: w.actors, surfaces: w.model.surfaces },
    actors: response.model.actors.filter((a) => w.actors.some((b) => a.playerId === b.playerId))
      .flatMap((a) => a.primitives.map((profile) => ({ playerId: a.playerId, profile }))), surfaces: response.model.surfaces };
};
const deriveTrace = (response: DurableBattedContactResponse, history: readonly AcceptedBattedWorldContinuation[]): BattedWorldContinuation => {
  const trace = deriveBattedWorldContinuation({ response: battedWorldResponseInput(response), throughTicks: history.map((s) => s.throughTick) });
  if (json(trace.original) !== json(response.result)) throw new Error('batted continuation original response differs');
  return trace;
};
const prefixValue = (response: DurableBattedContactResponse, history: readonly AcceptedBattedWorldContinuation[], trace: BattedWorldContinuation,
  length: number): DurableBattedWorldContinuation => freeze({ source: history[length - 1], revision: length, response,
    history: history.slice(0, length), result: { original: trace.original, initialCursor: trace.initialCursor,
      steps: trace.steps.slice(0, length), cursor: trace.steps[length - 1].response.cursor } });

/** The own immutable Source prefix is re-derived on this connection, including the latest head and all archived snapshots. */
export const battedWorldContinuationEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const ownResponses = battedContactResponseEvidenceFromSqlite(db);
  const head = (pitchId: string): Head | null => db.prepare('SELECT response_source_id,source_id,revision FROM batted_world_continuation_heads WHERE physical_pitch_source_id=?')
    .get(pitchId) as Head | undefined ?? null;
  const scope = (response: DurableBattedContactResponse): readonly DurableBattedWorldContinuation[] => {
    assertSupportedBattedWorldConsumer(response.touch.worldContact, 'continuation');
    const pitchId = physicalId(response), rows = db.prepare('SELECT * FROM batted_world_continuations WHERE physical_pitch_source_id=? ORDER BY revision')
      .all(pitchId) as Row[], currentHead = head(pitchId);
    if (!rows.length) { if (currentHead) throw new Error('unowned batted continuation head'); return []; }
    if (!currentHead || currentHead.source_id !== rows.at(-1)!.source_id || currentHead.revision !== rows.length
      || currentHead.response_source_id !== response.source.sourceId) throw new Error('batted continuation original prefix head differs');
    const history = rows.map((row, index) => {
      const s = input(JSON.parse(row.source_json) as AcceptedBattedWorldContinuation, row.source_id);
      if (s.responseSourceId !== response.source.sourceId || s.previousContinuationSourceId !== (index === 0 ? null : rows[index - 1].source_id)
        || row.response_source_id !== s.responseSourceId || row.previous_source_id !== s.previousContinuationSourceId || row.predecessor_key !== predecessorKey(s)
        || row.physical_pitch_source_id !== pitchId || row.game_id !== response.model.gameId || row.revision !== index + 1
        || row.source_json !== json(s) || row.source_hash !== hash(s)) throw new Error('corrupt original batted continuation Source prefix');
      return s;
    });
    const trace = deriveTrace(response, history);
    return rows.map((row, index) => {
      const value = prefixValue(response, history, trace, index + 1);
      if (row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt original batted continuation snapshot');
      return value;
    });
  };
  const read = (sourceId: string): DurableBattedWorldContinuation | null => {
    if (!id(sourceId)) throw new Error('invalid batted continuation scope');
    const row = db.prepare('SELECT * FROM batted_world_continuations WHERE source_id=?').get(sourceId) as Row | undefined;
    if (!row) return null;
    const response = ownResponses.read(row.response_source_id);
    if (!response) throw new Error('original batted response Source is missing');
    const value = scope(response).find((v) => v.source.sourceId === sourceId);
    if (!value) throw new Error('batted continuation Source is outside its own original prefix');
    return value;
  };
  const derive = (s: AcceptedBattedWorldContinuation): DurableBattedWorldContinuation => {
    const response = ownResponses.read(s.responseSourceId);
    if (!response) throw new Error('original batted response Source is missing');
    const values = scope(response), latest = values.at(-1);
    if (s.previousContinuationSourceId !== (latest?.source.sourceId ?? null)) throw new Error('batted continuation predecessor is not the current original head');
    const history = [...(latest?.history ?? []), s], trace = deriveTrace(response, history);
    return prefixValue(response, history, trace, history.length);
  };
  const currentBefore = (value: DurableBattedWorldContinuation) => {
    assertNoBattedWorldMotionOwner(db, physicalId(value.response));
    ownResponses.current(value.response);
    if (json(derive(value.source)) !== json(value)) throw new Error('batted continuation original changed before write');
  };
  const current = (value: DurableBattedWorldContinuation) => {
    ownResponses.current(value.response);
    const values = scope(value.response);
    if (values.length !== value.revision || json(values.at(-1)) !== json(value)) throw new Error('batted continuation current prefix changed during write');
  };
  return { read, derive, head, scope, currentBefore, current, ownResponses };
};

/** Accepted horizons continue actual original motion; a transported ball/result or a horizon cannot establish closure. */
export const openSqliteBattedWorldContinuationStore = (path: string, responses: Pick<SqliteBattedContactResponseStore, 'read'>,
  authority?: Authority): SqliteBattedWorldContinuationStore => {
  if (!id(path) || typeof responses?.read !== 'function' || authority != null && typeof authority.readAcceptedContinuation !== 'function') {
    throw new Error('invalid batted continuation sources');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS batted_world_continuations (source_id TEXT PRIMARY KEY,response_source_id TEXT NOT NULL,
    previous_source_id TEXT,predecessor_key TEXT NOT NULL UNIQUE,physical_pitch_source_id TEXT NOT NULL,game_id TEXT NOT NULL,revision INTEGER NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(physical_pitch_source_id,revision));
    CREATE TABLE IF NOT EXISTS batted_world_continuation_heads (physical_pitch_source_id TEXT PRIMARY KEY,response_source_id TEXT NOT NULL,
    source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL);`);
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed batted continuation scope'); };
  const own = battedWorldContinuationEvidenceFromSqlite(db);
  return Object.freeze({
    read(sourceId) { check(sourceId); return own.read(sourceId); },
    accept(sourceId) {
      check(sourceId); const prior = own.read(sourceId), raw = authority?.readAcceptedContinuation(sourceId) ?? null, s = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (s && json(s) !== json(prior.source)) throw new Error('batted continuation Source is frozen differently');
        const original = own.read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('batted continuation original changed during retry');
        return original;
      }
      if (!s) throw new Error('accepted batted continuation Source is missing');
      const value = own.derive(s); own.currentBefore(value);
      const peer = responses.read(s.responseSourceId);
      if (!peer || json(peer) !== json(value.response)) throw new Error('batted continuation peer response differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        const liveFence = beginActualLivePitchWrite(db, physicalId(value.response), { owner: 'batted_world_continuations', sourceId });
        own.currentBefore(value);
        const pitchId = physicalId(value.response);
        db.prepare('INSERT INTO batted_world_continuations VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, s.responseSourceId,
          s.previousContinuationSourceId, predecessorKey(s), pitchId, value.response.model.gameId, value.revision, json(s), hash(s), json(value), hash(value));
        if (value.revision === 1) db.prepare('INSERT INTO batted_world_continuation_heads VALUES (?,?,?,?)').run(pitchId, s.responseSourceId, sourceId, 1);
        else {
          const changed = db.prepare('UPDATE batted_world_continuation_heads SET source_id=?,revision=? WHERE physical_pitch_source_id=? AND response_source_id=? AND source_id=? AND revision=?')
            .run(sourceId, value.revision, pitchId, s.responseSourceId, s.previousContinuationSourceId, value.revision - 1);
          if (Number(changed.changes) !== 1) throw new Error('batted continuation predecessor changed during write');
        }
        recordActualLivePlayAdmission(db, liveFence);
        assertNoBattedWorldMotionOwner(db, pitchId);
        own.current(value); const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('batted continuation original changed during write');
        assertActualLivePlayWriteUnchanged(db, liveFence); db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
