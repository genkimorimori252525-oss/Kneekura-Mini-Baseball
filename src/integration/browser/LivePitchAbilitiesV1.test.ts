import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LIVE_MATCH_PHYSICS_V1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { simulateLivePitchV1, type LivePitchInputV1, type LiveMeasuredClipV1 } from './LivePitchV1';
const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const source = (): LivePitchInputV1 => ({ originTick: 1_000_000, seed: 1,
  batter: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters: 1.8, bats: 'R', clipId: clips.find(c => c.side === 'R')!.id },
  pitcher: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters: 0 }, measuredClips: clips,
  batting: 'balanced', pitchType: 'fastball', location: 'zone', physics: LIVE_MATCH_PHYSICS_V1 });

it('applies an authored release-speed ceiling before the immutable Source is launched', () => {
  const i = source(), r = simulateLivePitchV1({ ...i, batting: 'take', pitcher: { ...i.pitcher, maximumPitchSpeedMps: 151 / 3.6 } });
  const released = r.diagnostics.sourceDescriptor.initial.ball;
  expect(Math.hypot(released.velocity.x, released.velocity.y, released.velocity.z)).toBeLessThanOrEqual(151 / 3.6);
  expect(released.spin).toEqual(i.pitcher.spinRadPerSecond);
  expect(r.diagnostics.individualControls.maximumPitchSpeedMps).toBe(151 / 3.6);
});
it('uses the actual throwing side for release geometry without silently changing authored world spin', () => {
  const i = source(), left = simulateLivePitchV1({ ...i, batting: 'take', pitcher: { ...i.pitcher, throws: 'L' } }),
    right = simulateLivePitchV1({ ...i, batting: 'take', pitcher: { ...i.pitcher, throws: 'R' } });
  expect(left.diagnostics.sourceDescriptor.initial.ball.position.x).toBe(-.18);
  expect(right.diagnostics.sourceDescriptor.initial.ball.position.x).toBe(.18);
  expect(left.diagnostics.sourceDescriptor.initial.ball.spin).toEqual(right.diagnostics.sourceDescriptor.initial.ball.spin);
});
it('changes the executed measured-bat rate from target SI and certifies the declared continuous maximum', () => {
  const i = source(), slow = simulateLivePitchV1({ ...i, batter: { ...i.batter, targetSweetSpotSpeedMps: 18, maximumSweetSpotSpeedMps: 90 } }),
    fast = simulateLivePitchV1({ ...i, batter: { ...i.batter, targetSweetSpotSpeedMps: 30, maximumSweetSpotSpeedMps: 90 } }),
    capped = simulateLivePitchV1({ ...i, batter: { ...i.batter, targetSweetSpotSpeedMps: 30, maximumSweetSpotSpeedMps: 10 } });
  expect(fast.diagnostics.playbackRate).toBeGreaterThan(slow.diagnostics.playbackRate);
  expect(fast.diagnostics.referenceContactSweetSpotSpeedMps).toBeCloseTo(30, 9);
  const at=fast.diagnostics.referenceContactTick,one=fast.sampleBatAtTick(at+1)!,two=fast.sampleBatAtTick(at+2)!,t=fast.diagnostics.sweetSpotT,
    point=(bat:typeof one)=>({x:bat.grip.x+(bat.tip.x-bat.grip.x)*t,y:bat.grip.y+(bat.tip.y-bat.grip.y)*t,z:bat.grip.z+(bat.tip.z-bat.grip.z)*t}),
    a=point(one),b=point(two);
  // Verify actual executed poses on the outgoing segment, not just a reported
  // target/probe scalar. No ball or motor clock is moved to obtain this sample.
  expect(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)*1e6).toBeCloseTo(30,3);
  expect(capped.diagnostics.referenceMaximumSweetSpotSpeedMps).toBeLessThanOrEqual(10 + 1e-10);
  expect(capped.frames.map(f => f.bat)).not.toEqual(fast.frames.map(f => f.bat));
  expect(fast.diagnostics.sourceDescriptor).toEqual(slow.diagnostics.sourceDescriptor);
});
it('enforces explicit reaction/motor latency by delaying the actual reference rather than moving the pitch', () => {
  const i = source(), onTime = simulateLivePitchV1({ ...i, batter: { ...i.batter, preContactSeconds: .16, motorLatencySeconds: 0 } }),
    delayed = simulateLivePitchV1({ ...i, batter: { ...i.batter, preContactSeconds: .16, motorLatencySeconds: .4 } });
  expect(delayed.diagnostics.referenceStartTick).toBeGreaterThan(onTime.diagnostics.referenceStartTick);
  expect(delayed.diagnostics.motorDelaySeconds).toBeGreaterThan(0);
  expect(delayed.diagnostics.sourceDescriptor).toEqual(onTime.diagnostics.sourceDescriptor);
});
it('uses explicit decision and bad-ball control in the planned motion, never in the contact result', () => {
  const i = source(), outside = { ...i, location: 'outside', batter: { ...i.batter, chaseMarginMeters: .6, aimStdMeters: .02 } },
    decision = { approach: 'SWING' as const, threshold: .5, aggressionWeight: .5 },
    weak = simulateLivePitchV1({ ...outside, batter: { ...outside.batter, swingDecision: decision, badBallControl: 0 } }),
    skilled = simulateLivePitchV1({ ...outside, batter: { ...outside.batter, swingDecision: decision, badBallControl: 1 } }),
    take = simulateLivePitchV1({ ...outside, batter: { ...outside.batter, swingDecision: { ...decision, approach: 'TAKE' } } });
  expect(weak.diagnostics.swingOffered).toBe(true); expect(take.diagnostics.swingOffered).toBe(false);
  expect(weak.diagnostics.aimErrorMeters).not.toEqual(skilled.diagnostics.aimErrorMeters);
  expect(weak.diagnostics.sourceDescriptor).toEqual(skilled.diagnostics.sourceDescriptor);
});
it('rotates the measured reference to authored attack/pull angles and keeps one rigid bat length', () => {
  const i = source(), r = simulateLivePitchV1({ ...i, batter: { ...i.batter, attackAngleDegrees: 17, pullAngleDegrees: 22 } });
  const v = r.diagnostics.referenceContactSweetSpotVelocity;
  expect(Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180 / Math.PI).toBeCloseTo(17, 9);
  expect(-Math.atan2(v.x, v.z) * 180 / Math.PI).toBeCloseTo(22, 9);
  const bat = r.frames.find(f => f.bat)!.bat!;
  expect(Math.hypot(bat.tip.x - bat.grip.x, bat.tip.y - bat.grip.y, bat.tip.z - bat.grip.z)).toBeCloseTo(i.batter.batLengthM, 12);
});
it('retains declared phase windows and contact depth as actual motor/sensor controls', () => {
  const i = source(), a = simulateLivePitchV1({ ...i, batter: { ...i.batter, preContactSeconds: .12, followThroughSeconds: .08, contactDepthMeters: .5 } }),
    b = simulateLivePitchV1({ ...i, batter: { ...i.batter, preContactSeconds: .22, followThroughSeconds: .18, contactDepthMeters: .2 } });
  expect(a.diagnostics.referenceStartTick).not.toBe(b.diagnostics.referenceStartTick);
  expect(a.diagnostics.referenceThroughTick).not.toBe(b.diagnostics.referenceThroughTick);
  expect(a.diagnostics.individualControls.contactDepthMeters).toBe(.5);
  expect(a.diagnostics.sourceDescriptor).toEqual(b.diagnostics.sourceDescriptor);
});

