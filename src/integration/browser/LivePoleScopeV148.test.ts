import { expect, it } from 'vitest';
import { createLiveBaseballMatchWorkerV116 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { AVERAGE_FIELD_PROFILE_V95, buildAverageFieldCaseV95 } from './LiveFieldAverageHarnessV95';
import { buildLiveFieldPlayInputV95 } from './LiveFieldInputV95';
import type { SourceFreePoleSessionInputV148 } from '../../core/sim/ball/SourceFreeBallWorldQuery';
import { reducePlayableMatchV1, type PlayableFieldFactsV1 } from './PlayableMatchRulesV1';
const equipment = (): SourceFreePoleSessionInputV148 => ({ version: 'source_free_pole_session_v148',
  poles: [{ surfaceId: 'synthetic-pole', center: { x: 70, z: 70 }, minimumHeight: 0, maximumHeight: 8, radiusM: .1 }],
  materials: [{ surfaceId: 'synthetic-pole', material: { restitution: .5, tangentialDamping: .25, spinDamping: .2 } }] });
const input = () => ({ ...liveMatchFixture(), park: { fenceRadiusMeters: 110, fenceHeightMeters: 3, poleEquipmentV148: equipment() } });

it('retains explicit equipment in match observations and serialized same-game worker continuation', () => {
  const original = input(), before = JSON.stringify(original), host = createLiveBaseballMatchWorkerV116(original),
    continuation = JSON.parse(JSON.stringify(host.captureContinuationV116())), resumed = createLiveBaseballMatchWorkerV116(original, continuation);
  expect(host.inspect().fenceGeometry.poleEquipmentV148).toEqual(original.park.poleEquipmentV148);
  expect(resumed.inspect()).toEqual(host.inspect()); expect(JSON.stringify(original)).toBe(before);
  expect(continuation.poleScopeBindingV148).toBeTruthy();
});

it.each(['geometry', 'material', 'park', 'remove', 'add'] as const)('refuses a continuation across a changed %s pole scope', changed => {
  const original = input(), continuation = createLiveBaseballMatchWorkerV116(original).captureContinuationV116(), next = input();
  if (changed === 'geometry') next.park.poleEquipmentV148 = { ...equipment(), poles: [{ ...equipment().poles[0], radiusM: .2 }] };
  if (changed === 'material') next.park.poleEquipmentV148 = { ...equipment(), materials: [{ ...equipment().materials[0], material: { ...equipment().materials[0].material, restitution: .6 } }] };
  if (changed === 'park') next.park.fenceRadiusMeters = 120;
  const legacy = liveMatchFixture();
  const previous = changed === 'add' ? createLiveBaseballMatchWorkerV116(legacy).captureContinuationV116() : continuation;
  expect(() => createLiveBaseballMatchWorkerV116(changed === 'remove' ? legacy : next, previous)).toThrow(/pole geometry/);
});

it('does not add a pole binding to historical match observations or continuations', () => {
  const original = liveMatchFixture(), host = createLiveBaseballMatchWorkerV116(original), continuation = host.captureContinuationV116();
  expect(Object.hasOwn(continuation, 'poleScopeBindingV148')).toBe(false);
  expect(Object.hasOwn(host.inspect().fenceGeometry, 'poleEquipmentV148')).toBe(false);
  expect(createLiveBaseballMatchWorkerV116(original, continuation).inspect()).toEqual(host.inspect());
});

it('rejects explicit null equipment at the raw match boundary', () => {
  const raw = JSON.parse(JSON.stringify(input())); raw.park.poleEquipmentV148 = null;
  expect(() => createLiveBaseballMatchWorkerV116(raw)).toThrow(/pole session scope/);
});

it('keeps explicit field equipment through the shared practice input builder', () => {
  const average = buildAverageFieldCaseV95({ caseId: 'SS_ground', seed: 2025, bats: 'R', parkRadiusMeters: 110 }).input,
    roles = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const, poleEquipmentV148 = equipment(),
    spec = { ball: average.ball, physics: average.physics, field: { ...average.field, poleEquipmentV148 }, outs: 0,
      defense: Object.fromEntries(roles.map(r => [r, 'def-' + r])) as Record<typeof roles[number], string>,
      placements: Object.fromEntries(average.fielders.map(f => [f.defensivePosition, f.position])) as Record<typeof roles[number], typeof average.ball.ball.position>,
      players: [...average.fielders.map(f => f.playerId), ...average.runners.map(r => r.runnerId)]
        .map(playerId => ({ playerId, physical: AVERAGE_FIELD_PROFILE_V95.physical })),
      batterRunnerId: 'runner-0', batterPosition: average.runners[0].position!,
      occupiedBases: { first: null, second: null, third: null }, baserunning: 'balanced' as const };
  const result = buildLiveFieldPlayInputV95(JSON.parse(JSON.stringify(spec)));
  expect(result.field.poleEquipmentV148).toEqual(poleEquipmentV148);
});

it('does not turn physical equipment with no adopted legal policy into a home run or an out', () => {
  const host = createLiveBaseballMatchWorkerV116(liveMatchFixture()), facts: PlayableFieldFactsV1 = {
    contactTick: 100, throughTick: 200, territory: 'fair', firstGroundContactTick: null, flyCatch: null,
    runnerTouches: [], controlledBaseContacts: [], controlledRunnerTags: [], runnerDepartures: [],
    overFence: { tick: 180, fair: true, untouchedGround: true }, playEnd: { kind: 'play_end', tick: 200, reason: 'dead_ball' },
    pendingEquipmentPolicyV148: { firstContactTick: 150, surfaceIds: ['synthetic-pole'] } };
  expect(reducePlayableMatchV1({ match: host.inspect().match, batterRunnerId: '0-b0', event: { kind: 'field_play', facts } }))
    .toEqual({ kind: 'unresolved', reason: 'pole_legal_policy_unadopted_v148', tick: 150 });
  // A serialized capture and nonempty synthetic pure-policy identifiers are
  // neither an authenticated full physical prefix nor a formal adoption Owner.
  const factsWithMetadata = { ...facts, poleContactWitnessesV213: [{ version: 'live_pole_contact_witness_v213', surfaceId: 'synthetic-pole' }],
    polePolicyV213: { version: 'adopted_fair_pole_policy_v145', sourceId: 'synthetic-pure-policy', sourceVersion: 'test-only',
      ruleProfileId: 'synthetic-rules', rulesRevision: '1', fairPoleSurfaceIds: ['synthetic-pole'] } };
  expect(reducePlayableMatchV1({ match: host.inspect().match, batterRunnerId: '0-b0', event: { kind: 'field_play', facts: factsWithMetadata } }))
    .toEqual({ kind: 'unresolved', reason: 'pole_legal_policy_unadopted_v148', tick: 150 });
});
