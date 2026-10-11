import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite, readCurrentSamePaLifecycleViewFromSqlite, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { batterSwingExitStateEvidenceFromSqlite } from './SqliteBatterSwingExitStateStore';
import { completeNativeBatterRunPlanCheckpoint, nativeBatterRunCheckpointGeometry } from './SamePlateAppearanceBatterRunNative.test-support';
import { readIFN01RetainedWorkloadHeads } from './IFN01RetainedWorkloadContext.test-support';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePhysicalPlateAppearanceActorStore, type AcceptedPhysicalPlateAppearanceActor } from './SqlitePhysicalPlateAppearanceActorStore';
import { officialPitchWorkloadParticipationAuthority } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceLifecycleStore } from './SqliteSamePlateAppearanceLifecycleStore';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from './SqliteSamePlateAppearancePhysicalEpisodeStore';
import { openSqliteSamePlateAppearanceCatchWorkStore } from './SamePlateAppearanceCatchWorkFromSqlite';
import { openSqliteBattingPerceptionStore } from './SqliteBattingPerceptionStore';
import { openSqliteBattingExecutionInputStore } from './SqliteBattingExecutionInputStore';
import { openSqliteBattingEmotionExecutionStore } from './SqliteBattingEmotionExecutionStore';
import { prepareSamePaLifecycleFixture } from './SamePlateAppearanceLifecycleFixture.test-support';
import type { SamePaPhysicalLifecycleSuffix } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { completeInFlightBattingAfterBatterRun } from './InFlightBattingLifecycleFixture.test-support';
import { prepareIFN01RetainedCheckpoint, type IFN01RetainedSuffixInput } from './IFN01RetainedCheckpoint.test-support';

/** Only corrected-run IFN01 cp10 after the original exit-state is admitted. The gzip is
 * identification, not owner proof: every recovered runtime value below comes
 * from its original owner. No journal, synthetic predecessor, or earlier case
 * invocation is needed. The acceptance entry is deliberately outside *.test. */
