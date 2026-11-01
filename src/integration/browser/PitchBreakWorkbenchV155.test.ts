import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { simulatePitcherWorkbenchV77, observeReleasedPitchWorkbenchV155 } from './PitcherWorkbenchV77';
import { observePitchBreakWorkbenchV155 } from './PitchBreakWorkbenchV155';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_MOUND_SURFACE_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { createPitchSnapshotFromPresetV78 } from './LivePitchAuthoringV78';
import { calculateBaseballAerodynamics } from '../../core/sim/ball/BaseballAerodynamics';
import type { Vec3 } from '../../core/model/geometry';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from '../../core/sim/ball/SourceFreeBallKernel';

const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
// Same public seed and Source controls as the existing PitcherWorkbenchV77 tests.
const fixture = ():LivePitchInputV1 => ({ originTick:1_000_000, seed:3,
  batter:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters:1.8, bats:'R' },
  pitcher:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters:0, heightMeters:1.9, moundPosition:LIVE_MATCH_MOUND_SURFACE_V1 },
  measuredClips:clips, batting:'take', pitchType:'fastball', location:'zone', physics:LIVE_MATCH_PHYSICS_V1 });
type Workbench = ReturnType<typeof simulatePitcherWorkbenchV77>;
const packet = { pitch:fixture(), context:{ pitcherId:'public-pitcher', batterId:'public-batter' } }, before = structuredClone(packet);
let result:Workbench;
beforeAll(() => { result = simulatePitcherWorkbenchV77(packet); });
it('accepts omitted optional ground history for a direct read-only observer call', () => {
  const observation=result.metrics.breakTimingV155,
    direct=observePitchBreakWorkbenchV155({throughElapsedSeconds:result.metrics.flightSeconds,measurementPlaneZ:result.metrics.measurementPlaneZ,
      air:result.pitch.diagnostics.sourceDescriptor.profile.air,actualSample:result.sampleAtPitchElapsedSeconds,
      baselineSample:result.sampleBaselineAtPitchElapsedSeconds,
      samePlane:{actual:observation.samePlane.actual,zeroSpin:observation.samePlane.zeroSpin},commandObservation:observation.releaseCommand});
  expect(direct.commonTime.zeroSpinOriginalAir.groundClassification.actualGroundEventSeconds).toEqual([]);
  expect(direct.commonTime.zeroSpinOriginalAir.groundClassification.baselineGroundEventSeconds).toEqual([]);
});
const closeVector = (actual:Vec3, expected:Vec3) => {
  for (const axis of ['x', 'y', 'z'] as const) expect(actual[axis]).toBeCloseTo(expected[axis], 12);
};
function exactDigest(value:unknown):string {
  const hash = createHash('sha256');
  function visit(item:unknown):void {
    if (item === null || typeof item !== 'object') {
      if (['function', 'symbol', 'bigint'].includes(typeof item)) throw Error('non-record test value');
      hash.update(JSON.stringify([typeof item, typeof item === 'number' ? Object.is(item, -0) ? '-0' : String(item) : item]));return;
    }
    hash.update(Array.isArray(item) ? '[' : '{');
    for (const [key, child] of Object.entries(item)) { hash.update(JSON.stringify(key));visit(child); }
    hash.update(Array.isArray(item) ? ']' : '}');
  }
  visit(value);return hash.digest('hex');
}
function expectFrozen(value:unknown):void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);Object.values(value).forEach(expectFrozen);
}

it('retains all previous same-plane metrics, the actual live Source and the original caller input', () => {
  const { breakTimingV155:_newObservation, ...legacyMetrics } = result.metrics,
    live = simulateLivePitchV1(packet.pitch), { sampleBatAtTick:_liveSampler, ...liveData } = live,
    { sampleBatAtTick:_workbenchSampler, ...workbenchPitchData } = result.pitch,
    { pitchCommandObservationV155:_readOnlyCommand, ...physicalDiagnostics } = workbenchPitchData.diagnostics;
  expect(exactDigest(legacyMetrics)).toBe('9509c8ac5888cb59a745214efb44d31e9d684a8164a661a959ecf030a1166d83');
  expect(Object.hasOwn(live.diagnostics, 'pitchCommandObservationV155')).toBe(false);
  expect({ ...workbenchPitchData, diagnostics:physicalDiagnostics }).toStrictEqual(liveData);
  expect(result.fixedInitial).toStrictEqual(live.diagnostics.sourceDescriptor.initial.ball);
  expect(packet).toStrictEqual(before);expect(Object.isFrozen(packet.pitch)).toBe(false);
});

