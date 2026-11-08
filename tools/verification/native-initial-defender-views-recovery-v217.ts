import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorJson as json } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readCurrentSamePaLifecycleCalibrationFromSqlite, readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite, openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { openSqliteSamePlateAppearanceLifecycleStore } from '../../src/host/world/SqliteSamePlateAppearanceLifecycleStore';
import { readSamePaExecutionCalibrationFromSqlite } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { readEmotionWorldRevisionFromSqlite } from '../../src/host/world/EmotionWorldRevisionFromSqlite';
import { createSamePaLifecycleFixtureCalibrationSources } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { createSamePaObservationClockProjectionSourcesV212 } from '../../src/host/world/SamePaObservationClockProjectionSourcesV212';
import { deriveSamePaObservationClockProjectionV1 } from '../../src/host/world/SamePlateAppearanceObservationClockProjectionV1';
import type { SamePaLifecyclePrefix, SamePaLifecycleTotal, SamePaLifecycleView, SamePaLifecycleViewBasis } from '../../src/host/world/SamePlateAppearanceLifecycle';
import type { SamePaPhysicalFieldStepSource } from '../../src/host/world/SamePlateAppearancePhysicalEpisode';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { observeNativeInitialDefenderViewsV214 } from './native-initial-defender-views-v214';
import { inventoryNativeInitialDefenderViewsV216, readNormalScopedCalibrationInventoryV216,
  type NativeInitialDefenderInventoryInputV216 } from './native-initial-defender-views-inventory-v216';

type Inventory = ReturnType<typeof inventoryNativeInitialDefenderViewsV216>;
export type NativeInitialDefenderViewsRecoveryInputV217 = Readonly<{ inventoryInput: NativeInitialDefenderInventoryInputV216; retainedInventory: Inventory }>;
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V217 retained normal record or Source differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V217 normal prerequisite missing'); return value; };
export function planRemainingInitialDefenderViewsV217(state: Omit<Inventory['state'], 'phase'> & Readonly<{ phase: string }>) {
  assert.deepEqual(state, { phase: 'SCOPED_CALIBRATION_PENDING', nextIndex: 5, completedCount: 5, acceptedObservationCount: 6,
    acceptedPrefixCount: 6, acceptedTotalRows: 60, acceptedViewCount: 6, acceptedScopedCalibrationCount: 5, remainingAppendRows: 43 }, 'V217 retained phase differs');
  return { recoverCalibrationOnlyCut: 19, observationIndices: [6, 7, 8] as const, retainedStageReacceptCount: 0, physicalHeadCasCount: 3,
    appendCounts: { pa_physical_v1_field_steps: 3, pa_lifecycle_v1_work_prefixes: 3, pa_lifecycle_v1_total_assessments: 30,
      pa_lifecycle_v1_execution_views: 3, pa_lifecycle_v1_execution_calibrations: 4 } };
}

/** Exactly one missing calibration and three remaining actors. Reuses all six
 * committed observations and their already admitted lifecycle rows. */
