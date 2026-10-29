import { expect } from 'vitest';
import { readSamePaOccupiedRunnerHoldFromSqlite } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';
import type { SQLOutputValue } from 'node:sqlite';
import { appendNativeBatterCatchHold } from './SamePlateAppearanceBatterCatchNative.test-support';
import { appendNativeBatterRunCheckpoint } from './SamePlateAppearanceBatterRunNative.test-support';
import { completeNativeFairCatchTerminal } from './SamePlateAppearanceFairCatchTerminalNative.test-support';
import type { appendNativeCatchWork } from './SamePlateAppearanceCatchWorkNative.test-support';
import type { completeNativeCaughtDefenderAdoption } from './SamePlateAppearanceCatchResponseNative.test-support';
import type { SamePaPhysicalFieldRoot } from './SamePlateAppearancePhysicalEpisode';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { applyPitchFatigueToExecution } from '../../core/sim/pitch/PitchFatigueExecution';
import { inFlightBattingFixtureTiming } from './InFlightBattingFixtureTiming.test-support';
import { selectPlayerPitchTimingProfileFromSqlitePrefix } from './SqlitePlayerPitchTimingStore';
import { readPlayerReleaseGeometryPrefixFromSqlite } from './SqlitePlayerReleaseGeometryStore';
import { readPitchFatiguePolicyFromSqlite } from './SqlitePitchFatiguePolicyStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteBattingPerceptionStore, readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { openSqliteBattingEmotionExecutionStore, readBattingEmotionExecutionFromSqlite } from './SqliteBattingEmotionExecutionStore';
import { openSqliteBattingExecutionInputStore, readSamePaBattingIntentFromSqlite, readSamePaBattingExecutionInputFromSqlite } from './SqliteBattingExecutionInputStore';
import { assertInFlightBattingWriteCurrentFromSqlite } from './InFlightBattingLifecycleFenceFromSqlite';
import { readEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { battingEmotionFrame } from './NativeBattingEmotionExecution';
import { request as emotionFixture } from '../../core/world/psychology/execution/ExecutionFixtures.test-support';
import type { SamePaLifecyclePrefix, SamePaLifecycleView } from './SamePlateAppearanceLifecycle';
import type { DurableBattingEmotionExecution } from './NativeBattingEmotionExecution';
import type { SamePaPreparedPhysicalLifecycle, SamePaPhysicalLifecycleSuffix } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { SamePaDispatchRoute } from './SamePlateAppearanceDispatchRoles';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { DurableBattingInvocationPosture, DurableBattingObservation, DurableBattingObservationDelivery, DurableBattingScoreAssessment } from './NativeBattingPerception';
import type { DurableSamePaBattingIntent, DurableSamePaBattingExecutionInput } from './NativeBattingExecutionInput';
import type { SamePaPhysicalCommitmentSource, SamePaPhysicalLaunch, SamePaPhysicalCut } from './SamePlateAppearancePhysicalEpisode';
import { readCurrentSamePaInFlightCutFromSqlite, readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';

type Fixture = SamePaPreparedPhysicalLifecycle;

/** The unchanged batting tail only needs these original owned dependencies.
 * A retained fixture supplies normal reader results, never fabricated receipts. */
export type NativeSpinNeutralPostObservationContextV193 = Pick<Fixture,
  'save' | 'accepted' | 'advance' | 'physical' | 'original' | 'events' | 'genesis' | 'worldOwner'> & {
  f: Pick<Fixture['f'], 'db' | 'path' | 'actor'> & { x: { f: Pick<Fixture['f']['x']['f'], 'track'> } };
  current(): Pick<ReturnType<Fixture['current']>, 'view' | 'viewReference' | 'basis'> & {
    calibrationSet: Pick<ReturnType<Fixture['current']>['calibrationSet'], 'calibrations'>;
  };
};
type SwingOptions = Readonly<{ attempt?: DurableSamePaBattingIntent['originalIntent']['attempt'];
  onStage?: (name: string) => void;
  prepareCommitment?: (source: Extract<SamePaPhysicalCommitmentSource, { capability: 'same_pa_physical_commitment_v1' }>, input: DurableSamePaBattingExecutionInput) => SamePaPhysicalCommitmentSource }>;
type OwnedSwingPrefix = Readonly<{ posture: DurableBattingInvocationPosture; intent: DurableSamePaBattingIntent;
  launch: SamePaPhysicalLaunch; captureCut: SamePaPhysicalCut;
  beforeLaunch: Readonly<{ posture: DurableBattingInvocationPosture; intent: DurableSamePaBattingIntent; eventCount: number; worldRevision: number }> }>;
const provenance = (id: string) => ({ assessmentSourceId: id, assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'existing-explicit-Core-fixture', calibrationVersion: 'fixture-only-v1' });
/** Real Native segment. Each source is explicitly accepted; forecasts observe
 * an owned sample, and physical commitment alone calculates/adopts the input. */
export const prepareInFlightBattingSwing = (h: Fixture, prepared: ReturnType<Fixture['prepareAction']>, label: string,
  onBeforeLaunch?: (owned: Readonly<{ posture: DurableBattingInvocationPosture; postureReference: SamePaReference<'batting_observation_v1_postures'>;
    intent: DurableSamePaBattingIntent; intentReference: SamePaReference<'batting_execution_v1_intents'> }>) => void,
  options: SwingOptions = {}) => {
  const { f, save, accepted } = h, track = f.x.f.track;
  options.onStage?.('prepare-start');
  const member = () => h.current().basis.members.find(m => m.playerId === f.actor.binding.playerId)!;
  const perception = track(openSqliteBattingPerceptionStore(f.path, { readAcceptedPosture: id => accepted.get(id), readAcceptedObservation: id => accepted.get(id),
    readAcceptedDelivery: id => accepted.get(id), readAcceptedPrediction: id => accepted.get(id), readAcceptedAssessment: id => accepted.get(id) }));
  const inputOwner = track(openSqliteBattingExecutionInputStore(f.path, { readAcceptedIntent: id => accepted.get(id), readAcceptedInput: id => accepted.get(id) }));
  const ready = prepared.action.source.nominalPitch.delivery.readyAtUs;
  const holdReferences = h.original.occupiedRunnerHoldReferences;
  // This new pitch declares its own posture interval. A preceding TAKE's
  // posture cannot supply the runner's remaining issued coverage.
  const validUntilTick = holdReferences === undefined ? ready + 20_000_000 : withSqliteReadTransaction(f.db, () => Math.min(ready + 20_000_000,
    ...(holdReferences ?? []).map(pin => readSamePaOccupiedRunnerHoldFromSqlite(f.db, pin).source.coverageThroughTick)));
  // Plan only this fixture's temporal declaration from the same owned inputs
  // and existing Core timing used by launch. No pitch/observation is accepted here.
  const timing = withSqliteReadTransaction(f.db, () => {
    const action = prepared.action, basis = h.current(), nominal = action.source.nominalPitch, day = action.actor.binding.gameDay;
    if (json(basis.viewReference) !== json(action.source.viewReference)) throw new Error('fixture timing requires its current action view');
    const pitcher = action.physicalWorld.defenders.find(d => d.registeredPosition === 'P');
    const state = basis.view.participants.find(p => p.playerId === pitcher?.playerId);
    const calibration = basis.calibrationSet.calibrations.find(c => c.source.route === 'pitch_delivery' && c.source.member.playerId === pitcher?.playerId);
    if (!state || calibration?.source.route !== 'pitch_delivery'
      || json(calibration.source.response.policyReference) !== json(action.source.pitchResponseReference)) throw new Error('fixture timing lacks its owned pitcher response');
    const profile = selectPlayerPitchTimingProfileFromSqlitePrefix(f.db, action.source.timingReference, day);
    const history = readPlayerReleaseGeometryPrefixFromSqlite(f.db, action.source.releaseReference);
    const geometry = history.changes.filter(c => c.effectiveDay <= day).at(-1) ?? history.baseline;
    const { sourceId: _id, sourceVersion: _version, ...policy } = readPitchFatiguePolicyFromSqlite(f.db, action.source.pitchResponseReference);
    const effective = applyPitchFatigueToExecution(profile, nominal.delivery.physics, state.projectedState.fatigue, policy, day);
    return inFlightBattingFixtureTiming({ root: new SeedRoot(nominal.delivery.matchSeed), outingId: nominal.delivery.outingId,
      playId: action.lineage.playId, pitchIndex: action.pitchOrdinal - 1, readyAtUs: ready, timingProfile: effective.timingProfile,
      timingIntent: nominal.delivery.timingIntent, body: { ...geometry.body, moundReference: nominal.delivery.moundReference },
      releaseProfile: geometry.profile, physics: effective.physics }, validUntilTick);
  });
  options.onStage?.('timing-ready');
  const postureSource = save({ sourceId: label + ':posture', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_batting_posture_v1',
    viewReference: h.current().viewReference, member: member(), actionReference: prepared.actionReference, modelReference: h.original.batterModelReference,
    sceneBodyReferences: h.sceneBodyReferences, geometry: { ...h.geometry, startedAtTick: prepared.action.bodyCut.completedAtTick,
      attention: { target: { kind: 'ball' }, focusedSinceTick: prepared.action.bodyCut.completedAtTick }, ...timing.geometry },
    ...(holdReferences === undefined ? {} : { occupiedRunnerHoldReferences: holdReferences }),
    provenance: provenance(label + ':posture-assessment') });
  const posture = perception.acceptPosture(postureSource.sourceId); if (posture.kind !== 'batting_invocation_posture') throw new Error('real per-pitch posture pending: ' + JSON.stringify(posture));
  options.onStage?.('posture-ready');
  const postureReference = reference('batting_observation_v1_postures', posture);
  const intentSource = save({ sourceId: label + ':intent', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_same_pa_batting_intent_v1',
    viewReference: h.current().viewReference, member: member(), postureReference, actorReference: posture.lineage.actorReference, attempt: options.attempt ?? 'ordinary_swing' });
  const intent = inputOwner.acceptIntent(intentSource.sourceId); if (intent.kind !== 'same_pa_batting_intent') throw new Error('real original intent pending');
  options.onStage?.('intent-ready');
  const intentReference = reference('batting_execution_v1_intents', intent);
  onBeforeLaunch?.({ posture, postureReference, intent, intentReference });
  const beforeLaunch = { posture, intent, eventCount: h.events.length, worldRevision: h.worldOwner.readHead(f.actor.binding.careerId)!.worldRevision };
  const right = h.prepareRight(prepared, postureReference);
  options.onStage?.('launch-right-ready');
  const launch = h.launch(right), launchReference = reference('pa_physical_v1_launches', launch);
  options.onStage?.('launch-ready');
  if (json(launch.delivery) !== json(timing.delivery)) throw new Error('fixture planned delivery differs from the actual launch owner');
  const captureCutSource = save({ sourceId: label + ':capture-cut', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_cut_v1',
    viewReference: h.current().viewReference, launchReference, previousOperationReference: launchReference, throughTick: launch.evaluationTick + 50_000 });
  const captureCut = h.physical.acceptOperation(captureCutSource.sourceId); if (captureCut.kind !== 'same_pa_physical_cut_v1') throw new Error('real capture physical cut pending');
  options.onStage?.('capture-cut-ready');
  return continueInFlightBattingSwing(h, label, { beforeLaunch, posture, intent, launch, captureCut }, options, perception, inputOwner);
};

/** Shared existing suffix. All new records still pass through their actual owners. */
const continueInFlightBattingSwing = (h: NativeSpinNeutralPostObservationContextV193, label: string, prefix: OwnedSwingPrefix, options: SwingOptions,
  perception: ReturnType<typeof openSqliteBattingPerceptionStore>, inputOwner: ReturnType<typeof openSqliteBattingExecutionInputStore>) => {
  const { f, save } = h;
  const member = () => h.current().basis.members.find(m => m.playerId === f.actor.binding.playerId)!;
  const calibration = (route: SamePaDispatchRoute) => reference('pa_lifecycle_v1_execution_calibrations', h.current().calibrationSet.calibrations.find(c => c.source.route === route && c.source.member.playerId === member().playerId)!);
  const { beforeLaunch, posture, intent, launch, captureCut } = prefix;
  const postureReference = reference('batting_observation_v1_postures', posture);
  const launchReference = reference('pa_physical_v1_launches', launch);
  const captureCutReference = reference('pa_physical_v1_cuts', captureCut); h.advance(captureCutReference);
  const captureSource = save({ sourceId: label + ':capture', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_batting_observation_v1',
    viewReference: h.current().viewReference, member: member(), postureReference, physicalPitchReference: launchReference, physicalOperationReference: captureCutReference,
    calibrationReference: calibration('batter_observation'), observedTick: captureCut.evaluationTick, previousObservationReference: null });
  const wrongTime = save({ ...captureSource, sourceId: label + ':wrong-time-capture', observedTick: captureSource.observedTick + 1 });
  let wrongTimeRejected = false;
  try { perception.acceptObservation(wrongTime.sourceId); } catch { wrongTimeRejected = true; }
  const capture = perception.acceptObservation(captureSource.sourceId); if (capture.kind !== 'batting_observation') throw new Error('real capture pending: ' + JSON.stringify(capture));
  options.onStage?.('observation-ready');
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
  options.onStage?.('delivery-ready');
  return { ...completeInFlightBattingDelivery(h, label, { beforeLaunch, posture, intent, launch, captureCut, capture, deliveryCut, delivery }, options, perception, inputOwner),
    earlyDelivery, wrongTimeRejected, staleCutRejected };
};

type OwnedDeliveredSwingPrefix = OwnedSwingPrefix & Readonly<{
  capture: DurableBattingObservation; deliveryCut: SamePaPhysicalCut; delivery: DurableBattingObservationDelivery;
}>;

/** Retained V193 begins after its original observation was normally admitted
 * into cut4. It neither recaptures nor repeats unrelated early/stale negatives. */
export const continueNativeSpinNeutralV193PostObservation = (h: NativeSpinNeutralPostObservationContextV193, label: string,
  pins: Readonly<{ postureReference: SamePaReference<'batting_observation_v1_postures'>; intentReference: SamePaReference<'batting_execution_v1_intents'>;
    launchReference: SamePaReference<'pa_physical_v1_launches'>; captureCutReference: SamePaReference<'pa_physical_v1_cuts'>;
    observationReference: SamePaReference<'batting_observation_v1_observations'> }>, options: SwingOptions = {}) => {
  const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw Error('V193 post-observation original frontier differs'); };
  const prefix = withSqliteReadTransaction(h.f.db, () => withSamePaLifecycleReadPhase(h.f.db, () => {
    const physical = readCurrentSamePaInFlightCutFromSqlite(h.f.db, pins.captureCutReference);
    const captureCut = physical.record, launch = readSamePaPhysicalOperationFromSqlite(h.f.db, pins.launchReference).record;
    const capture = readBattingPerceptionFromSqlite(h.f.db, 'observation', pins.observationReference);
    const posture = readBattingPerceptionFromSqlite(h.f.db, 'posture', pins.postureReference);
    const intent = readSamePaBattingIntentFromSqlite(h.f.db, pins.intentReference);
    if (label !== 'native-spin-neutral-v193:pitch3' || captureCut.kind !== 'same_pa_physical_cut_v1' || captureCut.operationOrdinal !== 1
      || launch.kind !== 'same_pa_physical_launch_v1' || launch.operationOrdinal !== 0 || launch.stage !== 'in_flight'
      || capture.kind !== 'batting_observation' || capture.source.capability !== 'owned_in_flight_batting_observation_v1'
      || posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1'
      || intent.source.capability !== 'owned_in_flight_same_pa_batting_intent_v1') throw Error('V193 original in-flight batting owners differ');
    for (const [value, suffix] of [[launch, 'launch'], [captureCut, 'capture-cut'], [capture, 'capture'], [posture, 'posture'], [intent, 'intent']] as const)
      same(value.source.sourceId, label + ':' + suffix);
    const current = readCurrentSamePaLifecycleViewFromSqlite(h.f.db, h.current().viewReference);
    same(current.actor, h.f.actor); same(physical.actor, h.f.actor); same(physical.lineage.actorReference, reference('physical_plate_appearance_actors', h.f.actor));
    same(current.view, h.current().view); same(current.members, h.current().basis.members);
    same(current.view.source.sourceId, 'physical-fixture:cut4:view'); same(current.view.cut.operationReference, pins.observationReference);
    same(current.view.cut.physicalOperationReference, pins.captureCutReference); same(physical.physicalPitchReference, pins.launchReference);
    for (const value of [captureCut, capture, posture, intent]) same(value.lineage, launch.lineage);
    same(capture.source.physicalPitchReference, pins.launchReference); same(capture.source.physicalOperationReference, pins.captureCutReference);
    same(captureCut.source.launchReference, pins.launchReference); same(captureCut.source.previousOperationReference, pins.launchReference);
    same(capture.source.observedTick, captureCut.evaluationTick); same(capture.source.previousObservationReference, null);
    same(posture.source.actionReference, launch.source.actionReference); same(intent.source.postureReference, pins.postureReference);
    same(posture.source.viewReference, launch.source.viewReference); same(intent.source.viewReference, launch.source.viewReference);
    same(capture.source.viewReference.sourceId, 'physical-fixture:cut3:view');
    const prefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', current.view.source.prefixReference.sourceId);
    const before = readHistoricalSamePaLifecycleViewFromSqlite(h.f.db, launch.source.viewReference);
    const beforePrefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', before.view.source.prefixReference.sourceId);
    const world = readEmotionWorldRevisionFromSqlite(h.f.db, h.f.actor.binding.careerId);
    if (prefix?.kind !== 'same_pa_lifecycle_prefix' || beforePrefix?.kind !== 'same_pa_lifecycle_prefix' || !world) throw Error('V193 original lifecycle context missing');
    same(prefix.source.eventReferences, h.events); same(prefix.source.eventReferences.at(-1), pins.observationReference);
    same(prefix.source.eventReferences, [...beforePrefix.source.eventReferences, pins.launchReference, pins.captureCutReference, pins.observationReference]);
    return { posture, intent, launch, captureCut, capture, beforeLaunch: { posture, intent, eventCount: beforePrefix.source.eventReferences.length, worldRevision: world.head.worldRevision } };
  }));
  options.onStage?.('post-observation-current-authenticated');
  const { save, accepted } = h, track = h.f.x.f.track;
  const perception = track(openSqliteBattingPerceptionStore(h.f.path, { readAcceptedPosture: id => accepted.get(id), readAcceptedObservation: id => accepted.get(id),
    readAcceptedDelivery: id => accepted.get(id), readAcceptedPrediction: id => accepted.get(id), readAcceptedAssessment: id => accepted.get(id) }));
  const inputOwner = track(openSqliteBattingExecutionInputStore(h.f.path, { readAcceptedIntent: id => accepted.get(id), readAcceptedInput: id => accepted.get(id) }));
  const member = () => h.current().basis.members.find(m => m.playerId === h.f.actor.binding.playerId)!;
  const deliveryCutSource = save({ sourceId: label + ':delivery-cut', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_cut_v1',
    viewReference: h.current().viewReference, launchReference: pins.launchReference, previousOperationReference: pins.captureCutReference,
    throughTick: prefix.captureCut.evaluationTick + prefix.capture.calculation.effectiveValues.deliveryLatencyTicks });
  const deliveryCut = h.physical.acceptOperation(deliveryCutSource.sourceId); if (deliveryCut.kind !== 'same_pa_physical_cut_v1') throw Error('real delivery physical cut pending');
  options.onStage?.('delivery-cut-ready');
  const deliveryCutReference = reference('pa_physical_v1_cuts', deliveryCut); h.advance(deliveryCutReference);
  const deliverySource = save({ sourceId: label + ':delivery', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_batting_observation_delivery_v1',
    viewReference: h.current().viewReference, member: member(), observationReference: pins.observationReference, physicalPitchReference: pins.launchReference,
    physicalOperationReference: deliveryCutReference, calibrationReference: reference('pa_lifecycle_v1_execution_calibrations', h.current().calibrationSet.calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === member().playerId)!) });
  const delivery = perception.acceptDelivery(deliverySource.sourceId); if (delivery.kind !== 'batting_observation_delivery') throw Error('real delivery pending');
  options.onStage?.('delivery-ready');
  return completeInFlightBattingDelivery(h, label, { ...prefix, deliveryCut, delivery }, options, perception, inputOwner);
};
/** Original forecast/emotion/decision tail. An accepted delivery is the one
 * unadmitted event, so its lifecycle advance is always the first new write. */
