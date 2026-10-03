import { expect, it } from 'vitest';
import { createDefensiveRatings } from '../../model/DefensiveRatings';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import { createBattedWorldFieldGeometry, deriveInitialBattedWorldFieldMotion, deriveBattedWorldFieldMotion,
  battedWorldBaseSurfaceId } from './BattedWorldFieldMotion';
import { deriveBattedWorldFieldAcquisition } from './BattedWorldFieldAcquisition';
import { deriveBattedWorldFieldThrow } from './BattedWorldFieldThrow';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const material = { restitution: 0.5, tangentialDamping: 0, spinDamping: 0 };
const geometry = (firstX = 3) => {
  const base = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, surfaceHeightMeters: 1 });
  return createBattedWorldFieldGeometry({ baseGeometry: { field: { homePlate: { x: 0, z: 0 },
    firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } }, bases: {
    home: base(0, 0), first: base(firstX, 0), second: base(firstX, 3), third: base(0, 3) } },
    baseModels: { home: { bottomY: 0, material }, first: { bottomY: 0, material }, second: { bottomY: 0, material }, third: { bottomY: 0, material } } });
};
const fixture = (originTick = 0, power = 1, height = 0.5, z = 0) => {
  const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0, ballRadius: 0.125 };
  const contact = { tick: originTick, ballCenter: v(1, height, z), point: v(1, height, z), batPoint: v(1, height, z), normal: v(1, 0, 0),
    segmentT: 0.5, exitVelocity: v(2, 0, 0), exitSpin: v(0, 0, 0) };
  const actors = ['carrier', 'receiver'].map((playerId) => ({ playerId, primitive: { role: 'glove' as const, radius: 0.125,
    startTick: originTick, endTick: originTick + 5_000_000, ticksPerSecond: parameters.ticksPerSecond,
    startCenter: playerId === 'carrier' ? v(1.25, height, z) : v(-10, height, z),
    startVelocity: playerId === 'carrier' ? v(1, 0, 0) : v(0, 0, 0), acceleration: v(0, 0, 0) } }));
  const profile = { role: 'glove' as const, pocketCenterOffset: v(-0.25, 0, 0), bodyStability: 1,
    parameters: { ticksPerSecond: parameters.ticksPerSecond, ballMassKg: 0.125, ballRadiusMeters: 0.125, pocketRadiusMeters: 1,
      centerRetentionCapacityJ: 1000, captureDissipationPowerW: power, failedContactRestitution: 0.5, failedTangentialDamping: 0, failedSpinDamping: 0 } };
  const response: BattedBallContactResponseInput = { world: { flight: createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 5_000_000 }),
    parameters, throughTick: originTick + 5_000_000, actors, surfaces: [] }, actors: actors.map(({ playerId }) => ({ playerId, profile })), surfaces: [] };
  return { response, geometry: geometry(), availableAtTick: originTick, throughTick: originTick + 5_000_000,
    commands: actors.map(({ playerId }) => ({ playerId, role: 'glove' as const, acceleration: v(0, 0, 0) })) };
};
const acquire = (input = fixture()) => deriveBattedWorldFieldAcquisition({ response: input.response, geometry: input.geometry,
  field: deriveInitialBattedWorldFieldMotion(input) });
const ratings = createDefensiveRatings({ positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
  firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
  armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 });
const throwInput = (input = fixture(), delay = 100_000) => {
  const field = deriveInitialBattedWorldFieldMotion(input), acquisition = acquire(input);
  if (acquisition.kind !== 'secured') throw new Error('secured fixture');
  return { ...input, actors: field.motion.actors, carrierPlayerId: acquisition.acquirerPlayerId, receiverPlayerId: 'receiver',
    cursor: { moment: acquisition.moment, previousContacts: [{ kind: 'actor' as const, playerId: acquisition.acquirerPlayerId, role: 'glove' as const }] },
    ratings, transferParameters: { minimumTransferDelayTicks: delay, maximumTransferDelayTicks: delay, fixedGripOffsetTicks: 0 },
    throwCalibration: { minimumReleaseSpeedMps: 5, maximumReleaseSpeedMps: 5, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 0 },
    seed: { matchSeed: 42, playId: 1, streamKey: 'field-throw' } };
};