export function recoverNativeInitialDefenderViewsV217(path: string, input: NativeInitialDefenderViewsRecoveryInputV217, emit: (name: string, value?: unknown) => void) {
  const normal = inventoryNativeInitialDefenderViewsV216(path, input.inventoryInput); same(normal, input.retainedInventory);
  const plan = planRemainingInitialDefenderViewsV217(normal.state);
  assert.equal(normal.currentViewCoversPhysicalHead, true); assert.equal(normal.latestAcceptedViewReference.sourceId, 'physical-fixture:cut19:view');
  assert.equal(normal.latestPhysicalOperation.record.operationOrdinal, 13); assert.equal(normal.latestScopedCalibration, null);
  emit('retained-current-cut19-cal0-and-six-observations-authenticated', normal);
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const db = new Native(path), owners = new Set<{ close(): void }>();
  const track = <T extends { close(): void }>(owner: T): T => { owners.add(owner); return owner; };
  const release = (owner: { close(): void }) => { owner.close(); owners.delete(owner); };
  const snapshot = <T>(read: () => T) => withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, read));
  const heads = () => Object.fromEntries(db.prepare("SELECT name FROM main.sqlite_schema WHERE type='table' AND name LIKE '%_heads' ORDER BY name").all().map(row => {
    const name = String(row.name); return [name, db.prepare('SELECT rowid,* FROM main."' + name.replaceAll('"', '""') + '" ORDER BY rowid').all()];
  }));
  let failure: unknown;
  try {
    const original = normal.original, retained = normal.retainedInput, pins = retained.resumePins, preparation = retained.retainedInputReferences;
    const views = normal.views, modelDeclaration = normal.modelDeclaration;
    const dispatchCalibrations = snapshot(() => original.dispatchCalibrationIds.map(sourceId => {
      const row = must(db.prepare('SELECT source_hash,snapshot_hash FROM main.pa_dispatch_v1_execution_calibrations WHERE source_id=?').get(sourceId));
      return readSamePaExecutionCalibrationFromSqlite(db, { owner: 'pa_dispatch_v1_execution_calibrations', sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) });
    }));
    const acceptedCalibrations = { kind: 'execution_calibration_set' as const, calibrations: dispatchCalibrations,
      calibrationReferences: dispatchCalibrations.map(c => reference('pa_dispatch_v1_execution_calibrations', c)) };
    const sourcesFor = (viewReference: typeof retained.finalViewReference, basis: Pick<SamePaLifecycleViewBasis, 'members'>, cut: number, fieldReference: typeof pins.fieldStepReference) =>
      createSamePaObservationClockProjectionSourcesV212(createSamePaLifecycleFixtureCalibrationSources(acceptedCalibrations, viewReference, basis, 'physical-fixture:cut' + cut, original.observationValues),
        { fieldReference, targetTicksPerSecond: 1_000_000, originals: original.observationClockOriginals });
    const expectedHeads = (ref: typeof pins.fieldStepReference, ordinal: number) => ({ ...normal.allHeads,
      pa_physical_v1_heads: normal.allHeads.pa_physical_v1_heads.map(h => ({ ...h, operation_ordinal: ordinal, last_owner: ref.owner, last_source_id: ref.sourceId, last_snapshot_hash: ref.snapshotHash })) });
    const efforts = Object.fromEntries(original.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    let current = must(normal.latestNormalCurrent), currentReference = normal.latestAcceptedViewReference, previousReference = normal.latestPhysicalReference;
    let previous = normal.latestPhysicalOperation.record;
    if (previous.kind !== 'same_pa_physical_field_step_v1') throw Error('V217 normal retained observation missing');
    let eventReferences = [...normal.eventReferences]; const resumePins = { ...normal.resumePins };
    let newObservationAcceptanceCount = 0, newPrefixAcceptanceCount = 0, newTotalAcceptanceRowCount = 0, newViewAcceptanceCount = 0, newScopedCalibrationAcceptanceCount = 0;
    const recoveredSource = must(sourcesFor(currentReference, current, 19, previousReference).find(s => s.route === 'defender_observation' && s.member.playerId === views[6].playerId));
    snapshot(() => { same(readCurrentSamePaLifecycleViewFromSqlite(db, currentReference), current);
      assert.equal(readNormalScopedCalibrationInventoryV216(db, recoveredSource.sourceId, currentReference.sourceId), null);
      same(readSamePaPhysicalOperationFromSqlite(db, previousReference).record, previous); same(heads(), normal.allHeads); });
    const recovery = track(openSqliteSamePlateAppearanceLifecycleStore(path, { readAcceptedCalibration: id => id === recoveredSource.sourceId ? recoveredSource : null }));
    const recoveredCalibration = recovery.acceptDefenderExecutionCalibrationV1(recoveredSource.sourceId); newScopedCalibrationAcceptanceCount++;
    if (recoveredCalibration.kind !== 'same_pa_lifecycle_calibration') throw Error('V217 normal retained scoped calibration pending'); release(recovery);
    type Observation = ReturnType<typeof observeNativeInitialDefenderViewsV214>['observations'][number];
    const observations: Observation[] = normal.iterations.slice(0, 6).map((item, index) => {
      const observation = must(item.observation), actionResult = must(observation.actionResult), view = must(item.view);
      const calibration = index === 5 ? recoveredCalibration : must(item.scopedCalibration);
      if (actionResult.kind !== 'defender_observation_v1' || view.kind !== 'same_pa_lifecycle_view' || calibration.kind !== 'same_pa_lifecycle_calibration') throw Error('V217 retained completed observation graph differs');
      return { playerId: item.playerId, observationReference: must(item.observationReference), observationSource: must(item.observationSource), observation, actionResult,
        receipt: actionResult.receipt, precedingLifecycleViewReference: must(item.precedingLifecycleViewReference), inputCalibrationReference: must(item.inputCalibrationReference),
        finalViewReference: reference('pa_lifecycle_v1_execution_views', view), scopedCalibrationReference: reference('pa_lifecycle_v1_execution_calibrations', calibration) };
    });
    const checkpoint = (viewReference: typeof currentReference, calibration: typeof recoveredCalibration, physicalReference: typeof previousReference, ordinal: number) => snapshot(() => {
      const finalCurrent = readCurrentSamePaLifecycleViewFromSqlite(db, viewReference), finalHistorical = readHistoricalSamePaLifecycleViewFromSqlite(db, viewReference); same(finalCurrent, finalHistorical);
      same(finalCurrent.view.cut.operationReference, physicalReference); same(finalCurrent.view.cut.physicalOperationReference, physicalReference); assert.equal(finalCurrent.view.cut.stage, 'field_active');
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', finalCurrent.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V217 normal prefix missing'); same(prefix.source.eventReferences, eventReferences);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', finalCurrent.view.source.participantTotalReferences.map(t => t.assessmentReference.sourceId)); assert.equal(totals.length, 10);
      if (totals.some(t => t?.kind !== 'same_pa_lifecycle_total')) throw Error('V217 normal TOTAL set missing');
      const scopedCalibrationReference = reference('pa_lifecycle_v1_execution_calibrations', calibration), scopedCalibration = readCurrentSamePaLifecycleCalibrationFromSqlite(db, scopedCalibrationReference);
      same(scopedCalibration, calibration); same(scopedCalibration.source.viewReference, viewReference);
      same(readNormalScopedCalibrationInventoryV216(db, calibration.source.sourceId, viewReference.sourceId), scopedCalibration);
      const projectionProof = deriveSamePaObservationClockProjectionV1(db, scopedCalibration.source, finalCurrent); same(projectionProof.evidence, scopedCalibration.observationClockProjection);
      same(projectionProof.evidence.fieldReference, physicalReference); assert.equal(projectionProof.evidence.targetTicksPerSecond, 1_000_000);
      const currentPhysicalOperation = readSamePaPhysicalOperationFromSqlite(db, physicalReference); assert.equal(currentPhysicalOperation.record.operationOrdinal, ordinal);
      const allHeads = heads(); same(allHeads, expectedHeads(physicalReference, ordinal));
      const world = must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId)); same(world, original.world);
      return { boundary: 'NATIVE_INITIAL_DEFENDER_VIEWS_RECOVERY_INTERMEDIATE_CHECKPOINT' as const, retainedInputReferences: preparation, resumePins: { ...resumePins },
        finalViewReference: viewReference, finalCurrent, finalHistorical, finalPrefixReference: reference('pa_lifecycle_v1_work_prefixes', prefix), prefix, totals,
        calibrations: [scopedCalibration], calibrationReferences: [scopedCalibrationReference], scopedCalibration, scopedCalibrationReference, projectionProof,
        eventReferences: [...eventReferences], observations: [...observations], currentPhysicalOperation, physicalHeads: allHeads.pa_physical_v1_heads, allHeads, world,
        modelDeclaration, views, nextPlayerId: scopedCalibration.source.member.playerId, normalLifecycleAdvances: newViewAcceptanceCount,
        finalLifecycleCurrentProven: true, initialDefenderObservationCount: observations.length, scopedDefenderCalibrationCount: 5 + newScopedCalibrationAcceptanceCount,
        newObservationAcceptanceCount, newPrefixAcceptanceCount, newTotalAcceptanceRowCount, newViewAcceptanceCount, newScopedCalibrationAcceptanceCount,
        retainedStageReacceptCount: 0, otherRoutesFullReady: false, allRoutesReady: false };
    });
    const recoveredCheckpoint = checkpoint(currentReference, recoveredCalibration, previousReference, 13);
    emit('normal-cut19-recovered-scoped-calibration-physical-world-checkpoint', recoveredCheckpoint);
    let currentScopedCalibration = recoveredCheckpoint.scopedCalibration, finalCheckpoint = recoveredCheckpoint;
    for (const index of plan.observationIndices) {
      const initial = views[index], inputCalibration = snapshot(() => readCurrentSamePaLifecycleCalibrationFromSqlite(db, reference('pa_lifecycle_v1_execution_calibrations', currentScopedCalibration)));
      same(inputCalibration, currentScopedCalibration); assert.equal(inputCalibration.source.member.playerId, initial.playerId); assert.equal(inputCalibration.source.route, 'defender_observation');
      const inputCalibrationReference = reference('pa_lifecycle_v1_execution_calibrations', inputCalibration), precedingLifecycleViewReference = currentReference;
      const observationSource: SamePaPhysicalFieldStepSource = { sourceId: 'native-initial-defender-views-v214:observation:' + initial.playerId,
        sourceVersion: preparation.futureProfileDeclarationOnly.futureFieldStepSourceVersion, capability: 'same_pa_physical_field_step_v1', viewReference: currentReference,
        launchReference: pins.launchReference, previousOperationReference: previousReference, fieldRootReference: pins.fieldRootReference, previousFieldReference: previousReference,
        throughTick: previous.evaluationTick, action: { kind: 'defender_observation_v1', member: must(current.members.find(m => m.playerId === initial.playerId)),
          calibrationReference: inputCalibrationReference, previousObservationReference: null, view: initial.view } };
      const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => id === observationSource.sourceId ? observationSource : null }));
      const observation = physical.acceptOperation(observationSource.sourceId); newObservationAcceptanceCount++; release(physical);
      if (observation.kind !== 'same_pa_physical_field_step_v1' || observation.actionResult?.kind !== 'defender_observation_v1' || observation.operationOrdinal !== 8 + index) throw Error('V217 normal remaining observation pending');
      const observationReference = reference('pa_physical_v1_field_steps', observation), actionResult = observation.actionResult;
      same(observation.field, original.fieldStep.field); same(observation.timeline, original.fieldStep.timeline); assert.equal(observation.evaluationTick, original.fieldStep.evaluationTick);
      same(actionResult.samplingRequest.view, initial.view); assert.equal(actionResult.samplingRequest.previousObservationSourceId, null);
      eventReferences = [...eventReferences, observationReference]; resumePins['defenderObservationReference' + (index + 1)] = observationReference;
      snapshot(() => { same(readSamePaPhysicalOperationFromSqlite(db, observationReference).record, observation); same(heads(), expectedHeads(observationReference, 8 + index)); });
      emit('normal-defender-observation-' + (index + 1) + '-accepted-before-lifecycle', { observationReference, observationSource, observation,
        precedingLifecycleViewReference, inputCalibrationReference, eventReferences, resumePins: { ...resumePins }, normalLifecycleAdvances: newViewAcceptanceCount,
        anchorViewReference: original.prefix.source.anchorViewReference, modelDeclaration, views });
      const cut = 14 + index, label = 'physical-fixture:cut' + cut, accepted = new Map<string, unknown>();
      const lifecycle = track(openSqliteSamePlateAppearanceLifecycleStore(path, { readAcceptedPrefix: id => accepted.get(id), readAcceptedTotal: id => accepted.get(id),
        readAcceptedView: id => accepted.get(id), readAcceptedCalibration: id => accepted.get(id) }));
      const prefixSource: SamePaLifecyclePrefix['source'] = { sourceId: label + ':prefix', sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_prefix_v1',
        enrollmentReference: original.acceptedAction.source.enrollmentReference, anchorViewReference: original.prefix.source.anchorViewReference, eventReferences };
      accepted.set(prefixSource.sourceId, prefixSource); const prefix = lifecycle.acceptPrefix(prefixSource.sourceId); newPrefixAcceptanceCount++;
      if (prefix.kind === 'pending') throw Error('V217 normal remaining prefix pending'); const prefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix);
      const totalSources: SamePaLifecycleTotal['source'][] = prefix.lineage.participantReferences.map(p => ({ sourceId: label + ':total:' + p.playerId, sourceVersion: 'fixture-only-v1',
        capability: 'same_pa_lifecycle_cumulative_total_v1', enrollmentReference: prefix.lineage.enrollmentReference, prefixReference, participantReference: p, effortUnits: efforts[p.playerId],
        provenance: { assessmentSourceId: label + ':assessment:' + p.playerId, assessmentVersion: 'fixture-only-v1', calibrationSourceId: label + ':explicit-total', calibrationVersion: 'fixture-only-v1' } }));
      totalSources.forEach(s => accepted.set(s.sourceId, s)); const totalSet = lifecycle.acceptTotalSet(totalSources.map(s => s.sourceId)); newTotalAcceptanceRowCount += 10;
      if (totalSet.kind !== 'same_pa_lifecycle_total_set') throw Error('V217 normal remaining TOTAL set pending');
      const viewSource: SamePaLifecycleView['source'] = { sourceId: label + ':view', sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_cumulative_view_v1',
        enrollmentReference: prefix.lineage.enrollmentReference, prefixReference, participantTotalReferences: totalSet.participantTotalReferences };
      accepted.set(viewSource.sourceId, viewSource); const view = lifecycle.acceptView(viewSource.sourceId); newViewAcceptanceCount++;
      if (view.kind === 'pending') throw Error('V217 normal remaining view pending');
      const viewReference = reference('pa_lifecycle_v1_execution_views', view), basis = snapshot(() => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
      const scopedSource = must(sourcesFor(viewReference, basis, cut, observationReference).find(s => s.route === 'defender_observation' && s.member.playerId === views[(index + 1) % 9].playerId));
      accepted.set(scopedSource.sourceId, scopedSource); const scopedCalibration = lifecycle.acceptDefenderExecutionCalibrationV1(scopedSource.sourceId); newScopedCalibrationAcceptanceCount++;
      if (scopedCalibration.kind !== 'same_pa_lifecycle_calibration') throw Error('V217 normal remaining scoped calibration pending'); release(lifecycle);
      observations.push({ playerId: initial.playerId, observationReference, observationSource, observation, actionResult, receipt: actionResult.receipt,
        precedingLifecycleViewReference, inputCalibrationReference, finalViewReference: viewReference, scopedCalibrationReference: reference('pa_lifecycle_v1_execution_calibrations', scopedCalibration) });
      finalCheckpoint = checkpoint(viewReference, scopedCalibration, observationReference, 8 + index);
      emit('normal-cut' + cut + '-current-scoped-calibration-physical-world-checkpoint', finalCheckpoint);
      currentScopedCalibration = finalCheckpoint.scopedCalibration; current = finalCheckpoint.finalCurrent; currentReference = viewReference; previousReference = observationReference; previous = observation;
    }
    assert.equal(newObservationAcceptanceCount, 3); assert.equal(newPrefixAcceptanceCount, 3); assert.equal(newTotalAcceptanceRowCount, 30); assert.equal(newViewAcceptanceCount, 3); assert.equal(newScopedCalibrationAcceptanceCount, 4);
    const result = { ...finalCheckpoint, boundary: 'NATIVE_INITIAL_DEFENDER_VIEWS_RECOVERY_CHECKPOINT_ONLY' as const, originalInputs: original, normalOriginal: original,
      worldBefore: original.world, worldAfter: finalCheckpoint.world, initialDefenderObservationsAccepted: true, initialDefenderObservationCount: 9, scopedDefenderCalibrationCount: 9,
      firstObservationHistoryProven: true, recoveredCalibrationOnlyCount: 1, reusedObservationCount: 6, reusedPrefixCount: 6, reusedTotalRows: 60, reusedViewCount: 6, reusedScopedCalibrationCount: 5,
      originalFailedRunCompleted: false, originalFailedRunEndPinsClaimed: false, rawGazeRestored: false, continuingGazeProven: false, empiricallyCalibrated: false,
      nativePostInitialDefenderObservationConsumerProven: false, nativeResumeAdapterRequired: true, resumeReady: false, defensiveAiAccepted: false,
      legalOutcomeProven: false, officialTerminalProven: false, fullContinuationComplete: false, wholeRngConsumptionProven: false, performancePass: false };
    assert.equal(result.finalViewReference.sourceId, 'physical-fixture:cut22:view'); assert.equal(result.eventReferences.length, 22); assert.equal(Object.keys(result.resumePins).length, 25);
    emit('normal-initial-defender-views-recovered-cut22-authenticated', result); return result;
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = []; for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V217 owner cleanup failed');
  }
}
