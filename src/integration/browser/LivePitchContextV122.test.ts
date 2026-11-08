import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {simulateLivePitchV1,type LivePitchInputV1} from './LivePitchV1';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1} from './LiveBaseballMatchV1';
import {restoreLiveWorkloadV122} from './LiveWorkloadExecutionV122';
const clips=JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url),'utf8')).clips;
const fixture=():LivePitchInputV1=>({originTick:1000000,seed:3,batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'R',
 maximumSweetSpotSpeedMps:50,targetSweetSpotSpeedMps:30,motorLatencySeconds:.04,timingStdSeconds:0,aimStdMeters:0,
 swingPolicyV121:{version:'swing_policy_v121',sourceId:'intent-fixture',effort:.8,compactness:.3,controlPriority:.5,
 effortVariation:0,twoStrikeEffortDelta:-.2,twoStrikeCompactnessDelta:.4,maximumClockAccelerationPerSecond:40}},
 pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0},measuredClips:clips,batting:'balanced',pitchType:'curve',location:'zone',physics:LIVE_MATCH_PHYSICS_V1});
const signal=(delay:number)=>({scope:{sessionId:'s',matchId:'m',senderId:'manager',receiverId:'batter'},source:{sourceId:'signal-test',sourceVersion:'1',eventId:'e',
 sessionId:'s',matchId:'m',senderId:'manager',receiverId:'batter',sourceTick:1000000,sentAtElapsedSeconds:0,
 conditions:{propagationDelayTicks:delay,recognitionBaseDelayTicks:0,maxAdditionalRecognitionDelayTicks:0,audibility:1,recognition:1,attention:1,minimumRecognizableQuality:.5},
 instruction:{authority:'hard' as const,effort:.4,compactness:.9}}});
export const workloadFixtureV122=()=>({workload:restoreLiveWorkloadV122({sourceId:'workload-test',sourceVersion:'1',scope:{sessionId:'s',matchId:'m',careerId:'c',playerId:'pitcher',gameDay:1},
 baseline:{careerId:'c',playerId:'pitcher',createdAtDay:1,fatigue:.5,recoveryCapacity:1,
 policy:{policyId:'effort',version:'1',availableAtDay:1,workloadFatiguePerUnit:.01,travelFatiguePerKm:0,recoveryPerHour:.01}},activities:[],expectedRevision:0}),
 timingProfile:{baseStartIntervalUs:1000000,normalMotionToReleaseUs:800000,followThroughUs:400000,quickSpeedFactor:1,cadenceExecutionControl:1,cadenceTimingKnowledge:1,
 quickRepeatability:1,naturalVariationUs:0,normalPhaseWeights:{gather:1,transition:1,stride:1},quickPhaseWeights:{gather:1,transition:1,stride:1}},
 policy:{policyId:'response-test',version:'1',availableAtDay:1,motionDurationScaleAtFullFatigue:1.2,velocityRetentionAtFullFatigue:.9,spinRetentionAtFullFatigue:.8}});
