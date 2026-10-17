import { describe, expect, it } from 'vitest';
import {
  buildCanonicalFieldingPlayInputV1,
  CANONICAL_FIELDING_SCENARIOS_V1,
  diagnoseLiveFieldPlayV1,
  formatLiveFieldPlayDiagnosticReportV1,
  type AbilityTierV1,
} from './LiveFieldPlayDiagnosticsV1';
import { simulateLiveFieldPlayV1 } from './LiveFieldPlayV1';

describe('LiveFieldPlayDiagnosticsV1', () => {
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
