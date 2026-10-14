import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { getRuleProfile } from '../../core/rules/RuleProfile';
import { groundedPlayableWallPolicyInput, type GroundedPlayableWallPolicy, type GroundedPlayableWallInput } from '../../core/rules/BallWorldGroundedPlayableWall';
import type { BallWorldBoundaryContact } from '../../core/sim/ball/BallWorldContinuation';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** This policy is part of one immutable accepted Source. Its identity is scoped
 * to that Source, not a separately claimed/global policy owner. Each Native
 * adapter retains the actual field owner's table identity. */
export type AcceptedBattedVenuePlayableWallPolicy = Readonly<{
  sourceId: string; sourceVersion: string; version: 'batted_venue_playable_wall_policy_v1';
  gameId: string; playId: number; physicalPitchSourceId: string; fixtureEventId: string; venueId: string;
  baseFieldSourceId: string; worldModelSourceId: string; worldModelSourceVersion: string; availableAtDay: number;
  rulePolicy: GroundedPlayableWallPolicy;
}>;
const fields = (value: unknown, keys: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value;
const nonnegative = (value: number) => Number.isSafeInteger(value) && value >= 0;
export const battedVenuePlayableWallPolicyInput = (raw: AcceptedBattedVenuePlayableWallPolicy): AcceptedBattedVenuePlayableWallPolicy => {
  const p = cloneInert(raw);
  if (!fields(p, ['sourceId', 'sourceVersion', 'version', 'gameId', 'playId', 'physicalPitchSourceId', 'fixtureEventId', 'venueId',
    'baseFieldSourceId', 'worldModelSourceId', 'worldModelSourceVersion', 'availableAtDay', 'rulePolicy'])
    || p.version !== 'batted_venue_playable_wall_policy_v1'
    || ![p.sourceId, p.sourceVersion, p.gameId, p.physicalPitchSourceId, p.fixtureEventId, p.venueId,
      p.baseFieldSourceId, p.worldModelSourceId, p.worldModelSourceVersion].every(id)
    || !nonnegative(p.playId) || !nonnegative(p.availableAtDay)) throw new Error('invalid accepted playable-wall policy Source');
  return freeze({ ...p, rulePolicy: groundedPlayableWallPolicyInput(p.rulePolicy) });
};

type RawSurface = Extract<BallWorldBoundaryContact, { kind: 'surface' }>;
export type BattedVenuePlayableWallReference = Readonly<{
  sourceId: string; sourceVersion: string; sourceHash: string; worldModelHash: string; ruleProfileHash: string;
  rawContacts: readonly Readonly<{ owner: 'batted_world_field_actions' | 'batted_world_field_executions';
    sourceId: string; sourceVersion: string; revision: number; sourceHash: string; snapshotHash: string;
    rawContactIndex: number; contact: RawSurface;
    reboundCursor: GroundedPlayableWallInput['physicalContacts'][number]['reboundCursor'] }>[];
}>;

/** Called only with the execution owner's already authenticated original
 * prefix. All policy inputs are inert accepted Source data, never contact facts. */
export const bindBattedVenuePlayableWalls = (raw: AcceptedBattedVenuePlayableWallPolicy, prefix: Readonly<{
  baseField: DurableBattedWorldFieldAction; fields: readonly DurableBattedWorldFieldAction[];
  executions: readonly DurableBattedWorldFieldExecution[];
}>): Readonly<{ playableWalls: GroundedPlayableWallInput; venuePolicyReference: BattedVenuePlayableWallReference }> => {
  const policy = battedVenuePlayableWallPolicyInput(raw), base = prefix.baseField;
  const world = base.response.touch.worldContact, model = world.model, pitch = world.flight.physicalPitch;
  const fixture = base.geometry.baseGeometry.fixture;
  if (policy.baseFieldSourceId !== base.source.sourceId || policy.gameId !== pitch.frame.gameId
    || policy.gameId !== model.gameId || policy.playId !== pitch.frame.match.playId
    || policy.physicalPitchSourceId !== pitch.source.sourceId || policy.fixtureEventId !== model.fixtureEventId
    || policy.fixtureEventId !== fixture.fixture_event_id || policy.venueId !== model.venueId || policy.venueId !== fixture.venue_id
    || policy.worldModelSourceId !== model.sourceId || policy.worldModelSourceVersion !== model.sourceVersion
    || policy.availableAtDay > pitch.frame.batterActor!.binding.gameDay || policy.rulePolicy.ruleProfileId !== pitch.frame.match.ruleProfileId
    || policy.rulePolicy.surfaceIds.some(id => model.surfaces.filter(surface => surface.surfaceId === id).length !== 1)) {
    throw new Error('playable-wall policy differs from original physical venue scope');
  }
  const rawContacts: BattedVenuePlayableWallReference['rawContacts'][number][] = [];
  const collect = (field: DurableBattedWorldFieldAction['field'], reference: Omit<BattedVenuePlayableWallReference['rawContacts'][number], 'rawContactIndex' | 'contact' | 'reboundCursor'>) => {
    if (field.motion.world.kind !== 'boundary') return;
    const reboundCursor = field.motion.carrierPlayerId === null && field.motion.response.kind === 'rebound'
      ? field.motion.response.cursor : null;
    field.motion.world.contacts.forEach((contact, rawContactIndex) => {
      if (contact.kind === 'surface') rawContacts.push({ ...reference, rawContactIndex, contact, reboundCursor });
    });
  };
  for (const value of prefix.fields) collect(value.field, { owner: 'batted_world_field_actions', sourceId: value.source.sourceId,
    sourceVersion: value.source.sourceVersion, revision: value.revision, sourceHash: hash(value.source), snapshotHash: hash(value) });
  for (const value of prefix.executions) {
    // Plans and observations repeat another event's field; they are not origins.
    if (['whole_play_history', 'base_touch_history', 'first_base_race', 'acquisition_plan', 'throw_plan'].includes(value.execution.kind)) continue;
    collect(value.execution.field, { owner: 'batted_world_field_executions', sourceId: value.source.sourceId,
      sourceVersion: value.source.sourceVersion, revision: value.revision, sourceHash: hash(value.source), snapshotHash: ownedScheduledMotionArchiveHash(value) });
  }
  return freeze({ playableWalls: { policy: policy.rulePolicy, physicalContacts: rawContacts.map(({ contact, reboundCursor }) => ({ contact, reboundCursor })) },
    venuePolicyReference: { sourceId: policy.sourceId, sourceVersion: policy.sourceVersion, sourceHash: hash(policy),
      worldModelHash: hash(model), ruleProfileHash: hash(getRuleProfile(policy.rulePolicy.ruleProfileId)), rawContacts } });
};
