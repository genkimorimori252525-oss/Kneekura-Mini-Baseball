import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {simulateLivePitchV1,type LivePitchInputV1} from './LivePitchV1';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1} from './LiveBaseballMatchV1';
import {createLiveBatPlaybackV88} from './LiveBatPlaybackV88';
import {validateSwingExecutionV122} from './LiveSwingExecutionV122';
const clips=JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url),'utf8')).clips;
const limits={version:'swing_execution_v122' as const,sourceId:'authored-test-only',interpolation:'cubic-c1' as const,
 maximumGripAccelerationMps2:160,maximumAngularAccelerationRadPerSecond2:500,maximumSweetSpotAccelerationMps2:450,
 maximumCorrectionMeters:.12};
const fixture=():LivePitchInputV1=>({originTick:1000000,seed:3,batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'R',
 maximumSweetSpotSpeedMps:50,targetSweetSpotSpeedMps:30,motorLatencySeconds:.04,timingStdSeconds:0,aimStdMeters:0,
 swingPolicyV121:{version:'swing_policy_v121',sourceId:'intent-fixture',effort:.8,compactness:.3,controlPriority:.5,
 effortVariation:0,twoStrikeEffortDelta:-.2,twoStrikeCompactnessDelta:.4,maximumClockAccelerationPerSecond:40}},
 pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0},measuredClips:clips,batting:'balanced',pitchType:'curve',location:'zone',physics:LIVE_MATCH_PHYSICS_V1});
