import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { cloneInert } from '../../src/core/adjudication/OfficialWindowPolicy';
import { actorJson as json } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite, readCurrentSamePaLifecycleCalibrationFromSqlite,
  readSamePaLifecycleCalibrationFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite, openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { openSqliteSamePlateAppearanceLifecycleStore } from '../../src/host/world/SqliteSamePlateAppearanceLifecycleStore';
import { readSamePaExecutionCalibrationFromSqlite } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { createSamePaLifecycleFixtureCalibrationSources } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { readEmotionWorldRevisionFromSqlite } from '../../src/host/world/EmotionWorldRevisionFromSqlite';
import type { SamePaPhysicalFieldStepSource } from '../../src/host/world/SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecyclePrefix, SamePaLifecycleTotal, SamePaLifecycleView } from '../../src/host/world/SamePlateAppearanceLifecycle';
import { inventoryNativeInitialDefenderViewsV216, type NativeInitialDefenderInventoryInputV216 } from './native-initial-defender-views-inventory-v216';
import type { observeNativeInitialDefenderViewsV214 } from './native-initial-defender-views-v214';

export type NativeInitialDefenderDecisionInputV219 = Readonly<{
  inventoryInput: NativeInitialDefenderInventoryInputV216;
  retained: Pick<ReturnType<typeof observeNativeInitialDefenderViewsV214>, 'originalInputs' | 'retainedInputReferences' | 'resumePins' |
    'finalViewReference' | 'eventReferences' | 'modelDeclaration' | 'views' | 'observations'>;
  decisionModelDeclaration: unknown;
}>;
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V219 normal record, Source or model differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V219 normal prerequisite missing'); return value; };

/** A new explicit game policy, not an original team assignment or a calibrated
 * AI claim. Only the six literals of the older Native helper are reused; its
 * nearest/true-ball observer selection and movement helper are never invoked. */
export function createInitialDefenderDecisionModelV219() {
  return Object.freeze({ sourceId: 'native-initial-defender-decision-v219:nominal-pursuit-hold-model',
    sourceVersion: 'same_pa_nominal_initial_pursuit_hold_decision_v219',
    evidenceAuthority: 'EXPLICIT_UNCALIBRATED_GAME_NOMINAL_PREPLAY_PLAN', empiricallyCalibrated: false,
    scope: 'FIRST_RETAINED_DEFENDER_DECISION_ONLY', actorSelection: 'INITIAL_VIEW_ORDER_FIRST_ACTOR',
    priorities: Object.freeze({ ballPursuitPriority: 1, baseCoverPriorities: Object.freeze([]), relayPriority: 0,
      backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0 }) });
}
export function validateInitialDefenderDecisionModelV219(raw: unknown) {
  const expected = createInitialDefenderDecisionModelV219(); same(cloneInert(raw), expected); return expected;
}

/** One decision-calibration declaration, one normal decision, one lifecycle
 * admission. Perception, intent, timing and target are all normal Owner output. */
