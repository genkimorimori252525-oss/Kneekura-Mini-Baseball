import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteBattingPerceptionStore } from './SqliteBattingPerceptionStore';
import { openSqliteBattingEmotionExecutionStore } from './SqliteBattingEmotionExecutionStore';
import { openSqliteBattingExecutionInputStore } from './SqliteBattingExecutionInputStore';
import { readEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { battingEmotionFrame } from './NativeBattingEmotionExecution';
import { request as emotionFixture } from '../../core/world/psychology/execution/ExecutionFixtures.test-support';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { SamePaDispatchRoute } from './SamePlateAppearanceDispatchRoles';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { DurableBattingInvocationPosture } from './NativeBattingPerception';
import type { DurableSamePaBattingIntent } from './NativeBattingExecutionInput';

type Fixture = ReturnType<typeof samePaPhysicalLifecycleFixture>;
const provenance = (id: string) => ({ assessmentSourceId: id, assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'existing-explicit-Core-fixture', calibrationVersion: 'fixture-only-v1' });
/** Real Native segment. Each source is explicitly accepted; forecasts observe
 * an owned sample, and physical commitment alone calculates/adopts the input. */
export const prepareInFlightBattingSwing = (h: Fixture, prepared: ReturnType<Fixture['prepareAction']>, label: string,
  onBeforeLaunch?: (owned: Readonly<{ posture: DurableBattingInvocationPosture; postureReference: SamePaReference<'batting_observation_v1_postures'>;
    intent: DurableSamePaBattingIntent; intentReference: SamePaReference<'batting_execution_v1_intents'> }>) => void) => {
  const { f, save, accepted } = h, track = f.x.f.track;
  const proof = <T>(body: () => T) => withSqliteReadTransaction(f.db, body);
  const member = () => h.current().basis.members.find(m => m.playerId === f.actor.binding.playerId)!;
  const calibration = (route: SamePaDispatchRoute) => reference('pa_lifecycle_v1_execution_calibrations', h.current().calibrationSet.calibrations.find(c => c.source.route === route && c.source.member.playerId === member().playerId)!);
  const perception = track(openSqliteBattingPerceptionStore(f.path, { readAcceptedPosture: id => accepted.get(id), readAcceptedObservation: id => accepted.get(id),
    readAcceptedDelivery: id => accepted.get(id), readAcceptedPrediction: id => accepted.get(id), readAcceptedAssessment: id => accepted.get(id) }));
  const inputOwner = track(openSqliteBattingExecutionInputStore(f.path, { readAcceptedIntent: id => accepted.get(id), readAcceptedInput: id => accepted.get(id) }));
  const ready = prepared.action.source.nominalPitch.delivery.readyAtUs;
  const postureSource = save({ sourceId: label + ':posture', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_batting_posture_v1',
    viewReference: h.current().viewReference, member: member(), actionReference: prepared.actionReference, modelReference: h.original.batterModelReference,
    sceneBodyReferences: h.sceneBodyReferences, geometry: { ...h.geometry, startedAtTick: prepared.action.bodyCut.completedAtTick,
      attention: { target: { kind: 'ball' }, focusedSinceTick: prepared.action.bodyCut.completedAtTick }, bodyReadyTick: ready, latestMotorStartTick: ready + 1_000_000 },
    provenance: provenance(label + ':posture-assessment') });
  const posture = perception.acceptPosture(postureSource.sourceId); if (posture.kind !== 'batting_invocation_posture') throw new Error('real per-pitch posture pending: ' + JSON.stringify(posture));
  const postureReference = reference('batting_observation_v1_postures', posture);
  const intentSource = save({ sourceId: label + ':intent', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_same_pa_batting_intent_v1',
    viewReference: h.current().viewReference, member: member(), postureReference, actorReference: posture.lineage.actorReference, attempt: 'ordinary_swing' });
  const intent = inputOwner.acceptIntent(intentSource.sourceId); if (intent.kind !== 'same_pa_batting_intent') throw new Error('real original intent pending');
  const intentReference = reference('batting_execution_v1_intents', intent);
  onBeforeLaunch?.({ posture, postureReference, intent, intentReference });
  const beforeLaunch = { posture, intent, eventCount: h.events.length, worldRevision: h.worldOwner.readHead(f.actor.binding.careerId)!.worldRevision };
  const launch = h.launch(h.prepareRight(prepared, postureReference)), launchReference = reference('pa_physical_v1_launches', launch);
  const captureCutSource = save({ sourceId: label + ':capture-cut', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_cut_v1',
    viewReference: h.current().viewReference, launchReference, previousOperationReference: launchReference, throughTick: launch.evaluationTick + 50_000 });
  const captureCut = h.physical.acceptOperation(captureCutSource.sourceId); if (captureCut.kind !== 'same_pa_physical_cut_v1') throw new Error('real capture physical cut pending');
  const captureCutReference = reference('pa_physical_v1_cuts', captureCut); h.advance(captureCutReference);
  const captureSource = save({ sourceId: label + ':capture', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_batting_observation_v1',
    viewReference: h.current().viewReference, member: member(), postureReference, physicalPitchReference: launchReference, physicalOperationReference: captureCutReference,
    calibrationReference: calibration('batter_observation'), observedTick: captureCut.evaluationTick, previousObservationReference: null });
  const wrongTime = save({ ...captureSource, sourceId: label + ':wrong-time-capture', observedTick: captureSource.observedTick + 1 });
  let wrongTimeRejected = false;
  try { perception.acceptObservation(wrongTime.sourceId); } catch { wrongTimeRejected = true; }
  const capture = perception.acceptObservation(captureSource.sourceId); if (capture.kind !== 'batting_observation') throw new Error('real capture pending: ' + JSON.stringify(capture));
  const observationReference = reference('batting_observation_v1_observations', capture); h.advance(observationReference);
  const earlySource = save({ sourceId: label + ':same-cut-delivery', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_batting_observation_delivery_v1',
    viewReference: h.current().viewReference, member: member(), observationReference, physicalPitchReference: launchReference, physicalOperationReference: captureCutReference,
    calibrationReference: calibration('batter_observation') });
  const earlyDelivery = perception.acceptDelivery(earlySource.sourceId);
  const latency = capture.calculation.effectiveValues.deliveryLatencyTicks;
  const deliveryCutSource = save({ sourceId: label + ':delivery-cut', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_cut_v1',
    viewReference: h.current().viewReference, launchReference, previousOperationReference: captureCutReference, throughTick: captureCut.evaluationTick + latency });
  const deliveryCut = h.physical.acceptOperation(deliveryCutSource.sourceId); if (deliveryCut.kind !== 'same_pa_physical_cut_v1') throw new Error('real delivery physical cut pending');
  const deliveryCutReference = reference('pa_physical_v1_cuts', deliveryCut); h.advance(deliveryCutReference);
  const deliverySource = save({ ...earlySource, sourceId: label + ':delivery', viewReference: h.current().viewReference, member: member(),
    physicalOperationReference: deliveryCutReference, calibrationReference: calibration('batter_observation') });
  const staleCut = save({ ...deliverySource, sourceId: label + ':stale-cut-delivery', physicalOperationReference: captureCutReference });
  let staleCutRejected = false;
  try { perception.acceptDelivery(staleCut.sourceId); } catch { staleCutRejected = true; }
  const delivery = perception.acceptDelivery(deliverySource.sourceId); if (delivery.kind !== 'batting_observation_delivery') throw new Error('real delivery pending: ' + JSON.stringify(delivery));
  const deliveryReference = reference('batting_observation_v1_deliveries', delivery); h.advance(deliveryReference);
  const parameter = posture.model.predictionCalibration;
  const forecastSource = save({ sourceId: label + ':forecast', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_batting_observed_prediction_v1',
    viewReference: h.current().viewReference, member: member(), observationReference, deliveryReference, modelReference: h.original.batterModelReference,
    predictionParameterReference: { sourceId: parameter.sourceId, sourceVersion: parameter.sourceVersion, sourceHash: hash(parameter) } });
  const forecast = perception.acceptPrediction(forecastSource.sourceId); if (forecast.kind !== 'batting_observed_prediction') throw new Error('real forecast pending');
  const predictionReference = reference('batting_prediction_v1_predictions', forecast); h.advance(predictionReference);
  const scoreSource = save({ sourceId: label + ':score', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_batting_score_assessment_v1',
    viewReference: h.current().viewReference, member: member(), predictionReference, modelReference: h.original.batterModelReference, observationCutReference: observationReference,
    score: 0.9, provenance: provenance(label + ':explicit-score') });
  const score = perception.acceptAssessment(scoreSource.sourceId); if (score.kind !== 'batting_score_assessment') throw new Error('real explicit score pending');
    const declared = structuredClone(emotionFixture()), world = proof(() => readEmotionWorldRevisionFromSqlite(f.db, f.actor.binding.careerId))!;
    const expectedWorld = { careerId: f.actor.binding.careerId, worldRevision: world.head.worldRevision, controlRevision: world.head.control.revision, controlHash: hash(world.head.control) };
    const sourceFrame = { viewReference: h.current().viewReference, observationReference, deliveryReference, previousExecutionReference: null };
    const time = { tick: h.current().view.cut.evaluationTick, sequence: h.events.length }, frame = battingEmotionFrame(sourceFrame, f.actor, world, time);
    const a = declared.appraisal as any, club = f.actor.binding.clubId, game = f.actor.worldFixture.game, opponent = club === game.homeClubId ? game.awayClubId : game.homeClubId;
    a.importance.scope = frame.scope; a.importance.contextId = frame.contextId; a.importance.time = time; a.importance.clubId = club; a.importance.opponentClubId = opponent;
    Object.assign(a.importance.competition, { careerId: frame.scope.careerId, matchId: frame.scope.matchId, clubId: club, opponentClubId: opponent, competitionId: f.actor.binding.competitionEditionId });
    Object.assign(a.importance.personal, { scope: frame.scope, clubId: club }); Object.assign(a.importance.rivalry, { careerId: frame.scope.careerId, fromClubId: club, toClubId: opponent });
    for (const part of [a.importance.competition, a.importance.personal, a.importance.rivalry, a.player]) part.stamp.time = time;
    a.player.scope = frame.scope; a.event.scope = frame.scope; a.event.contextId = frame.contextId; a.event.eventId = delivery.source.sourceId;
    a.event.stamp = { sourceId: delivery.source.sourceId, revision: delivery.eventSequence, time: { tick: delivery.delivery.evaluatedAtTick, sequence: delivery.eventSequence } };
    a.evidenceEventIds = [delivery.source.sourceId]; a.policy = h.genesis.state.policy;
    const { frame: _frame, ...baseline } = declared.baseline;
    for (const window of [baseline.swingDecision, baseline.throwIntent, baseline.defenseReplan]) for (const key of ['tick', 'earliestTick', 'latestTick'] as const) (window as any)[key] += time.tick - 100;
    const emotionSource = save({ sourceId: label + ':emotion', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_batting_emotion_execution_v1', physicalPitchReference: launchReference, physicalOperationReference: deliveryCutReference, executionId: label + ':emotion-event', ...sourceFrame,
      member: member(), genesisReference: reference('batting_emotion_v1_geneses', h.genesis), expectedWorld, appraisalAssessment: a, baseline, executionModel: declared.model, provenance: provenance(label + ':explicit-appraisal') });
  const emotionOwner = track(openSqliteBattingEmotionExecutionStore(f.path, { readAcceptedExecution: id => accepted.get(id) }));
  const emotion = emotionOwner.accept(emotionSource.sourceId); if (emotion.kind === 'pending') throw new Error('real explicit emotion pending');
  const emotionReference = reference('batting_emotion_execution_v1_executions', emotion); h.advance(emotionReference);
  const decisionCutSource = save({ sourceId: label + ':decision-cut', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_cut_v1',
    viewReference: h.current().viewReference, launchReference, previousOperationReference: deliveryCutReference,
    throughTick: emotion.acceptance.proposal.inputs.swingDecision.tick });
  const decisionCut = h.physical.acceptOperation(decisionCutSource.sourceId); if (decisionCut.kind !== 'same_pa_physical_cut_v1') throw new Error('real scheduled decision cut pending');
  const decisionCutReference = reference('pa_physical_v1_cuts', decisionCut); h.advance(decisionCutReference);
  const inputSource = save({ sourceId: label + ':input', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_same_pa_batting_execution_input_v1',
    viewReference: h.current().viewReference, member: member(), postureReference, emotionReference, intentReference,
    physicalPitchReference: launchReference, physicalOperationReference: decisionCutReference, assessmentReferences: [reference('batting_score_v1_assessments', score)],
    calibrationReferences: (['batter_decision', 'batter_motor', 'batter_swing'] as const).map(route => ({ route, calibrationReference: calibration(route) })),
    directive: 'SWING', expectedWorld: { ...expectedWorld, worldRevision: emotion.acceptance.afterWorldRevision } });
  const input = inputOwner.acceptInput(inputSource.sourceId); if (input.kind !== 'same_pa_batting_input') throw new Error('real prepared input pending');
  const inputReference = reference('batting_execution_v1_inputs', input);
  const preparedWorldRevision = h.worldOwner.readHead(f.actor.binding.careerId)!.worldRevision;
  const commitmentSource = save({ sourceId: label + ':commitment', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_commitment_v1',
    viewReference: h.current().viewReference, launchReference, previousOperationReference: decisionCutReference, inputReference, intentReference });
  const commitment = h.physical.acceptOperation(commitmentSource.sourceId); if (commitment.kind !== 'same_pa_physical_commitment_v1') throw new Error('real effective commitment pending: ' + JSON.stringify(commitment));
  const commitmentReference = reference('pa_physical_v1_commitments', commitment); h.advance(commitmentReference);
  const resolutionSource = save({ sourceId: label + ':resolution', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_resolution_v1',
    viewReference: h.current().viewReference, launchReference, previousOperationReference: commitmentReference, commitmentReference, throughTick: launch.trajectory.endTick });
  const resolution = h.physical.acceptOperation(resolutionSource.sourceId); if (resolution.kind !== 'same_pa_physical_resolution_v1') throw new Error('real swing resolution pending');
  const resolutionReference = reference('pa_physical_v1_resolutions', resolution); h.advance(resolutionReference);
  return { beforeLaunch, launch, launchReference, posture, postureReference, intent, intentReference, captureCut, capture, observationReference,
    earlyDelivery, wrongTimeRejected, staleCutRejected, deliveryCut, decisionCut, delivery, deliveryReference, forecast, score, emotion, input, inputReference, preparedWorldRevision, commitment, commitmentReference, resolution, resolutionReference,
    perception, inputOwner, emotionOwner };
};
