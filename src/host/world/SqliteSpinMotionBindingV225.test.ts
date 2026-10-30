import { afterEach, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { spinPracticeFixtureV123 } from './SpinMasteryV123.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteSpinControlMasteryV123 } from './SqliteSpinControlMasteryV123';
import { readNativeStandaloneBattingMotorEvidenceV224 } from './SqliteStandalonePracticeStore';
import { openSqliteSpinMotionBindingV225, readNativeSpinMotionBindingV225, spinMotionBindingReferenceV225 } from './SqliteSpinMotionBindingV225';
import type { SpinMotionBindingSourceV225 } from './SpinMotionBindingV225';
const cleanup:(()=>void)[]=[];afterEach(()=>{while(cleanup.length)cleanup.pop()!()});
const {DatabaseSync,constants}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('V225-N01 accepts and reauthenticates one original drill binding without altering old Owners',async()=>{
 const f=await spinPracticeFixtureV123(cleanup);
 const calibration={sourceId:'spin-qualification-calibration',sourceVersion:'synthetic-test-v1',acceptedAtDay:12,status:'MODEL_VERIFIED' as const,technique:'BACKSPIN' as const,
  minimumIntentionalContacts:3,minimumDirectionalSpinRadPerSecond:.001,minimumSuccessFraction:.5};
 const masterySource={sourceId:'mastery-backspin',sourceVersion:'synthetic-test-v1',sourceEffectIdentity:'player-p1-backspin',careerId:'career-a',playerId:'p1',personLinkSourceId:'intake-p1',acceptedAtDay:17,technique:'BACKSPIN' as const,
  exposureRef:{sourceId:f.exposure.source.sourceId,sourceVersion:f.exposure.source.sourceVersion,sourceHash:hash(f.exposure.source),snapshotHash:hash(f.exposure)},
  repertoireRef:{sourceId:f.batting.repertoire.sourceId,sourceVersion:f.batting.repertoire.sourceVersion},calibrationRef:{sourceId:calibration.sourceId,sourceVersion:calibration.sourceVersion},distinctiveness:.9,
  policy:{policyId:'synthetic-qualified-mastery',version:'v1',availableAtDay:10,minimumEffectiveExposure:.1,minimumDistinctPracticeDays:1,minimumDistinctiveness:.8}};
 const masteryOwner=openSqliteSpinControlMasteryV123(f.path,{readAcceptedMastery:id=>id===masterySource.sourceId?masterySource:null,readAcceptedCalibration:id=>id===calibration.sourceId?calibration:null});cleanup.push(masteryOwner.close);
 const mastery=masteryOwner.accept(masterySource.sourceId),oldMastery=json(mastery),events=f.eventIds;
 f.db.exec('BEGIN');let evidence:ReturnType<typeof readNativeStandaloneBattingMotorEvidenceV224>[];
 try{evidence=events.map(id=>readNativeStandaloneBattingMotorEvidenceV224(f.db,id))}finally{f.db.exec('ROLLBACK')}
 const source:SpinMotionBindingSourceV225={version:'spin_motion_binding_source_v225',sourceId:'binding-back',sourceVersion:'v1',careerId:'career-a',playerId:'p1',personLinkSourceId:'intake-p1',acceptedAtDay:17,technique:'BACKSPIN',
  masteryReference:{owner:'world_spin_mastery_v123',sourceId:mastery.source.sourceId,sourceHash:hash(mastery.source),snapshotHash:hash(mastery)},
  evidenceReferences:evidence.map(e=>({sourceEventId:e.sourceEventId,sourceRef:{sourceId:e.source.sourceId,sourceVersion:e.source.sourceVersion},acceptedEvidenceHash:e.acceptedEvidenceHash,physicalProofHash:e.physicalProofHash})),
  ruleVersion:'ORIGINAL_DRILL_RELEASE_NEUTRAL_PLATE_V1'};
 const sources=new Map<string,SpinMotionBindingSourceV225>([[source.sourceId,source]]),binding=openSqliteSpinMotionBindingV225(f.path,{readAcceptedBinding:id=>sources.get(id)??null});cleanup.push(binding.close);
 expect(binding.read(source.sourceId)).toBeNull();
 f.db.exec("CREATE TRIGGER fail_v225 BEFORE INSERT ON world_spin_motion_bindings_v225 BEGIN SELECT RAISE(ABORT,'stop v225'); END");
 expect(()=>binding.accept(source.sourceId)).toThrow(/stop v225/);expect(binding.read(source.sourceId)).toBeNull();f.db.exec('DROP TRIGGER fail_v225');
 sources.set(source.sourceId,{...source,evidenceReferences:source.evidenceReferences.map((e,i)=>i===0?{...e,physicalProofHash:'0'.repeat(64)}:e)});
 expect(()=>binding.accept(source.sourceId)).toThrow(/evidence differs/);sources.set(source.sourceId,source);
 sources.set(source.sourceId,{...source,masteryReference:{...source.masteryReference,sourceHash:'0'.repeat(64)}});
 expect(()=>binding.accept(source.sourceId)).toThrow(/mastery or scope/);sources.set(source.sourceId,source);
 const value=binding.accept(source.sourceId);expect(value.scope).toBe('ORIGINAL_PRACTICE_DESCRIPTION_ONLY');expect(value.futureTransferProven).toBe(false);
 expect(value.observations).toHaveLength(3);expect(value.observations.map(o=>o.absoluteTarget)).toEqual(evidence.map(e=>e.source.command.plan.targetBallCenterAtPlate));
 expect(value.observations.map(o=>o.neutralAnchor)).toEqual(evidence.map(e=>({x:e.plannedDelivery.release.position.x,y:e.plannedDelivery.release.position.y,z:0})));
 expect(binding.accept(source.sourceId)).toEqual(value);expect(json(masteryOwner.read(masterySource.sourceId))).toBe(oldMastery);
 const ref=spinMotionBindingReferenceV225(value);expect(Object.keys(ref).sort()).toEqual(['owner','snapshotHash','sourceHash','sourceId']);
 sources.set('alias',{...source,sourceId:'alias'});expect(()=>binding.accept('alias')).toThrow(/alias/);expect(binding.read('alias')).toBeNull();
 sources.set(source.sourceId,{...source,sourceVersion:'changed'});expect(()=>binding.accept(source.sourceId)).toThrow(/frozen/);sources.set(source.sourceId,source);
 f.db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v225');f.db.setAuthorizer(code=>code===constants.SQLITE_ATTACH?constants.SQLITE_DENY:constants.SQLITE_OK);
 try{const before=f.db.prepare('SELECT total_changes() n').get()!.n;expect(readNativeSpinMotionBindingV225(f.db,source.sourceId)).toEqual(value);expect(f.db.prepare('SELECT total_changes() n').get()!.n).toBe(before);
  expect(()=>f.db.prepare("ATTACH DATABASE ':memory:' AS denied")).toThrow(/not authorized/);f.db.exec('ROLLBACK TO caller_v225; RELEASE caller_v225');expect(f.db.isTransaction).toBe(true)}
 finally{f.db.setAuthorizer(null);if(f.db.isTransaction)f.db.exec('ROLLBACK');f.db.exec('PRAGMA query_only=0')}
 binding.close();const offline=openSqliteSpinMotionBindingV225(f.path);cleanup.push(offline.close);expect(offline.read(source.sourceId)).toEqual(value);
 f.db.prepare('UPDATE world_spin_motion_bindings_v225 SET source_hash=? WHERE source_id=?').run('bad',source.sourceId);expect(()=>offline.read(source.sourceId)).toThrow(/original Source differs/);
 f.db.prepare('UPDATE world_spin_motion_bindings_v225 SET source_hash=? WHERE source_id=?').run(hash(source),source.sourceId);
 f.db.prepare("UPDATE world_spin_motion_bindings_v225 SET source_json=json_set(source_json,'$.sourceId','hidden-alias') WHERE source_id=?").run(source.sourceId);
 expect(()=>offline.read('hidden-alias')).toThrow(/identity alias/);
 f.db.prepare('UPDATE world_spin_motion_bindings_v225 SET source_json=? WHERE source_id=?').run(json(source),source.sourceId);
 f.db.prepare('UPDATE world_spin_motion_bindings_v225 SET snapshot_hash=? WHERE source_id=?').run('bad',source.sourceId);expect(()=>offline.read(source.sourceId)).toThrow(/snapshot differs/);
},120000);

it('V225-N02 treats absent schema as empty and rejects non-table authority',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec('BEGIN');expect(readNativeSpinMotionBindingV225(db,'missing')).toBeNull();db.exec('ROLLBACK');
  db.exec('CREATE VIEW world_spin_motion_bindings_v225 AS SELECT 1 AS source_id; BEGIN');expect(()=>readNativeSpinMotionBindingV225(db,'missing')).toThrow(/schema/);db.exec('ROLLBACK')}
 finally{if(db.isTransaction)db.exec('ROLLBACK');db.close()}
});

