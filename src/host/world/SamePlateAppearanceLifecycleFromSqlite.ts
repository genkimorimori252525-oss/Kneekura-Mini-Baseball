import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { advancePlayerWorkloadRecovery, type PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import { advancePlateAppearancePitchSequenceToMatchState } from '../../core/sim/plateAppearance/PlateAppearanceSequenceCoordinator';
import { actorJson as json, actorHash as hash, actorFreeze as freeze, assertPhysicalActorOpenFrame } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaReferenceValid, samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { readHistoricalSamePaContinuationViewFromSqlite, readSamePaContinuationRecordFromSqlite, withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { readSamePaSuccessorTakePitchFromSqlite } from './SamePlateAppearanceTakeSuccessorFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { samePaPhysicalOperationOwners, type SamePaPhysicalOperationReference } from './SamePlateAppearancePhysicalEpisode';
import { readSamePaBattingInvocationFromSqlite, readSamePaBattingInvocationClaims, type SamePaBattingInvocationReference } from './SamePlateAppearanceBattingInvocationFromSqlite';
import { readSamePaContinuationClaimRows } from './SamePlateAppearanceContinuationClaimGuard';
import { battingAssessmentOwners } from './BattingAssessmentOwnership';
import { assertSamePaLifecycleStorage } from './SamePlateAppearanceLifecycleStorage';
import { deriveSamePaLifecycleCalibration, type SamePaLifecycleCalibration } from './SamePlateAppearanceLifecycleCalibration';
import { readSamePaLifecycleOutcomeFromSqlite, readSamePaLifecycleResetFromSqlite } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
import { samePaStartingBaseCenters } from './SamePlateAppearanceLifecycleStartingGeometry';
import { samePaLifecycleTables as tables, samePaLifecycleSourceInput as input, samePaLifecycleWorkOwners,
  type SamePaLifecycleSource, type SamePaLifecycleRecord, type SamePaLifecyclePrefix, type SamePaLifecycleTotal,
  type SamePaLifecycleView, type SamePaLifecycleViewBasis, type SamePaLifecycleCut, type SamePaLifecycleNextPitchBasis,
  type AcceptedSamePaLifecyclePrefix, type SamePaLifecycleWorkReference } from './SamePlateAppearanceLifecycle';
export type SamePaLifecycleKind = 'prefix' | 'total' | 'view' | 'calibration';
export const samePaLifecycleKind = (s: SamePaLifecycleSource): SamePaLifecycleKind => s.capability === 'same_pa_lifecycle_prefix_v1' ? 'prefix'
  : s.capability === 'same_pa_lifecycle_cumulative_total_v1' ? 'total' : s.capability === 'same_pa_lifecycle_execution_calibration_v1' ? 'calibration' : 'view';
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA lifecycle original ownership or complete coverage differs'); };
const workOwners = new Set<string>(samePaLifecycleWorkOwners);
export const samePaLifecycleRow = (v: SamePaLifecycleRecord): Record<string, string | number> => {
  const s = v.source, l = v.lineage;
  const extra: Record<string, string | number> = v.kind === 'same_pa_lifecycle_prefix'
    ? { anchor_view_source_id: v.source.anchorViewReference.sourceId, event_set_hash: hash(v.source.eventReferences), coverage_hash: v.coverageHash }
    : v.kind === 'same_pa_lifecycle_total' ? { prefix_source_id: v.source.prefixReference.sourceId, player_id: v.source.participantReference.playerId, baseline_source_id: v.source.participantReference.baselineSourceId }
    : v.kind === 'same_pa_lifecycle_view' ? { prefix_source_id: v.source.prefixReference.sourceId, assessment_set_hash: v.assessmentSetHash }
    : { view_source_id: v.source.viewReference.sourceId, player_id: v.source.member.playerId, route: v.source.route, nominal_parameter_identity: json(v.source.nominalParameterReference ?? v.source.nominalReference) };
  return { source_id: s.sourceId, source_version: s.sourceVersion, career_id: l.careerId, game_id: l.gameId, play_id: l.playId,
    enrollment_source_id: l.enrollmentReference.sourceId, actor_source_id: l.actorReference.sourceId, first_pitch_source_id: l.firstPhysicalPitchSourceId,
    ...extra, source_json: json(s), source_hash: hash(s), snapshot_json: json(v), snapshot_hash: hash(v) };
};
export const samePaLifecycleIdentityRow = (db: DatabaseSync, kind: SamePaLifecycleKind, id: string) => {
  const installed = assertSamePaLifecycleStorage(db);
  const rows = installed ? Object.values(tables).flatMap(table => db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id
    OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id }).map(row => ({ table, row }))) : [];
  if (rows.length > 1 || rows.length === 1 && (rows[0].table !== tables[kind] || rows[0].row.source_id !== id)) throw new Error('lifecycle Source identity alias differs');
  if (!rows.length) {
    // A removed owner remains claimed through typed references in either mirror.
    const descendants = db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND (name GLOB 'pa_*' OR name GLOB 'batting_*')").all();
    for (const d of descendants) {
      const name = String(d.name).replaceAll('"', '""'), columns = db.prepare(`PRAGMA main.table_info("${name}")`).all().map(r => String(r.name));
      for (const c of ['source_json', 'snapshot_json'].filter(c => columns.includes(c))) if (db.prepare(`SELECT 1 FROM main."${name}",json_tree(CASE WHEN json_valid(${c}) THEN ${c} ELSE 'null' END) obj
        WHERE obj.type='object' AND EXISTS(SELECT 1 FROM json_each(obj.value) o WHERE o.key='owner' AND o.type='text' AND o.atom=$owner)
        AND EXISTS(SELECT 1 FROM json_each(obj.value) i WHERE i.key='sourceId' AND i.type='text' AND i.atom=$id) LIMIT 1`).get({ owner: tables[kind], id })) throw new Error('lifecycle owner missing with surviving typed claims');
    }
  }
  return rows[0]?.row ?? null;
};
type Anchor = ReturnType<typeof readHistoricalSamePaContinuationViewFromSqlite>;
type Phase = { signature: string; failed: boolean; records: Map<string, SamePaLifecycleRecord>; anchors: Map<string, Anchor>;
  seconds: Map<string, ReturnType<typeof readSamePaSuccessorTakePitchFromSqlite>>; physical: Map<string, ReturnType<typeof readSamePaPhysicalOperationFromSqlite>>; shared: Map<string,unknown>; active: Set<string> };
