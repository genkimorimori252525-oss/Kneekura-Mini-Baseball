import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import type { BallWorldContinuation } from './BallWorldContinuation';
import { deriveBattedWorldContinuation, respondToBallWorldBoundary, type BattedWorldBallCursor, type BattedWorldContinuation, type BattedWorldContinuationStep } from './BattedWorldContinuation';
import { createSourceImpactEscapeSessionV3, type SourceImpactEscapeAdvanceV3, type SourceImpactEscapeDiagnosticV3 } from './SourceFreeBallWorldQuery';

export type SourceBattedWorldContinuationV3 = BattedWorldContinuation & Readonly<{
  solverVersion: 'source_contact_escape_v3';
  impulseCertificates: readonly Readonly<{ afterStepIndex: number; diagnostic: SourceImpactEscapeDiagnosticV3 }>[];
  escapedIntervals: readonly Readonly<{ stepIndex: number; advance: SourceImpactEscapeAdvanceV3 }>[];
}>;
const json = (v: unknown): string => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };

/** A separate explicit solver, replayed from original response and adopted
 * horizons. The force kernel stays v2; v2 stopped archives are not reinterpreted.
 * Private certificates live only within this replay. Native owns Source identity. */
export const deriveSourceBattedWorldContinuationV3 = (raw: Readonly<{ response: BattedBallContactResponseInput;
  throughTicks: readonly number[] }>): SourceBattedWorldContinuationV3 => {
  const input = cloneInert(raw), curve = input.response?.world?.sourceCurve;
  if (!curve || !Array.isArray(input.throughTicks)) throw new Error('v3 continuation requires an explicit original Source kernel');
  const base = deriveBattedWorldContinuation({ response: input.response, throughTicks: [] }), session = createSourceImpactEscapeSessionV3();
  const certificates: SourceBattedWorldContinuationV3['impulseCertificates'][number][] = [], advances: SourceBattedWorldContinuationV3['escapedIntervals'][number][] = [];
  let cursor = base.initialCursor;
  if (base.original.kind === 'rebound') {
    const observed = session.query({ descriptor: curve, moment: curve.initial, side: 'incoming', throughElapsedSeconds: curve.throughElapsedSeconds,
      actors: input.response.world.actors, surfaces: input.response.world.surfaces });
    if (observed.kind !== 'boundary' || json(observed.moment.ball) !== json(base.original.geometry.ball)
      || observed.moment.elapsedSeconds !== base.original.geometry.elapsedSeconds || !cursor?.sourceCurve) {
      throw new Error('v3 original response query differs from its own physical root');
    }
    certificates.push({ afterStepIndex: -1, diagnostic: session.adoptImpulse(observed, input.response, cursor.sourceCurve) });
  }
  const steps: BattedWorldContinuationStep[] = [], p = curve.profile.air.ticksPerSecond;
  for (const [stepIndex, throughTick] of input.throughTicks.entries()) {
    if (!cursor?.sourceCurve) throw new Error('v3 acquisition or unresolved contact is pending');
    if (!Number.isSafeInteger(throughTick) || throughTick < cursor.moment.ball.tick) throw new Error('invalid v3 continuation horizon');
    const throughElapsedSeconds = Math.max(cursor.moment.elapsedSeconds, (throughTick - cursor.moment.originTick) / p);
    const prior: BattedWorldBallCursor = { ...cursor, sourceCurve: { ...cursor.sourceCurve,
      throughElapsedSeconds: Math.max(cursor.sourceCurve.throughElapsedSeconds, throughElapsedSeconds) } };
    const advanceCount = session.advances().length;
    const queried = session.query({ descriptor: prior.sourceCurve!, moment: prior.moment, side: 'outgoing', throughElapsedSeconds,
      actors: input.response.world.actors, surfaces: input.response.world.surfaces, previousContacts: prior.previousContacts });
    if (queried.kind === 'unresolved') throw new Error('v3 continuation requires numerical contact refinement');
    const world: BallWorldContinuation = queried.kind === 'boundary' ? { kind: 'boundary', moment: queried.moment, phase: queried.phase,
      contacts: queried.contacts as Extract<BallWorldContinuation, { kind: 'boundary' }>['contacts'],
      ...(queried.pendingReason ? { pendingReason: queried.pendingReason } : {}) }
      : { kind: queried.kind, moment: queried.moment, phase: queried.phase, throughTick };
    if (world.kind !== 'boundary' && world.moment.elapsedSeconds <= prior.moment.elapsedSeconds) throw new Error('v3 continuation makes no physical progress');
    const response = respondToBallWorldBoundary(input.response, prior, world);
    steps.push({ throughTick, world, response });
    for (const advance of session.advances().slice(advanceCount)) advances.push({ stepIndex, advance });
    if (response.kind === 'rebound' && response.cursor.sourceCurve) {
      certificates.push({ afterStepIndex: stepIndex, diagnostic: session.adoptImpulse(queried, input.response, response.cursor.sourceCurve) });
    }
    cursor = response.cursor;
  }
  return freeze({ original: base.original, initialCursor: base.initialCursor, steps, cursor,
    solverVersion: 'source_contact_escape_v3', impulseCertificates: certificates, escapedIntervals: advances });
};
