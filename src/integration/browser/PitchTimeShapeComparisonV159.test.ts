import { readFileSync } from 'node:fs';
import { beforeAll, expect, it, vi } from 'vitest';
import { comparePitchTimeShapeV159 } from './PitchTimeShapeComparisonV159';
import { comparePitchReleaseV155 } from './PitchReleaseComparisonV155';
import * as releaseComparison from './PitchReleaseComparisonV155';
import { simulatePitcherWorkbenchV77 } from './PitcherWorkbenchV77';
import { createPitchSnapshotFromPresetV78 } from './LivePitchAuthoringV78';
import { setPitchMovementLevelV92 } from './PitchMovementV92';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_MOUND_SURFACE_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import type { LiveMeasuredClipV1, LivePitchInputV1 } from './LivePitchV1';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { createPitchBreakLowSpinCasesV158 } from '../../../tools/verification/pitch-break-low-spin-v158';

type Packet=Parameters<typeof simulatePitcherWorkbenchV77>[0];
let pair:{reference:Packet;variant:Packet},before:typeof pair,result:ReturnType<typeof comparePitchTimeShapeV159>;
const serial=(value:unknown):unknown=>typeof value==='function'?undefined:Array.isArray(value)?value.map(serial):
  value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,item])=>typeof item!=='function').map(([key,item])=>[key,serial(item)])):value;
beforeAll(()=>{
  const clips=JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url),'utf8')).clips as LiveMeasuredClipV1[],
    base:LivePitchInputV1={originTick:1_000_000,seed:3,batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'R',timingStdSeconds:0,aimStdMeters:0},
      pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0,heightMeters:1.9,moundPosition:LIVE_MATCH_MOUND_SURFACE_V1},
      measuredClips:clips,batting:'take',pitchType:'curve',location:'zone',physics:LIVE_MATCH_PHYSICS_V1},
    pitch=setPitchMovementLevelV92({pitch:createPitchSnapshotFromPresetV78({presetId:'curve',pitchId:'public-feasibility-curve',physical:base.pitcher}),level:4}),
    input:Packet={pitch:{...base,pitchId:pitch.pitchId,pitcher:{...base.pitcher,pitchRepertoireV78:{version:'pitch_repertoire_v78',pitches:[pitch]}}},
      context:{pitcherId:'public-pitcher',batterId:'public-batter'}},
    original=simulatePitcherWorkbenchV77(input),cases=createPitchBreakLowSpinCasesV158(original.pitch.diagnostics.sourceDescriptor).cases,
    packet=(index:number):Packet=>{
      const item=cases[index],{movementV92:_authoringHistory,...settings}=pitch,
        candidate={...settings,spinRadPerSecond:item.descriptor.initial.ball.spin,releaseOrientation:item.descriptor.materialOrientationAtStart};
      return {...input,pitch:{...input.pitch,pitcher:{...input.pitch.pitcher,pitchRepertoireV78:{version:'pitch_repertoire_v78',pitches:[candidate]}}}};
    };
  pair={reference:packet(4),variant:packet(23)};before=structuredClone(pair);result=comparePitchTimeShapeV159(pair);
});

it('preserves the two ordinary trials and legacy release-comparison data while adding an explicit time-shape observation',()=>{
  const legacy=comparePitchReleaseV155(pair),{timeShapeV159,summary,version,...unchanged}=result,
    {version:_legacyVersion,summary:legacySummary,...legacyOther}=legacy,{commonTimeV159,...oldSummary}=summary;
  expect(version).toBe('pitch_time_shape_comparison_v159');expect(serial(unchanged)).toStrictEqual(serial(legacyOther));
  expect(oldSummary).toStrictEqual(legacySummary);expect(commonTimeV159.status).toBe('MEASURED');
  expect(timeShapeV159.comparisonBasis).toBe('SAME_REFERENCE_ELAPSED_TIME_SHARED_RELEASE_AIRLESS_GRAVITY_V159');
  expect(result.nativeAdmission).toBe(false);expect(result.officialResult).toBeNull();expect(pair).toStrictEqual(before);
});

