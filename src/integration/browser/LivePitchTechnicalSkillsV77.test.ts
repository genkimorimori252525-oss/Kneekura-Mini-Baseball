import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';
const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const source = (): LivePitchInputV1 => ({ originTick: 1_000_000, seed: 31,
  batter: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters: 1.8, bats: 'R', aimStdMeters: .03, timingStdSeconds: .02,
    swingDecision: { approach: 'SWING', threshold: .5, aggressionWeight: .5 } },
  pitcher: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters: .08 }, measuredClips: clips,
  batting: 'balanced', pitchType: 'fastball', location: 'zone', physics: LIVE_MATCH_PHYSICS_V1 });

it('keeps off and zero controls byte-exact, including takes and bunt execution', () => {
  for (const batting of ['take', 'balanced', 'bunt'] as const) {
    const input = { ...source(), batting }, before = JSON.stringify(input), old = simulateLivePitchV1(input), zero = simulateLivePitchV1({ ...input,
      batter: { ...input.batter, technicalSkills: { high_zone_hitting: 0, low_zone_hitting: 0 } }, pitcher: { ...input.pitcher, technicalSkills: { inside_command: 0 } } });
    expect(JSON.stringify(zero)).toBe(JSON.stringify(old)); expect(JSON.stringify(input)).toBe(before);
  }
});

it.each(['R', 'L'] as const)('targets actual %s batter inside with one release-command technique and keeps outside exact', bats => {
  const input = { ...source(), batting: 'take' as const, location: 'inside', batter: { ...source().batter, bats } },
    old = simulateLivePitchV1(input), changed = simulateLivePitchV1({ ...input, pitcher: { ...input.pitcher, technicalSkills: { inside_command: 2 } } }),
    effect = changed.diagnostics.insideCommandTechnique!;
  expect(effect.battingSide).toBe(bats); expect(Math.sign(effect.target.x)).toBe(bats === 'R' ? -1 : 1);
  expect(effect.effectiveStandardDeviationMeters).toBeLessThan(effect.baselineStandardDeviationMeters);
  expect(changed.diagnostics.sourceDescriptor.initial.ball.position).toEqual(old.diagnostics.sourceDescriptor.initial.ball.position);
  expect(changed.diagnostics.sourceDescriptor.initial.ball.spin).toEqual(old.diagnostics.sourceDescriptor.initial.ball.spin);
  expect(changed.speedKmh).toBe(old.speedKmh);
  const outside = { ...input, location: 'outside' };
  expect(JSON.stringify(simulateLivePitchV1({ ...outside, pitcher: { ...outside.pitcher, technicalSkills: { inside_command: 2 } } })))
    .toBe(JSON.stringify(simulateLivePitchV1(outside)));
});

it.each([['high', 'high_zone_hitting'], ['low', 'low_zone_hitting']] as const)('changes %s swing errors and actual bat execution, retaining the physical incoming ball', (location, family) => {
  const input = { ...source(), location }, old = simulateLivePitchV1(input),
    changed = simulateLivePitchV1({ ...input, batter: { ...input.batter, technicalSkills: { [family]: 2 } } }),
    effect = changed.diagnostics.zoneHittingTechnique!;
  expect(effect.errorScale).toBeLessThan(1); expect(effect.postContactResultOverride).toBe(false);
  expect(Math.abs(changed.diagnostics.timingErrorSeconds)).toBeLessThan(Math.abs(old.diagnostics.timingErrorSeconds));
  expect(changed.diagnostics.sourceDescriptor).toEqual(old.diagnostics.sourceDescriptor);
  expect(changed.diagnostics.zoneJudgment).toEqual(old.diagnostics.zoneJudgment);
  expect(changed.diagnostics.measuredClipId).toBe(old.diagnostics.measuredClipId);
  expect(changed.diagnostics.aimErrorMeters).not.toEqual(old.diagnostics.aimErrorMeters);
  expect(changed.sampleBatAtTick(input.originTick + .35e6)).not.toEqual(old.sampleBatAtTick(input.originTick + .35e6));
  const opposite = { ...input, location: location === 'high' ? 'low' : 'high' };
  expect(JSON.stringify(simulateLivePitchV1({ ...opposite, batter: { ...opposite.batter, technicalSkills: { [family]: 2 } } })))
    .toBe(JSON.stringify(simulateLivePitchV1(opposite)));
  for (const batting of ['take', 'bunt'] as const) {
    const other = { ...input, batting };
    expect(JSON.stringify(simulateLivePitchV1({ ...other, batter: { ...other.batter, technicalSkills: { [family]: 2 } } })))
      .toBe(JSON.stringify(simulateLivePitchV1(other)));
  }
});

it('records an authored motion only when supplied and leaves every physical pitch frame unchanged', () => {
  const input = { ...source(), batting: 'take' as const }, old = simulateLivePitchV1(input),
    changed = simulateLivePitchV1({ ...input, pitcher: { ...input.pitcher, pitchingMotion: { preparationMs: 2200, headMotionScale: .7 } } });
  expect(changed.diagnostics.pitchingMotion).toEqual({ preparationMs: 2200, headMotionScale: .7 });
  expect(changed.frames).toEqual(old.frames); expect(changed.diagnostics.sourceDescriptor).toEqual(old.diagnostics.sourceDescriptor);
  expect(Object.hasOwn(old.diagnostics, 'pitchingMotion')).toBe(false);
});
