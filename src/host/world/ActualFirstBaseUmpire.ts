import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { createFirstBaseUmpireCalibration, perceiveFirstBasePlay, resolveFirstBaseCallSchedule } from '../../core/sim/perception/FirstBaseUmpirePerception';
import { evaluateObservationGeometry } from '../../core/sim/perception/ObservationGeometry';
import { composeObservationQuality } from '../../core/sim/perception/ObservationQuality';
import { estimateOcclusionVisibility } from '../../core/sim/perception/Occlusion';
import { findBallWorldFootBaseContactIntervals } from '../../core/sim/ball/BallWorldFootBaseContact';
import type { BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { hasUnmodeledObservationSurface } from './ActualObservationSurfaceGuard';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { Vec3 } from '../../core/model/geometry';
import type { FirstBasePerceivedPlay, FirstBaseCallSchedule, FirstBaseUmpireCalibration } from '../../core/sim/perception/FirstBaseUmpirePerception';
import type { ActualObservationMoment } from './ActualFieldObservation';

export type AcceptedActualFirstBaseUmpireSetup = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; physicalPitchSourceId: string; umpireId: string;
  pose: Readonly<{ version: 'static_first_base_view_v1'; position: Vec3; forward: Vec3;
    validFromElapsedSeconds: number; validThroughElapsedSeconds: number }> | null;
  attention: Readonly<{ control: number; touch: number }> | null;
  calibration: FirstBaseUmpireCalibration | null;
}>;
export type DurableActualFirstBaseUmpireSetup = Readonly<{ source: AcceptedActualFirstBaseUmpireSetup; physicalPitchHash: string }>;
export type AcceptedActualFirstBaseUmpireObservation = Readonly<{
  sourceId: string; sourceVersion: string; setupSourceId: string; ruleExecutionSourceId: string;
}>;
export type DurableActualFirstBaseUmpireObservation = Readonly<{
  source: AcceptedActualFirstBaseUmpireObservation; setup: AcceptedActualFirstBaseUmpireSetup;
  gameId: string; physicalPitchSourceId: string; playId: number; batterRunnerId: string; outsAtStart: number;
  clock: Readonly<{ originTick: number; ticksPerSecond: number }>; availability: ActualObservationMoment;
  ruleEvidenceRevision: number; ruleEvidenceHash: string; physicalPrefixHash: string; perception: FirstBasePerceivedPlay;
  eventEvidence: Readonly<{ controlElapsedSeconds: number; touchElapsedSeconds: number }> | null;
}>;
export type AcceptedActualFirstBaseUmpireCall = Readonly<{
  sourceId: string; sourceVersion: string; observationSourceId: string; currentExecutionSourceId: string;
}>;
export type DurableActualFirstBaseUmpireCall = Readonly<{
  source: AcceptedActualFirstBaseUmpireCall; observation: DurableActualFirstBaseUmpireObservation;
  currentExecutionHash: string; advancedThrough: ActualObservationMoment; schedule: FirstBaseCallSchedule;
  onFieldCall: Readonly<{ callId: string; tick: number; basisSnapshotId: string; basisEvidenceRevision: number;
    ruling: Readonly<{ outsAfter: number; basesAfter: Readonly<{ first: string | null; second: null; third: null }>;
      scoredRunnerIds: readonly [] }> }> | null;
}>;
export type ActualFirstBaseOffensiveDisposition = Readonly<{ kind: 'pending'; reason: string }>
  | Readonly<{ kind: 'active'; runnerId: string; causeCallSourceId: string }>
  | Readonly<{ kind: 'retired'; runnerId: string; causeCallSourceId: string; at: ActualObservationMoment }>;
