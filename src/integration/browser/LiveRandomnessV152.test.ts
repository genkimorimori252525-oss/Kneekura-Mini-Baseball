import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { simulateLivePitchV1, type LivePitchInputV1 } from './LivePitchV1';
import { createLiveBaseballMatchWorkerV116, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { createLiveBattingPracticeV150 } from './LiveBattingPracticeV150';
import { AUTHORED_LIVE_BATTER_OBSERVATION_V151 } from './LiveBatterObservationV151';
import { AUTHORED_MATCH_RANDOMNESS_V152 as matchPolicy, AUTHORED_PLAY_RANDOMNESS_V152 as playPolicy,
  createLivePlayRandomStreamsV152, type LiveRandomDomainV152, type LiveRandomnessV152 } from '../../core/rng/LiveRandomStreamsV152';
import { resolveBatterIntentV122, type BatterApproachV122 } from '../../core/decision/batting/BatterIntentV122';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

const clips=JSON.parse(readFileSync('docs/demos/measured-bat-motions.json','utf8')).clips;
const approach:BatterApproachV122={version:'batter_approach_v122',sourceId:'SYNTHETIC_DISTRIBUTION_NOT_PERSONAL_DATA',priorReliance:.4,
  directionCommitment:.7,twoStrikeCommitmentDelta:0,preferredWhenCommitted:{pull:.7,center:.2,opposite:.1},targetPullAnglesDegrees:{pull:25,center:0,opposite:-25}};
const override=(domain:LiveRandomDomainV152,seed:number):LiveRandomnessV152=>({...playPolicy,overrides:{[domain]:seed}});
function fixture():LivePitchInputV1 {
  return {originTick:1_000_000,seed:31,randomnessV152:playPolicy,batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,
    batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'R',maximumSweetSpotSpeedMps:50,targetSweetSpotSpeedMps:30,
      motorLatencySeconds:.04,zoneJudgmentStdMeters:.02,batterApproachV122:approach,
      swingDecision:{approach:'SWING',threshold:0,aggressionWeight:1},
      swingPolicyV121:{version:'swing_policy_v121',sourceId:'SYNTHETIC_POLICY',effort:.8,compactness:.3,controlPriority:.5,
        effortVariation:.1,twoStrikeEffortDelta:-.2,twoStrikeCompactnessDelta:.4,maximumClockAccelerationPerSecond:40}},
    pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:.06,minimumSpinRatio:.8},measuredClips:clips,
    batterBeliefV122:{observerPlayerId:'b',pitcherId:'p',belief:{version:'batter_belief_v122',sourceId:'AUTHORED_OWN_PAST_OBSERVATIONS',
      observerPlayerId:'b',pitcherId:'p',capturedAtTick:900_000,observedThroughTick:800_000,confidence:.6,evidenceRefs:['past'],
      candidates:[{familyId:'estimated-fast',regionId:'low',probability:.5,prediction:{x:.1,y:.7,arrivalAfterReleaseSeconds:.4}},
        {familyId:'estimated-slow',regionId:'high',probability:.5,prediction:{x:-.1,y:1.2,arrivalAfterReleaseSeconds:.55}}]}},
    batting:'balanced',pitchType:'auto',location:'zone',physics:LIVE_MATCH_PHYSICS_V1};
}
const errors=(r:ReturnType<typeof simulateLivePitchV1>)=>({timing:r.diagnostics.timingErrorSeconds,aim:r.diagnostics.aimErrorMeters,sweetSpot:r.diagnostics.sweetSpotT});
const prior=(r:ReturnType<typeof simulateLivePitchV1>)=>r.diagnostics.batterIntentV122!.selectedJointHypothesis;

