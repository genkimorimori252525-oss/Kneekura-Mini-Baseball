import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { AcceptedActualSettledFoulStopProduction, DurableActualSettledFoulStopProduction,
  ActualSettledFoulStopCensusQuery, ActualSettledFoulStopCensus } from './ActualSettledFoulStopProducer';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLivePlayFields as fields, actualLivePlayId as id, type AcceptedActualLivePlayScope } from './ActualLivePlayScope';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import { actualLiveEventKey, actualLiveSuccessorKey, actualLiveEventMoment,
  actualLivePlayQueueEvidenceFromSqlite } from './ActualLivePlayQueueEvidenceFromSqlite';
import { battedVenueLegalEvidenceFromSqlite } from './BattedVenueLegalEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot, battedVenueLegalPolicyEvidenceFromSqlite } from './SqliteBattedVenueLegalPolicyStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { settledFoulStopTable as table, settledFoulStopSource as input, settledFoulStopOwnership } from './ActualSettledFoulStopOwnership';

const owner = (db: DatabaseSync) => {
  const ownership = settledFoulStopOwnership(db);
  const runtimeFor = (sourceId: string) => {
    const runtime = actualLiveRuntimeEvidenceFromSqlite(db).read(sourceId);
    if (!runtime || runtime.source.capability !== 'causal_original_settled_foul_runtime_v1') {
      throw new Error('settled-foul producer requires its registered explicit runtime capability');
    }
    return runtime;
  };
  const scopeSource = (runtime: ReturnType<typeof runtimeFor>, cut: AcceptedActualLivePlayScope['cut']): AcceptedActualLivePlayScope => ({
    sourceId: runtime.source.sourceId, sourceVersion: runtime.source.sourceVersion,
    capability: 'actual_live_play_scope_v1', physicalPitchSourceId: runtime.source.physicalPitchSourceId, cut,
  });
  const derive = (source: AcceptedActualSettledFoulStopProduction, current = false): DurableActualSettledFoulStopProduction => {
    const runtime = runtimeFor(source.runtimeSourceId);
    if (source.physicalPitchSourceId !== runtime.source.physicalPitchSourceId) throw new Error('settled-foul producer pitch/runtime differ');
    const cut = { kind: 'field_execution' as const, baseFieldSourceId: source.baseFieldSourceId, executionSourceId: null };
    const { value: live, prefix } = actualLivePlayEvidenceFromSqlite(db).deriveWithPhysicalPrefix(scopeSource(runtime, cut), current);
    const basis = battedVenueLegalEvidenceFromSqlite(db).read({ version: 'batted_venue_legal_observation_v1',
      policySourceId: source.policySourceId, baseFieldSourceId: source.baseFieldSourceId, executionSourceId: null });
    const interpretation = basis.evidence.interpretation;
    if (!prefix || prefix.executions.length || basis.physicalPitchSourceId !== source.physicalPitchSourceId
      || basis.gameId !== runtime.gameId || basis.playId !== runtime.playId
      || interpretation.kind !== 'dead_ball' || interpretation.reason !== 'untouched_settled_foul' || !basis.contactOrigins) {
      throw new Error('settled-foul producer requires actual original untouched stop evidence');
    }
    const last = prefix.baseField.field.motion.world;
    if (last.kind !== 'boundary' || last.contacts.length !== 1 || last.contacts[0].kind !== 'rolling_stop'
      || prefix.fields.slice(0, -1).some(f => f.field.motion.world.kind === 'boundary'
        && f.field.motion.world.contacts.some(c => c.kind === 'rolling_stop'))
      || !basis.contactOrigins.decisiveStop.length || basis.contactOrigins.decisiveStop.some(o => o.reference.owner !== 'batted_world_field_actions'
        || o.reference.sourceId !== source.baseFieldSourceId)) throw new Error('settled-foul producer cut is not its first decisive original stop');
    const occurredAt = actualLiveEventMoment(interpretation.moment), availableAt = live.scope.at;
    if (json(occurredAt) !== json(availableAt) || live.scope.scopeId !== runtime.membership.scopeId) {
      throw new Error('settled-foul producer requires the exact immediate availability cut');
    }
    const originalStopKey = json(['original_settled_foul_stop_v1', source.physicalPitchSourceId, hash(basis.contactOrigins.decisiveStop)]);
    const eventId = json(['settled_foul_stop_v1', originalStopKey]), eventKey = actualLiveEventKey(table, source.sourceId, eventId);
    const localSourceId = json(['settled_foul_rule_evidence_v1', originalStopKey]);
    return freeze({ source, revision: 1, history: [source], gameId: runtime.gameId, playId: runtime.playId,
      physicalPitchSourceId: source.physicalPitchSourceId, scopeId: runtime.membership.scopeId,
      ownershipKey: json(['actual_original_settled_foul_stop_producer_v1', source.physicalPitchSourceId]), originalStopKey,
      runtimeReference: { owner: 'actual_live_play_runtimes', sourceId: runtime.source.sourceId, snapshotHash: hash(runtime) }, basis,
      event: { eventKey, eventId, kind: 'settled_foul_stop', originalStopKey, occurredAt, availableAt, stopOrigins: basis.contactOrigins.decisiveStop },
      successor: { successorKey: actualLiveSuccessorKey(table, source.sourceId, localSourceId), localSourceId,
        basisEventKey: eventKey, kind: 'foul_rule_evidence', status: 'pending', pendingReason: 'foul_rule_consumer_unowned' } });
  };
  const read = (sourceId: string): DurableActualSettledFoulStopProduction | null => {
    const row = ownership.identities(sourceId); if (!row) return null;
    const parsed = input(JSON.parse(row.source_json), sourceId), runtime = runtimeFor(parsed.runtimeSourceId);
    const claims = ownership.claims(runtime);
    if (claims.length !== 1 || claims[0].source_id !== sourceId) throw new Error('settled-foul producer original scope has conflicting owners');
    const { source } = ownership.metadata(row, runtime), value = derive(source);
    if (row.original_stop_key !== value.originalStopKey || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) {
      throw new Error('settled-foul producer archive or original dependencies differ');
    }
    return value;
  };
  const census = (raw: ActualSettledFoulStopCensusQuery): ActualSettledFoulStopCensus => {
    const query = cloneInert(raw);
    if (!fields(query, ['version', 'runtimeSourceId', 'cut']) || query.version !== 'actual_settled_foul_stop_census_v1'
      || !id(query.runtimeSourceId)) throw new Error('invalid settled-foul producer census query');
    const runtime = runtimeFor(query.runtimeSourceId);
    const base = actualLivePlayQueueEvidenceFromSqlite(db).derive(scopeSource(runtime, query.cut));
    const claims = ownership.claims(runtime);
    if (claims.length > 1) throw new Error('settled-foul producer original scope has conflicting owners');
    const row = claims[0], events = [...base.events], successors = [...base.successors], futureSourceIds: string[] = [];
    let production: DurableActualSettledFoulStopProduction | null = null;
    if (row) {
      const { source, fieldRevision } = ownership.metadata(row, runtime);
      // Authenticate the original field owner, not the producer's future payload.
      // The latter remains opaque until the requested physical cut includes it.
      const originalField = battedWorldFieldEvidenceFromSqlite(db).read(source.baseFieldSourceId);
      const policy = battedVenueLegalPolicyEvidenceFromSqlite(db).read(source.policySourceId);
      if (!originalField || originalField.revision !== fieldRevision
        || originalField.response.touch.worldContact.flight.physicalPitch.source.sourceId !== runtime.source.physicalPitchSourceId
        || !policy || policy.physicalPitchSourceId !== runtime.source.physicalPitchSourceId) throw new Error('settled-foul producer original references differ');
      const cutField = query.cut.kind === 'field_execution' ? battedWorldFieldEvidenceFromSqlite(db).read(query.cut.baseFieldSourceId) : null;
      if (query.cut.kind === 'original_pitch' || cutField && fieldRevision > cutField.revision) futureSourceIds.push(source.sourceId);
      else {
        production = read(source.sourceId);
        if (!production) throw new Error('settled-foul producer disappeared during census');
        const reference = { owner: table, sourceId: source.sourceId, snapshotHash: hash(production) };
        events.push({ ...production.event, owner: reference, originalReceipt: production.event });
        successors.push({ ...production.successor, owner: reference, originalHandoff: production.successor });
      }
    }
    return freeze({ version: 'actual_settled_foul_stop_census_v1', base,
      producer: { producerId: json(['actual_settled_foul_stop_producer_v1', runtime.membership.scopeId]), domain: 'settled_foul_stop',
        status: production ? 'produced' : 'pending', sourceId: production?.source.sourceId ?? null, futureSourceIds },
      events, successors, coverage: 'original_foul_producer_claims_complete', generation: 'event_generation_coverage_pending',
      closureFence: 'not_installed', playEnd: null });
  };
  return { read, census, derive, runtimeFor, ownership };
};

