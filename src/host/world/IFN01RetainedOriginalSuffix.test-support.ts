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
import { prepareSamePaLifecycleFixture } from './SamePlateAppearanceLifecycleFixture.test-support';
import type { SamePaPhysicalLifecycleSuffix } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { completeNativeFairCatchTerminalReview } from './SamePlateAppearanceFairCatchTerminalNative.test-support';
import { readSamePaAdmittedLiveWorkFromSqlite } from './SamePlateAppearanceAdmittedLiveWorkFromSqlite';
import { prepareIFN01RetainedCheckpoint, type IFN01RetainedSuffixInput } from './IFN01RetainedCheckpoint.test-support';

/** Only the exact returned final cp35. Every retained runtime value is read
 * through its owner. Completed batter, hold, seal and work writers never run.
 * The acceptance entry deliberately remains outside ordinary *.test runs. */
export const runIFN01RetainedOriginalSuffix = (input: IFN01RetainedSuffixInput, log: (phase: string) => void = () => {}) => {
  const { path, pin, input: capturedInput, witnessRecheck } = prepareIFN01RetainedCheckpoint(input);
  const stores: { close(): void }[] = [];
  let verifyHistory = () => false;
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
    const rows = (table: string) => db.prepare('SELECT rowid,* FROM main."' + table.replaceAll('"', '""') + '" ORDER BY rowid').all();
    // The original suffix deliberately updates these three live projections.
    // Its unchanged assertions verify settlement effects, release and next match.
    // Every other existing row, including all original histories, is conserved.
    const mutable = ['matches', 'world_player_workload_heads', 'same_pa_participant_reservations'];
    const saved = db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' ORDER BY name").all()
      .filter(({ name }) => !mutable.includes(String(name)))
      .map(({ name, sql }) => ({ table: String(name), sql, rows: rows(String(name)) }));
    verifyHistory = () => {
      for (const history of saved) {
        assert.equal(db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name=?").get(history.table)?.sql, history.sql);
        assert.equal(json(rows(history.table).slice(0, history.rows.length)), json(history.rows), 'IFN01 retained history changed: ' + history.table);
      }
      return true;
    };
    assert.equal(rows('pa_lifecycle_v1_work_prefixes').length, 39);
    assert.equal(rows('pa_lifecycle_v1_total_assessments').length, 390);
    assert.equal(rows('pa_lifecycle_v1_execution_views').length, 39);
    assert.equal(rows('pa_lifecycle_v1_execution_calibrations').length, 1250);
    assert.equal(db.prepare('SELECT count(*) n FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('physical-fixture:cut39:view')!.n, 1);
    for (const table of ['pa_lifecycle_v1_outcomes', 'pa_terminal_v1_endpoints', 'pa_settlement_v1_releases',
      'pa_terminal_v1_transitions', 'applications', 'official_scoring_applications',
      'actual_post_play_review_sessions', 'actual_post_play_review_events', 'actual_post_play_review_heads']) {
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
    readIFN01RetainedWorkloadHeads(db, enrollment, participation);
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
    const lifecycle = track(openSqliteSamePlateAppearanceLifecycleStore(path));
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path));

    mark('authenticate-original-cut39-seal-and-catch-work');
    // One exact set read inside an existing immutable operation scope. No proof
    // survives this read group or is reused across a subsequent owner mutation.
    const restored = withSqliteReadTransaction(db, () => withSamePaLifecycleReadPhase(db, () => {
      const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', 'physical-fixture:cut39:prefix');
      assert(prefix?.kind === 'same_pa_lifecycle_prefix', 'IFN01 cut39 original prefix missing');
      const basis = readCurrentSamePaLifecycleViewFromSqlite(db, locator('pa_lifecycle_v1_execution_views', 'physical-fixture:cut39:view'));
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', prefix.lineage.participantReferences.map(p => 'physical-fixture:cut39:total:' + p.playerId))
        .map(t => { assert(t?.kind === 'same_pa_lifecycle_total', 'IFN01 cut39 TOTAL missing'); return t; });
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', acceptedCalibrations.calibrations.map(c => 'physical-fixture:cut39:' + c.source.sourceId))
        .map(c => { assert(c?.kind === 'same_pa_lifecycle_calibration', 'IFN01 cut39 calibration missing'); return c; });
      return { prefix, basis, totals, calibrations };
    }));
    const { prefix, totals, calibrations } = restored, view = restored.basis.view;
    assert.equal(prefix.source.eventReferences.length, 39);
    assert.deepEqual(prefix.source.enrollmentReference, acceptedAction.source.enrollmentReference);
    assert.equal(prefix.source.anchorViewReference.sourceId, 'physical-fixture:anchor:view');
    assert.equal(prefix.previousViewReference.sourceId, 'physical-fixture:cut38:view');
    const prefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix), viewReference = reference('pa_lifecycle_v1_execution_views', view);
    assert.deepEqual(view.source.prefixReference, prefixReference);
    assert.equal(totals.length, 10); assert.equal(calibrations.length, 32);
    const participantTotalReferences = totals.map(t => ({ playerId: t.source.participantReference.playerId,
      assessmentReference: reference('pa_lifecycle_v1_total_assessments', t) }));
    assert.deepEqual(participantTotalReferences, view.source.participantTotalReferences);
    for (const total of totals) { assert.deepEqual(total.source.prefixReference, prefixReference); assert.equal(total.effortUnits, 2); }
    for (const calibration of calibrations) assert.deepEqual(calibration.source.viewReference, viewReference);
    assert.equal(viewReference.snapshotHash, pin.viewSnapshotHash);
    const sealPin = locator('pa_physical_v1_field_steps', 'in-flight-fixture:fair-terminal:seal');
    const sealed = physical.readOperation(sealPin).record;
    assert(sealed.kind === 'same_pa_physical_field_step_v1' && sealed.actionResult?.kind === 'retained_quantizer_checkpoint_v1');
    assert.equal(sealPin.snapshotHash, pin.sealSnapshotHash);
    assert.equal(sealed.source.previousOperationReference.sourceId, 'in-flight-fixture:batter-hold:motion');
    assert.deepEqual(prefix.cut.physicalOperationReference, sealPin);
    const head = db.prepare('SELECT * FROM pa_physical_v1_heads').all(); assert.equal(head.length, 1);
    assert.equal(head[0].last_owner, sealPin.owner); assert.equal(head[0].last_source_id, sealPin.sourceId);
    assert.equal(head[0].last_snapshot_hash, sealPin.snapshotHash);
    const works = track(openSqliteSamePlateAppearanceCatchWorkStore(path));
    const work = works.read('in-flight-fixture:fair-terminal:catch-work');
    assert(work, 'IFN01 original terminal catch work missing');
    const workReference = reference('pa_catch_v1_work', work);
    assert.equal(workReference.snapshotHash, pin.workSnapshotHash);
    assert.deepEqual(prefix.source.eventReferences.at(-1), workReference);
    assert.deepEqual(prefix.cut.operationReference, workReference);
    assert.deepEqual(work.physicalOperationReference, sealPin);
    assert.deepEqual(work.source.enrollmentReference, acceptedAction.source.enrollmentReference);
    assert.equal(work.source.viewReference.sourceId, 'physical-fixture:cut38:view');
    assert.equal(work.source.priorWorkReference?.sourceId, 'in-flight-fixture:batter-hold:work');
    const admitted = withSqliteReadTransaction(db, () => readSamePaAdmittedLiveWorkFromSqlite(db, viewReference, 'current'));
    assert(admitted.kind === 'same_pa_live_work_read_v1' && admitted.communication.kind === 'owned_same_pa_catch_communication_v1');
    assert.deepEqual(admitted.communication.latestReference, workReference);

    // Recover the declarations actually accepted at cut39. Their owner proofs
    // above include original nominal, member, Person and reference authentication.
    const calibration = (id: string) => {
      const matches = calibrations.filter(c => c.source.sourceId === 'physical-fixture:cut39:native-calibration:' + id);
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
    mark('run-original-catch-review-outcome-settlement-transition-scoring-next-actor');
    completeNativeFairCatchTerminalReview(h, sealed, work, admitted, works, 'in-flight-fixture:fair-terminal');
    mark('review-total-scoring-next-batter-complete');
    passed = true;
  } finally {
    const closeErrors: unknown[] = [];
    let historyError: unknown;
    try { originalPrefixHistoryUnchanged = verifyHistory(); } catch (error) { historyError = error; }
    for (const store of stores.reverse()) { try { store.close(); } catch (error) { closeErrors.push(error); } }
    const originalUnchanged = createHash('sha256').update(readFileSync(capturedInput.checkpointGzip)).digest('hex') === pin.gzipSha256;
    const result = { kind: 'ifn01_cp35_review_suffix_result_v1',
      originalCp273Prefix: { ...pin.originalCp273, boundary: 'catch-response:6 and cut31 TOTALs',
        originalRunOutcome: 'FAILED_WALL_CAP', earlierAssertionsRerun: false },
      priorCp10: { ...pin.priorCp10, originalRunOutcome: 'FAILED_TYPED_DEPENDENT_PLAN_CLAIM', earlierAssertionsRerun: false },
      retainedPrefix: { sourceCommit: pin.sourceCommit, sourceTree: pin.sourceTree, databaseSha256: pin.databaseSha256,
        boundary: 'final cp35: batter run, received hold, seal, terminal catch work and cut39 calibrations committed; CatchReview unperformed',
        originalRunOutcome: 'FAILED_DUPLICATE_FRONTIER_WORK_IDS', completedOwnersReplayed: false, earlierAssertionsRerun: false },
      historicalProvenance: { checkpointReceiptSha256: pin.receiptSha256, tableCensusSha256: pin.censusSha256,
        failedTerminalSha256: pin.terminalSha256, failedVitestSha256: pin.vitestSha256, publicCommit: pin.publicCommit, sourceIdentityBasis: 'previously_audited_checkpoint', privateWitnessFilesRechecked: witnessRecheck },
      continuedSuffix: passed && originalPrefixHistoryUnchanged && closeErrors.length === 0 && originalUnchanged ? 'PASS' : 'FAILED',
      lastPhase: phase, allHandlesClosed: closeErrors.length === 0, originalCheckpointUnchanged: originalUnchanged,
      originalPrefixHistoryUnchanged, mutableProjections: ['matches', 'world_player_workload_heads', 'same_pa_participant_reservations'],
      originalAssertions: 'remaining CatchReview, fair-catch outcome, terminal TOTAL/settlement/transition, scoring and next-actor assertions only',
      wholeCasePass: false, databasePath: path };
    writeFileSync(join(capturedInput.destinationDirectory, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    if (historyError) closeErrors.push(historyError);
    if (closeErrors.length) throw new AggregateError(closeErrors, 'IFN01 suffix owner cleanup failed');
    assert(originalUnchanged, 'IFN01 original checkpoint changed');
  }
};
