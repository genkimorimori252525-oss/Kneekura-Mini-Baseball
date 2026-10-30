import {expect,it,vi} from 'vitest';
import * as pitchOwner from './LivePitchV1';
import {liveMatchFixture} from './LiveBaseballMatchV1.test-support';
import {createLiveBaseballMatchWorkerV116,LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1} from './LiveBaseballMatchV1';
import {resolveLiveBattingSetupV94} from '../../core/sim/pitching/BattingSetupV94';
import {AUTHORED_LIVE_BATTER_OBSERVATION_V151} from './LiveBatterObservationV151';
import {createLiveBattingPracticeV150,resumeLiveBattingPracticeEpisodesV242} from './LiveBattingPracticeV150';
import {declareSpinPracticeEpisodesV242} from './LiveSpinPracticeEpisodesV242';
it('keeps the first target pitch, waits for normal PA end, starts the same target next episode and replays',async()=>{
 const base=liveMatchFixture(2468),subjectId=createLiveBaseballMatchWorkerV116(base).inspect().batterPlayerId,p=base.players.find(x=>x.playerId===subjectId)!,clip=base.measuredClips.find(x=>x.side===p.bats)!;
 const physical={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:clip.id,swingDecision:{approach:'SWING' as const,threshold:0,aggressionWeight:1}};
 const configuration={...base,players:base.players.map(x=>x.playerId===subjectId?{...x,physical}:x),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151};
 const motor={version:'live_spin_xy_motor_v239' as const,motorId:'m',motorVersion:'v1',subjectId,technique:'TOPSPIN' as const,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:p.bats},domain:{plateZ:resolveLiveBattingSetupV94({...physical,heightMeters:p.heightMeters,bats:p.bats}).contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1' as const},delta:{x:0,y:.01},provenance:{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED' as const,sourceId:'fixture',sourceVersion:'v1',humanCalibration:'NOT_MEASURED' as const},trainingOpportunities:[]};
 const plan=declareSpinPracticeEpisodesV242({scopeId:'s',motor,criterion:null,episodeSeeds:[2468,2469]}),owner=createLiveBattingPracticeV150(configuration);
 await owner.startEpisodePracticeV242(plan,{batting:'take'});const foreignOwner=createLiveBattingPracticeV150(configuration),relabeled=declareSpinPracticeEpisodesV242({scopeId:'another-label',motor:{...motor,motorId:'another-label'},criterion:null,episodeSeeds:[2468,2469]});await foreignOwner.startEpisodePracticeV242(relabeled,{batting:'take'});const foreign=await foreignOwner.previewEpisodeStepV242();await expect(owner.acceptEpisodeStepV242(foreign)).rejects.toThrow(/foreign|stale/);const first=await owner.previewEpisodeStepV242(),stale=await owner.previewEpisodeStepV242();expect(first.step.identity).toBe(foreign.step.identity);expect(owner.inspectEpisodePracticeV242().planHash).toBe(foreignOwner.inspectEpisodePracticeV242().planHash);await expect(owner.acceptEpisodeStepV242(structuredClone(first))).rejects.toThrow(/foreign|stale/);await owner.acceptEpisodeStepV242(first);await expect(owner.acceptEpisodeStepV242(stale)).rejects.toThrow(/foreign|stale/);
 expect(()=>owner.advanceEpisodeV242()).toThrow();
 for(let i=0;i<20&&owner.inspectEpisodePracticeV242().phase!=='ENDED';i++)await owner.acceptEpisodeStepV242(await owner.previewEpisodeStepV242());
 expect(owner.inspectEpisodePracticeV242().phase).toBe('ENDED');owner.advanceEpisodeV242();expect(owner.inspect().batterPlayerId).toBe(subjectId);
 await owner.acceptEpisodeStepV242(await owner.previewEpisodeStepV242());const capture=owner.capture();expect(new Set(capture.spinPracticeEpisodesV242!.slots.map(x=>x.episodeId)).size).toBe(2);expect(capture.spinPracticeEpisodesV242!.globalAcceptedPitchCount).toBeGreaterThan(1);const replay=await resumeLiveBattingPracticeEpisodesV242(configuration,structuredClone(capture));expect(replay.capture()).toEqual(capture);
 for(let i=0;i<20&&replay.inspectEpisodePracticeV242().phase!=='ENDED';i++)await replay.acceptEpisodeStepV242(await replay.previewEpisodeStepV242());
 expect(replay.inspectEpisodePracticeV242().evaluation).toMatchObject({status:'HOLD',reason:'CRITERION_MISSING'});expect(replay.closeEpisodePracticeV242().phase).toBe('CLOSED');
 const altered=structuredClone(capture);(altered.spinPracticeEpisodesV242 as {planHash:string}).planHash='tampered';await expect(resumeLiveBattingPracticeEpisodesV242(configuration,altered)).rejects.toThrow();
 owner.closeEpisodePracticeV242();const mutable:{batting:'take'|'balanced'}={batting:'take'},tailCandidate=owner.preview(mutable);mutable.batting='balanced';owner.accept(tailCandidate);const closed=owner.capture();expect(closed.spinPracticeEpisodesV242?.normalTail[0].request.batting).toBe('take');expect(closed.spinPracticeEpisodesV242?.normalTail).toHaveLength(1);expect((await resumeLiveBattingPracticeEpisodesV242(configuration,structuredClone(closed))).capture()).toEqual(closed);
 const held=createLiveBattingPracticeV150(configuration);await held.startEpisodePracticeV242(plan,{batting:'take'});const prior=held.capture();
 const stub=vi.spyOn(pitchOwner,'simulateLivePitchV1').mockReturnValue({frames:[],contact:null,call:null,endedAtTick:1,diagnostics:{unsupportedReason:'fixture-unresolved'}} as never);
 try{const pending=await held.previewEpisodeStepV242();expect(pending.step.kind).toBe('HOLD');expect(await held.acceptEpisodeStepV242(pending)).toBeNull();expect(held.capture().continuation).toEqual(prior.continuation);const retry=await held.previewEpisodeStepV242();expect(retry.step.before).toEqual(pending.step.before);expect(held.inspectEpisodePracticeV242().globalAcceptedPitchCount).toBe(0);}finally{stub.mockRestore();}
 const transitionOwner=createLiveBattingPracticeV150(configuration),oldPlain=transitionOwner.preview({batting:'take'});await transitionOwner.startEpisodePracticeV242(plan,{batting:'take'});transitionOwner.closeEpisodePracticeV242();const closedBefore=transitionOwner.capture();expect(()=>transitionOwner.accept(oldPlain)).toThrow(/foreign|stale/);expect(transitionOwner.capture()).toEqual(closedBefore);
 const raced=createLiveBattingPracticeV150(configuration),starting=raced.startEpisodePracticeV242(plan,{batting:'take'});raced.issuePitch({batting:'take'});await expect(starting).rejects.toThrow(/changed/);
},120000);
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {LiveMatchInputV1} from './LiveBaseballMatchV1';
import type {LiveSpinMotorV239,LiveSpinPracticeCriterionV239} from './LiveSpinMotorPracticeV239';
import type {LiveBattingPracticeRequestV150} from './LiveBattingPracticeV150';
// Preserved prior HOOK input only; this regression demonstrates replay, not training or learned skill.
const savedHookFixturePath='work/maker-practice-v239-v240-hook-01/cohort-start.json';
const savedHookFixtureAvailable=existsSync(savedHookFixturePath);
it.runIf(savedHookFixtureAvailable)('replays the preserved fair-contact boundary (private fixture absent: skipped) and starts the next target episode',async()=>{
 const bytes=readFileSync(savedHookFixturePath);expect(createHash('sha256').update(bytes).digest('hex')).toBe('bcf182bbd036b96987c0a0ea8d3ed65250ab6fd5931a8433e349faceef88654f');
 // @ts-expect-error Existing lossless debug codec is a JavaScript verification utility.
 const {parseDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs');
 const saved=parseDebugRecord(bytes.toString('utf8')) as {initialCapture:{configuration:LiveMatchInputV1};plan:{motor:LiveSpinMotorV239;criterion:LiveSpinPracticeCriterionV239|null;normalRequest:LiveBattingPracticeRequestV150}};
 const configuration=saved.initialCapture.configuration,plan=declareSpinPracticeEpisodesV242({scopeId:'fixed-fair-regression',motor:saved.plan.motor,criterion:saved.plan.criterion,episodeSeeds:[20261102,20261103]});
 const owner=createLiveBattingPracticeV150(configuration);await owner.startEpisodePracticeV242(plan,saved.plan.normalRequest);
 const candidate=await owner.previewEpisodeStepV242();expect(candidate.step.kind).toBe('TARGET');const first=await owner.acceptEpisodeStepV242(candidate);
 expect(first?.play.contact).not.toBeNull();expect(first?.play.classification).toBe('live_ball');expect(owner.inspectEpisodePracticeV242().phase).toBe('ENDED');
 owner.advanceEpisodeV242();expect(owner.inspect().batterPlayerId).toBe(saved.plan.motor.subjectId);const next=await owner.previewEpisodeStepV242();expect(next.step.kind).toBe('TARGET');await owner.acceptEpisodeStepV242(next);
 const capture=owner.capture();expect((await resumeLiveBattingPracticeEpisodesV242(configuration,structuredClone(capture))).capture()).toEqual(capture);
},180000);
function intentFixture(targetOffset:number){
 const base=liveMatchFixture(2468),first=createLiveBaseballMatchWorkerV116(base).inspect().batterPlayerId,team=base.teams.find(t=>t.battingOrder.includes(first))!,subjectId=team.battingOrder[(team.battingOrder.indexOf(first)+targetOffset)%team.battingOrder.length],player=base.players.find(x=>x.playerId===subjectId)!,clip=base.measuredClips.find(x=>x.side===player.bats)!;
 const physical={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:clip.id,swingDecision:{approach:'TAKE' as const,threshold:1,aggressionWeight:1}},configuration={...base,players:base.players.map(x=>x.playerId===subjectId?{...x,physical}:x),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151};
 const motor={version:'live_spin_xy_motor_v239' as const,motorId:'m-intent',motorVersion:'v1',subjectId,technique:'TOPSPIN' as const,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:player.bats},domain:{plateZ:resolveLiveBattingSetupV94({...physical,heightMeters:player.heightMeters,bats:player.bats}).contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1' as const},delta:{x:0,y:.01},provenance:{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED' as const,sourceId:'fixture',sourceVersion:'v1',humanCalibration:'NOT_MEASURED' as const},trainingOpportunities:[]};
 const plan=declareSpinPracticeEpisodesV242({scopeId:'intent-fixed',motor,criterion:null,episodeSeeds:[2468,2469]}),normalRequest={batting:'balanced' as const,practiceSwingDecisionV241:{version:'practice_swing_decision_v241' as const,sourceId:'fixed-practice',scope:'EXPLICIT_PRACTICE' as const,mode:'SWING' as const}};return {configuration,motor,plan,normalRequest};
}
it('keeps fixed SWING for target and PA tail through normal PA end',async()=>{
 const fixture=intentFixture(0),{plan,normalRequest}=fixture,configuration={...fixture.configuration,batterObservationV151:{...AUTHORED_LIVE_BATTER_OBSERVATION_V151,decisionAfterReleaseTicks:1}},owner=createLiveBattingPracticeV150(configuration);await owner.startEpisodePracticeV242(plan,normalRequest);
 const first=await owner.previewEpisodeStepV242();expect(first.step.kind).toBe('TARGET');expect(first.step.normalRecord?.command.practiceSwingDecisionV241).toEqual(normalRequest.practiceSwingDecisionV241);expect(first.step.trialRecord?.command.practiceSwingDecisionV241).toEqual(normalRequest.practiceSwingDecisionV241);await owner.acceptEpisodeStepV242(first);
 expect(owner.inspectEpisodePracticeV242().phase).toBe('ACTIVE');const tail=await owner.previewEpisodeStepV242();expect(tail.step.kind).toBe('PA_TAIL');expect(tail.step.normalRecord?.command.practiceSwingDecisionV241).toEqual(normalRequest.practiceSwingDecisionV241);expect(tail.step.normalRecord?.command.spinMotorPracticePolicyV239?.subjectId).toBe(plan.motor.subjectId);await owner.acceptEpisodeStepV242(tail);
 for(let i=0;i<20&&owner.inspectEpisodePracticeV242().phase!=='ENDED';i++)await owner.acceptEpisodeStepV242(await owner.previewEpisodeStepV242());expect(owner.inspectEpisodePracticeV242().phase).toBe('ENDED');
},120000);
it('omits target intent for other-batter prefix and applies it on target first pitch',async()=>{
 const {configuration,plan,normalRequest}=intentFixture(1),owner=createLiveBattingPracticeV150(configuration);await owner.startEpisodePracticeV242(plan,normalRequest);
 let target=false;for(let i=0;i<20&&!target;i++){const step=await owner.previewEpisodeStepV242();if(step.step.kind==='PREFIX'){expect(step.step.normalRecord?.batterPlayerId).not.toBe(plan.motor.subjectId);expect(step.step.normalRecord?.command.practiceSwingDecisionV241).toBeUndefined();}else{expect(step.step.kind).toBe('TARGET');expect(step.step.trialRecord?.command.practiceSwingDecisionV241).toEqual(normalRequest.practiceSwingDecisionV241);target=true}await owner.acceptEpisodeStepV242(step)}expect(target).toBe(true);
},120000);
