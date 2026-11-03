import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { multiplyQuaternions } from '../../core/sim/pitching/BaseballOrientation';
import { DEFAULT_IMPACT_TRAJECTORY_V1 } from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';
import { LIVE_MATCH_PHYSICS_V1, LIVE_MATCH_MOUND_SURFACE_V1 } from './LiveBaseballMatchV1';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';
import { compareMeasuredTrajectoriesV69 } from './MeasuredTrajectoryComparisonWorkbenchV69';

const clips=JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url),'utf8')).clips as LiveMeasuredClipV1[];
const input=(side:'R'|'L'='R'):LivePitchInputV1=>{const clip=clips.find(c=>c.side===side)!;return{
  originTick:1e6,seed:20261019,batter:{heightMeters:1.8,bats:side,batLengthM:.84,batMassKg:.88,swingRate:1,
    timingStdSeconds:.009,aimStdMeters:.022,chaseMarginMeters:.12,clipId:clip.id,
    maximumSweetSpotSpeedMps:35,targetSweetSpotSpeedMps:30,badBallControl:.8,zoneJudgmentStdMeters:.025,
    swingDecision:{approach:'SWING',threshold:.5,aggressionWeight:.5},impactTrajectory:DEFAULT_IMPACT_TRAJECTORY_V1},
  pitcher:{releaseSpeedMps:42.5,spinRadPerSecond:{x:-230,y:15,z:10},commandStdMeters:.11,
    heightMeters:1.88,throws:'R',moundPosition:LIVE_MATCH_MOUND_SURFACE_V1},measuredClips:[clip],
  batting:'balanced',pitchType:'curve',location:'zone',physics:LIVE_MATCH_PHYSICS_V1};};
const withoutFunctions=(pitch:ReturnType<typeof simulateLivePitchV1>)=>{const{sampleBatAtTick:_sample,...rest}=pitch;return rest;};
const norm=(v:{x:number;y:number;z:number})=>Math.hypot(v.x,v.y,v.z);

