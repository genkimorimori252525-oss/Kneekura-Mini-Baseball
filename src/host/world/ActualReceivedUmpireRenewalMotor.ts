import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec2 } from '../../core/model/geometry';
import type { DefensiveIntentCandidate } from '../../core/sim/fielding/DefensiveDecision';
import { buildDefenderMotionTrajectory, sampleDefenderMotionSegment } from '../../core/sim/fielding/DefenderMotion';
import { deriveRatedDefenderMotionParameters, planRatedDefenderRoute } from '../../core/sim/fielding/DefensiveRatingAdapters';
import { defensiveTick } from './ActualDefensiveContext';
import { assertRenewalCut, renewalExactCut, type RenewalCut } from './ActualReceivedUmpireRenewal';
import type { ActualPlayerKinematics } from './ActualPlayerKinematicsFromPrefix';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurablePlayerLocomotionModel } from './SqlitePlayerLocomotionModelStore';

/** Structural facts from the Native renewal decision, not an initial-decision receipt.
 * Its Native owner authenticates selection, issuance and dependency identity on the same connection. */
export type ReceivedRenewalMotorDecision = Readonly<{
  sourceId: string; playerId: string; physicalPitchSourceId: string; personId: string; personLinkSourceId: string;
  gameDay: number; cut: RenewalCut; selected: DefensiveIntentCandidate; target: Vec2 | null; movementStartTick: number;
}>;

const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
const axes = ['x', 'y', 'z'] as const;

/** Pure intent-to-command mathematics. Native supplies the existing accepted model and bounded
 * executed self; this helper neither authenticates external callers nor advances physical state. */
