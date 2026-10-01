import { expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { continuousPitchFixture, continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { openSqlitePhysicalPlayClosureStore, type AcceptedPhysicalPlayClosure } from './SqlitePhysicalPlayClosureStore';

const fixture = (databasePath?: string) => {
  const f = continuousPitchFixture(databasePath), actions = new Map<string, AcceptedPhysicalPitchActionSource>();
  const physicalPitches = f.track(openSqlitePhysicalPitchProgressStore(f.path, { matches: f.official, initialWorlds: f.initialWorlds,
    participation: f.participation, runtime: f.stores }, { readAcceptedAction: (sourceId) => actions.get(sourceId) ?? null }));
  let timeline = f.input.timeline;
  for (let index = 0; index < 3; index++) {
    actions.set(`pitch-${index}`, continuousPitchAction(f, index, timeline.lastEventTick));
    timeline = physicalPitches.accept(`pitch-${index}`, index).result.pitch.resolution.timeline;
  }
  const source: AcceptedPhysicalPlayClosure = { sourceId: 'physical-close', sourceVersion: 'fixture-v1', physicalPitchSourceId: 'pitch-2',
    applicationId: 'physical-application', scoringApplicationId: 'physical-scoring', snapshotId: 'physical-rule',
    ruleTick: timeline.lastEventTick + 1, closureTick: timeline.lastEventTick + 2, nextStartedAtTick: timeline.lastEventTick + 3,
    batterRunnerId: null, worldSetup: f.firstInput.worldSetup,
    game: { seasonId: 'league-season-1', homeClubId: 'club-a', awayClubId: 'club-b',
      policy: { version: 'fixture-v1', minimumInnings: 9, maximumInnings: 9, tiesAllowed: true } } };
  const sources = { physicalPitches, initialWorlds: f.initialWorlds, participation: f.participation, personLinks: f.links };
  const accepted = new Map([[source.sourceId, source]]);
  const store = f.track(openSqlitePhysicalPlayClosureStore(f.path, sources, { readAcceptedClosure: (id) => accepted.get(id) ?? null }));
  return { f, store, source, sources, accepted, actions, physicalPitches };
};

it('durably queues actual physical closure and resumes official/scoring/effort/global workload once after offline reopen', () => {
  const { f, store, source, sources, accepted } = fixture();
  try {
    expect(store.enqueue(source.sourceId).status).toBe('PENDING');
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0);
    accepted.clear();
    const reopened = f.track(openSqlitePhysicalPlayClosureStore(f.path, sources));
    const result = reopened.resume(source.sourceId);
    expect(result.official.receipt.durableRevision).toBe(1);
    expect(result.scoring.record.classification).toBe('strikeout');
    expect(result.workload.activity.kind).toBe('MATCH'); expect(result.workload.after.fatigue).toBeCloseTo(0.6);
    expect(reopened.resume(source.sourceId)).toEqual(result);
    expect(store.read(source.sourceId)!.status).toBe('COMPLETED');
    expect(f.db.prepare('SELECT count(*) AS n FROM applications').get()).toEqual({ n: 1 });
    expect(f.db.prepare('SELECT count(*) AS n FROM official_scoring_applications').get()).toEqual({ n: 1 });
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()).toEqual({ n: 1 });
  } finally { f.close(); }
});

it('resumes after an official application succeeded but scoring failed without reapplying the play', () => {
  const { f, store, source, sources, accepted } = fixture();
  try {
    store.enqueue(source.sourceId);
    f.db.exec("CREATE TRIGGER stop_scoring BEFORE INSERT ON official_scoring_applications BEGIN SELECT RAISE(ABORT,'scoring interruption'); END");
    expect(() => store.resume(source.sourceId)).toThrow('scoring interruption');
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(1);
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0);
    expect(store.read(source.sourceId)!.status).toBe('PENDING');
    f.db.exec('DROP TRIGGER stop_scoring'); accepted.clear();
    const reopened = f.track(openSqlitePhysicalPlayClosureStore(f.path, sources));
    expect(reopened.resume(source.sourceId).workload.after.revision).toBe(1);
    expect(f.db.prepare('SELECT count(*) AS n FROM applications').get()).toEqual({ n: 1 });
  } finally { f.close(); }
});

