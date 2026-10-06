import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { recordFoulBattedBall } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { AcceptedActualFoulRuleConsumption, ActualFoulRuleConsumerQuery, ActualFoulRuleConsumers,
  DurableActualFoulRuleConsumption, ActualFoulDisposition } from './ActualFoulRuleConsumption';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import { actualSettledFoulStopProducerEvidenceFromSqlite } from './SqliteActualSettledFoulStopProducerStore';
import { battedVenueFoulCountEvidenceFromSqlite } from './BattedVenueFoulCountEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { foulRuleConsumptionTable as table, foulRuleConsumptionSource as input, foulRuleConsumptionOwnership } from './ActualFoulRuleConsumptionOwnership';

const owner = (db: DatabaseSync) => {
  const ownership = foulRuleConsumptionOwnership(db);
  const runtimeFor = (sourceId: string) => {
    const runtime = actualLiveRuntimeEvidenceFromSqlite(db).read(sourceId);
    if (!runtime || !(runtime.source.capability === 'causal_original_settled_foul_count_runtime_v1'
        && runtime.membership.liveRulePolicy === 'untouched_settled_foul_count_consumption_v1'
      || runtime.source.capability === 'causal_original_settled_foul_end_runtime_v1'
        && runtime.membership.liveRulePolicy === 'untouched_settled_foul_end_v1')) {
      throw new Error('foul consumption requires its registered explicit count runtime policy');
    }
    return runtime;
  };
  const derive = (source: AcceptedActualFoulRuleConsumption, current = false): DurableActualFoulRuleConsumption => {
    const runtime = runtimeFor(source.runtimeSourceId), producers = actualSettledFoulStopProducerEvidenceFromSqlite(db);
    const production = producers.read(source.stopProductionSourceId);
    if (!production || production.source.runtimeSourceId !== runtime.source.sourceId
      || production.physicalPitchSourceId !== runtime.source.physicalPitchSourceId || production.gameId !== runtime.gameId
      || production.playId !== runtime.playId || production.scopeId !== runtime.membership.scopeId
      || json(production.runtimeReference) !== json({ owner: 'actual_live_play_runtimes', sourceId: runtime.source.sourceId, snapshotHash: hash(runtime) })) {
      throw new Error('foul consumption original producer/runtime differs');
    }
    const cut = { kind: 'field_execution' as const, baseFieldSourceId: production.source.baseFieldSourceId, executionSourceId: null };
    // Currentness belongs to first write only. Historical reads and identical
    // retries keep this exact immutable cut even after later admitted execution.
    if (current) actualLivePlayEvidenceFromSqlite(db).derive({ sourceId: source.sourceId, sourceVersion: source.sourceVersion,
      capability: 'actual_live_play_scope_v1', physicalPitchSourceId: production.physicalPitchSourceId, cut }, true);
    const census = producers.census({ version: 'actual_settled_foul_stop_census_v1', runtimeSourceId: runtime.source.sourceId, cut });
    const event = census.events.find(e => e.eventKey === production.event.eventKey);
    const successor = census.successors.find(s => s.successorKey === production.successor.successorKey);
    if (!event || !successor || successor.kind !== 'foul_rule_evidence' || successor.status !== 'pending'
      || successor.basisEventKey !== event.eventKey || json(event.occurredAt) !== json(production.event.occurredAt)
      || json(event.availableAt) !== json(production.event.availableAt)
      || json(production.event.occurredAt) !== json(production.event.availableAt)) {
      throw new Error('foul consumption requires its exact original pending rule successor');
    }
    const countEvidence = battedVenueFoulCountEvidenceFromSqlite(db).read({ version: 'batted_venue_foul_count_observation_v1',
      policySourceId: production.source.policySourceId, baseFieldSourceId: production.source.baseFieldSourceId, executionSourceId: null });
    if (json(countEvidence.basis) !== json(production.basis)) throw new Error('foul count evidence differs from its original producer basis');
    const prefix = readOriginalPhysicalPitchPrefixFromSqlite(db, production.physicalPitchSourceId), pitch = prefix.at(-1)!;
    const original = pitch.result.pitch.resolution.timeline, intent = countEvidence.battingIntent.intent;
    if (original.status.kind !== 'batted_ball_pending' || original.playId !== runtime.playId
      || countEvidence.battingIntent.physicalPitch.sourceId !== pitch.source.sourceId
      || countEvidence.battingIntent.physicalPitch.snapshotHash !== hash(pitch)
      || countEvidence.battingIntent.contact.resultTimelineHash !== hash(original)) throw new Error('foul consumption original count/intent lineage differs');
    let disposition: ActualFoulDisposition;
    if (intent.kind === 'unresolved') {
      if (countEvidence.countConsequence.kind !== 'unresolved' || countEvidence.countConsequence.reason !== 'original_batting_intent_missing') {
        throw new Error('foul consumption cannot choose an absent original batting intent');
      }
      disposition = { kind: 'pending_original_intent', timeline: null };
    } else {
      if (countEvidence.countConsequence.kind !== 'derived') throw new Error('foul consumption original count consequence is unproved');
      const timeline = recordFoulBattedBall(original, production.event.occurredAt.tick, intent.attempt === 'bunt', null);
      const last = timeline.events.at(-1);
      if (!last || last.kind !== 'FoulBattedBallResolved' || json(last.payload.resolution) !== json(countEvidence.countConsequence.rule)
        || timeline.playId !== original.playId || json(timeline.events.slice(0, -1)) !== json(original.events)
        || timeline.status.kind !== 'active' && timeline.status.kind !== 'strikeout') throw new Error('foul consumption composed count differs');
      disposition = { kind: timeline.status.kind === 'strikeout' ? 'terminal_strikeout' : 'continue_same_pa', timeline };
    }
    const ownershipKey = json(['actual_original_settled_foul_rule_consumption_v1', pitch.source.sourceId, successor.successorKey]);
    const receiptId = json(['actual_foul_rule_consumption_receipt_v1', ownershipKey, source.sourceId]);
    return freeze({ source, revision: 1, history: [source], gameId: runtime.gameId, playId: runtime.playId,
      physicalPitchSourceId: pitch.source.sourceId, firstPhysicalPitchSourceId: prefix[0].source.sourceId,
      scopeId: runtime.membership.scopeId, ownershipKey,
      runtimeReference: { owner: 'actual_live_play_runtimes', sourceId: runtime.source.sourceId, snapshotHash: hash(runtime) },
      producerReference: { owner: 'actual_settled_foul_stop_productions', sourceId: production.source.sourceId, snapshotHash: hash(production) },
      countEvidence, disposition,
      consumption: { kind: 'settled_foul_rule_consumption', status: 'consumed', receiptId, eventKey: event.eventKey,
        successorKey: successor.successorKey, occurredAt: production.event.occurredAt, eventAvailableAt: production.event.availableAt,
        availableAt: production.event.availableAt, proofScope: 'one_original_untouched_foul_rule_consumer' },
      successor: { kind: 'settled_foul_disposition', status: 'pending', basisReceiptId: receiptId,
        successorKey: json(['actual_foul_disposition_successor_v1', receiptId]), pendingReason: disposition.kind === 'pending_original_intent'
          ? 'original_batting_intent_missing' : disposition.kind === 'terminal_strikeout'
            ? 'physical_end_and_terminal_official_closure_unowned' : 'physical_end_and_official_continuation_unowned' } });
  };
  const read = (sourceId: string): DurableActualFoulRuleConsumption | null => {
    const row = ownership.identities(sourceId); if (!row) return null;
    const parsed = input(JSON.parse(row.source_json), sourceId), runtime = runtimeFor(parsed.runtimeSourceId);
    const claims = ownership.claims(runtime);
    if (claims.length !== 1 || claims[0].source_id !== sourceId) throw new Error('foul consumption original scope has conflicting owners');
    const { source } = ownership.metadata(row, runtime), value = derive(source);
    if (row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('foul consumption archive or original dependencies differ');
    return value;
  };
  const census = (raw: ActualFoulRuleConsumerQuery): ActualFoulRuleConsumers => {
    const query = cloneInert(raw);
    if (!fields(query, ['version', 'runtimeSourceId', 'cut']) || query.version !== 'actual_foul_rule_consumers_v1'
      || !id(query.runtimeSourceId)) throw new Error('invalid foul consumption census query');
    const runtime = runtimeFor(query.runtimeSourceId);
    const producer = actualSettledFoulStopProducerEvidenceFromSqlite(db).census({ ...query, version: 'actual_settled_foul_stop_census_v1' });
    const claims = ownership.claims(runtime);
    if (claims.length > 1) throw new Error('foul consumption original scope has conflicting owners');
    const acceptedConsumptions: DurableActualFoulRuleConsumption[] = [], futureConsumptionSourceIds: string[] = [];
    if (claims.length) {
      const { source } = ownership.metadata(claims[0], runtime);
      if (producer.producer.futureSourceIds.includes(source.stopProductionSourceId)) futureConsumptionSourceIds.push(source.sourceId);
      else {
        const value = read(source.sourceId);
        if (!value || !producer.successors.some(s => s.successorKey === value.consumption.successorKey && s.basisEventKey === value.consumption.eventKey)) {
          throw new Error('foul consumption original successor missing at this cut');
        }
        acceptedConsumptions.push(value);
      }
    }
    return freeze({ version: 'actual_foul_rule_consumers_v1', producer, acceptedConsumptions,
      successors: producer.successors.map(original => ({ original,
        consumption: acceptedConsumptions.find(c => c.consumption.successorKey === original.successorKey)?.consumption ?? null })),
      dispositionSuccessors: acceptedConsumptions.map(c => c.successor), consumerCoverage: 'original_foul_consumer_claims_complete',
      futureConsumptionSourceIds, generation: 'event_generation_coverage_pending', physicalEnd: null, officialClosure: null, samePaResume: null });
  };
  return { runtimeFor, ownership, derive, read, census };
};

/** Main-only, read-only evidence; preserve caller-owned transactions and settings. */
export const actualFoulRuleConsumptionEvidenceFromSqlite = (db: DatabaseSync): Readonly<{
  read(sourceId: string): DurableActualFoulRuleConsumption | null;
  census(query: ActualFoulRuleConsumerQuery): ActualFoulRuleConsumers;
}> => {
  const own = owner(db);
  return Object.freeze({ read: sourceId => withBattedVenueLegalReadSnapshot(db, () => own.read(sourceId)),
    census: query => withBattedVenueLegalReadSnapshot(db, () => own.census(query)) });
};
export const openSqliteActualFoulRuleConsumptionStore = (path: string,
  authority?: Readonly<{ readAcceptedConsumption(sourceId: string): AcceptedActualFoulRuleConsumption | null }>): Readonly<{
  accept(sourceId: string): DurableActualFoulRuleConsumption;
  read(sourceId: string): DurableActualFoulRuleConsumption | null;
  close(): void;
}> => {
  if (!id(path) || authority !== undefined && typeof authority.readAcceptedConsumption !== 'function') throw new Error('invalid foul consumption authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS main.${table}(source_id TEXT PRIMARY KEY NOT NULL,source_version TEXT NOT NULL,capability TEXT NOT NULL,
      physical_pitch_source_id TEXT NOT NULL UNIQUE,runtime_source_id TEXT NOT NULL UNIQUE,stop_production_source_id TEXT NOT NULL UNIQUE,
      game_id TEXT NOT NULL,play_id INTEGER NOT NULL,first_physical_pitch_source_id TEXT NOT NULL,scope_id TEXT NOT NULL,
      ownership_key TEXT NOT NULL UNIQUE,consumed_successor_key TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
    foulRuleConsumptionOwnership(db).installed();
  } catch (error) { db.close(); throw error; }
  const own = owner(db); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed foul consumption store'); };
  const snapshot = <T>(body: () => T) => withBattedVenueLegalReadSnapshot(db, body);
  return Object.freeze({
    read(sourceId) { check(sourceId); return snapshot(() => own.read(sourceId)); },
    accept(sourceId) {
      check(sourceId);
      const prior = snapshot(() => own.read(sourceId)), raw = authority?.readAcceptedConsumption(sourceId) ?? null;
      const source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('foul consumption Source is frozen differently');
        return snapshot(() => { const saved = own.read(sourceId);
          if (!saved || json(saved) !== json(prior)) throw new Error('foul consumption changed during retry'); return saved; });
      }
      if (!source) throw new Error('accepted foul consumption Source missing');
      const proposed = snapshot(() => own.derive(source, true)), encoded = json(proposed);
      db.exec('BEGIN IMMEDIATE');
      try {
        const fence = beginActualLivePitchWrite(db, proposed.physicalPitchSourceId, { owner: table, sourceId });
        if (snapshot(() => own.ownership.claims(own.runtimeFor(source.runtimeSourceId))).length
          || snapshot(() => own.read(sourceId))) throw new Error('foul consumption original rule successor already owned');
        if (json(snapshot(() => own.derive(source, true))) !== encoded) throw new Error('foul consumption dependencies changed before write');
        const before = db.prepare('SELECT total_changes() AS n').get()!.n;
        if (typeof before !== 'number' || !Number.isSafeInteger(before + 2)) throw new Error('foul consumption write accounting unavailable');
        db.prepare(`INSERT INTO main.${table} VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(sourceId, source.sourceVersion, source.capability,
          proposed.physicalPitchSourceId, source.runtimeSourceId, source.stopProductionSourceId, proposed.gameId, proposed.playId,
          proposed.firstPhysicalPitchSourceId, proposed.scopeId, proposed.ownershipKey, proposed.consumption.successorKey,
          json(source), hash(source), encoded, hash(proposed));
        recordActualLivePlayAdmission(db, fence);
        if (json(snapshot(() => own.derive(source, true))) !== encoded) throw new Error('foul consumption dependencies changed during write');
        const saved = snapshot(() => own.read(sourceId));
        if (!saved || json(saved) !== encoded) throw new Error('foul consumption changed after admission');
        assertActualLivePlayWriteUnchanged(db, fence);
        if (db.prepare('SELECT total_changes() AS n').get()!.n !== before + 2) throw new Error('foul consumption changed more than its receipt and admission');
        db.exec('COMMIT'); return saved;
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
