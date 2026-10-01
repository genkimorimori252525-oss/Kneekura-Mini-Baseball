import { expect, it } from 'vitest';
import { worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqliteOfficialPitchWorkloadStore } from './SqliteOfficialPitchWorkloadStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';

const initialSource = { sourceId: 'initial-world', sourceVersion: 'fixture-v1', gameId: 'game-1', fixtureEventId: 'fixture-1', startedAtTick: 0, worldSetup: worldSetup('p2') };
const policy = { sourceId: 'effort', sourceVersion: 'fixture-v1', policyId: 'effort', version: 'v1', availableAtDay: 1, effortUnitsPerPhysicalPitch: 2 };
it('initial actual World -> first physical official play -> generated workload, with original replay after later play/recovery/reopen', () => {
  const f = officialPitchWorkloadFixture(true, true);
  try {
    const initial = f.track(openSqliteOfficialInitialWorldStore(f.path, { matches: f.official, participation: f.participation }, { readAcceptedSetup: () => initialSource }));
    initial.accept(initialSource.sourceId); f.play();
    f.scoring.apply({ scoringApplicationId: 'scoring-1', officialApplication: f.firstInput });
    const sources = { scoring: f.scoring, participation: f.participation, initialWorlds: initial };
    const producer = f.track(openSqliteOfficialPitchWorkloadStore(f.path, sources, { readAcceptedPolicy: () => policy }));
    const request = { scoringApplicationId: 'scoring-1', initialWorldSourceId: initialSource.sourceId, policySourceId: policy.sourceId };
    const activity = producer.accept(request);
    expect(activity).toMatchObject({ careerId: 'career-a', playerId: 'p2', atDay: 10, kind: 'MATCH', effortUnits: 6 });
    const baseline = { sourceId: 'baseline', sourceVersion: 'fixture-v1', personLinkSourceId: 'intake-p2', careerId: 'career-a', playerId: 'p2',
      createdAtDay: 1, fatigue: 0, recoveryCapacity: 1, policy: { policyId: 'workload', version: 'v1', availableAtDay: 1,
        workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } };
    const rest = { sourceEventId: 'rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a', playerId: 'p2', atDay: 11,
      kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    const workload = f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, { readAcceptedBaseline: () => baseline,
      readAcceptedActivity: (id) => id === rest.sourceEventId ? rest : producer.readAcceptedActivity(id) }));
    workload.initialize(baseline.sourceId); const after = workload.apply(activity.sourceEventId, 0); expect(after.fatigue).toBeCloseTo(0.6);
    workload.apply(rest.sourceEventId, 1); expect(workload.readHead('career-a', 'p2')!.fatigue).toBe(0);
    const reopened = f.track(openSqliteOfficialPitchWorkloadStore(f.path, { ...sources,
      initialWorlds: f.track(openSqliteOfficialInitialWorldStore(f.path, { matches: f.official, participation: f.participation })) }));
    expect(reopened.accept(request)).toEqual(activity); expect(reopened.readAcceptedActivity(activity.sourceEventId)).toEqual(activity);
    expect(workload.apply(activity.sourceEventId, 0)).toEqual(after); expect(workload.readHead('career-a', 'p2')!.revision).toBe(2);
    expect(() => producer.accept({ ...request, activationApplicationId: 'application-1' })).toThrow();
    expect(() => producer.accept({ ...request, policySourceId: 'alias' })).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 1 });
  } finally { f.close(); }
});
it('initial Source cannot authorize another play or a mismatched initial physical timeline start', () => {
  for (const startedAtTick of [0, 1]) {
    const f = officialPitchWorkloadFixture(true, true);
    try {
      const initial = f.track(openSqliteOfficialInitialWorldStore(f.path, { matches: f.official, participation: f.participation },
        { readAcceptedSetup: () => ({ ...initialSource, startedAtTick }) }));
      initial.accept(initialSource.sourceId); f.play(); f.scoring.apply({ scoringApplicationId: 'scoring-1', officialApplication: f.firstInput });
      const producer = f.track(openSqliteOfficialPitchWorkloadStore(f.path, { scoring: f.scoring, participation: f.participation, initialWorlds: initial },
        { readAcceptedPolicy: () => policy }));
      expect(() => producer.accept({ scoringApplicationId: 'scoring-2', initialWorldSourceId: initialSource.sourceId, policySourceId: policy.sourceId })).toThrow();
      if (startedAtTick !== 0) expect(() => producer.accept({ scoringApplicationId: 'scoring-1', initialWorldSourceId: initialSource.sourceId, policySourceId: policy.sourceId })).toThrow();
      expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 0 });
    } finally { f.close(); }
  }
});