it.each(['R','L'] as const)('executes exactly the normal LivePitch profile and original clock for all four %s levels',side=>{
  const pitch=input(side),before=JSON.stringify(pitch),comparison=compareMeasuredTrajectoriesV69({pitch,afterContactSeconds:2});
  expect(comparison.cases.map(c=>c.level)).toEqual([1,2,3,4]);expect(comparison.fixedInput).toEqual(pitch);
  expect(JSON.stringify(pitch)).toBe(before);expect(Object.isFrozen(pitch)).toBe(false);
  expect(comparison.invariants).toMatchObject({seed:pitch.seed,originTick:pitch.originTick,sourceDescriptorEqual:true,
    timingErrorEqual:true,aimErrorEqual:true,sweetSpotTEqual:true,zoneJudgmentEqual:true,impactClocksRealigned:false,ballExitStateOverridden:false});
  for(const row of comparison.cases){
    const ordinary=simulateLivePitchV1({...pitch,batter:{...pitch.batter,impactTrajectory:{...DEFAULT_IMPACT_TRAJECTORY_V1,level:row.level}}});
    expect(withoutFunctions(row.pitch)).toEqual(withoutFunctions(ordinary));
    for(const tick of[pitch.originTick,ordinary.endedAtTick,ordinary.diagnostics.referenceContactTick,ordinary.diagnostics.referenceThroughTick+1])
      expect(row.pitch.sampleBatAtTick(tick)).toEqual(ordinary.sampleBatAtTick(tick));
    expect(row.pitch.diagnostics.referenceMaximumSweetSpotSpeedMps).toBeLessThanOrEqual(35*(1+1e-10));
    expect(row.pitch.diagnostics.sourceDescriptor).toEqual(comparison.cases[0].pitch.diagnostics.sourceDescriptor);
    expect(row.pitch.diagnostics.timingErrorSeconds).toBe(comparison.cases[0].pitch.diagnostics.timingErrorSeconds);
    expect(row.pitch.diagnostics.aimErrorMeters).toEqual(comparison.cases[0].pitch.diagnostics.aimErrorMeters);
  }
});
it('observes the real post-contact Aero/ground Source and carries material orientation without changing collision output',()=>{
  const pitch={...input(),pitchType:'fastball',batter:{...input().batter,timingStdSeconds:0,aimStdMeters:0,zoneJudgmentStdMeters:0}},
    comparison=compareMeasuredTrajectoriesV69({pitch,afterContactSeconds:8}),contacts=comparison.cases.filter(c=>c.pitch.contact);
  expect(contacts.length).toBeGreaterThan(0);
  for(const row of contacts){const c=row.pitch.contact!,moment=row.pitch.contactMoment!,descriptor=row.flightDescriptor!,kernel=createSourceFreeBallKernel(descriptor);
    expect(descriptor.initial).toEqual({...moment,ball:{...moment.ball,velocity:c.exitVelocity,spin:c.exitSpin}});
    expect(row.flightFrames[0].elapsedSeconds).toBe(moment.elapsedSeconds);expect(row.flightFrames[0].elapsedSeconds).toBeGreaterThan(0);
    expect(row.flightFrames[0].tick).toBe(c.tick);expect(row.flightFrames[0].velocity).toEqual(c.exitVelocity);expect(row.flightFrames[0].spin).toEqual(c.exitSpin);
    expect(row.metrics.exitSpeedMps).toBe(norm(c.exitVelocity));expect(row.metrics.spinRpm).toBe(norm(c.exitSpin)*60/(2*Math.PI));
    expect(row.sampleFlightAtPitchElapsedSeconds(moment.elapsedSeconds-.001)).toBeNull();expect(row.sampleFlightAtPitchElapsedSeconds(descriptor.throughElapsedSeconds+.001)).toBeNull();
    for(const frame of row.flightFrames.filter((_,i)=>i%17===0)){const at=kernel.evaluateAt(frame.elapsedSeconds);
      expect(frame.position).toEqual(at.moment.ball.position);expect(frame.velocity).toEqual(at.moment.ball.velocity);expect(frame.spin).toEqual(at.moment.ball.spin);
      expect(frame.orientation).toEqual(multiplyQuaternions(at.orientation,row.pitch.contactOrientation!));expect(frame.tick).toBe(at.moment.ball.tick);expect(frame.visible).toBe(true);
      expect(row.sampleFlightAtPitchElapsedSeconds(frame.elapsedSeconds)).toEqual(frame);}
    const landing=kernel.boundaries.find(b=>b.kind==='ground');
    if(landing){const first=kernel.evaluateAt(landing.elapsedSeconds,'incoming').moment;
      expect(row.metrics.firstGroundContact).toEqual({tick:first.ball.tick,elapsedSeconds:landing.elapsedSeconds,position:first.ball.position});
      expect(row.metrics.carryMeters).toBe(Math.hypot(first.ball.position.x-c.ballCenter.x,first.ball.position.z-c.ballCenter.z));
      expect(row.metrics.firstGroundSide).toBe(first.ball.position.z>Math.abs(first.ball.position.x)?'FAIR_SIDE':first.ball.position.z<Math.abs(first.ball.position.x)?'FOUL_SIDE':'FOUL_LINE');
    }else{expect(row.metrics.firstGroundContact).toBeNull();expect(row.metrics.carryMeters).toBeNull();}
  }
});
it('returns no invented flight/carry for actual misses, takes, and landings outside the observation window',()=>{
  const base=input(),late={...base,batter:{...base.batter,technicalTimingOffsetSeconds:.35}},
    missed=compareMeasuredTrajectoriesV69({pitch:late}),taken=compareMeasuredTrajectoriesV69({pitch:{...base,batting:'take'}});
  for(const row of[...missed.cases,...taken.cases]){expect(row.pitch.contact).toBeNull();expect(row.flightDescriptor).toBeNull();expect(row.flightFrames).toEqual([]);
    expect(row.metrics.exitSpeedMps).toBeNull();expect(row.metrics.carryMeters).toBeNull();expect(row.metrics.firstGroundSide).toBeNull();expect(row.sampleFlightAtPitchElapsedSeconds(1)).toBeNull();}
  expect(missed.cases.every(c=>c.pitch.call==='swinging_strike')).toBe(true);
  const short=compareMeasuredTrajectoriesV69({pitch:{...base,pitchType:'fastball',batter:{...base.batter,timingStdSeconds:0,aimStdMeters:0}},afterContactSeconds:.1});
  expect(short.cases.filter(c=>c.pitch.contact).length).toBeGreaterThan(0);
  for(const row of short.cases.filter(c=>c.pitch.contact)){expect(row.metrics.firstGroundContact).toBeNull();expect(row.metrics.carryMeters).toBeNull();}
});
it('uses real player speed/aim/timing controls, and retains deterministic outputs without choosing a favourable new seed',()=>{
  const pitch=input(),one=compareMeasuredTrajectoriesV69({pitch,afterContactSeconds:.1}),again=compareMeasuredTrajectoriesV69({pitch,afterContactSeconds:.1}),
    limited=compareMeasuredTrajectoriesV69({pitch:{...pitch,batter:{...pitch.batter,maximumSweetSpotSpeedMps:12,targetSweetSpotSpeedMps:12}},afterContactSeconds:.1});
  for(let i=0;i<4;i++){expect(withoutFunctions(again.cases[i].pitch)).toEqual(withoutFunctions(one.cases[i].pitch));
    expect(limited.cases[i].pitch.diagnostics.referenceMaximumSweetSpotSpeedMps).toBeLessThanOrEqual(12*(1+1e-10));
    expect(limited.cases[i].pitch.diagnostics.sourceDescriptor).toEqual(one.cases[i].pitch.diagnostics.sourceDescriptor);
    expect(limited.cases[i].pitch.diagnostics.playbackRate).not.toBe(one.cases[i].pitch.diagnostics.playbackRate);}
});
it('retains a physical foul-side landing rather than forcing the comparison into fair hits',()=>{
  const base=input(),comparison=compareMeasuredTrajectoriesV69({pitch:{...base,pitchType:'fastball',batter:{...base.batter,
    timingStdSeconds:0,aimStdMeters:0,pullAngleDegrees:75}},afterContactSeconds:8});
  expect(comparison.cases.some(c=>c.metrics.firstGroundSide==='FOUL_SIDE'),JSON.stringify(comparison.cases.map(c=>({level:c.level,call:c.pitch.call,metrics:c.metrics})))).toBe(true);
  for(const row of comparison.cases.filter(c=>c.metrics.firstGroundSide==='FOUL_SIDE')){
    expect(row.pitch.contact).not.toBeNull();expect(row.metrics.firstGroundContact!.position.z).toBeLessThan(Math.abs(row.metrics.firstGroundContact!.position.x));
    expect(row.flightDescriptor!.initial.ball.velocity).toEqual(row.pitch.contact!.exitVelocity);
    expect(row.flightDescriptor!.initial.ball.spin).toEqual(row.pitch.contact!.exitSpin);
  }
});
it('rejects ambiguous clips, wrong handedness, unknown settings and non-inert inputs atomically',()=>{
  const pitch=input(),before=JSON.stringify(pitch);
  expect(()=>compareMeasuredTrajectoriesV69({pitch:{...pitch,measuredClips:clips}})).toThrow(/one explicit/);
  expect(()=>compareMeasuredTrajectoriesV69({pitch:{...pitch,batter:{...pitch.batter,clipId:'obp-missing'}}})).toThrow(/identity/);
  expect(()=>compareMeasuredTrajectoriesV69({pitch:{...pitch,batter:{...pitch.batter,bats:'L'}}})).toThrow(/side/);
  for(const afterContactSeconds of[0,.099,30.001,NaN])expect(()=>compareMeasuredTrajectoriesV69({pitch,afterContactSeconds})).toThrow();
  expect(()=>compareMeasuredTrajectoriesV69({pitch,unknown:1} as never)).toThrow(/unsupported/);
  let invoked=false;expect(()=>compareMeasuredTrajectoriesV69(Object.defineProperty({},'pitch',{enumerable:true,get(){invoked=true;return pitch;}}) as never)).toThrow(/accessors/);
  expect(invoked).toBe(false);expect(JSON.stringify(pitch)).toBe(before);
});
