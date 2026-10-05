import { expect, it } from 'vitest';
import * as runnerExecution from './PrePitchRunnerExecution';
import { sampleRouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import { requireRunnerPieceProjection, runnerPieceProjectionInput, projectedActorState } from './PrePitchRunnerFieldPiecesContracts.test-support';

it.each(['fractional', 'reaction', 'braking'] as const)('projects retained %s controller pieces without changing their original authority', kind => {
  const project = requireRunnerPieceProjection(runnerExecution), input = runnerPieceProjectionInput(kind), before = structuredClone(input);
  const pieces = project(input), fromWorld = (input.originTick - input.canonical.tick) / input.source.parameters.ticksPerSecond;
  const boundary = input.controller.trajectory.segments[0].endElapsedSeconds - fromWorld;
  expect(pieces.map(piece => [piece.controllerSegmentIndex, piece.startElapsedSeconds, piece.coverageThroughElapsedSeconds])).toEqual([[0, 0, boundary], [1, boundary, 0.6]]);
  expect(pieces.every(piece => piece.actors.length === 5 && piece.actors.every(actor => actor.playerId === input.source.playerId))).toBe(true);
  expect(pieces.map(piece => piece.actors[0].primitive.acceleration.x)).toEqual(kind === 'reaction' ? [0.4, 2.4] : kind === 'braking' ? [-1.6, 0.4] : [2.4, 0.4]);
  for (const actor of pieces[0].actors) {
    const next = pieces[1].actors.find(next => next.primitive.role === actor.primitive.role)!;
    const left = projectedActorState(actor, input.originTick, boundary), right = projectedActorState(next, input.originTick, boundary);
    for (const part of ['position', 'velocity'] as const) for (const axis of ['x', 'y', 'z'] as const) expect(left[part][axis]).toBeCloseTo(right[part][axis], 11);
    expect(next.primitive.radius).toBe(actor.primitive.radius);
  }
  expect(input).toEqual(before);
});

it('ends exactly at a fractional phase boundary without exposing the next unexecuted acceleration', () => {
  const project = requireRunnerPieceProjection(runnerExecution), input = runnerPieceProjectionInput();
  const boundary = input.controller.trajectory.segments[0].endElapsedSeconds - 2;
  const pieces = project({ ...input, throughElapsedSeconds: boundary });
  expect(pieces).toHaveLength(1); expect(pieces[0].controllerSegmentIndex).toBe(0);
  expect(pieces[0].coverageThroughElapsedSeconds).toBe(boundary);
  expect(pieces[0].actors.every(actor => actor.primitive.acceleration.x === 2.4)).toBe(true);
  const actor = pieces[0].actors.find(actor => actor.primitive.role === 'body')!, actual = projectedActorState(actor, input.originTick, boundary);
  const roundedTick = input.originTick + Math.ceil(boundary * 1_000_000), rounded = sampleRouteFollowingController(input.controller, input.canonical, roundedTick);
  const pose = input.source.bodyPose.primitiveMotions.find(part => part.role === 'body')!, dt = (roundedTick - input.canonical.tick) / 1_000_000;
  const roundedCenter = rounded.position.x + pose.startOffset.x + pose.offsetVelocity.x * dt + 0.5 * pose.offsetAcceleration.x * dt * dt;
  expect(Math.abs(actual.position.x - roundedCenter)).toBeGreaterThan(1e-8);
});

it('starts exactly at an existing phase boundary without replaying the preceding piece', () => {
  const project = requireRunnerPieceProjection(runnerExecution), input = runnerPieceProjectionInput('integer');
  const pieces = project({ ...input, startElapsedSeconds: 0.125, throughElapsedSeconds: 0.2 });
  expect(pieces).toHaveLength(1); expect(pieces[0]).toMatchObject({ controllerSegmentIndex: 1, startElapsedSeconds: 0.125, coverageThroughElapsedSeconds: 0.2 });
  expect(pieces[0].actors.every(actor => actor.primitive.acceleration.x === 0.4)).toBe(true);
});

it('retains original World-time pose velocity and acceleration through a changed root phase', () => {
  const project = requireRunnerPieceProjection(runnerExecution), input = runnerPieceProjectionInput(), pieces = project({ ...input, throughElapsedSeconds: 0.4 });
  const root = sampleRouteFollowingController(input.controller, input.canonical, 3_400_000), elapsed = 2.4;
  for (const actor of pieces.at(-1)!.actors) {
    const actual = projectedActorState(actor, input.originTick, 0.4), pose = input.source.bodyPose.primitiveMotions.find(part => part.role === actor.primitive.role)!;
    for (const axis of ['x', 'y', 'z'] as const) {
      const base = axis === 'y' ? input.bodyOriginHeightMeters : root.position[axis];
      expect(actual.position[axis]).toBeCloseTo(base + pose.startOffset[axis] + pose.offsetVelocity[axis] * elapsed + 0.5 * pose.offsetAcceleration[axis] * elapsed * elapsed, 11);
    }
  }
});

it.each(['coverage', 'backward', 'clock', 'basis', 'revision', 'controller', 'height', 'shape', 'body_mode'] as const)
('rejects changed %s rather than inventing a new retained controller', kind => {
  const project = requireRunnerPieceProjection(runnerExecution), input = structuredClone(runnerPieceProjectionInput()) as any;
  if (kind === 'coverage') input.throughElapsedSeconds = 1.000001;
  if (kind === 'backward') input.startElapsedSeconds = 0.7;
  if (kind === 'clock') input.originTick = 999_999;
  if (kind === 'basis') input.canonical.position.x += 1;
  if (kind === 'revision') input.source.motionRevision += 1;
  if (kind === 'controller') input.controller.trajectory.segments[0].accelerationMps2 += 1;
  if (kind === 'height') input.bodyOriginHeightMeters += 1;
  if (kind === 'shape') input.shapes.pop();
  if (kind === 'body_mode') input.source.startMotion.bodyMode = 'sliding';
  expect(() => project(input)).toThrow();
});

it('rejects accessor-bearing projection input before executing the getter', () => {
  const project = requireRunnerPieceProjection(runnerExecution), input = runnerPieceProjectionInput(); let called = false;
  expect(() => project({ ...input, get throughElapsedSeconds() { called = true; return 0.6; } })).toThrow(/accessor|inert/);
  expect(called).toBe(false);
});
