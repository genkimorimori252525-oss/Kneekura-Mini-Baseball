import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import type { BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import { actualPlayerKinematicsFromOriginalContact, type ActualOriginalContactPlayerKinematics } from './ActualPlayerKinematicsFromOriginalContact';
import { ownedRunnerFieldPiecesPhysicalPrefix, type OwnedRunnerFieldPiecesPhysicalPrefix } from './OwnedRunnerFieldPiecesPhysicalPrefix';
import { sampleRunnerRoute } from '../../core/sim/running/RunnerRoute';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type State = ActualOriginalContactPlayerKinematics['root'];
export type ActualRunnerFieldPiecesKinematics = Omit<ActualOriginalContactPlayerKinematics, 'version' | 'authority' | 'physicalPrefix'> & Readonly<{
  version: 'owned_runner_field_pieces_kinematics_v1';
  authority: Readonly<{ owner: 'physical_pitch_progress_actions' | 'batted_world_field_actions'; sourceId: string; sourceVersion: string; sourceHash: string;
    runnerSourceId?: string; runnerSourceHash?: string; motionRevision?: number; acceptedThroughTick: number }>;
  execution: Readonly<{ owner: 'batted_world_field_actions'; sourceId: string; revision: number; sourceHash: string; snapshotHash: string;
    executedThrough: ActualOriginalContactPlayerKinematics['at'] }>;
  physicalPrefix: OwnedRunnerFieldPiecesPhysicalPrefix;
}>;
const axes = ['x', 'y', 'z'] as const;
const vector = (f: (axis: keyof Vec3) => number): Vec3 => {
  const value = { x: f('x'), y: f('y'), z: f('z') };
  if (!Object.values(value).every(Number.isFinite)) throw new Error('owned runner field kinematics arithmetic overflow');
  return value;
};
const advance = (state: State, dt: number): State => ({
  position: vector(axis => state.position[axis] + state.velocity[axis] * dt + 0.5 * state.acceleration[axis] * dt * dt),
  velocity: vector(axis => state.velocity[axis] + state.acceleration[axis] * dt), acceleration: state.acceleration,
});
const sameNumber = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;

/** Reads the actual field endpoint from original decomposition and accepted commands.
 * It cannot choose a future sample time, issue a runner command or execute motion. */
export const actualPlayerKinematicsFromRunnerFieldPieces = (playerId: string,
  fields: readonly DurableBattedWorldFieldAction[]): ActualRunnerFieldPiecesKinematics => {
  const physical = ownedRunnerFieldPiecesPhysicalPrefix(fields), last = fields.at(-1)!, world = fields[0].response.touch.worldContact;
  const original = actualPlayerKinematicsFromOriginalContact(playerId, world), runner = original.origin.kind === 'pre_pitch_runner_controller';
  const tps = original.ticksPerSecond, originTick = original.at.originTick;
  let root = original.root, rootAnchor = root, commandStart = 0;
  const relative = original.roles.map(role => ({ role: role.role, radius: role.radiusMeters,
    state: { position: role.declaredPose.offset, velocity: role.declaredPose.relativeVelocity, acceleration: role.declaredPose.relativeAcceleration },
    residual: role.canonicalRoundingResidual }));
  let poseAnchors = relative.map(pose => ({ state: pose.state, residual: pose.residual }));
  let canonicalActors: readonly BallWorldMotionActor[] = original.roles.map(role => role.canonicalActor);
  const reconcile = (actors: readonly BallWorldMotionActor[], elapsed: number, throughTick: number) => {
    const self = actors.filter(actor => actor.playerId === playerId);
    if (self.length !== relative.length || new Set(self.map(actor => actor.primitive.role)).size !== relative.length) {
      throw new Error('owned runner field kinematics canonical role coverage differs');
    }
    for (const pose of relative) {
      const actor = self.find(actor => actor.primitive.role === pose.role);
      if (!actor) throw new Error('owned runner field kinematics canonical role is missing');
      const p = actor.primitive, dt = (originTick - p.startTick) / tps + elapsed - (actor.startElapsedSeconds ?? 0);
      if (p.ticksPerSecond !== tps || p.radius !== pose.radius || p.endTick > throughTick || !Number.isFinite(dt) || dt < 0
        || elapsed > (p.endTick - originTick) / tps) throw new Error('owned runner field kinematics canonical coverage differs');
      const actual: State = { position: vector(axis => p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt),
        velocity: vector(axis => p.startVelocity[axis] + p.acceleration[axis] * dt), acceleration: p.acceleration };
      for (const part of ['position', 'velocity', 'acceleration'] as const) for (const axis of axes) {
        if (!sameNumber(root[part][axis] + pose.state[part][axis] + pose.residual[part][axis], actual[part][axis])) {
          throw new Error('owned runner field canonical kinematics decomposition differs');
        }
      }
    }
    canonicalActors = self;
  };
  const runnerFrame = world.flight.physicalPitch.frame.prePitchRunner!;
  const tangent = sampleRunnerRoute(runnerFrame.source.route, runnerFrame.source.startMotion.routeDistanceMeters).tangent;
  for (const field of fields) {
    const segments = physical.segments.filter(segment => segment.execution.owner === 'batted_world_field_actions'
      && segment.execution.sourceId === field.source.sourceId);
    for (const [intervalIndex, segment] of segments.entries()) {
      let changedAnchor = false;
      if (!runner && intervalIndex === 0) {
        const commands = field.source.commands.filter(command => command.playerId === playerId), command = commands[0];
        if (commands.length !== 1 || command.primitiveMotions.length !== relative.length
          || new Set(command.primitiveMotions.map(part => part.role)).size !== relative.length) {
          throw new Error('retained runner field kinematics command coverage differs');
        }
        root = { ...root, acceleration: command.bodyAcceleration };
        for (const pose of relative) {
          const part = command.primitiveMotions.find(part => part.role === pose.role);
          if (!part) throw new Error('retained runner field kinematics relative command is missing');
          pose.state = { ...pose.state, acceleration: part.offsetAcceleration };
          pose.residual = { ...pose.residual, acceleration: { x: 0, y: 0, z: 0 } };
        }
        changedAnchor = true;
      } else if (runner && segment.execution.pieceOrdinal !== null) {
        const piece = field.pieceExecution!.pieces[segment.execution.pieceOrdinal];
        const phase = runnerFrame.controller.trajectory.segments[piece.controllerSegmentIndex];
        const acceleration = { x: tangent.x * phase.accelerationMps2, y: 0, z: tangent.z * phase.accelerationMps2 };
        // Only a recorded physical piece can expose its original controller phase.
        if (axes.some(axis => acceleration[axis] !== root.acceleration[axis])) {
          root = { ...root, acceleration };
          for (const pose of relative) {
            const actor = segment.actors.find(actor => actor.playerId === playerId && actor.primitive.role === pose.role)!;
            pose.residual = { ...pose.residual, acceleration: vector(axis => actor.primitive.acceleration[axis]
              - (root.acceleration[axis] + pose.state.acceleration[axis])) };
          }
          changedAnchor = true;
        }
      }
      if (changedAnchor) {
        rootAnchor = root; commandStart = segment.startElapsedSeconds;
        poseAnchors = relative.map(pose => ({ state: pose.state, residual: pose.residual }));
      }
      reconcile(segment.actors, segment.startElapsedSeconds, field.source.throughTick);
      // Row boundaries never renew the runner. Internal runner phases never
      // re-adopt the ten other players' root or relative commands.
      const dt = segment.endElapsedSeconds - commandStart;
      root = advance(rootAnchor, dt);
      for (const [index, pose] of relative.entries()) {
        pose.state = advance(poseAnchors[index].state, dt); pose.residual = advance(poseAnchors[index].residual, dt);
      }
      reconcile(segment.actors, segment.endElapsedSeconds, field.source.throughTick);
    }
  }
  const authority: ActualRunnerFieldPiecesKinematics['authority'] = runner
    ? { ...original.authority, owner: 'physical_pitch_progress_actions', motionRevision: world.flight.physicalPitch.frame.prePitchRunner!.source.motionRevision }
    : { owner: 'batted_world_field_actions', sourceId: last.source.sourceId, sourceVersion: last.source.sourceVersion,
      sourceHash: hash(last.source), acceptedThroughTick: last.source.throughTick };
  return freeze(cloneInert({ ...original, version: 'owned_runner_field_pieces_kinematics_v1' as const, at: physical.at, root,
    roles: relative.map(pose => ({ role: pose.role, radiusMeters: pose.radius,
      offset: vector(axis => pose.state.position[axis] + pose.residual.position[axis]),
      relativeVelocity: vector(axis => pose.state.velocity[axis] + pose.residual.velocity[axis]),
      relativeAcceleration: vector(axis => pose.state.acceleration[axis] + pose.residual.acceleration[axis]),
      declaredPose: { offset: pose.state.position, relativeVelocity: pose.state.velocity, relativeAcceleration: pose.state.acceleration },
      canonicalRoundingResidual: pose.residual, canonicalActor: canonicalActors.find(actor => actor.primitive.role === pose.role)! })),
    authority, execution: { owner: 'batted_world_field_actions' as const, sourceId: last.source.sourceId, revision: last.revision,
      sourceHash: hash(last.source), snapshotHash: hash(last), executedThrough: physical.at }, physicalPrefix: physical }));
};
