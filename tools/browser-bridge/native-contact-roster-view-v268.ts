import {parseContactRosterV266} from '../native-contact-roster-json-v266';

/** Presentation data only; caller commits a new view only after this function succeeds. */
export function prepareNativeContactRosterViewV268(text:string) {
 const parsed=parseContactRosterV266(text),b=parsed.payload.batch,links=parsed.payload.subjectLinks;
 return {
  version:'native-contact-roster-view-v268' as const,provenance:parsed.provenance,
  populationBoundary:b.populationBoundary,producerCoverage:b.producerCoverage,asOfSemantics:b.asOfSemantics,
  careerId:b.careerId,rosterSnapshotId:b.requestedRosterSnapshotId,status:b.status,reasons:[...b.reasons],
  roster:b.roster===null?null:{...b.roster},
  rows:b.rows===null?null:b.rows.map((row,index)=>{
   const d=row.distribution,identity=links![index].identity;
   return {playerId:row.playerId,name:null,nameStatus:'UNAVAILABLE_IN_EXPORT' as const,
    identity:identity===null?null:{...identity},status:row.status,reasons:[...row.reasons],
    currentInventoryHash:row.currentInventoryHash,producerAvailability:row.producerAvailability===null?null:{...row.producerAvailability},
    source:d?.source===null||d===null?null:{...d.source,time:{...d.source.time}},
    reference:d?.reference??null,timeSemantics:d?.timeSemantics??null,
    totalContacts:d?.totalContacts??null,bandCount:d?.bandCount??null,boundary25Count:d?.boundary25Count??null,
    fraction:d?.fraction??null,contacts:d?.contacts===null||d===null?null:d.contacts.map(contact=>({...contact,time:{...contact.time}}))};
  })
 };
}
