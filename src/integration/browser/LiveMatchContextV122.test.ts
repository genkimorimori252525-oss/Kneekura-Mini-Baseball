import {expect,it} from 'vitest';
import {createLiveBaseballMatchWorkerV116,LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1} from './LiveBaseballMatchV1';
import {liveMatchFixture} from './LiveBaseballMatchV1.test-support';
import type {LiveMatchWorkloadConfigV122} from './LiveMatchWorkloadOwnerV122';
const config=():LiveMatchWorkloadConfigV122=>({version:'live_match_workload_v122',sessionId:'s',matchId:'m',managerId:'manager',players:[{
 context:{sourceId:'workload-test',sourceVersion:'1',scope:{sessionId:'s',matchId:'m',careerId:'c',playerId:'1-p0',gameDay:1},
 baseline:{careerId:'c',playerId:'1-p0',createdAtDay:1,fatigue:.1,recoveryCapacity:1,
 policy:{policyId:'effort',version:'1',availableAtDay:1,workloadFatiguePerUnit:.01,travelFatiguePerKm:0,recoveryPerHour:.01}},activities:[],expectedRevision:0},
 timingProfile:{baseStartIntervalUs:1000000,normalMotionToReleaseUs:800000,followThroughUs:400000,quickSpeedFactor:1,cadenceExecutionControl:1,cadenceTimingKnowledge:1,
 quickRepeatability:1,naturalVariationUs:0,normalPhaseWeights:{gather:1,transition:1,stride:1},quickPhaseWeights:{gather:1,transition:1,stride:1}},
 pitchPolicy:{policyId:'response-test',version:'1',availableAtDay:1,motionDurationScaleAtFullFatigue:1.2,velocityRetentionAtFullFatigue:.995,spinRetentionAtFullFatigue:.99},effortUnitsPerPitch:1}]});
