import type { LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLiveWorkCensus } from './SamePlateAppearanceLiveWorkCensus';
import type { SamePaCatchWork } from './SamePlateAppearanceCatchWorkFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaCurrentStoppedHold } from './SamePlateAppearanceActorProducerPolicy';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field=SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep;
const ref=(f:Field)=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
type Completion=Readonly<{reference:SamePaReference;tick:number}>;

/** Native supplies one authenticated open-play prefix. Each actual cause owns a
 * distinct finite generation. New information adds work; no completed source is
 * reopened and no old issued work is removed by a later decision. */
export const deriveSamePaActorProducerWork=(input:Readonly<{fields:readonly Field[];census:SamePaLiveWorkCensus;
  calls:readonly SamePaCatchWork[];playOpen:boolean;runnerPlans?:readonly Readonly<{playerId:string;planReference:SamePaReference;
    plannedThroughTick:number;status:'pending_motion'|'executed_through_planned_end'|'superseded_by_received_response';executions:readonly Readonly<{reference:SamePaReference}>[]}>[]}>)=>{
  const {fields,census,calls}=input,policies=census.actorProducerPolicies;
  if(!policies?.length)return null;
  if(!input.playOpen)throw new Error('actor producer reconsideration cannot reopen a closed play');
  const root=fields[0];if(root?.kind!=='same_pa_physical_field_root_v1'
    ||json(fields.map(ref))!==json(census.originalFieldPrefix.fieldReferences))throw new Error('actor producer original prefix differs');
  const records=new Map(fields.map((f,index)=>[json(ref(f)),{f,index}]));
  const original=(pin:SamePaReference)=>{const found=records.get(json(pin));if(!found)throw new Error('actor producer original obligation missing');return found;};
  const completion=(pin:SamePaReference):Completion=>({reference:pin,tick:original(pin).f.evaluationTick});
  const heldAt=new Map<string,Map<number,ReturnType<typeof samePaCurrentStoppedHold>>>();
  const afterHold=(playerId:string,pin:SamePaReference):Completion|null=>{
    const index=original(pin).index;
    for(let i=index;i<fields.length;i++){
      let cuts=heldAt.get(playerId);if(!cuts){cuts=new Map();heldAt.set(playerId,cuts);}
      if(!cuts.has(i))cuts.set(i,samePaCurrentStoppedHold(fields.slice(0,i+1),playerId));
      const proof=cuts.get(i);
      if(proof&&original(proof.consumerReference).index>=index)return completion(proof.completionReference);
    }
    return null;
  };
  const actors=policies.map(policy=>{
    const playerId=policy.playerId,observations=fields.filter((f):f is SamePaPhysicalFieldStep=>f.kind==='same_pa_physical_field_step_v1'
      &&f.actionResult?.kind==='defender_observation_v1'&&f.actionResult.playerId===playerId);
    original(policy.policyReference);
    const observationSources:LivePlaySource[]=[],controllerSources:LivePlaySource[]=[],consumedControllerReferences:SamePaReference[]=[];
    const add=(domain:'observation_scheduling'|'controller_renewal',cause:SamePaReference,suffix:string,proof:Completion|null,deadlines:readonly number[])=>{
      const sourceId=json(['same_pa_actor_producer_v1',root.lineage.enrollmentReference.sourceId,root.physicalPitchSourceId,playerId,domain,cause,suffix]);
      const source:LivePlaySource={sourceId,revision:proof?2:1,queue:null,physical:[],intents:[],information:[],decisions:[],ruleWindows:[],
        ...(proof?{completion:{completedAtTick:proof.tick,basisEventId:json(proof.reference)}}:domain==='observation_scheduling'
          ?{information:deadlines.map((dueTick,index)=>({workId:json([sourceId,index]),kind:'in_flight_information' as const,actorId:playerId,dueTick,causeEventId:json(cause)}))}
          :{decisions:deadlines.map((dueTick,index)=>({workId:json([sourceId,index]),kind:'actor_decision' as const,actorId:playerId,dueTick}))})};
      (domain==='observation_scheduling'?observationSources:controllerSources).push(source);
    };
    // An adopted new action following a terminal sample owns fresh calibrated
    // refresh work. Completed sampling generations never reopen or backdate.
    const reconsiderObservation=(cause:SamePaReference,observation:SamePaReference,consumer:SamePaReference)=>{
      const terminal=census.terminalObservations?.find(o=>json(o.observationReference)===json(observation));
      const adopted=original(consumer),motor=adopted.f.kind==='same_pa_physical_field_step_v1'
        &&adopted.f.actionResult?.kind==='defender_motion_v1'?adopted.f.actionResult.motors.find(m=>m.self.playerId===playerId):null;
      if(terminal&&motor&&motor.intent.kind!=='hold')for(const refresh of terminal.reconsiderationRefresh){
        const sampled=observations.find(o=>original(ref(o)).index>adopted.index&&o.actionResult?.kind==='defender_observation_v1'
          &&o.actionResult.receipt.results.some(r=>json(r.target)===json(refresh.target)&&r.status!=='refresh_not_due'));
        add('observation_scheduling',cause,'active_controller_refresh:'+json(refresh.target),sampled?completion(ref(sampled)):null,[refresh.dueTick]);
      }
    };
    add('observation_scheduling',policy.policyReference,'accepted_policy',completion(policy.policyReference),[]);
    // The accepted policy needs its original stationary command or a later executed hold.
    // Absence of observation rows is never used to claim controller completion.
    const policyHold=afterHold(playerId,policy.policyReference);
    add('controller_renewal',policy.policyReference,'accepted_policy',policyHold,[policy.declaredAt.tick]);
    for(const [index,observed] of observations.entries()){
      const pin=ref(observed),pending=census.observationRefresh.pending.filter(w=>w.playerId===playerId&&json(w.causeReference)===json(pin));
      const consumed=census.observationRefresh.consumed.filter(w=>w.playerId===playerId&&json(w.causeReference)===json(pin));
      const last=consumed.at(-1);
      add('observation_scheduling',pin,'refresh',pending.length?null:completion(last?.consumerReference??pin),pending.map(w=>w.dueTick));
      const ordinary=[...census.defenderDecisions.pending,...census.defenderDecisions.consumed].filter(d=>d.playerId===playerId&&json(d.observationReference)===json(pin));
      const responses=[...census.catchResponses.pending,...census.catchResponses.adopted].filter(r=>r.response.playerId===playerId&&json(r.response.observationReference)===json(pin));
      const issued=[...census.defenderDecisions.consumed.filter(d=>d.playerId===playerId&&json(d.observationReference)===json(pin)),
        ...census.catchResponses.adopted.filter(r=>r.response.playerId===playerId&&json(r.response.observationReference)===json(pin))]
        .sort((a,b)=>original(a.consumerReference).index-original(b.consumerReference).index)[0];
      const superseded=!ordinary.length&&!responses.length?observations[index+1]:undefined;
      add('controller_renewal',pin,'observed_information',issued?completion(issued.consumerReference):superseded?completion(ref(superseded)):null,[observed.evaluationTick]);
    }
    for(const d of [...census.defenderDecisions.pending,...census.defenderDecisions.consumed].filter(d=>d.playerId===playerId)){
      const consumer=census.defenderDecisions.consumed.find(c=>json(c.decisionReference)===json(d.decisionReference));
      const proof=consumer?afterHold(playerId,consumer.consumerReference):null;
      add('controller_renewal',d.decisionReference,'issued_decision',proof,[d.decisionTick,d.movementStartTick]);
      if(proof)consumedControllerReferences.push(d.decisionReference);
      if(consumer)reconsiderObservation(d.decisionReference,d.observationReference,consumer.consumerReference);
    }
    const responses=[...census.catchResponses.pending,...census.catchResponses.adopted,...census.batterCatchResponses.pending,...census.batterCatchResponses.adopted,
      ...(census.occupiedRunnerCatchResponses?.pending??[]),...(census.occupiedRunnerCatchResponses?.adopted??[])].filter(r=>r.response.playerId===playerId);
    for(const item of responses){
      const proof='consumerReference' in item?afterHold(playerId,item.consumerReference):null;
      let cause=item.responseReference;
      if(item.response.kind==='defender_catch_response_v1'){
        const processId=item.response.replan.processSourceId,origin=fields.find(f=>f.source.sourceId===processId);
        if(origin?.kind!=='same_pa_physical_field_step_v1'||origin.actionResult?.kind!=='defender_catch_response_v1'||origin.actionResult.playerId!==playerId)
          throw new Error('actor producer original response lifecycle missing');
        cause=reference('pa_physical_v1_field_steps',origin);
      }
      const field=original(cause).f;
      add('controller_renewal',cause,'received_response',proof,[field.evaluationTick]);
      if(proof)consumedControllerReferences.push(item.responseReference);
      if('consumerReference' in item&&item.response.kind==='defender_catch_response_v1')
        reconsiderObservation(cause,item.response.observationReference,item.consumerReference);
    }
    for(const f of fields){
      const r=f.kind==='same_pa_physical_field_step_v1'?f.actionResult:undefined;
      if((r?.kind!=='batter_run_motion_v1'&&r?.kind!=='occupied_runner_motion_v1'&&r?.kind!=='batter_recovery_motion_v1')||r.playerId!==playerId)continue;
      const proof=afterHold(playerId,ref(f));
      add('controller_renewal',ref(f),'executed_motion',proof,[f.evaluationTick]);
      if(proof&&r.kind==='occupied_runner_motion_v1')consumedControllerReferences.push(ref(f));
    }
    for(const plan of input.runnerPlans??[]){
      if(plan.playerId!==playerId)continue;
      const last=plan.executions.at(-1),proof=plan.status!=='pending_motion'&&last?afterHold(playerId,last.reference):null;
      add('controller_renewal',plan.planReference,'accepted_run_plan',proof,[plan.plannedThroughTick]);
    }
    // Delivery is independent. Once a new original call actually arrives, it
    // has its own reconsideration generation even if an older one completed.
    const received=new Set<string>();
    for(const call of calls){
      if(json(call.lineage)!==json(root.lineage)||call.physicalPitchReference.sourceId!==root.physicalPitchSourceId
        ||call.evaluationTick>census.originalFieldPrefix.at.tick)throw new Error('actor producer original call scope differs');
      original(call.physicalOperationReference);
      const recipient=call.communication.recipients.find(r=>r.playerId===playerId);
      if(recipient?.kind!=='received')continue;
      const actionId=call.originalInputs.action?.sourceId;if(!actionId)throw new Error('actor producer received call action missing');
      if(received.has(actionId))continue;received.add(actionId);
      const answer=responses.find(r=>'callSourceId' in r.response?r.response.callSourceId===actionId:r.response.replan.cause?.callSourceId===actionId);
      const proof=answer&&'consumerReference' in answer?afterHold(playerId,answer.consumerReference):null;
      if(proof&&proof.tick<recipient.reception.received.receivedAt)throw new Error('actor producer response precedes received information');
      add('controller_renewal',reference('pa_catch_v1_work',call),'received_information',proof,[recipient.reception.received.receivedAt]);
    }
    const hold=samePaCurrentStoppedHold(fields,playerId);
    if(hold&&consumedControllerReferences.some(pin=>json(pin)===json(hold.commandReference)))
      for(const piece of census.exactRunnerControllerPieces??[]){
        if(piece.playerId!==playerId)continue;
        const f=original(piece.controllerReference).f,r=f.kind==='same_pa_physical_field_step_v1'?f.actionResult:undefined;
        if((r?.kind==='batter_catch_motion_v1'||r?.kind==='occupied_runner_catch_motion_v1')&&json(r.responseReference)===json(hold.commandReference))consumedControllerReferences.push(piece.controllerReference);
      }
    return{playerId,policyReference:policy.policyReference,observationScheduling:{complete:observationSources.every(s=>s.completion!==undefined),sources:observationSources},
      controllerRenewal:{complete:controllerSources.every(s=>s.completion!==undefined),sources:controllerSources},consumedControllerReferences,hold};
  });
  return freeze({kind:'same_pa_actor_producer_work_v1' as const,originalFieldPrefix:census.originalFieldPrefix,actors,
    sources:actors.flatMap(a=>[...a.observationScheduling.sources,...a.controllerRenewal.sources]),
    independentDomains:['body_motion','ball_and_contact_generation','communication_ingress','rule_consumption','other_actors'] as const});
};
