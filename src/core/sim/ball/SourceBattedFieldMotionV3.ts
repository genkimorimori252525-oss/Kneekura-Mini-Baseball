import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { battedWorldBaseSurfaceId, deriveBattedWorldFieldMotionAdoption, advanceBattedWorldFieldMotionCheckpoint,
  type BattedWorldFieldMotion, type BattedWorldFieldMotionAdoptionInput } from './BattedWorldFieldMotion';
import type { BallWorldContinuation, BallWorldFieldBoundaryContact } from './BallWorldContinuation';
import { respondToBallWorldBoundary, type BattedWorldBallCursor } from './BattedWorldContinuation';
import { createSourceImpactEscapeSessionV3, type SourceImpactEscapeDiagnosticV3, type SourceImpactEscapeAdvanceV3 } from './SourceFreeBallWorldQuery';

const ids = ['home', 'first', 'second', 'third'] as const;
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const compatibleContact = (c: BallWorldFieldBoundaryContact) => c.kind === 'base' ? { kind: 'surface' as const,
  surfaceId: battedWorldBaseSurfaceId(c.baseId), moment: c.moment, point: c.point, normal: c.normal,
  ...(c.continuing ? { continuing: true as const } : {}) } : c;
export type SourceBattedFieldMotionTraceV3 = Readonly<{
  solverVersion: 'source_field_contact_escape_v3'; initial: BattedWorldFieldMotion;
  steps: readonly Readonly<{ throughTick: number; field: BattedWorldFieldMotion }>[]; field: BattedWorldFieldMotion;
  impulseCertificates: readonly Readonly<{ afterStepIndex: number; diagnostic: SourceImpactEscapeDiagnosticV3 }>[];
  escapedIntervals: readonly Readonly<{ stepIndex: number; advance: SourceImpactEscapeAdvanceV3 }>[];
}>;

/** Source-only stationary-body replay. Native must rebuild this initial input
 * and all horizons from its own original root/step rows. Stored certificates
 * are diagnostics; no serialized value can restore this private session. */
