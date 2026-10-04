import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { BattedBallBasePrism } from './BattedBallBaseContact';
import { assertBattedResponseProfiles, type BattedBallContactResponseInput } from './BattedBallContactResponse';
import type { BallContactMaterial } from './BallContactResponse';
import type { BallWorldBaseBoundaryContact } from './BallWorldBaseBoundary';
import { deriveAcceleratedBallWorldFieldMotion, deriveBallWorldFieldContinuation, type BallWorldCollider,
  type BallWorldContinuation, type BallWorldFieldBoundaryContact, type BallWorldFieldContinuation, type AcceleratedBallWorldFieldMotion, type BallWorldMotionActor } from './BallWorldContinuation';
import { createBattedWorldBaseGeometry, type BattedWorldBaseGeometry, type BattedWorldBaseGeometryInput, type BattedWorldBaseId } from './BattedWorldBaseGeometry';
import { respondToBattedWorldBoundary } from './BattedWorldContinuation';
import { deriveBattedWorldMotionActorsAtExactCoverage, deriveBattedWorldMotionActors, type BattedWorldMotion, type BattedWorldMotionInput } from './BattedWorldMotion';

type BaseModels = Readonly<Record<BattedWorldBaseId, Readonly<{ bottomY: number; material: BallContactMaterial }>>>;
export type BattedWorldFieldGeometryInput = Readonly<{ baseGeometry: BattedWorldBaseGeometryInput; baseModels: BaseModels }>;
export type BattedWorldFieldGeometry = Readonly<{ baseGeometry: BattedWorldBaseGeometry; baseModels: BaseModels;
  bases: Readonly<Record<BattedWorldBaseId, BattedBallBasePrism>> }>;
