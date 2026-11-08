import type { DatabaseSync } from 'node:sqlite';
import { freeze } from '../src/core/world/traits/TraitValidation';
import { withBattedVenueLegalReadSnapshot } from '../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from '../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { assertNativeContactReportSubjectV192FromSqlite } from './native-contact-report-runtime-v192';
import { readNativeContactDistributionBatchV263FromSqlite, type NativeContactDistributionBatchV263 } from './native-contact-distribution-batch-v263';

export type NativeContactRosterExportV264 = Readonly<{
 version:'native-contact-roster-export-v264'; boundary:'LOCAL_READ_ONLY_NATIVE_ROSTER_EXPORT';
 batch:NativeContactDistributionBatchV263;
 subjectLinks:readonly Readonly<{playerId:string; identity:Readonly<{careerId:string;playerId:string;personId:string;sourceId:string}>|null}>[]|null;
}>;
/** One Native query-only snapshot; identity is the Owner's current link, not historical membership. */
export function readNativeContactRosterExportV264FromSqlite(db:DatabaseSync, input:Readonly<{careerId:string;rosterSnapshotId:string}>):NativeContactRosterExportV264 {
 return withBattedVenueLegalReadSnapshot(db,()=>withSamePaLifecycleReadPhase(db,()=>{
  const batch=readNativeContactDistributionBatchV263FromSqlite(db,input);
  if(batch.rows!==null && (!batch.roster || batch.rows.length!==batch.roster.playerCount || new Set(batch.rows.map(row=>row.playerId)).size!==batch.rows.length)) throw Error('contact roster export rows differ');
  const subjectLinks=batch.rows===null?null:batch.rows.map(row=>{
   if(row.distribution===null)return {playerId:row.playerId,identity:null};
   if(row.distribution.scope.careerId!==batch.careerId || row.distribution.scope.playerId!==row.playerId) throw Error('contact roster export distribution scope differs');
   const link=assertNativeContactReportSubjectV192FromSqlite(db,{careerId:batch.careerId,playerId:row.playerId});
   if(link.careerId!==batch.careerId||link.playerId!==row.playerId)throw Error('contact roster export identity differs');
   return {playerId:row.playerId,identity:{careerId:link.careerId,playerId:link.playerId,personId:link.personId,sourceId:link.sourceId}};
  });
  return freeze({version:'native-contact-roster-export-v264' as const,boundary:'LOCAL_READ_ONLY_NATIVE_ROSTER_EXPORT' as const,batch,subjectLinks});
 }));
}
