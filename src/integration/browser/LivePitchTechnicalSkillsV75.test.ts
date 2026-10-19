import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { createRigidBatStateFromBatterSwingState, measureRigidBatBallSurfaceSeparation } from '../../core/sim/contact/RigidBatBallContact';
import { resolveWoodBatSpeedProfileBallContact } from '../../core/sim/contact/WoodBatSpeedResponseProfile';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../../core/sim/contact/WoodBatProductionProfileV1';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';

const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const source = (seed = 1): LivePitchInputV1 => ({ originTick: 1_000_000, seed,
  batter: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters: 1.8, bats: 'R', aimStdMeters: 0, timingStdSeconds: 0,
    clipId: clips.find(c => c.side === 'R')!.id, swingDecision: { approach: 'SWING', threshold: .5, aggressionWeight: .5 } },
  pitcher: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters: 0 }, measuredClips: clips,
  batting: 'bunt', pitchType: 'fastball', location: 'zone', physics: LIVE_MATCH_PHYSICS_V1 });
const norm = (a: { x: number; y: number; z: number }) => Math.hypot(a.x, a.y, a.z);
const delta = (a: { x: number; y: number; z: number }, b: typeof a) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

it('keeps omitted and zero techniques exactly on the legacy prefix, including static bunt geometry and random draws', () => {
  for (const batting of ['bunt', 'balanced', 'take'] as const) {
    const input = { ...source(), batting }, before = JSON.stringify(input), legacy = simulateLivePitchV1(input),
      zero = simulateLivePitchV1({ ...input, batter: { ...input.batter, technicalSkills: { bunting: 0 } },
        pitcher: { ...input.pitcher, technicalSkills: { low_zone_command: 0 } } });
    expect(JSON.stringify(zero)).toBe(JSON.stringify(legacy));
    for (const seconds of [0, .14, .25, .4]) expect(zero.sampleBatAtTick(input.originTick + seconds * 1e6))
      .toEqual(legacy.sampleBatAtTick(input.originTick + seconds * 1e6));
    expect(JSON.stringify(input)).toBe(before);
  }
});

