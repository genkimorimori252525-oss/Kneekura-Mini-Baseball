import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { calculateBattingObservation } from '../../core/world/psychology/batting/BattingObservationCalculation';
import { actorHash as hash, actorJson as json, actorFreeze as freeze, readPhysicalPlateAppearanceActorFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaText, samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference, proveSamePaExecution } from './SamePlateAppearanceExecutionFromSqlite';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { assertFreshPaDispatchEnrollment } from './SamePlateAppearanceDispatchClaimGuard';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from './PlayerBodyCapabilityMaterializationEvidence';
import { readSamePaPreparedActionFromSqlite, readSamePaExecutedPitchFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { readHistoricalSamePaContinuationViewFromSqlite, readCurrentSamePaContinuationViewFromSqlite, readSamePaContinuationCalibrationFromSqlite, readCurrentSamePaContinuationCalibrationFromSqlite } from './SamePlateAppearanceContinuationFromSqlite';
import { assertSamePaOriginalMember } from './SamePlateAppearanceInvocationView';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { deriveDeliveredBattingObservedMotionForecast } from './NativeBattingPrediction';
import { deriveBattingObservationDelivery } from './NativeBattingDelivery';
import { assertCurrentBattingScoreAssessmentBasis } from './NativeBattingCurrentScoreAssessment';
import { assertBattingAssessmentOwnership } from './BattingAssessmentOwnership';
import { readSamePaNextTakeActionFromSqlite } from './SamePlateAppearanceTakeSuccessorFromSqlite';
import { battingPerceptionSourceInput, battingPerceptionTables as tables, type BattingPerceptionKind as Kind, type BattingPerceptionSource as Source,
  type BattingPerceptionRecord as RecordValue, type DurableBattingInvocationPosture, type DurableBattingObservation, type DurableBattingObservationDelivery, type DurableBattingObservedPrediction } from './NativeBattingPerception';

type Pending = Readonly<{ kind: 'pending'; reason: string; missingSourceIds: readonly string[] }>;
const pending = (reason: string, ids: readonly string[] = []): Pending => freeze({ kind: 'pending', reason, missingSourceIds: ids });
const fail = (detail: string): never => { throw new Error('batting perception ' + detail); };
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) fail('original dependency or durable row differs'); };
const names = Object.values(tables);
const heads = 'batting_observation_v1_invocation_heads';
const schema = Object.fromEntries(names.map(name => [name, `CREATE TABLE ${name}(source_id TEXT PRIMARY KEY,view_source_id TEXT NOT NULL,player_id TEXT NOT NULL,enrollment_source_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,canonical_key TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`]));
schema[heads] = `CREATE TABLE ${heads}(owner TEXT NOT NULL,enrollment_source_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=1),first_source_id TEXT NOT NULL,last_source_id TEXT NOT NULL,last_snapshot_hash TEXT NOT NULL,PRIMARY KEY(owner,enrollment_source_id,physical_pitch_source_id,player_id))`;
const storage = (db: DatabaseSync): boolean => {
  assertBodyCompositionNativeConnection(db);
  const rows = db.prepare("SELECT * FROM main.sqlite_master WHERE lower(name) GLOB 'batting_observation_v1_*' OR lower(tbl_name) GLOB 'batting_observation_v1_*' OR lower(name) GLOB 'batting_prediction_v1_*' OR lower(tbl_name) GLOB 'batting_prediction_v1_*' OR lower(name) GLOB 'batting_score_v1_*' OR lower(tbl_name) GLOB 'batting_score_v1_*'").all();
  if (!rows.length) return false;
  if (rows.length !== names.length * 3 + 2) return fail('namespace is partial or malformed');
  for (const name of names) {
    const row = rows.find(r => r.name === name);
    if (!row || row.type !== 'table' || row.tbl_name !== name || row.sql !== schema[name]) return fail('schema differs');
    const indexes = db.prepare(`PRAGMA main.index_list(${name})`).all(); if (indexes.length !== 2) return fail('index count differs');
    for (const [i, key] of ['source_id', 'canonical_key'].entries()) {
      const indexName = `sqlite_autoindex_${name}_${i + 1}`, index = indexes.find(r => r.name === indexName), row = rows.find(r => r.name === indexName);
      if (!index || !row || row.type !== 'index' || row.tbl_name !== name || row.sql !== null || index.unique !== 1 || index.partial !== 0 || index.origin !== (i === 0 ? 'pk' : 'u')) return fail('index identity differs');
      const info = db.prepare(`PRAGMA main.index_xinfo(${indexName})`).all(); same(info.filter(r => r.key === 1).map(r => r.name), [key]);
      if (info.length !== 2 || info.some(r => r.coll !== 'BINARY' || r.desc !== 0) || info.at(-1)?.cid !== -1) return fail('index shape differs');
    }
  }
  const head = rows.find(r => r.name === heads), headIndexName = `sqlite_autoindex_${heads}_1`, headIndex = rows.find(r => r.name === headIndexName);
  if (!head || head.type !== 'table' || head.tbl_name !== heads || head.sql !== schema[heads] || !headIndex || headIndex.type !== 'index'
    || headIndex.tbl_name !== heads || headIndex.sql !== null) return fail('invocation head namespace differs');
  const headIndexes = db.prepare(`PRAGMA main.index_list(${heads})`).all(), info = db.prepare(`PRAGMA main.index_xinfo(${headIndexName})`).all();
  if (headIndexes.length !== 1 || headIndexes[0].name !== headIndexName || headIndexes[0].unique !== 1 || headIndexes[0].partial !== 0 || headIndexes[0].origin !== 'pk'
    || info.length !== 5 || info.some(r => r.coll !== 'BINARY' || r.desc !== 0) || info.at(-1)?.cid !== -1) return fail('invocation head index differs');
  same(info.filter(r => r.key === 1).map(r => r.name), ['owner', 'enrollment_source_id', 'physical_pitch_source_id', 'player_id']);
  return true;
};
const canonical = (s: Source): string => {
  switch (s.capability) {
    case 'owned_batting_invocation_posture_v1': return json([s.viewReference.sourceId, s.member.playerId, s.actionReference.sourceId]);
    case 'owned_next_take_batting_posture_v1': return json([s.viewReference.sourceId, s.member.playerId, s.actionReference.sourceId]);
    case 'owned_batting_observation_v1': return json([s.postureReference.sourceId, s.physicalPitchReference.sourceId, s.observedTick]);
    case 'owned_batting_observation_delivery_v1': return json(sourceCaptureKey(s.observationReference));
    case 'owned_batting_observed_prediction_v1': return json([s.observationReference.sourceId, s.modelReference, s.predictionParameterReference]);
    case 'owned_batting_score_assessment_v1':
    case 'owned_batting_current_score_assessment_v1': return json([s.predictionReference, s.modelReference, s.member, s.observationCutReference, s.viewReference]);
  }
};
const sourceCaptureKey = (ref: SamePaReference) => [ref.owner, ref.sourceId, ref.sourceHash, ref.snapshotHash];
const rowFor = (v: RecordValue) => ({ source_id: v.source.sourceId, view_source_id: v.source.viewReference.sourceId, player_id: v.source.member.playerId,
  enrollment_source_id: v.lineage.enrollmentReference.sourceId, physical_pitch_source_id: v.physicalPitchSourceId,
  canonical_key: canonical(v.source), source_json: json(v.source), source_hash: hash(v.source), snapshot_json: json(v), snapshot_hash: hash(v) });