const completeInFlightBattingDelivery = (h: NativeSpinNeutralPostObservationContextV193, label: string, prefix: OwnedDeliveredSwingPrefix, options: SwingOptions,
  perception: ReturnType<typeof openSqliteBattingPerceptionStore>, inputOwner: ReturnType<typeof openSqliteBattingExecutionInputStore>) => {
  const { f, save, accepted } = h, track = f.x.f.track;
  const proof = <T>(body: () => T) => withSqliteReadTransaction(f.db, body);
  const member = () => h.current().basis.members.find(m => m.playerId === f.actor.binding.playerId)!;
  const { beforeLaunch, posture, intent, launch, captureCut, capture, deliveryCut, delivery } = prefix;
  const postureReference = reference('batting_observation_v1_postures', posture), intentReference = reference('batting_execution_v1_intents', intent);
  const launchReference = reference('pa_physical_v1_launches', launch), deliveryCutReference = reference('pa_physical_v1_cuts', deliveryCut);
  const observationReference = reference('batting_observation_v1_observations', capture);
  const deliveryReference = reference('batting_observation_v1_deliveries', delivery); h.advance(deliveryReference);
  const parameter = posture.model.predictionCalibration;
  const forecastSource = save({ sourceId: label + ':forecast', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_batting_observed_prediction_v1',
    viewReference: h.current().viewReference, member: member(), observationReference, deliveryReference, modelReference: h.original.batterModelReference,
    predictionParameterReference: { sourceId: parameter.sourceId, sourceVersion: parameter.sourceVersion, sourceHash: hash(parameter) } });
  const forecast = perception.acceptPrediction(forecastSource.sourceId); if (forecast.kind !== 'batting_observed_prediction') throw new Error('real forecast pending');
  options.onStage?.('forecast-ready');
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
  const completed = completeInFlightBattingDecision(h, label, { posture, intent, launch, decisionCut, score, emotion }, options, inputOwner, expectedWorld);
  return { beforeLaunch, launch, launchReference, posture, postureReference, intent, intentReference, captureCut, capture, observationReference,
    deliveryCut, decisionCut, delivery, deliveryReference, forecast, score, emotion, ...completed,
    perception, inputOwner, emotionOwner };
};

