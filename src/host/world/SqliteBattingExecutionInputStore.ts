import { assertInFlightBattingWriteCurrentFromSqlite } from './InFlightBattingLifecycleFenceFromSqlite';
import { deriveInFlightSamePaBattingIntent, deriveInFlightSamePaBattingInput } from './InFlightBattingExecutionInputFromSqlite';
import type { DurableSamePaBattingIntent } from './NativeBattingExecutionInput';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { calculateBattingExecution, prepareBattingExecution } from '../../core/world/psychology/batting/BattingCommitment';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText, samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaExecutionReference as reference, proveSamePaExecution } from './SamePlateAppearanceExecutionFromSqlite';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { assertFreshPaDispatchEnrollment } from './SamePlateAppearanceDispatchClaimGuard';
import { assertSamePaOriginalMember } from './SamePlateAppearanceInvocationView';
import { originalBattingIntentInput } from './OriginalBattingIntent';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { readBattingEmotionExecutionFromSqlite, readCurrentBattingEmotionExecutionFromSqlite } from './SqliteBattingEmotionExecutionStore';
import { readHistoricalSamePaContinuationViewFromSqlite, readCurrentSamePaContinuationViewFromSqlite,
  readSamePaContinuationCalibrationFromSqlite, readCurrentSamePaContinuationCalibrationFromSqlite, readSamePaContinuationRecordFromSqlite } from './SamePlateAppearanceContinuationFromSqlite';
import { readSamePaExecutedPitchFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { readEmotionWorldRevisionFromSqlite, readHistoricalEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { readCurrentSamePaBattingKnowledgeFromSqlite } from './SamePlateAppearanceBattingKnowledgeFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { battingExecutionInputSource, type BattingExecutionInputSource as Source, type BattingExecutionInputRecord as RecordValue,
  type DurableSamePaBattingExecutionInput, type DurableSamePaBattingInvocation } from './NativeBattingExecutionInput';

type Kind = 'intent' | 'input' | 'invocation';
const tables = { intent: 'batting_execution_v1_intents', input: 'batting_execution_v1_inputs', invocation: 'batting_execution_v1_executions' } as const;
const heads = 'batting_execution_v1_heads', names = Object.values(tables);
const schemas = Object.fromEntries(names.map(name => [name, `CREATE TABLE ${name}(source_id TEXT PRIMARY KEY,enrollment_source_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,view_source_id TEXT NOT NULL,player_id TEXT NOT NULL,canonical_key TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`]));
schemas[heads] = `CREATE TABLE ${heads}(enrollment_source_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=1),first_source_id TEXT NOT NULL,last_source_id TEXT NOT NULL,last_snapshot_hash TEXT NOT NULL,PRIMARY KEY(enrollment_source_id,physical_pitch_source_id,player_id))`;
type Pending = Readonly<{ kind: 'pending'; reason: string; missingSourceIds: readonly string[] }>;
const pending = (reason: string, missingSourceIds: readonly string[] = []): Pending => freeze({ kind: 'pending', reason, missingSourceIds });
const fail = (detail: string): never => { throw new Error('owned batting calculation ' + detail); };
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) fail('original input or durable row differs'); };
const kindOf = (s: Source): Kind => s.capability === 'owned_same_pa_batting_intent_v1' || s.capability === 'owned_in_flight_same_pa_batting_intent_v1' ? 'intent' : s.capability === 'owned_same_pa_batting_execution_input_v1' || s.capability === 'owned_in_flight_same_pa_batting_execution_input_v1' ? 'input' : 'invocation';
const canonical = (s: Source) => s.capability === 'owned_same_pa_batting_intent_v1' || s.capability === 'owned_in_flight_same_pa_batting_intent_v1' ? json([s.postureReference, s.actorReference])
  : s.capability === 'owned_same_pa_batting_execution_input_v1' || s.capability === 'owned_in_flight_same_pa_batting_execution_input_v1' ? json([s.viewReference, s.member, s.postureReference, s.emotionReference, s.assessmentReferences, s.calibrationReferences, s.expectedWorld])
    : json(s.inputReference);
