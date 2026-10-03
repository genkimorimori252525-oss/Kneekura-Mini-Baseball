import { expect, it } from 'vitest';
import { findBallWorldGroundGatePassage } from './BallWorldGroundGatePassage';
import { quantizeEventTick } from '../sim/ExactEventTime';
import { deriveBallWorldFieldContinuation } from '../sim/ball/BallWorldContinuation';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../sim/ball/BallFlight';
const moment = (x = 1, z = 1, vx = 4, vz = 0) => ({ originTick: 10, elapsedSeconds: 0,
  ball: { tick: 10, position: { x, y: 0.125, z }, velocity: { x: vx, y: 0, z: vz }, spin: { x: 0, y: 0, z: 0 } } });
const input = () => ({ moment: moment(), throughElapsedSeconds: 1, rollingDecelerationMps2: 2, ballRadiusMeters: 0.125,
  ticksPerSecond: 1_000_000, bases: { homePlate: { x: 0, z: 0 }, firstBase: { x: 2, z: 0 },
    secondBase: { x: 2, z: 2 }, thirdBase: { x: 0, z: 2 } } });
it('finds the actual continuous gate crossing along adopted decelerating ground motion', () => {
  const result = findBallWorldGroundGatePassage(input());
  expect(result?.beyond).toEqual({ firstBase: true, thirdBase: false });
  expect(result?.moment.elapsedSeconds).toBeCloseTo(2 - Math.sqrt(3), 14);
  expect(result?.moment.ball.position.x).toBeCloseTo(2, 14);
  expect(result?.moment.ball.tick).toBe(quantizeEventTick(10, result!.moment.elapsedSeconds, 1_000_000));
});
it('does not turn a search horizon, exact gate arrival or stop before a gate into a passage', () => {
  expect(findBallWorldGroundGatePassage({ ...input(), throughElapsedSeconds: 0.125 })).toBeNull();
  expect(findBallWorldGroundGatePassage({ ...input(), rollingDecelerationMps2: 0, throughElapsedSeconds: 0.25 })).toBeNull();
  expect(findBallWorldGroundGatePassage({ ...input(), moment: moment(1, 1, 1), throughElapsedSeconds: 0.5 })).toBeNull();
});
it('retains true order and handles simultaneous first/third gate crossings and outward departure', () => {
  const result = findBallWorldGroundGatePassage({ ...input(), moment: moment(1, 1, 2, 2), rollingDecelerationMps2: 0 });
  expect(result?.beyond).toEqual({ firstBase: true, thirdBase: true });
  expect(result?.moment.elapsedSeconds).toBe(0.5);
  expect(findBallWorldGroundGatePassage({ ...input(), moment: moment(2, 1), rollingDecelerationMps2: 0 })?.moment.elapsedSeconds).toBe(0);
});
it('rejects airborne/caller-result/clock/overflow/unbounded reversal evidence', () => {
  const x = input();
  expect(() => findBallWorldGroundGatePassage({ ...x, moment: { ...x.moment, ball: { ...x.moment.ball,
    position: { ...x.moment.ball.position, y: 1 } } } })).toThrow();
  expect(() => findBallWorldGroundGatePassage({ ...x, territory: 'fair' } as typeof x)).toThrow();
  expect(() => findBallWorldGroundGatePassage({ ...x, throughElapsedSeconds: 3 })).toThrow();
  expect(() => findBallWorldGroundGatePassage({ ...x, ticksPerSecond: 0 })).toThrow();
  expect(() => findBallWorldGroundGatePassage({ ...x, moment: moment(Number.MAX_VALUE), throughElapsedSeconds: Number.MAX_VALUE })).toThrow();
});
it('observes an adopted post-ground airborne bounce rather than recomputing the original flight', () => {
  const start = { ...moment(), ball: { ...moment().ball, velocity: { x: 4, y: 1, z: 0 } } };
  const result = findBallWorldGroundGatePassage({ ...input(), moment: start, throughElapsedSeconds: 0.3,
    rollingDecelerationMps2: 0, gravityY: -4 } as ReturnType<typeof input>);
  expect(result?.moment.elapsedSeconds).toBe(0.25);
  expect(result?.moment.ball.position.y).toBe(0.25);
  expect(result?.moment.ball.velocity.y).toBe(0);
});
it('preserves an explicitly calibrated zero-gravity post-ground segment', () => {
  const start = { ...moment(), ball: { ...moment().ball, velocity: { x: 4, y: 1, z: 0 } } };
  const result = findBallWorldGroundGatePassage({ ...input(), moment: start, throughElapsedSeconds: 0.3,
    rollingDecelerationMps2: 0, gravityY: 0 });
  expect(result?.moment.elapsedSeconds).toBe(0.25);
  expect(result?.moment.ball.position.y).toBe(0.375);
});
it('allows an actual stationary post-stop ground segment without restarting deceleration', () => {
  expect(findBallWorldGroundGatePassage({ ...input(), moment: moment(1, 1, 0), throughElapsedSeconds: 1 })).toBeNull();
});
it('accepts the exact adopted stop deadline despite subtraction roundoff and rejects a later reversal', () => {
  const start = { ...moment(1, 1, 0.4), elapsedSeconds: 0.2,
    ball: { ...moment(1, 1, 0.4).ball, tick: quantizeEventTick(10, 0.2, 1_000_000) } };
  const bag = { region: { center: { x: 100, z: 100 }, halfSize: { x: 1, z: 1 }, rotationRadians: 0 }, bottomY: 0, topY: 1 };
  const adopted = deriveBallWorldFieldContinuation({ moment: start, throughTick: 1_000_010,
    parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, ballRadius: 0.125, groundRollingDecelerationMps2: 4 },
    actors: [], surfaces: [], previousContacts: [], bases: { home: bag, first: bag, second: bag, third: bag }, previousBaseContacts: [] });
  expect(adopted).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'rolling_stop' }] });
  expect(adopted.moment.elapsedSeconds).toBe(0.30000000000000004);
  const query = { ...input(), moment: start, rollingDecelerationMps2: 4, throughElapsedSeconds: adopted.moment.elapsedSeconds };
  expect(findBallWorldGroundGatePassage(query)).toBeNull();
  expect(() => findBallWorldGroundGatePassage({ ...query, throughElapsedSeconds: adopted.moment.elapsedSeconds + 1e-14 })).toThrow();
});