/** The original input/commitment/resolution declarations, shared by fresh and
 * retained decision-cut fixtures. Callers must first admit the exact cut. */
type OwnedDecisionPrefix = Readonly<{
  posture: DurableBattingInvocationPosture; intent: DurableSamePaBattingIntent; launch: SamePaPhysicalLaunch;
  decisionCut: SamePaPhysicalCut; score: DurableBattingScoreAssessment; emotion: DurableBattingEmotionExecution;
}>;
const completeInFlightBattingDecision = (h: NativeSpinNeutralPostObservationContextV193, label: string, prefix: OwnedDecisionPrefix, options: SwingOptions, inputOwner: ReturnType<typeof openSqliteBattingExecutionInputStore>,
  expectedWorld: DurableBattingEmotionExecution['source']['expectedWorld']) => {
  const { f, save } = h, { posture, intent, launch, decisionCut, score, emotion } = prefix;
  const member = () => h.current().basis.members.find(m => m.playerId === f.actor.binding.playerId)!;
  const calibration = (route: SamePaDispatchRoute) => reference('pa_lifecycle_v1_execution_calibrations', h.current().calibrationSet.calibrations.find(c => c.source.route === route && c.source.member.playerId === member().playerId)!);
  const postureReference = reference('batting_observation_v1_postures', posture), intentReference = reference('batting_execution_v1_intents', intent);
  const launchReference = reference('pa_physical_v1_launches', launch), decisionCutReference = reference('pa_physical_v1_cuts', decisionCut);
  const emotionReference = reference('batting_emotion_execution_v1_executions', emotion);
  const inputSource = save({ sourceId: label + ':input', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_same_pa_batting_execution_input_v1',
    viewReference: h.current().viewReference, member: member(), postureReference, emotionReference, intentReference,
    physicalPitchReference: launchReference, physicalOperationReference: decisionCutReference, assessmentReferences: [reference('batting_score_v1_assessments', score)],
    calibrationReferences: (['batter_decision', 'batter_motor', 'batter_swing'] as const).map(route => ({ route, calibrationReference: calibration(route) })),
    directive: 'SWING', expectedWorld: { ...expectedWorld, worldRevision: emotion.acceptance.afterWorldRevision } });
  const input = inputOwner.acceptInput(inputSource.sourceId); if (input.kind !== 'same_pa_batting_input') throw new Error('real prepared input pending');
  options.onStage?.('execution-input-ready');
  return completeInFlightBattingInput(h, label, { ...prefix, input }, options);
};

/** The original remaining body starts immediately after accepted input. No
 * observation, emotion, input or cut9 work is repeated by this continuation. */