it('rolls back official Match adoption if its transaction alters the original actual physical evidence', () => {
  const { f, store, source } = fixture();
  try {
    store.enqueue(source.sourceId);
    f.db.exec("CREATE TRIGGER alter_physical_origin AFTER INSERT ON applications BEGIN UPDATE physical_pitch_progress_actions SET source_hash='changed' WHERE source_id='pitch-0'; END");
    expect(() => store.resume(source.sourceId)).toThrow();
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
    expect(f.db.prepare('SELECT count(*) AS n FROM applications').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER alter_physical_origin'); expect(store.resume(source.sourceId).workload.after.revision).toBe(1);
  } finally { f.close(); }
});

it('rolls back global workload when a late write removes the actual accepted effort Source', () => {
  const { f, store, source } = fixture();
  try {
    store.enqueue(source.sourceId);
    f.db.exec('CREATE TRIGGER remove_effort AFTER INSERT ON world_player_workload_activities BEGIN DELETE FROM official_pitch_workload_sources; END');
    expect(() => store.resume(source.sourceId)).toThrow();
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0);
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 1 });
    f.db.exec('DROP TRIGGER remove_effort'); expect(store.resume(source.sourceId).workload.after.revision).toBe(1);
  } finally { f.close(); }
});

it('cannot start another physical pitch while the prior queued official closure has uncharged workload', () => {
  const { f, store, source, actions, physicalPitches } = fixture();
  try {
    store.enqueue(source.sourceId);
    f.db.exec("CREATE TRIGGER stop_scoring BEFORE INSERT ON official_scoring_applications BEGIN SELECT RAISE(ABORT,'scoring interruption'); END");
    expect(() => store.resume(source.sourceId)).toThrow('scoring interruption');
    const { initialWorldSourceId: _initial, ...next } = continuousPitchAction(f, 0, source.nextStartedAtTick) as
      AcceptedPhysicalPitchActionSource & { initialWorldSourceId: string };
    const following = { ...next, sourceId: 'following-pitch', activationApplicationId: source.applicationId };
    actions.set(following.sourceId, following);
    expect(() => physicalPitches.accept(following.sourceId, 0)).toThrow('closure');
    f.db.exec('DROP TRIGGER stop_scoring'); store.resume(source.sourceId);
    actions.set(following.sourceId, { ...following, request: { ...following.request, workloadRevision: 1 } });
    expect(physicalPitches.accept(following.sourceId, 0).result.effectiveFatigue).toBeCloseTo(0.6);
  } finally { f.close(); }
});