export const runIFN01RetainedOriginalSuffix = (input: IFN01RetainedSuffixInput, log: (phase: string) => void = () => {}) => {
  const { path, pin, input: capturedInput, witnessRecheck } = prepareIFN01RetainedCheckpoint(input);
  const stores: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
  let phase = 'open-private-checkpoint', passed = false, originalPrefixHistoryUnchanged = false;
  const mark = (name: string) => { phase = name; log(name); };
  try {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = track(new DatabaseSync(path));
    assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
    assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='table'").get()!.n, pin.tableCount);
    // These locator fields never substitute for the owner reads using them.
    const locator = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => {
      const row = db.prepare('SELECT source_hash,snapshot_hash FROM ' + owner + ' WHERE source_id=?').get(sourceId);
      assert(row, 'IFN01 retained original locator missing: ' + sourceId);
      return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
    };
    const rows = (table: string) => db.prepare('SELECT rowid,* FROM ' + table + ' ORDER BY rowid').all();
    const histories = ['pa_dispatch_v1_pitch_actions', 'pa_take_successor_v1_pitch_actions',
      'pa_physical_v1_launches', 'pa_physical_v1_cuts', 'pa_physical_v1_commitments', 'pa_physical_v1_resolutions',
      'pa_physical_v1_field_roots', 'pa_physical_v1_field_steps', 'pa_physical_v1_admissions',
      'pa_physical_v1_pitch_consumers', 'pa_physical_v1_consumptions', 'pa_catch_v1_work',
      'pa_lifecycle_v1_work_prefixes', 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_views',
      'pa_lifecycle_v1_execution_calibrations', 'batting_observation_v1_postures', 'batting_observation_v1_observations',
      'batting_observation_v1_deliveries', 'batting_execution_v1_inputs', 'batting_execution_v1_intents',
      'batting_prediction_v1_predictions', 'batting_score_v1_assessments', 'batting_emotion_execution_v1_executions',
      'world_player_runner_decision_motion_models', 'world_player_batter_run_transition_models', 'world_batter_swing_exit_states'];
    const saved = histories.map(table => ({ table, rows: rows(table) }));
    assert.equal(rows('pa_lifecycle_v1_work_prefixes').length, 32);
    assert.equal(rows('pa_lifecycle_v1_total_assessments').length, 320);
    assert.equal(rows('pa_lifecycle_v1_execution_views').length, 32);
    assert.equal(rows('pa_lifecycle_v1_execution_calibrations').length, 1026);
    assert.equal(db.prepare('SELECT count(*) n FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('physical-fixture:cut32:view')!.n, 1);
    for (const table of ['pa_lifecycle_v1_outcomes', 'pa_terminal_v1_endpoints', 'pa_settlement_v1_releases',
      'pa_terminal_v1_transitions', 'applications', 'official_scoring_applications', 'world_batter_run_plans']) {
      const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (exists) assert.equal(db.prepare('SELECT count(*) n FROM ' + table).get()!.n, 0);
    }

    mark('authenticate-original-actors-and-reserved-heads');
    const links = track(openSqlitePlayerPersonLinkStore(path));
    const world = track(openSqliteWorldSettlementStore(path)), roster = track(openSqliteManagerRosterDecisionStore(path));
    const official = track(new SqliteOfficialStateStore(path)), fixtureBinding = official.getOfficialFixture('game-1');
    assert(fixtureBinding, 'IFN01 original official fixture missing');
    const participation = track(new SqliteOfficialParticipationStore(path,
      officialPitchWorkloadParticipationAuthority(world, roster, links, fixtureBinding)));
    const initialWorlds = track(openSqliteOfficialInitialWorldStore(path, { matches: official, participation }));
    const initial = initialWorlds.readAcceptedSource('initial-world'); assert(initial, 'IFN01 original initial World missing');
    const actorSources = new Map<string, AcceptedPhysicalPlateAppearanceActor>();
    const sources = { matches: official, initialWorlds, participation };
    const actors = track(openSqlitePhysicalPlateAppearanceActorStore(path, sources, { readAcceptedActor: id => actorSources.get(id) ?? null }));
    const actor = actors.read('batter-1'); assert(actor, 'IFN01 original actor missing');
    assert.equal(actor.match.ruleProfileId, 'npb-2026'); assert.equal(actor.match.playId, 7);
    assert.equal(actor.binding.playerId, 'away-1'); assert.equal(actor.world.runners.length, 0);
    const enrollment = track(openSqliteSamePlateAppearanceEnrollmentStore(path)).readHistorical('native-enrollment');
    assert(enrollment?.kind === 'reserved', 'IFN01 original enrollment missing');
    assert.deepEqual(enrollment.source.actorReference, reference('physical_plate_appearance_actors', actor));
    const originalHeads = readIFN01RetainedWorkloadHeads(db, enrollment, participation);
    assert.deepEqual(db.prepare('SELECT source_id FROM world_player_workload_activities ORDER BY source_id').all().map(r => r.source_id), ['prior-independent-native-fixture-work']);
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedAction = dispatch.readAction('native-action'); assert(acceptedAction, 'IFN01 original dispatch action missing');
    assert.deepEqual(acceptedAction.source.enrollmentReference, reference('same_pa_enrollments', enrollment));
    const calibrationIds = db.prepare('SELECT source_id FROM pa_dispatch_v1_execution_calibrations ORDER BY rowid').all().map(r => String(r.source_id));
    const acceptedCalibrations = dispatch.readCalibrationSet(calibrationIds); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const f = { db, path, actor, acceptedAction, acceptedCalibrations,
      x: { accepted: actorSources, actors, sources, f: { track, links, firstInput: { worldSetup: initial.source.worldSetup } } } };
    const accepted = new Map<string, unknown>();
    const save = <T extends { sourceId: string }>(source: T): T => { accepted.set(source.sourceId, source); return source; };
    const lifecycle = track(openSqliteSamePlateAppearanceLifecycleStore(path, {
      readAcceptedView: id => accepted.get(id), readAcceptedCalibration: id => accepted.get(id) }));
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => accepted.get(id) }));

    mark('authenticate-original-cut32-and-accepted-exit-state');
    // One exact set read inside an existing immutable operation scope. No proof
    // survives this read group or is reused across a subsequent owner mutation.
    const restored = withSqliteReadTransaction(db, () => withSamePaLifecycleReadPhase(db, () => {
      const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', 'physical-fixture:cut32:prefix');
      assert(prefix?.kind === 'same_pa_lifecycle_prefix', 'IFN01 cut32 original prefix missing');
      const basis = readCurrentSamePaLifecycleViewFromSqlite(db, locator('pa_lifecycle_v1_execution_views', 'physical-fixture:cut32:view'));
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', prefix.lineage.participantReferences.map(p => 'physical-fixture:cut32:total:' + p.playerId))
        .map(t => { assert(t?.kind === 'same_pa_lifecycle_total', 'IFN01 cut32 TOTAL missing'); return t; });
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', acceptedCalibrations.calibrations.map(c => 'physical-fixture:cut32:' + c.source.sourceId))
        .map(c => { assert(c?.kind === 'same_pa_lifecycle_calibration', 'IFN01 cut32 calibration missing'); return c; });
      return { prefix, basis, totals, calibrations };
    }));
    const { prefix, totals, calibrations } = restored, view = restored.basis.view;
    assert.equal(prefix.source.eventReferences.length, 32);
    assert.deepEqual(prefix.source.enrollmentReference, acceptedAction.source.enrollmentReference);
    assert.equal(prefix.source.anchorViewReference.sourceId, 'physical-fixture:anchor:view');
    assert.equal(prefix.previousViewReference.sourceId, 'physical-fixture:cut31:view');
    const prefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix), viewReference = reference('pa_lifecycle_v1_execution_views', view);
    assert.deepEqual(view.source.prefixReference, prefixReference);
    assert.equal(totals.length, 10); assert.equal(calibrations.length, 32);
    const participantTotalReferences = totals.map(t => ({ playerId: t.source.participantReference.playerId,
      assessmentReference: reference('pa_lifecycle_v1_total_assessments', t) }));
    assert.deepEqual(participantTotalReferences, view.source.participantTotalReferences);
    for (const total of totals) { assert.deepEqual(total.source.prefixReference, prefixReference); assert.equal(total.effortUnits, 2); }
    for (const calibration of calibrations) assert.deepEqual(calibration.source.viewReference, viewReference);
    const responsePin = locator('pa_physical_v1_field_steps', 'in-flight-fixture:catch-response:7');
    const response = physical.readOperation(responsePin).record;
    assert(response.kind === 'same_pa_physical_field_step_v1' && response.actionResult?.kind === 'defender_motion_v1');
    assert.equal(response.source.previousOperationReference.sourceId, 'in-flight-fixture:catch-response:6');
    assert.deepEqual(prefix.source.eventReferences.at(-1), responsePin);
    assert.deepEqual(prefix.cut.physicalOperationReference, responsePin);
    const head = db.prepare('SELECT * FROM pa_physical_v1_heads').all(); assert.equal(head.length, 1);
    assert.equal(head[0].last_owner, responsePin.owner); assert.equal(head[0].last_source_id, responsePin.sourceId);
    assert.equal(head[0].last_snapshot_hash, responsePin.snapshotHash);
    const root = physical.readOperation(locator('pa_physical_v1_field_roots', 'in-flight-fixture:field3:field-root')).record;
    assert(root.kind === 'same_pa_physical_field_root_v1');
    const work = track(openSqliteSamePlateAppearanceCatchWorkStore(path)).read('in-flight-fixture:catch-information:work');
    assert(work, 'IFN01 original caught work missing');
    for (const source of Object.values(work.originalInputs)) { assert(source, 'IFN01 original caught Source missing'); save(source); }
    const caught = { work, workReference: reference('pa_catch_v1_work', work) };
    const perception = track(openSqliteBattingPerceptionStore(path));
    const posture = perception.readPosture('in-flight-fixture:pitch3:posture');
    const capture = perception.readObservation('in-flight-fixture:pitch3:capture');
    const delivery = perception.readDelivery('in-flight-fixture:pitch3:delivery');
    const battingInput = track(openSqliteBattingExecutionInputStore(path)).readInput('in-flight-fixture:pitch3:input');
    const emotion = track(openSqliteBattingEmotionExecutionStore(path)).read('in-flight-fixture:pitch3:emotion');
    const commitment = physical.readOperation(locator('pa_physical_v1_commitments', 'in-flight-fixture:pitch3:commitment')).record;
    assert(posture?.kind === 'batting_invocation_posture' && capture?.kind === 'batting_observation'
      && delivery?.kind === 'batting_observation_delivery' && battingInput?.kind === 'same_pa_batting_input' && emotion
      && commitment.kind === 'same_pa_physical_commitment_v1', 'IFN01 original swing owners missing');
    assert.deepEqual(reference('batting_execution_v1_inputs', battingInput), commitment.source.inputReference);

    // Recover the declarations actually accepted at cut32. Their owner proofs
    // above include original nominal, member, Person and reference authentication.
    const calibration = (id: string) => {
      const matches = calibrations.filter(c => c.source.sourceId === 'physical-fixture:cut32:native-calibration:' + id);
      assert.equal(matches.length, 1, 'IFN01 original calibration identity differs'); return matches[0].source;
    };
    const batterObservation = calibration('away-1:batter_observation');
    const defenderObservation = calibration('home-1:defender_observation');
    const defenderLocomotion = calibration('home-1:defender_locomotion');
    assert(batterObservation.route === 'batter_observation' && defenderObservation.route === 'defender_observation'
      && defenderLocomotion.route === 'defender_locomotion');
    for (const binding of actor.defenderBindings) {
      assert.deepEqual(calibration(binding.playerId + ':defender_observation').response, defenderObservation.response);
      assert.deepEqual(calibration(binding.playerId + ':defender_locomotion').response, defenderLocomotion.response);
    }
    const efforts = Object.fromEntries(totals.map(t => [t.source.participantReference.playerId, t.effortUnits]));
    let basis: ReturnType<typeof prepareSamePaLifecycleFixture> = { owner: lifecycle, accepted,
      prefixSource: prefix.source, prefix, prefixReference, totals: totals.map(t => t.source),
      totalSet: { kind: 'same_pa_lifecycle_total_set', totals, participantTotalReferences },
      viewSource: view.source, view, viewReference, basis: restored.basis, calibrations: calibrations.map(c => {
        const source = c.source;
        assert(source.route !== 'defender_throw', 'IFN01 original dispatch calibration route differs');
        return source;
      }),
      calibrationSet: { kind: 'same_pa_lifecycle_calibration_set', calibrations,
        calibrationReferences: calibrations.map(c => reference('pa_lifecycle_v1_execution_calibrations', c)) } };
    const events = [...prefix.source.eventReferences];
    const h: SamePaPhysicalLifecycleSuffix = { f, accepted, save, physical, original: acceptedAction.source,
      current: () => basis,
      advance: ref => {
        events.push(ref);
        basis = prepareSamePaLifecycleFixture(f, prefix.source.anchorViewReference, [...events], 'physical-fixture:cut' + events.length,
          efforts, batterObservation.response.values, defenderObservation.response.values, undefined, defenderLocomotion.response.values);
        return basis;
      } };
    const state = withSqliteReadTransaction(db, () => batterSwingExitStateEvidenceFromSqlite(db).read('in-flight-fixture:batter-run:exit-state'));
    assert(state, 'IFN01 accepted exit-state owner missing');
    assert.equal(reference('world_batter_swing_exit_states', state).snapshotHash, pin.exitStateSnapshotHash);
    assert.deepEqual(state.source.fieldReference, responsePin);
    assert.equal(state.model.source.sourceId, 'in-flight-fixture:batter-run:recovery-model');
    assert.equal(state.model.runnerModel.source.sourceId, 'in-flight-fixture:batter-run:runner-model');
    assert.deepEqual(state.source.transitionModelReference, reference('world_player_batter_run_transition_models', state.model));
    assert.deepEqual(state.model.source.runnerModelReference, reference('world_player_runner_decision_motion_models', state.model.runnerModel));
    assert.deepEqual(state.model.runnerModel.person, actor.person);
    assert.equal(state.playerId, actor.binding.playerId); assert.equal(state.personId, actor.binding.personId);
    assert.deepEqual(state.state.planarVelocity, { x: 0, z: 0 }); assert.equal(state.motionIssued, false);
    const geometry = nativeBatterRunCheckpointGeometry(actor.binding, root, response, posture);
    assert(geometry.distance > 0 && response.field.motion.cursor, 'IFN01 original batter geometry missing');
    assert.deepEqual(state.root.position.x, geometry.start.x); assert.deepEqual(state.root.position.z, geometry.start.z);
    assert.deepEqual(state.source.bodyForwardUnit, { x: geometry.delta.x / geometry.distance, z: geometry.delta.z / geometry.distance });
    const throughTick = response.evaluationTick + 10, endTick = throughTick + 1;
    assert(endTick <= Math.min(...response.field.motion.actors.map(a => a.primitive.endTick)), 'IFN01 original batter coverage differs');
    mark('run-original-unperformed-plan-and-batter-motion');
    const batterRun = completeNativeBatterRunPlanCheckpoint(h, root, response, 'in-flight-fixture:batter-run',
      { state, ...geometry, throughTick, endTick });
    mark('run-original-remaining-hold-terminal-total-scoring-next-actor');
    completeInFlightBattingAfterBatterRun(h, { root }, batterRun, caught,
      { posture, capture, delivery, input: battingInput, emotion, commitment }, originalHeads, mark);
    for (const history of saved) assert.equal(json(rows(history.table).slice(0, history.rows.length)), json(history.rows), 'IFN01 retained prefix history changed: ' + history.table);
    originalPrefixHistoryUnchanged = true;
    passed = true;
  } finally {
    const closeErrors: unknown[] = [];
    for (const store of stores.reverse()) { try { store.close(); } catch (error) { closeErrors.push(error); } }
    const originalUnchanged = createHash('sha256').update(readFileSync(capturedInput.checkpointGzip)).digest('hex') === pin.gzipSha256;
    const result = { kind: 'ifn01_cp10_batter_plan_suffix_result_v1',
      originalCp273Prefix: { ...pin.originalCp273, boundary: 'catch-response:6 and cut31 TOTALs',
        originalRunOutcome: 'FAILED_WALL_CAP', earlierAssertionsRerun: false },
      retainedPrefix: { sourceCommit: pin.sourceCommit, sourceTree: pin.sourceTree, databaseSha256: pin.databaseSha256,
        boundary: 'cut31/32, catch-response:7 and original runner/recovery/exit-state accepted; plan open/accept unperformed',
        originalRunOutcome: 'FAILED_TYPED_DEPENDENT_PLAN_CLAIM', completedOwnersReplayed: false, earlierAssertionsRerun: false },
      historicalProvenance: { checkpointReceiptSha256: pin.receiptSha256, tableCensusSha256: pin.censusSha256,
        failedTerminalSha256: pin.terminalSha256, sourceIdentityBasis: 'previously_audited_checkpoint', privateWitnessFilesRechecked: witnessRecheck },
      continuedSuffix: passed && closeErrors.length === 0 && originalUnchanged ? 'PASS' : 'FAILED',
      lastPhase: phase, allHandlesClosed: closeErrors.length === 0, originalCheckpointUnchanged: originalUnchanged,
      originalPrefixHistoryUnchanged, wholeCasePass: false, databasePath: path };
    writeFileSync(join(capturedInput.destinationDirectory, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    if (closeErrors.length) throw new AggregateError(closeErrors, 'IFN01 suffix owner cleanup failed');
    assert(originalUnchanged, 'IFN01 original checkpoint changed');
  }
};
