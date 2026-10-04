import { expect, it } from 'vitest';
import { findPiecewiseBallWorldBaseBoundary } from './BallWorldBaseBoundary';
import { deriveGloveConstrainedBallWorldFieldMotion } from './BallWorldContinuation';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const prism = (x = 0, z = 0) => ({ region: { center: { x, z }, halfSize: { x: 1, z: 1 }, rotationRadians: 0 }, bottomY: 0, topY: 1 });
const bases = { home: prism(100, 100), first: prism(), second: prism(200, 200), third: prism(300, 300) };
it.each([v(-3, 1.06), v(-3, 1.06, 1.06)])('keeps base edge/corner contact bytes independent of requested stop %j', (position) => {
  const input = { moment: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position, velocity: v(1), spin: v() } },
    acceleration: v(), ticksPerSecond: 1_000_000, ballRadius: 0.1, bases, previousBaseContacts: [] };
  const expected = findPiecewiseBallWorldBaseBoundary({ ...input, throughElapsedSeconds: 5 });
  expect(expected).not.toBeNull();
  for (const throughElapsedSeconds of [2, 2.3, 3, 4.1]) expect(findPiecewiseBallWorldBaseBoundary({ ...input, throughElapsedSeconds })).toEqual(expected);
  expect(findPiecewiseBallWorldBaseBoundary({ ...input, throughElapsedSeconds: 1.9 })).toBeNull();
});
it('uses the same stable root convention for panel edge/corner and complete mixed collider sets', () => {
  const moment = { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(0, 1.1875), velocity: v(1), spin: v() } };
  const actor = (playerId: string, role: 'glove' | 'body', center: ReturnType<typeof v>, velocity = v()) => ({ playerId,
    primitive: { role, radius: 0.3125, startTick: 0, endTick: 5_000_000, ticksPerSecond: 1_000_000, startCenter: center, startVelocity: velocity, acceleration: v() } });
  const input = { moment, parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0, ballRadius: 0.3125 },
    actors: [actor('carrier', 'glove', v(0.625, 1.1875), v(1)), actor('peer', 'body', v(1.25, 0.8125))],
    surfaces: [{ surfaceId: 'panel', start: { x: 1, z: -1 }, end: { x: 1, z: 1 }, minimumHeight: 0, maximumHeight: 1 }],
    bases: { ...bases, first: prism(2) }, previousBaseContacts: [], previousContacts: [{ kind: 'actor' as const, playerId: 'carrier', role: 'glove' as const }],
    acceleration: v(), constraint: { playerId: 'carrier', contactOffset: v(-0.625) } };
  const expected = deriveGloveConstrainedBallWorldFieldMotion({ ...input, throughElapsedSeconds: 2 });
  expect(expected).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: 0.75 }, contacts: [
    { kind: 'actor', playerId: 'carrier', continuing: true }, { kind: 'actor', playerId: 'peer' }, { kind: 'base', baseId: 'first' }, { kind: 'surface', surfaceId: 'panel' }] });
  for (const throughElapsedSeconds of [0.75, 0.8, 1, 1.7]) expect(deriveGloveConstrainedBallWorldFieldMotion({ ...input, throughElapsedSeconds })).toEqual(expected);
});
