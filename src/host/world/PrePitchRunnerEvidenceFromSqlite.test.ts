import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
import { expect, it } from 'vitest';
import { input, canonical } from './PrePitchRunnerFixtures.test-support';
import { derivePrePitchRunnerExecution } from './PrePitchRunnerEvidenceFromSqlite';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const fixture = () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE official_participant_bindings(game_id TEXT, player_id TEXT, binding_json TEXT);
    CREATE TABLE world_player_person_links(source_id TEXT,career_id TEXT,player_id TEXT,person_id TEXT,roster_revision INTEGER,accepted_at_day INTEGER,source_json TEXT);`);
  const binding = { gameId: 'game', careerId: 'career', competitionEditionId: 'season', gameDay: 2, clubId: 'away-club', side: 'AWAY' as const,
    playerId: 'runner', personId: 'runner-person', personLinkSourceId: 'runner-link', rosterRevision: 1, fixtureEventId: 'fixture' };
  const person = { sourceId: 'runner-link', careerId: 'career', playerId: 'runner', personId: 'runner-person', sourceRecordId: 'intake',
    sourceVersion: 'v1', acceptedRevision: 1, acceptedAtDay: 1, rosterRevision: 1 };
  db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run('game', 'runner', JSON.stringify(binding));
  db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(person.sourceId, person.careerId, person.playerId,
    person.personId, person.rosterRevision, person.acceptedAtDay, actorJson(person));
  // This tiny fixture tests runner membership, not the independently owned legal Match/actor producer.
  const actor = { source: { sourceId: 'batter-actor', sourceVersion: 'v1', gameId: 'game', playerId: 'batter', activationApplicationId: 'activation' },
    binding: { ...binding, playerId: 'batter', personId: 'batter-person', personLinkSourceId: 'batter-link' },
    match: { half: 'top', bases: { first: 'runner', second: null, third: null } },
    world: { tick: canonical.tick, runners: [{ playerId: 'runner', position: canonical.position, velocity: canonical.velocity }],
      defenders: Array.from({ length: 9 }, (_, i) => ({ playerId: `defender-${i}` })) },
    defenderBindings: Array.from({ length: 9 }, (_, i) => ({ ...binding, playerId: `defender-${i}`, personId: `defender-person-${i}`, side: 'HOME', clubId: 'home-club' })),
    worldFixture: { careerId: 'career', competitionEditionId: 'season', game: { gameId: 'game', homeClubId: 'home-club', awayClubId: 'away-club' } },
  } as unknown as DurablePhysicalPlateAppearanceActor;
  return { db, binding, person, actor };
};
it('derives root position and velocity only from the original frame and authenticates the exact roster/Person/Club/fixture', () => {
  const { db, actor, binding, person } = fixture();
  try {
    const saved = derivePrePitchRunnerExecution(db, input(), actor);
    expect(saved.canonical).toEqual(canonical); expect(saved.binding).toEqual(binding); expect(saved.person).toEqual(person);
    expect(saved.source).toEqual(input()); expect(saved.controller.basis.position).toEqual(actor.world.runners[0].position);
    expect(Object.isFrozen(saved)).toBe(true);
  } finally { db.close(); }
});
it.each(['missing_world', 'wrong_base', 'multiple_runner', 'wrong_actor', 'wrong_club', 'wrong_fixture', 'wrong_person', 'future_person', 'duplicate_person'])
('rejects %s rather than assigning a placeholder runner or a different identity', (kind) => {
  const { db, actor: original, binding, person } = fixture(), actor = structuredClone(original) as any, source = input();
  try {
    if (kind === 'missing_world') actor.world.runners = [];
    if (kind === 'wrong_base') actor.match.bases.first = 'other';
    if (kind === 'multiple_runner') actor.match.bases.second = 'other';
    if (kind === 'wrong_actor') actor.source.sourceId = 'different-batter';
    if (kind === 'wrong_club' || kind === 'wrong_fixture') db.prepare('UPDATE official_participant_bindings SET binding_json=?')
      .run(JSON.stringify({ ...binding, ...(kind === 'wrong_club' ? { clubId: 'home-club' } : { fixtureEventId: 'different-fixture' }) }));
    if (kind === 'wrong_person') db.prepare("UPDATE world_player_person_links SET person_id='other'").run();
    if (kind === 'future_person') db.prepare('UPDATE world_player_person_links SET accepted_at_day=?,source_json=?').run(3, actorJson({ ...person, acceptedAtDay: 3 }));
    if (kind === 'duplicate_person') actor.defenderBindings[0].personId = binding.personId;
    expect(() => derivePrePitchRunnerExecution(db, source, actor)).toThrow();
  } finally { db.close(); }
});