it('keeps zero judgment error exact and isolates its random stream from pitch, timing, aim and forced swing physics', () => {
  const i = source(), forced = { ...i, batter: { ...i.batter,
    swingDecision: { approach: 'SWING' as const, threshold: .5, aggressionWeight: .5 } } },
    omitted = simulateLivePitchV1(forced), zero = simulateLivePitchV1({ ...forced, batter: { ...forced.batter, zoneJudgmentStdMeters: 0 } }),
    noisy = simulateLivePitchV1({ ...forced, batter: { ...forced.batter, zoneJudgmentStdMeters: .6 } });
  expect(zero.diagnostics).toEqual(omitted.diagnostics); expect(zero.frames).toEqual(omitted.frames); expect(zero.contact).toEqual(omitted.contact);
  expect(noisy.diagnostics.zoneJudgment.errorMeters).not.toEqual({ x: 0, y: 0 });
  expect(noisy.diagnostics.sourceDescriptor).toEqual(omitted.diagnostics.sourceDescriptor);
  expect(noisy.diagnostics.aimErrorMeters).toEqual(omitted.diagnostics.aimErrorMeters);
  expect(noisy.diagnostics.timingErrorSeconds).toBe(omitted.diagnostics.timingErrorSeconds);
  expect(noisy.clipId).toBe(omitted.clipId); expect(noisy.frames).toEqual(omitted.frames); expect(noisy.contact).toEqual(omitted.contact);
});

