import { expect, it } from 'vitest';
import { worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';

const source = { sourceId: 'initial-world', sourceVersion: 'fixture-v1', gameId: 'game-1', fixtureEventId: 'fixture-1',
  startedAtTick: 0, worldSetup: worldSetup('p2') };
it('archives actual initialized Match and all nine accepted Players/Persons before play, preserving original setup after advance/reopen', () => {
  const f = officialPitchWorkloadFixture(true, true);
  try {
    expect(f.participation.readPregameBinding('game-1', 'p2')).toMatchObject({ playerId: 'p2', personId: 'person-p2' });
    const sources = { matches: f.official, participation: f.participation };
    const store = f.track(openSqliteOfficialInitialWorldStore(f.path, sources, { readAcceptedSetup: () => source }));
    const accepted = store.accept(source.sourceId);
    expect(accepted.match).toEqual(f.initial); expect(accepted.world.defenders).toHaveLength(9); expect(accepted.bindings).toHaveLength(9);
    expect(new Set(accepted.bindings.map((binding) => binding.personId)).size).toBe(9);
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
    f.play(); f.scoring.apply({ scoringApplicationId: 'scoring-1', officialApplication: f.firstInput });
    const proof = store.readInitialPitcherPlay(source.sourceId, 'application-1');
    expect(proof).toMatchObject({ binding: { careerId: 'career-a', playerId: 'p2', gameDay: 10 }, playedPlayId: 7, durableRevision: 1,
      activatedMatchState: f.initial, startedAtTick: 0 });
    expect(() => store.readInitialPitcherPlay(source.sourceId, 'application-2')).toThrow();
    const advanced = f.official.getMatch('game-1');
    const offline = f.track(openSqliteOfficialInitialWorldStore(f.path, sources));
    expect(offline.accept(source.sourceId)).toEqual(accepted); expect(offline.readAcceptedSource(source.sourceId)).toEqual(accepted);
    expect(f.official.getMatch('game-1')).toEqual(advanced);
    expect(f.db.prepare('SELECT count(*) AS n FROM official_participation_receipts').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('rejects absent/mismatched actors, fixture, invalid lineup and advanced initial acceptance', () => {
  const f = officialPitchWorkloadFixture(true, true);
  try {
    let live = source;
    const store = f.track(openSqliteOfficialInitialWorldStore(f.path, { matches: f.official, participation: f.participation }, { readAcceptedSetup: () => live }));
    for (const invalid of [{ ...source, fixtureEventId: 'other-fixture' },
      { ...source, worldSetup: { ...source.worldSetup, activePreviousPlayControllerIds: '' } as unknown as typeof source.worldSetup },
      { ...source, worldSetup: { ...source.worldSetup, baseCenters: { ...source.worldSetup.baseCenters, extra: 1 } } },
      { ...source, worldSetup: { ...source.worldSetup, defenders: source.worldSetup.defenders.slice(1) } },
      { ...source, worldSetup: { ...source.worldSetup, defenders: source.worldSetup.defenders.map((defender, index) => index === 1 ? { ...defender, playerId: 'missing-player' } : defender) } },
      { ...source, worldSetup: { ...source.worldSetup, defenders: source.worldSetup.defenders.map((defender, index) => index === 1 ? { ...defender, registeredPosition: 'P' as const } : defender) } }]) {
      live = invalid; expect(() => store.accept(source.sourceId)).toThrow();
      expect(f.db.prepare('SELECT count(*) AS n FROM official_initial_world_sources').get()).toEqual({ n: 0 });
    }
    const binding = f.db.prepare("SELECT binding_json FROM official_participant_bindings WHERE player_id='home-1'").get() as { binding_json: string };
    f.db.prepare("UPDATE official_participant_bindings SET binding_json=? WHERE player_id='home-1'").run(JSON.stringify({ ...JSON.parse(binding.binding_json), side: 'AWAY' }));
    live = source; expect(() => store.accept(source.sourceId)).toThrow();
    f.db.prepare("UPDATE official_participant_bindings SET binding_json=? WHERE player_id='home-1'").run(binding.binding_json);
    f.play(); expect(() => store.accept(source.sourceId)).toThrow('advanced');
    expect(f.db.prepare('SELECT count(*) AS n FROM official_initial_world_sources').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('rolls back late Match/binding/Source changes and failed writes, then detects saved provenance corruption offline', () => {
  const f = officialPitchWorkloadFixture(true, true);
  try {
    const sources = { matches: f.official, participation: f.participation };
    const store = f.track(openSqliteOfficialInitialWorldStore(f.path, sources, { readAcceptedSetup: () => source }));
    const original = f.official.getMatch('game-1');
    const mutations = [
      "UPDATE matches SET state_json=json_set(state_json,'$.score.away',999) WHERE match_id=NEW.game_id",
      "UPDATE official_participant_bindings SET binding_json=json_set(binding_json,'$.rosterRevision',999) WHERE game_id=NEW.game_id AND player_id='home-1'",
      "UPDATE official_initial_world_sources SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id=NEW.source_id",
    ];
    for (const mutation of mutations) {
      f.db.exec(`CREATE TRIGGER alter_initial AFTER INSERT ON official_initial_world_sources BEGIN ${mutation}; END`);
      expect(() => store.accept(source.sourceId)).toThrow();
      expect(f.db.prepare('SELECT count(*) AS n FROM official_initial_world_sources').get()).toEqual({ n: 0 });
      expect(f.official.getMatch('game-1')).toEqual(original);
      f.db.exec('DROP TRIGGER alter_initial');
    }
    f.db.exec("CREATE TRIGGER fail_initial BEFORE INSERT ON official_initial_world_sources BEGIN SELECT RAISE(ABORT,'fixture initial failure'); END");
    expect(() => store.accept(source.sourceId)).toThrow('fixture initial failure');
    f.db.exec('DROP TRIGGER fail_initial');
    const accepted = store.accept(source.sourceId); expect(accepted.bindings).toHaveLength(9);
    f.db.exec("UPDATE official_initial_world_sources SET source_json=json_set(source_json,'$.sourceVersion','changed-after-commit')");
    const offline = f.track(openSqliteOfficialInitialWorldStore(f.path, sources));
    expect(() => offline.readAcceptedSource(source.sourceId)).toThrow('corrupt');
    expect(() => offline.accept(source.sourceId)).toThrow('corrupt');
  } finally { f.close(); }
});
