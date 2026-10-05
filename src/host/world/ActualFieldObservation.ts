import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import type { CanonicalWholePlayHistory } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory';
import type { Vec3 } from '../../core/model/geometry';
import type { ObservationSample } from '../../core/sim/perception/Observation';
import type { PlanarMotionEstimate, SpatialMotionEstimate } from '../../core/sim/perception/ObservationMemory';
import type { PlayerPerceivedWorldState } from '../../core/sim/perception/PlayerPerceivedWorldState';
import { sampleExecutedFieldObservation } from './ExecutedFieldObservation';
import { battedWorldPhysicalPrefixAndWholePlayHistory } from './WholePlayPhysicalHistoryFromPrefix';
import type { DurablePlayerObservationModel } from './SqlitePlayerObservationModelStore';
import type { ActualObservationCallReception } from './ActualCallCommunication';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type ActualObservationTarget = Readonly<{ kind: 'ball' }> | Readonly<{ kind: 'player'; playerId: string }>;
export type AcceptedActualFieldObservation = Readonly<{
  sourceId: string; sourceVersion: string; physicalPitchSourceId: string; playerId: string;
  baseFieldSourceId: string; executionSourceId: string | null; observationModelSourceId: string;
  previousObservationSourceId: string | null;
  /** Opt-in immutable call reception dependency. Omitted in all legacy Sources. */
  communicationSourceId?: string;
  view: Readonly<{ poseVersion: string; bodyRelativeEyeOffset: Vec3; forward: Vec3; attentionTarget: ActualObservationTarget }>;
}>;
export type ActualObservationMoment = Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>;
type TimedSample<T> = Readonly<{ at: ActualObservationMoment; sample: ObservationSample<T> }>;
export type ActualFieldObservationReceipt = Readonly<{
  at: ActualObservationMoment; focusStartedAt: ActualObservationMoment;
  viewGeometry: Readonly<{ poseVersion: string; eyeAnchor: 'body_primitive_center'; offsetAxes: 'world';
    bodyRelativeEyeOffset: Vec3; playerTargetAnchor: 'body_primitive_center' }>;
  temporalPolicy: 'instantaneous_capture_tick_refresh_and_memory';
  results: readonly Readonly<{ target: ActualObservationTarget;
    status: 'detected' | 'not_detected' | 'refresh_not_due' | 'physical_state_unavailable' | 'surface_visibility_unavailable' }>[];
  samples: Readonly<{ ball: TimedSample<SpatialMotionEstimate> | null;
    players: readonly (TimedSample<PlanarMotionEstimate> & Readonly<{ playerId: string }>)[] }>;
  perceived: PlayerPerceivedWorldState<null>;
  communicationEvidence?: Readonly<{ sourceId: string; snapshotHash: string; result: ActualObservationCallReception }>;
}>;
export const actualObservationId = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const fields = (value: unknown, names: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...names].sort());
const vector = (value: Vec3) => fields(value, ['x', 'y', 'z']) && Object.values(value).every(Number.isFinite);
export const actualFieldObservationInput = (raw: AcceptedActualFieldObservation, sourceId: string): AcceptedActualFieldObservation => {
  const s = cloneInert(raw), id = actualObservationId;
  if (!fields(s, ['sourceId', 'sourceVersion', 'physicalPitchSourceId', 'playerId', 'baseFieldSourceId', 'executionSourceId',
    'observationModelSourceId', 'previousObservationSourceId', 'view', ...('communicationSourceId' in s ? ['communicationSourceId'] : [])]) || s.sourceId !== sourceId
    || ![sourceId, s.sourceVersion, s.physicalPitchSourceId, s.playerId, s.baseFieldSourceId, s.observationModelSourceId].every(id)
    || s.executionSourceId !== null && !id(s.executionSourceId)
    || s.previousObservationSourceId !== null && (!id(s.previousObservationSourceId) || s.previousObservationSourceId === sourceId)
    || 'communicationSourceId' in s && !id(s.communicationSourceId)
    || !fields(s.view, ['poseVersion', 'bodyRelativeEyeOffset', 'forward', 'attentionTarget']) || !id(s.view.poseVersion)
    || !vector(s.view.bodyRelativeEyeOffset) || !vector(s.view.forward)
    || !Number.isFinite(Math.hypot(s.view.forward.x, s.view.forward.y, s.view.forward.z))
    || Math.hypot(s.view.forward.x, s.view.forward.y, s.view.forward.z) === 0) throw new Error('invalid accepted actual observation Source/view');
  const target = s.view.attentionTarget;
  if (!(target?.kind === 'ball' && fields(target, ['kind']))
    && !(target?.kind === 'player' && fields(target, ['kind', 'playerId']) && id(target.playerId) && target.playerId !== s.playerId)) {
    throw new Error('invalid actual observation attention target');
  }
  return freeze(s);
};

/** Sampleable executed constraint truth is not an adopted continuation or custody. */
export const actualBattedWorldObservationMoment = (history: CanonicalWholePlayHistory): BallWorldMoment | null => {
  if (history.cursor) return history.cursor.moment;
  const latest = history.physicalSteps.at(-1);
  if (latest?.kind === 'owned_motion_v2' && latest.operation?.kind === 'acquisition') {
    const p = latest.operation.progress;
    if (p.kind === 'capturing' || p.kind === 'fence_pending') return p.world.moment;
  }
  return latest?.kind === 'acquisition_advance' && (latest.progress.kind === 'capturing' || latest.progress.kind === 'fence_pending')
    ? latest.progress.world.moment : null;
};

type Prefix = Parameters<typeof battedWorldPhysicalPrefixAndWholePlayHistory>[0];
/** Internal Native sampler: the public owner rederives every prefix/model; truth never enters the perceived output. */
export const sampleActualFieldObservation = (source: AcceptedActualFieldObservation, prefix: Prefix,
  model: DurablePlayerObservationModel, previous: Readonly<{ source: AcceptedActualFieldObservation; receipt: ActualFieldObservationReceipt }> | null,
  communicationEvidence?: NonNullable<ActualFieldObservationReceipt['communicationEvidence']>): ActualFieldObservationReceipt => {
  const { physical, history } = battedWorldPhysicalPrefixAndWholePlayHistory(prefix);
  const frame = prefix.baseField.response.touch.worldContact.flight.physicalPitch.frame;
  const at = { originTick: history.horizon.originTick, elapsedSeconds: history.horizon.elapsedSeconds, tick: history.horizon.ball.tick };
  return sampleExecutedFieldObservation(source, { at, ticksPerSecond: history.origin.ticksPerSecond, matchSeed: frame.matchSeed, playId: frame.match.playId,
    playerIds: [history.origin.batterRunnerId, ...history.origin.defenderIds], actors: physical.segments.at(-1)!.actors,
    surfaces: prefix.baseField.response.touch.worldContact.model.surfaces, bases: Object.values(prefix.baseField.geometry.geometry.bases),
    ballMoment: actualBattedWorldObservationMoment(history) }, model, previous, communicationEvidence);
};
