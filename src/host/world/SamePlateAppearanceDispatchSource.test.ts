import { expect, test } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaDispatchRoutes } from './SamePlateAppearanceDispatchRoles';

const modules = import.meta.glob('./SamePlateAppearanceDispatchSource.ts');
const implementation = async () => {
  const load = modules['./SamePlateAppearanceDispatchSource.ts'];
  expect(load, 'dispatch Source implementation missing').toBeTypeOf('function');
  return await load() as {
    samePaDispatchSourceInput(raw: unknown, sourceId?: string): any;
    assertSamePaDispatchSourceBasis(source: unknown, basis: unknown): void;
  };
};
const ref = (owner: string, sourceId = owner) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash('result:' + sourceId) });
const base = () => ({ sourceId: 'declared-source', sourceVersion: 'fixture-shape-v1', enrollmentReference: ref('same_pa_enrollments'),
  viewReference: ref('reserved_pa_execution_views'), firstPhysicalPitchSourceId: 'reserved-pitch' });
const member = (playerId = 'away-2') => ({ playerId, bindingHash: hash('binding:' + playerId), personHash: hash('person:' + playerId),
  baselineSourceId: 'baseline:' + playerId, reservedRevision: 0, reservedStateHash: hash('reserved:' + playerId), projectedStateHash: hash('projected:' + playerId) });
/** Explicit nominal shape inputs retain the existing ContinuousPitchFixtures
 * TAKE values (lines 55-58); these references are synthetic, with no execution. */
