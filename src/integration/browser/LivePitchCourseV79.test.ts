import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { createNeutralBatterCourseProfileV79, classifyBatterCourseV79 } from './BatterCourseProfileV79';
import { simulateLivePitchV1, type LivePitchInputV1, type LiveMeasuredClipV1 } from './LivePitchV1';

const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const source = (seed = 7): LivePitchInputV1 => ({ originTick: 1234567, seed,
  batter: { heightMeters: 1.8, bats: 'R', batLengthM: .84, batMassKg: .88, swingRate: 1,
    timingStdSeconds: .009, aimStdMeters: .022, chaseMarginMeters: .2 },
  pitcher: { releaseSpeedMps: 42, spinRadPerSecond: { x: 230, y: 0, z: 0 }, commandStdMeters: 0 },
  measuredClips: clips, batting: 'balanced', pitchType: 'fastball', location: 'zone', physics: { kind: 'aero_ground_v1',
    air: { ticksPerSecond: 1e6, integrationStepTicks: 5000, gravityY: -9.81, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
    ground: { ticksPerSecond: 1e6, gravityMps2: 9.81, radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .2,
      material: { restitution: .48, slidingFriction: .24, rollingDecelerationMps2: .36, normalSpinDecayPerSecond: .18 } } } });

it('preserves the omitted profile shape and all legacy Source, motor draws and results for explicit neutral data', () => {
  const input = source(), baseline = simulateLivePitchV1(input), neutral = simulateLivePitchV1({ ...input,
    batter: { ...input.batter, batterCourseProfileV79: createNeutralBatterCourseProfileV79() } });
  expect(baseline.diagnostics).not.toHaveProperty('courseV79');
  const { courseV79, ...diagnostics } = neutral.diagnostics;
  expect(courseV79!.errorScale).toBe(1); expect(courseV79!.directionIntent).toBeNull();
  expect(diagnostics).toEqual(baseline.diagnostics); expect(neutral.frames).toEqual(baseline.frames);
  expect(neutral.contact).toEqual(baseline.contact); expect(neutral.call).toEqual(baseline.call);
});

it.each([[.33, 1, .9], [.18, 1, 1.0875], [1, 3, .75], [0, 3, 1.25], [.33, 0, 1]])(
  'applies course %.2f with scale %s once to timing and aim', (average, effectScale, scale) => {
    const input = source(), baseline = simulateLivePitchV1(input), profile = { ...createNeutralBatterCourseProfileV79(),
      referenceAverages: Array(63).fill(average), effectScale },
      before = JSON.stringify(input), actual = simulateLivePitchV1({ ...input, batter: { ...input.batter, batterCourseProfileV79: profile } });
    expect(actual.diagnostics.sourceDescriptor).toEqual(baseline.diagnostics.sourceDescriptor);
    expect(actual.diagnostics.courseV79!.errorScale).toBeCloseTo(scale, 14);
    expect(actual.diagnostics.timingErrorSeconds).toBeCloseTo(baseline.diagnostics.timingErrorSeconds * scale, 14);
    for (const axis of ['x', 'y', 'z'] as const)
      expect(actual.diagnostics.aimErrorMeters[axis]).toBeCloseTo(baseline.diagnostics.aimErrorMeters[axis] * scale, 14);
    expect(actual.diagnostics.individualControls).toEqual(baseline.diagnostics.individualControls); expect(JSON.stringify(input)).toBe(before);
  });

it('uses only the current perceived forecast cell and composes independently with the existing high/low technique once', () => {
  const original = source(3), input = { ...original, batter: { ...original.batter, zoneJudgmentStdMeters: .06,
    technicalSkills: { high_zone_hitting: 1, low_zone_hitting: 1 } } }, baseline = simulateLivePitchV1(input),
    profile = createNeutralBatterCourseProfileV79(), inspected = simulateLivePitchV1({ ...input, batter: { ...input.batter, batterCourseProfileV79: profile } }),
    course = inspected.diagnostics.courseV79!, selected = classifyBatterCourseV79({ position: baseline.diagnostics.zoneJudgment.estimatedPosition, zone: course.zone }),
    averages = [...profile.referenceAverages];
  expect(course.predictedCourse).toEqual(selected); expect(course.predictedPosition).toEqual(baseline.diagnostics.zoneJudgment.estimatedPosition);
  expect(selected.courseIndex).not.toBeNull(); averages[selected.courseIndex!] = .33;
  const actual = simulateLivePitchV1({ ...input, batter: { ...input.batter, batterCourseProfileV79: { ...profile, referenceAverages: averages } } });
  expect(actual.diagnostics.zoneHittingTechnique).toEqual(baseline.diagnostics.zoneHittingTechnique);
  expect(actual.diagnostics.timingErrorSeconds).toBeCloseTo(baseline.diagnostics.timingErrorSeconds * .9, 14);
  expect(actual.diagnostics.sourceDescriptor).toEqual(baseline.diagnostics.sourceDescriptor);
});

it.each(['R', 'L'] as const)('maps fixed field directions into %s-handed bat intention without changing the pitch Source', bats => {
  const original = source(), input = { ...original, batter: { ...original.batter, bats } }, baseline = simulateLivePitchV1(input);
  for (const [index, angle] of [[0, -36], [4, 36]] as const) {
    const weights = [0, 0, 0, 0, 0]; weights[index] = 1;
    const actual = simulateLivePitchV1({ ...input, batter: { ...input.batter,
      batterCourseProfileV79: { ...createNeutralBatterCourseProfileV79(), directionWeights: weights } } }),
      intent = actual.diagnostics.courseV79!.directionIntent!, v = actual.diagnostics.referenceContactSweetSpotVelocity;
    expect(intent.sectorIndex).toBe(index); expect(intent.fieldAngleDegrees).toBe(angle);
    expect(intent.pullAngleDegrees).toBe(-angle * (bats === 'R' ? 1 : -1));
    expect(Math.atan2(v.x, v.z) * 180 / Math.PI).toBeCloseTo(angle, 10);
    expect(intent.draw).toBe(new SeedRoot(input.seed).streamRng(0, 'batting', 'direction-intent-v79').nextFloat());
    expect(actual.diagnostics.sourceDescriptor).toEqual(baseline.diagnostics.sourceDescriptor);
    expect(actual.diagnostics.timingErrorSeconds).toBe(baseline.diagnostics.timingErrorSeconds);
    expect(actual.diagnostics.aimErrorMeters).toEqual(baseline.diagnostics.aimErrorMeters);
    expect(actual.diagnostics.courseV79!.postContactResultOverride).toBe(false);
  }
});

it.each(['take', 'bunt'] as const)('does not draw direction or apply normal-swing course motor effects on %s', batting => {
  const input = { ...source(), batting }, baseline = simulateLivePitchV1(input), actual = simulateLivePitchV1({ ...input,
    batter: { ...input.batter, batterCourseProfileV79: { ...createNeutralBatterCourseProfileV79(),
      referenceAverages: Array(63).fill(.33), directionWeights: [1, 0, 0, 0, 0] } } });
  expect(actual.diagnostics.courseV79!.directionIntent).toBeNull(); expect(actual.diagnostics.courseV79!.errorScale).toBe(1);
  expect(actual.frames).toEqual(baseline.frames); expect(actual.contact).toEqual(baseline.contact);
});

it('rejects invalid profiles at direct simulation input before planning a pitch', () => {
  const input = source(); expect(() => simulateLivePitchV1({ ...input,
    batter: { ...input.batter, batterCourseProfileV79: { ...createNeutralBatterCourseProfileV79(), effectScale: -1 } } })).toThrow();
});

it('isolates paired-trial direction draws from the pitch Source, perception and motor error streams', () => {
  const original = source(), input = { ...original, batter: { ...original.batter, zoneJudgmentStdMeters: .06,
    batterCourseProfileV79: { ...createNeutralBatterCourseProfileV79(), directionWeights: [.2, .2, .2, .2, .2] } } },
    first = simulateLivePitchV1({ ...input, directionTrialSeedV79: 100 }), second = simulateLivePitchV1({ ...input, directionTrialSeedV79: 200 });
  expect(first.diagnostics.courseV79!.directionIntent!.draw).toBe(new SeedRoot(100).streamRng(0, 'batting', 'direction-intent-v79').nextFloat());
  expect(second.diagnostics.courseV79!.directionIntent!.draw).toBe(new SeedRoot(200).streamRng(0, 'batting', 'direction-intent-v79').nextFloat());
  expect(first.diagnostics.sourceDescriptor).toEqual(second.diagnostics.sourceDescriptor);
  expect(first.diagnostics.zoneJudgment).toEqual(second.diagnostics.zoneJudgment);
  expect(first.diagnostics.timingErrorSeconds).toBe(second.diagnostics.timingErrorSeconds);
  expect(first.diagnostics.aimErrorMeters).toEqual(second.diagnostics.aimErrorMeters);
  expect(simulateLivePitchV1({ ...original, directionTrialSeedV79: 100 }).diagnostics).toEqual(simulateLivePitchV1(original).diagnostics);
  for (const directionTrialSeedV79 of [-1, .5, 0x100000000, NaN])
    expect(() => simulateLivePitchV1({ ...input, directionTrialSeedV79 })).toThrow();
});
