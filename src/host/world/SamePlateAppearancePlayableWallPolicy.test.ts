import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { actorHash as hash, actorJson as json, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaPhysicalEpisodeSourceInput, type SamePaPhysicalFieldRootSource, type SamePaPhysicalFieldRoot, type SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { AcceptedBattedVenuePlayableWallPolicy } from './BattedVenuePlayableWallPolicy';
import { fixture, material, v } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveSamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalFieldCalculation';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import { bindSamePaPlayableWallPolicy, samePaPlayableWallEvidence } from './SamePlateAppearancePlayableWallPolicy';
import type { AcceptedBattedWorldModel } from './BattedWorldModel';
const ref = <T extends string>(owner: T) => ({ owner, sourceId: owner, sourceHash: hash(owner), snapshotHash: hash(owner) });
const policy = (): AcceptedBattedVenuePlayableWallPolicy => ({ sourceId: 'venue-policy', sourceVersion: 'explicit-v1', version: 'batted_venue_playable_wall_policy_v1',
  gameId: 'game', playId: 1, physicalPitchSourceId: 'pa_physical_v1_launches', fixtureEventId: 'fixture', venueId: 'venue',
  baseFieldSourceId: 'reserved-root', worldModelSourceId: 'world-model', worldModelSourceVersion: 'model-v1', availableAtDay: 1,
  rulePolicy: { version: 'grounded_fair_playable_wall_v1', ruleProfileId: asRuleProfileId('npb-2026'), rulesRevision: '2026', surfaceIds: ['wall'] } });
const source = () => ({ sourceId: 'reserved-root', sourceVersion: 'fixture-v1', capability: 'same_pa_physical_field_root_v1',
  viewReference: ref('pa_lifecycle_v1_execution_views'), launchReference: ref('pa_physical_v1_launches'), previousOperationReference: ref('pa_physical_v1_resolutions'),
  resolutionReference: ref('pa_physical_v1_resolutions'), postureReference: ref('batting_observation_v1_postures'),
  fieldInputs: { kind: 'fresh_physical_field_calibration_v1', calibrationReference: ref('pa_physical_v1_field_calibrations') },
  commands: Array.from({ length: 10 }, (_, i) => ({ playerId: String(i), bodyAcceleration: { x: 0, y: 0, z: 0 }, primitiveMotions: [] })),
  parameters: DEFAULT_BALL_FLIGHT_PARAMETERS, throughTick: 1_000_000 } as SamePaPhysicalFieldRootSource);

it('RW01 accepts explicit playable-wall policy on its original reserved physical field-root Source', () => {
  const original = { ...source(), venuePolicy: policy() };
  expect(samePaPhysicalEpisodeSourceInput(original)).toEqual(original);
});

// Synthetic input-to-calculation checks. Native ownership itself is not claimed.
const originalScope = () => {
  const fixture = { game_id: 'game', fixture_event_id: 'fixture', venue_id: 'venue' };
  const actor = { source: { gameId: 'game' }, match: { playId: 1, ruleProfileId: asRuleProfileId('npb-2026') },
    binding: { fixtureEventId: 'fixture', gameDay: 1 }, fixtureHash: hash(fixture) } as unknown as DurablePhysicalPlateAppearanceActor;
  const model: AcceptedBattedWorldModel = { sourceId: 'world-model', sourceVersion: 'model-v1', gameId: 'game', careerId: 'career',
    fixtureEventId: 'fixture', venueId: 'venue', availableAtDay: 1, actors: [], batterGripOffset: v(0, 0, 0),
    surfaces: [{ surfaceId: 'wall', start: { x: 12, z: 0 }, end: { x: 12, z: 20 }, minimumHeight: 0, maximumHeight: 10 }] };
  return { actor, model, fixture, geometryBindingHash: hash('calibration') };
};
const physical = (withPolicy = true) => {
  const original = fixture(), context = originalScope(), ids = ['batter', ...Array.from({ length: 9 }, (_, i) => 'defender-' + i)];
  const roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const;
  const actors = ids.flatMap((playerId, i) => roles.map((role, r) => ({ playerId, primitive: { role, radius: 0.125,
    startTick: 0, endTick: 5_000_000, ticksPerSecond: 1_000_000, startCenter: v(100 + i * 5, 10 + r, 50),
    startVelocity: v(0, 0, 0), acceleration: v(0, 0, 0) } })));
  const parameters = { ...original.response.world.parameters, gravityY: -9.81, groundRestitution: 0, groundFriction: 1, groundRollingDecelerationMps2: 0 };
  const contact = { ...original.response.world.flight.contact, ballCenter: v(10, 1, 10), point: v(10, 1, 10), batPoint: v(10, 1, 10), exitVelocity: v(2, 0, 0) };
  const response = { ...original.response, world: { ...original.response.world, actors, parameters, surfaces: context.model.surfaces,
    flight: createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 0 }) },
    actors: actors.map(a => ({ playerId: a.playerId, profile: a.primitive.role === 'glove' ? original.response.actors[0].profile : { role: a.primitive.role, material } })),
    surfaces: [{ surfaceId: 'wall', material }] };
  const field = deriveInitialBattedWorldFieldMotion({ response, geometry: original.geometry, availableAtTick: 0, throughTick: 2_000_000,
    commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: v(0, 0, 0) })) });
  const rootSource = { ...source(), parameters, ...(withPolicy ? { venuePolicy: policy() } : {}) };
  const binding = bindSamePaPlayableWallPolicy(rootSource, context);
  const root = { kind: 'same_pa_physical_field_root_v1', source: rootSource, stage: 'field', physicalPitchSourceId: rootSource.launchReference.sourceId,
    pitchOrdinal: 3, operationOrdinal: 3, evaluationTick: field.motion.world.moment.ball.tick, response, geometry: original.geometry, field,
    geometryBindingHash: context.geometryBindingHash, ...(binding === undefined ? {} : { venuePolicyBinding: binding }),
    lineage: { gameId: 'game', playId: 1 }, timeline: { playId: 1, startedAtTick: 0, lastEventTick: 0, nextSequence: 0,
      events: [], status: { kind: 'batted_ball_pending', count: { balls: 0, strikes: 0 } } } } as unknown as SamePaPhysicalFieldRoot;
  const rootReference = reference('pa_physical_v1_field_roots', root);
  const stepSource: SamePaPhysicalFieldStep['source'] = { sourceId: 'reserved-wall-step', sourceVersion: 'fixture-v1', capability: 'same_pa_physical_field_step_v1',
    viewReference: ref('pa_lifecycle_v1_execution_views'), launchReference: rootSource.launchReference,
    fieldRootReference: rootReference, previousFieldReference: rootReference, previousOperationReference: rootReference, throughTick: 2_000_000 };
  const step: SamePaPhysicalFieldStep = { ...root, kind: 'same_pa_physical_field_step_v1', source: stepSource, operationOrdinal: 4,
    ...deriveSamePaPhysicalFieldStep(stepSource, root, root, root.evaluationTick, false) };
  return { root, step, scope: { fields: [root, step], batterRunnerId: ids[0], defenderIds: ids.slice(1), outsAtStart: 0 } };
};