it('uses actual kernels at one reference elapsed clock, identical release PV and one gravity baseline for both observations',()=>{
  const shape=result.timeShapeV159,end=result.reference.metrics.flightSeconds,reference=result.reference.pitch.diagnostics.sourceDescriptor,
    changed=result.variantFixedRelease.descriptor,a=createSourceFreeBallKernel(reference),b=createSourceFreeBallKernel(changed);
  expect(shape.referenceElapsedSeconds).toBe(end);expect(shape.referenceObservation.raw).toHaveLength(161);
  expect(shape.variantFixedReleaseObservation.raw).toHaveLength(161);
  expect(changed.initial.ball.position).toStrictEqual(reference.initial.ball.position);
  expect(changed.initial.ball.velocity).toStrictEqual(reference.initial.ball.velocity);
  for(let index=0;index<=160;index++){
    const left=shape.referenceObservation.raw[index],right=shape.variantFixedReleaseObservation.raw[index],
      sourceA=a.evaluateAt(left.elapsedSeconds),sourceB=b.evaluateAt(right.elapsedSeconds);
    expect(left.elapsedSeconds).toBe(right.elapsedSeconds);expect(left.elapsedSeconds).toBe(index===160?end:end*index/160);
    for(const [row,source] of [[left,sourceA],[right,sourceB]] as const){
      expect(row.actual.position).toStrictEqual(source.moment.ball.position);expect(row.actual.velocity).toStrictEqual(source.moment.ball.velocity);
      expect(row.actual.phase).toBe(source.phase);
    }
    expect(left.baseline).toStrictEqual(right.baseline);expect(left.baseline.counterfactualGroundIgnored).toBe(true);
  }
  for(const [digest,observation] of [[result.summary.commonTimeV159.reference,shape.referenceObservation],
    [result.summary.commonTimeV159.variantFixedRelease,shape.variantFixedReleaseObservation]] as const){
    expect(digest.status).toBe(observation.status);expect(digest.amountMeters).toBe(observation.finalXY.normMeters);
    expect(digest.p50Seconds).toBe(observation.percentTimes.p50?.elapsedSeconds??null);
    expect(digest.p50Fraction).toBe(observation.percentTimes.p50===null?null:observation.percentTimes.p50.elapsedSeconds/end);
    expect(digest.late20Fraction).toBe(observation.late20Percent.projectedFraction);
  }
});

it('recomputes the same full serial record from ordinary saved JSON inputs without freezing or mutating the caller',()=>{
  const saved=JSON.parse(JSON.stringify(pair)),replayed=comparePitchTimeShapeV159(saved);
  expect(serial(replayed)).toStrictEqual(serial(result));expect(saved).toStrictEqual(before);
  expect(Object.isFrozen(pair)).toBe(false);expect(Object.isFrozen(pair.reference.pitch.pitcher)).toBe(false);
  expect(Object.isFrozen(result.timeShapeV159)).toBe(true);expect(Object.isFrozen(result.summary.commonTimeV159)).toBe(true);
});

it('keeps kernel ground boundaries between samples and reports unclassified percentages on the shared clock',()=>{
  const original=result.reference.pitch.diagnostics.sourceDescriptor,
    descriptor={...original,throughElapsedSeconds:.5,initial:{originTick:1_000_000,elapsedSeconds:0,
      ball:{tick:1_000_000,position:{x:0,y:.2,z:3},velocity:{x:0,y:-3,z:-30},spin:{x:200,y:0,z:0}}}},
    reference={...result.reference,pitch:{...result.reference.pitch,diagnostics:{...result.reference.pitch.diagnostics,sourceDescriptor:descriptor}},
      metrics:{...result.reference.metrics,flightSeconds:.09}},
    legacy={...comparePitchReleaseV155(pair),reference,variantFixedRelease:{...result.variantFixedRelease,descriptor}},
    spy=vi.spyOn(releaseComparison,'comparePitchReleaseV155').mockReturnValue(legacy);
  try{
    const observed=comparePitchTimeShapeV159(pair);
    for(const timing of [observed.timeShapeV159.referenceObservation,observed.timeShapeV159.variantFixedReleaseObservation]){
      expect(timing.groundClassification.actualGroundEventSeconds.length).toBeGreaterThan(0);
      expect(timing.raw.every(row=>row.actual.phase==='airborne')).toBe(true);
      expect(timing.status).toBe('UNCLASSIFIED');expect(timing.percentTimes).toEqual({p10:null,p50:null,p90:null});
      expect(timing.late20Percent.projectedFraction).toBeNull();
    }
  }finally{spy.mockRestore();}
  expect(pair).toStrictEqual(before);
});

it('refuses different gravity for the shared baseline instead of silently mixing it into a time-shape difference',()=>{
  const legacy=comparePitchReleaseV155(pair),changed=legacy.variantFixedRelease.descriptor,
    descriptor={...changed,profile:{...changed.profile,air:{...changed.profile.air,gravityY:changed.profile.air.gravityY-.1}}},
    spy=vi.spyOn(releaseComparison,'comparePitchReleaseV155').mockReturnValue({...legacy,variantFixedRelease:{...legacy.variantFixedRelease,descriptor}});
  try{expect(()=>comparePitchTimeShapeV159(pair)).toThrow(/matching gravity/);}finally{spy.mockRestore();}
  expect(pair).toStrictEqual(before);
});