const completeInFlightBattingInput = (h: NativeSpinNeutralPostObservationContextV193, label: string, prefix: OwnedDecisionPrefix & Readonly<{
  input: DurableSamePaBattingExecutionInput;
}>, options: SwingOptions) => {
  const { f, save } = h, { intent, launch, decisionCut, input } = prefix;
  const intentReference = reference('batting_execution_v1_intents', intent);
  const launchReference = reference('pa_physical_v1_launches', launch), decisionCutReference = reference('pa_physical_v1_cuts', decisionCut);
  const inputReference = reference('batting_execution_v1_inputs', input);
  const preparedWorldRevision = h.worldOwner.readHead(f.actor.binding.careerId)!.worldRevision;
  const commitmentDeclaration: SamePaPhysicalCommitmentSource = { sourceId: label + ':commitment', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_commitment_v1',
    viewReference: h.current().viewReference, launchReference, previousOperationReference: decisionCutReference, inputReference, intentReference };
  const commitmentSource = save(options.prepareCommitment?.(commitmentDeclaration, input) ?? commitmentDeclaration);
  const commitment = h.physical.acceptOperation(commitmentSource.sourceId); if (commitment.kind !== 'same_pa_physical_commitment_v1') throw new Error('real effective commitment pending: ' + JSON.stringify(commitment));
  const commitmentReference = reference('pa_physical_v1_commitments', commitment); h.advance(commitmentReference);
  const resolutionSource = save({ sourceId: label + ':resolution', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_resolution_v1',
    viewReference: h.current().viewReference, launchReference, previousOperationReference: commitmentReference, commitmentReference, throughTick: launch.trajectory.endTick });
  const resolution = h.physical.acceptOperation(resolutionSource.sourceId); if (resolution.kind !== 'same_pa_physical_resolution_v1') throw new Error('real swing resolution pending');
  const resolutionReference = reference('pa_physical_v1_resolutions', resolution); h.advance(resolutionReference);
  return { input, inputReference, preparedWorldRevision, commitment, commitmentReference, resolution, resolutionReference };
};

/** Resume only the original first capture cut. References are locators; the
 * existing readers authenticate every value, the exact current physical head,
 * and the preceding historical lifecycle prefix before any new owner write. */
export const resumeInFlightBattingSwing = (h: NativeSpinNeutralPostObservationContextV193, label: string, pins: Readonly<{
  postureReference: SamePaReference<'batting_observation_v1_postures'>;
  intentReference: SamePaReference<'batting_execution_v1_intents'>;
  launchReference: SamePaReference<'pa_physical_v1_launches'>;
  captureCutReference: SamePaReference<'pa_physical_v1_cuts'>;
}>, options: SwingOptions = {}) => {
  const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('retained in-flight fixture original prefix differs'); };
  const prefix = withSqliteReadTransaction(h.f.db, () => withSamePaLifecycleReadPhase(h.f.db, (): OwnedSwingPrefix => {
    const cutProof = readCurrentSamePaInFlightCutFromSqlite(h.f.db, pins.captureCutReference);
    const captureCut = cutProof.record, launch = readSamePaPhysicalOperationFromSqlite(h.f.db, pins.launchReference).record;
    if (captureCut.kind !== 'same_pa_physical_cut_v1' || launch.kind !== 'same_pa_physical_launch_v1'
      || captureCut.stage !== 'in_flight' || captureCut.operationOrdinal !== 1 || launch.operationOrdinal !== 0
      || launch.source.sourceId !== label + ':launch' || captureCut.source.sourceId !== label + ':capture-cut'
      || captureCut.source.throughTick !== launch.evaluationTick + 50_000) throw new Error('retained in-flight fixture requires its original first capture cut');
    same(captureCut.source.launchReference, pins.launchReference); same(captureCut.source.previousOperationReference, pins.launchReference);
    same(cutProof.actor, h.f.actor); same(captureCut.lineage, launch.lineage);
    const historical = readHistoricalSamePaLifecycleViewFromSqlite(h.f.db, captureCut.source.viewReference);
    same(h.current().viewReference, captureCut.source.viewReference); same(h.current().view, historical.view);
    same(h.current().basis.members, historical.members); same(historical.view.cut.physicalOperationReference, pins.launchReference);
    const oldPrefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', historical.view.source.prefixReference.sourceId);
    if (!oldPrefix || oldPrefix.kind !== 'same_pa_lifecycle_prefix') throw new Error('retained in-flight fixture historical prefix missing');
    same(reference('pa_lifecycle_v1_work_prefixes', oldPrefix), historical.view.source.prefixReference);
    same(h.events, oldPrefix.source.eventReferences);
    const posture = readBattingPerceptionFromSqlite(h.f.db, 'posture', pins.postureReference);
    const intent = readSamePaBattingIntentFromSqlite(h.f.db, pins.intentReference);
    if (posture.kind !== 'batting_invocation_posture') throw new Error('retained in-flight fixture original posture missing');
    same(posture.source.actionReference, launch.source.actionReference); same(intent.source.postureReference, pins.postureReference);
    same(posture.source.viewReference, launch.source.viewReference); same(intent.source.viewReference, launch.source.viewReference);
    same(posture.lineage, launch.lineage); same(intent.lineage, launch.lineage);
    if (options.attempt !== undefined) same(options.attempt, intent.originalIntent.attempt);
    const before = readHistoricalSamePaLifecycleViewFromSqlite(h.f.db, launch.source.viewReference);
    const beforePrefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', before.view.source.prefixReference.sourceId);
    const world = readEmotionWorldRevisionFromSqlite(h.f.db, h.f.actor.binding.careerId);
    if (!beforePrefix || beforePrefix.kind !== 'same_pa_lifecycle_prefix' || !world) throw new Error('retained in-flight fixture original context missing');
    same(reference('pa_lifecycle_v1_work_prefixes', beforePrefix), before.view.source.prefixReference);
    same(oldPrefix.source.eventReferences, [...beforePrefix.source.eventReferences, pins.launchReference]);
    return { posture, intent, launch, captureCut, beforeLaunch: { posture, intent, eventCount: beforePrefix.source.eventReferences.length,
      worldRevision: world.head.worldRevision } };
  }));
  const track = h.f.x.f.track, accepted = h.accepted;
  const perception = track(openSqliteBattingPerceptionStore(h.f.path, { readAcceptedPosture: id => accepted.get(id), readAcceptedObservation: id => accepted.get(id),
    readAcceptedDelivery: id => accepted.get(id), readAcceptedPrediction: id => accepted.get(id), readAcceptedAssessment: id => accepted.get(id) }));
  const inputOwner = track(openSqliteBattingExecutionInputStore(h.f.path, { readAcceptedIntent: id => accepted.get(id), readAcceptedInput: id => accepted.get(id) }));
  return continueInFlightBattingSwing(h, label, prefix, options, perception, inputOwner);
};


type RetainedDeliveryPins = Readonly<{
  postureReference: SamePaReference<'batting_observation_v1_postures'>;
  intentReference: SamePaReference<'batting_execution_v1_intents'>;
  launchReference: SamePaReference<'pa_physical_v1_launches'>;
  captureCutReference: SamePaReference<'pa_physical_v1_cuts'>;
  observationReference: SamePaReference<'batting_observation_v1_observations'>;
  deliveryCutReference: SamePaReference<'pa_physical_v1_cuts'>;
  deliveryReference: SamePaReference<'batting_observation_v1_deliveries'>;
}>;
/** Exact LAN cp27 only. Invoke inside the entry's query-only lifecycle read
 * phase so restoration shares its immutable graph proof. The complete cut5 is
 * historical; current work additionally contains its one unadmitted delivery. */
