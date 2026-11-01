import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createPitchBreakFeasibilityCasesV156, runPitchBreakFeasibilityV156, runPitchBreakFeasibilityStudyV156 } from '../../../tools/verification/pitch-break-feasibility-v156';
import { simulatePitcherWorkbenchV77 } from './PitcherWorkbenchV77';
import { createPitchSnapshotFromPresetV78 } from './LivePitchAuthoringV78';
import { setPitchMovementLevelV92 } from './PitchMovementV92';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_MOUND_SURFACE_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import type { LiveMeasuredClipV1, LivePitchInputV1 } from './LivePitchV1';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from '../../core/sim/ball/SourceFreeBallKernel';
import { calculateBaseballAerodynamics } from '../../core/sim/ball/BaseballAerodynamics';
import { resolveAerodynamicIntegrationStepTicksV1 } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle, rotateVectorByQuaternion } from '../../core/sim/pitching/BaseballOrientation';
import type { Vec3 } from '../../core/model/geometry';

const norm = (v:Vec3) => Math.hypot(v.x, v.y, v.z),
  dot = (one:Vec3, two:Vec3) => one.x * two.x + one.y * two.y + one.z * two.z,
  cross = (one:Vec3, two:Vec3):Vec3 => ({ x:one.y * two.z - one.z * two.y, y:one.z * two.x - one.x * two.z, z:one.x * two.y - one.y * two.x }),
  angle = (one:Vec3, two:Vec3) => Math.acos(Math.max(-1, Math.min(1, dot(one, two) / (norm(one) * norm(two)))));
let descriptor:SourceFreeBallDescriptorV2, before:SourceFreeBallDescriptorV2,
  generated:ReturnType<typeof createPitchBreakFeasibilityCasesV156>, publicPacket:Parameters<typeof simulatePitcherWorkbenchV77>[0];
beforeAll(() => {
  const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[],
    base:LivePitchInputV1 = { originTick:1_000_000, seed:3,
      batter:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters:1.8, bats:'R', timingStdSeconds:0, aimStdMeters:0 },
      pitcher:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters:0, heightMeters:1.9, moundPosition:LIVE_MATCH_MOUND_SURFACE_V1 },
      measuredClips:clips, batting:'take', pitchType:'curve', location:'zone', physics:LIVE_MATCH_PHYSICS_V1 },
    preset = createPitchSnapshotFromPresetV78({ presetId:'curve', pitchId:'public-feasibility-curve', physical:base.pitcher }),
    pitch = setPitchMovementLevelV92({ pitch:preset, level:4 }),
    observed = simulatePitcherWorkbenchV77({ pitch:{ ...base, pitchId:pitch.pitchId,
      pitcher:{ ...base.pitcher, pitchRepertoireV78:{ version:'pitch_repertoire_v78', pitches:[pitch] } } } });
  descriptor = structuredClone(observed.pitch.diagnostics.sourceDescriptor);before = structuredClone(descriptor);
  publicPacket = { pitch:structuredClone(observed.input), context:{ pitcherId:'public-pitcher', batterId:'public-batter' } };
  generated = createPitchBreakFeasibilityCasesV156(descriptor);
});
function expectFrozen(value:unknown):void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);Object.values(value).forEach(expectFrozen);
}
type Mutable<T> = T extends readonly (infer Item)[] ? Mutable<Item>[] : T extends object ? { -readonly [Key in keyof T]:Mutable<T[Key]> } : T;
const mutableCopy = (source:SourceFreeBallDescriptorV2) => structuredClone(source) as Mutable<SourceFreeBallDescriptorV2>;
const frozenTree = (value:unknown):boolean => value === null || typeof value !== 'object' || Object.isFrozen(value) && Object.values(value).every(frozenTree);

