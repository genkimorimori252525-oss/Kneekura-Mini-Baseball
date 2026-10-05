import type { BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import type { CanonicalRunnerKinematics, RouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import { buildPrePitchRunnerController, type AcceptedPrePitchRunnerExecution } from './PrePitchRunnerExecution';
import { input, canonical } from './PrePitchRunnerFixtures.test-support';

/** Test-only contract for the proposed exact adapter; no runner engine is supplied. */
export type RunnerPieceProjectionInput = Readonly<{ source: AcceptedPrePitchRunnerExecution; canonical: CanonicalRunnerKinematics;
  controller: RouteFollowingController; shapes: readonly Readonly<{ role: BallWorldMotionActor['primitive']['role']; radius: number; offset: { x: number; y: number; z: number } }>[];
  bodyOriginHeightMeters: number; originTick: number; startElapsedSeconds: number; throughElapsedSeconds: number }>;
export type RunnerPieceProjection = Readonly<{ controllerSegmentIndex: number; startElapsedSeconds: number;
  coverageThroughElapsedSeconds: number; actors: readonly BallWorldMotionActor[] }>;
type ProjectionModule = { prePitchRunnerFieldPieces(input: RunnerPieceProjectionInput): readonly RunnerPieceProjection[] };
export const requireRunnerPieceProjection = (module: unknown): ProjectionModule['prePitchRunnerFieldPieces'] => {
  const project = (module as Partial<ProjectionModule>)?.prePitchRunnerFieldPieces;
  if (typeof project !== 'function') throw new Error('retained runner analytic-piece projection is not implemented');
  return project;
};
export const runnerPieceProjectionInput = (kind: 'fractional' | 'integer' | 'reaction' | 'braking' = 'fractional'): RunnerPieceProjectionInput => {
  const original = input();
  const source: AcceptedPrePitchRunnerExecution = { ...original,
    startMotion: { ...original.startMotion, driveDirection: kind === 'reaction' ? 0 : 1, speedMps: kind === 'braking' ? 4.25 : 0 },
    intent: { ...original.intent, kind: kind === 'braking' ? 'hold' : 'advance' },
    parameters: { ...original.parameters, topSpeedMps: kind === 'fractional' ? 4.2469134 : kind === 'integer' ? 4.25 : 8,
      brakingMps2: 2, reactionDelayTicks: kind === 'reaction' ? 2_125_000 : 0 } };
  const basis = { ...canonical, velocity: { x: source.startMotion.speedMps, z: 0 } };
  return { source, canonical: basis, controller: buildPrePitchRunnerController(source, basis),
    shapes: source.bodyPose.primitiveMotions.map(part => ({ role: part.role, radius: 0.1, offset: part.startOffset })),
    bodyOriginHeightMeters: source.bodyPose.bodyOriginHeightMeters, originTick: 3_000_000, startElapsedSeconds: 0, throughElapsedSeconds: 0.6 };
};
export const projectedActorState = (actor: BallWorldMotionActor, originTick: number, elapsedSeconds: number) => {
  const p = actor.primitive, dt = (originTick - p.startTick) / p.ticksPerSecond + elapsedSeconds - (actor.startElapsedSeconds ?? 0);
  const point = (axis: 'x' | 'y' | 'z') => p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt;
  const velocity = (axis: 'x' | 'y' | 'z') => p.startVelocity[axis] + p.acceleration[axis] * dt;
  return { position: { x: point('x'), y: point('y'), z: point('z') }, velocity: { x: velocity('x'), y: velocity('y'), z: velocity('z') } };
};
