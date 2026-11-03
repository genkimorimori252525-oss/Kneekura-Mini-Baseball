import { readFileSync } from 'node:fs';
import { beforeAll, expect, it, vi } from 'vitest';
import { comparePitchReleaseV155 } from './PitchReleaseComparisonV155';
import * as workbench from './PitcherWorkbenchV77';
import { createPitchSnapshotFromPresetV78 } from './LivePitchAuthoringV78';
import { setPitchMovementLevelV92 } from './PitchMovementV92';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_MOUND_SURFACE_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import type { LiveMeasuredClipV1, LivePitchInputV1 } from './LivePitchV1';
import { createSourceFreeBallKernel, type SourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import type { Vec3 } from '../../core/model/geometry';

const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const base:LivePitchInputV1 = { originTick:1_000_000, seed:3,
  batter:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters:1.8, bats:'R', timingStdSeconds:0, aimStdMeters:0 },
  pitcher:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters:0, heightMeters:1.9, moundPosition:LIVE_MATCH_MOUND_SURFACE_V1 },
  measuredClips:clips, batting:'take', pitchType:'curve', location:'zone', physics:LIVE_MATCH_PHYSICS_V1 },
  preset = createPitchSnapshotFromPresetV78({ presetId:'curve', pitchId:'paired-curve', physical:base.pitcher });
const trial = (level:1|7) => {
  const pitch = setPitchMovementLevelV92({ pitch:preset, level });
  return { pitch:{ ...base, pitchId:pitch.pitchId,
    pitcher:{ ...base.pitcher, pitchRepertoireV78:{ version:'pitch_repertoire_v78' as const, pitches:[pitch] } } },
  context:{ pitcherId:'public-pitcher', batterId:'public-batter' } };
};
const pair = { reference:trial(1), variant:trial(7) }, before = structuredClone(pair);
type Comparison = ReturnType<typeof comparePitchReleaseV155>;
let result:Comparison, ordinaryCalls:unknown[];
beforeAll(() => {
  const spy = vi.spyOn(workbench, 'simulatePitcherWorkbenchV77');
  try { result = comparePitchReleaseV155(pair);ordinaryCalls = spy.mock.calls.map(([input]) => input); }
  finally { spy.mockRestore(); }
});
const difference = (one:Vec3, two:Vec3):Vec3 => ({ x:one.x - two.x, y:one.y - two.y, z:one.z - two.z });
const magnitude = (value:Vec3) => Math.hypot(value.x, value.y, value.z);
function measured() {
  const fixed = result.variantFixedRelease;
  expect(fixed.status).toBe('MEASURED');
  if (fixed.status !== 'MEASURED') throw Error('prescribed public fixed-release comparison is unsupported; no replacement seed was selected');
  return fixed;
}
function planeTime(kernel:SourceFreeBallKernel, planeZ:number):number|null {
  for (const cell of kernel.cells) {
    if (kernel.evaluateAt(cell.fromElapsedSeconds).moment.ball.position.z < planeZ ||
      kernel.evaluateAt(cell.throughElapsedSeconds).moment.ball.position.z > planeZ) continue;
    let from = cell.fromElapsedSeconds, through = cell.throughElapsedSeconds;
    for (let index = 0; index < 60 && through - from > 1e-12; index++) {
      const at = (from + through) / 2;if (kernel.evaluateAt(at).moment.ball.position.z <= planeZ) through = at;else from = at;
    }
    return through;
  }
  return null;
}
function expectFrozen(value:unknown):void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);Object.values(value).forEach(expectFrozen);
}

it('runs each ordinary same-target trial once and retains distinct inverse-compensated release velocities', () => {
  expect(result).toMatchObject({ version:'pitch_release_comparison_v155', authority:'SHARED_SOURCE_COUNTERFACTUAL_OBSERVATION',
    nativeAdmission:false, officialResult:null });
  expect(ordinaryCalls).toHaveLength(2);expect(ordinaryCalls).toEqual(expect.arrayContaining([pair.reference, pair.variant]));
  const reference = result.reference, variant = result.variant,
    referenceCommand = reference.metrics.breakTimingV155.releaseCommand, variantCommand = variant.metrics.breakTimingV155.releaseCommand;
  expect(variantCommand.commandedTarget).toStrictEqual(referenceCommand.commandedTarget);
  expect(reference.fixedInitial.position).toStrictEqual(variant.fixedInitial.position);
  expect(magnitude(difference(variant.fixedInitial.velocity, reference.fixedInitial.velocity))).toBeGreaterThan(.1);
  for (const command of [referenceCommand, variantCommand]) expect(command).toMatchObject({ sameTargetTrial:true, fixedReleaseCounterfactual:false });
  expect(reference.fixedInitial.spin).not.toStrictEqual(variant.fixedInitial.spin);
  expect(pair).toStrictEqual(before);
});

