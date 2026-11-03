import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../src/core/adjudication/OfficialWindowPolicy';
import { classifyLineDriveAngleBandV262 } from '../src/core/world/traits/classifiers/LineDriveAngleBandV262';
import { contactAngleDegV240 } from '../src/core/world/traits/classifiers/MeasuredContactAngleRuleV240';
import type { TraitScope, TraitTime } from '../src/core/world/traits/TraitTypes';
import type { TraitSourceSnapshot } from '../src/core/world/traits/sources/SourceTraitTypes';
import { freeze, readScope, same } from '../src/core/world/traits/TraitValidation';
import { readNativeBattingContactTraitProjectionV189FromSqlite } from '../src/host/world/NativeBattingContactTraitProjectionV189';
import { readNativeBattingContactObservationSnapshotV189FromSqlite } from '../src/host/world/SqliteNativeBattingContactObservationStoreV188';
import { withBattedVenueLegalReadSnapshot } from '../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from '../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { assertNativeContactReportSubjectV192FromSqlite } from './native-contact-report-runtime-v192';

type Band='BOUNDARY_25'|'LINE_DRIVE_BAND'|'OUTSIDE';
export type NativeContactDistributionV262=Readonly<{
 version:'native-contact-distribution-v262';boundary:'READ_ONLY_SUPPORTED_NATIVE_CONTACT_DISTRIBUTION';
 scope:TraitScope;status:'OBSERVED'|'UNKNOWN';reasons:readonly string[];source:TraitSourceSnapshot|null;inventoryHash:string|null;
 totalContacts:number|null;bandCount:number|null;boundary25Count:number|null;fraction:number|null;
 contacts:readonly Readonly<{eventId:string;episodeId:string;time:TraitTime;launchAngleDeg:number;label:Band}>[]|null;
 populationCoverage:'SUPPORTED_NATIVE_INVENTORY_ONLY';timeSemantics:'AS_OF_LATEST_REGISTERED_CONTACT';
 reference:'MLB_LA_GENERAL_GUIDELINE';directionStatus:'UNASSESSED';physicsEffects:'NONE';modelAuthority:'NOT_USED';
}>;
/** Single authenticated subject; a captured supported inventory is not all possible producers. */
export function readNativeContactDistributionV262FromSqlite(db:DatabaseSync,rawScope:TraitScope):NativeContactDistributionV262 {
 const scope=readScope(cloneInert(rawScope),'scope');
 return withBattedVenueLegalReadSnapshot(db,()=>withSamePaLifecycleReadPhase(db,()=>{
  assertNativeContactReportSubjectV192FromSqlite(db,scope);
  const projection=readNativeBattingContactTraitProjectionV189FromSqlite(db,{scope,model:null,policy:null,worldRevision:0,
   classificationId:'native-contact-distribution-v262:classification',projectionId:'native-contact-distribution-v262:projection'});
  const base={version:'native-contact-distribution-v262' as const,boundary:'READ_ONLY_SUPPORTED_NATIVE_CONTACT_DISTRIBUTION' as const,
   scope:cloneInert(scope),source:projection.source,inventoryHash:projection.currentInventoryHash,
   populationCoverage:'SUPPORTED_NATIVE_INVENTORY_ONLY' as const,timeSemantics:'AS_OF_LATEST_REGISTERED_CONTACT' as const,
   reference:'MLB_LA_GENERAL_GUIDELINE' as const,directionStatus:'UNASSESSED' as const,physicsEffects:'NONE' as const,modelAuthority:'NOT_USED' as const};
  const unknown=(reasons:readonly string[]):NativeContactDistributionV262=>freeze({...base,status:'UNKNOWN' as const,reasons:[...reasons],
   totalContacts:null,bandCount:null,boundary25Count:null,fraction:null,contacts:null});
  if(projection.reasons.length!==1||projection.reasons[0]!=='NO_MEASUREMENT_MODEL')return unknown(projection.reasons.length?projection.reasons:['PROJECTION_NOT_READY']);
  const observed=readNativeBattingContactObservationSnapshotV189FromSqlite(db,scope);
  if(!observed||!projection.source||!same(observed.source,projection.source)||observed.captureCoverage?.inventoryHash!==projection.currentInventoryHash
   ||observed.observations.length!==observed.receipts.length||observed.observations.length===0)return unknown(['SNAPSHOT_INCONSISTENT']);
  const contacts=[] as {eventId:string;episodeId:string;time:TraitTime;launchAngleDeg:number;label:Band}[];
  for(const item of observed.observations){const v=item.exitVelocityMps;
   if(![v.x,v.y,v.z].every(Number.isFinite)||Math.hypot(v.x,v.y,v.z)===0)return unknown(['UNDEFINED_CONTACT_DIRECTION']);
   const launchAngleDeg=contactAngleDegV240(v);contacts.push({eventId:item.eventId,episodeId:item.episodeId,time:cloneInert(item.time),
    launchAngleDeg,label:classifyLineDriveAngleBandV262(launchAngleDeg)});
  }
  const boundary25Count=contacts.filter(c=>c.label==='BOUNDARY_25').length,bandCount=contacts.filter(c=>c.label!=='OUTSIDE').length;
  return freeze({...base,status:'OBSERVED' as const,reasons:[],totalContacts:contacts.length,bandCount,boundary25Count,
   fraction:bandCount/contacts.length,contacts});
 }));
}