const identityRow = (db: DatabaseSync, kind: Kind, id: string) => {
  if (!storage(db)) return null;
  const rows = names.flatMap(table => db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id }).map(row => ({ table, row })));
  if (rows.length > 1 || rows.length === 1 && (rows[0].table !== tables[kind] || rows[0].row.source_id !== id)) return fail('raw Source identity differs');
  if (!rows.length) {
    if (db.prepare(`SELECT 1 FROM main.${heads} WHERE owner=? AND (first_source_id=? OR last_source_id=?)`).get(tables[kind], id, id)) return fail('missing original invocation has surviving head claim');
    for (const table of names) for (const column of ['source_json', 'snapshot_json']) {
      // Only typed reference identity metadata is inspected; unrelated opaque
      // payloads never become dependencies merely by containing the same text.
      const orphan = db.prepare(`SELECT 1 FROM main.${table},json_tree(CASE WHEN json_valid(${column}) THEN ${column} ELSE '{}' END) obj
        WHERE obj.type='object' AND EXISTS(SELECT 1 FROM json_each(obj.value) o WHERE o.key='owner' AND o.type='text' AND o.atom=$owner)
        AND EXISTS(SELECT 1 FROM json_each(obj.value) i WHERE i.key='sourceId' AND i.type='text' AND i.atom=$id) LIMIT 1`).get({ owner: tables[kind], id });
      if (orphan) return fail('missing original owner has surviving typed claim');
    }
  }
  return rows[0]?.row ?? null;
};
const invocationKind = (kind: Kind): kind is 'observation' | 'delivery' | 'prediction' => kind === 'observation' || kind === 'delivery' || kind === 'prediction';
const workScopeRows = (db: DatabaseSync, owner: string, enrollment: string, pitch: string, player: string) => db.prepare(`SELECT rowid AS owned_rowid,* FROM main.${owner} WHERE
  (enrollment_source_id=$enrollment OR ${claim('snapshot_json', ['lineage', 'enrollmentReference', 'sourceId'], '$enrollment')})
  AND (physical_pitch_source_id=$pitch OR ${claim('snapshot_json', ['physicalPitchSourceId'], '$pitch')})
  AND (player_id=$player OR ${claim('source_json', ['member', 'playerId'], '$player')}) ORDER BY rowid`).all({ enrollment, pitch, player });
