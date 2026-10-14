import { expect,it } from 'vitest';
import { samePaBatterRunFixture } from './SamePlateAppearanceBatterRunFixtures.test-support';
import { deriveBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveSamePaLiveWorkCensus } from './SamePlateAppearanceLiveWorkCensus';
import { deriveSamePaActorProducerWork } from './SamePlateAppearanceActorProducerCompletion';
import { SAME_PA_ACTOR_PRODUCER_POLICY as policy, samePaCurrentStoppedHold } from './SamePlateAppearanceActorProducerPolicy';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { createLivePlayRegistry, resolveLivePlayRegistry } from '../../core/sim/liveAction/LivePlayRegistry';
import { samePaPhysicalEpisodeSourceInput } from './SamePlateAppearancePhysicalEpisode';
import { samePaPhysicalFieldActionInput } from './SamePlateAppearancePhysicalFieldAction';
const pin=(f:any)=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
const ref=(owner:string,id=owner)=>({owner,sourceId:id,sourceHash:hash(id),snapshotHash:hash(id)});
/** Structural Native records with real Core physical checkpoints. No SQLite or
 * full original-person ancestry qualification is claimed by this focused test. */
const setup=()=>{
  const h=samePaBatterRunFixture(true),root=h.root;
  root.operationOrdinal=0;root.pitchOrdinal=1;root.source.parameters=root.response.world.parameters;root.lineage.enrollmentReference=ref('same_pa_enrollments');
  root.source.commands=['batter','fielder'].map(playerId=>({playerId,bodyAcceleration:{x:0,y:0,z:0},primitiveMotions:root.field.motion.actors.filter((a:any)=>a.playerId===playerId)
    .map((a:any)=>({role:a.primitive.role,offsetVelocity:{x:0,y:0,z:0},offsetAcceleration:{x:0,y:0,z:0}}))}));
  const fields:any[]=[root];let sequence=0;
  const append=(actionResult?:any,action?:any,field=fields.at(-1).field)=>{
    const previous=fields.at(-1),step={...root,kind:'same_pa_physical_field_step_v1',operationOrdinal:previous.operationOrdinal+1,
      evaluationTick:field.motion.world.moment.ball.tick,field,source:{sourceId:'step-'+sequence++,sourceVersion:'test',throughTick:field.motion.world.moment.ball.tick,
        previousFieldReference:pin(previous),previousOperationReference:pin(previous),fieldRootReference:pin(root),...(action?{action}:{})},...(actionResult?{actionResult}:{})};
    fields.push(step);return step;
  };
  const advance=(throughTick:number,r?:any,a?:any)=>{
    const previous=fields.at(-1),m=previous.field.motion;
    return append(r,a,deriveBattedWorldFieldMotionCheckpoint({response:root.response,geometry:root.geometry,actors:m.actors,cursor:m.cursor,
      carrierPlayerId:null,availableAtTick:previous.evaluationTick,coverageThroughTick:5_000_000,checkpointThroughTick:throughTick,
      commands:m.actors.map((a:any)=>({playerId:a.playerId,role:a.primitive.role,acceleration:a.primitive.acceleration}))}));
  };
  const observe=(enable=false,status='detected',playerId='fielder')=>{
    const m=fields.at(-1).field.motion.world.moment,at={originTick:m.originTick,elapsedSeconds:m.elapsedSeconds,tick:m.ball.tick},sourceId='step-'+sequence;
    return append({kind:'defender_observation_v1',playerId,samplingRequest:{sourceId,playerId,view:{attentionTarget:{kind:'ball'}}},
      receipt:{at,results:[{target:{kind:'ball'},status}]}},{kind:'defender_observation_v1',member:{playerId},view:{attentionTarget:{kind:'ball'}},
      ...(enable?{actorProducerPolicy:policy}:{})});
  };
  const decide=(observed:any,delay=10)=>{
    const start=fields.at(-1).evaluationTick;
    return append({kind:'defender_decision_v1',playerId:'fielder',observationReference:pin(observed),
      calculation:{scheduling:{startedAtTick:start,decisionTick:start+delay,movementStartTick:start+delay+10,decisionDelayTicks:delay,firstStepDelayTicks:10}}},
    {kind:'defender_decision_v1',member:{playerId:'fielder'},observationReference:pin(observed)});
  };
  const motor=(chosen:any,positive=true,intent='hold')=>{
    const start=chosen.actionResult.calculation.scheduling.movementStartTick;
    if(fields.at(-1).evaluationTick<start)advance(start);
    const m=fields.at(-1).field.motion.world.moment;
    const r={kind:'defender_motion_v1',motors:[{self:{playerId:'fielder'},command:{playerId:'fielder'},intent:{kind:intent},
      startAt:{originTick:m.originTick,elapsedSeconds:m.elapsedSeconds,tick:m.ball.tick}}],coverageThroughTick:5_000_000};
    const a={kind:'defender_motion_v1',selections:[{member:{playerId:'fielder'},decisionReference:pin(chosen)}]};
    return positive?advance(start+1,r,a):append(r,a);
  };
  const census=()=>deriveSamePaLiveWorkCensus({fields,participantIds:['batter','fielder'],observationPolicies:fields.flatMap(f=>f.actionResult?.kind==='defender_observation_v1'
    ?[{observationReference:pin(f) as never,refreshPolicy:{attendedIntervalTicks:10,peripheralIntervalTicks:40}}]:[]),
    possessionEvidence:{policy:'scheduled_capture_confirmation_v1',originTick:0,ticksPerSecond:1_000_000,
      throughElapsedSeconds:fields.at(-1).field.motion.world.moment.elapsedSeconds,pending:[]}});
  const work=(calls:any[]=[],playOpen=true,runnerPlans:any[]=[])=>deriveSamePaActorProducerWork({fields,census:census(),calls,playOpen,runnerPlans});
  const finish=()=>{const first=observe(true),decision=decide(first);motor(decision);const terminal=observe();const final=decide(terminal);motor(final);return{first,decision,terminal,final};};
  return{root,fields,append,advance,observe,decide,motor,census,work,finish};
};

