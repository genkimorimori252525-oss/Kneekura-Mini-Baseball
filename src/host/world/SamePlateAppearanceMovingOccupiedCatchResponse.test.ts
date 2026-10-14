import { expect,it,vi } from 'vitest';
import { samePaBatterRunFixture } from './SamePlateAppearanceBatterRunFixtures.test-support';
import { deriveSamePaOccupiedRunnerMotion,deriveSamePaOccupiedRunnerMotionCensus } from './SamePlateAppearanceOccupiedRunnerMotion';
import { deriveSamePaOccupiedRunnerCatchResponse,deriveSamePaOccupiedRunnerCatchMotion,assertSamePaOccupiedRunnerCatchOwnership } from './SamePlateAppearanceOccupiedRunnerCatchResponse';
import { deriveSamePaOccupiedRunnerCatchCensus } from './SamePlateAppearanceOccupiedRunnerCatchCensus';
import { samePaExactRunnerControllerCensus,assertSamePaExactRunnerControllerOwnership } from './SamePlateAppearanceExactRunnerControllerPiece';
import { deriveSamePaLiveWorkCensus } from './SamePlateAppearanceLiveWorkCensus';
import { deriveSamePaActorProducerWork } from './SamePlateAppearanceActorProducerCompletion';
import { samePaCurrentStoppedHold,SAME_PA_ACTOR_PRODUCER_POLICY } from './SamePlateAppearanceActorProducerPolicy';
import { samePaPhysicalFieldActionInput } from './SamePlateAppearancePhysicalFieldAction';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { resolveExactCommunicationReception } from '../../core/sim/perception/ExactCommunication';
import { DeterministicRng } from '../../core/rng/DeterministicRng';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const mocks=vi.hoisted(()=>({work:null as any,journal:null as any,hold:null as any}));
vi.mock('./SamePlateAppearanceCatchWorkFromSqlite',()=>({readSamePaCatchWorkFromSqlite:()=>mocks.work}));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite',()=>({readSamePaLifecycleRecordFromSqlite:()=>mocks.journal}));
vi.mock('./SqliteSamePlateAppearanceOccupiedRunnerHoldStore',()=>({readSamePaOccupiedRunnerHoldFromSqlite:()=>mocks.hold}));
const ref=(owner:string,sourceId=owner)=>({owner,sourceId,sourceHash:hash(sourceId),snapshotHash:hash(sourceId)});
const pin=(f:any)=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
/** Structural Native inputs, real existing controller/field/reception physics.
 * The call is already owned before movement; this is not full SQLite qualification. */