const workHead = (db: DatabaseSync, owner: string, enrollment: string, pitch: string, player: string) =>
  db.prepare(`SELECT * FROM main.${heads} WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?`).get(owner, enrollment, pitch, player) ?? null;
const expectedWorkHead = (owner: string, enrollment: string, pitch: string, player: string, rows: ReturnType<typeof workScopeRows>) => rows.length === 0 ? null : {
  owner, enrollment_source_id: enrollment, physical_pitch_source_id: pitch, player_id: player, revision: rows.length,
  first_source_id: rows[0].source_id, last_source_id: rows.at(-1)!.source_id, last_snapshot_hash: rows.at(-1)!.snapshot_hash,
};
const assertWorkHead = (db: DatabaseSync, owner: string, enrollment: string, pitch: string, player: string) => {
  const rows = workScopeRows(db, owner, enrollment, pitch, player);
  for (const row of rows) if (row.enrollment_source_id !== enrollment || row.physical_pitch_source_id !== pitch || row.player_id !== player) return fail('invocation scope index differs from raw claim');
  same(workHead(db, owner, enrollment, pitch, player), expectedWorkHead(owner, enrollment, pitch, player, rows));
};
const assertCanonical = (db: DatabaseSync, kind: Kind, source: Source) => {
  if (!storage(db)) return;
  const rows = db.prepare(`SELECT * FROM main.${tables[kind]} WHERE canonical_key=$key OR ((view_source_id=$view OR ${claim('source_json', ['viewReference', 'sourceId'], '$view')})
    AND (player_id=$player OR ${claim('source_json', ['member', 'playerId'], '$player')}))`).all({ key: canonical(source), view: source.viewReference.sourceId, player: source.member.playerId });
  for (const row of rows) {
    const other = battingPerceptionSourceInput(kind, JSON.parse(String(row.source_json)), String(row.source_id));
    if (canonical(other) === canonical(source) && other.sourceId !== source.sourceId) fail('canonical operation already belongs to another Source');
    if (row.canonical_key !== canonical(other)) fail('canonical index differs from original Source');
  }
};

/** A single immutable read proof owns these caches; callers cannot retain or
 * submit it. Recreated after every DDL/DML and for the committed verification. */
