import { expect, it } from 'vitest';
import { findBallWorldBaseBoundary, type BallWorldBaseBoundaryInput } from './BallWorldBaseBoundary';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const prism = (x = 0, z = 0, rotationRadians = 0) => ({
  region: { center: { x, z }, halfSize: { x: 1, z: 1 }, rotationRadians }, bottomY: 0, topY: 1,
});
const input = (position = v(-3, 0.5, 0), velocity = v(1, 0, 0)) => ({
  moment: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position, velocity, spin: v(0, 0, 2) } },
  acceleration: v(0, 0, 0), throughElapsedSeconds: 5, ticksPerSecond: 1_000_000, ballRadius: 0.1,
  bases: { home: prism(100, 100), first: prism(), second: prism(200, 200), third: prism(300, 300) }, previousBaseContacts: [],
});
it('stops the actual ball at the first prism face with its true moment and outward normal', () => {
  const result = findBallWorldBaseBoundary(input());
  expect(result).toMatchObject({ moment: { ball: { velocity: { x: 1 } } },
    contacts: [{ kind: 'base', baseId: 'first', point: v(-1, 0.5, 0), normal: v(-1, 0, 0) }] });
  expect(result?.moment.elapsedSeconds).toBeCloseTo(1.9, 12);
  expect(result?.moment.ball.position.x).toBeCloseTo(-1.1, 12);
  expect(result).not.toHaveProperty('ruleResult');
});
it('uses the top face and explicit prism height for a descending ball', () => {
  const result = findBallWorldBaseBoundary(input(v(0, 3, 0), v(0, -1, 0)));
  expect(result?.moment.elapsedSeconds).toBeCloseTo(1.9, 12);
  expect(result?.contacts[0]).toMatchObject({ point: v(0, 1, 0), normal: v(0, 1, 0) });
});
it('meets a rounded edge rather than an expanded rectangular box', () => {
  const query = input(v(-3, 1.06, 0), v(1, 0, 0));
  const result = findBallWorldBaseBoundary(query);
  expect(result?.moment.elapsedSeconds).toBeCloseTo(1.92, 12);
  expect(result?.contacts[0].point).toEqual(v(-1, 1, 0));
  expect(result?.contacts[0].normal?.x).toBeCloseTo(-0.8, 12);
  expect(result?.contacts[0].normal?.y).toBeCloseTo(0.6, 12);
  expect(findBallWorldBaseBoundary(input(v(-3, 1.08, 1.08)))).toBeNull();
});
it('finds a true corner contact and a tangent without admitting a real gap', () => {
  const result = findBallWorldBaseBoundary(input(v(-3, 1.06, 1.06)));
  expect(result?.moment.elapsedSeconds).toBeCloseTo(2 - Math.sqrt(0.01 - 0.0072), 12);
  expect(result?.contacts[0].point).toEqual(v(-1, 1, 1));
  const tangent = findBallWorldBaseBoundary(input(v(-3, 1.1, 0)));
  expect(tangent?.moment.elapsedSeconds).toBeCloseTo(2, 12);
  expect(findBallWorldBaseBoundary(input(v(-3, 1.100001, 0)))).toBeNull();
});
it('rotates the prism and its actual contact normal in World coordinates', () => {
  const query = input(v(0, 0.5, -3), v(0, 0, 1));
  query.bases.first = prism(0, 0, Math.PI / 2);
  const result = findBallWorldBaseBoundary(query);
  expect(result?.moment.elapsedSeconds).toBeCloseTo(1.9, 12);
  expect(result?.contacts[0].normal?.z).toBeCloseTo(-1, 12);
});
it('never extends the actual horizon to reach a future contact', () => {
  expect(findBallWorldBaseBoundary({ ...input(), throughElapsedSeconds: 1.89 })).toBeNull();
  expect(findBallWorldBaseBoundary({ ...input(), ballRadius: 0.125, throughElapsedSeconds: 1.875 })?.moment.elapsedSeconds).toBe(1.875);
});
it('keeps an initial interior overlap as a degenerate contact without inventing push-out', () => {
  const result = findBallWorldBaseBoundary(input(v(0, 0.5, 0)));
  expect(result).toMatchObject({ moment: { elapsedSeconds: 0 }, contacts: [{ baseId: 'first', point: v(0, 0.5, 0), normal: null }] });
});
it('distinguishes different true moments within one recorded tick and preserves exact simultaneous bases', () => {
  const query = { ...input(), ticksPerSecond: 1, ballRadius: 0.1 };
  query.bases.second = prism(0.01, 0);
  expect(findBallWorldBaseBoundary(query)?.contacts.map((c) => c.baseId)).toEqual(['first']);
  query.bases.second = prism();
  expect(findBallWorldBaseBoundary(query)?.contacts.map((c) => c.baseId)).toEqual(['first', 'second']);
});
it('allows a prior contact to depart before an accelerated recontact', () => {
  const query = { ...input(v(-1.1, 0.5, 0), v(-1, 0, 0)), acceleration: v(1, 0, 0), previousBaseContacts: ['first'] as const };
  const result = findBallWorldBaseBoundary(query);
  expect(result?.moment.elapsedSeconds).toBeCloseTo(2, 12);
  expect(result?.contacts[0]).not.toHaveProperty('continuing');
  expect(findBallWorldBaseBoundary({ ...query, throughElapsedSeconds: 1.99 })).toBeNull();
});
it('does not ghost through a previous inward or persistent base contact', () => {
  const inward = { ...input(v(-1.125, 0.5, 0)), ballRadius: 0.125, previousBaseContacts: ['first'] as const };
  expect(findBallWorldBaseBoundary(inward)?.contacts[0]).toMatchObject({ continuing: true });
  const staticQuery = { ...inward, moment: { ...inward.moment, ball: { ...inward.moment.ball, velocity: v(0, 0, 0) } } };
  expect(findBallWorldBaseBoundary(staticQuery)?.contacts[0]).toMatchObject({ continuing: true });
});
it('rejects malformed or incomplete original geometry, clocks and result injection', () => {
  const query = input();
  expect(() => findBallWorldBaseBoundary({ ...query, throughElapsedSeconds: -1 })).toThrow();
  expect(() => findBallWorldBaseBoundary({ ...query, ticksPerSecond: 0 })).toThrow();
  expect(() => findBallWorldBaseBoundary({ ...query, bases: { ...query.bases, first: { ...prism(), topY: 0 } } })).toThrow();
  expect(() => findBallWorldBaseBoundary({ ...query, previousBaseContacts: ['first', 'first'] })).toThrow();
  expect(() => findBallWorldBaseBoundary({ ...query, correctRuleResult: 'fair' } as BallWorldBaseBoundaryInput)).toThrow();
  expect(() => findBallWorldBaseBoundary({ ...query, moment: { ...query.moment, ball: { ...query.moment.ball, tick: 1 } } })).toThrow();
});
