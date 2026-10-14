import { assertInFlightBattingWriteCurrentFromSqlite } from './InFlightBattingLifecycleFenceFromSqlite';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { readCurrentSamePaInFlightCutFromSqlite, readHistoricalSamePaInFlightCutFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText, samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { readBattingEmotionGenesisFromSqlite } from './SqliteBattingEmotionStore';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { readHistoricalSamePaContinuationViewFromSqlite, readCurrentSamePaContinuationViewFromSqlite, readSamePaContinuationRecordFromSqlite } from './SamePlateAppearanceContinuationFromSqlite';
import { readEmotionWorldRevisionFromSqlite, readHistoricalEmotionWorldRevisionFromSqlite, appendEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { assertSamePaOriginalMember } from './SamePlateAppearanceInvocationView';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { assertBattingAssessmentOwnership } from './BattingAssessmentOwnership';
import { battingEmotionExecutionInput, deriveBattingEmotionExecution, type AcceptedBattingEmotionExecution, type DurableBattingEmotionExecution } from './NativeBattingEmotionExecution';

const table = 'batting_emotion_execution_v1_executions', heads = 'batting_emotion_execution_v1_heads';
const schemas = {
  [table]: `CREATE TABLE ${table}(source_id TEXT PRIMARY KEY,execution_id TEXT NOT NULL UNIQUE,career_id TEXT NOT NULL,game_id TEXT NOT NULL,player_id TEXT NOT NULL,enrollment_source_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,view_source_id TEXT NOT NULL,genesis_source_id TEXT NOT NULL,emotion_revision INTEGER NOT NULL CHECK(emotion_revision>=1),world_revision INTEGER NOT NULL CHECK(world_revision>=1),state_hash TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(career_id,game_id,player_id,emotion_revision),UNIQUE(career_id,world_revision))`,
  [heads]: `CREATE TABLE ${heads}(career_id TEXT NOT NULL,game_id TEXT NOT NULL,player_id TEXT NOT NULL,enrollment_source_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,genesis_source_id TEXT NOT NULL,genesis_source_hash TEXT NOT NULL,genesis_snapshot_hash TEXT NOT NULL,emotion_revision INTEGER NOT NULL CHECK(emotion_revision>=1),first_source_id TEXT NOT NULL,last_source_id TEXT NOT NULL,last_snapshot_hash TEXT NOT NULL,state_hash TEXT NOT NULL,PRIMARY KEY(career_id,game_id,player_id))`,
};
type Pending = Readonly<{ kind: 'pending'; reason: string; missingSourceIds: readonly string[] }>;
const pending = (reason: string, ids: readonly string[] = []): Pending => freeze({ kind: 'pending', reason, missingSourceIds: ids });
const fail = (detail: string): never => { throw new Error('owned batting emotion execution ' + detail); };
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) fail('original input, state or durable row differs'); };
const storage = (db: DatabaseSync): boolean => {
  assertBodyCompositionNativeConnection(db);
  const rows = db.prepare("SELECT * FROM main.sqlite_master WHERE lower(name) GLOB 'batting_emotion_execution_v1_*' OR lower(tbl_name) GLOB 'batting_emotion_execution_v1_*'").all();
  if (!rows.length) return false;
  if (rows.length !== 7) return fail('namespace is partial or malformed');
  for (const name of [table, heads] as const) {
    const row = rows.find(r => r.name === name); if (!row || row.type !== 'table' || row.tbl_name !== name || row.sql !== schemas[name]) return fail('schema differs');
    const keys = name === table ? [['source_id'], ['execution_id'], ['career_id', 'game_id', 'player_id', 'emotion_revision'], ['career_id', 'world_revision']] : [['career_id', 'game_id', 'player_id']];
    const indexes = db.prepare(`PRAGMA main.index_list(${name})`).all(); if (indexes.length !== keys.length) return fail('index extent differs');
    keys.forEach((columns, i) => {
      const n = `sqlite_autoindex_${name}_${i + 1}`, index = indexes.find(r => r.name === n), catalog = rows.find(r => r.name === n);
      if (!index || !catalog || index.unique !== 1 || index.partial !== 0 || index.origin !== (i === 0 ? 'pk' : 'u') || catalog.type !== 'index' || catalog.tbl_name !== name || catalog.sql !== null) return fail('index identity differs');
      const info = db.prepare(`PRAGMA main.index_xinfo(${n})`).all(); same(info.filter(r => r.key === 1).map(r => r.name), columns);
      if (info.length !== columns.length + 1 || info.some(r => r.coll !== 'BINARY' || r.desc !== 0) || info.at(-1)?.cid !== -1) return fail('index shape differs');
    });
  }
  return true;
};
export const assertBattingEmotionExecutionStorage = storage;
const rowFor = (v: DurableBattingEmotionExecution) => ({ source_id: v.source.sourceId, execution_id: v.source.executionId,
  career_id: v.lineage.careerId, game_id: v.lineage.gameId, player_id: v.source.member.playerId, enrollment_source_id: v.lineage.enrollmentReference.sourceId,
  physical_pitch_source_id: v.physicalPitchSourceId, view_source_id: v.source.viewReference.sourceId, genesis_source_id: v.source.genesisReference.sourceId,
  emotion_revision: v.acceptance.afterEmotionRevision, world_revision: v.acceptance.afterWorldRevision, state_hash: hash(v.acceptance.proposal.appraisal.state),
  source_json: json(v.source), source_hash: hash(v.source), snapshot_json: json(v), snapshot_hash: hash(v) });
