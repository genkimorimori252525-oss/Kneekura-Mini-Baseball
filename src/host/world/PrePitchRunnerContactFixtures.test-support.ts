import { createRequire } from 'node:module';
import { input, canonical } from './PrePitchRunnerFixtures.test-support';
import { buildPrePitchRunnerController } from './PrePitchRunnerExecution';
import type { AcceptedBattedWorldContact, AcceptedBattedWorldModel } from './SqliteBattedWorldContactStore';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const zero = { x: 0, y: 0, z: 0 };
export const prePitchRunnerContactFixture = (path = ':memory:') => {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE official_participant_bindings(game_id TEXT, player_id TEXT, binding_json TEXT);
    CREATE TABLE world_player_person_links(source_id TEXT,career_id TEXT,player_id TEXT,person_id TEXT,roster_revision INTEGER,accepted_at_day INTEGER,source_json TEXT);`);
  const bindings = ['batter', ...Array.from({ length: 9 }, (_, i) => `defender-${i}`), 'runner'].map(playerId => ({
    gameId: 'game', careerId: 'career', competitionEditionId: 'season', gameDay: 2, clubId: playerId.startsWith('defender') ? 'home-club' : 'away-club',
    side: playerId.startsWith('defender') ? 'HOME' as const : 'AWAY' as const,
    playerId, personId: `${playerId}-person`, personLinkSourceId: `${playerId}-link`, rosterRevision: 1, fixtureEventId: 'fixture' }));
  const persons = bindings.map(binding => {
    const p = { sourceId: binding.personLinkSourceId, careerId: 'career', playerId: binding.playerId, personId: binding.personId,
      sourceRecordId: `${binding.playerId}-intake`, sourceVersion: 'v1', acceptedRevision: 1, acceptedAtDay: 1, rosterRevision: 1 };
    db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run('game', binding.playerId, JSON.stringify(binding));
    db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(p.sourceId, p.careerId, p.playerId, p.personId, 1, 1, actorJson(p));
    return p;
  });
  const runnerSource = { ...input(), bodyPose: { ...input().bodyPose, primitiveMotions: input().bodyPose.primitiveMotions.map(p => ({ ...p,
    startOffset: { x: 0, y: p.role === 'body' ? 1 : 100, z: 0 }, offsetVelocity: zero, offsetAcceleration: zero })) } };
  const runner = { source: runnerSource, canonical, controller: buildPrePitchRunnerController(runnerSource, canonical), binding: bindings[10], person: persons[10] };
  const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0 }, point = { x: 16, y: 1.3, z: 5 }, at = 3_000_000;
  const contact = { tick: at, ballCenter: point, point, batPoint: point, normal: { x: 1, y: 0, z: 0 }, segmentT: 0.5, exitVelocity: zero, exitSpin: zero };
  const match = { half: 'top', playId: 1, bases: { first: 'runner', second: null, third: null } };
  const world = { tick: canonical.tick, runners: [{ playerId: 'runner', position: canonical.position, velocity: canonical.velocity }],
    defenders: bindings.slice(1, 10).map((b, i) => ({ playerId: b.playerId, position: { x: -200 - i, z: -200 }, velocity: { x: 0, z: 0 } })) };
  const actor = { source: { sourceId: 'batter-actor', sourceVersion: 'v1', gameId: 'game', playerId: 'batter', activationApplicationId: 'activation' },
    binding: bindings[0], defenderBindings: bindings.slice(1, 10), person: persons[0], defenderPersons: persons.slice(1, 10), match, world,
    worldFixture: { careerId: 'career', competitionEditionId: 'season', game: { gameId: 'game', homeClubId: 'home-club', awayClubId: 'away-club' } } };
  const flight = { source: { sourceId: 'flight', physicalPitchSourceId: 'pitch', searchDurationTicks: 500_000,
    execution: { venueId: 'venue', ballFlightParameters: parameters } }, flight: createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 500_000 }),
    physicalPitch: { source: { sourceId: 'pitch', sourceVersion: 'v1', gameId: 'game', prePitchRunner: runnerSource, request: { batter: { action: { kind: 'swing', swing: { startTick: at, endTick: at + 1, ticksPerSecond: 1_000_000,
      stateAtStart: { pose: { grip: { x: -100, y: 1, z: -100 }, tip: { x: -99, y: 1, z: -100 } }, linearVelocity: zero, angularVelocity: zero } } } } } },
      result: { pitch: { resolution: { timeline: { status: { kind: 'batted_ball_pending', contactTick: at }, lastEventTick: at, events: [{ kind: 'BatBallContact', tick: at, payload: { contact } }] } } } },
      frame: { gameId: 'game', batterActor: actor, prePitchRunner: runner, workload: { playerId: 'defender-0' }, release: { body: { heightMeters: 1.8 } },
        match, world } } };
  const model: AcceptedBattedWorldModel = { sourceId: 'model', sourceVersion: 'v1', gameId: 'game', careerId: 'career', fixtureEventId: 'fixture',
    venueId: 'venue', availableAtDay: 1, batterGripOffset: zero, surfaces: [], actors: bindings.map(b => ({ playerId: b.playerId, personId: b.personId,
      heightMeters: 1.8, bodyOriginHeightMeters: b.playerId === 'runner' ? 0.3 : 0,
      primitives: runnerSource.bodyPose.primitiveMotions.map(p => ({ role: p.role, radius: 0.1, offset: p.startOffset })) })) };
  const source = { sourceId: 'contact', sourceVersion: 'v1', kind: 'owned_runner_contact_v1', prePitchRunnerSourceId: runnerSource.sourceId,
    flightSourceId: 'flight', modelSourceId: 'model', previousContactSourceId: null,
    commands: bindings.slice(0, 10).map(b => ({ playerId: b.playerId, bodyAcceleration: zero,
      primitiveMotions: runnerSource.bodyPose.primitiveMotions.map(p => ({ role: p.role, offsetVelocity: zero, offsetAcceleration: zero })) })) } as AcceptedBattedWorldContact;
  return { db, source, model, flight };
};
