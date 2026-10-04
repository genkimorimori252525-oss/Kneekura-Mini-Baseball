import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { sampleDefenderPhysicalPrimitiveSegment } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import type { ActualPlayerKinematics } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldOriginalContactPrefix, type BattedWorldOriginalContactPrefix, type OriginalContactActorAuthority } from './BattedWorldOriginalContactPrefix';
import { originalBattedWorldActorKinematics } from './BattedWorldOriginalActorKinematics';
import type { DurableBattedWorldContact } from './SqliteBattedWorldContactStore';
import { actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Intentionally distinct from the field/adoption contract: an observed original contact cannot issue a motor command. */
export type ActualOriginalContactPlayerKinematics = Omit<ActualPlayerKinematics, 'origin' | 'activeCommand' | 'adoptions' | 'ownedMotionCoverage'> & Readonly<{
  version: 'owned_runner_original_contact_kinematics_v1';
  origin: Readonly<{ kind: 'defender_world_projection' | 'batter_swing_grip' | 'pre_pitch_runner_controller'; contactSourceId: string;
    physicalPitchSourceId: string; runnerSourceId?: string; runnerSourceHash?: string; at: ActualPlayerKinematics['at'] }>;
  authority: OriginalContactActorAuthority; physicalPrefix: BattedWorldOriginalContactPrefix;
}>;
const vector = (f: (axis: keyof Vec3) => number): Vec3 => ({ x: f('x'), y: f('y'), z: f('z') });

/** Samples only the executed original contact endpoint. There is deliberately no caller-supplied sample time. */
export const actualPlayerKinematicsFromOriginalContact = (playerId: string, raw: DurableBattedWorldContact): ActualOriginalContactPlayerKinematics => {
  const world = cloneInert(raw), prefix = battedWorldOriginalContactPrefix(world), participant = prefix.participants.find(p => p.playerId === playerId);
  if (!participant) throw new Error('original contact kinematics player is outside the owned prefix');
  const basis = originalBattedWorldActorKinematics(world, playerId), dt = prefix.at.elapsedSeconds;
  // Preserve the root/relative decomposition; primitive cleanup is a separate canonical residual, not a root rebase.
  const root = { position: vector(axis => basis.body.startPosition[axis] + basis.body.startVelocity[axis] * dt + 0.5 * basis.body.acceleration[axis] * dt * dt),
    velocity: vector(axis => basis.body.startVelocity[axis] + basis.body.acceleration[axis] * dt), acceleration: basis.body.acceleration };
  const roles = basis.poses.map(pose => {
    const canonicalActor = world.actors.find(a => a.playerId === playerId && a.primitive.role === pose.role)!;
    const first = sampleDefenderPhysicalPrimitiveSegment(canonicalActor.primitive, basis.body.startTick);
    const initialResidual = {
      position: vector(axis => first.center[axis] - (basis.body.startPosition[axis] + pose.startOffset[axis])),
      velocity: vector(axis => first.velocity[axis] - (basis.body.startVelocity[axis] + pose.offsetVelocity[axis])),
      acceleration: vector(axis => first.acceleration[axis] - (basis.body.acceleration[axis] + pose.offsetAcceleration[axis])),
    };
    const declaredPose = { offset: vector(axis => pose.startOffset[axis] + pose.offsetVelocity[axis] * dt + 0.5 * pose.offsetAcceleration[axis] * dt * dt),
      relativeVelocity: vector(axis => pose.offsetVelocity[axis] + pose.offsetAcceleration[axis] * dt), relativeAcceleration: pose.offsetAcceleration };
    const residual = { position: vector(axis => initialResidual.position[axis] + initialResidual.velocity[axis] * dt + 0.5 * initialResidual.acceleration[axis] * dt * dt),
      velocity: vector(axis => initialResidual.velocity[axis] + initialResidual.acceleration[axis] * dt), acceleration: initialResidual.acceleration };
    const primitive = canonicalActor.primitive;
    const physical = { position: vector(axis => primitive.startCenter[axis] + primitive.startVelocity[axis] * dt + 0.5 * primitive.acceleration[axis] * dt * dt),
      velocity: vector(axis => primitive.startVelocity[axis] + primitive.acceleration[axis] * dt), acceleration: primitive.acceleration };
    for (const axis of ['x', 'y', 'z'] as const) for (const [rootPart, relative, remainder, actual] of [
      [root.position[axis], declaredPose.offset[axis], residual.position[axis], physical.position[axis]],
      [root.velocity[axis], declaredPose.relativeVelocity[axis], residual.velocity[axis], physical.velocity[axis]],
      [root.acceleration[axis], declaredPose.relativeAcceleration[axis], residual.acceleration[axis], physical.acceleration[axis]],
    ]) {
      const value = rootPart + relative + remainder;
      if (!Number.isFinite(value) || !Number.isFinite(actual)
        || Math.abs(value - actual) > Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(actual)) * 32) {
        throw new Error('original contact canonical kinematics decomposition differs');
      }
    }
    return { role: pose.role, radiusMeters: pose.radius, offset: vector(axis => declaredPose.offset[axis] + residual.position[axis]),
      relativeVelocity: vector(axis => declaredPose.relativeVelocity[axis] + residual.velocity[axis]),
      relativeAcceleration: vector(axis => declaredPose.relativeAcceleration[axis] + residual.acceleration[axis]),
      declaredPose, canonicalRoundingResidual: residual, canonicalActor };
  });
  const frame = world.flight.physicalPitch.frame, runner = basis.origin === 'pre_pitch_runner_controller' ? frame.prePitchRunner : null;
  const originTick = runner ? frame.world.tick : prefix.at.originTick;
  return freeze(cloneInert({ version: 'owned_runner_original_contact_kinematics_v1' as const, playerId, personId: participant.personId,
    personLinkSourceId: participant.personLinkSourceId, gameId: prefix.gameId, gameDay: frame.batterActor!.binding.gameDay,
    physicalPitchSourceId: prefix.physicalPitchSourceId, modelSourceId: world.model.sourceId, modelSourceVersion: world.model.sourceVersion,
    at: prefix.at, ticksPerSecond: prefix.ticksPerSecond, root, roles,
    origin: { kind: basis.origin, contactSourceId: world.source.sourceId, physicalPitchSourceId: prefix.physicalPitchSourceId,
      ...(runner ? { runnerSourceId: runner.source.sourceId, runnerSourceHash: hash(runner.source) } : {}), at: { originTick, elapsedSeconds: 0, tick: originTick } },
    authority: participant.authority, physicalPrefix: prefix }));
};