const phases = new WeakMap<DatabaseSync, Phase>();
const signature = (db: DatabaseSync) => json({ transaction: db.isTransaction, query: db.prepare('PRAGMA query_only').get()!.query_only,
  changes: db.prepare('SELECT total_changes() n').get()!.n, main: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
  temp: db.prepare('PRAGMA temp.schema_version').get()!.schema_version, user: db.prepare('PRAGMA main.user_version').get()!.user_version });
const clear = (p: Phase) => { p.failed = true; p.records.clear(); p.anchors.clear(); p.seconds.clear(); p.physical.clear(); p.shared.clear(); p.active.clear(); };
/** One private immutable phase only. Nested normal readers may reuse completed
 * proofs; no proof survives a DML/DDL boundary, commit or owner operation. */
export const withSamePaLifecycleReadPhase = <T>(db: DatabaseSync, body: () => T): T => withSamePaContinuationReadPhase(db, () => {
  const prior = phases.get(db);
  if (prior) { try { if (prior.failed) throw new Error('lifecycle proof expired'); same(signature(db), prior.signature); const v = body(); same(signature(db), prior.signature); return v; }
    catch (e) { clear(prior); throw e; } }
  const p: Phase = { signature: signature(db), failed: false, records: new Map(), anchors: new Map(), seconds: new Map(), physical: new Map(), shared: new Map(), active: new Set() };
  const marker = 'pa_lifecycle_' + randomUUID().replaceAll('-', ''); db.exec('SAVEPOINT ' + marker); phases.set(db, p);
  try { const v = body(); if (p.failed) throw new Error('lifecycle proof expired'); same(signature(db), p.signature); db.exec('RELEASE ' + marker); return v; }
  catch (e) { if (db.isTransaction) try { db.exec('RELEASE ' + marker); } catch (cleanup) { throw new AggregateError([e, cleanup], 'lifecycle proof identity changed', { cause: e }); } throw e; }
  finally { clear(p); phases.delete(db); }
});
const anchor = (db: DatabaseSync, ref: SamePaReference<'pa_continuation_v1_execution_views'>) => {
  const p = phases.get(db)!; const key = json(ref), saved = p.anchors.get(key); if (saved) return saved;
  const value = readHistoricalSamePaContinuationViewFromSqlite(db, ref); p.anchors.set(key, value); return value;
};
const second = (db: DatabaseSync, ref: SamePaReference<'pa_take_successor_v1_pitch_actions'>) => {
  const p = phases.get(db)!; const key = json(ref), saved = p.seconds.get(key); if (saved) return saved;
  const value = readSamePaSuccessorTakePitchFromSqlite(db, ref); p.seconds.set(key, value); return value;
};
const physical = (db: DatabaseSync, ref: SamePaPhysicalOperationReference) => {
  const p = phases.get(db)!; const key = json(ref), saved = p.physical.get(key); if (saved) return saved;
  const value = readSamePaPhysicalOperationFromSqlite(db, ref); p.physical.set(key, value); return value;
};
const exactRaw = (db: DatabaseSync, ref: SamePaReference) => {
  const catalog = db.prepare('SELECT name,type FROM main.sqlite_master WHERE lower(name)=lower(?)').all(ref.owner);
  if (catalog.length !== 1 || catalog[0].type !== 'table' || catalog[0].name !== ref.owner || !/^[a-z0-9_]+$/.test(ref.owner)) throw new Error('lifecycle referenced namespace missing or aliased');
  const rows = db.prepare(`SELECT * FROM main.${ref.owner} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
    OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id: ref.sourceId });
  if (rows.length !== 1 || rows[0].source_id !== ref.sourceId) throw new Error('lifecycle raw identity missing or moved');
  const row = rows[0], source = JSON.parse(String(row.source_json)), value = JSON.parse(String(row.snapshot_json));
  same(value.source, source); same(reference(ref.owner, value), ref);
  if (row.source_hash !== ref.sourceHash || row.snapshot_hash !== ref.snapshotHash || row.source_json !== json(source) || row.snapshot_json !== json(value)) throw new Error('lifecycle raw identity hashes differ');
  return { row, source, value };
};
const assemble = <T>(db: DatabaseSync, current: boolean, body: (read: (kind: SamePaLifecycleKind, id: string) => SamePaLifecycleRecord | null,
  derive: (source: SamePaLifecycleSource) => SamePaLifecycleRecord) => T): T => withSamePaLifecycleReadPhase(db, () => {
  const phase = phases.get(db)!;
  const linked = (kind: SamePaLifecycleKind, ref: SamePaReference) => {
    if (!samePaReferenceValid(ref, tables[kind])) throw new Error('lifecycle reference owner differs'); const value = read(kind, ref.sourceId);
    if (!value) throw new Error('lifecycle original prerequisite missing'); same(reference(tables[kind], value), ref); return value;
  };
  const basis = (view: SamePaLifecycleView): SamePaLifecycleViewBasis => {
    const prefix = linked('prefix', view.source.prefixReference) as SamePaLifecyclePrefix, old = anchor(db, prefix.source.anchorViewReference);
    return freeze({ actor: old.actor, view, members: old.members.map(m => ({ ...m, projectedStateHash: view.participants.find(p => p.playerId === m.playerId)!.projectedStateHash })) });
  };
  const assessmentOwnership = (s: Extract<SamePaLifecycleSource, { provenance: unknown }>) => {
    for (const table of [...battingAssessmentOwners, 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_calibrations', 'pa_continuation_v1_total_assessments', 'pa_continuation_v1_execution_calibrations', 'reserved_pa_total_assessments', 'actual_role_workload_assessments', 'pa_dispatch_v1_execution_calibrations']) {
      if (!db.prepare('SELECT 1 FROM main.sqlite_master WHERE name=?').get(table)) continue;
      const rows = db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['provenance', 'assessmentSourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'provenance', 'assessmentSourceId'], '$id')}`).all({ id: s.provenance.assessmentSourceId });
      if (rows.some(r => table !== tables[samePaLifecycleKind(s)] || r.source_id !== s.sourceId)) throw new Error('lifecycle assessment identity already claimed');
    }
  };
  const derivePrefix = (source: AcceptedSamePaLifecyclePrefix): SamePaLifecyclePrefix => {
    const first = source.eventReferences[0]; if (first.owner !== 'pa_take_successor_v1_pitch_actions') throw new Error('lifecycle requires original second TAKE anchor');
    const bundle = second(db, { ...first, owner: 'pa_take_successor_v1_pitch_actions' }), old = anchor(db, source.anchorViewReference), actor = old.actor;
    same(bundle.action.source.viewReference, source.anchorViewReference); same(bundle.pitch.lineage, old.view.lineage); same(source.enrollmentReference, old.view.lineage.enrollmentReference);
    const p = bundle.pitch, at = Math.max(p.result.resolution.timeline.lastEventTick, p.result.delivery.timeline.followThroughEndUs);
    let cut: SamePaLifecycleCut = { stage: p.result.resolution.timeline.status.kind === 'active' ? 'retained_take' : 'resolved', physicalPitchReference: { ...first, owner: 'pa_take_successor_v1_pitch_actions' },
      operationReference: first, physicalOperationReference: { ...first, owner: 'pa_take_successor_v1_pitch_actions' }, pitchOrdinal: 2, evaluationTick: at,
      timeline: p.result.resolution.timeline, physicalWorld: actor.world,
      bodyCut: { kind: 'same_pa_starting_body_cut_v1', origin: 'retained_take', worldReference: old.view.lineage.actorReference,
        originalWorld: actor.world, originalWorldHash: hash(actor.world), completedAtTick: at }, outcomeReference: null, resetReference: null };
    let previousViewReference: SamePaLifecyclePrefix['previousViewReference'] = source.anchorViewReference;
    for (let index = 1; index < source.eventReferences.length; index++) {
      const ref = source.eventReferences[index]; if (ref.owner === 'pa_take_successor_v1_pitch_actions') throw new Error('lifecycle second pitch repeated');
      const raw = exactRaw(db, ref), viewRef = raw.source.viewReference;
      if (!samePaReferenceValid(viewRef, tables.view)) throw new Error('lifecycle operation prior view owner differs');
      const viewRaw = exactRaw(db, viewRef), viewSource = input(viewRaw.source);
      if (viewSource.capability !== 'same_pa_lifecycle_cumulative_view_v1') throw new Error('lifecycle operation prior view domain differs');
      const prefixRaw = exactRaw(db, viewSource.prefixReference), prior = input(prefixRaw.source);
      if (prior.capability !== 'same_pa_lifecycle_prefix_v1' || prior.sourceId === source.sourceId) throw new Error('lifecycle cyclic prefix direction');
      same(prior.enrollmentReference, source.enrollmentReference); same(prior.anchorViewReference, source.anchorViewReference);
      same(prior.eventReferences, source.eventReferences.slice(0, index));
      // Only after proving a strictly shorter graph may normal behavioral
      // replay traverse this operation's original view.
      if (samePaPhysicalOperationOwners.some(owner => owner === ref.owner)) {
        const op = physical(db, ref as SamePaPhysicalOperationReference); same(op.record, raw.value); same(op.lineage, old.view.lineage); same(op.viewReference, viewRef);
        if (op.evaluationTick < cut.evaluationTick || op.pitchOrdinal < cut.pitchOrdinal || op.pitchOrdinal > cut.pitchOrdinal + 1) throw new Error('lifecycle physical time or pitch order differs');
        if (ref.owner !== 'pa_physical_v1_launches') same(raw.source.previousOperationReference, cut.physicalOperationReference);
        else if (op.pitchOrdinal !== cut.pitchOrdinal + 1) throw new Error('lifecycle next pitch ordinal differs');
        const retainedTake=op.record.kind==='same_pa_physical_resolution_v1'&&op.record.resolution.kind==='recorded_take'&&op.timeline.status.kind==='active';
        const launch=retainedTake?physical(db,op.physicalPitchReference).record:null;
        const bodyCut=launch?.kind==='same_pa_physical_launch_v1'?{...op.bodyCut,completedAtTick:Math.max(op.evaluationTick,launch.delivery.timeline.followThroughEndUs)}:op.bodyCut;
        cut = { stage: op.stage === 'field' ? 'field_active' : op.stage === 'committed' ? 'in_flight' : op.record.kind === 'same_pa_physical_resolution_v1' && op.record.resolution.kind === 'recorded_take' && op.timeline.status.kind === 'active' ? 'retained_take' : op.stage,
          physicalPitchReference: op.physicalPitchReference, operationReference: ref, physicalOperationReference: ref as SamePaPhysicalOperationReference,
          pitchOrdinal: op.pitchOrdinal, evaluationTick: op.evaluationTick, timeline: op.timeline, physicalWorld: op.physicalWorld, bodyCut,
          outcomeReference: null, resetReference: null };
      } else if (ref.owner === tables.outcome) {
        const op = readSamePaLifecycleOutcomeFromSqlite(db, { ...ref, owner: 'pa_lifecycle_v1_outcomes' }); same(op, raw.value);
        same(op.source.viewReference, viewRef); same(op.lineage, old.view.lineage); same(op.source.physicalOperationReference, cut.physicalOperationReference);
        cut = { ...cut, stage: op.disposition === 'terminal' ? 'terminal' : 'foul_official_pending', operationReference: ref,
          evaluationTick: op.evaluationTick, timeline: op.timeline, outcomeReference: { ...ref, owner: 'pa_lifecycle_v1_outcomes' } };
      } else if (ref.owner === tables.reset) {
        const op = readSamePaLifecycleResetFromSqlite(db, { ...ref, owner: 'pa_lifecycle_v1_resets' }); same(op, raw.value);
        same(op.source.viewReference, viewRef); same(op.lineage, old.view.lineage); same(op.source.outcomeReference, cut.outcomeReference);
        cut = { ...cut, stage: 'foul_reset_ready', operationReference: ref, evaluationTick: op.resetWorld.tick, physicalWorld: op.resetWorld,
          timeline: op.timeline, bodyCut: { kind: 'same_pa_starting_body_cut_v1', origin: 'foul_reset', worldReference: { ...ref, owner: 'pa_lifecycle_v1_resets' },
            originalWorld: op.resetWorld, originalWorldHash: hash(op.resetWorld), completedAtTick: op.resetWorld.tick }, resetReference: { ...ref, owner: 'pa_lifecycle_v1_resets' } };
      } else {
        const op = readSamePaBattingInvocationFromSqlite(db, ref as SamePaBattingInvocationReference); same(op.record, raw.value);
        same(op.executionViewReference, viewRef); same(op.physicalPitchReference, cut.physicalPitchReference);
        if (op.evaluationTick !== cut.evaluationTick) throw new Error('mental invocation cannot advance the owned physical clock');
        const priorBasis = readHistoricalSamePaLifecycleViewFromSqlite(db, viewRef); same(op.member, priorBasis.members.find(m => m.playerId === op.member.playerId));
        cut = { ...cut, operationReference: ref };
      }
      previousViewReference = viewRef;
    }
    if (current) { assertSamePaLifecycleWorkCoverage(db, source.enrollmentReference, source.anchorViewReference, source.eventReferences);
      assertSamePaLifecycleReservedStateFromSqlite(db, {actor,view:old.view}); }
    const coverage = { lineage: old.view.lineage, anchorViewReference: source.anchorViewReference, eventReferences: source.eventReferences, previousViewReference, cut };
    return freeze({ kind: 'same_pa_lifecycle_prefix', source, lineage: old.view.lineage, previousViewReference, cut, coverageHash: hash(coverage) });
  };
  const derive = (source: SamePaLifecycleSource): SamePaLifecycleRecord => {
    if (source.capability === 'same_pa_lifecycle_prefix_v1') return derivePrefix(source);
    if (source.capability === 'same_pa_lifecycle_execution_calibration_v1') {
      const view = linked('view', source.viewReference) as SamePaLifecycleView; assessmentOwnership(source);
      return deriveSamePaLifecycleCalibration(db, source, basis(view), current);
    }
    const prefix = linked('prefix', source.prefixReference) as SamePaLifecyclePrefix; same(prefix.lineage.enrollmentReference, source.enrollmentReference);
    const old = anchor(db, prefix.source.anchorViewReference);
    if (source.capability === 'same_pa_lifecycle_cumulative_total_v1') {
      same(source.participantReference, prefix.lineage.participantReferences.find(p => p.playerId === source.participantReference.playerId));
      const previous = prefix.previousViewReference.owner === 'pa_continuation_v1_execution_views' ? anchor(db, { ...prefix.previousViewReference, owner: 'pa_continuation_v1_execution_views' }).view
        : readHistoricalSamePaLifecycleViewFromSqlite(db, { ...prefix.previousViewReference, owner: 'pa_lifecycle_v1_execution_views' }).view;
      const activity = previous.participants.find(p => p.playerId === source.participantReference.playerId)?.activity;
      if (!activity || activity.kind !== 'MATCH' || source.effortUnits < activity.effortUnits) throw new Error('lifecycle TOTAL cannot erase earlier work');
      assessmentOwnership(source); return freeze({ kind: 'same_pa_lifecycle_total', source, lineage: prefix.lineage, coverageHash: prefix.coverageHash, effortUnits: source.effortUnits });
    }
    const participants = old.view.participants.map(p => {
      const r = source.participantTotalReferences.find(r => r.playerId === p.playerId); if (!r) throw new Error('lifecycle all-ten TOTAL missing');
      const total = linked('total', r.assessmentReference) as SamePaLifecycleTotal; same(total.source.prefixReference, source.prefixReference); same(total.source.enrollmentReference, source.enrollmentReference);
      same(total.source.participantReference, prefix.lineage.participantReferences.find(r => r.playerId === p.playerId)); same(total.coverageHash, prefix.coverageHash);
      if (p.activity.kind !== 'MATCH') throw new Error('lifecycle reserved activity differs');
      const activity: PlayerWorkloadActivity = { ...p.activity, evidenceId: prefix.source.sourceId, effortUnits: total.effortUnits };
      const projectedState = advancePlayerWorkloadRecovery(p.reservedState, p.reservedState.revision, activity);
      return { playerId: p.playerId, totalReference: r.assessmentReference, reservedState: p.reservedState, activity, projectedState, projectedStateHash: hash(projectedState) };
    });
    if (participants.length !== 10) throw new Error('lifecycle all-ten participant set differs');
    return freeze({ kind: 'same_pa_lifecycle_view', source, lineage: prefix.lineage, coverageHash: prefix.coverageHash,
      assessmentSetHash: hash([...source.participantTotalReferences].sort((a,b) => a.playerId.localeCompare(b.playerId))), cut: prefix.cut, participants });
  };
  const read = (kind: SamePaLifecycleKind, id: string): SamePaLifecycleRecord | null => {
    if (phase.failed) throw new Error('lifecycle proof expired'); same(signature(db), phase.signature);
    const key = (current ? 'current:' : 'historical:') + kind + ':' + id, saved = phase.records.get(key); if (saved) return saved;
    if (phase.active.has(key)) throw new Error('lifecycle owner graph is cyclic'); phase.active.add(key);
    try { const row = samePaLifecycleIdentityRow(db, kind, id); if (!row) return null;
      const source = input(JSON.parse(String(row.source_json)), id); if (samePaLifecycleKind(source) !== kind) throw new Error('lifecycle Source owner differs');
      const value = derive(source); same(row, samePaLifecycleRow(value)); phase.records.set(key, value); return value;
    } finally { phase.active.delete(key); }
  };
  assertSamePaLifecycleStorage(db); return body(read, derive);
});
export const deriveCurrentSamePaLifecycleFromSqlite = (db: DatabaseSync, raw: unknown) => assemble(db, true, (_read, derive) => derive(input(raw)));
export const deriveCurrentSamePaLifecycleSetFromSqlite = (db: DatabaseSync, raw: readonly unknown[]) => assemble(db, true, (_read, derive) => raw.map(s => derive(input(s))));
export const readSamePaLifecycleRecordFromSqlite = (db: DatabaseSync, kind: SamePaLifecycleKind, id: string) => {
  if (!samePaText(id)) throw new Error('invalid lifecycle Source identity'); return assemble(db, false, read => read(kind, id));
};
export const readSamePaLifecycleSetFromSqlite = (db: DatabaseSync, kind: 'total' | 'calibration', ids: readonly string[]) => assemble(db, false, read => ids.map(id => read(kind,id)));
const readView = (db: DatabaseSync, raw: SamePaReference<'pa_lifecycle_v1_execution_views'>, current: boolean): SamePaLifecycleViewBasis => {
  const ref = cloneInert(raw); if (!samePaReferenceValid(ref, tables.view)) throw new Error('invalid lifecycle view reference');
  return assemble(db, current, read => { const view = read('view',ref.sourceId) as SamePaLifecycleView | null; if (!view) throw new Error('lifecycle view missing'); same(reference(tables.view, view), ref);
    const prefix = read('prefix',view.source.prefixReference.sourceId) as SamePaLifecyclePrefix, old = anchor(db,prefix.source.anchorViewReference);
    return freeze({ actor: old.actor, view, members: old.members.map(m => ({ ...m, projectedStateHash: view.participants.find(p => p.playerId === m.playerId)!.projectedStateHash })) }); });
};
export const readHistoricalSamePaLifecycleViewFromSqlite = (db: DatabaseSync, ref: SamePaReference<'pa_lifecycle_v1_execution_views'>) => readView(db,ref,false);
export const readCurrentSamePaLifecycleViewFromSqlite = (db: DatabaseSync, ref: SamePaReference<'pa_lifecycle_v1_execution_views'>) => readView(db,ref,true);
const calibration = (db: DatabaseSync, raw: SamePaReference<'pa_lifecycle_v1_execution_calibrations'>, current: boolean) => {
  const ref = cloneInert(raw); if (!samePaReferenceValid(ref,tables.calibration)) throw new Error('invalid lifecycle calibration reference');
  return assemble(db,current,read => { const v=read('calibration',ref.sourceId) as SamePaLifecycleCalibration | null; if (!v) throw new Error('lifecycle calibration missing'); same(reference(tables.calibration,v),ref); return v; });
};
export const readSamePaLifecycleCalibrationFromSqlite = (db: DatabaseSync, ref: SamePaReference<'pa_lifecycle_v1_execution_calibrations'>) => calibration(db,ref,false);
export const readCurrentSamePaLifecycleCalibrationFromSqlite = (db: DatabaseSync, ref: SamePaReference<'pa_lifecycle_v1_execution_calibrations'>) => calibration(db,ref,true);
export const readSamePaLifecycleNextPitchBasisFromSqlite = (db: DatabaseSync, ref: SamePaReference<'pa_lifecycle_v1_execution_views'>, mode: 'current'|'historical') => withSamePaLifecycleReadPhase(db, () => {
  const b=readView(db,ref,mode==='current'), c=b.view.cut;
  if (c.timeline.status.kind!=='active' || !['retained_take','foul_reset_ready'].includes(c.stage)) return freeze({kind:'pending' as const,reason:'same_pa_physical_or_official_closure_pending'});
  const continuation=advancePlateAppearancePitchSequenceToMatchState({match:b.actor.match,batterRunnerId:b.actor.binding.playerId,timeline:c.timeline,pitches:[]});
  if(continuation.kind!=='active')throw new Error('same-PA next pitch requires an active Core sequence');
  const match={...continuation.matchState,balls:c.timeline.status.count.balls,strikes:c.timeline.status.count.strikes};
  const baseCenters=c.bodyCut.worldReference.owner==='pa_lifecycle_v1_resets' ? readSamePaLifecycleResetFromSqlite(db,{...c.bodyCut.worldReference,owner:'pa_lifecycle_v1_resets'}).source.worldSetup.baseCenters : samePaStartingBaseCenters(db,b.actor);
  const result: SamePaLifecycleNextPitchBasis={kind:'ready',...b,timeline:c.timeline,match,physicalWorld:c.physicalWorld,bodyCut:c.bodyCut,baseCenters,
    nextPitchOrdinal:c.pitchOrdinal+1,previousPitchReference:c.physicalPitchReference,outcomeReference:c.outcomeReference,resetReference:c.resetReference}; return freeze(result);
});

