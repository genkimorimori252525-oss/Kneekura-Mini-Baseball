import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { battedWorldBaseSurfaceId, deriveBattedWorldFieldMotionAdoption,
  type BattedWorldFieldMotion, type BattedWorldFieldMotionAdoptionInput } from './BattedWorldFieldMotion';
import type { BallWorldContinuation, BallWorldFieldBoundaryContact } from './BallWorldContinuation';
import { respondToBallWorldBoundary, type BattedWorldBallCursor } from './BattedWorldContinuation';
import { createSourceImpactEscapeSessionV145, type SourceImpactEscapeDiagnosticV3, type SourceImpactEscapeAdvanceV3 } from './SourceFreeBallWorldQuery';

import {createSourceFreeBallPoleV136,type SourceFreeBallPoleV136} from './SourceFreeBallPoleV136';
import type {BallContactMaterial} from './BallContactResponse';
export type SourceParkEquipmentV145=Readonly<{version:'source_park_equipment_v145';
  poles:readonly Readonly<{geometry:SourceFreeBallPoleV136;material:BallContactMaterial}>[]}>;
export function createSourceParkEquipmentV145(raw:SourceParkEquipmentV145):SourceParkEquipmentV145{
  const p=cloneInert(raw),keys=(v:unknown,names:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)
    &&Object.keys(v).sort().join('|')===names.sort().join('|');
  if(!keys(p,['version','poles'])||p.version!=='source_park_equipment_v145'||!Array.isArray(p.poles))throw Error('invalid explicit park equipment');
  const seen=new Set<string>();
  for(const item of p.poles){
    if(!keys(item,['geometry','material'])||!keys(item.material,['restitution','tangentialDamping','spinDamping'])
      ||!Object.values(item.material).every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1))throw Error('invalid explicit park pole material');
    const pole=createSourceFreeBallPoleV136(item.geometry);
    if(seen.has(pole.source.surfaceId)||ids.some(id=>battedWorldBaseSurfaceId(id)===pole.source.surfaceId))
      throw Error('duplicate or reserved park pole identity');
    seen.add(pole.source.surfaceId);
  }
  return freeze(p);
}
const ids = ['home', 'first', 'second', 'third'] as const;
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const compatibleContact = (c: BallWorldFieldBoundaryContact) => c.kind === 'base' ? { kind: 'surface' as const,
  surfaceId: battedWorldBaseSurfaceId(c.baseId), moment: c.moment, point: c.point, normal: c.normal,
  ...(c.continuing ? { continuing: true as const } : {}) } : c;
export type SourceBattedFieldMotionTraceV145 = Readonly<{
  solverVersion: 'source_field_pole_contact_escape_v145'; parkEquipment:SourceParkEquipmentV145; initial: BattedWorldFieldMotion;
  steps: readonly Readonly<{ throughTick: number; field: BattedWorldFieldMotion }>[]; field: BattedWorldFieldMotion;
  impulseCertificates: readonly Readonly<{ afterStepIndex: number; diagnostic: SourceImpactEscapeDiagnosticV3 }>[];
  escapedIntervals: readonly Readonly<{ stepIndex: number; advance: SourceImpactEscapeAdvanceV3 }>[];
}>;

/** Source-only stationary-body replay. Native must rebuild this initial input
 * and all horizons from its own original root/step rows. Stored certificates
 * are diagnostics; no serialized value can restore this private session. */
