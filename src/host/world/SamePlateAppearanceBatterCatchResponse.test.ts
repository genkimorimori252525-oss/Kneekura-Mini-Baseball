import { expect, it, vi } from 'vitest';
import { samePaBatterRunFixture } from './SamePlateAppearanceBatterRunFixtures.test-support';
import { prepareBatterRunPlan } from './BatterRunPlan';
import { deriveSamePaBatterRunMotion } from './SamePlateAppearanceBatterRunMotion';
import { deriveSamePaBatterCatchResponse, samePaBatterCatchResponseInput } from './SamePlateAppearanceBatterCatchResponse';
import { deriveSamePaBatterCatchMotion } from './SamePlateAppearanceBatterCatchMotion';
import { deriveSamePaBatterCatchCensus } from './SamePlateAppearanceBatterCatchCensus';
import { deriveSamePaCatchOperativeRuling } from './SamePlateAppearanceCatchOperativeRuling';
import { resolveExactCommunicationReception } from '../../core/sim/perception/ExactCommunication';
import { DeterministicRng } from '../../core/rng/DeterministicRng';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertSamePaBatterCatchOwnership } from './SamePlateAppearanceBatterCatchOwnership';
import { assertSamePaPhysicalThrowOwnership } from './SamePlateAppearancePhysicalFieldThrow';
import { samePaOutcomeFieldEvidence, samePaOutcomeRetirement } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
const mocks = vi.hoisted(()=>({work:null as any,journal:null as any,physical:null as any,plan:null as any,exit:null as any,records:new Map<string,any>(),pitch:null as any}));
vi.mock('./SamePlateAppearanceCatchWorkFromSqlite',()=>({readSamePaCatchWorkFromSqlite:()=>mocks.work}));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite',()=>({readSamePaLifecycleRecordFromSqlite:()=>mocks.journal}));
vi.mock('./SamePlateAppearancePhysicalEpisodeFromSqlite',()=>({readSamePaPhysicalOperationFromSqlite:(_db:unknown,ref:any)=>({record:mocks.records.get(ref.sourceId)??mocks.physical,physicalPitchReference:mocks.pitch})}));
vi.mock('./SqliteBatterRunPlanStore',()=>({readBatterRunPlanFromSqlite:()=>mocks.plan}));
vi.mock('./SqliteBatterSwingExitStateStore',()=>({batterSwingExitStateEvidenceFromSqlite:()=>({read:()=>mocks.exit})}));
const ref=<T extends string>(owner:T,sourceId:string)=>({owner,sourceId,sourceHash:hash(sourceId),snapshotHash:hash(sourceId)});
/** Structural Native read seams. Core executes the body and reception; these
 * author tests do not claim durable original-Source admission or a fair catch. */
