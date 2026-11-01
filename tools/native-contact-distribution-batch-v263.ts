import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../src/core/adjudication/OfficialWindowPolicy';
import { freeze, obj, text } from '../src/core/world/traits/TraitValidation';
import { readGlobalRosterSnapshotFromSqlite } from '../src/host/world/SqliteNationalRosterSnapshotStore';
import { readNativeBattingContactInventoryV188FromSqlite, type NativeBattingContactInventoryV188 } from '../src/host/world/NativeBattingContactInventoryV188';
import { withBattedVenueLegalReadSnapshot } from '../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from '../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readNativeContactDistributionV262FromSqlite, type NativeContactDistributionV262 } from './native-contact-distribution-v262';

type Row=Readonly<{playerId:string;status:'OBSERVED'|'UNKNOWN';reasons:readonly string[];distribution:NativeContactDistributionV262|null;
 currentInventoryHash:string|null;producerAvailability:NativeBattingContactInventoryV188['producerAvailability']|null}>;
export type NativeContactDistributionBatchV263=Readonly<{
 version:'native-contact-distribution-batch-v263';boundary:'READ_ONLY_NATIVE_ROSTER_CONTACT_BATCH';careerId:string;requestedRosterSnapshotId:string;
 status:'OBSERVED_FOR_SNAPSHOT_ROSTER'|'PARTIAL'|'UNKNOWN';reasons:readonly string[];
 roster:Readonly<{snapshotId:string;revision:number;effectiveDay:number;playerCount:number}>|null;rows:readonly Row[]|null;
 populationBoundary:'EXPLICIT_GLOBAL_ROSTER_SNAPSHOT_ONLY';producerCoverage:'SUPPORTED_NATIVE_INVENTORY_ONLY';
 asOfSemantics:'ROSTER_CHECKPOINT_AND_LATEST_REGISTERED_CONTACT_AT_SAME_DB_SNAPSHOT';directionStatus:'UNASSESSED';physicsEffects:'NONE';
}>;
/** Explicit accepted roster checkpoint; no historical or non-roster population claim. */
export function readNativeContactDistributionBatchV263FromSqlite(db:DatabaseSync,raw:Readonly<{careerId:string;rosterSnapshotId:string}>):NativeContactDistributionBatchV263{
 const input=obj(cloneInert(raw),['careerId','rosterSnapshotId'],'request'),careerId=text(input.careerId,'request.careerId'),rosterSnapshotId=text(input.rosterSnapshotId,'request.rosterSnapshotId');
 return withBattedVenueLegalReadSnapshot(db,()=>withSamePaLifecycleReadPhase(db,()=>{
  const base={version:'native-contact-distribution-batch-v263' as const,boundary:'READ_ONLY_NATIVE_ROSTER_CONTACT_BATCH' as const,careerId,requestedRosterSnapshotId:rosterSnapshotId,
   populationBoundary:'EXPLICIT_GLOBAL_ROSTER_SNAPSHOT_ONLY' as const,producerCoverage:'SUPPORTED_NATIVE_INVENTORY_ONLY' as const,
   asOfSemantics:'ROSTER_CHECKPOINT_AND_LATEST_REGISTERED_CONTACT_AT_SAME_DB_SNAPSHOT' as const,directionStatus:'UNASSESSED' as const,physicsEffects:'NONE' as const};
  const unknown=(reason:string):NativeContactDistributionBatchV263=>freeze({...base,status:'UNKNOWN' as const,reasons:[reason],roster:null,rows:null});
  const table=(name:string)=>{const rows=db.prepare('SELECT type FROM main.sqlite_master WHERE name=?').all(name);if(rows.length>1||rows.length===1&&rows[0].type!=='table')throw Error('Native contact batch namespace differs');return rows.length===1};
  if(!table('world_national_roster_snapshots'))return unknown('ROSTER_SNAPSHOT_NAMESPACE_ABSENT');
  const saved=readGlobalRosterSnapshotFromSqlite(db,careerId,rosterSnapshotId);if(!saved)return unknown('ROSTER_SNAPSHOT_NOT_FOUND');
  if(!table('world_player_person_links'))return unknown('SUBJECT_LINK_NAMESPACE_ABSENT');
  const roster={snapshotId:saved.snapshotId,revision:saved.revision,effectiveDay:saved.effectiveDay,playerCount:saved.roster.players.length};
  if(!saved.roster.players.length)return freeze({...base,status:'UNKNOWN' as const,reasons:['EMPTY_ROSTER_SNAPSHOT'],roster,rows:[]});
  const locator=db.prepare('SELECT source_id FROM main.world_player_person_links WHERE career_id=? AND player_id=? LIMIT 2'),rows:Row[]=[];
  for(const player of saved.roster.players){const links=locator.all(careerId,player.playerId);
   if(links.length!==1){rows.push({playerId:player.playerId,status:'UNKNOWN',reasons:[links.length?'SUBJECT_LINK_AMBIGUOUS':'SUBJECT_LINK_MISSING'],distribution:null,currentInventoryHash:null,producerAvailability:null});continue}
   if(typeof links[0].source_id!=='string'||!links[0].source_id.trim())throw Error('Native contact batch subject locator differs');
   const distribution=readNativeContactDistributionV262FromSqlite(db,{careerId,playerId:player.playerId});
   const inventory=readNativeBattingContactInventoryV188FromSqlite(db,{careerId,playerId:player.playerId});
   if(distribution.inventoryHash!==null&&distribution.inventoryHash!==inventory.inventoryHash)throw Error('Native contact batch inventory snapshot differs');
   rows.push({playerId:player.playerId,status:distribution.status,reasons:[...distribution.reasons],distribution,
    currentInventoryHash:inventory.inventoryHash,producerAvailability:{...inventory.producerAvailability}});
  }
  return freeze({...base,status:rows.every(row=>row.status==='OBSERVED')?'OBSERVED_FOR_SNAPSHOT_ROSTER' as const:'PARTIAL' as const,reasons:[],roster,rows});
 }));
}
