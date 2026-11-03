import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json, actorHash as hash, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite, readCurrentSamePaLifecycleCalibrationFromSqlite,
  readSamePaLifecycleCalibrationFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite, readSamePaPhysicalActionFromSqlite, readSamePaPhysicalFieldCalibrationFromSqlite } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readSamePaPreparedActionFromSqlite, readSamePaExecutionCalibrationFromSqlite } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
import { readBattingEmotionExecutionFromSqlite } from '../../src/host/world/SqliteBattingEmotionExecutionStore';
import { readSamePaBattingExecutionInputFromSqlite, readSamePaBattingIntentFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { readEmotionWorldRevisionFromSqlite } from '../../src/host/world/EmotionWorldRevisionFromSqlite';
import { playerBattingModelEvidenceFromSqlite } from '../../src/host/world/PlayerBattingModelEvidence';
import { battedBodyModelMaterializationEvidenceFromSqlite } from '../../src/host/world/BattedBodyModelMaterializationEvidence';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from '../../src/host/world/PlayerBodyCapabilityMaterializationEvidence';
import { playerObservationModelEvidenceFromSqlite } from '../../src/host/world/SqlitePlayerObservationModelStore';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { createSamePaLifecycleFixtureCalibrationSources } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { createSamePaObservationClockProjectionSourcesV212 } from '../../src/host/world/SamePaObservationClockProjectionSourcesV212';
import { deriveSamePaObservationClockProjectionV1 } from '../../src/host/world/SamePlateAppearanceObservationClockProjectionV1';
import { createSamePaInitialDefenderObservationModelV214, createSamePaInitialDefenderObservationViewsV214 } from '../../src/host/world/SamePaInitialDefenderObservationViewV214';
import type { SamePaLifecyclePrefix, SamePaLifecycleTotal, SamePaLifecycleView, SamePaLifecycleViewBasis } from '../../src/host/world/SamePlateAppearanceLifecycle';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { SamePaPhysicalFieldStepSource } from '../../src/host/world/SamePlateAppearancePhysicalEpisode';
import type { observeNativeInitialDefenderViewsV214, NativeInitialDefenderViewsV214Input } from './native-initial-defender-views-v214';

export type InitialDefenderInventoryCellV216 = Readonly<{ observation: number; prefix: number; totals: number; view: number; calibration: number }>;
const phases = ['OBSERVATION_PENDING', 'PREFIX_PENDING', 'TOTALS_PENDING', 'VIEW_PENDING', 'SCOPED_CALIBRATION_PENDING', 'COMPLETE'] as const;
const allowed = [[0, 0, 0, 0, 0], [1, 0, 0, 0, 0], [1, 1, 0, 0, 0], [1, 1, 10, 0, 0], [1, 1, 10, 1, 0], [1, 1, 10, 1, 1]];
/** Committed transaction boundaries only. Partial atomic TOTALs are never repaired. */
export function classifyInitialDefenderInventoryV216(cells: readonly InitialDefenderInventoryCellV216[]) {
  assert.equal(cells.length, 9, 'V216 inventory phase requires nine actors');
  let incomplete = false, completedCount = 0, nextIndex = 9, phase: typeof phases[number] = 'COMPLETE';
  cells.forEach((cell, index) => {
    const values = [cell.observation, cell.prefix, cell.totals, cell.view, cell.calibration];
    const at = allowed.findIndex(candidate => candidate.every((v, i) => v === values[i]));
    assert(at >= 0 && (!incomplete || at === 0), 'V216 inventory phase is partial, foreign or noncontiguous');
    if (at === 5) completedCount++;
    else if (!incomplete) { incomplete = true; nextIndex = index; phase = phases[at]; }
  });
  const sum = (key: keyof InitialDefenderInventoryCellV216) => cells.reduce((n, cell) => n + cell[key], 0);
  return { phase, nextIndex, completedCount, acceptedObservationCount: sum('observation'), acceptedPrefixCount: sum('prefix'),
    acceptedTotalRows: sum('totals'), acceptedViewCount: sum('view'), acceptedScopedCalibrationCount: sum('calibration'),
    remainingAppendRows: 126 - cells.reduce((n, cell) => n + cell.observation + cell.prefix + cell.totals + cell.view + cell.calibration, 0) };
}

type Original = ReturnType<typeof observeNativeInitialDefenderViewsV214>['originalInputs'];
export type NativeInitialDefenderInventoryInputV216 = Readonly<{
  retainedInput: NativeInitialDefenderViewsV214Input; original: Original;
  declarationCheckpoint: Readonly<{ modelDeclaration: unknown; views: unknown; defenders: unknown; homePlate: unknown }>;
  savedCheckpoints: readonly Readonly<{ name: string; value: unknown }>[];
}>;
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V216 normal Source or retained record differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V216 normal prerequisite missing'); return value; };

/** Normal identity lookup is the presence authority. A hidden SQL locator must
 * not turn a corrupted accepted Source into an apparently missing calibration. */
export function readNormalScopedCalibrationInventoryV216(db: DatabaseSync, expectedSourceId: string, viewSourceId: string) {
  return withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
    const normal = readSamePaLifecycleRecordFromSqlite(db, 'calibration', expectedSourceId);
    if (normal && normal.kind !== 'same_pa_lifecycle_calibration') throw Error('V216 scoped calibration kind differs');
    const located = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all(viewSourceId).map(r => String(r.source_id));
    same(located, normal ? [expectedSourceId] : []);
    return normal;
  }));
}

