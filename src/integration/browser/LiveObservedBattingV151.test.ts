import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { simulateLivePitchV1, type LivePitchInputV1 } from './LivePitchV1';
import { createLiveBaseballMatchWorkerV116, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { createLiveBattingPracticeV150 } from './LiveBattingPracticeV150';
import { AUTHORED_LIVE_BATTER_OBSERVATION_V151 as policy } from './LiveBatterObservationV151';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

const clips=JSON.parse(readFileSync('docs/demos/measured-bat-motions.json','utf8')).clips;
const fixture=():LivePitchInputV1=>({originTick:1_000_000,seed:31,batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
  heightMeters:1.8,bats:'R',timingStdSeconds:0,aimStdMeters:0,motorLatencySeconds:.04},
  pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0},measuredClips:clips,
  batting:'take',pitchType:'curve',location:'zone',physics:LIVE_MATCH_PHYSICS_V1,batterObservationV151:policy});
const take={managedTeam:0 as const,batting:'take' as const,pitchType:'auto',location:'auto'};

it('uses a release-owned decision clock and position-only raw forecast, retaining physical pitch/error streams',()=>{
  const input={...fixture(),batter:{...fixture().batter,timingStdSeconds:.009,aimStdMeters:.022}},
    {batterObservationV151:_observer,...legacy}=input,old=simulateLivePitchV1(legacy),actual=simulateLivePitchV1(input),
    d=actual.diagnostics.batterObservationV151!;
  expect(d.decisionTick).toBe(1_140_000);expect(d.rawForecast.status).toBe('PREDICTED');
  expect(d.rawForecast.usedObservationIds).toHaveLength(3);expect(d.preparedRecall).toBeNull();expect(d.effectivePriorWeight).toBe(0);
  expect(actual.diagnostics.sourceDescriptor).toEqual(old.diagnostics.sourceDescriptor);
  for(const field of ['timingErrorSeconds','aimErrorMeters','sweetSpotT'] as const)expect(actual.diagnostics[field]).toEqual(old.diagnostics[field]);
  for(const speed of [25,60])expect(simulateLivePitchV1({...input,pitcher:{...input.pitcher,releaseSpeedMps:speed}})
    .diagnostics.batterObservationV151!.decisionTick).toBe(d.decisionTick);
  expect(d.rawForecast.opponentPrivateStateUsed).toBe(false);
});

it('does not turn missing delivered observations into an intentional take or a future-state forecast',()=>{
  const input=fixture(),r=simulateLivePitchV1({...input,batting:'balanced',batter:{...input.batter,
    swingDecision:{approach:'SWING',threshold:0,aggressionWeight:1}},batterObservationV151:{...policy,deliveryLatencyTicks:300_000}});
  expect(r.diagnostics.batterObservationV151!.rawForecast.status).toBe('NO_DELIVERED_OBSERVATIONS');
  expect(r.diagnostics.batterObservationV151!.decisionStatus).toBe('NO_DELIVERED_PREDICTION');
  expect(r.diagnostics.swingOffered).toBe(false);
});

it('captures the first accepted raw forecast without a prior and uses only that experience on the next pitch',()=>{
  const config={...liveMatchFixture(2468),batterObservationV151:policy},host=createLiveBaseballMatchWorkerV116(config),
    first=host.issuePitch(take),d1=(first.play.diagnostics as ReturnType<typeof simulateLivePitchV1>['diagnostics']).batterObservationV151!,
    saved=host.captureContinuationV116(),second=host.issuePitch(take),d2=(second.play.diagnostics as ReturnType<typeof simulateLivePitchV1>['diagnostics']).batterObservationV151!;
  expect(d1.preparedRecall).toBeNull();expect(saved.batterObservedMemoryV151!.memories[0].totalObservations).toBe(1);
  expect(d2.preparedRecall).toMatchObject({kind:'UNCLASSIFIED_EMPIRICAL_FORECAST',eligibleObservationCount:1,confidence:null,pitchFamilyRecognized:false});
  expect(d2.preparedRecall!.position).toEqual(d1.rawForecast.prediction!.position);expect(d2.effectivePriorWeight).toBe(.25);
  expect(d2.preparedAndObservedPrediction).not.toEqual(d2.rawForecast.prediction!.position);
  const entries=host.captureContinuationV116().batterObservedMemoryV151!.memories[0].entries;
  expect(entries).toHaveLength(2);expect(entries[1].position).toEqual(d2.rawForecast.prediction!.position);
  expect(entries[1].position).not.toEqual(d2.preparedAndObservedPrediction);
});