it.each([
  { table: 'applications', operation: 'INSERT', official: 0, scored: 0, effort: 0, workload: 0 },
  { table: 'official_scoring_applications', operation: 'INSERT', official: 1, scored: 0, effort: 0, workload: 0 },
  { table: 'official_pitch_workload_sources', operation: 'INSERT', official: 1, scored: 1, effort: 0, workload: 0 },
  { table: 'world_player_workload_activities', operation: 'INSERT', official: 1, scored: 1, effort: 1, workload: 0 },
  { table: 'physical_play_closures', operation: 'UPDATE', official: 1, scored: 1, effort: 1, workload: 1 },
])('reopens real WAL and resumes interruption at $table without repeating accepted effects', (stage) => {
  const path = join(mkdtempSync(join(tmpdir(), 'physical-closure-')), 'state.sqlite');
  const { f, store, source, sources, accepted } = fixture(path);
  try {
    expect(f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    store.enqueue(source.sourceId);
    f.db.exec(`CREATE TRIGGER interrupted BEFORE ${stage.operation} ON ${stage.table} BEGIN SELECT RAISE(ABORT,'stage interruption'); END`);
    expect(() => store.resume(source.sourceId)).toThrow('stage interruption');
    for (const [table, count] of [['applications', stage.official], ['official_scoring_applications', stage.scored],
      ['official_pitch_workload_sources', stage.effort], ['world_player_workload_activities', stage.workload]] as const) {
      expect(f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({ n: count });
    }
    expect(store.read(source.sourceId)!.status).toBe('PENDING');
    store.close(); accepted.clear(); f.db.exec('DROP TRIGGER interrupted');
    const reopened = f.track(openSqlitePhysicalPlayClosureStore(path, sources));
    const result = reopened.resume(source.sourceId);
    expect(result.workload.after.revision).toBe(1);
    expect(reopened.submit(source.sourceId)).toEqual(result);
    for (const table of ['applications', 'official_scoring_applications', 'official_pitch_workload_sources', 'world_player_workload_activities']) {
      expect(f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({ n: 1 });
    }
  } finally { f.close(); }
});

it('rolls back completion checkpoint changes to its own scoring evidence and resumes already charged workload', () => {
  const { f, store, source } = fixture(join(mkdtempSync(join(tmpdir(), 'physical-closure-')), 'state.sqlite'));
  try {
    store.enqueue(source.sourceId);
    f.db.exec("CREATE TRIGGER alter_completed_origin AFTER UPDATE ON physical_play_closures BEGIN UPDATE official_scoring_applications SET source_event_id='changed'; END");
    expect(() => store.resume(source.sourceId)).toThrow();
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(1);
    expect(store.read(source.sourceId)!.status).toBe('PENDING');
    f.db.exec('DROP TRIGGER alter_completed_origin');
    expect(store.resume(source.sourceId).workload.after.revision).toBe(1);
  } finally { f.close(); }
});

it('rejects changed closure Source and changed original actor or frozen policy before any official effect', () => {
  const { f, store, source, accepted } = fixture();
  try {
    store.enqueue(source.sourceId);
    accepted.set(source.sourceId, { ...source, sourceVersion: 'changed' });
    expect(() => store.resume(source.sourceId)).toThrow('frozen');
    accepted.set(source.sourceId, source);
    f.db.prepare("UPDATE world_player_person_links SET person_id='changed' WHERE source_id='intake-p2'").run();
    expect(() => store.resume(source.sourceId)).toThrow();
    f.db.prepare("UPDATE world_player_person_links SET person_id='person-p2' WHERE source_id='intake-p2'").run();
    const policy = f.db.prepare('SELECT policy_json FROM physical_closure_game_policies').get() as { policy_json: string };
    f.db.prepare("UPDATE physical_closure_game_policies SET policy_json='{}'").run();
    expect(() => store.resume(source.sourceId)).toThrow('policy');
    f.db.prepare('UPDATE physical_closure_game_policies SET policy_json=?').run(policy.policy_json);
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
    expect(store.resume(source.sourceId).workload.after.revision).toBe(1);
  } finally { f.close(); }
});

it('keeps completed historical closure readable after actual later rest and rejects completion proof tampering', () => {
  const { f, store, source } = fixture();
  try {
    const result = store.submit(source.sourceId);
    f.activities.set('rest', { sourceEventId: 'rest', sourceVersion: 'fixture-v1', evidenceId: 'rest', careerId: 'career-a', playerId: 'p2',
      kind: 'RECOVERY', atDay: 11, durationHours: 2, quality: 1, medicalAvailability: 1 });
    f.workload.apply('rest', 1);
    expect(store.resume(source.sourceId)).toEqual(result);
    const checkpoint = f.db.prepare('SELECT result_json FROM physical_play_closures WHERE source_id=?').get(source.sourceId) as { result_json: string };
    f.db.prepare("UPDATE physical_play_closures SET result_json='{}' WHERE source_id=?").run(source.sourceId);
    expect(() => store.read(source.sourceId)).toThrow('checkpoint');
    f.db.prepare('UPDATE physical_play_closures SET result_json=? WHERE source_id=?').run(checkpoint.result_json, source.sourceId);
    expect(store.read(source.sourceId)!.result).toEqual(result);
  } finally { f.close(); }
});

it('rolls back enqueue if its own transaction changes the actual current World activation', () => {
  const { f, store, source } = fixture();
  try {
    f.db.exec("CREATE TRIGGER alter_open_world AFTER INSERT ON physical_play_closures BEGIN UPDATE matches SET activation_json='{}' WHERE match_id='game-1'; END");
    expect(() => store.enqueue(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_play_closures').get()).toEqual({ n: 0 });
    expect(f.official.getMatch('game-1')!.activation).toBeNull();
    f.db.exec('DROP TRIGGER alter_open_world'); expect(store.submit(source.sourceId).workload.after.revision).toBe(1);
  } finally { f.close(); }
});

it('rolls back enqueue when a later activated play changes its current World inside the checkpoint transaction', () => {
  const { f, store, source, actions, physicalPitches, accepted } = fixture();
  try {
    store.submit(source.sourceId);
    let readyAtUs = source.nextStartedAtTick;
    for (let index = 0; index < 3; index++) {
      const { initialWorldSourceId: _initial, ...action } = continuousPitchAction(f, index, readyAtUs) as AcceptedPhysicalPitchActionSource & { initialWorldSourceId: string };
      const following = { ...action, sourceId: `second-pitch-${index}`, activationApplicationId: source.applicationId,
        request: { ...action.request, workloadRevision: 1 } };
      actions.set(following.sourceId, following);
      readyAtUs = physicalPitches.accept(following.sourceId, index).result.pitch.resolution.timeline.lastEventTick;
    }
    const second = { ...source, sourceId: 'second-close', physicalPitchSourceId: 'second-pitch-2', applicationId: 'second-application',
      scoringApplicationId: 'second-scoring', snapshotId: 'second-rule', ruleTick: readyAtUs + 1, closureTick: readyAtUs + 2, nextStartedAtTick: readyAtUs + 3 };
    accepted.set(second.sourceId, second);
    f.db.exec("CREATE TRIGGER alter_activated_world AFTER INSERT ON physical_play_closures WHEN NEW.source_id='second-close' BEGIN UPDATE matches SET activation_json='{}' WHERE match_id='game-1'; END");
    expect(() => store.enqueue(second.sourceId)).toThrow('frame');
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_play_closures').get()).toEqual({ n: 1 });
    expect(f.official.getMatch('game-1')!.activation).not.toBeNull();
    f.db.exec('DROP TRIGGER alter_activated_world'); expect(store.submit(second.sourceId).workload.after.revision).toBe(2);
  } finally { f.close(); }
});

it('rejects cached Native pitch results when the actual original physical prefix has changed before capture', () => {
  const { f, source, sources, physicalPitches, accepted } = fixture();
  try {
    const cached = physicalPitches.readAcceptedPitch(source.physicalPitchSourceId)!;
    const stale = f.track(openSqlitePhysicalPlayClosureStore(f.path, { ...sources,
      physicalPitches: { readAcceptedPitch: () => cached, readProgress: () => cached } },
      { readAcceptedClosure: (id) => accepted.get(id) ?? null }));
    f.db.prepare("UPDATE physical_pitch_progress_actions SET source_hash='changed' WHERE source_id='pitch-0'").run();
    expect(() => physicalPitches.readAcceptedPitch(source.physicalPitchSourceId)).toThrow('corrupt physical pitch');
    expect(() => stale.submit(source.sourceId)).toThrow('corrupt physical pitch');
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_play_closures').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
