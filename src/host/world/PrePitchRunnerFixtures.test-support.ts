import type { AcceptedPrePitchRunnerExecution } from './PrePitchRunnerExecution';
const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
export const input = (): AcceptedPrePitchRunnerExecution => ({ kind: 'pre_pitch_upright_runner_v1', sourceId: 'runner-motion', sourceVersion: 'v1',
  gameId: 'game', physicalActorSourceId: 'batter-actor', playerId: 'runner', motionRevision: 0,
  route: { segments: [{ kind: 'line', start: { x: 10, z: 5 }, end: { x: 100, z: 5 } }] },
  startMotion: { tick: 1_000_000, routeDistanceMeters: 0, speedMps: 0, driveDirection: 1, bodyMode: 'upright' },
  intent: { kind: 'advance', issuedTick: 1_000_000 }, parameters: { ticksPerSecond: 1_000_000, reactionDelayTicks: 0,
    accelerationMps2: 2, brakingMps2: 3, slideDecelerationMps2: 2, topSpeedMps: 8 }, coverageThroughTick: 4_000_000,
  bodyPose: { bodyOriginHeightMeters: 0.3, primitiveMotions: roles.map((role, index) => ({ role,
    startOffset: { x: index, y: 1, z: 0 }, offsetVelocity: { x: 0.2, y: 0, z: 0 }, offsetAcceleration: { x: 0.4, y: 0, z: 0 } })) } });
export const canonical = { playerId: 'runner', tick: 1_000_000, position: { x: 10, z: 5 }, velocity: { x: 0, z: 0 }, bodyMode: 'upright' as const, motionRevision: 0 };
export const shapes = () => input().bodyPose.primitiveMotions.map((p) => ({ role: p.role, radius: 0.1, offset: p.startOffset }));
