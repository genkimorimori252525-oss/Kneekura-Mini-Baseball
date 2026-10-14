import type { ActualPlayerCommandAdoption, ActualPlayerKinematics } from './ActualPlayerKinematicsFromPrefix';
import type { DurablePlayerLocomotionModel } from './SqlitePlayerLocomotionModelStore';
import type { ReceivedRenewalMotorDecision } from './ActualReceivedUmpireRenewalMotor';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';

/** Pure synthetic identities, coverage and calibration; no donor or Native ownership claim. */
export const receivedRenewalMotorFixture = () => {
  const at = { originTick: 100, elapsedSeconds: 0.05, tick: 150 }, initial = { originTick: 100, elapsedSeconds: 0, tick: 100 };
  const zero = () => ({ x: 0, y: 0, z: 0 });
  const roleNames = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
  const command = (sourceId: string, acceptedThroughTick: number): ActualPlayerCommandAdoption => ({
    kind: 'contact', owner: 'batted_world_contacts', sourceId, sourceVersion: 'synthetic-v1', sourceHash: sourceId + '-hash',
    adoptionSourceId: sourceId, adoptionSourceHash: sourceId + '-hash', adoptedAt: initial, executedThrough: at, acceptedThroughTick,
  });
  const activeCommand = command('active-root-command', 160);
  const roleAuthorities = roleNames.map((role, i) => ({ role, command: command('retained-' + role, 220 + i), acceptedThroughTick: 220 + i }));
  const self: ActualPlayerKinematics = { playerId: 'p2', personId: 'person2', personLinkSourceId: 'person-link2',
    gameId: 'game', gameDay: 10, physicalPitchSourceId: 'pitch', modelSourceId: 'physical-model', modelSourceVersion: 'synthetic-v1',
    at, ticksPerSecond: 1000, origin: { kind: 'defender_world_projection', contactSourceId: 'contact', at: initial },
    root: { position: { x: 0, y: 1, z: 0 }, velocity: zero(), acceleration: zero() },
    roles: roleNames.map((role, i) => { const relativeAcceleration = { x: 0.25 * i, y: -0.5 * i, z: 0.75 * i };
      return { role, radiusMeters: 0.1, offset: { x: i, y: 0, z: 0 }, relativeVelocity: zero(), relativeAcceleration,
        declaredPose: { offset: { x: i, y: 0, z: 0 }, relativeVelocity: zero(), relativeAcceleration },
        canonicalRoundingResidual: { position: zero(), velocity: zero(), acceleration: zero() },
        canonicalActor: { playerId: 'p2', primitive: { role, radius: 0.1, startTick: 150, endTick: 160, ticksPerSecond: 1000,
          startCenter: { x: i, y: 1, z: 0 }, startVelocity: zero(), acceleration: relativeAcceleration } } };
    }), activeCommand, adoptions: [activeCommand], ownedMotionCoverage: { compositionSourceId: 'original-adoption', physicalThroughTick: 160,
      rootAuthority: { owner: 'actual_locomotion_receipts', sourceId: 'incumbent-motor', sourceHash: 'incumbent-hash',
        adoptionOwner: 'batted_world_field_executions', adoptionSourceId: 'original-adoption', adoptionSourceHash: 'adoption-hash', acceptedThroughTick: 160 }, roleAuthorities } };
  const model: DurablePlayerLocomotionModel = {
    source: { sourceId: 'locomotion-model', sourceVersion: 'synthetic-v1', capability: 'defender_locomotion_v1', careerId: 'career',
      playerId: 'p2', personLinkSourceId: 'person-link2', fieldingModelSourceId: 'fielding-model', acceptedAtDay: 10,
      calibration: { ...playerLocomotionCalibrationFixture(), maxIntegrationStepTicks: 100 } },
    fieldingModel: { source: { sourceId: 'fielding-model', sourceVersion: 'synthetic-v1', careerId: 'career', playerId: 'p2',
      personLinkSourceId: 'person-link2', acceptedAtDay: 10, ratings: {
        positionSuitability: { P: 1, C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, LF: 1, CF: 1, RF: 1 },
        firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5,
        transfer: 0.5, armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
      transferParameters: { minimumTransferDelayTicks: 1, maximumTransferDelayTicks: 2, fixedGripOffsetTicks: 0 },
      throwCalibration: { minimumReleaseSpeedMps: 1, maximumReleaseSpeedMps: 2, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 } },
      person: { sourceId: 'person-link2', careerId: 'career', playerId: 'p2', personId: 'person2', sourceRecordId: 'intake',
        sourceVersion: 'synthetic-v1', acceptedRevision: 1, acceptedAtDay: 10, rosterRevision: 1 } },
  };
  const decision: ReceivedRenewalMotorDecision = { sourceId: 'renewal-decision', playerId: 'p2', physicalPitchSourceId: 'pitch',
    personId: 'person2', personLinkSourceId: 'person-link2', gameDay: 10, cut: { ...at, ticksPerSecond: 1000 },
    selected: { intent: { kind: 'ball_handler' }, localPriority: 1, evidenceAvailableAt: 140, evidenceKinds: ['synthetic-received-cue'] },
    target: { x: 10, z: 0 }, movementStartTick: 150 };
  return { decision, model, self };
};
