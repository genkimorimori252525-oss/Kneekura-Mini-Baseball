import { expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingPerceptionSourceInput } from './NativeBattingPerception';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
const pin = (owner: string, sourceId: string) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash([sourceId]) });
const member = { playerId: 'batter', bindingHash: hash('binding'), personHash: hash('person'), baselineSourceId: 'baseline',
  reservedRevision: 0, reservedStateHash: hash('state'), projectedStateHash: hash('projected') };
const posture = (runners: number, inFlight: boolean) => ({ sourceId: 'posture', sourceVersion: 'fixture-only-v1', member,
  capability: inFlight ? 'owned_in_flight_batting_posture_v1' : 'owned_batting_invocation_posture_v1',
  viewReference: pin(inFlight ? 'pa_lifecycle_v1_execution_views' : 'reserved_pa_execution_views', 'view'),
  actionReference: pin(inFlight ? 'pa_physical_v1_action_plans' : 'pa_dispatch_v1_action_plans', 'action'),
  modelReference: pin('world_player_batting_models', 'model'),
  geometry: { kind: 'stationary_pre_pitch_scene_v1', startedAtTick: 100, validUntilTick: 500, ticksPerSecond: 1_000_000,
    handedness: 'R', centerOfMass: { x: 0, y: 1, z: 0 }, eyePosition: { x: 0, y: 1.7, z: 0 }, observerForward: { x: 0, y: 0, z: 1 },
    attention: { target: { kind: 'ball' }, focusedSinceTick: 100 }, bodyReadyTick: 100, latestMotorStartTick: 101,
    plateZ: 0, strikeZone: { centerX: 0, halfWidth: .2, lowerY: .4, upperY: 1 } },
  sceneBodyReferences: Array.from({ length: 9 + runners }, (_, i) => ({ playerId: 'scene-' + i, bodyReference: pin('world_player_body_materializations', 'body-' + i) })),
  ...(runners ? { occupiedRunnerHoldReferences: Array.from({ length: runners }, (_, i) => pin('world_same_pa_occupied_runner_holds', 'hold-' + i)) } : {}),
  provenance: { assessmentSourceId: 'assessment', assessmentVersion: 'fixture-only', calibrationSourceId: 'calibration', calibrationVersion: 'fixture-only' } });

it.each([false, true])('OP01 preserves empty-scene Source bytes for inFlight=%s', inFlight => {
  const raw = posture(0, inFlight); expect(json(battingPerceptionSourceInput('posture', raw))).toBe(json(raw));
});
it.each([1, 2, 3])('OP02 admits %s explicit occupied holds in both pitch scene parsers', n => {
  for (const inFlight of [false, true]) {
    const raw = posture(n, inFlight); expect(json(battingPerceptionSourceInput('posture', raw))).toBe(json(raw));
  }
});
it('OP03 extra scene bodies require distinct original hold references', () => {
  for (const inFlight of [false, true]) {
    const { occupiedRunnerHoldReferences: _, ...missing } = posture(1, inFlight);
    expect(() => battingPerceptionSourceInput('posture', missing)).toThrow();
    const duplicate = posture(2, inFlight); duplicate.occupiedRunnerHoldReferences![1] = duplicate.occupiedRunnerHoldReferences![0];
    expect(() => battingPerceptionSourceInput('posture', duplicate)).toThrow();
  }
});

/** Pure registry fixture only. It grants no Native original ownership. */
const registry = (runnerCount: number) => {
  const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const people = Array.from({ length: 10 + runnerCount }, (_, i) => ({ playerId: 'p' + i, personId: 'person' + i, sourceId: 'person-link' + i }));
  const bindings = people.map((p, i) => ({ playerId: p.playerId, personId: p.personId, personLinkSourceId: p.sourceId,
    careerId: 'career', gameId: 'game', gameDay: 1, fixtureEventId: 'fixture', competitionEditionId: 'edition', side: i === 0 || i >= 10 ? 'AWAY' : 'HOME' }));
  const runners = people.slice(10).map((p, i) => ({ playerId: p.playerId, position: { x: 10 + i, z: 0 }, velocity: { x: 0, z: 0 } }));
  const actor: any = { source: { sourceId: 'actor', gameId: 'game', playerId: 'p0' }, binding: bindings[0], person: people[0],
    defenderBindings: bindings.slice(1, 10), defenderPersons: people.slice(1, 10),
    match: { playId: 7, bases: { first: people[10]?.playerId ?? null, second: people[11]?.playerId ?? null, third: people[12]?.playerId ?? null } },
    world: { runners, defenders: positions.map((registeredPosition, i) => ({ playerId: people[i + 1].playerId, registeredPosition })) } };
  const participants = bindings.map(b => ({ playerId: b.playerId, reservedState: { careerId: 'career', playerId: b.playerId, revision: 0 },
    projectedState: { careerId: 'career', playerId: b.playerId, revision: 1 }, projectedStateHash: hash({ careerId: 'career', playerId: b.playerId, revision: 1 }) }));
  const enrollmentReference = pin('same_pa_enrollments', 'enrollment');
  const view: any = { kind: 'basis_prepared', source: { enrollmentReference }, participants, lineage: { enrollmentReference,
    actorReference: { owner: 'physical_plate_appearance_actors', sourceId: 'actor', sourceHash: hash(actor.source), snapshotHash: hash(actor) },
    careerId: 'career', gameId: 'game', playId: 7,
    participantReferences: bindings.map((b, i) => ({ playerId: b.playerId, bindingHash: hash(b), personHash: hash(people[i]), baselineSourceId: 'baseline' + i,
      revision: 0, stateHash: hash(participants[i].reservedState) })) } };
  const originals: any = bindings.map((binding, i) => ({ binding, person: people[i], role: i === 0 ? 'batter' : i < 10 ? 'defender' : 'runner', startingBase: i < 10 ? null : i - 9 }));
  return { actor, view, originals };
};
it.each([1, 2, 3])('OP04 accounts for %s original runners without assigning defender calibration routes', n => {
  const f = registry(n), roles = deriveSamePaDispatchRoles(f.actor, f.view, f.originals);
  expect(roles).toHaveLength(10 + n); expect(roles.flatMap(r => r.routes)).toHaveLength(32);
  expect(roles.slice(10).map(r => r.role)).toEqual(Array(n).fill('runner'));
  expect(roles.slice(10).every(r => r.routes.length === 0)).toBe(true);
  expect(() => deriveSamePaDispatchRoles(f.actor, f.view)).toThrow();
  expect(() => deriveSamePaDispatchRoles(f.actor, f.view, f.originals.slice(0, -1))).toThrow();
});