/** Read-only original ownership census; never installs schema or changes a caller's transaction/settings. */
export const actualSettledFoulStopProducerEvidenceFromSqlite = (db: DatabaseSync): Readonly<{
  read(sourceId: string): DurableActualSettledFoulStopProduction | null;
  census(query: ActualSettledFoulStopCensusQuery): ActualSettledFoulStopCensus;
}> => {
  const own = owner(db);
  return Object.freeze({ read: sourceId => withBattedVenueLegalReadSnapshot(db, () => own.read(sourceId)),
    census: query => withBattedVenueLegalReadSnapshot(db, () => own.census(query)) });
};
export const openSqliteActualSettledFoulStopProducerStore = (path: string,
  authority?: Readonly<{ readAcceptedProduction(sourceId: string): AcceptedActualSettledFoulStopProduction | null }>): Readonly<{
  accept(sourceId: string): DurableActualSettledFoulStopProduction;
  read(sourceId: string): DurableActualSettledFoulStopProduction | null;
  close(): void;
}> => {
  if (!id(path) || authority !== undefined && typeof authority.readAcceptedProduction !== 'function') throw new Error('invalid settled-foul producer authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS main.${table}(source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,capability TEXT NOT NULL,
      physical_pitch_source_id TEXT NOT NULL UNIQUE,runtime_source_id TEXT NOT NULL UNIQUE,policy_source_id TEXT NOT NULL,
      base_field_source_id TEXT NOT NULL,execution_source_id TEXT CHECK(execution_source_id IS NULL),game_id TEXT NOT NULL,play_id INTEGER NOT NULL,
      ownership_key TEXT NOT NULL UNIQUE,original_stop_key TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
    settledFoulStopOwnership(db).installed();
  } catch (error) { db.close(); throw error; }
  const own = owner(db); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed settled-foul producer'); };
  const snapshot = <T>(body: () => T) => withBattedVenueLegalReadSnapshot(db, body);
  return Object.freeze({
    read(sourceId) { check(sourceId); return snapshot(() => own.read(sourceId)); },
    accept(sourceId) {
      check(sourceId);
      const prior = snapshot(() => own.read(sourceId)), raw = authority?.readAcceptedProduction(sourceId) ?? null;
      const source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('settled-foul producer Source is frozen differently');
        return snapshot(() => { const saved = own.read(sourceId);
          if (!saved || json(saved) !== json(prior)) throw new Error('settled-foul producer changed during retry'); return saved; });
      }
      if (!source) throw new Error('accepted settled-foul producer Source missing');
      const proposed = snapshot(() => own.derive(source, true)), encoded = json(proposed);
      db.exec('BEGIN IMMEDIATE');
      try {
        const fence = beginActualLivePitchWrite(db, source.physicalPitchSourceId, { owner: table, sourceId });
        if (snapshot(() => own.ownership.claims(own.runtimeFor(source.runtimeSourceId))).length
          || snapshot(() => own.read(sourceId))) throw new Error('settled-foul producer original scope already owned');
        if (json(snapshot(() => own.derive(source, true))) !== encoded) throw new Error('settled-foul producer dependencies changed before write');
        const before = db.prepare('SELECT total_changes() AS n').get()!.n;
        if (typeof before !== 'number' || !Number.isSafeInteger(before + 2)) throw new Error('settled-foul producer write accounting unavailable');
        db.prepare(`INSERT INTO main.${table} VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(sourceId, source.sourceVersion, source.capability,
          source.physicalPitchSourceId, source.runtimeSourceId, source.policySourceId, source.baseFieldSourceId, null,
          proposed.gameId, proposed.playId, proposed.ownershipKey, proposed.originalStopKey, json(source), hash(source), encoded, hash(proposed));
        recordActualLivePlayAdmission(db, fence);
        if (json(snapshot(() => own.derive(source, true))) !== encoded) throw new Error('settled-foul producer dependencies changed during write');
        const saved = snapshot(() => own.read(sourceId));
        if (!saved || json(saved) !== encoded) throw new Error('settled-foul producer changed after admission');
        assertActualLivePlayWriteUnchanged(db, fence);
        if (db.prepare('SELECT total_changes() AS n').get()!.n !== before + 2) throw new Error('settled-foul producer changed more than its receipt and admission');
        db.exec('COMMIT'); return saved;
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