const fixture=(initial=false,runTicks=1_000_000,reactionDelayTicks=100_000)=>{
  const h=samePaBatterRunFixture(true),exit=structuredClone(h.plan.exitState),pitch=ref('pa_physical_v1_launches','pitch');
  mocks.records.clear();mocks.pitch=pitch;
  exit.model.runnerModel.source={...exit.model.runnerModel.source,sourceId:'runner-model',sourceVersion:'test',motion:{...exit.model.runnerModel.source.motion,reactionDelayTicks}};
  exit.source={...exit.source,sourceId:'exit',sourceVersion:'test'};exit.lineage=h.root.lineage;
  const plan={...h.plan,exitState:exit,physicalPitchReference:pitch,
    plan:prepareBatterRunPlan(exit,{playerId:'batter',personId:'person',route:{segments:[{kind:'line',start:{x:0,z:0},end:{x:30,z:0}}]},intent:{kind:'advance',issuedTick:0},endTick:3_000_000})};
  const planReference=reference('world_batter_run_plans',plan),prefix:any[]=[h.root];
  let previous=h.root;
  if(!initial){
    for(const throughTick of [...(reactionDelayTicks ? [reactionDelayTicks] : []),runTicks]){
      const source={sourceId:'run-piece-'+throughTick,sourceVersion:'test',throughTick,action:{kind:'batter_run_motion_v1' as const,planReference}};
      const moved=deriveSamePaBatterRunMotion(source as any,h.root,previous,plan,prefix);
      previous={...h.root,...moved,source,kind:'same_pa_physical_field_step_v1'};prefix.push(previous);
    }
  }
  const at={originTick:0,elapsedSeconds:previous.field.motion.world.moment.elapsedSeconds,tick:previous.evaluationTick};
  const action={sourceId:'catch-action',sourceVersion:'test',capability:'same_pa_explicit_catch_action_v1' as const,
    assignmentReference:{sourceId:'assignment',sourceVersion:'test',sourceHash:hash('assignment')},officialId:'umpire',personId:'umpire-person',
    viewReference:ref('pa_lifecycle_v1_execution_views','call-view'),judgment:'caught' as const,calledAt:at};
  const match:any={playId:1,ruleProfileId:'npb-2026',outs:0,bases:{first:null,second:null,third:null}};
  const operative=deriveSamePaCatchOperativeRuling({action,originalMatch:match,batterRunnerId:'batter',basisTick:at.tick,basisEvidenceRevision:1,
    fairCatch:{kind:'pending',reason:'actual_fair_catch_required'}});
  const emitted={sourceId:'umpire',targetScope:{kind:'nearby' as const},kind:'callout' as const,issuedAt:at.tick,
    content:{actionSourceId:action.sourceId,officialId:action.officialId,personId:action.personId,judgment:action.judgment,calledAt:at}};
  const reception=resolveExactCommunicationReception(emitted,at.elapsedSeconds,{originTick:0,ticksPerSecond:1_000_000},
    {propagationDelayTicks:0,recognitionBaseDelayTicks:0,maxAdditionalRecognitionDelayTicks:0,audibility:1,recognition:1,attention:1,minimumRecognizableQuality:0.5},new DeterministicRng(1));
  if(!reception)throw new Error('fixture reception failed');
  const workReference=ref('pa_catch_v1_work','work'),member={playerId:'batter',bindingHash:hash('b'),personHash:hash('p'),baselineSourceId:'baseline',reservedRevision:0,reservedStateHash:hash('s'),projectedStateHash:hash('projected')};
  const basis:any={actor:{binding:{playerId:'batter',personId:'person'}},members:[member],view:{source:{prefixReference:ref('pa_lifecycle_v1_work_prefixes','prefix')},cut:{physicalPitchReference:pitch}}};
  mocks.physical=previous;mocks.plan=plan;mocks.exit=exit;
  mocks.journal={kind:'same_pa_lifecycle_prefix',source:{eventReferences:[workReference,...(initial?[]:[planReference])]}};
  mocks.work={lineage:h.root.lineage,physicalPitchReference:pitch,physicalOperationReference:reference(initial?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',previous),
    originalInputs:{action},operative,communication:{clock:{originTick:0,ticksPerSecond:1_000_000},evaluatedThrough:at,emitted,
      recipients:[{kind:'received',playerId:'batter',reception,receiverPosition:{x:0,y:1,z:0}}]}};
  const request:any={kind:'batter_catch_response_v1',member,catchWorkReference:workReference,
    motionBasis:initial?{kind:'swing_exit',exitStateReference:reference('world_batter_swing_exit_states',exit),route:{segments:[{kind:'line',start:{x:0,z:0},end:{x:30,z:0}}]}}:{kind:'runner_plan',planReference},
    intent:{kind:'hold',issuedTick:at.tick},endTick:at.tick+1_000_000,provenance:{sourceRecordId:'original-hold-choice',sourceVersion:'test'}};
  const source:any={sourceId:'response',sourceVersion:'test',throughTick:at.tick,action:request};
  const respond=()=>deriveSamePaBatterCatchResponse({} as any,source,h.root,previous,basis,prefix);
  const admit=()=>{const value=respond(),field={...previous,source,kind:'same_pa_physical_field_step_v1',actionResult:value};prefix.push(field);return field;};
  const move=(throughTick:number)=>{
    const response=prefix.find(f=>f.actionResult?.kind==='batter_catch_response_v1'),s:any={sourceId:'hold-piece-'+prefix.length,sourceVersion:'test',throughTick,
      action:{kind:'batter_catch_motion_v1',responseReference:reference('pa_physical_v1_field_steps',response)}};
    const prior=prefix.at(-1),result=deriveSamePaBatterCatchMotion(s,h.root,prior,prefix),field={...prior,...result,source:s};prefix.push(field);return field;
  };
  return{...h,plan,exit,previous,prefix,source,request,basis,respond,admit,move};
};
it('BCR01 preserves actual motion through accepted reaction delay, then executes hold braking and tracks both future deadlines',()=>{
  const h=fixture(),before=JSON.stringify(h.previous.field),response=h.admit();
  expect(JSON.stringify(response.field)).toBe(before);expect(response.actionResult.reception.kind).toBe('received');
  expect(deriveSamePaBatterCatchCensus(h.prefix).pending[0].work).toEqual([{kind:'adoption',dueTick:1_000_000,due:'due'}]);
  const first=h.move(1_050_000),body=first.field.motion.actors.find((a:any)=>a.playerId==='batter'&&a.primitive.role==='body');
  expect(samplePiecewiseFieldActor(body,first.field.motion.world.moment).velocity.x).toBeCloseTo(1.9);
  const census=deriveSamePaBatterCatchCensus(h.prefix);expect(census.pending).toEqual([]);expect(census.adopted).toHaveLength(1);
  expect(census.adopted[0].work).toEqual([{kind:'reaction',dueTick:1_100_000,due:'future'},{kind:'controller_end',dueTick:2_000_000,due:'future'}]);
  h.move(1_100_000);const braking=h.move(1_200_000),b=braking.field.motion.actors.find((a:any)=>a.playerId==='batter'&&a.primitive.role==='body');
  expect(b.primitive.acceleration.x).toBe(-3);expect(samplePiecewiseFieldActor(b,braking.field.motion.world.moment).velocity.x).toBeCloseTo(1.7);
  expect(deriveSamePaBatterCatchCensus(h.prefix).adopted[0].work).toEqual([{kind:'controller_end',dueTick:2_000_000,due:'future'}]);
});
it('BCR02 accepts a separate original hold at an owned stationary swing exit without fabricating an advance plan',()=>{
  const h=fixture(true);h.admit();const next=h.move(50_000);
  expect(next.field.motion.actors.filter((a:any)=>a.playerId==='batter').every((a:any)=>Object.values(a.primitive.startVelocity).every(v=>v===0))).toBe(true);
  expect(deriveSamePaBatterCatchCensus(h.prefix).adopted).toHaveLength(1);
});
it.each(['future','dropped','not-caught','unadmitted','body','unexecuted','duplicate'] as const)('BCR03 rejects %s as a received motor cause',fault=>{
  const h=fixture();
  if(fault==='future')mocks.work.communication.recipients[0].kind='scheduled';
  if(fault==='dropped')mocks.work.communication.recipients[0]={kind:'dropped',playerId:'batter',reason:'not_recognizable'};
  if(fault==='not-caught')mocks.work.operative={kind:'active',runnerId:'batter',causeActionSourceId:'catch-action',onFieldCall:null,ledger:null};
  if(fault==='unadmitted')mocks.journal.source.eventReferences=[];
  if(fault==='body'){h.previous.field=structuredClone(h.previous.field);h.previous.field.motion.actors.find((a:any)=>a.playerId==='batter'&&a.primitive.role==='body').primitive.startVelocity.x+=1;}
  if(fault==='unexecuted')h.prefix.splice(1);
  if(fault==='duplicate')h.admit();
  expect(h.respond).toThrow();
});
it.each([{intent:{kind:'advance',issuedTick:1_000_000}},{consumed:true},{bodyForwardUnit:{x:1,z:0}},{endTick:1_000_000}])('BCR04 rejects injected or unsupported original response fields',alteration=>{
  const h=fixture();expect(()=>samePaBatterCatchResponseInput({...h.request,...alteration})).toThrow();
});
it('BCR05 rejects a motor that skipped its initial physical cut and keeps an unadopted response pending',()=>{
  const h=fixture();h.admit();const prior=h.prefix.at(-1);prior.evaluationTick+=1;
  expect(()=>h.move(1_050_000)).toThrow(/unexecuted/);
});
it('BCR06 ignores an earlier pitch plan while preserving a current incumbent controller',()=>{
  const h=fixture(true);mocks.journal.source.eventReferences.push(reference('world_batter_run_plans',h.plan));
  expect(h.respond).toThrow(/incumbent/);
  mocks.plan={...h.plan,physicalPitchReference:ref('pa_physical_v1_launches','earlier-pitch')};
  expect(h.respond().motionBasis.kind).toBe('swing_exit');
});
it('BCR07 fences unrelated first progress and the superseded original advance, retaining transfer ownership',()=>{
  const h=fixture();h.admit();
  expect(()=>assertSamePaBatterCatchOwnership({...h.source,throughTick:1_000_001,action:undefined},h.prefix)).toThrow(/first physical/);
  expect(()=>assertSamePaBatterCatchOwnership({...h.source,action:{kind:'retained_quantizer_checkpoint_v1'}},h.prefix)).toThrow(/first physical/);
  h.move(1_050_000);
  expect(()=>assertSamePaBatterCatchOwnership({...h.source,throughTick:1_050_001,action:undefined},h.prefix)).not.toThrow();
  expect(()=>assertSamePaBatterCatchOwnership({...h.source,action:{kind:'batter_run_motion_v1',planReference:reference('world_batter_run_plans',h.plan)}},h.prefix)).toThrow(/supersedes/);
  const transfer={...h.previous,actionResult:{kind:'throw_plan_v1',plan:{}}};
  expect(()=>assertSamePaPhysicalThrowOwnership(h.source,[h.root,transfer])).toThrow(/pending transfer/);
});
it('BCR08 archives the actual adopted hold primitives and their future horizons for terminal retirement',()=>{
  const h=fixture();h.admit();const moved=h.move(1_050_000),motionReference=reference('pa_physical_v1_field_steps',moved);
  mocks.journal.source.eventReferences=h.prefix.map(f=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f));
  for(const field of h.prefix)mocks.records.set(field.source.sourceId,field);
  h.basis.actor.defenderBindings=[{playerId:'fielder',personId:'fielder-person'}];
  const evidence=samePaOutcomeFieldEvidence({} as any,h.basis),retirement=samePaOutcomeRetirement(h.basis,evidence.commands,moved.evaluationTick);
  const owned=retirement.participants.find(p=>p.playerId==='batter')!.ownedCommands.filter(c=>c.sourceReference.sourceId===motionReference.sourceId);
  expect(owned).toHaveLength(5);
  for(const command of owned){
    const primitive=moved.field.motion.actors.find((a:any)=>a.playerId==='batter'&&a.primitive.role===command.role)!.primitive;
    expect(command.originalCommand).toEqual(primitive);expect(command.validThroughTick).toBe(primitive.endTick);
    expect(command.validThroughTick).toBeGreaterThan(moved.evaluationTick);
  }
});
it('BCR09 rejects a sub-tick first braking piece before owning a response that this physical adapter cannot adopt',()=>{
  const h=fixture(false,1,0);expect(h.respond).toThrow(/whole-tick adoption/);
});