export const deriveSourceBattedFieldMotionV3 = (raw: Readonly<{
  initial: BattedWorldFieldMotionAdoptionInput; throughTicks: readonly number[];
}>): SourceBattedFieldMotionTraceV3 => {
  const input = cloneInert(raw), root = input.initial;
  if (!input || Object.keys(input).sort().join('|') !== 'initial|throughTicks' || !Array.isArray(input.throughTicks)
    || !root?.cursor?.sourceCurve || root.cursor.sourceSide !== 'incoming' || root.carrierPlayerId !== null
    || root.cursor.moment.elapsedSeconds !== 0 || root.cursor.sourceCurve.initial.elapsedSeconds !== 0
    || root.actors.some(a => [...Object.values(a.primitive.startVelocity), ...Object.values(a.primitive.acceleration)].some(v => v !== 0))
    || root.commands.some(c => Object.values(c.acceleration).some(v => v !== 0))) throw new Error('unsupported v3 field initial Source or stationary command scope');
  // Reuse original complete geometry/profile/actor/coverage validation. Its v2
  // result is never adopted for a positive-time v3 query or response.
  const adopted = deriveBattedWorldFieldMotionAdoption(root), actors = adopted.motion.actors, session = createSourceImpactEscapeSessionV3();
  const certificates: SourceBattedFieldMotionTraceV3['impulseCertificates'][number][] = [], advances: SourceBattedFieldMotionTraceV3['escapedIntervals'][number][] = [];
  const steps: SourceBattedFieldMotionTraceV3['steps'][number][] = [];
  let cursor: BattedWorldBallCursor | null = root.cursor;
  const execute = (throughTick: number, stepIndex: number): BattedWorldFieldMotion => {
    if (!cursor?.sourceCurve) throw new Error('v3 field acquisition or unresolved response remains unsupported');
    if (!Number.isSafeInteger(throughTick) || throughTick < cursor.moment.ball.tick) throw new Error('invalid v3 field checkpoint horizon');
    const horizon = Math.max(cursor.moment.elapsedSeconds, (throughTick-cursor.moment.originTick)/root.response.world.parameters.ticksPerSecond);
    const prior: BattedWorldBallCursor = { ...cursor, sourceCurve: { ...cursor.sourceCurve,
      throughElapsedSeconds: Math.max(cursor.sourceCurve.throughElapsedSeconds, horizon) } };
    if (stepIndex >= 0) advanceBattedWorldFieldMotionCheckpoint({ response: root.response, geometry: root.geometry,
      actors, cursor: prior, carrierPlayerId: null, checkpointThroughTick: throughTick });
    const baseOf = (surfaceId: string) => ids.find(id => battedWorldBaseSurfaceId(id) === surfaceId);
    const previousContacts = prior.previousContacts.filter(c => c.kind !== 'surface' || !baseOf(c.surfaceId));
    const previousBaseContacts = prior.previousContacts.flatMap(c => c.kind === 'surface' && baseOf(c.surfaceId) ? [baseOf(c.surfaceId)!] : []);
    const before = session.advances().length;
    const queried = session.query({ descriptor: prior.sourceCurve!, moment: prior.moment, side: prior.sourceSide ?? 'outgoing', throughElapsedSeconds: horizon,
      actors, surfaces: root.response.world.surfaces, bases: root.geometry.bases, previousContacts, previousBaseContacts });
    if (queried.kind === 'unresolved') throw new Error('v3 field requires numerical contact refinement');
    const world: BallWorldContinuation = queried.kind === 'boundary' ? { kind: 'boundary', moment: queried.moment, phase: queried.phase,
      contacts: queried.contacts.map(compatibleContact), ...(queried.pendingReason ? { pendingReason: queried.pendingReason } : {}) }
      : { kind: queried.kind, moment: queried.moment, phase: queried.phase, throughTick };
    const responseInput = { ...root.response, world: { ...root.response.world, actors }, surfaces: [...root.response.surfaces,
      ...ids.map(id => ({ surfaceId: battedWorldBaseSurfaceId(id), material: root.geometry.baseModels[id].material }))] };
    // Once this query proves a sole new impulse, old colliders are searched
    // normally again. Only its immediately preceding collider can be excluded.
    const responsePrior = world.kind === 'boundary' && world.contacts.length === 1
      && ['actor', 'surface'].includes(world.contacts[0].kind) ? { ...prior, previousContacts: [] } : prior;
    const response = respondToBallWorldBoundary(responseInput, responsePrior, world);
    if (response.kind === 'rebound' && response.cursor.sourceCurve) {
      const originalResponse = { ...root.response, world: { ...root.response.world, actors } };
      const diagnostic = queried.contacts[0].kind === 'base'
        ? session.adoptBaseImpulse(queried, originalResponse, Object.fromEntries(ids.map(id => [id, root.geometry.baseModels[id].material])) as Record<typeof ids[number], typeof root.geometry.baseModels.home.material>, response.cursor.sourceCurve)
        : session.adoptImpulse(queried, originalResponse, response.cursor.sourceCurve);
      certificates.push({ afterStepIndex: stepIndex, diagnostic });
    }
    for (const advance of session.advances().slice(before)) advances.push({ stepIndex, advance });
    cursor = response.cursor;
    return freeze({ motion: { actors, carrierPlayerId: null, world, response, cursor },
      baseContacts: queried.contacts.filter((c): c is Extract<BallWorldFieldBoundaryContact, { kind: 'base' }> => c.kind === 'base') });
  };
  const initial = execute(root.cursor.moment.ball.tick, -1);
  let field = initial;
  for (const [stepIndex, throughTick] of input.throughTicks.entries()) {
    field = execute(throughTick, stepIndex); steps.push({ throughTick, field });
  }
  return freeze({ solverVersion: 'source_field_contact_escape_v3', initial, steps, field, impulseCertificates: certificates, escapedIntervals: advances });
};