export const readRetainedInFlightBattingDelivery = (h: Fixture, label: string, pins: RetainedDeliveryPins): OwnedDeliveredSwingPrefix => {
  const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('retained LAN delivery original prefix differs'); };
  if (label !== 'lan01:swing') throw new Error('retained delivery fixture requires the original LAN swing');
  const cutProof = readCurrentSamePaInFlightCutFromSqlite(h.f.db, pins.deliveryCutReference), deliveryCut = cutProof.record;
  const launch = readSamePaPhysicalOperationFromSqlite(h.f.db, pins.launchReference).record;
  const captureCut = readSamePaPhysicalOperationFromSqlite(h.f.db, pins.captureCutReference).record;
  if (launch.kind !== 'same_pa_physical_launch_v1' || captureCut.kind !== 'same_pa_physical_cut_v1' || deliveryCut.kind !== 'same_pa_physical_cut_v1'
    || launch.stage !== 'in_flight' || captureCut.stage !== 'in_flight' || deliveryCut.stage !== 'in_flight'
    || launch.operationOrdinal !== 0 || captureCut.operationOrdinal !== 1 || deliveryCut.operationOrdinal !== 2
    || launch.source.sourceId !== label + ':launch' || captureCut.source.sourceId !== label + ':capture-cut'
    || deliveryCut.source.sourceId !== label + ':delivery-cut' || captureCut.source.throughTick !== launch.evaluationTick + 50_000)
    throw new Error('retained LAN delivery requires the original physical chain');
  same(cutProof.actor, h.f.actor); same(captureCut.source.launchReference, pins.launchReference);
  same(captureCut.source.previousOperationReference, pins.launchReference); same(deliveryCut.source.launchReference, pins.launchReference);
  same(deliveryCut.source.previousOperationReference, pins.captureCutReference);
  const posture = readBattingPerceptionFromSqlite(h.f.db, 'posture', pins.postureReference);
  const intent = readSamePaBattingIntentFromSqlite(h.f.db, pins.intentReference);
  const capture = readBattingPerceptionFromSqlite(h.f.db, 'observation', pins.observationReference);
  const delivery = readBattingPerceptionFromSqlite(h.f.db, 'delivery', pins.deliveryReference);
  if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1'
    || capture.kind !== 'batting_observation' || capture.source.capability !== 'owned_in_flight_batting_observation_v1'
    || delivery.kind !== 'batting_observation_delivery' || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1'
    || posture.source.sourceId !== label + ':posture' || intent.source.sourceId !== label + ':intent'
    || capture.source.sourceId !== label + ':capture' || delivery.source.sourceId !== label + ':delivery')
    throw new Error('retained LAN delivery original batting receipts missing');
  for (const value of [posture, intent, captureCut, capture, deliveryCut, delivery]) same(value.lineage, launch.lineage);
  same(posture.source.actionReference, launch.source.actionReference); same(posture.source.viewReference, launch.source.viewReference);
  same(intent.source.postureReference, pins.postureReference); same(intent.source.viewReference, launch.source.viewReference);
  same(capture.source.postureReference, pins.postureReference); same(capture.source.physicalPitchReference, pins.launchReference);
  same(capture.source.physicalOperationReference, pins.captureCutReference); same(capture.source.previousObservationReference, null);
  same(capture.source.observedTick, captureCut.evaluationTick); same(delivery.source.observationReference, pins.observationReference);
  same(delivery.source.physicalPitchReference, pins.launchReference); same(delivery.source.physicalOperationReference, pins.deliveryCutReference);
  same(deliveryCut.source.throughTick, captureCut.evaluationTick + capture.calculation.effectiveValues.deliveryLatencyTicks);
  const current = h.current(), historical = readHistoricalSamePaLifecycleViewFromSqlite(h.f.db, current.viewReference);
  if (current.viewReference.sourceId !== 'lan01:occupied:cut5:view'
    || historical.view.source.prefixReference.sourceId !== 'lan01:occupied:cut5:prefix') throw new Error('retained LAN delivery requires complete cut5');
  same(current.view, historical.view); same(current.basis.members, historical.members); same(historical.actor, h.f.actor);
  same(delivery.source.viewReference, current.viewReference); same(historical.view.cut.physicalOperationReference, pins.deliveryCutReference);
  const prefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', historical.view.source.prefixReference.sourceId);
  const before = readHistoricalSamePaLifecycleViewFromSqlite(h.f.db, launch.source.viewReference);
  const beforePrefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', before.view.source.prefixReference.sourceId);
  const world = readEmotionWorldRevisionFromSqlite(h.f.db, h.f.actor.binding.careerId);
  if (prefix?.kind !== 'same_pa_lifecycle_prefix' || beforePrefix?.kind !== 'same_pa_lifecycle_prefix' || !world
    || before.view.source.sourceId !== 'lan01:occupied:cut0:view'
    || beforePrefix.source.sourceId !== 'lan01:occupied:cut0:prefix') throw new Error('retained LAN delivery original lifecycle context missing');
  same(reference('pa_lifecycle_v1_work_prefixes', prefix), historical.view.source.prefixReference);
  same(reference('pa_lifecycle_v1_work_prefixes', beforePrefix), before.view.source.prefixReference);
  same(beforePrefix.source.eventReferences, [reference('pa_take_successor_v1_pitch_actions', h.second)]);
  same(prefix.source.eventReferences, [...beforePrefix.source.eventReferences, pins.launchReference, pins.captureCutReference,
    pins.observationReference, pins.deliveryCutReference]);
  same(prefix.source.anchorViewReference, h.anchor.viewReference); same(h.events, prefix.source.eventReferences);
  // Reuse the actual owner's AFTER fence: current reserved state plus exact
  // work extent including this accepted delivery, excluding every later append.
  assertInFlightBattingWriteCurrentFromSqlite(h.f.db, current.viewReference, pins.deliveryReference);
  return { posture, intent, launch, captureCut, capture, deliveryCut, delivery,
    beforeLaunch: { posture, intent, eventCount: beforePrefix.source.eventReferences.length, worldRevision: world.head.worldRevision } };
};

/** The retained entry calls this immediately after closing its restoration read
 * scope. Fresh lifecycle and batting owners still recheck every ensuing write. */
export const continueRetainedInFlightBattingDelivery = (h: Fixture, label: string, retained: OwnedDeliveredSwingPrefix, options: SwingOptions = {}) => {
  if (label !== 'lan01:swing' || retained.delivery.source.sourceId !== label + ':delivery'
    || options.attempt !== undefined && options.attempt !== retained.intent.originalIntent.attempt)
    throw new Error('retained LAN delivery original invocation differs');
  const track = h.f.x.f.track, accepted = h.accepted;
  const perception = track(openSqliteBattingPerceptionStore(h.f.path, { readAcceptedPosture: id => accepted.get(id), readAcceptedObservation: id => accepted.get(id),
    readAcceptedDelivery: id => accepted.get(id), readAcceptedPrediction: id => accepted.get(id), readAcceptedAssessment: id => accepted.get(id) }));
  const inputOwner = track(openSqliteBattingExecutionInputStore(h.f.path, { readAcceptedIntent: id => accepted.get(id), readAcceptedInput: id => accepted.get(id) }));
  return completeInFlightBattingDelivery(h, label, retained, options, perception, inputOwner);
};

/** Convenience composition with no reusable authentication token or stage selector. */
export const resumeInFlightBattingDelivery = (h: Fixture, label: string, pins: RetainedDeliveryPins, options: SwingOptions = {}) => {
  const retained = withSqliteReadTransaction(h.f.db, () => withSamePaLifecycleReadPhase(h.f.db, () => readRetainedInFlightBattingDelivery(h, label, pins)));
  return continueRetainedInFlightBattingDelivery(h, label, retained, options);
};


type RetainedDecisionPins = RetainedDeliveryPins & Readonly<{
  predictionReference: SamePaReference<'batting_prediction_v1_predictions'>;
  scoreReference: SamePaReference<'batting_score_v1_assessments'>;
  emotionReference: SamePaReference<'batting_emotion_execution_v1_executions'>;
  decisionCutReference: SamePaReference<'pa_physical_v1_cuts'>;
  decisionPrefixReference: SamePaReference<'pa_lifecycle_v1_work_prefixes'>;
}>;
/** Read-only cut9 needs no accepted calibration set or future owner closures. */
export type RetainedInFlightBattingDecisionContext = Readonly<{
  f: Pick<Fixture['f'], 'db' | 'actor'>;
  current: () => Pick<ReturnType<Fixture['current']>, 'view' | 'viewReference' | 'basis'>;
  events: readonly Fixture['events'][number][];
  second: Fixture['second']; anchor: Pick<Fixture['anchor'], 'viewReference'>;
}>;

/** Shared read extraction only. Each caller separately chooses the appropriate
 * authenticated lifecycle basis inside its one existing query-only phase. */