it('declares all sixteen independent controls on the reference seam-resolved integration clock', () => {
  expect(descriptor.materialOrientationAtStart).toBeDefined();
  expect(descriptor.profile.air.aerodynamics.seamForce!.coefficientScale).toBeGreaterThan(0);
  expect(descriptor.profile.air.aerodynamics.spinDecay).toBeDefined();
  const expectedStep = resolveAerodynamicIntegrationStepTicksV1(descriptor.initial.ball.spin, descriptor.profile.air);
  expect(generated.clock).toStrictEqual({ ticksPerSecond:descriptor.profile.air.ticksPerSecond,
    originalNominalStepTicks:descriptor.profile.air.integrationStepTicks, commonIntegrationStepTicks:expectedStep });
  expect(generated.cases).toHaveLength(16);expect(new Set(generated.cases.map(item => item.id)).size).toBe(16);
  const expected = new Set<string>();
  for (const axis of ['ORIGINAL', 'TOWARD_AIR_30_DEGREES']) for (const material of ['ORIGINAL', 'PHASE_90_DEGREES'])
    for (const seam of ['OFF', 'SAVED']) for (const decay of ['OFF', 'SAVED']) expected.add([axis, material, seam, decay].join('|'));
  expect(new Set(generated.cases.map(item => [item.factors.axis, item.factors.material, item.factors.seam, item.factors.decay].join('|')))).toStrictEqual(expected);
  for (const item of generated.cases) {
    expect(typeof item.id).toBe('string');expect(item.id.length).toBeGreaterThan(0);
    expect(Object.keys(item.factors).sort()).toEqual(['axis', 'decay', 'material', 'seam']);
    expect(item.descriptor.profile.air.integrationStepTicks).toBe(expectedStep);
    expect(resolveAerodynamicIntegrationStepTicksV1(item.descriptor.initial.ball.spin, item.descriptor.profile.air)).toBe(expectedStep);
  }
});

it('keeps release, time span, ground and air coefficients fixed while each factor changes only its declared control', () => {
  const initial = descriptor.initial.ball, air = descriptor.profile.air, originalAero = air.aerodynamics,
    relativeAir = { x:initial.velocity.x - originalAero.windVelocityMps.x, y:initial.velocity.y - originalAero.windVelocityMps.y,
      z:initial.velocity.z - originalAero.windVelocityMps.z }, rotationPlaneNormal = cross(initial.spin, relativeAir);
  for (const item of generated.cases) {
    const source = item.descriptor, factors = item.factors,
      { spinDecay:_savedDecay, ...withoutDecay } = originalAero,
      expectedAero = { ...withoutDecay, ...(factors.decay === 'SAVED' ? { spinDecay:originalAero.spinDecay } : {}),
        seamForce:factors.seam === 'SAVED' ? originalAero.seamForce : { ...originalAero.seamForce!, coefficientScale:0 } };
    expect(source.kind).toBe(descriptor.kind);expect(source.throughElapsedSeconds).toBe(descriptor.throughElapsedSeconds);
    expect(source.initial.originTick).toBe(descriptor.initial.originTick);expect(source.initial.elapsedSeconds).toBe(descriptor.initial.elapsedSeconds);
    expect(source.initial.ball.tick).toBe(initial.tick);expect(source.initial.ball.position).toStrictEqual(initial.position);
    expect(source.initial.ball.velocity).toStrictEqual(initial.velocity);
    expect(source.profile).toStrictEqual({ ...descriptor.profile,
      air:{ ...air, integrationStepTicks:generated.clock.commonIntegrationStepTicks, aerodynamics:expectedAero } });
    expect(Object.hasOwn(source.profile.air.aerodynamics, 'spinDecay')).toBe(factors.decay === 'SAVED');
    expect(norm(source.initial.ball.spin)).toBeCloseTo(norm(initial.spin), 12);
    if (factors.axis === 'ORIGINAL') expect(source.initial.ball.spin).toStrictEqual(initial.spin);
    else {
      expect(angle(initial.spin, source.initial.ball.spin)).toBeCloseTo(Math.PI / 6, 12);
      expect(angle(source.initial.ball.spin, relativeAir)).toBeCloseTo(angle(initial.spin, relativeAir) - Math.PI / 6, 12);
      expect(dot(source.initial.ball.spin, rotationPlaneNormal) / (norm(source.initial.ball.spin) * norm(rotationPlaneNormal))).toBeCloseTo(0, 12);
    }
    if (factors.material === 'ORIGINAL') expect(source.materialOrientationAtStart).toStrictEqual(descriptor.materialOrientationAtStart);
  }
});

