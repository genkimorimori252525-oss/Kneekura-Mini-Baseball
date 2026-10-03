import { createDefensiveRatings } from '../../model/DefensiveRatings';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../ball/BallFlight';
import { createBattedBallFlightEvidence } from '../ball/BattedBallFlightEvidence';
import type { BattedBallContactResponseInput } from '../ball/BattedBallContactResponse';
import { createBattedWorldFieldGeometry, deriveInitialBattedWorldFieldMotion } from '../ball/BattedWorldFieldMotion';
import { deriveBattedWorldFieldAcquisition } from '../ball/BattedWorldFieldAcquisition';

export const v = (x: number, y: number, z: number) => ({ x, y, z });
const material = { restitution: 0.5, tangentialDamping: 0, spinDamping: 0 };
export const geometry = (firstX = 3) => {
  const base = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, surfaceHeightMeters: 1 });
  return createBattedWorldFieldGeometry({ baseGeometry: { field: { homePlate: { x: 0, z: 0 },
    firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } }, bases: {
    home: base(0, 0), first: base(firstX, 0), second: base(firstX, 3), third: base(0, 3) } },
    baseModels: { home: { bottomY: 0, material }, first: { bottomY: 0, material }, second: { bottomY: 0, material }, third: { bottomY: 0, material } } });
};
export const fixture = (originTick = 0, power = 1, height = 0.5, z = 0) => {
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
  const response: BattedBallContactResponseInput = { world: { flight: createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 0 }),
    parameters, throughTick: originTick + 5_000_000, actors, surfaces: [] }, actors: actors.map(({ playerId }) => ({ playerId, profile })), surfaces: [] };
  return { response, geometry: geometry(), availableAtTick: originTick, throughTick: originTick + 5_000_000,
    commands: actors.map(({ playerId }) => ({ playerId, role: 'glove' as const, acceleration: v(0, 0, 0) })) };
};
const acquire = (input = fixture()) => deriveBattedWorldFieldAcquisition({ response: input.response, geometry: input.geometry,
  field: deriveInitialBattedWorldFieldMotion(input) });
const ratings = createDefensiveRatings({ positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
  firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
  armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 });
export const throwInput = (input = fixture(), delay = 100_000) => {
  const field = deriveInitialBattedWorldFieldMotion(input), acquisition = acquire(input);
  if (acquisition.kind !== 'secured') throw new Error('secured fixture');
  return { ...input, actors: field.motion.actors, carrierPlayerId: acquisition.acquirerPlayerId, receiverPlayerId: 'receiver',
    cursor: { moment: acquisition.moment, previousContacts: [{ kind: 'actor' as const, playerId: acquisition.acquirerPlayerId, role: 'glove' as const }] },
    ratings, transferParameters: { minimumTransferDelayTicks: delay, maximumTransferDelayTicks: delay, fixedGripOffsetTicks: 0 },
    throwCalibration: { minimumReleaseSpeedMps: 5, maximumReleaseSpeedMps: 5, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 0 },
    seed: { matchSeed: 42, playId: 1, streamKey: 'field-throw' } };
};