const readRetainedInFlightBattingDecisionCut = (h: Pick<RetainedInFlightBattingDecisionContext, 'f' | 'current' | 'events'>, label: string, pins: RetainedDecisionPins, options: SwingOptions,
  readAuthenticatedCurrent: () => ReturnType<typeof readHistoricalSamePaLifecycleViewFromSqlite>) => {
  const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('retained decision-cut original prefix differs'); };
  const proof = readCurrentSamePaInFlightCutFromSqlite(h.f.db, pins.decisionCutReference), decisionCut = proof.record;
  const operation = (ref: SamePaReference<'pa_physical_v1_cuts' | 'pa_physical_v1_launches'>) => readSamePaPhysicalOperationFromSqlite(h.f.db, ref).record;
  const launch = operation(pins.launchReference), captureCut = operation(pins.captureCutReference), deliveryCut = operation(pins.deliveryCutReference);
  if (launch.kind !== 'same_pa_physical_launch_v1' || captureCut.kind !== 'same_pa_physical_cut_v1'
    || deliveryCut.kind !== 'same_pa_physical_cut_v1' || decisionCut.kind !== 'same_pa_physical_cut_v1'
    || launch.operationOrdinal !== 0 || captureCut.operationOrdinal !== 1 || deliveryCut.operationOrdinal !== 2 || decisionCut.operationOrdinal !== 3
    || launch.source.sourceId !== label + ':launch' || captureCut.source.sourceId !== label + ':capture-cut'
    || deliveryCut.source.sourceId !== label + ':delivery-cut' || decisionCut.source.sourceId !== label + ':decision-cut')
    throw new Error('retained decision-cut requires the original physical chain');
  same(captureCut.source.previousOperationReference, pins.launchReference); same(deliveryCut.source.previousOperationReference, pins.captureCutReference);
  same(decisionCut.source.previousOperationReference, pins.deliveryCutReference); same(proof.actor, h.f.actor);
  const current = h.current(), prefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', pins.decisionPrefixReference.sourceId);
  if (prefix?.kind !== 'same_pa_lifecycle_prefix') throw new Error('retained decision-cut admission missing');
  same(reference('pa_lifecycle_v1_work_prefixes', prefix), pins.decisionPrefixReference);
  const authenticatedCurrent = readAuthenticatedCurrent();
  same(current.view, authenticatedCurrent.view); same(current.basis.members, authenticatedCurrent.members);
  same(current.view.source.prefixReference, pins.decisionPrefixReference); same(current.view.cut.physicalOperationReference, pins.decisionCutReference);
  same(h.events, prefix.source.eventReferences); same(h.events.at(-1), pins.decisionCutReference);
  const posture = readBattingPerceptionFromSqlite(h.f.db, 'posture', pins.postureReference);
  const capture = readBattingPerceptionFromSqlite(h.f.db, 'observation', pins.observationReference);
  const delivery = readBattingPerceptionFromSqlite(h.f.db, 'delivery', pins.deliveryReference);
  const forecast = readBattingPerceptionFromSqlite(h.f.db, 'prediction', pins.predictionReference);
  const score = readBattingPerceptionFromSqlite(h.f.db, 'assessment', pins.scoreReference);
  const intent = readSamePaBattingIntentFromSqlite(h.f.db, pins.intentReference), emotion = readBattingEmotionExecutionFromSqlite(h.f.db, pins.emotionReference);
  if (posture.kind !== 'batting_invocation_posture' || capture.kind !== 'batting_observation' || delivery.kind !== 'batting_observation_delivery'
    || forecast.kind !== 'batting_observed_prediction' || score.kind !== 'batting_score_assessment') throw new Error('retained decision-cut original batting receipts missing');
  for (const value of [posture, capture, delivery, forecast, score, intent, emotion, captureCut, deliveryCut, decisionCut]) same(value.lineage, launch.lineage);
  same(posture.source.actionReference, launch.source.actionReference); same(intent.source.postureReference, pins.postureReference);
  same(capture.source.postureReference, pins.postureReference); same(delivery.source.observationReference, pins.observationReference);
  same(forecast.source.observationReference, pins.observationReference); same(forecast.source.deliveryReference, pins.deliveryReference);
  same(score.source.predictionReference, pins.predictionReference); same(emotion.source.observationReference, pins.observationReference);
  same(emotion.source.deliveryReference, pins.deliveryReference); same(decisionCut.source.throughTick, emotion.acceptance.proposal.inputs.swingDecision.tick);
  if (options.attempt !== undefined) same(options.attempt, intent.originalIntent.attempt);
  const before = readHistoricalSamePaLifecycleViewFromSqlite(h.f.db, launch.source.viewReference);
  const beforePrefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', before.view.source.prefixReference.sourceId);
  if (beforePrefix?.kind !== 'same_pa_lifecycle_prefix') throw new Error('retained decision-cut prelaunch prefix missing');
  same(reference('pa_lifecycle_v1_work_prefixes', beforePrefix), before.view.source.prefixReference);
  same(prefix.source.eventReferences, [...beforePrefix.source.eventReferences, pins.launchReference, pins.captureCutReference,
    pins.observationReference, pins.deliveryCutReference, pins.deliveryReference, pins.predictionReference, pins.emotionReference, pins.decisionCutReference]);
  return { posture, intent, launch, captureCut, capture, deliveryCut, delivery, forecast, score, emotion, decisionCut,
    beforeLaunch: { posture, intent, eventCount: beforePrefix.source.eventReferences.length, worldRevision: emotion.source.expectedWorld.worldRevision } };
};

/** The original decision-cut is already physical and admitted. Its interrupted
 * TOTAL/view must be retried by the fixture before this suffix can write input.
 * Earlier transient rejection flags are deliberately not reconstructed. */
export const resumeInFlightBattingDecisionCut = (h: Fixture, label: string, pins: RetainedDecisionPins, options: SwingOptions = {}) => {
  const retained = withSqliteReadTransaction(h.f.db, () => withSamePaLifecycleReadPhase(h.f.db, () =>
    readRetainedInFlightBattingDecisionCut(h, label, pins, options, () => readCurrentSamePaLifecycleViewFromSqlite(h.f.db, h.current().viewReference))));
  const { f, accepted } = h, track = f.x.f.track;
  const perception = track(openSqliteBattingPerceptionStore(f.path));
  const inputOwner = track(openSqliteBattingExecutionInputStore(f.path, { readAcceptedInput: id => accepted.get(id) }));
  const emotionOwner = track(openSqliteBattingEmotionExecutionStore(f.path));
  const completed = completeInFlightBattingDecision(h, label, retained, options, inputOwner, retained.emotion.source.expectedWorld);
  return { ...retained, ...completed, postureReference: pins.postureReference, intentReference: pins.intentReference, launchReference: pins.launchReference,
    observationReference: pins.observationReference, deliveryReference: pins.deliveryReference, perception, inputOwner, emotionOwner };
};

type RetainedDecisionViewPins = RetainedDecisionPins & Readonly<{
  cut9ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
}>;
type OwnedDecisionSwingPrefix = ReturnType<typeof readRetainedInFlightBattingDecisionCut>;
/** Exact LAN R6 cp19 only, before any cut9 calibration or input. The caller's
 * existing query-only phase owns the proof; this read creates no transaction,
 * current-view substitute, calibration set, or acceptance of earlier work. */
export const readRetainedInFlightBattingDecisionView = (h: RetainedInFlightBattingDecisionContext, label: string,
  pins: RetainedDecisionViewPins): OwnedDecisionSwingPrefix => {
  const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('retained LAN decision view original prefix differs'); };
  if (label !== 'lan01:swing' || pins.cut9ViewReference.sourceId !== 'lan01:occupied:cut9:view'
    || pins.decisionPrefixReference.sourceId !== 'lan01:occupied:cut9:prefix') throw new Error('retained decision view requires the original LAN cut9');
  const current = h.current(), historical = readHistoricalSamePaLifecycleViewFromSqlite(h.f.db, pins.cut9ViewReference);
  same(current.viewReference, pins.cut9ViewReference); same(historical.actor, h.f.actor);
  const retained = readRetainedInFlightBattingDecisionCut(h, label, pins, {}, () => historical);
  const { posture, intent, launch, captureCut, capture, deliveryCut, delivery, forecast, score, emotion, decisionCut } = retained;
  if (posture.source.capability !== 'owned_in_flight_batting_posture_v1'
    || intent.kind !== 'same_pa_batting_intent' || intent.source.capability !== 'owned_in_flight_same_pa_batting_intent_v1'
    || capture.source.capability !== 'owned_in_flight_batting_observation_v1'
    || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1'
    || forecast.source.capability !== 'owned_in_flight_batting_observed_prediction_v1'
    || score.source.capability !== 'owned_in_flight_batting_score_assessment_v1'
    || emotion.kind !== 'batting_emotion_execution' || emotion.source.capability !== 'owned_in_flight_batting_emotion_execution_v1'
    || launch.stage !== 'in_flight' || captureCut.stage !== 'in_flight' || deliveryCut.stage !== 'in_flight' || decisionCut.stage !== 'in_flight')
    throw new Error('retained LAN decision view original batting receipts missing');
  for (const [value, suffix] of [[posture, 'posture'], [intent, 'intent'], [capture, 'capture'], [delivery, 'delivery'],
    [forecast, 'forecast'], [score, 'score'], [emotion, 'emotion']] as const) same(value.source.sourceId, label + ':' + suffix);
  same(posture.source.viewReference, launch.source.viewReference); same(intent.source.viewReference, launch.source.viewReference);
  for (const cut of [captureCut, deliveryCut, decisionCut]) same(cut.source.launchReference, pins.launchReference);
  same(captureCut.source.throughTick, launch.evaluationTick + 50_000);
  same(capture.source.physicalPitchReference, pins.launchReference); same(capture.source.physicalOperationReference, pins.captureCutReference);
  same(capture.source.previousObservationReference, null); same(capture.source.observedTick, captureCut.evaluationTick);
  same(deliveryCut.source.throughTick, captureCut.evaluationTick + capture.calculation.effectiveValues.deliveryLatencyTicks);
  same(delivery.source.physicalPitchReference, pins.launchReference); same(delivery.source.physicalOperationReference, pins.deliveryCutReference);
  same(emotion.source.physicalPitchReference, pins.launchReference); same(emotion.source.physicalOperationReference, pins.deliveryCutReference);
  same(delivery.source.viewReference.sourceId, 'lan01:occupied:cut5:view'); same(forecast.source.viewReference.sourceId, 'lan01:occupied:cut6:view');
  same(score.source.viewReference.sourceId, 'lan01:occupied:cut7:view'); same(emotion.source.viewReference.sourceId, 'lan01:occupied:cut7:view');
  same(decisionCut.source.viewReference.sourceId, 'lan01:occupied:cut8:view');
  const before = readHistoricalSamePaLifecycleViewFromSqlite(h.f.db, launch.source.viewReference);
  const beforePrefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', before.view.source.prefixReference.sourceId);
  const prefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', pins.decisionPrefixReference.sourceId);
  if (beforePrefix?.kind !== 'same_pa_lifecycle_prefix' || prefix?.kind !== 'same_pa_lifecycle_prefix') throw new Error('retained LAN decision view original prefix missing');
  same(before.actor, h.f.actor); same(before.view.source.sourceId, 'lan01:occupied:cut0:view'); same(beforePrefix.source.sourceId, 'lan01:occupied:cut0:prefix');
  same(beforePrefix.source.eventReferences, [reference('pa_take_successor_v1_pitch_actions', h.second)]);
  same(beforePrefix.source.anchorViewReference, h.anchor.viewReference); same(prefix.source.anchorViewReference, h.anchor.viewReference);
  const world = readEmotionWorldRevisionFromSqlite(h.f.db, h.f.actor.binding.careerId);
  if (!world) throw new Error('retained LAN decision view current World missing');
  same({ ...emotion.source.expectedWorld, worldRevision: emotion.acceptance.afterWorldRevision },
    { careerId: h.f.actor.binding.careerId, worldRevision: world.head.worldRevision,
      controlRevision: world.head.control.revision, controlHash: hash(world.head.control) });
  assertInFlightBattingWriteCurrentFromSqlite(h.f.db, pins.cut9ViewReference, null);
  return retained;
};

