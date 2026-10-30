import { expect,it } from 'vitest';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { createLiveBaseballMatchWorkerV116,LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { createLiveBattingPracticeV150 } from './LiveBattingPracticeV150';
import { resolveLiveBattingSetupV94 } from '../../core/sim/pitching/BattingSetupV94';
import { AUTHORED_LIVE_BATTER_OBSERVATION_V151 } from './LiveBatterObservationV151';
const base=()=>({...liveMatchFixture(2468),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151});
function setup(){const initial=base(),first=createLiveBaseballMatchWorkerV116(initial),batterId=first.inspect().batterPlayerId,player=initial.players.find(p=>p.playerId===batterId)!,clip=initial.measuredClips.find(c=>c.side===player.bats)!;
 const physical={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:clip.id,swingDecision:{approach:'SWING' as const,threshold:0,aggressionWeight:1}},
 input={...initial,players:initial.players.map(p=>p.playerId===batterId?{...p,physical}:p)},host=createLiveBaseballMatchWorkerV116(input),plane=resolveLiveBattingSetupV94({...physical,heightMeters:player.heightMeters,bats:player.bats}).contactPlaneZ;
 return {input,host,request:{version:'live_observed_spin_trial_v236' as const,subjectId:batterId,technique:'TOPSPIN' as const,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:player.bats},domain:{plateZ:plane,contactDepthZ:plane+.05,coordinateSystem:'LIVE_WORLD_METERS_V1' as const},delta:{x:0,y:.01}}};}
it('V237 transports one trial through Host and preview without committing it early',()=>{
 const {input,host,request}=setup(),practice=createLiveBattingPracticeV150(input),capture=practice.capture(),candidate=practice.preview({batting:'take',observedSpinTrialV236:request});
 expect(practice.capture()).toEqual(capture);const result=host.issuePitch({batting:'take',pitchType:'auto',location:'auto',managedTeam:0,observedSpinTrialV236:request});
 expect(candidate.record).toEqual(result);expect(candidate.record.command.observedSpinTrialV236).toEqual(request);expect((candidate.record.play.diagnostics as any).observedSpinTrialV236).toMatchObject({status:'NO_TARGET',reason:'NO_SWING'});
 practice.accept(candidate);expect(practice.capture().continuation).toEqual(host.captureContinuationV116());const restored=createLiveBattingPracticeV150(input,JSON.parse(JSON.stringify(practice.capture())));
 expect(restored.issuePitch({batting:'balanced',observedSpinTrialV236:request})).toEqual(practice.issuePitch({batting:'balanced',observedSpinTrialV236:request}));
});
it('V237 refuses another subject before changing continuation',()=>{
 const {input,request}=setup(),practice=createLiveBattingPracticeV150(input),before=practice.capture();expect(()=>practice.preview({batting:'take',observedSpinTrialV236:{...request,subjectId:'foreign'}})).toThrow(/subject/);expect(practice.capture()).toEqual(before);
});

it('V237 delivers an explicit SWING request through normal Host and preserves original roster',()=>{
 const {input,host,request}=setup(),before=structuredClone(input),result=host.issuePitch({batting:'balanced',pitchType:'auto',location:'auto',managedTeam:0,observedSpinTrialV236:request}),d=(result.play.diagnostics as any).observedSpinTrialV236;
 expect(d).toMatchObject({status:'APPLIED',subjectId:request.subjectId,earnedQualification:false,clip:request.clip});expect(result.command.observedSpinTrialV236).toEqual(request);expect(input).toEqual(before);
});
it('V237 applied trial preview is non-consuming and matches accepted Host execution',()=>{
 const {input,host,request}=setup(),practice=createLiveBattingPracticeV150(input),before=practice.capture(),candidate=practice.preview({batting:'balanced',observedSpinTrialV236:request});
 expect(practice.capture()).toEqual(before);expect((candidate.record.play.diagnostics as any).observedSpinTrialV236.status).toBe('APPLIED');
 const official=host.issuePitch({batting:'balanced',pitchType:'auto',location:'auto',managedTeam:0,observedSpinTrialV236:request});expect(practice.accept(candidate)).toEqual(official);expect(practice.capture().continuation).toEqual(host.captureContinuationV116());
});
import { existsSync,readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { resolve } from 'node:path';
const baseline='work/v237-command-bridge-baseline-01/worktree/src/integration/browser/LiveBaseballMatchV1.ts';
it.skipIf(!existsSync(baseline))('V237 omitted command retains original Host record and continuation exactly',async()=>{
 const bundled=await build({stdin:{contents:readFileSync(baseline,'utf8'),sourcefile:'v237-old-host.ts',resolveDir:resolve('src/integration/browser'),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',target:'node22'}),old=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64')) as typeof import('./LiveBaseballMatchV1');
 const {input}=setup(),prior=old.createLiveBaseballMatchWorkerV116(input),current=createLiveBaseballMatchWorkerV116(input),command={batting:'take' as const,pitchType:'auto',location:'auto',managedTeam:0 as const};
 expect(current.issuePitch(command)).toEqual(prior.issuePitch(command));expect(current.captureContinuationV116()).toEqual(prior.captureContinuationV116());
},60000);
import { Worker } from 'node:worker_threads';
it('V237 sends the exact applied command through a real worker thread and matches Host continuation',async()=>{
 const {input,host,request}=setup(),bundle=await build({entryPoints:['src/integration/browser/LiveBattingPracticeV150.ts'],bundle:true,write:false,platform:'node',format:'esm',target:'node22'}),url='data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64');
 const script=`const {parentPort}=require('node:worker_threads');(async()=>{const api=await import(${JSON.stringify(url)});parentPort.on('message',value=>{try{const p=api.createLiveBattingPracticeV150(value.input),record=p.issuePitch(value.request);parentPort.postMessage({record,capture:p.capture()})}catch(e){parentPort.postMessage({error:String(e.stack||e)})}})})().catch(e=>parentPort.postMessage({error:String(e.stack||e)}));`,worker=new Worker(script,{eval:true});
 try{const response=await new Promise<any>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({input,request:{batting:'balanced',observedSpinTrialV236:request}})});
  expect(response.error).toBeUndefined();const expected=host.issuePitch({batting:'balanced',pitchType:'auto',location:'auto',managedTeam:0,observedSpinTrialV236:request});expect(response.record).toEqual(expected);expect(response.capture.continuation).toEqual(host.captureContinuationV116());
 }finally{await worker.terminate()}
},60000);
it('V237 practice still rejects unknown request fields without consuming a preview',()=>{
 const {input}=setup(),practice=createLiveBattingPracticeV150(input),before=practice.capture();expect(()=>practice.preview({batting:'take',unexpected:true} as never)).toThrow(/request/);expect(practice.capture()).toEqual(before);
});
