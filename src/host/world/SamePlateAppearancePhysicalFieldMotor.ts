import type { Vec3 } from '../../core/model/geometry';
import type { AcceptedBattedWorldModel } from './BattedWorldModel';
import type { DurablePlayerLocomotionModel } from './SqlitePlayerLocomotionModelStore';
import type { PlayerLocomotionCalibration } from '../../core/sim/fielding/PlayerLocomotionCalibration';
import { deriveIssuedDefenderMotionReceipt, type IssuedDefenderMotionDecision } from './ActualLocomotion';
import type { SamePaPhysicalAction, SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import { actorFreeze as freeze, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
const axes = ['x', 'y', 'z'] as const;
const v = (fn: (axis: keyof Vec3) => number): Vec3 => {
  const value = { x: fn('x'), y: fn('y'), z: fn('z') };
  if (!Object.values(value).every(Number.isFinite)) throw new Error('physical field self arithmetic overflow');
  return value;
};
const zero = () => ({ x: 0, y: 0, z: 0 });
const close = (a: number, b: number) => Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;
/** Original stationary role poses remain owned while the shared locomotion kernel
 * translates the body. This is a new-family self, never a legacy kinematics row. */
export const samePaPhysicalDefenderSelf = (action: SamePaPhysicalAction, root: SamePaPhysicalFieldRoot,
  previous: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep, model: AcceptedBattedWorldModel['actors'][number]) => {
  const binding = action.actor.defenderBindings.find(b => b.playerId === model.playerId), motion = previous.field.motion;
  if (!binding || binding.personId !== model.personId || root.physicalPitchSourceId !== previous.physicalPitchSourceId) throw new Error('physical defender original identity differs');
  const moment = motion.world.moment, p = root.response.world.parameters, actors = motion.actors.filter(a => a.playerId === model.playerId);
  if (actors.length !== 5 || new Set(actors.map(a => a.primitive.role)).size !== 5 || model.primitives.length !== 5) throw new Error('physical defender five-role coverage differs');
  const sample = (actor: typeof actors[number]) => {
    const primitive = actor.primitive, dt = (moment.originTick - primitive.startTick) / p.ticksPerSecond + moment.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
    if (dt < 0 || moment.elapsedSeconds > (primitive.endTick - moment.originTick) / p.ticksPerSecond || primitive.ticksPerSecond !== p.ticksPerSecond) throw new Error('physical defender self is outside its owned curve');
    return { position: v(a => primitive.startCenter[a] + primitive.startVelocity[a] * dt + 0.5 * primitive.acceleration[a] * dt * dt),
      velocity: v(a => primitive.startVelocity[a] + primitive.acceleration[a] * dt), acceleration: primitive.acceleration };
  };
  const body = actors.find(a => a.primitive.role === 'body')!, bodyShape = model.primitives.find(s => s.role === 'body');
  if (!bodyShape) throw new Error('physical defender body origin missing');
  const bodyState = sample(body), origin = { position: v(a => bodyState.position[a] - bodyShape.offset[a]), velocity: bodyState.velocity, acceleration: bodyState.acceleration };
  const roles = actors.map(canonicalActor => {
    const shape = model.primitives.find(s => s.role === canonicalActor.primitive.role), state = sample(canonicalActor);
    if (!shape || shape.radius !== canonicalActor.primitive.radius || axes.some(a => !close(state.position[a], origin.position[a] + shape.offset[a])
      || !close(state.velocity[a], origin.velocity[a]) || state.acceleration[a] !== origin.acceleration[a])) throw new Error('physical defender retained pose or acceleration differs');
    return { role: shape.role, radiusMeters: shape.radius, relativeAcceleration: zero(),
      declaredPose: { offset: shape.offset, relativeVelocity: zero(), relativeAcceleration: zero() },
      canonicalRoundingResidual: { position: v(a => state.position[a] - origin.position[a] - shape.offset[a]), velocity: v(a => state.velocity[a] - origin.velocity[a]), acceleration: zero() }, canonicalActor };
  });
  return freeze({ kind: 'same_pa_physical_defender_self_v1' as const, playerId: model.playerId, personId: binding.personId,
    personLinkSourceId: binding.personLinkSourceId, gameDay: binding.gameDay, physicalPitchSourceId: root.physicalPitchSourceId,
    at: { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick }, ticksPerSecond: p.ticksPerSecond,
    origin: { kind: 'defender_world_projection' as const }, root: origin, roles,
    activeCommand: { acceptedThroughTick: Math.min(...actors.map(a => a.primitive.endTick)) },
    originalFieldReference: reference('pa_physical_v1_field_roots', root),
    physicalCutReference: reference(previous.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', previous),
    modelHash: hash(model) });
};
export const deriveSamePaPhysicalFieldMotor = (decision: IssuedDefenderMotionDecision, model: DurablePlayerLocomotionModel,
  self: ReturnType<typeof samePaPhysicalDefenderSelf>, calibration: PlayerLocomotionCalibration) => deriveIssuedDefenderMotionReceipt(decision, model, self, calibration);
export type SamePaPhysicalFieldMotor = ReturnType<typeof deriveSamePaPhysicalFieldMotor>;