it('uses the noisy course estimate in actual AUTO judgment while keeping chase margin and aggression separate', () => {
  const i = source(), input = { ...i, batter: { ...i.batter, chaseMarginMeters: 0,
    swingDecision: { approach: 'AUTO' as const, threshold: .5, aggressionWeight: .5 } } }, before = JSON.stringify(input),
    clean = simulateLivePitchV1(input), noisyInput = { ...input, batter: { ...input.batter, zoneJudgmentStdMeters: .6 } },
    noisy = simulateLivePitchV1(noisyInput), repeated = simulateLivePitchV1(noisyInput);
  expect(clean.diagnostics.swingOffered).toBe(true); expect(noisy.diagnostics.swingOffered).toBe(false);
  expect(noisy.diagnostics.zoneJudgment).toEqual(repeated.diagnostics.zoneJudgment);
  expect(noisy.diagnostics.zoneJudgment.estimatedPosition).not.toEqual(noisy.diagnostics.zoneJudgment.observedForecastPosition);
  expect(noisy.diagnostics.sourceDescriptor).toEqual(clean.diagnostics.sourceDescriptor);
  expect(noisy.diagnostics.aimErrorMeters).toEqual(clean.diagnostics.aimErrorMeters);
  expect(JSON.stringify(input)).toBe(before);
  expect(simulateLivePitchV1({ ...noisyInput, seed: i.seed + 1 }).diagnostics.zoneJudgment.errorMeters)
    .not.toEqual(noisy.diagnostics.zoneJudgment.errorMeters);
  const renamed = { ...noisyInput, playerName: 'other name', leagueId: 'NLB',
    batter: { ...noisyInput.batter, playerId: 'other-id', leagueId: 'MLB' } };
  expect(simulateLivePitchV1(renamed).diagnostics.zoneJudgment).toEqual(noisy.diagnostics.zoneJudgment);
});

it('preserves manager TAKE and explicit approach precedence despite judgment error', () => {
  const i = source(), batter = { ...i.batter, zoneJudgmentStdMeters: .6, swingDecision: { approach: 'SWING' as const, threshold: 1, aggressionWeight: 0 } };
  expect(simulateLivePitchV1({ ...i, batter, batting: 'take' }).diagnostics.swingOffered).toBe(false);
  expect(simulateLivePitchV1({ ...i, batter }).diagnostics.swingOffered).toBe(true);
  expect(simulateLivePitchV1({ ...i, batter: { ...batter, swingDecision: { ...batter.swingDecision, approach: 'TAKE' } } }).diagnostics.swingOffered).toBe(false);
});

it('rejects unsupported judgment-error ranges before any physical command runs', () => {
  const i = source();
  for (const zoneJudgmentStdMeters of [-.001, .600001, NaN, Infinity])
    expect(() => simulateLivePitchV1({ ...i, batter: { ...i.batter, zoneJudgmentStdMeters } })).toThrow();
});