export const umpireId = (v: unknown): v is string => typeof v === 'string' && !!v.length && v === v.trim();
export const umpireFields = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const vector = (v: Vec3): boolean => umpireFields(v, ['x', 'y', 'z']) && Object.values(v).every(Number.isFinite);
const seconds = (v: number): boolean => Number.isFinite(v) && v >= 0;
const unit = (v: number): boolean => seconds(v) && v <= 1;
export const actualFirstBaseSetupInput = (raw: AcceptedActualFirstBaseUmpireSetup, sourceId: string): AcceptedActualFirstBaseUmpireSetup => {
  const s = cloneInert(raw);
  if (!umpireFields(s, ['sourceId', 'sourceVersion', 'gameId', 'physicalPitchSourceId', 'umpireId', 'pose', 'attention', 'calibration'])
    || s.sourceId !== sourceId || ![s.sourceId, s.sourceVersion, s.gameId, s.physicalPitchSourceId, s.umpireId].every(umpireId)) throw new Error('invalid actual umpire setup Source');
  if (s.pose !== null && (!umpireFields(s.pose, ['version', 'position', 'forward', 'validFromElapsedSeconds', 'validThroughElapsedSeconds'])
    || s.pose.version !== 'static_first_base_view_v1' || !vector(s.pose.position) || !vector(s.pose.forward)
    || !Number.isFinite(Math.hypot(s.pose.forward.x, s.pose.forward.y, s.pose.forward.z))
    || Math.hypot(s.pose.forward.x, s.pose.forward.y, s.pose.forward.z) === 0 || !seconds(s.pose.validFromElapsedSeconds)
    || !seconds(s.pose.validThroughElapsedSeconds) || s.pose.validThroughElapsedSeconds < s.pose.validFromElapsedSeconds)) throw new Error('invalid actual umpire static pose');
  if (s.attention !== null && (!umpireFields(s.attention, ['control', 'touch']) || !Object.values(s.attention).every(unit))) throw new Error('invalid actual umpire attention');
  return freeze({ ...s, calibration: s.calibration === null ? null : createFirstBaseUmpireCalibration(s.calibration) });
};
export const actualFirstBaseObservationInput = (raw: AcceptedActualFirstBaseUmpireObservation, sourceId: string): AcceptedActualFirstBaseUmpireObservation => {
  const s = cloneInert(raw);
  if (!umpireFields(s, ['sourceId', 'sourceVersion', 'setupSourceId', 'ruleExecutionSourceId']) || s.sourceId !== sourceId
    || !Object.values(s).every(umpireId)) throw new Error('invalid actual umpire observation Source');
  return freeze(s);
};
export const actualFirstBaseCallInput = (raw: AcceptedActualFirstBaseUmpireCall, sourceId: string): AcceptedActualFirstBaseUmpireCall => {
  const s = cloneInert(raw);
  if (!umpireFields(s, ['sourceId', 'sourceVersion', 'observationSourceId', 'currentExecutionSourceId']) || s.sourceId !== sourceId
    || !Object.values(s).every(umpireId)) throw new Error('invalid actual umpire call Source');
  return freeze(s);
};
type Prefix = Parameters<typeof battedWorldFieldPhysicalPrefix>[0];
const sample = (actor: BallWorldMotionActor, originTick: number, elapsedSeconds: number) => {
  const p = actor.primitive, dt = (originTick - p.startTick) / p.ticksPerSecond + elapsedSeconds - (actor.startElapsedSeconds ?? 0);
  const position = { x: 0, y: 0, z: 0 }, velocity = { x: 0, y: 0, z: 0 };
  for (const axis of ['x', 'y', 'z'] as const) {
    position[axis] = p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt;
    velocity[axis] = p.startVelocity[axis] + p.acceleration[axis] * dt;
  }
  if (!vector(position) || !vector(velocity)) throw new Error('actual umpire cue arithmetic overflow');
  return { position, velocity };
};
/** Native-only internal sampler. Callers supply references; the store reconstructs this prefix on its own DB. */
export const sampleActualFirstBaseUmpireObservation = (source: AcceptedActualFirstBaseUmpireObservation,
  setup: AcceptedActualFirstBaseUmpireSetup, race: DurableBattedWorldFieldExecution, prefix: Prefix): DurableActualFirstBaseUmpireObservation => {
  if (race.execution.kind !== 'first_base_race' || race.source.action.kind !== 'first_base_race'
    || race.source.action.custodyPolicy !== 'release_exclusive_v1') throw new Error('actual umpire requires an explicit original first-base rule consumer');
  const physical = battedWorldFieldPhysicalPrefix({ ...prefix, custodyPolicy: 'release_exclusive_v1' }), ball = physical.field.evidence;
  const frame = race.baseField.response.touch.worldContact.flight.physicalPitch.frame;
  if (setup.gameId !== frame.gameId || setup.physicalPitchSourceId !== race.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId) {
    throw new Error('actual umpire original game/pitch scope differs');
  }
  const availability = { originTick: ball.originTick, elapsedSeconds: ball.horizon.elapsedSeconds, tick: ball.horizon.ball.tick };
  const clock = { originTick: ball.originTick, ticksPerSecond: ball.ticksPerSecond };
  const rule = race.execution.groundRule;
  let perception: FirstBasePerceivedPlay, eventEvidence: DurableActualFirstBaseUmpireObservation['eventEvidence'] = null;
  const empty = Object.values(frame.match.bases).every(value => value === null) && frame.world.runners.length === 0;
  if (!empty) perception = { kind: 'pending', reason: 'unsupported_offensive_participation' };
  else if (!rule || race.execution.ballEvidence.kind !== 'grounded' || race.execution.ballEvidence.territory !== 'fair') {
    perception = { kind: 'pending', reason: 'first_base_applicability_unavailable' };
  } else {
    // Use actual contacts only. Neither the classifier nor its sampler consults correctRuleResult.
    const controls = rule.actualChronology.firstDefenderControls, touch = rule.actualChronology.runnerTouch;
    if (controls.length !== 1 || !touch) perception = { kind: 'pending', reason: 'event_pair_unavailable' };
    else {
      const control = controls[0];
      eventEvidence = { controlElapsedSeconds: control.elapsedSeconds, touchElapsedSeconds: touch.elapsedSeconds };
      if (setup.pose && (setup.pose.validFromElapsedSeconds > Math.min(control.elapsedSeconds, touch.elapsedSeconds)
        || setup.pose.validThroughElapsedSeconds < availability.elapsedSeconds)) perception = { kind: 'pending', reason: 'pose_interval_unavailable' };
      else {
        const actorsAt = (elapsed: number) => {
          const segment = physical.segments.find(value => value.startElapsedSeconds <= elapsed && value.endElapsedSeconds >= elapsed);
          if (!segment) throw new Error('actual umpire event is outside executed actor coverage');
          return { segment, actors: segment.actors.map(actor => ({ actor, ...sample(actor, ball.originTick, elapsed) })) };
        };
        const c = actorsAt(control.elapsedSeconds), t = actorsAt(touch.elapsedSeconds);
        const glove = c.actors.filter(value => value.actor.playerId === control.playerId && value.actor.primitive.role === 'glove');
        if (glove.length !== 1) throw new Error('actual umpire control cue requires one owned glove');
        const surface = race.baseField.geometry.geometry.baseGeometry.bases.first;
        const feetFor = (playerId: string, at: number, sampleAt: typeof t) => sampleAt.actors
          .filter(value => value.actor.playerId === playerId
            && (value.actor.primitive.role === 'left_foot' || value.actor.primitive.role === 'right_foot'))
          .filter(value => findBallWorldFootBaseContactIntervals({ actor: value.actor, originTick: ball.originTick,
            searchStartElapsedSeconds: sampleAt.segment.startElapsedSeconds, searchEndElapsedSeconds: sampleAt.segment.endElapsedSeconds,
            base: surface.region, baseSurfaceHeightMeters: surface.surfaceHeightMeters })
            .some(interval => interval.startElapsedSeconds <= at && interval.endElapsedSeconds >= at))
          .sort((left, right) => left.actor.primitive.role < right.actor.primitive.role ? -1 : left.actor.primitive.role > right.actor.primitive.role ? 1 : 0);
        const feet = feetFor(ball.batterRunnerId, touch.elapsedSeconds, t), controlFeet = feetFor(control.playerId, control.elapsedSeconds, c);
        if (!feet.length || !controlFeet.length) throw new Error('actual umpire cue requires an actual owned contacting foot');
        const cue = (at: number, target: typeof glove[number], actors: typeof c.actors) => ({ elapsedSeconds: at,
          // The exposed upper point is geometry-derived and avoids placing the visible cue inside its own bag.
          target: { position: { ...target.position, y: target.position.y + target.actor.primitive.radius }, velocity: target.velocity },
          occluders: actors.filter(value => value.actor.primitive.role === 'body')
            .map(value => ({ center: value.position, radiusMeters: value.actor.primitive.radius })) });
        const events = { control: cue(control.elapsedSeconds, glove[0], c.actors), touch: cue(touch.elapsedSeconds, feet[0], t.actors) };
        const controlBaseCue = cue(control.elapsedSeconds, controlFeet[0], c.actors);
        const pose = setup.pose;
        if (pose && [...Object.values(events), controlBaseCue].some(event => hasUnmodeledObservationSurface(pose.position, event.target.position,
          race.baseField.response.touch.worldContact.model.surfaces, Object.values(race.baseField.geometry.geometry.bases)))) perception = { kind: 'pending', reason: 'surface_visibility_unavailable' };
        else {
          const root = new SeedRoot(frame.matchSeed);
          const stream = (key: 'control' | 'touch') => root.streamRng(frame.match.playId, 'perception', json([
            'actual_first_base_umpire_v1', setup.physicalPitchSourceId, setup.umpireId, source.sourceId, key]));
          const view = pose ? { position: pose.position, forward: pose.forward, velocity: { x: 0, y: 0, z: 0 } } : null;
          // First-base control is a composite condition. Seeing a glove never grants
          // knowledge of the separate foot/base contact. This is a detection gate,
          // not a new calibrated timing-fusion or correctness-rate law.
          let baseDetected = true;
          if (view && setup.calibration && setup.attention) {
            const calibration = setup.calibration;
            const quality = composeObservationQuality({ ...evaluateObservationGeometry(view, controlBaseCue.target, calibration.geometryParameters),
              occlusionVisibility: estimateOcclusionVisibility(view.position, controlBaseCue.target.position, controlBaseCue.occluders),
              attentionQuality: setup.attention.control, observationDurationSeconds: 0, perceptionAbility: calibration.perceptionAbility }, calibration.qualityParameters);
            baseDetected = quality.visibilityQuality > 0 && quality.totalQuality >= calibration.timingErrorParameters.minimumDetectionQuality;
          }
          perception = !baseDetected ? { kind: 'undetectable', cue: 'control' }
            : perceiveFirstBasePlay({ clock, observedAtElapsedSeconds: availability.elapsedSeconds,
              calibration: setup.calibration, view, attention: setup.attention, events }, { control: stream('control'), touch: stream('touch') });
        }
      }
    }
  }
  return freeze(cloneInert({ source, setup, gameId: frame.gameId, physicalPitchSourceId: setup.physicalPitchSourceId,
    playId: frame.match.playId, batterRunnerId: ball.batterRunnerId, outsAtStart: frame.match.outs, clock, availability,
    ruleEvidenceRevision: race.revision, ruleEvidenceHash: hash(race), physicalPrefixHash: hash(physical), perception, eventEvidence }));
};

