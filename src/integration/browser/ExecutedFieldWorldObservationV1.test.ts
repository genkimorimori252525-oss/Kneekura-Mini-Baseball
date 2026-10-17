import { expect, it } from 'vitest';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { createSourceBallWorldMotionSessionV1, type SourceBallWorldMotionInputV1 } from '../../core/sim/ball/SourceBallWorldMotionV1';
import { createExecutedFieldWorldObserverV1, type ExecutedFieldWorldRecordingV1 } from './ExecutedFieldWorldObservationV1';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
function fixture(): ExecutedFieldWorldRecordingV1 {
  const descriptor = { kind: 'aero_ground_continuous_source_kernel_v2' as const,
    initial: { originTick: 1000000, elapsedSeconds: .123456789,
      ball: { tick: 1123457, position: v(0, 1, 0), velocity: v(12, 1, 0), spin: v(0, 0, 150) } }, throughElapsedSeconds: .4,
    profile: { kind: 'aero_ground_v1' as const, air: { ticksPerSecond: 1e6, integrationStepTicks: 2000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1e6, radiusM: .0366,
      inertiaRatio: .378, gravityMps2: 9.81, restingVerticalSpeedMps: .15,
      material: { restitution: .4, slidingFriction: .3, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } } };
  const actors = (['body', 'left_foot', 'right_foot'] as const).map((role, i) => ({ playerId: 'fielder',
    startElapsedSeconds: .2, primitive: { role, radius: .1, startTick: 1000000, endTick: 1400000, ticksPerSecond: 1e6,
      startCenter: v(10 + i * .1, i === 0 ? 1 : .1, 10), startVelocity: v(.5, 0, 0), acceleration: v(2, 0, 0) } }));
  const root: SourceBallWorldMotionInputV1 = { version: 'source_ball_world_motion_v1',
    response: { world: { parameters: DEFAULT_BALL_FLIGHT_PARAMETERS, actors, surfaces: [], sourceCurve: descriptor },
      actors: actors.map(a => ({ playerId: a.playerId, profile: { role: a.primitive.role,
        material: { restitution: .2, tangentialDamping: .3, spinDamping: .1 } } })), surfaces: [] },
    cursor: { moment: createSourceFreeBallKernel(descriptor).evaluateAt(.2).moment, sourceCurve: descriptor,
      sourceSide: 'incoming', previousContacts: [] },
    materialOrientationAtSourceBasis: { x: 0, y: 0, z: 0, w: 1 }, heldBats: [], baseGeometry: null };
  const session = createSourceBallWorldMotionSessionV1(root), steps = [session.advance(1255000), session.advance(1310000)];
  return { kind: 'joint_field_successor_executed_v1', source: { sourceId: 'test-only:export', sourceVersion: 'v1' }, root, steps,
    executedThroughMoment: session.snapshot().cursor.moment, physicalExecutionAdmitted: true,
    motionIssued: true, nextMotionAllowed: false, officialResult: null };
}
it('samples actor curves at exact Source offsets and uses stored material orientation without interpolating a bounce', () => {
  const input = fixture(), before = JSON.stringify(input), observed = createExecutedFieldWorldObserverV1(input);
  const frame = observed.observe(.28), original = input.steps[0].state;
  expect(frame.moment).toEqual(original.cursor.moment);
  expect(frame.moment.elapsedSeconds).toBe(.255);
  expect(frame.players[0].bodyPosition.x).toBe(10 + .5 * .055 + .5 * 2 * .055 * .055);
  expect(frame.players[0].anchor.y).toBe(0);
  expect(frame.ball.orientation).toEqual(original.orientation);
  expect(frame.ball.spin).toEqual(original.cursor.moment.ball.spin);
  expect(observed.frames.at(-1)!.atCoverageEnd).toBe(true);
  expect(observed.canIssueMotion).toBe(false);
  expect(observed.provenance).toBe('HOST_EXPORTED_EXECUTION_NOT_BROWSER_AUTHENTICATION');
  expect(JSON.stringify(input)).toBe(before);
});
it('refuses future extrapolation, missing actors, reordered frames, altered equipment or unexecuted candidates', () => {
  const input = fixture(), observer = createExecutedFieldWorldObserverV1(input);
  expect(() => observer.observe(.31000000001)).toThrow(/coverage/);
  expect(() => observer.observe(.19999999999)).toThrow(/coverage/);
  expect(() => createExecutedFieldWorldObserverV1({ ...input, steps: [...input.steps].reverse() })).toThrow(/nonmonotonic/);
  const step = input.steps[0];
  expect(() => createExecutedFieldWorldObserverV1({ ...input,
    steps: [{ ...step, state: { ...step.state, actors: step.state.actors.slice(1) } }, input.steps[1]] })).toThrow(/actor coverage/);
  expect(() => createExecutedFieldWorldObserverV1({ ...input, motionIssued: false } as unknown as ExecutedFieldWorldRecordingV1)).toThrow(/completed/);
  expect(() => createExecutedFieldWorldObserverV1({ ...input,
    executedThroughMoment: { ...input.executedThroughMoment, elapsedSeconds: .32 } })).toThrow(/endpoint/);
});
