import { describe, expect, it } from 'vitest';
import {
  buildCanonicalFieldingPlayInputV1,
  CANONICAL_FIELDING_SCENARIOS_V1,
  diagnoseLiveFieldPlayV1,
  formatLiveFieldPlayDiagnosticReportV1,
  type AbilityTierV1,
} from './LiveFieldPlayDiagnosticsV1';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';

function actualNonforceTagInput(): LiveFieldPlayInputV1 {
  const v = (x = 0, y = 0, z = 0) => ({ x, y, z }), tps = 1e6;
  return {
    ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(18, .2, 19), velocity: v(0, -1, 1), spin: v() } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: tps, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
      fenceRadiusMeters: 110, fenceHeightMeters: 2 },
    fielders: [v(0, 1, 10), v(0, 1, -2), v(20, 1, 20), v(-20, 1, 20), v(12, 1, 35), v(-12, 1, 35),
      v(-35, 1, 65), v(0, 1, 75), v(35, 1, 65)].map((position, i) => ({ playerId: `fielder-${i}`, position,
      reactionSeconds: .08, topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 11, gloveReachMeters: 1.3, gloveRadiusMeters: .1,
      transferSeconds: .25, throwSpeedMps: 32, throwBackspinRadPerSecond: 120, catchRetention: { ticksPerSecond: tps, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 2, accelerationMps2: 5, reactionSeconds: .1 },
      { runnerId: 'first-runner', initialBase: 1, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 },
      { runnerId: 'second-runner', initialBase: 2, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 },
      { runnerId: 'third-runner', initialBase: 3, topSpeedMps: 3, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 0, maxPlaySeconds: 20,
  };
}

describe('LiveFieldPlayDiagnosticsV1', () => {
  it('recognizes an actual nonforce throw and catcher tag without requiring a bag contact', () => {
    const input = actualNonforceTagInput(), result = simulateLiveFieldPlayV1(input), before = JSON.stringify(result),
      diag = diagnoseLiveFieldPlayV1(input, result), release = result.facts.find(f => f.kind === 'throw_release' && f.base === 4)!,
      exchange = diag.throws.find(t => t.base === 4)!, tag = result.ruleFacts.controlledRunnerTags.find(t => t.runnerId === 'third-runner')!;
    expect(result.end.complete).toBe(true);
    expect(release).toMatchObject({ reason: 'tag_play', runnerId: 'third-runner' });
    expect(exchange).toMatchObject({ forcePlay: false, receptionOutcome: 'glove_secured', baseTouched: false });
    expect(tag.defenderId).toBe(release.receiverPlayerId);
    expect(tag.tick).toBeGreaterThan(result.facts.find(f => f.kind === 'catch_secured' && f.playerId === release.receiverPlayerId && f.tick > release.tick)!.tick);
    expect(result.ruleFacts.controlledBaseContacts.filter(f => f.base === 4)).toEqual([]);
    expect(result.ruleFacts.runnerTouches.filter(f => f.runnerId === 'third-runner' && f.base === 4)).toEqual([]);
    expect(result.finalRunners.find(r => r.runnerId === 'third-runner')!.retired).toBe(true);
    expect(diag.anomalies.filter(a => a.kind === 'CAUGHT_THROW_NO_BASE_TOUCH')).toEqual([]);
    expect(formatLiveFieldPlayDiagnosticReportV1(diag)).toContain('play=tag');
    expect(JSON.stringify(result)).toBe(before);
  });

  it.each(['force_play', undefined] as const)('retains missing-bag detection for a force throw (release reason=%s)', reason => {
    const scenario = CANONICAL_FIELDING_SCENARIOS_V1.find(s => s.id === 'SS_routine')!,
      { input, roleMap } = buildCanonicalFieldingPlayInputV1(scenario), result = simulateLiveFieldPlayV1(input),
      release = result.facts.find(f => f.kind === 'throw_release')!;
    expect(release.reason).toBe('force_play');
    expect(result.facts.some(f => f.kind === 'controlled_base_contact' && f.base === release.base)).toBe(true);
    // Deliberately remove the force-play bag observation to verify the anomaly detector remains active.
    const missingBagObservation = { ...result, facts: result.facts.filter(f => f.kind !== 'controlled_base_contact').map(f =>
      f.kind === 'throw_release' ? { ...f, reason } : f) }, diag = diagnoseLiveFieldPlayV1(input, missingBagObservation, roleMap);
    expect(diag.throws[0]).toMatchObject({ forcePlay: true, receptionOutcome: 'glove_secured', baseTouched: false });
    expect(diag.anomalies).toContainEqual(expect.objectContaining({ kind: 'CAUGHT_THROW_NO_BASE_TOUCH', base: release.base }));
  });

  it('captures structured AI telemetry, kinematic oracle, and anomaly classifications without altering simulation facts', () => {
    const scenario = CANONICAL_FIELDING_SCENARIOS_V1.find((s) => s.id === 'SS_routine')!;
    const { input, roleMap } = buildCanonicalFieldingPlayInputV1(scenario, 'default');
    const resultA = simulateLiveFieldPlayV1(input);
    const diag = diagnoseLiveFieldPlayV1(input, resultA, roleMap);
    const resultB = simulateLiveFieldPlayV1(input);

    expect(resultA.facts).toEqual(resultB.facts);
    expect(resultA.ruleFacts).toEqual(resultB.ruleFacts);
    expect(diag.oracle.infieldReachable).toBe(true);
    expect(diag.oracle.earliestInfielder?.role).toBe('SS');
    expect(diag.telemetry.roleTransitions.length).toBeGreaterThan(0);
    expect(formatLiveFieldPlayDiagnosticReportV1(diag, scenario.id)).toContain('=== [SS_routine]');
  });

  it('audits the full 20-scenario canonical fielding matrix', () => {
    const tiers: readonly AbilityTierV1[] = process.env.FIELDING_DIAG_TIERS === '1' ? ['low', 'default', 'high'] : ['default'];
    const summaryByTier: Record<
      string,
      {
        totalOuts: number;
        infieldGrounderOuts: number;
        infieldGrounderCount: number;
        anomalyCounts: Record<string, number>;
        totalAnomalies: number;
      }
    > = {};

    const defaultReports: string[] = [];

    for (const tier of tiers) {
      summaryByTier[tier] = { totalOuts: 0, infieldGrounderOuts: 0, infieldGrounderCount: 0, anomalyCounts: {}, totalAnomalies: 0 };
      for (const scenario of CANONICAL_FIELDING_SCENARIOS_V1) {
        const { input, roleMap } = buildCanonicalFieldingPlayInputV1(scenario, tier);
        const diag = diagnoseLiveFieldPlayV1(input, undefined, roleMap);
        expect(diag.end.complete).toBe(true);

        const bucket = summaryByTier[tier];
        bucket.totalOuts += diag.outsRecorded;
        if (scenario.category === 'infield_grounder' || scenario.category === 'slow_roller' || scenario.category === 'double_play') {
          bucket.infieldGrounderCount++;
          bucket.infieldGrounderOuts += diag.outsRecorded;
        }
        for (const a of diag.anomalies) {
          bucket.anomalyCounts[a.kind] = (bucket.anomalyCounts[a.kind] ?? 0) + 1;
          bucket.totalAnomalies++;
        }
        if (tier === 'default') {
          defaultReports.push(formatLiveFieldPlayDiagnosticReportV1(diag, `${scenario.id} (${scenario.category})`));
        }
      }
    }

    if (process.env.FIELDING_DIAG_REPORT === '1') {
      console.log('\n================ CANONICAL 20-SCENARIO DIAGNOSTIC REPORT (DEFAULT TIER) ================');
      console.log(defaultReports.join('\n\n'));
      console.log('\n================ TIER SUMMARY ================');
      console.log(JSON.stringify(summaryByTier, null, 2));
    }

    expect(summaryByTier.default.infieldGrounderCount).toBe(13);
    expect(summaryByTier.default.totalAnomalies).toBe(0);
    expect(summaryByTier.default.infieldGrounderOuts).toBeGreaterThanOrEqual(12);
    expect(summaryByTier.default.totalOuts).toBeGreaterThanOrEqual(17);
    if (process.env.FIELDING_DIAG_TIERS === '1') {
      expect(summaryByTier.low.totalOuts).toBeLessThan(summaryByTier.default.totalOuts);
      expect(summaryByTier.default.totalOuts).toBeLessThan(summaryByTier.high.totalOuts);
      expect(summaryByTier.high.totalAnomalies).toBe(0);
    }
  });

  it('demonstrates monotonic physical fielding progression across low, default, and high ability tiers', () => {
    const benchmarkIds = ['56_hole_grounder', '34_hole_grounder', 'slow_roller_3B', 'DP_643_grounder', 'force_3B_grounder', 'shallow_CF_liner'] as const;
    const outsByTier: Record<AbilityTierV1, number> = { low: 0, default: 0, high: 0 };
    for (const tier of ['low', 'default', 'high'] as const) {
      for (const id of benchmarkIds) {
        const scenario = CANONICAL_FIELDING_SCENARIOS_V1.find((s) => s.id === id)!;
        const { input, roleMap } = buildCanonicalFieldingPlayInputV1(scenario, tier);
        const diag = diagnoseLiveFieldPlayV1(input, undefined, roleMap);
        expect(diag.anomalies).toEqual([]);
        outsByTier[tier] += diag.outsRecorded;
      }
    }
    expect(outsByTier.low).toBeLessThan(outsByTier.default);
    expect(outsByTier.default).toBeLessThan(outsByTier.high);
  });
});
