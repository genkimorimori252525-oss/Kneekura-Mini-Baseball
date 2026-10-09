import { readSamePaSuccessorWorkClaimRows } from './SamePlateAppearanceContinuationClaimGuard';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { battingAssessmentOwners } from './BattingAssessmentOwnership';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { advancePlayerWorkloadRecovery, type PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorHash as hash, actorJson as json, actorFreeze as freeze, assertPhysicalActorOpenFrame } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaReferenceValid, samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { readSamePaExecutedPitchFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { deriveSamePaDispatchRoles, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import { assertSamePaRegistrationBeforeWork } from './ActualLiveRuntimeRegistration';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { assertSamePaContinuationStorage } from './SamePlateAppearanceContinuationStorage';
import { samePaContinuationTables as tables, samePaContinuationSourceInput as input, samePaContinuationKind,
  type SamePaContinuationKind, type SamePaContinuationSource, type SamePaContinuationRecord, type SamePaNonemptyPrefix,
  type SamePaContinuationTotal, type SamePaContinuationView } from './SamePlateAppearanceContinuation';
import { readLegacySamePaBattingInvocationFromSqlite, readSamePaBattingInvocationClaims } from './SamePlateAppearanceBattingInvocationFromSqlite';
import { deriveSamePaContinuationCalibration, type SamePaContinuationCalibration } from './SamePlateAppearanceContinuationCalibration';
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA continuation original ownership or current coverage differs'); };
export const samePaContinuationRow = (value: SamePaContinuationRecord): Record<string, string | number> => {
  const s = value.source, l = value.lineage;
  const extra: Record<string, string | number> = value.kind === 'nonempty_execution_calibration_prepared' ? { view_source_id: value.source.viewReference.sourceId, player_id: value.source.member.playerId, route: value.source.route, nominal_parameter_identity: json(value.source.nominalParameterReference ?? value.source.nominalReference) }
    : value.kind === 'nonempty_prefix' ? { pitch_source_id: value.source.pitchReference.sourceId, coverage_hash: value.coverageHash }
    : value.kind === 'nonempty_cumulative_total' ? { prefix_source_id: value.source.prefixReference.sourceId, player_id: value.source.participantReference.playerId,
      baseline_source_id: value.source.participantReference.baselineSourceId } : { prefix_source_id: value.source.prefixReference.sourceId, assessment_set_hash: value.assessmentSetHash };
  return { source_id: s.sourceId, source_version: s.sourceVersion, career_id: l.careerId, game_id: l.gameId, play_id: l.playId,
    enrollment_source_id: l.enrollmentReference.sourceId, actor_source_id: l.actorReference.sourceId, first_pitch_source_id: l.firstPhysicalPitchSourceId,
    ...extra, source_json: json(s), source_hash: hash(s), snapshot_json: json(value), snapshot_hash: hash(value) };
};
export const samePaContinuationIdentityRow = (db: DatabaseSync, kind: SamePaContinuationKind, id: string) => {
  const installed = assertSamePaContinuationStorage(db);
  const rows = installed ? Object.values(tables).flatMap(table => db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id
    OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id }).map(row => ({ table, row }))) : [];
  if (rows.length > 1 || rows.length === 1 && (rows[0].table !== tables[kind] || rows[0].row.source_id !== id)) throw new Error('same-PA continuation Source identity alias differs');
  if (!rows.length) {
    const descendants = db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND (name GLOB 'pa_continuation_v1_*' OR name GLOB 'batting_observation_v1_*' OR name GLOB 'batting_prediction_v1_*' OR name GLOB 'batting_emotion_execution_v1_*' OR name GLOB 'batting_execution_v1_*')").all();
    for (const descendant of descendants) {
      const table = String(descendant.name), columns = db.prepare('PRAGMA main.table_info("' + table.replaceAll('"', '""') + '")').all().map(r => String(r.name));
      for (const column of ['source_json', 'snapshot_json'].filter(c => columns.includes(c))) {
        if (db.prepare(`SELECT 1 FROM main."${table.replaceAll('"', '""')}", json_tree(CASE WHEN json_valid(${column}) THEN ${column} ELSE 'null' END) obj
          WHERE obj.type='object' AND EXISTS(SELECT 1 FROM json_each(obj.value) o WHERE o.key='owner' AND o.type='text' AND o.atom=$owner)
          AND EXISTS(SELECT 1 FROM json_each(obj.value) i WHERE i.key='sourceId' AND i.type='text' AND i.atom=$id) LIMIT 1`).get({ owner: tables[kind], id })) {
          throw new Error('same-PA continuation missing owner has surviving typed claims; repair forbidden');
        }
      }
    }
  }
  return rows[0]?.row ?? null;
};
type ReadPhase = {
  signature: string; failed: boolean;
  records: Map<string, SamePaContinuationRecord>;
  pitches: Map<string, ReturnType<typeof readSamePaExecutedPitchFromSqlite>>;
  emptyViews: Map<string, ReturnType<typeof readHistoricalSamePaExecutionView>>;
  shared: Map<string, unknown>;
  active: Set<string>;
};
// A nested normal owner may return through these exports. Only the outermost
// immutable call owns this entry, and always destroys it before returning.
const phases = new WeakMap<DatabaseSync, ReadPhase>();
const readSignature = (db: DatabaseSync) => json({ transaction: db.isTransaction, query: db.prepare('PRAGMA query_only').get()!.query_only,
  changes: db.prepare('SELECT total_changes() n').get()!.n, main: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
  temp: db.prepare('PRAGMA temp.schema_version').get()!.schema_version, user: db.prepare('PRAGMA main.user_version').get()!.user_version });