it('uses reference position and velocity with variant spin, material and air in a canonical counterfactual Source', () => {
  const fixed = measured(), reference = result.reference, variantDescriptor = result.variant.pitch.diagnostics.sourceDescriptor,
    initial = fixed.descriptor.initial.ball, kernel = createSourceFreeBallKernel(fixed.descriptor),
    elapsedSeconds = planeTime(kernel, fixed.metrics.measurementPlaneZ);
  expect(initial.position).toStrictEqual(reference.fixedInitial.position);expect(initial.velocity).toStrictEqual(reference.fixedInitial.velocity);
  expect(initial.spin).toStrictEqual(result.variant.fixedInitial.spin);
  expect(fixed.descriptor.profile).toStrictEqual(variantDescriptor.profile);
  expect(fixed.descriptor.materialOrientationAtStart).toStrictEqual(variantDescriptor.materialOrientationAtStart);
  expect(elapsedSeconds).not.toBeNull();expect(fixed.metrics.flightSeconds).toBeCloseTo(elapsedSeconds!, 12);
  const atPlane = kernel.evaluateAt(elapsedSeconds!).moment.ball;
  expect(fixed.metrics.platePosition).toStrictEqual(atPlane.position);
  expect(atPlane.position.z).toBeCloseTo(fixed.metrics.measurementPlaneZ, 8);
  expect(fixed.sampleAtPitchElapsedSeconds(elapsedSeconds!)!.position).toStrictEqual(atPlane.position);
  expect(fixed.sampleAtPitchElapsedSeconds(0)!.velocity).toStrictEqual(reference.fixedInitial.velocity);
  expect(fixed.metrics.breakTimingV155.releaseCommand).toMatchObject({ initialPosition:reference.fixedInitial.position,
    initialVelocity:reference.fixedInitial.velocity, sameTargetTrial:false, fixedReleaseCounterfactual:true });
});

it('keeps compensated-target and fixed-release arrival differences separate without changing the caller or granting result authority', () => {
  const fixed = measured(), compensated = difference(result.variant.metrics.platePosition, result.reference.metrics.platePosition),
    fixedRelease = difference(fixed.metrics.platePosition, result.reference.metrics.platePosition);
  expect(magnitude(compensated)).toBeLessThan(.1);
  expect(magnitude(fixedRelease)).toBeGreaterThan(magnitude(compensated) + .1);
  expect(fixedRelease).not.toStrictEqual(compensated);
  expect(result.reference.metrics.breakTimingV155.observationsChangeExecution).toBe(false);
  expect(result.variant.metrics.breakTimingV155.observationsChangeExecution).toBe(false);
  expect(fixed.metrics.breakTimingV155.observationsChangeExecution).toBe(false);
  expect(result.officialResult).toBeNull();expect(result.nativeAdmission).toBe(false);
  expectFrozen(fixed.descriptor);expectFrozen(fixed.metrics);
  expect(pair).toStrictEqual(before);expect(Object.isFrozen(pair)).toBe(false);
});

it('reconstructs identical current-version metrics and descriptors from the saved JSON input pair', () => {
  const saved = JSON.parse(JSON.stringify(pair)), savedBefore = structuredClone(saved), replay = comparePitchReleaseV155(saved), fixed = measured();
  expect(replay.version).toBe('pitch_release_comparison_v155');
  expect(replay.reference.metrics).toStrictEqual(result.reference.metrics);expect(replay.variant.metrics).toStrictEqual(result.variant.metrics);
  expect(replay.reference.pitch.diagnostics.sourceDescriptor).toStrictEqual(result.reference.pitch.diagnostics.sourceDescriptor);
  expect(replay.variant.pitch.diagnostics.sourceDescriptor).toStrictEqual(result.variant.pitch.diagnostics.sourceDescriptor);
  expect(replay.variantFixedRelease.status).toBe('MEASURED');
  if (replay.variantFixedRelease.status !== 'MEASURED') throw Error('saved prescribed comparison became unsupported');
  expect(replay.variantFixedRelease.descriptor).toStrictEqual(fixed.descriptor);
  expect(replay.variantFixedRelease.metrics).toStrictEqual(fixed.metrics);
  expect(saved).toStrictEqual(savedBefore);expect(pair).toStrictEqual(before);
});