it('plans a finite moving bunt from one observed prediction, and collision uses that same rigid bat and velocity', () => {
  const input = source(), result = simulateLivePitchV1({ ...input, batter: { ...input.batter, technicalSkills: { bunting: 1 } } }),
    motor = result.diagnostics.buntTechnique!;
  expect(motor.predictionBasis).toBe('ONE_OBSERVED_STATE_FORECAST_NO_FUTURE_CONTACT');
  expect(motor.observedAtElapsedSeconds).toBe(result.diagnostics.predictionMadeAtElapsedSeconds);
  expect(motor.maximumSurfaceSpeedMps).toBeLessThanOrEqual(motor.maximumSpeedMps + 1e-12);
  expect(motor.postContactResultOverride).toBe(false);
  const start = result.sampleBatAtTick(input.originTick)!, moving = result.sampleBatAtTick(input.originTick + .25e6)!;
  expect(moving).not.toEqual(start);
  for (const frame of result.frames) if (frame.bat) {
    const sampled = result.sampleBatAtTick(input.originTick + frame.elapsedSeconds * 1e6)!;
    for (const point of ['grip', 'tip'] as const) expect(norm(delta(sampled[point], frame.bat[point]))).toBeLessThan(1e-12);
    expect(sampled.radiusProfile).toEqual(frame.bat.radiusProfile);
    expect(norm(delta(frame.bat.tip, frame.bat.grip))).toBeCloseTo(input.batter.batLengthM, 12);
  }
  const end = Math.min(.65, (result.diagnostics.referenceThroughTick - input.originTick) / 1e6);
  for (let seconds = 0; seconds < end - .0001; seconds += .005) {
    const a = result.sampleBatAtTick(input.originTick + seconds * 1e6)!, b = result.sampleBatAtTick(input.originTick + (seconds + .0001) * 1e6)!;
    expect(norm(delta(b.grip, a.grip)) / .0001).toBeLessThanOrEqual(motor.maximumSurfaceSpeedMps + 1e-9);
  }
  expect(result.diagnostics.unsupportedReason).toBeNull(); expect(result.contact).not.toBeNull();
  const contactSeconds = result.contactMoment!.elapsedSeconds, at = input.originTick + contactSeconds * 1e6,
    a = result.sampleBatAtTick(at - .1)!, b = result.sampleBatAtTick(at + .1)!, pose = result.sampleBatAtTick(at)!,
    linearVelocity = { x: (b.grip.x - a.grip.x) / 2e-7, y: (b.grip.y - a.grip.y) / 2e-7, z: (b.grip.z - a.grip.z) / 2e-7 },
    rigid = createRigidBatStateFromBatterSwingState({ pose, linearVelocity, angularVelocity: { x: 0, y: 0, z: 0 } }, {
      massKg: input.batter.batMassKg, centerOfMassT: .65, transverseMomentOfInertiaKgM2: input.batter.batMassKg * input.batter.batLengthM ** 2 * .075,
      axialMomentOfInertiaKgM2: input.batter.batMassKg * .025 ** 2 / 2, radiusProfile: pose.radiusProfile }),
    ballPhysical = { massKg: input.physics.air.aerodynamics.ballMassKg, radiusM: input.physics.air.aerodynamics.ballRadiusM,
      rotationalInertiaFactor: input.physics.ground.inertiaRatio },
    independentlyResolved = resolveWoodBatSpeedProfileBallContact(result.contactMoment!.ball, rigid, ballPhysical, NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1)!;
  expect(norm(linearVelocity)).toBeGreaterThan(0);
  expect(measureRigidBatBallSurfaceSeparation(result.contactMoment!.ball, rigid, ballPhysical)).toBeLessThan(1e-10);
  expect(independentlyResolved.normalImpulseNs).toBeCloseTo(result.contact!.normalImpulseNs, 6);
  for (const key of ['x', 'y', 'z'] as const) {
    expect(independentlyResolved.exitVelocity[key]).toBeCloseTo(result.contact!.exitVelocity[key], 6);
    expect(independentlyResolved.exitSpin[key]).toBeCloseTo(result.contact!.exitSpin[key], 5);
  }
  expect(result.diagnostics.sourceDescriptor).toEqual(simulateLivePitchV1(input).diagnostics.sourceDescriptor);
});

it('improves only bunt errors, obeys the declared motor ceiling and leaves takes and other swings unchanged', () => {
  const input = source(8), noisy = { ...input, batter: { ...input.batter, aimStdMeters: .03, timingStdSeconds: .02 } },
    weak = simulateLivePitchV1({ ...noisy, batter: { ...noisy.batter, technicalSkills: { bunting: .25 } } }),
    strong = simulateLivePitchV1({ ...noisy, batter: { ...noisy.batter, technicalSkills: { bunting: 2 } } });
  expect(strong.diagnostics.buntTechnique!.positionErrorScale).toBeLessThan(weak.diagnostics.buntTechnique!.positionErrorScale);
  expect(strong.diagnostics.buntTechnique!.timingErrorScale).toBeLessThan(weak.diagnostics.buntTechnique!.timingErrorScale);
  const weakAxis = weak.diagnostics.buntTechnique!.axis, strongAxis = strong.diagnostics.buntTechnique!.axis;
  expect(Math.hypot(strongAxis.y, strongAxis.z)).toBeLessThan(Math.hypot(weakAxis.y, weakAxis.z));
  expect(norm(delta(strong.diagnostics.buntTechnique!.desiredTargetSweetSpot, strong.diagnostics.zoneJudgment.observedForecastPosition)))
    .toBeLessThan(norm(delta(weak.diagnostics.buntTechnique!.desiredTargetSweetSpot, weak.diagnostics.zoneJudgment.observedForecastPosition)));
  expect(strong.diagnostics.timingErrorSeconds).toBe(weak.diagnostics.timingErrorSeconds);
  expect(strong.diagnostics.aimErrorMeters).toEqual(weak.diagnostics.aimErrorMeters);
  expect(strong.diagnostics.sourceDescriptor).toEqual(weak.diagnostics.sourceDescriptor);
  const capped = simulateLivePitchV1({ ...input, batter: { ...input.batter, maximumSweetSpotSpeedMps: 2, technicalSkills: { bunting: 2 } } });
  expect(capped.diagnostics.buntTechnique!.maximumSurfaceSpeedMps).toBeLessThanOrEqual(2 + 1e-12);
  expect(capped.diagnostics.buntTechnique!.reachableTargetSweetSpot).not.toEqual(capped.diagnostics.buntTechnique!.desiredTargetSweetSpot);
  for (const batting of ['take', 'balanced', 'power', 'contact'] as const) {
    const other = { ...input, batting };
    expect(JSON.stringify(simulateLivePitchV1({ ...other, batter: { ...other.batter, technicalSkills: { bunting: 2 } } })))
      .toBe(JSON.stringify(simulateLivePitchV1(other)));
  }
});

