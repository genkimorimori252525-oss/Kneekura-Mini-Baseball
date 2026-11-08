import { expect, it } from 'vitest';
import { AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222 as region } from '../../core/decision/batting/BatterObservedRegionExperienceV222';
import { AUTHORED_LIVE_BATTER_OBSERVATION_V151 as observation, createLiveBatterPositionObserverV151 } from './LiveBatterObservationV151';
import { createLiveBaseballMatchWorkerV116, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { createLiveBattingPracticeV150 } from './LiveBattingPracticeV150';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
const take={managedTeam:0 as const,batting:'take' as const,pitchType:'auto',location:'auto'};
it('V222 commits paired decision evidence only upon acceptance and resumes an exact next record',()=>{
 const config={...liveMatchFixture(2468),batterObservationV151:observation,batterObservedRegionExperienceV222:region};
 const host=createLiveBaseballMatchWorkerV116(config),practice=createLiveBattingPracticeV150(config),before=practice.capture();
 const preview=practice.preview({batting:'take'});expect(practice.capture()).toEqual(before);
 expect(practice.accept(preview)).toEqual(host.issuePitch(take));
 const saved=host.captureContinuationV116(),sidecar=saved.batterObservedRegionExperienceV222!.entries[0],memory=saved.batterObservedMemoryV151!.memories[0].entries[0];
 expect(sidecar.evidenceId).toBe(memory.evidenceId);expect(sidecar.samples.map(s=>s.observationId)).toEqual(memory.sourceObservationIds);
 expect(sidecar.cutoffTick).toBe(memory.availableTick);expect(sidecar.rawForecast.prediction!.position).toEqual(memory.position);
 expect(sidecar.familyId).toBeNull();expect(sidecar.confidence).toBeNull();expect(sidecar.humanCalibration).toBe('NOT_MEASURED');
 const resumed=createLiveBaseballMatchWorkerV116(config,structuredClone(saved));expect(resumed.issuePitch(take)).toEqual(host.issuePitch(take));
 expect(resumed.captureContinuationV116()).toEqual(host.captureContinuationV116());
});
it('V222 rejects missing or mismatched paired state and retains old policy-free continuation',()=>{
 const config={...liveMatchFixture(2468),batterObservationV151:observation,batterObservedRegionExperienceV222:region};
 const host=createLiveBaseballMatchWorkerV116(config);host.issuePitch(take);const saved=host.captureContinuationV116();
 const {batterObservedRegionExperienceV222:_sidecar,...missing}=saved;
 expect(()=>createLiveBaseballMatchWorkerV116(config,missing)).toThrow(/region experience/);
 const altered=structuredClone(saved);(altered.batterObservedRegionExperienceV222!.entries[0] as {pitchOrdinal:number}).pitchOrdinal++;
 expect(()=>createLiveBaseballMatchWorkerV116(config,altered)).toThrow(/region experience/);
 const {batterObservedRegionExperienceV222:_policy,...oldConfig}=config,old=createLiveBaseballMatchWorkerV116(oldConfig);old.issuePitch(take);
 const oldSaved=old.captureContinuationV116();expect(oldSaved).not.toHaveProperty('batterObservedRegionExperienceV222');
 expect(createLiveBaseballMatchWorkerV116(oldConfig,structuredClone(oldSaved)).issuePitch(take)).toEqual(old.issuePitch(take));
 expect(()=>createLiveBaseballMatchWorkerV116(oldConfig,saved)).toThrow(/region experience/);
});

it('V222 retains the explicit V122 belief priority over its region experience',()=>{
 const base=liveMatchFixture(31),observerPlayerId=base.teams[0].battingOrder[0],pitcherId=base.teams[1].pitcherId;
 const approach={version:'batter_approach_v122' as const,sourceId:'test',priorReliance:.2,directionCommitment:0,twoStrikeCommitmentDelta:0,
  preferredWhenCommitted:{pull:1,center:0,opposite:0},targetPullAnglesDegrees:{pull:25,center:0,opposite:-25}};
 const config={...base,players:base.players.map(p=>({...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,batterApproachV122:approach}})),batterObservationV151:observation,batterObservedRegionExperienceV222:region,
  batterKnowledgeV122:[{version:'batter_belief_v122' as const,sourceId:'own-history',observerPlayerId,pitcherId,capturedAtTick:500000,observedThroughTick:400000,
   confidence:.5,evidenceRefs:['old'],candidates:[{familyId:'estimated-fast',regionId:'centre',probability:1,prediction:{x:0,y:1,arrivalAfterReleaseSeconds:.4}}]}]};
 const host=createLiveBaseballMatchWorkerV116(config);host.issuePitch(take);const second=host.issuePitch(take);
 expect((second.play.diagnostics as {batterObservationV151:{preparedPredictionOwner:string}}).batterObservationV151.preparedPredictionOwner).toBe('EXPLICIT_BELIEF_V122');
});

