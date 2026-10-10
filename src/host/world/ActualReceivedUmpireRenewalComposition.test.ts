import { existsSync } from 'node:fs';
import { expect,it } from 'vitest';
import { receivedRenewalMotorFixture } from './ActualReceivedUmpireRenewalMotorFixtures.test-support';
import { deriveReceivedRenewalMotorReceipt } from './ActualReceivedUmpireRenewalMotor';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { ActualPlayerKinematics } from './ActualPlayerKinematicsFromPrefix';
import type { DurableReceivedRenewalEnrollment } from './ActualReceivedUmpireRenewalEvidence';
import type { DurableReceivedRenewalMotor } from './SqliteActualReceivedUmpireRenewalMotorStore';
import type { RenewalAdoptionExecutionSource } from './ActualReceivedUmpireRenewal';
const fixture=()=>{
  const f=receivedRenewalMotorFixture(),receiver=f.self;
  const selves:ActualPlayerKinematics[]=[receiver,...Array.from({length:9},(_,i)=>{
    const s=structuredClone(receiver),id='retained-'+i;
    return {...s,playerId:id,personId:'person-'+id,personLinkSourceId:'link-'+id,
      roles:s.roles.map(p=>({...p,canonicalActor:{...p.canonicalActor,playerId:id}}))};
  })];
  const ref=(sourceId:string)=>({sourceId,sourceHash:hash(sourceId),snapshotHash:hash(['snapshot',sourceId])});
  const source={sourceId:'renewal-enrollment',sourceVersion:'pure-fixture-v1',capability:'received_umpire_renewal_enrollment_v1' as const,receivedEnrollmentSourceId:'received-e',receivedReplanSourceId:'received-r2'};
  const enrollment:DurableReceivedRenewalEnrollment={source,gameId:'game',playId:1,physicalPitchSourceId:receiver.physicalPitchSourceId,playerId:receiver.playerId,runtimeSourceId:'runtime',receivedEnrollmentSourceId:'received-e',receivedReplanSourceId:'received-r2',originProcessSourceId:'received-r1',
    receiver:{careerId:'career',playerId:receiver.playerId,personId:receiver.personId,personLinkSourceId:receiver.personLinkSourceId,fieldingModelSourceId:'fielding-model',gameDay:10},
    cause:{physicalPitchSourceId:receiver.physicalPitchSourceId,playerId:receiver.playerId,callSourceId:'call',originCommunicationSourceId:'send'},cut:f.decision.cut,
    selection:{selected:f.decision.selected,target:f.decision.target,selectedAt:receiver.at,movementStartTick:150,dueTick:150},
    anchor:{receivedEnrollment:ref('received-e'),receivedReplan:ref('received-r2'),legacyAdmissionPrefix:{count:24,digest:'legacy'},receivedJournal:{count:4,digest:'received'},baseField:ref('field'),physicalPredecessor:{...ref('execution-2'),revision:2},observation:{...ref('observation'),revision:2},decision:{...ref('initial-decision'),revision:1},motor:ref('initial-motor'),adoption:{...ref('execution-2'),revision:2},locomotionModel:{sourceId:f.model.source.sourceId,sourceHash:hash(f.model.source),snapshotHash:hash(f.model)},decisionModel:ref('decision-model'),fieldingModelHash:hash(f.model.fieldingModel),selfHash:hash(receiver),
      participants:selves.map(s=>({playerId:s.playerId,personId:s.personId,selfHash:hash(s),activeCommandHash:hash(s.activeCommand),roleAuthoritiesHash:hash(s.ownedMotionCoverage!.roleAuthorities)}))},
    membership:{version:'received_umpire_renewal_membership_v1',effectiveFrom:f.decision.cut,playerId:receiver.playerId,legacyCoverage:'unchanged',physicalAdvancement:'blocked'},pending:{kind:'renewal_decision',originProcessSourceId:'received-r1'}};
  const motor:DurableReceivedRenewalMotor={source:{sourceId:'renewal-motor',sourceVersion:'pure-fixture-v1',capability:'received_umpire_renewal_motor_v1',renewalEnrollmentSourceId:source.sourceId,renewalDecisionSourceId:f.decision.sourceId},gameId:'game',playId:1,physicalPitchSourceId:receiver.physicalPitchSourceId,playerId:receiver.playerId,renewalEnrollmentSourceId:source.sourceId,enrollmentHash:hash(enrollment),decisionHash:'decision-hash',receipt:deriveReceivedRenewalMotorReceipt(f.decision,f.model,receiver)};
  const adoptionSource:RenewalAdoptionExecutionSource={sourceId:'adoption-3',sourceVersion:'pure-fixture-v1',baseFieldSourceId:'field',previousExecutionSourceId:'execution-2',action:{kind:'received_renewal_adoption_v1',renewalEnrollmentSourceId:source.sourceId,renewalMotorSourceId:motor.source.sourceId}};
  const bindings=selves.map(s=>({playerId:s.playerId,personId:s.personId,personLinkSourceId:s.personLinkSourceId,gameId:s.gameId,gameDay:s.gameDay}));
  return {f,selves,enrollment,motor,source:adoptionSource,bindings,cut:f.decision.cut};
};
const load=async()=>{
  expect(existsSync(new URL('./ActualReceivedUmpireRenewalComposition.ts',import.meta.url)),'RENEWAL_ADOPTION_COMPOSITION_MISSING').toBe(true);
  return import('./ActualReceivedUmpireRenewalComposition');
};
it('RCM01 composes one new root and nine retained roots with all fifty exact role authorities',async()=>{
  const f=fixture(),m=await load(),before=structuredClone(f),c=m.deriveReceivedRenewalComposition(f.source,f.enrollment,f.motor,f.selves,f.bindings,f.cut);
  expect(c.contributors).toHaveLength(10);expect(c.contributors.flatMap(p=>p.roleAuthorities)).toHaveLength(50);expect(c.coverageThroughTick).toBe(160);
  expect(c.contributors[0].rootAuthority).toMatchObject({owner:'actual_received_umpire_renewal_motors',sourceId:f.motor.source.sourceId,adoptionSourceId:f.source.sourceId,acceptedThroughTick:220});
  for(const [i,p] of c.contributors.entries()){
    expect(p.roleAuthorities).toEqual(f.selves[i].ownedMotionCoverage!.roleAuthorities);
    if(i){expect(p.rootAuthority).toEqual(f.selves[i].ownedMotionCoverage!.rootAuthority);expect(p.command.bodyAcceleration).toEqual(f.selves[i].root.acceleration);}
  }
  expect(f).toEqual(before);expect(c.at).toEqual(f.f.self.at);
});
it('RCM02 rejects missing duplicate or foreign participants before command composition',async()=>{
  const f=fixture(),m=await load();
  for(const selves of [f.selves.slice(1),[...f.selves.slice(1),f.selves[1]],f.selves.map((s,i)=>i!==1?s:{...s,personId:'foreign'})])expect(()=>m.deriveReceivedRenewalComposition(f.source,f.enrollment,f.motor,selves,f.bindings,f.cut)).toThrow(/participant|Player|Person|basis/);
});
it('RCM03 refuses to discharge another Players expired role by renewing only this receiver',async()=>{
  const f=fixture(),m=await load(),self=f.selves[1],coverage=self.ownedMotionCoverage!;
  const selves=f.selves.map((s,i)=>i!==1?s:{...s,ownedMotionCoverage:{...coverage,roleAuthorities:coverage.roleAuthorities.map((a,j)=>j?a:{...a,acceptedThroughTick:150})}});
  expect(()=>m.deriveReceivedRenewalComposition(f.source,f.enrollment,f.motor,selves,f.bindings,f.cut)).toThrow(/coverage|basis|participant/);
});
it('RCM04 rejects a motor at another exact self or a quantized-equal elapsed cut',async()=>{
  const f=fixture(),m=await load();
  expect(()=>m.deriveReceivedRenewalComposition(f.source,f.enrollment,f.motor,f.selves,f.bindings,{...f.cut,elapsedSeconds:0.0499999})).toThrow(/cut|integer|tuple/);
  const motor={...f.motor,receipt:{...f.motor.receipt,self:{...f.motor.receipt.self,root:{...f.motor.receipt.self.root,position:{x:1,y:1,z:0}}}}};
  expect(()=>m.deriveReceivedRenewalComposition(f.source,f.enrollment,motor,f.selves,f.bindings,f.cut)).toThrow(/motor|self|basis/);
});
