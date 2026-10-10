import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { deriveSamePaStationaryOccupiedRunners, type SamePaStationaryHoldBasis } from './SamePlateAppearanceStationaryOccupiedRunners';
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
import { deriveSamePaCatchPhaseWork } from './SamePlateAppearanceCatchPhaseWork';
import { deriveSamePaFairCatchEndFromSqlite } from './SamePlateAppearanceFairCatchEndFromSqlite';
import { samePaLifecycleOutcomeInput } from './SamePlateAppearanceLifecycleOutcome';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
const mocks=vi.hoisted(()=>({pair:null as unknown,original:null as unknown,live:null as unknown,work:null as unknown,prefix:null as unknown}));
vi.mock('./SamePlateAppearanceOriginalParticipants',()=>({readSamePaOriginalParticipants:(_db:unknown,actor:any)=>[actor.binding,...actor.defenderBindings,...actor.world.runners.map((r:any)=>({playerId:r.playerId}))].map(binding=>({binding}))}));
vi.mock('./SamePlateAppearanceFieldRuleEvidenceFromSqlite',()=>({readSamePaFieldRuleEvidenceWithInputsFromSqlite:(_db:unknown,r:{sourceId:string})=>r.sourceId==='call-view'?mocks.original:mocks.pair}));
vi.mock('./SamePlateAppearanceAdmittedLiveWorkFromSqlite',()=>({readSamePaAdmittedLiveWorkFromSqlite:()=>mocks.live}));
vi.mock('./SamePlateAppearanceCatchWorkFromSqlite',()=>({readSamePaCatchWorkFromSqlite:()=>mocks.work}));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite',()=>({withSamePaLifecycleReadPhase:(_db:unknown,body:()=>unknown)=>body(),readSamePaLifecycleRecordFromSqlite:()=>mocks.prefix}));
const ref=<T extends string>(owner:T,sourceId=owner as string)=>({owner,sourceId,sourceHash:hash(sourceId),snapshotHash:hash(sourceId)});
const fieldRef=(f:SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep)=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
/** Structural Native read seams only. Core generates all contact, acquisition,
 * physical suffix, census and reception facts; no durable ownership is claimed. */
