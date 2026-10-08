import { expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { openSqlitePlayerFieldingModelStore, type AcceptedPlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import { openSqlitePlayerObservationModelStore, type AcceptedPlayerObservationModel } from './SqlitePlayerObservationModelStore';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedPrePitchRunnerExecution } from './PrePitchRunnerExecution';
import type { AcceptedRunnerVisibleContactWaitPolicy, AcceptedRunnerEventView } from '../../core/sim/running/RunnerPartialTagUpWaitContracts.test-support';
import type { RunnerContactWaitPolicyViewModule } from './RunnerNativeContactWaitContracts.test-support';

/** Actual registered walk/next actor and prospectively owned models; explicit synthetic calibration only. */
export const runnerContactWaitProspectiveFixture = () => {
  const directory = mkdtempSync(join(tmpdir(),'kneekura-runner-contact-view-')), databasePath = join(directory,'state.sqlite');
  const cleanupFile = () => rmSync(directory,{ recursive:true,force:true });
  const x = (() => {
    try { return physicalPlateAppearanceActorFixture(databasePath, undefined, { ruleProfileId: asRuleProfileId('npb-2026') }); }
    catch (error) { cleanupFile(); throw error; }
  })(), { f } = x;
  try {
    const first = x.actors.accept(x.source.sourceId); let tick = first.world.tick;
    for (let i = 0; i < 4; i++) {
      const action = continuousPitchAction(f, i, tick);
      x.actions.set(action.sourceId, { ...action, request: { ...action.request, delivery: { ...action.request.delivery,
        moundReference: { ...action.request.delivery.moundReference, x: 1 } } } });
      tick = x.pitches.accept(action.sourceId, i).result.pitch.resolution.timeline.lastEventTick;
    }
    const close = x.closeInput(tick, 'pitch-3', 'away-1'); x.closes.set(close.sourceId, close); x.closure.submit(close.sourceId);
    x.accepted.set('batter-2', { sourceId: 'batter-2', sourceVersion: 'v1', gameId: 'game-1', playerId: 'away-2', activationApplicationId: 'application-1' });
    const actor = x.actors.accept('batter-2'), runner = actor.world.runners[0];
    expect(actor.match.bases.first).toBe(first.binding.playerId); expect(actor.world.runners).toHaveLength(1);
    expect(runner.playerId).toBe(first.binding.playerId);
    const noPitch = () => expect(f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=?')
      .get(actor.source.gameId, actor.match.playId)!.n).toBe(0);
    noPitch();
    const fieldingSource: AcceptedPlayerFieldingModel = { sourceId: 'wait-observer-fielding', sourceVersion: 'synthetic-v1',
      careerId: first.binding.careerId, playerId: runner.playerId, personLinkSourceId: first.binding.personLinkSourceId,
      acceptedAtDay: actor.binding.gameDay,
      ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
        firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
        armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
      transferParameters: { minimumTransferDelayTicks: 100, maximumTransferDelayTicks: 300, fixedGripOffsetTicks: 10 },
      throwCalibration: { minimumReleaseSpeedMps: 10, maximumReleaseSpeedMps: 30, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 } };
    const fielding = f.track(openSqlitePlayerFieldingModelStore(f.path, { readAcceptedModel: id => id === fieldingSource.sourceId ? fieldingSource : null }))
      .accept(fieldingSource.sourceId);
    const calibration = playerObservationCalibrationFixture();
    const modelSource: AcceptedPlayerObservationModel = { sourceId: 'wait-observation-model', sourceVersion: 'synthetic-v1',
      careerId: first.binding.careerId, playerId: runner.playerId, personLinkSourceId: first.binding.personLinkSourceId,
      fieldingModelSourceId: fielding.source.sourceId, acceptedAtDay: actor.binding.gameDay,
      calibration: { ...calibration, memoryDecayParameters: { ...calibration.memoryDecayParameters, ticksPerSecond: 1_000_000 } } };
    const model = f.track(openSqlitePlayerObservationModelStore(f.path, { readAcceptedModel: id => id === modelSource.sourceId ? modelSource : null }))
      .accept(modelSource.sourceId);
    const installOtherObservation = () => {
      const otherFieldingSource: AcceptedPlayerFieldingModel = { ...fieldingSource,sourceId:'wait-other-fielding',
        careerId:actor.binding.careerId,playerId:actor.binding.playerId,personLinkSourceId:actor.binding.personLinkSourceId };
      const otherFielding = f.track(openSqlitePlayerFieldingModelStore(f.path,
        { readAcceptedModel:id => id === otherFieldingSource.sourceId ? otherFieldingSource : null })).accept(otherFieldingSource.sourceId);
      const otherSource: AcceptedPlayerObservationModel = { ...modelSource,sourceId:'wait-other-observation',
        careerId:actor.binding.careerId,playerId:actor.binding.playerId,personLinkSourceId:actor.binding.personLinkSourceId,
        fieldingModelSourceId:otherFielding.source.sourceId };
      return f.track(openSqlitePlayerObservationModelStore(f.path,
        { readAcceptedModel:id => id === otherSource.sourceId ? otherSource : null })).accept(otherSource.sourceId);
    };
    noPitch();
    const policy: AcceptedRunnerVisibleContactWaitPolicy = { sourceId: 'wait-policy', sourceVersion: 'synthetic-v1', capability: 'runner_visible_contact_fly_wait_v1',
      careerId: first.binding.careerId, playerId: runner.playerId, personLinkSourceId: first.binding.personLinkSourceId,
      acceptedAtDay: actor.binding.gameDay, observationModelSourceId: model.source.sourceId, ticksPerSecond: 1_000_000,
      classification: { version: 'paired_visible_contact_and_loft_estimates_v1', minimumContactRecognitionConfidence: 0.2,
        maximumEstimatedContactGapMeters: 0.15, minimumLoftRecognitionConfidence: 0.2, minimumHeightAboveGroundMeters: 0.05,
        minimumUpwardVelocityMps: 0.05, groundReferenceHeightMeters: 0 },
      timingErrorParameters: { minimumDetectionQuality: 0.2, minimumTimeErrorSeconds: 0.001, maximumTimeErrorSeconds: 0.01 },
      availability: { version: 'capture_plus_explicit_sensor_delay_v1', sensorDelayTicks: 0 } };
    const view: AcceptedRunnerEventView = { sourceId: 'wait-view', sourceVersion: 'synthetic-v1', kind: 'prospective_runner_event_view_v1',
      physicalActorSourceId: actor.source.sourceId, gameId: actor.source.gameId, playerId: runner.playerId, policySourceId: policy.sourceId,
      validFromTick: actor.world.tick, validThroughTick: actor.world.tick + 20_000_000, attentionStartedAtTick: actor.world.tick,
      poseVersion: 'synthetic-body-translation-world-axes-v1', bodyRelativeEyeOffset: { x: 0, y: 3, z: 0 }, forward: { x: 0, y: 0, z: 1 },
      attentionTarget: 'bat_ball_contact' };
    const policies = new Map([[policy.sourceId, policy]]), views = new Map([[view.sourceId, view]]);
    const authority = { readAcceptedPolicy: (id: string) => policies.get(id) ?? null, readAcceptedView: (id: string) => views.get(id) ?? null };
    const peer = () => Object.fromEntries(['physical_plate_appearance_actors','physical_pitch_progress_heads','physical_pitch_progress_actions',
      'world_player_person_links','world_player_fielding_models','world_player_observation_models']
      .map(name => [name, f.db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all().map(row => actorHash(row))]));
    // Hash every table independently; assertion diagnostics contain no domain row payloads.
    const allRows = () => Object.fromEntries(f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
      .map(row => String(row.name)).map(name => [name, f.db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"')
        .all().map(row => actorHash(row)).sort()]));
    const advancePitch = () => {
      const zero = { x: 0, y: 0, z: 0 };
      const motion: AcceptedPrePitchRunnerExecution = { kind: 'pre_pitch_upright_runner_v1', sourceId: 'wait-prior-runner-controller', sourceVersion: 'synthetic-v1',
        gameId: actor.source.gameId, physicalActorSourceId: actor.source.sourceId, playerId: runner.playerId, motionRevision: 0,
        route: { segments: [{ kind: 'line', start: runner.position, end: { x: runner.position.x + 10, z: runner.position.z } }] },
        startMotion: { tick: actor.world.tick, routeDistanceMeters: 0, speedMps: 0, driveDirection: 1, bodyMode: 'upright' },
        intent: { kind: 'hold', issuedTick: actor.world.tick }, parameters: { ticksPerSecond: 1_000_000, reactionDelayTicks: 0,
          accelerationMps2: 1, brakingMps2: 4, slideDecelerationMps2: 4, topSpeedMps: 7 }, coverageThroughTick: actor.world.tick + 20_000_000,
        bodyPose: { bodyOriginHeightMeters: 0, primitiveMotions: (['glove','body','tag_hand','left_foot','right_foot'] as const).map(role => ({ role,
          startOffset: { x: 0, y: role === 'body' ? 1 : 0.05, z: 0 }, offsetVelocity: zero, offsetAcceleration: zero })) } };
      const initial = continuousPitchAction(f, 0, actor.world.tick);
      const { initialWorldSourceId: _initial, ...rest } = initial as typeof initial & { initialWorldSourceId: string };
      const action = { ...rest, sourceId: 'wait-dependent-take', activationApplicationId: 'application-1', prePitchRunner: motion,
        request: { ...initial.request, workloadRevision: 1 } };
      x.actions.set(action.sourceId, action); return x.pitches.accept(action.sourceId, 0);
    };
    return { ...x, first, actor, runner, fielding, model, policy, view, policies, views, authority, noPitch, peer, allRows, installOtherObservation, advancePitch, cleanupFile };
  } catch (error) { try { f.close(); } finally { cleanupFile(); } throw error; }
};

export const requireRunnerContactWaitFactory = (module: unknown): RunnerContactWaitPolicyViewModule['openSqliteRunnerContactWaitStore'] => {
  const factory = (module as Partial<RunnerContactWaitPolicyViewModule>).openSqliteRunnerContactWaitStore;
  expect(typeof factory).toBe('function');
  return factory!;
};