it('left-multiplies a world ninety-degree phase about each case spin axis, including a nonidentity saved material basis', () => {
  // A nonidentity factory boundary fixture distinguishes world-left from body-right multiplication.
  // It does not run or select a new pitch or replace the public experiment base.
  const source = { ...structuredClone(descriptor), materialOrientationAtStart:quaternionFromAxisAngle({ x:0, y:1, z:0 }, .7) },
    saved = structuredClone(source), cases = createPitchBreakFeasibilityCasesV156(source).cases;
  for (const item of cases) {
    const actual = item.descriptor.materialOrientationAtStart!;
    if (item.factors.material === 'ORIGINAL') { expect(actual).toStrictEqual(source.materialOrientationAtStart);continue; }
    const expected = normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle(item.descriptor.initial.ball.spin, Math.PI / 2), source.materialOrientationAtStart));
    expect(Math.hypot(actual.w, actual.x, actual.y, actual.z)).toBeCloseTo(1, 12);
    for (const basis of [{ x:1, y:0, z:0 }, { x:0, y:1, z:0 }, { x:0, y:0, z:1 }]) {
      const got = rotateVectorByQuaternion(basis, actual), wanted = rotateVectorByQuaternion(basis, expected);
      for (const axis of ['x', 'y', 'z'] as const) expect(got[axis]).toBeCloseTo(wanted[axis], 12);
    }
  }
  expect(source).toStrictEqual(saved);expect(Object.isFrozen(source.materialOrientationAtStart)).toBe(false);
});

it('owns frozen case copies without freezing caller data and rejects missing controls or undefined spin-plane axes', () => {
  expectFrozen(generated);expect(descriptor).toStrictEqual(before);
  expect(Object.isFrozen(descriptor)).toBe(false);expect(Object.isFrozen(descriptor.initial.ball.position)).toBe(false);
  const noMaterial = mutableCopy(descriptor), noSeam = mutableCopy(descriptor), noDecay = mutableCopy(descriptor),
    zeroSpin = mutableCopy(descriptor), parallel = mutableCopy(descriptor), antiparallel = mutableCopy(descriptor),
    velocity = descriptor.initial.ball.velocity, wind = descriptor.profile.air.aerodynamics.windVelocityMps,
    relative = { x:velocity.x - wind.x, y:velocity.y - wind.y, z:velocity.z - wind.z }, scale = norm(descriptor.initial.ball.spin) / norm(relative);
  delete noMaterial.materialOrientationAtStart;delete noSeam.profile.air.aerodynamics.seamForce;delete noDecay.profile.air.aerodynamics.spinDecay;
  zeroSpin.initial.ball.spin = { x:0, y:0, z:0 };
  parallel.initial.ball.spin = { x:relative.x * scale, y:relative.y * scale, z:relative.z * scale };
  antiparallel.initial.ball.spin = { x:-relative.x * scale, y:-relative.y * scale, z:-relative.z * scale };
  for (const invalid of [noMaterial, noSeam, noDecay, zeroSpin, parallel, antiparallel]) {
    const unchanged = structuredClone(invalid);expect(() => createPitchBreakFeasibilityCasesV156(invalid)).toThrow();
    expect(invalid).toStrictEqual(unchanged);
  }
  expect(descriptor).toStrictEqual(before);
});

