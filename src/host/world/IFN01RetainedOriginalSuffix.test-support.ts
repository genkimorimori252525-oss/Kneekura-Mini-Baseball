import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePhysicalPlateAppearanceActorStore, type AcceptedPhysicalPlateAppearanceActor } from './SqlitePhysicalPlateAppearanceActorStore';
import { officialPitchWorkloadParticipationAuthority } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceLifecycleOutcomeStore, readSamePaLifecycleOutcomeFromSqlite } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
import { openSqliteSamePlateAppearanceTerminalEndpointStore, readSamePaTerminalEndpointFromSqlite } from './SamePlateAppearanceTerminalEndpointFromSqlite';
import { openSqliteSamePlateAppearanceTerminalSettlementStore } from './SqliteSamePlateAppearanceTerminalSettlementStore';
import { readSamePaTerminalSettlementFromSqlite } from './SamePlateAppearanceTerminalSettlementFromSqlite';
import { openSqliteSamePlateAppearanceTerminalTransitionStore } from './SqliteSamePlateAppearanceTerminalTransitionStore';
import { readSamePaTerminalTransitionFromSqlite, readSamePaTransitionArchive } from './SamePlateAppearanceTerminalTransitionFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { openSqliteSamePlateAppearanceCatchWorkStore, readSamePaCatchWorkFromSqlite } from './SamePlateAppearanceCatchWorkFromSqlite';
import { readSamePaAdmittedLiveWorkFromSqlite } from './SamePlateAppearanceAdmittedLiveWorkFromSqlite';
import { openSqliteActualPostPlayReviewStore } from './SqliteActualPostPlayReviewStore';
import { nativeReservedCatchReviewReplay } from './SamePlateAppearanceCatchReviewNative.test-support';
import { completeSamePaTerminalReleaseFixture } from './SamePlateAppearanceTerminalLifecycleFixture.test-support';
import { completeNativeFairCatchTerminalReadback } from './SamePlateAppearanceFairCatchTerminalNative.test-support';
import { prepareIFN01RetainedCheckpoint, type IFN01RetainedSuffixInput } from './IFN01RetainedCheckpoint.test-support';

/** Exact cp13 after the original transition returned. Authentication reads the
 * accepted owners; only the unreturned release and remaining original checks run.
 * Earlier review, cut40, endpoint, freeze, settle and transition are historical. */
