import { createRequire } from 'node:module';
import { expect,it } from 'vitest';
import { ownedScheduledMotionArchiveJson,ownedScheduledMotionSnapshotFormat } from './OwnedScheduledMotionArchive';
import { assertOwnedMotionPhysicalMetadata } from './OwnedMotionPhysicalMetadata';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const format='received_renewal_adoption_snapshot_v1';
// Storage-identity fixtures only. These tiny shapes stand in for logical values
// already rederived by the Native physical owner; they claim no physics credit.
const first={sourceId:'physical-1',sourceVersion:'encoding-fixture-v1',baseFieldSourceId:'field',previousExecutionSourceId:null,action:{kind:'owned_motion_v2'}};
const adopted={sourceId:'physical-2',sourceVersion:'encoding-fixture-v1',baseFieldSourceId:'field',previousExecutionSourceId:'physical-1',action:{kind:'received_renewal_adoption_v1',renewalEnrollmentSourceId:'enrollment',renewalMotorSourceId:'motor'}};
const baseField={source:{sourceId:'field',sourceVersion:'encoding-fixture-v1'},response:{model:{gameId:'game'},touch:{worldContact:{flight:{source:{physicalPitchSourceId:'pitch'}}}}}};
const snapshot=(renewal=true)=>({source:renewal?adopted:first,baseField,revision:renewal?2:1,history:renewal?[first,adopted]:[first],execution:{kind:renewal?'received_renewal_adoption_v1':'owned_motion_v2',opaque:'domain payload'}} as unknown as DurableBattedWorldFieldExecution);
const rows=(storedFormat:string)=>{
  const firstSnapshot=ownedScheduledMotionArchiveJson(snapshot(false)),second=JSON.parse(ownedScheduledMotionArchiveJson(snapshot()));second.snapshotFormat=storedFormat;
  return [{source_id:first.sourceId,physical_pitch_source_id:'pitch',base_field_source_id:'field',previous_source_id:null,revision:1,game_id:'game',source_json:json(first),snapshot_json:firstSnapshot},
    {source_id:adopted.sourceId,physical_pitch_source_id:'pitch',base_field_source_id:'field',previous_source_id:first.sourceId,revision:2,game_id:'game',source_json:json(adopted),snapshot_json:json(second)}];
};
it('RA01 selects a distinct renewal archive discriminator despite earlier owned motion history',()=>{
  expect(JSON.parse(ownedScheduledMotionArchiveJson(snapshot())).snapshotFormat,'RENEWAL_ARCHIVE_RELABELLED_AS_V1').toBe(format);
});
it('RA02 authenticates renewal ownership headers while its later domain payload remains opaque',()=>{
  const db=new DatabaseSync(':memory:');try{const prefix=rows(format);expect(()=>assertOwnedMotionPhysicalMetadata(db,prefix[1],prefix),'RENEWAL_ARCHIVE_METADATA_UNSUPPORTED').not.toThrow();}finally{db.close();}
});
it('RA03 rejects a renewal Source relabelled with the older archive discriminator',()=>{
  const db=new DatabaseSync(':memory:');try{const prefix=rows(ownedScheduledMotionSnapshotFormat);expect(()=>assertOwnedMotionPhysicalMetadata(db,prefix[1],prefix),'RENEWAL_SOURCE_OLD_ARCHIVE_ACCEPTED').toThrow(/format|renewal/);}finally{db.close();}
});
it('RA04 retains the existing owned-motion archive shape for its original prefix',()=>{
  const value=JSON.parse(ownedScheduledMotionArchiveJson(snapshot(false)));expect(value.snapshotFormat).toBe(ownedScheduledMotionSnapshotFormat);expect(value.source).toEqual(first);expect(value.revision).toBe(1);expect(value.history).toHaveLength(1);
});
it('RA05 rejects missing duplicated or rebound declared renewal references in archive headers',()=>{
  const db=new DatabaseSync(':memory:');try{
    for(const mode of ['missing','rebound','duplicate']){
      const prefix=rows(format),last=prefix[1],value=JSON.parse(last.snapshot_json);
      if(mode==='missing')last.source_json=json({...adopted,action:{kind:'received_renewal_adoption_v1',renewalMotorSourceId:'motor'}});
      else if(mode==='rebound'){value.source.action.renewalEnrollmentSourceId='other';last.snapshot_json=json(value);}
      else last.snapshot_json=last.snapshot_json.replace('"renewalEnrollmentSourceId":"enrollment"','"renewalEnrollmentSourceId":"enrollment","renewalEnrollmentSourceId":"other"');
      expect(()=>assertOwnedMotionPhysicalMetadata(db,last,prefix),'RENEWAL_ARCHIVE_REFERENCE_MIRROR_IGNORED').toThrow(/metadata|renewal|format/);
    }
  }finally{db.close();}
});
