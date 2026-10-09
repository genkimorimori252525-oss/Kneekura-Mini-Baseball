import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze, actorHash as hash, actorJson as json, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaExecutionView } from './SamePlateAppearanceExecutionView';
import type { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { samePaFields as fields, samePaHash, samePaText, samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';

export const samePaDispatchRoutes = Object.freeze(['pitch_delivery', 'batter_observation', 'batter_decision', 'batter_motor',
  'batter_swing', 'defender_observation', 'defender_decision', 'defender_locomotion'] as const);
export type SamePaDispatchRoute = typeof samePaDispatchRoutes[number];
export type SamePaDispatchMember = Readonly<{ playerId: string; bindingHash: string; personHash: string; baselineSourceId: string;
  reservedRevision: number; reservedStateHash: string; projectedStateHash: string }>;
export type SamePaDispatchCalibrationReference = Readonly<{ route: SamePaDispatchRoute;
  calibrationReference: SamePaReference<'pa_dispatch_v1_execution_calibrations'> }>;
export type SamePaDispatchParticipantInput = Readonly<{ member: SamePaDispatchMember; calibrationReferences: readonly SamePaDispatchCalibrationReference[] }>;
const positions = Object.freeze(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const);
export type SamePaDispatchRole = 'batter' | 'runner' | typeof positions[number];
export type SamePaDispatchRoleBinding = Readonly<{ role: SamePaDispatchRole; member: SamePaDispatchMember; routes: readonly SamePaDispatchRoute[] }>;
const battingRoutes = Object.freeze(['batter_observation', 'batter_decision', 'batter_motor', 'batter_swing'] as const);
const fieldRoutes = Object.freeze(['defender_observation', 'defender_decision', 'defender_locomotion'] as const);
function fail(): never { throw new Error('same-PA dispatch original role or member differs'); }
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) fail(); };

export const samePaDispatchMemberValid = (value: unknown): value is SamePaDispatchMember =>
  fields(value, ['playerId', 'bindingHash', 'personHash', 'baselineSourceId', 'reservedRevision', 'reservedStateHash', 'projectedStateHash'])
  && samePaText(value.playerId) && samePaText(value.baselineSourceId) && Number.isSafeInteger(value.reservedRevision)
  && Number(value.reservedRevision) >= 0 && [value.bindingHash, value.personHash, value.reservedStateHash, value.projectedStateHash].every(samePaHash);
export const samePaDispatchRouteValid = (value: unknown): value is SamePaDispatchRoute => samePaDispatchRoutes.includes(value as SamePaDispatchRoute);
export const samePaDispatchCalibrationReferencesValid = (value: unknown): value is readonly SamePaDispatchCalibrationReference[] =>
  Array.isArray(value) && value.length <= samePaDispatchRoutes.length && value.every(v => fields(v, ['route', 'calibrationReference'])
    && samePaDispatchRouteValid(v.route) && samePaReferenceValid(v.calibrationReference, 'pa_dispatch_v1_execution_calibrations'))
  && new Set(value.map(v => v.route)).size === value.length && new Set(value.map(v => v.calibrationReference.sourceId)).size === value.length;
export const samePaDispatchParticipantInputs = (raw: unknown): readonly SamePaDispatchParticipantInput[] => {
  const value = cloneInert(raw);
  if (!Array.isArray(value) || value.length < 10 || value.length > 13 || value.some(p => !fields(p, ['member', 'calibrationReferences'])
    || !samePaDispatchMemberValid(p.member) || !samePaDispatchCalibrationReferencesValid(p.calibrationReferences))
    || new Set(value.map(p => p.member.playerId)).size !== value.length) fail();
  const calibrationIds = value.flatMap(p => p.calibrationReferences.map((r: SamePaDispatchCalibrationReference) => r.calibrationReference.sourceId));
  if (new Set(calibrationIds).size !== calibrationIds.length) fail();
  return freeze(value);
};

/** Pure consistency/registry calculation only. Native owners must authenticate
 * the actor and view before use; this result is never an admission proof. */