const invalidate = (phase: ReadPhase) => { phase.failed = true; phase.records.clear(); phase.pitches.clear(); phase.emptyViews.clear(); phase.shared.clear(); phase.active.clear(); };
const immutable = <T>(db: DatabaseSync, body: () => T): T => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) throw new Error('same-PA continuation requires Native query-only ownership');
  const active = phases.get(db);
  if (active) {
    try { if (active.failed) throw new Error('same-PA continuation phase expired'); same(readSignature(db), active.signature);
      const value = body(); same(readSignature(db), active.signature); return value;
    } catch (error) { invalidate(active); throw error; }
  }
  const phase: ReadPhase = { signature: readSignature(db), failed: false, records: new Map(), pitches: new Map(), emptyViews: new Map(), shared: new Map(), active: new Set() };
  const marker = 'pa_continuation_' + randomUUID().replaceAll('-', ''); db.exec('SAVEPOINT ' + marker); phases.set(db, phase);
  try { const value = body(); if (phase.failed) throw new Error('same-PA continuation phase expired');
    same(readSignature(db), phase.signature); db.exec('RELEASE ' + marker); return value;
  } catch (error) { if (db.isTransaction) try { db.exec('RELEASE ' + marker); } catch (cleanup) {
    throw new AggregateError([error, cleanup], 'same-PA continuation original proof identity changed', { cause: error }); } throw error;
  } finally { invalidate(phase); phases.delete(db); }
};
/** Internal synchronous owner composition only; never exposed through a Source or owner authority. */
export const withSamePaContinuationReadPhase = <T>(db: DatabaseSync, body: () => T): T => immutable(db, body);
/** Completed historical prerequisites belong to the enclosing continuation
 * proof, including when individual readers enter shorter lifecycle phases.
 * No map escapes the Native signature/savepoint fence or an owner operation. */