it('uses low-zone technique only in low-target release command and never changes spin or release speed', () => {
  const input = { ...source(7), batting: 'take' as const, location: 'low', pitcher: { ...source().pitcher, commandStdMeters: .08 } },
    before = JSON.stringify(input), legacy = simulateLivePitchV1(input),
    skilled = simulateLivePitchV1({ ...input, pitcher: { ...input.pitcher, technicalSkills: { low_zone_command: 2 } } }),
    d = skilled.diagnostics.lowZoneCommandTechnique!, release = skilled.diagnostics.sourceDescriptor.initial.ball;
  expect(d.effectiveStandardDeviationMeters).toBe(input.pitcher.commandStdMeters / 2.2);
  expect(d.releaseVelocityOnly).toBe(true); expect(d.targetRegion).toBe('LOWER_THIRD_OR_BELOW');
  expect(release.position).toEqual(legacy.diagnostics.sourceDescriptor.initial.ball.position);
  expect(release.spin).toEqual(legacy.diagnostics.sourceDescriptor.initial.ball.spin);
  expect(norm(release.velocity)).toBeCloseTo(norm(legacy.diagnostics.sourceDescriptor.initial.ball.velocity), 12);
  expect(skilled.speedKmh).toBe(legacy.speedKmh);
  const kernel = createSourceFreeBallKernel(skilled.diagnostics.sourceDescriptor);
  for (const frame of skilled.frames.filter(f => skilled.diagnostics.catcherContactElapsedSeconds === null
    || f.elapsedSeconds < skilled.diagnostics.catcherContactElapsedSeconds)) expect(frame.ball.position)
    .toEqual(kernel.evaluateAt(frame.elapsedSeconds, 'incoming').moment.ball.position);
  const high = { ...input, location: 'high' };
  expect(JSON.stringify(simulateLivePitchV1({ ...high, pitcher: { ...high.pitcher, technicalSkills: { low_zone_command: 2 } } })))
    .toBe(JSON.stringify(simulateLivePitchV1(high)));
  expect(JSON.stringify(input)).toBe(before);
});

it('rejects unknown, nonfinite and out-of-range technical inputs atomically without reading accessors', () => {
  const input = source();
  for (const technicalSkills of [{ unknown: 1 }, { bunting: -.1 }, { bunting: 2.001 }, { low_zone_command: NaN }, { bunting: Infinity }, null]) {
    const raw = { ...input, batter: { ...input.batter, technicalSkills } } as unknown as LivePitchInputV1, before = structuredClone(raw);
    expect(() => simulateLivePitchV1(raw)).toThrow(); expect(raw).toEqual(before);
  }
  let reads = 0; const technicalSkills = {};
  Object.defineProperty(technicalSkills, 'bunting', { enumerable: true, get() { reads++; return 1; } });
  expect(() => simulateLivePitchV1({ ...input, batter: { ...input.batter, technicalSkills } })).toThrow(); expect(reads).toBe(0);
});
