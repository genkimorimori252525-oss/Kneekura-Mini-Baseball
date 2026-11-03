import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createPitchBreakLowSpinCasesV158, measurePitchBreakLowSpinCaseV158, type PitchBreakLowSpinReferenceV158 } from '../../../tools/verification/pitch-break-low-spin-v158';
import { simulatePitcherWorkbenchV77 } from './PitcherWorkbenchV77';
import { createPitchSnapshotFromPresetV78 } from './LivePitchAuthoringV78';
import { setPitchMovementLevelV92 } from './PitchMovementV92';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_MOUND_SURFACE_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import type { LiveMeasuredClipV1, LivePitchInputV1 } from './LivePitchV1';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { calculateBaseballAerodynamics } from '../../core/sim/ball/BaseballAerodynamics';

let reference:PitchBreakLowSpinReferenceV158;
beforeAll(() => {
  const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[],
    base:LivePitchInputV1 = { originTick:1_000_000, seed:3,
      batter:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters:1.8, bats:'R', timingStdSeconds:0, aimStdMeters:0 },
      pitcher:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters:0, heightMeters:1.9, moundPosition:LIVE_MATCH_MOUND_SURFACE_V1 },
      measuredClips:clips, batting:'take', pitchType:'curve', location:'zone', physics:LIVE_MATCH_PHYSICS_V1 },
    preset = createPitchSnapshotFromPresetV78({ presetId:'curve', pitchId:'public-feasibility-curve', physical:base.pitcher }),
    pitch = setPitchMovementLevelV92({ pitch:preset, level:4 }),
    trial = simulatePitcherWorkbenchV77({ pitch:{ ...base, pitchId:pitch.pitchId,
      pitcher:{ ...base.pitcher, pitchRepertoireV78:{ version:'pitch_repertoire_v78', pitches:[pitch] } } } });
  reference = { sourceDescriptor:trial.pitch.diagnostics.sourceDescriptor,
    referenceElapsedSeconds:trial.metrics.flightSeconds, measurementPlaneZ:trial.metrics.measurementPlaneZ,
    battingSetupV94:trial.pitch.diagnostics.battingSetupV94, releaseCommand:trial.metrics.breakTimingV155.releaseCommand };
});

it('samples the actual Source at a common clock, retains forces and ground reasons, and replays JSON exactly', () => {
  const saved = structuredClone(reference), generated = createPitchBreakLowSpinCasesV158(reference.sourceDescriptor),
    picked = [generated.cases[0], generated.cases.find(item => item.factors.spinScale === .02 && item.factors.gyroDegrees === 85 && item.factors.materialPhaseDegrees === 270)!, generated.cases.at(-1)!];
  for (const item of picked) {
    const measured = measurePitchBreakLowSpinCaseV158(reference, item, 160),
      replay = measurePitchBreakLowSpinCaseV158(JSON.parse(JSON.stringify(reference)), JSON.parse(JSON.stringify(item)), 160),
      kernel = createSourceFreeBallKernel(item.descriptor), observation = measured.observation,
      timing = observation.timingAtReference, end = reference.referenceElapsedSeconds, initial = item.descriptor.initial.ball;
    expect(replay).toStrictEqual(measured);
    expect(measured.descriptor).toStrictEqual(item.descriptor);expect(measured.id).toBe(item.id);
    expect(observation.sourceSamples).toHaveLength(161);expect(timing.raw).toHaveLength(161);
    for (const [index, sample] of observation.sourceSamples.entries()) {
      const actual = kernel.evaluateAt(sample.elapsedSeconds), ball = actual.moment.ball;
      expect(sample.elapsedSeconds).toBe(index === 160 ? end : end * index / 160);
      expect(sample.tick).toBe(ball.tick);expect(sample.position).toStrictEqual(ball.position);
      expect(sample.velocity).toStrictEqual(ball.velocity);expect(sample.spin).toStrictEqual(ball.spin);
      expect(sample.orientation).toStrictEqual(actual.materialOrientation ?? actual.orientation);expect(sample.phase).toBe(actual.phase);
      expect(timing.raw[index].actual.position).toStrictEqual(ball.position);
      expect(timing.raw[index].baseline.position.z).toBeCloseTo(initial.position.z + initial.velocity.z * sample.elapsedSeconds, 12);
      const force = observation.forceSeries[index];expect(force.elapsedSeconds).toBe(sample.elapsedSeconds);
      if (sample.phase !== 'airborne') expect(force.force).toBeNull();
      else {
        const expected = calculateBaseballAerodynamics(sample.velocity, sample.spin, item.descriptor.profile.air.aerodynamics, sample.orientation);
        expect(force.force!.totalAirAcceleration).toStrictEqual(expected.totalAcceleration);
        expect(force.force!.gravityAcceleration).toStrictEqual({ x:0, y:item.descriptor.profile.air.gravityY, z:0 });
      }
    }
    expect(timing.groundClassification.actualGroundEventSeconds).toStrictEqual(kernel.boundaries.filter(row => row.kind === 'ground' && row.elapsedSeconds <= end).map(row => row.elapsedSeconds));
    expect(measured.comparison.commonTime.status).toBe(timing.status);
    expect(measured.comparison.commonTime.amountMeters).toBe(timing.finalXY.normMeters);
    if (timing.status !== 'CLASSIFIED') {
      expect(measured.comparison.commonTime.p50Fraction).toBeNull();expect(measured.comparison.commonTime.late20Fraction).toBeNull();
    }
  }
  expect(reference).toStrictEqual(saved);
}, 60_000);