it('uses exact reception at the actual decision cutoff, with no command leakage from later delivery',()=>{
 const i=fixture(),legacy=simulateLivePitchV1(i),late=simulateLivePitchV1({...i,managerCommunicationV122:signal(500000)}),
 early=simulateLivePitchV1({...i,managerCommunicationV122:signal(0)});
 expect(late.diagnostics.managerCommunicationV122!.status).toBe('NOT_ARRIVED');
 expect(late.diagnostics.swingIntentV121).toEqual(legacy.diagnostics.swingIntentV121);
 expect(late.frames).toEqual(legacy.frames);expect(late.contact).toEqual(legacy.contact);
 expect(early.diagnostics.managerCommunicationV122!.status).toBe('RECEIVED');
 expect(early.diagnostics.swingIntentV121).toMatchObject({effort:.4,compactness:.9,instructionAuthority:'hard'});
 expect(()=>simulateLivePitchV1({...i,managerCommunicationV122:signal(0),swingInstructionV121:{authority:'hard',effort:1,compactness:0}})).toThrow(/ambiguous/);
});
it('applies existing fatigue physics after nominal inverse aiming, retaining separate spin reproducibility',()=>{
 const i=fixture(),base=simulateLivePitchV1({...i,batting:'take'}),source=workloadFixtureV122(),before=JSON.stringify(source),
 r=simulateLivePitchV1({...i,batting:'take',pitchWorkloadV122:source}),d=r.diagnostics.pitchWorkloadV122!;
 expect(d.execution.physics.velocity.x).toBeCloseTo(base.diagnostics.sourceDescriptor.initial.ball.velocity.x*.95,12);
 expect(d.execution.physics.velocity.z).toBeCloseTo(base.diagnostics.sourceDescriptor.initial.ball.velocity.z*.95,12);
 expect(r.diagnostics.sourceDescriptor.initial.ball.spin.x).toBeCloseTo(base.diagnostics.sourceDescriptor.initial.ball.spin.x*.9,12);
 expect(r.diagnostics.sourceDescriptor.initial.ball.velocity).toEqual(d.execution.physics.velocity);
 expect(d.nominalPlanRetained).toBe(true);expect(d.timingApplication).toBe('NOT_CONNECTED_RELEASE_ANCHORED_BROWSER_HOST');
 expect(JSON.stringify(source)).toBe(before);expect(r.speedKmh).toBeCloseTo(base.speedKmh*.95,8);
});
it('uses an independent frozen joint prior and direction intent, while actual spray remains physical',()=>{
 const i=fixture(),profile={version:'batter_approach_v122' as const,sourceId:'approach-test',priorReliance:.8,directionCommitment:1,twoStrikeCommitmentDelta:0,
  preferredWhenCommitted:{pull:1,center:0,opposite:0},targetPullAnglesDegrees:{pull:25,center:0,opposite:-25}},belief={version:'batter_belief_v122' as const,
  sourceId:'observations-only',observerPlayerId:'b',pitcherId:'p',capturedAtTick:999999,observedThroughTick:900000,confidence:.7,evidenceRefs:['previous-ball'],
  candidates:[{familyId:'estimated-fast',regionId:'own-high',probability:1,prediction:{x:-.15,y:1.3,arrivalAfterReleaseSeconds:.4}}]},
  source={...i,batter:{...i.batter,batterApproachV122:profile},batterBeliefV122:{belief,observerPlayerId:'b',pitcherId:'p'}},
  a=simulateLivePitchV1(source),b=simulateLivePitchV1({...source,pitchType:'fastball'}),d=a.diagnostics.batterIntentV122!;
 expect(d.selectedJointHypothesis).toEqual(b.diagnostics.batterIntentV122!.selectedJointHypothesis);
 expect(d.direction).toEqual(b.diagnostics.batterIntentV122!.direction);expect(d.direction.aim).toBe('PULL');
 expect(d.belief!.capturedAtTick).toBe(i.originTick);expect(d.opponentPrivateStateUsed).toBe(false);
 expect(d.preparedAndObservedPrediction).not.toEqual(d.observedPrediction);
 if(a.contact)expect(d.actualSprayAngleDegrees).toBeCloseTo(Math.atan2(a.contact.exitVelocity.x,a.contact.exitVelocity.z)*180/Math.PI);
 else expect(d.actualSprayAngleDegrees).toBeNull();
});
it('extends the finite physical horizon from actual fatigued release velocity',()=>{
 const i=fixture(),source=workloadFixtureV122(),r=simulateLivePitchV1({...i,batting:'take',pitchWorkloadV122:{...source,
  workload:{...source.workload,state:{...source.workload.state,fatigue:1}},policy:{...source.policy,velocityRetentionAtFullFatigue:.5}}});
 expect(r.diagnostics.sourceDescriptor.throughElapsedSeconds).toBeGreaterThan(1);
 expect(r.diagnostics.sourceDescriptor.initial.ball.velocity.z).toBeGreaterThan(-25);
});
