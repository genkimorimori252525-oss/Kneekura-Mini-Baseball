import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { BallWorldMoment } from './BallWorldContinuation';
import type { BattedWorldFieldMotionAdoptionInput } from './BattedWorldFieldMotion';
import { deriveSourceBattedFieldMotionV3, type SourceBattedFieldMotionTraceV3 } from './SourceBattedFieldMotionV3';

export type FieldIntegerBoundaryV1 = Readonly<{
  version: 'field_integer_boundary_v1'; originTick: number; ticksPerSecond: number;
  fromElapsedSeconds: number; boundaryTick: number; boundaryElapsedSeconds: number; waitSeconds: number;
}>;
const fields = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...keys].sort().join('|');

/** Arithmetic only. Unlike the tolerance event quantizer or the last included
 * generation instant, this is the first integer-clock instant at or after the
 * exact physical moment. It does not authorize a motor, custody or a Source. */
export const deriveFieldIntegerBoundaryV1 = (raw: Readonly<{
  originTick: number; elapsedSeconds: number; ticksPerSecond: number;
}>): FieldIntegerBoundaryV1 => {
  const input = cloneInert(raw);
  if (!fields(input, ['originTick', 'elapsedSeconds', 'ticksPerSecond'])
    || !Number.isSafeInteger(input.originTick) || input.originTick < 0
    || !Number.isFinite(input.elapsedSeconds) || input.elapsedSeconds < 0
    || !Number.isSafeInteger(input.ticksPerSecond) || input.ticksPerSecond <= 0) {
    throw new Error('invalid field integer boundary clock');
  }
  // Compare the same relative division used by actual locomotion. Multiplying
  // and then applying ceil can move a representable exact boundary forward.
  let lower = 0, upper = Number.MAX_SAFE_INTEGER - input.originTick;
  if (upper / input.ticksPerSecond < input.elapsedSeconds) throw new Error('field integer boundary overflow');
  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    if (middle / input.ticksPerSecond >= input.elapsedSeconds) upper = middle;
    else lower = middle + 1;
  }
  const boundaryElapsedSeconds = lower / input.ticksPerSecond;
  return Object.freeze({ version: 'field_integer_boundary_v1', originTick: input.originTick,
    ticksPerSecond: input.ticksPerSecond, fromElapsedSeconds: input.elapsedSeconds,
    boundaryTick: input.originTick + lower, boundaryElapsedSeconds,
    waitSeconds: boundaryElapsedSeconds - input.elapsedSeconds });
};

export type SourceFieldIntegerCheckpointV1 = Readonly<{
  version: 'source_field_integer_checkpoint_v1';
  kind: 'already_at_integer_boundary' | 'reached_integer_boundary' | 'physical_boundary';
  boundary: FieldIntegerBoundaryV1; startMoment: BallWorldMoment; trace: SourceBattedFieldMotionTraceV3;
}>;

/** Replay the complete original stationary V3 history, then execute its positive
 * fractional wait on the same ball basis and actor curves. Even when ball.tick
 * is unchanged this is real physical time: an earlier contact stops the wait.
 *
 * The appended horizon is a Core replay request, not an accepted Native step:
 * it may be smaller than a previous requested horizon that stopped at contact.
 * Native needs an explicit versioned contract before admitting this operation.
 * No caller cursor, certificate, command, body adoption or custody is accepted. */
export const advanceSourceFieldToIntegerBoundaryV1 = (raw: Readonly<{
  initial: BattedWorldFieldMotionAdoptionInput; throughTicks: readonly number[];
}>): SourceFieldIntegerCheckpointV1 => {
  const input = cloneInert(raw);
  if (!fields(input, ['initial', 'throughTicks']) || !Array.isArray(input.throughTicks)) {
    throw new Error('invalid Source field integer checkpoint history');
  }
  const before = deriveSourceBattedFieldMotionV3(input), cursor = before.field.motion.cursor;
  if (!cursor?.sourceCurve || before.field.motion.carrierPlayerId !== null) {
    throw new Error('Source field integer checkpoint requires a resolved free cursor');
  }
  const startMoment = cursor.moment;
  const boundary = deriveFieldIntegerBoundaryV1({ originTick: startMoment.originTick,
    elapsedSeconds: startMoment.elapsedSeconds, ticksPerSecond: input.initial.response.world.parameters.ticksPerSecond });
  if (boundary.waitSeconds === 0) return Object.freeze({ version: 'source_field_integer_checkpoint_v1',
    kind: 'already_at_integer_boundary', boundary, startMoment, trace: before });
  const trace = deriveSourceBattedFieldMotionV3({ initial: input.initial, throughTicks: [...input.throughTicks, boundary.boundaryTick] });
  const field = trace.field, after = field.motion.cursor;
  if (field.motion.world.kind === 'boundary') return Object.freeze({ version: 'source_field_integer_checkpoint_v1',
    kind: 'physical_boundary', boundary, startMoment, trace });
  if (!after?.sourceCurve || after.moment.originTick !== startMoment.originTick
    || after.moment.elapsedSeconds !== boundary.boundaryElapsedSeconds || after.moment.ball.tick !== boundary.boundaryTick
    || JSON.stringify(after.sourceCurve.initial) !== JSON.stringify(cursor.sourceCurve.initial)
    || JSON.stringify(after.sourceCurve.profile) !== JSON.stringify(cursor.sourceCurve.profile)
    || JSON.stringify(field.motion.actors) !== JSON.stringify(before.field.motion.actors)) {
    throw new Error('Source field integer checkpoint clock, basis or actors differ');
  }
  return Object.freeze({ version: 'source_field_integer_checkpoint_v1', kind: 'reached_integer_boundary', boundary, startMoment, trace });
};