const fixture=(parameters:Record<string,number>={})=>{
  const h=samePaBatterRunFixture(true),root=h.root;root.operationOrdinal=0;root.pitchOrdinal=1;
  root.lineage.enrollmentReference=ref('same_pa_enrollments');root.source.parameters=root.response.world.parameters;
  const playerId='batter',hold:any={source:{sourceId:'hold',sourceVersion:'test',playerId,personId:'person',enrollmentReference:root.lineage.enrollmentReference,
    intent:{kind:'hold',issuedTick:0},coverageThroughTick:5_000_000},setup:{position:{x:0,z:0},velocity:{x:0,z:0}},
    body:{actor:{...h.plan.exitState.body,bodyOriginHeightMeters:1}},model:{source:{motion:{...h.plan.exitState.model.runnerModel.source.motion,reactionDelayTicks:100_000,...parameters}}}};
  mocks.hold=hold;const holdReference=reference('world_same_pa_occupied_runner_holds',hold),workReference=ref('pa_catch_v1_work');
  mocks.journal={kind:'same_pa_lifecycle_prefix',source:{eventReferences:[workReference]}};
  const member={playerId,bindingHash:hash('b'),personHash:hash('p'),baselineSourceId:'base',reservedRevision:0,reservedStateHash:hash('s'),projectedStateHash:hash('ps')};
  const basis:any={members:[member],actor:{binding:{playerId:'hitter'},world:{runners:[{playerId,position:hold.setup.position}]}},
    view:{source:{prefixReference:ref('pa_lifecycle_v1_work_prefixes')},cut:{physicalPitchReference:ref('pa_physical_v1_launches','pitch')}}};
  const prefix:any[]=[root];let ordinal=0;
  const source=(throughTick:number,action:any)=>({sourceId:'step-'+ordinal++,sourceVersion:'test',throughTick,action,
    viewReference:ref('pa_lifecycle_v1_execution_views'),previousOperationReference:pin(prefix.at(-1)),previousFieldReference:pin(prefix.at(-1)),fieldRootReference:pin(root)});
  const append=(s:any,value:any)=>{const step={...prefix.at(-1),...value,kind:'same_pa_physical_field_step_v1',operationOrdinal:prefix.length,source:s};prefix.push(step);return step;};
  const advanceSource=(throughTick:number)=>{const latest=[...prefix].reverse().find(f=>f.actionResult?.kind==='occupied_runner_motion_v1');return source(throughTick,
    {kind:'occupied_runner_motion_v1',member,holdReference,predecessorMotionReference:latest?pin(latest):null,route:h.plan.plan.timeline.route,
      intent:{kind:'advance',issuedTick:0},endTick:3_000_000,provenance:{sourceRecordId:'advance',sourceVersion:'test'}});};
  const advance=(throughTick:number)=>{const s=advanceSource(throughTick);return append(s,deriveSamePaOccupiedRunnerMotion(s as never,root,prefix.at(-1),hold,basis,prefix));};
  const receiveSource=()=>{
    const previous=prefix.at(-1),m=previous.field.motion.world.moment,at={originTick:m.originTick,elapsedSeconds:m.elapsedSeconds,tick:m.ball.tick};
    const emitted={sourceId:'umpire',targetScope:{kind:'nearby' as const},kind:'callout' as const,issuedAt:0,
      content:{actionSourceId:'call',officialId:'umpire',personId:'official-person',judgment:'caught' as const,calledAt:{originTick:0,elapsedSeconds:0,tick:0}}};
    const reception=resolveExactCommunicationReception(emitted,0,{originTick:0,ticksPerSecond:1_000_000},
      {propagationDelayTicks:0,recognitionBaseDelayTicks:0,maxAdditionalRecognitionDelayTicks:0,audibility:1,recognition:1,attention:1,minimumRecognizableQuality:0.5},new DeterministicRng(1));
    basis.view.cut.physicalOperationReference=pin(previous);
    mocks.work={lineage:root.lineage,physicalPitchReference:basis.view.cut.physicalPitchReference,physicalOperationReference:pin(previous),originalInputs:{action:{sourceId:'call'}},
      operative:{kind:'retired',runnerId:'hitter',causeActionSourceId:'call',at:{originTick:0,elapsedSeconds:0,tick:0},onFieldCall:{tick:0,ruling:{kind:'out',runnerId:'hitter',outsAfter:1,basesAfter:{first:playerId,second:null,third:null},scoredRunnerIds:[]}}},
      communication:{clock:{originTick:0,ticksPerSecond:1_000_000},evaluatedThrough:at,emitted,recipients:[{kind:'received',playerId,reception,receiverPosition:{x:0,y:1,z:0}}]}};
    return source(previous.evaluationTick,{kind:'occupied_runner_catch_response_v1',member,holdReference,catchWorkReference:workReference,
      motionBasis:{kind:'occupied_runner_motion_v1',motionReference:pin([...prefix].reverse().find(f=>f.actionResult?.kind==='occupied_runner_motion_v1'))},
      intent:{kind:'hold',issuedTick:previous.evaluationTick},endTick:3_000_000,provenance:{sourceRecordId:'hold-response',sourceVersion:'test'},actorProducerPolicy:SAME_PA_ACTOR_PRODUCER_POLICY});
  };
  const respond=(s=receiveSource())=>append(s,{actionResult:deriveSamePaOccupiedRunnerCatchResponse({} as never,s as never,root,prefix.at(-1),basis,prefix)});
  const catchSource=(throughTick:number)=>source(throughTick,{kind:'occupied_runner_catch_motion_v1',responseReference:pin(prefix.find(f=>f.actionResult?.kind==='occupied_runner_catch_response_v1'))});
  const move=(throughTick:number)=>{const s=catchSource(throughTick);assertSamePaExactRunnerControllerOwnership(s as never,prefix);
    assertSamePaOccupiedRunnerCatchOwnership(s as never,prefix);return append(s,deriveSamePaOccupiedRunnerCatchMotion(s as never,root,prefix.at(-1),prefix));};
  const census=()=>deriveSamePaLiveWorkCensus({fields:prefix,participantIds:['batter','fielder'],observationPolicies:[],
    possessionEvidence:{policy:'scheduled_capture_confirmation_v1',originTick:0,ticksPerSecond:1_000_000,throughElapsedSeconds:prefix.at(-1).field.motion.world.moment.elapsedSeconds,pending:[]}});
  const work=()=>deriveSamePaActorProducerWork({fields:prefix,census:census(),calls:[],playOpen:true})!;
  const body=()=>samplePiecewiseFieldActor(prefix.at(-1).field.motion.actors.find((a:any)=>a.playerId===playerId&&a.primitive.role==='body'),prefix.at(-1).field.motion.world.moment);
  return{root,hold,basis,prefix,advance,advanceSource,receiveSource,respond,move,catchSource,census,work,body};
};
it('MOC01 retains the actual advance, then executes calibrated reaction and braking before stationary completion',()=>{
  const h=fixture();h.advance(100_000);const incumbent=h.advance(1_000_000),before=h.body(),response=h.respond();
  expect(response.actionResult.controller.route).toEqual(incumbent.actionResult.controller.route);
  expect(h.body()).toEqual(before);expect(h.work().actors[0].controllerRenewal.complete).toBe(false);
  expect(deriveSamePaOccupiedRunnerMotionCensus(h.prefix)[0]).not.toHaveProperty('supersededBy');
  expect(()=>h.advance(1_050_000)).toThrow(/actual first motor/);
  h.move(1_100_000);expect(h.body().velocity.x).toBeCloseTo(2,12);
  expect(deriveSamePaOccupiedRunnerMotionCensus(h.prefix)[0]).toMatchObject({supersededBy:{responseReference:pin(response)},work:[]});
  expect(samePaCurrentStoppedHold(h.prefix,'batter')).toBeNull();
  const stopped=h.move(1_766_667),priorHistory=JSON.stringify(h.prefix);expect(stopped.field.motion.world.moment.elapsedSeconds).toBeCloseTo(1.1+2/3,14);
  expect(samePaExactRunnerControllerCensus(h.prefix)[0].due).toBe('due');
  const stopCenter=h.body().center,held=h.move(1_766_667);expect(h.body().velocity.x).toBe(0);
  expect(h.body().center).toEqual(stopCenter);expect(JSON.stringify(h.prefix.slice(0,-1))).toBe(priorHistory);
  expect(samePaCurrentStoppedHold(h.prefix,'batter')).toMatchObject({basis:'executed_stopped_hold',commandReference:pin(response)});
  expect(h.work().actors[0].controllerRenewal.complete).toBe(true);
  expect(h.work().actors[0].consumedControllerReferences).toContainEqual(pin(held));
  expect(h.work().actors[0].consumedControllerReferences).toContainEqual(pin(incumbent));
  expect(()=>h.advance(1_800_000)).toThrow(/supersedes/);
});
it.each([0,100_000])('MOC02 a fractional adoption preserves absolute issuance/reaction with delay %s',delay=>{
  const h=fixture({reactionDelayTicks:delay,topSpeedMps:0.000001});
  if(delay)h.advance(delay);const incumbent=h.advance(delay+1),at=incumbent.field.motion.world.moment;
  expect(at.elapsedSeconds).toBeCloseTo(delay/1_000_000+0.0000005,14);
  const response=h.respond(),r=response.actionResult;
  expect(r.exactTrajectory.origin.elapsedSeconds).toBe(at.elapsedSeconds);
  expect(r.exactTrajectory.segments[0].endElapsedSeconds).toBeCloseTo((r.reactionTick-at.originTick)/1_000_000-at.elapsedSeconds,14);
  const moved=h.move(delay+1);expect(moved.field.motion.world.moment.elapsedSeconds).toBe((delay+1)/1_000_000);
  expect(h.body().velocity.x).toBeCloseTo(0.000001,17);
  expect(samePaCurrentStoppedHold(h.prefix,'batter')).toBeNull();
});
it('MOC03 zero-time replacement transfers the old command while retaining unconsumed caught work',()=>{
  const h=fixture();h.advance(100_000);h.advance(1_000_000);const response=h.respond(),before=h.body();h.move(1_000_000);
  expect(h.body()).toEqual(before);expect(deriveSamePaOccupiedRunnerMotionCensus(h.prefix)[0]).toHaveProperty('supersededBy');
  expect(deriveSamePaOccupiedRunnerCatchCensus(h.prefix).pending[0].responseReference).toEqual(pin(response));
  expect(h.work().actors[0].controllerRenewal.complete).toBe(false);
  expect(()=>assertSamePaOccupiedRunnerCatchOwnership(h.catchSource(1_000_001) as never,h.prefix)).not.toThrow();
});
it.each(['stale','foreign_player','body','finite_end','new_route','missing_basis'] as const)('MOC04 rejects %s as moving controller authority',fault=>{
  const h=fixture();const first=h.advance(100_000);h.advance(1_000_000);const s=h.receiveSource();
  if(fault==='stale')s.action.motionBasis.motionReference=pin(first);
  if(fault==='foreign_player')h.basis.actor.world.runners=[];
  if(fault==='body'){const previous=h.prefix.at(-1);previous.field=structuredClone(previous.field);previous.field.motion.actors[0].primitive.startCenter.x+=1;}
  if(fault==='finite_end')s.action.endTick=5_000_001;
  if(fault==='new_route')s.action.motionBasis.route={segments:[]};
  if(fault==='missing_basis')delete s.action.motionBasis;
  expect(()=>h.respond(s)).toThrow();
});
it('MOC05 accepted moving basis has no route/model override or completion flag',()=>{
  const h=fixture();h.advance(100_000);const s=h.receiveSource();expect(()=>samePaPhysicalFieldActionInput(s.action)).not.toThrow();
  expect(()=>samePaPhysicalFieldActionInput({...s.action,completed:true})).toThrow();
});

it('MOC06 an explicit replacement may renew within original body authority while preserving the incumbent route',()=>{
  const h=fixture();h.advance(100_000);const incumbent=h.advance(1_000_000),s=h.receiveSource();s.action.endTick=4_000_000;
  const response=h.respond(s);expect(response.actionResult.endTick).toBe(4_000_000);
  expect(response.actionResult.controller.route).toEqual(incumbent.actionResult.controller.route);
  expect(deriveSamePaOccupiedRunnerMotionCensus(h.prefix)[0].work).toContainEqual({kind:'controller_end',dueTick:3_000_000,due:'future'});
  h.move(1_100_000);expect(deriveSamePaOccupiedRunnerCatchCensus(h.prefix).adopted[0].work).toContainEqual({kind:'controller_end',dueTick:4_000_000,due:'future'});
});