export const deriveReceivedRenewalMotorReceipt = (decision: ReceivedRenewalMotorDecision,
  model: DurablePlayerLocomotionModel, self: ActualPlayerKinematics) => {
  // Reject nonfinite nested state and detach all facts before calculation or freezing.
  const d = cloneInert(decision), m = cloneInert(model), s = cloneInert(self);
  const cut = renewalExactCut(s.at, s.ticksPerSecond);
  assertRenewalCut(d.cut, cut);
  if (d.movementStartTick !== cut.tick) throw new Error('received renewal movement is not due at the exact cut');
  const fielding = m.fieldingModel.source, person = m.fieldingModel.person, c = m.source.calibration;
  if (s.origin.kind !== 'defender_world_projection' || d.playerId !== s.playerId || d.physicalPitchSourceId !== s.physicalPitchSourceId
    || d.personId !== s.personId || d.personLinkSourceId !== s.personLinkSourceId || d.gameDay !== s.gameDay
    || m.source.capability !== 'defender_locomotion_v1' || m.source.playerId !== s.playerId
    || m.source.personLinkSourceId !== s.personLinkSourceId || m.source.fieldingModelSourceId !== fielding.sourceId
    || m.source.careerId !== fielding.careerId || fielding.careerId !== person.careerId
    || fielding.playerId !== s.playerId || fielding.personLinkSourceId !== s.personLinkSourceId
    || person.sourceId !== s.personLinkSourceId || person.playerId !== s.playerId || person.personId !== s.personId
    || !defensiveTick(s.gameDay) || !defensiveTick(m.source.acceptedAtDay) || !defensiveTick(fielding.acceptedAtDay)
    || !defensiveTick(person.acceptedAtDay) || person.acceptedAtDay > fielding.acceptedAtDay
    || fielding.acceptedAtDay > m.source.acceptedAtDay || m.source.acceptedAtDay > s.gameDay) {
    throw new Error('received renewal original Player Person fielding model or day identity differs');
  }
  if (s.root.velocity.y !== 0 || s.root.acceleration.y !== 0) throw new Error('received renewal vertical root state is unsupported');
  if (d.selected.intent.kind !== 'ball_handler' && d.selected.intent.kind !== 'hold'
    || (d.selected.intent.kind === 'hold') !== (d.target === null)) throw new Error('received renewal intent or target is unsupported');
  const position = { x: s.root.position.x, z: s.root.position.z }, velocity = { x: s.root.velocity.x, z: s.root.velocity.z };
  // Core has tolerance at its generic speed guard; renewal must never clamp inherited overspeed.
  if (Math.hypot(velocity.x, velocity.z) > c.topSpeedMps) throw new Error('received renewal inherited speed exceeds top speed');

  const coverage = s.ownedMotionCoverage;
  if (!coverage || s.roles.length !== roles.length || new Set(s.roles.map(p => p.role)).size !== roles.length
    || s.roles.some(p => !roles.includes(p.role)) || coverage.roleAuthorities.length !== roles.length
    || new Set(coverage.roleAuthorities.map(p => p.role)).size !== roles.length
    || coverage.roleAuthorities.some(p => !roles.includes(p.role))) throw new Error('received renewal requires five separate owned role authorities');
  if (!defensiveTick(coverage.physicalThroughTick) || coverage.physicalThroughTick < cut.tick
    || !defensiveTick(coverage.rootAuthority.acceptedThroughTick) || coverage.rootAuthority.acceptedThroughTick < cut.tick
    || !defensiveTick(s.activeCommand.acceptedThroughTick) || s.activeCommand.acceptedThroughTick < cut.tick) {
    throw new Error('received renewal current physical coverage is exhausted');
  }
  const retainedRoles = s.roles.map(p => {
    const a = coverage.roleAuthorities.find(a => a.role === p.role)!, primitive = p.canonicalActor.primitive;
    if (p.canonicalActor.playerId !== s.playerId || primitive.role !== p.role || primitive.radius !== p.radiusMeters
      || primitive.ticksPerSecond !== s.ticksPerSecond || !defensiveTick(primitive.startTick) || !defensiveTick(primitive.endTick)
      || primitive.startTick > cut.tick || primitive.endTick < cut.tick || primitive.endTick !== coverage.physicalThroughTick
      || p.canonicalActor.startElapsedSeconds !== undefined && p.canonicalActor.startElapsedSeconds > s.at.elapsedSeconds) {
      throw new Error('received renewal current physical role scope or coverage differs');
    }
    if (!defensiveTick(a.acceptedThroughTick) || !defensiveTick(a.command.acceptedThroughTick)
      || a.acceptedThroughTick <= cut.tick || a.acceptedThroughTick > a.command.acceptedThroughTick) {
      throw new Error('received renewal retained role command coverage is exhausted or exceeded');
    }
    for (const at of [a.command.adoptedAt, a.command.executedThrough]) {
      if (at.originTick !== s.at.originTick || !defensiveTick(at.tick) || at.elapsedSeconds < 0
        || at.elapsedSeconds > s.at.elapsedSeconds || at.tick > cut.tick) throw new Error('received renewal retained role command cut differs');
    }
    if (a.command.adoptedAt.elapsedSeconds > a.command.executedThrough.elapsedSeconds) {
      throw new Error('received renewal retained role command chronology differs');
    }
    if (axes.some(axis => p.canonicalRoundingResidual.acceleration[axis] !== 0
      || p.relativeAcceleration[axis] !== p.declaredPose.relativeAcceleration[axis])) {
      throw new Error('received renewal retained acceleration residual is unsupported');
    }
    // The root is replaced. Its previous generation end is only a current-cut check;
    // each independently owned relative command supplies its own future coverage.
    return { role: p.role, radiusMeters: p.radiusMeters, command: a.command,
      acceptedThroughTick: a.acceptedThroughTick, offsetAcceleration: p.declaredPose.relativeAcceleration };
  });
  const maximumEnd = cut.tick + c.maxIntegrationStepTicks;
  if (!defensiveTick(maximumEnd)) throw new Error('received renewal end tick overflow');
  const endTick = Math.min(maximumEnd, ...retainedRoles.map(p => p.acceptedThroughTick));
  if (endTick <= cut.tick) throw new Error('received renewal retained role coverage is exhausted');
  const parameters = deriveRatedDefenderMotionParameters({ ticksPerSecond: s.ticksPerSecond,
    maxIntegrationStepTicks: c.maxIntegrationStepTicks, accelerationMps2: c.accelerationRatingCalibration.lowestAbilityAccelerationMps2,
    brakingMps2: c.brakingMps2, topSpeedMps: c.topSpeedMps, arrivalRadiusMeters: c.arrivalRadiusMeters },
  fielding.ratings, c.accelerationRatingCalibration);
  const route = d.target === null ? null : planRatedDefenderRoute({ start: position, target: d.target, ratings: fielding.ratings,
    preferredSide: c.preferredSide, calibration: c.routeCalibration });
  const firstWaypoint = route?.waypoints[0] ?? null;
  const segments = buildDefenderMotionTrajectory({ tick: cut.tick, position, velocity }, firstWaypoint, endTick - cut.tick, parameters);
  if (segments.length !== 1) throw new Error('received renewal must own one integration segment');
  const segment = segments[0];
  cloneInert(sampleDefenderMotionSegment(segment, segment.endTick));
  return freeze(cloneInert({ self: s, intent: d.selected.intent, target: d.target, route, firstWaypoint, segment, parameters,
    decisionSourceId: d.sourceId, issuedAt: s.at, startAt: s.at, ticksPerSecond: s.ticksPerSecond,
    movementStartTick: d.movementStartTick, coverageEndTick: endTick, retainedRoles, roleAuthorities: coverage.roleAuthorities,
    relativeCommandConvention: 'retain_declared_role_acceleration_v1' as const,
    command: { playerId: s.playerId, bodyAcceleration: { x: segment.acceleration.x, y: s.root.acceleration.y, z: segment.acceleration.z },
      primitiveMotions: retainedRoles.map(p => ({ role: p.role, offsetAcceleration: p.offsetAcceleration })) },
    lifecycle: { status: 'adoption_pending' as const, executedThrough: null } }));
};
export type ReceivedRenewalMotorReceipt = ReturnType<typeof deriveReceivedRenewalMotorReceipt>;