it('V222 snapshots the exact cutoff without exposing a new method on the legacy observer',()=>{
 const make=(enabled:boolean)=>createLiveBatterPositionObserverV151({policy:observation,originTick:1000000,planeZ:0},seconds=>({tick:1000000+Math.round(seconds*1000000),position:{x:0,y:1,z:10-seconds*40}}),enabled);
 const legacy=make(false);expect(legacy).not.toHaveProperty('snapshotAt');
 const observer=make(true),raw=observer.forecastAt(observer.decisionTick),snapshot=observer.snapshotAt!(observer.decisionTick)!;
 expect(snapshot.forecast).toEqual(raw);expect(snapshot.observations.map(o=>o.observationId)).toEqual(raw.usedObservationIds);
 expect(Object.isFrozen(snapshot)).toBe(true);expect(Object.isFrozen(snapshot.observations)).toBe(true);
 observer.forecastAt(observer.decisionTick+20000);expect(observer.snapshotAt!(observer.decisionTick)).toEqual(snapshot);
});

it('V222-boundary evicts the V151 entry and paired sidecar together at a one-entry limit',()=>{
 const policy={...observation,memoryPolicy:{...observation.memoryPolicy,maximumEntriesPerPair:1}};
 const config={...liveMatchFixture(2468),batterObservationV151:policy,batterObservedRegionExperienceV222:region};
 const host=createLiveBaseballMatchWorkerV116(config);host.issuePitch(take);const first=host.captureContinuationV116();host.issuePitch(take);
 const second=host.captureContinuationV116(),memory=second.batterObservedMemoryV151!.memories[0],sidecars=second.batterObservedRegionExperienceV222!.entries;
 expect(memory.entries).toHaveLength(1);expect(sidecars).toHaveLength(1);expect(sidecars[0].evidenceId).toBe(memory.entries[0].evidenceId);
 expect(sidecars[0].evidenceId).not.toBe(first.batterObservedRegionExperienceV222!.entries[0].evidenceId);
 expect(createLiveBaseballMatchWorkerV116(config,structuredClone(second)).captureContinuationV116()).toEqual(second);
});
it.each(['observerPlayerId','pitcherId'] as const)('V222-boundary rejects a sidecar with foreign %s',key=>{
 const config={...liveMatchFixture(2468),batterObservationV151:observation,batterObservedRegionExperienceV222:region};
 const host=createLiveBaseballMatchWorkerV116(config);host.issuePitch(take);const saved=host.captureContinuationV116(),tampered=structuredClone(saved);
 (tampered.batterObservedRegionExperienceV222!.entries[0] as unknown as Record<string,unknown>)[key]='foreign';
 expect(()=>createLiveBaseballMatchWorkerV116(config,tampered)).toThrow(/region experience/);
 expect(host.captureContinuationV116()).toEqual(saved);
});

it('V222-review rejects an unexpected continuation wrapper field',()=>{
 const config={...liveMatchFixture(2468),batterObservationV151:observation,batterObservedRegionExperienceV222:region};
 const host=createLiveBaseballMatchWorkerV116(config);host.issuePitch(take);const saved=host.captureContinuationV116();
 const tampered={...saved,batterObservedRegionExperienceV222:{...saved.batterObservedRegionExperienceV222!,unexpected:true}};
 expect(()=>createLiveBaseballMatchWorkerV116(config,tampered)).toThrow(/region experience/);
});
