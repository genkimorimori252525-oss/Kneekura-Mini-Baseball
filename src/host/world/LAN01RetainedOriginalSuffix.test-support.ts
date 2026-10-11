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
import { continueSamePaOccupiedWalkFromViewFixture, type SamePaPreparedOccupiedWalkFixture } from './SamePlateAppearanceOccupiedContinuation.test-support';
import { prepareLAN01RetainedCheckpoint, type LAN01RetainedSuffixInput } from './LAN01RetainedCheckpoint.test-support';
import type { AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import { liveAppealSceneFixture } from './SamePlateAppearanceLiveAppealScene.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { completeSamePaOccupiedPhysicalFixture } from './SamePlateAppearanceOccupiedPhysicalFixture.test-support';
import { continueLAN01OriginalLiveAppealAssertions } from './LAN01OriginalLiveAppealAssertions.test-support';
import { openSqliteSamePlateAppearanceExecutionStore } from './SqliteSamePlateAppearanceExecutionStore';
import type { BodyMaterializationRequest } from './PlayerBodyCapabilityMaterialization';

/** Reopens only the exact LAN01-R1 cp5 boundary before its runner hold. Owner readers authenticate all
 * recovered values. The original occupied tail owns every subsequent effect;
 * the completed walk, models and pre-hold workload owners are not recreated. */
export const runLAN01RetainedOriginalSuffix = (input: LAN01RetainedSuffixInput, log: (phase: string) => void = () => {}) => {
  const { path, pin, input: capturedInput, witnessRecheck } = prepareLAN01RetainedCheckpoint(input), stores: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
  let phase = 'open-private-checkpoint', passed = false, originalPrefixHistoryUnchanged = false;
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
      'pa_dispatch_v1_execution_calibrations', 'pa_dispatch_v1_consumer_sets', 'pa_dispatch_v1_episodes', 'pa_dispatch_v1_rights'];
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
    mark('authenticate-accepted-occupied-baseline-through-view');
    const occupiedEnrollment = enrollmentOwner.read(label + ':enrollment');
    assert(occupiedEnrollment?.kind === 'reserved', 'LAN01 occupied enrollment missing');
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
    const execution = track(openSqliteSamePlateAppearanceExecutionStore(path));
    const prefix = execution.readPrefix(label + ':prefix'); assert(prefix, 'LAN01 occupied empty prefix missing');
    assert.deepEqual(prefix.source.enrollmentReference, enrollmentReference); assert.deepEqual(prefix.timeline.events, []);
    const view = execution.readView(label + ':view'); assert(view, 'LAN01 occupied zero-TOTAL view missing');
    const prefixReference = reference('reserved_pa_work_prefixes', prefix);
    assert.deepEqual(view.source.enrollmentReference, enrollmentReference); assert.deepEqual(view.source.prefixReference, prefixReference);
    const totals = execution.readTotalSet(view.source.participantTotalReferences);
    assert.equal(totals.totals.length, 11);
    assert.deepEqual(totals.totals.map(t => t.source.sourceId), prefix.lineage.participantReferences.map(p => label + ':total:' + p.playerId));
    assert(totals.totals.every(t => t.source.effortUnits === 0));
    assert.deepEqual(view.participants.map(p => p.playerId), occupiedEnrollment.participants.map(p => p.binding.playerId));
    assert(view.participants.every(p => p.activity.kind === 'MATCH' && p.activity.effortUnits === 0));
    assert.equal(hash(view), pin.viewSnapshotHash);
    for (const table of ['world_same_pa_occupied_runner_holds', 'pa_initial_ball_v1_setups', 'pa_initial_ball_v1_plays']) {
      assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='table' AND name=?").get(table)!.n, 0);
    }
    for (const [table, id] of [['batting_observation_v1_postures', label + ':initial-posture'],
      ['pa_dispatch_v1_action_plans', label + ':action'], ['pa_dispatch_v1_consumer_sets', label + ':consumers'],
      ['pa_dispatch_v1_episodes', label + ':episode'], ['pa_dispatch_v1_rights', label + ':right'],
      ['pa_dispatch_v1_pitch_actions', label + ':pitch'], ['pa_take_successor_v1_action_plans', label + ':second-action']]) {
      assert.equal(db.prepare('SELECT count(*) n FROM ' + table + ' WHERE source_id=?').get(id)!.n, 0);
    }
    assert.equal(db.prepare('SELECT count(*) n FROM pa_dispatch_v1_execution_calibrations WHERE enrollment_source_id=?')
      .get(occupiedEnrollment.source.sourceId)!.n, 0);
    // This is the original callback declaration for the unperformed lane. Its
    // geometry comes from the same short-diamond recipe already checked above.
    const previous = h, declared = dispatchCalibrationValues().batter_observation;
    const explicitBatterObservation={...declared,calibration:{...declared.calibration,errorParameters:{...declared.calibration.errorParameters,
      minimumPositionErrorMeters:0,maximumPositionErrorMeters:0,minimumVelocityErrorMps:0,maximumVelocityErrorMps:0}}};
    const options={explicitBatterObservation,occupiedHoldDurationUs:scene.occupiedHoldDurationUs,initialPlay:{venue:{pitcherPlate:scene.pitcherPlate,rulePolicy:scene.rulePolicy},
      officialPerson:{sourceId:'lan01:initial-person',sourceVersion:'fixture-only-v1',capability:'accepted_original_umpire_person_v1' as const,
        careerId:previous.f.actor.binding.careerId,officialId:'lan01:plate-umpire',personId:'lan01:plate-umpire-person'},
      assignmentPolicy:{sourceId:'lan01:initial-policy',sourceVersion:'fixture-only-v1',ruleProfileId:NPB_2026_RULE_PROFILE.id,kind:'accepted_original_live_ball_action_v1' as const}}};
    mark('run-original-occupied-tail-from-finite-hold');
    const occupied = continueSamePaOccupiedWalkFromViewFixture(h, { endpoint }, label, prepared,
      { enrollment: occupiedEnrollment, prefix, view }, options);
    const physical = completeSamePaOccupiedPhysicalFixture({ worldOwner }, occupied, label, options);
    continueLAN01OriginalLiveAppealAssertions(previous, physical, scene, mark);
    for (const history of histories) assert.equal(json(rows(history.table).slice(0, history.rows.length)), json(history.rows),
      'LAN01 retained original prefix history changed: ' + history.table);
    originalPrefixHistoryUnchanged = true;
    passed = true;
  } finally {
    const closeErrors: unknown[] = [];
    for (const store of stores.reverse()) { try { store.close(); } catch (error) { closeErrors.push(error); } }
    const originalUnchanged = createHash('sha256').update(readFileSync(capturedInput.checkpointGzip)).digest('hex') === pin.gzipSha256;
    const result = { kind: 'lan01_cp5_original_remaining_suffix_result_v1',
      retainedPrefix: { sourceCommit: pin.sourceCommit, sourceTree: pin.sourceTree, databaseSha256: pin.databaseSha256,
        boundary: 'completed original walk and occupied baseline/enrollment/empty prefix/11 zero TOTALs/view; runner hold and all dependent occupied actions absent',
        previouslyCompletedAssertions: 'historical evidence only; not rerun or credited as this suffix',
        originalRunOutcome: 'FAILED_QUERY_ONLY_FIXTURE_READ',
        descendantContinuationOutcome: 'FAILED_IMMUTABLE_HOLD_EXHAUSTED',
        priorOccupiedFirstPitchAndRetry: 'historical successful evidence only; must rerun under the newly issued hold', retainedPrefixAssertionsRerun: false,
        completedOccupiedWriterCalls: 5, completedOccupiedWritersReplayed: false },
      historicalProvenance: { originalRunControlSha256: pin.runControlSha256, checkpointReceiptSha256: pin.receiptSha256, priorRunTerminalSha256: pin.priorRunTerminalSha256,
        priorVitestReportSha256: pin.priorVitestReportSha256, returnedViewResultSha256: pin.viewResultHash, tableCensusSha256: pin.censusSha256, priorCp181: pin.priorCp181, failedCp11Continuation: pin.failedCp11Continuation, sourceIdentityBasis: 'exact_pinned_original_checkpoint', privateWitnessFilesRechecked: witnessRecheck },
      continuedSuffix: passed && closeErrors.length === 0 && originalUnchanged ? 'PASS' : 'FAILED',
      lastPhase: phase, allHandlesClosed: closeErrors.length === 0, originalCheckpointUnchanged: originalUnchanged,
      originalPrefixHistoryUnchanged, wholeCasePass: false, databasePath: path };
    writeFileSync(join(capturedInput.destinationDirectory, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    if (closeErrors.length) throw new AggregateError(closeErrors, 'LAN01 suffix owner cleanup failed');
    assert(originalUnchanged, 'LAN01 original checkpoint changed');
  }
};