it('reports 161 actual Source observations on one shared clock and preserves the independent same-plane comparison', () => {
  const observation = result.metrics.breakTimingV155!;
  expect(observation).toMatchObject({ version:'pitch_break_workbench_v155', sampleCount:161 });
  expect(observation.sampleIntervalSeconds).toBe(result.metrics.flightSeconds / 160);
  expect(observation.forceSeries).toHaveLength(161);
  const comparisons = Object.values(observation.commonTime);
  expect(comparisons).toHaveLength(3);expect(new Set(comparisons.map(item => item.comparisonBasis)).size).toBe(3);
  for (const comparison of comparisons) {
    expect(comparison.timeAlignment).toBe('COMMON_ELAPSED_TIME');expect(comparison.raw).toHaveLength(161);
    expect(comparison.intervalAverageAcceleration).toHaveLength(160);
    expect(comparison.raw[0].actual.position).toStrictEqual(result.fixedInitial.position);
    expect(comparison.raw[0].actual.velocity).toStrictEqual(result.fixedInitial.velocity);
    expect(comparison.raw[0].baseline.position).toStrictEqual(result.fixedInitial.position);
    expect(comparison.raw[0].baseline.velocity).toStrictEqual(result.fixedInitial.velocity);
    for (const [index, row] of comparison.raw.entries()) {
      expect(row.elapsedSeconds).toBe(row.actual.elapsedSeconds);expect(row.elapsedSeconds).toBe(row.baseline.elapsedSeconds);
      expect(row.elapsedSeconds).toBe(observation.forceSeries[index].elapsedSeconds);
      const actual = result.sampleAtPitchElapsedSeconds(row.elapsedSeconds)!;
      expect(row.actual.position).toStrictEqual(actual.position);expect(row.actual.velocity).toStrictEqual(actual.velocity);
      expect(row.actual.phase).toBe(actual.phase);
    }
    expect(comparison.raw.at(-1)!.elapsedSeconds).toBe(result.metrics.flightSeconds);
    expect(comparison.raw.at(-1)!.actual.position).toStrictEqual(result.metrics.platePosition);
  }
  const samePlane = observation.samePlane;
  expect(samePlane.basis).toBe('EACH_TRAJECTORY_AT_SAME_Z');expect(samePlane.planeZ).toBe(result.metrics.measurementPlaneZ);
  expect(samePlane.actual).toEqual({ elapsedSeconds:result.metrics.flightSeconds, position:result.metrics.platePosition });
  expect(samePlane.zeroSpin.position).toStrictEqual(result.metrics.baselinePlatePosition);
  expect(samePlane.zeroSpin.groundIgnored).toBe(result.metrics.baselineGroundIgnored);
  expect(result.sampleBaselineAtPitchElapsedSeconds(samePlane.zeroSpin.elapsedSeconds)!.position).toStrictEqual(samePlane.zeroSpin.position);
  expect(samePlane.actual.position.z).toBeCloseTo(samePlane.planeZ, 8);
  expect(samePlane.zeroSpin.position.z).toBeCloseTo(samePlane.planeZ, 8);
  expect(result.metrics.horizontalBreakCm).toBe((samePlane.actual.position.x - samePlane.zeroSpin.position.x) * 100);
  expect(result.metrics.verticalBreakCm).toBe((samePlane.actual.position.y - samePlane.zeroSpin.position.y) * 100);
});