it.each(['missing', 'result', 'contact'] as const)('RW02 rejects %s policy payload on the reserved Source', kind => {
  const value = { ...source(), venuePolicy: kind === 'missing' ? undefined : { ...policy(), ...(kind === 'result' ? { fair: true } : { contacts: [] }) } };
  expect(() => samePaPhysicalEpisodeSourceInput(value)).toThrow();
});
it.each(['gameId', 'playId', 'physicalPitchSourceId', 'fixtureEventId', 'venueId', 'baseFieldSourceId', 'worldModelSourceVersion', 'availableAtDay', 'surface'] as const)(
  'RW03 rejects mismatched original %s without accepting a rule result', key => {
    const value = policy();
    if (key === 'surface') Object.assign(value.rulePolicy, { surfaceIds: ['unknown'] });
    else Object.assign(value, { [key]: key === 'playId' || key === 'availableAtDay' ? 2 : 'foreign' });
    expect(() => bindSamePaPlayableWallPolicy({ ...source(), venuePolicy: value }, originalScope())).toThrow('reserved playable-wall policy differs');
  });
it('RW04 connects actual reserved ground and wall calculations through their original owner references', () => {
  const h = physical(), before = json(h.scope), result = deriveSamePaFieldRuleEvidence(h.scope), legacy = deriveSamePaFieldRuleEvidence(physical(false).scope);
  expect(h.root.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'ground' }] });
  expect(h.step.field.motion.response.kind).toBe('rebound');
  expect(legacy.rule.pendingContacts).toContainEqual(expect.objectContaining({ reason: 'surface_policy_pending' }));
  expect(legacy.rule.groundRule).toBeNull();
  expect(result.rule.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair' });
  expect(result.rule.pendingContacts).toEqual([]); expect(result.rule.groundRule).not.toBeNull();
  expect(result.venuePolicyReference?.fieldRootReference.owner).toBe('pa_physical_v1_field_roots');
  expect(result.venuePolicyReference?.rawContacts).toHaveLength(1);
  expect(result.venuePolicyReference?.rawContacts[0].originalReference.owner).toBe('pa_physical_v1_field_steps');
  expect(result.venuePolicyReference?.rawContacts[0].originalReference.sourceId).toBe(h.step.source.sourceId);
  expect(result.terminal.physicalEnd).toBeNull(); expect(json(h.scope)).toBe(before);
  expect(legacy).not.toHaveProperty('venuePolicyReference'); expect(legacy.rule).not.toHaveProperty('playableWallEvidence');
});
it('RW05 keeps a reserved surface pending when its physical response is unresolved', () => {
  const h = physical(), step: SamePaPhysicalFieldStep = { ...h.step, field: { ...h.step.field, motion: { ...h.step.field.motion,
    response: { kind: 'unresolved', reason: 'carried_contact', cursor: null }, cursor: null } } };
  const result = deriveSamePaFieldRuleEvidence({ ...h.scope, fields: [h.root, step] });
  expect(result.rule.pendingContacts).toHaveLength(1); expect(result.rule.groundRule).toBeNull();
  expect(result.venuePolicyReference?.rawContacts[0].reboundCursor).toBeNull();
});
it.each(['geometry', 'policy'] as const)('RW06 rejects altered original reserved %s evidence', kind => {
  const h = physical(), root = { ...h.root, ...(kind === 'geometry' ? { geometryBindingHash: hash('foreign') }
    : { source: { ...h.root.source, venuePolicy: { ...policy(), sourceVersion: 'changed-later' } } }) };
  // Invoke the owned-policy projection directly so the changed predecessor hash
  // cannot mask this policy-specific guard.
  expect(() => samePaPlayableWallEvidence(root, [root])).toThrow('reserved playable-wall original policy binding differs');
});