export const memoSamePaContinuationRead = <T>(db: DatabaseSync, key: string, read: () => T): T => immutable(db, () => {
  const phase = phases.get(db)!, name = 'shared:' + key;
  if (phase.shared.has(name)) return phase.shared.get(name) as T;
  if (phase.active.has(name)) throw new Error('same-PA continuation shared proof cycle');
  phase.active.add(name);
  try {
    const value = read();
    if (phase.failed) throw new Error('same-PA continuation phase expired');
    phase.shared.set(name, value); return value;
  } finally { phase.active.delete(name); }
});
const originalEmptyView = (db: DatabaseSync, ref: SamePaReference<'reserved_pa_execution_views'>) => {
  const phase = phases.get(db); if (!phase || phase.failed) throw new Error('same-PA continuation phase missing'); same(readSignature(db), phase.signature);
  const key = json(ref), prior = phase.emptyViews.get(key); if (prior) return prior;
  const value = readHistoricalSamePaExecutionView(db, ref); phase.emptyViews.set(key, value); return value;
};
/** Reuse the complete original dispatch proof only inside this immutable
 * continuation phase. Current admission and workload checks remain separate. */
export const readSamePaContinuationOriginalPitchFromSqlite = (db: DatabaseSync,
  raw: SamePaReference<'pa_dispatch_v1_pitch_actions'>): ReturnType<typeof readSamePaExecutedPitchFromSqlite> => immutable(db, () => {
  const ref = cloneInert(raw);
  if (!samePaReferenceValid(ref, 'pa_dispatch_v1_pitch_actions')) throw new Error('invalid same-PA continuation original pitch reference');
  const phase = phases.get(db)!, key = json(ref), activeKey = 'pitch:' + key, prior = phase.pitches.get(key);
  if (prior) { same(prior.reference, ref); return prior; }
  if (phase.active.has(activeKey)) throw new Error('same-PA continuation original pitch cycle');
  phase.active.add(activeKey);
  try {
    const value = readSamePaExecutedPitchFromSqlite(db, ref); same(value.reference, ref);
    if (phase.failed) throw new Error('same-PA continuation phase expired');
    phase.pitches.set(key, value); return value;
  } finally { phase.active.delete(activeKey); }
});
const assemble = <T>(db: DatabaseSync, current: boolean, body: (read: (kind: SamePaContinuationKind, id: string) => SamePaContinuationRecord | null,
  derive: (source: SamePaContinuationSource) => SamePaContinuationRecord) => T): T => immutable(db, () => {
  const phase = phases.get(db)!;
  const saved = phase.records;
  const pitch = (ref: SamePaReference<'pa_dispatch_v1_pitch_actions'>) => readSamePaContinuationOriginalPitchFromSqlite(db, ref);
  const linked = (kind: SamePaContinuationKind, ref: SamePaReference) => {
    if (!samePaReferenceValid(ref, tables[kind])) throw new Error('same-PA continuation reference owner differs');
    const value = read(kind, ref.sourceId); if (!value) throw new Error('same-PA continuation original prerequisite missing'); same(reference(tables[kind], value), ref); return value;
  };
  const assessmentOwnership = (source: Extract<SamePaContinuationSource, { provenance: unknown }>) => {
      for (const table of [...battingAssessmentOwners, 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_calibrations', 'pa_continuation_v1_total_assessments', 'pa_continuation_v1_execution_calibrations', 'reserved_pa_total_assessments', 'actual_role_workload_assessments', 'pa_dispatch_v1_execution_calibrations']) {
        if (!db.prepare('SELECT 1 FROM main.sqlite_master WHERE name=?').get(table)) continue;
        const rows = db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
          OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')} OR ${claim('source_json', ['provenance', 'assessmentSourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'provenance', 'assessmentSourceId'], '$id')}`).all({ id: source.provenance.assessmentSourceId });
        if (rows.some(row => table !== (source.capability === 'same_pa_nonempty_cumulative_total_v1' ? tables.total : tables.calibration) || row.source_id !== source.sourceId)) throw new Error('same-PA continuation assessment identity belongs to other work');
      }
  };
  const derive = (source: SamePaContinuationSource): SamePaContinuationRecord => {
    if (source.capability === 'same_pa_completed_take_prefix_v1') {
      const original = pitch(source.pitchReference), p = original.pitch, actor = p.originalActor;
      same(source.enrollmentReference, p.lineage.enrollmentReference); same(source.originalViewReference, p.viewReference);
      const view = originalEmptyView(db, source.originalViewReference).view;
      same(view.lineage, p.lineage);
      if (current) {
        if (readSamePaSuccessorWorkClaimRows(db, { enrollmentSourceId: source.enrollmentReference.sourceId }).length) throw new Error('same-PA view is stale after successor physical work');
        assertPhysicalActorOpenFrame(db, actor);
        assertSamePaRegistrationBeforeWork(db, { gameId: actor.source.gameId, playId: actor.match.playId,
          physicalPitchSourceId: p.source.sourceId, actorSourceId: actor.source.sourceId,
          ...('initialWorldSourceId' in actor.source ? { initialWorldSourceId: actor.source.initialWorldSourceId } : { activationApplicationId: actor.source.activationApplicationId }) });
        for (const participant of view.participants) {
          const b = [actor.binding, ...actor.defenderBindings].find(b => b.playerId === participant.playerId)!;
          same(readActualRoleWorkloadState(db, b.careerId, b.playerId, undefined, b.personLinkSourceId), participant.reservedState);
        }
      }
      const physical = p.result.resolution.physical;
      if (physical.kind !== 'taken') throw new Error('same-PA completed-TAKE cut cannot manufacture batted field coverage');
      let evaluationTick = physical.result.crossing.tick;
      let previousViewReference: SamePaReference<'reserved_pa_execution_views' | 'pa_continuation_v1_execution_views'> = source.originalViewReference;
      // Establish the strictly shorter prior-view direction from exact raw
      // owner references before invoking any recursive behavioral replay.
      for (const [index, opRef] of source.operationReferences.entries()) {
        const rows = db.prepare(`SELECT * FROM main.${opRef.owner} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
          OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id: opRef.sourceId });
        if (rows.length !== 1 || rows[0].source_id !== opRef.sourceId) throw new Error('same-PA invocation identity missing or aliased');
        const row = rows[0], opSource = JSON.parse(String(row.source_json)), opRecord = JSON.parse(String(row.snapshot_json));
        same(opRecord.source, opSource); same({ owner: opRef.owner, sourceId: opSource.sourceId, sourceHash: hash(opSource), snapshotHash: hash(opRecord) }, opRef);
        if (row.source_hash !== opRef.sourceHash || row.snapshot_hash !== opRef.snapshotHash || row.source_json !== json(opSource)
          || row.snapshot_json !== json(opRecord) || !samePaReferenceValid(opSource.viewReference, tables.view)) throw new Error('same-PA invocation raw direction differs');
        const priorViewRow = samePaContinuationIdentityRow(db, 'view', opSource.viewReference.sourceId);
        if (!priorViewRow || priorViewRow.source_hash !== opSource.viewReference.sourceHash || priorViewRow.snapshot_hash !== opSource.viewReference.snapshotHash) throw new Error('same-PA invocation prior view missing');
        const priorViewSource = input(JSON.parse(String(priorViewRow.source_json)));
        if (priorViewSource.capability !== 'same_pa_nonempty_cumulative_view_v1') throw new Error('same-PA invocation prior view owner differs');
        const priorPrefixRow = samePaContinuationIdentityRow(db, 'prefix', priorViewSource.prefixReference.sourceId);
        if (!priorPrefixRow || priorPrefixRow.source_hash !== priorViewSource.prefixReference.sourceHash || priorPrefixRow.snapshot_hash !== priorViewSource.prefixReference.snapshotHash) throw new Error('same-PA invocation prior prefix missing');
        const priorPrefixSource = input(JSON.parse(String(priorPrefixRow.source_json)));
        if (priorPrefixSource.capability !== 'same_pa_completed_take_prefix_v1' || priorPrefixSource.sourceId === source.sourceId) throw new Error('same-PA invocation cyclic prefix');
        same(priorPrefixSource.pitchReference, source.pitchReference); same(priorPrefixSource.enrollmentReference, source.enrollmentReference);
        same(priorPrefixSource.originalViewReference, source.originalViewReference); same(priorPrefixSource.operationReferences, source.operationReferences.slice(0, index));
        const operation = readLegacySamePaBattingInvocationFromSqlite(db, opRef);
        same(operation.record, opRecord); same(operation.executionViewReference, opSource.viewReference); same(operation.physicalPitchReference, source.pitchReference);
        previousViewReference = operation.executionViewReference;
        const priorView = readHistoricalSamePaContinuationViewFromSqlite(db, opSource.viewReference).view;
        if (!Number.isSafeInteger(operation.evaluationTick) || operation.evaluationTick < evaluationTick || operation.evaluationTick < priorView.evaluationTick) throw new Error('same-PA invocation evaluation time backdates its owned cut');
        evaluationTick = operation.evaluationTick;
        const reservedMember = deriveSamePaDispatchRoles(actor, view).find(role => role.member.playerId === operation.member.playerId)?.member;
        if (!reservedMember) throw new Error('same-PA invocation original participant missing');
        same(operation.member, { ...reservedMember, projectedStateHash: priorView.participants.find(p => p.playerId === operation.member.playerId)!.projectedStateHash });
      }
      if (current) {
        const claims = readSamePaBattingInvocationClaims(db, { enrollmentSourceId: source.enrollmentReference.sourceId, physicalPitchSourceId: p.source.sourceId });
        same([...claims].map(json).sort(), source.operationReferences.map(json).sort());
      }
      const endpoint = { kind: 'completed_take_plate_crossing_v1' as const, pitchReference: source.pitchReference,
        originTick: p.result.trajectory.start.tick, ticksPerSecond: p.result.trajectory.ticksPerSecond, crossing: physical.result.crossing,
        trajectoryHash: hash(p.result.trajectory), timelineHash: hash(p.result.resolution.timeline) };
      const coverage = { lineage: p.lineage, evaluationTick, previousViewReference, operationReferences: source.operationReferences, physicalRevision: 1 as const, endpoint, consumerReferences: p.consumerReferences,
        consumptionReference: reference('pa_dispatch_v1_consumptions', original.consumption), admissionReference: reference('pa_dispatch_v1_episode_admissions', original.admission),
        timeline: p.result.resolution.timeline };
      return freeze({ kind: 'nonempty_prefix', source, ...coverage, coverageHash: hash(coverage) });
    }
    if (source.capability === 'same_pa_nonempty_execution_calibration_v1') {
      const view = linked('view', source.viewReference) as SamePaContinuationView;
      const prefix = linked('prefix', view.source.prefixReference) as SamePaNonemptyPrefix;
      const original = pitch(prefix.source.pitchReference), actor = original.pitch.originalActor;
      const old = originalEmptyView(db, prefix.source.originalViewReference).view;
      const members = deriveSamePaDispatchRoles(actor, old).map(role => ({ ...role.member,
        projectedStateHash: view.participants.find(p => p.playerId === role.member.playerId)!.projectedStateHash }));
      assessmentOwnership(source);
      return deriveSamePaContinuationCalibration(db, source, { actor, view, members }, current);
    }
    const prefix = linked('prefix', source.prefixReference) as SamePaNonemptyPrefix;
    same(prefix.lineage.enrollmentReference, source.enrollmentReference);
    if (source.capability === 'same_pa_nonempty_cumulative_total_v1') {
      const participant = prefix.lineage.participantReferences.find(p => p.playerId === source.participantReference.playerId);
      if (!participant) throw new Error('same-PA continuation TOTAL original participant missing'); same(participant, source.participantReference);
      const previousView = prefix.previousViewReference.owner === 'reserved_pa_execution_views'
        ? originalEmptyView(db, { ...prefix.previousViewReference, owner: 'reserved_pa_execution_views' }).view
        : readHistoricalSamePaContinuationViewFromSqlite(db, { ...prefix.previousViewReference, owner: 'pa_continuation_v1_execution_views' }).view;
      const previousActivity = previousView.participants.find(p => p.playerId === participant.playerId)!.activity;
      if (previousActivity.kind !== 'MATCH') throw new Error('same-PA cumulative original activity kind differs');
      const priorTotal = previousActivity.effortUnits;
      if (source.effortUnits < priorTotal) throw new Error('same-PA cumulative TOTAL cannot erase already covered work');
      assessmentOwnership(source);
      return freeze({ kind: 'nonempty_cumulative_total', source, lineage: prefix.lineage, coverageHash: prefix.coverageHash, effortUnits: source.effortUnits });
    }
    const original = pitch(prefix.source.pitchReference), actor = original.pitch.originalActor;
    const originalView = originalEmptyView(db, prefix.source.originalViewReference).view;
    const participants = originalView.participants.map(p => {
      const r = source.participantTotalReferences.find(r => r.playerId === p.playerId); if (!r) throw new Error('same-PA continuation all-ten TOTAL coverage missing');
      const total = linked('total', r.assessmentReference) as SamePaContinuationTotal;
      same(total.source.prefixReference, source.prefixReference); same(total.source.enrollmentReference, source.enrollmentReference);
      same(total.source.participantReference, prefix.lineage.participantReferences.find(r => r.playerId === p.playerId)); same(total.coverageHash, prefix.coverageHash);
      // Reuse the exact eventual activity identity/day/policy from the original
      // reservation. Each cumulative total is applied once to its original BEFORE.
      if (p.activity.kind !== 'MATCH') throw new Error('same-PA reserved original activity kind differs');
      const activity: PlayerWorkloadActivity = { ...p.activity, evidenceId: prefix.source.sourceId, effortUnits: total.effortUnits };
      const projectedState = advancePlayerWorkloadRecovery(p.reservedState, p.reservedState.revision, activity);
      return { playerId: p.playerId, totalReference: r.assessmentReference, reservedState: p.reservedState, activity,
        projectedState, projectedStateHash: hash(projectedState) };
    });
    if (participants.length !== 10 || actor.binding.gameDay !== participants[0].activity.atDay) throw new Error('same-PA continuation original day/ten coverage differs');
    return freeze({ kind: 'nonempty_basis_prepared', source, lineage: prefix.lineage, coverageHash: prefix.coverageHash,
      assessmentSetHash: hash([...source.participantTotalReferences].sort((a, b) => a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0)), evaluationTick: prefix.evaluationTick, physicalCut: prefix.endpoint, participants });
  };
  const read = (kind: SamePaContinuationKind, id: string): SamePaContinuationRecord | null => {
    same(readSignature(db), phase.signature); if (phase.failed) throw new Error('same-PA continuation phase expired');
    const key = (current ? 'current:' : 'historical:') + kind + ':' + id, prior = saved.get(key); if (prior) return prior;
    if (phase.active.has(key)) throw new Error('same-PA continuation cyclic owner graph'); phase.active.add(key);
    try {
    const row = samePaContinuationIdentityRow(db, kind, id); if (!row) return null;
    const source = input(JSON.parse(String(row.source_json)), id); if (samePaContinuationKind(source) !== kind) throw new Error('same-PA continuation stored Source owner differs');
    const value = derive(source); same(row, samePaContinuationRow(value)); saved.set(key, value); return value;
    } finally { phase.active.delete(key); }
  };
  assertSamePaContinuationStorage(db); return body(read, derive);
});
/** Internal read-only candidate derivation. The writer owns fresh proofs around
 * every DML; this data value is never an admission token. */