const command={managedTeam:0 as const,batting:'take' as const,pitchType:'auto',location:'auto'};
it('uses the accepted pitcher workload in normal Host and resumes the exact compact worker state',()=>{
 const fixture={...liveMatchFixture(31),workloadV122:config()},before=JSON.stringify(fixture),a=createLiveBaseballMatchWorkerV116(fixture);
 const first=a.issuePitch(command),d=first.play.diagnostics as any;
 expect(d.pitchWorkloadV122.workload.state.fatigue).toBe(.1);
 expect(a.inspect().workloadV122!.players[0].workload.state).toMatchObject({fatigue:.11,revision:1});
 const continuation=a.captureContinuationV116(),b=createLiveBaseballMatchWorkerV116(fixture,continuation);
 expect(b.issuePitch(command)).toEqual(a.issuePitch(command));expect(b.captureContinuationV116()).toEqual(a.captureContinuationV116());
 expect(JSON.stringify(fixture)).toBe(before);
 expect(()=>createLiveBaseballMatchWorkerV116({...fixture,workloadV122:{...fixture.workloadV122,matchId:'other'}},continuation)).toThrow();
});
it('does not consume fatigue on an invalid physical or ambiguous manager command',()=>{
 const fixture={...liveMatchFixture(31),workloadV122:config(),communicationScopeV122:{sessionId:'s',matchId:'m',managerId:'manager'}},
 host=createLiveBaseballMatchWorkerV116(fixture),before=host.captureContinuationV116();
 expect(()=>host.issuePitch({...command,pitchId:'missing',managedTeam:1})).toThrow();
 expect(host.captureContinuationV116()).toEqual(before);
 expect(()=>host.issuePitch({...command,debug:undefined} as typeof command)).toThrow();
 expect(host.captureContinuationV116()).toEqual(before);
});
it('receives a real scoped manager signal only for the current managed batter',()=>{
 const source=liveMatchFixture(31),batterId=source.teams[0].battingOrder[0],fixture={...source,communicationScopeV122:{sessionId:'s',matchId:'m',managerId:'manager'},
 players:source.players.map(p=>({...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,swingPolicyV121:{version:'swing_policy_v121' as const,sourceId:'test',effort:.8,compactness:.3,controlPriority:.5,
 effortVariation:0,twoStrikeEffortDelta:-.2,twoStrikeCompactnessDelta:.4,maximumClockAccelerationPerSecond:40}}}))},host=createLiveBaseballMatchWorkerV116(fixture),
 r=host.issuePitch({...command,batting:'auto',managerCommunicationV122:{sourceId:'signal-test',sourceVersion:'1',eventId:'e',sessionId:'s',matchId:'m',senderId:'manager',receiverId:batterId,
 sourceTick:1000000,sentAtElapsedSeconds:0,conditions:{propagationDelayTicks:0,recognitionBaseDelayTicks:0,maxAdditionalRecognitionDelayTicks:0,audibility:1,recognition:1,attention:1,minimumRecognizableQuality:.5},
 instruction:{authority:'hard',effort:.4,compactness:.9}}});
 expect((r.play.diagnostics as any).managerCommunicationV122.status).toBe('RECEIVED');
 expect((r.play.diagnostics as any).swingIntentV121.effort).toBe(.4);
});
it('updates only the current batter own delivered knowledge after acceptance and preserves it over resume',()=>{
 const base=liveMatchFixture(31),observerPlayerId=base.teams[0].battingOrder[0],pitcherId=base.teams[1].pitcherId,
  approach={version:'batter_approach_v122' as const,sourceId:'test',priorReliance:.2,directionCommitment:0,twoStrikeCommitmentDelta:0,
   preferredWhenCommitted:{pull:1,center:0,opposite:0},targetPullAnglesDegrees:{pull:25,center:0,opposite:-25}},
  fixture={...base,players:base.players.map(p=>({...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,batterApproachV122:approach}})),batterKnowledgeV122:[{
   version:'batter_belief_v122' as const,sourceId:'own-history',observerPlayerId,pitcherId,capturedAtTick:500000,observedThroughTick:400000,confidence:.5,evidenceRefs:['old'],
   candidates:[{familyId:'estimated-fast',regionId:'centre',probability:1,prediction:{x:0,y:1,arrivalAfterReleaseSeconds:.4}}]}]},
  host=createLiveBaseballMatchWorkerV116(fixture),evidence={evidenceId:'own-extra',observerPlayerId,pitcherId,observedTick:600000,availableTick:700000,
   familyId:'estimated-slow',regionId:'low',prediction:{x:.1,y:.6,arrivalAfterReleaseSeconds:.5},reliability:.8};
 const foreign=createLiveBaseballMatchWorkerV116(fixture).issuePitch({...command,batterEvidenceV122:{evidence:{...evidence,observerPlayerId:'wrong'},learningWeight:.2}});
 expect((foreign.play.diagnostics as any).batterEvidenceReceptionV122.status).toBe('NOT_APPLICABLE');
 expect(host.inspect().batterKnowledgeV122!.beliefs[0].evidenceRefs).toEqual(['old']);
 host.issuePitch({...command,batterEvidenceV122:{evidence,learningWeight:.2}});
 const saved=host.captureContinuationV116(),resumed=createLiveBaseballMatchWorkerV116(fixture,saved);
 const duplicate={...command,batterEvidenceV122:{evidence,learningWeight:.2}};
 expect(resumed.captureContinuationV116()).toEqual(saved);expect(resumed.issuePitch(command)).toEqual(host.issuePitch(command));
 expect(resumed.captureContinuationV116()).toEqual(host.captureContinuationV116());
 const again=host.issuePitch(duplicate);expect((again.play.diagnostics as any).batterEvidenceReceptionV122.status).toMatch(/ALREADY_APPLIED|NOT_APPLICABLE/);
 expect(host.inspect().batterKnowledgeV122!.beliefs[0].evidenceRefs).toEqual(['old','own-extra']);
});
