import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { sampleBatterSwingState } from '../../core/sim/contact/BatBallContact';
import { projectDefenderBodyKinematicsSegment, sampleDefenderBodyKinematicsSegment } from '../../core/sim/fielding/DefenderBodyKinematics';
import { composeDefenderPhysicalPrimitiveSegment, type DefenderPhysicalPrimitiveRole } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import type { BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import type { AcceptedBattedWorldMotion } from './SqliteBattedWorldMotionStore';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Prefix = Parameters<typeof battedWorldFieldPhysicalPrefix>[0];
type Moment = Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>;
type State = { position: Vec3; velocity: Vec3; acceleration: Vec3 };
type Command = AcceptedBattedWorldMotion['commands'][number];
export type ActualPlayerCommandAdoption = Readonly<{
  kind: 'contact' | 'field' | 'motion' | 'motion_checkpoint_v1' | 'throw' | 'throw_advance';
  owner: 'batted_world_contacts' | 'batted_world_field_actions' | 'batted_world_field_executions';
  sourceId: string; sourceVersion: string; sourceHash: string; adoptionSourceId: string; adoptionSourceHash: string;
  adoptedAt: Moment; executedThrough: Moment; acceptedThroughTick: number;
}>;
export type ActualPlayerKinematics = Readonly<{
  playerId: string; personId: string; personLinkSourceId: string; gameId: string; gameDay: number;
  physicalPitchSourceId: string; modelSourceId: string; modelSourceVersion: string;
  at: Moment; ticksPerSecond: number;
  origin: Readonly<{ kind: 'defender_world_projection' | 'batter_swing_grip'; contactSourceId: string; at: Moment }>;
  root: Readonly<State>;
  roles: readonly Readonly<{ role: DefenderPhysicalPrimitiveRole; radiusMeters: number; offset: Vec3;
    relativeVelocity: Vec3; relativeAcceleration: Vec3;
    declaredPose: Readonly<{ offset: Vec3; relativeVelocity: Vec3; relativeAcceleration: Vec3 }>;
    // Exact correction introduced by the original Core composition's <=1e-12 cleanup.
    // This does not redefine the root/relative state or replace the canonical primitive.
    canonicalRoundingResidual: Readonly<State>; canonicalActor: BallWorldMotionActor }>[];
  activeCommand: ActualPlayerCommandAdoption; adoptions: readonly ActualPlayerCommandAdoption[];
}>;
const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
const axes = ['x', 'y', 'z'] as const;
const vector = (f: (axis: keyof Vec3) => number): Vec3 => {
  const value = { x: f('x'), y: f('y'), z: f('z') };
  if (!Object.values(value).every(Number.isFinite)) throw new Error('actual Player kinematics arithmetic overflow');
  return value;
};
const zero = () => ({ x: 0, y: 0, z: 0 });
const sameNumber = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;
const advance = (s: State, dt: number): State => ({
  position: vector((axis) => s.position[axis] + s.velocity[axis] * dt + 0.5 * s.acceleration[axis] * dt * dt),
  velocity: vector((axis) => s.velocity[axis] + s.acceleration[axis] * dt), acceleration: s.acceleration,
});

/** Internal derivation over a complete, own-reader validated prefix. No future sampling or physical writes. */
export const actualPlayerKinematicsFromPrefix = (playerId: string, prefix: Prefix): ActualPlayerKinematics => {
  const physical = battedWorldFieldPhysicalPrefix(prefix), world = prefix.baseField.response.touch.worldContact;
  const flight = world.flight, frame = flight.physicalPitch.frame, tps = flight.source.execution.ballFlightParameters.ticksPerSecond;
  const at = flight.flight.contact.tick;
  const actor = world.modelActorEvidence.find((a) => a.binding.playerId === playerId);
  const model = world.model.actors.find((a) => a.playerId === playerId), original = world.source.commands.find((c) => c.playerId === playerId);
  if (!actor || !model || !original || !world.actors.some((a) => a.playerId === playerId)
    || actor.binding.personId !== model.personId) throw new Error('actual Player kinematics Player/Person scope differs');
  const moment = (elapsedSeconds: number): Moment => ({ originTick: at, elapsedSeconds, tick: quantizeEventTick(at, elapsedSeconds, tps) });
  const batter = frame.batterActor!.binding.playerId === playerId;
  let root: State;
  if (batter) {
    const action = flight.physicalPitch.source.request.batter.action;
    if (action.kind !== 'swing') throw new Error('actual Player kinematics swing is missing');
    const swing = sampleBatterSwingState(action.swing.stateAtStart, at - action.swing.startTick, action.swing.ticksPerSecond);
    root = { position: vector((axis) => swing.pose.grip[axis] - world.model.batterGripOffset[axis]),
      velocity: swing.linearVelocity, acceleration: original.bodyAcceleration };
  } else {
    const defender = frame.world.defenders.find((d) => d.playerId === playerId);
    if (!defender || original.bodyAcceleration.y !== 0) throw new Error('actual Player kinematics defender basis differs');
    const body = projectDefenderBodyKinematicsSegment({ startTick: frame.world.tick, endTick: at, ticksPerSecond: tps,
      startPosition: defender.position, startVelocity: defender.velocity,
      acceleration: { x: original.bodyAcceleration.x, z: original.bodyAcceleration.z }, target: null }, model.bodyOriginHeightMeters);
    const sample = sampleDefenderBodyKinematicsSegment(body, at);
    root = { position: sample.position, velocity: sample.velocity, acceleration: sample.acceleration };
  }
  const relative = roles.map((role) => {
    const shape = model.primitives.find((p) => p.role === role), motion = original.primitiveMotions.find((p) => p.role === role);
    const originals = world.actors.filter((a) => a.playerId === playerId && a.primitive.role === role);
    if (!shape || !motion || originals.length !== 1) throw new Error('actual Player kinematics original role coverage differs');
    const canonical = originals[0].primitive;
    const state = { position: shape.offset, velocity: motion.offsetVelocity, acceleration: motion.offsetAcceleration };
    const composed = composeDefenderPhysicalPrimitiveSegment({ startTick: at, endTick: at + flight.source.searchDurationTicks,
      ticksPerSecond: tps, startPosition: root.position, startVelocity: root.velocity, acceleration: root.acceleration }, {
      role, radius: shape.radius, startTick: at, endTick: at + flight.source.searchDurationTicks, ticksPerSecond: tps,
      startOffset: state.position, offsetVelocity: state.velocity, offsetAcceleration: state.acceleration });
    if (json(composed) !== json(canonical)) throw new Error('actual Player kinematics original canonical composition differs');
    const residual: State = {
      position: vector((axis) => composed.startCenter[axis] - (root.position[axis] + state.position[axis])),
      velocity: vector((axis) => composed.startVelocity[axis] - (root.velocity[axis] + state.velocity[axis])),
      acceleration: vector((axis) => composed.acceleration[axis] - (root.acceleration[axis] + state.acceleration[axis])),
    };
    return { role, radius: shape.radius, state, residual };
  });
  type Adoption = Omit<ActualPlayerCommandAdoption, 'executedThrough'> & { executedThrough: Moment };
  const adoptions: Adoption[] = [{ kind: 'contact', owner: 'batted_world_contacts', sourceId: world.source.sourceId,
    sourceVersion: world.source.sourceVersion, sourceHash: hash(world.source), adoptionSourceId: world.source.sourceId,
    adoptionSourceHash: hash(world.source), adoptedAt: moment(0), executedThrough: moment(0), acceptedThroughTick: at + flight.source.searchDurationTicks }];
  type Event = { command: Command | null; adoption: Omit<ActualPlayerCommandAdoption, 'adoptedAt' | 'executedThrough'> | null };
  const events: Event[] = [{ command: null, adoption: null }];
  const commandEvent = (kind: ActualPlayerCommandAdoption['kind'], owner: ActualPlayerCommandAdoption['owner'],
    source: { sourceId: string; sourceVersion: string }, throughTick: number, commands: AcceptedBattedWorldMotion['commands'], adoptionSource = source): Event => {
    const matches = commands.filter((c) => c.playerId === playerId);
    if (matches.length !== 1 || matches[0].primitiveMotions.length !== roles.length
      || new Set(matches[0].primitiveMotions.map((p) => p.role)).size !== roles.length
      || matches[0].primitiveMotions.some((p) => !roles.includes(p.role))
      || !batter && matches[0].bodyAcceleration.y !== 0) throw new Error('actual Player kinematics command coverage differs');
    return { command: matches[0], adoption: { kind, owner, sourceId: source.sourceId, sourceVersion: source.sourceVersion,
      sourceHash: hash(source), adoptionSourceId: adoptionSource.sourceId, adoptionSourceHash: hash(adoptionSource), acceptedThroughTick: throughTick } };
  };
  for (const field of prefix.fields) events.push(commandEvent('field', 'batted_world_field_actions', field.source, field.source.throughTick, field.source.commands));
  const adoptedPlans = new Set<string>();
  for (const value of prefix.executions) {
    const action = value.source.action;
    if (action.kind === 'motion' || action.kind === 'throw') {
      events.push(commandEvent(action.kind, 'batted_world_field_executions', value.source, action.throughTick, action.commands));
    } else if (action.kind === 'motion_checkpoint_v1') {
      events.push(commandEvent(action.kind, 'batted_world_field_executions', value.source, action.coverageThroughTick, action.commands));
    } else if (action.kind === 'throw_advance') {
      const planned = prefix.executions.find((v) => v.source.sourceId === action.planSourceId);
      if (!planned || planned.source.action.kind !== 'throw_plan') throw new Error('actual Player kinematics throw adoption lacks its plan');
      events.push(adoptedPlans.has(action.planSourceId) ? { command: null, adoption: null }
        : commandEvent('throw_advance', 'batted_world_field_executions', planned.source, planned.source.action.throughTick, planned.source.action.commands, value.source));
      adoptedPlans.add(action.planSourceId);
    } else if (action.kind === 'acquisition' || action.kind === 'acquisition_advance' || action.kind === 'retained_motion_checkpoint_v1') events.push({ command: null, adoption: null });
    // Both plans and all three observation Sources add no actual segment/adoption.
  }
  if (events.length !== physical.segments.length) throw new Error('actual Player kinematics execution segment classification differs');
  let elapsed = 0, commandStart = 0;
  let rootAnchor = root, poseAnchors = relative.map((p) => ({ state: p.state, residual: p.residual }));
  let canonicalActors: readonly BallWorldMotionActor[] = [];
  const reconcile = (actors: readonly BallWorldMotionActor[], atElapsed: number) => {
    const self = actors.filter((a) => a.playerId === playerId);
    if (self.length !== roles.length || new Set(self.map((a) => a.primitive.role)).size !== roles.length) {
      throw new Error('actual Player kinematics canonical role coverage differs');
    }
    for (const pose of relative) {
      const canonical = self.find((a) => a.primitive.role === pose.role);
      if (!canonical) throw new Error('actual Player kinematics canonical role is missing');
      const p = canonical.primitive, start = (p.startTick - at) / tps + (canonical.startElapsedSeconds ?? 0);
      const dt = atElapsed - start;
      if (p.ticksPerSecond !== tps || p.radius !== pose.radius || !Number.isFinite(dt) || dt < 0
        || p.endTick !== adoptions.at(-1)!.acceptedThroughTick || atElapsed > (p.endTick - at) / tps) {
        throw new Error('actual Player kinematics canonical clock or coverage differs');
      }
      const sampled: State = { position: vector((axis) => p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt),
        velocity: vector((axis) => p.startVelocity[axis] + p.acceleration[axis] * dt), acceleration: p.acceleration };
      for (const part of ['position', 'velocity', 'acceleration'] as const) for (const axis of axes) {
        if (!sameNumber(root[part][axis] + pose.state[part][axis] + pose.residual[part][axis], sampled[part][axis])) {
          throw new Error('actual Player kinematics canonical decomposition differs');
        }
      }
    }
    canonicalActors = self;
  };
  for (const [index, segment] of physical.segments.entries()) {
    if (segment.originTick !== at || segment.startElapsedSeconds !== elapsed || segment.endElapsedSeconds < elapsed) {
      throw new Error('actual Player kinematics executed interval differs');
    }
    const event = events[index];
    if (event.command && event.adoption) {
      root = { ...root, acceleration: event.command.bodyAcceleration };
      for (const pose of relative) {
        pose.state = { ...pose.state, acceleration: event.command.primitiveMotions.find((p) => p.role === pose.role)!.offsetAcceleration };
        pose.residual = { ...pose.residual, acceleration: zero() };
      }
      adoptions.push({ ...event.adoption, adoptedAt: moment(elapsed), executedThrough: moment(elapsed) });
      commandStart = elapsed; rootAnchor = root;
      poseAnchors = relative.map((p) => ({ state: p.state, residual: p.residual }));
    }
    reconcile(segment.actors, elapsed);
    // A checkpoint retains the original command curve; it must not introduce incremental-integration rounding.
    const dt = segment.endElapsedSeconds - commandStart;
    root = advance(rootAnchor, dt);
    for (const [i, pose] of relative.entries()) {
      pose.state = advance(poseAnchors[i].state, dt); pose.residual = advance(poseAnchors[i].residual, dt);
    }
    elapsed = segment.endElapsedSeconds;
    reconcile(segment.actors, elapsed);
    adoptions.at(-1)!.executedThrough = moment(elapsed);
  }
  if (elapsed !== physical.field.evidence.horizon.elapsedSeconds) throw new Error('actual Player kinematics cut horizon differs');
  // cloneInert also rejects any nonfinite nested arithmetic before returning self state.
  return freeze(cloneInert({ playerId, personId: actor.binding.personId, personLinkSourceId: actor.binding.personLinkSourceId,
    gameId: actor.binding.gameId, gameDay: actor.binding.gameDay, physicalPitchSourceId: flight.source.physicalPitchSourceId,
    modelSourceId: world.model.sourceId, modelSourceVersion: world.model.sourceVersion, at: moment(elapsed), ticksPerSecond: tps,
    origin: { kind: batter ? 'batter_swing_grip' as const : 'defender_world_projection' as const, contactSourceId: world.source.sourceId, at: moment(0) },
    root, roles: relative.map((p) => ({ role: p.role, radiusMeters: p.radius,
      offset: vector((axis) => p.state.position[axis] + p.residual.position[axis]),
      relativeVelocity: vector((axis) => p.state.velocity[axis] + p.residual.velocity[axis]),
      relativeAcceleration: vector((axis) => p.state.acceleration[axis] + p.residual.acceleration[axis]),
      declaredPose: { offset: p.state.position, relativeVelocity: p.state.velocity, relativeAcceleration: p.state.acceleration },
      canonicalRoundingResidual: p.residual,
      canonicalActor: canonicalActors.find((a) => a.primitive.role === p.role)! })), activeCommand: adoptions.at(-1)!, adoptions }));
};
