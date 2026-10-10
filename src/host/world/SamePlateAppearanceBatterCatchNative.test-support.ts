import { expect } from 'vitest';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { appendNativeCatchWork } from './SamePlateAppearanceCatchWorkNative.test-support';
import type { appendNativeBatterRunCheckpoint } from './SamePlateAppearanceBatterRunNative.test-support';
import { openSqliteSamePlateAppearanceCatchWorkStore } from './SamePlateAppearanceCatchWorkFromSqlite';
import { samePaOfficialSourceReference as externalReference } from './SamePlateAppearanceCatchCommunicationSource';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { readSamePaAdmittedLiveWorkFromSqlite } from './SamePlateAppearanceAdmittedLiveWorkFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
/** Same original IFN graph. The original reception model already includes the
 * batter; this Source explicitly chooses hold and the field owner executes it. */
export const appendNativeBatterCatchHold = (h: ReturnType<typeof samePaPhysicalLifecycleFixture>, run: ReturnType<typeof appendNativeBatterRunCheckpoint>,
  caught: ReturnType<typeof appendNativeCatchWork>, label: string) => {
  const previous=run.moved,cut=h.current(),model=caught.work.originalInputs.model;
  if(!model)throw new Error('IFN01 batter hold original reception model missing');
  const communication=h.save({...caught.work.originalInputs.source,sourceId:label+':communication',viewReference:cut.viewReference});
  const source=h.save({sourceId:label+':work',sourceVersion:'fixture-v1',capability:'same_pa_catch_work_v1' as const,
    enrollmentReference:cut.view.lineage.enrollmentReference,viewReference:cut.viewReference,communicationReference:externalReference(communication),priorWorkReference:caught.workReference});
  const get=(id:string)=>h.accepted.get(id)??null;
  const owner=h.f.x.f.track(openSqliteSamePlateAppearanceCatchWorkStore(h.f.path,{readAcceptedWork:get,readAcceptedCommunication:get,
    readAcceptedAction:get,readAcceptedAssignment:get,readAcceptedOfficialPerson:get,readAcceptedReceptionModel:id=>id===model.sourceId?model:null}));
  const work=owner.accept(source.sourceId);if(work.kind!=='same_pa_catch_work_v1')throw new Error('IFN01 batter hold current reception is pending');
  expect(work.communication.recipients.find(r=>r.playerId===h.f.actor.binding.playerId)?.kind).toBe('received');
  const workReference=reference('pa_catch_v1_work',work);h.advance(workReference);
  const responseSource:SamePaPhysicalFieldStepSource=h.save({...previous.source,sourceId:label+':response',viewReference:h.current().viewReference,
    previousOperationReference:reference('pa_physical_v1_field_steps',previous),previousFieldReference:reference('pa_physical_v1_field_steps',previous),
    throughTick:previous.evaluationTick,action:{kind:'batter_catch_response_v1',member:h.current().basis.members.find(m=>m.playerId===h.f.actor.binding.playerId)!,
      catchWorkReference:workReference,motionBasis:{kind:'runner_plan',planReference:reference('world_batter_run_plans',run.plan)},
      intent:{kind:'hold',issuedTick:previous.evaluationTick},endTick:previous.evaluationTick+100,
      provenance:{sourceRecordId:label+':original-hold-choice',sourceVersion:'explicit-fixture-v1'}}});
  const response=h.physical.acceptOperation(responseSource.sourceId);
  if(response.kind!=='same_pa_physical_field_step_v1'||response.actionResult?.kind!=='batter_catch_response_v1')throw new Error('IFN01 original received batter response missing');
  expect(response.field).toEqual(previous.field);const responseReference=reference('pa_physical_v1_field_steps',response);h.advance(responseReference);
  const motionSource:SamePaPhysicalFieldStepSource=h.save({...responseSource,sourceId:label+':motion',viewReference:h.current().viewReference,
    previousOperationReference:responseReference,previousFieldReference:responseReference,throughTick:response.evaluationTick+1,
    action:{kind:'batter_catch_motion_v1',responseReference}});
  const moved=h.physical.acceptOperation(motionSource.sourceId);
  if(moved.kind!=='same_pa_physical_field_step_v1'||moved.actionResult?.kind!=='batter_catch_motion_v1')throw new Error('IFN01 real received batter motor missing');
  expect(moved.evaluationTick).toBe(motionSource.throughTick);h.advance(reference('pa_physical_v1_field_steps',moved));
  const body=(step:typeof moved)=>{const actor=step.field.motion.actors.find(a=>a.playerId===h.f.actor.binding.playerId&&a.primitive.role==='body')!;
    return samplePiecewiseFieldActor(actor,step.field.motion.world.moment);};
  const before=body(previous),after=body(moved);
  expect(Math.hypot(after.velocity.x,after.velocity.z)).toBeLessThan(Math.hypot(before.velocity.x,before.velocity.z));
  expect(Math.hypot(after.velocity.x,after.velocity.z)).toBeGreaterThan(0);
  const live=withSqliteReadTransaction(h.f.db,()=>readSamePaAdmittedLiveWorkFromSqlite(h.f.db,h.current().viewReference,'current'));
  if(live.kind!=='same_pa_live_work_read_v1')throw new Error('IFN01 received batter census missing');
  expect(live.census.batterCatchResponses.pending).toEqual([]);expect(live.census.batterCatchResponses.adopted).toHaveLength(1);
  expect(live.census.runnerPlans[0].status).toBe('superseded_by_received_response');
  expect(live.census.runnerPlans[0].supersededBy?.responseReference).toEqual(responseReference);
  expect(h.physical.readOperation(reference('pa_physical_v1_field_steps',moved)).record).toEqual(moved);
  return{moved,response,caught:{...caught,work,workReference}};
};
