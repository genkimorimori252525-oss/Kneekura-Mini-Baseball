import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { ballWorldVenueLegalPolicyInput, type BallWorldVenueLegalPolicy } from '../../core/rules/BallWorldVenueLegalCoverage';
import { getRuleProfile } from '../../core/rules/RuleProfile';
import type { BaseTouchRegion } from '../../core/sim/running/BaseTouch';
import type { Vec3 } from '../../core/model/geometry';
import type { AcceptedBattedWorldModel } from './BattedWorldModel';
import type { AcceptedBattedContactResponseModel } from './SqliteBattedContactResponseStore';
import { actorHash as hash, actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaHash, samePaText as text } from './SamePlateAppearanceWorkPrefix';

/** Accepted venue interiors, not a legal edge or an automatically chosen route. */
export type SamePaDefenseExit = Readonly<{ exitId: string; kind: 'bench' | 'clubhouse'; minimum: Vec3; maximum: Vec3 }>;
export type AcceptedBattedVenueLegalCoveragePolicy = Readonly<{
  sourceId: string; sourceVersion: string; version: 'batted_venue_legal_coverage_policy_v1';
  gameId: string; careerId: string; playId: number; physicalPitchSourceId: string; fixtureEventId: string; venueId: string;
  baseFieldSourceId: string; worldModelSourceId: string; worldModelSourceVersion: string;
  responseModelSourceId: string; responseModelSourceVersion: string; geometryBindingHash: string; availableAtDay: number;
  rulePolicy: BallWorldVenueLegalPolicy;
  pitcherPlate?: Readonly<{ region: BaseTouchRegion; surfaceHeightMeters: number }>;
  defenseExits?: readonly SamePaDefenseExit[];
}>;
export type SamePaVenueLegalCoveragePolicyBinding = Readonly<{
  policyHash: string; fixtureHash: string; worldModelHash: string; responseModelHash: string; ruleProfileHash: string; geometryBindingHash: string;
}>;
export const battedVenueLegalCoveragePolicyInput = (raw: AcceptedBattedVenueLegalCoveragePolicy): AcceptedBattedVenueLegalCoveragePolicy => {
  const p = cloneInert(raw);
  if (!fields(p, ['sourceId', 'sourceVersion', 'version', 'gameId', 'careerId', 'playId', 'physicalPitchSourceId', 'fixtureEventId', 'venueId',
    'baseFieldSourceId', 'worldModelSourceId', 'worldModelSourceVersion', 'responseModelSourceId', 'responseModelSourceVersion',
    'geometryBindingHash', 'availableAtDay', 'rulePolicy', ...('pitcherPlate' in p ? ['pitcherPlate'] : []), ...('defenseExits' in p ? ['defenseExits'] : [])])
    || p.version !== 'batted_venue_legal_coverage_policy_v1'
    || ![p.sourceId, p.sourceVersion, p.gameId, p.careerId, p.physicalPitchSourceId, p.fixtureEventId, p.venueId,
      p.baseFieldSourceId, p.worldModelSourceId, p.worldModelSourceVersion, p.responseModelSourceId, p.responseModelSourceVersion].every(text)
    || !samePaHash(p.geometryBindingHash) || !Number.isSafeInteger(p.playId) || p.playId < 0
    || !Number.isSafeInteger(p.availableAtDay) || p.availableAtDay < 0) throw new Error('invalid accepted venue legal coverage Source');
  ballWorldVenueLegalPolicyInput(p.rulePolicy);
  if ('pitcherPlate' in p) {
    const plate = p.pitcherPlate, region = plate?.region;
    if (!fields(plate, ['region', 'surfaceHeightMeters']) || !fields(region, ['center', 'halfSize', 'rotationRadians'])
      || !fields(region?.center, ['x', 'z']) || !fields(region?.halfSize, ['x', 'z'])
      || ![plate!.surfaceHeightMeters, region!.rotationRadians, ...Object.values(region!.center), ...Object.values(region!.halfSize)].every(Number.isFinite)
      || region!.halfSize.x <= 0 || region!.halfSize.z <= 0) throw new Error('invalid original venue pitcher plate geometry');
  }
  if ('defenseExits' in p) {
    const exits = p.defenseExits, axes = ['x', 'y', 'z'] as const;
    if (!Array.isArray(exits) || !exits.length || new Set(exits.map(e => e?.exitId)).size !== exits.length
      || exits.some(e => {
        if (!fields(e, ['exitId', 'kind', 'minimum', 'maximum']) || !text(e.exitId)
          || e.kind !== 'bench' && e.kind !== 'clubhouse') return true;
        const { minimum, maximum } = e;
        if (!fields(minimum, axes) || !fields(maximum, axes)) return true;
        return axes.some(axis => {
          const lower = minimum[axis], upper = maximum[axis];
          return typeof lower !== 'number' || typeof upper !== 'number' || !Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper;
        });
      })) throw new Error('invalid original venue defense exit interiors');
  }
  return freeze(p);
};
/** Invoked only by the immutable root owner with its already authenticated
 * original calibration. No contact result or future throw is accepted here. */
export const bindSamePaVenueLegalCoveragePolicy = (source: Readonly<{ sourceId: string; launchReference: Readonly<{ sourceId: string }>;
  venueLegalCoveragePolicy?: AcceptedBattedVenueLegalCoveragePolicy }>, original: Readonly<{
  actor: DurablePhysicalPlateAppearanceActor; model: AcceptedBattedWorldModel; responseModel: AcceptedBattedContactResponseModel;
  fixture: Readonly<Record<string, unknown>>; geometryBindingHash: string;
}>): SamePaVenueLegalCoveragePolicyBinding | undefined => {
  if (!('venueLegalCoveragePolicy' in source)) return undefined;
  const p = battedVenueLegalCoveragePolicyInput(source.venueLegalCoveragePolicy!), { actor, model, responseModel, fixture, geometryBindingHash } = original;
  if (p.baseFieldSourceId !== source.sourceId || p.physicalPitchSourceId !== source.launchReference.sourceId
    || p.gameId !== actor.source.gameId || p.gameId !== model.gameId || p.gameId !== responseModel.gameId || p.gameId !== fixture.game_id
    || p.careerId !== actor.binding.careerId || p.careerId !== model.careerId || p.careerId !== responseModel.careerId
    || p.playId !== actor.match.playId || p.fixtureEventId !== actor.binding.fixtureEventId || p.fixtureEventId !== model.fixtureEventId
    || p.fixtureEventId !== responseModel.fixtureEventId || p.fixtureEventId !== fixture.fixture_event_id
    || p.venueId !== model.venueId || p.venueId !== responseModel.venueId || p.venueId !== fixture.venue_id
    || p.worldModelSourceId !== model.sourceId || p.worldModelSourceVersion !== model.sourceVersion
    || p.responseModelSourceId !== responseModel.sourceId || p.responseModelSourceVersion !== responseModel.sourceVersion
    || p.geometryBindingHash !== geometryBindingHash || hash(fixture) !== actor.fixtureHash
    || p.availableAtDay > actor.binding.gameDay || p.rulePolicy.ruleProfileId !== actor.match.ruleProfileId)
    throw new Error('venue legal coverage differs from original physical fixture/model/geometry scope');
  return freeze({ policyHash: hash(p), fixtureHash: hash(fixture), worldModelHash: hash(model), responseModelHash: hash(responseModel),
    ruleProfileHash: hash(getRuleProfile(p.rulePolicy.ruleProfileId)), geometryBindingHash });
};
