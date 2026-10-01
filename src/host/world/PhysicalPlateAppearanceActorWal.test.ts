import { expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { physicalPlateAppearanceActorFixture as fixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { openSqlitePhysicalPlateAppearanceActorStore } from './SqlitePhysicalPlateAppearanceActorStore';
import { openSqlitePhysicalPitchProgressStore } from './SqlitePhysicalPitchProgressStore';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';

it('revalidates the original batter after an identical retry Source changes its actual actor archive', () => {
  const { f, source, actors, sources } = fixture(join(mkdtempSync(join(tmpdir(), 'physical-batter-retry-')), 'state.sqlite'));
  try {
    actors.accept(source.sourceId);
    const retry = f.track(openSqlitePhysicalPlateAppearanceActorStore(f.path, sources, { readAcceptedActor: () => {
      f.db.prepare("UPDATE physical_plate_appearance_actors SET source_hash='changed'").run(); return source;
    } }));
    expect(() => retry.accept(source.sourceId)).toThrow();
  } finally { f.close(); }
});

it.each([
  "UPDATE world_player_person_links SET person_id='changed' WHERE source_id='intake-away-1'",
  "UPDATE official_participant_bindings SET binding_json='{}' WHERE game_id='game-1' AND player_id='away-1'",
  "UPDATE matches SET activation_json='{}' WHERE match_id='game-1'",
  "UPDATE physical_plate_appearance_actors SET source_hash='changed'",
  "UPDATE physical_plate_appearance_actor_games SET first_source_id='missing'",
  'DELETE FROM world_season_heads',
])('rejects late actor acceptance changes on its own real WAL connection: %s', (mutation) => {
  const { f, source, actors } = fixture(join(mkdtempSync(join(tmpdir(), 'physical-batter-')), 'state.sqlite'));
  try {
    expect(f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    f.db.exec(`CREATE TRIGGER alter_actor AFTER INSERT ON physical_plate_appearance_actors BEGIN ${mutation}; END`);
    expect(() => actors.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_plate_appearance_actors').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_plate_appearance_actor_games').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER alter_actor'); expect(actors.accept(source.sourceId).binding.playerId).toBe('away-1');
  } finally { f.close(); }
});

it('rejects a peer getter that changes original Person during acceptance and retains offline original identity', () => {
  const { f, source, sources, actors, accepted } = fixture(join(mkdtempSync(join(tmpdir(), 'physical-batter-')), 'state.sqlite'));
  try {
    const staleBinding = f.participation.readPregameBinding('game-1', 'away-1')!;
    const changed = f.track(openSqlitePhysicalPlateAppearanceActorStore(f.path, { ...sources, participation: { readPregameBinding: () => {
      f.db.prepare("UPDATE world_player_person_links SET person_id='changed' WHERE source_id='intake-away-1'").run(); return staleBinding;
    } } }, { readAcceptedActor: (id) => accepted.get(id) ?? null }));
    expect(() => changed.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_plate_appearance_actors').get()).toEqual({ n: 0 });
    f.db.prepare("UPDATE world_player_person_links SET person_id='person-away-1' WHERE source_id='intake-away-1'").run();
    const actor = actors.accept(source.sourceId); accepted.clear();
    actors.close(); const reopened = f.track(openSqlitePhysicalPlateAppearanceActorStore(f.path, sources));
    expect(reopened.accept(source.sourceId)).toEqual(actor);
  } finally { f.close(); }
});

it('rolls back a physical pitch if its own transaction changes the original accepted batter', () => {
  const { f, source, actors, pitch } = fixture(join(mkdtempSync(join(tmpdir(), 'physical-batter-')), 'state.sqlite'));
  try {
    actors.accept(source.sourceId);
    f.db.exec("CREATE TRIGGER alter_actor_in_pitch AFTER INSERT ON physical_pitch_progress_actions BEGIN UPDATE physical_plate_appearance_actors SET source_hash='changed'; END");
    expect(() => pitch(0, 0)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions').get()).toEqual({ n: 0 });
    expect(actors.read(source.sourceId)!.binding.playerId).toBe('away-1');
    f.db.exec('DROP TRIGGER alter_actor_in_pitch'); expect(pitch(0, 0).frame.batterActor!.source.sourceId).toBe(source.sourceId);
  } finally { f.close(); }
});

it('rejects anonymous execution when actual batter ownership starts during the first physical frame read', () => {
  const { f, source, actors, sources, actions } = fixture();
  try {
    const timing = { selectProfileAtDay: (careerId: string, playerId: string, gameDay: number) => {
      actors.accept(source.sourceId); return f.timing.selectProfileAtDay(careerId, playerId, gameDay);
    } };
    const pitches = f.track(openSqlitePhysicalPitchProgressStore(f.path, { ...sources, runtime: { ...f.stores, timing } },
      { readAcceptedAction: (id) => actions.get(id) ?? null }));
    actions.set('pitch-0', continuousPitchAction(f, 0, 0));
    expect(() => pitches.accept('pitch-0', 0)).toThrow('batter');
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions').get()).toEqual({ n: 0 });
    expect(pitches.accept('pitch-0', 0).frame.batterActor!.binding.playerId).toBe('away-1');
  } finally { f.close(); }
});