it('secures at the actual energy deadline, preserves glove offset, and continues field custody', () => {
  const input = fixture(), result = acquire(input);
  expect(result.kind).toBe('secured'); if (result.kind !== 'secured') throw new Error('secured fixture');
  expect(result.moment.elapsedSeconds).toBe(0.0625);
  expect(result.moment.ball.position).toEqual(v(1.0625, 0.5, 0));
  expect(result.moment.ball.velocity).toEqual(v(1, 0, 0));
  expect(result.transport).toEqual({ kind: 'glove_constraint', contactOffset: v(-0.25, 0, 0), initialEnergyJ: 0.0625, remainingEnergyJ: 0 });
  expect(result.baseContacts).toEqual([]);
  const carry = deriveBattedWorldFieldMotion({ ...input, actors: input.response.world.actors, carrierPlayerId: result.acquirerPlayerId,
    cursor: { moment: result.moment, previousContacts: [{ kind: 'actor', playerId: result.acquirerPlayerId, role: 'glove' }] } });
  expect(carry.baseContacts).toMatchObject([{ baseId: 'first', moment: { elapsedSeconds: 1.625 } }]);
  expect(carry.motion.response).toMatchObject({ kind: 'unresolved', reason: 'carried_contact' });
  expect(result).not.toHaveProperty('catch'); expect(result).not.toHaveProperty('playEnd');
});
it('interrupts retention at an actual bag face with undissipated capture energy and no drop', () => {
  const input = { ...fixture(0, 0.03125), geometry: geometry() }, result = acquire(input);
  expect(result.kind).toBe('interrupted'); if (result.kind !== 'interrupted') throw new Error('interrupted fixture');
  expect(result.reason).toBe('contact'); expect(result.world.moment.elapsedSeconds).toBe(1.625);
  expect(result.baseContacts).toMatchObject([{ kind: 'base', baseId: 'first' }]);
  expect(result.world.contacts).toContainEqual(expect.objectContaining({ kind: 'surface', surfaceId: battedWorldBaseSurfaceId('first') }));
  expect(result.world.contacts).toContainEqual(expect.objectContaining({ kind: 'actor', playerId: 'carrier', continuing: true }));
  expect(result.transport.remainingEnergyJ).toBe(0.01171875);
  expect(result).not.toHaveProperty('secureTick'); expect(result).not.toHaveProperty('ballAfterDrop');
});
it('preserves exact bag and wall simultaneous contacts during securing', () => {
  const input = fixture(0, 0.03125), wall = { surfaceId: 'wall', start: { x: 2.75, z: -1 }, end: { x: 2.75, z: 1 }, minimumHeight: 0, maximumHeight: 2 };
  const result = acquire({ ...input, response: { ...input.response, world: { ...input.response.world, surfaces: [wall] }, surfaces: [{ surfaceId: 'wall', material }] } });
  expect(result.kind).toBe('interrupted'); if (result.kind !== 'interrupted') throw new Error('interrupted fixture');
  expect(result.world.contacts.map((c) => c.kind === 'surface' ? c.surfaceId : c.kind)).toEqual(['actor', battedWorldBaseSurfaceId('first'), 'wall']);
  expect(result.baseContacts).toHaveLength(1);
});
it('checks the rest of the recorded secure tick for a competing bag contact', () => {
  const input = fixture(0, 1), elapsed = 0.06250025;
  const changed = { ...input, geometry: geometry(1 + elapsed + 0.375), response: { ...input.response,
    actors: input.response.actors.map((actor) => actor.profile.role !== 'glove' ? actor : ({ ...actor, profile: { ...actor.profile, parameters: {
      ...actor.profile.parameters, captureDissipationPowerW: 0.0625 / 0.0625001 } } })) } };
  const result = acquire(changed);
  expect(result.kind).toBe('interrupted'); if (result.kind !== 'interrupted') throw new Error('interrupted fixture');
  expect(result.reason).toBe('same_tick_competition'); expect(result.candidateSecureTick).toBe(62_501);
  expect(result.world.moment.elapsedSeconds).toBeCloseTo(elapsed, 14);
  expect(result.baseContacts[0].baseId).toBe('first'); expect(result.transport.remainingEnergyJ).toBe(0);
});
it('rejects stale candidate response, forged bag geometry, and incomplete response profiles', () => {
  const input = fixture(), field = deriveInitialBattedWorldFieldMotion(input);
  expect(() => deriveBattedWorldFieldAcquisition({ response: input.response, geometry: { ...input.geometry,
    bases: { ...input.geometry.bases, first: { ...input.geometry.bases.first, topY: 100 } } }, field })).toThrow();
  expect(() => deriveBattedWorldFieldAcquisition({ response: { ...input.response, actors: [] }, geometry: input.geometry, field })).toThrow();
  expect(() => deriveBattedWorldFieldAcquisition({ response: input.response, geometry: input.geometry, field: { ...field,
    motion: { ...field.motion, response: { kind: 'capture_candidate', cursor: null, moment: field.motion.world.moment,
      retention: { outcome: { kind: 'secured', gloveContactTick: 0, secureTick: 0 }, diagnostics: { relativeVelocity: v(0, 0, 0), translationalEnergyJ: 0,
        rotationalEnergyJ: 0, retentionLoadJ: 0, pocketFactor: 1, effectiveCapacityJ: 1000 } } } } } })).toThrow();
});
it('requires actual sole glove contact rather than a simultaneous bag candidate', () => {
  const input = { ...fixture(), geometry: geometry(1.375) }, field = deriveInitialBattedWorldFieldMotion(input);
  expect(field.motion.response.kind).toBe('unresolved');
  expect(() => deriveBattedWorldFieldAcquisition({ response: input.response, geometry: input.geometry, field })).toThrow(/candidate/);
});
it('keeps field acquisition geometry and transport identical at a large original clock', () => {
  const a = acquire(), b = acquire(fixture(2 ** 52));
  expect(b.transport).toEqual(a.transport); expect(b.contactMoment.ball.position).toEqual(a.contactMoment.ball.position);
  expect(a.kind).toBe('secured'); expect(b.kind).toBe('secured');
  if (a.kind !== 'secured' || b.kind !== 'secured') throw new Error('secured fixture');
  expect(b.moment.ball.position).toEqual(a.moment.ball.position); expect(b.secureTick).toBe(2 ** 52 + a.secureTick);
});
it('uses the same bag-aware query during transfer and never releases through a carried interruption', () => {
  const input = throwInput(fixture(), 2_000_000), result = deriveBattedWorldFieldThrow(input);
  expect(result.kind).toBe('interrupted'); expect(result).not.toHaveProperty('releaseCursor'); expect(result).not.toHaveProperty('launch');
  expect(result.field.baseContacts).toMatchObject([{ baseId: 'first', moment: { elapsedSeconds: 1.625 } }]);
  expect(result.field.motion.response).toEqual({ kind: 'unresolved', reason: 'carried_contact', cursor: null });
  expect(result.field.motion.carrierPlayerId).toBe('carrier');
});
it('releases from the carried ball offset and uses actual bags in the free throw path', () => {
  const input = throwInput(), result = deriveBattedWorldFieldThrow(input);
  expect(result.kind).toBe('released'); if (result.kind !== 'released') throw new Error('released fixture');
  expect(result.launch.origin).toEqual(v(1.1625, 0.5, 0)); expect(result.releaseCursor.moment.elapsedSeconds).toBe(0.1625);
  expect(result.field.motion.carrierPlayerId).toBeNull(); expect(result.field.baseContacts[0].baseId).toBe('home');
  expect(result.field.motion.response.kind).toBe('rebound'); expect(result.field.motion.cursor?.moment.ball.velocity).toEqual(v(2.5, 0, 0));
  expect(result.field.motion.world.moment.elapsedSeconds).toBeCloseTo(0.32, 12);
});
it('supports zero transfer at a large exact clock', () => {
  const input = throwInput(fixture(2 ** 52), 0), result = deriveBattedWorldFieldThrow(input);
  expect(result.kind).toBe('released'); if (result.kind !== 'released') throw new Error('released fixture');
  expect(result.launch.origin).toEqual(v(1.0625, 0.5, 0)); expect(result.launch.releaseTick).toBe(2 ** 52 + 62_500);
});
it('rejects result injection, invalid release horizon, and mismatched bag models', () => {
  const input = throwInput();
  expect(() => deriveBattedWorldFieldThrow({ ...input, out: true } as typeof input)).toThrow();
  expect(() => deriveBattedWorldFieldThrow({ ...input, throughTick: 100_000 })).toThrow();
  expect(() => deriveBattedWorldFieldThrow({ ...input, geometry: { ...input.geometry, bases: { ...input.geometry.bases,
    first: { ...input.geometry.bases.first, topY: 2 } } } })).toThrow();
});
it('requires actor coverage through the secure deadline and recorded competition fence', () => {
  const input = fixture(), field = deriveInitialBattedWorldFieldMotion(input);
  expect(() => deriveBattedWorldFieldAcquisition({ response: input.response, geometry: input.geometry, field: { ...field,
    motion: { ...field.motion, actors: field.motion.actors.map((actor) => ({ ...actor, primitive: { ...actor.primitive, endTick: 62_499 } })) } } })).toThrow(/coverage/);
});
it('interrupts on an exact secure-deadline bag contact with zero remaining energy', () => {
  const result = acquire({ ...fixture(), geometry: geometry(1.4375) });
  expect(result.kind).toBe('interrupted'); if (result.kind !== 'interrupted') throw new Error('interrupted fixture');
  expect(result.reason).toBe('contact'); expect(result.world.moment.elapsedSeconds).toBe(0.0625);
  expect(result.transport.remainingEnergyJ).toBe(0); expect(result).not.toHaveProperty('secureTick');
});
it('retains rotational capture energy and advances curved glove transport without snapping the contact offset', () => {
  const input = fixture(), flight = input.response.world.flight;
  const contact = { tick: 0, ballCenter: v(1, 0.5, 0), point: v(1, 0.5, 0), batPoint: v(1, 0.5, 0), normal: v(1, 0, 0),
    segmentT: 0.5, exitVelocity: v(2, 0, 0), exitSpin: v(0, 0, 4) };
  const response = { ...input.response, world: { ...input.response.world,
    flight: createBattedBallFlightEvidence({ contact, parameters: input.response.world.parameters, searchDurationTicks: 5_000_000 }) } };
  const commands = input.commands.map((command) => command.playerId !== 'carrier' ? command : { ...command, acceleration: v(0, 2, 0) });
  const field = deriveInitialBattedWorldFieldMotion({ ...input, response, commands });
  const result = deriveBattedWorldFieldAcquisition({ response, geometry: input.geometry, field });
  expect(result.kind).toBe('secured'); if (result.kind !== 'secured') throw new Error('secured fixture');
  expect(result.transport.initialEnergyJ).toBe(0.06875);
  expect(result.transport.contactOffset).toEqual(v(-0.25, 0, 0));
  expect(result.moment.ball.position.y).toBeCloseTo(0.5 + 0.06875 ** 2, 14);
  expect(result.moment.ball.velocity.y).toBeCloseTo(2 * 0.06875, 14);
  expect(result.moment.ball.spin).toEqual(v(0, 0, 0)); expect(flight.initialBall.spin).toEqual(v(0, 0, 0));
});
it('releases at the recorded transfer basis after a fractional secure deadline without resetting the ball', () => {
  const input = fixture(0, 0.0625 / 0.0625001), result = deriveBattedWorldFieldThrow(throwInput(input, 0));
  expect(result.kind).toBe('released'); if (result.kind !== 'released') throw new Error('released fixture');
  expect(result.releaseCursor.moment.elapsedSeconds).toBe(0.062501);
  expect(result.launch.origin.x).toBeCloseTo(1.062501, 14); expect(result.launch.releaseTick).toBe(62_501);
});
it('turns the actual receiver contact into another candidate and requires a separate field acquisition', () => {
  const input = fixture(0, 1, 2), result = deriveBattedWorldFieldThrow(throwInput(input));
  expect(result.kind).toBe('released'); expect(result.field.motion.response.kind).toBe('capture_candidate');
  expect(result.field.motion.cursor).toBeNull(); expect(result.field.baseContacts).toEqual([]);
  const acquired = deriveBattedWorldFieldAcquisition({ response: input.response, geometry: input.geometry, field: result.field });
  expect(acquired.kind).toBe('secured'); expect(acquired.acquirerPlayerId).toBe('receiver');
  expect(acquired.contactMoment.elapsedSeconds).toBeCloseTo(2.345, 12); expect(acquired.transport.contactOffset.x).toBeCloseTo(0.25, 12);
});
it('samples the accelerated receiver at release and keeps the actual carried acceleration', () => {
  const input = throwInput(fixture(0, 1, 2)), commands = input.commands.map((command) => ({ ...command,
    acceleration: command.playerId === 'carrier' ? v(2, 0, 0) : v(0, 0, 4) }));
  const result = deriveBattedWorldFieldThrow({ ...input, commands });
  expect(result.kind).toBe('released'); if (result.kind !== 'released') throw new Error('released fixture');
  expect(result.launch.origin.x).toBeCloseTo(1.1725, 12);
  expect(result.launch.intendedTarget.z).toBeCloseTo(0.02, 12);
});
it('keeps exact coincident bag and wall evidence after release without choosing a material response', () => {
  const input = fixture(), wall = { surfaceId: 'wall', start: { x: 0.25, z: -1 }, end: { x: 0.25, z: 1 }, minimumHeight: 0, maximumHeight: 2 };
  const changed = { ...input, response: { ...input.response, world: { ...input.response.world, surfaces: [wall] }, surfaces: [{ surfaceId: 'wall', material }] } };
  const result = deriveBattedWorldFieldThrow(throwInput(changed));
  expect(result.kind).toBe('released'); expect(result.field.baseContacts).toHaveLength(1);
  expect(result.field.motion.response).toEqual({ kind: 'unresolved', reason: 'simultaneous', cursor: null });
  expect(result.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [
    { kind: 'surface', surfaceId: battedWorldBaseSurfaceId('home') }, { kind: 'surface', surfaceId: 'wall' }] });
});
it.each([
  { name: 'rounded edge', height: 1.075, z: 0, seconds: 1.65 },
  { name: 'rounded corner', height: 1.075, z: 0.325, seconds: 1.75 - Math.sqrt(0.125 ** 2 - 2 * 0.075 ** 2) },
  { name: 'exact tangent', height: 1.125, z: 0, seconds: 1.75 },
])('uses the sphere/prism $name during actual capture transport', ({ height, z, seconds }) => {
  const result = acquire(fixture(0, 0.03125, height, z));
  expect(result.kind).toBe('interrupted'); if (result.kind !== 'interrupted') throw new Error('interrupted fixture');
  expect(result.baseContacts[0].baseId).toBe('first');
  expect(result.world.moment.elapsedSeconds).toBeCloseTo(seconds, 12);
  expect(result.world.moment.ball.position.y).toBe(height); expect(result.world.moment.ball.position.z).toBe(z);
});
it('does not invent a bag contact through a real sphere/prism gap during securing', () => {
  const result = acquire(fixture(0, 0.03125, 1.125001));
  expect(result.kind).toBe('secured'); expect(result.baseContacts).toEqual([]);
  if (result.kind !== 'secured') throw new Error('secured fixture');
  expect(result.moment.elapsedSeconds).toBe(2); expect(result.moment.ball.position.y).toBe(1.125001);
});
it('does not ghost a released ball through its own still-contacting glove', () => {
  const input = fixture(), response = { ...input.response, world: { ...input.response.world,
    actors: input.response.world.actors.map((actor) => actor.playerId !== 'receiver' ? actor : { ...actor,
      primitive: { ...actor.primitive, startCenter: v(10, 0.5, 0) } }) } };
  const result = deriveBattedWorldFieldThrow(throwInput({ ...input, response }));
  expect(result.kind).toBe('released'); expect(result.field.motion.response).toEqual({ kind: 'unresolved', reason: 'persistent_contact', cursor: null });
  expect(result.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'actor', playerId: 'carrier', continuing: true }] });
  expect(result.field.baseContacts).toEqual([]);
});
