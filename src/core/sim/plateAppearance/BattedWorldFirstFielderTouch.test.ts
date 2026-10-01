import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { createFairTerritoryWedge } from '../ball/FairTerritoryGeometry';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../ball/BallFlight';
import { createBattedBallFlightEvidence } from '../ball/BattedBallFlightEvidence';
import { deriveFirstBattedWorldContact, type BattedWorldContactInput } from '../ball/BattedBallWorldContacts';
import type { BatBallContactResult } from '../contact/BatBallContact';
import type { DefenderPhysicalPrimitiveRole } from '../fielding/DefenderPhysicalPrimitive';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact } from './CanonicalPlateAppearanceTimeline';
import { deriveAndRecordBattedWorldFirstFielderTouch } from './BattedWorldFirstFielderTouch';

const field = createFairTerritoryWedge({ homePlate: { x: 0, z: 0 },
  firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 }, thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } });
const physical = (role: DefenderPhysicalPrimitiveRole = 'body', x = 0, playerId = 'actual-defender') => {
  const contact: BatBallContactResult = { tick: 0, ballCenter: { x, y: 1, z: 1 }, point: { x, y: 1, z: 1 },
    batPoint: { x, y: 1, z: 1 }, normal: { x: 0, y: 0, z: 1 }, segmentT: 0.5,
    exitVelocity: { x: 0, y: 0, z: 10 }, exitSpin: { x: 0, y: 0, z: 0 } };
  const flight = createBattedBallFlightEvidence({ contact, parameters: DEFAULT_BALL_FLIGHT_PARAMETERS, searchDurationTicks: 2_000_000 });
  const timeline = recordBatBallContact(createCanonicalPlateAppearanceTimeline({ ruleProfileId: asRuleProfileId('fixture'),
    inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 1 }, 0), contact);
  const primitive = { role, radius: 0.08, startTick: 0, endTick: 2_000_000, ticksPerSecond: 1_000_000,
    startCenter: { x, y: 1, z: 2 }, startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } };
  const world: BattedWorldContactInput = { flight, parameters: DEFAULT_BALL_FLIGHT_PARAMETERS, throughTick: 2_000_000,
    actors: [{ playerId, primitive }], surfaces: [] };
  const result = deriveFirstBattedWorldContact(world);
  return { timeline, world, result, field, defenderIds: ['actual-defender'], flight, primitive };
};

it.each(['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const)('records actual %s touch and then fair territory without asserting possession or play end', (role) => {
  const input = physical(role), value = deriveAndRecordBattedWorldFirstFielderTouch(input);
  expect(value.kind).toBe('recorded');
  if (value.kind !== 'recorded' || input.result.kind !== 'contact') throw new Error('actual physical fixture must touch');
  expect(value.evidence).toMatchObject({ fielderId: 'actual-defender', tick: input.result.tick, ballCenter: input.result.ball.position });
  expect(value.territory).toBe('fair');
  expect(value.timeline.status.kind).toBe('live_ball');
  expect(value.timeline.events.slice(-2).map((e) => e.kind)).toEqual(['BattedBallFirstFielderTouch', 'BattedBallDeclaredFair']);
  expect(value.timeline.events.some((e) => /Catch|Out|Ended|Score/.test(e.kind))).toBe(false);
});

it('keeps an actual foul-side touch pending a true catch decision', () => {
  const input = physical('body', 10), value = deriveAndRecordBattedWorldFirstFielderTouch(input);
  expect(value).toMatchObject({ kind: 'recorded', territory: 'foul_pending_catch', timeline: { status: { kind: 'batted_ball_pending' } } });
  expect(value.timeline.events.at(-1)?.kind).toBe('BattedBallFirstFielderTouch');
});

it.each(['airborne', 'ground', 'surface', 'offense', 'simultaneous'] as const)('keeps %s first contact unresolved without inventing a first defender', (kind) => {
  const input = physical();
  const world: BattedWorldContactInput = kind === 'offense' ? physical('body', 0, 'actual-batter').world
    : { flight: input.flight, parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
      throughTick: kind === 'airborne' ? 1_000 : 2_000_000,
      actors: kind === 'simultaneous' ? [{ playerId: 'actual-defender', primitive: input.primitive },
        { playerId: 'other-defender', primitive: input.primitive }] : [],
      surfaces: kind === 'surface' ? [{ surfaceId: 'wall', start: { x: -2, z: 2 }, end: { x: 2, z: 2 }, minimumHeight: 0, maximumHeight: 3 }] : [] };
  const value = deriveAndRecordBattedWorldFirstFielderTouch({ ...input, world });
  expect(value.kind).toBe('unresolved');
  expect(value.timeline).toEqual(input.timeline);
});

it('rejects invalid identity, clock, radius and duplicate physical evidence', () => {
  const input = physical();
  if (input.result.kind !== 'contact') throw new Error('fixture must contact');
  for (const changed of [{ ...input, defenderIds: ['actual-defender', 'actual-defender'] },
    { ...input, world: { ...input.world, parameters: { ...input.world.parameters, ballRadius: NaN } } },
    { ...input, world: { ...input.world, throughTick: -1 } },
    { ...input, world: { ...input.world, flight: { ...input.flight, initialBall: { ...input.flight.initialBall, tick: 1 } } } }]) {
    expect(() => deriveAndRecordBattedWorldFirstFielderTouch(changed)).toThrow();
  }
  const first = deriveAndRecordBattedWorldFirstFielderTouch(physical('body', 10));
  expect(() => deriveAndRecordBattedWorldFirstFielderTouch({ ...physical('body', 10), timeline: first.timeline })).toThrow('already');
});

it('binds the genuine physical contact proof to the original canonical BatBallContact', () => {
  const fair = physical('body', 0), foul = physical('body', 10);
  expect(deriveAndRecordBattedWorldFirstFielderTouch(fair)).toMatchObject({ territory: 'fair' });
  expect(deriveAndRecordBattedWorldFirstFielderTouch(foul)).toMatchObject({ territory: 'foul_pending_catch' });
  expect(() => deriveAndRecordBattedWorldFirstFielderTouch({ ...fair, world: foul.world })).toThrow('BatBallContact');
});
