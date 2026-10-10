import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { buildDefenderMotionTrajectory, sampleDefenderMotionSegment } from '../../core/sim/fielding/DefenderMotion';
import { deriveRatedDefenderMotionParameters, planRatedDefenderRoute } from '../../core/sim/fielding/DefensiveRatingAdapters';
import { actualDefensiveBoundary, defensiveTick } from './ActualDefensiveContext';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableActualDefensiveDecision, ActualDefensiveDecisionReceipt } from './SqliteActualDefensiveDecisionStore';
import type { OwnedActualPlayerKinematics } from './SqliteActualPlayerKinematicsReader';
import type { DurablePlayerLocomotionModel } from './SqlitePlayerLocomotionModelStore';
import { createPlayerLocomotionCalibration, type PlayerLocomotionCalibration } from '../../core/sim/fielding/PlayerLocomotionCalibration';

/** Internal calculation only: Native supplies rederived original dependencies on its own connection.
 * This creates intent-to-command evidence, never an execution or a route-progress transition. */
export type IssuedDefenderMotionDecision = Readonly<{ sourceId: string; playerId: string; physicalPitchSourceId: string }> &
  Pick<ActualDefensiveDecisionReceipt, 'lifecycle' | 'ticksPerSecond' | 'availability' | 'scheduling' | 'selected' | 'target'>;
/** Shared pure motion input. A new versioned decision is never cast or relabeled
 * as a DurableActualDefensiveDecision; Native owns its distinct provenance. */