it('changes only motor error draws when its explicit group seed changes',()=>{
  const input=fixture(),a=simulateLivePitchV1(input),b=simulateLivePitchV1({...input,randomnessV152:override('batterExecution',12345)});
  expect(b.diagnostics.randomnessV152).toBeDefined();expect(errors(b)).not.toEqual(errors(a));
  expect(b.diagnostics.sourceDescriptor).toEqual(a.diagnostics.sourceDescriptor);
  expect(b.diagnostics.measuredClipId).toBe(a.diagnostics.measuredClipId);expect(prior(b)).toEqual(prior(a));
  expect(b.diagnostics.batterIntentV122!.direction).toEqual(a.diagnostics.batterIntentV122!.direction);
  expect(b.diagnostics.swingIntentV121).toEqual(a.diagnostics.swingIntentV121);
  expect(b.diagnostics.zoneJudgment).toEqual(a.diagnostics.zoneJudgment);
  expect(b.diagnostics.batterObservationV151!.rawForecast).toEqual(a.diagnostics.batterObservationV151!.rawForecast);
});

it('separates direction commitment/choice from the joint belief, form, effort, perception and execution',()=>{
  const input=fixture(),a=simulateLivePitchV1(input),directions=new Set<string>();
  for(const seed of [3,9,17,31,99,127,255,1023]){
    const b=simulateLivePitchV1({...input,randomnessV152:override('batterDirection',seed)});
    directions.add(JSON.stringify(b.diagnostics.batterIntentV122!.direction));
    expect(prior(b)).toEqual(prior(a));expect(b.diagnostics.sourceDescriptor).toEqual(a.diagnostics.sourceDescriptor);
    expect(b.diagnostics.measuredClipId).toBe(a.diagnostics.measuredClipId);expect(errors(b)).toEqual(errors(a));
    expect(b.diagnostics.swingIntentV121).toEqual(a.diagnostics.swingIntentV121);expect(b.diagnostics.zoneJudgment).toEqual(a.diagnostics.zoneJudgment);
  }
  expect(directions.size).toBeGreaterThan(1);
});

it('keeps pitch/execution streams fixed when an automatic menu is replaced with its selected explicit pitch',()=>{
  const input=fixture(),a=simulateLivePitchV1(input),b=simulateLivePitchV1({...input,pitchType:a.pitchType});
  expect(b.diagnostics.sourceDescriptor).toEqual(a.diagnostics.sourceDescriptor);expect(errors(b)).toEqual(errors(a));
  expect(prior(b)).toEqual(prior(a));expect(b.diagnostics.measuredClipId).toBe(a.diagnostics.measuredClipId);
});

it('does not let random clip selection shift the actual incoming Source or motor samples',()=>{
  const input=fixture(),a=simulateLivePitchV1(input),ids=new Set<string>();
  for(const seed of [3,9,17,31,99,127,255,1023]){
    const b=simulateLivePitchV1({...input,randomnessV152:override('batterForm',seed)});ids.add(b.diagnostics.measuredClipId);
    expect(b.diagnostics.sourceDescriptor).toEqual(a.diagnostics.sourceDescriptor);expect(errors(b)).toEqual(errors(a));expect(prior(b)).toEqual(prior(a));
  }
  expect(ids.size).toBeGreaterThan(1);
});

it('routes the legacy direction-trial alias to direction only in the explicit version',()=>{
  const input=fixture(),a=simulateLivePitchV1(input),alias=simulateLivePitchV1({...input,directionTrialSeedV79:123}),
    explicit=simulateLivePitchV1({...input,randomnessV152:override('batterDirection',123)});
  expect(alias.diagnostics.batterIntentV122!.direction).toEqual(explicit.diagnostics.batterIntentV122!.direction);
  expect(prior(alias)).toEqual(prior(a));expect(errors(alias)).toEqual(errors(a));
});

it('does not let motor interventions change a received manager instruction',()=>{
  const input=fixture(),source={sourceId:'signal-test',sourceVersion:'1',eventId:'e',sessionId:'s',matchId:'m',senderId:'manager',receiverId:'b',
    sourceTick:1_000_000,sentAtElapsedSeconds:0,conditions:{propagationDelayTicks:0,recognitionBaseDelayTicks:0,maxAdditionalRecognitionDelayTicks:50_000,
      audibility:1,recognition:.8,attention:.9,minimumRecognizableQuality:.5},instruction:{authority:'hard' as const,effort:.4,compactness:.9}},
    fixed={...input,managerCommunicationV122:{source,scope:{sessionId:'s',matchId:'m',senderId:'manager',receiverId:'b'}}},
    a=simulateLivePitchV1(fixed),b=simulateLivePitchV1({...fixed,randomnessV152:override('batterExecution',987)});
  expect(a.diagnostics.managerCommunicationV122!.status).toBe('RECEIVED');
  expect(b.diagnostics.managerCommunicationV122).toEqual(a.diagnostics.managerCommunicationV122);
  expect(b.diagnostics.swingIntentV121).toEqual(a.diagnostics.swingIntentV121);expect(b.diagnostics.zoneJudgment).toEqual(a.diagnostics.zoneJudgment);
});

