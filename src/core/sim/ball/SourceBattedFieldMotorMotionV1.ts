import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../ExactEventTime';
import { deriveBattedWorldMotionActorsAtExactCoverage, type BattedWorldPrimitiveMotionCommand } from './BattedWorldMotion';
import { battedWorldBaseSurfaceId, type BattedWorldFieldMotionAdoptionInput, type BattedWorldFieldMotion } from './BattedWorldFieldMotion';
import type { BallWorldContinuation, BallWorldFieldBoundaryContact } from './BallWorldContinuation';
import { respondToBallWorldBoundary, type BattedWorldBallCursor } from './BattedWorldContinuation';
import { deriveSourceBattedFieldMotionV3 } from './SourceBattedFieldMotionV3';
import { createSourceImpactEscapeSessionV3, type SourceImpactEscapeDiagnosticV3, type SourceImpactEscapeAdvanceV3 } from './SourceFreeBallWorldQuery';

export type SourceBattedFieldMotorActionV1 = Readonly<{ kind: 'advance'; throughTick: number }>
  | Readonly<{ kind: 'adopt'; availableAtTick: number; availableAtElapsedSeconds?: number;
    coverageThroughTick: number; commands: readonly BattedWorldPrimitiveMotionCommand[] }>;
export type SourceBattedFieldMotorTraceV1 = Readonly<{
  authority: 'SOURCE_FIELD_MOTOR_REPLAY_RESEARCH_V1'; nativeAdmission: false; official: null;
  initial: BattedWorldFieldMotion; steps: readonly Readonly<{ action: SourceBattedFieldMotorActionV1; field: BattedWorldFieldMotion }>[];
  field: BattedWorldFieldMotion;
  impulseCertificates: readonly Readonly<{ afterActionIndex: number; diagnostic: SourceImpactEscapeDiagnosticV3 }>[];
  escapedIntervals: readonly Readonly<{ actionIndex: number; advance: SourceImpactEscapeAdvanceV3 }>[];
}>;
const ids = ['home', 'first', 'second', 'third'] as const;
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const fields = (v: unknown, required: readonly string[], optional: readonly string[] = []) => !!v && typeof v === 'object' && !Array.isArray(v)
  && required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
const compatibleContact = (c: BallWorldFieldBoundaryContact) => c.kind === 'base' ? { kind: 'surface' as const,
  surfaceId: battedWorldBaseSurfaceId(c.baseId), moment: c.moment, point: c.point, normal: c.normal,
  ...(c.continuing ? { continuing: true as const } : {}) } : c;

/** Live explicit command execution, separate from stationary Native V3 admission.
 * No serialized cursor, certificate, actor target or replacement basis is accepted.
 * Native must authenticate commands and original rows before adopting this seam.
 * The private escape witness is scoped to exact actor curves: command adoption
 * cannot restore a witness from the preceding motion scope. A real glove
 * candidate is a terminal contact, not possession; only the existing timed
 * acquisition consumer may dissipate energy and establish its custody fence. */