export const deriveCurrentSamePaContinuationFromSqlite = (db: DatabaseSync, raw: unknown) => {
  const source = input(raw); return assemble(db, true, (_read, derive) => derive(source));
};
export const readSamePaContinuationRecordFromSqlite = (db: DatabaseSync, kind: SamePaContinuationKind, id: string) => {
  if (!samePaText(id)) throw new Error('invalid same-PA continuation identity'); return assemble(db, false, read => read(kind, id));
};
const readView = (db: DatabaseSync, raw: SamePaReference<'pa_continuation_v1_execution_views'>, current: boolean) => {
  const ref = cloneInert(raw);
  if (!samePaReferenceValid(ref, tables.view)) throw new Error('invalid same-PA nonempty view reference');
  return assemble(db, current, read => {
    const view = read('view', ref.sourceId) as SamePaContinuationView | null; if (!view) throw new Error('same-PA nonempty view missing'); same(reference(tables.view, view), ref);
    const prefix = read('prefix', view.source.prefixReference.sourceId) as SamePaNonemptyPrefix;
    const original = readSamePaContinuationOriginalPitchFromSqlite(db, prefix.source.pitchReference), actor = original.pitch.originalActor;
    const old = originalEmptyView(db, prefix.source.originalViewReference).view;
    const members: readonly SamePaDispatchMember[] = deriveSamePaDispatchRoles(actor, old).map(role => ({ ...role.member,
      projectedStateHash: view.participants.find(p => p.playerId === role.member.playerId)!.projectedStateHash }));
    return freeze({ actor, view, members });
  });
};
export const readHistoricalSamePaContinuationViewFromSqlite = (db: DatabaseSync, ref: SamePaReference<'pa_continuation_v1_execution_views'>) => readView(db, ref, false);
export const readCurrentSamePaContinuationViewFromSqlite = (db: DatabaseSync, ref: SamePaReference<'pa_continuation_v1_execution_views'>) => readView(db, ref, true);