const action = () => ({ ...base(), capability: 'same_pa_first_pitch_action_v1', variant: 'declared_take_v1', pitcherPlayerId: 'home-1', batterPlayerId: 'away-2',
  nominalPitch: { delivery: { ...deliveryContext, timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' },
    physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
  flight: { durationUs: 1_500_000, acceleration: { x: 0, y: 0, z: 0 } },
  batter: { action: { kind: 'take' }, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 } },
  timingReference: ref('world_pitch_timing_baselines'), releaseReference: ref('world_player_release_baselines'),
  pitchResponseReference: ref('world_pitch_fatigue_policies'), batterModelReference: ref('world_player_batting_models'),
  geometryReference: { kind: 'action_source_take_geometry_v1' } });
const provenance = { assessmentSourceId: 'fixture-assessment', assessmentVersion: 'fixture-shape-v1',
  calibrationSourceId: 'fixture-calibration', calibrationVersion: 'fixture-shape-v1' };
// ContinuousPitchFixtures declares these fields at lines 53-54; its accepted
// initial World starts at tick zero (setup.startedAtTick at line 18).
const deliveryContext = { matchSeed: 19, moundReference: { x: 0, y: 0, z: 18 }, outingId: 'outing-1', readyAtUs: 0 };
const actionWithDeliveryContext = () => {
  const source = action();
  return { ...source, nominalPitch: { ...source.nominalPitch, delivery: { ...source.nominalPitch.delivery, ...deliveryContext } } };
};

test('DC01 declared TAKE Sources retain exact nominal inputs and separate immutable endpoint references', async () => {
  const api = await implementation(), source = action();
  expect(api.samePaDispatchSourceInput(source, source.sourceId)).toEqual(source);
  expect(api.samePaDispatchSourceInput({ ...source, timingReference: ref('world_pitch_timing_updates'),
    releaseReference: ref('world_player_release_changes') })).toMatchObject({ timingReference: { owner: 'world_pitch_timing_updates' } });
  const parsed = api.samePaDispatchSourceInput(source); expect(parsed).not.toBe(source); expect(Object.isFrozen(parsed.nominalPitch.delivery.physics)).toBe(true);
});

test('DC02 action Sources reject authority shortcuts unsupported swing and malformed nested domains', async () => {
  const api = await implementation();
  for (const alter of [
    (s: any) => s.cachedActor = {}, (s: any) => s.nominalPitch.workloadRevision = 1,
    (s: any) => s.nominalPitch.delivery.gameDay = 11, (s: any) => s.nominalPitch.delivery.physics.velocity.expectedResult = 'strike',
    (s: any) => s.nominalPitch.delivery.timingIntent.deliveryMode = 'FAST',
    (s: any) => s.nominalPitch.flight.durationUs = 0, (s: any) => s.nominalPitch.flight.durationUs = 0.5,
    (s: any) => s.nominalPitch.batter.strikeZone.upperY = s.nominalPitch.batter.strikeZone.lowerY,
    (s: any) => s.nominalPitch.batter.ballRadiusMeters = -1, (s: any) => s.variant = 'ordinary_swing',
    (s: any) => s.nominalPitch.batter.action.kind = 'swing', (s: any) => delete s.geometryReference,
    (s: any) => s.geometryReference = ref('world_batting_stances'),
    (s: any) => s.timingReference.owner = 'world_pitch_timing_heads',
    (s: any) => s.releaseReference.snapshotHash = 'wrong', (s: any) => s.batterPlayerId = s.pitcherPlayerId,
  ]) { const source = action(); alter(source); expect(() => api.samePaDispatchSourceInput(source)).toThrow(); }
});

test('DC03 prerequisite owners and derived completion Sources have closed acyclic reference shapes', async () => {
  const api = await implementation();
  const actionReference = ref('pa_dispatch_v1_action_plans'), consumerSetReference = ref('pa_dispatch_v1_consumer_sets');
  const episodeReference = ref('pa_dispatch_v1_episodes'), rightReference = ref('pa_dispatch_v1_rights');
  const physicalSourceReference = { sourceId: 'reserved-pitch', sourceVersion: 'fixture-shape-v1', sourceHash: hash('physical-source') };
  const sources = [
    { ...base(), capability: 'same_pa_consumer_set_v1', actionReference, participantInputs: Array.from({ length: 10 }, (_, i) => ({ member: member('player-' + i), calibrationReferences: [] })) },
    { ...base(), capability: 'same_pa_first_pitch_episode_v1', actionReference, consumerSetReference },
    { ...base(), capability: 'same_pa_first_pitch_right_v1', prefixReference: ref('reserved_pa_work_prefixes'), actionReference, consumerSetReference, episodeReference },
    { sourceId: 'reserved-pitch', sourceVersion: 'fixture-shape-v1', capability: 'same_pa_physical_pitch_v1', rightReference, actionReference },
    ...['same_pa_consumption_v1', 'same_pa_episode_admission_v1'].map(capability => ({ sourceId: capability, sourceVersion: 'fixture-shape-v1', capability,
      rightReference, episodeReference, physicalSourceReference })),
  ];
  for (const source of sources) {
    expect(api.samePaDispatchSourceInput(source)).toEqual(source);
    expect(() => api.samePaDispatchSourceInput({ ...source, consumed: true })).toThrow();
    expect(() => api.samePaDispatchSourceInput({ ...source, expectedProgressRevision: 0 })).toThrow();
  }
  const consumption = sources.at(-1)!;
  expect(() => api.samePaDispatchSourceInput({ ...consumption, physicalSourceReference: ref('pa_dispatch_v1_pitch_actions') })).toThrow();
  expect(() => api.samePaDispatchSourceInput({ ...sources[1], actionReference: rightReference })).toThrow();
});

test('DC04 calibration route owner parameter and response discriminants reject malformed declarations', async () => {
  const api = await implementation();
  for (const route of samePaDispatchRoutes) {
    const source = { ...base(), capability: 'same_pa_execution_calibration_v1', member: member(), route,
      nominalReference: ref('future_unowned_model'), nominalParameterReference: null, acceptedAtDay: 11, provenance,
      response: { kind: 'accepted_execution_values_v1', values: {} } };
    expect(() => api.samePaDispatchSourceInput(source)).toThrow();
  }
  const pitch = { ...base(), capability: 'same_pa_execution_calibration_v1', member: member('home-1'), route: 'pitch_delivery',
    nominalReference: ref('world_pitch_timing_baselines'), nominalParameterReference: null, acceptedAtDay: 11, provenance,
    response: { kind: 'accepted_pitch_response_v1', policyReference: ref('world_pitch_fatigue_policies') } };
  expect(api.samePaDispatchSourceInput(pitch)).toEqual(pitch);
  for (const alter of [(s: any) => s.route = 'all', (s: any) => s.acceptedAtDay = -1, (s: any) => s.nominalParameterReference = {},
    (s: any) => s.response.values = {}, (s: any) => s.provenance.assessmentVersion = '', (s: any) => s.member.projectedRevision = 1,
    (s: any) => s.nominalReference.owner = 'world_pitch_fatigue_policies']) {
    const changed = structuredClone(pitch); alter(changed); expect(() => api.samePaDispatchSourceInput(changed)).toThrow();
  }
});

test('DC05 references compare every hash and reserved identity without global revision substitution', async () => {
  const api = await implementation(), source = api.samePaDispatchSourceInput(action()), basis = base();
  api.assertSamePaDispatchSourceBasis(source, basis);
  for (const alter of [(b: any) => b.viewReference.snapshotHash = hash('foreign'), (b: any) => b.enrollmentReference.sourceHash = hash('foreign'),
    (b: any) => b.firstPhysicalPitchSourceId = 'another-pitch']) {
    const changed = structuredClone(basis); alter(changed); expect(() => api.assertSamePaDispatchSourceBasis(source, changed)).toThrow();
  }
});

test('DC06 Source validation rejects accessors callbacks nonfinite values and Source aliases before effects', async () => {
  const api = await implementation(); let calls = 0;
  const accessor = action(); Object.defineProperty(accessor, 'sourceVersion', { enumerable: true, get() { calls++; return 'bad'; } });
  expect(() => api.samePaDispatchSourceInput(accessor)).toThrow(); expect(calls).toBe(0);
  expect(() => api.samePaDispatchSourceInput({ ...action(), proof: () => { calls++; } })).toThrow(); expect(calls).toBe(0);
  const nonfinite = action(); nonfinite.nominalPitch.delivery.physics.velocity.z = NaN;
  expect(() => api.samePaDispatchSourceInput(nonfinite)).toThrow();
  expect(() => api.samePaDispatchSourceInput(action(), 'source-alias')).toThrow();
  expect(() => api.samePaDispatchSourceInput({ ...action(), capability: 'same_pa_consumer_action_v1' })).toThrow();
});

test('DC10 one calibration Source cannot be repeated across distinct original participants', async () => {
  const api = await implementation();
  const source = { ...base(), capability: 'same_pa_consumer_set_v1', actionReference: ref('pa_dispatch_v1_action_plans'),
    participantInputs: Array.from({ length: 10 }, (_, i) => ({ member: member('player-' + i), calibrationReferences: [] as unknown[] })) };
  source.participantInputs[1].calibrationReferences = [{ route: 'defender_observation', calibrationReference: ref('pa_dispatch_v1_execution_calibrations', 'shared') }];
  source.participantInputs[2].calibrationReferences = structuredClone(source.participantInputs[1].calibrationReferences);
  expect(() => api.samePaDispatchSourceInput(source), 'cross-participant calibration alias must reject').toThrow();
});

test('DC11 original delivery seed mound outing and ready time cannot be omitted or defaulted', async () => {
  const api = await implementation();
  for (const missing of [Object.keys(deliveryContext), ...Object.keys(deliveryContext).map(key => [key])]) {
    const source = actionWithDeliveryContext();
    for (const key of missing) delete (source.nominalPitch.delivery as any)[key];
    expect(() => api.samePaDispatchSourceInput(source), 'explicit original delivery context is required').toThrow();
  }
});

test('DC12 explicit delivery context retains v1 domains without inventing actor or timeline facts', async () => {
  const api = await implementation(), source = actionWithDeliveryContext();
  expect(api.samePaDispatchSourceInput(source), 'explicit original delivery context must be retained').toEqual(source);
  for (const alter of [
    (s: any) => s.nominalPitch.delivery.matchSeed = -1,
    (s: any) => s.nominalPitch.delivery.matchSeed = 0x1_0000_0000,
    (s: any) => s.nominalPitch.delivery.matchSeed = 0.5,
    (s: any) => s.nominalPitch.delivery.moundReference.z = Infinity,
    (s: any) => s.nominalPitch.delivery.moundReference.derivedFrom = 'former-batter',
    (s: any) => s.nominalPitch.delivery.outingId = '',
    (s: any) => s.nominalPitch.delivery.outingId = ' outing-1',
    (s: any) => s.nominalPitch.delivery.readyAtUs = -1,
    (s: any) => s.nominalPitch.delivery.readyAtUs = 0.5,
    (s: any) => s.nominalPitch.delivery.readyAtUs = Number.MAX_SAFE_INTEGER + 1,
  ]) {
    const changed = structuredClone(source); alter(changed);
    expect(() => api.samePaDispatchSourceInput(changed)).toThrow();
  }
});