it('separates original-air zero spin, airless gravity and the release tangent using identical release position and velocity', () => {
  const observation = result.metrics.breakTimingV155!, common = observation.commonTime,
    gravity = result.pitch.diagnostics.sourceDescriptor.profile.air.gravityY, initial = result.fixedInitial;
  for (const [index, row] of common.airlessGravity.raw.entries()) {
    const time = row.elapsedSeconds, tangent = common.releaseTangent.raw[index].baseline;
    closeVector(tangent.position, { x:initial.position.x + initial.velocity.x * time,
      y:initial.position.y + initial.velocity.y * time, z:initial.position.z + initial.velocity.z * time });
    closeVector(tangent.velocity, initial.velocity);
    closeVector(row.baseline.position, { ...tangent.position, y:tangent.position.y + .5 * gravity * time * time });
    closeVector(row.baseline.velocity, { ...initial.velocity, y:initial.velocity.y + gravity * time });
    const zeroSpin = result.sampleBaselineAtPitchElapsedSeconds(time)!;
    expect(common.zeroSpinOriginalAir.raw[index].baseline.position).toStrictEqual(zeroSpin.position);
    expect(common.zeroSpinOriginalAir.raw[index].baseline.velocity).toStrictEqual(zeroSpin.velocity);
    expect(common.zeroSpinOriginalAir.raw[index].baseline.counterfactualGroundIgnored).toBe(zeroSpin.counterfactualGroundIgnored);
  }
  expect(common.zeroSpinOriginalAir.groundClassification.baselineVirtualAirOnly).toBe(result.metrics.baselineGroundIgnored);
  expect(common.zeroSpinOriginalAir.groundClassification.samePhysicalBallClaim).toBe(false);
  // Drag remains in the zero-spin/original-air comparison and does not become gravity.
  expect(common.zeroSpinOriginalAir.raw.at(-1)!.baseline.position.z - common.airlessGravity.raw.at(-1)!.baseline.position.z).toBeGreaterThan(.1);
  expect(common.airlessGravity.raw.at(-1)!.baseline.position.z).toBe(common.releaseTangent.raw.at(-1)!.baseline.position.z);
  expect(observation.releaseCommand.initialPosition).toStrictEqual(initial.position);
  expect(observation.releaseCommand.initialVelocity).toStrictEqual(initial.velocity);
  expect(observation.releaseCommand.yawDegrees).toBeCloseTo(Math.atan2(initial.velocity.x, -initial.velocity.z) * 180 / Math.PI, 12);
  expect(observation.releaseCommand.elevationDegrees).toBeCloseTo(Math.atan2(initial.velocity.y, Math.hypot(initial.velocity.x, initial.velocity.z)) * 180 / Math.PI, 12);
});

it('reports instantaneous air-force components from the same actual and zero-spin Source states, separately from gravity', () => {
  const base = fixture(), snapshot = createPitchSnapshotFromPresetV78({ presetId:'curve', pitchId:'curve-quality', physical:base.pitcher }),
    seamResult = simulatePitcherWorkbenchV77({ pitch:{ ...base, pitchType:'curve', pitchId:snapshot.pitchId,
      pitcher:{ ...base.pitcher, pitchRepertoireV78:{ version:'pitch_repertoire_v78', pitches:[snapshot] } } } }),
    descriptor = seamResult.pitch.diagnostics.sourceDescriptor, observation = seamResult.metrics.breakTimingV155!;
  expect(descriptor.profile.air.aerodynamics.seamForce!.coefficientScale).toBe(1);
  expect(observation.forceSeries).toHaveLength(161);
  for (const row of observation.forceSeries) for (const which of ['actual', 'zeroSpinOriginalAir'] as const) {
    const state = which === 'actual' ? seamResult.sampleAtPitchElapsedSeconds(row.elapsedSeconds)!
      : seamResult.sampleBaselineAtPitchElapsedSeconds(row.elapsedSeconds)!, force = row[which];
    if (state.phase !== 'airborne') { expect(force).toBeNull();continue; }
    const expected = calculateBaseballAerodynamics(state.velocity, state.spin, descriptor.profile.air.aerodynamics, state.orientation);
    expect(force!.dragAcceleration).toStrictEqual(expected.dragAcceleration);
    expect(force!.liftAcceleration).toStrictEqual(expected.liftAcceleration);
    expect(force!.seamAcceleration).toStrictEqual(expected.seamAcceleration ?? { x:0, y:0, z:0 });
    expect(force!.totalAirAcceleration).toStrictEqual(expected.totalAcceleration);
    expect(force!.gravityAcceleration).toStrictEqual({ x:0, y:descriptor.profile.air.gravityY, z:0 });
    expect(force!.totalFreeFlightAcceleration).toStrictEqual({ ...expected.totalAcceleration,
      y:expected.totalAcceleration.y + descriptor.profile.air.gravityY });
  }
});

