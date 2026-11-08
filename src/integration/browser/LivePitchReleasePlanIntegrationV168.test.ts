import { describe, expect, it } from 'vitest';
import { simulateLivePitchV1, type LivePitchInputV1 } from './LivePitchV1';
import { createPitchSnapshotFromPresetV78, type PitchSnapshotV78 } from './LivePitchAuthoringV78';
import type { LivePitchReleasePlanV168 } from './LivePitchReleasePlanV168';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

// Explicit author-provided release plans exercise the real Owner boundary.
// This is not evidence for the three Kire grades or a measured human release.
function fixture() {
  const pitch = createPitchSnapshotFromPresetV78({ presetId:'curve', pitchId:'release-plan-curve', physical:LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 });
  const input:LivePitchInputV1 = { originTick:1_000_000, seed:123,
    batter:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters:1.8, bats:'R' },
    pitcher:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters:1.9,
      pitchRepertoireV78:{ version:'pitch_repertoire_v78', pitches:[pitch] } },
    measuredClips:liveMatchFixture().measuredClips, batting:'take', pitchType:'curve', pitchId:pitch.pitchId,
    location:'zone', physics:LIVE_MATCH_PHYSICS_V1, pitchCommandObservationV155:true };
  return { input, pitch };
}
function plan(pitch:PitchSnapshotV78):LivePitchReleasePlanV168 {
  return { version:'live_pitch_release_plan_v168', pitchId:pitch.pitchId, qualityState:'KIRE_CIRCLE',
    expectedBase:{ releaseSpeedMps:pitch.releaseSpeedMps, spinRadPerSecond:{ ...pitch.spinRadPerSecond },
      ...(pitch.releaseOrientation===undefined?{}:{ releaseOrientation:{ ...pitch.releaseOrientation } }),
      ...(pitch.seamForce===undefined?{}:{ seamForce:{ ...pitch.seamForce } }) },
    nominal:{ spinRadPerSecond:{ x:-65, y:25, z:12 }, releaseOrientation:{ w:Math.SQRT1_2, x:0, y:Math.SQRT1_2, z:0 } } };
}
const execute = (input:LivePitchInputV1, request:LivePitchReleasePlanV168|null) =>
  simulateLivePitchV1({ ...input, pitchReleasePlanV168:request } as LivePitchInputV1);
function serialRecord(play:ReturnType<typeof simulateLivePitchV1>) {
  const { sampleBatAtTick, ...data }=play;
  return { ...data, batSamples:play.frames.map(frame=>sampleBatAtTick(frame.tick)) };
}

describe('V168 one-pitch nominal release Owner integration', () => {
  it('uses the plan before inverse aiming, equal to the same explicitly authored physical release', () => {
    const { input, pitch }=fixture(), request=plan(pitch), before=structuredClone(input), requestBefore=structuredClone(request),
      actual=execute(input,request), control=simulateLivePitchV1({ ...input,
        pitcher:{ ...input.pitcher, pitchRepertoireV78:{ version:'pitch_repertoire_v78', pitches:[{ ...pitch, ...request.nominal }] } } });
    expect(actual.diagnostics.sourceDescriptor).toStrictEqual(control.diagnostics.sourceDescriptor);
    expect(actual.diagnostics.sourceDescriptor.initial.ball.spin).toStrictEqual(request.nominal.spinRadPerSecond);
    expect(actual.diagnostics.sourceDescriptor.materialOrientationAtStart).toStrictEqual(request.nominal.releaseOrientation);
    expect(input).toStrictEqual(before);expect(request).toStrictEqual(requestBefore);
    expect(Object.isFrozen(input)).toBe(false);expect(Object.isFrozen(request)).toBe(false);
    expect(actual.diagnostics).toHaveProperty('pitchReleasePlanV168');
  });

  it('applies reproduction error after the nominal plan without anticipating the actual error', () => {
    const { input, pitch }=fixture(), request=plan(pitch), intended=execute(input,request),
      actual=execute({ ...input, pitcher:{ ...input.pitcher, minimumSpinRatio:.7 } },request),
      nominal=intended.diagnostics.sourceDescriptor.initial.ball, released=actual.diagnostics.sourceDescriptor.initial.ball,
      ratio=actual.diagnostics.spinExecution!.ratio;
    expect(released.velocity).toStrictEqual(nominal.velocity);
    expect(released.spin).not.toStrictEqual(nominal.spin);
    expect(ratio).toBeGreaterThanOrEqual(.7);expect(ratio).toBeLessThan(1);
    for (const key of ['x','y','z'] as const) expect(released.spin[key]).toBe(request.nominal.spinRadPerSecond[key]*ratio);
    expect(actual.diagnostics.spinExecution).toMatchObject({ nominalSpin:request.nominal.spinRadPerSecond, nominalPlanRetained:true });
  });

  it('restores the exact omitted result with null after a planned pitch and never edits the saved repertoire', () => {
    const { input, pitch }=fixture(), before=structuredClone(input), omitted=simulateLivePitchV1(input);
    execute(input,plan(pitch));
    expect(serialRecord(execute(input,null))).toStrictEqual(serialRecord(omitted));
    expect(serialRecord(simulateLivePitchV1(input))).toStrictEqual(serialRecord(omitted));
    expect(input).toStrictEqual(before);
  });

  it('does not turn a quality label into a physical force or result multiplier', () => {
    const { input, pitch }=fixture(), request=plan(pitch), result=execute(input,request),
      { diagnostics:_diagnostics, ...outcome }=serialRecord(result);
    for (const qualityState of ['KIRE_DOUBLE_CIRCLE','THREATENING_DOUBLE_CIRCLE'] as const) {
      const renamed=execute(input,{ ...request, qualityState });
      expect(renamed.diagnostics.sourceDescriptor).toStrictEqual(result.diagnostics.sourceDescriptor);
      const { diagnostics:_renamedDiagnostics, ...renamedOutcome }=serialRecord(renamed);
      expect(renamedOutcome).toStrictEqual(outcome);
    }
  });

  it('rejects a stale or different owned-pitch plan at the real Owner boundary', () => {
    const { input, pitch }=fixture(), request=plan(pitch);
    expect(()=>execute(input,{ ...request, pitchId:'another-owned-pitch' })).toThrow(/release plan/);
    expect(()=>execute(input,{ ...request, expectedBase:{ ...request.expectedBase, releaseSpeedMps:pitch.releaseSpeedMps+.5 } })).toThrow(/release plan/);
    const { pitchRepertoireV78:_owned, ...unowned }=input.pitcher, { pitchId:_pitchId, ...unownedInput }=input;
    expect(()=>execute({ ...unownedInput, pitcher:unowned },request)).toThrow(/release plan/);
  });
});
