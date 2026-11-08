import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Quaternion } from '../pitching/BaseballOrientation';
import type { BallWorldMoment } from './BallWorldContinuation';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import type { BattedWorldBallCursor } from './BattedWorldContinuation';
import { deriveSourceBattedWorldContinuationV3, type SourceBattedWorldContinuationV3 } from './SourceBattedWorldContinuationV3';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { createSourceBallMaterialHistoryV1, type SourceBallMaterialHistoryV1, type SourceBallMaterialSpanV1 } from './SourceBallMaterialHistoryV1';

export type SourceBallMaterialHistoryFromContinuationV3Input = Readonly<{
  response: BattedBallContactResponseInput;
  continuation: SourceBattedWorldContinuationV3;
  initialMaterialOrientation: Quaternion;
}>;
const json = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const fields = (value: unknown, keys: readonly string[]) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error('Source material continuation mapper: ' + reason);
}
const same = (a: unknown, b: unknown) => assert(json(a) === json(b), 'original replay or kernel geometry differs');
const basis = (descriptor: SourceFreeBallDescriptorV2) => json([descriptor.kind, descriptor.initial, descriptor.profile,
  ...(descriptor.materialOrientationAtStart === undefined ? [] : [descriptor.materialOrientationAtStart])]);

/** Replays a supplied pure v3 trace, then observes its original free bases.
 * Replay consistency is not Native Source/impulse authority. Declared phase,
 * native:false and official:null remain those of the material observer.
 * Only surface rebounds introduce new bases. Ground is already owned by its
 * original kernel, and microscopic escape advances never rebase integration.
 * Capture, custody, actor impulses and unresolved histories fail closed.
 */
export const createSourceBallMaterialHistoryFromContinuationV3 = (
  raw: SourceBallMaterialHistoryFromContinuationV3Input,
): SourceBallMaterialHistoryV1 => {
  const source = cloneInert(raw), trace = source?.continuation;
  assert(fields(source, ['response', 'continuation', 'initialMaterialOrientation'])
    && fields(source.response, ['world', 'actors', 'surfaces'])
    && fields(source.response.world, ['flight', 'parameters', 'throughTick', 'actors', 'surfaces', 'sourceCurve'])
    && fields(trace, ['solverVersion', 'original', 'initialCursor', 'steps', 'cursor', 'impulseCertificates', 'escapedIntervals'])
    && trace.solverVersion === 'source_contact_escape_v3' && Array.isArray(trace.steps) && trace.steps.length <= 4096,
  'requires an original free v3 response and bounded trace');
  const curve = source.response.world.sourceCurve;
  assert(curve, 'original Source descriptor is missing');
  const replay = deriveSourceBattedWorldContinuationV3({ response: source.response, throughTicks: trace.steps.map(step => step.throughTick) });
  same(trace, replay);
  const free = (cursor: BattedWorldBallCursor | null) => {
    assert(cursor?.sourceCurve, 'capture, custody or unresolved free cursor'); return cursor as BattedWorldBallCursor & { sourceCurve: SourceFreeBallDescriptorV2 };
  };
  const initial = free(replay.initialCursor);
  assert(replay.original.kind === 'airborne' || replay.original.kind === 'ground' || replay.original.kind === 'rebound', 'original response is not supported free motion');
  const spans: SourceBallMaterialSpanV1[] = [];
  let active = curve, end = active.initial.elapsedSeconds, endSide: 'incoming' | 'outgoing' = 'incoming';
  const kernels = new Map<string, ReturnType<typeof createSourceFreeBallKernel>>();
  const kernel = () => {
    const key = json(active); let value = kernels.get(key);
    if (!value) { value = createSourceFreeBallKernel(active); kernels.set(key, value); }
    return value;
  };
  const horizon = (throughElapsedSeconds: number) => {
    if (throughElapsedSeconds > active.throughElapsedSeconds) active = { ...active, throughElapsedSeconds };
  };
  const note = (moment: BallWorldMoment, side: 'incoming' | 'outgoing') => {
    assert(moment.elapsedSeconds >= end, 'adopted physical time moves backwards');
    same(kernel().evaluateAt(moment.elapsedSeconds, side).moment, moment);
    end = moment.elapsedSeconds; endSide = side;
  };
  const acceptSameBasis = (cursor: BattedWorldBallCursor) => {
    const next = free(cursor); same(basis(active), basis(next.sourceCurve));
    horizon(next.sourceCurve.throughElapsedSeconds); note(next.moment, 'outgoing');
  };
  const startOutgoingBasis = (cursor: BattedWorldBallCursor) => {
    const next = free(cursor);
    same(next.sourceCurve.initial, next.moment);
    spans.push({ descriptor: active, throughElapsedSeconds: end, side: endSide });
    active = next.sourceCurve; end = active.initial.elapsedSeconds; endSide = 'outgoing';
    note(next.moment, 'outgoing');
  };
  const originalMoment = replay.original.world.sourceMoment;
  assert(originalMoment, 'original exact Source moment is missing');
  note(originalMoment, 'incoming');
  if (replay.original.kind === 'rebound') {
    assert(replay.original.geometry.contact.kind === 'surface', 'only surface impulse histories are supported');
    startOutgoingBasis(initial);
  } else acceptSameBasis(initial);
  let prior = initial;
  for (const step of replay.steps) {
    // This is exactly the v3 solver's prior-horizon expansion; initial and
    // profile stay at their original basis. Requested horizons are never
    // used as material observation endpoints after an earlier collision.
    const requested = Math.max(prior.moment.elapsedSeconds,
      (step.throughTick - prior.moment.originTick) / active.profile.air.ticksPerSecond);
    horizon(requested);
    const cursor = free(step.response.cursor);
    assert(['moving', 'resting', 'ground', 'rolling_stop', 'rebound'].includes(step.response.kind), 'unsupported response');
    if (step.response.kind === 'rebound') {
      assert(step.world.kind === 'boundary' && step.world.contacts.length === 1 && step.world.contacts[0].kind === 'surface',
        'only surface impulse histories are supported');
      note(step.world.moment, 'incoming'); startOutgoingBasis(cursor);
    } else {
      if (step.response.kind === 'ground') {
        assert(step.world.kind === 'boundary' && step.world.contacts.length === 1 && step.world.contacts[0].kind === 'ground',
          'ground history differs');
        note(step.world.moment, 'incoming');
      } else if (step.response.kind === 'rolling_stop') {
        assert(step.world.kind === 'boundary' && step.world.contacts.length === 1 && step.world.contacts[0].kind === 'rolling_stop',
          'rolling history differs');
      } else same(step.world.moment, cursor.moment);
      acceptSameBasis(cursor);
    }
    prior = cursor;
  }
  same(free(replay.cursor), prior);
  spans.push({ descriptor: active, throughElapsedSeconds: end, side: endSide });
  return createSourceBallMaterialHistoryV1({ initialMaterialOrientation: source.initialMaterialOrientation, spans });
};