it('saves input and context to JSON and reproduces the same V155 metrics without mutating saved legacy data', () => {
  const { breakTimingV155:_newObservation, ...legacyMetrics } = result.metrics,
    saved = JSON.parse(JSON.stringify({ input:result.input, context:result.context, metrics:legacyMetrics })), savedBefore = structuredClone(saved),
    restored = simulatePitcherWorkbenchV77({ pitch:saved.input, context:saved.context });
  expect(restored.metrics.breakTimingV155!.version).toBe('pitch_break_workbench_v155');
  expect(restored.metrics).toStrictEqual(result.metrics);expect(restored.context).toStrictEqual(result.context);
  expect(Object.hasOwn(saved.metrics, 'breakTimingV155')).toBe(false);expect(saved).toStrictEqual(savedBefore);
  expectFrozen(restored.metrics.breakTimingV155);expect(packet).toStrictEqual(before);
});

it('retains actual kernel ground history even when every regular observation samples an airborne rebound', () => {
  const position = { x:0, y:.2, z:3 }, velocity = { x:0, y:-3, z:-30 },
    descriptor:SourceFreeBallDescriptorV2 = { ...result.pitch.diagnostics.sourceDescriptor, throughElapsedSeconds:.5,
      initial:{ originTick:1_000_000, elapsedSeconds:0,
        ball:{ tick:1_000_000, position, velocity, spin:{ x:200, y:0, z:0 } } } },
    original = structuredClone(descriptor), command = result.metrics.breakTimingV155.releaseCommand,
    observed = observeReleasedPitchWorkbenchV155({ descriptor, battingSetupV94:result.pitch.diagnostics.battingSetupV94,
      releaseSpeedKmh:Math.hypot(velocity.x, velocity.y, velocity.z) * 3.6, releaseMode:'FIXED_RELEASE',
      commandObservation:{ requestedTarget:command.requestedTarget, selectedTarget:command.selectedTarget, commandedTarget:command.commandedTarget,
        nominalReleaseVelocity:velocity, executedReleaseVelocity:velocity,
        inverseCompensationBasis:'EXPLICIT_RELEASE_GROUND_HISTORY_REGRESSION', postReleaseExecutionReaimed:false } }),
    actualKernel = createSourceFreeBallKernel(descriptor), baselineKernel = createSourceFreeBallKernel(observed.baselineDescriptor),
    events = (kernel:ReturnType<typeof createSourceFreeBallKernel>) => kernel.boundaries.filter(boundary => boundary.kind === 'ground'
      && boundary.elapsedSeconds <= observed.metrics.flightSeconds).map(boundary => boundary.elapsedSeconds),
    actualEvents = events(actualKernel), baselineEvents = events(baselineKernel), breakTiming = observed.metrics.breakTimingV155;
  expect(actualEvents.length).toBeGreaterThan(0);expect(baselineEvents.length).toBeGreaterThan(0);
  expect(observed.metrics.baselineGroundIgnored).toBe(false);expect(breakTiming.sampleCount).toBe(161);
  for (const [basis, timing] of Object.entries(breakTiming.commonTime)) {
    // The narrow ground collision lies between the regular samples. Their phase
    // labels alone cannot establish that this was a free-air flight throughout.
    expect(timing.raw).toHaveLength(161);expect(timing.raw.every(row => row.actual.phase === 'airborne')).toBe(true);
    expect(timing.raw.every(row => row.baseline.phase === 'airborne')).toBe(true);
    expect(timing.status).toBe('UNCLASSIFIED');expect(timing.percentTimes).toEqual({ p10:null, p50:null, p90:null });
    expect(timing.late20Percent.projectedFraction).toBeNull();
    expect(timing.groundClassification.actualGroundObserved).toBe(true);
    expect(timing.groundClassification.actualGroundEventSeconds).toStrictEqual(actualEvents);
    expect(timing.groundClassification.baselineGroundEventSeconds).toStrictEqual(basis === 'zeroSpinOriginalAir' ? baselineEvents : []);
  }
  expect(descriptor).toStrictEqual(original);expect(packet).toStrictEqual(before);expectFrozen(breakTiming);
});