/** Read-only authentication, not replay or recovery. Every writer API is absent.
 * Saved checkpoint absence is never evidence of an absent committed transaction. */
export function inventoryNativeInitialDefenderViewsV216(path: string, input: NativeInitialDefenderInventoryInputV216) {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const db = new Native(path, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN');
  const changes = () => Number(db.prepare('SELECT total_changes() n').get()!.n);
  const beforeChanges = changes();
  const locate = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => {
    const row = must(db.prepare(`SELECT source_hash,snapshot_hash FROM main.${owner} WHERE source_id=?`).get(sourceId));
    return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
  };
  try {
    const result = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const retained = input.retainedInput, old = input.original, pins = retained.resumePins;
      assert.equal(retained.finalViewReference.sourceId, 'physical-fixture:cut13:view'); assert.equal(retained.eventReferences.length, 13);
      assert.equal(Object.keys(pins).length, 16); same(retained.modelDeclaration, input.declarationCheckpoint.modelDeclaration);
      same(retained.modelDeclaration, createSamePaInitialDefenderObservationModelV214('native-initial-defender-views-v214:nominal-initial-view-model'));
      const preparation = retained.retainedInputReferences, refs = preparation.retainedInputReferences;
      const actor = must(readPhysicalPlateAppearanceActorFromSqlite(db, refs.actorReference.sourceId)); same(actor, old.actor); same(reference('physical_plate_appearance_actors', actor), refs.actorReference);
      const historical13 = readHistoricalSamePaLifecycleViewFromSqlite(db, retained.finalViewReference); same(historical13, old.current); same(historical13, old.historical);
      const fieldStep = readSamePaPhysicalOperationFromSqlite(db, pins.fieldStepReference).record; same(fieldStep, old.fieldStep);
      const fieldRoot = readSamePaPhysicalOperationFromSqlite(db, pins.fieldRootReference).record; same(fieldRoot, old.fieldRoot);
      assert.equal(fieldStep.kind, 'same_pa_physical_field_step_v1'); assert.equal(fieldStep.operationOrdinal, 7);
      if (fieldStep.kind !== 'same_pa_physical_field_step_v1' || fieldRoot.kind !== 'same_pa_physical_field_root_v1') throw Error('V216 original field graph differs');
      same(fieldStep.source.sourceVersion, preparation.futureProfileDeclarationOnly.futureFieldStepSourceVersion);
      same(fieldRoot.source.ballPhysics, preparation.futureProfileDeclarationOnly.futureBallPhysics);
      const prefix13 = readSamePaLifecycleRecordFromSqlite(db, 'prefix', old.prefix.source.sourceId); same(prefix13, old.prefix); same(old.prefix.source.eventReferences, retained.eventReferences);
      same(readSamePaLifecycleSetFromSqlite(db, 'total', old.totals.map(t => t.source.sourceId)), old.totals);
      same(readSamePaLifecycleSetFromSqlite(db, 'calibration', old.calibrations.map(c => c.source.sourceId)), old.calibrations);
      same(readSamePaLifecycleSetFromSqlite(db, 'calibration', old.unprojectedCalibrations.map(c => c.source.sourceId)), old.unprojectedCalibrations);
      same(readSamePaPhysicalActionFromSqlite(db, refs.actionReference), old.action);
      same(readSamePaPhysicalFieldCalibrationFromSqlite(db, preparation.calibrationReference), old.fieldCalibration);
      const bodyModel = must(battedBodyModelMaterializationEvidenceFromSqlite(db).read(preparation.bodyModelReference.sourceId)); same(bodyModel, old.bodyModel);
      same(locate('world_batted_body_materializations', bodyModel.sourceId), preparation.bodyModelReference);
      same(must(playerBodyCapabilityMaterializationEvidenceFromSqlite(db).read(preparation.batterBodyReference.sourceId)), old.batterBody);
      same(readBattingPerceptionFromSqlite(db, 'posture', pins.postureReference), old.posture);
      same(readSamePaBattingIntentFromSqlite(db, pins.intentReference), old.intent);
      same(must(playerBattingModelEvidenceFromSqlite(db).read(refs.modelReference.sourceId)), old.model);
      same(readSamePaPreparedActionFromSqlite(db, locate('pa_dispatch_v1_action_plans', 'native-action')), old.acceptedAction);
      same(old.acceptedAction.source, old.originalAction);
      for (const [ref, value] of [[pins.launchReference, old.launch], [pins.commitmentReference, old.commitment], [pins.resolutionReference, old.resolution]] as const)
        same(readSamePaPhysicalOperationFromSqlite(db, ref).record, value);
      same(readSamePaBattingExecutionInputFromSqlite(db, pins.inputReference), old.historicalInput);
      same(readBattingPerceptionFromSqlite(db, 'assessment', pins.scoreReference), old.score);
      same(readBattingEmotionExecutionFromSqlite(db, pins.emotionReference), old.emotion);
      refs.qualificationReferences.forEach((r, i) => same(must(readNativeSpinControlMasteryV123(db, r.sourceId)), old.qualifications[i]));
      const world = must(readEmotionWorldRevisionFromSqlite(db, actor.binding.careerId)); same(world, old.world); assert.equal(world.head.worldRevision, 2);
      const defenders = bodyModel.actors.filter(b => actor.defenderBindings.some(d => d.playerId === b.playerId)).map(body => ({ playerId: body.playerId,
        heightMeters: body.heightMeters, bodyOriginHeightMeters: body.bodyOriginHeightMeters, bodyPrimitiveOffset: must(body.primitives.find(p => p.role === 'body')).offset,
        prePitchPosition: must(actor.world.defenders.find(d => d.playerId === body.playerId)).position }));
      same(defenders, old.defenders); const homePlate = fieldRoot.geometry.bases.home.region.center; same(homePlate, old.homePlate);
      const declared = createSamePaInitialDefenderObservationViewsV214(retained.modelDeclaration, defenders, homePlate);
      same(declared.views, input.declarationCheckpoint.views); same(defenders, input.declarationCheckpoint.defenders); same(homePlate, input.declarationCheckpoint.homePlate);
      const dispatchCalibrations = old.dispatchCalibrationIds.map(id => readSamePaExecutionCalibrationFromSqlite(db, locate('pa_dispatch_v1_execution_calibrations', id)));
      const acceptedCalibrations = { kind: 'execution_calibration_set' as const, calibrations: dispatchCalibrations,
        calibrationReferences: dispatchCalibrations.map(c => reference('pa_dispatch_v1_execution_calibrations', c)) };
      const originals = old.observationClockOriginals.map(o => {
        const nominal = must(playerObservationModelEvidenceFromSqlite(db).read(o.nominalReference.sourceId));
        same(reference('world_player_observation_models', nominal), o.nominalReference); same(nominal.source.calibration, o.nominalCalibration);
        same(readSamePaLifecycleCalibrationFromSqlite(db, reference('pa_lifecycle_v1_execution_calibrations', o.effectiveCalibration)), o.effectiveCalibration); return o;
      });
      const sourcesFor = (viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>, basis: Pick<SamePaLifecycleViewBasis, 'members'>, cut: number, fieldReference: typeof pins.fieldStepReference) =>
        createSamePaObservationClockProjectionSourcesV212(createSamePaLifecycleFixtureCalibrationSources(acceptedCalibrations, viewReference, basis, 'physical-fixture:cut' + cut, old.observationValues),
          { fieldReference, targetTicksPerSecond: 1_000_000, originals });
      same(old.calibrations.map(c => c.source), sourcesFor(retained.finalViewReference, historical13, 13, pins.fieldStepReference));
      const efforts = Object.fromEntries(old.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
      let priorReference = pins.fieldStepReference, priorRecord = fieldStep, priorViewReference = retained.finalViewReference, priorBasis = historical13;
      let priorCalibration = must(old.calibrations.find(c => c.source.route === 'defender_observation' && c.source.member.playerId === declared.views[0].playerId));
      let eventReferences = [...retained.eventReferences]; const resumePins: Record<string, SamePaReference<string>> = { ...pins };
      type Iteration = { index: number; playerId: string; cut: number; cell: InitialDefenderInventoryCellV216;
        observationReference: typeof pins.fieldStepReference | null; observation: typeof fieldStep | null; observationSource: SamePaPhysicalFieldStepSource | null;
        precedingLifecycleViewReference: typeof retained.finalViewReference | null; inputCalibrationReference: SamePaReference<'pa_lifecycle_v1_execution_calibrations'> | null;
        prefix: ReturnType<typeof readSamePaLifecycleRecordFromSqlite>; totals: ReturnType<typeof readSamePaLifecycleSetFromSqlite>;
        view: ReturnType<typeof readSamePaLifecycleRecordFromSqlite>; basis: SamePaLifecycleViewBasis | null;
        scopedCalibration: ReturnType<typeof readSamePaLifecycleRecordFromSqlite>; projectionProof: ReturnType<typeof deriveSamePaObservationClockProjectionV1> | null };
      const cells: InitialDefenderInventoryCellV216[] = [], iterations: Iteration[] = [];
      for (let index = 0; index < 9; index++) {
        const initial = declared.views[index], cut = 14 + index, label = 'physical-fixture:cut' + cut;
        const observationId = 'native-initial-defender-views-v214:observation:' + initial.playerId;
        const row = db.prepare('SELECT source_id FROM main.pa_physical_v1_field_steps WHERE source_id=?').get(observationId);
        const observationRef = row ? locate('pa_physical_v1_field_steps', observationId) : null;
        const proof = observationRef ? readSamePaPhysicalOperationFromSqlite(db, observationRef) : null, observation = proof?.record ?? null;
        const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', label + ':prefix');
        const totalIds = old.prefix.lineage.participantReferences.map(p => label + ':total:' + p.playerId);
        const totals = readSamePaLifecycleSetFromSqlite(db, 'total', totalIds);
        const view = readSamePaLifecycleRecordFromSqlite(db, 'view', label + ':view');
        // Only identity is selected here. These pure declarations retain the
        // authenticated cut13 basis; they are neither current Sources nor used
        // for acceptance. Full Source comparison uses the actual view below.
        const identityCandidates = createSamePaLifecycleFixtureCalibrationSources(acceptedCalibrations, retained.finalViewReference, historical13, label, old.observationValues);
        const expectedCalibrationId = must(identityCandidates.find(s => s.route === 'defender_observation' && s.member.playerId === declared.views[(index + 1) % 9].playerId)).sourceId;
        const calibration = readNormalScopedCalibrationInventoryV216(db, expectedCalibrationId, label + ':view');
        const cell = { observation: Number(!!observation), prefix: Number(!!prefix), totals: totals.filter(Boolean).length, view: Number(!!view), calibration: Number(!!calibration) };
        cells.push(cell); classifyInitialDefenderInventoryV216([...cells, ...Array.from({ length: 9 - cells.length }, () => ({ observation: 0, prefix: 0, totals: 0, view: 0, calibration: 0 }))]);
        if (!observation) { iterations.push({ index, playerId: initial.playerId, cut, cell, observationReference: null, observation: null, observationSource: null,
          precedingLifecycleViewReference: null, inputCalibrationReference: null, prefix, totals, view, basis: null, scopedCalibration: calibration, projectionProof: null }); continue; }
        if (!observationRef || observation.kind !== 'same_pa_physical_field_step_v1' || observation.actionResult?.kind !== 'defender_observation_v1') throw Error('V216 observation kind differs');
        const inputCalibrationReference = reference('pa_lifecycle_v1_execution_calibrations', priorCalibration);
        const expectedSource: SamePaPhysicalFieldStepSource = { sourceId: observationId, sourceVersion: preparation.futureProfileDeclarationOnly.futureFieldStepSourceVersion,
          capability: 'same_pa_physical_field_step_v1', viewReference: priorViewReference, launchReference: pins.launchReference, previousOperationReference: priorReference,
          fieldRootReference: pins.fieldRootReference, previousFieldReference: priorReference, throughTick: priorRecord.evaluationTick,
          action: { kind: 'defender_observation_v1', member: must(priorBasis.members.find(m => m.playerId === initial.playerId)),
            calibrationReference: inputCalibrationReference, previousObservationReference: null, view: initial.view } };
        same(observation.source, expectedSource); assert.equal(observation.operationOrdinal, 8 + index);
        same(observation.field, fieldStep.field); same(observation.timeline, fieldStep.timeline); assert.equal(observation.evaluationTick, fieldStep.evaluationTick);
        same(observation.actionResult.samplingRequest.view, initial.view); assert.equal(observation.actionResult.samplingRequest.previousObservationSourceId, null);
        eventReferences.push(observationRef); resumePins['defenderObservationReference' + (index + 1)] = observationRef;
        let basis: SamePaLifecycleViewBasis | null = null, projectionProof = null;
        if (prefix) {
          if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V216 prefix kind differs');
          const source: SamePaLifecyclePrefix['source'] = { sourceId: label + ':prefix', sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_prefix_v1',
            enrollmentReference: old.acceptedAction.source.enrollmentReference, anchorViewReference: old.prefix.source.anchorViewReference, eventReferences: [...eventReferences] };
          same(prefix.source, source); const prefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix);
          const totalSources: SamePaLifecycleTotal['source'][] = prefix.lineage.participantReferences.map(p => ({ sourceId: label + ':total:' + p.playerId, sourceVersion: 'fixture-only-v1',
            capability: 'same_pa_lifecycle_cumulative_total_v1', enrollmentReference: prefix.lineage.enrollmentReference, prefixReference, participantReference: p, effortUnits: efforts[p.playerId],
            provenance: { assessmentSourceId: label + ':assessment:' + p.playerId, assessmentVersion: 'fixture-only-v1', calibrationSourceId: label + ':explicit-total', calibrationVersion: 'fixture-only-v1' } }));
          totals.forEach((t, i) => { if (t) same(t.source, totalSources[i]); });
          if (view) {
            if (view.kind !== 'same_pa_lifecycle_view' || totals.some(t => !t || t.kind !== 'same_pa_lifecycle_total')) throw Error('V216 view prerequisites differ');
            const totalValues = totals.map(t => { if (!t || t.kind !== 'same_pa_lifecycle_total') throw Error('V216 total missing'); return t; });
            const source: SamePaLifecycleView['source'] = { sourceId: label + ':view', sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_cumulative_view_v1',
              enrollmentReference: prefix.lineage.enrollmentReference, prefixReference, participantTotalReferences: totalValues.map(t => ({ playerId: t.source.participantReference.playerId, assessmentReference: reference('pa_lifecycle_v1_total_assessments', t) })) };
            same(view.source, source); const viewReference = reference('pa_lifecycle_v1_execution_views', view);
            basis = readHistoricalSamePaLifecycleViewFromSqlite(db, viewReference);
            same(basis.view.cut.physicalOperationReference, observationRef); same(basis.view.cut.operationReference, observationRef); assert.equal(basis.view.cut.stage, 'field_active');
            if (calibration) {
              if (calibration.kind !== 'same_pa_lifecycle_calibration') throw Error('V216 calibration kind differs');
              const expected = must(sourcesFor(viewReference, basis, cut, observationRef).find(s => s.route === 'defender_observation' && s.member.playerId === declared.views[(index + 1) % 9].playerId));
              same(calibration.source, expected); projectionProof = deriveSamePaObservationClockProjectionV1(db, calibration.source, basis);
              same(projectionProof.evidence, calibration.observationClockProjection); same(projectionProof.evidence.fieldReference, observationRef);
              priorCalibration = calibration;
            }
            priorViewReference = viewReference; priorBasis = basis;
          }
        }
        iterations.push({ index, playerId: initial.playerId, cut, cell, observationReference: observationRef, observation, observationSource: expectedSource,
          precedingLifecycleViewReference: expectedSource.viewReference, inputCalibrationReference,
          prefix, totals, view, basis, scopedCalibration: calibration, projectionProof });
        priorReference = observationRef; priorRecord = observation;
      }
      const state = classifyInitialDefenderInventoryV216(cells);
      const latest = iterations[state.acceptedObservationCount - 1];
      const latestViewCovered = state.acceptedObservationCount === state.acceptedViewCount;
      const current = latestViewCovered ? readCurrentSamePaLifecycleViewFromSqlite(db, priorViewReference) : null;
      if (current) { same(current, priorBasis); if (state.acceptedScopedCalibrationCount === state.acceptedViewCount)
        same(readCurrentSamePaLifecycleCalibrationFromSqlite(db, reference('pa_lifecycle_v1_execution_calibrations', priorCalibration)), priorCalibration); }
      const allHeads = Object.fromEntries(db.prepare("SELECT name FROM main.sqlite_schema WHERE type='table' AND name LIKE '%_heads' ORDER BY name").all().map(r => {
        const name = String(r.name); return [name, db.prepare('SELECT rowid,* FROM main."' + name.replaceAll('"', '""') + '" ORDER BY rowid').all()];
      }));
      same(allHeads, { ...old.allHeads, pa_physical_v1_heads: old.allHeads.pa_physical_v1_heads.map(h => ({ ...h, operation_ordinal: 7 + state.acceptedObservationCount,
        last_owner: priorReference.owner, last_source_id: priorReference.sourceId, last_snapshot_hash: priorReference.snapshotHash })) });
      const savedChecks = input.savedCheckpoints.map(saved => {
        const value = saved.value as Record<string, unknown>;
        const matched = /^normal-cut(\d+)-current-scoped-calibration-physical-world-checkpoint$/.exec(saved.name);
        if (matched) {
          const index = Number(matched[1]) - 14, item = must(iterations[index]); assert.equal(item.cell.calibration, 1);
          same(value.finalHistorical, item.basis); same(value.prefix, item.prefix); same(value.totals, item.totals); same(value.scopedCalibration, item.scopedCalibration);
          same(value.currentPhysicalOperation && (value.currentPhysicalOperation as { record: unknown }).record, item.observation);
        } else {
          const matched = /^normal-defender-observation-(\d+)-accepted-before-lifecycle$/.exec(saved.name);
          if (matched) { const item = must(iterations[Number(matched[1]) - 1]); same(value.observation, item.observation); same(value.observationReference, item.observationReference); same(value.observationSource, item.observationSource); }
          else throw Error('V216 unrecognized saved checkpoint');
        }
        return { name: saved.name, normalRecordAgreement: true };
      });
      return { boundary: 'NATIVE_INITIAL_DEFENDER_VIEWS_READ_ONLY_INVENTORY' as const, readOnly: true, acceptOperationCalls: 0, lifecycleAcceptCalls: 0,
        original: old, retainedInput: retained, modelDeclaration: declared.model, views: declared.views, state, cells, iterations, savedChecks,
        eventReferences, resumePins, latestPhysicalReference: priorReference, latestPhysicalOperation: readSamePaPhysicalOperationFromSqlite(db, priorReference),
        latestAcceptedViewReference: priorViewReference, latestHistoricalView: priorBasis, latestNormalCurrent: current, currentViewCoversPhysicalHead: latestViewCovered,
        latestScopedCalibration: state.acceptedScopedCalibrationCount === state.acceptedViewCount && state.acceptedViewCount > 0 ? priorCalibration : null,
        latestIteration: latest ?? null, allHeads, world, originalHistorical13Authenticated: true, normalCommittedPhaseAuthenticated: true,
        missingLifecycleStages: state.phase === 'COMPLETE' || state.phase === 'OBSERVATION_PENDING' ? [] :
          ['PREFIX_PENDING', 'TOTALS_PENDING', 'VIEW_PENDING', 'SCOPED_CALIBRATION_PENDING'].slice(['PREFIX_PENDING', 'TOTALS_PENDING', 'VIEW_PENDING', 'SCOPED_CALIBRATION_PENDING'].indexOf(state.phase)),
        originalFailedRunCompleted: false, originalFailedRunEndPinsClaimed: false, remainingOnlyRecoveryExecuted: false,
        rawGazeRestored: false, defensiveAiAccepted: false, legalOutcomeProven: false, officialTerminalProven: false, resumeReady: false, fullContinuationComplete: false,
        wholeRngConsumptionProven: false, performancePass: false, sourceIdentityHash: hash({ model: declared.model, views: declared.views }) };
    }));
    assert.equal(changes(), beforeChanges); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 1); return result;
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
}
