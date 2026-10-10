import assert from 'node:assert/strict';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import type { AcceptedActualFirstBaseUmpireSetup } from './ActualFirstBaseUmpire';
import type { attachActualFirstBasePlayEndFixture } from './ActualFirstBasePlayEndFixtures.test-support';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { battedWorldFieldEvidenceFromSqlite, type DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { DurableActualLivePlayRuntime } from './ActualLivePlayRuntime';
import { openSqliteBattedWorldFieldExecutionStore,
  type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { openSqliteActualLiveRuleConsumptionStore } from './SqliteActualLiveRuleConsumptionStore';
import { openSqliteActualFirstBaseUmpireStore } from './SqliteActualFirstBaseUmpireStore';
import { openSqliteActualCommunicationStore } from './SqliteActualCommunicationStore';
import { openSqliteActualFirstBasePlayEndStore } from './SqliteActualFirstBasePlayEndStore';
import { openSqliteActualLiveAdjudicationStore } from './SqliteActualLiveAdjudicationStore';
import { openSqliteActualLivePlayClosureStore } from './SqliteActualLivePlayClosureStore';
import type { AcceptedActualLiveAdjudication } from './ActualLiveAdjudicationSource';
import type { AcceptedActualLivePlayClosure } from './ActualLivePlayClosureSource';

export type ActualFirstBaseOfficialRoot = Pick<ReturnType<typeof attachActualFirstBasePlayEndFixture>,
  'f' | 'pitchId' | 'source' | 'captured' | 'executions' | 'prefix'> & Readonly<{
    runtime: DurableActualLivePlayRuntime; baseField: DurableBattedWorldFieldAction;
    retainedRace?: ReturnType<typeof attachActualFirstBasePlayEndFixture>['retainedRace'];
    retainedOfficialPrefix?: ReturnType<typeof attachActualFirstBasePlayEndFixture>['retainedOfficialPrefix'];
  }>;

/** Original positive-test calibration and official policy attached to the
 * caller's existing physical owners. No physical result or identity is replaced. */
export const attachActualFirstBaseOfficialFixture = <T extends ActualFirstBaseOfficialRoot>(path: string, x: T) => {
  const completed = new Set(x.retainedOfficialPrefix?.completedSourceIds ?? []);
  // These flags select reads only. The real owner must return the original value,
  // and its Source must match the unchanged declaration before it can be reused.
  const original = <V extends { source: unknown }>(value: V | null, source: unknown): V => {
    assert(value, 'retained official original is missing');
    assert.equal(json(value.source), json(source), 'retained official Source differs from the original recipe');
    return value;
  };
  const race = x.retainedRace ?? x.executions.accept(x.source.sourceId);
  if (race.execution.kind !== 'first_base_race') throw new Error('original first-base race owner is missing');
  const p = playerObservationCalibrationFixture();
  const tps = x.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
  const center = x.baseField.geometry.geometry.baseGeometry.bases.first.region.center;
  const acknowledgement = { sourceId: 'rule-consumption', sourceVersion: 'fixture-v1', capability: 'actual_first_base_rule_consumption_v1' as const,
    captureExecutionSourceId: x.captured.source.sourceId, ruleExecutionSourceId: race.source.sourceId };
  const consumptions = x.f.track(openSqliteActualLiveRuleConsumptionStore(path,
    { readAcceptedConsumption: id => id === acknowledgement.sourceId ? acknowledgement : null }));
  const consumption = completed.has(acknowledgement.sourceId)
    ? original(consumptions.read(acknowledgement.sourceId), acknowledgement) : consumptions.accept(acknowledgement.sourceId);
  const setup: AcceptedActualFirstBaseUmpireSetup = { sourceId: 'play-end-umpire-setup', sourceVersion: 'fixture-v1', gameId: x.runtime.gameId,
    physicalPitchSourceId: x.pitchId, umpireId: 'umpire-1', pose: { version: 'static_first_base_view_v1', position: { ...center, y: 20 },
      forward: { x: 0, y: -1, z: 0 }, validFromElapsedSeconds: 0, validThroughElapsedSeconds: 10 }, attention: { control: 1, touch: 1 },
    calibration: { version: 'first_base_timing_triangular_v1', perceptionAbility: 0.8, callDelaySeconds: 2 / tps,
      geometryParameters: { ...p.geometryParameters, fullQualityHalfAngleRadians: Math.PI - .01, maxVisibleHalfAngleRadians: Math.PI,
        fullQualityDistanceMeters: 100, maxObservableDistanceMeters: 1000, fullQualityRelativeSpeedMps: 100000, maxRelativeSpeedMps: 1000000 },
      qualityParameters: p.qualityParameters,
      timingErrorParameters: { minimumDetectionQuality: .1, minimumTimeErrorSeconds: 0, maximumTimeErrorSeconds: 0 } } };
  const observation = { sourceId: 'play-end-umpire-observation', sourceVersion: 'fixture-v1', setupSourceId: setup.sourceId,
    ruleExecutionSourceId: race.source.sourceId };
  const sources = new Map<string, AcceptedBattedWorldFieldExecution>();
  const physicalWriter = x.f.track(openSqliteBattedWorldFieldExecutionStore(path, { read: battedWorldFieldEvidenceFromSqlite(x.f.db).read },
    { readAcceptedExecution: id => sources.get(id) ?? null }));
  const extendBucket = (sourceId: string, previous: string, throughTick: number,
    prefix: Parameters<typeof actualPlayersKinematicsFromPrefix>[1]) => {
    const saved = completed.has(sourceId) ? physicalWriter.read(sourceId) : null;
    if (completed.has(sourceId)) assert(saved, 'retained official physical original is missing');
    const priorAction = saved ? prefix.executions.slice().reverse().find(value => 'knownWork' in value.source.action)?.source.action : undefined;
    if (saved) assert(priorAction && 'knownWork' in priorAction, 'retained official predecessor has no original known work');
    const ids = x.runtime.membership.participants.map(player => player.playerId);
    const source: AcceptedBattedWorldFieldExecution = { sourceId, sourceVersion: 'fixture-v1', baseFieldSourceId: x.baseField.source.sourceId,
      previousExecutionSourceId: previous, action: { kind: 'owned_motion_v2', checkpoint: { kind: 'retained_quantizer_bucket_v1', throughTick },
        knownWork: priorAction && 'knownWork' in priorAction ? priorAction.knownWork : ownedMotionKnownWorkFromSqlite(x.f.db, x.pitchId, ids),
        contributions: actualPlayersKinematicsFromPrefix(ids, prefix).map(self => ({ kind: 'retained', playerId: self.playerId, command: self.activeCommand })) } };
    sources.set(sourceId, source); return saved ? original(saved, source) : physicalWriter.accept(sourceId);
  };
  const waitingSource = { sourceId: 'scheduled-operative-call', sourceVersion: 'fixture-v1', observationSourceId: observation.sourceId,
    currentExecutionSourceId: race.source.sourceId };
  const calls = new Map([[waitingSource.sourceId, waitingSource]]);
  const umpires = x.f.track(openSqliteActualFirstBaseUmpireStore(path, { readAcceptedSetup: () => setup,
    readAcceptedObservation: () => observation, readAcceptedCall: id => calls.get(id) ?? null }));
  if (completed.has(setup.sourceId)) original(umpires.readSetup(setup.sourceId), setup); else umpires.acceptSetup(setup.sourceId);
  const observed = completed.has(observation.sourceId) ? original(umpires.readObservation(observation.sourceId), observation) : umpires.observe(observation.sourceId);
  const waiting = completed.has(waitingSource.sourceId) ? original(umpires.readCall(waitingSource.sourceId), waitingSource) : umpires.advanceCall(waitingSource.sourceId);
  if (waiting.schedule.kind !== 'scheduled') throw new Error('original first-base delayed call was not scheduled');
  const racePrefix = x.prefix(race.source.sourceId);
  const due = extendBucket('actual-call-due-cut', race.source.sourceId, race.execution.field.motion.world.moment.ball.tick + 3, racePrefix);
  const callSource = { ...waitingSource, sourceId: 'operative-call', currentExecutionSourceId: due.source.sourceId };
  calls.set(callSource.sourceId, callSource);
  const call = completed.has(callSource.sourceId) ? original(umpires.readCall(callSource.sourceId), callSource) : umpires.advanceCall(callSource.sourceId);
  // Proposal data comes from the authenticated race and the actual returned due
  // execution. New work discovery and the accepting owner's checks stay fresh.
  const final = extendBucket('actual-post-call-quantizer-tail', due.source.sourceId, due.execution.field.motion.world.moment.ball.tick + 1,
    { ...racePrefix, executions: [...racePrefix.executions, due] });
  if (call.schedule.kind !== 'called' || call.schedule.call !== 'out') throw new Error('original first-base operative retirement is missing');
  const model = { sourceId: 'call-reception-model', sourceVersion: 'fixture-v1', gameId: x.runtime.gameId, physicalPitchSourceId: x.pitchId,
    parameters: { version: 'fixed_receiver_conditions_v1' as const, timing: 'exact_sent_plus_core_delay_ticks_v1' as const,
      receivers: x.runtime.membership.participants.map(player => ({ playerId: player.playerId, conditions: { propagationDelayTicks: 100,
        recognitionBaseDelayTicks: 0, maxAdditionalRecognitionDelayTicks: 0, audibility: 1, recognition: 1, attention: 1, minimumRecognizableQuality: .5 } })) } };
  const communicationSource = { sourceId: 'call-information', sourceVersion: 'fixture-v1', callSourceId: call.source.sourceId,
    modelSourceId: model.sourceId, currentExecutionSourceId: final.source.sourceId, previousCommunicationSourceId: null };
  const communications = x.f.track(openSqliteActualCommunicationStore(path,
    { readAcceptedModel: () => model, readAcceptedCommunication: () => communicationSource }));
  if (completed.has(model.sourceId)) original(communications.readModel(model.sourceId), model); else communications.acceptModel(model.sourceId);
  const communication = completed.has(communicationSource.sourceId)
    ? original(communications.read(communicationSource.sourceId), communicationSource) : communications.accept(communicationSource.sourceId);
  const endSource = { sourceId: 'physical-end', sourceVersion: 'fixture-v1', runtimeSourceId: x.runtime.source.sourceId,
    baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: final.source.sourceId, ruleConsumptionSourceId: acknowledgement.sourceId,
    umpireCallSourceId: call.source.sourceId, communicationSourceId: communication.source.sourceId };
  const ends = x.f.track(openSqliteActualFirstBasePlayEndStore(path, { readAcceptedEnd: id => id === endSource.sourceId ? endSource : null }));
  const end = completed.has(endSource.sourceId) ? original(ends.read(endSource.sourceId), endSource) : ends.accept(endSource.sourceId);
  const frame = x.baseField.response.touch.worldContact.flight.physicalPitch.frame;
  const adjudicationSource: AcceptedActualLiveAdjudication = { sourceId: 'fixture-actual-live-adjudication', sourceVersion: 'fixture-v1',
    physicalEndSourceId: end.source.sourceId, policy: { sourceId: 'explicit-fixture-official-policy', sourceVersion: 'fixture-v1',
      ruleProfileId: frame.match.ruleProfileId,
      officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } } };
  const adjudications = x.f.track(openSqliteActualLiveAdjudicationStore(path,
    { readAcceptedAdjudication: id => id === adjudicationSource.sourceId ? adjudicationSource : null }));
  const adjudication = completed.has(adjudicationSource.sourceId)
    ? original(adjudications.read(adjudicationSource.sourceId), adjudicationSource) : adjudications.accept(adjudicationSource.sourceId);
  if (adjudication.kind !== 'official_ready') throw new Error(`original first-base adjudication is pending: ${adjudication.pendingReasons.join(', ')}`);
  const closureSource: AcceptedActualLivePlayClosure = { sourceId: 'fixture-actual-live-closure', sourceVersion: 'fixture-v1',
    adjudicationSourceId: adjudication.source.sourceId, applicationId: 'fixture-actual-live-application',
    closureTick: end.playEnd.tick + 1, nextStartedAtTick: end.playEnd.tick + 2, controllerReset: 'rule_system_retire_original_play',
    worldSetup: { baseCenters: { first: x.baseField.geometry.geometry.baseGeometry.bases.first.region.center,
      second: x.baseField.geometry.geometry.baseGeometry.bases.second.region.center,
      third: x.baseField.geometry.geometry.baseGeometry.bases.third.region.center },
      defenders: frame.world.defenders.map(d => ({ playerId: d.playerId, registeredPosition: d.registeredPosition, position: d.position })),
      activePreviousPlayControllerIds: [] } };
  const closures = x.f.track(openSqliteActualLivePlayClosureStore(path,
    { readAcceptedClosure: id => id === closureSource.sourceId ? closureSource : null }));
  const queued = completed.has(closureSource.sourceId) ? original(closures.read(closureSource.sourceId), closureSource) : closures.enqueue(closureSource.sourceId);
  const closure = queued.result ?? closures.resume(closureSource.sourceId);
  return { ...x, race, consumptions, consumption, umpires, observed, waiting, due, call, final, communications, communication,
    endSource, ends, end, adjudicationSource, adjudications, adjudication, closureSource, closures, queued, closure };
};
