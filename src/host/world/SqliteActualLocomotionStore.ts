export { actualRunnerDecisionInputEvidenceFromSqlite } from './ActualRunnerDecisionInput';
export { openSqliteRunnerContactWaitStore, runnerContactWaitPolicyViewEvidenceFromSqlite } from './SqliteRunnerContactWaitStore';
import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveActualLocomotionReceipt, type ActualLocomotionReceipt } from './ActualLocomotion';
import { actualLocomotionPhysicalAvailabilityFromSqlite } from './ActualLocomotionPhysicalAvailability';
import { actualDefensiveContextFromSqlite, defensiveFields as fields, type DefensiveDb } from './ActualDefensiveContext';
import { defensiveMetadataId as claim, defensiveMetadataScope as scopeClaim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches, type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { physicalStoreTransactionBoundary } from './PhysicalStoreTransactionBoundary';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Exactly one initial step per Player/pitch. Continuation/replan requires a new capability/owner contract. */
export type AcceptedActualLocomotion = Readonly<{ sourceId: string; sourceVersion: string; capability: 'initial_defender_step_v1';
  physicalPitchSourceId: string; playerId: string; decisionSourceId: string; locomotionModelSourceId: string;
  baseFieldSourceId: string; executionSourceId: string | null }>;
export type DurableActualLocomotion = Readonly<{ source: AcceptedActualLocomotion; revision: 1; history: readonly AcceptedActualLocomotion[];
  decisionHash: string; originDecisionHash: string; originObservationHash: string; locomotionModelHash: string; selfHash: string;
  receipt: ActualLocomotionReceipt & Readonly<{ physicalAvailability: ReturnType<typeof actualLocomotionPhysicalAvailabilityFromSqlite> }> }>;
type Authority = Readonly<{ readAcceptedLocomotion(sourceId: string): AcceptedActualLocomotion | null }>;
type Row = { source_id: string; source_version: string; capability: string; physical_pitch_source_id: string; player_id: string;
  decision_source_id: string; locomotion_model_source_id: string; base_field_source_id: string; execution_source_id: string | null;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const keys = ['sourceId', 'sourceVersion', 'capability', 'physicalPitchSourceId', 'playerId', 'decisionSourceId', 'locomotionModelSourceId', 'baseFieldSourceId', 'executionSourceId'];
const input = (raw: AcceptedActualLocomotion, sourceId?: string): AcceptedActualLocomotion => {
  const s = cloneInert(raw);
  if (!fields(s, keys) || sourceId !== undefined && s.sourceId !== sourceId || s.capability !== 'initial_defender_step_v1'
    || ![s.sourceId, s.sourceVersion, s.physicalPitchSourceId, s.playerId, s.decisionSourceId, s.locomotionModelSourceId, s.baseFieldSourceId].every(id)
    || s.executionSourceId !== null && !id(s.executionSourceId)) throw new Error('invalid accepted actual locomotion Source');
  return freeze(s);
};

/** Same-connection reader/deriver for later composition; not a callback-supplied dependency facade. */
export const actualLocomotionEvidenceFromSqlite = (db: DefensiveDb) => {
  const derive = (raw: AcceptedActualLocomotion, current = false): DurableActualLocomotion => {
    // Lazy construction: importing this reader into a later physical owner must not eagerly recurse.
    const decisions = actualDefensiveDecisionEvidenceFromSqlite(db), contexts = actualDefensiveContextFromSqlite(db);
    const source = input(raw), decision = decisions.read(source.decisionSourceId), model = playerLocomotionModelEvidenceFromSqlite(db).read(source.locomotionModelSourceId);
    if (!decision || !model || decision.source.physicalPitchSourceId !== source.physicalPitchSourceId || decision.source.playerId !== source.playerId) {
      throw new Error('actual locomotion owned decision/model scope differs');
    }
    const context = contexts.read(decision.source.observationSourceId, source.physicalPitchSourceId, source.playerId);
    const origin = decision.receipt.originDecisionSourceId === decision.source.sourceId ? decision : decisions.read(decision.receipt.originDecisionSourceId)!;
    const originContext = origin.source.observationSourceId === decision.source.observationSourceId ? context
      : contexts.read(origin.source.observationSourceId, source.physicalPitchSourceId, source.playerId);
    if (json(context.fieldingModel) !== json(model.fieldingModel) || model.source.careerId !== context.binding.careerId
      || model.source.personLinkSourceId !== context.binding.personLinkSourceId) throw new Error('actual locomotion original fielding/Person identity differs');
    const cut = { physicalPitchSourceId: source.physicalPitchSourceId, playerId: source.playerId,
      baseFieldSourceId: source.baseFieldSourceId, executionSourceId: source.executionSourceId, mode: 'original' as const };
    const observedSelf = actualPlayerKinematicsEvidenceFromSqlite(db).read({ ...cut, mode: current ? 'current' : 'original' });
    const self = freeze({ ...observedSelf, cut });
    if (self.gameId !== context.binding.gameId || self.gameDay !== context.binding.gameDay || self.personId !== context.binding.personId) {
      throw new Error('actual locomotion game/day/Person differs');
    }
    if (current) {
      if (json(playerLocomotionModelEvidenceFromSqlite(db).selectAtDay(context.binding.careerId, source.playerId, self.gameDay)) !== json(model)) {
        throw new Error('actual locomotion current accepted model differs');
      }
      const head = db.prepare('SELECT source_id FROM actual_defensive_decision_heads WHERE physical_pitch_source_id=? AND player_id=?')
        .get(source.physicalPitchSourceId, source.playerId);
      if (head?.source_id !== source.decisionSourceId) throw new Error('actual locomotion decision head is stale');
    }
    return freeze(cloneInert({ source, revision: 1 as const, history: [source], decisionHash: hash(decision), originDecisionHash: hash(origin),
      originObservationHash: hash(originContext.observation), locomotionModelHash: hash(model), selfHash: hash(self),
      receipt: { ...deriveActualLocomotionReceipt(decision, model, self), physicalAvailability: actualLocomotionPhysicalAvailabilityFromSqlite(db, cut, self) } }));
  };
  const metadata = (row: Row) => {
    const expected = { sourceId: row.source_id, sourceVersion: row.source_version, capability: row.capability,
      physicalPitchSourceId: row.physical_pitch_source_id, playerId: row.player_id, decisionSourceId: row.decision_source_id,
      locomotionModelSourceId: row.locomotion_model_source_id, baseFieldSourceId: row.base_field_source_id, executionSourceId: row.execution_source_id };
    const check = (document: string, path: SqliteJsonMetadataPath, type: string, values: Record<string, string | number | null> = {}) => {
      const owners = nodes('$document', path), result = db.prepare(`SELECT count(*) AS n,sum(owner.type=$type) AS typed,
        CASE WHEN owner.type='object' THEN ${projection('owner.value', Object.keys(values))} END AS metadata FROM (${owners}) owner`)
        .get({ type, document }) as { n: number; typed: number; metadata: string | null };
      if (result.n !== 1 || result.typed !== 1 || type === 'object' && !matches(result.metadata, values)) throw new Error('actual locomotion ownership metadata differs');
    };
    check(row.source_json, [], 'object', expected); check(row.snapshot_json, [], 'object', { revision: 1 });
    check(row.snapshot_json, ['source'], 'object', expected); check(row.snapshot_json, ['history'], 'array');
    check(row.snapshot_json, ['history', { array: 'all' }], 'object', expected);
    check(row.snapshot_json, ['receipt'], 'object'); check(row.snapshot_json, ['receipt', 'self'], 'object', {
      physicalPitchSourceId: row.physical_pitch_source_id, playerId: row.player_id });
    check(row.snapshot_json, ['receipt', 'self', 'cut'], 'object', { physicalPitchSourceId: row.physical_pitch_source_id,
      playerId: row.player_id, baseFieldSourceId: row.base_field_source_id, executionSourceId: row.execution_source_id, mode: 'original' });
    check(row.snapshot_json, ['receipt', 'command'], 'object', { playerId: row.player_id });
  };
  const scope = (pitch: string, player: string) => {
    const owners = `(physical_pitch_source_id=? AND player_id=?) OR ${scopeClaim('source_json')}
      OR ${scopeClaim('snapshot_json', ['source'])} OR ${scopeClaim('snapshot_json', ['history', { array: 'all' }])}
      OR ${scopeClaim('snapshot_json', ['receipt', 'self'])} OR ${scopeClaim('snapshot_json', ['receipt', 'self', 'cut'])}
      OR (${claim('snapshot_json', ['source', 'physicalPitchSourceId'])} AND ${claim('snapshot_json', ['receipt', 'command', 'playerId'])})
      OR EXISTS (SELECT 1 FROM actual_defensive_decisions d WHERE d.physical_pitch_source_id=? AND d.player_id=?
        AND (d.source_id=actual_locomotion_receipts.decision_source_id
          OR ${claim('actual_locomotion_receipts.source_json', ['decisionSourceId'], 'd.source_id')}
          OR ${claim('actual_locomotion_receipts.snapshot_json', ['source', 'decisionSourceId'], 'd.source_id')}
          OR ${claim('actual_locomotion_receipts.snapshot_json', ['history', { array: 'all' }, 'decisionSourceId'], 'd.source_id')}))`;
    const args = Array.from({ length: 8 }, () => [pitch, player]).flat();
    const rows = db.prepare(`SELECT * FROM actual_locomotion_receipts WHERE ${owners}`).all(...args) as Row[];
    const heads = db.prepare(`SELECT * FROM actual_locomotion_heads WHERE (physical_pitch_source_id=? AND player_id=?)
      OR source_id IN (SELECT source_id FROM actual_locomotion_receipts WHERE ${owners})`).all(pitch, player, ...args);
    if (!rows.length) { if (heads.length) throw new Error('unowned actual locomotion head'); return null; }
    const r = rows[0], h = heads[0];
    if (rows.length !== 1 || heads.length !== 1 || r.physical_pitch_source_id !== pitch || r.player_id !== player
      || h.physical_pitch_source_id !== pitch || h.player_id !== player || h.source_id !== r.source_id || h.revision !== 1) {
      throw new Error('actual locomotion initial ownership/head scope differs');
    }
    metadata(r); const source = input(JSON.parse(r.source_json), r.source_id), value = derive(source);
    if (r.source_json !== json(source) || r.source_hash !== hash(source) || r.snapshot_json !== json(value) || r.snapshot_hash !== hash(value)) {
      throw new Error('corrupt original actual locomotion archive');
    }
    return value;
  };
  const read = (sourceId: string): DurableActualLocomotion | null => {
    if (!id(sourceId)) throw new Error('invalid actual locomotion identity');
    // Valid v1 data keeps the usual terminal-history identity convention. A malformed
    // v1 history has no legitimate ancestor entries, so discover its hidden claim too.
    const malformedHistory = `(SELECT count(*)!=1 OR sum(h.type='array')!=1
      OR sum(CASE WHEN h.type='array' THEN json_array_length(h.value) ELSE -1 END)!=1
      FROM (${nodes('snapshot_json', ['history'])}) h)`;
    const rows = db.prepare(`SELECT * FROM actual_locomotion_receipts WHERE source_id=? OR ${claim('source_json', ['sourceId'])}
      OR ${claim('snapshot_json', ['source', 'sourceId'])} OR ${claim('snapshot_json', ['history', { array: 'last' }, 'sourceId'])}
      OR (${malformedHistory} AND (${claim('snapshot_json', ['history', { array: 'all' }, 'sourceId'])}
        OR ${claim('snapshot_json', ['history', 'sourceId'])}))`)
      .all(sourceId, sourceId, sourceId, sourceId, sourceId, sourceId) as Row[];
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('actual locomotion Source identity scope differs');
    if (!rows.length) return null;
    metadata(rows[0]); return scope(rows[0].physical_pitch_source_id, rows[0].player_id);
  };
  const before = (raw: DurableActualLocomotion) => {
    const value = cloneInert(raw);
    if (scope(value.source.physicalPitchSourceId, value.source.playerId)) throw new Error('actual locomotion initial receipt already exists');
    if (json(derive(value.source, true)) !== json(value)) throw new Error('actual locomotion dependencies changed before write');
  };
  const current = (raw: DurableActualLocomotion) => {
    const value = cloneInert(raw);
    const fresh = derive(value.source, true), saved = read(value.source.sourceId);
    if (json(fresh) !== json(value) || json(saved) !== json(value)) {
      throw new Error('actual locomotion dependencies changed during write');
    }
    return saved!;
  };
  return { read, derive, before, current };
};
export const openSqliteActualLocomotionStore = (path: string, authority?: Authority) => {
  if (!id(path) || authority != null && typeof authority.readAcceptedLocomotion !== 'function') throw new Error('invalid actual locomotion owner');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS actual_locomotion_receipts (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,capability TEXT NOT NULL,
    physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,decision_source_id TEXT NOT NULL,locomotion_model_source_id TEXT NOT NULL,
    base_field_source_id TEXT NOT NULL,execution_source_id TEXT,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    UNIQUE(physical_pitch_source_id,player_id),UNIQUE(decision_source_id));
    CREATE TABLE IF NOT EXISTS actual_locomotion_heads (physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,
      source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL,PRIMARY KEY(physical_pitch_source_id,player_id));`);
  const own = actualLocomotionEvidenceFromSqlite(db); let closed = false;
  // Decision, context, self and availability retain all their checks. Completed
  // physical roots are shared only inside each unchanged owner read phase.
  const reads = physicalStoreTransactionBoundary(db, 'actual locomotion read');
  const check = () => { if (closed) throw new Error('closed actual locomotion store'); };
  return Object.freeze({ read(sourceId: string) { check(); return reads.read(() => own.read(sourceId)); }, accept(sourceId: string): DurableActualLocomotion {
    check(); const prior = reads.read(() => own.read(sourceId)), raw = authority?.readAcceptedLocomotion(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
    if (prior) {
      if (source && json(source) !== json(prior.source)) throw new Error('actual locomotion Source frozen differently');
      const saved = reads.read(() => own.read(sourceId)); if (!saved || json(saved) !== json(prior)) throw new Error('actual locomotion changed during retry'); return saved;
    }
    if (!source) throw new Error('accepted actual locomotion Source missing');
    const value = reads.read(() => { const derived = own.derive(source); own.before(derived); return derived; });
    db.exec('BEGIN IMMEDIATE');
    try {
        const liveFence = beginActualLivePitchWrite(db, source.physicalPitchSourceId, { owner: 'actual_locomotion_receipts', sourceId });
      withBattedWorldPhysicalReadTraversal(db, () => own.before(value));
      db.prepare('INSERT INTO actual_locomotion_receipts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion, source.capability,
        source.physicalPitchSourceId, source.playerId, source.decisionSourceId, source.locomotionModelSourceId, source.baseFieldSourceId, source.executionSourceId,
        json(source), hash(source), json(value), hash(value));
      db.prepare('INSERT INTO actual_locomotion_heads VALUES (?,?,?,1)').run(source.physicalPitchSourceId, source.playerId, sourceId);
      recordActualLivePlayAdmission(db, liveFence);
      const saved = withBattedWorldPhysicalReadTraversal(db, () => {
        const original = own.current(value); assertActualLivePlayWriteUnchanged(db, liveFence); return original;
      });
      db.exec('COMMIT'); return saved;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }, close() { if (!closed) { reads.close(); closed = true; } } });
};