const identityRow = (db: DatabaseSync, id: string) => {
  if (!storage(db)) return null;
  const rows = db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id });
  if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== id) return fail('raw Source identity differs');
  if (!rows.length && (db.prepare(`SELECT 1 FROM main.${heads} WHERE first_source_id=? OR last_source_id=?`).get(id, id)
    || db.prepare(`SELECT 1 FROM main.${table} WHERE ${claim('source_json', ['previousExecutionReference', 'sourceId'], '$id')}`).get({ id }))) return fail('missing execution has surviving history claim');
  return rows[0] ?? null;
};
const scope = (v: DurableBattingEmotionExecution) => [v.lineage.careerId, v.lineage.gameId, v.source.member.playerId] as const;
const head = (db: DatabaseSync, ids: readonly [string, string, string]) => !storage(db) ? null : db.prepare(`SELECT * FROM main.${heads} WHERE career_id=? AND game_id=? AND player_id=?`).get(...ids) ?? null;
const scopeRows = (db: DatabaseSync, ids: readonly [string, string, string]) => db.prepare(`SELECT * FROM main.${table} WHERE
  (career_id=$career OR ${claim('snapshot_json', ['lineage', 'careerId'], '$career')}) AND (game_id=$game OR ${claim('snapshot_json', ['lineage', 'gameId'], '$game')})
  AND (player_id=$player OR ${claim('source_json', ['member', 'playerId'], '$player')}) ORDER BY emotion_revision`).all({ career: ids[0], game: ids[1], player: ids[2] });
const headForRows = (ids: readonly [string, string, string], genesis: AcceptedBattingEmotionExecution['genesisReference'], rows: ReturnType<typeof scopeRows>) => rows.length === 0 ? null : ({
  career_id: ids[0], game_id: ids[1], player_id: ids[2], enrollment_source_id: rows.at(-1)!.enrollment_source_id, physical_pitch_source_id: rows.at(-1)!.physical_pitch_source_id,
  genesis_source_id: genesis.sourceId, genesis_source_hash: genesis.sourceHash, genesis_snapshot_hash: genesis.snapshotHash,
  emotion_revision: rows.length, first_source_id: rows[0].source_id, last_source_id: rows.at(-1)!.source_id,
  last_snapshot_hash: rows.at(-1)!.snapshot_hash, state_hash: rows.at(-1)!.state_hash,
});
const expectedHead = (v: DurableBattingEmotionExecution, rows: ReturnType<typeof scopeRows>) => headForRows(scope(v), v.source.genesisReference, rows);
const assertHead = (db: DatabaseSync, v: DurableBattingEmotionExecution) => {
  const rows = scopeRows(db, scope(v));
  if (rows.some((r, i) => r.career_id !== v.lineage.careerId || r.game_id !== v.lineage.gameId || r.player_id !== v.source.member.playerId
    || r.emotion_revision !== i + 1 || r.genesis_source_id !== v.source.genesisReference.sourceId)) return fail('emotion extent or original scope differs');
  same(head(db, scope(v)), expectedHead(v, rows));
};
const eventValue = (v: DurableBattingEmotionExecution) => ({ kind: 'EMOTION_EXECUTION', executionId: v.acceptance.executionId,
  expectedFrame: v.acceptance.expectedFrame, afterWorldRevision: v.acceptance.afterWorldRevision, beforeEmotionRevision: v.acceptance.beforeEmotionRevision,
  afterEmotionRevision: v.acceptance.afterEmotionRevision, acceptanceHash: hash(v.acceptance) });
