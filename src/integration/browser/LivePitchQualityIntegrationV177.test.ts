import { describe, expect, it } from 'vitest';
import { simulateLivePitchV1, type LivePitchInputV1 } from './LivePitchV1';
import { createPitchSnapshotFromPresetV78 } from './LivePitchAuthoringV78';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { restoreLiveWorkloadV122 } from './LiveWorkloadExecutionV122';

const states=['KIRE_CIRCLE','KIRE_DOUBLE_CIRCLE','THREATENING_DOUBLE_CIRCLE'] as const;
const request=(qualityState:typeof states[number])=>({version:'live_pitch_quality_request_v177' as const,qualityState});
function fixture():LivePitchInputV1 {
  const pitch=createPitchSnapshotFromPresetV78({presetId:'curve',pitchId:'auto-quality-curve',physical:LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1});
  return {originTick:1_000_000,seed:123,
    batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'R'},
    pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.9,throws:'R',
      pitchRepertoireV78:{version:'pitch_repertoire_v78',pitches:[pitch]}},
    measuredClips:liveMatchFixture().measuredClips,batting:'take',pitchType:'curve',pitchId:pitch.pitchId,
    location:'zone',physics:LIVE_MATCH_PHYSICS_V1,pitchCommandObservationV155:true};
}
const execute=(input:LivePitchInputV1,quality:ReturnType<typeof request>|null)=>
  simulateLivePitchV1({...input,pitchQualityV177:quality} as LivePitchInputV1);
function record(play:ReturnType<typeof simulateLivePitchV1>){
  const {sampleBatAtTick,...data}=play;
  return {...data,batSamples:play.frames.map(frame=>sampleBatAtTick(frame.tick))};
}