const setup=(reception:'future'|'dropped'|'received'='future',occupiedCount=0,outs=0,stationary=false)=>{
  const runnerIds=Array.from({length:occupiedCount},(_,i)=>'runner-'+i);
  const input=fixture(0,1,5,5),ids=['batter','carrier','receiver',...Array.from({length:7},(_,i)=>'defender-'+i),...runnerIds],roles=['body','glove','tag_hand','left_foot','right_foot'] as const;
  const actors=ids.flatMap((playerId,index)=>roles.map((role,j)=>{
    const glove=input.response.world.actors.find(a=>a.playerId===playerId)?.primitive;
    const runner=runnerIds.indexOf(playerId),bag=runner<0?null:input.geometry.baseGeometry.bases[(['first','second','third'] as const)[runner]];
    return{playerId,primitive:{role,radius:0.125,startTick:0,endTick:5_000_000,ticksPerSecond:1_000_000,
      startCenter:bag?v(bag.region.center.x,role.endsWith('foot')?1:2,bag.region.center.z):role==='glove'&&glove?glove.startCenter:v(20+index*5,10+j,5),startVelocity:stationary?v(0,0,0):glove?.startVelocity??v(0,0,0),acceleration:v(0,0,0)}};
  }));
  const response={...input.response,world:{...input.response.world,actors},actors:actors.map(a=>({playerId:a.playerId,
    profile:a.primitive.role==='glove'?input.response.actors[0].profile:{role:a.primitive.role,material}}))};
  const field=deriveInitialBattedWorldFieldMotion({...input,response,commands:actors.map(a=>({playerId:a.playerId,role:a.primitive.role,acceleration:v(0,0,0)}))});
  const match={ruleProfileId:asRuleProfileId('npb-2026'),playId:1,inning:1,half:'top' as const,outs,balls:0,strikes:0,bases:{first:runnerIds[0]??null,second:runnerIds[1]??null,third:runnerIds[2]??null},score:{away:0,home:0}};
  const timeline=recordBatBallContact(createCanonicalPlateAppearanceTimeline(match,0),response.world.flight.contact);
  const lineage={enrollmentReference:ref('same_pa_enrollments','enrollment'),actorReference:ref('physical_plate_appearance_actors','actor'),careerId:'career',gameId:'game',playId:1,firstPhysicalPitchSourceId:'pitch',participantReferences:[]};
  const root={kind:'same_pa_physical_field_root_v1',source:{sourceId:'root',sourceVersion:'fixture-only',parameters:response.world.parameters,liveProducerProfile:occupiedCount?'same_pa_stationary_occupied_catch_v1':'same_pa_empty_base_catch_v1'},
    physicalPitchSourceId:'pitch',pitchOrdinal:1,operationOrdinal:1,evaluationTick:field.motion.world.moment.ball.tick,response,geometry:input.geometry,field,lineage,timeline} as unknown as SamePaPhysicalFieldRoot;
  const source=(old:SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep,id:string,throughTick:number,action:SamePaPhysicalFieldStepSource['action']):SamePaPhysicalFieldStepSource=>({sourceId:id,sourceVersion:'fixture-only',capability:'same_pa_physical_field_step_v1',
    viewReference:ref('pa_lifecycle_v1_execution_views'),launchReference:ref('pa_physical_v1_launches','pitch'),previousOperationReference:fieldRef(old),previousFieldReference:fieldRef(old),fieldRootReference:reference('pa_physical_v1_field_roots',root),throughTick,action});
  const plan=prepareBattedWorldScheduledFieldAcquisition({response,geometry:input.geometry,field}),cs=source(root,'capture',plan.candidateSecureTick,{kind:'capture_checkpoint_v1',candidateReference:fieldRef(root),throughElapsedSeconds:plan.fenceElapsedSeconds});
  const capture:SamePaPhysicalFieldStep={...root,...deriveSamePaPhysicalFieldCapture(cs,root,root,root),kind:'same_pa_physical_field_step_v1',source:cs,operationOrdinal:2};
  const ss=source(capture,'seal',capture.evaluationTick,{kind:'retained_quantizer_checkpoint_v1'});
  const seal:SamePaPhysicalFieldStep={...capture,...deriveSamePaPhysicalQuantizerCheckpoint(ss,root,capture),source:ss,operationOrdinal:3};
  const scope={batterRunnerId:'batter',defenderIds:ids.slice(1,10),outsAtStart:outs,occupiedRunnerIds:runnerIds};
  const evidence=deriveSamePaFieldRuleEvidence({...scope,fields:[root,capture,seal]}),originalEvidence=deriveSamePaFieldRuleEvidence({...scope,fields:[root,capture]});
  const holds:SamePaStationaryHoldBasis[]=runnerIds.map((playerId,i)=>({source:{sourceId:'hold-'+i,sourceVersion:'test',playerId,enrollmentReference:lineage.enrollmentReference,coverageThroughTick:5_000_000},
    startingBase:([1,2,3] as const)[i],setup:{position:input.geometry.baseGeometry.bases[(['first','second','third'] as const)[i]].region.center},
    body:{actor:{bodyOriginHeightMeters:2,primitives:roles.map(role=>({role,radius:0.125,offset:v(0,role.endsWith('foot')?-1:0,0)}))}}}));
  const proof=(e:any)=>occupiedCount?deriveSamePaStationaryOccupiedRunners({match,root,holds,evidence:e}):undefined;
  const occupiedRunners=proof(evidence),originalOccupiedRunners=proof(originalEvidence);
  if(occupiedRunners?.kind==='pending'||originalOccupiedRunners?.kind==='pending')throw new Error('fixture stationary history missing');
  const fairCatch=deriveSamePaFairCatchRuleBasis({originalMatch:match,originalTimeline:timeline,evidence,...(occupiedRunners?{occupiedRunners}:{})}),originalCatch=deriveSamePaFairCatchRuleBasis({originalMatch:match,originalTimeline:timeline,evidence:originalEvidence,...(originalOccupiedRunners?{occupiedRunners:originalOccupiedRunners}:{})});
  const moment=seal.field.motion.world.moment,at={originTick:0,elapsedSeconds:moment.elapsedSeconds,tick:moment.ball.tick};
  const calledMoment=capture.field.motion.world.moment,calledAt={originTick:0,elapsedSeconds:calledMoment.elapsedSeconds,tick:calledMoment.ball.tick};
  const action={sourceId:'action',sourceVersion:'fixture-only',capability:'same_pa_explicit_catch_action_v1' as const,assignmentReference:{sourceId:'assignment',sourceVersion:'fixture-only',sourceHash:hash('assignment')},
    officialId:'umpire',personId:'umpire-person',viewReference:ref('pa_lifecycle_v1_execution_views','call-view'),judgment:'caught' as const,calledAt};
  const operative=deriveSamePaCatchOperativeRuling({action,originalMatch:match,batterRunnerId:'batter',basisTick:calledAt.tick,basisEvidenceRevision:2,fairCatch:originalCatch,...(originalOccupiedRunners?{occupiedRunners:originalOccupiedRunners}:{})});
  const emitted={sourceId:'umpire',targetScope:{kind:'nearby' as const},kind:'callout' as const,issuedAt:calledAt.tick,content:{actionSourceId:'action',officialId:'umpire',personId:'umpire-person',judgment:'caught' as const,calledAt}};
  const recipients=ids.map(playerId=>{
    const received=resolveExactCommunicationReception(emitted,calledAt.elapsedSeconds,{originTick:0,ticksPerSecond:1_000_000},{propagationDelayTicks:reception==='future'?100:0,
      recognitionBaseDelayTicks:0,maxAdditionalRecognitionDelayTicks:0,audibility:reception==='dropped'?0:1,recognition:1,attention:1,minimumRecognizableQuality:0.5},new DeterministicRng(1));
    const r=received?{playerId,kind:received.receivedAtElapsedSeconds>at.elapsedSeconds?'scheduled' as const:'received' as const,reception:received,receiverPosition:null}:{playerId,kind:'dropped' as const,reason:'not_recognizable'};
    return{playerId,reception:r,observations:[],controllerResponse:{kind:'pending' as const,reason:'not_consumed'}};
  });
  const catchWorkReference=ref('pa_catch_v1_work','work'),physicalPitchReference=ref('pa_physical_v1_launches','pitch'),viewReference=ref('pa_lifecycle_v1_execution_views','end-view');
  const view={source:{prefixReference:ref('pa_lifecycle_v1_work_prefixes','prefix')},lineage,coverageHash:hash('coverage'),cut:{physicalPitchReference,physicalOperationReference:fieldRef(seal)}};
  const actor={binding:{playerId:'batter'},defenderBindings:ids.slice(1,10).map(playerId=>({playerId})),world:{runners:runnerIds.map(playerId=>({playerId}))},match};
  const value={occupiedRunners,fairCatch,evidence,evidenceHash:hash(evidence),viewReference,lineage,originalMatch:match,originalTimeline:timeline,physicalPitchReference,physicalOperationReference:fieldRef(seal),fieldReferences:[root,capture,seal].map(fieldRef)};
  const pair={kind:'same_pa_field_rule_read_pair_v1',value,fields:[root,capture,seal],actor,view};
  const original={...pair,value:{...value,occupiedRunners:originalOccupiedRunners,fairCatch:originalCatch,evidence:originalEvidence,viewReference:action.viewReference,evidenceHash:hash(originalEvidence)}};
  const census={...deriveSamePaLiveWorkCensus({fields:pair.fields,participantIds:ids,observationPolicies:[],possessionEvidence:evidence.rule.possessionEvidence}),runnerPlans:[]};
  const live={kind:'same_pa_live_work_read_v1',census,communication:{kind:'owned_same_pa_catch_communication_v1',latestReference:catchWorkReference,emitted,recipients},
    ...(occupiedCount?{sourceLocalPhases:deriveSamePaCatchPhaseWork({fields:pair.fields,census,calls:[]})}:{})};
  const work={lineage,physicalPitchReference,physicalOperationReference:fieldRef(seal),operative,originalInputs:{action},communication:{evaluatedThrough:at}};
  mocks.pair=pair;mocks.original=original;mocks.live=live;mocks.work=work;mocks.prefix={kind:'same_pa_lifecycle_prefix',source:{eventReferences:[...value.fieldReferences,catchWorkReference]}};
  const run=()=>deriveSamePaFairCatchEndFromSqlite({} as DatabaseSync,viewReference,catchWorkReference,'historical');
  return{run,pair,original,live,work,seal,root};
};
it.each(['future','dropped'] as const)('ends only after actual sealed coverage and keeps genuine %s receptions in the finalizer',kind=>{
  const h=setup(kind),result=h.run();expect(h.live.census).not.toHaveProperty('occupiedRunnerCatchResponses');expect(result.kind).toBe('same_pa_fair_catch_physical_end_v1');
  if(result.kind==='pending')throw new Error(result.reason);
  expect(result.registry.resolution.kind).toBe('ended');expect(result.registry.frontier.physical).toHaveLength(10);
  expect(result.registry.frontier.actors.every(a=>a.kind==='acting')).toBe(true);
  expect(h.seal.field.motion.actors.some(a=>Object.values(a.primitive.startVelocity).some(n=>n!==0))).toBe(true);
  expect(result.registry.frontier.information).toHaveLength(kind==='future'?10:0);
  expect(result.generation.producerIds).toHaveLength(34);expect(result.generation.bodyBaseHistoryHashes).toHaveLength(40);
  expect(result.playEnd.tick).toBe(h.seal.evaluationTick);expect(result.exactEnd.elapsedSeconds).toBeGreaterThan(h.work.originalInputs.action.calledAt.elapsedSeconds);
});
it('does not retire a due received batter through the operative OUT or a rule-system reset',()=>{
  const h=setup('received');expect(h.run()).toEqual({kind:'pending',reason:'received_batter_response_and_adoption_required'});
});
it('keeps an issued departure intent pending even when the offense is otherwise terminal',()=>{
  const h=setup('dropped');
  h.live.census.defenderDepartures={purposes:[{status:'active'}],sources:[]} as never;
  expect(h.run()).toEqual({kind:'pending',reason:'original_defender_departure_execution_required'});
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
it.each([1,2,3])('occupied third-out keeps %s original runners, future work and exact base histories in the authenticated end',count=>{
  const h=setup('future',count,2),result=h.run();expect(result.kind).toBe('same_pa_fair_catch_physical_end_v1');
  if(result.kind==='pending')throw new Error(result.reason);
  expect(result.occupiedRunners?.runners).toHaveLength(count);
  expect(h.live.census).toHaveProperty('occupiedRunnerCatchResponses',{pending:[],adopted:[]});
  expect(result.scoringEvidence.occupiedRunners).toEqual(result.occupiedRunners);
  expect(result.registry.frontier.physical).toHaveLength(10+count);
  expect(result.registry.frontier.information).toHaveLength(10+count);
  expect(result.generation.bodyBaseHistoryHashes).toHaveLength(4*(10+count));
  expect(h.live.sourceLocalPhases?.phases.find(p=>p.kind==='acquisition')?.source).toHaveProperty('completion');
  expect(result.generation).not.toHaveProperty('sourceLocalPhases');
  expect(result.generation.producerIds).toHaveLength(34+3*count);
  expect(result.registry.registry.sources.filter(s=>s.sourceId.includes('body_motion')).every(s=>!s.completion)).toBe(true);
});
it('occupied non-third-out retains future live producers and never adopts the empty-base terminal shortcut',()=>{
  const h=setup('future',3,0);
  expect(h.run()).toEqual({kind:'pending',reason:'occupied_live_producer_completion_required'});
});
it('rejects a phase projection from another physical prefix before finalization',()=>{
  const h=setup('future',1,2);
  mocks.live={...h.live,sourceLocalPhases:{...h.live.sourceLocalPhases,originalFieldPrefix:{...h.live.census.originalFieldPrefix,physicalPitchSourceId:'foreign'}}};
  expect(h.run).toThrow(/phase prefix/);
});

it('retains occupied advance ownership even while the original body is stationary during reaction', () => {
  const h = setup('dropped', 1, 2);
  mocks.live = { ...h.live, census: { ...h.live.census, occupiedRunnerMotions: [{ playerId: 'runner0',
    adopted: true, work: [{ kind: 'reaction', due: 'future', dueTick: h.seal.evaluationTick + 1 }] }] } };
  expect(h.run()).toEqual({ kind: 'pending', reason: 'occupied_runner_moving_controller_end_owner_required' });
});


it.each(['pending', 'executed'] as const)('retains %s live appeal work before all-offense-terminal closure', status => {
  const h = setup('dropped', 1, 2);
  mocks.live = { ...h.live, census: { ...h.live.census, liveAppeals: {
    pending: status === 'pending' ? [{}] : [], executed: status === 'executed' ? [{}] : [], sources: [],
  } } };
  expect(h.run()).toEqual({ kind: 'pending', reason: status === 'pending'
    ? 'original_live_appeal_execution_required' : 'original_live_appeal_rule_and_rights_consumer_required' });
});

// The Native reader is the authentication seam in this file. These explicit
// sidecars stand for its original controller proofs; real Core still produces
// the stationary catch, possession, contacts and retained quantizer seal.
const withActorCompletion = (h: ReturnType<typeof setup>, basis: 'original_stationary_command' | 'executed_stopped_hold' = 'executed_stopped_hold') => {
  const at = h.live.census.originalFieldPrefix.at;
  const completed = basis === 'original_stationary_command' ? h.root : h.seal;
  const moment = completed.field.motion.world.moment;
  const actors = h.live.census.originalFieldPrefix.participantIds.map(playerId => {
    const source = (domain: string): LivePlaySource => ({ sourceId: JSON.stringify(['policy', playerId, domain]), revision: 1,
      queue: null, physical: [], intents: [], information: [], decisions: [], ruleWindows: [],
      completion: { completedAtTick: at.tick, basisEventId: h.seal.source.sourceId } });
    return { playerId, policyReference: fieldRef(h.root),
      observationScheduling: { complete: true, sources: [source('observation')] },
      controllerRenewal: { complete: true, sources: [source('controller')] },
      consumedControllerReferences: [] as ReturnType<typeof fieldRef>[],
      hold: { kind: 'same_pa_executed_stopped_hold_v1' as const, basis, playerId,
        commandReference: fieldRef(h.root), consumerReference: fieldRef(basis === 'original_stationary_command' ? h.root : h.pair.fields[1]),
        completionReference: fieldRef(completed), completedAt: { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick } } };
  });
  const actorProducerWork = { kind: 'same_pa_actor_producer_work_v1' as const,
    originalFieldPrefix: h.live.census.originalFieldPrefix, actors,
    sources: actors.flatMap(a => [...a.observationScheduling.sources, ...a.controllerRenewal.sources]) };
  const live = { ...h.live, actorProducerWork };
  mocks.live = live;
  return { ...h, live, actorProducerWork };
};

it('closes an occupied non-third-out only from independent completed actor, communication and physical proofs', () => {
  const h = withActorCompletion(setup('dropped', 1, 0, true)), result = h.run();
  expect(result.kind).toBe('same_pa_fair_catch_physical_end_v1');
  if (result.kind === 'pending') throw new Error(result.reason);
  expect(result.registry.resolution).toMatchObject({ kind: 'ended', reason: 'action_frontier_empty' });
  expect(result.registry.frontier.physical).toEqual([]);
  expect(result.registry.frontier.actors.every(a => a.kind === 'settled_for_play')).toBe(true);
  expect(result.registry.registry.sources.every(s => s.completion)).toBe(true);
  expect(result.generation.producerIds).toEqual(result.registry.registry.sources.map(s => s.sourceId));
  expect(result.generation).toHaveProperty('occupiedQuiescence.kind', 'same_pa_occupied_catch_quiescence_v1');
  expect(result.operative.onFieldCall.ruling.outsAfter).toBe(1);
  expect(result.occupiedRunners?.runners).toHaveLength(1);
});

it('keeps scheduled recipients open even when every actor has completed its own work', () => {
  const h = withActorCompletion(setup('future', 1, 0, true));
  expect(h.run()).toEqual({ kind: 'pending', reason: 'occupied_live_producer_completion_required' });
});

it.each(['original_stationary_command', 'executed_stopped_hold'] as const)('preserves the factual %s basis in occupied body completion', basis => {
  const h = withActorCompletion(setup('dropped', 1, 0, true), basis), result = h.run();
  expect(result.kind).toBe('same_pa_fair_catch_physical_end_v1');
  if (result.kind === 'pending') throw new Error(result.reason);
  const bodySources = result.registry.registry.sources.filter(s => s.sourceId.includes('body_motion'));
  expect(bodySources).toHaveLength(11);
  expect(bodySources.every(s => JSON.parse(s.completion!.basisEventId).kind === basis)).toBe(true);
  const bodies = result.generation.occupiedQuiescence!.holds;
  expect(bodies.every(a => a.hold?.basis === basis)).toBe(true);
  if (basis === 'original_stationary_command') {
    expect(bodies.every(a => a.hold?.commandReference.owner === 'pa_physical_v1_field_roots'
      && a.hold.consumerReference.owner === 'pa_physical_v1_field_roots'
      && a.hold.completionReference.owner === 'pa_physical_v1_field_roots')).toBe(true);
  }
});

it.each(['hold', 'observation', 'controller', 'source', 'empty_sources', 'actor'] as const)('keeps incomplete %s proof independent from other completed actors', fault => {
  const h = withActorCompletion(setup('dropped', 1, 0, true));
  const actor = h.actorProducerWork.actors[0];
  if (fault === 'hold') actor.hold = null as never;
  if (fault === 'observation') actor.observationScheduling.complete = false;
  if (fault === 'controller') actor.controllerRenewal.complete = false;
  if (fault === 'source') delete (actor.controllerRenewal.sources[0] as { completion?: unknown }).completion;
  if (fault === 'empty_sources') actor.controllerRenewal.sources = [];
  if (fault === 'actor') h.actorProducerWork.actors.pop();
  expect(h.run()).toEqual({ kind: 'pending', reason: 'occupied_live_producer_completion_required' });
});

it('retains an original future refresh even beside completed observation-source evidence', () => {
  const h = withActorCompletion(setup('dropped', 1, 0, true));
  h.live.census.observationRefresh = { ...h.live.census.observationRefresh,
    pending: [{ playerId: 'carrier', causeSourceId: 'original-sample', due: 'future', dueTick: h.seal.evaluationTick + 1 }] as never };
  expect(h.run()).toEqual({ kind: 'pending', reason: 'occupied_live_producer_completion_required' });
});

it('accepts terminal received deliveries only after each original actor has adopted its own response', () => {
  const h = withActorCompletion(setup('received', 1, 0, true));
  expect(h.run()).toMatchObject({ reason: 'received_batter_response_and_adoption_required' });
  mocks.live = { ...h.live, communication: { ...h.live.communication,
    recipients: h.live.communication.recipients.map(r => ({ ...r, controllerResponse: { kind: 'adopted', evidence: {
      responseReference: ref('pa_physical_v1_field_steps', r.playerId + '-response'),
      consumerReference: ref('pa_physical_v1_field_steps', r.playerId + '-adoption') } } })) } };
  const result = h.run();
  expect(result.kind).toBe('same_pa_fair_catch_physical_end_v1');
  if (result.kind === 'pending') throw new Error(result.reason);
  expect(result.generation.receivedControllerHandoffs).toHaveLength(11);
});

it('does not complete body motion from hold proof while a current part still moves', () => {
  const h = withActorCompletion(setup('dropped', 1, 0));
  expect(h.run()).toEqual({ kind: 'pending', reason: 'occupied_live_producer_completion_required' });
});

it('rejects actor completion read from a different original physical prefix', () => {
  const h = withActorCompletion(setup('dropped', 1, 0, true));
  h.actorProducerWork.originalFieldPrefix = { ...h.actorProducerWork.originalFieldPrefix, physicalPitchSourceId: 'foreign' };
  expect(h.run).toThrow(/actor producer.*prefix/);
});

it('requires a fresh controller after new received information invalidates the current candidate', () => {
  const h = withActorCompletion(setup('dropped', 1, 0, true));
  expect(h.run().kind).toBe('same_pa_fair_catch_physical_end_v1');
  const actor = h.actorProducerWork.actors[1];
  actor.controllerRenewal.complete = false;
  delete (actor.controllerRenewal.sources[0] as { completion?: unknown }).completion;
  expect(h.run()).toEqual({ kind: 'pending', reason: 'occupied_live_producer_completion_required' });
});

it('consumes a finite controller horizon only through the exact actor and original response proof', () => {
  const h = withActorCompletion(setup('dropped', 1, 0, true));
  const responseReference = ref('pa_physical_v1_field_steps', 'owned-held-response');
  h.live.census.occupiedRunnerCatchResponses = { pending: [], adopted: [{ responseReference,
    response: { playerId: 'runner-0' }, work: [{ kind: 'controller_end', due: 'due', dueTick: h.seal.evaluationTick }] }] } as never;
  const runner = h.actorProducerWork.actors.find(a => a.playerId === 'runner-0')!;
  expect(h.run()).toMatchObject({ reason: 'due_received_occupied_runner_controller_work_required' });
  h.actorProducerWork.actors[0].consumedControllerReferences.push(responseReference);
  expect(h.run()).toMatchObject({ reason: 'due_received_occupied_runner_controller_work_required' });
  runner.consumedControllerReferences.push(ref('pa_physical_v1_field_steps', 'another-held-response'));
  expect(h.run()).toMatchObject({ reason: 'due_received_occupied_runner_controller_work_required' });
  runner.consumedControllerReferences.push(responseReference);
  expect(h.run().kind).toBe('same_pa_fair_catch_physical_end_v1');
});

it.each(['due', 'future'] as const)('retains a %s exact controller piece until its own hold-consumption proof exists', due => {
  const h = withActorCompletion(setup('dropped', 1, 0, true));
  const controllerReference = ref('pa_physical_v1_field_steps', 'exact-held-piece');
  h.live.census.exactRunnerControllerPieces = [{ playerId: 'batter', controllerReference,
    kind: 'controller_piece', due, dueTick: h.seal.evaluationTick + (due === 'future' ? 100 : 0),
    dueElapsedSeconds: h.seal.field.motion.world.moment.elapsedSeconds + (due === 'future' ? 0.0001 : 0) }];
  expect(h.run()).toMatchObject({ reason: due === 'due' ? 'due_exact_runner_controller_piece_required' : 'occupied_live_producer_completion_required' });
  h.actorProducerWork.actors[0].consumedControllerReferences.push(controllerReference);
  expect(h.run().kind).toBe('same_pa_fair_catch_physical_end_v1');
});

it.each(['capture', 'throw', 'carrier', 'phase'] as const)('does not use actor completion to bypass independent %s evidence', fault => {
  const h = withActorCompletion(setup('dropped', 1, 0, true));
  if (fault === 'capture') h.live.census.pendingPhysical = { ...h.live.census.pendingPhysical, captures: [{}] as never };
  if (fault === 'throw') h.live.census.pendingPhysical = { ...h.live.census.pendingPhysical, throw: {} as never };
  if (fault === 'carrier') {
    const last = { ...h.seal, field: { ...h.seal.field, motion: { ...h.seal.field.motion, carrierPlayerId: null } } };
    mocks.pair = { ...h.pair, fields: [...h.pair.fields.slice(0, -1), last] };
  }
  if (fault === 'phase') {
    const phases = h.live.sourceLocalPhases!;
    mocks.live = { ...h.live, sourceLocalPhases: { ...phases,
      sources: phases.sources.map(s => { const { completion: _, ...open } = s; return open; }) } };
  }
  expect(h.run()).toMatchObject({ reason: fault === 'phase' ? 'occupied_live_producer_completion_required' : 'live_contact_or_possession_consumer_required' });
});

it.each([0, 1, 3])('preserves complete archived terminal output with %s occupied runners even when actor proofs are available', count => {
  const h = setup('future', count, count ? 2 : 0), before = h.run();
  expect(before.kind).toBe('same_pa_fair_catch_physical_end_v1');
  withActorCompletion(h);
  expect(h.run()).toEqual(before);
});

it.each(['complete', 'unconsumed_command', 'unconsumed_latest', 'no_adoption', 'new_information'] as const)(
  'connects resolved moving runner rights only with its own completed controller: %s', fault => {
    const h = withActorCompletion(setup('dropped', 1, 0, true)), runner = h.pair.value.occupiedRunners!.runners[0];
    // Native-authenticated structural seam: the complete contact evidence here
    // supports the original base, while the historical motion obligation remains.
    const occupiedRunnerEvidence = { kind: 'same_pa_occupied_fair_catch_runner_evidence_v1' as const, runners: [{
      playerId: runner.playerId, startingBase: runner.startingBase, holdReference: runner.holdReference,
      bases: (['home', 'first', 'second', 'third'] as const).map(base => ({ base,
        history: deriveBallWorldPlayerBaseContactHistory({ segments: h.pair.value.evidence.physical.segments,
          playerId: runner.playerId, base: h.root.geometry.baseGeometry.bases[base].region,
          baseSurfaceHeightMeters: h.root.geometry.baseGeometry.bases[base].surfaceHeightMeters }) })),
    }] };
    const fairCatch = deriveSamePaFairCatchRuleBasis({ originalMatch: h.pair.value.originalMatch,
      originalTimeline: h.pair.value.originalTimeline, evidence: h.pair.value.evidence, occupiedRunnerEvidence });
    expect(fairCatch.kind).toBe('same_pa_fair_catch_rule_basis_v1');
    mocks.pair = { ...h.pair, value: { ...h.pair.value, occupiedRunners: { kind: 'pending', reason: 'moving' }, occupiedRunnerEvidence, fairCatch } };
    mocks.original = { ...h.original, value: { ...h.original.value, fairCatch: { kind: 'pending', reason: 'stopped_between_bases' } } };
    const commandReference = fieldRef(h.pair.fields[1]), latestMotionReference = fieldRef(h.seal), responseReference = fieldRef(h.root);
    const actor = h.actorProducerWork.actors.find(a => a.playerId === runner.playerId)!;
    actor.consumedControllerReferences = [commandReference, latestMotionReference, responseReference];
    if (fault === 'unconsumed_command') actor.consumedControllerReferences = [latestMotionReference, responseReference];
    if (fault === 'unconsumed_latest') actor.consumedControllerReferences = [commandReference, responseReference];
    if (fault === 'new_information') actor.controllerRenewal.complete = false;
    mocks.live = { ...h.live, census: { ...h.live.census, occupiedRunnerMotions: [{ playerId: runner.playerId,
      commandReference, latestMotionReference, adopted: true, work: [],
      ...(fault === 'no_adoption' ? {} : { supersededBy: { responseReference, adoptionReference: latestMotionReference } }) }] } };
    const result = h.run();
    if (fault !== 'complete') expect(result).toEqual({ kind: 'pending', reason: 'occupied_runner_moving_controller_end_owner_required' });
    else {
      expect(result.kind).toBe('same_pa_fair_catch_physical_end_v1');
      if (result.kind === 'pending') throw new Error(result.reason);
      expect(result.scoringEvidence.occupiedRunnerEvidence).toEqual(occupiedRunnerEvidence);
      expect(result.generation.ruleConsumption).toMatchObject({ applicability: 'original_fair_catch_with_composed_runner_rights_v1',
        runnerOutcome: { finalRunnerLedger: { bases: h.pair.value.originalMatch.bases, scoredRunnerIds: [], retiredRunnerIds: ['batter'] } } });
      expect(result.registry.frontier.actors.every(a => a.kind === 'settled_for_play')).toBe(true);
    }
  });
