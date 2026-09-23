import { describe, expect, it } from 'vitest';
import { resolvePitchMotionTimeline } from './PitchMotionTimeline';
import type { PitchTimingProfile } from './PitchTimingModel';

const profile = (quickSpeedFactor = 2.5): PitchTimingProfile => ({
  baseStartIntervalUs: 10_000_000,
  normalMotionToReleaseUs: 600_000,
  followThroughUs: 200_000,
  quickSpeedFactor,
  cadenceExecutionControl: 0.8,
  cadenceTimingKnowledge: 0.8,
  quickRepeatability: 0.7,
  naturalVariationUs: 50_000,
  normalPhaseWeights: { gather: 2, transition: 3, stride: 5 },
  quickPhaseWeights: { gather: 1, transition: 2, stride: 3 },
});
const variation = (naturalDeviationUs: number) => ({
  outingBiasUs: Math.trunc(naturalDeviationUs / 2),
  pitchJitterUs: naturalDeviationUs - Math.trunc(naturalDeviationUs / 2),
  naturalDeviationUs,
});

describe('canonical pitch motion timeline', () => {
  it('keeps long deliberate hold and quick motion on separate axes', () => {
    const timeline = resolvePitchMotionTimeline({
      readyAtUs: 1_000_000, profile: profile(),
      timingIntent: { deliveryMode: 'QUICK', cadenceIntent: 'DELIBERATE' },
      variation: variation(40_000), deliberateExtraHoldUs: 300_000,
    });
    expect(timeline.startIntervalUs).toBe(10_320_000);
    expect(timeline.motionToReleaseUs).toBe(260_000);
    expect(timeline.naturalDeviationUs).toBe(40_000);
    expect(timeline.deliberateExtraHoldUs).toBe(300_000);
    expect(timeline.releaseUs).toBe(11_580_000);
    expect(timeline.followThroughEndUs).toBe(11_780_000);
    expect([
      timeline.readyAtUs, timeline.motionStartUs, timeline.gatherEndUs,
      timeline.strideStartUs, timeline.releaseUs, timeline.followThroughEndUs,
    ].every((tick, index, all) => index === 0 || tick > all[index - 1])).toBe(true);
  });

  it('reaches continuous G/A/Gold source endpoints without grade-driven timing', () => {
    const durations = [1 / 1.8, 1.8, 2.5].map((factor) =>
      resolvePitchMotionTimeline({
        readyAtUs: 0, profile: profile(factor),
        timingIntent: { deliveryMode: 'QUICK', cadenceIntent: 'STANDARD' },
        variation: variation(0), deliberateExtraHoldUs: 0,
      }).motionToReleaseUs);
    expect(durations).toEqual([1_080_000, 333_333, 240_000]);
    expect(resolvePitchMotionTimeline({
      readyAtUs: 0, profile: profile(2.5),
      timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' },
      variation: variation(0), deliberateExtraHoldUs: 0,
    }).motionToReleaseUs).toBe(600_000);
  });

  it('rejects forged holds, excess natural variation and time overflow', () => {
    const base = {
      readyAtUs: 0, profile: profile(),
      timingIntent: { deliveryMode: 'NORMAL' as const, cadenceIntent: 'STANDARD' as const },
      variation: variation(0), deliberateExtraHoldUs: 0,
    };
    expect(() => resolvePitchMotionTimeline({ ...base, deliberateExtraHoldUs: 100_000 }))
      .toThrow('STANDARD cadence cannot add deliberate hold');
    expect(() => resolvePitchMotionTimeline({ ...base, variation: variation(50_001) }))
      .toThrow('natural timing deviation');
    expect(() => resolvePitchMotionTimeline({ ...base, readyAtUs: Number.MAX_SAFE_INTEGER }))
      .toThrow('safe integer');
  });
});
