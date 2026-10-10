import { expect } from 'vitest';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaOfficialSourceReference as originalRef, type AcceptedSamePaOfficialPerson, type AcceptedSamePaCatchAssignment,
  type AcceptedSamePaCatchAction, type AcceptedSamePaCatchCommunication } from './SamePlateAppearanceCatchCommunicationSource';
import type { AcceptedActualCommunicationModel } from './ActualCallCommunication';
import type { AcceptedSamePaCatchWork } from './SamePlateAppearanceCatchWork';
import { openSqliteSamePlateAppearanceCatchWorkStore } from './SamePlateAppearanceCatchWorkFromSqlite';

/** This bounded fixture declares the existing dropped-reception conditions from
 * SamePlateAppearanceCatchCommunication.test.ts. Every original participant gets
 * a real dropped receipt; none is omitted or marked complete by the caller.
 * Root stationary commands still prove each actor's own physical obligations. */
export const appendNativeLiveAppealCatch = (h: ReturnType<typeof samePaPhysicalLifecycleFixture>, secured: SamePaPhysicalFieldStep, label: string) => {
  const b=h.current(),moment=secured.field.motion.world.moment;
  const at={originTick:moment.originTick,elapsedSeconds:moment.elapsedSeconds,tick:moment.ball.tick};
  const person:AcceptedSamePaOfficialPerson=h.save({sourceId:label+':person',sourceVersion:'fixture-v1',capability:'accepted_original_umpire_person_v1',
    careerId:b.view.lineage.careerId,officialId:label+':umpire',personId:label+':umpire-person'});
  const assignment:AcceptedSamePaCatchAssignment=h.save({sourceId:label+':assignment',sourceVersion:'fixture-v1',capability:'same_pa_explicit_catch_assignment_v1',
    enrollmentReference:b.view.lineage.enrollmentReference,gameId:b.view.lineage.gameId,playId:b.view.lineage.playId,
    physicalPitchSourceId:b.view.cut.physicalPitchReference.sourceId,officialId:person.officialId,personId:person.personId,personReference:originalRef(person),
    policy:{sourceId:label+':action-policy',sourceVersion:'fixture-v1',ruleProfileId:h.f.actor.match.ruleProfileId,kind:'accepted_original_official_action_v1'},
    pose:{position:{x:0,y:1.7,z:0},validFromElapsedSeconds:at.elapsedSeconds,validThroughElapsedSeconds:at.elapsedSeconds}});
  const action:AcceptedSamePaCatchAction=h.save({sourceId:label+':action',sourceVersion:'fixture-v1',capability:'same_pa_explicit_catch_action_v1',
    assignmentReference:originalRef(assignment),officialId:person.officialId,personId:person.personId,viewReference:b.viewReference,judgment:'caught',calledAt:at});
  const model:AcceptedActualCommunicationModel=h.save({sourceId:label+':reception-model',sourceVersion:'fixture-v1',gameId:b.view.lineage.gameId,
    physicalPitchSourceId:b.view.cut.physicalPitchReference.sourceId,parameters:{version:'fixed_receiver_conditions_v1',timing:'exact_sent_plus_core_delay_ticks_v1',
      receivers:b.view.lineage.participantReferences.map(p=>({playerId:p.playerId,conditions:{propagationDelayTicks:0,recognitionBaseDelayTicks:0,
        maxAdditionalRecognitionDelayTicks:0,audibility:0,recognition:1,attention:1,minimumRecognizableQuality:.5}}))}});
  const communication:AcceptedSamePaCatchCommunication=h.save({sourceId:label+':communication',sourceVersion:'fixture-v1',capability:'same_pa_explicit_catch_communication_v1',
    viewReference:b.viewReference,actionReference:originalRef(action),modelReference:originalRef(model)});
  const get=(id:string)=>h.accepted.get(id)??null;
  const owner=h.f.x.f.track(openSqliteSamePlateAppearanceCatchWorkStore(h.f.path,{readAcceptedWork:get,readAcceptedCommunication:get,
    readAcceptedAction:get,readAcceptedAssignment:get,readAcceptedOfficialPerson:get,readAcceptedReceptionModel:id=>id===model.sourceId?model:null}));
  const accept=(name:string,priorWorkReference:AcceptedSamePaCatchWork['priorWorkReference'])=>{
    const current=h.current();
    const currentCommunication=h.save({...communication,sourceId:label+':communication:'+name,viewReference:current.viewReference});
    const source:AcceptedSamePaCatchWork=h.save({sourceId:label+':work:'+name,sourceVersion:'fixture-v1',capability:'same_pa_catch_work_v1',
      enrollmentReference:current.view.lineage.enrollmentReference,viewReference:current.viewReference,
      communicationReference:originalRef(currentCommunication),priorWorkReference});
    const work=owner.accept(source.sourceId);if(work.kind!=='same_pa_catch_work_v1')throw new Error('LAN01 original caught call pending');
    expect(work.communication.recipients).toHaveLength(11);expect(work.communication.recipients.every(r=>r.kind==='dropped')).toBe(true);
    expect(work.operative.kind).toBe('retired');expect(work.originalInputs.action).toEqual(action);
    const workReference=reference('pa_catch_v1_work',work);h.advance(workReference);return{work,workReference};
  };
  const original=accept('original',null);
  return{...original,refresh:()=>accept('sealed',original.workReference)};
};
