import { expect, it } from 'vitest';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { applyStrikeoutPlateAppearanceToMatchState } from '../../core/sim/plateAppearance/PlateAppearanceMatchState';
import { continuousPitchFixture } from './ContinuousPitchFixtures.test-support';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import { openSqliteOfficialPitchWorkloadStore } from './SqliteOfficialPitchWorkloadStore';

it('actual preceding physical pitches change the next execution before closure; completed global effort is charged only once', () => {
  const f = continuousPitchFixture();
  try {
    let timeline = f.input.timeline;
    const results = [];
    for (let pitchIndex = 0; pitchIndex < 3; pitchIndex++) {
      const result = resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, { ...f.input, timeline,
        delivery: { ...f.input.delivery, pitchIndex, readyAtUs: timeline.lastEventTick } });
      expect(result.workload.revision).toBe(0); expect(result.workload.fatigue).toBe(0);
      expect(result.effectiveFatigue).toBeCloseTo(pitchIndex * 0.2);
      expect(result.prefixWorkload.effortUnits).toBe(pitchIndex * 2);
      expect(result.pitch.trajectory.start.velocity.z).toBeCloseTo(-30 * (1 - pitchIndex * 0.1));
      expect(result.pitch.delivery.timeline.motionToReleaseUs).toBe(600_000 + pitchIndex * 60_000);
      timeline = result.pitch.resolution.timeline; results.push(result);
      expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0);
    }
    expect(timeline.status.kind).toBe('strikeout');
    const next = applyStrikeoutPlateAppearanceToMatchState(f.initial.match, timeline);
    let adjudication = createPlayAdjudicationLedger({ playId: timeline.playId, ruleProfileId: f.initial.match.ruleProfileId, playEnd: null });
    adjudication = recordCorrectRuleSnapshot(adjudication, 0, { eventId: 'continuous-rule', tick: timeline.lastEventTick + 1,
      snapshotId: 'continuous-rule', evidenceRevision: 1, ruling: { outsAfter: next.outs, basesAfter: next.bases, scoredRunnerIds: [] } });
    adjudication = closeOfficialPlay(adjudication, 1, { eventId: 'continuous-close', closureId: 'continuous-close', tick: timeline.lastEventTick + 2 });
    const application = { ...f.firstInput, applicationId: 'continuous-close', timeline, adjudication, nextStartedAtTick: timeline.lastEventTick + 3 };
    f.official.applyAndActivate(application); f.scoring.apply({ scoringApplicationId: 'continuous-scoring', officialApplication: application });
    const producer = f.track(openSqliteOfficialPitchWorkloadStore(f.path, { scoring: f.scoring, participation: f.participation, initialWorlds: f.initialWorlds },
      { readAcceptedPolicy: () => f.effort }));
    const activity = producer.accept({ scoringApplicationId: 'continuous-scoring', initialWorldSourceId: 'initial-world', policySourceId: f.effort.sourceId });
    f.activities.set(activity.sourceEventId, activity);
    expect(activity.effortUnits).toBe(6);
    const after = f.workload.apply(activity.sourceEventId, 0);
    expect(after.fatigue).toBeCloseTo(0.6); expect(f.workload.apply(activity.sourceEventId, 0)).toEqual(after);
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(1);
    expect(resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, f.input)).toEqual(results[0]);
  } finally { f.close(); }
});
it('rejects missing/future policy and caller fatigue, leaving durable histories untouched', () => {
  const f = continuousPitchFixture();
  try {
    expect(() => resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, { ...f.input, effortPolicySourceId: 'missing' })).toThrow('missing');
    expect(() => resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, { ...f.input, fatigue: 0.9 } as typeof f.input)).toThrow('request');
    const future = { ...f.stores, effortPolicies: { readAcceptedPolicy: () => ({ ...f.effort, availableAtDay: 11 }) } };
    expect(() => resolveContinuousPlayerPitchAgainstBatterFromWorld(future, f.input)).toThrow('future');
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0);
  } finally { f.close(); }
});
it('rejects a changed status count in an otherwise actual physical prefix', () => {
  const f = continuousPitchFixture();
  try {
    const first = resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, f.input);
    const timeline = JSON.parse(JSON.stringify(first.pitch.resolution.timeline)) as typeof f.input.timeline;
    expect(timeline.status).toEqual({ kind: 'active', count: { balls: 0, strikes: 1 } });
    if (timeline.status.kind !== 'active') throw new Error('fixture must be active');
    Object.assign(timeline.status.count, { strikes: 2 });
    expect(() => resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, { ...f.input, timeline,
      delivery: { ...f.input.delivery, pitchIndex: 1, readyAtUs: timeline.lastEventTick } })).toThrow('status count');
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0);
  } finally { f.close(); }
});