it('preserves a one-pitch intervention across normal Host, preview acceptance and serialized restart',()=>{
  const config={...liveMatchFixture(2468),randomnessV152:matchPolicy,batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151},
    host=createLiveBaseballMatchWorkerV116(config),practice=createLiveBattingPracticeV150(config),
    take={managedTeam:0 as const,batting:'take' as const,pitchType:'auto',location:'auto'};
  expect(practice.issuePitch({batting:'take'})).toEqual(host.issuePitch(take));
  const saved=host.captureContinuationV116(),resumed=createLiveBaseballMatchWorkerV116(config,structuredClone(saved)),
    request={batting:'take' as const,randomnessV152:override('batterExecution',99)},before=practice.capture(),candidate=practice.preview(request);
  expect(practice.capture()).toEqual(before);expect(candidate.record).toEqual(host.issuePitch({...take,randomnessV152:request.randomnessV152}));
  expect(practice.accept(candidate)).toEqual(resumed.issuePitch({...take,randomnessV152:request.randomnessV152}));
  expect(practice.capture().continuation).toEqual(host.captureContinuationV116());
  expect(()=>createLiveBaseballMatchWorkerV116({...config,randomnessV152:{...matchPolicy,sourceId:'other'}},saved)).toThrow(/random/);
});

it('validates MATCH versus PLAY scope without consuming an accepted state',()=>{
  expect(()=>simulateLivePitchV1({...fixture(),randomnessV152:matchPolicy})).toThrow(/scope/);
  const config={...liveMatchFixture(2468),randomnessV152:matchPolicy},host=createLiveBaseballMatchWorkerV116(config),before=host.captureContinuationV116();
  expect(()=>host.issuePitch({managedTeam:0,batting:'take',pitchType:'auto',location:'auto',randomnessV152:matchPolicy})).toThrow(/scope/);
  expect(host.captureContinuationV116()).toEqual(before);
});

it('uses a predeclared unique seed cohort for positive weights and never selects a zero-weight direction',()=>{
  const n=2048,counts={PULL:0,CENTER:0,OPPOSITE:0},allPull={...approach,directionCommitment:1,preferredWhenCommitted:{pull:1,center:0,opposite:0}};
  for(let index=0;index<n;index++){
    const seed=(0x13579bdf+Math.imul(index,0x9e3779b9))>>>0,stream=createLivePlayRandomStreamsV152(seed,playPolicy),
      draws={beliefDraw:stream.rng('batterBelief','joint-hypothesis').uniform(),commitmentDraw:stream.rng('batterDirection','commitment').uniform(),
        directionDraw:stream.rng('batterDirection','choice').uniform()},
      r=resolveBatterIntentV122({profile:{...approach,directionCommitment:1},selectedAtTick:1000,strikes:0,bats:'R',...draws});
    counts[r.direction.aim!]++;
    expect(resolveBatterIntentV122({profile:allPull,selectedAtTick:1000,strikes:0,bats:'R',...draws}).direction.aim).toBe('PULL');
  }
  // Predeclared Hoeffding bound for three marginals at alpha=1e-6.
  const tolerance=Math.sqrt(Math.log(6/1e-6)/(2*n));
  expect(Math.abs(counts.PULL/n-.7)).toBeLessThan(tolerance);expect(Math.abs(counts.CENTER/n-.2)).toBeLessThan(tolerance);
  expect(Math.abs(counts.OPPOSITE/n-.1)).toBeLessThan(tolerance);
});
