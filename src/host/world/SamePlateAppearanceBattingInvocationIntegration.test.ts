import { appendFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import { prepareSamePaSceneBodies } from './SamePlateAppearanceSceneBodies.test-support';
import { prepareSamePaNonemptyFixture } from './SamePlateAppearanceNonemptyFixture.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';
import { openSqliteSamePlateAppearanceTakeSuccessorStore } from './SqliteSamePlateAppearanceTakeSuccessorStore';
import { openSqliteBattingPerceptionStore } from './SqliteBattingPerceptionStore';
import { openSqliteBattingEmotionStore } from './SqliteBattingEmotionStore';
import { openSqliteBattingEmotionExecutionStore } from './SqliteBattingEmotionExecutionStore';
import { openSqliteBattingExecutionInputStore, calculateCurrentSamePaBattingFromSqlite } from './SqliteBattingExecutionInputStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { readEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { readCurrentSamePaContinuationViewFromSqlite, readHistoricalSamePaContinuationViewFromSqlite } from './SamePlateAppearanceContinuationFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { battingEmotionFrame } from './NativeBattingEmotionExecution';
import { policy } from '../../core/world/psychology/EmotionFixtures.test-support';
import { request as emotionFixture } from '../../core/world/psychology/execution/ExecutionFixtures.test-support';
import type { SamePaContinuationInvocationReference } from './SamePlateAppearanceContinuation';

/** One integrated synthetic Native scenario. Every actor/model/body/Source is
 * accepted by its actual owner. Numeric declarations are existing finite test
 * fixtures. Score/appraisal are explicitly accepted assessments; no autonomous
 * model, genuine donor, neutral fallback, owner mock or readiness override. */
it('BI01 original capture, delayed delivery, explicit assessment and actual World CAS feed the effective batting calculation and retained TAKE successor', () => {
  const stage = (name: string) => {
    const output = process.env.BASEBALL_GATE_ERRORS;
    if (output) appendFileSync(output + '.BI01-stages.jsonl', JSON.stringify({ name, at: Date.now(), rss: process.memoryUsage().rss }) + '\n');
  };
  stage('fixture-start');
  const f = directNativeDispatchFixture(), accepted = new Map<string, unknown>(), track = f.x.f.track;
  stage('fixture-ready');
  const proof = <T>(body: () => T) => withSqliteReadTransaction(f.db, body);
  const provenance = (id: string) => ({ assessmentSourceId: id, assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'existing-explicit-Core-fixture', calibrationVersion: 'fixture-only-v1' });
  const save = <T extends { sourceId: string }>(s: T): T => { accepted.set(s.sourceId, s); return s; };
  try {
    const original = f.acceptedAction.source, originalMember = deriveSamePaDispatchRoles(f.actor, f.view)[0].member;
    const sceneBodyReferences = prepareSamePaSceneBodies(f);
    const perception = track(openSqliteBattingPerceptionStore(f.path, { readAcceptedPosture: id => accepted.get(id), readAcceptedObservation: id => accepted.get(id),
      readAcceptedDelivery: id => accepted.get(id), readAcceptedPrediction: id => accepted.get(id), readAcceptedAssessment: id => accepted.get(id) }));
    // This independent posture Source repeats the explicit measured fixture
    // geometry; no protected stance Source or receipt is transplanted.
    const geometry = { kind: 'stationary_pre_pitch_scene_v1', startedAtTick: f.actor.world.tick, validUntilTick: 20_000_000, ticksPerSecond: 1_000_000,
      handedness: 'R', centerOfMass: { x: -0.78, y: 1, z: -0.16 }, eyePosition: { x: -0.78, y: 1.6, z: -0.16 }, observerForward: { x: 0, y: 0, z: 1 },
      attention: { target: { kind: 'ball' }, focusedSinceTick: f.actor.world.tick }, bodyReadyTick: 100_000, latestMotorStartTick: 500_000,
      plateZ: original.nominalPitch.batter.plateZ, strikeZone: original.nominalPitch.batter.strikeZone };
    const postureSource = save({ sourceId: 'batch-original-posture', sourceVersion: 'fixture-only-v1', capability: 'owned_batting_invocation_posture_v1',
      viewReference: original.viewReference, member: originalMember, actionReference: f.request.actionReference, modelReference: original.batterModelReference,
      sceneBodyReferences, geometry, provenance: provenance('batch-original-posture-assessment') });
    const posture = perception.acceptPosture(postureSource.sourceId); if (posture.kind !== 'batting_invocation_posture') throw new Error('original posture pending');
    const postureReference = reference('batting_observation_v1_postures', posture);
    const genesisSource = save({ sourceId: 'batch-genesis', sourceVersion: 'fixture-only-v1', capability: 'owned_batting_emotion_genesis_v1',
      viewReference: original.viewReference, member: originalMember, policy: policy(), provenance: provenance('batch-genesis-assessment') });
    const genesisOwner = track(openSqliteBattingEmotionStore(f.path, { readAcceptedGenesis: id => accepted.get(id) }));
    const genesis = genesisOwner.acceptGenesis(genesisSource.sourceId); if (genesis.kind !== 'batting_emotion_genesis') throw new Error('genesis pending');
    const worldOwner = track(openSqliteWorldControlStore(f.path));
    worldOwner.initialize({ careerId: f.actor.binding.careerId, worldRevision: 0, control: { schemaVersion: 1, revision: 0, controllerId: 'explicit-fixture-controller', controlledClubId: null, domainIds: ['BATTING'], manualDomainIds: [] } });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(f.path, { readAcceptedConsumerSet: id => accepted.get(id), readAcceptedEpisode: id => accepted.get(id),
      readAcceptedRight: id => accepted.get(id), readAcceptedPhysicalPitch: id => accepted.get(id) }));
    const base = { sourceVersion: 'fixture-only-v1', enrollmentReference: original.enrollmentReference, viewReference: original.viewReference, firstPhysicalPitchSourceId: original.firstPhysicalPitchSourceId };
    const participants = deriveSamePaDispatchRoles(f.actor, f.view).map(role => ({ member: role.member, calibrationReferences: f.acceptedCalibrations.calibrations
      .filter(c => c.source.member.playerId === role.member.playerId).map(c => ({ route: c.source.route, calibrationReference: reference('pa_dispatch_v1_execution_calibrations', c) })) }));
    const consumersSource = save({ ...base, sourceId: 'batch-consumers', capability: 'same_pa_consumer_set_v1', actionReference: f.request.actionReference, participantInputs: participants });
    const consumers = dispatch.acceptConsumerSet(consumersSource.sourceId); if (consumers.kind !== 'consumer_set_prepared') throw new Error('actual adapters pending');
    const consumerSetReference = reference('pa_dispatch_v1_consumer_sets', consumers);
    const episodeSource = save({ ...base, sourceId: 'batch-episode', capability: 'same_pa_first_pitch_episode_v1', actionReference: f.request.actionReference, consumerSetReference });
    const episode = dispatch.acceptEpisode(episodeSource.sourceId); if (episode.kind !== 'prospective_episode_prepared') throw new Error('episode pending');
    const rightSource = save({ ...base, sourceId: 'batch-right', capability: 'same_pa_first_pitch_right_v1', actionReference: f.request.actionReference, consumerSetReference,
      episodeReference: reference('pa_dispatch_v1_episodes', episode), prefixReference: f.view.source.prefixReference });
    const right = dispatch.acceptRight(rightSource.sourceId); if (right.kind !== 'immutable_right_prepared') throw new Error('right pending');
    save({ sourceId: original.firstPhysicalPitchSourceId, sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_pitch_v1', actionReference: f.request.actionReference,
      rightReference: reference('pa_dispatch_v1_rights', right) });
    const pitch = dispatch.acceptPhysicalPitch(original.firstPhysicalPitchSourceId); if (pitch.kind === 'pending') throw new Error('physical TAKE pending');
    stage('first-take-complete');
    const operations: SamePaContinuationInvocationReference[] = [], efforts = Object.fromEntries(pitch.lineage.participantReferences.map(p => [p.playerId, 2]));
    let current = prepareSamePaNonemptyFixture(f, pitch, 'batch-cut0', efforts, operations);
    const member = () => current.basis.members.find(m => m.playerId === f.actor.binding.playerId)!;
    const calibration = (route: string) => reference('pa_continuation_v1_execution_calibrations', current.calibrationSet.calibrations.find(c => c.source.route === route && c.source.member.playerId === member().playerId)!);
    const advance = (ref: SamePaContinuationInvocationReference) => { const prior = current; operations.push(ref);
      expect(() => proof(() => readCurrentSamePaContinuationViewFromSqlite(f.db, prior.viewReference))).toThrow();
      stage('coverage-' + operations.length + '-start');
      current = prepareSamePaNonemptyFixture(f, pitch, 'batch-cut' + operations.length, efforts, [...operations]);
      stage('coverage-' + operations.length + '-ready');
      expect(proof(() => readHistoricalSamePaContinuationViewFromSqlite(f.db, prior.viewReference)).view).toEqual(prior.view); };
    const captureSource = save({ sourceId: 'batch-capture', sourceVersion: 'fixture-only-v1', capability: 'owned_batting_observation_v1', viewReference: current.viewReference,
      member: member(), postureReference, physicalPitchReference: reference('pa_dispatch_v1_pitch_actions', pitch), calibrationReference: calibration('batter_observation'),
      observedTick: current.view.physicalCut.crossing.tick, deliveryCutTick: current.view.physicalCut.crossing.tick, previousObservationReference: null });
    const capture = perception.acceptObservation(captureSource.sourceId); if (capture.kind !== 'batting_observation') throw new Error('capture pending');
    expect(capture.calculation.status).toBe('AWAITING_DELIVERY'); expect(capture.calculation.deliveredMemory).toBeNull();
    const observationReference = reference('batting_observation_v1_observations', capture); advance(observationReference);
    const next = track(openSqliteSamePlateAppearanceTakeSuccessorStore(f.path, { readAcceptedAction: id => accepted.get(id), readAcceptedSetup: id => accepted.get(id), readAcceptedPhysicalPitch: id => accepted.get(id) }));
    const prepareRetained = (id: string, readyAtUs: number) => {
      stage(id + ':retained-preparation-start');
      const actionSource = save({ sourceId: id + ':action', sourceVersion: 'fixture-only-v1', capability: 'same_pa_next_take_action_v1', viewReference: current.viewReference,
        previousPitchReference: reference('pa_dispatch_v1_pitch_actions', pitch), nominalPitch: { ...original.nominalPitch, delivery: { ...original.nominalPitch.delivery, readyAtUs } },
        timingReference: original.timingReference, releaseReference: original.releaseReference, pitchResponseReference: original.pitchResponseReference, batterModelReference: original.batterModelReference });
      const action = next.acceptAction(actionSource.sourceId); if (action.kind === 'pending') throw new Error('retained action pending');
      const actionReference = reference('pa_take_successor_v1_action_plans', action), nextPhysicalPitchSourceId = id + ':pitch';
      const source = save({ ...postureSource, sourceId: id + ':posture', capability: 'owned_next_take_batting_posture_v1', viewReference: current.viewReference,
        member: member(), actionReference, nextPhysicalPitchSourceId, geometry: { ...geometry, startedAtTick: action.bodyCut.completedAtTick,
          bodyReadyTick: readyAtUs, latestMotorStartTick: readyAtUs, validUntilTick: readyAtUs + 20_000_000,
          attention: { target: { kind: 'ball' }, focusedSinceTick: action.bodyCut.completedAtTick } }, provenance: provenance(id + ':posture-assessment') });
      const value = perception.acceptPosture(source.sourceId); if (value.kind !== 'batting_invocation_posture') throw new Error('retained posture pending');
      return { action, actionReference, nextPhysicalPitchSourceId, postureReference: reference('batting_observation_v1_postures', value) };
    };
    const ready = Math.max(pitch.result.delivery.timeline.followThroughEndUs, current.view.evaluationTick) + posture.model.observationCalibration.values.deliveryLatencyTicks;
    const deliveryPreparation = prepareRetained('batch-delivery-ready', ready);
    const deliverySource = save({ sourceId: 'batch-delivery', sourceVersion: 'fixture-only-v1', capability: 'owned_batting_observation_delivery_v1', viewReference: current.viewReference,
      member: member(), observationReference, completionReference: deliveryPreparation.actionReference, postureReference: deliveryPreparation.postureReference, calibrationReference: calibration('batter_observation') });
    stage('delivery-start');
    const delivery = perception.acceptDelivery(deliverySource.sourceId); if (delivery.kind !== 'batting_observation_delivery') throw new Error('delivery pending');
    expect(delivery.delivery.evaluatedAtTick).toBe(ready); expect(delivery.originalCaptureHash).toBe(hash(capture));
    const deliveryReference = reference('batting_observation_v1_deliveries', delivery); advance(deliveryReference); expect(current.view.evaluationTick).toBe(ready);
    const parameter = posture.model.predictionCalibration;
    const forecastSource = save({ sourceId: 'batch-forecast', sourceVersion: 'fixture-only-v1', capability: 'owned_batting_observed_prediction_v1', viewReference: current.viewReference,
      member: member(), observationReference, deliveryReference, modelReference: original.batterModelReference,
      predictionParameterReference: { sourceId: parameter.sourceId, sourceVersion: parameter.sourceVersion, sourceHash: hash(parameter) } });
    const forecast = perception.acceptPrediction(forecastSource.sourceId); if (forecast.kind !== 'batting_observed_prediction') throw new Error('forecast pending');
    expect(forecast.forecast.observedTick).toBe(capture.source.observedTick); expect(forecast.forecast.availableTick).toBe(ready);
    const predictionReference = reference('batting_prediction_v1_predictions', forecast); advance(predictionReference);
    const scoreSource = save({ sourceId: 'batch-score', sourceVersion: 'fixture-only-v1', capability: 'owned_batting_current_score_assessment_v1', viewReference: current.viewReference,
      member: member(), predictionReference, modelReference: original.batterModelReference, observationCutReference: observationReference, score: 0.5, provenance: provenance('batch-explicit-score') });
    const score = perception.acceptAssessment(scoreSource.sourceId); if (score.kind !== 'batting_score_assessment') throw new Error('explicit score pending');
    const declared = structuredClone(emotionFixture()), world = proof(() => readEmotionWorldRevisionFromSqlite(f.db, f.actor.binding.careerId))!;
    const expectedWorld = { careerId: f.actor.binding.careerId, worldRevision: world.head.worldRevision, controlRevision: world.head.control.revision, controlHash: hash(world.head.control) };
    const sourceFrame = { viewReference: current.viewReference, observationReference, deliveryReference, previousExecutionReference: null };
    const time = { tick: current.view.evaluationTick, sequence: operations.length }, frame = battingEmotionFrame(sourceFrame, f.actor, world, time);
    const a = declared.appraisal as any, club = f.actor.binding.clubId, game = f.actor.worldFixture.game, opponent = club === game.homeClubId ? game.awayClubId : game.homeClubId;
    a.importance.scope = frame.scope; a.importance.contextId = frame.contextId; a.importance.time = time; a.importance.clubId = club; a.importance.opponentClubId = opponent;
    Object.assign(a.importance.competition, { careerId: frame.scope.careerId, matchId: frame.scope.matchId, clubId: club, opponentClubId: opponent, competitionId: f.actor.binding.competitionEditionId });
    Object.assign(a.importance.personal, { scope: frame.scope, clubId: club }); Object.assign(a.importance.rivalry, { careerId: frame.scope.careerId, fromClubId: club, toClubId: opponent });
    for (const part of [a.importance.competition, a.importance.personal, a.importance.rivalry, a.player]) part.stamp.time = time;
    a.player.scope = frame.scope; a.event.scope = frame.scope; a.event.contextId = frame.contextId; a.event.eventId = delivery.source.sourceId;
    a.event.stamp = { sourceId: delivery.source.sourceId, revision: delivery.eventSequence, time: { tick: delivery.delivery.evaluatedAtTick, sequence: delivery.eventSequence } };
    a.evidenceEventIds = [delivery.source.sourceId]; a.policy = genesis.state.policy;
    const { frame: _frame, ...baseline } = declared.baseline;
    for (const window of [baseline.swingDecision, baseline.throwIntent, baseline.defenseReplan]) for (const key of ['tick', 'earliestTick', 'latestTick'] as const) (window as any)[key] += time.tick - 100;
    const emotionSource = save({ sourceId: 'batch-emotion', sourceVersion: 'fixture-only-v1', capability: 'owned_batting_emotion_execution_v1', executionId: 'batch-emotion-event', ...sourceFrame,
      member: member(), genesisReference: reference('batting_emotion_v1_geneses', genesis), expectedWorld, appraisalAssessment: a, baseline, executionModel: declared.model, provenance: provenance('batch-explicit-appraisal') });
    const emotionOwner = track(openSqliteBattingEmotionExecutionStore(f.path, { readAcceptedExecution: id => accepted.get(id) }));
    stage('emotion-start');
    const emotion = emotionOwner.accept(emotionSource.sourceId); if (emotion.kind === 'pending') throw new Error('emotion pending');
    expect(worldOwner.readHead(f.actor.binding.careerId)!.worldRevision).toBe(1); expect(emotion.acceptance.afterEmotionRevision).toBe(1);
    const emotionReference = reference('batting_emotion_execution_v1_executions', emotion); advance(emotionReference);
    const inputSource = save({ sourceId: 'batch-input', sourceVersion: 'fixture-only-v1', capability: 'owned_same_pa_batting_execution_input_v1', viewReference: current.viewReference,
      member: member(), postureReference, emotionReference, intentReference: null, assessmentReferences: [reference('batting_score_v1_assessments', score)],
      calibrationReferences: ['batter_decision', 'batter_motor', 'batter_swing'].map(route => ({ route, calibrationReference: calibration(route) })), directive: 'TAKE', expectedWorld: { ...expectedWorld, worldRevision: 1 } });
    const calculationOwner = track(openSqliteBattingExecutionInputStore(f.path, { readAcceptedInput: id => accepted.get(id), readAcceptedInvocation: id => accepted.get(id) }));
    stage('calculation-start');
    const input = calculationOwner.acceptInput(inputSource.sourceId); if (input.kind !== 'same_pa_batting_input') throw new Error('input pending');
    const inputReference = reference('batting_execution_v1_inputs', input), direct = proof(() => calculateCurrentSamePaBattingFromSqlite(f.db, inputReference));
    expect(direct.motionIssued).toBe(false);
    const call = save({ sourceId: 'batch-calculation', sourceVersion: 'fixture-only-v1', capability: 'owned_same_pa_batting_calculation_v1', viewReference: current.viewReference, member: member(), inputReference });
    const calculation = calculationOwner.invoke(call.sourceId); if (calculation.kind !== 'same_pa_batting_calculation') throw new Error('calculation pending');
    expect(calculation.calculation).toEqual(direct.calculation); expect(calculation.motionIssued).toBe(false); expect(calculation.invokedRoutes).toEqual(['batter_decision']);
    advance(reference('batting_execution_v1_executions', calculation));
    const retained = prepareRetained('batch-final-next', current.view.evaluationTick), setupSource = save({ sourceId: 'batch-final-setup', sourceVersion: 'fixture-only-v1', capability: 'same_pa_retained_take_setup_v1',
      actionReference: retained.actionReference, postureReference: retained.postureReference, nextPhysicalPitchSourceId: retained.nextPhysicalPitchSourceId,
      participantInputs: current.basis.members.map(m => ({ member: m, calibrationReferences: current.calibrationSet.calibrations.filter(c => c.source.member.playerId === m.playerId)
        .map(c => ({ route: c.source.route, calibrationReference: reference('pa_continuation_v1_execution_calibrations', c) })) })) });
    const setup = next.acceptSetup(setupSource.sourceId); if (setup.kind === 'pending') throw new Error('final setup pending');
    save({ sourceId: retained.nextPhysicalPitchSourceId, sourceVersion: 'fixture-only-v1', capability: 'same_pa_successor_take_pitch_v1', actionReference: retained.actionReference, setupReference: reference('pa_take_successor_v1_setups', setup) });
    stage('second-take-start');
    const second = next.acceptPhysicalPitch(retained.nextPhysicalPitchSourceId); if (second.kind === 'pending') throw new Error('second TAKE pending');
    stage('second-take-committed');
    expect(second.progressRevision).toBe(2); expect(second.frame.bodyCut.completedAtTick).toBeGreaterThanOrEqual(ready);
    expect(f.x.f.workload.readHead('career-a', 'p2')!.revision).toBe(1); expect(calculationOwner.readInvocation(call.sourceId)).toEqual(calculation);
    expect(emotionOwner.accept(emotionSource.sourceId)).toEqual(emotion); expect(perception.acceptDelivery(deliverySource.sourceId)).toEqual(delivery);
    stage('historical-replay-complete');
  } finally { f.close(); }
}, 1_200_000);