export const readSamePaContinuationCalibrationFromSqlite = (db: DatabaseSync, raw: SamePaReference<'pa_continuation_v1_execution_calibrations'>): SamePaContinuationCalibration => {
  const ref = cloneInert(raw);
  if (!samePaReferenceValid(ref, tables.calibration)) throw new Error('invalid same-PA nonempty calibration reference');
  return assemble(db, false, read => { const value = read('calibration', ref.sourceId) as SamePaContinuationCalibration | null;
    if (!value) throw new Error('same-PA nonempty accepted calibration missing'); same(reference(tables.calibration, value), ref); return value; });
};
export const readCurrentSamePaContinuationCalibrationFromSqlite = (db: DatabaseSync, raw: SamePaReference<'pa_continuation_v1_execution_calibrations'>): SamePaContinuationCalibration => {
  const ref = cloneInert(raw);
  if (!samePaReferenceValid(ref, tables.calibration)) throw new Error('invalid same-PA current calibration reference');
  return assemble(db, true, read => { const value = read('calibration', ref.sourceId) as SamePaContinuationCalibration | null;
    if (!value) throw new Error('same-PA current accepted calibration missing'); same(reference(tables.calibration, value), ref); return value; });
};
/** A single immutable phase shares completed ancestry while independently
 * authenticating each declared member. Nothing survives a write boundary. */
export const deriveCurrentSamePaContinuationSetFromSqlite = (db: DatabaseSync, raw: readonly unknown[]) => {
  const sources = raw.map(s => input(s)); return assemble(db, true, (_read, derive) => sources.map(derive));
};
export const readSamePaContinuationSetFromSqlite = (db: DatabaseSync, kind: 'total' | 'calibration', ids: readonly string[]) =>
  assemble(db, false, read => ids.map(id => read(kind, id)));