it('uses explicit C1 acceleration limits in the actual contact sampler and exact replay',()=>{
 const i=fixture(),r=simulateLivePitchV1({...i,batter:{...i.batter,swingExecutionV122:limits}}),d=r.diagnostics.swingExecutionV122!;
 expect(d.sourceId).toBe(limits.sourceId);expect(d.interpolation).toBe('cubic-c1');expect(d.playerLimitsMeasured).toBe(false);
 expect(d.bounds.maximumGripAccelerationMps2).toBeLessThanOrEqual(limits.maximumGripAccelerationMps2*(1+1e-9));
 expect(d.bounds.maximumAngularAccelerationRadPerSecond2).toBeLessThanOrEqual(limits.maximumAngularAccelerationRadPerSecond2*(1+1e-9));
 expect(d.bounds.maximumSweetSpotAccelerationMps2).toBeLessThanOrEqual(limits.maximumSweetSpotAccelerationMps2*(1+1e-9));
 const replay=createLiveBatPlaybackV88({descriptor:r.diagnostics.batPlaybackV88!,measuredClip:clips.find((c:any)=>c.id===r.clipId)});
 for(let t=i.originTick;t<replay.throughTick;t+=8000)expect(replay.sampleAtTick(t)).toEqual(r.sampleBatAtTick(t));
});
it('does not silently add physical limits, rewrite source keys, or boost a restrictive profile',()=>{
 const i=fixture(),raw=JSON.stringify(i),legacy=simulateLivePitchV1(i),a=simulateLivePitchV1({...i,batter:{...i.batter,swingExecutionV122:limits}}),
 b=simulateLivePitchV1({...i,batter:{...i.batter,swingExecutionV122:{...limits,maximumGripAccelerationMps2:40,maximumAngularAccelerationRadPerSecond2:100,maximumSweetSpotAccelerationMps2:90}}});
 expect(legacy.diagnostics).not.toHaveProperty('swingExecutionV122');expect(JSON.stringify(i)).toBe(raw);
 expect(b.diagnostics.playbackRate).toBeLessThanOrEqual(a.diagnostics.playbackRate);
 expect(a.diagnostics.obpSourceSha256).toBe(legacy.diagnostics.obpSourceSha256);
 expect(b.diagnostics.unsupportedReason).toBeNull();
});
it('validates explicit source limits and refuses unversioned or zero acceleration',()=>{
 expect(validateSwingExecutionV122(limits)).toEqual(limits);
 expect(()=>validateSwingExecutionV122({...limits,maximumGripAccelerationMps2:0})).toThrow();
 expect(()=>validateSwingExecutionV122({...limits,extra:1})).toThrow();
});
it('never starts the C1 motor before the observation even without an optional intent or latency profile',()=>{
 const i=fixture(),{swingPolicyV121:_policy,motorLatencySeconds:_latency,...batter}=i.batter,
 r=simulateLivePitchV1({...i,batter:{...batter,swingExecutionV122:limits,swingDecision:{approach:'SWING',threshold:0,aggressionWeight:1}}});
 expect(r.diagnostics.referenceStartTick).toBeGreaterThanOrEqual(i.originTick+Math.ceil(r.diagnostics.predictionMadeAtElapsedSeconds*1e6));
 expect(r.sampleBatAtTick(i.originTick+10000)).toEqual(r.sampleBatAtTick(i.originTick+20000));
});
it('bounds the actual dedicated bunt motor rather than certifying an unused reference',()=>{
 const i=fixture(),r=simulateLivePitchV1({...i,batting:'bunt',batter:{...i.batter,swingExecutionV122:{...limits,maximumGripAccelerationMps2:5,maximumAngularAccelerationRadPerSecond2:20,maximumSweetSpotAccelerationMps2:20},
 technicalSkills:{bunting:1},swingDecision:{approach:'SWING',threshold:0,aggressionWeight:1}}}),h=100;
 expect(r.diagnostics.swingExecutionV122!.bounds.maximumGripAccelerationMps2).toBeLessThanOrEqual(5*(1+1e-9));
 for(let t=i.originTick+h;t<r.endedAtTick-h;t+=1500){const a=r.sampleBatAtTick(t-h)!,b=r.sampleBatAtTick(t)!,c=r.sampleBatAtTick(t+h)!;
  if(!a||!b||!c)continue;
  const acceleration=Math.hypot(...(['x','y','z'] as const).map(k=>(c.grip[k]-2*b.grip[k]+a.grip[k])/(h/1e6)**2));
  expect(acceleration).toBeLessThanOrEqual(5.001);
 }
});
it('replays a nonzero delivered late correction under the same C1 acceleration budget',()=>{
 const i=fixture(),r=simulateLivePitchV1({...i,batter:{...i.batter,plateVision:100,targetSweetSpotSpeedMps:10,maximumSweetSpotSpeedMps:70,
  swingExecutionV122:{...limits,maximumGripAccelerationMps2:1e6,maximumAngularAccelerationRadPerSecond2:1e6,maximumSweetSpotAccelerationMps2:1e6},
  swingDecision:{approach:'SWING',threshold:0,aggressionWeight:1},batterApproachV122:{version:'batter_approach_v122',sourceId:'deliberately-wrong-prior',priorReliance:1,directionCommitment:0,
   twoStrikeCommitmentDelta:0,preferredWhenCommitted:{pull:1,center:0,opposite:0},targetPullAnglesDegrees:{pull:25,center:0,opposite:-25}}},
  batterBeliefV122:{observerPlayerId:'b',pitcherId:'p',belief:{version:'batter_belief_v122',sourceId:'own-test-prior',observerPlayerId:'b',pitcherId:'p',capturedAtTick:900000,
   observedThroughTick:800000,confidence:1,evidenceRefs:['own-previous-test'],candidates:[{familyId:'hypothesis',regionId:'high',probability:1,prediction:{x:.3,y:1.5,arrivalAfterReleaseSeconds:.5}}]}}}),
  correction=r.diagnostics.lateEvidenceV121!;
 expect(correction.applied).toBe(true);expect(Math.hypot(...Object.values(correction.offset))).toBeGreaterThan(0);
 const replay=createLiveBatPlaybackV88({descriptor:r.diagnostics.batPlaybackV88!,measuredClip:clips.find((c:any)=>c.id===r.clipId)});
 for(let t=correction.correctionFromTick;t<=correction.throughTick;t+=(correction.throughTick-correction.correctionFromTick)/17)
  expect(replay.sampleAtTick(t)).toEqual(r.sampleBatAtTick(t));
 expect(r.diagnostics.swingExecutionV122!.bounds.maximumSweetSpotAccelerationMps2).toBeLessThanOrEqual(1e6);
});