export const deriveActualFirstBaseUmpireCall = (source: AcceptedActualFirstBaseUmpireCall,
  observation: DurableActualFirstBaseUmpireObservation, current: DurableBattedWorldFieldExecution, prefix: Prefix): DurableActualFirstBaseUmpireCall => {
  const physical = battedWorldFieldPhysicalPrefix({ ...prefix, custodyPolicy: 'release_exclusive_v1' }), ball = physical.field.evidence;
  if (!current.history.some(value => value.sourceId === observation.source.ruleExecutionSourceId)
    || current.baseField.source.sourceId !== prefix.baseField.source.sourceId
    || current.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId !== observation.physicalPitchSourceId
    || ball.originTick !== observation.clock.originTick || ball.ticksPerSecond !== observation.clock.ticksPerSecond
    || ball.horizon.elapsedSeconds < observation.availability.elapsedSeconds) throw new Error('actual umpire call original prefix or chronology differs');
  const advancedThrough = { originTick: ball.originTick, elapsedSeconds: ball.horizon.elapsedSeconds, tick: ball.horizon.ball.tick };
  const schedule: FirstBaseCallSchedule = observation.setup.calibration === null ? { kind: 'pending', reason: 'calibration_unavailable' }
    : resolveFirstBaseCallSchedule(observation.perception, observation.setup.calibration, observation.clock, advancedThrough.elapsedSeconds);
  const onFieldCall = schedule.kind !== 'called' ? null : { callId: source.sourceId, tick: schedule.tick,
    basisSnapshotId: `actual_first_base_rule:${observation.source.ruleExecutionSourceId}`, basisEvidenceRevision: observation.ruleEvidenceRevision,
    ruling: { outsAfter: observation.outsAtStart + (schedule.call === 'out' ? 1 : 0),
      basesAfter: { first: schedule.call === 'safe' ? observation.batterRunnerId : null, second: null, third: null }, scoredRunnerIds: [] } };
  return freeze(cloneInert({ source, observation, currentExecutionHash: hash(current), advancedThrough, schedule, onFieldCall })) as DurableActualFirstBaseUmpireCall;
};

/** Pure projection only; production readers authenticate the call through its Native owner first. */
export const actualFirstBaseOffensiveDisposition = (call: DurableActualFirstBaseUmpireCall | null): ActualFirstBaseOffensiveDisposition => {
  if (!call || call.schedule.kind !== 'called' || call.onFieldCall === null) return freeze({ kind: 'pending', reason: 'operative_call_unavailable' });
  if (call.schedule.call === 'safe') return freeze({ kind: 'active', runnerId: call.observation.batterRunnerId, causeCallSourceId: call.source.sourceId });
  return freeze({ kind: 'retired', runnerId: call.observation.batterRunnerId, causeCallSourceId: call.source.sourceId,
    at: { originTick: call.observation.clock.originTick, elapsedSeconds: call.schedule.calledAtElapsedSeconds,
      tick: quantizeEventTick(call.observation.clock.originTick, call.schedule.calledAtElapsedSeconds, call.observation.clock.ticksPerSecond) } });
};