/** Staged owner proofs use these current fences independently of historical
 * ancestry. Arguments are freshly rederived data, never accepted proof tokens. */
export const assertSamePaLifecycleReservedStateFromSqlite=(db:DatabaseSync,b:Pick<SamePaLifecycleViewBasis,'actor'> & {view:{participants:readonly Pick<SamePaLifecycleView['participants'][number],'playerId'|'reservedState'>[]}})=>{
  assertPhysicalActorOpenFrame(db,b.actor);
  for(const p of b.view.participants){const binding=[b.actor.binding,...b.actor.defenderBindings].find(x=>x.playerId===p.playerId);if(!binding)throw new Error('lifecycle reserved binding missing');
    same(readActualRoleWorkloadState(db,binding.careerId,binding.playerId,undefined,binding.personLinkSourceId),p.reservedState);}
};
export const assertSamePaLifecycleWorkCoverage=(db:DatabaseSync,enrollment:SamePaReference<'same_pa_enrollments'>,anchorRef:SamePaReference<'pa_continuation_v1_execution_views'>,events:readonly SamePaLifecycleWorkReference[])=>{
  const old=anchor(db,anchorRef),oldPrefix=readSamePaContinuationRecordFromSqlite(db,'prefix',old.view.source.prefixReference.sourceId);
  if(!oldPrefix||oldPrefix.kind!=='nonempty_prefix')throw new Error('lifecycle original anchor prefix missing');same(old.view.lineage.enrollmentReference,enrollment);
  // Discover through the same typed raw/indexed closure used by settlement.
  // A moved batting index and mirror cannot hide its original view/actor link.
  const claims=readSamePaContinuationClaimRows(db,enrollment.sourceId).filter(r=>workOwners.has(r.table)&&r.table!=='pa_take_successor_v1_pitch_actions');
  const actual:SamePaReference[]=claims.map(r=>({owner:r.table,sourceId:String(r.row.source_id),sourceHash:String(r.row.source_hash),snapshotHash:String(r.row.snapshot_hash)}));
  const pitches=new Set(claims.filter(r=>r.table.startsWith('batting_')).map(r=>String(r.row.physical_pitch_source_id)));
  for(const pitch of pitches)readSamePaBattingInvocationClaims(db,{enrollmentSourceId:enrollment.sourceId,physicalPitchSourceId:pitch});
  const ancestors=new Set(oldPrefix.source.operationReferences.map(json));
  same(actual.filter(r=>!ancestors.has(json(r))).map(json).sort(),events.slice(1).map(json).sort());
};

/** Internal memo within an already-owned immutable read phase. A caller cannot
 * install or carry this map; signatures and outer savepoint identity fence it. */
export const memoSamePaLifecycleRead=<T>(db:DatabaseSync,key:string,read:()=>T):T=>withSamePaLifecycleReadPhase(db,()=>{
  const p=phases.get(db)!;if(p.failed)throw new Error('lifecycle proof expired');same(signature(db),p.signature);
  const name='shared:'+key;if(p.shared.has(name))return p.shared.get(name) as T;if(p.active.has(name))throw new Error('lifecycle shared proof cycle');p.active.add(name);
  try{const value=read();same(signature(db),p.signature);p.shared.set(name,value);return value;}finally{p.active.delete(name);}
});
