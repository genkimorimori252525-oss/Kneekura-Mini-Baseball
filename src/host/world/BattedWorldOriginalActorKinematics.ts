import type { Vec3 } from '../../core/model/geometry';
import { sampleBatterSwingState } from '../../core/sim/contact/BatBallContact';
import { projectDefenderBodyKinematicsSegment, sampleDefenderBodyKinematicsSegment, type DefenderBodyKinematicsSegment } from '../../core/sim/fielding/DefenderBodyKinematics';
import { composeDefenderPhysicalPrimitiveSegment, type DefenderPosePrimitiveSegment } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import { sampleRouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import { sampleRunnerRoute } from '../../core/sim/running/RunnerRoute';
import { prePitchRunnerContactPrimitives } from './PrePitchRunnerExecution';
import type { DurableBattedWorldContact } from './SqliteBattedWorldContactStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Original-source decomposition only. This function cannot choose a later command or execution horizon. */
export const originalBattedWorldActorKinematics = (world: DurableBattedWorldContact, playerId: string) => {
  const flight = world.flight, frame = flight.physicalPitch.frame, at = flight.flight.contact.tick;
  const throughTick = at + flight.source.searchDurationTicks, tps = flight.source.execution.ballFlightParameters.ticksPerSecond;
  const model = world.model.actors.find(a => a.playerId === playerId), runner = frame.prePitchRunner;
  if (!model) throw new Error('original contact actor model is missing');
  let body: DefenderBodyKinematicsSegment;
  let poses: DefenderPosePrimitiveSegment[];
  let origin: 'batter_swing_grip' | 'defender_world_projection' | 'pre_pitch_runner_controller';
  if (runner?.binding.playerId === playerId) {
    // This also authenticates exact model pose, interval coverage and the analytic boundary.
    const originals = prePitchRunnerContactPrimitives(runner.source, runner.canonical, runner.controller,
      model.primitives, model.bodyOriginHeightMeters, at, throughTick, tps);
    const elapsed = (at - frame.world.tick) / tps;
    const segment = [...runner.controller.trajectory.segments].reverse().find(s => s.startElapsedSeconds <= elapsed && elapsed <= s.endElapsedSeconds)!;
    const root = sampleRouteFollowingController(runner.controller, runner.canonical, at);
    const tangent = sampleRunnerRoute(runner.source.route, runner.source.startMotion.routeDistanceMeters).tangent;
    body = { startTick: at, endTick: throughTick, ticksPerSecond: tps,
      startPosition: { x: root.position.x, y: model.bodyOriginHeightMeters, z: root.position.z },
      startVelocity: { x: root.velocity.x, y: 0, z: root.velocity.z },
      acceleration: { x: tangent.x * segment.accelerationMps2, y: 0, z: tangent.z * segment.accelerationMps2 } };
    const vector = (f: (axis: keyof Vec3) => number): Vec3 => ({ x: f('x'), y: f('y'), z: f('z') });
    poses = model.primitives.map(shape => {
      const motion = runner.source.bodyPose.primitiveMotions.find(p => p.role === shape.role)!;
      return { role: shape.role, radius: shape.radius, startTick: at, endTick: throughTick, ticksPerSecond: tps,
        startOffset: vector(axis => motion.startOffset[axis] + motion.offsetVelocity[axis] * elapsed + 0.5 * motion.offsetAcceleration[axis] * elapsed * elapsed),
        offsetVelocity: vector(axis => motion.offsetVelocity[axis] + motion.offsetAcceleration[axis] * elapsed), offsetAcceleration: motion.offsetAcceleration };
    });
    if (json(originals.map(a => a.primitive)) !== json(poses.map(p => composeDefenderPhysicalPrimitiveSegment(body, p)))) {
      throw new Error('original runner canonical decomposition differs');
    }
    origin = 'pre_pitch_runner_controller';
  } else {
    const command = world.source.commands.find(c => c.playerId === playerId);
    if (!command) throw new Error('original contact actor command is missing');
    if (frame.batterActor?.binding.playerId === playerId) {
      const action = flight.physicalPitch.source.request.batter.action;
      if (action.kind !== 'swing') throw new Error('original contact batter swing is missing');
      const swing = sampleBatterSwingState(action.swing.stateAtStart, at - action.swing.startTick, action.swing.ticksPerSecond);
      body = { startTick: at, endTick: throughTick, ticksPerSecond: tps,
        startPosition: { x: swing.pose.grip.x - world.model.batterGripOffset.x, y: swing.pose.grip.y - world.model.batterGripOffset.y, z: swing.pose.grip.z - world.model.batterGripOffset.z },
        startVelocity: swing.linearVelocity, acceleration: command.bodyAcceleration };
      origin = 'batter_swing_grip';
    } else {
      const d = frame.world.defenders.find(d => d.playerId === playerId);
      if (!d || command.bodyAcceleration.y !== 0) throw new Error('original contact defender World basis differs');
      const original = projectDefenderBodyKinematicsSegment({ startTick: frame.world.tick, endTick: throughTick, ticksPerSecond: tps,
        startPosition: d.position, startVelocity: d.velocity, acceleration: { x: command.bodyAcceleration.x, z: command.bodyAcceleration.z }, target: null }, model.bodyOriginHeightMeters);
      const sample = sampleDefenderBodyKinematicsSegment(original, at);
      body = { startTick: at, endTick: throughTick, ticksPerSecond: tps, startPosition: sample.position, startVelocity: sample.velocity, acceleration: sample.acceleration };
      origin = 'defender_world_projection';
    }
    poses = model.primitives.map(shape => {
      const motion = command.primitiveMotions.find(p => p.role === shape.role);
      if (!motion) throw new Error('original contact primitive command is missing');
      return { role: shape.role, radius: shape.radius, startTick: at, endTick: throughTick, ticksPerSecond: tps,
        startOffset: shape.offset, offsetVelocity: motion.offsetVelocity, offsetAcceleration: motion.offsetAcceleration };
    });
  }
  return { origin, body, poses, primitives: poses.map(p => ({ playerId, primitive: composeDefenderPhysicalPrimitiveSegment(body, p) })) };
};
