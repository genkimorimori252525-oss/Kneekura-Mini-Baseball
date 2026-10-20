import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { prepareRecoveredBallFieldRootV1 } from '../../core/sim/pitch/RecoveredBallFieldRootV1';
import { createSourceBallWorldMotionSessionV1 } from '../../core/sim/ball/SourceBallWorldMotionV1';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText as text, samePaReferenceValid as validRef, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { readInitialJointRecoveryWorkloadContextFromSqlite, assertCurrentInitialJointRecoveryWorkloadBasisFromSqlite } from './SqliteInitialJointRecoveryWorkloadStore';
import { jointFieldSuccessorCommandInput, jointFieldCapabilityAt, type AcceptedJointFieldSuccessorCommand } from './JointFieldSuccessorCommand';
import { assertNoJointPhysicalDescendantClaims } from './JointPhysicalDescendantClaims';
import { proveFiniteFieldActorClearanceV1 } from '../../core/sim/fielding/FiniteFieldActorClearanceV1';

export const jointFieldSuccessorExecutionTable = 'pa_joint_field_successor_v1_executions';
export type JointFieldSuccessorExecutionReference = SamePaReference<typeof jointFieldSuccessorExecutionTable>;
function assert(v: unknown, message: string): asserts v { if (!v) throw new Error('joint field successor execution: ' + message); }
const same = (a: unknown, b: unknown) => assert(json(a) === json(b), 'source, original dependency or row differs');
const schema = `CREATE TABLE ${jointFieldSuccessorExecutionTable}(source_id TEXT PRIMARY KEY,recovery_source_id TEXT NOT NULL UNIQUE,workload_view_source_id TEXT NOT NULL UNIQUE,enrollment_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`;
function storage(db: DatabaseSync) {
  const rows = (s: string) => db.prepare(`SELECT type,name,tbl_name,sql FROM ${s}.sqlite_master WHERE lower(name) GLOB 'pa_joint_field_successor_v1_*' OR lower(tbl_name) GLOB 'pa_joint_field_successor_v1_*'`).all();
  assert(rows('temp').length === 0, 'temporary namespace shadow'); const catalog = rows('main'); if (!catalog.length) return false;
  assert(catalog.length === 4, 'partial or extended namespace'); const t = catalog.find(r => r.name === jointFieldSuccessorExecutionTable);
  assert(t?.type === 'table' && t.tbl_name === jointFieldSuccessorExecutionTable && t.sql === schema, 'schema differs');
  const columns = ['source_id', 'recovery_source_id', 'workload_view_source_id', 'enrollment_source_id', 'source_json', 'source_hash', 'snapshot_json', 'snapshot_hash'];
  const actual = db.prepare('PRAGMA main.table_xinfo(' + jointFieldSuccessorExecutionTable + ')').all();
  assert(actual.length === columns.length && actual.every((c, i) => c.cid === i && c.name === columns[i] && c.type === 'TEXT'
    && c.notnull === (i === 0 ? 0 : 1) && c.pk === (i === 0 ? 1 : 0) && c.hidden === 0 && c.dflt_value === null), 'columns differ');
  const indexes = db.prepare('PRAGMA main.index_list(' + jointFieldSuccessorExecutionTable + ')').all(); assert(indexes.length === 3, 'index count differs');
  [['source_id'], ['recovery_source_id'], ['workload_view_source_id']].forEach((keys, i) => {
    const name = 'sqlite_autoindex_' + jointFieldSuccessorExecutionTable + '_' + (i + 1), r = catalog.find(v => v.name === name), ix = indexes.find(v => v.name === name);
    assert(r?.type === 'index' && r.tbl_name === jointFieldSuccessorExecutionTable && r.sql === null && ix?.unique === 1 && ix.partial === 0
      && ix.origin === (i === 0 ? 'pk' : 'u'), 'index identity differs');
    const info = db.prepare('PRAGMA main.index_xinfo(' + name + ')').all(); same(info.filter(c => c.key === 1).map(c => c.name), keys);
    assert(info.length === 2 && info.every(c => c.desc === 0 && c.coll === 'BINARY') && info.at(-1)?.cid === -1, 'index columns differ');
  }); return true;
}
function derive(db: DatabaseSync, source: AcceptedJointFieldSuccessorCommand, current: boolean) {
  const b = (current ? assertCurrentInitialJointRecoveryWorkloadBasisFromSqlite : readInitialJointRecoveryWorkloadContextFromSqlite)(db, source.workloadViewReference);
  same(b.workload.source.recoveryReference, source.recoveryReference);
  const prepared = prepareRecoveredBallFieldRootV1({ version: 'recovered_ball_field_root_v1', recovery: b.recovery.input,
    holdThroughTick: source.throughTick, equipmentId: source.equipmentId, actorProfiles: source.actorProfiles,
    surfaces: source.surfaces, surfaceProfiles: source.surfaceProfiles, baseGeometry: source.baseGeometry });
  const tps = prepared.root.cursor.sourceCurve!.profile.air.ticksPerSecond, start = prepared.root.cursor.moment;
  const duration = (source.throughTick - start.originTick) / tps - start.elapsedSeconds;
  assert(duration > 0 && duration <= 2 && source.modelCalibration.availableAtDay <= b.gameDay, 'finite model interval or availability differs');
  assert(source.participantResponses.length === b.workload.participants.length, 'response population differs');
  const effectiveCapabilities = b.workload.participants.map(p => {
    const r = source.participantResponses.find(r => r.playerId === p.playerId), person = b.originalView.lineage.participantReferences.find(r => r.playerId === p.playerId);
    assert(r && person && r.personHash === person.personHash && r.projectedStateHash === p.projectedStateHash
      && r.availableAtDay <= b.gameDay, 'person/current projected response state differs');
    return { playerId: p.playerId, projectedFatigue: p.projectedState.fatigue, projectedStateHash: p.projectedStateHash,
      ...jointFieldCapabilityAt(r.fatigueSamples, p.projectedState.fatigue) };
  });
  const session = createSourceBallWorldMotionSessionV1(prepared.root);
  const issued = session.adoptMotion({ throughTick: source.throughTick, availableAtElapsedSeconds: start.elapsedSeconds, commands: source.commands });
  for (const a of issued.actors) {
    const c = effectiveCapabilities.find(p => p.playerId === a.playerId); assert(c, 'actor SI response missing');
    const s = a.primitive, speed = s.role === 'glove' ? c.maximumGloveSpeedMps : c.maximumBodySpeedMps;
    assert(Math.hypot(s.acceleration.x, s.acceleration.y, s.acceleration.z) <= c.maximumAccelerationMps2
      && Math.hypot(s.startVelocity.x, s.startVelocity.y, s.startVelocity.z) <= speed
      && Math.hypot(s.startVelocity.x + s.acceleration.x * duration, s.startVelocity.y + s.acceleration.y * duration,
        s.startVelocity.z + s.acceleration.z * duration) <= speed, 'finite actor command exceeds fatigue-adjusted SI response');
  }
  const clearance = proveFiniteFieldActorClearanceV1({ actors: issued.actors, root: prepared.root, durationSeconds: duration,
    footGroundSupport: source.modelCalibration.footGroundSupport });
  const steps: ReturnType<typeof session.advance>[] = [], cadenceTicks = Math.max(1, Math.round(tps * .055));
  let exhausted = false;
  for (let checkpoint = Math.min(source.throughTick, start.ball.tick + cadenceTicks); ; checkpoint = Math.min(source.throughTick, checkpoint + cadenceTicks)) {
    const throughElapsed = (checkpoint - start.originTick) / tps;
    while (session.snapshot().cursor.moment.elapsedSeconds < throughElapsed && !session.snapshot().stopped) {
      assert(steps.length < 4096, 'physical contact/observation scope exhausted');
      const result = session.advance(checkpoint); steps.push(result);
      if (result.kind === 'unresolved') { exhausted = true; break; }
    }
    if (exhausted || session.snapshot().stopped || checkpoint === source.throughTick) break;
  }
  const terminal = session.snapshot(); assert(!exhausted, 'unresolved physical prefix cannot be executed');
  assert(terminal.cursor.moment.elapsedSeconds > start.elapsedSeconds, 'executed prefix must advance actual time');
  return freeze({ kind: 'joint_field_successor_executed_v1' as const, source, lineage: b.recovery.lineage,
    workloadViewReference: source.workloadViewReference, recoveryReference: source.recoveryReference,
    root: prepared.root, issuedState: issued, steps, terminalState: terminal, effectiveCapabilities, clearance,
    issuedAtMoment: start, executedThroughMoment: terminal.cursor.moment, timeline: b.recovery.timeline,
    physicalWork: { kind: 'executed_joint_field_successor_prefix_v1' as const, fromMoment: start, throughMoment: terminal.cursor.moment,
      previousWorkloadViewReference: source.workloadViewReference, assessmentStatus: 'REQUIRES_NEW_CUMULATIVE_WORKLOAD_ASSESSMENT' as const },
    physicalExecutionAdmitted: true as const, motionIssued: true as const, officialResult: null,
    modelBasis: source.modelCalibration.basis, neuralReactionModel: source.modelCalibration.feedback,
    muscleTorqueCalibrated: false as const, requiresPhysicalSuccessor: true as const,
    requiresCumulativeWorkloadReassessment: true as const, nextMotionAllowed: false as const, fullMatchVerified: false as const });
}
export type JointFieldSuccessorExecution = ReturnType<typeof derive>;
const rowFor = (v: JointFieldSuccessorExecution) => ({ source_id: v.source.sourceId, recovery_source_id: v.source.recoveryReference.sourceId,
  workload_view_source_id: v.source.workloadViewReference.sourceId, enrollment_source_id: v.lineage.enrollmentReference.sourceId,
  source_json: json(v.source), source_hash: hash(v.source), snapshot_json: json(v), snapshot_hash: hash(v) });
