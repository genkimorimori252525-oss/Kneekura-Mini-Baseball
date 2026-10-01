import { expect, it } from 'vitest';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteOfficialPitchWorkloadStore } from './SqliteOfficialPitchWorkloadStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';

const policy = { sourceId: 'pitch-effort-policy', sourceVersion: 'fixture-v1', policyId: 'fixture-effort', version: 'v1',
  availableAtDay: 1, effortUnitsPerPhysicalPitch: 2 };
const request = { scoringApplicationId: 'scoring-2', activationApplicationId: 'application-1', policySourceId: policy.sourceId };

it('reads replay-validated actual physical pitches and the actual P actor without another appearance receipt', () => {
  const f = officialPitchWorkloadFixture();
  try {
    const play = f.scoring.readAcceptedPlay('scoring-2');
    expect(play!.application).toEqual(f.secondInput);
    const proof = f.participation.readPitcherPlay('game-1', 'application-1', 'application-2');
    expect(proof).toMatchObject({ binding: { careerId: 'career-a', playerId: 'p2', personId: 'person-p2', gameDay: 10 }, playedPlayId: 8, durableRevision: 2 });
    expect(f.db.prepare('SELECT count(*) AS n FROM official_participation_receipts').get()).toEqual({ n: 0 });
    expect(() => f.participation.readPitcherPlay('game-1', 'application-2', 'application-1')).toThrow();
    expect(() => f.participation.readPitcherPlay('other', 'application-1', 'application-2')).toThrow();
  } finally { f.close(); }
});

it('generates MATCH activity from three actual pitches and applies/replays global fatigue after recovery and reopen', () => {
  const f = officialPitchWorkloadFixture();
  try {
    let livePolicy = policy;
    const sources = { scoring: f.scoring, participation: f.participation };
    const producer = f.track(openSqliteOfficialPitchWorkloadStore(f.path, sources,
      { readAcceptedPolicy: (sourceId) => sourceId === livePolicy.sourceId ? livePolicy : null }));
    const activity = producer.accept(request);
    expect(activity).toMatchObject({ careerId: 'career-a', playerId: 'p2', atDay: 10, kind: 'MATCH', effortUnits: 6 });
    const baseline = { sourceId: 'workload-baseline', sourceVersion: 'fixture-v1', personLinkSourceId: 'intake-p2',
      careerId: 'career-a', playerId: 'p2', createdAtDay: 1, fatigue: 0, recoveryCapacity: 1,
      policy: { policyId: 'fixture-workload', version: 'v1', availableAtDay: 1, workloadFatiguePerUnit: 0.1,
        travelFatiguePerKm: 0.01, recoveryPerHour: 0.1 } };
    const recovery = { sourceEventId: 'accepted-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a',
      playerId: 'p2', atDay: 11, kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    const workload = f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, { readAcceptedBaseline: (id) => id === baseline.sourceId ? baseline : null,
      readAcceptedActivity: (id) => id === recovery.sourceEventId ? recovery : producer.readAcceptedActivity(id) }));
    workload.initialize(baseline.sourceId);
    f.db.exec("CREATE TRIGGER fail_workload BEFORE INSERT ON world_player_workload_activities BEGIN SELECT RAISE(ABORT,'fixture workload failure'); END");
    expect(() => workload.apply(activity.sourceEventId, 0)).toThrow('fixture workload failure');
    expect(workload.readHead('career-a', 'p2')!.revision).toBe(0);
    expect(producer.readAcceptedActivity(activity.sourceEventId)).toEqual(activity);
    f.db.exec('DROP TRIGGER fail_workload');
    const after = workload.apply(activity.sourceEventId, 0); expect(after.fatigue).toBeCloseTo(0.6);
    workload.apply(recovery.sourceEventId, 1); expect(workload.readHead('career-a', 'p2')!.fatigue).toBe(0);
    expect(workload.apply(activity.sourceEventId, 0)).toEqual(after);
    livePolicy = { ...policy, effortUnitsPerPhysicalPitch: 3 };
    expect(() => producer.accept(request)).toThrow(/frozen|different/);
    const reopened = f.track(openSqliteOfficialPitchWorkloadStore(f.path, sources));
    expect(reopened.accept(request)).toEqual(activity); expect(reopened.readAcceptedActivity(activity.sourceEventId)).toEqual(activity);
    const reopenedWorkload = f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links));
    expect(reopenedWorkload.apply(activity.sourceEventId, 0)).toEqual(after);
    expect(reopenedWorkload.readHead('career-a', 'p2')!.fatigue).toBe(0);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()).toEqual({ n: 2 });
    expect(() => reopened.accept({ ...request, policySourceId: 'alias-policy' })).toThrow();
  } finally { f.close(); }
});

it('rejects manual counted-pitch fixtures and failed/corrupt Source writes without accepting activity', () => {
  const manual = officialPitchWorkloadFixture(false);
  try {
    const producer = manual.track(openSqliteOfficialPitchWorkloadStore(manual.path,
      { scoring: manual.scoring, participation: manual.participation }, { readAcceptedPolicy: () => policy }));
    expect(() => producer.accept(request)).toThrow('physical');
    expect(manual.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 0 });
  } finally { manual.close(); }
  const f = officialPitchWorkloadFixture();
  try {
    const producer = f.track(openSqliteOfficialPitchWorkloadStore(f.path,
      { scoring: f.scoring, participation: f.participation }, { readAcceptedPolicy: () => policy }));
    f.db.exec("CREATE TRIGGER fail_source BEFORE INSERT ON official_pitch_workload_sources BEGIN SELECT RAISE(ABORT,'fixture source failure'); END");
    expect(() => producer.accept(request)).toThrow('fixture source failure');
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER fail_source');
    const activity = producer.accept(request);
    f.db.exec("UPDATE official_pitch_workload_sources SET source_json='{}'");
    expect(() => producer.readAcceptedActivity(activity.sourceEventId)).toThrow('corrupt');
  } finally { f.close(); }
});

