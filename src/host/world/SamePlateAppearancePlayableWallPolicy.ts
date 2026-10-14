import { getRuleProfile } from '../../core/rules/RuleProfile';
import type { GroundedPlayableWallInput } from '../../core/rules/BallWorldGroundedPlayableWall';
import { battedVenuePlayableWallPolicyInput } from './BattedVenuePlayableWallPolicy';
import type { AcceptedBattedWorldModel } from './BattedWorldModel';
import { actorHash as hash, actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaHash } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaPhysicalFieldRootSource, SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';

export type SamePaPlayableWallPolicyBinding = Readonly<{
  policyHash: string; fixtureHash: string; worldModelHash: string; ruleProfileHash: string; geometryBindingHash: string;
}>;
/** Runs inside the original reserved physical-root owner, after its fixture,
 * model and geometry have been authenticated. The same accepted policy is
 * configuration on this Source; it grants no legacy owner identity. */
export const bindSamePaPlayableWallPolicy = (source: SamePaPhysicalFieldRootSource, original: Readonly<{
  actor: DurablePhysicalPlateAppearanceActor; model: AcceptedBattedWorldModel;
  fixture: Readonly<Record<string, unknown>>; geometryBindingHash: string;
}>): SamePaPlayableWallPolicyBinding | undefined => {
  if (!('venuePolicy' in source)) return undefined;
  const policy = battedVenuePlayableWallPolicyInput(source.venuePolicy!), { actor, model, fixture, geometryBindingHash } = original;
  if (policy.baseFieldSourceId !== source.sourceId || policy.physicalPitchSourceId !== source.launchReference.sourceId
    || policy.gameId !== actor.source.gameId || policy.gameId !== model.gameId || policy.gameId !== fixture.game_id
    || policy.playId !== actor.match.playId || policy.fixtureEventId !== actor.binding.fixtureEventId
    || policy.fixtureEventId !== model.fixtureEventId || policy.fixtureEventId !== fixture.fixture_event_id
    || policy.venueId !== model.venueId || policy.venueId !== fixture.venue_id || hash(fixture) !== actor.fixtureHash
    || policy.worldModelSourceId !== model.sourceId || policy.worldModelSourceVersion !== model.sourceVersion
    || policy.availableAtDay > actor.binding.gameDay || policy.rulePolicy.ruleProfileId !== actor.match.ruleProfileId
    || !samePaHash(geometryBindingHash)
    || policy.rulePolicy.surfaceIds.some(id => model.surfaces.filter(surface => surface.surfaceId === id).length !== 1)) {
    throw new Error('reserved playable-wall policy differs from original physical venue scope');
  }
  return freeze({ policyHash: hash(policy), fixtureHash: hash(fixture), worldModelHash: hash(model),
    ruleProfileHash: hash(getRuleProfile(policy.rulePolicy.ruleProfileId)), geometryBindingHash });
};

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
/** Only an authenticated reserved prefix may call this projection. Every raw
 * contact retains its actual reserved root/step owner and physical response. */
export const samePaPlayableWallEvidence = (root: SamePaPhysicalFieldRoot, physicalFields: readonly Field[]) => {
  if (!('venuePolicy' in root.source) && !('venuePolicyBinding' in root)) return undefined;
  const policy = battedVenuePlayableWallPolicyInput(root.source.venuePolicy!), binding = root.venuePolicyBinding;
  if (!binding || !fields(binding, ['policyHash', 'fixtureHash', 'worldModelHash', 'ruleProfileHash', 'geometryBindingHash'])
    || !Object.values(binding).every(samePaHash) || binding.policyHash !== hash(policy)
    || binding.ruleProfileHash !== hash(getRuleProfile(policy.rulePolicy.ruleProfileId)) || binding.geometryBindingHash !== root.geometryBindingHash
    || policy.baseFieldSourceId !== root.source.sourceId || policy.physicalPitchSourceId !== root.physicalPitchSourceId
    || policy.gameId !== root.lineage.gameId || policy.playId !== root.lineage.playId
    || policy.rulePolicy.surfaceIds.some(id => root.response.world.surfaces.filter(surface => surface.surfaceId === id).length !== 1)) {
    throw new Error('reserved playable-wall original policy binding differs');
  }
  const rawContacts = physicalFields.flatMap(value => {
    const motion = value.field.motion;
    if (motion.world.kind !== 'boundary') return [];
    const originalReference = reference(value.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', value);
    const reboundCursor = motion.carrierPlayerId === null && motion.response.kind === 'rebound' ? motion.response.cursor : null;
    return motion.world.contacts.flatMap((contact, rawContactIndex) => contact.kind !== 'surface' ? [] : [{ originalReference, rawContactIndex, contact, reboundCursor }]);
  });
  const playableWalls: GroundedPlayableWallInput = { policy: policy.rulePolicy,
    physicalContacts: rawContacts.map(({ contact, reboundCursor }) => ({ contact, reboundCursor })) };
  return freeze({ playableWalls, venuePolicyReference: { sourceId: policy.sourceId, sourceVersion: policy.sourceVersion, ...binding,
    fieldRootReference: reference('pa_physical_v1_field_roots', root), rawContacts } });
};
