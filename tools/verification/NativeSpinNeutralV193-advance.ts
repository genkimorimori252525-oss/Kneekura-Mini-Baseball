import { DatabaseSync } from 'node:sqlite';
import { actorJson as json } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { openSqliteSamePlateAppearanceDispatchStore, readSamePaPreparedActionFromSqlite } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { prepareSamePaLifecycleFixture } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
import { authenticateNativeSpinNeutralV193Frontier, readNativeSpinNeutralV193PostObservationRecords } from './NativeSpinNeutralV193-frontier';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw Error('retained V193 lifecycle prerequisite differs'); };
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('retained normal prerequisite missing'); return value; };

/** One normal pending lifecycle advance only. No practice, Actor, source row,
 * physical operation, capture, model or qualification is recreated. */
export function advanceNativeSpinNeutralV193PostObservation(path: string, emit: (stage: string, value?: unknown) => void) {
  const db = new DatabaseSync(path), owners: { close(): void }[] = [];
  const track = <T extends { close(): void }>(owner: T): T => { owners.push(owner); return owner; };
  try {
    const stored = readNativeSpinNeutralV193PostObservationRecords(db, (stage, value) => emit('before-' + stage, value));
    emit('historical-native-joins-ready');
    const prior = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', stored.historical.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('retained prefix owner differs');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), stored.historical.view.source.prefixReference);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', stored.historical.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('retained TOTAL missing'); return value; });
      for (const total of totals) {
        same(reference('pa_lifecycle_v1_total_assessments', total), stored.historical.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
        same(total.source.prefixReference, stored.historical.view.source.prefixReference);
      }
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(stored.viewReference.sourceId).map(row => String(row.source_id)))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('retained lifecycle calibration missing'); return value; });
      if (calibrations.length !== 32) throw Error('retained complete calibration set missing');
      for (const calibration of calibrations) same(calibration.source.viewReference, stored.viewReference);
      const row = must(db.prepare('SELECT source_hash,snapshot_hash FROM main.pa_dispatch_v1_action_plans WHERE source_id=?').get('native-action'));
      const actionReference: SamePaReference<'pa_dispatch_v1_action_plans'> = { owner: 'pa_dispatch_v1_action_plans', sourceId: 'native-action', sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
      const acceptedAction = readSamePaPreparedActionFromSqlite(db, actionReference);
      same(acceptedAction.lineage, prefix.lineage);
      const originalCalibrationIds = db.prepare('SELECT source_id FROM main.pa_dispatch_v1_execution_calibrations WHERE enrollment_source_id=? ORDER BY rowid')
        .all(prefix.lineage.enrollmentReference.sourceId).map(row => String(row.source_id));
      const explicit = calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === stored.actor.binding.playerId);
      if (!explicit || explicit.source.response.kind !== 'accepted_execution_values_v1') throw Error('retained observation response missing');
      return { prefix, totals, calibrations, acceptedAction, originalCalibrationIds,
        explicitBatterObservation: explicit.source.response.values as AcceptedBattingObservationCalibration['values'] };
    }));
    emit('original-lifecycle-inputs-authenticated', prior);
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedCalibrations = dispatch.readCalibrationSet(prior.originalCalibrationIds);
    dispatch.close();
    if (acceptedCalibrations.calibrations.length !== 32) throw Error('normal original dispatch32 set missing');
    emit('original-dispatch32-authenticated', acceptedCalibrations);
    const events = [...prior.prefix.source.eventReferences, stored.observationReference];
    if (events.length !== 4 || prior.prefix.source.eventReferences.some(ref => json(ref) === json(stored.observationReference))) throw Error('retained observation admission frontier differs');
    const efforts = Object.fromEntries(prior.totals.map(total => [total.source.participantReference.playerId, total.source.effortUnits]));
    const label = 'physical-fixture:cut4';
    emit('normal-pending-advance-start', { label, anchorViewReference: prior.prefix.source.anchorViewReference, events, efforts });
    const advanced = prepareSamePaLifecycleFixture({ db, path, acceptedAction: prior.acceptedAction, acceptedCalibrations, x: { f: { track } } },
      prior.prefix.source.anchorViewReference, events, label, efforts, prior.explicitBatterObservation, undefined, undefined, undefined,
      stage => emit('normal-advance-' + stage));
    emit('normal-advance-complete', { prefix: advanced.prefix, totalSet: advanced.totalSet, view: advanced.view, basis: advanced.basis, calibrationSet: advanced.calibrationSet });
    advanced.owner.close();
    const current = authenticateNativeSpinNeutralV193Frontier(db, (stage, value) => emit('after-' + stage, value));
    if (current.lifecycleViewReference.sourceId !== label + ':view' || !current.currentLifecycle
      || json(current.retained.historical.view.cut.operationReference) !== json(stored.observationReference)) throw Error('normal post-observation current frontier differs');
    return { boundary: 'NATIVE_POST_OBSERVATION_ADVANCE_GATE_ONLY', currentCoverageProven: true,
      priorViewReference: stored.viewReference, observationReference: stored.observationReference, viewReference: current.lifecycleViewReference,
      physicalReference: current.physicalReference, qualificationReferences: current.qualificationReferences,
      actorReference: current.actorReference, worldRevision: current.worldRevision, consumerAdoptionProven: false,
      practiceRegenerated: false, physicalOperationCreated: false, performancePass: false };
  } finally { for (const owner of owners.reverse()) owner.close(); db.close(); }
}
