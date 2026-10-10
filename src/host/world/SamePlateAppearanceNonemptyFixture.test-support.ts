import type { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import type { SamePaExecutedPitch } from './SamePlateAppearanceDispatchExecution';
import type { SamePaContinuationInvocationReference } from './SamePlateAppearanceContinuation';
import { openSqliteSamePlateAppearanceContinuationStore } from './SqliteSamePlateAppearanceContinuationStore';
import { readCurrentSamePaContinuationViewFromSqlite } from './SamePlateAppearanceContinuationFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

/** Real synthetic Source acceptance only. Every participant TOTAL must be
 * supplied explicitly by the test. Response values are the existing separately
 * declared32 fixture values, never a production fatigue mapping/default. */
export const prepareSamePaNonemptyFixture = (f: ReturnType<typeof directNativeDispatchFixture>, pitch: SamePaExecutedPitch,
  label: string, effortUnitsByPlayer: Readonly<Record<string, number>>, operationReferences: readonly SamePaContinuationInvocationReference[]) => {
  const accepted = new Map<string, unknown>();
  const owner = f.x.f.track(openSqliteSamePlateAppearanceContinuationStore(f.path, { readAcceptedPrefix: id => accepted.get(id),
    readAcceptedTotal: id => accepted.get(id), readAcceptedView: id => accepted.get(id), readAcceptedCalibration: id => accepted.get(id) }));
  const prefixSource = { sourceId: label + ':prefix', sourceVersion: 'fixture-only-v1', capability: 'same_pa_completed_take_prefix_v1',
    enrollmentReference: pitch.lineage.enrollmentReference, originalViewReference: pitch.viewReference, pitchReference: reference('pa_dispatch_v1_pitch_actions', pitch), operationReferences };
  accepted.set(prefixSource.sourceId, prefixSource); const prefix = owner.acceptPrefix(prefixSource.sourceId);
  if (prefix.kind === 'pending') throw new Error('Native nonempty fixture prefix pending');
  const prefixReference = reference('pa_continuation_v1_work_prefixes', prefix);
  const totals = prefix.lineage.participantReferences.map(p => ({ sourceId: label + ':total:' + p.playerId, sourceVersion: 'fixture-only-v1',
    capability: 'same_pa_nonempty_cumulative_total_v1', enrollmentReference: prefix.lineage.enrollmentReference, prefixReference,
    participantReference: p, effortUnits: effortUnitsByPlayer[p.playerId], provenance: { assessmentSourceId: label + ':total-assessment:' + p.playerId,
      assessmentVersion: 'fixture-only-v1', calibrationSourceId: label + ':explicit-total-declaration', calibrationVersion: 'fixture-only-v1' } }));
  totals.forEach(s => accepted.set(s.sourceId, s)); const totalSet = owner.acceptTotalSet(totals.map(s => s.sourceId));
  if (totalSet.kind !== 'nonempty_total_set') throw new Error('Native nonempty fixture TOTAL set pending');
  const viewSource = { sourceId: label + ':view', sourceVersion: 'fixture-only-v1', capability: 'same_pa_nonempty_cumulative_view_v1', enrollmentReference: prefix.lineage.enrollmentReference,
    prefixReference, participantTotalReferences: totalSet.participantTotalReferences };
  accepted.set(viewSource.sourceId, viewSource); const view = owner.acceptView(viewSource.sourceId);
  if (view.kind === 'pending') throw new Error('Native nonempty fixture view pending');
  const viewReference = reference('pa_continuation_v1_execution_views', view), basis = withSqliteReadTransaction(f.db, () => readCurrentSamePaContinuationViewFromSqlite(f.db, viewReference));
  const calibrations = f.acceptedCalibrations.calibrations.map(c => ({ ...c.source, sourceId: label + ':' + c.source.sourceId,
    capability: 'same_pa_nonempty_execution_calibration_v1', viewReference, member: basis.members.find(m => m.playerId === c.source.member.playerId)!,
    provenance: { ...c.source.provenance, assessmentSourceId: label + ':' + c.source.provenance.assessmentSourceId } }));
  calibrations.forEach(s => accepted.set(s.sourceId, s)); const calibrationSet = owner.acceptCalibrationSet(calibrations.map(s => s.sourceId));
  if (calibrationSet.kind !== 'nonempty_calibration_set') throw new Error('Native nonempty fixture32 response set pending');
  return { owner, accepted, prefixSource, prefix, prefixReference, totals, totalSet, viewSource, view, viewReference, basis, calibrations, calibrationSet };
};