function read(db: DatabaseSync, id: string) {
  if (!storage(db)) return null;
  const rows = db.prepare(`SELECT * FROM ${jointFieldSuccessorExecutionTable} WHERE source_id=? OR json_extract(source_json,'$.sourceId')=? OR json_extract(snapshot_json,'$.source.sourceId')=?`).all(id, id, id);
  assert(rows.length <= 1, 'duplicate Source identity'); if (!rows.length) return null; const r = rows[0]; assert(r.source_id === id, 'Source index differs');
  const source = jointFieldSuccessorCommandInput(JSON.parse(String(r.source_json)), id), snapshot = JSON.parse(String(r.snapshot_json));
  assert(hash(source) === r.source_hash && hash(snapshot) === r.snapshot_hash, 'Source/snapshot hash differs'); const v = derive(db, source, false); same(r, rowFor(v)); return v;
}
export function readJointFieldSuccessorExecutionFromSqlite(db: DatabaseSync, ref: JointFieldSuccessorExecutionReference) {
  assert(validRef(ref, jointFieldSuccessorExecutionTable), 'invalid execution reference'); const v = read(db, ref.sourceId);
  assert(v, 'original successor execution missing; repair forbidden'); same(reference(jointFieldSuccessorExecutionTable, v), ref); return v;
}
export function openSqliteJointFieldSuccessorExecutionStore(path: string, authority?: Readonly<{ readAcceptedCommand: (id: string) => unknown | null }>) {
  assert(text(path) && (!authority || typeof authority.readAcceptedCommand === 'function'), 'invalid owner');
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const db = new Native(path), tx = battingInvocationTransaction(db, () => storage(db));
  return Object.freeze({ read: (id: string) => tx.run(false, proof => proof(() => read(db, id)), () => {}), accept: (id: string) => {
    assert(text(id), 'invalid Source ID'); const raw = authority?.readAcceptedCommand(id) ?? null, source = raw === null ? null : jointFieldSuccessorCommandInput(raw, id);
    return tx.run(true, (proof, step) => {
      const prior = proof(() => read(db, id)); if (prior) { if (source) same(prior.source, source); return prior; }
      if (!source) return freeze({ kind: 'pending' as const, reason: 'explicit_finite_command_and_projected_si_response_required' });
      proof(() => { if (storage(db)) {
        try {
          assertNoJointPhysicalDescendantClaims(db, 'pa_joint_recovery_v1_executions', source.recoveryReference.sourceId,
            [{ table: jointFieldSuccessorExecutionTable, indexColumn: 'recovery_source_id' }]);
          assertNoJointPhysicalDescendantClaims(db, 'pa_joint_recovery_workload_v1_views', source.workloadViewReference.sourceId,
            [{ table: jointFieldSuccessorExecutionTable, indexColumn: 'workload_view_source_id' }]);
        } catch (cause) { throw new Error('joint field successor execution: physical parent/workload view already consumed or invalid descendant scope', { cause }); }
        const rows = db.prepare(`SELECT source_id FROM ${jointFieldSuccessorExecutionTable} WHERE recovery_source_id=? OR workload_view_source_id=?
          OR json_extract(source_json,'$.recoveryReference.sourceId')=? OR json_extract(source_json,'$.workloadViewReference.sourceId')=?
          OR json_extract(snapshot_json,'$.source.recoveryReference.sourceId')=? OR json_extract(snapshot_json,'$.source.workloadViewReference.sourceId')=?`)
          .all(source.recoveryReference.sourceId, source.workloadViewReference.sourceId, source.recoveryReference.sourceId, source.workloadViewReference.sourceId,
            source.recoveryReference.sourceId, source.workloadViewReference.sourceId);
        assert(rows.length === 0, 'physical parent/workload view already consumed');
      } });
      const v = proof(() => derive(db, source, true)); if (!proof(() => storage(db))) step(() => db.exec(schema), 0, 1);
      const row = rowFor(v); step(() => { assert(db.prepare(`INSERT INTO ${jointFieldSuccessorExecutionTable} VALUES(?,?,?,?,?,?,?,?)`).run(...Object.values(row)).changes === 1, 'exact insert differs'); }, 1);
      same(proof(() => read(db, id)), v); return v;
    }, v => { if (v.kind !== 'pending') same(read(db, id), v); });
  }, close: () => tx.close() });
}
