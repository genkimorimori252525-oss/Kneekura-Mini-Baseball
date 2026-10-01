import { expect, it } from 'vitest';
import { continuousPitchFixture, continuousPitchAction as action, closeContinuousPitchPlay } from './ContinuousPitchFixtures.test-support';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { openSqliteOfficialPitchWorkloadStore } from './SqliteOfficialPitchWorkloadStore';

it('persists actual physical progress, resumes the next pitch after reopen and preserves original idempotent history', () => {
  const f = continuousPitchFixture();
  try {
    const actions = new Map<string, AcceptedPhysicalPitchActionSource>();
    let live = true;
    const sources = { matches: f.official, initialWorlds: f.initialWorlds, participation: f.participation, runtime: f.stores };
    const store = f.track(openSqlitePhysicalPitchProgressStore(f.path, sources, { readAcceptedAction: (id) => live ? actions.get(id) ?? null : null }));
    actions.set('pitch-0', action(f, 0, 0));
    const first = store.accept('pitch-0', 0);
    expect(first.result.effectiveFatigue).toBe(0); expect(first.result.pitch.resolution.timeline.status.kind).toBe('active');
    live = false;
    const offline = f.track(openSqlitePhysicalPitchProgressStore(f.path, sources));
    expect(offline.accept('pitch-0', 0)).toEqual(first); expect(offline.readAcceptedPitch('pitch-0')).toEqual(first);
    expect(() => offline.accept('pitch-1', 1)).toThrow('missing');
    live = true;
    actions.set('pitch-1', action(f, 1, first.result.pitch.resolution.timeline.lastEventTick));
    const second = store.accept('pitch-1', 1);
    expect(second.result.effectiveFatigue).toBeCloseTo(0.2);
    expect(second.result.pitch.trajectory.start.velocity.z).toBeCloseTo(-27);
    actions.set('pitch-2', action(f, 2, second.result.pitch.resolution.timeline.lastEventTick));
    const third = store.accept('pitch-2', 2);
    expect(third.result.effectiveFatigue).toBeCloseTo(0.4); expect(third.result.pitch.resolution.timeline.status.kind).toBe('strikeout');
    expect(store.readProgress('game-1', f.initial.match.playId)).toEqual(third);
    expect(offline.readAcceptedPitch('pitch-0')).toEqual(first);
    actions.set('pitch-3', action(f, 3, third.result.pitch.resolution.timeline.lastEventTick));
    expect(() => store.accept('pitch-3', 3)).toThrow('active');
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0); expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
  } finally { f.close(); }
});
it('binds completed workload to original durable physical progress/calibration, then opens the next actual activated play', () => {
  const f = continuousPitchFixture();
  try {
    const actions = new Map<string, AcceptedPhysicalPitchActionSource>();
    const sources = { matches: f.official, initialWorlds: f.initialWorlds, participation: f.participation, runtime: f.stores };
    const store = f.track(openSqlitePhysicalPitchProgressStore(f.path, sources, { readAcceptedAction: (id) => actions.get(id) ?? null }));
    let timeline = f.input.timeline;
    for (let index = 0; index < 3; index++) {
      actions.set(`pitch-${index}`, action(f, index, timeline.lastEventTick));
      timeline = store.accept(`pitch-${index}`, index).result.pitch.resolution.timeline;
    }
    const first = store.readAcceptedPitch('pitch-0');
    closeContinuousPitchPlay(f, timeline);
    let policy = { ...f.effort, sourceId: 'different-effort', effortUnitsPerPhysicalPitch: 3 };
    const producer = f.track(openSqliteOfficialPitchWorkloadStore(f.path, { scoring: f.scoring, participation: f.participation,
      initialWorlds: f.initialWorlds, physicalPitches: store }, { readAcceptedPolicy: () => policy }));
    const request = { scoringApplicationId: 'continuous-scoring', initialWorldSourceId: 'initial-world', policySourceId: policy.sourceId };
    expect(() => producer.accept(request)).toThrow('calibration');
    policy = f.effort;
    const activity = producer.accept({ ...request, policySourceId: policy.sourceId });
    f.activities.set(activity.sourceEventId, activity); expect(f.workload.apply(activity.sourceEventId, 0).fatigue).toBeCloseTo(0.6);
    const { initialWorldSourceId: _initialWorldSourceId, ...next } = action(f, 0, timeline.lastEventTick + 3) as ReturnType<typeof action> & { initialWorldSourceId: string };
    const nextSource = { ...next, sourceId: 'next-pitch', activationApplicationId: 'continuous-close', request: { ...next.request, workloadRevision: 1 } };
    actions.set(nextSource.sourceId, nextSource);
    const played = store.accept(nextSource.sourceId, 0);
    expect(played.result.effectiveFatigue).toBeCloseTo(0.6); expect(played.frame.match.playId).toBe(f.initial.match.playId + 1);
    const rest = { sourceEventId: 'rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a', playerId: 'p2', atDay: 11,
      kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    f.activities.set(rest.sourceEventId, rest); f.workload.apply(rest.sourceEventId, 1);
    const reopened = f.track(openSqlitePhysicalPitchProgressStore(f.path, sources));
    expect(reopened.readAcceptedPitch('pitch-0')).toEqual(first); expect(reopened.accept(nextSource.sourceId, 0)).toEqual(played);
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(2); expect(f.official.getMatch('game-1')!.durableRevision).toBe(1);
  } finally { f.close(); }
});
it('rejects unaccepted/mismatched/caller-derived action input and rolls back failed or changed writes', () => {
  const f = continuousPitchFixture();
  try {
    let source = action(f, 0, 0);
    const sources = { matches: f.official, initialWorlds: f.initialWorlds, participation: f.participation, runtime: f.stores };
    const store = f.track(openSqlitePhysicalPitchProgressStore(f.path, sources, { readAcceptedAction: () => source }));
    for (const invalid of [{ ...source, request: { ...source.request, timeline: f.input.timeline } },
      { ...source, request: { ...source.request, delivery: { ...source.request.delivery, playerId: 'home-1' } } },
      { ...source, request: { ...source.request, delivery: { ...source.request.delivery, pitchIndex: 99 } } },
      { ...source, initialWorldSourceId: 'missing' }]) {
      source = invalid as AcceptedPhysicalPitchActionSource;
      expect(() => store.accept('pitch-0', 0)).toThrow();
      expect(store.readProgress('game-1', f.initial.match.playId)).toBeNull();
    }
    source = action(f, 0, 0);
    f.db.exec("CREATE TRIGGER fail_pitch BEFORE INSERT ON physical_pitch_progress_actions BEGIN SELECT RAISE(ABORT,'fixture pitch failure'); END");
    expect(() => store.accept('pitch-0', 0)).toThrow('fixture pitch failure');
    expect(store.readProgress('game-1', f.initial.match.playId)).toBeNull();
    f.db.exec('DROP TRIGGER fail_pitch');
    const first = store.accept('pitch-0', 0);
    source = { ...source, sourceVersion: 'changed' };
    expect(() => store.accept('pitch-0', 0)).toThrow('frozen');
    const offline = f.track(openSqlitePhysicalPitchProgressStore(f.path, sources));
    expect(offline.readAcceptedPitch('pitch-0')).toEqual(first);
    f.db.exec("UPDATE physical_pitch_progress_actions SET snapshot_json='{}'");
    expect(() => offline.readAcceptedPitch('pitch-0')).toThrow('corrupt');
  } finally { f.close(); }
});
