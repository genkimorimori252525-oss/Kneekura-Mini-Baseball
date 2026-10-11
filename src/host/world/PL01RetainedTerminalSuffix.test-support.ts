import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { readHistoricalSamePaLifecycleViewFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
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
import { openSqliteSamePlateAppearanceTerminalTransitionStore } from './SqliteSamePlateAppearanceTerminalTransitionStore';
import { openSqlitePlayerRunnerDecisionMotionModelStore } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { continueSamePaOccupiedWalkFromBaselineFixture, type SamePaPreparedOccupiedWalkFixture } from './SamePlateAppearanceOccupiedContinuation.test-support';
import { preparePL01RetainedCheckpoint, type PL01RetainedSuffixInput } from './PL01RetainedCheckpoint.test-support';
import type { AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import type { BodyMaterializationRequest } from './PlayerBodyCapabilityMaterialization';

/** Reopens only the exact corrected PL01-R2 cp1 boundary. Readers authenticate all
 * recovered values. The original occupied tail owns every subsequent effect;
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
    const priorActivities = db.prepare('SELECT * FROM world_player_workload_activities ORDER BY source_id').all();
    assert.equal(priorActivities.length, 11); assert(priorActivities.some(row => row.source_id === 'prior-independent-native-fixture-work'));
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

    mark('authenticate-already-completed-terminal-owners');
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
    const final = withSqliteReadTransaction(db, () => readHistoricalSamePaLifecycleViewFromSqlite(db, endpoint.finalViewReference));
    assert.equal(final.view.cut.stage, 'terminal'); assert.equal(final.view.cut.pitchOrdinal, 6);
    assert.equal(final.view.cut.physicalOperationReference.sourceId, 'physical-fixture:pitch6:resolution');
    assert.deepEqual(endpoint.participants, final.view.participants);
    const settlementOwner = track(openSqliteSamePlateAppearanceTerminalSettlementStore(path, links));
    const settled = settlementOwner.read('physical-fixture:terminal:settlement'); assert(settled, 'PL01 completed settlement missing');
    assert.equal(settled.kind, 'settled'); assert(settled.participants.every(p => p.applied)); assert.equal(settled.participants.length, 10);
    assert.deepEqual(settled.plan.source.terminalReference, reference('pa_terminal_v1_endpoints', endpoint));
    const transition = track(openSqliteSamePlateAppearanceTerminalTransitionStore(path)).read('physical-fixture:terminal:transition');
    assert(transition, 'PL01 completed official transition missing');
    const release = settlementOwner.readRelease('physical-fixture:terminal:settlement'); assert(release, 'PL01 original release missing');
    assert.equal(release.memberRows.length, 10); assert.deepEqual(release.settlementReference, settled.reference);
    assert.deepEqual(release.transitionReference, reference('pa_terminal_v1_transitions', transition));
    assert.deepEqual(transition.source.terminalReference, reference('pa_terminal_v1_endpoints', endpoint));
    assert.deepEqual(transition.source.settlementReference, settled.reference);
    assert.equal(db.prepare('SELECT count(*) n FROM same_pa_participant_reservations').get()!.n, 0);
    for (const table of ['pa_settlement_v1_releases', 'pa_terminal_v1_transitions', 'applications', 'official_scoring_applications']) {
      assert.equal(db.prepare('SELECT count(*) n FROM ' + table).get()!.n, 1);
    }
    assert.equal(db.prepare('SELECT count(*) n FROM same_pa_enrollments').get()!.n, 1);
    assert.equal(db.prepare('SELECT count(*) n FROM world_player_workload_baselines WHERE player_id=?').get('away-2')!.n, 1);
    assert.equal(db.prepare('SELECT count(*) n FROM world_player_workload_heads WHERE player_id=?').get('away-2')!.n, 1);
    assert.equal(db.prepare('SELECT count(*) n FROM world_player_workload_activities WHERE player_id=?').get('away-2')!.n, 0);
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
    const label = 'physical-fixture:occupied-next';
    mark('authenticate-accepted-next-actor-and-models');
    const nextActor = actors.read(label + ':actor'); assert(nextActor, 'PL01 accepted next actor missing');
    assert('activation' in transition.official, 'PL01 original transition has no next activation');
    assert.deepEqual(nextActor.match, transition.official.activation.nextMatchState);
    assert.deepEqual(nextActor.world, transition.official.nextWorld);
    assert.equal(nextActor.binding.playerId, 'away-2');
    assert.deepEqual(nextActor.source, { sourceId: label + ':actor', sourceVersion: 'fixture-only-v1', gameId: actor.source.gameId,
      playerId: 'away-2', activationApplicationId: transition.source.applicationId });
    // The unchanged occupied helper created this exact Source from its original
    // explicit baseline. Replay authenticates Person, policy, initial state and
    // current head; the completed initialization must never be repeated.
    const nextBaseline = { ...baseline, sourceId: label + ':new-batter-baseline', playerId: nextActor.binding.playerId,
      personLinkSourceId: nextActor.binding.personLinkSourceId };
    assert.equal(nextBaseline.careerId, nextActor.binding.careerId);
    const nextBaselineRow = db.prepare('SELECT * FROM world_player_workload_baselines WHERE source_id=?').get(nextBaseline.sourceId);
    assert(nextBaselineRow, 'PL01 completed new-batter baseline missing');
    assert.equal(nextBaselineRow.source_json, json(nextBaseline));
    assert.deepEqual(links.readLink(nextActor.binding.personLinkSourceId), nextActor.person);
    const nextState = readActualRoleWorkloadState(db, nextActor.binding.careerId, nextActor.binding.playerId, undefined, nextActor.binding.personLinkSourceId);
    assert(nextState, 'PL01 completed new-batter workload head missing'); assert.equal(nextState.revision, 0);
    assert.equal(json(nextState), nextBaselineRow.initial_json);
    assert.equal(createHash('sha256').update(JSON.stringify(nextState)).digest('hex'), pin.newBatterBaselineResultHash);
    const originals = readSamePaOriginalParticipants(db, nextActor); assert.equal(originals.length, 11);
    const nextModelStore = track(openSqlitePlayerBattingModelStore(path));
    const nextBatting = nextModelStore.read(label + ':batter-model'); assert(nextBatting, 'PL01 accepted next batting model missing');
    assert.deepEqual(nextBatting.person, nextActor.person);
    const nextReceipt = nextBatting.bodyMaterialization, nextBody = nextReceipt.body, nextPose = nextReceipt.pose;
    assert.equal(nextReceipt.source.sourceId, label + ':batter-body-composition');
    const nextRequests = new Map([[nextReceipt.source.sourceId, nextReceipt.source]]);
    const nextBodies = new Map([[nextBody.sourceId, nextBody]]), nextPoses = new Map([[nextPose.sourceId, nextPose]]);
    const nextBodyOwner = track(openSqlitePlayerBodyCapabilityMaterializationStore(path, {
      readAcceptedMaterialization: id => nextRequests.get(id) ?? null, readAcceptedBody: id => nextBodies.get(id) ?? null,
      readAcceptedPose: id => nextPoses.get(id) ?? null, readAcceptedReachCalibration: id => id === reach.sourceId ? reach : null,
    }));
    assert.deepEqual(nextBodyOwner.read(nextReceipt.source.sourceId), nextReceipt);
    const runnerReceipt = materializations.read(label + ':runner-body-composition'); assert(runnerReceipt, 'PL01 accepted original runner body missing');
    assert.deepEqual(runnerReceipt.person, actor.person); assert.deepEqual(runnerReceipt.body, body); assert.deepEqual(runnerReceipt.pose, pose);
    const runnerModel = track(openSqlitePlayerRunnerDecisionMotionModelStore(path)).read(label + ':runner-model');
    assert(runnerModel, 'PL01 accepted original runner model missing'); assert.deepEqual(runnerModel.person, actor.person);
    assert.equal(createHash('sha256').update(JSON.stringify(runnerModel)).digest('hex'), pin.runnerModelResultHash);
    // Restore only maps and wrappers around values already authenticated above.
    // No model, body, actor, settlement, transition or release writer is called.
    const modelSource = nextBatting.source, capability = nextBatting.capability, repertoire = nextBatting.repertoire;
    const decision = nextBatting.decisionModel, equipment = nextBatting.equipment;
    const observation = nextBatting.observationCalibration, prediction = nextBatting.predictionCalibration;
    const models = new Map([[modelSource.sourceId, modelSource]]), capabilities = new Map([[capability.sourceId, capability]]),
      repertoires = new Map([[repertoire.sourceId, repertoire]]), decisions = new Map([[decision.sourceId, decision]]),
      equipments = new Map([[equipment.sourceId, equipment]]), observations = new Map([[observation.sourceId, observation]]),
      predictions = new Map([[prediction.sourceId, prediction]]);
    const authority = { readAcceptedModel: (id: string) => models.get(id) ?? null, readAcceptedCapability: (id: string) => capabilities.get(id) ?? null,
      readAcceptedRepertoire: (id: string) => repertoires.get(id) ?? null, readAcceptedDecisionModel: (id: string) => decisions.get(id) ?? null,
      readAcceptedEquipment: (id: string) => equipments.get(id) ?? null, readAcceptedObservationCalibration: (id: string) => observations.get(id) ?? null,
      readAcceptedPredictionCalibration: (id: string) => predictions.get(id) ?? null };
    const accepted = new Map<string, unknown>();
    const save = <T extends { sourceId: string }>(source: T): T => { accepted.set(source.sourceId, source); return source; };
    const h = { f, accepted, save, original: acceptedAction.source, sceneBodyReferences: [...posture.source.sceneBodyReferences] };
    const prepared: SamePaPreparedOccupiedWalkFixture = {
      actor: nextActor, originals, officialBefore: json(db.prepare('SELECT * FROM matches WHERE match_id=?').get(nextActor.source.gameId)),
      accepted, save, scope: { careerId: nextActor.person.careerId, playerId: nextActor.person.playerId,
        personId: nextActor.person.personId, personLinkSourceId: nextActor.person.sourceId },
      body: nextBody, pose: nextPose, bodyResult: { kind: 'materialized', value: nextReceipt }, bodyOwner: nextBodyOwner,
      requests: nextRequests, bodies: nextBodies, poses: nextPoses,
      capability, repertoire, decision, equipment, observation, prediction, modelSource, authority,
      models, capabilities, repertoires, decisions, equipments, observations, predictions, modelStore: nextModelStore, batting: nextBatting,
      runnerBinding: actor.binding, runnerBody: { kind: 'materialized', value: runnerReceipt }, runnerModel,
    };
    mark('run-original-occupied-tail-with-completed-baseline-from-enrollment');
    continueSamePaOccupiedWalkFromBaselineFixture(h, { outcome, endpoint, settled, transition, release }, label, prepared);
    passed = true;
  } finally {
    const closeErrors: unknown[] = [];
    for (const store of stores.reverse()) { try { store.close(); } catch (error) { closeErrors.push(error); } }
    const originalUnchanged = createHash('sha256').update(readFileSync(capturedInput.checkpointGzip)).digest('hex') === pin.gzipSha256;
    const result = { kind: 'pl01_cp1_enrollment_suffix_result_v1',
      retainedPrefix: { sourceCommit: pin.sourceCommit, sourceTree: pin.sourceTree, databaseSha256: pin.databaseSha256,
        boundary: 'completed terminal settlement/transition/release, accepted next actor/body/batting/runner models and new-batter baseline; occupied enrollment absent',
        previouslyCompletedAssertions: 'historical evidence only; not rerun or credited as this suffix',
        priorCp173ContractCommit: pin.priorCp173ContractCommit, priorCp173DatabaseSha256: pin.priorCp173DatabaseSha256,
        priorCp8ContractCommit: pin.priorCp8ContractCommit, priorCp8DatabaseSha256: pin.priorCp8DatabaseSha256 },
      historicalProvenance: { originalRunControlSha256: pin.runControlSha256, checkpointReceiptSha256: pin.receiptSha256, priorRunTerminalSha256: pin.priorRunTerminalSha256,
        sourceIdentityBasis: 'previously_audited_checkpoint', privateWitnessFilesRechecked: witnessRecheck },
      continuedSuffix: passed && closeErrors.length === 0 && originalUnchanged ? 'PASS' : 'FAILED',
      lastPhase: phase, allHandlesClosed: closeErrors.length === 0, originalCheckpointUnchanged: originalUnchanged,
      wholeCasePass: false, databasePath: path };
    writeFileSync(join(capturedInput.destinationDirectory, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    if (closeErrors.length) throw new AggregateError(closeErrors, 'PL01 suffix owner cleanup failed');
    assert(originalUnchanged, 'PL01 original checkpoint changed');
  }
};