export const createSourceBattedFieldMotorSessionV1 = (raw: BattedWorldFieldMotionAdoptionInput) => {
  const root = cloneInert(raw);
  // Existing complete root validation and stationary-only contract remain intact.
  const initial = deriveSourceBattedFieldMotionV3({ initial: root, throughTicks: [] }).initial;
  let field = initial, actors = initial.motion.actors, cursor: BattedWorldBallCursor | null = initial.motion.cursor;
  if (!cursor?.sourceCurve || initial.motion.carrierPlayerId !== null) throw new Error('Source field motor replay requires a free original root');
  const session = createSourceImpactEscapeSessionV3();
  const certificates: SourceBattedFieldMotorTraceV1['impulseCertificates'][number][] = [];
  const escapes: SourceBattedFieldMotorTraceV1['escapedIntervals'][number][] = [];
  let actionIndex = 0;
  let failed = false;
  const apply = (rawAction: SourceBattedFieldMotorActionV1): BattedWorldFieldMotion => {
    if (failed) throw new Error('Source field motor session failed');
    try {
      const action = cloneInert(rawAction);
      if (!cursor?.sourceCurve || field.motion.carrierPlayerId !== null) throw new Error('Source field motor replay requires an unimpeded free cursor');
      if (action.kind === 'adopt') {
        if (!fields(action, ['kind', 'availableAtTick', 'coverageThroughTick', 'commands'], ['availableAtElapsedSeconds']))
          throw new Error('invalid Source field motor adoption');
        actors = deriveBattedWorldMotionActorsAtExactCoverage({ response: root.response, cursor, actors,
          carrierPlayerId: null, availableAtTick: action.availableAtTick, throughTick: action.coverageThroughTick, commands: action.commands }, action.availableAtElapsedSeconds);
        // Only actor command curves change here. Physical ball state, prior contact,
        // Source descriptor, side and its exact fractional clock remain untouched.
        field = freeze({ ...field, motion: { ...field.motion, actors } });
      } else if (action.kind === 'advance') {
        if (!fields(action, ['kind', 'throughTick']) || !Number.isSafeInteger(action.throughTick) || action.throughTick < cursor.moment.ball.tick)
          throw new Error('invalid Source field motor checkpoint horizon');
        const horizon = Math.max(cursor.moment.elapsedSeconds, (action.throughTick - cursor.moment.originTick) / root.response.world.parameters.ticksPerSecond);
        // The original curve is only extended, never integrated from its rounded tick.
        const prior: BattedWorldBallCursor = { ...cursor, sourceCurve: { ...cursor.sourceCurve,
          throughElapsedSeconds: Math.max(cursor.sourceCurve.throughElapsedSeconds, horizon) } };
        const baseOf = (surfaceId: string) => ids.find(id => battedWorldBaseSurfaceId(id) === surfaceId);
        const previousContacts = prior.previousContacts.filter(c => c.kind !== 'surface' || !baseOf(c.surfaceId));
        const previousBaseContacts = prior.previousContacts.flatMap(c => c.kind === 'surface' && baseOf(c.surfaceId) ? [baseOf(c.surfaceId)!] : []);
        const count = session.advances().length;
        const queried = session.query({ descriptor: prior.sourceCurve!, moment: prior.moment, side: prior.sourceSide ?? 'outgoing',
          throughElapsedSeconds: horizon, actors, surfaces: root.response.world.surfaces, bases: root.geometry.bases, previousContacts, previousBaseContacts });
        if (queried.kind === 'unresolved') throw new Error('Source field motor replay requires numerical contact refinement');
        const world: BallWorldContinuation = queried.kind === 'boundary' ? { kind: 'boundary', moment: queried.moment, phase: queried.phase,
          contacts: queried.contacts.map(compatibleContact), ...(queried.pendingReason ? { pendingReason: queried.pendingReason } : {}) }
          : { kind: queried.kind, moment: queried.moment, phase: queried.phase, throughTick: action.throughTick };
        const responseInput = { ...root.response, world: { ...root.response.world, actors }, surfaces: [...root.response.surfaces,
          ...ids.map(id => ({ surfaceId: battedWorldBaseSurfaceId(id), material: root.geometry.baseModels[id].material }))] };
        const responsePrior = world.kind === 'boundary' && world.contacts.length === 1 && ['actor', 'surface'].includes(world.contacts[0].kind)
          ? { ...prior, previousContacts: [] } : prior;
        const response = respondToBallWorldBoundary(responseInput, responsePrior, world);
        if (!response.cursor && response.kind !== 'capture_candidate') throw new Error('Source field motor replay cannot adopt custody or unresolved contact');
        if (response.kind === 'rebound' && response.cursor.sourceCurve) {
          const originalResponse = { ...root.response, world: { ...root.response.world, actors } };
          const diagnostic = queried.contacts[0].kind === 'base'
            ? session.adoptBaseImpulse(queried, originalResponse, Object.fromEntries(ids.map(id => [id, root.geometry.baseModels[id].material])) as Record<typeof ids[number], typeof root.geometry.baseModels.home.material>, response.cursor.sourceCurve)
            : session.adoptImpulse(queried, originalResponse, response.cursor.sourceCurve);
          certificates.push({ afterActionIndex: actionIndex, diagnostic });
        }
        for (const advance of session.advances().slice(count)) escapes.push({ actionIndex, advance });
        cursor = response.cursor;
        if (world.kind !== 'boundary' && (!cursor || cursor.moment.elapsedSeconds !== horizon
          || cursor.moment.ball.tick !== quantizeEventTick(cursor.moment.originTick, horizon, root.response.world.parameters.ticksPerSecond)))
          throw new Error('Source field motor replay endpoint differs');
        field = freeze({ motion: { actors, carrierPlayerId: null, world, response, cursor },
          baseContacts: queried.contacts.filter((c): c is Extract<BallWorldFieldBoundaryContact, { kind: 'base' }> => c.kind === 'base') });
      } else throw new Error('unsupported Source field motor action');
      actionIndex += 1;
      return field;
    } catch (error) { failed = true; throw error; }
  };
  // The live session owns the same private contact witnesses as the finite
  // replay. It retains no actor-frame history and accepts no restored cursor.
  return Object.freeze({ initial, apply, read: () => {
    if (failed) throw new Error('Source field motor session failed');
    return field;
  }, evidence: () => {
    if (failed) throw new Error('Source field motor session failed');
    return freeze({ impulseCertificates: [...certificates], escapedIntervals: [...escapes] });
  } });
};

/** Existing finite replay keeps its original input limit and result contract. */
export const deriveSourceBattedFieldMotorMotionV1 = (raw: Readonly<{
  initial: BattedWorldFieldMotionAdoptionInput; actions: readonly SourceBattedFieldMotorActionV1[];
}>): SourceBattedFieldMotorTraceV1 => {
  const input = cloneInert(raw);
  if (!fields(input, ['initial', 'actions']) || !Array.isArray(input.actions) || input.actions.length > 256)
    throw new Error('invalid Source field motor replay scope');
  const session = createSourceBattedFieldMotorSessionV1(input.initial);
  const steps = input.actions.map(action => ({ action, field: session.apply(action) }));
  return freeze({ authority: 'SOURCE_FIELD_MOTOR_REPLAY_RESEARCH_V1', nativeAdmission: false, official: null,
    initial: session.initial, steps, field: session.read(), ...session.evidence() });
};