it('preserves the legacy census shape and recurring refresh without an accepted actor policy',()=>{
  const h=setup();h.observe();expect(h.census()).not.toHaveProperty('actorProducerPolicies');expect(h.work()).toBeNull();
  expect(h.census().observationRefresh.pending).toHaveLength(1);
});
it('accepts only the explicit versioned policy on existing original actor Sources',()=>{
  const member={playerId:'fielder',bindingHash:hash('binding'),personHash:hash('person'),baselineSourceId:'baseline',reservedRevision:0,
    reservedStateHash:hash('reserved'),projectedStateHash:hash('projected')};
  const observed:any={kind:'defender_observation_v1',member,calibrationReference:ref('pa_lifecycle_v1_execution_calibrations'),previousObservationReference:null,
    view:{poseVersion:'pose',bodyRelativeEyeOffset:{x:0,y:1,z:0},forward:{x:1,y:0,z:0},attentionTarget:{kind:'ball'}},actorProducerPolicy:policy};
  const common={member,catchWorkReference:ref('pa_catch_v1_work'),intent:{kind:'hold',issuedTick:0},endTick:100,
    provenance:{sourceRecordId:'explicit',sourceVersion:'test'},actorProducerPolicy:policy};
  const caught:any={...common,kind:'batter_catch_response_v1',motionBasis:{kind:'runner_plan',planReference:ref('world_batter_run_plans')}};
  const occupied:any={...common,kind:'occupied_runner_catch_response_v1',holdReference:ref('world_same_pa_occupied_runner_holds')};
  for(const source of [observed,caught,occupied]){
    expect(()=>samePaPhysicalFieldActionInput(source)).not.toThrow();
    expect(()=>samePaPhysicalFieldActionInput({...source,actorProducerPolicy:'complete'})).toThrow();
    expect(()=>samePaPhysicalFieldActionInput({...source,completed:true})).toThrow();
  }
});
it('drains real issued work, samples the prior refresh, then requires the terminal sample decision and actual hold',()=>{
  const h=setup(),first=h.observe(true),chosen=h.decide(first);h.advance(20);
  expect(h.work()!.actors[0].controllerRenewal.complete).toBe(false);
  expect(h.census().observationRefresh.pending).toHaveLength(1);
  h.motor(chosen);const terminal=h.observe();
  expect(h.census().terminalObservations).toMatchObject([{observationReference:pin(terminal),policyReference:pin(first)}]);
  expect(h.census().observationRefresh.pending).toEqual([]);
  expect(h.census().observationRefresh.consumed).toMatchObject([{causeReference:pin(first),consumerReference:pin(terminal)}]);
  expect(h.work()!.actors[0].controllerRenewal.complete).toBe(false);
  const final=h.decide(terminal);h.motor(final);const actor=h.work()!.actors[0];
  expect(actor.observationScheduling.complete).toBe(true);expect(actor.controllerRenewal.complete).toBe(true);
  expect(actor.consumedControllerReferences).toContainEqual(pin(chosen));expect(actor.consumedControllerReferences).toContainEqual(pin(final));
  expect(actor.hold?.commandReference).toEqual(pin(final));expect(h.work()).not.toHaveProperty('playEnd');
});
it('does not treat zero-time motor adoption as consumed action or a terminal observation predicate',()=>{
  const h=setup(),first=h.observe(true),chosen=h.decide(first);h.motor(chosen,false);
  expect(samePaCurrentStoppedHold(h.fields,'fielder')).toBeNull();h.observe();
  expect(h.census().terminalObservations).toEqual([]);expect(h.work()!.actors[0].controllerRenewal.complete).toBe(false);
});
it('a refresh-not-due attempt cannot consume an outstanding refresh under the drain policy',()=>{
  const h=setup(),first=h.observe(true),chosen=h.decide(first);h.motor(chosen);h.observe(false,'refresh_not_due');
  expect(h.census().observationRefresh.pending).toMatchObject([{causeReference:pin(first)}]);
  expect(h.work()!.actors[0].observationScheduling.complete).toBe(false);
});
it('keeps every older unconsumed decision and the other actor refresh when a newer hold executes',()=>{
  const h=setup(),first=h.observe(true),old=h.decide(first),newer=h.decide(first);h.observe(false,'detected','batter');h.motor(newer);h.observe();
  expect(h.census().terminalObservations).toEqual([]);
  expect(h.census().defenderDecisions.pending.map(d=>d.decisionReference)).toContainEqual(pin(old));
  expect(h.census().observationRefresh.pending.some(w=>w.playerId==='batter')).toBe(true);
  expect(h.work()!.actors).toHaveLength(1);expect(h.work()!.actors[0].controllerRenewal.complete).toBe(false);
});
it('a new actual observation adds reconsideration without reopening completed generations',()=>{
  const h=setup();h.finish();const before=h.work()!;expect(before.actors[0].controllerRenewal.complete).toBe(true);
  h.observe();const after=h.work()!;
  for(const s of before.sources)expect(after.sources.find(v=>v.sourceId===s.sourceId)).toEqual(s);
  expect(after.sources.length).toBeGreaterThan(before.sources.length);expect(after.actors[0].controllerRenewal.complete).toBe(false);
});
it('a terminal sample leading to a new adopted action creates fresh calibrated observation work',()=>{
  const h=setup(),first=h.observe(true);h.motor(h.decide(first));const terminal=h.observe(),decision=h.decide(terminal);
  h.motor(decision,true,'ball_handler');const before=h.work()!;
  const renewed=before.actors[0].observationScheduling.sources.find(s=>s.sourceId.includes('active_controller_refresh'))!;
  expect(renewed.completion).toBeUndefined();expect(renewed.information[0].dueTick).toBe(terminal.evaluationTick+10);
  h.observe();const after=h.work()!,consumed=after.sources.find(s=>s.sourceId===renewed.sourceId)!;
  expect(consumed.completion).toBeDefined();expect(after.actors[0].observationScheduling.complete).toBe(false);
});
it('new received information and accepted unexecuted plans remain pending despite an older completed hold',()=>{
  const h=setup();h.finish();const last=h.fields.at(-1),at=last.field.motion.world.moment;
  const call:any={source:{sourceId:'new-call',sourceVersion:'test'},lineage:h.root.lineage,physicalPitchReference:{sourceId:'pitch'},
    physicalOperationReference:pin(last),evaluationTick:last.evaluationTick,originalInputs:{action:{sourceId:'new-action'}},
    communication:{recipients:[{playerId:'fielder',kind:'received',reception:{received:{receivedAt:at.ball.tick}}}]}};
  const current=h.work([call])!;expect(current.actors[0].controllerRenewal.complete).toBe(false);
  expect(current.sources.some(s=>s.sourceId.includes('received_information')&&!s.completion)).toBe(true);
  expect(h.work([],true,[{playerId:'fielder',planReference:ref('world_batter_run_plans','not-executed'),plannedThroughTick:100,status:'pending_motion',executions:[]}])!
    .actors[0].controllerRenewal.complete).toBe(false);
});
it('does not reopen a closed play or absorb independent physical/custody obligations',()=>{
  const h=setup();h.finish();expect(()=>h.work([],false)).toThrow(/closed play/);
  const work=h.work()!,tick=h.fields.at(-1).evaluationTick,source={sourceId:'custody',revision:1,queue:null,physical:[],intents:[],information:[],decisions:[],ruleWindows:[]};
  const result=resolveLivePlayRegistry(createLivePlayRegistry({playId:1,revision:1,sources:[...work.sources,source]}),
    {tick,terminal:'none',actors:[{actorId:'fielder',kind:'settled_for_play',settledAt:tick,basisEventId:'hold'}]});
  expect(result.resolution.kind).toBe('continues');
  expect(work.independentDomains).toContain('ball_and_contact_generation');
});