describe('V177 automatic quality at the real release owner',()=>{
  it.each(states)('generates %s from the saved base and equals its explicit physical release plan',qualityState=>{
    const input=fixture(),before=structuredClone(input),actual=execute(input,request(qualityState));
    const diagnostic=actual.diagnostics.pitchQualityV177;
    expect(diagnostic?.status).toBe('APPLIED');
    if(diagnostic?.status!=='APPLIED')throw Error('automatic recipe did not apply');
    const direct=simulateLivePitchV1({...input,pitchReleasePlanV168:diagnostic.plan});
    expect(actual.diagnostics.sourceDescriptor).toStrictEqual(direct.diagnostics.sourceDescriptor);
    expect(actual.diagnostics.sourceDescriptor.initial.ball.spin).toStrictEqual(diagnostic.plan.nominal.spinRadPerSecond);
    expect(actual.diagnostics.sourceDescriptor.materialOrientationAtStart).toStrictEqual(diagnostic.plan.nominal.releaseOrientation);
    expect(diagnostic.inverseCommandPasses).toBe(2);
    expect(actual.diagnostics.authoredPitch!.snapshot).toStrictEqual(input.pitcher.pitchRepertoireV78!.pitches[0]);
    expect(input).toStrictEqual(before);expect(Object.isFrozen(input.pitcher)).toBe(false);
  });

  it('keeps null and omission exactly on the original one-pass path after applying a selection',()=>{
    const input=fixture(),before=structuredClone(input),baseline=simulateLivePitchV1(input);
    execute(input,request(states[2]));
    expect(record(execute(input,null))).toStrictEqual(record(baseline));
    expect(record(simulateLivePitchV1(input))).toStrictEqual(record(baseline));
    expect(baseline.diagnostics).not.toHaveProperty('pitchQualityV177');expect(input).toStrictEqual(before);
  });

  it('does not anticipate spin reproduction failure when choosing its reference or recipe',()=>{
    const input=fixture(),nominal=execute(input,request(states[1])),
      actual=execute({...input,pitcher:{...input.pitcher,minimumSpinRatio:.7}},request(states[1]));
    expect(actual.diagnostics.pitchQualityV177).toStrictEqual(nominal.diagnostics.pitchQualityV177);
    expect(actual.diagnostics.sourceDescriptor.initial.ball.velocity).toStrictEqual(nominal.diagnostics.sourceDescriptor.initial.ball.velocity);
    const ratio=actual.diagnostics.spinExecution!.ratio;
    expect(ratio).toBeGreaterThanOrEqual(.7);expect(ratio).toBeLessThan(1);
    for(const axis of ['x','y','z'] as const)expect(actual.diagnostics.sourceDescriptor.initial.ball.spin[axis])
      .toBe(nominal.diagnostics.sourceDescriptor.initial.ball.spin[axis]*ratio);
  });

  it('consumes the pitcher profile and permits a one-pitch override or null without changing that profile',()=>{
    const input=fixture(),profiled={...input,pitcher:{...input.pitcher,pitchQualityV177:request(states[0])}},
      before=structuredClone(profiled),fromProfile=simulateLivePitchV1(profiled),direct=execute(input,request(states[0]));
    expect(fromProfile.diagnostics.sourceDescriptor).toStrictEqual(direct.diagnostics.sourceDescriptor);
    expect(fromProfile.diagnostics.pitchQualityV177).toMatchObject({status:'APPLIED',requestSource:'PITCHER_PROFILE'});
    expect(record(execute(profiled,null))).toStrictEqual(record(simulateLivePitchV1(input)));
    expect(execute(profiled,request(states[2])).diagnostics.sourceDescriptor)
      .toStrictEqual(execute(input,request(states[2])).diagnostics.sourceDescriptor);
    expect(profiled).toStrictEqual(before);
  });

  it('applies workload only after the unchanged nominal recipe and does not re-aim the fatigue loss',()=>{
    const input=fixture(),nominal=execute(input,request(states[0])),
      context={sourceId:'quality-workload-v177',sourceVersion:'v1',
        scope:{sessionId:'session',matchId:'match',careerId:'career',playerId:'pitcher',gameDay:10},
        baseline:{careerId:'career',playerId:'pitcher',createdAtDay:1,fatigue:.5,recoveryCapacity:.5,
          policy:{policyId:'workload',version:'v1',availableAtDay:0,workloadFatiguePerUnit:.1,travelFatiguePerKm:.001,recoveryPerHour:.1}},
        activities:[],expectedRevision:0},
      timingProfile={baseStartIntervalUs:10000000,normalMotionToReleaseUs:600000,followThroughUs:200000,quickSpeedFactor:1.8,
        cadenceExecutionControl:.8,cadenceTimingKnowledge:.8,quickRepeatability:.8,naturalVariationUs:50000,
        normalPhaseWeights:{gather:2,transition:3,stride:5},quickPhaseWeights:{gather:1,transition:2,stride:3}},
      policy={policyId:'explicit-response',version:'v1',availableAtDay:1,motionDurationScaleAtFullFatigue:1.5,
        velocityRetentionAtFullFatigue:.9,spinRetentionAtFullFatigue:.8},
      actual=execute({...input,pitchWorkloadV122:{workload:restoreLiveWorkloadV122(context),timingProfile,policy}},request(states[0]));
    expect(actual.diagnostics.pitchQualityV177).toStrictEqual(nominal.diagnostics.pitchQualityV177);
    for(const axis of ['x','y','z'] as const){
      expect(actual.diagnostics.sourceDescriptor.initial.ball.velocity[axis]).toBe(nominal.diagnostics.sourceDescriptor.initial.ball.velocity[axis]*.95);
      expect(actual.diagnostics.sourceDescriptor.initial.ball.spin[axis]).toBe(nominal.diagnostics.sourceDescriptor.initial.ball.spin[axis]*.9);
    }
  });

  it('retains a legal un-authored material basis without inventing an identity or changing its flight',()=>{
    const input=fixture(),{releaseOrientation:_q,seamForce:_seam,...legacy}=input.pitcher.pitchRepertoireV78!.pitches[0],
      old={...input,pitcher:{...input.pitcher,pitchRepertoireV78:{version:'pitch_repertoire_v78' as const,pitches:[legacy]}}},
      baseline=simulateLivePitchV1(old),actual=execute(old,request(states[0]));
    expect(actual.diagnostics.pitchQualityV177).toMatchObject({status:'NOT_APPLICABLE',reason:'MATERIAL_ORIENTATION_NOT_AUTHORED',inverseCommandPasses:1});
    expect(actual.diagnostics.sourceDescriptor).toStrictEqual(baseline.diagnostics.sourceDescriptor);
    expect(actual.diagnostics).not.toHaveProperty('pitchReleasePlanV168');
  });

  it('rejects simultaneous automatic and explicit plans and validates the request version',()=>{
    const input=fixture(),automatic=execute(input,request(states[0])),diagnostic=automatic.diagnostics.pitchQualityV177;
    if(diagnostic?.status!=='APPLIED')throw Error('automatic recipe did not apply');
    expect(()=>simulateLivePitchV1({...input,pitchQualityV177:request(states[1]),pitchReleasePlanV168:diagnostic.plan} as LivePitchInputV1))
      .toThrow(/quality.*release plan|release plan.*quality/);
    expect(()=>execute(input,{...request(states[0]),version:'wrong'} as never)).toThrow(/quality/);
  });
});
