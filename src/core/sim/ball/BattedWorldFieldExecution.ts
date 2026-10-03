import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import { assertBattedResponseProfiles } from './BattedBallContactResponse';
import type { BallWorldBaseBoundaryContact } from './BallWorldBaseBoundary';
import type { AcceleratedBallWorldFieldMotion, AcceleratedBallWorldMotion, BallWorldContinuation, BallWorldCollider, BallWorldFieldBoundaryContact, BallWorldFieldContinuation } from './BallWorldContinuation';
import { battedWorldBaseSurfaceId, createBattedWorldFieldGeometry, type BattedWorldFieldGeometry } from './BattedWorldFieldMotion';
import type { BattedWorldBaseId } from './BattedWorldBaseGeometry';

const baseIds = ['home', 'first', 'second', 'third'] as const;
export const hasBattedWorldFieldFields = (value: unknown, names: readonly string[]): boolean => !!value && typeof value === 'object'
  && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...names].sort().join('|');
export const freezeBattedWorldField = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeBattedWorldField); Object.freeze(value); }
  return value;
};
/** Additive execution rejects a second geometry/model view; Native binds this to its original accepted calibration. */
export const assertBattedWorldFieldExecutionScope = (response: BattedBallContactResponseInput, geometry: BattedWorldFieldGeometry): void => {
  if (!hasBattedWorldFieldFields(geometry, ['baseGeometry', 'baseModels', 'bases'])) throw new Error('invalid actual field execution geometry');
  const derived = createBattedWorldFieldGeometry({ baseGeometry: geometry.baseGeometry, baseModels: geometry.baseModels });
  if (JSON.stringify(derived) !== JSON.stringify(geometry)) throw new Error('actual field execution bag geometry differs');
  assertBattedResponseProfiles(response);
  if (response.world.surfaces.some((surface) => baseIds.some((id) => surface.surfaceId === battedWorldBaseSurfaceId(id)))) {
    throw new Error('original wall uses reserved base collider identity');
  }
};
export const battedWorldFieldExecutionPrevious = (contacts: readonly BallWorldCollider[]) => {
  const baseId = (contact: BallWorldCollider): BattedWorldBaseId | undefined => contact.kind === 'surface'
    ? baseIds.find((id) => contact.surfaceId === battedWorldBaseSurfaceId(id)) : undefined;
  return { previousContacts: contacts.filter((contact) => !baseId(contact)),
    previousBaseContacts: contacts.flatMap((contact) => { const id = baseId(contact); return id ? [id] : []; }) };
};
const compatibleContact = (contact: BallWorldFieldBoundaryContact) => contact.kind === 'base'
  ? { kind: 'surface' as const, surfaceId: battedWorldBaseSurfaceId(contact.baseId), moment: contact.moment, point: contact.point, normal: contact.normal,
    ...(contact.continuing ? { continuing: true as const } : {}) } : contact;
/** Preserve explicit physical bag evidence beside the compatibility surface view used by existing response kernels. */
type FieldBoundaryView<T> = Readonly<{ world: T; baseContacts: readonly BallWorldBaseBoundaryContact[] }>;
export function battedWorldFieldExecutionBoundary(world: BallWorldFieldContinuation): FieldBoundaryView<BallWorldContinuation>;
export function battedWorldFieldExecutionBoundary(world: AcceleratedBallWorldFieldMotion): FieldBoundaryView<AcceleratedBallWorldMotion>;
export function battedWorldFieldExecutionBoundary(world: BallWorldFieldContinuation | AcceleratedBallWorldFieldMotion): FieldBoundaryView<BallWorldContinuation | AcceleratedBallWorldMotion> {
  return { world: world.kind !== 'boundary' ? world : { ...world, contacts: world.contacts.map(compatibleContact) },
    baseContacts: world.kind === 'boundary' ? world.contacts.filter((contact): contact is BallWorldBaseBoundaryContact => contact.kind === 'base') : [] };
}
export const battedWorldFieldExecutionResponse = (response: BattedBallContactResponseInput, geometry: BattedWorldFieldGeometry): BattedBallContactResponseInput => ({
  ...response, surfaces: [...response.surfaces, ...baseIds.map((id) => ({ surfaceId: battedWorldBaseSurfaceId(id), material: geometry.baseModels[id].material }))],
});