const assembly = (db: DatabaseSync, fresh: boolean) => {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if (!(db instanceof Native)) return fail('requires a Native connection');
  if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) return fail('requires Native read-only proof');
  const active = new Set<string>(), records = new Map<string, RecordValue>();
  const assertHead = (kind: 'observation' | 'delivery' | 'prediction', value: RecordValue) => {
    const scope = [tables[kind], value.lineage.enrollmentReference.sourceId, value.physicalPitchSourceId, value.source.member.playerId] as const;
    if (value.kind === 'batting_observation' && value.eventSequence !== workScopeRows(db, ...scope).findIndex(r => r.source_id === value.source.sourceId) + 1) return fail('sensory sequence differs from owned stream');
    assertWorkHead(db, ...scope);
  };
  const bases = new Map<string, ReturnType<typeof original>>();
  function original(source: Source, current: boolean) {
    if (source.viewReference.owner === 'pa_continuation_v1_execution_views') {
      const result = (current ? readCurrentSamePaContinuationViewFromSqlite : readHistoricalSamePaContinuationViewFromSqlite)(db, source.viewReference);
      const member = result.members.find(m => m.playerId === source.member.playerId); if (!member) return fail('current view original member missing');
      same(source.member, member); if (result.actor.binding.playerId !== member.playerId) return fail('current batting role differs');
      return { actor: result.actor, view: result.view, member, current };
    }
    const view = readHistoricalSamePaExecutionView(db, source.viewReference).view, actor = readPhysicalPlateAppearanceActorFromSqlite(db, view.lineage.actorReference.sourceId);
    if (!actor) return fail('original actor missing');
    const member = deriveSamePaDispatchRoles(actor, view)[0].member; same(source.member, member); return { view, actor, member, current };
  }
  const basis = (s: Source, current = false) => { const key = json(s.viewReference), known = bases.get(key); if (known && (!current || known.current)) { same(known.member, s.member); return known; }
    const value = original(s, current); bases.set(key, value); return value; };
  const linked = (kind: Kind, ref: SamePaReference): RecordValue | null => { if (!samePaReferenceValid(ref, tables[kind])) return fail('reference owner differs');
    const value = read(kind, ref.sourceId); if (value) same(reference(tables[kind], value), ref); return value; };
  const model = (s: Source, ref: SamePaReference<'world_player_batting_models'>, current = false) => {
    const b = basis(s), value = playerBattingModelEvidenceFromSqlite(db).read(ref.sourceId); if (!value) return fail('normal batting model missing'); same(reference(ref.owner, value), ref);
    same(value.person, b.actor.person); if (value.source.careerId !== b.actor.binding.careerId || value.source.playerId !== b.member.playerId || value.source.acceptedAtDay > b.actor.binding.gameDay) return fail('normal model scope differs');
    if (current) same(playerBattingModelEvidenceFromSqlite(db).selectAtDay(b.actor.binding.careerId, b.actor.binding.playerId, b.actor.binding.gameDay), value);
    return value;
  };
  const derive = (source: Source, current: boolean): RecordValue | Pending => {
    const b = basis(source, current), lineage = b.view.lineage;
    if (source.capability === 'owned_batting_invocation_posture_v1' || source.capability === 'owned_next_take_batting_posture_v1') {
      assertBattingAssessmentOwnership(db, tables.posture, source);
      const action = source.capability === 'owned_batting_invocation_posture_v1' ? readSamePaPreparedActionFromSqlite(db, source.actionReference)
        : readSamePaNextTakeActionFromSqlite(db, source.actionReference);
      const nominal = model(source, source.modelReference), g = source.geometry;
      same(action.source.viewReference, source.viewReference); same(action.source.batterModelReference, source.modelReference);
      const startedAtTick = action.kind === 'next_take_action_prepared' ? action.bodyCut.completedAtTick : b.actor.world.tick;
      if (g.startedAtTick !== startedAtTick || g.ticksPerSecond !== 1_000_000 || g.plateZ !== action.source.nominalPitch.batter.plateZ
        || nominal.observationCalibration.values.calibration.memoryDecayParameters.ticksPerSecond !== g.ticksPerSecond
        || nominal.predictionCalibration.values.parameters.ticksPerSecond !== g.ticksPerSecond) return fail('posture original clock or geometry differs');
      same(g.strikeZone, action.source.nominalPitch.batter.strikeZone);
      if (b.actor.world.runners.length || b.actor.world.defenders.some(d => d.velocity.x !== 0 || d.velocity.z !== 0)) return pending('owned_moving_body_cut_required');
      const expected = b.actor.defenderBindings.map(d => d.playerId).sort(); same(source.sceneBodyReferences.map(r => r.playerId).sort(), expected);
      const bodies = playerBodyCapabilityMaterializationEvidenceFromSqlite(db), sceneBodies = source.sceneBodyReferences.map(pin => {
        const body = bodies.read(pin.bodyReference.sourceId); if (!body) return null; same(reference(pin.bodyReference.owner, body), pin.bodyReference);
        const person = b.actor.defenderPersons.find(p => p.playerId === pin.playerId); same(body.person, person);
        if (body.source.playerId !== pin.playerId || body.source.careerId !== b.actor.binding.careerId || body.source.atDay > b.actor.binding.gameDay
          || !['defender', 'pitcher'].includes(body.source.role)) return fail('scene body original scope differs'); return body;
      });
      if (sceneBodies.some(v => v === null)) return pending('original_scene_body_missing', source.sceneBodyReferences.filter((_, i) => sceneBodies[i] === null).map(r => r.bodyReference.sourceId));
      if (current && source.capability === 'owned_batting_invocation_posture_v1') {
        same(proveSamePaExecution(db, { kind: 'view', sourceId: source.viewReference.sourceId }), b.view);
        assertFreshPaDispatchEnrollment(db, b.view.lineage.enrollmentReference.sourceId);
        same(playerBattingModelEvidenceFromSqlite(db).selectAtDay(b.actor.binding.careerId, b.actor.binding.playerId, b.actor.binding.gameDay), nominal);
      }
      if (source.capability === 'owned_next_take_batting_posture_v1') {
        if (source.nextPhysicalPitchSourceId === lineage.firstPhysicalPitchSourceId) return fail('next posture cannot reuse the original physical identity');
        if (current) model(source, source.modelReference, true);
      }
      return freeze({ kind: 'batting_invocation_posture', source, lineage, physicalPitchSourceId: source.capability === 'owned_next_take_batting_posture_v1'
        ? source.nextPhysicalPitchSourceId : lineage.firstPhysicalPitchSourceId, model: nominal, sceneBodies: sceneBodies as NonNullable<typeof sceneBodies[number]>[] });
    }
    if (source.capability === 'owned_batting_observation_v1') {
      const posture = linked('posture', source.postureReference) as DurableBattingInvocationPosture | null;
      if (!posture) return pending('original_posture_missing', [source.postureReference.sourceId]);
      assertSamePaOriginalMember(posture.source.member, source.member); same(posture.lineage, lineage);
      const { pitch, action } = readSamePaExecutedPitchFromSqlite(db, source.physicalPitchReference);
      same(reference('pa_dispatch_v1_action_plans', action), posture.source.actionReference); same(pitch.lineage, lineage);
      if (b.view.kind !== 'nonempty_basis_prepared') return fail('observation lacks a nonempty execution view');
      same(b.view.physicalCut.pitchReference, source.physicalPitchReference);
      const effective = (current ? readCurrentSamePaContinuationCalibrationFromSqlite : readSamePaContinuationCalibrationFromSqlite)(db, source.calibrationReference), c = effective.source, g = posture.source.geometry;
      if (c.route !== 'batter_observation' || c.response.kind !== 'accepted_execution_values_v1') return fail('sensory calibration route differs');
      same(c.member, source.member); same(c.viewReference, source.viewReference); same(c.nominalReference, posture.source.modelReference);
      if (source.observedTick !== b.view.physicalCut.crossing.tick || source.deliveryCutTick !== source.observedTick
        || b.view.evaluationTick !== source.observedTick || source.deliveryCutTick > g.validUntilTick) return pending('owned_current_ball_capture_cut_unavailable');
      const previous = source.previousObservationReference === null ? null : linked('observation', source.previousObservationReference) as DurableBattingObservation | null;
      if (source.previousObservationReference && !previous) return pending('previous_observation_missing', [source.previousObservationReference.sourceId]);
      if (previous) { same(previous.source.postureReference, source.postureReference); same(previous.source.physicalPitchReference, source.physicalPitchReference);
        if (previous.source.observedTick >= source.observedTick || previous.source.deliveryCutTick > source.deliveryCutTick) return fail('observation chronology differs'); }
      const head = workHead(db, tables.observation, lineage.enrollmentReference.sourceId, pitch.source.sourceId, source.member.playerId);
      if (current && (head?.last_source_id ?? null) !== (previous?.source.sourceId ?? null)) return fail('observation must extend the actual current sensory head');
      if (!current && previous === null && head && head.first_source_id !== source.sourceId) return fail('observation cannot acquire another sensory origin');
      const eventSequence = (previous?.eventSequence ?? 0) + 1; if (!Number.isSafeInteger(eventSequence)) return fail('sensory event sequence overflow');
      // Use the exact owned continuous crossing sample. Sampling the trajectory
      // at its rounded tick could inspect an instant after the executed cut.
      const sample = b.view.physicalCut.crossing, occluders = posture.sceneBodies.flatMap(body => {
        const player = b.actor.world.defenders.find(d => d.playerId === body.source.playerId)!;
        return body.actor.primitives.map(p => ({ center: { x: player.position.x + p.offset.x, y: body.actor.bodyOriginHeightMeters + p.offset.y, z: player.position.z + p.offset.z }, radiusMeters: p.radius }));
      });
      const seed = new SeedRoot(action.source.nominalPitch.delivery.matchSeed).streamSeed(b.actor.match.playId, 'perception', json(['owned_batting_observation_v1', posture.source.sourceId, pitch.source.sourceId, source.observedTick]));
      const result = calculateBattingObservation({ nominalValues: posture.model.observationCalibration.values, effectiveValues: c.response.values,
        input: { observedTick: source.observedTick, deliveryCutTick: source.deliveryCutTick, ticksPerSecond: g.ticksPerSecond, seed,
          observer: { position: g.eyePosition, forward: g.observerForward, velocity: { x: 0, y: 0, z: 0 } }, target: { position: sample.position, velocity: sample.velocity },
          occluders, attention: g.attention, lastObservedTick: previous?.lastCapturedTick ?? null } });
      if (!result.ok) return fail('sensory Core input differs: ' + result.reason.path);
      return freeze({ kind: 'batting_observation', source, lineage, physicalPitchSourceId: pitch.source.sourceId, modelReference: posture.source.modelReference, eventSequence,
        lastCapturedTick: result.value.sample?.observedAt ?? previous?.lastCapturedTick ?? null,
        physicalCutHash: hash({ physicalPitchReference: source.physicalPitchReference, observedTick: source.observedTick, deliveryCutTick: source.deliveryCutTick,
          scene: posture.sceneBodies.map(body => reference('world_player_body_materializations', body)) }), calculation: result.value });
    }
    if (source.capability === 'owned_batting_observation_delivery_v1') {
      const capture = linked('observation', source.observationReference) as DurableBattingObservation | null;
      if (!capture) return pending('original_capture_missing', [source.observationReference.sourceId]);
      assertSamePaOriginalMember(capture.source.member, source.member); same(capture.lineage, lineage);
      if (b.view.kind !== 'nonempty_basis_prepared') return fail('delivery requires a current nonempty view');
      same(capture.source.physicalPitchReference, b.view.physicalCut.pitchReference);
      const completion = readSamePaNextTakeActionFromSqlite(db, source.completionReference), posture = linked('posture', source.postureReference) as DurableBattingInvocationPosture | null;
      if (!posture) return pending('owned_delivery_posture_missing', [source.postureReference.sourceId]);
      if (posture.source.capability !== 'owned_next_take_batting_posture_v1') return fail('delivery requires its owned retained-body posture');
      same(completion.source.viewReference, source.viewReference); same(posture.source.viewReference, source.viewReference); same(posture.source.actionReference, source.completionReference);
      same(posture.source.member, source.member); same(posture.lineage, lineage);
      const at = completion.source.nominalPitch.delivery.readyAtUs, g = posture.source.geometry;
      if (g.startedAtTick !== completion.bodyCut.completedAtTick || at < b.view.evaluationTick || at < g.bodyReadyTick || at > g.validUntilTick) return pending('owned_retained_delivery_interval_unavailable');
      const calibration = (current ? readCurrentSamePaContinuationCalibrationFromSqlite : readSamePaContinuationCalibrationFromSqlite)(db, source.calibrationReference), c = calibration.source;
      if (c.route !== 'batter_observation' || c.response.kind !== 'accepted_execution_values_v1') return fail('delivery retention calibration route differs');
      same(c.viewReference, source.viewReference); same(c.member, source.member); same(c.nominalReference, capture.modelReference);
      const delivery = deriveBattingObservationDelivery(capture.calculation, capture.calculation.nominalValues.calibration.memoryDecayParameters,
        c.response.values.calibration.memoryDecayParameters, at);
      if (delivery.kind === 'pending') return pending(delivery.reason);
      return freeze({ kind: 'batting_observation_delivery', source, lineage, physicalPitchSourceId: capture.physicalPitchSourceId, physicalPitchReference: capture.source.physicalPitchReference,
        originalCaptureHash: hash(capture), eventSequence: capture.eventSequence, delivery, temporalCut: { kind: 'retained_stationary_delivery_cut_v1', fromTick: b.view.evaluationTick, throughTick: at, originalWorldHash: completion.bodyCut.originalWorldHash } });
    }
    if (source.capability === 'owned_batting_observed_prediction_v1') {
      const observation = linked('observation', source.observationReference) as DurableBattingObservation | null;
      if (!observation) return pending('original_observation_missing', [source.observationReference.sourceId]);
      assertSamePaOriginalMember(observation.source.member, source.member); same(observation.lineage, lineage); same(observation.modelReference, source.modelReference);
      if (b.view.kind !== 'nonempty_basis_prepared' || b.view.physicalCut.pitchReference.sourceId !== observation.physicalPitchSourceId) return fail('prediction current physical cut differs');
      const delivered = linked('delivery', source.deliveryReference) as DurableBattingObservationDelivery | null;
      if (!delivered) return pending('owned_observation_delivery_missing', [source.deliveryReference.sourceId]);
      same(delivered.source.observationReference, source.observationReference); same(delivered.originalCaptureHash, hash(observation));
      same(delivered.lineage, lineage); assertSamePaOriginalMember(delivered.source.member, source.member);
      const nominal = model(source, source.modelReference, current), parameter = nominal.predictionCalibration;
      same(source.predictionParameterReference, { sourceId: parameter.sourceId, sourceVersion: parameter.sourceVersion, sourceHash: hash(parameter) });
      const forecast = deriveDeliveredBattingObservedMotionForecast(observation.calculation, delivered.delivery, parameter.values, b.view.evaluationTick);
      if (forecast.kind === 'pending') return pending(forecast.reason);
      return freeze({ kind: 'batting_observed_prediction', source, lineage, physicalPitchSourceId: observation.physicalPitchSourceId, physicalPitchReference: observation.source.physicalPitchReference, forecast });
    }
    const prediction = linked('prediction', source.predictionReference) as DurableBattingObservedPrediction | null;
    if (!prediction) return pending('original_prediction_missing', [source.predictionReference.sourceId]);
    if (source.capability !== 'owned_batting_current_score_assessment_v1') return fail('archived empty-view score cannot become a current invocation input');
    assertBattingAssessmentOwnership(db, tables.assessment, source);
    assertCurrentBattingScoreAssessmentBasis(source, { predictionReference: reference('batting_prediction_v1_predictions', prediction), modelReference: prediction.source.modelReference,
      observationCutReference: prediction.source.observationReference, member: source.member, viewReference: source.viewReference });
    assertSamePaOriginalMember(prediction.source.member, source.member); same(prediction.lineage, lineage);
    return freeze({ kind: 'batting_score_assessment', source, lineage, physicalPitchSourceId: prediction.physicalPitchSourceId, prediction: { predictionId: prediction.source.sourceId, observedTick: prediction.forecast.observedTick,
      availableTick: prediction.forecast.availableTick, validUntilTick: prediction.forecast.validUntilTick, trajectory: prediction.forecast.trajectory, swingScore: source.score } });
  };
  function read(kind: Kind, id: string): RecordValue | null {
    const key = kind + ':' + id, cached = records.get(key); if (cached) return cached;
    if (active.has(key)) return fail('cyclic original dependency');
    const row = identityRow(db, kind, id); if (!row) return null;
    active.add(key); try {
      const source = battingPerceptionSourceInput(kind, JSON.parse(String(row.source_json)), id), value = derive(source, false);
      if (value.kind === 'pending') return fail('durable row lost original prerequisite');
      same(row, rowFor(value)); assertCanonical(db, kind, source);
      if (invocationKind(kind)) assertHead(kind, value);
      records.set(key, value); return value;
    } finally { active.delete(key); }
  }
  return { derive: (source: Source) => derive(source, fresh), read };
};

