import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite,
  readHistoricalSamePaLifecycleViewFromSqlite, readCurrentSamePaLifecycleViewFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { openSqliteSamePlateAppearanceDispatchStore, readSamePaPreparedActionFromSqlite } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { prepareSamePaLifecycleFixture } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { SamePaLifecyclePrefix } from '../../src/host/world/SamePlateAppearanceLifecycle';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

type Input = Readonly<{ actorReference: SamePaReference<'physical_plate_appearance_actors'>;
  resolutionReference: SamePaReference<'pa_physical_v1_resolutions'>;
  priorViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>; expectedPrefixSource: SamePaLifecyclePrefix['source'] }>;
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'retained cut11 original ownership differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('retained cut11 normal prerequisite missing'); return value; };
const locator = <O extends string>(db: DatabaseSync, owner: O, sourceId: string): SamePaReference<O> => {
  const row = must(db.prepare(`SELECT source_hash,snapshot_hash FROM main."${owner}" WHERE source_id=?`).get(sourceId));
  return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
};

/** One new normal lifecycle completion step. Accepted physical operations and
 * practice remain immutable ancestry; historical cut10 is never called current. */
export function completeNativeSpinNeutralCut11V195(path: string, input: Input, emit: (stage: string, value?: unknown) => void) {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const db = new Native(path), owners = new Set<{ close(): void }>();
  const track = <T extends { close(): void }>(owner: T): T => { owners.add(owner); return owner; };
  const release = (owner: { close(): void }) => { owner.close(); owners.delete(owner); };
  try {
    const retained = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const actor = must(readPhysicalPlateAppearanceActorFromSqlite(db, input.actorReference.sourceId));
      same(reference('physical_plate_appearance_actors', actor), input.actorReference);
      const physical = readSamePaPhysicalOperationFromSqlite(db, input.resolutionReference);
      if (physical.record.kind !== 'same_pa_physical_resolution_v1') throw Error('cut11 requires its accepted resolution');
      same(physical.actor, actor); same(physical.lineage.actorReference, input.actorReference);
      same(physical.record.source.viewReference, input.priorViewReference);
      const prior = readHistoricalSamePaLifecycleViewFromSqlite(db, input.priorViewReference);
      same(prior.actor, actor); assert.equal(prior.view.source.sourceId, 'physical-fixture:cut10:view');
      const previous = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', prior.view.source.prefixReference.sourceId));
      const pending = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', 'physical-fixture:cut11:prefix'));
      if (previous.kind !== 'same_pa_lifecycle_prefix' || pending.kind !== 'same_pa_lifecycle_prefix') throw Error('cut11 normal prefix kind differs');
      same(reference('pa_lifecycle_v1_work_prefixes', previous), prior.view.source.prefixReference);
      same(pending.source, input.expectedPrefixSource);
      same(pending.source, { ...previous.source, sourceId: 'physical-fixture:cut11:prefix', eventReferences: [...previous.source.eventReferences, input.resolutionReference] });
      same(pending.previousViewReference, input.priorViewReference); same(pending.lineage, previous.lineage); same(pending.lineage, physical.lineage);
      same(pending.cut.operationReference, input.resolutionReference); same(pending.cut.physicalOperationReference, input.resolutionReference);
      emit('stored-prefix11-authenticated', { prefixReference: reference('pa_lifecycle_v1_work_prefixes', pending), prefix: pending,
        resolutionReference: input.resolutionReference, resolution: physical.record, historicalCut10ViewReference: input.priorViewReference });
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', prior.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('cut10 original TOTAL missing'); return value; });
      for (const total of totals) {
        same(reference('pa_lifecycle_v1_total_assessments', total), prior.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
        same(total.source.prefixReference, prior.view.source.prefixReference);
      }
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(input.priorViewReference.sourceId).map(row => String(row.source_id)))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('cut10 original calibration missing'); return value; });
      assert.equal(calibrations.length, 32); for (const calibration of calibrations) same(calibration.source.viewReference, input.priorViewReference);
      const observation = must(calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === actor.binding.playerId));
      if (observation.source.response.kind !== 'accepted_execution_values_v1') throw Error('cut10 explicit observation response missing');
      const explicitBatterObservation = observation.source.response.values as AcceptedBattingObservationCalibration['values'];
      const errors = explicitBatterObservation.calibration.errorParameters;
      for (const key of ['minimumPositionErrorMeters', 'maximumPositionErrorMeters', 'minimumVelocityErrorMps', 'maximumVelocityErrorMps'] as const) assert.equal(errors[key], 0);
      const acceptedAction = readSamePaPreparedActionFromSqlite(db, locator(db, 'pa_dispatch_v1_action_plans', 'native-action'));
      same(acceptedAction.lineage, pending.lineage);
      const originalCalibrationIds = db.prepare('SELECT source_id FROM main.pa_dispatch_v1_execution_calibrations WHERE enrollment_source_id=? ORDER BY rowid')
        .all(pending.lineage.enrollmentReference.sourceId).map(row => String(row.source_id));
      return { actor, pending, totals, calibrations, acceptedAction, originalCalibrationIds, explicitBatterObservation };
    }));
    emit('cut10-original-inputs-authenticated', { totals: retained.totals, calibrations: retained.calibrations,
      acceptedAction: retained.acceptedAction, observationValues: retained.explicitBatterObservation });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path)), acceptedCalibrations = dispatch.readCalibrationSet(retained.originalCalibrationIds); release(dispatch);
    assert.equal(acceptedCalibrations.calibrations.length, 32); emit('original-dispatch32-authenticated', acceptedCalibrations);
    const label = 'physical-fixture:cut11', efforts = Object.fromEntries(retained.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    const f = { db, path, acceptedAction: retained.acceptedAction, acceptedCalibrations, x: { f: { track } } };
    emit('normal-cut11-completion-start', { prefixReference: reference('pa_lifecycle_v1_work_prefixes', retained.pending),
      source: retained.pending.source, efforts, resolutionReference: input.resolutionReference });
    const locatorsAtStage = (stage: string) => {
      const tables = ['pa_lifecycle_v1_work_prefixes', 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_views', 'pa_lifecycle_v1_execution_calibrations'];
      const references = tables.flatMap(owner => db.prepare(`SELECT source_id,source_hash,snapshot_hash FROM main.${owner} WHERE source_id LIKE ? ORDER BY rowid`)
        .all(label + ':%').map(row => ({ owner, sourceId: String(row.source_id), sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) })));
      emit('normal-cut11-' + stage, { boundary: 'INERT_STORAGE_LOCATORS_ONLY_REQUIRE_OWNER_REAUTHENTICATION', references });
    };
    // The original owner decides replay/partial-set rejection. No missing row
    // is inserted separately and no alternate Source ID can heal a partial set.
    const completed = prepareSamePaLifecycleFixture(f, retained.pending.source.anchorViewReference, retained.pending.source.eventReferences,
      label, efforts, retained.explicitBatterObservation, undefined, undefined, undefined, locatorsAtStage);
    same(completed.prefix, retained.pending);
    emit('normal-cut11-accepted', { prefixReference: completed.prefixReference, prefix: completed.prefix, totalSet: completed.totalSet,
      viewReference: completed.viewReference, view: completed.view, calibrationSet: completed.calibrationSet });
    release(completed.owner);
    const current = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, completed.viewReference)));
    same(current.actor, retained.actor); same(current.view, completed.view);
    same(current.view.cut.operationReference, input.resolutionReference); same(current.view.cut.physicalOperationReference, input.resolutionReference);
    assert.equal(current.view.cut.stage, 'resolved');
    emit('normal-cut11-current-coverage-authenticated', { viewReference: completed.viewReference, current });
    return { boundary: 'NATIVE_CUT11_LIFECYCLE_COMPLETION_ONLY', currentCoverageProven: true, viewReference: completed.viewReference,
      prefixReference: completed.prefixReference, resolutionReference: input.resolutionReference, actorReference: input.actorReference,
      participantCount: retained.totals.length, calibrationCount: completed.calibrationSet.calibrations.length,
      newPhysicalOperationsAccepted: 0, newPracticeAccepted: 0, twoTakeReplayAccepted: 0, suffixScenarioReexecuted: false,
      originalSuffixSourceEndPin: 'UNKNOWN', secondNativeControlBranchProven: false, officialTerminalProven: false,
      wholeRngConsumptionProven: false, productionMasteryCalibrationProven: false, naturalGoldRarityProven: false, performancePass: false };
  } finally { for (const owner of [...owners].reverse()) owner.close(); db.close(); }
}