export const deriveSamePaDispatchRoles = (rawActor: DurablePhysicalPlateAppearanceActor, rawView: SamePaExecutionView,
  rawOriginals?: ReturnType<typeof readSamePaOriginalParticipants>): readonly SamePaDispatchRoleBinding[] => {
  const actor = cloneInert(rawActor), view = cloneInert(rawView);
  if (!actor || !view || view.kind !== 'basis_prepared' || !actor.source || !actor.binding || !actor.world
    || !Array.isArray(actor.world.defenders) || !Array.isArray(actor.defenderBindings) || !Array.isArray(actor.defenderPersons)
    || !view.lineage || !Array.isArray(view.lineage.participantReferences) || !Array.isArray(view.participants)) fail();
  const defenders = actor.world.defenders, originalBindings = [actor.binding, ...actor.defenderBindings], originalPersons = [actor.person, ...actor.defenderPersons];
  const runners = actor.world.runners ?? [], originals = rawOriginals === undefined ? undefined : cloneInert(rawOriginals);
  const count = 10 + runners.length;
  if (count > 13 || runners.length && !originals || originals && originals.length !== count) fail();
  if (originals) {
    same(originals.slice(0, 10).map(p => p.binding), originalBindings); same(originals.slice(0, 10).map(p => p.person), originalPersons);
    const occupied = (['first', 'second', 'third'] as const).flatMap((base, i) => actor.match.bases[base] === null ? [] : [{ playerId: actor.match.bases[base], base: i + 1 }]);
    same(originals.slice(10).map(p => ({ playerId: p.binding.playerId, base: p.startingBase })), occupied);
    same(runners.map(r => r.playerId).sort(), occupied.map(r => r.playerId).sort());
    if (originals.slice(10).some(p => p.role !== 'runner' || p.binding.side !== actor.binding.side)) fail();
  }
  const bindings = originals?.map(p => p.binding) ?? originalBindings, persons = originals?.map(p => p.person) ?? originalPersons;
  if (defenders.length !== 9 || actor.defenderBindings.length !== 9 || actor.defenderPersons.length !== 9
    || view.lineage.participantReferences.length !== count || view.participants.length !== count
    || new Set(defenders.map(d => d.playerId)).size !== 9 || new Set(defenders.map(d => d.registeredPosition)).size !== 9
    || positions.some(position => !defenders.some(d => d.registeredPosition === position))
    || new Set(bindings.map(b => b.playerId)).size !== count || new Set(bindings.map(b => b.personId)).size !== count
    || new Set(view.participants.map(p => p.playerId)).size !== count || new Set(view.lineage.participantReferences.map(p => p.playerId)).size !== count
    || actor.source.playerId !== actor.binding.playerId || view.lineage.careerId !== actor.binding.careerId
    || view.lineage.gameId !== actor.source.gameId || view.lineage.playId !== actor.match.playId) fail();
  same(view.lineage.actorReference, { owner: 'physical_plate_appearance_actors', sourceId: actor.source.sourceId, sourceHash: hash(actor.source), snapshotHash: hash(actor) });
  same(view.source.enrollmentReference, view.lineage.enrollmentReference);
  const member = (playerId: string): SamePaDispatchMember => {
    const binding = bindings.find(b => b.playerId === playerId), person = persons.find(p => p.playerId === playerId);
    const reserved = view.lineage.participantReferences.find(p => p.playerId === playerId), projected = view.participants.find(p => p.playerId === playerId);
    if (!binding || !person || !reserved || !projected || binding.personId !== person.personId || binding.personLinkSourceId !== person.sourceId
      || binding.careerId !== actor.binding.careerId || binding.gameId !== actor.source.gameId || binding.gameDay !== actor.binding.gameDay
      || binding.fixtureEventId !== actor.binding.fixtureEventId || binding.competitionEditionId !== actor.binding.competitionEditionId
      || reserved.bindingHash !== hash(binding) || reserved.personHash !== hash(person) || reserved.stateHash !== hash(projected.reservedState)
      || reserved.revision !== projected.reservedState.revision || projected.projectedStateHash !== hash(projected.projectedState)
      || projected.reservedState.playerId !== playerId || projected.projectedState.playerId !== playerId
      || projected.reservedState.careerId !== binding.careerId || projected.projectedState.careerId !== binding.careerId) fail();
    const result = { playerId, bindingHash: reserved.bindingHash, personHash: reserved.personHash, baselineSourceId: reserved.baselineSourceId,
      reservedRevision: reserved.revision, reservedStateHash: reserved.stateHash, projectedStateHash: projected.projectedStateHash };
    if (!samePaDispatchMemberValid(result)) fail(); return result;
  };
  return freeze([{ role: 'batter' as const, member: member(actor.binding.playerId), routes: battingRoutes }, ...positions.map(role => {
    const defender = defenders.find(d => d.registeredPosition === role)!;
    const binding = actor.defenderBindings.find(b => b.playerId === defender.playerId);
    if (!binding || binding.side === actor.binding.side) fail();
    return { role, member: member(defender.playerId), routes: role === 'P' ? ['pitch_delivery' as const, ...fieldRoutes] : fieldRoutes };
  }), ...(originals?.slice(10).map(p => ({ role: 'runner' as const, member: member(p.binding.playerId), routes: [] as const })) ?? [])]);
};

export type SamePaDispatchPrerequisite = Readonly<{ playerId: string; route: SamePaDispatchRoute;
  reason: 'missing_calibration_reference' | 'unsupported_core_adapter' }>;
/** Preparation capabilities only: each route has a real numerical Native
 * composition. The accepted original/current operation cut is authenticated
 * separately at invocation; future field observations are not TAKE inputs.
 * Keep this list explicit so adding a route cannot silently enable it. */
const supportedAdapterRoutes: readonly SamePaDispatchRoute[] = Object.freeze([
  'pitch_delivery', 'batter_observation', 'batter_decision', 'batter_motor', 'batter_swing',
  'defender_observation', 'defender_decision', 'defender_locomotion',
]);
export const samePaNativeAdapterImplemented = (route: SamePaDispatchRoute): boolean => supportedAdapterRoutes.includes(route);
export const samePaDispatchPrerequisites = (actor: DurablePhysicalPlateAppearanceActor, view: SamePaExecutionView,
  rawInputs: unknown, originals?: ReturnType<typeof readSamePaOriginalParticipants>): readonly SamePaDispatchPrerequisite[] => {
  const roles = deriveSamePaDispatchRoles(actor, view, originals), inputs = samePaDispatchParticipantInputs(rawInputs);
  if (inputs.length !== roles.length) fail();
  const prerequisites: SamePaDispatchPrerequisite[] = [];
  for (const [i, role] of roles.entries()) {
    const input = inputs[i]; same(input.member, role.member);
    const supplied = input.calibrationReferences.map(r => r.route);
    same(supplied, role.routes.filter(route => supplied.includes(route)));
    for (const route of role.routes) {
      if (!supplied.includes(route)) prerequisites.push({ playerId: role.member.playerId, route, reason: 'missing_calibration_reference' });
      if (!supportedAdapterRoutes.includes(route)) prerequisites.push({ playerId: role.member.playerId, route, reason: 'unsupported_core_adapter' });
    }
  }
  return freeze(prerequisites);
};