/** Called after the retained entry accepts its prospective cut9 calibrations.
 * Original owners guard new mutations; restoration is not read again. */
export const continueRetainedInFlightBattingDecision = (h: Fixture, label: string, retained: OwnedDecisionSwingPrefix, options: SwingOptions = {}) => {
  if (label !== 'lan01:swing' || retained.decisionCut.source.sourceId !== label + ':decision-cut'
    || options.attempt !== undefined && options.attempt !== retained.intent.originalIntent.attempt)
    throw new Error('retained LAN decision view original invocation differs');
  const { f, accepted } = h, track = f.x.f.track;
  const perception = track(openSqliteBattingPerceptionStore(f.path));
  const inputOwner = track(openSqliteBattingExecutionInputStore(f.path, { readAcceptedInput: id => accepted.get(id) }));
  const emotionOwner = track(openSqliteBattingEmotionExecutionStore(f.path));
  const completed = completeInFlightBattingDecision(h, label, retained, options, inputOwner, retained.emotion.source.expectedWorld);
  return { ...retained, ...completed, postureReference: reference('batting_observation_v1_postures', retained.posture),
    intentReference: reference('batting_execution_v1_intents', retained.intent), launchReference: reference('pa_physical_v1_launches', retained.launch),
    observationReference: reference('batting_observation_v1_observations', retained.capture),
    deliveryReference: reference('batting_observation_v1_deliveries', retained.delivery), perception, inputOwner, emotionOwner };
};


type RetainedInputPins = RetainedDecisionPins & Readonly<{
  cut9ViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  inputReference: SamePaReference<'batting_execution_v1_inputs'>;
}>;
type OwnedInputSwingPrefix = ReturnType<typeof readRetainedInFlightBattingDecisionCut> & Readonly<{
  input: DurableSamePaBattingExecutionInput;
}>;
/** Exact LAN R6 cp21 only, inside the retained entry's existing query-only
 * lifecycle phase. Historical owners prove the completed graph; the physical
 * head, unchanged World and AFTER fence independently prove its live extent. */
export const readRetainedInFlightBattingInput = (h: Fixture, label: string, pins: RetainedInputPins): OwnedInputSwingPrefix => {
  const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('retained LAN input original prefix differs'); };
  if (label !== 'lan01:swing' || pins.cut9ViewReference.sourceId !== 'lan01:occupied:cut9:view'
    || pins.decisionPrefixReference.sourceId !== 'lan01:occupied:cut9:prefix') throw new Error('retained input fixture requires the original LAN cut9');
  const current = h.current(), historical = readHistoricalSamePaLifecycleViewFromSqlite(h.f.db, pins.cut9ViewReference);
  same(current.viewReference, pins.cut9ViewReference); same(historical.actor, h.f.actor);
  const retained = readRetainedInFlightBattingDecisionCut(h, label, pins, {}, () => historical);
  const { posture, intent, launch, captureCut, capture, deliveryCut, delivery, forecast, score, emotion, decisionCut } = retained;
  const input = readSamePaBattingExecutionInputFromSqlite(h.f.db, pins.inputReference);
  if (posture.source.capability !== 'owned_in_flight_batting_posture_v1'
    || intent.source.capability !== 'owned_in_flight_same_pa_batting_intent_v1'
    || capture.source.capability !== 'owned_in_flight_batting_observation_v1'
    || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1'
    || forecast.source.capability !== 'owned_in_flight_batting_observed_prediction_v1'
    || score.source.capability !== 'owned_in_flight_batting_score_assessment_v1'
    || emotion.source.capability !== 'owned_in_flight_batting_emotion_execution_v1'
    || input.kind !== 'same_pa_batting_input' || input.source.capability !== 'owned_in_flight_same_pa_batting_execution_input_v1'
    || launch.stage !== 'in_flight' || captureCut.stage !== 'in_flight' || deliveryCut.stage !== 'in_flight' || decisionCut.stage !== 'in_flight')
    throw new Error('retained LAN input original batting receipts missing');
  for (const [value, suffix] of [[posture, 'posture'], [intent, 'intent'], [capture, 'capture'], [delivery, 'delivery'],
    [forecast, 'forecast'], [score, 'score'], [emotion, 'emotion'], [input, 'input']] as const) same(value.source.sourceId, label + ':' + suffix);
  same(input.lineage, launch.lineage); same(input.physicalPitchReference, pins.launchReference);
  same(posture.source.viewReference, launch.source.viewReference); same(intent.source.viewReference, launch.source.viewReference);
  for (const cut of [captureCut, deliveryCut, decisionCut]) same(cut.source.launchReference, pins.launchReference);
  same(captureCut.source.throughTick, launch.evaluationTick + 50_000);
  same(capture.source.physicalPitchReference, pins.launchReference); same(capture.source.physicalOperationReference, pins.captureCutReference);
  same(capture.source.previousObservationReference, null); same(capture.source.observedTick, captureCut.evaluationTick);
  same(deliveryCut.source.throughTick, captureCut.evaluationTick + capture.calculation.effectiveValues.deliveryLatencyTicks);
  same(delivery.source.physicalPitchReference, pins.launchReference); same(delivery.source.physicalOperationReference, pins.deliveryCutReference);
  same(emotion.source.physicalPitchReference, pins.launchReference); same(emotion.source.physicalOperationReference, pins.deliveryCutReference);
  same(delivery.source.viewReference.sourceId, 'lan01:occupied:cut5:view'); same(forecast.source.viewReference.sourceId, 'lan01:occupied:cut6:view');
  same(score.source.viewReference.sourceId, 'lan01:occupied:cut7:view'); same(emotion.source.viewReference.sourceId, 'lan01:occupied:cut7:view');
  same(decisionCut.source.viewReference.sourceId, 'lan01:occupied:cut8:view');
  same(input.source.viewReference, pins.cut9ViewReference); same(input.source.postureReference, pins.postureReference);
  same(input.source.intentReference, pins.intentReference); same(input.source.emotionReference, pins.emotionReference);
  same(input.source.physicalPitchReference, pins.launchReference); same(input.source.physicalOperationReference, pins.decisionCutReference);
  same(input.source.assessmentReferences, [pins.scoreReference]); same(input.source.directive, 'SWING');
  const member = current.basis.members.find(m => m.playerId === h.f.actor.binding.playerId);
  if (!member) throw new Error('retained LAN input original batter missing');
  same(input.source.member, member);
  same(input.source.calibrationReferences, (['batter_decision', 'batter_motor', 'batter_swing'] as const).map(route => {
    const calibration = current.calibrationSet.calibrations.find(c => c.source.route === route && c.source.member.playerId === member.playerId);
    if (!calibration) throw new Error('retained LAN input cut9 calibration missing');
    return { route, calibrationReference: reference('pa_lifecycle_v1_execution_calibrations', calibration) };
  }));
  same(input.source.expectedWorld, { ...emotion.source.expectedWorld, worldRevision: emotion.acceptance.afterWorldRevision });
  const before = readHistoricalSamePaLifecycleViewFromSqlite(h.f.db, launch.source.viewReference);
  const beforePrefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', before.view.source.prefixReference.sourceId);
  const prefix = readSamePaLifecycleRecordFromSqlite(h.f.db, 'prefix', pins.decisionPrefixReference.sourceId);
  if (beforePrefix?.kind !== 'same_pa_lifecycle_prefix' || prefix?.kind !== 'same_pa_lifecycle_prefix') throw new Error('retained LAN input original prefix missing');
  same(before.view.source.sourceId, 'lan01:occupied:cut0:view'); same(beforePrefix.source.sourceId, 'lan01:occupied:cut0:prefix');
  same(beforePrefix.source.eventReferences, [reference('pa_take_successor_v1_pitch_actions', h.second)]);
  same(prefix.source.anchorViewReference, h.anchor.viewReference);
  const world = readEmotionWorldRevisionFromSqlite(h.f.db, h.f.actor.binding.careerId);
  if (!world) throw new Error('retained LAN input current World missing');
  same(input.source.expectedWorld, { careerId: h.f.actor.binding.careerId, worldRevision: world.head.worldRevision,
    controlRevision: world.head.control.revision, controlHash: hash(world.head.control) });
  // Accepted input is not a lifecycle event. The actual input owner's AFTER
  // fence therefore proves exactly the nine admitted events with a null append.
  assertInFlightBattingWriteCurrentFromSqlite(h.f.db, pins.cut9ViewReference, null);
  return { ...retained, input };
};