export function acceptNativeInitialDefenderDecisionV219(path: string, input: NativeInitialDefenderDecisionInputV219, emit: (name: string, value?: unknown) => void) {
  const normal = inventoryNativeInitialDefenderViewsV216(path, input.inventoryInput), retained = input.retained;
  assert.deepEqual(normal.state, { phase: 'COMPLETE', nextIndex: 9, completedCount: 9, acceptedObservationCount: 9,
    acceptedPrefixCount: 9, acceptedTotalRows: 90, acceptedViewCount: 9, acceptedScopedCalibrationCount: 9, remainingAppendRows: 0 });
  same(normal.original, retained.originalInputs); same(normal.retainedInput.retainedInputReferences, retained.retainedInputReferences);
  same(normal.resumePins, retained.resumePins); same(normal.eventReferences, retained.eventReferences);
  same(normal.latestAcceptedViewReference, retained.finalViewReference); same(normal.modelDeclaration, retained.modelDeclaration); same(normal.views, retained.views);
  assert.equal(normal.latestAcceptedViewReference.sourceId, 'physical-fixture:cut22:view'); assert.equal(normal.latestPhysicalOperation.record.operationOrdinal, 16);
  assert.equal(normal.currentViewCoversPhysicalHead, true); assert.equal(Object.keys(normal.resumePins).length, 25);
  for (const [index, item] of normal.iterations.entries()) {
    const saved = must(retained.observations[index]); same(item.observation, saved.observation); same(item.observationSource, saved.observationSource);
    same(item.observationReference, saved.observationReference); same(item.inputCalibrationReference, saved.inputCalibrationReference);
  }
  assert.equal(retained.observations.length, 9);
  const decisionModelDeclaration = validateInitialDefenderDecisionModelV219(input.decisionModelDeclaration);
  const first = normal.iterations[0], playerId = normal.views[0].playerId, ownObservation = must(first.observation), observationReference = must(first.observationReference);
  assert.equal(first.playerId, playerId); assert.equal(ownObservation.operationOrdinal, 8);
  if (ownObservation.actionResult?.kind !== 'defender_observation_v1') throw Error('V219 first owned observation missing');
  const prior = normal.latestPhysicalOperation.record;
  if (prior.kind !== 'same_pa_physical_field_step_v1') throw Error('V219 normal preceding physical step missing');
  const priorReference = normal.latestPhysicalReference, currentReference = normal.latestAcceptedViewReference, current = must(normal.latestNormalCurrent);
  same(current.view.cut.physicalOperationReference, priorReference);
  assert.equal(normal.original.action.source.nominalPitch.delivery.matchSeed, 19);
  emit('retained-current-cut22-nine-observations-authenticated', { normal, retained, decisionModelDeclaration, playerId });
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
    const original = normal.original, member = must(current.members.find(m => m.playerId === playerId));
    const dispatchCalibrations = snapshot(() => original.dispatchCalibrationIds.map(sourceId => {
      const row = must(db.prepare('SELECT source_hash,snapshot_hash FROM main.pa_dispatch_v1_execution_calibrations WHERE source_id=?').get(sourceId));
      return readSamePaExecutionCalibrationFromSqlite(db, { owner: 'pa_dispatch_v1_execution_calibrations', sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) });
    }));
    const acceptedCalibrations = { kind: 'execution_calibration_set' as const, calibrations: dispatchCalibrations,
      calibrationReferences: dispatchCalibrations.map(c => reference('pa_dispatch_v1_execution_calibrations', c)) };
    const declarations = createSamePaLifecycleFixtureCalibrationSources(acceptedCalibrations, currentReference, current,
      'native-initial-defender-decision-v219:cut22', original.observationValues);
    const calibrationSource = must(declarations.find(c => c.route === 'defender_decision' && c.member.playerId === playerId));
    const accepted = new Map<string, unknown>([[calibrationSource.sourceId, calibrationSource]]);
    const lifecycle = track(openSqliteSamePlateAppearanceLifecycleStore(path, { readAcceptedCalibration: id => accepted.get(id),
      readAcceptedPrefix: id => accepted.get(id), readAcceptedTotal: id => accepted.get(id), readAcceptedView: id => accepted.get(id) }));
    const decisionCalibration = lifecycle.acceptDefenderExecutionCalibrationV1(calibrationSource.sourceId);
    if (decisionCalibration.kind !== 'same_pa_lifecycle_calibration') throw Error('V219 decision calibration pending');
    release(lifecycle);
    const decisionCalibrationReference = reference('pa_lifecycle_v1_execution_calibrations', decisionCalibration);
    snapshot(() => { same(readCurrentSamePaLifecycleViewFromSqlite(db, currentReference), current);
      same(readCurrentSamePaLifecycleCalibrationFromSqlite(db, decisionCalibrationReference), decisionCalibration);
      same(decisionCalibration.source, calibrationSource); same(heads(), normal.allHeads);
      same(must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId)), normal.world); });
    emit('normal-cut22-decision-calibration-accepted', { decisionCalibration, decisionCalibrationReference, calibrationSource,
      currentViewReference: currentReference, playerId, observationReference, priorPhysicalReference: priorReference, decisionModelDeclaration });
    const decisionSource: SamePaPhysicalFieldStepSource = { sourceId: 'native-initial-defender-decision-v219:decision:' + playerId,
      sourceVersion: prior.source.sourceVersion, capability: 'same_pa_physical_field_step_v1', viewReference: currentReference,
      launchReference: prior.source.launchReference, previousOperationReference: priorReference, fieldRootReference: prior.source.fieldRootReference,
      previousFieldReference: priorReference, throughTick: prior.evaluationTick,
      action: { kind: 'defender_decision_v1', member, calibrationReference: decisionCalibrationReference, observationReference,
        priorities: decisionModelDeclaration.priorities } };
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => id === decisionSource.sourceId ? decisionSource : null }));
    const decision = physical.acceptOperation(decisionSource.sourceId); release(physical);
    if (decision.kind !== 'same_pa_physical_field_step_v1' || decision.operationOrdinal !== 17 || decision.actionResult?.kind !== 'defender_decision_v1') throw Error('V219 normal decision pending');
    const decisionReference = reference('pa_physical_v1_field_steps', decision), actionResult = decision.actionResult;
    same(decision.source, decisionSource); same(decision.field, prior.field); same(decision.timeline, prior.timeline); assert.equal(decision.evaluationTick, prior.evaluationTick);
    same(decision.actionResult.observationReference, observationReference); assert.equal(decision.actionResult.playerId, playerId);
    assert(['hold', 'ball_handler'].includes(decision.actionResult.calculation.selected.intent.kind));
    const expectedHeads = { ...normal.allHeads, pa_physical_v1_heads: normal.allHeads.pa_physical_v1_heads.map(h => ({ ...h,
      operation_ordinal: 17, last_owner: decisionReference.owner, last_source_id: decisionReference.sourceId, last_snapshot_hash: decisionReference.snapshotHash })) };
    const acceptedDecision = snapshot(() => { const proof = readSamePaPhysicalOperationFromSqlite(db, decisionReference); same(proof.record, decision);
      same(heads(), expectedHeads); same(readHistoricalSamePaLifecycleViewFromSqlite(db, currentReference), current);
      same(must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId)), normal.world); return proof; });
    const resumePins = { ...normal.resumePins, defenderDecisionCalibrationReference: decisionCalibrationReference, defenderDecisionReference: decisionReference };
    const eventReferences = [...normal.eventReferences, decisionReference];
    emit('normal-initial-defender-decision-accepted-before-lifecycle', { decisionSource, decisionReference, decision, currentPhysicalOperation: acceptedDecision,
      decisionCalibrationReference, precedingLifecycleViewReference: currentReference, decisionModelDeclaration, playerId, observationReference, resumePins, eventReferences });
    const writer = track(openSqliteSamePlateAppearanceLifecycleStore(path, { readAcceptedPrefix: id => accepted.get(id),
      readAcceptedTotal: id => accepted.get(id), readAcceptedView: id => accepted.get(id) }));
    const label = 'physical-fixture:cut23', prefixSource: SamePaLifecyclePrefix['source'] = { sourceId: label + ':prefix', sourceVersion: 'fixture-only-v1',
      capability: 'same_pa_lifecycle_prefix_v1', enrollmentReference: original.acceptedAction.source.enrollmentReference,
      anchorViewReference: original.prefix.source.anchorViewReference, eventReferences };
    accepted.set(prefixSource.sourceId, prefixSource); const prefix = writer.acceptPrefix(prefixSource.sourceId); if (prefix.kind === 'pending') throw Error('V219 prefix pending');
    const prefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix), efforts = Object.fromEntries(original.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    const totalSources: SamePaLifecycleTotal['source'][] = prefix.lineage.participantReferences.map(p => ({ sourceId: label + ':total:' + p.playerId,
      sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_cumulative_total_v1', enrollmentReference: prefix.lineage.enrollmentReference,
      prefixReference, participantReference: p, effortUnits: efforts[p.playerId], provenance: { assessmentSourceId: label + ':assessment:' + p.playerId,
        assessmentVersion: 'fixture-only-v1', calibrationSourceId: label + ':explicit-total', calibrationVersion: 'fixture-only-v1' } }));
    totalSources.forEach(s => accepted.set(s.sourceId, s)); const totalSet = writer.acceptTotalSet(totalSources.map(s => s.sourceId));
    if (totalSet.kind !== 'same_pa_lifecycle_total_set') throw Error('V219 ten TOTALs pending');
    const viewSource: SamePaLifecycleView['source'] = { sourceId: label + ':view', sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_cumulative_view_v1',
      enrollmentReference: prefix.lineage.enrollmentReference, prefixReference, participantTotalReferences: totalSet.participantTotalReferences };
    accepted.set(viewSource.sourceId, viewSource); const view = writer.acceptView(viewSource.sourceId); if (view.kind === 'pending') throw Error('V219 view pending'); release(writer);
    const finalViewReference = reference('pa_lifecycle_v1_execution_views', view);
    const final = snapshot(() => {
      const finalCurrent = readCurrentSamePaLifecycleViewFromSqlite(db, finalViewReference), finalHistorical = readHistoricalSamePaLifecycleViewFromSqlite(db, finalViewReference);
      same(finalCurrent, finalHistorical); same(finalCurrent.view, view); same(finalCurrent.actor, original.actor);
      same(finalCurrent.view.cut.physicalOperationReference, decisionReference); same(finalCurrent.view.cut.operationReference, decisionReference); assert.equal(finalCurrent.view.cut.stage, 'field_active');
      same(readSamePaLifecycleRecordFromSqlite(db, 'prefix', prefix.source.sourceId), prefix);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', totalSet.totals.map(t => t.source.sourceId)); same(totals, totalSet.totals);
      const calibrationIds = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all(finalViewReference.sourceId);
      assert.equal(calibrationIds.length, 0);
      same(readSamePaLifecycleCalibrationFromSqlite(db, decisionCalibrationReference), decisionCalibration);
      const currentPhysicalOperation = readSamePaPhysicalOperationFromSqlite(db, decisionReference); same(currentPhysicalOperation.record, decision);
      const allHeads = heads(); same(allHeads, expectedHeads); const world = must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId)); same(world, normal.world);
      return { finalCurrent, finalHistorical, prefix, totals, currentPhysicalOperation, allHeads, physicalHeads: allHeads.pa_physical_v1_heads, world };
    });
    const result = { ...final, boundary: 'NATIVE_INITIAL_DEFENDER_DECISION_CHECKPOINT_ONLY' as const,
      retainedInputReferences: retained.retainedInputReferences, retainedNormal: normal, retained, finalViewReference, finalPrefixReference: prefixReference,
      resumePins, eventReferences, decisionModelDeclaration, playerId, observationReference, precedingPhysicalReference: priorReference,
      decisionCalibration, decisionCalibrationReference, calibrationSource, decisionSource, decision, decisionReference, actionResult,
      calibrations: [], calibrationReferences: [], worldBefore: normal.world, worldAfter: final.world,
      initialDefenderDecisionAccepted: true, finalLifecycleCurrentProven: true, normalLifecycleAdvances: 1,
      newDecisionCalibrationAcceptanceCount: 1, newDecisionAcceptanceCount: 1, newPrefixAcceptanceCount: 1, newTotalAcceptanceRowCount: 10, newViewAcceptanceCount: 1,
      retainedStageReacceptCount: 0, otherRoutesFullReady: false, allRoutesReady: false, empiricallyCalibrated: false,
      nativePostInitialDefenderDecisionConsumerProven: false, nativeResumeAdapterRequired: true, resumeReady: false,
      defensiveAiAccepted: false, movementAccepted: false, assignmentProven: false, legalOutcomeProven: false, officialTerminalProven: false,
      fullContinuationComplete: false, performancePass: false, wholeRngConsumptionProven: false };
    assert.equal(Object.keys(resumePins).length, 27); assert.equal(eventReferences.length, 23);
    emit('normal-initial-defender-decision-cut23-authenticated', result); return result;
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = []; for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V219 owner cleanup failed');
  }
}