it('never blends a placeholder position when current observations are missing, or treats a zero-weight memory as delivered',()=>{
  const host=createLiveBaseballMatchWorkerV116({...liveMatchFixture(2468),batterObservationV151:policy});host.issuePitch(take);
  const memory=host.captureContinuationV116().batterObservedMemoryV151!.memories[0],base=fixture();
  const run=(weight:number)=>simulateLivePitchV1({...base,originTick:host.captureContinuationV116().nextTick,batting:'balanced',
    batter:{...base.batter,swingDecision:{approach:'SWING',threshold:0,aggressionWeight:1}},
    batterObservedMemoryV151:{memory,observerPlayerId:memory.observerPlayerId,pitcherId:memory.pitcherId},
    batterObservationV151:{...policy,deliveryLatencyTicks:300_000,memoryPolicy:{...policy.memoryPolicy,unprofiledPriorWeight:weight}}});
  const ignored=run(0);expect(ignored.diagnostics.batterObservationV151!.decisionStatus).toBe('NO_DELIVERED_PREDICTION');
  expect(ignored.diagnostics.swingOffered).toBe(false);
  const priorOnly=run(.25),d=priorOnly.diagnostics.batterObservationV151!;
  expect(d.rawForecast.status).toBe('NO_DELIVERED_OBSERVATIONS');expect(d.effectivePriorWeight).toBe(1);
  expect(d.preparedAndObservedPrediction).toEqual(memory.entries[0].position);
});

it('preserves learned memory and full records across Host/practice previews and serialized continuation',()=>{
  const config={...liveMatchFixture(2468),batterObservationV151:policy},host=createLiveBaseballMatchWorkerV116(config),practice=createLiveBattingPracticeV150(config);
  expect(practice.issuePitch({batting:'take'})).toEqual(host.issuePitch(take));
  const before=practice.capture(),one=practice.preview({batting:'take'}),two=practice.preview({batting:'take'});
  expect(one.record).toEqual(two.record);expect(practice.capture()).toEqual(before);
  const resumed=createLiveBaseballMatchWorkerV116(config,structuredClone(host.captureContinuationV116()));
  expect(practice.accept(two)).toEqual(host.issuePitch(take));expect(resumed.issuePitch(take)).toEqual(two.record);
  expect(practice.capture().continuation).toEqual(host.captureContinuationV116());
});

it('binds memory to the observation policy and rejects missing/foreign continuation state',()=>{
  const config={...liveMatchFixture(2468),batterObservationV151:policy},host=createLiveBaseballMatchWorkerV116(config);host.issuePitch(take);
  const saved=host.captureContinuationV116();
  const {batterObservationV151:_policy,...legacy}=config,{batterObservedMemoryV151:_memory,...missing}=saved;
  expect(()=>createLiveBaseballMatchWorkerV116({...config,batterObservationV151:{...policy,sourceId:'different'}},saved)).toThrow(/observation|memory/);
  expect(()=>createLiveBaseballMatchWorkerV116(legacy,saved)).toThrow(/observation|memory/);
  expect(()=>createLiveBaseballMatchWorkerV116(config,missing)).toThrow(/observation|memory/);
  expect(host.captureContinuationV116()).toEqual(saved);
});

it('does not consume memory when an invalid one-pitch instruction is rejected',()=>{
  const host=createLiveBaseballMatchWorkerV116({...liveMatchFixture(2468),batterObservationV151:policy}),before=host.captureContinuationV116();
  expect(()=>host.issuePitch({...take,battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'test',mode:'INVALID'} as never})).toThrow();
  expect(host.captureContinuationV116()).toEqual(before);
});

it('uses position-only late evidence behind the existing finite motor correction and pre-contact boundary',()=>{
  const input=fixture(),r=simulateLivePitchV1({...input,batting:'balanced',batter:{...input.batter,plateVision:100,
    maximumSweetSpotSpeedMps:50,targetSweetSpotSpeedMps:30,swingDecision:{approach:'SWING',threshold:0,aggressionWeight:1}}});
  expect(r.diagnostics.batterObservationV151!.rawForecast.status).toBe('PREDICTED');
  const late=r.diagnostics.lateEvidenceV121!;
  expect(late.deliveryModel).toBe('POSITION_ONLY_DELIVERED_OBSERVATIONS_V151');
  expect(late.observedTick).toBeLessThanOrEqual(late.availableTick);
  if(late.rawForecast?.observedThroughTick!==null&&late.rawForecast?.observedThroughTick!==undefined)
    expect(late.rawForecast.observedThroughTick).toBeLessThanOrEqual(input.originTick+late.prefixSearchedThroughElapsedSeconds!*1_000_000);
  if(r.contact&&late.applied)expect(late.availableTick).toBeLessThanOrEqual(r.contact.tick);
  expect(late.futureSourceUsed).toBe(false);
});