export const runIFN01RetainedOriginalSuffix = (input: IFN01RetainedSuffixInput, log: (phase: string) => void = () => {}) => {
  const { path, pin, input: capturedInput, witnessRecheck } = prepareIFN01RetainedCheckpoint(input);
  const stores: { close(): void }[] = [];
  let verifyHistory = () => false;
  const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
  let phase = 'open-private-checkpoint', passed = false, originalPrefixHistoryUnchanged = false;
  const mark = (name: string) => { phase = name; log(name); };
  const label = 'in-flight-fixture:fair-terminal';
  try {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = track(new DatabaseSync(path));
    assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
    assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='table'").get()!.n, pin.tableCount);
    const locator = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => {
      const row = db.prepare('SELECT source_hash,snapshot_hash FROM ' + owner + ' WHERE source_id=?').get(sourceId);
      assert(row, 'IFN01 retained original locator missing: ' + sourceId);
      return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
    };
    const rows = (table: string) => db.prepare('SELECT rowid,* FROM main."' + table.replaceAll('"', '""') + '" ORDER BY rowid').all();
    // Only release removes the original leases. Only its archive and the next
    // actor may append rows; existing match/workload AFTER and all histories stay.
    const saved = db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' ORDER BY name").all()
      .map(({ name, sql }) => ({ table: String(name), sql, rows: rows(String(name)) }));
    verifyHistory = () => {
      for (const history of saved) {
        assert.equal(db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name=?").get(history.table)?.sql, history.sql);
        if (history.table === 'same_pa_participant_reservations') continue;
        const current = rows(history.table), append = ['pa_settlement_v1_releases', 'physical_plate_appearance_actors'].includes(history.table);
        assert.equal(json(append ? current.slice(0, history.rows.length) : current), json(history.rows), 'IFN01 retained history changed: ' + history.table);
      }
      return true;
    };
    assert.equal(rows('pa_settlement_v1_releases').length, 0);
    assert.equal(rows('same_pa_participant_reservations').length, 10);
    assert.equal(rows('world_player_workload_activities').length, 11);
    for (const table of ['pa_lifecycle_v1_outcomes', 'pa_terminal_v1_endpoints', 'pa_settlement_v1_plans',
      'pa_terminal_v1_transitions', 'applications', 'official_scoring_applications', 'physical_plate_appearance_actors']) assert.equal(rows(table).length, 1);

    mark('authenticate-original-terminal-and-current-settled-after-state');
    const links = track(openSqlitePlayerPersonLinkStore(path));
    const enrollmentOwner = track(openSqliteSamePlateAppearanceEnrollmentStore(path));
    const originalEnrollment = enrollmentOwner.readHistorical('native-enrollment');
    assert(originalEnrollment?.kind === 'reserved', 'IFN01 original enrollment missing');
    // All completed runtime values come from the original readers in one existing
    // immutable read phase. No proof crosses the later release mutation.
    const restored = withSqliteReadTransaction(db, () => withSamePaLifecycleReadPhase(db, () => {
      const endpointPin = locator('pa_terminal_v1_endpoints', label + ':endpoint');
      assert.equal(endpointPin.snapshotHash, pin.endpointSnapshotHash);
      const endpoint = readSamePaTerminalEndpointFromSqlite(db, endpointPin, 'historical');
      const outcome = readSamePaLifecycleOutcomeFromSqlite(db, endpoint.outcomeReference);
      assert(outcome.source.kind === 'fair_catch', 'IFN01 original fair-catch outcome missing');
      assert.equal(endpoint.outcomeReference.snapshotHash, pin.outcomeSnapshotHash);
      const settlementPin = locator('pa_settlement_v1_plans', label + ':settlement');
      assert.equal(settlementPin.snapshotHash, pin.settlementSnapshotHash);
      const settled = readSamePaTerminalSettlementFromSqlite(db, settlementPin);
      assert.equal(settled.kind, 'settled'); assert(settled.participants.every(p => p.applied));
      // Current mode authenticates all actual workload AFTER heads, official and
      // scoring effects, and the current match, through the production owner.
      const current = readSamePaTerminalTransitionFromSqlite(db, endpointPin, 'current');
      assert(current.kind === 'completed', 'IFN01 committed transition missing');
      assert.equal(current.reference.sourceId, label + ':transition');
      assert.equal(current.reference.snapshotHash, pin.transitionSnapshotHash);
      const transition = readSamePaTransitionArchive(db, current.reference.sourceId);
      assert(transition, 'IFN01 original transition archive missing');
      assert.deepEqual(reference('pa_terminal_v1_transitions', transition), current.reference);
      assert.deepEqual(transition.source.settlementReference, settled.reference);
      assert.deepEqual(endpoint.enrollmentReference, reference('same_pa_enrollments', originalEnrollment));
      assert.equal(endpoint.finalViewReference.sourceId, 'physical-fixture:cut40:view');
      const sealedReference = outcome.source.physicalOperationReference;
      assert(sealedReference.owner === 'pa_physical_v1_field_steps', 'IFN01 cp13 requires its original field-step seal owner');
      const sealed = readSamePaPhysicalOperationFromSqlite(db, { ...sealedReference, owner: sealedReference.owner }).record;
      assert(sealed.kind === 'same_pa_physical_field_step_v1' && sealed.actionResult?.kind === 'retained_quantizer_checkpoint_v1');
      assert.equal(reference('pa_physical_v1_field_steps', sealed).snapshotHash, pin.sealSnapshotHash);
      const work = readSamePaCatchWorkFromSqlite(db, outcome.source.catchWorkReference);
      assert.equal(reference('pa_catch_v1_work', work).snapshotHash, pin.workSnapshotHash);
      const admitted = readSamePaAdmittedLiveWorkFromSqlite(db, outcome.source.viewReference, 'historical');
      assert(admitted.kind === 'same_pa_live_work_read_v1' && admitted.communication.kind === 'owned_same_pa_catch_communication_v1');
      assert.equal(outcome.source.viewReference.sourceId, 'physical-fixture:cut39:view');
      assert.deepEqual(admitted.communication.latestReference, outcome.source.catchWorkReference);
      return { endpoint, outcome, settled, transition, sealed, work, admitted };
    }));
    const { endpoint, outcome, settled, transition, sealed, work, admitted } = restored, actor = outcome.actor;
    assert.equal(actor.source.sourceId, 'batter-1'); assert.equal(actor.match.playId, 7); assert.equal(actor.binding.playerId, 'away-1');
    const world = track(openSqliteWorldSettlementStore(path)), roster = track(openSqliteManagerRosterDecisionStore(path));
    const official = track(new SqliteOfficialStateStore(path)), fixtureBinding = official.getOfficialFixture('game-1');
    assert(fixtureBinding, 'IFN01 original official fixture missing');
    const participation = track(new SqliteOfficialParticipationStore(path,
      officialPitchWorkloadParticipationAuthority(world, roster, links, fixtureBinding)));
    const initialWorlds = track(openSqliteOfficialInitialWorldStore(path, { matches: official, participation }));
    const actorSources = new Map<string, AcceptedPhysicalPlateAppearanceActor>();
    const sources = { matches: official, initialWorlds, participation };
    const actors = track(openSqlitePhysicalPlateAppearanceActorStore(path, sources, { readAcceptedActor: id => actorSources.get(id) ?? null }));
    const h = { f: { db, path, actor, x: { accepted: actorSources, actors, sources, f: { track, links } } } };
    const outcomes = track(openSqliteSamePlateAppearanceLifecycleOutcomeStore(path));
    const endpoints = track(openSqliteSamePlateAppearanceTerminalEndpointStore(path));
    const settlements = track(openSqliteSamePlateAppearanceTerminalSettlementStore(path, links));
    const transitions = track(openSqliteSamePlateAppearanceTerminalTransitionStore(path));
    const works = track(openSqliteSamePlateAppearanceCatchWorkStore(path));
    const reviewOwner = track(openSqliteActualPostPlayReviewStore(path)), session = { sourceId: label + ':review:session' };
    const value = reviewOwner.readCurrent(session.sourceId); assert(value?.kind === 'official_ready', 'IFN01 completed original review missing');
    const reviewPin = { sessionSourceId: session.sourceId, revision: value.revision, headSourceId: value.headSourceId, headHash: value.headHash };
    assert.equal(value.revision, 3); assert.equal(value.headHash, pin.reviewHeadHash);
    assert.deepEqual(outcome.postPlayReview?.reference, reviewPin);
    const reviewRows = () => json(['actual_post_play_review_sessions', 'actual_post_play_review_events', 'actual_post_play_review_heads']
      .map(table => db.prepare('SELECT * FROM main.' + table + ' ORDER BY rowid').all()));
    const review = { pin: reviewPin, assertHistoricalReplay: nativeReservedCatchReviewReplay(reviewOwner, session, value, reviewRows, reviewRows()) };
    mark('run-original-release-and-terminal-readback');
    const completed = completeSamePaTerminalReleaseFixture(h, { outcome, endpoint, settled, transition, originalEnrollment },
      { outcomes, endpoints, settlements, transitions, enrollmentOwner });
    mark('run-original-review-history-scoring-and-next-actor-checks');
    completeNativeFairCatchTerminalReadback(h, { sealed, work, admitted, completed, review }, works, label);
    mark('release-readback-scoring-next-batter-complete');
    passed = true;
  } finally {
    const closeErrors: unknown[] = [];
    let historyError: unknown;
    try { originalPrefixHistoryUnchanged = verifyHistory(); } catch (error) { historyError = error; }
    for (const store of stores.reverse()) { try { store.close(); } catch (error) { closeErrors.push(error); } }
    const originalUnchanged = createHash('sha256').update(readFileSync(capturedInput.checkpointGzip)).digest('hex') === pin.gzipSha256;
    const result = { kind: 'ifn01_cp13_release_suffix_result_v1',
      originalCp273Prefix: { ...pin.originalCp273, originalRunOutcome: 'FAILED_WALL_CAP', earlierAssertionsRerun: false },
      priorCp10: { ...pin.priorCp10, originalRunOutcome: 'FAILED_TYPED_DEPENDENT_PLAN_CLAIM', earlierAssertionsRerun: false },
      priorCp35: { ...pin.priorCp35, originalRunOutcome: 'FAILED_DUPLICATE_FRONTIER_WORK_IDS', earlierAssertionsRerun: false },
      retainedPrefix: { sourceCommit: pin.sourceCommit, sourceTree: pin.sourceTree, databaseSha256: pin.databaseSha256,
        boundary: 'cp13: review, cut40, endpoint, freeze, all ten workload effects and official transition committed; release unreturned',
        originalRunOutcome: 'FAILED_WALL_CAP', elapsedSeconds: 14400.107409088, earlierAssertionsRerun: false,
        completedEffectsReapplied: false, originalSameSourceReadbackRetriesPreserved: true },
      historicalProvenance: { checkpointReceiptSha256: pin.receiptSha256, tableCensusSha256: pin.censusSha256,
        failedTerminalSha256: pin.terminalSha256, vitestReportSha256: pin.vitestSha256, publicCommit: pin.publicCommit,
        returnedTransitionResultHash: pin.transitionResultHash, privateWitnessFilesRechecked: witnessRecheck },
      continuedSuffix: passed && originalPrefixHistoryUnchanged && closeErrors.length === 0 && originalUnchanged ? 'PASS' : 'FAILED',
      lastPhase: phase, allHandlesClosed: closeErrors.length === 0, originalCheckpointUnchanged: originalUnchanged,
      originalPrefixHistoryUnchanged, mutableProjection: 'same_pa_participant_reservations',
      originalAssertions: 'remaining release, terminal same-source readback, review history, scoring, next-actor and catch-work readback only',
      wholeCasePass: false, databasePath: path };
    writeFileSync(join(capturedInput.destinationDirectory, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    if (historyError) closeErrors.push(historyError);
    if (closeErrors.length) throw new AggregateError(closeErrors, 'IFN01 suffix owner cleanup failed');
    assert(originalUnchanged, 'IFN01 original checkpoint changed');
  }
};
