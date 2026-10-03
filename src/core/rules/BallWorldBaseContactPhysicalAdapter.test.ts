import { expect, it } from 'vitest';
import { deriveBallWorldPlayerBaseContactHistory } from '../sim/ball/BallWorldPlayerBaseContactHistory';
import { findBallWorldControlledBaseContacts } from '../sim/ball/BallWorldControlledBaseContacts';
import { createRunnerBaseFactsFromBallWorldHistory, createControlledBaseFactsFromBallWorldContacts } from './BallWorldBaseContactPhysicalAdapter';

const history = (standing = false) => deriveBallWorldPlayerBaseContactHistory({ playerId: 'player',
  base: { center: { x: 0, z: 0 }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 }, baseSurfaceHeightMeters: 0,
  segments: [{ originTick: 2 ** 52, startElapsedSeconds: 0, endElapsedSeconds: 4,
    actors: (['left_foot', 'right_foot'] as const).map((role) => ({ playerId: 'player', primitive: { role, radius: 0.1,
      startTick: 2 ** 52, endTick: 2 ** 52 + 4_000_000, ticksPerSecond: 1_000_000,
      startCenter: { x: standing ? 0 : 3, y: 0, z: 0 }, startVelocity: { x: standing ? 0 : -4, y: 0, z: 0 },
      acceleration: { x: standing ? 0 : 2, y: 0, z: 0 } } })) }] });
it('projects actual touch/departure/retouch chronology into existing rule facts without deciding occupancy or an official result', () => {
  const actual = history(), facts = createRunnerBaseFactsFromBallWorldHistory({ history: actual, base: 'first' });
  expect(facts.map((f) => f.kind)).toEqual(['runner_base_touch', 'runner_base_departure', 'runner_base_touch', 'runner_base_departure']);
  expect(facts.map((f) => f.tick)).toEqual(actual.events.map((f) => f.tick));
  expect(facts.every((f) => f.runnerId === 'player' && f.base === 1)).toBe(true);
  expect(facts).not.toHaveProperty('out'); expect(facts).not.toHaveProperty('basesAfter');
});
it('retains an actual initial home contact as a physical fact without turning an open horizon into departure or run scoring', () => {
  expect(createRunnerBaseFactsFromBallWorldHistory({ history: history(true), base: 'home' })).toEqual([
    { kind: 'runner_base_touch', runnerId: 'player', base: 4, tick: 2 ** 52 }]);
});
it('projects only actual secured contact using its recorded tick and actual Player/base identity', () => {
  const actual = history(true), contacts = findBallWorldControlledBaseContacts({ history: actual,
    controlWindows: [{ startElapsedSeconds: 1.0000000004, endElapsedSeconds: 2, endInclusive: false }] });
  expect(createControlledBaseFactsFromBallWorldContacts({ history: actual, base: 'first', contacts })).toEqual([
    { kind: 'controlled_base_contact', defenderId: 'player', base: 1, tick: 2 ** 52 + 1_000_001 }]);
});
it.each(['player', 'origin', 'tick', 'future', 'airborne', 'duplicate'] as const)('rejects %s controlled facts outside the actual owned foot history', (kind) => {
  const actual = history(), valid = { playerId: 'player', originTick: actual.originTick, elapsedSeconds: actual.events[0].elapsedSeconds, tick: actual.events[0].tick };
  const changed = { ...valid, playerId: kind === 'player' ? 'other' : valid.playerId, originTick: kind === 'origin' ? 0 : valid.originTick,
    elapsedSeconds: kind === 'future' ? 5 : kind === 'airborne' ? 2 : valid.elapsedSeconds, tick: kind === 'tick' ? valid.tick + 1 : valid.tick };
  expect(() => createControlledBaseFactsFromBallWorldContacts({ history: actual, base: 'first', contacts: kind === 'duplicate' ? [valid, valid] : [changed] })).toThrow();
});
it.each([2.5, 4.75])('projects one exact %s-second tangency without fabricated runner retouch facts', (seconds) => {
  const actual = deriveBallWorldPlayerBaseContactHistory({ playerId: 'player',
    base: { center: { x: 0, z: 0 }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 }, baseSurfaceHeightMeters: 0,
    segments: [{ originTick: 0, startElapsedSeconds: 0, endElapsedSeconds: 5,
      actors: (['left_foot', 'right_foot'] as const).map((role) => ({ playerId: 'player',
        primitive: { role, radius: 0.1, startTick: 0, endTick: 5_000_000, ticksPerSecond: 1_000_000,
          startCenter: { x: 0, y: seconds * seconds, z: 0 }, startVelocity: { x: 0, y: -2 * seconds, z: 0 },
          acceleration: { x: 0, y: 2, z: 0 } } })) }] });
  expect(createRunnerBaseFactsFromBallWorldHistory({ history: actual, base: 'first' })).toEqual([
    { kind: 'runner_base_touch', runnerId: 'player', base: 1, tick: seconds * 1_000_000 },
    { kind: 'runner_base_departure', runnerId: 'player', base: 1, tick: seconds * 1_000_000 },
  ]);
});
it('rejects a changed recorded runner tick rather than transporting it into RuleEngine', () => {
  const actual = history(), changed = { ...actual, events: actual.events.map((e, i) => i ? e : { ...e, tick: e.tick + 1 }) };
  expect(() => createRunnerBaseFactsFromBallWorldHistory({ history: changed, base: 'first' })).toThrow();
});