it('rejects an accepted calibration snapshot changed during insertion and rolls back both archives', () => {
  const f = officialPitchWorkloadFixture();
  try {
    const producer = f.track(openSqliteOfficialPitchWorkloadStore(f.path,
      { scoring: f.scoring, participation: f.participation }, { readAcceptedPolicy: () => policy }));
    f.db.exec("CREATE TRIGGER alter_policy AFTER INSERT ON official_pitch_workload_policies BEGIN UPDATE official_pitch_workload_policies SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id=NEW.source_id; END");
    expect(() => producer.accept(request)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_policies').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER alter_policy');
    expect(producer.accept(request).effortUnits).toBe(6);
  } finally { f.close(); }
});

it('rejects missing/future policy, wrong actor and corrupt official evidence before Source persistence', () => {
  const f = officialPitchWorkloadFixture();
  try {
    let live: typeof policy | null = null, reads = 0;
    const producer = f.track(openSqliteOfficialPitchWorkloadStore(f.path,
      { scoring: f.scoring, participation: f.participation }, { readAcceptedPolicy: () => { reads += 1; return live; } }));
    expect(() => producer.accept({ ...request, extra: 1 } as typeof request)).toThrow(); expect(reads).toBe(0);
    let accesses = 0;
    const getter = { ...request }; Object.defineProperty(getter, 'policySourceId', { enumerable: true,
      get() { accesses += 1; return policy.sourceId; } });
    expect(() => producer.accept(getter)).toThrow(); expect(accesses).toBe(0); expect(reads).toBe(0);
    expect(() => producer.accept(request)).toThrow('policy');
    live = { ...policy, availableAtDay: 11 }; expect(() => producer.accept(request)).toThrow('future');
    live = policy; expect(() => producer.accept({ ...request, scoringApplicationId: 'missing' })).toThrow('missing');
    const first = f.db.prepare("SELECT result_json FROM applications WHERE application_id='application-1'").get() as { result_json: string };
    const changed = JSON.parse(first.result_json); changed.nextWorld.defenders[0].registeredPosition = 'C';
    f.db.prepare("UPDATE applications SET result_json=? WHERE application_id='application-1'").run(JSON.stringify(changed));
    expect(() => producer.accept(request)).toThrow('pitcher');
    f.db.prepare("UPDATE applications SET result_json=? WHERE application_id='application-1'").run(first.result_json);
    const binding = f.db.prepare("SELECT binding_json FROM official_participant_bindings WHERE player_id='p2'").get() as { binding_json: string };
    f.db.prepare("UPDATE official_participant_bindings SET binding_json=? WHERE player_id='p2'")
      .run(JSON.stringify({ ...JSON.parse(binding.binding_json), careerId: 'other-career' }));
    expect(() => producer.accept(request)).toThrow('scope');
    f.db.prepare("UPDATE official_participant_bindings SET binding_json=? WHERE player_id='p2'").run(binding.binding_json);
    const scoring = f.db.prepare("SELECT request_json FROM official_scoring_applications WHERE scoring_application_id='scoring-2'").get() as { request_json: string };
    const broken = JSON.parse(scoring.request_json); broken.input.officialApplication.timeline.events[0].tick += 1;
    f.db.prepare("UPDATE official_scoring_applications SET request_json=? WHERE scoring_application_id='scoring-2'").run(JSON.stringify(broken));
    expect(() => producer.accept(request)).toThrow('corrupt');
    f.db.prepare("UPDATE official_scoring_applications SET request_json=? WHERE scoring_application_id='scoring-2'").run(scoring.request_json);
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 0 });
    expect(producer.accept(request).effortUnits).toBe(6);
  } finally { f.close(); }
});

it('rejects a changed activated MatchState and detects a later valid policy Source rewrite on offline replay', () => {
  const f = officialPitchWorkloadFixture();
  try {
    const sources = { scoring: f.scoring, participation: f.participation };
    const producer = f.track(openSqliteOfficialPitchWorkloadStore(f.path, sources, { readAcceptedPolicy: () => policy }));
    const first = f.db.prepare("SELECT result_json FROM applications WHERE application_id='application-1'").get() as { result_json: string };
    const changed = JSON.parse(first.result_json); changed.activation.nextMatchState.score.away = 999;
    f.db.prepare("UPDATE applications SET result_json=? WHERE application_id='application-1'").run(JSON.stringify(changed));
    expect(() => producer.accept(request)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 0 });
    f.db.prepare("UPDATE applications SET result_json=? WHERE application_id='application-1'").run(first.result_json);
    const activity = producer.accept(request);
    f.db.exec("UPDATE official_pitch_workload_policies SET source_json=json_set(source_json,'$.sourceVersion','changed-after-commit')");
    const reopened = f.track(openSqliteOfficialPitchWorkloadStore(f.path, sources));
    expect(() => reopened.readAcceptedActivity(activity.sourceEventId)).toThrow('corrupt');
    expect(() => reopened.accept(request)).toThrow('corrupt');
  } finally { f.close(); }
});
