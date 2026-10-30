import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BallWorldMotionActor } from '../ball/BallWorldContinuation';
import type { SourceBallWorldMotionInputV1 } from '../ball/SourceBallWorldMotionV1';
import { createSourceBallWorldMotionSessionV1 } from '../ball/SourceBallWorldMotionV1';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import { createPostImpactBatBodyControlV1 } from '../contact/PostImpactBatBodyControlV1';
import { createRigidBatStateFromBatterSwingState } from '../contact/RigidBatBallContact';
import { queryPostImpactBatBodyWorldV1, type PostImpactBatBodyWorldInputV1 } from './PostImpactBatBodyWorldV1';

export type RecoveredBallFieldRootInputV1 = Readonly<{
  version: 'recovered_ball_field_root_v1'; recovery: PostImpactBatBodyWorldInputV1;
  holdThroughTick: number; equipmentId: string;
  actorProfiles: SourceBallWorldMotionInputV1['response']['actors'];
  surfaces: SourceBallWorldMotionInputV1['response']['world']['surfaces'];
  surfaceProfiles: SourceBallWorldMotionInputV1['response']['surfaces'];
  baseGeometry: SourceBallWorldMotionInputV1['baseGeometry'];
}>;
const axes = ['x', 'y', 'z'] as const;
const zero = (v: Vec3) => axes.every(axis => v[axis] === 0);
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
function assert(v: unknown, message: string): asserts v { if (!v) throw new Error('recovered ball field root: ' + message); }

/** Reconstructs a conditional finite hold from the real completed recovery.
 * No supplied ball/actor poses, fake legacy flight, old-lease extension or
 * stored candidate is admitted. Native still owes a NEW cumulative workload
 * assessment and successor actuation right before executing this hold. */
export function prepareRecoveredBallFieldRootV1(raw: RecoveredBallFieldRootInputV1) {
  const p = cloneInert(raw);
  assert(p && Object.keys(p).sort().join('|') === 'actorProfiles|baseGeometry|equipmentId|holdThroughTick|recovery|surfaceProfiles|surfaces|version'
    && p.version === 'recovered_ball_field_root_v1', 'invalid input');
  const recovered = queryPostImpactBatBodyWorldV1(p.recovery);
  assert(recovered.kind === 'moving' || recovered.kind === 'resting', 'original recovery did not finish clear');
  assert(recovered.controlEndsAtThisMoment && p.recovery.throughTick === p.recovery.control.recoveryEndTick, 'original control is unfinished');
  const w = p.recovery.control.world, at = recovered.moment, tps = recovered.descriptor.profile.air.ticksPerSecond;
  assert(Number.isSafeInteger(p.holdThroughTick) && p.holdThroughTick > at.ball.tick, 'invalid finite successor hold');
  assert(zero(recovered.actorsAtMoment.bat.state.linearVelocity) && zero(recovered.actorsAtMoment.bat.state.angularVelocity)
    && zero(recovered.actorsAtMoment.body.velocity) && zero(recovered.actorsAtMoment.hand.velocity)
    && zero(recovered.pitcherHandAtMoment.velocity), 'successor stationary hold would erase actual momentum');
  const actors = w.pitch.otherActors.map((actor): BallWorldMotionActor => {
    const s = actor.primitive, dt = (at.originTick - s.startTick) / tps + at.elapsedSeconds;
    assert(s.ticksPerSecond === tps && dt >= 0 && at.elapsedSeconds <= (s.endTick - at.originTick) / tps, 'original actor coverage differs');
    const position = Object.fromEntries(axes.map(axis => [axis, s.startCenter[axis] + s.startVelocity[axis] * dt + .5 * s.acceleration[axis] * dt * dt])) as Vec3;
    const velocity = Object.fromEntries(axes.map(axis => [axis, s.startVelocity[axis] + s.acceleration[axis] * dt])) as Vec3;
    const replacement = actor.playerId === w.batterPlayerId && s.role === 'body' ? recovered.actorsAtMoment.body
      : actor.playerId === w.batterPlayerId && s.role === 'tag_hand' ? recovered.actorsAtMoment.hand : { position, velocity };
    assert(zero(replacement.velocity), 'stationary successor cannot discard retained actor velocity');
    return { playerId: actor.playerId, startElapsedSeconds: at.elapsedSeconds, primitive: { ...s, startTick: at.originTick,
      startCenter: replacement.position, startVelocity: replacement.velocity, acceleration: { x: 0, y: 0, z: 0 }, endTick: p.holdThroughTick } };
  });
  const pitcherId = w.pitch.pitcherPlayerId;
  assert(typeof pitcherId === 'string' && !actors.some(a => a.playerId === pitcherId && a.primitive.role === 'tag_hand'), 'pitcher hand identity differs');
  actors.push({ playerId: pitcherId, startElapsedSeconds: at.elapsedSeconds, primitive: { role: 'tag_hand', radius: w.pitch.anchors.handRadiusM,
    startTick: at.originTick, endTick: p.holdThroughTick, ticksPerSecond: tps, startCenter: recovered.pitcherHandAtMoment.position,
    startVelocity: recovered.pitcherHandAtMoment.velocity, acceleration: { x: 0, y: 0, z: 0 } } });
  const descriptor = { ...recovered.descriptor, throughElapsedSeconds: (p.holdThroughTick - at.originTick) / tps }, profile = descriptor.profile;
  const root: SourceBallWorldMotionInputV1 = { version: 'source_ball_world_motion_v1',
    response: { world: { actors, surfaces: p.surfaces, sourceCurve: descriptor, parameters: { ticksPerSecond: tps,
      integrationStepTicks: profile.air.integrationStepTicks, gravityY: profile.air.gravityY, ballRadius: profile.ground.radiusM,
      groundRestitution: profile.ground.material.restitution, groundFriction: profile.ground.material.slidingFriction,
      groundRollingDecelerationMps2: profile.ground.material.rollingDecelerationMps2, restingVerticalSpeed: profile.ground.restingVerticalSpeedMps } },
      actors: p.actorProfiles, surfaces: p.surfaceProfiles },
    cursor: { moment: at, sourceCurve: descriptor, sourceSide: 'incoming', previousContacts: [] },
    materialOrientationAtSourceBasis: createPostImpactBatBodyControlV1(p.recovery.control).impact.orientation,
    heldBats: [{ equipmentId: p.equipmentId, holderPlayerId: w.batterPlayerId,
      bat: createRigidBatStateFromBatterSwingState(recovered.actorsAtMoment.bat.state, w.batPhysical), ball: w.ball }], baseGeometry: p.baseGeometry };
  // Extending the original Source horizon must preserve its complete old state.
  const extended = createSourceFreeBallKernel(descriptor).evaluateAt(at.elapsedSeconds, 'incoming');
  assert(JSON.stringify(extended.moment) === JSON.stringify(at), 'extended Source changed original recovery state');
  const state = createSourceBallWorldMotionSessionV1(root).snapshot();
  return freeze({ root, recovered, state, nativeAdmission: false as const, motionIssued: false as const,
    requiresNewCumulativeWorkloadAssessment: true as const, requiresSuccessorActuationRight: true as const });
}