/** Resume the unchanged body immediately after input acceptance, outside the
 * restoration read scope. Physical owners recheck each new write normally. */
export const continueRetainedInFlightBattingInput = (h: Fixture, label: string, retained: OwnedInputSwingPrefix, options: SwingOptions = {}) => {
  if (label !== 'lan01:swing' || retained.input.source.sourceId !== label + ':input'
    || options.attempt !== undefined && options.attempt !== retained.intent.originalIntent.attempt)
    throw new Error('retained LAN input original invocation differs');
  const completed = completeInFlightBattingInput(h, label, retained, options);
  return { ...retained, ...completed, postureReference: reference('batting_observation_v1_postures', retained.posture),
    intentReference: reference('batting_execution_v1_intents', retained.intent), launchReference: reference('pa_physical_v1_launches', retained.launch),
    observationReference: reference('batting_observation_v1_observations', retained.capture),
    deliveryReference: reference('batting_observation_v1_deliveries', retained.delivery) };
};


/** Fixture boundary only. Values must come from authenticated original readers;
 * this guard is neither a receipt constructor nor permission to repair history. */
export const assertInFlightDecisionRetryFrontier = (input: Readonly<{
  priorPrefix: SamePaLifecyclePrefix; pendingPrefix: SamePaLifecyclePrefix; completedView: SamePaLifecycleView;
  decisionCut: SamePaPhysicalCut; physicalHeadReference: SamePaReference<'pa_physical_v1_cuts'>; successorSourceIds: readonly string[];
}>) => {
  const { priorPrefix, pendingPrefix, completedView, decisionCut } = input;
  const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('retained decision retry frontier differs'); };
  if (priorPrefix.source.sourceId !== 'physical-fixture:cut8:prefix' || completedView.source.sourceId !== 'physical-fixture:cut8:view'
    || pendingPrefix.source.sourceId !== 'physical-fixture:cut9:prefix' || decisionCut.source.sourceId !== 'in-flight-fixture:pitch3:decision-cut'
    || decisionCut.kind !== 'same_pa_physical_cut_v1' || decisionCut.stage !== 'in_flight' || decisionCut.operationOrdinal !== 3
    || priorPrefix.source.eventReferences.length !== 8 || input.successorSourceIds.length) throw new Error('retained decision retry frontier is not the original incomplete cut9');
  const decisionReference = reference('pa_physical_v1_cuts', decisionCut);
  same(input.physicalHeadReference, decisionReference);
  same(completedView.source.prefixReference, reference('pa_lifecycle_v1_work_prefixes', priorPrefix));
  same(pendingPrefix.previousViewReference, reference('pa_lifecycle_v1_execution_views', completedView));
  same(decisionCut.source.viewReference, reference('pa_lifecycle_v1_execution_views', completedView));
  same(pendingPrefix.source.eventReferences, [...priorPrefix.source.eventReferences, decisionReference]);
  same(pendingPrefix.source.anchorViewReference, priorPrefix.source.anchorViewReference);
  same(pendingPrefix.source.enrollmentReference, priorPrefix.source.enrollmentReference);
  same(pendingPrefix.cut.physicalOperationReference, decisionReference);
  same(completedView.cut.physicalOperationReference, decisionCut.source.previousOperationReference);
  for (const value of [pendingPrefix, completedView, decisionCut]) same(value.lineage, priorPrefix.lineage);
};

/** Original IFN01 post-response assertions and remaining batter/terminal chain.
 * Retained execution gets no credit for the earlier, already executed checks. */
export const completeInFlightBattingFairCatchSuffix = (h: SamePaPhysicalLifecycleSuffix,
  field: Readonly<{ root: SamePaPhysicalFieldRoot }>, caughtResponse: ReturnType<typeof completeNativeCaughtDefenderAdoption>,
  caught: Pick<ReturnType<typeof appendNativeCatchWork>, 'work' | 'workReference'>,
  s: Pick<ReturnType<typeof prepareInFlightBattingSwing>, 'posture' | 'capture' | 'delivery' | 'input' | 'emotion' | 'commitment'>,
  originalHeads: Record<string, SQLOutputValue>[], stage: (name: string) => void) => {
  const batterRun = appendNativeBatterRunCheckpoint(h, field.root, caughtResponse.adopted, s.posture, 'in-flight-fixture:batter-run', 10);
  return completeInFlightBattingAfterBatterRun(h, field, batterRun, caught, s, originalHeads, stage);
};

/** Original post-batter-run assertion and terminal tail, also used by cp10. */
export const completeInFlightBattingAfterBatterRun = (h: SamePaPhysicalLifecycleSuffix, field: Readonly<{ root: SamePaPhysicalFieldRoot }>,
  batterRun: ReturnType<typeof appendNativeBatterRunCheckpoint>,
  caught: Pick<ReturnType<typeof appendNativeCatchWork>, 'work' | 'workReference'>,
  s: Pick<ReturnType<typeof prepareInFlightBattingSwing>, 'posture' | 'capture' | 'delivery' | 'input' | 'emotion' | 'commitment'>,
  originalHeads: Record<string, SQLOutputValue>[], stage: (name: string) => void) => {
  const { f } = h;
  const batterHold = appendNativeBatterCatchHold(h, batterRun, caught, 'in-flight-fixture:batter-hold');
  stage('received-defender-and-batter-adoption-ready');

  expect(f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all()).toEqual(originalHeads);
  const reopenedPerception = f.x.f.track(openSqliteBattingPerceptionStore(f.path));
  const reopenedInput = f.x.f.track(openSqliteBattingExecutionInputStore(f.path));
  const reopenedEmotion = f.x.f.track(openSqliteBattingEmotionExecutionStore(f.path));
  expect(reopenedPerception.acceptObservation(s.capture.source.sourceId)).toEqual(s.capture);
  expect(reopenedPerception.acceptDelivery(s.delivery.source.sourceId)).toEqual(s.delivery);
  expect(reopenedInput.acceptInput(s.input.source.sourceId)).toEqual(s.input);
  expect(reopenedEmotion.accept(s.emotion.source.sourceId)).toEqual(s.emotion);
  expect(h.physical.readOperation(reference('pa_physical_v1_commitments', s.commitment)).record).toEqual(s.commitment);
  completeNativeFairCatchTerminal(h, field.root, batterHold.moved, batterHold.caught, 'in-flight-fixture:fair-terminal');
  stage('review-total-scoring-next-batter-complete');
};