it('runs all cases against the shared reference clock and compares all one hundred twenty pairs', () => {
  const unchanged = structuredClone(publicPacket), run = runPitchBreakFeasibilityV156(publicPacket, { observationIntervals:160, refinementFactor:1 }),
    reference = run.reference, initial = reference.sourceDescriptor.initial.ball, end = reference.referenceElapsedSeconds,
    gravity = reference.sourceDescriptor.profile.air.gravityY;
  expect(run.options).toEqual({ observationIntervals:160, refinementFactor:1 });
  expect(reference.input).toStrictEqual(publicPacket.pitch);expect(reference.context).toStrictEqual(publicPacket.context);
  expect(reference.sourceDescriptor).toStrictEqual(descriptor);expect(run.clock).toStrictEqual(generated.clock);
  expect(end).toBeGreaterThan(0);
  expect(createSourceFreeBallKernel(reference.sourceDescriptor).evaluateAt(end).moment.ball.position.z).toBeCloseTo(reference.measurementPlaneZ, 8);
  expect(run.cases).toHaveLength(16);expect(run.pairAnalysis.pairs).toHaveLength(120);
  const sharedBaseline = run.cases[0].observation.timingAtReference.raw.map(row => row.baseline);
  for (const item of run.cases) {
    const expectedCase = generated.cases.find(candidate => candidate.id === item.id)!;
    expect(item.descriptor).toStrictEqual(expectedCase.descriptor);expect(item.factors).toStrictEqual(expectedCase.factors);
    expect(item.effectiveIntegrationStepTicks).toBe(run.clock.commonIntegrationStepTicks);
    const kernel = createSourceFreeBallKernel(item.descriptor), observation = item.observation, timing = observation.timingAtReference;
    expect(observation.sourceSamples).toHaveLength(161);expect(observation.forceSeries).toHaveLength(161);expect(timing.raw).toHaveLength(161);
    expect(timing.raw.map(row => row.baseline)).toStrictEqual(sharedBaseline);
    for (const [index, sample] of observation.sourceSamples.entries()) {
      const state = kernel.evaluateAt(sample.elapsedSeconds), row = timing.raw[index];
      expect(sample.elapsedSeconds).toBe(row.elapsedSeconds);expect(sample.elapsedSeconds).toBe(observation.forceSeries[index].elapsedSeconds);
      expect(sample.elapsedSeconds).toBeCloseTo(end * index / 160, 14);
      expect(sample.position).toStrictEqual(state.moment.ball.position);expect(sample.velocity).toStrictEqual(state.moment.ball.velocity);
      expect(sample.spin).toStrictEqual(state.moment.ball.spin);expect(sample.orientation).toStrictEqual(state.materialOrientation ?? state.orientation);
      expect(sample.phase).toBe(state.phase);expect(row.actual.position).toStrictEqual(sample.position);expect(row.actual.velocity).toStrictEqual(sample.velocity);
      const time = sample.elapsedSeconds, expectedPosition = { x:initial.position.x + initial.velocity.x * time,
        y:initial.position.y + initial.velocity.y * time + gravity * time * time / 2, z:initial.position.z + initial.velocity.z * time },
        expectedVelocity = { ...initial.velocity, y:initial.velocity.y + gravity * time };
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(row.baseline.position[axis]).toBeCloseTo(expectedPosition[axis], 12);
        expect(row.baseline.velocity[axis]).toBeCloseTo(expectedVelocity[axis], 12);
      }
      if (sample.phase !== 'airborne') expect(observation.forceSeries[index]).toMatchObject({ force:null, projected:null });
    }
    const groundEvents = kernel.boundaries.filter(boundary => boundary.kind === 'ground' && boundary.elapsedSeconds <= end).map(boundary => boundary.elapsedSeconds);
    expect(timing.groundClassification.actualGroundEventSeconds).toStrictEqual(groundEvents);
    expect(timing.groundClassification.baselineGroundEventSeconds).toEqual([]);
    if (groundEvents.length) {
      expect(timing.status).toBe('UNCLASSIFIED');expect(timing.percentTimes).toEqual({ p10:null, p50:null, p90:null });
    }
    for (const index of [0, 80, 160]) {
      const sample = observation.sourceSamples[index], row = observation.forceSeries[index];if (sample.phase !== 'airborne') continue;
      const air = item.descriptor.profile.air, expected = calculateBaseballAerodynamics(sample.velocity, sample.spin, air.aerodynamics, sample.orientation);
      expect(row.force).toMatchObject({ dragAcceleration:expected.dragAcceleration, liftAcceleration:expected.liftAcceleration,
        seamAcceleration:expected.seamAcceleration ?? { x:0, y:0, z:0 }, totalAirAcceleration:expected.totalAcceleration,
        gravityAcceleration:{ x:0, y:air.gravityY, z:0 }, totalFreeFlightAcceleration:{ ...expected.totalAcceleration, y:expected.totalAcceleration.y + air.gravityY } });
      const direction = timing.finalXY.direction;
      if (direction === null) expect(row.projected).toBeNull();
      else {
        const project = (vector:Vec3) => vector.x * direction.x + vector.y * direction.y;
        expect(row.projected!.drag).toBeCloseTo(project(expected.dragAcceleration), 12);
        expect(row.projected!.lift).toBeCloseTo(project(expected.liftAcceleration), 12);
        expect(row.projected!.seam).toBeCloseTo(project(expected.seamAcceleration ?? { x:0, y:0, z:0 }), 12);
        expect(row.projected!.totalAir).toBeCloseTo(project(expected.totalAcceleration), 12);
      }
    }
  }
  const byId = new Map(run.cases.map(item => [item.id, item] as const)), uniquePairs = new Set<string>();
  for (const pair of run.pairAnalysis.pairs) {
    expect(pair.caseAId).not.toBe(pair.caseBId);const a = byId.get(pair.caseAId), b = byId.get(pair.caseBId);
    expect(a).toBeDefined();expect(b).toBeDefined();if (!a || !b) throw Error('pair names a missing case');
    uniquePairs.add(JSON.stringify([pair.caseAId, pair.caseBId].sort()));
    if (a.observation.timingAtReference.status !== 'CLASSIFIED' || b.observation.timingAtReference.status !== 'CLASSIFIED' ||
      a.observation.ownPlate.status !== 'MEASURED' || b.observation.ownPlate.status !== 'MEASURED' ||
      a.observation.ownPlate.timingAtOwnPlate.status !== 'CLASSIFIED' || b.observation.ownPlate.timingAtOwnPlate.status !== 'CLASSIFIED') {
      expect(pair.eligible).toBe(false);expect(pair.matchedAmountAndDirection).toBe(false);expect(pair.timeShapeCandidate).toBe(false);
    }
    if (pair.matchedAmountAndDirection) {
      expect(pair.eligible).toBe(true);expect(pair.commonTimeDirectionDifferenceDegrees).not.toBeNull();expect(pair.samePlaneDirectionDifferenceDegrees).not.toBeNull();
      expect(pair.commonTimeDirectionDifferenceDegrees!).toBeLessThanOrEqual(5 + 1e-12);
      expect(pair.samePlaneDirectionDifferenceDegrees!).toBeLessThanOrEqual(5 + 1e-12);
    }
    if (pair.timeShapeCandidate) {
      expect(pair.eligible && pair.matchedAmountAndDirection).toBe(true);
      expect(pair.p50FractionDifference).not.toBeNull();expect(pair.late20FractionDifference).not.toBeNull();
      expect(Math.abs(pair.p50FractionDifference!) >= .05 || Math.abs(pair.late20FractionDifference!) >= .05).toBe(true);
    }
  }
  expect(uniquePairs.size).toBe(120);expect(frozenTree(run)).toBe(true);
  expect(publicPacket).toStrictEqual(unchanged);expect(Object.isFrozen(publicPacket.pitch)).toBe(false);
}, 60_000);

