import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { continuousPitchFixture, continuousPitchAction, closeContinuousPitchPlay } from './ContinuousPitchFixtures.test-support';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { openSqliteOfficialPitchWorkloadStore } from './SqliteOfficialPitchWorkloadStore';

const fixture = () => continuousPitchFixture(join(mkdtempSync(join(tmpdir(), 'minibaseball-pitch-progress-')), 'world.db'));
it('rejects an activated frame if a non-pitcher Person disappears during binding reads', () => {
  const f = fixture();
  try {
    const actions = new Map<string, AcceptedPhysicalPitchActionSource>();
    const sources = { matches: f.official, initialWorlds: f.initialWorlds, participation: f.participation, runtime: f.stores };
    const progress = f.track(openSqlitePhysicalPitchProgressStore(f.path, sources, { readAcceptedAction: (id) => actions.get(id) ?? null }));
    let timeline = f.input.timeline;
    for (let index = 0; index < 3; index++) {
      actions.set(`pitch-${index}`, continuousPitchAction(f, index, timeline.lastEventTick));
      timeline = progress.accept(`pitch-${index}`, index).result.pitch.resolution.timeline;
    }
    closeContinuousPitchPlay(f, timeline);
    const { initialWorldSourceId: _initial, ...next } = continuousPitchAction(f, 0, timeline.lastEventTick + 3) as
      ReturnType<typeof continuousPitchAction> & { initialWorldSourceId: string };
    const source = { ...next, sourceId: 'next-action', activationApplicationId: 'continuous-close' };
    const store = f.track(openSqlitePhysicalPitchProgressStore(f.path, { ...sources, participation: {
      readPregameBinding: (gameId, playerId) => {
        const binding = f.participation.readPregameBinding(gameId, playerId);
        if (playerId === 'home-8') f.db.exec("DELETE FROM world_player_person_links WHERE source_id='intake-home-8'");
        return binding;
      },
    } }, { readAcceptedAction: () => source }));
    expect(() => store.accept(source.sourceId, 0)).toThrow('Person link');
    expect(f.db.prepare("SELECT count(*) AS n FROM physical_pitch_progress_actions WHERE source_id='next-action'").get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_heads WHERE play_id=?')
      .get(f.official.getMatch('game-1')!.matchState.playId)).toEqual({ n: 0 });
  } finally { f.close(); }
});
it.each([
  "UPDATE matches SET durable_revision=1 WHERE match_id='game-1'",
  "DELETE FROM world_player_person_links WHERE source_id='intake-home-1'",
  "UPDATE world_pitch_timing_baselines SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='timing'",
  "UPDATE world_player_release_baselines SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='release'",
  "UPDATE world_player_workload_heads SET state_json=json_set(state_json,'$.fatigue',0.9) WHERE player_id='p2'",
  "UPDATE world_pitch_fatigue_policies SET source_version='changed' WHERE source_id='response'",
  "UPDATE official_initial_world_sources SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='initial-world'",
  "UPDATE physical_pitch_progress_actions SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id=NEW.source_id",
])('rolls back a late real WAL change while appending a physical pitch: %s', (mutation) => {
  const f = fixture();
  try {
    const source = continuousPitchAction(f, 0, 0);
    const store = f.track(openSqlitePhysicalPitchProgressStore(f.path, { matches: f.official, initialWorlds: f.initialWorlds,
      participation: f.participation, runtime: f.stores }, { readAcceptedAction: () => source }));
    f.db.exec(`CREATE TRIGGER alter_progress AFTER INSERT ON physical_pitch_progress_actions BEGIN ${mutation}; END`);
    expect(() => store.accept(source.sourceId, 0)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_heads').get()).toEqual({ n: 0 });
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0); expect(f.workload.readHead('career-a', 'p2')!.fatigue).toBe(0);
    f.db.exec('DROP TRIGGER alter_progress');
    expect(store.accept(source.sourceId, 0).progressRevision).toBe(1);
  } finally { f.close(); }
});
it.each([
  "UPDATE physical_pitch_progress_actions SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='pitch-0'",
  "UPDATE physical_pitch_progress_heads SET revision=999 WHERE game_id='game-1'",
  "UPDATE world_player_release_baselines SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='release'",
  "UPDATE world_pitch_timing_baselines SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='timing'",
])('rolls back a completed workload Source if its original physical history changes inside the consumer WAL transaction: %s', (mutation) => {
  const f = fixture();
  try {
    const actions = new Map<string, AcceptedPhysicalPitchActionSource>();
    const progress = f.track(openSqlitePhysicalPitchProgressStore(f.path, { matches: f.official, initialWorlds: f.initialWorlds,
      participation: f.participation, runtime: f.stores }, { readAcceptedAction: (id) => actions.get(id) ?? null }));
    let timeline = f.input.timeline;
    for (let index = 0; index < 3; index++) {
      actions.set(`pitch-${index}`, continuousPitchAction(f, index, timeline.lastEventTick));
      timeline = progress.accept(`pitch-${index}`, index).result.pitch.resolution.timeline;
    }
    closeContinuousPitchPlay(f, timeline);
    const producer = f.track(openSqliteOfficialPitchWorkloadStore(f.path, { scoring: f.scoring, participation: f.participation,
      initialWorlds: f.initialWorlds, physicalPitches: progress }, { readAcceptedPolicy: () => f.effort }));
    const request = { scoringApplicationId: 'continuous-scoring', initialWorldSourceId: 'initial-world', policySourceId: f.effort.sourceId };
    f.db.exec(`CREATE TRIGGER alter_workload_progress AFTER INSERT ON official_pitch_workload_sources BEGIN ${mutation}; END`);
    expect(() => producer.accept(request)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_policies').get()).toEqual({ n: 0 });
    expect(progress.readProgress('game-1', f.initial.match.playId)!.progressRevision).toBe(3);
    f.db.exec('DROP TRIGGER alter_workload_progress'); expect(producer.accept(request).effortUnits).toBe(6);
  } finally { f.close(); }
});
it('rejects mixed Native frame reads rather than pinning old parameters to a newly changed Source', () => {
  const f = fixture();
  try {
    const source = continuousPitchAction(f, 0, 0);
    const runtime = { ...f.stores, release: { selectAtDay: (...args: Parameters<typeof f.release.selectAtDay>) => {
      const release = f.release.selectAtDay(...args);
      f.db.exec("UPDATE world_pitch_timing_baselines SET source_json=json_set(source_json,'$.profile.normalMotionToReleaseUs',800000) WHERE source_id='timing'");
      f.db.exec("UPDATE world_pitch_timing_baselines SET initial_json=json_set(initial_json,'$.profile.normalMotionToReleaseUs',800000) WHERE source_id='timing'");
      f.db.exec("UPDATE world_pitch_timing_heads SET state_json=json_set(state_json,'$.profile.normalMotionToReleaseUs',800000) WHERE player_id='p2'");
      return release;
    } } };
    const store = f.track(openSqlitePhysicalPitchProgressStore(f.path, { matches: f.official, initialWorlds: f.initialWorlds,
      participation: f.participation, runtime }, { readAcceptedAction: () => source }));
    expect(() => store.accept(source.sourceId, 0)).toThrow('frame reads');
    expect(store.readProgress('game-1', f.initial.match.playId)).toBeNull();
  } finally { f.close(); }
});
