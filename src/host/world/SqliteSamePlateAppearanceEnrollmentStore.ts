import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { deriveSamePlateAppearanceEnrollment,readSamePlateAppearanceEnrollment } from './SamePlateAppearanceEnrollmentFromSqlite';
import { samePlateAppearanceEnrollmentInput,samePaId } from './SamePlateAppearanceEnrollment';
import { assertSamePaStorage,samePaSchema,samePaMember,samePaSlot } from './SamePlateAppearanceReservationGuard';
import { actorJson as json,actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
/** Reservation only. Opening/reading never installs or repairs owner storage.
 * Its private Native connection carries every proof and all twelve inserts. */
export const openSqliteSamePlateAppearanceEnrollmentStore = (path:string,
  authority?:Readonly<{readAcceptedEnrollment(sourceId:string):unknown}>) => {
  if(!samePaId(path)||authority&&typeof authority.readAcceptedEnrollment!=='function')throw new Error('invalid same-PA enrollment owner');
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(path);
  let closed=false,failed=false;
  const check=()=>{if(closed||failed)throw new Error('same-PA enrollment owner is closed or retired');};
  const counters=()=>({changes:Number(db.prepare('SELECT total_changes() AS n').get()!.n),
    main:Number(db.prepare('PRAGMA main.schema_version').get()!.schema_version),temp:Number(db.prepare('PRAGMA temp.schema_version').get()!.schema_version),
    user:Number(db.prepare('PRAGMA main.user_version').get()!.user_version)});
  const setting=()=>Number(db.prepare('PRAGMA query_only').get()!.query_only);
  const retire=(error:unknown,cleanup:unknown[]=[]):never=>{failed=true;try{db.close();closed=true;}catch(e){cleanup.push(e);}
    throw new AggregateError([error,...cleanup],'same-PA enrollment owner retired after uncertain transaction state; committed effects cannot be rolled back',{cause:error});};
  const run=<T>(write:boolean,body:(proof:<R>(fn:()=>R)=>R,step:(sql:()=>void,rows:number,schemas?:number)=>void)=>T,verify?:(value:T)=>void):T=>{
    check();if(db.isTransaction)return retire(new Error('same-PA unowned transaction'));
    const originalSetting=setting(),original=counters(),identity='same_pa_'+randomUUID().replaceAll('-','');
    let expected={...original},acquired=false,identityReady=false,committing=false,uncertain=false;
    const identityCheck=()=>{
      if(!db.isTransaction||setting()!==originalSetting)throw new Error('same-PA transaction or setting changed');
      try{db.exec('RELEASE '+identity);identityReady=false;db.exec('SAVEPOINT '+identity);identityReady=true;}
      catch(e){uncertain=true;throw e;}
    };
    const account=()=>{if(json(counters())!==json(expected))throw new Error('same-PA transaction write accounting or schema differs');};
    const proof=<R>(fn:()=>R):R=>{
      identityCheck();account();db.exec('PRAGMA query_only=1');
      try{const v=withBattedWorldPhysicalReadTraversal(db,fn);if(!db.isTransaction||setting()!==1)throw new Error('same-PA proof transaction changed');account();return v;}
      finally{db.exec('PRAGMA query_only='+originalSetting);identityCheck();account();}
    };
    const step=(sql:()=>void,rows:number,schemas=0)=>{
      identityCheck();account();sql();expected={...expected,changes:expected.changes+rows,main:expected.main+schemas};identityCheck();account();
    };
    try{
      db.exec(write?'BEGIN IMMEDIATE':'BEGIN');acquired=true;
      if(!db.isTransaction)throw new Error('same-PA acquisition lost transaction');
      db.exec('SAVEPOINT '+identity);identityReady=true;account();
      proof(()=>assertSamePaStorage(db));const value=body(proof,step);proof(()=>assertSamePaStorage(db));identityCheck();account();
      db.exec('RELEASE '+identity);identityReady=false;committing=true;db.exec('COMMIT');
      if(db.isTransaction||setting()!==originalSetting)throw new Error('same-PA commit retained an uncertain transaction');account();
      // Verify the durable row set on a new read snapshot, after COMMIT's return.
      // Failure here retires the connection; there is no compensating mutation.
      if(verify){db.exec('BEGIN');db.exec('PRAGMA query_only=1');
        try{withBattedWorldPhysicalReadTraversal(db,()=>verify(value));account();if(!db.isTransaction||setting()!==1)throw new Error('same-PA durable verification changed transaction');}
        finally{db.exec('PRAGMA query_only='+originalSetting);}
        db.exec('COMMIT');if(db.isTransaction||setting()!==originalSetting)throw new Error('same-PA durable verification commit differs');account();}
      return value;
    }catch(error){
      const cleanup:unknown[]=[];uncertain ||= committing;
      try{if(db.isTransaction){if(identityReady)try{db.exec('ROLLBACK TO '+identity);}catch(e){uncertain=true;cleanup.push(e);}
        else uncertain=true;db.exec('ROLLBACK');}else if(acquired)uncertain=true;}catch(e){uncertain=true;cleanup.push(e);}
      try{if(setting()!==originalSetting){uncertain=true;db.exec('PRAGMA query_only='+originalSetting);}if(db.isTransaction)throw new Error('same-PA rollback retained transaction');}
      catch(e){uncertain=true;cleanup.push(e);}
      if(uncertain||cleanup.length)return retire(error,cleanup);throw error;
    }
  };
  const read=(sourceId:string)=>{check();if(!samePaId(sourceId))throw new Error('invalid same-PA Source identity');return run(false,proof=>proof(()=>readSamePlateAppearanceEnrollment(db,sourceId)));};
  return Object.freeze({read,accept(sourceId:string){
    check();if(!samePaId(sourceId))throw new Error('invalid same-PA Source identity');
    const raw=authority?.readAcceptedEnrollment(sourceId)??null,source=raw===null?null:samePlateAppearanceEnrollmentInput(raw,sourceId);
    const prior=read(sourceId);
    if(prior){if(source&&json(source)!==json(prior.source))throw new Error('same-PA enrollment Source already frozen differently');return prior;}
    if(!source)throw new Error('accepted same-PA enrollment Source missing');
    const preflight=run(false,proof=>proof(()=>deriveSamePlateAppearanceEnrollment(db,source)));
    return run(true,(proof,step)=>{
      const current=proof(()=>deriveSamePlateAppearanceEnrollment(db,source));
      if(json(current)!==json(preflight))throw new Error('same-PA stale prerequisites changed before reservation');
      if(current.kind==='pending')return current;
      const beforeRows=proof(()=>assertSamePaStorage(db)?Object.keys(samePaSchema).map(table=>db.prepare(`SELECT * FROM main.${table} ORDER BY rowid`).all()):[[],[],[]]);
      if(!assertSamePaStorage(db))for(const sql of Object.values(samePaSchema))step(()=>db.exec(sql),0,1);
      const expectedRows=beforeRows.map(rows=>[...rows]);
      const verify=()=>proof(()=>{
        if(!assertSamePaStorage(db))throw new Error('same-PA installed owner disappeared');
        const derived=deriveSamePlateAppearanceEnrollment(db,source,sourceId);
        if(json(derived)!==json(current))throw new Error('same-PA baseline/actor changed during reservation');
        for(const [i,table] of Object.keys(samePaSchema).entries())if(json(db.prepare(`SELECT * FROM main.${table} ORDER BY rowid`).all())!==json(expectedRows[i]))throw new Error('same-PA root/member/right changed during reservation');
      });
      const root={source_id:sourceId,career_id:current.careerId,game_id:current.gameId,play_id:current.playId,
        actor_source_id:source.actorReference.sourceId,first_pitch_source_id:source.firstPhysicalPitchSourceId,
        source_json:json(source),source_hash:hash(source),snapshot_json:json(current),snapshot_hash:hash(current)};
      verify();step(()=>db.prepare('INSERT INTO main.same_pa_enrollments VALUES(?,?,?,?,?,?,?,?,?,?)').run(...Object.values(root)),1);expectedRows[0].push(root);verify();
      for(const p of current.participants){const m=samePaMember(current,p),row={enrollment_source_id:sourceId,career_id:current.careerId,player_id:m.playerId,baseline_source_id:m.baselineSourceId,revision:m.revision,state_hash:m.stateHash,member_json:json(m)};
        step(()=>db.prepare('INSERT INTO main.same_pa_participant_reservations VALUES(?,?,?,?,?,?,?)').run(...Object.values(row)),1);expectedRows[1].push(row);verify();}
      const slot={enrollment_source_id:sourceId,first_pitch_source_id:source.firstPhysicalPitchSourceId,game_id:current.gameId,play_id:current.playId,
        state:'blocked_execution_basis',predecessor_resume_source_id:null,consuming_source_id:null,slot_json:json(samePaSlot(current))};
      step(()=>db.prepare('INSERT INTO main.same_pa_successor_rights VALUES(?,?,?,?,?,?,?,?)').run(...Object.values(slot)),1);expectedRows[2].push(slot);verify();
      const saved=proof(()=>readSamePlateAppearanceEnrollment(db,sourceId));if(json(saved)!==json(current))throw new Error('same-PA saved enrollment differs');return current;
    },value=>{if(value.kind==='reserved'&&json(readSamePlateAppearanceEnrollment(db,sourceId))!==json(value))throw new Error('same-PA durable enrollment differs after commit');});
  },close(){if(!closed){db.close();closed=true;}}});
};