it('binds the same policy to original stationary commands without fabricating new holds',()=>{
  const h=setup();h.root.source.actorProducerPolicies=[{playerId:'fielder',policy}];h.advance(50);
  const before=h.work()!,actor=before.actors[0];
  expect(actor.controllerRenewal.complete).toBe(true);expect(actor.observationScheduling.complete).toBe(true);
  expect(actor.hold).toMatchObject({basis:'original_stationary_command',commandReference:pin(h.root),consumerReference:pin(h.root),completionReference:pin(h.root)});
  expect(actor.consumedControllerReferences).toEqual([]);
  const observed=h.observe();const after=h.work()!;
  for(const source of before.sources)expect(after.sources.find(v=>v.sourceId===source.sourceId)).toEqual(source);
  expect(after.actors[0].controllerRenewal.complete).toBe(false);
  h.motor(h.decide(observed),true,'ball_handler');expect(h.work()!.actors[0].hold).toBeNull();
  expect(h.work()!.actors[0].controllerRenewal.complete).toBe(false);
});
it('does not turn original stationary state into authority for unissued participants or pending plans',()=>{
  const h=setup();expect(samePaCurrentStoppedHold(h.fields,'fielder')).toBeNull();
  h.root.source.actorProducerPolicies=[{playerId:'fielder',policy}];
  expect(h.work([],true,[{playerId:'fielder',planReference:ref('world_batter_run_plans','unexecuted'),plannedThroughTick:100,status:'pending_motion',executions:[]}])!
    .actors[0].controllerRenewal.complete).toBe(false);
  h.root.source.commands[1].bodyAcceleration.x=1;
  expect(samePaCurrentStoppedHold(h.fields,'fielder')).toBeNull();
});
it('validates original root policy participants, uniqueness, and exact version while preserving absent-policy Source bytes',()=>{
  const h=setup(),source={...h.root.source,capability:'same_pa_physical_field_root_v1',viewReference:ref('pa_lifecycle_v1_execution_views'),
    launchReference:ref('pa_physical_v1_launches'),previousOperationReference:ref('pa_physical_v1_resolutions'),resolutionReference:ref('pa_physical_v1_resolutions'),
    postureReference:ref('batting_observation_v1_postures'),fieldInputs:{kind:'fresh_physical_field_calibration_v1',calibrationReference:ref('pa_physical_v1_field_calibrations')},throughTick:0,
    commands:Array.from({length:10},(_,i)=>({...h.root.source.commands[0],playerId:'player-'+i}))};
  expect(samePaPhysicalEpisodeSourceInput(source)).toEqual(source);
  const entry={playerId:'player-0',policy};expect(()=>samePaPhysicalEpisodeSourceInput({...source,actorProducerPolicies:[entry]})).not.toThrow();
  for(const policies of [[],[entry,entry],[{...entry,playerId:'foreign'}],[{...entry,policy:'complete'}],[{...entry,completed:true}]])
    expect(()=>samePaPhysicalEpisodeSourceInput({...source,actorProducerPolicies:policies})).toThrow();
});

it('retains the original command across an inert reanchor and rejects any changed original part position',()=>{
  const h=setup();h.root.source.actorProducerPolicies=[{playerId:'fielder',policy}];h.advance(50);
  const physical=structuredClone(h.fields.at(-1).field);
  for(const actor of physical.motion.actors)if(actor.playerId==='fielder')actor.primitive.startTick=50;
  h.append(undefined,undefined,physical);
  expect(samePaCurrentStoppedHold(h.fields,'fielder')?.basis).toBe('original_stationary_command');
  const changed=structuredClone(physical);changed.motion.actors.find((a:any)=>a.playerId==='fielder').primitive.startCenter.x+=1;
  h.append(undefined,undefined,changed);expect(samePaCurrentStoppedHold(h.fields,'fielder')).toBeNull();
});
