import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type {
  BattedBallContactResponse,
} from '../ball/BattedBallContactResponse';
import {
  deriveFirstBattedWorldContactGeometry,
  type BattedWorldContactInput,
} from '../ball/BattedBallWorldContacts';
import {
  sampleDefenderPhysicalPrimitiveSegment,
  type DefenderPhysicalPrimitiveSample,
} from './DefenderPhysicalPrimitive';

export type BattedBallUninterruptedAcquisitionInput = Readonly<{
  response: BattedBallContactResponse;
  world: BattedWorldContactInput;
}>;

export type BattedBallUninterruptedAcquisitionResult =
  | Readonly<{
      kind: 'acquired';
      fielderId: string;
      gloveContactTick: number;
      secureTick: number;
      secureGlove: DefenderPhysicalPrimitiveSample;
      worldThroughTick: number;
    }>
  | Readonly<{
      kind: 'requires_world_extension';
      fielderId: string;
      gloveContactTick: number;
      secureTick: number;
      worldThroughTick: number;
    }>
  | Readonly<{
      kind: 'not_candidate';
      responseKind: 'airborne' | 'ground' | 'rebound';
    }>
  | Readonly<{
      kind: 'unresolved';
      reason: 'simultaneous' | 'degenerate_normal';
      tick: number;
    }>;

const json = (value: unknown): string => JSON.stringify(
  value,
  (_key, item: unknown) => (
    item !== null
    && typeof item === 'object'
    && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (
            a < b ? -1 : a > b ? 1 : 0
          )),
        )
      : item
  ),
);

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const safeTick = (value: unknown): value is number => (
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= 0
);

/**
 * Turns an actual retained glove contact into secure acquisition only when the
 * same original World primitive owns the complete contact->secure interval.
 *
 * CatchRetention already owns whether the impact is physically retainable and
 * its secure tick. This boundary removes caller `stillRetained` authority for
 * the batted-ball path by requiring uninterrupted coverage from the original
 * continuous glove primitive. It does not decide catch rules, OUT, PlayEnd,
 * scoring or workload.
 */
export const deriveBattedBallUninterruptedAcquisition = (
  raw: BattedBallUninterruptedAcquisitionInput,
): BattedBallUninterruptedAcquisitionResult => {
  const input = cloneInert(raw);
  if (!input?.response || !input.world) {
    throw new Error('invalid batted acquisition input');
  }

  const rederived = deriveFirstBattedWorldContactGeometry(input.world);
  if (json(rederived.world) !== json(input.response.world)) {
    throw new Error('batted acquisition original World differs');
  }

  if (input.response.kind === 'unresolved') {
    const world = input.response.world;
    return freeze({
      kind: 'unresolved',
      reason: input.response.reason,
      tick: world.kind === 'contact'
        ? world.tick
        : world.throughTick,
    });
  }

  if (
    input.response.kind === 'airborne'
    || input.response.kind === 'ground'
    || input.response.kind === 'rebound'
  ) {
    return freeze({
      kind: 'not_candidate',
      responseKind: input.response.kind,
    });
  }

  if (
    input.response.kind !== 'capture_candidate'
    || input.response.retention.outcome.kind !== 'secured'
  ) {
    throw new Error('batted acquisition requires secured capture candidate');
  }
  if (!rederived.geometry) {
    throw new Error('batted acquisition contact geometry is missing');
  }
  if (json(rederived.geometry) !== json(input.response.geometry)) {
    throw new Error('batted acquisition original contact geometry differs');
  }

  const contact = rederived.geometry.contact;
  if (contact.kind !== 'actor' || contact.role !== 'glove') {
    throw new Error('batted acquisition requires sole actual glove contact');
  }

  const retention = input.response.retention.outcome;
  if (
    !safeTick(retention.gloveContactTick)
    || !safeTick(retention.secureTick)
    || retention.secureTick < retention.gloveContactTick
    || retention.gloveContactTick !== rederived.geometry.ball.tick
    || (
      rederived.world.kind !== 'contact'
      || retention.gloveContactTick !== rederived.world.tick
    )
  ) {
    throw new Error('batted acquisition retention timing differs from World contact');
  }

  const actor = input.world.actors.find((candidate) => (
    candidate.playerId === contact.playerId
    && candidate.primitive.role === 'glove'
  ));
  if (!actor) {
    throw new Error('batted acquisition original glove primitive is missing');
  }

  const primitive = actor.primitive;
  if (
    primitive.startTick > retention.gloveContactTick
    || primitive.endTick < retention.gloveContactTick
  ) {
    throw new Error('batted acquisition glove primitive does not own contact tick');
  }

  const worldThroughTick = Math.min(
    input.world.throughTick,
    primitive.endTick,
  );
  if (retention.secureTick > worldThroughTick) {
    return freeze({
      kind: 'requires_world_extension',
      fielderId: contact.playerId,
      gloveContactTick: retention.gloveContactTick,
      secureTick: retention.secureTick,
      worldThroughTick,
    });
  }

  const secureGlove = sampleDefenderPhysicalPrimitiveSegment(
    primitive,
    retention.secureTick,
  );

  return freeze({
    kind: 'acquired',
    fielderId: contact.playerId,
    gloveContactTick: retention.gloveContactTick,
    secureTick: retention.secureTick,
    secureGlove,
    worldThroughTick,
  });
};