const storage = (db: DatabaseSync): boolean => {
  assertBodyCompositionNativeConnection(db);
  const rows = db.prepare("SELECT * FROM main.sqlite_master WHERE lower(name) GLOB 'batting_execution_v1_*' OR lower(tbl_name) GLOB 'batting_execution_v1_*'").all();
  if (!rows.length) return false; if (rows.length !== names.length * 3 + 2) return fail('namespace is partial or malformed');
  for (const name of [...names, heads]) {
    const row = rows.find(r => r.name === name); if (!row || row.type !== 'table' || row.tbl_name !== name || row.sql !== schemas[name]) return fail('schema differs');
    const keys = name === heads ? [['enrollment_source_id', 'physical_pitch_source_id', 'player_id']] : [['source_id'], ['canonical_key']];
    const indexes = db.prepare(`PRAGMA main.index_list(${name})`).all(); if (indexes.length !== keys.length) return fail('index extent differs');
    keys.forEach((columns, i) => {
      const n = `sqlite_autoindex_${name}_${i + 1}`, index = indexes.find(r => r.name === n), row = rows.find(r => r.name === n);
      if (!index || !row || index.unique !== 1 || index.partial !== 0 || index.origin !== (i === 0 ? 'pk' : 'u') || row.type !== 'index' || row.tbl_name !== name || row.sql !== null) return fail('index identity differs');
      const info = db.prepare(`PRAGMA main.index_xinfo(${n})`).all(); same(info.filter(r => r.key === 1).map(r => r.name), columns);
      if (info.length !== columns.length + 1 || info.some(r => r.coll !== 'BINARY' || r.desc !== 0) || info.at(-1)?.cid !== -1) return fail('index shape differs');
    });
  }
  return true;
};
const rowFor = (v: RecordValue) => ({ source_id: v.source.sourceId, enrollment_source_id: v.lineage.enrollmentReference.sourceId, physical_pitch_source_id: v.physicalPitchSourceId,
  view_source_id: v.source.viewReference.sourceId, player_id: v.source.member.playerId, canonical_key: canonical(v.source), source_json: json(v.source), source_hash: hash(v.source), snapshot_json: json(v), snapshot_hash: hash(v) });
const identityRow = (db: DatabaseSync, kind: Kind, id: string) => {
  if (!storage(db)) return null;
  const claims = names.flatMap(table => db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id }).map(row => ({ table, row })));
  if (claims.length > 1 || claims.length === 1 && (claims[0].table !== tables[kind] || claims[0].row.source_id !== id)) return fail('raw Source identity differs');
  if (!claims.length) {
    if (kind === 'invocation' && db.prepare(`SELECT 1 FROM main.${heads} WHERE first_source_id=? OR last_source_id=?`).get(id, id)) return fail('missing invocation has surviving head claim');
    const dependency = kind === 'intent' ? 'intentReference' : kind === 'input' ? 'inputReference' : null;
    if (dependency && names.some(table => db.prepare(`SELECT 1 FROM main.${table} WHERE ${claim('source_json', [dependency, 'sourceId'], '$id')} OR ${claim('snapshot_json', ['source', dependency, 'sourceId'], '$id')}`).get({ id }))) return fail('missing original input has surviving typed claim');
  }
  return claims[0]?.row ?? null;
};
const ids = (v: RecordValue) => [v.lineage.enrollmentReference.sourceId, v.physicalPitchSourceId, v.source.member.playerId] as const;
const head = (db: DatabaseSync, key: readonly [string, string, string]) => !storage(db) ? null : db.prepare(`SELECT * FROM main.${heads} WHERE enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?`).get(...key) ?? null;
const workRows = (db: DatabaseSync, key: readonly [string, string, string]) => db.prepare(`SELECT rowid AS owned_rowid,* FROM main.${tables.invocation} WHERE
  (enrollment_source_id=$enrollment OR ${claim('snapshot_json', ['lineage', 'enrollmentReference', 'sourceId'], '$enrollment')})
  AND (physical_pitch_source_id=$pitch OR ${claim('snapshot_json', ['physicalPitchSourceId'], '$pitch')})
  AND (player_id=$player OR ${claim('source_json', ['member', 'playerId'], '$player')}) ORDER BY rowid`).all({ enrollment: key[0], pitch: key[1], player: key[2] });
