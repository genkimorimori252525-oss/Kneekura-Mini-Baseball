import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
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
import { prepareLAN01RetainedCheckpoint, type LAN01RetainedSuffixInput } from './LAN01RetainedCheckpoint.test-support';
import type { AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import { liveAppealSceneFixture } from './SamePlateAppearanceLiveAppealScene.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { completeSamePaPhysicalLifecycleFromCutFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { openSqliteSamePlateAppearanceOccupiedRunnerHoldStore } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';
import { openSqliteSamePlateAppearanceInitialBallStore } from './SqliteSamePlateAppearanceInitialBallStore';
import { openSqliteSamePlateAppearanceTakeSuccessorStore } from './SqliteSamePlateAppearanceTakeSuccessorStore';
import { openSqliteSamePlateAppearanceLifecycleStore } from './SqliteSamePlateAppearanceLifecycleStore';
import { openSqliteSamePlateAppearanceContinuationStore } from './SqliteSamePlateAppearanceContinuationStore';
import { openSqliteBattingEmotionStore } from './SqliteBattingEmotionStore';
import { readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { continueLAN01OriginalLiveAppealAfterThrowAssertions } from './LAN01OriginalLiveAppealAssertions.test-support';
import { readSamePaPhysicalFieldCalibrationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readLAN01RetainedHistoricalAdmission } from './LAN01RetainedHistoricalAdmission.test-support';
import { readLAN01RetainedThrowBoundary } from './LAN01RetainedThrowBoundary.test-support';
import { resumeNativePhysicalThrowReceptionAfterPlan } from './SamePlateAppearancePhysicalThrowReception.test-support';
import { resumeNativeLiveAppealCatch } from './SamePlateAppearanceLiveAppealCatchNative.test-support';
import type { BodyMaterializationRequest } from './PlayerBodyCapabilityMaterialization';

/** Reopens only exact LAN01-R9 cp39 after the original throw plan returned.
 * The first pending writer admits that plan into cut17. Completed Sources and
 * nine original callback assertions remain historical evidence. */
export const runLAN01RetainedOriginalSuffix = (input: LAN01RetainedSuffixInput, log: (phase: string) => void = () => {}) => {
  const { path, pin, input: capturedInput, witnessRecheck } = prepareLAN01RetainedCheckpoint(input), stores: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
  let phase = 'open-private-checkpoint', passed = false, originalPrefixHistoryUnchanged = false;
  let remainingOriginalCallbackAssertionsExecuted = false, originalThrowRemainderExecuted = false;
  const mark = (name: string) => { phase = name; log(name); };
  try {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = track(new DatabaseSync(path));
    assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
    assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='table'").get()!.n, pin.tableCount);
    const historyTables = ['pa_lifecycle_v1_outcomes', 'pa_terminal_v1_endpoints', 'pa_settlement_v1_plans',
      'pa_settlement_v1_releases', 'pa_terminal_v1_transitions', 'applications', 'official_scoring_applications',
      'pa_dispatch_v1_pitch_actions', 'pa_take_successor_v1_pitch_actions', 'pa_physical_v1_launches',
      'pa_physical_v1_resolutions', 'pa_lifecycle_v1_work_prefixes', 'pa_lifecycle_v1_total_assessments',
      'pa_lifecycle_v1_execution_views', 'pa_lifecycle_v1_execution_calibrations', 'world_player_body_materializations',
      'world_player_batting_models', 'world_player_runner_decision_motion_models', 'world_player_workload_activities',
      'world_player_workload_baselines', 'same_pa_enrollments', 'reserved_pa_work_prefixes', 'reserved_pa_total_assessments',
      'reserved_pa_execution_views', 'pa_dispatch_v1_action_plans',
      'pa_dispatch_v1_execution_calibrations', 'pa_dispatch_v1_consumer_sets', 'pa_dispatch_v1_episodes', 'pa_dispatch_v1_rights',
      'world_same_pa_occupied_runner_holds', 'pa_initial_ball_v1_setups', 'pa_initial_ball_v1_plays',
      'batting_observation_v1_postures', 'batting_emotion_v1_geneses', 'pa_continuation_v1_work_prefixes',
      'pa_continuation_v1_total_assessments', 'pa_continuation_v1_execution_views', 'pa_continuation_v1_execution_calibrations',
      'pa_take_successor_v1_action_plans', 'pa_take_successor_v1_setups', 'pa_physical_v1_action_plans',
      'pa_physical_v1_rights', 'pa_physical_v1_field_calibrations', 'pa_physical_v1_cuts',
      'pa_physical_v1_commitments', 'pa_physical_v1_field_roots',
      'world_batted_body_materializations', 'batting_execution_v1_intents', 'batting_observation_v1_observations',
      'batting_observation_v1_deliveries', 'batting_prediction_v1_predictions', 'batting_score_v1_assessments',
      'batting_emotion_execution_v1_executions', 'batting_execution_v1_inputs', 'world_decision_revision_events',
      'pa_physical_v1_field_steps', 'pa_catch_v1_work'];
    const rows = (table: string) => db.prepare('SELECT rowid,* FROM ' + table + ' ORDER BY rowid').all();
    const histories = historyTables.map(table => ({ table, rows: rows(table) }));
    const priorActivities = db.prepare('SELECT * FROM world_player_workload_activities ORDER BY source_id').all();
    assert.equal(priorActivities.length, 11); assert(priorActivities.some(row => row.source_id === 'prior-independent-native-fixture-work'));
    const links = track(openSqlitePlayerPersonLinkStore(path));
    const world = track(openSqliteWorldSettlementStore(path)), roster = track(openSqliteManagerRosterDecisionStore(path));
    const official = track(new SqliteOfficialStateStore(path)), fixtureBinding = official.getOfficialFixture('game-1');
    assert(fixtureBinding, 'LAN01 original official fixture missing');
    const participation = track(new SqliteOfficialParticipationStore(path,
      officialPitchWorkloadParticipationAuthority(world, roster, links, fixtureBinding)));
    const initialWorlds = track(openSqliteOfficialInitialWorldStore(path, { matches: official, participation }));
    const initial = initialWorlds.readAcceptedSource('initial-world'); assert(initial, 'LAN01 original initial World missing');
    const scene = liveAppealSceneFixture();
    assert.deepEqual(initial.source.worldSetup.baseCenters, scene.originalBaseCenters);
    const actorSources = new Map<string, AcceptedPhysicalPlateAppearanceActor>();
    const sources = { matches: official, initialWorlds, participation };
    const actors = track(openSqlitePhysicalPlateAppearanceActorStore(path, sources,
      { readAcceptedActor: id => actorSources.get(id) ?? null }));
    const actor = actors.read('batter-1'); assert(actor, 'LAN01 original actor missing');
    assert.equal(actor.match.ruleProfileId, 'npb-2026'); assert.equal(actor.match.playId, 7); assert.equal(actor.binding.playerId, 'away-1');

    mark('authenticate-already-completed-terminal-owners');
    const enrollmentOwner = track(openSqliteSamePlateAppearanceEnrollmentStore(path));
    const originalEnrollment = enrollmentOwner.readHistorical('native-enrollment');
    assert(originalEnrollment?.kind === 'reserved', 'LAN01 original enrollment missing');
    const outcomes = track(openSqliteSamePlateAppearanceLifecycleOutcomeStore(path));
    const outcome = outcomes.readOutcome('lan01:walk:terminal:outcome');
    assert(outcome?.kind === 'same_pa_lifecycle_outcome' && outcome.source.kind === 'count_terminal', 'LAN01 original count outcome missing');
    const endpoints = track(openSqliteSamePlateAppearanceTerminalEndpointStore(path));
    const endpoint = endpoints.read('lan01:walk:terminal:endpoint'); assert(endpoint, 'LAN01 original endpoint missing');
    assert.deepEqual(endpoint.actor, actor); assert.deepEqual(endpoint.outcomeReference, reference('pa_lifecycle_v1_outcomes', outcome));
    assert.deepEqual(endpoint.enrollmentReference, reference('same_pa_enrollments', originalEnrollment));
    assert.deepEqual(endpoint.timeline.status, { kind: 'walk', terminalCount: { balls: 4, strikes: 2 } });
    assert.equal(endpoint.participants.length, 10);
    const final = withSqliteReadTransaction(db, () => readHistoricalSamePaLifecycleViewFromSqlite(db, endpoint.finalViewReference));
    assert.equal(final.view.cut.stage, 'terminal'); assert.equal(final.view.cut.pitchOrdinal, 6);
    assert.equal(final.view.cut.physicalOperationReference.sourceId, 'lan01:walk:pitch6:resolution');
    assert.deepEqual(endpoint.participants, final.view.participants);
    assert.deepEqual(endpoint.baseCenters, scene.originalBaseCenters);
    const settlementOwner = track(openSqliteSamePlateAppearanceTerminalSettlementStore(path, links));
    const settled = settlementOwner.read('lan01:walk:terminal:settlement'); assert(settled, 'LAN01 completed settlement missing');
    assert.equal(settled.kind, 'settled'); assert(settled.participants.every(p => p.applied)); assert.equal(settled.participants.length, 10);
    assert.deepEqual(settled.plan.source.terminalReference, reference('pa_terminal_v1_endpoints', endpoint));
    const transition = track(openSqliteSamePlateAppearanceTerminalTransitionStore(path)).read('lan01:walk:terminal:transition');
    assert(transition, 'LAN01 completed official transition missing');
    const release = settlementOwner.readRelease('lan01:walk:terminal:settlement'); assert(release, 'LAN01 original release missing');
    assert.equal(release.memberRows.length, 10); assert.deepEqual(release.settlementReference, settled.reference);
    assert.deepEqual(release.transitionReference, reference('pa_terminal_v1_transitions', transition));
    assert.deepEqual(transition.source.terminalReference, reference('pa_terminal_v1_endpoints', endpoint));
    assert.deepEqual(transition.source.settlementReference, settled.reference);
    assert.equal(db.prepare('SELECT count(*) n FROM same_pa_participant_reservations').get()!.n, 11);
    assert.equal(db.prepare('SELECT count(*) n FROM same_pa_participant_reservations WHERE enrollment_source_id=?').get(originalEnrollment.source.sourceId)!.n, 0);
    for (const table of ['pa_settlement_v1_releases', 'pa_terminal_v1_transitions', 'applications', 'official_scoring_applications']) {
      assert.equal(db.prepare('SELECT count(*) n FROM ' + table).get()!.n, 1);
    }
    assert.equal(db.prepare('SELECT count(*) n FROM same_pa_enrollments').get()!.n, 2);
    assert.equal(db.prepare('SELECT count(*) n FROM world_player_workload_baselines WHERE player_id=?').get('away-2')!.n, 1);
    assert.equal(db.prepare('SELECT count(*) n FROM world_player_workload_heads WHERE player_id=?').get('away-2')!.n, 1);
    settlementOwner.close();

    mark('authenticate-original-occupied-continuation-inputs');
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedAction = dispatch.readAction('native-action'); assert(acceptedAction, 'LAN01 original dispatch action missing');
    assert.deepEqual(acceptedAction.source.enrollmentReference, endpoint.enrollmentReference);
    const calibrationIds = db.prepare('SELECT source_id FROM pa_dispatch_v1_execution_calibrations WHERE enrollment_source_id=? ORDER BY rowid')
      .all(originalEnrollment.source.sourceId).map(row => String(row.source_id));
    const acceptedCalibrations = dispatch.readCalibrationSet(calibrationIds); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const batting = track(openSqlitePlayerBattingModelStore(path)).read(acceptedAction.source.batterModelReference.sourceId);
    assert(batting, 'LAN01 original batting model missing'); assert.deepEqual(reference('world_player_batting_models', batting), acceptedAction.source.batterModelReference);
    const receipt = batting.bodyMaterialization, { body, pose, reachCalibration: reach } = receipt;
    const requests = new Map<string, BodyMaterializationRequest>([[receipt.source.sourceId, receipt.source]]);
    const materializations = track(openSqlitePlayerBodyCapabilityMaterializationStore(path, {
      readAcceptedMaterialization: id => requests.get(id) ?? null,
      readAcceptedBody: id => id === body.sourceId ? body : null, readAcceptedPose: id => id === pose.sourceId ? pose : null,
      readAcceptedReachCalibration: id => id === reach.sourceId ? reach : null,
    }));
    assert.deepEqual(materializations.read(receipt.source.sourceId), receipt);
    const posture = track(openSqliteBattingPerceptionStore(path)).readPosture('physical-fixture:second-posture');
    assert(posture?.kind === 'batting_invocation_posture' && posture.source.capability === 'owned_next_take_batting_posture_v1', 'LAN01 original scene posture missing');
    assert.deepEqual(posture.model, batting);
    // The production replay authenticates the original baseline policy and
    // Person before this exact accepted Source is reused for the new batter.
    assert(readActualRoleWorkloadState(db, 'career-a', 'p2', undefined, 'intake-p2'));
    const baseline = JSON.parse(String(db.prepare('SELECT source_json FROM world_player_workload_baselines WHERE source_id=?').get('workload')!.source_json)) as AcceptedPlayerWorkloadBaseline;
    assert.equal(baseline.sourceId, 'workload'); assert.equal(baseline.playerId, 'p2');
    const scope = { careerId: actor.person.careerId, playerId: actor.person.playerId, personId: actor.person.personId, personLinkSourceId: actor.person.sourceId };
    const worldOwner = track(openSqliteWorldControlStore(path));
    assert(worldOwner.readHead(actor.binding.careerId), 'LAN01 original World control missing');
    const close = () => { for (const store of stores.slice().reverse()) store.close(); };
    const f = { db, path, actor, body, pose, reach, scope, requests, materializations, acceptedCalibrations, close,
      capability: batting.capability, repertoire: batting.repertoire, decision: batting.decisionModel, equipment: batting.equipment,
      observation: batting.observationCalibration, prediction: batting.predictionCalibration, stance: posture.source.geometry,
      x: { accepted: actorSources, actors, sources, f: { track, links, participation, baseline, firstInput: { worldSetup: initial.source.worldSetup } } },
    };
    const label = 'lan01:occupied';
    mark('authenticate-accepted-next-actor-and-models');
    const nextActor = actors.read(label + ':actor'); assert(nextActor, 'LAN01 accepted next actor missing');
    assert('activation' in transition.official, 'LAN01 original transition has no next activation');
    assert.deepEqual(nextActor.match, transition.official.activation.nextMatchState);
    assert.deepEqual(nextActor.world, transition.official.nextWorld);
    assert.equal(nextActor.binding.playerId, 'away-2');
    assert.deepEqual(nextActor.source, { sourceId: label + ':actor', sourceVersion: 'fixture-only-v1', gameId: actor.source.gameId,
      playerId: 'away-2', activationApplicationId: transition.source.applicationId });
    const originals = withSqliteReadTransaction(db, () => readSamePaOriginalParticipants(db, nextActor)); assert.equal(originals.length, 11);
    const nextModelStore = track(openSqlitePlayerBattingModelStore(path));
    const nextBatting = nextModelStore.read(label + ':batter-model'); assert(nextBatting, 'LAN01 accepted next batting model missing');
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
    const runnerReceipt = materializations.read(label + ':runner-body-composition'); assert(runnerReceipt, 'LAN01 accepted original runner body missing');
    assert.deepEqual(runnerReceipt.person, actor.person); assert.deepEqual(runnerReceipt.body, body); assert.deepEqual(runnerReceipt.pose, pose);
    const runnerModel = track(openSqlitePlayerRunnerDecisionMotionModelStore(path)).read(label + ':runner-model');
    assert(runnerModel, 'LAN01 accepted original runner model missing'); assert.deepEqual(runnerModel.person, actor.person);
    assert.equal(createHash('sha256').update(JSON.stringify(runnerModel)).digest('hex'), pin.runnerModelResultHash);
    // Future fixture closures use only genuine owner records and fresh Source maps.
    const accepted = new Map<string, unknown>();
    const previous = { f, sceneBodyReferences: [...posture.source.sceneBodyReferences] };
    mark('authenticate-accepted-occupied-baseline-through-view');
    const occupiedAction = dispatch.readAction(label + ':action'); assert(occupiedAction, 'LAN01 accepted occupied action missing');
    const { enrollment: occupiedEnrollment, view } = readLAN01RetainedHistoricalAdmission(db, occupiedAction.source.viewReference);
    assert.equal(occupiedEnrollment.kind, 'reserved');
    assert.deepEqual(occupiedEnrollment.source.actorReference, reference('physical_plate_appearance_actors', nextActor));
    assert.equal(occupiedEnrollment.source.firstPhysicalPitchSourceId, label + ':pitch');
    assert.equal(occupiedEnrollment.participants.length, 11);
    withSqliteReadTransaction(db, () => {
      for (const participant of occupiedEnrollment.participants) {
        const state = readActualRoleWorkloadState(db, participant.binding.careerId, participant.binding.playerId,
          undefined, participant.binding.personLinkSourceId);
        assert.deepEqual(state, participant.state);
        const prior: import('./SamePlateAppearanceTerminalSettlement').SamePaTerminalSettlement['participants'][number] | undefined
          = settled.participants.find(p => p.playerId === participant.binding.playerId);
        if (prior) assert.deepEqual(state, prior.projectedState);
        else {
          assert.equal(participant.binding.playerId, nextActor.binding.playerId);
          assert.equal(participant.baselineSourceId, label + ':new-batter-baseline');
          assert.equal(state?.revision, 0);
          const baselineSource = JSON.parse(String(db.prepare('SELECT source_json FROM world_player_workload_baselines WHERE source_id=?')
            .get(participant.baselineSourceId)!.source_json));
          assert.deepEqual(baselineSource, { ...baseline, sourceId: label + ':new-batter-baseline',
            playerId: nextActor.binding.playerId, personLinkSourceId: nextActor.binding.personLinkSourceId });
          assert.equal(hash(baselineSource), participant.baselineSourceHash);
        }
      }
    });
    const enrollmentReference = reference('same_pa_enrollments', occupiedEnrollment);
    // The historical reader above already authenticates the exact immutable
    // empty prefix and all zero TOTAL rows as dependencies of this view.
    // Fresh ExecutionStore reads would reacquire a pre-physical reservation.
    assert.deepEqual(view.source.enrollmentReference, enrollmentReference);
    assert.equal(view.source.prefixReference.sourceId, label + ':prefix');
    assert.equal(view.source.participantTotalReferences.length, 11);
    assert.deepEqual(view.source.participantTotalReferences.map(t => t.assessmentReference.sourceId),
      view.lineage.participantReferences.map(p => label + ':total:' + p.playerId));
    assert.deepEqual(view.participants.map(p => p.playerId), occupiedEnrollment.participants.map(p => p.binding.playerId));
    assert(view.participants.every(p => p.activity.kind === 'MATCH' && p.activity.effortUnits === 0));
    assert.equal(hash(view), pin.viewSnapshotHash);
    mark('authenticate-completed-occupied-takes-and-cut0');
    const hold = track(openSqliteSamePlateAppearanceOccupiedRunnerHoldStore(path)).read(label + ':runner-hold');
    assert(hold, 'LAN01 accepted finite occupied hold missing');
    assert.deepEqual(hold.source.enrollmentReference, enrollmentReference);
    assert.deepEqual(hold.source.bodyReference, reference('world_player_body_materializations', runnerReceipt));
    assert.deepEqual(hold.source.runnerModelReference, reference('world_player_runner_decision_motion_models', runnerModel));
    assert.equal(hold.source.coverageThroughTick - hold.source.intent.issuedTick, scene.occupiedHoldDurationUs);
    assert.deepEqual(occupiedAction.source.enrollmentReference, enrollmentReference);
    assert.deepEqual(occupiedAction.source.viewReference, reference('reserved_pa_execution_views', view));
    assert.deepEqual(occupiedAction.source.batterModelReference, reference('world_player_batting_models', nextBatting));
    assert.deepEqual(occupiedAction.source.occupiedRunnerHoldReferences, [reference('world_same_pa_occupied_runner_holds', hold)]);
    const occupiedCalibrationIds = db.prepare('SELECT source_id FROM pa_dispatch_v1_execution_calibrations WHERE enrollment_source_id=? ORDER BY rowid')
      .all(occupiedEnrollment.source.sourceId).map(row => String(row.source_id));
    const occupiedCalibrations = dispatch.readCalibrationSet(occupiedCalibrationIds);
    assert.equal(occupiedCalibrations.calibrations.length, 32);
    const first = dispatch.readPhysicalPitch(label + ':pitch'); assert(first, 'LAN01 completed first TAKE missing');
    assert.equal(hash(first), pin.firstPitchSnapshotHash); assert.deepEqual(first.originalActor, nextActor);
    assert.deepEqual(first.source.actionReference, reference('pa_dispatch_v1_action_plans', occupiedAction));
    const initialOwner = track(openSqliteSamePlateAppearanceInitialBallStore(path));
    const play = initialOwner.readPlay(label + ':initial-play'); assert(play?.kind === 'same_pa_initial_play_v1', 'LAN01 accepted initial Play missing');
    assert(first.source.capability === 'same_pa_physical_pitch_v2');
    assert.deepEqual(first.source.initialPlayReference, reference('pa_initial_ball_v1_plays', play));
    const next = track(openSqliteSamePlateAppearanceTakeSuccessorStore(path));
    const second = next.readPhysicalPitch(label + ':second-pitch'); assert(second, 'LAN01 completed second TAKE missing');
    assert.equal(hash(second), pin.secondPitchSnapshotHash); assert.deepEqual(second.originalActor, nextActor);
    assert.deepEqual(second.previousPitchReference, reference('pa_dispatch_v1_pitch_actions', first));
    const secondAction = next.readAction(label + ':second-action'); assert(secondAction, 'LAN01 accepted second action missing');
    assert.deepEqual(second.source.actionReference, reference('pa_take_successor_v1_action_plans', secondAction));
    const secondSetup = next.readSetup(label + ':second-setup'); assert(secondSetup, 'LAN01 accepted second setup missing');
    assert.deepEqual(second.source.setupReference, reference('pa_take_successor_v1_setups', secondSetup));
    const secondPosture = track(openSqliteBattingPerceptionStore(path)).readPosture(label + ':second-posture');
    assert(secondPosture?.kind === 'batting_invocation_posture' && secondPosture.source.capability === 'owned_next_take_batting_posture_v1');
    assert.equal(hash(secondPosture), pin.secondPostureSnapshotHash); assert.deepEqual(secondPosture.model, nextBatting);
    assert.deepEqual(secondSetup.source.postureReference, reference('batting_observation_v1_postures', secondPosture));
    assert.deepEqual(secondPosture.source.occupiedRunnerHoldReferences, occupiedAction.source.occupiedRunnerHoldReferences);
    const sceneBodyReferences = [...secondPosture.source.sceneBodyReferences];
    assert.deepEqual(sceneBodyReferences, [...previous.sceneBodyReferences, { playerId: actor.binding.playerId, bodyReference: hold.source.bodyReference }]);
    const anchorOwner = track(openSqliteSamePlateAppearanceContinuationStore(path));
    const anchorView = anchorOwner.readView(label + ':anchor:view'); assert(anchorView, 'LAN01 completed anchor view missing');
    assert.equal(hash(anchorView), pin.anchorViewSnapshotHash);
    const anchorReference = reference('pa_continuation_v1_execution_views', anchorView);
    assert.deepEqual(second.viewReference, anchorReference); assert.deepEqual(secondPosture.source.viewReference, anchorReference);
    const genesis = track(openSqliteBattingEmotionStore(path)).readGenesis(label + ':emotion-genesis');
    assert(genesis, 'LAN01 accepted occupied emotion genesis missing');
    const roles = deriveSamePaDispatchRoles(nextActor, view, originals);
    assert.deepEqual(genesis.source.member, roles[0].member); assert.deepEqual(genesis.source.viewReference, occupiedAction.source.viewReference);
    const declared = dispatchCalibrationValues().batter_observation;
    const explicitBatterObservation = { ...declared, calibration: { ...declared.calibration, errorParameters: { ...declared.calibration.errorParameters,
      minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0, minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } };
    const nextFixture = { ...f, actor: nextActor, view, acceptedAction: occupiedAction, acceptedCalibrations: occupiedCalibrations };
    const cutAccepted = new Map<string, unknown>();
    const lifecycleOwner = track(openSqliteSamePlateAppearanceLifecycleStore(path, { readAcceptedCalibration: id => cutAccepted.get(id) }));
    mark('authenticate-completed-throw-plan-and-cut16-with-current-after-state');
    // One ephemeral read phase authenticates related immutable ancestry. No proof
    // cache escapes this scope; every subsequent writer performs its own fences.
    const restored = withSqliteReadTransaction(db, () => withSamePaLifecycleReadPhase(db, () => {
      const cutPrefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', label + ':cut0:prefix'); assert(cutPrefix?.kind === 'same_pa_lifecycle_prefix', 'LAN01 completed cut0 prefix missing');
      assert.deepEqual(cutPrefix.source.enrollmentReference, enrollmentReference);
      assert.deepEqual(cutPrefix.source.anchorViewReference, anchorReference);
      assert.deepEqual(cutPrefix.source.eventReferences, [reference('pa_take_successor_v1_pitch_actions', second)]);
      const cutView = readSamePaLifecycleRecordFromSqlite(db, 'view', label + ':cut0:view'); assert(cutView?.kind === 'same_pa_lifecycle_view', 'LAN01 completed cut0 view missing');
      assert.equal(hash(cutView), pin.cut0ViewSnapshotHash);
      assert.deepEqual(cutView.source.prefixReference, reference('pa_lifecycle_v1_work_prefixes', cutPrefix));
      const cutReference = reference('pa_lifecycle_v1_execution_views', cutView);
      const cutBasis = readHistoricalSamePaLifecycleViewFromSqlite(db, cutReference);
      assert.deepEqual(cutBasis.actor, nextActor); assert.deepEqual(cutBasis.view, cutView);
      assert.equal(cutView.cut.stage, 'retained_take'); assert.equal(cutView.cut.pitchOrdinal, 2);
      assert.deepEqual(cutView.cut.timeline, second.result.resolution.timeline);
      assert.deepEqual(cutView.cut.physicalOperationReference, reference('pa_take_successor_v1_pitch_actions', second));
      const cutTotals = readSamePaLifecycleSetFromSqlite(db, 'total', cutView.source.participantTotalReferences.map(p => p.assessmentReference.sourceId));
      assert.equal(cutTotals.length, 11);
      cutTotals.forEach((total, i) => {
        assert(total?.kind === 'same_pa_lifecycle_total'); assert.equal(total.source.effortUnits, 2);
        assert.deepEqual(reference('pa_lifecycle_v1_total_assessments', total), cutView.source.participantTotalReferences[i].assessmentReference);
      });
      const cutCalibrationIds = occupiedCalibrations.calibrations.map(c => label + ':cut0:' + c.source.sourceId);
      const readCalibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', cutCalibrationIds);
      const calibrations = readCalibrations.map((calibration, i) => {
        assert(calibration?.kind === 'same_pa_lifecycle_calibration', 'LAN01 complete cut0 calibration missing');
        assert.equal(calibration.source.sourceId, cutCalibrationIds[i]);
        assert.deepEqual(calibration.source.viewReference, cutReference);
        assert.deepEqual(calibration.source.member, cutBasis.members.find(m => m.playerId === occupiedCalibrations.calibrations[i].source.member.playerId));
        assert.equal(calibration.source.route, occupiedCalibrations.calibrations[i].source.route);
        return calibration;
      });
      assert.equal(calibrations.length, 32); assert.equal(new Set(calibrations.map(c => c.source.sourceId)).size, 32);
      const pins = pin.throwBoundary;
      const latest = readHistoricalSamePaLifecycleViewFromSqlite(db, pins.cut16ViewReference);
      assert.deepEqual(latest.actor, nextActor);
      const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', latest.view.source.prefixReference.sourceId);
      assert(prefix?.kind === 'same_pa_lifecycle_prefix', 'LAN01 complete cut16 prefix missing');
      assert.equal(prefix.source.sourceId, label + ':cut16:prefix');
      const prefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix);
      assert.deepEqual(prefixReference, pins.cut16PrefixReference);
      assert.deepEqual(prefix.source.anchorViewReference, anchorReference);
      assert.deepEqual(prefix.source.enrollmentReference, enrollmentReference);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', latest.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId)).map((total, i) => {
        assert(total?.kind === 'same_pa_lifecycle_total'); assert.equal(total.source.effortUnits, 2);
        assert.deepEqual(reference('pa_lifecycle_v1_total_assessments', total), latest.view.source.participantTotalReferences[i].assessmentReference);
        return total;
      });
      assert.equal(totals.length, 11);
      const latestCalibrationIds = occupiedCalibrations.calibrations.map(c => label + ':cut16:' + c.source.sourceId);
      const latestCalibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', latestCalibrationIds).map((calibration, i) => {
        assert(calibration?.kind === 'same_pa_lifecycle_calibration', 'LAN01 complete cut16 calibration missing');
        assert.equal(calibration.source.sourceId, latestCalibrationIds[i]);
        assert.deepEqual(calibration.source.viewReference, pins.cut16ViewReference);
        assert.deepEqual(calibration.source.member, latest.members.find(m => m.playerId === occupiedCalibrations.calibrations[i].source.member.playerId));
        assert.equal(calibration.source.route, occupiedCalibrations.calibrations[i].source.route);
        return calibration;
      });
      assert.equal(latestCalibrations.length, 32); assert.equal(new Set(latestCalibrationIds).size, 32);
      assert.deepEqual(db.prepare('SELECT source_id FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY source_id')
        .all(pins.cut16ViewReference.sourceId).map(row => row.source_id), [...latestCalibrationIds, pins.throwCalibrationReference.sourceId].sort());
      assert.equal(createHash('sha256').update(JSON.stringify([pin.firstRemainingWriter.sourceId])).digest('hex'), pin.firstRemainingWriter.argumentsHash);
      for (const [table, id] of [['pa_lifecycle_v1_work_prefixes', label + ':cut17:prefix'],
        ['pa_lifecycle_v1_execution_views', label + ':cut17:view'], ['pa_physical_v1_field_steps', 'lan01:appeal-throw:4'],
        ['pa_physical_v1_field_steps', 'lan01:seal'], ['pa_catch_v1_work', 'lan01:caught:work:sealed'],
        ['pa_lifecycle_v1_outcomes', 'lan01:terminal:outcome']]) {
        assert.equal(db.prepare('SELECT count(*) n FROM ' + table + ' WHERE source_id=?').get(id)!.n, 0);
      }
      for (const table of ['pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_calibrations']) {
        assert.equal(db.prepare('SELECT count(*) n FROM ' + table + ' WHERE source_id LIKE ?').get(label + ':cut17:%')!.n, 0);
      }
      const boundary = readLAN01RetainedThrowBoundary({ db, actor: nextActor, second, anchorViewReference: anchorReference,
        current: { view: latest.view, viewReference: pins.cut16ViewReference, basis: latest }, eventReferences: prefix.source.eventReferences }, pins);
      const calibration = readSamePaPhysicalFieldCalibrationFromSqlite(db, pins.fieldCalibrationReference);
      assert.deepEqual(calibration.source.viewReference, cutReference);
      assert.deepEqual(calibration.source.postureReference, pins.postureReference);
      assert.equal(calibration.source.bodyModelReference.sourceId, 'lan01:field:body-model');
      for (const table of ['pa_physical_v1_field_calibrations', 'world_batted_body_materializations']) {
        assert.equal(db.prepare('SELECT count(*) n FROM ' + table + ' WHERE source_id LIKE ?').get('lan01:field:%')!.n, 1);
      }
      return { boundary, events: prefix.source.eventReferences, prepared: {
        owner: lifecycleOwner, accepted: cutAccepted, view: latest.view, viewReference: pins.cut16ViewReference, basis: latest,
        calibrationSet: { kind: 'same_pa_lifecycle_calibration_set' as const, calibrations: latestCalibrations,
          calibrationReferences: latestCalibrations.map(value => reference('pa_lifecycle_v1_execution_calibrations', value)) },
      } };
    }));
    const physical = completeSamePaPhysicalLifecycleFromCutFixture(nextFixture, accepted, {
      first, second, anchor: { viewReference: anchorReference }, basis: restored.prepared, eventReferences: restored.events,
      sceneBodyReferences, geometry: secondPosture.source.geometry, genesis, worldOwner, roles, throughTick: hold.source.coverageThroughTick,
    }, { explicitBatterObservation }, label);
    const caught = resumeNativeLiveAppealCatch(physical, restored.boundary.caught, 'lan01:caught');
    mark('continue-cut17-then-original-transfer-release-reception-and-appeal');
    const thrown = resumeNativePhysicalThrowReceptionAfterPlan(physical, restored.boundary.field, 'lan01:appeal-throw', restored.boundary);
    originalThrowRemainderExecuted = true;
    continueLAN01OriginalLiveAppealAfterThrowAssertions(physical, restored.boundary.field, caught, thrown, mark);
    remainingOriginalCallbackAssertionsExecuted = true;
    for (const history of histories) assert.equal(json(rows(history.table).slice(0, history.rows.length)), json(history.rows),
      'LAN01 retained original prefix history changed: ' + history.table);
    originalPrefixHistoryUnchanged = true;
    passed = true;
  } finally {
    const closeErrors: unknown[] = [];
    for (const store of stores.reverse()) { try { store.close(); } catch (error) { closeErrors.push(error); } }
    const originalUnchanged = createHash('sha256').update(readFileSync(capturedInput.checkpointGzip)).digest('hex') === pin.gzipSha256;
    const result = { kind: 'lan01_cp39_original_remaining_suffix_result_v1',
      retainedPrefix: { sourceCommit: pin.sourceCommit, sourceTree: pin.sourceTree, databaseSha256: pin.databaseSha256,
        boundary: 'completed original walk, both occupied TAKEs, corrected third swing/contact, field-root/step, secured capture, original caught work, indication, complete cut16 and throw plan; cut17 admission and physical transfer/release/reception/appeal absent',
        previouslyCompletedAssertions: 'first four original LAN callback assertions and five pre-field assertions completed before R9 throw plan are historical evidence only; original caught helper assertions are also historical',
        originalRunOutcome: pin.priorRunOutcome, priorRunCleanupVerified: true,
        priorOccupiedFirstPitchAndRetry: 'historical successful evidence only; no completed writer or retry replayed', retainedPrefixAssertionsRerun: false, historicalOriginalCallbackAssertionCount: 9, historicalInitialCallbackAssertionCount: 4, historicalR9CallbackAssertionCount: 5, historicalOriginalCatchHelperAssertionCount: 4, remainingOriginalCallbackAssertionCount: 11, remainingOriginalCallbackAssertionsExecuted, originalThrowRemainderExecuted,
        checkpointSequence: pin.checkpointSequence, returnedOwnerCall: pin.returnedOwnerCall, completedOccupiedWritersReplayed: false, completedThirdPitchWritersReplayed: false },
      historicalProvenance: { originalRunControlSha256: pin.runControlSha256, checkpointReceiptSha256: pin.receiptSha256, priorRunTerminalSha256: pin.priorRunTerminalSha256, priorRunObservationSha256: pin.priorRunObservationSha256, firstRemainingWriter: pin.firstRemainingWriter,
        priorVitestReportSha256: pin.priorVitestReportSha256, returnedThrowPlanSha256: pin.returnedThrowPlanHash, returnedDeliverySha256: pin.returnedDeliveryHash, tableCensusSha256: pin.censusSha256, priorCp19: pin.priorCp19, priorCp14: pin.priorCp14, failedGroundContactLineage: pin.failedGroundContactLineage, priorCp21: pin.priorCp21, priorCp27: pin.priorCp27, priorCp23: pin.priorCp23, priorCp5: pin.priorCp5, failedCp11Continuation: pin.failedCp11Continuation, sourceIdentityBasis: 'exact_pinned_original_checkpoint', privateWitnessFilesRechecked: witnessRecheck },
      continuedSuffix: passed && closeErrors.length === 0 && originalUnchanged ? 'PASS' : 'FAILED',
      lastPhase: phase, allHandlesClosed: closeErrors.length === 0, originalCheckpointUnchanged: originalUnchanged,
      originalPrefixHistoryUnchanged, wholeCasePass: false, databasePath: path };
    writeFileSync(join(capturedInput.destinationDirectory, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    if (closeErrors.length) throw new AggregateError(closeErrors, 'LAN01 suffix owner cleanup failed');
    assert(originalUnchanged, 'LAN01 original checkpoint changed');
  }
};
