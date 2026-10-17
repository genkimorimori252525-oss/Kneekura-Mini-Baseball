import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { multiplyQuaternions, normalizeQuaternion, type Quaternion } from '../pitching/BaseballOrientation';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2, type SourceFreeBallEvaluation } from './SourceFreeBallKernel';

export type SourceBallMaterialSpanV1 = Readonly<{
  /** The original free descriptor is never rebased at an observation time. */
  descriptor: SourceFreeBallDescriptorV2;
  throughElapsedSeconds: number;
  /** The original end state immediately before the next descriptor's basis. */
  side: 'incoming' | 'outgoing';
}>;
export type SourceBallMaterialHistoryInputV1 = Readonly<{
  initialMaterialOrientation: Quaternion;
  spans: readonly SourceBallMaterialSpanV1[];
}>;
type Declaration = Readonly<{
  phaseAuthority: 'DECLARED_INITIAL_PHASE'; native: false; nativeAdmission: false; official: null;
}>;
export type SourceBallMaterialEvaluationV1 = Omit<SourceFreeBallEvaluation, 'orientation'> & Declaration & Readonly<{
  /** Material-to-world rotation relative to the declared initial phase. */
  orientation: Quaternion;
  /** Unchanged relative rotation from the selected original descriptor. */
  relativeOrientation: Quaternion;
  spanIndex: number;
}>;
export type SourceBallMaterialHistoryV1 = SourceBallMaterialHistoryInputV1 & Declaration & Readonly<{
  fromElapsedSeconds: number;
  throughElapsedSeconds: number;
  evaluateAt(elapsedSeconds: number, side?: 'incoming' | 'outgoing'): SourceBallMaterialEvaluationV1;
}>;
const declaration = Object.freeze({ phaseAuthority: 'DECLARED_INITIAL_PHASE' as const,
  native: false as const, nativeAdmission: false as const, official: null });
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error('Source ball material history: ' + reason);
}
const fields = (value: unknown, keys: readonly string[]) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key =>
    JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  const encoded = JSON.stringify(value); assert(encoded !== undefined, 'invalid original profile value'); return encoded;
};
const material = (relative: Quaternion, basis: Quaternion) => normalizeQuaternion(multiplyQuaternions(relative, basis));

/** Pure observer, not a Native Source format or an impulse/custody authority.
 * Initial phase is declared, not measured. Velocity/spin jumps at connected
 * bases may represent original impulses; only their original owner can
 * authenticate them. This observer neither changes a descriptor nor computes
 * forces or a new position/velocity/spin trajectory. Sampling is stateless.
 *
 * At a descriptor join, incoming selects the previous span's declared end
 * side; outgoing selects the latest basis at that instant. Within a span,
 * incoming/outgoing pass directly to the original kernel (including ground).
 * Observation cuts using one descriptor belong in evaluateAt, not new spans.
 */
export const createSourceBallMaterialHistoryV1 = (raw: SourceBallMaterialHistoryInputV1): SourceBallMaterialHistoryV1 => {
  const source = cloneInert(raw);
  assert(fields(source, ['initialMaterialOrientation', 'spans'])
    && fields(source.initialMaterialOrientation, ['w', 'x', 'y', 'z'])
    && Object.values(source.initialMaterialOrientation).every(Number.isFinite)
    && Array.isArray(source.spans) && source.spans.length > 0 && source.spans.length <= 256, 'invalid declared phase or free spans');
  const initialMaterialOrientation = freeze(normalizeQuaternion(source.initialMaterialOrientation));
  let carried = initialMaterialOrientation, totalCells = 0;
  const endpoints: SourceFreeBallEvaluation[] = [];
  const compiled = source.spans.map((span, index) => {
    assert(fields(span, ['descriptor', 'throughElapsedSeconds', 'side']) && ['incoming', 'outgoing'].includes(span.side)
      && Number.isFinite(span.throughElapsedSeconds), 'invalid free span');
    const kernel = createSourceFreeBallKernel(span.descriptor), from = kernel.descriptor.initial;
    assert(span.throughElapsedSeconds >= from.elapsedSeconds && span.throughElapsedSeconds <= kernel.descriptor.throughElapsedSeconds,
      'backwards span or span outside its original horizon');
    totalCells += kernel.cells.length;
    assert(totalCells <= 250_000, 'history exceeds bounded original kernel work');
    const preceding = index ? source.spans[index - 1] : null;
    if (preceding) {
      const prior = endpoints[index - 1];
      assert(from.originTick === source.spans[0].descriptor.initial.originTick, 'original root clock changed');
      assert(from.elapsedSeconds === preceding.throughElapsedSeconds, 'gap or overlap between free spans');
      assert(canonical(kernel.descriptor.profile) === canonical(source.spans[0].descriptor.profile), 'original physics profile changed');
      assert((['x', 'y', 'z'] as const).every(axis => from.ball.position[axis] === prior.moment.ball.position[axis]),
        'impulse position is discontinuous');
    }
    const basis = carried, endpoint = kernel.evaluateAt(span.throughElapsedSeconds, span.side);
    carried = freeze(material(endpoint.orientation, basis));
    // Endpoints are captured from their original kernels, never reintegrated
    // from a displayed frame or a rounded tick.
    endpoints.push(endpoint);
    return { kernel, basis };
  });
  const fromElapsedSeconds = source.spans[0].descriptor.initial.elapsedSeconds;
  const throughElapsedSeconds = source.spans.at(-1)!.throughElapsedSeconds;
  const evaluateAt = (elapsedSeconds: number, side: 'incoming' | 'outgoing' = 'outgoing'): SourceBallMaterialEvaluationV1 => {
    assert(Number.isFinite(elapsedSeconds) && elapsedSeconds >= fromElapsedSeconds && elapsedSeconds <= throughElapsedSeconds
      && ['incoming', 'outgoing'].includes(side), 'observation exceeds original free history');
    let spanIndex = -1;
    if (side === 'incoming') spanIndex = source.spans.findIndex(span => span.throughElapsedSeconds === elapsedSeconds);
    if (spanIndex < 0) {
      for (let index = 0; index < source.spans.length; index++) {
        const span = source.spans[index];
        if (span.descriptor.initial.elapsedSeconds <= elapsedSeconds && elapsedSeconds <= span.throughElapsedSeconds) spanIndex = index;
      }
    }
    assert(spanIndex >= 0, 'observation has no original free span');
    const span = source.spans[spanIndex], { kernel, basis } = compiled[spanIndex];
    const ending = side === 'incoming' && spanIndex < source.spans.length - 1 && span.throughElapsedSeconds === elapsedSeconds;
    const sample = kernel.evaluateAt(elapsedSeconds, ending ? span.side : side);
    return freeze({ ...declaration, moment: sample.moment, phase: sample.phase, relativeOrientation: sample.orientation,
      orientation: material(sample.orientation, basis), spanIndex });
  };
  return freeze({ ...declaration, initialMaterialOrientation, spans: source.spans, fromElapsedSeconds, throughElapsedSeconds, evaluateAt });
};