const expectedHead = (key: readonly [string, string, string], rows: ReturnType<typeof workRows>) => rows.length === 0 ? null : ({ enrollment_source_id: key[0], physical_pitch_source_id: key[1], player_id: key[2],
  revision: rows.length, first_source_id: rows[0].source_id, last_source_id: rows.at(-1)!.source_id, last_snapshot_hash: rows.at(-1)!.snapshot_hash });
const assertHead = (db: DatabaseSync, key: readonly [string, string, string]) => { const rows = workRows(db, key);
  if (rows.some(r => r.enrollment_source_id !== key[0] || r.physical_pitch_source_id !== key[1] || r.player_id !== key[2])) return fail('invocation raw scope differs'); same(head(db, key), expectedHead(key, rows)); };
const assertCanonical = (db: DatabaseSync, kind: Kind, source: Source) => {
  if (!storage(db)) return;
  const rows = db.prepare(`SELECT * FROM main.${tables[kind]} WHERE canonical_key=$key OR (view_source_id=$view AND player_id=$player)
    OR (${claim('source_json', ['viewReference', 'sourceId'], '$view')} AND ${claim('source_json', ['member', 'playerId'], '$player')})`)
    .all({ key: canonical(source), view: source.viewReference.sourceId, player: source.member.playerId });
  for (const row of rows) { const s = battingExecutionInputSource(JSON.parse(String(row.source_json)), String(row.source_id));
    if (kindOf(s) !== kind || row.canonical_key !== canonical(s)) return fail('canonical index differs');
    if (canonical(s) === canonical(source) && s.sourceId !== source.sourceId) return fail('canonical meaning belongs to another Source'); }
};
const assembly = (db: DatabaseSync) => {
  if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) return fail('requires a private read-only proof');
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if (!(db instanceof Native)) return fail('requires a Native connection');
  const active = new Set<string>(), cache = new Map<string, RecordValue>();
  const linked = (kind: Kind, ref: SamePaReference) => { if (!samePaReferenceValid(ref, tables[kind])) return fail('reference owner differs');
    const value = read(kind, ref.sourceId); if (value) same(reference(tables[kind], value), ref); return value; };
  const derive = (source: Source, current: boolean): RecordValue | Pending => {
    if (source.capability === 'owned_in_flight_same_pa_batting_intent_v1') return deriveInFlightSamePaBattingIntent(db, source, current);
    if (source.capability === 'owned_in_flight_same_pa_batting_execution_input_v1') return deriveInFlightSamePaBattingInput(db, source, current, pin => {
      const value = linked('intent', pin); if (value !== null && value.kind !== 'same_pa_batting_intent') return fail('original intent owner differs'); return value;
    });
    if (source.capability === 'owned_same_pa_batting_intent_v1') {
      const posture = readBattingPerceptionFromSqlite(db, 'posture', source.postureReference); if (posture.kind !== 'batting_invocation_posture') return fail('original posture owner differs');
      same(posture.source.viewReference, source.viewReference); same(posture.source.member, source.member); same(posture.lineage.actorReference, source.actorReference);
      if (current) { proveSamePaExecution(db, { kind: 'view', sourceId: source.viewReference.sourceId }); assertFreshPaDispatchEnrollment(db, posture.lineage.enrollmentReference.sourceId); }
      return freeze({ kind: 'same_pa_batting_intent', source, lineage: posture.lineage, physicalPitchSourceId: posture.physicalPitchSourceId,
        originalIntent: originalBattingIntentInput({ version: 'original_batting_intent_v1', actorSourceId: source.actorReference.sourceId, attempt: source.attempt }) });
    }
    const b = (current ? readCurrentSamePaContinuationViewFromSqlite : readHistoricalSamePaContinuationViewFromSqlite)(db, source.viewReference);
    const member = b.members.find(m => m.playerId === source.member.playerId); if (!member || b.actor.binding.playerId !== member.playerId) return fail('actual batting participant missing'); same(member, source.member);
    if (source.capability === 'owned_same_pa_batting_calculation_v1') {
      const input = linked('input', source.inputReference); if (!input) return pending('original_batting_input_missing', [source.inputReference.sourceId]);
      if (input.kind !== 'same_pa_batting_input' || input.source.capability !== 'owned_same_pa_batting_execution_input_v1'
        || input.physicalPitchReference.owner !== 'pa_dispatch_v1_pitch_actions') return fail('original execution input owner differs'); same(input.source.viewReference, source.viewReference); same(input.source.member, source.member);
      if (current) same(derive(input.source, true), input);
      const result = calculateBattingExecution({ nominalRequest: input.nominalRequest, effectiveValues: input.effectiveValues });
      if (!result.ok) return fail('effective Core calculation rejected: ' + result.reason.path);
      return freeze({ kind: 'same_pa_batting_calculation', source, lineage: b.view.lineage, physicalPitchSourceId: input.physicalPitchSourceId, physicalPitchReference: { ...input.physicalPitchReference, owner: input.physicalPitchReference.owner },
        calculation: result.value, invokedRoutes: result.value.commitment?.action === 'SWING' ? ['batter_decision', 'batter_motor', 'batter_swing'] as const : ['batter_decision'] as const,
        motionIssued: false, physicalEffect: 'none', physicalAdmission: 'completed_take_requires_forward_physical_right' });
    }
    const posture = readBattingPerceptionFromSqlite(db, 'posture', source.postureReference);
    if (posture.kind !== 'batting_invocation_posture') return fail('original posture missing'); assertSamePaOriginalMember(posture.source.member, source.member); same(posture.lineage, b.view.lineage);
    const emotion = (current ? readCurrentBattingEmotionExecutionFromSqlite : readBattingEmotionExecutionFromSqlite)(db, source.emotionReference);
    assertSamePaOriginalMember(emotion.source.member, source.member); same(emotion.lineage, b.view.lineage); same(emotion.physicalPitchReference, b.view.physicalCut.pitchReference);
    if (source.intentReference !== null) { const intent = linked('intent', source.intentReference); if (!intent) return pending('original_batting_intent_missing', [source.intentReference.sourceId]);
      if (intent.kind !== 'same_pa_batting_intent') return fail('original intent owner differs'); same(intent.source.postureReference, source.postureReference); assertSamePaOriginalMember(intent.source.member, source.member); }
    const world = current ? readEmotionWorldRevisionFromSqlite(db, b.view.lineage.careerId) : readHistoricalEmotionWorldRevisionFromSqlite(db, b.view.lineage.careerId, source.expectedWorld.worldRevision);
    if (!world) return pending('actual_world_control_head_missing');
    same(source.expectedWorld, { careerId: b.view.lineage.careerId, worldRevision: world.head.worldRevision, controlRevision: world.head.control.revision, controlHash: hash(world.head.control) });
    const { pitch } = readSamePaExecutedPitchFromSqlite(db, b.view.physicalCut.pitchReference), timeline = pitch.result.resolution.timeline;
    if (timeline.status.kind !== 'active') return pending('plate_appearance_terminal');
    if (posture.physicalPitchSourceId !== pitch.source.sourceId || b.view.evaluationTick > posture.source.geometry.validUntilTick) return pending('owned_current_batting_posture_unavailable');
    const predictions = source.assessmentReferences.map(ref => {
      const value = readBattingPerceptionFromSqlite(db, 'assessment', ref); if (value.kind !== 'batting_score_assessment') return fail('original score owner differs');
      assertSamePaOriginalMember(value.source.member, source.member); same(value.lineage, b.view.lineage); same(value.source.modelReference, posture.source.modelReference);
      if (value.physicalPitchSourceId !== pitch.source.sourceId || value.prediction.availableTick > b.view.evaluationTick) return fail('unavailable or foreign forecast'); return value.prediction;
    });
    if (current) same(readCurrentSamePaBattingKnowledgeFromSqlite(db, source.viewReference).map(v => v.reference), source.assessmentReferences);
    const calibrations = source.calibrationReferences.map(r => (current ? readCurrentSamePaContinuationCalibrationFromSqlite : readSamePaContinuationCalibrationFromSqlite)(db, r.calibrationReference));
    calibrations.forEach((calibration, i) => { const s = calibration.source; same(s.viewReference, source.viewReference); same(s.member, source.member); same(s.nominalReference, posture.source.modelReference);
      if (s.route !== source.calibrationReferences[i].route) return fail('calibration route differs'); });
    const decision = calibrations[0].source, motor = calibrations[1].source, swing = calibrations[2].source;
    if (decision.route !== 'batter_decision' || motor.route !== 'batter_motor' || swing.route !== 'batter_swing'
      || decision.response.kind !== 'accepted_execution_values_v1' || motor.response.kind !== 'accepted_execution_values_v1' || swing.response.kind !== 'accepted_execution_values_v1') return fail('effective batting domain differs');
    const nominal = posture.model, g = posture.source.geometry;
    const prefix = readSamePaContinuationRecordFromSqlite(db, 'prefix', b.view.source.prefixReference.sourceId);
    if (!prefix || prefix.kind !== 'nonempty_prefix') return fail('owned invocation prefix missing');
    const frame = { ...emotion.acceptance.expectedFrame, snapshotId: 'owned-batting-input:' + hash([source, world]), worldRevision: world.head.worldRevision,
      time: { tick: b.view.evaluationTick, sequence: prefix.source.operationReferences.length } };
    const batting = { sourceId: source.sourceId, revision: 0, frame, validUntilTick: g.validUntilTick, ballId: 'pitch:' + pitch.source.sourceId,
      playId: b.actor.match.playId, pitchOrdinal: pitch.progressRevision, ticksPerSecond: g.ticksPerSecond, count: timeline.status.count, timelineNextSequence: timeline.nextSequence,
      bodyReadyTick: g.bodyReadyTick, latestMotorStartTick: g.latestMotorStartTick, ...nominal.capability.values, handedness: g.handedness, centerOfMass: g.centerOfMass,
      ...nominal.equipment.values, plateZ: g.plateZ, strikeZone: g.strikeZone, ...nominal.repertoire.values, directive: source.directive, decisionModel: nominal.decisionModel.values, predictions };
    const nominalRequest = { currentFrame: frame, currentEmotion: emotion.acceptance.proposal.appraisal.state, acceptedExecution: emotion.acceptance, source: batting };
    const checked = prepareBattingExecution(nominalRequest); if (!checked.ok) return fail('original Core request rejected: ' + checked.reason.path);
    return freeze({ kind: 'same_pa_batting_input', source, lineage: b.view.lineage, physicalPitchSourceId: pitch.source.sourceId,
      physicalPitchReference: b.view.physicalCut.pitchReference, nominalRequest: checked.value.request,
      effectiveValues: { decision: decision.response.values, motor: motor.response.values, repertoire: swing.response.values } });
  };
  const read = (kind: Kind, id: string): RecordValue | null => {
    const key = kind + ':' + id, saved = cache.get(key); if (saved) return saved; if (active.has(key)) return fail('cyclic original input');
    const row = identityRow(db, kind, id); if (!row) return null; active.add(key);
    try { const source = battingExecutionInputSource(JSON.parse(String(row.source_json)), id); if (kindOf(source) !== kind) return fail('stored owner differs');
      const value = derive(source, false); if (value.kind === 'pending') return fail('accepted input lost original prerequisite'); same(row, rowFor(value)); assertCanonical(db, kind, source);
      if (kind === 'invocation') assertHead(db, ids(value)); cache.set(key, value); return value;
    } finally { active.delete(key); }
  };
  return { read, derive };
};
const readInput = (db: DatabaseSync, ref: SamePaReference<'batting_execution_v1_inputs'>, current: boolean): DurableSamePaBattingExecutionInput => {
  if (!samePaReferenceValid(ref, tables.input)) return fail('invalid input reference'); const owner = assembly(db), value = owner.read('input', ref.sourceId);
  if (!value || value.kind !== 'same_pa_batting_input') return fail('original input missing'); same(reference(tables.input, value), ref); if (current) same(owner.derive(value.source, true), value); return value;
};
export const readSamePaBattingIntentFromSqlite = (db: DatabaseSync, ref: SamePaReference<'batting_execution_v1_intents'>): DurableSamePaBattingIntent => {
  if (!samePaReferenceValid(ref, tables.intent)) return fail('invalid intent reference');
  const value = assembly(db).read('intent', ref.sourceId); if (!value || value.kind !== 'same_pa_batting_intent') return fail('original intent missing');
  same(reference(tables.intent, value), ref); return value;
};
export const readSamePaBattingExecutionInputFromSqlite = (db: DatabaseSync, ref: SamePaReference<'batting_execution_v1_inputs'>) => readInput(db, ref, false);
export const readCurrentSamePaBattingExecutionInputFromSqlite = (db: DatabaseSync, ref: SamePaReference<'batting_execution_v1_inputs'>) => readInput(db, ref, true);
/** Internal Native numerical adapter. Exact accepted input owns the original
 * request and each effective parameter reference. This is read-only and never
 * issues motion, consumes a right, or relabels a completed TAKE as a swing. */