export type IssuedDefenderMotionSelf = Pick<OwnedActualPlayerKinematics,
  'playerId' | 'personId' | 'personLinkSourceId' | 'gameDay' | 'physicalPitchSourceId' | 'at' | 'ticksPerSecond' | 'root'> & Readonly<{
  origin: Pick<OwnedActualPlayerKinematics['origin'], 'kind'>;
  roles: readonly Pick<OwnedActualPlayerKinematics['roles'][number], 'role' | 'radiusMeters' | 'relativeAcceleration' | 'declaredPose' | 'canonicalRoundingResidual' | 'canonicalActor'>[];
  activeCommand: Pick<OwnedActualPlayerKinematics['activeCommand'], 'acceptedThroughTick'>;
}>;
/** A structural self seam preserves each Native family's own provenance. */
export const deriveIssuedDefenderMotionReceipt = <Self extends IssuedDefenderMotionSelf>(decision: IssuedDefenderMotionDecision, model: DurablePlayerLocomotionModel,
  self: Self, rawCalibration: PlayerLocomotionCalibration) => {
  const d = decision, c = createPlayerLocomotionCalibration(rawCalibration), ratings = model.fieldingModel.source.ratings;
  if (d.lifecycle.status !== 'issued' || !d.lifecycle.issuedAt || d.lifecycle.issuedBySourceId !== decision.sourceId) {
    throw new Error('actual locomotion requires an actually issued decision');
  }
  const startTick = actualDefensiveBoundary(self.at, self.ticksPerSecond);
  if (self.at.elapsedSeconds !== (startTick - self.at.originTick) / self.ticksPerSecond) {
    throw new Error('actual locomotion requires an exact executed integer boundary');
  }
  if (self.origin.kind !== 'defender_world_projection' || self.root.velocity.y !== 0 || self.root.acceleration.y !== 0
    || self.ticksPerSecond !== d.ticksPerSecond || self.playerId !== decision.playerId
    || self.physicalPitchSourceId !== decision.physicalPitchSourceId || model.source.playerId !== self.playerId
    || model.source.personLinkSourceId !== self.personLinkSourceId || model.fieldingModel.person.personId !== self.personId
    || model.source.acceptedAtDay > self.gameDay) throw new Error('actual locomotion original self/model identity differs');
  for (const at of [d.availability, d.lifecycle.issuedAt]) {
    if (at.originTick !== self.at.originTick || at.elapsedSeconds > self.at.elapsedSeconds) throw new Error('actual locomotion cannot backdate issuance');
  }
  if (startTick < d.scheduling.movementStartTick) throw new Error('actual locomotion first step is not due');
  if (d.selected.intent.kind !== 'ball_handler' && d.selected.intent.kind !== 'hold'
    || (d.selected.intent.kind === 'hold') !== (d.target === null)) throw new Error('actual locomotion intent is unsupported');
  const position = { x: self.root.position.x, z: self.root.position.z }, velocity = { x: self.root.velocity.x, z: self.root.velocity.z };
  // Reject inherited overspeed rather than letting any downstream tolerance or normalization clamp it.
  if (Math.hypot(velocity.x, velocity.z) > c.topSpeedMps) throw new Error('actual locomotion inherited speed exceeds top speed');
  const parameters = deriveRatedDefenderMotionParameters({ ticksPerSecond: self.ticksPerSecond, maxIntegrationStepTicks: c.maxIntegrationStepTicks,
    accelerationMps2: c.accelerationRatingCalibration.lowestAbilityAccelerationMps2,
    brakingMps2: c.brakingMps2, topSpeedMps: c.topSpeedMps, arrivalRadiusMeters: c.arrivalRadiusMeters }, ratings, c.accelerationRatingCalibration);
  const route = d.target === null ? null : planRatedDefenderRoute({ start: position, target: d.target, ratings,
    preferredSide: c.preferredSide, calibration: c.routeCalibration });
  const firstWaypoint = route?.waypoints[0] ?? null;
  if (self.roles.some(p => Object.values(p.canonicalRoundingResidual.acceleration).some(n => n !== 0)
    || JSON.stringify(p.relativeAcceleration) !== JSON.stringify(p.declaredPose.relativeAcceleration))) {
    throw new Error('actual locomotion retained acceleration residual is unsupported');
  }
  const activeCommand: Self['activeCommand'] = self.activeCommand;
  const retainedRoles = self.roles.map(p => ({ role: p.role, radiusMeters: p.radiusMeters,
    command: activeCommand, acceptedThroughTick: Math.min(p.canonicalActor.primitive.endTick, self.activeCommand.acceptedThroughTick),
    offsetAcceleration: p.declaredPose.relativeAcceleration }));
  const maximumEnd = startTick + c.maxIntegrationStepTicks;
  if (!defensiveTick(maximumEnd)) throw new Error('actual locomotion end tick overflow');
  const endTick = Math.min(maximumEnd, ...retainedRoles.map(p => p.acceptedThroughTick));
  if (endTick <= startTick) throw new Error('actual locomotion retained relative command coverage exhausted');
  const segments = buildDefenderMotionTrajectory({ tick: startTick, position, velocity }, firstWaypoint, endTick - startTick, parameters);
  if (segments.length !== 1) throw new Error('actual locomotion must own one integration segment');
  const segment = segments[0];
  // Core accepts finite inputs; also reject finite inputs whose derived route/step arithmetic overflows.
  cloneInert(sampleDefenderMotionSegment(segment, segment.endTick));
  return freeze(cloneInert({ self, intent: d.selected.intent, target: d.target, route, firstWaypoint, segment, parameters,
    availableAt: d.availability, issuedAt: d.lifecycle.issuedAt, movementStartTick: d.scheduling.movementStartTick,
    startAt: self.at, coverageEndTick: endTick, retainedRoles, relativeCommandConvention: 'retain_declared_role_acceleration_v1' as const,
    command: { playerId: self.playerId, bodyAcceleration: { x: segment.acceleration.x, y: self.root.acceleration.y, z: segment.acceleration.z },
      primitiveMotions: retainedRoles.map(p => ({ role: p.role, offsetAcceleration: p.offsetAcceleration })) },
    lifecycle: { status: 'adoption_pending' as const, executedThrough: null } }));
};
/** Unchanged v1 owner projection into the shared pure issued-decision input. */
export const deriveActualLocomotionReceiptWithCalibration = (decision: DurableActualDefensiveDecision, model: DurablePlayerLocomotionModel,
  self: OwnedActualPlayerKinematics, calibration: PlayerLocomotionCalibration) => {
  const receipt = decision.receipt;
  return deriveIssuedDefenderMotionReceipt({ sourceId: decision.source.sourceId, playerId: decision.source.playerId,
    physicalPitchSourceId: decision.source.physicalPitchSourceId, lifecycle: receipt.lifecycle, ticksPerSecond: receipt.ticksPerSecond,
    availability: receipt.availability, scheduling: receipt.scheduling, selected: receipt.selected, target: receipt.target }, model, self, calibration);
};
/** Existing Native v1 callers retain the unchanged nominal calibration.
 * New Native adapters authenticate a separate effective Source before calling
 * the shared calculation; the original model object and its hashes stay intact. */
export const deriveActualLocomotionReceipt = (decision: DurableActualDefensiveDecision, model: DurablePlayerLocomotionModel,
  self: OwnedActualPlayerKinematics) => deriveActualLocomotionReceiptWithCalibration(decision, model, self, model.source.calibration);
export type ActualLocomotionReceipt = ReturnType<typeof deriveActualLocomotionReceipt>;