export const deriveSourceBattedFieldMotionV145 = (raw: Readonly<{
  initial: BattedWorldFieldMotionAdoptionInput; throughTicks: readonly number[];parkEquipment:SourceParkEquipmentV145;
}>): SourceBattedFieldMotionTraceV145 => {
  const input = cloneInert(raw), root = input.initial;
  if (!input || Object.keys(input).sort().join('|') !== 'initial|parkEquipment|throughTicks' || !Array.isArray(input.throughTicks)
    || !root?.cursor?.sourceCurve || root.cursor.sourceSide !== 'incoming' || root.carrierPlayerId !== null
    || root.cursor.moment.elapsedSeconds !== 0 || root.cursor.sourceCurve.initial.elapsedSeconds !== 0
    || root.actors.some(a => [...Object.values(a.primitive.startVelocity), ...Object.values(a.primitive.acceleration)].some(v => v !== 0))
    || root.commands.some(c => Object.values(c.acceleration).some(v => v !== 0))) throw new Error('unsupported v145 pole field initial Source or stationary command scope');
  const parkEquipment=createSourceParkEquipmentV145(input.parkEquipment),poles=parkEquipment.poles.map(p=>p.geometry),
    materials=parkEquipment.poles.map(p=>({surfaceId:p.geometry.surfaceId,material:p.material}));
  if(poles.some(p=>root.response.world.surfaces.some(s=>s.surfaceId===p.surfaceId)))throw Error('pole aliases an original wall');
  // Only zero-time adoption is used to validate original geometry/coverage.
  // No pole-blind positive-time query is executed before the V145 query.
  // Reuse original complete geometry/profile/actor/coverage validation. Its v2
  // result is never adopted for a positive-time v145 query or response.
  const adopted = deriveBattedWorldFieldMotionAdoption(root), actors = adopted.motion.actors, session = createSourceImpactEscapeSessionV145();
  const certificates: SourceBattedFieldMotionTraceV145['impulseCertificates'][number][] = [], advances: SourceBattedFieldMotionTraceV145['escapedIntervals'][number][] = [];
  const steps: SourceBattedFieldMotionTraceV145['steps'][number][] = [];
  let cursor: BattedWorldBallCursor | null = root.cursor;
  const execute = (throughTick: number, stepIndex: number): BattedWorldFieldMotion => {
    if (!cursor?.sourceCurve) throw new Error('v145 pole field acquisition or unresolved response remains unsupported');
    if (!Number.isSafeInteger(throughTick) || throughTick < cursor.moment.ball.tick) throw new Error('invalid v145 pole field checkpoint horizon');
    const horizon = Math.max(cursor.moment.elapsedSeconds, (throughTick-cursor.moment.originTick)/root.response.world.parameters.ticksPerSecond);
    const prior: BattedWorldBallCursor = { ...cursor, sourceCurve: { ...cursor.sourceCurve,
      throughElapsedSeconds: Math.max(cursor.sourceCurve.throughElapsedSeconds, horizon) } };
    if(throughTick>root.coverageThroughTick||actors.some(a=>horizon>(a.primitive.endTick-prior.moment.originTick)/root.response.world.parameters.ticksPerSecond))
      throw Error('v145 pole field original actor coverage exhausted');
    const baseOf = (surfaceId: string) => ids.find(id => battedWorldBaseSurfaceId(id) === surfaceId);
    const previousContacts = prior.previousContacts.filter(c => c.kind !== 'surface' || !baseOf(c.surfaceId));
    const previousBaseContacts = prior.previousContacts.flatMap(c => c.kind === 'surface' && baseOf(c.surfaceId) ? [baseOf(c.surfaceId)!] : []);
    const before = session.advances().length;
    const queried = session.query({ poles,world:{ descriptor: prior.sourceCurve!, moment: prior.moment, side: prior.sourceSide ?? 'outgoing', throughElapsedSeconds: horizon,
      actors, surfaces: root.response.world.surfaces, bases: root.geometry.bases, previousContacts, previousBaseContacts }});
    if (queried.kind === 'unresolved') throw new Error('v145 pole field requires numerical contact refinement');
    const world: BallWorldContinuation = queried.kind === 'boundary' ? { kind: 'boundary', moment: queried.moment, phase: queried.phase,
      contacts: queried.contacts.map(compatibleContact), ...(queried.pendingReason ? { pendingReason: queried.pendingReason } : {}) }
      : { kind: queried.kind, moment: queried.moment, phase: queried.phase, throughTick };
    const responseInput = { ...root.response, world: { ...root.response.world, actors }, surfaces: [...root.response.surfaces,
      ...ids.map(id => ({ surfaceId: battedWorldBaseSurfaceId(id), material: root.geometry.baseModels[id].material })),...materials] };
    // Once this query proves a sole new impulse, old colliders are searched
    // normally again. Only its immediately preceding collider can be excluded.
    const responsePrior = world.kind === 'boundary' && world.contacts.length === 1
      && ['actor', 'surface'].includes(world.contacts[0].kind) ? { ...prior, previousContacts: [] } : prior;
    const response = respondToBallWorldBoundary(responseInput, responsePrior, world);
    if (response.kind === 'rebound' && response.cursor.sourceCurve) {
      const originalResponse = { ...root.response, world: { ...root.response.world, actors } };
      const firstContact=queried.contacts[0];
      const diagnostic = firstContact.kind === 'base'
        ? session.adoptBaseImpulse(queried, originalResponse, Object.fromEntries(ids.map(id => [id, root.geometry.baseModels[id].material])) as Record<typeof ids[number], typeof root.geometry.baseModels.home.material>, response.cursor.sourceCurve)
        : firstContact.kind==='surface'&&poles.some(p=>p.surfaceId===firstContact.surfaceId)
          ?session.adoptPoleImpulse(queried,originalResponse,materials,response.cursor.sourceCurve)
          :session.adoptImpulse(queried, originalResponse, response.cursor.sourceCurve);
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
  return freeze({ solverVersion: 'source_field_pole_contact_escape_v145', parkEquipment,initial, steps, field, impulseCertificates: certificates, escapedIntervals: advances });
};
