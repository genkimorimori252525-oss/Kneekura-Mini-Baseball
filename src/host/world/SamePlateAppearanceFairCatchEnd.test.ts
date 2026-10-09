import { expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { fixture, material, v } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { prepareBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { resolveExactCommunicationReception } from '../../core/sim/perception/ExactCommunication';
import { DeterministicRng } from '../../core/rng/DeterministicRng';
import { deriveSamePaPhysicalFieldCapture } from './SamePlateAppearancePhysicalFieldCapture';
import { deriveSamePaPhysicalQuantizerCheckpoint } from './SamePlateAppearancePhysicalQuantizerCheckpoint';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import { deriveSamePaFairCatchRuleBasis } from './SamePlateAppearanceFairCatchRuleBasis';
import { deriveSamePaCatchOperativeRuling } from './SamePlateAppearanceCatchOperativeRuling';
import { deriveSamePaLiveWorkCensus } from './SamePlateAppearanceLiveWorkCensus';
import { deriveSamePaFairCatchEndFromSqlite } from './SamePlateAppearanceFairCatchEndFromSqlite';
import { samePaLifecycleOutcomeInput } from './SamePlateAppearanceLifecycleOutcome';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
const mocks=vi.hoisted(()=>({pair:null as unknown,original:null as unknown,live:null as unknown,work:null as unknown,prefix:null as unknown}));
vi.mock('./SamePlateAppearanceFieldRuleEvidenceFromSqlite',()=>({readSamePaFieldRuleEvidenceWithInputsFromSqlite:(_db:unknown,r:{sourceId:string})=>r.sourceId==='call-view'?mocks.original:mocks.pair}));
vi.mock('./SamePlateAppearanceAdmittedLiveWorkFromSqlite',()=>({readSamePaAdmittedLiveWorkFromSqlite:()=>mocks.live}));
vi.mock('./SamePlateAppearanceCatchWorkFromSqlite',()=>({readSamePaCatchWorkFromSqlite:()=>mocks.work}));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite',()=>({withSamePaLifecycleReadPhase:(_db:unknown,body:()=>unknown)=>body(),readSamePaLifecycleRecordFromSqlite:()=>mocks.prefix}));
const ref=<T extends string>(owner:T,sourceId=owner as string)=>({owner,sourceId,sourceHash:hash(sourceId),snapshotHash:hash(sourceId)});
const fieldRef=(f:SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep)=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
/** Structural Native read seams only. Core generates all contact, acquisition,
 * physical suffix, census and reception facts; no durable ownership is claimed. */
const setup=(reception:'future'|'dropped'|'received'='future')=>{
  const input=fixture(0,1,5,5),ids=['batter','carrier','receiver',...Array.from({length:7},(_,i)=>'defender-'+i)],roles=['body','glove','tag_hand','left_foot','right_foot'] as const;
  const actors=ids.flatMap((playerId,index)=>roles.map((role,j)=>{
    const glove=input.response.world.actors.find(a=>a.playerId===playerId)?.primitive;
    return{playerId,primitive:{role,radius:0.125,startTick:0,endTick:5_000_000,ticksPerSecond:1_000_000,
      startCenter:role==='glove'&&glove?glove.startCenter:v(20+index*5,10+j,5),startVelocity:glove?.startVelocity??v(0,0,0),acceleration:v(0,0,0)}};
  }));
  const response={...input.response,world:{...input.response.world,actors},actors:actors.map(a=>({playerId:a.playerId,
    profile:a.primitive.role==='glove'?input.response.actors[0].profile:{role:a.primitive.role,material}}))};
  const field=deriveInitialBattedWorldFieldMotion({...input,response,commands:actors.map(a=>({playerId:a.playerId,role:a.primitive.role,acceleration:v(0,0,0)}))});
  const match={ruleProfileId:asRuleProfileId('npb-2026'),playId:1,inning:1,half:'top' as const,outs:0,balls:0,strikes:0,bases:{first:null,second:null,third:null},score:{away:0,home:0}};
  const timeline=recordBatBallContact(createCanonicalPlateAppearanceTimeline(match,0),response.world.flight.contact);
  const lineage={enrollmentReference:ref('same_pa_enrollments','enrollment'),actorReference:ref('physical_plate_appearance_actors','actor'),careerId:'career',gameId:'game',playId:1,firstPhysicalPitchSourceId:'pitch',participantReferences:[]};
  const root={kind:'same_pa_physical_field_root_v1',source:{sourceId:'root',sourceVersion:'fixture-only',parameters:response.world.parameters,liveProducerProfile:'same_pa_empty_base_catch_v1'},
    physicalPitchSourceId:'pitch',pitchOrdinal:1,operationOrdinal:1,evaluationTick:field.motion.world.moment.ball.tick,response,geometry:input.geometry,field,lineage,timeline} as unknown as SamePaPhysicalFieldRoot;
  const source=(old:SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep,id:string,throughTick:number,action:SamePaPhysicalFieldStepSource['action']):SamePaPhysicalFieldStepSource=>({sourceId:id,sourceVersion:'fixture-only',capability:'same_pa_physical_field_step_v1',
    viewReference:ref('pa_lifecycle_v1_execution_views'),launchReference:ref('pa_physical_v1_launches','pitch'),previousOperationReference:fieldRef(old),previousFieldReference:fieldRef(old),fieldRootReference:reference('pa_physical_v1_field_roots',root),throughTick,action});
  const plan=prepareBattedWorldScheduledFieldAcquisition({response,geometry:input.geometry,field}),cs=source(root,'capture',plan.candidateSecureTick,{kind:'capture_checkpoint_v1',candidateReference:fieldRef(root),throughElapsedSeconds:plan.fenceElapsedSeconds});
  const capture:SamePaPhysicalFieldStep={...root,...deriveSamePaPhysicalFieldCapture(cs,root,root,root),kind:'same_pa_physical_field_step_v1',source:cs,operationOrdinal:2};
  const ss=source(capture,'seal',capture.evaluationTick,{kind:'retained_quantizer_checkpoint_v1'});
  const seal:SamePaPhysicalFieldStep={...capture,...deriveSamePaPhysicalQuantizerCheckpoint(ss,root,capture),source:ss,operationOrdinal:3};
  const scope={batterRunnerId:'batter',defenderIds:ids.slice(1),outsAtStart:0};
  const evidence=deriveSamePaFieldRuleEvidence({...scope,fields:[root,capture,seal]}),originalEvidence=deriveSamePaFieldRuleEvidence({...scope,fields:[root,capture]});
  const fairCatch=deriveSamePaFairCatchRuleBasis({originalMatch:match,originalTimeline:timeline,evidence}),originalCatch=deriveSamePaFairCatchRuleBasis({originalMatch:match,originalTimeline:timeline,evidence:originalEvidence});
  const moment=seal.field.motion.world.moment,at={originTick:0,elapsedSeconds:moment.elapsedSeconds,tick:moment.ball.tick};
  const calledMoment=capture.field.motion.world.moment,calledAt={originTick:0,elapsedSeconds:calledMoment.elapsedSeconds,tick:calledMoment.ball.tick};
  const action={sourceId:'action',sourceVersion:'fixture-only',capability:'same_pa_explicit_catch_action_v1' as const,assignmentReference:{sourceId:'assignment',sourceVersion:'fixture-only',sourceHash:hash('assignment')},
    officialId:'umpire',personId:'umpire-person',viewReference:ref('pa_lifecycle_v1_execution_views','call-view'),judgment:'caught' as const,calledAt};
  const operative=deriveSamePaCatchOperativeRuling({action,originalMatch:match,batterRunnerId:'batter',basisTick:calledAt.tick,basisEvidenceRevision:2,fairCatch:originalCatch});
  const emitted={sourceId:'umpire',targetScope:{kind:'nearby' as const},kind:'callout' as const,issuedAt:calledAt.tick,content:{actionSourceId:'action',officialId:'umpire',personId:'umpire-person',judgment:'caught' as const,calledAt}};
  const recipients=ids.map(playerId=>{
    const received=resolveExactCommunicationReception(emitted,calledAt.elapsedSeconds,{originTick:0,ticksPerSecond:1_000_000},{propagationDelayTicks:reception==='future'?100:0,
      recognitionBaseDelayTicks:0,maxAdditionalRecognitionDelayTicks:0,audibility:reception==='dropped'?0:1,recognition:1,attention:1,minimumRecognizableQuality:0.5},new DeterministicRng(1));
    const r=received?{playerId,kind:received.receivedAtElapsedSeconds>at.elapsedSeconds?'scheduled' as const:'received' as const,reception:received,receiverPosition:null}:{playerId,kind:'dropped' as const,reason:'not_recognizable'};
    return{playerId,reception:r,observations:[],controllerResponse:{kind:'pending' as const,reason:'not_consumed'}};
  });
  const catchWorkReference=ref('pa_catch_v1_work','work'),physicalPitchReference=ref('pa_physical_v1_launches','pitch'),viewReference=ref('pa_lifecycle_v1_execution_views','end-view');
  const view={source:{prefixReference:ref('pa_lifecycle_v1_work_prefixes','prefix')},lineage,coverageHash:hash('coverage'),cut:{physicalPitchReference,physicalOperationReference:fieldRef(seal)}};
  const actor={binding:{playerId:'batter'},defenderBindings:ids.slice(1).map(playerId=>({playerId}))};
  const value={fairCatch,evidence,evidenceHash:hash(evidence),viewReference,lineage,originalMatch:match,originalTimeline:timeline,physicalPitchReference,physicalOperationReference:fieldRef(seal),fieldReferences:[root,capture,seal].map(fieldRef)};
  const pair={kind:'same_pa_field_rule_read_pair_v1',value,fields:[root,capture,seal],actor,view};
  const original={...pair,value:{...value,fairCatch:originalCatch,evidence:originalEvidence,viewReference:action.viewReference,evidenceHash:hash(originalEvidence)}};
  const census={...deriveSamePaLiveWorkCensus({fields:pair.fields,participantIds:ids,observationPolicies:[],possessionEvidence:evidence.rule.possessionEvidence}),runnerPlans:[]};
  const live={kind:'same_pa_live_work_read_v1',census,communication:{kind:'owned_same_pa_catch_communication_v1',latestReference:catchWorkReference,emitted,recipients}};
  const work={lineage,physicalPitchReference,physicalOperationReference:fieldRef(seal),operative,originalInputs:{action},communication:{evaluatedThrough:at}};
  mocks.pair=pair;mocks.original=original;mocks.live=live;mocks.work=work;mocks.prefix={kind:'same_pa_lifecycle_prefix',source:{eventReferences:[...value.fieldReferences,catchWorkReference]}};
  const run=()=>deriveSamePaFairCatchEndFromSqlite({} as DatabaseSync,viewReference,catchWorkReference,'historical');
  return{run,pair,original,live,work,seal,root};
};
it.each(['future','dropped'] as const)('ends only after actual sealed coverage and keeps genuine %s receptions in the finalizer',kind=>{
  const h=setup(kind),result=h.run();expect(result.kind).toBe('same_pa_fair_catch_physical_end_v1');
  if(result.kind==='pending')throw new Error(result.reason);
  expect(result.registry.resolution.kind).toBe('ended');expect(result.registry.frontier.physical).toHaveLength(10);
  expect(result.registry.frontier.actors.every(a=>a.kind==='acting')).toBe(true);
  expect(h.seal.field.motion.actors.some(a=>Object.values(a.primitive.startVelocity).some(n=>n!==0))).toBe(true);
  expect(result.registry.frontier.information).toHaveLength(kind==='future'?10:0);
  expect(result.generation.producerIds).toHaveLength(34);expect(result.generation.bodyBaseHistoryHashes).toHaveLength(40);
  expect(result.playEnd.tick).toBe(h.seal.evaluationTick);expect(result.exactEnd.elapsedSeconds).toBeGreaterThan(h.work.originalInputs.action.calledAt.elapsedSeconds);
});
it('does not retire a due received batter through the operative OUT or a rule-system reset',()=>{
  const h=setup('received');expect(h.run()).toEqual({kind:'pending',reason:'received_batter_retirement_controller_semantics_required'});
});
it('requires original registration, real seal and independent current communication coverage',()=>{
  const h=setup();mocks.pair={...h.pair,fields:[{...h.root,source:{...h.root.source,liveProducerProfile:undefined}},...h.pair.fields.slice(1)]};
  expect(h.run()).toMatchObject({reason:'original_live_producer_profile_required'});
  mocks.pair={...h.pair,fields:[...h.pair.fields.slice(0,-1),{...h.seal,actionResult:undefined}]};expect(h.run()).toMatchObject({reason:'original_retained_quantizer_generation_required'});
  mocks.pair=h.pair;mocks.work={...h.work,communication:{evaluatedThrough:{...h.work.communication.evaluatedThrough,elapsedSeconds:0}}};expect(h.run).toThrow(/generation cut/);
});
it('keeps new physical rule facts and unresolved original catch basis pending',()=>{
  const h=setup();mocks.original={...h.original,value:{...h.original.value,fairCatch:{kind:'pending',reason:'actual_fair_catch_required'}}};
  expect(h.run()).toMatchObject({reason:'original_call_fair_catch_rule_applicability_required'});
  mocks.original={...h.original,value:{...h.original.value,evidence:{...h.original.value.evidence,physical:{...h.original.value.evidence.physical,field:{...h.original.value.evidence.physical.field,baseContacts:[{}]}}}}};
  expect(h.run()).toMatchObject({reason:'later_rule_relevant_physical_consumer_required'});
});
it('does not use all-offense-terminal to bypass due refresh, decision, response or planned runner work',()=>{
  const h=setup();for(const [changed,reason] of [
    [{observationRefresh:{pending:[{due:'due'}]}},'due_observation_refresh_consumer_required'],
    [{defenderDecisions:{pending:[{decisionDue:'due',movementDue:'future'}]}},'due_defender_decision_or_adoption_required'],
    [{catchResponses:{pending:[{work:[],response:{replan:{semantic:'pending'}}}]}},'received_controller_work_required'],
    [{runnerPlans:[{due:'due',status:'pending_motion'}]},'due_original_runner_motion_required'],
  ] as const){mocks.live={...h.live,census:{...h.live.census,...changed}};expect(h.run()).toMatchObject({kind:'pending',reason});}
});
it('requires an actual controller consumer for the latest observation',()=>{
  const h=setup(),observation={...h.seal,source:{...h.seal.source,sourceId:'unconsumed-observation'},actionResult:{kind:'defender_observation_v1',playerId:'carrier'}};
  mocks.pair={...h.pair,fields:[...h.pair.fields,observation]};expect(h.run()).toMatchObject({kind:'pending',reason:'observed_actor_controller_consumer_required'});
});
it('accepts only original catch-work, physical-cut and scheduler references at outcome intake',()=>{
  const h=setup(),source={sourceId:'end-outcome',sourceVersion:'fixture-only',capability:'same_pa_lifecycle_outcome_v1',kind:'fair_catch',rulePolicy:null,officialPolicy:null,
    enrollmentReference:h.pair.view.lineage.enrollmentReference,viewReference:h.pair.value.viewReference,physicalOperationReference:fieldRef(h.seal),catchWorkReference:ref('pa_catch_v1_work','work'),
    official:{sourceId:'scheduler-source',sourceVersion:'fixture-only',schedulerId:'scheduler',events:[{sourceId:'fence',sourceVersion:'fixture-only',schedulerId:'scheduler',kind:'next_play_fence'}]}};
  expect(samePaLifecycleOutcomeInput(source)).toEqual(source);
  for(const extra of [{playEnd:{tick:1}},{registry:{}},{complete:true},{ruling:{outsAfter:1}}])expect(()=>samePaLifecycleOutcomeInput({...source,...extra})).toThrow();
  expect(()=>samePaLifecycleOutcomeInput({...source,catchWorkReference:ref('actual_call_communications','legacy')})).toThrow();
});