export const readBattingPerceptionFromSqlite = (db: DatabaseSync, kind: Kind, ref: SamePaReference): RecordValue => {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if (!(db instanceof Native) || !samePaReferenceValid(ref, tables[kind])) return fail('invalid Native reference');
  const value = assembly(db, false).read(kind, ref.sourceId); if (!value) return fail('original owner missing'); same(reference(tables[kind], value), ref); return value;
};

/** Metadata discovery only. Normal replay remains mandatory for every reached
 * row. Indexed and typed raw lineage claims both participate in the census. */
export const readBattingPerceptionInvocationClaims = (db: DatabaseSync, input: Readonly<{ enrollmentSourceId: string; physicalPitchSourceId: string }>) => {
  if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1 || !samePaText(input.enrollmentSourceId) || !samePaText(input.physicalPitchSourceId)) return fail('invalid invocation census');
  if (!storage(db)) return [];
  for (const row of db.prepare(`SELECT * FROM main.${heads} WHERE enrollment_source_id=? AND physical_pitch_source_id=?`).all(input.enrollmentSourceId, input.physicalPitchSourceId)) {
    if (row.owner !== tables.observation && row.owner !== tables.delivery && row.owner !== tables.prediction) return fail('unknown invocation head owner');
    assertWorkHead(db, String(row.owner), input.enrollmentSourceId, input.physicalPitchSourceId, String(row.player_id));
  }
  return (['observation', 'delivery', 'prediction'] as const).flatMap(kind => db.prepare(`SELECT * FROM main.${tables[kind]} WHERE
    (enrollment_source_id=$enrollment OR ${claim('snapshot_json', ['lineage', 'enrollmentReference', 'sourceId'], '$enrollment')})
    AND (physical_pitch_source_id=$pitch OR ${claim('source_json', ['physicalPitchReference', 'sourceId'], '$pitch')}
      OR ${claim('snapshot_json', ['physicalPitchSourceId'], '$pitch')} OR ${claim('snapshot_json', ['source', 'physicalPitchReference', 'sourceId'], '$pitch')})`)
    .all({ enrollment: input.enrollmentSourceId, pitch: input.physicalPitchSourceId }).map(row => {
      const source = battingPerceptionSourceInput(kind, JSON.parse(String(row.source_json)), String(row.source_id));
      assertWorkHead(db, tables[kind], input.enrollmentSourceId, input.physicalPitchSourceId, source.member.playerId);
      return freeze({ reference: { owner: tables[kind], sourceId: String(row.source_id), sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) },
        executionViewReference: source.viewReference, member: source.member, physicalPitchSourceId: String(row.physical_pitch_source_id) });
    }));
};
export const openSqliteBattingPerceptionStore = (path: string, authority?: Readonly<{ readAcceptedPosture?(id: string): unknown; readAcceptedObservation?(id: string): unknown;
  readAcceptedDelivery?(id: string): unknown; readAcceptedPrediction?(id: string): unknown; readAcceptedAssessment?(id: string): unknown }>) => {
  if (!samePaText(path) || authority && Object.values(authority).some(fn => typeof fn !== 'function')) return fail('invalid owner input');
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync, db = new Native(path), tx = battingInvocationTransaction(db, () => storage(db));
  const accept = (kind: Kind, id: string): RecordValue | Pending => {
    if (!samePaText(id)) return fail('invalid Source identity');
    return tx.run(true, (proof, step) => {
      const prepared = proof(() => {
        const owner = assembly(db, false), existing = owner.read(kind, id), callbacks = { posture: authority?.readAcceptedPosture, observation: authority?.readAcceptedObservation, delivery: authority?.readAcceptedDelivery,
          prediction: authority?.readAcceptedPrediction, assessment: authority?.readAcceptedAssessment }, raw = callbacks[kind]?.(id), source = raw == null ? null : battingPerceptionSourceInput(kind, raw, id);
        if (existing) { if (source) same(existing.source, source); return { value: existing, existing: true }; }
        if (!source) return { value: pending('accepted_source_missing', [id]), existing: false };
        assertCanonical(db, kind, source); return { value: assembly(db, true).derive(source), existing: false };
      });
      const value = prepared.value; if (prepared.existing || value.kind === 'pending') return value;
      if (!proof(() => storage(db))) step(() => db.exec(Object.values(schema).join(';')), 0, names.length + 1);
      proof(() => { assertCanonical(db, kind, value.source); same(assembly(db, true).derive(value.source), value); if (identityRow(db, kind, id)) fail('unexpected owner appeared'); });
      const scope = [tables[kind], value.lineage.enrollmentReference.sourceId, value.physicalPitchSourceId, value.source.member.playerId] as const;
      const beforeHead = invocationKind(kind) ? proof(() => { assertWorkHead(db, ...scope); return workHead(db, ...scope); }) : null;
      const row = rowFor(value); step(() => { const result = db.prepare(`INSERT INTO main.${tables[kind]}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row)); if (result.changes !== 1) fail('write differs'); }, 1);
      if (invocationKind(kind)) {
        const next = proof(() => {
          // Closed intermediate row/head state, with exact counters and owned
          // transaction identity checked by the surrounding proof. Full normal
          // replay follows immediately once both linked rows exist.
          same(identityRow(db, kind, id), row); same(workHead(db, ...scope), beforeHead);
          const rows = workScopeRows(db, ...scope), next = expectedWorkHead(...scope, rows);
          if (!next || next.last_source_id !== id || next.revision !== Number(beforeHead?.revision ?? 0) + 1) return fail('staged invocation order differs');
          same(expectedWorkHead(...scope, rows.slice(0, -1)), beforeHead); return next;
        });
        step(() => {
          const result = beforeHead === null ? db.prepare(`INSERT INTO main.${heads}(${Object.keys(next).join(',')}) VALUES(${Object.keys(next).map(() => '?').join(',')})`).run(...Object.values(next))
            : db.prepare(`UPDATE main.${heads} SET revision=?,last_source_id=?,last_snapshot_hash=? WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=? AND revision=? AND first_source_id=? AND last_source_id=? AND last_snapshot_hash=?`)
              .run(next.revision, next.last_source_id, next.last_snapshot_hash, ...scope, beforeHead.revision, beforeHead.first_source_id, beforeHead.last_source_id, beforeHead.last_snapshot_hash);
          if (result.changes !== 1) fail('invocation head CAS differs');
        }, 1);
      }
      proof(() => same(assembly(db, false).read(kind, id), value)); return value;
    }, value => { const saved = assembly(db, false).read(kind, id); if (value.kind === 'pending') { if (saved) fail('pending operation acquired a durable claim'); } else same(saved, value); });
  };
  const read = (kind: Kind, id: string) => { if (!samePaText(id)) return fail('invalid Source identity'); return tx.run(false, proof => proof(() => assembly(db, false).read(kind, id)), value => same(assembly(db, false).read(kind, id), value)); };
  return Object.freeze({ acceptPosture: (id: string) => accept('posture', id), acceptObservation: (id: string) => accept('observation', id),
    acceptDelivery: (id: string) => accept('delivery', id), readDelivery: (id: string) => read('delivery', id),
    acceptPrediction: (id: string) => accept('prediction', id), acceptAssessment: (id: string) => accept('assessment', id),
    readPosture: (id: string) => read('posture', id), readObservation: (id: string) => read('observation', id), readPrediction: (id: string) => read('prediction', id),
    readAssessment: (id: string) => read('assessment', id), close: tx.close });
};