export const calculateCurrentSamePaBattingFromSqlite = (db: DatabaseSync, ref: SamePaReference<'batting_execution_v1_inputs'>) => {
  const input = readCurrentSamePaBattingExecutionInputFromSqlite(db, ref);
  const result = calculateBattingExecution({ nominalRequest: input.nominalRequest, effectiveValues: input.effectiveValues });
  if (!result.ok) return fail('effective Core calculation rejected: ' + result.reason.path);
  return freeze({ input, calculation: result.value, motionIssued: false as const });
};
export const readSamePaBattingCalculationFromSqlite = (db: DatabaseSync, ref: SamePaReference<'batting_execution_v1_executions'>): DurableSamePaBattingInvocation => {
  if (!samePaReferenceValid(ref, tables.invocation)) return fail('invalid calculation reference'); const value = assembly(db).read('invocation', ref.sourceId);
  if (!value || value.kind !== 'same_pa_batting_calculation') return fail('original invocation missing'); same(reference(tables.invocation, value), ref); return value;
};
export const readSamePaBattingCalculationClaims = (db: DatabaseSync, input: Readonly<{ enrollmentSourceId: string; physicalPitchSourceId: string }>) => {
  if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) return fail('invalid claim proof'); if (!storage(db)) return [];
  const hs = db.prepare(`SELECT * FROM main.${heads} WHERE enrollment_source_id=? AND physical_pitch_source_id=?`).all(input.enrollmentSourceId, input.physicalPitchSourceId);
  for (const h of hs) assertHead(db, [input.enrollmentSourceId, input.physicalPitchSourceId, String(h.player_id)]);
  return db.prepare(`SELECT * FROM main.${tables.invocation} WHERE (enrollment_source_id=$enrollment OR ${claim('snapshot_json', ['lineage', 'enrollmentReference', 'sourceId'], '$enrollment')})
    AND (physical_pitch_source_id=$pitch OR ${claim('snapshot_json', ['physicalPitchSourceId'], '$pitch')})`).all({ enrollment: input.enrollmentSourceId, pitch: input.physicalPitchSourceId }).map(row => {
      assertHead(db, [input.enrollmentSourceId, input.physicalPitchSourceId, String(row.player_id)]);
      return { owner: tables.invocation, sourceId: String(row.source_id), sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
    });
};
export const openSqliteBattingExecutionInputStore = (path: string, authority?: Readonly<{ readAcceptedIntent?(id: string): unknown; readAcceptedInput?(id: string): unknown; readAcceptedInvocation?(id: string): unknown }>) => {
  if (!samePaText(path) || authority && Object.values(authority).some(fn => typeof fn !== 'function')) return fail('invalid owner input');
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync, db = new Native(path), tx = battingInvocationTransaction(db, () => storage(db));
  const accept = (kind: Kind, id: string): RecordValue | Pending => {
    if (!samePaText(id)) return fail('invalid Source identity');
    let fresh = false;
    const fence = (value: RecordValue) => {
      if (!fresh || value.source.capability !== 'owned_in_flight_same_pa_batting_intent_v1'
        && value.source.capability !== 'owned_in_flight_same_pa_batting_execution_input_v1') return;
      assertInFlightBattingWriteCurrentFromSqlite(db, value.source.viewReference, null);
      if (value.source.capability === 'owned_in_flight_same_pa_batting_execution_input_v1') {
        const world = readEmotionWorldRevisionFromSqlite(db, value.lineage.careerId);
        if (!world) return fail('in-flight input World head missing');
        same(value.source.expectedWorld, { careerId: value.lineage.careerId, worldRevision: world.head.worldRevision,
          controlRevision: world.head.control.revision, controlHash: hash(world.head.control) });
      }
    };
    return tx.run(true, (proof, step) => {
      const prepared = proof(() => { const existing = assembly(db).read(kind, id), callbacks = { intent: authority?.readAcceptedIntent, input: authority?.readAcceptedInput, invocation: authority?.readAcceptedInvocation }, raw = callbacks[kind]?.(id);
        const source = raw == null ? null : battingExecutionInputSource(raw, id); if (source && kindOf(source) !== kind) return fail('accepted Source owner differs');
        if (existing) { if (source) same(existing.source, source); return { value: existing, existing: true }; }
        if (!source) return { value: pending('accepted_source_missing', [id]), existing: false }; assertCanonical(db, kind, source); return { value: assembly(db).derive(source, true), existing: false }; });
      const value = prepared.value; if (prepared.existing || value.kind === 'pending') return value; fresh = true;
      if (!proof(() => storage(db))) step(() => db.exec(Object.values(schemas).join(';')), 0, 4);
      const beforeHead = proof(() => { assertCanonical(db, kind, value.source); same(assembly(db).derive(value.source, true), value); if (identityRow(db, kind, id)) return fail('unexpected Source appeared');
        if (kind !== 'invocation') return null; assertHead(db, ids(value)); return head(db, ids(value)); });
      const row = rowFor(value); step(() => { const changed = db.prepare(`INSERT INTO main.${tables[kind]}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row)); if (changed.changes !== 1) fail('write differs'); }, 1);
      if (kind === 'invocation') {
        const next = proof(() => { same(identityRow(db, kind, id), row); same(head(db, ids(value)), beforeHead);
          const rows = workRows(db, ids(value)); if (rows.at(-1)?.source_id !== id || rows.length !== Number(beforeHead?.revision ?? 0) + 1) return fail('staged invocation extent differs');
          same(expectedHead(ids(value), rows.slice(0, -1)), beforeHead); return expectedHead(ids(value), rows)!; });
        step(() => { const result = beforeHead === null ? db.prepare(`INSERT INTO main.${heads}(${Object.keys(next).join(',')}) VALUES(${Object.keys(next).map(() => '?').join(',')})`).run(...Object.values(next))
          : db.prepare(`UPDATE main.${heads} SET revision=?,last_source_id=?,last_snapshot_hash=? WHERE enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=? AND revision=? AND last_source_id=? AND last_snapshot_hash=?`)
            .run(next.revision, next.last_source_id, next.last_snapshot_hash, ...ids(value), beforeHead.revision, beforeHead.last_source_id, beforeHead.last_snapshot_hash);
          if (result.changes !== 1) fail('invocation head CAS differs'); }, 1);
      }
      proof(() => { same(assembly(db).read(kind, id), value); fence(value); }); return value;
    }, value => { const saved = assembly(db).read(kind, id); if (value.kind === 'pending') { if (saved) fail('pending Source acquired a durable row'); } else { same(saved, value); fence(value); } });
  };
  const read = (kind: Kind, id: string) => { if (!samePaText(id)) return fail('invalid Source identity'); return tx.run(false, proof => proof(() => assembly(db).read(kind, id)), value => same(assembly(db).read(kind, id), value)); };
  return Object.freeze({ acceptIntent: (id: string) => accept('intent', id), acceptInput: (id: string) => accept('input', id), invoke: (id: string) => accept('invocation', id),
    readIntent: (id: string) => read('intent', id), readInput: (id: string) => read('input', id), readInvocation: (id: string) => read('invocation', id), close: tx.close });
};
