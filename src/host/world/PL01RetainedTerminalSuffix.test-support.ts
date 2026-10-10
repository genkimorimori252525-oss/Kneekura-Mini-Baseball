import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { readCurrentSamePaLifecycleViewFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePhysicalPlateAppearanceActorStore, type AcceptedPhysicalPlateAppearanceActor } from './SqlitePhysicalPlateAppearanceActorStore';
import { officialPitchWorkloadParticipationAuthority } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqlitePlayerBattingModelStore } from './SqlitePlayerBattingModelStore';
import { openSqlitePlayerBodyCapabilityMaterializationStore } from './SqlitePlayerBodyCapabilityMaterializationStore';
import { openSqliteBattingPerceptionStore } from './SqliteBattingPerceptionStore';
import { openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceLifecycleOutcomeStore } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
import { openSqliteSamePlateAppearanceTerminalEndpointStore } from './SamePlateAppearanceTerminalEndpointFromSqlite';
import { openSqliteSamePlateAppearanceTerminalSettlementStore } from './SqliteSamePlateAppearanceTerminalSettlementStore';
import { completeSamePaFrozenTerminalFixture } from './SamePlateAppearanceTerminalLifecycleFixture.test-support';
import { finishSamePaPhysicalWalkFixture } from './SamePlateAppearanceOccupiedContinuation.test-support';
import { preparePL01RetainedCheckpoint, type PL01RetainedSuffixInput } from './PL01RetainedCheckpoint.test-support';
import type { AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import type { BodyMaterializationRequest } from './PlayerBodyCapabilityMaterialization';

/** Reopens only the exact PL01 cp173 boundary. Owner readers authenticate all
 * recovered values. The original shared suffix owns every subsequent effect;
 * no TAKE prefix, model receipt, workload AFTER, or official result is recreated. */
export const runPL01RetainedTerminalSuffix = (input: PL01RetainedSuffixInput, log: (phase: string) => void = () => {}) => {
  const { path, pin, input: capturedInput, witnessRecheck } = preparePL01RetainedCheckpoint(input), stores: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
  let phase = 'open-private-checkpoint', passed = false;
  const mark = (name: string) => { phase = name; log(name); };
  try {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = track(new DatabaseSync(path));
    assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
    const beforeActivities = db.prepare('SELECT * FROM world_player_workload_activities ORDER BY source_id').all();
    assert.equal(beforeActivities.length, 1); assert.equal(beforeActivities[0].source_id, 'prior-independent-native-fixture-work');
    const saved = json(['pa_physical_v1_launches', 'pa_physical_v1_pitch_consumers', 'pa_physical_v1_consumptions', 'pa_physical_v1_admissions']
      .map(table => db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()));
    const links = track(openSqlitePlayerPersonLinkStore(path));
    const world = track(openSqliteWorldSettlementStore(path)), roster = track(openSqliteManagerRosterDecisionStore(path));
    const official = track(new SqliteOfficialStateStore(path)), fixtureBinding = official.getOfficialFixture('game-1');
    assert(fixtureBinding, 'PL01 original official fixture missing');
    const participation = track(new SqliteOfficialParticipationStore(path,
      officialPitchWorkloadParticipationAuthority(world, roster, links, fixtureBinding)));
    const initialWorlds = track(openSqliteOfficialInitialWorldStore(path, { matches: official, participation }));
    const initial = initialWorlds.readAcceptedSource('initial-world'); assert(initial, 'PL01 original initial World missing');
    const actorSources = new Map<string, AcceptedPhysicalPlateAppearanceActor>();
    const actors = track(openSqlitePhysicalPlateAppearanceActorStore(path, { matches: official, initialWorlds, participation },
      { readAcceptedActor: id => actorSources.get(id) ?? null }));
    const actor = actors.read('batter-1'); assert(actor, 'PL01 original actor missing');
    assert.equal(actor.match.ruleProfileId, 'npb-2026'); assert.equal(actor.match.playId, 7); assert.equal(actor.binding.playerId, 'away-1');

    mark('authenticate-original-terminal-owners');
    const enrollmentOwner = track(openSqliteSamePlateAppearanceEnrollmentStore(path));
    const originalEnrollment = enrollmentOwner.readHistorical('native-enrollment');
    assert(originalEnrollment?.kind === 'reserved', 'PL01 original enrollment missing');
    const outcomes = track(openSqliteSamePlateAppearanceLifecycleOutcomeStore(path));
    const outcome = outcomes.readOutcome('physical-fixture:terminal:outcome');
    assert(outcome?.kind === 'same_pa_lifecycle_outcome' && outcome.source.kind === 'count_terminal', 'PL01 original count outcome missing');
    const endpoints = track(openSqliteSamePlateAppearanceTerminalEndpointStore(path));
    const endpoint = endpoints.read('physical-fixture:terminal:endpoint'); assert(endpoint, 'PL01 original endpoint missing');
    assert.deepEqual(endpoint.actor, actor); assert.deepEqual(endpoint.outcomeReference, reference('pa_lifecycle_v1_outcomes', outcome));
    assert.deepEqual(endpoint.enrollmentReference, reference('same_pa_enrollments', originalEnrollment));
    assert.deepEqual(endpoint.timeline.status, { kind: 'walk', terminalCount: { balls: 4, strikes: 2 } });
    assert.equal(endpoint.participants.length, 10);
    const final = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, endpoint.finalViewReference));
    assert.equal(final.view.cut.stage, 'terminal'); assert.equal(final.view.cut.pitchOrdinal, 6);
    assert.equal(final.view.cut.physicalOperationReference.sourceId, 'physical-fixture:pitch6:resolution');
    assert.deepEqual(endpoint.participants, final.view.participants);
    const settlementOwner = track(openSqliteSamePlateAppearanceTerminalSettlementStore(path, links));
    const frozen = settlementOwner.read('physical-fixture:terminal:settlement'); assert(frozen, 'PL01 original frozen settlement missing');
    assert.equal(createHash('sha256').update(JSON.stringify(frozen)).digest('hex'), pin.freezeResultHash); assert.equal(frozen.kind, 'applying');
    assert(frozen.participants.every(p => !p.applied)); assert.equal(frozen.participants.length, 10);
    assert.deepEqual(frozen.plan.source.terminalReference, reference('pa_terminal_v1_endpoints', endpoint));
    assert.equal(db.prepare('SELECT count(*) n FROM same_pa_participant_reservations WHERE enrollment_source_id=?').get('native-enrollment')!.n, 10);
    for (const table of ['pa_settlement_v1_releases', 'pa_terminal_v1_transitions', 'applications', 'official_scoring_applications']) {
      assert.equal(db.prepare('SELECT count(*) n FROM ' + table).get()!.n, 0);
    }
    settlementOwner.close();

    mark('authenticate-original-occupied-continuation-inputs');
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedAction = dispatch.readAction('native-action'); assert(acceptedAction, 'PL01 original dispatch action missing');
    assert.deepEqual(acceptedAction.source.enrollmentReference, endpoint.enrollmentReference);
    const calibrationIds = db.prepare('SELECT source_id FROM pa_dispatch_v1_execution_calibrations ORDER BY rowid').all().map(row => String(row.source_id));
    const acceptedCalibrations = dispatch.readCalibrationSet(calibrationIds); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const batting = track(openSqlitePlayerBattingModelStore(path)).read(acceptedAction.source.batterModelReference.sourceId);
    assert(batting, 'PL01 original batting model missing'); assert.deepEqual(reference('world_player_batting_models', batting), acceptedAction.source.batterModelReference);
    const receipt = batting.bodyMaterialization, { body, pose, reachCalibration: reach } = receipt;
    const requests = new Map<string, BodyMaterializationRequest>([[receipt.source.sourceId, receipt.source]]);
    const materializations = track(openSqlitePlayerBodyCapabilityMaterializationStore(path, {
      readAcceptedMaterialization: id => requests.get(id) ?? null,
      readAcceptedBody: id => id === body.sourceId ? body : null, readAcceptedPose: id => id === pose.sourceId ? pose : null,
      readAcceptedReachCalibration: id => id === reach.sourceId ? reach : null,
    }));
    assert.deepEqual(materializations.read(receipt.source.sourceId), receipt);
    const posture = track(openSqliteBattingPerceptionStore(path)).readPosture('physical-fixture:second-posture');
    assert(posture?.kind === 'batting_invocation_posture' && posture.source.capability === 'owned_next_take_batting_posture_v1', 'PL01 original scene posture missing');
    assert.deepEqual(posture.model, batting);
    // The production replay authenticates the original baseline policy and
    // Person before this exact accepted Source is reused for the new batter.
    assert(readActualRoleWorkloadState(db, 'career-a', 'p2', undefined, 'intake-p2'));
    const baseline = JSON.parse(String(db.prepare('SELECT source_json FROM world_player_workload_baselines WHERE source_id=?').get('workload')!.source_json)) as AcceptedPlayerWorkloadBaseline;
    assert.equal(baseline.sourceId, 'workload'); assert.equal(baseline.playerId, 'p2');
    const scope = { careerId: actor.person.careerId, playerId: actor.person.playerId, personId: actor.person.personId, personLinkSourceId: actor.person.sourceId };
    const f = { db, path, actor, body, pose, reach, scope, requests, materializations, acceptedCalibrations,
      capability: batting.capability, repertoire: batting.repertoire, decision: batting.decisionModel, equipment: batting.equipment,
      observation: batting.observationCalibration, prediction: batting.predictionCalibration, stance: posture.source.geometry,
      x: { accepted: actorSources, actors, f: { track, links, participation, baseline, firstInput: { worldSetup: initial.source.worldSetup } } },
    };
    const accepted = new Map<string, unknown>();
    const save = <T extends { sourceId: string }>(source: T): T => { accepted.set(source.sourceId, source); return source; };
    const h = { f, accepted, save, original: acceptedAction.source, sceneBodyReferences: [...posture.source.sceneBodyReferences] };
    mark('run-original-shared-terminal-suffix');
    const completed = completeSamePaFrozenTerminalFixture(h, 'physical-fixture:terminal',
      { source: outcome.source, outcome, endpoint, originalEnrollment, beforeActivities }, { outcomes, endpoints, enrollmentOwner });
    mark('run-original-shared-reopen-and-occupied-next-pitch');
    finishSamePaPhysicalWalkFixture(h, completed, saved);
    passed = true;
  } finally {
    const closeErrors: unknown[] = [];
    for (const store of stores.reverse()) { try { store.close(); } catch (error) { closeErrors.push(error); } }
    const originalUnchanged = createHash('sha256').update(readFileSync(capturedInput.checkpointGzip)).digest('hex') === pin.gzipSha256;
    const result = { kind: 'pl01_retained_terminal_suffix_result_v1',
      retainedPrefix: { sourceCommit: pin.sourceCommit, sourceTree: pin.sourceTree, databaseSha256: pin.databaseSha256,
        boundary: 'six-TAKE walk, terminal outcome/endpoint and frozen ten-participant plan; zero settlement effects' },
      historicalProvenance: { originalRunControlSha256: pin.runControlSha256, checkpointReceiptSha256: pin.receiptSha256,
        sourceIdentityBasis: 'previously_audited_checkpoint', privateWitnessFilesRechecked: witnessRecheck },
      continuedSuffix: passed && closeErrors.length === 0 && originalUnchanged ? 'PASS' : 'FAILED',
      lastPhase: phase, allHandlesClosed: closeErrors.length === 0, originalCheckpointUnchanged: originalUnchanged,
      wholeCasePass: false, databasePath: path };
    writeFileSync(join(capturedInput.destinationDirectory, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    if (closeErrors.length) throw new AggregateError(closeErrors, 'PL01 suffix owner cleanup failed');
    assert(originalUnchanged, 'PL01 original checkpoint changed');
  }
};
