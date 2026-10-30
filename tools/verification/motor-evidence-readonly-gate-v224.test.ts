import { expect, it } from 'vitest';
import { inspectNativeMotorEvidenceV224, matchOriginalMotorEvidenceV224 } from './motor-evidence-readonly-gate-v224';
it('V224-I00 imports the separate readonly gate without opening a database',()=>{
 expect(inspectNativeMotorEvidenceV224).toBeTypeOf('function');expect(matchOriginalMotorEvidenceV224).toBeTypeOf('function');
});
it('V224-P01 refuses a missing set of original evidence without substituting a fabricated target',()=>{
 const retained={qualifications:[{contacts:[{eventId:'original'}]}]} as unknown as Parameters<typeof matchOriginalMotorEvidenceV224>[0];
 expect(()=>matchOriginalMotorEvidenceV224(retained,[])).toThrow();
});

it('V224-P02 binds all six original contacts to their exact qualification, person and proof',()=>{
 const q=(technique:string,offset:number)=>({source:{technique,careerId:'career',playerId:'batter',personLinkSourceId:'person-link',acceptedAtDay:20,repertoireRef:{sourceId:'rep',sourceVersion:'1'}},
  person:{personId:'person'},contacts:Array.from({length:3},(_,i)=>({eventId:'e'+(offset+i),proofHash:'h'+(offset+i),sourceRef:{sourceId:'s'+(offset+i),sourceVersion:'1'},profileRef:{profileId:'course',version:'1'}}))});
 const qualifications=[q('BACKSPIN',0),q('TOPSPIN',3)],contacts=qualifications.flatMap(q=>q.contacts.map(c=>({event:{sourceEventId:c.eventId},contact:{tick:1}})));
 const retained={qualifications,contacts} as unknown as Parameters<typeof matchOriginalMotorEvidenceV224>[0];
 const evidence=qualifications.flatMap(q=>q.contacts.map(c=>({sourceEventId:c.eventId,acceptedEvidenceHash:c.proofHash,
  source:{sourceId:c.sourceRef.sourceId,sourceVersion:'1',careerId:'career',playerId:'batter',personLinkSourceId:'person-link',atDay:10,
   command:{kind:'BATTING_CONTACT',profileId:'course',profileVersion:'1',spinIntentV123:{technique:q.source.technique}}},
  model:{source:{personId:'person',repertoireRef:q.source.repertoireRef}},contact:{tick:1}}))) as unknown as Parameters<typeof matchOriginalMotorEvidenceV224>[1];
 expect(matchOriginalMotorEvidenceV224(retained,evidence)).toMatchObject({matched:true,retainedOriginalContacts:6,relativeTransferProven:false});
 for(const change of [
  (x:any)=>{x[0].acceptedEvidenceHash='bad'},(x:any)=>{x[0].source.command.profileId='foreign'},
  (x:any)=>{x[0].source.command.kind='DRY_SWING'},(x:any)=>{x[0].source.playerId='foreign'},
  (x:any)=>{x[0].sourceEventId=x[1].sourceEventId},(x:any)=>{x[0].model.source.personId='foreign'}]){
  const bad=structuredClone(evidence);change(bad);expect(()=>matchOriginalMotorEvidenceV224(retained,bad)).toThrow();
 }
});
