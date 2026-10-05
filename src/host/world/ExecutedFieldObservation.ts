import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { SeedRoot } from '../../core/rng/SeedRoot';
import type { BallWorldMoment, BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import type { BattedWorldSurface } from '../../core/sim/ball/BattedBallWorldContacts';
import type { BattedBallBasePrism } from '../../core/sim/ball/BattedBallBaseContact';
import { isObservationRefreshDue, type ObservationSample } from '../../core/sim/perception/Observation';
import { evaluateObservationGeometry } from '../../core/sim/perception/ObservationGeometry';
import { composeObservationQuality } from '../../core/sim/perception/ObservationQuality';
import { estimateOcclusionVisibility } from '../../core/sim/perception/Occlusion';
import { capturePlanarObservation, captureSpatialObservation } from '../../core/sim/perception/ObservationCapture';
import { predictPlanarObservationMemory, predictSpatialObservationMemory, type PlanarMotionEstimate,
  type SpatialMotionEstimate } from '../../core/sim/perception/ObservationMemory';
import { buildPlayerPerceivedWorldState } from '../../core/sim/perception/PlayerPerceivedWorldState';
import type { ReceivedCommunication } from '../../core/sim/perception/Communication';
import { hasUnmodeledObservationSurface } from './ActualObservationSurfaceGuard';
import type { DurablePlayerObservationModel } from './SqlitePlayerObservationModelStore';
import type { AcceptedActualFieldObservation, ActualFieldObservationReceipt, ActualObservationMoment, ActualObservationTarget } from './ActualFieldObservation';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type ExecutedObservationBasis = Readonly<{ at: ActualObservationMoment; ticksPerSecond: number; matchSeed: number; playId: number;
  playerIds: readonly string[]; actors: readonly BallWorldMotionActor[]; surfaces: readonly BattedWorldSurface[];
  bases: readonly BattedBallBasePrism[]; ballMoment: BallWorldMoment | null }>;
const vector = (value: Vec3) => Object.keys(value).sort().join('|') === 'x|y|z' && Object.values(value).every(Number.isFinite);

/** Shared sensory calculation only. Native callers must supply their own fully authenticated executed basis.
 * This owns no observation history, signal consumption, decision, physical action or calibration. */
export const sampleExecutedFieldObservation = (source: AcceptedActualFieldObservation, basis: ExecutedObservationBasis,
  model: DurablePlayerObservationModel, previous: Readonly<{ source: AcceptedActualFieldObservation; receipt: ActualFieldObservationReceipt }> | null,
  communicationEvidence?: NonNullable<ActualFieldObservationReceipt['communicationEvidence']>): ActualFieldObservationReceipt => {
  const at = basis.at;
  if ((source.communicationSourceId === undefined) !== (communicationEvidence === undefined)
    || communicationEvidence && (communicationEvidence.sourceId !== source.communicationSourceId || communicationEvidence.result.playerId !== source.playerId)) {
    throw new Error('actual observation communication dependency differs');
  }
  const communications: readonly ReceivedCommunication[] = communicationEvidence?.result.kind === 'received'
    ? [communicationEvidence.result.received] : [];
  const calibration = model.source.calibration, p = basis.ticksPerSecond;
  if (calibration.memoryDecayParameters.ticksPerSecond !== p) throw new Error('observation model clock differs from actual physical clock');
  const players = [...basis.playerIds].sort();
  if (!players.includes(source.playerId) || source.view.attentionTarget.kind === 'player' && !players.includes(source.view.attentionTarget.playerId)) {
    throw new Error('actual observation Player or attention scope differs');
  }
  if (previous && (previous.receipt.at.originTick !== at.originTick || previous.receipt.at.elapsedSeconds > at.elapsedSeconds
    || previous.source.physicalPitchSourceId !== source.physicalPitchSourceId || previous.source.playerId !== source.playerId
    || previous.source.observationModelSourceId !== source.observationModelSourceId
    || previous.source.view.poseVersion !== source.view.poseVersion
    || json(previous.source.view.bodyRelativeEyeOffset) !== json(source.view.bodyRelativeEyeOffset))) {
    throw new Error('actual observation chronology, model or eye anchor baseline differs');
  }
  const focusStartedAt = previous && json(previous.source.view.attentionTarget) === json(source.view.attentionTarget)
    ? previous.receipt.focusStartedAt : at;
  const attention = { target: source.view.attentionTarget, focusedSinceTick: focusStartedAt.tick };
  // These are actual executed actor segments, never the future primitives of an admitted throw plan.
  const actors = basis.actors.map((actor) => {
    const primitive = actor.primitive;
    const dt = (at.originTick - primitive.startTick) / p + at.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
    const position = { x: 0, y: 0, z: 0 }, velocity = { x: 0, y: 0, z: 0 };
    for (const axis of ['x', 'y', 'z'] as const) {
      position[axis] = primitive.startCenter[axis] + primitive.startVelocity[axis] * dt + 0.5 * primitive.acceleration[axis] * dt * dt;
      velocity[axis] = primitive.startVelocity[axis] + primitive.acceleration[axis] * dt;
    }
    if (!vector(position) || !vector(velocity)) throw new Error('actual observation sampled primitive overflow');
    return { playerId: actor.playerId, role: primitive.role, radiusMeters: primitive.radius, position, velocity };
  });
  const body = (playerId: string) => {
    const bodies = actors.filter((actor) => actor.playerId === playerId && actor.role === 'body');
    if (bodies.length !== 1) throw new Error('actual observation requires one owned body primitive per Player');
    return bodies[0];
  };
  players.forEach(body);
  const observerBody = body(source.playerId), offset = source.view.bodyRelativeEyeOffset;
  const observer = { position: { x: observerBody.position.x + offset.x, y: observerBody.position.y + offset.y,
    z: observerBody.position.z + offset.z }, velocity: observerBody.velocity, forward: source.view.forward };
  const rng = new SeedRoot(basis.matchSeed);
  const results: ActualFieldObservationReceipt['results'][number][] = [];
  const due = (target: ActualObservationTarget, lastObservedAt: number | null) => isObservationRefreshDue({ target, attention,
    lastObservedAt, currentTick: at.tick, policy: calibration.refreshPolicy });
  const capture = (target: ActualObservationTarget, truth: SpatialMotionEstimate) => {
    const geometry = evaluateObservationGeometry(observer, truth, calibration.geometryParameters);
    if (hasUnmodeledObservationSurface(observer.position, truth.position, basis.surfaces, basis.bases)) return { status: 'surface_visibility_unavailable' as const, sample: null };
    const occluders = actors.filter((actor) => actor.playerId !== source.playerId
      && (target.kind !== 'player' || actor.playerId !== target.playerId)).map((actor) => ({ center: actor.position, radiusMeters: actor.radiusMeters }));
    const occlusionVisibility = estimateOcclusionVisibility(observer.position, truth.position, occluders);
    // Attention is categorical. Sparse endpoint observations do not establish continuous visibility duration.
    const quality = composeObservationQuality({ ...geometry, occlusionVisibility,
      attentionQuality: json(target) === json(attention.target) ? 1 : 0, observationDurationSeconds: 0,
      perceptionAbility: calibration.perceptionAbility }, calibration.qualityParameters);
    // FOV/occlusion nondetection is mandatory even if an explicit detection threshold is zero.
    if (quality.visibilityQuality === 0) return { status: 'not_detected' as const, sample: null };
    const stream = rng.streamRng(basis.playId, 'perception', json(['actual_field_observation', source.physicalPitchSourceId,
      source.playerId, source.baseFieldSourceId, source.executionSourceId, at.originTick, at.elapsedSeconds, target]));
    const sample = target.kind === 'ball' ? captureSpatialObservation(truth, at.tick, quality.totalQuality, stream, calibration.errorParameters)
      : capturePlanarObservation({ position: { x: truth.position.x, z: truth.position.z }, velocity: { x: truth.velocity.x, z: truth.velocity.z } },
        at.tick, quality.totalQuality, stream, calibration.errorParameters);
    return { status: sample ? 'detected' as const : 'not_detected' as const, sample };
  };
  let ball = previous?.receipt.samples.ball ?? null;
  const target: ActualObservationTarget = { kind: 'ball' };
  const ballMoment = basis.ballMoment;
  if (!ballMoment) results.push({ target, status: 'physical_state_unavailable' });
  else if (!due(target, ball?.sample.observedAt ?? null)) results.push({ target, status: 'refresh_not_due' });
  else {
    const result = capture(target, ballMoment.ball), sample = result.sample as ObservationSample<SpatialMotionEstimate> | null;
    results.push({ target, status: result.status });
    if (sample) ball = { at, sample };
  }
  const samples: ActualFieldObservationReceipt['samples']['players'][number][] = [];
  for (const playerId of players.filter((player) => player !== source.playerId)) {
    const target: ActualObservationTarget = { kind: 'player', playerId };
    let old = previous?.receipt.samples.players.find((value) => value.playerId === playerId) ?? null;
    if (!due(target, old?.sample.observedAt ?? null)) results.push({ target, status: 'refresh_not_due' });
    else {
      const result = capture(target, body(playerId)), sample = result.sample as ObservationSample<PlanarMotionEstimate> | null;
      results.push({ target, status: result.status });
      if (sample) old = { playerId, at, sample };
    }
    if (old) samples.push(old);
  }
  const receipt: ActualFieldObservationReceipt = { at, focusStartedAt, viewGeometry: { poseVersion: source.view.poseVersion,
    eyeAnchor: 'body_primitive_center', offsetAxes: 'world', bodyRelativeEyeOffset: offset, playerTargetAnchor: 'body_primitive_center' },
    temporalPolicy: 'instantaneous_capture_tick_refresh_and_memory', results, samples: { ball, players: samples },
    perceived: buildPlayerPerceivedWorldState({ observerId: source.playerId, observationTime: at.tick, attention,
      ball: ball ? predictSpatialObservationMemory(ball.sample, at.tick, calibration.memoryDecayParameters) : null,
      players: samples.map((value) => ({ playerId: value.playerId,
        memory: predictPlanarObservationMemory(value.sample, at.tick, calibration.memoryDecayParameters) })), communications, knownContext: null }),
    ...(communicationEvidence === undefined ? {} : { communicationEvidence }) };
  // Finite inputs can still overflow capture or memory arithmetic; reject before returning or serializing.
  return freeze(cloneInert(receipt));
};