const assembly = (db: DatabaseSync) => {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if (!(db instanceof Native)) return fail('requires a Native connection');
  if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) return fail('requires a private read-only proof');
  const active = new Set<string>(), cache = new Map<string, DurableBattingEmotionExecution>();
  const derive = (source: AcceptedBattingEmotionExecution, current: boolean): DurableBattingEmotionExecution | Pending => {
    assertBattingAssessmentOwnership(db, table, source);
    const inFlight = source.capability === 'owned_in_flight_batting_emotion_execution_v1';
    const b = inFlight ? (current ? readCurrentSamePaLifecycleViewFromSqlite : readHistoricalSamePaLifecycleViewFromSqlite)(db, source.viewReference)
      : (current ? readCurrentSamePaContinuationViewFromSqlite : readHistoricalSamePaContinuationViewFromSqlite)(db, source.viewReference);
    const physicalPitchReference = b.view.kind === 'same_pa_lifecycle_view' ? b.view.cut.physicalPitchReference : b.view.physicalCut.pitchReference;
    const evaluationTick = b.view.kind === 'same_pa_lifecycle_view' ? b.view.cut.evaluationTick : b.view.evaluationTick;
    if (inFlight) {
      if (b.view.kind !== 'same_pa_lifecycle_view' || b.view.cut.stage !== 'in_flight') return fail('appraisal requires original in-flight cut');
      same(source.physicalPitchReference, physicalPitchReference); same(source.physicalOperationReference, b.view.cut.physicalOperationReference);
      const cut = (current ? readCurrentSamePaInFlightCutFromSqlite : readHistoricalSamePaInFlightCutFromSqlite)(db, source.physicalOperationReference);
      same(cut.physicalPitchReference, physicalPitchReference); same(cut.evaluationTick, evaluationTick);
      if (cut.stage !== 'in_flight') return fail('appraisal cannot use a committed motion cut');
    }
    const member = b.members.find(m => m.playerId === source.member.playerId); if (!member || b.actor.binding.playerId !== member.playerId) return fail('actual batting participant missing'); same(member, source.member);
    const genesis = readBattingEmotionGenesisFromSqlite(db, source.genesisReference.sourceId);
    if (!genesis) return pending('explicit_emotion_genesis_missing', [source.genesisReference.sourceId]);
    same(reference('batting_emotion_v1_geneses', genesis), source.genesisReference);
    same(genesis.scope, { careerId: b.actor.binding.careerId, matchId: b.actor.source.gameId, playerId: b.actor.binding.playerId });
    same(genesis.source.member.personHash, source.member.personHash);
    const observation = readBattingPerceptionFromSqlite(db, 'observation', source.observationReference);
    if (observation.kind !== 'batting_observation') return fail('original sensory owner differs');
    assertSamePaOriginalMember(observation.source.member, source.member); same(observation.lineage, b.view.lineage); same(observation.source.physicalPitchReference, physicalPitchReference);
    const delivery = readBattingPerceptionFromSqlite(db, 'delivery', source.deliveryReference);
    if (delivery.kind !== 'batting_observation_delivery') return fail('original delivered event owner differs');
    same(delivery.source.observationReference, source.observationReference); same(delivery.originalCaptureHash, hash(observation));
    assertSamePaOriginalMember(delivery.source.member, source.member); same(delivery.lineage, b.view.lineage); same(delivery.physicalPitchReference, physicalPitchReference);
    const prefix = b.view.kind === 'same_pa_lifecycle_view' ? readSamePaLifecycleRecordFromSqlite(db, 'prefix', b.view.source.prefixReference.sourceId)
      : readSamePaContinuationRecordFromSqlite(db, 'prefix', b.view.source.prefixReference.sourceId);
    if (!prefix || prefix.kind !== 'nonempty_prefix' && prefix.kind !== 'same_pa_lifecycle_prefix') return fail('owned invocation prefix missing');
    const sequence = prefix.kind === 'same_pa_lifecycle_prefix' ? prefix.source.eventReferences.length : prefix.source.operationReferences.length;
    const previous = source.previousExecutionReference === null ? null : read(source.previousExecutionReference.sourceId);
    if (source.previousExecutionReference !== null && !previous) return pending('previous_emotion_execution_missing', [source.previousExecutionReference.sourceId]);
    if (previous) { same(reference(table, previous), source.previousExecutionReference); same(previous.source.genesisReference, source.genesisReference);
      same(previous.source.member.personHash, source.member.personHash); }
    const worldBefore = current ? readEmotionWorldRevisionFromSqlite(db, b.view.lineage.careerId)
      : readHistoricalEmotionWorldRevisionFromSqlite(db, b.view.lineage.careerId, source.expectedWorld.worldRevision);
    if (!worldBefore) return pending('actual_world_control_head_missing');
    if (physicalPitchReference.owner === 'pa_take_successor_v1_pitch_actions') return fail('unsupported sensory pitch owner');
    if (inFlight && (observation.source.capability !== 'owned_in_flight_batting_observation_v1' || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1')) return fail('appraisal in-flight sensory owners differ');
    const beforeEmotion = previous?.acceptance.proposal.appraisal.state ?? genesis.state;
    const value = deriveBattingEmotionExecution(source, { actor: b.actor, lineage: b.view.lineage, worldBefore, beforeEmotion, observation, delivery,
      time: { tick: evaluationTick, sequence }, physicalPitchReference: { ...physicalPitchReference, owner: physicalPitchReference.owner } });
    if (current) {
      const currentHead = head(db, scope(value));
      if (previous) { assertHead(db, previous); if (currentHead?.last_source_id !== previous.source.sourceId || currentHead.state_hash !== hash(beforeEmotion)) return fail('stale emotion head'); }
      else if (currentHead !== null || storage(db) && scopeRows(db, scope(value)).length) return fail('emotion genesis cannot restart existing history');
      if (storage(db)) {
        const aliases = db.prepare(`SELECT source_id FROM main.${table} WHERE execution_id=? OR (career_id=? AND game_id=? AND player_id=? AND emotion_revision=?)`)
          .all(source.executionId, ...scope(value), value.acceptance.afterEmotionRevision);
        if (aliases.some(r => r.source_id !== source.sourceId)) return fail('execution meaning belongs to another Source');
      }
    }
    return value;
  };
  const read = (id: string): DurableBattingEmotionExecution | null => {
    const cached = cache.get(id); if (cached) return cached;
    if (active.has(id)) return fail('cyclic original emotion history'); const row = identityRow(db, id); if (!row) return null;
    active.add(id); try {
      const source = battingEmotionExecutionInput(JSON.parse(String(row.source_json)), id), value = derive(source, false);
      if (value.kind === 'pending') return fail('accepted execution lost an original prerequisite'); same(row, rowFor(value)); assertHead(db, value);
      const event = db.prepare('SELECT * FROM main.world_decision_revision_events WHERE career_id=? AND world_revision=?').get(value.lineage.careerId, value.acceptance.afterWorldRevision);
      if (!event || event.source_kind !== 'EMOTION_EXECUTION' || event.source_event_id !== source.executionId || event.event_json !== json(eventValue(value))) return fail('actual World execution event differs');
      cache.set(id, value); return value;
    } finally { active.delete(id); }
  };
  return { derive, read };
};
export const readBattingEmotionExecutionFromSqlite = (db: DatabaseSync, ref: SamePaReference<'batting_emotion_execution_v1_executions'>) => {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if (!(db instanceof Native) || !samePaReferenceValid(ref, table)) return fail('invalid Native reference');
  const value = assembly(db).read(ref.sourceId); if (!value) return fail('original execution missing'); same(reference(table, value), ref); return value;
};
export const readCurrentBattingEmotionExecutionFromSqlite = (db: DatabaseSync, ref: SamePaReference<'batting_emotion_execution_v1_executions'>) => {
  const value = readBattingEmotionExecutionFromSqlite(db, ref), current = head(db, scope(value));
  if (!current || current.last_source_id !== value.source.sourceId || current.last_snapshot_hash !== hash(value)
    || current.state_hash !== hash(value.acceptance.proposal.appraisal.state)) return fail('current emotion acceptance is stale');
  return value;
};
export const readBattingEmotionExecutionClaims = (db: DatabaseSync, input: Readonly<{ enrollmentSourceId: string; physicalPitchSourceId: string }>) => {
  if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) return fail('invalid claim proof'); if (!storage(db)) return [];
  for (const h of db.prepare(`SELECT * FROM main.${heads} WHERE enrollment_source_id=? AND physical_pitch_source_id=?`).all(input.enrollmentSourceId, input.physicalPitchSourceId)) {
    if (!identityRow(db, String(h.last_source_id))) return fail('missing execution survives in emotion head');
  }
  return db.prepare(`SELECT * FROM main.${table} WHERE (enrollment_source_id=$enrollment OR ${claim('snapshot_json', ['lineage', 'enrollmentReference', 'sourceId'], '$enrollment')})
    AND (physical_pitch_source_id=$pitch OR ${claim('snapshot_json', ['physicalPitchSourceId'], '$pitch')})`).all({ enrollment: input.enrollmentSourceId, pitch: input.physicalPitchSourceId }).map(row => {
      const source = battingEmotionExecutionInput(JSON.parse(String(row.source_json)), String(row.source_id)), ids = [String(row.career_id), String(row.game_id), String(row.player_id)] as const;
      const rows = scopeRows(db, ids); if (rows.some((r, i) => r.emotion_revision !== i + 1)) return fail('invocation emotion extent differs');
      same(head(db, ids), headForRows(ids, source.genesisReference, rows));
      return { owner: table, sourceId: String(row.source_id), sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
    });
};
export const openSqliteBattingEmotionExecutionStore = (path: string, authority?: Readonly<{ readAcceptedExecution(id: string): unknown }>) => {
  if (!samePaText(path) || authority && typeof authority.readAcceptedExecution !== 'function') return fail('invalid owner input');
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync, db = new Native(path), tx = battingInvocationTransaction(db, () => storage(db));
  return Object.freeze({
    read(id: string) { if (!samePaText(id)) return fail('invalid Source identity'); return tx.run(false, proof => proof(() => assembly(db).read(id)), value => same(assembly(db).read(id), value)); },
    accept(id: string): DurableBattingEmotionExecution | Pending {
      if (!samePaText(id)) return fail('invalid Source identity');
      let fresh = false;
      const fence = (value: DurableBattingEmotionExecution) => { if (!fresh || value.source.capability !== 'owned_in_flight_batting_emotion_execution_v1') return;
        assertInFlightBattingWriteCurrentFromSqlite(db, value.source.viewReference, reference(table, value));
        const world = readEmotionWorldRevisionFromSqlite(db, value.lineage.careerId);
        if (!world || world.head.worldRevision !== value.acceptance.afterWorldRevision) return fail('in-flight appraisal World head changed');
        same(world.head.control, value.worldBefore.head.control);
      };
      return tx.run(true, (proof, step) => {
        const prepared = proof(() => {
          const existing = assembly(db).read(id), raw = authority?.readAcceptedExecution(id), source = raw == null ? null : battingEmotionExecutionInput(raw, id);
          if (existing) { if (source) same(existing.source, source); return { value: existing, existing: true }; }
          return { value: source ? assembly(db).derive(source, true) : pending('accepted_emotion_assessment_missing', [id]), existing: false };
        });
        const value = prepared.value; if (prepared.existing || value.kind === 'pending') return value; fresh = true;
        if (!proof(() => storage(db))) step(() => db.exec(Object.values(schemas).join(';')), 0, 2);
        const beforeHead = proof(() => { same(assembly(db).derive(value.source, true), value); if (identityRow(db, id)) return fail('unexpected Source appeared'); return head(db, scope(value)); });
        const row = rowFor(value); step(() => { const r = db.prepare(`INSERT INTO main.${table}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row)); if (r.changes !== 1) fail('execution append differs'); }, 1);
        const next = proof(() => { same(identityRow(db, id), row); same(head(db, scope(value)), beforeHead); const rows = scopeRows(db, scope(value));
          if (rows.at(-1)?.source_id !== id || rows.length !== value.acceptance.afterEmotionRevision) return fail('staged emotion extent differs');
          same(expectedHead(value, rows.slice(0, -1)), beforeHead); return expectedHead(value, rows)!; });
        step(() => {
          const result = beforeHead === null ? db.prepare(`INSERT INTO main.${heads}(${Object.keys(next).join(',')}) VALUES(${Object.keys(next).map(() => '?').join(',')})`).run(...Object.values(next))
            : db.prepare(`UPDATE main.${heads} SET enrollment_source_id=?,physical_pitch_source_id=?,emotion_revision=?,last_source_id=?,last_snapshot_hash=?,state_hash=? WHERE career_id=? AND game_id=? AND player_id=? AND emotion_revision=? AND last_source_id=? AND state_hash=?`)
              .run(next.enrollment_source_id, next.physical_pitch_source_id, next.emotion_revision, next.last_source_id, next.last_snapshot_hash, next.state_hash, ...scope(value), beforeHead.emotion_revision, beforeHead.last_source_id, beforeHead.state_hash);
          if (result.changes !== 1) fail('emotion state CAS differs');
        }, 1);
        proof(() => { assertHead(db, value); same(assembly(db).derive(value.source, false), value); });
        step(() => { appendEmotionWorldRevisionFromSqlite(db, value.worldBefore, value.acceptance); }, 2);
        proof(() => { same(assembly(db).read(id), value); fence(value); }); return value;
      }, value => { const saved = assembly(db).read(id); if (value.kind === 'pending') { if (saved) fail('pending Source acquired durable ownership'); } else { same(saved, value); fence(value); } });
    }, close: tx.close,
  });
};