it('separates observation density from half-step physical refinement and reproduces the JSON nominal run', () => {
  const unchanged = structuredClone(publicPacket), study = runPitchBreakFeasibilityStudyV156(publicPacket),
    nominalStep = generated.clock.commonIntegrationStepTicks;
  expect(study.nominal.options).toEqual({ observationIntervals:160, refinementFactor:1 });
  expect(study.observationDense.options).toEqual({ observationIntervals:640, refinementFactor:1 });
  expect(study.physicalHalfStep.options).toEqual({ observationIntervals:640, refinementFactor:2 });
  expect(study.observationDense.reference).toStrictEqual(study.nominal.reference);
  expect(study.physicalHalfStep.reference).toStrictEqual(study.nominal.reference);
  expect(study.nominal.clock.commonIntegrationStepTicks).toBe(nominalStep);
  expect(study.observationDense.clock.commonIntegrationStepTicks).toBe(nominalStep);
  expect(study.physicalHalfStep.clock.commonIntegrationStepTicks).toBe(Math.max(1, Math.floor(nominalStep / 2)));
  const halfCases = createPitchBreakFeasibilityCasesV156(descriptor, 2).cases;
  for (const [index, nominal] of study.nominal.cases.entries()) {
    const dense = study.observationDense.cases[index], half = study.physicalHalfStep.cases[index];
    expect(dense.id).toBe(nominal.id);expect(half.id).toBe(nominal.id);
    expect(dense.descriptor).toStrictEqual(nominal.descriptor);expect(half.descriptor).toStrictEqual(halfCases[index].descriptor);
    expect(nominal.observation.sourceSamples).toHaveLength(161);expect(dense.observation.sourceSamples).toHaveLength(641);
    expect(half.observation.sourceSamples).toHaveLength(641);
    for (const coarseIndex of [0, 80, 160]) expect(dense.observation.sourceSamples[coarseIndex * 4]).toStrictEqual(nominal.observation.sourceSamples[coarseIndex]);
  }
  expect(study.nominal.pairAnalysis.pairs).toHaveLength(120);expect(study.observationDense.pairAnalysis.pairs).toHaveLength(120);
  expect(study.physicalHalfStep.pairAnalysis.pairs).toHaveLength(120);expect(study.summary).toBeDefined();
  const saved = JSON.parse(JSON.stringify(publicPacket)), savedBefore = structuredClone(saved),
    replay = runPitchBreakFeasibilityV156(saved, { observationIntervals:160, refinementFactor:1 });
  expect(replay).toStrictEqual(study.nominal);expect(saved).toStrictEqual(savedBefore);
  expect(publicPacket).toStrictEqual(unchanged);expect(frozenTree(study)).toBe(true);
}, 120_000);