it('V225-N03 rejects a hidden mastery mirror alias on ordinary read before consulting missing Owners',()=>{
 const db=new DatabaseSync(':memory:'),h='a'.repeat(64),source={version:'spin_motion_binding_source_v225',sourceId:'one',sourceVersion:'v1',careerId:'c',playerId:'p',personLinkSourceId:'link',acceptedAtDay:20,
  technique:'BACKSPIN',masteryReference:{owner:'world_spin_mastery_v123',sourceId:'mastery',sourceHash:h,snapshotHash:h},
  evidenceReferences:[0,1,2].map(i=>({sourceEventId:'e'+i,sourceRef:{sourceId:'s'+i,sourceVersion:'1'},acceptedEvidenceHash:h,physicalProofHash:h})),ruleVersion:'ORIGINAL_DRILL_RELEASE_NEUTRAL_PLATE_V1'};
 try{db.exec('CREATE TABLE world_spin_motion_bindings_v225(source_id TEXT PRIMARY KEY,mastery_source_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)');
  const insert=db.prepare('INSERT INTO world_spin_motion_bindings_v225 VALUES(?,?,?,?,?,?)');insert.run('one','mastery',json(source),hash(source),json({source}),hash({source}));
  const other={...source,sourceId:'other'};insert.run('other','different-index',json(other),hash(other),json({source:other}),hash({source:other}));
  db.exec('BEGIN');expect(()=>readNativeSpinMotionBindingV225(db,'one')).toThrow(/mastery alias/);db.exec('ROLLBACK');
 }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close()}
});