export type BattedWorldFieldMotionInput = BattedWorldMotionInput & Readonly<{ geometry: BattedWorldFieldGeometry }>;
export type InitialBattedWorldFieldMotionInput = Omit<BattedWorldFieldMotionInput, 'cursor' | 'actors' | 'carrierPlayerId'>;
export type BattedWorldFieldMotion = Readonly<{ motion: BattedWorldMotion; baseContacts: readonly BallWorldBaseBoundaryContact[] }>;
const ids = ['home', 'first', 'second', 'third'] as const;
const fields = (v: unknown, names: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
/** Reserved physical identity, never a baseball classification. Native binds it to the immutable original calibration. */
export const battedWorldBaseSurfaceId = (baseId: BattedWorldBaseId): string => {
  if (!ids.includes(baseId)) throw new Error('invalid actual base surface identity');
  return JSON.stringify(['batted-base', baseId]);
};
const baseIdFromCollider = (c: BallWorldCollider) => c.kind === 'surface' ? ids.find((id) => c.surfaceId === battedWorldBaseSurfaceId(id)) : undefined;

/** Explicit fixture shape, thickness and material; there are no inferred standard bags. */
export const createBattedWorldFieldGeometry = (raw: BattedWorldFieldGeometryInput): BattedWorldFieldGeometry => {
  const input = cloneInert(raw);
  if (!fields(input, ['baseGeometry', 'baseModels']) || !fields(input.baseModels, ids)) throw new Error('invalid explicit batted field calibration');
  const sourceGeometry = input.baseGeometry;
  if (!fields(sourceGeometry, ['field', 'bases']) && !fields(sourceGeometry, ['field', 'bases', 'gates'])) throw new Error('invalid original field geometry');
  const baseGeometry = createBattedWorldBaseGeometry({ field: sourceGeometry.field, bases: sourceGeometry.bases });
  if ('gates' in sourceGeometry && JSON.stringify(sourceGeometry.gates) !== JSON.stringify(baseGeometry.gates)) throw new Error('original field gate calibration differs');
  const bases = {} as Record<BattedWorldBaseId, BattedBallBasePrism>;
  for (const id of ids) {
    const model = input.baseModels[id], topY = baseGeometry.bases[id].surfaceHeightMeters;
    if (!fields(model, ['bottomY', 'material']) || !Number.isFinite(model.bottomY) || model.bottomY >= topY
      || !fields(model.material, ['restitution', 'tangentialDamping', 'spinDamping'])
      || !Object.values(model.material).every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
      throw new Error('invalid original bag thickness or material');
    }
    bases[id] = { region: baseGeometry.bases[id].region, bottomY: model.bottomY, topY };
  }
  return freeze({ baseGeometry, baseModels: input.baseModels, bases });
};
const compatibleContact = (c: BallWorldFieldBoundaryContact) => c.kind === 'base'
  ? { kind: 'surface' as const, surfaceId: battedWorldBaseSurfaceId(c.baseId), moment: c.moment, point: c.point, normal: c.normal,
    ...(c.continuing ? { continuing: true as const } : {}) } : c;
const compatibleWorld = (world: BallWorldFieldContinuation | AcceleratedBallWorldFieldMotion): BattedWorldMotion['world'] => {
  if (world.kind !== 'boundary') return world;
  const boundary = { kind: 'boundary' as const, moment: world.moment, contacts: world.contacts.map(compatibleContact),
    ...(world.pendingReason ? { pendingReason: world.pendingReason } : {}) };
  return 'phase' in world ? { ...boundary, phase: world.phase } : boundary;
};

/** Accepted motion uses actual preceding ball/actors; compatible surface records retain explicit base provenance alongside them. */
export const deriveBattedWorldFieldMotion = (raw: BattedWorldFieldMotionInput): BattedWorldFieldMotion => {
  const input = cloneInert(raw);
  if (!fields(input, ['response', 'geometry', 'cursor', 'actors', 'carrierPlayerId', 'availableAtTick', 'throughTick', 'commands'])
    || !fields(input.geometry, ['baseGeometry', 'baseModels', 'bases'])) throw new Error('invalid accepted batted field motion scope');
  const geometry = createBattedWorldFieldGeometry({ baseGeometry: input.geometry.baseGeometry, baseModels: input.geometry.baseModels });
  if (JSON.stringify(geometry) !== JSON.stringify(input.geometry)) throw new Error('actual bag collision geometry differs');
  assertBattedResponseProfiles(input.response);
  if (input.response.world.surfaces.some((surface) => ids.some((id) => surface.surfaceId === battedWorldBaseSurfaceId(id)))) {
    throw new Error('original wall uses reserved base collider identity');
  }
  const { geometry: _, ...motionInput } = input;
  const actors = deriveBattedWorldMotionActors(motionInput);
  return executeFieldMotion(input, actors);
};

const executeFieldMotion = (input: Pick<BattedWorldFieldMotionInput, 'response' | 'geometry' | 'cursor' | 'carrierPlayerId' | 'throughTick'>,
  actors: readonly BallWorldMotionActor[], retained = false): BattedWorldFieldMotion => {
  const moment = input.cursor.moment, p = input.response.world.parameters, geometry = input.geometry;
  const previousBaseContacts = input.cursor.previousContacts.flatMap((c) => { const id = baseIdFromCollider(c); return id ? [id] : []; });
  const previousContacts = input.cursor.previousContacts.filter((c) => !baseIdFromCollider(c));
  const query = { moment, actors, parameters: p, surfaces: input.response.world.surfaces, previousContacts,
    bases: geometry.bases, previousBaseContacts };
  if (input.carrierPlayerId !== null) {
    const glove = actors.find((a) => a.playerId === input.carrierPlayerId && a.primitive.role === 'glove');
    if (!glove) throw new Error('actual field carried glove is missing');
    const dt = retained ? (moment.originTick - glove.primitive.startTick) / p.ticksPerSecond + moment.elapsedSeconds - (glove.startElapsedSeconds ?? 0) : 0;
    const velocity = retained ? { x: glove.primitive.startVelocity.x + glove.primitive.acceleration.x * dt,
      y: glove.primitive.startVelocity.y + glove.primitive.acceleration.y * dt,
      z: glove.primitive.startVelocity.z + glove.primitive.acceleration.z * dt } : glove.primitive.startVelocity;
    const tolerance = Number.EPSILON * Math.max(1, ...Object.values(moment.ball.velocity).map(Math.abs), ...Object.values(velocity).map(Math.abs)) * 32;
    if ((['x', 'y', 'z'] as const).some((axis) => !Number.isFinite(velocity[axis]) || Math.abs(moment.ball.velocity[axis] - velocity[axis]) > tolerance)) {
      throw new Error('actual field carried velocity differs');
    }
    const gloveContact: BallWorldCollider = { kind: 'actor', playerId: input.carrierPlayerId, role: 'glove' };
    if (!previousContacts.some((c) => c.kind === 'actor' && c.playerId === input.carrierPlayerId && c.role === 'glove')) previousContacts.push(gloveContact);
    const field = deriveAcceleratedBallWorldFieldMotion({ ...query, previousContacts, acceleration: glove.primitive.acceleration,
      throughElapsedSeconds: (input.throughTick - moment.originTick) / p.ticksPerSecond });
    const world = compatibleWorld(field), cursor = field.kind === 'boundary' ? null
      : { moment: field.moment, previousContacts: [...input.cursor.previousContacts.filter((c) => c.kind !== 'actor'
        || c.playerId !== input.carrierPlayerId || c.role !== 'glove'), gloveContact] };
    const response = cursor ? { kind: 'carried' as const, cursor } : { kind: 'unresolved' as const, reason: 'carried_contact' as const, cursor: null };
    return freeze({ motion: { actors, carrierPlayerId: input.carrierPlayerId, world, response, cursor },
      baseContacts: field.kind === 'boundary' ? field.contacts.filter((c): c is BallWorldBaseBoundaryContact => c.kind === 'base') : [] });
  }
  const field = deriveBallWorldFieldContinuation({ ...query, throughTick: input.throughTick });
  const world = compatibleWorld(field);
  // The geometry was already executed by the field path. Append only its owned
  // material view for the existing physical response; never re-run an old flight.
  const responseInput: BattedBallContactResponseInput = { ...input.response, surfaces: [...input.response.surfaces,
    ...ids.map((id) => ({ surfaceId: battedWorldBaseSurfaceId(id), material: geometry.baseModels[id].material }))] };
  if (world.kind === 'boundary' && !('phase' in world)) throw new Error('free actual field phase is missing');
  const response = respondToBattedWorldBoundary(responseInput, input.cursor, world as BallWorldContinuation);
  return freeze({ motion: { actors, carrierPlayerId: null, world, response, cursor: response.cursor },
    baseContacts: field.kind === 'boundary' ? field.contacts.filter((c): c is BallWorldBaseBoundaryContact => c.kind === 'base') : [] });
};

/** A fresh field action begins at original bat contact, never at the old forecast's ground/catch result. */
export const deriveInitialBattedWorldFieldMotion = (raw: InitialBattedWorldFieldMotionInput): BattedWorldFieldMotion => {
  const input = cloneInert(raw);
  if (!fields(input, ['response', 'geometry', 'availableAtTick', 'throughTick', 'commands']) || !input.response?.world?.flight?.initialBall) {
    throw new Error('invalid original field motion scope');
  }
  const initial = input.response.world.flight.initialBall;
  return deriveBattedWorldFieldMotion({ ...input, actors: input.response.world.actors, carrierPlayerId: null,
    cursor: { moment: { originTick: initial.tick, elapsedSeconds: 0, ball: initial }, previousContacts: [] } });
};

export type BattedWorldFieldMotionCheckpointInput = Omit<BattedWorldFieldMotionInput, 'throughTick'> & Readonly<{
  coverageThroughTick: number; checkpointThroughTick: number;
}>;
export type BattedWorldFieldRetainedCheckpointInput = Omit<BattedWorldFieldMotionInput, 'throughTick' | 'availableAtTick' | 'commands'> & Readonly<{
  checkpointThroughTick: number;
}>;
const checkpointScope = (input: BattedWorldFieldRetainedCheckpointInput): void => {
  const moment = input.cursor?.moment, p = input.response?.world?.parameters;
  if (!moment || !p || !Number.isSafeInteger(input.checkpointThroughTick) || input.checkpointThroughTick < 0
    || !Number.isFinite(moment.elapsedSeconds) || moment.elapsedSeconds < 0
    || (input.checkpointThroughTick - moment.originTick) / p.ticksPerSecond <= moment.elapsedSeconds
    || !Array.isArray(input.actors) || !input.actors.length
    || input.actors.length !== input.response.actors.length
    || input.carrierPlayerId !== null && (typeof input.carrierPlayerId !== 'string' || !input.carrierPlayerId.length)) {
    throw new Error('invalid actual field motion checkpoint interval');
  }
  const keys = new Set<string>();
  for (const actor of input.actors) {
    const s = actor?.primitive, key = JSON.stringify([actor?.playerId, s?.role]);
    if (!s || keys.has(key) || !Number.isSafeInteger(s.endTick)
      || s.ticksPerSecond !== p.ticksPerSecond || moment.elapsedSeconds > (s.endTick - moment.originTick) / p.ticksPerSecond
      || !input.response.actors.some((a) => a.playerId === actor.playerId && a.profile.role === s.role)) {
      throw new Error('actual field checkpoint original actor coverage differs');
    }
    keys.add(key);
  }
  const geometry = createBattedWorldFieldGeometry({ baseGeometry: input.geometry.baseGeometry, baseModels: input.geometry.baseModels });
  if (JSON.stringify(geometry) !== JSON.stringify(input.geometry)) throw new Error('actual bag collision geometry differs');
  assertBattedResponseProfiles(input.response);
  if (input.response.world.surfaces.some((surface) => ids.some((id) => surface.surfaceId === battedWorldBaseSurfaceId(id)))) {
    throw new Error('original wall uses reserved base collider identity');
  }
};

/** Versioned explicit command adoption: future actor coverage is not an executed ball horizon. */
export const deriveBattedWorldFieldMotionCheckpoint = (raw: BattedWorldFieldMotionCheckpointInput): BattedWorldFieldMotion => {
  const input = cloneInert(raw);
  if (!fields(input, ['response', 'geometry', 'cursor', 'actors', 'carrierPlayerId', 'availableAtTick', 'coverageThroughTick', 'checkpointThroughTick', 'commands'])) {
    throw new Error('invalid accepted actual field motion checkpoint scope');
  }
  checkpointScope(input);
  const { moment } = input.cursor, p = input.response.world.parameters;
  if (!Number.isSafeInteger(input.availableAtTick) || input.availableAtTick < 0
    || (input.availableAtTick - moment.originTick) / p.ticksPerSecond > moment.elapsedSeconds
    || !Number.isSafeInteger(input.coverageThroughTick) || input.coverageThroughTick < 0
    || input.coverageThroughTick < input.checkpointThroughTick
    || (input.coverageThroughTick - moment.originTick) / p.ticksPerSecond <= moment.elapsedSeconds) {
    throw new Error('invalid actual field checkpoint command availability or coverage');
  }
  const actors = deriveBattedWorldMotionActorsAtExactCoverage({ response: input.response, cursor: input.cursor, actors: input.actors,
    carrierPlayerId: input.carrierPlayerId, availableAtTick: input.availableAtTick, throughTick: input.coverageThroughTick, commands: input.commands });
  return checkpointEndpoint(executeFieldMotion({ ...input, throughTick: input.checkpointThroughTick }, actors), input);
};

/** Advances only accepted original curves; no replacement commands, rebase, or coverage renewal. */
export const advanceBattedWorldFieldMotionCheckpoint = (raw: BattedWorldFieldRetainedCheckpointInput): BattedWorldFieldMotion => {
  const input = cloneInert(raw);
  if (!fields(input, ['response', 'geometry', 'cursor', 'actors', 'carrierPlayerId', 'checkpointThroughTick'])) {
    throw new Error('invalid retained actual field motion checkpoint scope');
  }
  checkpointScope(input);
  const { moment } = input.cursor, p = input.response.world.parameters;
  if (input.actors.some((a) => a.primitive.endTick < input.checkpointThroughTick
    || (a.primitive.endTick - moment.originTick) / p.ticksPerSecond <= moment.elapsedSeconds)) {
    throw new Error('retained actual field motion coverage is exhausted');
  }
  return checkpointEndpoint(executeFieldMotion({ ...input, throughTick: input.checkpointThroughTick }, input.actors, true), input);
};

const checkpointEndpoint = (field: BattedWorldFieldMotion, input: BattedWorldFieldRetainedCheckpointInput): BattedWorldFieldMotion => {
  const { motion } = field;
  // Only a contact-free result proves the requested endpoint; never normalize a collision occurrence.
  if (motion.world.kind === 'boundary') return field;
  const moment = { ...motion.world.moment, elapsedSeconds: (input.checkpointThroughTick - input.cursor.moment.originTick) / input.response.world.parameters.ticksPerSecond,
    ball: { ...motion.world.moment.ball, tick: input.checkpointThroughTick } };
  if (!motion.cursor) throw new Error('contact-free actual field checkpoint lacks its cursor');
  const cursor = { ...motion.cursor, moment };
  return freeze({ ...field, motion: { ...motion, world: { ...motion.world, moment }, cursor, response: { ...motion.response, cursor } } } as BattedWorldFieldMotion);
};

export type BattedWorldFieldMotionAdoptionInput = Omit<BattedWorldFieldMotionCheckpointInput, 'checkpointThroughTick'>;
/** Additive zero-time adoption at an exact integer cut. Native proves a newly selected motor. */
export const deriveBattedWorldFieldMotionAdoption = (raw: BattedWorldFieldMotionAdoptionInput): BattedWorldFieldMotion => {
  const input = cloneInert(raw);
  if (!fields(input, ['response', 'geometry', 'cursor', 'actors', 'carrierPlayerId', 'availableAtTick', 'coverageThroughTick', 'commands'])) {
    throw new Error('invalid zero-time actual field adoption scope');
  }
  const moment = input.cursor?.moment, p = input.response?.world?.parameters;
  if (!moment || !p || moment.originTick !== input.response.world.flight.initialBall.tick || (moment.ball.tick - moment.originTick) / p.ticksPerSecond !== moment.elapsedSeconds) {
    throw new Error('zero-time adoption requires an exact integer current cut');
  }
  checkpointScope({ ...input, checkpointThroughTick: input.coverageThroughTick });
  if (input.actors.some((actor) => !input.response.world.actors.some((original) => original.playerId === actor.playerId
    && original.primitive.role === actor.primitive.role && original.primitive.radius === actor.primitive.radius))) {
    throw new Error('zero-time adoption original actor radius differs');
  }
  const actors = deriveBattedWorldMotionActorsAtExactCoverage({ ...input, throughTick: input.coverageThroughTick });
  return executeFieldMotion({ ...input, throughTick: moment.ball.tick }, actors);
};
